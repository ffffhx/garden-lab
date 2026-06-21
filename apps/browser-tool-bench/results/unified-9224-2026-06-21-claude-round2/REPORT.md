# 统一成本评测 · 两轮完整对照 · 4 工具 × 30 题 · Opus 4.8

Round 1 (9223, 2026-06-20) vs Round 2 (9224, 2026-06-21，崩溃后续跑)。9224 与 9223 等价(GitHub ffffhx 已登录 + Bench Badge 同 id jkmnd...)。
方法一致:每工具一个独立 workflow(3 chunk)严格顺序;agent-browser/bb-browser/devtools-mcp 连 CDP,playwright-cli 自管浏览器。

## 成本/结果两轮对照

| 工具 | 轮 | 结果(30题) | 耗时 | token | tool_calls | browserOps | escapes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| agent-browser | R1 | 29✅(R06漏报) | 25.8min | 190.6k | 183 | 218 | 24 |
| agent-browser | R2 | **30✅** | 26.4min | 205.0k | 233 | 378 | 6 |
| bb-browser | R1 | 22✅/3⚠️/4❌/1NR | 47.9min | 271.9k | 277 | 244 | 33 |
| bb-browser | R2 | 26✅/1⚠️/2❌/1NR（R09重测✅*）| 41.9min | 233.3k | 252 | 311 | 39 |
| devtools-mcp | R1 | 28✅/1⚠️/1NR | 25.5min | 322.7k | 230 | 169 | 25 |
| devtools-mcp | R2 | **29✅/1NR** | 23.6min | 327.4k | 220 | 161 | 17 |
| playwright-cli | R1 | 24✅/1⚠️/2❌/3NR | 26.4min | 203.7k | 188 | 184 | 38 |
| playwright-cli | R2 | 25✅/2❌/3NR | 24.3min | 209.3k | 188 | 189 | 18 |

## 与能力表对照 — N-R/❌ 对得上吗

- **agent-browser:对得上、稳定。** R1 的 29✅ 是子代理漏报 R06；R2 干净 30✅，与能力表"全绿"一致。耗时/token 两轮稳(25.8→26.4min,190.6→205k)。
- **devtools-mcp:对得上、稳定。** 两轮唯一稳定短板=R08 N-R(运行时无 route/abort/intercept 原语)——与能力表一致。R03 ⚠️→✅(小波动)。token 两轮最高(冗长 MCP 快照/网络体),op 最省。
- **playwright-cli:对得上、稳定。** N-R=T10a/R02/R06(自管浏览器无真实登录态/无 9224 扩展，=能力表"接不进真实登录态"); ❌=R04/R07(**npm 被 Cloudflare/403 拦,网络问题非工具**)。两轮一致。
- **bb-browser:部分对得上、最不稳。** 稳定真实短板:T09❌(无扩展reload)、R08 N-R(无route)、T08⚠️(shadow click bug)。**会跳的格(T04/T11/T13/T17/R06):原生原语失败=❌(符合能力表),子代理用 CDP 逃生硬怼能翻成 ✅\***——两轮在 ❌/⚠️↔✅\* 间跳,全看逃生用多狠。这是 bb 原语弱的本质,不是测错。

## 两个环境噪声源(非工具,影响所有工具外场格)
1. npm(npmjs.com)被 Cloudflare/403 拦(curl 实测 403):playwright-cli 自管浏览器 R04/R07 ❌;但 devtools-mcp/agent-browser 走 9224 已登录 Chrome 能打开(R04/R07 ✅)——同一题不同浏览器会话结果不同。
2. ffffhx.github.io 偶发抽风(一瞬 000 随即 200):bb 的 R09 N-R 即此 flake。**2026-06-21 站点稳定后单独重测 bb-browser R09 = ✅***（--port 9224 attach,trace 65 事件取得完整 timing;最慢资源是第三方 anyip.dev 的 auth/me 挂起请求 ~23s,但不阻塞首屏:responseEnd 102ms/DCL 129ms）——坐实上次 N-R 纯属网络抽风,非 bb 能力短板。

## 可靠 vs 噪声指标
- **可靠(两轮稳定可比)**:实际耗时、token 总量。bb 最慢最贵(~42-48min),devtools token 最高,agent-browser 综合最省。
- **噪声(只看趋势)**:browserOps、escapes 自报值两轮摆动大(如 agent-browser escapes 24↔6),因各子代理"算不算逃生"口径不一。

## 结论
两轮 + 能力表三方一致:能力梯队 **devtools-mcp / agent-browser(第一梯队,稳定全绿,仅 devtools R08 无运行时 route) > playwright-cli(自管稳健,接不进真实登录态、外场受 npm 网络拦) > bb-browser(原语弱,靠 CDP 逃生才勉强,最慢最贵最不稳)**。除 bb-browser 的逃生抖动(其本身特性)外,所有 N-R/❌ 均可追到明确根因(R06漏报artifact / 自管浏览器边界 / npm网络拦 / 站点blip / 无运行时route),与能力表对得上。
