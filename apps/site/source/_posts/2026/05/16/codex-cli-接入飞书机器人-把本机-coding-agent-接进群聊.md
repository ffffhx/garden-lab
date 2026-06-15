---
title: "Codex CLI 接入飞书机器人：让阿里云做入口，Mac 跑 Agent"
date: 2026-05-16 15:50:00
categories:
  - 技术
tags:
  - Codex
  - Feishu
  - Lark
  - Agent
  - CLI
  - 自动化
excerpt: "从一次真实搭建出发，拆解如何用飞书事件回调、阿里云公网 hub、Mac worker、lark-cli 和 codex exec，把群聊消息变成可续聊的本机 Codex 任务。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

这篇文章记录一次真实搭建：把飞书机器人接到本机 `Codex CLI`，让群聊里的一条消息可以触发 Mac 上的 `codex exec`，Codex 跑完以后再把结果回复到飞书消息下面。

先给结论：这件事的核心不是“让飞书直接控制 Codex App”，而是在飞书和 Codex CLI 中间放一层很薄的桥接服务。最开始可以用 Cloudflare Tunnel 直连本机调试；长期使用时，我更推荐让阿里云只做公网入口，真正的 Codex 仍然跑在自己的 Mac 上。

现在这套服务做五件事：

1. 接收飞书开放平台推送的消息事件。
2. 校验事件来源，过滤未授权的群、用户和消息类型。
3. 在阿里云 hub 里把消息排成任务队列。
4. 由 Mac worker 主动拉任务，变成一次 `codex exec` 或 `codex exec resume` 非交互任务。
5. 用 `lark-cli` 或飞书 OpenAPI 把 Codex 的最终回复发回飞书。

最终效果是：

- 你在飞书里 @ 机器人发任务。
- 飞书把事件 POST 到阿里云上的稳定 HTTPS 地址。
- 阿里云 hub 校验事件并把任务写入队列。
- Mac worker 主动拉任务，不需要暴露本机端口。
- worker 启动一个 `codex exec` 子进程，让 Codex 在指定仓库里干活。
- 结果自动回到飞书消息下面。
- 同一个群里的后续消息可以接到同一个 Codex session。

{% asset_img figure-01.svg %}

这篇不是泛泛讲“理论上可以怎么做”，而是按我实际跑通并继续迭代的版本来写。本文用到的关键工具是：

| 组件 | 作用 |
| --- | --- |
| 飞书开放平台机器人 | 提供消息入口、事件订阅和机器人回复能力 |
| 阿里云 ECS / 公网 hub | 提供稳定 HTTPS 回调地址，接事件、验签、排队 |
| Mac worker | 主动 poll hub，拿任务后在本机执行 Codex |
| Cloudflare Tunnel | 本地开发时可选，用来快速验证 `localhost` 回调 |
| Node.js 桥接服务 | 同一份代码支持 `local`、`hub`、`worker` 三种模式 |
| `codex exec` | 在本机以非交互方式执行一次 Codex 任务 |
| `codex exec resume` | 把下一条消息续到已有非交互 session |
| `lark-cli` | 在 worker 回复模式下复用本机登录态，以机器人身份回复飞书消息 |

这次实战的最后一步，是把飞书开放平台里的应用展示名从最初的“飞书 CLI”改成了 **Codex**，并发布了 `1.0.3` 版本。这个动作很重要：飞书后台保存只是草稿，只有创建并发布新版本以后，客户端里的机器人名称才会真正生效。

## 1. 为什么不用“飞书直接连 Codex App”

一开始最容易想到的是：能不能让飞书消息直接出现在 Codex App 里，像普通对话一样显示？

现阶段更稳的做法不是这样。

Codex App 是桌面工作台，适合人直接对话、看计划、看 diff、操作浏览器和桌面。飞书机器人触发的这类任务，更像后台自动化：一条消息进来，服务启动一个子进程，任务结束后拿最终结果。对应的入口是 `codex exec`。

这两者的差别可以先这样理解：

| 入口 | 更像什么 | 适合场景 |
| --- | --- | --- |
| Codex App 普通会话 | 人和 Agent 共享的桌面工作台 | 复杂改动、人工 review、浏览器验证、需要你持续介入的任务 |
| `codex exec` | 一次独立的非交互执行 | webhook、CI、机器人、脚本、定时任务 |
| `codex exec resume` | 续上一次非交互执行 | 同一个飞书群里连续追问、补充需求、让 Codex 接着做 |

这里的“非交互”不是说 Codex 没有上下文，而是说它不会打开 TUI，也不会在执行中等你手动输入。它从 stdin 收到 prompt，自己跑完，把最后一条回复写到文件或 stdout，然后进程退出。

如果你想回到终端里看这个 session，可以用：

```bash
codex resume --include-non-interactive <session-id> # 在交互式 Codex CLI 里打开非交互 session
```

但不要默认认为 Codex App 会像普通聊天一样自动展示这段飞书触发的过程。更靠谱的产品形态是：飞书负责触发和通知，Codex CLI 负责执行，必要时再用 session id 回到 CLI 里查看。

## 2. 总体架构：阿里云做入口，Mac 做执行器

完整链路如下。

{% asset_img figure-02.svg %}

一次消息从飞书到 Codex，再回到飞书，大概会经过这些步骤：

1. 用户在飞书群里 @ 机器人并输入任务。
2. 飞书开放平台把 `im.message.receive_v1` 事件 POST 到阿里云 hub 的 `/lark/events`。
3. hub 校验 Verification Token、签名和加密 payload，过滤白名单、群聊 @、消息类型和命令前缀。
4. hub 把任务写入本地队列文件，并快速给飞书返回 200。
5. Mac worker 每隔几秒主动调用 `/worker/tasks/claim` 拉取任务。
6. worker 在 `CODEX_WORKDIR` 指定的仓库里启动 `codex exec` 子进程。
7. Codex 把最后一条回复写入 `--output-last-message` 指定的临时文件。
8. worker 读取结果，并通过 `lark-cli` 直接回复飞书；或者把结果提交回 hub，由 hub 调 OpenAPI 回复。
9. worker 把任务执行状态提交回 hub，让队列从 `running` 变成 `done` 或 `failed`。
10. 如果启用按群复用 session，worker 把 `chat_id -> session_id` 写进 `.sessions.json`。

这个结构有一个好处：公网只看到阿里云 hub，不会直接打到 Mac。飞书机器人本身不需要知道 Codex 的内部实现，Codex 也不需要知道飞书事件协议。中间的 Node 服务负责把两边的协议翻译一下。

当前包支持三种模式：

| 模式 | 链路 | 适合场景 |
| --- | --- | --- |
| `local` | 飞书 -> 本机服务 -> 本机 Codex -> 飞书 | 本机快速调试，通常配 Cloudflare Tunnel 或 ngrok |
| `hub` | 飞书 -> 阿里云 hub -> 任务队列 | 公网固定入口、验签、排队和 worker API |
| `worker` | Mac 主动 poll hub -> 本机 Codex -> 回复飞书 | Codex 仍跑在自己的 Mac，不暴露本机端口 |

## 3. 前置条件

搭之前先准备这些东西。

| 前置项 | 检查方式 |
| --- | --- |
| 本机能运行 Codex CLI | `codex --version` |
| 本机能非交互执行 Codex | `echo "介绍这个仓库" \| codex exec --cd . -` |
| 本机已配置 `lark-cli` | `lark-cli auth whoami` 或执行一次飞书 IM 命令 |
| 有飞书企业自建应用权限 | 能进入飞书开放平台创建应用 |
| 有一个稳定公网 HTTPS 入口 | 例如阿里云 ECS + Nginx/Caddy 反代到 hub |
| Mac 能访问这个公网入口 | worker 要能请求 `https://你的域名/worker/tasks/claim` |
| 目标仓库路径明确 | 例如 `/Users/bytedance/Code/garden-lab` |

本文的桥接服务放在：

```text
tools/lark-codex-bot/
```

在根目录已经加了三个脚本入口：

```bash
pnpm lark:codex-bot # local 模式：本机直连调试
pnpm lark:codex-hub # hub 模式：阿里云公网入口
pnpm lark:codex-worker # worker 模式：Mac 主动拉任务并执行 Codex
```

## 4. 配飞书开放平台

在飞书开放平台创建一个企业自建应用，然后按这个顺序配：

1. 打开“机器人”能力。
2. 在“事件与回调”里选择“将事件发送至开发者服务器”。
3. 订阅 `im.message.receive_v1`，也就是接收消息 v2.0。
4. 在“加密策略”里复制 `Verification Token`。
5. 如果生产使用，建议开启 `Encrypt Key`，本地调试时也可以先关闭加密降低变量数量。
6. 给应用开通消息接收和消息回复相关权限。
7. 在“凭证与基础信息”的国际化配置里把应用名称改成 `Codex`，补一条简短应用描述。
8. 修改名称、权限或事件订阅以后，记得创建版本并发布，否则线上机器人可能还是旧配置。

飞书保存回调 URL 时，会先发一个 `url_verification` 请求。服务需要把 challenge 原样返回：

```js
if (isUrlVerification(payload)) { // 飞书保存回调地址时会先发 challenge
  verifyPayloadToken(config, payload); // 用 Verification Token 确认请求确实来自飞书
  sendJson(response, 200, { challenge: payload.challenge }); // 原样返回 challenge 完成 URL 校验
  return; // URL 校验完成后不要继续进入消息事件处理
}
```

本地调试时，回调地址不能填 `localhost`，可以先起一个公网 HTTPS 隧道。例如：

```bash
cloudflared tunnel --url http://localhost:8787 # 把本机 8787 端口临时暴露成 HTTPS 地址
```

拿到类似下面这样的地址后，填到飞书后台：

```text
https://your-random-name.trycloudflare.com/lark/events
```

Cloudflare 免费临时隧道很适合调试，但域名会变。真正长期使用，最好换成固定域名、固定 tunnel、内网网关或正式部署环境。

我最后采用的是固定域名的阿里云入口：

```text
https://你的域名/lark/events
```

这时飞书只和阿里云通信；Mac worker 是主动拉任务的一方，不需要公网 IP，也不需要把本机端口暴露出去。

## 5. 配 hub 和 worker 的 `.env`

如果只是本机调试，可以继续复制 local 配置：

```bash
cp tools/lark-codex-bot/.env.example tools/lark-codex-bot/.env # 复制一份本地私有配置
```

但长期运行时，我更推荐拆成两份配置：阿里云 hub 一份，Mac worker 一份。

hub 侧配置关注飞书事件、队列和 worker 鉴权：

```bash
LARK_CODEX_MODE=hub # 当前进程只做公网 hub
PORT=8790 # hub 在服务器本机监听的端口，前面再由 Nginx/Caddy 反代 HTTPS
LARK_EVENT_PATH=/lark/events # 飞书事件回调路径
LARK_APP_ID=cli_xxx # 飞书开放平台应用 ID
LARK_VERIFICATION_TOKEN=xxx # 飞书后台复制出来的 Verification Token
LARK_ENCRYPT_KEY=xxx # 生产建议开启加密事件
HUB_WORKER_TOKEN=replace-with-long-random-token # hub 和 worker 共享的长随机 token
HUB_QUEUE_FILE=/data/queue.json # hub 队列文件，注意不要提交到仓库
RESULT_REPLY_MODE=worker # 让 Mac worker 通过本机 lark-cli 回复飞书
LARK_ALLOWED_CHAT_IDS=oc_xxx # 只允许指定群或私聊触发
LARK_ALLOWED_USER_OPEN_IDS=ou_xxx # 只允许指定用户触发
```

worker 侧配置关注 hub 地址和本机 Codex 执行环境：

```bash
LARK_CODEX_MODE=worker # 当前进程只做 Mac worker
HUB_BASE_URL=https://你的域名 # 不要带 /worker
HUB_WORKER_TOKEN=replace-with-the-same-long-random-token # 必须和 hub 完全一致
WORKER_ID=mac-codex-worker # 方便 hub 记录是哪台机器拿了任务
RESULT_REPLY_MODE=worker # worker 自己负责把结果发回飞书
LARK_REPLY_MODE=cli # 用本机 lark-cli 回复，避免把 App Secret 放到公网服务器
LARK_CLI_BIN=lark-cli # 本机 lark-cli 命令名
CODEX_WORKDIR=/Users/bytedance/Code/garden-lab # Codex 实际工作的仓库目录
CODEX_SANDBOX=workspace-write # 让 Codex 只能在工作区内写文件
CODEX_SESSION_SCOPE=chat # 同一个飞书 chat_id 复用同一个 Codex session
CODEX_TIMEOUT_MS=600000 # 单个任务最长运行时间
```

这里有三个配置值得单独说。

第一，`HUB_WORKER_TOKEN` 是 hub 和 worker 之间的私有通行证。worker 拉任务、提交结果时都要带：

```http
Authorization: Bearer <HUB_WORKER_TOKEN>
```

所以这个值要足够长，不能提交到仓库，也不要贴到文章或聊天里。

第二，`RESULT_REPLY_MODE=worker`。这个模式会让 Mac worker 调用本机已经登录好的 `lark-cli`：

```bash
lark-cli im +messages-reply --as bot --message-id "$MESSAGE_ID" --text "$TEXT" # 用机器人身份回复飞书原消息
```

这样做的优点是：阿里云 hub 不需要保存 `LARK_APP_SECRET`，它只负责收事件、排队和给 worker 提供 API。如果你愿意把 App Secret 放在服务器上，也可以改成 `RESULT_REPLY_MODE=hub`，由 hub 调飞书 OpenAPI 回复。

第三，`CODEX_SESSION_SCOPE=chat`。它决定“同一个群里连续发两条消息，是不是同一个 Codex session”。

| 配置 | 行为 |
| --- | --- |
| `chat` | 同一个 `chat_id` 复用同一个 Codex session，不同群互相隔离 |
| `none` 或关闭映射 | 每条飞书消息都是一次全新的 `codex exec` |
| `CODEX_EPHEMERAL=true` | 不落 Codex session，也就不能续聊 |

我更推荐 `chat`。因为飞书对话天然是按群或私聊组织的，用户第二句经常是“继续”“按刚才那个方案改”“再补一个测试”。如果每条消息都新开 session，体验会断。

## 6. hub 怎样把消息变成可拉取任务

hub 接到飞书事件以后，不会立刻无脑交给 Codex。它先做几层过滤：

- 只处理 `im.message.receive_v1`。
- 重复的 `event_id` 会被短时间去重。
- 只接受用户消息，不处理机器人自己的消息。
- 只支持 `text` 和 `post`。
- 如果配置了群白名单，只接受白名单里的 `chat_id`。
- 如果配置了用户白名单，只接受白名单里的 `open_id`。
- 群聊里默认必须 @ 机器人。
- 如果配置了 `BOT_COMMAND_PREFIX=/codex`，只有 `/codex ...` 会触发。

在 `local` 模式里，消息会进入内存里的按 chat 队列：

```js
const queueKey = task.chatId || task.senderOpenId; // 优先用飞书 chat_id 作为队列隔离键
const previous = taskQueues.get(queueKey) || Promise.resolve(); // 取出这个群上一条还没跑完的任务
const next = previous.then(() => processMessageTask(config, tokenCache, task)); // 等上一条结束后再执行当前任务
taskQueues.set(queueKey, next); // 把当前任务放回队列，防止同群并发 resume
```

为什么要排队？因为同一个 Codex session 不适合被两条消息同时 resume。排队以后，同一个群里的消息会顺序进入 Codex；不同群之间仍然可以并行。

在 `hub` 模式里，逻辑换成持久化队列：hub 把任务写进 `HUB_QUEUE_FILE`，Mac worker 通过 `/worker/tasks/claim` 领取一条待处理任务。这样即使 Mac 暂时关机，飞书事件也不会直接打到一台离线电脑上，而是先留在公网入口的队列里。

简化后的任务入队逻辑是：

```js
const hubTask = { // 构造一个可以被 worker 领取的任务对象
  id: randomUUID(), // 每条飞书消息对应一个内部 task id
  status: "queued", // 初始状态是 queued，等待 worker claim
  task, // 保存 chat_id、message_id、sender_open_id 和用户文本
  createdAt: new Date().toISOString(), // 记录入队时间，方便排查
}; // hub task 构造结束
```

## 7. `codex exec`：这里真正启动了一个子进程

Mac worker 不是把 Codex 当库调用，而是启动一个本机子进程：

```js
const child = spawn(config.codexBin, args, { // 启动 codex CLI 子进程
  cwd: config.codexWorkdir, // 让子进程在目标仓库目录下运行
  env: process.env, // 继承当前环境变量和本机 Codex 登录态
  stdio: ["pipe", "pipe", "pipe"], // stdin 写 prompt，stdout/stderr 收执行日志
}); // 子进程创建完成，后面等待它退出
```

如果这个飞书 chat 还没有绑定过 session，服务会新开一次：

```bash
codex exec --cd "$CODEX_WORKDIR" --sandbox workspace-write --color never --output-last-message "$OUTPUT_FILE" - # 从 stdin 读取飞书任务并新建非交互 session
```

如果这个 chat 已经有 session，服务会续上一次：

```bash
codex exec resume --output-last-message "$OUTPUT_FILE" "$SESSION_ID" - # 把飞书新消息作为 prompt 续到已有 session
```

这里有一个我实际踩过的坑：`codex exec` 和交互式 `codex resume` 的参数不完全一样。

例如当前本机版本里，`codex resume` 支持：

```bash
codex resume --ask-for-approval never # 交互式 resume 支持 approval policy 参数
```

但 `codex exec` 不支持这个参数。你如果写成下面这样，会直接失败：

```bash
codex exec --ask-for-approval never - # 当前 codex exec 不接受这个参数
```

所以机器人服务里要按 `codex exec --help` 的真实输出组织参数。非交互场景的安全边界主要靠 `--sandbox workspace-write`、白名单、超时和部署隔离来做。

## 8. 同一个飞书群怎样复用同一个 Codex session

worker 第一次跑完 `codex exec` 后，会从 `~/.codex/sessions` 里找到刚刚生成的 session 文件，拿到 session id。然后把映射写进 Mac 本地的 `.sessions.json`。

核心逻辑可以简化成这样：

```js
const key = task.chatId || task.senderOpenId; // 群聊用 chat_id，私聊没有 chat_id 时退回 senderOpenId
store.chats[key] = { sessionId: session.id, updatedAt: new Date().toISOString() }; // 记录这个聊天对应的 Codex session
await writeFile(storePath, JSON.stringify(store, null, 2)); // 写入本地 .sessions.json，下一条消息会读取它
```

第二条消息进来时，服务先查这个映射：

```js
const session = store.chats[key]; // 按当前飞书 chat 找历史 Codex session
const sessionId = session?.sessionId || ""; // 没找到就说明要新建 session
args.push("exec", "resume", "--output-last-message", outputFile, sessionId, "-"); // 找到了就用 codex exec resume 续聊
```

这个设计回答了一个很实用的问题：如果我连续发两条飞书消息，它们是不是同一个 session？

答案是：在 `CODEX_SESSION_SCOPE=chat` 下，同一个飞书群或同一个私聊是同一个 session；不同群、不同私聊不是同一个 session。

这比全局复用一个 session 更安全。因为群 A 里让 Codex 改博客，群 B 里让 Codex 查另一个项目，它们不应该共享上下文。

{% asset_img figure-03.svg %}

## 9. 回复飞书：worker 回复和 hub 回复

worker 跑完 Codex 以后，会拿到最终回复：

```js
const lastMessage = await readMaybe(outputFile); // 优先读取 Codex 写出的最后一条助手消息
const fallback = lastMessage || [stdout, stderr].filter(Boolean).join("\n\n").trim(); // 如果文件为空，就退回 stdout/stderr
await safeReply(config, tokenCache, task.messageId, fallback); // 把结果回复到飞书原消息下面
```

在“阿里云只做公网入口”的版本里，我更倾向让 worker 直接走 `lark-cli` 回复：

```js
args.push("im", "+messages-reply"); // 选择飞书 IM 的回复消息命令
args.push("--as", "bot"); // 明确以机器人身份发送
args.push("--message-id", messageId); // 回复用户刚刚发来的那条消息
args.push("--text", text); // 把 Codex 最终回复作为文本发回飞书
```

这么做的原因很现实：本机 `lark-cli` 已经处理了登录态、身份和凭证存储。worker 只需要调用命令，不需要自己维护 `tenant_access_token`。更重要的是，阿里云 hub 不需要保存 `LARK_APP_SECRET`。

完整链路是：

```text
Mac worker -> codex exec -> 读取 output-last-message -> lark-cli --as bot -> 飞书原消息回复
```

代码里也保留了另一种模式：`RESULT_REPLY_MODE=hub`。这时 worker 只把结果提交回 hub，hub 再用 `LARK_APP_ID + LARK_APP_SECRET` 换 `tenant_access_token`，调用飞书 OpenAPI 回复原消息。它更像传统后端部署，但密钥会集中放在公网服务器上。

两种模式可以这样选：

| 回复模式 | 谁发飞书消息 | 需要放 App Secret 的地方 | 适合场景 |
| --- | --- | --- | --- |
| `worker` | Mac worker 通过 `lark-cli` 发 | 不需要放到 hub | 个人使用、阿里云只做入口 |
| `hub` | 阿里云 hub 通过 OpenAPI 发 | hub `.env` | 团队服务化、服务器统一托管凭证 |

## 10. 启动与验证

本地直连调试仍然可以用两步：先启动 local 服务，再用 Cloudflare Tunnel 暴露 `localhost`。但当前这套长期方案分成 hub 和 worker 两端。

第一步，在阿里云上启动 hub：

```bash
pnpm lark:codex-hub -- --env-file tools/lark-codex-bot/.env.hub # 在公网服务器上启动 hub
```

看到类似输出就说明服务起来了：

```text
lark-codex-bot hub listening on http://localhost:8790
worker claim path: /worker/tasks/claim
```

服务器前面再用 Nginx 或 Caddy 把 HTTPS 转到 hub：

```text
https://你的域名/lark/events -> http://127.0.0.1:8790/lark/events
```

第二步，在 Mac 上启动 worker：

```bash
pnpm lark:codex-worker -- --env-file tools/lark-codex-bot/.env.worker # 在 Mac 上主动拉任务并执行 Codex
```

worker 启动后会持续 poll：

```text
lark-codex-bot worker started: mac-codex-worker
hub: https://你的域名/worker
codex workdir: /Users/bytedance/Code/garden-lab
```

第三步，用健康检查和队列接口确认链路：

```bash
curl https://你的域名/health # 检查 hub 是否正常响应
curl -H "Authorization: Bearer $HUB_WORKER_TOKEN" https://你的域名/worker/tasks # 查看最近任务状态
```

飞书后台保存回调地址成功以后，去群里 @ 机器人发一句：

```text
@Codex 介绍一下这个仓库的目录结构
```

如果 `LARK_SEND_RUNNING_MESSAGE=true`，你会先看到一条排队或处理中提示：

```text
收到，任务已进入 Codex 队列，等待 Mac worker 处理。
```

等 Codex 跑完以后，机器人会再回一条总结。如果启用了 `LARK_INCLUDE_CODEX_SESSION=true`，末尾还会带上：

```text
Codex session: <session-id>
CLI 恢复: codex resume --include-non-interactive <session-id>
```

这个 session id 很有用。它既能帮助你定位本机 `~/.codex/sessions` 里的执行记录，也能让你回到交互式 CLI 继续看上下文。

我最后做了一次端到端验证：在正确的飞书会话里发送一个只要求回复固定文本的测试消息，hub 队列状态从 `queued` 到 `running` 再到 `done`，worker 返回的内容和 Codex session id 都能正常出现在飞书回复里。这一步比只看 `/health` 更有价值，因为它同时验证了飞书事件、hub 队列、worker 拉取、`codex exec`、session 记录和机器人回复。

## 11. 安全边界：别让群聊变成裸奔终端

飞书机器人触发 Codex，本质上是在让聊天消息影响本机仓库和命令执行。这个能力很爽，也必须收紧边界。

我建议至少做这些限制：

| 风险点 | 建议 |
| --- | --- |
| 任意群触发 | 配 `LARK_ALLOWED_CHAT_IDS` |
| 任意用户触发 | 配 `LARK_ALLOWED_USER_OPEN_IDS` |
| 群里误触发 | 保持默认必须 @ 机器人，或加 `BOT_COMMAND_PREFIX=/codex` |
| Codex 写出工作区 | 用 `CODEX_SANDBOX=workspace-write` |
| 任务跑太久 | 配 `CODEX_TIMEOUT_MS` |
| 回复泄露密钥 | 对 token、app secret、Authorization 做 redaction |
| 本机端口暴露公网 | 长期使用改成 Mac worker 主动拉任务，不暴露本机端口 |
| worker API 被滥用 | `/worker/*` 必须校验 `HUB_WORKER_TOKEN` |
| hub 队列文件泄露 | `HUB_QUEUE_FILE` 用 `0600` 权限，目录不要放进静态站点 |
| Mac 关机或休眠 | hub 会继续排队；不想积压时先停 hub 或暂停机器人 |
| 临时隧道域名变化 | 生产换固定域名和稳定部署 |

还有一个实践建议：先把机器人放进一个只有你自己的测试群，确认消息过滤、权限、回复和 Codex 行为都符合预期，再逐步开放给团队。

## 12. 常见问题

### 飞书后台保存 URL 失败

优先检查四件事：

- 公网 URL 是否真的能访问到 hub 服务。
- 回调路径是不是 `/lark/events`。
- `LARK_VERIFICATION_TOKEN` 是否和飞书后台一致。
- 如果开启了 Encrypt Key，本地 `LARK_ENCRYPT_KEY` 是否正确。

hub 或 local 服务日志里如果出现 `invalid verification token`，基本就是 token 不一致。

### 机器人收到消息但不回复

常见原因是：

- 应用版本还没有发布。
- 机器人没有被拉进群。
- 没有消息回复权限。
- `lark-cli` 当前身份没有配置好。
- 白名单没填对，消息被服务过滤了。
- Mac worker 没启动，任务还停在 hub 队列里。
- `RESULT_REPLY_MODE` 和实际凭证不匹配：设成 `worker` 就要保证 worker 机器上的 `lark-cli` 可用，设成 `hub` 就要保证 hub 有 App Secret。

可以先把 `LARK_ALLOWED_CHAT_IDS` 和 `LARK_ALLOWED_USER_OPEN_IDS` 暂时清空，在测试群确认链路通了以后再收紧。

### 我把电脑重启了，机器人还能用吗

分两层看。

如果阿里云 hub 还在，飞书开放平台仍然能把事件投到 `/lark/events`，任务也能进 hub 队列。但 Codex 真正运行在 Mac worker 上，所以 Mac 关机、重启或 worker 没启动时，任务不会被执行。

重启以后，打开 Mac 并重新启动：

```bash
pnpm lark:codex-worker -- --env-file tools/lark-codex-bot/.env.worker # 重启 worker 后继续从 hub 拉任务
```

如果不希望离线期间积压任务，可以先停掉 hub，或在飞书开放平台里临时停用事件订阅。

### 为什么飞书里还是旧名字

飞书开放平台里的名称修改不是保存后立刻对所有客户端生效。先在“凭证与基础信息”的国际化配置里改应用名称，再到“版本管理与发布”创建版本并发布。本文实战里最终发布的是 `1.0.3`，更新说明是“重命名应用为 Codex”。

发布后如果客户端仍显示旧名，通常是飞书客户端缓存，等几分钟或重启客户端即可。

### Codex 运行失败，提示 unexpected argument

先执行：

```bash
codex exec --help # 以本机安装版本为准确认 exec 支持哪些参数
```

不要把交互式 `codex resume` 的参数想当然搬到 `codex exec`。我这次遇到的典型例子就是 `--ask-for-approval`：交互式入口支持，非交互 `exec` 不支持。

### 我能在 Codex App 里看到这段对话吗

不要把它当成 Codex App 普通会话。飞书触发的是 `codex exec` 非交互 session，它会落到本机 Codex session 记录里，但不等于 App 里的一个实时聊天窗口。

你可以用下面命令在 CLI 里恢复查看：

```bash
codex resume --include-non-interactive <session-id> # 把非交互 session 纳入 resume 选择范围
```

### 连续发两条消息是不是同一个 session

取决于配置。本文推荐：

```bash
CODEX_SESSION_SCOPE=chat # 按飞书 chat_id 复用 Codex session
```

这样同一个群里的第二条消息会走 `codex exec resume`，不同群不会串上下文。

## 13. 小结

把 Codex CLI 接进飞书机器人，本质上是把四个已经成熟的边界拼起来：

- 飞书负责消息入口和机器人回复。
- 阿里云 hub 负责稳定公网入口、事件协议、安全过滤和任务队列。
- Mac worker 负责拉任务、启动子进程、维护 session 映射和必要时发送回复。
- Codex CLI 负责真正进入仓库执行任务。

我觉得这个方案最舒服的地方是：它没有强行把所有东西塞进一个产品里。飞书还是团队协作入口，阿里云只是稳定入口和队列，Codex 还是本机 Coding Agent，桥接服务只做翻译和编排。

等你把 `CODEX_SESSION_SCOPE=chat` 打开、把飞书应用名发布成 `Codex` 以后，它就不像一个“每次都忘记上下文的命令机器人”，而更像群聊里多了一个可以被点名的本机工程助手。它不会替代 Codex App，但会把 Codex 的触发入口从“我打开 App 输入任务”扩展成“团队在飞书里顺手派活”。
