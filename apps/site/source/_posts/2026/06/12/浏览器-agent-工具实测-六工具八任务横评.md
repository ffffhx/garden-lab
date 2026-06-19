---
title: "浏览器 Agent 工具怎么选：@chrome、@browser、agent-browser、bb-browser、Chrome DevTools MCP、playwright-cli 二十任务实测"
updated: 2026-06-19 23:31:45
date: 2026-06-12 21:30:00
categories:
  - 技术
tags:
  - Chrome
  - CDP
  - MCP
  - DevTools
  - Browser Automation
  - Agent
  - Playwright
  - Benchmark
excerpt: "实测 @chrome、@browser、agent-browser、bb-browser、Chrome DevTools MCP 和 playwright-cli：二十道固定任务覆盖网页登录、Network 排障、性能诊断、扩展特权页、真实登录态、Source Map、Service Worker、iframe、文件上传与键盘可访问性；另补 R01-R09 真实网站外场任务，覆盖 Chrome Web Store、真实扩展注入、真实 Network 响应体、请求拦截和 HAR/trace。结论不是谁最强，而是什么场景该选谁。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

如果你正在选浏览器 Agent 工具，先别问"哪个最强"。先问三件事：它能不能复用真实登录态，能不能拿到 Network / 性能证据，能不能进入 `chrome://` 和扩展设置页。

我用 `@chrome`、`@browser`、`agent-browser`、`bb-browser`、`Chrome DevTools MCP` 和 `playwright-cli` 跑了二十道有标准答案的固定任务，从网页登录、Network 排障、性能诊断，一路覆盖到扩展安全域、真实登录态、Source Map、Service Worker、iframe、文件上传与键盘可访问性。后来又补了一组 R01-R09 真实网站外场任务卡，专门覆盖 GitHub、MDN、npm、Chrome Web Store、真实扩展注入、真实 Network 响应体、请求拦截和 HAR/trace；这组还没有并入总分，原因是外部网站会变，必须按当次 URL、时间戳、profile 和证据判定。

这篇文章按"结论 → 过程 → 原理"三段组织：

- **一、结论先行**：第 1 节是六工具 × 二十任务的结果总表，第 2 节按"你要干什么"直接给首选与加装路由；
- **二、测试过程**：第 3 节是实测方法（基准测试站与任务设计），第 4 节逐格核对每个 ❌ / ⚠️ 的成因，第 5 节提炼比单格更长寿的跨工具规律；
- **三、底层原理**：第 6 节用浏览器能力分层和安全域给出边界公式，第 7 节逐工具讲实现——边界到底来自哪里。

复现材料（基准测试站、任务卡、原始数据）都在仓库 `apps/browser-tool-bench/`；固定靶场任务在 `tasks/`，真实网站外场任务在 `tasks-real/`，可以复查每个 ✅ / ⚠️ / ❌ 的依据，也能看到哪些任务只是补了评测集、尚未跑分。

全文主线是一个从实测里提炼出来的公式：

> **工具实际能力 = min(协议层上限, 产品封装范围, 安全策略)**

这条公式能解释总表里的大多数边界：有的工具协议层够强，但产品封装没开放；有的能连到真实 profile，却被 Chrome 安全策略或企业管控挡住；有的操作顺滑，但拿不到响应体、trace 或扩展特权页。后文的每个 ❌ 和 ⚠️ 都会落回这三个因素之一。

只想选工具，可以直接跳到 [第 2 节选型路由](#2-选型路由按任务场景反推工具)。想复现实测，看附录里的 `apps/browser-tool-bench/`、任务卡和原始结果目录。想理解某个工具为什么失败，从第 4 节逐格解释读起。

## 一、结论先行：读者最关心的

### 1. 结果总表

一张总表收全二十道题。图例：`*` = 依赖 eval、CDP 逃生舱或临时页面脚本补齐关键步骤；`†` = `--cdp` 命中目标 profile 不可靠、需先复位常驻 daemon（见 7.2）；`‡` = 依赖持久 userDataDir、不可移植（换目录即丢）；`△` = 工具自身无持久化机制、只能搭外部持久浏览器便车；`N/A` = 该任务对该工具不适用；`N-R` = 本轮运行时不可用或该能力未暴露。

| 任务 | @chrome | @browser | agent-browser | bb-browser | DevTools MCP | playwright-cli |
| --- | --- | --- | --- | --- | --- | --- |
| T01 登录与观察 | ✅ | ✅ | ✅ | ✅* | ✅ | ✅ |
| T02 Network 排障 | ❌ 无响应体 | ❌ 无响应体 | ✅ | ✅*（需 trace 重放） | ✅ | ✅ |
| T03 性能诊断 | ❌ 无 perf API | ❌ 无 perf API | ✅（自挖 profiler） | 未跑 | ✅（insight 直出） | ✅ |
| T04 请求 mock | ❌ 无 route | ❌ 无 route | ✅ 网络层 | ⚠️* JS 层补丁 | ⚠️ JS 层 initScript | ✅ 网络层 |
| T05 动态等待 | ✅ | ✅ | ✅ | ✅*（盲 sleep） | ✅ | ✅ |
| T06 结构化提取 | ⚠️ 徽标混入字段 | ✅ | ✅ | ✅* | ✅ | ✅ |
| T07 已登录 fetch | ❌ evaluate 无 fetch | ❌ fetch 被拦 | ✅ | ✅* | ✅ | ✅ |
| T08 Shadow DOM | ✅ | ✅ | ✅ | ✅*（双重 eval） | ✅ | ✅ |
| T09 扩展 reload | ❌ chrome:// 被策略拦 | ❌ 封死 chrome:// | ✅† | ⚠️/❌ 到不了扩展管理 | ✅ | ✅ 自管 context |
| T10a 真实登录态（默认 profile） | ✅ 68 | ❌ 无真实登录态 | ✅† 68 | ✅ 68 | ✅ 68 | ❌ 接不进系统 Chrome |
| T10b 登录态持久化（专用 profile） | N/A | N/A | ✅ 可移植 state 文件 | △ 仅能 attach | ✅‡ 持久 userDataDir | ✅ 可移植 state 文件 |
| T11 用扩展（设置页改徽标） | ❌ chrome-extension:// 被拦 | ❌ | ✅† | ⚠️ 靠 CDP 强开设置页 | ✅ | ✅ 自管 context |
| T12 Console 与 Source Map 定位 | N-R | ⚠️ raw sourcemap blocked | ✅* eval 取 map | ✅* CDP 逃生 | ✅ | ✅ |
| T13 移动端布局遮挡 | N-R | ⚠️ 未拿确认码 | ✅* eval 补确认码 | ✅* CDP 逃生 | ✅* 临时解除遮挡 | ✅* `run-code` 补确认码 |
| T14 SPA 状态 / Hydration 不一致 | N-R | ✅ | ✅* eval 读 store | ✅* CDP 逃生 | ✅ | ✅ |
| T15 SSE 实时流等待 | N-R | ✅ | ✅* eval 触发 click | ✅* CDP 逃生 | ✅ | ✅ |
| T16 Service Worker 缓存排障 | N-R | ⚠️ 未拿 live 值 | ✅* eval/SW 诊断 | ✅* CDP 逃生 | ✅ | ✅ |
| T17 跨域 iframe 授权 | N-R | ✅ | ✅ | ✅* CDP 逃生 | ✅ | ✅ |
| T18 文件上传与拖拽输入 | N-R | N-R no upload API | ✅ | ✅* CDP 逃生 | ✅ | ✅ |
| T19 键盘可访问性 | N-R | ✅ | ✅* eval 补确认码 | ✅* CDP 逃生 | ✅ | ✅ |
| T20 回归稳定性 / Flake Rate | N-R | ✅ | ✅* eval 触发 click | ✅* CDP 逃生 | ✅ | ✅ |
| **合计（六工具可比的网页八道）** | **3✅1⚠️4❌** | **4✅4❌** | **8✅** | **6✅1⚠️**（7 题） | **7✅1⚠️** | **8✅** |
| **合计（前端专项 T12-T20）** | **0/9 · 9 N-R** | **5✅3⚠️1 N-R** | **9✅（7*）** | **9✅*（CDP 逃生）** | **9✅** | **9✅** |

同宿主（claude -p）三列的过程成本：

| 指标 | agent-browser | DevTools MCP | playwright-cli |
| --- | --- | --- | --- |
| 操作数（8 题） | 94 | **48** | 70 |
| 实际耗时 | 14.5 min | **11.1 min** | 12.1 min |
| 成本 | $8.21 | $7.43 | **$6.08** |
| eval 自救 | 1 次 | 3 次 | **0 次** |

bb-browser（7 题，子 Agent 宿主）：235 条命令、26.3 分钟，7 个单元格全部依赖 eval 自救——约 agent-browser 的 2.3 倍成本，差额全部来自一个工具缺陷（4.5）。

T09/T10/T11 把战场从 localhost 网页挪到真实登录态与扩展安全域，其中涉及真实登录态的几格由两轮互相独立的隔离子 Agent 实测（一轮 Claude Code 主控、一轮 Codex），结论一致，差异只在评分口径（详见 4.7）。

关键前置（影响上表 T09/T10/T11 怎么读）：目标机器的系统默认 Chrome（CDP 9223）是**企业管控**的，会在运行时拦截"加载已解压扩展"（扩展自身 `chrome-extension://` 资源返回 `ERR_BLOCKED_BY_CLIENT`、content script 不注入），所以 T09/T11 的扩展宿主改用一台**干净的 Chrome for Testing**（`--disable-features=DisableLoadExtensionCommandLineSwitch --load-extension` 才能让 137+ 真正加载扩展）；T10a 仍在企业 9223 上测真实登录态。未读数读到 **68**（66/67/68 的差异只是 GitHub 实时状态，非能力差异）。

T12–T20 是 2026-06-19 追加的"前端开发者专项"。本轮每个工具一个独立子 Agent，实际靶场跑在 `http://localhost:4400/`（任务卡里的 `4399` 是旧端口；当时 4399 已被占用）。这一组不再只测"能不能点页面"，而是测前端排障里最常见的九类证据链：Console + sourcemap、移动端遮挡、hydration、SSE、Service Worker、跨源 iframe、文件上传、键盘可访问性和 flake 统计。

读者指出这一版仍然偏"靶场"之后，我又把真实网站外场任务补成 R01-R09：GitHub 公共仓库导航、GitHub 登录态只读通知、MDN 文档、npm 包页、Chrome Web Store 扩展详情、扩展注入真实线上文章、真实 Network 响应体、真实网站请求拦截，以及线上文章 HAR/trace。它们不改写上表结论，因为还没有按六工具独立子 Agent 跑完；但下一轮外场实测会专门回答"这些能力放进真实网站会不会稳定"。

### 2. 选型路由：按任务场景反推工具

没人会把六个工具都装上。大多数人——尤其是前端开发者——只需要一个**综合最顺手、又能复用真实登录态**的工具。把"复用真实登录态"定成硬前提（你登录过的 GitHub、内网、自己在调的应用，Agent 要能直接接着用），候选立刻从六个收敛到三个：**@chrome、bb-browser、Chrome DevTools MCP**——playwright-cli 接不进系统 Chrome、@browser 不继承真实登录态、agent-browser 的 `--cdp` 命中真身不可靠（7.2），都先出局。后续追加的前端开发者专项测试没有推翻这个结论，反而把理由补强了：前端排障最常见的 console、source map、Service Worker、iframe、file input、键盘可访问性，DevTools MCP 全部能拿到证据。

三选一里，**前端开发者首选 Chrome DevTools MCP**。

**为什么是它**：它本质就是"把你天天用的 F12 调试流程包成了一个 Agent 工具"——

- **Network 拿得到响应体**：状态码、响应体留底、事后可查，排接口问题和你在 Network 面板里干的事一模一样；
- **性能诊断直出结论**（全场最省解释成本）：`performance_analyze_insight` 直接给"LCP 2.1s、主因阻塞 CSS"这种 DevTools 原生诊断，不用自己读 trace；
- **够得到扩展特权页**：`chrome://extensions`、`options.html` 都能操作；
- **`--browserUrl` 直连你的真实 Chrome**：免登录接管你已登录的会话；
- **前端排障证据链基本全覆盖**：console/source map、hydration、SSE、SW、iframe、file input、键盘可访问性和 flake 统计都能落证据；
- 综合表现领先、操作数全场最少——对已经熟悉 DevTools 心智模型的前端，几乎零学习成本（每一项对应的逐格判定见第 1 节总表）。

**为什么不是另外两个能读真实登录态的**：

- **@chrome**：复用真实登录态零打断，可惜它把前端最需要的能力恰好都阉割了——拿不到 Network 响应体、没有 `performance` 对象、evaluate 只读。对"想排接口、看性能"的前端，等于缺了半个 F12。
- **bb-browser**：能用 `--port` 读真实登录态，但 0.14.2 的 click 事件注入有 bug、又到不了 `chrome://` 特权页，通用操作得频繁靠 eval 兜底，不够稳。

> playwright-cli 的纯自动化能力仍然最稳（综合通过率最高、几乎零 eval 自救），但它**接不进系统 Chrome**，"真实登录态"这关直接过不去——是这条硬性要求把它筛掉的。如果你哪天不需要真实登录、只做自启浏览器的自动化或回归测试，它才是首选。

**装它之前要知道的四个短板**：

- **不能 mock / 拦截网络**（只能在 JS 层打补丁）：要改写、拦截、abort 流量，得另配 playwright-cli 或 agent-browser；
- **复杂诊断会滑向 `evaluate_script`**：移动端遮挡、SW 绕行、文件 input 状态这类问题，它能查清楚，但经常需要像人打开 Console 一样写脚本；
- **持久化绑 userDataDir、不可移植**（换目录/换机就丢）：跨机器免登录不是它的强项；
- **接入成本高于纯 CLI**：要连对 Chrome、CDP 端口、profile 和 MCP server，profile 漂移会让评测结果变得不可比。

**实操姿势**：别让它接管你的日常主 Chrome（Agent 和你抢同一个 profile 会抢焦点、误改账号状态，见第 5 节），而是开一个**专用调试 profile**、用 `--browserUrl` 连它的 CDP 端口——这才是"复用真实登录态"又不打扰自己的最稳做法。

如果你的需求确实超出"驱动真实登录的浏览器 + 像 F12 一样调试"，再按下表补第二个工具：

| 额外需求 | 加装 | 为什么 |
| --- | --- | --- |
| mock / 拦截 / 改写流量 | agent-browser 或 playwright-cli | 唯二真正的网络层 route |
| 跨机器 / 跨目录免登录 | agent-browser 或 playwright-cli | 可移植 state 文件，跨目录跨实例都能恢复 |
| 把固定网站封成稳定命令 | bb-browser site adapter | 适配器复用页面登录态与前端逻辑 |
| 纯自启浏览器的长期回归测试 | Playwright（库） | 成熟的测试基建 |

## 二、测试过程：怎么测出来的、逐格为什么

### 3. 实测方法：基准测试站与任务设计

本地零依赖的基准测试站，每页埋一个已知答案的坑。固定靶场负责可复现：网站不会变、登录态可控、标准答案能机械核对。真实网站负责外场真实性：它能暴露站点改版、登录态差异、Chrome Web Store 限制、真实 Network 波动、扩展注入线上页面这些靶场刻意压掉的变量。两者不能混成一张总分表，否则动态网站的偶发变化会污染工具能力判断。

| 任务 | 坑 | 标准答案 | 考的理论维度 |
| --- | --- | --- | --- |
| T01 登录与观察 | 欢迎语由 /api/me 异步渲染 | 工号 BENCH-7341 | 快照质量、观察时机 |
| T02 Network 排障 | 下单接口固定 500，页面文案笼统 | INSUFFICIENT_INVENTORY / SKU-8821 | **CDP Network 层留底** |
| T03 性能诊断 | CSS 延迟 1.2s + 800ms 长任务 + 图延迟 1.5s | 阻塞 CSS 是 LCP 主因（见 4.3） | **DevTools 诊断模型** |
| T04 请求 mock | 成员接口真实返回 18 人 | mock 空列表 → 空状态截图 | **CDP 拦截层** |
| T05 动态等待 | 流式渲染 + 延迟出现的按钮 | 12 条 / LIVE-512 | 等待策略、动作可靠性 |
| T06 结构化提取 | 脏 DOM + 千分位 + 分页 | 12 件、最贵雷霆工作站 15999 | 阅读成本、字段清洗 |
| T07 已登录 fetch | /api/me 仅带 cookie 可访问 | plan = team-pro-2026 | **页面 Runtime 可写性** |
| T08 Shadow DOM | open shadow 里的按钮和兑换码 | SHADOW-99 | 快照穿透、事件注入 |
| T09 扩展 reload | 加载本地解压扩展，需进 `chrome://extensions` 重新加载 | 扩展 reload 成功、特权页可达 | **特权页可达性 / 安全策略** |
| T10 真实登录态与持久化 | GitHub 通知页需真实登录态，并要求跨会话、跨目录恢复 | 免登录读到 68 条未读；专用 profile 可移植恢复 | **复用真实 profile / 跨会话持久化** |
| T11 用扩展（设置页改徽标） | 需进 `chrome-extension://…/options.html` 改设置 | 在扩展设置页成功改掉徽标 | **特权页操作 / 产品封装范围** |
| T12 Console 与 Source Map | bundle 报错，真实源码藏在 sourcemap | `coupon.ts` / `applySelectedCoupon` / 空值 guard | **Console + Source Map 取证** |
| T13 移动端布局遮挡 | 移动端底部帮助条覆盖支付按钮 | `.mobile-support-bar` 覆盖，确认码 `MOBILE-39` | **viewport / hit-test / CSS 诊断** |
| T14 SPA Hydration 不一致 | SSR 状态与客户端接管状态不一致 | `TaskSummary`，`HYD-908`，8→9 / starter→team-pro | **Console 结构化对象 + 页面状态** |
| T15 SSE 实时流等待 | EventSource 分批推送，不能提前读结果 | 5 条，最后 `evt-005`，告警 `STREAM-721` | **实时流等待 / 完成态判断** |
| T16 Service Worker 缓存 | SW 拦截接口，页面看到旧配置 | 旧值 blue/cached，live 值 green/live | **SW 控制面 / Network bypass** |
| T17 跨域 iframe 授权 | 父页 localhost，子 iframe 127.0.0.1 | `iframe-user@bench.dev / OAUTH-314` | **跨源 iframe 操作** |
| T18 文件上传输入 | 标准 file input 需要真实本地文件 | `upload-token.txt`，36 bytes，`UPLOAD-448` | **file chooser / upload 能力** |
| T19 键盘可访问性 | 看似按钮，键盘不可达 | `div role=button` 缺 `tabindex` 和键盘 handler | **键盘遍历 / a11y DOM 诊断** |
| T20 回归稳定性 | 10 次检查里固定 3 次失败 | 7/10，通过率 70%，失败轮次 3/6/9 | **重复执行 / flake 率统计** |

加粗的几道是按 6.2 的边界公式设计的"分界题"——它们恰好把六个工具分成了几个阵营。

真实网站外场任务单独放在 `tasks-real/`，不并入上面的 T01-T20 总分：

| 任务 | 真实网站 | 重点 |
| --- | --- | --- |
| R01 GitHub 公共仓库代码导航 | GitHub | 真实 SPA、代码导航、站内搜索 |
| R02 GitHub 真实登录态只读通知 | GitHub notifications | 真实 profile、只读账号状态 |
| R03 MDN 文档结构化阅读 | MDN | 文档搜索、结构化提取 |
| R04 npm 包页面元数据 | npm | 动态元数据、页面证据 |
| R05 Chrome Web Store 扩展详情 | Chrome Web Store | 插件生态真实页面，只读扩展信息 |
| R06 扩展注入真实网站 | 线上 Garden Lab 文章 | content script、options 页、真实页面注入 |
| R07 真实网站 Network 响应体 | npm | 请求列表、响应体、页面与 JSON 交叉验证 |
| R08 真实网站请求拦截 | MDN | route / abort / mock、资源降级验证 |
| R09 真实网站 HAR 与性能快照 | 线上 Garden Lab 文章 | HAR / trace / 性能瀑布图 |

这组任务的答案不能像 T01-T20 那样全部写死：GitHub 通知数、npm 当前版本、Chrome Web Store 按钮文案、资源耗时都会变。任务卡里写的是"答案生成规则"：必须记录观察时间、最终 URL、profile、工具版本和截图 / Network / trace 证据；任何会写真实网站状态的动作都直接判失败。

正式数据全部来自独立会话：每个单元格（任务 × 工具）由一个全新上下文、既不知道答案也不知道工具已知 bug 的无偏 Agent 执行（Claude Code 无头 `claude -p` 进程或 Codex 隔离子 Agent），提示词只含任务原文、工具限定与约 25 次操作止损线，禁止 curl/读源码旁路，单元格之间重启基准测试站清状态——这样测到的是真实用户要付的成本，而非熟练者的最优解。每个单元格记录判定（✅/⚠️/❌ 按任务卡标准）、操作数、轮数、耗时、成本，以及 **eval 自救次数**（Agent 被迫弃用工具原语、改用 eval 直接执行 JS 才能推进的次数，见 5.2）。需如实声明的局限：每个单元格基本只跑一次（agent-browser 同日两轮），方差未收敛；@chrome/@browser 跑在 Codex 宿主内，时间/调用数只能粗比，但**能力判定不受宿主影响**；基准测试站全在 localhost，版本钉死见附录。R01-R09 外场任务目前只补了任务卡和判定口径，尚未按这一套独立子 Agent 方法跑完，因此不会混入本文总分。

### 4. 逐维度拆解：每道题的结果与边界成因

这是全文核心：逐维度看结果，并用 6.2 的公式把每个 ❌/⚠️ 落到具体是哪个因素造成的。

#### 4.1 页面观察与操作（T01/T05/T06/T08 的 ✅ 半区）：网页面是大家共用的底座

网页面是六个工具都接到的最低一层，纯页面任务全员通过：T01 六家全过，T05/T08 也只有质量差异、没有能力缺口。**六个工具全部采用"可访问性快照 + 元素编号引用"工作流**（@eN / e15 / uid），第 6 节把它列为友好度第一要素，现在可以说它已是事实标准。

但"全过"之下藏着三档工程质量，全部来自动作可靠性：

- **playwright-cli** 继承了 Playwright 引擎的 actionability 检查（点击前自动滚动到可视区、等待可交互）：让 agent-browser 静默空点两次的"视口外 3px 按钮"，它一次命中。
- **agent-browser** 无此检查：CSS selector 路径点视口外按钮**报成功但无事发生**，子 Agent 花 16 条命令自查到坐标问题才用 scrollintoview 解决；走快照 ref 路径则可避开。同一工具两轮 13 vs 26 条命令的方差，全由 Agent 碰巧选了哪条路径决定。
- **bb-browser** 的合成事件注入整体失效（4.5）。

Shadow DOM（T08）同样体现"层与质量"的分离：可访问性树天生跨过 open shadow 边界，所以**六家快照全部看得见**里面的按钮（平台行为，不是工具功劳）；但定位、等待、点击原语是否跟着穿透，各家工程实现差异巨大——MCP/playwright-cli/@chrome/@browser 无感知穿透，agent-browser 的 ref 点击可以但 find 文本定位不行，bb-browser 点不动。

T06 的 ⚠️ 是个有价值的反例：@chrome 把"缺货"徽标拼进了商品名字段。没有结构化提取通道、纯靠可见文本抽取时，展示性元素污染数据字段是常见病——这正是 site adapter 价值的反面教材（见 7.3）。

#### 4.2 Network 响应体（T02）：协议层上限划出的第一道分界线

响应体留底是 CDP Network domain 的能力，扩展 API 层根本没有读取其他请求响应体的接口——@chrome 和 @browser 因此双双 ❌，子 Agent 们能拿到的只有页面错误文案和 console 里的 traceId，状态码和响应体彻底无门；CDP 阵营四家全部 ✅。这条分界比想象中更绝对。

**原因**：@chrome/@browser 的 ❌ 是**协议层上限**——`chrome.webRequest` 只能看请求元数据，读不到 body，这是扩展安全模型的根本设计，产品再封装也变不出来。这是整张总表里最"硬"的一组 ❌。

CDP 阵营内部还有一层封装差异：agent-browser / DevTools MCP / playwright-cli 是**被动留底、事后可查**（点击前不需要任何准备）；bb-browser 把响应体封进了 trace 体系——必须 `trace start` 之后**重放动作**才能 `trace body`，多付一次重放成本。这是**产品封装范围**因素的教科书案例：同一个协议层，封装方式决定了排障的成本结构。bb 换来的独有回报是 trace 时间线带因果关联（`request … trigger:25 → click #order-btn`），"哪个动作引发了哪个请求"这条信息其他五家都给不了。

#### 4.3 性能诊断（T03）：DevTools 产品面的价值被量化，基准测试站被反向修正

性能分析需要的不止 timing 数字，而是"能解释问题的诊断模型"——这是 DevTools 产品面独有的，DevTools MCP 因此最省解释成本，且差距能报出具体倍数：用 `performance_start_trace` + `performance_analyze_insight`（LCPBreakdown/RenderBlocking）6 次调用、111 秒直出结构化的原因分析；agent-browser 没有诊断模型，但 子 Agent 从工具文档自己挖出 `profiler` 命令导出原始 trace、用 python 解析、再用 PerformanceObserver 交叉验证，**结论完全一致**——代价是 215 秒和全场最贵的单个单元格成本。一句话：**MCP 把"解释"内置在工具里，CLI 把"解释"外包给模型**。模型强时殊途同归，弱模型下差距会以失败形式放大。

@chrome/@browser 双 ❌：evaluate 环境里连 `performance` 对象都没有——**安全策略**因素（Runtime 被阉割）顺带砍掉了性能取证的全部入口。

这道题还发生了全评测最有意思的事：**三个独立 Agent 用 trace 证据一致推翻了基准测试站的预设答案**。我出题时写的是"hero.svg（延迟 1.5s）对 LCP 影响最大"，时间线证明：阻塞 CSS（1.2s TTFB）卡住首绘、又按规范卡住其后同步脚本（800ms 长任务），两者**串行** ≈ 2.1s 才是 LCP 真相；hero.svg 与它们**并行**加载、首绘前早已完成，是"看起来最慢但不背锅"的干扰项。"最慢的资源"和"拖慢页面的资源"是两回事。任务卡已修正，"会不会被最慢资源带偏"升格为正式考点——**有标准答案的基准测试站加无偏 Agent，连出题人的错误都测得出来**。

#### 4.4 请求 mock（T04）：三个边界因素在同一道题里同台

这道题把三个边界因素摆进了同一格——

- **agent-browser、playwright-cli ✅**：原生 `network route` / `route`，真正的网络层拦截。
- **DevTools MCP ⚠️**：没有任何拦截工具。CDP 的 Fetch domain 明明支持——这是**产品封装范围**因素：协议有，产品没包。子 Agent 的自救很体面（`navigate_page` 的 initScript 在页面脚本运行前补丁 fetch/XHR），但补丁在 JS 层：mock 跨域接口、abort 流量这类升级需求就绕不过去了。
- **bb-browser ⚠️**：0.14.2 里**没有 `network route` 这类命令**，子 Agent 确认无 mock/intercept 命令后，在页面里直接改写了 `window.fetch`。
- **@chrome/@browser ❌**：扩展层理论上有 `declarativeNetRequest` 可改写请求，但产品没封装，Runtime 又只读连补丁都打不了——**封装范围和安全策略两个因素叠加**，一条路都不剩。

#### 4.5 已登录 fetch（T07）与逃生舱：安全策略因素的明码标价

@chrome 的 `evaluate` 是只读的页面作用域，"Console 式请求"做不了——evaluate 环境里**连 `fetch` 函数都没有**；@browser 同样，子 Agent 试图直接导航到 /api/me 还被策略拦截。四个 CDP 系工具则一句 `eval "fetch('/api/me')"` 解决（页面 Runtime 里发请求自动带 cookie）。

**原因与代价**：这是纯粹的**安全策略**因素。技术上扩展的 content script 完全可以注入任意 JS，OpenAI 有意焊死——因为 @chrome 活在你的真实 Chrome、真实登录态里，可写的 Runtime 意味着 Agent 能以"你"的身份做任何事。所以这格 ❌ 的正确读法不是"@chrome 不行"，而是一笔交易：**真实登录态与 Runtime 可写性，当前你只能二选一。**

这个维度还撑起了整个评测的一个更上层的规律：**eval（可写的页面 Runtime）是所有工具共同的"万能逃生舱"**——凡是页面自己能做的事，eval 都能做。bb-browser 的 click 全坏照样答对 7 题，靠的全是它。而 @chrome/@browser 是六家中唯一没有逃生舱的，于是工具缺陷直接表现为 ❌ 而非成本倍数——总表里 ❌ 集中在这两列的根本原因就在这里。逃生舱也有硬边界：它拿不到"过去"的响应体（那是 CDP Network 层的留底，见 4.2），只能重放请求拿"现在"的、预埋钩子抓"未来"的。

#### 4.6 bb-browser 的事件注入缺陷：不是边界问题，是质量问题

bb-browser 0.14.2 的 `click`/`press Enter` 报告成功但页面事件监听器不触发（fill 写值正常），六个不知情 子 Agent 在登录、翻页、Shadow 按钮等场景独立复现六次，全部被迫 `eval requestSubmit()/el.click()` 自救；叠加 `get value` 返回空、fill→type 值叠加两个独立 bug。注意原因：它站在 CDP 层，**协议上限和封装范围都没问题，这是纯粹的实现 bug**——也因此是六家里唯一"修一个 bug 就能大幅改命"的工具。它的长期价值方向（site adapter + trace 因果链）反而被这轮实测从侧面证明了：通用操作不可靠时，结构化命令和留证排障是更稳的差异化。

另一个同类教训来自版本维度：agent-browser 0.27.0 的 route mock 完全失效、0.27.2 修复——**patch 版本差异足以翻转能力结论**，这类评测必须把版本号钉进结论里。

#### 4.7 扩展安全域与真实登录态（T09/T10/T11）：边界从"页面"挪到"特权页与 profile"

T09–T11 把战场从网页面挪到两个新地方——`chrome://` / `chrome-extension://` 这类**特权页**（T09 调试扩展、T11 使用扩展），和**复用真实登录态 / 跨会话持久化 profile**（T10a/T10b）。它们分别对应边界公式里的"安全策略"和"产品封装范围"，分界线比页面任务画得更清楚。

**T09/T11 扩展：真正的分水岭不是"自带浏览器"，而是"能不能到特权页"。** 只要给 attach 类工具一个**扩展真能跑的浏览器**，分胜负的就是**到达 `chrome://extensions` 和 `chrome-extension://…/options.html` 的能力**，而不是谁自带浏览器。

- **DevTools MCP ✅**：扩展是它的强项区。`--browserUrl` 模式连真实 Chrome 时，要么直接暴露 `list_extensions`/`reload_extension`（Chrome 149 + `--categoryExtensions`），要么退一步在 `chrome://extensions` 页面上下文里调 `chrome.developerPrivate.reload`——两条都能干净走通，options 页也能作为一等 target 操作。
- **playwright-cli ✅**：走自管 persistent context 路线，`launchPersistentContext` 加载本地扩展（注意要用 bundled Chromium 而非 `channel: chrome`，否则又撞企业策略），在自家 chrome://extensions reload、打开 options 页，全链路可控。
- **agent-browser ✅†**：复位 daemon 后能进 chrome://extensions、reload、开 options 页（扩展 ID 走 shadow DOM 的 eval 穿透拿到）——能力存在，但被 `--cdp` 可靠性问题拖累（见下与 7.2）。
- **bb-browser ❌/⚠️**：致命短板暴露无遗——`open`/`goto` 给 `chrome://`、`chrome-extension://` 无脑加 `https://` 前缀并把 `://` 折叠（`chrome://extensions/` → `https://chrome//extensions/` → chrome-error），**自身根本到不了任何特权页**。T11 只能靠外部 CDP 强开 options 页 target 才让 bb-browser 能 fill/click（记 ⚠️）；T09 退用页面内 `chrome.runtime.reload()` 反而把 unpacked 扩展弄成失效态（记 ❌）。继 4.6 的 click bug 之后，这是它第二处"协议层够得着、产品封装却把路堵死"。
- **@chrome / @browser ❌**：和 4.5 同源的**安全策略**因素——Browser Use 的 URL policy 直接拦住 `chrome://` 与 `chrome-extension://`，即使外部把扩展装好也没有 reload/options 通道。它们本身就是扩展，却被产品的封装边界挡在扩展管理之外。

**这里还埋着一个比工具更硬的环境坑：企业管控 Chrome 会让"装了等于没装"。** 目标机器的系统 Chrome 受企业策略管控，把"加载已解压扩展"在运行时拦死——扩展能出现在列表里、显示已启用，但 content script 不注入、扩展自身资源 `ERR_BLOCKED_BY_CLIENT`。这意味着任何"复用你真实 profile 跑扩展"的方案在这类机器上直接失效，扩展测试只能改用干净的 Chrome for Testing（且 137+ 还要 `--disable-features=DisableLoadExtensionCommandLineSwitch` 才认 `--load-extension`，CDP 的 `Extensions.loadUnpacked` 只进注册表、不激活 content script）。这条对"在公司电脑上用 Agent 操作扩展"的现实预期是一盆冷水。

**T10a 真实登录态：@chrome 的主场，但它不再孤独。** 这一格的实情是：

- **能读真实登录态的**：`@chrome`、`bb-browser --port 9223`、`DevTools MCP --browserUrl 9223`——都免登录直达 GitHub 通知页、读到同一个 68 条，零写操作。@chrome 在它**唯一的主场任务**上确实零打断（扩展安全域天然在真实 profile 内）。
- **读不到的**：`@browser`（in-app 浏览器不继承真实登录态）；`playwright-cli`（没有接入系统默认 Chrome 的机制，强行 attach 企业 9223 还会因为枚举到企业扩展的 `service_worker` target 触发 playwright-core 内部断言、daemon 直接崩）。
- **能但不可靠的 agent-browser †**：这是这一组里最意外的一格。`--cdp 9223` 看似连上了，实际动作经常**静默落到 agent-browser 自起的托管浏览器**（一个没有你登录态的空白 headless Chrome）；`get url` 还返回 github，像成功，实则没碰你的真身。两轮独立实测都撞到：Codex 据此判 ❌（坚持"开箱即用必须命中 9223"），主控这轮先 `close --all` + 杀掉托管实例复位，才真连上 9223、读到 68（判 ✅）。**同一个 bug，两种评分口径**——根因都是 7.2 那个粘滞 daemon。

**T10b 持久化：可移植状态文件完胜。** agent-browser 与 playwright-cli 在这里打平，第三、第四名的机制差异也讲清楚了：

- **agent-browser ✅ / playwright-cli ✅**：两者都有**可移植状态文件**（`state save/load` / `state-save/load`）。机制上打平，差别只在 ergonomics——agent-browser `--state <file> open <url>` 一步式（加载先于导航，零踩坑）；playwright-cli 必须"先 open 再 state-load 再 goto"（直接带状态文件启动会报 browser is not open）。两者一次命中、免登录读到 68。它们稳的根因是：状态文件存的是 **CDP 拿到的明文 cookie**，不依赖浏览器磁盘上的加密，跨会话、跨目录、跨实例都能用。
- **DevTools MCP ✅\***：走"复用同一持久 userDataDir"的隐式路线，没有可移植 state 文件，"换目录就丢"（复制 profile 即撞登录墙），而且依赖浏览器 on-disk cookie 加密可用——本机 CfT 因无 keychain，连原地复用都丢，要 `--use-mock-keychain` 兜底才持久。
- **bb-browser △**：持久化维度最弱——**自身没有任何 state save/load，也没有 cookie 导入**（只有只读的 `cookies` 查看）。它能读到登录态，完全是 attach 了一个别人维持登录的持久浏览器，自己既不产出也不保存状态。

一句话收束这三题：**T09/T11 把"能不能到特权页"立成扩展场景的真分水岭（bb-browser 在此失能）；T10a 坐实 @chrome 的真实登录态主场、也暴露 agent-browser `--cdp` 的可靠性硬伤；T10b 证明可移植状态文件（agent-browser/playwright-cli）比 userDataDir 依赖更稳。**

#### 4.8 前端专项（T12-T20）：DevTools MCP 和 playwright-cli 拉开第二梯队

T12–T20 是我后来补的一组前端开发者专项题。它们的目标不是再证明"能不能点按钮"，而是把前端日常排障里的证据链补全：console 对象、source map、移动端 hit-test、hydration mismatch、EventSource 等待、Service Worker 控制面、跨源 iframe、真实文件上传、键盘可访问性和 flake 率统计。

这一组把结果重新拉开了：

- **DevTools MCP 9/9 ✅**：最像前端熟悉的 F12。T12 能从 console/network/source map 追到 `webpack://bench/src/cart/coupon.ts`；T16 能把"页面旧值"和"绕过 SW 的 live 值"拆开；T18 能走真实 file input；T19 能把键盘不可达落到 DOM/ARIA/CSS 原因。它的短板也更清楚：复杂 CSS hit-test、Service Worker 绕行、文件 input 异步状态这类问题，仍然常要 `evaluate_script` 做底层诊断。
- **playwright-cli 9/9 ✅**：自动化质量同样满分，file chooser、键盘、iframe、等待都很稳。它的问题不是能力弱，而是气质不同：更像把场景写成可重复测试；如果你正在排一个线上 bug，DevTools MCP 的 console/network/trace 心智模型更顺手。
- **agent-browser 9/9 ✅，但 7 题带 `*`**：连上 9223 之后答案全对，T17/T18 还很干净；但 T12/T14 的 console 展开、T15/T20 的按钮触发、T19 的 focus/keyboard 都需要 eval 补齐。它适合复用常驻 profile 做流程操作，不适合被当成"纯前端调试面板"。
- **bb-browser 9/9 ✅\***：这轮答案也全对，但必须把星号读大——原生命令受端点漂移影响，最后靠同一 bb profile 的 CDP/eval 逃生完成。它证明"这份 profile 里的浏览器能完成"，不能证明"bb-browser 原语能完成"。
- **@browser 5✅3⚠️1 N-R**：普通 DOM、iframe、SSE 完成态、可访问性、表格统计都能做；但 raw asset/source map 被拦、Service Worker live bypass 拿不到、文件上传没有 API。它适合轻量观察，不适合完整前端调试。
- **@chrome 9 N-R**：本轮不是网页任务失败，而是 Codex Chrome Extension 在 selected profile 中 disabled，runtime 不可用。公平起见没有用其他工具代跑。

这组补测把第 2 节的推荐从"理论上更像 F12"变成了"实测九个前端专项仍然第一"：**DevTools MCP 是前端排障首选；playwright-cli 是自动化回归首选；agent-browser 是真实 profile 流程操作的补充；@browser/@chrome 受宿主策略限制，不适合作为完整调试工具。**

### 5. 跨工具规律：比单格结论更长寿的部分

1. **强模型把工具缺陷变成成本倍数，而不是失败**。有逃生舱的四家答案正确率几乎满分，差距体现在 1~2.5 倍操作数和时间。前提有二：模型强到能想出绕行方案；逃生舱存在。给弱模型选工具时应更看重原语可靠性而非能力上限。
2. **eval 自救次数是一行就能算的工具体检值**：前八道网页题里，playwright-cli 0 < agent-browser 1 < DevTools MCP 3 < bb-browser 7（单元格全覆盖）< @chrome/@browser（无逃生舱，直接 ❌）。T12–T20 又补了一层：DevTools MCP 和 playwright-cli 虽然都 9/9，但 DevTools MCP 在 hit-test、SW、文件状态诊断里仍会用 `evaluate_script`；agent-browser 9 题里 7 题要靠 eval 补齐；bb-browser 全靠 CDP 逃生。这个序基本就是"原语质量 × 能力覆盖"的序——逃生舱被迫用得越勤，正规命令质量越差。
3. **静默失败是 Agent 最大的敌人**。本轮最贵的时间黑洞全部来自"报成功但无事发生"（bb 的 click、agent-browser 的视口外点击）：Agent 看到"已点击"不会怀疑工具，会先怀疑自己，然后烧轮次验证一切。对工具作者：动作后验证状态、失败就明说，比十个新功能都值钱。
4. **粗粒度组合动作 vs 细粒度原语**。DevTools MCP 用一半操作数完赛（fill_form 一次填整张表、wait_for 等待确认合一），但预想流程之外就得绕路；CLI 细原语常规路径多走几步，却能拼出作者没想到的流程。微软给 playwright-cli 的官方定位（"CLI 给高吞吐编码 Agent，MCP 给持久状态场景"）与实测互相印证。
5. **无偏成本约为熟练者的 2~4 倍**。评测报告里的数字应该以无偏 Agent 为准——那才是真实用户要付的价格。
6. **会不会"后台静默运行、不打扰你"，取决于驱动哪个浏览器，而不是工具本身**。让工具用**自管/无头实例**（playwright-cli headless、DevTools MCP 默认、agent-browser 默认托管浏览器、@browser）时，它天然在后台，零打扰；一旦用 `--cdp` / `--port` / `--browserUrl`（或 @chrome）**接管你正在用的真实 Chrome**，干扰就来自**焦点而非物理设备**：CDP 的合成事件不占用你的物理键鼠（光标不会乱跑、在别的应用打字本身不受影响），但只要你和 Agent **同时活动在同一个 profile**，就会出现三种撞车——`bringToFront`/导航当前页把 **tab 切走**、`focus()`/点击输入框把 **DOM 焦点移走（你打字进错框）**、点到"发送/保存/删除/标记已读"把**账号状态静默改掉**；此外 Agent 开新窗口或抬高 Chrome 还可能夺走 **OS 窗口焦点**，让你接下来的键击落进 Chrome。隔离办法只有一个：**分 profile / 独立窗口 / 无头**，把你和 Agent 的"焦点战场"分开（接专用调试 profile 而非你的日常主 Chrome）。

## 三、底层原理：想深挖的人再看

### 6. 能力分层与边界公式：能力从哪一层来，边界由什么决定

#### 6.1 浏览器有哪几个部位，工具又接到哪个入口

先从你能在 Chrome 里指着说出来的部位看起——浏览器大致由下面这几块组成，光是"每块谁够得着、卡在哪"，就已经能解释总表里的大半结果：

| 浏览器部位 | 具体是什么 | 谁能完整拿到 | 难点 / 谁够不着 |
| --- | --- | --- | --- |
| 网页内容 | DOM、页面 JS runtime、输入、shadow DOM、可访问性快照、页内 fetch | 六家公共底座，全员能读能点 | @chrome/@browser 的 runtime 只读，连 `fetch` 都没有 |
| 前台 tab / 窗口 / popup | 多 tab、新窗口、popup 弹出窗口（`window.open` 出来的独立网页窗口，如 OAuth 登录窗）¹ | 六家全员 ✅——四个 CDP 工具（agent-browser、bb-browser、DevTools MCP、playwright-cli）走 Target 域枚举切换，@chrome / @browser 走 `chrome.tabs` 管多 tab；这是基线能力，没有区分度 | 无实质短板，差别只在体验（@browser 是 in-app webview，独立窗口/popup 不如其余顺手） |
| 后台 target | 扩展的 service worker / background page——不在任何 tab 里的后台 JS 环境 | 只有自管浏览器的 agent-browser、DevTools MCP、playwright-cli（自管 context）够得到（走 CDP 的 Target 域枚举/attach） | @chrome / @browser 的扩展 runtime 只认 tab、看不见后台 target；playwright-cli 一旦改成 attach 企业 Chrome，枚举到扩展的 service_worker target 反而触发内部断言、直接崩（自管时没问题） |
| 扩展 + 特权页 | 扩展本体、`chrome://extensions`、`chrome-extension://…/options.html` | DevTools MCP、playwright-cli（自管 persistent context） | @chrome/@browser 被 URL 策略拦在 `chrome://` 外；bb-browser 把特权页 URL 归一化堵死；企业管控 Chrome 还让"装了等于没装" |
| 身份 / 档案 | 登录态 cookie、书签、历史、保存的密码 / 证书 | @chrome、`bb-browser --port`、`DevTools MCP --browserUrl`（直连真实 profile） | @browser/playwright-cli 接不进系统默认 Chrome；真实默认 profile 的远程调试被 Chrome 136+ 收紧 |
| 跨会话持久化 | 把身份存下来、搬到别处、恢复（可移植 state 文件 vs 绑定 userDataDir） | agent-browser、playwright-cli（可移植 state 文件，跨目录跨实例） | DevTools MCP 只能复用同一 userDataDir、换目录就丢；bb-browser 无 save/load |
| 调试与诊断 | 读：network 响应体留底、console、performance/trace；写：请求拦截 / mock / abort | 读靠 CDP 系四家；写（网络层 route）只有 agent-browser、playwright-cli | @chrome/@browser 无响应体、无 `performance` 对象；DevTools MCP、bb-browser 无网络层拦截，只能在 JS 层打补丁 |

> ¹ 这里的 popup 专指 `window.open` 的独立网页窗口，**不含 alert/confirm 这类原生对话框**——后者是页面触发、却在 DOM 之外、只能由 CDP 的 Page/Browser/Fetch 等 domain 单独处理的模态框，另算一种薄控制面。

为什么同一个部位，有的工具能完整拿到、有的只能拿到残缺版、有的彻底碰不到？因为工具的本质区别在于**它从哪个入口接进浏览器**——入口决定了它站在哪一层、拿到的是原始能力还是被封装 / 阉割过的子集：

| 能力面 | 典型入口 | 天生擅长 | 天生短板 |
| --- | --- | --- | --- |
| 网页面 | DOM、页面 JS Runtime | 点击、输入、读页面、页内 fetch | 只能看到页面自己暴露的东西 |
| Chrome 扩展面 | `chrome.*` extension API | 真实 profile、真实登录态、书签历史 | 受扩展权限模型约束，无 Network 响应体、无 trace |
| CDP 调试面 | Chrome DevTools Protocol | Network 留底、请求拦截、Runtime、Tracing | 权限极强，安全边界敏感（Chrome 136+ 收紧） |
| DevTools 产品面 | DevTools / Lighthouse 的诊断模型 | 性能定位、LCP 分解、瀑布图洞察 | 围绕"被调试页面"，需自管浏览器 |
| 站点适配面 | site adapter | 把具体网站封成结构化命令 | 与网站结构强绑定，要维护 |

这两张表是同一件事的两种切法：上表按**浏览器部位**切（你能指着说出来的东西，回答"工具碰得到哪几块"），下表按**工具入口**切（回答"碰到的是完整版还是残缺版、为什么"）。数目对不上是正常的——同一个部位会被不同入口以不同成色覆盖：比如"调试与诊断"这一块，从入口看就分成了 CDP 原始数据面和 DevTools 解释面两层；而"扩展 + 特权页"既可能从扩展面接、也可能从 CDP 面强开。

这里最容易混的是 **CDP 调试面**和 **DevTools 产品面**：CDP 给的是底层的原始数据和操作能力（原始 trace、原始网络事件，还能下点击、导航这类命令）；**DevTools 产品面则是在 CDP 原始数据之上、由 Chrome DevTools 和 Lighthouse 做的分析 / 解释层**——把原始 trace 算成"LCP 2.1 秒、主因是阻塞 CSS"这种能直接读的诊断结论。打个比方：CDP 给你体检的原始数值，DevTools 产品面给你医生的诊断报告。

六个工具的站位：

| 工具 | 主要站位 | 形态 |
| --- | --- | --- |
| @chrome / @browser | 扩展面（且只暴露其中的页面可见子集） | 宿主内插件 |
| agent-browser | CDP 调试面（瘦 CLI + 常驻原生 daemon 连 CDP，可 connect 任意 CDP 目标） | CLI + 常驻 daemon |
| bb-browser | CDP 调试面 + 站点适配面 | CLI |
| Chrome DevTools MCP | CDP 调试面 + DevTools 产品面 | MCP server |
| playwright-cli | Playwright 引擎（CDP/BiDi 之上的自动化层） | CLI |

注意 playwright-cli 这一行：它的底座其实仍是 CDP/BiDi，只是 Playwright 在其上自封了一层跨浏览器的自动化引擎（Locator、自动等待等浏览器原生没有的能力），你直接面对的是这层引擎而不是裸 CDP，所以单列而没归进「CDP 调试面」。

#### 6.2 边界公式的三个因素

站位只决定**上限**，实际能力还要再砍两刀：

1. **协议层上限**：所在层的协议根本没有这个能力。例：扩展 API 里没有任何接口能读到其他请求的响应体（`webRequest` 只能看元数据）——这是最硬的边界，产品再努力也封不出来。
2. **产品封装范围**：协议有，但工具没包成命令。例：CDP 的 Fetch domain 支持请求拦截，但 chrome-devtools-mcp 没有暴露 mock 工具——边界是产品选择，不是协议限制。
3. **安全策略**：协议有、产品也能做，但有意焊死。例：@chrome 活在用户真实 Chrome 里，把 evaluate 阉割成只读、环境里连 `fetch` 都不给——这是"复用真实登录态"这个卖点旁边必须立的防火墙。Chrome 136+ 对默认 profile 的 remote debugging 收紧、144+ 的逐会话确认，属于浏览器厂商在同一因素上的动作。

#### 6.3 Agent 友好度：决定"考什么"

层和边界决定能不能做；Agent 友好度决定做起来顺不顺。前面定义的维度——看懂页面、稳定引用（@eN ref）、动作后复盘、复用真实状态、看请求和错误、性能诊断、结构化输出、风险控制——直接翻译成了基准测试站的八道题。

### 7. 各工具实现原理：边界到底来自哪里

前五节用"站在哪一层 + 三个因素"解释了每个 ✅/⚠️/❌。这一节再往下钻一层，把六个工具的内部实现讲清楚：它们各自怎么连上浏览器、用什么把能力包装出来、为什么会出现前面看到的那些边界。读完这一节，前面总表里每一格的结果，都能对应到具体的代码机制。

#### 7.1 Codex `@chrome` / `@browser`：被层层安全约束收口的能力

`@chrome` / `@browser` 对应 Codex 的 Browser Use 能力，接的是 Codex 自带的内置浏览器那一层，而不是直接驱动你系统里的 Chrome。从公开代码能推断出的执行链路是这样：Agent 跑在一个受限的执行环境里，自己并不直接握有浏览器控制权，而是通过一条本地 Unix socket（线索是 `/tmp/codex-browser-use`）和一个独立的浏览器控制进程通信，由后者真正去管标签页、截图、读页面、执行动作。

它没有完整开源——这点要先讲清楚，因为它直接决定了我们能断言到哪一步。截至写作时，公开的 `openai/codex` 仓库里搜不到 Browser Use 的本体：没有相关插件目录、没有浏览器运行时、没有 `agent.browser.*` 这类浏览器 API 的实现，也没有"内置浏览器后端如何接动作、管标签页、截图、生成页面快照"的源码，开源的只是承载它的那层平台。能找到的最硬的几条公开证据是：其一，`codex-rs/features/src/lib.rs` 把 `BrowserUse` 和 `InAppBrowser`、`ComputerUse` 并列定义成一等能力（标为稳定、默认开启），但它是个"只认远端配置"的开关——最终开不开由组织、产品、账号的远端配置说了算，这正好解释了为什么同一个版本的 Codex 在不同账号下能力会不一样；其二，Codex 的插件系统本身是开源的，一个插件可以同时贡献 skill、MCP server 和 app 三类能力，Browser Use 最合理的落点就是一个随 App 一起分发的内置插件；其三，沙箱测试 `seatbelt_tests.rs` 专门把 `/tmp/codex-browser-use` 这条 Unix socket 加进了 macOS 沙箱的放行名单——如果它只是普通网页请求或屏幕级点击，根本不需要专门放行一条名字这么明确的本地通道。

这套"安全收口为先"的实现取向，正是前面那一串 ❌ 的根源：能力被一层层关进能力开关、远端配置、沙箱放行名单里，动作只能经受控后端代为执行，于是它天然只能在页面可见的范围里活动、`evaluate` 偏只读——4.5 那笔"真实登录态和可写运行时只能二选一"的交易，在代码层面就是这么焊死的。需要强调：以上是从公开代码推断出的边界，不等于对官方实现细节的证实，真正驱动浏览器的那层代码并不在公开仓库里。另外，Browser Use 和 Computer Use 是两条不同的路径——前者贴着浏览器运行时，对象是标签页、DOM、页面结构，对网页语义理解更细；后者贴着操作系统界面和截图，能跨任意应用，但对网页内部状态没那么精细。

#### 7.2 agent-browser：Rust 瘦 CLI + 常驻原生 daemon（直连调试协议）

agent-browser 是用 Rust 写的，对外是一个瘦 CLI、背后挂一个常驻原生 daemon 替它连 CDP（Chrome 的调试协议），而且能 `connect` 到任意一个调试目标——实测里我用一个本地 Electron 应用验证过 `--cdp` 连接的完整流程。它的快照短、元素引用稳、长对话省 token，网络请求被动留底事后可查；在八道题里拿到满分、全程只被迫用了一次 eval 兜底。

**它的架构是瘦 CLI + 常驻 daemon**：0.27.2 起有一个常驻 daemon，是一个**编译后的原生二进制** `agent-browser-darwin-arm64`（不是 node 进程，按 node/daemon 关键字搜不到、容易漏看），脱离父进程挂到 init（PPID=1）、长期常驻、监听 unix 域套接字 `~/.agent-browser/default.sock`，并配 `default.pid` / `default.engine`（值为 `chrome`）/ `default.version`（值为 `0.27.2`）这套标准 daemon 文件。也就是说 agent-browser 的 CLI 是**瘦客户端**，每条命令经 `default.sock` 发给这个常驻 daemon，由 daemon 持有"当前会话绑在哪个浏览器"的状态——和 bb-browser 的形态接近，区别在于它是 Rust 原生二进制、socket 走 unix 域而非本地 HTTP 端口。

这个 daemon 直接解释了 4.7 里 agent-browser `--cdp 9223` 的可靠性硬伤：**daemon 持有的会话是粘滞的**。一旦它之前把 default 会话绑到了自起的托管浏览器（一个空白 headless Chrome），后续即使带 `--cdp 9223`，daemon 也不会可靠地把目标切过去，命令静默落在旧绑定的托管浏览器上——`get url` 还返回你要的页面，像成功，实则没碰真身。复现核验很直接：`open` 一个唯一 URL 后 `curl http://127.0.0.1:9223/json` 找不到它、却在 agent-browser 自管 Chrome 的端口上找得到；进程命令行显示那是个 `--user-data-dir=/tmp/agent-browser-chrome-* --headless=new` 的临时实例。要可靠复用真实 profile，实践中得每次先 `tab` 确认目标、不对就 `close --all`（必要时连 daemon/托管 Chrome 一起 `pkill`）再重连。**这是一个实打实的"Agent 友好度/可控性"扣分项**：静默落到错的浏览器，比明确报错更难发现（呼应第 5 节"静默失败是 Agent 最大的敌人"那条）。它和 bb-browser 在链路上的差别，见 7.3。

#### 7.3 bb-browser：后台常驻进程 + 调试协议 + 站点适配器

bb-browser 同样站在 CDP 调试层，但形态和 agent-browser 完全不同。它对外有三个入口——CLI、MCP server、provider（给上层框架注册用），但这三个入口谁都不直接连 Chrome，而是统一汇到一个常驻的后台进程（默认监听 `127.0.0.1:19824`）。这个后台进程才是核心中转站：它维持着和 Chrome 的唯一一条调试长连接、记录每个标签页的状态、持续监听网络/控制台/报错事件，再把各入口发来的命令翻译成调试协议调用。这样 CLI、MCP、provider 就都不用各自再实现一遍浏览器连接和标签页管理。

画成链路图，bb-browser 和 agent-browser 其实很像——**两边都有一层常驻 daemon 中转、都持有粘滞会话**，区别只在 daemon 的实现形态（原生二进制 + unix socket vs node + 本地 HTTP 端口）：

```
agent-browser（Rust 原生二进制 daemon，走 unix socket）
  Agent 发命令
    → agent-browser CLI（瘦客户端）
    → unix socket（~/.agent-browser/default.sock）
    → daemon（常驻原生二进制 agent-browser-darwin-arm64，PPID=1，持有当前会话绑定 + CDP 连接）
    → Chrome 的 CDP 端口（粘滞会话若绑到自起的托管浏览器，--cdp 切换不可靠，见 4.7 / 7.2）

bb-browser（node daemon，走本地 HTTP 端口）
  Agent 发命令
    → bb-browser CLI（瘦客户端）
    → 本地 HTTP（127.0.0.1:19824）
    → daemon（常驻，持有唯一 CDP 长连接 + 各 tab 状态）
    → Chrome 的 CDP 端口
```

它最有标志性的一句话是"你的浏览器就是 API"。意思是：网站本来就是给浏览器用的，那就让 Agent 直接进到真实的标签页上下文里执行代码——于是发出的请求天然带着当前账号的 Cookie 和本地存储，页面的前端运行时和状态也都在，Agent 可以直接调同源接口、复用页面自己的请求封装，不必非得去解析界面。这也正是 4.5 里它点击功能整个坏掉、却还能靠 eval 答对 7 道题的底气来源。

几个关键机制值得点出来。一是登录态复用：它默认连的不是你日常那个 Chrome，而是它自己管的一份独立配置档（`~/.bb-browser/browser/user-data`）。原因是 Chrome 从 136 版起出于安全考虑，不再允许对默认配置目录开远程调试端口，所以"复用登录态"的准确含义是——在这份受管配置档里登录一次，之后每次启动都继续用这份持久化下来的 Cookie。二是统一协议：所有动作都抽象成同一套请求/响应结构，再由一张命令注册表用 schema 描述每个命令，三个入口因此能从同一份元数据自动生成。三是元素引用：后台进程往页面里注入一段脚本，把 DOM 和可访问性信息转成带编号的文本快照（类似 `button [ref=5] "提交"`），Agent 用编号点击，后台再把编号解析回真实节点、通过调试协议派发鼠标事件——4.5 那个点击不生效的 bug 就出在这条事件派发链路上，属于实现层面的 bug，不是能力边界。

它真正的两个差异化，前面实测已经从侧面印证过。一个是站点适配器：一个适配器就是一个带元数据头的 JS 文件，按域名匹配到标签页后，把函数体注入真实页面里执行，从而复用页面的登录态和前端逻辑，把高频网站的某项能力沉淀成一条稳定命令（比如"取某站热榜"）。另一个是观察能力：后台进程给每个标签页维护一圈固定容量的事件缓存（网络最多 500 条、控制台 200 条、报错 100 条），每个事件都有递增编号，每次主动动作都会记下当时的编号，于是 Agent 能做"只看上一个动作之后发生了什么"的增量排查，并把动作和它引发的请求关联成一条因果链——这就是 4.2 里那条独有的"动作↔请求"因果信息的来源。一句话：bb-browser 真正抽象的不是"点按钮"，而是"登录之后的那个互联网"。

#### 7.4 Chrome DevTools MCP：把 DevTools 的整套调试流程包成工具

Chrome DevTools MCP 是一个本地 MCP server，靠进程的标准输入输出和 Agent 通信，接管的是浏览器的"调试会话"那一层。它的启动入口很薄，真正的逻辑在 `createMcpServer`；而且浏览器是懒启动的——只列工具清单时不会把 Chrome 拉起来，等第一个真正要操作浏览器的工具被调用时才启动或连接。它的执行底座不是自己手写调试协议，而是直接用 Puppeteer，由 Puppeteer 负责启动、连接、开页面、定位元素、录性能轨迹、截图这一整套。

它对 Agent 友好的关键在中间这层"上下文"对象：它把当前有哪些页面、每个页面的网络和控制台记录都持续收集成可读的状态；元素定位走语义而不走坐标——读取页面的可访问性树，给每个节点分配一个跨快照都唯一的编号，之后点击、填表都按这个编号找回元素，从而不受窗口尺寸、滚动、缩放的影响。动作之后它还有一道"等稳定"的机制：监听导航是否完成、往页面注入观察器，等 DOM 短暂稳定下来才返回，这样模型下一步不会看到一个还在变的半成品页面。所有工具都收敛成统一的定义结构（参数用 schema 描述加一个处理函数），注册时在外面套了一层统一治理：按开关决定暴露哪些工具、用一把全局锁把调用串行化（避免并发的点击/导航/截图互相打架）、用完即转成 MCP 能读的内容并记录耗时。

它最大的差异化是性能分析。它不自己造一套指标解释器，而是直接复用了 Chrome DevTools 前端代码里那套轨迹分析引擎和洞察生成器——也就是说，它录下性能轨迹后，能直接拿到 DevTools 自己用的那套分析结论（比如 LCP 的分解、渲染阻塞的诊断），而不只是一堆原始时间数字。这正是 4.3 里它只花 111 秒就直接给出结构化原因分析的来历：别的工具得靠模型自己去推，它把"解释"内置进了工具里。另外它输出时也很克制——网络和控制台记录分页展开、大截图和性能轨迹走文件引用而不是整块塞进上下文，既省 token 又不会把大段字节糊到模型脸上。一句话：它封装的不是"浏览器 API"，而是 Chrome DevTools 原本给人用的那整套调试流程。

T12–T20 补测也暴露了它的反面：DevTools MCP 是一个**调试面**，不是一个无所不包的高级自动化产品。遇到移动端遮挡、Service Worker 绕行、文件 input 异步状态这类"DevTools 面板里也会打开 Console 自查"的问题，它会自然滑向 `evaluate_script`：用 hit-test 查覆盖元素、读 `navigator.serviceWorker.controller`、检查 `input.files`。这不算作弊，前端排障本来就会这么做；但它说明 DevTools MCP 的优势是**拿到底层证据并让 Agent 会查**，不是保证每个业务动作都有一条无脚本的一键命令。要做长期 CI 回归时，playwright-cli 那种 actionability、断言、trace 和隔离上下文仍然更合适。

#### 7.5 playwright-cli：把 Playwright 引擎装成一个工程化总入口

playwright-cli 站在 Playwright 引擎之上（这个引擎本身又架在调试协议 / BiDi 之上）。它的能力分在三个包里：`playwright-core` 提供核心自动化和 open/codegen/screenshot/install 这些基础命令，`playwright` 在它之上叠加测试相关命令，`@playwright/test` 再往上是最常用的测试入口。三个包的 bin 文件都几乎没有逻辑，本质就是拿到一个已经装配好的命令对象、再把进程参数丢给它分发；命令是分两层挂上去的——先注册核心的浏览器和安装命令，再补上测试和报告命令。所以只装核心包时，它能当一个不带测试框架的纯自动化工具用。

它内部最值得说的，是把"命令行参数"统一降维成"配置覆盖"：跑测试时，`--headed`、`--trace`、`--retries`、`--project` 这些参数不会各自散进执行逻辑，而是先整理成一份覆盖项，再和默认配置、配置文件、项目级配置合并成唯一一份完整的内部配置对象，后面所有环节只面对这一个对象。真正执行时它用一条任务链来描述整个生命周期（全局准备 → 收集并过滤出一棵稳定的测试树 → 切成可并发的执行单元），并按项目依赖拆成一个个阶段来调度，而不是把所有测试粗暴地丢进一个并发里跑：相同环境的执行进程能复用以省启动成本，一旦出错就果断重启那个进程、避免状态污染到后面的测试。

它在前面实测里"一次就点中视口外那个只露 3 像素按钮"的可靠性，来自引擎的两个核心设计。一是动作前的可执行性检查（actionability）：点击、填写之前，引擎会自动确认元素是不是存在、可见、不再移动、可交互、点击点没被浮层挡住——本质是把"一个真人此刻能不能完成这个动作"编码进了动作模型，从根上消掉了靠手写死等待带来的偶发失败；配套的断言也会自动重试到成立或超时。二是它的元素定位是一条"怎么找这个元素"的可复用规则，而不是某一刻的一次性节点引用，所以即便页面中途重新渲染、换掉了旧节点，它执行时也会按最新的 DOM 重新找回来。此外，它还新增了启动 MCP server、初始化 agent 配置这类入口，使它同时能被人、CI、MCP 和 agent 调用——这也正是"playwright-cli 补齐了快照/引用/自动等待、综合成绩全场最佳"在工程上的来源。一句话：playwright-cli 封装的不是一层命令行外壳，而是把一个可靠的浏览器自动化引擎，组织成可安装、可录制、可调试、可并发、还能接进 CI 和 agent 流程的工程化总入口。

## 下一步

- 扩展与真实 profile 那几道（T09–T11）受环境影响最大（企业管控 Chrome），值得在更多机器上复测取证；它们也确认了 agent-browser 0.27.2 有常驻 daemon。
- 增加每个单元格重复次数收方差；引入弱一档模型验证 5.1 的预言。
- T12–T20 这组前端专项已经覆盖了主要调试面；真实网站侧已经补了 R01-R09 外场任务，下一步应按每工具一个独立子 Agent 跑完，特别看 Chrome Web Store、扩展注入真实页面、真实 Network 响应体、route / abort、HAR/trace 这几类。
- 靶场侧仍可继续补原生 dialog、下载、拖拽、多窗口 OAuth popup、WebSocket 二进制帧；这些应留在可控靶场里，避免真实账号授权和下载状态污染结果。
- 把扩展宿主的搭建本身做成可复现脚本（企业策略检测 → 干净 CfT + 正确 feature flag），因为 T09–T11 里"让扩展真能跑"比测工具本身更费劲。
- 值得上游提 issue：bb-browser 事件注入缺陷 + `chrome://`/`chrome-extension://` URL 归一化把特权页堵死；**agent-browser 粘滞 daemon 致 `--cdp` 静默落到自起托管浏览器**（4.7/7.2）+ 视口外静默点击 + Electron 下 connect 会话失灵；playwright-cli 不验证响应结构就 mock + attach 多扩展真实 Chrome 时 service_worker target 断言崩溃。

## 附录：基准测试站、数据与版本

- 基准测试站与任务卡：`apps/browser-tool-bench/`（零依赖 Node 测试站 + T01-T20 固定任务卡 + `tasks-real/R01-R09` 真实网站外场任务卡 + 复现步骤）
- 原始数据（T01-T08）：`results/formal-2026-06-12/`（ab vs bb）、`results/formal-2026-06-12-mcp/`（ab vs DevTools MCP）、`results/formal-2026-06-12-pw/`（playwright-cli）、`results/codex-plugins-2026-06-12/`（@chrome/@browser，Codex 宿主）
- 原始数据（T09/T10/T11，2026-06-14 两轮独立实测）：`results/formal-2026-06-14-t09-t11-rerun/`（Claude Code 主控，含 4 工具报告 + t10b + 证据 + 环境搭建笔记）、`results/formal-2026-06-14-t09-t11-rerun-fixed-env/`（Codex 主控，含 @chrome/@browser）；两轮结论一致，差异仅评分口径（见 4.7）
- 原始数据（T12-T20，2026-06-19 前端专项）：`results/frontdev-2026-06-19-t12-t20/`（每个工具一个 subagent，含六份工具报告与总报告；实际靶场端口为 `4400`）
- 外场任务（R01-R09，待跑）：`tasks-real/`（GitHub、MDN、npm、Chrome Web Store、真实扩展注入、Network 响应体、请求拦截、HAR/trace；动态答案按当次证据判定）
- 版本：agent-browser 0.27.2 · bb-browser 0.14.2 · chrome-devtools-mcp 1.2.0 · playwright-cli 0.1.14 · Chrome 149（T09/T11 扩展宿主用 Chrome for Testing 149）· 模型 claude-fable-5 / claude-opus（T09–T11 轮）/ Codex 宿主
### 参考

- [agent-browser](https://github.com/vercel-labs/agent-browser)
- [bb-browser](https://github.com/epiral/bb-browser)
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [playwright-cli](https://github.com/microsoft/playwright-cli)
- [Playwright actionability checks](https://playwright.dev/docs/actionability)
- [Chrome extensions webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [Chrome DevTools Protocol: Network domain](https://chromedevtools.github.io/devtools-protocol/tot/Network/)
- [Chrome DevTools Protocol: Fetch domain](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/)
- [Chrome remote debugging switches security change](https://developer.chrome.com/blog/remote-debugging-port)
