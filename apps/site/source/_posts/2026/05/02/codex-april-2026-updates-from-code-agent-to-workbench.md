---
title: "Codex 和 Claude Code 最近一个月更新了什么：两个 Coding Agent 都在变成工作台"
date: "2026-05-03 10:30:00"
categories:
  - 每日新闻
tags:
  - Codex
  - Claude Code
  - OpenAI
  - Anthropic
  - Agent
  - CLI
  - Desktop App
  - GPT-5.5
  - Opus 4.7
excerpt: "整理截至 2026-05-03 最近一个月里 Codex 和 Claude Code 的主要更新：Codex 往常驻桌面工作台演进，Claude Code 往本地 CLI、云端 Agent 编排和安全审查平台演进。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

这篇文章整理的是截至 **2026-05-03** 往前约一个月里，Codex 和 Claude Code 的公开更新。Codex 部分以 [Codex 官方 changelog](https://developers.openai.com/codex/changelog)、OpenAI 官方博客、OpenAI Help Center 和 Codex app 文档为主；Claude Code 部分以 [Claude Code changelog](https://code.claude.com/docs/en/changelog)、Claude Code weekly digest、Anthropic 官方博客和 Claude Help Center 为主。

先给结论：

**最近一个月，Codex 和 Claude Code 都不再只是“会改代码的 Agent”。Codex 更像在往常驻桌面工作台走：浏览器、桌面操作、自动化、记忆、插件和桌宠状态浮层一起补齐。Claude Code 更像在往“本地 CLI + 云端 Agent 编排 + 安全审查平台”走：Opus 4.7、Routines、Ultraplan、Ultrareview、Monitor、Computer Use、Claude Security 和原生 CLI 组成了新的主线。**

如果只看功能名，会觉得更新很多、很散。但把它们放在一起看，主线其实很清楚：

1. Codex app 变成更完整的桌面工作台。
2. Claude Code 继续把本地终端、Web、Desktop 和云端 routine 接起来。
3. GPT-5.5 和 Claude Opus 4.7 都在补强长任务、调试、重构、审查和多步骤 Agent 工作。
4. 两边都在强化权限、安全、计费、插件、MCP、Bedrock 和企业治理。
5. Codex Pets、Claude Code session recap、Monitor、Routines 这些看似边角的功能，其实都在解决同一个问题：Agent 工作状态不能只藏在一次对话里。

{% asset_img figure-01.svg %}

## Codex 最近一个月更新

先看 Codex。它这一个月的关键词是 **常驻工作台**：桌面 app、浏览器、Computer Use、线程自动化、记忆、插件、计费和安全能力一起补齐，目标是让 Codex 不只在你要求它改代码时出现，而是长期留在你的开发工作流里。

### 1. 这次更新最大的变化：Codex 开始“常驻”

4 月 16 日的 [Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/) 是这个月最关键的节点。OpenAI 对 Codex 的描述明显变了：它不只是写代码，而是能进入更多软件开发生命周期里的环节，包括理解系统、检查输出、Review、生成资料、处理长期任务。

这次 app 层面的更新可以分成几组。

第一组是桌面和浏览器能力：

| 能力 | 这次变化 | 意义 |
| --- | --- | --- |
| Computer Use | macOS 上 Codex 可以通过自己的光标看、点、输入 | 可以处理没有 API 的桌面应用，适合前端验证和跨工具操作 |
| In-app browser | app 内置浏览器，可以在页面上评论 | 适合网页、应用、游戏的视觉迭代 |
| Browser Use | 4 月 23 日进一步支持 Codex 操作 app 内浏览器 | 可以点击本地页面、复现视觉问题、验证修复 |

第二组是长期任务能力：

| 能力 | 这次变化 | 意义 |
| --- | --- | --- |
| Thread automations | 自动化可以复用原线程上下文并定时唤醒 | 适合跨天跟进、监控、周期性汇总 |
| Memory preview | Codex 可以记住偏好、修正和来之不易的上下文 | 减少每次重新交代项目规则 |
| Context-aware suggestions | Codex 可以建议你从哪里继续 | 让工作台更像“任务收件箱” |
| `/goal` workflows | CLI 0.128.0 加入持久化目标工作流 | 长任务可以被暂停、恢复、清空和继续 |

第三组是 app 工作台体验：

- 可以先开 **Chats**，不用先选项目目录，适合研究、写作、规划和资料整理。
- 任务侧边栏可以展示计划、来源、产物和总结。
- artifact viewer 可以预览 PDF、表格、文档和幻灯片。
- PR review 更深入地进入 app，可以看 GitHub PR、diff 和 review comments。
- 支持多终端、SSH 远程连接 alpha、多窗口、macOS menu bar、Windows system tray、Intel Mac。

这些功能合在一起，改变的是 Codex 的入口位置：它不再只在你需要改文件时出现，而是更像一个能一直挂在旁边的工程工作台。

{% asset_img figure-02.svg %}

### 2. GPT-5.5 进入 Codex：模型能力和产品能力开始同步升级

4 月 23 日，OpenAI 发布 [GPT-5.5](https://openai.com/index/introducing-gpt-5-5/)，并同步让它进入 ChatGPT 和 Codex。Codex changelog 里明确说，GPT-5.5 出现在 model picker 后，是多数 Codex 任务的推荐选择，尤其适合实现、重构、调试、测试、验证和知识工作产物。

这不是单纯换一个更聪明的模型。对 Codex 来说，GPT-5.5 的价值在于它更适合长链路工程任务：

- 能在较大代码系统里保持上下文。
- 更会判断问题应该落在哪个模块。
- 更能主动检查假设，而不是只产出补丁。
- 在生成文档、表格、幻灯片等知识工作上也更强。
- 官方强调它完成同类 Codex 任务时 token 使用更少。

这里有一个值得注意的细节：模型进入 Codex 之后，CLI、IDE extension 和 Codex app 都可以选择它。也就是说，Codex 正在把“同一个 agent harness”铺到多个入口上，而不是每个入口各自发展一套能力。

对用户来说，最直接的变化是：复杂重构、跨文件调试、测试失败分析和长时间验证，应该优先尝试 GPT-5.5。GPT-5.4 仍然可用，但它在这次更新后更像备用选择。

### 3. 桌宠不是玩具：Codex Pets 是一个状态浮层

5 月 1 日，Codex app 文档里出现了 [Codex pets](https://developers.openai.com/codex/app/settings)。它看起来像一个很轻的 UX 彩蛋，但实际承担的是状态提示。

使用方式很简单：

| 入口 | 做什么 |
| --- | --- |
| `/pet` | 在 composer 里唤醒或收起桌宠 |
| `Cmd+K` / `Ctrl+K` | 从命令菜单执行 Wake Pet 或 Tuck Away Pet |
| Settings > Appearance > Pets | 选择内置桌宠，或刷新本地自定义桌宠 |
| `hatch-pet` skill | 生成自己的自定义桌宠 |

官方文档里对它的描述很明确：这个浮层会在你使用其他 app 时保持 Codex 工作可见。它会显示活跃线程，并反映 Codex 当前是运行中、等待输入，还是准备 review。

这个功能有意思的地方在于，它没有增加新的“智能”，但改善了 Agent 常驻时的问题：当一个任务在后台跑，你不一定想一直盯着 Codex 窗口；但你又需要知道它什么时候卡住、什么时候等你批准、什么时候可以 review。

所以 Codex Pets 更像是一个轻量状态栏。它让 Codex 从“窗口里的聊天框”向“桌面上的工作状态”走了一步。

{% asset_img figure-03.svg %}

### 4. CLI 这一个月更新非常密，重点是 Harness 化

如果只用桌面 app，很容易忽略 CLI 的更新。但这个月的 CLI 变化很关键，因为它代表 Codex 的底层 harness 正在被拆成更稳定的基础设施。

按时间看，几个版本的重点是这样的：

| 日期 | 版本 | 值得注意的变化 |
| --- | --- | --- |
| 4 月 10 日 | 0.119.0 | Realtime voice v2、MCP Apps/custom MCP 增强、远程 app-server workflow、按 ID/name resume |
| 4 月 11 日 | 0.120.0 | Realtime V2 可以流式展示后台 Agent 进度，hooks 和 TUI 状态更清晰 |
| 4 月 15 日 | 0.121.0 | `codex marketplace add`、`Ctrl+R` 历史搜索、memory 控制、MCP/plugin 扩展、安全 devcontainer |
| 4 月 20 日 | 0.122.0 | 更完整的 standalone install、`/side` 侧聊、Plan Mode fresh context、插件浏览、deny-read 策略 |
| 4 月 23 日 | 0.124.0 | TUI 快速调 reasoning、多环境 app-server、Bedrock provider、stable hooks、Fast tier 默认 |
| 4 月 30 日 | 0.128.0 | 持久化 `/goal`、`codex update`、可配置 keymap、显式 permission profiles、外部 agent session import |

我觉得最应该单独记住的是三类变化。

第一，**权限和沙箱更细了**。例如 deny-read glob、permission profiles、sandbox CLI profile、trusted workspace、Windows sandbox 修复。这些更新不显眼，但决定了 Codex 能不能在团队里放心跑。

第二，**插件和 MCP 变成基础能力**。`marketplace add`、远程 marketplace、插件安装/卸载、plugin-bundled hooks、MCP Apps、tool search、app integrations，这些都在把 Codex 从单一 Agent 变成工具平台。

第三，**长任务控制更成熟了**。`/goal`、Plan Mode fresh context、side conversations、resume/fork 修复、多环境 app-server、外部 session import，都是围绕“任务不会一次说完、也不会只在一个窗口里完成”这个前提设计的。

还有一个容易漏的点：0.122.0 里 tool discovery 和 image generation 默认启用，并增强了图片细节和 MCP / `js_repl` 图片元数据。这说明 Codex 的工具发现和多模态产物，已经不是边缘能力。

### 5. 插件、Bedrock、企业服务：Codex 在补组织级部署

这个月的另一个主线是企业化。

4 月 16 日的大更新里，OpenAI 提到新增 90 多个插件，覆盖 Atlassian Rovo、CircleCI、CodeRabbit、GitLab Issues、Microsoft Suite、Neon、Render 等。这些插件不是单纯“多几个连接器”，而是把 Codex 放进真实团队已有的工具链里。

4 月 21 日，OpenAI 发布 [Scaling Codex to enterprises worldwide](https://openai.com/index/scaling-codex-to-enterprises-worldwide/)，推出 Codex Labs，并和 Accenture、Capgemini、CGI、Cognizant、Infosys、PwC、TCS 等全球系统集成商合作。这说明 Codex 的目标用户已经不只是个人开发者，也包括希望把 Agent 工作流落到组织流程里的企业。

4 月 28 日，OpenAI 又发布 [OpenAI models, Codex, and Managed Agents come to AWS](https://openai.com/index/openai-on-aws/)。Codex on Bedrock 进入 limited preview，用户可以从 Codex CLI、Codex desktop app 和 VS Code extension 配置 Bedrock 作为 provider。

这对企业客户很重要，因为它解决的是采购、合规、数据处理位置、AWS commit 和现有云基础设施的问题。换句话说，Codex 不只是“能不能帮我写代码”，还要回答“能不能放进我的公司环境里跑”。

{% asset_img figure-04.svg %}

### 6. 计费变化：从消息估算走向 token 明细

4 月 2 日，OpenAI 发布 [Codex now offers pay-as-you-go pricing for teams](https://openai.com/index/codex-flexible-pricing-for-teams/)。Business 和 Enterprise 可以添加 Codex-only seats，不收固定 seat fee，按使用量计费。

同一阶段，Codex 计费口径也从“每条消息大概多少 credits”转向更接近 API 的 token-based rate card。OpenAI Help Center 的 [Codex rate card](https://help.openai.com/en/articles/20001106-codex-rate-card) 说明：4 月 2 日先覆盖 Plus、Pro、Business 和新的 Enterprise 计划，4 月 23 日扩到现有 Enterprise、Edu、Health、Gov 和 ChatGPT for Teachers。

新的计费表按三类 token 分开：

| 类型 | 为什么重要 |
| --- | --- |
| input tokens | 代码库上下文、提示、工具结果都会进入这里 |
| cached input tokens | 重复上下文如果命中缓存，成本会下降 |
| output tokens | 长补丁、长解释、长报告会显著影响消耗 |

4 月 9 日，ChatGPT release notes 里还新增了 $100/月 Pro 选项，重点面向更长、更高强度的 Codex session，并在限时阶段给到更高 Codex 用量。

这组变化的意义是：Codex 的成本开始更透明，但也更需要用户理解任务形态。输出很长、Fast mode、多实例并行、自动化频繁运行，都会明显改变消耗。

### 7. 安全更新：审批、账号和签名证书都在收紧

Codex 越像一个常驻工作台，安全边界就越重要。这个月有三类更新值得放在一起看。

第一是 **automatic approval reviews**。4 月 23 日的 changelog 里提到，Codex app 可以把符合条件的 approval prompt 先交给自动 reviewer agent。它会展示 review 状态和风险等级，让用户在真正放行前看到更清楚的判断。

第二是账号级安全。4 月 30 日 OpenAI 发布 [Advanced Account Security](https://openai.com/index/advanced-account-security/)。启用后会影响同一登录下的 ChatGPT 和 Codex，包含更强登录方式、更严格恢复路径、更短 session、登录提醒和 session 管理。

第三是 macOS 签名证书轮换。OpenAI 在 [Axios developer tool compromise response](https://openai.com/index/axios-developer-tool-compromise/) 中说明，Codex App 和 Codex CLI 的较老 macOS 版本需要更新到新签名证书版本之后，否则 2026-05-08 之后可能无法正常更新或运行。

这些更新放在一起看，说明 Codex 正在承认一个现实：当 Agent 可以改文件、跑命令、操作浏览器、操作桌面应用时，审批和账号安全不再是附属功能，而是产品核心。

## Claude Code 最近一个月更新

再看 Claude Code。它这一个月的关键词是 **本地 CLI + 云端编排平台**：一边继续打磨本地终端里的执行 harness，另一边把计划、审查、例行任务和安全扫描搬到云端，让 Claude Code 可以接进更长、更复杂的开发流程。

### 1. 从终端助手到云端编排平台

Claude Code 这一个月的更新也很密。和 Codex 的“桌面工作台化”相比，Claude Code 的方向更像是把三个入口接起来：

| 入口 | 最近一个月的变化 | 解决的问题 |
| --- | --- | --- |
| 本地 CLI | Computer Use、Monitor、原生二进制、TUI、权限修复 | 让终端里的 Agent 更稳定、更能验证真实结果 |
| Claude Code on the Web | Routines、Ultraplan、Ultrareview、Web redesign | 让任务可以离开本机，在云端计划、审查和持续运行 |
| 企业与安全 | Claude Security、RBAC、Analytics、OpenTelemetry、Bedrock/Vertex | 让组织能治理、审计、集成和规模化使用 |

这里的 RBAC 和 Analytics 不完全是 CLI 功能，而是 Claude / Cowork / Claude Code 企业生态的配套能力。把它们放进同一节，是因为 Claude Code 已经不只是一个本地命令，它正在和 Desktop、Web、Cowork、Enterprise 管理后台一起组成组织级开发工作流。

{% asset_img figure-05.svg %}

4 月 16 日，Anthropic 发布 [Claude Opus 4.7](https://www.anthropic.com/news/claude-opus-4-7)。这是 Claude Code 这个月的模型主轴。官方把 Opus 4.7 定位为更强的复杂推理和 agentic coding 模型，并在 Claude Code 里引入新的 `xhigh` effort level，介于 `high` 和 `max` 之间。对编码任务来说，它的含义很直接：复杂重构、长链路调试、代码审查、GUI 视觉验证和跨工具任务，都更适合从 `high` 或 `xhigh` 开始。

Claude Code 的云端任务能力也明显增强。4 月 6 到 10 日，`/ultraplan` 进入 research preview：你可以从 CLI 发起计划任务，让 Claude 在 Claude Code on the Web 里生成计划，之后在浏览器中评论、修改，再选择远程执行或拉回本地。随后 Routines 变成更明确的云端 Agent 模板：配置一次 prompt、可触达的仓库和 connectors，就能由定时任务、GitHub 事件或 API 调用触发，不需要本机一直开着。

代码审查是另一个重点。`/ultrareview` 先随 Opus 4.7 亮相，随后在 Week 17 进入 public research preview。它会在云端用一组 bug-hunting agents 审查当前分支或指定 PR，并把结果返回 CLI 或 Desktop。这个方向和 Codex 的 PR review 类似，但 Claude Code 这边更强调“并行审查 Agent + 云端验证报告”。

4 月 30 日，Anthropic 又把 [Claude Security](https://claude.com/blog/claude-security-public-beta) 推到 Enterprise public beta。它可以扫描 repo、目录或分支，输出漏洞说明、严重性、置信度、复现方式，并生成修复建议。官方还强调结果可以导出到 CSV / Markdown，通过 webhook 送到 Slack、Jira 等系统，修复则可以继续在 Claude Code on the Web 里展开。

### 2. CLI 变化：更像一个稳定 Harness

Claude Code 的 CLI 更新没有一个大而响的产品名，但它们非常关键。

| 更新 | 作用 |
| --- | --- |
| Computer Use in CLI | 让 Claude 从终端打开原生 app、点击 UI、截图并验证 GUI-only 流程 |
| Monitor tool | 后台监听日志、CI、训练任务或 dev server，并把事件流回对话 |
| `/loop` self-pacing | 不再只靠固定轮询间隔，Claude 可以按任务自己决定下一次检查 |
| Native binaries | npm 安装的 `claude` 改为拉取平台原生二进制，不再依赖 bundled JavaScript 跑主流程 |
| `/usage` breakdown | 展示 parallel sessions、subagents、cache misses、long context 等消耗来源 |
| Session recap | 切走再回来时，自动给一行“刚才发生了什么”的回顾 |
| Custom themes / flicker-free TUI | 让长会话和多终端使用体验更稳定 |

这些功能其实都围绕一个词：**harness**。Claude Code 不是只把模型接到 shell 上，而是在做一套可持续运行、可观察、可恢复、可插拔、可审计的执行环境。

这个月 MCP、插件和 Hooks 也在继续平台化。比如 MCP 单个 tool 可以声明更大的结果上限；插件可以把 `bin/` 里的可执行文件加入 Bash `PATH`；hooks 可以直接调用 MCP tools；插件可以分发主题；`claude plugin tag` 可以创建插件 release tag；MCP OAuth、step-up authorization、Keychain 并发刷新、Remote Control 连接等边角问题也修了很多。

安全边界上，Claude Code 修复了多类 Bash 权限绕过、compound command 提示、`/dev/tcp` / `/dev/udp` redirect、managed settings 生效、sandbox domain deny、NO_PROXY、企业 TLS 证书和 Windows 路径规则问题。这些修复不热闹，但非常重要：当 Agent 能跑命令、连 MCP、操作 GUI 和触发云端任务时，权限系统就是产品的一部分。

### 3. 质量复盘：Claude Code 这个月也修了一次信任问题

4 月 23 日，Anthropic 发了 [Claude Code 质量问题复盘](https://www.anthropic.com/engineering/april-23-postmortem)。这篇复盘值得单独放进更新总结里，因为它不是功能发布，但会直接影响用户对 Claude Code 的信任。

官方把最近一段时间用户感知“Claude Code 变差”的原因拆成三件事：

| 问题 | 影响 | 修复时间 |
| --- | --- | --- |
| 默认 reasoning effort 从 `high` 降到 `medium` | 为了降低延迟，但牺牲了部分复杂任务表现 | 4 月 7 日回滚 |
| 旧 thinking 清理 bug | 空闲超过一小时后的会话会持续丢历史 reasoning，表现为健忘、重复、工具选择奇怪 | 4 月 10 日修复 |
| 过度压缩输出的 system prompt | 限制 tool call 之间和 final response 长度，伤到了编码质量 | 4 月 20 日回滚 |

这件事有两个启发。

第一，Coding Agent 的质量不是只由底层模型决定。默认 effort、缓存、thinking 历史、system prompt、上下文压缩、工具调度都会改变体感。

第二，Agent 产品的发布流程需要比普通聊天产品更谨慎。因为一个小 prompt 或缓存策略变化，可能不会在短对话里明显出错，却会在长任务、连续工具调用和跨天会话里被放大。

## Codex 和 Claude Code 对比总结

把两边放在一起看，方向很接近，但重心不一样。

{% asset_img figure-06.svg %}

| 维度 | Codex | Claude Code |
| --- | --- | --- |
| 产品重心 | 常驻桌面工作台 | 本地 CLI + 云端 Agent 编排 |
| 模型主轴 | GPT-5.5 进入 Codex | Claude Opus 4.7 + `xhigh` effort |
| 浏览器与桌面 | In-app browser、Browser Use、Computer Use、Codex Pets | Computer Use in CLI、Claude Code Web redesign |
| 长任务 | Thread automations、Memory、context-aware suggestions、`/goal` | Routines、Ultraplan、Monitor、`/loop`、session recap |
| 代码审查 | PR review、automatic approval reviews | `/ultrareview`、Claude Security |
| 插件生态 | 90+ plugins、marketplace、MCP Apps、tool discovery | MCP、plugins、hooks、plugin executables、themes |
| 企业化 | Codex-only seats、token rate card、Bedrock preview、Codex Labs | Claude Security、RBAC、Analytics、Bedrock/Vertex、OpenTelemetry |
| 体感关键词 | “工作状态一直在旁边” | “任务可以本地跑，也可以云端接着跑” |

如果只看功能清单，Codex 和 Claude Code 都在补浏览器、桌面、自动化、插件、权限和企业能力。但它们的产品性格不同。

**Codex 更强调把 Agent 放到你的桌面和工作流旁边。** Codex Pets、in-app browser、多窗口、artifact viewer、thread automations、context-aware suggestions 都在降低“我不知道 Agent 现在做到哪了”的不确定感。

**Claude Code 更强调把 Agent 做成一套可编排的开发系统。** Routines、Ultraplan、Ultrareview、Monitor、Cloud Web、MCP hooks、Claude Security 都在把“让 Claude 做一次任务”扩展成“把 Claude 接进开发和安全流程”。

所以这一个月可以这样概括：

**Codex 在变成常驻工作台，Claude Code 在变成开发 Agent 平台。前者更关心你和 Agent 如何并排工作，后者更关心 Agent 如何被编排、审查、触发和治理。**

这两条路线最后可能会合流。因为一个真正有用的 Coding Agent，既要能坐在你旁边看页面、改代码、等审批，也要能在你离开后继续监控 CI、审查 PR、扫描安全问题，并把结果带回你的工作现场。

## 参考资料

- [Codex changelog](https://developers.openai.com/codex/changelog)
- [Codex app settings: Codex pets](https://developers.openai.com/codex/app/settings)
- [Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/)
- [Introducing GPT-5.5](https://openai.com/index/introducing-gpt-5-5/)
- [Codex now offers pay-as-you-go pricing for teams](https://openai.com/index/codex-flexible-pricing-for-teams/)
- [Codex rate card](https://help.openai.com/en/articles/20001106-codex-rate-card)
- [OpenAI models, Codex, and Managed Agents come to AWS](https://openai.com/index/openai-on-aws/)
- [Scaling Codex to enterprises worldwide](https://openai.com/index/scaling-codex-to-enterprises-worldwide/)
- [Introducing Advanced Account Security](https://openai.com/index/advanced-account-security/)
- [Our response to the Axios developer tool compromise](https://openai.com/index/axios-developer-tool-compromise/)
- [Claude Code changelog](https://code.claude.com/docs/en/changelog)
- [Claude Code Week 14 digest](https://code.claude.com/docs/en/whats-new/2026-w14)
- [Claude Code Week 15 digest](https://code.claude.com/docs/en/whats-new/2026-w15)
- [Claude Code Week 16 digest](https://code.claude.com/docs/en/whats-new/2026-w16)
- [Claude Code Week 17 digest](https://code.claude.com/docs/en/whats-new/2026-w17)
- [Introducing Claude Opus 4.7](https://www.anthropic.com/news/claude-opus-4-7)
- [Claude Security is now in public beta](https://claude.com/blog/claude-security-public-beta)
- [An update on recent Claude Code quality reports](https://www.anthropic.com/engineering/april-23-postmortem)
- [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)
- [Claude Help Center release notes](https://support.claude.com/en/articles/12138966-release-notes)
