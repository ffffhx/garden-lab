# 靶场 T01-T20 共享执行须知（Claude 独立轮 · 2026-06-20）

你是被指派用**一个特定浏览器工具**跑靶场基准 T01-T20 的子代理。上下文干净，只按任务卡和本文件判断，**不要参考任何 Codex 结论或外场 R01-R09 结果**。

## 靶场目标

- 本地靶场服务：`http://localhost:4399`（已在运行）。所有任务都打这个本地站点，**不是真实网站**。
- 靶场测试账号：`agent@bench.dev` / `bench-2026`（需登录的任务用它；这是靶场自带的假账号，跟用户真实身份无关）。
- 任务卡在 `apps/browser-tool-bench/tasks/T01..T20`（T10 拆成 T10a / T10b）。**逐字使用卡里的 Prompt**，按卡里的 Ground Truth 和判定标准给 ✅ / ⚠️ / ❌ / N-R。每张卡还写了「适用工具」和前置准备，先读再做。

## 浏览器接入策略（混合 · 重要）

- **agent-browser / bb-browser / devtools-mcp**：用用户准备的 **CDP 9223** 测试 Chrome（Chrome 149），把它导航到 `localhost:4399` 跑靶场。不要自起新浏览器。
  - agent-browser：先 `agent-browser close --all` 丢掉自管会话再 `--cdp 9223`，验证确在控 9223。
  - devtools-mcp：用 MCP 工具 `mcp__chrome-devtools-gh__*`（已绑 9223），先 list_pages 确认。
  - 9223 已装 content-script-only 扩展 Bench Badge（id `jkmndkochpgaleoechlemhdhbikdecnf`，无 service worker 故不在 /json）——T09/T11 用它。
- **playwright-cli**：按用户约定**用它自管的浏览器**（self-launch / persistentContext），不要 attach 9223（attach 装扩展的 9223 会确定性崩溃）。靶场只连 localhost，自管浏览器完全够用——这也是 playwright-cli 公平参赛的方式。

## 特殊任务处理

- **T09（扩展 reload）**：卡里假设 manifest 版本已改成 1.0.1。当前 `extension-sample/manifest.json` 是 1.0.0。你需要：把 version 改成 1.0.1 → reload 扩展 → 刷新靶场页确认徽标 v1.0.1 →**做完把 version 改回 1.0.0 并 reload**恢复。企业管控 9223 可能拦截解压扩展 reload，遇到就如实记 ❌/N-R 写清根因。playwright-cli 用自管浏览器+CfT `--load-extension` 装扩展。
- **T10a（真实登录态·默认 Profile）**：9223 已登录 GitHub，读 GitHub 通知数即可（类似只读账号状态，禁止写）。playwright-cli 自管浏览器没有该登录态 → 预期 N-R，如实记。
- **T10b（登录态持久化·专用 Profile）**：测**各工具自己的持久化机制**（agent-browser state save/load、playwright-cli state-save/load、devtools 持久 userDataDir、bb-browser 受管 profile）。用独立专用 profile 演示「保存→新会话→免登录恢复」，不是占用 9223。
- **T11（用扩展改徽标）**：打开 `chrome-extension://<id>/options.html` 改 badgeText → 在 `localhost:4399/` 验证 →**做完恢复默认**（清 badgeText，徽标回 `BENCH EXT v1.0.0`）。

## 安全/诚实

- 靶场是本地站点，可正常交互完成任务（登录、点按钮、上传 fixture 等都允许，这是靶场设计）。
- 但**不要改任务以外的状态**；扩展相关改动做完必须恢复默认。
- 跑不通就记 ❌/N-R 并写清卡点，不要美化，不要用别的工具替它跑，不要凭记忆答 Ground Truth（必须页面/Network/trace 证据）。

## 产出

- 证据存到 `results/targetrange-2026-06-20-claude-t01-t20-round1/<你的工具名>/`。
- 报告写到该目录 `REPORT-<chunk>.md`，并按 schema 返回结构化结果（每个任务一条）。
