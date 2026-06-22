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

<figure class="fz015" data-reveal role="group" aria-label="OpenClaw 的 4 层结构示意图：入口层经 Gateway 控制平面到 Agent 执行层，再到底部能力层，数据自上而下流动"><style>.fz015{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gr:#4f7233;--grb:#e7eedd;--grl:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--pu:#54579a;--pub:#e6e7f3;--pue:#a9adcf;--gy:#917f5c;--gyb:#ece4d2;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);margin:0;padding:clamp(16px,3.5vw,30px);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;box-sizing:border-box;max-width:100%}.fz015 *{box-sizing:border-box}.fz015 .hd{text-align:center;margin-bottom:clamp(14px,3vw,24px)}.fz015 .t{font-weight:700;font-size:clamp(20px,4.2vw,30px);letter-spacing:.5px;color:var(--ink,#1a1815)}.fz015 .s{font-size:clamp(12px,2.5vw,16px);color:var(--muted,#6a6155);margin-top:6px}.fz015 .stack{display:flex;flex-direction:column;align-items:center;gap:0}.fz015 .layer{width:100%;border-radius:16px;border:1.5px solid;padding:clamp(12px,2.6vw,18px) clamp(14px,3vw,22px);text-align:center;position:relative;opacity:0;transform:translateY(10px);animation:fz015in .7s ease forwards}.fz015 .l1{max-width:78%;background:var(--pub,#e6e7f3);border-color:var(--pue,#a9adcf);animation-delay:.05s}.fz015 .l2{max-width:92%;background:var(--amb,#f4e8cc);border-color:var(--ame,#d9b66a);animation-delay:.45s}.fz015 .l3{max-width:78%;background:var(--grb,#e7eedd);border-color:var(--grl,#7c9c54);animation-delay:.85s}.fz015 .bt{font-weight:700;font-size:clamp(15px,3vw,22px);color:var(--ink,#1a1815)}.fz015 .l1 .bt{color:var(--pu,#54579a)}.fz015 .l2 .bt{color:var(--am,#9a6516)}.fz015 .l3 .bt{color:var(--gr,#4f7233)}.fz015 .bx{font-size:clamp(12px,2.5vw,16px);color:var(--ink-soft,#3c362c);margin-top:7px;line-height:1.55}.fz015 .nt{font-size:clamp(11px,2.2vw,14px);color:var(--muted,#6a6155);margin-top:7px;font-style:italic}.fz015 .conn{width:4px;height:clamp(26px,5vw,42px);position:relative;overflow:hidden;border-radius:3px;background:var(--hair,rgba(26,24,21,.18));margin:6px 0}.fz015 .conn::before{content:"";position:absolute;left:0;right:0;top:-40%;height:55%;background:linear-gradient(180deg,transparent,var(--gy,#917f5c),transparent);animation:fz015flow 5s linear infinite}.fz015 .c2::before{animation-delay:.9s}.fz015 .c3::before{animation-delay:1.8s}.fz015 .conn::after{content:"";position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid var(--muted,#6a6155)}.fz015 .caps{width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,1.8vw,14px);margin-top:6px}.fz015 .cap{background:var(--paper-soft,#faf6ec);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:13px;padding:clamp(11px,2.4vw,16px) clamp(6px,1.5vw,12px);text-align:center;font-size:clamp(11px,2.3vw,15px);font-weight:600;color:var(--ink-soft,#3c362c);line-height:1.5;opacity:0;transform:translateY(8px);animation:fz015in .6s ease forwards;position:relative}.fz015 .cap::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px}.fz015 .cap:nth-child(1){animation-delay:1.2s}.fz015 .cap:nth-child(1)::before{background:var(--pu,#54579a)}.fz015 .cap:nth-child(2){animation-delay:1.35s}.fz015 .cap:nth-child(2)::before{background:var(--cy,#3f6d79)}.fz015 .cap:nth-child(3){animation-delay:1.5s}.fz015 .cap:nth-child(3)::before{background:var(--am,#9a6516)}.fz015 .cap:nth-child(4){animation-delay:1.65s}.fz015 .cap:nth-child(4)::before{background:var(--gr,#4f7233)}.fz015 .gloss{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.28) 50%,transparent 65%);background-size:280% 100%;animation:fz015sheen 10s ease-in-out infinite;pointer-events:none}.fz015 .l2 .gloss{animation-delay:1.4s}@keyframes fz015in{to{opacity:1;transform:translateY(0)}}@keyframes fz015flow{0%{top:-55%}100%{top:105%}}@keyframes fz015sheen{0%,55%{background-position:130% 0}80%,100%{background-position:-130% 0}}@media(max-width:560px){.fz015 .l1,.fz015 .l3{max-width:96%}.fz015 .l2{max-width:100%}.fz015 .caps{grid-template-columns:repeat(2,1fr)}}@media(prefers-reduced-motion:reduce){.fz015 .layer,.fz015 .cap{animation:none;opacity:1;transform:none}.fz015 .conn::before{animation:none;display:none}.fz015 .gloss{animation:none;display:none}}</style><div class="hd"><div class="t">OpenClaw 的 4 层结构</div><div class="s">它更像一个个人 AI 助手平台，而不是单纯的聊天机器人</div></div><div class="stack"><div class="layer l1"><span class="gloss"></span><div class="bt">入口层</div><div class="bx">聊天渠道、CLI、Web UI、macOS App、iOS / Android Node</div></div><div class="conn c1"></div><div class="layer l2"><span class="gloss"></span><div class="bt">Gateway 控制平面</div><div class="bx">统一协议、WebSocket / HTTP、认证、配对、健康检查、状态广播</div><div class="nt">同一台机器上长期运行的总入口，负责把所有连接和状态收口</div></div><div class="conn c2"></div><div class="layer l3"><span class="gloss"></span><div class="bt">Agent 执行层</div><div class="bx">Session、Lane Queue、Agent Loop、Tool Calling、流式事件</div></div><div class="conn c3"></div><div class="caps"><div class="cap">模型 Provider</div><div class="cap">消息 Channel</div><div class="cap">语音 / 图像 / 搜索</div><div class="cap">Canvas / Node / 设备能力</div></div></div></figure>

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

<figure class="fz016" data-reveal role="group" aria-label="一条消息在 OpenClaw 里的完整路径：从用户消息经 Gateway 接入、Session Lane 排队到 Agent Loop，再向下分发到插件工具、Provider 与渠道回写"><style>.fz016{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--purple:#54579a;--purple-bg:#e6e7f3;--purple-bd:#a9adcf;--amber:#9a6516;--amber-bg:#f4e8cc;--amber-bd:#d9b66a;--green:#4f7233;--green-bg:#e7eedd;--green-bd:#7c9c54;--teal:#3f6d79;--teal-bg:#dcebed;--teal-bd:#8fbcc4;--gray:#917f5c;--gray-bg:#ece4d2;margin:0;padding:clamp(16px,3vw,30px);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:16px;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-sizing:border-box;overflow:hidden}.fz016 *{box-sizing:border-box}.fz016 .hd{text-align:center;margin-bottom:clamp(14px,2.4vw,24px)}.fz016 .t{font-size:clamp(17px,2.7vw,25px);font-weight:700;letter-spacing:.4px;color:var(--ink,#1a1815)}.fz016 .s{margin-top:6px;font-size:clamp(11px,1.7vw,14px);color:var(--muted,#6a6155);line-height:1.5}.fz016 .flow{display:flex;align-items:stretch;justify-content:center;gap:0;flex-wrap:wrap}.fz016 .node{flex:1 1 130px;min-width:120px;border-radius:14px;padding:clamp(10px,1.5vw,15px) 10px;text-align:center;border:1.5px solid var(--hair);background:#fff;position:relative;display:flex;flex-direction:column;justify-content:center;gap:5px;animation:fz016pop 9s ease-in-out infinite}.fz016 .node .nt{font-size:clamp(13px,1.9vw,17px);font-weight:700;letter-spacing:.3px}.fz016 .node .nx{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,12px);color:var(--ink-soft,#3c362c);line-height:1.45}.fz016 .n1{background:var(--purple-bg);border-color:var(--purple-bd)}.fz016 .n1 .nt{color:var(--purple)}.fz016 .n2{background:var(--amber-bg);border-color:var(--amber-bd)}.fz016 .n2 .nt{color:var(--amber)}.fz016 .n3{background:var(--green-bg);border-color:var(--green-bd)}.fz016 .n3 .nt{color:var(--green)}.fz016 .n4{background:var(--teal-bg);border-color:var(--teal-bd)}.fz016 .n4 .nt{color:var(--teal)}.fz016 .n1{animation-delay:0s}.fz016 .n2{animation-delay:.5s}.fz016 .n3{animation-delay:1s}.fz016 .n4{animation-delay:1.5s}@keyframes fz016pop{0%,100%{transform:translateY(0);box-shadow:0 1px 0 var(--hair)}45%{transform:translateY(-3px);box-shadow:0 6px 16px -8px rgba(26,24,21,.32)}}.fz016 .arr{flex:0 0 30px;align-self:center;height:24px;position:relative;min-width:24px}.fz016 .arr::before{content:"";position:absolute;top:50%;left:2px;right:9px;height:3px;transform:translateY(-50%);border-radius:2px;background:linear-gradient(90deg,var(--hair),var(--muted) 50%,var(--hair));background-size:220% 100%;animation:fz016slide 3.2s linear infinite}.fz016 .arr::after{content:"";position:absolute;top:50%;right:2px;transform:translateY(-50%);width:0;height:0;border-left:9px solid var(--muted);border-top:6px solid transparent;border-bottom:6px solid transparent}.fz016 .arr i{display:none}.fz016 .fan{margin-top:clamp(14px,2.4vw,22px);position:relative}.fz016 .fanwrap{text-align:center;margin-bottom:clamp(12px,2vw,20px)}.fz016 .fanlbl{font-family:var(--font-mono,ui-monospace,monospace);font-size:clamp(10px,1.4vw,12px);color:var(--teal);background:var(--teal-bg);border:1px dashed var(--teal-bd);display:inline-block;padding:3px 12px;border-radius:20px;position:relative}.fz016 .fanlbl::after{content:"";position:absolute;left:50%;top:100%;width:3px;height:clamp(12px,2vw,20px);transform:translateX(-50%);background:linear-gradient(180deg,var(--teal-bd),var(--hair));background-size:100% 200%;animation:fz016slidev 3.2s linear infinite}.fz016 .row2{display:flex;gap:clamp(10px,2vw,20px);justify-content:center;flex-wrap:wrap}.fz016 .leaf{flex:1 1 170px;min-width:150px;background:#fff;border:1.5px solid var(--hair);border-radius:14px;padding:clamp(11px,1.6vw,16px) 12px;text-align:center;position:relative;animation:fz016rise 8s ease-in-out infinite}.fz016 .leaf::before{content:"";position:absolute;left:50%;top:-1px;width:3px;height:clamp(12px,2vw,20px);transform:translate(-50%,-100%);background:linear-gradient(180deg,var(--hair),var(--muted));background-size:100% 200%;animation:fz016slidev 3.2s linear infinite}.fz016 .leaf::after{content:"";position:absolute;left:50%;top:-1px;transform:translate(-50%,calc(-100% - clamp(12px,2vw,20px)));width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--muted)}.fz016 .leaf .lt{font-size:clamp(13px,1.8vw,16px);font-weight:700;color:var(--ink,#1a1815);margin-bottom:5px}.fz016 .leaf .lx{font-family:var(--font-mono,ui-monospace,monospace);font-size:clamp(10px,1.4vw,12px);color:var(--muted,#6a6155);line-height:1.45}.fz016 .l1{animation-delay:0s}.fz016 .l1 .lt{color:var(--green)}.fz016 .l2{animation-delay:.6s}.fz016 .l2 .lt{color:var(--purple)}.fz016 .l3{animation-delay:1.2s}.fz016 .l3 .lt{color:var(--amber)}@keyframes fz016rise{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes fz016slide{from{background-position:120% 0}to{background-position:-120% 0}}@keyframes fz016slidev{from{background-position:0 120%}to{background-position:0 -120%}}.fz016 .note{margin-top:clamp(16px,2.6vw,24px);text-align:center;font-size:clamp(11px,1.6vw,14px);color:var(--ink-soft,#3c362c);line-height:1.6;border-top:1px solid var(--hair);padding-top:clamp(11px,1.8vw,16px)}.fz016 .note b{color:var(--green);font-weight:700}.fz016 .note em{font-style:normal;color:var(--teal);font-weight:700}@media(max-width:560px){.fz016 .flow{flex-direction:column;align-items:stretch}.fz016 .node{flex-basis:auto}.fz016 .arr{flex-basis:auto;width:24px;height:30px;margin:2px auto;align-self:center}.fz016 .arr::before{left:50%;right:auto;top:2px;bottom:9px;width:3px;height:auto;transform:translateX(-50%);background:linear-gradient(180deg,var(--hair),var(--muted) 50%,var(--hair));background-size:100% 220%;animation:fz016slidev 3.2s linear infinite}.fz016 .arr::after{right:auto;left:50%;top:auto;bottom:2px;transform:translateX(-50%);border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid var(--muted);border-bottom:0}.fz016 .row2{flex-direction:column}.fz016 .leaf{flex-basis:auto}}@media (prefers-reduced-motion:reduce){.fz016 .node,.fz016 .leaf,.fz016 .arr::before,.fz016 .fanlbl::after,.fz016 .leaf::before{animation:none}.fz016 .node{transform:none;box-shadow:0 1px 0 var(--hair)}.fz016 .leaf{transform:none}.fz016 .arr::before{background:var(--muted)}.fz016 .leaf::before,.fz016 .fanlbl::after{background:var(--muted)}}</style><div class="hd"><div class="t">一条消息在 OpenClaw 里的完整路径</div><div class="s">重点不只是模型回答，而是消息、队列、事件和回写都走统一流程</div></div><div class="flow"><div class="node n1"><div class="nt">用户消息</div><div class="nx">WhatsApp<br>CLI / Web UI</div></div><div class="arr" aria-hidden="true"><i></i></div><div class="node n2"><div class="nt">Gateway 接入</div><div class="nx">统一协议<br>绑定 session</div></div><div class="arr" aria-hidden="true"><i></i></div><div class="node n3"><div class="nt">Session Lane</div><div class="nx">同一会话先排队<br>避免状态打架</div></div><div class="arr" aria-hidden="true"><i></i></div><div class="node n4"><div class="nt">Agent Loop</div><div class="nx">模型推理 + 工具调用<br>assistant / tool / lifecycle</div></div></div><div class="fan"><div class="fanwrap"><div class="fanlbl">Agent Loop 向下分发</div></div><div class="row2"><div class="leaf l1"><div class="lt">插件 / 工具</div><div class="lx">message、browser、canvas</div></div><div class="leaf l2"><div class="lt">Provider</div><div class="lx">OpenAI、Anthropic、Google</div></div><div class="leaf l3"><div class="lt">渠道回写</div><div class="lx">把结果发回原渠道</div></div></div></div><div class="note">关键点：同一个 <b>session</b> 先串行，再谈全局并发；系统最终拿到的不只是最终答案，还有<em>完整事件流</em>。</div></figure>

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
