# T10a · 真实登录态（默认 Profile）：读取 GitHub 通知数

- **测试维度**：**系统默认 Profile** 的复用与授权成本（对应文章第 5 节；边界公式里"安全策略"因子的正面战场）
- **适用工具**：@chrome / @browser（主角，扩展安全域零弹窗）、agent-browser、Chrome DevTools MCP（auto-connect 流程）；playwright-cli 预期 ❌（只能 attach 自家浏览器，接不到默认 Profile）
- **前置条件**：本机**日常使用的那个 Chrome**（默认 user-data-dir）已登录 GitHub。不新建任何 profile——测的就是"Agent 借用你正在用的浏览器身份"这件事本身

## 与 T10b 的分工

本卡测**默认 Profile**：最严格的安全边界场景，核心指标是授权打断次数。
T10b 测**专用 Profile**：绕开安全边界、换成持久化成本的场景。两卡合起来覆盖"真实登录态"的两条路线。

## 浏览器安全边界背景（判读结果时需要）

- Chrome 136+：对默认 user-data-dir 直接开 `--remote-debugging-port` 已被禁止（必须配非默认 `--user-data-dir` 才生效）——CDP 工具的传统连法对默认 Profile 失效。
- Chrome 144+：官方留的口子是 auto-connect——用户先在 `chrome://inspect/#remote-debugging` 启用，之后**每个调试会话都需人工确认一次**。
- 扩展（@chrome/@browser）天然运行在默认 Profile 内，不经过上述任何流程。

## Prompt（逐字使用）

> 用我已经登录的浏览器打开 github.com/notifications ，告诉我现在有几条未读通知，并把每条的标题列出来。

## Ground Truth

- 以执行当时人工打开该页面看到的未读数和标题为准（执行前人工记录一次）。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 未读数和标题与人工核对一致，且未要求重新登录 |
| ⚠️ 部分 | 拿到数据但需要多次授权/人工配合，或只拿到部分信息 |
| ❌ 失败 | 撞登录墙、无法接入默认 Profile、或工具根本没有此入口 |

## 记录指标

**人工打断次数是本卡核心指标**，按动作计数：remote debugging 的 Allow 确认、chrome://inspect 的预先启用、Chrome 重启要求、扩展授权点击，各算一次。另记轮数 / 时间。

## 预期差异点

- @chrome / @browser：零打断（扩展安全域）；注意能力止于页面可见域，但本任务只读页面，正好在其舒适区——**这是它们在整个评测集里唯一的主场任务**。
- agent-browser / DevTools MCP：必须走 144+ auto-connect，预期每会话至少 1 次人工确认；记录完整流程的真实打断数。
- playwright-cli：无任何接入默认 Profile 的机制，预期 ❌——这格结果与 T10b 对照后即是"两条路线"的完整画像。

## 安全提醒

只读任务。不要让 Agent 在真实账号上做任何写操作（标记已读、回复、关注等）；测试结束确认 remote debugging 已关闭。
