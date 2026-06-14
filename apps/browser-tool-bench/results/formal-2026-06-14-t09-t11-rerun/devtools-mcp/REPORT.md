# chrome-devtools-mcp 1.2.0 — T10a / T11 / T09 报告（2026-06-14 rerun）

- 连接：`--browserUrl` 模式。`mcp__chrome-devtools-gh__*`→9223（真实登录态），`mcp__chrome-devtools-ext__*`→9224（Bench Badge 扩展 host）。
- 顺序：T10a → T11 → T09。人工打断：0。全程只读。
- （本报告由主控代为落盘——subagent 自身 Write 被 harness 拦截，内容为 subagent 原文返回。）

## T10a — GitHub 未读通知（9223，-gh） ✅
- **结论**：成功。真实登录态 9223 干净 attach，未撞登录墙。
- **未读数 = 68**（Inbox 徽标 68，分页 `1-25 of 68`）。第一页前 25 条标题已读出（均 `is:unread`，garden-lab / profilepilot / codex-snapshots / open-token-board 的 CI/Build/Deploy 失败通知 + 2 条 codex-snapshots PR）。
- 仅读，无写。轮数 4（list_pages, navigate, snapshot, screenshot）。证据：通知页截图含账号隐私，按惯例不落盘。
- **关键对比点**：playwright-cli attach 同一个 9223 时因枚举到企业扩展 service_worker target 断言崩溃；chrome-devtools-mcp 在同一台企业管控 Chrome 上**干净 attach 成功**，是 4 工具里唯一在 T10a 上拿到完整数据的非-agent-browser/bb 工具。

## T11 — Bench Badge 设置页改文字（9224，-ext） ✅
- **结论**：成功，经设置页 UI 改并保存，靶场页验证。
- **徽标 = `HELLO-2026 · v1.0.0`**（live 仍 1.0.0）。
- **扩展 ID 发现**：复用 SHARED-ENV 的 `jkmndkochpgaleoechlemhdhbikdecnf`，并在 chrome://extensions 用 `chrome.developerPrivate.getExtensionsInfo` 反查确认。
- **设置页是否在 list_pages**：**否**。`new_page(options.html)` 后 list_pages 始终只显示 localhost:4399，扩展页不进 target 列表。绕法：用 `navigate_page` 把当前选中页直接导到 options.html，fill `#badge-text` + click「保存」照常生效。
- 轮数约 8。证据 `evidence/t11-options-saved.png`、`evidence/t11-badge-hello2026.png`。

## T09 — reload 扩展到 1.0.1（9224，-ext） ✅
- **结论**：成功，版本升到 v1.0.1，靶场页验证。
- **徽标 = `HELLO-2026 · v1.0.1`**（T11 文字保留，版本号升）。
- **路径**：**chrome://extensions 页面上下文调扩展 API** —— `chrome.developerPrivate.reload(id)`（非点页面按钮）。`getExtensionsInfo` 验证 version 1.0.0→1.0.1、state=ENABLED。
- **需开发者模式**：是，初始 `devMode:false`。先 `chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true})` 打开，再 reload，规避 Chrome 137+ unsupportedDeveloperExtension 禁用。
- 未改 manifest.json。轮数约 7。证据 `evidence/t09-badge-v101.png`。

## chrome-devtools-mcp 特有限制/坑
1. **扩展页不进 target 列表**：browserUrl 模式下 list_pages 不显示 `chrome-extension://` 页（categoryExtensions 不支持）。但 `navigate_page` 把已有 tab 导到扩展页后 snapshot/fill/click/evaluate 都正常 → 扩展 UI 操作可行，只是无法用 list_pages 寻址。
2. **无专用扩展工具**：没有 reload/管理扩展的 MCP 工具，T09 靠 chrome://extensions 页面上下文 `evaluate_script` 调 `chrome.developerPrivate.*`；好在 CfT 的 chrome://extensions 可达且该 API 可用，比纯 UI 点按钮更稳。
3. **开发者模式默认关**：CfT devMode 初始 false，reload 前必开。
4. **list_pages URL 显示滞后**：navigate 后列表 URL 偶尔不即时刷新，以 snapshot/evaluate 为准。

## 一句话总评
4 工具里扩展场景**最稳**的：扩展 UI 与 reload 都靠"页面内 chrome.developerPrivate API"这条迂回路径打通（而非依赖工具自带扩展能力），且是唯一在企业管控 9223 上干净 attach 成功的官方 attach 工具。三任务全 ✅、零打断。
