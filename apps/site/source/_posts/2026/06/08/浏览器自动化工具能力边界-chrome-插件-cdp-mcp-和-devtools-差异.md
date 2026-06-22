---
title: "浏览器 Agent 工具怎么选：从 Agent 友好度看 Chrome 插件、CDP、MCP、DevTools、Playwright 和 bb-browser"
date: 2026-06-08 20:02:00
categories:
  - 技术
tags:
  - Chrome
  - CDP
  - MCP
  - DevTools
  - Browser Automation
  - Agent
  - 浏览器插件
  - 性能分析
excerpt: "从 Agent 的任务流出发，比较 Codex @chrome、agent-browser、bb-browser、Chrome DevTools MCP、Puppeteer 和 Playwright 在页面观察、点击输入、Network 排障、性能分析、真实登录态、扩展调试和 site adapter 上的友好度。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

这篇文章比较浏览器 Agent 工具时，只看一个核心问题：**哪个工具能让 Agent 更容易完成任务**。

这里的“容易”包括几件事：Agent 能否快速知道页面上有什么，能否用稳定引用点击按钮，能否复用真实登录态，能否看到请求和响应，能否拿到性能诊断结果，能否把常用网站动作沉淀成命令，以及出错后能否复盘。

所以本文比较的主线会从“工具内部站在哪一层”改成“Agent 在实际任务里需要什么入口”。`@chrome`、agent-browser、bb-browser、Chrome DevTools MCP、Puppeteer 和 Playwright 都能控制浏览器，但它们对 Agent 的友好点差别很大。

## 0. 先定义：什么叫 Agent 友好

人类操作浏览器时，已经知道页面含义。人会看见“登录”按钮，然后手动点击。

Agent 的起点更早。它先要把页面变成可理解的上下文，再决定下一步动作。

一个浏览器工具对 Agent 友好，通常体现在这些维度：

| Agent 需要什么 | 友好工具会怎么做 | 为什么重要 |
| --- | --- | --- |
| 看懂当前页面 | 输出短快照、可访问性树、可交互元素列表 | 降低上下文消耗 |
| 稳定选择动作 | 给按钮、输入框、链接编号，例如 `@e3` | 避免 Agent 猜 selector |
| 执行动作后复盘 | 点击、输入、导航后重新观察页面 | 让 Agent 形成闭环 |
| 复用真实状态 | 接入真实 Chrome profile、Cookie、登录态 | 避免重复登录和验证码 |
| 看请求和错误 | 提供 Network、Console、error 列表 | 方便排查页面失败 |
| 生成结构化结果 | 把网站动作整理成 JSON 或命令 | 减少页面阅读和二次解析 |
| 控制风险 | 对高权限操作做授权、隔离、只读限制 | 保护真实浏览器状态 |

从这个角度看，最关键的问题变成：

**这个工具把浏览器的哪一层能力，压成了 Agent 容易调用、容易理解、容易复盘的接口？**

<figure class="fz092" data-reveal role="group" aria-label="浏览器多层能力面分层图：网页面、Chrome 插件面、CDP 调试面、DevTools 产品面、站点适配面五层及对应工具"><style>.fz092{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(18px,3.4vw,32px);margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz092 *{box-sizing:border-box}.fz092 .hd{margin-bottom:1.1em}.fz092 .t1{font-weight:700;font-size:clamp(19px,3.2vw,30px);line-height:1.25;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz092 .t2{margin-top:.5em;font-size:clamp(12px,1.7vw,15px);color:var(--muted,#6a6155);line-height:1.5}.fz092 .stack{display:flex;flex-direction:column;gap:0;background:#f7f1e4;border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:12px;padding:clamp(12px,2.4vw,22px)}.fz092 .lay{position:relative;border:1px solid;border-radius:11px;padding:clamp(11px,1.9vw,16px) clamp(13px,2.2vw,20px);display:flex;flex-wrap:wrap;align-items:center;gap:.5em 1em;opacity:0;transform:translateY(10px);animation:fz092in .7s ease forwards}.fz092 .lay .lt{font-weight:700;font-size:clamp(13px,1.95vw,18px);line-height:1.35;flex:1 1 60%;min-width:0}.fz092 .lay .tag{font-family:var(--font-mono,ui-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,13px);white-space:nowrap;padding:.22em .6em;border-radius:6px;border:1px solid;flex:0 0 auto}.fz092 .l1{background:var(--bl-bg,#dde6f4);border-color:var(--bl-bd,#9bb2da);animation-delay:.05s}.fz092 .l1 .lt{color:var(--bl,#2f5fb0)}.fz092 .l1 .tag{color:var(--bl,#2f5fb0);background:#e8eefa;border-color:var(--bl-bd,#9bb2da)}.fz092 .l2{background:var(--gn-bg,#e7eedd);border-color:var(--gn-hi,#7c9c54);animation-delay:.15s}.fz092 .l2 .lt{color:var(--gn,#4f7233)}.fz092 .l2 .tag{color:var(--gn,#4f7233);background:#eef3e3;border-color:var(--gn-hi,#7c9c54)}.fz092 .l3{background:var(--am-bg,#f4e8cc);border-color:var(--am-bd,#d9b66a);animation-delay:.25s}.fz092 .l3 .lt{color:var(--am,#9a6516)}.fz092 .l3 .tag{color:var(--am,#9a6516);background:#f8efd6;border-color:var(--am-bd,#d9b66a)}.fz092 .l4{background:var(--rd-bg,#f1ddd6);border-color:var(--rd-bd,#cf9b90);animation-delay:.35s}.fz092 .l4 .lt{color:var(--rd,#8f2d20)}.fz092 .l4 .tag{color:var(--rd,#8f2d20);background:#f6e4dd;border-color:var(--rd-bd,#cf9b90)}.fz092 .l5{background:var(--pu-bg,#e6e7f3);border-color:var(--pu-bd,#a9adcf);animation-delay:.45s}.fz092 .l5 .lt{color:var(--pu,#54579a)}.fz092 .l5 .tag{color:var(--pu,#54579a);background:#edeef6;border-color:var(--pu-bd,#a9adcf)}.fz092 .arr{position:relative;height:clamp(20px,3vw,28px);margin:0 auto;width:2px;flex:0 0 auto;overflow:hidden}.fz092 .arr i{position:absolute;left:50%;top:0;width:2px;height:100%;transform:translateX(-50%);background:linear-gradient(180deg,var(--ink-soft,#3c362c) 0%,var(--ink-soft,#3c362c) 50%,transparent 50%,transparent 100%);background-size:100% 8px;animation:fz092flow 9s linear infinite}.fz092 .arr i::after{content:"";position:absolute;left:50%;bottom:-1px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid var(--ink-soft,#3c362c)}.fz092 .arrwrap{display:flex;justify-content:center}.fz092 .ft{margin-top:1em;font-size:clamp(11px,1.6vw,14px);color:var(--ink-soft,#3c362c);line-height:1.55}.fz092 .ft b{color:var(--ink,#1a1815);font-weight:700}@keyframes fz092in{to{opacity:1;transform:translateY(0)}}@keyframes fz092flow{to{background-position:0 80px}}@media (max-width:560px){.fz092 .lay{flex-direction:column;align-items:flex-start;gap:.4em}.fz092 .lay .lt{flex:1 1 auto}.fz092 .lay .tag{align-self:flex-start}}@media (prefers-reduced-motion:reduce){.fz092 .lay{opacity:1;transform:none;animation:none}.fz092 .arr i{animation:none;background:var(--ink-soft,#3c362c)}}</style><div class="hd"><div class="t1">浏览器不是一个平面，而是多层能力面</div><div class="t2">同样叫浏览器自动化，真正差异在它站在哪一层。</div></div><div class="stack"><div class="lay l1"><span class="lt">网页面：DOM、点击、输入、截图、可访问性树</span><span class="tag">Playwright / Puppeteer</span></div><div class="arrwrap"><span class="arr"><i></i></span></div><div class="lay l2"><span class="lt">Chrome 插件面：书签、历史、侧边栏、扩展自己的 UI</span><span class="tag">@chrome / chrome.*</span></div><div class="arrwrap"><span class="arr"><i></i></span></div><div class="lay l3"><span class="lt">CDP 调试面：Network、Runtime、Target、Page、Trace</span><span class="tag">agent-browser / CDP</span></div><div class="arrwrap"><span class="arr"><i></i></span></div><div class="lay l4"><span class="lt">DevTools 产品面：Performance、Lighthouse、Trace insight</span><span class="tag">Chrome DevTools MCP</span></div><div class="arrwrap"><span class="arr"><i></i></span></div><div class="lay l5"><span class="lt">站点适配面：把具体网站封装成稳定命令</span><span class="tag">bb-browser site</span></div></div><div class="ft">判断工具能力时，先看它<b>接入哪一层</b>，再看它<b>暴露了多少安全子集</b>。</div></figure>

## 1. 一张表先看结论：它们分别对 Agent 友好在哪

| 工具 | 对 Agent 最友好的地方 | Agent 使用时的主要限制 |
| --- | --- | --- |
| Codex `@chrome` | 直接接入用户真实 Chrome，适合已登录页面、真实 tab、截图和页面操作 | 当前产品暴露的是安全子集，Network 面板级请求列表和有副作用 `evaluate` 较弱 |
| agent-browser | 面向 Agent 的 CLI：短快照、`@eN` 引用、网络记录、请求拦截、HAR、会话和 profile | 高权限 CDP 入口需要管理授权、profile 和连接状态 |
| bb-browser | 把固定网站封装成命令，直接返回结构化 JSON；适合把调研和业务动作产品化 | adapter 跟网站结构强绑定，网站改版后要维护 |
| Chrome DevTools MCP | 把 F12 的 Network、Console、Performance、Lighthouse 诊断工具交给 Agent | 更偏调试和诊断，日常页面操作的上下文效率通常取决于具体工具输出 |
| Playwright / Puppeteer | 自动化和测试能力成熟，等待、定位、mock、trace、CI 体系完整 | 更偏工程师脚本，Agent 往往要自己写 selector、等待和分析逻辑 |

更短的结论：

```txt
复用真实 Chrome 页面：@chrome
Agent 连续操作页面和看请求：agent-browser
把网站能力封成命令：bb-browser
像 F12 一样排查 Network / 性能：Chrome DevTools MCP
写可重复测试和 mock：Playwright
```

## 2. 页面操作：Agent 先要知道页面上有什么

Playwright 和 Puppeteer 面向工程师写脚本。工程师通常先理解页面，再写 locator：

```ts
await page.getByRole("button", { name: "登录" }).click(); // 工程师已经知道目标按钮
```

`click()` 背后包含一整套浏览器自动化细节：定位元素、等待可操作状态、滚动到视口、计算点击位置、发送鼠标事件，并处理点击后的导航或页面变化。Playwright 官方把这类等待和可操作性检查称为 actionability checks。

Agent 还多一步：它要先拿到页面快照。

```txt
工具观察页面
-> 提取可见文本、按钮、输入框、链接、弹窗
-> 给关键元素编号
-> Agent 选择动作
-> 工具执行动作
-> 再观察页面变化
```

一个典型快照长这样：

```txt
@e1 textbox "邮箱"
@e2 textbox "密码"
@e3 button "登录"
@e4 link "忘记密码"
```

Agent 接下来只要说：

```bash
click @e3
```

这个 `@e3` 是 Agent 友好的关键。工具把复杂 DOM、可访问性树、坐标和可点击节点压成 Agent 能直接选择的候选动作。

| 工具 | 页面操作对 Agent 的友好点 |
| --- | --- |
| `@chrome` | 在用户真实 Chrome tab 上操作，适合页面验证、截图、真实登录态任务 |
| agent-browser | 快照短、ref 稳定、CLI 输出省上下文，适合长轮次自动化 |
| bb-browser | 既能普通点击，也能通过 site adapter 跳过页面操作 |
| Chrome DevTools MCP | 有页面快照和点击输入工具，调试场景里可直接接 Network / Console |
| Playwright | locator 和 actionability 很成熟，适合写成稳定测试脚本 |

这里的本质区别是：人类自动化通常由人先理解页面；Agent 自动化需要工具先把页面状态告诉 Agent。

## 3. Network 排查：先看 Agent 想要什么结果

看 Network 时，Agent 可能有三类目标。

第一类是调试：刚才点击后哪个接口失败了，参数和响应是什么。

第二类是自动化：Agent 一边操作页面，一边记录、过滤、mock、导出请求。

第三类是沉淀：把已经摸清楚的网站接口，封装成一个长期可用的命令。

三类目标对应的工具不同。

| Agent 目标 | 更顺手的工具 | 原因 |
| --- | --- | --- |
| 像 F12 Network 一样排查请求 | Chrome DevTools MCP | `list_network_requests`、`get_network_request` 的心智模型最接近 DevTools |
| 自动化流程中顺手看请求、拦截请求、导出 HAR | agent-browser | `network requests`、`network route`、`network har` 直接服务 Agent 循环 |
| 反推业务接口并沉淀成命令 | bb-browser | `network --with-body`、`fetch`、site adapter 可以把接口结果整理成 JSON |
| 触发请求后看页面结果 | Codex `@chrome` | 适合点击和观察页面结果，Network 面板级详情较弱 |
| 把请求检查固化成回归测试 | Playwright | `page.on("request")`、`waitForResponse`、route/mock 更适合测试代码 |

### agent-browser 怎么处理请求

agent-browser 的网络能力更偏 Agent 自动化流程：

```bash
agent-browser network requests
agent-browser network requests --filter api
agent-browser network request <requestId>
agent-browser network route "**/analytics/**" --abort
agent-browser network route "**/api/users" --body '{"users":[]}'
agent-browser network har start
agent-browser network har stop ./trace.har
```

它适合这种节奏：

```txt
打开页面
-> Agent 点击按钮
-> 列出刚才产生的请求
-> 查看可疑请求详情
-> 必要时 mock 或 abort 请求
-> 再观察页面状态
```

所以在“Agent 自己跑验证”的场景里，agent-browser 很顺。

### bb-browser 怎么处理请求

bb-browser 也有通用 Network 能力：

```bash
bb-browser network requests
bb-browser network requests "api" --with-body --json
bb-browser network route "*analytics*" --abort
bb-browser network route "*/api/user" --body '{}'
bb-browser fetch /api/me.json
```

但 bb-browser 更有价值的地方在下一步：把请求和页面状态封成 site adapter。

比如小红书 adapter 会跳过纯 DOM 文本读取这条浅路径。它会在已登录的小红书页面里运行 adapter JS，复用当前网页的 Cookie、前端 store、路由和内部请求：

```txt
bb-browser site xiaohongshu/search "穿搭"
-> 在小红书 tab 里执行 adapter JS
-> 触发搜索页路由和 searchStore
-> 捕获 search/notes 请求响应
-> 整理标题、作者、链接、互动数据
-> 返回 JSON
```

这个设计对 Agent 很友好，因为 Agent 拿到业务结果，少处理请求行和页面节点。

### Codex `@chrome` 怎么处理请求

`@chrome` 的强项是复用用户真实 Chrome tab，完成点击、输入、截图、页面观察。它可以通过点击按钮触发网页自己的请求，然后读取页面变化。

但当前 `tab.playwright.evaluate(...)` 是只读 page scope。它更适合做页面可见状态检查，较少承担下面这些任务：

```txt
列出所有 fetch / XHR
读取 response body
mock 接口
主动发带副作用的 POST 请求
导出 HAR
```

所以 `@chrome` 更像“真实页面操作工具”，Network 诊断要交给 Chrome DevTools MCP、agent-browser、bb-browser 或 Playwright。

## 4. 性能 Trace / Lighthouse：Agent 需要诊断模型

性能分析跟普通页面操作差别很大。Agent 需要的内容远远超过几个 timing 数字，核心是能解释问题的诊断模型。

F12 Performance 面板里包含：

- Trace 事件
- Main thread task
- Layout / style / paint
- Screenshots / filmstrip
- Web Vitals lane
- Lighthouse / Performance Insights 的诊断规则

因此，Chrome DevTools MCP 在性能排查上更友好。它直接把 DevTools 的诊断工具暴露给 Agent：

| Agent 要做什么 | Chrome DevTools MCP 工具 |
| --- | --- |
| 录制页面加载过程 | `performance_start_trace` |
| 停止并保存 trace | `performance_stop_trace` |
| 分析具体 insight | `performance_analyze_insight` |
| 看请求 waterfall | `list_network_requests` / `get_network_request` |
| 做 Lighthouse 类审计 | `lighthouse_audit` |

agent-browser 和 Playwright 也能拿性能数据，甚至可以记录请求、导出 HAR、读 Performance API。它们更适合把性能检查嵌进自动化脚本或验证流程。

如果目标是让 Agent 像开发者打开 F12 一样定位性能瓶颈，Chrome DevTools MCP 更省解释成本；如果目标是把“页面加载时间小于某个阈值”写进自动化测试，Playwright 更自然。

<figure class="fz093" data-reveal role="group" aria-label="F12 性能数据不是一个 API：页面 API、CDP Network、Trace、Lighthouse、DevTools MCP 五层性能数据来自不同层的分层与汇聚示意图"><style>.fz093{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--line:#5b5446;margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft);border:1px solid var(--hair);border-radius:14px;color:var(--ink);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);box-sizing:border-box}.fz093 *{box-sizing:border-box}.fz093 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz093 .t{font-weight:700;font-size:clamp(20px,3.4vw,30px);line-height:1.18;letter-spacing:.2px}.fz093 .s{margin-top:6px;font-size:clamp(12px,1.9vw,15px);color:var(--muted);line-height:1.5}.fz093 .stage{position:relative;background:var(--paper-deep);border:1px solid var(--hair);border-radius:14px;padding:clamp(18px,2.8vw,28px)}.fz093 .grid{position:relative;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:auto;column-gap:clamp(28px,5vw,64px);row-gap:clamp(40px,6vw,64px)}.fz093 .node{position:relative;z-index:2;border-radius:12px;padding:clamp(10px,1.6vw,16px) clamp(12px,1.8vw,18px);border:1px solid;background:#f7f1e4;opacity:0;transform:translateY(8px);animation:fz093pop 9s ease-in-out infinite}.fz093 .node b{display:block;font-weight:700;font-size:clamp(14px,2.1vw,19px);line-height:1.25}.fz093 .node small{display:block;margin-top:5px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.5vw,13px);line-height:1.3}.fz093 .nb{border-color:#8fbcc4;background:#dcebed}.fz093 .nb b,.fz093 .nb small{color:#3f6d79}.fz093 .ng{border-color:#7c9c54;background:#e7eedd}.fz093 .ng b,.fz093 .ng small{color:#4f7233}.fz093 .no{border-color:#d9b66a;background:#f4e8cc}.fz093 .no b,.fz093 .no small{color:#9a6516}.fz093 .np{border-color:#cf9b90;background:#f1ddd6}.fz093 .np b,.fz093 .np small{color:#8f2d20}.fz093 .nv{border-color:#a9adcf;background:#e6e7f3}.fz093 .nv b,.fz093 .nv small{color:#54579a}.fz093 .pa{grid-column:1;grid-row:1;animation-delay:0s}.fz093 .cn{grid-column:2;grid-row:1;animation-delay:.5s}.fz093 .tr{grid-column:3;grid-row:1;animation-delay:1s}.fz093 .lh{grid-column:2;grid-row:2;animation-delay:1.5s}.fz093 .mc{grid-column:3;grid-row:2;animation-delay:2s}.fz093 .link{position:absolute;z-index:1;overflow:hidden}.fz093 .hline{height:2px;top:25%;transform:translateY(-1px)}.fz093 .l12{left:33.33%;width:clamp(28px,5vw,64px);transform:translate(-50%,-1px)}.fz093 .l23{left:66.66%;width:clamp(28px,5vw,64px);transform:translate(-50%,-1px)}.fz093 .llm{left:66.66%;width:clamp(28px,5vw,64px);top:75%;transform:translate(-50%,-1px)}.fz093 .vline{width:2px;left:83.33%;transform:translateX(-1px);top:25%;height:50%}.fz093 .rail{position:absolute;inset:0;background:var(--line);opacity:.32}.fz093 .pulse{position:absolute;background:var(--ink-soft);opacity:.55}.fz093 .hpulse{top:0;bottom:0;width:40%;animation:fz093flowx 5s linear infinite}.fz093 .vpulse{left:0;right:0;height:34%;animation:fz093flowy 5s linear infinite}.fz093 .d23{animation-delay:1.2s}.fz093 .dlm{animation-delay:2.4s}.fz093 .dv{animation-delay:3.4s}.fz093 .head{position:absolute;z-index:3;width:8px;height:8px;border-top:2px solid var(--line);border-right:2px solid var(--line)}.fz093 .hh{top:25%;transform:translateY(-5px) rotate(45deg)}.fz093 .h12{left:calc(33.33% + clamp(14px,2.5vw,32px))}.fz093 .h23{left:calc(66.66% + clamp(14px,2.5vw,32px))}.fz093 .hlm{top:75%;left:calc(66.66% + clamp(14px,2.5vw,32px));transform:translateY(-5px) rotate(45deg)}.fz093 .hv{left:83.33%;top:calc(75% - clamp(14px,2.4vw,30px));transform:translateX(-4px) rotate(135deg)}.fz093 .cap{margin-top:clamp(16px,2.6vw,24px);font-size:clamp(11px,1.7vw,14px);color:var(--ink-soft);line-height:1.55;border-left:3px solid var(--hair);padding-left:12px}@keyframes fz093pop{0%{opacity:0;transform:translateY(8px)}16%,86%{opacity:1;transform:translateY(0)}100%{opacity:1;transform:translateY(0)}}@keyframes fz093flowx{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}@keyframes fz093flowy{0%{transform:translateY(-110%)}100%{transform:translateY(260%)}}@media(max-width:560px){.fz093 .grid{grid-template-columns:1fr;row-gap:clamp(20px,5vw,28px)}.fz093 .pa,.fz093 .cn,.fz093 .tr,.fz093 .lh,.fz093 .mc{grid-column:1}.fz093 .pa{grid-row:1}.fz093 .cn{grid-row:2}.fz093 .tr{grid-row:3}.fz093 .lh{grid-row:4}.fz093 .mc{grid-row:5}.fz093 .link,.fz093 .head{display:none}}@media(prefers-reduced-motion:reduce){.fz093 .node{animation:none;opacity:1;transform:none}.fz093 .pulse{animation:none;display:none}}</style><div class="hd"><div class="t">F12 性能数据不是一个 API</div><div class="s">首屏、Network waterfall、Trace insight、Lighthouse 分数来自不同层。</div></div><div class="stage"><div class="grid"><div class="node nb pa"><b>页面 API</b><small>paint / navigation</small></div><div class="node ng cn"><b>CDP Network</b><small>headers / body / timing</small></div><div class="node no tr"><b>Trace</b><small>tasks / layout / paint</small></div><div class="node np lh"><b>Lighthouse</b><small>FCP / LCP / TBT</small></div><div class="node nv mc"><b>DevTools MCP</b><small>trace insight / network tools</small></div><div class="link hline l12"><div class="rail"></div><div class="pulse hpulse"></div></div><div class="head hh h12"></div><div class="link hline l23"><div class="rail"></div><div class="pulse hpulse d23"></div></div><div class="head hh h23"></div><div class="link hline llm"><div class="rail"></div><div class="pulse hpulse dlm"></div></div><div class="head hlm"></div><div class="link vline"><div class="rail"></div><div class="pulse vpulse dv"></div></div><div class="head hv"></div></div></div><div class="cap">同一个“首屏慢”，可能要看导航事件、paint entry、请求瀑布、主线程 trace 和 Lighthouse 诊断。</div></figure>

## 5. 真实登录态和 profile：Agent 友好也要看授权成本

Agent 经常需要操作真实登录后的页面。这里最友好的工具取决于真实状态复用、授权次数和用户打断成本。

| 场景 | 对 Agent 更友好的入口 | 原因 |
| --- | --- | --- |
| 直接操作用户当前 Chrome tab | Codex `@chrome` | 已经在用户真实 Chrome 里，登录态和 tab 都在 |
| 长时间自动化一个真实浏览器 | agent-browser / bb-browser | daemon + CDP + profile 更适合持续任务 |
| 连接当前默认 profile 做 CDP 调试 | agent-browser / Chrome DevTools MCP auto-connect | 需要接受 Chrome remote debugging 授权边界 |
| CI 或隔离测试 | Playwright / Puppeteer / Chrome for Testing | 独立 profile，状态可控 |

Chrome 136 之后，默认 Chrome data dir 的 remote debugging 更敏感。`--remote-debugging-port` 和 `--remote-debugging-pipe` 调试默认 data dir 时需要配合非标准 `--user-data-dir`。Chrome 144+ 的 auto-connect 流程还会对每个 remote debugging session 做用户确认。

对 Agent 来说，这意味着：

| 需求 | 更合适的做法 | 代价 |
| --- | --- | --- |
| 真实默认 profile、真实登录态 | 接受 `Allow` 确认 | 安全边界强，交互较多 |
| 高频调试和自动化 | 准备 Agent 专用 profile | 需要单独登录和维护状态 |
| 普通网页登录态操作 | `@chrome` | 绕开 CDP 授权弹窗，受扩展权限和产品封装约束 |

所以“Agent 友好”要和最高权限分开看。真实 Chrome profile 很敏感，工具需要在便利和风险之间做产品边界。

## 6. 扩展、书签、历史和侧边栏：Agent 友好取决于安全域

有些能力天然属于 Chrome 扩展安全域，例如书签、历史记录、侧边栏。有些能力天然属于 CDP / DevTools 安全域，例如 Network、Trace、Runtime。

| 任务 | 更接近哪个安全域 | 对 Agent 的影响 |
| --- | --- | --- |
| 读写书签 | Chrome extension API | 需要扩展权限和产品封装 |
| 查询历史记录 | Chrome extension API / profile 数据 | 需要用户授权 |
| 打开侧边栏 | Chrome extension API | 需要 `sidePanel` 权限 |
| 操作 `chrome://extensions` | 浏览器内部 UI / CDP target | CDP 工具更容易覆盖 |
| reload unpacked extension | DevTools / extension management | Chrome DevTools MCP 扩展工具或 agent-browser 更合适 |
| 调试 extension service worker | CDP target / 扩展开发工具 | page-only 工具覆盖较弱 |

Codex `@chrome` 底层是 Chrome 扩展，所以它在真实 Chrome tab 和登录态方面很友好。但它暴露给 Agent 的 API 由产品决定，书签、历史、侧边栏、强副作用脚本和 Network 详情都要看当前产品有没有封装。

agent-browser 更适合直接进入 `chrome://extensions` 这类内部页面。Chrome DevTools MCP 的扩展工具更像正式 API，例如安装、列出、reload、触发 extension action，但它的扩展类别当前更偏自己 launch 的 Chrome / pipe 场景。

## 7. site adapter：为什么 bb-browser 对 Agent 特别有价值

“把固定网站封装成命令”，意思是把某个已知网站的页面流程、内部请求、前端 store、token 和返回结构，写成一个专用 adapter。

普通浏览器自动化是：

```txt
打开小红书
找到搜索框
输入关键词
点击搜索
等待结果
读卡片
解析标题、作者、链接
```

site adapter 会把它压成：

```bash
bb-browser site xiaohongshu/search "穿搭"
```

返回结构化 JSON：

```json
{
  "items": [
    {
      "title": "通勤穿搭",
      "author": "某用户",
      "url": "https://www.xiaohongshu.com/explore/..."
    }
  ]
}
```

这对 Agent 友好在三点：

| 友好点 | 说明 |
| --- | --- |
| 少观察 | Agent 少读页面结构，直接拿业务结果 |
| 少猜测 | adapter 已经知道搜索、详情、评论在哪里 |
| 可沉淀 | 一次适配后，后续任务都能复用命令 |

adapter JS 通常会了解这些东西：

- 网站路由怎么跳
- 前端 store 叫什么
- 哪个 action 触发搜索或加载详情
- 内部请求路径是什么
- token 或 CSRF 参数从哪里来
- 返回字段怎么整理成 Agent 可读 JSON

拿小红书举例，`xiaohongshu/search` 会触发搜索路由和搜索 store，并捕获 `search/notes` 相关响应；`xiaohongshu/note` 会解析 note id 和 `xsec_token`，再让页面自己的 note store 加载详情；`xiaohongshu/user_posts` 会用当前登录态 fetch 用户主页 HTML，并解析 SSR 初始状态。

这类 adapter 的代价也很明确：网站结构变化后要维护。它用网站的内部实现换来了 Agent 侧的简单接口。

## 8. 按 Agent 任务重新选工具

下面这张表只按 Agent 是否方便来选。

| Agent 任务 | 更友好的工具 | 原因 |
| --- | --- | --- |
| 操作当前用户已登录网页 | Codex `@chrome` | 真实 Chrome tab、真实登录态、最少启动成本 |
| 长时间自主浏览、点击、表单、截图 | agent-browser | 快照短、ref 稳定、CLI 输出省上下文 |
| 一边操作页面一边看请求 | agent-browser | network requests / request / route / HAR 跟操作闭环贴近 |
| 像 F12 一样排查接口和性能 | Chrome DevTools MCP | Network、Console、Performance、Lighthouse 诊断模型更完整 |
| 把网站搜索、详情、评论封成命令 | bb-browser | site adapter 直接返回结构化业务结果 |
| 反推网站接口并写 adapter | bb-browser | `network --with-body`、`fetch`、真实登录态和 adapter 体系配套 |
| 写长期回归测试 | Playwright | locator、断言、mock、trace、CI 体系成熟 |
| mock / abort 请求做测试 | Playwright / agent-browser / bb-browser | 取决于测试代码、Agent 流程还是站点命令化 |
| reload 本地扩展 | agent-browser / Chrome DevTools MCP 扩展工具 | 能接近扩展管理页或扩展管理 API |
| 读写书签、历史、侧边栏 | Chrome extension API / 已封装扩展工具 | 这些属于浏览器用户数据和扩展权限面 |
| 在已登录页面里发控制台式请求 | agent-browser / bb-browser / Playwright / Puppeteer | 需要真实页面 Runtime 或带登录态 fetch |

## 9. 最后总结：比较工具时先问 Agent 任务阶段

以后判断一个浏览器 Agent 工具，先问 Agent 当前卡在哪个阶段。

| Agent 阶段 | 关键问题 | 更自然的工具方向 |
| --- | --- | --- |
| 观察页面 | 页面有什么按钮、输入框、链接 | agent-browser、`@chrome`、Chrome DevTools MCP |
| 执行动作 | 怎么稳定点击、输入、等待 | agent-browser、`@chrome`、Playwright |
| 复用登录态 | 怎么接入真实 Chrome session | `@chrome`、agent-browser、bb-browser |
| 排查请求 | 哪个 API 出错、响应是什么 | Chrome DevTools MCP、agent-browser、bb-browser |
| 性能诊断 | 哪个阶段慢、LCP/INP/CLS 怎么拆 | Chrome DevTools MCP |
| 沉淀业务动作 | 怎么把网站能力变成命令 | bb-browser site adapter |
| 固化测试 | 怎么让结果可重复、可断言 | Playwright |

浏览器工具的差异，落到 Agent 视角就是：它帮 Agent 少看了多少页面，少猜了多少 selector，少写了多少脚本，少做了多少请求解析，以及出错后能否给出可复盘的证据。

## 参考材料

本文初始观察时间是 `2026-06-08`，并在 `2026-06-09` 补充了 native messaging、CDP transport、agent-browser profile 授权，以及“Console 式请求能力”的对比；后续补充了 Playwright / Puppeteer 关系、Agent-friendly snapshot / ref 工作流、Network 排障和 bb-browser site adapter 工作方式。重点材料包括：

| 项目 | 本文观察对象 |
| --- | --- |
| Codex Chrome 插件 | 本机 Codex Chrome 插件运行时与说明文档 |
| agent-browser | `agent-browser@0.27.1` / `0.27.2` 相关文档与 npm 包信息 |
| bb-browser | `bb-browser@0.14.2` 与本地源码 / 官方 README |
| Chrome DevTools MCP | `chrome-devtools-mcp@1.1.1` / 官方 tool reference |
| Chrome | 本机 Chrome `148.0.7778.216` |
| 官方文档 | Chrome Extensions API、Chrome DevTools Protocol、Chrome DevTools、Chrome remote debugging 安全变更 |

- [Chrome remote debugging switches security change](https://developer.chrome.com/blog/remote-debugging-port)
- [Chrome DevTools MCP: debug your browser session](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session)
- [Chrome DevTools auto-connect](https://developer.chrome.com/docs/devtools/agents/use-cases/auto-connect)
- [Chrome Enterprise RemoteDebuggingAllowed policy](https://chromeenterprise.google/policies/remote-debugging-allowed/)
- [Chrome extension match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
- [Chrome bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)
- [Chrome history API](https://developer.chrome.com/docs/extensions/reference/api/history)
- [Chrome sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Chrome debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [Chrome webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [Chrome DevTools Protocol: Network domain](https://chromedevtools.github.io/devtools-protocol/tot/Network/)
- [Chrome DevTools Protocol: Performance domain](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)
- [Chrome DevTools Performance reference](https://developer.chrome.com/docs/devtools/performance/reference)
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Chrome DevTools MCP tool reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- [agent-browser](https://github.com/vercel-labs/agent-browser)
- [agent-browser Network docs](https://agent-browser.dev/network)
- [bb-browser](https://github.com/epiral/bb-browser)
- [bb-sites](https://github.com/epiral/bb-sites)
- [Puppeteer Chrome extensions](https://pptr.dev/guides/chrome-extensions)
- [Playwright Chrome extensions](https://playwright.dev/docs/chrome-extensions)
- [Playwright actionability checks](https://playwright.dev/docs/actionability)
- [Playwright Locator API](https://playwright.dev/docs/api/class-locator)
- [Playwright Network docs](https://playwright.dev/docs/network)
