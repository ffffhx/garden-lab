# 统一成本评测须知（Claude 独立轮 · 2026-06-20 · Opus 4.8）

你是被指派用**一个特定浏览器工具**跑一批任务的子代理。这一轮的目的**除了判定结果，更要量化过程成本**——所以请正常、直接地完成任务，别故意多绕路，也别偷懒跳步。

## 任务范围

这一轮把**靶场 T01-T20（21 张卡，含 T10a/T10b）**和**真实网站外场 R01-R09（9 题）**合在一起跑。你这次只负责其中一个 chunk（见你的提示词）。

- 靶场任务卡：`apps/browser-tool-bench/tasks/T01..T20`（本地 `http://localhost:4399`，账号 `agent@bench.dev` / `bench-2026`）。
- 外场任务卡：`apps/browser-tool-bench/tasks-real/R01..R09`（真实网站，按卡里"答案生成规则 + 当次证据"判定）。
- **逐字使用卡里的 Prompt**，按各卡判定标准给 ✅ / ⚠️ / ❌ / N-R。

## 浏览器接入

- **agent-browser / bb-browser / devtools-mcp**：连用户的 **CDP 9223** 测试 Chrome（已登录 GitHub `ffffhx`、已装 content-script-only 扩展 Bench Badge `jkmndkochpgaleoechlemhdhbikdecnf`，无 SW 不在 /json）。靶场把它导航到 localhost:4399；外场打真实网站。不要自起新浏览器。
- **playwright-cli**：用它**自管的浏览器**（不 attach 9223，attach 装扩展的 9223 必崩）。靶场连 localhost:4399 没问题；外场 R01-R09 里需要真实登录态/扩展的几题（R02/R06 等）自管浏览器没有 → 如实记 N-R。

## 特殊任务

- T09：改 `extension-sample/manifest.json` 版本到 1.0.1 → reload → 验证徽标 v1.0.1 → **改回 1.0.0 并 reload 恢复**。企业 9223 可能拦 reload，遇到如实记。
- T10a：读 9223 的 GitHub 通知数（只读，禁写）。playwright-cli 自管→N-R。
- T10b：测本工具自己的持久化机制（专用 profile，演示保存→新会话→免登录）。
- T11：扩展 options 改徽标 → localhost 验证 → **恢复默认 BENCH EXT v1.0.0**。
- R06：扩展 options 改 `REAL-SITE-2026` → 真实页验证 → **恢复默认**。
- 扩展相关改动做完必须恢复，避免污染后面工具的同题。

## 成本计量（重要——这是本轮重点）

完成本 chunk 后，按 schema **如实自报**两个数：
- `browserOps`：本 chunk 里你**真正操作浏览器的次数**（CLI 子命令调用数 / MCP 浏览器工具调用数 / playwright-cli 子命令数；不含纯思考、读任务卡、写报告这种）。
- `escapes`：**eval 自救 / CDP 逃生 / 临时页面脚本**的次数（被迫弃用工具正规原语、改用 eval/底层 CDP/initScript 才推进的次数）。逃生的那个任务也要在该任务的 `escape=true` 上标。

请客观计数，别为了好看少报逃生——逃生次数正是本轮要对比的核心指标之一。

## 铁律

- 本地靶场可正常交互（登录/点按钮/上传 fixture）；真实网站**只读**，禁止改账号/网站状态（唯一允许是扩展本地 storage，做完恢复）。
- 不准凭记忆答 Ground Truth，必须页面/Network/trace 证据。
- 跑不通记 ❌/N-R 写清卡点，别美化，别用别的工具替跑。
- 证据存到 `results/unified-2026-06-20-claude-4tools/<你的工具名>/`。
