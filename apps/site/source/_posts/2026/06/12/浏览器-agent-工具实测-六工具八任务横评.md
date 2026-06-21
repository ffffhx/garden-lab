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
excerpt: "实测 @chrome、@browser、agent-browser、bb-browser、Chrome DevTools MCP 和 playwright-cli：二十道固定任务覆盖网页登录、Network 排障、性能诊断、扩展特权页、三种登录态路线、Source Map、Service Worker、iframe、文件上传与键盘可访问性；另已跑完 R01-R09 真实网站外场任务，覆盖 Chrome Web Store、真实扩展注入、真实 Network 响应体、请求拦截和 HAR/trace。结论不是谁最强，而是什么场景该选谁。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

如果你正在选浏览器 Agent 工具，先别问"哪个最强"。先问三件事：它能不能复用真实登录态，能不能拿到 Network / 性能证据，能不能进入 `chrome://` 和扩展设置页。

我用 `@chrome`、`@browser`、`agent-browser`、`bb-browser`、`Chrome DevTools MCP` 和 `playwright-cli` 跑了二十道有标准答案的固定任务（其中 T10 拆成默认 profile、自管持久化、指定 9223 三条登录态路线），从网页登录、Network 排障、性能诊断，一路覆盖到扩展安全域、真实登录态、Source Map、Service Worker、iframe、文件上传与键盘可访问性。后来又用每工具一个独立 Subagent 跑完 R01-R09 真实网站外场，专门覆盖 GitHub、MDN、npm、Chrome Web Store、真实扩展注入、真实 Network 响应体、请求拦截和 HAR/trace；这组并进第 1 节同一张总表（因为是同一时刻、同一批工具跑的一次快照），只是动态字段会随时间变、必须带上当次 URL、时间戳、profile 和证据。2026-06-20 追加了一轮 `@chrome` 开完整 CDP 权限后的默认 Profile 复测；2026-06-21 又把完整 CDP 关掉、只保留 extension bridge 复测，修正了早期因 Codex Chrome Extension disabled 导致的大量 N-R。

这篇文章按"结论 → 过程 → 原理"三段组织：

- **一、结论先行**：第 1 节是六工具 × T01-T20 靶场任务 + R01-R09 真实网站任务的结果总表，第 2 节按"你要干什么"直接给首选与加装路由；
- **二、测试过程**：第 3 节是实测方法（基准测试站与任务设计），第 4 节逐格核对每个 ❌ / ⚠️ 的成因，第 5 节提炼比单格更长寿的跨工具规律；
- **三、底层原理**：第 6 节用浏览器能力分层和安全域给出边界公式，第 7 节逐工具讲实现——边界到底来自哪里。

复现材料（基准测试站、任务卡、原始数据）都在仓库 `apps/browser-tool-bench/`；固定靶场任务在 `tasks/`，真实网站外场任务在 `tasks-real/`，外场首轮报告在 `results/realworld-2026-06-20-r01-r09/`，可以复查每个 ✅ / ⚠️ / ❌ 的依据。

全文主线是一个从实测里提炼出来的公式：

> **工具实际能力 = min(协议层上限, 产品封装范围, 安全策略)**

这条公式能解释总表里的大多数边界：有的工具协议层够强，但产品封装没开放；有的能连到真实 profile，却被 Chrome 安全策略或企业管控挡住；有的操作顺滑，但拿不到响应体、trace 或扩展特权页。后文的每个 ❌ 和 ⚠️ 都会落回这三个因素之一。

只想选工具，可以直接跳到 [第 2 节选型路由](#2-选型路由按任务场景反推工具)。想复现实测，看附录里的 `apps/browser-tool-bench/`、任务卡和原始结果目录。想理解某个工具为什么失败，从第 4 节逐格解释读起。

## 一、结论先行：读者最关心的

### 1. 结果总表

下面这张热力图收全 T01-T20 靶场任务和 R01-R09 真实网站任务，颜色与图例见图内；图中上标 `†` = `--cdp` 命中目标 profile 不可靠、需先复位常驻 daemon（见 7.2），`‡` = 依赖持久 userDataDir、不可移植（换目录即丢），`△` = 工具自身无持久化机制、只能搭外部持久浏览器便车，`N/A` = 该任务对该工具不适用，`N-R` = 本轮运行时不可用或该能力未暴露。

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
@media(max-width:640px){.bv-rowh{min-width:140px}.bv-covname{flex-basis:7rem}}</style>
<div class="bv-head"><span class="bv-title">六工具 × 31 任务结果热力图</span><span class="bv-hint">绿=通过 · 黄=部分 · 红=失败 · 灰=不适用；斜纹=靠 eval/CDP 逃生补齐；悬停看每格说明；右滑看全部工具列。上标 <b>†</b>=--cdp 命中不可靠（见 7.2）· <b>‡</b>=持久 userDataDir 不可移植。</span></div>
<div class="bv-legend"><span class="bv-lg"><span class="bv-dot bv-ok">✓</span>通过</span><span class="bv-lg"><span class="bv-dot bv-oka">✓*</span>通过（靠 eval/CDP 逃生）</span><span class="bv-lg"><span class="bv-dot bv-warn">◐</span>部分 / JS 层补丁</span><span class="bv-lg"><span class="bv-dot bv-bad">✕</span>失败</span><span class="bv-lg"><span class="bv-dot bv-dep">△</span>借外部浏览器</span><span class="bv-lg"><span class="bv-dot bv-nr">–</span>N-R 未暴露</span><span class="bv-lg"><span class="bv-dot bv-na">·</span>N/A 不适用</span></div>
<div class="bv-scroll"><table class="bv-grid"><thead><tr><th class="bv-rowh bv-corner">任务 \ 工具</th><th class="bv-colh"><b>@chrome</b><span class="bv-sub">无完整CDP · 默认Profile</span></th><th class="bv-colh"><b>@chrome</b><span class="bv-sub">开权限 · 默认Profile</span></th><th class="bv-colh"><b>@browser</b><span class="bv-sub">in-app</span></th><th class="bv-colh"><b>agent-browser</b><span class="bv-sub">CDP</span></th><th class="bv-colh"><b>bb-browser</b><span class="bv-sub">CDP</span></th><th class="bv-colh"><b>DevTools MCP</b><span class="bv-sub">CDP + DevTools</span></th><th class="bv-colh"><b>playwright-cli</b><span class="bv-sub">Playwright 引擎</span></th></tr></thead><tbody><tr class="bv-tr"><th class="bv-rowh" scope="row">T01 登录与观察</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）"><span class="bv-g">✓<sup class="bv-mk">*</sup></span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T02 Network 排障</th><td class="bv-c bv-bad" title="失败：无响应体"><span class="bv-g">✕</span><span class="bv-n">无响应体</span></td><td class="bv-c bv-ok" title="通过：读响应体"><span class="bv-g">✓</span><span class="bv-n">读响应体</span></td><td class="bv-c bv-bad" title="失败：无响应体"><span class="bv-g">✕</span><span class="bv-n">无响应体</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：需 trace 重放"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">需 trace 重放</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T03 性能诊断</th><td class="bv-c bv-bad" title="失败：无 perf API"><span class="bv-g">✕</span><span class="bv-n">无 perf API</span></td><td class="bv-c bv-ok" title="通过：timing + Runtime"><span class="bv-g">✓</span><span class="bv-n">timing + Runtime</span></td><td class="bv-c bv-bad" title="失败：无 perf API"><span class="bv-g">✕</span><span class="bv-n">无 perf API</span></td><td class="bv-c bv-ok" title="通过：自挖 profiler"><span class="bv-g">✓</span><span class="bv-n">自挖 profiler</span></td><td class="bv-c bv-notrun" title="未跑：未跑"><span class="bv-g">–</span><span class="bv-n">未跑</span></td><td class="bv-c bv-ok" title="通过：insight 直出"><span class="bv-g">✓</span><span class="bv-n">insight 直出</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T04 请求 mock</th><td class="bv-c bv-bad" title="失败：无 route"><span class="bv-g">✕</span><span class="bv-n">无 route</span></td><td class="bv-c bv-bad" title="失败：无可靠 route"><span class="bv-g">✕</span><span class="bv-n">无可靠 route</span></td><td class="bv-c bv-bad" title="失败：无 route"><span class="bv-g">✕</span><span class="bv-n">无 route</span></td><td class="bv-c bv-ok" title="通过：网络层"><span class="bv-g">✓</span><span class="bv-n">网络层</span></td><td class="bv-c bv-warn" title="部分：JS 层补丁"><span class="bv-g">◐<sup class="bv-mk">*</sup></span><span class="bv-n">JS 层补丁</span></td><td class="bv-c bv-warn" title="部分：JS 层 initScript"><span class="bv-g">◐</span><span class="bv-n">JS 层 initScript</span></td><td class="bv-c bv-ok" title="通过：网络层"><span class="bv-g">✓</span><span class="bv-n">网络层</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T05 动态等待</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：盲 sleep"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">盲 sleep</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T06 结构化提取</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）"><span class="bv-g">✓<sup class="bv-mk">*</sup></span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T07 已登录 fetch</th><td class="bv-c bv-bad" title="失败：evaluate 无 fetch"><span class="bv-g">✕</span><span class="bv-n">evaluate 无 fetch</span></td><td class="bv-c bv-ok" title="通过：Runtime fetch"><span class="bv-g">✓</span><span class="bv-n">Runtime fetch</span></td><td class="bv-c bv-bad" title="失败：fetch 被拦"><span class="bv-g">✕</span><span class="bv-n">fetch 被拦</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）"><span class="bv-g">✓<sup class="bv-mk">*</sup></span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T08 Shadow DOM</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：Runtime 穿透"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">Runtime 穿透</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：双重 eval"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">双重 eval</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T09 扩展 reload</th><td class="bv-c bv-bad" title="失败：chrome:// 被策略拦"><span class="bv-g">✕</span><span class="bv-n">chrome:// 被策略拦</span></td><td class="bv-c bv-bad" title="失败：chrome:// 仍被拦"><span class="bv-g">✕</span><span class="bv-n">chrome:// 仍被拦</span></td><td class="bv-c bv-bad" title="失败：封死 chrome://"><span class="bv-g">✕</span><span class="bv-n">封死 chrome://</span></td><td class="bv-c bv-ok" title="通过：复位 daemon"><span class="bv-g">✓<sup class="bv-mk">†</sup></span><span class="bv-n">复位 daemon</span></td><td class="bv-c bv-warn" title="部分：到不了扩展管理"><span class="bv-g">◐</span><span class="bv-n">到不了扩展管理</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过：自管 context"><span class="bv-g">✓</span><span class="bv-n">自管 context</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T10a 真实登录态（默认 profile）</th><td class="bv-c bv-ok" title="通过：70 · 默认Profile"><span class="bv-g">✓</span><span class="bv-n">70 · 默认Profile</span></td><td class="bv-c bv-ok" title="通过：70 · 默认Profile"><span class="bv-g">✓</span><span class="bv-n">70 · 默认Profile</span></td><td class="bv-c bv-bad" title="失败：无真实登录态"><span class="bv-g">✕</span><span class="bv-n">无真实登录态</span></td><td class="bv-c bv-ok" title="通过：68"><span class="bv-g">✓<sup class="bv-mk">†</sup></span><span class="bv-n">68</span></td><td class="bv-c bv-ok" title="通过：68"><span class="bv-g">✓</span><span class="bv-n">68</span></td><td class="bv-c bv-ok" title="通过：68"><span class="bv-g">✓</span><span class="bv-n">68</span></td><td class="bv-c bv-bad" title="失败：本轮 attach 崩"><span class="bv-g">✕</span><span class="bv-n">本轮 attach 崩</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T10b 登录态持久化（专用 profile）</th><td class="bv-c bv-na" title="不适用 N/A"><span class="bv-g">·</span></td><td class="bv-c bv-na" title="不适用 N/A"><span class="bv-g">·</span></td><td class="bv-c bv-na" title="不适用 N/A"><span class="bv-g">·</span></td><td class="bv-c bv-ok" title="通过：可移植 state 文件"><span class="bv-g">✓</span><span class="bv-n">可移植 state 文件</span></td><td class="bv-c bv-dep" title="借车 △：仅能 attach"><span class="bv-g">△</span><span class="bv-n">仅能 attach</span></td><td class="bv-c bv-ok" title="通过：持久 userDataDir"><span class="bv-g">✓<sup class="bv-mk">‡</sup></span><span class="bv-n">持久 userDataDir</span></td><td class="bv-c bv-ok" title="通过：可移植 state 文件"><span class="bv-g">✓</span><span class="bv-n">可移植 state 文件</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T10c 指定浏览器登录态（CDP 9223）</th><td class="bv-c bv-nr" title="未暴露 N-R：无 9223 绑定"><span class="bv-g">–</span><span class="bv-n">无 9223 绑定</span></td><td class="bv-c bv-bad" title="失败：仍不能证明 9223"><span class="bv-g">✕</span><span class="bv-n">仍不能证明 9223</span></td><td class="bv-c bv-nr" title="未暴露 N-R：无外部 CDP 绑定"><span class="bv-g">–</span><span class="bv-n">无外部 CDP 绑定</span></td><td class="bv-c bv-ok" title="通过：9223 · 70/71"><span class="bv-g">✓</span><span class="bv-n">9223 · 70/71</span></td><td class="bv-c bv-ok" title="通过：9223 · 70"><span class="bv-g">✓</span><span class="bv-n">9223 · 70</span></td><td class="bv-c bv-ok" title="通过：9223 · 70"><span class="bv-g">✓</span><span class="bv-n">9223 · 70</span></td><td class="bv-c bv-ok" title="通过：attach 9223 · 71"><span class="bv-g">✓</span><span class="bv-n">attach 9223 · 71</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T11 用扩展（设置页改徽标）</th><td class="bv-c bv-bad" title="失败：options 被拦"><span class="bv-g">✕</span><span class="bv-n">options 被拦</span></td><td class="bv-c bv-bad" title="失败：options 仍被拦"><span class="bv-g">✕</span><span class="bv-n">options 仍被拦</span></td><td class="bv-c bv-bad" title="失败"><span class="bv-g">✕</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓<sup class="bv-mk">†</sup></span></td><td class="bv-c bv-warn" title="部分：靠 CDP 强开设置页"><span class="bv-g">◐</span><span class="bv-n">靠 CDP 强开设置页</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过：自管 context"><span class="bv-g">✓</span><span class="bv-n">自管 context</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T12 Console 与 Source Map</th><td class="bv-c bv-warn" title="部分：仅 console/bundle"><span class="bv-g">◐</span><span class="bv-n">仅 console/bundle</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-warn" title="部分：raw sourcemap blocked"><span class="bv-g">◐</span><span class="bv-n">raw sourcemap blocked</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：eval 取 map"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 取 map</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T13 移动端布局遮挡</th><td class="bv-c bv-bad" title="失败：无 viewport"><span class="bv-g">✕</span><span class="bv-n">无 viewport</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：hit-test 后临时隐藏"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">hit-test 后临时隐藏</span></td><td class="bv-c bv-warn" title="部分：未拿确认码"><span class="bv-g">◐</span><span class="bv-n">未拿确认码</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：eval 补确认码"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 补确认码</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：临时解除遮挡"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">临时解除遮挡</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：run-code 补确认码"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">run-code 补确认码</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T14 SPA 状态 / Hydration</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：eval 读 store"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 读 store</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T15 SSE 实时流等待</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：eval 触发 click"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 触发 click</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T16 Service Worker 缓存排障</th><td class="bv-c bv-warn" title="部分：只证旧值"><span class="bv-g">◐</span><span class="bv-n">只证旧值</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-warn" title="部分：未拿 live 值"><span class="bv-g">◐</span><span class="bv-n">未拿 live 值</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：eval/SW 诊断"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval/SW 诊断</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T17 跨域 iframe 授权</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T18 文件上传与拖拽输入</th><td class="bv-c bv-bad" title="失败：no upload API"><span class="bv-g">✕</span><span class="bv-n">no upload API</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R：no upload API"><span class="bv-g">–</span><span class="bv-n">no upload API</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T19 键盘可访问性</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：eval 补确认码"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 补确认码</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr"><th class="bv-rowh" scope="row">T20 回归稳定性 / Flake Rate</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：eval 触发 click"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">eval 触发 click</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：CDP 逃生"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">CDP 逃生</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R01 GitHub 公共仓库代码导航</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R02 GitHub 真实登录态只读通知</th><td class="bv-c bv-ok" title="通过：70"><span class="bv-g">✓</span><span class="bv-n">70</span></td><td class="bv-c bv-ok" title="通过：70"><span class="bv-g">✓</span><span class="bv-n">70</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R03 MDN 文档结构化阅读</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R04 npm 包页面元数据</th><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R05 Chrome Web Store 扩展详情</th><td class="bv-c bv-bad" title="失败：Web Store 不可脚本化"><span class="bv-g">✕</span><span class="bv-n">Web Store 不可脚本化</span></td><td class="bv-c bv-bad" title="失败：detached"><span class="bv-g">✕</span><span class="bv-n">detached</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R06 扩展注入真实网站</th><td class="bv-c bv-warn" title="部分：可见注入，options 不可达"><span class="bv-g">◐</span><span class="bv-n">可见注入，options 不可达</span></td><td class="bv-c bv-warn" title="部分：可见注入，options 不可达"><span class="bv-g">◐</span><span class="bv-n">可见注入，options 不可达</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td><td class="bv-c bv-warn" title="部分：实为 ✅，见下"><span class="bv-g">◐</span><span class="bv-n">实为 ✅，见下</span></td><td class="bv-c bv-bad" title="失败"><span class="bv-g">✕</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R07 真实网站 Network 响应体</th><td class="bv-c bv-bad" title="失败：无响应体"><span class="bv-g">✕</span><span class="bv-n">无响应体</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R08 真实网站请求拦截</th><td class="bv-c bv-nr" title="未暴露 N-R：无 route"><span class="bv-g">–</span><span class="bv-n">无 route</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）：URL block"><span class="bv-g">✓<sup class="bv-mk">*</sup></span><span class="bv-n">URL block</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td><td class="bv-c bv-oka bv-hatch" title="通过（逃生）"><span class="bv-g">✓<sup class="bv-mk">*</sup></span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td></tr><tr class="bv-tr bv-real"><th class="bv-rowh" scope="row">R09 真实网站 HAR 与性能快照</th><td class="bv-c bv-bad" title="失败：无 timing"><span class="bv-g">✕</span><span class="bv-n">无 timing</span></td><td class="bv-c bv-ok" title="通过：timing"><span class="bv-g">✓</span><span class="bv-n">timing</span></td><td class="bv-c bv-warn" title="部分"><span class="bv-g">◐</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-warn" title="部分"><span class="bv-g">◐</span></td><td class="bv-c bv-ok" title="通过"><span class="bv-g">✓</span></td><td class="bv-c bv-nr" title="未暴露 N-R"><span class="bv-g">–</span></td></tr></tbody></table></div>
<div class="bv-cov"><div class="bv-covh">能力覆盖（同口径 31 格，含 R01-R09 外场）</div><div class="bv-covrow"><span class="bv-covname">@chrome<small>无完整CDP · 默认Profile</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:14" data-tip="通过 · 14 格" aria-label="通过 · 14 格"></span><span class="bv-seg bv-warn" style="flex:3" data-tip="部分 / JS 层补丁 · 3 格" aria-label="部分 / JS 层补丁 · 3 格"></span><span class="bv-seg bv-bad" style="flex:11" data-tip="失败 · 11 格" aria-label="失败 · 11 格"></span><span class="bv-seg bv-nr" style="flex:2" data-tip="N-R 未暴露 · 2 格" aria-label="N-R 未暴露 · 2 格"></span><span class="bv-seg bv-na" style="flex:1" data-tip="N/A 不适用 · 1 格" aria-label="N/A 不适用 · 1 格"></span></span><span class="bv-covnum"><b>14</b><small>/30 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">@chrome<small>开权限 · 默认Profile</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:21" data-tip="通过 · 21 格" aria-label="通过 · 21 格"></span><span class="bv-seg bv-oka" style="flex:3" data-tip="通过（靠 eval/CDP 逃生） · 3 格" aria-label="通过（靠 eval/CDP 逃生） · 3 格"></span><span class="bv-seg bv-warn" style="flex:1" data-tip="部分 / JS 层补丁 · 1 格" aria-label="部分 / JS 层补丁 · 1 格"></span><span class="bv-seg bv-bad" style="flex:5" data-tip="失败 · 5 格" aria-label="失败 · 5 格"></span><span class="bv-seg bv-na" style="flex:1" data-tip="N/A 不适用 · 1 格" aria-label="N/A 不适用 · 1 格"></span></span><span class="bv-covnum"><b>24</b><small>/30 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">@browser<small>in-app</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:13" data-tip="通过 · 13 格" aria-label="通过 · 13 格"></span><span class="bv-seg bv-warn" style="flex:4" data-tip="部分 / JS 层补丁 · 4 格" aria-label="部分 / JS 层补丁 · 4 格"></span><span class="bv-seg bv-bad" style="flex:7" data-tip="失败 · 7 格" aria-label="失败 · 7 格"></span><span class="bv-seg bv-nr" style="flex:6" data-tip="N-R 未暴露 · 6 格" aria-label="N-R 未暴露 · 6 格"></span><span class="bv-seg bv-na" style="flex:1" data-tip="N/A 不适用 · 1 格" aria-label="N/A 不适用 · 1 格"></span></span><span class="bv-covnum"><b>13</b><small>/30 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">agent-browser<small>CDP</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:23" data-tip="通过 · 23 格" aria-label="通过 · 23 格"></span><span class="bv-seg bv-oka" style="flex:7" data-tip="通过（靠 eval/CDP 逃生） · 7 格" aria-label="通过（靠 eval/CDP 逃生） · 7 格"></span><span class="bv-seg bv-warn" style="flex:1" data-tip="部分 / JS 层补丁 · 1 格" aria-label="部分 / JS 层补丁 · 1 格"></span></span><span class="bv-covnum"><b>30</b><small>/31 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">bb-browser<small>CDP</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:8" data-tip="通过 · 8 格" aria-label="通过 · 8 格"></span><span class="bv-seg bv-oka" style="flex:15" data-tip="通过（靠 eval/CDP 逃生） · 15 格" aria-label="通过（靠 eval/CDP 逃生） · 15 格"></span><span class="bv-seg bv-warn" style="flex:4" data-tip="部分 / JS 层补丁 · 4 格" aria-label="部分 / JS 层补丁 · 4 格"></span><span class="bv-seg bv-bad" style="flex:1" data-tip="失败 · 1 格" aria-label="失败 · 1 格"></span><span class="bv-seg bv-dep" style="flex:1" data-tip="借外部浏览器 △ · 1 格" aria-label="借外部浏览器 △ · 1 格"></span><span class="bv-seg bv-nr" style="flex:2" data-tip="N-R 未暴露 · 2 格" aria-label="N-R 未暴露 · 2 格"></span></span><span class="bv-covnum"><b>23</b><small>/30 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">DevTools MCP<small>CDP + DevTools</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:28" data-tip="通过 · 28 格" aria-label="通过 · 28 格"></span><span class="bv-seg bv-oka" style="flex:2" data-tip="通过（靠 eval/CDP 逃生） · 2 格" aria-label="通过（靠 eval/CDP 逃生） · 2 格"></span><span class="bv-seg bv-warn" style="flex:1" data-tip="部分 / JS 层补丁 · 1 格" aria-label="部分 / JS 层补丁 · 1 格"></span></span><span class="bv-covnum"><b>30</b><small>/31 通过</small></span></div><div class="bv-covrow"><span class="bv-covname">playwright-cli<small>Playwright 引擎</small></span><span class="bv-bar"><span class="bv-seg bv-ok" style="flex:20" data-tip="通过 · 20 格" aria-label="通过 · 20 格"></span><span class="bv-seg bv-oka" style="flex:1" data-tip="通过（靠 eval/CDP 逃生） · 1 格" aria-label="通过（靠 eval/CDP 逃生） · 1 格"></span><span class="bv-seg bv-bad" style="flex:1" data-tip="失败 · 1 格" aria-label="失败 · 1 格"></span><span class="bv-seg bv-nr" style="flex:9" data-tip="N-R 未暴露 · 9 格" aria-label="N-R 未暴露 · 9 格"></span></span><span class="bv-covnum"><b>21</b><small>/31 通过</small></span></div></div>
</figure>

过程成本怎么量？我用**两个不同的 Agent 宿主**各跑了一轮"每工具一个独立 subagent、顺序跑"的统一成本测，分开列、别混着比。

**① Claude Code 轮（Opus 4.8 · 4 工具 · token 可量 · 两轮）**：同一批 30 道题（靶场 21 卡 + 外场 9），每工具一个独立 workflow（3 chunk）严格顺序跑。**Round 1 连 9223、Round 2 连 9224**（两台等价测试 profile：均已登录 GitHub + 装 Bench Badge）；两轮里 agent-browser / bb-browser / devtools-mcp 连 CDP、playwright-cli 用自管浏览器（attach 装扩展的 CDP 浏览器会崩）。

<figure class="benchcost bc-claude" role="group" aria-label="成本对比 ① Claude Code · 两轮（Opus 4.8 · 4 工具 · 30 题 · R1 9223 / R2 9224）">
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
<div class="bc-head"><span class="bc-title">成本对比 ① Claude Code · 两轮（Opus 4.8 · 4 工具 · 30 题 · R1 9223 / R2 9224）</span><span class="bc-hint">柱越长越贵；<b style="color:#4f7233">▼省</b> / <b style="color:#8f2d20">▲贵</b> 标该列最优/最差。</span></div>
<div class="bc-scroll"><table class="bc-tab"><thead><tr><th>工具</th><th>轮 / 浏览器</th><th>结果（30 题）</th><th>耗时<small> min</small></th><th>token</th><th>工具调用</th><th>browserOps</th><th>eval 自救</th></tr></thead><tbody><tr><td class="bc-tool">agent-browser<small>0.27.2</small></td><td class="bc-mode">R1·9223</td><td><span class="bc-res"><span class="bc-chip ok">29✅</span></span></td><td class="bc-num"><span class="bc-fill" style="width:54%;background:#c08a3e"></span><span class="bc-v">25.8</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:58%;background:#7a86b8"></span><span class="bc-v">190.6<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:66%;background:#9a8ab0"></span><span class="bc-v">183<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num"><span class="bc-fill" style="width:58%;background:#6f9aa8"></span><span class="bc-v">218</span></td><td class="bc-num"><span class="bc-fill" style="width:62%;background:#c0795f"></span><span class="bc-v">24</span></td></tr><tr><td class="bc-tool">agent-browser<small>0.27.2</small></td><td class="bc-mode">R2·9224</td><td><span class="bc-res"><span class="bc-chip ok">30✅</span></span></td><td class="bc-num"><span class="bc-fill" style="width:55%;background:#c08a3e"></span><span class="bc-v">26.4</span></td><td class="bc-num"><span class="bc-fill" style="width:63%;background:#7a86b8"></span><span class="bc-v">205.0</span></td><td class="bc-num"><span class="bc-fill" style="width:84%;background:#9a8ab0"></span><span class="bc-v">233</span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#6f9aa8"></span><span class="bc-v">378<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:15%;background:#c0795f"></span><span class="bc-v">6<span class="bc-flag" style="color:#4f7233">▼省</span></span></td></tr><tr><td class="bc-tool">bb-browser<small>0.14.2</small></td><td class="bc-mode">R1·9223</td><td><span class="bc-res"><span class="bc-chip ok">22✅</span><span class="bc-chip warn">3⚠️</span><span class="bc-chip bad">4❌</span><span class="bc-chip nr">1 N-R</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#c08a3e"></span><span class="bc-v">47.9<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num"><span class="bc-fill" style="width:83%;background:#7a86b8"></span><span class="bc-v">271.9</span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#9a8ab0"></span><span class="bc-v">277<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num"><span class="bc-fill" style="width:65%;background:#6f9aa8"></span><span class="bc-v">244</span></td><td class="bc-num"><span class="bc-fill" style="width:85%;background:#c0795f"></span><span class="bc-v">33</span></td></tr><tr><td class="bc-tool">bb-browser<small>0.14.2</small></td><td class="bc-mode">R2·9224</td><td><span class="bc-res"><span class="bc-chip ok">26✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip bad">2❌</span><span class="bc-chip nr">1 N-R</span></span></td><td class="bc-num"><span class="bc-fill" style="width:87%;background:#c08a3e"></span><span class="bc-v">41.9</span></td><td class="bc-num"><span class="bc-fill" style="width:71%;background:#7a86b8"></span><span class="bc-v">233.3</span></td><td class="bc-num"><span class="bc-fill" style="width:91%;background:#9a8ab0"></span><span class="bc-v">252</span></td><td class="bc-num"><span class="bc-fill" style="width:82%;background:#6f9aa8"></span><span class="bc-v">311</span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#c0795f"></span><span class="bc-v">39<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td></tr><tr><td class="bc-tool">chrome-devtools-mcp</td><td class="bc-mode">R1·9223</td><td><span class="bc-res"><span class="bc-chip ok">28✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip nr">1 N-R</span></span></td><td class="bc-num"><span class="bc-fill" style="width:53%;background:#c08a3e"></span><span class="bc-v">25.5</span></td><td class="bc-num"><span class="bc-fill" style="width:99%;background:#7a86b8"></span><span class="bc-v">322.7</span></td><td class="bc-num"><span class="bc-fill" style="width:83%;background:#9a8ab0"></span><span class="bc-v">230</span></td><td class="bc-num"><span class="bc-fill" style="width:45%;background:#6f9aa8"></span><span class="bc-v">169</span></td><td class="bc-num"><span class="bc-fill" style="width:64%;background:#c0795f"></span><span class="bc-v">25</span></td></tr><tr><td class="bc-tool">chrome-devtools-mcp</td><td class="bc-mode">R2·9224</td><td><span class="bc-res"><span class="bc-chip ok">29✅</span><span class="bc-chip nr">1 N-R</span></span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:49%;background:#c08a3e"></span><span class="bc-v">23.6<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#7a86b8"></span><span class="bc-v">327.4<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num"><span class="bc-fill" style="width:79%;background:#9a8ab0"></span><span class="bc-v">220</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:43%;background:#6f9aa8"></span><span class="bc-v">161<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num"><span class="bc-fill" style="width:44%;background:#c0795f"></span><span class="bc-v">17</span></td></tr><tr><td class="bc-tool">playwright-cli<small>0.1.14</small></td><td class="bc-mode">R1·自管</td><td><span class="bc-res"><span class="bc-chip ok">24✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip bad">2❌</span><span class="bc-chip nr">3 N-R</span></span></td><td class="bc-num"><span class="bc-fill" style="width:55%;background:#c08a3e"></span><span class="bc-v">26.4</span></td><td class="bc-num"><span class="bc-fill" style="width:62%;background:#7a86b8"></span><span class="bc-v">203.7</span></td><td class="bc-num"><span class="bc-fill" style="width:68%;background:#9a8ab0"></span><span class="bc-v">188</span></td><td class="bc-num"><span class="bc-fill" style="width:49%;background:#6f9aa8"></span><span class="bc-v">184</span></td><td class="bc-num"><span class="bc-fill" style="width:97%;background:#c0795f"></span><span class="bc-v">38</span></td></tr><tr><td class="bc-tool">playwright-cli<small>0.1.14</small></td><td class="bc-mode">R2·自管</td><td><span class="bc-res"><span class="bc-chip ok">25✅</span><span class="bc-chip bad">2❌</span><span class="bc-chip nr">3 N-R</span></span></td><td class="bc-num"><span class="bc-fill" style="width:51%;background:#c08a3e"></span><span class="bc-v">24.3</span></td><td class="bc-num"><span class="bc-fill" style="width:64%;background:#7a86b8"></span><span class="bc-v">209.3</span></td><td class="bc-num"><span class="bc-fill" style="width:68%;background:#9a8ab0"></span><span class="bc-v">188</span></td><td class="bc-num"><span class="bc-fill" style="width:50%;background:#6f9aa8"></span><span class="bc-v">189</span></td><td class="bc-num"><span class="bc-fill" style="width:46%;background:#c0795f"></span><span class="bc-v">18</span></td></tr></tbody></table></div>
<div class="bc-foot">两轮(R1 9223 / R2 9224)。<b>耗时/token 两轮稳</b>，可比；<b>browserOps/eval 自救摆动大</b>(同 subagent 口径不一，只看趋势)。agent-browser R1 的 29✅ 是子代理漏报 R06，R2 干净 30✅。bb-browser R2 已含 R09 重测✅(上次 N-R 是站点网络抽风)。playwright-cli 自管有 5 题快速失败(自管无真实登录态/扩展、npm 被 Cloudflare 拦)，低耗时不等于“做了同样多题”。原始数据 <code>results/unified-2026-06-20-claude-4tools/</code> 与 <code>…-9224-2026-06-21-claude-round2/</code>。</div>
</figure>

四条读数：① **bb-browser 是成本黑洞**——47.9min ≈ agent-browser 的 1.86×，调用/操作数最高却结果最差（4❌），根因还是 4.6 那个 click 事件 bug 逼出的处处 eval 重试——纯工具缺陷把成本顶上去。② **devtools-mcp 操作最省（169）、token 最贵（322.7k）**——MCP 每次回传冗长 a11y 快照/网络体，单 op 很贵，但能力最稳（28✅、零 ❌）。③ **agent-browser 综合最省**（耗时+token 双低、结果最全），代价是 24 次 eval 逃生。④ **playwright-cli 的低成本要打折看**：它有 5 题是自管浏览器没真实登录态/扩展、或被 npm 拦（R02/R06/T10a N-R、R04/R07 ❌），这些快速失败反而压低了耗时/token。

> 三点诚实声明：(a) harness 每工具只给一个 token 总量、未拆 input/output，无法精确折 $（按 Opus 4.8 输出价粗估单工具约 $14–24、含 input 更高），故这里以 **token 总量**作成本口径；(b) **eval 自救是软指标**——各 subagent 对"eval 读数据"算不算逃生口径不一，跨工具只看趋势别逐个抠；(c) **公平性**：playwright-cli 宿主与另三者不同、且有 5 题快速失败，其低耗时不能与"完成同样多题"等价比。原始数据见 `results/unified-2026-06-20-claude-4tools/`。

**② Codex 轮（gpt-5.5 / xhigh · 6 工具 · 含 @chrome/@browser · 2026-06-21 下午 rerun2）**：用同样的"顺序 + 独立 subagent"方式，多测了 Codex 专属的 `@chrome` / `@browser`，任务格按 31 格口径（`T10` 拆 a/b/c）。下午这轮(rerun2)从 transcript 抓到了 **output token**(总 token 95%+ 是缓存输入、很便宜，真实生成量看 output：@chrome 44.7k / @browser 40.9k / agent-browser 49.3k / bb-browser 37.6k，devtools/pw 未采全)。耗时为各 subagent 自报、**不可跨宿主与 Claude 轮直接比**。

<figure class="benchcost bc-codex" role="group" aria-label="成本对比 ② Codex 轮（gpt-5.5 / xhigh · 6 工具 · 31 格 · 2026-06-21 下午 rerun2）">
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
<div class="bc-head"><span class="bc-title">成本对比 ② Codex 轮（gpt-5.5 / xhigh · 6 工具 · 31 格 · 2026-06-21 下午 rerun2）</span><span class="bc-hint">subagent 环境未暴露逐 agent token/$，成本只比耗时/操作/逃生。</span></div>
<div class="bc-scroll"><table class="bc-tab"><thead><tr><th>工具</th><th>浏览器模式</th><th>31 格结果</th><th>耗时<small> min</small></th><th>tool_calls</th><th>browserOps</th><th>eval 自救</th></tr></thead><tbody><tr><td class="bc-tool">@chrome</td><td class="bc-mode">默认 Profile fallback</td><td><span class="bc-res"><span class="bc-chip ok">15✅</span><span class="bc-chip warn">2⚠️</span><span class="bc-chip bad">1❌</span><span class="bc-chip nr">12 N-R</span></span></td><td class="bc-num"><span class="bc-fill" style="width:40%;background:#c08a3e"></span><span class="bc-v">11.9</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:25%;background:#9a8ab0"></span><span class="bc-v">61<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#6f9aa8"></span><span class="bc-v">245<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#c0795f"></span><span class="bc-v">105<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td></tr><tr><td class="bc-tool">@browser</td><td class="bc-mode">in-app browser</td><td><span class="bc-res"><span class="bc-chip ok">14✅</span><span class="bc-chip warn">2⚠️</span><span class="bc-chip nr">14 N-R</span></span></td><td class="bc-num"><span class="bc-fill" style="width:36%;background:#c08a3e"></span><span class="bc-v">10.9</span></td><td class="bc-num"><span class="bc-fill" style="width:26%;background:#9a8ab0"></span><span class="bc-v">64</span></td><td class="bc-num"><span class="bc-fill" style="width:53%;background:#6f9aa8"></span><span class="bc-v">129</span></td><td class="bc-num"><span class="bc-fill" style="width:30%;background:#c0795f"></span><span class="bc-v">31</span></td></tr><tr><td class="bc-tool">agent-browser</td><td class="bc-mode">CDP 9223</td><td><span class="bc-res"><span class="bc-chip ok">30✅</span></span></td><td class="bc-num"><span class="bc-fill" style="width:58%;background:#c08a3e"></span><span class="bc-v">17.5</span></td><td class="bc-num"><span class="bc-fill" style="width:85%;background:#9a8ab0"></span><span class="bc-v">205</span></td><td class="bc-num"><span class="bc-fill" style="width:68%;background:#6f9aa8"></span><span class="bc-v">166</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:7%;background:#c0795f"></span><span class="bc-v">7<span class="bc-flag" style="color:#4f7233">▼省</span></span></td></tr><tr><td class="bc-tool">bb-browser</td><td class="bc-mode">CDP 9223*</td><td><span class="bc-res"><span class="bc-chip ok">19✅</span><span class="bc-chip warn">4⚠️</span><span class="bc-chip bad">5❌</span><span class="bc-chip nr">1 N-R</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#c08a3e"></span><span class="bc-v">30.0<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num bc-worst"><span class="bc-fill" style="width:100%;background:#9a8ab0"></span><span class="bc-v">242<span class="bc-flag" style="color:#8f2d20">▲贵</span></span></td><td class="bc-num"><span class="bc-fill" style="width:81%;background:#6f9aa8"></span><span class="bc-v">198</span></td><td class="bc-num"><span class="bc-fill" style="width:66%;background:#c0795f"></span><span class="bc-v">69</span></td></tr><tr><td class="bc-tool">Chrome DevTools MCP</td><td class="bc-mode">CDP 9223</td><td><span class="bc-res"><span class="bc-chip ok">26✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip bad">1❌</span><span class="bc-chip nr">1 N-R</span></span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:17%;background:#c08a3e"></span><span class="bc-v">5.0<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num"><span class="bc-fill" style="width:50%;background:#9a8ab0"></span><span class="bc-v">120</span></td><td class="bc-num"><span class="bc-fill" style="width:46%;background:#6f9aa8"></span><span class="bc-v">112</span></td><td class="bc-num"><span class="bc-fill" style="width:25%;background:#c0795f"></span><span class="bc-v">26</span></td></tr><tr><td class="bc-tool">playwright-cli</td><td class="bc-mode">CDP 9223</td><td><span class="bc-res"><span class="bc-chip ok">28✅</span><span class="bc-chip warn">1⚠️</span><span class="bc-chip bad">1❌</span></span></td><td class="bc-num"><span class="bc-fill" style="width:87%;background:#c08a3e"></span><span class="bc-v">26.0</span></td><td class="bc-num"><span class="bc-fill" style="width:28%;background:#9a8ab0"></span><span class="bc-v">68</span></td><td class="bc-num bc-best"><span class="bc-fill" style="width:25%;background:#6f9aa8"></span><span class="bc-v">62<span class="bc-flag" style="color:#4f7233">▼省</span></span></td><td class="bc-num"><span class="bc-fill" style="width:40%;background:#c0795f"></span><span class="bc-v">42</span></td></tr></tbody></table></div>
<div class="bc-foot">本表为 <b>2026-06-21 下午 rerun2</b> 的 6 工具完整轮。<b>耗时为各 subagent 自报、不可跨宿主与 Claude 轮直接比</b>(如 DevTools MCP 5min 是自报值非真实墙钟)。这轮另抓到 output token(总量 95%+ 为缓存输入、很便宜，真实生成量看 output)：@chrome 44.7k · @browser 40.9k · agent-browser 49.3k · bb-browser 37.6k；devtools-mcp / playwright-cli 本轮 output 未采全。bb-browser 标 <code>9223*</code> 因 daemon status drift。原始数据 <code>results/unified-9223-2026-06-21-6tools-rerun2/</code>。</div>
</figure>

跨宿主交叉印证 + 关键差异（这才是放两张表的意义）：

- **结论一致**：agent-browser / DevTools MCP / playwright-cli 三家在两个宿主都接近满格、零或极少 ❌（Codex 轮 agent-browser 拿到 30✅）；bb-browser 两边都垫底（Codex rerun2 5❌+4⚠️ / Claude R2 2❌+1⚠️，且都靠大量 eval/CDP 逃生）；`@chrome` / `@browser`（只有 Codex 能测）受扩展安全域 + 默认 Profile 限制，大量任务记 **N-R**（rerun2：@chrome 12 N-R、@browser 14 N-R），`@browser` 的逃生高达 **31~104 次**——几乎全是只读 eval 提取（in-app browser 只能这么取数，不是 raw CDP 能力）。
- **差异①（重要）**：playwright-cli 在 **Codex 轮能 attach 9223**（用唯一 URL 在 `/json/list` 证明命中，rerun2 拿到 28✅/1⚠️/1❌），而 Claude 轮 attach 装扩展的 9223/9224 崩、改自管浏览器。这坐实"能否 attach 装了扩展的 CDP 浏览器不是稳定结论"，跟环境/扩展集/工具版本有关（与前文 T10c 单题 attach 成功一致）——别把"playwright-cli 接不进 9223"当成铁律。
- **差异②（耗时不可跨宿主比）**：Codex 轮 DevTools MCP 自报 **5.0 min**，和 Claude 轮 ~24min 差得离谱，几乎肯定是两个宿主的计时/记账口径不同（Codex 的"耗时"是 subagent 自报，非真实墙钟），**不能解读成"DevTools MCP 快 5 倍"**——token/耗时只在同一宿主内可比，跨宿主只看趋势。
- **token 口径**：Codex rerun2 的总 token 看着上千万，其实 **95%+ 是缓存输入**(便宜)，真实生成量看 output(37k–49k)；Claude 轮 harness 只给单一 token 总量(未拆 in/out)。两边 token 都别直接折算成同一个 $。

Codex 轮原始数据见 `results/unified-9223-2026-06-21-6tools-rerun2/`（下午 rerun2，含 token）。

#### 成本 × 能力 × 速度：只装一款选谁

把三轴一起看（**速度只用 Claude 同宿主可比的两轮**；Codex 耗时是 subagent 自报、跨宿主不可比，不参与排速度）：

- **速度**：agent-browser / DevTools MCP / playwright-cli 三家挤在 **~24.6–26.1 min**，彼此差 ~1.5 min（落在轮次噪声里）、**实质平手**；真正慢的只有 bb-browser（**~45 min ≈ 1.8×**）。
- **token**：agent-browser **最省（~198k）**，DevTools MCP **最贵（~325k ≈ 1.6×）**，两者做的是同样多的活——这是三轴里**唯一拉得开差距**的一项。
- **能力**：agent-browser 与 DevTools MCP 并列最强；agent-browser 还独占运行时 route + HAR + 扩展 options + 可移植登录态。

速度既是平手，决定权就落在 **token + 能力**——两者都指向 agent-browser。

<div class="bv-pick" style="margin:1.4rem 0;padding:.9rem 1.1rem;border-left:4px solid #4f7233;background:var(--paper-soft,#faf6ec);border-radius:.5rem;font-size:.92rem;line-height:1.65">
<b>只装一款 → agent-browser。</b> 三轴里它：能力第一梯队、token 最省（≈ DevTools MCP 的 60%）、速度与最快者打平——等于<b>花最少的 token、用差不多的时间，把最全的活干了</b>。代价是一次性的 <code>--cdp</code> daemon 接入坑（先 <code>close --all</code> 复位一次，见 7.2）+ 少数任务掉 eval 兜底。<br>
<b style="color:#8f2d20">唯一例外</b>：如果你的活<b>纯粹是前端调试</b>（perf / Console / source map / 网络面板）、追求最稳零逃生、<b>且不在乎 token</b> → 选 <b>Chrome DevTools MCP</b>（快一丢丢、最稳，但每轮多烧 ≈60% token、且没有运行时 route）。按具体任务场景细分见下面第 2 节。
</div>

T09/T10/T11 把战场从 localhost 网页挪到真实登录态与扩展安全域，其中涉及真实登录态的几格由两轮互相独立的隔离子 Agent 实测（一轮 Claude Code 主控、一轮 Codex），结论一致，差异只在评分口径（详见 4.7）。2026-06-20 又追加了 T10c，专门测“工具能否绑定用户指定的现成 9223 profile”，避免把默认 profile、自管 state 和指定 CDP profile 混成一个概念。

关键前置（影响上表 T09/T10/T11 怎么读）：目标机器的系统默认 Chrome（CDP 9223）是**企业管控**的，会在运行时拦截"加载已解压扩展"（扩展自身 `chrome-extension://` 资源返回 `ERR_BLOCKED_BY_CLIENT`、content script 不注入），所以 T09/T11 的扩展宿主改用一台**干净的 Chrome for Testing**（`--disable-features=DisableLoadExtensionCommandLineSwitch --load-extension` 才能让 137+ 真正加载扩展）；T10a/T10c 仍在企业 9223 上测真实登录态。GitHub 未读数是动态字段：早期 T10a 读到 **68**，T10c 运行时从 **70** 变为 **71**。

T12–T20 是 2026-06-19 追加的"前端开发者专项"。本轮每个工具一个独立子 Agent，实际靶场跑在 `http://localhost:4400/`（任务卡里的 `4399` 是旧端口；当时 4399 已被占用）。这一组不再只测"能不能点页面"，而是测前端排障里最常见的九类证据链：Console + sourcemap、移动端遮挡、hydration、SSE、Service Worker、跨源 iframe、文件上传、键盘可访问性和 flake 统计。

读者指出这一版仍然偏"靶场"之后，我又把真实网站外场任务补成 R01-R09，并直接合进上面这张总表。**这组是真实网站**：动态字段（GitHub 未读数、npm 版本、资源耗时等）会变，所以每格都带了观察时间、最终 URL、profile 和证据（详见第 3 节）。`N-R` 在这里表示运行时不可用或该能力未暴露，不等于网站本身失败；`✅*` 表示用 URL block 或启动参数证明了网络层阻断，但不是运行时 route API。

上表主体为 2026-06-19/20 Codex 单轮；`@chrome（开权限）`列是 2026-06-20 对系统默认 Chrome Profile 的追加复测，不再使用 9223；`@chrome（无完整 CDP）`列是 2026-06-21 在同一默认 Profile 上关闭完整 CDP 后的复测。无完整 CDP 时，`@chrome` 不再是 9/9 N-R：页面级操作、默认 Profile 登录态、Shadow DOM、iframe、SSE、GitHub/MDN/npm 阅读都能做；缺的是 Network body、Performance timing、route/mock、viewport、file upload、特权页和 9223 绑定。开完整 CDP 后，Network body、Runtime fetch、Performance timing、文件上传等能力明显放开；用户手动把 Bench Badge 装进默认 Profile 后，R06 至少能证明真实线上文章出现 `BENCH EXT v1.0.0`，但 `chrome-extension://.../options.html` 仍被 URL policy 拦住，所以不能把徽标改成 `REAL-SITE-2026`，只能记 ⚠️。2026-06-20 我又用 Claude Code 主控、每工具一个干净 Subagent，把外场 R01-R09 和靶场 T01-T20 **各独立复跑两轮**收方差：**agent-browser R06 两轮实测都是 ✅**（上表那笔 ⚠️ 只是 Codex Subagent 观察漏判）、playwright-cli 在外场 attach 9223 两轮确定性崩溃、动态字段两轮吻合（GitHub 未读 70 等），两轮明细见第 3 节"两轮独立复跑校准"。注意这不等于 playwright-cli 永远接不进 9223：T10c 单题用 `attach --cdp=http://127.0.0.1:9223` 已经成功。外场没有推翻推荐，反而更强化了"前端开发者首选 DevTools MCP"这个结论。

### 2. 选型路由：按任务场景反推工具

没人会把六个工具都装上。大多数人——尤其是前端开发者——只需要一个**综合最顺手、又能复用真实登录态**的工具。把"复用真实登录态"定成硬前提（你登录过的 GitHub、内网、自己在调的应用，Agent 要能直接接着用），候选会先分成两档：DevTools MCP、agent-browser、bb-browser 这三类能在本轮接到 9223 或受管持久 profile；playwright-cli 在 T10c 单题里也能 `attach --cdp` 复用 9223，但外场轮在带多扩展的真实 profile 上触发过 service worker target 断言，稳定性还没达到“真实 profile 主工具”的级别；@browser 不继承真实登录态；`@chrome（开权限）` 已经能通过默认 Chrome Profile 做大量 CDP 观察，但 T10c 仍证明不了它落在用户指定的 9223。agent-browser 在严格 `connect 9223` + `get cdp-url` 复核后可以稳定跑一轮真实外场，所以它不该被简单排除；但如果只能给前端开发者推荐**一款**，我仍然选 **Chrome DevTools MCP**。后续追加的前端专项、真实网站外场、`@chrome` 开权限复测与 T10c 没有推翻这个结论，反而把理由补强了：前端排障最常见的 console、source map、Service Worker、iframe、file input、键盘可访问性、真实 Network body、扩展 options、指定 profile 和性能 trace，DevTools MCP 都能拿到证据。

在这些候选里，**前端开发者首选 Chrome DevTools MCP**。

**为什么是它**：它本质就是"把你天天用的 F12 调试流程包成了一个 Agent 工具"——

- **Network 拿得到响应体**：状态码、响应体留底、事后可查，排接口问题和你在 Network 面板里干的事一模一样；
- **性能诊断直出结论**（全场最省解释成本）：`performance_analyze_insight` 直接给"LCP 2.1s、主因阻塞 CSS"这种 DevTools 原生诊断，不用自己读 trace；
- **够得到扩展特权页**：`chrome://extensions`、`options.html` 都能操作；
- **`--browserUrl` 直连你的真实 Chrome**：免登录接管你已登录的会话；
- **前端排障证据链基本全覆盖**：console/source map、hydration、SSE、SW、iframe、file input、键盘可访问性和 flake 统计都能落证据；
- 综合表现领先、操作数全场最少——对已经熟悉 DevTools 心智模型的前端，几乎零学习成本（每一项对应的逐格判定见第 1 节总表）。

**为什么不是另外两个常见候选**：

- **@chrome**：要分清“bridge 可用但无完整 CDP”和“开完整 CDP”。无完整 CDP 时它已经不是不可用：默认 Profile 登录态、页面点击、DOM/Shadow/iframe、SSE、GitHub/MDN/npm 阅读都能跑；但 Network body、Runtime fetch、Performance timing、viewport、file upload、route/mock 都缺。开完整 CDP 后，T02/T03/T07/T18 等会翻盘，但三条硬边界还在：不能证明绑定用户指定的 9223 profile，不能进入 `chrome://extensions` / `chrome-extension://.../options.html`，也没有可靠 route/mock API。对前端排障来说，它是默认 Profile 的轻量观察器，但还不是完整 F12。
- **agent-browser**：这轮真实网站跑得很好，是我会保留的 CLI 备选；但它更像自动化工具，需要自己守住 `--cdp 9223` 连接、route/HAR/状态清理这些工程细节，性能解释和 DevTools 面板式诊断不如 MCP 直观。
- **bb-browser**：能用 `--port` 读真实登录态，但 0.14.2 的 click 事件注入有 bug、又到不了 `chrome://` / `chrome-extension://` 特权页，通用操作得频繁靠 eval 兜底，不够稳。

> playwright-cli 的纯自动化能力仍然最稳（综合通过率最高、几乎零 eval 自救）。T10c 证明它可以 attach 到 9223 并读到登录态；但外场 R01-R09 里它在带多扩展的真实 profile 上 attach 崩过，两轮复现，所以我不会把它当“真实 profile 排障”的首选。如果你主要做自启浏览器的自动化或回归测试，它才是首选。

**装它之前要知道的四个短板**：

- **不能 mock / 拦截网络**（只能在 JS 层打补丁）：要改写、拦截、abort 流量，得另配 playwright-cli 或 agent-browser；
- **复杂诊断会滑向 `evaluate_script`**：移动端遮挡、SW 绕行、文件 input 状态这类问题，它能查清楚，但经常需要像人打开 Console 一样写脚本；
- **持久化绑 userDataDir、不可移植**（换目录/换机就丢）：跨机器免登录不是它的强项；
- **接入成本高于纯 CLI**：要连对 Chrome、CDP 端口、profile 和 MCP server，profile 漂移会让评测结果变得不可比。

**实操姿势**：别让它接管你的日常主 Chrome（Agent 和你抢同一个 profile 会抢焦点、误改账号状态，见第 5 节），而是开一个**专用调试 profile**、用 `--browserUrl` 连它的 CDP 端口——这才是"复用真实登录态"又不打扰自己的最稳做法。

如果你的需求确实超出"驱动真实登录的浏览器 + 像 F12 一样调试"，再按下表补第二个工具：

| 额外需求 | 加装 | 为什么 |
| --- | --- | --- |
| mock / 拦截 / 改写流量 | agent-browser 或 playwright-cli | 唯二真正的网络层 route |
| 跨机器 / 跨目录免登录 | agent-browser 或 playwright-cli | 可移植 state 文件，跨目录跨实例都能恢复 |
| 把固定网站封成稳定命令 | bb-browser site adapter | 适配器复用页面登录态与前端逻辑 |
| 纯自启浏览器的长期回归测试 | Playwright（库） | 成熟的测试基建 |

## 二、测试过程：怎么测出来的、逐格为什么

### 3. 实测方法：基准测试站与任务设计

本地零依赖的基准测试站，每页埋一个已知答案的坑。固定靶场负责可复现：网站不会变、登录态可控、标准答案能机械核对。真实网站负责外场真实性：它能暴露站点改版、登录态差异、Chrome Web Store 限制、真实 Network 波动、扩展注入线上页面这些靶场刻意压掉的变量。两者维度不同，但既然是同一时刻、同一批工具跑的一次快照，就合进第 1 节同一张结果总表——代价是动态网站那几列的绝对值带时间戳、换时间复跑要重测，同一轮内仍可横比。

| 任务 | 坑 | 标准答案 | 考的理论维度 |
| --- | --- | --- | --- |
| T01 登录与观察 | 欢迎语由 /api/me 异步渲染 | 工号 BENCH-7341 | 快照质量、观察时机 |
| T02 Network 排障 | 下单接口固定 500，页面文案笼统 | INSUFFICIENT_INVENTORY / SKU-8821 | **CDP Network 层留底** |
| T03 性能诊断 | CSS 延迟 1.2s + 800ms 长任务 + 图延迟 1.5s | 阻塞 CSS 是 LCP 主因（见 4.3） | **DevTools 诊断模型** |
| T04 请求 mock | 成员接口真实返回 18 人 | mock 空列表 → 空状态截图 | **CDP 拦截层** |
| T05 动态等待 | 流式渲染 + 延迟出现的按钮 | 12 条 / LIVE-512 | 等待策略、动作可靠性 |
| T06 结构化提取 | 脏 DOM + 千分位 + 分页 | 12 件、最贵雷霆工作站 15999 | 阅读成本、字段清洗 |
| T07 已登录 fetch | /api/me 仅带 cookie 可访问 | plan = team-pro-2026 | **页面 Runtime 可写性** |
| T08 Shadow DOM | open shadow 里的按钮和兑换码 | SHADOW-99 | 快照穿透、事件注入 |
| T09 扩展 reload | 加载本地解压扩展，需进 `chrome://extensions` 重新加载 | 扩展 reload 成功、特权页可达 | **特权页可达性 / 安全策略** |
| T10 真实登录态与持久化 | GitHub 通知页需真实登录态，并拆成默认 profile、自管持久化、指定 9223 三条路线 | 免登录读到当次未读数；专用 profile 可移植恢复；指定 9223 必须命中 target | **复用真实 profile / 跨会话持久化 / 指定 CDP profile** |
| T11 用扩展（设置页改徽标） | 需进 `chrome-extension://…/options.html` 改设置 | 在扩展设置页成功改掉徽标 | **特权页操作 / 产品封装范围** |
| T12 Console 与 Source Map | bundle 报错，真实源码藏在 sourcemap | `coupon.ts` / `applySelectedCoupon` / 空值 guard | **Console + Source Map 取证** |
| T13 移动端布局遮挡 | 移动端底部帮助条覆盖支付按钮 | `.mobile-support-bar` 覆盖，确认码 `MOBILE-39` | **viewport / hit-test / CSS 诊断** |
| T14 SPA Hydration 不一致 | SSR 状态与客户端接管状态不一致 | `TaskSummary`，`HYD-908`，8→9 / starter→team-pro | **Console 结构化对象 + 页面状态** |
| T15 SSE 实时流等待 | EventSource 分批推送，不能提前读结果 | 5 条，最后 `evt-005`，告警 `STREAM-721` | **实时流等待 / 完成态判断** |
| T16 Service Worker 缓存 | SW 拦截接口，页面看到旧配置 | 旧值 blue/cached，live 值 green/live | **SW 控制面 / Network bypass** |
| T17 跨域 iframe 授权 | 父页 localhost，子 iframe 127.0.0.1 | `iframe-user@bench.dev / OAUTH-314` | **跨源 iframe 操作** |
| T18 文件上传输入 | 标准 file input 需要真实本地文件 | `upload-token.txt`，36 bytes，`UPLOAD-448` | **file chooser / upload 能力** |
| T19 键盘可访问性 | 看似按钮，键盘不可达 | `div role=button` 缺 `tabindex` 和键盘 handler | **键盘遍历 / a11y DOM 诊断** |
| T20 回归稳定性 | 10 次检查里固定 3 次失败 | 7/10，通过率 70%，失败轮次 3/6/9 | **重复执行 / flake 率统计** |

加粗的几道是按 6.2 的边界公式设计的"分界题"——它们恰好把六个工具分成了几个阵营。

真实网站外场任务放在 `tasks-real/`，结果与 T01-T20 一起并进第 1 节同一张结果总表（动态字段带时间戳）：

| 任务 | 真实网站 | 重点 |
| --- | --- | --- |
| R01 GitHub 公共仓库代码导航 | GitHub | 真实 SPA、代码导航、站内搜索 |
| R02 GitHub 真实登录态只读通知 | GitHub notifications | 真实 profile、只读账号状态 |
| R03 MDN 文档结构化阅读 | MDN | 文档搜索、结构化提取 |
| R04 npm 包页面元数据 | npm | 动态元数据、页面证据 |
| R05 Chrome Web Store 扩展详情 | Chrome Web Store | 插件生态真实页面，只读扩展信息 |
| R06 扩展注入真实网站 | 线上 Garden Lab 文章 | content script、options 页、真实页面注入 |
| R07 真实网站 Network 响应体 | npm | 请求列表、响应体、页面与 JSON 交叉验证 |
| R08 真实网站请求拦截 | MDN | route / abort / mock、资源降级验证 |
| R09 真实网站 HAR 与性能快照 | 线上 Garden Lab 文章 | HAR / trace / 性能瀑布图 |

这组任务的答案不能像 T01-T20 那样全部写死：GitHub 通知数、npm 当前版本、Chrome Web Store 按钮文案、资源耗时都会变。任务卡里写的是"答案生成规则"：必须记录观察时间、最终 URL、profile、工具版本和截图 / Network / trace 证据；任何会写真实网站状态的动作都直接判失败。

这轮外场的实际结果矩阵已与 T01-T20 并列放在[第 1 节结果总表](#1-结果总表)，此处不再重复。`N-R` 表示运行时不可用或该能力未暴露，不等于网站本身失败；`✅*` 表示 DevTools MCP 用 daemon 启动参数阻断指定资源，能证明网络层阻断，但不是运行时 route API。

几条关键解释：早期 @chrome 在 R01-R09 轮曾因 Codex Chrome Extension 在 selected profile 里 disabled 被记成 N-R；2026-06-21 复测证明，这不是“无完整 CDP 权限”的真实上限。bridge 可用但无完整 CDP 时，@chrome 的 R01/R02/R03/R04 可跑，R06 能验证 content script 注入，真正过不去的是 Web Store 特殊页、Network response body、route/HAR 和扩展 options。T10c 再测时 plugin 已可连，但它打开的唯一 URL 没有出现在 9223 target 列表，所以仍不能算“指定 9223 profile”成功。@browser 是 in-app browser，不能绑定 9223，所以登录态、扩展、Network body、route/HAR 都不能算通过；playwright-cli 在 R01-R09 按约束不能自启浏览器，attach 9223 又被现有扩展 service worker target 断言打断，但 T10c 单题 attach 9223 成功。agent-browser 的 R06 记 ⚠️：它写扩展 options 和线上页面注入实际成功，主控复核 DOM 为 `REAL-SITE-2026 · v1.0.0`，但该 Subagent 自己观察漏判。

#### R01-R09 与 T01-T20 的两轮独立复跑（2026-06-20 校准）

第 1 节那两张结果总表（T01-T20 与 R01-R09）都只跑了一轮（agent-browser 同日两轮）。"下一步"里那条"重复轮次收方差"已经补上：2026-06-20 我用 **Claude Code 主控、每工具一个干净 Subagent、顺序复用同一台 9223 测试 Chrome**（playwright-cli 在这轮因 attach 装了扩展的 9223 必崩、改用自管浏览器），把外场 R01-R09 和靶场 T01-T20 **各独立跑了两轮**专门收方差。这轮只比四个真实 CLI/MCP 工具（Codex 专属 `@chrome`/`@browser` 无等价物，未纳入），与同日 Codex 轮互不参考。

**外场 R01-R09（×2 轮，全 9223）：**

| 工具 | 第1轮 | 第2轮 | 关键校准 |
| --- | --- | --- | --- |
| agent-browser | 9✅ | 9✅ | **R06 两轮实测都是 ✅（非上表 ⚠️）**——经 options UI 改徽标并在真实页验证 `REAL-SITE-2026 · v1.0.0`，坐实上表那笔 ⚠️ 只是 Codex Subagent 观察漏判 |
| chrome-devtools-mcp | 8✅+1 N-R | 8✅+1⚠️* | **R08 无运行时 route**：这轮 gh server 已在运行、用不上 daemon 的 `--blockedUrlPattern` 启动入口，只能 JS 层降级 → 判 N-R/⚠️*，比上表 ✅*（启动级阻断）更严，但方向一致——它没有运行时拦截 API |
| bb-browser | 7✅+1⚠️+1 N-R | 7✅+1❌+1 N-R | R06 在 ⚠️↔❌ 间抖动（chrome-extension URL 改写 bug 这轮够不着逃生通道）；R08 无 route 原语稳定 N-R |
| playwright-cli | 9 N-R | 9 N-R | 两轮稳定复现 `connectOverCDP` 撞扩展 `service_worker` target 断言、连接建不起来 |

**靶场 T01-T20（21 卡含 T10a/b，×2 轮，混合浏览器）：**

| 工具 | 第1轮 | 第2轮 |
| --- | --- | --- |
| chrome-devtools-mcp | 21✅（零逃生） | 20✅+1⚠️(T10b) |
| agent-browser | 20✅+1⚠️(T10b) | 21✅ |
| playwright-cli | 20✅+1 N-R(T10a) | 18✅+1⚠️(T09)+2 N-R(T10a/b) |
| bb-browser | 16✅+4❌(T04/T09/T11/T17)+1 N-R | 14✅+4❌+3⚠️ |

**一致性**：外场 36 格里 34 格两轮一致；靶场 84 格里 77 格一致（91.7%）、**0 格事实错误**，7 处抖动全落在 T09/T10b/T13/T18 这类"逃生能否兜底 / 持久化口径 / unpacked reload flake"的边界格。所有动态字段两轮完全吻合，可作为这一时点的权威观测：GitHub 未读 **70**、npm `@playwright/test` **v1.61.0** / 周下载 **42,613,659** / Apache-2.0、React DevTools 评分 **4.0（1,633）** / **5,000,000** 用户、靶场标准答案（BENCH-7341 / SKU-8821 / hero.svg / 雷霆工作站 15999 / SHADOW-99 / STREAM-721 / CACHE-BUST-42 / OAUTH-314 / FLAKE-307 等）全部答对。

**一个必须记录的环境坑**：靶场第 1 轮里 T15/T16/T17/T20 四工具集体失败，根因是**环境而非工具**——运行中的靶场服务进程是更早启动的旧版本、缺后来才加的 `/api/realtime-events`·`/api/settings`·`/api/flake-check` 路由（404）；且 T17 跨域 iframe 子页走的 `127.0.0.1:4399` 被另一个本机服务占用。重启 `server.mjs`、把占端口的服务迁走之后四题重跑：T15/T16/T20 四工具全 ✅，T17 三工具 ✅、bb-browser ❌（缺跨域 OOPIF 切换/坐标点击，是真实工具短板）。这条提醒任何复现者：**跑靶场前先确认服务是当前版本、4399 没被别的进程抢**。

**结论没变，只是更扎实**：两轮下来，**chrome-devtools-mcp 仍是最稳、零逃生的前端排障首选**（靶场两轮 21✅/20✅、外场只差一个运行时 route）；**agent-browser 是能力最全的全能选手**——若抛开 7.2 那个粘滞 daemon 的 `--cdp` 可靠性硬伤，它在"运行时 route + HAR + 扩展 options + 专用 profile 持久化"上的覆盖面其实是四家里最广的，是最接近"一个工具全包"的候选；**playwright-cli 自管浏览器、CI 友好，T10c 能 attach 9223，但多扩展真实 profile 外场 attach 仍不稳**；**bb-browser 读取类够快，但 mock / 扩展设置页 / 跨域 iframe / 网络拦截四类硬短板叠加 URL 归一化 bug，仍是修一处能改命、但当前最弱的一个**。

正式数据全部来自独立会话：每个单元格（任务 × 工具）由一个全新上下文、既不知道答案也不知道工具已知 bug 的无偏 Agent 执行（Claude Code 无头 `claude -p` 进程或 Codex 隔离子 Agent），提示词只含任务原文、工具限定与约 25 次操作止损线，禁止 curl/读源码旁路，单元格之间重启基准测试站清状态——这样测到的是真实用户要付的成本，而非熟练者的最优解。每个单元格记录判定（✅/⚠️/❌ 按任务卡标准）、操作数、轮数、耗时、成本，以及 **eval 自救次数**（Agent 被迫弃用工具原语、改用 eval 直接执行 JS 才能推进的次数，见 5.2）。需如实声明的局限：第一批单元格基本只跑一次，后续又用 Claude 独立轮对 R01-R09 和 T01-T20 收过一次方差；@chrome/@browser 跑在 Codex 宿主内，时间/调用数只能粗比，但**能力判定不受宿主影响**；固定基准测试站全在 localhost，版本钉死见附录；R01-R09 外场只代表 2026-06-19/20 这一次真实网站状态，本文只把它作为同一快照的单独分栏并入总览，不拿动态答案和靶场静态答案互相替代。

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
- **agent-browser ✅†**：复位 daemon 后能进 chrome://extensions、reload、开 options 页（扩展 ID 走 shadow DOM 的 eval 穿透拿到）——能力存在，但被 `--cdp` 可靠性问题拖累（见下与 7.2）。
- **bb-browser ❌/⚠️**：致命短板暴露无遗——`open`/`goto` 给 `chrome://`、`chrome-extension://` 无脑加 `https://` 前缀并把 `://` 折叠（`chrome://extensions/` → `https://chrome//extensions/` → chrome-error），**自身根本到不了任何特权页**。T11 只能靠外部 CDP 强开 options 页 target 才让 bb-browser 能 fill/click（记 ⚠️）；T09 退用页面内 `chrome.runtime.reload()` 反而把 unpacked 扩展弄成失效态（记 ❌）。继 4.6 的 click bug 之后，这是它第二处"协议层够得着、产品封装却把路堵死"。
- **@chrome / @browser ❌**：和 4.5 同源的**安全策略**因素——Browser Use 的 URL policy 直接拦住 `chrome://` 与 `chrome-extension://`。开权限后的 @chrome 变强的是页面 Runtime / Network 观察面，不是扩展管理面；即使用户手动把 Bench Badge 装进默认 Profile，它也只能在本地页和真实线上页验证 `BENCH EXT v1.0.0` 的 content script 注入，仍没有 reload/options 通道。它们本身就是扩展，却被产品的封装边界挡在扩展管理之外。

**这里还埋着一个比工具更硬的环境坑：企业管控 Chrome 会让"装了等于没装"。** 目标机器的系统 Chrome 受企业策略管控，把"加载已解压扩展"在运行时拦死——扩展能出现在列表里、显示已启用，但 content script 不注入、扩展自身资源 `ERR_BLOCKED_BY_CLIENT`。这意味着任何"复用你真实 profile 跑扩展"的方案在这类机器上直接失效，扩展测试只能改用干净的 Chrome for Testing（且 137+ 还要 `--disable-features=DisableLoadExtensionCommandLineSwitch` 才认 `--load-extension`，CDP 的 `Extensions.loadUnpacked` 只进注册表、不激活 content script）。这条对"在公司电脑上用 Agent 操作扩展"的现实预期是一盆冷水。

**T10a 真实登录态：@chrome 的主场，但它不再孤独。** 这一格的实情是：

- **能读真实登录态的**：`@chrome`、`bb-browser --port 9223`、`DevTools MCP --browserUrl 9223`——都免登录直达 GitHub 通知页。早期 T10a 读到同一个 68 条；开权限后的 @chrome 默认 Profile 复测读到 70 条。@chrome 在它**唯一的主场任务**上确实零打断（扩展安全域天然在真实 profile 内），但默认 Profile 登录态不等于 T10c 要求的“指定 9223 profile”。
- **读不到的**：`@browser`（in-app 浏览器不继承真实登录态）；`playwright-cli` 在这轮 T10a/R01-R09 约束下失败（强行 attach 企业 9223 时枚举到企业扩展的 `service_worker` target，触发 playwright-core 内部断言、daemon 直接崩）。但这不是“永远不能 attach 9223”的结论，后面的 T10c 单题已经证明 `attach --cdp=http://127.0.0.1:9223` 可以成功。
- **能但不可靠的 agent-browser †**：这是这一组里最意外的一格。`--cdp 9223` 看似连上了，实际动作经常**静默落到 agent-browser 自起的托管浏览器**（一个没有你登录态的空白 headless Chrome）；`get url` 还返回 github，像成功，实则没碰你的真身。两轮独立实测都撞到：Codex 据此判 ❌（坚持"开箱即用必须命中 9223"），主控这轮先 `close --all` + 杀掉托管实例复位，才真连上 9223、读到 68（判 ✅）。**同一个 bug，两种评分口径**——根因都是 7.2 那个粘滞 daemon。

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

这组补测把第 2 节的推荐从"理论上更像 F12"变成了"实测九个前端专项仍然第一"：**DevTools MCP 是前端排障首选；playwright-cli 是自动化回归首选；agent-browser 是真实 profile 流程操作的补充；开权限后的 @chrome 是默认 Profile 里的轻量 CDP 观察器，但仍缺扩展特权页、指定 9223 证明和可靠 route/mock。**

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
<div class="bl-band" style="--d:0"><div class="bl-top"><div class="bl-pinfo"><b>网页内容</b><small>DOM · 页面 runtime · 输入 · shadow DOM · a11y 快照 · 页内 fetch</small></div><div class="bl-pills"><span class="bl-p bl-cond" title="@chrome：有条件">chr<sup>~</sup></span><span class="bl-p bl-cond" title="@browser：有条件">brw<sup>~</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-full" title="bb-browser：完整">bb<sup>✓</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 4 · 受限 2 · 无 0</span>六家公共底座，全员能读能点；无完整 CDP 的 @chrome/@browser runtime 只读，连 fetch 都没有</div></div><div class="bl-band" style="--d:1"><div class="bl-top"><div class="bl-pinfo"><b>前台 tab / 窗口 / popup</b><small>多 tab · 新窗口 · window.open 弹出窗（如 OAuth 登录窗）</small></div><div class="bl-pills"><span class="bl-p bl-full" title="@chrome：完整">chr<sup>✓</sup></span><span class="bl-p bl-cond" title="@browser：有条件">brw<sup>~</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-full" title="bb-browser：完整">bb<sup>✓</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 5 · 受限 1 · 无 0</span>基线能力、没区分度；@browser 是 in-app webview，独立窗口/popup 不如其余顺手</div></div><div class="bl-band" style="--d:2"><div class="bl-top"><div class="bl-pinfo"><b>后台 target</b><small>扩展 service worker / background page——不在任何 tab 里的后台 JS</small></div><div class="bl-pills"><span class="bl-p bl-none" title="@chrome：够不着">chr<sup>✕</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-none" title="bb-browser：够不着">bb<sup>✕</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-cond" title="playwright-cli：有条件">pw<sup>~</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 2 · 受限 1 · 无 3</span>只有自管浏览器够得到（走 CDP Target 域）；pw 一旦 attach 企业 Chrome，枚举到扩展 service_worker 反而触发断言崩</div></div><div class="bl-band" style="--d:3"><div class="bl-top"><div class="bl-pinfo"><b>扩展 + 特权页</b><small>扩展本体 · chrome://extensions · chrome-extension://…/options.html</small></div><div class="bl-pills"><span class="bl-p bl-none" title="@chrome：够不着">chr<sup>✕</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-cond" title="agent-browser：有条件">ab<sup>~</sup></span><span class="bl-p bl-none" title="bb-browser：够不着">bb<sup>✕</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 2 · 受限 1 · 无 3</span>真分水岭是能否到特权页；bb 把特权页 URL 归一化堵死，@chrome 被 URL 策略拦，agent-browser 需先复位 daemon（†）</div></div><div class="bl-band" style="--d:4"><div class="bl-top"><div class="bl-pinfo"><b>身份 / 档案</b><small>登录态 cookie · 书签 · 历史 · 保存的密码 / 证书</small></div><div class="bl-pills"><span class="bl-p bl-full" title="@chrome：完整">chr<sup>✓</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-cond" title="agent-browser：有条件">ab<sup>~</sup></span><span class="bl-p bl-full" title="bb-browser：完整">bb<sup>✓</sup></span><span class="bl-p bl-full" title="DevTools MCP：完整">MCP<sup>✓</sup></span><span class="bl-p bl-cond" title="playwright-cli：有条件">pw<sup>~</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 3 · 受限 2 · 无 1</span>@browser 接不进系统默认 Chrome；默认 profile 远程调试 Chrome 136+ 收紧；pw 在多扩展真实 profile 上 attach 仍不稳</div></div><div class="bl-band" style="--d:5"><div class="bl-top"><div class="bl-pinfo"><b>跨会话持久化</b><small>把身份存下来、搬到别处、恢复（可移植 state vs 绑定 userDataDir）</small></div><div class="bl-pills"><span class="bl-p bl-cond" title="@chrome：有条件">chr<sup>~</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-none" title="bb-browser：够不着">bb<sup>✕</sup></span><span class="bl-p bl-cond" title="DevTools MCP：有条件">MCP<sup>~</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 2 · 受限 2 · 无 2</span>可移植 state 文件（agent-browser / playwright-cli）完胜；DevTools MCP 绑 userDataDir 换目录就丢，bb 无 save/load</div></div><div class="bl-band" style="--d:6"><div class="bl-top"><div class="bl-pinfo"><b>调试与诊断</b><small>读：Network 响应体 · console · performance/trace　写：拦截 / mock / abort</small></div><div class="bl-pills"><span class="bl-p bl-cond" title="@chrome：有条件">chr<sup>~</sup></span><span class="bl-p bl-none" title="@browser：够不着">brw<sup>✕</sup></span><span class="bl-p bl-full" title="agent-browser：完整">ab<sup>✓</sup></span><span class="bl-p bl-cond" title="bb-browser：有条件">bb<sup>~</sup></span><span class="bl-p bl-cond" title="DevTools MCP：有条件">MCP<sup>~</sup></span><span class="bl-p bl-full" title="playwright-cli：完整">pw<sup>✓</sup></span></div></div><div class="bl-note"><span class="bl-cnt">完整 2 · 受限 3 · 无 1</span>读靠 CDP（开权限 @chrome 也能读 body/timing）；写（网络层 route）只有 agent-browser、playwright-cli；MCP/bb 只能 JS 层打补丁</div></div>
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

## 下一步

- 扩展与真实 profile 那几道（T09–T11，加上 T10c 指定 9223）受环境影响最大（企业管控 Chrome），值得在更多机器上复测取证；它们也确认了 agent-browser 0.27.2 有常驻 daemon。
- 增加每个单元格重复次数收方差；引入弱一档模型验证 5.1 的预言。
- T12–T20 这组前端专项已经覆盖了主要调试面；真实网站侧 R01-R09 已按每工具独立 Subagent 跑完，T10c 也补了指定 9223 profile。**"重复轮次收方差"已完成**：2026-06-20 Claude 独立轮把外场 R01-R09 与靶场 T01-T20 各又跑两轮（见 1 节"两轮独立复跑校准"），外场 34/36、靶场 84 格 77 稳定、0 事实错误，方差主要落在逃生/持久化边界格。校准结论：agent-browser R06 实为 ✅（上表 ⚠️ 系观察漏判）；bb-browser 特权 URL / route 缺口、跨域 OOPIF 缺失稳定复现；playwright-cli 在外场多扩展 9223 上 attach 崩溃两轮复现，但 T10c 单题 attach 成功——这几条已可作为可复现上游反馈。
- 靶场侧仍可继续补原生 dialog、下载、拖拽、多窗口 OAuth popup、WebSocket 二进制帧；这些应留在可控靶场里，避免真实账号授权和下载状态污染结果。
- 把扩展宿主的搭建本身做成可复现脚本（企业策略检测 → 干净 CfT + 正确 feature flag），因为 T09–T11 里"让扩展真能跑"比测工具本身更费劲。
- 值得上游提 issue：bb-browser 事件注入缺陷 + `chrome://`/`chrome-extension://` URL 归一化把特权页堵死；**agent-browser 粘滞 daemon 致 `--cdp` 静默落到自起托管浏览器**（4.7/7.2）+ 视口外静默点击 + Electron 下 connect 会话失灵；playwright-cli 不验证响应结构就 mock + attach 多扩展真实 Chrome 时 service_worker target 断言崩溃。

## 附录：基准测试站、数据与版本

- 基准测试站与任务卡：`apps/browser-tool-bench/`（零依赖 Node 测试站 + T01-T20 固定任务卡 + `tasks-real/R01-R09` 真实网站外场任务卡 + 复现步骤）
- 原始数据（T01-T08）：`results/formal-2026-06-12/`（ab vs bb）、`results/formal-2026-06-12-mcp/`（ab vs DevTools MCP）、`results/formal-2026-06-12-pw/`（playwright-cli）、`results/codex-plugins-2026-06-12/`（@chrome/@browser，Codex 宿主）
- 原始数据（T09/T10/T11，2026-06-14 两轮独立实测）：`results/formal-2026-06-14-t09-t11-rerun/`（Claude Code 主控，含 4 工具报告 + t10b + 证据 + 环境搭建笔记）、`results/formal-2026-06-14-t09-t11-rerun-fixed-env/`（Codex 主控，含 @chrome/@browser）；两轮结论一致，差异仅评分口径（见 4.7）
- 原始数据（T10c，2026-06-20 指定 9223 profile）：`results/t10c-cdp9223-2026-06-20/`（每工具一个 Codex Subagent，`gpt-5.5` / `xhigh`，顺序复用同一个 9223 测试 Chrome profile）
- 原始数据（T12-T20，2026-06-19 前端专项）：`results/frontdev-2026-06-19-t12-t20/`（每个工具一个 subagent，含六份工具报告与总报告；实际靶场端口为 `4400`）
- 原始数据（R01-R09，2026-06-19/20 真实网站外场）：`results/realworld-2026-06-20-r01-r09/`（每个工具一个 Codex Subagent，`gpt-5.5` / `xhigh`，顺序复用 9223 测试 Chrome profile；动态答案按当次证据判定）
- 原始数据（@chrome 无完整 CDP 默认 Profile 复测，2026-06-21）：`results/chrome-default-profile-no-cdp-rerun-2026-06-21/`（Codex `@chrome` / Chrome extension bridge，系统默认 Profile；关闭完整 CDP 后复测 T01-T20 + R01-R09，修正早期 bridge disabled 导致的大量 N-R）
- 原始数据（@chrome 开权限后默认 Profile 复测，2026-06-20）：`results/chrome-default-profile-rerun-2026-06-20/`（Codex `@chrome` / Chrome extension bridge，系统默认 Profile；T01-T20 排除 T10 的完整复测 + R01-R09 外场复测；手动安装 Bench Badge 后又补验本地页和线上页均出现 `BENCH EXT v1.0.0`，但 options 页仍被 URL policy 拦截）
- 原始数据（2026-06-20 Claude 独立两轮复跑，收方差）：外场 `results/realworld-2026-06-20-claude-r01-r09/` 与 `…-round2/`；靶场 `results/targetrange-2026-06-20-claude-t01-t20-round1/`（含环境修复补丁）与 `…-round2/`；总览 `results/CLAUDE-ROUND-2026-06-20-SUMMARY.md`。每工具一个干净 Subagent、顺序复用 9223（playwright-cli 自管浏览器），与 Codex 轮互不参考
- 原始数据（2026-06-20/21 全量统一成本测 · 两宿主，见 1 节成本表 ①②）：Claude Code 轮 Round 1（9223）`results/unified-2026-06-20-claude-4tools/`、Round 2（9224）`results/unified-9224-2026-06-21-claude-round2/`（各 4 工具 × 30 题，每工具独立 workflow 顺序跑，逐工具耗时/token/操作/eval 自救）；Codex 轮（gpt-5.5/xhigh · 6 工具 × 31 格 · 下午 rerun2 · 含 output token）`results/unified-9223-2026-06-21-6tools-rerun2/`
- 版本：agent-browser 0.27.2 · bb-browser 0.14.2 · chrome-devtools-mcp 1.3.0（早期靶场轮为 1.2.0）· playwright-cli 0.1.14 · Chrome 149（T09/T11 扩展宿主用 Chrome for Testing 149；R01-R09 外场与 T10c 用 9223 测试 Chrome profile）· 模型 claude-fable-5 / claude-opus（T09–T11 轮）/ Codex 宿主 / gpt-5.5（R01-R09 外场与 T10c）
### 参考

- [agent-browser](https://github.com/vercel-labs/agent-browser)
- [bb-browser](https://github.com/epiral/bb-browser)
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [playwright-cli](https://github.com/microsoft/playwright-cli)
- [Playwright actionability checks](https://playwright.dev/docs/actionability)
- [Chrome extensions webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [Chrome DevTools Protocol: Network domain](https://chromedevtools.github.io/devtools-protocol/tot/Network/)
- [Chrome DevTools Protocol: Fetch domain](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/)
- [Chrome remote debugging switches security change](https://developer.chrome.com/blog/remote-debugging-port)
