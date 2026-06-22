---
title: "Codex CLI 接入飞书机器人：让阿里云做入口，Mac 跑 Agent"
date: 2026-05-16 15:50:00
categories:
  - 技术
tags:
  - Codex
  - Feishu
  - Lark
  - Agent
  - CLI
  - 自动化
excerpt: "从一次真实搭建出发，拆解如何用飞书事件回调、阿里云公网 hub、Mac worker、lark-cli 和 codex exec，把群聊消息变成可续聊的本机 Codex 任务。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

这篇文章记录一次真实搭建：把飞书机器人接到本机 `Codex CLI`，让群聊里的一条消息可以触发 Mac 上的 `codex exec`，Codex 跑完以后再把结果回复到飞书消息下面。

先给结论：这件事的核心不是“让飞书直接控制 Codex App”，而是在飞书和 Codex CLI 中间放一层很薄的桥接服务。最开始可以用 Cloudflare Tunnel 直连本机调试；长期使用时，我更推荐让阿里云只做公网入口，真正的 Codex 仍然跑在自己的 Mac 上。

现在这套服务做五件事：

1. 接收飞书开放平台推送的消息事件。
2. 校验事件来源，过滤未授权的群、用户和消息类型。
3. 在阿里云 hub 里把消息排成任务队列。
4. 由 Mac worker 主动拉任务，变成一次 `codex exec` 或 `codex exec resume` 非交互任务。
5. 用 `lark-cli` 或飞书 OpenAPI 把 Codex 的最终回复发回飞书。

最终效果是：

- 你在飞书里 @ 机器人发任务。
- 飞书把事件 POST 到阿里云上的稳定 HTTPS 地址。
- 阿里云 hub 校验事件并把任务写入队列。
- Mac worker 主动拉任务，不需要暴露本机端口。
- worker 启动一个 `codex exec` 子进程，让 Codex 在指定仓库里干活。
- 结果自动回到飞书消息下面。
- 同一个群里的后续消息可以接到同一个 Codex session。

<figure class="fz066" data-reveal role="group" aria-label="飞书机器人触发 Codex 的角色分工：飞书入口、阿里云队列、Mac 执行、Codex 留在本机"><style>.fz066{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3.2vw,30px);margin:0;box-sizing:border-box;overflow:hidden}.fz066 *{box-sizing:border-box}.fz066 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz066 .h1{font-size:clamp(17px,2.7vw,25px);font-weight:800;line-height:1.32;letter-spacing:.2px;color:var(--ink,#1a1815)}.fz066 .h2{margin-top:7px;font-size:clamp(12px,1.65vw,15px);color:var(--muted,#6a6155);line-height:1.5}.fz066 .flow{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;justify-content:center}.fz066 .node{flex:1 1 180px;min-width:140px;border-radius:16px;padding:clamp(12px,1.8vw,17px) clamp(12px,1.7vw,16px);border:1px solid;position:relative;display:flex;flex-direction:column;gap:9px;opacity:0;transform:translateY(10px);animation:fz066rise .8s ease forwards}.fz066 .node:nth-child(1){animation-delay:.15s}.fz066 .node:nth-child(3){animation-delay:.55s}.fz066 .node:nth-child(5){animation-delay:.95s}.fz066 .node:nth-child(7){animation-delay:1.35s}.fz066 .nt{font-weight:800;font-size:clamp(14px,1.9vw,18px);letter-spacing:.3px}.fz066 .sub{display:flex;flex-direction:column;gap:5px}.fz066 .sub span{font-size:clamp(11px,1.45vw,13.5px);color:var(--ink-soft,#3c362c);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);padding-left:13px;position:relative;line-height:1.4}.fz066 .sub span:before{content:"";position:absolute;left:0;top:.52em;width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.55}.fz066 .n1{background:var(--g-bg,#e7eedd);border-color:var(--g-line,#7c9c54);color:#4f7233}.fz066 .n2{background:var(--c-bg,#dcebed);border-color:var(--c-line,#8fbcc4);color:#3f6d79}.fz066 .n3{background:var(--a-bg,#f4e8cc);border-color:var(--a-line,#d9b66a);color:#9a6516}.fz066 .n4{background:var(--p-bg,#e6e7f3);border-color:var(--p-line,#a9adcf);color:#54579a}.fz066 .node .sub span{color:var(--ink-soft,#3c362c)}.fz066 .arr{flex:0 0 46px;align-self:center;height:30px;position:relative;display:flex;align-items:center;justify-content:center;min-width:34px;opacity:0;animation:fz066afade .8s ease forwards}.fz066 .arr:nth-of-type(2){animation-delay:.45s}.fz066 .arr:nth-of-type(4){animation-delay:.85s}.fz066 .arr:nth-of-type(6){animation-delay:1.25s}.fz066 .arr .ln{position:relative;width:100%;height:4px;border-radius:3px;background:linear-gradient(90deg,var(--hair,rgba(26,24,21,.18)),var(--ink-soft,#3c362c) 50%,var(--hair,rgba(26,24,21,.18)));overflow:hidden}.fz066 .arr .ln:after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(250,246,236,.9),transparent);animation:fz066stream 4.5s linear infinite}.fz066 .arr .tip{position:absolute;right:-1px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:11px solid var(--ink-soft,#3c362c)}.fz066 .bound{margin-top:clamp(16px,2.6vw,24px);background:linear-gradient(150deg,#fff,var(--paper-soft,#faf6ec));border:1px solid var(--hair,rgba(26,24,21,.18));border-left:4px solid #8f2d20;border-radius:14px;padding:clamp(13px,2vw,18px) clamp(15px,2.3vw,22px);opacity:0;transform:translateY(8px);animation:fz066rise .9s ease 1.7s forwards}.fz066 .bt{font-weight:800;font-size:clamp(13px,1.8vw,16px);color:#8f2d20;margin-bottom:8px;letter-spacing:.4px}.fz066 .bl{font-size:clamp(11.5px,1.55vw,14px);color:var(--ink-soft,#3c362c);line-height:1.6;display:flex;align-items:flex-start;gap:8px}.fz066 .bl+.bl{margin-top:5px}.fz066 .bl b{color:#8f2d20;flex:0 0 auto;font-weight:700}@keyframes fz066rise{to{opacity:1;transform:translateY(0)}}@keyframes fz066afade{to{opacity:1}}@keyframes fz066stream{0%{left:-40%}100%{left:120%}}@media(max-width:560px){.fz066 .flow{flex-direction:column}.fz066 .node{flex:1 1 auto;width:100%}.fz066 .arr{width:30px;height:34px;transform:rotate(90deg);margin:2px 0}}@media (prefers-reduced-motion:reduce){.fz066 .node,.fz066 .arr,.fz066 .bound{animation:none!important;opacity:1!important;transform:none!important}.fz066 .arr .ln:after{animation:none!important;display:none}}</style><div class="hd"><div class="h1">这不是把 App 搬进飞书，而是拆出公网入口和本机执行</div><div class="h2">飞书负责入口，阿里云负责队列，Mac worker 负责执行，Codex CLI 留在本机。</div></div><div class="flow"><div class="node n1"><div class="nt">飞书机器人</div><div class="sub"><span>消息事件</span><span>机器人回复</span></div></div><div class="arr"><div class="ln"></div><div class="tip"></div></div><div class="node n2"><div class="nt">阿里云 hub</div><div class="sub"><span>稳定 HTTPS</span><span>验签与排队</span></div></div><div class="arr"><div class="ln"></div><div class="tip"></div></div><div class="node n3"><div class="nt">Mac worker</div><div class="sub"><span>主动拉任务</span><span>续聊与回复</span></div></div><div class="arr"><div class="ln"></div><div class="tip"></div></div><div class="node n4"><div class="nt">Codex CLI</div><div class="sub"><span>exec 子进程</span><span>仓库内执行</span></div></div></div><div class="bound"><div class="bt">关键边界</div><div class="bl"><b>·</b><span>飞书不直接执行命令，阿里云不直接跑 Codex。</span></div><div class="bl"><b>·</b><span>Mac 主动拉任务后再启动子进程，本机端口不暴露公网。</span></div></div></figure>

这篇不是泛泛讲“理论上可以怎么做”，而是按我实际跑通并继续迭代的版本来写。本文用到的关键工具是：

| 组件 | 作用 |
| --- | --- |
| 飞书开放平台机器人 | 提供消息入口、事件订阅和机器人回复能力 |
| 阿里云 ECS / 公网 hub | 提供稳定 HTTPS 回调地址，接事件、验签、排队 |
| Mac worker | 主动 poll hub，拿任务后在本机执行 Codex |
| Cloudflare Tunnel | 本地开发时可选，用来快速验证 `localhost` 回调 |
| Node.js 桥接服务 | 同一份代码支持 `local`、`hub`、`worker` 三种模式 |
| `codex exec` | 在本机以非交互方式执行一次 Codex 任务 |
| `codex exec resume` | 把下一条消息续到已有非交互 session |
| `lark-cli` | 在 worker 回复模式下复用本机登录态，以机器人身份回复飞书消息 |

这次实战的最后一步，是把飞书开放平台里的应用展示名从最初的“飞书 CLI”改成了 **Codex**，并发布了 `1.0.3` 版本。这个动作很重要：飞书后台保存只是草稿，只有创建并发布新版本以后，客户端里的机器人名称才会真正生效。

## 1. 为什么不用“飞书直接连 Codex App”

一开始最容易想到的是：能不能让飞书消息直接出现在 Codex App 里，像普通对话一样显示？

现阶段更稳的做法不是这样。

Codex App 是桌面工作台，适合人直接对话、看计划、看 diff、操作浏览器和桌面。飞书机器人触发的这类任务，更像后台自动化：一条消息进来，服务启动一个子进程，任务结束后拿最终结果。对应的入口是 `codex exec`。

这两者的差别可以先这样理解：

| 入口 | 更像什么 | 适合场景 |
| --- | --- | --- |
| Codex App 普通会话 | 人和 Agent 共享的桌面工作台 | 复杂改动、人工 review、浏览器验证、需要你持续介入的任务 |
| `codex exec` | 一次独立的非交互执行 | webhook、CI、机器人、脚本、定时任务 |
| `codex exec resume` | 续上一次非交互执行 | 同一个飞书群里连续追问、补充需求、让 Codex 接着做 |

这里的“非交互”不是说 Codex 没有上下文，而是说它不会打开 TUI，也不会在执行中等你手动输入。它从 stdin 收到 prompt，自己跑完，把最后一条回复写到文件或 stdout，然后进程退出。

如果你想回到终端里看这个 session，可以用：

```bash
codex resume --include-non-interactive <session-id> # 在交互式 Codex CLI 里打开非交互 session
```

但不要默认认为 Codex App 会像普通聊天一样自动展示这段飞书触发的过程。更靠谱的产品形态是：飞书负责触发和通知，Codex CLI 负责执行，必要时再用 session id 回到 CLI 里查看。

## 2. 总体架构：阿里云做入口，Mac 做执行器

完整链路如下。

<figure class="fz067" data-reveal role="group" aria-label="一条飞书消息从群聊@机器人、飞书推事件、hub验签排队，回折到Mac worker拉任务、本机Codex执行、再回复飞书的完整链路图"><style>.fz067{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gn:#4f7233;--gnb:#e7eedd;--gnl:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;--pp:#54579a;--ppb:#e6e7f3;--ppe:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));color:var(--ink,#1a1815);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3vw,30px);margin:0;box-sizing:border-box;max-width:100%;overflow:hidden}.fz067 *{box-sizing:border-box}.fz067 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz067 .t1{font-size:clamp(17px,2.5vw,25px);font-weight:800;letter-spacing:.01em;line-height:1.35;color:var(--ink,#1a1815)}.fz067 .t2{margin-top:.5em;font-size:clamp(12px,1.5vw,15px);color:var(--muted,#6a6155);line-height:1.55}.fz067 .t2 b{color:var(--am);font-weight:700}.fz067 .row{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(10px,1.6vw,20px);align-items:stretch;position:relative}.fz067 .row+.row{margin-top:clamp(34px,5vw,52px)}.fz067 .node{position:relative;border-radius:14px;padding:clamp(12px,1.8vw,18px) clamp(13px,1.8vw,18px);border:1px solid var(--hair);background:var(--paper-soft,#faf6ec);min-height:96px;display:flex;flex-direction:column;justify-content:center;opacity:.55;transform:translateY(6px);animation:fz067pop 9s ease-in-out infinite}.fz067 .num{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:11px;font-weight:700;opacity:.8;letter-spacing:.06em}.fz067 .ttl{font-size:clamp(14px,1.9vw,19px);font-weight:800;margin-top:.18em;line-height:1.3}.fz067 .sub{margin-top:.4em;font-size:clamp(11px,1.4vw,13px);color:var(--ink-soft,#3c362c);font-family:var(--font-mono,ui-monospace,monospace);line-height:1.5;word-break:break-word}.fz067 .n1{background:var(--gnb);border-color:var(--gnl);animation-delay:0s}.fz067 .n1 .num,.fz067 .n1 .ttl{color:var(--gn)}.fz067 .n2{background:var(--cyb);border-color:var(--cye);animation-delay:.5s}.fz067 .n2 .num,.fz067 .n2 .ttl{color:var(--cy)}.fz067 .n3{background:var(--amb);border-color:var(--ame);animation-delay:1s}.fz067 .n3 .num,.fz067 .n3 .ttl{color:var(--am)}.fz067 .n4{background:var(--ppb);border-color:var(--ppe);animation-delay:2s}.fz067 .n4 .num,.fz067 .n4 .ttl{color:var(--pp)}.fz067 .n5{background:var(--rdb);border-color:var(--rde);animation-delay:2.5s}.fz067 .n5 .num,.fz067 .n5 .ttl{color:var(--rd)}.fz067 .n6{background:var(--gnb);border-color:var(--gnl);animation-delay:3s}.fz067 .n6 .num,.fz067 .n6 .ttl{color:var(--gn)}@keyframes fz067pop{0%,100%{opacity:.62;transform:translateY(5px)}18%,72%{opacity:1;transform:translateY(0)}}.fz067 .ah{position:absolute;top:50%;height:3px;width:clamp(10px,1.6vw,20px);background:var(--ink-soft,#3c362c);border-radius:2px;transform:translateY(-50%);z-index:3;overflow:hidden}.fz067 .ah::before{content:"";position:absolute;left:-40%;top:0;height:100%;width:40%;background:linear-gradient(90deg,transparent,var(--gnl));animation:fz067flow 2.6s linear infinite}.fz067 .ah::after{content:"";position:absolute;right:-2px;top:50%;width:0;height:0;border:6px solid transparent;border-left-color:var(--ink-soft,#3c362c);transform:translateY(-50%)}.fz067 .a12{left:calc(33.333% - clamp(5px,.8vw,10px));margin-left:-1px}.fz067 .a12::before{background:linear-gradient(90deg,transparent,var(--cye))}.fz067 .a23{left:calc(66.666% - clamp(5px,.8vw,10px));margin-left:-1px}.fz067 .a23::before{background:linear-gradient(90deg,transparent,var(--ame))}.fz067 .a45{left:calc(33.333% - clamp(5px,.8vw,10px));margin-left:-1px}.fz067 .a45::before{background:linear-gradient(90deg,transparent,var(--rde))}.fz067 .a56{left:calc(66.666% - clamp(5px,.8vw,10px));margin-left:-1px}.fz067 .a56::before{background:linear-gradient(90deg,transparent,var(--gnl))}@keyframes fz067flow{0%{left:-40%}60%,100%{left:120%}}.fz067 .bend{position:absolute;right:14%;left:14%;top:calc(100% + clamp(3px,.6vw,6px));height:clamp(28px,4.4vw,44px);z-index:2;pointer-events:none}.fz067 .bend .vr,.fz067 .bend .vl,.fz067 .bend .hz{position:absolute;background:var(--ink-soft,#3c362c)}.fz067 .bend .vr{right:0;top:0;width:3px;height:50%;border-radius:2px}.fz067 .bend .hz{top:calc(50% - 1.5px);left:0;right:0;height:3px;border-radius:2px;overflow:hidden}.fz067 .bend .hz::before{content:"";position:absolute;right:-40%;top:0;height:100%;width:40%;background:linear-gradient(270deg,transparent,var(--ppe));animation:fz067flowL 2.8s linear infinite}.fz067 .bend .vl{left:0;top:50%;width:3px;height:50%;border-radius:2px}.fz067 .bend .vl::after{content:"";position:absolute;bottom:-2px;left:50%;width:0;height:0;border:6px solid transparent;border-top-color:var(--ink-soft,#3c362c);transform:translateX(-50%)}@keyframes fz067flowL{0%{right:-40%}60%,100%{right:120%}}.fz067 .ft{margin-top:clamp(16px,2.6vw,26px);padding-top:clamp(10px,1.6vw,14px);border-top:1px dashed var(--hair);font-size:clamp(11px,1.4vw,14px);color:var(--muted,#6a6155);line-height:1.6;display:flex;gap:.6em;align-items:flex-start}.fz067 .ft .pin{flex:none;font-family:var(--font-mono,ui-monospace,monospace);font-weight:700;color:var(--am);font-size:.95em;background:var(--amb);border:1px solid var(--ame);border-radius:6px;padding:.05em .5em}.fz067 .ft b{color:var(--ink-soft,#3c362c);font-weight:700;font-family:inherit}@media (max-width:560px){.fz067 .row{grid-template-columns:1fr;gap:clamp(20px,5vw,26px)}.fz067 .row+.row{margin-top:clamp(20px,5vw,26px)}.fz067 .ah{top:auto;bottom:calc(-1*clamp(13px,4vw,18px));left:50% !important;margin-left:-1.5px !important;height:clamp(12px,3.4vw,16px);width:3px;transform:none}.fz067 .ah::before{left:0;top:-40%;width:100%;height:40%;background:linear-gradient(180deg,transparent,var(--gnl)) !important;animation:fz067flowV 2.6s linear infinite}.fz067 .ah::after{right:50%;top:auto;bottom:-2px;transform:translateX(50%);border:5px solid transparent;border-top-color:var(--ink-soft,#3c362c);border-left-color:transparent}.fz067 .bend{display:none}}@keyframes fz067flowV{0%{top:-40%}60%,100%{top:120%}}@media (prefers-reduced-motion:reduce){.fz067 .node{animation:none;opacity:1;transform:none}.fz067 .ah::before,.fz067 .bend .hz::before{animation:none;display:none}}</style><div class="hd"><div class="t1">一条飞书消息会先入队，再由 Mac 拉回本机执行</div><div class="t2">中间最重要的是 <b>hub 验签排队</b>、<b>worker 主动拉取</b>、output-last-message 和机器人回复。</div></div><div class="row"><div class="node n1"><span class="num">STEP 1</span><span class="ttl">群聊 @ 机器人</span><span class="sub">用户输入自然语言任务</span></div><div class="node n2"><span class="num">STEP 2</span><span class="ttl">飞书推事件</span><span class="sub">POST /lark/events</span></div><div class="node n3"><span class="num">STEP 3</span><span class="ttl">hub 验签排队</span><span class="sub">token、白名单、队列文件</span></div><span class="ah a12" aria-hidden="true"></span><span class="ah a23" aria-hidden="true"></span><div class="bend" aria-hidden="true"><span class="vr"></span><span class="hz"></span><span class="vl"></span></div></div><div class="row"><div class="node n4"><span class="num">STEP 4</span><span class="ttl">worker 拉任务</span><span class="sub">POST /worker/tasks/claim</span></div><div class="node n5"><span class="num">STEP 5</span><span class="ttl">本机 Codex</span><span class="sub">exec / resume / 输出文件</span></div><div class="node n6"><span class="num">STEP 6</span><span class="ttl">回复飞书</span><span class="sub">lark-cli / OpenAPI</span></div><span class="ah a45" aria-hidden="true"></span><span class="ah a56" aria-hidden="true"></span></div><div class="ft"><span class="pin">注意</span><div>飞书回调要<b>快速返回 200</b>，真正耗时的 Codex 任务由 Mac worker 后台领取并执行。</div></div></figure>

一次消息从飞书到 Codex，再回到飞书，大概会经过这些步骤：

1. 用户在飞书群里 @ 机器人并输入任务。
2. 飞书开放平台把 `im.message.receive_v1` 事件 POST 到阿里云 hub 的 `/lark/events`。
3. hub 校验 Verification Token、签名和加密 payload，过滤白名单、群聊 @、消息类型和命令前缀。
4. hub 把任务写入本地队列文件，并快速给飞书返回 200。
5. Mac worker 每隔几秒主动调用 `/worker/tasks/claim` 拉取任务。
6. worker 在 `CODEX_WORKDIR` 指定的仓库里启动 `codex exec` 子进程。
7. Codex 把最后一条回复写入 `--output-last-message` 指定的临时文件。
8. worker 读取结果，并通过 `lark-cli` 直接回复飞书；或者把结果提交回 hub，由 hub 调 OpenAPI 回复。
9. worker 把任务执行状态提交回 hub，让队列从 `running` 变成 `done` 或 `failed`。
10. 如果启用按群复用 session，worker 把 `chat_id -> session_id` 写进 `.sessions.json`。

这个结构有一个好处：公网只看到阿里云 hub，不会直接打到 Mac。飞书机器人本身不需要知道 Codex 的内部实现，Codex 也不需要知道飞书事件协议。中间的 Node 服务负责把两边的协议翻译一下。

当前包支持三种模式：

| 模式 | 链路 | 适合场景 |
| --- | --- | --- |
| `local` | 飞书 -> 本机服务 -> 本机 Codex -> 飞书 | 本机快速调试，通常配 Cloudflare Tunnel 或 ngrok |
| `hub` | 飞书 -> 阿里云 hub -> 任务队列 | 公网固定入口、验签、排队和 worker API |
| `worker` | Mac 主动 poll hub -> 本机 Codex -> 回复飞书 | Codex 仍跑在自己的 Mac，不暴露本机端口 |

## 3. 前置条件

搭之前先准备这些东西。

| 前置项 | 检查方式 |
| --- | --- |
| 本机能运行 Codex CLI | `codex --version` |
| 本机能非交互执行 Codex | `echo "介绍这个仓库" \| codex exec --cd . -` |
| 本机已配置 `lark-cli` | `lark-cli auth whoami` 或执行一次飞书 IM 命令 |
| 有飞书企业自建应用权限 | 能进入飞书开放平台创建应用 |
| 有一个稳定公网 HTTPS 入口 | 例如阿里云 ECS + Nginx/Caddy 反代到 hub |
| Mac 能访问这个公网入口 | worker 要能请求 `https://你的域名/worker/tasks/claim` |
| 目标仓库路径明确 | 例如 `/Users/bytedance/Code/garden-lab` |

本文的桥接服务放在：

```text
tools/lark-codex-bot/
```

在根目录已经加了三个脚本入口：

```bash
pnpm lark:codex-bot # local 模式：本机直连调试
pnpm lark:codex-hub # hub 模式：阿里云公网入口
pnpm lark:codex-worker # worker 模式：Mac 主动拉任务并执行 Codex
```

## 4. 配飞书开放平台

在飞书开放平台创建一个企业自建应用，然后按这个顺序配：

1. 打开“机器人”能力。
2. 在“事件与回调”里选择“将事件发送至开发者服务器”。
3. 订阅 `im.message.receive_v1`，也就是接收消息 v2.0。
4. 在“加密策略”里复制 `Verification Token`。
5. 如果生产使用，建议开启 `Encrypt Key`，本地调试时也可以先关闭加密降低变量数量。
6. 给应用开通消息接收和消息回复相关权限。
7. 在“凭证与基础信息”的国际化配置里把应用名称改成 `Codex`，补一条简短应用描述。
8. 修改名称、权限或事件订阅以后，记得创建版本并发布，否则线上机器人可能还是旧配置。

飞书保存回调 URL 时，会先发一个 `url_verification` 请求。服务需要把 challenge 原样返回：

```js
if (isUrlVerification(payload)) { // 飞书保存回调地址时会先发 challenge
  verifyPayloadToken(config, payload); // 用 Verification Token 确认请求确实来自飞书
  sendJson(response, 200, { challenge: payload.challenge }); // 原样返回 challenge 完成 URL 校验
  return; // URL 校验完成后不要继续进入消息事件处理
}
```

本地调试时，回调地址不能填 `localhost`，可以先起一个公网 HTTPS 隧道。例如：

```bash
cloudflared tunnel --url http://localhost:8787 # 把本机 8787 端口临时暴露成 HTTPS 地址
```

拿到类似下面这样的地址后，填到飞书后台：

```text
https://your-random-name.trycloudflare.com/lark/events
```

Cloudflare 免费临时隧道很适合调试，但域名会变。真正长期使用，最好换成固定域名、固定 tunnel、内网网关或正式部署环境。

我最后采用的是固定域名的阿里云入口：

```text
https://你的域名/lark/events
```

这时飞书只和阿里云通信；Mac worker 是主动拉任务的一方，不需要公网 IP，也不需要把本机端口暴露出去。

## 5. 配 hub 和 worker 的 `.env`

如果只是本机调试，可以继续复制 local 配置：

```bash
cp tools/lark-codex-bot/.env.example tools/lark-codex-bot/.env # 复制一份本地私有配置
```

但长期运行时，我更推荐拆成两份配置：阿里云 hub 一份，Mac worker 一份。

hub 侧配置关注飞书事件、队列和 worker 鉴权：

```bash
LARK_CODEX_MODE=hub # 当前进程只做公网 hub
PORT=8790 # hub 在服务器本机监听的端口，前面再由 Nginx/Caddy 反代 HTTPS
LARK_EVENT_PATH=/lark/events # 飞书事件回调路径
LARK_APP_ID=cli_xxx # 飞书开放平台应用 ID
LARK_VERIFICATION_TOKEN=xxx # 飞书后台复制出来的 Verification Token
LARK_ENCRYPT_KEY=xxx # 生产建议开启加密事件
HUB_WORKER_TOKEN=replace-with-long-random-token # hub 和 worker 共享的长随机 token
HUB_QUEUE_FILE=/data/queue.json # hub 队列文件，注意不要提交到仓库
RESULT_REPLY_MODE=worker # 让 Mac worker 通过本机 lark-cli 回复飞书
LARK_ALLOWED_CHAT_IDS=oc_xxx # 只允许指定群或私聊触发
LARK_ALLOWED_USER_OPEN_IDS=ou_xxx # 只允许指定用户触发
```

worker 侧配置关注 hub 地址和本机 Codex 执行环境：

```bash
LARK_CODEX_MODE=worker # 当前进程只做 Mac worker
HUB_BASE_URL=https://你的域名 # 不要带 /worker
HUB_WORKER_TOKEN=replace-with-the-same-long-random-token # 必须和 hub 完全一致
WORKER_ID=mac-codex-worker # 方便 hub 记录是哪台机器拿了任务
RESULT_REPLY_MODE=worker # worker 自己负责把结果发回飞书
LARK_REPLY_MODE=cli # 用本机 lark-cli 回复，避免把 App Secret 放到公网服务器
LARK_CLI_BIN=lark-cli # 本机 lark-cli 命令名
CODEX_WORKDIR=/Users/bytedance/Code/garden-lab # Codex 实际工作的仓库目录
CODEX_SANDBOX=workspace-write # 让 Codex 只能在工作区内写文件
CODEX_SESSION_SCOPE=chat # 同一个飞书 chat_id 复用同一个 Codex session
CODEX_TIMEOUT_MS=600000 # 单个任务最长运行时间
```

这里有三个配置值得单独说。

第一，`HUB_WORKER_TOKEN` 是 hub 和 worker 之间的私有通行证。worker 拉任务、提交结果时都要带：

```http
Authorization: Bearer <HUB_WORKER_TOKEN>
```

所以这个值要足够长，不能提交到仓库，也不要贴到文章或聊天里。

第二，`RESULT_REPLY_MODE=worker`。这个模式会让 Mac worker 调用本机已经登录好的 `lark-cli`：

```bash
lark-cli im +messages-reply --as bot --message-id "$MESSAGE_ID" --text "$TEXT" # 用机器人身份回复飞书原消息
```

这样做的优点是：阿里云 hub 不需要保存 `LARK_APP_SECRET`，它只负责收事件、排队和给 worker 提供 API。如果你愿意把 App Secret 放在服务器上，也可以改成 `RESULT_REPLY_MODE=hub`，由 hub 调飞书 OpenAPI 回复。

第三，`CODEX_SESSION_SCOPE=chat`。它决定“同一个群里连续发两条消息，是不是同一个 Codex session”。

| 配置 | 行为 |
| --- | --- |
| `chat` | 同一个 `chat_id` 复用同一个 Codex session，不同群互相隔离 |
| `none` 或关闭映射 | 每条飞书消息都是一次全新的 `codex exec` |
| `CODEX_EPHEMERAL=true` | 不落 Codex session，也就不能续聊 |

我更推荐 `chat`。因为飞书对话天然是按群或私聊组织的，用户第二句经常是“继续”“按刚才那个方案改”“再补一个测试”。如果每条消息都新开 session，体验会断。

## 6. hub 怎样把消息变成可拉取任务

hub 接到飞书事件以后，不会立刻无脑交给 Codex。它先做几层过滤：

- 只处理 `im.message.receive_v1`。
- 重复的 `event_id` 会被短时间去重。
- 只接受用户消息，不处理机器人自己的消息。
- 只支持 `text` 和 `post`。
- 如果配置了群白名单，只接受白名单里的 `chat_id`。
- 如果配置了用户白名单，只接受白名单里的 `open_id`。
- 群聊里默认必须 @ 机器人。
- 如果配置了 `BOT_COMMAND_PREFIX=/codex`，只有 `/codex ...` 会触发。

在 `local` 模式里，消息会进入内存里的按 chat 队列：

```js
const queueKey = task.chatId || task.senderOpenId; // 优先用飞书 chat_id 作为队列隔离键
const previous = taskQueues.get(queueKey) || Promise.resolve(); // 取出这个群上一条还没跑完的任务
const next = previous.then(() => processMessageTask(config, tokenCache, task)); // 等上一条结束后再执行当前任务
taskQueues.set(queueKey, next); // 把当前任务放回队列，防止同群并发 resume
```

为什么要排队？因为同一个 Codex session 不适合被两条消息同时 resume。排队以后，同一个群里的消息会顺序进入 Codex；不同群之间仍然可以并行。

在 `hub` 模式里，逻辑换成持久化队列：hub 把任务写进 `HUB_QUEUE_FILE`，Mac worker 通过 `/worker/tasks/claim` 领取一条待处理任务。这样即使 Mac 暂时关机，飞书事件也不会直接打到一台离线电脑上，而是先留在公网入口的队列里。

简化后的任务入队逻辑是：

```js
const hubTask = { // 构造一个可以被 worker 领取的任务对象
  id: randomUUID(), // 每条飞书消息对应一个内部 task id
  status: "queued", // 初始状态是 queued，等待 worker claim
  task, // 保存 chat_id、message_id、sender_open_id 和用户文本
  createdAt: new Date().toISOString(), // 记录入队时间，方便排查
}; // hub task 构造结束
```

## 7. `codex exec`：这里真正启动了一个子进程

Mac worker 不是把 Codex 当库调用，而是启动一个本机子进程：

```js
const child = spawn(config.codexBin, args, { // 启动 codex CLI 子进程
  cwd: config.codexWorkdir, // 让子进程在目标仓库目录下运行
  env: process.env, // 继承当前环境变量和本机 Codex 登录态
  stdio: ["pipe", "pipe", "pipe"], // stdin 写 prompt，stdout/stderr 收执行日志
}); // 子进程创建完成，后面等待它退出
```

如果这个飞书 chat 还没有绑定过 session，服务会新开一次：

```bash
codex exec --cd "$CODEX_WORKDIR" --sandbox workspace-write --color never --output-last-message "$OUTPUT_FILE" - # 从 stdin 读取飞书任务并新建非交互 session
```

如果这个 chat 已经有 session，服务会续上一次：

```bash
codex exec resume --output-last-message "$OUTPUT_FILE" "$SESSION_ID" - # 把飞书新消息作为 prompt 续到已有 session
```

这里有一个我实际踩过的坑：`codex exec` 和交互式 `codex resume` 的参数不完全一样。

例如当前本机版本里，`codex resume` 支持：

```bash
codex resume --ask-for-approval never # 交互式 resume 支持 approval policy 参数
```

但 `codex exec` 不支持这个参数。你如果写成下面这样，会直接失败：

```bash
codex exec --ask-for-approval never - # 当前 codex exec 不接受这个参数
```

所以机器人服务里要按 `codex exec --help` 的真实输出组织参数。非交互场景的安全边界主要靠 `--sandbox workspace-write`、白名单、超时和部署隔离来做。

## 8. 同一个飞书群怎样复用同一个 Codex session

worker 第一次跑完 `codex exec` 后，会从 `~/.codex/sessions` 里找到刚刚生成的 session 文件，拿到 session id。然后把映射写进 Mac 本地的 `.sessions.json`。

核心逻辑可以简化成这样：

```js
const key = task.chatId || task.senderOpenId; // 群聊用 chat_id，私聊没有 chat_id 时退回 senderOpenId
store.chats[key] = { sessionId: session.id, updatedAt: new Date().toISOString() }; // 记录这个聊天对应的 Codex session
await writeFile(storePath, JSON.stringify(store, null, 2)); // 写入本地 .sessions.json，下一条消息会读取它
```

第二条消息进来时，服务先查这个映射：

```js
const session = store.chats[key]; // 按当前飞书 chat 找历史 Codex session
const sessionId = session?.sessionId || ""; // 没找到就说明要新建 session
args.push("exec", "resume", "--output-last-message", outputFile, sessionId, "-"); // 找到了就用 codex exec resume 续聊
```

这个设计回答了一个很实用的问题：如果我连续发两条飞书消息，它们是不是同一个 session？

答案是：在 `CODEX_SESSION_SCOPE=chat` 下，同一个飞书群或同一个私聊是同一个 session；不同群、不同私聊不是同一个 session。

这比全局复用一个 session 更安全。因为群 A 里让 Codex 改博客，群 B 里让 Codex 查另一个项目，它们不应该共享上下文。

<figure class="fz068" data-reveal role="group" aria-label="按飞书 chat_id 复用 Codex session：飞书群 A 经 sessions.json 映射到同一个 Codex session，不同群互相隔离"><style>.fz068{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--grn:#4f7233;--grnb:#e7eedd;--grnl:#7c9c54;--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--pur:#54579a;--purb:#e6e7f3;--pure:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(160deg,var(--paper-soft),var(--soft2));color:var(--ink);border:1px solid var(--hair);border-radius:18px;padding:26px 24px 22px;margin:1.4em 0;max-width:100%;box-sizing:border-box;line-height:1.5}.fz068 *{box-sizing:border-box}.fz068 .hd{margin-bottom:4px}.fz068 .ttl{font-size:1.32rem;font-weight:800;letter-spacing:.2px;color:var(--ink)}.fz068 .sub{font-size:.86rem;color:var(--muted);margin-top:6px;max-width:62ch}.fz068 .flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:stretch;gap:10px;margin:22px 0 6px}.fz068 .card{border-radius:16px;padding:16px 14px;border:1px solid var(--hair);position:relative;opacity:.9;animation:fzcard 9s ease-in-out infinite}.fz068 .c1{background:var(--grnb);border-color:var(--grnl);animation-delay:0s}.fz068 .c2{background:var(--soft2);border-color:var(--hair);animation-delay:.7s}.fz068 .c3{background:var(--purb);border-color:var(--pure);animation-delay:1.4s}.fz068 .ch{font-weight:800;font-size:1.02rem;margin-bottom:12px;display:flex;align-items:center;gap:7px}.fz068 .c1 .ch{color:var(--grn)}.fz068 .c2 .ch{color:var(--ink);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.94rem}.fz068 .c3 .ch{color:var(--pur)}.fz068 .dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}.fz068 .c1 .dot{background:var(--grn)}.fz068 .c3 .dot{background:var(--pur)}.fz068 .msg{background:#fff;border:1px solid var(--hair);border-radius:11px;padding:9px 11px;font-size:.84rem;color:var(--ink-soft);margin-top:9px}.fz068 .msg:first-of-type{margin-top:0}.fz068 .m1{animation:fzmsg 9s ease-in-out infinite}.fz068 .m2{animation:fzmsg 9s ease-in-out infinite .9s}.fz068 .m3{animation:fzmsg 9s ease-in-out infinite 1.8s}.fz068 .json{background:var(--ink);border-radius:13px;padding:13px 14px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.82rem;line-height:1.85}.fz068 .jk{color:var(--cye)}.fz068 .jy{color:var(--ame)}.fz068 .jg{color:var(--grnl)}.fz068 .jp{color:var(--muted)}.fz068 .note-local{margin-top:11px;font-size:.82rem;color:var(--muted)}.fz068 .arr{position:relative;align-self:center;width:46px;height:24px}.fz068 .arr .ln{position:absolute;top:11px;left:0;height:3px;width:100%;border-radius:2px;background:linear-gradient(90deg,var(--cye),var(--cy));overflow:hidden}.fz068 .arr .ln::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(250,246,236,.9),transparent);animation:fzstream 2.6s linear infinite}.fz068 .a2 .ln::after{animation-delay:1.3s}.fz068 .arr .hd2{position:absolute;top:5px;right:-2px;width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:10px solid var(--cy)}.fz068 .map{display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--muted);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin:14px 2px 18px;flex-wrap:wrap;justify-content:center}.fz068 .map b{color:var(--cy);font-weight:700}.fz068 .map .ar{color:var(--ame)}.fz068 .nb{display:flex;align-items:flex-start;gap:10px;background:var(--amb);border:1px solid var(--ame);border-radius:13px;padding:12px 15px;color:var(--am);font-size:.9rem;font-weight:600;animation:fznb 9s ease-in-out infinite}.fz068 .nb .key{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-weight:800;flex:0 0 auto;letter-spacing:1px}@keyframes fzcard{0%,100%{opacity:.86;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}@keyframes fzmsg{0%,100%{transform:translateX(0);box-shadow:0 0 0 0 rgba(79,114,51,0)}45%{transform:translateX(2px);box-shadow:-3px 0 0 0 var(--grnl)}}@keyframes fzstream{0%{left:-40%}100%{left:110%}}@keyframes fznb{0%,100%{box-shadow:0 0 0 0 rgba(154,101,22,0)}50%{box-shadow:0 0 0 3px rgba(217,182,106,.28)}}.fz068.in-view .card{animation-play-state:running}@media (max-width:620px){.fz068 .flow{grid-template-columns:1fr;gap:6px}.fz068 .arr{width:26px;height:30px;justify-self:center;transform:rotate(90deg)}.fz068 .map{font-size:.72rem}}@media (prefers-reduced-motion:reduce){.fz068 .card,.fz068 .m1,.fz068 .m2,.fz068 .m3,.fz068 .nb,.fz068 .arr .ln::after{animation:none}.fz068 .card{opacity:1;transform:none}.fz068 .nb{box-shadow:none}}</style><div class="hd"><div class="ttl">推荐按 chat_id 续聊，而不是每条消息都新开</div><div class="sub">Mac worker 在本地维护映射：同一个飞书群复用一个 Codex session，不同群和私聊互相隔离。</div></div><div class="flow"><div class="card c1"><div class="ch"><span class="dot"></span>飞书群 A</div><div class="msg m1">第一句：写教程</div><div class="msg m2">第二句：继续补图</div><div class="msg m3">第三句：跑 build</div></div><div class="arr a1"><span class="ln"></span><span class="hd2"></span></div><div class="card c2"><div class="ch">.sessions.json</div><div class="json"><div><span class="jk">"oc_group_a"</span><span class="jp">:</span></div><div><span class="jp">&nbsp;&nbsp;</span><span class="jy">"sessionId"</span><span class="jp">:</span></div><div><span class="jp">&nbsp;&nbsp;</span><span class="jg">"019e..."</span></div></div><div class="note-local">Mac 本地私有文件</div></div><div class="arr a2"><span class="ln"></span><span class="hd2"></span></div><div class="card c3"><div class="ch"><span class="dot"></span>Codex session</div><div class="msg">exec 新建</div><div class="msg">exec resume</div><div class="msg">继续保留上下文</div></div></div><div class="map"><b>chat_id</b><span class="ar">&rarr;</span><b>session_id</b><span>（同群续聊，异群隔离）</span></div><div class="nb"><span class="key">群 B</span><span>会有自己的 key 和 session，不会串到群 A 的上下文里。</span></div></figure>

## 9. 回复飞书：worker 回复和 hub 回复

worker 跑完 Codex 以后，会拿到最终回复：

```js
const lastMessage = await readMaybe(outputFile); // 优先读取 Codex 写出的最后一条助手消息
const fallback = lastMessage || [stdout, stderr].filter(Boolean).join("\n\n").trim(); // 如果文件为空，就退回 stdout/stderr
await safeReply(config, tokenCache, task.messageId, fallback); // 把结果回复到飞书原消息下面
```

在“阿里云只做公网入口”的版本里，我更倾向让 worker 直接走 `lark-cli` 回复：

```js
args.push("im", "+messages-reply"); // 选择飞书 IM 的回复消息命令
args.push("--as", "bot"); // 明确以机器人身份发送
args.push("--message-id", messageId); // 回复用户刚刚发来的那条消息
args.push("--text", text); // 把 Codex 最终回复作为文本发回飞书
```

这么做的原因很现实：本机 `lark-cli` 已经处理了登录态、身份和凭证存储。worker 只需要调用命令，不需要自己维护 `tenant_access_token`。更重要的是，阿里云 hub 不需要保存 `LARK_APP_SECRET`。

完整链路是：

```text
Mac worker -> codex exec -> 读取 output-last-message -> lark-cli --as bot -> 飞书原消息回复
```

代码里也保留了另一种模式：`RESULT_REPLY_MODE=hub`。这时 worker 只把结果提交回 hub，hub 再用 `LARK_APP_ID + LARK_APP_SECRET` 换 `tenant_access_token`，调用飞书 OpenAPI 回复原消息。它更像传统后端部署，但密钥会集中放在公网服务器上。

两种模式可以这样选：

| 回复模式 | 谁发飞书消息 | 需要放 App Secret 的地方 | 适合场景 |
| --- | --- | --- | --- |
| `worker` | Mac worker 通过 `lark-cli` 发 | 不需要放到 hub | 个人使用、阿里云只做入口 |
| `hub` | 阿里云 hub 通过 OpenAPI 发 | hub `.env` | 团队服务化、服务器统一托管凭证 |

## 10. 启动与验证

本地直连调试仍然可以用两步：先启动 local 服务，再用 Cloudflare Tunnel 暴露 `localhost`。但当前这套长期方案分成 hub 和 worker 两端。

第一步，在阿里云上启动 hub：

```bash
pnpm lark:codex-hub -- --env-file tools/lark-codex-bot/.env.hub # 在公网服务器上启动 hub
```

看到类似输出就说明服务起来了：

```text
lark-codex-bot hub listening on http://localhost:8790
worker claim path: /worker/tasks/claim
```

服务器前面再用 Nginx 或 Caddy 把 HTTPS 转到 hub：

```text
https://你的域名/lark/events -> http://127.0.0.1:8790/lark/events
```

第二步，在 Mac 上启动 worker：

```bash
pnpm lark:codex-worker -- --env-file tools/lark-codex-bot/.env.worker # 在 Mac 上主动拉任务并执行 Codex
```

worker 启动后会持续 poll：

```text
lark-codex-bot worker started: mac-codex-worker
hub: https://你的域名/worker
codex workdir: /Users/bytedance/Code/garden-lab
```

第三步，用健康检查和队列接口确认链路：

```bash
curl https://你的域名/health # 检查 hub 是否正常响应
curl -H "Authorization: Bearer $HUB_WORKER_TOKEN" https://你的域名/worker/tasks # 查看最近任务状态
```

飞书后台保存回调地址成功以后，去群里 @ 机器人发一句：

```text
@Codex 介绍一下这个仓库的目录结构
```

如果 `LARK_SEND_RUNNING_MESSAGE=true`，你会先看到一条排队或处理中提示：

```text
收到，任务已进入 Codex 队列，等待 Mac worker 处理。
```

等 Codex 跑完以后，机器人会再回一条总结。如果启用了 `LARK_INCLUDE_CODEX_SESSION=true`，末尾还会带上：

```text
Codex session: <session-id>
CLI 恢复: codex resume --include-non-interactive <session-id>
```

这个 session id 很有用。它既能帮助你定位本机 `~/.codex/sessions` 里的执行记录，也能让你回到交互式 CLI 继续看上下文。

我最后做了一次端到端验证：在正确的飞书会话里发送一个只要求回复固定文本的测试消息，hub 队列状态从 `queued` 到 `running` 再到 `done`，worker 返回的内容和 Codex session id 都能正常出现在飞书回复里。这一步比只看 `/health` 更有价值，因为它同时验证了飞书事件、hub 队列、worker 拉取、`codex exec`、session 记录和机器人回复。

## 11. 安全边界：别让群聊变成裸奔终端

飞书机器人触发 Codex，本质上是在让聊天消息影响本机仓库和命令执行。这个能力很爽，也必须收紧边界。

我建议至少做这些限制：

| 风险点 | 建议 |
| --- | --- |
| 任意群触发 | 配 `LARK_ALLOWED_CHAT_IDS` |
| 任意用户触发 | 配 `LARK_ALLOWED_USER_OPEN_IDS` |
| 群里误触发 | 保持默认必须 @ 机器人，或加 `BOT_COMMAND_PREFIX=/codex` |
| Codex 写出工作区 | 用 `CODEX_SANDBOX=workspace-write` |
| 任务跑太久 | 配 `CODEX_TIMEOUT_MS` |
| 回复泄露密钥 | 对 token、app secret、Authorization 做 redaction |
| 本机端口暴露公网 | 长期使用改成 Mac worker 主动拉任务，不暴露本机端口 |
| worker API 被滥用 | `/worker/*` 必须校验 `HUB_WORKER_TOKEN` |
| hub 队列文件泄露 | `HUB_QUEUE_FILE` 用 `0600` 权限，目录不要放进静态站点 |
| Mac 关机或休眠 | hub 会继续排队；不想积压时先停 hub 或暂停机器人 |
| 临时隧道域名变化 | 生产换固定域名和稳定部署 |

还有一个实践建议：先把机器人放进一个只有你自己的测试群，确认消息过滤、权限、回复和 Codex 行为都符合预期，再逐步开放给团队。

## 12. 常见问题

### 飞书后台保存 URL 失败

优先检查四件事：

- 公网 URL 是否真的能访问到 hub 服务。
- 回调路径是不是 `/lark/events`。
- `LARK_VERIFICATION_TOKEN` 是否和飞书后台一致。
- 如果开启了 Encrypt Key，本地 `LARK_ENCRYPT_KEY` 是否正确。

hub 或 local 服务日志里如果出现 `invalid verification token`，基本就是 token 不一致。

### 机器人收到消息但不回复

常见原因是：

- 应用版本还没有发布。
- 机器人没有被拉进群。
- 没有消息回复权限。
- `lark-cli` 当前身份没有配置好。
- 白名单没填对，消息被服务过滤了。
- Mac worker 没启动，任务还停在 hub 队列里。
- `RESULT_REPLY_MODE` 和实际凭证不匹配：设成 `worker` 就要保证 worker 机器上的 `lark-cli` 可用，设成 `hub` 就要保证 hub 有 App Secret。

可以先把 `LARK_ALLOWED_CHAT_IDS` 和 `LARK_ALLOWED_USER_OPEN_IDS` 暂时清空，在测试群确认链路通了以后再收紧。

### 我把电脑重启了，机器人还能用吗

分两层看。

如果阿里云 hub 还在，飞书开放平台仍然能把事件投到 `/lark/events`，任务也能进 hub 队列。但 Codex 真正运行在 Mac worker 上，所以 Mac 关机、重启或 worker 没启动时，任务不会被执行。

重启以后，打开 Mac 并重新启动：

```bash
pnpm lark:codex-worker -- --env-file tools/lark-codex-bot/.env.worker # 重启 worker 后继续从 hub 拉任务
```

如果不希望离线期间积压任务，可以先停掉 hub，或在飞书开放平台里临时停用事件订阅。

### 为什么飞书里还是旧名字

飞书开放平台里的名称修改不是保存后立刻对所有客户端生效。先在“凭证与基础信息”的国际化配置里改应用名称，再到“版本管理与发布”创建版本并发布。本文实战里最终发布的是 `1.0.3`，更新说明是“重命名应用为 Codex”。

发布后如果客户端仍显示旧名，通常是飞书客户端缓存，等几分钟或重启客户端即可。

### Codex 运行失败，提示 unexpected argument

先执行：

```bash
codex exec --help # 以本机安装版本为准确认 exec 支持哪些参数
```

不要把交互式 `codex resume` 的参数想当然搬到 `codex exec`。我这次遇到的典型例子就是 `--ask-for-approval`：交互式入口支持，非交互 `exec` 不支持。

### 我能在 Codex App 里看到这段对话吗

不要把它当成 Codex App 普通会话。飞书触发的是 `codex exec` 非交互 session，它会落到本机 Codex session 记录里，但不等于 App 里的一个实时聊天窗口。

你可以用下面命令在 CLI 里恢复查看：

```bash
codex resume --include-non-interactive <session-id> # 把非交互 session 纳入 resume 选择范围
```

### 连续发两条消息是不是同一个 session

取决于配置。本文推荐：

```bash
CODEX_SESSION_SCOPE=chat # 按飞书 chat_id 复用 Codex session
```

这样同一个群里的第二条消息会走 `codex exec resume`，不同群不会串上下文。

## 13. 小结

把 Codex CLI 接进飞书机器人，本质上是把四个已经成熟的边界拼起来：

- 飞书负责消息入口和机器人回复。
- 阿里云 hub 负责稳定公网入口、事件协议、安全过滤和任务队列。
- Mac worker 负责拉任务、启动子进程、维护 session 映射和必要时发送回复。
- Codex CLI 负责真正进入仓库执行任务。

我觉得这个方案最舒服的地方是：它没有强行把所有东西塞进一个产品里。飞书还是团队协作入口，阿里云只是稳定入口和队列，Codex 还是本机 Coding Agent，桥接服务只做翻译和编排。

等你把 `CODEX_SESSION_SCOPE=chat` 打开、把飞书应用名发布成 `Codex` 以后，它就不像一个“每次都忘记上下文的命令机器人”，而更像群聊里多了一个可以被点名的本机工程助手。它不会替代 Codex App，但会把 Codex 的触发入口从“我打开 App 输入任务”扩展成“团队在飞书里顺手派活”。
