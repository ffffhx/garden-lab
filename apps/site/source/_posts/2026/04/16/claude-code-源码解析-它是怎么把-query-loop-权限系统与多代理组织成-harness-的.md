---
title: "Claude Code 源码解析：它是怎么把 Query Loop、权限系统与多代理组织成 Harness 的"
date: 2026-04-16 19:40:00
categories:
  - 技术
tags:
  - AI
  - Agent
  - LLM
  - Claude Code
  - Codex
  - TypeScript
  - Rust
  - Harness Engineering
  - 源码解析
excerpt: "从术语预备讲起，拆解 Claude Code 的 query loop、工具系统、权限判定、上下文治理与 subagent 机制，并与 openai/codex 的 thread/turn/item、AGENTS.md、exec policy 与 app-server 控制面做对照。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

最近我集中看了两个仓库：

- Claude Code 的逆向还原版：[Syfyivan/claude-code](https://github.com/Syfyivan/claude-code)
- Codex 的官方开源实现：[openai/codex](https://github.com/openai/codex)

如果只按功能表去看，很容易把注意力放到这些标签上：

- 会读代码
- 会改文件
- 会跑命令
- 会调工具
- 会分出多个 agent

但真正值得看的，不是功能数，而是这两个系统各自如何把一个会写代码的大模型，关进一套可持续运行的本地执行系统里。

这篇文章我会沿着四条主线拆：

1. `query loop` 是怎么推进一轮任务的
1. 工具和权限是怎么被 runtime 收束的
1. `CLAUDE.md`、git snapshot 和 compact 是怎么变成上下文预算制度的
1. Claude Code 与 Codex 为什么会走向两种很不一样的架构重心

先说明一个边界：

**`Syfyivan/claude-code` 不是 Anthropic 官方开源仓库，而是 reverse-engineered / decompiled 的还原项目。**

所以本文分析的不是“官方源码逐行真相”，而是：

**一个恢复出来的 Claude Code 架构骨架，到底暴露了怎样的 runtime 设计。**

另外，下面出现的代码块都遵循同一个规则：

- 只保留表达意思的主体逻辑
- 不是完整可运行代码
- 每一行都加注释，目的是让你直接看懂设计意图

## 0. 阅读预备：先把几个词说人话

<figure class="fz017" data-reveal role="group" aria-label="术语预备示意图：Model 经 Agent Runtime 到 Harness 的分层，以及 Tool Pool、Compact、Subagent、World 四个概念与真实世界的关系"><style>.fz017{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--soft2:#f7f1e4;--grn:#4f7233;--grnb:#e7eedd;--grnl:#7c9c54;--cyn:#3f6d79;--cynb:#dcebed;--cyne:#8fbcc4;--amb:#9a6516;--ambb:#f4e8cc;--ambe:#d9b66a;--red:#8f2d20;--redb:#f1ddd6;--rede:#cf9b90;--pur:#54579a;--purb:#e6e7f3;--pure:#a9adcf;--gry:#917f5c;--gryb:#ece4d2;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(180deg,var(--paper-soft),var(--soft2));border:1px solid var(--hair);border-radius:18px;padding:clamp(16px,3.2vw,30px);margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz017 *{box-sizing:border-box}.fz017 .hd{margin-bottom:clamp(14px,2.6vw,24px)}.fz017 .t1{font-weight:700;font-size:clamp(19px,3.1vw,30px);letter-spacing:.01em;line-height:1.25}.fz017 .t2{font-size:clamp(12px,1.9vw,16px);color:var(--muted);margin-top:6px;line-height:1.4}.fz017 .top{display:grid;grid-template-columns:1fr auto 1.7fr auto 1fr;align-items:stretch;gap:clamp(4px,1vw,10px);margin-bottom:clamp(14px,2.6vw,22px)}.fz017 .node{border:1.5px solid var(--hair);border-radius:14px;padding:clamp(12px,1.8vw,18px) clamp(10px,1.6vw,16px);display:flex;flex-direction:column;justify-content:center;min-width:0;position:relative;overflow:hidden}.fz017 .node .nt{font-weight:700;font-size:clamp(15px,2.2vw,22px);line-height:1.2}.fz017 .node .nx{font-size:clamp(11px,1.6vw,15px);color:var(--ink-soft);margin-top:7px;line-height:1.45}.fz017 .node .nn{font-size:clamp(10px,1.4vw,13px);margin-top:6px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);color:var(--amb)}.fz017 .n-mod{background:var(--cynb);border-color:var(--cyne)}.fz017 .n-mod .nt{color:var(--cyn)}.fz017 .n-run{background:var(--ambb);border-color:var(--ambe)}.fz017 .n-run .nt{color:var(--amb)}.fz017 .n-har{background:var(--purb);border-color:var(--pure)}.fz017 .n-har .nt{color:var(--pur)}.fz017 .flow{position:relative;flex:0 0 auto;align-self:center;width:clamp(26px,4vw,52px);height:18px}.fz017 .flow::before{content:"";position:absolute;top:50%;left:0;right:9px;height:3px;transform:translateY(-50%);border-radius:3px;background:linear-gradient(90deg,var(--hair),var(--gry),var(--hair));background-size:200% 100%;animation:fz017dash 7s linear infinite}.fz017 .flow::after{content:"";position:absolute;top:50%;right:0;transform:translateY(-50%);width:0;height:0;border-left:9px solid var(--gry);border-top:6px solid transparent;border-bottom:6px solid transparent}.fz017 .pulse{position:absolute;top:0;bottom:0;width:34%;background:linear-gradient(90deg,transparent,rgba(124,156,84,.45),transparent);animation:fz017run 6s ease-in-out infinite}.fz017 .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,1.4vw,14px);margin-bottom:clamp(14px,2.4vw,20px)}.fz017 .cell{border:1.5px solid var(--hair);border-radius:13px;padding:clamp(11px,1.6vw,16px) clamp(9px,1.3vw,13px);min-width:0;animation:fz017rise 7s ease-in-out infinite;animation-delay:var(--d,0s)}.fz017 .cell .ct{font-weight:700;font-size:clamp(14px,1.9vw,19px);line-height:1.2}.fz017 .cell .cx{font-size:clamp(10px,1.4vw,14px);color:var(--ink-soft);margin-top:6px;line-height:1.4}.fz017 .c-tool{background:var(--cynb);border-color:var(--cyne)}.fz017 .c-tool .ct{color:var(--cyn)}.fz017 .c-comp{background:var(--grnb);border-color:var(--grnl)}.fz017 .c-comp .ct{color:var(--grn)}.fz017 .c-sub{background:var(--redb);border-color:var(--rede)}.fz017 .c-sub .ct{color:var(--red)}.fz017 .c-world{background:var(--gryb);border-color:var(--gry)}.fz017 .c-world .ct{color:var(--gry)}.fz017 .sum{border:1.5px solid var(--hair);border-radius:13px;background:var(--soft2);padding:clamp(12px,1.8vw,16px) clamp(14px,2vw,20px);text-align:center;font-size:clamp(12px,1.8vw,16px);line-height:1.5;color:var(--ink-soft)}.fz017 .sum b{color:var(--ink);font-weight:700}.fz017 .sum .k{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-style:normal}@keyframes fz017dash{to{background-position:-200% 0}}@keyframes fz017run{0%,100%{left:-34%}50%{left:100%}}@keyframes fz017rise{0%,100%{transform:translateY(0);box-shadow:0 0 0 rgba(26,24,21,0)}50%{transform:translateY(-4px);box-shadow:0 6px 16px rgba(26,24,21,.07)}}@media(max-width:560px){.fz017 .top{grid-template-columns:1fr;gap:8px}.fz017 .flow{width:18px;height:clamp(22px,6vw,30px);align-self:center;transform:rotate(90deg)}.fz017 .grid{grid-template-columns:repeat(2,1fr)}}@media(prefers-reduced-motion:reduce){.fz017 .flow::before,.fz017 .pulse,.fz017 .cell{animation:none}.fz017 .cell{transform:none}.fz017 .flow::before{background:var(--gry)}}</style><div class="hd"><div class="t1">术语预备：先把几个词放对位置</div><div class="t2">模型、runtime、tool、harness 和真实世界不是一层东西</div></div><div class="top"><div class="node n-mod"><div class="nt">Model</div><div class="nx">理解、规划、生成</div></div><div class="flow" aria-hidden="true"></div><div class="node n-run"><span class="pulse" aria-hidden="true"></span><div class="nt">Agent Runtime</div><div class="nx">接输入、拼上下文、调模型、接工具结果</div><div class="nn">Query loop 在这里持续推进任务</div></div><div class="flow" aria-hidden="true"></div><div class="node n-har"><div class="nt">Harness</div><div class="nx">限定边界与执行规则</div></div></div><div class="grid"><div class="cell c-tool" style="--d:0s"><div class="ct">Tool Pool</div><div class="cx">当前轮真正可见的工具</div></div><div class="cell c-comp" style="--d:.9s"><div class="ct">Compact</div><div class="cx">控制上下文预算</div></div><div class="cell c-sub" style="--d:1.8s"><div class="ct">Subagent</div><div class="cx">继承上下文但重算权限</div></div><div class="cell c-world" style="--d:2.7s"><div class="ct">World</div><div class="cx">文件、命令、网络</div></div></div><div class="sum">一句话：<b>模型负责决策</b>，<b class="k">runtime</b> 负责推进，<b class="k">harness</b> 负责限制模型如何触碰真实世界</div></figure>

在进入正文之前，先把几个容易陌生、但整篇文章反复会用到的词放到正确位置上。

- `Harness`
  - 包在模型外面的控制壳。它不负责“聪明”，它负责“边界”。
- `Agent Runtime`
  - 让模型真正跑起来的运行时，负责接收输入、组织上下文、调模型、执行工具、记录状态。
- `Query Loop`
  - 一轮任务推进的主循环。模型输出如果触发 `tool_use`，系统就执行工具，再把结果喂回模型，直到任务结束。
- `Tool Pool`
  - 当前这一轮真正暴露给模型的工具集合。不是仓库里“所有工具”，而是经过模式和权限过滤后的可见集合。
- `Compact`
  - 对历史消息做摘要、裁剪、折叠，避免上下文无限膨胀。
- `Prompt Cache`
  - 让相同前缀请求复用缓存的机制。Claude Code 在 subagent/fork 设计里明显在主动优化这一点。
- `Subagent`
  - 被主 agent 派生出来的子任务执行体。它可能继承上下文，但不一定继承全部权限。
- `Thread / Turn / Item`
  - 这是 Codex 更强调的三个原语：会话、轮次、事件项。后面对比时会反复提到。

如果把这些词压成一句话：

**模型负责做概率决策，runtime 负责推进循环，harness 负责限制边界。**

## 1. Claude Code 的整体分层

<figure class="fz018" data-reveal role="group" aria-label="Claude Code 的整体分层架构图：从 CLI 到 Query Loop 再到底层工具、权限、上下文与子代理"><style>.fz018{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--ser:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);--gn:#4f7233;--gnb:#e7eedd;--gne:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;--pu:#54579a;--pub:#e6e7f3;--pue:#a9adcf;--gy:#917f5c;--gyb:#ece4d2;margin:0;padding:clamp(14px,3vw,26px);background:linear-gradient(150deg,var(--paper-soft,#faf6ec),var(--soft,#f7f1e4));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;font-family:var(--ser);color:var(--ink,#1a1815);box-sizing:border-box}.fz018 *{box-sizing:border-box}.fz018 .hd{margin-bottom:clamp(12px,2.4vw,20px)}.fz018 .ttl{font-size:clamp(18px,3.4vw,26px);font-weight:700;letter-spacing:.5px;color:var(--ink,#1a1815)}.fz018 .sub{margin-top:6px;font-size:clamp(11px,2vw,14px);color:var(--muted,#6a6155);font-weight:500;line-height:1.5}.fz018 .stack{display:flex;flex-direction:column;align-items:center;gap:0}.fz018 .lyr{position:relative;border-radius:14px;border:1.5px solid var(--hair);padding:clamp(9px,1.8vw,14px) clamp(12px,2.4vw,20px);text-align:center;transition:transform .5s ease}.fz018 .lyr .lt{font-family:var(--mono);font-weight:700;font-size:clamp(13px,2.4vw,18px);letter-spacing:.3px}.fz018 .lyr .ld{margin-top:5px;font-size:clamp(10px,1.9vw,13px);color:var(--ink-soft,#3c362c);line-height:1.45}.fz018 .l1{width:82%;background:var(--cyb);border-color:var(--cye)}.fz018 .l1 .lt{color:var(--cy)}.fz018 .l2{width:90%;background:var(--amb);border-color:var(--ame)}.fz018 .l2 .lt{color:var(--am)}.fz018 .l3{width:100%;background:var(--gnb);border-color:var(--gne);box-shadow:0 0 0 0 rgba(124,156,84,.4);animation:fz018core 8s ease-in-out infinite}.fz018 .l3 .lt{color:var(--gn);font-size:clamp(14px,2.6vw,19px)}.fz018 .l3 .ld{color:var(--gn);font-weight:600;opacity:.9}.fz018 .arr{width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:11px solid var(--muted,#6a6155);margin:5px 0;opacity:.55;animation:fz018arr 4.5s ease-in-out infinite}.fz018 .arr.a2{animation-delay:.5s}.fz018 .arr.a3{animation-delay:1s}.fz018 .flowwrap{position:relative;width:100%;display:flex;justify-content:center}.fz018 .lyr.l1,.fz018 .lyr.l2,.fz018 .lyr.l3{z-index:1}.fz018 .lyr::after{content:"";position:absolute;left:0;right:0;top:0;height:100%;border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.55),transparent 60%);opacity:.45;pointer-events:none}.fz018 .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(7px,1.4vw,12px);width:100%;margin-top:clamp(10px,2vw,16px)}.fz018 .cell{border-radius:12px;border:1.5px solid var(--hair);padding:clamp(8px,1.6vw,13px) clamp(6px,1.4vw,11px);text-align:center;position:relative;overflow:hidden;animation:fz018rise 8s ease-in-out infinite}.fz018 .cell .ct{font-family:var(--mono);font-weight:700;font-size:clamp(11px,2vw,15px);letter-spacing:.2px;line-height:1.2}.fz018 .cell .cd{margin-top:5px;font-size:clamp(9px,1.7vw,12px);color:var(--ink-soft,#3c362c);line-height:1.4}.fz018 .cell::before{content:"";position:absolute;top:-2px;left:50%;width:0;height:0;transform:translateX(-50%);border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid var(--gne);opacity:.5}.fz018 .c1{background:var(--cyb);border-color:var(--cye)}.fz018 .c1 .ct{color:var(--cy)}.fz018 .c2{background:var(--rdb);border-color:var(--rde);animation-delay:.4s}.fz018 .c2 .ct{color:var(--rd)}.fz018 .c3{background:var(--pub);border-color:var(--pue);animation-delay:.8s}.fz018 .c3 .ct{color:var(--pu)}.fz018 .c4{background:var(--amb);border-color:var(--ame);animation-delay:1.2s}.fz018 .c4 .ct{color:var(--am)}@keyframes fz018core{0%,100%{box-shadow:0 0 0 0 rgba(124,156,84,.0);transform:scale(1)}45%{box-shadow:0 0 0 6px rgba(124,156,84,.12);transform:scale(1.012)}}@keyframes fz018arr{0%,100%{opacity:.3;transform:translateY(-2px)}50%{opacity:.75;transform:translateY(2px)}}@keyframes fz018rise{0%,100%{transform:translateY(0);box-shadow:0 1px 0 rgba(26,24,21,.04)}50%{transform:translateY(-3px);box-shadow:0 5px 12px rgba(26,24,21,.08)}}@media(max-width:560px){.fz018 .l1,.fz018 .l2,.fz018 .l3{width:100%}.fz018 .grid{grid-template-columns:repeat(2,1fr)}}@media(prefers-reduced-motion:reduce){.fz018 .l3,.fz018 .arr,.fz018 .cell{animation:none!important}.fz018 .l3{box-shadow:0 0 0 4px rgba(124,156,84,.12);transform:none}.fz018 .arr{opacity:.55}.fz018 .cell{transform:none;box-shadow:0 1px 0 rgba(26,24,21,.05)}}</style><div class="hd"><div class="ttl">Claude Code 的整体分层</div><div class="sub">从 CLI 到 Query Loop，再到底层工具、权限、上下文与子代理</div></div><div class="stack"><div class="flowwrap"><div class="lyr l1"><div class="lt">CLI / main.tsx</div></div></div><div class="arr a1"></div><div class="flowwrap"><div class="lyr l2"><div class="lt">QueryEngine.ts</div></div></div><div class="arr a2"></div><div class="flowwrap"><div class="lyr l3"><div class="lt">query.ts / Query Loop</div><div class="ld">模型调用、tool_use、compact、续跑都在这里汇合</div></div></div><div class="grid"><div class="cell c1"><div class="ct">Tool.ts / tools.ts</div><div class="cd">工具抽象与工具池装配</div></div><div class="cell c2"><div class="ct">permissions/*</div><div class="cd">模式、规则、hook、classifier</div></div><div class="cell c3"><div class="ct">context.ts</div><div class="cd">CLAUDE.md、git、日期、memory</div></div><div class="cell c4"><div class="ct">AgentTool/*</div><div class="cd">subagent、fork、权限收缩</div></div></div></div></figure>

先把 Claude Code 当成一个分层系统来看，会比较容易抓住重点。

大体上可以拆成这几层：

- `src/main.tsx`
  - CLI 入口，负责参数、模式、会话启动
- `src/QueryEngine.ts`
  - 会话级编排器，把工具、prompt、上下文和状态拼成一次 query
- `src/query.ts`
  - 真正的主循环，模型调用、工具跟进、compact 都发生在这里
- `src/Tool.ts` + `src/tools.ts`
  - 工具抽象和工具池装配
- `src/utils/permissions/*`
  - 权限模式、规则匹配、hook、headless 分支
- `src/context.ts` + `src/utils/claudemd.ts`
  - `CLAUDE.md`、git status、当前日期、memory 装配
- `src/tools/AgentTool/*`
  - subagent、fork agent、上下文继承、权限收缩

如果只挑一个最值得看的文件，我不会选 `main.tsx`，而会选：

- `src/query.ts`

原因很直接：Claude Code 的工程性能力最后都要附着到那条主循环上。

也就是说，这个系统的重点不是“终端 UI 长什么样”，而是：

- 一轮任务怎么持续推进
- 工具什么时候进入循环
- 权限什么时候介入
- 上下文什么时候被压缩
- 子代理什么时候被派生

这决定了它更像一个 agent runtime，而不是一个聊天壳。

## 2. 从 CLI 到 Query Loop：一轮请求是怎么起跑的

<figure class="fz019" data-reveal role="group" aria-label="从 CLI 到 Query Loop 的请求链路：User/CLI 经 main.tsx、QueryEngine.ts 备料后进入 query.ts 主循环"><style>.fz019{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gr:#4f7233;--gr-bg:#e7eedd;--gr-br:#7c9c54;--cy:#3f6d79;--cy-bg:#dcebed;--cy-br:#8fbcc4;--am:#9a6516;--am-bg:#f4e8cc;--am-br:#d9b66a;--rd:#8f2d20;--rd-bg:#f1ddd6;--rd-br:#cf9b90;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(160deg,var(--paper-soft),var(--soft));border:1px solid var(--hair);border-radius:18px;padding:clamp(16px,3vw,28px);margin:1.4rem 0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz019 *{box-sizing:border-box}.fz019 .hd{margin-bottom:1.1rem}.fz019 .ttl{font-weight:700;font-size:clamp(1.15rem,3.4vw,1.55rem);letter-spacing:.01em;line-height:1.25}.fz019 .sub{margin-top:.35rem;font-size:clamp(.78rem,2.1vw,.92rem);color:var(--muted);line-height:1.4}.fz019 .flow{display:flex;align-items:stretch;gap:0;flex-wrap:wrap}.fz019 .node{flex:1 1 150px;min-width:128px;border-radius:14px;border:1.5px solid var(--hair);background:var(--soft);padding:.75rem .7rem .85rem;display:flex;flex-direction:column;gap:.3rem;position:relative;opacity:.55;animation:fz019lit 9s ease-in-out infinite}.fz019 .node .nm{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-weight:700;font-size:clamp(.86rem,2.3vw,1.02rem);letter-spacing:-.01em}.fz019 .node .li{font-size:clamp(.72rem,1.9vw,.84rem);color:var(--ink-soft);line-height:1.35}.fz019 .node .tag{position:absolute;top:-.62rem;left:.7rem;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;font-family:var(--font-mono,ui-monospace,monospace);background:var(--paper-soft);padding:0 .4rem;border-radius:5px;color:var(--muted);border:1px solid var(--hair)}.fz019 .n1{background:var(--cy-bg);border-color:var(--cy-br);animation-delay:0s}.fz019 .n1 .nm{color:var(--cy)}.fz019 .n2{background:var(--am-bg);border-color:var(--am-br);animation-delay:2.25s}.fz019 .n2 .nm{color:var(--am)}.fz019 .n3{background:var(--gr-bg);border-color:var(--gr-br);animation-delay:4.5s;box-shadow:0 0 0 0 rgba(79,114,51,0)}.fz019 .n3 .nm{color:var(--gr)}.fz019 .n4{background:var(--rd-bg);border-color:var(--rd-br);animation-delay:6.75s}.fz019 .n4 .nm{color:var(--rd)}.fz019 .star{display:inline-block;font-size:.6rem;color:var(--gr);margin-left:.25rem;vertical-align:.15em;letter-spacing:.05em;font-family:var(--font-mono,monospace)}.fz019 .ar{flex:0 0 38px;align-self:center;height:14px;position:relative;margin:.35rem 0}.fz019 .ar .ln{position:absolute;top:50%;left:0;height:3px;width:100%;transform:translateY(-50%);background:linear-gradient(90deg,var(--hair) 0 45%,transparent 45% 100%);background-size:14px 100%;border-radius:2px;overflow:hidden}.fz019 .ar .ln::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--am),transparent);background-size:40% 100%;background-repeat:no-repeat;animation:fz019flow 9s linear infinite}.fz019 .ar.a1 .ln::after{animation-delay:.4s}.fz019 .ar.a2 .ln::after{animation-delay:2.65s}.fz019 .ar.a3 .ln::after{animation-delay:4.9s}.fz019 .ar b{position:absolute;top:50%;right:-1px;transform:translateY(-50%);width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid var(--muted)}.fz019 .bar{margin-top:1.15rem;border:1px dashed var(--am-br);background:linear-gradient(90deg,var(--paper-soft),var(--am-bg) 50%,var(--paper-soft));border-radius:12px;padding:.7rem .85rem;font-size:clamp(.74rem,2vw,.88rem);line-height:1.5;color:var(--ink-soft);position:relative;overflow:hidden}.fz019 .bar::before{content:"关键词";position:absolute;top:-.6rem;left:.8rem;font-size:.6rem;letter-spacing:.12em;background:var(--paper-soft);padding:0 .4rem;color:var(--am);border:1px solid var(--am-br);border-radius:5px;font-family:var(--font-mono,monospace)}.fz019 .bar b{color:var(--am);font-weight:700;font-style:normal;font-family:var(--font-mono,monospace);font-size:.92em}.fz019 .bar::after{content:"";position:absolute;left:-30%;top:0;bottom:0;width:30%;background:linear-gradient(90deg,transparent,rgba(154,101,22,.1),transparent);animation:fz019sweep 9s ease-in-out infinite}@keyframes fz019lit{0%,18%{opacity:.5}28%,72%{opacity:1}88%,100%{opacity:.62}}@keyframes fz019flow{0%,22%{background-position:-45% 0;opacity:0}30%{opacity:1}55%{background-position:130% 0;opacity:1}62%,100%{opacity:0;background-position:130% 0}}@keyframes fz019sweep{0%{left:-30%}55%{left:115%}100%{left:115%}}.fz019 .n3{animation:fz019lit 9s ease-in-out infinite,fz019breathe 6.5s ease-in-out infinite}@keyframes fz019breathe{0%,100%{box-shadow:0 0 0 0 rgba(79,114,51,0)}50%{box-shadow:0 0 0 4px rgba(124,156,84,.18)}}@media(max-width:560px){.fz019 .flow{flex-direction:column}.fz019 .node{flex:1 1 auto;width:100%}.fz019 .ar{width:100%;height:30px;flex-basis:30px;transform:rotate(90deg)}}@media (prefers-reduced-motion:reduce){.fz019 .node,.fz019 .n3,.fz019 .ar .ln::after,.fz019 .bar::after{animation:none!important}.fz019 .node{opacity:1}.fz019 .ar .ln::after{opacity:0}.fz019 .n3{box-shadow:0 0 0 3px rgba(124,156,84,.2)}}</style><div class="hd"><div class="ttl">从 CLI 到 Query Loop 的请求链路</div><div class="sub">真正关键的不是界面，而是 QueryEngine 如何给主循环备料</div></div><div class="flow"><div class="node n1"><span class="tag">入口</span><span class="nm">User / CLI</span><span class="li">输入任务</span></div><div class="ar a1"><span class="ln"></span><b></b></div><div class="node n2"><span class="tag">壳层</span><span class="nm">main.tsx</span><span class="li">解析参数</span><span class="li">初始化 app state</span></div><div class="ar a2"><span class="ln"></span><b></b></div><div class="node n3"><span class="tag">备料<span class="star">★核心</span></span><span class="nm">QueryEngine.ts</span><span class="li">拼 prompt / context</span><span class="li">包装 canUseTool</span><span class="li">准备 toolUseContext</span></div><div class="ar a3"><span class="ln"></span><b></b></div><div class="node n4"><span class="tag">主循环</span><span class="nm">query.ts</span><span class="li">进入主循环</span></div></div><div class="bar">Claude Code 不是直接把用户输入丢给模型，而是先组装 <b>prompt</b>、<b>context</b>、<b>tools</b>、<b>permissions</b>，再进入 query loop。</div></figure>

从主链路上看，一轮请求大概这样走：

1. `src/main.tsx` 解析参数、初始化 app state
1. `QueryEngine.ts` 组装工具、prompt、上下文和权限回调
1. `query.ts` 进入主循环并调用模型
1. 如果流里出现 `tool_use`，就执行工具并继续下一轮
1. 如果没有 `tool_use`，这轮任务结束

这一段最值得看的，不是 UI 层，而是 `QueryEngine.ts` 怎么给 `query.ts` 备料。

下面是裁剪版骨架：

```ts
const wrappedCanUseTool = async (tool, input, toolUseContext, assistantMessage, toolUseID) => { // 包装原始权限函数
  const result = await canUseTool(tool, input, toolUseContext, assistantMessage, toolUseID) // 先调用真正的权限判断
  if (result.behavior !== 'allow') { // 只要结果不是 allow
    this.permissionDenials.push({ tool_name: tool.name, tool_use_id: toolUseID, tool_input: input }) // 就记录一次权限拒绝事件
  } // 结束拒绝记录分支
  return result // 把权限结果继续传给后面的 query loop
} // wrappedCanUseTool 定义结束

const promptParts = await fetchSystemPromptParts({ tools, mainLoopModel, mcpClients }) // 先取回 system prompt 与上下文部件
const systemPrompt = asSystemPrompt(promptParts.defaultSystemPrompt) // 再把默认 system prompt 组装成最终提示
const userContext = promptParts.userContext // 用户上下文单独保存
const systemContext = promptParts.systemContext // 系统上下文单独保存
yield* query({ messages, systemPrompt, userContext, systemContext, canUseTool: wrappedCanUseTool, toolUseContext }) // 最后才真正进入主循环
```

从这段骨架能看出来，`QueryEngine` 的职责不是“替代主循环”，而是：

- 先把 prompt 拼好
- 先把上下文分层
- 先把权限回调接上
- 再把这些东西一次性交给 `query.ts`

所以它更像一个**会话编排器**，而不是心跳本身。

## 3. 为什么 `query.ts` 才是 Claude Code 的心脏

<figure class="fz020" data-reveal role="group" aria-label="Query Loop 单轮心跳流程图：Prefetch 到 Budget+Compact 到 callModel，向下判定 tool_use 后执行 Execute Tools；没有 tool_use 就 Finish 结束，有 tool_use 就回环到 callModel 进入下一轮"><style>.fz020{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);box-sizing:border-box;width:100%}.fz020 *{box-sizing:border-box}.fz020 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz020 .ttl{font-size:clamp(18px,3.4vw,30px);font-weight:700;letter-spacing:.5px;line-height:1.2}.fz020 .sub{margin-top:6px;font-size:clamp(12px,1.9vw,15px);color:var(--muted,#6a6155);line-height:1.45}.fz020 .flow{display:flex;flex-direction:column;gap:clamp(8px,1.4vw,12px)}.fz020 .row{display:flex;align-items:stretch;gap:clamp(6px,1.2vw,12px);flex-wrap:wrap}.fz020 .node{flex:1 1 0;min-width:0;border-radius:14px;padding:clamp(14px,2vw,22px) clamp(10px,1.6vw,16px);border:1.5px solid;display:flex;align-items:center;justify-content:center;text-align:center;position:relative;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);transition:transform .5s ease,box-shadow .5s ease}.fz020 .node b{font-size:clamp(15px,2.3vw,22px);font-weight:700;letter-spacing:.3px;line-height:1.2}.fz020 .n-blue{background:var(--cyan-bg,#dcebed);border-color:var(--cyan-bd,#8fbcc4);color:var(--cyan,#3f6d79)}.fz020 .n-amber{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-bd,#d9b66a);color:var(--amber,#9a6516);flex:1.6 1 0}.fz020 .n-green{background:var(--green-bg,#e7eedd);border-color:var(--green-lt,#7c9c54);color:var(--green,#4f7233)}.fz020 .n-red{background:var(--red-bg,#f1ddd6);border-color:var(--red-bd,#cf9b90);color:var(--red,#8f2d20)}.fz020 .n-purple{background:var(--purple-bg,#e6e7f3);border-color:var(--purple-bd,#a9adcf);color:var(--purple,#54579a)}.fz020 .n-gray{background:var(--gray-bg,#ece4d2);border-color:var(--hair,rgba(26,24,21,.18));color:var(--muted,#6a6155)}.fz020 .pulse::after{content:"";position:absolute;inset:-3px;border-radius:16px;border:2px solid currentColor;opacity:0;animation:fzPulse 9s ease-in-out infinite}.fz020 .n-blue.pulse::after{animation-delay:0s}.fz020 .n-amber.pulse::after{animation-delay:1.4s}.fz020 .n-green.pulse::after{animation-delay:2.8s}.fz020 .n-red.pulse::after{animation-delay:4.2s}.fz020 .n-purple.pulse::after{animation-delay:5.6s}@keyframes fzPulse{0%,100%{opacity:0;transform:scale(1)}6%{opacity:.5;transform:scale(1)}16%{opacity:0;transform:scale(1.04)}}.fz020 .arrowH{flex:0 0 28px;align-self:center;display:flex;align-items:center;position:relative;color:var(--muted,#6a6155)}.fz020 .arrowH .ln{height:3px;width:100%;background:var(--hair,rgba(26,24,21,.18));position:relative;overflow:hidden;border-radius:2px}.fz020 .arrowH .ln::before{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,currentColor,transparent);animation:fzSlide 7s linear infinite}.fz020 .arrowH .hd2{position:absolute;right:-2px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid var(--muted,#6a6155)}.fz020 .arrowV{display:flex;flex-direction:column;align-items:center;color:var(--muted,#6a6155);height:30px;align-self:center}.fz020 .arrowV .ln{width:3px;flex:1;background:var(--hair,rgba(26,24,21,.18));position:relative;overflow:hidden;border-radius:2px}.fz020 .arrowV .ln::before{content:"";position:absolute;left:0;top:-40%;height:40%;width:100%;background:linear-gradient(180deg,transparent,currentColor,transparent);animation:fzSlideV 7s linear infinite}.fz020 .arrowV .hd2{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--muted,#6a6155)}@keyframes fzSlide{0%{left:-40%}100%{left:120%}}@keyframes fzSlideV{0%{top:-40%}100%{top:120%}}.fz020 .decide{display:flex;flex-direction:column;align-items:center;gap:clamp(8px,1.4vw,12px)}.fz020 .decide .node{max-width:380px;width:100%}.fz020 .branchwrap{display:flex;gap:clamp(10px,2vw,20px);align-items:stretch;flex-wrap:wrap}.fz020 .branch{flex:1 1 240px;min-width:0;display:flex;flex-direction:column;gap:8px}.fz020 .bnote{font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);font-size:clamp(11px,1.7vw,14px);font-weight:600;padding:5px 11px;border-radius:999px;align-self:flex-start;display:inline-flex;align-items:center;gap:6px}.fz020 .bnote.no{background:var(--red-bg,#f1ddd6);color:var(--red,#8f2d20);border:1px solid var(--red-bd,#cf9b90)}.fz020 .bnote.yes{background:var(--green-bg,#e7eedd);color:var(--green,#4f7233);border:1px solid var(--green-lt,#7c9c54)}.fz020 .loopback{display:flex;align-items:center;gap:10px;padding:11px clamp(10px,1.8vw,16px);border:1.5px dashed var(--green-lt,#7c9c54);background:var(--green-bg,#e7eedd);border-radius:12px;color:var(--green,#4f7233);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(12px,1.8vw,15px);overflow:hidden;position:relative;flex:1 1 auto}.fz020 .loopback .ico{flex:0 0 auto;font-size:16px;animation:fzSpin 9s linear infinite;display:inline-block}.fz020 .loopback span.lbtxt{position:relative;z-index:1}.fz020 .loopback .trail{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(124,156,84,.25),transparent);transform:translateX(-100%);animation:fzTrail 7s ease-in-out infinite}@keyframes fzSpin{to{transform:rotate(360deg)}}@keyframes fzTrail{0%{transform:translateX(-100%)}55%,100%{transform:translateX(100%)}}@media(max-width:560px){.fz020 .row{flex-direction:column}.fz020 .arrowH{flex:0 0 24px;align-self:center;transform:rotate(90deg)}.fz020 .n-amber{flex:1 1 auto;width:100%}}@media (prefers-reduced-motion:reduce){.fz020 .pulse::after{animation:none;opacity:0}.fz020 .arrowH .ln::before,.fz020 .arrowV .ln::before{animation:none;opacity:.7}.fz020 .loopback .ico{animation:none}.fz020 .loopback .trail{animation:none;opacity:0}}</style><div class="hd"><div class="ttl">Query Loop 的单轮心跳</div><div class="sub">工具调用、compact 和模型续跑被统一放在一个循环里</div></div><div class="flow"><div class="row"><div class="node n-blue pulse"><b>Prefetch</b></div><div class="arrowH"><div class="ln"></div><div class="hd2"></div></div><div class="node n-amber pulse"><b>Budget + Compact</b></div><div class="arrowH"><div class="ln"></div><div class="hd2"></div></div><div class="node n-green pulse"><b>callModel</b></div></div><div class="decide"><div class="arrowV"><div class="ln"></div><div class="hd2"></div></div><div class="node n-red pulse"><b>tool_use ?</b></div><div class="arrowV"><div class="ln"></div><div class="hd2"></div></div><div class="node n-purple pulse"><b>Execute Tools</b></div></div><div class="branchwrap"><div class="branch"><div class="bnote no">没有 tool_use 就结束</div><div class="node n-gray"><b>Finish</b></div></div><div class="branch"><div class="bnote yes">有 tool_use 就回到下一轮</div><div class="loopback"><span class="trail"></span><span class="ico">↻</span><span class="lbtxt">Execute Tools → callModel</span></div></div></div></div></figure>

看 `src/query.ts`，最重要的不是某个工具，而是它把整个任务做成了一条可持续推进的循环。

裁剪版骨架如下：

```ts
while (true) { // 只要任务没结束就继续转
  const pendingSkillPrefetch = startSkillDiscoveryPrefetch(null, messages, toolUseContext) // 先把技能发现这类可并行工作藏到后台
  let messagesForQuery = [...getMessagesAfterCompactBoundary(messages)] // 取出当前轮实际要送模型的消息窗口
  messagesForQuery = await applyToolResultBudget(messagesForQuery, toolUseContext.contentReplacementState) // 先限制工具结果体积
  messagesForQuery = snipCompactIfNeeded(messagesForQuery).messages // 再做 snip 级别的历史裁剪
  messagesForQuery = (await deps.microcompact(messagesForQuery, toolUseContext, querySource)).messages // 再做微压缩
  const autoCompact = await deps.autocompact(messagesForQuery, toolUseContext, compactContext, querySource, tracking, 0) // 检查是否要自动压缩
  messagesForQuery = autoCompact.compactionResult ? buildPostCompactMessages(autoCompact.compactionResult) : messagesForQuery // 如果压缩触发就替换成压缩后的窗口
  const fullSystemPrompt = asSystemPrompt(appendSystemContext(systemPrompt, systemContext)) // 把系统上下文接到 system prompt 后面
  const stream = deps.callModel({ messages: prependUserContext(messagesForQuery, userContext), systemPrompt: fullSystemPrompt, tools }) // 正式向模型发起请求
  const toolUseBlocks = await collectToolUses(stream) // 从流式输出里收集本轮 tool_use
  if (toolUseBlocks.length === 0) return { reason: 'completed' } // 没有工具调用就说明这一轮结束了
  const toolResults = await executeTools(toolUseBlocks, canUseTool, toolUseContext) // 有工具调用就执行工具
  messages = appendToolResults(messages, toolResults) // 把工具结果接回历史消息
  await pendingSkillPrefetch // 等后台预取收尾
} // 进入下一轮
```

从这条骨架里，至少能看出三件事。

第一，Claude Code 默认把一次请求看成“一轮持续推进的任务”，而不是“一问一答”。

第二，`compact` 不是外围补丁，而是主循环里的内生步骤。`tool result budget / snip / microcompact / autocompact` 都是在每一轮里显式发生的。

第三，模型真正消费的上下文，不是原始历史，而是 runtime 处理过的、预算受控的窗口。

所以 Claude Code 的核心不是“能调工具”，而是：

**它把工具调用、上下文压缩和模型续跑，统一塞进同一条 query loop 里。**

## 4. 工具系统：工具不是裸函数，而是带治理属性的执行单元

<figure class="fz021" data-reveal role="group" aria-label="工具治理流水线示意图：Deny Rules 过滤、Tool Pool 装配、Model 可见、Tool Runtime 执行"><style>.fz021{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair);border-radius:18px;color:var(--ink,#1a1815);font-family:var(--serif);box-sizing:border-box;max-width:100%;overflow:hidden}.fz021 *{box-sizing:border-box}.fz021 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz021 .ti{font-size:clamp(17px,2.6vw,25px);font-weight:700;letter-spacing:.5px;line-height:1.3;color:var(--ink)}.fz021 .su{margin-top:6px;font-size:clamp(12px,1.6vw,15px);color:var(--muted,#6a6155);font-family:var(--mono);letter-spacing:.3px}.fz021 .flow{display:flex;align-items:stretch;justify-content:center;gap:clamp(4px,1vw,12px);flex-wrap:nowrap}.fz021 .node{flex:1 1 0;min-width:0;border-radius:16px;padding:clamp(10px,1.6vw,16px) clamp(8px,1.2vw,14px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1.5px solid;position:relative;animation:fz021pulse 9s ease-in-out infinite}.fz021 .node b{font-size:clamp(13px,1.9vw,21px);font-weight:700;display:block;letter-spacing:.4px;color:var(--ink)}.fz021 .node small{display:block;margin-top:5px;font-size:clamp(10px,1.4vw,14px);color:var(--ink-soft,#3c362c);line-height:1.5;font-family:var(--mono)}.fz021 .n1{background:var(--azure-bg,#dcebed);border-color:var(--azure-bd,#8fbcc4);animation-delay:0s}.fz021 .n2{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-bd,#d9b66a);animation-delay:.6s}.fz021 .n3{background:var(--green-bg,#e7eedd);border-color:var(--green-lt,#7c9c54);animation-delay:1.2s}.fz021 .n4{flex:1.35 1 0;background:var(--red-bg,#f1ddd6);border-color:var(--red-bd,#cf9b90);animation-delay:1.8s}.fz021 .n4 small{margin-top:7px}.fz021 .arr{flex:0 0 auto;align-self:center;width:clamp(20px,3vw,40px);height:14px;position:relative;display:flex;align-items:center}.fz021 .arr .ln{position:relative;height:3px;width:100%;border-radius:2px;background:linear-gradient(90deg,var(--hair),var(--hair));overflow:hidden}.fz021 .arr .ln::after{content:"";position:absolute;inset:0;width:42%;border-radius:2px;background:linear-gradient(90deg,transparent,var(--muted,#6a6155),transparent);animation:fz021slide 4.5s linear infinite}.fz021 .arr::after{content:"";position:absolute;right:-1px;top:50%;transform:translateY(-50%);border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:8px solid var(--muted,#6a6155)}.fz021 .a2 .ln::after{animation-delay:1s}.fz021 .a3 .ln::after{animation-delay:2s}.fz021 .bar{margin-top:clamp(14px,2.4vw,22px);background:var(--paper-deep,#ece5d5);border:1px solid var(--hair);border-left:4px solid var(--amber,#9a6516);border-radius:12px;padding:clamp(11px,1.8vw,16px) clamp(13px,2vw,20px);font-size:clamp(11px,1.6vw,15px);line-height:1.65;color:var(--ink-soft,#3c362c)}.fz021 .bar b{color:var(--amber,#9a6516);font-weight:700}.fz021 .bar .em{color:var(--red,#8f2d20);font-weight:700;border-bottom:1px solid var(--red-bd,#cf9b90)}@keyframes fz021pulse{0%,100%{box-shadow:0 1px 0 var(--hair),0 0 0 0 transparent;transform:translateY(0)}45%{box-shadow:0 4px 14px rgba(26,24,21,.12),0 0 0 3px rgba(154,101,22,.08);transform:translateY(-3px)}}@keyframes fz021slide{0%{transform:translateX(-120%)}100%{transform:translateX(260%)}}@media(max-width:560px){.fz021 .flow{flex-direction:column;align-items:stretch}.fz021 .node,.fz021 .n4{flex:1 1 auto}.fz021 .arr{width:14px;height:clamp(18px,5vw,28px);align-self:center}.fz021 .arr .ln{width:3px;height:100%;background:var(--hair)}.fz021 .arr .ln::after{width:100%;height:42%;background:linear-gradient(180deg,transparent,var(--muted,#6a6155),transparent);animation:fz021slidev 4.5s linear infinite}.fz021 .arr::after{right:50%;top:auto;bottom:-1px;transform:translateX(50%);border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid var(--muted,#6a6155);border-bottom:0}}@keyframes fz021slidev{0%{transform:translateY(-120%)}100%{transform:translateY(260%)}}@media (prefers-reduced-motion:reduce){.fz021 .node{animation:none;box-shadow:0 1px 0 var(--hair);transform:none}.fz021 .arr .ln::after{animation:none;opacity:.55}}</style><div class="hd"><div class="ti">工具不是裸函数，而是受治理的执行单元</div><div class="su">先过滤、再暴露、再验证、再判权，最后才执行</div></div><div class="flow"><div class="node n1"><b>Deny Rules</b><small>先过滤工具</small></div><div class="arr a1"><span class="ln"></span></div><div class="node n2"><b>Tool Pool</b><small>built-ins<br>+ MCP tools</small></div><div class="arr a2"><span class="ln"></span></div><div class="node n3"><b>Model</b><small>看到当前工具集</small></div><div class="arr a3"><span class="ln"></span></div><div class="node n4"><b>Tool Runtime</b><small>validateInput<br>checkPermissions<br>execute / summarize</small></div></div><div class="bar"><b>重点：</b>工具先经过治理再进入模型视野，Claude Code 更像是在<span class="em">收窄模型可见世界</span>，而不是先暴露一切再拦截。</div></figure>

Claude Code 的工具系统很值得看，因为它明显不是“给模型挂几个函数”那么简单。

先看工具抽象本身：

```ts
type Tool = { // 每个工具都被当成一个完整的治理单元
  name: string // 工具名同时给 runtime 和模型识别
  maxResultSizeChars: number // 工具输出多大以后要改成落盘或摘要
  validateInput?: (input, context) => Promise<ValidationResult> // 先校验输入是否合法
  checkPermissions: (input, context) => Promise<PermissionResult> // 再决定是否需要用户许可
  preparePermissionMatcher?: (input) => Promise<(pattern: string) => boolean> // 为规则匹配预处理可复用 matcher
  prompt: (options) => Promise<string> // 生成暴露给模型看的工具说明
} // Tool 定义结束
```

这说明 Claude Code 对工具的理解是：

- 先有描述
- 再有校验
- 再有权限
- 最后才是执行

再看工具池装配：

```ts
const builtInTools = getTools(permissionContext) // 先拿到当前模式下可用的内置工具
const allowedMcpTools = filterToolsByDenyRules(mcpTools, permissionContext) // deny 规则先把 MCP 工具过滤一遍
const orderedBuiltIns = [...builtInTools].sort(byName) // 内置工具按名字稳定排序
const orderedMcpTools = allowedMcpTools.sort(byName) // MCP 工具也按名字稳定排序
return uniqBy(orderedBuiltIns.concat(orderedMcpTools), 'name') // 最后合并并按名字去重
```

这里最关键的不是排序本身，而是两件事：

- deny 规则会在“工具暴露给模型之前”就先过滤一轮
- 排序是为了 prompt cache 稳定，而不是为了代码好看

也就是说，Claude Code 的工具系统不是执行层小配件，而是：

**先收窄模型可见世界，再决定模型如何规划。**

## 5. 权限系统：它不是一个开关，而是一条分层决策链

<figure class="fz022" data-reveal role="group" aria-label="权限判定链：Claude Code 的分层过滤链，从 Request 经 Rule Match、Tool Check、Hook/Auto 分流到 Allow、Ask、Deny"><style>.fz022{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gn:#4f7233;--gnb:#e7eedd;--gnl:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;--pp:#54579a;--ppb:#e6e7f3;--ppe:#a9adcf;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;padding:clamp(16px,3.4vw,30px);margin:1.2rem 0;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 8px 26px -20px rgba(26,24,21,.4)}.fz022 .hd{margin-bottom:clamp(14px,2.6vw,22px)}.fz022 .t1{font-size:clamp(20px,3.5vw,30px);font-weight:700;letter-spacing:.5px;color:var(--ink,#1a1815)}.fz022 .t2{font-size:clamp(12px,2vw,15px);color:var(--muted,#6a6155);margin-top:5px;line-height:1.5}.fz022 .stage{display:flex;align-items:stretch;gap:clamp(8px,1.6vw,16px);flex-wrap:wrap}.fz022 .chain{flex:1 1 58%;min-width:240px;display:flex;flex-direction:column;gap:clamp(9px,1.5vw,13px);justify-content:center}.fz022 .step{position:relative;display:flex;align-items:center;gap:11px;padding:clamp(10px,1.7vw,15px) clamp(12px,2vw,18px);border-radius:14px;border:1.5px solid;background:var(--paper-deep,#ece5d5);overflow:hidden;animation:fz022pop 9s ease-in-out infinite}.fz022 .step:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:currentColor;opacity:.85}.fz022 .step .num{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:12px;font-weight:700;color:#fff;background:currentColor}.fz022 .step .lab{font-weight:700;font-size:clamp(14px,2.2vw,18px);color:var(--ink,#1a1815);letter-spacing:.3px}.fz022 .step .sub{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:11px;color:var(--muted,#6a6155);margin-left:auto;letter-spacing:.2px}.fz022 .step.s1{color:var(--cy,#3f6d79);border-color:var(--cye,#8fbcc4);background:var(--cyb,#dcebed);animation-delay:0s}.fz022 .step.s2{color:var(--am,#9a6516);border-color:var(--ame,#d9b66a);background:var(--amb,#f4e8cc);animation-delay:.9s}.fz022 .step.s3{color:var(--gn,#4f7233);border-color:var(--gnl,#7c9c54);background:var(--gnb,#e7eedd);animation-delay:1.8s}.fz022 .step.s4{color:var(--rd,#8f2d20);border-color:var(--rde,#cf9b90);background:var(--rdb,#f1ddd6);animation-delay:2.7s}.fz022 .flow{height:14px;margin:-4px 0 -4px 30px;position:relative}.fz022 .flow:after{content:"";position:absolute;left:0;top:50%;width:2px;height:14px;transform:translate(-1px,-7px);background:linear-gradient(var(--hair,rgba(26,24,21,.18)),var(--hair,rgba(26,24,21,.18)))}.fz022 .flow:before{content:"";position:absolute;left:-3px;top:50%;width:8px;height:8px;border-right:2px solid var(--muted,#6a6155);border-bottom:2px solid var(--muted,#6a6155);transform:translate(-2px,-1px) rotate(45deg);animation:fz022down 3.4s ease-in-out infinite}.fz022 .flow.f1:before{animation-delay:.3s}.fz022 .flow.f2:before{animation-delay:1.2s}.fz022 .flow.f3:before{animation-delay:2.1s}.fz022 .outs{flex:1 1 30%;min-width:170px;display:flex;flex-direction:column;justify-content:center;gap:clamp(10px,1.8vw,16px);position:relative;padding-left:clamp(14px,2.4vw,26px)}.fz022 .outs:before{content:"分流";position:absolute;left:0;top:50%;transform:translateY(-50%) rotate(180deg);writing-mode:vertical-rl;font-size:11px;letter-spacing:3px;color:var(--muted,#6a6155);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz022 .out{position:relative;display:flex;align-items:center;gap:9px;padding:clamp(9px,1.5vw,13px) clamp(11px,1.8vw,16px);border-radius:13px;border:1.5px solid;font-weight:700;font-size:clamp(13px,2vw,17px)}.fz022 .out .dot{flex:none;width:11px;height:11px;border-radius:50%;background:currentColor;box-shadow:0 0 0 0 currentColor;animation:fz022pulse 6s ease-in-out infinite}.fz022 .out .ar{position:absolute;left:-13px;top:50%;width:9px;height:9px;border-top:2px solid var(--muted,#6a6155);border-right:2px solid var(--muted,#6a6155);transform:translateY(-50%) rotate(45deg)}.fz022 .out .nm{color:var(--ink,#1a1815)}.fz022 .out.allow{color:var(--gn,#4f7233);border-color:var(--gnl,#7c9c54);background:var(--gnb,#e7eedd)}.fz022 .out.ask{color:var(--am,#9a6516);border-color:var(--ame,#d9b66a);background:var(--amb,#f4e8cc)}.fz022 .out.deny{color:var(--rd,#8f2d20);border-color:var(--rde,#cf9b90);background:var(--rdb,#f1ddd6)}.fz022 .out.allow .dot{animation-delay:0s}.fz022 .out.ask .dot{animation-delay:2s}.fz022 .out.deny .dot{animation-delay:4s}.fz022 .note{margin-top:clamp(14px,2.6vw,22px);display:flex;gap:10px;align-items:flex-start;padding:clamp(11px,1.8vw,15px) clamp(13px,2vw,18px);border-radius:13px;background:var(--ppb,#e6e7f3);border:1px solid var(--ppe,#a9adcf);font-size:clamp(12px,1.9vw,15px);line-height:1.55;color:var(--ink-soft,#3c362c)}.fz022 .note .k{flex:none;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-weight:700;font-size:12px;color:var(--pp,#54579a);padding-top:1px}.fz022 .note b{color:var(--rd,#8f2d20);font-weight:700}.fz022 .note i{font-style:normal;color:var(--am,#9a6516);font-weight:700}.fz022 .mono{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}@keyframes fz022pop{0%,100%{transform:translateX(0);box-shadow:0 2px 10px -8px rgba(26,24,21,.5)}45%,55%{transform:translateX(4px);box-shadow:0 4px 16px -8px rgba(26,24,21,.6)}}@keyframes fz022down{0%,100%{opacity:.25;transform:translate(-2px,-4px) rotate(45deg)}50%{opacity:1;transform:translate(-2px,2px) rotate(45deg)}}@keyframes fz022pulse{0%,100%{box-shadow:0 0 0 0 currentColor;opacity:.85}50%{box-shadow:0 0 0 5px transparent;opacity:1}}@media(max-width:560px){.fz022 .stage{flex-direction:column}.fz022 .outs{padding-left:0;padding-top:8px;flex-direction:row;flex-wrap:wrap}.fz022 .outs:before{display:none}.fz022 .out{flex:1 1 28%;min-width:90px}.fz022 .out .ar{left:50%;top:-12px;transform:translateX(-50%) rotate(135deg)}.fz022 .step .sub{display:none}}@media (prefers-reduced-motion:reduce){.fz022 .step,.fz022 .flow:before,.fz022 .out .dot{animation:none}.fz022 .step{transform:none;box-shadow:0 2px 10px -8px rgba(26,24,21,.5)}.fz022 .flow:before{opacity:1;transform:translate(-2px,-1px) rotate(45deg)}.fz022 .out .dot{opacity:1;box-shadow:none}}</style><div class="hd"><div class="t1">权限判定链</div><div class="t2">Claude Code 不是一个权限开关，而是一条分层过滤链</div></div><div class="stage"><div class="chain"><div class="step s1"><span class="num">1</span><span class="lab">Request</span><span class="sub">tool · input</span></div><div class="flow f1"></div><div class="step s2"><span class="num">2</span><span class="lab">Rule Match</span><span class="sub">deny / allow rules</span></div><div class="flow f2"></div><div class="step s3"><span class="num">3</span><span class="lab">Tool Check</span><span class="sub">validate · permission</span></div><div class="flow f3"></div><div class="step s4"><span class="num">4</span><span class="lab">Hook / Auto</span><span class="sub">classifier · hook</span></div></div><div class="outs"><div class="out allow"><span class="ar"></span><span class="dot"></span><span class="nm">Allow</span></div><div class="out ask"><span class="ar"></span><span class="dot"></span><span class="nm">Ask</span></div><div class="out deny"><span class="ar"></span><span class="dot"></span><span class="nm">Deny</span></div></div></div><div class="note"><span class="k mono">关键分支</span><span><b class="mono">dontAsk</b> 会把 ask 强转 deny；<i class="mono">auto</i> 会把 ask 先交给 classifier 或 hook，而不是立刻弹窗。</span></div></figure>

`src/utils/permissions/PermissionMode.ts` 暴露了几种显式模式：

- `default`
- `plan`
- `acceptEdits`
- `bypassPermissions`
- `dontAsk`
- 条件启用的 `auto`

但真正有意思的不是模式名，而是 `permissions.ts` 里那条决策链。

先看裁剪版骨架：

```ts
const result = await hasPermissionsToUseToolInner(tool, input, context) // 先跑基础权限判断
if (result.behavior === 'allow') return result // 如果已经允许就直接放行
if (context.getAppState().toolPermissionContext.mode === 'dontAsk' && result.behavior === 'ask') { // dontAsk 模式会拦截 ask
  return { behavior: 'deny', message: DONT_ASK_REJECT_MESSAGE(tool.name) } // ask 会被硬转成 deny
} // dontAsk 分支结束
if (context.getAppState().toolPermissionContext.mode === 'auto' && result.behavior === 'ask') { // auto 模式下不立刻弹窗
  return await runClassifierOrHooks(tool, input, context, result) // 先交给 classifier 或 hook 做自动判定
} // auto 分支结束
return result // 其他情况把 ask/deny 结果交给上层继续处理
```

如果把这一段翻译成人话，就是：

1. 先跑规则匹配
1. 再跑工具自己的权限检查
1. 再给 hook 插手的机会
1. 如果当前是 `dontAsk`，把 `ask` 直接打成 `deny`
1. 如果当前是 `auto`，先让 classifier 尝试自动决策
1. 最后才轮到 UI 去问用户

这意味着 Claude Code 的权限系统不是“一个总开关”，而是一条**分层过滤链**。

这条链的实际意义是：

- 权限不是为了多弹几个窗
- 权限是为了把模型碰真实世界的接触面变成一条可审计的决策路径

所以它真正要回答的问题不是“模型能不能执行命令”，而是：

**在什么模式下、通过什么规则、由谁来承担这次真实动作的放行责任。**

## 6. 上下文治理：`CLAUDE.md`、git snapshot 与 compact 是一套预算制度

<figure class="fz023" data-reveal role="group" aria-label="上下文治理示意图：四层 CLAUDE.md 记忆栈汇入 userContext、systemContext 与 Compact，组成受预算控制的消息窗口"><style>.fz023{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gn:#4f7233;--gnb:#e7eedd;--gnl:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;--pp:#54579a;--ppb:#e6e7f3;--ppe:#a9adcf;--gy:#917f5c}.fz023{font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(160deg,var(--paper-soft),var(--soft2));border:1px solid var(--hair);border-radius:18px;padding:22px 20px 18px;margin:0;box-sizing:border-box;max-width:100%;overflow:hidden;line-height:1.5}.fz023 *{box-sizing:border-box}.fz023 .hd{margin-bottom:16px}.fz023 .t{font-weight:700;font-size:clamp(17px,3.4vw,23px);letter-spacing:.5px;color:var(--ink)}.fz023 .s{font-size:clamp(11px,2.2vw,13px);color:var(--muted);margin-top:5px}.fz023 .flow{display:grid;grid-template-columns:auto auto 1fr auto 1fr auto 1fr;align-items:center;gap:6px}.fz023 .stack{display:flex;flex-direction:column;gap:7px}.fz023 .lyr{position:relative;border-radius:11px;padding:9px 14px;font-weight:700;font-size:clamp(12px,2.4vw,15px);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);border:1.5px solid;text-align:center;min-width:84px;opacity:.6;animation:fz023stack 9s ease-in-out infinite}.fz023 .lyr.l0{background:var(--cyb);border-color:var(--cye);color:var(--cy);animation-delay:0s}.fz023 .lyr.l1{background:var(--amb);border-color:var(--ame);color:var(--am);animation-delay:.7s}.fz023 .lyr.l2{background:var(--gnb);border-color:var(--gnl);color:var(--gn);animation-delay:1.4s}.fz023 .lyr.l3{background:var(--rdb);border-color:var(--rde);color:var(--rd);animation-delay:2.1s}.fz023 .lyr small{display:block;font-family:var(--font-serif-body,serif);font-weight:500;font-size:9px;color:var(--muted);margin-top:1px;letter-spacing:.3px}@keyframes fz023stack{0%,100%{opacity:.6;transform:translateX(0)}45%,60%{opacity:1;transform:translateX(2px)}}.fz023 .merge{display:flex;flex-direction:column;justify-content:center;align-items:center;width:26px;align-self:stretch;position:relative}.fz023 .merge i{position:absolute;left:0;width:18px;height:1.5px;background:linear-gradient(90deg,transparent,var(--gy));border-radius:2px}.fz023 .merge i:nth-child(1){top:18%}.fz023 .merge i:nth-child(2){top:39%}.fz023 .merge i:nth-child(3){top:61%}.fz023 .merge i:nth-child(4){top:82%}.fz023 .merge b{display:block;width:9px;height:9px;border-right:2px solid var(--gy);border-top:2px solid var(--gy);transform:rotate(45deg);opacity:1;animation:fz023pulse 7s ease-in-out infinite}.fz023 .arr{position:relative;height:3px;background:var(--hair);border-radius:3px;min-width:30px}.fz023 .arr::after{content:"";position:absolute;right:-2px;top:50%;width:8px;height:8px;border-right:2.5px solid var(--gy);border-top:2.5px solid var(--gy);transform:translateY(-50%) rotate(45deg)}.fz023 .arr::before{content:"";position:absolute;top:0;left:-30%;width:30%;height:100%;background:linear-gradient(90deg,transparent,var(--gnl),transparent);border-radius:3px;animation:fz023run 9s linear infinite}.fz023 .arr.a1::before{animation-delay:0s}.fz023 .arr.a2::before{animation-delay:3s}.fz023 .arr.a3::before{animation-delay:6s}@keyframes fz023run{0%{left:-30%}55%,100%{left:100%}}@keyframes fz023pulse{0%,100%{opacity:.45}50%{opacity:1}}.fz023 .node{border-radius:13px;padding:11px 12px 12px;border:1.5px solid;min-width:0;opacity:.65;animation:fz023glow 10s ease-in-out infinite}.fz023 .node .nm{font-weight:700;font-size:clamp(13px,2.6vw,16px);font-family:var(--font-mono,ui-monospace,monospace);margin-bottom:6px}.fz023 .node .row{font-size:clamp(10px,2.1vw,12.5px);color:var(--ink-soft);font-family:var(--font-mono,ui-monospace,monospace);padding:2px 0;border-top:1px dashed var(--hair)}.fz023 .nU{background:var(--ppb);border-color:var(--ppe);animation-delay:.6s}.fz023 .nU .nm{color:var(--pp)}.fz023 .nS{background:var(--cyb);border-color:var(--cye);animation-delay:2.6s}.fz023 .nS .nm{color:var(--cy)}.fz023 .nC{background:var(--amb);border-color:var(--ame);animation-delay:4.6s}.fz023 .nC .nm{color:var(--am)}@keyframes fz023glow{0%,100%{opacity:.65}30%,55%{opacity:1;box-shadow:0 2px 10px rgba(26,24,21,.08)}}.fz023 .cap{margin-top:16px;background:var(--paper-deep);border:1px solid var(--hair);border-left:4px solid var(--gnl);border-radius:10px;padding:11px 14px;font-size:clamp(11px,2.3vw,13.5px);color:var(--ink-soft);line-height:1.55}.fz023 .cap b{color:var(--gn)}@media(max-width:560px){.fz023 .flow{grid-template-columns:auto 1fr;gap:9px}.fz023 .stack{flex-direction:row;flex-wrap:wrap;justify-content:center;grid-column:1/3}.fz023 .lyr{flex:1 1 40%}.fz023 .merge{display:none}.fz023 .arr{display:none}.fz023 .node{grid-column:1/3}}@media(prefers-reduced-motion:reduce){.fz023 .lyr,.fz023 .node,.fz023 .arr::before,.fz023 .merge b{animation:none}.fz023 .lyr,.fz023 .node,.fz023 .merge b{opacity:1}.fz023 .arr::before{display:none}}</style><div class="hd"><div class="t">上下文治理：规则、环境事实与预算控制</div><div class="s">CLAUDE.md、git 快照和 compact 会在 query loop 前汇成一个受预算控制的窗口</div></div><div class="flow"><div class="stack"><div class="lyr l0">Managed<small>系统级规则</small></div><div class="lyr l1">User<small>用户级全局</small></div><div class="lyr l2">Project<small>项目级</small></div><div class="lyr l3">Local<small>本地私有·最高</small></div></div><div class="merge"><i></i><i></i><i></i><i></i><b></b></div><div class="arr a1"></div><div class="node nU"><div class="nm">userContext</div><div class="row">CLAUDE.md</div><div class="row">currentDate</div></div><div class="arr a2"></div><div class="node nS"><div class="nm">systemContext</div><div class="row">gitStatus</div><div class="row">cacheBreaker</div></div><div class="arr a3"></div><div class="node nC"><div class="nm">Compact</div><div class="row">snip</div><div class="row">micro</div><div class="row">auto</div></div></div><div class="cap"><b>重点：</b>Claude Code 的上下文不是单纯聊天历史，而是规则、环境事实和受预算控制的消息窗口。</div></figure>

Claude Code 的上下文治理有两个特别关键的组件：

- `src/utils/claudemd.ts`
- `src/context.ts`

前者告诉你规则从哪里来，后者告诉你这些规则和环境事实怎么被注入到 query loop 里。

先看 `CLAUDE.md` 的层次：

```ts
const memoryOrder = [ // Claude Code 不是只读一个 CLAUDE.md 文件
  'managed memory', // 系统级规则先进入上下文
  'user memory', // 用户级全局规则继续叠加
  'project memory', // 项目级规则再往上叠
  'local memory', // 本地私有规则优先级最高
] // 分层 memory 顺序结束
const memoryFiles = await getMemoryFiles() // 从当前目录向上发现所有相关记忆文件
const claudeMd = getClaudeMds(filterInjectedMemoryFiles(memoryFiles)) // 再把它们拼成真正送模型的规则文本
```

再看上下文装配：

```ts
const gitStatus = await getGitStatus() // 取会话开始时的 git 快照
const systemContext = { ...(gitStatus && { gitStatus }) } // 系统上下文主要放环境事实
const claudeMd = getClaudeMds(filterInjectedMemoryFiles(await getMemoryFiles())) // 用户上下文里放分层 CLAUDE.md
const userContext = { ...(claudeMd && { claudeMd }), currentDate: `Today's date is ${getLocalISODate()}.` } // 用户上下文里还会显式放当前日期
```

这里最值得注意的点有三个。

第一，`CLAUDE.md` 在 Claude Code 里不是单文件提示词，而是一套层级化 memory。

第二，`git status` 是会话开始时的快照。它会被明确标记成 stale，不会在会话中自动刷新。

第三，当前日期也被当成上下文事实显式注入。

这说明 Claude Code 的上下文不是“聊天历史附带信息”，而是：

- 一部分是规则
- 一部分是环境事实
- 一部分是被预算控制过的历史窗口

再加上第 3 节里看到的 `snip / microcompact / autocompact`，可以更准确地说：

**Claude Code 的上下文系统，本质上是一套持续运行的预算制度。**

## 7. 多代理与 Fork：重点不是“多开”，而是“继承上下文并收缩权限”

<figure class="fz024" data-reveal role="group" aria-label="Subagent / Fork：继承上下文，收缩权限，复用缓存的层级示意图"><style>.fz024{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gn:#4f7233;--gnb:#e7eedd;--gnl:#7c9c54;--bl:#3559a6;--blb:#e6eefb;--ble:#9bbcf0;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;padding:22px 20px 18px;margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz024 *{box-sizing:border-box}.fz024 .hd{margin-bottom:16px}.fz024 .t{font-weight:700;font-size:clamp(17px,2.6vw,22px);line-height:1.32;letter-spacing:.2px}.fz024 .s{margin-top:6px;font-size:clamp(12px,1.7vw,14px);color:var(--muted,#6a6155);line-height:1.4}.fz024 .stage{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1.25fr) auto minmax(0,1.5fr);align-items:center;gap:6px}.fz024 .node{border:1.5px solid var(--hair);border-radius:14px;padding:12px 12px 13px;background:var(--paper-deep,#ece5d5);min-width:0}.fz024 .nm{font-weight:700;font-size:clamp(13px,1.9vw,16px);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);letter-spacing:.3px;margin-bottom:7px}.fz024 .li{font-size:clamp(11px,1.5vw,12.5px);color:var(--ink-soft,#3c362c);line-height:1.5;padding-left:11px;position:relative}.fz024 .li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.55}.fz024 .parent{background:var(--blb,#e6eefb);border-color:var(--ble,#9bbcf0)}.fz024 .parent .nm{color:var(--bl,#3559a6)}.fz024 .fork{background:var(--amb,#f4e8cc);border-color:var(--ame,#d9b66a)}.fz024 .fork .nm{color:var(--am,#9a6516)}.fz024 .kids{display:flex;flex-direction:column;gap:8px;min-width:0}.fz024 .ca{background:var(--gnb,#e7eedd);border-color:var(--gnl,#7c9c54)}.fz024 .ca .nm{color:var(--gn,#4f7233)}.fz024 .cb{background:var(--rdb,#f1ddd6);border-color:var(--rde,#cf9b90)}.fz024 .cb .nm{color:var(--rd,#8f2d20)}.fz024 .ca .li,.fz024 .cb .li{font-family:var(--font-mono,ui-monospace,monospace);font-size:clamp(10.5px,1.4vw,12px)}.fz024 .conn{position:relative;height:3px;min-width:34px;align-self:center}.fz024 .conn .line{position:absolute;inset:0;border-radius:2px;background:linear-gradient(90deg,var(--hair),var(--hair));overflow:hidden}.fz024 .conn .flow{position:absolute;top:0;left:-40%;width:40%;height:100%;border-radius:2px;background:linear-gradient(90deg,transparent,var(--am,#9a6516),transparent);animation:fz024flow 7s ease-in-out infinite}.fz024 .conn .flow.d{animation-delay:1.1s}.fz024 .conn::after{content:"";position:absolute;right:-1px;top:50%;transform:translateY(-50%);border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid var(--muted,#6a6155)}.fz024 .branch{display:flex;flex-direction:column;justify-content:center;gap:34px;min-width:34px;position:relative}.fz024 .branch .conn{width:100%}@keyframes fz024flow{0%{left:-42%}55%{left:102%}100%{left:102%}}.fz024 .node,.fz024 .foot{animation:fz024rise 8s ease-in-out infinite}.fz024 .parent{animation-delay:0s}.fz024 .fork{animation-delay:.5s}.fz024 .ca{animation-delay:1.2s}.fz024 .cb{animation-delay:1.6s}@keyframes fz024rise{0%,100%{box-shadow:0 1px 0 var(--hair)}45%{box-shadow:0 6px 16px rgba(26,24,21,.1)}}.fz024 .foot{margin-top:16px;border:1px dashed var(--ame,#d9b66a);background:var(--paper-soft,#faf6ec);border-radius:12px;padding:11px 14px;font-size:clamp(11.5px,1.6vw,13px);line-height:1.5;color:var(--ink-soft,#3c362c)}.fz024 .foot b{color:var(--am,#9a6516);font-weight:700}.fz024 .foot .cap{color:var(--bl,#3559a6);font-weight:700}.fz024 .foot .pf{color:var(--gn,#4f7233);font-weight:700}@media(max-width:560px){.fz024 .stage{grid-template-columns:1fr;gap:10px}.fz024 .conn{height:24px;width:100%;min-width:0}.fz024 .conn .flow{left:auto;top:-40%;width:100%;height:40%;background:linear-gradient(180deg,transparent,var(--am,#9a6516),transparent);animation:fz024flowv 7s ease-in-out infinite}.fz024 .conn .flow.d{animation-delay:1.1s}.fz024 .conn::after{right:50%;top:auto;bottom:-1px;transform:translateX(50%);border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid var(--muted,#6a6155);border-bottom:0}.fz024 .branch{flex-direction:column;gap:10px}@keyframes fz024flowv{0%{top:-42%}55%{top:102%}100%{top:102%}}}@media(prefers-reduced-motion:reduce){.fz024 .flow{animation:none;opacity:0}.fz024 .node,.fz024 .foot{animation:none;box-shadow:0 1px 0 var(--hair)}}</style><div class="hd"><div class="t">Subagent / Fork：继承上下文，收缩权限，复用缓存</div><div class="s">Claude Code 的多代理重点不是多开，而是上下文和 prompt cache 的可控复用</div></div><div class="stage"><div class="node parent"><div class="nm">Parent Agent</div><div class="li">完整上下文</div><div class="li">完整 tool_use 历史</div></div><div class="conn"><div class="line"><div class="flow"></div></div></div><div class="node fork"><div class="nm">Fork Builder</div><div class="li">placeholder tool_result</div><div class="li">directive 作为差异尾部</div><div class="li">保持前缀稳定以命中 cache</div></div><div class="branch"><div class="conn"><div class="line"><div class="flow"></div></div></div><div class="conn"><div class="line"><div class="flow d"></div></div></div></div><div class="kids"><div class="node ca"><div class="nm">Child A</div><div class="li">scope A</div><div class="li">allowedTools A</div></div><div class="node cb"><div class="nm">Child B</div><div class="li">scope B</div><div class="li">allowedTools B</div></div></div></div><div class="foot"><span class="cap">重点：</span>子代理可以继承上下文，但<b>不默认继承全部权限</b>；fork 还会刻意<span class="pf">保持请求前缀稳定</span>来优化 prompt cache</div></figure>

Claude Code 的多代理设计，最容易被误读成“并发开几个 worker”。

但从 `runAgent.ts` 和 `forkSubagent.ts` 看，它真正优化的是三件事：

- 上下文怎么继承
- 权限怎么重写
- prompt cache 怎么尽量复用

先看 `runAgent.ts` 里对子代理权限的处理：

```ts
const contextMessages = forkContextMessages ? filterIncompleteToolCalls(forkContextMessages) : [] // fork 时先继承父代理上下文
const initialMessages = [...contextMessages, ...promptMessages] // 再把子任务提示接到后面
if (allowedTools !== undefined) { // 如果调用方明确指定了子代理工具白名单
  toolPermissionContext = { // 就重写子代理自己的权限上下文
    ...toolPermissionContext, // 先保留其他权限字段
    alwaysAllowRules: { // 只修改 allow rules
      cliArg: state.toolPermissionContext.alwaysAllowRules.cliArg, // 继续保留 SDK 层的显式授权
      session: [...allowedTools], // 但把 session 级权限收缩成子代理白名单
    }, // allow rules 结束
  } // 权限上下文重写结束
} // allowedTools 分支结束
```

这段代码说明一件事：

**子代理可以继承上下文，但不应该默认继承父代理已经拿到的全部权限。**

再看 `forkSubagent.ts` 里对 prompt cache 的处理：

```ts
const toolResultBlocks = toolUseBlocks.map(block => ({ // 为每个父消息里的 tool_use 造一个统一的结果块
  type: 'tool_result', // 结果块类型固定
  tool_use_id: block.id, // 仍然绑定原来的 tool_use_id
  content: [{ type: 'text', text: FORK_PLACEHOLDER_RESULT }], // 内容统一成同一个 placeholder 文本
})) // placeholder 结果块构造结束
const toolResultMessage = createUserMessage({ // 再把这些 placeholder 包成一条用户消息
  content: [...toolResultBlocks, { type: 'text', text: buildChildMessage(directive) }], // 只有最后的 directive 会因子代理不同而变化
}) // fork 用户消息构造结束
```

这一段非常关键，因为它明显不是在解决“能不能 fork”，而是在解决：

- 多个 fork child 怎么共享尽可能多的相同前缀
- 从而提高 prompt cache 命中率

所以 Claude Code 的多代理设计重点不是“多开”，而是：

- 继承父上下文
- 用 placeholder 保持前缀稳定
- 用 `allowedTools` 收缩子代理权限
- 让 child 在尽量共享缓存的前提下分工

这是一种明显带成本意识的 subagent 设计。

## 8. 与 Codex 的对比：Claude Code 是 runtime-first，Codex 是 control-plane-first

<figure class="fz025" data-reveal role="group" aria-label="Claude Code 与 Codex 系统重心差异对比图：左侧 runtime-first，右侧 control-plane-first，逐维度对照"><style>.fz025{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--amb:#9a6516;--amb-bg:#f4e8cc;--amb-bd:#d9b66a;--cy:#3f6d79;--cy-bg:#dcebed;--cy-bd:#8fbcc4;--accent:rgba(124,156,84,.16);--ff-s:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--ff-m:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin:0;padding:clamp(16px,3.4vw,30px);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),var(--soft,#f7f1e4));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;font-family:var(--ff-s);color:var(--ink,#1a1815);box-sizing:border-box;overflow:hidden}.fz025 *{box-sizing:border-box}.fz025 .hd{margin:0 0 4px}.fz025 .t1{font-size:clamp(18px,3vw,26px);font-weight:700;letter-spacing:.01em;color:var(--ink,#1a1815);line-height:1.25}.fz025 .t2{font-size:clamp(12px,1.7vw,15px);color:var(--muted,#6a6155);margin-top:6px;font-family:var(--ff-m)}.fz025 .grid{display:flex;gap:clamp(10px,2vw,20px);margin-top:clamp(14px,2.6vw,22px);align-items:stretch}.fz025 .card{flex:1 1 0;min-width:0;border-radius:14px;padding:clamp(12px,2vw,18px);position:relative;border:1.5px solid;animation:fzfloat 9s ease-in-out infinite}.fz025 .ca{background:var(--amb-bg,#f4e8cc);border-color:var(--amb-bd,#d9b66a)}.fz025 .cc{background:var(--cy-bg,#dcebed);border-color:var(--cy-bd,#8fbcc4);animation-delay:-4.5s}.fz025 .ttl{font-weight:700;font-size:clamp(16px,2.4vw,22px);text-align:center;letter-spacing:.02em}.fz025 .ca .ttl{color:var(--amb,#9a6516)}.fz025 .cc .ttl{color:var(--cy,#3f6d79)}.fz025 .badge{display:block;text-align:center;font-family:var(--ff-m);font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px;opacity:.8}.fz025 .ca .badge{color:var(--amb,#9a6516)}.fz025 .cc .badge{color:var(--cy,#3f6d79)}.fz025 .rows{margin-top:clamp(10px,1.8vw,16px);display:flex;flex-direction:column;gap:8px}.fz025 .row{font-size:clamp(11.5px,1.7vw,14px);line-height:1.4;color:var(--ink-soft,#3c362c);padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.42);border:1px solid var(--hair,rgba(26,24,21,.18));overflow-wrap:anywhere;word-break:break-word;opacity:0;transform:translateY(6px);animation:fzin .7s ease forwards,fzpulse 8s ease-in-out infinite}.fz025 .row b{font-weight:700;font-family:var(--ff-m);font-size:.92em}.fz025 .ca .row b{color:var(--amb,#9a6516)}.fz025 .cc .row b{color:var(--cy,#3f6d79)}.fz025 .row.last{font-weight:700}.fz025 .ca .row.last{background:rgba(154,101,22,.14)}.fz025 .cc .row.last{background:rgba(63,109,121,.14)}.fz025 .r1{animation-delay:.15s,.15s}.fz025 .r2{animation-delay:.4s,.6s}.fz025 .r3{animation-delay:.65s,1.05s}.fz025 .r4{animation-delay:.9s,1.5s}.fz025 .r5{animation-delay:1.15s,1.95s}.fz025 .vs{flex:0 0 auto;align-self:center;font-family:var(--ff-m);font-weight:700;font-size:clamp(13px,2vw,18px);color:var(--muted,#6a6155);background:var(--paper-deep,#ece5d5);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:50%;width:clamp(34px,6vw,46px);height:clamp(34px,6vw,46px);display:flex;align-items:center;justify-content:center;animation:fzvs 6s ease-in-out infinite}.fz025 .sum{margin-top:clamp(14px,2.6vw,22px);text-align:center;font-size:clamp(12px,1.8vw,15px);line-height:1.5;color:var(--ink,#1a1815);padding:clamp(10px,1.8vw,15px);background:var(--soft,#f7f1e4);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:12px;position:relative;overflow:hidden}.fz025 .sum::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--accent,rgba(124,156,84,.16)),transparent);transform:translateX(-100%);animation:fzsweep 9s ease-in-out infinite}.fz025 .sum span{position:relative}.fz025 .sum em{font-style:normal;font-weight:700;color:var(--amb,#9a6516)}.fz025 .sum i{font-style:normal;font-weight:700;color:var(--cy,#3f6d79)}@keyframes fzin{to{opacity:1;transform:translateY(0)}}@keyframes fzpulse{0%,100%{box-shadow:0 0 0 0 transparent}48%,52%{box-shadow:0 0 0 2px var(--accent,rgba(124,156,84,.16))}}@keyframes fzfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes fzvs{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.12);opacity:1}}@keyframes fzsweep{0%,55%{transform:translateX(-100%)}80%,100%{transform:translateX(100%)}}@media(max-width:560px){.fz025 .grid{flex-direction:column}.fz025 .vs{transform:rotate(90deg)}.fz025 .row{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.fz025 .card,.fz025 .row,.fz025 .vs,.fz025 .sum::before{animation:none!important}.fz025 .row{opacity:1;transform:none}}</style><div class="hd"><div class="t1">Claude Code vs Codex：系统重心差异</div><div class="t2">一个围绕 query loop，另一个围绕 thread / turn / item 控制面</div></div><div class="grid"><div class="card ca"><div class="ttl">Claude Code</div><span class="badge">runtime-first</span><div class="rows"><div class="row r1"><b>主组织单元：</b>query loop / messages / toolUseContext</div><div class="row r2"><b>本地规则：</b>CLAUDE.md 分层 memory</div><div class="row r3"><b>权限：</b>mode + rule + hook + classifier</div><div class="row r4"><b>多代理：</b>fork / subagent + cache reuse</div><div class="row r5 last">系统气质：runtime-first</div></div></div><div class="vs">vs</div><div class="card cc"><div class="ttl">Codex</div><span class="badge">control-plane-first</span><div class="rows"><div class="row r1"><b>主组织单元：</b>thread / turn / item</div><div class="row r2"><b>本地规则：</b>AGENTS.md 分层 project docs</div><div class="row r3"><b>权限：</b>sandbox + exec policy + approvals</div><div class="row r4"><b>多代理：</b>spawned agents + lifecycle protocol</div><div class="row r5 last">系统气质：control-plane-first</div></div></div></div><div class="sum"><span>一句话：<em>Claude Code</em> 更关心如何把一轮任务一路干完，<i>Codex</i> 更关心如何把 agent 做成明确的控制面平台</span></div></figure>

把 Claude Code 和 Codex 放在一起看，差异会非常明显。

我会把结论先压成一句话：

- `Claude Code` 更像一个围绕单条任务流构建的 agent runtime
- `Codex` 更像一个把 agent 行为对象化、协议化、持久化的控制面平台

这个判断在 Codex 源码里可以直接看到。

先看 `build_initial_context(...)` 的裁剪版骨架：

```rust
let mut developer_sections = Vec::<String>::with_capacity(8); // 单独收集 developer 控制面消息
let mut contextual_user_sections = Vec::<String>::with_capacity(2); // 单独收集 contextual user 消息
developer_sections.push(DeveloperInstructions::from_policy(...).into_text()); // 把权限和审批策略显式注入 developer 区
developer_sections.push(render_skills_section(&implicit_skills).unwrap()); // 把 skills 也显式注入 developer 区
developer_sections.push(render_plugins_section(loaded_plugins.capability_summaries()).unwrap()); // 把 plugins 继续注入 developer 区
contextual_user_sections.push(UserInstructions { text: user_instructions.to_string(), directory: turn_context.cwd.to_string_lossy().into_owned() }.serialize_to_text()); // 把 AGENTS.md 一类用户规则包装成独立片段
contextual_user_sections.push(EnvironmentContext::from_turn_context(turn_context, shell.as_ref()).serialize_to_xml()); // 把 cwd、shell、date、timezone 包成结构化环境片段
items.push(build_developer_update_item(developer_sections).unwrap()); // 生成 developer message
items.push(build_contextual_user_message(contextual_user_sections).unwrap()); // 生成 contextual user message
```

这段代码和 Claude Code 的差异非常大。

Claude Code 更像是在为 query loop 备料：

- `systemPrompt`
- `userContext`
- `systemContext`
- `tools`

Codex 则更像是在构建一套显式控制面对象：

- developer message
- contextual user message
- `AGENTS.md` 片段
- environment context 片段
- skills / plugins / approvals / sandbox policy

再看 `project_doc.rs` 的裁剪版骨架：

```rust
const DEFAULT_PROJECT_DOC_FILENAME: &str = "AGENTS.md"; // Codex 把项目规则文件统一命名为 AGENTS.md
let paths = discover_project_doc_paths(config, fs).await?; // 先从 project root 到 cwd 发现所有 AGENTS.md
for p in paths { // 再按层级顺序逐个处理
    let data = fs.read_file(&p, None).await?; // 读取单个 AGENTS.md 文件
    parts.push(String::from_utf8_lossy(&data).to_string()); // 把内容拼成 project-doc 片段
} // 层级扫描结束
```

这又进一步说明，Codex 更强调：

- 显式的层级规则
- 显式的会话原语
- 显式的控制面注入

所以两者的差异可以压成这张表：

| 维度 | Claude Code | Codex |
| --- | --- | --- |
| 主组织单元 | `query loop / messages / toolUseContext` | `thread / turn / item` |
| 本地规则文件 | `CLAUDE.md` 分层 memory | `AGENTS.md` 分层 project docs |
| 上下文表达 | 运行时拼装的上下文块 | typed fragments / `ResponseItem` |
| 权限治理 | mode + rule + hook + classifier | sandbox + exec policy + approvals |
| 多代理 | fork/subagent，强调 cache reuse | spawned agents，强调 protocol 与 lifecycle |
| 系统气质 | runtime-first | control-plane-first |

如果再压成一句更短的话：

- Claude Code 更关心“怎么把一轮任务一路干完”
- Codex 更关心“怎么把 agent 做成平台级能力”

## 9. 结论：Claude Code 值得学的，是它怎样把模型关进一条可持续推进的循环

<figure class="fz026" data-reveal role="group" aria-label="Claude Code 与 Codex 的共同点与差异，以及 runtime 与 harness 才是成熟 agent 关键的收束结论"><style>.fz026{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--amber:#9a6516;--amber-bg:#f4e8cc;--amber-bd:#d9b66a;--green:#4f7233;--green-bg:#e7eedd;--green-lt:#7c9c54;--teal:#3f6d79;--teal-bg:#dcebed;--teal-bd:#8fbcc4;--purple:#54579a;--purple-bd:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(160deg,var(--paper-soft),#f7f1e4 60%,var(--paper-deep));border:1px solid var(--hair);border-radius:20px;padding:clamp(18px,3.4vw,34px);margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz026 *{box-sizing:border-box}.fz026 .hd{margin-bottom:clamp(16px,2.6vw,26px)}.fz026 .ttl{font-size:clamp(20px,3.6vw,30px);font-weight:700;letter-spacing:.02em;color:var(--ink);margin:0 0 .35em;line-height:1.2}.fz026 .sub{font-size:clamp(12px,1.9vw,15px);color:var(--muted);line-height:1.5;margin:0}.fz026 .row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:clamp(10px,1.8vw,20px);align-items:stretch;position:relative}.fz026 .card{position:relative;border-radius:16px;padding:clamp(14px,2vw,20px) clamp(12px,1.8vw,18px);border:1.5px solid var(--hair);background:#fffdf9;display:flex;flex-direction:column;min-width:0;opacity:.001;transform:translateY(10px);animation:fz026in .9s ease forwards}.fz026 .c1{border-color:var(--amber-bd);background:linear-gradient(165deg,#fffaf0,var(--amber-bg));animation-delay:.05s}.fz026 .c2{border-color:var(--green-lt);background:linear-gradient(165deg,#f4f8ec,var(--green-bg));animation-delay:.35s;z-index:2}.fz026 .c3{border-color:var(--teal-bd);background:linear-gradient(165deg,#eef6f7,var(--teal-bg));animation-delay:.2s}.fz026 .cap{font-size:clamp(15px,2.4vw,21px);font-weight:700;letter-spacing:.02em;margin:0 0 .55em;display:flex;align-items:center;gap:.45em}.fz026 .c1 .cap{color:var(--amber)}.fz026 .c2 .cap{color:var(--green)}.fz026 .c3 .cap{color:var(--teal)}.fz026 .dot{width:.62em;height:.62em;border-radius:50%;flex:none;position:relative}.fz026 .c1 .dot{background:var(--amber)}.fz026 .c2 .dot{background:var(--green)}.fz026 .c3 .dot{background:var(--teal)}.fz026 .c2 .dot::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid var(--green-lt);opacity:.6;animation:fz026pulse 6s ease-in-out infinite}.fz026 ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.5em}.fz026 li{font-size:clamp(12px,1.85vw,15px);line-height:1.45;color:var(--ink-soft);padding-left:1em;position:relative}.fz026 li::before{content:"";position:absolute;left:0;top:.62em;width:.38em;height:.38em;border-radius:50%;background:currentColor;opacity:.55}.fz026 .c1 li::before{color:var(--amber)}.fz026 .c2 li::before{color:var(--green-lt)}.fz026 .c3 li::before{color:var(--teal)}.fz026 .flow{position:absolute;top:50%;height:2px;width:clamp(10px,2vw,20px);overflow:hidden;z-index:1;pointer-events:none}.fz026 .flow::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--green-lt),transparent);background-size:200% 100%;animation:fz026stream 7s linear infinite}.fz026 .fL{left:calc(33.33% - clamp(5px,1vw,10px));transform:translateX(-50%)}.fz026 .fR{right:calc(33.33% - clamp(5px,1vw,10px));transform:translateX(50%)}.fz026 .fR::before{animation-direction:reverse}.fz026 .arr{position:absolute;top:50%;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;z-index:1}.fz026 .aL{left:calc(33.33% + 2px);transform:translateY(-50%);border-right:7px solid var(--green-lt);opacity:.7}.fz026 .aR{right:calc(33.33% + 2px);transform:translateY(-50%);border-left:7px solid var(--green-lt);opacity:.7}.fz026 .concl{margin-top:clamp(16px,2.6vw,26px);border:1.5px solid var(--hair);border-radius:14px;background:linear-gradient(120deg,#fffdf9,var(--paper-deep));padding:clamp(13px,2vw,20px) clamp(15px,2.4vw,24px);position:relative;overflow:hidden;opacity:.001;animation:fz026in .9s ease .6s forwards}.fz026 .concl::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(var(--amber),var(--green),var(--teal));opacity:.85}.fz026 .concl p{margin:0;font-size:clamp(12.5px,2vw,16px);line-height:1.6;color:var(--ink-soft);padding-left:.5em}.fz026 .concl b{color:var(--ink);font-weight:700}.fz026 .concl .key{color:var(--green);font-weight:700;position:relative}.fz026 .concl .key::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:var(--green-lt);transform:scaleX(0);transform-origin:left;animation:fz026line 8s ease-in-out 1.2s infinite}@keyframes fz026in{to{opacity:1;transform:none}}@keyframes fz026pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.5);opacity:0}}@keyframes fz026stream{0%{background-position:120% 0}100%{background-position:-120% 0}}@keyframes fz026line{0%,18%{transform:scaleX(0)}38%,62%{transform:scaleX(1)}82%,100%{transform:scaleX(0)}}@media(max-width:560px){.fz026 .row{grid-template-columns:1fr}.fz026 .c2{order:-1}.fz026 .flow,.fz026 .arr{display:none}.fz026 .card{animation-delay:.05s}}@media(prefers-reduced-motion:reduce){.fz026 .card,.fz026 .concl{opacity:1!important;transform:none!important;animation:none!important}.fz026 .flow::before,.fz026 .dot::after,.fz026 .concl .key::after{animation:none!important}.fz026 .concl .key::after{transform:scaleX(1)}}</style><div class="hd"><p class="ttl">最后收束成一句话</p><p class="sub">成熟的 coding agent，最终拼的不是 prompt 花活，而是运行时骨架</p></div><div class="row"><span class="flow fL" aria-hidden="true"></span><span class="flow fR" aria-hidden="true"></span><span class="arr aL" aria-hidden="true"></span><span class="arr aR" aria-hidden="true"></span><div class="card c1"><p class="cap"><span class="dot"></span>Claude Code</p><ul><li>把一条 query loop 做强</li><li>让任务持续推进</li><li>让工具与上下文围着循环转</li></ul></div><div class="card c2"><p class="cap"><span class="dot"></span>共同点</p><ul><li>都在把模型关进受控执行系统</li><li>都要处理权限、上下文、状态、恢复</li><li>都不是纯聊天产品</li></ul></div><div class="card c3"><p class="cap"><span class="dot"></span>Codex</p><ul><li>把控制面做清楚</li><li>让 thread / turn / item 显式化</li><li>让平台能力更可组合</li></ul></div></div><div class="concl"><p><b>结论：</b>成熟 agent 的关键不是"模型会不会调工具"，而是 <span class="key">runtime 和 harness</span> 怎么把这些动作组织成可控、可恢复、可持续运行的系统</p></div></figure>

把整篇文章再收束一次，我觉得 Claude Code 最值得学的不是功能清单，而是下面这几件事。

第一，它明确承认了 agent 系统的几个现实：

- 模型会不稳定
- 上下文一定会膨胀
- 工具调用会有风险
- 子代理会放大复杂度

第二，它没有把这些问题放到系统外面补，而是直接把它们写进 runtime 骨架里：

- 用 `query loop` 推进任务
- 用 `tool pool` 约束模型可见世界
- 用权限链管理真实动作
- 用 compact 管理上下文预算
- 用 subagent + cache reuse 管理并行复杂度

第三，把它和 Codex 放在一起看，会更容易看清两条路线：

- Claude Code 路线：把单条任务流做强
- Codex 路线：把 agent 控制面做清楚

这两条路线没有谁天然更高明，它们只是回答了不同的问题。

但无论哪一条，最后都指向同一个结论：

**真正成熟的 coding agent，不是 prompt engineering 的胜利，而是 harness engineering 的胜利。**

## 参考资料

- [Syfyivan/claude-code](https://github.com/Syfyivan/claude-code)
- [Syfyivan/claude-code `src/query.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/query.ts)
- [Syfyivan/claude-code `src/QueryEngine.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/QueryEngine.ts)
- [Syfyivan/claude-code `src/Tool.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/Tool.ts)
- [Syfyivan/claude-code `src/tools.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/tools.ts)
- [Syfyivan/claude-code `src/context.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/context.ts)
- [Syfyivan/claude-code `src/utils/claudemd.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/utils/claudemd.ts)
- [Syfyivan/claude-code `src/tools/AgentTool/runAgent.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/tools/AgentTool/runAgent.ts)
- [Syfyivan/claude-code `src/tools/AgentTool/forkSubagent.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/tools/AgentTool/forkSubagent.ts)
- [openai/codex](https://github.com/openai/codex)
- [openai/codex `codex-rs/app-server/README.md`](https://github.com/openai/codex/blob/b0324f9f0569ebfc5534fd6844971d9ae029c791/codex-rs/app-server/README.md)
- [openai/codex `codex-rs/core/src/codex.rs`](https://github.com/openai/codex/blob/b0324f9f0569ebfc5534fd6844971d9ae029c791/codex-rs/core/src/codex.rs)
- [openai/codex `codex-rs/core/src/project_doc.rs`](https://github.com/openai/codex/blob/b0324f9f0569ebfc5534fd6844971d9ae029c791/codex-rs/core/src/project_doc.rs)
