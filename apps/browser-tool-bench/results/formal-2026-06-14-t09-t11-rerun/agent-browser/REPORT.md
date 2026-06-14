# agent-browser — T10a / T11 / T09 实测报告

- 工具：agent-browser 0.27.2（CLI）
- 日期：2026-06-14
- 执行顺序：T10a → T11 → T09
- 约束：全程仅用 agent-browser，未使用任何其它浏览器手段。

---

## T10a — GitHub 未读通知（端口 9223）✅

**结论**：成功。已登录态打开 github.com/notifications，未撞登录墙；**未读通知共 68 条**，分 3 页（25 + 25 + 18），全部标题已列出。

### 关键证据
- 全部为 CI / workflow 失败类通知（账号与具体仓库标题已脱敏，不入公开仓库）。
- 未读总数：**68**（页面过滤 `?query=is:unread`，分页 Next 在第 3 页 disabled，确认到底）。
- 证据：通知页截图含账号隐私，按本仓库惯例不落盘（仅保留数量与能力结论）。

### 标题清单（已脱敏）
按本仓库惯例，GitHub 通知的具体标题/仓库名不入公开仓库。脱敏摘要：共 **68** 条未读，分 3 页（25 + 25 + 18），全部为本人各仓库的 CI / Build Release / Deploy Pages / Sync Token 等 workflow 失败通知 + 2 条 PR review，无业务敏感内容。原始标题已在子 Agent 线程内逐条核验、与未读计数自洽。

### 指标
- 轮数：约 8 次（含 1 次粘滞会话复位）。耗时约 2 分钟。人工打断 0。写操作 0（纯读）。

### 坑
- **粘滞会话**：开始 `--cdp 9223 tab` 显示的是 localhost:4399 残留标签，非 9223 真身。`close --all`+`connect 9223` 后变 about:blank，再 open 才连上。
- `is:unread` 过滤后仍分页，必须跟 `?after=<cursor>` 翻到 Next 失效才能确认总数，否则只报第 1 页 25 条。

---

## T11 — Bench Badge 设置页改徽标文字（端口 9224）✅

**结论**：成功，**全程走扩展设置页 UI**（填输入框 + 点保存），未绕过 UI 直写 storage。徽标确认 `HELLO-2026 · v1.0.0`。

### 关键证据
- **徽标完整内容：`HELLO-2026 · v1.0.0`**（此时 live=1.0.0，符合预期）。
- 扩展 ID：`jkmndkochpgaleoechlemhdhbikdecnf`，name=Bench Badge，version=1.0.0、enabled。
- 截图：`evidence/t11-options-filled.png`、`evidence/t11-badge-hello2026.png`

### 扩展 ID 发现路径
- 先试 CDP `http://localhost:9224/json/list`：**只列 page/browser_ui，扩展 service worker/background 不在内**，拿不到 ID。
- 改走 **chrome://extensions**：Polymer 多层 shadow DOM（extensions-manager → extensions-item-list → extensions-item），`eval` 穿透 shadowRoot 读 `#name`/`#version`/`item.id`，拿到 ID。
- 设置页 URL：`chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`。

### 设置页是否在 tab/target 列表
- **是**。打开后 `--cdp 9224 tab` 出现 `[t1] Bench Badge 设置 - chrome-extension://.../options.html`；snapshot -i 正常拿到 `textbox 徽标文字 (@e2)`、`button 保存 (@e3)`。

### 指标
- 轮数约 7 次。耗时约 2 分钟。人工打断 0。

### 坑
- 又一次粘滞：`--cdp 9224 tab` 起初显示上一任务 9223 的 GitHub 标签；`close --all`+`connect 9224` 后才显示 localhost:4399 的 CfT 标签。
- 扩展 target 不在 `/json/list`，纯 CDP 枚举拿不到 ID，必须借 chrome://extensions UI。

---

## T09 — reload 本地扩展到 1.0.1（端口 9224）✅

**结论**：成功。**走 chrome://extensions 页面 UI 操作**（非扩展管理 API）完成 reload，版本升到 1.0.1，徽标确认 `HELLO-2026 · v1.0.1`。

### 关键证据
- **靶场页徽标：`HELLO-2026 · v1.0.1`**（版本号 v1.0.1 = 成功；HELLO-2026 文字为 T11 留存）。
- chrome://extensions 列表版本 1.0.0 → **1.0.1**。
- 磁盘 manifest 只读核对 `"version": "1.0.1"`（未修改文件）。
- 截图：`evidence/t09-extensions-v1.0.1.png`、`evidence/t09-badge-v1.0.1.png`

### 走的路径：chrome://extensions 页面（非 API）
- 经 shadow DOM 走 UI reload 按钮 `#dev-reload-button`。
- **关键坑**：CfT 的 chrome://extensions **开发者模式默认关**，关时 `extensions-item` 内根本没有 `#dev-reload-button`。第一次「点 reload」点了个不存在/无效元素，版本仍 1.0.0、靶场页一度 NO BADGE。
- 修复：先穿透 `extensions-toolbar` shadowRoot 把 `#devMode` 开关 `click()` 打开 → devMode ON → `#dev-reload-button` 出现 → 再 `click()` → 版本刷新为 1.0.1 → 重 open 靶场页，徽标 v1.0.1。

### 指标
- 轮数约 9 次（含 1 次失败 reload + 排查 + 开 devMode + 真 reload + 验证）。耗时约 3 分钟。人工打断 0。

### 坑（汇总）
1. 开发者模式默认关 → reload 按钮不存在，必须先程序化开 devMode，否则会误判「已 reload」（按钮点了个寂寞，版本没变）。
2. reload 后立刻刷新靶场页偶发 NO BADGE（content script 重注入时序窗口），等 1～1.5s 再读即稳。
3. chrome://extensions 全程 shadow DOM，snapshot/click 对 shadow 内元素不直接可达，靠 `eval` 穿透。

---

## 跨任务总结
- 三任务全部 ✅。T10a 未读 68 条（3 页）标题全列；T11 经设置页 UI 改成 `HELLO-2026 · v1.0.0`；T09 经 chrome://extensions UI reload 到 `HELLO-2026 · v1.0.1`。
- 共性坑：①agent-browser 粘滞会话每次切端口都要 `close --all`+`connect` 复位；②扩展相关全靠 chrome://extensions shadow DOM + `eval` 穿透，扩展 target 不在 `/json/list`；③CfT 开发者模式默认关，reload 前必须先打开。
- 全程 0 人工打断，GitHub 0 写操作，未修改 manifest 文件。
