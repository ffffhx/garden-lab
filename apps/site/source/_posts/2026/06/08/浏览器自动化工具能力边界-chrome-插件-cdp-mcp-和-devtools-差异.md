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
cover: "cover-v1.svg"
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

{% asset_img figure-01.svg %}

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

{% asset_img figure-04.svg %}

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
