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

首页的「我用了多少 Token」读取 `public/stats/token-usage.json`。这个文件由本机 Codex 会话日志生成，不适合放在 GitHub 托管 runner 上采集，所以仓库提供了一个专门跑在 Mac self-hosted runner 上的工作流：

- 工作流文件：`.github/workflows/token-usage-sync.yml`
- 执行频率：每 2 小时一次，也可以在 GitHub Actions 页面选择 `main` 手动运行
- 读取来源：默认读取 runner 用户的 `~/.codex/sessions` 和 `~/.codex/archived_sessions`
- 写入目标：`public/stats/token-usage.json`
- 调度标签：`self-hosted`、`macOS`、`blog-token-usage`

首次启用时需要在 GitHub 仓库里添加一台 macOS self-hosted runner：

1. 打开仓库 `Settings > Actions > Runners`
2. 选择 `New self-hosted runner`，按页面命令在 Mac 上下载并配置 runner
3. 确认 runner 带有默认标签 `self-hosted`、`macOS`，并额外添加 `blog-token-usage`
4. 用拥有 Codex 日志的同一个 macOS 用户启动 runner

如果 runner 运行用户不是平时使用 Codex 的用户，可以在仓库 `Settings > Secrets and variables > Actions > Variables` 里新增变量：

```text
CODEX_HOME=/Users/你的用户名/.codex
```

工作流会在 token 统计有实际变化时提交 `public/stats/token-usage.json`。因为 GitHub Actions 使用 `GITHUB_TOKEN` 推送的 commit 不会再触发新的 Pages 构建，这个工作流在提交后会继续构建并部署 GitHub Pages，保证线上博客同步更新。

## 朋友 Token 排行榜

排行榜页面：`https://ffffhx.github.io/blog/token-leaderboard/`

朋友不需要 clone 仓库。首次统计时在自己的电脑执行：

```bash
npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz -- token-board-agent
```

这条命令会先引导 GitHub Device Login，授权成功后读取本机 AI 编码工具 token 记录并上传到排行榜后端。之后手动同步一次仍然执行同一条命令；如果想持续自动同步，可以保持下面的命令运行：

```bash
npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz -- token-board-agent watch
```

默认读取本机 `~/.codex/sessions`、`~/.codex/projects`，并兼容 Claude Code、Cursor、Gemini CLI 的部分本地记录。上传内容只包含 token 数、模型、工具、项目 basename 和匿名 session hash，不上传 prompt 文本。

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
