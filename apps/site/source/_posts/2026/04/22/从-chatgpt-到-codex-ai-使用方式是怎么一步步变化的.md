---
title: "从 ChatGPT 到 Codex：AI 使用方式是怎么一步步变化的"
date: 2026-04-22 15:30:00
categories:
  - 技术
tags:
  - AI
  - ChatGPT
  - GitHub Copilot
  - Cursor
  - Claude Code
  - Codex
  - Agent
  - Browser
  - Computer Use
excerpt: "按官方资料把这几年 AI 的使用方式串起来回看一遍：网页对话、Tab 补全、仓库级 IDE Agent、CLI Agent、多代理和自动化，以及浏览器和电脑操作开始扩展 AI 执行边界的新阶段。"
cover: "cover-v2.png"
coverPosition: "below-title"
---

## 摘要

如果只看我自己，以及我身边很多开发者这几年的真实使用路径，大概都能画出一条很像的线：

- 先是在网页里和 AI 对话
- 再开始在编辑器里按 `Tab` 接受补全
- 再往后，把 `Cursor` 这类能读整个仓库的 AI IDE 当成副驾驶
- 然后进入 `Claude Code`、`Codex CLI` 这种命令行 Agent 阶段
- 到现在，工具已经开始往“多代理并行、后台执行、自动化协作”的方向发展
- 再往后，AI 开始进入浏览器、网页系统和桌面环境

但这里要先说清楚一个容易混淆的事实：

**如果按产品发布时间排序，这条线并不严格成立。**

例如，`GitHub Copilot` 的技术预览发布时间是 `2021-06-29`，比 `ChatGPT` 的 `2022-11-30` 还早。也就是说，**市场上的产品时间线**和**普通开发者真正形成习惯的采用路径**，不是一回事。

这篇文章我会优先沿着“采用路径”来写，因为它更接近真实体验；但所有关键节点，我都尽量用官方资料把日期和产品定位钉住。

<figure class="fz053" data-reveal role="group" aria-label="对比图：产品发布时间线与开发者真实采用路径不是一回事"><style>.fz053{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--blue:#3f6d79;--blue-bg:#dcebed;--blue-edge:#8fbcc4;--amber:#9a6516;--amber-bg:#f4e8cc;--amber-edge:#d9b66a;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;padding:22px 20px 24px;margin:1.4em 0;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 6px 22px rgba(26,24,21,.06);overflow:hidden}.fz053 .hd{margin-bottom:16px}.fz053 .ttl{font-size:clamp(18px,3.4vw,25px);font-weight:700;letter-spacing:.4px;line-height:1.3}.fz053 .sub{margin-top:7px;font-size:clamp(12px,2.2vw,14px);color:var(--muted,#6a6155);line-height:1.55}.fz053 .panel{border-radius:14px;padding:16px 16px 18px;margin-top:14px;position:relative}.fz053 .p-blue{background:var(--blue-bg,#dcebed);border:1.5px solid var(--blue-edge,#8fbcc4)}.fz053 .p-amber{background:var(--amber-bg,#f4e8cc);border:1.5px solid var(--amber-edge,#d9b66a)}.fz053 .ph{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.fz053 .ph b{font-size:clamp(15px,2.7vw,19px);font-weight:700}.fz053 .p-blue .ph b{color:var(--blue,#3f6d79)}.fz053 .p-amber .ph b{color:var(--amber,#9a6516)}.fz053 .ph small{font-size:clamp(11px,2vw,13px);color:var(--muted,#6a6155);line-height:1.5}.fz053 .lane{position:relative;margin-top:18px}.fz053 .rail{position:absolute;left:0;right:0;top:50px;height:5px;border-radius:3px;background:linear-gradient(90deg,var(--blue,#3f6d79),var(--blue-edge,#8fbcc4));opacity:.55;overflow:hidden}.fz053 .rail::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent);animation:fz053flow 7s linear infinite}.fz053 .nodes{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;position:relative}.fz053 .nd{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:0}.fz053 .nd .date{font-size:clamp(10px,1.8vw,12px);color:var(--blue,#3f6d79);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin-bottom:10px;letter-spacing:-.3px}.fz053 .nd .dot{width:15px;height:15px;border-radius:50%;background:var(--blue,#3f6d79);border:2px solid var(--paper-soft,#faf6ec);box-shadow:0 0 0 1px var(--blue-edge,#8fbcc4);position:relative;z-index:2;animation:fz053pulse 7s ease-in-out infinite}.fz053 .nd:nth-child(2) .dot{animation-delay:.5s}.fz053 .nd:nth-child(3) .dot{animation-delay:1s}.fz053 .nd:nth-child(4) .dot{animation-delay:1.5s}.fz053 .nd:nth-child(5) .dot{animation-delay:2s}.fz053 .nd:nth-child(6) .dot{animation-delay:2.5s}.fz053 .nd .name{margin-top:12px;font-size:clamp(12px,2.2vw,16px);font-weight:700;color:var(--ink,#1a1815);line-height:1.2}.fz053 .nd .desc{margin-top:4px;font-size:clamp(10px,1.7vw,12px);color:var(--muted,#6a6155);line-height:1.35}.fz053 .steps{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-top:18px}.fz053 .step{position:relative;background:#f7f1e4;border:1.5px solid var(--amber-edge,#d9b66a);border-radius:12px;padding:11px 9px;text-align:center;animation:fz053rise 8s ease-in-out infinite}.fz053 .step:nth-child(2){animation-delay:.6s}.fz053 .step:nth-child(3){animation-delay:1.2s}.fz053 .step:nth-child(4){animation-delay:1.8s}.fz053 .step:nth-child(5){animation-delay:2.4s}.fz053 .step:nth-child(6){animation-delay:3s}.fz053 .step .sn{font-size:clamp(12px,2.3vw,16px);font-weight:700;color:var(--ink,#1a1815);line-height:1.25}.fz053 .step .sd{margin-top:5px;font-size:clamp(10px,1.7vw,12px);color:var(--muted,#6a6155);line-height:1.35}.fz053 .step::after{content:"";position:absolute;right:-8px;top:50%;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:8px solid var(--amber,#9a6516);transform:translateY(-50%);opacity:.85;z-index:3;animation:fz053arrow 7s ease-in-out infinite}.fz053 .step:last-child::after{display:none}.fz053 .step:nth-child(2)::after{animation-delay:.5s}.fz053 .step:nth-child(3)::after{animation-delay:1s}.fz053 .step:nth-child(4)::after{animation-delay:1.5s}.fz053 .step:nth-child(5)::after{animation-delay:2s}@keyframes fz053flow{0%{left:-40%}100%{left:120%}}@keyframes fz053pulse{0%,100%{box-shadow:0 0 0 1px var(--blue-edge,#8fbcc4)}45%{box-shadow:0 0 0 1px var(--blue-edge,#8fbcc4),0 0 0 6px rgba(63,109,121,.16)}}@keyframes fz053rise{0%,100%{transform:translateY(0);box-shadow:0 1px 2px rgba(26,24,21,.05)}48%{transform:translateY(-4px);box-shadow:0 6px 14px rgba(154,101,22,.16)}}@keyframes fz053arrow{0%,100%{opacity:.4;transform:translateY(-50%) translateX(0)}50%{opacity:1;transform:translateY(-50%) translateX(3px)}}@media (max-width:560px){.fz053 .nodes,.fz053 .steps{grid-template-columns:repeat(2,1fr);gap:12px}.fz053 .rail{display:none}.fz053 .nd .date{margin-bottom:6px}.fz053 .nd .dot{animation:fz053pulse 7s ease-in-out infinite}.fz053 .step::after{display:none}.fz053 .step:last-child::after{display:none}}@media (prefers-reduced-motion:reduce){.fz053 .rail::after,.fz053 .nd .dot,.fz053 .step,.fz053 .step::after{animation:none!important}.fz053 .step{transform:none;box-shadow:0 1px 2px rgba(26,24,21,.05)}.fz053 .step::after{opacity:.85;transform:translateY(-50%)}.fz053 .nd .dot{box-shadow:0 0 0 1px var(--blue-edge,#8fbcc4)}}</style><div class="hd"><div class="ttl">发布时间和采用路径，不一定是一回事</div><div class="sub">很多开发者的真实体验，是先网页对话，再补全、再 Agent；但代表性产品的发布时间并不是这个顺序。</div></div><div class="panel p-blue"><div class="ph"><b>一条是产品发布时间线</b></div><div class="lane"><div class="rail"></div><div class="nodes"><div class="nd"><span class="date">2021-06-29</span><span class="dot"></span><span class="name">Copilot</span><span class="desc">技术预览</span></div><div class="nd"><span class="date">2022-11-30</span><span class="dot"></span><span class="name">ChatGPT</span><span class="desc">网页对话爆发</span></div><div class="nd"><span class="date">2025-02-19</span><span class="dot"></span><span class="name">Cursor</span><span class="desc">Agent 默认模式</span></div><div class="nd"><span class="date">2025-02-27</span><span class="dot"></span><span class="name">Claude Code</span><span class="desc">研究预览首秀</span></div><div class="nd"><span class="date">2025-05-16</span><span class="dot"></span><span class="name">Codex</span><span class="desc">云端软件工程 Agent</span></div><div class="nd"><span class="date">2026-04-16</span><span class="dot"></span><span class="name">Codex App</span><span class="desc">浏览器与电脑操作</span></div></div></div></div><div class="panel p-amber"><div class="ph"><b>另一条是很多人的真实采用路径</b><small>这条线更像使用习惯的迁移：从“提问”到“补全”，再到“仓库级执行”、多代理协同和真实环境操作。</small></div><div class="steps"><div class="step"><span class="sn">网页对话</span><span class="sd">先学会怎么说话</span></div><div class="step"><span class="sn">Tab 补全</span><span class="sd">回到编辑器击键流</span></div><div class="step"><span class="sn">仓库级 IDE</span><span class="sd">先读仓库再动手</span></div><div class="step"><span class="sn">CLI Agent</span><span class="sd">进入工程执行面</span></div><div class="step"><span class="sn">多代理/自动化</span><span class="sd">后台并行长任务</span></div><div class="step"><span class="sn">浏览器/电脑</span><span class="sd">连接真实工作流</span></div></div></div></figure>

## 1. 第一阶段：网页对话，AI 先成为“会聊天的外脑”

`2022-11-30`，OpenAI 在 [Introducing ChatGPT](https://openai.com/index/chatgpt/) 里把 ChatGPT 作为 research preview 推出。官方当时强调的是：

- 它可以用对话方式回答追问
- 可以承认错误
- 可以质疑错误前提
- 也可以拒绝不合适请求

这一步的意义，不只是“多了一个聊天机器人”，而是：

**AI 第一次以极低门槛进入了普通人的日常工作流。**

很多人第一次真正把 AI 用起来，不是因为它会写代码，而是因为网页对话这件事太顺手了：

- 报错了，把错误粘进去
- 不懂一个概念，直接问
- 想写个脚本，先让它给个雏形
- 看不懂一段代码，贴进去让它解释

甚至在 ChatGPT 的首发页面里，官方样例里就有“这段代码不工作，怎么修”的场景。这很说明问题：**网页对话虽然没有直接连接仓库，但已经开始承接程序员的真实需求了。**

不过这个阶段的局限也非常明显：

- 上下文靠手工复制粘贴
- 模型看到的是你贴进去的局部，不是你的工程全貌
- 它能回答，但不能直接验证
- 它能给方案，但不能替你跑命令、改文件、看测试结果

所以这时的 AI 更像一个“外脑”：

- 它擅长解释、归纳、起草
- 但它并不真正处在你的工程执行面里

## 2. 第二阶段：Tab 补全，AI 被塞回编辑器的击键流里

如果说网页对话解决的是“先问再做”，那 `GitHub Copilot` 代表的下一步，解决的就是“边写边做”。

`GitHub` 在 `2021-06-29` 发布的 [Introducing GitHub Copilot: your AI pair programmer](https://github.blog/news-insights/product-news/introducing-github-copilot-ai-pair-programmer/) 中，把 Copilot 定义成一个能“根据你正在写的代码，建议整行甚至整个函数”的 AI pair programmer。

这里有个地方很容易混淆：`Tab` 补全这个交互本身并不是 `GitHub Copilot` 发明的。

在 Copilot 之前，命令行、IDE、`IntelliSense`、`LSP`、代码片段工具，早就可以用 `Tab` 或回车来接受补全了。传统补全更多依赖的是：

- 语法分析
- 类型信息
- 符号表
- 已导入模块
- API 列表
- snippet 模板

这些能力当然很重要，但它们不一定是 AI。它们回答的更多是：“当前位置有哪些合法的变量、方法、参数或模板？”

`Copilot` 真正改变的不是“按 `Tab` 接受建议”，而是**灰色建议背后的生成机制变了**。

也就是说，开发者看到的还是一个熟悉的编辑器交互：

```plaintext
灰色建议出现 -> 按 Tab 接受 -> 代码进入文件
```

但背后已经从规则、索引和 snippet，变成了由模型根据上下文生成整行甚至整个函数。

所以，`2021-06-29` 这个时间点当然已经有 AI。只是那时还没有 `ChatGPT` 这种大众化对话入口。`GitHub` 在 `2025-08-29` 的 [Under the hood: Exploring the AI models powering GitHub Copilot](https://github.blog/ai-and-ml/github-copilot/under-the-hood-exploring-the-ai-models-powering-github-copilot/) 里回顾得很清楚：`Copilot` 刚发布技术预览时，`OpenAI` 还没有推出 `ChatGPT`；当时的 `Copilot` 由单一模型 `Codex` 驱动，而 `Codex` 是 `GPT-3` 的后代模型。

换句话说：

**2021 年的 Copilot 已经是 AI 补全；`Tab` 只是接受建议的交互方式，真正变化的是补全内容开始由代码大模型生成。**

如果放在开发者的使用方式这条线里看，这一步最关键的变化还不只是模型更强，而是**交互位置变了**：

- AI 不再待在浏览器标签页里
- 它进入了编辑器
- 它不要求你先停下来提问
- 它开始在你写代码的瞬间给出低延迟预测

很多开发者真正形成稳定高频使用习惯，其实就是从这里开始的。原因很简单：

- 接受建议只要一个 `Tab`
- 不打断当前心流
- 对样板代码、测试、API 调用、重复逻辑特别有效

但是，早期 `Tab` 补全的边界也很明显。`GitHub` 在 `2023-05-17` 的 [How GitHub Copilot is getting better at understanding your code](https://github.blog/ai-and-ml/github-copilot/how-github-copilot-is-getting-better-at-understanding-your-code/) 一文里明确提到：

- 最初版本主要只看当前文件
- 后来才逐步加入 `neighboring tabs`、`Fill-in-the-Middle`、向量检索等机制
- 目标是让它从“当前光标附近”走向“更懂整个项目”

这说明 `Tab` 补全阶段的本质仍然是：

**AI 已经进入编辑器，但它主要还是一个局部预测器，而不是一个完整的工程执行者。**

<figure class="fz054" data-reveal role="group" aria-label="AI 交互界面的五次迁移：网页对话、Tab 补全、仓库级 IDE、CLI Agent、多代理系统五个阶段，在上下文、动作与人的角色三个维度上的对比，呈现上下文入口与动作权限逐级向工程现场靠近"><style>.fz054{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--p:#54579a;--pb:#e6e7f3;--pe:#a9adcf;--sf:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mo:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;color:var(--ink,#1a1815);font-family:var(--sf);line-height:1.5;-webkit-font-smoothing:antialiased}.fz054 *{box-sizing:border-box}.fz054 .hd{margin-bottom:clamp(14px,2.5vw,22px)}.fz054 .t1{font-size:clamp(19px,3.2vw,28px);font-weight:700;letter-spacing:.5px;color:var(--ink,#1a1815)}.fz054 .t2{margin-top:6px;font-size:clamp(12px,1.7vw,15px);color:var(--muted,#6a6155);line-height:1.45}.fz054 .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:clamp(8px,1.2vw,14px)}.fz054 .col{position:relative;border-radius:16px;padding:clamp(10px,1.4vw,16px);border:1.5px solid var(--ce,#8fbcc4);background:var(--paper-soft,#faf6ec);opacity:1;transform:none;animation:fz054rise 9s ease-in-out infinite}.fz054 .col:nth-child(1){border-color:var(--ae,#d9b66a);animation-delay:0s}.fz054 .col:nth-child(2){border-color:var(--ce,#8fbcc4);animation-delay:.45s}.fz054 .col:nth-child(3){border-color:var(--gl,#7c9c54);animation-delay:.9s}.fz054 .col:nth-child(4){border-color:var(--ae,#d9b66a);animation-delay:1.35s}.fz054 .col:nth-child(5){border-color:var(--pe,#a9adcf);animation-delay:1.8s}.fz054 .col::before{content:"";position:absolute;left:0;right:0;top:-1px;height:4px;border-radius:16px 16px 0 0;background:var(--ce,#8fbcc4)}.fz054 .col:nth-child(1)::before{background:var(--a,#9a6516)}.fz054 .col:nth-child(2)::before{background:var(--c,#3f6d79)}.fz054 .col:nth-child(3)::before{background:var(--g,#4f7233)}.fz054 .col:nth-child(4)::before{background:var(--a,#9a6516)}.fz054 .col:nth-child(5)::before{background:var(--p,#54579a)}.fz054 .step{font-size:11px;font-family:var(--mo);color:var(--muted,#6a6155);letter-spacing:1px}.fz054 .name{margin:3px 0 10px;font-size:clamp(14px,1.9vw,19px);font-weight:700}.fz054 .col:nth-child(1) .name{color:var(--a,#9a6516)}.fz054 .col:nth-child(2) .name{color:var(--c,#3f6d79)}.fz054 .col:nth-child(3) .name{color:var(--g,#4f7233)}.fz054 .col:nth-child(4) .name{color:var(--a,#9a6516)}.fz054 .col:nth-child(5) .name{color:var(--p,#54579a)}.fz054 .blk{margin-bottom:10px;padding-bottom:9px;border-bottom:1px solid var(--hair,rgba(26,24,21,.18))}.fz054 .blk:last-child{border-bottom:0;padding-bottom:0;margin-bottom:0}.fz054 .lab{font-size:12px;font-weight:700;color:var(--ink-soft,#3c362c);display:flex;align-items:center;gap:6px;margin-bottom:5px}.fz054 .lab::after{content:"";flex:1;height:1px;background:var(--hair,rgba(26,24,21,.18))}.fz054 .li{font-size:clamp(11px,1.5vw,13px);color:var(--muted,#6a6155);padding:1px 0 1px 11px;position:relative;line-height:1.55}.fz054 .li::before{content:"";position:absolute;left:0;top:.72em;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.55}.fz054 .col:nth-child(1) .li{color:#7a5a2e}.fz054 .col:nth-child(2) .li{color:#4a6470}.fz054 .col:nth-child(3) .li{color:#4f6157}.fz054 .col:nth-child(4) .li{color:#7a6240}.fz054 .col:nth-child(5) .li{color:#5a4f72}.fz054 .role{margin-top:4px;font-size:clamp(11px,1.5vw,13px);font-weight:700;padding:5px 8px;border-radius:9px;background:var(--paper-deep,#ece5d5)}.fz054 .col:nth-child(1) .role{background:var(--ab,#f4e8cc);color:var(--a,#9a6516)}.fz054 .col:nth-child(2) .role{background:var(--cb,#dcebed);color:var(--c,#3f6d79)}.fz054 .col:nth-child(3) .role{background:var(--gb,#e7eedd);color:var(--g,#4f7233)}.fz054 .col:nth-child(4) .role{background:var(--ab,#f4e8cc);color:var(--a,#9a6516)}.fz054 .col:nth-child(5) .role{background:var(--pb,#e6e7f3);color:var(--p,#54579a)}.fz054 .flow{position:relative;height:20px;margin:14px 2px 4px;border-radius:4px;overflow:hidden;background:linear-gradient(90deg,var(--ab,#f4e8cc),var(--cb,#dcebed),var(--gb,#e7eedd),var(--ab,#f4e8cc),var(--pb,#e6e7f3))}.fz054 .flow::after{content:"";position:absolute;inset:0;left:-35%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);width:35%;animation:fz054sweep 8s linear infinite}.fz054 .flow b{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid var(--p,#54579a)}.fz054 .ft{margin-top:10px;font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c);text-align:center;line-height:1.5}.fz054 .ft b{color:var(--g,#4f7233);font-weight:700}@keyframes fz054rise{0%,100%{transform:translateY(0)}45%{transform:translateY(-3px)}}@keyframes fz054sweep{0%{left:-35%}100%{left:135%}}@media(max-width:760px){.fz054 .grid{grid-template-columns:repeat(2,1fr)}.fz054 .col:nth-child(5){grid-column:1/-1}}@media(max-width:560px){.fz054 .grid{grid-template-columns:1fr;gap:10px}.fz054 .col:nth-child(5){grid-column:auto}}@media(prefers-reduced-motion:reduce){.fz054 .col{animation:none;opacity:1;transform:none}.fz054 .flow::after{animation:none;display:none}}</style><div class="hd"><div class="t1">AI 交互界面的五次迁移</div><div class="t2">核心不是“模型回答更像人”，而是上下文入口和动作权限不断向工程现场靠近。</div></div><div class="grid"><div class="col"><div class="step">01</div><div class="name">网页对话</div><div class="blk"><div class="lab">上下文</div><div class="li">手工粘贴</div><div class="li">报错截图</div><div class="li">局部代码片段</div></div><div class="blk"><div class="lab">动作</div><div class="li">回答</div><div class="li">解释</div><div class="li">起草</div></div><div class="blk"><div class="lab">人的角色</div><div class="role">提问者</div></div></div><div class="col"><div class="step">02</div><div class="name">Tab 补全</div><div class="blk"><div class="lab">上下文</div><div class="li">当前文件</div><div class="li">光标附近</div><div class="li">少量临近标签页</div></div><div class="blk"><div class="lab">动作</div><div class="li">整行补全</div><div class="li">函数草稿</div><div class="li">局部改写</div></div><div class="blk"><div class="lab">人的角色</div><div class="role">主写手</div></div></div><div class="col"><div class="step">03</div><div class="name">仓库级 IDE</div><div class="blk"><div class="lab">上下文</div><div class="li">整个仓库</div><div class="li">代码索引</div><div class="li">规则与项目结构</div></div><div class="blk"><div class="lab">动作</div><div class="li">搜索仓库</div><div class="li">跨文件编辑</div><div class="li">执行部分命令</div></div><div class="blk"><div class="lab">人的角色</div><div class="role">任务定义者</div></div></div><div class="col"><div class="step">04</div><div class="name">CLI Agent</div><div class="blk"><div class="lab">上下文</div><div class="li">仓库 + 终端</div><div class="li">命令输出</div><div class="li">测试与 git 状态</div></div><div class="blk"><div class="lab">动作</div><div class="li">读代码库</div><div class="li">跑命令与测试</div><div class="li">提交变更</div></div><div class="blk"><div class="lab">人的角色</div><div class="role">审阅与授权者</div></div></div><div class="col"><div class="step">05</div><div class="name">多代理系统</div><div class="blk"><div class="lab">上下文</div><div class="li">仓库 + 工具</div><div class="li">云沙箱 + 记忆</div><div class="li">并行任务状态</div></div><div class="blk"><div class="lab">动作</div><div class="li">并行委派</div><div class="li">长任务跟踪</div><div class="li">跨界面协作</div></div><div class="blk"><div class="lab">人的角色</div><div class="role">编排与仲裁者</div></div></div></div><div class="flow"><b></b></div><div class="ft">上下文入口与动作权限<b>逐级向工程执行面靠近</b>，人从“提问者”移向“编排与仲裁者”。</div></figure>

## 3. 第三阶段：仓库级 IDE Agent，AI 开始“先读代码库，再动手”

真正把“补全”推进到“代理”的，是 `Cursor` 这类 AI IDE。

我觉得 `Cursor` 做对的一件事，是它不再把 AI 只当成一个在光标后面吐 token 的模型，而是把它变成了一个会先理解仓库、再决定怎么改代码的系统。

从官方资料看，这个变化是分几步成形的：

- `Cursor` 文档里的 [Codebase Indexing](https://docs.cursor.com/chat/codebase) 明确写了：打开项目后，Cursor 会自动为代码库里的文件计算 embeddings，并逐步建立索引
- `2025-02-19` 的 [Agent is ready and UI refresh](https://www.cursor.com/en/changelog/agent-is-ready-and-ui-refresh) 里，Cursor 直接把 `Agent` 设成默认模式
- `2025-05-15` 的 [0.50 更新](https://cursor.com/cn/changelog/0-50) 又把 `Background Agent` 推出来
- 到 `2026-04-02` 的 [Cursor 3 / Agents Window](https://cursor.com/changelog) 阶段，官方已经在强调“可以在不同 repo、不同环境里并行运行多个 agents”

而在产品页 [Cursor Agent](https://cursor.com/product) 上，官方现在的表述已经非常直接：

- `Cursor deeply learns your codebase before writing a single line`
- 子代理可以并行探索代码库
- 它覆盖从规划、编写到 review 的完整流程

这一步和 `Tab` 补全的差别，已经不是“建议更准一点”了，而是下面这些能力开始组合起来：

- 代码库索引
- 跨文件检索
- 多文件修改
- 终端命令
- 团队规则
- PR / 提交历史等更长链路上下文

换句话说，`Cursor` 代表的是：

**AI 不再只对“你正在写的这一行”负责，而是开始对“这个任务在整个仓库里应该怎么落地”负责。**

这时开发者和 AI 的关系也变了：

- 原来是“我写，AI 补”
- 现在更像是“我描述任务，AI 先探索，再给出改动，我审查和修正”

<figure class="fz055" data-reveal role="group" aria-label="仓库级 IDE Agent 架构示意：代码仓库经 IDE Agent Runtime 与开发者协作"><style>.fz055{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--grn:#4f7233;--grnb:#e7eedd;--grnl:#7c9c54;--cyn:#3f6d79;--cynb:#dcebed;--cyne:#8fbcc4;--font-serif-body:"Songti SC","Source Han Serif SC",Georgia,serif;--font-mono:ui-monospace,"SFMono-Regular",monospace;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:22px 20px 18px;margin:1.4em 0;font-family:var(--font-serif-body,"Songti SC",Georgia,serif);color:var(--ink,#1a1815);box-sizing:border-box;overflow:hidden}.fz055 *{box-sizing:border-box}.fz055 .ttl{font-size:1.32rem;font-weight:700;letter-spacing:.01em;color:var(--ink,#1a1815);margin-bottom:.32em}.fz055 .sub{font-size:.86rem;line-height:1.6;color:var(--muted,#6a6155);margin-bottom:1.1em;max-width:64ch}.fz055 .stage{display:grid;grid-template-columns:0.85fr auto 1.15fr auto 0.9fr;align-items:stretch;gap:8px}.fz055 .col{border-radius:16px;padding:14px 12px;border:1.5px solid var(--hair,rgba(26,24,21,.18));display:flex;flex-direction:column;min-width:0}.fz055 .repo{background:#f7f1e4;border-color:#d9c9b8}.fz055 .rt{background:var(--cynb,#dcebed);border-color:var(--cyne,#8fbcc4)}.fz055 .dev{background:var(--grnb,#e7eedd);border-color:var(--grnl,#7c9c54)}.fz055 .ch{font-size:1.02rem;font-weight:700;margin-bottom:.7em;text-align:center}.fz055 .repo .ch{color:var(--ink-soft,#3c362c)}.fz055 .rt .ch{color:var(--cyn,#3f6d79)}.fz055 .dev .ch{color:var(--grn,#4f7233)}.fz055 .item{background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:10px;padding:.56em .6em;font-size:.84rem;line-height:1.3;color:var(--ink-soft,#3c362c);text-align:center;margin-bottom:.5em;position:relative;overflow:hidden}.fz055 .col .item:last-child{margin-bottom:0}.fz055 .repo .item{background:#ece4d2;color:#5d554b}.fz055 .rt .item{background:#fff;font-weight:700;color:var(--ink,#1a1815)}.fz055 .rt .item::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,var(--cyne,#8fbcc4),var(--cyn,#3f6d79));opacity:.5;animation:fz055pulse 7s ease-in-out infinite}.fz055 .rt .item:nth-child(3)::before{animation-delay:1.4s}.fz055 .rt .item:nth-child(4)::before{animation-delay:2.8s}.fz055 .rt .item:nth-child(5)::before{animation-delay:4.2s}.fz055 .dev .item{background:#fff;font-weight:600}.fz055 .conn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-width:54px;padding:4px 0}.fz055 .flow{position:relative;width:100%;height:0}.fz055 .lbl{font-size:.7rem;font-weight:700;letter-spacing:.02em;font-family:var(--font-mono,ui-monospace,monospace);white-space:nowrap;text-align:center;padding-bottom:3px}.fz055 .arr{position:relative;height:14px;width:100%;display:flex;align-items:center}.fz055 .arr .bar{position:absolute;left:6px;right:14px;height:3px;border-radius:2px;top:50%;transform:translateY(-50%);overflow:hidden}.fz055 .arr .bar::after{content:"";position:absolute;top:0;bottom:0;width:40%;border-radius:2px;animation:fz055run 3.4s linear infinite}.fz055 .arr.rev .bar::after{animation-direction:reverse}.fz055 .arr .tip{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent}.fz055 .arr.rev .tip{right:auto;left:2px;border-left:none;transform:translateY(-50%) scaleX(-1)}.fz055 .cBlue .lbl{color:#5a8fd8}.fz055 .cBlue .bar{background:rgba(90,143,216,.3)}.fz055 .cBlue .bar::after{background:linear-gradient(90deg,transparent,#5a8fd8,transparent)}.fz055 .cBlue .tip{border-left:9px solid #5a8fd8}.fz055 .cGrn .lbl{color:var(--grn,#4f7233)}.fz055 .cGrn .bar{background:rgba(79,114,51,.3)}.fz055 .cGrn .bar::after{background:linear-gradient(90deg,transparent,var(--grnl,#7c9c54),transparent)}.fz055 .cGrn .tip{border-left:9px solid var(--grn,#4f7233)}.fz055 .note{margin-top:1.1em;font-size:.82rem;line-height:1.6;color:var(--muted,#6a6155);border-top:1px solid var(--hair,rgba(26,24,21,.18));padding-top:.7em}.fz055 .note b{color:var(--ink-soft,#3c362c);font-weight:700}@keyframes fz055run{0%{left:-40%}100%{left:100%}}@keyframes fz055pulse{0%,100%{opacity:.25}50%{opacity:.7}}.fz055.in-view .ttl{animation:fz055fin .7s ease both}@keyframes fz055fin{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}@media (max-width:560px){.fz055 .stage{grid-template-columns:1fr;gap:4px}.fz055 .conn{flex-direction:row;min-width:0;width:100%;gap:10px;padding:6px 0}.fz055 .arr{width:46px;height:auto}.fz055 .arr .bar{left:4px;right:12px}.fz055 .lbl{padding-bottom:0}.fz055 .flow{display:flex;align-items:center;gap:8px;height:auto}}@media (prefers-reduced-motion:reduce){.fz055 *{animation:none!important}.fz055 .arr .bar::after{display:none}.fz055 .rt .item::before{opacity:.5}}</style><div class="ttl">仓库级 IDE Agent 在做什么</div><div class="sub">以 Cursor 这类产品为代表，AI 已经不是“当前文件补全器”，而是“先理解仓库，再执行任务”的系统。</div><div class="stage"><div class="col repo"><div class="ch">代码仓库</div><div class="item">源代码文件</div><div class="item">配置与脚本</div><div class="item">测试用例</div><div class="item">提交与 PR 线索</div></div><div class="conn cBlue"><div class="flow"><div class="lbl">读仓库</div><div class="arr"><div class="bar"></div><div class="tip"></div></div></div></div><div class="col rt"><div class="ch">IDE Agent Runtime</div><div class="item">代码库索引 / 检索</div><div class="item">任务规划 / 搜索</div><div class="item">跨文件编辑 / Apply</div><div class="item">终端 / Rules / MCP</div></div><div class="conn cGrn"><div class="flow"><div class="lbl">提交任务</div><div class="arr"><div class="bar"></div><div class="tip"></div></div></div><div class="flow"><div class="lbl">返回 diff</div><div class="arr rev"><div class="bar"></div><div class="tip"></div></div></div></div><div class="col dev"><div class="ch">开发者</div><div class="item">描述任务</div><div class="item">审查改动</div><div class="item">决定接受与回退</div></div></div><div class="note"><b>关键变化：</b>AI 开始对“这个任务如何在整个项目里落地”负责，而不只是预测下一行代码。</div></figure>

## 4. 第四阶段：CLI Agent，AI 真正进入工程执行面

再往后，很多人会发现一个很自然的结果：

如果 AI 已经能读仓库、改多文件、跑命令，那它最适合待的地方，往往不是 IDE 侧栏，而是**终端**。

`Claude Code` 是这个阶段最有代表性的产品之一。

从官方信息看，`Anthropic` 在 `2025-02-27` 的活动页 [AI agents in the Enterprise](https://www.anthropic.com/webinars/ai-agents-in-enterprise) 中，已经把 `Claude Code` 描述为其“first agent product in research preview”的首次公开演示。后续在 [Claude Code Quickstart](https://code.claude.com/docs/en/quickstart) 和 [Claude Code 产品页](https://www.anthropic.com/product/claude-code) 里，Anthropic 把它的工作方式写得非常清楚：

- 安装后直接在项目目录里运行
- 可以读取项目文件理解代码库
- 可以修改文件
- 可以执行命令
- 可以用 git
- 可以跑测试
- 默认会在关键动作前请求许可

Anthropic 甚至在产品页上直接把它定义成：

**`agentic, not autocomplete`**

这句话我觉得非常准确。因为到了 CLI 阶段，AI 的身份彻底变了：

- 它不再主要是“补全器”
- 也不只是“IDE 里的聊天框”
- 它开始成为一个真正站在工程执行面上的协作者

为什么 CLI 这么重要？因为工程师本来的主战场就一直在这里：

- `git`
- `build`
- `test`
- `lint`
- `docker`
- `ssh`
- 各种项目脚本和自定义命令

也就是说，CLI Agent 并不是多开了一块新界面，而是直接进入了原来最关键的那块界面。

OpenAI 在 `2025-05-16` 的 [Introducing Codex](https://openai.com/index/introducing-codex/) 里也给出了同样的信号：官方在介绍云端 Codex 的同时明确写到，`Last month, we launched Codex CLI`。而到了 `2026-02-02` 的 [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/) 里，OpenAI 又进一步把 `CLI / web / IDE-extension / app` 这些表面统一到同一个 Codex 体系之下。

所以我会把 CLI 阶段理解成一个分水岭：

**从这里开始，AI 不再只是“帮你写代码”，而是开始“替你推进软件工程任务”。**

<figure class="fz056" data-reveal role="group" aria-label="CLI Agent 的典型执行回路：从用户下达任务到读仓库、执行命令、编辑文件并持续迭代的 Agent Loop，以及权限审批、可恢复性等关键属性"><style>.fz056{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--amber:#9a6516;--amber-bg:#f4e8cc;--amber-bd:#d9b66a;--cyan:#3f6d79;--cyan-bg:#dcebed;--cyan-bd:#8fbcc4;--green:#4f7233;--green-bg:#e7eedd;--purple:#54579a;--purple-bg:#e6e7f3;--purple-bd:#a9adcf;box-sizing:border-box;margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);line-height:1.5}.fz056 *{box-sizing:border-box}.fz056 .hd{font-size:clamp(19px,2.6vw,26px);font-weight:700;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz056 .sub{margin-top:6px;font-size:clamp(12px,1.6vw,14px);color:var(--muted,#6a6155);max-width:62ch}.fz056 .panel{margin-top:clamp(16px,2.4vw,22px);padding:clamp(14px,2.4vw,22px);background:var(--paper-deep,#ece5d5);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:16px}.fz056 .flow{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px}.fz056 .node{flex:1 1 0;min-width:118px;padding:12px 10px;border-radius:13px;background:#f7f1e4;border:1.6px solid var(--cyan-bd,#8fbcc4);font-size:clamp(13px,1.7vw,16px);font-weight:700;color:var(--ink-soft,#3c362c);display:flex;align-items:center;justify-content:center;text-align:center}.fz056 .node.start{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-bd,#d9b66a);color:var(--amber,#9a6516)}.fz056 .arr{flex:0 0 30px;align-self:center;height:14px;position:relative;overflow:hidden}.fz056 .arr::before{content:"";position:absolute;top:50%;left:0;right:9px;height:3px;transform:translateY(-50%);border-radius:3px;background:linear-gradient(90deg,var(--ac,#5a8fd8) 0%,var(--ac,#5a8fd8) 38%,rgba(255,255,255,.85) 50%,var(--ac,#5a8fd8) 62%,var(--ac,#5a8fd8) 100%);background-size:200% 100%;animation:fz056flow 3.4s linear infinite}.fz056 .arr::after{content:"";position:absolute;top:50%;right:0;transform:translateY(-50%);border-left:9px solid var(--ac,#5a8fd8);border-top:6px solid transparent;border-bottom:6px solid transparent}.fz056 .arr.am{--ac:var(--amber,#9a6516)}.fz056 .arr.cy{--ac:var(--cyan,#3f6d79)}@keyframes fz056flow{to{background-position:-200% 0}}.fz056 .loop{margin-top:14px;position:relative;padding:14px clamp(13px,2.2vw,18px);border-radius:14px;background:linear-gradient(180deg,#eef4ee,#e7eedd);border:1.6px solid var(--green,#4f7233)}.fz056 .loop::after{content:"";position:absolute;inset:-1.6px;border-radius:14px;border:1.6px solid var(--green,#4f7233);opacity:0;animation:fz056pulse 7s ease-in-out infinite;pointer-events:none}@keyframes fz056pulse{0%,100%{opacity:0;transform:scale(1)}45%{opacity:.5;transform:scale(1.012)}}.fz056 .lt{font-size:clamp(16px,2.1vw,21px);font-weight:700;color:var(--green,#4f7233);display:flex;align-items:center;gap:9px}.fz056 .spin{width:13px;height:13px;border-radius:50%;border:2.4px solid var(--green,#4f7233);border-top-color:transparent;animation:fz056spin 6s linear infinite}@keyframes fz056spin{to{transform:rotate(360deg)}}.fz056 .lseq{margin-top:5px;font-size:clamp(12px,1.55vw,14.5px);color:var(--ink-soft,#3c362c)}.fz056 .tags{margin-top:11px;display:flex;flex-wrap:wrap;gap:7px}.fz056 .tag{padding:5px 12px;border-radius:13px;background:var(--cyan-bg,#dcebed);border:1px solid var(--cyan-bd,#8fbcc4);font-size:clamp(11.5px,1.5vw,13.5px);color:var(--cyan,#3f6d79);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);opacity:.55;animation:fz056tag 7.2s ease-in-out infinite}.fz056 .tag:nth-child(1){animation-delay:0s}.fz056 .tag:nth-child(2){animation-delay:1.8s}.fz056 .tag:nth-child(3){animation-delay:3.6s}.fz056 .tag:nth-child(4){animation-delay:5.4s}@keyframes fz056tag{0%,100%{opacity:.5}30%{opacity:1;box-shadow:0 0 0 2px rgba(63,109,121,.16)}60%{opacity:.6}}.fz056 .fb{margin:11px 0 2px;display:flex;align-items:center;gap:9px;font-size:clamp(11.5px,1.5vw,13.5px);color:var(--cyan,#3f6d79);font-style:italic}.fz056 .fbline{flex:1;height:2px;border-radius:2px;background:linear-gradient(90deg,var(--cyan,#3f6d79),var(--cyan,#3f6d79) 40%,rgba(255,255,255,.8) 50%,var(--cyan,#3f6d79) 60%,var(--cyan,#3f6d79));background-size:220% 100%;animation:fz056fb 4.2s linear infinite}@keyframes fz056fb{to{background-position:200% 0}}.fz056 .fb .ret{font-weight:700}.fz056 .props{margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.fz056 .prop{padding:12px 13px;border-radius:13px;border:1.4px solid var(--hair,rgba(26,24,21,.18));background:#f7f1e4;animation:fz056lift 9s ease-in-out infinite}.fz056 .prop:nth-child(2){animation-delay:3s}.fz056 .prop:nth-child(3){animation-delay:6s}@keyframes fz056lift{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}.fz056 .prop.a{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-bd,#d9b66a)}.fz056 .prop.g{background:var(--green-bg,#e7eedd);border-color:#9bbf7f}.fz056 .prop.p{background:var(--purple-bg,#e6e7f3);border-color:var(--purple-bd,#a9adcf)}.fz056 .pt{font-size:clamp(14px,1.9vw,19px);font-weight:700}.fz056 .prop.a .pt{color:var(--amber,#9a6516)}.fz056 .prop.g .pt{color:var(--green,#4f7233)}.fz056 .prop.p .pt{color:var(--purple,#54579a)}.fz056 .pd{margin-top:5px;font-size:clamp(11.5px,1.5vw,13px);color:var(--muted,#6a6155);line-height:1.45}@media(max-width:560px){.fz056 .flow{flex-direction:column}.fz056 .arr{flex:0 0 18px;width:14px;align-self:center;height:18px;transform:rotate(90deg)}.fz056 .props{grid-template-columns:1fr}}@media (prefers-reduced-motion:reduce){.fz056 .arr::before,.fz056 .fbline,.fz056 .tag,.fz056 .prop,.fz056 .spin,.fz056 .loop::after{animation:none}.fz056 .arr::before{background:var(--ac,#5a8fd8)}.fz056 .tag{opacity:1}.fz056 .fbline{background:var(--cyan,#3f6d79)}.fz056 .spin{border-top-color:var(--green,#4f7233)}}</style><div class="hd">CLI Agent 的典型执行回路</div><div class="sub">以 Claude Code、Codex CLI 为代表，AI 已经进入终端，开始围绕工程任务持续循环：读代码、跑命令、改文件、看结果。</div><div class="panel"><div class="flow"><div class="node start">用户下达任务</div><div class="arr am"></div><div class="node">读取仓库与计划</div><div class="arr cy"></div><div class="node">执行命令 / 搜索</div><div class="arr cy"></div><div class="node">编辑文件 / 跑测试</div></div><div class="loop"><div class="lt"><span class="spin"></span>Agent Loop</div><div class="lseq">读文件 → 分析输出 → 调整命令 → 改代码 → 重跑测试 → 继续迭代</div><div class="tags"><span class="tag">文件系统上下文</span><span class="tag">终端输出</span><span class="tag">测试结果</span><span class="tag">git 状态</span></div></div><div class="fb"><span class="ret">结果回流</span><span class="fbline"></span><span>编辑 / 测试结果回到 Agent Loop，继续下一轮迭代</span></div><div class="props"><div class="prop a"><div class="pt">权限与审批</div><div class="pd">修改文件、联网、危险命令前请求许可</div></div><div class="prop g"><div class="pt">可恢复性</div><div class="pd">diff、提交记录、分支与回滚路径都更清晰</div></div><div class="prop p"><div class="pt">为什么 CLI 关键</div><div class="pd">因为工程师本来就在这里 build / test / git</div></div></div></div></figure>

## 5. 第五阶段：多代理和自动化，AI 开始处理长任务

最近这一阶段，真正新的地方不是“又多了几个 AI 编程工具”，而是：

- AI 不再只处理眼前这一个对话
- 开始把一个任务拆成多个并行子任务
- 开始在后台持续运行
- 开始接手可重复的日常工程动作

如果看官方资料，这条线在 `Cursor` 和 `OpenAI Codex` 上已经很清楚。

到 `2026-04-02` 的 `Agents Window`，`Cursor` 官方已经在强调：

- 多代理并行
- 多 repo / 多环境
- 本地、云端、远程 SSH、worktree 联动

而在 `2025-05-15` 的 [0.50 更新](https://cursor.com/cn/changelog/0-50) 里，`Background Agent` 也已经被 Cursor 直接定义成用于 `parallel task execution` 的能力。

`OpenAI Codex` 这边也一样。`2025-05-16` 的官方介绍页已经把 Codex 定义成：

- 能并行处理多个任务的云端软件工程 Agent
- 每个任务运行在独立 cloud sandbox 中

到 `2026-02-02` 的 [Codex app](https://openai.com/index/introducing-the-codex-app/) ，OpenAI 更是把这条线写得更完整了：

- 可以 `parallel` 地和多个 agents 一起工作
- 可以把 `recurring work` 交给 `automations`
- 自动化会按设定时间在后台运行，并把结果送回 review queue

我觉得这一步很关键，因为它意味着 AI 编程开始从“交互式辅助”走向“持续性执行”。

以前更像这样：

- 我问一次
- AI 回一次
- 我再决定下一步

现在更像这样：

- 我定义一个较大的目标
- AI 拆成多个任务并行推进
- 一部分任务在后台慢慢跑
- 一部分重复性工作被做成自动化
- 我在关键节点回来审查结果和纠偏

所以第五阶段真正发生的变化不是“产品变多了”，而是：

**AI 开始从一次性回答工具，变成能并行处理、后台运行、重复执行的软件工程执行系统。**

<figure class="fz057" data-reveal role="group" aria-label="多代理和自动化阶段：同一个共享 Agent 体系并行驱动 Web、IDE、CLI、Desktop、Automations、External 等界面，并提供 Rules、Memory、MCP、Sandbox、Approvals 运行时能力"><style>.fz057{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--amber:#9a6516;--amber-bg:#f4e8cc;--amber-bd:#d9b66a;--teal:#3f6d79;--teal-bg:#dcebed;--teal-bd:#8fbcc4;--green:#4f7233;--green-bg:#e7eedd;--green-bd:#7c9c54;--purple:#54579a;--purple-bg:#e6e7f3;--purple-bd:#a9adcf;--grey:#917f5c;--grey-bg:#ece4d2;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(160deg,var(--paper-soft),#f7f1e4 60%,var(--paper-deep));border:1px solid var(--hair);border-radius:14px;padding:clamp(16px,3.2vw,30px);margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz057 *{box-sizing:border-box}.fz057 .hd{margin-bottom:18px}.fz057 .ttl{font-size:clamp(17px,2.5vw,25px);font-weight:700;line-height:1.35;color:var(--ink);letter-spacing:.2px}.fz057 .sub{font-size:clamp(12px,1.55vw,15px);color:var(--muted);line-height:1.6;margin-top:7px}.fz057 .core{position:relative;display:grid;grid-template-columns:1fr minmax(220px,300px) 1fr;grid-template-areas:"nw center ne" "ww center ee" "sw center se";gap:clamp(8px,1.4vw,16px);align-items:center;margin:6px 0}.fz057 .node{border-radius:16px;border:2px solid var(--hair);padding:11px 14px;background:var(--paper-soft);position:relative;min-width:0;animation:fz057pulse 9s ease-in-out infinite}.fz057 .node .nm{font-size:clamp(15px,2vw,21px);font-weight:700;line-height:1.1;letter-spacing:.3px}.fz057 .node .ds{font-size:clamp(10.5px,1.35vw,13px);color:var(--muted);line-height:1.5;margin-top:5px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz057 .n-web{grid-area:nw;background:var(--amber-bg);border-color:var(--amber-bd);animation-delay:0s}.fz057 .n-web .nm{color:var(--amber)}.fz057 .n-ide{grid-area:sw;background:var(--teal-bg);border-color:var(--teal-bd);animation-delay:1.4s}.fz057 .n-ide .nm{color:var(--teal)}.fz057 .n-cli{grid-area:ne;background:var(--green-bg);border-color:var(--green-bd);animation-delay:2.8s}.fz057 .n-cli .nm{color:var(--green)}.fz057 .n-desk{grid-area:se;background:var(--purple-bg);border-color:var(--purple-bd);animation-delay:4.2s}.fz057 .n-desk .nm{color:var(--purple)}.fz057 .n-auto{grid-area:ww;background:var(--grey-bg);border-color:var(--hair);animation-delay:5.6s}.fz057 .n-auto .nm{color:var(--grey)}.fz057 .n-ext{grid-area:ee;background:var(--grey-bg);border-color:var(--hair);animation-delay:7s}.fz057 .n-ext .nm{color:var(--grey)}.fz057 .hub{grid-area:center;justify-self:center;align-self:center;width:clamp(180px,26vw,240px);aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle at 50% 42%,#eef3fb,var(--paper-soft));border:3px solid var(--teal-bd);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;z-index:3;box-shadow:0 0 0 0 rgba(63,109,121,.22);animation:fz057ring 9s ease-in-out infinite}.fz057 .hub .ht{font-size:clamp(15px,2.2vw,22px);font-weight:700;color:#2a4e79;line-height:1.2}.fz057 .hub .hs{font-size:clamp(11px,1.5vw,15px);color:#41596e;margin-top:3px}.fz057 .rt{margin-top:9px;background:var(--paper-soft);border:1px solid var(--teal-bd);border-radius:10px;padding:6px 10px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(9px,1.15vw,11px);line-height:1.5;color:#41596e}.fz057 .rt b{font-weight:700;color:var(--teal)}.fz057 .flows{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin:16px 0 6px}.fz057 .fl{height:6px;border-radius:6px;background:var(--hair);position:relative;overflow:hidden}.fz057 .fl::after{content:"";position:absolute;inset:0;width:42%;border-radius:6px;background:linear-gradient(90deg,transparent,currentColor,transparent);animation:fz057flow 3.4s linear infinite}.fz057 .fl.f1{color:var(--amber)}.fz057 .fl.f2{color:var(--teal);animation-delay:0}.fz057 .fl.f2::after{animation-delay:.55s}.fz057 .fl.f3::after{animation-delay:1.1s}.fz057 .fl.f3{color:var(--green)}.fz057 .fl.f4::after{animation-delay:1.65s}.fz057 .fl.f4{color:var(--purple)}.fz057 .fl.f5::after{animation-delay:2.2s}.fz057 .fl.f5{color:var(--grey)}.fz057 .fl.f6::after{animation-delay:2.75s}.fz057 .fl.f6{color:var(--grey)}.fz057 .lg{display:flex;flex-wrap:wrap;gap:6px 14px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(9.5px,1.2vw,11.5px);color:var(--muted);margin-top:4px}.fz057 .lg span{display:inline-flex;align-items:center;gap:5px}.fz057 .lg i{width:14px;height:4px;border-radius:3px;display:inline-block}.fz057 .foot{margin-top:16px;padding-top:13px;border-top:1px dashed var(--hair);font-size:clamp(11.5px,1.5vw,14px);color:var(--ink-soft);line-height:1.65}.fz057 .foot b{color:var(--ink);font-weight:700}@keyframes fz057flow{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}@keyframes fz057pulse{0%,100%{transform:translateY(0);box-shadow:0 1px 0 rgba(0,0,0,0)}45%{transform:translateY(-3px);box-shadow:0 6px 16px rgba(26,24,21,.09)}}@keyframes fz057ring{0%,100%{box-shadow:0 0 0 0 rgba(63,109,121,.22)}50%{box-shadow:0 0 0 14px rgba(63,109,121,0)}}@media (max-width:560px){.fz057 .core{grid-template-columns:1fr 1fr;grid-template-areas:"center center" "nw ne" "ww ee" "sw se";gap:9px}.fz057 .hub{width:clamp(150px,52vw,200px);margin:0 auto 4px}.fz057 .flows{grid-template-columns:repeat(3,1fr)}}@media (prefers-reduced-motion:reduce){.fz057 .node,.fz057 .hub{animation:none}.fz057 .node{transform:none;box-shadow:none}.fz057 .hub{box-shadow:0 0 0 4px rgba(63,109,121,.16)}.fz057 .fl::after{animation:none;left:0;width:100%;background:currentColor;opacity:.5}}</style><div class="hd"><div class="ttl">多代理和自动化阶段，AI 开始处理并行与重复任务</div><div class="sub">重点不再只是聊天或补全，而是把任务拆开、放到后台运行，并把重复性工作做成可审查的自动化。</div></div><div class="core"><div class="node n-web"><div class="nm">Web</div><div class="ds">问答、委派、长任务看板</div></div><div class="node n-cli"><div class="nm">CLI</div><div class="ds">build / test / git / ssh</div></div><div class="node n-auto"><div class="nm">Automations</div><div class="ds">定时 triage、日报、CI 摘要与重复任务</div></div><div class="hub"><div class="ht">共享 Agent</div><div class="hs">运行时能力</div><div class="rt"><b>Rules / Memory / MCP</b><br>Sandbox / Approvals</div></div><div class="node n-ext"><div class="nm">External</div><div class="ds">GitHub / Slack / Figma / Docs / CI / MCP Servers</div></div><div class="node n-ide"><div class="nm">IDE</div><div class="ds">读仓库、改文件、看 diff</div></div><div class="node n-desk"><div class="nm">Desktop</div><div class="ds">多代理管理与通知中心</div></div></div><div class="flows"><div class="fl f1"></div><div class="fl f3"></div><div class="fl f5"></div><div class="fl f6"></div><div class="fl f2"></div><div class="fl f4"></div></div><div class="lg"><span><i style="background:var(--amber)"></i>Web</span><span><i style="background:var(--green)"></i>CLI</span><span><i style="background:var(--teal)"></i>IDE</span><span><i style="background:var(--purple)"></i>Desktop</span><span><i style="background:var(--grey)"></i>Automations · External</span></div><div class="foot"><b>真正的新阶段：</b>不是又多一个聊天框，而是同一个 Agent 体系开始并行处理任务，并把重复工作做成后台自动化。</div></figure>

## 6. 第六阶段：浏览器和电脑操作，AI 开始进入真实工作环境

如果说第五阶段解决的是“任务能不能并行、后台、持续地跑”，那接下来这一步解决的是另一个问题：

**AI 能不能进入人真正工作的那些界面。**

这里的界面，不只是代码编辑器和终端，而是：

- 浏览器
- 网页后台
- DevTools 和请求链路
- 公司内部研发平台
- 桌面应用
- 系统窗口和本机文件

OpenAI 在 `2026-04-16` 的 [Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/) 里，把这条线写得很直接：Codex 开始通过 `background computer use` 看屏幕、点击、输入，并且在 Codex app 里加入内置浏览器。官方同时提到，这类能力对前端迭代、应用测试，以及那些没有 API 的工具尤其有用。

这一步的变化很大。

以前即使 AI 能把代码改好，很多工程动作还是会卡在网页系统里：

- 要去平台上创建一个研发任务
- 要去需求系统里新建一个 Meego
- 要打开 BITS 绑定分支、触发流水线、查看构建结果
- 要进网页控制台复现一次操作
- 要看浏览器里真实发出的请求
- 要在一个没有开放 API 的后台系统里点几个按钮

这些动作很长一段时间都还是“人自己打开网页去做”。因为它们不在仓库里，也不在终端里，更不是一个可以直接 `curl` 的稳定接口。

现在这个边界开始松动了。

对 `Claude Code` 来说，官方文档已经把它描述成一个可以运行在终端、IDE、桌面应用和浏览器里的编码工具；同时通过 [MCP](https://code.claude.com/docs/en/mcp)，它可以接到 issue tracker、监控平台、数据库、设计工具、Slack、Google Drive 这类外部系统。更底层一点，Anthropic 的 [Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool) 也已经把“通过截图理解界面、再用鼠标和键盘操作桌面环境”定义成一类工具能力。

所以这一阶段我不会把它简单理解成“AI 又多了一个浏览器”。更准确地说，它意味着：

**AI 开始从软件工程环境，扩展到真实工作环境。**

这会让很多过去不适合交给 AI 的事情，开始进入可协作范围：

- 前端页面改完后，让 AI 自己打开页面检查视觉和交互
- 让 AI 在浏览器里复现一个 bug，再回到代码里修
- 让 AI 在网页平台上创建任务、绑定分支、触发流程
- 让 AI 抓取一次真实请求，反推前后端接口关系
- 让 AI 操作一个只有 GUI、没有 API 的工具

但这一步也更需要边界。

因为浏览器和电脑操作一旦接上真实账号、真实系统、真实数据，风险就不再只是“代码改错了”。它可能变成：

- 点错按钮
- 提交错误表单
- 触发错误流程
- 泄露敏感页面信息
- 被网页内容里的 prompt injection 误导

所以这一阶段真正成熟的标志，不只是“AI 能点鼠标”，而是下面这些能力一起出现：

- 操作前有权限确认
- 高风险动作有人审查
- 浏览器和桌面环境有沙箱
- 登录态和敏感数据有隔离
- 操作过程可以回放和追踪
- 规则能明确告诉 AI 什么不能做

也就是说，AI 进入浏览器和电脑，并不是为了把人完全挤出流程，而是把更多过去只能由人手动完成的界面操作，纳入一个可观察、可审查、可回滚的协作链路里。

<figure class="fz058" data-reveal role="group" aria-label="第六阶段：AI 进入真实工作环境，工程环境、浏览器环境、电脑环境三类执行面与新的可协作动作及安全边界"><style>.fz058{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gn:#4f7233;--gnb:#e7eedd;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--font-serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--font-mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);box-sizing:border-box;margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;font-family:var(--font-serif);color:var(--ink,#1a1815);max-width:1000px}.fz058 *{box-sizing:border-box}.fz058 .hd{margin:0 0 4px;font-size:clamp(19px,3.4vw,28px);font-weight:700;letter-spacing:.5px;color:var(--ink,#1a1815)}.fz058 .sub{margin:0 0 clamp(16px,2.6vw,24px);font-size:clamp(12.5px,1.9vw,15px);line-height:1.55;color:var(--muted,#6a6155)}.fz058 .row{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:stretch;gap:clamp(4px,1vw,10px)}.fz058 .node{border-radius:16px;border:1.5px solid;padding:clamp(12px,1.8vw,18px) clamp(11px,1.6vw,16px);opacity:0;transform:translateY(10px);animation:fz058in .7s ease forwards}.fz058 .n1{background:var(--cyb,#dcebed);border-color:var(--cye,#8fbcc4);animation-delay:.1s}.fz058 .n2{background:var(--gnb,#e7eedd);border-color:var(--gn,#4f7233);animation-delay:.45s}.fz058 .n3{background:var(--amb,#f4e8cc);border-color:var(--ame,#d9b66a);animation-delay:.8s}.fz058 .nt{font-size:clamp(15px,2.3vw,21px);font-weight:700;margin:0 0 8px}.fz058 .n1 .nt{color:#2b4f5a}.fz058 .n2 .nt{color:#2e4d22}.fz058 .n3 .nt{color:#7a3f18}.fz058 .nl{display:block;font-family:var(--font-mono);font-size:clamp(11px,1.6vw,13.5px);line-height:1.7;color:var(--ink-soft,#3c362c);opacity:.92}.fz058 .conn{display:flex;align-items:center;justify-content:center;min-width:26px;position:relative}.fz058 .flow{position:relative;width:100%;height:5px;border-radius:3px;background:linear-gradient(90deg,var(--ame,#d9b66a),var(--am,#9a6516));overflow:hidden;margin-right:9px}.fz058 .flow::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,249,240,.85),transparent);width:45%;animation:fz058flow 5.5s ease-in-out infinite}.fz058 .c2 .flow::before{animation-delay:1.6s}.fz058 .ah{width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:11px solid var(--am,#9a6516);flex:0 0 auto}.fz058 .act{margin-top:clamp(16px,2.6vw,24px);background:#fff;border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:16px;padding:clamp(14px,2.2vw,22px)}.fz058 .actt{font-size:clamp(15px,2.3vw,21px);font-weight:700;margin:0 0 clamp(10px,1.6vw,16px);color:var(--ink,#1a1815)}.fz058 .grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(8px,1.6vw,16px) clamp(16px,3vw,34px)}.fz058 .li{position:relative;padding-left:24px;font-size:clamp(12.5px,1.9vw,15.5px);line-height:1.5;color:var(--ink-soft,#3c362c);opacity:0;animation:fz058li .6s ease forwards}.fz058 .li::before{content:"";position:absolute;left:2px;top:.5em;width:9px;height:9px;border-radius:50%;background:var(--cy,#3f6d79);box-shadow:0 0 0 0 var(--cye,#8fbcc4);animation:fz058pulse 6s ease-in-out infinite}.fz058 .li:nth-child(1){animation-delay:1.1s}.fz058 .li:nth-child(2){animation-delay:1.3s}.fz058 .li:nth-child(3){animation-delay:1.5s}.fz058 .li:nth-child(4){animation-delay:1.7s}.fz058 .li:nth-child(2)::before{animation-delay:1.5s}.fz058 .li:nth-child(3)::before{animation-delay:3s}.fz058 .li:nth-child(4)::before{animation-delay:4.5s}.fz058 .concl{margin-top:clamp(14px,2.2vw,20px);background:var(--ink,#1a1815);color:var(--paper-soft,#faf6ec);border-radius:13px;padding:clamp(13px,2vw,18px) clamp(15px,2.4vw,22px);font-size:clamp(13px,2vw,17px);font-weight:700;line-height:1.5;letter-spacing:.3px}.fz058 .concl b{color:var(--ame,#d9b66a);font-weight:700}@keyframes fz058in{to{opacity:1;transform:translateY(0)}}@keyframes fz058li{to{opacity:1}}@keyframes fz058flow{0%{transform:translateX(-130%)}55%,100%{transform:translateX(330%)}}@keyframes fz058pulse{0%,100%{box-shadow:0 0 0 0 rgba(63,109,121,.35)}50%{box-shadow:0 0 0 6px rgba(63,109,121,0)}}@media(max-width:560px){.fz058 .row{grid-template-columns:1fr;gap:8px}.fz058 .conn{min-height:24px}.fz058 .flow{margin:0;height:100%;min-height:20px;width:5px;background:linear-gradient(180deg,var(--ame,#d9b66a),var(--am,#9a6516))}.fz058 .flow::before{width:100%;height:45%;background:linear-gradient(180deg,transparent,rgba(255,249,240,.85),transparent);animation:fz058flowv 5.5s ease-in-out infinite}.fz058 .c2 .flow::before{animation-delay:1.6s}.fz058 .ah{border-left:6px solid transparent;border-right:6px solid transparent;border-top:11px solid var(--am,#9a6516);border-bottom:0}.fz058 .grid{grid-template-columns:1fr}}@keyframes fz058flowv{0%{transform:translateY(-130%)}55%,100%{transform:translateY(330%)}}@media(prefers-reduced-motion:reduce){.fz058 .node,.fz058 .li{animation:none;opacity:1;transform:none}.fz058 .flow::before,.fz058 .li::before{animation:none}.fz058 .flow::before{display:none}}</style><div class="hd">第六阶段：AI 进入真实工作环境</div><div class="sub">浏览器、网页后台、桌面应用和真实账号系统，开始成为 Agent 可以观察和操作的执行面。</div><div class="row"><div class="node n1"><div class="nt">工程环境</div><span class="nl">仓库、终端、测试</span><span class="nl">Git、PR、CI 日志</span></div><div class="conn c1"><span class="flow"></span><span class="ah"></span></div><div class="node n2"><div class="nt">浏览器环境</div><span class="nl">网页后台、DevTools</span><span class="nl">表单、请求、控制台</span></div><div class="conn c2"><span class="flow"></span><span class="ah"></span></div><div class="node n3"><div class="nt">电脑环境</div><span class="nl">截图、点击、输入</span><span class="nl">桌面应用、本机窗口</span></div></div><div class="act"><div class="actt">新的可协作动作</div><div class="grid"><div class="li">创建 BITS、创建 Meego、绑定分支、触发流水线</div><div class="li">操作没有 API 的后台系统和桌面工具</div><div class="li">打开页面复现问题，观察真实请求，再回到代码里修复</div><div class="li">把网页状态、截图、命令结果放回同一个任务链路</div></div></div><div class="concl">关键不是“能点鼠标”，而是<b>操作可确认、过程可追踪、结果可审查、风险可隔离</b>。</div></figure>

## 7. 这几年真正变了什么

如果只挑最本质的变化，我觉得是下面五件事。

### 7.1 上下文来源变了

- 网页对话时代：上下文靠手工粘贴
- Tab 补全时代：上下文主要来自当前文件和光标附近
- 仓库级 IDE 时代：上下文扩展到整个代码库
- CLI / 多代理 / 自动化时代：上下文扩展到仓库、终端、测试、PR、规则、历史任务、外部工具
- 浏览器 / 电脑操作时代：上下文继续扩展到网页、请求、后台系统、桌面应用和真实操作结果

### 7.2 动作能力变了

- 一开始，AI 只能回答
- 后来，它能补全
- 再后来，它能改文件
- 再往后，它能读代码、跑命令、过测试、提 PR、并行做多件事
- 现在，它开始能打开网页、填写表单、查看请求、操作桌面应用

### 7.3 人的角色变了

- 最开始，开发者是“提问的人”
- 然后是“接收补全的人”
- 接着变成“给任务、审改动的人”
- 再往后，更像是“给目标、设边界、做 review、做仲裁的人”
- 到浏览器和电脑操作阶段，人还要负责审批高风险动作、保护账号和敏感数据

### 7.4 工具形态也变了

过去我们会问：

- 哪个模型更强？
- 哪个补全更准？

现在更常见的问题已经变成：

- 它能不能读我的整个仓库？
- 它能不能调用终端和外部工具？
- 它有没有规则、记忆、审批和沙箱？
- 它能不能和 IDE、CLI、云端任务、后台自动化打通？
- 它能不能进入浏览器和桌面应用，完成那些没有 API 的真实流程？

也就是说，竞争点已经从“回答质量”逐步转向“上下文组织能力 + 执行能力 + 安全边界 + 工作流整合能力”。

### 7.5 执行边界变了

过去 AI 编程工具的边界基本围绕代码展开：

- 代码文件
- 终端命令
- 测试结果
- Git 历史
- PR 评论

但很多真实工作流并不只在这些地方发生。

一个软件工程任务从想法到上线，中间往往还会穿过需求系统、项目管理平台、CI/CD 页面、监控后台、权限系统、工单系统、设计稿、文档和各种内部网页。

浏览器和电脑操作的意义就在这里：

**AI 开始有机会把这些原本断开的界面串起来。**

这也解释了为什么我会把它单独列成第六阶段。它不是第五阶段“后台执行”的重复，而是把执行范围从工程工具链继续往外推了一层。

## 8. 我的结论

回头看这条路，我会把每一阶段概括成一句话：

- `ChatGPT` 让普通人第一次学会了怎么和 AI 说话
- `GitHub Copilot` 让 AI 进入了击键流，变成随时可用的补全器
- `Cursor` 让 AI 从“写下一行”升级成“先读仓库再改代码”的 IDE Agent
- `Claude Code`、`Codex CLI` 让 AI 真正进入终端，成为工程执行面上的协作者
- `Codex`、`Cursor` 等新一代产品，则开始把多代理、后台执行、自动化、规则、记忆和工具系统拼成一套完整工作流
- 带有浏览器和 `Computer Use` 能力的 Agent，让 AI 开始进入网页系统和桌面环境，连接真实工作流

所以，今天再看“我在用哪个 AI 编程工具”这个问题，已经不太够了。

更值得问的问题其实是：

**你的 AI 现在能看到多少上下文，能做多少动作，能不能在可控边界里持续把任务推进下去。**

这才是这几年真正发生的跃迁。

## 参考资料

下面这些链接，我优先选的是官方产品页、官方文档和官方博客：

- OpenAI, `2022-11-30`：[Introducing ChatGPT](https://openai.com/index/chatgpt/)
- GitHub, `2021-06-29`：[Introducing GitHub Copilot: your AI pair programmer](https://github.blog/news-insights/product-news/introducing-github-copilot-ai-pair-programmer/)
- GitHub, `2023-05-17`：[How GitHub Copilot is getting better at understanding your code](https://github.blog/ai-and-ml/github-copilot/how-github-copilot-is-getting-better-at-understanding-your-code/)
- Cursor Docs：[Codebase Indexing](https://docs.cursor.com/chat/codebase)
- Cursor, `2025-02-19`：[Agent is ready and UI refresh](https://www.cursor.com/en/changelog/agent-is-ready-and-ui-refresh)
- Cursor, `2025-05-15`：[0.50 更新：Background Agent 等能力](https://cursor.com/cn/changelog/0-50)
- Cursor, `2026-04-02`：[Cursor Changelog / Agents Window](https://cursor.com/changelog)
- Anthropic, `2025-02-27`：[AI agents in the Enterprise](https://www.anthropic.com/webinars/ai-agents-in-enterprise)
- Anthropic Docs：[Claude Code Quickstart](https://code.claude.com/docs/en/quickstart)
- Anthropic：[Claude Code Product Page](https://www.anthropic.com/product/claude-code)
- OpenAI, `2025-05-16`：[Introducing Codex](https://openai.com/index/introducing-codex/)
- OpenAI, `2026-02-02`：[Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- OpenAI, `2026-04-16`：[Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/)
- Anthropic Docs：[Claude Code overview](https://code.claude.com/docs)
- Anthropic Docs：[Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- Anthropic Docs：[Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
