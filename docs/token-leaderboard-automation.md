# Token 排行榜全自动版

这个版本把页面、后端和本地 agent 拆开：

- 静态博客页面：`/token-leaderboard`
- 后端服务：`POST /api/usage/ingest` 接收上报，`GET /api/usage/stats` 返回聚合榜单
- 本地 agent：定时扫描本机 Codex / Claude Code / Cursor / Trae / Gemini CLI 以及自定义 usage 文件，只上传 token 统计字段

当前阿里云后端地址：

```text
https://8-218-149-148.anyip.dev/token-board
```

## 1. GitHub 登录配置

先在 GitHub 创建一个 OAuth App，并开启 Device Flow：

- Homepage URL: `https://8-218-149-148.anyip.dev/token-board`
- Authorization callback URL: `https://8-218-149-148.anyip.dev/token-board/api/auth/github/callback`
- Device Flow: enabled

GitHub 官方说明：<https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps>

## 2. 启动后端

最小环境变量：

```bash
TOKEN_BOARD_HOST=0.0.0.0 \
TOKEN_BOARD_PORT=8787 \
TOKEN_BOARD_PUBLIC_URL=https://your-board.example.com \
TOKEN_BOARD_ALLOWED_ORIGINS=https://your-site.example.com \
TOKEN_BOARD_ALLOWED_RETURN_ORIGINS=https://your-site.example.com \
TOKEN_BOARD_AUTH_SECRET=replace-with-a-long-random-secret \
GITHUB_CLIENT_ID=<your-github-client-id> \
GITHUB_CLIENT_SECRET=<your-client-secret> \
TOKEN_BOARD_DATA_FILE=.token-board/usage-events.json \
pnpm token:server
```

可选：只允许指定 GitHub 用户加入：

```bash
TOKEN_BOARD_ALLOWED_GITHUB_LOGINS=feng,friend-a,friend-b
```

后端接口：

```text
GET  /api/auth/github/start
GET  /api/auth/github/callback
GET  /api/auth/me
GET  /api/auth/logout
POST /api/auth/device/start
POST /api/auth/device/poll
POST /api/usage/ingest
POST /api/usage/replace
GET  /api/usage/summary
GET  /api/usage/stats
```

如果 `/api/usage/summary` 只需要聚合作者本人数据，给服务端加：

```bash
TOKEN_BOARD_SUMMARY_USER_ID=github:<your-github-id>
```

不配置时 `/api/usage/summary` 会按全部上报记录聚合。

### 兼容旧上传 token

如果还想保留旧模式，可以继续配置 `.token-board/users.json`：

```json
{
  "users": [
    {
      "userId": "feng",
      "displayName": "Feng",
      "team": "Friends",
      "uploadTokenHash": "sha256:replace-with-the-hash"
    }
  ]
}
```

然后启动时加：

```bash
TOKEN_BOARD_USERS_FILE=.token-board/users.json pnpm token:server
```

新用户推荐直接用 GitHub 登录，不再手工分配上传 token。

## 3. 让页面读取后端

因为当前博客是 `output: "export"` 静态导出，后端不是 Next API Route，而是独立服务。构建或启动页面时配置：

```bash
NEXT_PUBLIC_TOKEN_BOARD_API_URL=http://127.0.0.1:8787 pnpm dev
```

部署时把 `NEXT_PUBLIC_TOKEN_BOARD_API_URL` 换成公网后端地址。排行榜页面会读取：

```text
GET /api/usage/stats?range=7D&metric=tokens
```

其中 `metric=tokens` 的主口径是总消耗 Token：`inputTokens + outputTokens`。`cachedInputTokens` 是输入上下文里的缓存命中子集，只作为副指标和费用拆分使用；推理 token 在个人视图作为副指标展开。如果上报记录没有输入/输出明细，才使用 `totalTokens` / `total_tokens` 作为 fallback。

首页 Token 用量卡片会优先读取：

```text
GET /api/usage/summary
```

如果后端不可用，页面会自动回退到本地/示例数据。

网页端会显示 GitHub 登录按钮；登录后服务端用 HttpOnly cookie 识别用户。

博客里的桌宠、桌宠档案和游戏入口属于私有预览功能，会复用同一个 GitHub 登录态。默认只给 `ffffhx` 可见；如果要换成别的作者账号，在构建博客时配置：

```bash
NEXT_PUBLIC_PRIVATE_FEATURE_GITHUB_LOGINS=your-github-login
```

后端仍建议同步收紧 GitHub allowlist，例如：

```bash
TOKEN_BOARD_ALLOWED_GITHUB_LOGINS=your-github-login
```

## 4. 配置每个人电脑上的 agent

在每台电脑上创建本地配置：

```bash
pnpm token:agent init
```

编辑 `~/.token-board-agent.json`，填入服务端地址：

```json
{
  "apiUrl": "https://your-token-board.example.com",
  "intervalMs": 300000,
  "includeDefaultSources": true,
  "usagePaths": [],
  "privacy": {
    "projectMode": "basename",
    "includeModel": true,
    "includeSource": true,
    "hashSessionId": true,
    "maxEventAgeDays": 120
  }
}
```

第一次登录 GitHub：

```bash
pnpm token:agent login
```

CLI 会显示 GitHub device code，让用户去 `https://github.com/login/device` 授权。授权成功后，agent 会把服务端签发的 `agentToken` 保存到 `~/.token-board-agent.json`。

默认采集源包含 Codex、Claude Code、Cursor、Trae。Codex 会读取 `~/.codex/sessions`、`~/.codex/archived_sessions` 和 `~/.codex/projects`；普通工具日志默认单文件上限是 5 MiB，Codex JSONL 会话日志默认上限是 256 MiB，可用 `TOKEN_BOARD_MAX_CODEX_FILE_BYTES` 调整。

手动上传一次：

```bash
pnpm token:agent upload
```

如果需要清掉当前登录用户的线上旧记录，并用本机当前可采集记录整体替换：

```bash
npx --yes --package https://ffffhx.github.io/garden-lab/token-board-agent.tgz?v=0.4.6 -- token-board-agent replace
```

长期运行：

```bash
pnpm token:agent watch
```

## 5. 自定义数据源

如果某个工具没有被默认路径覆盖，可以把 JSON / JSONL / CSV 路径加入 `usagePaths`，或用环境变量：

```bash
TOKEN_BOARD_USAGE_PATHS="$HOME/path/to/usage.jsonl,$HOME/path/to/export.csv" pnpm token:agent upload
```

CSV 字段兼容：

```text
user,displayName,team,tool,model,project,timestamp,inputTokens,cachedInputTokens,outputTokens,reasoningOutputTokens,totalTokens,messages,sessionId
```

JSON / JSONL 支持常见字段名，比如 `input_tokens`、`output_tokens`、`total_tokens`、`cache_read_input_tokens`。排行榜会优先按 `input_tokens + output_tokens` 计算总消耗；`cached_input_tokens` 作为输入上下文里的缓存命中子集展示，`total_tokens` 主要用于缺少明细的兼容数据。

## 6. 隐私边界

agent 和服务端都会做过滤：

- 不上传 prompt、正文、消息内容、transcript。
- 用户身份由服务端 GitHub session / agent session 决定，客户端传入的 user 字段不会被信任。
- `sessionId` 默认 hash 后上传。
- `projectMode` 默认只保留路径 basename；也可以设为 `hash` 或 `none`。
- 服务端只存聚合所需字段：时间、工具、模型、项目名、token 数、会话 hash、估算费用。

## 7. 部署建议

后端可以放在一台小 VPS、Render、Fly.io、Railway 或公司/朋友自己的机器上。至少配置：

```bash
TOKEN_BOARD_HOST=0.0.0.0
TOKEN_BOARD_PORT=8787
TOKEN_BOARD_PUBLIC_URL=https://your-board.example.com
TOKEN_BOARD_ALLOWED_ORIGINS=https://your-site.example.com
TOKEN_BOARD_ALLOWED_RETURN_ORIGINS=https://your-site.example.com
TOKEN_BOARD_AUTH_SECRET=replace-with-long-random-secret
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-client-secret>
TOKEN_BOARD_DATA_FILE=/data/usage-events.json
```

仓库内置 Docker Compose 部署包在 `deploy/token-board`。它的 build context 指向仓库根目录，这样镜像只复制后端需要的 `apps/site/lib/`、`apps/site/scripts/token-board-server.ts` 和部署包自己的 `package.json`：

```bash
cd deploy/token-board
cp .env.example .env
docker compose up -d --build
```
