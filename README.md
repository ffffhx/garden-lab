# Garden Lab

这是一个基于 `Next.js + React + TypeScript + Tailwind CSS` 的个人数字花园与实验室，部署目标是 `GitHub Pages`。

内容目前按几个模块组织：

- 技术：源码解析、工程实践、工具使用和问题排查
- 健身：训练记录、动作笔记、饮食复盘和阶段总结
- 每日新闻：AI、前端与工程圈每天值得关注的热点速览

内容和页面保存在站点应用包里的 Markdown 文件中：

- 技术/健身文章与每日新闻：`apps/site/source/_posts/YYYY/MM/DD/*.md`
- 关于页：`apps/site/source/about/index.md`

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

仓库按 `pnpm-workspace.yaml` 管理几个边界清晰的 workspace 包：

- 根目录：monorepo 编排、CI、文档和统一命令代理
- `apps/site`：Next.js 静态站点、Tauri 桌宠、内容编译、页面和站点内领域逻辑
- `deploy/token-board`：Token 排行榜后端的 Docker 部署包
- `tools/token-board-agent-npx`：给朋友安装的轻量 npx agent
- `tools/codex-pet-aloha-cash-buddy`：Codex pet 安装包

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

`pnpm build` 会准备公开资源、构建农场小游戏、同步文章图片和桌宠公开快照；它不会读取本机 Codex 日志。需要显式刷新本机 token 静态快照时再运行：

```bash
pnpm build:with-local-tokens
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

这次重构保留了现有 Markdown 内容和本地内容资源文件夹结构。

新站点会在内容编译阶段兼容这些能力：

- front matter：`title`、`date`、`categories`、`tags`、`excerpt`
- 标准 Markdown：标题、列表、引用、代码块、表格、链接、图片
- Hexo 风格的 `{% asset_img ... %}` 内容资源图片标签

内容图片会在开发和构建前自动同步到 `apps/site/public/post-assets/`，不需要手动复制。手动刷新公开静态资源可以运行：

```bash
pnpm prepare:public
```

## Token 使用量静态快照

首页不再展示个人 Token 消耗。仓库仍保留 `apps/site/public/stats/token-usage.json` 和 `.github/workflows/token-usage-sync.yml`，用于手动生成本地静态快照或调试 token-board 数据。这个工作流不再定时运行；需要刷新静态快照时，可以在 GitHub Actions 页面手动触发。

旧兜底工作流会读取 self-hosted runner 用户的本机 Codex 日志：

首次启用时需要在 GitHub 仓库里添加一台 macOS self-hosted runner：

1. 打开仓库 `Settings > Actions > Runners`
2. 选择 `New self-hosted runner`，按页面命令在 Mac 上下载并配置 runner
3. 确认 runner 带有默认标签 `self-hosted`、`macOS`，并额外添加 `garden-lab-token-usage`
4. 用拥有 Codex 日志的同一个 macOS 用户启动 runner

如果 runner 运行用户不是平时使用 Codex 的用户，可以在仓库 `Settings > Secrets and variables > Actions > Variables` 里新增变量：

```text
CODEX_HOME=/Users/你的用户名/.codex
```

## 朋友 Token 排行榜

排行榜页面：`https://ffffhx.github.io/garden-lab/token-leaderboard/`

朋友不需要 clone 仓库。首次安装后台同步时，在自己的 macOS 终端或 Windows PowerShell 里执行：

```bash
npx --yes --package https://ffffhx.github.io/garden-lab/token-board-agent.tgz?v=0.4.7 -- token-board-agent install
```

这条命令会先引导 GitHub Device Login，授权成功后在 macOS 上安装 LaunchAgent，在 Windows 上安装 Task Scheduler 任务。之后终端关闭也会每 5 分钟读取本机 AI 编码工具 token 记录并上传到排行榜后端。

查看后台同步状态：

```bash
npx --yes --package https://ffffhx.github.io/garden-lab/token-board-agent.tgz?v=0.4.7 -- token-board-agent status
```

如果后端数据被清空或迁移，且页面只显示最近少量记录，可以强制重传最近 30 天可采集到的记录：

```bash
npx --yes --package https://ffffhx.github.io/garden-lab/token-board-agent.tgz?v=0.4.7 -- token-board-agent resync
```

如果需要把自己线上的旧记录清掉，并用本机当前能采集到的记录整体替换：

```bash
npx --yes --package https://ffffhx.github.io/garden-lab/token-board-agent.tgz?v=0.4.7 -- token-board-agent replace
```

卸载后台同步：

```bash
npx --yes --package https://ffffhx.github.io/garden-lab/token-board-agent.tgz?v=0.4.7 -- token-board-agent uninstall
```

轻量 npx agent 默认读取本机 Codex、Claude Code、Cursor、Trae 的本地 token 记录；Codex 会覆盖 `~/.codex/sessions`、`~/.codex/archived_sessions` 和 `~/.codex/projects`，并允许 Codex JSONL 会话日志最大到 256 MiB。也可以通过 `TOKEN_BOARD_USAGE_PATHS` 或配置文件里的 `usagePaths` 补充自定义 JSON / JSONL / CSV 路径。上传内容只包含 token 数、模型、工具、项目 basename 和匿名 session hash，不上传 prompt 文本。

排行榜的总消耗 Token 口径为输入上下文加输出：`inputTokens + outputTokens`；`cachedInputTokens` 是输入上下文里的缓存命中子集，只作为副指标和费用拆分使用。推理 token 只在个人视图作为副指标展开，缺少明细的历史记录才使用 `totalTokens` 兜底。

### Token Board 后端存储

Token Board 后端优先使用 PostgreSQL。部署配置在 `deploy/token-board/compose.yaml`，会启动一个 `postgres:17-alpine` 容器，并把数据保存在 Compose volume `postgres-data` 里。

旧 JSON 文件仍保留为本地开发 fallback 和迁移来源。没有配置 `TOKEN_BOARD_DATABASE_URL` 时，服务会继续读写 `TOKEN_BOARD_DATA_FILE`；生产部署建议使用 `.env.example` 里的 PostgreSQL 变量。

从旧 JSON 导入 PostgreSQL：

```bash
cd deploy/token-board
docker compose run --rm token-board npm run docker:start -- migrate-json
```

本地开发也可以直接跑：

```bash
TOKEN_BOARD_DATABASE_URL=postgresql://token_board:password@127.0.0.1:5432/token_board pnpm token:migrate-json
```

导入使用事件 `id` 主键去重，可以重复执行。确认数据库已有历史数据后，再让朋友们执行一次 `token-board-agent resync` 补齐本机还能采集到的最近记录。

## 部署到 GitHub Pages

仓库已经包含 GitHub Pages 的 Actions 工作流：

- 工作流文件：`.github/workflows/pages.yml`
- 构建输出：`apps/site/out/`
- 发布方式：推送到 `main` 后由 GitHub Actions 自动构建并部署

首次启用时需要在 GitHub 仓库里做一次设置：

1. 打开仓库 `Settings > Pages`
2. 在 `Build and deployment` 中把 `Source` 设为 `GitHub Actions`
3. 推送一次 `main` 分支，等待 `Deploy To GitHub Pages` 工作流完成

如果当前仓库保持 `ffffhx/garden-lab` 这个项目仓库形式，默认访问地址会是：

```text
https://ffffhx.github.io/garden-lab/
```

如果后续绑定了自定义域名，GitHub Pages 会给工作流注入新的站点基路径，当前配置不需要再手动改代码。
