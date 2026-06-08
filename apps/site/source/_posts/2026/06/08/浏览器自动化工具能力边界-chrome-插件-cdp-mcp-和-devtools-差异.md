---
title: "浏览器自动化工具能力边界：Chrome 插件、CDP、MCP、书签、Network 和性能面板到底差在哪"
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
excerpt: "从 Chrome 插件、agent-browser、bb-browser、Chrome DevTools MCP、Puppeteer 和 Playwright 的底层接入点出发，对比它们在默认 profile、chrome:// 内页、扩展 reload、书签、侧边栏、历史记录、Network 请求、Console、Performance、Lighthouse 和 service worker 上的真实能力边界。"
cover: "cover-v1.svg"
coverPosition: "below-title"
---

## 摘要

这篇文章想回答一个很具体的问题：

**为什么同样叫“让 Agent 操作浏览器”，有的工具能复用我的真实 Chrome 登录态，有的能看 Network，有的能 reload 本地扩展，有的能读历史记录，有的却连 `chrome://extensions` 都进不去？**

答案不在“自动化能力强不强”这么粗的描述里，而在它到底接到了浏览器的哪一层。

{% asset_img figure-01.svg %}

可以先把浏览器拆成五个能力面：

| 能力面 | 典型入口 | 最擅长什么 | 天然短板 |
| --- | --- | --- | --- |
| 网页面 | Playwright、Puppeteer、普通 DOM 自动化 | 点击、输入、截图、读页面结构 | 只能看到网页暴露的东西 |
| Chrome 插件面 | `chrome.*` extension API、Codex `@chrome` 插件 | 默认 profile、书签、历史、侧边栏、扩展自己的 UI | 受扩展权限和 match pattern 限制 |
| CDP 调试面 | Chrome DevTools Protocol、remote debugging、pipe | Network、Console、Runtime、Target、Page、Trace | 权限很强，安全边界更敏感 |
| DevTools 产品面 | Chrome DevTools、Chrome DevTools MCP、Lighthouse | 性能洞察、Network waterfall、Trace insight、Lighthouse 报告 | 通常围绕“被调试页面”，不是浏览器全局设置 |
| 站点适配面 | bb-browser site adapter | 把具体网站封装成命令 | 跟网站结构强绑定，需要维护 |

这篇文章会按能力边界而不是按产品名来讲：

1. 真实 Chrome profile 和 remote debugging 的边界
2. `chrome://` 内页、扩展页、扩展 service worker 的边界
3. 书签、侧边栏、历史记录这类 Chrome 数据能力的边界
4. Network、Console、Performance、Lighthouse 这类 F12 面板数据的边界
5. `@chrome`、agent-browser、bb-browser、Chrome DevTools MCP、Puppeteer / Playwright 分别适合什么

本文观察时间是 `2026-06-08`。重点材料包括：

| 项目 | 本文观察对象 |
| --- | --- |
| Codex Chrome 插件 | 本机 Codex Chrome 插件运行时与说明文档 |
| agent-browser | `agent-browser@0.27.1` |
| bb-browser | `bb-browser@0.14.2` 与本地源码 |
| Chrome DevTools MCP | `chrome-devtools-mcp@1.1.1` |
| Chrome | 本机 Chrome `148.0.7778.216` |
| 官方文档 | Chrome Extensions API、Chrome DevTools Protocol、Chrome DevTools、Chrome remote debugging 安全变更 |

## 0. 先把一句话说清：MCP 不是浏览器能力来源

很多讨论会把 `MCP`、`CDP`、`Chrome DevTools`、`Puppeteer` 混在一起说。

它们不是一层东西。

| 名词 | 它是什么 |
| --- | --- |
| MCP | Agent 调用外部工具的协议，解决“工具怎么暴露给模型” |
| CDP | Chrome DevTools Protocol，Chrome 暴露的底层调试协议 |
| Puppeteer | 用 JavaScript 封装 CDP / BiDi 的浏览器自动化库 |
| Chrome DevTools | 给人类开发者使用的调试产品，Network、Performance、Console 都在这里 |
| Chrome DevTools MCP | 把 DevTools / Puppeteer / CDP 能力包装成 MCP 工具的 server |

所以，“某个工具支持 MCP”不代表它就能读书签、改历史、抓所有请求或 reload 扩展。

真正要问的是：

**这个 MCP server 后面接的是 Chrome 插件、CDP、Playwright、站点 API，还是一个普通网页脚本？**

## 1. 默认 profile：方便和危险往往来自同一个地方

默认 profile 指的是你日常用的 Chrome 身份。里面有登录态、Cookie、浏览历史、扩展、书签、本地存储和各种同步状态。

不同工具复用默认 profile 的方式差别很大。

| 工具 | 复用默认 profile 的方式 | 体验 | 边界 |
| --- | --- | --- | --- |
| Codex `@chrome` 插件 | 它本身就是装在用户 Chrome 里的扩展，再通过 native messaging 和 Codex 通信 | 最顺，天然拿到现有 tab 和登录态 | 仍然是扩展沙箱，不能随便控制 `chrome://` 和其他扩展 UI |
| agent-browser | `--auto-connect` 连接已开启远程调试的 Chrome，或用 `--profile` 指定持久 profile | 很灵活 | 依赖 CDP 暴露和用户授权，权限面更大 |
| bb-browser | daemon 连接 CDP；旧 npm 包偏传统 `/json/version` 发现；新源码已有 `DevToolsActivePort` fallback | 适合“真实浏览器就是 API”的命令化使用 | 版本差异大，旧连接流程容易被 Chrome 新策略打断 |
| Chrome DevTools MCP | 可启动自己的 profile，也可 `--autoConnect` 连接 Chrome 144+ 的授权调试实例 | DevTools 能力完整 | 扩展工具类别当前不支持 autoConnect / browserUrl / wsEndpoint |
| Puppeteer / Playwright | 通常启动独立 profile；也可 persistent context / connect over CDP | 最可控 | 要自己写脚本和安全边界 |

Chrome 136 之后，Google 对默认 profile 的 remote debugging 做了安全收紧。官方博客说，`--remote-debugging-port` 和 `--remote-debugging-pipe` 在调试默认 Chrome data dir 时不再被尊重，必须配合非标准 `--user-data-dir`；Chrome for Testing 继续保留自动化场景的旧行为。参考：[Chrome remote debugging switches security change](https://developer.chrome.com/blog/remote-debugging-port)。

### auto-connect 的授权不是一次性开关

Chrome 144+ 的 auto-connect 流程解决的是“Agent 怎么请求连接当前正在运行的 Chrome”，不是“把某个 Agent 永久加入信任列表”。官方文档要求先到 `chrome://inspect/#remote-debugging` 手动启用 remote debugging，然后 MCP server 才能用 `--autoConnect` 请求连接当前浏览器。参考：[Connect your AI agent to your personal browser with auto-connect](https://developer.chrome.com/docs/devtools/agents/use-cases/auto-connect)。

这里最容易误会的是：打开 remote debugging 只是在 Chrome 里打开这座桥，不等于以后每次都自动放行。Chrome DevTools MCP 的官方博客明确说，为了避免恶意滥用，每次 MCP server 请求 remote debugging session，Chrome 都会弹出确认框，让用户允许这次 session。参考：[Let your Coding Agent debug your browser session with Chrome DevTools MCP](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session)。

所以如果你每次用 agent-browser 或 Chrome DevTools MCP 接默认 profile 时都被问一次 `Allow`，这不是工具故障，而是 Chrome 把“真实浏览器 profile”当成敏感边界来保护。企业策略里有 `RemoteDebuggingAllowed`，但它只控制“是否允许 remote debugging”，不是“是否跳过每次确认弹窗”。参考：[RemoteDebuggingAllowed policy](https://chromeenterprise.google/policies/remote-debugging-allowed/)。

实际使用时可以这样取舍：

| 需求 | 更合适的做法 | 代价 |
| --- | --- | --- |
| 必须复用当前默认 profile 的真实登录态 | 接受每次 `Allow` 确认 | 安全边界最强，但交互最烦 |
| 高频调试扩展、Network、Performance | 准备一个 Agent 专用 Chrome profile | 需要单独登录和维护状态 |
| 自动化测试或 CI | Chrome for Testing / 独立 `--user-data-dir` | 不复用日常浏览器状态 |
| 只操作普通网页登录态 | Codex `@chrome` 插件 | 不走这个 CDP 授权弹窗，但受扩展沙箱限制 |

这件事直接影响了旧式工具：

```ts
const url = `http://${host}:${port}/json/version`; // 旧流程先请求固定 HTTP discovery 地址
const json = await fetch(url).then(r => r.json()); // 期待 Chrome 返回 webSocketDebuggerUrl
const ws = json.webSocketDebuggerUrl; // 再用这个 WebSocket 连接 browser target
```

在 Chrome 新授权模型里，更稳的流程会变成：

```ts
const file = readFile("DevToolsActivePort"); // 从 Chrome profile 目录读取动态端口文件
const [port, path] = file.trim().split("\n"); // 第一行是端口，第二行是 browser websocket path
const ws = `ws://127.0.0.1:${port}${path}`; // 直接拼出真实 browser WebSocket 地址
connect(ws); // 跳过脆弱的旧式 /json/version 假设
```

这就是为什么同样是 CDP 工具，agent-browser 能自动发现新的动态调试入口，而旧版 bb-browser 可能卡在 `127.0.0.1:9222/json/version`。

## 2. `chrome://extensions`：这是区分工具边界的一把刀

如果只测普通网页，很多工具看起来差不多。

真正拉开差距的是：

**能不能操作 `chrome://extensions`，能不能 reload 本地 unpacked extension。**

{% asset_img figure-02.svg %}

### `@chrome` 插件为什么不适合 reload 其他扩展

Codex `@chrome` 插件的优势是复用你的真实 Chrome。它能看到用户 tab，能 claim 一个普通网页 tab，然后用 Playwright 风格 API 或视觉能力操作页面。

但它本质上仍是 Chrome 扩展。Chrome 扩展的 URL match pattern 支持 `http`、`https`、`file` 等有限 scheme，`*` 也只匹配 `http` / `https`。官方文档见：[Chrome extension match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)。

这意味着：

- 它不应该被期待去接管 `chrome://extensions`
- 它不能随便进入另一个扩展的 `chrome-extension://...` 页面
- 它对“用户真实 profile”很友好，但对“浏览器内部管理界面”不友好

这是安全模型决定的，不是按钮没做好。

### agent-browser 为什么更可能做到

agent-browser 走的是 CDP / Playwright 类路线。它的 README 明确有：

- `--extension <path>`：加载本地扩展
- `--cdp <port|url>`：连接 CDP
- `--auto-connect`：发现本地运行中的 Chrome
- `--profile <name|path>`：复用持久 profile

我在本机用隔离 session 实测过：

1. `agent-browser open chrome://extensions`
2. 它成功进入扩展页
3. 点击“开发者模式”
4. 快照里出现“加载未打包的扩展程序”“打包扩展程序”“更新”等按钮引用

所以它更适合这样的工作流：

```bash
agent-browser --auto-connect open chrome://extensions # 连接已授权调试的真实 Chrome 并打开扩展页
agent-browser snapshot -i                             # 拿可交互元素引用，找到目标扩展或更新按钮
agent-browser click <ref>                             # 点击 reload / 更新 / 目标按钮
```

如果不要求复用真实 profile，也可以用：

```bash
agent-browser --extension ./dist open chrome://extensions # 启一个带本地扩展的浏览器
agent-browser snapshot -i                                 # 读取扩展管理页的可交互结构
```

### Chrome DevTools MCP 的扩展能力很强，但有一个当前限制

`chrome-devtools-mcp@1.1.1` 已经提供扩展工具：

| 工具 | 作用 |
| --- | --- |
| `install_extension` | 从本地路径安装 unpacked extension |
| `list_extensions` | 列出扩展 |
| `reload_extension` | 按 id reload unpacked extension |
| `trigger_extension_action` | 触发扩展 action |
| `uninstall_extension` | 卸载扩展 |

这比“打开扩展管理页再点按钮”更像正式 API。

但它现在有一个很关键的限制：扩展类别需要 `--categoryExtensions=true`，并且当前只支持 pipe connection；`autoConnect`、`browserUrl`、`wsEndpoint` 暂不支持这个扩展工具类别，文档里写的是 Chrome 149 之后才会放开。

所以现在的边界是：

- 想在它自己 launch 的 Chrome 里装扩展 / reload 扩展：很合适
- 想直接复用你当前默认 profile 再 reload 其中某个扩展：当前不如 agent-browser 顺

### bb-browser 的两个细边界

bb-browser 的核心优势不是扩展开发，而是把真实浏览器和 site adapter 变成 Agent API。

它在扩展页上有两个细边界。

第一，旧 npm 包连接 CDP 偏传统 `/json/version` discovery；Chrome 新远程调试模型下容易不稳。

第二，一些 open / goto 命令会把非 `http(s)` 输入补成 `https://...`：

```ts
if (!url.startsWith("http://") && !url.startsWith("https://")) { // 只认 http 和 https
  normalizedUrl = "https://" + url; // 把 github.com 变成 https://github.com
} // 但 chrome://extensions 也会被错误改写
```

这对 `github.com` 很方便，对 `chrome://extensions`、`chrome-extension://...`、`file://...`、`about:blank` 这类特殊 scheme 就会出问题。

## 3. 书签、侧边栏、历史记录：这是 Chrome 扩展 API 的主场

用户提到书签、侧边栏、历史记录，这些不是普通网页能力，也不是典型 DevTools 面板能力，而是 Chrome extension API 能力。

{% asset_img figure-03.svg %}

| 能力 | Chrome 扩展 API | CDP / DevTools | 普通网页自动化 |
| --- | --- | --- | --- |
| 读写书签 | `chrome.bookmarks`，需要 `bookmarks` 权限 | 没有面向书签树的一等 CDP domain | 只能操作书签管理器 UI，脆弱 |
| 查询历史 | `chrome.history`，需要 `history` 权限 | 可通过工具自己封装 profile 读取，但不是标准页面调试能力 | 只能看当前页面 history stack，不是浏览器历史库 |
| 侧边栏 | `chrome.sidePanel`，Chrome 114+ MV3 | 可以调试 side panel 页面 target，但不能天然拥有 sidePanel API | 普通网页不能开 Chrome 原生侧边栏 |
| 扩展 action / popup | extension API + 用户手势约束 | 某些工具可触发 action 或调试 popup target | 只能点 UI，且常受沙箱限制 |

Chrome 官方文档对这些 API 的边界很清楚：

- `chrome.bookmarks` 用来创建、组织和操作书签，需要声明 `bookmarks` 权限：[bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)
- `chrome.history` 用来和浏览器访问记录交互，需要 `history` 权限：[history API](https://developer.chrome.com/docs/extensions/reference/api/history)
- `chrome.sidePanel` 用来把扩展 UI 放进浏览器侧边栏，需要 `sidePanel` 权限，Chrome 114+ MV3 可用：[sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

所以这类能力的首选不是 CDP，而是“一个被用户授权的 Chrome 扩展”。

但是这里也有一个反直觉点：

**Codex `@chrome` 插件是 Chrome 扩展，不等于它就暴露了所有 Chrome extension API 给 Agent。**

它有能力所在的权限面，但产品会选择只暴露一部分安全工具，比如 tab、截图、页面操作、历史上下文等。书签、历史、侧边栏是否可用，取决于这个插件本身有没有申请权限、有没有在 native host 协议里封装对应命令、有没有让 Agent 调用。

这也是“底层可做”和“当前工具可调用”的区别。

## 4. Network 请求：webRequest 和 CDP Network 看到的不是同一层

Network 是最容易混淆的能力。

Chrome 扩展有 `chrome.webRequest`。CDP 有 `Network` domain。DevTools 有 Network panel。它们都叫 Network，但边界不同。

| 入口 | 能看到什么 | 能改什么 | 边界 |
| --- | --- | --- | --- |
| `chrome.webRequest` | 扩展有 host 权限的请求生命周期 | MV3 下大多数扩展不能再用 `webRequestBlocking` 阻塞修改 | 权限跟 manifest 和 host_permissions 强绑定 |
| CDP `Network` domain | 被调试 target 的请求、响应、headers、body、timing、WebSocket 事件 | 可禁用缓存、设置 headers、读 response body、模拟网络等 | 主要围绕 target，不是浏览器全局审计工具 |
| DevTools Network panel | 人类可读 waterfall、initiator、timing、preview、blocked cookies 等 | 通过 UI 或底层 CDP 操作 | 数据解释能力强，但需要工具封装才能给 Agent 稳定使用 |
| Chrome DevTools MCP | `list_network_requests`、`get_network_request` 等工具 | 偏读取和调试 | 更适合 Debug，不适合做站点规模采集 |
| bb-browser trace/network | 把请求和操作串成 Agent 可读事件 | 可结合 site adapter 读取业务响应 | 取决于 daemon 与页面 target 覆盖 |

Chrome 官方说 `webRequest` 可观察、分析、拦截、阻止或修改进行中的请求，但 MV3 下大多数扩展不再能用 `webRequestBlocking`，应考虑 declarativeNetRequest；同时需要 `webRequest` 和相应 host permissions。参考：[webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)。

CDP Network domain 则更像 DevTools 自己看的那层。官方协议里有：

- `Network.enable`
- `Network.getRequestPostData`
- `Network.getResponseBody`
- `Network.setCacheDisabled`
- `Network.setExtraHTTPHeaders`
- WebSocket frame 相关事件

参考：[CDP Network domain](https://chromedevtools.github.io/devtools-protocol/tot/Network/)。

所以如果你的目标是：

- “这个页面刚才哪个 API 慢了？” 用 CDP / Chrome DevTools MCP。
- “我写一个扩展监控某些域名请求？” 用 `chrome.webRequest` / `declarativeNetRequest`。
- “我让 Agent 把 Twitter 搜索封装成一个命令？” 用 bb-browser site adapter 更自然。
- “我只想点网页按钮然后看结果？” agent-browser / Playwright / `@chrome` 都可能够用。

## 5. Performance、Lighthouse 和首屏：不是所有工具都能拿到 F12 里的同一份数据

“第一次首屏加载速度”这句话里其实混了几类指标。

| 指标或数据 | 通常来源 | 说明 |
| --- | --- | --- |
| DOMContentLoaded / load | Page lifecycle / Navigation Timing / Network panel | 文档解析和资源加载事件，不等于用户看到内容 |
| FCP | Performance Timeline / trace / Lighthouse | 首次内容绘制 |
| LCP | Performance Timeline / trace / Lighthouse / CrUX | 最大内容绘制，更接近用户感知 |
| CLS | PerformanceObserver / trace / Lighthouse | 布局偏移 |
| INP | 真实交互数据 / Performance panel live metrics / CrUX | 交互延迟，实验环境不一定稳定 |
| TBT | Lighthouse synthetic metric | 总阻塞时间，用来估计主线程阻塞 |
| waterfall timing | CDP Network / DevTools Network panel | 单个请求 DNS、connect、SSL、TTFB、download 等 |
| trace insight | DevTools Performance / Lighthouse / Chrome DevTools MCP | 从 trace 里归因瓶颈 |

{% asset_img figure-04.svg %}

CDP 的 `Performance.getMetrics` 可以拿运行时指标，协议文档把它定义为“retrieve current values of run-time metrics”：参考 [CDP Performance domain](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)。

但完整的 F12 Performance panel 不只是 `getMetrics`。它还包括：

- Trace 事件
- Main thread task
- Layout / style / paint
- Screenshots / filmstrip
- Web vitals lane
- Lighthouse / Performance Insights 的诊断规则

Chrome DevTools 官方 Performance reference 也把 Performance panel 定位为分析性能的一整套功能，不是一个单一 API。参考：[Performance features reference](https://developer.chrome.com/docs/devtools/performance/reference)。

这就解释了工具差异：

| 工具 | 性能能力 |
| --- | --- |
| `@chrome` 插件 | 可以在真实页面上操作和截图，但不是性能分析主力 |
| agent-browser | 可以配合 CDP / Playwright 做基本 performance API、截图、trace，但需要自己组织分析 |
| bb-browser | 能记录操作和网络事件，适合 Agent 复盘流程，不等于完整 DevTools Performance panel |
| Chrome DevTools MCP | 最适合拿 DevTools 风格性能数据，有 `performance_start_trace`、`performance_stop_trace`、`performance_analyze_insight`、Lighthouse 等工具 |
| Puppeteer / Playwright | 原始能力强，可 trace、coverage、performance API、network timing，但需要自己写分析脚本 |

如果目标是“从 F12 里看到的各种数据中找性能瓶颈”，Chrome DevTools MCP 是最贴近的工具。

如果目标只是“页面打开多久有首屏”，Playwright / Puppeteer / agent-browser 也能做，但你要自己定义口径：

```ts
await page.goto(url, { waitUntil: "domcontentloaded" }); // 等 DOMContentLoaded，只代表 DOM 已解析
const paint = await page.evaluate(() => performance.getEntriesByType("paint")); // 从页面 Performance API 读 paint entries
const nav = await page.evaluate(() => performance.getEntriesByType("navigation")); // 读取 navigation timing
console.log({ paint, nav }); // 输出实验口径下的首屏相关数据
```

这段数据能用来观察，但不能直接等同于 Lighthouse 分数，也不能等同于真实用户体验数据。

## 6. 扩展 service worker：很多“page-only”工具会漏掉它

MV3 扩展的后台逻辑通常跑在 extension service worker 里。

这对工具选择影响很大：

| 工具类型 | 是否自然覆盖 extension service worker |
| --- | --- |
| 普通 DOM 自动化 | 否，它只看页面 |
| page-only CDP 封装 | 通常否，只 attach `type === "page"` target |
| Puppeteer / Playwright 原生 | 可以，官方文档有扩展 service worker 调试路径 |
| Chrome DevTools MCP 扩展类别 | 更接近扩展开发场景，可列扩展、reload、触发 action |
| `@chrome` 插件 | 可以管理自己的 extension runtime，但不能随意调试其他扩展的 worker |

Puppeteer 和 Playwright 官方都把 Chrome extension 放在专门章节里讲：

- Puppeteer 文档讲如何加载扩展、等待 service worker、拿 extension id：[Puppeteer Chrome extensions](https://pptr.dev/guides/chrome-extensions)
- Playwright 文档要求使用 persistent context，并等待 extension service worker：[Playwright Chrome extensions](https://playwright.dev/docs/chrome-extensions)

所以做扩展开发时，不要只问“能不能打开 popup 页面”。还要问：

- 能不能列 `service_worker` target？
- 能不能 evaluate 到 worker 里？
- 能不能触发 extension action？
- 能不能 reload unpacked extension？
- 能不能读取扩展自己的 console / network？

这些才是扩展开发真正需要的能力。

## 7. 书签、历史、侧边栏和 Network 为什么不能用一张“强弱表”概括

这些能力不在同一个安全域。

| 能力 | 更接近哪个安全域 | 为什么 |
| --- | --- | --- |
| 书签 | Chrome extension API | 这是浏览器用户数据，不是网页 DOM |
| 历史记录 | Chrome extension API / 浏览器 profile 数据 | 需要用户授权，普通网页不能读 |
| 侧边栏 | Chrome extension UI API | 只有扩展能创建浏览器原生侧边栏 |
| Network 请求 | CDP / DevTools / extension webRequest | 三者都能看，但权限、范围和修改能力不同 |
| F12 Performance | DevTools / CDP Trace / Lighthouse | 需要浏览器调试面和分析模型 |
| `chrome://extensions` | 浏览器内部 UI / CDP target | 扩展内容脚本通常进不去，CDP 工具可能进得去 |
| 扩展 reload | Chrome extension management / DevTools pipe / UI 操作 | 不是普通网页行为 |
| 默认 profile 登录态 | Chrome profile / 扩展 / CDP connect | 方便但敏感，Chrome 新版本持续收紧 |

因此，“能力边界”不是工具厂商随便画的，而是 Chrome 自身的安全模型、DevTools 调试模型和扩展权限模型一起决定的。

## 8. 按任务选工具

下面这个表更接近实际使用。

| 任务 | 首选 | 原因 |
| --- | --- | --- |
| 操作真实网页登录态页面 | Codex `@chrome` 插件 | 默认 profile 体验最好，少折腾 CDP |
| 本地开发扩展后 reload | agent-browser 或 Chrome DevTools MCP 扩展类别 | agent-browser 能进扩展页；DevTools MCP 有 reload_extension 工具 |
| 在默认 profile 里操作 `chrome://extensions` | agent-browser | `--auto-connect` + CDP 更适合这个场景 |
| 高频调试默认 profile，又不想每次点 `Allow` | Agent 专用 profile / 独立 `--user-data-dir` | Chrome 目前没有“永远允许这个 Agent”的普通设置 |
| 启隔离浏览器测试扩展 | Puppeteer / Playwright / Chrome DevTools MCP | profile 可控，扩展开发 API 更直接 |
| 读写书签 | 自己写 Chrome 扩展或已有扩展工具 | `chrome.bookmarks` 是正路 |
| 查询历史记录 | Chrome extension API 或工具暴露的 history 能力 | 普通网页和普通 CDP 页面工具不是主场 |
| 打开 / 管理侧边栏 | Chrome extension API | `chrome.sidePanel` 是扩展能力 |
| 看请求列表、响应体、waterfall | Chrome DevTools MCP / CDP 工具 | 接近 DevTools Network |
| 做性能 Trace / Lighthouse 分析 | Chrome DevTools MCP | 最贴近 F12 Performance / Lighthouse |
| 把固定网站封装成命令 | bb-browser site adapter | 不只是点 UI，而是站点能力抽象 |
| 做可重复 E2E 测试 | Playwright | 工程化、断言、trace、CI 更成熟 |

## 9. 最后总结：看接入点，不看名字

以后判断一个“浏览器 Agent 工具”的能力，不要先问它是不是 MCP，也不要先问它能不能点击页面。

先问这五个问题：

1. 它是在 Chrome extension 沙箱里，还是通过 CDP 接到 browser target？
2. 它复用的是我的默认 profile，还是启动了隔离 profile？
3. 它能看到哪些 target：只有 `page`，还是包括 service worker、extension、DevTools target？
4. 它对特殊 scheme 怎么处理：`chrome://`、`chrome-extension://`、`file://`、`about:` 会不会被过滤或改写？
5. 它暴露的是原始调试能力，还是经过产品层封装过的安全子集？

这五个问题比“哪个工具更强”更准确。

因为浏览器不是一个平面。它是一组互相隔离的能力面：

- 网页面负责 DOM 和用户交互
- 扩展面负责用户授权的浏览器数据和 UI
- CDP 面负责调试和 instrumentation
- DevTools 面负责人类可读的诊断和性能模型
- 站点适配面负责把具体网站压成稳定命令

工具的差异，本质上就是它站在哪个面上，以及它愿意把那个面的多少能力交给 Agent。

## 参考材料

- [Chrome remote debugging switches security change](https://developer.chrome.com/blog/remote-debugging-port)
- [Chrome DevTools MCP: debug your browser session](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session)
- [Chrome DevTools auto-connect](https://developer.chrome.com/docs/devtools/agents/use-cases/auto-connect)
- [Chrome Enterprise RemoteDebuggingAllowed policy](https://chromeenterprise.google/policies/remote-debugging-allowed/)
- [Chrome extension match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
- [Chrome bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)
- [Chrome history API](https://developer.chrome.com/docs/extensions/reference/api/history)
- [Chrome sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [Chrome DevTools Protocol: Network domain](https://chromedevtools.github.io/devtools-protocol/tot/Network/)
- [Chrome DevTools Protocol: Performance domain](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)
- [Chrome DevTools Performance reference](https://developer.chrome.com/docs/devtools/performance/reference)
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [agent-browser](https://github.com/vercel-labs/agent-browser)
- [bb-browser](https://github.com/epiral/bb-browser)
- [Puppeteer Chrome extensions](https://pptr.dev/guides/chrome-extensions)
- [Playwright Chrome extensions](https://playwright.dev/docs/chrome-extensions)
