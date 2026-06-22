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

<figure class="fz060" data-reveal role="group" aria-label="Codex 最近三十天更新时间线，主线是从代码 Agent 走向常驻工作台"><style>.fz060{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--r:#8f2d20;--rb:#f1ddd6;--re:#cf9b90;--p:#54579a;--pb:#e6e7f3;--pe:#a9adcf;--gr:#917f5c;--grb:#ece4d2;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(170deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));border:1px solid var(--hair);border-radius:14px;margin:0;padding:26px 22px 30px;box-sizing:border-box;overflow:hidden}.fz060 *{box-sizing:border-box}.fz060 .hd{margin-bottom:22px}.fz060 .ttl{font-size:clamp(18px,3.4vw,25px);font-weight:800;line-height:1.32;letter-spacing:.2px;color:var(--ink)}.fz060 .ttl b{color:var(--g);font-weight:800}.fz060 .sub{margin-top:9px;font-size:clamp(12px,2.1vw,14px);line-height:1.55;color:var(--muted);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz060 .tl{position:relative;display:grid;grid-template-columns:repeat(6,1fr);gap:10px;padding:8px 4px}.fz060 .axis{position:absolute;left:1.5%;right:1.5%;top:50%;height:4px;border-radius:4px;background:var(--hair);transform:translateY(-50%);overflow:hidden}.fz060 .axis::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;border-radius:4px;background:linear-gradient(90deg,transparent,var(--ink-soft),transparent);animation:fz060flow 8s linear infinite}.fz060 .col{position:relative;display:flex;flex-direction:column;align-items:center;min-height:230px;justify-content:center}.fz060 .card{width:100%;border-radius:14px;padding:11px 11px 12px;border:1px solid var(--hair);opacity:0;transform:translateY(var(--fy,12px));animation:fz060rise .9s ease forwards;animation-delay:var(--d,0s)}.fz060 .col.up{justify-content:flex-start}.fz060 .col.dn{justify-content:flex-end}.fz060 .dot{position:absolute;top:50%;left:50%;width:15px;height:15px;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 4px var(--paper-soft,#faf6ec);z-index:2}.fz060 .dot::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px solid currentColor;opacity:.5;animation:fz060pulse 6s ease-in-out infinite;animation-delay:var(--d,0s)}.fz060 .stem{position:absolute;left:50%;width:2px;transform:translateX(-50%);background:var(--hair);z-index:1}.fz060 .col.up .stem{top:calc(50% - 4px);height:18px}.fz060 .col.dn .stem{bottom:calc(50% - 4px);height:18px}.fz060 .col.up .card{margin-bottom:30px}.fz060 .col.dn .card{margin-top:30px;--fy:-12px}.fz060 .date{font-size:13px;font-weight:800;letter-spacing:.3px;margin-bottom:5px}.fz060 .l1{font-size:14px;font-weight:700;line-height:1.3;color:var(--ink)}.fz060 .l2{font-size:13px;line-height:1.35;color:var(--ink-soft);margin-top:2px}.fz060 .n1{background:var(--cb);border-color:var(--ce)}.fz060 .n1 .date{color:var(--c)}.fz060 .n1 .l1{color:var(--c)}.fz060 .d1{background:var(--c);color:var(--c)}.fz060 .n2{background:var(--ab);border-color:var(--ae)}.fz060 .n2 .date{color:var(--a)}.fz060 .n2 .l1{color:var(--a)}.fz060 .d2{background:var(--a);color:var(--a)}.fz060 .n3{background:var(--gb);border-color:var(--gl)}.fz060 .n3 .date{color:var(--g)}.fz060 .n3 .l1{color:var(--g)}.fz060 .d3{background:var(--g);color:var(--g)}.fz060 .n4{background:var(--pb);border-color:var(--pe)}.fz060 .n4 .date{color:var(--p)}.fz060 .n4 .l1{color:var(--p)}.fz060 .d4{background:var(--p);color:var(--p)}.fz060 .n5{background:var(--rb);border-color:var(--re)}.fz060 .n5 .date{color:var(--r)}.fz060 .n5 .l1{color:var(--r)}.fz060 .d5{background:var(--r);color:var(--r)}.fz060 .n6{background:var(--grb);border-color:var(--gr)}.fz060 .n6 .date{color:var(--gr)}.fz060 .n6 .l1{color:var(--gr)}.fz060 .d6{background:var(--gr);color:var(--gr)}.fz060 .foot{margin-top:18px;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted);font-family:var(--font-mono,ui-monospace,monospace)}.fz060 .foot .bar{flex:1;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--c),var(--a),var(--g),var(--p),var(--r),var(--gr));opacity:.55}.fz060 .foot b{color:var(--g);font-weight:800;white-space:nowrap}@keyframes fz060flow{0%{left:-40%}100%{left:100%}}@keyframes fz060rise{to{opacity:1;transform:translateY(0)}}@keyframes fz060pulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.45);opacity:0}}@media(max-width:560px){.fz060 .tl{grid-template-columns:1fr;gap:0;padding:0}.fz060 .axis{left:13px;right:auto;top:0;bottom:0;width:4px;height:auto;transform:none}.fz060 .axis::after{left:0;top:-40%;width:100%;height:40%;background:linear-gradient(180deg,transparent,var(--ink-soft),transparent);animation:fz060flowv 8s linear infinite}.fz060 .col{min-height:0;align-items:stretch;justify-content:flex-start!important;padding:9px 0 9px 36px}.fz060 .col .card{margin:0!important;--fy:10px}.fz060 .stem{left:13px;top:50%!important;bottom:auto!important;width:18px;height:2px;transform:translateY(-50%)}.fz060 .dot{left:13px;top:50%}}@keyframes fz060flowv{0%{top:-40%}100%{top:100%}}@media (prefers-reduced-motion:reduce){.fz060 .card{animation:none;opacity:1;transform:none}.fz060 .axis::after,.fz060 .dot::after{animation:none}.fz060 .dot::after{opacity:.4;transform:scale(1)}}</style><div class="hd"><div class="ttl">最近 30 天的主线不是"功能多"，而是<b>"常驻化"</b></div><div class="sub">2026-04-02 → 2026-05-02：Codex 同时更新了计费、桌面 app、模型、CLI、企业化和状态浮层。</div></div><div class="tl"><div class="axis"></div><div class="col up"><div class="card n1" style="--d:.05s"><div class="date">4 月 2 日</div><div class="l1">PAYG 与</div><div class="l2">token 计费</div></div><span class="stem"></span><span class="dot d1" style="--d:.05s"></span></div><div class="col dn"><div class="card n2" style="--d:.2s"><div class="date">4 月 9 日</div><div class="l1">$100 Pro</div><div class="l2">Codex 用量</div></div><span class="stem"></span><span class="dot d2" style="--d:.2s"></span></div><div class="col up"><div class="card n3" style="--d:.35s"><div class="date">4 月 16 日</div><div class="l1">Codex app</div><div class="l2">变成工作台</div></div><span class="stem"></span><span class="dot d3" style="--d:.35s"></span></div><div class="col dn"><div class="card n4" style="--d:.5s"><div class="date">4 月 23 日</div><div class="l1">GPT-5.5</div><div class="l2">Browser Use</div></div><span class="stem"></span><span class="dot d4" style="--d:.5s"></span></div><div class="col up"><div class="card n5" style="--d:.65s"><div class="date">4 月 30 日</div><div class="l1">CLI /goal</div><div class="l2">账号安全</div></div><span class="stem"></span><span class="dot d5" style="--d:.65s"></span></div><div class="col dn"><div class="card n6" style="--d:.8s"><div class="date">5 月 1 日</div><div class="l1">Codex Pets</div><div class="l2">状态浮层</div></div><span class="stem"></span><span class="dot d6" style="--d:.8s"></span></div></div><div class="foot"><span>从代码 Agent</span><span class="bar"></span><b>走向常驻工作台</b></div></figure>

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

<figure class="fz061" data-reveal role="group" aria-label="Codex 五层工作台能力分层示意图：从模型层到组织层自下而上堆叠"><style>.fz061{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:1.6rem 1.4rem 1.7rem;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-sizing:border-box}.fz061 *{box-sizing:border-box}.fz061 .hd{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.2rem}.fz061 .ht{flex:1 1 auto;min-width:0}.fz061 .h1{font-size:clamp(1.1rem,3.6vw,1.5rem);font-weight:800;letter-spacing:.01em;line-height:1.3;margin:0}.fz061 .h2{margin:.5rem 0 0;font-size:clamp(.78rem,2.3vw,.92rem);color:var(--muted,#6a6155);line-height:1.55}.fz061 .bot{flex:0 0 auto;width:54px;height:54px;border-radius:16px;background:var(--ink,#1a1815);position:relative;animation:fz061blink 7s ease-in-out infinite}.fz061 .bot i{position:absolute;top:20px;width:7px;height:7px;border-radius:50%;background:#fde68a}.fz061 .bot i.l{left:13px}.fz061 .bot i.r{right:13px}.fz061 .bot u{position:absolute;left:15px;right:15px;bottom:13px;height:8px;border:0 solid #fde68a;border-bottom-width:4px;border-radius:0 0 60% 60%}.fz061 .stack{display:flex;flex-direction:column-reverse;gap:.55rem}.fz061 .row{position:relative;display:flex;align-items:center;gap:1rem;padding:.85rem 1.05rem;border-radius:14px;border:1px solid var(--c-edge);background:var(--c-bg);overflow:hidden;opacity:.001;transform:translateY(10px);animation:fz061rise .7s ease forwards}.fz061 .row::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c-mk)}.fz061 .row::after{content:"";position:absolute;left:0;top:0;bottom:0;width:38%;background:linear-gradient(90deg,var(--c-flow),transparent);opacity:.5;mix-blend-mode:multiply;transform:translateX(-100%);animation:fz061flow 9s ease-in-out infinite}.fz061 .row:nth-child(1){animation-delay:.05s}.fz061 .row:nth-child(2){animation-delay:.18s}.fz061 .row:nth-child(3){animation-delay:.31s}.fz061 .row:nth-child(4){animation-delay:.44s}.fz061 .row:nth-child(5){animation-delay:.57s}.fz061 .row:nth-child(1)::after{animation-delay:0s}.fz061 .row:nth-child(2)::after{animation-delay:1.6s}.fz061 .row:nth-child(3)::after{animation-delay:3.2s}.fz061 .row:nth-child(4)::after{animation-delay:4.8s}.fz061 .row:nth-child(5)::after{animation-delay:6.4s}.fz061 .tag{position:relative;z-index:1;flex:0 0 auto;width:5.4rem;font-weight:700;font-size:clamp(.85rem,2.5vw,.98rem);color:var(--c-mk);line-height:1.3}.fz061 .desc{position:relative;z-index:1;flex:1 1 auto;min-width:0;font-size:clamp(.74rem,2.1vw,.86rem);color:var(--ink-soft,#3c362c);line-height:1.5;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);word-break:break-word}.fz061 .desc b{font-weight:700;color:var(--ink,#1a1815)}.fz061 .r-mod{--c-bg:var(--blue-bg,#dde6f4);--c-edge:var(--blue-edge,#93b4dd);--c-mk:var(--blue,#2f5aa0);--c-flow:#93b4dd}.fz061 .r-har{--c-bg:var(--cyan-bg,#dcebed);--c-edge:var(--cyan-edge,#8fbcc4);--c-mk:var(--cyan,#3f6d79);--c-flow:#8fbcc4}.fz061 .r-bench{--c-bg:var(--green-bg,#e7eedd);--c-edge:var(--green-bright,#7c9c54);--c-mk:var(--green,#4f7233);--c-flow:#7c9c54}.fz061 .r-task{--c-bg:var(--amber-bg,#f4e8cc);--c-edge:var(--amber-edge,#d9b66a);--c-mk:var(--amber,#9a6516);--c-flow:#d9b66a}.fz061 .r-org{--c-bg:var(--red-bg,#f1ddd6);--c-edge:var(--red-edge,#cf9b90);--c-mk:var(--red,#8f2d20);--c-flow:#cf9b90}.fz061 .lvl{position:relative;z-index:1;flex:0 0 auto;width:1.5rem;text-align:center;font-family:var(--font-mono,ui-monospace,monospace);font-size:.72rem;color:var(--muted,#6a6155);font-weight:700}.fz061 .foot{margin-top:1rem;display:flex;align-items:center;gap:.5rem;font-size:.72rem;color:var(--muted,#6a6155);font-family:var(--font-mono,ui-monospace,monospace)}.fz061 .foot .ar{flex:0 0 auto;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid var(--muted,#6a6155);animation:fz061up 6s ease-in-out infinite}@keyframes fz061rise{to{opacity:1;transform:translateY(0)}}@keyframes fz061flow{0%{transform:translateX(-100%)}45%,100%{transform:translateX(360%)}}@keyframes fz061blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.86)}}@keyframes fz061up{0%,100%{transform:translateY(2px)}50%{transform:translateY(-2px)}}@media(max-width:560px){.fz061 .row{flex-wrap:wrap;gap:.35rem .8rem}.fz061 .lvl{order:-1;width:auto;text-align:left}.fz061 .tag{width:auto}.fz061 .desc{flex-basis:100%}}@media(prefers-reduced-motion:reduce){.fz061 .row,.fz061 .bot,.fz061 .foot .ar{animation:none!important;opacity:1;transform:none}.fz061 .row::after{animation:none!important;opacity:.18;transform:translateX(0)}}</style><div class="hd"><div class="ht"><p class="h1">Codex 正在形成五层工作台</p><p class="h2">模型更强只是第一层，真正的变化是 harness、工具、长期任务和组织边界一起成熟。</p></div><div class="bot" aria-hidden="true"><i class="l"></i><i class="r"></i><u></u></div></div><div class="stack" role="list"><div class="row r-org" role="listitem"><span class="lvl">L5</span><span class="tag">组织层</span><span class="desc"><b>token 计费</b>、Codex-only seats、Bedrock、Codex Labs、账号安全</span></div><div class="row r-task" role="listitem"><span class="lvl">L4</span><span class="tag">长期任务层</span><span class="desc"><b>Memory</b>、context-aware suggestions、thread automations、持久化 /goal</span></div><div class="row r-bench" role="listitem"><span class="lvl">L3</span><span class="tag">工作台层</span><span class="desc"><b>Browser Use</b>、Computer Use、Chats、PR review、artifact viewer、多终端</span></div><div class="row r-har" role="listitem"><span class="lvl">L2</span><span class="tag">Harness 层</span><span class="desc"><b>App Server</b>、多环境、hooks、MCP、tool discovery、permission profiles</span></div><div class="row r-mod" role="listitem"><span class="lvl">L1</span><span class="tag">模型层</span><span class="desc"><b>GPT-5.5 进入 Codex</b>，适合实现、重构、调试、测试和知识工作</span></div></div><div class="foot"><span class="ar" aria-hidden="true"></span><span>自下而上：从模型能力到组织级部署，五层一起成熟</span></div></figure>

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

<figure class="fz062" data-reveal role="group" aria-label="Codex app 常驻工作流：从一次对话到一段持续工作流的闭环示意图"><style>.fz062{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:clamp(18px,3.5vw,30px);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);line-height:1.5;box-sizing:border-box;overflow:hidden}.fz062 *{box-sizing:border-box}.fz062 .ttl{font-size:clamp(19px,3.4vw,27px);font-weight:800;letter-spacing:.4px;margin:0 0 6px}.fz062 .sub{font-size:clamp(12px,2vw,14.5px);color:var(--muted,#6a6155);margin:0 0 clamp(16px,2.6vw,22px);max-width:62ch}.fz062 .flow{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(10px,1.8vw,16px);align-items:stretch}.fz062 .node{position:relative;border-radius:16px;padding:clamp(11px,1.8vw,15px) clamp(12px,2vw,16px);border:1px solid;display:flex;flex-direction:column;gap:5px;min-width:0;background-clip:padding-box;animation:fzlift 9s ease-in-out infinite}.fz062 .node .nm{font-weight:700;font-size:clamp(14px,2.3vw,17px);letter-spacing:.3px;line-height:1.25}.fz062 .node small{font-size:clamp(11px,1.8vw,13px);color:var(--ink-soft,#3c362c);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);letter-spacing:-.1px}.fz062 .node .tag{position:absolute;top:-9px;left:13px;font-size:10px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);letter-spacing:1px;padding:1px 7px;border-radius:20px;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));color:var(--muted,#6a6155)}.fz062 .n1{background:var(--c-cyan-bg,#dcebed);border-color:var(--c-cyan-bd,#8fbcc4);animation-delay:0s}.fz062 .n1 .nm{color:var(--c-cyan,#3f6d79)}.fz062 .n2{background:var(--c-green-bg,#e7eedd);border-color:var(--c-green-lt,#7c9c54);animation-delay:1.5s}.fz062 .n2 .nm{color:var(--c-green,#4f7233)}.fz062 .n3{background:var(--c-amber-bg,#f4e8cc);border-color:var(--c-amber-bd,#d9b66a);animation-delay:3s}.fz062 .n3 .nm{color:var(--c-amber,#9a6516)}.fz062 .n4{background:var(--c-purple-bg,#e6e7f3);border-color:var(--c-purple-bd,#a9adcf);animation-delay:4.5s}.fz062 .n4 .nm{color:var(--c-purple,#54579a)}.fz062 .arr{align-self:center;justify-self:center;position:relative;width:100%;height:18px;display:flex;align-items:center}.fz062 .arr .bar{position:relative;flex:1;height:3px;border-radius:3px;background:var(--hair,rgba(26,24,21,.18));overflow:hidden}.fz062 .arr .bar::after{content:"";position:absolute;top:0;left:-45%;width:45%;height:100%;border-radius:3px;background:linear-gradient(90deg,transparent,var(--muted,#6a6155),transparent);animation:fzslide 3.2s linear infinite}.fz062 .arr .hd{width:0;height:0;border-style:solid;border-width:5px 0 5px 8px;border-color:transparent transparent transparent var(--muted,#6a6155);margin-left:-1px}.fz062 .a3 .bar::after{animation-delay:1.1s}.fz062 .loopwrap{margin-top:clamp(12px,2vw,18px);display:grid;grid-template-columns:1fr auto 1fr;gap:clamp(10px,1.8vw,16px);align-items:stretch}.fz062 .rebar{grid-column:1 / -1;position:relative;height:30px;margin-bottom:2px}.fz062 .rebar .track{position:absolute;left:16%;right:16%;top:50%;height:3px;background:var(--hair,rgba(26,24,21,.18));border-radius:3px;overflow:hidden}.fz062 .rebar .track::after{content:"";position:absolute;top:0;right:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,var(--c-purple,#54579a),transparent);animation:fzslideL 3.6s linear infinite}.fz062 .rebar .up{position:absolute;top:-6px;right:14.5%;width:0;height:0;border-style:solid;border-width:0 6px 9px 6px;border-color:transparent transparent var(--c-purple,#54579a) transparent}.fz062 .rebar .lbl{position:absolute;left:50%;top:-3px;transform:translateX(-50%);font-size:10.5px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);letter-spacing:1px;color:var(--c-purple,#54579a);background:var(--paper-soft,#faf6ec);padding:0 8px}.fz062 .spacer{min-width:0}.fz062 .pet{position:relative;border-radius:16px;padding:clamp(11px,1.8vw,15px) clamp(12px,2vw,16px);border:1px dashed var(--c-grey-bg,#917f5c);background:var(--paper-deep,#ece5d5);display:flex;flex-direction:column;gap:5px;animation:fzpulse 7s ease-in-out infinite}.fz062 .pet .nm{font-weight:700;font-size:clamp(14px,2.3vw,17px);color:var(--ink,#1a1815);display:flex;align-items:center;gap:8px}.fz062 .pet small{font-size:clamp(11px,1.8vw,13px);color:var(--ink-soft,#3c362c);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz062 .pet .dot{width:9px;height:9px;border-radius:50%;background:var(--c-green-lt,#7c9c54);box-shadow:0 0 0 0 var(--c-green-lt,#7c9c54);animation:fzbeat 2.4s ease-in-out infinite}.fz062 .pet .tag{position:absolute;top:-9px;left:13px;font-size:10px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);letter-spacing:1px;padding:1px 7px;border-radius:20px;background:var(--paper-soft,#faf6ec);border:1px solid var(--c-grey-bg,#917f5c);color:var(--muted,#6a6155)}@keyframes fzslide{0%{left:-45%}100%{left:120%}}@keyframes fzslideL{0%{right:-40%}100%{right:120%}}@keyframes fzlift{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes fzpulse{0%,100%{box-shadow:0 0 0 0 rgba(124,156,84,0)}50%{box-shadow:0 0 0 3px rgba(124,156,84,.18)}}@keyframes fzbeat{0%,100%{box-shadow:0 0 0 0 rgba(124,156,84,.5)}50%{box-shadow:0 0 0 6px rgba(124,156,84,0)}}@media(max-width:560px){.fz062 .flow{grid-template-columns:1fr}.fz062 .arr{height:20px;width:60%}.fz062 .arr .bar{flex:none;width:3px;height:100%}.fz062 .arr .bar::after{left:0;top:-45%;width:100%;height:45%;background:linear-gradient(180deg,transparent,var(--muted,#6a6155),transparent);animation:fzslideV 3.2s linear infinite}.fz062 .arr .hd{border-width:8px 5px 0 5px;border-color:var(--muted,#6a6155) transparent transparent transparent;margin:-1px 0 0}.fz062 .loopwrap{grid-template-columns:1fr}.fz062 .spacer{display:none}}@keyframes fzslideV{0%{top:-45%}100%{top:120%}}@media (prefers-reduced-motion:reduce){.fz062 .node,.fz062 .pet,.fz062 .pet .dot,.fz062 .arr .bar::after,.fz062 .rebar .track::after{animation:none!important}.fz062 .node,.fz062 .pet{transform:none}.fz062 .arr .bar::after{left:0;width:100%}.fz062 .rebar .track::after{right:0;width:100%}.fz062 .pet .dot{box-shadow:0 0 0 3px rgba(124,156,84,.25)}}</style><div class="ttl">从一次对话，到一段持续工作流</div><div class="sub">Codex app 的更新让任务可以开始、执行、暂停、唤醒、回看，并在桌面上暴露状态。</div><div class="flow"><div class="node n1"><span class="tag">START</span><span class="nm">Chats</span><small>不用先选项目</small><small>先研究和规划</small></div><div class="arr a2"><span class="bar"></span><span class="hd"></span></div><div class="node n2"><span class="tag">DO</span><span class="nm">Browser / Computer</span><small>看页面、点击 UI</small><small>验证本地修复</small></div><div class="arr a3"><span class="bar"></span><span class="hd"></span></div><div class="node n3"><span class="tag">REVIEW</span><span class="nm">Artifacts</span><small>预览文档产物</small><small>继续 Review</small></div></div><div class="loopwrap"><div class="rebar"><span class="track"></span><span class="up"></span><span class="lbl">定时唤醒 · 回到对话</span></div><div class="node n4"><span class="tag">LOOP</span><span class="nm">Memory + Automation</span><small>保留上下文</small><small>定时唤醒线程</small></div><div class="spacer"></div><div class="pet"><span class="tag">STATUS</span><span class="nm"><i class="dot"></i>Codex Pets</span><small>桌面浮层</small><small>展示任务状态</small></div></div></figure>

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

<figure class="fz063" data-reveal role="group" aria-label="组织级使用需要三件事：算清、接入、守住边界 —— Codex 企业化更新的三个分组对比图"><style>.fz063{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gr:#4f7233;--grb:#e7eedd;--grl:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;--pu:#54579a;--pub:#e6e7f3;--font-serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--font-mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3.2vw,30px);margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz063 *{box-sizing:border-box}.fz063 .head{margin-bottom:clamp(14px,2.4vw,22px)}.fz063 .h-t{font-size:clamp(18px,3.2vw,27px);font-weight:800;line-height:1.32;letter-spacing:.2px;color:var(--ink,#1a1815)}.fz063 .h-t b{position:relative;white-space:nowrap}.fz063 .h-t b.k1{color:var(--cy,#3f6d79)}.fz063 .h-t b.k2{color:var(--gr,#4f7233)}.fz063 .h-t b.k3{color:var(--rd,#8f2d20)}.fz063 .h-s{margin-top:9px;font-size:clamp(12.5px,1.7vw,15px);line-height:1.55;color:var(--muted,#6a6155)}.fz063 .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(10px,1.8vw,16px)}.fz063 .card{position:relative;border-radius:16px;padding:clamp(13px,1.8vw,20px);border:1px solid var(--hair,rgba(26,24,21,.18));overflow:hidden;opacity:0;transform:translateY(14px);animation:fz063in .7s ease forwards}.fz063 .card:nth-child(1){animation-delay:.05s}.fz063 .card:nth-child(2){animation-delay:.22s}.fz063 .card:nth-child(3){animation-delay:.39s}.fz063 .c1{background:var(--cyb,#dcebed);border-color:var(--cye,#8fbcc4)}.fz063 .c2{background:var(--grb,#e7eedd);border-color:var(--grl,#7c9c54)}.fz063 .c3{background:var(--rdb,#f1ddd6);border-color:var(--rde,#cf9b90)}.fz063 .card::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;transform:scaleX(0);transform-origin:left;animation:fz063bar 7s ease-in-out infinite}.fz063 .c1::before{background:var(--cy,#3f6d79);animation-delay:.2s}.fz063 .c2::before{background:var(--gr,#4f7233);animation-delay:2.5s}.fz063 .c3::before{background:var(--rd,#8f2d20);animation-delay:4.8s}.fz063 .tag{display:inline-block;font-family:var(--font-mono);font-size:11px;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:999px;margin-bottom:9px}.fz063 .c1 .tag{color:var(--cy,#3f6d79);background:rgba(63,109,121,.12)}.fz063 .c2 .tag{color:var(--gr,#4f7233);background:rgba(79,114,51,.12)}.fz063 .c3 .tag{color:var(--rd,#8f2d20);background:rgba(143,45,32,.12)}.fz063 .c-t{font-size:clamp(16px,2.3vw,21px);font-weight:800;line-height:1.25;margin-bottom:11px}.fz063 .c1 .c-t{color:var(--cy,#3f6d79)}.fz063 .c2 .c-t{color:var(--gr,#4f7233)}.fz063 .c3 .c-t{color:var(--rd,#8f2d20)}.fz063 .li{display:flex;align-items:baseline;gap:8px;font-family:var(--font-mono);font-size:clamp(11.5px,1.55vw,14px);line-height:1.5;color:var(--ink-soft,#3c362c);padding:4px 0;border-bottom:1px dashed var(--hair,rgba(26,24,21,.18))}.fz063 .li:last-of-type{border-bottom:none}.fz063 .dot{flex:none;width:6px;height:6px;border-radius:50%;margin-top:6px;opacity:0;animation:fz063dot 6.5s ease-in-out infinite}.fz063 .c1 .dot{background:var(--cy,#3f6d79)}.fz063 .c2 .dot{background:var(--gr,#4f7233)}.fz063 .c3 .dot{background:var(--rd,#8f2d20)}.fz063 .li:nth-child(3) .dot{animation-delay:.3s}.fz063 .li:nth-child(4) .dot{animation-delay:.55s}.fz063 .li:nth-child(5) .dot{animation-delay:.8s}.fz063 .li:nth-child(6) .dot{animation-delay:1.05s}.fz063 .key{margin-top:13px;padding-top:11px;border-top:1px solid var(--hair,rgba(26,24,21,.18));font-size:clamp(12px,1.6vw,14px);line-height:1.55;color:var(--muted,#6a6155)}.fz063 .key b{font-weight:800;color:var(--ink,#1a1815)}.fz063 .flow{position:relative;margin-top:clamp(14px,2.2vw,20px);height:30px;border-radius:999px;background:var(--paper-deep,#ece5d5);border:1px solid var(--hair,rgba(26,24,21,.18));display:flex;align-items:center;overflow:hidden}.fz063 .flow span{flex:1;text-align:center;font-family:var(--font-mono);font-size:clamp(10.5px,1.4vw,12.5px);letter-spacing:1px;color:var(--ink-soft,#3c362c);position:relative;z-index:2;font-weight:700}.fz063 .flow span:nth-child(1){color:var(--cy,#3f6d79)}.fz063 .flow span:nth-child(2){color:var(--gr,#4f7233)}.fz063 .flow span:nth-child(3){color:var(--rd,#8f2d20)}.fz063 .flow::after{content:"";position:absolute;top:0;bottom:0;left:0;width:34%;background:linear-gradient(90deg,transparent,rgba(26,24,21,.07),transparent);z-index:1;animation:fz063sweep 8s ease-in-out infinite}@keyframes fz063in{to{opacity:1;transform:translateY(0)}}@keyframes fz063bar{0%,12%{transform:scaleX(0)}30%,70%{transform:scaleX(1)}88%,100%{transform:scaleX(0)}}@keyframes fz063dot{0%,18%{opacity:.15}40%,72%{opacity:1}92%,100%{opacity:.15}}@keyframes fz063sweep{0%{left:-34%}100%{left:100%}}@media (max-width:560px){.fz063 .grid{grid-template-columns:1fr}.fz063 .flow{flex-direction:column;height:auto;gap:4px;padding:8px 0;border-radius:14px}.fz063 .flow span{padding:2px 0}}@media (prefers-reduced-motion:reduce){.fz063 .card{opacity:1;transform:none;animation:none}.fz063 .card::before{transform:scaleX(1);animation:none}.fz063 .dot{opacity:1;animation:none}.fz063 .flow::after{animation:none;left:-100%}}</style><div class="head"><div class="h-t">组织级使用需要三件事：<b class="k1">算清</b>、<b class="k2">接入</b>、<b class="k3">守住边界</b></div><div class="h-s">4 月的多项更新都在回答企业会问的问题：钱怎么算，怎么接入，出了风险怎么控。</div></div><div class="grid"><div class="card c1"><span class="tag">算清</span><div class="c-t">计费透明</div><div class="li"><span class="dot"></span><span>Codex-only seats</span></div><div class="li"><span class="dot"></span><span>token-based rate card</span></div><div class="li"><span class="dot"></span><span>input / cached / output</span></div><div class="li"><span class="dot"></span><span>$100 Pro 选项</span></div><div class="key">重点：从<b>"每条消息估算"</b>转向<b>"按 token 明细看"</b>。</div></div><div class="card c2"><span class="tag">接入</span><div class="c-t">企业接入</div><div class="li"><span class="dot"></span><span>90+ plugins</span></div><div class="li"><span class="dot"></span><span>Codex Labs</span></div><div class="li"><span class="dot"></span><span>GSI 合作伙伴</span></div><div class="li"><span class="dot"></span><span>Amazon Bedrock preview</span></div><div class="key">重点：放进<b>已有云、采购和团队工具链</b>。</div></div><div class="card c3"><span class="tag">守住边界</span><div class="c-t">安全边界</div><div class="li"><span class="dot"></span><span>Automatic approvals</span></div><div class="li"><span class="dot"></span><span>permission profiles</span></div><div class="li"><span class="dot"></span><span>Advanced Account Security</span></div><div class="li"><span class="dot"></span><span>macOS 签名证书轮换</span></div><div class="key">重点：Agent 能做更多事，<b>审批和账号必须更强</b>。</div></div></div><div class="flow"><span>计费透明</span><span>企业接入</span><span>安全边界</span></div></figure>

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

<figure class="fz064" data-reveal role="group" aria-label="Claude Code 2026 年 4 月更新时间线：从本地 CLI 到云端 Agent 编排平台"><style>.fz064{--paper-soft:#faf6ec;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--r:#8f2d20;--rb:#f1ddd6;--re:#cf9b90;--p:#54579a;--pb:#e6e7f3;--pe:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(180deg,var(--paper-soft),#f7f1e4);border:1px solid var(--hair);border-radius:14px;padding:1.4rem 1.3rem 1.6rem;margin:1.4rem 0;max-width:100%;box-sizing:border-box;overflow:hidden}.fz064 .hd{margin-bottom:.35rem}.fz064 .ti{font-size:clamp(1.05rem,3.4vw,1.5rem);font-weight:800;line-height:1.3;color:var(--ink);letter-spacing:.01em}.fz064 .sub{margin-top:.45rem;font-size:clamp(.74rem,2vw,.9rem);line-height:1.55;color:var(--muted)}.fz064 .tl{position:relative;margin-top:1.6rem;display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;align-items:center}.fz064 .axis{position:absolute;left:1%;right:1%;top:50%;height:4px;border-radius:99px;background:var(--hair);transform:translateY(-50%);overflow:hidden}.fz064 .axis::after{content:"";position:absolute;inset:0;width:40%;border-radius:99px;background:linear-gradient(90deg,transparent,var(--ink-soft),transparent);animation:fz064flow 9s linear infinite}@keyframes fz064flow{0%{transform:translateX(-110%)}100%{transform:translateX(360%)}}.fz064 .col{position:relative;display:flex;flex-direction:column;align-items:center;min-width:0}.fz064 .col.up{flex-direction:column}.fz064 .col.dn{flex-direction:column-reverse}.fz064 .dot{width:18px;height:18px;border-radius:50%;flex:0 0 auto;position:relative;z-index:2;box-shadow:0 0 0 4px var(--paper-soft);animation:fz064pulse 8s ease-in-out infinite}.fz064 .stem{width:2px;flex:0 0 auto;height:18px;background:var(--hair);position:relative;overflow:hidden}.fz064 .stem::after{content:"";position:absolute;left:0;right:0;top:0;height:50%;background:currentColor;animation:fz064drip 8s ease-in-out infinite}@keyframes fz064drip{0%,12%{transform:translateY(-100%)}30%,100%{transform:translateY(120%)}}.fz064 .card{box-sizing:border-box;width:100%;border-radius:14px;padding:.6rem .55rem .65rem;border:1px solid;background:var(--paper-soft);opacity:0;transform:translateY(8px);animation:fz064in 8s ease-in-out infinite}.fz064 .col.dn .card{transform:translateY(-8px)}.fz064 .date{font-size:clamp(.72rem,1.9vw,.88rem);font-weight:800;line-height:1.2;margin-bottom:.3rem}.fz064 .it{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(.66rem,1.7vw,.8rem);line-height:1.5;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fz064 .n1 .dot{background:var(--gl);color:var(--g);animation-delay:0s}.fz064 .n1 .stem{color:var(--gl);animation-delay:0s}.fz064 .n1 .card{border-color:var(--gl);background:var(--gb);animation-delay:0s}.fz064 .n1 .date{color:var(--g)}.fz064 .n2 .dot{background:var(--ae);color:var(--a);animation-delay:1.4s}.fz064 .n2 .stem{color:var(--ae);animation-delay:1.4s}.fz064 .n2 .card{border-color:var(--ae);background:var(--ab);animation-delay:1.4s}.fz064 .n2 .date{color:var(--a)}.fz064 .n3 .dot{background:var(--pe);color:var(--p);animation-delay:2.8s}.fz064 .n3 .stem{color:var(--pe);animation-delay:2.8s}.fz064 .n3 .card{border-color:var(--pe);background:var(--pb);animation-delay:2.8s}.fz064 .n3 .date{color:var(--p)}.fz064 .n4 .dot{background:var(--re);color:var(--r);animation-delay:4.2s}.fz064 .n4 .stem{color:var(--re);animation-delay:4.2s}.fz064 .n4 .card{border-color:var(--re);background:var(--rb);animation-delay:4.2s}.fz064 .n4 .date{color:var(--r)}.fz064 .n5 .dot{background:var(--ce);color:var(--c);animation-delay:5.6s}.fz064 .n5 .stem{color:var(--ce);animation-delay:5.6s}.fz064 .n5 .card{border-color:var(--ce);background:var(--cb);animation-delay:5.6s}.fz064 .n5 .date{color:var(--c)}@keyframes fz064pulse{0%,8%{box-shadow:0 0 0 4px var(--paper-soft)}18%{box-shadow:0 0 0 4px var(--paper-soft),0 0 0 9px color-mix(in srgb,currentColor 28%,transparent)}40%,100%{box-shadow:0 0 0 4px var(--paper-soft)}}@keyframes fz064in{0%,8%{opacity:0;transform:translateY(8px)}28%,100%{opacity:1;transform:translateY(0)}}.fz064 .lg{margin-top:1.5rem;display:flex;flex-wrap:wrap;gap:.5rem .9rem;font-size:.72rem;color:var(--muted);border-top:1px dashed var(--hair);padding-top:.8rem}.fz064 .lg b{font-weight:800;color:var(--ink-soft)}@media(max-width:560px){.fz064 .tl{grid-template-columns:1fr;gap:.7rem}.fz064 .axis{left:8px;right:auto;top:0;bottom:0;width:4px;height:auto;transform:none}.fz064 .axis::after{width:auto;height:40%;left:0;right:0;background:linear-gradient(180deg,transparent,var(--ink-soft),transparent);animation:fz064flowv 9s linear infinite}.fz064 .col,.fz064 .col.dn{flex-direction:row;align-items:flex-start;gap:.6rem;padding-left:2px}.fz064 .stem{width:14px;height:2px;margin-top:8px}.fz064 .stem::after{top:0;bottom:0;left:0;height:auto;width:50%;animation:fz064dripv 8s ease-in-out infinite}.fz064 .card{transform:translateX(8px)!important}@keyframes fz064in{0%,8%{opacity:0;transform:translateX(8px)}28%,100%{opacity:1;transform:translateX(0)}}}@keyframes fz064flowv{0%{transform:translateY(-110%)}100%{transform:translateY(360%)}}@keyframes fz064dripv{0%,12%{transform:translateX(-100%)}30%,100%{transform:translateX(120%)}}@media (prefers-reduced-motion:reduce){.fz064 .axis::after,.fz064 .dot,.fz064 .stem::after,.fz064 .card{animation:none!important}.fz064 .card{opacity:1!important;transform:none!important}.fz064 .stem::after{transform:none}}</style><div class="hd"><div class="ti">Claude Code 的主线：本地 CLI 与云端 Agent 编排合流</div><div class="sub">Opus 4.7、Routines、Ultraplan、Ultrareview、Monitor 和 Claude Security 把 Claude Code 推向平台化。</div></div><div class="tl"><div class="axis" aria-hidden="true"></div><div class="col up n1"><span class="dot" aria-hidden="true"></span><span class="stem" aria-hidden="true"></span><div class="card"><div class="date">4 月 6-10 日</div><div class="it">Ultraplan</div><div class="it">Monitor / loop</div></div></div><div class="col dn n2"><span class="dot" aria-hidden="true"></span><span class="stem" aria-hidden="true"></span><div class="card"><div class="date">4 月 13-17 日</div><div class="it">Opus 4.7</div><div class="it">Routines</div></div></div><div class="col up n3"><span class="dot" aria-hidden="true"></span><span class="stem" aria-hidden="true"></span><div class="card"><div class="date">4 月 20-24 日</div><div class="it">Ultrareview</div><div class="it">Web redesign</div></div></div><div class="col dn n4"><span class="dot" aria-hidden="true"></span><span class="stem" aria-hidden="true"></span><div class="card"><div class="date">4 月 23 日</div><div class="it">质量复盘</div><div class="it">修复 effort / thinking</div></div></div><div class="col up n5"><span class="dot" aria-hidden="true"></span><span class="stem" aria-hidden="true"></span><div class="card"><div class="date">4 月 30 日</div><div class="it">Claude Security</div><div class="it">Enterprise beta</div></div></div></div><div class="lg" aria-hidden="true"><span><b>本地 CLI</b> 执行 harness</span><span><b>云端编排</b> 计划·审查·例行</span><span><b>企业与安全</b> 治理·审计</span></div></figure>

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

<figure class="fz065" data-reveal role="group" aria-label="Codex 与 Claude Code 最近一个月路线对照图：左侧 Codex 常驻桌面工作台，右侧 Claude Code 本地 CLI 与云端编排平台"><style>.fz065{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--teal:#3f6d79;--teal-bg:#dcebed;--teal-edge:#8fbcc4;--purple:#54579a;--purple-bg:#e6e7f3;--purple-edge:#a9adcf;margin:0;padding:clamp(18px,3.4vw,30px);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:16px;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-sizing:border-box;overflow:hidden}.fz065 *{box-sizing:border-box}.fz065 .hd{margin-bottom:clamp(14px,2.6vw,22px)}.fz065 .t1{font-size:clamp(18px,3.1vw,27px);font-weight:800;line-height:1.32;letter-spacing:.2px;color:var(--ink,#1a1815)}.fz065 .t2{margin-top:.5em;font-size:clamp(12px,1.9vw,15px);color:var(--muted,#6a6155);line-height:1.5}.fz065 .grid{display:flex;align-items:stretch;justify-content:center;gap:clamp(10px,2vw,20px);position:relative}.fz065 .card{flex:1 1 0;min-width:0;border-radius:16px;padding:clamp(14px,2.4vw,22px);border:1px solid;position:relative;overflow:hidden;opacity:0;transform:translateY(14px);animation:fz065in .9s ease forwards;display:flex;flex-direction:column}.fz065 .card.lc{background:var(--teal-bg,#dcebed);border-color:var(--teal-edge,#8fbcc4);animation-delay:.1s}.fz065 .card.rc{background:var(--purple-bg,#e6e7f3);border-color:var(--purple-edge,#a9adcf);animation-delay:.35s}.fz065 .card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px}.fz065 .lc::before{background:var(--teal,#3f6d79)}.fz065 .rc::before{background:var(--purple,#54579a)}.fz065 .name{font-size:clamp(17px,2.7vw,24px);font-weight:800;letter-spacing:.3px}.fz065 .lc .name{color:var(--teal,#3f6d79)}.fz065 .rc .name{color:var(--purple,#54579a)}.fz065 .sub{margin-top:.35em;font-size:clamp(13px,2vw,16px);font-weight:700;color:var(--ink-soft,#3c362c)}.fz065 .list{margin:clamp(12px,2.2vw,18px) 0;display:flex;flex-direction:column;gap:clamp(7px,1.3vw,10px)}.fz065 .row{display:flex;align-items:center;gap:.6em;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.75vw,14px);color:var(--ink-soft,#3c362c);line-height:1.35;padding:.36em .6em;border-radius:8px;background:rgba(255,255,255,.42);border:1px solid var(--hair,rgba(26,24,21,.18))}.fz065 .dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;animation:fz065pulse 7s ease-in-out infinite}.fz065 .lc .dot{background:var(--teal,#3f6d79)}.fz065 .rc .dot{background:var(--purple,#54579a)}.fz065 .lc .row:nth-child(2) .dot{animation-delay:.5s}.fz065 .lc .row:nth-child(3) .dot{animation-delay:1s}.fz065 .lc .row:nth-child(4) .dot{animation-delay:1.5s}.fz065 .rc .row:nth-child(2) .dot{animation-delay:.7s}.fz065 .rc .row:nth-child(3) .dot{animation-delay:1.2s}.fz065 .rc .row:nth-child(4) .dot{animation-delay:1.7s}.fz065 .kw{margin-top:auto;padding-top:clamp(8px,1.6vw,12px);border-top:1px dashed var(--hair,rgba(26,24,21,.18));font-size:clamp(12px,1.95vw,16px);font-weight:700;line-height:1.4}.fz065 .lc .kw{color:var(--teal,#3f6d79)}.fz065 .rc .kw{color:var(--purple,#54579a)}.fz065 .kw b{font-weight:800}.fz065 .link{flex:0 0 auto;align-self:center;width:clamp(22px,3.4vw,40px);display:flex;align-items:center;justify-content:center;position:relative}.fz065 .link i{display:block;width:100%;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--teal,#3f6d79),var(--muted,#6a6155),var(--purple,#54579a));background-size:200% 100%;animation:fz065flow 8s linear infinite;position:relative}.fz065 .link i::before,.fz065 .link i::after{content:"";position:absolute;top:50%;width:8px;height:8px;border-radius:50%;transform:translateY(-50%)}.fz065 .link i::before{left:-2px;background:var(--teal,#3f6d79)}.fz065 .link i::after{right:-2px;background:var(--purple,#54579a)}@keyframes fz065in{to{opacity:1;transform:translateY(0)}}@keyframes fz065pulse{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.5);opacity:1}}@keyframes fz065flow{to{background-position:-200% 0}}@media(max-width:560px){.fz065 .grid{flex-direction:column}.fz065 .link{width:100%;height:24px;transform:rotate(90deg)}.fz065 .link i{width:60px;margin:0 auto}}@media(prefers-reduced-motion:reduce){.fz065 .card{opacity:1;transform:none;animation:none}.fz065 .dot,.fz065 .link i{animation:none}.fz065 .dot{opacity:1}}</style><div class="hd"><div class="t1">同样是 Coding Agent，两条路线略有不同</div><div class="t2">Codex 更像常驻工作台，Claude Code 更像本地 CLI 与云端编排平台。</div></div><div class="grid"><div class="card lc"><div class="name">Codex</div><div class="sub">常驻桌面工作台</div><div class="list"><div class="row"><span class="dot"></span><span>Browser Use / Computer Use</span></div><div class="row"><span class="dot"></span><span>Thread automations / Memory</span></div><div class="row"><span class="dot"></span><span>Codex Pets 状态浮层</span></div><div class="row"><span class="dot"></span><span>插件、MCP、Bedrock、企业计费</span></div></div><div class="kw">关键词：让 Agent <b>一直在你旁边</b></div></div><div class="link" aria-hidden="true"><i></i></div><div class="card rc"><div class="name">Claude Code</div><div class="sub">本地 CLI + 云端编排平台</div><div class="list"><div class="row"><span class="dot"></span><span>Opus 4.7 / xhigh effort</span></div><div class="row"><span class="dot"></span><span>Routines / Ultraplan / Monitor</span></div><div class="row"><span class="dot"></span><span>Ultrareview / Claude Security</span></div><div class="row"><span class="dot"></span><span>MCP、Hooks、原生 CLI、企业治理</span></div></div><div class="kw">关键词：让 Agent <b>接进开发流程</b></div></div></div></figure>

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
