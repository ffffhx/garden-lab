# Lark Codex Bot

把飞书/Lark 机器人消息转成 `codex exec` 任务，并把 Codex 的最终回复回到飞书消息下。

这个包支持三种运行模式：

| 模式 | 链路 | 适合场景 |
| --- | --- | --- |
| `local` | 飞书 -> 本机服务 -> 本机 Codex -> 飞书 | 本机快速调试、Cloudflare Tunnel/ngrok |
| `hub` | 飞书 -> 阿里云/公网服务 -> 任务队列 -> 飞书回复 | 公网固定入口、长期运行 |
| `worker` | Mac 主动 poll hub -> 本机 Codex -> submit result | Codex 仍跑在你的 Mac，不暴露本机端口 |

长期推荐的架构是：

```text
飞书开放平台
  -> 阿里云 ECS 上的 hub
  -> 本地队列
  <- Mac worker 主动拉任务
  -> Mac 上 codex exec
  <- Mac worker 提交结果
  -> hub 调飞书 OpenAPI 回复原消息
```

这样飞书后台只需要配置一个稳定的阿里云 HTTPS 地址，你的 Mac 不需要公网 IP，也不需要 Cloudflare Tunnel。Mac 关机时任务会先留在 hub 队列里；Mac 开机并启动 worker 后继续拉任务。

## 1. 飞书应用配置

在飞书开放平台创建企业自建应用，然后：

1. 开启「机器人」能力。
2. 在「事件与回调」里选择「将事件发送至开发者服务器」。
3. 订阅 `im.message.receive_v1`（接收消息 v2.0）。
4. 在「加密策略」里复制 `Verification Token`；生产建议启用并复制 `Encrypt Key`。
5. 给应用开通消息权限，至少需要接收消息事件和以机器人身份回复消息。
6. 修改权限或事件订阅后，创建版本并发布。

如果使用阿里云 hub，飞书后台 callback URL 填：

```text
https://你的域名/lark/events
```

如果两个飞书应用都订阅同一个 hub 回调地址，可以把多个 Verification Token 逗号分隔写入 hub 的 `LARK_VERIFICATION_TOKENS`。只让 Bot A 接收用户消息时，保留单个 `LARK_VERIFICATION_TOKEN` 即可；Bot B 只需要 App ID / App Secret 和回复消息权限。

## 2. 本地直连模式

本机调试可以继续用 `local`：

```bash
cp tools/lark-codex-bot/.env.example tools/lark-codex-bot/.env
```

编辑 `.env`：

```bash
LARK_CODEX_MODE=local
LARK_APP_ID=cli_xxx
LARK_VERIFICATION_TOKEN=xxx
LARK_ENCRYPT_KEY=xxx
LARK_REPLY_MODE=cli
CODEX_WORKDIR=/Users/bytedance/Code/garden-lab
CODEX_ADD_DIRS=/Users/bytedance/Code
LARK_ALLOWED_CHAT_IDS=oc_xxx
LARK_ALLOWED_USER_OPEN_IDS=ou_xxx
```

启动：

```bash
pnpm lark:codex-bot -- --env-file tools/lark-codex-bot/.env
```

健康检查：

```bash
curl http://localhost:8787/health
```

本地直连模式如果要给飞书访问，仍然需要 Cloudflare Tunnel、ngrok 或内网网关把 `localhost:8787` 暴露成 HTTPS。

## 3. 阿里云 hub 模式

在阿里云 ECS 上部署这个仓库或只部署 `tools/lark-codex-bot` 所需文件，然后准备 hub 配置：

```bash
cp tools/lark-codex-bot/.env.hub.example tools/lark-codex-bot/.env.hub
```

关键配置：

```bash
LARK_CODEX_MODE=hub
PORT=8787
LARK_EVENT_PATH=/lark/events

LARK_APP_ID=cli_xxx
LARK_APP_SECRET=xxx
LARK_VERIFICATION_TOKEN=xxx
LARK_ENCRYPT_KEY=xxx
LARK_REPLY_MODE=openapi

HUB_WORKER_TOKEN=一段足够长的随机字符串
HUB_QUEUE_FILE=/var/lib/lark-codex-bot/queue.json

LARK_ALLOWED_CHAT_IDS=oc_xxx
LARK_ALLOWED_USER_OPEN_IDS=ou_xxx
```

启动 hub：

```bash
pnpm lark:codex-hub -- --env-file tools/lark-codex-bot/.env.hub
```

如果用 `deploy/lark-codex-bot/compose.yaml` 部署，确认 `.env` 里的
`LARK_CODEX_HUB_UID` / `LARK_CODEX_HUB_GID` 与服务器上拥有 `data/` 目录的用户一致：

```bash
id -u
id -g
```

否则 hub 可能能收到事件但无法写入 `/data/queue.json`。

hub 暴露这些接口：

| 路径 | 谁调用 | 作用 |
| --- | --- | --- |
| `POST /lark/events` | 飞书开放平台 | 接收消息事件和 URL 校验 |
| `GET /health` | 你或监控 | 查看 hub 状态 |
| `POST /worker/tasks/claim` | Mac worker | 拉取一条待执行任务 |
| `POST /worker/tasks/:id/result` | Mac worker | 提交 Codex 执行结果 |
| `GET /worker/tasks` | 你或 worker | 查看最近任务摘要 |

`/worker/*` 接口必须带鉴权：

```http
Authorization: Bearer <HUB_WORKER_TOKEN>
```

如果开启双机器人中转，worker 在 claim 时会额外提交自己的逻辑机器人 ID：

```json
{
  "workerId": "my-mac",
  "botId": "my_codex"
}
```

hub 只会把 `targetBotId=my_codex` 的任务发给它；这样你和你女朋友的两个 worker 可以共用同一个公网 hub。

阿里云前面建议配 Nginx/Caddy 做 HTTPS，转发到本机 hub 端口：

```text
https://你的域名/lark/events -> http://127.0.0.1:8787/lark/events
```

## 4. Mac worker 模式

Mac 上准备 worker 配置：

```bash
cp tools/lark-codex-bot/.env.worker.example tools/lark-codex-bot/.env.worker
```

关键配置：

```bash
LARK_CODEX_MODE=worker
HUB_BASE_URL=https://你的域名
HUB_WORKER_TOKEN=和 hub 一样的随机字符串
WORKER_ID=mac-codex-worker

CODEX_WORKDIR=/Users/bytedance/Code/garden-lab
CODEX_ADD_DIRS=/Users/bytedance/Code
CODEX_SANDBOX=workspace-write
CODEX_SESSION_SCOPE=chat
LARK_CHAT_MESSAGES_READ_LIMIT=20
```

`CODEX_WORKDIR` 是 Codex 默认启动目录；`CODEX_ADD_DIRS` 会额外传给 `codex exec --add-dir`。如果希望机器人能修改你 Mac 上所有代码仓库，推荐把所有 repo 放在同一个父目录下，例如 `/Users/bytedance/Code`，然后把这个父目录配置到 `CODEX_ADD_DIRS`。这样仍然保留 `workspace-write` 沙箱，只把指定代码目录加入可写范围。

启动 worker：

```bash
pnpm lark:codex-worker -- --env-file tools/lark-codex-bot/.env.worker
```

worker 会每 `WORKER_POLL_INTERVAL_MS` 毫秒向 hub 拉一次任务。拿到任务后，它会在 Mac 上执行：

```bash
codex exec --cd "$CODEX_WORKDIR" --sandbox workspace-write --color never --output-last-message "$OUTPUT_FILE" -
```

如果设置了 `CODEX_ADD_DIRS=/Users/bytedance/Code`，新会话会额外带上：

```bash
--add-dir /Users/bytedance/Code
```

当用户在飞书里说“读取本群消息”“查询群中最近的 DDL”“找出最近的 deadline/截止时间”这类请求时，worker 会先在 Codex 沙箱外用 Bot 身份执行：

```bash
lark-cli im +chat-messages-list --as bot --chat-id "$CHAT_ID" --page-size "$LARK_CHAT_MESSAGES_READ_LIMIT" --format json
```

如果只是读取消息，会直接返回最近消息列表；如果请求里包含 DDL、截止、总结、提取等分析意图，会把读取到的消息作为上下文交给 Codex 分析。这样避免 Codex 子进程在沙箱里直接访问 `lark-cli` keychain。

同一个飞书 `chat_id` 会复用本机 Codex session：

```bash
codex exec resume --output-last-message "$OUTPUT_FILE" "$SESSION_ID" -
```

映射默认写在：

```text
tools/lark-codex-bot/.sessions.json
```

## 5. 消息回复链路

在 hub/worker 架构里，Codex 不直接给飞书发消息：

```text
Mac worker -> codex exec -> output-last-message
Mac worker -> POST result 到 hub
hub -> 飞书 OpenAPI /im/v1/messages/:message_id/reply
飞书群 -> 收到机器人回复
```

这样飞书凭证集中放在阿里云 hub，Mac worker 只需要知道 hub 地址和 worker token。

如果要让两个机器人都用自己的飞书机器人身份在群里展示回复，把两边 worker 都设成：

```bash
RESULT_REPLY_MODE=worker
LARK_REPLY_MODE=cli
```

这时每台 Mac 用本机 `lark-cli --as bot` 回复同一条飞书消息；hub 只负责排队和转发结果。

## 6. 双机器人中转

飞书通常不会把“机器人 A 发出的 @ 消息”再作为用户消息事件推给机器人 B，所以双机器人交流不能依赖互相 @ 触发。这里实现的是：

```text
你的 Codex worker
  -> POST result 到 hub
  -> hub 生成 targetBotId=girlfriend_codex 的 relay 任务
  <- 女朋友 worker 轮询 claim
  -> 女朋友 Codex worker 生成回复
  -> hub 生成 targetBotId=my_codex 的 relay 任务
  <- 你的 worker 再 claim
```

### hub 配置

阿里云 hub 开启 relay，并给这个飞书入口对应的机器人设置逻辑 ID：

```bash
RELAY_ENABLED=true
RELAY_BOT_ID=my_codex
RELAY_MAX_TURNS=6
RELAY_TRIGGER_PREFIX=/relay
```

当前实现推荐先用一个 hub 作为入口：你在飞书里 @ 你的机器人启动对话，两个 worker 通过同一个 hub 队列来回接力。不要直接让两个 hub 进程共享同一个 JSON `HUB_QUEUE_FILE`；如果以后要支持双方都从各自飞书应用启动，需要把多 callback path 收进同一进程，或换成带锁的外部队列。

### 你的 worker 配置

```bash
RESULT_REPLY_MODE=worker
LARK_REPLY_MODE=cli

RELAY_ENABLED=true
RELAY_BOT_ID=my_codex
RELAY_PEER_BOT_ID=girlfriend_codex
RELAY_TRIGGER_PREFIX=/relay
RELAY_AUTO_START_HUMAN_TASKS=false
RELAY_MAX_TURNS=6
RELAY_VISIBLE_MENTION=@女朋友的Codex
```

### 女朋友 worker 配置

她那边把两个 ID 对调：

```bash
RESULT_REPLY_MODE=worker
LARK_REPLY_MODE=cli

RELAY_ENABLED=true
RELAY_BOT_ID=girlfriend_codex
RELAY_PEER_BOT_ID=my_codex
RELAY_TRIGGER_PREFIX=/relay
RELAY_AUTO_START_HUMAN_TASKS=false
RELAY_MAX_TURNS=6
RELAY_VISIBLE_MENTION=@你的Codex
```

### 在飞书里启动一轮对话

在允许的群里 @ 你的机器人：

```text
@Codex /relay 你先和另一个机器人讨论一下：这个周末我们去哪玩？
```

流程会是：

1. 你的机器人先处理用户请求，并在飞书里回复一条可见消息。
2. worker 把这条 Codex 输出作为 relay 任务投给 `girlfriend_codex`。
3. 女朋友 worker 拉到任务后运行她自己的 Codex，并用她的机器人身份回复。
4. hub 再把她的输出投回 `my_codex`。
5. 到达 `RELAY_MAX_TURNS` 后自动停止，避免无限互聊。

`RELAY_VISIBLE_MENTION` 只是让群里看起来像互相 @；真正触发仍然靠 hub 队列。

## 7. 双机器人讨论并最终汇总

如果你想自己配置两个飞书机器人，让它们围绕一个方案先讨论、最后给用户一个综合答案，可以用两个 worker 配置：

```bash
cp tools/lark-codex-bot/.env.worker.bot-a.example tools/lark-codex-bot/.env.worker.bot-a
cp tools/lark-codex-bot/.env.worker.bot-b.example tools/lark-codex-bot/.env.worker.bot-b
```

如果已经有可用的 `.env.worker`，里面包含 `HUB_BASE_URL` 和 `HUB_WORKER_TOKEN`，也可以用脚本生成两份真实 worker 配置。脚本不会打印 secret，生成的 `.env.worker.bot-a` / `.env.worker.bot-b` 已在 `.gitignore` 中：

```bash
BOT_A_APP_ID=cli_xxx BOT_A_APP_SECRET=xxx \
BOT_B_APP_ID=cli_yyy BOT_B_APP_SECRET=yyy \
pnpm lark:codex-setup-two-workers
```

如果只是先生成占位文件：

```bash
pnpm lark:codex-setup-two-workers -- --allow-placeholder
```

生成后先跑体检：

```bash
pnpm lark:codex-check-two-workers
```

如果要连真实 hub 和飞书开放平台一起验证：

```bash
pnpm lark:codex-check-two-workers -- --online-hub --online-feishu
```

体检命令不会打印 `HUB_WORKER_TOKEN` 或 `LARK_APP_SECRET`。`LARK_REPLY_MODE=openapi` 时，占位 App ID/Secret 会明确失败；`LARK_REPLY_MODE=cli` 时，worker 会复用本机 `lark-cli --as bot` 的应用配置，App ID/Secret 不参与本地回复校验。加上 `--online-feishu` 后，脚本还会防止两个 worker 同时复用同一个全局 `lark-cli` 应用，因为那不算两个可见的飞书机器人。

拿到两个真实飞书应用的 App ID / App Secret 后，推荐用下面的命令切换到两个真实机器人身份。这个命令会先校验两个 app 的 tenant token，再写入 `.env.worker.bot-a` / `.env.worker.bot-b`，最后重启两个 macOS LaunchAgent：

```bash
read -r BOT_A_APP_ID
read -rs BOT_A_APP_SECRET; echo
read -r BOT_B_APP_ID
read -rs BOT_B_APP_SECRET; echo

export BOT_A_APP_ID BOT_A_APP_SECRET BOT_B_APP_ID BOT_B_APP_SECRET
pnpm lark:codex-apply-two-bots -- --restart-launchd
unset BOT_A_APP_ID BOT_A_APP_SECRET BOT_B_APP_ID BOT_B_APP_SECRET
```

如果当前 `lark-cli` 已经配置好的旧 Codex 飞书应用就是 Bot A，只需要再提供 Bot B 的凭据。这个混合模式会用 `lark-cli doctor` 校验 Bot A，用 Bot B 的 App ID / App Secret 校验 tenant token：

```bash
read -r BOT_B_APP_ID
read -rs BOT_B_APP_SECRET; echo

export BOT_B_APP_ID BOT_B_APP_SECRET
pnpm lark:codex-apply-two-bots -- --bot-a-from-lark-cli --restart-launchd
unset BOT_B_APP_ID BOT_B_APP_SECRET
```

也可以让 Bot B 使用独立的 `lark-cli` 配置目录，这样 Bot B 的 App Secret 继续由 `lark-cli` 和 Keychain 管理，不写入 worker env。先在隔离目录里完成新应用配置：

```bash
pnpm lark:codex-init-bot-b
```

完成网页里的应用创建/配置后，应用到两个 worker：

```bash
pnpm lark:codex-apply-two-bots -- \
  --bot-a-from-lark-cli \
  --bot-b-from-lark-cli-dir tools/lark-codex-bot/.lark-cli.bot-b \
  --restart-launchd

pnpm lark:codex-check-two-workers -- --online-hub --online-feishu
```

如果只想预览会更新哪些文件：

```bash
pnpm lark:codex-apply-two-bots -- --dry-run
```

推荐角色分工：

| 机器人 | 逻辑 ID | 角色 | Codex 上下文 |
| --- | --- | --- | --- |
| Bot A | `codex_bot_a` | 方案提出者、最终汇总者 | `tools/lark-codex-bot/.sessions.bot-a.json` |
| Bot B | `codex_bot_b` | 反方审查者、风险挑战者 | `tools/lark-codex-bot/.sessions.bot-b.json` |

两个配置都要开启：

```bash
RELAY_ENABLED=true
RELAY_TRIGGER_PREFIX=/debate
RELAY_NATURAL_TRIGGER_ENABLED=true
RELAY_FINAL_ENABLED=true
RELAY_FINAL_BOT_ID=codex_bot_a
RELAY_REPLY_INTERMEDIATE=true
RELAY_MAX_TURNS=4
```

`RELAY_NATURAL_TRIGGER_ENABLED=true` 表示用户不必写 `/debate`；命中“讨论、辩论、评审方案、两个机器人聊聊”等自然语言时也会启动 A/B 讨论。`/debate` 仍然保留，适合手动强制触发。

`RELAY_REPLY_INTERMEDIATE=true` 表示中间讨论会逐条发到飞书；如果只想看最终综合答案，改成 `false`。

如果最终回复由 hub 发送，也要在 hub 的 `.env.hub` 里设置同样的 `RELAY_REPLY_INTERMEDIATE` 和 `RELAY_NATURAL_TRIGGER_ENABLED`，否则 hub 和 worker 的触发/展示行为会不一致。

如果飞书里要显示两个真实机器人身份，两个 worker 分别填自己的飞书应用凭证：

```bash
RESULT_REPLY_MODE=worker
LARK_REPLY_MODE=openapi
LARK_APP_ID=cli_bot_a_or_b
LARK_APP_SECRET=对应机器人的 app secret
```

两个飞书应用都需要加入同一个群，并具备回复消息的权限。如果只是本地测试，也可以两个 worker 共用一个飞书机器人身份；这时飞书显示会是同一个机器人，但内部 Codex session 仍然按 `RELAY_BOT_ID` 隔离。

启动两个 worker：

```bash
pnpm lark:codex-worker:a
pnpm lark:codex-worker:b
```

在飞书里启动讨论：

```text
@Codex-A /debate 讨论一下：这个功能应该用长轮询还是 WebSocket？
@Codex-A 讨论一下：这个功能应该用长轮询还是 WebSocket？
```

执行链路：

```text
用户问题 -> Bot A 首轮方案 -> Bot B 审查 -> Bot A 修正 -> Bot B 再审查
  -> hub 创建 relay_final 任务 -> Bot A 综合双方观点 -> 飞书最终答案
```

上下文隔离由两层保证：

- worker claim 时携带不同 `RELAY_BOT_ID`，hub 只发对应目标机器人的任务。
- 两个 worker 使用不同 `CODEX_SESSION_STORE`，session key 也会包含 `targetBotId`。

如果还想做更硬的隔离，可以给两个 worker 配不同的 `CODEX_HOME`，但要分别处理 Codex 登录和配置。

### 新开上下文

在飞书群里可以直接发：

```text
@Codex-A 新开上下文
@Codex-A 重置上下文
```

hub 会把 `reset_context` 任务派发给 Bot A 和 Bot B，两个 worker 会各自清理当前群对应的 `CODEX_SESSION_STORE` 映射。它不会删除 `.codex/sessions` 历史文件，只是不再 resume 旧 session；下一条消息会重新创建 Codex 会话。

## 8. 安全建议

- `HUB_WORKER_TOKEN` 用长随机值，不要提交到仓库。
- 阿里云只开放 HTTPS 入口，不要裸露未加密 HTTP。
- 配置 `LARK_ALLOWED_CHAT_IDS` 和 `LARK_ALLOWED_USER_OPEN_IDS`。
- 群聊默认要求 @ 机器人；也可以设置 `BOT_COMMAND_PREFIX=/codex`。
- 双机器人中转时固定 `RELAY_MAX_TURNS`，不要开启无限转发。
- 如果不想所有任务都触发对方机器人，保持 `RELAY_AUTO_START_HUMAN_TASKS=false`，只用 `RELAY_TRIGGER_PREFIX`（例如 `/debate`）或 `RELAY_NATURAL_TRIGGER_ENABLED` 的自然语言规则启动。
- `CODEX_SANDBOX` 保持 `workspace-write`，需要跨仓库写入时优先用 `CODEX_ADD_DIRS` 精确加入父目录，不要随便改成 `danger-full-access`。
- `HUB_QUEUE_FILE` 和 `.sessions.json` 都属于本地状态文件，不要提交。
- 如果 Mac 关机，hub 会继续收任务；要避免任务堆积，可以先在飞书群里停用机器人或停掉 hub。

## 9. 常见问题

### 飞书保存 callback URL 失败

- 确认公网域名能访问 hub。
- 确认 Nginx/Caddy 已把 `/lark/events` 转发到 hub。
- 确认 `LARK_VERIFICATION_TOKEN` 与飞书后台一致。
- 如果启用了 Encrypt Key，确认 `LARK_ENCRYPT_KEY` 正确。

### worker 拉不到任务

- 确认 Mac 能访问 `HUB_BASE_URL`。
- 确认 hub 和 worker 的 `HUB_WORKER_TOKEN` 完全一致。
- 用下面命令看 hub 队列：

```bash
curl -H "Authorization: Bearer $HUB_WORKER_TOKEN" \
  https://你的域名/worker/tasks
```

### Codex 运行失败，提示 unexpected argument

以本机安装的 Codex CLI 为准：

```bash
codex exec --help
```

当前服务没有给 `codex exec` 传 `--ask-for-approval`，因为这个参数属于交互式入口，不是所有 `exec` 版本都支持。

### 连续发两条消息是不是同一个 session

默认是同一个飞书 `chat_id` 复用一个 Codex session：

```bash
CODEX_SESSION_SCOPE=chat
```

不同群、不同私聊会各自隔离。
