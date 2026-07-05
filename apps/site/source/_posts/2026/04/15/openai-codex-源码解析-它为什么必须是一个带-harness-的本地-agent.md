---
title: "OpenAI Codex 源码解析：它为什么必须是一个带 Harness 的本地 Agent"
date: 2026-04-15 21:20:00
categories:
  - 技术
tags:
  - AI
  - Agent
  - LLM
  - OpenAI
  - Codex
  - Rust
  - 源码解析
  - 平台架构
excerpt: "从本地 Agent 与普通聊天的差别讲起，拆解 openai/codex 的 CLI、TUI、App Server、Core、Tools、State、Memory 设计，并解释为什么真正的关键不是“会调工具”，而是用 harness 把概率模型变成受控执行系统。"
cover: "cover-v1.png"
coverPosition: "below-title"
hidden: true
---

## 摘要

最近我花了一些时间看 [openai/codex](https://github.com/openai/codex) 这个仓库。

如果只看 README，你很容易先记住这些标签：

- 终端里的 coding agent
- 本地运行
- 可以读代码、跑命令、改文件
- 可以接 IDE、桌面 App、MCP、plugins、skills

但真进源码以后，我觉得它最值得看的地方不是“支持了多少工具”，而是下面这件事：

**它是怎么把一个本来只会做概率输出的大模型，包进一套受控执行的本地 runtime 里。**

这件事说得再直白一点就是：

- 普通聊天里，模型错了，通常只是“答案错了”
- 本地 Agent 里，模型错了，可能会变成“命令跑错了、文件改坏了、分支污染了、数据发错了”

所以，`Codex` 真正要解决的问题不只是“怎么让模型会调用工具”，而是：

**怎么让模型在真的拥有工具以后，依然可控、可审计、可恢复。**

这篇文章会按下面这条主线展开：

1. 先把文中几个容易陌生的词讲清楚
1. 再说明为什么 `Codex` 想做的是本地 Agent，而不是普通聊天
1. 然后拆开它的整体分层：`CLI / TUI / App Server / Core / Tools / State`
1. 接着看一轮 `Turn` 到底怎么执行到底
1. 重点解释为什么工具执行必须带审批、沙箱和策略控制
1. 再看为什么它把 `MCP / plugins / skills` 做成一等公民
1. 最后分析 `rollout / SQLite / memory pipeline` 这种长期状态设施，以及整套架构的 tradeoff

为了避免版本漂移，先说明本文的观察范围：

- 仓库：[openai/codex](https://github.com/openai/codex)
- 分支：`main`
- 阅读快照：`2e1003728c61e62636dd7a29a7fee95050fb9cc6`
- 观察时间：`2026-04-15`

另外，下面所有代码片段都是**裁剪版源码片段**：

- 只保留表达设计意图的主体逻辑
- 去掉了很多类型、日志、错误处理和边界分支
- 目的是让你在正文里就能直接看懂“它到底想怎么组织系统”

## 0. 阅读预备：先把几个词说人话

在看 `Codex` 这种仓库时，最容易把人绕晕的，往往不是某个函数，而是几个词混在一起以后看不清边界。

<figure class="fz006" data-reveal role="group" aria-label="先把几个词说人话：大模型、Agent Runtime、Harness 与工具、状态分层示意图"><style>.fz006{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--soft2:#f7f1e4;--grn:#4f7233;--grnb:#e7eedd;--grnl:#7c9c54;--cyn:#3f6d79;--cynb:#dcebed;--cyne:#8fbcc4;--amb:#9a6516;--ambb:#f4e8cc;--ambe:#d9b66a;--red:#8f2d20;--redb:#f1ddd6;--rede:#cf9b90;--pur:#54579a;--purb:#e6e7f3;--pure:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(160deg,var(--paper-soft),var(--paper-deep));border:1px solid var(--hair);border-radius:18px;padding:clamp(16px,3.2vw,30px);margin:0;box-sizing:border-box;overflow:hidden}.fz006 *{box-sizing:border-box}.fz006 .hd{margin-bottom:clamp(14px,2.6vw,22px)}.fz006 .t1{font-weight:700;font-size:clamp(19px,3.4vw,30px);letter-spacing:.5px;color:var(--ink)}.fz006 .t2{font-size:clamp(12px,2vw,16px);color:var(--muted);margin-top:6px;line-height:1.5}.fz006 .row1{display:flex;align-items:stretch;justify-content:center;gap:clamp(8px,1.4vw,14px);flex-wrap:nowrap}.fz006 .node{background:var(--soft2);border:1px solid var(--hair);border-radius:14px;padding:clamp(10px,1.6vw,16px);text-align:center;position:relative;flex:1 1 0;min-width:0;animation:fz006br 9s ease-in-out infinite}.fz006 .node b{display:block;font-weight:700;font-size:clamp(14px,2vw,20px);line-height:1.2;color:var(--ink)}.fz006 .node small{display:block;font-size:clamp(11px,1.5vw,14px);color:var(--ink-soft);margin-top:6px;line-height:1.45}.fz006 .node small.dim{color:var(--muted);font-style:italic;margin-top:3px}.fz006 .n-model{background:var(--cynb);border-color:var(--cyne);flex:1 1 26%}.fz006 .n-rt{background:var(--ambb);border-color:var(--ambe);flex:1 1 44%;animation-delay:-3s}.fz006 .n-hn{background:var(--purb);border-color:var(--pure);flex:1 1 26%;animation-delay:-6s}.fz006 .ar{flex:0 0 auto;align-self:center;position:relative;width:clamp(20px,3vw,40px);height:14px}.fz006 .ar:before{content:"";position:absolute;top:50%;left:0;right:8px;height:2px;transform:translateY(-50%);background:linear-gradient(90deg,var(--hair),var(--muted));overflow:hidden}.fz006 .ar:after{content:"";position:absolute;top:50%;right:0;transform:translateY(-50%);border-left:8px solid var(--muted);border-top:6px solid transparent;border-bottom:6px solid transparent}.fz006 .ar i{position:absolute;top:50%;left:0;width:40%;height:2px;transform:translateY(-50%);background:linear-gradient(90deg,transparent,var(--ambe),transparent);animation:fz006flow 4.5s linear infinite}.fz006 .lbl{text-align:center;font-size:clamp(11px,1.6vw,14px);color:var(--muted);margin:clamp(14px,2.4vw,22px) 0 clamp(10px,1.8vw,16px);letter-spacing:.5px}.fz006 .lbl b{color:var(--amb);font-weight:700}.fz006 .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,1.4vw,14px)}.fz006 .cell{position:relative;display:flex;flex-direction:column}.fz006 .vdrop{height:clamp(16px,2.8vw,26px);position:relative;margin:0 auto;width:14px}.fz006 .vdrop:before{content:"";position:absolute;left:50%;top:0;bottom:7px;width:2px;transform:translateX(-50%);background:linear-gradient(180deg,var(--hair),var(--muted))}.fz006 .vdrop:after{content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);border-top:8px solid var(--muted);border-left:6px solid transparent;border-right:6px solid transparent}.fz006 .vdrop i{position:absolute;left:50%;top:0;transform:translateX(-50%);width:2px;height:45%;background:linear-gradient(180deg,transparent,var(--ambe),transparent);animation:fz006flowv 4.5s linear infinite}.fz006 .leaf{flex:1;border-radius:13px;border:1px solid var(--hair);padding:clamp(9px,1.5vw,14px);text-align:center;animation:fz006br 10s ease-in-out infinite}.fz006 .leaf b{display:block;font-weight:700;font-size:clamp(12px,1.7vw,17px);line-height:1.2;color:var(--ink)}.fz006 .leaf small{display:block;font-size:clamp(10px,1.4vw,13px);color:var(--ink-soft);margin-top:5px;line-height:1.4}.fz006 .l-tc{background:var(--cynb);border-color:var(--cyne)}.fz006 .l-th{background:var(--grnb);border-color:var(--grnl);animation-delay:-2.5s}.fz006 .l-ro{background:var(--redb);border-color:var(--rede);animation-delay:-5s}.fz006 .l-me{background:var(--purb);border-color:var(--pure);animation-delay:-7.5s}.fz006 .sum{margin-top:clamp(16px,2.8vw,26px);background:var(--soft2);border:1px solid var(--hair);border-radius:14px;padding:clamp(12px,2vw,18px);text-align:center;position:relative;overflow:hidden}.fz006 .sum:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(154,101,22,.07),transparent);transform:translateX(-100%);animation:fz006sweep 8s ease-in-out infinite}.fz006 .sum b{font-weight:700;font-size:clamp(13px,1.9vw,18px);color:var(--amb)}.fz006 .sum p{margin:7px 0 0;font-size:clamp(12px,1.8vw,16px);color:var(--ink-soft);line-height:1.55;position:relative}.fz006 .sum p em{font-style:normal;font-weight:700;color:var(--ink)}@keyframes fz006br{0%,100%{box-shadow:0 1px 0 rgba(0,0,0,.03)}50%{box-shadow:0 4px 16px rgba(26,24,21,.10)}}@keyframes fz006flow{0%{left:-40%}100%{left:100%}}@keyframes fz006flowv{0%{top:-45%}100%{top:100%}}@keyframes fz006sweep{0%{transform:translateX(-100%)}55%,100%{transform:translateX(100%)}}@media(max-width:560px){.fz006 .row1{flex-wrap:wrap}.fz006 .row1 .ar{display:none}.fz006 .n-model,.fz006 .n-rt,.fz006 .n-hn{flex:1 1 100%}.fz006 .grid{grid-template-columns:repeat(2,1fr)}}@media(prefers-reduced-motion:reduce){.fz006 .node,.fz006 .leaf,.fz006 .ar i,.fz006 .vdrop i,.fz006 .sum:before{animation:none}.fz006 .ar i,.fz006 .vdrop i{display:none}.fz006 .sum:before{display:none}}</style><div class="hd"><div class="t1">先把几个词说人话</div><div class="t2">看 Codex 之前，先把“模型、runtime、harness、工具、状态”这几个层次分开</div></div><div class="row1"><div class="node n-model"><b>大模型</b><small>负责理解、规划、输出</small></div><div class="ar"><i></i></div><div class="node n-rt"><b>Agent Runtime</b><small>接输入、拼上下文、调模型、收工具结果、发事件</small><small class="dim">它像“让模型真的干活”的运行时操作系统</small></div><div class="ar"><i></i></div><div class="node n-hn"><b>Harness</b><small>负责能力边界和安全约束</small></div></div><div class="lbl">Runtime 向下<b>展开</b>为工具与状态四层</div><div class="grid"><div class="cell"><div class="vdrop"><i></i></div><div class="leaf l-tc"><b>Tool Calling</b><small>模型提议动作，runtime 真正执行</small></div></div><div class="cell"><div class="vdrop"><i></i></div><div class="leaf l-th"><b>Thread / Turn / Item</b><small>会话、轮次、最小事件单元</small></div></div><div class="cell"><div class="vdrop"><i></i></div><div class="leaf l-ro"><b>Rollout / State</b><small>原始记录、索引、结构化状态</small></div></div><div class="cell"><div class="vdrop"><i></i></div><div class="leaf l-me"><b>Memory</b><small>从历史里提炼长期记忆</small></div></div></div><div class="sum"><b>一句话总结</b><p>模型负责<em>概率决策</em>，Harness 负责把这些决策限制在<em>可接受的执行边界</em>内</p></div></figure>

### 0.1 什么是本地 Agent

- `本地 Agent` 可以简单理解成：**模型不是只回答问题，而是真的在你这台机器上参与执行任务**

它会做的事通常包括：

- 读取仓库文件
- 查看 git 状态
- 执行终端命令
- 修改工作区文件
- 再根据执行结果继续下一步

所以它不是“聊天机器人 + 一个 shell 示例”，而是一个贴着本地环境工作的执行体。

### 0.2 什么是 Agent runtime

- `Agent runtime` 可以理解成：**让大模型真的跑起来的那层运行时骨架**

它通常负责：

- 接收用户输入
- 构建上下文
- 调模型
- 注册和暴露工具
- 执行工具
- 把工具结果再喂回模型
- 把过程写入历史和状态

也就是说，它更像“让模型干活的操作系统”，而不是模型本身。

### 0.3 什么是 Harness

这是本文最想强调的词。

- `Harness` 可以把它理解成：**包在模型外面、负责约束能力边界的那层保护壳**

它至少要负责五件事：

1. 决定模型能看到什么能力
1. 决定这些能力在什么权限下执行
1. 决定执行时用什么沙箱和策略
1. 决定过程怎么记录和回放
1. 决定出错后怎么恢复或回滚

一句话说：

**模型负责做概率决策，harness 负责把这些决策限制在可接受的执行边界内。**

### 0.4 什么是 Tool Calling

- `tool calling` 指的是：**模型在回答过程中，不直接凭空输出最终答案，而是先请求系统帮它调用某个工具**

比如：

- 读文件
- 跑命令
- 搜索代码
- 发起网络请求
- 申请额外权限

所以 tool calling 的本质是：

- 模型负责规划
- runtime 负责执行

### 0.5 什么是 Thread / Turn / Item

这是 `Codex` 里非常关键的一组建模。

- `Thread`：一条连续会话
- `Turn`：一次完整交互
- `Item`：这次交互中的最小事件单元

在 `app-server` 的描述里，这三者基本可以理解成：

- thread 是一段长期任务线
- turn 是这条任务线里的一轮输入到输出
- item 是这轮执行里真正落盘和展示的事件

例如 item 可以是：

- 用户消息
- agent message
- shell command
- approval request
- file edit
- tool output

### 0.6 什么是 MCP / Skills / Plugins

这三个词都在扩展系统能力，但侧重点不同：

- `MCP`：协议化的外部工具 / 资源接入方式
- `Skill`：把某类经验、流程、约束封装成可注入的能力片段
- `Plugin`：更完整的能力包，可能同时带 skill、app、MCP server 等

粗暴理解：

- MCP 更像“统一接口”
- Skill 更像“经验模板”
- Plugin 更像“能力发行包”

### 0.7 什么是 Rollout / SQLite State / Memory Pipeline

这三个词对应的是长期状态问题：

- `Rollout`：原始事件流落盘
- `SQLite State`：方便查询、索引和管理的结构化状态层
- `Memory Pipeline`：从过去会话里提炼出更高层次记忆的管道

你可以把它理解成三层：

- 第一层：先把发生过的事记下来
- 第二层：再把这些记录整理成可查询状态
- 第三层：最后从状态里提炼对未来还有用的记忆

## 1. Codex 想解决什么问题：为什么需要“本地 Agent”而不是普通聊天

先说结论：

**Codex 想做的，不是“更会写代码的聊天窗口”，而是“真的能在本地工作环境里完成任务的 agent”。**

<figure class="fz007" data-reveal role="group" aria-label="普通聊天与本地 Agent 的对比示意图：关键区别在于是不是进入执行闭环"><style>.fz007{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--pu:#54579a;--pub:#e6e7f3;--pue:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:var(--paper-soft);border:1px solid var(--hair);border-radius:18px;padding:clamp(16px,3vw,30px);margin:1.4em 0;box-sizing:border-box;max-width:100%}.fz007 *{box-sizing:border-box}.fz007 .hd{text-align:center;margin-bottom:.7em}.fz007 .t{font-size:clamp(20px,3.4vw,30px);font-weight:700;letter-spacing:.02em;color:var(--ink)}.fz007 .t b{color:var(--c)}.fz007 .t i{color:var(--g);font-style:normal}.fz007 .st{margin-top:.5em;font-size:clamp(12px,1.9vw,15px);color:var(--muted);line-height:1.6}.fz007 .st em{font-style:normal;color:var(--ink-soft);font-weight:600;border-bottom:1px solid var(--hair);padding-bottom:1px}.fz007 .cols{display:grid;grid-template-columns:1fr 1fr;gap:clamp(12px,2.4vw,22px);margin-top:1.1em}.fz007 .col{border-radius:16px;padding:clamp(12px,2vw,18px);position:relative;overflow:hidden}.fz007 .col.chat{background:var(--cb);border:1.5px solid var(--ce)}.fz007 .col.agent{background:var(--gb);border:1.5px solid var(--gl)}.fz007 .ch{text-align:center;font-weight:700;font-size:clamp(16px,2.5vw,22px);margin-bottom:.7em;letter-spacing:.04em}.fz007 .col.chat .ch{color:var(--c)}.fz007 .col.agent .ch{color:var(--g)}.fz007 .flow{display:flex;flex-direction:column;align-items:center;gap:0}.fz007 .node{width:100%;background:var(--paper-soft);border:1.5px solid var(--hair);border-radius:13px;padding:.74em .7em;text-align:center;font-size:clamp(12px,1.85vw,16px);line-height:1.45;color:var(--ink-soft);position:relative;z-index:1}.fz007 .col.chat .node{border-color:var(--ce)}.fz007 .col.agent .node{border-color:var(--gl)}.fz007 .arr{width:4px;height:30px;position:relative;flex:none;margin:5px 0;background:linear-gradient(var(--muted),var(--muted));border-radius:2px;overflow:visible}.fz007 .arr::before{content:"";position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid var(--muted)}.fz007 .arr .pulse{position:absolute;left:-2px;width:8px;height:8px;border-radius:50%;top:0;opacity:0}.fz007 .col.chat .arr .pulse{background:var(--c)}.fz007 .col.agent .arr .pulse{background:var(--g)}.fz007 .col.chat .arr .pulse{animation:fzdrop 7s ease-in-out infinite}.fz007 .col.chat .a2 .pulse{animation-delay:1.6s}.fz007 .col.agent .arr .pulse{animation:fzdrop 6.4s ease-in-out infinite}.fz007 .col.agent .a2 .pulse{animation-delay:1.45s}@keyframes fzdrop{0%,72%,100%{top:-4px;opacity:0}8%{opacity:1}30%{top:34px;opacity:0}}.fz007 .col.agent .loop{margin-top:7px;font-size:clamp(11px,1.7vw,14px);color:var(--g);font-weight:700;letter-spacing:.06em;display:flex;align-items:center;gap:.45em;animation:fzloop 7s ease-in-out infinite}.fz007 .loop .ico{display:inline-block;width:15px;height:15px;border:2.4px solid var(--g);border-right-color:transparent;border-radius:50%;animation:fzspin 7s linear infinite}@keyframes fzspin{to{transform:rotate(360deg)}}@keyframes fzloop{0%,100%{opacity:.55}50%{opacity:1}}.fz007 .tag{margin-top:.9em;text-align:center;font-size:clamp(11px,1.7vw,14px);line-height:1.5;padding:.5em .6em;border-radius:10px;font-weight:600}.fz007 .col.chat .tag{color:var(--c);background:rgba(63,109,121,.09)}.fz007 .col.agent .tag{color:var(--am);background:rgba(154,101,22,.12);border:1px solid var(--ame)}.fz007 .col.agent .tag.alert{animation:fzalert 8s ease-in-out infinite}@keyframes fzalert{0%,100%{box-shadow:0 0 0 0 rgba(154,101,22,0)}50%{box-shadow:0 0 0 4px rgba(217,182,106,.32)}}.fz007 .foot{margin:1.2em auto 0;max-width:640px;background:var(--amb);border:1.5px solid var(--ame);border-radius:14px;padding:clamp(11px,2vw,16px);text-align:center;font-size:clamp(12px,1.95vw,16px);line-height:1.55;color:var(--am);font-weight:600;position:relative;overflow:hidden}.fz007 .foot em{font-style:normal;color:var(--ink);text-decoration:underline;text-decoration-color:var(--ame);text-underline-offset:3px}.fz007 .foot::after{content:"";position:absolute;left:-40%;top:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);animation:fzsheen 9s ease-in-out infinite}@keyframes fzsheen{0%,60%,100%{left:-45%}80%{left:115%}}@media(max-width:560px){.fz007 .cols{grid-template-columns:1fr}}@media (prefers-reduced-motion:reduce){.fz007 *{animation:none!important}.fz007 .arr .pulse{opacity:0}.fz007 .foot::after{display:none}.fz007 .col.agent .loop{opacity:1}}</style><div class="hd"><div class="t">普通<b>聊天</b> vs 本地 <i>Agent</i></div><div class="st">关键区别不在“会不会写代码”，而在 <em>是不是进入执行闭环</em></div></div><div class="cols"><div class="col chat"><div class="ch">普通聊天</div><div class="flow"><div class="node">你手工复制上下文给模型</div><div class="arr a1"><span class="pulse"></span></div><div class="node">模型给出建议或示例代码</div><div class="arr a2"><span class="pulse"></span></div><div class="node">你自己去执行、验证、修正</div></div><div class="tag">错误主要是“答案错了”</div></div><div class="col agent"><div class="ch">本地 Agent</div><div class="flow"><div class="node">读仓库、读配置、看当前工作区</div><div class="arr a1"><span class="pulse"></span></div><div class="node">跑命令、调工具、修改文件</div><div class="arr a2"><span class="pulse"></span></div><div class="node">根据结果继续下一步，形成闭环</div><div class="loop"><span class="ico"></span>持续闭环</div></div><div class="tag alert">错误会升级成“执行错误”和“副作用错误”</div></div></div><div class="foot">一旦有副作用，系统设计重心就会从“回答质量”转向 <em>“Harness 质量”</em></div></figure>

### 1.1 普通聊天的问题，不是模型不够聪明

普通聊天已经很擅长这些事：

- 解释概念
- 帮你看报错
- 给你一段示例代码
- 提供排查思路

但它有个天然问题：

**它不在你的真实环境里。**

它看不到：

- 你当前 branch 是什么
- 你工作区里有没有未提交改动
- 你的测试到底是怎么挂的
- 你的依赖和脚本在本地是不是能跑
- 你项目里具体有哪些文件和配置

所以普通聊天的典型工作流其实是：

1. 你把一段上下文贴给模型
1. 模型给建议
1. 你自己执行
1. 执行失败后再把报错贴回去

这本质上还是：

- 人负责执行
- 模型负责建议

### 1.2 本地 Agent 的目标，是把“建议循环”变成“执行闭环”

到了本地 Agent，目标就变成：

1. 模型理解你的意图
1. 模型自己去看代码
1. 模型自己去运行命令
1. 模型自己去修改文件
1. 模型自己根据反馈继续下一步
1. 必要时再向你申请高风险操作的批准

这时候系统就不再是问答产品，而开始变成执行系统。

### 1.3 一旦进入执行闭环，错误的性质就变了

这也是为什么 `harness` 必须出现。

在普通聊天里，模型出错往往是：

- 理解错
- 推理错
- 代码建议不完美

但到了本地 Agent，模型出错会变成：

- 在错误目录执行命令
- 修改了不该改的文件
- 发起了不该发起的网络请求
- 做了高风险 git 操作
- 输出了一段有副作用的错误操作链

换句话说：

- 聊天里的错误更像“认知错误”
- Agent 里的错误更像“执行错误”

而执行错误的代价，显然要高得多。

### 1.4 所以 Codex 的核心不只是“会调工具”

如果只用一句话概括这一章，我会这么说：

> `Codex` 真正做的，不是给聊天产品加几个工具，而是给一个概率模型套上一层能约束副作用的本地执行 harness。

这句话后面几章会反复被验证。

## 2. 整体分层：CLI / TUI / App Server / Core / Tools / State

如果你第一次看 `openai/codex` 仓库，很容易被目录吓到。

- 顶层有 Node / pnpm
- 里面有大量 Rust crate
- 既有 CLI，又有 TUI，又有 app-server，又有 SDK

但如果从职责去看，其实它的结构非常清楚。

<figure class="fz008" data-reveal role="group" aria-label="Codex 的 5 层结构：分发与安装层、交互层、协议层、核心运行时，以及底部左手控制执行、右手保存历史"><style>.fz008{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--grn:#4f7233;--grnb:#e7eedd;--grnl:#7c9c54;--cyn:#3f6d79;--cynb:#dcebed;--cyne:#8fbcc4;--amb:#9a6516;--ambb:#f4e8cc;--ambe:#d9b66a;--prp:#54579a;--prpb:#e6e7f3;--prpe:#a9adcf;--gry:#917f5c;--gryb:#ece4d2;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),var(--soft2,#f7f1e4));color:var(--ink,#1a1815);margin:0;padding:clamp(16px,3.4vw,30px);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:16px;box-sizing:border-box;max-width:100%;overflow:hidden}.fz008 *{box-sizing:border-box}.fz008 .hd{text-align:center;margin-bottom:clamp(14px,2.6vw,22px)}.fz008 .ttl{font-weight:700;font-size:clamp(20px,3.6vw,30px);letter-spacing:.5px;color:var(--ink,#1a1815)}.fz008 .sub{margin-top:6px;font-size:clamp(12px,2vw,15px);color:var(--muted,#6a6155)}.fz008 .stack{display:flex;flex-direction:column;align-items:center;gap:0}.fz008 .lyr{width:100%;border-radius:14px;border:1.5px solid var(--hair);padding:clamp(11px,2.2vw,16px) clamp(12px,3vw,22px);text-align:center;animation:fzin 9s ease-in-out infinite both;position:relative}.fz008 .l1{max-width:66%;background:var(--prpb);border-color:var(--prpe);animation-delay:0s}.fz008 .l2{max-width:78%;background:var(--cynb);border-color:var(--cyne);animation-delay:.5s}.fz008 .l3{max-width:90%;background:var(--ambb);border-color:var(--ambe);animation-delay:1s}.fz008 .l4{max-width:100%;background:var(--grnb);border-color:var(--grnl);animation-delay:1.5s}.fz008 .ln{font-weight:700;font-size:clamp(15px,2.7vw,22px);color:var(--ink,#1a1815)}.fz008 .l1 .ln{color:var(--prp)}.fz008 .l2 .ln{color:var(--cyn)}.fz008 .l3 .ln{color:var(--amb)}.fz008 .l4 .ln{color:var(--grn)}.fz008 .lt{margin-top:5px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.9vw,15px);color:var(--ink-soft,#3c362c);line-height:1.5;word-break:break-word}.fz008 .ar{position:relative;width:4px;height:clamp(26px,4vw,38px);background:linear-gradient(var(--hair),var(--hair));overflow:visible}.fz008 .ar:before{content:"";position:absolute;left:50%;top:-2px;transform:translateX(-50%);width:8px;height:14px;background:linear-gradient(180deg,transparent,var(--gry));border-radius:4px;animation:fzflow 2.6s linear infinite}.fz008 .ar:after{content:"";position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid var(--gry)}.fz008 .a2:before{animation-delay:.65s}.fz008 .a3:before{animation-delay:1.3s}.fz008 .hands{display:flex;gap:clamp(10px,2.4vw,18px);width:100%;margin-top:clamp(14px,2.6vw,22px)}.fz008 .hand{flex:1 1 0;min-width:0;background:var(--paper-soft,#faf6ec);border:1.5px solid var(--hair);border-radius:12px;padding:clamp(10px,2vw,14px);text-align:center;animation:fzpulse 8s ease-in-out infinite both}.fz008 .hand.r{animation-delay:4s}.fz008 .hk{font-weight:700;font-size:clamp(12px,2.1vw,16px);color:var(--ink,#1a1815)}.fz008 .hl{margin-top:4px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10.5px,1.8vw,13.5px);color:var(--muted,#6a6155);line-height:1.45;word-break:break-word}.fz008 .hand.l{border-color:var(--gryb)}.fz008 .hand .hk b{color:var(--amb)}.fz008 .hand.r .hk b{color:var(--cyn)}@keyframes fzin{0%,100%{opacity:.82;transform:translateY(0)}18%,38%{opacity:1;transform:translateY(-2px);box-shadow:0 6px 18px -10px rgba(26,24,21,.4)}}@keyframes fzflow{0%{top:-2px;opacity:0}15%{opacity:1}85%{opacity:1}100%{top:calc(100% - 12px);opacity:0}}@keyframes fzpulse{0%,100%{opacity:.85;transform:translateY(0)}25%{opacity:1;transform:translateY(-3px);box-shadow:0 7px 16px -10px rgba(26,24,21,.45)}}@media(max-width:560px){.fz008 .l1,.fz008 .l2,.fz008 .l3,.fz008 .l4{max-width:100%}.fz008 .hands{flex-direction:column;gap:10px}}@media (prefers-reduced-motion:reduce){.fz008 .lyr,.fz008 .hand,.fz008 .ar:before{animation:none!important}.fz008 .lyr,.fz008 .hand{opacity:1;transform:none;box-shadow:none}.fz008 .ar:before{top:calc(50% - 7px);opacity:1}}</style><div class="hd"><div class="ttl">Codex 的 5 层结构</div><div class="sub">不要按目录树看，而要按职责分层看</div></div><div class="stack"><div class="lyr l1"><div class="ln">分发与安装层</div><div class="lt">npm / Homebrew / SDK / 仓库级脚本</div></div><div class="ar a1" aria-hidden="true"></div><div class="lyr l2"><div class="ln">交互层</div><div class="lt">CLI / TUI / 桌面端 / IDE 集成</div></div><div class="ar a2" aria-hidden="true"></div><div class="lyr l3"><div class="ln">协议层</div><div class="lt">App Server / JSON-RPC / Thread / Turn / Item / 文件与命令服务</div></div><div class="ar a3" aria-hidden="true"></div><div class="lyr l4"><div class="ln">核心运行时</div><div class="lt">Core / Tasks / Tool Orchestration / Skills / Plugins / State Bridge</div></div></div><div class="hands"><div class="hand l"><div class="hk"><b>左手控制执行</b></div><div class="hl">Tools / Sandbox / Approval / Policy</div></div><div class="hand r"><div class="hk"><b>右手保存历史</b></div><div class="hl">Rollout / SQLite / Memory</div></div></div></figure>

### 2.1 顶层 Node，不等于核心实现是 Node

从仓库结构上看，顶层有：

- `package.json`
- `pnpm-workspace.yaml`
- `sdk/`
- `codex-cli/`

但真正的核心实现，已经明显收敛到了 `codex-rs/` 这个 Rust workspace 里。

顶层 Node 更像负责：

- 安装分发
- 一些仓库级脚本
- SDK 和外层包装

而不是整个系统的执行核心。

### 2.2 CLI 只是入口，不是全部

看 `codex-rs/cli/src/main.rs` 的子命令定义，你会发现它其实是在统一调度多种运行方式：

```rust
#[derive(Debug, clap::Subcommand)] // 这里告诉 `clap`：下面这个枚举要被当成“子命令集合”来解析
enum Subcommand { // 这里定义 `codex` 顶层支持的所有子命令
    Exec(ExecCli), // `codex exec`：非交互地跑一段任务
    Review(ReviewArgs), // `codex review`：走代码审查模式
    Mcp(McpCli), // `codex mcp`：管理外部 MCP 服务
    AppServer(AppServerCommand), // `codex app-server`：启动本地协议服务
    Sandbox(SandboxArgs), // `codex sandbox`：直接使用 Codex 提供的沙箱能力
    Resume(ResumeCommand), // `codex resume`：恢复以前的会话
    Fork(ForkCommand), // `codex fork`：从旧会话分叉出一条新任务线
} // 这里结束子命令枚举定义
```

对应源码：

- [`codex-rs/cli/src/main.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/cli/src/main.rs)

这段代码透露出一个很重要的信息：

**`codex` 不是单一交互程序，而是一个多入口、多运行形态的 agent 平台前门。**

### 2.3 TUI 是终端界面层

`codex-rs/tui` 负责的是：

- 全屏终端 UI
- 流式显示 agent 过程
- 展示审批弹层
- 展示 tool output、历史记录、状态信息

这层的意义在于“体验”，但它不应该和执行内核耦死。

### 2.4 App Server 是协议层

`codex-rs/app-server` 很值得重点讲。

它本质上是把 Codex 的能力包装成一个本地服务，向外暴露：

- thread
- turn
- item
- fs
- command
- skills
- apps
- models
- approval

这意味着：

- TUI 可以用它
- IDE 集成可以用它
- 桌面 App 可以用它
- 未来别的客户端也可以用它

也就是说，Codex 并没有把 agent 内核和某个 UI 绑死，而是在做一种**多前端共享同一套 runtime** 的设计。

### 2.5 Core 才是整个系统的重心

看 `codex-rs/core/src/lib.rs`，它几乎把所有关键能力都汇总在一个中心 crate 里：

```rust
mod codex; // 核心会话与运行时主逻辑
mod tasks; // 一轮 turn 对应的各种任务类型和调度逻辑
mod tools; // 工具注册、路由、审批、执行等相关逻辑
pub mod config; // 配置系统，对外公开
pub mod skills; // skill 加载与注入逻辑，对外公开
pub mod plugins; // plugin 发现、安装和管理逻辑，对外公开
pub use codex_thread::CodexThread; // 把线程对象重新导出，供其他 crate 直接使用
pub use thread_manager::ThreadManager; // 把线程管理器重新导出，作为更高层入口
```

对应源码：

- [`codex-rs/core/src/lib.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/lib.rs)

这里能看出 `codex-core` 真正在负责的事情：

- 会话和线程
- turn 执行
- tools
- skills / plugins
- config
- state 与 runtime 的桥接

所以，如果你要判断“Codex 的灵魂在哪”，答案基本就是：

**在 `codex-core`。**

### 2.6 Tools 和 State 是两个非常关键的基础面

再往下看，有两层特别重要：

- `tools`：决定模型能调什么，以及这些东西怎么被真正执行
- `state / rollout / thread-store`：决定系统如何记住过去发生过什么

这两层一层负责“行动”，一层负责“记忆”。

前者决定 Agent 能不能干活。  
后者决定 Agent 会不会像失忆一样每轮重来。

## 3. 一次 Turn 如何执行到底

如果你只想抓住 `Codex` 的主线，我建议不要先背目录树，而是先看：

**一轮 turn 到底怎么跑完整条链路。**

<figure class="fz009" data-reveal role="group" aria-label="一轮 Turn 的执行链路：用户与 UI、App Server 协议层、Core Turn Runtime、Tools 与 State 四条泳道间持续流式、可回放、可中断的执行流水线"><style>.fz009{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--cyan-bg:#dcebed;--cyan-bd:#8fbcc4;--cyan-tx:#3f6d79;--amber-bg:#f4e8cc;--amber-bd:#d9b66a;--amber-tx:#9a6516;--green-bg:#e7eedd;--green-bd:#7c9c54;--green-tx:#4f7233;--purple-bg:#e6e7f3;--purple-bd:#a9adcf;--purple-tx:#54579a;background:var(--paper-soft);color:var(--ink);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair);border-radius:14px;padding:clamp(14px,3vw,26px);margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz009 *{box-sizing:border-box}.fz009 .hd{text-align:center;margin-bottom:clamp(12px,2.4vw,20px)}.fz009 .t{font-weight:700;font-size:clamp(17px,3vw,24px);letter-spacing:.02em;color:var(--ink)}.fz009 .s{margin-top:6px;font-size:clamp(11px,1.7vw,14px);color:var(--muted);line-height:1.5}.fz009 .lanes{display:grid;grid-template-columns:0.92fr 1fr 1fr 0.92fr;gap:clamp(7px,1.4vw,13px)}.fz009 .lane{border-radius:13px;padding:10px 8px 14px;display:flex;flex-direction:column;gap:11px;border:1.5px solid;min-width:0}.fz009 .lh{text-align:center;font-weight:700;font-size:clamp(11px,1.7vw,15px);padding:3px 2px 7px;letter-spacing:.01em}.fz009 .l1{background:var(--cyan-bg);border-color:var(--cyan-bd)}.fz009 .l1 .lh{color:var(--cyan-tx)}.fz009 .l2{background:var(--amber-bg);border-color:var(--amber-bd)}.fz009 .l2 .lh{color:var(--amber-tx)}.fz009 .l3{background:var(--green-bg);border-color:var(--green-bd)}.fz009 .l3 .lh{color:var(--green-tx)}.fz009 .l4{background:var(--purple-bg);border-color:var(--purple-bd)}.fz009 .l4 .lh{color:var(--purple-tx)}.fz009 .node{background:#fff;border:1.5px solid var(--hair);border-radius:11px;padding:9px 7px;text-align:center;font-size:clamp(10px,1.55vw,13.5px);line-height:1.34;color:var(--ink-soft);position:relative;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-weight:600;opacity:.5;animation:fz009pop 9s ease-in-out infinite}.fz009 .l1 .node{border-color:var(--cyan-bd)}.fz009 .l2 .node{border-color:var(--amber-bd)}.fz009 .l3 .node{border-color:var(--green-bd)}.fz009 .l4 .node{border-color:var(--purple-bd)}.fz009 .node code{font-family:var(--font-mono,ui-monospace,monospace);background:rgba(26,24,21,.05);border-radius:4px;padding:0 3px;font-weight:700}.fz009 .n1{animation-delay:0s}.fz009 .n2{animation-delay:.7s}.fz009 .n3{animation-delay:1.4s}.fz009 .n4{animation-delay:2.1s}.fz009 .n5{animation-delay:2.8s}.fz009 .n6{animation-delay:3.5s}.fz009 .n7{animation-delay:4.2s}.fz009 .n8{animation-delay:5s}.fz009 .n9{animation-delay:5.7s}.fz009 .n10{animation-delay:6.4s}@keyframes fz009pop{0%,6%{opacity:.5;transform:translateY(3px)}14%,82%{opacity:1;transform:translateY(0)}100%{opacity:.74;transform:translateY(0)}}.fz009 .spc{height:clamp(30px,4.4vw,46px)}.fz009 .av{position:relative;height:9px;flex:none}.fz009 .av::before{content:"";position:absolute;left:50%;transform:translateX(-50%);top:0;width:2px;height:9px;background:var(--muted);opacity:.55}.fz009 .av::after{content:"";position:absolute;left:50%;transform:translateX(-50%);bottom:-4px;border-left:4px solid transparent;border-right:4px solid transparent;border-top:6px solid var(--muted);opacity:.7}.fz009 .flow{overflow:visible}.fz009 .flow .dot{position:absolute;left:50%;top:0;width:2px;height:9px;background:linear-gradient(180deg,transparent,var(--green-tx),transparent);transform:translateX(-50%);animation:fz009down 3.4s ease-in-out infinite}@keyframes fz009down{0%{transform:translateX(-50%) translateY(-9px);opacity:0}40%{opacity:1}100%{transform:translateX(-50%) translateY(0);opacity:0}}.fz009 .xcon{grid-column:1 / -1;display:flex;align-items:center;gap:6px;padding:1px 4px;margin:-3px 0}.fz009 .xcon .seg{flex:1;height:2px;background:repeating-linear-gradient(90deg,var(--muted) 0 6px,transparent 6px 12px);opacity:.5;position:relative;overflow:hidden}.fz009 .xcon .seg::after{content:"";position:absolute;top:-1px;width:16px;height:4px;border-radius:2px;background:var(--green-tx);opacity:.7;animation:fz009run 4s linear infinite}@keyframes fz009run{0%{left:-18px}100%{left:100%}}.fz009 .xlbl{font-size:clamp(9px,1.3vw,11px);color:var(--muted);font-style:italic;white-space:nowrap;flex:none}.fz009 .tri-r{width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid var(--muted);opacity:.7;flex:none}.fz009 .tri-l{width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:7px solid var(--muted);opacity:.7;flex:none}.fz009 .cross{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;color:var(--purple-tx);padding:2px 0}.fz009 .cross .seg{flex:1;height:2px;background:repeating-linear-gradient(90deg,var(--purple-tx) 0 6px,transparent 6px 12px);opacity:.55;position:relative;overflow:hidden}.fz009 .cross .seg::after{content:"";position:absolute;top:-1px;width:14px;height:4px;border-radius:2px;background:var(--purple-tx);opacity:.7;animation:fz009back 4s linear infinite}@keyframes fz009back{0%{right:-16px}100%{right:100%}}.fz009 .cross .tri-l{border-right-color:var(--purple-tx);opacity:.85}.fz009 .loop{margin-top:auto}.fz009 .ret{display:flex;align-items:center;gap:6px;margin-top:clamp(10px,1.8vw,16px);padding:7px 10px;border:1.5px dashed var(--cyan-bd);background:var(--cyan-bg);border-radius:11px;font-size:clamp(10px,1.5vw,13px);color:var(--cyan-tx);font-weight:600}.fz009 .ret .tri-l{border-right-color:var(--cyan-tx);opacity:.85}.fz009 .ret .seg{flex:1;height:2px;background:repeating-linear-gradient(90deg,var(--cyan-tx) 0 7px,transparent 7px 13px);opacity:.5;position:relative;overflow:hidden}.fz009 .ret .seg::after{content:"";position:absolute;top:-2px;width:16px;height:5px;border-radius:2px;background:var(--cyan-tx);opacity:.7;animation:fz009retrun 4.4s linear infinite}@keyframes fz009retrun{0%{right:-18px}100%{right:100%}}.fz009 .foot{display:grid;grid-template-columns:1fr 1fr;gap:clamp(8px,2vw,18px);margin-top:clamp(12px,2.2vw,18px)}.fz009 .cap{border-top:2px solid var(--hair);padding-top:9px;font-size:clamp(10px,1.55vw,13px);line-height:1.5;color:var(--ink-soft)}.fz009 .cap.c1{border-color:var(--cyan-bd)}.fz009 .cap.c2{border-color:var(--green-bd)}.fz009 .cap b{color:var(--ink);font-family:var(--font-serif-body,Georgia,serif)}@media(max-width:560px){.fz009 .lanes{grid-template-columns:1fr 1fr;gap:8px}.fz009 .lane{gap:8px}.fz009 .spc{display:none}.fz009 .xcon{flex-wrap:wrap}.fz009 .foot{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.fz009 .node{animation:none;opacity:1;transform:none}.fz009 .flow .dot,.fz009 .xcon .seg::after,.fz009 .cross .seg::after,.fz009 .ret .seg::after{animation:none;display:none}}</style><div class="hd"><div class="t">一轮 Turn 的执行链路</div><div class="s">它不是"问一下模型"，而是一条持续流式、可回放、可中断的执行流水线</div></div><div class="lanes"><div class="lane l1"><div class="lh">用户 / UI</div><div class="node n1">用户发起请求</div><div class="spc"></div><div class="spc"></div><div class="spc"></div><div class="node n10 loop">UI 持续收到事件</div></div><div class="lane l2"><div class="lh">App Server / 协议层</div><div class="node n2"><code>thread/start</code> 或 <code>turn/start</code></div></div><div class="lane l3"><div class="lh">Core / Turn Runtime</div><div class="node n3">构建 <code>TurnContext</code></div><div class="av flow"><span class="dot"></span></div><div class="node n4">拼装历史、工具和指令</div><div class="av flow"><span class="dot"></span></div><div class="node n5">调用模型并接收流式输出</div><div class="av"></div><div class="node n8">结束 turn，汇总最终消息</div></div><div class="lane l4"><div class="lh">Tools / State</div><div class="spc"></div><div class="node n6">如有 tool call</div><div class="av flow"><span class="dot"></span></div><div class="node n7">执行工具并返回结果</div><div class="cross"><div class="tri-l"></div><div class="seg"></div><small>返回 Core</small></div><div class="node n9 loop">写入 <code>rollout</code> / <code>state</code></div></div><div class="xcon"><span class="xlbl">用户发起请求</span><div class="seg"></div><span class="tri-r"></span><span class="xlbl">协议层 <code>thread/start</code> / <code>turn/start</code></span><div class="seg"></div><span class="tri-r"></span><span class="xlbl">进入 Core 构建 Turn 上下文</span><div class="seg"></div><span class="tri-r"></span><span class="xlbl">调度 Tools 执行</span></div><div class="ret"><div class="tri-l"></div><div class="seg"></div><span>turn 结束后事件持续回流到 UI —— 用户看到的是完整执行过程，而非单个答案</span></div><div class="foot"><div class="cap c1"><b>用户看到的不是单个答案</b>，而是完整执行过程。</div><div class="cap c2">Turn 本质上是一个<b>可取消、可观测、可流式输出</b>的后台任务。</div></div></figure>

### 3.1 先理解 `Thread / Turn / Item`

在 `app-server` 的定义里，这三个概念是顶层原语：

- `Thread`：一条会话
- `Turn`：一轮交互
- `Item`：这轮交互里的具体事件

这组抽象非常漂亮，因为它一套模型同时服务了三件事：

1. UI 展示
1. runtime 执行
1. 持久化回放

这比“只把历史存成一段大文本”强很多，因为它让系统可以知道：

- 哪一段是用户输入
- 哪一段是工具调用
- 哪一段是执行输出
- 哪一段是最终回答

### 3.2 一个 turn 的本质，是一个异步任务

在 `core/src/tasks/mod.rs` 里，`SessionTask` 这个 trait 很能说明问题：

```rust
pub(crate) trait SessionTask: Send + Sync + 'static { // 所有 turn 任务都要满足可线程安全共享、可异步运行这些约束
    fn kind(&self) -> TaskKind; // 任务类型：用于 UI 展示和遥测打点
    fn span_name(&self) -> &'static str; // tracing span 的名字：便于日志和链路追踪

    fn run( // 真正执行任务的方法
        self: Arc<Self>, // 任务对象本身，以引用计数方式跨异步边界传递
        session: Arc<SessionTaskContext>, // 这轮任务能访问到的 session 级上下文
        ctx: Arc<TurnContext>, // 这一次 turn 的运行上下文
        input: Vec<UserInput>, // 用户给到本轮任务的输入
        cancellation_token: CancellationToken, // 外部中断时用来取消任务的令牌
    ) -> impl Future<Output = Option<String>> + Send; // 返回一个异步 future，完成后可选地产生最终消息
} // 这里结束任务接口定义
```

对应源码：

- [`codex-rs/core/src/tasks/mod.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/tasks/mod.rs)

这段代码其实已经把事情说穿了：

- 一次 turn 不是“同步调用一下模型”
- 它是一个可取消、可观测、可流式输出的后台任务

### 3.3 一轮 turn 大致会经历这些阶段

我把它拆成最通俗的 9 步：

1. 用户输入进入系统
1. runtime 为这轮构造 `TurnContext`
1. 系统收集历史、配置、skills、可用 tools
1. 构造模型输入
1. 模型开始流式输出
1. 如果模型触发 tool call，就进入 tool runtime
1. 工具结果再回填模型继续推理
1. UI 端持续收到流式事件
1. turn 结束后，把过程写入 rollout 和 state

### 3.4 `TurnContext` 是这一轮执行的“工作台”

虽然 `TurnContext` 本身结构很大，但从概念上看，它像是本轮任务的工作台，里面放着：

- cwd
- sandbox policy
- approval policy
- 可用工具
- 当前线程和 turn 元数据
- 模型配置
- 与 state / telemetry / auth / network policy 相关的上下文

这一步非常关键，因为：

**模型看到的不是裸环境，而是 harness 为这轮任务准备好的可见世界。**

### 3.5 为什么这条链路要做成“流式事件”

这也是很多人第一次看 Codex 容易忽略的点。

如果系统只是：

- 收到输入
- 过一会儿返回一个答案

那就还是聊天式产品。

但 `Codex` 在过程里会持续发出事件：

- item started
- item completed
- command output delta
- approval requested
- agent message delta
- turn completed

这样 UI 才能真实反映：

- 它现在在干什么
- 哪一步卡住了
- 哪一步需要你批准
- 哪一步已经成功

也就是说，`Codex` 的体验不是“看最终结果”，而是“看执行过程”。

### 3.6 这套 turn 模型的工程价值

如果只用一句话总结这一章，我会说：

> 在 Codex 里，一轮交互不是一段文本，而是一串可执行、可展示、可回放、可恢复的 item 流。

这就是为什么它能做成 agent runtime，而不只是聊天壳。

## 4. 为什么工具执行必须带审批、沙箱和策略控制

这一章是全文最关键的部分。

如果你要抓住 `Codex` 和“聊天 + shell”这类简单系统的本质差别，重点就在这里。

<figure class="fz010" data-reveal role="group" aria-label="Harness 控制链：模型提议动作，执行权经审批、策略和沙箱层层过滤后第一次尝试执行，分为被拒绝、成功、因沙箱失败三种结果"><style>.fz010{--p-soft:var(--paper-soft,#faf6ec);--p-deep:var(--paper-deep,#ece5d5);--p-warm:#f7f1e4;--ink:var(--ink,#1a1815);--ink-soft:var(--ink-soft,#3c362c);--muted:var(--muted,#6a6155);--hair:var(--hair,rgba(26,24,21,.18));--grn:#4f7233;--grn-bg:#e7eedd;--grn-br:#7c9c54;--cyn:#3f6d79;--cyn-bg:#dcebed;--cyn-br:#8fbcc4;--amb:#9a6516;--amb-bg:#f4e8cc;--amb-br:#d9b66a;--red:#8f2d20;--red-bg:#f1ddd6;--red-br:#cf9b90;--pur:#54579a;--pur-bg:#e6e7f3;--pur-br:#a9adcf;margin:0;padding:clamp(1rem,3vw,1.7rem);background:linear-gradient(160deg,var(--p-soft),var(--p-warm));border:1px solid var(--hair);border-radius:1rem;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);box-sizing:border-box;line-height:1.5}.fz010 *{box-sizing:border-box}.fz010 .hd{text-align:center;margin-bottom:1.2rem}.fz010 .ttl{font-size:clamp(1.15rem,3.6vw,1.6rem);font-weight:700;letter-spacing:.02em}.fz010 .sub{font-size:clamp(.74rem,2vw,.9rem);color:var(--muted);margin-top:.3rem}.fz010 .lane{display:flex;align-items:stretch;justify-content:center;gap:0;flex-wrap:wrap}.fz010 .node{flex:1 1 8.5rem;min-width:7.5rem;padding:.7rem .75rem;border-radius:.85rem;border:1.5px solid var(--hair);background:var(--p-warm);text-align:center;display:flex;flex-direction:column;justify-content:center;position:relative}.fz010 .nt{font-size:clamp(.9rem,2.4vw,1.08rem);font-weight:700}.fz010 .nx{font-size:clamp(.72rem,1.9vw,.84rem);color:var(--ink-soft);margin-top:.32rem;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz010 .ns{font-size:clamp(.66rem,1.7vw,.76rem);color:var(--muted);margin-top:.28rem}.fz010 .n-mdl{background:var(--pur-bg);border-color:var(--pur-br)}.fz010 .n-mdl .nt{color:var(--pur)}.fz010 .n-apr{background:var(--amb-bg);border-color:var(--amb-br)}.fz010 .n-apr .nt{color:var(--amb)}.fz010 .n-pol{background:var(--grn-bg);border-color:var(--grn-br)}.fz010 .n-pol .nt{color:var(--grn)}.fz010 .n-sbx{background:var(--red-bg);border-color:var(--red-br)}.fz010 .n-sbx .nt{color:var(--red)}.fz010 .ar{flex:0 0 auto;align-self:center;width:2rem;height:1.1rem;position:relative;margin:0 -.1rem}.fz010 .ar::before{content:"";position:absolute;left:.1rem;right:.55rem;top:50%;height:2px;transform:translateY(-50%);background:linear-gradient(90deg,transparent,var(--muted) 18%,var(--muted));background-size:200% 100%;animation:fz-flow 7s linear infinite}.fz010 .ar::after{content:"";position:absolute;right:.15rem;top:50%;transform:translateY(-50%);border-left:.5rem solid var(--muted);border-top:.35rem solid transparent;border-bottom:.35rem solid transparent}.fz010 .stem{display:flex;flex-direction:column;align-items:center;margin:.45rem 0 .35rem}.fz010 .stem .ln{width:2px;height:1.5rem;background:linear-gradient(180deg,transparent,var(--muted) 30%,var(--muted));background-size:100% 200%;animation:fz-flowv 7s linear infinite}.fz010 .stem .tip{border-top:.5rem solid var(--muted);border-left:.35rem solid transparent;border-right:.35rem solid transparent}.fz010 .bend{display:flex;justify-content:flex-end;padding-right:9%;margin:.45rem 0 0}.fz010 .bend .seg{position:relative;width:46%;height:1.4rem}.fz010 .bend .seg::before{content:"";position:absolute;right:0;top:0;width:2px;height:100%;background:var(--muted)}.fz010 .bend .seg::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,var(--muted),var(--muted) 82%,transparent);background-size:200% 100%;animation:fz-flow 7s linear infinite}.fz010 .mid{display:flex;justify-content:center}.fz010 .try{flex:1 1 auto;max-width:30rem;padding:.8rem 1rem;border-radius:.85rem;border:1.5px solid var(--hair);background:var(--p-soft);text-align:center;position:relative}.fz010 .try .nt{color:var(--ink)}.fz010 .out{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;margin-top:.7rem}.fz010 .cell{display:flex;flex-direction:column;align-items:center}.fz010 .out .node{width:100%}.fz010 .barr{position:relative;height:1.5rem;width:100%;margin-bottom:.15rem}.fz010 .barr .stalk{position:absolute;background:linear-gradient(180deg,transparent,var(--muted) 30%,var(--muted));background-size:100% 200%;animation:fz-flowv 7s linear infinite}.fz010 .b-down .stalk{left:50%;top:0;bottom:0;width:2px;transform:translateX(-50%)}.fz010 .b-down .head{position:absolute;left:50%;bottom:0;transform:translateX(-50%);border-top:.5rem solid var(--muted);border-left:.35rem solid transparent;border-right:.35rem solid transparent}.fz010 .b-left .stalk{left:0;right:50%;top:50%;height:2px;transform:translateY(-50%);background:linear-gradient(90deg,var(--muted),var(--muted) 82%,transparent);background-size:200% 100%;animation:fz-flow 7s linear infinite}.fz010 .b-left .head{position:absolute;left:0;top:50%;transform:translateY(-50%);border-right:.5rem solid var(--muted);border-top:.35rem solid transparent;border-bottom:.35rem solid transparent}.fz010 .b-right .stalk{left:50%;right:0;top:50%;height:2px;transform:translateY(-50%);background:linear-gradient(90deg,transparent,var(--muted) 18%,var(--muted));background-size:200% 100%;animation:fz-flow 7s linear infinite}.fz010 .b-right .head{position:absolute;right:0;top:50%;transform:translateY(-50%);border-left:.5rem solid var(--muted);border-top:.35rem solid transparent;border-bottom:.35rem solid transparent}.fz010 .n-rej{background:var(--amb-bg);border-color:var(--amb-br)}.fz010 .n-rej .nt{color:var(--amb)}.fz010 .n-ok{background:var(--cyn-bg);border-color:var(--cyn-br)}.fz010 .n-ok .nt{color:var(--cyn)}.fz010 .n-fail{background:var(--pur-bg);border-color:var(--pur-br)}.fz010 .n-fail .nt{color:var(--pur)}.fz010 .foot{margin-top:1.1rem;text-align:center;font-size:clamp(.74rem,2vw,.9rem);color:var(--ink-soft);border-top:1px dashed var(--hair);padding-top:.8rem}.fz010 .foot b{color:var(--red)}@keyframes fz-flow{0%{background-position:120% 0}100%{background-position:-120% 0}}@keyframes fz-flowv{0%{background-position:0 120%}100%{background-position:0 -120%}}@media(max-width:560px){.fz010 .lane{flex-direction:column;align-items:stretch}.fz010 .ar{width:1.1rem;height:1.6rem;transform:rotate(90deg);margin:.1rem auto;align-self:center}.fz010 .bend{justify-content:center;padding-right:0}.fz010 .bend .seg{width:2px}.fz010 .bend .seg::after{display:none}.fz010 .out{grid-template-columns:1fr;gap:.55rem}.fz010 .barr{height:1.1rem}.fz010 .b-left .stalk,.fz010 .b-right .stalk{left:50%;right:auto;width:2px;height:100%;top:0;transform:translateX(-50%);background:linear-gradient(180deg,transparent,var(--muted) 30%,var(--muted));background-size:100% 200%;animation:fz-flowv 7s linear infinite}.fz010 .b-left .head,.fz010 .b-right .head{left:50%;right:auto;top:auto;bottom:0;transform:translateX(-50%);border:0;border-top:.5rem solid var(--muted);border-left:.35rem solid transparent;border-right:.35rem solid transparent}}@media(prefers-reduced-motion:reduce){.fz010 .ar::before,.fz010 .stem .ln,.fz010 .bend .seg::after,.fz010 .barr .stalk{animation:none}.fz010 .ar::before{background:var(--muted)}.fz010 .stem .ln{background:var(--muted)}.fz010 .b-down .stalk{background:var(--muted)}.fz010 .b-left .stalk{background:var(--muted)}.fz010 .b-right .stalk{background:var(--muted)}.fz010 .bend .seg::after{background:var(--muted)}}</style><div class="hd"><div class="ttl">Harness 控制链</div><div class="sub">模型提出动作，真正的执行权要经过审批、策略和沙箱层层过滤</div></div><div class="lane"><div class="node n-mdl"><div class="nt">模型</div><div class="nx">提议 tool call</div></div><div class="ar" aria-hidden="true"></div><div class="node n-apr"><div class="nt">审批判断</div><div class="nx">Skip / Ask / Forbidden</div><div class="ns">必要时交给用户或 guardian</div></div><div class="ar" aria-hidden="true"></div><div class="node n-pol"><div class="nt">策略判断</div><div class="nx">网络策略 / execpolicy</div><div class="ns">判断可否执行、是否允许升级</div></div><div class="ar" aria-hidden="true"></div><div class="node n-sbx"><div class="nt">沙箱选择</div><div class="ns">只读 / 工作区写 / 更高权限</div></div></div><div class="bend" aria-hidden="true"><div class="seg"></div></div><div class="stem" aria-hidden="true"><div class="ln"></div><div class="tip"></div></div><div class="mid"><div class="node try"><div class="nt">第一次尝试执行</div><div class="ns">先在受限环境里跑，再看是否成功</div></div></div><div class="stem" aria-hidden="true"><div class="ln"></div><div class="tip"></div></div><div class="out"><div class="cell"><div class="barr b-left" aria-hidden="true"><div class="stalk"></div><div class="head"></div></div><div class="node n-rej"><div class="nt">被拒绝</div><div class="ns">直接停止，返回拒绝原因</div></div></div><div class="cell"><div class="barr b-down" aria-hidden="true"><div class="stalk"></div><div class="head"></div></div><div class="node n-ok"><div class="nt">成功</div><div class="ns">输出回填模型</div><div class="ns">同时记录事件、状态和审计信息</div></div></div><div class="cell"><div class="barr b-right" aria-hidden="true"><div class="stalk"></div><div class="head"></div></div><div class="node n-fail"><div class="nt">因沙箱失败</div><div class="ns">看策略是否允许更高权限重试</div><div class="ns">而且不会无条件升级</div></div></div></div><div class="foot">一句话：模型只负责提出动作，<b>真正的权限边界掌握在 runtime 手里</b></div></figure>

### 4.1 模型只能“提议动作”，不能直接拥有执行权

这是我看完 `Codex` 后最强烈的一个感受。

在它的设计里，模型不是直接拿着系统权限乱跑，而是：

- 模型提议要调用某个工具
- runtime 判断这个动作该不该允许
- runtime 决定用什么权限级别执行
- runtime 决定失败后能不能重试、要不要升级

这个分工非常重要。

因为它意味着：

**模型只负责做决策，真正的权限边界掌握在 runtime 手里。**

### 4.2 Tool Orchestrator 把风险控制收口了

`core/src/tools/orchestrator.rs` 开头就已经把设计意图写得很直白了：

- approval
- sandbox selection
- retry semantics

如果把它裁剪成最核心的逻辑，大致是这样：

```rust
pub async fn run(...) -> Result<OrchestratorRunResult<Out>, ToolError> { // 工具总调度入口：把审批、沙箱、重试都收口在这里
    // 1) 先决定这次调用是直接放行、需要审批，还是直接禁止
    let requirement = tool.exec_approval_requirement(req) // 先询问具体工具：这次调用有没有特殊审批要求
        .unwrap_or_else(|| default_exec_approval_requirement(...)); // 如果工具没特殊要求，就退回通用默认策略

    match requirement { // 按审批结论进入不同分支
        ExecApprovalRequirement::Skip { .. } => {} // 可以直接继续，说明这次调用不需要额外确认
        ExecApprovalRequirement::Forbidden { reason } => { // 如果策略明确禁止
            return Err(ToolError::Rejected(reason)); // 直接拒绝，不再尝试执行
        } // 这里结束禁止分支
        ExecApprovalRequirement::NeedsApproval { .. } => { // 如果这次调用必须先审批
            let decision = tool.start_approval_async(req, approval_ctx).await; // 走异步审批流程，可能找用户，也可能找 guardian
            if decision.is_rejected() { // 如果审批结果是不允许
                return Err(ToolError::Rejected("rejected".into())); // 立即终止本次工具执行
            } // 这里结束“审批被拒”分支
        } // 这里结束“需要审批”分支
    } // 这里结束审批判断

    // 2) 在选定的 sandbox 里做第一次尝试
    let initial_sandbox = self.sandbox.select_initial(...); // 先挑一个初始沙箱级别，而不是默认给最高权限
    let first_result = Self::run_attempt(tool, req, tool_ctx, &initial_attempt, ...).await; // 在这个沙箱里真的跑一次

    // 3) 如果因为 sandbox 被拒绝，再决定要不要升级重试
    match first_result { // 根据第一次执行结果继续分流
        Ok(out) => Ok(...), // 如果直接成功，就把结果返回给上层
        Err(ToolError::Codex(CodexErr::Sandbox(...))) => { // 如果失败原因是沙箱限制
            // 根据策略决定是否升级
            ... // 这里会继续判断：能不能提权、要不要重试、需不需要再次审批
        } // 这里结束“沙箱拒绝”分支
        Err(err) => Err(err), // 其他类型的错误原样向上抛出
    } // 这里结束首次尝试结果处理
} // 这里结束 orchestrator 的主执行函数
```

对应源码：

- [`codex-rs/core/src/tools/orchestrator.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/tools/orchestrator.rs)

如果只看这段流程，你会发现它其实是在做一个非常典型的 harness 动作：

1. 先判断风险
1. 再判断权限
1. 再选择隔离环境
1. 再决定是否执行
1. 最后再看是否允许升级

### 4.3 审批不是体验负担，而是副作用熔断器

很多人看 agent 时会觉得审批很烦。

但站在系统设计角度，审批的真正作用是：

**在模型即将做高风险动作时，给系统一个“从自动回到受控”的机会。**

它不是为了打断用户，而是为了防止这些问题直接落地：

- 未经确认的高风险命令
- 越权写文件
- 外部网络访问
- 破坏性 git 操作
- 可疑数据外发

### 4.4 沙箱不是可选优化，而是本地 Agent 的底线

一旦 agent 能跑命令、改文件、联网，沙箱就不再是“锦上添花”，而是最基本的安全边界。

在 `Codex` 里，沙箱不是某个命令行 flag 的附属品，而是 runtime 一等公民：

- 先在受限环境里尝试
- 再按策略决定是否升级
- 平台上分别处理 macOS / Linux / Windows

你可以把它理解成：

- 审批负责“要不要做”
- 沙箱负责“最多能做到什么程度”

### 4.5 连 `apply_patch` 都不是随便放行的

`apply_patch` 很容易被误以为只是一个普通文件编辑工具，但 `Codex` 对它也做了专门的安全判断：

```rust
match assess_patch_safety(...) { // 先对 patch 做安全评估，而不是直接应用
    SafetyCheck::AutoApprove { .. } => { // 如果这个 patch 足够安全，可以自动放行
        DelegateToRuntime(ApplyPatchRuntimeInvocation { // 把真正执行 patch 的动作交给 runtime
            exec_approval_requirement: ExecApprovalRequirement::Skip { ... }, // 标记为这次无需再额外审批
            ... // 其余字段包括 patch 本身和运行时所需元信息
        }) // 返回“交给 runtime 执行”的指令
    } // 这里结束自动放行分支
    SafetyCheck::AskUser => { // 如果 patch 有副作用，但风险没有高到直接拒绝
        DelegateToRuntime(ApplyPatchRuntimeInvocation { // 同样交给 runtime 去真正执行
            exec_approval_requirement: ExecApprovalRequirement::NeedsApproval { ... }, // 但这次先要求用户审批
            ... // 其余字段保持不变
        }) // 返回“需要审批后再执行”的指令
    } // 这里结束需要用户确认分支
    SafetyCheck::Reject { reason } => { // 如果 patch 风险太高或者明显不合理
        Output(Err(FunctionCallError::RespondToModel( // 直接构造一个返回给模型的错误结果
            format!("patch rejected: {reason}") // 把拒绝原因拼成模型能读懂的消息
        ))) // 让这次 apply_patch 到此结束
    } // 这里结束直接拒绝分支
} // 这里结束 patch 安全评估
```

对应源码：

- [`codex-rs/core/src/apply_patch.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/apply_patch.rs)

这段逻辑很值得强调，因为它说明：

**即便是“改文件”这种看似日常的动作，在 agent runtime 里也必须先经过风险判断。**

### 4.6 Guardian 的意义：在高风险点再加一层 reviewer

除了用户审批，Codex 还有一层很有意思的设计：`guardian`。

它的想法不是“永远相信主模型”，而是在高风险审批点，引入一个专门的审查子代理帮助做判断。

这件事说明它已经不是“一个模型 + 一堆工具”的朴素设计，而开始引入更复杂的**模型间制衡**。

### 4.7 本章的核心判断

如果只记住一句话，我建议记这个：

> 在 Codex 里，工具不是模型直接拥有的权力，而是 runtime 按审批、策略和沙箱有条件借给模型的能力。

这就是 harness 的精髓。

## 5. 为什么 MCP、plugins、skills 必须是一等公民

如果只做一个“本地读文件 + 跑 shell”的 agent，其实不需要那么复杂的扩展系统。

但 `Codex` 很明显不是这么想的。

<figure class="fz011" data-reveal role="group" aria-label="为什么扩展系统必须是一等公民：内置 Tools、MCP、Skills、Plugins/Apps 四类能力统一汇入 Codex Core 做统一注册、调度与审计"><style>.fz011{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gr:#4f7233;--grb:#e7eedd;--grl:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;--pu:#54579a;--pub:#e6e7f3;--pue:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));color:var(--ink,#1a1815);margin:0;padding:1.4rem clamp(.7rem,3vw,1.6rem) 1.5rem;border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;box-sizing:border-box;max-width:100%;overflow:hidden}.fz011 *{box-sizing:border-box}.fz011 .hd{text-align:center;margin-bottom:1.2rem}.fz011 .ttl{font-weight:700;font-size:clamp(1.15rem,3.4vw,1.6rem);letter-spacing:.02em;color:var(--ink,#1a1815);line-height:1.25}.fz011 .sub{font-size:clamp(.74rem,2vw,.92rem);color:var(--muted,#6a6155);margin-top:.4rem;line-height:1.4}.fz011 .grid{display:grid;grid-template-columns:1fr auto 1fr;grid-template-rows:auto auto auto;gap:clamp(.5rem,1.6vw,1rem);align-items:stretch;justify-items:stretch}.fz011 .node{border-radius:14px;border:1.5px solid;padding:.7rem .8rem;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:.2rem;min-width:0}.fz011 .node b{font-weight:700;font-size:clamp(.92rem,2.4vw,1.12rem);letter-spacing:.01em}.fz011 .node .ln{font-size:clamp(.7rem,1.9vw,.84rem);color:var(--ink-soft,#3c362c);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);word-break:break-word}.fz011 .node small{font-size:clamp(.66rem,1.7vw,.76rem);color:var(--muted,#6a6155);line-height:1.35}.fz011 .n-tools{grid-column:1;grid-row:1;background:var(--cyb,#dcebed);border-color:var(--cye,#8fbcc4)}.fz011 .n-tools b{color:var(--cy,#3f6d79)}.fz011 .n-mcp{grid-column:3;grid-row:1;background:var(--pub,#e6e7f3);border-color:var(--pue,#a9adcf)}.fz011 .n-mcp b{color:var(--pu,#54579a)}.fz011 .n-skills{grid-column:1;grid-row:3;background:var(--grb,#e7eedd);border-color:var(--grl,#7c9c54)}.fz011 .n-skills b{color:var(--gr,#4f7233)}.fz011 .n-plug{grid-column:3;grid-row:3;background:var(--rdb,#f1ddd6);border-color:var(--rde,#cf9b90)}.fz011 .n-plug b{color:var(--rd,#8f2d20)}.fz011 .core{grid-column:2;grid-row:2;align-self:center;justify-self:center;width:clamp(8.5rem,22vw,11rem);height:clamp(8.5rem,22vw,11rem);border-radius:50%;background:radial-gradient(circle at 50% 42%,var(--amb,#f4e8cc),#f0dcb4);border:3px solid var(--ame,#d9b66a);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:.6rem;position:relative;z-index:3;box-shadow:0 0 0 0 rgba(154,101,22,.28);animation:fzpulse 7s ease-in-out infinite}.fz011 .core b{font-weight:700;font-size:clamp(1rem,2.8vw,1.3rem);color:var(--am,#9a6516)}.fz011 .core .u{font-size:clamp(.66rem,1.8vw,.8rem);color:var(--ink-soft,#3c362c);margin-top:.3rem;line-height:1.4}.fz011 .core .u span{white-space:nowrap}.fz011 .flow{grid-column:2;grid-row:2;position:relative;z-index:1;align-self:stretch;justify-self:stretch}.fz011 .flow i{position:absolute;width:42%;height:3px;top:50%;left:50%;transform-origin:0 50%;border-radius:3px;overflow:hidden;opacity:.55}.fz011 .flow i::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,currentColor 45%,transparent);animation:fzflow 4.5s linear infinite}.fz011 .f1{transform:rotate(218deg)}.fz011 .f1,.fz011 .f1 i{color:var(--cy,#3f6d79)}.fz011 .f1 i::before{animation-delay:0s}.fz011 .f2{transform:rotate(-38deg);color:var(--pu,#54579a)}.fz011 .f2 i::before{animation-delay:1.1s}.fz011 .f3{transform:rotate(142deg);color:var(--gr,#4f7233)}.fz011 .f3 i::before{animation-delay:2.2s}.fz011 .f4{transform:rotate(38deg);color:var(--rd,#8f2d20)}.fz011 .f4 i::before{animation-delay:3.3s}.fz011 .arr{position:absolute;width:0;height:0;border-style:solid}.fz011 .node::after{content:"";position:absolute;width:0;height:0;border-style:solid;opacity:.85}.fz011 .n-tools::after{bottom:-9px;right:14%;border-width:9px 7px 0 7px;border-color:var(--cye,#8fbcc4) transparent transparent transparent;animation:fzbob 4.5s ease-in-out infinite}.fz011 .n-mcp::after{bottom:-9px;left:14%;border-width:9px 7px 0 7px;border-color:var(--pue,#a9adcf) transparent transparent transparent;animation:fzbob 4.5s ease-in-out infinite .9s}.fz011 .n-skills::after{top:-9px;right:14%;border-width:0 7px 9px 7px;border-color:transparent transparent var(--grl,#7c9c54) transparent;animation:fzbobu 4.5s ease-in-out infinite 1.8s}.fz011 .n-plug::after{top:-9px;left:14%;border-width:0 7px 9px 7px;border-color:transparent transparent var(--rde,#cf9b90) transparent;animation:fzbobu 4.5s ease-in-out infinite 2.7s}.fz011 .foot{margin-top:1.2rem;text-align:center;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:.7rem 1rem;font-size:clamp(.78rem,2.1vw,.96rem);color:var(--ink,#1a1815);font-weight:600;line-height:1.45;position:relative;overflow:hidden}.fz011 .foot::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(var(--cy,#3f6d79),var(--pu,#54579a),var(--gr,#4f7233),var(--rd,#8f2d20));animation:fzbar 8s ease-in-out infinite}@keyframes fzpulse{0%,100%{box-shadow:0 0 0 0 rgba(154,101,22,.26)}50%{box-shadow:0 0 0 12px rgba(154,101,22,0)}}@keyframes fzflow{0%{transform:translateX(220%)}100%{transform:translateX(-100%)}}@keyframes fzbob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}@keyframes fzbobu{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes fzbar{0%,100%{opacity:.5}50%{opacity:1}}@media (max-width:560px){.fz011 .grid{grid-template-columns:1fr;grid-template-rows:none}.fz011 .n-tools,.fz011 .n-mcp,.fz011 .n-skills,.fz011 .n-plug,.fz011 .core,.fz011 .flow{grid-column:1;grid-row:auto}.fz011 .core{order:3;margin:.4rem auto}.fz011 .n-tools{order:1}.fz011 .n-mcp{order:2}.fz011 .n-skills{order:4}.fz011 .n-plug{order:5}.fz011 .flow{display:none}.fz011 .node::after{display:none}}@media (prefers-reduced-motion:reduce){.fz011 .core{animation:none;box-shadow:0 0 0 4px rgba(154,101,22,.12)}.fz011 .flow i::before{animation:none;opacity:1;background:currentColor}.fz011 .node::after{animation:none}.fz011 .foot::before{animation:none;opacity:1}}</style><div class="hd"><div class="ttl">为什么扩展系统必须是一等公民</div><div class="sub">能力可以很多样，但进入模型和 runtime 的方式必须统一</div></div><div class="grid"><div class="node n-tools"><b>内置 Tools</b><span class="ln">exec_command / apply_patch</span><small>直接贴近本地环境</small></div><div class="node n-mcp"><b>MCP</b><span class="ln">外部 tool / resource 协议化接入</span><small>连接远端系统而不写死进 core</small></div><div class="flow"><div class="f1"><i></i></div><div class="f2"><i></i></div><div class="f3"><i></i></div><div class="f4"><i></i></div></div><div class="core"><b>Codex Core</b><div class="u"><span>统一注册 · 统一调度</span><br><span>统一审计</span></div></div><div class="node n-skills"><b>Skills</b><span class="ln">经验、流程、约束的结构化注入</span><small>让模型更像在按套路干活</small></div><div class="node n-plug"><b>Plugins / Apps</b><span class="ln">更完整的能力包和连接器</span><small>可以同时带 skill、app、MCP server</small></div></div><div class="foot">不是把所有能力都写进 core，而是把"能力接入"本身工程化</div></figure>

### 5.1 真实世界的 Agent，能力来源一定是分散的

真正的工作环境里，能力来源从来不是单一的：

- 本地 shell
- 文件系统
- git
- 文档系统
- issue / PR 系统
- 数据库
- 企业内部工具
- 云服务和第三方 API

如果把所有这些能力都硬写进 `codex-core`，很快就会遇到几个问题：

- core 越来越臃肿
- 发布节奏被绑死
- 权限和认证处理越来越乱
- 某些能力只适用于部分用户

所以，平台化扩展面几乎是必然的。

### 5.2 MCP 的角色：把外部能力协议化

MCP 在 `Codex` 里的位置很关键。

它不是简单地多加一个“远程工具调用”功能，而是在说：

**外部能力接入，应该通过统一协议来完成。**

这样 core 不需要认识所有外部系统的细节，只需要知道：

- 这是一个 MCP server
- 它暴露了哪些 tool / resource
- 调用时用统一的 schema 和流程处理

这会显著降低扩展时的耦合度。

### 5.3 Skill 的角色：把经验和流程结构化

`Skill` 和 MCP 不一样。

MCP 更偏“连接外部能力”，而 skill 更偏“把经验注入模型”。

它通常会包含：

- 某类任务的背景知识
- 推荐的工作流程
- 工具使用约束
- 特定场景下的 prompt / 指令

这相当于把零散经验，变成可复用的能力单元。

### 5.4 Plugin 的角色：把能力打成包

Plugin 更进一步。

它往往不只是一段说明，而是一个完整的扩展单元，可能同时包含：

- skills
- apps
- MCP server
- marketplace 元数据

所以插件的作用，不只是“多一个功能”，而是让 Codex 从产品走向平台。

### 5.5 工具注册计划暴露了 Codex 的扩展哲学

`tools/src/tool_registry_plan.rs` 里有一段代码特别能说明问题：

```rust
if config.has_environment { // 只有当前运行环境允许访问本地环境时，才暴露本地执行工具
    plan.push_spec(create_exec_command_tool(...), true, ...); // 把 `exec_command` 这种本地执行工具加进工具表
} // 这里结束“本地环境工具”分支

if params.mcp_tools.is_some() { // 如果这轮上下文里存在 MCP 工具
    plan.push_spec(create_list_mcp_resources_tool(), true, ...); // 暴露“列出 MCP 资源”工具
    plan.push_spec(create_read_mcp_resource_tool(), true, ...); // 暴露“读取 MCP 资源”工具
} // 这里结束 MCP 工具注册分支

plan.push_spec(create_update_plan_tool(), false, ...); // 无论如何都把 `update_plan` 这种元工具放进来

if config.request_permissions_tool_enabled { // 如果当前特性开关允许模型申请额外权限
    plan.push_spec(create_request_permissions_tool(...), false, ...); // 就把 `request_permissions` 工具暴露给模型
} // 这里结束权限申请工具注册分支
```

对应源码：

- [`codex-rs/tools/src/tool_registry_plan.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/tools/src/tool_registry_plan.rs)

这段代码说明了几个很关键的设计点：

1. 工具是按配置和能力条件被拼出来的
1. 本地环境工具和 MCP 工具是同一注册体系的一部分
1. `request_permissions`、`update_plan` 这种“元工具”也是一等公民

这不是随手塞几个函数，而是在构建一张**能力暴露面**。

### 5.6 为什么说它们必须是一等公民

因为如果不是一等公民，就会出现这些坏味道：

- 扩展只能靠修改 core
- 不同类型的能力没有统一暴露模型的方法
- UI 很难统一展示和审批
- 状态系统很难理解这些外部能力发生过什么

而 `Codex` 现在的方向很明显是相反的：

**能力可以很多样，但进入模型和 runtime 的方式必须统一。**

## 6. 为什么需要 rollout、SQLite、memory pipeline 这类长期状态设施

如果一个系统只有“单轮问答”，那历史状态并不那么重要。

但 agent 一旦要做长期协作，状态层就变成刚需。

<figure class="fz012" data-reveal role="group" aria-label="长期状态管道示意图：Rollout 到 SQLite 到 Memory 的长期状态流转"><style>.fz012{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gr:#4f7233;--grb:#e7eedd;--gra:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;--pu:#54579a;--pub:#e6e7f3;--pue:#a9adcf;--gy:#917f5c;--gyb:#ece4d2;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(168deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));color:var(--ink,#1a1815);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3.2vw,30px);margin:0;box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 8px 26px -18px rgba(26,24,21,.4);max-width:100%;box-sizing:border-box;overflow:hidden}.fz012 *{box-sizing:border-box}.fz012 .hd{text-align:center;margin-bottom:clamp(14px,2.6vw,22px)}.fz012 .ttl{font-weight:700;font-size:clamp(17px,3vw,25px);letter-spacing:.5px;line-height:1.25;color:var(--ink,#1a1815)}.fz012 .ttl b{color:var(--am,#9a6516)}.fz012 .ttl i{font-style:normal;color:var(--gr,#4f7233)}.fz012 .ttl u{text-decoration:none;color:var(--cy,#3f6d79)}.fz012 .sub{margin-top:6px;font-size:clamp(11.5px,2vw,14px);color:var(--muted,#6a6155);line-height:1.5}.fz012 .row{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto .82fr;align-items:stretch;gap:clamp(4px,1vw,9px)}.fz012 .node{border-radius:13px;padding:clamp(9px,1.6vw,14px) clamp(8px,1.4vw,13px);border:1.5px solid var(--hair,rgba(26,24,21,.18));display:flex;flex-direction:column;justify-content:center;gap:5px;min-width:0;position:relative}.fz012 .nt{font-weight:700;font-size:clamp(13px,2.2vw,18px);line-height:1.2;letter-spacing:.3px}.fz012 .nx{font-size:clamp(10px,1.75vw,13px);color:var(--ink-soft,#3c362c);line-height:1.4}.fz012 .nx code{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.92em;background:rgba(26,24,21,.06);padding:1px 4px;border-radius:4px}.fz012 .am{background:var(--amb,#f4e8cc);border-color:var(--ame,#d9b66a)}.fz012 .am .nt{color:var(--am,#9a6516)}.fz012 .gr{background:var(--grb,#e7eedd);border-color:var(--gra,#7c9c54)}.fz012 .gr .nt{color:var(--gr,#4f7233)}.fz012 .pu{background:var(--pub,#e6e7f3);border-color:var(--pue,#a9adcf)}.fz012 .pu .nt{color:var(--pu,#54579a)}.fz012 .gy{background:var(--gyb,#ece4d2);border-color:var(--gy,#917f5c)}.fz012 .gy .nt{color:var(--gy,#917f5c)}.fz012 .rd{background:var(--rdb,#f1ddd6);border-color:var(--rde,#cf9b90)}.fz012 .rd .nt{color:var(--rd,#8f2d20)}.fz012 .ar{display:flex;align-items:center;justify-content:center;position:relative;min-width:24px}.fz012 .ar .ln{position:relative;width:100%;height:3px;border-radius:2px;background:var(--hair,rgba(26,24,21,.18));overflow:hidden}.fz012 .ar .ln::after{content:"";position:absolute;inset:0;width:48%;border-radius:2px;background:linear-gradient(90deg,transparent,var(--muted,#6a6155),transparent);animation:fzflow 3.4s linear infinite}.fz012 .ar .tip{position:absolute;right:-1px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid var(--muted,#6a6155)}.fz012 .ar.d2::after{animation-delay:1.1s}.fz012 .ar.d3::after{animation-delay:2.2s}.fz012 .mid{margin-top:clamp(12px,2vw,18px);display:grid;grid-template-columns:1fr 1fr;gap:clamp(10px,2.4vw,26px);position:relative}.fz012 .feed{position:relative;height:clamp(20px,3vw,28px);margin-top:6px}.fz012 .feed .seg{position:absolute;background:var(--hair,rgba(26,24,21,.18))}.fz012 .feed .vL{left:74%;top:0;width:3px;height:50%;border-radius:2px}.fz012 .feed .hL{left:38.5%;top:calc(50% - 1.5px);width:35.5%;height:3px;border-radius:2px;overflow:hidden}.fz012 .feed .hL::after{content:"";position:absolute;inset:0;width:46%;background:linear-gradient(90deg,transparent,var(--gr,#4f7233),transparent);animation:fzflowR 3.6s linear infinite}.fz012 .feed .vD{left:calc(38.5% - 1.5px);top:50%;width:3px;height:50%;border-radius:2px}.fz012 .feed .vD::after{content:"";position:absolute;left:-4px;bottom:-1px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--gr,#4f7233)}.fz012 .between{display:flex;align-items:center;justify-content:center}.fz012 .between .ar{width:clamp(20px,4vw,40px)}.fz012 .between .ln::after{background:linear-gradient(90deg,transparent,var(--gy,#917f5c),transparent)}.fz012 .between .tip{border-left-color:var(--gy,#917f5c)}.fz012 .feedB{position:relative;height:clamp(20px,3vw,30px);margin:8px 0 4px}.fz012 .feedB .vL{position:absolute;left:74%;top:0;width:3px;height:50%;background:var(--hair,rgba(26,24,21,.18));border-radius:2px}.fz012 .feedB .hL{position:absolute;left:50%;top:calc(50% - 1.5px);width:24%;height:3px;background:var(--hair,rgba(26,24,21,.18));border-radius:2px;overflow:hidden}.fz012 .feedB .hL::after{content:"";position:absolute;inset:0;width:50%;background:linear-gradient(90deg,transparent,var(--rd,#8f2d20),transparent);animation:fzflowL 3.8s linear infinite}.fz012 .feedB .vD{position:absolute;left:calc(50% - 1.5px);top:50%;width:3px;height:50%;background:var(--hair,rgba(26,24,21,.18));border-radius:2px}.fz012 .feedB .vD::after{content:"";position:absolute;left:-4px;bottom:-1px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--rd,#8f2d20)}.fz012 .bot{border-radius:14px;padding:clamp(11px,2vw,17px) clamp(13px,2.4vw,22px);text-align:center;background:var(--rdb,#f1ddd6);border:1.5px solid var(--rde,#cf9b90);animation:fzpulse 8s ease-in-out infinite}.fz012 .bot .nt{color:var(--rd,#8f2d20);font-size:clamp(14px,2.4vw,19px);font-weight:700;margin-bottom:5px}.fz012 .bot .nx{font-size:clamp(11px,1.95vw,14px);color:var(--ink-soft,#3c362c);line-height:1.5;max-width:46ch;margin:0 auto}.fz012 .ph{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.85em;letter-spacing:.4px;opacity:.8}.fz012 .midsep{display:none;text-align:center;font-size:18px;line-height:1;margin:3px 0}@keyframes fzflow{0%{transform:translateX(-120%)}100%{transform:translateX(230%)}}@keyframes fzflowR{0%{transform:translateX(-120%)}100%{transform:translateX(230%)}}@keyframes fzflowL{0%{transform:translateX(230%)}100%{transform:translateX(-120%)}}@keyframes fzpulse{0%,100%{box-shadow:0 0 0 0 rgba(143,45,32,0)}50%{box-shadow:0 0 0 5px rgba(143,45,32,.07)}}.fz012[data-reveal] .node,.fz012[data-reveal] .bot{transition:opacity .6s ease,transform .6s ease}@media (max-width:560px){.fz012 .row{grid-template-columns:1fr;gap:8px}.fz012 .row .ar{min-height:18px;width:60%;margin:0 auto}.fz012 .row .ar .ln{height:3px}.fz012 .row .ar .tip{right:50%;top:auto;bottom:-5px;transform:translateX(50%) rotate(90deg)}.fz012 .mid{grid-template-columns:1fr;gap:9px}.fz012 .feed,.fz012 .between,.fz012 .feedB{display:none}.fz012 .midsep{display:block}.fz012 .midsep.sgr{color:var(--gr,#4f7233)}.fz012 .midsep.sgy{color:var(--gy,#917f5c)}.fz012 .midsep.srd{color:var(--rd,#8f2d20)}}@media (prefers-reduced-motion:reduce){.fz012 *{animation:none!important}.fz012 .ar .ln::after,.fz012 .feed .hL::after,.fz012 .feedB .hL::after{animation:none;transform:none;width:100%;opacity:.55}}</style><div class="hd"><div class="ttl">长期状态管道：<b>Rollout</b> → <i>SQLite</i> → <u>Memory</u></div><div class="sub">先记住发生过什么，再整理成状态，最后提炼成未来还能继续用的记忆</div></div><div class="row"><div class="node am"><div class="nt">Turn / Item</div><div class="nx">用户消息、tool call、输出事件</div></div><div class="ar"><div class="ln"></div><div class="tip"></div></div><div class="node am"><div class="nt">Rollout</div><div class="nx">原始 <code>JSONL</code> 事件流落盘</div></div><div class="ar d2"><div class="ln"></div><div class="tip"></div></div><div class="node gr"><div class="nt">SQLite State</div><div class="nx">线程、日志、作业、元数据索引</div></div><div class="ar d3"><div class="ln"></div><div class="tip"></div></div><div class="node pu"><div class="nt">查询</div><div class="nx">列表 / 搜索 / 恢复</div></div></div><div class="feed" aria-hidden="true"><div class="seg vL"></div><div class="seg hL"></div><div class="seg vD"></div></div><div class="midsep sgr" aria-hidden="true">↓</div><div class="mid"><div class="node gy"><div class="nt">Memory <span class="ph">Phase 1</span></div><div class="nx">从近期 rollout 中抽取<br><code>raw_memory</code> 和 <code>rollout_summary</code></div></div><div class="between" aria-hidden="true"><div class="ar"><div class="ln"></div><div class="tip"></div></div></div><div class="midsep sgy" aria-hidden="true">↓</div><div class="node gy"><div class="nt">Memory <span class="ph">Phase 2</span></div><div class="nx">合并高价值 stage-1 outputs<br>刷新本地 memory artifacts</div></div></div><div class="feedB" aria-hidden="true"><div class="vL"></div><div class="hL"></div><div class="vD"></div></div><div class="midsep srd" aria-hidden="true">↓</div><div class="bot"><div class="nt">回到下一轮上下文</div><div class="nx">历史不再只是原始日志，而会被压缩成更适合再次注入模型的长期记忆</div></div></figure>

### 6.1 Rollout：先把过程记下来

`rollout` 这层你可以理解成事件流落盘。

它记录的不是一句最终答案，而是过程里的很多 item：

- 用户消息
- agent message
- tool call
- command output
- file change
- completion event

这很重要，因为对 agent 来说，过程本身就是价值的一部分。

### 6.2 这三层到底是“当前 session 的”，还是“长期持久的”？

这个问题非常容易混淆，我单独说一下。

短答案是：

- `rollout` 不是只活在当前一轮对话里的临时记忆，而是**以 thread / session 为单位持久化的原始记录**
- `SQLite state` 不是某个 session 自己的私有记忆，而是**整个 Codex 本地运行时跨 session 的结构化状态库**
- `memory pipeline` 更进一步，它不是只服务当前 session，而是**从多个历史 session 中提炼长期记忆，用来服务未来 session**

如果想用一句更容易记的话来区分：

- `rollout`：这个 session 里到底发生了什么
- `SQLite state`：整个系统如何高效管理很多 session 的状态
- `memory pipeline`：从很多 session 中抽出未来还值得继续记住的东西

所以它们三者都不是“只在当前 turn 里活一下”的临时状态，但持久化范围不同：

- `rollout` 更贴近单个 session
- `SQLite state` 更贴近全局状态管理
- `memory pipeline` 更贴近跨 session 的长期记忆

### 6.3 SQLite State：再把过程整理成可查询状态

仅有原始 rollout 还不够，因为日志虽然完整，但不适合直接做各种状态查询。

这时 `state` 层就出现了。

`codex-rs/state/src/lib.rs` 开头非常直接：

```rust
//! SQLite-backed state for rollout metadata. // 这句模块文档直接说明：这里存的是从 rollout 中抽出来的结构化状态

mod extract; // 负责从 rollout item 中抽取结构化字段
pub mod log_db; // 暴露日志数据库相关能力
mod migrations; // 管理 SQLite 表结构的迁移
mod model; // 定义线程、日志、作业等数据模型
mod runtime; // 提供真正对外使用的状态运行时封装

pub use runtime::StateRuntime; // 重新导出状态运行时，给外部模块作为主入口
pub use model::ThreadMetadata; // 重新导出线程元数据结构，方便其他模块直接引用
```

对应源码：

- [`codex-rs/state/src/lib.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/state/src/lib.rs)

这说明 `state` 层的职责很清晰：

- 从 rollout 里抽取结构化信息
- 写进 SQLite
- 提供线程、日志、记忆、作业等查询能力

如果只用一句话概括：

- rollout 像原始日志
- SQLite state 像索引和状态视图

### 6.4 Memory Pipeline：再从“发生过什么”里提炼“未来还要记什么”

`memory` 这层更进一步。

根据 `core/src/memories/README.md`，它大致分两步：

```text
Phase 1:
- 从近期 rollout 中挑选可用线程
- 抽取结构化 raw_memory 和 rollout_summary
- 写回 state DB

Phase 2:
- 选出最有价值的 stage-1 outputs
- 刷新本地 memory artifacts
- 再让 consolidation agent 做全局整理
```

对应文档：

- [`codex-rs/core/src/memories/README.md`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/memories/README.md)

这背后的本质问题是：

- 历史越来越长
- 上下文窗口永远有限

所以你不能只是“都塞给模型”，而是得分层处理：

1. 原始过程先落盘
1. 再抽成结构化状态
1. 再提炼成更稠密、对未来更有用的记忆

### 6.5 这也是为什么 Codex 不像一个临时脚本

一旦有了 rollout、SQLite、memory pipeline，Codex 的味道就变了。

它不再像一个“临时运行一下就结束”的小工具，而更像一个会逐步积累状态的本地协作系统。

你可以把它理解成：

- 没有 rollout，系统就没法复盘
- 没有 state，系统就没法高效管理历史
- 没有 memory，系统就没法把过去经验变成未来上下文

### 6.6 一句话总结这一章

> Agent 不是一次性函数调用，而是长期运行的状态机；既然是状态机，就必须有日志层、状态层和记忆层。

## 7. 这个架构的主要 tradeoff

看到这里，`Codex` 的设计看起来已经很完整了。

但越是完整的系统，越要诚实地看 tradeoff。

<figure class="fz013" data-reveal role="group" aria-label="这套架构的收益与代价：左侧四条收益与右侧四条代价的对比，以及一句结论"><style>.fz013{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--r:#8f2d20;--rb:#f1ddd6;--re:#cf9b90;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(180deg,var(--paper-soft,#faf6ec),var(--soft2,#f7f1e4));color:var(--ink,#1a1815);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;padding:22px 20px 24px;margin:0;box-sizing:border-box;max-width:100%}.fz013 *{box-sizing:border-box}.fz013 .hd{text-align:center;margin-bottom:18px}.fz013 .ttl{font-size:clamp(20px,4.4vw,30px);font-weight:700;letter-spacing:.5px;color:var(--ink,#1a1815)}.fz013 .sub{font-size:clamp(12px,2.5vw,15px);color:var(--muted,#6a6155);margin-top:6px}.fz013 .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fz013 .col{border-radius:16px;padding:14px 13px 16px;position:relative;overflow:hidden}.fz013 .gain{background:var(--gb,#e7eedd);border:1.5px solid var(--gl,#7c9c54)}.fz013 .cost{background:var(--rb,#f1ddd6);border:1.5px solid var(--re,#cf9b90)}.fz013 .chd{font-size:clamp(16px,3vw,21px);font-weight:700;text-align:center;margin-bottom:12px;letter-spacing:2px}.fz013 .gain .chd{color:var(--g,#4f7233)}.fz013 .cost .chd{color:var(--r,#8f2d20)}.fz013 .chd b{display:inline-block;position:relative;padding-bottom:5px}.fz013 .chd b::after{content:"";position:absolute;left:50%;bottom:0;width:32px;height:2px;transform:translateX(-50%);transform-origin:center;animation:fzln 8s ease-in-out infinite}.fz013 .gain .chd b::after{background:var(--gl,#7c9c54)}.fz013 .cost .chd b::after{background:var(--re,#cf9b90)}.fz013 .item{background:var(--paper-soft,#faf6ec);border-radius:12px;padding:11px 12px;margin-bottom:10px;font-size:clamp(12px,2.6vw,15px);line-height:1.5;color:var(--ink-soft,#3c362c);display:flex;align-items:flex-start;gap:9px;opacity:0;animation:fzin .7s ease forwards}.fz013 .item:last-child{margin-bottom:0}.fz013 .gain .item{border:1px solid #cbe0b0}.fz013 .cost .item{border:1px solid #e8c4ba}.fz013 .item .dot{flex:0 0 auto;width:9px;height:9px;border-radius:50%;margin-top:5px;position:relative}.fz013 .gain .item .dot{background:var(--g,#4f7233)}.fz013 .cost .item .dot{background:var(--r,#8f2d20)}.fz013 .item .dot::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid currentColor;opacity:0;animation:fzpulse 7s ease-in-out infinite}.fz013 .gain .item .dot::after{color:var(--gl,#7c9c54)}.fz013 .cost .item .dot::after{color:var(--re,#cf9b90)}.fz013 .gain .item:nth-child(2){animation-delay:.15s}.fz013 .gain .item:nth-child(2) .dot::after{animation-delay:0s}.fz013 .gain .item:nth-child(3){animation-delay:.35s}.fz013 .gain .item:nth-child(3) .dot::after{animation-delay:.5s}.fz013 .gain .item:nth-child(4){animation-delay:.55s}.fz013 .gain .item:nth-child(4) .dot::after{animation-delay:1s}.fz013 .gain .item:nth-child(5){animation-delay:.75s}.fz013 .gain .item:nth-child(5) .dot::after{animation-delay:1.5s}.fz013 .cost .item:nth-child(2){animation-delay:.25s}.fz013 .cost .item:nth-child(2) .dot::after{animation-delay:.25s}.fz013 .cost .item:nth-child(3){animation-delay:.45s}.fz013 .cost .item:nth-child(3) .dot::after{animation-delay:.75s}.fz013 .cost .item:nth-child(4){animation-delay:.65s}.fz013 .cost .item:nth-child(4) .dot::after{animation-delay:1.25s}.fz013 .cost .item:nth-child(5){animation-delay:.85s}.fz013 .cost .item:nth-child(5) .dot::after{animation-delay:1.75s}.fz013 .vs{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:12px;font-weight:700;color:var(--muted,#6a6155);background:var(--paper-deep,#ece5d5);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;animation:fzbob 9s ease-in-out infinite}.fz013 .colwrap{position:relative}.fz013 .concl{margin-top:18px;background:var(--amb,#f4e8cc);border:1.5px solid var(--ame,#d9b66a);border-radius:13px;padding:13px 15px;text-align:center;font-size:clamp(12px,2.7vw,15px);line-height:1.55;color:var(--am,#9a6516);position:relative;overflow:hidden}.fz013 .concl b{color:var(--ink,#1a1815);font-weight:700}.fz013 .concl::before{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(217,182,106,.28),transparent);animation:fzsweep 9s ease-in-out infinite}@keyframes fzin{to{opacity:1}}@keyframes fzpulse{0%,55%,100%{opacity:0;transform:scale(.7)}18%{opacity:.7;transform:scale(1)}40%{opacity:0;transform:scale(1.25)}}@keyframes fzln{0%,100%{transform:translateX(-50%) scaleX(1)}50%{transform:translateX(-50%) scaleX(2.1)}}@keyframes fzbob{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-58%) scale(1.07)}}@keyframes fzsweep{0%{left:-40%}55%,100%{left:120%}}@media(max-width:560px){.fz013 .cols{grid-template-columns:1fr;gap:38px}.fz013 .vs{top:auto;left:50%;bottom:calc(50% - 19px);transform:translate(-50%,50%)}@keyframes fzbob{0%,100%{transform:translate(-50%,50%) scale(1)}50%{transform:translate(-50%,42%) scale(1.07)}}}@media(prefers-reduced-motion:reduce){.fz013 .item{opacity:1;animation:none}.fz013 .chd b::after,.fz013 .item .dot::after,.fz013 .vs,.fz013 .concl::before{animation:none}.fz013 .item .dot::after{opacity:0}.fz013 .concl::before{display:none}}</style><div class="hd"><div class="ttl">这套架构的收益与代价</div><div class="sub">越像产品级 Agent，系统复杂度就越不可能保持轻盈</div></div><div class="colwrap"><div class="cols"><div class="col gain"><div class="chd"><b>收益</b></div><div class="item"><span class="dot"></span><span>贴着本地环境工作，真实可执行</span></div><div class="item"><span class="dot"></span><span>多前端共享一套 runtime，平台化更强</span></div><div class="item"><span class="dot"></span><span>Harness 更强，副作用更可控</span></div><div class="item"><span class="dot"></span><span>状态更完整，支持恢复、搜索、长期协作</span></div></div><div class="col cost"><div class="chd"><b>代价</b></div><div class="item"><span class="dot"></span><span>跨平台执行与沙箱实现非常复杂</span></div><div class="item"><span class="dot"></span><span>协议层要长期维护，兼容成本高</span></div><div class="item"><span class="dot"></span><span>状态越多，一致性和调试越难</span></div><div class="item"><span class="dot"></span><span>审批和安全边界会拉长链路、影响流畅度</span></div></div></div><div class="vs">VS</div></div><div class="concl">结论：Codex 的难点不是“把模型接上工具”，而是<b>“把工具接进产品级运行时”</b></div></figure>

### 7.1 贴近本地，意味着必须拥抱操作系统复杂性

本地 Agent 最大的好处是：

- 真能贴着你的环境干活

但代价也很明显：

- macOS、Linux、Windows 的执行隔离完全不是一回事
- 路径、shell、权限、sandbox 细节各平台差异巨大
- 一套跨平台 harness 很难写得既统一又不失真

所以，本地执行能力越强，跨平台复杂度就越高。

### 7.2 UI 解耦带来了平台化收益，也带来了协议维护成本

`App Server` 让 TUI、IDE、桌面端都能复用同一套核心能力，这是很大的收益。

但成本是：

- 协议要长期维护
- streaming 语义要稳定
- 客户端和服务端要做更多兼容
- 出问题时排查链路更长

所以 UI 解耦从来不是“没有代价的优雅”。

### 7.3 状态层越强，一致性问题越真实

一旦同时存在：

- rollout
- SQLite state
- memory pipeline
- UI 事件流
- thread fork / resume

系统就不得不面对一致性问题：

- 哪一层是事实来源
- 异步任务失败怎么办
- history 和 memory 不一致怎么办
- 中断执行后如何恢复

这些问题在聊天产品里不明显，但在 agent runtime 里会越来越关键。

### 7.4 Harness 越强，用户体验就越要在安全和流畅之间找平衡

强 harness 的好处是：

- 更安全
- 更可控
- 更可审计

但它也会带来：

- 审批弹窗更多
- 权限模型更复杂
- 运行链路更长
- 出错分支更多

所以 Codex 这种系统，永远在做一件事：

**在自动化体验和执行安全之间找一个用户能接受的平衡点。**

### 7.5 这也是为什么“做成产品”比“做成 demo”难很多

如果只是做 demo：

- 有个 shell tool
- 有个 file edit
- 有个 prompt

其实已经能跑出很唬人的效果。

但一旦真要做成产品，你就必须解决：

- 权限
- 审批
- 沙箱
- 状态
- 回放
- 恢复
- 跨前端一致性
- 扩展性

这就是 `Codex` 真正有工程含量的地方。

## 8. 写在最后：怎么评价 Codex 这套设计

我觉得看完 `openai/codex` 之后，最值得记住的不是某个具体子模块，而是下面这个整体判断。

<figure class="fz014" data-reveal role="group" aria-label="同心层级图：模型被 Harness 约束，再被本地工作环境包裹，体现 Codex 是被 Harness 约束的本地执行系统"><style>.fz014{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--pu:#54579a;--pub:#e6e7f3;--pue:#a9adcf;margin:0;padding:1.4rem 1.1rem 1.5rem;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-sizing:border-box;overflow:hidden}.fz014 *{box-sizing:border-box}.fz014 .hd{text-align:center;margin-bottom:1.2rem}.fz014 .ttl{font-size:1.18rem;font-weight:700;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz014 .sub{margin-top:.45rem;font-size:.82rem;line-height:1.55;color:var(--muted,#6a6155)}.fz014 .sub b{color:var(--ink-soft,#3c362c);font-weight:600}.fz014 .stage{position:relative;width:100%;max-width:420px;aspect-ratio:1/1;margin:0 auto;display:flex;align-items:center;justify-content:center}.fz014 .ring{position:absolute;border-radius:50%;display:flex;align-items:flex-start;justify-content:center}.fz014 .r-out{inset:0;background:var(--gb,#e7eedd);border:3px solid var(--gl,#7c9c54);animation:fzPulO 9s ease-in-out infinite}.fz014 .r-mid{inset:16%;background:var(--amb,#f4e8cc);border:3px solid var(--ame,#d9b66a);animation:fzPulM 9s ease-in-out infinite}.fz014 .r-in{inset:34%;background:var(--pub,#e6e7f3);border:2px solid var(--pue,#a9adcf);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;animation:fzPulI 9s ease-in-out infinite}.fz014 .lab{padding-top:.55rem;text-align:center;width:90%}.fz014 .lab .k{font-size:.86rem;font-weight:700;line-height:1.2}.fz014 .lab .d{display:block;margin-top:.18rem;font-size:.66rem;line-height:1.4;color:var(--ink-soft,#3c362c);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz014 .r-out .lab .k{color:var(--g,#4f7233)}.fz014 .r-mid .lab .k{color:var(--am,#9a6516)}.fz014 .r-in .k{font-size:.92rem;font-weight:700;color:var(--pu,#54579a);line-height:1.2}.fz014 .r-in .d{margin-top:.22rem;font-size:.66rem;color:var(--ink-soft,#3c362c);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);line-height:1.35}.fz014 .core{position:absolute;inset:34%;border-radius:50%;border:2px solid var(--pue,#a9adcf);box-shadow:0 0 0 0 rgba(84,87,154,.30);animation:fzHalo 6s ease-in-out infinite;pointer-events:none}.fz014 .dot{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--cy,#3f6d79);top:50%;left:50%;margin:-3.5px;animation:fzOrb 8s linear infinite}.fz014 .dot.b{animation-delay:-4s;background:var(--am,#9a6516)}.fz014 .foot{margin-top:1.25rem;padding:.7rem .9rem;border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:10px;background:var(--paper-deep,#ece5d5);text-align:center;font-size:.82rem;line-height:1.55;color:var(--ink-soft,#3c362c);position:relative;overflow:hidden}.fz014 .foot:before{content:"";position:absolute;left:-30%;top:0;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(124,156,84,.22),transparent);animation:fzSwipe 9s ease-in-out infinite}.fz014 .foot b{color:var(--g,#4f7233);font-weight:700}@keyframes fzPulO{0%,100%{transform:scale(1)}50%{transform:scale(1.012)}}@keyframes fzPulM{0%,100%{transform:scale(1)}50%{transform:scale(.985)}}@keyframes fzPulI{0%,100%{transform:scale(1)}50%{transform:scale(.965)}}@keyframes fzHalo{0%,100%{box-shadow:0 0 0 0 rgba(84,87,154,.28)}50%{box-shadow:0 0 0 9px rgba(84,87,154,0)}}@keyframes fzOrb{from{transform:rotate(0deg) translateX(122px) rotate(0deg)}to{transform:rotate(360deg) translateX(122px) rotate(-360deg)}}@keyframes fzSwipe{0%{left:-30%}55%,100%{left:130%}}@media (max-width:560px){.fz014 .lab .d{font-size:.58rem}.fz014 .r-in .d{font-size:.58rem}.fz014 .lab .k{font-size:.78rem}.fz014 .stage{max-width:300px}@keyframes fzOrb{from{transform:rotate(0deg) translateX(88px) rotate(0deg)}to{transform:rotate(360deg) translateX(88px) rotate(-360deg)}}}@media (prefers-reduced-motion:reduce){.fz014 .r-out,.fz014 .r-mid,.fz014 .r-in,.fz014 .core,.fz014 .dot,.fz014 .foot:before{animation:none!important}.fz014 .r-out,.fz014 .r-mid,.fz014 .r-in{transform:none}.fz014 .core{box-shadow:0 0 0 0 rgba(84,87,154,0)}.fz014 .foot:before{display:none}}</style><div class="hd"><div class="ttl">最后一张图：怎么理解 Codex</div><div class="sub">最好的视角不是<b>“终端里的聊天”</b>，而是<b>“被 Harness 约束的本地执行系统”</b></div></div><div class="stage"><div class="ring r-out"><div class="lab"><span class="k">本地工作环境</span><span class="d">代码仓库 · 终端 · git · 文件系统 · IDE · 插件和外部能力</span></div></div><div class="ring r-mid"><div class="lab"><span class="k">Harness</span><span class="d">审批 · 沙箱 · 策略 · 状态 · 恢复</span></div></div><div class="ring r-in"><span class="k">模型</span><span class="d">理解 · 规划 · 生成</span></div><div class="core"></div><div class="dot"></div><div class="dot b"></div></div><div class="foot">一句话：Codex 的核心不是“会调工具”，而是<b>“让工具调用在本地环境里依然可控”</b></div></figure>

### 8.1 它的核心不在“会不会调工具”

今天很多 agent 项目看起来都能：

- 读文件
- 跑命令
- 改代码

所以如果只看表面功能，很容易觉得它们差不多。

但 `Codex` 真正拉开差距的地方，不是“工具列表更长”，而是：

**它把工具调用放进了一套受控执行系统里。**

### 8.2 它更像一个本地 Agent Runtime，而不是终端聊天壳

这体现在几乎每一层：

- CLI / TUI 只是入口和界面
- App Server 负责多前端共享能力
- Core 负责会话、turn、tool orchestration、state bridge
- Tools 负责能力暴露和执行收口
- State / Memory 负责长期状态

这不是“把模型包成一个终端程序”，而是“把模型放进一个本地执行平台”。

### 8.3 Harness 是理解 Codex 的最佳视角

如果只用一句话概括全文，我会写成这样：

> `Codex` 的核心价值，不是让模型会调用工具，而是用 harness 把一个会犯随机错误的概率模型，包装成一个副作用可控、风险可管理、状态可积累的本地 Agent。

### 8.4 如果只记住 4 句话

我建议记这 4 句：

1. `Codex` 不是普通聊天，而是本地执行闭环
1. 一旦有副作用，Agent 设计重心就从 prompt 转向 harness
1. `CLI / TUI / App Server / Core / Tools / State` 这套分层，本质上是在分离“交互、执行、扩展、状态”
1. 真正的壁垒不是工具数量，而是受控执行、长期状态和跨前端一致性

这也是为什么我会觉得，`openai/codex` 最值得看的，不是某个炫技功能，而是它把 Agent 工程化这件事做得非常彻底。
