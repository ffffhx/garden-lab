# R01-R09 真实网站外场评测总报告（Claude 独立轮）

## 1. 元信息

- 日期：2026-06-20（Asia/Shanghai）
- 执行方式：每个工具一个干净的独立 subagent，**顺序共用同一个测试 Chrome（CDP 9223）**，全程不并行、不抢同一个浏览器。
- 主控模型：Claude Code 独立轮。
- 目标浏览器：用户提供的测试 Chrome profile（真实登录态），**Chrome 149**，CDP 端口 `9223`。
- 本轮参评工具（仅 4 个真实 CLI / MCP 工具，**不含 Codex 专属的 `@chrome` / `@browser` 内置插件**）及版本：

| 工具 | 版本 / 标识 |
| --- | --- |
| agent-browser | 0.27.2 |
| bb-browser | 0.14.2 |
| chrome-devtools-mcp | MCP `mcp__chrome-devtools-gh__*`（gh 套件，Chrome 149 test profile via CDP 9223） |
| playwright-cli | 0.1.14 |

- 扩展前置：本地测试扩展 Bench Badge `jkmndkochpgaleoechlemhdhbikdecnf` v1.0.0，用于 R06 验证 content script 注入真实线上 Garden Lab 文章。

## 2. 判定口径

- `✅`：工具按任务目标完成，并留下页面 / Network / trace / 扩展状态等证据。
- `⚠️`：核心能力可完成，但证据链或工具原语不完整（例如绕过设置页 UI 直接写 storage）。
- `❌`：工具可运行，但未完成该任务。
- `N-R`：本轮运行时不可用，或该工具没有暴露对应能力（Not-Runnable / Not-Represented）。
- 逃生标记 `*`：完成路径**逃出了工具自身的标准原语**（例如绕到 CDP 底层、靠宿主路径哈希推导扩展 ID）。`*` 只标注实现路径，不改变上面的 verdict 字母。

> 说明：**外场 R01-R09 结果不并入 T01-T20 总分。** 这些任务含大量当次动态字段（未读数、版本号、下载量、评分、timing），只保留“本 profile、本时间点、本版本下的一次证据”。

## 3. 任务矩阵（R01-R09 × 4 工具）

| 任务 | agent-browser | bb-browser | chrome-devtools-mcp | playwright-cli |
| --- | --- | --- | --- | --- |
| R01 GitHub 公共仓库代码导航 | ✅ | ✅ | ✅ | N-R |
| R02 GitHub 真实登录态只读通知 | ✅ | ✅ | ✅ | N-R |
| R03 MDN 文档结构化阅读 | ✅ | ✅ | ✅ | N-R |
| R04 npm 包页面元数据 | ✅ | ✅ | ✅ | N-R |
| R05 Chrome Web Store 扩展详情 | ✅ | ✅ | ✅ | N-R |
| R06 扩展注入真实网站 | ✅ | ⚠️* | ✅* | N-R |
| R07 真实网站 Network 响应体 | ✅ | ✅ | ✅ | N-R |
| R08 真实网站请求拦截 | ✅ | N-R* | N-R* | N-R |
| R09 真实网站 HAR / 性能快照 | ✅ | ✅ | ✅ | N-R |

`*` 含义：
- bb-browser R06 `⚠️*`：options 设置页因 `chrome-extension://` URL 被改写而不可达，只能 CDP 逃生在隔离世界写 `chrome.storage.local`，绕过设置页 UI，故降为 ⚠️。R08 `N-R*`：CLI 原生无任何 route/abort 原语，仅用 CDP `Fetch.failRequest` 逃生演示浏览器底层可拦截，不计入工具能力。
- chrome-devtools-mcp R06 `*`：content-script-only MV3 扩展无 SW、不在 CDP inspectable target，扩展 ID 靠宿主路径哈希推导后浏览器内验证（配置改动仍走 options.html UI，未直写 storage）。R08 `N-R*`：无 route/abort/Fetch 域入口，emulate 只能整页 offline/限速，连 JS 层 initScript 降级在 MDN 也未生效，判能力缺失。

## 4. 每工具一行总览

| 工具 | 连接 | 合计 | 强项 | 硬伤 |
| --- | --- | --- | --- | --- |
| agent-browser 0.27.2 | ✅ attach 9223 真实登录态 | **9✅**（0 逃生） | 唯一 9/9 全绿且无逃生：Network 事后读响应体(R07)、`route --abort` 网络层拦截(R08)、`har start/stop` 导出带 timings 的标准 HAR(R09)、读 `chrome://extensions` shadow DOM 取扩展 ID 并走 options UI 改徽标(R06) | `route` 的 glob 不支持 `{a,b}` brace 扩展；`har stop` 忽略指定路径、落默认 tmp 目录需手动 cp |
| bb-browser 0.14.2 | ✅ | **7✅ + 1⚠️ + 1 N-R**（R06/R08 逃生） | 读取/快照/eval/Network 列表/trace 响应体/trace 计时够用，R01-R05/R07/R09 全绿 | 完全无请求拦截原语(R08 N-R)；`chrome-extension://` URL 被改写致 options 设置页不可达(R06 只能逃生写 storage)；click `@ref` 解析不稳定(R03 靠直接导航绕过)；无 HAR 导出（靠 trace 事件 ts 自算耗时） |
| chrome-devtools-mcp(gh) | ✅ | **8✅ + 1 N-R**（R06/R08 逃生） | 只读取证(R01-R05/R07 全 ✅)与性能/网络观测强：R09 performance trace 直接给 LCP/CLS + Resource Timing，`get_network_request` 能落响应体做交叉验证 | 完全无 route/abort/Fetch 拦截能力，R08 连 JS 层降级在 MDN 都未生效 → N-R；R06 content-script-only 扩展无 inspectable target，ID 只能靠宿主路径哈希推导 |
| playwright-cli 0.1.14 | ❌ 从未建立 | **9 N-R**（0 逃生） | 能力齐全（route/abort、requests/response-body、tracing、screenshot、localstorage 都有） | 致命：在装扩展的 9223 profile 上 `connectOverCDP` 命中库内断言 `coreBundle.js:37805 assert(targetInfo.browserContextId)`（扩展 service_worker target 无 browserContextId），守护进程崩溃，连接从未建立；无 CLI flag/config 可关闭 auto-attach 或过滤 service_worker → 9 题全部 N-R |

## 5. 关键证据（均为当次观测值，非写死，会随网站变化）

- **R02 GitHub 未读数**：本轮观测约 2026-06-20 00:55–01:25 CST，未读总数 **70**（Inbox 70；侧栏 garden-lab 58 + codex-snapshots 7 + profilepilot 4 + open-token-board 1 = 70）。前 5 条仓库：garden-lab(CI#387 / #386 / #376 / #375)、open-token-board(CI#41)。三个连得上的工具全程**只读 eval**，未点 Done / Mark-as-read，未抢焦点、未开新 tab（登录态 `ffffhx` 生效）。
- **R04 / R07 npm `@playwright/test`**：本轮页面 **version 1.61.0**、License **Apache-2.0**、**Weekly Downloads 42,613,659**、Repository github.com/microsoft/playwright；**Unpacked Size / Total Files 该页未显示**（如实区分“页面未显示”而非“工具未找到”）。R07 元数据内联在 document 响应体（`name=@playwright/test`、`version=1.61.0`），与页面版本一致；agent-browser/bb-browser/devtools-mcp 均能事后读响应体。
- **R05 Chrome Web Store React Developer Tools**：ID `fmkadmapgofadopljbjfkapdkoienihi`，发布者 **Meta（Meta Platforms, INC.）**，评分 **4.0（1,633 个评分）**，用户量 **5,000,000**，版本 **7.0.1**，主按钮“添加至 Chrome”（未点击）。
- **R06 扩展徽标**：扩展 ID `jkmndkochpgaleoechlemhdhbikdecnf` v1.0.0。设置后真实文章（`https://ffffhx.github.io/garden-lab/post/agent/`）徽标变为 **`REAL-SITE-2026 · v1.0.0`**，恢复后回到默认 **`BENCH EXT v1.0.0`**。
- **R09 最慢 3 资源 / timing**（各工具量取口径不同，均为当次值）：
  - agent-browser（HAR，33 requests）：cover-v1.webp 1483ms(wait964) / `_next` d99d8e6a chunk 1081ms(wait1077) / icon-192.png 1013ms(wait1011)；耗时主要在 wait（GitHub Pages 排队/TTFB），connect≈0。
  - bb-browser（trace ts 自算）：page-[slug] chunk 317ms / layout chunk 301ms / 483 vendor chunk 243ms；文档本身仅 92ms。
  - chrome-devtools-mcp（performance trace）：LCP 191ms / CLS 0.00 / nav 376ms；最慢 token-board auth/me fetch 63ms（第三方）/ icon-192.png 26ms / `_next` 654 chunk 25ms。
  - 三家一致区分“最慢资源 ≠ 影响首屏”：webp 封面 / PWA icon-192 虽最慢但折叠下或 load 后，不影响首屏；早期 render-blocking 的 Next.js JS chunk + 主文档 + 字体才在关键渲染路径。

## 6. 状态污染检查

- R06 完成后**徽标已恢复默认 `BENCH EXT v1.0.0`**：
  - agent-browser：通过设置页 UI 清空 `badge-text` 并保存（status「已保存：恢复默认徽标」），刷新真实文章确认恢复。
  - bb-browser：清空 `chrome.storage.local` 的 `badgeText` 键（现 `{}`），reload 后真实页恢复默认。
  - chrome-devtools-mcp：remove `chrome.storage.local.badgeText` 键后刷新，evaluate 读 `#bench-ext-badge` 确认恢复默认。
  - playwright-cli：attach 从未成功，**未写入任何扩展 storage**，徽标始终保持默认。
- **未修改任何真实网站状态**：R02 全程只读、未触发账号写操作；R06 仅改本地测试扩展的 storage 并已还原；目标网站内容未改。9223 为用户常驻 profile，无需 close。

## 7. 与已有记录的关系

本轮是 **Claude Code 独立复跑**，结论独立得出，可与同日 **Codex 轮** `results/realworld-2026-06-20-r01-r09/`（gpt-5.5 / xhigh subagent）对照，但**不强行对齐**。可见差异点：

- **范围差异**：Codex 轮额外评了其专属内置插件 `@chrome`（disabled，9 N-R）与 `@browser`（仅公共网页，4✅+1⚠️+4 N-R）；本轮只比 4 个通用 CLI/MCP 工具，不含这两者。
- **agent-browser R06**：本轮判 **✅**（设置链路与徽标观察均确认）；Codex 轮判 ⚠️（注入实际成功但其 subagent 漏看 badge 误判）。本轮 agent-browser 在外场为 9/9 全绿且无逃生，是两轮中表现最完整的工具。
- **chrome-devtools-mcp R08**：本轮判 **N-R**（该 MCP 套件未暴露 route/abort/Fetch 入口，JS 层降级在 MDN 也未生效）；Codex 轮判 `✅*`（用 daemon 启动参数 `--blockedUrlPattern` 在网络层阻断指定资源）。差异源于两轮使用的入口/启动参数不同——Codex 轮借助 daemon 级 `--blockedUrlPattern`，本轮 MCP 运行时无此入口，故按“运行时无拦截原语”记 N-R。这是两轮最显著的判定差异，**点出但不对齐**。
- **bb-browser R06/R08**：两轮结论方向一致（R06 设置页不可达只能逃生、R08 无拦截原语），本轮 R06 记 ⚠️*、R08 记 N-R*。
- **playwright-cli**：两轮一致——在装扩展的 9223 profile 上 `connectOverCDP` 因扩展 service_worker target 断言崩溃，全套 9 N-R。
- **动态字段一致性**：R02 未读 70、R04/R07 版本 1.61.0 / 周下载 42,613,659、R05 评分 4.0(1,633)/5,000,000 用户，两轮当次观测值一致（同 profile、同窗口期）。
