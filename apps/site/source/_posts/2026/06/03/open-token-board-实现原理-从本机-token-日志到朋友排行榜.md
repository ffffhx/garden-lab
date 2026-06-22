---
title: "Open Token Board 实现原理：从本机 Token 日志到朋友排行榜"
date: "2026-06-03 21:20:00"
categories:
  - 技术
tags:
  - Open Token Board
  - Token
  - Agent
  - Next.js
  - PostgreSQL
  - GitHub OAuth
excerpt: "拆解 open-token-board 如何把 Codex、Claude Code、Cursor、Trae 的本机用量日志采集成统一事件，再通过 GitHub Device Flow、后端二次清洗、PostgreSQL/JSON 存储、滚动时间窗口聚合和 Next.js 榜单 UI，做成一个朋友之间可公开查看的 AI 编码 Token 排行榜。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

`Open Token Board` 做的是一件很具体的事：把大家本机 AI 编码工具产生的 token 用量，变成一张可以一起看的朋友排行榜。

先给结论：

1. 它是一个 `pnpm workspace`，把 `web`、`api`、`core`、`deploy` 和 `npx agent` 分成了清晰边界。
2. 真正发给朋友安装的是单文件 `token-board-agent`，不是整个仓库。
3. agent 在本机扫描 `Codex`、`Claude Code`、`Cursor`、`Trae` 的用量记录，并把不同格式归一成 `TokenUsageEvent`。
4. Codex 日志里的 `total_token_usage` 是累计值，agent 会转成相邻 token_count 之间的增量，避免重复计数。
5. 首次安装走 GitHub Device Flow，后端签发 agent session token；旧的 upload token 机制还保留作兼容。
6. 上传到后端后还会再做一次清洗：替换用户身份、截断字段、限制时间范围、hash session id、按配置隐藏模型或项目。
7. 存储层优先用 PostgreSQL；没有数据库配置时回退到 JSON 文件。两种实现都用事件 `id` 去重。
8. 排行榜不是预先写死的表，而是查询时按 `1D`、`7D`、`30D`、`90D` 滚动窗口聚合。
9. 前端页面只读后端 API，不再用假数据兜底；读不到真实服务时会明确显示错误状态。
10. 站点发布时会把 `token-board-agent` 打成 `token-board-agent.tgz`，和 Next.js 静态页面一起由 GitHub Pages 分发。

<figure class="fz087" data-reveal role="group" aria-label="从本机日志到朋友排行榜的五段链路示意图"><style>.fz087{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--r:#8f2d20;--rb:#f1ddd6;--re:#cf9b90;--p:#54579a;--pb:#e6e7f3;--pe:#a9adcf;--gr:#917f5c;--grb:#ece4d2;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(160deg,var(--paper-soft),var(--soft2));border:1px solid var(--hair);border-radius:14px;padding:clamp(16px,3vw,28px);margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz087 *{box-sizing:border-box}.fz087 .ttl{font-size:clamp(18px,2.6vw,26px);font-weight:800;letter-spacing:.5px;line-height:1.3}.fz087 .sub{margin-top:6px;color:var(--muted);font-size:clamp(12px,1.5vw,15px);line-height:1.5}.fz087 .flow{margin-top:20px;display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:stretch}.fz087 .node{position:relative;border-radius:14px;padding:14px 12px;border:1.5px solid var(--hair);background:var(--soft2);opacity:0;transform:translateY(10px);animation:fz087in .7s ease forwards}.fz087 .n1{background:var(--gb);border-color:var(--gl);animation-delay:.05s}.fz087 .n2{background:var(--cb);border-color:var(--ce);animation-delay:.45s}.fz087 .n3{background:var(--ab);border-color:var(--ae);animation-delay:.85s}.fz087 .n4{background:var(--grb);border-color:var(--gr);animation-delay:1.25s}.fz087 .n5{background:var(--rb);border-color:var(--re);animation-delay:1.65s}.fz087 .nh{font-size:clamp(13px,1.7vw,17px);font-weight:800;margin-bottom:9px;line-height:1.25}.fz087 .n1 .nh{color:var(--g)}.fz087 .n2 .nh{color:var(--c)}.fz087 .n3 .nh{color:var(--a)}.fz087 .n4 .nh{color:#6f5f3e}.fz087 .n5 .nh{color:var(--r)}.fz087 .it{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.25vw,12.5px);color:var(--ink-soft);padding:3px 0;line-height:1.4;border-top:1px dashed var(--hair)}.fz087 .it:first-of-type{border-top:0}.fz087 .arr{position:absolute;top:50%;right:-9px;width:16px;height:16px;transform:translateY(-50%);z-index:3}.fz087 .arr::before{content:"";position:absolute;left:0;top:50%;width:0;height:0;transform:translateY(-50%);border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid var(--p);opacity:.85}.fz087 .arr::after{content:"";position:absolute;right:14px;top:50%;width:14px;height:3px;border-radius:2px;transform:translateY(-50%);background:linear-gradient(90deg,transparent,var(--pe),var(--p));background-size:200% 100%;animation:fz087flow 8s linear infinite}.fz087 .pulse{position:absolute;top:50%;right:-9px;transform:translateY(-50%);width:7px;height:7px;border-radius:50%;background:var(--p);z-index:4;animation:fz087pulse 7s linear infinite}.fz087 .n2 .pulse{animation-delay:1.4s}.fz087 .n3 .pulse{animation-delay:2.8s}.fz087 .n4 .pulse{animation-delay:4.2s}.fz087 .foot{margin-top:18px;background:var(--paper-soft);border:1px solid var(--hair);border-radius:14px;padding:14px 16px;display:flex;flex-wrap:wrap;gap:12px 20px;align-items:flex-start;justify-content:space-between}.fz087 .fl{flex:1 1 300px;min-width:240px}.fz087 .fh{font-weight:800;font-size:clamp(14px,1.8vw,18px);margin-bottom:8px}.fz087 .fp{color:var(--ink-soft);font-size:clamp(11px,1.4vw,14px);line-height:1.6}.fz087 .chip{flex:0 1 auto;align-self:center;background:var(--pb);border:1px solid var(--pe);color:var(--p);font-weight:800;border-radius:10px;padding:10px 16px;font-size:clamp(11px,1.5vw,15px);line-height:1.4;animation:fz087glow 8s ease-in-out infinite}@keyframes fz087in{to{opacity:1;transform:translateY(0)}}@keyframes fz087flow{0%{background-position:140% 0}100%{background-position:-40% 0}}@keyframes fz087pulse{0%{opacity:0;transform:translate(-2px,-50%) scale(.6)}6%{opacity:1}14%{opacity:1;transform:translate(8px,-50%) scale(1)}22%{opacity:0;transform:translate(14px,-50%) scale(.6)}100%{opacity:0}}@keyframes fz087glow{0%,100%{box-shadow:0 0 0 0 rgba(84,87,154,0)}50%{box-shadow:0 0 0 4px rgba(84,87,154,.12)}}@media(max-width:560px){.fz087 .flow{grid-template-columns:1fr;gap:8px}.fz087 .node{opacity:1;transform:none;animation:fz087in .6s ease forwards}.fz087 .arr{top:auto;bottom:-9px;right:50%;left:50%;transform:translateX(-50%);width:16px;height:16px}.fz087 .arr::before{left:50%;top:0;transform:translateX(-50%);border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid var(--p);border-bottom:0}.fz087 .arr::after{display:none}.fz087 .pulse{top:auto;bottom:-9px;right:50%;left:50%;transform:translateX(-50%)}@keyframes fz087pulse{0%{opacity:0;transform:translate(-50%,-2px) scale(.6)}6%{opacity:1}14%{opacity:1;transform:translate(-50%,8px) scale(1)}22%{opacity:0;transform:translate(-50%,14px) scale(.6)}100%{opacity:0}}}@media(prefers-reduced-motion:reduce){.fz087 .node{animation:none;opacity:1;transform:none}.fz087 .arr::after{animation:none;background-position:0 0}.fz087 .pulse{animation:none;opacity:0}.fz087 .chip{animation:none}}</style><div class="ttl">从本机日志到朋友排行榜的五段链路</div><div class="sub">采集端处理脏数据，服务端保证身份和幂等，前端只读真实 API。</div><div class="flow"><div class="node n1"><div class="nh">1. 本机来源</div><div class="it">Codex JSONL</div><div class="it">Claude history</div><div class="it">Cursor SQLite</div><div class="it">Trae 日志目录</div><span class="arr" aria-hidden="true"></span><span class="pulse" aria-hidden="true"></span></div><div class="node n2"><div class="nh">2. npx Agent</div><div class="it">扫描文件</div><div class="it">解析 token</div><div class="it">Codex 差分</div><div class="it">生成事件 id</div><span class="arr" aria-hidden="true"></span><span class="pulse" aria-hidden="true"></span></div><div class="node n3"><div class="nh">3. API 服务</div><div class="it">验证 agent token</div><div class="it">覆盖用户身份</div><div class="it">二次清洗</div><div class="it">返回 accepted</div><span class="arr" aria-hidden="true"></span><span class="pulse" aria-hidden="true"></span></div><div class="node n4"><div class="nh">4. 存储层</div><div class="it">PostgreSQL 优先</div><div class="it">JSON 文件兜底</div><div class="it">id 主键去重</div><div class="it">replace 按用户清理</div><span class="arr" aria-hidden="true"></span><span class="pulse" aria-hidden="true"></span></div><div class="node n5"><div class="nh">5. UI</div><div class="it">滚动窗口</div><div class="it">用户排名</div><div class="it">模型分布</div><div class="it">个人面板</div></div></div><div class="foot"><div class="fl"><div class="fh">核心边界</div><div class="fp">本机日志可以很脏，但 core 之后只看 TokenUsageEvent。</div><div class="fp">前端不理解原始日志，也不展示 demo 榜单兜底。</div></div><div class="chip">统一事件 + 幂等写入 + 查询时聚合</div></div></figure>

本文观察对象如下：

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/bytedance/Code/open-token-board` |
| 观察日期 | `2026-06-03` |
| 观察 commit | `0f679baeb22b62ede9c49c0aa231a3577902998b` |
| 前端入口 | `apps/web/app/board/page.tsx` |
| API 入口 | `apps/token-board-api/src/server.ts` |
| core 聚合 | `packages/token-board-core/src/token-leaderboard.ts` |
| 发布 agent | `tools/token-board-agent-npx/bin/token-board-agent.mjs` |

## 0. 先把几个词讲清楚

这个项目里最核心的概念不是“排行榜”，而是 `TokenUsageEvent`。

它是一条已经清洗过的用量事件，大致包含：

| 字段 | 含义 |
| --- | --- |
| `id` | 事件主键，用来去重和幂等导入 |
| `userId` / `displayName` | 榜单用户身份 |
| `source` / `tool` | 数据来自哪个工具，比如 Codex CLI、Claude Code、Cursor |
| `model` | 这条事件对应的模型名 |
| `project` | 项目名，默认只保留 basename |
| `timestamp` | 这次用量发生的时间 |
| `inputTokens` | 输入上下文 token |
| `cachedInputTokens` | 输入上下文里缓存命中的部分 |
| `outputTokens` | 模型输出 token |
| `reasoningOutputTokens` | 推理 token，主要作为副指标展示 |
| `sessionId` / `sessionTitle` | 会话标识和短标题，默认会对 session id 做 hash |

这里还有一个口径要提前说清楚：榜单里的“总消耗”按 `inputTokens + outputTokens` 算。`cachedInputTokens` 是输入上下文里的缓存命中子集，费用估算会用到，但不会从总消耗里扣掉。项目也明确拒绝只拿 `totalTokens` 兜底，因为不同工具对 `total_tokens` 的定义可能不一致。

另一个词是 `rolling range`。排行榜支持 `1D`、`7D`、`30D`、`90D`，不是自然日、自然周、自然月，而是以当前时间为结束点向前滚动取窗口。比如 `7D` 就是“现在往前 7 天”。

## 1. 总体架构：把不稳定的本机日志挡在 core 外面

这个仓库的边界分得很直接：

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| Web | `apps/web` | Next.js 静态站点、安装说明、榜单 UI |
| API | `apps/token-board-api` | HTTP API、GitHub OAuth、上传鉴权、查询接口 |
| Core | `packages/token-board-core` | 事件模型、采集解析、隐私清洗、排行榜聚合、存储接口 |
| Deploy | `deploy/token-board` | PostgreSQL + API 的 Docker Compose 部署包 |
| Agent | `tools/token-board-agent-npx` | 朋友通过 `npx` 安装的轻量同步工具 |
| Pack | `scripts/pack-agent.mjs` | 把 agent 打成 `apps/web/public/token-board-agent.tgz` |

这套拆法背后的思路是：**本机日志格式随工具变化而变化，但排行榜核心只接受统一事件。**

所以，复杂度主要被分到两段：

- 采集端负责尽可能兼容不同工具的本地文件。
- 服务端负责二次清洗、鉴权、落库和聚合。

前端不直接理解 Codex JSONL、Cursor SQLite 或 Claude history。它只消费 `/api/usage/stats`、`/api/usage/me` 这种已经成形的 JSON。

<figure class="fz088" data-reveal role="group" aria-label="open-token-board monorepo 模块边界示意图：web 与 api 都通过 workspace 依赖 core，agent、pack、deploy 也都汇入 core"><style>.fz088{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:16px;box-sizing:border-box;overflow:hidden}.fz088 *{box-sizing:border-box}.fz088 .hd{margin-bottom:4px;font-size:clamp(19px,3.4vw,28px);font-weight:800;letter-spacing:.2px}.fz088 .sub{margin-bottom:18px;font-size:clamp(12px,1.9vw,15px);color:var(--muted,#6a6155);line-height:1.5}.fz088 .stage{position:relative;background:var(--paper-deep,#ece5d5);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(14px,2.4vw,24px)}.fz088 .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(10px,2vw,22px);align-items:stretch}.fz088 .node{position:relative;border-radius:13px;padding:13px 14px;border:1.5px solid var(--hair);background:#f7f1e4;display:flex;flex-direction:column;gap:5px;min-width:0;z-index:2}.fz088 .node b{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(13px,2.1vw,17px);font-weight:800;letter-spacing:.2px;word-break:break-all}.fz088 .node small{display:block;font-size:clamp(11px,1.7vw,13px);color:var(--ink-soft,#3c362c);line-height:1.45}.fz088 .web{background:var(--c-cyan-bg,#dcebed);border-color:var(--c-cyan-bd,#8fbcc4)}.fz088 .web b{color:var(--c-cyan,#3f6d79)}.fz088 .api{background:var(--c-amber-bg,#f4e8cc);border-color:var(--c-amber-bd,#d9b66a)}.fz088 .api b{color:var(--c-amber,#9a6516)}.fz088 .agent{background:var(--c-red-bg,#f1ddd6);border-color:var(--c-red-bd,#cf9b90)}.fz088 .agent b{color:var(--c-red,#8f2d20)}.fz088 .pack{background:var(--c-gray-bg,#ece4d2);border-color:var(--c-gray,#917f5c)}.fz088 .pack b{color:var(--c-gray,#917f5c)}.fz088 .deploy{background:var(--c-pur-bg,#e6e7f3);border-color:var(--c-pur-bd,#a9adcf)}.fz088 .deploy b{color:var(--c-pur,#54579a)}.fz088 .core{grid-row:span 2;background:var(--c-green-bg,#e7eedd);border:2px solid var(--c-green-lt,#7c9c54);justify-content:center;box-shadow:0 0 0 0 rgba(124,156,84,.45);animation:fz088pulse 8s ease-in-out infinite}.fz088 .core b{color:var(--c-green,#4f7233);font-size:clamp(14px,2.3vw,18px)}.fz088 .core .lead{font-size:clamp(10px,1.5vw,12px);color:var(--c-green,#4f7233);font-weight:700;letter-spacing:.4px;text-transform:uppercase;margin-bottom:2px}@keyframes fz088pulse{0%,100%{box-shadow:0 0 0 0 rgba(124,156,84,0)}50%{box-shadow:0 0 0 7px rgba(124,156,84,.16)}}.fz088 .ar{position:relative;align-self:center;height:18px;display:flex;align-items:center;justify-content:center;z-index:1}.fz088 .ar.h{order:0}.fz088 .line{position:relative;height:3px;width:100%;border-radius:3px;background:var(--hair);overflow:hidden}.fz088 .line::after{content:"";position:absolute;top:0;height:100%;width:42%;border-radius:3px;background:linear-gradient(90deg,transparent,var(--ink-soft,#3c362c),transparent);animation:fz088flowR 6s linear infinite}.fz088 .ar.toL .line::after{animation:fz088flowL 6s linear infinite}.fz088 .tip{position:absolute;top:50%;transform:translateY(-50%);width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent}.fz088 .ar.toR .tip{right:-1px;border-left:9px solid var(--ink-soft,#3c362c)}.fz088 .ar.toL .tip{left:-1px;border-right:9px solid var(--ink-soft,#3c362c)}@keyframes fz088flowR{0%{left:-45%}100%{left:105%}}@keyframes fz088flowL{0%{right:-45%}100%{right:105%}}.fz088 .vwrap{display:flex;flex-direction:column;align-items:center;gap:6px}.fz088 .varrow{position:relative;width:3px;height:clamp(14px,2.4vw,26px);border-radius:3px;background:var(--hair);overflow:hidden}.fz088 .varrow::after{content:"";position:absolute;left:0;width:100%;height:48%;border-radius:3px;background:linear-gradient(180deg,transparent,var(--ink-soft,#3c362c),transparent);animation:fz088flowU 6.5s linear infinite}.fz088 .varrow .vtip{position:absolute;left:50%;top:-1px;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:9px solid var(--ink-soft,#3c362c)}@keyframes fz088flowU{0%{top:110%}100%{top:-50%}}.fz088 .toLbl{font-size:11px;color:var(--muted,#6a6155);font-family:var(--font-mono,ui-monospace,monospace);letter-spacing:.3px}.fz088 .botrow{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(10px,2vw,22px);margin-top:clamp(10px,2vw,18px)}.fz088 .focus{margin-top:18px;background:var(--ink,#1a1815);color:var(--paper-soft,#faf6ec);border-radius:11px;padding:12px 16px;font-size:clamp(12px,1.9vw,14.5px);line-height:1.5;display:flex;gap:9px;align-items:baseline}.fz088 .focus .tag{flex:none;font-family:var(--font-mono,ui-monospace,monospace);font-size:11px;font-weight:700;color:var(--c-green-lt,#7c9c54);letter-spacing:.5px}.fz088[data-reveal] .node{opacity:0;transform:translateY(10px);animation:fz088in .7s ease forwards}.fz088[data-reveal] .web{animation-delay:.05s}.fz088[data-reveal] .core{animation-delay:.18s}.fz088[data-reveal] .api{animation-delay:.32s}.fz088[data-reveal] .agent{animation-delay:.45s}.fz088[data-reveal] .pack{animation-delay:.55s}.fz088[data-reveal] .deploy{animation-delay:.65s}.fz088.in-view .node{opacity:1}@keyframes fz088in{to{opacity:1;transform:translateY(0)}}@media(max-width:560px){.fz088 .grid,.fz088 .botrow{grid-template-columns:1fr}.fz088 .core{grid-row:auto}.fz088 .ar.h{display:none}.fz088 .vwrap{margin:2px 0}}@media (prefers-reduced-motion:reduce){.fz088 *{animation:none!important}.fz088 .node{opacity:1!important;transform:none!important}.fz088 .line::after,.fz088 .varrow::after{display:none}.fz088 .core{box-shadow:0 0 0 4px rgba(124,156,84,.16)}}</style><div class="hd">Monorepo 模块边界</div><div class="sub">业务规则下沉到 core，web 和 api 都通过 workspace 包复用同一套模型。</div><div class="stage"><div class="grid"><div class="node web"><b>apps/web</b><small>Next.js 静态站点</small><small>榜单 UI / 安装指南</small></div><div class="ar h toR"><div class="line"></div><span class="tip"></span></div><div class="node core"><span class="lead">workspace 复用核心</span><b>packages/core</b><small>TokenUsageEvent</small><small>采集 / 清洗</small><small>聚合 / 费用估算</small><small>存储接口</small></div><div class="ar h toR"><div class="line"></div><span class="tip"></span></div><div class="node api"><b>apps/api</b><small>GitHub OAuth</small><small>上传 / 查询接口</small></div></div><div class="botrow"><div class="vwrap"><div class="varrow"><span class="vtip"></span></div><span class="toLbl">依赖 core</span><div class="node agent"><b>tools/agent-npx</b><small>单文件 agent</small><small>LaunchAgent / Task</small></div></div><div class="vwrap"><div class="varrow"><span class="vtip"></span></div><span class="toLbl">依赖 core</span><div class="node pack"><b>scripts/pack-agent</b><small>npm pack</small><small>输出到 public tgz</small></div></div><div class="vwrap"><div class="varrow"><span class="vtip"></span></div><span class="toLbl">依赖 core</span><div class="node deploy"><b>deploy/token-board</b><small>PostgreSQL</small><small>API Docker Compose</small></div></div></div></div><div class="focus"><span class="tag">设计重点</span><span>web 和 api 都依赖 core，避免把排行榜口径散落在 UI 或 HTTP handler 里。</span></div></figure>

## 2. 本机 agent：从多种日志里抠出同一种事件

朋友安装时执行的命令长这样：

```bash
npx --yes token-board-agent install # 安装并启动本机 token 同步 agent
```

安装命令做了三件事：

1. 引导 GitHub Device Login。
2. 保存后端签发的 agent session token 到 `~/.token-board-agent.json`。
3. 注册后台同步任务：macOS 用 `LaunchAgent`，Windows 用 `Task Scheduler`。

后台任务默认每 5 分钟跑一次。真正上传前，它会先扫描本机默认路径：

| 工具 | 默认扫描位置 |
| --- | --- |
| Codex CLI | `~/.codex/sessions`、`~/.codex/archived_sessions`、`~/.codex/projects` |
| Claude Code | `~/.claude/projects`、`~/.claude/history.jsonl` |
| Cursor | 用户 `globalStorage` 和 logs |
| Trae / Trae CN | 用户 `globalStorage`、logs、AI agent 数据目录、`.trae*` 目录 |

也可以用 `TOKEN_BOARD_USAGE_PATHS` 补充自定义 JSON / JSONL / CSV 路径，或用 `TOKEN_BOARD_INCLUDE_DEFAULT_SOURCES=false` 关掉默认扫描源。

采集逻辑不是“看到数字就加总”。它会先找可能含 token 的文件，再根据文件类型解析：

| 文件类型 | 处理方式 |
| --- | --- |
| `.json` | 递归遍历 JSON，寻找 token 字段组合 |
| `.jsonl` / `.log` | 按行 parse JSON，再递归抽取 |
| `.csv` | 读表头，识别 `inputTokens`、`outputTokens` 等字段 |
| `.vscdb` / `state.vscdb` | 用 `sqlite3 -readonly -json` 查询可能包含 usage 的 KV |
| Codex `.jsonl` | 单独解析 `token_count` 事件，并处理累计值差分 |

Codex 的情况最值得单独讲。Codex JSONL 里常见的是 `total_token_usage`，它表示到当前为止这条会话累计用了多少 token。如果每一行都直接拿累计值记一条事件，排行榜会爆炸式重复计数。

所以 agent 会保留上一条累计值，把当前累计值减去上一条累计值，得到这次增量。

下面是按发布版 agent 改写的裁剪片段：

```js
function readCodexUsage(row, previousTotalUsage) { // 读取一行 Codex JSONL 里的 token 用量
  const payload = row.payload || {}; // 取出事件载荷，缺失时给空对象兜底
  if (row.type !== "event_msg") return null; // 非事件消息不产生用量记录
  if (payload.type !== "token_count") return null; // 只有 token_count 才代表一次用量更新
  const info = payload.info || {}; // token 详情放在 payload.info 里
  const total = info.total_token_usage; // Codex 常见字段是会话累计用量
  const usage = total ? diffUsage(total, previousTotalUsage) : info.last_token_usage; // 有累计值就转成增量，没有累计值才读单次值
  if (!usage) return null; // 没有可用 token 字段就跳过
  return usage; // 返回后续可归一化的单次 token 用量
} // Codex 单行用量读取结束
```

这个设计带来两个结果：

- 榜单按“每次新增消耗”计数，而不是按“会话累计快照”计数。
- agent 可以重复扫描最近 30 天文件，因为最终会用稳定事件 `id` 去重。

## 3. 隐私边界：客户端少传，服务端再洗一遍

这个项目适合公开排名，但不适合公开 prompt。它的隐私边界主要靠两层实现。

第一层在 agent。本机采集时会跳过 `content`、`prompt`、`text`、`body`、`transcript` 这类明显可能包含正文的字段，只抽 token 计数、模型、工具、时间、项目 basename 和 session 信息。对于 Codex，会话短标题可能来自 `session_index.jsonl` 或用户首条消息的短摘要，但会被截断。

第二层在 API。即使 agent 传了某些字段，`/api/usage/ingest` 也不会原样信任。后端会用当前认证身份覆盖 `userId`、`displayName`、`team`，再调用 `sanitizeIngestEvents` 重新生成稳定 `id`。

<figure class="fz089" data-reveal role="group" aria-label="隐私边界示意图：Agent 端少传敏感字段，API 端按认证身份二次清洗"><style>.fz089{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--grn:#4f7233;--grn-bg:#e7eedd;--grn-lt:#7c9c54;--amb:#9a6516;--amb-bg:#f4e8cc;--amb-bd:#d9b66a;--cy:#3f6d79;--cy-bg:#dcebed;--cy-bd:#8fbcc4;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(180deg,var(--paper-soft),#f7f1e4);border:1px solid var(--hair);border-radius:16px;padding:22px clamp(16px,3vw,30px) 20px;margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz089 *{box-sizing:border-box}.fz089 .hd{margin-bottom:18px}.fz089 .ttl{font-size:clamp(18px,2.6vw,25px);font-weight:800;letter-spacing:.4px;color:var(--ink);line-height:1.3}.fz089 .sub{font-size:clamp(12px,1.6vw,14px);color:var(--muted);margin-top:6px;line-height:1.5}.fz089 .stage{display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch;gap:clamp(8px,1.6vw,18px)}.fz089 .col{border-radius:18px;padding:16px 16px 14px;border:1.5px solid;position:relative;display:flex;flex-direction:column}.fz089 .col.agent{background:var(--grn-bg);border-color:var(--grn-lt)}.fz089 .col.api{background:var(--amb-bg);border-color:var(--amb-bd)}.fz089 .ch{font-size:clamp(15px,2vw,20px);font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:8px}.fz089 .col.agent .ch{color:var(--grn)}.fz089 .col.api .ch{color:var(--amb)}.fz089 .dot{width:9px;height:9px;border-radius:50%;flex:none}.fz089 .col.agent .dot{background:var(--grn)}.fz089 .col.api .dot{background:var(--amb)}.fz089 .rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px;flex:1}.fz089 .row{font-size:clamp(12px,1.55vw,15px);color:var(--ink-soft);line-height:1.4;padding-left:18px;position:relative;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);opacity:0;transform:translateX(var(--fz089x,-6px));animation:fz089row 9s ease-in-out infinite}.fz089 .col.api .row{--fz089x:6px}.fz089 .row::before{content:"";position:absolute;left:2px;top:.5em;width:7px;height:7px;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:rotate(45deg);opacity:.55}.fz089 .col.agent .row::before{color:var(--grn)}.fz089 .col.api .row::before{color:var(--amb)}.fz089 .row:nth-child(1){animation-delay:0s}.fz089 .row:nth-child(2){animation-delay:.25s}.fz089 .row:nth-child(3){animation-delay:.5s}.fz089 .row:nth-child(4){animation-delay:.75s}.fz089 .row:nth-child(5){animation-delay:1s}.fz089 .row:nth-child(6){animation-delay:1.25s}@keyframes fz089row{0%{opacity:0;transform:translateX(var(--fz089x,-6px))}14%,86%{opacity:1;transform:translateX(0)}100%{opacity:1;transform:translateX(0)}}.fz089 .tag{margin-top:13px;align-self:center;font-size:clamp(11px,1.4vw,13px);font-weight:700;color:#fff;padding:6px 14px;border-radius:11px;text-align:center;line-height:1.3}.fz089 .col.agent .tag{background:var(--grn)}.fz089 .col.api .tag{background:var(--amb)}.fz089 .mid{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-width:118px;padding:0 2px}.fz089 .bearer{background:var(--cy-bg);border:1.5px solid var(--cy-bd);border-radius:14px;padding:10px 12px;text-align:center;color:var(--cy);font-weight:800;font-size:clamp(12px,1.7vw,16px);line-height:1.3;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);box-shadow:0 0 0 0 rgba(63,109,121,.25);animation:fz089pulse 7s ease-in-out infinite}.fz089 .bearer small{display:block;font-size:.78em;opacity:.85;margin-top:2px;font-weight:700}@keyframes fz089pulse{0%,100%{box-shadow:0 0 0 0 rgba(63,109,121,0)}50%{box-shadow:0 0 0 5px rgba(63,109,121,.12)}}.fz089 .flow{position:relative;width:100%;height:16px;border-radius:9px;background:linear-gradient(90deg,var(--grn-bg),var(--cy-bg),var(--amb-bg));overflow:hidden;border:1px solid var(--hair)}.fz089 .flow::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:38%;background:linear-gradient(90deg,transparent,rgba(63,109,121,.55),transparent);animation:fz089flow 7s linear infinite}@keyframes fz089flow{0%{left:-40%}100%{left:108%}}.fz089 .arw{color:var(--cy);font-size:14px;font-weight:800;line-height:1;letter-spacing:-2px}.fz089 .banner{margin-top:18px;background:var(--ink);color:var(--paper-soft);border-radius:13px;padding:13px 18px;font-size:clamp(12px,1.7vw,16px);font-weight:700;text-align:center;line-height:1.45;letter-spacing:.3px;position:relative;overflow:hidden}.fz089 .banner::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(124,156,84,.16),transparent);transform:translateX(-100%);animation:fz089sweep 9s ease-in-out infinite}@keyframes fz089sweep{0%,70%{transform:translateX(-100%)}100%{transform:translateX(100%)}}.fz089 .banner b{color:var(--grn-lt);font-weight:800}@media(max-width:560px){.fz089 .stage{grid-template-columns:1fr}.fz089 .mid{flex-direction:row;flex-wrap:wrap;min-width:0;padding:4px 0}.fz089 .flow{width:96px;height:14px}.fz089 .arw{transform:none}}@media (prefers-reduced-motion:reduce){.fz089 .row,.fz089 .bearer,.fz089 .flow::after,.fz089 .banner::before{animation:none!important}.fz089 .row{opacity:1;transform:none}.fz089 .flow::after{display:none}}</style><div class="hd"><div class="ttl">隐私边界：客户端少传，服务端再洗</div><div class="sub">公开的是统计，不是 prompt、绝对路径或原始 transcript。</div></div><div class="stage"><div class="col agent"><div class="ch"><span class="dot"></span>Agent 端</div><div class="rows"><div class="row">只抽 token 计数</div><div class="row">跳过 content / prompt / body</div><div class="row">项目默认取 basename</div><div class="row">session id 默认 hash</div><div class="row">短标题截断到安全长度</div><div class="row">本地状态记 uploadedIds</div></div><div class="tag">尽量不让敏感字段离开本机</div></div><div class="mid"><div class="bearer">Bearer<small>agent token</small></div><div class="flow"></div><div class="arw">▶▶▶</div></div><div class="col api"><div class="ch"><span class="dot"></span>API 端</div><div class="rows"><div class="row">验证 GitHub agent token</div><div class="row">用认证身份覆盖 userId</div><div class="row">限制事件时间范围</div><div class="row">根据环境变量隐藏字段</div><div class="row">重新生成稳定事件 id</div><div class="row">按 id 幂等写入存储层</div></div><div class="tag">不信任客户端原样上传字段</div></div></div><div class="banner">原则：排行榜需要<b>可信身份</b>，上传事件不能决定自己是谁。</div></figure>

服务端可配置的隐私开关包括：

| 配置 | 行为 |
| --- | --- |
| `TOKEN_BOARD_PROJECT_MODE=basename` | 默认只保留项目 basename |
| `TOKEN_BOARD_PROJECT_MODE=hash` | 把项目名变成 `project:<hash>` |
| `TOKEN_BOARD_PROJECT_MODE=none` | 不保存项目名 |
| `TOKEN_BOARD_INCLUDE_MODEL=false` | 模型名统一写成 `hidden` |
| `TOKEN_BOARD_INCLUDE_SOURCE=false` | 来源统一写成 `local-agent` |
| `TOKEN_BOARD_HASH_SESSION_ID=false` | 允许不 hash session id，默认是 hash |

裁剪后的清洗逻辑大概是这样：

```ts
function sanitizeUploadedEvent(event, identity, options) { // 清洗一条上传事件
  const normalized = normalizeTokenUsageEvent(event); // 先把各种字段名归一成 TokenUsageEvent
  const project = sanitizeProjectName(normalized.project, options.projectMode); // 根据配置保留、隐藏或 hash 项目名
  const sessionId = hashSessionId(normalized.sessionId); // 默认只保存 session id 的短 hash
  const model = options.includeModel === false ? "hidden" : normalized.model; // 服务端可以统一隐藏模型名
  const source = options.includeSource === false ? "local-agent" : normalized.source; // 服务端可以统一隐藏真实来源
  return normalizeTokenUsageEvent({ ...normalized, userId: identity.userId, project, sessionId, model, source }); // 用认证身份覆盖用户字段后返回
} // 上传事件清洗结束
```

这一步的重点不是“绝对安全”，而是建立一个清楚的产品边界：公开的是统计，不是对话内容。排行榜可以讨论“谁最近在高强度使用 agent”，但不应该让朋友看到你的完整 prompt、绝对路径或原始 transcript。

## 4. 鉴权：网页登录和 agent 登录是两种 token

项目里有三类签名 token：

| token purpose | 用途 |
| --- | --- |
| `web` | 浏览器登录后放在 cookie 里，用于 `/api/auth/me` 和 `/api/usage/me` |
| `agent` | Device Flow 登录后给本机 agent，用于 `/api/usage/ingest` 和 `/api/usage/replace` |
| `oauth-state` | GitHub OAuth 回调时防 CSRF 和携带 returnTo |

签名方式很朴素：把 payload 做 base64url，再用 `HMAC-SHA256` 签名，格式是：

```text
base64url(payload).base64url(hmac) # token 由载荷和 HMAC 签名两段组成
```

网页端走常规 GitHub OAuth：`/api/auth/github/start` 跳到 GitHub 授权页，callback 里换 access token，再取 GitHub profile，最后设置 `token_board_session` cookie。

agent 端走 GitHub Device Flow：命令行先请求 `/api/auth/device/start`，展示 `verificationUri` 和 `userCode`；用户在浏览器授权后，agent 轮询 `/api/auth/device/poll`。授权成功时，后端签一个长期 `agent` token 返回给本机。

这个区分很重要：

- 浏览器 cookie 适合网页查看个人视图。
- agent bearer token 适合后台任务静默上传。
- 两者都从 GitHub 身份派生，但权限用途不同。

后端还保留了旧的 `uploadToken` 机制。如果请求里的 bearer token 不是 agent token，就会去 `TOKEN_BOARD_USERS_JSON`、`TOKEN_BOARD_UPLOAD_TOKEN` 或 users 文件里找旧 token。这个兼容层让早期部署不用一次性迁移。

## 5. 存储：PostgreSQL 是正式路径，JSON 文件是轻量兜底

存储层有统一接口：

| 方法 | 作用 |
| --- | --- |
| `listEvents()` | 读取可用于聚合的事件 |
| `countEvents()` | 统计总记录数 |
| `insertEvents(events)` | 插入事件并返回 accepted / duplicates |
| `deleteEventsForUser(userId)` | 清掉某个用户的记录，用于 replace |
| `getUserConfig(userId)` | 读取 agent 上报的用户配置摘要 |
| `upsertUserConfig(userId, config)` | 更新用户配置摘要 |

如果设置了 `TOKEN_BOARD_DATABASE_URL`，API 启动时会创建 PostgreSQL store；否则回退到 `.token-board/usage-events.json`。

PostgreSQL 表的主键是 `id`。插入时走 `ON CONFLICT (id)`，所以 agent 反复 `resync` 不会制造重复记录。比较细的是：如果冲突事件这次带了新的 `session_title`，数据库会补上标题，但不会把整条历史记录覆盖掉。

裁剪后的插入逻辑像这样：

```sql
INSERT INTO usage_events (id, user_id, reported_at, input_tokens, output_tokens) -- 以事件 id 作为幂等主键写入
VALUES ($1, $2, $3, $4, $5) -- 每条上传事件对应一行标准记录
ON CONFLICT (id) DO UPDATE -- 重复上传时不新增第二条记录
SET session_title = COALESCE(EXCLUDED.session_title, usage_events.session_title); -- 只补充更完整的会话标题
```

JSON 文件 store 的策略也类似：读出已有事件，按 `id` 合并，排序后截到 `maxEvents`。文件写入会先写临时文件，再 rename 到正式文件，降低半写入状态的风险。

这里还有一个 `replace` 入口。`token-board-agent replace` 会调用 `/api/usage/replace`：后端先删除当前认证用户的旧记录，再插入这次本机能采集到的记录。这个命令适合后端迁移或历史数据脏掉时用，但它只影响当前用户，不会清空全库。

## 6. 排行榜：查询时按时间窗口重新聚合

排行榜核心在 `buildTokenLeaderboard`。

它做的不是数据库里的 `ORDER BY sum(tokens)`，而是先拿到事件列表，再在 core 里按窗口聚合。流程是：

1. 根据 `range` 计算当前窗口 `[start, end]`。
2. 再计算前一段等长窗口，用来算 `deltaTokens`。
3. 对事件做 normalize + dedupe。
4. 过滤当前窗口事件。
5. 按用户聚合 token、费用、会话数、消息数、活跃天数、top model、top tool。
6. 按选择的 metric 排名：`tokens`、`cost`、`sessions` 或 `messages`。
7. 生成全局 daily、models、tools 分布。

<figure class="fz090" data-reveal role="group" aria-label="排行榜聚合：查询时按滚动窗口计算，事件经过 normalize dedupe filter aggregate rank 生成排行榜 summary"><style>.fz090{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--r:#8f2d20;--rb:#f1ddd6;--re:#cf9b90;--p:#54579a;--pb:#e6e7f3;--pe:#a9adcf;--gy:#917f5c;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),var(--soft2,#f7f1e4));color:var(--ink,#1a1815);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;padding:clamp(16px,3.2vw,30px);margin:1.4em 0;max-width:100%;box-sizing:border-box;line-height:1.5}.fz090 *{box-sizing:border-box}.fz090 .hd{margin-bottom:1.1em}.fz090 .ttl{font-size:clamp(18px,2.9vw,27px);font-weight:800;letter-spacing:.01em;line-height:1.25}.fz090 .sub{font-size:clamp(12px,1.7vw,15px);color:var(--muted,#6a6155);margin-top:.45em}.fz090 .panel{border:1px solid var(--hair,rgba(26,24,21,.18));background:rgba(255,255,255,.42);border-radius:16px;padding:clamp(13px,2.4vw,20px);margin-bottom:1.15em}.fz090 .ptag{font-size:clamp(13px,1.9vw,18px);font-weight:800;color:var(--ink,#1a1815);margin-bottom:.85em}.fz090 .win{position:relative}.fz090 .axis{position:relative;height:5px;border-radius:5px;background:linear-gradient(90deg,var(--gy,#917f5c),var(--muted,#6a6155));margin:0 4px;overflow:hidden}.fz090 .axis::after{content:"";position:absolute;top:-3px;bottom:-3px;width:40px;border-radius:6px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);left:-40px;animation:fz090sweep 8s ease-in-out infinite}@keyframes fz090sweep{0%{left:-12%}55%{left:100%}100%{left:100%}}.fz090 .segs{display:flex;gap:10px;margin-top:14px}.fz090 .seg{flex:1;border-radius:12px;padding:9px 12px;font-size:clamp(12px,1.7vw,16px);font-weight:800;border:1px solid;position:relative;overflow:hidden}.fz090 .seg.prev{background:var(--rb,#f1ddd6);border-color:var(--re,#cf9b90);color:var(--r,#8f2d20)}.fz090 .seg.cur{background:var(--cb,#dcebed);border-color:var(--ce,#8fbcc4);color:var(--c,#3f6d79)}.fz090 .seg::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);transform:translateX(-120%);animation:fz090fill 8s ease-in-out infinite}.fz090 .seg.cur::before{animation-delay:1.2s}@keyframes fz090fill{0%,40%{transform:translateX(-120%)}70%,100%{transform:translateX(120%)}}.fz090 .ticks{display:flex;justify-content:space-between;margin-top:9px;font-size:clamp(10px,1.4vw,13px);color:var(--muted,#6a6155);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz090 .pipe{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px;margin-bottom:1.15em}.fz090 .node{flex:1 1 140px;min-width:128px;border:1px solid;border-radius:14px;padding:11px 13px;position:relative;animation:fz090glow 8s ease-in-out infinite}.fz090 .node .nm{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(14px,2vw,19px);font-weight:800;letter-spacing:-.01em}.fz090 .node .ds{font-size:clamp(11px,1.5vw,14px);color:var(--ink-soft,#3c362c);margin-top:.3em}.fz090 .n1{background:var(--cb,#dcebed);border-color:var(--ce,#8fbcc4)}.fz090 .n1 .nm{color:var(--c,#3f6d79)}.fz090 .n2{background:var(--gb,#e7eedd);border-color:var(--gl,#7c9c54)}.fz090 .n2 .nm{color:var(--g,#4f7233)}.fz090 .n3{background:var(--ab,#f4e8cc);border-color:var(--ae,#d9b66a)}.fz090 .n3 .nm{color:var(--a,#9a6516)}.fz090 .n4{background:var(--pb,#e6e7f3);border-color:var(--pe,#a9adcf)}.fz090 .n4 .nm{color:var(--p,#54579a)}.fz090 .n5{background:var(--rb,#f1ddd6);border-color:var(--re,#cf9b90)}.fz090 .n5 .nm{color:var(--r,#8f2d20)}.fz090 .n1{animation-delay:0s}.fz090 .n2{animation-delay:1.2s}.fz090 .n3{animation-delay:2.4s}.fz090 .n4{animation-delay:3.6s}.fz090 .n5{animation-delay:4.8s}@keyframes fz090glow{0%,100%{box-shadow:0 0 0 0 rgba(26,24,21,0)}12%{box-shadow:0 3px 14px -4px rgba(26,24,21,.28)}30%{box-shadow:0 0 0 0 rgba(26,24,21,0)}}.fz090 .arr{flex:0 0 auto;align-self:center;display:flex;align-items:center;color:var(--muted,#6a6155)}.fz090 .arr i{display:block;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid currentColor;animation:fz090push 8s ease-in-out infinite}.fz090 .arr.a1 i{animation-delay:.6s}.fz090 .arr.a2 i{animation-delay:1.8s}.fz090 .arr.a3 i{animation-delay:3s}.fz090 .arr.a4 i{animation-delay:4.2s}@keyframes fz090push{0%,100%{transform:translateX(0);opacity:.5}50%{transform:translateX(4px);opacity:1}}.fz090 .out{background:var(--ink,#1a1815);color:var(--paper-soft,#faf6ec);border-radius:15px;padding:clamp(13px,2.3vw,18px) clamp(15px,2.6vw,22px);position:relative;overflow:hidden}.fz090 .out::after{content:"";position:absolute;top:0;bottom:0;width:60px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent);left:-60px;animation:fz090sweep 8s ease-in-out infinite;animation-delay:5.5s}.fz090 .out .o1{font-size:clamp(13px,1.85vw,17px);font-weight:800;line-height:1.45}.fz090 .out .o1 b{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);color:var(--ce,#8fbcc4);font-weight:800}.fz090 .out .o2{font-size:clamp(11px,1.55vw,14px);color:var(--pe,#a9adcf);margin-top:.5em}.fz090 .out .o2 b{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);color:var(--ae,#d9b66a);font-weight:700}@media(max-width:560px){.fz090 .pipe{flex-direction:column}.fz090 .node{flex:1 1 auto;width:100%}.fz090 .arr{align-self:center;transform:rotate(90deg)}.fz090 .segs{flex-direction:column}}@media(prefers-reduced-motion:reduce){.fz090 .axis::after,.fz090 .seg::before,.fz090 .node,.fz090 .arr i,.fz090 .out::after{animation:none}.fz090 .axis::after,.fz090 .seg::before,.fz090 .out::after{display:none}.fz090 .arr i{opacity:1;transform:none}.fz090 .node{box-shadow:0 2px 10px -5px rgba(26,24,21,.2)}}</style><div class="hd"><div class="ttl">排行榜聚合：查询时按滚动窗口计算</div><div class="sub">同一批事件可以按不同 range 和 metric 生成不同视角。</div></div><div class="panel"><div class="ptag">时间窗口</div><div class="win"><div class="axis"></div><div class="segs"><div class="seg prev">前一窗口：算 delta</div><div class="seg cur">当前窗口：算排名</div></div><div class="ticks"><span>previousStart</span><span>start</span><span>end / now</span></div></div></div><div class="pipe"><div class="node n1"><div class="nm">normalize</div><div class="ds">字段口径统一</div></div><div class="arr a1"><i></i></div><div class="node n2"><div class="nm">dedupe</div><div class="ds">按 id 去重</div></div><div class="arr a2"><i></i></div><div class="node n3"><div class="nm">filter</div><div class="ds">按 range 过滤</div></div><div class="arr a3"><i></i></div><div class="node n4"><div class="nm">aggregate</div><div class="ds">按用户汇总</div></div><div class="arr a4"><i></i></div><div class="node n5"><div class="nm">rank</div><div class="ds">按 metric 排序</div></div></div><div class="out"><div class="o1">输出 summary：<b>users</b>、<b>daily</b>、<b>models</b>、<b>tools</b>、<b>totalTokens</b>、<b>totalCostUsd</b></div><div class="o2">metric 可切换 <b>tokens / cost / sessions / messages</b>，range 可切换 <b>1D / 7D / 30D / 90D</b>。</div></div></figure>

下面是按源码改写后的最小结构：

```ts
function buildLeaderboard(entries, range, metric, now) { // 构建某个时间窗口的排行榜
  const end = validDate(now); // 以当前时间作为滚动窗口结束点
  const start = subtractRange(end, range); // 根据 1D/7D/30D/90D 算开始时间
  const previousStart = subtractRange(start, range); // 再往前取一个等长窗口用于环比
  const normalized = dedupe(entries.map(normalize)); // 先归一化并按事件 id 去重
  const current = filterBetween(normalized, start, end); // 只保留当前窗口事件
  const previous = filterBetween(normalized, previousStart, start); // 只保留前一窗口事件
  const users = rankUsers(aggregateUsers(current, previous), metric); // 聚合用户后按指标排序
  return { range, startAt: start, endAt: end, users }; // 返回前端可直接渲染的 summary
} // 排行榜构建结束
```

费用估算也在这一层。`MODEL_PRICING` 按模型名正则匹配单价，区分 input、cached input 和 output。因为这是公开价格估算，所以前端也明确提示“费用为公开模型单价估算，不代表实际账单”。

个人视图复用了同一套聚合逻辑。`buildTokenAccountUsageProfile` 会先构建全局排行榜，找出当前用户 rank；再只过滤当前用户事件，计算项目分布、session 明细、活跃小时热力图和上一窗口排名变化。

## 7. 前端：只读真实 API，不用假榜单糊住问题

前端榜单入口是 `apps/web/app/board/page.tsx`，它把默认 API 地址传给 `TokenLeaderboardApp`：

```tsx
<TokenLeaderboardApp apiBaseUrl={process.env.NEXT_PUBLIC_TOKEN_BOARD_API_URL || DEFAULT_API_URL} initialNow={INITIAL_NOW} /> // 页面把 API 地址和初始时间传给客户端榜单组件
```

客户端组件主要读三个接口：

| 接口 | 前端用途 |
| --- | --- |
| `/api/usage/stats?range=...&metric=...` | 榜单总览、用户排名、模型/工具分布 |
| `/api/auth/me` | 判断当前浏览器是否已 GitHub 登录 |
| `/api/usage/me?range=...` | 登录后读取自己的个人分析面板 |

一个很好的取舍是：页面不再展示 demo 榜单。代码里会构建一个空 summary 让组件结构不崩，但只要真实 API 未配置或请求失败，UI 就进入 error state，并显示“不会回退到静态或本地数据”。

这让排行榜更可信。朋友打开页面时看到的要么是真实后端数据，要么是明确的加载失败，而不是一份看起来很热闹的示例排名。

页面上的控制也都直接映射到 core：

| 控件 | 对应 core 参数 |
| --- | --- |
| `1D / 7D / 30D / 90D` | `TokenBoardRange` |
| `总消耗 / 费用 / 会话 / 消息` | `TokenBoardMetric` |
| 个人面板 | `buildTokenAccountUsageProfile` |
| 缓存命中率 | `cachedInputTokens / inputTokens` |
| 消耗 / 会话 | `inputTokens + outputTokens` 除以 session 数 |

## 8. 发布链路：站点和 agent 共用一个 Pages 出口

项目的发布也挺简洁：

1. `scripts/pack-agent.mjs` 进入 `tools/token-board-agent-npx` 执行 `npm pack`。
2. 打包产物被重命名为 `apps/web/public/token-board-agent.tgz`。
3. `pnpm build` 再构建 Next.js 静态站点。
4. GitHub Pages 同时发布网页和 agent tarball。

<figure class="fz091" data-reveal role="group" aria-label="发布链路示意图：agent 打包进 public，Next.js 静态站点走 GitHub Pages，API 与 PostgreSQL 走 Docker Compose 后端"><style>.fz091{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--paper-warm:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--r:#8f2d20;--rb:#f1ddd6;--re:#cf9b90;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3.2vw,30px);margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz091 *{box-sizing:border-box}.fz091 .hd{margin-bottom:20px}.fz091 .ttl{font-size:clamp(17px,2.5vw,23px);font-weight:800;letter-spacing:.01em;line-height:1.3}.fz091 .sub{font-size:clamp(12px,1.6vw,14px);color:var(--muted,#6a6155);margin-top:6px;line-height:1.5}.fz091 .stage{border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:16px;background:var(--paper-warm,#f7f1e4);padding:clamp(12px,2vw,18px);margin-bottom:8px}.fz091 .stage-t{font-size:clamp(13px,1.8vw,16px);font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:8px}.fz091 .stage-t::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--ink-soft,#3c362c);flex:0 0 auto}.fz091 .row1{display:flex;align-items:stretch;gap:0;flex-wrap:wrap}.fz091 .node{flex:1 1 150px;min-width:0;border-radius:13px;padding:13px 14px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(12px,1.5vw,15px);font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.35;word-break:break-all}.fz091 .n-r{background:var(--rb,#f1ddd6);border:1px solid var(--re,#cf9b90);color:var(--r,#8f2d20)}.fz091 .n-a{background:var(--ab,#f4e8cc);border:1px solid var(--ae,#d9b66a);color:var(--a,#9a6516)}.fz091 .n-c{background:var(--cb,#dcebed);border:1px solid var(--ce,#8fbcc4);color:var(--c,#3f6d79)}.fz091 .harw{flex:0 0 46px;display:flex;align-items:center;justify-content:center;align-self:center}.fz091 .har{position:relative;width:34px;height:3px;border-radius:3px;background:var(--hair,rgba(26,24,21,.18));overflow:visible}.fz091 .har::before{content:"";position:absolute;left:-34px;top:0;height:100%;width:34px;border-radius:3px;background:linear-gradient(90deg,transparent,var(--c,#3f6d79));animation:fz091flow 7s ease-in-out infinite}.fz091 .har::after{content:"";position:absolute;right:-7px;top:50%;transform:translateY(-50%);border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid var(--c,#3f6d79)}.fz091 .har.d2::before{animation-delay:1.4s}.fz091 .splitw{display:flex;justify-content:center;position:relative;height:30px}.fz091 .split{position:relative;width:70%;max-width:560px;height:100%}.fz091 .split .stem{position:absolute;left:50%;top:0;width:2px;height:13px;transform:translateX(-50%);background:var(--hair,rgba(26,24,21,.18))}.fz091 .split .bar{position:absolute;left:24%;right:24%;top:13px;height:2px;background:var(--hair,rgba(26,24,21,.18))}.fz091 .split .leg{position:absolute;top:13px;width:2px;height:17px;background:var(--hair,rgba(26,24,21,.18));overflow:visible}.fz091 .split .leg.l{left:24%}.fz091 .split .leg.r{right:24%}.fz091 .split .leg::after{content:"";position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--g,#4f7233)}.fz091 .split .leg.l::after{border-top-color:var(--c,#3f6d79)}.fz091 .split .leg::before{content:"";position:absolute;left:-1px;top:-2px;width:4px;height:6px;border-radius:3px;background:currentColor;animation:fz091drip 7s ease-in-out infinite}.fz091 .split .leg.l{color:var(--c,#3f6d79)}.fz091 .split .leg.r{color:var(--g,#4f7233)}.fz091 .split .leg.r::before{animation-delay:.7s}.fz091 .outs{display:grid;grid-template-columns:1fr 1fr;gap:clamp(10px,2vw,18px)}.fz091 .out{border-radius:16px;padding:clamp(13px,2vw,18px);border:1px solid;animation:fz091pulse 9s ease-in-out infinite}.fz091 .o-c{background:var(--cb,#dcebed);border-color:var(--ce,#8fbcc4)}.fz091 .o-g{background:var(--gb,#e7eedd);border-color:var(--gl,#7c9c54);animation-delay:1.6s}.fz091 .out-t{font-size:clamp(14px,1.9vw,17px);font-weight:800;margin-bottom:10px}.fz091 .o-c .out-t{color:var(--c,#3f6d79)}.fz091 .o-g .out-t{color:var(--g,#4f7233)}.fz091 .li{font-size:clamp(12px,1.5vw,14px);color:var(--ink-soft,#3c362c);padding:4px 0;line-height:1.45;border-top:1px solid var(--hair,rgba(26,24,21,.18))}.fz091 .li:first-of-type{border-top:none}.fz091 .li b{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-weight:600;color:var(--ink,#1a1815);word-break:break-all}.fz091 .foot{margin-top:18px;background:var(--ink,#1a1815);color:var(--paper-soft,#faf6ec);border-radius:12px;padding:13px 18px;font-size:clamp(12px,1.6vw,14.5px);line-height:1.5;text-align:center}@keyframes fz091flow{0%,12%{transform:translateX(0);opacity:0}18%{opacity:1}55%{transform:translateX(68px);opacity:1}70%,100%{transform:translateX(68px);opacity:0}}@keyframes fz091drip{0%,30%{transform:translateY(0);opacity:0}45%{opacity:1}75%{transform:translateY(15px);opacity:1}90%,100%{transform:translateY(15px);opacity:0}}@keyframes fz091pulse{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 4px 14px -6px rgba(26,24,21,.25)}}@media(max-width:560px){.fz091 .row1{flex-direction:column;align-items:stretch}.fz091 .harw{flex:0 0 auto;height:34px;transform:rotate(90deg)}.fz091 .outs{grid-template-columns:1fr}.fz091 .split{width:90%}}@media (prefers-reduced-motion:reduce){.fz091 .har::before,.fz091 .split .leg::before,.fz091 .out{animation:none}.fz091 .har::before{opacity:1;transform:translateX(34px)}.fz091 .split .leg::before{opacity:0}}</style><div class="hd"><div class="ttl">发布链路：网页和 agent 共用 Pages 出口</div><div class="sub">前端静态发布，后端独立部署，agent tarball 随站点一起分发。</div></div><div class="stage"><div class="stage-t">静态发布</div><div class="row1"><div class="node n-r">tools/agent-npx</div><div class="harw"><div class="har"></div></div><div class="node n-a">npm pack</div><div class="harw"><div class="har d2"></div></div><div class="node n-c">public/agent.tgz</div></div></div><div class="splitw"><div class="split"><div class="stem"></div><div class="bar"></div><div class="leg l"></div><div class="leg r"></div></div></div><div class="outs"><div class="out o-c"><div class="out-t">GitHub Pages</div><div class="li">Next.js 静态页面</div><div class="li"><b>/board</b> 榜单</div><div class="li"><b>/token-board-agent.tgz</b></div></div><div class="out o-g"><div class="out-t">Docker Compose 后端</div><div class="li"><b>token-board</b> API</div><div class="li">PostgreSQL 17</div><div class="li"><b>TOKEN_BOARD_DATABASE_URL</b></div></div></div><div class="foot">朋友只需要 npx 安装；网页和 agent 从同一个公开站点下载，API 独立保存真实数据。</div></figure>

这就是为什么 README 里可以给出这种安装命令：

```bash
npx --yes --package https://ffffhx.github.io/open-token-board/token-board-agent.tgz?v=0.4.11 -- token-board-agent install # 从 Pages 下载 agent tarball 并执行安装
```

它绕开了“朋友要先 clone 仓库”的门槛。朋友只需要执行一条命令，后续采集和上传都由本机后台任务负责。

后端部署走 `deploy/token-board/compose.yaml`。Compose 里有两个服务：

| 服务 | 作用 |
| --- | --- |
| `postgres` | PostgreSQL 17，持久化 token 事件 |
| `token-board` | API 服务，读取 `.env`，连接 PostgreSQL |

API 容器通过 `TOKEN_BOARD_DATABASE_URL` 连到 Postgres；如果不配数据库，开发环境仍然可以用 JSON 文件跑起来。

## 9. 这套实现最值得学的几个点

第一，排行榜的最小单位不是“用户总量”，而是“事件”。只要事件 `id` 稳定，采集端可以反复扫、本地可以 resync、服务端可以去重，后面的排名才稳。

第二，隐私边界要放在两边。agent 少传是一层，服务端按认证身份重写和清洗又是一层。只做前者会太依赖客户端版本，只做后者又会让不该离开本机的字段先离开本机。

第三，采集和聚合不要混在一起。采集端面对的是各种工具奇形怪状的日志；聚合端只面对 `TokenUsageEvent`。这个边界让前端和 API 不需要随着每个工具的日志变化一起抖。

第四，真实数据产品不要用漂亮假数据兜底。Open Token Board 的前端宁愿显示“API 未配置”，也不展示 demo 排行榜。这对一个朋友间可对比的榜单很重要。

第五，轻量发布路径会改变使用门槛。`npx agent + GitHub Device Flow + 后台任务` 这条链路，把“让朋友持续上报”从仓库协作问题变成了一条命令的问题。

当然，这版也还有一些工程上的边界：

- 目前验证层主要是 `typecheck` 和 agent help，没有看到完整单元测试覆盖解析器。
- Cursor、Trae 这类本地存储格式可能变化，解析器需要持续跟进。
- 费用估算依赖内置模型单价表，和真实账单天然会有差异。
- 文档里部分环境变量示例和源码枚举可能会漂移，部署时最好以源码里的 `parseProjectMode` 这类函数为准。

但整体看下来，这个项目的骨架是清楚的：**本机 agent 把噪声日志归一成事件，后端把事件变成可信数据，前端把可信数据变成可讨论的排行榜。**

这也是 Open Token Board 最有意思的地方。它不是一个复杂的大系统，但把“采集、隐私、鉴权、幂等、聚合、发布”这几个小系统都接上了。对于一个朋友局工具来说，这个尺度刚刚好。
