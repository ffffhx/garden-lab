# Claude Code 独立轮总览 · 真实上下文评测 · 2026-06-20

> 本轮由 Claude Code 主控独立运行，与同日 Codex 轮（`realworld-2026-06-20-r01-r09/`）相互独立、不互相参考。
> 方法：**每个工具一个干净 subagent**（干净上下文，非并行）；所有工具**顺序轮流**占用同一浏览器，绝不并行抢占。
> 被测 4 个真实 CLI/MCP 工具（Codex 专属 @chrome/@browser 无等价物，未纳入）：
> agent-browser 0.27.2 · bb-browser 0.14.2 · chrome-devtools-mcp(gh) · playwright-cli 0.1.14。

## 环境

- 测试 Chrome 149，CDP 9223（用户常驻测试 profile：已登录 GitHub `ffffhx`，已装 content-script-only 扩展 Bench Badge `jkmndkochpgaleoechlemhdhbikdecnf`，无 SW 故不在 /json）。
- 靶场本地服务 `localhost:4399`（账号 agent@bench.dev / bench-2026）。
- **外场 R01-R09**：4 工具全部连 9223（R02 需真实登录态、R06 需扩展）。
- **靶场 T01-T20**：混合策略——agent-browser/bb-browser/devtools-mcp 用 9223；playwright-cli 用自管浏览器（attach 装扩展的 9223 会确定性崩溃，且靶场用自带假账号不需要真实登录态，自管才是公平参赛方式）。

## 一、外场 R01-R09（真实网站，×2 轮，全部 9223）

| 任务 | agent-browser | bb-browser | devtools-mcp | playwright-cli |
| --- | --- | --- | --- | --- |
| R01 GitHub 代码导航 | ✅✅ | ✅✅ | ✅✅ | N-R×2 |
| R02 GitHub 登录态通知 | ✅✅ | ✅✅ | ✅✅ | N-R×2 |
| R03 MDN 结构化阅读 | ✅✅ | ✅✅ | ✅✅ | N-R×2 |
| R04 npm 元数据 | ✅✅ | ✅✅ | ✅✅ | N-R×2 |
| R05 Web Store 扩展详情 | ✅✅ | ✅✅ | ✅✅ | N-R×2 |
| R06 扩展注入真实页 | ✅✅ | ⚠️→❌ | ✅✅ | N-R×2 |
| R07 Network 响应体 | ✅✅ | ✅✅ | ✅✅ | N-R×2 |
| R08 请求拦截/abort | ✅✅ | N-R×2 | N-R→⚠️* | N-R×2 |
| R09 HAR/性能快照 | ✅✅ | ✅✅ | ✅✅ | N-R×2 |
| **两轮合计** | **9✅ / 9✅** | 7✅+1⚠️+1N-R / 7✅+1❌+1N-R | 8✅+1N-R / 8✅+1⚠️* | **9N-R / 9N-R** |

动态字段两轮完全一致（高置信）：GitHub 未读 **70**；npm @playwright/test **v1.61.0** / Apache-2.0 / 周下载 **42,613,659**；React DevTools 评分 **4.0(1,633)** / **5,000,000** 用户。

要点：
- **agent-browser** 唯一同时拿下运行时 `network route --abort`（R08）、标准 HAR（R09）、扩展 options UI 改徽标（R06），两轮 9/9 零逃生，最稳。
- **devtools-mcp** R08 无运行时 route API（仅启动级 blockedUrlPattern / JS 层降级），两轮在 N-R 与 ⚠️* 间抖动；其余全绿。
- **bb-browser** chrome-extension URL 归一化 bug（R06 改写成 `https://chrome-extension//` 不可达）、无 route/abort（R08）、无完整 HAR 是硬伤。
- **playwright-cli** 受「不许自起浏览器、必须 attach 9223」约束，`connectOverCDP` 在枚举扩展 service_worker target 时撞 `assert(targetInfo.browserContextId)` 确定性崩溃 → 全 N-R（两轮稳定复现）。

## 二、靶场 T01-T20（本地靶场，21 卡含 T10a/b，×2 轮，混合浏览器）

| 工具 | 第1轮(已环境修复) | 第2轮 | 真实短板 |
| --- | --- | --- | --- |
| **devtools-mcp** | **21✅**（零逃生） | 20✅+1⚠️(T10b) | 几乎无；T10b 持久化靠 userDataDir |
| **agent-browser** | 20✅+1⚠️(T10b) | **21✅** | 无；T02/T03/T07/T09 用 eval 逃生舱补原语 |
| **playwright-cli** | 20✅+1N-R(T10a) | 18✅+1⚠️(T09)+2N-R(T10a/b) | 不接 9223 登录态(T10a)、unpacked 扩展 reload 不稳(T09) |
| **bb-browser** | 16✅+4❌+1N-R | 14✅+4❌+3⚠️ | T04 无 mock、T09 无 reload、T11 扩展设置页不可达、T17 无跨域 OOPIF/坐标点击 |

Ground Truth 全部答对（双轮交叉）：BENCH-7341 / INSUFFICIENT_INVENTORY·SKU-8821 / hero.svg·blocking.css / 空状态 / 12条·LIVE-512 / 雷霆工作站15999 / team-pro-2026 / SHADOW-99 / coupon.ts·applySelectedCoupon·selectedCoupon / MOBILE-39 / HYD-908·9待办 / evt-005·STREAM-721 / green·live-2026.06·CACHE-BUST-42 / iframe-user@bench.dev·OAUTH-314 / UPLOAD-448 / A11Y-204 / FLAKE-307(7-3,失败3·6·9)。

### 两轮一致性
84 格中 **77 格稳定一致（91.7%）**，**0 格事实错误**；7 处不一致全部落在 T09/T10b/T13/T18 机制·边界类（逃生能否兜底 / 持久化 demo 口径 / unpacked reload flake / CDP 视口旁路），56 个核心事实格全稳定。

## 三、综合能力排序（外场+靶场，本轮）

1. **chrome-devtools-mcp** — 最稳、零逃生、性能/网络/扩展调试最省心；唯一短板是外场 R08 无运行时 route。前端开发者首选。
2. **agent-browser** — 能力最全的全能 CLI：运行时 route、HAR、扩展 options、GitHub 专用 profile 两阶段持久化（T10b）都能闭环；靶场零硬失败。最值得保留的 CLI 备选。
3. **playwright-cli** — 自管浏览器、CI 友好、靶场零逃生稳健；弱在「接用户现成登录态/9223」与 unpacked 扩展 reload。适合自管浏览器/CI 场景。
4. **bb-browser** — attach 真实登录态读数据是轻量快手（外场读取类全过），但 mock / 扩展设置页 / 跨域 iframe / 网络拦截 四类硬短板明显，URL scheme 归一化 bug 是共性根因。

## 四、与 Codex 同日轮对照

外场结论方向一致，少数差异：本轮 **agent-browser R06 记 ✅**（Codex 轮因 subagent 漏看 badge 记 ⚠️）；本轮 **devtools-mcp R08 记 N-R/⚠️\***（无 daemon blockedUrlPattern 入口，Codex 轮记 ✅\*）。playwright-cli 两轮都因 attach 9223 崩溃全 N-R，结论一致。

## 五、环境处置记录（影响靶场第1轮）

靶场第1轮发现 T15/T16/T17/T20 四工具集体失败，根因是**环境而非工具**：
1. 运行中的靶场服务 PID1762 启动于 6/12，早于 server.mjs 6/19 改动 → 缺 `/api/realtime-events`·`/api/settings`·`/api/flake-check` 路由（404）。**已重启 `node server.mjs`**，三路由恢复 200。
2. T17 跨域 iframe 子页 `127.0.0.1:4399/iframe-child.html` 被用户的 `codex-snapshot serve --port 4399` 占用（IPv4）→ 404。**按用户选择把 codex-snapshot 迁到 4401**，再重启 bench 双栈接管 127.0.0.1:4399 → 子页恢复 200。
3. 已对四题做**环境补丁轮**重跑并合并进第1轮（修复后 T15/T16/T20 四工具全 ✅；T17 三工具 ✅、bb-browser ❌ 属真实工具短板）。

> 遗留：codex-snapshot 现运行在 **4401**（非原 4399），如需复原请告知。bench server 为本轮新起进程，持续监听 4399。

## 六、状态污染检查

- 扩展徽标已恢复默认 **BENCH EXT v1.0.0**（已验证）；manifest 版本已复位 **1.0.0**。
- 无残留 agent-browser/playwright 自管浏览器；T10b 的 GitHub state/auth 文件测毕已删，未入 git。
- 真实网站全程只读，未改任何账号/网站状态。
- 9223 内遗留多个测试 tab（localhost:4399 各页、GitHub、MDN、npm、chrome://extensions 等），未替用户关闭（常驻 profile，交由用户决定）。

## 产出索引
- 外场轮1：`results/realworld-2026-06-20-claude-r01-r09/REPORT.md`
- 外场轮2：`results/realworld-2026-06-20-claude-r01-r09-round2/REPORT.md`（含两轮对照）
- 靶场轮1：`results/targetrange-2026-06-20-claude-t01-t20-round1/REPORT.md`（已环境修复）
- 靶场轮2：`results/targetrange-2026-06-20-claude-t01-t20-round2/REPORT.md`（含两轮对照与最终推荐）
- 各工具明细 REPORT 与证据（截图/network/trace/HAR）在各 `<工具>/` 子目录。
