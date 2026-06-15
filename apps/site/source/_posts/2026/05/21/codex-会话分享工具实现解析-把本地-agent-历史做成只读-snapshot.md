---
title: "Codex 会话分享工具实现解析：把本地 Agent 历史做成只读 Snapshot"
date: "2026-05-21 22:25:00"
categories:
  - 技术
tags:
  - Codex
  - Agent
  - Snapshot
  - Claude Code
  - Trae
  - 本地工具
excerpt: "从一次真实需求出发，拆解如何把 Codex、Claude Code 和 Trae 的本地会话历史读取出来，归一成只读 transcript，再用 Markdown 渲染、代码高亮、脱敏、Trae recorder 和站内私有模块组成一个可分享的 Snapshot 工具。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

我最近做了一个小工具：把本机 AI 编码工具里的会话，整理成一个**只读 Snapshot**。它现在能读 `Codex`、`Claude Code` 和 `Trae` 的本地记录，按项目分组展示，支持导出 `HTML` / `Markdown`，也可以作为一个私有模块挂进这个博客站点里。

先给结论：这个工具不是“把原始 thread 分享出去”，也不是“给朋友一个可以继续操作我本机 Codex 的链接”。它做的是更窄的一件事：

1. 只读扫描本机已有会话文件。
2. 把不同工具的历史记录归一成同一种 `turn` 结构。
3. 默认只展示用户和 assistant 的正文消息。
4. 用 `markdown-it` 和 `highlight.js` 渲染 Markdown 和代码块。
5. 图片作为附件嵌入，只要来源足够安全就直接展示。
6. 默认脱敏常见 token、cookie、私钥、本机 home path。
7. 最后输出一个静态、不可继续对话、不可执行命令的审阅页。

{% asset_img figure-01.svg %}

这个需求的起点很朴素：我经常想把一段 Codex 会话发给朋友看。截图太碎，复制文本又丢格式，直接分享原 thread 又涉及权限、隐私和上下文边界。于是更自然的产品形态变成了：**把会话冻结成一份可审阅的只读快照**。

本文记录这套工具的实现方式。代码主要分成两块：

| 模块 | 路径 | 作用 |
| --- | --- | --- |
| 本地 snapshot CLI / server | `tools/codex-snapshot/bin/codex-snapshot.mjs` | 扫描本地会话、归一化 transcript、渲染 HTML / Markdown、启动本地审阅台、注入 Trae recorder |
| 站点私有模块 | `apps/site/app/snapshots/`、`apps/site/components/codex-snapshot-*.tsx` | 在个人博客里嵌入本地 viewer，并提供站内独立窗口 |

## 0. 先把几个词讲清楚

这里的 `Snapshot` 不是系统层面的磁盘快照，也不是 Codex 自己的 thread 分享链接。

它指的是：**从本机会话历史中抽取一份静态 transcript，并把它渲染成一个只读页面。**

几个概念先对齐：

| 词 | 含义 |
| --- | --- |
| `engine` | 会话来源，目前是 `codex`、`claude`、`trae` 三类 |
| `summary` | 列表页需要的轻量信息，比如标题、项目路径、更新时间、消息数 |
| `snapshot` | 点开某条会话后完整加载出来的只读内容 |
| `turn` | 统一后的消息单位，基本等于一条用户消息、assistant 回复或工具调用 |
| `redact` | 默认开启的脱敏步骤，会替换常见密钥、cookie、JWT、本机 home path |
| `recorded` | Trae 特有，表示这条会话来自本地 recorder 捕获，内容更完整 |

这套工具最后有两种入口：

```bash
pnpm snapshot serve --port 4321 # 启动本机只读审阅台
pnpm snapshot export <session-id> --html --output snapshot.html # 导出静态 HTML
```

站点里的 `/snapshots/` 只是一个私有壳层。它不会把本地会话上传到 GitHub Pages，也不会让线上页面凭空读到我的电脑。真正的数据仍然来自本机 `http://127.0.0.1:4321/`。

## 1. 为什么不直接分享原始 thread

如果只是为了“朋友能看”，最简单的方案好像是直接做一个分享链接。但对本地 coding agent 来说，这个方案边界很复杂。

一条会话里可能有：

- 本地路径、用户名、仓库名。
- 截图和图片附件。
- 运行命令的 stdout / stderr。
- 工具调用参数。
- API key、cookie、内部域名、`.env` 文件名。
- 系统提示词、开发者消息、环境上下文。

把原始 thread 直接暴露出去，问题不是“页面好不好看”，而是**权限模型不清楚**。拿到链接的人能不能继续对话？能不能看到工具输出？能不能复用这条会话的上下文？这些问题都很危险。

所以我给这个 MVP 设了一个很窄的产品边界：

| 需求 | 取舍 |
| --- | --- |
| 朋友只需要阅读 | 输出静态页面，不提供继续对话入口 |
| 我需要先审阅 | 本地 viewer 先预览，再决定是否导出 |
| 会话可能很敏感 | 默认脱敏，并且默认隐藏工具调用和工具输出 |
| 不同 agent 记录格式不同 | 统一到 `summary -> snapshot -> turns` 三层 |
| 页面要像 Codex | 用户消息靠右、assistant 靠左、保留 Markdown 和代码高亮 |

这也是它叫 `read-only snapshot` 的原因：分享的是一个冻结后的观察结果，不是一个仍然活着的 agent runtime。

## 2. 总体架构：本地服务负责数据，站点模块负责入口

完整链路大概长这样。

{% asset_img figure-02.svg %}

`tools/codex-snapshot` 是核心。它既可以当 CLI 用，也可以启动一个本地 HTTP 服务：

```js
if (parsed.command === "serve") { // 用户选择启动本机 Web 审阅台
  const port = parsed.options.port || 4321; // 没传端口时默认使用 4321
  const host = parsed.options.host || "127.0.0.1"; // 默认只监听本机回环地址
  await serve({ codexHome, claudeHome, traeHome, traeAppHome, traeRecordingsDir, host, port }); // 把本地会话目录交给只读服务
  return; // 服务模式启动后不再继续执行导出分支
} // serve 命令分支结束
```

这个本地服务提供几个关键接口：

| 接口 | 作用 |
| --- | --- |
| `/` | 返回完整的本地审阅台 HTML、CSS 和前端 JS |
| `/api/sessions` | 列出本机可展示的会话摘要 |
| `/api/snapshot?id=...` | 加载某条会话的完整 transcript |
| `/export?id=...&format=html` | 导出静态 HTML |
| `/export?id=...&format=md` | 导出 Markdown |

博客站点这边只做外壳：

- `/snapshots/`：私有模块页，展示标题、连接状态和 iframe。
- `/snapshots/viewer/`：站内独立窗口，地址栏仍然停在站点路径下。
- iframe 内部：真正加载 `http://127.0.0.1:4321/`。

这样做有一个好处：我可以把这个工具挂进自己的博客导航里，但不会把私有会话数据放到构建产物里。

站点组件里最关键的代码其实很短：

```tsx
<Link href={standaloneHref} target="_blank" rel="noreferrer"> {/* 独立窗口打开站内 /snapshots/viewer/ */}
  <span>打开独立窗口</span> {/* 用户看到的是产品入口，不是 4321 本地端口 */}
</Link> {/* 站内跳转链接结束 */}
<iframe src={viewerUrl} title="Codex Snapshot Viewer" /> {/* iframe 内部再加载本机 viewer */}
```

之前我把按钮直接指向 `viewerUrl`，也就是 `http://127.0.0.1:4321/`。技术上能用，但产品上很怪：用户明明在博客模块里，点一下却跳到另一个本地服务地址。后来改成了 `/snapshots/viewer/`，让站点路由负责“独立窗口”这个语义。

## 3. 会话列表：先按来源读，再按项目归组

真正麻烦的是数据来源。

`Codex`、`Claude Code`、`Trae` 的本地记录位置和结构都不一样：

| 来源 | 主要读取位置 | 完整度 |
| --- | --- | --- |
| Codex | `~/.codex/sessions`、`~/.codex/archived_sessions`、`session_index.jsonl` | 比较完整 |
| Claude Code | `~/.claude/projects`、`~/.claude/sessions`、`history.jsonl` | transcript 文件完整，history 只有用户输入 |
| Trae | `~/.trae-cn`、`~/Library/Application Support/Trae CN`、`~/.codex-snapshot/trae-recordings` | 本地存储不稳定，recorder 最完整 |

列表页的第一步是把三类来源并行读出来：

```js
const [codexSessions, claudeSessions, traeSessions] = await Promise.all([ // 三类来源可以并行扫描
  listCodexSessions({ codexHome, limit, cwd, includeArchived }), // 读取 Codex sessions 和 archived_sessions
  listClaudeSessions({ claudeHome, limit, cwd }), // 读取 Claude Code transcript 和 history
  listTraeSessions({ traeHome, traeAppHome, traeRecordingsDir, limit, cwd }), // 读取 Trae recorder、memory 和 input history
]); // 并行扫描结束
```

但列表里不能把所有东西都混在一起。后来页面被改成了三个大模块：

- `Codex`
- `Claude Code`
- `Trae`

切换来源后，只渲染对应来源的项目和会话。每个来源内部再按项目路径分组。这个交互很像 Codex 左侧的项目栏：项目是一级分组，会话是项目下面的行。

我还做了一个完整度过滤。原因是 Claude Code 和 Trae 都可能出现“只有 history，没有 assistant 回复”的记录。它们可以用于搜索线索，但不适合当作可分享 transcript。

```js
function isCompleteSessionSummary(summary) { // 判断列表里这条记录是不是完整 transcript
  if (summary.engine === "claude") return summary.sourceKind === "transcript"; // Claude history 只有用户输入，不默认展示
  if (summary.engine === "trae") return summary.sourceKind === "recorded"; // Trae 只有 recorder 捕获才算完整
  return true; // Codex JSONL 默认认为是完整会话
} // 完整度判断结束
```

这就是为什么后来我把 `history` badge 相关的记录从默认 UI 里拿掉了。用户进入这个工具时，应该优先看到“能分享的完整会话”，而不是一堆只有标题或只有输入的问题片段。

## 4. 从 JSONL 到 turns：只保留可阅读的正文

会话文件不能直接渲染。

比如 Codex 的 JSONL 里有 `session_meta`、`response_item`、tool call、tool output、环境注入消息、图片 marker 等。真正适合朋友阅读的，是用户消息和 assistant 回复。

于是加载 Codex snapshot 时，会做几层过滤：

```js
if (item.type === "message") { // 只处理自然语言消息
  if (item.role !== "user" && item.role !== "assistant") continue; // 跳过 system、developer 等非正文角色
  const message = extractMessageParts(item); // 从 content 里拆出正文和图片附件
  if (isBootstrapUserMessage(item.role, message.text)) continue; // 跳过 AGENTS.md 和环境上下文注入
  const text = redact ? redactText(message.text) : message.text; // 根据开关决定是否脱敏
  turns.push({ role: item.role, text, html: renderMarkdownHtml(text), images: message.images }); // 写入统一 turn
} // message 分支结束
```

图片也是在这一层处理的。早期页面只显示 `<image>` 和 `</image>`，看起来很难受。后面改成了从内容结构里提取 `image_url` / `imageUrl` / `url`，并生成附件卡片。

工具调用和工具输出默认不展示。不是因为它们不重要，而是因为它们太容易包含路径、命令输出、内部配置和临时文件内容。UI 上有 `Tools` 和 `Output` 两个开关，只有主动打开时才进入 transcript。

这层归一化之后，后面的 HTML 渲染就不再关心来源。它只消费一种结构：

```text
snapshot
  title
  engineLabel
  displayCwd
  risks
  notices
  turns[]
    role: user | assistant | tool
    text
    html
    images[]
```

## 5. Markdown 渲染：不要自研语法

这个工具一开始最大的问题之一，是 Markdown 没有正确解析。`**bold**` 还是原样显示，代码块也没有高亮。后来我把自研的简单文本拆段逻辑换成了成熟库：

```js
const markdownRenderer = markdownit({ // 创建 Markdown 渲染器
  breaks: true, // 保留聊天里常见的软换行习惯
  html: false, // 不允许原始 HTML 直接进入页面
  linkify: true, // 把 URL 自动识别成链接
  highlight: renderHighlightedCode, // 代码块交给 highlight.js 处理
}); // Markdown 渲染器配置结束
```

代码高亮也单独做了语言归一：

```js
function renderHighlightedCode(source, rawLanguage) { // 渲染 fenced code block
  const language = normalizeMarkdownLanguage(rawLanguage); // 把 ts、tsx、js 等别名转成 highlight.js 支持的语言
  const code = String(source || ""); // 保证传给高亮器的是字符串
  const html = language ? hljs.highlight(code, { language, ignoreIllegals: true }).value : escapeHtml(code); // 有语言就高亮，否则安全转义
  return `<pre data-language="${language || "text"}"><code class="hljs">${html}</code></pre>`; // 返回带语言标签的代码块
} // 代码高亮函数结束
```

这一步很关键。会话分享不是纯文本导出，读者真正想看的通常是：

- 模型解释的 Markdown 列表。
- 代码片段。
- diff 或命令输出。
- 链接。
- 图片。

如果这些格式都丢了，那 snapshot 只会比截图略好一点。

## 6. Trae 为什么要单独做 recorder

Codex 和 Claude Code 至少有比较明确的本地 transcript 文件。Trae 麻烦得多。

我在本机能读到三类 Trae 相关信息：

| 类型 | 问题 |
| --- | --- |
| input history | 大多只有用户输入，没有 assistant 回复 |
| memory summary | 像任务记忆，不是完整对话 |
| 页面 / 网络流 | 只有运行时能看到完整请求、响应和流式增量 |

所以 Trae 最终加了一层显式的本地 recorder：

```bash
pnpm snapshot record-trae --port 4732 # 启动只监听本机的 Trae 捕获服务
```

然后在 Trae 聊天窗口的 DevTools 里注入：

```js
import("http://127.0.0.1:4732/trae-recorder.js") // 把 recorder 注入当前 Trae 页面
```

{% asset_img figure-03.svg %}

这个 recorder 做几件事：

1. hook `fetch`，捕获请求体、响应体和响应流 chunk。
2. hook `WebSocket`，捕获发送和接收消息。
3. hook `EventSource`，捕获 SSE 消息。
4. 用 DOM 兜底捕获页面上已经渲染出的用户 / assistant 文本。
5. 从 URL、history state、localStorage、DOM attribute、网络 payload 中尽量提取真实 session id。
6. 把事件写进 `~/.codex-snapshot/trae-recordings/*.jsonl`。

这里有一个很现实的细节：如果无法识别真实 session id，新线程可能会被写进同一个临时 capture 文件里。后来我加了 `actualSessionId`、`captureSessionId`、`domThreadId` 和 alias migration，优先用 Trae 网络请求或页面状态里的真实 conversation / session id 作为文件 id，减少不同线程被合并的问题。

服务端保存事件时也会做一次规整：

```js
const actualSessionId = extractActualTraeSessionId(sessionEvent) || ""; // 从事件里提取真实 Trae 会话 ID
const captureSessionId = extractTraeCaptureSessionId(sessionEvent, actualSessionId) || ""; // 计算本地捕获会话 ID
const captureFileId = safeCaptureId(captureSessionId || actualSessionId || pageSession); // 优先用真实 ID 作为文件名
const filePath = path.join(traeRecordingsDir, `${captureFileId}.jsonl`); // 写入本机 recorder 目录
await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8"); // 追加一行 JSONL 捕获事件
```

同时 recorder 默认不保存 header。只有显式传 `--record-sensitive-context` 时，才会把 request / response headers 写进本地 JSONL。这是为了把“捕获完整消息”和“无意保存 cookie/token”分开。

Trae 回复里还有一个奇怪问题：有些代码块会被页面或流式内容拆平，语言、行号、代码散成多行。为此工具里加了 `repairTraeFlattenedCodeBlocks`，把类似：

```text
typescript
1
2
3
export interface Foo {
...
```

重新修成 fenced code block。否则 Markdown 渲染器再好，也只能渲出一堆孤零零的数字。

## 7. 页面形态：左侧像项目栏，右侧像 Codex transcript

这个工具的 UI 后来也迭代了不少。

一开始我做的是最直接的两列布局：左侧会话列表，右侧内容。很快就暴露出几个体验问题：

- 左右滚动条互相耦合。
- 会话列表没有按项目归组。
- 三个来源混在一起。
- Markdown 不解析。
- 图片无法展示。
- user / assistant 标签显得多余。
- 代码块没有高亮。
- 左右分栏宽度不能拖。

最终形态更接近 Codex：

{% asset_img figure-04.svg %}

左侧：

- 顶部是来源切换：`Codex` / `Claude Code` / `Trae`。
- 每个来源内部按项目路径分组。
- 项目下面展示最近几条会话，太多时折叠。
- 搜索可以匹配来源、项目、路径、标题、session id。

右侧：

- 顶部显示只读审阅标题和开关。
- user 消息靠右，浅绿色气泡。
- assistant 消息靠左，正文不再额外显示 `ASSISTANT #2`。
- Markdown 和代码块直接渲染。
- 图片以附件卡片展示。
- 加载 snapshot 时显示转圈 loading。

分栏拖拽也只是一段很朴素的 pointer 逻辑：

```js
splitter.addEventListener("pointerdown", (event) => { // 用户按下中间分割线
  app.classList.add("resizing"); // 给页面加 resizing 状态，避免选中文字
  splitter.setPointerCapture(event.pointerId); // 把后续指针事件锁到分割线上
  window.addEventListener("pointermove", onPointerMove); // 移动时更新左侧宽度
  window.addEventListener("pointerup", stopResize); // 松手时结束拖拽
}); // 分割线 pointerdown 监听结束
```

这里我没有用复杂布局库。因为需求很明确：左栏固定可拖，右栏吃剩余空间，移动端改成上下布局。CSS 自定义属性 `--sidebar-width` 足够用了。

## 8. 站点私有模块：线上有入口，但数据仍在本机

把这个页面挂进博客时，我没有把它做成公开文章页，而是做成私有模块。

`RootChrome` 里把 `/snapshots` 放进私有路由，同时对 `/snapshots/viewer` 做特殊处理：独立 viewer 不走普通博客头尾，也不显示桌宠或其他站点装饰。

```tsx
if (isSnapshotStandaloneRoute(pathname)) { // 命中 /snapshots/viewer 独立窗口
  return <PrivateFeatureAccessProvider>{children}</PrivateFeatureAccessProvider>; // 只保留私有访问壳层
} // 独立窗口分支结束
```

这里容易误解的一点是：**线上页面本身看不到我的本地会话。**

GitHub Pages 部署出去的只是 React 页面和 iframe 壳。真正的 transcript 仍然由我本机的 `pnpm snapshot serve --port 4321` 提供。所以：

- 我自己在本机打开 `http://127.0.0.1:3000/snapshots/`，可以看到数据。
- 朋友打开线上 `/snapshots/`，不会读取到我的 Mac。
- 如果我要分享某条会话，应该导出静态 HTML / Markdown，再发导出的文件或内容。

这个边界很重要。它让“站点模块化”和“数据不出本机”可以同时成立。

## 9. 安全边界：它降低风险，但不能代替人工 review

这个工具现在有几条默认保护：

| 保护 | 说明 |
| --- | --- |
| 只读 | 不写回 Codex / Claude / Trae 原始会话文件 |
| 本机监听 | 默认 `127.0.0.1`，不是公网服务 |
| 静态导出 | HTML / Markdown 不能继续操作原 thread |
| 默认隐藏工具 | 工具调用和工具输出要手动打开 |
| 默认脱敏 | 替换 JWT、Bearer、OpenAI key、AWS key、私钥、home path 等 |
| 来源完整度过滤 | Claude history / Trae input history 不作为默认可分享 transcript |
| header 不默认保存 | Trae recorder 不默认持久化 cookie / authorization header |

但它不是万能脱敏器。

比如模型回复里如果描述了某个内部服务名、业务规则、截图内容，正则不一定知道那是敏感信息。图片附件也可能包含隐私。最稳的分享流程仍然是：

1. 本地打开 snapshot。
2. 自己完整读一遍。
3. 必要时关闭工具输出。
4. 导出 HTML / Markdown。
5. 再把导出结果发给朋友。

安全上真正值得坚持的原则是：**工具只能帮你减少漏看，不能替你判断什么可以公开。**

## 10. 这个小工具真正解决了什么

回到最初的问题：我想把 Codex 会话分享给朋友。

做完以后，我觉得这个工具解决的不是“分享链接”这么一个按钮，而是四个小问题：

1. **格式问题**：Markdown、代码高亮、图片都能保留下来。
2. **边界问题**：朋友看到的是静态内容，不是可继续执行的 thread。
3. **来源问题**：Codex、Claude Code、Trae 都能进入同一个阅读界面。
4. **产品问题**：它既能作为独立本地工具，也能挂在自己的博客站点里。

如果继续往后做，我会优先补三件事：

- 做一个“生成公开分享包”的命令，把 HTML、图片、元数据打成一个目录。
- 支持手动勾选要分享的 turn，而不是整条会话全量导出。
- 给导出结果生成一个更明确的审阅清单，例如“包含图片、包含路径、包含工具输出、包含疑似密钥”。

现在这个 MVP 已经足够服务日常使用：当我和 Codex 讨论出一段有价值的排查过程、设计过程或代码解释时，不需要再靠截图拼长图。启动本地 viewer，选中会话，审阅一下，导出静态页面就可以发给朋友了。

这可能也是 agent 工具接下来都会需要的一个小能力：**会话不是只能继续执行，也应该能被整理、冻结、审阅和分享。**
