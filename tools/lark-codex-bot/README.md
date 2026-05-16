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
CODEX_SANDBOX=workspace-write
CODEX_SESSION_SCOPE=chat
```

启动 worker：

```bash
pnpm lark:codex-worker -- --env-file tools/lark-codex-bot/.env.worker
```

worker 会每 `WORKER_POLL_INTERVAL_MS` 毫秒向 hub 拉一次任务。拿到任务后，它会在 Mac 上执行：

```bash
codex exec --cd "$CODEX_WORKDIR" --sandbox workspace-write --color never --output-last-message "$OUTPUT_FILE" -
```

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

## 6. 安全建议

- `HUB_WORKER_TOKEN` 用长随机值，不要提交到仓库。
- 阿里云只开放 HTTPS 入口，不要裸露未加密 HTTP。
- 配置 `LARK_ALLOWED_CHAT_IDS` 和 `LARK_ALLOWED_USER_OPEN_IDS`。
- 群聊默认要求 @ 机器人；也可以设置 `BOT_COMMAND_PREFIX=/codex`。
- `CODEX_SANDBOX` 保持 `workspace-write`，不要随便改成 `danger-full-access`。
- `HUB_QUEUE_FILE` 和 `.sessions.json` 都属于本地状态文件，不要提交。
- 如果 Mac 关机，hub 会继续收任务；要避免任务堆积，可以先在飞书群里停用机器人或停掉 hub。

## 7. 常见问题

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
