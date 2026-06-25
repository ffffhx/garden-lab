---
title: "Claude Code 代理链路复盘：一条请求在飞连、Bifrost 和 Clash 之间怎么走"
date: "2026-06-10 17:54:00"
categories:
  - 技术
tags:
  - Claude Code
  - 代理
  - Clash
  - Mihomo
  - Bifrost
  - 飞连
  - VPN
  - 网络
  - macOS
excerpt: "从一条真实网络请求出发，复盘浏览器和 Claude Code CLI 在飞连、Bifrost、Clash Verge Rev / Mihomo 同时在线时的完整链路：应用先决定第一跳，代理再决定转发目标，最后由 macOS 路由决定从 en0 还是 utunX 出去。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

很多代理问题看起来像是“哪个工具没开”，但更准确地说，它们是在问网络八股文里的那个经典问题：**当我访问一个网站时，一条请求到底是怎么发出去的？**

这次的环境更贴近公司研发机的日常状态：

- 飞连开着。
- Bifrost 开着。
- Clash Verge Rev / Mihomo 开着。
- 浏览器可能在访问 Claude。
- 终端里可能在运行 Claude Code CLI。
- macOS 系统代理、CLI 环境变量、Bifrost 规则、Clash 规则、路由表会同时影响结果。

这篇文章的核心结论是：

```text
Bifrost 8899 / Clash 7897 是应用层代理入口；
utunX / en0 是网络层路由出口；
它们可以出现在同一条请求链路里，但不是同一层东西。
```

所以排查时不能只问“我开了 Clash 吗”或者“我开了飞连吗”，而要问：

```text
这个应用发出的这个请求，
第一跳是谁？
有没有被显式转给下一个代理？
代理规则命中了什么？
代理程序往外连的时候，底层路由走 en0 还是 utunX？
目标网站最后看到哪个出口？
```

先从下面这个交互动画开始：它把一条请求画成一个红色请求包，左边先经过蓝色的应用层入口门，右边再经过绿色的网络层路由门，然后把每一步拆开。

<figure class="request-gates-html" data-rg-step="0" role="group" aria-label="可交互的请求链路模拟器：选择请求场景、飞连、Bifrost 和 Clash Verge 状态后查看代理路径">
  <style>
    .request-gates-html{--paper:#faf6ec;--paper2:#ece5d5;--ink:#1a1815;--soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--blue:#315f80;--blue2:#dcebed;--green:#416f35;--green2:#e7eedd;--red:#a43a25;--red2:#f1ddd6;--gold:#9a6516;--gold2:#f4e8cc;--plain:#fffaf0;margin:1.45rem 0;padding:clamp(16px,3vw,26px);border:1px solid var(--hair);border-radius:8px;background:linear-gradient(180deg,var(--paper),var(--paper2));color:var(--ink);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);overflow:hidden}
    .request-gates-html *{box-sizing:border-box}.request-gates-html .rg-state{position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;clip:rect(0 0 0 0)}.request-gates-html .rg-shell{position:relative}.request-gates-html .rg-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-end;margin-bottom:1rem}.request-gates-html .rg-kicker{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.76rem;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}.request-gates-html .rg-title{font-size:clamp(1.18rem,2.7vw,1.65rem);font-weight:800;line-height:1.25;margin:.18rem 0 0}.request-gates-html .rg-tools{display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end;align-items:center}.request-gates-html .rg-legend{display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.72rem;color:var(--muted)}.request-gates-html .rg-pill,.request-gates-html .rg-step-action{border:1px solid var(--hair);border-radius:999px;padding:.2rem .5rem;background:rgba(255,255,255,.34);white-space:nowrap}.request-gates-html .rg-step-action{cursor:pointer;color:var(--ink);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.72rem;line-height:1;padding:.42rem .62rem;transition:background .2s ease,border-color .2s ease,box-shadow .2s ease,transform .2s ease}.request-gates-html .rg-step-action:hover{background:rgba(244,232,204,.75);border-color:#d9b66a;transform:translateY(-1px)}.request-gates-html .rg-step-action:focus-visible{outline:2px solid #315f80;outline-offset:2px}.request-gates-html .rg-step-action:disabled{opacity:.52;cursor:not-allowed;transform:none;background:rgba(255,255,255,.18);border-color:var(--hair)}.request-gates-html .rg-step-action:disabled:hover{box-shadow:none;transform:none}
    .request-gates-html .rg-control-matrix{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;margin-bottom:1rem}.request-gates-html .rg-control-group{border:1px solid var(--hair);border-radius:8px;background:rgba(255,255,255,.25);padding:.62rem}.request-gates-html .rg-mode-title{margin:0 0 .48rem;color:var(--muted);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.72rem;letter-spacing:.06em;text-transform:uppercase}.request-gates-html .rg-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.45rem}.request-gates-html .group-request .rg-options{grid-template-columns:repeat(5,minmax(0,1fr))}.request-gates-html .group-clash .rg-options{grid-template-columns:repeat(4,minmax(0,1fr))}.request-gates-html label{cursor:pointer;border:1px solid var(--hair);border-radius:8px;background:rgba(255,255,255,.4);padding:.52rem .55rem;min-height:66px;display:block;transition:background .2s ease,border-color .2s ease,transform .2s ease,box-shadow .2s ease}.request-gates-html label:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(26,24,21,.08)}.request-gates-html label b{display:block;font-size:.88rem;line-height:1.22}.request-gates-html label small{display:block;margin-top:.22rem;color:var(--muted);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.64rem;line-height:1.34}
    #rg-req-browser:checked~.rg-shell label[for=rg-req-browser],#rg-req-cli:checked~.rg-shell label[for=rg-req-cli],#rg-req-local:checked~.rg-shell label[for=rg-req-local],#rg-req-intranet:checked~.rg-shell label[for=rg-req-intranet],#rg-req-claude:checked~.rg-shell label[for=rg-req-claude]{background:rgba(220,235,237,.92);border-color:#8fbcc4;box-shadow:0 0 0 3px rgba(49,95,128,.12)}#rg-feilian-speed:checked~.rg-shell label[for=rg-feilian-speed],#rg-feilian-global:checked~.rg-shell label[for=rg-feilian-global],#rg-feilian-off:checked~.rg-shell label[for=rg-feilian-off]{background:rgba(231,238,221,.92);border-color:#b7c99f;box-shadow:0 0 0 3px rgba(65,111,53,.12)}#rg-bifrost-off:checked~.rg-shell label[for=rg-bifrost-off],#rg-bifrost-direct:checked~.rg-shell label[for=rg-bifrost-direct],#rg-bifrost-chain:checked~.rg-shell label[for=rg-bifrost-chain]{background:rgba(220,235,237,.92);border-color:#8fbcc4;box-shadow:0 0 0 3px rgba(49,95,128,.12)}#rg-clash-off:checked~.rg-shell label[for=rg-clash-off],#rg-clash-skip:checked~.rg-shell label[for=rg-clash-skip],#rg-clash-direct:checked~.rg-shell label[for=rg-clash-direct],#rg-clash-node:checked~.rg-shell label[for=rg-clash-node]{background:rgba(244,232,204,.95);border-color:#d9b66a;box-shadow:0 0 0 3px rgba(154,101,22,.12)}
    .request-gates-html .rg-readout{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin:0 0 1rem;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.7rem;color:var(--muted)}.request-gates-html .rg-readout b{font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);font-size:.84rem;color:var(--ink)}.request-gates-html .rg-chip{display:none;border:1px solid var(--hair);border-radius:999px;background:rgba(255,255,255,.44);padding:.18rem .48rem}#rg-req-browser:checked~.rg-shell .chip-req-browser,#rg-req-cli:checked~.rg-shell .chip-req-cli,#rg-req-local:checked~.rg-shell .chip-req-local,#rg-req-intranet:checked~.rg-shell .chip-req-intranet,#rg-req-claude:checked~.rg-shell .chip-req-claude,#rg-feilian-speed:checked~.rg-shell .chip-feilian-speed,#rg-feilian-global:checked~.rg-shell .chip-feilian-global,#rg-feilian-off:checked~.rg-shell .chip-feilian-off,#rg-bifrost-off:checked~.rg-shell .chip-bifrost-off,#rg-bifrost-direct:checked~.rg-shell .chip-bifrost-direct,#rg-bifrost-chain:checked~.rg-shell .chip-bifrost-chain,#rg-clash-off:checked~.rg-shell .chip-clash-off,#rg-clash-skip:checked~.rg-shell .chip-clash-skip,#rg-clash-direct:checked~.rg-shell .chip-clash-direct,#rg-clash-node:checked~.rg-shell .chip-clash-node{display:inline-flex}
    .request-gates-html .rg-board{position:relative;border:1px solid var(--hair);border-radius:8px;background:linear-gradient(135deg,rgba(250,246,236,.94),rgba(236,229,213,.76)),repeating-linear-gradient(90deg,rgba(26,24,21,.035) 0 1px,transparent 1px 22px);overflow:hidden;padding:1.05rem}.request-gates-html .rg-board-title{display:flex;align-items:center;justify-content:space-between;gap:.8rem;margin-bottom:.75rem}.request-gates-html .rg-board-title>div{display:grid;gap:.12rem}.request-gates-html .rg-board-title b{font-size:1rem}.request-gates-html .rg-board-title small{color:var(--muted);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.66rem}.request-gates-html .rg-stage{position:relative;min-height:0}.request-gates-html .rg-path{display:none;position:relative;grid-template-columns:repeat(var(--cols,5),minmax(112px,1fr));gap:.72rem;align-items:stretch;padding-bottom:50px}.request-gates-html .rg-step{position:relative;z-index:2;min-height:128px;border:1.5px solid var(--hair);border-radius:11px 11px 5px 5px;background:rgba(250,246,236,.92);box-shadow:0 6px 16px rgba(26,24,21,.07);padding:.62rem .62rem 2.3rem;overflow:visible;transition:box-shadow .24s ease,transform .24s ease,opacity .24s ease}.request-gates-html .rg-step b{display:block;font-size:.9rem;line-height:1.22}.request-gates-html .rg-step small{display:block;margin-top:.28rem;color:var(--muted);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.62rem;line-height:1.42}.request-gates-html .rg-hop{position:absolute;left:.62rem;right:.62rem;bottom:.48rem;padding-top:.28rem;border-top:1px solid rgba(26,24,21,.16);color:var(--blue);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.55rem;line-height:1.22;max-height:2.85em;overflow:hidden}.request-gates-html .rg-hop:before{content:"->";font-weight:800;margin-right:.25rem;color:var(--red)}.request-gates-html .rg-hop.green{color:var(--green)}.request-gates-html .rg-hop.gold{color:var(--gold)}.request-gates-html .rg-hop.warn{color:var(--red)}.request-gates-html .rg-step.source{background:var(--red2);border-color:#d49a8e}.request-gates-html .rg-step.app,.request-gates-html .rg-step.bifrost,.request-gates-html .rg-step.clash{background:var(--blue2);border-color:#8fbcc4}.request-gates-html .rg-step.route,.request-gates-html .rg-step.loop{background:var(--green2);border-color:#b7c99f}.request-gates-html .rg-step.remote,.request-gates-html .rg-step.target{background:var(--gold2);border-color:#d9b66a}.request-gates-html .rg-step.fail{background:var(--red2);border-color:#c8897b;box-shadow:0 0 0 4px rgba(164,58,37,.11),0 8px 20px rgba(26,24,21,.08)}.request-gates-html .rg-step.ghost{opacity:.46;background:rgba(250,246,236,.7)}.request-gates-html .rg-step:before{content:"";position:absolute;left:calc(100% + .14rem);top:50%;width:.32rem;height:.32rem;border-radius:50%;background:rgba(164,58,37,.45);box-shadow:.42rem 0 0 rgba(164,58,37,.32);transform:translateY(-50%)}.request-gates-html .rg-step:last-of-type:before{display:none}.request-gates-html .rg-step[data-stamp]:after{content:attr(data-stamp);position:absolute;right:.48rem;top:.42rem;width:38px;height:38px;display:grid;place-items:center;border:2px solid currentColor;border-radius:50%;color:rgba(164,58,37,.76);font-weight:900;font-size:.66rem;transform:rotate(-12deg) scale(.86);opacity:0;animation:rg-stamp 7.2s ease-out infinite;animation-delay:var(--d,0s);transition:opacity .22s ease,transform .22s ease}.request-gates-html .rg-step.route[data-stamp]:after,.request-gates-html .rg-step.loop[data-stamp]:after{color:rgba(65,111,53,.76)}.request-gates-html .rg-step.remote[data-stamp]:after,.request-gates-html .rg-step.target[data-stamp]:after{color:rgba(154,101,22,.78)}
    .request-gates-html .gate-leaves{position:absolute;top:0;left:0;right:0;height:30px;pointer-events:none}.request-gates-html .gate-leaves:before,.request-gates-html .gate-leaves:after{content:"";position:absolute;top:7px;width:47%;height:25px;background:linear-gradient(180deg,#c6a061,#9c7740);border:1px solid rgba(26,24,21,.38);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);transition:transform .26s ease}.request-gates-html .gate-leaves:before{left:2px;transform-origin:left center;animation:rg-door-left 7.2s ease-in-out infinite;animation-delay:var(--d,0s)}.request-gates-html .gate-leaves:after{right:2px;transform-origin:right center;animation:rg-door-right 7.2s ease-in-out infinite;animation-delay:var(--d,0s)}.request-gates-html .rg-step.app,.request-gates-html .rg-step.net-gate{padding-top:2.25rem}.request-gates-html .rg-runner{position:absolute;left:5%;bottom:6px;width:30px;height:46px;z-index:8;transform:translateX(-50%);animation:rg-run-5 7.2s cubic-bezier(.45,0,.52,1) infinite}.request-gates-html .cols-3 .rg-runner{animation-name:rg-run-3}.request-gates-html .cols-4 .rg-runner{animation-name:rg-run-4}.request-gates-html .cols-5 .rg-runner{animation-name:rg-run-5}.request-gates-html .cols-6 .rg-runner{animation-name:rg-run-6}.request-gates-html .cols-7 .rg-runner{animation-name:rg-run-7}.request-gates-html .rg-runner .ci{position:absolute;inset:0;animation:rg-bob .42s ease-in-out infinite}.request-gates-html .rg-runner .ch{position:absolute;left:50%;top:1px;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;background:#e9d8c2;border:1.5px solid var(--ink)}.request-gates-html .rg-runner .cc{position:absolute;left:50%;top:-1px;width:16px;height:7px;margin-left:-8px;border-radius:7px 7px 0 0;background:var(--red)}.request-gates-html .rg-runner .cb{position:absolute;left:50%;top:13px;width:18px;height:18px;margin-left:-9px;border-radius:6px;background:var(--red);border:1.5px solid #7d2a1a}.request-gates-html .rg-runner .cp{position:absolute;left:-6px;top:15px;width:13px;height:13px;border-radius:3px;background:var(--gold2);border:1.5px solid var(--gold);z-index:-1}.request-gates-html .rg-runner .cp:after{content:"包";position:absolute;inset:0;display:grid;place-items:center;font-size:.42rem;color:var(--gold);font-weight:800}.request-gates-html .rg-runner .cl{position:absolute;top:29px;left:50%;width:4px;height:13px;border-radius:2px;background:#5a2417;transform-origin:top center}.request-gates-html .rg-runner .cl.a{margin-left:-5px;animation:rg-step-a .42s ease-in-out infinite}.request-gates-html .rg-runner .cl.b{margin-left:1px;animation:rg-step-b .42s ease-in-out infinite}.request-gates-html .rg-runner .cm{position:absolute;top:15px;left:50%;margin-left:6px;width:3.5px;height:12px;border-radius:2px;background:var(--red);transform-origin:top center;animation:rg-step-b .42s ease-in-out infinite}.request-gates-html .rg-path.fail-path .rg-runner{animation-name:rg-run-fail}.request-gates-html .rg-path.fail-path .rg-runner .cb{animation:rg-fail-pulse 1.2s ease-in-out infinite}.request-gates-html.is-stepped .rg-runner{left:var(--runner-left,12.5%);animation:none!important;transition:left .34s cubic-bezier(.2,.72,.2,1)}.request-gates-html.is-stepped .rg-step[data-stamp]:after,.request-gates-html.is-stepped .gate-leaves:before,.request-gates-html.is-stepped .gate-leaves:after{animation:none!important}.request-gates-html.is-stepped .rg-step[data-stamp]:after{opacity:0;transform:rotate(-18deg) scale(1.18)}.request-gates-html.is-stepped .rg-step.is-done{opacity:.72}.request-gates-html.is-stepped .rg-step.is-done[data-stamp]:after{opacity:.45;transform:rotate(-12deg) scale(.82)}.request-gates-html.is-stepped .rg-step.is-current{transform:translateY(-2px);box-shadow:0 0 0 4px rgba(49,95,128,.14),0 10px 24px rgba(26,24,21,.1)}.request-gates-html.is-stepped .rg-step.is-current[data-stamp]:after{opacity:.95;transform:rotate(-8deg) scale(1)}.request-gates-html.is-stepped .rg-step.is-current .gate-leaves:before{transform:perspective(220px) rotateY(-78deg)}.request-gates-html.is-stepped .rg-step.is-current .gate-leaves:after{transform:perspective(220px) rotateY(78deg)}
    .request-gates-html .fe,.request-gates-html .target-web,.request-gates-html .target-claude{display:none}#rg-feilian-speed:checked~.rg-shell .fe-speed,#rg-feilian-global:checked~.rg-shell .fe-global,#rg-feilian-off:checked~.rg-shell .fe-off,#rg-req-browser:checked~.rg-shell .target-web,#rg-req-claude:checked~.rg-shell .target-claude{display:inline}.request-gates-html .rg-notices{display:none}.request-gates-html .rg-notice{display:block;border:1px solid var(--hair);border-left:4px solid var(--blue);border-radius:8px;background:rgba(255,255,255,.38);padding:.58rem .68rem;color:var(--muted);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.65rem;line-height:1.42}.request-gates-html .rg-notice b{display:block;color:var(--ink);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);font-size:.86rem;margin-bottom:.15rem}.request-gates-html .rg-notice.warn{border-left-color:var(--red);background:rgba(241,221,214,.46)}.request-gates-html .rg-notice.good{border-left-color:var(--green)}.request-gates-html .rg-notice.gold{border-left-color:var(--gold);background:rgba(244,232,204,.52)}
    #rg-req-local:checked~.rg-shell .path-local,#rg-req-cli:checked~#rg-clash-skip:checked~.rg-shell .path-cli-skip,#rg-req-cli:checked~#rg-clash-off:checked~.rg-shell .path-cli-off,#rg-req-cli:checked~#rg-clash-direct:checked~.rg-shell .path-cli-direct,#rg-req-cli:checked~#rg-clash-node:checked~.rg-shell .path-cli-node,#rg-req-browser:checked~#rg-bifrost-off:checked~#rg-clash-skip:checked~.rg-shell .path-browser-bf-off,#rg-req-claude:checked~#rg-bifrost-off:checked~#rg-clash-skip:checked~.rg-shell .path-browser-bf-off,#rg-req-browser:checked~#rg-bifrost-off:checked~#rg-clash-off:checked~.rg-shell .path-browser-clash-off,#rg-req-claude:checked~#rg-bifrost-off:checked~#rg-clash-off:checked~.rg-shell .path-browser-clash-off,#rg-req-browser:checked~#rg-bifrost-off:checked~#rg-clash-direct:checked~.rg-shell .path-browser-clash-direct,#rg-req-claude:checked~#rg-bifrost-off:checked~#rg-clash-direct:checked~.rg-shell .path-browser-clash-direct,#rg-req-browser:checked~#rg-bifrost-off:checked~#rg-clash-node:checked~.rg-shell .path-browser-clash-node,#rg-req-claude:checked~#rg-bifrost-off:checked~#rg-clash-node:checked~.rg-shell .path-browser-clash-node,#rg-req-browser:checked~#rg-bifrost-direct:checked~.rg-shell .path-browser-bf-direct,#rg-req-claude:checked~#rg-bifrost-direct:checked~.rg-shell .path-browser-bf-direct,#rg-req-browser:checked~#rg-bifrost-chain:checked~#rg-clash-off:checked~.rg-shell .path-browser-chain-off,#rg-req-claude:checked~#rg-bifrost-chain:checked~#rg-clash-off:checked~.rg-shell .path-browser-chain-off,#rg-req-browser:checked~#rg-bifrost-chain:checked~#rg-clash-skip:checked~.rg-shell .path-browser-chain-skip,#rg-req-claude:checked~#rg-bifrost-chain:checked~#rg-clash-skip:checked~.rg-shell .path-browser-chain-skip,#rg-req-browser:checked~#rg-bifrost-chain:checked~#rg-clash-direct:checked~.rg-shell .path-browser-chain-direct,#rg-req-claude:checked~#rg-bifrost-chain:checked~#rg-clash-direct:checked~.rg-shell .path-browser-chain-direct,#rg-req-browser:checked~#rg-bifrost-chain:checked~#rg-clash-node:checked~.rg-shell .path-browser-chain-node,#rg-req-claude:checked~#rg-bifrost-chain:checked~#rg-clash-node:checked~.rg-shell .path-browser-chain-node,#rg-req-intranet:checked~#rg-feilian-speed:checked~#rg-bifrost-off:checked~#rg-clash-skip:checked~.rg-shell .path-intra-bf-off,#rg-req-intranet:checked~#rg-feilian-global:checked~#rg-bifrost-off:checked~#rg-clash-skip:checked~.rg-shell .path-intra-bf-off,#rg-req-intranet:checked~#rg-feilian-off:checked~#rg-bifrost-off:checked~#rg-clash-skip:checked~.rg-shell .path-intra-bf-off-no,#rg-req-intranet:checked~#rg-bifrost-off:checked~#rg-clash-off:checked~.rg-shell .path-intra-clash-off,#rg-req-intranet:checked~#rg-feilian-speed:checked~#rg-bifrost-off:checked~#rg-clash-direct:checked~.rg-shell .path-intra-clash-direct,#rg-req-intranet:checked~#rg-feilian-global:checked~#rg-bifrost-off:checked~#rg-clash-direct:checked~.rg-shell .path-intra-clash-direct,#rg-req-intranet:checked~#rg-feilian-off:checked~#rg-bifrost-off:checked~#rg-clash-direct:checked~.rg-shell .path-intra-clash-direct-no,#rg-req-intranet:checked~#rg-bifrost-off:checked~#rg-clash-node:checked~.rg-shell .path-intra-clash-node,#rg-req-intranet:checked~#rg-feilian-speed:checked~#rg-bifrost-direct:checked~.rg-shell .path-intra-bf-direct,#rg-req-intranet:checked~#rg-feilian-global:checked~#rg-bifrost-direct:checked~.rg-shell .path-intra-bf-direct,#rg-req-intranet:checked~#rg-feilian-off:checked~#rg-bifrost-direct:checked~.rg-shell .path-intra-bf-direct-no,#rg-req-intranet:checked~#rg-bifrost-chain:checked~#rg-clash-off:checked~.rg-shell .path-intra-chain-off,#rg-req-intranet:checked~#rg-bifrost-chain:checked~#rg-clash-skip:checked~.rg-shell .path-intra-chain-skip,#rg-req-intranet:checked~#rg-feilian-speed:checked~#rg-bifrost-chain:checked~#rg-clash-direct:checked~.rg-shell .path-intra-chain-direct,#rg-req-intranet:checked~#rg-feilian-global:checked~#rg-bifrost-chain:checked~#rg-clash-direct:checked~.rg-shell .path-intra-chain-direct,#rg-req-intranet:checked~#rg-feilian-off:checked~#rg-bifrost-chain:checked~#rg-clash-direct:checked~.rg-shell .path-intra-chain-direct-no,#rg-req-intranet:checked~#rg-bifrost-chain:checked~#rg-clash-node:checked~.rg-shell .path-intra-chain-node{display:grid}
    .request-gates-html .rg-side{margin-top:1rem;border:1px solid var(--hair);border-radius:8px;background:rgba(255,255,255,.35);padding:.9rem;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.72rem;min-width:0}.request-gates-html .rg-panel{border-left:4px solid var(--blue);padding:.22rem 0 .22rem .72rem;min-width:0}.request-gates-html .rg-panel.green{border-left-color:var(--green)}.request-gates-html .rg-panel.gold{border-left-color:var(--gold)}.request-gates-html .rg-panel.warn{border-left-color:var(--red)}.request-gates-html .rg-panel b{display:block;font-size:.88rem;line-height:1.3}.request-gates-html .rg-panel small{display:block;margin-top:.34rem;color:var(--muted);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.62rem;line-height:1.45}.request-gates-html figcaption{margin:.8rem 0 0;color:var(--muted);font-size:.9rem;line-height:1.6}
    @keyframes rg-run-3{0%{left:6%;opacity:0}5%,16%{left:6%;opacity:1}46%,60%{left:50%;opacity:1}84%,95%{left:94%;opacity:1}100%{left:94%;opacity:0}}@keyframes rg-run-4{0%{left:5%;opacity:0}5%,14%{left:5%;opacity:1}34%,45%{left:35%}61%,72%{left:65%}90%,97%{left:95%;opacity:1}100%{left:95%;opacity:0}}@keyframes rg-run-5{0%{left:4%;opacity:0}5%,13%{left:4%;opacity:1}27%,38%{left:27%}47%,58%{left:50%}67%,78%{left:73%}90%,97%{left:96%;opacity:1}100%{left:96%;opacity:0}}@keyframes rg-run-6{0%{left:4%;opacity:0}5%,12%{left:4%;opacity:1}22%,32%{left:22%}40%,50%{left:40%}58%,68%{left:58%}76%,86%{left:76%}93%,98%{left:96%;opacity:1}100%{left:96%;opacity:0}}@keyframes rg-run-7{0%{left:3%;opacity:0}5%,11%{left:3%;opacity:1}18%,27%{left:18%}33%,42%{left:33%}48%,57%{left:49%}63%,72%{left:64%}78%,87%{left:80%}94%,98%{left:96%;opacity:1}100%{left:96%;opacity:0}}@keyframes rg-run-fail{0%{left:5%;opacity:0}8%,18%{left:5%;opacity:1}42%,55%{left:48%}78%,100%{left:86%;opacity:1}}@keyframes rg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}@keyframes rg-step-a{0%,100%{transform:rotate(24deg)}50%{transform:rotate(-24deg)}}@keyframes rg-step-b{0%,100%{transform:rotate(-24deg)}50%{transform:rotate(24deg)}}@keyframes rg-stamp{0%,12%{opacity:0;transform:rotate(-20deg) scale(1.45)}18%,32%{opacity:.9;transform:rotate(-10deg) scale(.92)}46%,100%{opacity:0;transform:rotate(-10deg) scale(.92)}}@keyframes rg-door-left{0%,15%{transform:perspective(220px) rotateY(0)}23%,35%{transform:perspective(220px) rotateY(-78deg)}48%,100%{transform:perspective(220px) rotateY(0)}}@keyframes rg-door-right{0%,15%{transform:perspective(220px) rotateY(0)}23%,35%{transform:perspective(220px) rotateY(78deg)}48%,100%{transform:perspective(220px) rotateY(0)}}@keyframes rg-fail-pulse{0%,100%{background:var(--red)}50%{background:#2d2a26}}@media(max-width:1120px){.request-gates-html .rg-control-matrix{grid-template-columns:1fr}.request-gates-html .group-request .rg-options,.request-gates-html .group-clash .rg-options{grid-template-columns:repeat(2,minmax(0,1fr))}.request-gates-html .rg-path{grid-template-columns:repeat(2,minmax(0,1fr));padding-bottom:0}.request-gates-html .rg-runner,.request-gates-html .rg-step:before{display:none}.request-gates-html .rg-notices,.request-gates-html .rg-side{grid-template-columns:1fr 1fr}}@media(max-width:680px){.request-gates-html{padding:14px}.request-gates-html .rg-head{display:block}.request-gates-html .rg-tools{justify-content:flex-start;margin-top:.7rem}.request-gates-html .rg-options,.request-gates-html .group-request .rg-options,.request-gates-html .group-clash .rg-options{grid-template-columns:1fr}.request-gates-html .rg-path,.request-gates-html .rg-notices,.request-gates-html .rg-side{grid-template-columns:1fr}.request-gates-html .rg-board{padding:.75rem}.request-gates-html .gate-leaves{display:none}.request-gates-html .rg-step.app,.request-gates-html .rg-step.net-gate{padding-top:.62rem}}@media(prefers-reduced-motion:reduce){.request-gates-html .rg-board *{animation:none!important}.request-gates-html .rg-runner{display:none}}
  </style>
  <input class="rg-state" type="radio" name="rg-request" id="rg-req-browser">
  <input class="rg-state" type="radio" name="rg-request" id="rg-req-cli">
  <input class="rg-state" type="radio" name="rg-request" id="rg-req-local">
  <input class="rg-state" type="radio" name="rg-request" id="rg-req-intranet">
  <input class="rg-state" type="radio" name="rg-request" id="rg-req-claude" checked>
  <input class="rg-state" type="radio" name="rg-feilian-mode" id="rg-feilian-speed" checked>
  <input class="rg-state" type="radio" name="rg-feilian-mode" id="rg-feilian-global">
  <input class="rg-state" type="radio" name="rg-feilian-mode" id="rg-feilian-off">
  <input class="rg-state" type="radio" name="rg-bifrost-mode" id="rg-bifrost-off">
  <input class="rg-state" type="radio" name="rg-bifrost-mode" id="rg-bifrost-direct">
  <input class="rg-state" type="radio" name="rg-bifrost-mode" id="rg-bifrost-chain" checked>
  <input class="rg-state" type="radio" name="rg-clash-mode" id="rg-clash-off">
  <input class="rg-state" type="radio" name="rg-clash-mode" id="rg-clash-skip">
  <input class="rg-state" type="radio" name="rg-clash-mode" id="rg-clash-direct">
  <input class="rg-state" type="radio" name="rg-clash-mode" id="rg-clash-node" checked>
  <div class="rg-shell">
    <div class="rg-head"><div><div class="rg-kicker">Interactive request lab</div><div class="rg-title">四个开关，拼出这条请求的真实路径</div></div><div class="rg-tools"><button class="rg-step-action" type="button" data-rg-prev aria-label="后退一步" disabled>后退一步</button><button class="rg-step-action" type="button" data-rg-next aria-label="前进一步">前进一步</button><div class="rg-legend"><span class="rg-pill">蓝色：应用层代理</span><span class="rg-pill">绿色：飞连/网络层</span><span class="rg-pill">黄色：代理出口/目标</span></div></div></div>
    <div class="rg-control-matrix">
      <div class="rg-control-group group-request"><div class="rg-mode-title">请求场景</div><div class="rg-options" role="radiogroup" aria-label="请求场景"><label for="rg-req-browser"><b>浏览器</b><small>Chrome 访问普通外网</small></label><label for="rg-req-cli"><b>CLI</b><small>Claude Code 访问 Claude</small></label><label for="rg-req-local"><b>localhost</b><small>本机 127.0.0.1 / ::1</small></label><label for="rg-req-intranet"><b>内网</b><small>公司域名 / 网段</small></label><label for="rg-req-claude"><b>Claude</b><small>浏览器访问 Claude 域名</small></label></div></div>
      <div class="rg-control-group"><div class="rg-mode-title">飞连状态</div><div class="rg-options" role="radiogroup" aria-label="飞连状态"><label for="rg-feilian-speed"><b>极速模式</b><small>按目标覆盖；外网可能 en0</small></label><label for="rg-feilian-global"><b>全局模式</b><small>公网目标先进入 utunX</small></label><label for="rg-feilian-off"><b>不开</b><small>没有飞连隧道接管</small></label></div></div>
      <div class="rg-control-group"><div class="rg-mode-title">Bifrost 状态</div><div class="rg-options" role="radiogroup" aria-label="Bifrost 状态"><label for="rg-bifrost-off"><b>关闭</b><small>浏览器不进 8899</small></label><label for="rg-bifrost-direct"><b>DIRECT</b><small>接住系统代理但直连</small></label><label for="rg-bifrost-chain"><b>串联 Clash</b><small>显式转给 127.0.0.1:7897</small></label></div></div>
      <div class="rg-control-group group-clash"><div class="rg-mode-title">Clash Verge 状态</div><div class="rg-options" role="radiogroup" aria-label="Clash Verge 状态"><label for="rg-clash-off"><b>关闭</b><small>7897 不监听</small></label><label for="rg-clash-skip"><b>未进入</b><small>请求没有到 Clash</small></label><label for="rg-clash-direct"><b>DIRECT</b><small>进了 Clash 但直连</small></label><label for="rg-clash-node"><b>命中节点</b><small>规则转远端代理</small></label></div></div>
    </div>
    <div class="rg-readout" aria-label="当前选择"><b>当前选择</b><span class="rg-chip chip-req-browser">请求：浏览器</span><span class="rg-chip chip-req-cli">请求：CLI</span><span class="rg-chip chip-req-local">请求：localhost</span><span class="rg-chip chip-req-intranet">请求：内网</span><span class="rg-chip chip-req-claude">请求：Claude</span><span class="rg-chip chip-feilian-speed">飞连：极速</span><span class="rg-chip chip-feilian-global">飞连：全局</span><span class="rg-chip chip-feilian-off">飞连：不开</span><span class="rg-chip chip-bifrost-off">Bifrost：关闭</span><span class="rg-chip chip-bifrost-direct">Bifrost：DIRECT</span><span class="rg-chip chip-bifrost-chain">Bifrost：串联 Clash</span><span class="rg-chip chip-clash-off">Clash：关闭</span><span class="rg-chip chip-clash-skip">Clash：未进入</span><span class="rg-chip chip-clash-direct">Clash：DIRECT</span><span class="rg-chip chip-clash-node">Clash：命中节点</span></div>
    <div class="rg-board">
      <div class="rg-board-title"><div><b>当前路径</b><small data-rg-meter>第 1 步：发起端</small></div><small>点按钮让小人前进或后退；路径只画实际经过的应用层门和网络层门。</small></div>
      <div class="rg-stage">
        <div class="rg-path path-local cols-4" style="--cols:4"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>发起端</b><small>localhost / 127.0.0.1 / ::1</small></div><div class="rg-step app" data-stamp="NO" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>NO_PROXY 命中，本机地址不交给代理。</small></div><div class="rg-step loop net-gate" data-stamp="lo0" style="--d:2s"><span class="gate-leaves"></span><b>网络层门 / loopback</b><small>走 lo0 本机闭环，不经过 en0 / utunX。</small></div><div class="rg-step target" data-stamp="达" style="--d:3s"><b>本机服务</b><small>Bifrost、Clash、飞连选择都应该被忽略。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-cli-skip cols-4" style="--cols:4"><div class="rg-step source" data-stamp="CLI" style="--d:.1s"><b>Claude Code CLI</b><small>没有 HTTP_PROXY / wrapper，或者显式选择未进入 Clash。</small></div><div class="rg-step app ghost" data-stamp="跳" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>跳过 7897；Bifrost 系统代理对 CLI 通常无效。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:2s"><span class="gate-leaves"></span><b>网络层门 / macOS 路由</b><small><span class="fe fe-speed">极速：普通 Claude 外联多半回 en0，除非目标被覆盖。</span><span class="fe fe-global">全局：CLI 直连流量先走 utunX，再到飞连网关。</span><span class="fe fe-off">飞连不开：普通公网回 en0。</span></small></div><div class="rg-step target" data-stamp="达" style="--d:3s"><b>Claude</b><small>目标看到的是底层路由出口，不是 Clash 节点。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-cli-off cols-3 fail-path" style="--cols:3"><div class="rg-step source" data-stamp="CLI" style="--d:.1s"><b>Claude Code CLI</b><small>环境变量或 wrapper 指向 127.0.0.1:7897。</small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>CLI 主动连接 Clash 代理端口。</small></div><div class="rg-step fail" data-stamp="断" style="--d:2s"><b>Clash 关闭</b><small>7897 没有监听，请求在本机代理入口失败。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-cli-direct cols-5" style="--cols:5"><div class="rg-step source" data-stamp="CLI" style="--d:.1s"><b>Claude Code CLI</b><small>HTTP_PROXY / HTTPS_PROXY 指向 7897。</small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>请求直接进入 Clash，不经过 Bifrost。</small></div><div class="rg-step clash" data-stamp="DIR" style="--d:2s"><b>Clash DIRECT</b><small>规则命中直连，Mihomo 不连远端节点。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:3s"><span class="gate-leaves"></span><b>网络层门 / macOS 路由</b><small><span class="fe fe-speed">极速：普通外网多半从 en0 出去。</span><span class="fe fe-global">全局：DIRECT 流量先进入 utunX。</span><span class="fe fe-off">飞连不开：从 en0 出去。</span></small></div><div class="rg-step target" data-stamp="达" style="--d:4s"><b>Claude</b><small>Claude 看到的是直连出口，不是英国节点。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-cli-node cols-6" style="--cols:6"><div class="rg-step source" data-stamp="CLI" style="--d:.1s"><b>Claude Code CLI</b><small>HTTP_PROXY / HTTPS_PROXY 指向 7897。</small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>CLI 直接进入 Clash，Bifrost 不参与。</small></div><div class="rg-step clash" data-stamp="节点" style="--d:2s"><b>Clash 命中节点</b><small>Mihomo 规则选择远端代理。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:3s"><span class="gate-leaves"></span><b>网络层门 / 连远端节点</b><small><span class="fe fe-speed">极速：连英国节点这段通常走 en0，除非被飞连覆盖。</span><span class="fe fe-global">全局：连英国节点这段先走 utunX，再到飞连网关。</span><span class="fe fe-off">飞连不开：连英国节点这段走 en0。</span></small></div><div class="rg-step remote" data-stamp="UK" style="--d:4s"><b>远端代理节点</b><small>节点收到原始 CONNECT / TLS 流量后再访问 Claude。</small></div><div class="rg-step target" data-stamp="达" style="--d:5s"><b>Claude</b><small>Claude 最终看到远端节点 IP。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-browser-bf-off cols-4" style="--cols:4"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small><span class="target-web">普通外网请求</span><span class="target-claude">Claude 域名请求</span></small></div><div class="rg-step app ghost" data-stamp="跳" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理没有交给 Bifrost，也没有交给 Clash。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:2s"><span class="gate-leaves"></span><b>网络层门 / macOS 路由</b><small><span class="fe fe-speed">极速：普通外网可能仍走 en0。</span><span class="fe fe-global">全局：外联先进入 utunX。</span><span class="fe fe-off">飞连不开：从 en0 出去。</span></small></div><div class="rg-step target" data-stamp="达" style="--d:3s"><b><span class="target-web">目标网站</span><span class="target-claude">Claude</span></b><small>本机代理没进场，目标看到底层路由出口。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-browser-clash-off cols-3 fail-path" style="--cols:3"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small><span class="target-web">普通外网请求</span><span class="target-claude">Claude 域名请求</span></small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理直接指向 Clash 7897，Bifrost 不参与。</small></div><div class="rg-step fail" data-stamp="断" style="--d:2s"><b>Clash 关闭</b><small>7897 不监听，请求停在本机代理入口。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-browser-clash-direct cols-5" style="--cols:5"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small><span class="target-web">普通外网请求</span><span class="target-claude">Claude 域名请求</span></small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理第一跳直接进入 Clash。</small></div><div class="rg-step clash" data-stamp="DIR" style="--d:2s"><b>Clash DIRECT</b><small>Mihomo 收到请求，但规则选择直连。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:3s"><span class="gate-leaves"></span><b>网络层门 / macOS 路由</b><small><span class="fe fe-speed">极速：DIRECT 目标按覆盖判断，普通外网可能 en0。</span><span class="fe fe-global">全局：DIRECT 流量先进入 utunX。</span><span class="fe fe-off">飞连不开：DIRECT 流量走 en0。</span></small></div><div class="rg-step target" data-stamp="达" style="--d:4s"><b><span class="target-web">目标网站</span><span class="target-claude">Claude</span></b><small>目标看到直连出口，不是代理节点。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-browser-clash-node cols-6" style="--cols:6"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small><span class="target-web">普通外网请求</span><span class="target-claude">Claude 域名请求</span></small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理第一跳直接进入 Clash，Bifrost 不参与。</small></div><div class="rg-step clash" data-stamp="节点" style="--d:2s"><b>Clash 命中节点</b><small>Mihomo 选择远端代理。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:3s"><span class="gate-leaves"></span><b>网络层门 / 连远端节点</b><small><span class="fe fe-speed">极速：连节点这段通常走 en0，除非被飞连覆盖。</span><span class="fe fe-global">全局：连节点这段先走 utunX，再到飞连网关。</span><span class="fe fe-off">飞连不开：连节点这段走 en0。</span></small></div><div class="rg-step remote" data-stamp="UK" style="--d:4s"><b>远端代理节点</b><small>节点再代表你访问最终网站。</small></div><div class="rg-step target" data-stamp="达" style="--d:5s"><b><span class="target-web">目标网站</span><span class="target-claude">Claude</span></b><small>最终看到远端代理节点 IP。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-browser-bf-direct cols-5" style="--cols:5"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small><span class="target-web">普通外网请求</span><span class="target-claude">Claude 域名请求</span></small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理先进 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="DIR" style="--d:2s"><b>Bifrost DIRECT</b><small>规则选择直连，不转发到 7897。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:3s"><span class="gate-leaves"></span><b>网络层门 / macOS 路由</b><small><span class="fe fe-speed">极速：普通外网可能仍走 en0。</span><span class="fe fe-global">全局：Bifrost 外连先进入 utunX。</span><span class="fe fe-off">飞连不开：Bifrost 从 en0 外连。</span></small></div><div class="rg-step target" data-stamp="达" style="--d:4s"><b><span class="target-web">目标网站</span><span class="target-claude">Claude</span></b><small>Clash 旁观，目标看不到远端节点 IP。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-browser-chain-off cols-4 fail-path" style="--cols:4"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>系统代理交给 Bifrost。</small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>浏览器进入 127.0.0.1:8899。</small></div><div class="rg-step bifrost" data-stamp="转" style="--d:2s"><b>Bifrost 串联</b><small>规则要求转给 127.0.0.1:7897。</small></div><div class="rg-step fail" data-stamp="断" style="--d:3s"><b>Clash 关闭</b><small>7897 不监听，请求停在本机。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-browser-chain-skip cols-4 fail-path" style="--cols:4"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>系统代理交给 Bifrost。</small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>浏览器进入 8899。</small></div><div class="rg-step bifrost" data-stamp="转" style="--d:2s"><b>Bifrost 串联</b><small>这一状态要求请求进入 Clash。</small></div><div class="rg-step fail" data-stamp="矛盾" style="--d:3s"><b>Clash 未进入</b><small>和“Bifrost 串联 Clash”冲突，不能当作一条真实路径。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-browser-chain-direct cols-6" style="--cols:6"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small><span class="target-web">普通外网请求</span><span class="target-claude">Claude 域名请求</span></small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理先进 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="转" style="--d:2s"><b>Bifrost 串联</b><small>显式上游转给 7897。</small></div><div class="rg-step clash" data-stamp="DIR" style="--d:3s"><b>Clash DIRECT</b><small>进了 Clash，但规则选择直连。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:4s"><span class="gate-leaves"></span><b>网络层门 / macOS 路由</b><small><span class="fe fe-speed">极速：DIRECT 目标按覆盖判断，普通外网可能 en0。</span><span class="fe fe-global">全局：DIRECT 流量先进入 utunX。</span><span class="fe fe-off">飞连不开：DIRECT 流量走 en0。</span></small></div><div class="rg-step target" data-stamp="达" style="--d:5s"><b><span class="target-web">目标网站</span><span class="target-claude">Claude</span></b><small>目标看到直连出口，不是代理节点。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-browser-chain-node cols-7" style="--cols:7"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small><span class="target-web">普通外网请求</span><span class="target-claude">Claude 域名请求</span></small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理先进 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="转" style="--d:2s"><b>Bifrost 串联</b><small>把 HTTP CONNECT / TLS 转给 7897。</small></div><div class="rg-step clash" data-stamp="节点" style="--d:3s"><b>Clash 命中节点</b><small>Mihomo 选择远端代理。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:4s"><span class="gate-leaves"></span><b>网络层门 / 连远端节点</b><small><span class="fe fe-speed">极速：连节点这段通常走 en0，除非被飞连覆盖。</span><span class="fe fe-global">全局：连节点这段先走 utunX，再到飞连网关。</span><span class="fe fe-off">飞连不开：连节点这段走 en0。</span></small></div><div class="rg-step remote" data-stamp="UK" style="--d:5s"><b>远端代理节点</b><small>节点再代表你访问最终网站。</small></div><div class="rg-step target" data-stamp="达" style="--d:6s"><b><span class="target-web">目标网站</span><span class="target-claude">Claude</span></b><small>最终看到远端代理节点 IP。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-bf-off cols-5" style="--cols:5"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网域名 / 网段。</small></div><div class="rg-step app ghost" data-stamp="跳" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>Bifrost 和 Clash 都没接住，直接进入系统路由。</small></div><div class="rg-step route net-gate" data-stamp="utun" style="--d:2s"><span class="gate-leaves"></span><b>网络层门 / utunX</b><small><span class="fe fe-speed">极速：公司网段命中覆盖路由，先进入 utunX。</span><span class="fe fe-global">全局：内网目标先进入 utunX。</span></small></div><div class="rg-step route" data-stamp="网关" style="--d:3s"><b>飞连网关</b><small>飞连客户端把内层目标送到企业网关，网关再转发到公司网络。</small></div><div class="rg-step target" data-stamp="内网" style="--d:4s"><b>公司内网</b><small>这是内网目标的正常方向，不应该送到远端代理节点。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-bf-off-no cols-4 fail-path" style="--cols:4"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网域名 / 网段。</small></div><div class="rg-step app ghost" data-stamp="跳" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>Bifrost 和 Clash 都没接住，直接进入系统路由。</small></div><div class="rg-step fail" data-stamp="断" style="--d:2s"><b>没有飞连网关</b><small>飞连不开，内网网段没有可用企业隧道。</small></div><div class="rg-step fail" data-stamp="不可达" style="--d:3s"><b>公司内网不可达</b><small>这时需要先打开飞连，或确认内网有其他可达路径。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-clash-off cols-3 fail-path" style="--cols:3"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网域名 / 网段。</small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理直接指向 Clash 7897，Bifrost 不参与。</small></div><div class="rg-step fail" data-stamp="断" style="--d:2s"><b>Clash 关闭</b><small>7897 不监听，请求停在本机代理入口。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-clash-direct cols-6" style="--cols:6"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网域名 / 网段。</small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理第一跳直接进入 Clash。</small></div><div class="rg-step clash" data-stamp="DIR" style="--d:2s"><b>Clash DIRECT</b><small>规则没有命中远端节点，交回网络层。</small></div><div class="rg-step route net-gate" data-stamp="utun" style="--d:3s"><span class="gate-leaves"></span><b>网络层门 / utunX</b><small><span class="fe fe-speed">极速：公司网段命中覆盖路由，先进入 utunX。</span><span class="fe fe-global">全局：内网目标先进入 utunX。</span></small></div><div class="rg-step route" data-stamp="网关" style="--d:4s"><b>飞连网关</b><small>飞连网关再把请求送入企业网络。</small></div><div class="rg-step target" data-stamp="内网" style="--d:5s"><b>公司内网</b><small>Clash DIRECT 之后仍由飞连覆盖路由接管内网。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-clash-direct-no cols-5 fail-path" style="--cols:5"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网域名 / 网段。</small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理第一跳直接进入 Clash。</small></div><div class="rg-step clash" data-stamp="DIR" style="--d:2s"><b>Clash DIRECT</b><small>规则直连，交回系统路由。</small></div><div class="rg-step fail" data-stamp="断" style="--d:3s"><b>没有飞连网关</b><small>飞连不开，DIRECT 之后也没有企业隧道可走。</small></div><div class="rg-step fail" data-stamp="不可达" style="--d:4s"><b>公司内网不可达</b><small>需要让飞连先接上企业网络。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-clash-node cols-6 fail-path" style="--cols:6"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网域名 / 网段。</small></div><div class="rg-step app" data-stamp="7897" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>系统代理第一跳直接进入 Clash。</small></div><div class="rg-step clash" data-stamp="节点" style="--d:2s"><b>Clash 命中节点</b><small>内网目标被错误送往远端代理。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:3s"><span class="gate-leaves"></span><b>网络层门 / 连远端节点</b><small><span class="fe fe-speed">极速：连远端节点这段按覆盖判断。</span><span class="fe fe-global">全局：连远端节点这段先走 utunX。</span><span class="fe fe-off">飞连不开：连远端节点这段走 en0。</span></small></div><div class="rg-step remote" data-stamp="UK" style="--d:4s"><b>远端代理节点</b><small>远端节点通常访问不到你的公司内网。</small></div><div class="rg-step fail" data-stamp="错" style="--d:5s"><b>内网不可达</b><small>规则应改成 DIRECT / 飞连路径。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-bf-direct cols-6" style="--cols:6"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网域名 / 网段。</small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>浏览器先进 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="DIR" style="--d:2s"><b>Bifrost DIRECT</b><small>内网规则直连，不转给 Clash。</small></div><div class="rg-step route net-gate" data-stamp="utun" style="--d:3s"><span class="gate-leaves"></span><b>网络层门 / utunX</b><small><span class="fe fe-speed">极速：公司网段命中覆盖路由，先进入 utunX。</span><span class="fe fe-global">全局：内网目标先进入 utunX。</span></small></div><div class="rg-step route" data-stamp="网关" style="--d:4s"><b>飞连网关</b><small>飞连网关再把请求送入企业网络。</small></div><div class="rg-step target" data-stamp="内网" style="--d:5s"><b>公司内网</b><small>这是内网目标的正常方向。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-bf-direct-no cols-5 fail-path" style="--cols:5"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网域名 / 网段。</small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>浏览器先进 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="DIR" style="--d:2s"><b>Bifrost DIRECT</b><small>内网规则直连，不转给 Clash。</small></div><div class="rg-step fail" data-stamp="断" style="--d:3s"><b>没有飞连网关</b><small>飞连不开，直连也没有企业隧道可走。</small></div><div class="rg-step fail" data-stamp="不可达" style="--d:4s"><b>公司内网不可达</b><small>需要让飞连先接上企业网络。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-chain-off cols-4 fail-path" style="--cols:4"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网。</small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>进入 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="转" style="--d:2s"><b>Bifrost 串联</b><small>错误地要求转给 7897。</small></div><div class="rg-step fail" data-stamp="断" style="--d:3s"><b>Clash 关闭</b><small>7897 不监听，请求失败。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-chain-skip cols-4 fail-path" style="--cols:4"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网。</small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>进入 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="转" style="--d:2s"><b>Bifrost 串联</b><small>这一状态要求进入 Clash。</small></div><div class="rg-step fail" data-stamp="矛盾" style="--d:3s"><b>Clash 未进入</b><small>和串联配置冲突，不能视为真实链路。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-chain-direct cols-7" style="--cols:7"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网。</small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>进入 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="转" style="--d:2s"><b>Bifrost 串联</b><small>转给 Clash，但后续规则仍可 DIRECT。</small></div><div class="rg-step clash" data-stamp="DIR" style="--d:3s"><b>Clash DIRECT</b><small>没有命中远端节点。</small></div><div class="rg-step route net-gate" data-stamp="utun" style="--d:4s"><span class="gate-leaves"></span><b>网络层门 / utunX</b><small><span class="fe fe-speed">极速：公司网段命中覆盖路由，先进入 utunX。</span><span class="fe fe-global">全局：内网目标先进入 utunX。</span></small></div><div class="rg-step route" data-stamp="网关" style="--d:5s"><b>飞连网关</b><small>网关把请求继续送入企业网络。</small></div><div class="rg-step target" data-stamp="内网" style="--d:6s"><b>公司内网</b><small>虽然绕了一圈，但最终仍应该经飞连网关到公司内网。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-chain-direct-no cols-6 fail-path" style="--cols:6"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网。</small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>进入 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="转" style="--d:2s"><b>Bifrost 串联</b><small>转给 Clash，但后续规则仍可 DIRECT。</small></div><div class="rg-step clash" data-stamp="DIR" style="--d:3s"><b>Clash DIRECT</b><small>没有命中远端节点。</small></div><div class="rg-step fail" data-stamp="断" style="--d:4s"><b>没有飞连网关</b><small>飞连不开，DIRECT 之后也没有企业隧道可走。</small></div><div class="rg-step fail" data-stamp="不可达" style="--d:5s"><b>公司内网不可达</b><small>需要让飞连先接上企业网络。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
        <div class="rg-path path-intra-chain-node cols-7 fail-path" style="--cols:7"><div class="rg-step source" data-stamp="起" style="--d:.1s"><b>浏览器</b><small>访问公司内网。</small></div><div class="rg-step app" data-stamp="8899" style="--d:1s"><span class="gate-leaves"></span><b>应用层门</b><small>进入 Bifrost。</small></div><div class="rg-step bifrost" data-stamp="转" style="--d:2s"><b>Bifrost 串联</b><small>把内网请求送到 Clash。</small></div><div class="rg-step clash" data-stamp="节点" style="--d:3s"><b>Clash 命中节点</b><small>内网目标被错误送往远端代理。</small></div><div class="rg-step route net-gate" data-stamp="路" style="--d:4s"><span class="gate-leaves"></span><b>网络层门 / 连远端节点</b><small><span class="fe fe-speed">极速：连远端节点这段按覆盖判断。</span><span class="fe fe-global">全局：连远端节点这段先走 utunX。</span><span class="fe fe-off">飞连不开：连远端节点这段走 en0。</span></small></div><div class="rg-step remote" data-stamp="UK" style="--d:5s"><b>远端代理节点</b><small>远端节点通常访问不到你的公司内网。</small></div><div class="rg-step fail" data-stamp="错" style="--d:6s"><b>内网不可达</b><small>规则应改成 DIRECT / 飞连路径。</small></div><div class="rg-runner"><span class="ci"><span class="cp"></span><span class="cc"></span><span class="ch"></span><span class="cm"></span><span class="cb"></span><span class="cl a"></span><span class="cl b"></span></span></div></div>
      </div>
      <div class="rg-notices" aria-label="当前组合判断"><div class="rg-notice"><b>这组选择怎么走</b><span>选择任意场景后，这里会按应用层门、网络层门和最终出口重新解释链路。</span></div><div class="rg-notice"><b>当前代理入口 / 出口</b><span>这里会随选择显示 macOS 系统代理是否进入 8899，以及远端代理节点是否被使用。</span></div><div class="rg-notice good"><b>状态说明</b><span>没有进入路径的工具表示这条请求没有触发它。</span></div></div>
    </div>
    <div class="rg-side"><div class="rg-panel"><b>请求场景</b><small>这里会随浏览器、CLI、localhost、内网、Claude 场景切换。</small></div><div class="rg-panel"><b>应用层门：Bifrost</b><small>说明系统代理是否进入 8899，以及是否转给 7897。</small></div><div class="rg-panel gold"><b>应用层门：Clash Verge</b><small>说明请求是否进入 7897，以及 DIRECT / 节点是否真正生效。</small></div><div class="rg-panel green"><b>网络层门：飞连</b><small>说明 en0、utunX 和飞连网关和最终出口。</small></div></div>
  </div>
  <figcaption>这个交互图表达的是决策顺序，不是抓包结果：“两扇门”是抽象层次，第一扇是应用层门（系统代理、Bifrost、Clash 7897），第二扇是网络层门（<code>en0</code>、<code>utunX</code>）；如果网络层命中飞连隧道，图里会继续画出隧道另一端的飞连网关。路径只画真实经过的节点；被跳过的工具会在上方动态说明里解释。</figcaption>
</figure>

## 1. 先用五层模型把位置摆正

如果用常见的五层模型来划分，这几个东西大致在不同层：

| 层级 | 这一层关心什么 | 这次涉及的东西 |
| --- | --- | --- |
| 应用层 | HTTP、HTTPS、SOCKS、代理协议、应用是否读系统代理 | Chrome、Claude Code CLI、Bifrost `8899`、Clash / Mihomo `7897` |
| 传输层 | TCP / UDP 连接 | 浏览器连本机代理端口，代理程序连远端节点 |
| 网络层 | IP、路由、默认路由、目标 IP 从哪个接口出去 | `route -n get`、`en0`、`utunX` |
| 链路层 | 网卡、虚拟网卡如何承载 IP 包 | Wi-Fi、以太网、VPN 虚拟接口 |
| 物理层 | 真实硬件链路 | 无线网卡、有线网卡 |

这里最容易混的是：

```text
127.0.0.1:8899
127.0.0.1:7897
utun4
en0
```

它们不是同一种东西。

`127.0.0.1:8899` 和 `127.0.0.1:7897` 是本机应用层代理端口。浏览器或 CLI 可以主动连接这些端口，把 HTTP / HTTPS 请求交给代理程序。

`utun4` 和 `en0` 是网络接口。它们不理解 Claude，也不理解 HTTP 代理规则。它们只是在更底层回答一个问题：**某个目标 IP 的包，应该从哪个接口出去？**

## 2. 一条请求先要决定“第一跳”

所谓第一跳，就是应用准备发起连接时，先把请求交给谁。

对浏览器来说，第一跳通常要看 macOS 系统代理：

```bash
scutil --proxy
```

如果看到 HTTP / HTTPS 代理指向：

```text
127.0.0.1:8899
```

那么浏览器第一跳就是 Bifrost。

如果指向：

```text
127.0.0.1:7897
```

那么浏览器第一跳就是 Clash / Mihomo。

如果系统代理是关闭的：

```text
HTTPEnable : 0
HTTPSEnable : 0
SOCKSEnable : 0
```

那就不能直接说浏览器会进入 Bifrost 或 Clash。除非浏览器自己的代理设置、扩展、PAC 或企业策略另外接管了流量，否则它可能直接走系统网络栈。

对 Claude Code CLI 来说，第一跳又是另一回事。CLI 不一定读取 macOS 系统代理，更稳的方式是显式配置环境变量：

```bash
NO_PROXY=localhost,127.0.0.1,::1 \
HTTP_PROXY=http://127.0.0.1:7897 \
HTTPS_PROXY=http://127.0.0.1:7897 \
claude
```

所以同一台机器上可能同时成立：

```text
浏览器第一跳：Bifrost 8899
Claude Code CLI 第一跳：Clash 7897
```

这不是冲突，只是两个应用的入口不同。

## 3. 浏览器访问 Claude：先看 Bifrost 有没有显式串到 Clash

假设我在 Chrome 打开：

```text
https://claude.ai
```

这条请求不是一上来就直接飞到 Claude。浏览器会先看自己的代理设置或 macOS 系统代理。

如果系统代理指向 Bifrost：

```text
Chrome
  -> macOS 系统代理
  -> Bifrost 127.0.0.1:8899
```

到这里为止，请求还没有进入 Clash。Bifrost 和 Clash 都开着，并不代表它们自动串起来。

只有当 Bifrost 规则里明确写了类似：

```text
proxy://127.0.0.1:7897
```

或者：

```text
http-proxy://127.0.0.1:7897
```

这条 Claude 请求才会继续进入 Clash / Mihomo：

```text
Chrome
  -> Bifrost 127.0.0.1:8899
  -> Clash / Mihomo 127.0.0.1:7897
```

进入 Clash / Mihomo 之后，才轮到 Clash 规则判断：

```yaml
DOMAIN-SUFFIX,claude.ai,Claude
DOMAIN-SUFFIX,claude.com,Claude
DOMAIN-SUFFIX,anthropic.com,Claude
DOMAIN-SUFFIX,claudeusercontent.com,Claude
MATCH,DIRECT
```

如果命中 Claude 规则，它会走 Claude 规则组里的远端代理节点。

于是链路变成：

```text
Chrome
  -> Bifrost 8899
  -> Clash / Mihomo 7897
  -> 远端代理节点
  -> claude.ai
```

然后还有最后一层：Clash / Mihomo 作为本机进程，要连接远端代理节点。这个“往外连”的底层 IP 包，才会进入 macOS 路由判断：

```text
远端代理节点 IP
  -> route 决定走 en0 还是 utunX
```

## 4. Claude Code CLI 发请求：它不一定经过 Bifrost

终端里的 Claude Code CLI 和浏览器不一定走同一条入口。

如果给 CLI 显式设置：

```bash
HTTP_PROXY=http://127.0.0.1:7897
HTTPS_PROXY=http://127.0.0.1:7897
```

那么 Claude Code CLI 的链路是：

```text
claude
  -> HTTP_PROXY / HTTPS_PROXY
  -> Clash / Mihomo 127.0.0.1:7897
  -> Clash 规则判断
  -> 远端代理节点
  -> Claude API / Claude Web 相关目标
```

注意这里通常不经过 Bifrost，除非你专门把 CLI 的代理指到 Bifrost：

```bash
HTTP_PROXY=http://127.0.0.1:8899
```

如果 CLI 没有代理变量，链路会变成：

```text
claude
  -> 直接解析目标域名
  -> 直接连接目标 IP
  -> route 决定 en0 / utunX
```

这时 Clash 完全没参与。

所以“浏览器能访问 Claude”不等于“Claude Code CLI 也一定能访问”。浏览器可能靠 Bifrost 或系统代理进了 Clash；CLI 如果没有 `HTTP_PROXY` / `HTTPS_PROXY`，可能仍然直连。

## 5. Clash / Mihomo 到底做了什么

Clash Verge Rev 是图形界面和配置控制台，Mihomo / Clash.Meta 才是实际处理请求的代理核心。

它在本机监听一个端口，比如：

```text
127.0.0.1:7897
```

当浏览器、Bifrost 或 CLI 把请求交给它之后，Mihomo 会做几件事：

1. 看目标域名或目标 IP。
2. 按规则决定命中哪个策略组。
3. 如果命中 `DIRECT`，就由本机直接连目标。
4. 如果命中远端代理节点，就先连接那个代理节点。
5. 连接远端代理节点时，再交给 macOS 路由决定从哪个网络接口出去。

对于 HTTPS，最常见的是 HTTP `CONNECT` 隧道。标准语义是：客户端请求代理建立到目标服务器的 tunnel，成功后代理在两边之间双向转发数据。这个语义可以在 [RFC 9110 的 CONNECT 章节](https://datatracker.ietf.org/doc/html/rfc9110#section-9.3.6) 里看到。

所以方向是：

```text
Clash 主动连接英国代理节点
英国代理节点主动连接 Claude
```

不是：

```text
英国代理节点 -> 回头请求 Clash
```

如果是 HTTP CONNECT 代理，过程可以简化成：

```text
1. Clash 连接英国代理节点 IP:端口
2. Clash 对英国代理节点说：请帮我连 claude.ai:443
3. 英国代理节点连接 claude.ai:443
4. 连接建立后，英国代理节点在两边之间双向转发数据
```

SOCKS5 的模型也类似：客户端先连接 SOCKS 服务端，再发送 relay request，SOCKS 服务端评估请求后建立对应连接。[RFC 1928](https://datatracker.ietf.org/doc/html/rfc1928) 里把 SOCKS 描述成 application layer 和 transport layer 之间的 shim，而不是网络层网关。

## 6. 飞连在这条链路里的位置

飞连不是 HTTP 代理入口。它更接近底层网络路由和 VPN 隧道。

所以飞连通常不回答：

```text
这个域名是不是 Claude？
这个请求是不是应该走 IPRoyal-UK？
```

它回答的是：

```text
这个目标 IP 的包，从 en0 出去，还是从 utunX 出去？
```

可以先看默认路由：

```bash
route -n get default
```

但只看 `default` 不够。飞连全局模式可以不把 `default` 这一条直接改成 `utunX`，而是保留：

```text
default -> en0
```

同时下发一组更具体的公网覆盖路由。路由匹配按“最长前缀优先”，所以真实访问某些公网 IP 时，这些更具体的路由会盖过 `default`。因此 `route -n get default` 显示 `en0`，不等于外网请求没有进入飞连。

更靠谱的方式是查具体目标：

```bash
route -n get 1.1.1.1
route -n get 8.8.8.8
route -n get 远端代理节点IP
```

如果远端代理节点 IP 走 `utunX`，说明 Clash 连接远端代理节点这段底层流量又叠了一层飞连隧道。

这条链就变成：

```text
Chrome / Claude Code CLI
  -> Clash / Mihomo 7897
  -> 远端代理节点 IP
  -> route 命中 utunX
  -> 本机飞连隧道入口
  -> 飞连网关
  -> 远端代理节点
  -> Claude
```

这里有两个关键点。

第一，`utunX` 不是飞连网关。`utunX` 是本机上的虚拟隧道接口，表示这条流量已经被 macOS 交给飞连客户端接管。飞连网关是隧道另一端的远端服务端。

第二，**飞连网关不是业务目标。** Clash 真正想连的是“英国代理节点 IP:端口”。只是这段连接的内层包被系统路由送进了 `utunX`。飞连客户端把它封装成外层包发给飞连网关，飞连网关解封装以后，继续把内层包送往原本的目标，也就是英国代理节点。

所以可以分成两层目标：

```text
外层目标：飞连网关
内层目标：英国代理节点
```

走 `utunX` 不代表最后访问 Claude 的就是飞连 IP。更准确地说：

```text
飞连决定 Clash 怎么到达英国代理节点；
英国代理节点决定 Claude 最终看到哪个出口 IP。
```

如果没有 Clash 远端代理，只是 DIRECT 被飞连接管：

```text
Chrome
  -> 网络层门：目标是 Claude IP
  -> utunX
  -> 飞连网关
  -> Claude
```

这时 Claude 看到的是飞连 / 公司 VPN 出口。

如果有 Clash 远端代理，并且 Clash 连接英国代理这段被飞连接管：

```text
Chrome / Claude Code CLI
  -> Clash 选择英国代理节点
  -> 网络层门：目标是英国代理节点 IP
  -> utunX
  -> 飞连网关
  -> 英国代理节点
  -> Claude
```

这时英国代理服务商看到的来源是飞连网关的出口 IP；Claude 看到的是英国代理节点的出口 IP。

## 7. 几条常见请求路径

第一种：浏览器经 Bifrost 再经 Clash 访问 Claude。

```text
Chrome
  -> macOS 系统代理指向 8899
  -> Bifrost
  -> Bifrost 规则显式转给 7897
  -> Clash / Mihomo
  -> 命中 Claude 规则
  -> 下一跳变成英国代理节点 IP
  -> route 决定 en0 / utunX
  -> 如果命中 utunX：utunX -> 飞连网关
  -> 英国代理节点
  -> Claude
```

第二种：浏览器直接经 Clash 访问 Claude。

```text
Chrome
  -> macOS 系统代理指向 7897
  -> Clash / Mihomo
  -> 命中 Claude 规则
  -> 下一跳变成英国代理节点 IP
  -> route 决定 en0 / utunX
  -> 如果命中 utunX：utunX -> 飞连网关
  -> 英国代理节点
  -> Claude
```

第三种：Claude Code CLI 直接经 Clash。

```text
claude
  -> HTTP_PROXY / HTTPS_PROXY 指向 7897
  -> Clash / Mihomo
  -> 命中 Claude 规则
  -> 下一跳变成英国代理节点 IP
  -> route 决定 en0 / utunX
  -> 如果命中 utunX：utunX -> 飞连网关
  -> 英国代理节点
  -> Claude
```

第四种：CLI 没有代理变量。

```text
claude
  -> 没有 HTTP_PROXY / HTTPS_PROXY
  -> 直接连接目标
  -> route 决定 en0 / utunX
  -> 如果命中 utunX：utunX -> 飞连网关
  -> 目标网站
```

这时 Clash 没参与。是否能访问，取决于目标、DNS、飞连路由和当前网络环境。

第五种：浏览器访问公司内网或本地调试页面。

```text
Chrome
  -> Bifrost 8899
  -> Bifrost 规则命中本地 dev server 或公司内网
  -> 本地服务

Chrome
  -> Bifrost 8899（如果系统代理交给 Bifrost）
  -> Bifrost DIRECT / 或关闭
  -> macOS route 命中公司网段
  -> utunX
  -> 飞连网关
  -> 公司内网
```

这条链路不一定进入 Clash。本地 dev server 仍然应该留在本机闭环；公司内网则应该先进入飞连在本机创建的 `utunX` 隧道，再到飞连网关，最后由网关送进企业网络。Bifrost 的重点不是“所有流量都翻到国外”，而是作为浏览器调试入口，把不同域名送到不同地方。

## 8. 本机验证快照

下面是一段本机环境快照，不是所有人的固定配置。它的价值在于说明怎么验证，而不是要求每台机器都长一样。验证时飞连处于全局模式。

当前 `scutil --proxy` 显示系统代理关闭：

```text
HTTPEnable : 0
HTTPSEnable : 0
ProxyAutoConfigEnable : 0
SOCKSEnable : 0
```

这说明此刻不能把浏览器链路直接写成“浏览器一定先进入 Bifrost 或 Clash”。要么浏览器另有自己的代理设置，要么它没有通过 macOS 系统代理进入这些端口。

但两个本机服务端口确实在监听：

```text
Bifrost       *:8899
verge-mihomo  127.0.0.1:7897
```

路由层则是另一件事。默认路由仍然是：

```text
default -> en0
```

但几个具体公网目标都命中 `utun4`：

```text
claude.ai  -> 160.79.104.10 -> utun4
example.com -> 104.20.23.154 -> utun4
openai.com  -> 104.18.33.45  -> utun4
1.1.1.1     -> utun4
8.8.8.8     -> utun4
```

也就是说，在这个全局模式实测状态下，访问外网不是只走 `en0`；具体目标 IP 会先进 `utun4`，再由飞连客户端送往飞连网关。`route -n get default` 仍显示 `en0`，只是说明默认兜底路由在 `en0`，不能代表具体目标的最终接口。

本机 Clash 里选中的英国代理节点 IP 也命中 `utun4`。真实 IP 不写进文章，但这个结果说明：**当前环境里，Mihomo 连接英国代理节点这段底层流量会先进飞连隧道，再到飞连网关，然后才到英国代理节点。**

我还用直连请求看过 `utun4` 的接口计数：

```bash
curl --noproxy '*' https://example.com
```

请求前后 `utun4` 的字节计数增加。这个验证说明它不是只停留在路由表推断，而是实际流量也经过了飞连隧道接口。

最后，用 curl 明确指定本机 Clash 代理：

```bash
curl -I -v --proxy http://127.0.0.1:7897 https://claude.ai/restricted
```

可以看到关键过程：

```text
Connected to 127.0.0.1 port 7897
Establish HTTP proxy tunnel to claude.ai:443
CONNECT claude.ai:443 HTTP/1.1
HTTP/1.1 200 Connection established
```

返回头里还出现了 `cf-ray: ...-LHR`。这不是唯一证据，但能作为侧面信号：这条经 `7897` 发起的 Claude 请求，确实落到了 London / LHR 方向的边缘节点。

把这些证据合起来，当前这台机器上“指定走 Clash 访问 Claude”的链路可以写成：

```text
curl / Claude Code CLI
  -> 127.0.0.1:7897
  -> Clash / Mihomo
  -> 英国代理节点 IP
  -> route 命中 utun4
  -> 本机飞连隧道入口
  -> 飞连网关
  -> 英国代理节点
  -> Claude
```

## 9. 排查顺序

以后不要先问“我开了哪个工具”，而是按请求链路从前往后查。

第一步，看浏览器第一跳：

```bash
scutil --proxy
```

第二步，看 CLI 是否有代理变量：

```bash
env | grep -E '^(HTTP_PROXY|HTTPS_PROXY|NO_PROXY)='
```

第三步，看本机代理端口是否存在：

```bash
lsof -nP -iTCP:8899 -sTCP:LISTEN
lsof -nP -iTCP:7897 -sTCP:LISTEN
```

第四步，如果浏览器第一跳是 Bifrost，看 Bifrost 是否显式转给 Clash：

```text
proxy://127.0.0.1:7897
```

或者：

```text
http-proxy://127.0.0.1:7897
```

第五步，看 Clash 规则是否覆盖目标域名：

```yaml
DOMAIN-SUFFIX,claude.ai,Claude
DOMAIN-SUFFIX,claude.com,Claude
DOMAIN-SUFFIX,anthropic.com,Claude
DOMAIN-SUFFIX,claudeusercontent.com,Claude
```

第六步，看底层路由：

```bash
route -n get default
route -n get 远端代理节点IP
```

第七步，必要时测几个具体公网 IP：

```bash
for ip in 1.1.1.1 8.8.8.8 223.5.5.5; do
  echo "== $ip =="
  route -n get "$ip" | egrep 'gateway|interface'
done
```

第八步，用指定代理的 curl 验证代理入口是否真的能建立 tunnel：

```bash
curl -I -v --proxy http://127.0.0.1:7897 https://claude.ai/restricted
```

这一步验证的是“进了 7897 以后能不能通过代理访问 Claude”，不是验证浏览器一定走了 7897。浏览器是否走 7897，仍然要回到第一步看第一跳。

## 10. 最终心智模型

最后可以把整篇压缩成一句话：

```text
proxy 是应用层入口，utun 是网络层出口；
请求先被应用决定交给谁，再由代理决定转给谁，最后由路由决定从哪里出去。
```

更完整一点：

```text
应用
  -> 是否读系统代理、浏览器代理设置或 CLI 环境变量
  -> Bifrost / Clash 这类本机应用层代理入口
  -> 是否显式串到下一个代理
  -> Clash / Mihomo 规则匹配
  -> DIRECT 或远端代理节点
  -> macOS 路由表
  -> en0 或 utunX
  -> 目标网站看到的出口
```

这样理解之后，很多现象就不奇怪了：

- 浏览器能访问，不代表 CLI 能访问。
- Bifrost 和 Clash 都开着，不代表自动串联。
- `route -n get default` 是 `en0`，不代表飞连没有接管具体公网 IP。
- `utunX` 不是 HTTP 代理端口，它只是底层路由出口。
- `8899` / `7897` 不是网卡，它们只是本机代理程序监听的应用层入口。
- 走了飞连网关，不等于最后业务目标变成飞连；飞连只是把内层目标继续送出去。

这篇文章真正想解决的不是“怎么把所有流量都代理掉”，而是让每一条请求都有可解释、可验证的路径。只要能说清楚“第一跳是谁、下一跳是谁、规则命中谁、底层路由从哪里出去”，代理问题就不再是一团糊。
