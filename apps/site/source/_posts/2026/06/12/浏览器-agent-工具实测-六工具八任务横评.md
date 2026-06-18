---
title: "浏览器 Agent 工具：能力分层理论 × 六工具十一任务实测"
updated: 2026-06-14 20:00:00
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
excerpt: "把理论和实测装进同一篇：先用浏览器能力分层和安全域解释每个工具的边界从哪来，再用一个有标准答案的基准测试站、互相隔离的无偏 Agent 会话实测 @chrome、@browser、agent-browser、bb-browser、Chrome DevTools MCP 和 playwright-cli。八道网页任务之外，2026-06-14 又补测了扩展安全域（T09/T11）、真实登录态（T10a）与跨会话持久化（T10b）三题（Claude Code 与 Codex 两轮独立、结论一致）：扩展场景的真分水岭是能不能到 chrome:// 特权页、bb-browser 在此失能；真实登录态是 @chrome 主场、playwright-cli 出局；持久化靠可移植状态文件取胜。补测还确认 agent-browser 0.27.2 有常驻 daemon，其粘滞会话让 --cdp 命中真实 profile 不可靠。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

判断一个浏览器 Agent 工具，问一个问题就够了：**它能让 Agent 多容易地完成任务？**

这个"容易"里藏着一条比顺滑度更硬的分界：**它能不能复用你已经登录好的真实身份。** 大量真实任务（看自己的通知、读登录后才出现的数据、以你的账号操作）只有在真实登录态里才存在，复用不了登录态，再顺滑的操作也碰不到这些题——所以它不是友好度的普通一项，而常常是能不能开始的前置门槛。本文专门用 T10a/T10b 两题把这条线测清楚（见 4.7）。

这篇文章把理论和实测装进同一个框架里：

- **理论负责解释**：每个工具站在浏览器的哪一层、被什么安全域约束，决定了它"天生能做什么、天生做不了什么"；
- **实测负责裁决**：一个每道题都有标准答案的本地基准测试站、八道网页任务 + 三道扩展/登录态任务（T09/T10/T11，2026-06-14 补测）、六个工具、互相隔离且不知道答案的独立 Agent 会话——理论断言累计证实七条、推翻五条，基准测试站自己的预设答案还被 Agent 用 trace 证据修正了一处。补测的三题由 Claude Code 与 Codex 两轮各自独立跑、结论一致，只在评分口径上有别。

被测六个工具：Codex `@chrome`、Codex `@browser`、`agent-browser`、`bb-browser`、`Chrome DevTools MCP`、`playwright-cli`。基准测试站、任务卡与全部原始数据在仓库 `apps/browser-tool-bench/`，可复现。

全文的主线是一个从实测里提炼出来的公式：

> **工具实际能力 = min(协议层上限, 产品封装范围, 安全策略)**

总表里每一个 ❌ 和 ⚠️，都能对应到这三个因素中的一个。后文逐格验证，并在第 6 节把每个工具的实现原理一并讲透——让总表里的每条边界都能落到具体代码。

## 1. 理论：能力从哪一层来，边界由什么决定

### 1.1 浏览器有哪几个部位，工具又接到哪个入口

先从你能在 Chrome 里指着说出来的部位看起——浏览器大致由下面这几块组成，光是"每块谁够得着、卡在哪"，就已经能解释总表里的大半结果：

| 浏览器部位 | 具体是什么 | 谁能完整拿到 | 难点 / 谁够不着 |
| --- | --- | --- | --- |
| 网页内容 | DOM、页面 JS runtime、输入、shadow DOM、可访问性快照、页内 fetch | 六家公共底座，全员能读能点 | @chrome/@browser 的 runtime 只读，连 `fetch` 都没有 |
| 标签页 / 窗口 / target | 多 tab、新窗口、popup 弹出窗口（`window.open` 出来的独立网页窗口，如 OAuth 登录窗）¹，以及后台 target（service worker / background page） | **前台多 tab / 新窗口 / popup**：四个 CDP 工具（agent-browser、bb-browser、DevTools MCP、playwright-cli）都能枚举并切换，@chrome 走 `chrome.tabs` 也管得了；**后台 target**（service worker / background page）要 CDP 的 Target 域才看得到，只有自管浏览器的 agent-browser、DevTools MCP、playwright-cli（自管 context）拿得到，@chrome / @browser 的扩展 runtime 只读、够不着 | playwright-cli 一旦改成 attach 企业 Chrome，枚举到扩展的 service_worker target 反而触发内部断言、直接崩（自管时没问题） |
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

### 1.2 边界公式的三个因素

站位只决定**上限**，实际能力还要再砍两刀：

1. **协议层上限**：所在层的协议根本没有这个能力。例：扩展 API 里没有任何接口能读到其他请求的响应体（`webRequest` 只能看元数据）——这是最硬的边界，产品再努力也封不出来。
2. **产品封装范围**：协议有，但工具没包成命令。例：CDP 的 Fetch domain 支持请求拦截，但 chrome-devtools-mcp 没有暴露 mock 工具——边界是产品选择，不是协议限制。
3. **安全策略**：协议有、产品也能做，但有意焊死。例：@chrome 活在用户真实 Chrome 里，把 evaluate 阉割成只读、环境里连 `fetch` 都不给——这是"复用真实登录态"这个卖点旁边必须立的防火墙。Chrome 136+ 对默认 profile 的 remote debugging 收紧、144+ 的逐会话确认，属于浏览器厂商在同一因素上的动作。

### 1.3 Agent 友好度：决定"考什么"

层和边界决定能不能做；Agent 友好度决定做起来顺不顺。前面定义的维度——看懂页面、稳定引用（@eN ref）、动作后复盘、复用真实状态、看请求和错误、性能诊断、结构化输出、风险控制——直接翻译成了基准测试站的八道题。

## 2. 实测方法：为什么这些数字可信

### 2.1 基准测试站：每道题有标准答案

本地零依赖的基准测试站，每页埋一个已知答案的坑。直接测真实网站不可复现（网站会变、登录态各异），它让每个判定都可机械核对：

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

加粗四题是按 1.2 的边界公式设计的"分界题"——后面会看到它们恰好把六个工具分成了理论预测的几个阵营。

### 2.2 无偏执行：测工具，不测操作者

我先自己试跑过一轮，数据基本没用：自己搭的基准测试站自己知道答案，也摸熟了工具脾气。**知道答案的人测不出真实成本**——同一任务我 6 条命令完赛，无偏 Agent 要 13~26 条，多出来的是探索、验证、撞坑的合理成本，也正是真实用户的 Agent 要付的成本。

所以正式数据全部来自独立 会话：每个单元格（任务 × 工具）由一个全新上下文的 Agent 执行（Claude Code 无头 `claude -p` 进程或 Codex 隔离 子 Agent），提示词只含任务原文、工具限定、约 25 次操作止损线；不知道答案、不知道工具的已知 bug、禁止 curl/读源码旁路。单元格之间重启基准测试站清状态。

无偏的价值立刻显形：bb-browser 的 click bug 被六个互不知情的 子 Agent 在六个场景独立复现，且全部独立收敛到同一个绕过方案——"操作姿势问题"被彻底排除。

### 2.3 指标与局限

每个单元格记录：判定（✅/⚠️/❌ 按任务卡标准）、操作数、轮数、实际耗时、成本，外加实测中演化出的指标——**eval 自救次数**（Agent 被迫弃用工具原语、用 eval 直接执行 JS 才能推进的次数，见 5.2）。

如实声明的局限：每个单元格一次运行（agent-browser 例外，同日两轮），方差未收敛；@chrome/@browser 跑在 Codex 宿主内，时间/调用数只能粗比，**能力判定不受宿主影响**；基准测试站全在 localhost，真实登录态与风控不在本轮；模型是 Fable 5 量级，其自救能力会掩盖工具缺陷；版本钉死 agent-browser 0.27.2 / bb-browser 0.14.2 / chrome-devtools-mcp 1.2.0 / @playwright/cli 0.1.14（开测时均为 npm latest）。

## 3. 结果总表

一张总表收全十一道题（T01–T08 为八道网页任务，T09/T10/T11 为 2026-06-14 扩展/登录态补测）。图例：`*` = 依赖 eval 绕过失效的工具原语才完成；`†` = `--cdp` 命中目标 profile 不可靠、需先复位常驻 daemon（见 6.2）；`‡` = 依赖持久 userDataDir、不可移植（换目录即丢）；`△` = 工具自身无持久化机制、只能搭外部持久浏览器便车；`N/A` = 该任务对该工具不适用。

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
| **合计（仅 T01–T08）** | **3✅1⚠️4❌** | **4✅4❌** | **8✅** | **6✅1⚠️**（7 题） | **7✅1⚠️** | **8✅** |

同宿主（claude -p）三列的过程成本：

| 指标 | agent-browser | DevTools MCP | playwright-cli |
| --- | --- | --- | --- |
| 操作数（8 题） | 94 | **48** | 70 |
| 实际耗时 | 14.5 min | **11.1 min** | 12.1 min |
| 成本 | $8.21 | $7.43 | **$6.08** |
| eval 自救 | 1 次 | 3 次 | **0 次** |

bb-browser（7 题，子 Agent 宿主）：235 条命令、26.3 分钟，7 个单元格全部依赖 eval 自救——约 agent-browser 的 2.3 倍成本，差额全部来自一个工具缺陷（4.5）。

关于补测三题（T09 / T10 / T11，2026-06-14）：T01–T08 跑在 localhost、不碰真实登录态与扩展安全域；这三道题专门补这块，已并入上面的总表，由两轮互相独立的隔离 子 Agent 实测（一轮 Claude Code 主控、一轮 Codex），结论高度一致，差异只在评分口径（详见 4.7）。

关键前置（影响上表 T09/T10/T11 怎么读）：目标机器的系统默认 Chrome（CDP 9223）是**企业管控**的，会在运行时拦截"加载已解压扩展"（扩展自身 `chrome-extension://` 资源返回 `ERR_BLOCKED_BY_CLIENT`、content script 不注入），所以 T09/T11 的扩展宿主改用一台**干净的 Chrome for Testing**（`--disable-features=DisableLoadExtensionCommandLineSwitch --load-extension` 才能让 137+ 真正加载扩展）；T10a 仍在企业 9223 上测真实登录态。未读数两轮都读到 **68**（与 06-12 轮的 66/67 只是 GitHub 实时状态差异，非能力差异）。

## 4. 逐维度对照：理论预测 → 实测结果 → 边界的成因

这是全文核心：每个维度先看理论怎么预测，再看数据怎么判，最后用 1.2 的公式解释每个 ❌/⚠️ 是哪个因素造成的。

### 4.1 页面观察与操作（T01/T05/T06/T08 的 ✅ 半区）：网页面是大家共用的底座

**理论预测**：网页面是六个工具都接到的最低一层，纯页面任务应该全员通过。
**实测**：成立——T01 六家全过，T05/T08 也只有质量差异没有能力缺口。**六个工具全部采用"可访问性快照 + 元素编号引用"工作流**（@eN / e15 / uid），第 1 节把它列为友好度第一要素，现在可以说它已是事实标准。

但"全过"之下藏着三档工程质量，全部来自动作可靠性：

- **playwright-cli** 继承了 Playwright 引擎的 actionability 检查（点击前自动滚动到可视区、等待可交互）：让 agent-browser 静默空点两次的"视口外 3px 按钮"，它一次命中。
- **agent-browser** 无此检查：CSS selector 路径点视口外按钮**报成功但无事发生**，子 Agent 花 16 条命令自查到坐标问题才用 scrollintoview 解决；走快照 ref 路径则可避开。同一工具两轮 13 vs 26 条命令的方差，全由 Agent 碰巧选了哪条路径决定。
- **bb-browser** 的合成事件注入整体失效（4.5）。

Shadow DOM（T08）同样体现"层与质量"的分离：可访问性树天生跨过 open shadow 边界，所以**六家快照全部看得见**里面的按钮（平台行为，不是工具功劳）；但定位、等待、点击原语是否跟着穿透，各家工程实现差异巨大——MCP/playwright-cli/@chrome/@browser 无感知穿透，agent-browser 的 ref 点击可以但 find 文本定位不行，bb-browser 点不动。

T06 的 ⚠️ 是个有价值的反例：@chrome 把"缺货"徽标拼进了商品名字段。没有结构化提取通道、纯靠可见文本抽取时，展示性元素污染数据字段是常见病——这正是 site adapter 价值的反面教材（见 6.3）。

### 4.2 Network 响应体（T02）：协议层上限划出的第一道分界线

**理论预测**：响应体留底是 CDP Network domain 的能力；扩展 API 层根本没有读取其他请求响应体的接口。@chrome 应该做不到。
**实测**：完全成立，且比预想更绝对——@chrome 和 @browser 双双 ❌，子 Agent 们能拿到的只有页面错误文案和 console 里的 traceId，状态码和响应体彻底无门。CDP 阵营四家全部 ✅。

**原因**：@chrome/@browser 的 ❌ 是**协议层上限**——`chrome.webRequest` 只能看请求元数据，读不到 body，这是扩展安全模型的根本设计，产品再封装也变不出来。这是整张总表里最"硬"的一组 ❌。

CDP 阵营内部还有一层封装差异：agent-browser / DevTools MCP / playwright-cli 是**被动留底、事后可查**（点击前不需要任何准备）；bb-browser 把响应体封进了 trace 体系——必须 `trace start` 之后**重放动作**才能 `trace body`，多付一次重放成本。这是**产品封装范围**因素的教科书案例：同一个协议层，封装方式决定了排障的成本结构。bb 换来的独有回报是 trace 时间线带因果关联（`request … trigger:25 → click #order-btn`），"哪个动作引发了哪个请求"这条信息其他五家都给不了。

### 4.3 性能诊断（T03）：DevTools 产品面的价值被量化，基准测试站被反向修正

**理论预测**：性能分析需要的不止 timing 数字，是"能解释问题的诊断模型"——这是 DevTools 产品面独有的，DevTools MCP 应该最省解释成本。
**实测**：成立，并且可以报出具体倍数——DevTools MCP 用 `performance_start_trace` + `performance_analyze_insight`（LCPBreakdown/RenderBlocking）6 次调用、111 秒直出结构化的原因分析；agent-browser 没有诊断模型，但 子 Agent 从工具文档自己挖出 `profiler` 命令导出原始 trace、用 python 解析、再用 PerformanceObserver 交叉验证，**结论完全一致**——代价是 215 秒和全场最贵的单个单元格成本。一句话：**MCP 把"解释"内置在工具里，CLI 把"解释"外包给模型**。模型强时殊途同归，弱模型下差距会以失败形式放大。

@chrome/@browser 双 ❌：evaluate 环境里连 `performance` 对象都没有——**安全策略**因素（Runtime 被阉割）顺带砍掉了性能取证的全部入口。

这道题还发生了全评测最有意思的事：**三个独立 Agent 用 trace 证据一致推翻了基准测试站的预设答案**。我出题时写的是"hero.svg（延迟 1.5s）对 LCP 影响最大"，时间线证明：阻塞 CSS（1.2s TTFB）卡住首绘、又按规范卡住其后同步脚本（800ms 长任务），两者**串行** ≈ 2.1s 才是 LCP 真相；hero.svg 与它们**并行**加载、首绘前早已完成，是"看起来最慢但不背锅"的干扰项。"最慢的资源"和"拖慢页面的资源"是两回事。任务卡已修正，"会不会被最慢资源带偏"升格为正式考点——**有标准答案的基准测试站加无偏 Agent，连出题人的错误都测得出来**。

### 4.4 请求 mock（T04）：三个边界因素在同一道题里同台

**理论预测**：mock/abort 可选 Playwright、agent-browser、bb-browser，DevTools MCP 也合适。
**实测**：这一格被改写得最多——

- **agent-browser、playwright-cli ✅**：原生 `network route` / `route`，真正的网络层拦截。
- **DevTools MCP ⚠️**：没有任何拦截工具。CDP 的 Fetch domain 明明支持——这是**产品封装范围**因素：协议有，产品没包。子 Agent 的自救很体面（`navigate_page` 的 initScript 在页面脚本运行前补丁 fetch/XHR），但补丁在 JS 层：mock 跨域接口、abort 流量这类升级需求就绕不过去了。
- **bb-browser ⚠️**：按理论预期该有的 `bb-browser network route` 命令**在 0.14.2 里不存在**（断言被推翻），子 Agent 确认无 mock/intercept 命令后在页面里直接改写了 `window.fetch`。
- **@chrome/@browser ❌**：扩展层理论上有 `declarativeNetRequest` 可改写请求，但产品没封装，Runtime 又只读连补丁都打不了——**封装范围和安全策略两个因素叠加**，一条路都不剩。

### 4.5 已登录 fetch（T07）与逃生舱：安全策略因素的明码标价

**理论预测**：@chrome 的 `evaluate` 是只读的页面作用域，"Console 式请求"做不了。
**实测**：逐字证实——@chrome 的 evaluate 环境里**连 `fetch` 函数都没有**；@browser 同样，子 Agent 试图直接导航到 /api/me 还被策略拦截。四个 CDP 系工具则一句 `eval "fetch('/api/me')"` 解决（页面 Runtime 里发请求自动带 cookie）。

**原因与代价**：这是纯粹的**安全策略**因素。技术上扩展的 content script 完全可以注入任意 JS，OpenAI 有意焊死——因为 @chrome 活在你的真实 Chrome、真实登录态里，可写的 Runtime 意味着 Agent 能以"你"的身份做任何事。所以这格 ❌ 的正确读法不是"@chrome 不行"，而是一笔交易：**真实登录态与 Runtime 可写性，当前你只能二选一。**

这个维度还撑起了整个评测的一个更上层的规律：**eval（可写的页面 Runtime）是所有工具共同的"万能逃生舱"**——凡是页面自己能做的事，eval 都能做。bb-browser 的 click 全坏照样答对 7 题，靠的全是它。而 @chrome/@browser 是六家中唯一没有逃生舱的，于是工具缺陷直接表现为 ❌ 而非成本倍数——总表里 ❌ 集中在这两列的根本原因就在这里。逃生舱也有硬边界：它拿不到"过去"的响应体（那是 CDP Network 层的留底，见 4.2），只能重放请求拿"现在"的、预埋钩子抓"未来"的。

### 4.6 bb-browser 的事件注入缺陷：不是边界问题，是质量问题

bb-browser 0.14.2 的 `click`/`press Enter` 报告成功但页面事件监听器不触发（fill 写值正常），六个不知情 子 Agent 在登录、翻页、Shadow 按钮等场景独立复现六次，全部被迫 `eval requestSubmit()/el.click()` 自救；叠加 `get value` 返回空、fill→type 值叠加两个独立 bug。注意原因：它站在 CDP 层，**协议上限和封装范围都没问题，这是纯粹的实现 bug**——也因此是六家里唯一"修一个 bug 就能大幅改命"的工具。它的长期价值方向（site adapter + trace 因果链）反而被这轮实测从侧面证明了：通用操作不可靠时，结构化命令和留证排障是更稳的差异化。

另一个同类教训来自版本维度：agent-browser 0.27.0 的 route mock 完全失效、0.27.2 修复——**patch 版本差异足以翻转能力结论**，这类评测必须把版本号钉进结论里。

### 4.7 扩展安全域与真实登录态（T09/T10/T11）：边界从"页面"挪到"特权页与 profile"

前八题都在网页面内打转；这三题把战场挪到两个新地方——`chrome://` / `chrome-extension://` 这类**特权页**（T09 调试扩展、T11 使用扩展），和**复用真实登录态 / 跨会话持久化 profile**（T10a/T10b）。理论上它们分别对应边界公式里的"安全策略"和"产品封装范围"，实测把分界线画得比八题更清楚。

**T09/T11 扩展：真正的分水岭不是"自带浏览器"，而是"能不能到特权页"。** 06-12 的旧推演倾向于"扩展场景偏向能自管浏览器的工具"，但补测改写了它：只要给 attach 类工具一个**扩展真能跑的浏览器**，分胜负的其实是**到达 `chrome://extensions` 和 `chrome-extension://…/options.html` 的能力**，而不是谁自带浏览器。

- **DevTools MCP ✅**：扩展是它的强项区。`--browserUrl` 模式连真实 Chrome 时，要么直接暴露 `list_extensions`/`reload_extension`（Chrome 149 + `--categoryExtensions`），要么退一步在 `chrome://extensions` 页面上下文里调 `chrome.developerPrivate.reload`——两条都能干净走通，options 页也能作为一等 target 操作。
- **playwright-cli ✅**：走自管 persistent context 路线，`launchPersistentContext` 加载本地扩展（注意要用 bundled Chromium 而非 `channel: chrome`，否则又撞企业策略），在自家 chrome://extensions reload、打开 options 页，全链路可控。
- **agent-browser ✅†**：复位 daemon 后能进 chrome://extensions、reload、开 options 页（扩展 ID 走 shadow DOM 的 eval 穿透拿到）——能力存在，但被 `--cdp` 可靠性问题拖累（见下与 6.2）。
- **bb-browser ❌/⚠️**：致命短板暴露无遗——`open`/`goto` 给 `chrome://`、`chrome-extension://` 无脑加 `https://` 前缀并把 `://` 折叠（`chrome://extensions/` → `https://chrome//extensions/` → chrome-error），**自身根本到不了任何特权页**。T11 只能靠外部 CDP 强开 options 页 target 才让 bb-browser 能 fill/click（记 ⚠️）；T09 退用页面内 `chrome.runtime.reload()` 反而把 unpacked 扩展弄成失效态（记 ❌）。继 4.6 的 click bug 之后，这是它第二处"协议层够得着、产品封装却把路堵死"。
- **@chrome / @browser ❌**：和 4.5 同源的**安全策略**因素——Browser Use 的 URL policy 直接拦住 `chrome://` 与 `chrome-extension://`，即使外部把扩展装好也没有 reload/options 通道。它们本身就是扩展，却被产品的封装边界挡在扩展管理之外。

**这里还埋着一个比工具更硬的环境坑：企业管控 Chrome 会让"装了等于没装"。** 目标机器的系统 Chrome 受企业策略管控，把"加载已解压扩展"在运行时拦死——扩展能出现在列表里、显示已启用，但 content script 不注入、扩展自身资源 `ERR_BLOCKED_BY_CLIENT`。这意味着任何"复用你真实 profile 跑扩展"的方案在这类机器上直接失效，扩展测试只能改用干净的 Chrome for Testing（且 137+ 还要 `--disable-features=DisableLoadExtensionCommandLineSwitch` 才认 `--load-extension`，CDP 的 `Extensions.loadUnpacked` 只进注册表、不激活 content script）。这条对"在公司电脑上用 Agent 操作扩展"的现实预期是一盆冷水。

**T10a 真实登录态：@chrome 的主场坐实，但它不再孤独。** 旧文第 8 节把"真实登录态 @chrome 授权成本最低"标成"未测"，补测给了裁决：

- **能读真实登录态的**：`@chrome`、`bb-browser --port 9223`、`DevTools MCP --browserUrl 9223`——都免登录直达 GitHub 通知页、读到同一个 68 条，零写操作。@chrome 在它**唯一的主场任务**上确实零打断（扩展安全域天然在真实 profile 内）。
- **读不到的**：`@browser`（in-app 浏览器不继承真实登录态）；`playwright-cli`（没有接入系统默认 Chrome 的机制，强行 attach 企业 9223 还会因为枚举到企业扩展的 `service_worker` target 触发 playwright-core 内部断言、daemon 直接崩）。
- **能但不可靠的 agent-browser †**：这是补测最意外的一格。`--cdp 9223` 看似连上了，实际动作经常**静默落到 agent-browser 自起的托管浏览器**（一个没有你登录态的空白 headless Chrome）；`get url` 还返回 github，像成功，实则没碰你的真身。两轮独立实测都撞到：Codex 据此判 ❌（坚持"开箱即用必须命中 9223"），主控这轮先 `close --all` + 杀掉托管实例复位，才真连上 9223、读到 68（判 ✅）。**同一个 bug，两种评分口径**——根因都是 6.2 那个粘滞 daemon。

**T10b 持久化：可移植状态文件完胜。** 这是旧文预告的"agent-browser 与 playwright-cli 下一个分胜负点"，补测让它打平、并把第三第四名的机制差异讲清楚：

- **agent-browser ✅ / playwright-cli ✅**：两者都有**可移植状态文件**（`state save/load` / `state-save/load`）。机制上打平，差别只在 ergonomics——agent-browser `--state <file> open <url>` 一步式（加载先于导航，零踩坑）；playwright-cli 必须"先 open 再 state-load 再 goto"（直接带状态文件启动会报 browser is not open）。两者一次命中、免登录读到 68。它们稳的根因是：状态文件存的是 **CDP 拿到的明文 cookie**，不依赖浏览器磁盘上的加密，跨会话、跨目录、跨实例都能用。
- **DevTools MCP ✅\***：走"复用同一持久 userDataDir"的隐式路线，没有可移植 state 文件。补测确认它"换目录就丢"（复制 profile 即撞登录墙），而且依赖浏览器 on-disk cookie 加密可用——本机 CfT 因无 keychain，连原地复用都丢，要 `--use-mock-keychain` 兜底才持久。
- **bb-browser △**：持久化维度最弱——**自身没有任何 state save/load，也没有 cookie 导入**（只有只读的 `cookies` 查看）。它能读到登录态，完全是 attach 了一个别人维持登录的持久浏览器，自己既不产出也不保存状态。

一句话收束这三题：**T09/T11 把"能不能到特权页"立成扩展场景的真分水岭（bb-browser 在此失能）；T10a 坐实 @chrome 的真实登录态主场、也暴露 agent-browser `--cdp` 的可靠性硬伤；T10b 证明可移植状态文件（agent-browser/playwright-cli）比 userDataDir 依赖更稳。**

## 5. 跨工具规律：比单格结论更长寿的部分

1. **强模型把工具缺陷变成成本倍数，而不是失败**。有逃生舱的四家答案正确率几乎满分，差距体现在 1~2.5 倍操作数和时间。前提有二：模型强到能想出绕行方案；逃生舱存在。给弱模型选工具时应更看重原语可靠性而非能力上限。
2. **eval 自救次数是一行就能算的工具体检值**：playwright-cli 0 < agent-browser 1 < DevTools MCP 3 < bb-browser 7（单元格全覆盖）< @chrome/@browser（无逃生舱，直接 ❌）。这个序基本就是"原语质量 × 能力覆盖"的序——逃生舱被迫用得越勤，正规命令质量越差。
3. **静默失败是 Agent 最大的敌人**。本轮最贵的时间黑洞全部来自"报成功但无事发生"（bb 的 click、agent-browser 的视口外点击）：Agent 看到"已点击"不会怀疑工具，会先怀疑自己，然后烧轮次验证一切。对工具作者：动作后验证状态、失败就明说，比十个新功能都值钱。
4. **粗粒度组合动作 vs 细粒度原语**。DevTools MCP 用一半操作数完赛（fill_form 一次填整张表、wait_for 等待确认合一），但预想流程之外就得绕路；CLI 细原语常规路径多走几步，却能拼出作者没想到的流程。微软给 playwright-cli 的官方定位（"CLI 给高吞吐编码 Agent，MCP 给持久状态场景"）与实测互相印证。
5. **无偏成本约为熟练者的 2~4 倍**。评测报告里的数字应该以无偏 Agent 为准——那才是真实用户要付的价格。
6. **会不会"后台静默运行、不打扰你"，取决于驱动哪个浏览器，而不是工具本身**。让工具用**自管/无头实例**（playwright-cli headless、DevTools MCP 默认、agent-browser 默认托管浏览器、@browser）时，它天然在后台，零打扰；一旦用 `--cdp` / `--port` / `--browserUrl`（或 @chrome）**接管你正在用的真实 Chrome**，干扰就来自**焦点而非物理设备**：CDP 的合成事件不占用你的物理键鼠（光标不会乱跑、在别的应用打字本身不受影响），但只要你和 Agent **同时活动在同一个 profile**，就会出现三种撞车——`bringToFront`/导航当前页把 **tab 切走**、`focus()`/点击输入框把 **DOM 焦点移走（你打字进错框）**、点到"发送/保存/删除/标记已读"把**账号状态静默改掉**；此外 Agent 开新窗口或抬高 Chrome 还可能夺走 **OS 窗口焦点**，让你接下来的键击落进 Chrome。隔离办法只有一个：**分 profile / 独立窗口 / 无头**，把你和 Agent 的"焦点战场"分开（接专用调试 profile 而非你的日常主 Chrome）。

## 6. 各工具实现原理：边界到底来自哪里

前五节用"站在哪一层 + 三个因素"解释了每个 ✅/⚠️/❌。这一节再往下钻一层，把六个工具的内部实现讲清楚：它们各自怎么连上浏览器、用什么把能力包装出来、为什么会出现前面看到的那些边界。读完这一节，前面总表里每一格的结果，都能对应到具体的代码机制。

### 6.1 Codex `@chrome` / `@browser`：被层层安全约束收口的能力

`@chrome` / `@browser` 对应 Codex 的 Browser Use 能力，接的是 Codex 自带的内置浏览器那一层，而不是直接驱动你系统里的 Chrome。从公开代码能推断出的执行链路是这样：Agent 跑在一个受限的执行环境里，自己并不直接握有浏览器控制权，而是通过一条本地 Unix socket（线索是 `/tmp/codex-browser-use`）和一个独立的浏览器控制进程通信，由后者真正去管标签页、截图、读页面、执行动作。

它没有完整开源——这点要先讲清楚，因为它直接决定了我们能断言到哪一步。截至写作时，公开的 `openai/codex` 仓库里搜不到 Browser Use 的本体：没有相关插件目录、没有浏览器运行时、没有 `agent.browser.*` 这类浏览器 API 的实现，也没有"内置浏览器后端如何接动作、管标签页、截图、生成页面快照"的源码，开源的只是承载它的那层平台。能找到的最硬的几条公开证据是：其一，`codex-rs/features/src/lib.rs` 把 `BrowserUse` 和 `InAppBrowser`、`ComputerUse` 并列定义成一等能力（标为稳定、默认开启），但它是个"只认远端配置"的开关——最终开不开由组织、产品、账号的远端配置说了算，这正好解释了为什么同一个版本的 Codex 在不同账号下能力会不一样；其二，Codex 的插件系统本身是开源的，一个插件可以同时贡献 skill、MCP server 和 app 三类能力，Browser Use 最合理的落点就是一个随 App 一起分发的内置插件；其三，沙箱测试 `seatbelt_tests.rs` 专门把 `/tmp/codex-browser-use` 这条 Unix socket 加进了 macOS 沙箱的放行名单——如果它只是普通网页请求或屏幕级点击，根本不需要专门放行一条名字这么明确的本地通道。

这套"安全收口为先"的实现取向，正是前面那一串 ❌ 的根源：能力被一层层关进能力开关、远端配置、沙箱放行名单里，动作只能经受控后端代为执行，于是它天然只能在页面可见的范围里活动、`evaluate` 偏只读——4.5 那笔"真实登录态和可写运行时只能二选一"的交易，在代码层面就是这么焊死的。需要强调：以上是从公开代码推断出的边界，不等于对官方实现细节的证实，真正驱动浏览器的那层代码并不在公开仓库里。另外，Browser Use 和 Computer Use 是两条不同的路径——前者贴着浏览器运行时，对象是标签页、DOM、页面结构，对网页语义理解更细；后者贴着操作系统界面和截图，能跨任意应用，但对网页内部状态没那么精细。

### 6.2 agent-browser：Rust 瘦 CLI + 常驻原生 daemon（直连调试协议）

agent-browser 是用 Rust 写的，对外是一个瘦 CLI、背后挂一个常驻原生 daemon 替它连 CDP（Chrome 的调试协议），而且能 `connect` 到任意一个调试目标——实测里我用一个本地 Electron 应用验证过 `--cdp` 连接的完整流程。它的快照短、元素引用稳、长对话省 token，网络请求被动留底事后可查；在八道题里拿到满分、全程只被迫用了一次 eval 兜底。

**它的架构是瘦 CLI + 常驻 daemon**：0.27.2 起有一个常驻 daemon，是一个**编译后的原生二进制** `agent-browser-darwin-arm64`（不是 node 进程，按 node/daemon 关键字搜不到、容易漏看），脱离父进程挂到 init（PPID=1）、长期常驻、监听 unix 域套接字 `~/.agent-browser/default.sock`，并配 `default.pid` / `default.engine`（值为 `chrome`）/ `default.version`（值为 `0.27.2`）这套标准 daemon 文件。也就是说 agent-browser 的 CLI 是**瘦客户端**，每条命令经 `default.sock` 发给这个常驻 daemon，由 daemon 持有"当前会话绑在哪个浏览器"的状态——和 bb-browser 的形态接近，区别在于它是 Rust 原生二进制、socket 走 unix 域而非本地 HTTP 端口。

这个 daemon 直接解释了 4.7 里 agent-browser `--cdp 9223` 的可靠性硬伤：**daemon 持有的会话是粘滞的**。一旦它之前把 default 会话绑到了自起的托管浏览器（一个空白 headless Chrome），后续即使带 `--cdp 9223`，daemon 也不会可靠地把目标切过去，命令静默落在旧绑定的托管浏览器上——`get url` 还返回你要的页面，像成功，实则没碰真身。复现核验很直接：`open` 一个唯一 URL 后 `curl http://127.0.0.1:9223/json` 找不到它、却在 agent-browser 自管 Chrome 的端口上找得到；进程命令行显示那是个 `--user-data-dir=/tmp/agent-browser-chrome-* --headless=new` 的临时实例。要可靠复用真实 profile，实践中得每次先 `tab` 确认目标、不对就 `close --all`（必要时连 daemon/托管 Chrome 一起 `pkill`）再重连。**这是一个实打实的"Agent 友好度/可控性"扣分项**：静默落到错的浏览器，比明确报错更难发现（呼应第 5 节"静默失败是 Agent 最大的敌人"那条）。它和 bb-browser 在链路上的差别，见 6.3。

### 6.3 bb-browser：后台常驻进程 + 调试协议 + 站点适配器

bb-browser 同样站在 CDP 调试层，但形态和 agent-browser 完全不同。它对外有三个入口——CLI、MCP server、provider（给上层框架注册用），但这三个入口谁都不直接连 Chrome，而是统一汇到一个常驻的后台进程（默认监听 `127.0.0.1:19824`）。这个后台进程才是核心中转站：它维持着和 Chrome 的唯一一条调试长连接、记录每个标签页的状态、持续监听网络/控制台/报错事件，再把各入口发来的命令翻译成调试协议调用。这样 CLI、MCP、provider 就都不用各自再实现一遍浏览器连接和标签页管理。

画成链路图，bb-browser 和 agent-browser 其实很像——**两边都有一层常驻 daemon 中转、都持有粘滞会话**，区别只在 daemon 的实现形态（原生二进制 + unix socket vs node + 本地 HTTP 端口）：

```
agent-browser（Rust 原生二进制 daemon，走 unix socket）
  Agent 发命令
    → agent-browser CLI（瘦客户端）
    → unix socket（~/.agent-browser/default.sock）
    → daemon（常驻原生二进制 agent-browser-darwin-arm64，PPID=1，持有当前会话绑定 + CDP 连接）
    → Chrome 的 CDP 端口（粘滞会话若绑到自起的托管浏览器，--cdp 切换不可靠，见 4.7 / 6.2）

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

### 6.4 Chrome DevTools MCP：把 DevTools 的整套调试流程包成工具

Chrome DevTools MCP 是一个本地 MCP server，靠进程的标准输入输出和 Agent 通信，接管的是浏览器的"调试会话"那一层。它的启动入口很薄，真正的逻辑在 `createMcpServer`；而且浏览器是懒启动的——只列工具清单时不会把 Chrome 拉起来，等第一个真正要操作浏览器的工具被调用时才启动或连接。它的执行底座不是自己手写调试协议，而是直接用 Puppeteer，由 Puppeteer 负责启动、连接、开页面、定位元素、录性能轨迹、截图这一整套。

它对 Agent 友好的关键在中间这层"上下文"对象：它把当前有哪些页面、每个页面的网络和控制台记录都持续收集成可读的状态；元素定位走语义而不走坐标——读取页面的可访问性树，给每个节点分配一个跨快照都唯一的编号，之后点击、填表都按这个编号找回元素，从而不受窗口尺寸、滚动、缩放的影响。动作之后它还有一道"等稳定"的机制：监听导航是否完成、往页面注入观察器，等 DOM 短暂稳定下来才返回，这样模型下一步不会看到一个还在变的半成品页面。所有工具都收敛成统一的定义结构（参数用 schema 描述加一个处理函数），注册时在外面套了一层统一治理：按开关决定暴露哪些工具、用一把全局锁把调用串行化（避免并发的点击/导航/截图互相打架）、用完即转成 MCP 能读的内容并记录耗时。

它最大的差异化是性能分析。它不自己造一套指标解释器，而是直接复用了 Chrome DevTools 前端代码里那套轨迹分析引擎和洞察生成器——也就是说，它录下性能轨迹后，能直接拿到 DevTools 自己用的那套分析结论（比如 LCP 的分解、渲染阻塞的诊断），而不只是一堆原始时间数字。这正是 4.3 里它只花 111 秒就直接给出结构化原因分析的来历：别的工具得靠模型自己去推，它把"解释"内置进了工具里。另外它输出时也很克制——网络和控制台记录分页展开、大截图和性能轨迹走文件引用而不是整块塞进上下文，既省 token 又不会把大段字节糊到模型脸上。一句话：它封装的不是"浏览器 API"，而是 Chrome DevTools 原本给人用的那整套调试流程。

### 6.5 playwright-cli：把 Playwright 引擎装成一个工程化总入口

playwright-cli 站在 Playwright 引擎之上（这个引擎本身又架在调试协议 / BiDi 之上）。它的能力分在三个包里：`playwright-core` 提供核心自动化和 open/codegen/screenshot/install 这些基础命令，`playwright` 在它之上叠加测试相关命令，`@playwright/test` 再往上是最常用的测试入口。三个包的 bin 文件都几乎没有逻辑，本质就是拿到一个已经装配好的命令对象、再把进程参数丢给它分发；命令是分两层挂上去的——先注册核心的浏览器和安装命令，再补上测试和报告命令。所以只装核心包时，它能当一个不带测试框架的纯自动化工具用。

它内部最值得说的，是把"命令行参数"统一降维成"配置覆盖"：跑测试时，`--headed`、`--trace`、`--retries`、`--project` 这些参数不会各自散进执行逻辑，而是先整理成一份覆盖项，再和默认配置、配置文件、项目级配置合并成唯一一份完整的内部配置对象，后面所有环节只面对这一个对象。真正执行时它用一条任务链来描述整个生命周期（全局准备 → 收集并过滤出一棵稳定的测试树 → 切成可并发的执行单元），并按项目依赖拆成一个个阶段来调度，而不是把所有测试粗暴地丢进一个并发里跑：相同环境的执行进程能复用以省启动成本，一旦出错就果断重启那个进程、避免状态污染到后面的测试。

它在前面实测里"一次就点中视口外那个只露 3 像素按钮"的可靠性，来自引擎的两个核心设计。一是动作前的可执行性检查（actionability）：点击、填写之前，引擎会自动确认元素是不是存在、可见、不再移动、可交互、点击点没被浮层挡住——本质是把"一个真人此刻能不能完成这个动作"编码进了动作模型，从根上消掉了靠手写死等待带来的偶发失败；配套的断言也会自动重试到成立或超时。二是它的元素定位是一条"怎么找这个元素"的可复用规则，而不是某一刻的一次性节点引用，所以即便页面中途重新渲染、换掉了旧节点，它执行时也会按最新的 DOM 重新找回来。此外，它还新增了启动 MCP server、初始化 agent 配置这类入口，使它同时能被人、CI、MCP 和 agent 调用——这也正是第 8 节核对表里"playwright-cli 补齐了快照/引用/自动等待、综合成绩全场最佳"在工程上的来源。一句话：playwright-cli 封装的不是一层命令行外壳，而是把一个可靠的浏览器自动化引擎，组织成可安装、可录制、可调试、可并发、还能接进 CI 和 agent 流程的工程化总入口。

## 7. 实测修订版选型路由表

下表按实测数据给出选型（**加粗 = 实测改写了纯理论推演的判断**）：

| Agent 任务 | 实测首选 | 依据 |
| --- | --- | --- |
| 标准网页操作（可控环境、自启浏览器） | **playwright-cli / DevTools MCP** | 前者零自救 + 最低成本 + actionability；后者最少操作数 |
| 操作用户已登录的真实页面 | **@chrome / bb-browser --port / DevTools MCP --browserUrl** | T10a 三家都能免登录读到真实登录态（68）；@chrome 零打断但能力止于页面可见域；**playwright-cli 出局（接不进系统 Chrome）、agent-browser `--cdp` 命中真身不可靠（见 6.2）** |
| 一边操作一边排查请求（要响应体） | agent-browser / playwright-cli / DevTools MCP | 被动留底事后可查；**@chrome/@browser 协议层出局** |
| 像 F12 一样做性能定位 | DevTools MCP | insight 模型直出，时间约为 CLI 推理路径一半 |
| mock / 拦截 / 改写流量 | **agent-browser / playwright-cli** | 唯二网络层 route；**DevTools MCP 与 bb-browser 此项出局** |
| 接入已存在的浏览器（真实 profile、Electron、远程 CDP） | agent-browser（CLI）/ bb-browser --port / DevTools MCP --browserUrl | playwright-cli 只能 attach 自家浏览器（attach 企业 Chrome 还会因 service_worker target 崩）；**但 agent-browser `--cdp` 命中目标 profile 不可靠、需复位粘滞 daemon（6.2），不再是无脑首选** |
| 调试/使用本地扩展（reload、options 页） | **DevTools MCP / playwright-cli** | 前者扩展工具或页面内 `developerPrivate` 直给；后者自管 persistent context 加载扩展；**bb-browser 到不了特权页出局，企业管控 Chrome 会拦死解压扩展（4.7）** |
| 跨会话免登录（专用 profile 持久化） | **agent-browser / playwright-cli** | 唯二有可移植状态文件（`state save/load`），跨目录跨实例都能恢复；DevTools MCP 的 userDataDir 换目录就丢，bb-browser 无此机制 |
| 把固定网站封成结构化命令 | bb-browser site adapter | T06 的文本污染从反面证明了 adapter 价值 |
| 排障复盘（动作↔请求因果） | bb-browser trace | trigger 关联是全场独有 |
| 长期回归测试 | Playwright（库） | 不变；playwright-cli 让"Playwright 系"同时覆盖了 Agent 日常操作 |

## 8. 理论断言核对表

| 理论预测 | 裁决 | 原因 |
| --- | --- | --- |
| @chrome 的 Network 详情和有副作用 evaluate 较弱 | ✅ 证实且更绝对（4 题 ❌，@browser 同样） | 协议层 + 安全策略 |
| agent-browser 快照短、ref 稳、适合长轮次 | ✅ 证实（8/8），且被低估——profiler/connect-anything 没写够 | — |
| bb-browser 有通用 network route / mock | ❌ 推翻：0.14.2 无此命令 | 文档与版本失配 |
| bb-browser 核心价值在 site adapter | ✅ 间接证实：通用操作当前全靠 eval 撑 | 实现质量 |
| DevTools MCP 性能诊断省解释成本 | ✅ 证实：111s vs 215s，结论一致 | 产品面价值 |
| mock/abort 可选 DevTools MCP | ❌ 推翻：无拦截工具 | 封装范围 |
| Playwright 偏工程师脚本、Agent 要自己写 selector | ❌ 已过时：playwright-cli 补齐 snapshot/ref/auto-wait，综合成绩全场最佳 | 生态更新 |
| 真实登录态场景 @chrome 授权成本最低 | ✅ 证实（T10a 零打断、主场）；但 bb-browser/DevTools MCP 同样能读真实登录态 | 安全策略 |
| 扩展场景偏向能自管浏览器的工具 | ❌ 改写：真分水岭是"能不能到 chrome:// / chrome-extension:// 特权页"，bb-browser 在此失能 | 封装范围 |
| agent-browser 薄 CLI、无独立 daemon、`--cdp` 直连可靠 | ❌ 推翻：0.27.2 有常驻原生 daemon，粘滞会话致 `--cdp` 命中真身不可靠（6.2） | 实现/可控性 |
| agent-browser 与 playwright-cli 的 state save/load 是下一个分胜负点 | ✅ 证实并打平（T10b 均可移植状态文件成功），差别仅 ergonomics | — |

理论框架本身——按层定上限、按安全域解释取舍、按任务阶段路由——全部站住了；被推翻的都是具体工具格子（这轮又多推翻三条）。这说明此类文章的保鲜期取决于工具版本，**结论应该和版本号写在一起**，连实现细节都要以实测进程为准、而非文档印象。

## 9. 下一步

- T09（扩展 reload）、T10（真实登录态 + 持久化）、T11（使用扩展）已于 2026-06-14 补测，见第 3 节总表 / 4.7——结果确实改写了路由表，也确认了 agent-browser 0.27.2 有常驻 daemon。
- 增加每个单元格重复次数收方差；引入弱一档模型验证 5.1 的预言。
- 把扩展宿主的搭建本身做成可复现脚本（企业策略检测 → 干净 CfT + 正确 feature flag），因为补测里"让扩展真能跑"比测工具本身更费劲。
- 值得上游提 issue：bb-browser 事件注入缺陷 + `chrome://`/`chrome-extension://` URL 归一化把特权页堵死；**agent-browser 粘滞 daemon 致 `--cdp` 静默落到自起托管浏览器**（4.7/6.2）+ 视口外静默点击 + Electron 下 connect 会话失灵；playwright-cli 不验证响应结构就 mock + attach 多扩展真实 Chrome 时 service_worker target 断言崩溃。

## 附录：基准测试站、数据与版本

- 基准测试站与任务卡：`apps/browser-tool-bench/`（零依赖 Node 测试站 + T01-T11 任务卡 + 复现步骤）
- 原始数据（T01-T08）：`results/formal-2026-06-12/`（ab vs bb）、`results/formal-2026-06-12-mcp/`（ab vs DevTools MCP）、`results/formal-2026-06-12-pw/`（playwright-cli）、`results/codex-plugins-2026-06-12/`（@chrome/@browser，Codex 宿主）
- 原始数据（T09/T10/T11，2026-06-14 两轮独立补测）：`results/formal-2026-06-14-t09-t11-rerun/`（Claude Code 主控，含 4 工具报告 + t10b + 证据 + 环境搭建笔记）、`results/formal-2026-06-14-t09-t11-rerun-fixed-env/`（Codex 主控，含 @chrome/@browser）；两轮结论一致，差异仅评分口径（见 4.7）
- 版本：agent-browser 0.27.2 · bb-browser 0.14.2 · chrome-devtools-mcp 1.2.0 · @playwright/cli 0.1.14 · Chrome 149（T09/T11 扩展宿主用 Chrome for Testing 149）· 模型 claude-fable-5 / claude-opus（补测轮）/ Codex 宿主
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
