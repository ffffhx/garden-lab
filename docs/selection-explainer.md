# 选词 AI 解释服务

博客本身部署在 GitHub Pages，属于静态导出页面，不能把 Kimi API Key 放在浏览器里。选词解释功能因此拆成两层：

- 静态博客前端：捕获文章正文中的选中文本，并请求解释服务。
- 解释服务：保管 `KIMI_API_KEY`，调用 Kimi Chat Completions 和 `$web_search`，再把结构化解释返回给前端。

## 本地启动

```bash
# 终端 1
KIMI_API_KEY=你的_key pnpm token:server

# 终端 2
NEXT_PUBLIC_TOKEN_BOARD_API_URL=http://127.0.0.1:8787 pnpm dev
```

前端会优先使用 `NEXT_PUBLIC_SELECTION_EXPLAIN_API_URL`，没有配置时自动退回到 `NEXT_PUBLIC_TOKEN_BOARD_API_URL/api/explain-selection`。如果你只想单独启动解释服务，也可以运行：

```bash
# 终端 1
KIMI_API_KEY=你的_key pnpm selection:server

# 终端 2
NEXT_PUBLIC_SELECTION_EXPLAIN_API_URL=http://127.0.0.1:8791 pnpm dev
```

如果你使用 Moonshot 官方文档里的环境变量名，也可以配置 `MOONSHOT_API_KEY`。

默认模型是 `kimi-k2.5`。如果你想切换模型，可以配置 `KIMI_MODEL`。

## 账号白名单

解释服务会读取 Token Board 的 `token_board_session` HttpOnly cookie，并用同一个签名密钥校验 GitHub 登录态。默认只允许作者账号 `ffffhx` 使用。

如果要显式配置：

```bash
SELECTION_EXPLAIN_ALLOWED_GITHUB_LOGINS=ffffhx
TOKEN_BOARD_AUTH_SECRET=和-token-board-服务一致的密钥
```

也可以用 `SELECTION_EXPLAIN_AUTH_SECRET` 单独覆盖解释服务使用的签名密钥。

## 部署配置

推荐把解释接口挂在现有 Token Board 服务上。后端配置：

```bash
KIMI_API_KEY=你的_key
SELECTION_EXPLAIN_ALLOWED_GITHUB_LOGINS=ffffhx
```

静态博客只需要已有的 Token Board 地址：

```bash
NEXT_PUBLIC_TOKEN_BOARD_API_URL=https://你的-token-board-服务域名
```

如果需要单独部署 `apps/site/scripts/selection-explainer-server.ts`，再额外配置：

```bash
SELECTION_EXPLAIN_ALLOWED_ORIGINS=https://你的博客域名
TOKEN_BOARD_AUTH_SECRET=和-token-board-服务一致的密钥
NEXT_PUBLIC_SELECTION_EXPLAIN_API_URL=https://你的解释服务域名
```

解释接口必须部署在能收到 `token_board_session` cookie 的域名下，通常和 Token Board API 使用同一个主域或同一个反向代理入口。未登录或账号不在白名单时，tooltip 会显示拒绝信息。

如果只想本地自用，不配置公网解释服务也可以；页面会显示缺少解释服务地址。
