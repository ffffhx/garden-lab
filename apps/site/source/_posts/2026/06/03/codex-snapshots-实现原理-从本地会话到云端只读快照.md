---
title: "Agent Snapshots 项目复盘：从只读会话快照到 Agent 工作记忆入口"
date: "2026-06-03 22:10:00"
categories:
  - 技术
tags:
  - Agent
  - Codex
  - Claude Code
  - Electron
  - TypeScript
  - SQLite
  - 本地优先
  - 隐私安全
  - 架构演进
  - 工程实践
excerpt: "这是一份面向技术面试的源码解析与项目复盘：Agent Snapshots 如何从一个读取 Codex、Claude Code 本地 JSONL 的只读快照工具，演进为带隐私闸门、持久化搜索、实时追踪、桌面启动器、Orca 恢复和可控分享的 Agent 工作记忆入口；其中的异构日志归一、双层缓存、FTS5 trigram、服务看门狗和安全边界怎样取舍。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

> 本文最初写于 2026 年 6 月 3 日，当时项目还叫 `codex-snapshots`，重心是脱敏与云端只读分享。项目后续更名为 Agent Snapshots，并演进成桌面应用与本地 Agent 工作记忆入口。本文已按 2026 年 7 月 12 日的源码和 Git 历史重写；代码片段为讲解裁剪版，阅读目标是掌握问题、边界、取舍和验证证据，而不是背实现。

## 1. 项目定位与面试开场

如果面试官只给我 30 秒，我会这样介绍 Agent Snapshots：

> Agent Snapshots 是一个 local-first 的 Agent 会话资产管理器。它只读扫描 Codex 和 Claude Code 散落在本机的会话历史，归一成稳定的 Snapshot，再提供搜索、阅读、复盘、统计、继续会话和可控分享。它最核心的难点不是把 JSONL 渲染成页面，而是在不写回原会话、不默认上传数据的前提下，把异构日志、大会话搜索、隐私脱敏和桌面续聊组合成一套可观测、可降级、可验证的系统。

这个项目的边界可以概括为四点：

- **事实边界**：原始会话文件是事实源，项目只读扫描；缓存、备注和偏好写入独立的 sidecar 文件，不改原日志；
- **数据边界**：本地阅读、搜索和统计默认不上云；只有用户主动点击 Gist 或“发布分享”，脱敏后的快照才离开本机；
- **产品边界**：分享的是静态只读 Snapshot，不是原始 Agent 线程，接收者不能借此操作用户电脑；
- **恢复边界**：“继续会话”是本机显式动作，由 Orca 或终端执行 `codex resume` / `claude --resume`，与只读阅读链分开。

面试时，我会优先讲四类问题：

1. 不同 Agent 的日志结构不同，怎样归一为一份稳定的 Snapshot；
2. 几百个会话、超大 JSONL 与中文短词搜索，怎样做到冷启快、稳态搜索更快；
3. 日志里混有 token、Cookie、本机路径和工具输出时，怎样把“可阅读”与“可安全分享”分成多道闸门；
4. 一个本地 Web Viewer 怎样演进成可长期运行的 Electron 工作台，并处理服务卡死、窗口生命周期和会话续接。

<style>
.as-flow{--as-paper:var(--paper-soft,#faf6ec);--as-ink:var(--ink,#1a1815);--as-muted:var(--muted,#6a6155);--as-line:color-mix(in srgb,var(--as-ink) 23%,transparent);--as-blue:#315f9a;--as-red:#a84432;--as-green:#4d7138;--as-gold:#aa741d;--as-purple:#675394;margin:1.55rem 0;padding:clamp(14px,2.8vw,24px);border:1.5px solid var(--as-line);border-radius:17px;background:linear-gradient(150deg,color-mix(in srgb,var(--as-paper) 95%,var(--as-blue) 5%),var(--as-paper));color:var(--as-ink);box-shadow:0 13px 30px -25px color-mix(in srgb,var(--as-ink) 48%,transparent);overflow:hidden}
.as-flow *{box-sizing:border-box}.as-flow .as-kicker{margin:0 0 5px;font:700 11px/1.2 var(--font-mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--as-blue)}.as-flow .as-title{margin:0 0 16px;font:700 clamp(17px,2.4vw,22px)/1.25 var(--font-display,system-ui,sans-serif);color:var(--as-ink)}
.as-flow .as-track{display:flex;align-items:stretch;gap:8px;min-width:0}.as-flow .as-node{flex:1 1 0;min-width:0;padding:12px;border:1px solid var(--as-line);border-radius:11px;background:color-mix(in srgb,var(--as-paper) 88%,white 12%)}.as-flow .as-node b{display:block;font-size:13px;line-height:1.35}.as-flow .as-node small{display:block;margin-top:5px;font-size:11.5px;line-height:1.45;color:var(--as-muted)}.as-flow code{font-family:var(--font-mono,ui-monospace,monospace);font-size:.92em}
.as-flow .as-node[data-tone="blue"]{border-color:color-mix(in srgb,var(--as-blue) 55%,transparent);background:color-mix(in srgb,var(--as-paper) 88%,var(--as-blue) 12%)}.as-flow .as-node[data-tone="red"]{border-color:color-mix(in srgb,var(--as-red) 55%,transparent);background:color-mix(in srgb,var(--as-paper) 88%,var(--as-red) 12%)}.as-flow .as-node[data-tone="green"]{border-color:color-mix(in srgb,var(--as-green) 55%,transparent);background:color-mix(in srgb,var(--as-paper) 88%,var(--as-green) 12%)}.as-flow .as-node[data-tone="gold"]{border-color:color-mix(in srgb,var(--as-gold) 55%,transparent);background:color-mix(in srgb,var(--as-paper) 88%,var(--as-gold) 12%)}.as-flow .as-node[data-tone="purple"]{border-color:color-mix(in srgb,var(--as-purple) 55%,transparent);background:color-mix(in srgb,var(--as-paper) 88%,var(--as-purple) 12%)}
.as-flow .as-arrow{flex:0 0 auto;align-self:center;color:var(--as-blue);font:800 20px/1 var(--font-mono,ui-monospace,monospace)}.as-flow .as-lanes{display:grid;gap:10px}.as-flow .as-lane{display:grid;grid-template-columns:minmax(100px,.3fr) 1fr;gap:10px;align-items:stretch}.as-flow .as-lane-name{display:flex;align-items:center;justify-content:center;padding:10px;border-radius:10px;background:var(--as-ink);color:var(--as-paper);font:700 12px/1.3 var(--font-mono,ui-monospace,monospace);text-align:center}.as-flow .as-lane-body{display:flex;align-items:stretch;gap:7px;min-width:0}.as-flow .as-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.as-flow .as-note{margin:12px 0 0;padding-top:10px;border-top:1px dashed var(--as-line);font-size:12px;line-height:1.55;color:var(--as-muted)}.as-flow .as-badge{display:inline-flex;margin-bottom:7px;padding:3px 7px;border-radius:999px;background:var(--as-ink);color:var(--as-paper);font:700 10px/1.2 var(--font-mono,ui-monospace,monospace);letter-spacing:.05em}
@media(max-width:760px){.as-flow .as-track{flex-direction:column}.as-flow .as-arrow{transform:rotate(90deg)}.as-flow .as-lane{grid-template-columns:1fr}.as-flow .as-lane-name{justify-content:flex-start}.as-flow .as-lane-body{flex-direction:column}.as-flow .as-grid{grid-template-columns:1fr}.as-flow .as-lane-body>.as-arrow{align-self:center}}@media(prefers-reduced-motion:reduce){.as-flow *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>

## 2. 项目从什么开始，现在是什么

2026 年 5 月 27 日的第一个提交叫 `Initial codex snapshots project`。当时仓库只有 8 个文件，主要能力是：

- 扫描 Codex、Claude Code 和当时的 Trae 历史；
- 在 `127.0.0.1:4321` 打开只读查看器；
- 导出 HTML / Markdown；
- 脱敏常见密钥与本机路径；
- 把脱敏快照发给一个小型 Share API。

一个半月后，项目名、能力重心和运行形态都发生了变化：

| 维度 | 最初版本 | 当前主干 |
|---|---|---|
| 定位 | 会话导出与分享工具 | 本地 Agent 会话搜索、阅读、分析与续接入口 |
| 数据源 | 三套自己维护的解析路径 | Codex / Claude Code，生产解析切换到 `agent-session-core` 适配层 |
| 阅读 | 单页列表与基础 transcript | 详略三档、大纲、大会话渐进渲染、live tail、diff、token / 耗时徽标 |
| 搜索 | 临时扫描本地日志 | 会话列表缓存 + SQLite 文档索引 + FTS5 trigram + 语义索引 |
| 桌面端 | 无 | Electron 启动器、托盘、全局快捷键、通知、深链、自动更新 |
| 工作续接 | 只能阅读 | 优先在 Orca 继续，不可用时回退到 Terminal / iTerm2 |
| 分享安全 | 客户端脱敏 + 禁止默认明文发布 | 同源规则、HTML 净化、CSP、服务端重脱敏、高风险二次拒绝 |
| 可靠性 | smoke check | 解析、隐私、搜索、本地 API、分享 API、UI、静态站和 Electron E2E 分层验证 |

<figure class="as-flow" role="group" aria-label="Agent Snapshots 从只读快照工具演进到 Agent 工作记忆入口的五阶段路线">
  <p class="as-kicker">Evolution route</p>
  <p class="as-title">从“把一次会话发给别人”到“找回自己过去的工作”</p>
  <div class="as-track">
    <div class="as-node"><span class="as-badge">05·27</span><b>只读快照</b><small>扫描 · 脱敏 · 导出<br><code>JSONL → Snapshot</code></small></div>
    <span class="as-arrow" aria-hidden="true">→</span>
    <div class="as-node" data-tone="red"><span class="as-badge">05·29—06·03</span><b>可控分享</b><small>Share API · GitHub OAuth<br>服务端再验隐私</small></div>
    <span class="as-arrow" aria-hidden="true">→</span>
    <div class="as-node" data-tone="gold"><span class="as-badge">06·14—06·22</span><b>归一与搜索</b><small>子代理 · 安全加固<br>读路径统一</small></div>
    <span class="as-arrow" aria-hidden="true">→</span>
    <div class="as-node" data-tone="blue"><span class="as-badge">07·05—07·07</span><b>桌面工作台</b><small>Electron · SQLite<br>Orca 恢复 · 深链</small></div>
    <span class="as-arrow" aria-hidden="true">→</span>
    <div class="as-node" data-tone="green"><span class="as-badge">07·08—07·12</span><b>工作记忆</b><small>统计 · 图库 · 洞察<br>缓存 · 看门狗</small></div>
  </div>
  <p class="as-note">能力重心：一份可分享文件 → 一套可搜索的历史 → 一个能重新进入工作现场的本地入口。</p>
</figure>

## 3. 演进历程：产品边界一步步向“工作记忆”移动

### 阶段一：先证明快照链路成立（5 月 27 日—5 月 28 日）

第一版故意做得很窄：只需要找到会话、归一为 `turns[]`、脱敏，再渲染成只读 HTML / Markdown。它首先验证了三个假设：

1. Agent 的本地日志是否足以还原一次人机协作；
2. 去掉 system / developer / bootstrap 和默认工具输出后，会话是否仍然可读；
3. 发给别人的快照是否可以保持静态、只读，不把本机操作能力一起带走。

**取舍**：第一版将大量逻辑放在单个 CLI 文件里，用可维护性换验证速度。但项目一旦证明有价值，后续就把数据源、隐私、渲染、本地服务与分享服务拆成独立边界。

### 阶段二：分享能力出现后，隐私成为主线（5 月 29 日—6 月 3 日）

一旦支持把 Snapshot 发到公网，“脱敏”就不再是一个正则替换函数，而是完整的发布协议：

- 客户端默认脱敏；
- CLI 使用 `--no-redact` 发布时必须再显式提供 `--allow-unredacted`；
- 服务端不相信客户端上报的 `redacted: true`，会再做一次脱敏和高风险检查；
- GitHub OAuth 区分“谁可以发布”和“谁可以删除这份快照”；
- 公网页面只拿到净化后的 Snapshot，不拿本机文件路径和恢复能力。

**工程判断**：隐私默认值不能仅由 UI 提醒保证，必须收敛为 CLI 参数约束、服务端拒绝策略和渲染层净化三道防线。

### 阶段三：日志异构和解析分叉开始暴露（6 月 14 日—6 月 29 日）

项目加入全局搜索、Claude 子代理嵌套、短命子 Agent 目录折叠、结构化 diff 之后，三套解析器开始重复解决同一类问题：

- 哪些是用户可见消息，哪些是内部事件；
- 工具调用和工具结果怎样关联；
- 子代理怎样属于父会话，而不是在列表中冒充独立工作；
- 会话标题怎样跳过 `/clear` 和启动指令；
- 文件更改怎样统一为可渲染、可脱敏的 patch。

因此项目先用 parity harness 做并行适配，再把生产解析切换到 `agent-session-core` 。适配层继续保持 `listSessions / loadSnapshot / searchSessions` 的对外形状，下游 CLI、Viewer 和 Share API 不需要同时重写。

**取舍**：迁移时不用“新解析器已经更干净”作为切换依据，而是要比较 Snapshot 输出语义。结构重构可以先进入，生产切换要等行为契约足够稳定。

### 阶段四：从阅读器转向桌面入口（7 月 5 日—7 月 7 日）

7 月 5 日加入 Electron 桌面壳、SQLite 索引和两阶段 transcript 渲染，7 月 6 日开始把启动器定位为“搜索 + 续聊”，7 月 7 日再加上 Orca 恢复、深链、托盘、完成通知和持久化 FTS5 搜索。

这里的关键变化是：**用户不再是为了“看一份历史”打开它，而是为了“找到之前做过的事，继续做”。**

产品上因此有了两个窗口：

- Launcher 像 Raycast / Spotlight，管搜索、置顶、近期会话和恢复；
- Viewer 管长文阅读、搜索命中定位、diff、图片、统计和分享审阅。

**取舍**：不把同一张页面强行压成小窗口，而是让“快速入口”和“深度阅读”使用同一本地服务、两种窗口语义。

### 阶段五：功能密度提高后，用缓存、模块化和看门狗还债（7 月 8 日—7 月 12 日）

0.2.0 一次性加入了配额仪表、活跃热力图、项目排名、周报、图库、洞察、个人备注、实时追踪、详略三档和更完整的无障碍。能力增长带来了三类实际压力：

1. 会话列表冷扫描需要读很多小文件；
2. 搜索、图库、统计都可能重复解析大会话；
3. Electron-as-Node 子进程在高并发文件读取下，出现过 libuv 线程池卡死：缓存 API 仍然能响应，但所有依赖 `fs` 的路由永久挂起。

对应的偿还不是“换一个更大框架”，而是：

- 会话列表增加持久化 metadata cache，通过 mtime 和 watermark 对账；
- 搜索文档持久化到 SQLite，查询不再每次重读 JSONL；
- 大型 Viewer 从单文件拆成 CSS / JS 职责模块，保持渲染输出不变；
- 搜索索引改为启动后延迟预热、定时刷新和冷却，互动查询不同步触发全量更新；
- Electron 加入真正触发 `fs` 的健康探针和子进程看门狗，失败时在原端口重启。

**工程判断**：“HTTP 还能回包”不等于服务健康。健康检查必须覆盖真正失效的能力；恢复时必须保持原端口，否则已打开的窗口会全部指向失效 origin。

## 4. 当前架构：四条职责链，一份 Snapshot 契约

<figure class="as-flow" role="group" aria-label="Agent Snapshots 当前架构的四条职责链">
  <p class="as-kicker">System map</p>
  <p class="as-title">异构日志、本地搜索、桌面窗口和公网分享，通过 Snapshot 契约解耦</p>
  <div class="as-lanes">
    <div class="as-lane"><div class="as-lane-name">会话事实链</div><div class="as-lane-body"><div class="as-node">Codex / Claude JSONL<small>本地原始事件</small></div><span class="as-arrow">→</span><div class="as-node" data-tone="gold">ASC adapter<small>解析 · 归一 · fallback</small></div><span class="as-arrow">→</span><div class="as-node" data-tone="blue">Snapshot<small>turns · risks · usage · changes</small></div></div></div>
    <div class="as-lane"><div class="as-lane-name">索引检索链</div><div class="as-lane-body"><div class="as-node">summary candidate<small>mtime · head parse · home</small></div><span class="as-arrow">→</span><div class="as-node" data-tone="purple">metadata cache<small>首屏 / watermark</small></div><span class="as-arrow">→</span><div class="as-node" data-tone="green">SQLite + FTS / semantic<small>关键词 · 语义 · 统计</small></div></div></div>
    <div class="as-lane"><div class="as-lane-name">桌面交互链</div><div class="as-lane-body"><div class="as-node">Electron shell<small>托盘 · 快捷键 · 深链</small></div><span class="as-arrow">→</span><div class="as-node" data-tone="blue">local server<small>Launcher / Viewer / API</small></div><span class="as-arrow">→</span><div class="as-node" data-tone="green">Orca / Terminal<small>显式继续会话</small></div></div></div>
    <div class="as-lane"><div class="as-lane-name">分享安全链</div><div class="as-lane-body"><div class="as-node">risk + redact<small>客户端默认处理</small></div><span class="as-arrow">→</span><div class="as-node" data-tone="red">sanitize + publish gate<small>CSRF · Origin · 二次扫描</small></div><span class="as-arrow">→</span><div class="as-node" data-tone="purple">只读制品<small>HTML / Gist / Share API</small></div></div></div>
  </div>
  <p class="as-note">Snapshot 是边界对象，不是原始日志的完整镜像：它主动隐藏不应默认暴露的内部事件和工具输出。</p>
</figure>

### 4.1 会话事实链：原文件只读，适配层统一语义

`src/sources/index.mts` 很薄，只向外导出三个稳定入口：

```ts
export {
  listSessions,
  loadSnapshot,
  searchSessions,
} from "./asc-adapter.mjs";
```

生产解析由 `agent-session-core` 完成，本项目的 adapter 再补上业务语义：

- 去掉 Codex App 指令，再决定一个 turn 是否为空；
- 连接项目自己的 Markdown renderer、隐私检测和脱敏器；
- 为 Claude Code 恢复子代理层级；
- 从工具事件中提取文件更改和结构化 diff；
- 把 token usage 对齐到对应 assistant turn；
- 为多个 Codex home 加上稳定来源标识；
- 在 ASC 没有对应能力时，回退到 legacy 路径处理 Claude history-only 会话和搜索文档。

这个设计很适合面试中讲“迁移”：**新内核与旧产品不直接耦合，中间先放一层语义适配，保持下游契约不变。**

### 4.2 索引检索链：列表、正文和语义向量不共用同一个成本模型

项目没有把“搜索”做成一个大的全量索引，而是分成三层：

1. **Session metadata cache**：只管列表首屏、分组、活跃状态和 watermark；
2. **Keyword document index**：把标题、项目、分段文本与摘要持久化到 SQLite，供 FTS / LIKE 查询和用量统计复用；
3. **Semantic index**：只为语义搜索保存嵌入结果，根据会话 mtime 增量预热。

三层的好处是：列表不为了语义搜索付费，关键词查询也不需要调嵌入模型。代价是有三套新鲜度与完整度状态，因此 UI 要诚实告诉用户“索引仍在补齐”，不能把未完成当成“没有命中”。

### 4.3 桌面链：Electron 管生命周期，本地 Server 管产品能力

Electron 没有把全部业务重写为 IPC，而是启动同一套 `agent-snapshot serve`：

```ts
const args = [cliEntry(), "serve", "--host", HOST, "--port", String(serverPort)];
serverProcess = spawn(process.execPath, args, {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || "16",
    AGENT_SNAPSHOT_MUTATION_CSRF_TOKEN: MUTATION_CSRF_TOKEN,
  },
});
```

这样做的好处是：

- CLI、浏览器本地 Viewer 和 Electron 共用一套业务行为；
- Launcher 与 Viewer 共用同一个 origin 和 API；
- 子进程卡死可以被看门狗单独重启，不必把整个桌面应用一起结束；
- 本地服务仍可以被 `npx agent-snapshots serve` 独立使用。

代价是 Electron 要管端口、子进程、origin、CSRF token 和健康恢复；所以“Web 服务复用”并不等于“零桌面成本”。

### 4.4 分享链：快照是一份可审阅制品，不是原日志的上传副本

分享前会主动去掉本地私有字段，重新脱敏标题、目标和 turn 文本，清理 HTML，并移除非 inline 图片源。服务端还会扫描最终 payload，如果仍能找到高危秘密，直接拒绝发布。

这里的保证范围需要说清楚：

- 能够覆盖已知格式的 token、私钥、Bearer 凭证、连接串和敏感赋值；
- 能够将本机 home 路径缩成 `~`，将其他主机用户名替换掉；
- 能够阻止已知高危模式通过公网发布闸门；
- **不能保证所有未知业务数据都被理解**，因此发布前仍需要人快速复核风险面板。

## 5. 难点一：异构 Agent 日志怎样归一成稳定 Snapshot

Codex 和 Claude Code 的原始日志都可以是 JSONL，但这不代表它们共用一个事件模型。差异包括：

- 会话 ID 在文件名还是内容里；
- tool call / result 怎样对齐；
- token usage 出现在 assistant 消息前还是后；
- 子代理是单独文件还是内联事件；
- 标题来自首条用户消息、AI 标题还是 history 摘要；
- 完成状态由哪个结束事件证明。

### 5.1 先分离 summary 与 snapshot

会话列表不需要全部正文，只需要：标题、来源、项目、时间、完成状态和文件 mtime。因此 adapter 为列表头部解析设定了有界行数，当前是 200 行，足以覆盖前置指令后的首条真实用户问题。

```ts
const SUMMARY_MAX_LINES = 200;
```

用户点开某条会话时，才进入 `loadSnapshot`，解析完整事件、工具、图片、diff 和 usage。

**取舍**：这不是简单的懒加载，而是两个不同的产品契约。Summary 追求快和稳定，Snapshot 追求完整和可审阅。

### 5.2 子代理不能在列表中冒充独立会话

Claude Code 会把 Task / Agent 子代理写到父 Session 目录下。如果按 JSONL 文件数量简单展示，一次工作会在列表中膨胀成很多条“会话”，用户也无法知道它们的因果关系。

当前做法是：

1. 顶层列表过滤子代理与 journal artifact；
2. 加载父 Snapshot 时，在 `<parentSessionId>/subagents/**/agent-*.jsonl` 下收集子文件；
3. 用同一 ASC 投影、脱敏和工具开关解析子代理；
4. 把结果按时间嵌套回父 Snapshot。

这个例子能说明：**文件系统结构不等于用户的工作结构。** 归一层要恢复的是人能理解的层级和因果。

### 5.3 直接路径查找要防软链逃逸

CLI 可以接受 session id，也可以接受直接 `.jsonl` 路径。直接路径不能只做 `path.resolve`，因为允许目录下可能放有指向外部的软链。

实现会对文件和 home 都做 `realpath`，再用 `path.relative` 检查真实文件是否仍在允许的 home 里。这是典型的“校验最终事实，而不是字符串表面”。

## 6. 难点二：为什么搜索不能每次都重读 JSONL

早期搜索在每次查询时扫描会话、解析文档、打分并提取 snippet。数量少时逻辑简单，但几百个会话后，用户每输入一个字都可能重复付出磁盘读取和 JSON 解析成本。

### 6.1 SQLite 缓存搜索文档，mtime 决定是否需要重建

关键词索引将每个会话保存为一条 `docs` 记录，关键字段包括：

- `cache_key / ref / engine / home_key`；
- `title / cwd / mtime`；
- 折叠后的搜索全文 `fold`；
- 字段、分段和 summary JSON；
- token 用量与 model，供统计面板复用。

索引同步时先比较 session mtime，没变的文档直接复用；新增或更改的文档才解析。写入累积到一批后放进短事务，不在 `await` 文件读取期间长时间占住 SQLite 写锁。

```ts
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");

if (existing && existing.mtime === mtime) {
  indexed += 1;
  continue;
}
```

### 6.2 中文搜索为什么用 FTS5 trigram，还要保留 LIKE fallback

标准英文 tokenizer 依赖空格分词，对“登录态”、“配额”这类中文短词不合适。当前索引用 FTS5 `trigram` tokenizer，将三字符及以上子串查询交给倒排索引。

但 trigram 对长度小于 3 的词天生无法产生三元组。因此当用户搜“AI”、“坑”、“卡”时，实现会回退到对同一 `fold` 列的 LIKE 候选筛选，再复用原有打分与 snippet 逻辑。

**取舍**：FTS5 加速主流查询，LIKE 保住短词语义；两者最后共用一套精排，避免两条路径返回完全不同的排序体验。

### 6.3 为什么互动搜索不同步刷新索引

一个很容易写出的方案是：每次搜索前先 `syncSearchIndex()`，以此保证绝对新鲜。问题是这会把后台更新成本放到用户键盘输入的关键路径上；更糟的是，高频查询可能反复触发同一次扫描。

当前策略是：

- 启动后延迟预热，不挡首屏；
- 后台定时刷新，并设置冷却窗口；
- 互动查询设独立超时，只查已有索引；
- UI 明确展示“正在搜索”、“超时”或“索引未补齐”，不把空结果冒充成功。

这是一个典型的产品取舍：**搜索稳态延迟优先于每次查询的绝对新鲜，但系统要让用户知道完整度。**

## 7. 难点三：隐私脱敏为什么必须是多道闸门

### 7.1 检测和替换必须来自同一张规则表

早期隐私实现很容出现一种漂移：风险面板说“检测到 token”，但脱敏器的正则已经与检测器不同，最终快照仍可能带着原文。

当前将每个规则定义为：

```ts
type RedactionRule = {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  pattern: RegExp;
  replacement?: string | ((...args: string[]) => string);
  detectOnly?: boolean;
};
```

`detectRisks` 与 `redactText` 都遍历同一个 `REDACTION_RULES`。像 `.env` 文件名属于值得提醒但不需要删除的信息，使用 `detectOnly`。

**好处**：“看到的风险”和“真正被清理的内容”不会因为两套表独立演进而漂移。

### 7.2 为什么赋值型秘密会更倾向过度脱敏

对 `client_secret = ...` 这类赋值，实现会将等号或冒号后面直到行末都替换掉，而不是在第一个空格或引号停止。这可能隐藏同一行的更多普通文本，但能覆盖：

- 含空格的 passphrase；
- 很短的密码；
- 带引号的 JSON 值；
- 同一行上包含多个字段的 Cookie。

这里的风险函数很明确：假阳性会让快照少一点文本，假阴性会真正泄露凭证。发布边界上应更偏向前者。

### 7.3 HTML 净化、CSP 和远程图片限制各自解决不同问题

文本脱敏不等于渲染安全。Snapshot 里的 Markdown 可能带有 HTML，图片也可能带远程 URL。项目因此分层处理：

- sanitizer 约束最终 turn HTML，阻止危险标签和属性；
- 本地 Viewer 的 CSP 设置 `img-src 'self' data:`，阻止会话内容借远程图片发起跟踪或内网请求；
- 分享 payload 只保留 inline 图片，不将本机路径和外部 URL 原样携带到公网制品。

面试时要避免说“我用 sanitize-html 所以安全”。更准确的表达是：**脱敏管秘密文本，sanitizer 管可执行标记，CSP 管浏览器资源边界，发布闸门管最终是否允许离开本机。**

## 8. 难点四：只读产品里为什么仍然有 CSRF 和写操作

“只读”指的是对原 Agent 会话的边界，不是说整个应用不能有任何本地动作。当前 Viewer 仍然有一些显式操作：

- 在 Orca 或终端继续会话；
- 记录启动器使用次数和置顶状态；
- 写个人会话备注；
- 在 Finder / Explorer 中显示文件；
- 发布 Gist 或发布分享。

这些动作不写原始 JSONL，但会启动进程、写 sidecar 偏好或发网络请求。因此本地 Server 的安全边界是：

1. 对所有请求检查是否来自允许的本地 Origin；
2. 写操作要求页面注入的 `x-agent-snapshot-csrf` token；
3. Electron 子进程启动时注入一份当次随机 token；
4. 恢复会话前规范化 Session ref，拒绝控制字符、超长值和非预期格式。

**一句话概括**：“只读”是领域不变式，“无任何副作用”不是。安全设计要枚举真实副作用，而不是相信产品名称。

## 9. 难点五：桌面应用怎样对付“进程活着，能力已经死了”

### 9.1 为什么普通 HTTP ping 不足以判断健康

项目遇到过一个很具体的故障：Electron 启动的 Node 子进程仍在，某些纯缓存 API 也能返回，但 libuv 线程池不再处理新的文件请求，所以搜索和会话加载永久挂起。

如果健康检查只返回一个内存里的 `{ ok: true }`，它会得出错误结论。当前 `/api/health` 会真正对 Codex home 执行一次带超时的 `stat`：

```ts
await Promise.race([
  stat(codexHome).catch(() => null),
  timeout(timeoutMs),
]);
```

这个探针检查的不是“事件循环能否回一个包”，而是“产品赖以生存的文件读取能力是否还在”。

### 9.2 看门狗为什么要在原端口重启

Electron 每 30 秒调用健康探针，连续 3 次失败后终止卡死子进程并重启。重启会复用原 `serverPort`，因为 Launcher 和 Viewer 窗口已经持有这个 origin。如果每次都选新端口，服务虽然恢复，旧窗口仍然不可用。

同时，子进程将 `UV_THREADPOOL_SIZE` 默认提高到 16，用更大余量降低高并发文件任务的卡死概率；但它不取代看门狗，因为容量优化不等于故障恢复。

### 9.3 桌面窗口本身也是安全边界

Launcher 和 Viewer 都启用：

```ts
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
```

窗口导航也会检查 origin：同源链接在应用内打开，外部链接交给系统浏览器，不让一个不受控页面在拥有本地 API origin 的窗口中导航。

## 10. 产品与性能优化：每一项都对应具体失败模式

### 10.1 大会话两阶段渲染

一次将数千个 turn 全部写入 DOM，即使数据已经在内存里，也会阻塞首次交互。当前 Viewer 先渲染最近一段，再在后台渐进补齐早期记录。

这个方案优化的是“可交互时间”，不是总渲染量。代价是大纲、搜索命中和跳转在水化未完成时要能先 flush 需要的 turn。

### 10.2 live tail 不等于每次重载全部 Snapshot

进行中会话会先请求轻量 `/api/session-head`，只比较完成状态、turn 数和最新事件时间。发现变化后才加载新 Snapshot 并追加差量。用户如果已经向上滚动，界面不会强行拉回底部，而是显示“跟随最新”。

这体现了一个原则：**数据实时不等于视图必须抢走用户的阅读位置。**

### 10.3 置顶、进行中和 frecency 不能只按一个分数粗暴混合

Launcher 的排序需要同时考虑：

- 用户显式置顶；
- 当前正在运行；
- 最近更新；
- 过去的打开频率；
- 频率随时间衰减。

实现会先合并 pinned / live / recent 并去重，再在组内计算 frecency。这样可以避免一个一年前频繁打开的会话靠历史次数永久压过今天的新会话。

### 10.4 详略三档是信息密度协议，不只是样式开关

- **详细**：展开工具、过程和子代理，适合调试和证据复盘；
- **标准**：保留用户与助手主线，过程信息可按需展开；
- **摘要**：隐藏过程、工具、interrupt 和 subagent 区块，适合快速找结论。

导出 HTML 也带同样的详略切换和大纲，避免“本地看起来很好，导出后又退回原始长文”。

## 11. 我做过哪些取舍，又否决过什么

### 11.1 只读不等于把所有工具输出原样展示

工具输出里最容易出现大段无用日志、本机路径和秘密。默认只以用户与助手主线为主，工具调用和输出由显式开关控制。

否决的方案：为了“完整”默认发送全部运行时细节。快照的价值在于可审阅，不在于字节级复制。

### 11.2 保留本地 Server，而不把 Electron 变成唯一产品形态

桌面端可以直接用 IPC 重写全部数据读取，但这会让 CLI、浏览器使用方式和 Electron 产生三套行为。当前选择复用 local server，代价是需要端口与看门狗，收益是边界更统一。

### 11.3 搜索选择“可能稍旧，但稳定快”，不选择“每次绝对新鲜”

互动查询不同步重建索引，可能在后台预热前短暂看不到最新会话。这是有意识的最终一致性：数据不会错，但索引完整度需要时间收敛。

否决的方案：在每次键入时阻塞等待磁盘扫描，用用户延迟换理论上的强新鲜。

### 11.4 多 Codex home 用稳定 home key 区分，不用会话 ID 假设全局唯一

用户可能同时有默认 `~/.codex` 与 Orca 的 runtime home。不同 home 理论上可以出现相同 session id，缓存键与搜索文档键因此必须包含 home key。

这个取舍牺牲了一点 ref 简洁度，换取多运行时来源下的可证明唯一性。

### 11.5 语义搜索与关键词搜索并存

语义搜索适合“我记得大概在聊什么”，但不擅长精确的文件名、错误码、命令或短中文词。因此两个模式并存，而不用向量搜索取代一切。

## 12. 测试策略：按边界不变式组织验证

项目的测试不是只对页面做截图，而是守住几类不变式：

### 12.1 解析不变式

- 子代理不在顶层列表冒充父会话；
- `includeTools=false` 时，父会话和子代理都不泄露 tool turn；
- Claude Edit 能够变成脱敏后的结构化 diff；
- `/clear` 和纯文件路径不会被错认成会话真实标题；
- 首条问题中的秘密不会进入 Snapshot title。

### 12.2 隐私不变式

- 短密码、带空格 passphrase、引号 JSON 值和一行多 Cookie 都能脱敏；
- 检测为高危的值不能通过服务端发布闸门；
- 本机 home 路径不暴露用户名；
- `.env` 可以被标风险，但文件名本身不被错当成秘密删掉。

### 12.3 搜索与缓存不变式

- 已建的语义嵌入可以持久化复用，不因每次查询重算；
- 新增会话会被预热补齐，没变的会话按 mtime 跳过；
- 搜索 snippet 会居中显示命中词，而不是只取文档开头；
- 多 home 缓存行不串台。

### 12.4 桌面与 API 不变式

- Electron 能启动 Launcher，本地 API 返回预期形状；
- 深链不会因非法 Session ref 导致任意命令或路径被执行；
- 关闭窗口只隐藏托盘应用，不意外终止服务；
- 写路由需要 CSRF token，本地 origin 以外的请求被拒绝；
- 静态站在没有配置公开 API 时，不会偷偷请求访问者的 loopback。

这些测试共同保护一句话：**它可以读到你的本地工作记忆，但不能因为阅读、搜索或分享而改变原始会话和扩大权限。**

## 13. 如果面试官让我复盘，我会这样回答

### 13.1 我最满意的工程判断

我最满意的不是加了多少功能，而是始终把“本地原始会话”、“可搜索索引”、“可阅读 Snapshot”和“可公开分享制品”当成四种不同资产。

这个分层让我能够同时做出以下保证：

- 列表可以为性能做缓存，但缓存不变成原始事实；
- Snapshot 可以为可读性隐藏内部噪声，但不冒充原日志的字节镜像；
- 公开制品可以再脱敏和净化，而不相信客户端一个布尔值；
- 恢复会话可以是桌面端动作，但它不混入分享链。

### 13.2 我踩得最深的坑

最深的坑是把“后台任务会慢”当成普通性能问题。实际上，当索引预热、图片扫描和会话解析同时压到 Electron-as-Node 子进程时，问题可以从“慢”升级为“文件线程池永久不再消费任务”。

这个故障教会我三件事：

1. 缓存命中会掩盖底层能力失效，不能只用轻量 API 做健康检查；
2. 交互查询不能顺手触发完整索引同步；
3. 容量扩大、调度改善和故障恢复是三种不同的解法，必须同时设计。

### 13.3 如果再做一遍，我会更早做什么

我会更早确立两个契约：

1. **解析器一致性契约**：从第二个 Agent 数据源加入开始，就用同一组 fixture 比较 summary、turns、risks、subagents 和 file changes，不等三套解析已经分叉后再做 parity；
2. **索引完整度契约**：所有缓存和索引 API 从一开始就返回 `ready / partial / stale / failed` 等状态，让 UI 无需猜测“空结果”意味着什么。

### 13.4 下一步我会怎么做

下一步不是继续堆面板，而是把“工作记忆”做得更可验证：

- 为缓存、关键词索引、语义索引建立统一的健康与新鲜度面板；
- 为百 MB 级大会话做固定基准，分别看冷启、首屏、搜索、跳转和 live tail 延迟；
- 把脱敏规则的命中、误报和服务端拒绝原因做成更可解释的审阅记录；
- 将恢复命令、原日志位置和 Snapshot 版本建立更清晰的来源证据链。

## 14. 一句话收束

Agent Snapshots 最值得讲的地方，不是“我做了一个会话查看器”，而是：

> 我把本机上分散、异构、带隐私风险的 Agent 运行日志，归一成了一份可读的工作记忆；又用分层缓存、持久化索引、发布闸门和桌面恢复协议，让它能被找回、被继续、被安全分享，但不改写原始会话，也不默认让数据离开本机。

---

## 15. 互动题：你真的理解这个项目了吗？

> 建议先只看题目作答，再展开“答案与解析”。面试练习的重点不是记住选项，而是说清保证范围、失败模式与替代方案。

### 第一组：项目定位与演进

#### 题 1｜单选题

**问题：** Agent Snapshots 最准确的产品定位是什么？

A. 一个可以在网页里操作用户电脑的远程 Agent<br>
B. 一个 local-first 的 Agent 会话搜索、阅读、分析、续接与可控分享入口<br>
C. 一个专门上传所有终端日志的云盘<br>
D. 一个替代 Codex 与 Claude Code 的模型运行时

<details><summary>答案与解析</summary>

**答案：B。** 项目读取本地会话并建立 Snapshot 与索引，主动分享时才发送脱敏制品。它不是 Agent 运行时，也不让接收者操作原会话。

</details>

#### 题 2｜多选题

**问题：** 项目对“只读”的正确定义包括哪些？

A. 不写回 Codex / Claude Code 原始会话文件<br>
B. 备注、置顶和缓存可写独立 sidecar 存储<br>
C. 只读意味着应用绝对不能启动任何进程<br>
D. 恢复会话是显式动作，与阅读链分开

<details><summary>答案与解析</summary>

**答案：A、B、D。** 只读是对原会话事实源的领域约束。应用仍可以写独立偏好、启动 Orca 或终端、主动发布分享，这些都必须被当成显式副作用管理。

</details>

#### 题 3｜排序题

**问题：** 请按项目的大致演进顺序排列：

A. Electron 启动器与 Orca 恢复<br>
B. 只读快照、脱敏与导出<br>
C. 持久化搜索、统计、图库与服务看门狗<br>
D. Share API 与 GitHub OAuth<br>
E. 子代理嵌套、安全加固与解析迁移

<details><summary>答案与解析</summary>

**答案：B → D → E → A → C。** 先验证快照主链，再建立发布边界；数据源与产品复杂后处理归一，再把能力带入桌面入口，最后用缓存、模块化和自恢复偿还功能密度带来的成本。

</details>

#### 题 4｜简答题

**问题：** 为什么“从会话分享工具演进成工作记忆入口”不只是功能变多？

<details><summary>参考答案</summary>

因为核心任务已从“将一份历史制成可分享制品”变成“在大量历史里找到过去的工作，理解它，并继续它”。这会重新定义首屏延迟、搜索新鲜度、桌面生命周期、恢复动作和索引可观测性，属于产品主线的变化。

</details>

### 第二组：解析、Snapshot 与子代理

#### 题 5｜单选题

**问题：** 会话列表为什么不直接对每个 JSONL 构建完整 Snapshot？

A. JSONL 不能被 Node.js 读取<br>
B. 列表只需要轻量 summary，完整解析会把大会话成本放到首屏<br>
C. Snapshot 只能在云端生成<br>
D. 会话列表不需要标题和项目

<details><summary>答案与解析</summary>

**答案：B。** Summary 只需要标题、来源、项目、时间、完成状态和 mtime。只有用户点开时才需要完整 turns、tools、images 和 diff。

</details>

#### 题 6｜多选题

**问题：** `asc-adapter` 在通用解析内核之上补了哪些项目语义？

A. 指令清理与空 turn 判定<br>
B. 项目自己的脱敏、风险检测与 Markdown 渲染<br>
C. Claude 子代理嵌套和文件 diff<br>
D. token usage 与 assistant turn 对齐<br>
E. 直接将原日志上传到分享服务

<details><summary>答案与解析</summary>

**答案：A、B、C、D。** Adapter 的作用是把通用解析输出适配成项目的 Snapshot 契约。上传属于另一条显式发布链，并非解析器默认行为。

</details>

#### 题 7｜单选题

**问题：** 为什么 Claude 子代理要嵌套回父 Snapshot？

A. 为了节省文件系统空间<br>
B. 因为子代理没有任何消息<br>
C. 为了恢复真实的工作层级，避免一次任务在顶层列表膨胀成很多伪独立会话<br>
D. 因为浏览器不支持显示多个文件

<details><summary>答案与解析</summary>

**答案：C。** 事实文件的组织是运行时实现细节，用户希望看到的是一次任务与其子任务的因果层级。

</details>

#### 题 8｜简答题

**问题：** 为什么直接 `.jsonl` 路径查找需要 `realpath` 后再检查 home 包含关系？

<details><summary>参考答案</summary>

`path.resolve` 只解析字符串中的 `..`，不会证明文件没有通过软链指向 home 外部。文件和 home 都做 `realpath`，再用 `path.relative` 判断，才能校验真实文件系统边界。

</details>

### 第三组：缓存、FTS 与语义搜索

#### 题 9｜多选题

**问题：** 搜索链为什么拆成 metadata cache、keyword index 和 semantic index？

A. 三者服务的页面和成本模型不同<br>
B. 列表首屏不应该为向量嵌入付费<br>
C. 关键词搜索适合错误码、文件名和精确命令<br>
D. 语义搜索可以完全取代所有关键词查询

<details><summary>答案与解析</summary>

**答案：A、B、C。** 三层分担列表、精确检索与模糊语义回忆。语义搜索并不擅长替代精确符号和短词。

</details>

#### 题 10｜单选题

**问题：** 为什么 SQLite 索引用 session mtime 判断是否重建？

A. 用一个便宜的文件变化信号，跳过没变的会话<br>
B. mtime 能证明所有文件内容绝对没有变<br>
C. SQLite 不支持其他字段<br>
D. 为了使搜索结果随机排序

<details><summary>答案与解析</summary>

**答案：A。** mtime 是一个实用的增量信号，尤其适合追加式会话日志。它不是内容密码学证明，而是在性能与新鲜度之间的工程取舍。

</details>

#### 题 11｜多选题

**问题：** FTS5 trigram 与 LIKE fallback 分别解决什么？

A. trigram 为三字符及以上子串提供倒排索引候选<br>
B. LIKE 保住两字符或单字中文查询<br>
C. 两条路径最终可复用同一套打分和 snippet 逻辑<br>
D. LIKE 比任何倒排索引都快，所以应该对所有词使用

<details><summary>答案与解析</summary>

**答案：A、B、C。** trigram 要求至少三个字符，所以短词需要 fallback。LIKE 的价值是语义完整，不是对大量文档必然更快。

</details>

#### 题 12｜系统设计题

**问题：** 如果会话数量增长到 10 万，你会怎样演进当前索引？

<details><summary>参考答案</summary>

先量化列表扫描、变更发现、文档提取、FTS 候选与精排各自成本，不直接换技术栈。可能的演进包括：增量文件监听替代高频全量扫描；按 home / engine / 时间分区；将候选检索与精排限制在可控 Top-K；将统计聚合与全文文档分表；索引构建使用独立 worker 与背压；为每个分区返回完整度与 watermark。仍然要保持本地优先与原日志只读。

</details>

### 第四组：隐私、本地 API 与分享

#### 题 13｜单选题

**问题：** 为什么 `detectRisks` 和 `redactText` 共用同一张规则表？

A. 为了让检测与实际替换不会独立演进后产生漂移<br>
B. 因为 TypeScript 不支持两个数组<br>
C. 为了跳过所有风险记录<br>
D. 为了让脱敏后的秘密可以恢复

<details><summary>答案与解析</summary>

**答案：A。** 共用 pattern 使风险提示和真正清理指向同一个命中定义；`detectOnly` 允许“值得提醒但不应删除”的规则共存。

</details>

#### 题 14｜多选题

**问题：** 从本地会话到公网快照，安全链包含哪些层？

A. 客户端默认脱敏和风险面板<br>
B. HTML 净化与资源 CSP<br>
C. 服务端重脱敏和高危二次检查<br>
D. 移除本地私有字段和非 inline 图片源<br>
E. 只看客户端传来的 `redacted: true`

<details><summary>答案与解析</summary>

**答案：A、B、C、D。** 发布服务不信任客户端布尔值，会对最终 payload 再做实际检查。

</details>

#### 题 15｜单选题

**问题：** 为什么本地查看器的写路由仍需要 CSRF token？

A. 因为项目会修改原始会话<br>
B. 因为恶意网页可能试图请求 localhost，而恢复会话、写偏好、显示文件和发布都有真实副作用<br>
C. 因为 GET 请求在浏览器里不安全<br>
D. 为了加快 SQLite 查询

<details><summary>答案与解析</summary>

**答案：B。** localhost 不是天然信任边界。Origin 检查阻止非预期页面访问，CSRF token 再保护有副作用的写操作。

</details>

#### 题 16｜简答题

**问题：** 为什么服务端重新脱敏后，仍然要提醒用户发布前复核？

<details><summary>参考答案</summary>

脱敏器只能覆盖已知特征，无法语义理解所有业务机密、客户数据和自定义凭证。多道闸门显著降低风险，但不应宣称完美脱敏。最终人工审阅仍属于发布协议。

</details>

### 第五组：Electron、实时体验与可靠性

#### 题 17｜多选题

**问题：** Electron 复用 local server 的主要收益和代价是什么？

A. CLI、浏览器 Viewer 与 Electron 可共用行为<br>
B. Launcher 与 Viewer 可共用一个 API origin<br>
C. 子进程可被独立监控与重启<br>
D. 需要额外管理端口、origin、CSRF 与健康恢复<br>
E. 复用 local server 后桌面端就不需要任何生命周期代码

<details><summary>答案与解析</summary>

**答案：A、B、C、D。** 复用统一了业务边界，但 Electron 仍要承担子进程、窗口、端口与健康恢复责任。

</details>

#### 题 18｜单选题

**问题：** `/api/health` 为什么要执行带超时的 `fs.stat`？

A. 为了统计磁盘容量<br>
B. 因为真实故障是文件线程池卡死，纯内存 HTTP 响应可能仍然正常<br>
C. 因为 HTTP 不能检查子进程<br>
D. 为了每 30 秒重建搜索索引

<details><summary>答案与解析</summary>

**答案：B。** 健康探针必须练习产品依赖的真实能力，否则缓存命中会掩盖底层文件读取已经失效。

</details>

#### 题 19｜单选题

**问题：** 看门狗重启子进程时，为什么必须复用原端口？

A. 为了节省 TCP 端口<br>
B. 因为已打开的 Electron 窗口持有原 origin，换端口会让服务恢复但旧窗口仍失效<br>
C. 因为操作系统只允许一个端口<br>
D. 因为 SQLite 文件名包含端口

<details><summary>答案与解析</summary>

**答案：B。** 故障恢复不只要恢复服务进程，还要恢复现有客户端所依赖的连接契约。

</details>

#### 题 20｜多选题

**问题：** live tail 需要同时保护哪些体验不变式？

A. 先用轻量 head 判断是否真有变化<br>
B. 只在变化后加载更完整 Snapshot<br>
C. 用户向上阅读时不强行拉回底部<br>
D. 接续新 turn 后大纲与搜索锚点仍能重建<br>
E. 每个轮询周期都销毁并重建全部 DOM

<details><summary>答案与解析</summary>

**答案：A、B、C、D。** 实时更新要同时考虑请求成本、DOM 成本和用户当前阅读意图。

</details>

### 第六组：取舍、测试与进一步设计

#### 题 21｜多选题

**问题：** 下面哪些是项目的核心测试不变式？

A. `includeTools=false` 时子代理也不泄露 tool turn<br>
B. 秘密不进入 Snapshot title 和公开 payload<br>
C. 多 Codex home 的缓存不串台<br>
D. 静态站未配置 API 时不请求访问者 loopback<br>
E. 所有集成测试必须使用用户真实会话数据

<details><summary>答案与解析</summary>

**答案：A、B、C、D。** 测试应优先在临时 home、fixture 和可控子进程上执行，而不依赖或破坏用户真实数据。

</details>

#### 题 22｜单选题

**问题：** 为什么 Viewer 拆模块时强调渲染输出不变？

A. 因为 CSS 永远不会改变<br>
B. 为了将“代码移动”和“产品行为变化”分开，降低 Review 与回归的归因难度<br>
C. 因为模块化后不能再写测试<br>
D. 为了让所有文件行数一样

<details><summary>答案与解析</summary>

**答案：B。** 行为零变化的重构能让评审者聚焦边界是否分对，也让后续产品修改有清晰基线。

</details>

#### 题 23｜系统设计题

**问题：** 如果未来要支持团队内部的私有会话库，你会怎样保留 local-first 边界？

<details><summary>参考答案</summary>

不应默认同步原始会话。应将上传对象继续限制为用户显式选中、本地预览、脱敏和签名后的版本化 Snapshot；服务端再实施租户、访问控制、保留期、删除权、审计和高危扫描。本地索引与原文件仍不上传；团队端检索只对已发布 Snapshot 建立。如果需要更强隐私，可再引入客户端加密和组织密钥管理，但不要用“企业内部”代替数据边界设计。

</details>

#### 题 24｜开放复盘题

**问题：** 这个项目最能体现作者什么能力？请不要回答“会 Electron”或“会 TypeScript”。

<details><summary>参考答案</summary>

它体现的是将模糊产品需求转换为系统边界的能力：区分原始事实、缓存、可读投影和公开制品；将性能问题拆成首屏、索引、调度和故障恢复；将隐私从单个正则扩展为发布协议；在产品演进后用契约、适配层、缓存和测试偿还复杂度。

</details>

### 自测标准

- **基础掌握**：能用 30 秒说清产品价值和只读边界；
- **源码理解**：能指出事实源、Snapshot 契约、索引键、发布闸门和 Electron 子进程边界；
- **工程判断**：能说清 summary / snapshot、FTS / LIKE、新鲜度 / 延迟、容量扩大 / 故障恢复之间的取舍；
- **安全表达**：不用“本地就安全”、“脱敏了就绝对不泄露”这类绝对话术；
- **面试表达**：能将一个功能串成“用户问题 → 事实源 → 技术选择 → 代价 → 失败模式 → 验证证据”。
