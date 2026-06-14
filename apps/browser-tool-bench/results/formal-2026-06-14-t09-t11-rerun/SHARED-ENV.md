# 共享环境与协议（2026-06-14 rerun，Claude Code 主控）

所有被测工具 subagent 必读。本轮重跑 T09 / T10a / T11（T10b 另行处理）。

## 被测工具版本（已核对）
- agent-browser 0.27.2
- bb-browser 0.14.2
- chrome-devtools-mcp 1.2.0
- playwright-cli 0.1.14

## 两个浏览器，分工明确
| 端口 | 浏览器 | 用途 | 说明 |
| --- | --- | --- | --- |
| **9223** | 系统默认 Chrome 149（**字节企业管控**） | **仅 T10a**（真实 GitHub 登录态） | 已登录 GitHub；但企业策略**运行时拦截非白名单解压扩展**（ERR_BLOCKED_BY_CLIENT），**不能用于 T09/T11** |
| **9224** | Chrome for Testing 149（我启动的干净实例，无企业策略） | **T09 / T11**（扩展场景） | 已用 `--disable-features=DisableLoadExtensionCommandLineSwitch --load-extension` 正确加载 Bench Badge，content script 已激活、徽标可注入 |

## 关键环境事实（已实测验证）
- 靶场首页：`http://localhost:4399/`（bench server 在 IPv6 `*:4399`；上午的 IPv4 双监听已清理，localhost/127.0.0.1 均命中 bench）。
- Bench Badge 扩展 ID（9224 上，路径派生）：**`jkmndkochpgaleoechlemhdhbikdecnf`**
  - 设置页：`chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`，输入框 `#badge-text`，保存按钮文本「保存」。
  - 页面徽标元素：`#bench-ext-badge`，append 在 `document.documentElement` 上。
  - 默认徽标：`BENCH EXT v<版本>`；设置过文字后：`<文字> · v<版本>`。
- 9224 的 `chrome://extensions` 可达（CfT 非管控），Bench Badge 以开发者模式加载，列表里有「重新加载/reload」按钮。

## ⚠️ agent-browser 专门提醒
- agent-browser 有粘滞会话：可能被它**自起的托管 headless 浏览器**劫持，导致 `--cdp 9224` 实际没连上 CfT。
- **每个任务开始前先 `agent-browser --cdp 9224 tab` 确认看到的是 `localhost:4399` 的标签**；若看到 `about:blank` / `file://` / 无关标签 → 执行 `agent-browser close --all` 再 `agent-browser connect 9224`，重新确认。
- T10a 用 `--cdp 9223`；T09/T11 用 `--cdp 9224`。

## 扩展状态由主控（我）管理，subagent 不要改 manifest 文件
- 启动你的 subagent 前，我已把 `extension-sample/manifest.json` 的 version 改为 **1.0.1**，但 **9224 上 live 扩展仍是 1.0.0**（未 reload）。这是 T09 的标准前置。
- 你的任务顺序请按：**T10a → T11 → T09**（T09 必须最后，因为它会把 live 版本 reload 到 1.0.1）。
- 跑完你会退出；我负责把徽标文字清空、live 版本 reload 回 1.0.0、给下一个工具复位。

## 三个任务（prompt 逐字使用，自行发现工具用法）

### T10a（端口 9223）
> 用我已经登录的浏览器打开 github.com/notifications ，告诉我现在有几条未读通知，并把每条的标题列出来。
- 判定：未读数+标题与页面实际一致、未撞登录墙=✅。记录轮数/时间/打断。

### T11（端口 9224，在 T09 之前跑）
> 当前浏览器里装了一个叫 Bench Badge 的扩展。请打开它的设置页，把徽标文字改成 HELLO-2026 并保存，然后打开 http://localhost:4399/ ，确认页面右下角的徽标文字已经变成 HELLO-2026，把你看到的徽标完整内容告诉我。
- 判定：经设置页 UI 改成功且靶场页徽标含 `HELLO-2026`（此时 live=1.0.0，应显示 `HELLO-2026 · v1.0.0`）=✅；绕过 UI 直接写 storage=⚠️；到不了扩展页=❌。
- 额外记录：扩展 ID 的发现路径（chrome://extensions / 扩展API / 枚举 CDP target）、设置页是否出现在工具的 tab/target 列表里。

### T09（端口 9224，最后跑）
> 我刚把 apps/browser-tool-bench/extension-sample 的 manifest.json 版本号改成了 1.0.1。请帮我 reload 这个本地扩展，然后刷新 http://localhost:4399/ 页面，确认右下角徽标已经显示 v1.0.1。
- 判定：完成 reload 且靶场页徽标版本变为 `v1.0.1`=✅（注意：若 T11 已设过文字，徽标会是 `HELLO-2026 · v1.0.1`，只要版本号是 v1.0.1 即算成功）；reload 成功但没验证/要求用户手点=⚠️；触达不了扩展管理=❌。
- 额外记录：走的是 chrome://extensions 页面操作还是扩展管理 API。

## 产出要求
- 写到你自己的目录：`results/formal-2026-06-14-t09-t11-rerun/<tool>/REPORT.md`
- 截图/快照证据放 `results/formal-2026-06-14-t09-t11-rerun/<tool>/evidence/`（用绝对路径保存）。
- REPORT.md 含：每任务 ✅/⚠️/❌ + 结论一句话、轮数、时间、打断次数、关键证据路径、遇到的坑。
- 只读任务，禁止在真实 GitHub 账号上做任何写操作（标已读/回复/关注等）。
