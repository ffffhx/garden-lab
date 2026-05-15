---
title: "OpenClaw 源码解析：一个个人 AI 助手平台，是怎么把 Gateway、Agent Loop 和插件系统拼起来的"
date: 2026-04-15 10:36:00
categories:
  - 技术
tags:
  - AI
  - Agent
  - LLM
  - OpenClaw
  - TypeScript
  - 源码解析
  - 平台架构
excerpt: "从一条消息如何进入系统讲起，拆解 openclaw/openclaw 的 Gateway 控制平面、Agent Loop、Session Queue 和 Capability 插件体系，并说明为什么它更像一个个人 AI 助手平台，而不是普通聊天机器人。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

最近我花了一些时间看 [OpenClaw](https://github.com/openclaw/openclaw) 这个仓库。

如果只看 README，你很容易先记住这些标签：

- 个人 AI assistant
- 多渠道接入
- WhatsApp、Telegram、Slack、Discord
- macOS、iOS、Android
- skills、voice、canvas、automation

但真进源码以后，我觉得它最值得看的地方并不是“支持的功能有多少”，而是：

**它是怎么把一个 Agent，做成一个真正能长期运行、能跨端接入、能扩展能力、还能被运维的系统。**

换句话说，OpenClaw 的重点不是“让大模型会回答”，而是：

- 怎么让消息持续接进来
- 怎么让不同渠道共用一套控制平面
- 怎么让每个会话安全地串行执行
- 怎么让模型、渠道、语音、图像、搜索这些能力都能插件化接入

这篇文章会按下面这条主线展开：

1. 先把文中容易陌生的词讲清楚
1. 再从一条消息出发，看 OpenClaw 的主链路
1. 解释为什么 `Gateway` 在这个仓库里是第一公民
1. 拆开 `Agent Loop` 和 `Session Queue` 的角色
1. 重点分析它的 `plugin / capability` 设计
1. 最后给出一版适合做技术分享的讲法

为了避免版本漂移，先说明本文的观察范围。

- 仓库：[openclaw/openclaw](https://github.com/openclaw/openclaw)
- 分支：`main`
- 阅读快照：`56625a189bf36d4a1a239fef30b93fb07760945d`
- 观察时间：`2026-04-15`

另外，下面所有代码片段都是**裁剪版源码片段**：

- 只保留表达设计意图的主体逻辑
- 去掉了大量类型、日志、错误处理和边界分支
- 目的是让你在正文里就能看懂“它到底想怎么组织系统”

## 0. 阅读预备：先把几个词说人话

### 0.1 什么是 Gateway

- `Gateway` 可以把它理解成：**整个系统的统一入口和调度中枢**

它负责的不是“替模型思考”，而是：

- 接住来自不同渠道和客户端的消息
- 统一协议
- 维护连接
- 做认证、配对、健康检查
- 把请求转给真正执行任务的 Agent Loop

如果把 OpenClaw 想成一家餐厅：

- `Gateway` 更像前台和总调度
- `Agent Loop` 才像后厨真正干活的人

### 0.2 什么是 Control Plane

- `Control Plane`，也就是“控制平面”，意思是：**系统里负责调度、管理、协调的那一层**

它通常不直接做业务计算，但负责：

- 谁可以连进来
- 哪个请求该发给谁
- 现在系统是否健康
- 当前有哪些 session、node、channel 正在运行

OpenClaw 把 `Gateway` 做成 control plane，这个判断非常关键。

### 0.3 什么是 Agent Loop

- `Agent Loop` 可以简单理解成：**一次 Agent 真正跑起来的完整执行过程**

通常包含这些步骤：

- 读取输入
- 组装上下文
- 调模型
- 识别工具调用
- 执行工具
- 把结果塞回模型继续推理
- 流式输出回复
- 保存会话状态

所以它不是“一个模型”，而是一套让模型反复思考和调用工具的执行循环。

### 0.4 什么是 Session 和 Lane

- `Session` 是一段会话，也是一条连续任务链路对应的上下文
- `Lane` 可以理解成一条执行通道或排队队列

OpenClaw 里很重要的一个点是：

- **同一个 session 的请求不能乱并发**

否则会很容易出现：

- 会话历史写乱
- 工具调用互相覆盖
- 前一个任务还没结束，后一个任务就改了状态

所以它会给 session 单独排队。

### 0.5 什么是 Capability

- `Capability` 可以理解成“能力类型”

例如：

- 文本模型能力
- 图像生成能力
- 语音能力
- Web 搜索能力
- 消息渠道能力

OpenClaw 的插件系统不是直接说“这是 OpenAI 插件、这是 WhatsApp 插件”就结束，而是进一步要求插件声明：

- 你到底提供了什么能力

这个抽象非常重要，因为它决定了系统能不能长期扩展。

### 0.6 什么是 Channel / Provider / Node

- `Channel`：消息渠道，比如 WhatsApp、Telegram、Slack
- `Provider`：能力后端，比如 OpenAI、Anthropic、Google
- `Node`：接入到 Gateway 的设备节点，比如 macOS、iOS、Android

这三个词经常一起出现，但它们不是一回事：

- `Channel` 解决“消息从哪里来、回哪里去”
- `Provider` 解决“具体能力由谁提供”
- `Node` 解决“设备侧还能做什么动作，比如语音、相机、画布、定位”

## 1. OpenClaw 真正想做的，不只是“会聊天的 Agent”

从 [README](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/README.md) 的描述就能看出来，OpenClaw 的目标不是一个简单聊天机器人，而是：

**一个你运行在自己设备上的个人 AI 助手平台。**

这个表述里最重要的不是 “AI” 三个字，而是后面这几个隐含要求：

- 要能长期运行
- 要能接很多入口
- 要能连接很多能力
- 要能被你自己控制
- 要能跨设备协同

也就是说，它天然不是一个“单轮问答程序”，而更像一个长期在线的系统。

我觉得有个很直观的判断方法：

- 如果一个项目的重点是 prompt、tool list、memory 策略，那它更像在做 Agent 本体
- 如果一个项目的重点是 gateway、protocol、pairing、plugin runtime、channel manager，那它更像在做 Agent 平台

OpenClaw 很明显属于后者。

### 1.1 从 CLI 形状就能看出来，`gateway` 是中心概念

先看一个很短的裁剪版片段，来自 [`src/cli/gateway-cli/register.ts`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/src/cli/gateway-cli/register.ts)：

```ts
export function registerGatewayCli(program: Command) {
  const gateway = program.command("gateway")

  gateway.command("run")
  gateway.command("call")
  gateway.command("health")
  gateway.command("probe")
  gateway.command("discover")
}
```

这段代码虽然很短，但信息量非常大。

它说明 OpenClaw 不是把 `gateway` 当成一个隐藏底层，而是把它直接暴露成顶级操作对象：

- 你可以启动它
- 你可以探测它
- 你可以直接调它的 RPC
- 你可以查它的健康状态

也就是说，在 OpenClaw 的作者眼里，`gateway` 不是附属功能，而是系统本身。

### 1.2 如果只用一张图概括 OpenClaw，我会画成这样

{% asset_img figure-01.svg %}

这张图里最重要的不是“支持了多少能力”，而是四层关系：

1. 上面是入口层：聊天渠道、客户端、设备节点
1. 中间是 `Gateway`：统一入口、协议、认证和调度
1. 再往下是 `Agent Loop`：真正执行一次任务
1. 最下面是能力层：插件、模型、工具、语音、搜索、设备动作

你可以把它理解成：

- OpenClaw 不是先写了一个 Agent，然后给它补很多壳
- 它更像是先搭起了一套“助手平台骨架”，再把 Agent 放进去

## 2. 从一条消息出发：OpenClaw 的主链路到底怎么跑

如果你只想抓住 OpenClaw 的主线，我建议不要先从目录树开始背，而是先看一条消息怎么跑完整个系统。

从我读代码和文档后的理解，这条链路可以浓缩成下面这张图。

{% asset_img figure-02.svg %}

一句话概括就是：

- 消息先进入 `Gateway`
- `Gateway` 把请求标准化并绑定到某个 session
- 同一个 session 的请求进入同一条 lane 排队
- `Agent Loop` 开始执行模型和工具
- 执行过程持续发出流式事件
- 最后结果再被投递回原来的渠道或客户端

### 2.1 Agent 不是直接“开跑”，而是先被塞进 session 队列

这点特别重要。下面这段裁剪自 [`src/agents/pi-embedded-runner/run.ts`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/src/agents/pi-embedded-runner/run.ts)：

```ts
export async function runEmbeddedPiAgent(params) {
  const sessionLane = resolveSessionLane(params.sessionKey || params.sessionId)
  const globalLane = resolveGlobalLane(params.lane)

  const enqueueGlobal = (task, opts) => enqueueCommandInLane(globalLane, task, opts)
  const enqueueSession = (task, opts) => enqueueCommandInLane(sessionLane, task, opts)

  return enqueueSession(() =>
    enqueueGlobal(async () => {
      // 真正执行一次 agent run
    }),
  )
}
```

如果把这段代码翻译成人话，就是：

- 先按 session 排队，保证**同一个会话同一时间只跑一个任务**
- 再进全局队列，限制整个进程的总体并发量

这个设计特别“工程化”，因为它解决的是一个很多 demo 项目都会忽略的问题：

- Agent 不是不能并发
- 但**同一个会话里的状态，通常不适合乱并发**

比如下面这些东西都跟 session 强相关：

- 当前上下文历史
- 工具执行结果
- 正在生成的回复
- 正在等待的 follow-up

如果不做 session lane，很容易出现：

- 第二条消息抢先写入上下文
- 前一轮工具结果被后一轮覆盖
- 流式输出互相插队

所以 OpenClaw 在这里的判断非常明确：

> 并发可以有，但要分层控制；session 内串行，session 间再谈并行。

### 2.2 文档把这条链路写得很清楚

在 [`docs/concepts/agent-loop.md`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/docs/concepts/agent-loop.md) 里，作者把主流程归纳成了下面几步：

1. `agent` RPC 先校验参数并立即返回接收成功
1. 真正的执行交给 `agentCommand`
1. `agentCommand` 再调用 `runEmbeddedPiAgent`
1. `runEmbeddedPiAgent` 负责排队、建会话、调模型、收事件
1. 事件被桥接成 `assistant / tool / lifecycle` 三类流式输出
1. `agent.wait` 再等待这次 run 的结束状态

这意味着 OpenClaw 里的“Agent 调用”并不是一个单纯的同步函数，而是一个带生命周期的运行过程。

这个设计的好处是：

- UI 可以先拿到 accepted 状态
- 流式输出可以边算边发
- 工具调用过程可以被观察
- 其他客户端也可以订阅同一次 run 的事件

这跟“等模型一次性吐完一整段字符串再显示”的简单做法，已经不是一个层级的系统了。

## 3. 为什么 `Gateway` 在 OpenClaw 里是第一公民

如果只看功能表，很容易误以为 OpenClaw 的核心就是 Agent。

但只要你去看 [`docs/concepts/architecture.md`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/docs/concepts/architecture.md) 和 [`src/gateway/server.impl.ts`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/src/gateway/server.impl.ts)，你会发现它真正的中心更像是 `Gateway`。

文档里有一句话我觉得非常关键：

- **One Gateway per host**

这句话的潜台词是：

- 同一台机器上，很多状态必须收口到一个常驻进程里

比如：

- 渠道连接
- WebSocket 会话
- pairing / auth
- node 设备连接
- health / status
- cron / canvas / control UI

这些东西都不适合散落在一堆短命进程里。

### 3.1 `Gateway` 启动代码本身就像一段系统装配过程

下面是裁剪自 `startGatewayServer()` 的主体结构：

```ts
export async function startGatewayServer(port = 18789, opts = {}) {
  const configSnapshot = await loadGatewayStartupConfigSnapshot(...)
  const authBootstrap = await prepareGatewayStartupConfig(...)
  const pluginBootstrap = await prepareGatewayPluginBootstrap(...)

  const channelManager = createChannelManager(...)
  const runtimeState = await createGatewayRuntimeState(...)

  attachGatewayWsHandlers({
    channelManager,
    runtimeState,
    // 省略大量依赖
  })
}
```

你看这段代码的气质就知道，它不是“跑个模型”那么简单。

它真正做的是：

- 读取启动配置
- 准备认证和安全参数
- 先把插件系统启动好
- 再把 channel manager 建起来
- 再创建 HTTP / WS 运行时
- 最后把各种 handler 挂上去

这就是很典型的 server assembly，也就是“服务装配”。

### 3.2 为什么一定要先有 Gateway，再谈 Agent

这是 OpenClaw 很值得讲的一个架构判断。

如果没有 `Gateway`，你会遇到一堆很快就爆出来的问题：

- WhatsApp、Telegram、Slack 各自一套接入逻辑怎么统一
- 一个 macOS app 和一个 Web UI 同时连进来，状态怎么同步
- 同一台机器上的设备节点怎么发现和配对
- Agent 的流式事件由谁广播
- 健康检查、RPC、控制台、Canvas 用什么协议接

而有了 Gateway 以后，很多事情都会自然收口：

- 所有入口都先转成统一协议
- 所有 session 都先进入统一控制平面
- 所有事件都从统一出口广播
- 所有安全和配对策略也能统一处理

所以从架构角度看，OpenClaw 的核心命题其实不是：

- “怎么把一个 LLM 跑起来”

而更像是：

- “怎么让一个个人 AI 助手长期、稳定、可控地活在你的设备和渠道里”

## 4. Agent Loop 在 OpenClaw 里不是入口，而是执行引擎

很多 Agent 项目会把“Agent 主循环”当成系统中心，这没有问题。

但 OpenClaw 有个很有意思的取舍：

- 它当然也重视 Agent Loop
- 但它把 Agent Loop 放在 `Gateway` 之后

这意味着：

- Agent Loop 很重要
- 但它是被控制平面调度的一部分，而不是整个系统唯一的核心

### 4.1 Agent Loop 最重要的，不是“会调用工具”，而是“会被系统化地观察”

在 `agent-loop.md` 里，OpenClaw 明确把运行时事件拆成了三类：

- `assistant`
- `tool`
- `lifecycle`

这个划分非常有产品意识。

因为一旦你把一次 Agent run 当成可观察事件流，而不是黑盒函数，你就能做很多后续能力：

- 聊天界面显示流式回复
- 旁路客户端订阅同一次 run
- 记录工具调用轨迹
- 给 `agent.wait` 提供真实等待语义
- 让调试和诊断更容易

也就是说，它不是只有“结果”，而是有“过程”。

### 4.2 它为什么要强调 `lifecycle end/error`

这看上去像文档细节，其实很重要。

如果一个 Agent 系统只有流式文本，没有明确生命周期，那很多上层逻辑都会很难写：

- 前端什么时候把 loading 关掉
- 什么时候把一段 delta 合并成 final
- 工具已经结束了还是还在跑
- 失败了是模型失败、工具失败还是纯等待超时

OpenClaw 在这里给出的答案很务实：

- 你必须把一次 run 当成有开始、有结束、有错误状态的真实生命周期对象

这也是为什么它更像“产品级运行时”，而不是简单 demo。

## 5. OpenClaw 最值钱的设计：插件不是附件，而是平台骨架

如果你只挑一个点拿去做技术分享，我会选插件体系。

因为 OpenClaw 的插件不是传统意义上的“可选扩展包”，而更像：

- 整个平台真正的能力拼装方式

这点在 [`docs/plugins/architecture.md`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/docs/plugins/architecture.md) 里写得很清楚。

它的核心思想可以浓缩成一句话：

> 先用 manifest 和元数据完成发现、校验、选择，再在 runtime 里真正注册能力。

这跟很多项目“一上来先 import 插件代码”很不一样。

### 5.1 为什么要分成“先发现，再执行”

因为平台要解决的不只是“插件能不能跑”，还要解决这些问题：

- 配置是否合法
- 这个插件有没有被启用
- 它归属于哪个命令
- setup / doctor / wizard 能不能在不启动插件运行时代码的前提下工作
- UI 能不能先看到配置 schema 和提示信息

也就是说，**系统想先看懂插件，再决定要不要运行插件。**

这是平台化思维非常典型的一个标志。

### 5.2 一个渠道插件长什么样

先看 WhatsApp 渠道插件，裁剪自 [`extensions/whatsapp/index.ts`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/extensions/whatsapp/index.ts)：

```ts
export default defineBundledChannelEntry({
  id: "whatsapp",
  name: "WhatsApp",
  plugin: {
    specifier: "./channel-plugin-api.js",
    exportName: "whatsappPlugin",
  },
  runtime: {
    specifier: "./runtime-api.js",
    exportName: "setWhatsAppRuntime",
  },
})
```

这段代码说明两件事：

1. 这是一个明确声明出来的 channel entry
1. 它把“插件定义”和“运行时注入”都单独指出来了

也就是说，OpenClaw 不是靠某个目录约定“猜”出来这是 WhatsApp，而是让插件自己把边界说清楚。

### 5.3 一个 provider 插件长什么样

再看 OpenAI 插件，裁剪自 [`extensions/openai/index.ts`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/extensions/openai/index.ts)：

```ts
export default definePluginEntry({
  id: "openai",
  register(api) {
    api.registerCliBackend(...)
    api.registerProvider(...)
    api.registerImageGenerationProvider(...)
    api.registerRealtimeTranscriptionProvider(...)
    api.registerRealtimeVoiceProvider(...)
    api.registerSpeechProvider(...)
    api.registerMediaUnderstandingProvider(...)
    api.registerVideoGenerationProvider(...)
  },
})
```

这段代码特别值得讲，因为它暴露了 OpenClaw 的一个核心设计原则：

- 插件不是围绕“厂商名”组织的
- 插件最终要落到“能力注册”上

换句话说，`openai` 这个插件最重要的不是“它叫 OpenAI”，而是它注册了：

- 文本推理
- 图像生成
- 语音
- 实时语音
- 媒体理解
- 视频生成

这就是 capability 模型的价值。

### 5.4 这种设计比“每接一个功能就加一堆 if/else”高明在哪

因为当系统越来越大时，真正难的不是“接一个新模型”，而是：

- 接入之后，原有系统还能不能保持统一抽象

比如如果没有 capability 抽象，系统很容易退化成这样：

- OpenAI 走一套逻辑
- Anthropic 走另一套逻辑
- 图像和语音再各写一层特殊分支
- 渠道接入再各自带一堆私有 runtime

最后核心层会变成一团针对厂商和渠道名字写死的分支网。

OpenClaw 在这里做的事情，本质上是在努力防止这种失控：

- provider 说清楚自己提供什么能力
- channel 说清楚自己接入什么消息面
- core 只消费统一抽象，不直接写死对某个厂商的特殊偏爱

## 6. 这种设计到底解决了什么工程问题

到这里其实可以把 OpenClaw 的设计价值总结成四句话。

### 6.1 渠道多，但不会直接把核心逻辑拖散

因为渠道先被 `Gateway` 和 channel plugin 吸收掉了。

这样核心层不用到处写：

- 如果是 WhatsApp 就怎样
- 如果是 Slack 就怎样
- 如果是 Telegram 再怎样

渠道差异会有，但它们被压在插件边界附近，而不是一路渗到整个系统里。

### 6.2 模型多，但不会让主流程碎成很多套

因为 provider 最终都被能力注册统一掉了。

所以系统关注的是：

- 谁能提供文本能力
- 谁能提供语音能力
- 谁能提供媒体理解

而不是一上来就把所有逻辑都绑死在具体厂商上。

### 6.3 前端、CLI、移动端和设备节点可以共用一套控制平面

这是 `Gateway` 最大的价值之一。

如果没有统一控制平面，通常会出现：

- macOS app 一套状态
- Web UI 一套状态
- CLI 再自己维护一套状态

OpenClaw 明显不想这样做，所以它宁愿先把协议、连接、认证、广播这些基础设施做扎实。

### 6.4 安全和运维不是后补的

这个仓库里有非常多你在普通 Agent demo 里几乎见不到的东西：

- pairing
- auth mode
- token / password
- daemon
- health
- status
- sandbox
- Tailscale / SSH remote access

这说明它一开始就把“系统怎么活在真实环境里”当成核心问题，而不是最后再缝进去。

## 7. 如果把这篇文章讲成一场 30 分钟技术分享，我会怎么讲

如果是面对工程同学，我会按下面这条节奏讲。

### 7.1 第 1 部分：先讲它不是普通聊天机器人

用 3 分钟讲清楚：

- OpenClaw 不是 prompt demo
- 它想做的是个人 AI 助手平台
- 平台的关键词是：长期在线、统一入口、能力扩展、跨端协同

### 7.2 第 2 部分：用一条消息把系统串起来

用 5 分钟讲主链路：

- message in
- gateway normalize
- session lane queue
- agent loop
- tool / provider / plugin
- stream back

这一段最容易让听众“先抓住主线”。

### 7.3 第 3 部分：解释为什么 Gateway 才是第一公民

用 6 分钟讲清楚：

- 为什么 one gateway per host
- 为什么控制平面要先存在
- 为什么渠道、节点、canvas、health、pairing 都得收口

这一段是区分 OpenClaw 和很多普通 Agent 仓库的关键。

### 7.4 第 4 部分：讲 Agent Loop 但不要只讲 tool calling

用 6 分钟讲：

- session 串行化
- global concurrency
- lifecycle / assistant / tool 三类事件
- `agent.wait` 这种“运行时语义”为什么重要

这一段的重点不是“模型会调用工具”，而是“系统如何可靠地跑一轮 Agent”。

### 7.5 第 5 部分：重点讲插件体系

用 7 分钟讲：

- manifest discovery
- runtime registration
- capability model
- channel plugin 和 provider plugin 的差别
- 为什么平台必须先看懂插件，再运行插件

这一段最有技术深度，也最像架构设计分享。

### 7.6 第 6 部分：最后讲 trade-off

用 3 分钟收尾：

- 这种系统更强大
- 但也更重
- 它不像小型 Agent 仓库那样容易一眼看透
- 可是一旦你关心“产品级 Agent 平台”，它就很值得看

## 8. 我对 OpenClaw 的判断

如果让我用一句话评价这个仓库，我会说：

**OpenClaw 最值得学的，不是怎么写一个 Agent，而是怎么把 Agent 做成一个平台。**

它让我印象最深的，不是某个提示词技巧，也不是某个工具调用细节，而是这几个架构判断：

- `Gateway` 优先
- session 内串行
- plugin 按 capability 注册
- manifest 和 runtime 分层
- 安全、运维、跨端从一开始就算在系统里

所以如果你的目标是：

- 学 prompt engineering
- 学最小可运行 Agent demo
- 学一个很轻量的单机工具调用循环

那 OpenClaw 可能不是最短路径。

但如果你的目标是：

- 理解一个“能落地”的个人 AI 助手系统该怎么设计
- 理解控制平面、会话队列、插件平台、跨端协议这些问题
- 学习“当 Agent 从 demo 走向产品时，代码结构为什么会变化”

那 OpenClaw 是一个很好的样本。

## 9. 结尾

最后再把全文压缩成一句话：

- OpenClaw 的重点从来不只是“让模型会干活”，而是“让一个个人 AI 助手，能作为系统长期活着”。

如果后面我继续往下写，我最想继续展开的有两块：

- 它的 `message tool` 和 channel action 共享抽象到底怎么收口
- 它的 `node`、`canvas`、`voice` 这些设备侧能力，是怎么接入同一套 Gateway 协议的

如果你是带着“技术分享”目的来读这个仓库，我建议你优先看这几份材料：

- [README](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/README.md)
- [Gateway Architecture](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/docs/concepts/architecture.md)
- [Agent Loop](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/docs/concepts/agent-loop.md)
- [Plugin Internals](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/docs/plugins/architecture.md)
- [`src/gateway/server.impl.ts`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/src/gateway/server.impl.ts)
- [`src/agents/pi-embedded-runner/run.ts`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/src/agents/pi-embedded-runner/run.ts)
- [`extensions/openai/index.ts`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/extensions/openai/index.ts)
- [`extensions/whatsapp/index.ts`](https://github.com/openclaw/openclaw/blob/56625a189bf36d4a1a239fef30b93fb07760945d/extensions/whatsapp/index.ts)
