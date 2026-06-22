---
title: "lark-cli 源码解析：一个面向 AI Agent 的命令平台，是怎么把命令、鉴权、MCP 和 Skills 组织起来的"
date: 2026-04-17 00:20:00
categories:
  - 技术
tags:
  - AI
  - Agent
  - CLI
  - Go
  - Lark
  - Feishu
  - 源码解析
  - 平台架构
excerpt: "从普通 CLI 和 agent-native CLI 的差别讲起，拆解 larksuite/cli 的三层命令体系、启动装配、元数据驱动命令、shortcut 框架、鉴权链路、MCP/Skills 设计与工程化测试策略。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

先用一句人话说清楚：`lark-cli` 是 Lark / 飞书官方开源的命令行工具，你可以把它理解成“把飞书能力统一搬到终端里的入口层”。它一头连着 Calendar、Docs、IM、Mail、Base、Sheets 等业务能力，另一头连着开发者脚本、自动化流程和 AI Agent 的执行链路。

它主要拿来做三类事情：

- 给人类用户一个统一的终端入口，快速完成查日程、读写文档、收发消息、操作表格、查询会议等高频动作
- 给脚本和工程系统一个稳定接口，把飞书能力接进批处理任务、流水线、内部平台或自动化工作流
- 给 AI Agent 一套结构化、可鉴权、可判错、可继续执行的工具接口，而不是让模型自己去猜网页流程或手拼 API 请求

对应地，它最适合出现的场景也很明确：

- 你本来就在飞书生态里做开发，希望用一个 CLI 收口大量 OpenAPI 能力
- 你在写自动化脚本、MCP 工具或者内部效率平台，不想自己重复造鉴权、参数解析和输出规范这些轮子
- 你在给 Agent 搭工具链，希望模型调用的是“稳定命令接口”，而不是脆弱的浏览器点击流

最近我花了一些时间看 [larksuite/cli](https://github.com/larksuite/cli) 这个仓库。

如果只看 README，你很容易先记住这些标签：

- Lark / 飞书官方 CLI
- 用 Go 写的命令行工具
- 覆盖 Calendar、Docs、IM、Mail、Base、Sheets 等大量业务域
- 支持 `Shortcuts`、`API Commands`、`Raw API`
- 还专门给 AI Agent 提供了一整套 `Skills`

但真正进源码以后，我觉得它最值得看的地方不是“命令很多”，而是下面这件事：

**它不是把 OpenAPI 生硬包成命令，而是在做一个面向 AI Agent 的命令平台。**

这句话说得再直白一点就是：

- 普通 CLI 的重点，通常是“人类用户好不好敲”
- `lark-cli` 的重点，除了“人好不好敲”，还包括“Agent 好不好调、好不好判错、好不好继续下一步”

所以，这个仓库真正有意思的地方，在于它同时处理了几件事：

- 给人类准备高频快捷命令
- 给平台 API 准备可扩展的元数据驱动命令
- 给 AI Agent 准备结构化输出、权限提示、技能文档和 MCP 接入

这篇文章会按下面这条主线展开：

1. 先把文中几个容易陌生的词讲清楚
1. 再解释为什么它不能只被看成“普通 CLI”
1. 然后拆开它的三层命令系统
1. 接着看程序启动时是怎么把这些能力装配起来的
1. 再看元数据驱动命令和 shortcut 框架各自解决什么问题
1. 然后重点分析鉴权、身份和 strict mode
1. 再解释它为什么对 AI Agent 特别友好
1. 最后补上工程化与测试策略

为了避免版本漂移，先说明本文的观察范围：

- 仓库：[larksuite/cli](https://github.com/larksuite/cli)
- 分支：`main`
- 阅读快照：`6ad25cd452b4ded6951c232eba41c993c92534f8`
- 观察时间：`2026-04-17`

另外，下面所有代码片段都是**裁剪版源码片段**：

- 只保留表达设计意图的主体逻辑
- 去掉了很多边界分支、日志和细节处理
- 目的是让没接触过 Go 的读者，也能先看懂“它到底想怎么组织系统”

## 阅读预备：先把几个容易陌生的词说人话

<figure class="fz036" data-reveal role="group" aria-label="先把几个词分层：命令树、身份、能力、输出四层横向流动，向下汇聚到给 Agent 的 Skills 工作说明书"><style>.fz036{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;padding:clamp(16px,3.2vw,30px);margin:0;font-family:var(--serif);color:var(--ink,#1a1815);box-shadow:0 1px 0 rgba(255,255,255,.5) inset}.fz036 .hd{margin-bottom:clamp(14px,2.6vw,22px)}.fz036 .ttl{font-size:clamp(20px,3.6vw,30px);font-weight:700;letter-spacing:.5px;line-height:1.2;color:var(--ink,#1a1815)}.fz036 .sub{margin-top:7px;font-size:clamp(12px,1.9vw,15px);line-height:1.55;color:var(--muted,#6a6155)}.fz036 .row{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(10px,1.8vw,18px);align-items:stretch;position:relative}.fz036 .cell{position:relative;display:flex}.fz036 .box{flex:1;border-radius:16px;padding:clamp(11px,1.7vw,16px);border:1px solid var(--bd);background:var(--bg);display:flex;flex-direction:column;gap:6px;min-width:0;opacity:0;transform:translateY(10px);animation:fz036rise .7s ease forwards;animation-delay:var(--d,0s);box-shadow:0 1px 2px rgba(26,24,21,.05)}.fz036 .box b{font-family:var(--mono);font-size:clamp(12px,1.85vw,16px);font-weight:700;color:var(--tk);letter-spacing:.2px;line-height:1.25}.fz036 .box small{font-size:clamp(11px,1.55vw,13px);line-height:1.45;color:var(--ink-soft,#3c362c)}.fz036 .c1{--bg:var(--c-cyan-bg,#dcebed);--bd:var(--c-cyan-bd,#8fbcc4);--tk:var(--c-cyan,#3f6d79)}.fz036 .c2{--bg:var(--c-amber-bg,#f4e8cc);--bd:var(--c-amber-bd,#d9b66a);--tk:var(--c-amber,#9a6516)}.fz036 .c3{--bg:var(--c-green-bg,#e7eedd);--bd:var(--c-green-bd,#7c9c54);--tk:var(--c-green,#4f7233)}.fz036 .c4{--bg:var(--c-purple-bg,#e6e7f3);--bd:var(--c-purple-bd,#a9adcf);--tk:var(--c-purple,#54579a)}.fz036 .lk{position:absolute;top:50%;right:calc(-1*clamp(10px,1.8vw,18px));width:clamp(10px,1.8vw,18px);height:2px;transform:translateY(-50%);z-index:3}.fz036 .lk::before{content:"";position:absolute;left:0;right:5px;top:0;height:2px;background:linear-gradient(90deg,transparent,var(--muted,#6a6155),transparent);background-size:220% 100%;animation:fz036flow 3.4s linear infinite;animation-delay:var(--fd,0s)}.fz036 .lk::after{content:"";position:absolute;top:50%;right:-1px;width:0;height:0;transform:translateY(-50%);border-top:4px solid transparent;border-bottom:4px solid transparent;border-left:6px solid var(--muted,#6a6155)}.fz036 .down{position:relative;height:clamp(34px,5.2vw,52px);display:flex;justify-content:center;align-items:center}.fz036 .down i{position:absolute;top:0;bottom:9px;width:2px;left:50%;transform:translateX(-50%);background:linear-gradient(180deg,transparent,var(--muted,#6a6155),transparent);background-size:100% 220%;animation:fz036flowv 3.4s linear infinite}.fz036 .down i::after{content:"";position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--muted,#6a6155)}.fz036 .skills{border-radius:18px;border:1px solid var(--c-gray-bd,#917f5c);background:var(--c-gray-bg,#ece4d2);padding:clamp(14px,2.4vw,22px);text-align:center;opacity:0;transform:translateY(12px);animation:fz036rise .8s ease .9s forwards;position:relative;overflow:hidden}.fz036 .skills::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 100% at 50% 0%,rgba(145,127,92,.16),transparent 60%);opacity:0;animation:fz036pulse 8s ease-in-out 1.4s infinite}.fz036 .skills h3{margin:0;font-family:var(--mono);font-size:clamp(16px,2.6vw,22px);font-weight:700;color:var(--c-gray,#917f5c);letter-spacing:.4px;position:relative}.fz036 .skills p{margin:8px 0 0;font-size:clamp(12px,1.8vw,15px);line-height:1.6;color:var(--ink-soft,#3c362c);position:relative}.fz036 .skills .note{margin-top:9px;font-size:clamp(11px,1.6vw,13px);color:var(--muted,#6a6155);font-style:italic;position:relative}.fz036 .skills .note b{font-style:normal;color:var(--c-green,#4f7233);font-weight:700}@keyframes fz036rise{to{opacity:1;transform:translateY(0)}}@keyframes fz036flow{0%{background-position:120% 0}100%{background-position:-120% 0}}@keyframes fz036flowv{0%{background-position:0 120%}100%{background-position:0 -120%}}@keyframes fz036pulse{0%,100%{opacity:0}50%{opacity:1}}@media(max-width:560px){.fz036 .row{grid-template-columns:1fr 1fr}.fz036 .lk{display:none}.fz036 .box{animation-delay:0s}}@media(prefers-reduced-motion:reduce){.fz036 .box,.fz036 .skills{opacity:1;transform:none;animation:none}.fz036 .lk::before,.fz036 .down i,.fz036 .skills::before{animation:none}.fz036 .skills::before{opacity:0}.fz036 .lk::before{background:var(--muted,#6a6155)}.fz036 .down i{background:var(--muted,#6a6155)}}</style><div class="hd"><div class="ttl">先把几个词分层</div><div class="sub">读 lark-cli 之前，先区分"命令、身份、能力、输出、Agent 指南"分别在管什么</div></div><div class="row"><div class="cell"><div class="box c1" style="--d:.05s"><b>Cobra / 命令树</b><small>负责把命令和参数挂出来</small></div><span class="lk" style="--fd:0s"></span></div><div class="cell"><div class="box c2" style="--d:.2s"><b>Credential / 身份</b><small>决定用 user 还是 bot</small></div><span class="lk" style="--fd:.5s"></span></div><div class="cell"><div class="box c3" style="--d:.35s"><b>OpenAPI / MCP</b><small>真正提供外部能力</small></div><span class="lk" style="--fd:1s"></span></div><div class="cell"><div class="box c4" style="--d:.5s"><b>Envelope / Hint</b><small>负责结构化输出和报错</small></div></div></div><div class="down"><i></i></div><div class="skills"><h3>Skills</h3><p>不是新协议，而是给 Agent 的工作说明书</p><p>它负责告诉 Agent：这个业务域里应该先做什么、后做什么、哪些步骤不能跳</p><div class="note">所以看这个仓库时，不要只盯命令本身，还要看<b>"命令怎么被 Agent 消费"</b></div></div></figure>

正式开始之前，先把文中会反复出现的词讲清楚。这里不追求教科书定义，而是让你在读后面源码分析时，知道每个词大概落在哪一层。

### 0.1 先分清这几个大角色

| 术语 | 可以先理解成 | 在本文里的具体意思 |
| --- | --- | --- |
| `CLI` | 命令行入口 | 全称是 Command Line Interface，也就是在终端里敲命令完成操作。比如 `lark-cli calendar +agenda` 就是通过命令行查日程。 |
| `AI Agent` / `Agent` | 会自己分步骤做事的模型助手 | 它不只是回答文字，还会读上下文、选择工具、调用命令、根据错误继续下一步。本文说的 Agent，重点是“会调用外部工具的执行者”。 |
| `OpenAPI` | 平台提供的标准接口 | 飞书把日历、文档、消息等能力开放成 HTTP API。CLI 本质上是在这些 API 之上再包一层更好用、更适合自动化的入口。 |
| `Command` | 一条可执行指令 | 例如 `calendar +agenda`、`auth login`。它是用户或 Agent 真正调用的最小入口。 |
| `Service` | 一组相关能力 | 比如 `calendar` 是日历服务，`im` 是消息服务，`docs` 是文档服务。一个 service 下面通常会挂很多 command。 |

可以先这样记：

**OpenAPI 是平台能力，CLI 把能力变成命令，Agent 再通过这些命令完成任务。**

### 0.2 再看命令系统里的词

| 术语 | 可以先理解成 | 在本文里的具体意思 |
| --- | --- | --- |
| `Cobra` | Go 里的命令行搭建框架 | 它帮开发者组织命令树、参数、帮助信息和自动补全。没有它也能写 CLI，但会重复处理大量命令解析细节。 |
| `命令树` | 命令的层级目录 | 类似文件夹结构：根命令下面挂 `auth`、`calendar`、`docs`，再往下挂更具体的子命令。用户敲命令时，就是沿着这棵树找到最后要执行的节点。 |
| `Shortcuts` | 高频任务快捷入口 | 它不是平台原生 API 名字，而是更接近用户说法的封装。比如用户想“看今天日程”，不一定想知道底层 API 叫 `events instance_view`。 |
| `API Commands` | 从平台 API 生成的命令 | 这一层更贴近官方 API 结构，适合覆盖大量服务和方法。它通常没 shortcut 那么顺口，但更完整。 |
| `Raw API` | 直接打原始接口的兜底入口 | 如果某个能力还没有 shortcut，也没有生成好的 API command，还可以通过 `api GET /open-apis/...` 直接请求底层接口。 |
| `schema` | 接口的结构说明 | 可以理解成“这条 API 应该怎么调用的说明书”：需要哪些参数、参数类型是什么、返回什么、支持什么身份。 |
| `Registry Meta` | 一批 API 的登记表 | 它把很多 service、resource、method、schema 放在一起，让 CLI 可以根据这份数据自动生成命令。 |

这里最容易混的是 `Shortcuts` 和 `API Commands`。

简单说：

- `Shortcuts` 更像“产品化后的高频按钮”
- `API Commands` 更像“把官方 API 按结构搬进命令行”
- `Raw API` 更像“什么都没封装时的手动兜底”

### 0.3 鉴权和身份相关的词

| 术语 | 可以先理解成 | 在本文里的具体意思 |
| --- | --- | --- |
| `鉴权` | 确认你有没有资格做这件事 | 不只是登录，还包括当前用什么身份、有没有权限、token 是否有效、scope 是否满足。 |
| `token` | 一张临时通行证 | 登录或授权之后拿到的一段凭证。CLI 后续调用 API 时带上它，平台才能知道“是谁在调用”。 |
| `scope` | 权限范围标签 | 比如读日历、发消息、创建文档是不同权限。一个 token 不一定拥有所有 scope，所以命令执行前要检查。 |
| `user` 身份 | 以真实用户身份操作 | 适合“查我的日程”“读我的文档”这类和个人上下文强相关的任务。权限来自用户授权。 |
| `bot` 身份 | 以应用机器人身份操作 | 适合自动化、后台任务、机器人消息等场景。权限来自应用配置，不等于某个自然人的权限。 |
| `auto` 身份 | 让 CLI 自动选择身份 | 用户不显式指定 `--as user` 或 `--as bot` 时，CLI 根据配置、命令支持情况和环境约束做选择。 |
| `Device Flow` | 适合 CLI 的网页登录授权流程 | CLI 先给出一个链接和设备码，用户在浏览器里确认授权，CLI 再轮询等待结果。它适合没有图形登录界面的终端场景。 |
| `credential provider` | 凭证来源适配器 | 它负责告诉 CLI token 从哪里来。可能来自本地配置，也可能来自环境变量、内部系统或扩展插件。 |
| `provider chain` | 按顺序尝试多个凭证来源 | CLI 先问第一个 provider 有没有账号和 token，没有就问下一个，最后再回退到默认配置。 |
| `Strict Mode` | 身份硬限制模式 | 比如某个运行环境只允许 `bot` 身份，那不兼容的命令会被提前禁用，而不是执行到一半才报错。 |

所以本文说“鉴权是骨架”，不是只说登录按钮，而是在说：

**每条命令真正执行前，都要先经过身份选择、token 获取、scope 检查和 strict mode 约束。**

### 0.4 Agent 友好性相关的词

| 术语 | 可以先理解成 | 在本文里的具体意思 |
| --- | --- | --- |
| `MCP` | Agent 接工具的统一协议 | 全称是 Model Context Protocol。它定义了 Agent 怎么发现工具、传参数、拿结果。这里可以把它理解成“Agent 和外部能力之间的插座规格”。 |
| `Skill` | 给 Agent 的工作流说明书 | 它不是新的 API，也不是模型训练材料，而是告诉 Agent 某类任务应该按什么步骤做、优先用哪些命令、什么时候需要用户确认。 |
| `结构化输出` | 机器容易解析的结果 | 不是随便打印一段自然语言，而是输出固定字段，比如 `ok`、`data`、`error.type`、`error.hint`。Agent 可以稳定读取这些字段。 |
| `envelope` | 响应外壳 | 像给业务结果套一层统一信封：里面有成功标记、身份、数据、元信息、错误提示。不同命令都按同一种外壳返回，调用方更好处理。 |
| `hint` | 下一步提示 | 错误或授权流程里给 Agent 的操作建议。比如权限不够时，不只是说失败，还会提示应该登录、补 scope，还是换身份。 |
| `stdout` | 标准输出，放机器要读的数据 | 对 Agent 来说，这里应该尽量只放 JSON 或真正结果，方便程序解析。 |
| `stderr` | 标准错误，放提示和诊断信息 | 这里更适合放进度、警告、调试提示，避免污染 `stdout` 里的结构化数据。 |
| `dry-run` | 只演练，不真的执行 | 命令先告诉你“如果真的执行会做什么”，但不发真实请求、不改真实数据。Agent 可以用它先确认风险。 |
| `E2E` | 端到端测试 | 从用户敲命令的入口开始测，直到输出结果为止。它验证的是整条链路，而不是某个小函数。 |

### 0.5 工程实现里会出现的词

| 术语 | 可以先理解成 | 在本文里的具体意思 |
| --- | --- | --- |
| `Factory` | 集中创建依赖的对象 | 它不是工厂厂房，而是一个“依赖取用中心”。命令需要配置、客户端、凭证时，都从这里拿，避免到处手动创建。 |
| `Runtime Context` | 命令执行时的上下文包 | 里面通常放当前身份、配置、输入参数、输出方法、客户端等。业务代码拿它就能知道“这次命令是在什么条件下跑的”。 |
| `stub` | 测试用的假实现 | 真实 API 很慢也有副作用，测试时会用 stub 假装返回结果，让测试更稳定。 |
| `embed` | 编译时打包进程序 | Go 可以把文件直接塞进最终二进制。这里表示把一份元数据快照内置进 CLI，离线时也有基线可用。 |
| `cache` | 本地缓存 | 远端拉下来的元数据先存在本地，下次不用每次都重新请求。 |
| `overlay` | 用新数据覆盖旧基线 | 内置元数据保证可用，远端新元数据保证更新。overlay 就是把远端更新叠到内置基线上。 |
| `RunE` | Cobra 里的命令执行函数 | 在 Cobra 中，一条命令真正运行的逻辑通常写在 `Run` 或 `RunE` 里。`RunE` 可以返回错误，方便统一错误处理。 |

如果你先记住一句话，后面会轻松很多：

**`lark-cli` 不是只在管理命令，它其实在管理“能力层、身份层、输出层和 agent 协作层”。**

## 1. 先别把它看成普通 CLI

<figure class="fz037" data-reveal role="group" aria-label="普通 CLI 和 agent-native CLI 的差别对比图"><style>.fz037{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--cyan:#3f6d79;--cyan-bg:#dcebed;--cyan-bd:#8fbcc4;--amber:#9a6516;--amber-bg:#f4e8cc;--amber-bd:#d9b66a;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:16px;margin:0;padding:clamp(18px,3.5vw,32px);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-sizing:border-box;overflow:hidden}.fz037 *{box-sizing:border-box}.fz037 .hd{margin-bottom:clamp(16px,2.6vw,26px)}.fz037 .ttl{font-size:clamp(19px,2.9vw,28px);font-weight:700;letter-spacing:.01em;line-height:1.3}.fz037 .sub{margin-top:8px;font-size:clamp(12px,1.6vw,15px);color:var(--muted,#6a6155);line-height:1.55}.fz037 .grid{display:grid;grid-template-columns:1fr auto 1fr;gap:clamp(10px,1.8vw,18px);align-items:stretch}.fz037 .card{position:relative;border-radius:14px;padding:clamp(14px,2.2vw,22px);border:1.5px solid var(--hair);background:var(--paper-deep,#ece5d5);overflow:hidden;animation:fzbreath 9s ease-in-out infinite}.fz037 .card::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(120deg,transparent 35%,rgba(255,255,255,.5) 50%,transparent 65%);background-size:240% 100%;animation:fzsheen 9s ease-in-out infinite}.fz037 .left{background:var(--cyan-bg,#dcebed);border-color:var(--cyan-bd,#8fbcc4)}.fz037 .right{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-bd,#d9b66a);animation-delay:-4.5s}.fz037 .right::before{animation-delay:-4.5s}.fz037 .ch{display:flex;align-items:center;gap:8px;font-weight:700;font-size:clamp(15px,2.1vw,21px);line-height:1.2;position:relative;z-index:1}.fz037 .left .ch{color:var(--cyan,#3f6d79)}.fz037 .right .ch{color:var(--amber,#9a6516)}.fz037 .dot{width:10px;height:10px;border-radius:50%;flex:none}.fz037 .left .dot{background:var(--cyan,#3f6d79);box-shadow:0 0 0 0 rgba(63,109,121,.4);animation:fzpulse 9s ease-out infinite}.fz037 .right .dot{background:var(--amber,#9a6516);box-shadow:0 0 0 0 rgba(154,101,22,.4);animation:fzpulseA 9s ease-out infinite;animation-delay:-4.5s}.fz037 .lead{margin:12px 0 4px;font-size:clamp(12px,1.65vw,15px);line-height:1.5;position:relative;z-index:1}.fz037 .left .lead{color:var(--cyan,#3f6d79)}.fz037 .right .lead{color:var(--amber,#9a6516)}.fz037 ul{list-style:none;margin:6px 0 0;padding:0;position:relative;z-index:1}.fz037 li{position:relative;padding:6px 0 6px 18px;font-size:clamp(12px,1.55vw,14.5px);line-height:1.45;color:var(--ink-soft,#3c362c);border-top:1px dashed var(--hair);opacity:0;transform:translateY(4px);animation:fzin 9s ease-out infinite}.fz037 li:first-child{border-top:none}.fz037 li::before{content:"";position:absolute;left:2px;top:13px;width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg)}.fz037 .left li{color:var(--cyan,#3f6d79)}.fz037 .right li{color:var(--amber,#9a6516)}.fz037 li b{color:var(--ink,#1a1815);font-weight:600}.fz037 .left li:nth-child(1){animation-delay:.2s}.fz037 .left li:nth-child(2){animation-delay:.5s}.fz037 .left li:nth-child(3){animation-delay:.8s}.fz037 .left li:nth-child(4){animation-delay:1.1s}.fz037 .right li:nth-child(1){animation-delay:.45s}.fz037 .right li:nth-child(2){animation-delay:.75s}.fz037 .right li:nth-child(3){animation-delay:1.05s}.fz037 .right li:nth-child(4){animation-delay:1.35s}.fz037 .rel{margin-top:12px;padding:9px 11px;border-radius:9px;font-size:clamp(11.5px,1.5vw,14px);line-height:1.45;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);position:relative;z-index:1}.fz037 .left .rel{background:rgba(63,109,121,.1);color:var(--cyan,#3f6d79)}.fz037 .right .rel{background:rgba(154,101,22,.1);color:var(--amber,#9a6516)}.fz037 .mid{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:clamp(40px,7vw,82px);gap:10px}.fz037 .vs{font-family:var(--font-mono,ui-monospace,monospace);font-size:clamp(12px,1.7vw,16px);font-weight:700;color:var(--muted,#6a6155);letter-spacing:.06em;padding:5px 8px;border:1px solid var(--hair);border-radius:20px;background:var(--paper-soft,#faf6ec)}.fz037 .flow{position:relative;width:clamp(30px,5vw,60px);height:9px;border-radius:5px;background:var(--hair);overflow:hidden}.fz037 .flow::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;border-radius:5px;background:linear-gradient(90deg,transparent,var(--amber,#9a6516),transparent);animation:fzflow 3.4s linear infinite}.fz037 .flow.rev::after{background:linear-gradient(90deg,transparent,var(--cyan,#3f6d79),transparent);animation:fzflowr 3.4s linear infinite;animation-delay:-1.7s}@keyframes fzbreath{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes fzsheen{0%,18%{background-position:160% 0}40%,100%{background-position:-160% 0}}@keyframes fzpulse{0%,70%,100%{box-shadow:0 0 0 0 rgba(63,109,121,0)}82%{box-shadow:0 0 0 6px rgba(63,109,121,0)}}@keyframes fzpulseA{0%,70%,100%{box-shadow:0 0 0 0 rgba(154,101,22,0)}82%{box-shadow:0 0 0 6px rgba(154,101,22,0)}}@keyframes fzin{0%,8%{opacity:0;transform:translateY(5px)}22%,92%{opacity:1;transform:translateY(0)}100%{opacity:1;transform:translateY(0)}}@keyframes fzflow{0%{left:-40%}100%{left:100%}}@keyframes fzflowr{0%{left:100%}100%{left:-40%}}@media(max-width:560px){.fz037 .grid{grid-template-columns:1fr;gap:14px}.fz037 .mid{flex-direction:row;min-width:0;width:100%;padding:2px 0}.fz037 .flow{width:46px}}@media (prefers-reduced-motion:reduce){.fz037 .card,.fz037 .card::before,.fz037 .dot,.fz037 li,.fz037 .flow::after{animation:none}.fz037 li{opacity:1;transform:none}.fz037 .card{transform:none}}</style><div class="hd"><div class="ttl">普通 CLI 和 agent-native CLI 的差别</div><div class="sub">lark-cli 更像"Agent 可调用的平台接口"，而不只是"给人手敲的命令工具"</div></div><div class="grid"><div class="card left"><div class="ch"><span class="dot"></span>普通 CLI</div><div class="lead">重点是人类用户体验</div><ul><li>命令短不短</li><li>帮助信息清不清楚</li><li>输出好不好读</li></ul><div class="rel">典型关系：人发命令，工具执行</div><ul><li><b>机器协作不是主要目标</b></li></ul></div><div class="mid"><div class="flow rev"></div><div class="vs">VS</div><div class="flow"></div></div><div class="card right"><div class="ch"><span class="dot"></span>agent-native CLI</div><div class="lead">重点是人和 Agent 都能稳定调用</div><ul><li>身份要可判断</li><li>成功失败要结构化</li><li>权限不足时要给下一步 hint</li></ul><div class="rel">典型关系：Agent 调命令，命令继续驱动工作流</div><ul><li><b>机器协作是一等目标</b></li></ul></div></div></figure>

我觉得读这个仓库时，第一步就要把视角摆正：

**它不是“一个支持很多命令的工具”，而是“一个给人和 Agent 共用的命令平台”。**

这个判断不是我硬拔高，而是仓库自己就写得很明确。

README 一开头就把它定义成：

- 官方 CLI
- built for humans and AI Agents
- 三层命令系统
- 自带 22 个 Skills

换句话说，它从设计目标上就和很多普通 CLI 不一样。

普通 CLI 最常见的优化目标，是这些问题：

- 参数是不是足够短
- 帮助信息是不是够清楚
- 终端输出是不是够友好

但 `lark-cli` 额外还要处理这些问题：

- Agent 能不能稳定判断成功和失败
- Agent 出错后能不能自动继续下一步
- Agent 能不能先 dry-run 再执行
- Agent 能不能知道这条命令支持 `user` 还是 `bot`
- Agent 在权限不够时，能不能拿到结构化 hint，而不是一段模糊报错

这也是为什么仓库里的 `AGENTS.md` 会把话说得这么直：

- 这个 CLI 的主要用户之一就是 AI agents
- 每一条错误信息都可能被 Agent 当成下一步行动依据
- `stdout` 是数据，`stderr` 是提示，不能乱混

这里的 `stdout / stderr` 可以理解成终端程序的两个输出通道。`stdout` 像正式结果区，适合放 JSON、列表、查询结果；`stderr` 像提示区，适合放进度、警告和诊断信息。人类看终端时两者经常混在一起也能看懂，但 Agent 往往会把 `stdout` 当作机器输入继续解析，所以这里不能随手打印无关文案。

所以你会发现，这个项目的很多设计，表面看像“实现细节”，其实背后都在服务一个核心目标：

**把命令行从“人类手敲工具”升级成“Agent 可组合调用的执行接口”。**

## 2. 先看全景图：为什么它要做三层命令系统

<figure class="fz038" data-reveal role="group" aria-label="三层命令系统：Shortcuts、API Commands、Raw API 三层自上而下的命令架构示意"><style>.fz038{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--amb:#9a6516;--amb-bg:#f4e8cc;--amb-bd:#d9b66a;--cy:#3f6d79;--cy-bg:#dcebed;--cy-bd:#8fbcc4;--gr:#4f7233;--gr-bg:#e7eedd;--gr-bd:#7c9c54;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;padding:clamp(18px,4vw,34px);margin:1.4rem 0;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 8px 26px rgba(26,24,21,.06);max-width:100%;box-sizing:border-box}.fz038 *{box-sizing:border-box}.fz038 .hd{margin-bottom:clamp(16px,3vw,26px)}.fz038 .ttl{font-weight:700;font-size:clamp(20px,3.6vw,30px);letter-spacing:.04em;color:var(--ink,#1a1815);line-height:1.2}.fz038 .sub{margin-top:.5em;font-size:clamp(12px,2.2vw,15px);color:var(--muted,#6a6155);letter-spacing:.05em}.fz038 .stack{display:flex;flex-direction:column;align-items:stretch;gap:0}.fz038 .layer{position:relative;border-radius:16px;border:2px solid var(--hair);background:var(--paper-deep,#ece5d5);padding:clamp(14px,2.6vw,22px) clamp(16px,3vw,28px);overflow:hidden;opacity:1;animation:fz038rise 9s ease-in-out infinite}.fz038 .layer::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:currentColor;opacity:.55}.fz038 .l1{color:var(--amb,#9a6516);background:var(--amb-bg,#f4e8cc);border-color:var(--amb-bd,#d9b66a);animation-delay:0s}.fz038 .l2{color:var(--cy,#3f6d79);background:var(--cy-bg,#dcebed);border-color:var(--cy-bd,#8fbcc4);animation-delay:.6s}.fz038 .l3{color:var(--gr,#4f7233);background:var(--gr-bg,#e7eedd);border-color:var(--gr-bd,#7c9c54);animation-delay:1.2s}.fz038 .lrow{display:flex;align-items:baseline;gap:.7em;flex-wrap:wrap}.fz038 .name{font-weight:700;font-size:clamp(17px,3vw,25px);color:var(--ink,#1a1815);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);letter-spacing:.01em}.fz038 .tag{font-family:var(--font-serif-body,"Songti SC",serif);font-size:clamp(10px,1.8vw,13px);font-weight:400;padding:.18em .7em;border-radius:999px;border:1px solid currentColor;color:inherit;background:rgba(255,255,255,.45);letter-spacing:.08em;white-space:nowrap}.fz038 .desc{margin-top:.55em;font-size:clamp(12px,2.3vw,16px);color:var(--ink-soft,#3c362c);line-height:1.55;letter-spacing:.02em}.fz038 .desc code{font-family:var(--font-mono,ui-monospace,monospace);font-size:.92em;background:rgba(26,24,21,.07);padding:.05em .35em;border-radius:4px;color:var(--ink,#1a1815)}.fz038 .flow{position:absolute;right:clamp(14px,3vw,26px);top:0;bottom:0;width:2px;background:linear-gradient(180deg,transparent,currentColor 40%,currentColor 60%,transparent);opacity:0;animation:fz038glow 9s ease-in-out infinite}.fz038 .l1 .flow{animation-delay:0s}.fz038 .l2 .flow{animation-delay:.6s}.fz038 .l3 .flow{animation-delay:1.2s}.fz038 .conn{position:relative;height:clamp(34px,6vw,52px);display:flex;justify-content:center;align-items:stretch}.fz038 .conn .line{width:3px;background:var(--muted,#6a6155);opacity:.5;border-radius:2px;position:relative;overflow:hidden}.fz038 .conn .line::after{content:"";position:absolute;left:-1px;right:-1px;height:42%;top:-42%;background:linear-gradient(180deg,transparent,var(--ink-soft,#3c362c),transparent);animation:fz038drop 4.2s ease-in-out infinite}.fz038 .conn .c2 .line::after{animation-delay:1.4s}.fz038 .conn .arw{position:absolute;left:50%;bottom:-1px;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid var(--muted,#6a6155);opacity:.7}.fz038 .legend{margin-top:clamp(16px,3vw,24px);display:flex;flex-wrap:wrap;gap:clamp(10px,2.5vw,22px);font-size:clamp(11px,1.9vw,13px);color:var(--muted,#6a6155);letter-spacing:.04em}.fz038 .legend span{display:inline-flex;align-items:center;gap:.45em}.fz038 .legend i{width:11px;height:11px;border-radius:3px;display:inline-block}.fz038 .dot-a{background:var(--amb,#9a6516)}.fz038 .dot-c{background:var(--cy,#3f6d79)}.fz038 .dot-g{background:var(--gr,#4f7233)}@keyframes fz038rise{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes fz038glow{0%,30%,100%{opacity:0}12%,20%{opacity:.45}}@keyframes fz038drop{0%{top:-42%}55%,100%{top:100%}}@media(max-width:560px){.fz038 .flow{display:none}.fz038 .tag{font-size:10px}.fz038 .conn{height:30px}}@media (prefers-reduced-motion:reduce){.fz038 .layer,.fz038 .flow,.fz038 .conn .line::after{animation:none}.fz038 .layer{transform:none;opacity:1}.fz038 .flow{opacity:0}}</style><div class="hd"><div class="ttl">三层命令系统</div><div class="sub">上层做体验，中层做规模，下层做兜底</div></div><div class="stack"><div class="layer l1"><span class="flow" aria-hidden="true"></span><div class="lrow"><b class="name">Shortcuts</b><span class="tag">体验 · 高频任务</span></div><div class="desc">面向高频任务：更像用户语言，带默认值、<code>format</code>、<code>dry-run</code></div></div><div class="conn" aria-hidden="true"><div class="line c1"></div><div class="arw"></div></div><div class="layer l2"><span class="flow" aria-hidden="true"></span><div class="lrow"><b class="name">API Commands</b><span class="tag">规模 · 平台 schema</span></div><div class="desc">面向平台 schema：规模化覆盖服务、资源、方法</div></div><div class="conn" aria-hidden="true"><div class="line c2"></div><div class="arw"></div></div><div class="layer l3"><span class="flow" aria-hidden="true"></span><div class="lrow"><b class="name">Raw API</b><span class="tag">兜底 · 原始调用</span></div><div class="desc">面向绝对兜底：只要 <code>OpenAPI</code> 在，就有原始调用路径</div></div></div><div class="legend"><span><i class="dot-a"></i>上层 Shortcuts：做体验</span><span><i class="dot-c"></i>中层 API Commands：做规模</span><span><i class="dot-g"></i>下层 Raw API：做兜底</span></div></figure>

这个仓库最应该先理解的，不是哪一个目录，而是它的三层命令系统：

1. `Shortcuts`
1. `API Commands`
1. `Raw API`

这三层不是重复造轮子，而是在解决三类不同的问题。

### 2.1 第一层：Shortcuts

这一层最接近“用户想做什么”。

比如你想看今天日程，你不一定想先去猜平台 API 的资源名、方法名和参数结构；你真正想说的是：

- 看我今天的日程
- 发一条消息
- 创建一篇文档

于是 `lark-cli` 提供了像下面这样的命令：

- `calendar +agenda`
- `im +messages-send`
- `docs +create`

这一层的特点是：

- 命令名字更像用户语言
- 参数通常更短
- 能带默认值、格式化输出、dry-run
- 适合高频场景

### 2.2 第二层：API Commands

这一层更接近平台官方 API。

比如：

- `calendar events instance_view`
- `calendar calendars list`

它们的核心价值不是“更好记”，而是：

- 和平台 schema 接近
- 能快速覆盖大量服务
- 当 shortcut 还没封装时，也有一条结构化调用路径

### 2.3 第三层：Raw API

这一层是最后的兜底：

- `lark-cli api GET /open-apis/...`

它的意义很明确：

- 不要求平台每个 API 都先被封装成命令
- 不要求每个命令都提前做产品化设计
- 只要底层 OpenAPI 在，就有一条原始调用路径

所以这三层的分工可以理解成：

- `Shortcuts` 解决高频体验
- `API Commands` 解决规模化覆盖
- `Raw API` 解决绝对兜底

这其实就是一种很典型的平台设计思路：

**上层做体验，中层做规模，下层做保底。**

## 3. 程序启动时，到底装配了什么

<figure class="fz039" data-reveal role="group" aria-label="lark-cli 启动与装配链路：main.go 到 Bootstrap 到 Factory 到 rootCmd 再到执行，以及 rootCmd 下挂的三类命令"><style>.fz039{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair);border-radius:18px;color:var(--ink,#1a1815);font-family:var(--serif);box-sizing:border-box;max-width:100%;overflow:hidden}.fz039 *{box-sizing:border-box}.fz039 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz039 .t1{font-size:clamp(19px,3.4vw,30px);font-weight:700;letter-spacing:.5px;color:var(--ink,#1a1815);line-height:1.2}.fz039 .t2{margin-top:6px;font-size:clamp(12px,2vw,16px);color:var(--muted,#6a6155);font-weight:400}.fz039 .flow{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px;margin-bottom:clamp(16px,2.6vw,26px)}.fz039 .node{position:relative;flex:1 1 120px;min-width:108px;border-radius:14px;padding:14px 12px;border:1.5px solid var(--hair);background:var(--paper-deep,#ece5d5);display:flex;flex-direction:column;justify-content:center;text-align:center;opacity:0;transform:translateY(8px);animation:fz039in .6s ease forwards}.fz039 .node b{display:block;font-size:clamp(14px,2.2vw,19px);font-weight:700;letter-spacing:.3px;font-family:var(--mono)}.fz039 .node small{display:block;margin-top:6px;font-size:clamp(10px,1.6vw,13px);color:var(--ink-soft,#3c362c);line-height:1.4;font-family:var(--serif)}.fz039 .n1{background:var(--cyan-bg,#dcebed);border-color:var(--cyan-bd,#8fbcc4);animation-delay:.1s}.fz039 .n1 b{color:var(--cyan,#3f6d79)}.fz039 .n2{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-bd,#d9b66a);animation-delay:.7s}.fz039 .n2 b{color:var(--amber,#9a6516)}.fz039 .n3{background:var(--green-bg,#e7eedd);border-color:var(--green-lt,#7c9c54);animation-delay:1.3s}.fz039 .n3 b{color:var(--green,#4f7233)}.fz039 .n4{background:var(--purple-bg,#e6e7f3);border-color:var(--purple-bd,#a9adcf);animation-delay:1.9s}.fz039 .n4 b{color:var(--purple,#54579a)}.fz039 .n5{flex:0 1 96px;min-width:84px;background:var(--red-bg,#f1ddd6);border-color:var(--red-bd,#cf9b90);animation-delay:2.5s}.fz039 .n5 b{color:var(--red,#8f2d20)}.fz039 .arr{flex:0 0 22px;align-self:center;position:relative;height:14px;min-width:18px}.fz039 .arr::before{content:"";position:absolute;top:50%;left:0;right:5px;height:2px;transform:translateY(-50%);background:linear-gradient(90deg,transparent,var(--muted,#6a6155) 30%,var(--muted,#6a6155));background-size:200% 100%;animation:fz039flow 4s linear infinite}.fz039 .arr::after{content:"";position:absolute;top:50%;right:0;transform:translateY(-50%);border-left:7px solid var(--muted,#6a6155);border-top:5px solid transparent;border-bottom:5px solid transparent}.fz039 .panel{position:relative;border:1.5px dashed var(--hair);border-radius:16px;background:var(--paper-soft,#f7f1e4);padding:clamp(16px,2.6vw,24px);opacity:0;transform:translateY(10px);animation:fz039in .7s ease .9s forwards}.fz039 .ph{text-align:center;font-size:clamp(15px,2.4vw,21px);font-weight:700;color:var(--ink,#1a1815);margin-bottom:14px}.fz039 .ph::before{content:"↑";display:inline-block;margin-right:8px;color:var(--purple,#54579a);font-family:var(--mono);animation:fz039bob 5s ease-in-out infinite}.fz039 .rows{display:flex;flex-direction:column;gap:9px}.fz039 .row{display:flex;align-items:center;gap:10px;padding:9px 13px;border-radius:11px;background:var(--paper-deep,#ece5d5);border-left:4px solid var(--hair);font-size:clamp(11px,1.8vw,15px);color:var(--ink-soft,#3c362c);line-height:1.4}.fz039 .row b{font-weight:700;font-family:var(--serif);white-space:nowrap}.fz039 .row code{font-family:var(--mono);font-size:.92em;color:var(--ink,#1a1815)}.fz039 .r1{border-left-color:var(--green,#4f7233);animation:fz039glow 8s ease-in-out infinite}.fz039 .r1 b{color:var(--green,#4f7233)}.fz039 .r2{border-left-color:var(--cyan,#3f6d79);animation:fz039glow 8s ease-in-out infinite;animation-delay:2.6s}.fz039 .r2 b{color:var(--cyan,#3f6d79)}.fz039 .r3{border-left-color:var(--amber,#9a6516);animation:fz039glow 8s ease-in-out infinite;animation-delay:5.2s}.fz039 .r3 b{color:var(--amber,#9a6516)}@keyframes fz039in{to{opacity:1;transform:translateY(0)}}@keyframes fz039flow{from{background-position:200% 0}to{background-position:0 0}}@keyframes fz039bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes fz039glow{0%,100%{background:var(--paper-deep,#ece5d5)}50%{background:#f6efdd}}@media(max-width:560px){.fz039 .flow{flex-direction:column;align-items:stretch}.fz039 .node,.fz039 .n5{flex:1 1 auto;min-width:0}.fz039 .arr{align-self:center;height:18px;min-width:14px;transform:rotate(90deg)}.fz039 .row{flex-wrap:wrap;gap:4px 10px}}@media(prefers-reduced-motion:reduce){.fz039 .node,.fz039 .panel{opacity:1!important;transform:none!important;animation:none!important}.fz039 .arr::before,.fz039 .ph::before,.fz039 .r1,.fz039 .r2,.fz039 .r3{animation:none!important}.fz039 .arr::before{background:var(--muted,#6a6155)}}</style><div class="hd"><div class="t1">启动与装配链路</div><div class="t2">入口很薄，重点在把依赖和命令树按顺序装起来</div></div><div class="flow"><div class="node n1"><b>main.go</b></div><div class="arr" aria-hidden="true"></div><div class="node n2"><b>Bootstrap</b><small>先拿 profile 等全局参数</small></div><div class="arr" aria-hidden="true"></div><div class="node n3"><b>Factory</b><small>集中装配置、client、credential</small></div><div class="arr" aria-hidden="true"></div><div class="node n4"><b>rootCmd</b><small>根命令和固定命令</small></div><div class="arr" aria-hidden="true"></div><div class="node n5"><b>执行</b></div></div><div class="panel"><div class="ph">rootCmd 下面继续挂三类东西</div><div class="rows"><div class="row r1"><b>固定命令</b><span><code>config / auth / schema / api / update</code></span></div><div class="row r2"><b>动态命令</b><span><code>service.RegisterServiceCommands</code></span></div><div class="row r3"><b>高频命令</b><span><code>shortcuts.RegisterShortcuts</code></span></div></div></div></figure>

理解完三层命令系统，再去看代码就顺很多了。

程序入口很薄，真正关键的是装配过程。

先看裁剪后的入口代码，对应源码里的 [`main.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/main.go)：

```go
package main // 这是 Go 程序的主包

import ( // 引入本文件需要的依赖
    "os" // 标准库，用来设置进程退出码
    "github.com/larksuite/cli/cmd" // 真正的命令装配入口在这里
    _ "github.com/larksuite/cli/extension/credential/env" // 仅为了触发 init，注册环境变量凭证提供方
) // 导入结束

func main() { // 程序入口函数
    os.Exit(cmd.Execute()) // 把控制权交给 cmd 层，并把返回值作为退出码
} // 入口结束
```

这个入口几乎不做业务逻辑，说明作者刻意把“启动”和“装配”分离开了。

真正的重点在 [`cmd/root.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/cmd/root.go)：

```go
f := cmdutil.NewDefault(inv) // 先创建一个默认 Factory，把配置、客户端、凭证等依赖集中起来

rootCmd.AddCommand(cmdconfig.NewCmdConfig(f)) // 注册配置相关命令
rootCmd.AddCommand(auth.NewCmdAuth(f)) // 注册鉴权相关命令
rootCmd.AddCommand(api.NewCmdApi(f, nil)) // 注册 raw api 命令
rootCmd.AddCommand(schema.NewCmdSchema(f, nil)) // 注册 schema 查看命令
service.RegisterServiceCommands(rootCmd, f) // 注册基于元数据自动生成的 API Commands
shortcuts.RegisterShortcuts(rootCmd, f) // 注册人工封装的高频 shortcuts

if mode := f.ResolveStrictMode(context.Background()); mode.IsActive() { // 如果当前环境开启了 strict mode
    pruneForStrictMode(rootCmd, mode) // 就把不允许的命令从命令树里裁掉
} // 裁剪逻辑结束
```

这段代码其实把全仓库的骨架都说清楚了：

### 3.1 它先建的是 Factory，而不是客户端

这说明作者不想在各个命令里手动到处 new：

- 配置
- HTTP client
- Lark SDK client
- credential provider

而是先把这些依赖集中到一个工厂对象里，再注入给所有命令。

如果你不熟悉 `Factory` 这个词，可以先把它理解成“统一的依赖取用入口”。命令本身不关心配置文件怎么读、HTTP client 怎么建、token 从哪里拿；它只向 Factory 要这些东西。这样命令代码就不会和环境细节绑死。

这样做的好处很明显：

- 各命令代码更短
- 测试时更容易 stub
- identity、config、client 的创建逻辑不会散在各处

### 3.2 命令树是“固定命令 + 动态命令 + shortcuts”拼出来的

也就是说，根命令并不是一次性手写完全部结构，而是分三批装配：

- 手写固定命令
- 根据 registry 元数据生成 API 命令
- 根据 shortcut 声明挂载高频快捷命令

### 3.3 strict mode 不是执行时才拦，而是启动时就裁树

这一点很关键。

很多系统会在命令执行时才说“不允许”，但 `lark-cli` 更进一步：

- 如果当前环境只允许 `bot`
- 那就直接把不兼容命令从命令树里裁掉

这会让：

- 帮助信息更准确
- 自动补全更准确
- Agent 更少走弯路

所以从启动链路就能看出来，这个项目的设计思路非常清晰：

**先把运行时依赖装好，再把命令树按角色分层挂上去，最后按环境约束做一轮剪枝。**

## 4. 为什么它能靠元数据扩出大量 API 命令

<figure class="fz040" data-reveal role="group" aria-label="元数据驱动命令的生成过程：embed 元数据、远端更新、本地缓存依次流入 registerService，展开成命令树，并统一一整套命令协议能力"><style>.fz040{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:clamp(16px,3.2vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),0 1px 2px rgba(26,24,21,.05)}.fz040 *{box-sizing:border-box}.fz040 .hd{margin-bottom:clamp(14px,2.6vw,24px)}.fz040 .ttl{font-size:clamp(19px,3.1vw,28px);font-weight:700;letter-spacing:.01em;line-height:1.25;color:var(--ink,#1a1815)}.fz040 .sub{margin-top:6px;font-size:clamp(12px,1.9vw,15px);color:var(--muted,#6a6155);line-height:1.5}.fz040 .flow{display:flex;align-items:stretch;gap:0;flex-wrap:nowrap}.fz040 .node{flex:1 1 0;min-width:0;border-radius:14px;padding:clamp(10px,1.6vw,16px) clamp(8px,1.4vw,14px);border:1.5px solid var(--hair);background:#f7f1e4;display:flex;flex-direction:column;gap:6px;position:relative;opacity:0;transform:translateY(8px);animation:fz040in .9s ease forwards}.fz040 .node:nth-of-type(1){animation-delay:.1s;background:var(--cy-bg,#dcebed);border-color:var(--cy-bd,#8fbcc4)}.fz040 .node:nth-of-type(3){animation-delay:.5s;background:var(--am-bg,#f4e8cc);border-color:var(--am-bd,#d9b66a)}.fz040 .node:nth-of-type(5){animation-delay:.9s;background:var(--gr-bg,#e7eedd);border-color:var(--gr-lt,#7c9c54)}.fz040 .node:nth-of-type(7){animation-delay:1.3s;background:var(--pu-bg,#e6e7f3);border-color:var(--pu-bd,#a9adcf)}.fz040 .node .nh{font-size:clamp(13px,2vw,17px);font-weight:700;line-height:1.25;color:var(--ink,#1a1815);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz040 .node:nth-of-type(1) .nh{color:#3f6d79}.fz040 .node:nth-of-type(3) .nh{color:#9a6516}.fz040 .node:nth-of-type(5) .nh{color:#4f7233}.fz040 .node:nth-of-type(7) .nh{color:#54579a}.fz040 .node .nt{font-size:clamp(11px,1.7vw,13.5px);color:var(--ink-soft,#3c362c);line-height:1.45}.fz040 .arr{flex:0 0 clamp(22px,3.4vw,46px);align-self:center;position:relative;height:14px;margin:0 2px;opacity:0;animation:fz040in .7s ease forwards}.fz040 .arr:nth-of-type(2){animation-delay:.45s}.fz040 .arr:nth-of-type(4){animation-delay:.85s}.fz040 .arr:nth-of-type(6){animation-delay:1.25s}.fz040 .arr::before{content:"";position:absolute;top:50%;left:0;right:7px;height:3px;transform:translateY(-50%);border-radius:2px;background:rgba(145,127,92,.25)}.fz040 .arr::after{content:"";position:absolute;top:50%;right:0;transform:translateY(-50%);border-style:solid;border-width:6px 0 6px 9px;border-color:transparent transparent transparent var(--muted,#917f5c)}.fz040 .arr i{position:absolute;top:50%;left:0;width:14px;height:3px;transform:translateY(-50%);border-radius:2px;background:linear-gradient(90deg,transparent,#7c9c54,transparent);animation:fz040dash 3.4s linear infinite}.fz040 .arr:nth-of-type(2) i{animation-delay:0s}.fz040 .arr:nth-of-type(4) i{animation-delay:.5s;background:linear-gradient(90deg,transparent,#9a6516,transparent)}.fz040 .arr:nth-of-type(6) i{animation-delay:1s;background:linear-gradient(90deg,transparent,#54579a,transparent)}.fz040 .sum{margin-top:clamp(16px,2.8vw,26px);border:1.5px solid var(--hair);border-radius:16px;background:#f7f1e4;padding:clamp(14px,2.4vw,22px) clamp(14px,2.6vw,26px);text-align:center;position:relative;overflow:hidden;opacity:0;transform:translateY(10px);animation:fz040in 1s ease 1.6s forwards}.fz040 .sum::before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(124,156,84,.1) 50%,transparent 70%);background-size:240% 100%;animation:fz040sweep 9s ease-in-out infinite}.fz040 .sum>*{position:relative}.fz040 .sum .sh{font-size:clamp(14px,2.2vw,19px);font-weight:700;line-height:1.35;color:var(--ink,#1a1815)}.fz040 .sum .caps{margin-top:9px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10.5px,1.7vw,13.5px);color:#4f7233;line-height:1.6;word-break:break-word}.fz040 .sum .note{margin-top:9px;font-size:clamp(11.5px,1.8vw,14px);color:var(--muted,#6a6155);line-height:1.5}.fz040 .sum .caps b{font-weight:700;color:#3c362c}@keyframes fz040in{to{opacity:1;transform:translateY(0)}}@keyframes fz040dash{0%{left:-14px;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:calc(100% - 6px);opacity:0}}@keyframes fz040sweep{0%,100%{background-position:140% 0}50%{background-position:-40% 0}}@media(max-width:560px){.fz040 .flow{flex-direction:column;gap:0}.fz040 .node{width:100%}.fz040 .arr{flex:0 0 26px;width:14px;height:26px;align-self:center;margin:5px 0}.fz040 .arr::before{top:0;bottom:7px;left:50%;right:auto;width:3px;height:auto;transform:translateX(-50%)}.fz040 .arr::after{top:auto;bottom:0;right:50%;transform:translateX(50%);border-width:9px 6px 0 6px;border-color:var(--muted,#917f5c) transparent transparent transparent}.fz040 .arr i{top:0;left:50%;width:3px;height:14px;transform:translateX(-50%);background:linear-gradient(180deg,transparent,#7c9c54,transparent);animation:fz040dashv 3.4s linear infinite}.fz040 .arr:nth-of-type(4) i{background:linear-gradient(180deg,transparent,#9a6516,transparent)}.fz040 .arr:nth-of-type(6) i{background:linear-gradient(180deg,transparent,#54579a,transparent)}}@keyframes fz040dashv{0%{top:-14px;opacity:0}15%{opacity:1}85%{opacity:1}100%{top:calc(100% - 6px);opacity:0}}@media(prefers-reduced-motion:reduce){.fz040 .node,.fz040 .arr,.fz040 .sum{animation:none!important;opacity:1;transform:none}.fz040 .arr i{animation:none!important;opacity:0}.fz040 .sum::before{animation:none!important;opacity:0}}</style><div class="hd"><div class="ttl">元数据驱动命令的生成过程</div><div class="sub">内置快照保底，远端数据补新鲜度，最后再展开成命令树</div></div><div class="flow"><div class="node"><div class="nh">embed 元数据</div><div class="nt">二进制内自带一份基线</div></div><div class="arr"><i></i></div><div class="node"><div class="nh">远端更新</div><div class="nt">可选拉取最新 schema</div></div><div class="arr"><i></i></div><div class="node"><div class="nh">本地缓存</div><div class="nt">保留最近一次 overlay 结果</div></div><div class="arr"><i></i></div><div class="node"><div class="nh">registerService</div><div class="nt">展开成 service / resource / method</div></div></div><div class="sum"><div class="sh">命令展开后，还会自动统一很多配套能力</div><div class="caps"><b>--params</b> / <b>--data</b> / <b>--file</b> / format / jq / pagination / identity check / schema help</div><div class="note">所以它省下来的不只是命令代码，而是整套命令协议的重复开发</div></div></figure>

如果这个项目要手写所有平台 API 命令，维护成本会很快失控。

所以它选择了一条更平台化的路：

**命令不是手写出来的，而是从元数据“展开”出来的。**

对应源码里的 [`cmd/service/service.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/cmd/service/service.go)：

```go
for _, project := range registry.ListFromMetaProjects() { // 遍历所有服务名
    spec := registry.LoadFromMeta(project) // 读取这个服务的元数据
    if spec == nil { // 如果没有读到元数据
        continue // 就直接跳过
    } // 空元数据处理结束

    resources, _ := spec["resources"].(map[string]interface{}) // 取出这个服务下面的资源集合
    registerService(parent, spec, resources, f) // 把这份元数据展开成真正的命令树
} // 遍历结束
```

这个设计的意思其实很朴素：

- 平台 API 的结构，本来就是数据
- 那 CLI 命令树也可以从这份数据生成

这样一来，新增服务时就不一定要先写命令代码，很多时候只要：

1. 更新元数据
1. 重新加载 registry
1. 命令树就能自动长出来

### 4.1 元数据本身也不是死的

`registry` 这一层更有意思，它不是只读本地文件。

从 [`internal/registry/loader.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/internal/registry/loader.go) 和 [`internal/registry/remote.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/internal/registry/remote.go) 可以看出，它大概是这条思路：

- 编译时把一份 `meta_data.json` embed 进二进制，作为基线
- 运行时如果允许，就去远端拉更新版元数据
- 结果写本地 cache
- 再把远端数据 overlay 到内置基线上

这几个词放在一起看可能有点绕，可以拆开理解：

- `embed` 是“先把一份静态元数据打进程序包里”，保证没网时也能启动
- `cache` 是“把远端拉到的新数据存在本机”，避免每次都重新下载
- `overlay` 是“用远端较新的数据覆盖内置旧数据”，让 CLI 不必每次 API 有变化都重新发版

这解决了一个很现实的问题：

**CLI 的发布节奏，通常追不上平台 API 的变化节奏。**

如果完全靠重新发版同步 API，很容易滞后；但如果完全依赖在线拉取，又会影响首启可用性和离线可靠性。

所以它折中成了：

- 内置一份“至少可用”的静态快照
- 再叠一层“尽量新鲜”的远端更新

这是一个很典型、也很实用的平台化取舍。

### 4.2 元数据驱动命令，不只是省代码

很多人第一次看到这种设计，会以为它只是“偷懒少写代码”。

其实更重要的价值是统一。

因为一旦 schema 统一，下面这些能力都更容易统一生成：

- `--params`
- `--data`
- `--file`
- 身份校验
- scope 校验
- `schema` 帮助命令
- 自动补全

所以它省下来的不只是“某个命令函数”，而是整套配套能力的重复开发。

## 5. 为什么高频场景还要再包一层 Shortcut

<figure class="fz041" data-reveal role="group" aria-label="Shortcut 的统一执行流水线：命令输入、身份解析、scope 检查、输入解析、dry-run 到 Execute 与 Output 的六段流水线，业务代码只是最后一步"><style>.fz041{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);box-sizing:border-box;margin:0;padding:clamp(16px,3.4vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;font-family:var(--serif);color:var(--ink,#1a1815);max-width:100%;overflow:hidden}.fz041 *{box-sizing:border-box}.fz041 .hd{margin-bottom:clamp(14px,2.6vw,22px)}.fz041 .ttl{font-size:clamp(18px,3.4vw,27px);font-weight:700;letter-spacing:.01em;line-height:1.25}.fz041 .sub{margin-top:7px;font-size:clamp(12px,1.9vw,15px);color:var(--muted,#6a6155);line-height:1.5}.fz041 .pipe{display:flex;flex-wrap:wrap;align-items:stretch;gap:9px;margin-bottom:clamp(16px,3vw,26px)}.fz041 .node{position:relative;flex:1 1 130px;min-width:118px;display:flex;flex-direction:column;justify-content:center;gap:6px;padding:14px 12px;border-radius:14px;border:1px solid var(--c-bd);background:var(--c-bg);opacity:0;transform:translateY(8px);animation:fz041in .7s ease forwards;animation-delay:var(--d,0s)}.fz041 .node .nh{font-size:clamp(13px,1.9vw,16px);font-weight:700;color:var(--ink,#1a1815);line-height:1.2}.fz041 .node .nt{font-family:var(--mono);font-size:clamp(10px,1.5vw,12px);color:var(--c-ink);line-height:1.3;word-break:break-word}.fz041 .node::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;border-radius:0 0 13px 13px;background:var(--c-ac);transform:scaleX(0);transform-origin:left;animation:fz041fill 9s ease-in-out infinite;animation-delay:var(--d,0s)}.fz041 .n0{--c-bg:#dcebed;--c-bd:#8fbcc4;--c-ink:#3f6d79;--c-ac:#3f6d79;--d:.05s}.fz041 .n1{--c-bg:#f4e8cc;--c-bd:#d9b66a;--c-ink:#9a6516;--c-ac:#9a6516;--d:.18s}.fz041 .n2{--c-bg:#e7eedd;--c-bd:#7c9c54;--c-ink:#4f7233;--c-ac:#4f7233;--d:.31s}.fz041 .n3{--c-bg:#e6e7f3;--c-bd:#a9adcf;--c-ink:#54579a;--c-ac:#54579a;--d:.44s}.fz041 .n4{--c-bg:#f1ddd6;--c-bd:#cf9b90;--c-ink:#8f2d20;--c-ac:#8f2d20;--d:.57s}.fz041 .n5{--c-bg:#e3f1e2;--c-bd:#69b07a;--c-ink:#2f7a44;--c-ac:#2f7a44;--d:.7s;flex:1.3 1 150px}.fz041 .arr{flex:0 0 auto;align-self:center;display:flex;align-items:center;color:var(--muted,#6a6155)}.fz041 .arr .ln{width:14px;height:2px;background:linear-gradient(90deg,transparent,var(--muted,#6a6155));position:relative;overflow:hidden}.fz041 .arr .ln::before{content:"";position:absolute;inset:0;width:7px;background:#7c9c54;animation:fz041flow 2.4s linear infinite}.fz041 .arr .tip{width:0;height:0;border-top:4px solid transparent;border-bottom:4px solid transparent;border-left:6px solid var(--muted,#6a6155)}.fz041 .a0 .ln::before{animation-delay:.1s}.fz041 .a1 .ln::before{animation-delay:.5s}.fz041 .a2 .ln::before{animation-delay:.9s}.fz041 .a3 .ln::before{animation-delay:1.3s}.fz041 .a4 .ln::before{animation-delay:1.7s}.fz041 .panel{padding:clamp(15px,2.6vw,22px) clamp(16px,3vw,26px);border-radius:16px;background:var(--paper-deep,#ece5d5);border:1px solid var(--hair,rgba(26,24,21,.18));text-align:center;opacity:0;transform:translateY(8px);animation:fz041in .8s ease .85s forwards}.fz041 .panel .ph{font-size:clamp(14px,2.2vw,19px);font-weight:700;line-height:1.3;position:relative;display:inline-block}.fz041 .panel .ph::after{content:"";position:absolute;left:0;bottom:-3px;width:100%;height:2px;background:#7c9c54;transform:scaleX(.2);transform-origin:left;opacity:.5;animation:fz041und 9s ease-in-out infinite}.fz041 .panel .pt{margin-top:10px;font-size:clamp(12px,1.8vw,14.5px);color:var(--ink-soft,#3c362c);line-height:1.6}.fz041 .panel .pt b{color:var(--ink,#1a1815);font-weight:700}@keyframes fz041in{to{opacity:1;transform:translateY(0)}}@keyframes fz041flow{0%{transform:translateX(-7px)}100%{transform:translateX(14px)}}@keyframes fz041fill{0%,8%{transform:scaleX(0)}38%,62%{transform:scaleX(1)}92%,100%{transform:scaleX(0)}}@keyframes fz041und{0%,100%{transform:scaleX(.2);opacity:.4}50%{transform:scaleX(1);opacity:.8}}@media(max-width:560px){.fz041 .pipe{flex-direction:column;align-items:stretch}.fz041 .node,.fz041 .n5{flex:1 1 auto;width:100%}.fz041 .arr{align-self:center;transform:rotate(90deg);margin:1px 0}}@media(prefers-reduced-motion:reduce){.fz041 .node,.fz041 .panel{opacity:1;transform:none;animation:none}.fz041 .node::after{transform:scaleX(1);animation:none}.fz041 .arr .ln::before{animation:none;width:0}.fz041 .panel .ph::after{transform:scaleX(1);opacity:.6;animation:none}}</style><div class="hd"><div class="ttl">Shortcut 的统一执行流水线</div><div class="sub">业务代码只是最后一步，前面先走完身份、权限、输入和 dry-run</div></div><div class="pipe"><div class="node n0"><span class="nh">命令输入</span><span class="nt">+agenda</span></div><span class="arr a0"><span class="ln"></span><span class="tip"></span></span><div class="node n1"><span class="nh">身份解析</span><span class="nt">user / bot</span></div><span class="arr a1"><span class="ln"></span><span class="tip"></span></span><div class="node n2"><span class="nh">scope 检查</span><span class="nt">本地预拦截</span></div><span class="arr a2"><span class="ln"></span><span class="tip"></span></span><div class="node n3"><span class="nh">输入解析</span><span class="nt">@file / stdin</span></div><span class="arr a3"><span class="ln"></span><span class="tip"></span></span><div class="node n4"><span class="nh">dry-run</span><span class="nt">先看计划</span></div><span class="arr a4"><span class="ln"></span><span class="tip"></span></span><div class="node n5"><span class="nh">Execute + Output</span><span class="nt">真正执行业务并统一输出</span></div></div><div class="panel"><div class="ph">框架层统一吃掉横切逻辑</div><div class="pt">这样具体业务命令只需要关心<b>“这条命令到底做什么”</b><br>而不用每次都重新写身份判断、权限校验、输入解析、格式化输出</div></div></figure>

如果已经有 API Commands 了，为什么还要再做 `Shortcuts`？

答案其实很简单：

**因为“能调 API”不等于“高频任务好用”。**

举个例子。

用户想看的不是：

- `calendar events instance_view --params ...`

用户真正想说的是：

- “看我今天的日程”

所以 `Shortcut` 这一层，解决的是 API 命令不擅长的事：

- 默认值
- 场景语义
- 更短的参数
- 更像人话的名字
- 更友好的输出
- dry-run

先看一个 shortcut 声明，对应源码里的 [`shortcuts/calendar/calendar_agenda.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/shortcuts/calendar/calendar_agenda.go)：

```go
var CalendarAgenda = common.Shortcut{ // 声明一个高频快捷命令
    Service: "calendar", // 它会挂到 calendar 服务下面
    Command: "+agenda", // 命令名字是 +agenda
    Scopes: []string{"calendar:calendar.event:read"}, // 执行它需要这个读权限
    AuthTypes: []string{"user", "bot"}, // user 和 bot 两种身份都允许
    HasFormat: true, // 框架会自动给它挂上 --format
    Execute: func(ctx context.Context, runtime *common.RuntimeContext) error { // 这里才是真正的业务逻辑入口
        items, err := fetchAgenda(runtime) // 先把日程数据拉回来
        if err != nil { // 如果拉取失败
            return err // 直接交给统一错误系统处理
        } // 错误处理结束
        runtime.OutFormat(items, &output.Meta{Count: len(items)}, prettyAgenda) // 再交给统一输出层格式化返回
        return nil // 正常结束
    }, // 业务逻辑结束
} // shortcut 声明结束
```

这个声明式结构很值得学，因为它把 shortcut 需要的关键信息都显式摆出来了：

- 这个命令属于哪个 service
- 命令名是什么
- 需要什么 scope
- 支持什么身份
- 是否支持格式化输出
- 真正执行逻辑是什么

换句话说，它不是先写一堆命令代码，再靠读代码猜约束；而是先把约束写成数据，再把执行逻辑挂进去。

### 5.1 真正厉害的地方，在统一执行流水线

`Shortcut` 之所以好维护，不只是因为用了一个 struct，而是因为所有 shortcut 都能走同一条执行流水线。

对应源码里的 [`shortcuts/common/runner.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/shortcuts/common/runner.go)：

```go
as, err := resolveShortcutIdentity(cmd, f, s) // 第一步，先确定当前到底用 user 还是 bot 身份
config, err := f.Config() // 第二步，再加载当前配置
if err := checkShortcutScopes(f, cmd.Context(), as, config, s.ScopesForIdentity(string(as))); err != nil { // 第三步，本地预检查 scope
    return err // 权限不够就提前返回
} // scope 预检查结束

rctx, err := newRuntimeContext(cmd, f, s, config, as, botOnly) // 第四步，组装运行时上下文
if err := resolveInputFlags(rctx, s.Flags); err != nil { // 第五步，解析 @file 和 stdin 这种输入形式
    return err // 输入不合法就返回
} // 输入解析结束

if rctx.Bool("dry-run") { // 如果用户要求 dry-run
    return handleShortcutDryRun(f, rctx, s) // 就只输出“将要做什么”
} // dry-run 分支结束

return s.Execute(rctx.ctx, rctx) // 最后才真正执行业务逻辑
```

这条流水线特别像“一个小型框架”。

它把 shortcut 的公共问题都提前收口了：

- 身份解析
- strict mode
- scope 检查
- 输入解析
- dry-run
- 风险确认
- 输出协议

于是具体业务代码就可以更聚焦在：

- 这条命令到底要做什么

这正是框架层最应该做的事：

**把所有横切逻辑吃掉，让业务代码只关心业务。**

## 6. 鉴权为什么是核心骨架，而不是边角料

<figure class="fz042" data-reveal role="group" aria-label="鉴权与身份决策链：扩展 Provider 到默认配置来源到 Identity Hint 到 Strict Mode 的四阶段流水线，以及对 Agent 为何重要的说明"><style>.fz042{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin:0;padding:clamp(16px,3.4vw,30px);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;color:var(--ink,#1a1815);font-family:var(--serif);box-sizing:border-box;overflow:hidden}.fz042 *{box-sizing:border-box}.fz042 .hd{margin-bottom:clamp(16px,2.6vw,24px)}.fz042 .ttl{font-size:clamp(20px,3.6vw,30px);font-weight:700;letter-spacing:.5px;color:var(--ink,#1a1815)}.fz042 .sub{margin-top:7px;font-size:clamp(12px,1.9vw,15px);color:var(--muted,#6a6155);line-height:1.55}.fz042 .chain{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;justify-content:center}.fz042 .node{flex:1 1 180px;min-width:150px;border-radius:14px;padding:clamp(12px,1.8vw,16px);border:1.5px solid var(--c-bd);background:var(--c-bg);position:relative;opacity:.62;transform:translateY(4px);transition:opacity .6s,transform .6s,box-shadow .6s;animation:fz042pulse 9s ease-in-out infinite;animation-delay:var(--d)}.fz042 .node:before{content:"";position:absolute;left:0;top:0;height:3px;width:100%;border-radius:14px 14px 0 0;background:var(--c-mk);opacity:.85}.fz042 .step{font-family:var(--mono);font-size:10px;letter-spacing:1.5px;color:var(--c-mk);text-transform:uppercase}.fz042 .nh{font-size:clamp(14px,2.2vw,18px);font-weight:700;margin:5px 0 7px;color:var(--ink,#1a1815)}.fz042 .nt{font-size:clamp(11px,1.7vw,13.5px);color:var(--ink-soft,#3c362c);line-height:1.5}.fz042 .arr{flex:0 0 30px;align-self:center;height:26px;position:relative;min-width:26px;margin:6px 0}.fz042 .arr:before{content:"";position:absolute;left:4px;right:11px;top:50%;height:3px;transform:translateY(-50%);border-radius:2px;background:linear-gradient(90deg,var(--muted,#6a6155),var(--muted,#6a6155));background-size:200% 100%;opacity:.5;animation:fz042flow 4.5s linear infinite;animation-delay:var(--ad)}.fz042 .arr:after{content:"";position:absolute;right:2px;top:50%;transform:translateY(-50%);width:0;height:0;border-left:9px solid var(--muted,#6a6155);border-top:6px solid transparent;border-bottom:6px solid transparent;opacity:.6;animation:fz042tip 4.5s ease-in-out infinite;animation-delay:var(--ad)}.fz042 .n1{--c-bg:var(--cyan-bg,#dcebed);--c-bd:var(--cyan-bd,#8fbcc4);--c-mk:var(--cyan,#3f6d79)}.fz042 .n2{--c-bg:var(--amber-bg,#f4e8cc);--c-bd:var(--amber-bd,#d9b66a);--c-mk:var(--amber,#9a6516)}.fz042 .n3{--c-bg:var(--green-bg,#e7eedd);--c-bd:var(--green-bd,#a9c07f);--c-mk:var(--green,#4f7233)}.fz042 .n4{--c-bg:var(--purple-bg,#e6e7f3);--c-bd:var(--purple-bd,#a9adcf);--c-mk:var(--purple,#54579a)}.fz042 .foot{margin-top:clamp(18px,3vw,26px);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;background:linear-gradient(180deg,#fffdf9,#f7f1e4);padding:clamp(14px,2.4vw,20px) clamp(14px,3vw,24px);text-align:center;position:relative;overflow:hidden;animation:fz042breath 8s ease-in-out infinite}.fz042 .foot:before{content:"";position:absolute;inset:0;background:radial-gradient(120% 130% at 50% 0%,rgba(79,114,51,.08),transparent 60%);pointer-events:none}.fz042 .fh{font-size:clamp(14px,2.3vw,19px);font-weight:700;color:var(--ink,#1a1815);position:relative}.fz042 .ft{margin-top:9px;font-size:clamp(11.5px,1.8vw,14px);color:var(--ink-soft,#3c362c);line-height:1.6;position:relative}.fz042 .ft .em{color:var(--green,#4f7233);font-weight:600;font-style:normal}@keyframes fz042pulse{0%,100%{opacity:.62;transform:translateY(4px);box-shadow:0 0 0 0 rgba(26,24,21,0)}40%,62%{opacity:1;transform:translateY(0);box-shadow:0 6px 18px -10px rgba(26,24,21,.4)}}@keyframes fz042flow{0%{background-position:120% 0;opacity:.32}50%{opacity:.7}100%{background-position:-60% 0;opacity:.32}}@keyframes fz042tip{0%,100%{opacity:.4;transform:translateY(-50%) translateX(0)}50%{opacity:.85;transform:translateY(-50%) translateX(2px)}}@keyframes fz042breath{0%,100%{box-shadow:0 0 0 0 rgba(79,114,51,0)}50%{box-shadow:0 4px 22px -12px rgba(79,114,51,.45)}}@media(max-width:560px){.fz042 .chain{flex-direction:column;align-items:stretch}.fz042 .node{flex:1 1 auto;width:100%}.fz042 .arr{align-self:center;width:26px;height:30px;transform:rotate(90deg);margin:2px 0}}@media (prefers-reduced-motion:reduce){.fz042 .node,.fz042 .foot,.fz042 .arr:before,.fz042 .arr:after{animation:none}.fz042 .node{opacity:1;transform:none;box-shadow:0 4px 14px -10px rgba(26,24,21,.35)}.fz042 .arr:before{opacity:.55}.fz042 .arr:after{opacity:.6}}</style><div class="hd"><div class="ttl">鉴权与身份决策链</div><div class="sub">这里不只是"拿 token"，而是在决定整条命令到底能不能执行</div></div><div class="chain"><div class="node n1" style="--d:0s"><div class="step">Provider</div><div class="nh">扩展 Provider</div><div class="nt">先尝试 env 等外部来源</div></div><div class="arr" style="--ad:0s"></div><div class="node n2" style="--d:.9s"><div class="step">Fallback</div><div class="nh">默认配置来源</div><div class="nt">扩展没命中时再回退</div></div><div class="arr" style="--ad:.9s"></div><div class="node n3" style="--d:1.8s"><div class="step">Hint</div><div class="nh">Identity Hint</div><div class="nt">推断 default-as / auto-as</div></div><div class="arr" style="--ad:1.8s"></div><div class="node n4" style="--d:2.7s"><div class="step">Gate</div><div class="nh">Strict Mode</div><div class="nt">最后决定哪些身份能活下来</div></div></div><div class="foot"><div class="fh">对 Agent 来说，这条链尤其重要</div><div class="ft">因为 Agent 不只要知道"有没有 token"，还要知道<span class="em">"该用哪种身份"</span>"不够权限时下一步该怎么补"<br>所以 lark-cli 会把身份、权限和 hint 一起纳入统一执行逻辑</div></div></figure>

很多 CLI 项目把鉴权当成一个“工具模块”。

但在 `lark-cli` 里，鉴权其实更像系统骨架，因为它直接决定：

- 当前命令能不能执行
- 用 `user` 还是 `bot`
- strict mode 是否生效
- scope 是否满足
- 输出里应该带什么提示

先看它的 credential provider 思路，对应 [`internal/credential/credential_provider.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/internal/credential/credential_provider.go)：

```go
for _, prov := range p.providers { // 先按顺序尝试所有扩展凭证提供方
    acct, err := prov.ResolveAccount(ctx) // 让扩展自己提供账号信息
    if err != nil { // 如果扩展报错
        return nil, err // 就把错误抛出去
    } // 扩展报错处理结束
    if acct != nil { // 只要有一个扩展命中了
        p.selectedSource = extensionTokenSource{provider: prov} // 记录后续 token 应该从哪个扩展拿
        return convertAccount(acct), nil // 转成内部结构并返回
    } // 扩展命中处理结束
} // 扩展遍历结束

acct, err := p.defaultAcct.ResolveAccount(ctx) // 如果扩展都没命中，就回退到默认配置来源
p.selectedSource = defaultTokenSource{resolver: p.defaultToken} // 同时记录默认 token 来源
return acct, err // 返回默认结果
```

这段代码背后体现的是很明确的优先级策略：

- 先给扩展留入口
- 没有扩展结果时，再回退本地默认配置

所谓 `provider chain`，重点在 `chain`。它不是只认一个固定凭证文件，而是像排队一样依次尝试多个来源：环境变量、扩展、默认账号配置都可能提供凭证。这样同一个 CLI 就能同时适配本地开发、CI、内部平台和 Agent 执行环境。

### 6.1 这不是单纯的 token 存取，而是身份决策链

这个 provider chain 后面还会继续影响很多东西：

- `DefaultAs`
- 自动推断 `AutoAs`
- 当前环境支持哪些身份
- strict mode 是否只允许 `user` 或 `bot`

所以它不是“拿到 token 就完了”，而是在决定整条命令的执行身份。

### 6.2 login 的 device flow 也明显在为 Agent 场景优化

对应 [`cmd/auth/login.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/cmd/auth/login.go) 的 `--no-wait` 分支，大意可以裁成这样：

```go
if opts.NoWait { // 如果是 agent 更喜欢的非阻塞模式
    data := map[string]interface{}{ // 就构造一段结构化返回值
        "verification_url": authResp.VerificationUriComplete, // 把真正要给用户打开的授权链接返回出去
        "device_code": authResp.DeviceCode, // 把设备码也一并返回，方便后续继续轮询
        "expires_in": authResp.ExpiresIn, // 告诉调用方这段授权还能维持多久
        "hint": "先展示链接，再继续轮询，不要让用户自己敲命令", // 明确告诉 Agent 下一步应该怎么做
    } // 结构化数据准备完成
    encoder.Encode(data) // 直接输出 JSON，方便机器解析
    return nil // 这一轮先结束
} // no-wait 分支结束
```

如果这是一个只服务人类用户的 CLI，它完全可以只输出一段自然语言：

- “请复制这个链接到浏览器打开”

但 `lark-cli` 没这么做，而是把：

- 链接
- 设备码
- 过期时间
- 下一步提示

都做成了结构化字段。

这就意味着 Agent 可以非常稳定地做下面这些动作：

1. 读出 `verification_url`
1. 展示给用户
1. 记住 `device_code`
1. 再用另一个流程继续轮询

这就是典型的 agent-native 设计：**不是让 Agent“看懂一句话”，而是直接给 Agent“下一步要用的数据”。**

## 7. 它为什么对 AI Agent 特别友好：结构化输出、MCP、Skills

<figure class="fz043" data-reveal role="group" aria-label="为什么 lark-cli 对 AI Agent 特别友好：结构化输出、MCP、Skills 组合成一整套可执行表面"><style>.fz043{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);--blue:#3a5a93;--blue-bg:#e3eaf6;--blue-edge:#8ba9d6;--amb:#9a6516;--amb-bg:#f4e8cc;--amb-edge:#d9b66a;--grn:#4f7233;--grn-bg:#e7eedd;--grn-edge:#7c9c54;box-sizing:border-box;margin:0;padding:clamp(16px,3vw,30px);background:linear-gradient(160deg,var(--paper-soft),var(--soft2));border:1px solid var(--hair);border-radius:18px;font-family:var(--serif);color:var(--ink);line-height:1.55;max-width:100%;overflow:hidden}.fz043 *{box-sizing:border-box}.fz043 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz043 .ttl{font-size:clamp(19px,3.2vw,28px);font-weight:700;letter-spacing:.4px;color:var(--ink)}.fz043 .sub{margin-top:6px;font-size:clamp(12px,1.9vw,15px);color:var(--muted)}.fz043 .row{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:stretch;gap:clamp(4px,1vw,10px)}.fz043 .node{position:relative;border-radius:16px;border:1.5px solid var(--hair);padding:clamp(12px,1.8vw,18px) clamp(10px,1.6vw,16px);background:var(--soft2);text-align:center;display:flex;flex-direction:column;justify-content:center;min-height:118px;opacity:0;transform:translateY(10px);animation:fz043-in .7s ease forwards}.fz043 .n1{border-color:var(--blue-edge);background:var(--blue-bg);animation-delay:.1s}.fz043 .n2{border-color:var(--amb-edge);background:var(--amb-bg);animation-delay:.5s}.fz043 .n3{border-color:var(--grn-edge);background:var(--grn-bg);animation-delay:.9s}.fz043 .node b{font-size:clamp(15px,2.4vw,21px);font-weight:700;display:block}.fz043 .n1 b{color:var(--blue)}.fz043 .n2 b{color:var(--amb)}.fz043 .n3 b{color:var(--grn)}.fz043 .node .desc{margin-top:8px;font-size:clamp(11px,1.6vw,14px);color:var(--ink-soft);line-height:1.45}.fz043 .n1 .desc{font-family:var(--mono);letter-spacing:.3px;font-size:clamp(10px,1.5vw,13px)}.fz043 .node::after{content:"";position:absolute;left:-1.5px;right:-1.5px;top:-1.5px;bottom:-1.5px;border-radius:16px;border:1.5px solid currentColor;opacity:0;pointer-events:none}.fz043 .n1::after{color:var(--blue);animation:fz043-pulse 9s ease-in-out infinite;animation-delay:0s}.fz043 .n2::after{color:var(--amb);animation:fz043-pulse 9s ease-in-out infinite;animation-delay:3s}.fz043 .n3::after{color:var(--grn);animation:fz043-pulse 9s ease-in-out infinite;animation-delay:6s}.fz043 .arrow{display:flex;align-items:center;justify-content:center;min-width:30px}.fz043 .arrow .line{position:relative;width:100%;height:3px;border-radius:3px;background:var(--hair);overflow:hidden}.fz043 .arrow .line::before{content:"";position:absolute;inset:0;width:40%;border-radius:3px;background:linear-gradient(90deg,transparent,var(--muted),transparent);animation:fz043-flow 3.6s linear infinite}.fz043 .a2 .line::before{animation-delay:1.2s}.fz043 .arrow .tip{position:absolute;right:-1px;top:50%;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid var(--muted);transform:translateY(-50%)}.fz043 .fan{position:relative;height:clamp(26px,5vw,40px);margin:4px 0 2px}.fz043 .fan .stem{position:absolute;left:50%;top:0;width:2px;height:100%;background:var(--hair);transform:translateX(-50%)}.fz043 .fan .drop{position:absolute;left:50%;top:0;width:8px;height:8px;border-radius:50%;background:var(--muted);transform:translate(-50%,-4px);animation:fz043-drop 4s ease-in infinite}.fz043 .fan .tip{position:absolute;left:50%;bottom:-1px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid var(--muted);transform:translateX(-50%)}.fz043 .sum{margin-top:clamp(8px,1.4vw,12px);border-radius:16px;border:1.5px solid var(--hair);background:var(--paper-deep);padding:clamp(14px,2.2vw,22px) clamp(14px,2.4vw,26px);text-align:center;opacity:0;transform:translateY(10px);animation:fz043-in .7s ease 1.3s forwards}.fz043 .sum b{display:block;font-size:clamp(14px,2.3vw,20px);font-weight:700;color:var(--ink);letter-spacing:.3px}.fz043 .sum .l{margin-top:8px;font-size:clamp(11px,1.7vw,14.5px);color:var(--ink-soft)}.fz043 .sum .l em{font-style:normal;font-family:var(--mono);font-size:.92em;color:var(--muted)}@keyframes fz043-in{to{opacity:1;transform:translateY(0)}}@keyframes fz043-flow{0%{left:-40%}100%{left:100%}}@keyframes fz043-pulse{0%,100%{opacity:0}45%,55%{opacity:.55}}@keyframes fz043-drop{0%{top:0;opacity:0}15%{opacity:1}90%{top:100%;opacity:1}100%{top:100%;opacity:0}}@media(max-width:560px){.fz043 .row{grid-template-columns:1fr;gap:0}.fz043 .arrow{min-width:0;height:26px}.fz043 .arrow .line{width:3px;height:100%}.fz043 .arrow .line::before{width:100%;height:40%;background:linear-gradient(180deg,transparent,var(--muted),transparent);animation:fz043-flowv 3.6s linear infinite}.fz043 .a2 .line::before{animation-delay:1.2s}.fz043 .arrow .tip{right:50%;top:auto;bottom:-1px;transform:translateX(50%);border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--muted);border-bottom:0}@keyframes fz043-flowv{0%{top:-40%}100%{top:100%}}}@media (prefers-reduced-motion:reduce){.fz043 .node,.fz043 .sum{opacity:1;transform:none;animation:none}.fz043 .node::after,.fz043 .arrow .line::before,.fz043 .fan .drop{animation:none}.fz043 .node::after{opacity:0}.fz043 .fan .drop{display:none}}</style><div class="hd"><div class="ttl">为什么它对 AI Agent 特别友好</div><div class="sub">命令只是入口，真正关键的是“机器能不能稳定消费它的行为”</div></div><div class="row"><div class="node n1"><b>结构化输出</b><div class="desc">ok / identity / data / error / hint</div></div><div class="arrow a1"><div class="line"><span class="tip"></span></div></div><div class="node n2"><b>MCP</b><div class="desc">某些能力直接走工具调用而不是 OpenAPI</div></div><div class="arrow a2"><div class="line"><span class="tip"></span></div></div><div class="node n3"><b>Skills</b><div class="desc">告诉 Agent 业务工作流应该怎么走</div></div></div><div class="fan"><span class="stem"></span><span class="drop"></span><span class="tip"></span></div><div class="sum"><b>组合起来之后，Agent 拿到的是一整套可执行表面</b><div class="l">命令层给入口，输出层给判断依据，MCP 给能力补充，Skills 给业务做法</div><div class="l">这比“<em>只把 API 暴露出去</em>”更接近真实可用的 Agent 平台</div></div></figure>

如果让我只挑一个最能代表这个仓库气质的点，我会选：

**它非常认真地在做“机器可消费的命令行接口”。**

### 7.1 成功和失败都走统一 envelope

`envelope` 这个词直译是“信封”。在接口设计里，它通常指“给真正业务数据套一层统一外壳”。这样不管里面是日程列表、文档信息还是错误详情，外面都先有同样的字段，调用方就能用同一套逻辑判断成功失败。

对应 [`internal/output/envelope.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/internal/output/envelope.go)：

```go
type Envelope struct { // 统一的成功响应结构
    OK bool `json:"ok"` // 这次请求是否成功
    Identity string `json:"identity,omitempty"` // 这次到底是 user 还是 bot 在执行
    Data interface{} `json:"data,omitempty"` // 真正的业务结果放在这里
    Meta *Meta `json:"meta,omitempty"` // count 之类的附加信息放在这里
    Notice map[string]interface{} `json:"_notice,omitempty"` // 更新提醒等系统提示也能挂在这里
} // 成功响应结构结束
```

对应 [`internal/output/errors.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/internal/output/errors.go) 的错误输出，也是一套统一结构。

这意味着 Agent 在调用命令后，不需要每次都用正则去猜：

- 成功是不是包含某个单词
- 错误是不是一段固定文案

它只要看：

- `ok`
- `error.type`
- `error.message`
- `error.hint`

就能决定下一步。

### 7.2 有些能力不是走 OpenAPI，而是直接走 MCP

这点也很有意思。

比如 `docs +create`，源码里的裁剪逻辑大概是这样，对应 [`shortcuts/doc/docs_create.go`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/shortcuts/doc/docs_create.go)：

```go
args := buildDocsCreateArgs(runtime) // 先把命令行参数整理成 create-doc 需要的入参
result, err := common.CallMCPTool(runtime, "create-doc", args) // 再通过 MCP 工具去创建文档
if err != nil { // 如果 MCP 调用失败
    return err // 继续交给统一错误系统处理
} // 错误处理结束
runtime.Out(result, nil) // 成功后仍旧走统一输出协议
return nil // 命令正常结束
```

这说明它的思路不是：

- “所有能力都必须落成某种 API 命令”

而是：

- 哪条路径更适合，就走哪条路径
- 但无论底层走 OpenAPI 还是 MCP，外层体验和输出协议尽量统一

这点非常重要，因为真实平台往往不是一个协议打天下：

- 一些能力更像 OpenAPI
- 一些能力更像工具调用
- 一些能力更适合 workflow 封装

而 `lark-cli` 做的是把这些差异吸到内部，不把混乱直接暴露给用户和 Agent。

### 7.3 Skills 则是在“调用接口”之外，再补一层“做事方法”

仓库里单独有一整个 `skills/` 目录，而且 skill 文档写得很重。

这说明作者很清楚一件事：

**即使接口统一了，Agent 也不一定天然知道某个业务域应该按什么顺序做。**

比如日历领域里：

- 什么时候先查 freebusy
- 什么时候先给候选时间
- 什么时候必须等用户确认

这些不是纯 API 参数问题，而是业务工作流问题。

所以 `skills/` 解决的并不是“怎么连系统”，而是：

- 这个领域该怎么做才更稳
- 哪些步骤不能跳
- 哪些 shortcut 应该优先用

这里还要特别澄清一个很容易混淆的点：

**`Skill` 不是 `CLI` 本体，也不是另一套命令系统；它更像是建立在 `CLI` 之上的 Agent 使用说明层。**

比如像 `lark-calendar`、`lark-mail`、`lark-contact`、`lark-im` 这些名字，从职责上说都更接近“领域 skill”：

- 它们告诉 Agent 这个领域优先用哪些命令
- 告诉 Agent 遇到什么情况要先检查前置条件
- 告诉 Agent 哪些步骤必须等用户确认

但真正执行动作的，仍然是底层的 `lark-cli` 命令、shortcut，或者它暴露出来的 MCP 能力。

如果一定要把这几层关系压缩成一句话，可以这么记：

- `lark-cli` 是执行引擎
- `calendar +agenda`、`mail ...` 这类是具体调用入口
- `lark-calendar`、`lark-mail` 这类是给 Agent 的领域工作流说明书

再往下一层看，如果某个 skill 目录里还有 `scripts/`，那它和 `skill` 本体也不是一回事。

这里可以把两者理解成：

- `skill` 负责定义“这类任务应该怎么做”
- `skill` 里的 `scripts/` 负责把其中重复、机械、适合程序化的步骤自动化

也就是说，`skill` 回答的是：

- 先做什么
- 后做什么
- 哪些步骤必须确认
- 哪些命令应该优先用

而 `skill/scripts` 回答的是：

- 某个中间步骤怎么更省事地执行
- 某个模板怎么自动生成
- 某种数据怎么批量整理或转换

所以 `skill` 更像“作业流程说明”，`scripts/` 更像“这套流程里顺手配的内部小工具”。

它们的边界可以这样记：

- 没有 `scripts/`，`skill` 依然成立，因为它首先是一份工作流知识
- 没有 `skill`，单独的 `scripts/` 往往只剩下技术动作，不知道该在什么时机使用
- `scripts/` 不是新的用户入口，也不会替代 `lark-cli` 这样的执行接口

如果要用一个更直观的类比：

- `skill` 像值班手册
- `scripts/` 像手册里附带的几个小工具

也就是说，在这个仓库里：

- `Commands` 给调用入口
- `MCP` 给额外能力
- `Skills` 给领域工作流

三者叠在一起，才构成一个真正适合 Agent 的使用面。

## 8. 工程化怎么兜底：构建、发布、测试

<figure class="fz044" data-reveal role="group" aria-label="工程化兜底闭环：fetch_meta 到 build 到 unit-test 到 integration-test 的构建测试流水线，加上反馈回流闭环，以及服务 Agent 可调用性的工程规范说明"><style>.fz044{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gn:#4f7233;--gnb:#e7eedd;--gnl:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;--pp:#54579a;--ppb:#e6e7f3;--ppe:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:var(--paper-soft);border:1px solid var(--hair);border-radius:18px;padding:clamp(16px,3vw,30px);margin:1.4em 0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz044 *{box-sizing:border-box}.fz044 .hd{margin-bottom:1.3em}.fz044 .ttl{font-size:clamp(20px,3.4vw,30px);font-weight:700;letter-spacing:.02em;color:var(--ink)}.fz044 .sub{margin-top:.5em;font-size:clamp(12.5px,1.9vw,16px);color:var(--muted)}.fz044 .flow{display:flex;flex-wrap:wrap;align-items:stretch;gap:.55em;justify-content:center}.fz044 .node{flex:1 1 130px;min-width:118px;border-radius:14px;border:1.5px solid var(--hair);padding:.85em .7em;display:flex;flex-direction:column;gap:.4em;text-align:center;position:relative;background:var(--paper-soft);opacity:.55;animation:fz044lite 9s ease-in-out infinite}.fz044 .node b{font-size:clamp(13px,1.9vw,16px);font-weight:700;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);letter-spacing:.01em}.fz044 .node small{font-size:clamp(10.5px,1.5vw,12.5px);color:var(--ink-soft);line-height:1.45}.fz044 .n1{background:var(--cyb);border-color:var(--cye);animation-delay:0s}.fz044 .n1 b{color:var(--cy)}.fz044 .n2{background:var(--amb);border-color:var(--ame);animation-delay:1.6s}.fz044 .n2 b{color:var(--am)}.fz044 .n3{background:var(--gnb);border-color:var(--gnl);animation-delay:3.2s}.fz044 .n3 b{color:var(--gn)}.fz044 .n4{background:var(--ppb);border-color:var(--ppe);animation-delay:4.8s}.fz044 .n4 b{color:var(--pp)}.fz044 .n5{flex:0 1 110px;min-width:96px;background:var(--rdb);border-color:var(--rde);animation-delay:6.4s}.fz044 .n5 b{color:var(--rd)}.fz044 .arr{flex:0 0 auto;align-self:center;display:flex;align-items:center;color:var(--muted)}.fz044 .arr .ln{width:18px;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--hair),var(--muted));animation:fz044flow 9s linear infinite}.fz044 .arr .tip{width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid var(--muted)}.fz044 .a1 .ln{animation-delay:.7s}.fz044 .a2 .ln{animation-delay:2.3s}.fz044 .a3 .ln{animation-delay:3.9s}.fz044 .arr.back{color:var(--rd)}.fz044 .arr.back .tip{border-left:0;border-right:8px solid var(--rd)}.fz044 .arr.back .ln{background:linear-gradient(90deg,var(--rd),var(--rde));animation-delay:5.5s}.fz044 .loop{display:flex;justify-content:center;align-items:center;gap:.5em;margin:.75em 0 1.25em;font-size:clamp(10.5px,1.5vw,12.5px);color:var(--rd)}.fz044 .loop .curve{flex:1 1 auto;max-width:520px;height:0;border-top:1.5px dashed var(--rde);animation:fz044pulse 9s ease-in-out infinite}.fz044 .loop .lbl{white-space:nowrap;font-family:var(--font-mono,ui-monospace,monospace);padding:.15em .55em;border:1px dashed var(--rde);border-radius:9px;background:var(--rdb)}.fz044 .panel{border:1.5px solid var(--hair);border-radius:16px;background:var(--paper-soft);padding:clamp(14px,2.4vw,22px);text-align:center;animation:fz044breathe 8s ease-in-out infinite}.fz044 .panel .ph{font-size:clamp(14px,2.1vw,18px);font-weight:700;color:var(--ink);margin-bottom:.65em;letter-spacing:.01em}.fz044 .panel .pr{font-size:clamp(11.5px,1.7vw,14.5px);color:var(--ink-soft);line-height:1.6;margin:.3em 0}.fz044 .panel .pr b{font-family:var(--font-mono,ui-monospace,monospace);font-weight:600;color:var(--am);font-size:.94em}.fz044 .panel .pr.alt b{color:var(--cy)}@keyframes fz044lite{0%,100%{opacity:.55}18%,40%{opacity:1;box-shadow:0 2px 12px rgba(26,24,21,.08)}60%{opacity:.66}}@keyframes fz044flow{0%,100%{opacity:.4}25%,45%{opacity:1}}@keyframes fz044pulse{0%,100%{opacity:.45}55%{opacity:1}}@keyframes fz044breathe{0%,100%{box-shadow:0 1px 0 var(--hair)}50%{box-shadow:0 4px 22px rgba(84,87,154,.12)}}@media (max-width:560px){.fz044 .flow{flex-direction:column}.fz044 .node,.fz044 .n5{flex:1 1 auto;width:100%}.fz044 .arr{transform:rotate(90deg);margin:-.1em 0}.fz044 .loop .curve{display:none}}@media (prefers-reduced-motion:reduce){.fz044 .node,.fz044 .arr .ln,.fz044 .loop .curve,.fz044 .panel{animation:none!important}.fz044 .node{opacity:1}.fz044 .arr .ln,.fz044 .loop .curve{opacity:1}}</style><div class="hd"><div class="ttl">工程化兜底闭环</div><div class="sub">这不是一次性脚本，而是一套要长期迭代的命令平台</div></div><div class="flow"><div class="node n1"><b>fetch_meta</b><small>先准备元数据</small></div><div class="arr a1"><span class="ln"></span><span class="tip"></span></div><div class="node n2"><b>build</b><small>再编译二进制</small></div><div class="arr a2"><span class="ln"></span><span class="tip"></span></div><div class="node n3"><b>unit-test</b><small>验证 cmd / internal / shortcuts</small></div><div class="arr a3"><span class="ln"></span><span class="tip"></span></div><div class="node n4"><b>integration-test</b><small>从用户视角跑 CLI</small></div><div class="arr back"><span class="tip"></span><span class="ln"></span></div><div class="node n5"><b>反馈</b><small>继续迭代</small></div></div><div class="loop"><span class="curve"></span><span class="lbl">闭环回流 · 继续迭代</span><span class="curve"></span></div><div class="panel"><div class="ph">这套工程规范本身也在服务 Agent 可调用性</div><div class="pr">dry-run E2E 保证<b>“请求结构”</b>稳定，live E2E 保证<b>“真实集成”</b>不漂</div><div class="pr alt"><b>AGENTS.md</b> 则把结构化错误、stdout / stderr 边界和测试要求都写成了贡献规范</div></div></figure>

如果前面几章讲的是“架构怎么设计”，那最后这一章讲的就是：

**这套东西怎么才能长期维护，而不是写着写着失控。**

### 8.1 构建流程里已经把元数据同步考虑进去了

对应 [`Makefile`](https://github.com/larksuite/cli/blob/6ad25cd452b4ded6951c232eba41c993c92534f8/Makefile)：

```makefile
fetch_meta: # 先定义一个抓取元数据的步骤
	python3 scripts/fetch_meta.py # 从远端拉取最新 API 元数据并落到本地

build: fetch_meta # 真正构建之前，先确保元数据已经准备好
	go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) . # 再去编译 CLI 二进制

unit-test: fetch_meta # 跑单测之前，同样先准备元数据
	go test -race -gcflags="all=-N -l" -count=1 ./cmd/... ./internal/... ./shortcuts/... # 跑核心模块测试

integration-test: build # 集成测试依赖已经构建好的 CLI
	go test -v -count=1 ./tests/... # 从用户视角执行端到端测试
```

这个顺序很有代表性，因为它明确承认了一件事：

**元数据不是可有可无的附属品，而是系统本身的一部分。**

### 8.2 仓库专门把 Agent 使用规范写进了 AGENTS.md

我很喜欢 `AGENTS.md` 里的一个态度：

- 不只是说“请写测试”
- 而是直接告诉贡献者：这个 CLI 的主要用户之一就是 Agent

于是它进一步规定：

- `RunE` 不能随便 `fmt.Errorf`
- 错误要结构化
- `stdout` 和 `stderr` 不能混
- shortcut 改动要补 dry-run E2E

这里的 `RunE` 是 Cobra 执行命令时调用的函数。如果每个 `RunE` 都随手返回普通字符串错误，Agent 就只能读一段自然语言猜原因；如果统一返回结构化错误，Agent 就可以按错误类型和 hint 继续处理。`dry-run E2E` 则是从完整命令入口跑一遍“演练模式”，确认命令会组出正确请求，但不真的改线上数据。

这其实相当于把“Agent 可调用性”提升成了工程规范，而不是个人风格。

### 8.3 测试策略也是分层的

从 `tests/cli_e2e` 目录和 `AGENTS.md` 可以看出，它大致有三层测试观念：

- 单元测试：验证模块逻辑
- dry-run E2E：不碰真实 API，但验证命令结构、参数和请求意图
- live E2E：真的走 API，验证完整往返

这套测试设计很适合 CLI 平台项目，因为它能同时覆盖：

- 框架行为
- 命令协议
- 真实集成

而且 dry-run E2E 对 Agent 场景尤其重要。

因为对 Agent 来说，“请求结构是不是对的”很多时候比“终端文案好不好看”更关键。

## 最后总结：这套设计最值得学什么

如果让我把整篇文章压缩成几句话，我会这样总结：

### 第一，它不是只在做命令，而是在做分层

- `Shortcuts` 面向任务
- `API Commands` 面向平台
- `Raw API` 面向兜底

这让它同时兼顾了体验、覆盖率和灵活性。

### 第二，它不是把鉴权当插件，而是当骨架

- `user / bot / auto`
- provider chain
- strict mode
- scope pre-check

这些东西并不是边角料，而是每条命令执行前的必经之路。

### 第三，它真的把 Agent 当一等用户

这体现在很多小地方：

- 统一 envelope
- 结构化错误和 hint
- `--no-wait` 授权模式
- dry-run
- skills
- MCP 接入

单独看每一点都不算惊人，但合在一起，就形成了一种很清晰的产品气质：

**这不是“给人用，顺便也许 Agent 能凑合用”的 CLI。**

**这是“从一开始就认真考虑 Agent 怎么稳定调用”的 CLI。**

我觉得这也是 `lark-cli` 最值得学习的地方。

它真正厉害的地方，不是支持了多少命令，而是把下面这件事做得很完整：

**如何把平台 API、运行时依赖、身份系统、结构化输出、MCP 和 Skills 组织成一个长期可维护的命令平台。**

如果你以后也想做：

- 某个 SaaS 产品的官方 CLI
- 某个内部平台的 Agent 执行层
- 某种“既给人用也给模型用”的命令接口

那这个仓库真的很值得认真读一遍。
