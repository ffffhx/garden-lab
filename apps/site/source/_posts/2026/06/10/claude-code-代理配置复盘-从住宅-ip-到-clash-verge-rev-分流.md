---
title: "Claude Code 代理配置复盘：从住宅 IP 到 Clash Verge Rev 分流"
date: "2026-06-10 17:54:00"
categories:
  - 技术
tags:
  - Claude Code
  - 代理
  - Clash
  - Mihomo
  - 网络
  - macOS
excerpt: "整理一次从 AWS/VPS、住宅 IP、ISP 代理、HTTP/SOCKS 协议，到 Clash Verge Rev 分流和 Claude Code CLI 环境变量验证的完整配置复盘。重点不是买哪个代理，而是把出口 IP、系统代理、本机端口、规则命中和连接验证这些概念分清楚。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

这次折腾的目标很具体：**只让 Claude / Claude Code 相关访问走一个英国代理出口，其他网站继续直连**。

最后可用的方案是：

1. 购买一个支持 HTTP/HTTPS 的 ISP / residential proxy。
2. 用 Clash Verge Rev 管理配置。
3. 让底层 Mihomo 核心在本机监听 `127.0.0.1:7897`。
4. 在规则里只匹配 `claude.ai`、`claude.com`、`anthropic.com`。
5. 浏览器走 macOS 系统代理，Claude Code CLI 额外通过 `HTTP_PROXY` / `HTTPS_PROXY` 指向本机端口。
6. 用 Clash 连接列表、规则命中、`curl --proxy` 和响应里的边缘节点信息确认流量路径。

这篇不是“买哪个代理最便宜”的推荐，也不包含任何真实代理账号、密码、订单链接。它整理的是这次配置过程中最容易混淆的概念：AWS IP、住宅 IP、ISP、HTTP 代理、SOCKS、本机代理端口、系统代理、CLI 环境变量、`DIRECT`、连接关闭，以及为什么 Clash 首页显示中国 IP 并不代表 Claude 没走英国出口。

<figure class="fz094" data-reveal role="group" aria-label="Claude 代理分流链路示意：浏览器与 Claude Code CLI 经本机代理端口，由 Mihomo 规则分流到英国代理或直连"><style>.fz094{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--green:#4f7233;--green-bg:#e7eedd;--cyan:#3f6d79;--cyan-bg:#dcebed;--cyan-bd:#8fbcc4;--amber:#9a6516;--amber-bg:#f4e8cc;--amber-bd:#d9b66a;--red:#8f2d20;--red-bg:#f1ddd6;--gray:#917f5c;--gray-bg:#ece4d2;--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);margin:0;padding:clamp(16px,3vw,30px);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),var(--paper-deep,#ece5d5));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-sizing:border-box;overflow:hidden}.fz094 *{box-sizing:border-box}.fz094 .ttl{font-size:clamp(19px,2.6vw,26px);font-weight:800;letter-spacing:.5px;margin:0 0 4px}.fz094 .sub{font-size:clamp(12px,1.5vw,14px);color:var(--muted,#6a6155);margin:0 0 clamp(16px,2.5vw,24px);line-height:1.5}.fz094 .flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:clamp(6px,1.4vw,14px)}.fz094 .col{display:flex;flex-direction:column;gap:clamp(12px,2vw,20px)}.fz094 .node{border-radius:12px;padding:clamp(10px,1.6vw,15px) clamp(11px,1.8vw,17px);border:1.5px solid;background:var(--soft2,#f7f1e4);box-shadow:0 6px 16px rgba(16,21,26,.07);position:relative}.fz094 .node b{display:block;font-size:clamp(14px,1.9vw,18px);font-weight:800;letter-spacing:.4px;line-height:1.2}.fz094 .node small{display:block;font-family:var(--mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,13px);margin-top:5px;line-height:1.45}.fz094 .src{background:var(--green-bg,#e7eedd);border-color:var(--green,#4f7233)}.fz094 .src b{color:var(--green,#4f7233)}.fz094 .src small{color:var(--ink-soft,#3c362c)}.fz094 .hub{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-bd,#d9b66a);text-align:left}.fz094 .hub b{color:var(--amber,#9a6516)}.fz094 .hub small{color:var(--ink-soft,#3c362c)}.fz094 .hub .ex{font-family:var(--font-serif-body,"Songti SC",serif);font-size:clamp(10px,1.4vw,12px);color:var(--muted,#6a6155);margin-top:4px}.fz094 .dst-uk{background:var(--cyan-bg,#dcebed);border-color:var(--cyan-bd,#8fbcc4)}.fz094 .dst-uk b{color:var(--cyan,#3f6d79)}.fz094 .dst-uk small{color:var(--cyan,#3f6d79)}.fz094 .dst-dir{background:var(--gray-bg,#ece4d2);border-color:var(--gray,#917f5c)}.fz094 .dst-dir b{color:var(--ink-soft,#3c362c)}.fz094 .dst-dir small{color:var(--muted,#6a6155)}.fz094 .lane{position:relative;height:3px;min-width:26px;border-radius:2px;background:var(--hair,rgba(26,24,21,.18));overflow:visible}.fz094 .lane::after{content:"";position:absolute;right:-1px;top:50%;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid var(--muted,#6a6155);transform:translateY(-50%)}.fz094 .lane .pulse{position:absolute;top:0;left:0;height:100%;width:42%;border-radius:2px;background:linear-gradient(90deg,transparent,var(--c,#9a6516),transparent);animation:fz094run 4.5s ease-in-out infinite}.fz094 .lane.l2 .pulse{animation-delay:1.1s}.fz094 .lane.uk{--c:#3f6d79}.fz094 .lane.uk::after{border-left-color:var(--cyan,#3f6d79)}.fz094 .lane.dir{--c:#917f5c}.fz094 .lane.dir::after{border-left-color:var(--gray,#917f5c)}.fz094 .midcol{display:flex;flex-direction:column;justify-content:center;gap:clamp(34px,8vw,80px);align-items:stretch}.fz094 .dstcol{gap:clamp(18px,3vw,34px)}.fz094 .node.hub::before{content:"";position:absolute;inset:0;border-radius:12px;box-shadow:0 0 0 0 rgba(154,101,22,.35);animation:fz094breathe 8s ease-in-out infinite;pointer-events:none}.fz094 .dst-uk::before{content:"";position:absolute;inset:0;border-radius:12px;box-shadow:0 0 0 0 rgba(63,109,121,.3);animation:fz094breathe 8s ease-in-out infinite;animation-delay:.8s;pointer-events:none}.fz094 .note{margin-top:clamp(16px,2.6vw,24px);display:flex;gap:9px;align-items:flex-start;padding:clamp(10px,1.6vw,14px) clamp(12px,1.8vw,16px);background:var(--red-bg,#f1ddd6);border:1px solid var(--red,#8f2d20);border-left-width:4px;border-radius:8px}.fz094 .note .tag{flex:0 0 auto;font-weight:800;color:var(--red,#8f2d20);font-size:clamp(12px,1.6vw,14px)}.fz094 .note p{margin:0;font-size:clamp(11px,1.5vw,13.5px);line-height:1.55;color:var(--ink-soft,#3c362c)}@keyframes fz094run{0%{left:-42%;opacity:0}18%{opacity:1}82%{opacity:1}100%{left:100%;opacity:0}}@keyframes fz094breathe{0%,100%{box-shadow:0 0 0 0 rgba(154,101,22,0)}50%{box-shadow:0 0 0 5px rgba(154,101,22,.16)}}@media(max-width:560px){.fz094 .flow{grid-template-columns:1fr;gap:10px}.fz094 .lane{height:24px;width:100%;min-width:0;transform:rotate(0)}.fz094 .lane::after{right:50%;top:auto;bottom:-1px;transform:translateX(50%);border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--muted,#6a6155);border-bottom:0}.fz094 .lane.uk::after,.fz094 .lane.dir::after{border-top-color:var(--c,#917f5c);border-left-color:transparent}.fz094 .lane .pulse{width:100%;height:42%;top:auto;left:0;animation:fz094runv 4.5s ease-in-out infinite;background:linear-gradient(180deg,transparent,var(--c,#9a6516),transparent)}.fz094 .midcol,.fz094 .dstcol{gap:14px;justify-content:flex-start}.fz094 .col{flex-direction:column}}@keyframes fz094runv{0%{top:-42%;opacity:0}18%{opacity:1}82%{opacity:1}100%{top:100%;opacity:0}}@media (prefers-reduced-motion:reduce){.fz094 .lane .pulse{animation:none;left:0;top:0;width:100%;height:100%;opacity:.5}.fz094 .node.hub::before,.fz094 .dst-uk::before{animation:none;box-shadow:none}}</style><p class="ttl">这次最终采用的分流链路</p><p class="sub">不同应用先进入本机代理端口，Mihomo 根据目标域名决定走远端代理还是直连</p><div class="flow"><div class="col"><div class="node src"><b>浏览器</b><small>system proxy</small></div><div class="node src"><b>Claude Code CLI</b><small>HTTP_PROXY</small></div></div><div class="midcol"><div class="lane l1"><span class="pulse"></span></div><div class="lane l2"><span class="pulse"></span></div></div><div class="col"><div class="node hub"><b>本机代理端口</b><small>127.0.0.1:7897</small><div class="ex">Clash Verge Rev 管理，Mihomo 执行</div></div></div><div class="midcol"><div class="lane uk"><span class="pulse"></span></div><div class="lane dir"><span class="pulse"></span></div></div><div class="col dstcol"><div class="node dst-uk"><b>Claude 相关域名</b><small>claude.ai / claude.com</small><small>anthropic.com -&gt; UK</small></div><div class="node dst-dir"><b>其他域名</b><small>MATCH -&gt; DIRECT</small></div></div></div><div class="note"><span class="tag">重点</span><p>IP 查询网站如果不在 Claude 规则里，会命中 DIRECT，所以首页 IP 信息不能代表 Claude 的出口。</p></div></figure>

## 1. 最初的问题：买一台美国 AWS 服务器行不行

如果买一台美国 AWS / Lightsail / EC2 服务器，然后把自己的流量代理到这台服务器，目标网站看到的出口 IP 通常就是这台美国服务器的公网 IP。

但这里有一个关键差别：

- **目标网站看到的是美国 IP**：这一点通常成立。
- **目标网站也能知道它是 AWS / 云厂商 / 机房 IP**：这一点也通常成立。

所以 AWS/VPS 可以改变出口位置，但它不是住宅 IP。很多风控系统会把 IP 分成几类：

| 类型 | 常见归属 | 风控观感 |
| --- | --- | --- |
| 家宽公网 IP | 中国移动、中国联通、Comcast、Verizon 等 ISP | 更像普通家庭用户 |
| 住宅代理 IP | ISP 分配给住宅网络或住宅代理池 | 通常比机房 IP 更自然 |
| ISP / static residential proxy | 运营商名下、但以代理服务形式出租 | 介于住宅和托管代理之间，常用于稳定出口 |
| 云厂商 / 机房 IP | AWS、GCP、Azure、DigitalOcean 等 | 容易被识别为数据中心 |
| VPS 自带 IP | VPS 服务商机房段 | 本质仍是机房 IP |

一句话：**买 VPS 是买服务器，服务器自然带一个公网 IP；买代理通常是租一个可认证访问的代理出口，不等于拥有这个 IP。**

## 2. ISP、住宅 IP、云厂商 IP到底差在哪

`ISP` 是 `Internet Service Provider`，也就是互联网服务提供商。国内常见的是中国移动、中国联通、中国电信；海外常见的是 Comcast、AT&T、Verizon、Spectrum 等。

你家里宽带拿到的公网 IP，一般就是 ISP 分配的。比如家里用中国移动宽带，公网出口大概率会显示为中国移动相关网络。它可能是动态 IP，也可能经过运营商 NAT；是否真有独立公网 IP，要看宽带套餐和运营商网络。

`住宅 IP` 可以粗略理解成“看起来来自家庭宽带用户的 IP”。它的归属一般是 ISP，而不是 AWS 这类云厂商。

`云厂商 IP` 则通常属于数据中心。它也能正常访问网站，但很多风控系统会把它标成 hosting、datacenter、cloud、VPS、server 等类别。

所以这个理解基本成立：

> 住宅 IP 通常属于 ISP；云厂商 IP 通常属于机房 IP。

但要补一句：市面上卖的 `ISP proxy` 或 `static residential proxy` 不一定真是某户人家的路由器，它更像是代理服务商向你出租一个归属在 ISP 名下、可长期使用的代理出口。

## 3. 购买页里的 proxy、proxy amount 和那些加价项

代理购买页上的很多词，看起来像中文翻译问题，其实背后是计费模型。

| 页面词 | 更准确的理解 |
| --- | --- |
| `$4.00/proxy` | 每一个代理出口每月 4 美元，不是每个 IP 包、每个请求或每台设备 |
| `1 proxy` | 买 1 个代理实例，通常对应一组 host、port、username、password |
| `Proxy amount` | 自定义要买几个代理；左侧卡片是快捷套餐，右侧输入框是手动数量 |
| `30 days` | 这个代理可用 30 天，到期前后看服务商续费规则 |
| `Enable multi-device access` | 允许多个设备同时用同一个代理，一般每增加一个设备另收费用 |
| `Get 0 fraud risk IPs` | 加钱购买更低 fraud score / 更干净声誉的 IP，不能理解成绝对零风险 |

技术上，一个 proxy 可以被多个人或多台设备使用，只要服务商允许并且并发限制没超。但对 Claude 这类强风控服务来说，共享使用会带来几个问题：

- 同一个出口同时出现多地、多设备、多账号行为，画像容易变乱。
- 服务商可能限制并发连接数、设备数或带宽。
- 如果别人滥用同一个出口，IP 声誉会被拖低。

所以个人使用时，更稳妥的做法是：**一个人、一组代理、固定地区、固定用途**。不要把一个出口同时给很多设备或很多账号混用。

## 4. HTTP/HTTPS 代理和 SOCKS 代理到底有什么区别

HTTP 代理、HTTPS 代理和 SOCKS 代理都可以放在应用层理解，但它们“理解请求”的程度不一样。

| 类型 | 代理看到什么 | 适合什么 | 常见支持 |
| --- | --- | --- | --- |
| HTTP proxy | HTTP 请求行、Header、目标地址 | 网页、API、CLI 的 HTTP 请求 | `HTTP_PROXY` |
| HTTPS proxy | 通常通过 `CONNECT host:443` 建立隧道 | HTTPS 网站、HTTPS API | `HTTPS_PROXY` |
| SOCKS5 proxy | 更通用的 TCP/UDP 转发目标 | 不只 HTTP 的流量 | 需要应用显式支持 |

HTTP/HTTPS 代理更像是“我知道你要访问哪个 HTTP 目标，我来帮你建立连接”。对于 HTTPS，代理通常不会解密网站内容，只是收到 `CONNECT claude.ai:443` 这类请求，然后建立一条 TCP 隧道。

SOCKS5 更通用。它不专门服务 HTTP，而是把“我要连哪个 host、哪个端口”的请求转给代理。很多浏览器和代理客户端支持 SOCKS5，但并不是每个 CLI 都天然支持。

这也是为什么 Claude Code CLI 更适合先按 HTTP/HTTPS 代理处理：命令行生态里最通用、最容易生效的方式就是设置：

```bash
HTTP_PROXY=http://127.0.0.1:7897
HTTPS_PROXY=http://127.0.0.1:7897
```

## 5. 浏览器不是被“拦截”，而是主动把请求交给代理

这里最容易误解的一句话是：“本机代理接收浏览器发来的网络请求。”

这不是说用户在地址栏输入内容时，有个程序把你的输入截走了。真实链路更像这样：

1. 你在浏览器输入 `https://claude.ai/restricted`。
2. 浏览器准备发起网络连接。
3. 浏览器读取系统代理设置或自己的代理设置。
4. 如果系统代理是 `127.0.0.1:7897`，浏览器就先连接本机这个端口。
5. 本机代理程序收到请求，看到目标是 `claude.ai:443`。
6. 本机代理按规则判断：这个域名应该走 `IPRoyal-UK`。
7. 本机代理再连接远端代理。
8. 远端代理替你访问 Claude。

所以监听端口的是 Clash / Mihomo，不是浏览器。浏览器是客户端，它主动连 `127.0.0.1:7897`。

如果是系统代理模式，链路大概是：

```text
Chrome
  -> macOS 系统代理配置
  -> 127.0.0.1:7897
  -> Mihomo 规则匹配
  -> IPRoyal-UK
  -> claude.ai
```

如果是 TUN / 虚拟网卡模式，则更像是系统把 IP 包交给虚拟网卡，代理核心再根据 DNS、IP、SNI 等信息做分流。这次最终采用的是系统代理模式，不需要先理解 TUN。

<figure class="fz095" data-reveal role="group" aria-label="本机代理请求链路示意：浏览器主动读取代理设置、连接本机端口，由代理核心规则决定走远端代理还是直连"><style>.fz095{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--gr:#917f5c;--grb:#ece4d2;background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3.4vw,30px);margin:1.5rem 0;line-height:1.5;box-sizing:border-box;overflow:hidden}.fz095 *{box-sizing:border-box}.fz095 .hd{margin-bottom:1.1rem}.fz095 .t1{font-size:clamp(1.05rem,2.6vw,1.45rem);font-weight:800;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz095 .t2{font-size:clamp(.78rem,1.7vw,.92rem);color:var(--muted,#6a6155);margin-top:.34rem;font-weight:600}.fz095 .flow{display:flex;flex-wrap:wrap;align-items:stretch;gap:.5rem;margin-bottom:1.3rem}.fz095 .node{flex:1 1 130px;min-width:0;background:var(--paper-deep,#ece5d5);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:11px;padding:.7rem .8rem;display:flex;flex-direction:column;justify-content:center;opacity:0;transform:translateY(7px);animation:fz-rise .7s ease forwards}.fz095 .node b{font-size:clamp(.9rem,1.9vw,1.04rem);font-weight:800;color:var(--ink,#1a1815)}.fz095 .node small{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.74rem;color:var(--muted,#6a6155);margin-top:.28rem;word-break:break-all}.fz095 .n1{background:var(--cyb,#dcebed);border-color:var(--cye,#8fbcc4)}.fz095 .n1 b{color:var(--cy,#3f6d79)}.fz095 .n2{background:var(--paper-deep,#ece5d5);animation-delay:.35s}.fz095 .n3{background:var(--cyb,#dcebed);border-color:var(--cye,#8fbcc4);animation-delay:.7s}.fz095 .n3 b{color:var(--cy,#3f6d79)}.fz095 .n4{flex:0 1 96px;background:var(--grb,#ece4d2);border-color:rgba(145,127,92,.5);animation-delay:1.05s}.fz095 .n4 b{color:var(--gr,#917f5c)}.fz095 .arr{flex:0 0 26px;align-self:center;display:flex;align-items:center;justify-content:center;color:var(--ink-soft,#3c362c)}.fz095 .arr i{position:relative;width:18px;height:2px;background:var(--ink-soft,#3c362c);display:block}.fz095 .arr i:after{content:"";position:absolute;right:-1px;top:-3px;border-left:6px solid var(--ink-soft,#3c362c);border-top:4px solid transparent;border-bottom:4px solid transparent}.fz095 .arr i:before{content:"";position:absolute;left:0;top:0;height:2px;width:5px;background:var(--cy,#3f6d79);animation:fz-run 3.6s linear infinite}.fz095 .lower{display:grid;grid-template-columns:1fr 1.05fr;gap:clamp(.9rem,2.6vw,1.7rem);align-items:start}.fz095 .key{border-left:3px solid var(--cye,#8fbcc4);padding-left:.85rem}.fz095 .key h4{margin:0 0 .5rem;font-size:clamp(.95rem,2vw,1.1rem);font-weight:800;color:var(--ink,#1a1815)}.fz095 .key p{margin:.36rem 0;font-size:clamp(.78rem,1.7vw,.9rem);color:var(--ink-soft,#3c362c)}.fz095 .branch{display:flex;flex-direction:column;gap:.7rem;position:relative}.fz095 .res{position:relative;border-radius:10px;padding:.62rem .8rem .68rem 1.5rem;border:1.5px solid var(--hair,rgba(26,24,21,.18))}.fz095 .res b{display:block;font-size:clamp(.86rem,1.8vw,1rem);font-weight:800}.fz095 .res small{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.74rem;color:var(--muted,#6a6155);margin-top:.2rem;display:block;word-break:break-all}.fz095 .res:before{content:"";position:absolute;left:.7rem;top:50%;transform:translateY(-50%);width:9px;height:9px;border-radius:50%}.fz095 .hit{background:var(--cyb,#dcebed);border-color:var(--cye,#8fbcc4)}.fz095 .hit b{color:var(--cy,#3f6d79)}.fz095 .hit:before{background:var(--cy,#3f6d79);box-shadow:0 0 0 0 rgba(63,109,121,.5);animation:fz-pulse 5.2s ease-in-out infinite}.fz095 .miss{background:var(--grb,#ece4d2);border-color:rgba(145,127,92,.5)}.fz095 .miss b{color:var(--gr,#917f5c)}.fz095 .miss:before{background:var(--gr,#917f5c)}.fz095 .blbl{font-size:.72rem;color:var(--muted,#6a6155);font-weight:600;margin-bottom:-.2rem}.fz095 .blbl span{display:inline-block;border-bottom:1.5px solid var(--hair,rgba(26,24,21,.18));padding:0 .4rem .15rem}@keyframes fz-rise{to{opacity:1;transform:translateY(0)}}@keyframes fz-run{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:13px;opacity:0}}@keyframes fz-pulse{0%,100%{box-shadow:0 0 0 0 rgba(63,109,121,.45)}45%{box-shadow:0 0 0 6px rgba(63,109,121,0)}}@media(max-width:560px){.fz095 .flow{flex-direction:column}.fz095 .node,.fz095 .n4{flex:1 1 auto}.fz095 .arr{transform:rotate(90deg);height:18px}.fz095 .lower{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.fz095 .node{opacity:1;transform:none;animation:none}.fz095 .arr i:before,.fz095 .hit:before{animation:none}.fz095 .hit:before{box-shadow:none}}</style><div class="hd"><div class="t1">浏览器不是被拦截，而是主动连接代理</div><div class="t2">代理链路发生在"准备发起网络连接"之后，不是发生在地址栏输入阶段</div></div><div class="flow"><div class="node n1"><b>输入网址</b><small>claude.ai</small></div><div class="arr"><i></i></div><div class="node n2"><b>读取代理设置</b><small>macOS / browser</small></div><div class="arr"><i></i></div><div class="node n3"><b>连接本机端口</b><small>127.0.0.1:7897</small></div><div class="arr"><i></i></div><div class="node n4"><b>规则</b><small>route</small></div></div><div class="lower"><div class="key"><h4>关键区别</h4><p>监听的是代理核心，不是浏览器。</p><p>浏览器在发起连接前读取代理设置。</p><p>是否走远端代理，要等本机代理按规则判断。</p></div><div class="branch"><div class="blbl"><span>规则判断后的两种出口</span></div><div class="res hit"><b>命中 Claude 规则</b><small>IPRoyal-UK -&gt; target</small></div><div class="res miss"><b>没有命中规则</b><small>DIRECT -&gt; target</small></div></div></div></figure>

## 6. 为什么不继续自己写本地代理

中间曾经尝试过自己写一个本地 HTTP 代理和 PAC：

| 组件 | 地址 |
| --- | --- |
| 本地 HTTP 代理 | `127.0.0.1:17890` |
| PAC 服务 | `127.0.0.1:17891` |

想法是：只让 `claude.ai`、`anthropic.com` 这类域名走上游代理，其他全部直连。

这个方案能说明原理，但不适合长期使用。原因是代理程序要处理大量边界：

- HTTP `CONNECT` 的解析和转发。
- HTTPS 隧道的双向转发。
- DNS、超时、连接复用、文件描述符上限。
- 浏览器并发连接、长连接和重试。
- 规则变更后旧连接如何处理。
- 非 Claude 流量误入代理后的兼容性。

实际使用时，系统 HTTP/HTTPS 代理一旦全局指向这个自写代理，非 Claude 的流量也可能进入它。后来访问 `code.coze.cn/subscription` 出问题，本质就是这个自写代理的兼容性和资源管理不够成熟。

结论很明确：**为了学习可以自己写代理；为了日常稳定使用，应该交给 Clash / Mihomo 这类成熟代理核心。**

## 7. Surge、Clash Verge Rev 和 Mihomo 分别是什么

Surge、Clash Verge Rev、Mihomo 不是同一层东西。

| 名称 | 更像哪一层 | 作用 |
| --- | --- | --- |
| Surge | 商业代理客户端 + 规则管理工具 + 网络调试工具 | macOS/iOS 上成熟但收费 |
| Clash Verge Rev | 图形界面客户端 | 管理配置、开启系统代理、查看连接和规则 |
| Mihomo / Clash.Meta | 代理核心 | 监听本机端口、解析规则、转发流量 |

可以把 Clash Verge Rev 理解成“控制台”和“壳”，Mihomo 才是实际干活的引擎。

这次最终配置是：

- Clash Verge Rev 管理配置。
- Mihomo 监听本机端口 `127.0.0.1:7897`。
- macOS 系统 HTTP/HTTPS 代理指向这个端口。
- 规则只把 Claude 相关域名送到英国代理，其他走 `DIRECT`。

配置片段可以抽象成这样：

```yaml
proxies:
  - name: IPRoyal-UK
    type: http
    server: <proxy-host>
    port: <proxy-port>
    username: <username>
    password: <password>

proxy-groups:
  - name: Claude
    type: select
    proxies:
      - IPRoyal-UK
      - DIRECT

rules:
  - DOMAIN-SUFFIX,claude.ai,Claude
  - DOMAIN-SUFFIX,claude.com,Claude
  - DOMAIN-SUFFIX,anthropic.com,Claude
  - MATCH,DIRECT
```

这里的 `DIRECT` 不是另一个代理节点，而是直连：不经过远端代理，直接从当前网络出口访问。

## 8. 为什么首页 IP 信息显示中国，但 Claude 仍然可能走英国

Clash Verge Rev 首页的“IP 信息”卡片通常会请求一个 IP 查询服务。这个服务本身不是 Claude 域名。

如果规则最后是：

```yaml
- MATCH,DIRECT
```

那么不在 Claude 规则里的普通 IP 查询网站就会直连。直连时显示中国、北京、运营商网络，都很正常。

这不代表 `claude.ai` 没有走代理，只代表“这个 IP 查询网站”没有走代理。

更准确的验证方法是看目标域名：

1. Clash 连接列表里，`claude.ai:443` 的链路是否显示 `Claude / IPRoyal-UK`。
2. 规则页面里，`DomainSuffix(claude.ai)`、`DomainSuffix(anthropic.com)`、`DomainSuffix(claude.com)` 的命中次数是否增长。
3. 用命令指定本机代理访问 Claude：

```bash
curl -I --proxy http://127.0.0.1:7897 https://claude.ai/restricted
```

如果返回头里出现类似 London / LHR 方向的边缘节点信息，这就是一个很强的侧面证据：这条请求确实从英国方向出去过。

如果你想让首页 IP 信息也显示英国，需要把 IP 查询服务也加进代理规则，或者切到全局代理模式。但这样会让更多日常网站走代理，可能影响访问速度，也可能把不需要代理的网站搞坏。

所以这次选择保守策略：**只代理 Claude 相关域名，不追求首页 IP 卡片显示英国。**

## 9. 为什么连接列表里会出现 `claude.com:443 DIRECT`

一开始规则里只写了：

```yaml
DOMAIN-SUFFIX,claude.ai,Claude
DOMAIN-SUFFIX,anthropic.com,Claude
```

后来发现连接列表里有一条：

```text
claude.com:443  DIRECT
```

这说明 `claude.com` 没被规则覆盖，于是落到了最后的 `MATCH,DIRECT`。修正方式就是补一条：

```yaml
DOMAIN-SUFFIX,claude.com,Claude
```

规则补上以后，新建连接会按新规则走。但旧连接不会自动“改道”。代理规则通常是在连接创建时决定的，已经建立的 TCP/HTTPS 连接会继续按原来的路径跑，直到连接关闭。

这也解释了 Clash 里的“关闭连接”按钮：它不是多余的。浏览器、HTTP/2、WebSocket、SSE、连接池都会保留一段时间的长连接。手动关闭旧连接后，浏览器下一次请求会重新建立连接，再命中新规则。

## 10. Claude Code CLI 需要单独配置吗

浏览器一般会遵守 macOS 系统代理，但命令行工具不一定。

很多 CLI 不会主动读取系统代理。更稳妥的做法是给 CLI 进程显式设置环境变量：

```bash
HTTP_PROXY=http://127.0.0.1:7897 \
HTTPS_PROXY=http://127.0.0.1:7897 \
claude
```

这次最终做法是给 `claude` 包一层启动脚本，让它每次启动都带上这两个环境变量。这样浏览器和 Claude Code CLI 的路径分开处理：

| 场景 | 代理入口 |
| --- | --- |
| Chrome / Safari 等 GUI 应用 | macOS 系统代理 |
| Claude Code CLI | `HTTP_PROXY` / `HTTPS_PROXY` |
| 其他 CLI | 需要按工具单独判断 |

顺手也检查并更新了 Claude Code CLI：本机原来是 `2.1.92`，后来更新到 `2.1.170`。

电脑重启后是否还生效，要拆开看：

- Clash Verge Rev 的配置文件会保留。
- 如果 Clash Verge Rev 设置了开机启动，并且系统代理自动开启，浏览器侧会继续生效。
- 如果 `claude` 的 wrapper / alias 写进了 `~/.zshrc`，新终端里的 Claude Code CLI 也会继续带代理。
- 如果只是临时在当前终端执行了一次 `export HTTP_PROXY=...`，重启或新开终端后就不一定还在。

## 11. 这次最有用的排查顺序

以后遇到类似问题，不建议先盯着“我的 IP 查询网站显示哪里”。更稳的顺序是：

1. 先看本机代理有没有监听：例如 `127.0.0.1:7897` 是否存在。
2. 再看系统代理是否指向它。
3. 再看目标域名有没有对应规则。
4. 再看 Clash 连接列表里这条连接走的是代理组还是 `DIRECT`。
5. 再看规则命中次数是否增长。
6. 最后用 `curl --proxy` 对具体目标域名做一次命令行验证。

对应到这次配置，核心判断是：

| 问题 | 应该看哪里 |
| --- | --- |
| Clash 首页 IP 为什么是中国 | 因为 IP 查询站点命中了 `MATCH,DIRECT` |
| Claude 是否走英国代理 | 看 `claude.ai:443` 的连接链路和规则命中 |
| `claude.com` 为什么直连 | 缺了 `DOMAIN-SUFFIX,claude.com,Claude` |
| 规则改了为什么旧连接还在 | 连接创建时已决定路径，需要关闭旧连接重连 |
| Claude Code CLI 是否走代理 | 看是否设置 `HTTP_PROXY` / `HTTPS_PROXY` |

## 12. 最终心智模型

这次真正需要建立的心智模型不是“买一个 IP 就完事”，而是下面这条链：

```text
应用
  -> 是否使用系统代理或环境变量
  -> 本机代理端口
  -> 代理核心规则匹配
  -> DIRECT 或远端代理
  -> 目标网站看到的出口 IP
```

每一层都可能让结果不同：

- 买 AWS/VPS：改变出口，但大概率是机房 IP。
- 买 residential / ISP proxy：租代理出口，不是拥有 IP。
- 开系统代理：主要影响遵守系统代理的 GUI 应用。
- 设置 `HTTP_PROXY` / `HTTPS_PROXY`：主要影响支持这些变量的 CLI。
- 配 Clash 规则：决定哪些域名走代理，哪些直连。
- 首页 IP 卡片：只代表那个 IP 查询服务自己的路由，不代表所有域名。
- 关闭连接：让旧的 TCP/HTTPS 长连接断开，新规则才更容易立刻生效。

所以最后的结论很简单：**代理配置不要看一个全局现象，要看“某个应用访问某个域名时，命中了哪条规则，最后从哪个出口出去”。**

这也是为什么我最终更倾向于用 Clash Verge Rev + Mihomo，而不是自己维护一个临时代理脚本。前者把监听、规则、连接、日志、重连、系统代理这些日常问题都放进了一个成熟控制面；我们真正要维护的，只是几条清晰、可验证、范围足够小的规则。
