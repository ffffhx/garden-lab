# R01-R09 真实网站外场评测总报告（Claude 独立轮 · 第 2 轮）

## 1. 元信息

- 日期：2026-06-20（Asia/Shanghai）。
- 轮次：**第 2 轮（Claude 独立轮，与第 1 轮同日复跑）**。
- 执行方式：每个工具一个**干净的独立 subagent**，**顺序共用同一个测试 Chrome（CDP 9223）**，全程不并行、不抢同一个浏览器（agent-browser → bb-browser → chrome-devtools-mcp → playwright-cli 顺序进行）。
- 主控模型：Claude Code 独立轮（本报告为主控汇总）。
- 目标浏览器：用户提供的测试 Chrome profile（真实登录态 GitHub `ffffhx`），**Chrome 149**，CDP 端口 `9223`。
- 本轮参评工具（仅 4 个真实 CLI / MCP 工具，**不含 Codex 专属内置插件**）及版本：

| 工具 | 版本 / 标识 | 本轮连接 |
| --- | --- | --- |
| agent-browser | 0.27.2 | ✅ attach 9223 |
| bb-browser | 0.14.2 | ✅ attach 9223 |
| chrome-devtools-mcp | MCP `mcp__chrome-devtools-gh__*`（gh 套件，Chrome 149 via CDP 9223） | ✅ attach 9223 |
| playwright-cli | 0.1.14 | ❌ 从未建立连接 |

- 扩展前置：本地测试扩展 Bench Badge `jkmndkochpgaleoechlemhdhbikdecnf` v1.0.0，content-script-only（无 service worker），用于 R06 验证注入真实线上 Garden Lab 文章。

## 2. 判定口径

- `✅`：工具按任务目标完成，并留下页面 / Network / trace / 扩展状态等证据。
- `⚠️`：核心目标达成，但靠逃出工具标准原语的手段实现（证据链或工具原语不完整）。
- `❌`：工具可运行、连得上浏览器，但未完成该任务。
- `N-R`：本轮运行时不可用，或该工具没有暴露对应能力（Not-Runnable / Not-Represented）。
- 逃生标记 `*`：完成路径**逃出了工具自身的标准原语**（例如靠 JS 层 initScript 覆写代替网络层 route）。`*` 只标注实现路径，不改变 verdict 字母。

> 说明：**外场 R01-R09 不并入 T01-T20 总分。** 这些任务含大量当次动态字段（未读数、版本号、下载量、评分、timing），只保留“本 profile、本时间点、本版本下的一次证据”。

## 3. 任务矩阵（R01-R09 × 4 工具，第 2 轮）

| 任务 | agent-browser | bb-browser | chrome-devtools-mcp | playwright-cli |
| --- | --- | --- | --- | --- |
| R01 GitHub 公共仓库代码导航 | ✅ | ✅ | ✅ | N-R |
| R02 GitHub 真实登录态只读通知 | ✅ | ✅ | ✅ | N-R |
| R03 MDN 文档结构化阅读 | ✅ | ✅ | ✅ | N-R |
| R04 npm 包页面元数据 | ✅ | ✅ | ✅ | N-R |
| R05 Chrome Web Store 扩展详情 | ✅ | ✅ | ✅ | N-R |
| R06 扩展注入真实网站 | ✅ | ❌ | ✅ | N-R |
| R07 真实网站 Network 响应体 | ✅ | ✅ | ✅ | N-R |
| R08 真实网站请求拦截 | ✅ | N-R | ⚠️\* | N-R |
| R09 真实网站 HAR / 性能快照 | ✅ | ✅ | ✅ | N-R |

合计：agent-browser **9✅**（0 逃生）；bb-browser **7✅ + 1❌ + 1 N-R**（0 逃生）；chrome-devtools-mcp **8✅ + 1⚠️\***（R08 逃生）；playwright-cli **9 N-R**（0 逃生）。

`*` 含义：
- chrome-devtools-mcp R08 `⚠️*`：该 MCP 套件无 route/abort/intercept 网络层 API，meta CSP `img-src none` 注入失败；改用 `initScript` 覆写 `HTMLImageElement.prototype` 的 `src` setter，使 3 个 `/pimg/` 广告图 GET 从不发出（对照 load 中确实缺席）。属 JS 层拦截（强于 CSS 隐藏但非工具网络层 route）→ ⚠️ 且 `escape=true`。

## 4. 每工具一行总览（第 2 轮）

| 工具 | 连接 | 合计 | 强项 | 硬伤 |
| --- | --- | --- | --- | --- |
| agent-browser 0.27.2 | ✅ attach 9223 | **9✅**（0 逃生） | 唯一 9/9 全绿且无逃生：R07 从 Document 响应体内联 JSON 取 name/version 并与页面交叉一致；R08 `network route --abort` 网络层拦截 40 个 SVG（无 status 证明网络层 abort）；R09 HAR(31 请求)+Performance 区分最慢资源(auth/me)与首屏关键资源；R06 走 options UI 改徽标真实页验证后恢复默认 | 无（本轮无逃生、无写真实站状态） |
| bb-browser 0.14.2 | ✅ attach 9223 | **7✅ + 1❌ + 1 N-R**（0 逃生） | 读取/快照/eval/Network 列表/trace 响应体/trace 计时够用，R01-R05/R07/R09 全绿；R07 trace 定位主文档 200 取响应体拿 name/version；R09 trace 55 events 等价 HAR 算 timing | ①完全无请求拦截原语(route/abort/intercept/block/mock 全不存在) → R08 **N-R**；②`chrome-extension://` URL 被 open/goto/eval 强加 `https://` 前缀致 options 设置页落 chrome-error 不可达，且 eval 仅在页面主世界无 chrome.storage → R06 **❌**（既到不了设置页也写不了 storage，全程未改 storage） |
| chrome-devtools-mcp(gh) | ✅ attach 9223 | **8✅ + 1⚠️\***（R08 逃生） | 只读取证(R01-R05/R07)与性能/网络观测强：R06 导航 options.html 锁定 ID 并经设置页 UI 改徽标 REAL-SITE-2026 真实页验证；R07 主文档响应体落盘交叉验证；R09 performance trace 给 LCP 180ms/CLS 0 + Resource Timing 并区分最慢与关键资源 | 无网络层 route/abort/Fetch 拦截 API，R08 只能靠 initScript 覆写 img src setter 阻断请求 → ⚠️ + escape |
| playwright-cli 0.1.14 | ❌ 从未建立 | **9 N-R**（0 逃生） | 能力齐全（route/abort、response-body、tracing 都有，但无法表达） | 致命：在装扩展的 9223 profile 上 `connectOverCDP` 确定性崩溃于 `coreBundle.js:37805 assert(targetInfo.browserContextId)`（扩展 service_worker target 无 browserContextId），daemon code 1 退出，连接从未建立；3 次尝试、2 种 endpoint 形式均同一断言崩溃 → 9 题全部 N-R |

## 5. 关键证据（均为**当次观测值，非写死**，会随网站/时间变化）

- **R02 GitHub 未读数（动态）**：本轮观测窗口约 2026-06-20 01:45–02:14 CST，**未读总数 70**（agent-browser 侧栏拆分 garden-lab 58 + codex-snapshots 7 + profilepilot 4 + open-token-board 1 = 70，与 Inbox 70 一致）。前 5 条仓库：garden-lab(CI#387 / #386 / #376 / #375)、open-token-board(CI#41)。三个连得上的工具全程**只读 eval**，未点 Done/Mark-as-read、未抢焦点、未开新 tab（登录态 `ffffhx`）。
- **R04 / R07 npm `@playwright/test`（动态）**：本轮 **version 1.61.0**、License **Apache-2.0**、**Weekly Downloads 42,613,659**、Repository github.com/microsoft/playwright、Last publish 5h ago；**Unpacked Size / Total Files 该页未显示**（如实区分“页面未显示”而非“工具未找到”）。R07 元数据内联在 Document 响应体（`name=@playwright/test`、`version=1.61.0`、`dist-tags.latest=1.61.0`），与页面版本一致；三家均事后读 Network 响应体取证。
- **R05 Chrome Web Store React Developer Tools（动态）**：ID `fmkadmapgofadopljbjfkapdkoienihi`，发布者 **Meta（Meta Platforms, INC.）**，评分 **4.0（1,633 个评分）**，用户量 **5,000,000**，版本 **7.0.1（10/20/2025）**，主按钮“添加至 Chrome”（未点击/未登录）。
- **R06 扩展徽标（动态状态）**：扩展 ID `jkmndkochpgaleoechlemhdhbikdecnf` v1.0.0。设置后真实文章（`https://ffffhx.github.io/garden-lab/post/agent/`）徽标变 **`REAL-SITE-2026 · v1.0.0`**，恢复后回默认 **`BENCH EXT v1.0.0`**（仅 agent-browser、chrome-devtools-mcp 成功改并验证；bb-browser 到不了设置页全程徽标保持默认）。
- **R09 最慢 3 资源 / timing（动态，各工具量取口径不同，均当次值）**：
  - agent-browser（HAR 31 请求 + Performance，FCP 228ms）：① `anyip.dev/token-board/api/auth/me` 54.4ms(application/json，startTime≈328ms) / ② 主文档 9.4ms(text/html) / ③ icon-192.png 4.7ms(image/png)。
  - bb-browser（trace ts 自算，整次 span≈406ms）：① page-[slug].js ~133ms(Script) / ② layout.js ~132ms(Script) / ③ 主文档 ~91ms(Document)。
  - chrome-devtools-mcp（performance trace）：LCP 180ms / CLS 0.00 / TTFB 2ms；最慢 ① `auth/me` fetch 57ms(startTime319ms) / ② page-[slug].js 19ms / ③ 42-/654- chunk 18ms。
  - 三家一致结论：**最慢资源 ≠ 首屏关键资源**——`auth/me`（第三方 token-board API）虽最慢但在 FCP 之后异步发出、不阻塞首屏；真正影响首屏的是早期主文档 HTML + render-blocking 的 Next.js JS/CSS chunk（startTime≈62ms）。

## 6. 状态污染检查

- **R06 完成后徽标已恢复默认 `BENCH EXT v1.0.0`**：
  - agent-browser：options UI 清空保存 + 扩展上下文 `chrome.storage.local.remove('badgeText')`（after `{}`），reload 真实页确认回默认（证据 `R06-restored.png`）。
  - chrome-devtools-mcp：remove `chrome.storage.local.badgeText` 键（storage 回 `{}`），刷新文章确认 `#bench-ext-badge` 回默认。
  - bb-browser：到不了设置页、eval 主世界无 chrome.storage，**自始至终未写入任何 badgeText**，徽标始终为默认（实为全程未改动）。
  - playwright-cli：attach 从未成功，**未触碰任何扩展 storage**，徽标保持默认。
- **未修改任何真实网站状态**：R02 全程只读、未触发账号写操作；R06 仅改本地测试扩展 storage 且已还原；目标网站内容未改。9223 为用户常驻 profile，无需 close。**下一个工具 / 下一轮的 R06 起点干净。**

## 7. 与第 1 轮对照

第 1 轮报告：`results/realworld-2026-06-20-claude-r01-r09/REPORT.md`（同日、同 4 工具、同 CDP 9223、同 Chrome 149）。逐工具逐任务比对如下。

### 7.1 逐任务 verdict 对照（第 1 轮 → 第 2 轮）

| 任务 | agent-browser | bb-browser | chrome-devtools-mcp | playwright-cli |
| --- | --- | --- | --- | --- |
| R01 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | N-R → N-R 一致 |
| R02 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | N-R → N-R 一致 |
| R03 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | N-R → N-R 一致 |
| R04 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | N-R → N-R 一致 |
| R05 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | N-R → N-R 一致 |
| R06 | ✅ → ✅ 一致 | ⚠️\* → ❌ **不一致** | ✅\* → ✅ 一致（逃生标记淡化） | N-R → N-R 一致 |
| R07 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | N-R → N-R 一致 |
| R08 | ✅ → ✅ 一致 | N-R\* → N-R **一致** | N-R\* → ⚠️\* **不一致** | N-R → N-R 一致 |
| R09 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | ✅ → ✅ 一致 | N-R → N-R 一致 |

### 7.2 两轮稳定（一致，说明结论可信）

- **agent-browser：两轮 9/9 全绿、0 逃生，完全稳定。** 是两轮中表现最完整、最一致的工具。R06 走 options UI 改徽标、R07 读响应体、R08 `route --abort` 网络层拦截、R09 HAR+Performance，每项两轮一致复现。
- **playwright-cli：两轮 9 题全部 N-R，确定性崩溃稳定复现。** 根因两轮同一：装扩展的 9223 profile 上 `connectOverCDP` 命中 `coreBundle.js:37805 assert(targetInfo.browserContextId)`（扩展 service_worker target 无 browserContextId）。这是工具与企业 Chrome 扩展 target 的确定性不兼容，非偶发 flake。
- **bb-browser R01-R05/R07/R09 + R08：** 7 项只读/响应体/timing 任务两轮全 ✅ 稳定；R08 两轮均判 N-R（工具完全无 route/abort/intercept 原语，已逐一验证），稳定。
- **chrome-devtools-mcp R01-R07/R09：** 8 项两轮一致 ✅（含 R06 设置页改徽标）。
- **动态字段两轮一致**（同 profile、同窗口期）：R02 未读 **70**、R04/R07 版本 **1.61.0** / 周下载 **42,613,659**、R05 评分 **4.0(1,633)** / 用户 **5,000,000**。动态值两轮吻合，说明取数路径稳定可信、非臆造。

### 7.3 两轮不一致（列出并分析）

两处 verdict 出入，**均为工具 flake / 实现路径选择差异，非网站动态波动**（动态字段两轮完全一致已排除网站侧因素）：

1. **bb-browser R06：第 1 轮 ⚠️\* → 第 2 轮 ❌（工具 flake / 逃生可用性差异）。**
   - 第 1 轮：options 设置页因 `chrome-extension://` URL 被改写不可达，但**仍能用 CDP 逃生在隔离世界写 `chrome.storage.local`** 绕过设置页 UI 完成 → 判 ⚠️\*。
   - 第 2 轮：同样到不了设置页，且**本轮 eval 仅落在页面主世界、目标页 chrome 判 no-storage，无法从页面写 chrome.storage**，工具不暴露 raw CDP/extension target，连逃生写 storage 都做不到 → 判 ❌。
   - 分析：根因同一（`chrome-extension://` 被强加 `https://` 前缀 → options 不可达），差异在“**能否拿到隔离世界 / extension 上下文写 storage 的逃生入口**”。第 1 轮 subagent 找到了 CDP 逃生写 storage 的口子，第 2 轮 subagent 走的 eval 落在主世界拿不到 chrome.storage。属**工具能力边界处的实现路径 flake**（逃生通道在不同 subagent 会话下可用性不稳定），非网站波动。结论方向一致（设置页不可达是真实硬伤），仅“是否够得着逃生”一档之差。

2. **chrome-devtools-mcp R08：第 1 轮 N-R\* → 第 2 轮 ⚠️\*（降级手段在不同目标页的生效差异）。**
   - 第 1 轮：无 route/abort/Fetch 入口，**JS 层 initScript 降级在 MDN 也未生效** → 判 N-R\*（能力缺失）。
   - 第 2 轮：同样无网络层 API，但**改用 initScript 覆写 `HTMLImageElement.prototype.src` setter，成功阻止 3 个 `/pimg/` 广告图 GET 发出**（对照 load 缺席）→ 判 ⚠️\*（强于 CSS 隐藏但仍属 JS 层、非工具网络层 route）。
   - 分析：两轮根因一致——**该 MCP 套件确实无网络层 route/abort/Fetch 拦截原语**。差异仅在“JS 层降级拦截这次有没有命中目标资源”：第 1 轮针对的图片注入路径让 initScript 没拦住，第 2 轮换 src setter 覆写 + 拦 `/pimg/` 广告图成功。属**逃生手段在不同图片加载路径上的生效差异**（工具 flake / 实现选择），非网站动态波动。两轮共同结论不变：**该工具缺网络层拦截能力，R08 只能靠 JS 层逃生**。

### 7.4 对照小结

- **稳定可信**：4 工具 × 9 任务共 36 格，**34 格两轮 verdict 一致**（含全部 N-R、全部只读任务、全部动态字段）。其中 agent-browser 9/9、playwright-cli 9/9 完全稳定。
- **2 格不一致**（bb-browser R06、chrome-devtools-mcp R08）：**均落在“工具无原生能力、靠逃生/降级手段”的能力边界格**，是逃生通道可用性 / JS 层降级生效与否的 **工具 flake**，**不是网站动态波动**（动态字段两轮完全吻合可佐证）。两处不一致的**底层结论方向两轮一致**：bb-browser 设置页确实不可达、chrome-devtools-mcp 确实无网络层拦截原语——只是“逃生能否兜底”这一档在两轮间抖动。
