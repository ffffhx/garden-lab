# Round 2 (9224) 进度 + 与 Round 1(9223)/能力表三方对照 — 2026-06-21

崩溃后在 9224(与旧 9223 等价:GitHub ffffhx 已登录 + Bench Badge jkmnd... 同 id)续跑。
3 个 CLI/自管工具已完成；devtools-mcp 待 chrome-devtools MCP(→9224)接入后补跑。

## Round 2 已完成数据(3 工具)

| 工具 | 浏览器 | 结果(30题) | 耗时 | token | tool_calls | browserOps | escapes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| agent-browser | 9224 | 30✅ | 26.4min | 205.0k | 233 | 378 | 6 |
| bb-browser | 9224 | 25✅ /1⚠️ /2❌ /2N-R | 41.9min | 233.3k | 252 | 311 | 39 |
| playwright-cli | 自管 | 25✅ /2❌ /3N-R | 24.3min | 209.3k | 188 | 189 | 18 |
| devtools-mcp | (9224) | 待补跑(MCP 断) | - | - | - | - | - |

bb-browser R2 非✅: T08⚠️, T09❌(无扩展reload), R06❌(扩展URL bug+站点blip), R08 N-R(无route), R09 重测✅*(站点稳定后,纯网络抽风非bb短板)
playwright-cli R2 非✅: T10a/R02/R06 N-R(自管无真实登录态/扩展), R04/R07 ❌(npm被Cloudflare/403拦)

## Round 1(9223)数据(对照)

| 工具 | 结果 | 耗时 | token | calls | ops | esc |
| --- | --- | --- | --- | --- | --- | --- |
| agent-browser | 29✅(R06漏报) | 25.8min | 190.6k | 183 | 218 | 24 |
| bb-browser | 22✅/3⚠️/4❌/1NR | 47.9min | 271.9k | 277 | 244 | 33 |
| devtools-mcp | 28✅/1⚠️/1NR(R08) | 25.5min | 322.7k | 230 | 169 | 25 |
| playwright-cli | 24✅/1⚠️/2❌/3NR | 26.4min | 203.7k | 188 | 184 | 38 |

## 三方对照结论(R1 vs R2 vs 能力表)

- **agent-browser:对得上、稳定。** R1 的 29✅ 是 R06 漏报(子代理没把这格写进结果数组),R2 干净拿到 30✅,与能力表"全绿"一致。
- **playwright-cli:对得上、稳定。** 两轮 N-R/❌ 都有明确根因且一致:T10a/R02/R06 N-R=自管浏览器没真实登录态/没 9224 扩展(=能力表"接不进真实登录态");R04/R07 ❌=**npm 被 Cloudflare/403 拦(网络/代理问题,非工具)**。其余全 ✅,含 R08 原生 route。
- **bb-browser:部分对得上、最不稳。** 稳定且与能力表一致的真实短板:T09 ❌(无扩展reload)、R08 N-R(无route)、T08 ⚠️(shadow click bug)。**不稳的格(T04/T11/T13/T17/R06):原生原语失败=❌(符合能力表),但子代理用 CDP 逃生硬怼能翻成 ✅\***——两轮在 ❌/⚠️↔✅\* 间跳,全看逃生用多狠。这就是 bb"修一处能改命/原语弱"的本质。
- **devtools-mcp:** R1 的 1 个 N-R=R08(无运行时 route),是它唯一稳定短板,与能力表一致。R2 待补跑。

## 两个环境噪声源(影响所有工具的外场格)

1. **npm(npmjs.com)被 Cloudflare/403 拦**(curl 实测 403)→ R04/R07 在自管浏览器上 ❌,网络问题非工具。
2. **ffffhx.github.io 偶发抽风**(一瞬 000、随即 200)→ R06/R09 偶发 N-R,网络 flake 非工具。

## 待办
- chrome-devtools MCP 已 `claude mcp add chrome-devtools-9224`(CLI 验证 ✔ Connected),但运行中会话未热加载;需 /mcp 连接或重启会话后,补跑 devtools-mcp 在 9224。
