---
title: "Codex Snapshots 源码解析：把本机 Agent 会话冻结成可分享的只读快照是怎么做到的"
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
  - 源码解析
excerpt: "codex-snapshots 站在你本机三套 Agent（Codex、Claude Code、Trae）的会话历史之上，把它们冻结成可审阅、可导出、可选发布的只读快照。这篇按它重构后的源码（cli / sources / core / renderers / shared / server 分层）拆解整条流水线：summary 与 snapshot 两层加载、把三种历史归一成 turns、子代理嵌套、一张表同时驱动「检测 + 脱敏」的隐私层，以及本地回环服务与云端 Share API 之间那条「本机不上云、上云的必须脱敏且服务端再验一遍」的硬边界。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 1. 它解决什么问题，定位在哪

`codex-snapshots` 做的是一件很克制的事：**把本机 AI 编码工具里的会话历史，冻结成可审阅、可导出、可选发布的只读快照**。

它不远程控制 Codex，也不把原始 thread 原封不动上传到云端。它要解决的，是另一个更微妙的问题：Coding Agent 的会话里经常混着系统提示词、工具参数、命令输出、本机路径、截图、token 和内部域名——如果「分享会话」这件事的产品边界说不清楚，它很容易变成「泄漏运行现场」。

所以这个工具的定位，决定了它的全部技术选择：**本地优先地读、归一地展示、分层地脱敏、有边界地发布**。它最值得学习的地方，不是「怎么读 JSONL」，而是怎么把「本地私密数据」包装成一个有明确边界的可分享制品。**它的工程难度，几乎全部来自「本机」和「公网」这条边界要划在哪、以及怎么保证东西不会越界。**

> 本文基于重构后的源码。和早期版本相比，仓库已经从一堆扁平的 `.mts` 拆成了 `cli / sources / core / renderers / shared / server / site` 七层，新增了 `search` 命令、把脱敏规则收敛成一张表、加入了 Claude 子代理嵌套，并把本地服务的安全逻辑单独抽成了 `local-security.ts`。下文都以当前源码为准。

## 2. 整体架构：一套 snapshot 核心，投射到三种入口

先看分层。重构后，真正干活的逻辑按职责落在几个目录里：`src/sources/` 读三类本地历史并归一，`src/core/` 放快照类型和隐私层，`src/renderers/` 负责 Markdown 与 transcript 渲染，`src/shared/` 是 HTML 净化等共享件，`src/server/` 同时托管本地 Viewer 和云端 Share API，`src/cli/` 是统一入口。

这套结构对外只暴露两层稳定对象——`summary` 和 `snapshot`，三种入口（终端、本地浏览器、云端分享）全都围绕它们展开：

<figure class="fz077" data-reveal role="group" aria-label="Codex Snapshots 总体架构：同一套快照核心，服务三种入口"><style>.fz077{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--soft:#f7f1e4;--grnl:#7c9c54;--cyn:#3f6d79;--cynb:#dcebed;--cyne:#8fbcc4;--amb:#9a6516;--ambb:#f4e8cc;--ambe:#d9b66a;--vio:#54579a;--viob:#e6e7f3;--vioe:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),var(--paper-deep,#ece5d5));color:var(--ink,#1a1815);margin:0;padding:clamp(18px,3vw,30px);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;box-sizing:border-box;line-height:1.5}.fz077 *{box-sizing:border-box}.fz077 .hd{margin-bottom:clamp(16px,2.4vw,24px)}.fz077 .ttl{font-weight:800;font-size:clamp(18px,2.6vw,27px);letter-spacing:.01em;margin:0}.fz077 .sub{font-size:clamp(12px,1.5vw,15px);color:var(--muted,#6a6155);margin:.5em 0 0}.fz077 .top{display:grid;grid-template-columns:1fr auto 1.15fr auto 1.15fr;gap:clamp(6px,1vw,12px);align-items:stretch}.fz077 .card{position:relative;background:var(--soft,#f7f1e4);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:12px;padding:clamp(12px,1.6vw,17px);display:flex;flex-direction:column;gap:.5em;min-width:0}.fz077 .card.cli{background:var(--viob,#e6e7f3);border-color:var(--vioe,#a9adcf)}.fz077 .card.src{background:var(--cynb,#dcebed);border-color:var(--cyne,#8fbcc4)}.fz077 .card.core{background:var(--ambb,#f4e8cc);border-color:var(--ambe,#d9b66a)}.fz077 .ct{font-weight:800;font-size:clamp(14px,1.8vw,19px)}.fz077 .ct .tag{display:inline-block;width:.6em;height:.6em;border-radius:50%;margin-right:.5em;vertical-align:middle;animation:fz077pulse 7s ease-in-out infinite}.fz077 .cli .tag{background:var(--vio,#54579a)}.fz077 .src .tag{background:var(--cyn,#3f6d79);animation-delay:.6s}.fz077 .core .tag{background:var(--amb,#9a6516);animation-delay:1.2s}.fz077 .mono{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.3vw,13px);font-weight:600}.fz077 .cli .mono{color:var(--vio,#54579a)}.fz077 .txt{font-size:clamp(12px,1.4vw,14.5px);color:var(--ink-soft,#3c362c)}.fz077 .src .flow{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.3vw,13px);font-weight:700;color:var(--cyn,#3f6d79);margin-top:auto;padding-top:.3em}.fz077 .core .txt{display:flex;align-items:center;gap:.5em}.fz077 .core .txt::before{content:"";width:.45em;height:.45em;border-radius:1px;background:var(--amb,#9a6516);opacity:.7;flex:none}.fz077 .harrow{align-self:center;display:flex;align-items:center;justify-content:center;min-width:22px}.fz077 .harrow .line{height:3px;width:100%;min-width:18px;background:var(--hair,rgba(26,24,21,.18));position:relative;overflow:hidden;border-radius:2px}.fz077 .harrow .line::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,var(--ink-soft,#3c362c),transparent);animation:fz077hflow 4.5s ease-in-out infinite}.fz077 .harrow.a2 .line::after{animation-delay:1.4s}.fz077 .harrow .head{width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid var(--ink,#1a1815);margin-left:1px;flex:none}.fz077 .mid{display:flex;justify-content:center;position:relative;height:clamp(40px,6vw,64px)}.fz077 .fan{position:relative;width:74%;max-width:560px;height:100%}.fz077 .stem{position:absolute;left:50%;top:0;width:3px;height:46%;transform:translateX(-50%);background:var(--ambe,#d9b66a);border-radius:2px;overflow:hidden}.fz077 .stem::after{content:"";position:absolute;left:0;top:-50%;width:100%;height:50%;background:linear-gradient(180deg,transparent,var(--amb,#9a6516));animation:fz077vflow 5s ease-in-out infinite}.fz077 .crossbar{position:absolute;left:8%;right:8%;top:46%;height:3px;background:var(--ambe,#d9b66a);border-radius:2px}.fz077 .drop{position:absolute;top:46%;width:3px;height:54%;background:var(--ambe,#d9b66a);border-radius:2px;overflow:hidden}.fz077 .drop::after{content:"";position:absolute;left:0;top:-60%;width:100%;height:60%;background:linear-gradient(180deg,transparent,var(--amb,#9a6516));animation:fz077vflow 5s ease-in-out infinite}.fz077 .drop.d1{left:8%}.fz077 .drop.d2{left:calc(50% - 1.5px);animation:none}.fz077 .drop.d2::after{animation-delay:.5s}.fz077 .drop.d3{right:8%;left:auto}.fz077 .drop.d3::after{animation-delay:1s}.fz077 .drop .head,.fz077 .stem .head{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--amb,#9a6516)}.fz077 .out{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(12px,2vw,22px)}.fz077 .out .card{background:#fff;border-color:var(--hair,rgba(26,24,21,.18))}.fz077 .out .exp .tag{background:var(--grnl,#7c9c54);animation-delay:0s}.fz077 .out .viewer .tag{background:var(--cyn,#3f6d79);animation-delay:.5s}.fz077 .out .share .tag{background:var(--amb,#9a6516);animation-delay:1s}.fz077 .out .exp{border-bottom:3px solid var(--grnl,#7c9c54)}.fz077 .out .viewer{border-bottom:3px solid var(--cyne,#8fbcc4)}.fz077 .out .share{border-bottom:3px solid var(--ambe,#d9b66a)}.fz077 .mono.url{color:var(--cyn,#3f6d79)}.fz077 .foot{margin-top:clamp(16px,2.4vw,24px);padding-top:clamp(10px,1.4vw,14px);border-top:1px solid var(--hair,rgba(26,24,21,.18));font-size:clamp(12px,1.5vw,15px);color:var(--muted,#6a6155)}.fz077 .foot b{color:var(--ink-soft,#3c362c);font-weight:700}@keyframes fz077pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.35);opacity:1}}@keyframes fz077hflow{0%{left:-40%}55%,100%{left:110%}}@keyframes fz077vflow{0%{top:-60%}55%,100%{top:110%}}@media(max-width:560px){.fz077 .top,.fz077 .out{grid-template-columns:1fr;gap:10px}.fz077 .harrow{transform:rotate(90deg);height:22px;margin:2px auto;min-width:0}.fz077 .mid{height:34px}.fz077 .fan{width:66%}}@media (prefers-reduced-motion:reduce){.fz077 .ct .tag{animation:none;opacity:1}.fz077 .harrow .line::after,.fz077 .stem::after,.fz077 .drop::after{animation:none;opacity:.5}}</style><div class="hd"><p class="ttl">总体架构：同一套快照核心，服务三种入口</p><p class="sub">终端命令、本地审阅台、云端只读分享都围绕 snapshot / turns 这层稳定结构展开。</p></div><div class="top"><div class="card cli"><div class="ct"><span class="tag"></span>CLI 入口</div><div class="mono">list / preview / export</div><div class="mono">serve / publish / daemon</div></div><div class="harrow a1"><div class="line"></div><div class="head"></div></div><div class="card src"><div class="ct"><span class="tag"></span>本地数据源</div><div class="txt">Codex JSONL</div><div class="txt">Claude transcript / history</div><div class="txt">Trae recorder / history</div><div class="flow">summary &#8594; snapshot</div></div><div class="harrow a2"><div class="line"></div><div class="head"></div></div><div class="card core"><div class="ct"><span class="tag"></span>Snapshot Core</div><div class="txt">统一 turns</div><div class="txt">风险检测与脱敏</div><div class="txt">Markdown 渲染</div><div class="txt">HTML 净化</div></div></div><div class="mid"><div class="fan"><div class="stem"></div><div class="crossbar"></div><div class="drop d1"><div class="head"></div></div><div class="drop d2"><div class="head"></div></div><div class="drop d3"><div class="head"></div></div></div></div><div class="out"><div class="card exp"><div class="ct"><span class="tag"></span>静态导出</div><div class="txt">HTML / Markdown</div><div class="txt">不可继续对话</div></div><div class="card viewer"><div class="ct"><span class="tag"></span>本地 Viewer</div><div class="mono url">127.0.0.1:4321</div><div class="txt">审阅、开关、导出、发布</div></div><div class="card share"><div class="ct"><span class="tag"></span>Share API</div><div class="txt">保存脱敏 payload</div><div class="txt">公网只读分享页</div></div></div><div class="foot">核心边界：<b>本机历史不直接上云</b>，云端只接收已脱敏且再次净化的只读快照。</div></figure>

本文分析的仓库是：

| 项 | 值 |
| --- | --- |
| 仓库路径 | `/Users/bytedance/Code/codex-snapshots` |
| 观察 commit | `85fc125`（Harden redaction and parsing across the snapshot pipeline） |
| npm 包名 | `codex-snapshots` |
| 当前版本 | `0.1.3` |

这篇不是 Codex 官方客户端源码解析，而是 `codex-snapshots` 这个独立工具的实现拆解。

## 3. 先把几个词讲清楚

这套工具里最核心的词有五个，后面会反复出现，先一次性说清，免得混。

| 词 | 含义 |
| --- | --- |
| `summary` | 列表页用的轻量摘要，含标题、来源、项目路径、更新时间、消息数、工具调用数和风险计数 |
| `snapshot` | 点开某条会话后才加载的完整只读快照，带统一的 `turns[]`、风险面板和（Claude 的）子代理 |
| `turn` | 归一后的消息单位，可以是用户消息、assistant 回复，或一条工具信息 |
| `risk` | 在**原文**里检测到的敏感模式，比如私钥、JWT、Bearer token、本机 home path、内部域名 |
| `share` | 已经脱敏、并发布到独立 Share API 的公网只读记录 |

这里的 `snapshot` 不是文件系统快照，也不是 Agent 运行时状态。它只是从本地历史里抽出一份 transcript，再渲染成一个**不能继续对话、不能执行命令**的审阅页面。把这个定义钉死，是整套设计的起点：先把分享对象定义成冻结的、只读的、可丢弃的东西，再决定哪些 UI 和 API 能围绕它存在。

## 4. 命令入口：一套 CLI 连接多种运行形态

入口是 `src/cli/codex-snapshot.mts`。它先解析参数，把命令分发到八条路径上：`list`、`search`、`preview`、`export`、`publish`、`serve`、`daemon`、`record-trae`。

```ts
if (parsed.command === "list")     return listSessions(...);   // 只扫轻量摘要，适合终端速览
if (parsed.command === "search")   return searchSessions(...); // 跨来源全文检索（重构后新增）
if (parsed.command === "preview")  return loadSnapshot(...);   // 加载完整快照，在终端输出文本预览
if (parsed.command === "export")   return exportSnapshot(...); // 把快照写成 HTML 或 Markdown 文件
if (parsed.command === "publish")  return publishSnapshot(...);// 把已脱敏快照发给 Share API（显式出网）
if (parsed.command === "serve")    return serveLocalViewer(...);// 启 127.0.0.1:4321 本地审阅台
if (parsed.command === "daemon")   return manageLaunchAgent(...);// 在 macOS 上装/管 LaunchAgent
if (parsed.command === "record-trae") return serveTraeRecorder(...); // Trae 特有的本地捕获入口
```

这层设计很朴素，但边界清楚：`list / search / preview / export` 是纯离线能力；`serve` 是本机只读审阅台；`publish` 是唯一会主动出网的动作；`daemon` 只是让本机 Viewer 在登录后常驻；`record-trae` 是补充采集。CLI 不是一个大杂烩，而是**把同一套 snapshot 核心，投射到终端、浏览器、本机后台三种使用方式上**。

启动后第一件事是把三类工具的 home 目录收敛出来，环境变量优先、否则取默认：

| 工具 | 环境变量 | 默认目录 |
| --- | --- | --- |
| Codex | `$CODEX_HOME` | `~/.codex` |
| Claude Code | `$CLAUDE_HOME` | `~/.claude` |
| Trae | `$TRAE_HOME` | `~/.trae-cn` |
| Trae 应用数据 | `$TRAE_APP_HOME` | `~/Library/Application Support/Trae CN` |
| Trae recorder | `$TRAE_RECORDINGS_DIR` | `~/.codex-snapshot/trae-recordings` |

这些目录是后面所有读取的根。注意它们全是「读」——CLI 从头到尾不写这些 home，只把它们当作只读数据源。

## 5. 数据源：先扫 summary，再按需加载 snapshot

真正复杂的地方在 `src/sources/local-history.mts`（约 3000 行）。Codex、Claude Code、Trae 的本地记录格式差异极大，如果让 UI 层直接兼容它们，页面会被各种特殊情况拖乱。所以这里先做一个中间层：**所有来源都先收敛成 `summary` 和 `snapshot` 两种对象**。

<figure class="fz078" data-reveal role="group" aria-label="数据源归一流程图：Codex、Claude Code、Trae 三类历史经 listSessions 并行扫描归一成 summary 与 snapshot 两种稳定对象"><style>.fz078{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:clamp(18px,3vw,30px);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;box-sizing:border-box;line-height:1.5}.fz078 *{box-sizing:border-box}.fz078 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz078 .ttl{font-size:clamp(17px,2.6vw,23px);font-weight:800;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz078 .sub{margin-top:6px;font-size:clamp(12px,1.7vw,14px);color:var(--muted,#6a6155);line-height:1.55}.fz078 .flow{display:grid;grid-template-columns:1fr auto 1.05fr auto 1fr;align-items:center;gap:clamp(6px,1.4vw,16px)}.fz078 .col{display:flex;flex-direction:column;gap:clamp(10px,1.8vw,16px)}.fz078 .node{border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:13px 15px;background:var(--paper-soft,#faf6ec);position:relative;overflow:hidden}.fz078 .node::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:currentColor;opacity:.85}.fz078 .src{animation:fz078pulse 8s ease-in-out infinite}.fz078 .src.s2{animation-delay:.5s}.fz078 .src.s3{animation-delay:1s}.fz078 .c-grn{color:#4f7233;background:#e7eedd}.fz078 .c-cyn{color:#3f6d79;background:#dcebed}.fz078 .c-amb{color:#9a6516;background:#f4e8cc}.fz078 .c-cnt{color:var(--ink-soft,#3c362c);background:#f7f1e4;border-color:rgba(26,24,21,.3);border-width:2px}.fz078 .c-out{color:#54579a;background:#e6e7f3}.fz078 .nt{font-size:clamp(14px,1.9vw,16px);font-weight:800;color:var(--ink,#1a1815);display:flex;align-items:center;gap:7px}.fz078 .dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:0 0 auto}.fz078 .nx{font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c);margin-top:6px;line-height:1.5}.fz078 .mono{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.35vw,12px);color:currentColor;margin-top:7px;padding:3px 7px;border-radius:5px;background:rgba(26,24,21,.05);display:inline-block;font-weight:600}.fz078 .core{padding:16px 16px;text-align:left}.fz078 .core .nt{font-size:clamp(15px,2vw,18px);justify-content:flex-start}.fz078 .core ul{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px}.fz078 .core li{font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c);padding-left:15px;position:relative}.fz078 .core li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;border-radius:50%;background:#54579a;opacity:.6}.fz078 .conn{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:clamp(14px,2.6vw,26px);min-width:34px}.fz078 .arr{position:relative;height:3px;border-radius:3px;background:var(--hair,rgba(26,24,21,.18));overflow:visible}.fz078 .arr::after{content:"";position:absolute;right:-2px;top:50%;transform:translateY(-50%);border-left:8px solid var(--ink-soft,#3c362c);border-top:5px solid transparent;border-bottom:5px solid transparent}.fz078 .arr .pkt{position:absolute;top:50%;left:0;width:18px;height:3px;transform:translateY(-50%);border-radius:3px;background:linear-gradient(90deg,transparent,#7c9c54,transparent);animation:fz078run 7s linear infinite}.fz078 .conn.right .pkt{background:linear-gradient(90deg,transparent,#a9adcf,transparent)}.fz078 .arr.a2 .pkt{animation-delay:1.1s}.fz078 .arr.a3 .pkt{animation-delay:2.2s}.fz078 .ft{margin-top:clamp(14px,2.4vw,20px);padding-top:13px;border-top:1px solid var(--hair,rgba(26,24,21,.18));font-size:clamp(11px,1.55vw,13px);color:var(--muted,#6a6155);line-height:1.55}.fz078 .ft b{color:var(--ink-soft,#3c362c);font-weight:700}@keyframes fz078run{0%{left:-8%;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:100%;opacity:0}}@keyframes fz078pulse{0%,100%{box-shadow:0 0 0 0 rgba(124,156,84,0)}50%{box-shadow:-3px 0 0 0 currentColor}}@media (max-width:560px){.fz078 .flow{grid-template-columns:1fr;gap:10px}.fz078 .conn{flex-direction:row;justify-content:center;min-width:0;gap:18px;padding:2px 0}.fz078 .arr{width:34px}.fz078 .arr::after{right:50%;top:auto;bottom:-6px;transform:translateX(50%) rotate(90deg)}.fz078 .arr .pkt{animation:fz078rundn 7s linear infinite}}@keyframes fz078rundn{0%{left:8px;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:8px;top:120%;opacity:0}}@media (prefers-reduced-motion:reduce){.fz078 .src,.fz078 .pkt{animation:none!important}.fz078 .src{box-shadow:-3px 0 0 0 currentColor}.fz078 .pkt{opacity:1;left:38%}}</style><div class="hd"><div class="ttl">数据源归一：列表扫摘要，详情再读完整内容</div><div class="sub">三类 Agent 的历史格式不同，但 UI 只消费 <b>summary</b> 和 <b>snapshot</b> 两种稳定对象。</div></div><div class="flow"><div class="col"><div class="node src c-grn"><div class="nt"><span class="dot"></span>Codex</div><div class="nx">sessions / archived_sessions</div><div class="mono">session_index.jsonl 补标题</div></div><div class="node src s2 c-cyn"><div class="nt"><span class="dot"></span>Claude Code</div><div class="nx">projects / sessions</div><div class="mono">history.jsonl 只作线索</div></div><div class="node src s3 c-amb"><div class="nt"><span class="dot"></span>Trae</div><div class="nx">recorder / memory / input</div><div class="mono">recorded 才默认完整</div></div></div><div class="conn"><div class="arr a1"><span class="pkt"></span></div><div class="arr a2"><span class="pkt"></span></div><div class="arr a3"><span class="pkt"></span></div></div><div class="node core c-cnt"><div class="nt"><span class="dot"></span>listSessions</div><ul><li>并行扫描</li><li>按 mtime 排序</li><li>completeOnly 过滤</li></ul><div class="mono">source = codex | claude | trae | all</div></div><div class="conn right"><div class="arr a1"><span class="pkt"></span></div><div class="arr a3"><span class="pkt"></span></div></div><div class="col"><div class="node c-out"><div class="nt"><span class="dot"></span>summary</div><div class="nx">标题、来源、项目路径</div><div class="nx">消息数、风险计数</div></div><div class="node c-out"><div class="nt"><span class="dot"></span>snapshot</div><div class="nx">点开后才完整加载</div><div class="nx">统一 turns 和风险面板</div></div></div></div><div class="ft"><b>列表快</b>，是因为只读摘要；<b>分享准</b>，是因为详情阶段再按来源加载完整 transcript。</div></figure>

`listSessions` 是列表页的统一入口。它支持按来源读，也支持 `source=all` 并行扫描——而且这里的并行用的是 `Promise.allSettled` 而不是 `Promise.all`：

```ts
if (source === "all") {
  // allSettled：某一个引擎的扫描挂了，也不会把另外两个引擎的会话一起清空
  const [codex, claude, trae] = (
    await Promise.allSettled([
      listCodexSessions({ codexHome, limit, cwd, includeArchived }),
      listClaudeSessions({ claudeHome, limit, cwd }),
      listTraeSessions({ traeHome, traeAppHome, traeRecordingsDir, limit, cwd }),
    ])
  ).map((r) => (r.status === "fulfilled" ? r.value : []));
  const sessions = [...codex, ...claude, ...trae]
    .filter((s) => !completeOnly || isCompleteSessionSummary(s)) // 过滤掉只有半截的会话
    .sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
  return Number.isFinite(limit) ? sessions.slice(0, limit) : sessions;
}
```

`allSettled` 这个选择看着不起眼，但它体现的是「观测要稳」：本机有没有装 Trae、`~/.claude` 的目录结构是不是当前版本、某个 JSONL 是不是刚好被写坏——这些都不该让整个列表变成空白。**一个数据源出错，最坏也只是少这一类会话，而不是整页空。**

这里还有一个关键取舍：列表页不急着解析完整 transcript。它对每个文件只读够用的前若干行（`MAX_SUMMARY_LINES = 140`），尽快拿到标题、路径、时间、消息数和风险计数；Codex 甚至会读 `session_index.jsonl` 给会话补上更友好的标题。不同来源对「什么算可分享的完整记录」也有各自的判定：

| 来源 | 读取的真实文件 | 默认认为可分享 |
| --- | --- | --- |
| Codex | `sessions/` 与 `archived_sessions/` 下的 `.jsonl` | JSONL 会话文件 |
| Claude Code | `projects/` 与 `sessions/` 下的 `.jsonl` | `sourceKind === "transcript"` 的完整 transcript |
| Claude history | `history.jsonl` | 只作 history-only 线索，不默认当完整会话 |
| Trae recorder | `~/.codex-snapshot/trae-recordings/*.jsonl` | recorder 捕获到的完整记录 |
| Trae memory / input | `memory/...`、`state.vscdb` | 只作补充线索 |

`completeOnly` 这个过滤看似只是 UI 细节，其实是在保护产品体验：用户打开工具时想看到的是「能分享的完整会话」，不是一堆只有用户输入、没有 assistant 回复的碎片。**先扫摘要所以列表快，详情阶段再按来源加载完整 transcript 所以分享准——快和准被拆到了两层。**

## 6. 快照构建：把不同历史格式统一成 turns

点开某条会话后，`loadSnapshot` 按 ref 前缀分发到对应加载器——这是三种格式分叉、又最终汇流的地方：

```ts
function splitSnapshotRef(ref) {
  if (ref.startsWith("claude:")) return { engine: "claude", ref: ref.slice(7) };
  if (ref.startsWith("trae:"))   return { engine: "trae",   ref: ref.slice(5) };
  if (ref.startsWith("codex:"))  return { engine: "codex",  ref: ref.slice(6) };
  return { engine: "codex", ref }; // 裸 id 默认按 Codex 处理
}
```

无论原始记录来自 Codex JSONL、Claude 的 message content，还是 Trae recorder 的 DOM / fetch / WebSocket 捕获，最后都要变成同一种消息数组 `turns[]`。这是整套实现里最重要的归一层：**渲染层、导出、Share API 全都只消费 `turns`，不用关心它从哪来。**

<figure class="fz079" data-reveal role="group" aria-label="快照构建流程图：从原始历史经过滤角色、标记风险、脱敏文本到渲染受限 HTML 的五步流水线，以及正文边界、风险面板与统一输出三块说明"><style>.fz079{--paper-soft:#faf6ec;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);margin:0;padding:clamp(16px,3.4vw,30px);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;box-shadow:0 1px 0 rgba(255,255,255,.5) inset;line-height:1.5}.fz079 .hd{margin:0 0 2px;font-size:clamp(18px,3vw,25px);font-weight:800;letter-spacing:.2px;color:var(--ink,#1a1815)}.fz079 .sub{margin:0 0 clamp(16px,2.6vw,24px);font-size:clamp(12px,1.7vw,14px);color:var(--muted,#6a6155)}.fz079 .flow{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px 6px;margin-bottom:clamp(18px,3vw,26px)}.fz079 .node{flex:1 1 130px;min-width:118px;position:relative;background:var(--paper-soft,#faf6ec);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:13px 12px 12px;display:flex;flex-direction:column;gap:5px;overflow:hidden;animation:fz079pulse 9s ease-in-out infinite}.fz079 .node::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ac,#917f5c);opacity:.85}.fz079 .node .k{font-size:13px;font-weight:800;color:var(--ink,#1a1815)}.fz079 .node .d{font-size:11px;color:var(--muted,#6a6155);line-height:1.35}.fz079 .node .m{margin-top:2px;font-family:var(--mono);font-size:10.5px;font-weight:700;color:var(--ac,#917f5c);background:var(--acb,#ece4d2);align-self:flex-start;padding:2px 7px;border-radius:5px}.fz079 .n1{--ac:#917f5c;--acb:#ece4d2;animation-delay:0s}.fz079 .n2{--ac:#3f6d79;--acb:#dcebed;border-color:#8fbcc4;animation-delay:1.6s}.fz079 .n3{--ac:#9a6516;--acb:#f4e8cc;border-color:#d9b66a;animation-delay:3.2s}.fz079 .n4{--ac:#4f7233;--acb:#e7eedd;border-color:#7c9c54;animation-delay:4.8s}.fz079 .n5{--ac:#7a6f5a;--acb:#e7e1d2;border-color:#cabf9f;animation-delay:6.4s}.fz079 .arr{flex:0 0 18px;align-self:center;display:flex;align-items:center;justify-content:center;position:relative}.fz079 .arr i{display:block;width:13px;height:2px;background:linear-gradient(90deg,var(--hair,rgba(26,24,21,.18)),var(--ink-soft,#3c362c));position:relative;border-radius:2px}.fz079 .arr i::after{content:"";position:absolute;right:-1px;top:50%;transform:translateY(-50%);border:4px solid transparent;border-left-color:var(--ink-soft,#3c362c)}.fz079 .arr i::before{content:"";position:absolute;left:0;top:0;height:100%;width:6px;border-radius:2px;background:#7c9c54;mix-blend-mode:multiply;animation:fz079run 7s linear infinite}.fz079 .a1 i::before{animation-delay:0s}.fz079 .a2 i::before{animation-delay:1.6s}.fz079 .a3 i::before{animation-delay:3.2s}.fz079 .a4 i::before{animation-delay:4.8s}.fz079 .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(8px,1.6vw,14px)}.fz079 .panel{background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:14px 13px;border-top:3px solid var(--pc,#917f5c)}.fz079 .panel .pk{font-size:13.5px;font-weight:800;margin-bottom:9px;color:var(--ink,#1a1815);display:flex;align-items:center;gap:7px}.fz079 .panel .pk::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--pc,#917f5c);flex:0 0 auto}.fz079 .panel ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}.fz079 .panel li{font-size:11.5px;color:var(--ink-soft,#3c362c);padding-left:13px;position:relative;line-height:1.4}.fz079 .panel li::before{content:"";position:absolute;left:0;top:.55em;width:5px;height:5px;border-radius:1px;background:var(--pc,#917f5c);opacity:.7}.fz079 .panel li .c{font-family:var(--mono);font-size:11px;color:var(--pc,#917f5c)}.fz079 .p1{--pc:#917f5c}.fz079 .p2{--pc:#9a6516;border-color:#d9b66a;background:linear-gradient(180deg,#f4e8cc55,var(--paper-soft,#faf6ec) 40%)}.fz079 .p3{--pc:#7a6f5a;border-color:#cabf9f}.fz079 .foot{margin:clamp(16px,2.6vw,22px) 0 0;font-size:clamp(11.5px,1.6vw,13px);color:var(--muted,#6a6155);font-style:italic;border-top:1px dashed var(--hair,rgba(26,24,21,.18));padding-top:12px}@keyframes fz079pulse{0%,100%{box-shadow:0 0 0 0 transparent}45%{box-shadow:0 2px 14px -6px var(--ac,#917f5c)}}@keyframes fz079run{0%{left:-6px;opacity:0}20%{opacity:.9}80%{opacity:.9}100%{left:13px;opacity:0}}@media(max-width:640px){.fz079 .grid{grid-template-columns:1fr}.fz079 .flow{flex-direction:column}.fz079 .node{flex:1 1 auto}.fz079 .arr{transform:rotate(90deg);height:14px;margin:-3px 0}}@media(prefers-reduced-motion:reduce){.fz079 .node,.fz079 .arr i::before{animation:none}.fz079 .arr i::before{opacity:0}}</style><p class="hd">快照构建：从原始历史到安全可读的 turns</p><p class="sub">先筛出可读正文，再在原文上标风险，最后渲染成受限 HTML。</p><div class="flow"><div class="node n1"><span class="k">读取原始行</span><span class="d">JSONL / history</span><span class="m">readJsonl()</span></div><span class="arr a1"><i></i></span><div class="node n2"><span class="k">过滤角色</span><span class="d">user / assistant</span><span class="m">skip bootstrap</span></div><span class="arr a2"><i></i></span><div class="node n3"><span class="k">标记风险</span><span class="d">基于原文检测</span><span class="m">addRisks()</span></div><span class="arr a3"><i></i></span><div class="node n4"><span class="k">脱敏文本</span><span class="d">token / path</span><span class="m">redactText()</span></div><span class="arr a4"><i></i></span><div class="node n5"><span class="k">渲染 HTML</span><span class="d">Markdown + 高亮</span><span class="m">sanitize-html</span></div></div><div class="grid"><div class="panel p1"><div class="pk">默认正文边界</div><ul><li>隐藏 <span class="c">system / developer</span></li><li>隐藏工具调用和工具输出</li></ul></div><div class="panel p2"><div class="pk">风险面板</div><ul><li>私钥、JWT、Bearer、API key</li><li>本机 home path、内部域名</li></ul></div><div class="panel p3"><div class="pk">统一输出</div><ul><li><span class="c">snapshot.turns[]</span></li><li>HTML / Markdown / Share API 共用</li></ul></div></div><p class="foot">风险检测先于脱敏，渲染后还要净化：每层都假设上一层可能漏掉东西。</p></figure>

以 Codex 的过滤链路为例，裁剪后大概长这样——每一步都在「往安全的方向收」：

```ts
for await (const row of readJsonl(filePath)) {       // 逐行读，避免一次吃下大文件
  if (row.type !== "response_item") continue;        // 只看 Codex 的 response_item
  const item = row.payload;
  if (item.type !== "message") continue;             // 本段只展示自然语言消息路径
  if (!["user", "assistant"].includes(item.role)) continue; // 默认跳过 system / developer
  const message = extractMessageParts(item);
  if (isBootstrapUserMessage(item.role, message.text)) continue; // 跳过启动时注入的环境上下文
  const rawText = stripAppDirectives(message.text);  // 去掉 App 的内部指令行
  addRisks(risks, rawText, turnNumber + 1);          // ★ 在原文上做风险检测
  const text = redact ? redactText(rawText) : rawText;// ★ 再按开关决定是否脱敏
  turns.push({ role: item.role, text, html: renderMarkdownHtml(text) });
}
```

这段代码里藏着几个默认安全姿势，注意那两行加 ★ 的顺序：**风险检测一定在脱敏之前、基于原文做。** 反过来就坏了——如果先脱敏再检测，风险面板看到的全是 `[REDACTED]`，根本认不出「这条里原来有个私钥」。检测要看真东西，展示要给脱敏后的东西，两者必须分开取数。

工具调用是另一路：只有显式打开 `includeTools` 才展示工具信息，只有打开 `includeToolOutput` 才展示工具输出。默认把工具输出藏起来不是偷懒，而是因为 stdout / stderr 里经常有本机路径、内部域名、配置片段和临时 token——它是泄漏密度最高的地方。

### 6.1 Claude 子代理：嵌在父会话里，而不是冒成一堆独立会话

重构后最显眼的新能力，是处理 Claude Code 的 Task / 子代理。Claude 把子代理的 transcript 存在父会话目录的 `subagents/` 子目录里（`<parentSessionId>/subagents/**/agent-*.jsonl`），每个还配一份 `.meta.json` 记着它是被哪个 `tool_use` 触发的。如果不管它们，这些 `agent-*.jsonl` 会被当成一条条独立会话冒到列表里，把列表搅成一锅碎片。

这里分两步堵：列表扫描时，先把一批「不是会话本体」的目录整体排除掉——

```ts
const CLAUDE_ARTIFACT_DIR_NAMES = new Set(["subagents", "workflows", "tool-results", "memory"]);
```

详情加载时，再把这些子代理**嵌到父会话内部**作为 `snapshot.subagents[]`：

```ts
async function loadClaudeSubagents(parentFilePath, parentSessionId, opts) {
  if (!parentSessionId) return [];
  const root = path.join(path.dirname(parentFilePath), parentSessionId, "subagents");
  const files = [];
  await collectJsonlFiles(root, files, {
    skipFile: (name) => !/^agent-[0-9a-f]+\.jsonl$/i.test(name), // 只认 agent-*.jsonl
  });
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);             // 按时间稳定排序
  const subagents = [];
  for (const fileInfo of files) {
    // 旁边的 .meta.json 提供 toolUseId / agentType / description，建立回父会话的链接
    const meta = JSON.parse(await readFile(fileInfo.filePath.replace(/\.jsonl$/, ".meta.json"), "utf8"));
    const { turns } = await buildClaudeTurns(fileInfo.filePath, opts);
    if (!turns.length) continue;
    const rawDescription = String(meta.description || "").trim() || firstUserText(turns);
    subagents.push({
      toolUseId: String(meta.toolUseId || ""),
      description: opts.redact ? redactText(rawDescription) : rawDescription, // 连描述都走脱敏
      turns,
      // …order / agentType / messageCount / toolCallCount
    });
  }
  return subagents;
}
```

这件事的价值在于**把「一次任务的真实结构」如实还原出来**：父会话里的某个工具调用，对应到下面一段完整的子代理 transcript，而不是把它们打散成同级的几十条独立会话。注意连子代理的 `description` 都过了一遍 `redactText`——脱敏不挑「正文」还是「元数据」，凡是要展示给人看的字符串都得过。

### 6.2 Trae recorder：把流式捕获重组回一条 transcript

Trae 这一路最特殊。recorder 捕获的是 DOM 消息、fetch response chunk、WebSocket message、EventSource message 这些**底层事件**，源码里用 `domThreadId / captureSessionId / actualSessionId / pageSession` 这一串 key 把同一个会话的事件归一组，再把流式 delta 拼回完整消息。也就是说，它不是「看到一行就变一条消息」，而是在尽量还原聊天产品里那份最终 transcript——一个 `.jsonl` 文件里可能并存多组会话，各自重组成各自的 summary。

## 7. 隐私模型：一张表同时驱动「检测」和「脱敏」

`src/core/privacy.ts` 是这套工具的安全底座，也是重构里改动最值得讲的一块。

老实现里，「检测风险」和「执行脱敏」是两套独立逻辑，于是会出现一种很隐蔽的 bug：某个模式被风险面板**标了红**，但脱敏那边漏写了对应替换，结果这条敏感值**照样原样发出去**。重构后的做法，是把两件事收敛到同一张规则表 `REDACTION_RULES` 上——每条规则自带 `pattern`（怎么找）、`replacement`（怎么换）、`detectOnly`（只标不换）：

```ts
// 同一张表同时驱动检测(detectRisks)和脱敏(redactText)，
// 两条代码路径共用一份规则，杜绝了过去那种「标了红却仍原样发出」的 detect/redact 漂移。
type RedactionRule = {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  pattern: RegExp;
  replacement?: string | ((...args: string[]) => string);
  detectOnly?: boolean; // 比如「提到 .env」值得标记，但它本身不是密钥，不替换
};
```

`redactText` 就是顺着这张表走一遍，跳过 `detectOnly` 的规则：

```ts
export function redactText(text: string): string {
  let output = String(text ?? "");
  for (const rule of REDACTION_RULES) {
    if (rule.detectOnly || rule.replacement === undefined) continue;
    output = output.replace(rule.pattern, rule.replacement as string);
  }
  return output;
}
```

**少了「单一数据源」这一步会怎样**：检测和脱敏一旦是两份清单，任何一次「新增一类密钥」的改动都要改两处，漏改一处就直接漏密。把它收成一张表，是用「结构」来消灭这一整类 bug，而不是靠每次提醒自己「记得两边都改」。

这张表还有一条贯穿始终的设计原则，源码注释写得很直白：**脱敏故意偏向「宁可多删」**——误杀只是多遮了一段无关文字，漏网却是泄一个密钥。所以赋值型规则会把整行的值一路抹到行尾，而不是抹到第一个空格 / 引号就停手。表里覆盖的高危模式（节选）：

| 风险 | 命中的东西 | 替换为 |
| --- | --- | --- |
| 私钥块 | `-----BEGIN ... PRIVATE KEY-----`（**容忍缺失 END 标记**，截断粘贴也抹到 EOF） | `[REDACTED_PRIVATE_KEY]` |
| JWT | 三段式 `eyJ...` | `[REDACTED_JWT]` |
| GitHub token | `ghp_/gho_/...` 与新增的 `github_pat_...` | `[REDACTED_GITHUB_TOKEN]` |
| Slack / Google key | `xox[baprs]-...`、`AIza...` | 对应占位符 |
| Bearer / OpenAI key | `Bearer ...`、`sk-...` | `Bearer [REDACTED]`、`sk-[REDACTED]` |
| AWS access key | `AKIA...` 等前缀 | `[REDACTED_AWS_KEY]` |
| 连接串凭据 | `postgres/mysql/mongodb+srv/redis/...://user:pass@host` | 只抹掉账号密码，保留 URL 结构 |
| 赋值型密钥 | `password/secret/token/api_key/cookie/authorization...` 加 `: ` 或 `=` | 把整行值抹到行尾 |
| 本机 / 跨机 home path | 当前用户 home，以及 `/home/<user>`、`C:\Users\<user>` | `~`、`[REDACTED_USER]` |
| 内部域名 | `*.bytedance/corp/internal/local` | `[REDACTED_INTERNAL_HOST]` |
| `.env` 提及 | `.env` / `.env.local`（`detectOnly`，只标不换） | —— |

赋值型规则那条尤其见功夫：它用一个有界量词的 `SECRET_KEY`（`{0,64}` 包住关键字两侧）来匹配 `db_password`、`client_secret`、`aws_secret_access_key` 这种带前后缀的形式，既能命中 `_` 连接的标识符，又避免了无界 `*` 在长串上回溯爆炸（ReDoS）。**这些都是「在别人写的乱七八糟文本里找密钥」的脏活，魔鬼全在这类边界里。**

隐私层之上还压着第三层：HTML 净化。Markdown 用 `markdown-it` 渲染（`html: false`，不放行原始 HTML），再用 `sanitize-html` 收紧到一份白名单——只许有限的标签、属性、`class`（连 `hljs-*`、`language-*` 都按正则白名单放行），协议只留 `http/https/mailto`，所有链接被强制加上 `target="_blank"` 和 `rel="noopener noreferrer"`，`javascript:` 这类危险协议进不了最终 HTML。

```ts
transformTags: {
  a: (_t, attribs) => ({
    tagName: "a",
    attribs: { ...attribs, rel: mergeLinkRel(attribs.rel), target: "_blank" },
  }),
}
```

三层叠起来，核心原则是一句话：**脱敏不是只在一个地方做一次。** 本地加载时脱敏、渲染后净化、准备云端 payload 时删路径、Share API 收到后再归一再净化——每一层都假设上一层可能漏掉东西。

## 8. 本地 Viewer：浏览器只访问本机回环服务

`serve` 启动的本地 Viewer 默认地址是 `http://127.0.0.1:4321/`。这个 Viewer 不是「静态页直接读文件」——浏览器没有权限去扫 `~/.codex`，也不应该有。真正读文件的是 Node HTTP 服务，页面只通过 API 拿 summary 和 snapshot。

<figure class="fz080" data-reveal role="group" aria-label="本地 Viewer 安全边界：浏览器只访问回环服务，Node 服务读文件，写动作受来源与 token 保护"><style>.fz080{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--grn:#4f7233;--grn-bg:#e7eedd;--grn-br:#7c9c54;--cyn:#3f6d79;--cyn-bg:#dcebed;--cyn-br:#8fbcc4;--amb:#9a6516;--amb-bg:#f4e8cc;--amb-br:#d9b66a;--red:#8f2d20;--red-bg:#f1ddd6;--red-br:#cf9b90;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(180deg,var(--paper-soft,#faf6ec),#f7f1e4);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3.5vw,30px);margin:0;max-width:980px;box-sizing:border-box}.fz080 *{box-sizing:border-box}.fz080 .hd{margin-bottom:18px}.fz080 .ttl{font-size:clamp(17px,2.7vw,23px);font-weight:800;letter-spacing:.2px;line-height:1.35;color:var(--ink)}.fz080 .sub{margin-top:6px;font-size:clamp(12px,1.7vw,14.5px);color:var(--muted,#6a6155);line-height:1.5}.fz080 .grid{display:grid;grid-template-columns:1fr auto 1.1fr;gap:clamp(12px,2.2vw,22px);align-items:stretch}.fz080 .mid{display:flex;align-items:center}.fz080 .rcol{display:flex;flex-direction:column;gap:clamp(12px,2vw,16px);justify-content:center}.fz080 .node{position:relative;border-radius:12px;padding:14px 15px;border:1.5px solid var(--hair);background:var(--paper-soft,#faf6ec);box-shadow:0 1px 0 rgba(26,24,21,.04)}.fz080 .n-ui{border-color:var(--cyn-br,#8fbcc4);background:var(--cyn-bg,#dcebed)}.fz080 .n-node{border-color:var(--ink);background:#fff}.fz080 .n-file{border-color:var(--grn-br,#7c9c54);background:var(--grn-bg,#e7eedd)}.fz080 .n-guard{border-color:var(--amb-br,#d9b66a);background:var(--amb-bg,#f4e8cc)}.fz080 .bt{font-size:clamp(14px,2vw,17px);font-weight:800;color:var(--ink);line-height:1.25}.fz080 .bx{margin-top:7px;font-size:clamp(11.5px,1.5vw,13.5px);color:var(--ink-soft,#3c362c);line-height:1.5}.fz080 .bx b{font-weight:600}.fz080 .mono{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.4vw,12.5px);font-weight:600;color:var(--cyn,#3f6d79);background:rgba(63,109,121,.08);padding:1px 5px;border-radius:4px;display:inline-block;margin-top:7px}.fz080 .n-node .mono{color:var(--ink-soft);background:rgba(26,24,21,.06)}.fz080 .row{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft)}.fz080 .dot{width:6px;height:6px;border-radius:50%;flex:none}.fz080 .n-file .dot{background:var(--grn,#4f7233)}.fz080 .n-guard .dot{background:var(--amb,#9a6516)}.fz080 .conn{position:relative;min-width:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.fz080 .arr{position:relative;height:3px;width:100%;min-width:48px;border-radius:2px;background:linear-gradient(90deg,var(--hair),var(--hair));overflow:visible}.fz080 .arr::before{content:"";position:absolute;inset:0;border-radius:2px;background:linear-gradient(90deg,transparent,var(--cyn,#3f6d79),transparent);background-size:55% 100%;background-repeat:no-repeat;animation:fz080flow 7s ease-in-out infinite}.fz080 .arr::after{content:"";position:absolute;right:-2px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid var(--ink-soft,#3c362c)}.fz080 .lbl{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,12px);font-weight:700;color:var(--cyn,#3f6d79);white-space:nowrap}.fz080 .vlink{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 0}.fz080 .vlbl{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,12px);font-weight:700;white-space:nowrap;margin-bottom:4px}.fz080 .varr{position:relative;width:3px;height:30px;border-radius:2px;background:var(--hair);overflow:visible}.fz080 .varr::before{content:"";position:absolute;inset:0;border-radius:2px;background:linear-gradient(180deg,transparent,currentColor,transparent);background-size:100% 55%;background-repeat:no-repeat;animation:fz080flowv 7s ease-in-out infinite}.fz080 .varr::after{content:"";position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid currentColor}.fz080 .v-read{color:var(--grn,#4f7233)}.fz080 .v-read .varr::before{animation-delay:.3s}.fz080 .v-write{color:var(--amb,#9a6516)}.fz080 .v-write .varr::before{animation-delay:1.4s}.fz080 .ban{margin-top:18px;display:flex;align-items:center;gap:10px;border:1.5px dashed var(--red-br,#cf9b90);background:var(--red-bg,#f1ddd6);border-radius:10px;padding:10px 14px}.fz080 .ban .x{position:relative;width:18px;height:18px;flex:none;animation:fz080pulse 7s ease-in-out infinite}.fz080 .ban .x::before,.fz080 .ban .x::after{content:"";position:absolute;left:50%;top:50%;width:18px;height:2.4px;border-radius:2px;background:var(--red,#8f2d20)}.fz080 .ban .x::before{transform:translate(-50%,-50%) rotate(45deg)}.fz080 .ban .x::after{transform:translate(-50%,-50%) rotate(-45deg)}.fz080 .ban .t{font-size:clamp(12px,1.7vw,15px);font-weight:700;color:var(--red,#8f2d20);line-height:1.4}.fz080 .ft{margin-top:14px;padding-top:12px;border-top:1px solid var(--hair);font-size:clamp(11.5px,1.6vw,13.5px);color:var(--muted,#6a6155);line-height:1.55}@keyframes fz080flow{0%{background-position:-60% 0}45%,100%{background-position:160% 0}}@keyframes fz080flowv{0%{background-position:0 -60%}45%,100%{background-position:0 160%}}@keyframes fz080pulse{0%,100%{opacity:.55}50%{opacity:1}}@media(max-width:560px){.fz080 .grid{grid-template-columns:1fr}.fz080 .mid{justify-content:center}.fz080 .conn{flex-direction:column;min-width:0;padding:4px 0}.fz080 .arr{width:3px;height:30px;min-width:0}.fz080 .arr::before{background:linear-gradient(180deg,transparent,var(--cyn,#3f6d79),transparent);background-size:100% 55%;background-repeat:no-repeat;animation:fz080flowv 7s ease-in-out infinite}.fz080 .arr::after{right:50%;top:auto;bottom:-2px;transform:translateX(50%);border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:0;border-top:9px solid var(--ink-soft)}.fz080 .rcol{flex-direction:column}}@media (prefers-reduced-motion:reduce){.fz080 .arr::before,.fz080 .varr::before,.fz080 .ban .x{animation:none}.fz080 .arr::before,.fz080 .varr::before{opacity:.9}.fz080 .ban .x{opacity:1}}</style><div class="hd"><div class="ttl">本地 Viewer：浏览器不直接读文件，只访问回环服务</div><div class="sub">Node 服务负责扫描本机历史；页面只通过受控 API 审阅和导出。</div></div><div class="grid"><div class="mid"><div class="node n-ui"><div class="bt">浏览器 UI</div><div class="bx"><b>搜索、切换来源</b></div><div class="bx"><b>工具 / 输出 / 脱敏开关</b></div><div class="mono">GET API only by default</div></div></div><div class="conn"><div class="lbl">fetch</div><div class="arr"></div></div><div class="rcol"><div class="node n-node"><div class="bt">本地 Node 服务</div><div class="mono">127.0.0.1:4321</div><div class="bx">/api/sessions</div><div class="bx">/api/snapshot</div><div class="bx">/export / publish</div></div><div class="vlink"><div class="vlbl v-read mono" style="background:none;color:var(--grn);padding:0">Node 读文件</div><div class="v-read"><div class="varr"></div></div></div><div class="node n-file"><div class="bt">本机历史文件</div><div class="row"><span class="dot"></span><span>~/.codex</span></div><div class="row"><span class="dot"></span><span>~/.claude</span></div><div class="row"><span class="dot"></span><span>~/.trae-cn</span></div></div><div class="vlink"><div class="vlbl v-write mono" style="background:none;color:var(--amb);padding:0">POST mutation</div><div class="v-write"><div class="varr"></div></div></div><div class="node n-guard"><div class="bt">写动作保护</div><div class="row"><span class="dot"></span><span>Origin 白名单</span></div><div class="row"><span class="dot"></span><span>CSRF token</span></div><div class="row"><span class="dot"></span><span>发布必须脱敏</span></div></div></div></div><div class="ban"><span class="x"></span><span class="t">浏览器不能直接扫描本机历史目录</span></div><div class="ft">本地常驻服务的安全关键：只监听回环地址，读写分开，写动作必须有来源和 token。</div></figure>

主要路由分得很干净：读是 GET，写是 POST：

| 路由 | 方法 | 作用 |
| --- | --- | --- |
| `/` | GET | 返回本地审阅台 HTML |
| `/api/sessions` | GET | 会话摘要列表 |
| `/api/search` | GET | 跨来源全文检索 |
| `/api/snapshot` | GET | 某条完整快照（带 `redact` / `includeTools` 等开关） |
| `/api/publish` / `/api/publish-all` | POST | 发布到 Share API（强制脱敏） |
| `/api/share-payload` | POST | 只生成将要发布的 payload，方便先检查 |
| `/export?...&format=html\|md` | GET | 导出 HTML / Markdown |

重构把所有「本地服务的来源与写动作防护」单独抽成了 `src/server/local-security.ts`——这是一处值得单独看的硬化。它做三件事：CORS 只对回环白名单放行；任何会产生写动作的请求，必须同时带上**允许的 `Origin`** 和一枚 **CSRF token**；token 用 32 字节随机数，每次启动服务时新生成一枚：

```ts
export const MUTATION_CSRF_HEADER = "x-codex-snapshot-csrf";
export function createMutationCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function allowMutationRequest(request, response, csrfToken): boolean {
  if (request.method !== "POST") { sendJson(response, { error: "method not allowed" }, 405); return false; }
  const origin = String(request.headers.origin || "");
  if (!origin)                       { /* 403：本地写动作必须带 Origin */ return false; }
  if (!isAllowedSnapshotOrigin(origin)) { /* 403：来源不在回环白名单 */ return false; }
  const token = String(request.headers[MUTATION_CSRF_HEADER] || "");
  if (!token || token !== csrfToken) { /* 403：CSRF token 不对 */ return false; }
  return true;
}
```

**为什么一个只监听 `127.0.0.1` 的服务还要防 CSRF？** 因为「只监听本机」挡的是「别的机器连进来」，挡不住「你自己浏览器里某个恶意网页，向 `127.0.0.1:4321` 发一个跨站 POST」。那个网页拿不到本次启动随机生成的 token，也给不出合法 `Origin`，于是发布动作被挡在门外。这就是为什么读接口只校验来源、写接口还要再加一道 token——**读出去顶多看到本机数据，写出去（发布）却会把数据推上公网，两者的风险根本不在一个量级。**

发布路径上还钉死了一条：`/api/publish` 系列在加载快照时强制 `redact: true`，客户端要是带着 `redact=0` 来发布，直接被拒。**云端发布这件事，在本地这一关就已经不允许「不脱敏」存在。**

## 9. 云端分享：只让脱敏快照离开本机，而且服务端再验一遍

云端能力由 `src/server/share-api.mts` 提供。它可以本地跑，也可以部署到公网。它的职责**不是重新读用户电脑**，而是只接收已经由本地 Viewer 或 CLI 生成的 snapshot payload，再做认证、净化、存储、只读分发。

<figure class="fz081" data-reveal role="group" aria-label="云端分享链路示意图：本地发布经 Payload Gate、Share API 写入 Share Store，再由公开列表、分享详情、删除权限三个只读接口对外分发"><style>.fz081{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--p:#54579a;--pb:#e6e7f3;--pe:#a9adcf;background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3vw,30px);margin:0;box-sizing:border-box;line-height:1.5}.fz081 *{box-sizing:border-box}.fz081 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz081 .h1{font-weight:800;font-size:clamp(17px,2.5vw,23px);letter-spacing:.2px;color:var(--ink,#1a1815)}.fz081 .h2{margin-top:6px;font-size:clamp(12px,1.6vw,14px);color:var(--muted,#6a6155)}.fz081 .row{display:flex;align-items:stretch;gap:clamp(6px,1.4vw,14px);flex-wrap:nowrap}.fz081 .node{flex:1 1 0;min-width:0;background:var(--paper-soft,#faf6ec);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:clamp(10px,1.6vw,15px);position:relative;overflow:hidden}.fz081 .node .bt{font-weight:800;font-size:clamp(13px,1.9vw,17px);color:var(--ink,#1a1815);margin-bottom:7px}.fz081 .node .bx{font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c);margin-top:3px}.fz081 .node .mono{display:inline-block;margin-top:7px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,12px);color:var(--c,#3f6d79);background:var(--cb,#dcebed);border:1px solid var(--ce,#8fbcc4);border-radius:5px;padding:2px 6px;word-break:break-all}.fz081 .node::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--bar,var(--ce,#8fbcc4))}.fz081 .n-loc{background:var(--cb,#dcebed)}.fz081 .n-loc{--bar:var(--c,#3f6d79)}.fz081 .n-gate{background:var(--ab,#f4e8cc)}.fz081 .n-gate{--bar:var(--ae,#d9b66a)}.fz081 .n-gate .bx{color:var(--a,#9a6516)}.fz081 .n-api{background:var(--gb,#e7eedd)}.fz081 .n-api{--bar:var(--gl,#7c9c54)}.fz081 .n-api .bx{color:var(--g,#4f7233)}.fz081 .n-store{background:var(--paper-deep,#ece5d5)}.fz081 .n-store{--bar:var(--muted,#6a6155)}.fz081 .arr{flex:0 0 auto;align-self:center;display:flex;align-items:center;color:var(--muted,#6a6155)}.fz081 .arr .track{position:relative;width:clamp(16px,3vw,34px);height:3px;background:var(--hair,rgba(26,24,21,.18));border-radius:2px;overflow:hidden}.fz081 .arr .track::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,var(--g,#4f7233),transparent);animation:fz081flow 3.2s linear infinite}.fz081 .arr .track:nth-child(1)::after{animation-delay:0s}.fz081 .arr .tip{width:0;height:0;border-left:7px solid var(--ink-soft,#3c362c);border-top:5px solid transparent;border-bottom:5px solid transparent;margin-left:1px}.fz081 .mid{display:flex;align-items:center;gap:10px;margin:clamp(14px,2.4vw,22px) 0 clamp(12px,2vw,18px);color:var(--muted,#6a6155);font-size:clamp(11px,1.5vw,13px)}.fz081 .mid .lab{flex:0 0 auto;font-weight:700;color:var(--g,#4f7233)}.fz081 .mid .fan{flex:1 1 auto;height:18px;position:relative}.fz081 .mid .fan span{position:absolute;top:0;left:0;width:6px;height:6px;border-radius:50%;background:var(--g,#4f7233);animation:fz081fan 4.5s ease-in-out infinite}.fz081 .mid .fan span:nth-child(1){animation-delay:0s;--tx:22%}.fz081 .mid .fan span:nth-child(2){animation-delay:1.5s;--tx:52%}.fz081 .mid .fan span:nth-child(3){animation-delay:3s;--tx:82%}.fz081 .read .node{background:var(--paper-soft,#faf6ec)}.fz081 .read .n-list{--bar:var(--gl,#7c9c54)}.fz081 .read .n-det{--bar:var(--ce,#8fbcc4)}.fz081 .read .n-del{--bar:var(--ae,#d9b66a)}.fz081 .read .n-del .mono{color:var(--a,#9a6516);background:var(--ab,#f4e8cc);border-color:var(--ae,#d9b66a)}.fz081 .ft{margin-top:clamp(14px,2.4vw,22px);padding-top:clamp(10px,1.6vw,14px);border-top:1px dashed var(--hair,rgba(26,24,21,.18));font-size:clamp(11px,1.5vw,13px);color:var(--muted,#6a6155)}@keyframes fz081flow{0%{left:-40%}100%{left:100%}}@keyframes fz081fan{0%,100%{transform:translateX(0);opacity:0}10%{opacity:1}50%{transform:translateX(var(--tx,50%)) translateY(11px);opacity:1}60%,100%{transform:translateX(var(--tx,50%)) translateY(11px);opacity:0}}.fz081 .node{animation:fz081pulse 8s ease-in-out infinite}.fz081 .n-loc{animation-delay:0s}.fz081 .n-gate{animation-delay:.7s}.fz081 .n-api{animation-delay:1.4s}.fz081 .n-store{animation-delay:2.1s}@keyframes fz081pulse{0%,86%,100%{box-shadow:0 0 0 0 rgba(124,156,84,0)}8%{box-shadow:0 0 0 3px rgba(124,156,84,.18)}16%{box-shadow:0 0 0 0 rgba(124,156,84,0)}}@media(max-width:560px){.fz081 .row{flex-wrap:wrap}.fz081 .node{flex:1 1 100%}.fz081 .arr{transform:rotate(90deg);align-self:center;margin:1px auto}.fz081 .read .node{flex:1 1 100%}}@media (prefers-reduced-motion:reduce){.fz081 .arr .track::after,.fz081 .mid .fan span,.fz081 .node{animation:none}.fz081 .arr .track::after{left:30%;opacity:.6}.fz081 .mid .fan span{opacity:1;top:6px}.fz081 .mid .fan span:nth-child(1){left:22%}.fz081 .mid .fan span:nth-child(2){left:52%}.fz081 .mid .fan span:nth-child(3){left:82%}}</style><div class="hd"><div class="h1">云端分享：Share API 只保存已脱敏的只读 payload</div><div class="h2">公网服务不读取用户电脑，只负责认证、净化、存储和只读分发。</div></div><div class="row"><div class="node n-loc"><div class="bt">本地发布</div><div class="bx">Viewer / CLI</div><div class="mono">redact = true</div></div><div class="arr"><div class="track"></div><div class="tip"></div></div><div class="node n-gate"><div class="bt">Payload Gate</div><div class="bx">删除 cwd / filePath</div><div class="bx">拒绝未脱敏</div></div><div class="arr"><div class="track"></div><div class="tip"></div></div><div class="node n-api"><div class="bt">Share API</div><div class="bx">token 或 GitHub OAuth</div><div class="bx">再次 sanitize HTML</div></div><div class="arr"><div class="track"></div><div class="tip"></div></div><div class="node n-store"><div class="bt">Share Store</div><div class="bx">shares.json</div><div class="bx">串行写入 + rename</div></div></div><div class="mid"><span class="lab">Share Store 只读分发</span><span class="fan"><span></span><span></span><span></span></span></div><div class="row read"><div class="node n-list"><div class="bt">公开列表</div><div class="bx">只返回摘要</div><div class="mono">GET /api/snapshots</div></div><div class="node n-det"><div class="bt">分享详情</div><div class="bx">返回只读 snapshot</div><div class="mono">GET /api/snapshots/:id</div></div><div class="node n-del"><div class="bt">删除权限</div><div class="bx">站长或发布者</div><div class="mono">DELETE /api/snapshots/:id</div></div></div><div class="ft">云端边界：认证决定谁能写，payload 规则决定写进去的东西是否仍是安全的只读快照。</div></figure>

发布接口的约束很直接，而且这里有一道老版本没有的「服务端二次校验」：

```ts
const auth = requirePublishAuth(request);                          // 先确认发布身份
const snapshot = normalizeSnapshotPayloadForShare(body.snapshot);  // 归一并剥掉本地私有字段

// 第一道：默认拒绝「自称未脱敏」的快照
if (!snapshot.redacted && process.env.SNAPSHOT_SHARE_ALLOW_UNREDACTED !== "true") {
  return sendJson(response, 400, { error: "Refusing to publish an unredacted snapshot." });
}

// 第二道：就算它自称 redacted=true，服务端也再扫一遍，发现高危就拒
if (snapshot.redacted && process.env.SNAPSHOT_SHARE_VERIFY_REDACTION !== "false") {
  const leaked = highRiskCategoriesInShare(snapshot.payload);
  if (leaked.length) {
    return sendJson(response, 422, {
      error: "redaction verification still found high-risk secrets in the snapshot.",
      categories: leaked,
    });
  }
}
```

`highRiskCategoriesInShare` 会把 payload 里**每个 turn、标题、以及每个子代理的 turns** 都重新跑一遍 `detectRisks`，只要还命中 high 级别的密钥，就回 `422` 并列出泄漏类别：

```ts
function highRiskCategoriesInShare(payload) {
  const labels = new Set();
  const visit = (turns) => {
    for (const turn of turns ?? []) {
      for (const risk of detectRisks(turn?.text ?? "")) {
        if (risk.severity === "high") labels.add(risk.label);
      }
    }
  };
  visit(payload?.turns);
  for (const risk of detectRisks(payload?.title ?? "")) {
    if (risk.severity === "high") labels.add(risk.label);
  }
  for (const sub of payload?.subagents ?? []) visit(sub?.turns); // 子代理也不放过
  return [...labels];
}
```

**这就是「不信任上一层」的工程姿态。** 客户端可能改过、可能有 bug、可能被人手动绕过 `redact` 开关——服务端不假设它一定干净，而是用同一套 `detectRisks` 规则（注意：和本地是**同一份** `src/core/privacy.ts`）再独立验一次。第 7 节那张「单一规则表」在这里第二次发挥价值：本地和云端共用一份规则，才谈得上「服务端复检」是有意义的。

剩下的就比较常规了。`normalizeSnapshotPayloadForShare` 会递归删掉 `cwd`、`filePath`、`displayFilePath` 这些本地路径字段，并把远程图片 `src` 抹成「已省略」、只留 inline 的 `data:` 图。认证支持两种模式：

| 模式 | 适用场景 |
| --- | --- |
| `SNAPSHOT_SHARE_TOKEN`（Bearer） | 兼容旧的命令行发布方式，token 持有者可删任意分享 |
| GitHub OAuth | 公网服务上的多人发布；发布记录绑定 owner，站长可删任意分享、普通用户只能删自己的 |

公开列表 `GET /api/snapshots` 只返回摘要，不返回完整 transcript；只有详情 `GET /api/snapshots/:id` 才返回快照内容；删除 `DELETE /api/snapshots/:id` 按上面的 ownership 判权。

存储层是个朴素的文件 store：`.codex-snapshots/shares.json`。`src/server/share-store.ts` 用一个 Promise 队列把写入串行化，再用「写临时文件 → `rename` 覆盖」做原子替换：

```ts
const tempFile = path.join(dir, `.${base}.${process.pid}.${Date.now()}.${rand}.tmp`);
await writeFile(tempFile, JSON.stringify({ schemaVersion: 1, updatedAt, entries }, null, 2));
await rename(tempFile, filePath);  // 同盘 rename 原子，不会出现写一半的 shares.json
```

这套选择很适合轻量分享服务：部署简单、行为可测，未来想换数据库，只要把 `ShareStore` 接口换掉即可。

## 10. 工程化：发包靠的是生成物 + 围着边界写的测试

这个仓库已经不是博客里的一个私有脚本，而是能独立发布的 npm 包。构建分两层：`build:dist` 把 `src` 编译到 `dist` 并给 CLI / server 加执行权限；`build:site` 用 Vite + React + Tailwind 生成静态官网；`prepack` 在发布前自动跑完整 build。

更值得看的是测试，它们几乎都围着「安全边界」展开，而不是围着函数：

| 测试 | 关注点 |
| --- | --- |
| `test:smoke` | CLI、daemon、share server、部署脚本、生成物语法能不能跑起来 |
| `test:local-history` | 三类来源的扫描与归一 |
| `test:privacy` | 风险检测与脱敏（重构后专门补了解析核心的单测） |
| `test:share-api` | 发布、列表、详情、删除、OAuth ownership、HTML 净化、路径移除 |
| `test:static-site` | 公开官网如何读公网 API，以及**如何避免误读访问者本机的 `127.0.0.1`** |
| `test:deploy-config` | 阿里云部署配置是否拒绝 localhost、示例域名和错误路径 |

最能说明这个项目气质的，是 `test:static-site` 里那条用例：公开官网如果没配公网 API，**绝不回退去请求访问者自己的 `127.0.0.1`**。这说明它把「本机」和「公网」的边界当成了**产品约束**，而不是部署文档里一句提醒。

## 11. 把这些串成一条主线

回头看，`codex-snapshots` 的所有设计都从同一个定位长出来：**先把分享对象定义成冻结的、只读的、可丢弃的快照，再决定哪些 UI 和 API 能围绕它存在。** 这个定位带来一条清晰的能力链：

```
本地只读扫描（三源并行，allSettled 容错）
  → 两层加载（summary 扫 140 行 / snapshot 按需读全文）
    → 归一成 turns（Codex/Claude/Trae 统一，子代理嵌进父会话）
      → 分层脱敏（一张表同时驱动检测+脱敏，宁可多删）
        → 本地审阅（回环服务 + Origin 白名单 + CSRF 写保护）
          → 云端分享（只收脱敏 payload，服务端用同一套规则再验一遍）
```

真正把它和「玩具脚本」区分开的，是贯穿始终的两类工程素养：

- **归一要稳**：三种格式差异极大的本地历史，被收敛成同一种 `turn`；某个源出错也只少这一类，不拖垮全局；子代理被还原成父会话内部的真实结构，而不是打散成碎片。
- **边界要硬**：脱敏不是只做一次，而是检测/脱敏共用一张表、本地强制脱敏、云端**不信任上一层**地再扫一遍；本机回环服务用 Origin + CSRF 把写动作锁死。

如果要拿它做一次分享，我会把落点放在第 7 节那张 `REDACTION_RULES` 表，和第 9 节那个 `highRiskCategoriesInShare`——**前者用「单一数据源」从结构上消灭了「标了红却仍原样发出」这一整类漏密 bug；后者则干脆假设客户端不可信，用同一份规则在服务端再验一次。** 很多工具做「分享」，是先把页面做出来、再回头补安全规则；这个项目的方向恰好相反。**很多工具的差距，恰恰就在这种「上一层会不会漏、漏了会怎样」的地方。**

> 观察基于 `codex-snapshots@0.1.3`、commit `85fc125` 的源码。核心逻辑按职责分布在 `src/` 下的 `cli / sources / core / renderers / shared / server` 几层；文中代码均为讲解裁剪版，省略了部分边界分支与日志。
