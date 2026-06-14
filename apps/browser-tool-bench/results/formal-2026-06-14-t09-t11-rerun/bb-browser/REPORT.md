# bb-browser 被测报告（T10a / T11 / T09）

工具：bb-browser 0.14.2 · 日期：2026-06-14 · 顺序：T10a(9223) → T11(9224) → T09(9224) · 人工打断：0
（注：本报告由主控代为落盘——subagent 自身 Write 到本路径被 harness 拦截，内容为 subagent 原文返回。）

## T10a — GitHub 未读通知（9223）✅
- 连接确认：`tab list` 看到 `github.com/notifications`，登录态正常，无登录墙。
- **未读总数 = 68**（Inbox 计数器；仓库拆分 garden-lab 56 + codex-snapshots 7 + profilepilot 4 + open-token-board 1 = 68，自洽）。未读视图每页渲染 25 条（需翻页看全 68）。
- 当前页 25 条标题已逐条读出（多为各仓库 workflow 失败通知 + 2 条 PR review；具体标题/仓库名已脱敏，不入公开仓库）。
- 纯只读，无任何写操作。证据：通知页截图含账号隐私，按惯例不落盘。轮数约 6，耗时约 1 分钟。

## T11 — 改徽标文字 HELLO-2026（9224）⚠️
- **徽标硬指标达成**：靶场页 `#bench-ext-badge` = **`HELLO-2026 · v1.0.0`**（live 仍 1.0.0，符合预期），右下角截图清晰。设置页 UI 全程用 bb-browser 完成（`snap`→`fill @1 "HELLO-2026"`→`click @2 保存`，页面回显「已保存…」）。
- **判 ⚠️ 的原因**：bb-browser 自己**打不开** `chrome-extension://.../options.html`（见坑1），设置页是借 **CDP HTTP `curl /json/new`** 强行创建 target 后，bb-browser 才能 `snap/fill/click` 它。属借外力绕过 bb-browser 的导航限制。
- 扩展 ID 发现路径：bb-browser **无内建手段**（`tab list`/`status` 都不列扩展 target），ID `jkmndkochpgaleoechlemhdhbikdecnf` 取自 SHARED-ENV，后经设置页 `chrome.runtime.id` eval 确认。设置页强开后会出现在 `tab list`（标题「Bench Badge 设置」）。
- 证据：`evidence/t11-options-saved.png`、`evidence/t11-bench-badge-hello.png`。轮数约 9，耗时约 2 分钟。

## T09 — reload 扩展使徽标显 v1.0.1（9224）❌
- **未能验证到 v1.0.1**。reload 标准入口 chrome://extensions bb-browser 完全到不了（坑1）；改用扩展自身 `chrome.runtime.reload()`（在 T11 设置页 tab 上 eval）后，**扩展进入失效态**：反复刷新靶场页（含全新 tab、累计等待 30s+）`#bench-ext-badge` 始终 NOT FOUND，徽标整体消失。
- 只读 CDP 诊断确认列表里**没有任何扩展 service_worker/background_page target**，SW 未运行，`chrome.runtime.reload()` 把 unpacked 扩展弄坏而非干净重载到 1.0.1。
- 走的路径：既非 chrome://extensions 页面、也非浏览器级 `chrome.management` API（页面上下文没有），只能用扩展自身 `chrome.runtime.reload()`，且失败。
- reload 前确认：设置页 eval `getManifest().version` = 1.0.0（前置正确）。证据：`evidence/t09-badge-missing-after-reload.png`（右下角无徽标）。轮数约 12，耗时约 4 分钟。

## bb-browser 关键限制/坑
1. **致命：到不了 chrome:// 和 chrome-extension://**。`open`/`goto` 无条件加 `https://` 前缀并把 `://` 折叠成 `//`，如 `chrome://extensions/` → `https://chrome//extensions/` → chrome-error。直接断了 T11 开设置页、T09 点 reload 两条标准路径（连「开发者模式」那个已知坑都够不到）。
2. **不列扩展 target**：无发现扩展 ID / 定位设置页的内建能力。
3. **`get text/value` 不收 CSS 选择器**，必须先 `snap` 拿 `@ref`；读任意元素只能靠 `eval`（`eval` 是绕开多数限制的关键）。
4. 两处被迫用非 bb-browser 手段（均因上述限制）：T11 用 curl CDP 强开设置页；T09 的 `chrome.runtime.reload()` 是 bb-browser eval 内可达的唯一 reload 路径但实测把扩展搞坏。

## 主控备注
- subagent 跑完时 9224 上 Bench Badge 已被 `chrome.runtime.reload()` 弄成失效态（SW 未运行、徽标不注入）。主控已在下一个工具前用全新 CfT profile 重启复位。
