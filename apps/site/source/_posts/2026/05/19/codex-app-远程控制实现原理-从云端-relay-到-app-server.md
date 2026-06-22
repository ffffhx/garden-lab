---
title: "Codex App 远程控制实现原理：从云端 Relay 到 App Server"
date: 2026-05-19 12:20:00
categories:
  - 技术
tags:
  - Codex
  - OpenAI
  - App Server
  - Remote Control
  - WebSocket
  - Agent
excerpt: "Codex App 的跨设备连接不是手机直连电脑，而是本机 App Server 主动连到 ChatGPT 云端 relay。本文基于官方文章和 openai/codex 的 remote_control 源码，拆解 enrollment、WebSocket、分片、ack、客户端复用和安全边界。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

先给结论：

**Codex App 和 PC / Mac 之间的跨设备连接，公开源码里已经能看到本机侧实现，但看不到云端 relay 服务端的完整实现。**

更准确地说，OpenAI 公开了三层材料：

- 官方产品文章解释了“从任意设备继续用 Codex”的产品形态：手机端可以连接正在运行 Codex 的机器，文件、凭据和本地环境仍留在那台机器上，中间通过安全 relay 转发状态和指令。
- 官方 App Server 文章解释了 Codex 如何把桌面 App、IDE、Web runtime 等不同界面收敛到同一个本地 harness 上。
- `openai/codex` 仓库里已经出现了 `remote_control` 传输层源码，能看到本机 App Server 如何 enroll 到云端、如何建立 WebSocket、如何把远端客户端消息转成 App Server 的 JSON-RPC 连接。

所以这篇文章不会假装“云端 relay 服务端也开源了”。它要做的是把公开部分拆清楚：

1. 什么是 relay，它在链路里到底转发什么。
2. 本机 App Server 为什么是整个远程控制的执行端。
3. `remote_control` 源码里如何完成 enrollment、鉴权、WebSocket 建连、分片、ack 和重连。
4. 手机端或 Web 端的消息如何被映射成本机 App Server 的 `thread/start`、`turn/start`、`item/*` 事件流。
5. 哪些安全边界能从源码确认，哪些仍然只能等官方公开。

本文观察范围：

- 官方文章：[Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)
- 官方文章：[Unlocking Codex with the App Server](https://openai.com/index/unlocking-the-codex-harness/)
- 仓库：[openai/codex](https://github.com/openai/codex)
- 观察 commit：[`80fdd4688f6fa8143488c206d4c14dc193905254`](https://github.com/openai/codex/tree/80fdd4688f6fa8143488c206d4c14dc193905254)
- 观察日期：2026-05-19

<figure class="fz069" data-reveal role="group" aria-label="Codex 远程控制总体链路：手机 Web 经 ChatGPT Relay 接入本机 App Server 再到本地执行资源的消息流向图"><style>.fz069{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:clamp(16px,3.4vw,30px);box-sizing:border-box;background:var(--paper-soft,#faf6ec);background-image:linear-gradient(135deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);line-height:1.5;overflow:hidden}.fz069 *{box-sizing:border-box}.fz069 .hd{margin:0 0 4px}.fz069 .ttl{font-size:clamp(17px,2.5vw,23px);font-weight:700;letter-spacing:.2px;color:var(--ink,#1a1815)}.fz069 .sub{margin-top:6px;font-size:clamp(12px,1.6vw,14px);color:var(--muted,#6a6155);max-width:64ch}.fz069 .sub b{color:var(--ink-soft,#3c362c);font-weight:700}.fz069 .rail{margin-top:clamp(16px,3vw,24px);display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:stretch;gap:clamp(6px,1.2vw,12px)}.fz069 .node{position:relative;border-radius:14px;padding:clamp(10px,1.6vw,16px) clamp(8px,1.4vw,14px);border:2px solid;display:flex;flex-direction:column;gap:5px;min-width:0;opacity:.6;transform:translateY(6px);animation:fz069pop 9s ease-in-out infinite}.fz069 .node .h{font-size:clamp(13px,1.9vw,17px);font-weight:700;color:var(--ink,#1a1815)}.fz069 .node .p{font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c)}.fz069 .node .mono{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(9.5px,1.25vw,11px);color:var(--muted,#6a6155);word-break:break-all;line-height:1.35}.fz069 .n1{background:var(--cyan-bg,#dcebed);border-color:var(--cyan-bd,#8fbcc4);animation-delay:0s}.fz069 .n2{background:var(--green-bg,#e7eedd);border-color:var(--green,#4f7233);animation-delay:.6s}.fz069 .n3{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-bd,#d9b66a);animation-delay:1.2s}.fz069 .relay{align-items:center;text-align:center;border-radius:46% 46% 44% 44%/60% 60% 40% 40%}.fz069 .relay .h{color:var(--green,#4f7233)}.fz069 .conn{align-self:center;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:clamp(54px,8vw,96px);padding:2px 0}.fz069 .lbl{font-size:clamp(9px,1.25vw,11px);color:var(--muted,#6a6155);text-align:center;white-space:nowrap}.fz069 .flow{position:relative;height:5px;width:100%;border-radius:3px;background:linear-gradient(90deg,rgba(63,109,121,.16),rgba(63,109,121,.3));overflow:hidden}.fz069 .flow::after{content:"";position:absolute;inset:0;width:42%;border-radius:3px;background:linear-gradient(90deg,transparent,var(--cyan,#3f6d79),transparent);animation:fz069slide 4.6s ease-in-out infinite}.fz069 .conn2 .flow::after{background:linear-gradient(90deg,transparent,var(--amber,#9a6516),transparent);animation-delay:1s}.fz069 .tip{width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid var(--cyan,#3f6d79);align-self:flex-end;margin-top:-1px}.fz069 .conn2 .tip{border-left-color:var(--amber,#9a6516)}.fz069 .down{margin-top:clamp(12px,2vw,18px);display:flex;flex-direction:column;align-items:center;gap:6px}.fz069 .downflow{position:relative;width:5px;height:clamp(26px,5vw,42px);border-radius:3px;background:linear-gradient(180deg,rgba(154,101,22,.18),rgba(154,101,22,.34));overflow:hidden}.fz069 .downflow::after{content:"";position:absolute;left:0;right:0;height:46%;border-radius:3px;background:linear-gradient(180deg,transparent,var(--amber,#9a6516),transparent);animation:fz069down 4.6s ease-in-out infinite}.fz069 .dtip{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--amber,#9a6516);margin-top:-1px}.fz069 .res{margin:8px auto 0;max-width:min(440px,94%);background:var(--gray-bg,#ece4d2);border:2px solid var(--slate,#557c7b);border-radius:14px;padding:clamp(10px,1.6vw,15px) clamp(12px,2vw,18px);text-align:center;opacity:.6;animation:fz069pop 9s ease-in-out infinite;animation-delay:1.8s}.fz069 .res .h{font-size:clamp(13px,1.9vw,17px);font-weight:700;color:var(--slate,#557c7b)}.fz069 .res .p{font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c);margin-top:3px}.fz069 .ret{margin-top:clamp(14px,2.4vw,20px);position:relative;border:1.6px dashed var(--amber-bd,#d9b66a);border-radius:12px;padding:clamp(8px,1.4vw,12px) clamp(12px,2vw,16px) clamp(8px,1.4vw,12px) clamp(34px,5vw,46px);background:linear-gradient(90deg,rgba(154,101,22,.05),transparent);overflow:hidden}.fz069 .ret .rl{font-size:clamp(11px,1.5vw,13px);color:var(--ink-soft,#3c362c)}.fz069 .ret .rl b{color:var(--amber,#9a6516)}.fz069 .ret .dir{font-size:clamp(9.5px,1.3vw,11px);color:var(--muted,#6a6155);margin-top:2px}.fz069 .ret::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:repeating-linear-gradient(180deg,var(--amber-bd,#d9b66a) 0 7px,transparent 7px 15px);animation:fz069retmove 5s linear infinite}.fz069 .ar{display:inline-block;color:var(--amber,#9a6516);font-weight:700}@keyframes fz069pop{0%,100%{opacity:.78;transform:translateY(3px)}28%,62%{opacity:1;transform:translateY(0)}}@keyframes fz069slide{0%{left:-44%}55%,100%{left:104%}}@keyframes fz069down{0%{top:-48%}55%,100%{top:104%}}@keyframes fz069retmove{0%{background-position:0 0}100%{background-position:0 30px}}@media(max-width:560px){.fz069 .rail{grid-template-columns:1fr;gap:4px}.fz069 .conn{flex-direction:row;justify-content:center;width:100%;min-width:0;gap:8px;padding:4px 0}.fz069 .conn .stack{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0}.fz069 .flow{height:4px}.fz069 .flow::after{animation-name:fz069slide}.fz069 .tip{align-self:center;transform:rotate(90deg)}.fz069 .lbl{white-space:normal}}@media (prefers-reduced-motion:reduce){.fz069 .node,.fz069 .res,.fz069 .flow::after,.fz069 .downflow::after,.fz069 .ret::before{animation:none}.fz069 .node,.fz069 .res{opacity:1;transform:none}.fz069 .flow::after{left:0;width:100%;opacity:.55}.fz069 .downflow::after{top:0;height:100%;opacity:.55}}</style><div class="hd"><div class="ttl">总体链路：远端界面接入同一个本机 Harness</div><div class="sub"><b>Relay 只负责连通和转发</b>，真正读写文件、跑命令、审批动作的是本机 App Server 与 Codex Core。</div></div><div class="rail"><div class="node n1"><div class="h">手机 / Web</div><div class="p">发送用户输入</div><div class="p">查看事件流</div><div class="mono">client_id / stream_id</div></div><div class="conn conn1"><div class="stack"><div class="lbl">用户输入 / 审批</div><div class="flow"></div><div class="tip"></div></div></div><div class="node relay n2"><div class="h">ChatGPT Relay</div><div class="p">注册机器</div><div class="p">转发 envelope</div></div><div class="conn conn2"><div class="stack"><div class="lbl">ClientEnvelope</div><div class="flow"></div><div class="tip"></div></div></div><div class="node n3"><div class="h">本机 App Server</div><div class="p">JSON-RPC</div><div class="p">Thread / Turn / Item</div><div class="mono">ConnectionOrigin::RemoteControl</div></div></div><div class="down"><div class="lbl">本机执行</div><div class="downflow"></div><div class="dtip"></div></div><div class="res"><div class="h">本地执行资源</div><div class="p">项目文件 / Git / 终端</div><div class="p">浏览器 / 插件 / MCP</div></div><div class="ret"><div class="rl"><b>ServerEnvelope</b> / 状态 / diff / 输出</div><div class="dir"><span class="ar">←</span> 本机 App Server 经 Relay 回流到手机 / Web</div></div></figure>

## 0. 先把几个词讲清楚

这套机制里最容易混在一起的是四个词：Codex App、App Server、remote control、relay。

**Codex App** 是用户看到的桌面工作台。它负责展示线程、diff、终端、浏览器、审批和多 agent 状态。

**App Server** 是本机真正承载 Codex 任务的服务层。官方 App Server README 说它是 Codex 用来支撑 VS Code 扩展等富界面的接口，协议是 JSON-RPC 2.0。它暴露的核心对象是 `Thread`、`Turn`、`Item`：

- `Thread`：一条连续会话。
- `Turn`：一次用户输入到模型完成输出的执行轮次。
- `Item`：这一轮里的最小事件，例如用户消息、agent 输出、命令、文件修改、审批请求。

**Remote Control** 是公开源码里本机 App Server 的一个传输层。它不是一个新的 agent，而是让远端客户端也能像本地 IDE / App 一样，接入同一个 App Server。

**Relay** 是云端中转层。它不等于把你的项目搬到云端执行，而是负责让手机、Web 或其他受信任界面和本机 App Server 互相找到、互相转发消息。你的电脑通常在 NAT 或防火墙后面，relay 的价值就是让本机主动发起出站连接，不需要暴露一个公网端口。

换句话说，链路不是：

```text
手机直接连电脑公网端口
```

而更像：

```text
手机 / Web 客户端
  -> ChatGPT 云端 relay
  -> 本机 Codex App Server
  -> 本机项目、终端、浏览器、Git
```

## 1. 公开到什么程度：源码边界在哪里

这次能找到的公开源码，最关键的目录是：

```text
codex-rs/app-server-transport/src/transport/remote_control/
```

里面有这些文件：

| 文件 | 作用 |
| --- | --- |
| `protocol.rs` | 定义远程控制 envelope、client event、server event，并把 relay URL 规范化成 enroll / websocket 地址 |
| `enroll.rs` | 本机服务向云端注册 remote-control server，拿到 `server_id` 和 `environment_id` |
| `websocket.rs` | 建立远程控制 WebSocket，负责重连、鉴权恢复、ping/pong、seq、ack、出站缓存 |
| `segment.rs` | 对大消息做分片、base64 编码和重组，避免单帧过大 |
| `client_tracker.rs` | 把远端的 `(client_id, stream_id)` 映射成本机 App Server 的连接 |
| `mod.rs` | 启停 remote control，维护连接状态，向 App Server 暴露 handle |

同时也能看到相关的上层入口：

| 文件 | 作用 |
| --- | --- |
| `codex-rs/app-server/src/request_processors/remote_control_processor.rs` | 实现 `remoteControl/enable`、`remoteControl/disable`、`remoteControl/status/read` |
| `codex-rs/app-server-daemon/src/remote_control_client.rs` | daemon 通过本地 socket 启用 remote control |
| `codex-rs/cli/src/remote_control_cmd.rs` | `codex remote-control` 命令入口 |
| `codex-rs/state/src/runtime/remote_control.rs` | 把 enrollment 信息持久化到本机 SQLite |

但没有公开的是：

- ChatGPT relay 服务端的实现。
- 手机 App / Web UI 如何选择某台机器的完整前端逻辑。
- 设备授权、撤销、推送通知、账号后台策略的服务端细节。
- 桌面 App 自身 UI 壳的全部源码。

所以本文的边界很明确：**我们能解析本机侧 remote-control client 和 App Server 如何接入 relay；不能把云端 relay 服务端说成已开源。**

<figure class="fz070" data-reveal role="group" aria-label="公开源码边界：本机侧开源清楚、云端侧仍是黑盒的对比图"><style>.fz070{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--green:#4f7233;--green-bg:#e7eedd;--green-br:#7c9c54;--amber:#9a6516;--amber-bg:#f4e8cc;--amber-br:#d9b66a;background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3vw,30px);margin:0;max-width:100%;box-sizing:border-box;line-height:1.5}.fz070 *{box-sizing:border-box}.fz070 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz070 .t1{font-weight:700;font-size:clamp(17px,2.6vw,25px);color:var(--ink,#1a1815);letter-spacing:.01em}.fz070 .t2{display:block;margin-top:.5em;font-size:clamp(12px,1.7vw,15px);color:var(--muted,#6a6155);line-height:1.55}.fz070 .grid{display:grid;grid-template-columns:1fr auto 1fr;gap:clamp(10px,2vw,20px);align-items:stretch}.fz070 .col{border-radius:14px;padding:clamp(12px,1.8vw,18px);border:1.5px solid var(--hair,rgba(26,24,21,.18));position:relative;overflow:hidden;min-width:0}.fz070 .col.open{background:var(--green-bg,#e7eedd);border-color:var(--green-br,#7c9c54)}.fz070 .col.closed{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-br,#d9b66a)}.fz070 .ch{display:flex;align-items:center;gap:.5em;font-weight:700;font-size:clamp(14px,2vw,19px);margin-bottom:clamp(10px,1.6vw,15px);padding-bottom:.5em;border-bottom:1px solid var(--hair,rgba(26,24,21,.18))}.fz070 .col.open .ch{color:var(--green,#4f7233)}.fz070 .col.closed .ch{color:var(--amber,#9a6516)}.fz070 .dot{width:.62em;height:.62em;border-radius:50%;flex:none}.fz070 .col.open .dot{background:var(--green-br,#7c9c54);animation:fzpulse 7s ease-in-out infinite}.fz070 .col.closed .dot{background:var(--amber-br,#d9b66a);animation:fzpulse 7s ease-in-out infinite .9s}.fz070 .row{background:rgba(250,246,236,.86);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:9px;padding:clamp(9px,1.3vw,13px) clamp(10px,1.4vw,14px);margin-top:clamp(8px,1.2vw,11px);font-size:clamp(11.5px,1.55vw,15px);position:relative;overflow:hidden;animation:fzin .8s ease-out both}.fz070 .row:first-of-type{margin-top:0}.fz070 .col.open .row{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);color:var(--ink-soft,#3c362c);border-left:3px solid var(--green-br,#7c9c54)}.fz070 .col.closed .row{color:var(--ink-soft,#3c362c);border-left:3px solid var(--amber-br,#d9b66a)}.fz070 .col.open .row::after{content:"";position:absolute;left:0;top:0;height:100%;width:34%;background:linear-gradient(90deg,transparent,rgba(124,156,84,.28),transparent);transform:translateX(-130%);animation:fzscan 6.5s ease-in-out infinite}.fz070 .col.closed .row::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent 0 7px,rgba(154,101,22,.10) 7px 14px);opacity:.5;animation:fzfog 9s ease-in-out infinite}.fz070 .col.open .row:nth-of-type(2)::after{animation-delay:.4s}.fz070 .col.open .row:nth-of-type(3)::after{animation-delay:.8s}.fz070 .col.open .row:nth-of-type(4)::after{animation-delay:1.2s}.fz070 .col.open .row:nth-of-type(5)::after{animation-delay:1.6s}.fz070 .row:nth-of-type(2){animation-delay:.08s}.fz070 .row:nth-of-type(3){animation-delay:.16s}.fz070 .row:nth-of-type(4){animation-delay:.24s}.fz070 .row:nth-of-type(5){animation-delay:.32s}.fz070 .div{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.7em;padding:0 .2em}.fz070 .dline{width:0;flex:1;border-left:2px dashed var(--hair,rgba(26,24,21,.18));min-height:40px;position:relative}.fz070 .dline::after{content:"";position:absolute;left:-3px;top:0;width:4px;height:26%;border-radius:4px;background:linear-gradient(180deg,rgba(124,156,84,.7),rgba(217,182,106,.7));animation:fzslide 8s ease-in-out infinite}.fz070 .dlbl{writing-mode:vertical-rl;font-size:clamp(10px,1.3vw,13px);color:var(--muted,#6a6155);letter-spacing:.18em;white-space:nowrap}.fz070 .ft{margin-top:clamp(14px,2.2vw,20px);text-align:center;font-size:clamp(12px,1.7vw,15px);color:var(--muted,#6a6155);font-style:italic;border-top:1px solid var(--hair,rgba(26,24,21,.18));padding-top:clamp(10px,1.6vw,14px)}@keyframes fzin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes fzscan{0%{transform:translateX(-130%)}55%,100%{transform:translateX(420%)}}@keyframes fzpulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.35);opacity:1}}@keyframes fzfog{0%,100%{opacity:.32}50%{opacity:.6}}@keyframes fzslide{0%{top:0}50%{top:74%}100%{top:0}}@media (max-width:560px){.fz070 .grid{grid-template-columns:1fr;gap:12px}.fz070 .div{flex-direction:row;width:100%;padding:.3em 0}.fz070 .dline{width:auto;align-self:stretch;height:0;flex:1;border-left:0;border-top:2px dashed var(--hair,rgba(26,24,21,.18));min-height:0}.fz070 .dline::after{left:0;top:-3px;width:26%;height:4px;animation:fzslideh 8s ease-in-out infinite}.fz070 .dlbl{writing-mode:horizontal-tb}}@keyframes fzslideh{0%{left:0}50%{left:74%}100%{left:0}}@media (prefers-reduced-motion:reduce){.fz070 .row,.fz070 .dot,.fz070 .row::after,.fz070 .row::before,.fz070 .dline::after{animation:none!important}.fz070 .row{opacity:1;transform:none}.fz070 .row::after,.fz070 .row::before{display:none}.fz070 .dot{opacity:1;transform:none}}</style><div class="hd"><div class="t1">公开源码边界：本机侧清楚，云端侧仍是黑盒</div><small class="t2">openai/codex 公开了 remote_control transport，但 relay 服务端、手机 UI 和设备授权策略没有完整公开。</small></div><div class="grid"><div class="col open"><div class="ch"><span class="dot"></span>公开可读</div><div class="row">app-server-transport/remote_control</div><div class="row">app-server request processors</div><div class="row">app-server-daemon remote client</div><div class="row">state remote_control_enrollments</div><div class="row">CLI remote-control command</div></div><div class="div"><span class="dline"></span><span class="dlbl">公开 ／ 黑盒</span><span class="dline"></span></div><div class="col closed"><div class="ch"><span class="dot"></span>未完整公开</div><div class="row">ChatGPT relay 服务端实现</div><div class="row">手机 / Web 选择机器的 UI 细节</div><div class="row">设备授权、撤销和风控策略</div><div class="row">企业策略与合规日志服务端细节</div><div class="row">桌面 App UI 壳的完整源码</div></div></div><div class="ft">文章只把公开源码能证明的部分写成定论</div></figure>

## 2. App Server：为什么远程控制最后会落到 JSON-RPC

Codex 不是让手机直接发 shell 命令到电脑。公开 App Server 协议里，所有富客户端都是通过一套 JSON-RPC 连接和本机运行时交互。

App Server 支持多种本地传输：

```rust
pub enum AppServerTransport { // 定义 App Server 可以监听的传输入口
    Stdio, // 通过标准输入输出传输 JSON-RPC 消息
    UnixSocket { socket_path: AbsolutePathBuf }, // 通过本机 Unix socket 暴露控制面
    WebSocket { bind_address: SocketAddr }, // 通过实验性 WebSocket 监听地址
    Off, // 不暴露本地传输入口
} // AppServerTransport 枚举结束
```

这段裁剪自 `codex-rs/app-server-transport/src/transport/mod.rs`，它解释了一个关键点：App Server 本来就是多客户端的。VS Code、桌面 App、本地 socket 客户端都可以接入，只要它们遵守同一套 JSON-RPC 协议。

远程控制只是再加一类连接来源：

```rust
pub enum ConnectionOrigin { // 标记一个 App Server 连接来自哪里
    Stdio, // 来自标准输入输出
    InProcess, // 来自进程内客户端
    WebSocket, // 来自本地 WebSocket 监听器
    RemoteControl, // 来自云端 relay 转发过来的远程客户端
} // ConnectionOrigin 枚举结束
```

这就把问题简化了：

- 本机 App Server 已经会处理 `initialize`、`thread/start`、`turn/start`、`turn/interrupt` 等请求。
- 也已经会流式发回 `item/started`、`item/completed`、`command/exec/outputDelta`、`turn/completed` 等通知。
- remote control 只需要把远端客户端的消息变成一条普通 App Server 连接。

这也是它不像传统远程桌面的地方。它传的不是屏幕像素流，而是 Codex App Server 的结构化事件流。

## 3. 启用 remote control：本机先准备一条出站长连接

`codex-rs/app-server/src/lib.rs` 里可以看到 App Server 启动时会根据运行选项决定是否启用 remote control。真正启动远程控制的是 `start_remote_control`：

```rust
let remote_control_enabled = remote_control_requested && state_db.is_some(); // 只有请求开启且 SQLite 状态库可用时才真的开启
let (accept_handle, remote_control_handle) = start_remote_control( // 启动远程控制传输任务
    RemoteControlStartConfig { // 构造远程控制启动配置
        remote_control_url: config.chatgpt_base_url.clone(), // relay 基础地址来自 ChatGPT 后端地址
        installation_id: installation_id.clone(), // 使用本机安装 ID 标识这台 Codex 安装
    }, // 启动配置结束
    state_db.clone(), // 传入 SQLite 状态库用于保存 enrollment
    auth_manager.clone(), // 传入 ChatGPT 鉴权管理器
    transport_event_tx.clone(), // 传入 App Server 内部 transport 事件通道
    transport_shutdown_token.clone(), // 传入关闭信号
    app_server_client_name_rx, // 传入客户端名称，用于 enrollment 维度隔离
    remote_control_enabled, // 传入初始启用状态
).await?; // 等待远程控制任务启动完成
```

这段代码透露出几个设计取舍。

第一，remote control 依赖 SQLite state DB。原因不是“必须有数据库才能联网”，而是 enrollment 需要被持久化。机器 enroll 以后会拿到 `server_id` 和 `environment_id`，下次重连要复用。

第二，它用的是 ChatGPT auth。`websocket.rs` 里明确拒绝 API key auth：remote control 需要 ChatGPT 账号登录态。这很合理，因为跨设备控制本质上是“账号下的受信任设备”能力，而不是普通 OpenAI API 调用。

第三，本机是主动连接方。无论手机在哪里，电脑都不需要开放公网端口。App Server 通过出站 HTTPS / WSS 连接 ChatGPT relay。

## 4. URL 规范化：只接受 ChatGPT 或本地测试地址

`protocol.rs` 里有一个非常直接的安全边界：remote control URL 不是随便给一个域名就能连。

公开源码会接受：

- `https://chatgpt.com/...`
- `https://*.chatgpt.com/...`
- `https://chatgpt-staging.com/...`
- `https://*.chatgpt-staging.com/...`
- 本地测试用的 `localhost` HTTP / HTTPS

规范化以后，它会拼出两个地址：

```rust
let enroll_url = remote_control_url.join( // 从基础 URL 拼出注册端点
    "wham/remote/control/server/enroll", // 注册本机 remote-control server 的路径
)?; // enroll URL 拼接结束
let websocket_url = remote_control_url.join( // 从基础 URL 拼出 WebSocket 端点
    "wham/remote/control/server", // 远程控制长连接路径
)?; // websocket URL 拼接结束
```

这解释了 relay 的第一层样子：

```text
POST /backend-api/wham/remote/control/server/enroll
WSS  /backend-api/wham/remote/control/server
```

这里的 `/backend-api/` 来自 ChatGPT 后端基础地址，路径后半段由 `normalize_remote_control_url` 拼出来。测试里也能看到同样的期望路径：`/backend-api/wham/remote/control/server/enroll`。

这个限制有两个好处：

- 默认不会把本机 Codex remote control 连到任意第三方 relay。
- 本地开发和测试仍然能用 `localhost` mock relay。

## 5. Enrollment：让云端知道“这台机器是谁”

remote control 建连前先 enroll。`enroll.rs` 里定义了本机发给 relay 的注册请求：

```rust
let request = EnrollRemoteServerRequest { // 构造本机注册到 relay 的请求体
    name: server_name.to_string(), // 上报本机名称，通常来自 hostname
    os: std::env::consts::OS, // 上报操作系统类型
    arch: std::env::consts::ARCH, // 上报 CPU 架构
    app_server_version: env!("CARGO_PKG_VERSION"), // 上报 App Server 版本
    installation_id: installation_id.to_string(), // 上报本机 Codex 安装 ID
}; // 注册请求体构造结束
```

请求还会带上几类 header：

- ChatGPT auth headers。
- `chatgpt-account-id`。
- `x-codex-installation-id`。

云端返回的是：

- `server_id`：relay 侧给这台 remote-control server 分配的 ID。
- `environment_id`：暴露给客户端选择机器 / 环境的 ID。

本机随后把 enrollment 写入 SQLite：

```sql
INSERT INTO remote_control_enrollments ( -- 插入或更新本机远程控制 enrollment
    websocket_url, -- relay websocket 地址
    account_id, -- ChatGPT 账号 ID
    app_server_client_name, -- App Server 客户端名称
    server_id, -- relay 返回的 server ID
    environment_id, -- relay 返回给客户端识别环境的 ID
    server_name, -- 本机名称
    updated_at -- 本地更新时间戳
) VALUES (?, ?, ?, ?, ?, ?, ?) -- SQLite 参数占位
ON CONFLICT(websocket_url, account_id, app_server_client_name) DO UPDATE SET -- 同一账号和客户端名下重复注册时更新
    server_id = excluded.server_id, -- 更新 server ID
    environment_id = excluded.environment_id, -- 更新 environment ID
    server_name = excluded.server_name, -- 更新机器名称
    updated_at = excluded.updated_at; -- 更新时间戳
```

这张表的主键是：

```text
(websocket_url, account_id, app_server_client_name)
```

它说明 Codex 不是只按“机器”维度保存连接，而是至少按 relay 地址、账号、客户端名称三个维度隔离。账号换了，源码会清理内存中的旧 enrollment；WebSocket 返回 404 时，也会认为本地 enrollment 过期并清掉后重新 enroll。

<figure class="fz071" data-reveal role="group" aria-label="Enrollment 与 WebSocket 建连流程：本机 App Server 注册到 ChatGPT Relay 并建立长连接"><style>.fz071{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--ser:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin:0;padding:1.4rem 1.2rem 1.5rem;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;color:var(--ink,#1a1815);font-family:var(--ser);line-height:1.5;box-sizing:border-box}.fz071 *{box-sizing:border-box}.fz071 .hd{margin:0 0 1.2rem}.fz071 .ttl{font-weight:700;font-size:clamp(1.05rem,2.7vw,1.4rem);letter-spacing:.01em;color:var(--ink,#1a1815)}.fz071 .sub{margin-top:.35rem;font-size:clamp(.78rem,1.9vw,.92rem);color:var(--muted,#6a6155)}.fz071 .sub b{font-family:var(--mono);font-style:normal;font-weight:600;color:var(--ink-soft,#3c362c)}.fz071 .stage{display:grid;grid-template-columns:1fr minmax(120px,1.25fr) 1fr;gap:.6rem;align-items:stretch}.fz071 .node{border-radius:14px;padding:.85rem .8rem .95rem;border:1.5px solid;position:relative;display:flex;flex-direction:column}.fz071 .node h3{margin:0 0 .55rem;text-align:center;font-size:clamp(.86rem,2vw,1rem);font-weight:700}.fz071 .local{border-color:#3f6d79;background:#dcebed}.fz071 .local h3{color:#3f6d79}.fz071 .relay{background:#e7eedd;border-color:#4f7233}.fz071 .relay h3{color:#4f7233}.fz071 .meta{list-style:none;margin:0 0 .7rem;padding:0;display:flex;flex-direction:column;gap:.22rem}.fz071 .meta li{font-family:var(--mono);font-size:clamp(.66rem,1.5vw,.76rem);color:var(--ink-soft,#3c362c);padding-left:.8rem;position:relative}.fz071 .meta li::before{content:"";position:absolute;left:0;top:.45em;width:5px;height:5px;border-radius:50%;background:#8fbcc4}.fz071 .card{margin-top:auto;background:#faf6ec;border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:10px;padding:.5rem .55rem;display:flex;flex-direction:column;gap:.18rem}.fz071 .card .ct{font-family:var(--mono);font-size:clamp(.66rem,1.5vw,.76rem);font-weight:600;color:var(--ink,#1a1815)}.fz071 .card .cl{font-family:var(--mono);font-size:clamp(.62rem,1.4vw,.72rem);color:var(--muted,#6a6155)}.fz071 .card .cl b{font-style:normal;color:#3f6d79;font-weight:600}.fz071 .relay .card{border-color:rgba(79,114,51,.3)}.fz071 .relay .card .cl b{color:#4f7233}.fz071 .db{position:relative;overflow:hidden}.fz071 .db::after{content:"";position:absolute;inset:0;border-radius:10px;border:1.5px solid #8fbcc4;opacity:0;animation:fzwrite 9s ease-in-out infinite}.fz071 .mid{display:flex;flex-direction:column;justify-content:center;gap:.95rem;padding:.3rem 0}.fz071 .flow{position:relative}.fz071 .flow .lbl{font-size:clamp(.62rem,1.45vw,.74rem);color:var(--muted,#6a6155);text-align:center;margin-bottom:.28rem;line-height:1.3}.fz071 .flow .lbl b{font-style:normal;font-family:var(--mono);font-weight:600;color:var(--ink-soft,#3c362c)}.fz071 .wire{position:relative;height:8px;border-radius:6px;background:rgba(63,109,121,.14);overflow:hidden}.fz071 .wire::before{content:"";position:absolute;top:0;bottom:0;width:38%;border-radius:6px;background:linear-gradient(90deg,transparent,#3f6d79,transparent);opacity:.85}.fz071 .wire.r2::before{background:linear-gradient(90deg,transparent,#4f7233,transparent)}.fz071 .wire.r3{background:rgba(63,109,121,.1);background-image:repeating-linear-gradient(90deg,rgba(63,109,121,.32) 0 8px,transparent 8px 18px)}.fz071 .wire.r3::before{background:linear-gradient(90deg,transparent,#3f6d79,transparent)}.fz071 .tip{position:absolute;top:50%;width:0;height:0;border-style:solid;transform:translateY(-50%)}.fz071 .r1 .tip,.fz071 .r3 .tip{right:-1px;border-width:6px 0 6px 9px;border-color:transparent transparent transparent #3f6d79}.fz071 .r2 .tip{left:-1px;border-width:6px 9px 6px 0;border-color:transparent #4f7233 transparent transparent}.fz071 .r1 .wire::before{animation:fzL2R 4.2s linear infinite}.fz071 .r2 .wire::before{animation:fzR2L 4.2s linear infinite;animation-delay:1.4s}.fz071 .r3 .wire::before{animation:fzL2R 5s linear infinite;animation-delay:2.8s}.fz071 .recover{margin:1.15rem auto 0;max-width:520px;background:#f4e8cc;border:1.5px solid #d9b66a;border-radius:12px;padding:.6rem .8rem;text-align:center;animation:fzbreath 8s ease-in-out infinite}.fz071 .recover .rt{font-weight:700;font-size:clamp(.84rem,1.9vw,.98rem);color:#9a6516}.fz071 .recover .rd{margin-top:.2rem;font-size:clamp(.68rem,1.6vw,.8rem);color:var(--ink-soft,#3c362c)}.fz071 .recover .rd b{font-style:normal;font-family:var(--mono);font-weight:600;color:#9a6516}@keyframes fzL2R{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}@keyframes fzR2L{0%{transform:translateX(360%)}100%{transform:translateX(-120%)}}@keyframes fzwrite{0%,55%,100%{opacity:0}68%,86%{opacity:1}}@keyframes fzbreath{0%,100%{box-shadow:0 0 0 0 rgba(217,182,106,0)}50%{box-shadow:0 0 0 4px rgba(217,182,106,.28)}}.fz071[data-reveal] .node,.fz071[data-reveal] .recover{opacity:1}@media (max-width:560px){.fz071 .stage{grid-template-columns:1fr;gap:.7rem}.fz071 .mid{order:2}.fz071 .relay{order:3}.fz071 .wire::before{width:46%}.fz071 .r1 .wire::before,.fz071 .r2 .wire::before,.fz071 .r3 .wire::before{animation-name:fzL2R}}@media (prefers-reduced-motion:reduce){.fz071 .wire::before,.fz071 .db::after,.fz071 .recover{animation:none!important}.fz071 .wire::before{transform:none;left:0;right:auto;width:100%;opacity:.55}.fz071 .db::after{opacity:1}.fz071 .recover{box-shadow:0 0 0 3px rgba(217,182,106,.3)}}</style><div class="hd"><div class="ttl">Enrollment：把本机登记为一个可被选择的环境</div><div class="sub">本机先拿 <b>server_id</b> / <b>environment_id</b>，再用它们建立 WebSocket 长连接。</div></div><div class="stage"><div class="node local"><h3>本机 App Server</h3><ul class="meta"><li>ChatGPT auth</li><li>installation_id</li><li>server_name</li><li>os / arch / version</li></ul><div class="card db"><span class="ct">SQLite enrollment</span><span class="cl"><b>server_id</b></span><span class="cl"><b>environment_id</b></span></div></div><div class="mid"><div class="flow r1"><div class="lbl">POST enroll：机器名称、版本、安装 ID、账号鉴权</div><div class="wire"><span class="tip"></span></div></div><div class="flow r2"><div class="lbl">返回 <b>server_id</b> / <b>environment_id</b></div><div class="wire r2"><span class="tip"></span></div></div><div class="flow r3"><div class="lbl">WSS 建连：<b>server_id</b>、protocol_version、account_id、cursor</div><div class="wire r3"><span class="tip"></span></div></div></div><div class="node relay"><h3>ChatGPT Relay</h3><div class="card"><span class="ct">/server/enroll</span><span class="cl">返回 <b>server_id</b></span></div><div class="card" style="margin-top:.6rem"><span class="ct">/server</span><span class="cl">WebSocket 长连接</span></div></div></div><div class="recover"><div class="rt">断线恢复</div><div class="rd">重连时携带 <b>subscribe cursor</b> 与未 <b>ack</b> 缓存</div></div></figure>

## 6. WebSocket：relay 不是一次请求，而是一条可恢复的数据通道

Enrollment 之后，本机 App Server 会向 relay 建立 WebSocket。

建连请求会带这些 header：

- `x-codex-server-id`：enrollment 得到的 server ID。
- `x-codex-name`：base64 编码后的机器名称。
- `x-codex-protocol-version`：公开源码里当前是 `3`。
- ChatGPT auth headers。
- `chatgpt-account-id`。
- `x-codex-installation-id`。
- `x-codex-subscribe-cursor`：可选，用于断线后从上次 cursor 继续订阅。

可以把它理解成：

```rust
set_header("x-codex-server-id", enrollment.server_id); // 告诉 relay 当前连接属于哪个已注册 server
set_header("x-codex-protocol-version", "3"); // 告诉 relay 使用 remote-control 协议版本 3
set_header("chatgpt-account-id", auth.account_id); // 告诉 relay 当前 ChatGPT 账号 ID
set_header("x-codex-installation-id", installation_id); // 告诉 relay 当前本机安装 ID
set_header("x-codex-subscribe-cursor", cursor); // 断线重连时携带订阅游标
```

真正跑起来以后，`websocket.rs` 里分成两个循环：

- writer：把本机 App Server 产生的 server event 发到 relay。
- reader：从 relay 读取远端客户端发来的 client event。

writer 侧有一个 `BoundedOutboundBuffer`。它按 `(client_id, stream_id)` 缓存已经发出但还没被远端 ack 的 `ServerEnvelope`。如果 WebSocket 断了，重连后会先把未确认的 envelope 重新发出去。

reader 侧会处理几种消息：

| 类型 | 含义 |
| --- | --- |
| `ClientMessage` | 一个完整 JSON-RPC 消息 |
| `ClientMessageChunk` | 一个被分片的 JSON-RPC 消息片段 |
| `Ack` | 远端确认已经收到某个 server envelope |
| `Ping` | 远端保活 |
| `ClientClosed` | 远端关闭客户端流 |

这就是 relay 比普通 HTTP 转发复杂的地方：它要承受移动端网络切换、Web 页面刷新、消息较大、连接重建等情况。源码里因此有 seq、cursor、ack、chunk、ping/pong 和指数退避重连。

## 7. 分片与 ack：为什么需要自己做一层 envelope

App Server 的事件有时会很大，例如：

- 一段较长的终端输出。
- 大 diff。
- 多个 item 的历史恢复。
- 含 base64 内容的文件或进程输出事件。

`segment.rs` 里设置了几个上限：

| 常量 | 数值 | 含义 |
| --- | --- | --- |
| `REMOTE_CONTROL_SEGMENT_TARGET_BYTES` | 100 KB | 目标分片大小 |
| `REMOTE_CONTROL_SEGMENT_MAX_BYTES` | 150 KB | 单个分片最大 wire size |
| `REMOTE_CONTROL_REASSEMBLED_MAX_BYTES` | 100 MB | 重组后的消息最大大小 |
| `REMOTE_CONTROL_SEGMENT_COUNT_MAX` | 1024 | 单条消息最多分片数 |

服务端发给 relay 的 envelope 也带 seq：

```rust
let server_envelope = ServerEnvelope { // 构造一条发往远端客户端的服务端 envelope
    event: queued_server_envelope.event, // 包装 App Server 要发出的实际消息
    client_id: queued_server_envelope.client_id, // 指定目标远端客户端
    stream_id: queued_server_envelope.stream_id, // 指定目标客户端流
    seq_id, // 指定当前流上的递增序号
}; // 服务端 envelope 构造结束
```

远端客户端收到后会回 ack。本机收到 ack 后，从 outbound buffer 删除已经确认的 envelope：

```rust
buffer.retain(|server_envelope| { // 遍历当前 stream 中缓存的已发送 envelope
    let envelope_cursor = cursor_of(server_envelope); // 计算这条 envelope 对应的确认游标
    let is_acked = envelope_cursor <= acked_cursor; // 判断是否已经被远端确认
    !is_acked // 只保留尚未确认的 envelope
}); // 出站缓存清理结束
```

这套机制不是为了“加密”，加密由 HTTPS / WSS 和账号鉴权承担；它主要解决可靠传输和断线恢复。

## 8. ClientTracker：远端客户端如何变成本地连接

`client_tracker.rs` 是理解 remote control 的关键。

relay 发来的消息不是直接喂给某个线程，而是先带着：

- `client_id`
- `stream_id`
- `seq_id`
- `event`

本机会用 `(client_id, stream_id)` 作为一个远端连接的 key。第一次看到 `initialize` 这类启动连接的消息时，它会在 App Server 内部创建一个新的 connection：

```rust
let connection_id = next_connection_id(); // 为这个远端 stream 分配本机连接 ID
self.send_transport_event( // 向 App Server 主循环发送 transport 事件
    TransportEvent::ConnectionOpened { // 表示新连接已经打开
        connection_id, // 本机连接 ID
        origin: ConnectionOrigin::RemoteControl, // 标记来源是 remote control
        writer: writer_tx, // 连接的出站写通道
        disconnect_sender: Some(disconnect_token), // 连接断开信号
    }, // ConnectionOpened 事件结束
).await?; // 等待事件成功送入 App Server
```

之后同一个 `(client_id, stream_id)` 上的 `ClientMessage` 会被转成：

```rust
TransportEvent::IncomingMessage { // 表示某个连接收到一条 JSON-RPC 消息
    connection_id, // 对应刚才创建的本机连接 ID
    message, // 远端客户端发来的 JSON-RPC 消息
} // IncomingMessage 事件结束
```

App Server 主循环收到以后，走的就是普通 `MessageProcessor`：

- `initialize` 完成握手。
- `thread/start` 创建线程。
- `turn/start` 开始一轮 Codex 执行。
- `turn/interrupt` 中断执行。
- `remoteControl/status/read` 读取远程控制状态。
- 各种 `item/*`、`turn/*`、`command/*` 通知再沿反方向发回远端客户端。

这一步非常重要：**remote control 没有另写一套“手机专用 Codex 协议”，而是把手机 / Web 端接成 App Server 的另一个 JSON-RPC 客户端。**

<figure class="fz072" data-reveal role="group" aria-label="ClientTracker 把远端 stream 映射成本机 App Server 的 JSON-RPC 连接示意图"><style>.fz072{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:1.4rem 1.2rem 1.5rem;background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;box-sizing:border-box;line-height:1.5;overflow:hidden}.fz072 *{box-sizing:border-box}.fz072 .ttl{font-size:1.12rem;font-weight:700;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz072 .sub{margin-top:.35rem;font-size:.84rem;color:var(--muted,#6a6155);max-width:46rem}.fz072 .stage{margin-top:1.15rem;display:flex;flex-direction:column;gap:.2rem}.fz072 .row{display:flex;align-items:stretch;gap:.45rem;flex-wrap:nowrap}.fz072 .node{flex:1 1 0;min-width:0;border-radius:13px;padding:.7rem .7rem .75rem;border:1.5px solid var(--hair);background:var(--paper-deep,#ece5d5);position:relative;animation:fz072pop 9s ease-in-out infinite}.fz072 .node .nh{font-weight:700;font-size:.92rem;text-align:center;margin-bottom:.5rem;letter-spacing:.01em}.fz072 .node small{display:block;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.72rem;color:var(--ink-soft,#3c362c);padding:.13rem 0;border-top:1px dotted var(--hair)}.fz072 .node small:first-of-type{border-top:none}.fz072 .node .pp{font-family:var(--font-serif-body,"Songti SC",Georgia,serif)}.fz072 .nEnv{background:#e7eef8;border-color:#7d9dc4}.fz072 .nEnv .nh{color:#33507a}.fz072 .nTrk{background:#f4e8cc;border-color:#d9b66a}.fz072 .nTrk .nh{color:#9a6516}.fz072 .nEvt{background:#e7eedd;border-color:#7c9c54}.fz072 .nEvt .nh{color:#4f7233}.fz072 .nProc{background:#ece4d2;border-color:#917f5c}.fz072 .nProc .nh{color:#5e5236}.fz072 .nCore{background:#dcebed;border-color:#8fbcc4}.fz072 .nCore .nh{color:#3f6d79}.fz072 .nTrk{animation-delay:.5s}.fz072 .nEvt{animation-delay:1s}.fz072 .nProc{animation-delay:1.5s}.fz072 .nCore{animation-delay:2s}@keyframes fz072pop{0%,100%{box-shadow:0 1px 0 rgba(0,0,0,.03)}45%{box-shadow:0 4px 14px rgba(26,24,21,.1)}}.fz072 .conn{flex:0 0 30px;align-self:center;position:relative;height:18px}.fz072 .conn .ln{position:absolute;top:50%;left:0;right:7px;height:3px;transform:translateY(-50%);background:#c8bda2;border-radius:2px;overflow:hidden}.fz072 .conn .ln::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,#3f6d79,transparent);animation:fz072flow 3.4s linear infinite}.fz072 .conn .tip{position:absolute;top:50%;right:0;transform:translateY(-50%);width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid #3f6d79}.fz072 .conn:nth-of-type(4) .ln::after{animation-delay:1.1s}.fz072 .cap{position:absolute;top:-1.1rem;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:.66rem;color:var(--muted,#6a6155);font-family:var(--font-mono,ui-monospace,monospace)}@keyframes fz072flow{0%{left:-40%}100%{left:110%}}.fz072 .down{margin:1.5rem 0 0;display:flex;justify-content:center;flex-direction:column;align-items:center}.fz072 .varrow{position:relative;width:3px;height:30px;background:#c8bda2;border-radius:2px;overflow:hidden}.fz072 .varrow::after{content:"";position:absolute;left:0;top:-50%;width:100%;height:50%;background:linear-gradient(180deg,transparent,#3f6d79,transparent);animation:fz072flowv 3.4s linear infinite}@keyframes fz072flowv{0%{top:-50%}100%{top:110%}}.fz072 .vtip{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #3f6d79;margin-top:-1px}.fz072 .vcap{font-size:.66rem;color:var(--muted);font-family:var(--font-mono,monospace);margin-bottom:.3rem}.fz072 .row2{margin-top:.55rem;display:flex;align-items:stretch;gap:.45rem;justify-content:center}.fz072 .row2 .node{flex:1 1 0;max-width:18rem}.fz072 .row2 .conn{flex:0 0 30px}.fz072 .back{margin-top:1rem;position:relative;border:1.5px dashed #d9b66a;background:linear-gradient(90deg,rgba(244,232,204,.6),rgba(244,232,204,.25));border-radius:11px;padding:.55rem .8rem .55rem 2rem;font-size:.78rem;color:#7a5212;overflow:hidden}.fz072 .back b{color:#9a6516}.fz072 .back::before{content:"";position:absolute;left:.7rem;top:50%;transform:translateY(-50%);width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:8px solid #9a6516}.fz072 .back::after{content:"";position:absolute;left:-30%;top:0;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(154,101,22,.18),transparent);animation:fz072back 6.5s ease-in-out infinite}@keyframes fz072back{0%{left:110%}55%,100%{left:-40%}}.fz072 .legend{margin-top:.85rem;font-size:.72rem;color:var(--muted);display:flex;flex-wrap:wrap;gap:.2rem .9rem}.fz072 .legend span{display:inline-flex;align-items:center;gap:.3rem}.fz072 .legend i{width:.62rem;height:.62rem;border-radius:3px;display:inline-block;border:1px solid var(--hair)}@media(max-width:560px){.fz072 .row{flex-direction:column;gap:1.25rem}.fz072 .conn{flex:0 0 22px;width:100%;height:22px;transform:rotate(90deg)}.fz072 .conn .cap{transform:translateX(-50%) rotate(-90deg);top:50%;left:50%;margin-top:-.1rem}.fz072 .row2{flex-direction:column;align-items:center}.fz072 .row2 .conn{transform:rotate(90deg)}.fz072 .node{width:100%}}@media(prefers-reduced-motion:reduce){.fz072 .node,.fz072 .conn .ln::after,.fz072 .varrow::after,.fz072 .back::after{animation:none!important}.fz072 .conn .ln::after,.fz072 .varrow::after,.fz072 .back::after{opacity:0}}</style><div class="ttl">ClientTracker：远端 stream 变成本机 JSON-RPC 连接</div><div class="sub">手机端的消息不是直接执行，而是先被映射成 App Server 的普通连接。</div><div class="stage"><div class="row"><div class="node nEnv"><div class="nh">ClientEnvelope</div><small>client_id</small><small>stream_id</small><small>ClientMessage</small></div><div class="conn"><span class="cap">按 stream 建连接</span><span class="ln"></span><span class="tip"></span></div><div class="node nTrk"><div class="nh">ClientTracker</div><small class="pp">分配 connection_id</small><small class="pp">维护 idle timeout</small></div><div class="conn"><span class="cap">送入 App Server</span><span class="ln"></span><span class="tip"></span></div><div class="node nEvt"><div class="nh">TransportEvent</div><small>ConnectionOpened</small><small>IncomingMessage</small></div></div><div class="down"><div class="vcap">普通 JSON-RPC 请求</div><div class="varrow"></div><div class="vtip"></div></div><div class="row2"><div class="node nProc"><div class="nh">MessageProcessor</div><small class="pp">initialize</small><small class="pp">thread/start</small><small class="pp">turn/start</small></div><div class="conn"><span class="ln"></span><span class="tip"></span></div><div class="node nCore"><div class="nh">Codex Core</div><small class="pp">工具调用</small><small class="pp">审批 / 沙箱</small><small class="pp">事件落盘</small></div></div></div><div class="back"><b>item/started、diff、终端输出、turn/completed</b> 再回到远端</div><div class="legend"><span><i style="background:#e7eef8;border-color:#7d9dc4"></i>远端 envelope</span><span><i style="background:#f4e8cc;border-color:#d9b66a"></i>映射层</span><span><i style="background:#e7eedd;border-color:#7c9c54"></i>本机 transport 事件</span><span><i style="background:#ece4d2;border-color:#917f5c"></i>App Server 处理</span><span><i style="background:#dcebed;border-color:#8fbcc4"></i>Codex 执行 / 权限</span></div></figure>

## 9. 安全边界：能确认的和不能确认的

从公开源码能确认的安全边界包括：

第一，本机不需要开放公网端口。remote control 是本机 App Server 主动连 ChatGPT relay。

第二，远程控制 URL 有 host allowlist。正常只接受 ChatGPT / staging 域名，本地测试只接受 localhost。

第三，它要求 ChatGPT auth，不支持 API key auth。源码里如果检测到 API key 模式，会返回“remote control requires ChatGPT authentication”。

第四，enrollment 按账号、relay 地址和客户端名称持久化。本机账号切换、WebSocket 404、认证失败都会触发清理或恢复流程。

第五，App Server 仍然保留原有的权限、审批、沙箱和事件模型。remote control 是 transport，不是绕过 Codex harness 的后门。

第六，`remoteControl/disable` 是关闭当前 App Server 进程的 remote control。官方 README 也说明它不会撤销已经 enroll 的控制设备。这意味着真正的设备撤销、账号管理和安全策略，大概率还在云端服务侧。

不能从公开源码确认的部分包括：

- ChatGPT relay 服务端如何保存 server / client 映射。
- 手机端如何展示可连接机器列表。
- 设备授权、过期、撤销和风控策略。
- 多端同时连接同一台机器时的产品级冲突处理。
- 企业策略、合规日志和数据驻留策略在 relay 层的具体实现。

这些部分只能说“从客户端协议可以推测需要存在”，不能当作源码事实。

## 10. 如果自己实现类似能力，架构会长什么样

如果抛开 Codex 的私有云端服务，自己要实现一个“手机控制本机 agent”的系统，公开源码给出的参考架构很清楚：

1. 本机 agent 启动一个本地 server，统一抽象任务、事件、审批和文件操作。
2. 本机 agent 用账号登录态主动 enroll 到云端 relay。
3. 云端 relay 返回 server id / environment id，并把这台机器挂到用户账号下。
4. 本机 agent 建立出站 WebSocket，并持续订阅发给自己的客户端消息。
5. 手机或 Web 端通过同一账号连接 relay，选择某个 environment。
6. relay 把手机端 JSON-RPC 消息包成 client envelope 转给本机。
7. 本机把它映射成本地 server 的连接和请求。
8. 本地执行结果、状态、diff、终端输出再包成 server envelope 发回 relay。
9. relay 转给手机端，并用 seq / ack / cursor 处理断线恢复。
10. 所有高风险动作仍然由本地 server 的权限系统和审批流控制。

这个架构最值得学的一点是：**不要让远端入口直接拥有真实执行权，而是让它接入同一个受控 harness。**

也就是说，relay 只是让消息能跨网络抵达；真正决定“能不能读文件、能不能跑命令、要不要审批”的，仍然是本机 App Server 和 Codex core。

## 11. 小结

回到最开始的问题：Codex App 可以和 PC / Mac 版连接，云端 relay 到底是什么意思？

从公开源码看，它可以拆成一句话：

**本机 Codex App Server 用 ChatGPT 账号主动 enroll 到 ChatGPT relay，建立一条带 seq、ack、cursor、分片和重连能力的 WebSocket；手机或 Web 端通过 relay 发来的消息，被本机映射成普通 App Server JSON-RPC 连接，最后仍由本机 Codex harness 执行任务。**

这套设计的几个关键词是：

- 出站连接，而不是公网入站端口。
- 账号级 enrollment，而不是裸 socket。
- JSON-RPC 事件流，而不是屏幕远程桌面。
- App Server 复用，而不是手机专用 agent。
- relay 负责转发，harness 负责权限。

所以能找到源码吗？

答案是：**能找到本机侧 remote-control 实现；找不到云端 relay 服务端完整源码。**

但就理解实现原理而言，公开的这部分已经足够说明产品骨架：Codex 远程控制的关键不在“手机怎么神奇地摸到电脑”，而在“所有界面都接入同一个本机 App Server，再由云端 relay 把跨设备消息转过去”。

## 参考资料

- [Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)
- [Unlocking Codex with the App Server](https://openai.com/index/unlocking-the-codex-harness/)
- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [openai/codex 仓库](https://github.com/openai/codex)
- [`remote_control` 源码目录](https://github.com/openai/codex/tree/80fdd4688f6fa8143488c206d4c14dc193905254/codex-rs/app-server-transport/src/transport/remote_control)
- [`app-server` README](https://github.com/openai/codex/blob/80fdd4688f6fa8143488c206d4c14dc193905254/codex-rs/app-server/README.md)
