# 个人博客

这是一个基于 `Next.js + React + TypeScript + Tailwind CSS` 的个人博客，部署目标是 `GitHub Pages`。

内容仍然按两个大模块组织：

- 技术：源码解析、工程实践、工具使用和问题排查
- 健身：训练记录、动作笔记、饮食复盘和阶段总结
- 每日新闻：AI、前端与工程圈每天值得关注的热点速览

文章和页面内容继续保存在仓库里的 Markdown 文件中：

- 文章：`source/_posts/YYYY/MM/DD/*.md`
- 关于页：`source/about/index.md`

## 本地开发

推荐使用 `pnpm`。

```bash
pnpm install
pnpm dev
```

默认开发地址：

```text
http://localhost:3000
```

## 常用命令

启动开发环境：

```bash
pnpm dev
```

运行测试：

```bash
pnpm test
```

构建生产版本：

```bash
pnpm build
```

启动生产服务：

```bash
pnpm start
```

新建技术文章：

```bash
pnpm new:post -- "我的第一篇文章"
```

也可以显式指定模块：

```bash
pnpm new:tech -- "我的第一篇技术文章"
pnpm new:fitness -- "一周训练复盘"
pnpm new:daily-news -- "2026-04-24 AI 与前端热点速览"
```

## 内容兼容说明

这次重构保留了现有 Markdown 内容和本地文章资源文件夹结构。

新站点会在内容编译阶段兼容这些能力：

- front matter：`title`、`date`、`categories`、`tags`、`excerpt`
- 标准 Markdown：标题、列表、引用、代码块、表格、链接、图片
- Hexo 风格的 `{% asset_img ... %}` 文章资源图片标签

文章图片会在开发和构建前自动同步到 `public/post-assets/`，不需要手动复制。

## Token 使用量同步

首页的「我用了多少 Token」优先读取 token-board 后端：

```text
GET /api/usage/summary
```

页面构建时通过 `NEXT_PUBLIC_TOKEN_BOARD_API_URL` 注入后端地址。后端可以用 `TOKEN_BOARD_SUMMARY_USER_ID` 指定首页展示哪个用户；也可以在构建博客时用 `NEXT_PUBLIC_TOKEN_USAGE_USER_ID` 显式传给前端。这个 userId 通常是 GitHub Device Login 生成的 `github:<id>`。

如果后端不可用，页面会回退读取 `public/stats/token-usage.json`，所以仓库仍保留 `.github/workflows/token-usage-sync.yml` 作为手动兜底工作流。这个工作流不再定时运行；需要刷新静态快照时，可以在 GitHub Actions 页面手动触发。

旧兜底工作流会读取 self-hosted runner 用户的本机 Codex 日志：

首次启用时需要在 GitHub 仓库里添加一台 macOS self-hosted runner：

1. 打开仓库 `Settings > Actions > Runners`
2. 选择 `New self-hosted runner`，按页面命令在 Mac 上下载并配置 runner
3. 确认 runner 带有默认标签 `self-hosted`、`macOS`，并额外添加 `blog-token-usage`
4. 用拥有 Codex 日志的同一个 macOS 用户启动 runner

如果 runner 运行用户不是平时使用 Codex 的用户，可以在仓库 `Settings > Secrets and variables > Actions > Variables` 里新增变量：

```text
CODEX_HOME=/Users/你的用户名/.codex
```

## 朋友 Token 排行榜

排行榜页面：`https://ffffhx.github.io/blog/token-leaderboard/`

朋友不需要 clone 仓库。首次安装后台同步时在自己的 Mac 上执行：

```bash
npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz?v=0.4.0 -- token-board-agent install
```

这条命令会先引导 GitHub Device Login，授权成功后安装一个 macOS LaunchAgent。之后终端关闭也会每 5 分钟读取本机 AI 编码工具 token 记录并上传到排行榜后端。

查看后台同步状态：

```bash
npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz?v=0.4.0 -- token-board-agent status
```

卸载后台同步：

```bash
npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz?v=0.4.0 -- token-board-agent uninstall
```

轻量 npx agent 默认读取本机 Codex、Claude Code、Cursor、Trae 的本地 token 记录；也可以通过 `TOKEN_BOARD_USAGE_PATHS` 或配置文件里的 `usagePaths` 补充自定义 JSON / JSONL / CSV 路径。上传内容只包含 token 数、模型、工具、项目 basename 和匿名 session hash，不上传 prompt 文本。

## 部署到 GitHub Pages

仓库已经包含 GitHub Pages 的 Actions 工作流：

- 工作流文件：`.github/workflows/pages.yml`
- 构建输出：`out/`
- 发布方式：推送到 `main` 后由 GitHub Actions 自动构建并部署

首次启用时需要在 GitHub 仓库里做一次设置：

1. 打开仓库 `Settings > Pages`
2. 在 `Build and deployment` 中把 `Source` 设为 `GitHub Actions`
3. 推送一次 `main` 分支，等待 `Deploy To GitHub Pages` 工作流完成

如果当前仓库保持 `ffffhx/blog` 这个项目仓库形式，默认访问地址会是：

```text
https://ffffhx.github.io/blog/
```

如果后续绑定了自定义域名，GitHub Pages 会给工作流注入新的站点基路径，当前配置不需要再手动改代码。
