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

<figure class="fz073" data-reveal role="group" aria-label="Snapshot 的产品边界：原始 Thread、只读 Snapshot 与朋友阅读页面之间的边界对比"><style>.fz073{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin:0;padding:clamp(16px,3vw,30px);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;color:var(--ink,#1a1815);font-family:var(--serif);box-sizing:border-box}.fz073 *{box-sizing:border-box}.fz073 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz073 .ttl{font-size:clamp(20px,3.4vw,30px);font-weight:800;letter-spacing:.01em;line-height:1.2}.fz073 .sub{margin-top:6px;font-size:clamp(12px,1.7vw,15px);color:var(--muted,#6a6155);line-height:1.5}.fz073 .flow{display:flex;align-items:stretch;gap:0;flex-wrap:nowrap}.fz073 .col{flex:1 1 0;min-width:0;border-radius:16px;padding:clamp(13px,1.8vw,20px);position:relative;display:flex;flex-direction:column;border:1px solid transparent;opacity:0;transform:translateY(10px);animation:fz073in .7s ease forwards}.fz073 .col:nth-child(1){animation-delay:.05s}.fz073 .col:nth-child(3){animation-delay:.5s}.fz073 .col:nth-child(5){animation-delay:.95s}.fz073 .c1{background:#172033;color:#f3f4f6}.fz073 .c2{background:var(--paper-soft,#dcebed);background:#dcebed;border-color:#8fbcc4;color:#274c52}.fz073 .c3{background:#f4e8cc;border-color:#d9b66a;color:#5c4416}.fz073 .ch{font-size:clamp(16px,2.3vw,23px);font-weight:800;margin-bottom:clamp(10px,1.4vw,16px);letter-spacing:.01em}.fz073 .c1 .ch{color:#fff}.fz073 .c2 .ch{color:#3f6d79}.fz073 .c3 .ch{color:#9a6516}.fz073 .li{font-size:clamp(11px,1.55vw,14px);line-height:1.45;padding:5px 0 5px 16px;position:relative;opacity:.92}.fz073 .li::before{content:"";position:absolute;left:0;top:.85em;width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.55}.fz073 .c1 .li{color:#cbd5e1}.fz073 .c2 .li{color:#335b62}.fz073 .c3 .li{color:#604c2e}.fz073 .tag{margin-top:auto;padding-top:clamp(10px,1.5vw,15px);font-size:clamp(12px,1.7vw,15px);font-weight:700;border-top:1px solid currentColor;border-color:rgba(128,128,128,.28);display:inline-flex;align-items:center;gap:7px}.fz073 .tag::before{content:"";width:8px;height:8px;border-radius:2px;background:currentColor;animation:fz073pulse 7s ease-in-out infinite}.fz073 .c1 .tag{color:#fca5a5}.fz073 .c2 .tag{color:#0f766e}.fz073 .c3 .tag{color:#9a5b00}.fz073 .conn{flex:0 0 clamp(26px,4vw,52px);align-self:center;position:relative;height:clamp(20px,3vw,30px);display:flex;align-items:center;justify-content:center}.fz073 .conn .track{position:absolute;left:6%;right:18%;top:50%;height:4px;transform:translateY(-50%);border-radius:3px;background:linear-gradient(90deg,rgba(63,109,121,.18),rgba(63,109,121,.18));overflow:hidden}.fz073 .conn .track::after{content:"";position:absolute;top:0;left:-45%;width:45%;height:100%;border-radius:3px;background:linear-gradient(90deg,transparent,#3f6d79,transparent);animation:fz073move 7s linear infinite}.fz073 .conn:nth-of-type(4) .track::after{animation-delay:1.4s}.fz073 .conn .arw{position:absolute;right:8%;top:50%;transform:translateY(-50%);width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:10px solid #3f6d79}.fz073 .conn .lbl{position:absolute;top:-1.55em;left:50%;transform:translateX(-50%);font-size:clamp(9px,1.2vw,11px);color:var(--muted,#6a6155);white-space:nowrap;font-family:var(--mono)}@keyframes fz073in{to{opacity:1;transform:none}}@keyframes fz073move{0%{left:-45%}100%{left:100%}}@keyframes fz073pulse{0%,100%{opacity:.5;transform:scale(.85)}50%{opacity:1;transform:scale(1.1)}}@media(max-width:560px){.fz073 .flow{flex-direction:column;gap:0}.fz073 .col{width:100%}.fz073 .conn{flex:0 0 clamp(22px,6vw,34px);width:100%;height:clamp(22px,6vw,34px)}.fz073 .conn .track{left:50%;right:auto;top:6%;bottom:34%;width:4px;height:auto;transform:translateX(-50%)}.fz073 .conn .track::after{left:0;top:-45%;width:100%;height:45%;background:linear-gradient(180deg,transparent,#3f6d79,transparent);animation:fz073movev 7s linear infinite}.fz073 .conn .arw{right:auto;left:50%;top:auto;bottom:14%;transform:translateX(-50%);border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #3f6d79;border-bottom:0}.fz073 .conn .lbl{top:50%;left:58%;transform:translateY(-50%)}}@keyframes fz073movev{0%{top:-45%}100%{top:100%}}@media (prefers-reduced-motion:reduce){.fz073 .col{opacity:1;transform:none;animation:none}.fz073 .tag::before{animation:none;opacity:1}.fz073 .conn .track::after{animation:none;left:0;width:80%;opacity:.7}.fz073 .conn:nth-of-type(4) .track::after{top:0}}</style><div class="hd"><div class="ttl">Snapshot 的产品边界</div><div class="sub">冻结、审阅、导出，而不是把仍然活着的 thread 交出去</div></div><div class="flow"><div class="col c1"><div class="ch">原始 Thread</div><div class="li">系统 / 开发者上下文</div><div class="li">工具调用和输出</div><div class="li">本地路径和截图</div><div class="li">可能继续执行</div><div class="tag">不适合直接公开</div></div><div class="conn"><span class="lbl">冻结</span><span class="track"></span><span class="arw"></span></div><div class="col c2"><div class="ch">只读 Snapshot</div><div class="li">用户 / assistant 正文</div><div class="li">Markdown 和代码高亮</div><div class="li">图片附件</div><div class="li">默认脱敏</div><div class="tag">可先本地审阅</div></div><div class="conn"><span class="lbl">导出</span><span class="track"></span><span class="arw"></span></div><div class="col c3"><div class="ch">朋友看到</div><div class="li">静态 HTML / Markdown</div><div class="li">不能继续对话</div><div class="li">不能执行命令</div><div class="li">不能读取本机环境</div><div class="tag">只负责阅读</div></div></div></figure>

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

<figure class="fz074" data-reveal role="group" aria-label="本地 Snapshot 工具架构：Codex、Claude Code、Trae 本地记录经过归一化层后进入本地 Viewer 和博客私有模块，数据不出本机"><style>.fz074{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--grn:#4f7233;--grn-bg:#e7eedd;--grn-br:#7c9c54;--cyn:#3f6d79;--cyn-bg:#dcebed;--cyn-br:#8fbcc4;--amb:#9a6516;--amb-bg:#f4e8cc;--amb-br:#d9b66a;--gry:#917f5c;--gry-bg:#ece4d2;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);margin:0;padding:clamp(16px,3vw,30px);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;line-height:1.45}.fz074 *{box-sizing:border-box}.fz074 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz074 .t1{font-weight:800;font-size:clamp(19px,3vw,27px);letter-spacing:.5px}.fz074 .t2{font-size:clamp(12px,1.6vw,15px);color:var(--muted,#6a6155);margin-top:6px}.fz074 .stage{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1.05fr) auto minmax(0,1fr);align-items:center;gap:clamp(6px,1.4vw,14px)}.fz074 .col{display:flex;flex-direction:column;gap:clamp(8px,1.4vw,13px);min-width:0}.fz074 .src{--fx:-10px;border-radius:14px;padding:clamp(9px,1.6vw,14px) clamp(10px,1.6vw,15px);color:#fff;box-shadow:0 1px 0 rgba(0,0,0,.12);opacity:.42;transform:translateX(var(--fx,0));animation:fzin 9s ease-in-out infinite}.fz074 .src .nm{font-weight:800;font-size:clamp(14px,2vw,19px)}.fz074 .src .sub{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.3vw,12px);opacity:.82;margin-top:3px}.fz074 .s1{background:#2c3a30;animation-delay:0s}.fz074 .s2{background:#3a4034;animation-delay:.5s}.fz074 .s3{background:#45463a;animation-delay:1s}.fz074 .norm{border:2px solid var(--cyn-br,#8fbcc4);background:var(--cyn-bg,#dcebed);border-radius:18px;padding:clamp(12px,2vw,18px) clamp(10px,1.8vw,16px);text-align:center;opacity:.45;animation:fzin 9s ease-in-out infinite;animation-delay:1.4s}.fz074 .norm .nm{font-weight:800;color:var(--cyn,#3f6d79);font-size:clamp(15px,2.2vw,21px)}.fz074 .norm .rows{margin-top:clamp(8px,1.4vw,12px);display:flex;flex-direction:column;gap:6px}.fz074 .norm .rw{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.5vw,14px);color:var(--ink-soft,#3c362c);background:rgba(255,255,255,.45);border:1px solid var(--cyn-br,#8fbcc4);border-radius:8px;padding:4px 8px;opacity:.5;animation:fzrow 9s ease-in-out infinite}.fz074 .norm .rw:nth-child(1){animation-delay:1.7s}.fz074 .norm .rw:nth-child(2){animation-delay:2s}.fz074 .norm .rw:nth-child(3){animation-delay:2.3s}.fz074 .norm .rw:nth-child(4){animation-delay:2.6s}.fz074 .out{--fx:10px;border-radius:14px;padding:clamp(11px,1.8vw,16px) clamp(10px,1.6vw,15px);opacity:.45;transform:translateX(var(--fx,0));animation:fzin 9s ease-in-out infinite}.fz074 .out .nm{font-weight:800;font-size:clamp(14px,2vw,18px)}.fz074 .out .sub{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.3vw,12px);margin-top:4px;color:var(--muted,#6a6155)}.fz074 .o1{background:var(--paper-soft,#faf6ec);border:2px solid var(--gry);animation-delay:3s}.fz074 .o1 .nm{color:var(--ink,#1a1815)}.fz074 .o2{background:var(--amb-bg,#f4e8cc);border:2px solid var(--amb-br,#d9b66a);animation-delay:3.4s}.fz074 .o2 .nm{color:var(--amb,#9a6516)}.fz074 .conn{display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:clamp(34px,8vw,58px);align-self:stretch;padding:clamp(4px,1vw,10px) 0}.fz074 .arr{position:relative;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--cyn-br,#8fbcc4),var(--cyn,#3f6d79));overflow:visible}.fz074 .arr::before{content:"";position:absolute;left:-30%;top:0;height:100%;width:30%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent);animation:fzflow 3.4s linear infinite}.fz074 .arr::after{content:"";position:absolute;right:-1px;top:50%;transform:translateY(-50%);border-left:9px solid var(--cyn,#3f6d79);border-top:6px solid transparent;border-bottom:6px solid transparent}.fz074 .arr.a2::before{animation-delay:.5s}.fz074 .arr.a3::before{animation-delay:1s}.fz074 .arr.a4::before{animation-delay:1.5s}.fz074 .arr.a5::before{animation-delay:2s}.fz074 .banner{margin-top:clamp(16px,2.6vw,24px);text-align:center;font-weight:700;font-size:clamp(12px,1.7vw,15px);color:var(--ink-soft,#3c362c);background:var(--paper-deep,#ece5d5);border:1px dashed var(--hair,rgba(26,24,21,.18));border-radius:999px;padding:clamp(9px,1.5vw,13px) clamp(12px,2vw,20px)}.fz074 .banner b{color:var(--cyn,#3f6d79)}@keyframes fzin{0%,12%{opacity:.42;transform:translateX(var(--fx,0))}30%,76%{opacity:1;transform:translateX(0)}94%,100%{opacity:.42;transform:translateX(var(--fx,0))}}@keyframes fzrow{0%,18%{opacity:.5}40%,80%{opacity:1}96%,100%{opacity:.5}}@keyframes fzflow{0%{left:-30%}100%{left:110%}}@media (max-width:560px){.fz074 .stage{grid-template-columns:1fr;gap:10px}.fz074 .conn{flex-direction:row;gap:0;justify-content:center;padding:2px 0}.fz074 .arr{width:36px;height:3px;transform:rotate(90deg)}.fz074 .src,.fz074 .out{--fx:0;transform:translateX(0)}}@media (prefers-reduced-motion:reduce){.fz074 .src,.fz074 .norm,.fz074 .out,.fz074 .norm .rw{animation:none!important;opacity:1!important;transform:none!important}.fz074 .arr::before{animation:none!important;display:none}}</style><div class="hd"><div class="t1">本地 Snapshot 工具架构</div><div class="t2">数据从本机读取，站点只提供私有入口和 iframe 壳层</div></div><div class="stage"><div class="col"><div class="src s1"><div class="nm">Codex</div><div class="sub">sessions / archived</div></div><div class="src s2"><div class="nm">Claude Code</div><div class="sub">projects / sessions</div></div><div class="src s3"><div class="nm">Trae</div><div class="sub">recorder / memory</div></div></div><div class="conn"><div class="arr a1"></div><div class="arr a2"></div><div class="arr a3"></div></div><div class="col"><div class="norm"><div class="nm">归一化层</div><div class="rows"><div class="rw">summary</div><div class="rw">snapshot</div><div class="rw">turns[]</div><div class="rw">redact + markdown</div></div></div></div><div class="conn"><div class="arr a4"></div><div class="arr a5"></div></div><div class="col"><div class="out o1"><div class="nm">本地 Viewer</div><div class="sub">127.0.0.1:4321</div></div><div class="out o2"><div class="nm">博客私有模块</div><div class="sub">/snapshots/viewer</div></div></div></div><div class="banner">线上模块不携带会话数据，<b>只有本机服务能读本机历史</b></div></figure>

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

<figure class="fz075" data-reveal role="group" aria-label="Trae 本地 Recorder 链路示意图：Trae 页面捕获消息，经 Recorder 处理后写入本地 JSONL"><style>.fz075{--paper-soft:#faf6ec;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--c:#2f6f6a;--cb:#e4f3ef;--ce:#83c5b7;--cd:#155e75;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:16px;padding:22px 20px 18px;margin:1.4em 0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz075 *{box-sizing:border-box}.fz075 .hd{margin-bottom:4px}.fz075 .ttl{font-size:1.28rem;font-weight:800;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz075 .sub{margin-top:5px;font-size:.82rem;color:var(--muted,#6a6155);line-height:1.5}.fz075 .flow{display:flex;align-items:stretch;gap:0;margin-top:20px;flex-wrap:nowrap}.fz075 .node{flex:1 1 0;min-width:0;border-radius:18px;padding:16px 14px 15px;display:flex;flex-direction:column;position:relative}.fz075 .ntag{font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);opacity:.62;margin-bottom:3px}.fz075 .nname{font-size:1.06rem;font-weight:800;margin-bottom:11px;letter-spacing:.01em}.fz075 .row{font-size:.78rem;line-height:1.42;padding:4px 0 4px 16px;position:relative;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);opacity:0;animation:fz075rise 9s ease-in-out infinite}.fz075 .row::before{content:"";position:absolute;left:0;top:.72em;width:7px;height:7px;border-radius:2px;transform:translateY(-50%)}.fz075 .n1{background:var(--ink,#1a1815);color:#e7e2d6}.fz075 .n1 .ntag{color:#9a9488}.fz075 .n1 .nname{color:#fff}.fz075 .n1 .row{color:#c9c3b6}.fz075 .n1 .row::before{background:#7e776a}.fz075 .n2{background:var(--cb,#e4f3ef);color:var(--ink-soft,#3c362c);border:1.5px solid var(--ce,#83c5b7)}.fz075 .n2 .ntag{color:var(--cd,#155e75)}.fz075 .n2 .nname{color:var(--cd,#155e75)}.fz075 .n2 .row::before{background:var(--c,#2f6f6a)}.fz075 .n3{background:var(--ab,#f4e8cc);color:var(--ink-soft,#3c362c);border:1.5px solid var(--ae,#d9b66a)}.fz075 .n3 .ntag{color:var(--a,#9a6516)}.fz075 .n3 .nname{color:var(--a,#9a6516)}.fz075 .n3 .row{font-style:normal}.fz075 .n3 .row::before{background:var(--a,#9a6516)}.fz075 .n3 .mono{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz075 .arr{flex:0 0 46px;align-self:center;height:46px;position:relative;display:flex;align-items:center;justify-content:center}.fz075 .arr .line{position:relative;width:100%;height:4px;border-radius:3px;background:var(--hair,rgba(26,24,21,.18));overflow:hidden}.fz075 .arr .line::after{content:"";position:absolute;top:0;left:-45%;width:45%;height:100%;border-radius:3px;background:linear-gradient(90deg,transparent,var(--c,#2f6f6a),transparent);animation:fz075stream 3.2s linear infinite}.fz075 .arr .head{position:absolute;right:1px;top:50%;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid var(--c,#2f6f6a);transform:translateY(-50%)}.fz075 .arr.a2 .line::after{animation-delay:1.1s}.fz075 .r1{animation-delay:.2s}.fz075 .r2{animation-delay:.7s}.fz075 .r3{animation-delay:1.2s}.fz075 .r4{animation-delay:1.7s}.fz075 .r5{animation-delay:2.2s}.fz075 .note{margin-top:18px;text-align:center;font-size:.8rem;font-weight:600;color:var(--ink-soft,#3c362c);background:#f7f1e4;border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:24px;padding:9px 16px;line-height:1.45}@keyframes fz075rise{0%{opacity:0;transform:translateY(6px)}12%,88%{opacity:1;transform:translateY(0)}100%{opacity:1;transform:translateY(0)}}@keyframes fz075stream{0%{left:-45%}100%{left:100%}}@media(max-width:560px){.fz075 .flow{flex-direction:column}.fz075 .arr{flex:0 0 30px;width:46px;height:30px;align-self:center;transform:rotate(90deg);margin:2px 0}.fz075 .node{width:100%}}@media (prefers-reduced-motion:reduce){.fz075 .row{animation:none;opacity:1;transform:none}.fz075 .arr .line::after{animation:none;left:0;width:100%;background:var(--ce,#83c5b7)}}</style><div class="hd"><div class="ttl">Trae 本地 Recorder 链路</div><div class="sub">当本地存储不保存完整 transcript 时，只能在当前页面显式捕获</div></div><div class="flow"><div class="node n1"><div class="ntag">source</div><div class="nname">Trae 页面</div><div class="row r1">fetch request / response</div><div class="row r2">WebSocket send / message</div><div class="row r3">EventSource message</div><div class="row r4">DOM message fallback</div></div><div class="arr a1"><div class="line"></div><div class="head"></div></div><div class="node n2"><div class="ntag">process</div><div class="nname">Recorder</div><div class="row r1">提取 session id</div><div class="row r2">合并 stream chunk</div><div class="row r3">去重 user / assistant</div><div class="row r4">修复被拆平代码块</div><div class="row r5">默认不保存 headers</div></div><div class="arr a2"><div class="line"></div><div class="head"></div></div><div class="node n3"><div class="ntag">output</div><div class="nname">本地 JSONL</div><div class="row r1 mono">~/.codex-snapshot</div><div class="row r2 mono">trae-recordings</div><div class="row r3">conversation id</div><div class="row r4">作为文件 id</div></div></div><div class="note">Recorder 是显式注入的本地捕获层，只记录注入之后的 Trae 页面活动</div></figure>

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

<figure class="fz076" data-reveal role="group" aria-label="Snapshot Viewer 页面结构：左侧按来源和项目组织的会话列表，中间可拖拽分栏，右侧只读的 Codex 风格会话内容"><style>.fz076{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:var(--paper-soft);border:1px solid var(--hair);border-radius:14px;padding:clamp(14px,3vw,26px);margin:1.4em 0;box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 6px 20px -14px rgba(26,24,21,.4);box-sizing:border-box;overflow:hidden}.fz076 *{box-sizing:border-box}.fz076 .ttl{font-size:clamp(18px,3.4vw,25px);font-weight:800;letter-spacing:.3px;margin:0 0 4px}.fz076 .sub{font-size:clamp(11px,1.9vw,13px);color:var(--muted);margin:0 0 16px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}.fz076 .win{display:grid;grid-template-columns:minmax(0,38fr) 8px minmax(0,62fr);background:#fffdf8;border:2px solid var(--cye);border-radius:16px;overflow:hidden;min-height:380px}.fz076 .pane{padding:clamp(10px,2vw,16px);min-width:0}.fz076 .left{background:#f7f1e4;border-right:1px solid var(--hair)}.fz076 .tabs{display:flex;gap:8px;margin-bottom:14px}.fz076 .tab{font-family:var(--font-mono,ui-monospace,monospace);font-size:11px;font-weight:800;letter-spacing:1px;padding:5px 12px;border-radius:11px;border:1px solid var(--cye)}.fz076 .tab.on{background:var(--cyb);color:var(--cy);border-color:var(--cye);animation:fz076tab 9s ease-in-out infinite}.fz076 .tab.off{background:#fffdf8;color:var(--muted);border-color:var(--hair)}@keyframes fz076tab{0%,100%{box-shadow:0 0 0 0 rgba(63,109,121,0)}45%{box-shadow:0 0 0 3px rgba(143,188,196,.35)}}.fz076 .grp{margin-bottom:16px;opacity:0;transform:translateX(-8px);animation:fz076grp .7s ease-out forwards}.fz076 .grp.g2{animation-delay:.32s}@keyframes fz076grp{to{opacity:1;transform:translateX(0)}}.fz076 .gname{font-family:var(--font-mono,ui-monospace,monospace);font-size:clamp(13px,2.4vw,18px);font-weight:900;color:#5a5346;margin-bottom:7px;word-break:break-all}.fz076 .ses{position:relative;font-size:clamp(12px,2.2vw,15px);font-weight:700;color:var(--ink);padding:7px 11px;border-radius:9px;margin:5px 0 5px 12px;opacity:0;transform:translateX(-6px);animation:fz076grp .55s ease-out forwards}.fz076 .ses.s1{animation-delay:.2s}.fz076 .ses.s2{animation-delay:.5s}.fz076 .ses.s3{animation-delay:.62s}.fz076 .ses.s4{animation-delay:.74s}.fz076 .ses.sel{background:var(--paper-deep);color:var(--ink)}.fz076 .ses.sel::before{content:"";position:absolute;left:0;top:14%;bottom:14%;width:3px;border-radius:3px;background:var(--cy);animation:fz076sel 7s ease-in-out infinite}@keyframes fz076sel{0%,100%{opacity:.55}50%{opacity:1}}.fz076 .split{background:linear-gradient(180deg,var(--hair),rgba(26,24,21,.32),var(--hair));position:relative}.fz076 .split::after{content:"";position:absolute;left:50%;top:0;width:2px;height:100%;transform:translateX(-50%);background:var(--ink);opacity:.5;animation:fz076drag 8s ease-in-out infinite}@keyframes fz076drag{0%,100%{opacity:.35;box-shadow:0 0 0 0 rgba(26,24,21,0)}50%{opacity:.85;box-shadow:0 0 6px 1px rgba(63,109,121,.3)}}.fz076 .right{background:#fffdf8;display:flex;flex-direction:column;gap:12px}.fz076 .rohead{font-family:var(--font-mono,ui-monospace,monospace);font-size:clamp(11px,2vw,15px);font-weight:800;color:var(--muted);border:1px solid var(--hair);border-radius:6px;padding:9px 12px;background:#fffdf8}.fz076 .bubrow{display:flex}.fz076 .bubrow.u{justify-content:flex-end}.fz076 .bubrow.a{justify-content:flex-start}.fz076 .bub{font-size:clamp(12px,2.2vw,16px);line-height:1.5;padding:10px 14px;border-radius:14px;max-width:78%}.fz076 .bub.u{background:var(--cyb);border:1px solid var(--cye);color:var(--ink);border-bottom-right-radius:5px;animation:fz076u 9s ease-in-out infinite}@keyframes fz076u{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}.fz076 .bub.a{background:#f7f1e4;border:1px solid var(--hair);color:var(--ink-soft);border-bottom-left-radius:5px;animation:fz076a 9s ease-in-out infinite}@keyframes fz076a{0%,100%{transform:translateX(0)}50%{transform:translateX(-5px)}}.fz076 .code{background:#161c26;border-radius:11px;padding:13px 15px;font-family:var(--font-mono,ui-monospace,monospace);font-size:clamp(11px,2vw,14px);line-height:1.7;overflow:hidden}.fz076 .code .ln{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fz076 .kw{color:#8ab4f8}.fz076 .cd{color:#edf4ff}.fz076 .cm{color:#7d8796}.fz076 .cur{display:inline-block;width:7px;height:1em;vertical-align:-2px;margin-left:2px;background:#8ab4f8;animation:fz076cur 1.1s steps(2) infinite}@keyframes fz076cur{0%,100%{opacity:0}50%{opacity:1}}.fz076 .handle{align-self:center;margin-top:auto;font-family:var(--font-mono,ui-monospace,monospace);font-size:11px;font-weight:800;color:#5b5446;background:var(--paper-deep);border-radius:10px;padding:4px 16px;animation:fz076drag 8s ease-in-out infinite}@media(max-width:560px){.fz076 .win{grid-template-columns:1fr;min-height:0}.fz076 .split{height:8px;background:linear-gradient(90deg,var(--hair),rgba(26,24,21,.32),var(--hair))}.fz076 .split::after{left:0;top:50%;width:100%;height:2px;transform:translateY(-50%);animation:none;opacity:.5}.fz076 .left{border-right:none;border-bottom:1px solid var(--hair)}.fz076 .bub{max-width:88%}}@media(prefers-reduced-motion:reduce){.fz076 *{animation:none!important}.fz076 .grp,.fz076 .ses{opacity:1;transform:none}.fz076 .cur{opacity:1}.fz076 .ses.sel::before{opacity:1}.fz076 .split::after{opacity:.5}}</style><div class="ttl">Snapshot Viewer 页面结构</div><div class="sub">左侧按来源和项目组织，右侧保留 Codex 风格的阅读体验</div><div class="win"><div class="pane left"><div class="tabs"><span class="tab on">CODEX</span><span class="tab off">TRAE</span></div><div class="grp g1"><div class="gname">garden-lab</div><div class="ses s1 sel">了解会话分享</div></div><div class="grp g2"><div class="gname">coze-monorepo</div><div class="ses s2">排查缺陷原因</div><div class="ses s3">删除 highlightRow</div><div class="ses s4">替换网站图片</div></div></div><div class="pane split" aria-hidden="true"></div><div class="pane right"><div class="rohead">Read-only review / redacted</div><div class="bubrow u"><div class="bub u">用户问题靠右</div></div><div class="bubrow a"><div class="bub a">assistant 回复靠左，正文直接渲染 Markdown。</div></div><div class="code"><div class="ln"><span class="kw">const</span> <span class="cd">snapshot = renderMarkdown(turn)</span><span class="cur"></span></div><div class="ln cm">// 代码块带语法高亮</div></div><div class="handle">drag splitter</div></div></div></figure>

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
