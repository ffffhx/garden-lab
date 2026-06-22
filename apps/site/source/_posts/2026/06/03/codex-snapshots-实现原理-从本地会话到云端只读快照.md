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
cover: "cover-v1.png"
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

<figure class="fz077" data-reveal role="group" aria-label="Codex Snapshots 总体架构：同一套快照核心，服务三种入口"><style>.fz077{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--soft:#f7f1e4;--grnl:#7c9c54;--cyn:#3f6d79;--cynb:#dcebed;--cyne:#8fbcc4;--amb:#9a6516;--ambb:#f4e8cc;--ambe:#d9b66a;--vio:#54579a;--viob:#e6e7f3;--vioe:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),var(--paper-deep,#ece5d5));color:var(--ink,#1a1815);margin:0;padding:clamp(18px,3vw,30px);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;box-sizing:border-box;line-height:1.5}.fz077 *{box-sizing:border-box}.fz077 .hd{margin-bottom:clamp(16px,2.4vw,24px)}.fz077 .ttl{font-weight:800;font-size:clamp(18px,2.6vw,27px);letter-spacing:.01em;margin:0}.fz077 .sub{font-size:clamp(12px,1.5vw,15px);color:var(--muted,#6a6155);margin:.5em 0 0}.fz077 .top{display:grid;grid-template-columns:1fr auto 1.15fr auto 1.15fr;gap:clamp(6px,1vw,12px);align-items:stretch}.fz077 .card{position:relative;background:var(--soft,#f7f1e4);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:12px;padding:clamp(12px,1.6vw,17px);display:flex;flex-direction:column;gap:.5em;min-width:0}.fz077 .card.cli{background:var(--viob,#e6e7f3);border-color:var(--vioe,#a9adcf)}.fz077 .card.src{background:var(--cynb,#dcebed);border-color:var(--cyne,#8fbcc4)}.fz077 .card.core{background:var(--ambb,#f4e8cc);border-color:var(--ambe,#d9b66a)}.fz077 .ct{font-weight:800;font-size:clamp(14px,1.8vw,19px)}.fz077 .ct .tag{display:inline-block;width:.6em;height:.6em;border-radius:50%;margin-right:.5em;vertical-align:middle;animation:fz077pulse 7s ease-in-out infinite}.fz077 .cli .tag{background:var(--vio,#54579a)}.fz077 .src .tag{background:var(--cyn,#3f6d79);animation-delay:.6s}.fz077 .core .tag{background:var(--amb,#9a6516);animation-delay:1.2s}.fz077 .mono{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.3vw,13px);font-weight:600}.fz077 .cli .mono{color:var(--vio,#54579a)}.fz077 .txt{font-size:clamp(12px,1.4vw,14.5px);color:var(--ink-soft,#3c362c)}.fz077 .src .flow{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.3vw,13px);font-weight:700;color:var(--cyn,#3f6d79);margin-top:auto;padding-top:.3em}.fz077 .core .txt{display:flex;align-items:center;gap:.5em}.fz077 .core .txt::before{content:"";width:.45em;height:.45em;border-radius:1px;background:var(--amb,#9a6516);opacity:.7;flex:none}.fz077 .harrow{align-self:center;display:flex;align-items:center;justify-content:center;min-width:22px}.fz077 .harrow .line{height:3px;width:100%;min-width:18px;background:var(--hair,rgba(26,24,21,.18));position:relative;overflow:hidden;border-radius:2px}.fz077 .harrow .line::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,var(--ink-soft,#3c362c),transparent);animation:fz077hflow 4.5s ease-in-out infinite}.fz077 .harrow.a2 .line::after{animation-delay:1.4s}.fz077 .harrow .head{width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid var(--ink,#1a1815);margin-left:1px;flex:none}.fz077 .mid{display:flex;justify-content:center;position:relative;height:clamp(40px,6vw,64px)}.fz077 .fan{position:relative;width:74%;max-width:560px;height:100%}.fz077 .stem{position:absolute;left:50%;top:0;width:3px;height:46%;transform:translateX(-50%);background:var(--ambe,#d9b66a);border-radius:2px;overflow:hidden}.fz077 .stem::after{content:"";position:absolute;left:0;top:-50%;width:100%;height:50%;background:linear-gradient(180deg,transparent,var(--amb,#9a6516));animation:fz077vflow 5s ease-in-out infinite}.fz077 .crossbar{position:absolute;left:8%;right:8%;top:46%;height:3px;background:var(--ambe,#d9b66a);border-radius:2px}.fz077 .drop{position:absolute;top:46%;width:3px;height:54%;background:var(--ambe,#d9b66a);border-radius:2px;overflow:hidden}.fz077 .drop::after{content:"";position:absolute;left:0;top:-60%;width:100%;height:60%;background:linear-gradient(180deg,transparent,var(--amb,#9a6516));animation:fz077vflow 5s ease-in-out infinite}.fz077 .drop.d1{left:8%}.fz077 .drop.d2{left:calc(50% - 1.5px);animation:none}.fz077 .drop.d2::after{animation-delay:.5s}.fz077 .drop.d3{right:8%;left:auto}.fz077 .drop.d3::after{animation-delay:1s}.fz077 .drop .head,.fz077 .stem .head{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--amb,#9a6516)}.fz077 .out{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(12px,2vw,22px)}.fz077 .out .card{background:#fff;border-color:var(--hair,rgba(26,24,21,.18))}.fz077 .out .exp .tag{background:var(--grnl,#7c9c54);animation-delay:0s}.fz077 .out .viewer .tag{background:var(--cyn,#3f6d79);animation-delay:.5s}.fz077 .out .share .tag{background:var(--amb,#9a6516);animation-delay:1s}.fz077 .out .exp{border-bottom:3px solid var(--grnl,#7c9c54)}.fz077 .out .viewer{border-bottom:3px solid var(--cyne,#8fbcc4)}.fz077 .out .share{border-bottom:3px solid var(--ambe,#d9b66a)}.fz077 .mono.url{color:var(--cyn,#3f6d79)}.fz077 .foot{margin-top:clamp(16px,2.4vw,24px);padding-top:clamp(10px,1.4vw,14px);border-top:1px solid var(--hair,rgba(26,24,21,.18));font-size:clamp(12px,1.5vw,15px);color:var(--muted,#6a6155)}.fz077 .foot b{color:var(--ink-soft,#3c362c);font-weight:700}@keyframes fz077pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.35);opacity:1}}@keyframes fz077hflow{0%{left:-40%}55%,100%{left:110%}}@keyframes fz077vflow{0%{top:-60%}55%,100%{top:110%}}@media(max-width:560px){.fz077 .top,.fz077 .out{grid-template-columns:1fr;gap:10px}.fz077 .harrow{transform:rotate(90deg);height:22px;margin:2px auto;min-width:0}.fz077 .mid{height:34px}.fz077 .fan{width:66%}}@media (prefers-reduced-motion:reduce){.fz077 .ct .tag{animation:none;opacity:1}.fz077 .harrow .line::after,.fz077 .stem::after,.fz077 .drop::after{animation:none;opacity:.5}}</style><div class="hd"><p class="ttl">总体架构：同一套快照核心，服务三种入口</p><p class="sub">终端命令、本地审阅台、云端只读分享都围绕 snapshot / turns 这层稳定结构展开。</p></div><div class="top"><div class="card cli"><div class="ct"><span class="tag"></span>CLI 入口</div><div class="mono">list / preview / export</div><div class="mono">serve / publish / daemon</div></div><div class="harrow a1"><div class="line"></div><div class="head"></div></div><div class="card src"><div class="ct"><span class="tag"></span>本地数据源</div><div class="txt">Codex JSONL</div><div class="txt">Claude transcript / history</div><div class="txt">Trae recorder / history</div><div class="flow">summary &#8594; snapshot</div></div><div class="harrow a2"><div class="line"></div><div class="head"></div></div><div class="card core"><div class="ct"><span class="tag"></span>Snapshot Core</div><div class="txt">统一 turns</div><div class="txt">风险检测与脱敏</div><div class="txt">Markdown 渲染</div><div class="txt">HTML 净化</div></div></div><div class="mid"><div class="fan"><div class="stem"></div><div class="crossbar"></div><div class="drop d1"><div class="head"></div></div><div class="drop d2"><div class="head"></div></div><div class="drop d3"><div class="head"></div></div></div></div><div class="out"><div class="card exp"><div class="ct"><span class="tag"></span>静态导出</div><div class="txt">HTML / Markdown</div><div class="txt">不可继续对话</div></div><div class="card viewer"><div class="ct"><span class="tag"></span>本地 Viewer</div><div class="mono url">127.0.0.1:4321</div><div class="txt">审阅、开关、导出、发布</div></div><div class="card share"><div class="ct"><span class="tag"></span>Share API</div><div class="txt">保存脱敏 payload</div><div class="txt">公网只读分享页</div></div></div><div class="foot">核心边界：<b>本机历史不直接上云</b>，云端只接收已脱敏且再次净化的只读快照。</div></figure>

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

<figure class="fz078" data-reveal role="group" aria-label="数据源归一流程图：Codex、Claude Code、Trae 三类历史经 listSessions 并行扫描归一成 summary 与 snapshot 两种稳定对象"><style>.fz078{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:clamp(18px,3vw,30px);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;box-sizing:border-box;line-height:1.5}.fz078 *{box-sizing:border-box}.fz078 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz078 .ttl{font-size:clamp(17px,2.6vw,23px);font-weight:800;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz078 .sub{margin-top:6px;font-size:clamp(12px,1.7vw,14px);color:var(--muted,#6a6155);line-height:1.55}.fz078 .flow{display:grid;grid-template-columns:1fr auto 1.05fr auto 1fr;align-items:center;gap:clamp(6px,1.4vw,16px)}.fz078 .col{display:flex;flex-direction:column;gap:clamp(10px,1.8vw,16px)}.fz078 .node{border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:13px 15px;background:var(--paper-soft,#faf6ec);position:relative;overflow:hidden}.fz078 .node::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:currentColor;opacity:.85}.fz078 .src{animation:fz078pulse 8s ease-in-out infinite}.fz078 .src.s2{animation-delay:.5s}.fz078 .src.s3{animation-delay:1s}.fz078 .c-grn{color:#4f7233;background:#e7eedd}.fz078 .c-cyn{color:#3f6d79;background:#dcebed}.fz078 .c-amb{color:#9a6516;background:#f4e8cc}.fz078 .c-cnt{color:var(--ink-soft,#3c362c);background:#f7f1e4;border-color:rgba(26,24,21,.3);border-width:2px}.fz078 .c-out{color:#54579a;background:#e6e7f3}.fz078 .nt{font-size:clamp(14px,1.9vw,16px);font-weight:800;color:var(--ink,#1a1815);display:flex;align-items:center;gap:7px}.fz078 .dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:0 0 auto}.fz078 .nx{font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c);margin-top:6px;line-height:1.5}.fz078 .mono{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.35vw,12px);color:currentColor;margin-top:7px;padding:3px 7px;border-radius:5px;background:rgba(26,24,21,.05);display:inline-block;font-weight:600}.fz078 .core{padding:16px 16px;text-align:left}.fz078 .core .nt{font-size:clamp(15px,2vw,18px);justify-content:flex-start}.fz078 .core ul{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px}.fz078 .core li{font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c);padding-left:15px;position:relative}.fz078 .core li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;border-radius:50%;background:#54579a;opacity:.6}.fz078 .conn{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:clamp(14px,2.6vw,26px);min-width:34px}.fz078 .arr{position:relative;height:3px;border-radius:3px;background:var(--hair,rgba(26,24,21,.18));overflow:visible}.fz078 .arr::after{content:"";position:absolute;right:-2px;top:50%;transform:translateY(-50%);border-left:8px solid var(--ink-soft,#3c362c);border-top:5px solid transparent;border-bottom:5px solid transparent}.fz078 .arr .pkt{position:absolute;top:50%;left:0;width:18px;height:3px;transform:translateY(-50%);border-radius:3px;background:linear-gradient(90deg,transparent,#7c9c54,transparent);animation:fz078run 7s linear infinite}.fz078 .conn.right .pkt{background:linear-gradient(90deg,transparent,#a9adcf,transparent)}.fz078 .arr.a2 .pkt{animation-delay:1.1s}.fz078 .arr.a3 .pkt{animation-delay:2.2s}.fz078 .ft{margin-top:clamp(14px,2.4vw,20px);padding-top:13px;border-top:1px solid var(--hair,rgba(26,24,21,.18));font-size:clamp(11px,1.55vw,13px);color:var(--muted,#6a6155);line-height:1.55}.fz078 .ft b{color:var(--ink-soft,#3c362c);font-weight:700}@keyframes fz078run{0%{left:-8%;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:100%;opacity:0}}@keyframes fz078pulse{0%,100%{box-shadow:0 0 0 0 rgba(124,156,84,0)}50%{box-shadow:-3px 0 0 0 currentColor}}@media (max-width:560px){.fz078 .flow{grid-template-columns:1fr;gap:10px}.fz078 .conn{flex-direction:row;justify-content:center;min-width:0;gap:18px;padding:2px 0}.fz078 .arr{width:34px}.fz078 .arr::after{right:50%;top:auto;bottom:-6px;transform:translateX(50%) rotate(90deg)}.fz078 .arr .pkt{animation:fz078rundn 7s linear infinite}}@keyframes fz078rundn{0%{left:8px;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:8px;top:120%;opacity:0}}@media (prefers-reduced-motion:reduce){.fz078 .src,.fz078 .pkt{animation:none!important}.fz078 .src{box-shadow:-3px 0 0 0 currentColor}.fz078 .pkt{opacity:1;left:38%}}</style><div class="hd"><div class="ttl">数据源归一：列表扫摘要，详情再读完整内容</div><div class="sub">三类 Agent 的历史格式不同，但 UI 只消费 <b>summary</b> 和 <b>snapshot</b> 两种稳定对象。</div></div><div class="flow"><div class="col"><div class="node src c-grn"><div class="nt"><span class="dot"></span>Codex</div><div class="nx">sessions / archived_sessions</div><div class="mono">session_index.jsonl 补标题</div></div><div class="node src s2 c-cyn"><div class="nt"><span class="dot"></span>Claude Code</div><div class="nx">projects / sessions</div><div class="mono">history.jsonl 只作线索</div></div><div class="node src s3 c-amb"><div class="nt"><span class="dot"></span>Trae</div><div class="nx">recorder / memory / input</div><div class="mono">recorded 才默认完整</div></div></div><div class="conn"><div class="arr a1"><span class="pkt"></span></div><div class="arr a2"><span class="pkt"></span></div><div class="arr a3"><span class="pkt"></span></div></div><div class="node core c-cnt"><div class="nt"><span class="dot"></span>listSessions</div><ul><li>并行扫描</li><li>按 mtime 排序</li><li>completeOnly 过滤</li></ul><div class="mono">source = codex | claude | trae | all</div></div><div class="conn right"><div class="arr a1"><span class="pkt"></span></div><div class="arr a3"><span class="pkt"></span></div></div><div class="col"><div class="node c-out"><div class="nt"><span class="dot"></span>summary</div><div class="nx">标题、来源、项目路径</div><div class="nx">消息数、风险计数</div></div><div class="node c-out"><div class="nt"><span class="dot"></span>snapshot</div><div class="nx">点开后才完整加载</div><div class="nx">统一 turns 和风险面板</div></div></div></div><div class="ft"><b>列表快</b>，是因为只读摘要；<b>分享准</b>，是因为详情阶段再按来源加载完整 transcript。</div></figure>

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

<figure class="fz079" data-reveal role="group" aria-label="快照构建流程图：从原始历史经过滤角色、标记风险、脱敏文本到渲染受限 HTML 的五步流水线，以及正文边界、风险面板与统一输出三块说明"><style>.fz079{--paper-soft:#faf6ec;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);margin:0;padding:clamp(16px,3.4vw,30px);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;box-shadow:0 1px 0 rgba(255,255,255,.5) inset;line-height:1.5}.fz079 .hd{margin:0 0 2px;font-size:clamp(18px,3vw,25px);font-weight:800;letter-spacing:.2px;color:var(--ink,#1a1815)}.fz079 .sub{margin:0 0 clamp(16px,2.6vw,24px);font-size:clamp(12px,1.7vw,14px);color:var(--muted,#6a6155)}.fz079 .flow{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px 6px;margin-bottom:clamp(18px,3vw,26px)}.fz079 .node{flex:1 1 130px;min-width:118px;position:relative;background:var(--paper-soft,#faf6ec);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:13px 12px 12px;display:flex;flex-direction:column;gap:5px;overflow:hidden;animation:fz079pulse 9s ease-in-out infinite}.fz079 .node::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ac,#917f5c);opacity:.85}.fz079 .node .k{font-size:13px;font-weight:800;color:var(--ink,#1a1815)}.fz079 .node .d{font-size:11px;color:var(--muted,#6a6155);line-height:1.35}.fz079 .node .m{margin-top:2px;font-family:var(--mono);font-size:10.5px;font-weight:700;color:var(--ac,#917f5c);background:var(--acb,#ece4d2);align-self:flex-start;padding:2px 7px;border-radius:5px}.fz079 .n1{--ac:#917f5c;--acb:#ece4d2;animation-delay:0s}.fz079 .n2{--ac:#3f6d79;--acb:#dcebed;border-color:#8fbcc4;animation-delay:1.6s}.fz079 .n3{--ac:#9a6516;--acb:#f4e8cc;border-color:#d9b66a;animation-delay:3.2s}.fz079 .n4{--ac:#4f7233;--acb:#e7eedd;border-color:#7c9c54;animation-delay:4.8s}.fz079 .n5{--ac:#7a6f5a;--acb:#e7e1d2;border-color:#cabf9f;animation-delay:6.4s}.fz079 .arr{flex:0 0 18px;align-self:center;display:flex;align-items:center;justify-content:center;position:relative}.fz079 .arr i{display:block;width:13px;height:2px;background:linear-gradient(90deg,var(--hair,rgba(26,24,21,.18)),var(--ink-soft,#3c362c));position:relative;border-radius:2px}.fz079 .arr i::after{content:"";position:absolute;right:-1px;top:50%;transform:translateY(-50%);border:4px solid transparent;border-left-color:var(--ink-soft,#3c362c)}.fz079 .arr i::before{content:"";position:absolute;left:0;top:0;height:100%;width:6px;border-radius:2px;background:#7c9c54;mix-blend-mode:multiply;animation:fz079run 7s linear infinite}.fz079 .a1 i::before{animation-delay:0s}.fz079 .a2 i::before{animation-delay:1.6s}.fz079 .a3 i::before{animation-delay:3.2s}.fz079 .a4 i::before{animation-delay:4.8s}.fz079 .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(8px,1.6vw,14px)}.fz079 .panel{background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:14px 13px;border-top:3px solid var(--pc,#917f5c)}.fz079 .panel .pk{font-size:13.5px;font-weight:800;margin-bottom:9px;color:var(--ink,#1a1815);display:flex;align-items:center;gap:7px}.fz079 .panel .pk::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--pc,#917f5c);flex:0 0 auto}.fz079 .panel ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}.fz079 .panel li{font-size:11.5px;color:var(--ink-soft,#3c362c);padding-left:13px;position:relative;line-height:1.4}.fz079 .panel li::before{content:"";position:absolute;left:0;top:.55em;width:5px;height:5px;border-radius:1px;background:var(--pc,#917f5c);opacity:.7}.fz079 .panel li .c{font-family:var(--mono);font-size:11px;color:var(--pc,#917f5c)}.fz079 .p1{--pc:#917f5c}.fz079 .p2{--pc:#9a6516;border-color:#d9b66a;background:linear-gradient(180deg,#f4e8cc55,var(--paper-soft,#faf6ec) 40%)}.fz079 .p3{--pc:#7a6f5a;border-color:#cabf9f}.fz079 .foot{margin:clamp(16px,2.6vw,22px) 0 0;font-size:clamp(11.5px,1.6vw,13px);color:var(--muted,#6a6155);font-style:italic;border-top:1px dashed var(--hair,rgba(26,24,21,.18));padding-top:12px}@keyframes fz079pulse{0%,100%{box-shadow:0 0 0 0 transparent}45%{box-shadow:0 2px 14px -6px var(--ac,#917f5c)}}@keyframes fz079run{0%{left:-6px;opacity:0}20%{opacity:.9}80%{opacity:.9}100%{left:13px;opacity:0}}@media(max-width:640px){.fz079 .grid{grid-template-columns:1fr}.fz079 .flow{flex-direction:column}.fz079 .node{flex:1 1 auto}.fz079 .arr{transform:rotate(90deg);height:14px;margin:-3px 0}}@media(prefers-reduced-motion:reduce){.fz079 .node,.fz079 .arr i::before{animation:none}.fz079 .arr i::before{opacity:0}}</style><p class="hd">快照构建：从原始历史到安全可读的 turns</p><p class="sub">先筛出可读正文，再在原文上标风险，最后渲染成受限 HTML。</p><div class="flow"><div class="node n1"><span class="k">读取原始行</span><span class="d">JSONL / history</span><span class="m">readJsonl()</span></div><span class="arr a1"><i></i></span><div class="node n2"><span class="k">过滤角色</span><span class="d">user / assistant</span><span class="m">skip bootstrap</span></div><span class="arr a2"><i></i></span><div class="node n3"><span class="k">标记风险</span><span class="d">基于原文检测</span><span class="m">addRisks()</span></div><span class="arr a3"><i></i></span><div class="node n4"><span class="k">脱敏文本</span><span class="d">token / path</span><span class="m">redactText()</span></div><span class="arr a4"><i></i></span><div class="node n5"><span class="k">渲染 HTML</span><span class="d">Markdown + 高亮</span><span class="m">sanitize-html</span></div></div><div class="grid"><div class="panel p1"><div class="pk">默认正文边界</div><ul><li>隐藏 <span class="c">system / developer</span></li><li>隐藏工具调用和工具输出</li></ul></div><div class="panel p2"><div class="pk">风险面板</div><ul><li>私钥、JWT、Bearer、API key</li><li>本机 home path、内部域名</li></ul></div><div class="panel p3"><div class="pk">统一输出</div><ul><li><span class="c">snapshot.turns[]</span></li><li>HTML / Markdown / Share API 共用</li></ul></div></div><p class="foot">风险检测先于脱敏，渲染后还要净化：每层都假设上一层可能漏掉东西。</p></figure>

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

<figure class="fz080" data-reveal role="group" aria-label="本地 Viewer 安全边界：浏览器只访问回环服务，Node 服务读文件，写动作受来源与 token 保护"><style>.fz080{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--grn:#4f7233;--grn-bg:#e7eedd;--grn-br:#7c9c54;--cyn:#3f6d79;--cyn-bg:#dcebed;--cyn-br:#8fbcc4;--amb:#9a6516;--amb-bg:#f4e8cc;--amb-br:#d9b66a;--red:#8f2d20;--red-bg:#f1ddd6;--red-br:#cf9b90;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(180deg,var(--paper-soft,#faf6ec),#f7f1e4);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3.5vw,30px);margin:0;max-width:980px;box-sizing:border-box}.fz080 *{box-sizing:border-box}.fz080 .hd{margin-bottom:18px}.fz080 .ttl{font-size:clamp(17px,2.7vw,23px);font-weight:800;letter-spacing:.2px;line-height:1.35;color:var(--ink)}.fz080 .sub{margin-top:6px;font-size:clamp(12px,1.7vw,14.5px);color:var(--muted,#6a6155);line-height:1.5}.fz080 .grid{display:grid;grid-template-columns:1fr auto 1.1fr;gap:clamp(12px,2.2vw,22px);align-items:stretch}.fz080 .mid{display:flex;align-items:center}.fz080 .rcol{display:flex;flex-direction:column;gap:clamp(12px,2vw,16px);justify-content:center}.fz080 .node{position:relative;border-radius:12px;padding:14px 15px;border:1.5px solid var(--hair);background:var(--paper-soft,#faf6ec);box-shadow:0 1px 0 rgba(26,24,21,.04)}.fz080 .n-ui{border-color:var(--cyn-br,#8fbcc4);background:var(--cyn-bg,#dcebed)}.fz080 .n-node{border-color:var(--ink);background:#fff}.fz080 .n-file{border-color:var(--grn-br,#7c9c54);background:var(--grn-bg,#e7eedd)}.fz080 .n-guard{border-color:var(--amb-br,#d9b66a);background:var(--amb-bg,#f4e8cc)}.fz080 .bt{font-size:clamp(14px,2vw,17px);font-weight:800;color:var(--ink);line-height:1.25}.fz080 .bx{margin-top:7px;font-size:clamp(11.5px,1.5vw,13.5px);color:var(--ink-soft,#3c362c);line-height:1.5}.fz080 .bx b{font-weight:600}.fz080 .mono{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.4vw,12.5px);font-weight:600;color:var(--cyn,#3f6d79);background:rgba(63,109,121,.08);padding:1px 5px;border-radius:4px;display:inline-block;margin-top:7px}.fz080 .n-node .mono{color:var(--ink-soft);background:rgba(26,24,21,.06)}.fz080 .row{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft)}.fz080 .dot{width:6px;height:6px;border-radius:50%;flex:none}.fz080 .n-file .dot{background:var(--grn,#4f7233)}.fz080 .n-guard .dot{background:var(--amb,#9a6516)}.fz080 .conn{position:relative;min-width:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.fz080 .arr{position:relative;height:3px;width:100%;min-width:48px;border-radius:2px;background:linear-gradient(90deg,var(--hair),var(--hair));overflow:visible}.fz080 .arr::before{content:"";position:absolute;inset:0;border-radius:2px;background:linear-gradient(90deg,transparent,var(--cyn,#3f6d79),transparent);background-size:55% 100%;background-repeat:no-repeat;animation:fz080flow 7s ease-in-out infinite}.fz080 .arr::after{content:"";position:absolute;right:-2px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid var(--ink-soft,#3c362c)}.fz080 .lbl{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,12px);font-weight:700;color:var(--cyn,#3f6d79);white-space:nowrap}.fz080 .vlink{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 0}.fz080 .vlbl{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,12px);font-weight:700;white-space:nowrap;margin-bottom:4px}.fz080 .varr{position:relative;width:3px;height:30px;border-radius:2px;background:var(--hair);overflow:visible}.fz080 .varr::before{content:"";position:absolute;inset:0;border-radius:2px;background:linear-gradient(180deg,transparent,currentColor,transparent);background-size:100% 55%;background-repeat:no-repeat;animation:fz080flowv 7s ease-in-out infinite}.fz080 .varr::after{content:"";position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid currentColor}.fz080 .v-read{color:var(--grn,#4f7233)}.fz080 .v-read .varr::before{animation-delay:.3s}.fz080 .v-write{color:var(--amb,#9a6516)}.fz080 .v-write .varr::before{animation-delay:1.4s}.fz080 .ban{margin-top:18px;display:flex;align-items:center;gap:10px;border:1.5px dashed var(--red-br,#cf9b90);background:var(--red-bg,#f1ddd6);border-radius:10px;padding:10px 14px}.fz080 .ban .x{position:relative;width:18px;height:18px;flex:none;animation:fz080pulse 7s ease-in-out infinite}.fz080 .ban .x::before,.fz080 .ban .x::after{content:"";position:absolute;left:50%;top:50%;width:18px;height:2.4px;border-radius:2px;background:var(--red,#8f2d20)}.fz080 .ban .x::before{transform:translate(-50%,-50%) rotate(45deg)}.fz080 .ban .x::after{transform:translate(-50%,-50%) rotate(-45deg)}.fz080 .ban .t{font-size:clamp(12px,1.7vw,15px);font-weight:700;color:var(--red,#8f2d20);line-height:1.4}.fz080 .ft{margin-top:14px;padding-top:12px;border-top:1px solid var(--hair);font-size:clamp(11.5px,1.6vw,13.5px);color:var(--muted,#6a6155);line-height:1.55}@keyframes fz080flow{0%{background-position:-60% 0}45%,100%{background-position:160% 0}}@keyframes fz080flowv{0%{background-position:0 -60%}45%,100%{background-position:0 160%}}@keyframes fz080pulse{0%,100%{opacity:.55}50%{opacity:1}}@media(max-width:560px){.fz080 .grid{grid-template-columns:1fr}.fz080 .mid{justify-content:center}.fz080 .conn{flex-direction:column;min-width:0;padding:4px 0}.fz080 .arr{width:3px;height:30px;min-width:0}.fz080 .arr::before{background:linear-gradient(180deg,transparent,var(--cyn,#3f6d79),transparent);background-size:100% 55%;background-repeat:no-repeat;animation:fz080flowv 7s ease-in-out infinite}.fz080 .arr::after{right:50%;top:auto;bottom:-2px;transform:translateX(50%);border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:0;border-top:9px solid var(--ink-soft)}.fz080 .rcol{flex-direction:column}}@media (prefers-reduced-motion:reduce){.fz080 .arr::before,.fz080 .varr::before,.fz080 .ban .x{animation:none}.fz080 .arr::before,.fz080 .varr::before{opacity:.9}.fz080 .ban .x{opacity:1}}</style><div class="hd"><div class="ttl">本地 Viewer：浏览器不直接读文件，只访问回环服务</div><div class="sub">Node 服务负责扫描本机历史；页面只通过受控 API 审阅和导出。</div></div><div class="grid"><div class="mid"><div class="node n-ui"><div class="bt">浏览器 UI</div><div class="bx"><b>搜索、切换来源</b></div><div class="bx"><b>工具 / 输出 / 脱敏开关</b></div><div class="mono">GET API only by default</div></div></div><div class="conn"><div class="lbl">fetch</div><div class="arr"></div></div><div class="rcol"><div class="node n-node"><div class="bt">本地 Node 服务</div><div class="mono">127.0.0.1:4321</div><div class="bx">/api/sessions</div><div class="bx">/api/snapshot</div><div class="bx">/export / publish</div></div><div class="vlink"><div class="vlbl v-read mono" style="background:none;color:var(--grn);padding:0">Node 读文件</div><div class="v-read"><div class="varr"></div></div></div><div class="node n-file"><div class="bt">本机历史文件</div><div class="row"><span class="dot"></span><span>~/.codex</span></div><div class="row"><span class="dot"></span><span>~/.claude</span></div><div class="row"><span class="dot"></span><span>~/.trae-cn</span></div></div><div class="vlink"><div class="vlbl v-write mono" style="background:none;color:var(--amb);padding:0">POST mutation</div><div class="v-write"><div class="varr"></div></div></div><div class="node n-guard"><div class="bt">写动作保护</div><div class="row"><span class="dot"></span><span>Origin 白名单</span></div><div class="row"><span class="dot"></span><span>CSRF token</span></div><div class="row"><span class="dot"></span><span>发布必须脱敏</span></div></div></div></div><div class="ban"><span class="x"></span><span class="t">浏览器不能直接扫描本机历史目录</span></div><div class="ft">本地常驻服务的安全关键：只监听回环地址，读写分开，写动作必须有来源和 token。</div></figure>

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

<figure class="fz081" data-reveal role="group" aria-label="云端分享链路示意图：本地发布经 Payload Gate、Share API 写入 Share Store，再由公开列表、分享详情、删除权限三个只读接口对外分发"><style>.fz081{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--p:#54579a;--pb:#e6e7f3;--pe:#a9adcf;background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3vw,30px);margin:0;box-sizing:border-box;line-height:1.5}.fz081 *{box-sizing:border-box}.fz081 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz081 .h1{font-weight:800;font-size:clamp(17px,2.5vw,23px);letter-spacing:.2px;color:var(--ink,#1a1815)}.fz081 .h2{margin-top:6px;font-size:clamp(12px,1.6vw,14px);color:var(--muted,#6a6155)}.fz081 .row{display:flex;align-items:stretch;gap:clamp(6px,1.4vw,14px);flex-wrap:nowrap}.fz081 .node{flex:1 1 0;min-width:0;background:var(--paper-soft,#faf6ec);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:clamp(10px,1.6vw,15px);position:relative;overflow:hidden}.fz081 .node .bt{font-weight:800;font-size:clamp(13px,1.9vw,17px);color:var(--ink,#1a1815);margin-bottom:7px}.fz081 .node .bx{font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c);margin-top:3px}.fz081 .node .mono{display:inline-block;margin-top:7px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,12px);color:var(--c,#3f6d79);background:var(--cb,#dcebed);border:1px solid var(--ce,#8fbcc4);border-radius:5px;padding:2px 6px;word-break:break-all}.fz081 .node::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--bar,var(--ce,#8fbcc4))}.fz081 .n-loc{background:var(--cb,#dcebed)}.fz081 .n-loc{--bar:var(--c,#3f6d79)}.fz081 .n-gate{background:var(--ab,#f4e8cc)}.fz081 .n-gate{--bar:var(--ae,#d9b66a)}.fz081 .n-gate .bx{color:var(--a,#9a6516)}.fz081 .n-api{background:var(--gb,#e7eedd)}.fz081 .n-api{--bar:var(--gl,#7c9c54)}.fz081 .n-api .bx{color:var(--g,#4f7233)}.fz081 .n-store{background:var(--paper-deep,#ece5d5)}.fz081 .n-store{--bar:var(--muted,#6a6155)}.fz081 .arr{flex:0 0 auto;align-self:center;display:flex;align-items:center;color:var(--muted,#6a6155)}.fz081 .arr .track{position:relative;width:clamp(16px,3vw,34px);height:3px;background:var(--hair,rgba(26,24,21,.18));border-radius:2px;overflow:hidden}.fz081 .arr .track::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,var(--g,#4f7233),transparent);animation:fz081flow 3.2s linear infinite}.fz081 .arr .track:nth-child(1)::after{animation-delay:0s}.fz081 .arr .tip{width:0;height:0;border-left:7px solid var(--ink-soft,#3c362c);border-top:5px solid transparent;border-bottom:5px solid transparent;margin-left:1px}.fz081 .mid{display:flex;align-items:center;gap:10px;margin:clamp(14px,2.4vw,22px) 0 clamp(12px,2vw,18px);color:var(--muted,#6a6155);font-size:clamp(11px,1.5vw,13px)}.fz081 .mid .lab{flex:0 0 auto;font-weight:700;color:var(--g,#4f7233)}.fz081 .mid .fan{flex:1 1 auto;height:18px;position:relative}.fz081 .mid .fan span{position:absolute;top:0;left:0;width:6px;height:6px;border-radius:50%;background:var(--g,#4f7233);animation:fz081fan 4.5s ease-in-out infinite}.fz081 .mid .fan span:nth-child(1){animation-delay:0s;--tx:22%}.fz081 .mid .fan span:nth-child(2){animation-delay:1.5s;--tx:52%}.fz081 .mid .fan span:nth-child(3){animation-delay:3s;--tx:82%}.fz081 .read .node{background:var(--paper-soft,#faf6ec)}.fz081 .read .n-list{--bar:var(--gl,#7c9c54)}.fz081 .read .n-det{--bar:var(--ce,#8fbcc4)}.fz081 .read .n-del{--bar:var(--ae,#d9b66a)}.fz081 .read .n-del .mono{color:var(--a,#9a6516);background:var(--ab,#f4e8cc);border-color:var(--ae,#d9b66a)}.fz081 .ft{margin-top:clamp(14px,2.4vw,22px);padding-top:clamp(10px,1.6vw,14px);border-top:1px dashed var(--hair,rgba(26,24,21,.18));font-size:clamp(11px,1.5vw,13px);color:var(--muted,#6a6155)}@keyframes fz081flow{0%{left:-40%}100%{left:100%}}@keyframes fz081fan{0%,100%{transform:translateX(0);opacity:0}10%{opacity:1}50%{transform:translateX(var(--tx,50%)) translateY(11px);opacity:1}60%,100%{transform:translateX(var(--tx,50%)) translateY(11px);opacity:0}}.fz081 .node{animation:fz081pulse 8s ease-in-out infinite}.fz081 .n-loc{animation-delay:0s}.fz081 .n-gate{animation-delay:.7s}.fz081 .n-api{animation-delay:1.4s}.fz081 .n-store{animation-delay:2.1s}@keyframes fz081pulse{0%,86%,100%{box-shadow:0 0 0 0 rgba(124,156,84,0)}8%{box-shadow:0 0 0 3px rgba(124,156,84,.18)}16%{box-shadow:0 0 0 0 rgba(124,156,84,0)}}@media(max-width:560px){.fz081 .row{flex-wrap:wrap}.fz081 .node{flex:1 1 100%}.fz081 .arr{transform:rotate(90deg);align-self:center;margin:1px auto}.fz081 .read .node{flex:1 1 100%}}@media (prefers-reduced-motion:reduce){.fz081 .arr .track::after,.fz081 .mid .fan span,.fz081 .node{animation:none}.fz081 .arr .track::after{left:30%;opacity:.6}.fz081 .mid .fan span{opacity:1;top:6px}.fz081 .mid .fan span:nth-child(1){left:22%}.fz081 .mid .fan span:nth-child(2){left:52%}.fz081 .mid .fan span:nth-child(3){left:82%}}</style><div class="hd"><div class="h1">云端分享：Share API 只保存已脱敏的只读 payload</div><div class="h2">公网服务不读取用户电脑，只负责认证、净化、存储和只读分发。</div></div><div class="row"><div class="node n-loc"><div class="bt">本地发布</div><div class="bx">Viewer / CLI</div><div class="mono">redact = true</div></div><div class="arr"><div class="track"></div><div class="tip"></div></div><div class="node n-gate"><div class="bt">Payload Gate</div><div class="bx">删除 cwd / filePath</div><div class="bx">拒绝未脱敏</div></div><div class="arr"><div class="track"></div><div class="tip"></div></div><div class="node n-api"><div class="bt">Share API</div><div class="bx">token 或 GitHub OAuth</div><div class="bx">再次 sanitize HTML</div></div><div class="arr"><div class="track"></div><div class="tip"></div></div><div class="node n-store"><div class="bt">Share Store</div><div class="bx">shares.json</div><div class="bx">串行写入 + rename</div></div></div><div class="mid"><span class="lab">Share Store 只读分发</span><span class="fan"><span></span><span></span><span></span></span></div><div class="row read"><div class="node n-list"><div class="bt">公开列表</div><div class="bx">只返回摘要</div><div class="mono">GET /api/snapshots</div></div><div class="node n-det"><div class="bt">分享详情</div><div class="bx">返回只读 snapshot</div><div class="mono">GET /api/snapshots/:id</div></div><div class="node n-del"><div class="bt">删除权限</div><div class="bx">站长或发布者</div><div class="mono">DELETE /api/snapshots/:id</div></div></div><div class="ft">云端边界：认证决定谁能写，payload 规则决定写进去的东西是否仍是安全的只读快照。</div></figure>

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
