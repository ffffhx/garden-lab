---
title: "浏览器 Agent 工具怎么选：@chrome、@browser、agent-browser、bb-browser、Chrome DevTools MCP、playwright-cli 二十任务实测"
updated: 2026-06-21 00:22:25
date: 2026-06-12 21:30:00
categories:
  - 技术
tags:
  - Chrome
  - CDP
  - MCP
  - DevTools
  - Browser Automation
  - Agent
  - Playwright
  - Benchmark
excerpt: "实测 @chrome、@browser、agent-browser、bb-browser、Chrome DevTools MCP 和 playwright-cli：二十道固定任务覆盖网页登录、Network 排障、性能诊断、扩展特权页、三种登录态路线、Source Map、Service Worker、iframe、文件上传与键盘可访问性；9道 真实网站外场任务，覆盖 Chrome Web Store、真实扩展注入、真实 Network 响应体、请求拦截和 HAR/trace。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要
我用 `@chrome`、`@browser`、`agent-browser`、`bb-browser`、`Chrome DevTools MCP`、`playwright-cli` 6个工具，跑了20道有标准答案的固定靶场题，外加 9道 真实网站外场题——覆盖从网页登录、Network、性能诊断，到扩展安全域、真实登录态、Source Map、Service Worker、iframe、文件上传和键盘可访问性。每个单元格都由上下文干净的 Subagent 实测。

这篇文章按"结论 → 过程 → 原理"三段组织：

- **一、结论先行**：第 1 节按"你要干什么"直接给首选与加装路由，第 2 节是6工具 × 20个 靶场任务 + 9个 真实网站任务的结果总表；
- **二、测试过程**：第 3 节是实测方法（基准测试站与任务设计），第 4 节逐格核对每个 ❌ / ⚠️ 的成因，第 5 节提炼跨工具规律；
- **三、底层原理**：第 6 节用浏览器能力分层和安全域给出边界公式，第 7 节逐工具讲实现——边界到底来自哪里。

复现材料（测试站、任务卡、原始数据）都在仓库 `apps/browser-tool-bench/`，可以复查每个 ✅ / ⚠️ / ❌ 的依据。

全文主线是一个从实测里提炼出来的公式：

> **工具实际能力 = min(协议层上限, 产品封装范围, 安全策略)**

这条公式能解释总表里的大多数边界：有的工具协议层够强，但产品封装没开放；有的能连到真实 profile，却被 Chrome 安全策略或企业管控挡住；有的操作顺滑，但拿不到响应体、trace 或扩展特权页。

<figure class="capformula" role="group" aria-label="工具能力边界公式动画图">
  <style>
    .capformula{
      --paper-soft:#faf6ec; --paper-deep:#ece5d5; --paper-mute:#f7f1e4;
      --ink:#1a1815; --ink-soft:#3c362c; --muted:#6a6155;
      --hair:rgba(26,24,21,.18);
      --serif:var(--font-serif-body,"Noto Serif SC",Georgia,"Songti SC",serif);
      --mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);
      --cdp-d:#3f6d79; --cdp-l:#6f9aa3; --cdp-b:#dcebed; --cdp-e:#8fbcc4;
      --grn-d:#4f7233; --grn-l:#7c9c54; --grn-b:#e7eedd;
      --red-d:#8f2d20; --red-l:#b4524a; --red-b:#f1ddd6; --red-e:#cf9b90;
      margin:0; padding:clamp(18px,3.4vw,30px);
      background: radial-gradient(120% 80% at 50% -10%, var(--paper-mute), transparent 60%), linear-gradient(180deg,var(--paper-soft),var(--paper-deep));
      border:1px solid var(--hair); border-radius:14px;
      color:var(--ink); font-family:var(--serif);
      position:relative; overflow:hidden; line-height:1.5;
    }
    .capformula *{box-sizing:border-box;}
    .capformula::before{
      content:""; position:absolute; inset:0; pointer-events:none;
      background-image:linear-gradient(var(--hair) 1px,transparent 1px);
      background-size:100% 30px; opacity:.05;
    }
    .capformula .cf-title{
      position:relative; z-index:2; text-align:center;
      font-family:var(--mono); font-size:clamp(12.5px,2.5vw,16px);
      line-height:1.95; letter-spacing:.2px; color:var(--ink-soft);
      margin:0 auto clamp(16px,3vw,24px); max-width:640px;
      overflow-wrap:break-word; word-break:break-word;
    }
    .capformula .cf-title b{display:inline-block; font-weight:600; padding:.05em .3em; border-radius:3px;}
    .capformula .cf-eq{color:var(--muted);}
    .capformula .cf-min{color:var(--muted); font-style:italic; font-family:var(--serif);}
    .capformula .t-cdp{color:var(--cdp-d); background:var(--cdp-b);}
    .capformula .t-grn{color:var(--grn-d); background:var(--grn-b);}
    .capformula .t-red{color:var(--red-d); background:var(--red-b);}
    .capformula .cf-stage{position:relative; z-index:2; max-width:520px; margin:0 auto; display:flex; flex-direction:column; align-items:center; gap:0;}
    .capformula .cf-drop-rail{position:relative; width:100%; height:clamp(26px,5vw,34px); display:flex; justify-content:center; align-items:flex-end;}
    .capformula .cf-source{font-family:var(--mono); font-size:11px; letter-spacing:.4px; color:var(--muted); text-transform:uppercase; margin-bottom:6px;}
    .capformula .cf-layers{position:relative; width:100%; display:flex; flex-direction:column; align-items:center; gap:clamp(7px,1.6vw,11px);}
    .capformula .cf-layer{
      position:relative; height:clamp(38px,7.2vw,50px); border-radius:7px; border:1px solid var(--hair);
      display:flex; align-items:center; justify-content:space-between; padding:0 12px; overflow:hidden;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.45); transition:transform .5s ease, box-shadow .5s ease;
    }
    .capformula .cf-l1{width:100%;   background:var(--cdp-b); border-color:var(--cdp-e);}
    .capformula .cf-l2{width:72%;    background:var(--grn-b); border-color:#bcd0a4;}
    .capformula .cf-l3{width:46%;    background:var(--red-b); border-color:var(--red-e);}
    .capformula .cf-tag{font-family:var(--serif); font-size:clamp(11px,2.3vw,13px); font-weight:600; white-space:nowrap;}
    .capformula .cf-l1 .cf-tag{color:var(--cdp-d);}
    .capformula .cf-l2 .cf-tag{color:var(--grn-d);}
    .capformula .cf-l3 .cf-tag{color:var(--red-d);}
    .capformula .cf-w{font-family:var(--mono); font-size:10.5px; color:var(--muted); opacity:.85; white-space:nowrap;}
    .capformula .cf-block{position:absolute; left:50%; top:0; width:62%; height:200%; transform:translate(-50%,-110%); border-radius:5px; opacity:0; mix-blend-mode:multiply;}
    .capformula .cf-l1 .cf-block{background:linear-gradient(180deg,var(--cdp-d),var(--cdp-l)); animation:cf-pass 9s cubic-bezier(.55,.05,.45,1) infinite;}
    .capformula .cf-l2 .cf-block{background:linear-gradient(180deg,var(--grn-d),var(--grn-l)); animation:cf-pass 9s cubic-bezier(.55,.05,.45,1) infinite; animation-delay:1.05s;}
    .capformula .cf-l3 .cf-block{background:linear-gradient(180deg,var(--red-d),var(--red-l)); animation:cf-pass 9s cubic-bezier(.55,.05,.45,1) infinite; animation-delay:2.1s;}
    @keyframes cf-pass{ 0%{transform:translate(-50%,-110%);opacity:0} 8%{opacity:.92} 26%{transform:translate(-50%,-2%);opacity:.92} 40%{transform:translate(-50%,42%);opacity:.92} 62%{transform:translate(-50%,108%);opacity:.85} 72%{opacity:0} 100%{transform:translate(-50%,160%);opacity:0} }
    .capformula .cf-sweep{position:absolute; inset:0; pointer-events:none; background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%); transform:translateX(-120%); animation:cf-sweep 9s ease-in-out infinite;}
    .capformula .cf-l1 .cf-sweep{animation-delay:.2s;}
    .capformula .cf-l2 .cf-sweep{animation-delay:1.25s;}
    .capformula .cf-l3 .cf-sweep{animation-delay:2.3s;}
    @keyframes cf-sweep{ 0%,22%{transform:translateX(-120%)} 40%{transform:translateX(120%)} 100%{transform:translateX(120%)} }
    .capformula .cf-tick{width:1px; height:clamp(7px,1.6vw,11px); background:var(--hair);}
    .capformula .cf-out{position:relative; width:46%; margin-top:clamp(10px,2vw,14px); display:flex; flex-direction:column; align-items:center; gap:8px;}
    .capformula .cf-funnel{width:100%; height:3px; border-radius:2px; background:linear-gradient(90deg,transparent,var(--ink-soft),transparent); position:relative; overflow:hidden;}
    .capformula .cf-flow{position:absolute; top:0; left:0; height:100%; width:34%; background:linear-gradient(90deg,transparent,#fff,transparent); animation:cf-flow 9s linear infinite; animation-delay:2.6s; opacity:.9;}
    @keyframes cf-flow{ 0%,28%{transform:translateX(-120%);opacity:0} 34%{opacity:.9} 60%{transform:translateX(330%);opacity:.9} 66%,100%{opacity:0;transform:translateX(330%)} }
    .capformula .cf-result{font-family:var(--mono); font-size:clamp(10.5px,2.2vw,12px); color:var(--red-d); letter-spacing:.3px; text-align:center; background:var(--red-b); border:1px solid var(--red-e); padding:5px 12px; border-radius:6px; white-space:nowrap; box-shadow:0 1px 0 rgba(255,255,255,.4);}
    .capformula .cf-result b{font-weight:600;}
    .capformula .cf-cap{text-align:center; font-size:clamp(11px,2.3vw,12.5px); color:var(--muted); margin:clamp(14px,2.6vw,18px) auto 0; max-width:440px;}
    .capformula.in-view .cf-l3{box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 2px 10px rgba(143,45,32,.13);}
    .capformula.is-playing .cf-layer[data-step]{transform:translateY(0);}
    @media (max-width:560px){
      .capformula .cf-l2{width:80%;}
      .capformula .cf-l3{width:58%;}
      .capformula .cf-block{width:70%;}
      .capformula .cf-out{width:58%;}
      .capformula .cf-w{display:none;}
    }
    @media (prefers-reduced-motion:reduce){
      .capformula .cf-block, .capformula .cf-sweep, .capformula .cf-flow{animation:none !important;}
      .capformula .cf-l3 .cf-block{opacity:.9; transform:translate(-50%,42%);}
      .capformula .cf-l1 .cf-block, .capformula .cf-l2 .cf-block{opacity:.55; transform:translate(-50%,42%);}
      .capformula .cf-flow{opacity:.9; left:33%;}
    }
  </style>
  <p class="cf-title" aria-hidden="true">
    工具实际能力 <span class="cf-eq">=</span> <span class="cf-min">min</span>(
    <b class="t-cdp">协议层上限</b> ,
    <b class="t-grn">产品封装范围</b> ,
    <b class="t-red">安全策略</b> )
  </p>
  <div class="cf-stage">
    <div class="cf-drop-rail" aria-hidden="true"><span class="cf-source">能力 · 自上而下穿层</span></div>
    <div class="cf-layers">
      <div class="cf-layer cf-l1" data-step="1"><span class="cf-tag">协议层上限</span><span class="cf-w" aria-hidden="true">ceiling 100%</span><span class="cf-block" aria-hidden="true"></span><span class="cf-sweep" aria-hidden="true"></span></div>
      <div class="cf-tick" aria-hidden="true"></div>
      <div class="cf-layer cf-l2" data-step="2"><span class="cf-tag">产品封装范围</span><span class="cf-w" aria-hidden="true">ceiling 72%</span><span class="cf-block" aria-hidden="true"></span><span class="cf-sweep" aria-hidden="true"></span></div>
      <div class="cf-tick" aria-hidden="true"></div>
      <div class="cf-layer cf-l3" data-step="3"><span class="cf-tag">安全策略</span><span class="cf-w" aria-hidden="true">ceiling 46%</span><span class="cf-block" aria-hidden="true"></span><span class="cf-sweep" aria-hidden="true"></span></div>
    </div>
    <div class="cf-out" data-step="4">
      <div class="cf-funnel" aria-hidden="true"><span class="cf-flow"></span></div>
      <div class="cf-result"><b>实际能力</b> = min · 最窄那层</div>
    </div>
  </div>
  <p class="cf-cap">能力色块逐层穿过，被每层裁到该层宽度；流出底部的细条，就是三者取最小后的真实可用范围。</p>
</figure>



## 一、结论先行：读者最关心的

### 1. 选型路由：按任务场景反推工具

没人会把六个工具都装上。如果只留一个，我认为最重要的能力是：能**复用真实登录态**（你登录过的 GitHub、内网、自己在调的应用，Agent 要能直接接着用）——这一条先淘汰不继承登录态的 `@browser`。剩下能接到真实受管持久 profile 的几个里，真正的决赛只在**两个满分选手**之间：agent-browser 和 Chrome DevTools MCP，两者都是 **31/31**。再往下比就分出胜负了：agent-browser **token 最省（~198k）、最快（~26min）、state 可移植**，而且唯二**原生支持网络层 route/mock**；DevTools MCP 最稳（eval 逃生最少、零失败）、F12 式诊断直出，常见 fetch/XHR 够用，可一旦要 abort、改 header、拦非 JS 发起的请求，JS 层就够不着，鲁棒性弱一档。再叠加 **token 最贵（~325k，约 agent-browser 的 1.6×）、绑 userDataDir 不可移植**两条，天平就压向 agent-browser：能力同样满格，但更省、更快、可移植、route 更硬。

在这些候选里，**只能装一款就选 agent-browser**（极少数例外场景见文末速查表）。


<figure class="pickflow" role="group" aria-label="第一节 浏览器工具选型路由图：先过登录态硬前提，通用单选落到 agent-browser">
<style>
.pickflow{
  --pf-paper-soft: var(--paper-soft, #faf6ec);
  --pf-paper-deep: var(--paper-deep, #ece5d5);
  --pf-paper-vsoft: #f7f1e4;
  --pf-ink: var(--ink, #1a1815);
  --pf-ink-soft: var(--ink-soft, #3c362c);
  --pf-muted: var(--muted, #6a6155);
  --pf-hair: var(--hair, rgba(26,24,21,.2));
  --pf-serif: var(--font-serif-body, "Songti SC", "Source Han Serif SC", Georgia, serif);
  --pf-mono: var(--font-mono, ui-monospace, "SFMono-Regular", monospace);
  --pf-green-d:#4f7233; --pf-green-l:#7c9c54; --pf-green-bg:#e7eedd;
  --pf-cyan:#3f6d79; --pf-cyan-bg:#dcebed; --pf-cyan-bd:#8fbcc4;
  --pf-amb:#9a6516; --pf-amb-l:#d6a64a; --pf-amb-bg:#f4e8cc; --pf-amb-bd:#d9b66a;
  --pf-pur:#54579a; --pf-pur-bg:#e6e7f3; --pf-pur-bd:#a9adcf;
  --pf-gray:#917f5c; --pf-gray-bg:#ece4d2;
  margin:0;
  font-family:var(--pf-serif);
  color:var(--pf-ink);
  background:
    radial-gradient(120% 90% at 12% 0%, var(--pf-paper-soft), transparent 60%),
    linear-gradient(160deg, var(--pf-paper-vsoft), var(--pf-paper-deep));
  border:1px solid var(--pf-hair);
  border-radius:14px;
  padding:clamp(18px,4vw,30px);
  box-sizing:border-box;
  position:relative;
  overflow:hidden;
  line-height:1.5;
  container-type:inline-size;
  container-name:pf;
}
.pickflow *{ box-sizing:border-box; min-width:0; }
.pickflow .pf-grain{
  position:absolute; inset:0; pointer-events:none; opacity:.5;
  background-image:radial-gradient(var(--pf-hair) .5px, transparent .5px);
  background-size:16px 16px;
  -webkit-mask-image:linear-gradient(180deg, rgba(0,0,0,.35), transparent 70%);
  mask-image:linear-gradient(180deg, rgba(0,0,0,.35), transparent 70%);
}
.pickflow .pf-head{ position:relative; z-index:2; margin-bottom:clamp(14px,3vw,22px); }
.pickflow .pf-kicker{
  font-family:var(--pf-mono);
  font-size:11px; letter-spacing:.22em; text-transform:uppercase;
  color:var(--pf-cyan);
  display:inline-flex; align-items:center; gap:8px;
}
.pickflow .pf-kicker::before{
  content:""; width:22px; height:1px; background:var(--pf-cyan); display:inline-block;
}
.pickflow .pf-title{
  font-size:clamp(17px,3.4vw,22px); font-weight:700; color:var(--pf-ink);
  margin:8px 0 4px; letter-spacing:.01em;
}
.pickflow .pf-sub{ font-size:13px; color:var(--pf-muted); max-width:60ch; }
.pickflow .pf-stage{ position:relative; z-index:2; display:flex; flex-direction:column; }
.pickflow .pf-row{ display:flex; align-items:stretch; gap:clamp(10px,2.4vw,18px); }
.pickflow .pf-spine{
  flex:0 0 clamp(96px,18%,150px);
  position:relative;
  align-self:stretch;
}
.pickflow .pf-spine::before{
  content:""; position:absolute; top:0; bottom:14px; right:0; width:3px; border-radius:2px;
  background:linear-gradient(180deg,
     var(--pf-cyan) 0 40%, transparent 40% 60%, var(--pf-cyan) 60% 100%);
  background-size:100% 12px;
  animation:pf-stream 2.6s linear infinite;
  opacity:.85;
}
.pickflow .pf-spine::after{
  content:"按额外需求"; position:absolute; top:2px; right:12px;
  font-family:var(--pf-mono); font-size:9.5px; letter-spacing:.16em;
  color:var(--pf-muted); writing-mode:vertical-rl; white-space:nowrap;
}
.pickflow .pf-branches{ flex:1 1 auto; display:flex; flex-direction:column; gap:10px; justify-content:center; }
.pickflow .pf-flow{
  position:relative; height:26px; margin:2px auto;
  width:3px; border-radius:2px;
  background:linear-gradient(180deg,
     var(--pf-cyan) 0 40%, transparent 40% 60%, var(--pf-cyan) 60% 100%);
  background-size:100% 12px;
  animation:pf-stream 2.6s linear infinite;
  opacity:.85;
}
@keyframes pf-stream{ from{background-position:0 0;} to{background-position:0 12px;} }
.pickflow .pf-flow-h{
  flex:0 0 clamp(20px,4vw,46px);
  align-self:center;
  height:3px; border-radius:2px;
  background:linear-gradient(90deg,
     currentColor 0 40%, transparent 40% 60%, currentColor 60% 100%);
  background-size:12px 100%;
  animation:pf-stream-h 2.6s linear infinite;
  opacity:.85;
  position:relative;
}
.pickflow .pf-flow-h::after{
  content:""; position:absolute; right:0; top:50%; transform:translateY(-50%);
  border-left:6px solid currentColor; border-top:4px solid transparent; border-bottom:4px solid transparent;
}
@keyframes pf-stream-h{ from{background-position:0 0;} to{background-position:12px 0;} }
.pickflow .pf-node{
  position:relative;
  border:1.5px solid var(--pf-hair);
  border-radius:11px;
  padding:11px 13px;
  background:var(--pf-paper-soft);
  box-shadow:0 1px 0 rgba(255,255,255,.5) inset, 0 2px 8px rgba(26,24,21,.05);
  opacity:.55;
  transform:translateY(4px);
  animation:pf-rise .9s ease forwards;
}
@keyframes pf-rise{ to{opacity:1; transform:translateY(0);} }
.pickflow .pf-tag{
  font-family:var(--pf-mono); font-size:10px; letter-spacing:.12em;
  text-transform:uppercase; color:var(--pf-muted); display:block; margin-bottom:3px;
}
.pickflow .pf-node b{ font-size:14px; font-weight:700; color:var(--pf-ink); display:block; }
.pickflow .pf-node small{ font-size:11.5px; color:var(--pf-ink-soft); display:block; margin-top:3px; }
.pickflow .pf-gate{
  border-color:var(--pf-amb-bd);
  background:linear-gradient(180deg, var(--pf-amb-bg), var(--pf-paper-soft));
  animation-delay:.05s;
}
.pickflow .pf-gate .pf-tag{ color:var(--pf-amb); }
.pickflow .pf-gate::before{
  content:""; position:absolute; left:0; top:12px; bottom:12px; width:3px; border-radius:3px;
  background:var(--pf-amb-l);
}
.pickflow .pf-hero{
  border:2px solid var(--pf-green-d);
  background:linear-gradient(155deg, var(--pf-green-bg), var(--pf-cyan-bg));
  padding:15px 16px; margin-top:4px;
  animation:pf-rise .9s ease .35s forwards, pf-breathe 8s ease-in-out 1.2s infinite;
}
.pickflow .pf-hero .pf-tag{ color:var(--pf-green-d); }
.pickflow .pf-hero b{ font-size:16px; color:var(--pf-green-d); }
.pickflow .pf-hero small{ color:var(--pf-ink-soft); }
.pickflow .pf-hero .pf-pill{
  display:inline-block; margin-top:9px;
  font-family:var(--pf-mono); font-size:10px; letter-spacing:.04em;
  color:var(--pf-cyan); background:var(--pf-paper-soft);
  border:1px solid var(--pf-cyan-bd); border-radius:20px; padding:3px 10px;
}
.pickflow .pf-hero::after{
  content:"首选"; position:absolute; top:-9px; right:14px;
  font-family:var(--pf-mono); font-size:10px; letter-spacing:.15em;
  color:var(--pf-paper-soft); background:var(--pf-green-d);
  padding:3px 9px; border-radius:20px;
  box-shadow:0 2px 6px rgba(79,114,51,.35);
}
@keyframes pf-breathe{
  0%,100%{ box-shadow:0 0 0 0 rgba(79,114,51,0), 0 4px 14px rgba(26,24,21,.07); }
  50%{ box-shadow:0 0 0 4px rgba(124,156,84,.15), 0 6px 18px rgba(26,24,21,.10); }
}
.pickflow .pf-hero-halo{
  position:absolute; inset:-2px; border-radius:11px; pointer-events:none;
  border:2px solid transparent;
  background:linear-gradient(120deg, transparent, rgba(124,156,84,.5), transparent) border-box;
  -webkit-mask:linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  background-size:220% 100%;
  animation:pf-halo 5s linear 1.4s infinite;
  opacity:.9;
}
@keyframes pf-halo{ from{background-position:200% 0;} to{background-position:-60% 0;} }
.pickflow .pf-b1{ border-color:var(--pf-cyan-bd); background:linear-gradient(180deg,var(--pf-cyan-bg),var(--pf-paper-soft)); }
.pickflow .pf-b2{ border-color:var(--pf-cyan-bd); background:linear-gradient(180deg,var(--pf-cyan-bg),var(--pf-paper-soft)); }
.pickflow .pf-b3{ border-color:var(--pf-hair); background:linear-gradient(180deg,#e6e0d2,var(--pf-paper-soft)); }
.pickflow .pf-b4{ border-color:var(--pf-pur-bd); background:linear-gradient(180deg,var(--pf-pur-bg),var(--pf-paper-soft)); }
.pickflow .pf-b1 .pf-tag,.pickflow .pf-b2 .pf-tag{ color:var(--pf-cyan); }
.pickflow .pf-b3 .pf-tag{ color:var(--pf-gray); }
.pickflow .pf-b4 .pf-tag{ color:var(--pf-pur); }
.pickflow .pf-chips{ display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; }
.pickflow .pf-chip{
  display:inline-block;
  font-family:var(--pf-mono); font-size:10px; letter-spacing:.02em;
  padding:2px 8px; border-radius:6px; white-space:nowrap;
}
.pickflow .pf-chip.c-cyan{ color:var(--pf-cyan); background:var(--pf-cyan-bg); border:1px solid var(--pf-cyan-bd); }
.pickflow .pf-chip.c-pur{ color:var(--pf-pur); background:var(--pf-pur-bg); border:1px solid var(--pf-pur-bd); }
.pickflow .pf-chip.c-gray{ color:var(--pf-gray); background:var(--pf-gray-bg); border:1px solid var(--pf-hair); }
.pickflow .pf-bhead{
  font-family:var(--pf-mono); font-size:10.5px; letter-spacing:.16em; text-transform:uppercase;
  color:var(--pf-muted); margin:6px 0 4px;
  display:flex; align-items:center; gap:9px;
}
.pickflow .pf-bhead::before{ content:""; flex:0 0 18px; height:1px; background:var(--pf-hair); }
.pickflow .pf-bhead::after{ content:""; flex:1 1 auto; height:1px; background:var(--pf-hair); }
.pickflow .pf-unit{ display:flex; align-items:stretch; color:var(--pf-cyan); position:relative; }
.pickflow .pf-unit .pf-node{ flex:1 1 auto; }
.pickflow .pf-u1 .pf-node{ animation-delay:.9s; } .pickflow .pf-u1 .pf-flow-h{ animation-delay:.8s; }
.pickflow .pf-u2 .pf-node{ animation-delay:1.25s; } .pickflow .pf-u2 .pf-flow-h{ animation-delay:1.15s; }
.pickflow .pf-u3 .pf-node{ animation-delay:1.6s; } .pickflow .pf-u3 .pf-flow-h{ animation-delay:1.5s; }
.pickflow .pf-u4 .pf-node{ animation-delay:1.95s; } .pickflow .pf-u4 .pf-flow-h{ animation-delay:1.85s; }
.pickflow .pf-u3{ color:var(--pf-gray); }
.pickflow .pf-u4{ color:var(--pf-pur); }
.pickflow .pf-foot{
  position:relative; z-index:2; margin-top:clamp(14px,3vw,20px);
  display:flex; flex-wrap:wrap; gap:8px 16px; align-items:center;
  border-top:1px dashed var(--pf-hair); padding-top:12px;
  font-size:11px; color:var(--pf-muted);
}
.pickflow .pf-leg{ display:inline-flex; align-items:center; gap:6px; font-family:var(--pf-mono); letter-spacing:.04em; }
.pickflow .pf-dot{ width:9px; height:9px; border-radius:3px; display:inline-block; border:1px solid var(--pf-hair); }
.pickflow .d-green{ background:var(--pf-green-l); } .pickflow .d-cyan{ background:var(--pf-cyan); }
.pickflow .d-pur{ background:var(--pf-pur); } .pickflow .d-gray{ background:var(--pf-gray); }
.pickflow .d-amb{ background:var(--pf-amb-l); }
.pickflow.in-view .pf-node{ animation-play-state:running; }
.pickflow.is-playing .pf-node.pf-active{ outline:2px solid var(--pf-cyan); outline-offset:2px; }
@container pf (max-width:520px){
  .pickflow .pf-row{ flex-direction:column; gap:6px; }
  .pickflow .pf-spine{ display:none; }
  .pickflow .pf-flow-h{ display:none; }
  .pickflow .pf-unit{ flex-direction:column; }
  .pickflow .pf-unit .pf-node{ width:100%; }
  .pickflow .pf-branches{ gap:8px; }
  .pickflow .pf-hero::after{ right:12px; }
}
@media (max-width:560px){
  .pickflow .pf-row{ flex-direction:column; gap:6px; }
  .pickflow .pf-spine{ display:none; }
  .pickflow .pf-flow-h{ display:none; }
  .pickflow .pf-unit{ flex-direction:column; }
  .pickflow .pf-unit .pf-node{ width:100%; }
  .pickflow .pf-branches{ gap:8px; }
  .pickflow .pf-hero::after{ right:12px; }
}
@media (prefers-reduced-motion: reduce){
  .pickflow .pf-node,.pickflow .pf-hero{ animation:none !important; opacity:1 !important; transform:none !important; }
  .pickflow .pf-flow,.pickflow .pf-flow-h,.pickflow .pf-spine::before,.pickflow .pf-hero-halo{ animation:none !important; }
  .pickflow .pf-flow,.pickflow .pf-spine::before{ background:var(--pf-cyan); opacity:.55; }
  .pickflow .pf-flow-h{ background:currentColor; opacity:.55; }
  .pickflow .pf-hero{ box-shadow:0 4px 14px rgba(26,24,21,.07); }
  .pickflow .pf-hero-halo{ opacity:.45; background-position:50% 0; }
}
</style>
<span class="pf-grain" aria-hidden="true"></span>
<div class="pf-head">
  <span class="pf-kicker">§1 选型路由</span>
  <div class="pf-title">只装一把，选 agent-browser</div>
  <div class="pf-sub">先过登录态硬前提，剩下的满分选手里通用单选落到 agent-browser。</div>
</div>
<div class="pf-stage">
  <div class="pf-node pf-gate" data-step="1">
    <span class="pf-tag" aria-hidden="true">硬前提 · GATE</span>
    <b>要复用真实登录态？</b>
    <small>你登录过的 GitHub / 内网 / 在调应用——Agent 直接接着用，免重登。不继承登录态的 @browser 在这关出局。</small>
  </div>
  <div class="pf-flow" aria-hidden="true"></div>
  <div class="pf-node pf-hero" data-step="2">
    <span class="pf-hero-halo" aria-hidden="true"></span>
    <span class="pf-tag" aria-hidden="true">通用单选 · MAIN</span>
    <b>agent-browser</b>
    <small>同口径满分 31/31，token 最省（~198k）、最快（~26min）、state 可移植，还唯二原生支持协议层 route/mock（比 JS 层补丁更鲁棒）。软肋是选择器点视口外元素会静默空点（走 @ref 可避开）+ daemon 粘滞——靠用法和重试吸收，不是能力洞。</small>
    <span class="pf-pill">能力无洞，一把够用</span>
  </div>
</div>
<div class="pf-foot" aria-hidden="true">
  <span class="pf-leg"><span class="pf-dot d-amb"></span>硬前提</span>
  <span class="pf-leg"><span class="pf-dot d-green"></span>通用首选 · agent-browser</span>
</div>
</figure>

**它的软肋，以及为什么不致命**：click 走 CSS/text 选择器点**视口外**元素会**静默空点**——它知道元素存在（快照读的是 DOM 结构，跟在不在屏幕上无关），但这条点击路缺了"先滚进视口 + 点后校验落点"，坐标落空却仍报成功（走快照 `@ref` 路径会先滚到位、可避开，见 4.1）；另外常驻 daemon 的 `--cdp` 命中目标 profile 会粘滞（见 7.2）。但这些都是**工程细节、不是能力缺口**——靠走 `@ref` 点击、点前 `scrollintoview`、重试、连接前先 `connect 9223` + `get cdp-url` 复位就能吸收。换句话说：两者能力都满格，分胜负的是成本（token 省 ~40%）、可移植性，以及 route 的鲁棒性（协议层 vs JS 层）——这三条把单选的天平压向 agent-browser。

**其余四个为什么落选**：

- **@chrome**：无完整 CDP 时缺 Network body / Runtime fetch / route/mock；开完整 CDP 后 T02/T03/T07/T18 会翻盘，但三条硬边界仍在——证明不了绑定用户指定的 9223 profile、进不了 `chrome://extensions` / `chrome-extension://.../options.html`、没有可靠 route/mock API。是默认 Profile 的轻量观察器，不是完整 F12。
- **@browser**：不继承真实登录态，硬前提这关就出局。
- **bb-browser**：能用 `--port` 读真实登录态，但 0.14.2 的 click 注入有 bug、又到不了 `chrome://` / `chrome-extension://` 特权页，通用操作频繁靠 eval 兜底，44.9min 也是全场最慢。
- **playwright-cli**：纯自动化最稳（综合通过率最高、几乎零 eval 自救），attach 9223 本身能成；但成败**取决于 9223 当下的浏览器状态**——有打开的页面时 attach 稳定成功（并存多个扩展 service_worker 也不崩），无任何页面时会崩在 `Browser.setDownloadBehavior`（详见 4.7）。因为依赖这个外部状态、可预测性不足，所以定位为"自启浏览器回归测试"的首选、而非"真实 profile 主力"。

只有极少数情况才需要在 agent-browser 之外再补一把（它本身已覆盖 route 与可移植 state，所以加装项比原先少得多）：

<figure class="dtable" role="group" aria-label="agent-browser 之外极少数需要加装第二把工具的例外场景表">
<style>
.dtable{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--paper-vsoft:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);--cyan:#3f6d79;--cyan-b:#dcebed;--cyan-e:#8fbcc4;--amb:#9a6516;--grn:#4f7233;--red:#8f2d20;--pur:#54579a;margin:0;padding:clamp(14px,3vw,22px);font-family:var(--serif);color:var(--ink);line-height:1.5;background:radial-gradient(130% 90% at 92% 0%,var(--paper-soft),transparent 60%),linear-gradient(160deg,var(--paper-vsoft),var(--paper-deep));border:1px solid var(--hair);border-radius:14px;position:relative;overflow:hidden}
.dtable *{box-sizing:border-box;min-width:0}
.dtable .dt-head{margin-bottom:11px}
.dtable .dt-kicker{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--cyan);display:inline-flex;align-items:center;gap:8px}
.dtable .dt-kicker::before{content:"";width:22px;height:1px;background:var(--cyan)}
.dtable .dt-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:10px;border:1px solid var(--hair)}
.dtable table{width:100%;border-collapse:collapse;font-size:13px;background:color-mix(in srgb,var(--paper-soft) 55%,transparent)}
.dtable thead th{font-family:var(--mono);font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);text-align:left;font-weight:600;padding:9px 12px;border-bottom:1.5px solid var(--hair);white-space:nowrap;background:color-mix(in srgb,var(--paper-soft) 75%,transparent)}
.dtable tbody td{padding:9px 12px;border-bottom:1px solid var(--hair);color:var(--ink-soft);vertical-align:top}
.dtable tbody tr:nth-child(even) td{background:rgba(26,24,21,.025)}
.dtable tbody tr:hover td{background:color-mix(in srgb,var(--cyan-b) 45%,transparent)}
.dtable tbody tr:last-child td{border-bottom:none}
.dtable tbody td:first-child{font-weight:600;color:var(--ink)}
.dtable strong{color:var(--cyan);font-weight:700}
.dtable code{font-family:var(--mono);font-size:12px;background:color-mix(in srgb,var(--cyan-b) 55%,transparent);border:1px solid var(--cyan-e);padding:0 5px;border-radius:5px;color:var(--ink-soft);white-space:nowrap}
.dtable .dt-flow{transition:background .2s ease}
@media (max-width:560px){.dtable table{font-size:12px}.dtable thead th,.dtable tbody td{padding:7px 9px}}
@media (prefers-reduced-motion:reduce){.dtable tbody tr:hover td,.dtable tbody td{transition:none}}
</style>
<div class="dt-head"><span class="dt-kicker">例外 · 加装第二把</span></div>
<div class="dt-scroll"><table><thead><tr><th>例外场景</th><th>换 / 补</th><th>为什么</th></tr></thead><tbody>
<tr class="dt-flow"><td>纯前端调试，不在乎 token / mock / 跨机</td><td><strong>Chrome DevTools MCP</strong></td><td>最稳、F12 诊断直出、eval 逃生最少</td></tr>
<tr class="dt-flow"><td>纯自启浏览器的长期回归测试</td><td><strong>Playwright（库）</strong></td><td>成熟测试基建、actionability 最稳</td></tr>
<tr class="dt-flow"><td>把固定网站封成稳定命令</td><td><strong>bb-browser site adapter</strong></td><td>适配器复用页面登录态与前端逻辑</td></tr>
</tbody></table></div>
</figure>

### 2. 结果总表

下面这张热力图收全 T01-T20 靶场任务和 R01-R09 真实网站任务，颜色与图例见图内；图中标记：「粘滞」= `--cdp` 命中目标 profile 不可靠、需先复位常驻 daemon（见 7.2），「绑目录」= 依赖持久 userDataDir、不可移植（换目录即丢），`△` = 工具自身无持久化机制、只能搭外部持久浏览器便车，`N/A` = 该任务对该工具不适用，`N-R` = 该轮因环境/没跑成而无结果（非能力判定）；工具能力做不成记 ✕ 失败。

<figure class="benchviz bv-matrix" role="group" aria-label="六工具 × 三十一任务结果热力图">
<style>.benchviz{margin:1.8rem 0;font-family:var(--font-serif-body,system-ui)}
.benchviz *{box-sizing:border-box}
.bv-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem .9rem;margin-bottom:.7rem}
.bv-title{font-weight:700;font-size:1.02rem;color:var(--ink,#1a1815)}
.bv-hint{font-size:.82rem;color:var(--muted,#6a6155)}
.bv-legend{display:flex;flex-wrap:wrap;gap:.35rem .7rem;margin:.2rem 0 .8rem;font-size:.78rem;color:var(--muted,#6a6155)}
.bv-lg{display:inline-flex;align-items:center;gap:.32rem}
.bv-dot{width:1.05rem;height:1.05rem;border-radius:.3rem;display:inline-grid;place-items:center;font-size:.72rem;font-weight:700;line-height:1}
.bv-scroll{overflow-x:auto;border:1px solid var(--hair,rgba(26,24,21,.2));border-radius:.75rem;-webkit-overflow-scrolling:touch}
.benchviz table.bv-grid{border-collapse:separate;border-spacing:0;width:100%;min-width:760px;font-size:.8rem;border:0;border-radius:0;overflow:visible;margin:0}
.benchviz .bv-grid th,.benchviz .bv-grid td{border:0;border-bottom:1px solid rgba(26,24,21,.08);border-right:1px solid rgba(26,24,21,.06)}
.benchviz .bv-grid thead th{position:sticky;top:0;z-index:3;background:var(--paper-soft,#faf6ec);padding:.5rem .45rem;text-align:center;vertical-align:bottom}
.bv-colh b{display:block;font-size:.82rem;color:var(--ink,#1a1815);white-space:nowrap}
.bv-sub{display:block;font-size:.66rem;color:var(--muted,#6a6155);font-weight:400;margin-top:.1rem;white-space:nowrap}
.benchviz .bv-rowh{position:sticky;left:0;z-index:2;background:var(--paper-soft,#faf6ec);text-align:left;font-weight:600;color:var(--ink-soft,#3c362c);padding:.38rem .6rem;font-size:.76rem;white-space:nowrap;min-width:170px}
.benchviz .bv-corner{z-index:4}
.bv-tr.bv-real .bv-rowh{color:var(--red,#8f2d20)}
.bv-tr:hover td{filter:brightness(.97)}
.bv-tr:hover .bv-rowh{background:var(--paper-deep,#ece5d5)}
.benchviz .bv-c{padding:.32rem .3rem;text-align:center;vertical-align:middle;min-width:84px}
.bv-g{display:inline-block;font-size:1rem;font-weight:800;line-height:1.05}
.bv-mk{font-size:.62rem;font-weight:700;margin-left:1px;opacity:.85}
.bv-fnrow{display:block;line-height:1;margin-top:.18rem}.bv-fn{display:inline-block;font-size:.58rem;font-weight:700;line-height:1.32;padding:.05rem .32rem;border-radius:.32rem;letter-spacing:.01em;white-space:nowrap;vertical-align:middle}.bv-fn-cdp{background:#f4e8cc;color:#9a6516;border:1px solid #e0c98f}.bv-fn-dir{background:#eadcc6;color:#8a5a2b;border:1px solid #d9bd92}
.bv-n{display:block;font-size:.62rem;line-height:1.18;margin-top:.12rem;opacity:.82;max-width:120px;margin-inline:auto}
.bv-ok{background:#e7eedd}.bv-ok .bv-g{color:#4f7233}
.bv-oka{background:#e7eedd}.bv-oka .bv-g{color:#5c7a3f}
.bv-hatch{background-image:repeating-linear-gradient(45deg,rgba(79,114,51,.14)0,rgba(79,114,51,.14)3px,transparent 3px,transparent 7px)}
.bv-warn{background:#f4e8cc}.bv-warn .bv-g{color:#9a6516}
.bv-bad{background:#f1ddd6}.bv-bad .bv-g{color:#8f2d20}
.bv-nr{background:#ece7da}.bv-nr .bv-g{color:#a59b88}
.bv-na{background:repeating-linear-gradient(45deg,#ece7da 0,#ece7da 5px,#e4ddcb 5px,#e4ddcb 10px)}.bv-na .bv-g{color:#b3aa97}
.bv-dep{background:#ece4d2}.bv-dep .bv-g{color:#917f5c}
.bv-cov{margin-top:1rem}
.bv-covh{font-size:.82rem;font-weight:700;color:var(--ink,#1a1815);margin-bottom:.5rem}
.bv-covrow{display:flex;align-items:center;gap:.6rem;margin:.32rem 0}
.bv-covname{flex:0 0 9.5rem;font-size:.76rem;color:var(--ink-soft,#3c362c);font-weight:600;line-height:1.1}
.bv-covname small{display:block;font-size:.62rem;color:var(--muted,#6a6155);font-weight:400}
.bv-bar{flex:1;display:flex;height:.95rem;border-radius:.3rem;overflow:visible;background:#efe9da;min-width:120px}
.bv-seg{display:block;position:relative}.bv-seg:first-child{border-radius:.3rem 0 0 .3rem}.bv-seg:last-child{border-radius:0 .3rem .3rem 0}.bv-seg:hover{box-shadow:inset 0 0 0 1.5px rgba(26,24,21,.55);z-index:6}.bv-seg[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 7px);transform:translateX(-50%);background:#1a1815;color:#faf6ec;font-size:.72rem;line-height:1.3;font-weight:600;white-space:nowrap;padding:.3rem .55rem;border-radius:.4rem;box-shadow:0 3px 10px rgba(0,0,0,.28);z-index:30;pointer-events:none}.bv-seg[data-tip]:hover::before{content:"";position:absolute;left:50%;bottom:calc(100% + 2px);transform:translateX(-50%);border:5px solid transparent;border-top-color:#1a1815;z-index:30;pointer-events:none}
.bv-seg.bv-ok{background:#7c9c54}.bv-seg.bv-oka{background:#7c9c54;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.45)0,rgba(255,255,255,.45)2px,transparent 2px,transparent 5px)}
.bv-seg.bv-warn{background:#d6a64a}.bv-seg.bv-bad{background:#b4524a}.bv-seg.bv-dep{background:#bcae8e}.bv-seg.bv-nr{background:#d8cfba}.bv-seg.bv-na{background:#e4ddcb}
.bv-covnum{flex:0 0 5.2rem;text-align:right;font-size:.74rem;color:var(--muted,#6a6155)}
.bv-covnum b{font-size:1.02rem;color:var(--ink,#1a1815)}
@media(max-width:640px){.bv-rowh{min-width:140px}.bv-covname{flex-basis:7rem}}
.bv-tip{position:fixed;left:-9999px;top:-9999px;z-index:9999;max-width:260px;background:#1a1815;color:#faf6ec;font-size:.72rem;line-height:1.34;font-weight:600;padding:.32rem .55rem;border-radius:.4rem;box-shadow:0 4px 14px rgba(0,0,0,.3);pointer-events:none;opacity:0;transition:opacity .09s ease}.bv-tip.on{opacity:1}</style>
<div class="bv-head"><span class="bv-title">六工具 × 31 任务结果热力图</span><span class="bv-hint">绿=通过 · 黄=部分 · 红=失败 · 灰=不适用；斜纹=靠 eval/CDP 逃生补齐；悬停看每格说明；右滑看全部工具列。标记 <span class="bv-fn bv-fn-cdp">粘滞</span>=--cdp 命中不可靠（见 7.2）· <span class="bv-fn bv-fn-dir">绑目录</span>=持久 userDataDir 不可移植。</span></div>
<div class="bv-legend"><span class="bv-lg"><span class="bv-dot bv-ok">✓</span>通过</span><span class="bv-lg"><span class="bv-dot bv-oka">✓*</span>通过（靠 eval/CDP 逃生）</span><span class="bv-lg"><span class="bv-dot bv-warn">◐</span>部分 / JS 层补丁</span><span class="bv-lg"><span class="bv-dot bv-bad">✕</span>失败</span><span class="bv-lg"><span class="bv-dot bv-dep">△</span>借外部浏览器</span><span class="bv-lg"><span class="bv-dot bv-nr">–</span>N-R 环境/未跑成</span><span class="bv-lg"><span class="bv-dot bv-na">·</span>N/A 不适用</span></div>
<div class="bv-scroll" id="bv-heat"><table class="bv-grid"><thead><tr><th class="bv-rowh bv-corner">任务 \ 工具</th><th class="bv-colh"><b>@chrome</b><span class="bv-sub">无完整CDP · 默认Profile</span></th><th class="bv-colh"><b>@chrome</b><span class="bv-sub">开权限 · 默认Profile</span></th><th class="bv-colh"><b>@browser</b><span class="bv-sub">in-app</span></th><th class="bv-colh"><b>agent-browser</b><span class="bv-sub">CDP</span></th><th class="bv-colh"><b>bb-browser</b><span class="bv-sub">CDP</span></th><th class="bv-colh"><b>DevTools MCP</b><span class="bv-sub">CDP + DevTools</span></th><th class="bv-colh"><b>playwright-cli</b><span class="bv-sub">Playwright 引擎</span></th></tr></thead><tbody><tr class="bv-tr"><th class="bv-rowh" scope="row">T01 登录与观察</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）"><span class="bv-g">✓<sup class="bv-mk">*</sup></span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T02 Network 排障</th><td class="bv-c bv-bad" data-tip="失败：无响应体"><span class="bv-g">✕</span><span class="bv-n">无响应体</span></td><td class="bv-c bv-ok" data-tip="通过：读响应体"><span class="bv-g">✓</span><span class="bv-n">读响应体</span></td><td class="bv-c bv-bad" data-tip="失败：无响应体"><span class="bv-g">✕</span><span class="bv-n">无响应体</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：需 trace 重放"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">需 trace 重放</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T03 性能诊断</th><td class="bv-c bv-bad" data-tip="失败：无 perf API"><span class="bv-g">✕</span><span class="bv-n">无 perf API</span></td><td class="bv-c bv-ok" data-tip="通过：timing + Runtime"><span class="bv-g">✓</span><span class="bv-n">timing + Runtime</span></td><td class="bv-c bv-bad" data-tip="失败：无 perf API"><span class="bv-g">✕</span><span class="bv-n">无 perf API</span></td><td class="bv-c bv-ok" data-tip="通过：自挖 profiler"><span class="bv-g">✓</span><span class="bv-n">自挖 profiler</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（靠 eval/CDP 逃生）：无 perf 原语，eval 读 Performance API + longtask 自推"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 读 perf</span></td><td class="bv-c bv-ok" data-tip="通过：insight 直出"><span class="bv-g">✓</span><span class="bv-n">insight 直出</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T04 请求 mock</th><td class="bv-c bv-bad" data-tip="失败：无 route"><span class="bv-g">✕</span><span class="bv-n">无 route</span></td><td class="bv-c bv-bad" data-tip="失败：无可靠 route"><span class="bv-g">✕</span><span class="bv-n">无可靠 route</span></td><td class="bv-c bv-bad" data-tip="失败：无 route"><span class="bv-g">✕</span><span class="bv-n">无 route</span></td><td class="bv-c bv-ok" data-tip="通过：网络层"><span class="bv-g">✓</span><span class="bv-n">网络层</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（靠 eval/CDP 逃生）：JS 层补丁拿到空状态"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">JS 层补丁</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（靠 eval/CDP 逃生）：initScript 拿到空状态"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">JS 层 initScript</span></td><td class="bv-c bv-ok" data-tip="通过：网络层"><span class="bv-g">✓</span><span class="bv-n">网络层</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T05 动态等待</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：盲 sleep"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">盲 sleep</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T06 结构化提取</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）"><span class="bv-g">✓<sup class="bv-mk">*</sup></span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T07 已登录 fetch</th><td class="bv-c bv-bad" data-tip="失败：evaluate 无 fetch"><span class="bv-g">✕</span><span class="bv-n">evaluate 无 fetch</span></td><td class="bv-c bv-ok" data-tip="通过：Runtime fetch"><span class="bv-g">✓</span><span class="bv-n">Runtime fetch</span></td><td class="bv-c bv-bad" data-tip="失败：fetch 被拦"><span class="bv-g">✕</span><span class="bv-n">fetch 被拦</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）"><span class="bv-g">✓<sup class="bv-mk">*</sup></span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T08 Shadow DOM</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：Runtime 穿透"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">Runtime 穿透</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：双重 eval"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">双重 eval</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T09 扩展 reload</th><td class="bv-c bv-bad" data-tip="失败：chrome:// 被策略拦"><span class="bv-g">✕</span><span class="bv-n">chrome:// 被策略拦</span></td><td class="bv-c bv-bad" data-tip="失败：chrome:// 仍被拦"><span class="bv-g">✕</span><span class="bv-n">chrome:// 仍被拦</span></td><td class="bv-c bv-bad" data-tip="失败：封死 chrome://"><span class="bv-g">✕</span><span class="bv-n">封死 chrome://</span></td><td class="bv-c bv-ok" data-tip="通过：复位 daemon"><span class="bv-g">✓</span><span class="bv-fnrow"><span class="bv-fn bv-fn-cdp">粘滞</span></span><span class="bv-n">复位 daemon</span></td><td class="bv-c bv-bad" data-tip="失败：到不了扩展管理、没 reload"><span class="bv-g">✕</span><span class="bv-n">到不了扩展管理</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过：自管 context"><span class="bv-g">✓</span><span class="bv-n">自管 context</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T10a 真实登录态（默认 profile）</th><td class="bv-c bv-ok" data-tip="通过：70 · 默认Profile"><span class="bv-g">✓</span><span class="bv-n">70 · 默认Profile</span></td><td class="bv-c bv-ok" data-tip="通过：70 · 默认Profile"><span class="bv-g">✓</span><span class="bv-n">70 · 默认Profile</span></td><td class="bv-c bv-bad" data-tip="失败：无真实登录态"><span class="bv-g">✕</span><span class="bv-n">无真实登录态</span></td><td class="bv-c bv-ok" data-tip="通过：68"><span class="bv-g">✓</span><span class="bv-fnrow"><span class="bv-fn bv-fn-cdp">粘滞</span></span><span class="bv-n">68</span></td><td class="bv-c bv-ok" data-tip="通过：68"><span class="bv-g">✓</span><span class="bv-n">68</span></td><td class="bv-c bv-ok" data-tip="通过：68"><span class="bv-g">✓</span><span class="bv-n">68</span></td><td class="bv-c bv-ok" data-tip="✅ 多轮混合：Codex 两轮都 ✅——attach 9223 读到 GitHub 未读 70、抓到前五条主题；Claude 复跑轮 attach 崩、记 N-R。能力已证（attach 在 9223 有打开页面时成功），故记 ✓，见 4.7"><span class="bv-g">✓</span><span class="bv-n">attach 9223 · 70</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T10b 登录态持久化（专用 profile）</th><td class="bv-c bv-na" data-tip="不适用 N/A"><span class="bv-g">·</span></td><td class="bv-c bv-na" data-tip="不适用 N/A"><span class="bv-g">·</span></td><td class="bv-c bv-na" data-tip="不适用 N/A"><span class="bv-g">·</span></td><td class="bv-c bv-ok" data-tip="通过：可移植 state 文件"><span class="bv-g">✓</span><span class="bv-n">可移植 state 文件</span></td><td class="bv-c bv-dep" data-tip="借车 △：仅能 attach"><span class="bv-g">△</span><span class="bv-n">仅能 attach</span></td><td class="bv-c bv-ok" data-tip="通过：持久 userDataDir"><span class="bv-g">✓</span><span class="bv-fnrow"><span class="bv-fn bv-fn-dir">绑目录</span></span><span class="bv-n">持久 userDataDir</span></td><td class="bv-c bv-ok" data-tip="通过：可移植 state 文件"><span class="bv-g">✓</span><span class="bv-n">可移植 state 文件</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T10c 指定浏览器登录态（CDP 9223）</th><td class="bv-c bv-bad" data-tip="失败：绑不了外部 9223 profile"><span class="bv-g">✕</span><span class="bv-n">绑不了 9223</span></td><td class="bv-c bv-bad" data-tip="失败：仍不能证明 9223"><span class="bv-g">✕</span><span class="bv-n">仍不能证明 9223</span></td><td class="bv-c bv-bad" data-tip="失败：in-app 绑不了 9223"><span class="bv-g">✕</span><span class="bv-n">绑不了 9223</span></td><td class="bv-c bv-ok" data-tip="通过：9223 · 70/71"><span class="bv-g">✓</span><span class="bv-n">9223 · 70/71</span></td><td class="bv-c bv-ok" data-tip="通过：9223 · 70"><span class="bv-g">✓</span><span class="bv-n">9223 · 70</span></td><td class="bv-c bv-ok" data-tip="通过：9223 · 70"><span class="bv-g">✓</span><span class="bv-n">9223 · 70</span></td><td class="bv-c bv-ok" data-tip="通过：attach 9223 · 71"><span class="bv-g">✓</span><span class="bv-n">attach 9223 · 71</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T11 用扩展（设置页改徽标）</th><td class="bv-c bv-bad" data-tip="失败：options 被拦"><span class="bv-g">✕</span><span class="bv-n">options 被拦</span></td><td class="bv-c bv-bad" data-tip="失败：options 仍被拦"><span class="bv-g">✕</span><span class="bv-n">options 仍被拦</span></td><td class="bv-c bv-bad" data-tip="失败"><span class="bv-g">✕</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span><span class="bv-fnrow"><span class="bv-fn bv-fn-cdp">粘滞</span></span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（靠 eval/CDP 逃生）：CDP 强开设置页改徽标"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 强开设置页</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过：自管 context"><span class="bv-g">✓</span><span class="bv-n">自管 context</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T12 Console 与 Source Map</th><td class="bv-c bv-warn" data-tip="部分：仅 console/bundle"><span class="bv-g">◐</span><span class="bv-n">仅 console/bundle</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-warn" data-tip="部分：raw sourcemap blocked"><span class="bv-g">◐</span><span class="bv-n">raw sourcemap blocked</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：eval 取 map"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 取 map</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T13 移动端布局遮挡</th><td class="bv-c bv-bad" data-tip="失败：无 viewport"><span class="bv-g">✕</span><span class="bv-n">无 viewport</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：hit-test 后临时隐藏"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">hit-test 后临时隐藏</span></td><td class="bv-c bv-warn" data-tip="部分：未拿确认码"><span class="bv-g">◐</span><span class="bv-n">未拿确认码</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：eval 补确认码"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 补确认码</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：临时解除遮挡"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">临时解除遮挡</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：run-code 补确认码"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">run-code 补确认码</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T14 SPA 状态 / Hydration</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：eval 读 store"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 读 store</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T15 SSE 实时流等待</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：eval 触发 click"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 触发 click</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T16 Service Worker 缓存排障</th><td class="bv-c bv-warn" data-tip="部分：只证旧值"><span class="bv-g">◐</span><span class="bv-n">只证旧值</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-warn" data-tip="部分：未拿 live 值"><span class="bv-g">◐</span><span class="bv-n">未拿 live 值</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：eval/SW 诊断"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval/SW 诊断</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T17 跨域 iframe 授权</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T18 文件上传与拖拽输入</th><td class="bv-c bv-bad" data-tip="失败：no upload API"><span class="bv-g">✕</span><span class="bv-n">no upload API</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-bad" data-tip="失败：无 upload API"><span class="bv-g">✕</span><span class="bv-n">无 upload API</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T19 键盘可访问性</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：eval 补确认码"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 补确认码</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T20 回归稳定性 / Flake Rate</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：eval 触发 click"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 触发 click</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R01 GitHub 公共仓库代码导航</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过（Codex 轮 attach 9223 成功）；Claude 复跑两轮 attach 崩、记 N-R（见 4.7）"><span class="bv-g">✓</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R02 GitHub 真实登录态只读通知</th><td class="bv-c bv-ok" data-tip="通过：70"><span class="bv-g">✓</span><span class="bv-n">70</span></td><td class="bv-c bv-ok" data-tip="通过：70"><span class="bv-g">✓</span><span class="bv-n">70</span></td><td class="bv-c bv-bad" data-tip="失败：无真实登录态（绑不了9223）"><span class="bv-g">✕</span><span class="bv-n">无登录态</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过（Codex 轮 attach 9223 成功）；Claude 复跑两轮 attach 崩、记 N-R（见 4.7）"><span class="bv-g">✓</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R03 MDN 文档结构化阅读</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过（Codex 轮 attach 9223 成功）；Claude 复跑两轮 attach 崩、记 N-R（见 4.7）"><span class="bv-g">✓</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R04 npm 包页面元数据</th><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过（Codex 轮 attach 9223 成功）；Claude 复跑两轮 attach 崩、记 N-R（见 4.7）"><span class="bv-g">✓</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R05 Chrome Web Store 扩展详情</th><td class="bv-c bv-bad" data-tip="失败：Web Store 不可脚本化"><span class="bv-g">✕</span><span class="bv-n">Web Store 不可脚本化</span></td><td class="bv-c bv-bad" data-tip="失败：detached"><span class="bv-g">✕</span><span class="bv-n">detached</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过（Codex 轮 attach 9223 成功）；Claude 复跑两轮 attach 崩、记 N-R（见 4.7）"><span class="bv-g">✓</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R06 扩展注入真实网站</th><td class="bv-c bv-warn" data-tip="部分：可见注入，options 不可达"><span class="bv-g">◐</span><span class="bv-n">可见注入，options 不可达</span></td><td class="bv-c bv-warn" data-tip="部分：可见注入，options 不可达"><span class="bv-g">◐</span><span class="bv-n">可见注入，options 不可达</span></td><td class="bv-c bv-bad" data-tip="失败：绑不了9223/无扩展"><span class="bv-g">✕</span><span class="bv-n">无扩展</span></td><td class="bv-c bv-ok" data-tip="通过：options UI 改徽标、真实页验证"><span class="bv-g">✓</span><span class="bv-n">options 改徽标</span></td><td class="bv-c bv-bad" data-tip="失败"><span class="bv-g">✕</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="✅ 多轮混合：Codex unified 轮 ✅——attach 9223、options UI 改徽标 REAL-SITE-2026、刷新真实页验证 REAL-SITE-2026 · v1.0.0、还原默认；Codex rerun2 轮 ❌——线上文章页全新导航 transient 失败（非能力）；Claude 复跑轮 attach 崩 N-R。能力已证，故记 ✓，见 4.7"><span class="bv-g">✓</span><span class="bv-n">options 改徽标</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R07 真实网站 Network 响应体</th><td class="bv-c bv-bad" data-tip="失败：无响应体"><span class="bv-g">✕</span><span class="bv-n">无响应体</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-bad" data-tip="失败：无 Network 响应体"><span class="bv-g">✕</span><span class="bv-n">无响应体</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="通过（Codex 轮 attach 9223 成功）；Claude 复跑两轮 attach 崩、记 N-R（见 4.7）"><span class="bv-g">✓</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R08 真实网站请求拦截</th><td class="bv-c bv-bad" data-tip="失败：无 route"><span class="bv-g">✕</span><span class="bv-n">无 route</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）：URL block"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">URL block</span></td><td class="bv-c bv-bad" data-tip="失败：无 route"><span class="bv-g">✕</span><span class="bv-n">无 route</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-bad" data-tip="失败：无 route 原语"><span class="bv-g">✕</span><span class="bv-n">无 route</span></td><td class="bv-c bv-oka bv-hatch" data-tip="通过（逃生）"><span class="bv-g">✓<sup class="bv-mk">*</sup></span></td><td class="bv-c bv-ok" data-tip="通过（Codex 轮 attach 9223 成功）；Claude 复跑两轮 attach 崩、记 N-R（见 4.7）"><span class="bv-g">✓</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R09 真实网站 HAR 与性能快照</th><td class="bv-c bv-bad" data-tip="失败：无 timing"><span class="bv-g">✕</span><span class="bv-n">无 timing</span></td><td class="bv-c bv-ok" data-tip="通过：timing"><span class="bv-g">✓</span><span class="bv-n">timing</span></td><td class="bv-c bv-warn" data-tip="部分"><span class="bv-g">◐</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-warn" data-tip="部分"><span class="bv-g">◐</span></td><td class="bv-c bv-ok" data-tip="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" data-tip="✅ 能力已证（多轮混合）：Codex unified 轮 ✅——抓到 PerformanceResourceTiming 性能证据（最慢资源 JS~929ms/字体~882ms）；Codex rerun2 轮 ⚠️——复用已开文章 tab，线上页全新导航 transient 失败；Claude 复跑轮 attach 崩 N-R。性能已取（完整 HAR 偏弱），故记 ✓，见 4.7"><span class="bv-g">✓</span><span class="bv-n">性能✅（HAR 偏弱）</span></td></tr></tbody></table></div>
<div class="bv-cov"><div class="bv-covh">能力覆盖（同口径 31 格，含 R01-R09 外场）</div><div class="bv-covrow"><span class="bv-covname">@chrome<small>无完整CDP · 默认Profile</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:14" data-tip="通过 · 14 格" aria-label="通过 · 14 格"></span><span class="bv-seg bv-warn" style="flex:3" data-tip="部分 / JS 层补丁 · 3 格" aria-label="部分 / JS 层补丁 · 3 格"></span><span class="bv-seg bv-bad" style="flex:13" data-tip="失败 · 13 格" aria-label="失败 · 13 格"></span><span class="bv-seg bv-na" style="flex:1" data-tip="N/A 不适用 · 1 格" aria-label="N/A 不适用 · 1 格"></span></span><span class="bv-covnum"><b>14</b><small>/30 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">@chrome<small>开权限 · 默认Profile</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:21" data-tip="通过 · 21 格" aria-label="通过 · 21 格"></span><span class="bv-seg bv-oka" style="flex:3" data-tip="通过（靠 eval/CDP 逃生） · 3 格" aria-label="通过（靠 eval/CDP 逃生） · 3 格"></span><span class="bv-seg bv-warn" style="flex:1" data-tip="部分 / JS 层补丁 · 1 格" aria-label="部分 / JS 层补丁 · 1 格"></span><span class="bv-seg bv-bad" style="flex:5" data-tip="失败 · 5 格" aria-label="失败 · 5 格"></span><span class="bv-seg bv-na" style="flex:1" data-tip="N/A 不适用 · 1 格" aria-label="N/A 不适用 · 1 格"></span></span><span class="bv-covnum"><b>24</b><small>/30 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">@browser<small>in-app</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:13" data-tip="通过 · 13 格" aria-label="通过 · 13 格"></span><span class="bv-seg bv-warn" style="flex:4" data-tip="部分 / JS 层补丁 · 4 格" aria-label="部分 / JS 层补丁 · 4 格"></span><span class="bv-seg bv-bad" style="flex:13" data-tip="失败 · 13 格" aria-label="失败 · 13 格"></span><span class="bv-seg bv-na" style="flex:1" data-tip="N/A 不适用 · 1 格" aria-label="N/A 不适用 · 1 格"></span></span><span class="bv-covnum"><b>13</b><small>/30 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">agent-browser<small>CDP</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:24" data-tip="通过 · 24 格" aria-label="通过 · 24 格"></span><span class="bv-seg bv-oka" style="flex:7" data-tip="通过（靠 eval/CDP 逃生） · 7 格" aria-label="通过（靠 eval/CDP 逃生） · 7 格"></span></span><span class="bv-covnum"><b>31</b><small>/31 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">bb-browser<small>CDP</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:8" data-tip="通过 · 8 格" aria-label="通过 · 8 格"></span><span class="bv-seg bv-oka" style="flex:18" data-tip="通过（靠 eval/CDP 逃生） · 18 格" aria-label="通过（靠 eval/CDP 逃生） · 18 格"></span><span class="bv-seg bv-warn" style="flex:1" data-tip="部分 / JS 层补丁 · 1 格" aria-label="部分 / JS 层补丁 · 1 格"></span><span class="bv-seg bv-bad" style="flex:3" data-tip="失败 · 3 格" aria-label="失败 · 3 格"></span><span class="bv-seg bv-dep" style="flex:1" data-tip="借外部浏览器 △ · 1 格" aria-label="借外部浏览器 △ · 1 格"></span></span><span class="bv-covnum"><b>26</b><small>/30 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">DevTools MCP<small>CDP + DevTools</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:28" data-tip="通过 · 28 格" aria-label="通过 · 28 格"></span><span class="bv-seg bv-oka" style="flex:3" data-tip="通过（靠 eval/CDP 逃生） · 3 格" aria-label="通过（靠 eval/CDP 逃生） · 3 格"></span></span><span class="bv-covnum"><b>31</b><small>/31 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">playwright-cli<small>Playwright 引擎</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:30" data-tip="通过 · 30 格" aria-label="通过 · 30 格"></span><span class="bv-seg bv-oka" style="flex:1" data-tip="通过（靠 eval/CDP 逃生） · 1 格" aria-label="通过（靠 eval/CDP 逃生） · 1 格"></span></span><span class="bv-covnum"><b>31</b><small>/31 通过</small></span></div></div></figure>

过程成本——我用 CodeX 和 Claude code 各跑了一轮"。

**① Claude Code 轮（Opus 4.8）**：同一批 30 道题，每工具一个独立 workflow 严格顺序跑。Round 1 连 9223、Round 2 连 9224（两台等价的已登录测试 profile）；agent-browser / bb-browser / devtools-mcp 连 CDP，playwright-cli 用自管浏览器。

<figure class="benchcost bc-claude" role="group" aria-label="成本对比 ① Claude Code（Opus 4.8）">
<style>.benchcost{margin:1.6rem 0;font-family:var(--font-serif-body,system-ui)}
.benchcost *{box-sizing:border-box}
.bc-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem .9rem;margin-bottom:.6rem}
.bc-title{font-weight:700;font-size:1rem;color:var(--ink,#1a1815)}
.bc-hint{font-size:.8rem;color:var(--muted,#6a6155)}
.bc-scroll{overflow-x:auto;border:1px solid var(--hair,rgba(26,24,21,.2));border-radius:.75rem}
.benchcost table.bc-tab{border-collapse:separate;border-spacing:0;width:100%;min-width:680px;font-size:.82rem;border:0;border-radius:0;overflow:visible;margin:0}
.benchcost .bc-tab th,.benchcost .bc-tab td{border:0;border-bottom:1px solid rgba(26,24,21,.08);padding:.42rem .6rem;text-align:left;vertical-align:middle}
.benchcost .bc-tab thead th{background:var(--paper-soft,#faf6ec);position:sticky;top:0;font-size:.74rem;color:var(--ink-soft,#3c362c);white-space:nowrap}
.bc-tab tbody tr:hover td{background:rgba(26,24,21,.025)}
.bc-tool{font-weight:700;color:var(--ink,#1a1815);white-space:nowrap}
.bc-tool small{display:block;font-weight:400;font-size:.66rem;color:var(--muted,#6a6155)}
.bc-mode{font-size:.72rem;color:var(--muted,#6a6155);white-space:nowrap}
.bc-res{display:flex;flex-wrap:wrap;gap:.2rem}
.bc-chip{font-size:.68rem;font-weight:700;padding:.05rem .34rem;border-radius:.3rem;line-height:1.35;white-space:nowrap}
.bc-chip.ok{background:#e7eedd;color:#4f7233}.bc-chip.warn{background:#f4e8cc;color:#9a6516}.bc-chip.bad{background:#f1ddd6;color:#8f2d20}.bc-chip.nr{background:#ece7da;color:#a59b88}
.bc-num{position:relative;min-width:108px}
.bc-fill{position:absolute;left:0;top:0;bottom:0;border-radius:0 .25rem .25rem 0;opacity:.32;z-index:0}
.bc-v{position:relative;z-index:1;font-variant-numeric:tabular-nums;font-weight:600;color:var(--ink,#1a1815)}
.bc-v small{font-weight:400;color:var(--muted,#6a6155);font-size:.72em}
.bc-best .bc-v{color:#4f7233}.bc-worst .bc-v{color:#8f2d20}
.bc-flag{font-size:.64rem;margin-left:.25rem;font-weight:700}
.bc-foot{font-size:.74rem;color:var(--muted,#6a6155);margin-top:.5rem;line-height:1.45}</style>
<div class="bc-head"><span class="bc-title">成本对比 ① Claude Code（Opus 4.8）</span><span class="bc-hint">柱越长越贵；<b style="color:#4f7233">▼省</b> / <b style="color:#8f2d20">▲贵</b> 标该列最优/最差。</span></div>
<div class="bc-scroll"><table class="bc-tab"><thead><tr><th>工具</th><th>轮 / 浏览器</th><th>结果（30 题）</th><th>耗时<small> min</small></th><th>token</th><th>工具调用</th><th>browserOps</th><th>eval 自救</th></tr></thead><tbody><tr><td class="bc-tool">agent-browser<small>0.27.2</small></td><td class="bc-mode">R1·9223</td><td><span class="bc-res"><span class="bc-chip ok">29✅</span></span></td><td class="bc-num"><span class="bc-fill" style="width:54%;background:#c08a3e"></span><span class="bc-v">25.8</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:58%;background:#7a86b8"></span><span class="bc-v">190.6<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:66%;background:#9a8ab0"></span><span class="bc-v">183<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num"><span class="bc-fill" style="width:58%;background:#6f9aa8"></span><span class="bc-v">218</span></td><td class="bc-num"><span class="bc-fill" style="width:62%;background:#c0795f"></span><span class="bc-v">24</span></td></tr><tr><td class="bc-tool">agent-browser<small>0.27.2</small></td><td class="bc-mode">R2·9224</td><td><span class="bc-res"><span class="bc-chip ok">30✅</span></span></td><td class="bc-num"><span class="bc-fill" style="width:55%;background:#c08a3e"></span><span class="bc-v">26.4</span></td><td class="bc-num"><span class="bc-fill" style="width:63%;background:#7a86b8"></span><span class="bc-v">205.0</span></td><td class="bc-num"><span class="bc-fill" style="width:84%;background:#9a8ab0"></span><span class="bc-v">233</span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#6f9aa8"></span><span class="bc-v">378<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:15%;background:#c0795f"></span><span class="bc-v">6<span class="bc-flag" style="color:#4f7233">▼省</span></span></td></tr><tr><td class="bc-tool">bb-browser<small>0.14.2</small></td><td class="bc-mode">R1·9223</td><td><span class="bc-res"><span class="bc-chip ok">22✅</span><span class="bc-chip warn">3⚠️</span><span class="bc-chip bad">5❌</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#c08a3e"></span><span class="bc-v">47.9<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num"><span class="bc-fill" style="width:83%;background:#7a86b8"></span><span class="bc-v">271.9</span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#9a8ab0"></span><span class="bc-v">277<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num"><span class="bc-fill" style="width:65%;background:#6f9aa8"></span><span class="bc-v">244</span></td><td class="bc-num"><span class="bc-fill" style="width:85%;background:#c0795f"></span><span class="bc-v">33</span></td></tr><tr><td class="bc-tool">bb-browser<small>0.14.2</small></td><td class="bc-mode">R2·9224</td><td><span class="bc-res"><span class="bc-chip ok">26✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip bad">3❌</span></span></td><td class="bc-num"><span class="bc-fill" style="width:87%;background:#c08a3e"></span><span class="bc-v">41.9</span></td><td class="bc-num"><span class="bc-fill" style="width:71%;background:#7a86b8"></span><span class="bc-v">233.3</span></td><td class="bc-num"><span class="bc-fill" style="width:91%;background:#9a8ab0"></span><span class="bc-v">252</span></td><td class="bc-num"><span class="bc-fill" style="width:82%;background:#6f9aa8"></span><span class="bc-v">311</span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#c0795f"></span><span class="bc-v">39<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td></tr><tr><td class="bc-tool">chrome-devtools-mcp</td><td class="bc-mode">R1·9223</td><td><span class="bc-res"><span class="bc-chip ok">28✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip bad">1❌</span></span></td><td class="bc-num"><span class="bc-fill" style="width:53%;background:#c08a3e"></span><span class="bc-v">25.5</span></td><td class="bc-num"><span class="bc-fill" style="width:99%;background:#7a86b8"></span><span class="bc-v">322.7</span></td><td class="bc-num"><span class="bc-fill" style="width:83%;background:#9a8ab0"></span><span class="bc-v">230</span></td><td class="bc-num"><span class="bc-fill" style="width:45%;background:#6f9aa8"></span><span class="bc-v">169</span></td><td class="bc-num"><span class="bc-fill" style="width:64%;background:#c0795f"></span><span class="bc-v">25</span></td></tr><tr><td class="bc-tool">chrome-devtools-mcp</td><td class="bc-mode">R2·9224</td><td><span class="bc-res"><span class="bc-chip ok">29✅</span><span class="bc-chip bad">1❌</span></span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:49%;background:#c08a3e"></span><span class="bc-v">23.6<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#7a86b8"></span><span class="bc-v">327.4<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num"><span class="bc-fill" style="width:79%;background:#9a8ab0"></span><span class="bc-v">220</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:43%;background:#6f9aa8"></span><span class="bc-v">161<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num"><span class="bc-fill" style="width:44%;background:#c0795f"></span><span class="bc-v">17</span></td></tr><tr><td class="bc-tool">playwright-cli<small>0.1.14</small></td><td class="bc-mode">R1·自管</td><td><span class="bc-res"><span class="bc-chip ok">24✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip bad">5❌</span></span></td><td class="bc-num"><span class="bc-fill" style="width:55%;background:#c08a3e"></span><span class="bc-v">26.4</span></td><td class="bc-num"><span class="bc-fill" style="width:62%;background:#7a86b8"></span><span class="bc-v">203.7</span></td><td class="bc-num"><span class="bc-fill" style="width:68%;background:#9a8ab0"></span><span class="bc-v">188</span></td><td class="bc-num"><span class="bc-fill" style="width:49%;background:#6f9aa8"></span><span class="bc-v">184</span></td><td class="bc-num"><span class="bc-fill" style="width:97%;background:#c0795f"></span><span class="bc-v">38</span></td></tr><tr><td class="bc-tool">playwright-cli<small>0.1.14</small></td><td class="bc-mode">R2·自管</td><td><span class="bc-res"><span class="bc-chip ok">25✅</span><span class="bc-chip bad">5❌</span></span></td><td class="bc-num"><span class="bc-fill" style="width:51%;background:#c08a3e"></span><span class="bc-v">24.3</span></td><td class="bc-num"><span class="bc-fill" style="width:64%;background:#7a86b8"></span><span class="bc-v">209.3</span></td><td class="bc-num"><span class="bc-fill" style="width:68%;background:#9a8ab0"></span><span class="bc-v">188</span></td><td class="bc-num"><span class="bc-fill" style="width:50%;background:#6f9aa8"></span><span class="bc-v">189</span></td><td class="bc-num"><span class="bc-fill" style="width:46%;background:#c0795f"></span><span class="bc-v">18</span></td></tr></tbody></table></div>
<div class="bc-foot">两轮(R1 9223 / R2 9224)。<b>耗时/token 两轮稳</b>，可比；<b>browserOps/eval 自救摆动大</b>(同 subagent 口径不一，只看趋势)。agent-browser R1 的 29✅ 是子代理漏报 R06，R2 干净 30✅。bb-browser R2 已含 R09 重测✅(上次 N-R 是站点网络抽风)。playwright-cli 自管有 5 题快速失败(自管无真实登录态/扩展、npm 被 Cloudflare 拦)，低耗时不等于“做了同样多题”。</div>
</figure>

四条读数：① **bb-browser 是成本黑洞**——47.9min ≈ agent-browser 的 1.86×，调用/操作数最高却结果最差（4❌），根因还是 4.6 那个 click 事件 bug 逼出的处处 eval 重试——纯工具缺陷把成本顶上去。② **devtools-mcp 操作最省（169）、token 最贵（322.7k）**——MCP 每次回传冗长 a11y 快照/网络体，单 op 很贵，但能力最稳（28✅、零 ❌）。③ **agent-browser 综合最省**——耗时、token 双低，结果还最全；④ **playwright-cli 的低成本要打折看**：它有 5 题没做成、都记 ✕——自管浏览器没真实登录态/扩展（R02/R06/T10a）、npm 被 Cloudflare 拦（R04/R07），这些快速失败反而压低了耗时/token。

**② Codex 轮（gpt-5.5）**：多测了 Codex 专属的 `@chrome` / `@browser`。耗时是各 subagent 自报、**不可跨宿主与 Claude 轮直接比**。

<figure class="benchcost bc-codex" role="group" aria-label="成本对比 ② Codex 轮（gpt-5.5）">
<style>.benchcost{margin:1.6rem 0;font-family:var(--font-serif-body,system-ui)}
.benchcost *{box-sizing:border-box}
.bc-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem .9rem;margin-bottom:.6rem}
.bc-title{font-weight:700;font-size:1rem;color:var(--ink,#1a1815)}
.bc-hint{font-size:.8rem;color:var(--muted,#6a6155)}
.bc-scroll{overflow-x:auto;border:1px solid var(--hair,rgba(26,24,21,.2));border-radius:.75rem}
.benchcost table.bc-tab{border-collapse:separate;border-spacing:0;width:100%;min-width:680px;font-size:.82rem;border:0;border-radius:0;overflow:visible;margin:0}
.benchcost .bc-tab th,.benchcost .bc-tab td{border:0;border-bottom:1px solid rgba(26,24,21,.08);padding:.42rem .6rem;text-align:left;vertical-align:middle}
.benchcost .bc-tab thead th{background:var(--paper-soft,#faf6ec);position:sticky;top:0;font-size:.74rem;color:var(--ink-soft,#3c362c);white-space:nowrap}
.bc-tab tbody tr:hover td{background:rgba(26,24,21,.025)}
.bc-tool{font-weight:700;color:var(--ink,#1a1815);white-space:nowrap}
.bc-tool small{display:block;font-weight:400;font-size:.66rem;color:var(--muted,#6a6155)}
.bc-mode{font-size:.72rem;color:var(--muted,#6a6155);white-space:nowrap}
.bc-res{display:flex;flex-wrap:wrap;gap:.2rem}
.bc-chip{font-size:.68rem;font-weight:700;padding:.05rem .34rem;border-radius:.3rem;line-height:1.35;white-space:nowrap}
.bc-chip.ok{background:#e7eedd;color:#4f7233}.bc-chip.warn{background:#f4e8cc;color:#9a6516}.bc-chip.bad{background:#f1ddd6;color:#8f2d20}.bc-chip.nr{background:#ece7da;color:#a59b88}
.bc-num{position:relative;min-width:108px}
.bc-fill{position:absolute;left:0;top:0;bottom:0;border-radius:0 .25rem .25rem 0;opacity:.32;z-index:0}
.bc-v{position:relative;z-index:1;font-variant-numeric:tabular-nums;font-weight:600;color:var(--ink,#1a1815)}
.bc-v small{font-weight:400;color:var(--muted,#6a6155);font-size:.72em}
.bc-best .bc-v{color:#4f7233}.bc-worst .bc-v{color:#8f2d20}
.bc-flag{font-size:.64rem;margin-left:.25rem;font-weight:700}
.bc-foot{font-size:.74rem;color:var(--muted,#6a6155);margin-top:.5rem;line-height:1.45}</style>
<div class="bc-head"><span class="bc-title">成本对比 ② Codex 轮（gpt-5.5）</span><span class="bc-hint">subagent 环境未暴露逐 agent token/$，成本只比耗时/操作/逃生。</span></div>
<div class="bc-scroll"><table class="bc-tab"><thead><tr><th>工具</th><th>浏览器模式</th><th>31 格结果</th><th>耗时<small> min</small></th><th>tool_calls</th><th>browserOps</th><th>eval 自救</th></tr></thead><tbody><tr><td class="bc-tool">@chrome</td><td class="bc-mode">默认 Profile fallback</td><td><span class="bc-res"><span class="bc-chip ok">15✅</span><span class="bc-chip warn">2⚠️</span><span class="bc-chip bad">13❌</span></span></td><td class="bc-num"><span class="bc-fill" style="width:40%;background:#c08a3e"></span><span class="bc-v">11.9</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:25%;background:#9a8ab0"></span><span class="bc-v">61<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#6f9aa8"></span><span class="bc-v">245<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#c0795f"></span><span class="bc-v">105<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td></tr><tr><td class="bc-tool">@browser</td><td class="bc-mode">in-app browser</td><td><span class="bc-res"><span class="bc-chip ok">14✅</span><span class="bc-chip warn">2⚠️</span><span class="bc-chip bad">14❌</span></span></td><td class="bc-num"><span class="bc-fill" style="width:36%;background:#c08a3e"></span><span class="bc-v">10.9</span></td><td class="bc-num"><span class="bc-fill" style="width:26%;background:#9a8ab0"></span><span class="bc-v">64</span></td><td class="bc-num"><span class="bc-fill" style="width:53%;background:#6f9aa8"></span><span class="bc-v">129</span></td><td class="bc-num"><span class="bc-fill" style="width:30%;background:#c0795f"></span><span class="bc-v">31</span></td></tr><tr><td class="bc-tool">agent-browser</td><td class="bc-mode">CDP 9223</td><td><span class="bc-res"><span class="bc-chip ok">30✅</span></span></td><td class="bc-num"><span class="bc-fill" style="width:58%;background:#c08a3e"></span><span class="bc-v">17.5</span></td><td class="bc-num"><span class="bc-fill" style="width:85%;background:#9a8ab0"></span><span class="bc-v">205</span></td><td class="bc-num"><span class="bc-fill" style="width:68%;background:#6f9aa8"></span><span class="bc-v">166</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:7%;background:#c0795f"></span><span class="bc-v">7<span class="bc-flag" style="color:#4f7233">▼省</span></span></td></tr><tr><td class="bc-tool">bb-browser</td><td class="bc-mode">CDP 9223*</td><td><span class="bc-res"><span class="bc-chip ok">19✅</span><span class="bc-chip warn">4⚠️</span><span class="bc-chip bad">6❌</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#c08a3e"></span><span class="bc-v">30.0<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#9a8ab0"></span><span class="bc-v">242<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num"><span class="bc-fill" style="width:81%;background:#6f9aa8"></span><span class="bc-v">198</span></td><td class="bc-num"><span class="bc-fill" style="width:66%;background:#c0795f"></span><span class="bc-v">69</span></td></tr><tr><td class="bc-tool">Chrome DevTools MCP</td><td class="bc-mode">CDP 9223</td><td><span class="bc-res"><span class="bc-chip ok">26✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip bad">2❌</span></span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:17%;background:#c08a3e"></span><span class="bc-v">5.0<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num"><span class="bc-fill" style="width:50%;background:#9a8ab0"></span><span class="bc-v">120</span></td><td class="bc-num"><span class="bc-fill" style="width:46%;background:#6f9aa8"></span><span class="bc-v">112</span></td><td class="bc-num"><span class="bc-fill" style="width:25%;background:#c0795f"></span><span class="bc-v">26</span></td></tr><tr><td class="bc-tool">playwright-cli</td><td class="bc-mode">CDP 9223</td><td><span class="bc-res"><span class="bc-chip ok">28✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip bad">1❌</span></span></td><td class="bc-num"><span class="bc-fill" style="width:87%;background:#c08a3e"></span><span class="bc-v">26.0</span></td><td class="bc-num"><span class="bc-fill" style="width:28%;background:#9a8ab0"></span><span class="bc-v">68</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:25%;background:#6f9aa8"></span><span class="bc-v">62<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num"><span class="bc-fill" style="width:40%;background:#c0795f"></span><span class="bc-v">42</span></td></tr></tbody></table></div>
<div class="bc-foot">本表为 <b>2026-06-21 下午 rerun2</b> 的 6 工具完整轮。<b>耗时为各 subagent 自报、不可跨宿主与 Claude 轮直接比</b>(如 DevTools MCP 5min 是自报值非真实墙钟)。这轮另抓到 output token(总量 95%+ 为缓存输入、很便宜，真实生成量看 output)：@chrome 44.7k · @browser 40.9k · agent-browser 49.3k · bb-browser 37.6k；devtools-mcp / playwright-cli 本轮 output 未采全。bb-browser 标 <code>9223*</code> 因 daemon status drift。</div>
</figure>

跨宿主交叉印证 + 关键差异（这才是放两张表的意义）：

- **结论一致**：agent-browser / DevTools MCP / playwright-cli 三家在两个宿主都接近满格、零或极少 ❌（Codex 轮 agent-browser 拿到 30✅）；bb-browser 两边都垫底（Codex rerun2 6❌+4⚠️ / Claude R2 3❌+1⚠️，且都靠大量 eval/CDP 逃生）；`@chrome` / `@browser`（只有 Codex 能测）受扩展安全域 + 默认 Profile 限制，大量任务做不成、记 **✕**（rerun2：@chrome 13❌、@browser 14❌），`@browser` 的逃生高达 **31~104 次**——几乎全是只读 eval 提取（in-app browser 只能这么取数，不是 raw CDP 能力）。
- **差异①（重要）**：playwright-cli attach 9223 的结果跨轮不一致（Codex 轮 rerun2 拿到 28✅/1⚠️/1❌，Claude 轮没接上、改自管浏览器）。根因见 4.7：成败取决于 9223 当下有没有打开的页面（有页面即 attach 成功、并存扩展也不崩；无页面才崩于 `Browser.setDownloadBehavior`），不是扩展集——别把"playwright-cli 接不进 9223"当成铁律。
- **差异②（耗时不可跨宿主比）**：Codex 轮 DevTools MCP 自报 **5.0 min**，和 Claude 轮 ~24min 差得离谱，几乎肯定是两个宿主的计时/记账口径不同（Codex 的"耗时"是 subagent 自报，非真实墙钟），**不能解读成"DevTools MCP 快 5 倍"**——token/耗时只在同一宿主内可比，跨宿主只看趋势。
- **token 口径**：Codex rerun2 的总 token 看着上千万，其实 **95%+ 是缓存输入**(便宜)，真实生成量看 output(37k–49k)；Claude 轮 harness 只给单一 token 总量(未拆 in/out)。两边 token 都别直接折算成同一个 $。


#### 成本 × 能力 × 速度：只装一款选谁

把三轴一起看（**速度只用 Claude 同宿主可比的两轮**；Codex 耗时是 subagent 自报、跨宿主不可比，不参与排速度）：

- **速度**：agent-browser / DevTools MCP / playwright-cli 三家挤在 **~24.6–26.1 min**，彼此差 ~1.5 min（落在轮次噪声里）、**实质平手**；真正慢的只有 bb-browser（**~45 min ≈ 1.8×**）。
- **token**：agent-browser **最省（~198k）**，DevTools MCP **最贵（~325k ≈ 1.6×）**，两者做的是同样多的活——这是三轴里**唯一拉得开差距**的一项。
- **能力**：agent-browser 与 DevTools MCP 并列最强；agent-browser 还独占运行时 route + HAR + 扩展 options + 可移植登录态。

速度既是平手，决定权就落在 **token + 能力**——两者都指向 agent-browser。

<div class="bv-pick" style="margin:1.4rem 0;padding:.9rem 1.1rem;border-left:4px solid #4f7233;background:var(--paper-soft,#faf6ec);border-radius:.5rem;font-size:.92rem;line-height:1.65">
<b>只装一款 → agent-browser。</b> 三轴里它：能力第一梯队、token 最省（≈ DevTools MCP 的 60%）、速度与最快者打平——等于<b>花最少的 token、用差不多的时间，把最全的活干了</b>。代价是一次性的 <code>--cdp</code> daemon 接入坑（先 <code>close --all</code> 复位一次，见 7.2）+ 少数任务掉 eval 兜底。<br>
<b style="color:#8f2d20">唯一例外</b>：如果你的活<b>纯粹是前端调试</b>（perf / Console / source map / 网络面板）、追求最稳零逃生、<b>且不在乎 token</b> → 选 <b>Chrome DevTools MCP</b>（快一丢丢、最稳，但每轮多烧 ≈60% token、且没有运行时 route）。按具体任务场景细分见前面第 1 节。
</div>

T09/T10/T11 把战场从 localhost 网页挪到真实登录态与扩展安全域，其中涉及真实登录态的几格由两轮互相独立的隔离子 Agent 实测（一轮 Claude Code 主控、一轮 Codex），结论一致，差异只在评分口径（详见 4.7）。2026-06-20 又追加了 T10c，专门测“工具能否绑定用户指定的现成 9223 profile”，避免把默认 profile、自管 state 和指定 CDP profile 混成一个概念。

关键前置（影响上表 T09/T10/T11 怎么读）：目标机器的系统默认 Chrome（CDP 9223）是**企业管控**的，会在运行时拦截"加载已解压扩展"（扩展自身 `chrome-extension://` 资源返回 `ERR_BLOCKED_BY_CLIENT`、content script 不注入），所以 T09/T11 的扩展宿主改用一台**干净的 Chrome for Testing**（`--disable-features=DisableLoadExtensionCommandLineSwitch --load-extension` 才能让 137+ 真正加载扩展）；T10a/T10c 仍在企业 9223 上测真实登录态。GitHub 未读数是动态字段：早期 T10a 读到 **68**，T10c 运行时从 **70** 变为 **71**。

T12–T20 是 2026-06-19 追加的"前端开发者专项"。本轮每个工具一个独立子 Agent，实际靶场跑在 `http://localhost:4400/`（任务卡里的 `4399` 是旧端口；当时 4399 已被占用）。这一组不再只测"能不能点页面"，而是测前端排障里最常见的九类证据链：Console + sourcemap、移动端遮挡、hydration、SSE、Service Worker、跨源 iframe、文件上传、键盘可访问性和 flake 统计。

读者指出这一版仍然偏"靶场"之后，我又把真实网站外场任务补成 R01-R09，并直接合进上面这张总表。**这组是真实网站**：动态字段（GitHub 未读数、npm 版本、资源耗时等）会变，所以每格都带了观察时间、最终 URL、profile 和证据（详见第 3 节）。`N-R` 在这里表示运行时不可用或该能力未暴露，不等于网站本身失败；`✅*` 表示用 URL block 或启动参数证明了网络层阻断，但不是运行时 route API。

上表主体为 2026-06-19/20 Codex 单轮；`@chrome（开权限）`列是 2026-06-20 对系统默认 Chrome Profile 的追加复测，不再使用 9223；`@chrome（无完整 CDP）`列是 2026-06-21 在同一默认 Profile 上关闭完整 CDP 后的复测。无完整 CDP 时，`@chrome` 不再是 9/9 N-R：页面级操作、默认 Profile 登录态、Shadow DOM、iframe、SSE、GitHub/MDN/npm 阅读都能做；缺的是 Network body、Performance timing、route/mock、viewport、file upload、特权页和 9223 绑定。开完整 CDP 后，Network body、Runtime fetch、Performance timing、文件上传等能力明显放开；用户手动把 Bench Badge 装进默认 Profile 后，R06 至少能证明真实线上文章出现 `BENCH EXT v1.0.0`，但 `chrome-extension://.../options.html` 仍被 URL policy 拦住，所以不能把徽标改成 `REAL-SITE-2026`，只能记 ⚠️。2026-06-20 我又用 Claude Code 主控、每工具一个干净 Subagent，把外场 R01-R09 和靶场 T01-T20 **各独立复跑两轮**收方差：**agent-browser R06 两轮实测都是 ✅**（上表那笔 ⚠️ 只是 Codex Subagent 观察漏判）、playwright-cli 在外场 attach 9223 两轮确定性崩溃、动态字段两轮吻合（GitHub 未读 70 等），两轮明细见第 3 节"两轮独立复跑校准"。注意这不等于 playwright-cli 永远接不进 9223：T10c 单题用 `attach --cdp=http://127.0.0.1:9223` 已经成功。外场没有推翻推荐，反而更强化了第 1 节的结论：通用单选仍是 agent-browser，而 DevTools MCP 稳居"纯前端排障"这个例外场景的首选。

## 二、测试过程：怎么测出来的、逐格为什么

### 3. 实测方法：基准测试站与任务设计

本地零依赖的基准测试站，每页埋一个已知答案的坑。固定靶场负责可复现：网站不会变、登录态可控、标准答案能机械核对。真实网站负责外场真实性：它能暴露站点改版、登录态差异、Chrome Web Store 限制、真实 Network 波动、扩展注入线上页面这些靶场刻意压掉的变量。两者维度不同，但既然是同一时刻、同一批工具跑的一次快照，就合进第 2 节同一张结果总表——代价是动态网站那几列的绝对值带时间戳、换时间复跑要重测，同一轮内仍可横比。

<figure class="dtable" role="group" aria-label="T01 至 T20 靶场任务卡：每题的坑、标准答案与考的理论维度，加粗维度为分界题">
<div class="dt-head"><span class="dt-kicker">§3 靶场任务卡 · T01–T20</span></div>
<div class="dt-scroll"><table><thead><tr><th>任务</th><th>坑</th><th>标准答案</th><th>考的理论维度</th></tr></thead><tbody>
<tr class="dt-flow"><td>T01 登录与观察</td><td>欢迎语由 /api/me 异步渲染</td><td>工号 BENCH-7341</td><td>快照质量、观察时机</td></tr>
<tr class="dt-flow"><td>T02 Network 排障</td><td>下单接口固定 500，页面文案笼统</td><td>INSUFFICIENT_INVENTORY / SKU-8821</td><td><strong>CDP Network 层留底</strong></td></tr>
<tr class="dt-flow"><td>T03 性能诊断</td><td>CSS 延迟 1.2s + 800ms 长任务 + 图延迟 1.5s</td><td>阻塞 CSS 是 LCP 主因（见 4.3）</td><td><strong>DevTools 诊断模型</strong></td></tr>
<tr class="dt-flow"><td>T04 请求 mock</td><td>成员接口真实返回 18 人</td><td>mock 空列表 → 空状态截图</td><td><strong>CDP 拦截层</strong></td></tr>
<tr class="dt-flow"><td>T05 动态等待</td><td>流式渲染 + 延迟出现的按钮</td><td>12 条 / LIVE-512</td><td>等待策略、动作可靠性</td></tr>
<tr class="dt-flow"><td>T06 结构化提取</td><td>脏 DOM + 千分位 + 分页</td><td>12 件、最贵雷霆工作站 15999</td><td>阅读成本、字段清洗</td></tr>
<tr class="dt-flow"><td>T07 已登录 fetch</td><td>/api/me 仅带 cookie 可访问</td><td>plan = team-pro-2026</td><td><strong>页面 Runtime 可写性</strong></td></tr>
<tr class="dt-flow"><td>T08 Shadow DOM</td><td>open shadow 里的按钮和兑换码</td><td>SHADOW-99</td><td>快照穿透、事件注入</td></tr>
<tr class="dt-flow"><td>T09 扩展 reload</td><td>加载本地解压扩展，需进 <code>chrome://extensions</code> 重新加载</td><td>扩展 reload 成功、特权页可达</td><td><strong>特权页可达性 / 安全策略</strong></td></tr>
<tr class="dt-flow"><td>T10 真实登录态与持久化</td><td>GitHub 通知页需真实登录态，并拆成默认 profile、自管持久化、指定 9223 三条路线</td><td>免登录读到当次未读数；专用 profile 可移植恢复；指定 9223 必须命中 target</td><td><strong>复用真实 profile / 跨会话持久化 / 指定 CDP profile</strong></td></tr>
<tr class="dt-flow"><td>T11 用扩展（设置页改徽标）</td><td>需进 <code>chrome-extension://…/options.html</code> 改设置</td><td>在扩展设置页成功改掉徽标</td><td><strong>特权页操作 / 产品封装范围</strong></td></tr>
<tr class="dt-flow"><td>T12 Console 与 Source Map</td><td>bundle 报错，真实源码藏在 sourcemap</td><td><code>coupon.ts</code> / <code>applySelectedCoupon</code> / 空值 guard</td><td><strong>Console + Source Map 取证</strong></td></tr>
<tr class="dt-flow"><td>T13 移动端布局遮挡</td><td>移动端底部帮助条覆盖支付按钮</td><td><code>.mobile-support-bar</code> 覆盖，确认码 <code>MOBILE-39</code></td><td><strong>viewport / hit-test / CSS 诊断</strong></td></tr>
<tr class="dt-flow"><td>T14 SPA Hydration 不一致</td><td>SSR 状态与客户端接管状态不一致</td><td><code>TaskSummary</code>，<code>HYD-908</code>，8→9 / starter→team-pro</td><td><strong>Console 结构化对象 + 页面状态</strong></td></tr>
<tr class="dt-flow"><td>T15 SSE 实时流等待</td><td>EventSource 分批推送，不能提前读结果</td><td>5 条，最后 <code>evt-005</code>，告警 <code>STREAM-721</code></td><td><strong>实时流等待 / 完成态判断</strong></td></tr>
<tr class="dt-flow"><td>T16 Service Worker 缓存</td><td>SW 拦截接口，页面看到旧配置</td><td>旧值 blue/cached，live 值 green/live</td><td><strong>SW 控制面 / Network bypass</strong></td></tr>
<tr class="dt-flow"><td>T17 跨域 iframe 授权</td><td>父页 localhost，子 iframe 127.0.0.1</td><td><code>iframe-user@bench.dev / OAUTH-314</code></td><td><strong>跨源 iframe 操作</strong></td></tr>
<tr class="dt-flow"><td>T18 文件上传输入</td><td>标准 file input 需要真实本地文件</td><td><code>upload-token.txt</code>，36 bytes，<code>UPLOAD-448</code></td><td><strong>file chooser / upload 能力</strong></td></tr>
<tr class="dt-flow"><td>T19 键盘可访问性</td><td>看似按钮，键盘不可达</td><td><code>div role=button</code> 缺 <code>tabindex</code> 和键盘 handler</td><td><strong>键盘遍历 / a11y DOM 诊断</strong></td></tr>
<tr class="dt-flow"><td>T20 回归稳定性</td><td>10 次检查里固定 3 次失败</td><td>7/10，通过率 70%，失败轮次 3/6/9</td><td><strong>重复执行 / flake 率统计</strong></td></tr>
</tbody></table></div>
</figure>

加粗的几道是按 6.2 的边界公式设计的"分界题"——它们恰好把六个工具分成了几个阵营。

<figure class="taskmap" data-reveal role="group" aria-label="20 道靶场题按理论维度分组的交互筛选图：点一个维度，高亮该能力层考的题，并标出分界题">
<style>
.taskmap{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--paper-vsoft:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);--gray:#917f5c;--gray-b:#ece4d2;--cyan:#3f6d79;--cyan-b:#dcebed;--cyan-e:#8fbcc4;--red:#8f2d20;--red-b:#f1ddd6;--red-e:#cf9b90;--amb:#9a6516;--amb-b:#f4e8cc;--amb-e:#d9b66a;--pur:#54579a;--pur-b:#e6e7f3;--pur-e:#a9adcf;margin:0;padding:clamp(16px,3.4vw,28px);font-family:var(--serif);color:var(--ink);line-height:1.5;background:radial-gradient(130% 90% at 92% 0%,var(--paper-soft),transparent 60%),linear-gradient(160deg,var(--paper-vsoft),var(--paper-deep));border:1px solid var(--hair);border-radius:14px;position:relative;overflow:hidden}
.taskmap *{box-sizing:border-box;min-width:0}
.taskmap .tm-radio{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.taskmap .tm-head{position:relative;z-index:2;margin-bottom:12px}
.taskmap .tm-kicker{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--cyan);display:inline-flex;align-items:center;gap:8px}
.taskmap .tm-kicker::before{content:"";width:22px;height:1px;background:var(--cyan)}
.taskmap .tm-title{font-size:clamp(15px,3vw,20px);font-weight:700;margin:7px 0 3px}
.taskmap .tm-sub{font-size:12.5px;color:var(--muted);max-width:64ch}
.taskmap .tm-sub b{color:var(--ink-soft);font-weight:600}
.taskmap .tm-tabs{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}
.taskmap .tm-tab{font-family:var(--mono);font-size:11.5px;padding:5px 11px;border:1.5px solid var(--hair);border-radius:9px;background:var(--paper-soft);color:var(--muted);cursor:pointer;user-select:none;white-space:nowrap;transition:border-color .2s,color .2s,background .2s,transform .15s}
.taskmap .tm-tab .tm-d{display:inline-block;width:8px;height:8px;border-radius:3px;background:var(--tw-c,var(--ink));margin-right:6px;vertical-align:1px}
.taskmap .tm-tab:hover{color:var(--ink-soft);border-color:var(--tw-c,var(--hair))}
.taskmap #tm-all:checked ~ .tm-tabs .lt-all,.taskmap #tm-page:checked ~ .tm-tabs .lt-page,.taskmap #tm-cdp:checked ~ .tm-tabs .lt-cdp,.taskmap #tm-priv:checked ~ .tm-tabs .lt-priv,.taskmap #tm-login:checked ~ .tm-tabs .lt-login,.taskmap #tm-front:checked ~ .tm-tabs .lt-front{color:var(--tw-c,var(--ink));border-color:var(--tw-c,var(--ink));background:color-mix(in srgb,var(--tw-c,var(--ink)) 12%,var(--paper-soft));font-weight:700;transform:translateY(-1px)}
.taskmap #tm-all:focus-visible ~ .tm-tabs .lt-all,.taskmap #tm-page:focus-visible ~ .tm-tabs .lt-page,.taskmap #tm-cdp:focus-visible ~ .tm-tabs .lt-cdp,.taskmap #tm-priv:focus-visible ~ .tm-tabs .lt-priv,.taskmap #tm-login:focus-visible ~ .tm-tabs .lt-login,.taskmap #tm-front:focus-visible ~ .tm-tabs .lt-front{outline:2px solid var(--tw-c,var(--ink));outline-offset:2px}
.taskmap .tm-caps{position:relative;z-index:2;min-height:2.6em;margin-bottom:11px}
.taskmap .tm-cap{display:none;font-size:12.5px;color:var(--ink-soft);line-height:1.6;border-left:3px solid var(--tw-c,var(--ink));padding:2px 0 2px 11px}
.taskmap .tm-cap b{color:var(--tw-c,var(--ink));font-weight:700}
.taskmap #tm-all:checked ~ .tm-caps .cap-all,.taskmap #tm-page:checked ~ .tm-caps .cap-page,.taskmap #tm-cdp:checked ~ .tm-caps .cap-cdp,.taskmap #tm-priv:checked ~ .tm-caps .cap-priv,.taskmap #tm-login:checked ~ .tm-caps .cap-login,.taskmap #tm-front:checked ~ .tm-caps .cap-front{display:block;animation:tm-fade .4s ease both}
@keyframes tm-fade{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.taskmap .tm-grid{position:relative;z-index:2;display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}
.taskmap .tm-chip{position:relative;display:flex;flex-direction:column;gap:1px;border:1.5px solid var(--gc,var(--hair));border-left-width:4px;border-radius:8px;background:var(--gb,var(--paper-soft));padding:7px 9px;transition:opacity .35s ease,filter .35s ease,transform .2s ease,box-shadow .2s ease}
.taskmap .tm-chip:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(26,24,21,.1)}
.taskmap .tm-chip b{font-family:var(--mono);font-size:12px;color:var(--gd,var(--ink))}
.taskmap .tm-chip small{font-size:11px;color:var(--ink-soft);line-height:1.25}
.taskmap .tm-chip.g-page{--gc:var(--gray);--gd:var(--gray);--gb:linear-gradient(180deg,var(--gray-b),var(--paper-soft))}
.taskmap .tm-chip.g-cdp{--gc:var(--cyan-e);--gd:var(--cyan);--gb:linear-gradient(180deg,var(--cyan-b),var(--paper-soft))}
.taskmap .tm-chip.g-priv{--gc:var(--red-e);--gd:var(--red);--gb:linear-gradient(180deg,var(--red-b),var(--paper-soft))}
.taskmap .tm-chip.g-login{--gc:var(--amb-e);--gd:var(--amb);--gb:linear-gradient(180deg,var(--amb-b),var(--paper-soft))}
.taskmap .tm-chip.g-front{--gc:var(--pur-e);--gd:var(--pur);--gb:linear-gradient(180deg,var(--pur-b),var(--paper-soft))}
.taskmap .tm-star{position:absolute;top:-8px;right:8px;font-family:var(--mono);font-size:9px;letter-spacing:.06em;color:#fff;background:var(--gd,var(--ink));padding:1px 6px;border-radius:20px;font-weight:700}
.taskmap .tm-chip.is-edge{box-shadow:inset 0 0 0 1px var(--gc)}
.taskmap #tm-page:checked ~ .tm-grid .tm-chip:not(.g-page),.taskmap #tm-cdp:checked ~ .tm-grid .tm-chip:not(.g-cdp),.taskmap #tm-priv:checked ~ .tm-grid .tm-chip:not(.g-priv),.taskmap #tm-login:checked ~ .tm-grid .tm-chip:not(.g-login),.taskmap #tm-front:checked ~ .tm-grid .tm-chip:not(.g-front){opacity:.26;filter:grayscale(.55)}
.taskmap #tm-page:checked ~ .tm-grid .tm-chip.g-page,.taskmap #tm-cdp:checked ~ .tm-grid .tm-chip.g-cdp,.taskmap #tm-priv:checked ~ .tm-grid .tm-chip.g-priv,.taskmap #tm-login:checked ~ .tm-grid .tm-chip.g-login,.taskmap #tm-front:checked ~ .tm-grid .tm-chip.g-front{transform:translateY(-2px);box-shadow:0 4px 14px rgba(26,24,21,.12)}
.taskmap .tm-foot{position:relative;z-index:2;margin-top:13px;border-top:1px solid var(--hair);padding-top:10px;font-family:var(--mono);font-size:10.5px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 14px}
.taskmap .tm-foot .tm-edge-key{color:var(--ink-soft)}
.taskmap .tm-foot .tm-edge-key b{display:inline-block;color:#fff;background:var(--ink);border-radius:20px;padding:0 6px;font-size:9px}
@media (max-width:560px){.taskmap .tm-grid{grid-template-columns:repeat(auto-fill,minmax(108px,1fr))}.taskmap .tm-tab{font-size:11px;padding:5px 9px}}
@media (prefers-reduced-motion:reduce){.taskmap .tm-cap,.taskmap .tm-chip{animation:none;transition:none}}
</style>
<input type="radio" name="taskmap-tab" id="tm-all" class="tm-radio" checked>
<input type="radio" name="taskmap-tab" id="tm-page" class="tm-radio">
<input type="radio" name="taskmap-tab" id="tm-cdp" class="tm-radio">
<input type="radio" name="taskmap-tab" id="tm-priv" class="tm-radio">
<input type="radio" name="taskmap-tab" id="tm-login" class="tm-radio">
<input type="radio" name="taskmap-tab" id="tm-front" class="tm-radio">
<div class="tm-head"><span class="tm-kicker">§3 任务设计</span><div class="tm-title">20 道靶场题，其实只在考 5 类能力层</div><div class="tm-sub">每道题都按 6.2 的<b>边界公式</b>落到某一能力层。点下面的维度，看这层考了哪几题；带 <b>分界</b> 标的 7 道是<b>分界题</b>——它们恰好把六个工具切成不同阵营。</div></div>
<div class="tm-tabs"><label class="tm-tab lt-all" for="tm-all" style="--tw-c:#1a1815"><span class="tm-d"></span>全部 20 题</label><label class="tm-tab lt-page" for="tm-page" style="--tw-c:#917f5c"><span class="tm-d"></span>页面共用底座</label><label class="tm-tab lt-cdp" for="tm-cdp" style="--tw-c:#3f6d79"><span class="tm-d"></span>CDP 调试面</label><label class="tm-tab lt-priv" for="tm-priv" style="--tw-c:#8f2d20"><span class="tm-d"></span>特权页 / 安全域</label><label class="tm-tab lt-login" for="tm-login" style="--tw-c:#9a6516"><span class="tm-d"></span>真实登录态 / 持久化</label><label class="tm-tab lt-front" for="tm-front" style="--tw-c:#54579a"><span class="tm-d"></span>前端专项</label></div>
<div class="tm-caps"><div class="tm-cap cap-all" style="--tw-c:#1a1815">20 题按能力层分成 5 组；<b>7 道分界题</b>集中落在 CDP 调试面、特权页与真实登录态——这正是六个工具差距最大的三处。</div><div class="tm-cap cap-page" style="--tw-c:#917f5c">六个工具都接到的<b>最低一层</b>：纯页面观察与操作，全员通过，只有快照质量差异、没有能力缺口。</div><div class="tm-cap cap-cdp" style="--tw-c:#3f6d79">Network 留底、请求拦截、页面 Runtime、性能诊断、Console/SW——<b>是否开到完整 CDP</b> 在这里直接分高下。</div><div class="tm-cap cap-priv" style="--tw-c:#8f2d20">能不能进 <span style="font-family:var(--mono)">chrome://extensions</span> 和扩展 <span style="font-family:var(--mono)">options.html</span>——<b>最硬的分水岭</b>，多数工具到不了。</div><div class="tm-cap cap-login" style="--tw-c:#9a6516">复用你登录过的真实 profile、把状态搬到别处恢复——<b>一道题拆成默认 / 自管持久化 / 指定 9223 三条路线</b>。</div><div class="tm-cap cap-front" style="--tw-c:#54579a">跨源 iframe、文件上传、键盘可访问性、flake 率——<b>前端排障的长尾</b>，考的是细节覆盖面。</div></div>
<div class="tm-grid"><span class="tm-chip g-page"><b>T01</b><small>登录与观察</small></span><span class="tm-chip g-cdp is-edge"><span class="tm-star">分界</span><b>T02</b><small>Network 排障</small></span><span class="tm-chip g-cdp is-edge"><span class="tm-star">分界</span><b>T03</b><small>性能诊断</small></span><span class="tm-chip g-cdp is-edge"><span class="tm-star">分界</span><b>T04</b><small>请求 mock</small></span><span class="tm-chip g-page"><b>T05</b><small>动态等待</small></span><span class="tm-chip g-page"><b>T06</b><small>结构化提取</small></span><span class="tm-chip g-cdp is-edge"><span class="tm-star">分界</span><b>T07</b><small>已登录 fetch</small></span><span class="tm-chip g-page"><b>T08</b><small>Shadow DOM</small></span><span class="tm-chip g-priv is-edge"><span class="tm-star">分界</span><b>T09</b><small>扩展 reload</small></span><span class="tm-chip g-login is-edge"><span class="tm-star">分界</span><b>T10</b><small>真实登录态与持久化</small></span><span class="tm-chip g-priv is-edge"><span class="tm-star">分界</span><b>T11</b><small>用扩展改徽标</small></span><span class="tm-chip g-cdp"><b>T12</b><small>Console 与 Source Map</small></span><span class="tm-chip g-cdp"><b>T13</b><small>移动端布局遮挡</small></span><span class="tm-chip g-cdp"><b>T14</b><small>SPA Hydration</small></span><span class="tm-chip g-cdp"><b>T15</b><small>SSE 实时流</small></span><span class="tm-chip g-cdp"><b>T16</b><small>Service Worker 缓存</small></span><span class="tm-chip g-front"><b>T17</b><small>跨域 iframe 授权</small></span><span class="tm-chip g-front"><b>T18</b><small>文件上传</small></span><span class="tm-chip g-front"><b>T19</b><small>键盘可访问性</small></span><span class="tm-chip g-front"><b>T20</b><small>回归稳定性</small></span></div>
<div class="tm-foot"><span class="tm-edge-key"><b>分界</b> ＝ 按 6.2 边界公式设计、把六工具分阵营的题（共 7 道）</span><span>点维度标签筛选 · 再点「全部 20 题」复位</span></div>
</figure>


真实网站外场任务放在 `tasks-real/`，结果与 T01-T20 一起并进第 2 节同一张结果总表（动态字段带时间戳）：

<figure class="dtable" role="group" aria-label="R01 至 R09 真实网站外场任务：站点与考察重点">
<div class="dt-head"><span class="dt-kicker">§3 外场任务 · R01–R09</span></div>
<div class="dt-scroll"><table><thead><tr><th>任务</th><th>真实网站</th><th>重点</th></tr></thead><tbody>
<tr class="dt-flow"><td>R01 GitHub 公共仓库代码导航</td><td>GitHub</td><td>真实 SPA、代码导航、站内搜索</td></tr>
<tr class="dt-flow"><td>R02 GitHub 真实登录态只读通知</td><td>GitHub notifications</td><td>真实 profile、只读账号状态</td></tr>
<tr class="dt-flow"><td>R03 MDN 文档结构化阅读</td><td>MDN</td><td>文档搜索、结构化提取</td></tr>
<tr class="dt-flow"><td>R04 npm 包页面元数据</td><td>npm</td><td>动态元数据、页面证据</td></tr>
<tr class="dt-flow"><td>R05 Chrome Web Store 扩展详情</td><td>Chrome Web Store</td><td>插件生态真实页面，只读扩展信息</td></tr>
<tr class="dt-flow"><td>R06 扩展注入真实网站</td><td>线上 Garden Lab 文章</td><td>content script、options 页、真实页面注入</td></tr>
<tr class="dt-flow"><td>R07 真实网站 Network 响应体</td><td>npm</td><td>请求列表、响应体、页面与 JSON 交叉验证</td></tr>
<tr class="dt-flow"><td>R08 真实网站请求拦截</td><td>MDN</td><td>route / abort / mock、资源降级验证</td></tr>
<tr class="dt-flow"><td>R09 真实网站 HAR 与性能快照</td><td>线上 Garden Lab 文章</td><td>HAR / trace / 性能瀑布图</td></tr>
</tbody></table></div>
</figure>

这组任务的答案不能像 T01-T20 那样全部写死：GitHub 通知数、npm 当前版本、Chrome Web Store 按钮文案、资源耗时都会变。任务卡里写的是"答案生成规则"：必须记录观察时间、最终 URL、profile、工具版本和截图 / Network / trace 证据；任何会写真实网站状态的动作都直接判失败。

这轮外场的实际结果矩阵已与 T01-T20 并列放在[第 2 节结果总表](#2-结果总表)，此处不再重复。`N-R` 表示运行时不可用或该能力未暴露，不等于网站本身失败；`✅*` 表示 DevTools MCP 用 daemon 启动参数阻断指定资源，能证明网络层阻断，但不是运行时 route API。

几条关键解释：早期 @chrome 在 R01-R09 轮曾因 Codex Chrome Extension 在 selected profile 里 disabled 被记成 N-R；2026-06-21 复测证明，这不是“无完整 CDP 权限”的真实上限。bridge 可用但无完整 CDP 时，@chrome 的 R01/R02/R03/R04 可跑，R06 能验证 content script 注入，真正过不去的是 Web Store 特殊页、Network response body、route/HAR 和扩展 options。T10c 再测时 plugin 已可连，但它打开的唯一 URL 没有出现在 9223 target 列表，所以仍不能算“指定 9223 profile”成功。@browser 是 in-app browser，不能绑定 9223，所以登录态、扩展、Network body、route/HAR 都不能算通过；playwright-cli 在 R01-R09 按约束不能自启浏览器，attach 9223 又被现有扩展 service worker target 断言打断，但 T10c 单题 attach 9223 成功。agent-browser 的 R06 记 ⚠️：它写扩展 options 和线上页面注入实际成功，主控复核 DOM 为 `REAL-SITE-2026 · v1.0.0`，但该 Subagent 自己观察漏判。

#### R01-R09 与 T01-T20 的两轮独立复跑（2026-06-20 校准）

第 2 节那两张结果总表（T01-T20 与 R01-R09）都只跑了一轮（agent-browser 同日两轮）。为收方差，我又补跑了一轮：2026-06-20 我用 **Claude Code 主控、每工具一个干净 Subagent、顺序复用同一台 9223 测试 Chrome**（playwright-cli 这轮未 attach 上 9223、改用自管浏览器；当前实测 attach 9223 需其有打开的页面才成，见 4.7），把外场 R01-R09 和靶场 T01-T20 **各独立跑了两轮**专门收方差。这轮只比四个真实 CLI/MCP 工具（Codex 专属 `@chrome`/`@browser` 无等价物，未纳入），与同日 Codex 轮互不参考。

**外场 R01-R09（×2 轮，全 9223）：**

<figure class="dtable" role="group" aria-label="外场 R01-R09 两轮独立复跑结果与关键校准">
<div class="dt-head"><span class="dt-kicker">复跑校准 · 外场 ×2 轮（全 9223）</span></div>
<div class="dt-scroll"><table><thead><tr><th>工具</th><th>第 1 轮</th><th>第 2 轮</th><th>关键校准</th></tr></thead><tbody>
<tr class="dt-flow"><td>agent-browser</td><td>9✅</td><td>9✅</td><td><strong>R06 两轮实测都是 ✅（非上表 ⚠️）</strong>——经 options UI 改徽标并在真实页验证 <code>REAL-SITE-2026 · v1.0.0</code>，坐实上表那笔 ⚠️ 只是 Codex Subagent 观察漏判</td></tr>
<tr class="dt-flow"><td>chrome-devtools-mcp</td><td>8✅+1 N-R</td><td>8✅+1⚠️*</td><td><strong>R08 无运行时 route</strong>：这轮 gh server 已在运行、用不上 daemon 的 <code>--blockedUrlPattern</code> 启动入口，只能 JS 层降级 → 判 N-R/⚠️*，比上表 ✅*（启动级阻断）更严，但方向一致——它没有运行时拦截 API</td></tr>
<tr class="dt-flow"><td>bb-browser</td><td>7✅+1⚠️+1 N-R</td><td>7✅+1❌+1 N-R</td><td>R06 在 ⚠️↔❌ 间抖动（chrome-extension URL 改写 bug 这轮够不着逃生通道）；R08 无 route 原语稳定 N-R</td></tr>
<tr class="dt-flow"><td>playwright-cli</td><td>9 N-R</td><td>9 N-R</td><td>这轮两轮都未 <code>connectOverCDP</code> attach 上；当前实测 attach 9223 需其有打开的页面才成（无页面则崩于 <code>Browser.setDownloadBehavior</code>），见 4.7</td></tr>
</tbody></table></div>
</figure>

**靶场 T01-T20（21 卡含 T10a/b，×2 轮，混合浏览器）：**

<figure class="dtable" role="group" aria-label="靶场 T01-T20 两轮独立复跑结果">
<div class="dt-head"><span class="dt-kicker">复跑校准 · 靶场 ×2 轮（21 卡含 T10a/b）</span></div>
<div class="dt-scroll"><table><thead><tr><th>工具</th><th>第 1 轮</th><th>第 2 轮</th></tr></thead><tbody>
<tr class="dt-flow"><td>chrome-devtools-mcp</td><td>21✅（零逃生）</td><td>20✅+1⚠️(T10b)</td></tr>
<tr class="dt-flow"><td>agent-browser</td><td>20✅+1⚠️(T10b)</td><td>21✅</td></tr>
<tr class="dt-flow"><td>playwright-cli</td><td>20✅+1 N-R(T10a)</td><td>18✅+1⚠️(T09)+2 N-R(T10a/b)</td></tr>
<tr class="dt-flow"><td>bb-browser</td><td>16✅+4❌(T04/T09/T11/T17)+1 N-R</td><td>14✅+4❌+3⚠️</td></tr>
</tbody></table></div>
</figure>

**一致性**：外场 36 格里 34 格两轮一致；靶场 84 格里 77 格一致（91.7%）、**0 格事实错误**，7 处抖动全落在 T09/T10b/T13/T18 这类"逃生能否兜底 / 持久化口径 / unpacked reload flake"的边界格。所有动态字段两轮完全吻合，可作为这一时点的权威观测：GitHub 未读 **70**、npm `@playwright/test` **v1.61.0** / 周下载 **42,613,659** / Apache-2.0、React DevTools 评分 **4.0（1,633）** / **5,000,000** 用户、靶场标准答案（BENCH-7341 / SKU-8821 / hero.svg / 雷霆工作站 15999 / SHADOW-99 / STREAM-721 / CACHE-BUST-42 / OAUTH-314 / FLAKE-307 等）全部答对。

**一个必须记录的环境坑**：靶场第 1 轮里 T15/T16/T17/T20 四工具集体失败，根因是**环境而非工具**——运行中的靶场服务进程是更早启动的旧版本、缺后来才加的 `/api/realtime-events`·`/api/settings`·`/api/flake-check` 路由（404）；且 T17 跨域 iframe 子页走的 `127.0.0.1:4399` 被另一个本机服务占用。重启 `server.mjs`、把占端口的服务迁走之后四题重跑：T15/T16/T20 四工具全 ✅，T17 三工具 ✅、bb-browser ❌（缺跨域 OOPIF 切换/坐标点击，是真实工具短板）。这条提醒任何复现者：**跑靶场前先确认服务是当前版本、4399 没被别的进程抢**。

**结论没变，只是更扎实**：两轮下来，**chrome-devtools-mcp 仍是最稳、零逃生的前端排障首选**（靶场两轮 21✅/20✅、外场只差一个运行时 route）；**agent-browser 是能力最全的全能选手**——若抛开 7.2 那个粘滞 daemon 的 `--cdp` 可靠性硬伤，它在"运行时 route + HAR + 扩展 options + 专用 profile 持久化"上的覆盖面其实是四家里最广的，是最接近"一个工具全包"的候选；**playwright-cli 自管浏览器、CI 友好，T10c 能 attach 9223，但接管真实 profile 的 attach 依赖其浏览器状态（需页面在场，见 4.7）**；**bb-browser 读取类够快，但 mock / 扩展设置页 / 跨域 iframe / 网络拦截四类硬短板叠加 URL 归一化 bug，仍是修一处能改命、但当前最弱的一个**。

正式数据全部来自独立会话：每个单元格（任务 × 工具）由一个全新上下文、既不知道答案也不知道工具已知 bug 的无偏 Agent 执行（Claude Code 无头 `claude -p` 进程或 Codex 隔离子 Agent），提示词只含任务原文、工具限定与约 25 次操作止损线，禁止 curl/读源码旁路，单元格之间重启基准测试站清状态——这样测到的是真实用户要付的成本，而非熟练者的最优解。每个单元格记录判定（✅/⚠️/❌ 按任务卡标准）、操作数、轮数、耗时、成本，以及 **eval 自救次数**（Agent 被迫弃用工具原语、改用 eval 直接执行 JS 才能推进的次数，见 5.2）。需如实声明的局限：第一批单元格基本只跑一次，后续又用 Claude 独立轮对 R01-R09 和 T01-T20 收过一次方差；@chrome/@browser 跑在 Codex 宿主内，时间/调用数只能粗比，但**能力判定不受宿主影响**；固定基准测试站全在 localhost、版本固定；R01-R09 外场只代表 2026-06-19/20 这一次真实网站状态，本文只把它作为同一快照的单独分栏并入总览，不拿动态答案和靶场静态答案互相替代。

### 4. 逐维度拆解：每道题的结果与边界成因

这是全文核心：逐维度看结果，并用 6.2 的公式把每个 ❌/⚠️ 落到具体是哪个因素造成的。

#### 4.1 页面观察与操作（T01/T05/T06/T08 的 ✅ 半区）：网页面是大家共用的底座

网页面是六个工具都接到的最低一层，纯页面任务全员通过：T01 六家全过，T05/T08 也只有质量差异、没有能力缺口。**六个工具全部采用"可访问性快照 + 元素编号引用"工作流**（@eN / e15 / uid），第 6 节把它列为友好度第一要素，现在可以说它已是事实标准。

但"全过"之下藏着三档工程质量，全部来自动作可靠性：

- **playwright-cli** 继承了 Playwright 引擎的 actionability 检查（点击前自动滚动到可视区、等待可交互）：让 agent-browser 静默空点两次的"视口外 3px 按钮"，它一次命中。
- **agent-browser** 无此检查：CSS selector 路径点视口外按钮**报成功但无事发生**，子 Agent 花 16 条命令自查到坐标问题才用 scrollintoview 解决；走快照 ref 路径则可避开。同一工具两轮 13 vs 26 条命令的方差，全由 Agent 碰巧选了哪条路径决定。
- **bb-browser** 的合成事件注入整体失效（4.5）。

Shadow DOM（T08）同样体现"层与质量"的分离：可访问性树天生跨过 open shadow 边界，所以**六家快照全部看得见**里面的按钮（平台行为，不是工具功劳）；但定位、等待、点击原语是否跟着穿透，各家工程实现差异巨大——MCP/playwright-cli/@chrome/@browser 无感知穿透，agent-browser 的 ref 点击可以但 find 文本定位不行，bb-browser 点不动。

T06 的 ⚠️ 是个有价值的反例：@chrome 把"缺货"徽标拼进了商品名字段。没有结构化提取通道、纯靠可见文本抽取时，展示性元素污染数据字段是常见病——这正是 site adapter 价值的反面教材（见 7.3）。

#### 4.2 Network 响应体（T02）：协议层上限划出的第一道分界线

响应体留底是 CDP Network domain 的能力。无完整 CDP 权限的 `@chrome` 和 `@browser` 只能看到页面错误文案和 console traceId，拿不到状态码与 body；开完整 CDP 后的 `@chrome` 暴露了 raw CDP，T02 直接用 `Network.getResponseBody` 读到 `INSUFFICIENT_INVENTORY / SKU-8821`，这格从 ❌ 翻成 ✅。所以这里的边界不是“Chrome 插件永远读不到 body”这么简单，而是：**产品给不给 Agent 暴露 CDP Network 面**。

`@browser` 仍然是 ❌，因为它是 in-app browser，不继承真实 Chrome 的插件通道；无完整 CDP 的 `@chrome` 也仍是 ❌，只能看到页面笼统错误和 console traceId。开完整 CDP 后 `@chrome` 的 Network 观察能力已经接近 CDP 系工具，但这不自动带来 route/mock 能力，T04 仍失败。

CDP 阵营内部还有一层封装差异：agent-browser / DevTools MCP / playwright-cli 是**被动留底、事后可查**（点击前不需要任何准备）；bb-browser 把响应体封进了 trace 体系——必须 `trace start` 之后**重放动作**才能 `trace body`，多付一次重放成本。这是**产品封装范围**因素的教科书案例：同一个协议层，封装方式决定了排障的成本结构。bb 换来的独有回报是 trace 时间线带因果关联（`request … trigger:25 → click #order-btn`），"哪个动作引发了哪个请求"这条信息其他五家都给不了。

#### 4.3 性能诊断（T03）：DevTools 产品面的价值被量化，基准测试站被反向修正

性能分析需要的不止 timing 数字，而是"能解释问题的诊断模型"——这是 DevTools 产品面独有的，DevTools MCP 因此最省解释成本，且差距能报出具体倍数：用 `performance_start_trace` + `performance_analyze_insight`（LCPBreakdown/RenderBlocking）6 次调用、111 秒直出结构化的原因分析；agent-browser 没有诊断模型，但 子 Agent 从工具文档自己挖出 `profiler` 命令导出原始 trace、用 python 解析、再用 PerformanceObserver 交叉验证，**结论完全一致**——代价是 215 秒和全场最贵的单个单元格成本。一句话：**MCP 把"解释"内置在工具里，CLI 把"解释"外包给模型**。模型强时殊途同归，弱模型下差距会以失败形式放大。

无完整 CDP 时，@chrome/@browser 双 ❌：evaluate 环境里连 `performance` 对象都没有，性能取证入口被安全策略砍掉。开完整 CDP 后的 `@chrome` 可以读 Performance timing 和资源瀑布，T03 已经能定位 blocking.css + heavy.js 的串行瓶颈；但它没有 DevTools MCP 那种 `performance_analyze_insight`，所以仍是“自己挖 timing”，不是 DevTools 原生洞察。

这道题还发生了全评测最有意思的事：**三个独立 Agent 用 trace 证据一致推翻了基准测试站的预设答案**。我出题时写的是"hero.svg（延迟 1.5s）对 LCP 影响最大"，时间线证明：阻塞 CSS（1.2s TTFB）卡住首绘、又按规范卡住其后同步脚本（800ms 长任务），两者**串行** ≈ 2.1s 才是 LCP 真相；hero.svg 与它们**并行**加载、首绘前早已完成，是"看起来最慢但不背锅"的干扰项。"最慢的资源"和"拖慢页面的资源"是两回事。任务卡已修正，"会不会被最慢资源带偏"升格为正式考点——**有标准答案的基准测试站加无偏 Agent，连出题人的错误都测得出来**。

#### 4.4 请求 mock（T04）：三个边界因素在同一道题里同台

这道题把三个边界因素摆进了同一格——

- **agent-browser、playwright-cli ✅**：原生 `network route` / `route`，真正的网络层拦截。
- **DevTools MCP ⚠️**：没有任何拦截工具。CDP 的 Fetch domain 明明支持——这是**产品封装范围**因素：协议有，产品没包。子 Agent 的自救很体面（`navigate_page` 的 initScript 在页面脚本运行前补丁 fetch/XHR），但补丁在 JS 层：mock 跨域接口、abort 流量这类升级需求就绕不过去了。
- **bb-browser ⚠️**：0.14.2 里**没有 `network route` 这类命令**，子 Agent 确认无 mock/intercept 命令后，在页面里直接改写了 `window.fetch`。
- **@chrome/@browser ❌**：无完整 CDP 时，扩展层理论上有 `declarativeNetRequest` 可改写请求，但产品没封装，Runtime 又只读连补丁都打不了；开完整 CDP 后的 `@chrome` 虽然能发 raw CDP，但 `Fetch.enable` / `Network.setRequestInterception` / `Page.addScriptToEvaluateOnNewDocument` 都被 Browser Use 收口，无法可靠做网络层 mock。结论仍是 ❌，只是失败原因从“没有观察面”变成“有观察面但无 route 面”。

#### 4.5 已登录 fetch（T07）与逃生舱：安全策略因素的明码标价

无完整 CDP 的 @chrome 的 `evaluate` 是只读的页面作用域，"Console 式请求"做不了——evaluate 环境里**连 `fetch` 函数都没有**；@browser 同样，子 Agent 试图直接导航到 /api/me 还被策略拦截。开完整 CDP 后的 `@chrome` 已经能走 CDP Runtime，在页面会话里 `fetch('/api/me')` 并自动带 cookie，T07 从 ❌ 翻成 ✅。四个 CDP 系工具也都是一句 `eval "fetch('/api/me')"` 解决。

**原因与代价**：这格变化很能说明 Browser Use 的策略不是一条静态线。无完整 CDP 时，OpenAI 明显把真实登录态和 Runtime 可写性隔开；开完整 CDP 后，Runtime 可写性放开了一部分，页面内 fetch 能做。但 `chrome://`、`chrome-extension://` 和网络 route 仍被拦住，说明产品把“页面 Runtime 调试”和“浏览器/扩展管理”分成了不同风险等级。

这个维度还撑起了整个评测的一个更上层的规律：**eval（可写的页面 Runtime）是所有工具共同的"万能逃生舱"**——凡是页面自己能做的事，eval 都能做。bb-browser 的 click 全坏照样答对 7 题，靠的全是它；开权限后的 @chrome 也因为拿到 Runtime，T12-T20 大幅翻盘。逃生舱也有硬边界：它改不了浏览器特权页策略，拿不到被产品拦住的扩展 options，也不能替代真正的网络层 route。

#### 4.6 bb-browser 的事件注入缺陷：不是边界问题，是质量问题

bb-browser 0.14.2 的 `click`/`press Enter` 报告成功但页面事件监听器不触发（fill 写值正常），六个不知情 子 Agent 在登录、翻页、Shadow 按钮等场景独立复现六次，全部被迫 `eval requestSubmit()/el.click()` 自救；叠加 `get value` 返回空、fill→type 值叠加两个独立 bug。注意原因：它站在 CDP 层，**协议上限和封装范围都没问题，这是纯粹的实现 bug**——也因此是六家里唯一"修一个 bug 就能大幅改命"的工具。它的长期价值方向（site adapter + trace 因果链）反而被这轮实测从侧面证明了：通用操作不可靠时，结构化命令和留证排障是更稳的差异化。

另一个同类教训来自版本维度：agent-browser 0.27.0 的 route mock 完全失效、0.27.2 修复——**patch 版本差异足以翻转能力结论**，这类评测必须把版本号钉进结论里。

#### 4.7 扩展安全域与真实登录态（T09/T10/T11）：边界从"页面"挪到"特权页与 profile"

T09–T11 把战场从网页面挪到两个新地方——`chrome://` / `chrome-extension://` 这类**特权页**（T09 调试扩展、T11 使用扩展），和**复用真实登录态 / 跨会话持久化 / 指定现成 profile**（T10a/T10b/T10c）。它们分别对应边界公式里的"安全策略"和"产品封装范围"，分界线比页面任务画得更清楚。

**T09/T11 扩展：真正的分水岭不是"自带浏览器"，而是"能不能到特权页"。** 只要给 attach 类工具一个**扩展真能跑的浏览器**，分胜负的就是**到达 `chrome://extensions` 和 `chrome-extension://…/options.html` 的能力**，而不是谁自带浏览器。

- **DevTools MCP ✅**：扩展是它的强项区。`--browserUrl` 模式连真实 Chrome 时，要么直接暴露 `list_extensions`/`reload_extension`（Chrome 149 + `--categoryExtensions`），要么退一步在 `chrome://extensions` 页面上下文里调 `chrome.developerPrivate.reload`——两条都能干净走通，options 页也能作为一等 target 操作。
- **playwright-cli ✅**：走自管 persistent context 路线，`launchPersistentContext` 加载本地扩展（注意要用 bundled Chromium 而非 `channel: chrome`，否则又撞企业策略），在自家 chrome://extensions reload、打开 options 页，全链路可控。
- **agent-browser ✅「粘滞」**：复位 daemon 后能进 chrome://extensions、reload、开 options 页（扩展 ID 走 shadow DOM 的 eval 穿透拿到）——能力存在，但被 `--cdp` 可靠性问题拖累（见下与 7.2）。
- **bb-browser ❌/⚠️**：致命短板暴露无遗——`open`/`goto` 给 `chrome://`、`chrome-extension://` 无脑加 `https://` 前缀并把 `://` 折叠（`chrome://extensions/` → `https://chrome//extensions/` → chrome-error），**自身根本到不了任何特权页**。T11 只能靠外部 CDP 强开 options 页 target 才让 bb-browser 能 fill/click（记 ⚠️）；T09 退用页面内 `chrome.runtime.reload()` 反而把 unpacked 扩展弄成失效态（记 ❌）。继 4.6 的 click bug 之后，这是它第二处"协议层够得着、产品封装却把路堵死"。
- **@chrome / @browser ❌**：和 4.5 同源的**安全策略**因素——Browser Use 的 URL policy 直接拦住 `chrome://` 与 `chrome-extension://`。开权限后的 @chrome 变强的是页面 Runtime / Network 观察面，不是扩展管理面；即使用户手动把 Bench Badge 装进默认 Profile，它也只能在本地页和真实线上页验证 `BENCH EXT v1.0.0` 的 content script 注入，仍没有 reload/options 通道。它们本身就是扩展，却被产品的封装边界挡在扩展管理之外。

**这里还埋着一个比工具更硬的环境坑：企业管控 Chrome 会让"装了等于没装"。** 目标机器的系统 Chrome 受企业策略管控，把"加载已解压扩展"在运行时拦死——扩展能出现在列表里、显示已启用，但 content script 不注入、扩展自身资源 `ERR_BLOCKED_BY_CLIENT`。这意味着任何"复用你真实 profile 跑扩展"的方案在这类机器上直接失效，扩展测试只能改用干净的 Chrome for Testing（且 137+ 还要 `--disable-features=DisableLoadExtensionCommandLineSwitch` 才认 `--load-extension`，CDP 的 `Extensions.loadUnpacked` 只进注册表、不激活 content script）。这条对"在公司电脑上用 Agent 操作扩展"的现实预期是一盆冷水。

**T10a 真实登录态：@chrome 的主场，但它不再孤独。** 这一格的实情是：

- **能读真实登录态的**：`@chrome`、`bb-browser --port 9223`、`DevTools MCP --browserUrl 9223`——都免登录直达 GitHub 通知页。早期 T10a 读到同一个 68 条；开权限后的 @chrome 默认 Profile 复测读到 70 条。@chrome 在它**唯一的主场任务**上确实零打断（扩展安全域天然在真实 profile 内），但默认 Profile 登录态不等于 T10c 要求的“指定 9223 profile”。
- **读不到的**：`@browser`（in-app 浏览器不继承真实登录态）；`playwright-cli` 这轮 T10a/R01-R09 约束下没 attach 上 9223。但这不是“不能 attach 9223”的结论：**2026-06-22 用 playwright-cli 0.1.14 对同一台 9223（Chrome 149）实测，真正决定成败的是“9223 当下有没有打开的页面”：有 page 时 attach 连跑都成功（且并存 6 个扩展 `service_worker` target 也不崩），只在 9223 没有任何 page target 时稳定崩在 `Browser.setDownloadBehavior: Browser context management is not supported`。** 也就是说，playwright-cli attach 真实 9223 依赖浏览器状态、可预测性不足，所以前文把它定位成“自启浏览器回归测试首选、不是真实 profile 主力”。
- **能但不可靠的 agent-browser 「粘滞」**：这是这一组里最意外的一格。`--cdp 9223` 看似连上了，实际动作经常**静默落到 agent-browser 自起的托管浏览器**（一个没有你登录态的空白 headless Chrome）；`get url` 还返回 github，像成功，实则没碰你的真身。两轮独立实测都撞到：Codex 据此判 ❌（坚持"开箱即用必须命中 9223"），主控这轮先 `close --all` + 杀掉托管实例复位，才真连上 9223、读到 68（判 ✅）。**同一个 bug，两种评分口径**——根因都是 7.2 那个粘滞 daemon。

**T10b 持久化：可移植状态文件完胜。** agent-browser 与 playwright-cli 在这里打平，第三、第四名的机制差异也讲清楚了：

- **agent-browser ✅ / playwright-cli ✅**：两者都有**可移植状态文件**（`state save/load` / `state-save/load`）。机制上打平，差别只在 ergonomics——agent-browser `--state <file> open <url>` 一步式（加载先于导航，零踩坑）；playwright-cli 必须"先 open 再 state-load 再 goto"（直接带状态文件启动会报 browser is not open）。两者一次命中、免登录读到 68。它们稳的根因是：状态文件存的是 **CDP 拿到的明文 cookie**，不依赖浏览器磁盘上的加密，跨会话、跨目录、跨实例都能用。
- **DevTools MCP ✅\***：走"复用同一持久 userDataDir"的隐式路线，没有可移植 state 文件，"换目录就丢"（复制 profile 即撞登录墙），而且依赖浏览器 on-disk cookie 加密可用——本机 CfT 因无 keychain，连原地复用都丢，要 `--use-mock-keychain` 兜底才持久。
- **bb-browser △**：持久化维度最弱——**自身没有任何 state save/load，也没有 cookie 导入**（只有只读的 `cookies` 查看）。它能读到登录态，完全是 attach 了一个别人维持登录的持久浏览器，自己既不产出也不保存状态。

**T10c 指定 9223：登录态和 profile 绑定是两件事。** 这一格是后来补的，因为前两轮容易把“某个浏览器有登录态”和“用户指定的 9223 profile 有登录态”混掉。判定标准很硬：工具必须先证明自己控制的是 `http://127.0.0.1:9223`，再读 GitHub notifications；只读到 GitHub 不算。

- **agent-browser / bb-browser / DevTools MCP / playwright-cli ✅**：四者都能拿出 9223 绑定证据。agent-browser 的 `get cdp-url` 返回 `ws://127.0.0.1:9223/...`；bb-browser 的 status 显示 `cdpConnected=true` / `cdpPort=9223`；DevTools MCP daemon args 包含 `--browser-url http://127.0.0.1:9223`；playwright-cli 这次 `attach --cdp=http://127.0.0.1:9223` 成功。四者打开的唯一 URL 都能在 `/json/list` 里命中 9223 target。
- **@chrome ❌**：这次 Codex Chrome plugin 已经能连上，也能读到 GitHub 登录态；但它打开的唯一 URL 没出现在 9223 target 列表。也就是说，它证明了“@chrome 控制的某个 Chrome 有登录态”，没证明“控制的是用户指定的 9223 profile”。这也解释了扩展 popup 里的 `Disconnected`：它是 Codex plugin bridge 状态，不是 CDP 9223 状态。
- **@browser N-R**：in-app browser 没有绑定外部 CDP endpoint 的能力，不能用自己的独立浏览器代跑。

一句话收束这三题：**T09/T11 把"能不能到特权页"立成扩展场景的真分水岭（bb-browser 在此失能）；T10a 测默认真实 profile，T10b 测工具自管持久化，T10c 测用户指定 9223 profile。三者不能互相替代。**

#### 4.8 前端专项（T12-T20）：DevTools MCP 和 playwright-cli 拉开第二梯队

T12–T20 是我后来补的一组前端开发者专项题。它们的目标不是再证明"能不能点按钮"，而是把前端日常排障里的证据链补全：console 对象、source map、移动端 hit-test、hydration mismatch、EventSource 等待、Service Worker 控制面、跨源 iframe、真实文件上传、键盘可访问性和 flake 率统计。

这一组把结果重新拉开了：

- **DevTools MCP 9/9 ✅**：最像前端熟悉的 F12。T12 能从 console/network/source map 追到 `webpack://bench/src/cart/coupon.ts`；T16 能把"页面旧值"和"绕过 SW 的 live 值"拆开；T18 能走真实 file input；T19 能把键盘不可达落到 DOM/ARIA/CSS 原因。它的短板也更清楚：复杂 CSS hit-test、Service Worker 绕行、文件 input 异步状态这类问题，仍然常要 `evaluate_script` 做底层诊断。
- **playwright-cli 9/9 ✅**：自动化质量同样满分，file chooser、键盘、iframe、等待都很稳。它的问题不是能力弱，而是气质不同：更像把场景写成可重复测试；如果你正在排一个线上 bug，DevTools MCP 的 console/network/trace 心智模型更顺手。
- **agent-browser 9/9 ✅，但 7 题带 `*`**：连上 9223 之后答案全对，T17/T18 还很干净；但 T12/T14 的 console 展开、T15/T20 的按钮触发、T19 的 focus/keyboard 都需要 eval 补齐。它适合复用常驻 profile 做流程操作，不适合被当成"纯前端调试面板"。
- **bb-browser 9/9 ✅\***：这轮答案也全对，但必须把星号读大——原生命令受端点漂移影响，最后靠同一 bb profile 的 CDP/eval 逃生完成。它证明"这份 profile 里的浏览器能完成"，不能证明"bb-browser 原语能完成"。
- **@browser 5✅3⚠️1 N-R**：普通 DOM、iframe、SSE 完成态、可访问性、表格统计都能做；但 raw asset/source map 被拦、Service Worker live bypass 拿不到、文件上传没有 API。它适合轻量观察，不适合完整前端调试。
- **@chrome（无完整 CDP）4✅2⚠️3❌，开完整 CDP 后 9/9**：早期前端专项轮的 9 N-R 是 Codex Chrome Extension disabled，不是无完整 CDP 的真实上限。2026-06-21 关掉完整 CDP 后复测，T14/T15/T17/T19/T20 这类页面级任务能跑，T12/T16 只能部分定位；T13 缺 viewport，T18 缺 upload API，T07/T02/T03 这类 DevTools 面仍失败。开完整 CDP 后默认 Profile 复测把 T12-T20 全部跑通，其中 T13 仍需要 hit-test 后临时隐藏遮挡层。这个变化很关键：@chrome 的上限取决于当前权限开关，而不是工具名本身。

这组补测坐实了"纯前端排障"这个例外场景：DevTools MCP 从"理论上更像 F12"变成了"实测九个前端专项仍然第一"。各场景分工因此清晰：**纯前端排障 DevTools MCP 第一；自动化回归 playwright-cli 首选；而通用单选仍是覆盖最全、能接真实 profile 的 agent-browser；开权限后的 @chrome 是默认 Profile 里的轻量 CDP 观察器，但仍缺扩展特权页、指定 9223 证明和可靠 route/mock。**

### 5. 跨工具规律：比单格结论更长寿的部分

1. **强模型把工具缺陷变成成本倍数，而不是失败**。有逃生舱的四家答案正确率几乎满分，差距体现在 1~2.5 倍操作数和时间。前提有二：模型强到能想出绕行方案；逃生舱存在。给弱模型选工具时应更看重原语可靠性而非能力上限。
2. **eval 自救次数是一行就能算的工具体检值**：前八道网页题里，playwright-cli 0 < agent-browser 1 < DevTools MCP 3 < bb-browser 7（单元格全覆盖）< 无完整 CDP 的 @chrome/@browser（无逃生舱，直接 ❌）。T12–T20 又补了一层：DevTools MCP 和 playwright-cli 虽然都 9/9，但 DevTools MCP 在 hit-test、SW、文件状态诊断里仍会用 `evaluate_script`；agent-browser 9 题里 7 题要靠 eval 补齐；bb-browser 全靠 CDP 逃生；开完整 CDP 后的 @chrome 则证明“给了 Runtime/CDP，结果会立刻翻盘”。这个序基本就是"原语质量 × 能力覆盖"的序——逃生舱被迫用得越勤，正规命令质量越差。
3. **静默失败是 Agent 最大的敌人**。本轮最贵的时间黑洞全部来自"报成功但无事发生"（bb 的 click、agent-browser 的视口外点击）：Agent 看到"已点击"不会怀疑工具，会先怀疑自己，然后烧轮次验证一切。对工具作者：动作后验证状态、失败就明说，比十个新功能都值钱。
4. **粗粒度组合动作 vs 细粒度原语**。DevTools MCP 用一半操作数完赛（fill_form 一次填整张表、wait_for 等待确认合一），但预想流程之外就得绕路；CLI 细原语常规路径多走几步，却能拼出作者没想到的流程。微软给 playwright-cli 的官方定位（"CLI 给高吞吐编码 Agent，MCP 给持久状态场景"）与实测互相印证。
5. **无偏成本约为熟练者的 2~4 倍**。评测报告里的数字应该以无偏 Agent 为准——那才是真实用户要付的价格。
6. **会不会"后台静默运行、不打扰你"，取决于驱动哪个浏览器，而不是工具本身**。让工具用**自管/无头实例**（playwright-cli headless、DevTools MCP 默认、agent-browser 默认托管浏览器、@browser）时，它天然在后台，零打扰；一旦用 `--cdp` / `--port` / `--browserUrl`（或 @chrome）**接管你正在用的真实 Chrome**，干扰就来自**焦点而非物理设备**：CDP 的合成事件不占用你的物理键鼠（光标不会乱跑、在别的应用打字本身不受影响），但只要你和 Agent **同时活动在同一个 profile**，就会出现三种撞车——`bringToFront`/导航当前页把 **tab 切走**、`focus()`/点击输入框把 **DOM 焦点移走（你打字进错框）**、点到"发送/保存/删除/标记已读"把**账号状态静默改掉**；此外 Agent 开新窗口或抬高 Chrome 还可能夺走 **OS 窗口焦点**，让你接下来的键击落进 Chrome。隔离办法只有一个：**分 profile / 独立窗口 / 无头**，把你和 Agent 的"焦点战场"分开（接专用调试 profile 而非你的日常主 Chrome）。

## 三、底层原理：想深挖的人再看

### 6. 能力分层与边界公式：能力从哪一层来，边界由什么决定

#### 6.1 浏览器有哪几个部位，工具又接到哪个入口

先从你能在 Chrome 里指着说出来的部位看起——浏览器大致由下面这几块组成，光是"每块谁够得着、卡在哪"，就已经能解释总表里的大半结果：

<figure class="bench-layers ba-parts" role="group" aria-label="浏览器部位与谁够得着分层图">
<style>.bench-layers{margin:1.7rem 0;font-family:var(--font-serif-body,system-ui)}
.bench-layers *{box-sizing:border-box}
.bl-head{margin-bottom:.7rem}
.bl-title{font-weight:700;font-size:1.02rem;color:var(--ink,#1a1815)}
.bl-hint{display:block;font-size:.8rem;color:var(--muted,#6a6155);margin-top:.2rem}
.bl-hint .bl-ck{display:inline-block;margin-right:.5rem;padding:.02rem .3rem;border-radius:.25rem;font-weight:700;font-size:.74rem}
.bl-ck.full{background:#e7eedd;color:#4f7233}.bl-ck.cond{background:#f4e8cc;color:#9a6516}.bl-ck.none{background:#ece7da;color:#a59b88}
.bl-band{border:1px solid var(--hair,rgba(26,24,21,.18));border-left:4px solid var(--ink,#1a1815);border-left-color:color-mix(in srgb, var(--ink,#1a1815) calc(35% + var(--d)*9%), #c9b78a);border-radius:.5rem;padding:.55rem .7rem;margin:.4rem 0;background:var(--paper-soft,#faf6ec)}
.bl-top{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .8rem;justify-content:space-between}
.bl-pinfo{flex:1 1 16rem;min-width:13rem}
.bl-pinfo b{font-size:.92rem;color:var(--ink,#1a1815)}
.bl-pinfo small{display:block;font-size:.72rem;color:var(--muted,#6a6155);margin-top:.1rem;line-height:1.35}
.bl-pills{display:flex;flex-wrap:wrap;gap:.28rem}
.bl-p{font-size:.7rem;font-weight:700;padding:.08rem .36rem;border-radius:.3rem;white-space:nowrap;line-height:1.4}
.bl-p sup{font-size:.7em;margin-left:1px}
.bl-full{background:#e7eedd;color:#4f7233}
.bl-cond{background:#f4e8cc;color:#9a6516}
.bl-none{background:#ece7da;color:#b3aa97;text-decoration:line-through;text-decoration-thickness:1px}
.bl-note{font-size:.73rem;color:var(--muted,#6a6155);margin-top:.4rem;line-height:1.45;border-top:1px dashed var(--hair,rgba(26,24,21,.15));padding-top:.35rem}
.bl-cnt{display:inline-block;font-weight:700;color:var(--ink-soft,#3c362c);margin-right:.5rem;font-size:.72rem}</style>
<div class="bl-head"><span class="bl-title">浏览器有哪几个部位 · 谁够得着</span><span class="bl-hint">自上而下大致从「共享」到「受限」；每块右侧六个工具：<span class="bl-ck full">✓ 完整</span><span class="bl-ck cond">~ 有条件</span><span class="bl-ck none">✕ 够不着</span>（悬停看工具全名）。</span></div>
<div class="bl-band" style="--d:0"><div class="bl-top"><div class="bl-pinfo"><b>网页内容</b><small>DOM · 页面 runtime · 输入 · shadow DOM · a11y 快照 · 页内 fetch</small></div><div class="bl-pills"><span class="bl-p bl-cond" title="@chrome：有条件">chr<sup>~</sup></span><span class="bl-p bl-cond" title="@browser：有条件">brw<sup>~</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-full" title="bb-browser：完整">bb<sup>✓</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 4 · 受限 2 · 无 0</span>六家公共底座，全员能读能点；无完整 CDP 的 @chrome/@browser runtime 只读，连 fetch 都没有</div></div><div class="bl-band" style="--d:1"><div class="bl-top"><div class="bl-pinfo"><b>前台 tab / 窗口 / popup</b><small>多 tab · 新窗口 · window.open 弹出窗（如 OAuth 登录窗）</small></div><div class="bl-pills"><span class="bl-p bl-full" title="@chrome：完整">chr<sup>✓</sup></span><span class="bl-p bl-cond" title="@browser：有条件">brw<sup>~</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-full" title="bb-browser：完整">bb<sup>✓</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 5 · 受限 1 · 无 0</span>基线能力、没区分度；@browser 是 in-app webview，独立窗口/popup 不如其余顺手</div></div><div class="bl-band" style="--d:2"><div class="bl-top"><div class="bl-pinfo"><b>后台 target</b><small>扩展 service worker / background page——不在任何 tab 里的后台 JS</small></div><div class="bl-pills"><span class="bl-p bl-none" title="@chrome：够不着">chr<sup>✕</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-none" title="bb-browser：够不着">bb<sup>✕</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-cond" title="playwright-cli：有条件">pw<sup>~</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 2 · 受限 1 · 无 3</span>只有自管浏览器够得到（走 CDP Target 域）；pw attach 这类 Chrome 需其有打开的页面才成（见 4.7）</div></div><div class="bl-band" style="--d:3"><div class="bl-top"><div class="bl-pinfo"><b>扩展 + 特权页</b><small>扩展本体 · chrome://extensions · chrome-extension://…/options.html</small></div><div class="bl-pills"><span class="bl-p bl-none" title="@chrome：够不着">chr<sup>✕</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-cond" title="agent-browser：有条件">ab<sup>~</sup></span><span class="bl-p bl-none" title="bb-browser：够不着">bb<sup>✕</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 2 · 受限 1 · 无 3</span>真分水岭是能否到特权页；bb 把特权页 URL 归一化堵死，@chrome 被 URL 策略拦，agent-browser 需先复位 daemon（见「粘滞」）</div></div><div class="bl-band" style="--d:4"><div class="bl-top"><div class="bl-pinfo"><b>身份 / 档案</b><small>登录态 cookie · 书签 · 历史 · 保存的密码 / 证书</small></div><div class="bl-pills"><span class="bl-p bl-full" title="@chrome：完整">chr<sup>✓</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-cond" title="agent-browser：有条件">ab<sup>~</sup></span><span class="bl-p bl-full" title="bb-browser：完整">bb<sup>✓</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-cond" title="playwright-cli：有条件">pw<sup>~</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 3 · 受限 2 · 无 1</span>@browser 接不进系统默认 Chrome；默认 profile 远程调试 Chrome 136+ 收紧；pw attach 真实 profile 需其有打开页面才成（见 4.7）</div></div><div class="bl-band" style="--d:5"><div class="bl-top"><div class="bl-pinfo"><b>跨会话持久化</b><small>把身份存下来、搬到别处、恢复（可移植 state vs 绑定 userDataDir）</small></div><div class="bl-pills"><span class="bl-p bl-cond" title="@chrome：有条件">chr<sup>~</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-none" title="bb-browser：够不着">bb<sup>✕</sup></span><span class="bl-p bl-cond" title="DevTools MCP：有条件">MCP<sup>~</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 2 · 受限 2 · 无 2</span>可移植 state 文件（agent-browser / playwright-cli）完胜；DevTools MCP 绑 userDataDir 换目录就丢，bb 无 save/load</div></div><div class="bl-band" style="--d:6"><div class="bl-top"><div class="bl-pinfo"><b>调试与诊断</b><small>读：Network 响应体 · console · performance/trace　写：拦截 / mock / abort</small></div><div class="bl-pills"><span class="bl-p bl-cond" title="@chrome：有条件">chr<sup>~</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-cond" title="bb-browser：有条件">bb<sup>~</sup></span><span class="bl-p bl-cond" title="DevTools MCP：有条件">MCP<sup>~</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 2 · 受限 3 · 无 1</span>读靠 CDP（开权限 @chrome 也能读 body/timing）；写（网络层 route）只有 agent-browser、playwright-cli；MCP/bb 只能 JS 层打补丁</div></div>
</figure>

> ¹ 这里的 popup 专指 `window.open` 的独立网页窗口，**不含 alert/confirm 这类原生对话框**——后者是页面触发、却在 DOM 之外、只能由 CDP 的 Page/Browser/Fetch 等 domain 单独处理的模态框，另算一种薄控制面。

为什么同一个部位，有的工具能完整拿到、有的只能拿到残缺版、有的彻底碰不到？因为工具的本质区别在于**它从哪个入口接进浏览器**——入口决定了它站在哪一层、拿到的是原始能力还是被封装 / 阉割过的子集：

<figure class="bench-planes bb-planes" role="group" aria-label="五个能力面分层图">
<style>.bench-planes{margin:1.7rem 0;font-family:var(--font-serif-body,system-ui)}
.bench-planes *{box-sizing:border-box}
.bp-head{margin-bottom:.6rem}
.bp-title{font-weight:700;font-size:1.02rem;color:var(--ink,#1a1815)}
.bp-hint{display:block;font-size:.8rem;color:var(--muted,#6a6155);margin-top:.2rem}
.bp-stack{display:flex;flex-direction:column;gap:.3rem;position:relative}
.bp-axis{font-size:.7rem;color:var(--muted,#6a6155);text-align:right;margin-bottom:.1rem}
.pl-layer{display:flex;align-items:stretch;border:1px solid var(--bd);border-left:5px solid var(--fg);border-radius:.5rem;background:var(--bg);overflow:hidden}
.pl-name{flex:0 0 9rem;display:flex;flex-direction:column;justify-content:center;padding:.5rem .7rem;font-weight:700;color:var(--fg);font-size:.9rem;border-right:1px solid var(--bd)}
.pl-name small{font-weight:400;font-size:.66rem;color:var(--muted,#6a6155);margin-top:.15rem;line-height:1.3}
.pl-body{flex:1;padding:.5rem .7rem;min-width:0}
.pl-entry{font-size:.74rem;color:var(--ink-soft,#3c362c);font-family:var(--font-mono,ui-monospace,monospace);margin-bottom:.3rem}
.pl-sw{display:flex;flex-wrap:wrap;gap:.3rem .8rem}
.pl-good,.pl-bad{font-size:.74rem;line-height:1.35}
.pl-good{color:#4f7233}.pl-bad{color:#8f2d20}
.bp-side{margin-top:.5rem;border:1px dashed var(--bd2,#cf9b90);border-radius:.5rem;background:var(--bg2,#f1ddd6);padding:.5rem .7rem;display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap}
.bp-side .s-name{font-weight:700;font-size:.88rem}
.bp-side .s-tag{font-size:.68rem;color:var(--muted,#6a6155);font-weight:700}
.bp-side .s-txt{font-size:.74rem;color:var(--ink-soft,#3c362c)}
@media(max-width:560px){.pl-layer{flex-direction:column}.pl-name{flex-basis:auto;border-right:0;border-bottom:1px solid var(--bd)}}</style>
<div class="bp-head"><span class="bp-title">工具从哪个入口接进浏览器 · 五个能力面</span><span class="bp-hint">入口决定它站在哪一层、拿到的是原始能力还是被封装的子集。</span></div>
<div class="bp-stack"><div class="bp-axis">▲ 越往上越偏「解释 / 诊断」</div><div class="pl-layer" style="--fg:#4f7233;--bg:#e7eedd;--bd:#9ab87f"><div class="pl-name">DevTools 产品面<small>建在 CDP 原始数据之上</small></div><div class="pl-body"><div class="pl-entry">入口 · DevTools / Lighthouse 诊断模型</div><div class="pl-sw"><span class="pl-good">擅长 性能定位 · LCP 分解 · 瀑布图洞察</span><span class="pl-bad">短板 围绕「被调试页面」，需自管浏览器</span></div></div></div><div class="pl-layer" style="--fg:#3f6d79;--bg:#dcebed;--bd:#8fbcc4"><div class="pl-name">CDP 调试面</div><div class="pl-body"><div class="pl-entry">入口 · Chrome DevTools Protocol</div><div class="pl-sw"><span class="pl-good">擅长 Network 留底 · 请求拦截 · Runtime · Tracing</span><span class="pl-bad">短板 权限极强，安全边界敏感（Chrome 136+ 收紧）</span></div></div></div><div class="pl-layer" style="--fg:#9a6516;--bg:#f4e8cc;--bd:#d9b66a"><div class="pl-name">Chrome 扩展面</div><div class="pl-body"><div class="pl-entry">入口 · chrome.* extension API</div><div class="pl-sw"><span class="pl-good">擅长 真实 profile · 登录态 · 书签历史</span><span class="pl-bad">短板 受扩展权限模型约束，无 Network 响应体、无 trace</span></div></div></div><div class="pl-layer" style="--fg:#7a7264;--bg:#efe9da;--bd:#c4b9a3"><div class="pl-name">网页面<small>公共底座</small></div><div class="pl-body"><div class="pl-entry">入口 · DOM / 页面 JS Runtime</div><div class="pl-sw"><span class="pl-good">擅长 点击 · 输入 · 读页面 · 页内 fetch</span><span class="pl-bad">短板 只能看到页面自己暴露的东西</span></div></div></div><div class="bp-axis">▼ 越往下越底层 / 原始</div></div>
<div class="bp-side" style="--bd2:#cf9b90;--bg2:#f1ddd6"><span class="s-name" style="color:#8f2d20">站点适配面</span><span class="s-tag">旁路 · 与具体网站绑定</span><span class="s-txt">入口 site adapter（按域名匹配、注入页面）；<b style="color:#4f7233">擅长</b> 把具体网站封成结构化命令；<b style="color:#8f2d20">短板</b> 与网站结构强绑定，要维护</span></div>
</figure>

上面两张图是同一件事的两种切法：第一张按**浏览器部位**切（你能指着说出来的东西，回答"工具碰得到哪几块"），第二张按**工具入口**切（回答"碰到的是完整版还是残缺版、为什么"）。层数对不上是正常的——同一个部位会被不同入口以不同成色覆盖：比如"调试与诊断"这一块，从入口看就分成了 CDP 原始数据面和 DevTools 解释面两层；而"扩展 + 特权页"既可能从扩展面接、也可能从 CDP 面强开。

这里最容易混的是 **CDP 调试面**和 **DevTools 产品面**：CDP 给的是底层的原始数据和操作能力（原始 trace、原始网络事件，还能下点击、导航这类命令）；**DevTools 产品面则是在 CDP 原始数据之上、由 Chrome DevTools 和 Lighthouse 做的分析 / 解释层**——把原始 trace 算成"LCP 2.1 秒、主因是阻塞 CSS"这种能直接读的诊断结论。打个比方：CDP 给你体检的原始数值，DevTools 产品面给你医生的诊断报告。

六个工具的站位：

<figure class="bench-pos bc-pos" role="group" aria-label="六个工具的站位图">
<style>.bench-pos{margin:1.6rem 0;font-family:var(--font-serif-body,system-ui)}
.bench-pos *{box-sizing:border-box}
.bo-title{font-weight:700;font-size:1.02rem;color:var(--ink,#1a1815);margin-bottom:.5rem}
.po-row{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;padding:.45rem .2rem;border-bottom:1px solid var(--hair,rgba(26,24,21,.12))}
.po-row:last-child{border-bottom:0}
.po-tool{flex:0 0 12rem;font-weight:700;color:var(--ink,#1a1815);font-size:.86rem;line-height:1.2}
.po-tool small{display:block;font-weight:400;font-size:.68rem;color:var(--muted,#6a6155);margin-top:.1rem;font-family:var(--font-mono,ui-monospace,monospace)}
.po-planes{display:flex;flex-wrap:wrap;gap:.35rem;flex:1}
.po-pl{font-size:.74rem;font-weight:700;padding:.12rem .5rem;border-radius:.35rem;border:1px solid;white-space:nowrap}
@media(max-width:520px){.po-tool{flex-basis:100%}}</style>
<div class="bo-title">六个工具落在这些能力面上（颜色对应上图）</div>
<div class="po-row"><span class="po-tool">@chrome / @browser<small>宿主内插件</small></span><span class="po-planes"><span class="po-pl" style="color:#9a6516;background:#f4e8cc;border-color:#d9b66a">扩展面 · 仅页面可见子集</span></span></div><div class="po-row"><span class="po-tool">agent-browser<small>瘦 CLI + 常驻原生 daemon</small></span><span class="po-planes"><span class="po-pl" style="color:#3f6d79;background:#dcebed;border-color:#8fbcc4">CDP 调试面</span></span></div><div class="po-row"><span class="po-tool">bb-browser<small>CLI（后台常驻进程）</small></span><span class="po-planes"><span class="po-pl" style="color:#3f6d79;background:#dcebed;border-color:#8fbcc4">CDP 调试面</span><span class="po-pl" style="color:#8f2d20;background:#f1ddd6;border-color:#cf9b90">站点适配面</span></span></div><div class="po-row"><span class="po-tool">Chrome DevTools MCP<small>MCP server</small></span><span class="po-planes"><span class="po-pl" style="color:#3f6d79;background:#dcebed;border-color:#8fbcc4">CDP 调试面</span><span class="po-pl" style="color:#4f7233;background:#e7eedd;border-color:#9ab87f">DevTools 产品面</span></span></div><div class="po-row"><span class="po-tool">playwright-cli<small>CLI</small></span><span class="po-planes"><span class="po-pl" style="color:#54579a;background:#e6e7f3;border-color:#a9adcf">Playwright 引擎 · CDP/BiDi 之上</span></span></div>
</figure>

注意 playwright-cli 这一栏：它的底座其实仍是 CDP/BiDi，只是 Playwright 在其上自封了一层跨浏览器的自动化引擎（Locator、自动等待等浏览器原生没有的能力），你直接面对的是这层引擎而不是裸 CDP，所以单列而没归进「CDP 调试面」。

#### 6.2 边界公式的三个因素

站位只决定**上限**，实际能力还要再砍两刀：

1. **协议层上限**：所在层的协议根本没有这个能力。例：扩展 API 里没有任何接口能读到其他请求的响应体（`webRequest` 只能看元数据）——这是最硬的边界，产品再努力也封不出来。
2. **产品封装范围**：协议有，但工具没包成命令。例：CDP 的 Fetch domain 支持请求拦截，但 chrome-devtools-mcp 没有暴露 mock 工具——边界是产品选择，不是协议限制。
3. **安全策略**：协议有、产品也能做，但有意收口。例：无完整 CDP 时的 @chrome 活在用户真实 Chrome 里，却把 evaluate 压到近似只读、环境里连 `fetch` 都不给；开完整 CDP 后页面 Runtime 和 Network 观察面放开了，但 `chrome://`、`chrome-extension://`、网络 route/mock 和指定 9223 绑定仍被挡住。这说明"复用真实登录态"旁边的防火墙不是一条静态线，而是一组按风险分层的能力开关。Chrome 136+ 对默认 profile 的 remote debugging 收紧、144+ 的逐会话确认，属于浏览器厂商在同一因素上的动作。

#### 6.3 Agent 友好度：决定"考什么"

层和边界决定能不能做；Agent 友好度决定做起来顺不顺。前面定义的维度——看懂页面、稳定引用（@eN ref）、动作后复盘、复用真实状态、看请求和错误、性能诊断、结构化输出、风险控制——直接翻译成了基准测试站的八道题。

### 7. 各工具实现原理：边界到底来自哪里

前五节用"站在哪一层 + 三个因素"解释了每个 ✅/⚠️/❌。这一节再往下钻一层，把六个工具的内部实现讲清楚：它们各自怎么连上浏览器、用什么把能力包装出来、为什么会出现前面看到的那些边界。读完这一节，前面总表里每一格的结果，都能对应到具体的代码机制。

<figure class="toolwire" data-reveal role="group" aria-label="五种工具实现链路交互对比图：点选工具，查看它的指令如何一路流到 Chrome、卡在哪一层、为什么">
<style>
.toolwire{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--paper-vsoft:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);--grn:#4f7233;--grn-b:#e7eedd;--grn-e:#9ab87f;--cyan:#3f6d79;--cyan-b:#dcebed;--cyan-e:#8fbcc4;--amb:#9a6516;--amb-l:#d6a64a;--amb-b:#f4e8cc;--amb-e:#d9b66a;--red:#8f2d20;--red-b:#f1ddd6;--red-e:#cf9b90;--pur:#54579a;--pur-b:#e6e7f3;--pur-e:#a9adcf;--gray:#917f5c;--gray-b:#ece4d2;margin:0;padding:clamp(16px,3.4vw,28px);font-family:var(--serif);color:var(--ink);line-height:1.5;background:radial-gradient(130% 90% at 8% 0%,var(--paper-soft),transparent 60%),linear-gradient(160deg,var(--paper-vsoft),var(--paper-deep));border:1px solid var(--hair);border-radius:14px;position:relative;overflow:hidden}
.toolwire *{box-sizing:border-box;min-width:0}
.toolwire .tw-radio{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.toolwire .tw-head{position:relative;z-index:2;margin-bottom:clamp(12px,2.6vw,18px)}
.toolwire .tw-kicker{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--cyan);display:inline-flex;align-items:center;gap:8px}
.toolwire .tw-kicker::before{content:"";width:22px;height:1px;background:var(--cyan)}
.toolwire .tw-title{font-size:clamp(16px,3.2vw,21px);font-weight:700;color:var(--ink);margin:7px 0 3px}
.toolwire .tw-sub{font-size:12.5px;color:var(--muted);max-width:62ch}
.toolwire .tw-sub b{color:var(--ink-soft);font-weight:600}
.toolwire .tw-tabs{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}
.toolwire .tw-tab{font-family:var(--mono);font-size:12px;letter-spacing:.01em;padding:6px 11px;border:1.5px solid var(--hair);border-radius:9px;background:var(--paper-soft);color:var(--muted);cursor:pointer;user-select:none;transition:transform .15s ease,border-color .2s ease,color .2s ease,background .2s ease;white-space:nowrap}
.toolwire .tw-tab:hover{color:var(--ink-soft);border-color:var(--tw-c)}
.toolwire .tw-tab .tw-dot{display:inline-block;width:8px;height:8px;border-radius:3px;background:var(--tw-c);margin-right:6px;vertical-align:1px}
.toolwire #tw-r1:checked ~ .tw-tabs .lab1,.toolwire #tw-r2:checked ~ .tw-tabs .lab2,.toolwire #tw-r3:checked ~ .tw-tabs .lab3,.toolwire #tw-r4:checked ~ .tw-tabs .lab4,.toolwire #tw-r5:checked ~ .tw-tabs .lab5{color:var(--tw-c);border-color:var(--tw-c);background:color-mix(in srgb,var(--tw-c) 12%,var(--paper-soft));font-weight:700;box-shadow:0 2px 8px color-mix(in srgb,var(--tw-c) 22%,transparent);transform:translateY(-1px)}
.toolwire #tw-r1:focus-visible ~ .tw-tabs .lab1,.toolwire #tw-r2:focus-visible ~ .tw-tabs .lab2,.toolwire #tw-r3:focus-visible ~ .tw-tabs .lab3,.toolwire #tw-r4:focus-visible ~ .tw-tabs .lab4,.toolwire #tw-r5:focus-visible ~ .tw-tabs .lab5{outline:2px solid var(--tw-c);outline-offset:2px}
.toolwire .tw-panels{position:relative;z-index:2}
.toolwire .tw-panel{display:none;animation:tw-fade .45s ease both}
@keyframes tw-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.toolwire #tw-r1:checked ~ .tw-panels .pan1,.toolwire #tw-r2:checked ~ .tw-panels .pan2,.toolwire #tw-r3:checked ~ .tw-panels .pan3,.toolwire #tw-r4:checked ~ .tw-panels .pan4,.toolwire #tw-r5:checked ~ .tw-panels .pan5{display:block}
.toolwire .tw-pane-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.toolwire .tw-pane-name{font-size:15px;font-weight:700;color:var(--tw-c)}
.toolwire .tw-pane-arch{font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;color:var(--muted);border:1px solid var(--hair);border-radius:20px;padding:2px 9px}
.toolwire .tw-steps{position:relative;display:flex;flex-direction:column;gap:0}
.toolwire .tw-step{position:relative;border:1.5px solid var(--hair);border-left:4px solid var(--tw-c);border-radius:9px;background:var(--paper-soft);padding:9px 12px;display:flex;flex-direction:column;gap:1px}
.toolwire .tw-step b{font-size:13.5px;font-weight:700;color:var(--ink)}
.toolwire .tw-step small{font-size:11.5px;color:var(--ink-soft)}
.toolwire .tw-mono{font-family:var(--mono);font-size:.92em;color:var(--muted);background:color-mix(in srgb,var(--ink) 5%,transparent);padding:0 4px;border-radius:4px}
.toolwire .tw-link{align-self:center;width:3px;height:22px;border-radius:2px;background:linear-gradient(180deg,var(--tw-c) 0 42%,transparent 42% 58%,var(--tw-c) 58% 100%);background-size:100% 11px;animation:tw-stream 2.4s linear infinite;opacity:.8}
@keyframes tw-stream{from{background-position:0 0}to{background-position:0 11px}}
.toolwire .tw-step.is-star{border-color:var(--grn-e);background:linear-gradient(180deg,var(--grn-b),var(--paper-soft))}
.toolwire .tw-step.is-star b{color:var(--grn)}
.toolwire .tw-step.is-warn{border-color:var(--amb-e);background:linear-gradient(180deg,var(--amb-b),var(--paper-soft))}
.toolwire .tw-step.is-warn b{color:var(--amb)}
.toolwire .tw-step.is-bad{border-color:var(--red-e);background:linear-gradient(180deg,var(--red-b),var(--paper-soft))}
.toolwire .tw-step.is-bad b{color:var(--red)}
.toolwire .tw-step.is-warn,.toolwire .tw-step.is-bad{animation:tw-pulse 3.2s ease-in-out infinite}
@keyframes tw-pulse{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 0 4px color-mix(in srgb,var(--fl,#9a6516) 16%,transparent)}}
.toolwire .tw-flag{position:absolute;top:-9px;right:11px;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;color:var(--paper-soft);padding:2px 8px;border-radius:20px;font-weight:700}
.toolwire .tw-flag.good{background:var(--grn);--fl:#4f7233}
.toolwire .tw-flag.warn{background:var(--amb);--fl:#9a6516}
.toolwire .tw-flag.bad{background:var(--red);--fl:#8f2d20}
.toolwire .tw-step.is-warn{--fl:#9a6516}.toolwire .tw-step.is-bad{--fl:#8f2d20}.toolwire .tw-step.is-star{--fl:#4f7233}
.toolwire .tw-why{margin-top:13px;border-top:1px dashed var(--hair);padding-top:11px;font-size:12.5px;color:var(--ink-soft);line-height:1.62}
.toolwire .tw-why b{color:var(--tw-c);font-weight:700}
.toolwire .tw-foot{position:relative;z-index:2;margin-top:14px;font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:.02em;display:flex;flex-wrap:wrap;gap:6px 14px;border-top:1px solid var(--hair);padding-top:10px}
.toolwire .tw-leg{display:inline-flex;align-items:center;gap:6px}
.toolwire .tw-chip{width:10px;height:10px;border-radius:3px;display:inline-block;border:1px solid var(--hair)}
.toolwire .lc-good{background:var(--grn-b);border-color:var(--grn-e)}.toolwire .lc-warn{background:var(--amb-b);border-color:var(--amb-e)}.toolwire .lc-bad{background:var(--red-b);border-color:var(--red-e)}
@media (max-width:560px){.toolwire .tw-tab{font-size:11px;padding:5px 9px}.toolwire .tw-sub{font-size:12px}}
@media (prefers-reduced-motion:reduce){.toolwire .tw-link{animation:none;background:var(--tw-c);opacity:.5}.toolwire .tw-step.is-warn,.toolwire .tw-step.is-bad{animation:none}.toolwire .tw-panel{animation:none}}
</style>
<input type="radio" name="toolwire-tab" id="tw-r1" class="tw-radio" checked>
<input type="radio" name="toolwire-tab" id="tw-r2" class="tw-radio">
<input type="radio" name="toolwire-tab" id="tw-r3" class="tw-radio">
<input type="radio" name="toolwire-tab" id="tw-r4" class="tw-radio">
<input type="radio" name="toolwire-tab" id="tw-r5" class="tw-radio">
<div class="tw-head"><span class="tw-kicker">§7 实现链路</span><div class="tw-title">点一个工具，看它的指令怎么流到 Chrome、卡在哪一层</div><div class="tw-sub">每个工具的本质区别，就是<b>从哪个入口接进浏览器</b>——入口决定它站在哪一层、拿到的是原始能力还是被封装/收口的子集。下面把六个工具的内部链路画成同一种"自上而下的流水线"，<b>红/黄那格就是它的边界</b>，绿格是它的差异化亮点。</div></div>
<div class="tw-tabs"><label class="tw-tab lab1" for="tw-r1" style="--tw-c:#9a6516"><span class="tw-dot"></span>@chrome / @browser</label><label class="tw-tab lab2" for="tw-r2" style="--tw-c:#3f6d79"><span class="tw-dot"></span>agent-browser</label><label class="tw-tab lab3" for="tw-r3" style="--tw-c:#917f5c"><span class="tw-dot"></span>bb-browser</label><label class="tw-tab lab4" for="tw-r4" style="--tw-c:#4f7233"><span class="tw-dot"></span>DevTools MCP</label><label class="tw-tab lab5" for="tw-r5" style="--tw-c:#54579a"><span class="tw-dot"></span>playwright-cli</label></div>
<div class="tw-panels">
<section class="tw-panel pan1" style="--tw-c:#9a6516" aria-label="@chrome / @browser 实现链路"><div class="tw-pane-h"><span class="tw-pane-name">Codex @chrome / @browser</span><span class="tw-pane-arch">宿主内插件 · 受控后端</span></div><div class="tw-steps"><div class="tw-step"><b>你的指令</b><small>Agent 跑在一个<b>受限沙箱</b>里，自己不握有浏览器控制权</small></div><div class="tw-link"></div><div class="tw-step"><b>本地通道</b><small>unix socket <span class="tw-mono">/tmp/codex-browser-use</span>（macOS 沙箱专门放行了这条命名通道）</small></div><div class="tw-link"></div><div class="tw-step is-bad"><span class="tw-flag bad">安全收口</span><b>浏览器控制进程</b><small>受控后端代为管标签页 · 截图 · 读页面 · 执行动作；高风险面默认关紧</small></div><div class="tw-link"></div><div class="tw-step"><b>Codex 内置浏览器</b><small>不是你系统里的 Chrome，而是 Codex 自带的那一层</small></div></div><div class="tw-why"><b>为什么是这样：</b>Browser Use 把能力关进"能力开关＋远端配置＋沙箱白名单"，所以同一版本在不同账号下能力都不同。授权放大后页面 Runtime / Network 读能力能打开（T02/T03/T07/T12–T20 立刻翻盘），但特权 URL、扩展 options、route/mock、指定 9223 仍不放开——边界来自<b>安全策略</b>，不是协议或产品做不到。</div></section>
<section class="tw-panel pan2" style="--tw-c:#3f6d79" aria-label="agent-browser 实现链路"><div class="tw-pane-h"><span class="tw-pane-name">agent-browser</span><span class="tw-pane-arch">Rust 瘦 CLI + 常驻原生 daemon</span></div><div class="tw-steps"><div class="tw-step"><b>你的指令</b><small>每条命令都发给背后的常驻 daemon</small></div><div class="tw-link"></div><div class="tw-step"><b>瘦 CLI（无状态客户端）</b><small>本体几乎不做事，只负责转发</small></div><div class="tw-link"></div><div class="tw-step"><b>unix socket</b><small><span class="tw-mono">~/.agent-browser/default.sock</span></small></div><div class="tw-link"></div><div class="tw-step is-warn"><span class="tw-flag warn">卡点</span><b>常驻 Rust daemon</b><small>原生二进制 · PPID=1 · 持有<b>粘滞会话</b>＋当前 CDP 连接</small></div><div class="tw-link"></div><div class="tw-step"><b>Chrome · CDP 端口</b><small>真实浏览器（理想情况下是你指定的 9223）</small></div></div><div class="tw-why"><b>为什么是这样：</b>daemon 的会话是"粘滞"的——一旦它先把会话绑到自起的托管浏览器（空白 headless Chrome），后续即使带 <span class="tw-mono">--cdp 9223</span> 也不会可靠切过去，命令<b>静默落到旧浏览器</b>（<span class="tw-mono">get url</span> 还返回你要的页面，像成功）。要稳：先 <span class="tw-mono">tab</span> 核对目标，不对就 <span class="tw-mono">close --all</span> 再重连（见 7.2）。</div></section>
<section class="tw-panel pan3" style="--tw-c:#917f5c" aria-label="bb-browser 实现链路"><div class="tw-pane-h"><span class="tw-pane-name">bb-browser</span><span class="tw-pane-arch">三入口 + 后台常驻进程 + 站点适配器</span></div><div class="tw-steps"><div class="tw-step"><b>你的指令</b><small>CLI · MCP server · provider 三个入口，谁都不直接连 Chrome</small></div><div class="tw-link"></div><div class="tw-step"><b>本地 HTTP</b><small><span class="tw-mono">127.0.0.1:19824</span></small></div><div class="tw-link"></div><div class="tw-step is-star"><span class="tw-flag good">因果链</span><b>常驻 node daemon</b><small>唯一一条 CDP 长连接＋每 tab 事件缓存（网 500 / 控 200 / 错 100，带递增编号）</small></div><div class="tw-link"></div><div class="tw-step is-bad"><span class="tw-flag bad">卡点</span><b>Chrome · CDP 端口</b><small>注入快照、同源 eval；但 click 事件派发链路有 bug、特权页 URL 被归一化堵死</small></div></div><div class="tw-why"><b>为什么是这样：</b>它的信条是"你的浏览器就是 API"——直接进真实 tab 上下文跑代码，请求天然带当前账号 Cookie，可复用页面前端逻辑（这也是它点击坏了还能靠 eval 答对 7 题的底气）。代价：click 派发链路的 bug（4.5）＋够不到 <span class="tw-mono">chrome://</span> 特权页，让它在通用操作上频繁靠 eval 兜底。</div></section>
<section class="tw-panel pan4" style="--tw-c:#4f7233" aria-label="Chrome DevTools MCP 实现链路"><div class="tw-pane-h"><span class="tw-pane-name">Chrome DevTools MCP</span><span class="tw-pane-arch">MCP server + Puppeteer + DevTools 引擎</span></div><div class="tw-steps"><div class="tw-step"><b>你的指令</b><small>Agent 经进程 stdio 调 MCP server</small></div><div class="tw-link"></div><div class="tw-step"><b>MCP server（懒启动）</b><small>只列工具清单不拉起 Chrome，首个浏览器工具被调时才启动/连接</small></div><div class="tw-link"></div><div class="tw-step"><b>Puppeteer</b><small>启动 · 连接 · 开页面 · 语义定位元素 · 录 trace · 截图</small></div><div class="tw-link"></div><div class="tw-step is-star"><span class="tw-flag good">诊断直出</span><b>Chrome 调试会话</b><small>直接复用 DevTools 前端的轨迹分析引擎与洞察生成器</small></div></div><div class="tw-why"><b>为什么是这样：</b>性能分析不自己造指标解释器，而是复用 Chrome DevTools 自己那套洞察生成器——录完 trace 直接给"LCP 分解 / 渲染阻塞"结论（4.3 只花 111s）。反面：它本质是一个<b>调试面</b>而非全自动产品，遇到移动端遮挡、SW 绕行、file input 这类问题会自然滑向 <span class="tw-mono">evaluate_script</span>，像前端在 Console 里自查。</div></section>
<section class="tw-panel pan5" style="--tw-c:#54579a" aria-label="playwright-cli 实现链路"><div class="tw-pane-h"><span class="tw-pane-name">playwright-cli</span><span class="tw-pane-arch">工程化总入口 · Playwright 引擎之上</span></div><div class="tw-steps"><div class="tw-step"><b>你的指令</b><small>人 · CI · MCP · agent 都能调同一个入口</small></div><div class="tw-link"></div><div class="tw-step"><b>三个包</b><small>core ＋ playwright ＋ @playwright/test；命令行参数统一降维成一份配置覆盖</small></div><div class="tw-link"></div><div class="tw-step is-star"><span class="tw-flag good">可执行性检查</span><b>Playwright 引擎</b><small>actionability：动作前自动确认元素存在 · 可见 · 不再移动 · 没被遮挡；locator 每次按最新 DOM 重新找回</small></div><div class="tw-link"></div><div class="tw-step"><b>CDP / BiDi</b><small>底层协议层</small></div><div class="tw-link"></div><div class="tw-step is-warn"><span class="tw-flag warn">外场卡点</span><b>Chrome（自启浏览器）</b><small>attach 9223 需其有打开的页面才成（无页面崩于 setDownloadBehavior）</small></div></div><div class="tw-why"><b>为什么是这样：</b>把"一个真人此刻能不能完成这个动作"编码进动作模型，从根上消掉手写死等待的偶发失败——这就是它一次点中视口外只露 3px 按钮的底气，综合成绩全场最佳。短板在外场：attach 真实 9223 依赖浏览器状态——9223 有打开的页面时 attach 成功（并存扩展也不崩），无页面则崩于 <span class="tw-mono">setDownloadBehavior</span>（见 4.7），可预测性不足，所以更适合自启浏览器的回归测试。</div></section>
</div>
<div class="tw-foot"><span class="tw-leg"><span class="tw-chip lc-good"></span>绿格＝差异化亮点</span><span class="tw-leg"><span class="tw-chip lc-warn"></span>黄格＝可控性/外场卡点</span><span class="tw-leg"><span class="tw-chip lc-bad"></span>红格＝硬边界</span><span class="tw-leg">流水线自上而下：你的指令 → 中转层 → Chrome</span></div>
</figure>


#### 7.1 Codex `@chrome` / `@browser`：被层层安全约束收口的能力

`@chrome` / `@browser` 对应 Codex 的 Browser Use 能力，接的是 Codex 自带的内置浏览器那一层，而不是直接驱动你系统里的 Chrome。从公开代码能推断出的执行链路是这样：Agent 跑在一个受限的执行环境里，自己并不直接握有浏览器控制权，而是通过一条本地 Unix socket（线索是 `/tmp/codex-browser-use`）和一个独立的浏览器控制进程通信，由后者真正去管标签页、截图、读页面、执行动作。

它没有完整开源——这点要先讲清楚，因为它直接决定了我们能断言到哪一步。截至写作时，公开的 `openai/codex` 仓库里搜不到 Browser Use 的本体：没有相关插件目录、没有浏览器运行时、没有 `agent.browser.*` 这类浏览器 API 的实现，也没有"内置浏览器后端如何接动作、管标签页、截图、生成页面快照"的源码，开源的只是承载它的那层平台。能找到的最硬的几条公开证据是：其一，`codex-rs/features/src/lib.rs` 把 `BrowserUse` 和 `InAppBrowser`、`ComputerUse` 并列定义成一等能力（标为稳定、默认开启），但它是个"只认远端配置"的开关——最终开不开由组织、产品、账号的远端配置说了算，这正好解释了为什么同一个版本的 Codex 在不同账号下能力会不一样；其二，Codex 的插件系统本身是开源的，一个插件可以同时贡献 skill、MCP server 和 app 三类能力，Browser Use 最合理的落点就是一个随 App 一起分发的内置插件；其三，沙箱测试 `seatbelt_tests.rs` 专门把 `/tmp/codex-browser-use` 这条 Unix socket 加进了 macOS 沙箱的放行名单——如果它只是普通网页请求或屏幕级点击，根本不需要专门放行一条名字这么明确的本地通道。

这套"安全收口为先"的实现取向，正是早期那一串 ❌ 的根源：能力被一层层关进能力开关、远端配置、沙箱放行名单里，动作只能经受控后端代为执行。开权限复测之后，这句话要说得更精确：Browser Use 不是天然只能只读页面，而是默认把高风险面关得很紧；授权放大后，页面 Runtime / Network 读能力可以打开，T02/T03/T07/T12-T20 立刻翻盘，但特权 URL、扩展 options、route/mock 和用户指定 9223 仍没有放开。需要强调：以上是从公开代码和本轮实测共同推断出的边界，不等于对官方实现细节的证实，真正驱动浏览器的那层代码并不在公开仓库里。另外，Browser Use 和 Computer Use 是两条不同的路径——前者贴着浏览器运行时，对象是标签页、DOM、页面结构，对网页语义理解更细；后者贴着操作系统界面和截图，能跨任意应用，但对网页内部状态没那么精细。

#### 7.2 agent-browser：Rust 瘦 CLI + 常驻原生 daemon（直连调试协议）

agent-browser 是用 Rust 写的，对外是一个瘦 CLI、背后挂一个常驻原生 daemon 替它连 CDP（Chrome 的调试协议），而且能 `connect` 到任意一个调试目标——实测里我用一个本地 Electron 应用验证过 `--cdp` 连接的完整流程。它的快照短、元素引用稳、长对话省 token，网络请求被动留底事后可查；在八道题里拿到满分、全程只被迫用了一次 eval 兜底。

**它的架构是瘦 CLI + 常驻 daemon**：0.27.2 起有一个常驻 daemon，是一个**编译后的原生二进制** `agent-browser-darwin-arm64`（不是 node 进程，按 node/daemon 关键字搜不到、容易漏看），脱离父进程挂到 init（PPID=1）、长期常驻、监听 unix 域套接字 `~/.agent-browser/default.sock`，并配 `default.pid` / `default.engine`（值为 `chrome`）/ `default.version`（值为 `0.27.2`）这套标准 daemon 文件。也就是说 agent-browser 的 CLI 是**瘦客户端**，每条命令经 `default.sock` 发给这个常驻 daemon，由 daemon 持有"当前会话绑在哪个浏览器"的状态——和 bb-browser 的形态接近，区别在于它是 Rust 原生二进制、socket 走 unix 域而非本地 HTTP 端口。

这个 daemon 直接解释了 4.7 里 agent-browser `--cdp 9223` 的可靠性硬伤：**daemon 持有的会话是粘滞的**。一旦它之前把 default 会话绑到了自起的托管浏览器（一个空白 headless Chrome），后续即使带 `--cdp 9223`，daemon 也不会可靠地把目标切过去，命令静默落在旧绑定的托管浏览器上——`get url` 还返回你要的页面，像成功，实则没碰真身。复现核验很直接：`open` 一个唯一 URL 后 `curl http://127.0.0.1:9223/json` 找不到它、却在 agent-browser 自管 Chrome 的端口上找得到；进程命令行显示那是个 `--user-data-dir=/tmp/agent-browser-chrome-* --headless=new` 的临时实例。要可靠复用真实 profile，实践中得每次先 `tab` 确认目标、不对就 `close --all`（必要时连 daemon/托管 Chrome 一起 `pkill`）再重连。**这是一个实打实的"Agent 友好度/可控性"扣分项**：静默落到错的浏览器，比明确报错更难发现（呼应第 5 节"静默失败是 Agent 最大的敌人"那条）。它和 bb-browser 在链路上的差别，见 7.3。

#### 7.3 bb-browser：后台常驻进程 + 调试协议 + 站点适配器

bb-browser 同样站在 CDP 调试层，但形态和 agent-browser 完全不同。它对外有三个入口——CLI、MCP server、provider（给上层框架注册用），但这三个入口谁都不直接连 Chrome，而是统一汇到一个常驻的后台进程（默认监听 `127.0.0.1:19824`）。这个后台进程才是核心中转站：它维持着和 Chrome 的唯一一条调试长连接、记录每个标签页的状态、持续监听网络/控制台/报错事件，再把各入口发来的命令翻译成调试协议调用。这样 CLI、MCP、provider 就都不用各自再实现一遍浏览器连接和标签页管理。

画成链路图，bb-browser 和 agent-browser 其实很像——**两边都有一层常驻 daemon 中转、都持有粘滞会话**，区别只在 daemon 的实现形态（原生二进制 + unix socket vs node + 本地 HTTP 端口）：

```
agent-browser（Rust 原生二进制 daemon，走 unix socket）
  Agent 发命令
    → agent-browser CLI（瘦客户端）
    → unix socket（~/.agent-browser/default.sock）
    → daemon（常驻原生二进制 agent-browser-darwin-arm64，PPID=1，持有当前会话绑定 + CDP 连接）
    → Chrome 的 CDP 端口（粘滞会话若绑到自起的托管浏览器，--cdp 切换不可靠，见 4.7 / 7.2）

bb-browser（node daemon，走本地 HTTP 端口）
  Agent 发命令
    → bb-browser CLI（瘦客户端）
    → 本地 HTTP（127.0.0.1:19824）
    → daemon（常驻，持有唯一 CDP 长连接 + 各 tab 状态）
    → Chrome 的 CDP 端口
```

它最有标志性的一句话是"你的浏览器就是 API"。意思是：网站本来就是给浏览器用的，那就让 Agent 直接进到真实的标签页上下文里执行代码——于是发出的请求天然带着当前账号的 Cookie 和本地存储，页面的前端运行时和状态也都在，Agent 可以直接调同源接口、复用页面自己的请求封装，不必非得去解析界面。这也正是 4.5 里它点击功能整个坏掉、却还能靠 eval 答对 7 道题的底气来源。

几个关键机制值得点出来。一是登录态复用：它默认连的不是你日常那个 Chrome，而是它自己管的一份独立配置档（`~/.bb-browser/browser/user-data`）。原因是 Chrome 从 136 版起出于安全考虑，不再允许对默认配置目录开远程调试端口，所以"复用登录态"的准确含义是——在这份受管配置档里登录一次，之后每次启动都继续用这份持久化下来的 Cookie。二是统一协议：所有动作都抽象成同一套请求/响应结构，再由一张命令注册表用 schema 描述每个命令，三个入口因此能从同一份元数据自动生成。三是元素引用：后台进程往页面里注入一段脚本，把 DOM 和可访问性信息转成带编号的文本快照（类似 `button [ref=5] "提交"`），Agent 用编号点击，后台再把编号解析回真实节点、通过调试协议派发鼠标事件——4.5 那个点击不生效的 bug 就出在这条事件派发链路上，属于实现层面的 bug，不是能力边界。

它真正的两个差异化，前面实测已经从侧面印证过。一个是站点适配器：一个适配器就是一个带元数据头的 JS 文件，按域名匹配到标签页后，把函数体注入真实页面里执行，从而复用页面的登录态和前端逻辑，把高频网站的某项能力沉淀成一条稳定命令（比如"取某站热榜"）。另一个是观察能力：后台进程给每个标签页维护一圈固定容量的事件缓存（网络最多 500 条、控制台 200 条、报错 100 条），每个事件都有递增编号，每次主动动作都会记下当时的编号，于是 Agent 能做"只看上一个动作之后发生了什么"的增量排查，并把动作和它引发的请求关联成一条因果链——这就是 4.2 里那条独有的"动作↔请求"因果信息的来源。一句话：bb-browser 真正抽象的不是"点按钮"，而是"登录之后的那个互联网"。

#### 7.4 Chrome DevTools MCP：把 DevTools 的整套调试流程包成工具

Chrome DevTools MCP 是一个本地 MCP server，靠进程的标准输入输出和 Agent 通信，接管的是浏览器的"调试会话"那一层。它的启动入口很薄，真正的逻辑在 `createMcpServer`；而且浏览器是懒启动的——只列工具清单时不会把 Chrome 拉起来，等第一个真正要操作浏览器的工具被调用时才启动或连接。它的执行底座不是自己手写调试协议，而是直接用 Puppeteer，由 Puppeteer 负责启动、连接、开页面、定位元素、录性能轨迹、截图这一整套。

它对 Agent 友好的关键在中间这层"上下文"对象：它把当前有哪些页面、每个页面的网络和控制台记录都持续收集成可读的状态；元素定位走语义而不走坐标——读取页面的可访问性树，给每个节点分配一个跨快照都唯一的编号，之后点击、填表都按这个编号找回元素，从而不受窗口尺寸、滚动、缩放的影响。动作之后它还有一道"等稳定"的机制：监听导航是否完成、往页面注入观察器，等 DOM 短暂稳定下来才返回，这样模型下一步不会看到一个还在变的半成品页面。所有工具都收敛成统一的定义结构（参数用 schema 描述加一个处理函数），注册时在外面套了一层统一治理：按开关决定暴露哪些工具、用一把全局锁把调用串行化（避免并发的点击/导航/截图互相打架）、用完即转成 MCP 能读的内容并记录耗时。

它最大的差异化是性能分析。它不自己造一套指标解释器，而是直接复用了 Chrome DevTools 前端代码里那套轨迹分析引擎和洞察生成器——也就是说，它录下性能轨迹后，能直接拿到 DevTools 自己用的那套分析结论（比如 LCP 的分解、渲染阻塞的诊断），而不只是一堆原始时间数字。这正是 4.3 里它只花 111 秒就直接给出结构化原因分析的来历：别的工具得靠模型自己去推，它把"解释"内置进了工具里。另外它输出时也很克制——网络和控制台记录分页展开、大截图和性能轨迹走文件引用而不是整块塞进上下文，既省 token 又不会把大段字节糊到模型脸上。一句话：它封装的不是"浏览器 API"，而是 Chrome DevTools 原本给人用的那整套调试流程。

T12–T20 补测也暴露了它的反面：DevTools MCP 是一个**调试面**，不是一个无所不包的高级自动化产品。遇到移动端遮挡、Service Worker 绕行、文件 input 异步状态这类"DevTools 面板里也会打开 Console 自查"的问题，它会自然滑向 `evaluate_script`：用 hit-test 查覆盖元素、读 `navigator.serviceWorker.controller`、检查 `input.files`。这不算作弊，前端排障本来就会这么做；但它说明 DevTools MCP 的优势是**拿到底层证据并让 Agent 会查**，不是保证每个业务动作都有一条无脚本的一键命令。要做长期 CI 回归时，playwright-cli 那种 actionability、断言、trace 和隔离上下文仍然更合适。

#### 7.5 playwright-cli：把 Playwright 引擎装成一个工程化总入口

playwright-cli 站在 Playwright 引擎之上（这个引擎本身又架在调试协议 / BiDi 之上）。它的能力分在三个包里：`playwright-core` 提供核心自动化和 open/codegen/screenshot/install 这些基础命令，`playwright` 在它之上叠加测试相关命令，`@playwright/test` 再往上是最常用的测试入口。三个包的 bin 文件都几乎没有逻辑，本质就是拿到一个已经装配好的命令对象、再把进程参数丢给它分发；命令是分两层挂上去的——先注册核心的浏览器和安装命令，再补上测试和报告命令。所以只装核心包时，它能当一个不带测试框架的纯自动化工具用。

它内部最值得说的，是把"命令行参数"统一降维成"配置覆盖"：跑测试时，`--headed`、`--trace`、`--retries`、`--project` 这些参数不会各自散进执行逻辑，而是先整理成一份覆盖项，再和默认配置、配置文件、项目级配置合并成唯一一份完整的内部配置对象，后面所有环节只面对这一个对象。真正执行时它用一条任务链来描述整个生命周期（全局准备 → 收集并过滤出一棵稳定的测试树 → 切成可并发的执行单元），并按项目依赖拆成一个个阶段来调度，而不是把所有测试粗暴地丢进一个并发里跑：相同环境的执行进程能复用以省启动成本，一旦出错就果断重启那个进程、避免状态污染到后面的测试。

它在前面实测里"一次就点中视口外那个只露 3 像素按钮"的可靠性，来自引擎的两个核心设计。一是动作前的可执行性检查（actionability）：点击、填写之前，引擎会自动确认元素是不是存在、可见、不再移动、可交互、点击点没被浮层挡住——本质是把"一个真人此刻能不能完成这个动作"编码进了动作模型，从根上消掉了靠手写死等待带来的偶发失败；配套的断言也会自动重试到成立或超时。二是它的元素定位是一条"怎么找这个元素"的可复用规则，而不是某一刻的一次性节点引用，所以即便页面中途重新渲染、换掉了旧节点，它执行时也会按最新的 DOM 重新找回来。此外，它还新增了启动 MCP server、初始化 agent 配置这类入口，使它同时能被人、CI、MCP 和 agent 调用——这也正是"playwright-cli 补齐了快照/引用/自动等待、综合成绩全场最佳"在工程上的来源。一句话：playwright-cli 封装的不是一层命令行外壳，而是把一个可靠的浏览器自动化引擎，组织成可安装、可录制、可调试、可并发、还能接进 CI 和 agent 流程的工程化总入口。
