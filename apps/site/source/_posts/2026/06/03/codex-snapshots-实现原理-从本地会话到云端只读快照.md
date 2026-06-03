---
title: "Codex Snapshots 实现原理：从本地会话到云端只读快照"
date: "2026-06-03 22:10:00"
categories:
  - 技术
tags:
  - Codex
  - Agent
  - Snapshot
  - Claude Code
  - Trae
  - 本地工具
  - GitHub OAuth
excerpt: "从 codex-snapshots 独立仓库出发，拆解它如何扫描 Codex、Claude Code 和 Trae 的本地历史，归一成只读 transcript，通过风险检测、脱敏和 HTML 净化守住分享边界，再用本地 Viewer、静态导出和云端 Share API 组成完整发布链路。"
cover: "cover-v1.svg"
coverPosition: "below-title"
---

## 摘要

`codex-snapshots` 做的是一件很克制的事：**把本机 AI 编码工具里的会话历史，冻结成可审阅、可导出、可选发布的只读快照**。

它不是远程控制 Codex，也不是把原始 thread 原封不动上传到云端。它的实现更像一条分层流水线：

1. 命令行入口先决定是 `list`、`preview`、`export`、`serve`、`publish`、`daemon` 还是 `record-trae`。
2. 本地数据源层读取 `Codex`、`Claude Code`、`Trae` 三类历史记录。
3. 列表页只扫轻量 `summary`，点开时才加载完整 `snapshot`。
4. 快照构建层把不同 JSONL / history / recorder 结构归一成 `turns`。
5. 默认只展示用户和 assistant 正文；工具调用和工具输出需要显式打开。
6. 风险检测、脱敏和 HTML 净化分三层做，避免把密钥、私有路径和危险 HTML 带出去。
7. 本地 Viewer 监听 `127.0.0.1:4321`，负责审阅、导出和发起发布。
8. 云端 Share API 只接收已脱敏快照，并再次移除本地路径、净化 HTML、绑定发布者身份。

{% asset_img figure-01.svg %}

本文分析的仓库是：

| 项 | 值 |
| --- | --- |
| 仓库路径 | `/Users/bytedance/Code/codex-snapshots` |
| 观察日期 | `2026-06-03` |
| 观察 commit | `acb51b3cef05728a96184f7d1fa886c7cb4a3a8c` |
| npm 包名 | `codex-snapshots` |
| 当前版本 | `0.1.3` |

这篇不是 Codex 官方客户端源码解析，而是 `codex-snapshots` 这个独立工具的实现拆解。它最值得学习的地方，是如何把“本地私密数据”包装成一个有明确边界的可分享制品。

## 0. 先把几个词讲清楚

这套工具里最核心的词有五个。

| 词 | 含义 |
| --- | --- |
| `summary` | 列表页用的轻量摘要，包含标题、来源、项目路径、更新时间、消息数和风险计数 |
| `snapshot` | 点开某条会话后加载出来的完整只读快照 |
| `turn` | 归一后的消息单位，可以是用户消息、assistant 回复或工具信息 |
| `risk` | 在原文里检测到的敏感模式，比如私钥、JWT、Bearer token、本机 home path |
| `share` | 已经脱敏并发布到独立 Share API 的公网只读记录 |

这里的 `Snapshot` 不是文件系统快照，也不是 Agent 运行时状态。它只是从本地历史里抽出一份 transcript，再渲染成一个不能继续对话、不能执行命令的审阅页面。

这个定义很重要。因为 Coding Agent 会话里经常混着系统提示词、工具参数、命令输出、路径、截图、token 和内部域名。如果产品边界说不清楚，“分享会话”很容易变成“泄漏运行现场”。

## 1. 命令入口：一套 CLI 连接三种运行形态

项目的入口是 `src/cli/codex-snapshot.mts`。`package.json` 里把两个命令都指向构建后的 CLI：

| bin | 指向 |
| --- | --- |
| `codex-snapshot` | `dist/cli/codex-snapshot.mjs` |
| `codex-snapshots` | `dist/cli/codex-snapshot.mjs` |
| `codex-snapshot-share` | `dist/server/share-api.mjs` |

CLI 启动后先解析参数，再把三类工具的 home 目录收敛出来：

| 工具 | 默认目录 |
| --- | --- |
| Codex | `$CODEX_HOME` 或 `~/.codex` |
| Claude Code | `$CLAUDE_HOME` 或 `~/.claude` |
| Trae | `$TRAE_HOME` 或 `~/.trae-cn` |
| Trae 应用数据 | `$TRAE_APP_HOME` 或 `~/Library/Application Support/Trae CN` |
| Trae recorder | `$TRAE_RECORDINGS_DIR` 或 `~/.codex-snapshot/trae-recordings` |

裁剪后的命令分发逻辑大概是这样：

```ts
const homes = resolveAgentHomes(options, process.env); // 先把 Codex、Claude Code、Trae 的本地目录收敛成配置
if (command === "list") return listSessions(homes); // list 只扫描轻量摘要，适合终端查看
if (command === "preview") return loadSnapshot(ref, homes); // preview 加载完整快照，并在终端输出文本预览
if (command === "export") return exportSnapshot(ref, homes); // export 把快照写成 HTML 或 Markdown 文件
if (command === "serve") return serveLocalViewer(homes); // serve 启动 127.0.0.1:4321 的本地审阅台
if (command === "publish") return publishSnapshot(ref, homes); // publish 把已脱敏快照发给 Share API
if (command === "daemon") return manageLaunchAgent(options); // daemon 在 macOS 上安装或管理用户级 LaunchAgent
if (command === "record-trae") return serveTraeRecorder(options); // record-trae 启动 Trae 本地捕获入口
throw new Error(`unknown command: ${command}`); // 其他命令直接报错，避免静默进入未知状态
```

这层的设计很朴素，但边界清楚：

- `list` / `preview` / `export` 是离线能力。
- `serve` 是本机只读审阅台。
- `publish` 是显式出网动作。
- `daemon` 只是让本机 Viewer 在 macOS 登录后保持可用。
- `record-trae` 是 Trae 特有的补充采集方式。

换句话说，CLI 不是一个大杂烩，而是把同一套 snapshot 核心能力投射到三种使用方式上：终端、浏览器、本机后台。

## 2. 数据源：先扫 summary，再按需加载 snapshot

真正复杂的地方在 `src/sources/local-history.mts`。

Codex、Claude Code 和 Trae 的本地记录格式差异很大。如果从 UI 层直接兼容它们，页面会被各种特殊情况拖乱。所以项目先做了一个中间层：所有来源都先变成 `summary` 和 `snapshot`。

{% asset_img figure-02.svg %}

`listSessions` 是列表页的统一入口。它支持按来源读取，也支持 `source=all` 并行扫描：

```ts
const sessions = await Promise.all([ // 三类来源之间没有依赖，所以可以并行扫描
  listCodexSessions(codexHome), // Codex 扫描 sessions 和 archived_sessions 下的 JSONL
  listClaudeSessions(claudeHome), // Claude Code 扫描 projects、sessions 和 history.jsonl
  listTraeSessions(traeHome), // Trae 扫描 recorder、memory 和 input history
]); // 并行扫描结束后得到三组 summary
return sessions.flat().filter(isShareableSummary); // 合并后按完整度过滤，避免默认展示半截会话
```

这里有一个关键取舍：列表页不急着解析完整 transcript。它只读取足够多的行，尽快拿到标题、路径、时间、消息数和风险计数。Codex 甚至会读取 `session_index.jsonl` 给会话补标题。

不同来源的完整度也不一样：

| 来源 | 默认认为可分享的记录 |
| --- | --- |
| Codex | JSONL 会话文件 |
| Claude Code | `projects` / `sessions` 下的完整 transcript |
| Claude history | 只作为 history-only 线索，不默认当完整会话 |
| Trae recorder | 本地 recorder 捕获到的完整记录 |
| Trae memory / input history | 只作为补充线索 |

这个过滤看似只是 UI 细节，其实是在保护产品体验。用户打开工具时最想看到的是“可以分享的完整会话”，不是一堆只有用户输入、没有 assistant 回复的碎片。

## 3. 快照构建：把不同历史格式统一成 turns

点开某条会话后，`loadSnapshot` 会根据 ref 前缀做分发：

| ref 形态 | 加载器 |
| --- | --- |
| `codex:...` 或裸 session id | `loadCodexSnapshot` |
| `claude:...` | `loadClaudeSnapshot` |
| `trae:...` | `loadTraeSnapshot` |

最终返回的结构都长得像这样：

```text
snapshot
  title
  engine
  engineLabel
  displayCwd
  generatedAt
  redacted
  tokenUsage
  risks[]
  notices[]
  turns[]
```

`turns` 是最重要的归一层。无论原始记录来自 Codex JSONL、Claude message content，还是 Trae recorder 的 DOM / fetch / WebSocket 捕获，最后都要变成同一种消息数组。

{% asset_img figure-03.svg %}

Codex 快照加载时，核心过滤链路可以裁成下面这样：

```ts
for await (const row of readJsonl(filePath)) { // 逐行读取本地 JSONL，避免一次性吃掉大文件
  if (row.type !== "response_item") continue; // 只关心 Codex 的 response_item 记录
  const item = row.payload; // 取出真正的消息或工具 payload
  if (item.type !== "message") continue; // 这段裁剪版只展示自然语言消息路径
  if (!["user", "assistant"].includes(item.role)) continue; // 默认跳过 system、developer 和其他内部角色
  const message = extractMessageParts(item); // 从 content 中拆出文本和图片附件
  if (isBootstrapUserMessage(item.role, message.text)) continue; // 跳过启动时注入的环境上下文
  const rawText = stripAppDirectives(message.text); // 去掉 Codex App 的内部指令行
  addRisks(risks, rawText, turnNumber + 1); // 在原文上做风险检测，记录命中的 turn
  const text = redact ? redactText(rawText) : rawText; // 根据开关决定是否替换敏感内容
  turns.push({ role: item.role, text, html: renderMarkdownHtml(text) }); // 写入统一 turn，并生成安全 HTML
} // JSONL 消息读取结束
```

这段代码体现了几个默认安全姿势：

- 先跳过非正文角色。
- 再跳过启动上下文和内部 goal。
- 风险检测基于原文做，避免脱敏后看不到风险类型。
- 展示文本再根据开关脱敏。
- Markdown 渲染后的 HTML 还会继续走净化。

工具调用是另一路。只有打开 `includeTools` 才展示工具信息；只有打开 `includeToolOutput` 才展示工具输出。默认隐藏工具输出不是偷懒，而是因为 stdout / stderr 里经常有本地路径、内部域名、配置片段和临时 token。

Trae 的 recorder 更特殊。它会把 DOM 消息、fetch response chunk、WebSocket message、EventSource message 等捕获事件重组起来。源码里有 `pendingDeltas` 和 `replaceableTurns`，用于处理流式输出和同一消息的后续替换。也就是说，它不是简单地“看到一行就变成一条消息”，而是在尽量还原聊天产品里的最终 transcript。

## 4. 隐私模型：风险检测、脱敏、HTML 净化三层防线

`src/core/privacy.ts` 和 `src/shared/sanitize.ts` 是这套工具的安全底座。

第一层是风险检测。它会标记常见高风险内容：

| 风险 | 示例 |
| --- | --- |
| 私钥块 | `-----BEGIN ... PRIVATE KEY-----` |
| JWT | 三段式 `eyJ...` token |
| API key / secret 赋值 | `api_key=...`、`authorization: ...` |
| Bearer token | `Bearer ...` |
| OpenAI 风格 key | `sk-...` |
| AWS access key | `AKIA...` |
| 本机 home path | 当前用户 home 目录 |
| 内部域名 | `corp`、`internal`、`local`、`bytedance` 等 |
| `.env` 文件 | `.env`、`.env.local` 等 |

第二层是脱敏。`redactText` 会把常见密钥和本机 home path 替换掉。注意它不会声称“完美防泄漏”，而是在 UI 上把风险面板放出来，让用户分享前再审一次。

第三层是 HTML 净化。项目使用 `markdown-it` 渲染 Markdown，再用 `sanitize-html` 限制标签、属性、class 和协议。链接会被强制加上 `target="_blank"` 和 `rel="noopener noreferrer"`，`javascript:` 之类的危险协议不会进入最终 HTML。

裁剪后的发布前处理像这样：

```ts
const copy = structuredClone(snapshot); // 先复制一份快照，避免修改本地审阅对象
delete copy.cwd; // 云端分享不保留真实工作目录
delete copy.filePath; // 云端分享不保留本地 JSONL 文件路径
delete copy.displayFilePath; // 云端分享连脱敏后的文件路径也不保留
copy.cloudShared = true; // 标记这份对象已经进入云端分享语境
copy.cloudSharedAt = new Date().toISOString(); // 写入分享时间，方便后续排查
sanitizeSnapshotHtml(copy); // 再次净化每个 turn 的 HTML
return removePrivatePathFields(copy); // 递归移除嵌套结构里的私有路径字段
```

这里有一个很值得借鉴的原则：**脱敏不是只在一个地方做一次**。

本地加载时会脱敏，渲染时会净化，准备云端 payload 时会删路径，Share API 收到请求后还会再次归一和净化。每一层都假设上一层可能漏掉东西。

## 5. 本地 Viewer：浏览器只访问本机回环服务

`serve` 命令会启动本地 Viewer，默认地址是：

```text
http://127.0.0.1:4321/
```

这个 Viewer 不是静态页面直接读文件。浏览器没有权限直接扫描 `~/.codex`，也不应该有。真正读文件的是 Node HTTP 服务，页面只通过 API 拿 summary 和 snapshot。

{% asset_img figure-04.svg %}

本地服务主要路由是：

| 路由 | 作用 |
| --- | --- |
| `/` | 返回本地审阅台 HTML |
| `/api/sessions` | 返回会话摘要列表 |
| `/api/snapshot?id=...` | 返回某条完整快照 |
| `/api/publish` | 把当前快照发布到 Share API |
| `/api/publish-all` | 批量发布完整会话 |
| `/api/share-payload` | 生成将要发布的 payload，方便检查 |
| `/export?id=...&format=html` | 导出 HTML |
| `/export?id=...&format=md` | 导出 Markdown |

本地服务还有一层来源保护。默认允许 `127.0.0.1`、`localhost` 和配置过的本地站点来源访问；会产生写动作的接口必须带 `Origin` 和 CSRF token。

裁剪后的请求守卫像这样：

```ts
setSnapshotServerCorsHeaders(request, response); // 先按本地白名单设置 CORS 响应头
if (!isAllowedSnapshotServerRequest(request)) return deny(); // 非允许来源不能读取本地快照服务
if (url.pathname === "/api/sessions") return sendSessions(); // 读取列表是 GET，只返回轻量摘要
if (url.pathname === "/api/snapshot") return sendSnapshot(); // 读取详情是 GET，按开关加载快照
if (url.pathname === "/api/publish") { // 发布是本地到云端的写动作
  if (!allowMutationRequest(request, response, csrfToken)) return; // 写动作必须校验 Origin 和 CSRF token
  return publishRedactedSnapshot(); // 真正发布时强制使用脱敏快照
} // 发布分支结束
```

这个边界很干净：

- 浏览器 UI 不直接碰本机文件系统。
- 本地 HTTP 服务默认只监听回环地址。
- 跨来源读取只给本地可信来源。
- 发布类接口必须走 CSRF。
- 云端发布必须保持 `redact` 开启。

这也是它适合做成 LaunchAgent 的原因。常驻后台的不是一个任意远程可访问的服务，而是一个本机回环上的只读审阅台。

## 6. 云端分享：只让脱敏快照离开本机

云端能力由 `src/server/share-api.mts` 提供。它可以本地跑，也可以部署到公网，比如 README 里给出的阿里云 ECS 方案。

Share API 的职责不是重新读取用户电脑。它只接收已经由本地 Viewer 或 CLI 生成的 snapshot payload，然后做四件事：

1. 校验发布身份。
2. 拒绝未脱敏快照。
3. 移除本地路径并净化 HTML。
4. 存成一个公网可读的只读记录。

{% asset_img figure-05.svg %}

发布接口的关键约束很直接：

```ts
const auth = requirePublishAuth(request); // 发布前先确认是 GitHub 登录、token，或允许的匿名模式
const body = await readJsonBody(request, MAX_BODY_BYTES); // 读取请求体，并限制最大体积
const snapshot = normalizeSnapshotPayloadForShare(body.snapshot); // 归一化快照字段，并移除本地私有字段
if (!snapshot.redacted) return rejectUnredacted(); // 默认拒绝未脱敏快照进入云端
sanitizeTurnHtml(snapshot.payload); // 服务端再次净化每个 turn 的 HTML
await storage.putShare(createShareRecord(snapshot, auth)); // 写入分享存储，并记录发布者信息
return sendShareUrl(snapshot.id); // 返回公网只读分享链接
```

认证支持两种模式：

| 模式 | 适用场景 |
| --- | --- |
| `SNAPSHOT_SHARE_TOKEN` | 兼容旧的命令行发布方式 |
| GitHub OAuth | 公网服务上的多人发布和删除权限 |

启用 GitHub OAuth 后，发布记录会保存 owner。站长可以删任何分享，普通用户只能删自己的分享。公开列表 `/api/snapshots` 只返回摘要，不返回完整 transcript；只有详情接口 `/api/snapshots/:id` 才返回快照内容。

存储层现在是一个文件 store：`.codex-snapshots/shares.json`。`src/server/share-store.ts` 里用一个 Promise 队列串行化写入，再通过临时文件加 `rename` 完成原子替换。这个选择很适合轻量分享服务：部署简单，行为可测试，未来也可以把 `ShareStore` 接口换成数据库。

## 7. 工程化：独立发包靠的是生成物和测试闭环

这个仓库已经不是博客里的一个私有脚本，而是一个可以独立发布的 npm 包。工程化链路主要有三层：

| 层 | 命令 / 文件 | 作用 |
| --- | --- | --- |
| TypeScript 构建 | `pnpm build:dist` | 把 `src` 编译到 `dist`，并给 CLI / server 加执行权限 |
| 静态官网构建 | `pnpm build:site` | 用 Vite + React + Tailwind 生成 `site/assets/site.js` 和 `share.js` |
| 打包前构建 | `prepack` | npm 发布前自动跑完整 build |

测试也围绕真实边界展开：

| 测试 | 关注点 |
| --- | --- |
| `test:smoke` | CLI、daemon、share server、部署脚本和生成物语法能跑起来 |
| `test:share-api` | 发布、列表、详情、删除、OAuth ownership、HTML 净化和路径移除 |
| `test:static-site` | 静态首页和分享页如何读取公网 API、如何避免误读访问者本机 `127.0.0.1` |
| `test:site-config` | GitHub Pages 注入的公开 API 地址是否安全 |
| `test:deploy-config` | 阿里云部署配置是否拒绝 localhost、示例域名和错误路径 |

这里最让我喜欢的是 `test-static-site` 里的一个用例：公开官网如果没有配置公网 API，不会回退去请求访问者自己的 `127.0.0.1:8787`。这说明项目把“本机”和“公网”的边界当成了产品约束，而不是部署文档里的提醒。

## 8. 总结：这套实现最值得借鉴的地方

`codex-snapshots` 的核心不是“读 JSONL”这件事本身。真正有价值的是它把会话分享拆成了几个可审计的阶段：

1. 本地只读扫描，不改变原始历史。
2. 轻量摘要和完整快照分开加载，列表体验不会被大文件拖垮。
3. 三类 Agent 历史先归一成同一种 `turn`，渲染层不用关心来源。
4. 默认隐藏工具调用和工具输出，把敏感面降下来。
5. 风险检测、脱敏、HTML 净化、云端路径移除分层执行。
6. 本地 Viewer 只监听回环地址，并用来源白名单和 CSRF 保护写动作。
7. 云端 Share API 不读取本机，只保存已脱敏、已净化的只读 payload。
8. 静态官网、分享 API、部署脚本和测试都围绕同一条安全边界设计。

很多工具做“分享”时，容易先把页面做出来，再回头补安全规则。这个项目的方向相反：先把分享对象定义成冻结的、只读的、可丢弃的快照，再决定哪些 UI 和 API 能围绕它存在。

这也是我觉得它值得单独拆成仓库的原因。它不是 Garden Lab 里的一个按钮，而是一套可以复用的本地优先会话快照系统。
