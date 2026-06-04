# 文章 AI 解释与问答服务

博客本身部署在 GitHub Pages，属于静态导出页面，不能把 Kimi API Key 放在浏览器里。选词解释和文章侧边问答都拆成两层：

- 静态博客前端：捕获文章正文中的选中文本，或把文章正文和多轮问题发给后端。
- AI 服务：保管 `KIMI_API_KEY`，调用 Kimi Chat Completions 和 `$web_search`，再把结构化解释或问答结果返回给前端。

## 本地启动

```bash
# 终端 1
KIMI_API_KEY=你的_key pnpm token:server

# 终端 2
NEXT_PUBLIC_TOKEN_BOARD_API_URL=http://127.0.0.1:8787 pnpm dev
```

前端选词解释会优先使用 `NEXT_PUBLIC_SELECTION_EXPLAIN_API_URL`，没有配置时自动退回到 `NEXT_PUBLIC_TOKEN_BOARD_API_URL/api/explain-selection`。

文章侧边问答会优先使用 `NEXT_PUBLIC_ARTICLE_CHAT_API_URL`，没有配置时会尝试从 `NEXT_PUBLIC_SELECTION_EXPLAIN_API_URL` 推导同服务的 `/chat-article`，最后退回到 `NEXT_PUBLIC_TOKEN_BOARD_API_URL/api/chat-article`。

Token Board 后端已经迁移到 `https://github.com/ffffhx/open-token-board`；如果你只想单独启动 AI 服务，也可以在新仓库运行：

```bash
# 终端 1
KIMI_API_KEY=你的_key pnpm selection:server

# 终端 2
NEXT_PUBLIC_SELECTION_EXPLAIN_API_URL=http://127.0.0.1:8791 \
NEXT_PUBLIC_ARTICLE_CHAT_API_URL=http://127.0.0.1:8791 \
pnpm dev
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

如果文章问答和选词解释分开部署，可以额外显式配置：

```bash
NEXT_PUBLIC_ARTICLE_CHAT_API_URL=https://你的-文章问答服务域名
```

如果需要单独部署 `apps/token-board-api/src/selection-explainer-server.ts`，再额外配置；Token Board API 内置的解释接口位于 `open-token-board/apps/token-board-api`：

```bash
SELECTION_EXPLAIN_ALLOWED_ORIGINS=https://你的博客域名
TOKEN_BOARD_AUTH_SECRET=和-token-board-服务一致的密钥
NEXT_PUBLIC_SELECTION_EXPLAIN_API_URL=https://你的解释服务域名
NEXT_PUBLIC_ARTICLE_CHAT_API_URL=https://你的解释服务域名
```

解释和问答接口必须部署在能收到 `token_board_session` cookie 的域名下，通常和 Token Board API 使用同一个主域或同一个反向代理入口。未登录或账号不在白名单时，前端会显示拒绝信息。

如果只想本地自用，不配置公网 AI 服务也可以；页面会显示缺少服务地址。

## 文章问答请求格式

侧边问答面板会向 `/api/chat-article` 或 `/chat-article` 发送：

```json
{
  "slug": "post-slug",
  "title": "文章标题",
  "excerpt": "文章摘要",
  "headings": [{ "depth": 2, "text": "章节标题" }],
  "articleText": "从页面正文提取并截断后的文章文本",
  "focus": { "selection": "选中的词", "context": "选中词所在段落" },
  "messages": [{ "role": "user", "content": "用户问题" }]
}
```

推荐响应：

```json
{
  "answer": "结合文章上下文的回答",
  "sources": [{ "title": "来源标题", "url": "https://example.com" }]
}
```
