---
title: "bb-browser 源码解析：你的浏览器为什么可以变成 Agent 的 API"
date: 2026-04-25 15:08:00
categories:
  - 技术
tags:
  - AI
  - Agent
  - Browser
  - CDP
  - MCP
  - TypeScript
  - 源码解析
excerpt: "确认 bb-browser 是一个 MIT 许可证的开源项目之后，从源码拆解它怎样把真实 Chrome、Daemon、CDP、MCP、Chrome profile 和 site adapter 组织成一套给 AI Agent 使用的浏览器能力层。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

先回答问题：**bb-browser 是开源的。**

我这次确认到的公开信息是：

- 主仓库：[epiral/bb-browser](https://github.com/epiral/bb-browser)
- GitHub 状态：Public
- 许可证：MIT
- npm 包：[bb-browser](https://www.npmjs.com/package/bb-browser)
- npm 最新版：`0.11.3`
- npm 最新版发布时间：`2026-04-09`
- 本文观察主仓库 commit：[`561c00261981546d2e662329eb1343d072f80ea5`](https://github.com/epiral/bb-browser/tree/561c00261981546d2e662329eb1343d072f80ea5)
- 本文观察时间：`2026-04-25`

另外，它的社区适配器仓库是 [epiral/bb-sites](https://github.com/epiral/bb-sites)。这个仓库是公开的，本文会用它解释 adapter 机制；但我本次观察没有在 `bb-sites` 根目录看到独立 LICENSE 文件，所以如果要复用里面的 adapter 代码，授权仍然应该以该仓库当前声明为准。

一句话概括 bb-browser：

**它不是普通爬虫，也不是单纯的浏览器测试框架，而是把真实浏览器登录态包装成 CLI / MCP 工具，让 Agent 可以在你的浏览器上下文里读取网页、执行 JavaScript、抓网络请求、调用站点自己的接口。**

这篇文章不会只复述 README，而是按源码把它拆开看：

1. 它为什么强调“你的浏览器就是 API”
1. 它的 CLI、Daemon、CDP、Chrome 是怎么串起来的
1. 它到底复用哪个 Chrome profile 和登录态
1. 它怎样把 DOM 快照变成 Agent 可点击的 `@ref`
1. site adapter 为什么是这个项目最有想象力的部分
1. MCP 接入为什么几乎是顺手长出来的
1. 它有哪些安全边界和使用取舍

下面所有代码片段都是**基于源码裁剪后的讲解版**：

- 不做完整复制
- 只保留表达设计意图的主干
- 每一行都加中文注释
- 真实源码以文中链接和观察 commit 为准

## 0. 阅读预备：先把几个词讲清楚

{% asset_img figure-01.svg %}

读 bb-browser 之前，先把几个词对齐。

- `CDP`
  - Chrome DevTools Protocol，也就是 Chrome 暴露给 DevTools 和自动化工具的调试协议
- `Daemon`
  - 常驻后台进程。bb-browser 用它维持和 Chrome 的 CDP 连接，再通过本地 HTTP 接收 CLI / MCP 命令
- `MCP`
  - Model Context Protocol。它让 Claude Code、Cursor 这类 Agent 可以把外部能力当工具调用
- `Snapshot`
  - 页面结构快照。bb-browser 会把 DOM / 可访问性信息转换成文本树，并给可交互元素分配 `@ref`
- `site adapter`
  - 单个网站能力的 JS 适配器，比如 `zhihu/hot`、`github/repo`、`twitter/search`
- `真实登录态`
  - 不是复制 Cookie 给爬虫，而是在真实浏览器 tab 里运行代码，天然带上当前浏览器的 Cookie、localStorage、前端运行时状态
- `user-data-dir`
  - Chrome 的用户数据根目录，里面保存浏览器级别的状态，也包含一个或多个 profile
- `profile`
  - 一个独立的浏览器身份容器，通常对应 `Default`、`Profile 1` 这样的目录，里面保存这个身份登录过的网站、Cookie、历史、扩展和本地存储
- `remote-debugging-port`
  - Chrome 启动参数。打开后，Chrome 会在本机监听一个 CDP 调试端口，等待 bb-browser、Puppeteer、Playwright 这类工具连接

所以它的核心不是“自动点网页”这么简单。

更准确地说，bb-browser 在做一层转换：

**把浏览器里原本只能由人手动操作的网页能力，转换成 Agent 能稳定调用的命令和工具。**

## 1. 开源状态：工具本体是 MIT，生态分成两层看

{% asset_img figure-02.svg %}

确认开源状态时，我看了三处材料。

第一处是 GitHub 主仓库。`epiral/bb-browser` 是 Public 仓库，README 页面直接展示 `MIT license`。

第二处是仓库里的 `LICENSE` 文件。内容是标准 MIT License。

第三处是 npm 元数据。`npm view bb-browser` 显示：

- 包名是 `bb-browser`
- 最新版本是 `0.11.3`
- license 字段是 `MIT`
- repository 指向 `https://github.com/epiral/bb-browser.git`

可以把工具本体理解成下面这个讲解版对象：

```ts
const publishedPackage = { // 用一个讲解对象概括 npm 包的关键公开信息
  name: "bb-browser", // 包名就是用户安装时使用的名字
  version: "0.11.3", // 本文观察时 npm latest 指向的版本
  license: "MIT", // 工具本体采用 MIT 许可证
  repository: "https://github.com/epiral/bb-browser.git", // npm 元数据指回 GitHub 主仓库
  bin: { // 包安装后暴露三个命令入口
    "bb-browser": "./dist/cli.js", // 普通 CLI 入口，给人和脚本使用
    "bb-browser-mcp": "./dist/mcp.js", // MCP server 入口，给 Agent 工具协议使用
    "bb-browser-provider": "./dist/provider.js", // provider 入口，用于更高层的工具注册场景
  }, // bin 字段结束
}; // 公开包信息讲解结束
```

这里有一个细节值得分开讲：

- `bb-browser` 是工具本体，MIT
- `bb-sites` 是社区 adapter 仓库，公开维护很多网站命令

这两者经常一起出现，但工程边界不是一回事。

`bb-browser site update` 会把 `bb-sites` 克隆到本机的 `~/.bb-browser/bb-sites/`。工具本体负责扫描、加载和执行 adapter；adapter 仓库负责提供站点脚本。这个设计让核心工具可以保持通用，而站点能力可以独立迭代。

## 2. 它为什么说“你的浏览器就是 API”

传统网页自动化大概有三条路。

第一条路是官方 API。它最稳定，但大多数网站没有给完整 API，或者需要申请 key、受限流、字段不全。

第二条路是普通爬虫。它不启动浏览器，只发 HTTP 请求，优点是快，缺点是需要自己处理 Cookie、签名、CSRF、风控、页面渲染。

第三条路是 Playwright / Selenium。它们能启动浏览器，也能跑端到端测试，但常见用法是独立浏览器上下文，登录态和日常使用的浏览器通常分开。

bb-browser 的思路不太一样：

**既然网站本来就是给浏览器用的，那就让 Agent 直接进入浏览器上下文。**

这带来几个结果：

- 当前浏览器已经登录，站点请求天然带 Cookie
- 前端页面已经加载，JS 运行时和页面状态都在
- 站点自己的 API 封装、请求拦截器、状态管理库有机会被复用
- Agent 不一定要解析 UI，可以直接 `fetch()` 或调用页面内部函数

这也是为什么它的 README 反复强调：

**No keys. No bots. No scrapers.**

这句话容易被误解成“规避一切检测”。更工程化的理解应该是：

**它不是伪装成一个用户，而是在用户自己的浏览器里执行用户授权的动作。**

这让它很适合低频、研究型、个人自动化和 Agent 辅助任务；但并不适合大规模采集，也不应该拿来突破网站规则。

## 3. 整体架构：CLI / MCP 只是入口，Daemon 才是核心中转层

{% asset_img figure-03.svg %}

源码里最重要的分层是这四个包：

- `packages/cli`
  - 命令行入口，负责参数解析、输出格式、启动 daemon、发送请求
- `packages/daemon`
  - 后台进程，负责连接 Chrome CDP、维护 tab 状态、分发浏览器命令
- `packages/mcp`
  - MCP server，负责把浏览器能力注册成 Agent 工具
- `packages/shared`
  - 共享协议、命令注册表、daemon HTTP client、常量

再加上根目录的 `tsup.config.ts`，最终会打成几个入口：

- `dist/cli.js`
- `dist/daemon.js`
- `dist/mcp.js`
- `dist/provider.js`

运行时链路可以简化成这样：

1. 用户或 Agent 调 `bb-browser open / snapshot / site / fetch`
1. CLI 检查 daemon 是否存在
1. 如果没有 daemon，CLI 尝试发现或启动可连接 CDP 的 Chrome
1. CLI 启动 daemon，并把 CDP host / port 传进去
1. daemon 写入 `~/.bb-browser/daemon.json`
1. CLI 读取 `daemon.json`，用 bearer token 调本地 HTTP
1. daemon 把请求翻译成 CDP 命令
1. Chrome 在真实页面里执行动作或脚本

讲解版代码如下：

```ts
async function ensureDaemon() { // 确保后台 daemon 可用
  const oldInfo = await readDaemonJson(); // 先读取本机记录的 daemon 地址和 token
  if (oldInfo && isProcessAlive(oldInfo.pid)) return; // 如果旧进程还活着，就优先复用
  const cdp = await discoverCdpPort(); // 找一个能连接的 Chrome DevTools Protocol 端口
  if (!cdp) throw new Error("Cannot find Chrome CDP"); // 找不到浏览器时直接失败并给出提示
  const child = spawn(process.execPath, [daemonPath, "--cdp-port", String(cdp.port)]); // 启动 daemon，并传入 CDP 端口
  child.unref(); // 让 daemon 作为后台进程继续运行
  await waitUntilHttpStatusOk(); // 等待 daemon 写入 daemon.json 并能响应 /status
} // daemon 启动流程结束
```

这里的关键设计不是“有一个后台进程”本身，而是：

**所有入口都收敛到 daemon，再由 daemon 维护一个稳定的浏览器连接。**

这样 CLI、MCP、provider 不需要各自连接 Chrome，不需要各自实现 tab 状态，也不需要各自监听 network / console / error 事件。

## 4. 浏览器发现：它不是只找一个固定端口

`packages/cli/src/cdp-discovery.ts` 是一个很现实的文件。

它解决的问题是：用户机器上的浏览器状态并不统一。

有的人已经有带 remote debugging port 的 Chrome，有的人没有；有的人用 OpenClaw 浏览器，有的人只装了 Chrome / Edge / Brave；有的人之前由 bb-browser 启动过托管浏览器，有的人第一次运行。

所以它按优先级尝试：

1. `BB_BROWSER_CDP_URL` 环境变量
1. 命令行 `--port`
1. `~/.bb-browser/browser/cdp-port`
1. 临时缓存
1. OpenClaw
1. 自动启动一个托管 Chrome / Edge / Brave

这说明作者把“第一次跑起来”看得很重。

不过这里也有一个安全含义：

**CDP 是高权限浏览器控制通道。谁能连上 CDP，谁就能控制浏览器页面。**

bb-browser 默认让 daemon 监听 `127.0.0.1:19824`，并在 `daemon.json` 里写入 token；这是合理的本地默认值。README 里也提到可以用 `--host 0.0.0.0` 监听所有网卡，但这只适合你明确知道网络边界的场景，比如通过 Tailscale / ZeroTier 做受控访问。

对普通使用者来说，建议很简单：

- 默认只绑定 `127.0.0.1`
- 不要把 daemon 暴露到公网
- 不要随便执行来历不明的 adapter
- 涉及真实账号时保持低频和可解释

## 4.1. 登录态复用：user-data-dir、profile 和调试端口到底是什么

{% asset_img figure-07.svg %}

补一个很容易被 README 里的“复用登录态”带偏的问题：

**bb-browser 默认复用的是它自己管理的 Chrome profile，不是你平时那个已经开着的日常 Chrome profile。**

我在 2026-04-30 用本机安装的 `bb-browser@0.11.3` 验证过一次。`bb-browser status --json` 一开始返回 `{"running": false}`，执行 `bb-browser open about:blank` 后，它会启动一个受管 Chrome，并把 CDP 连接交给 daemon。这个受管 Chrome 的用户数据目录不是日常 Chrome 的默认目录，而是：

```text
~/.bb-browser/browser/user-data # bb-browser 默认创建和复用的 Chrome 用户数据根目录
```

这里需要把三个概念分开。

第一，`user-data-dir` 是 Chrome 用户数据根目录。

它像一个总仓库，里面放浏览器级别的状态，也放一个或多个 profile。macOS 上日常 Chrome Stable 的默认根目录通常是：

```text
~/Library/Application Support/Google/Chrome # Chrome Stable 的默认用户数据根目录
```

第二，profile 是这个根目录里的某个浏览器身份。

比如：

```text
Default # 第一个或默认 profile
Profile 1 # 另一个浏览器身份
Profile 2 # 再另一个浏览器身份
```

所以更准确的关系是：

```text
user-data-dir # 整个 Chrome 用户数据根目录
├── Local State # 多个 profile 共享的一些浏览器状态
├── Default # 一个具体 profile
├── Profile 1 # 另一个具体 profile
└── Profile 2 # 再另一个具体 profile
```

一个 profile 很接近“一个浏览器本地账号”，但它不等于 Google 账号。它可以不登录 Google 账号，也可以登录某个 Google 账号做同步。对 bb-browser 更关键的是：网站 Cookie、localStorage、IndexedDB、扩展配置和很多本地状态都跟 profile 绑定。你在日常 Chrome 的 `Profile 1` 里登录了网站，并不意味着 bb-browser 的 `~/.bb-browser/browser/user-data/Default` 里也登录了。

第三，`remote-debugging-port` 是让 Chrome 暴露 CDP 控制通道。

概念上可以理解成下面这个讲解版对象：

```ts
const chromeLaunch = { // 用对象解释一次可被自动化工具连接的 Chrome 启动方式
  executable: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // Chrome 可执行文件
  remoteDebuggingPort: 19825, // Chrome 在本机监听的 CDP 调试端口
  userDataDir: "$HOME/.chrome-bb-profile", // 这次启动要使用的用户数据根目录
}; // 启动参数说明结束
```

Chrome 进程监听端口之后，bb-browser 可以通过下面两种方式接入：

```ts
const bbBrowserConnect = { // 用对象解释 bb-browser 连接已有 Chrome 的两种入口
  cliPort: "bb-browser open https://example.com --port 19825", // 命令行显式指定 CDP 端口
  envUrl: "BB_BROWSER_CDP_URL=http://127.0.0.1:19825 bb-browser open https://example.com", // 环境变量显式指定 CDP 地址
}; // 连接方式说明结束
```

但是这里有一个 2025 年之后很重要的 Chrome 安全变化。

Chrome 从 136 开始限制默认用户数据目录上的 `--remote-debugging-port` 和 `--remote-debugging-pipe`。如果你尝试对日常默认目录打开远程调试端口，Chrome 会不再尊重这些开关；官方要求调试场景显式提供一个非默认的 `--user-data-dir`。这样做的原因很直接：CDP 权限太高，如果默认 profile 可以随便被调试端口接管，攻击者就有机会读取 Cookie 和凭证。

这解释了一个看似矛盾的现象：

- bb-browser 说它能复用登录态
- 但默认情况下，它没有直接复用你平时 Chrome 已经登录好的所有网站

两句话都对。

bb-browser 能复用登录态，指的是复用它当前连接的 Chrome profile 里的登录态。默认受管浏览器第一次启动时，这个 profile 可能是空的，所以需要登录一次。登录完成后，Cookie 存在 `~/.bb-browser/browser/user-data` 里，后续 bb-browser 再启动就能继续用。

如果你希望“人和 Agent 共用一个自动化浏览器身份”，更稳妥的做法不是硬接日常 Chrome 默认 profile，而是建一个专门的共享 profile：

```ts
const sharedAutomationProfile = { // 用对象描述推荐的共享自动化 profile
  userDataDir: "$HOME/.chrome-bb-profile", // 独立于日常 Chrome 的用户数据根目录
  purpose: "给本人和 bb-browser 共用的自动化浏览器身份", // 这个目录的用途
  firstStep: "手动登录一次需要的网站", // 首次使用时仍然需要登录
  laterUse: "以后通过同一个 CDP 端口让 bb-browser 连接", // 后续复用同一套 Cookie 和本地状态
}; // 共享 profile 方案说明结束
```

这样既避免了重复登录太多次，也不会把日常 Chrome 里所有账号、扩展、历史和敏感数据都暴露给自动化调试通道。

所以这一节可以压成一句实践建议：

**不要把“复用登录态”理解成“直接接管我的日常 Chrome”。更稳的理解是：给 Agent 一个专门的 Chrome profile，让它在这个受控身份里长期复用登录态。**

## 5. 协议模型：Request / Response 是所有入口的共同语言

{% asset_img figure-04.svg %}

`packages/shared/src/protocol.ts` 定义了 bb-browser 内部最重要的通信协议。

请求大概长这样：

- `id`
- `action`
- `url`
- `ref`
- `text`
- `script`
- `tabId`
- `networkCommand`
- `since`
- 其他命令参数

响应大概长这样：

- `id`
- `success`
- `data`
- `error`

这层协议有两个价值。

第一，它把 CLI 和 daemon 解耦了。

CLI 不需要知道 `click` 最后要调用哪些 CDP 方法，只需要发 `{ action: "click", ref: "3" }`。

第二，它让 MCP 工具可以复用同一套动作。

`packages/shared/src/commands.ts` 里还有一个 `COMMANDS` 注册表。它不仅描述命令名，也描述参数 schema、分类和说明。MCP server 会遍历这个注册表，把普通浏览器命令自动注册成 `browser_open`、`browser_snapshot`、`browser_click` 等工具。

讲解版代码如下：

```ts
const command = { // 单个命令的统一描述
  name: "click", // 对外展示的命令名
  action: "click", // 发给 daemon 的协议动作名
  category: "interact", // 这个命令属于交互类能力
  args: z.object({ // 用 schema 描述参数形状
    ref: z.string(), // ref 来自上一次 snapshot
    tab: z.string().optional(), // tab 可选，用来指定具体标签页
  }), // 参数 schema 结束
}; // 命令注册项结束
```

这是一种很适合 Agent 工具的设计：

**命令不是散落在 CLI 帮助文本里的字符串，而是结构化元数据。**

有了结构化元数据，CLI、MCP、provider 才能从同一个源头生成不同入口。

## 6. Snapshot 和 `@ref`：让 Agent 不靠坐标也能点页面

很多浏览器自动化工具的难点不在“能不能点”，而在“Agent 怎么知道点哪里”。

bb-browser 的做法是：

1. daemon 向页面注入 `buildDomTree.js`
1. 页面返回一个 DOM 树和节点 map
1. daemon 把节点转换成文本 snapshot
1. 对可交互元素分配高亮序号
1. 返回类似 `button [ref=5] "提交"` 的文本
1. 后续 `click @5` 时，把 ref 解析回 XPath / backend node
1. 再通过 CDP 派发鼠标事件

这个设计非常 Agent 友好。

Agent 不需要猜 CSS selector，也不需要依赖屏幕坐标。它先读结构化文本，再用 `@ref` 表达意图。

讲解版点击流程如下：

```ts
async function clickByRef(request) { // 处理一次点击请求
  const tab = getCurrentTab(request.tabId); // 根据 tabId 找到目标标签页
  const refInfo = tab.refs[request.ref]; // 从最近一次 snapshot 缓存里取 ref 信息
  if (!refInfo) throw new Error("Run snapshot first"); // ref 不存在时要求先重新 snapshot
  const nodeId = await resolveXPath(refInfo.xpath); // 用 XPath 找回 CDP 可操作的 backend node
  const point = await getCenterPoint(nodeId); // 在页面里计算元素中心点
  await dispatchMouse(point.x, point.y); // 通过 CDP 派发鼠标移动、按下、释放事件
  tab.recordAction(); // 记录一次用户动作序号，供后续增量观察使用
} // ref 点击流程结束
```

它也有边界：

- 页面跳转后旧 ref 可能失效
- DOM 动态更新后应该重新 `snapshot`
- 有些 canvas / shadow DOM / 复杂 iframe 页面仍然需要特殊处理
- 如果只是读正文，`eval document.body.innerText` 往往比 snapshot 更直接

所以 bb-browser 不是只提供 snapshot。它同时提供 `eval`、`fetch`、`network`、`console`、`errors`、`screenshot`，让 Agent 能在不同粒度之间切换。

## 7. site adapter：把网站功能做成可复用命令

{% asset_img figure-05.svg %}

如果只看浏览器控制，bb-browser 像一个 CDP CLI。

但加上 `site adapter` 之后，它的定位就变了：

**它开始把“某个网站上的某个能力”封装成稳定命令。**

比如：

- `bb-browser site zhihu/hot`
- `bb-browser site github/repo epiral/bb-browser`
- `bb-browser site arxiv/search "transformer"`
- `bb-browser site youtube/transcript VIDEO_ID`
- `bb-browser site xueqiu/hot-stock 5`

adapter 是一个 JS 文件，里面有两部分：

- `@meta` 元数据：名称、描述、域名、参数、示例
- `async function(args)`：真正运行在浏览器 tab 里的逻辑

bb-browser 会扫描两个目录：

- `~/.bb-browser/sites/`：私有 adapter，优先级更高
- `~/.bb-browser/bb-sites/`：社区 adapter，由 `site update` 克隆或更新

执行时它会：

1. 根据 adapter 名称找到 JS 文件
1. 解析 `@meta`
1. 按元数据检查参数
1. 根据 `domain` 找一个匹配的 tab，没有就打开
1. 移除 meta，只保留函数体
1. 拼成 `(${jsBody})(${argsJson})`
1. 通过 `eval` 在目标 tab 内执行
1. 把返回值解析成 JSON

讲解版 adapter 如下：

```js
const meta = { // adapter 的元数据，供 bb-browser 扫描和展示
  name: "platform/search", // 命令名，一般是 平台/动作
  domain: "www.example.com", // 目标域名决定 Cookie、同源策略和页面上下文
  args: { query: { required: true } }, // 参数定义让 CLI 和 Agent 知道怎么调用
  readOnly: true, // 标记这个命令只读取数据，不主动写入站点状态
}; // 元数据结束
async function adapter(args) { // adapter 主函数会在真实浏览器 tab 里执行
  if (!args.query) return { error: "Missing query" }; // 先把参数错误变成结构化返回
  const resp = await fetch("/api/search?q=" + encodeURIComponent(args.query), { credentials: "include" }); // 用当前域名和登录态调用站点接口
  if (!resp.ok) return { error: "HTTP " + resp.status, hint: "Please log in first" }; // 把登录或接口错误交给 Agent 判断
  return await resp.json(); // 返回结构化数据，而不是让 Agent 解析页面
} // adapter 主函数结束
```

这就是 bb-browser 最有价值的抽象：

**不是每次都让 Agent 临场操作网页，而是把高频网站能力沉淀成命令。**

它和传统 API client 又不完全一样。API client 通常要自己处理认证和签名；adapter 则可以复用浏览器已经有的登录态、页面 JS、前端 store 和请求拦截器。

`bb-sites` 的设计文档里还把 adapter 分成三种接入层：

- 调站点自己的前端函数或 store
- 直接调站点 API
- 解析 HTML / DOM

越靠近站点已有数据层，通常越稳定；越依赖 CSS class 和 DOM 结构，越容易被改版影响。

## 8. Network / Console / Errors：它不只做动作，也做观察

{% asset_img figure-06.svg %}

Agent 操作浏览器时，最麻烦的事情之一是“我点完以后到底发生了什么”。

人类可以看页面变化，开发者可以开 DevTools，但 Agent 需要机器可读的反馈。

bb-browser 的 daemon 会在每个 tab 上维护几类事件缓存：

- network requests
- console messages
- JavaScript errors

这些缓存不是无限增长的，而是用 ring buffer 限定容量：

- network：最多 500 条
- console：最多 200 条
- errors：最多 100 条

同时每个事件都会拿到一个全局递增的 `seq`。用户动作也会记录 `lastActionSeq`。

这就允许 Agent 做增量观察：

- `network requests --since last_action`
- `console --since last_action`
- `errors --since last_action`

讲解版数据结构如下：

```ts
class TabState { // 每个浏览器标签页都有一份状态
  networkRequests = new RingBuffer(500); // 缓存最近的网络请求
  consoleMessages = new RingBuffer(200); // 缓存最近的控制台消息
  jsErrors = new RingBuffer(100); // 缓存最近的 JS 错误
  lastActionSeq = 0; // 记录最近一次主动操作的序号
  recordAction() { // 每次点击、输入、导航都会调用
    this.lastActionSeq = nextSeq(); // 用全局递增序号标记动作发生点
    return this.lastActionSeq; // 把序号返回给调用方
  } // 动作记录结束
} // 标签页状态结束
```

这个机制对调试和逆向都很有用。

比如写 adapter 时，可以先清空网络记录，再刷新页面，然后只看刷新之后的 API 请求。Agent 不需要在一堆历史请求里翻找，而是只消费“上一个动作之后发生了什么”。

这也是它比简单 `eval` 包装更完整的地方：

**它在给 Agent 提供一个小型 DevTools，而不只是提供一个 JS 执行器。**

## 9. MCP：把同一套浏览器能力交给 Agent

bb-browser 的 MCP server 在 `packages/mcp/src/index.ts`。

它做了两类事。

第一类是普通浏览器工具。

它遍历 `COMMANDS` 注册表，把命令转换成 MCP tools：

- `browser_open`
- `browser_snapshot`
- `browser_click`
- `browser_fill`
- `browser_eval`
- `browser_network`
- `browser_console`
- `browser_errors`
- `browser_screenshot`

第二类是 site 工具。

site 命令不直接走 daemon 的 `COMMANDS` 注册表，而是通过 CLI 执行：

- `site_list`
- `site_search`
- `site_info`
- `site_recommend`
- `site_run`
- `site_update`

这种分法很合理。

普通浏览器动作是稳定协议，适合从 shared registry 自动生成。site adapter 是动态社区脚本，安装数量和参数会变化，更适合继续走 CLI 层读取本地 adapter 元数据。

这就是为什么它对 Agent 有吸引力：

**Agent 不只得到一个“浏览网页”的能力，而是得到一组可以搜索、选择、调用、过滤结果的网站命令。**

比如一个研究任务，Agent 可以先用：

- `site_search arxiv`
- `site_run arxiv/search`
- `site_run github/repo`
- `site_run stackoverflow/search`

然后再用普通浏览器能力打开具体页面、读正文、截图或抓请求。

这比单纯让 Agent 自己从搜索框开始点网页要高效得多。

## 10. 工程化：小项目，但边界意识很强

从工程组织看，bb-browser 不算大，但有几个值得注意的点。

第一，monorepo 分包清楚。

`cli`、`daemon`、`mcp`、`shared` 是明确边界。即使最后发布到一个 npm 包里，源码层仍然保持职责分离。

第二，构建入口集中。

根目录 `tsup.config.ts` 把 `cli`、`daemon`、`mcp`、`provider` 打到同一个 `dist`，并把版本号注入 `__BB_BROWSER_VERSION__`。

第三，有 CI 和发布流程。

GitHub Actions 里有：

- `pnpm build`
- `pnpm lint`
- `pnpm test`
- release-please
- npm publish workflow

第四，测试不只测纯函数。

`packages/daemon/src/__tests__` 里有协议漂移测试、生命周期测试、ring buffer 测试、tab state 测试。部分测试需要真实 Chrome CDP，跑不起来时会跳过；另外也有不依赖真实浏览器的状态契约测试。

这说明作者已经意识到一个问题：

**浏览器自动化最怕协议表面和真实返回慢慢漂移。**

如果 CLI、MCP、daemon 的响应结构各自变化，Agent 工具会很难稳定消费。所以它把 `protocol.ts`、`COMMANDS`、daemon response shape 放到了测试关注点里。

## 11. 使用边界：它强在真实上下文，也风险在真实上下文

bb-browser 的优点和风险来自同一个地方：

**它使用你的真实浏览器。**

这意味着它很强：

- 能访问你已经登录的网站
- 能读取登录后页面
- 能调用同源 API
- 能复用前端运行时
- 能让 Agent 更接近真实用户视角

也意味着它需要边界：

- adapter 代码会在浏览器页面上下文里运行
- community adapter 是运行时代码下载和执行
- 如果站点账号有高权限，adapter 能看到的内容也更敏感
- daemon 如果暴露到不可信网络，就等于暴露浏览器控制能力
- `eval` 和 `fetch` 很强，但也应该只对可信任务使用

所以我会把它定位成：

**个人或团队受控环境里的 Agent 浏览器能力层，而不是无约束的数据采集工具。**

实际使用时，比较稳妥的做法是：

- 用独立浏览器 profile 跑自动化
- 只安装和更新可信 adapter
- 对写操作 adapter 保持人工确认
- 对金融、后台管理、生产系统等高风险页面谨慎授权
- 默认只让 daemon 监听 localhost

## 12. 总结：它真正抽象的是“登录后的互联网”

bb-browser 值得看的地方，不是它能不能点击按钮。

点击按钮只是浏览器自动化工具的基本功。

它真正有意思的是这三个抽象：

第一，**真实浏览器上下文**。

它把 Cookie、前端运行时、页面状态、同源 fetch 都保留下来，让 Agent 不必从零模拟一个用户。

第二，**Daemon + CDP 的稳定中转层**。

CLI、MCP、provider 都不用直接管 Chrome 连接，而是通过本地 HTTP 协议请求 daemon。

第三，**site adapter 生态**。

它把网站能力沉淀成可复用命令，让 Agent 不必每次都重新探索网页。

如果用一句话收尾：

**bb-browser 的核心价值，是把“登录后的互联网”从人类浏览器界面里抽出来，变成 Agent 可以调用、观察、组合的一组工具。**

这也是它和普通爬虫、普通 E2E 工具最大的区别。

## 参考材料

- [epiral/bb-browser GitHub 仓库](https://github.com/epiral/bb-browser)
- [epiral/bb-browser 观察 commit](https://github.com/epiral/bb-browser/tree/561c00261981546d2e662329eb1343d072f80ea5)
- [bb-browser npm 包](https://www.npmjs.com/package/bb-browser)
- [epiral/bb-sites GitHub 仓库](https://github.com/epiral/bb-sites)
- [bb-sites 观察 commit](https://github.com/epiral/bb-sites/tree/fce0d3a0a955137004eb5cd24aedb302d7596004)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Chrome for Developers：Changes to remote debugging switches to improve security](https://developer.chrome.com/blog/remote-debugging-port)
- [Model Context Protocol](https://modelcontextprotocol.io/)
