---
title: "浏览器 Agent 工具：能力分层理论 × 六工具八任务实测"
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
excerpt: "把理论和实测装进同一篇：先用浏览器能力分层和安全域解释每个工具的边界从哪来，再用一个有标准答案的靶场、互相隔离的无偏 Agent session 实测 @chrome、@browser、agent-browser、bb-browser、Chrome DevTools MCP 和 playwright-cli。矩阵里每个 ✅/⚠️/❌ 都能被理论解释，每条理论断言都被数据裁决——证实五条，推翻三条。"
---

## 摘要

判断一个浏览器 Agent 工具，问一个问题就够了：**它能让 Agent 多容易地完成任务？**

我之前写过一篇理论文章，从"Agent 友好度"和浏览器能力分层的角度推演各工具的边界。但推演终归是断言。这篇文章把理论和实测装进同一个框架里：

- **理论负责解释**：每个工具站在浏览器的哪一层、被什么安全域约束，决定了它"天生能做什么、天生做不了什么"；
- **实测负责裁决**：一个每道题都有标准答案的本地靶场、八个任务、六个工具、互相隔离且不知道答案的独立 Agent session——理论断言被证实五条、推翻三条，靶场自己的预设答案还被 Agent 用 trace 证据修正了一处。

被测六个工具：Codex `@chrome`、Codex `@browser`、`agent-browser`、`bb-browser`、`Chrome DevTools MCP`、`playwright-cli`。靶场、任务卡与全部原始数据在仓库 `apps/browser-tool-bench/`，可复现。

全文的主线是一个从实测里提炼出来的公式：

> **工具实际能力 = min(协议层上限, 产品封装范围, 安全策略)**

矩阵里每一个 ❌ 和 ⚠️，都能归因到这三个因素中的一个。后文逐格验证，并在第 6 节把每个工具的源码实现原理一并收进来——让矩阵里的每条边界都能落到具体代码。

## 1. 理论：能力从哪一层来，边界由什么决定

### 1.1 浏览器的五个能力面

所有"让 Agent 操作浏览器"的工具，本质区别在于接到了浏览器的哪一层：

| 能力面 | 典型入口 | 天生擅长 | 天生短板 |
| --- | --- | --- | --- |
| 网页面 | DOM、页面 JS Runtime | 点击、输入、读页面、页内 fetch | 只能看到页面自己暴露的东西 |
| Chrome 扩展面 | `chrome.*` extension API | 真实 profile、真实登录态、书签历史 | 受扩展权限模型约束，无 Network 响应体、无 trace |
| CDP 调试面 | Chrome DevTools Protocol | Network 留底、请求拦截、Runtime、Tracing | 权限极强，安全边界敏感（Chrome 136+ 收紧） |
| DevTools 产品面 | DevTools / Lighthouse 的诊断模型 | 性能归因、LCP 分解、waterfall 洞察 | 围绕"被调试页面"，需自管浏览器 |
| 站点适配面 | site adapter | 把具体网站封成结构化命令 | 与网站结构强绑定，要维护 |

六个工具的站位：

| 工具 | 主要站位 | 形态 |
| --- | --- | --- |
| @chrome / @browser | 扩展面（且只暴露其中的页面可见子集） | 宿主内插件 |
| agent-browser | CDP 调试面（Rust 直连，可 connect 任意 CDP 目标） | CLI |
| bb-browser | CDP 调试面 + 站点适配面 | CLI |
| Chrome DevTools MCP | CDP 调试面 + DevTools 产品面 | MCP server |
| playwright-cli | Playwright 引擎（CDP/BiDi 之上的自动化层） | CLI |

### 1.2 边界公式的三个因子

站位只决定**上限**，实际能力还要再砍两刀：

1. **协议层上限**：所在层的协议根本没有这个能力。例：扩展 API 里没有任何接口能读到其他请求的响应体（`webRequest` 只能看元数据）——这是最硬的边界，产品再努力也封不出来。
2. **产品封装范围**：协议有，但工具没包成命令。例：CDP 的 Fetch domain 支持请求拦截，但 chrome-devtools-mcp 没有暴露 mock 工具——边界是产品选择，不是协议限制。
3. **安全策略**：协议有、产品也能做，但有意焊死。例：@chrome 活在用户真实 Chrome 里，把 evaluate 阉割成只读、环境里连 `fetch` 都不给——这是"复用真实登录态"这个卖点旁边必须立的防火墙。Chrome 136+ 对默认 profile 的 remote debugging 收紧、144+ 的逐会话确认，属于浏览器厂商在同一因子上的动作。

### 1.3 Agent 友好度：决定"考什么"

层和边界决定能不能做；Agent 友好度决定做起来顺不顺。理论篇定义的维度——看懂页面、稳定引用（@eN ref）、动作后复盘、复用真实状态、看请求和错误、性能诊断、结构化输出、风险控制——直接翻译成了靶场的八道题。

## 2. 实测方法：为什么这些数字可信

### 2.1 靶场：每道题有标准答案

本地零依赖测试站，每页埋一个已知答案的坑。直接测真实网站不可复现（网站会变、登录态各异），本地靶场让每个判定都可机械核对：

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

加粗四题是按 1.2 的边界公式设计的"分水岭题"——后面会看到它们precisely把六个工具劈成了理论预测的阵营。

### 2.2 无偏执行：测工具，不测操作者

我先自己试跑过一轮，数据基本没用：自己搭的靶场自己知道答案，也摸熟了工具脾气。**知道答案的人测不出真实成本**——同一任务我 6 条命令完赛，无偏 Agent 要 13~26 条，多出来的是探索、验证、撞坑的合理成本，也正是真实用户的 Agent 要付的成本。

所以正式数据全部来自独立 session：每个 cell（任务 × 工具）由一个全新上下文的 Agent 执行（Claude Code 无头 `claude -p` 进程或 Codex 隔离 subagent），prompt 只含任务原文、工具限定、约 25 次操作止损线；不知道答案、不知道工具的已知 bug、禁止 curl/读源码旁路。cell 之间重启靶场清状态。

无偏的价值立刻显形：bb-browser 的 click bug 被六个互不知情的 subagent 在六个场景独立复现，且全部独立收敛到同一个绕过方案——"操作姿势问题"被彻底排除。

### 2.3 指标与局限

每 cell 记录：判定（✅/⚠️/❌ 按任务卡标准）、操作数、轮数、墙钟、成本，外加实测中演化出的指标——**eval 自救次数**（Agent 被迫弃用工具原语、用 eval 直接执行 JS 才能推进的次数，见 5.2）。

如实声明的局限：每 cell 一次运行（agent-browser 例外，同日两轮），方差未收敛；@chrome/@browser 跑在 Codex 宿主内，时间/调用数只能粗比，**能力判定不受宿主影响**；靶场全在 localhost，真实登录态与风控不在本轮；模型是 Fable 5 量级，其自救能力会掩盖工具缺陷；版本钉死 agent-browser 0.27.2 / bb-browser 0.14.2 / chrome-devtools-mcp 1.2.0 / @playwright/cli 0.1.14（开测时均为 npm latest）。

## 3. 总矩阵

`*` = 该 cell 依赖 eval 绕过失效的工具原语才完成。

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
| **合计** | **3✅1⚠️4❌** | **4✅4❌** | **8✅** | **6✅1⚠️**（7 题） | **7✅1⚠️** | **8✅** |

同宿主（claude -p）三列的过程成本：

| 指标 | agent-browser | DevTools MCP | playwright-cli |
| --- | --- | --- | --- |
| 操作数（8 题） | 94 | **48** | 70 |
| 墙钟 | 14.5 min | **11.1 min** | 12.1 min |
| 成本 | $8.21 | $7.43 | **$6.08** |
| eval 自救 | 1 次 | 3 次 | **0 次** |

bb-browser（7 题，subagent 宿主）：235 条命令、26.3 分钟，7 个 cell 全部依赖 eval 自救——约 agent-browser 的 2.3 倍成本，差额全部来自一个工具缺陷（4.5）。

## 4. 逐维度对照：理论预测 → 实测结果 → 边界归因

这是全文核心：每个维度先看理论怎么预测，再看数据怎么判，最后用 1.2 的公式解释每个 ❌/⚠️ 是哪个因子造成的。

### 4.1 页面观察与操作（T01/T05/T06/T08 的 ✅ 半区）：网页面是公共地板

**理论预测**：网页面是六个工具都接到的最低一层，纯页面任务应该全员通过。
**实测**：成立——T01 六家全过，T05/T08 也只有质量差异没有能力缺口。**六个工具全部采用"可访问性快照 + 元素编号引用"工作流**（@eN / e15 / uid），理论篇把它列为友好度第一要素，现在可以说它已是事实标准。

但"全过"之下藏着三档工程质量，全部来自动作可靠性：

- **playwright-cli** 继承了 Playwright 引擎的 actionability 检查（点击前自动滚动到可视区、等待可交互）：让 agent-browser 静默空点两次的"视口外 3px 按钮"，它一次命中。
- **agent-browser** 无此检查：CSS selector 路径点视口外按钮**报成功但无事发生**，subagent 花 16 条命令自查到坐标问题才用 scrollintoview 解决；走快照 ref 路径则可避开。同一工具两轮 13 vs 26 条命令的方差，全由 Agent 碰巧选了哪条路径决定。
- **bb-browser** 的合成事件注入整体失效（4.5）。

Shadow DOM（T08）同样体现"层与质量"的分离：可访问性树天生跨过 open shadow 边界，所以**六家快照全部看得见**里面的按钮（平台行为，不是工具功劳）；但定位、等待、点击原语是否跟着穿透，各家工程实现差异巨大——MCP/playwright-cli/@chrome/@browser 无感知穿透，agent-browser 的 ref 点击可以但 find 文本定位不行，bb-browser 点不动。

T06 的 ⚠️ 是个有价值的反例：@chrome 把"缺货"徽标拼进了商品名字段。没有结构化提取通道、纯靠可见文本抽取时，展示性元素污染数据字段是常见病——这正是理论篇第 7 节 site adapter 价值的反面教材。

### 4.2 Network 响应体（T02）：协议层上限劈出的第一道分水岭

**理论预测**：响应体留底是 CDP Network domain 的能力；扩展 API 层根本没有读取其他请求响应体的接口。@chrome 应该做不到。
**实测**：完全成立，且比预想更绝对——@chrome 和 @browser 双双 ❌，subagent 们能拿到的只有页面错误文案和 console 里的 traceId，状态码和响应体彻底无门。CDP 阵营四家全部 ✅。

**归因**：@chrome/@browser 的 ❌ 是**协议层上限**——`chrome.webRequest` 只能看请求元数据，读不到 body，这是扩展安全模型的根本设计，产品再封装也变不出来。这是全矩阵最"硬"的一组 ❌。

CDP 阵营内部还有一层封装差异：agent-browser / DevTools MCP / playwright-cli 是**被动留底、事后可查**（点击前不需要任何准备）；bb-browser 把响应体封进了 trace 体系——必须 `trace start` 之后**重放动作**才能 `trace body`，多付一次重放成本。这是**产品封装范围**因子的教科书案例：同一个协议层，封装方式决定了排障的成本结构。bb 换来的独有回报是 trace 时间线带因果关联（`request … trigger:25 → click #order-btn`），"哪个动作引发了哪个请求"这条信息其他五家都给不了。

### 4.3 性能诊断（T03）：DevTools 产品面的价值被量化，靶场被反向修正

**理论预测**：性能分析需要的不止 timing 数字，是"能解释问题的诊断模型"——这是 DevTools 产品面独有的，DevTools MCP 应该最省解释成本。
**实测**：成立，并且可以报出具体倍数——DevTools MCP 用 `performance_start_trace` + `performance_analyze_insight`（LCPBreakdown/RenderBlocking）6 次调用、111 秒直出结构化归因；agent-browser 没有诊断模型，但 subagent 从工具文档自己挖出 `profiler` 命令导出原始 trace、用 python 解析、再用 PerformanceObserver 交叉验证，**结论完全一致**——代价是 215 秒和全场最贵的单 cell 成本。一句话：**MCP 把"解释"内置在工具里，CLI 把"解释"外包给模型**。模型强时殊途同归，弱模型下差距会以失败形式放大。

@chrome/@browser 双 ❌：evaluate 环境里连 `performance` 对象都没有——**安全策略**因子（Runtime 被阉割）顺带砍掉了性能取证的全部入口。

这道题还发生了全评测最有意思的事：**三个独立 Agent 用 trace 证据一致推翻了靶场的预设答案**。我出题时写的是"hero.svg（延迟 1.5s）对 LCP 影响最大"，时间线证明：阻塞 CSS（1.2s TTFB）卡住首绘、又按规范卡住其后同步脚本（800ms 长任务），两者**串行** ≈ 2.1s 才是 LCP 真相；hero.svg 与它们**并行**加载、首绘前早已完成，是"看起来最慢但不背锅"的干扰项。"最慢的资源"和"拖慢页面的资源"是两回事。任务卡已修正，"会不会被最慢资源带偏"升格为正式考点——**有标准答案的靶场加无偏 Agent，连出题人的错误都测得出来**。

### 4.4 请求 mock（T04）：三个边界因子在同一道题里同台

**理论预测**（理论篇原文）：mock/abort 可选 Playwright、agent-browser、bb-browser，DevTools MCP 也合适。
**实测**：这一格被改写得最多——

- **agent-browser、playwright-cli ✅**：原生 `network route` / `route`，真正的网络层拦截。
- **DevTools MCP ⚠️**：没有任何拦截工具。CDP 的 Fetch domain 明明支持——这是**产品封装范围**因子：协议有，产品没包。subagent 的自救很体面（`navigate_page` 的 initScript 在页面脚本运行前补丁 fetch/XHR），但补丁在 JS 层：mock 跨域接口、abort 流量这类升级需求就绕不过去了。
- **bb-browser ⚠️**：理论篇写的 `bb-browser network route` 命令**在 0.14.2 里不存在**（断言被推翻），subagent 确认无 mock/intercept 命令后在页面里 monkey-patch 了 `window.fetch`。
- **@chrome/@browser ❌**：扩展层理论上有 `declarativeNetRequest` 可改写请求，但产品没封装，Runtime 又只读连补丁都打不了——**封装范围和安全策略两个因子叠加**，一条路都不剩。

### 4.5 已登录 fetch（T07）与逃生舱：安全策略因子的明码标价

**理论预测**：@chrome 的 `evaluate` 是只读 page scope，"Console 式请求"做不了。
**实测**：逐字证实——@chrome 的 evaluate 环境里**连 `fetch` 函数都没有**；@browser 同样，subagent 试图直接导航到 /api/me 还被策略拦截。四个 CDP 系工具则一句 `eval "fetch('/api/me')"` 解决（页面 Runtime 里发请求自动带 cookie）。

**归因与定价**：这是纯粹的**安全策略**因子。技术上扩展的 content script 完全可以注入任意 JS，OpenAI 有意焊死——因为 @chrome 活在你的真实 Chrome、真实登录态里，可写的 Runtime 意味着 Agent 能以"你"的身份做任何事。所以这格 ❌ 的正确读法不是"@chrome 不行"，而是一笔交易：**真实登录态与 Runtime 可写性，当前你只能二选一。**

这个维度还撑起了整个评测的一个元发现：**eval（可写的页面 Runtime）是所有工具共同的"万能逃生舱"**——凡是页面自己能做的事，eval 都能做。bb-browser 的 click 全坏照样答对 7 题，靠的全是它。而 @chrome/@browser 是六家中唯一没有逃生舱的，于是工具缺陷直接表现为 ❌ 而非成本倍数——矩阵里 ❌ 集中在这两列的根本原因就在这里。逃生舱也有硬边界：它拿不到"过去"的响应体（那是 CDP Network 层的留底，见 4.2），只能重放请求拿"现在"的、预埋钩子抓"未来"的。

### 4.6 bb-browser 的事件注入缺陷：不是边界问题，是质量问题

bb-browser 0.14.2 的 `click`/`press Enter` 报告成功但页面事件监听器不触发（fill 写值正常），六个不知情 subagent 在登录、翻页、Shadow 按钮等场景独立复现六次，全部被迫 `eval requestSubmit()/el.click()` 自救；叠加 `get value` 返回空、fill→type 值叠加两个独立 bug。注意归因：它站在 CDP 层，**协议上限和封装范围都没问题，这是纯粹的实现 bug**——也因此是六家里唯一"修一个 bug 就能大幅改命"的工具。它的长期价值方向（site adapter + trace 因果链）反而被这轮实测从侧面证明了：通用操作不可靠时，结构化命令和留证排障是更稳的差异化。

另一个同类教训来自版本维度：agent-browser 0.27.0 的 route mock 完全失效、0.27.2 修复——**patch 版本差异足以翻转能力结论**，这类评测必须把版本号钉进结论里。

## 5. 跨工具规律：比单格结论更长寿的部分

1. **强模型把工具缺陷变成成本倍数，而不是失败**。有逃生舱的四家答案正确率几乎满分，差距体现在 1~2.5 倍操作数和时间。前提有二：模型强到能想出绕行方案；逃生舱存在。给弱模型选工具时应更看重原语可靠性而非能力上限。
2. **eval 自救次数是一行就能算的工具体检值**：playwright-cli 0 < agent-browser 1 < DevTools MCP 3 < bb-browser 7（cell 全覆盖）< @chrome/@browser（无逃生舱，直接 ❌）。这个序基本就是"原语质量 × 能力覆盖"的序——逃生舱被迫用得越勤，正规命令质量越差。
3. **静默失败是 Agent 最大的敌人**。本轮最贵的时间黑洞全部来自"报成功但无事发生"（bb 的 click、agent-browser 的视口外点击）：Agent 看到"已点击"不会怀疑工具，会先怀疑自己，然后烧轮次验证一切。对工具作者：动作后验证状态、失败就明说，比十个新功能都值钱。
4. **粗粒度组合动作 vs 细粒度原语**。DevTools MCP 用一半操作数完赛（fill_form 一次填整张表、wait_for 等待确认合一），但预想工作流之外就要翻墙；CLI 细原语常规路径多走几步，却能拼出作者没想到的流程。微软给 playwright-cli 的官方定位（"CLI 给高吞吐编码 Agent，MCP 给持久状态场景"）与实测互相印证。
5. **无偏成本约为熟练者的 2~4 倍**。评测报告里的数字应该以无偏 Agent 为准——那才是真实用户要付的价格。

## 6. 各工具实现原理：矩阵背后的源码

前五节用"站在哪一层 + 三因子"解释了每个 ✅/⚠️/❌。这一节再往下钻一层：这些边界在各工具源码里具体长什么样。每个工具我都单独写过一篇实现原理解析，这里只取与本文结论直接相关的核心机制，想看完整源码走读可顺着链接进去。

### 6.1 Codex `@chrome` / `@browser`：被 feature gate 和沙箱 socket 收口的能力

`@chrome` / `@browser` 不是一段独立浏览器脚本，而是接在 Codex App Server、agent loop、plugin 与安全策略之上的一等能力，Agent 经本地 IPC 访问 Codex 自带的浏览器后端，而非直接驱动系统 Chrome。公开的 `openai/codex` 仓库里搜不到它的本体——没有插件目录、没有 `agent.browser.*` API，开源的只是承载它的平台层；能找到的最硬证据有两条：`codex-rs/features/src/lib.rs` 把 `BrowserUse` 与 `InAppBrowser`、`ComputerUse` 并列成一等 feature（默认开启，但最终开关由组织远端归一化，所以同版本不同账号能力不同），以及 `seatbelt_tests.rs` 专门把 `/tmp/codex-browser-use` 这个 Unix socket 加进 macOS 沙箱 allowlist——受限的 Agent 必须经一条明确放行的本地 socket 去和独立浏览器控制进程通信。**这正是矩阵里那一串 ❌ 的源头**：能力被层层关进 feature gate + requirements + 沙箱 socket，动作走受限桥接，于是天然止于页面可见域、`evaluate` 只读——4.5 那笔"真实登录态 vs Runtime 可写性二选一"的交易，在源码层就是这样焊死的。（以上从公开部分推导，非官方实现确认；完整边界分析见[《Codex Browser Use 实现原理公开了吗》](https://ffffhx.github.io/garden-lab/post/codex-browser-use/)。）

### 6.2 agent-browser：Rust 直连 CDP 的薄 CLI

agent-browser 是 Rust 写的薄 CLI，直接连 CDP，能 `connect` 任意 CDP 目标（实测用本地 Electron 应用验证过 `--cdp` 直连全流程）。它不像 DevTools MCP 那样背一个 Puppeteer，也不像 bb-browser 那样架常驻 daemon——快照短、ref 稳、长轮次省 token 是它的设计取向，被动留底的 network 让它事后可查响应体。它在 T01–T08 拿到满分、自救只用 1 次，靠的就是"协议层直给 + 原语克制"。（本系列暂无它的独立源码解析单篇，机制以本文实测为准。）

### 6.3 bb-browser：daemon + CDP + site adapter

bb-browser 同样站在 CDP 层，但形态和 agent-browser 不同：CLI / MCP / provider 三个入口都收敛到一个常驻 daemon，由它维持唯一一条 CDP 长连接、维护各 tab 状态、监听 network/console/error。它的卖点"你的浏览器就是 API"指的是让 Agent 直接进入真实 tab 上下文执行代码，天然带上 profile 的 cookie 与页面运行时——这也是 4.5 里它 click 全坏却靠 eval 答对 7 题的底气。所有动作抽象成统一的 Request/Response 协议、由 `COMMANDS` 注册表用 schema 描述，三个入口从同一份元数据生成。snapshot 注入 `buildDomTree.js` 给可交互元素分配 `@ref`、daemon 再把 ref 解析回 backend node 经 CDP 派发事件（4.5 的 click bug 就出在这条事件注入链上，是实现 bug 而非边界）。它的两个差异化——site adapter（带 `@meta` 的 JS 按 domain 注入 `eval`，把网站能力沉淀成命令）和每 tab 的 ring buffer + `seq`/`lastActionSeq` 增量观察（4.2 那条 trace 因果链的来源）——在 4.6 被实测从反面证明是更稳的方向。完整源码走读见[《bb-browser 源码解析》](https://ffffhx.github.io/garden-lab/post/bb-browser-agent-api/)。

### 6.4 Chrome DevTools MCP：把 DevTools 调试工作流包成工具

Chrome DevTools MCP 是本地 MCP stdio server，接管的是浏览器的"调试会话"层。启动入口很薄，真正逻辑在 `createMcpServer`，浏览器懒启动（`listTools` 不拉起 Chrome）；执行底座不是手写 CDP 而是 Puppeteer。工具统一收敛到 `ToolDefinition`（zod schema + handler），注册时套一层运行时治理——分类过滤、`Mutex` 串行化调用、懒加载 `McpContext`。它对 Agent 友好的关键在 `McpContext`：把页面列表、network/console collector 维护成可读上下文，输入用 a11y tree 快照给每个节点分配跨快照唯一的 `uid`，`click`/`fill` 凭 `uid` 找回元素。**4.3 它性能诊断 111 秒直出结构化归因的能力，源头是它直接复用了 `chrome-devtools-frontend` 的 TraceEngine 与 Insight formatter**——不自造指标解释器，而是搬来 DevTools 面向人类的那套诊断模型。一句话：它封装的不是浏览器 API，是 DevTools 的整套调试工作流。完整解析见[《Chrome DevTools MCP 实现原理解析》](https://ffffhx.github.io/garden-lab/post/chrome-devtools-mcp-agent/)。

### 6.5 playwright-cli：把 Playwright 引擎装成工程化总入口

playwright-cli 站在 Playwright 引擎（CDP/BiDi 之上的自动化层）。三个包分层：`playwright-core` 提供 open/codegen/screenshot/install 等基础命令，`playwright` / `@playwright/test` 再叠加测试与报告命令，bin 极薄只做 `program.parse`。`playwright test` 把 `--headed`/`--trace` 等参数先归一成 `cliOverrides` 再合并成单一 `FullConfigInternal`，运行用任务链（load → run）描述生命周期，并用 phase + worker 调度而非裸 `Promise.all`。它在 4.1 一次命中"视口外 3px 按钮"的可靠性，来自引擎的 actionability：动作前自动检查元素可见、稳定、可交互——把"人类能不能执行这个动作"编码进动作模型，从根上消掉硬等待的偶发失败；Locator 是"怎么找元素"的可重复规则而非一次性节点引用，重渲染后自动指向新节点。CLI 还新增了 `run-test-mcp-server`、`init-agents` 入口，使它同时成为人、CI、MCP、agent 的共用集成层——这正是第 8 节核对表里"playwright-cli 补齐 snapshot/ref/auto-wait、综合成绩全场最佳"的工程来源。实现细节见[《Playwright CLI 实现原理解析》](https://ffffhx.github.io/garden-lab/post/playwright-cli-npx-playwright/)与[《Playwright 开源了吗》](https://ffffhx.github.io/garden-lab/post/playwright-ai-agent/)。

## 7. 实测修订版选型路由表

理论篇第 8 节的表按数据修订（**加粗 = 与理论版不同**）：

| Agent 任务 | 实测首选 | 依据 |
| --- | --- | --- |
| 标准网页操作（可控环境、自启浏览器） | **playwright-cli / DevTools MCP** | 前者零自救 + 最低成本 + actionability；后者最少操作数 |
| 操作用户已登录的真实页面 | @chrome / @browser | 唯一活在真实会话里的入口；能力止于页面可见域（T02/03/04/07 边界实证） |
| 一边操作一边排查请求（要响应体） | agent-browser / playwright-cli / DevTools MCP | 被动留底事后可查；**@chrome/@browser 协议层出局** |
| 像 F12 一样做性能归因 | DevTools MCP | insight 模型直出，时间约为 CLI 推理路径一半 |
| mock / 拦截 / 改写流量 | **agent-browser / playwright-cli** | 唯二网络层 route；**DevTools MCP 与 bb-browser 此项出局** |
| 接入已存在的浏览器（真实 profile、Electron、远程 CDP） | **agent-browser（唯一 CLI 选项）** | playwright-cli 只能 attach 自家浏览器；我们用本地 Electron 应用验证过 `--cdp` 直连全流程 |
| 把固定网站封成结构化命令 | bb-browser site adapter | T06 的文本污染从反面证明了 adapter 价值 |
| 排障复盘（动作↔请求因果） | bb-browser trace | trigger 关联是全场独有 |
| 长期回归测试 | Playwright（库） | 不变；playwright-cli 让"Playwright 系"同时覆盖了 Agent 日常操作 |

## 8. 理论断言核对表

| 理论篇断言 | 裁决 | 归因因子 |
| --- | --- | --- |
| @chrome 的 Network 详情和有副作用 evaluate 较弱 | ✅ 证实且更绝对（4 题 ❌，@browser 同样） | 协议层 + 安全策略 |
| agent-browser 快照短、ref 稳、适合长轮次 | ✅ 证实（8/8），且被低估——profiler/connect-anything 没写够 | — |
| bb-browser 有通用 network route / mock | ❌ 推翻：0.14.2 无此命令 | 文档与版本失配 |
| bb-browser 核心价值在 site adapter | ✅ 间接证实：通用操作当前全靠 eval 撑 | 实现质量 |
| DevTools MCP 性能诊断省解释成本 | ✅ 证实：111s vs 215s，结论一致 | 产品面价值 |
| mock/abort 可选 DevTools MCP | ❌ 推翻：无拦截工具 | 封装范围 |
| Playwright 偏工程师脚本、Agent 要自己写 selector | ❌ 已过时：playwright-cli 补齐 snapshot/ref/auto-wait，综合成绩全场最佳 | 生态更新 |
| 真实登录态场景 @chrome 授权成本最低 | 未测（T10 待跑），方向无反证 | — |

理论框架本身——按层定上限、按安全域解释取舍、按任务阶段路由——全部站住了；被推翻的都是具体工具格子。这说明此类文章的保鲜期取决于工具版本，**结论应该和版本号写在一起**。

## 9. 下一步

- T09（扩展 reload）、T10（真实登录态）未实测——后者是 @chrome/@browser 的主场，预期会改写路由表一行。
- 增加每 cell 重复次数收方差；引入弱一档模型验证 5.1 的预言。
- 把"登录态持久化"（state save/load、profile 复用）设计成新任务——agent-browser 与 playwright-cli 都有全套命令，是两者下一个分胜负的点。
- 值得上游提 issue：bb-browser 事件注入缺陷、agent-browser 视口外静默点击与 Electron 下 connect 会话失灵、playwright-cli 不验证响应结构就 mock。

## 附录：靶场、数据与版本

- 靶场与任务卡：`apps/browser-tool-bench/`（零依赖 Node 测试站 + T01-T10 任务卡 + 复现步骤）
- 原始数据：`results/formal-2026-06-12/`（ab vs bb）、`results/formal-2026-06-12-mcp/`（ab vs DevTools MCP）、`results/formal-2026-06-12-pw/`（playwright-cli）、`results/codex-plugins-2026-06-12/`（@chrome/@browser，Codex 宿主）
- 版本：agent-browser 0.27.2 · bb-browser 0.14.2 · chrome-devtools-mcp 1.2.0 · @playwright/cli 0.1.14 · Chrome 148/149 · 模型 claude-fable-5（Codex 轮除外）
- 理论篇：[《浏览器 Agent 工具怎么选》](https://ffffhx.github.io/garden-lab/post/chrome-cdp-mcp-devtools/)（2026-06-08），其框架是本文第 1 节的来源
- 实现原理深挖系列（第 6 节各小节的完整源码走读）：
  - [Codex Browser Use 实现原理公开了吗](https://ffffhx.github.io/garden-lab/post/codex-browser-use/)
  - [bb-browser 源码解析](https://ffffhx.github.io/garden-lab/post/bb-browser-agent-api/)
  - [Chrome DevTools MCP 实现原理解析](https://ffffhx.github.io/garden-lab/post/chrome-devtools-mcp-agent/)
  - [Playwright CLI 实现原理解析](https://ffffhx.github.io/garden-lab/post/playwright-cli-npx-playwright/)
  - [Playwright 开源了吗：从浏览器自动化到 AI Agent 工具链](https://ffffhx.github.io/garden-lab/post/playwright-ai-agent/)

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
