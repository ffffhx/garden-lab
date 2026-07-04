---
title: "远方的说书先生：用一个寓言讲透 PTY、SSH、Relay 与 Tailscale"
date: 2026-07-03 15:30:00
categories:
  - 技术
tags:
  - 终端
  - PTY
  - SSH
  - tmux
  - Tailscale
  - Orca
excerpt: "为什么 SSH 一断进程就死？tmux 和 orca-remote relay 凭什么能让会话常驻？同一局域网下手机扫码配对连的是什么？不在同一网络时 Tailscale 又解决了什么？这篇文章先用一个说书先生的寓言把 PTY、终端模拟器、sshd、relay、NAT 和 Tailscale 串成一条线，最后附一段实战：公司禁了 Tailscale，如何用反向 SSH 隧道 + 一台公网服务器让手机跨网络连回 Mac 上的 Orca。"
---

这篇文章源于一次真实的讨论：用 Orca 远程连接开发机跑 Claude Code，为什么关掉 SSH 之后 agent 还活着？手机和电脑不在同一个网络下，又是怎么连上的？

背后涉及一串概念：PTY、终端模拟器、sshd、relay、NAT、Tailscale。每个单拎出来都有点抽象，但它们其实是一条完整的链路，一层管一层。与其背定义，不如听个故事。

先给这个故事一张地图——五道关卡，每一关解决前一关留下的一个新问题：

<figure class="sbc" role="group" aria-label="从 PTY 到 Tailscale 的五层链路全景"><style>.sbc{--paper-soft:#faf6ec;--paper-deep:#efe8d8;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.16);--vio:#54579a;--viob:#e7e8f4;--cyn:#3f6d79;--cynb:#dcebed;--amb:#9a6516;--ambb:#f4e8cc;--grn:#6f8f4a;--grnb:#e6eed7;--red:#8f2d20;--redb:#f1dcd7;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);background:linear-gradient(165deg,var(--paper-soft),var(--paper-deep));color:var(--ink);margin:0;padding:clamp(18px,3vw,30px);border:1px solid var(--hair);border-radius:14px;box-sizing:border-box;line-height:1.45}.sbc *{box-sizing:border-box}.sbc .hd{margin-bottom:clamp(14px,2vw,20px)}.sbc .ttl{font-weight:800;font-size:clamp(17px,2.4vw,25px);margin:0;letter-spacing:.01em}.sbc .sub{font-size:clamp(12px,1.5vw,14.5px);color:var(--muted);margin:.5em 0 0}.sbc .stack{display:flex;flex-direction:column;gap:0}.sbc .row{position:relative;display:grid;grid-template-columns:auto 1fr;gap:clamp(10px,1.6vw,16px);padding:clamp(11px,1.6vw,16px) 0;align-items:start}.sbc .row+.row{border-top:1px dashed var(--hair)}.sbc .badge{width:clamp(30px,4.4vw,40px);height:clamp(30px,4.4vw,40px);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:clamp(14px,1.9vw,18px);color:#fff;flex:none;font-family:var(--font-serif-body,Georgia,serif)}.sbc .r1 .badge{background:var(--vio)}.sbc .r2 .badge{background:var(--cyn)}.sbc .r3 .badge{background:var(--amb)}.sbc .r4 .badge{background:var(--grn)}.sbc .r5 .badge{background:var(--red)}.sbc .body{min-width:0}.sbc .name{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-weight:700;font-size:clamp(13px,1.7vw,16px);display:inline-block;padding:.15em .55em;border-radius:6px;margin-bottom:.15em}.sbc .r1 .name{color:var(--vio);background:var(--viob)}.sbc .r2 .name{color:var(--cyn);background:var(--cynb)}.sbc .r3 .name{color:var(--amb);background:var(--ambb)}.sbc .r4 .name{color:var(--grn);background:var(--grnb)}.sbc .r5 .name{color:var(--red);background:var(--redb)}.sbc .q{font-size:clamp(13px,1.6vw,15.5px);color:var(--ink-soft);margin:.35em 0 .2em;font-weight:600}.sbc .q b{font-weight:800}.sbc .fab{font-size:clamp(12px,1.45vw,14px);color:var(--muted)}.sbc .fab::before{content:"寓言 · ";font-weight:700;opacity:.75}.sbc .foot{margin-top:clamp(14px,2vw,20px);padding-top:clamp(10px,1.4vw,14px);border-top:1px solid var(--hair);font-size:clamp(12px,1.5vw,14.5px);color:var(--muted)}.sbc .foot b{color:var(--ink-soft);font-weight:700}@media(max-width:520px){.sbc .row{grid-template-columns:auto 1fr;gap:10px}}</style><div class="hd"><p class="ttl">一条链，五道关</p><p class="sub">说书先生（agent）只管开口，"谁在听、隔多远、断没断"全交给下面五层，一层补一层的漏。</p></div><div class="stack"><div class="row r1"><div class="badge">1</div><div class="body"><span class="name">PTY 伪终端</span><p class="q">程序只认"终端"，可真终端早没了 — <b>内核造一个假终端顶上</b></p><p class="fab">假戏台，谁坐窗后（master）谁就是观众</p></div></div><div class="row r2"><div class="badge">2</div><div class="body"><span class="name">sshd / SSH</span><p class="q">终端在远方机器上，怎么隔着网络递到你面前 — <b>加密通道 + 远端代持终端</b></p><p class="fab">驿丞，只为一趟差事而活，信使一走就散场</p></div></div><div class="row r3"><div class="badge">3</div><div class="body"><span class="name">tmux · orca-remote relay</span><p class="q">连接一断会话就死，太脆 — <b>换个常驻进程握住终端，连接可断会话不死</b></p><p class="fab">落了户的管家，握窗不撒手，还留着戏文实录</p></div></div><div class="row r4"><div class="badge">4</div><div class="body"><span class="name">扫码配对 · device token</span><p class="q">手机凭什么合法接进来 — <b>二维码递上地址+一次性暗号，此后端到端加密</b></p><p class="fab">一张请帖：门牌加暗号，进门换发长期腰牌</p></div></div><div class="row r5"><div class="badge">5</div><div class="body"><span class="name">Tailscale / WireGuard</span><p class="q">两台设备各躲在 NAT 后，根本互相够不着 — <b>虚拟组网 + 打洞，够不着变够得着</b></p><p class="fab">仙驿发天下唯一的玉牌，教两家同时寄信打通</p></div></div></div><div class="foot">往下每一章，拆解的就是这五道关中的一道 —— <b>各司其职，谁也不越界</b>。</div></figure>

---

# 《远方的说书先生》

## 第一章：只对戏台开口的先生

古时候，说书先生都在真戏台上开口。行会的门规传了几百年：**没有正经戏台，先生不说书**。每位先生上台前都要先问一句："这是戏台吗？"——答不上来，他就只肯干巴巴地念稿，不带腔调，不抖包袱。

正经戏台还标配一位**堂倌**。他的活儿很杂：客人递纸条点书，写错了可以让堂倌涂了重写（行编辑）；客人若把茶碗一摔，堂倌立刻上台把先生请下去（摔碗=Ctrl+C，请下去=SIGINT 信号）；先生也随时可以问他"今儿台下坐了几排几列"（窗口尺寸），好决定唱大戏还是说小段。

先生叫**克劳德**（claude），还有他的师兄**泽奚**（zsh），都是守规矩的好艺人。

## 第二章：假戏台

后来真戏台全拆了，世上只剩茶馆、驿站这些新行当。可先生们的门规改不了——他们只认戏台。

于是官府的工匠（**内核**）造出一种**假戏台（PTY）**：台子和堂倌都跟真的一模一样，唯独台下没有观众席，只开了一扇**小窗（master 端）**。

规矩只有一条：**谁坐在窗后，谁就是观众。**

城里的茶馆掌柜（**iTerm / 终端 App**）租下一座假戏台，自己坐到窗后：把客人（**你**）的话从窗里递进去，把先生说的书从窗里抄出来，写在茶馆的大墙上（**屏幕**）。

克劳德站在台上（**slave 端**），问堂倌："这是戏台吗？"堂倌说是。于是他抖擞精神，照说不误。**他从头到尾不知道、也不需要知道窗后坐的是谁。**

## 第三章：远方的先生与短命的驿丞

你听说远方山城有位克劳德先生书说得极好，想天天听。

山城城门口（**22 端口**）守着一位**驿丞（sshd）**。你派信使（**ssh 客户端**）揣着你的私印（**密钥**）去叩门，驿丞验过印信，便就地搭一座假戏台，**自己坐进窗后**，请克劳德上台。先生说一句，驿丞抄一句，封进火漆信筒（**加密**）交信使快马送回你的茶馆，贴上墙。你在千里之外，听得如在场中。

但驿丞有个致命的规矩：**他只为这一趟差事而活。**

某夜信使的路断了（你合上了笔记本）。驿丞当即拆台走人。台子一拆，堂倌按律朝台上高喊一声——

**"散——！"（SIGHUP）**

克劳德一个激灵，收扇子走人。说了半宿的长篇，散了。

你第二天再派信使去，来的是位新驿丞、新戏台、新的开场白。昨夜的故事，谁也接不上。

## 第四章：常驻的管家

山城的人也烦这事，后来城里出了一位**管家（tmux / orca-remote relay）**。

他与驿丞有个根本不同：驿丞的命拴在差事上，而管家**自己在城里落了户**（setsid，脱离会话）——他不属于任何一趟差事、任何一个信使，谁也"散"不到他头上。

管家自己搭台，自己坐进窗后（**握住 master**），请克劳德上台。从此：

- 先生说的每一句，管家都**照单全收，抄进他的戏文实录**（滚动缓冲），还随手在小黑板上画着"此刻台面上是什么光景"（**虚拟屏幕**）——哪怕堂下一个客人都没有，他也听、也记，先生便永远不会因为"没人听"而卡壳；
- 你的信使来了，管家先把小黑板上的光景誊给你（**重连秒恢复画面**），此后先生说一句他转一句，你的话他也代为递进窗去（**转发**——这就是 relay 这个词的本分）；
- 信使走了？管家眼皮都不抬。**断的是传话的路，不是听书的人。**

驿丞还在，但降级成了纯粹的传话通道。而克劳德，从被请上这座台子起就没停过口——他不知道台下的听众换过人、断过路，甚至压根没有人。他只知道：堂倌说这是戏台，那就接着说。

某天你掏出手机想听——手机不过是又一位来找管家的客人，规矩全同。

## 第五章：同院的客人

先说最顺利的情形：**手机和 Mac 连着同一个 Wi-Fi**——用寓言的话说，两位客人住在**同一座大院**里。

这里得先交代一句大院的规矩：门房（NAT 路由器）只守**院门**，管的是进出大院的信件；**院内串门不经他的手**。手机拿着 Mac 的房间号（`192.168.1.5` 这样的内网 IP），穿过院子直接就能敲到门。房间号出了院是废纸，但在院内，它就是准确的地址。

而你 Mac 上的桌面 Orca，别看它是个带界面的 App，**它自己就是一位管家**：握着所有假戏台的窗口（PTY master），管着克劳德和他的同行们，同时在自家门口挂了块牌子——"6768 号门，有事请进"（监听 6768 端口）。远程场景里派驻山城的 orca-remote relay，其实就是把这位管家单独打包外派；本地场景里，管家一直就住在你 Mac 上。

手机第一次上门，缺两样东西：**门牌**（去哪敲门）和**暗号**（凭什么进门）。于是有了扫码配对——桌面 Orca 写好一张请帖（二维码），上面就两行字：

```
门牌：192.168.1.5 的 6768 号门
暗号：一次性密钥（进门后换发长期腰牌 device token，此后全程加密对话）
```

手机扫码、对暗号、领腰牌，整个过程**一个字节都不出大院**——没有任何外人（云服务器）经手，这就是官方说"配对端到端加密、没有云中继"的意思。腰牌存在手机里，以后进门不用再扫。

配对之后的日常，就是客人和管家的问答：

- 手机说"让克劳德继续"——管家把这句话递进窗去（写入 PTY master）；
- 手机说"我看看三号台"——管家把小黑板誊一份过去（回传虚拟屏幕）；
- 手机说"这摊先收了"——管家去停掉对应的活计。

注意：**手机上不跑任何 agent、不存任何代码**。说书的始终是 Mac 上的克劳德，听书记账的始终是 Mac 上的管家，手机只是隔窗听转述的客人。管家下班（桌面 App 关闭），客人自然没书可听。

还有一条边界值得说清：手机控制的不是"你的 Mac"，而是"管家愿意代办的事"。它不是远程桌面那种搬运整块屏幕、接管鼠标键盘的玩法，而是**照着管家的菜单点菜**——回复 agent、读终端、审代码变更、睡眠 worktree……菜单之外的事（开别的 App、翻你的文件）它做不了。这既是产品形态，也是安全边界。

同院串门就这么简单。麻烦出在下一章：客人出了远门。

## 第六章：找不到的门牌

可手机这位客人出门就迷路了。

原来天下的宅子都圈在一座座**大院（局域网/NAT）**里。院里的房间号（**192.168.x.x**）家家重样——你说"找 302 室"，全天下每个大院都有一间 302。这号码出了院门，就是一句废话。

每座大院对外只有一个门牌（**公网 IP**）和一位铁面**门房（NAT 路由器）**。门房手里一本账，只记一种事："院里哪间屋，先往外寄过信"。回信来了，查账，送进去；**不请自来的访客，一律挡驾**——账上没记录，他不知道这封信该给 302 还是给 305，索性扔了。

更糟的是，有些大院自己还套在更大的院子里（**运营商 CGNAT**）——你连自家大院的门牌是真是假都说不准。

手机站在山城大院外，明明知道管家就在里头，就是敲不开门。

## 第七章：会仙术的驿站

最后登场的是一家**仙驿（Tailscale）**。

凡入了会的宅子（登录同一账号的设备），仙驿发一块**天下唯一的玉牌**（`100.x.y.z` 的虚拟地址 / `xxx.ts.net` 的名号）。这玉牌不认大院、不认门房，走到哪儿跟到哪儿。

两家想通信，仙驿的掌柜（协调服务器）先居中引荐，让双方互换信物（**WireGuard 密钥**）——但掌柜只做介绍人，**信件从不过他的手**。然后他教一手绝活：

**"你们俩，同时给对方寄信。"**

两边门房各自在账上记下"我院里有人给那边寄过信"，于是对方的来信到了，一查账——"哦，是回信"，放行。两封信在半路擦肩而过，门就这么**从两边同时打开了**（打洞 / NAT 穿透）。从此直通，快马如飞。

碰上极蛮横的门房（防火墙封路）实在打不通？仙驿在官道上还设有**中转铺（DERP 中继）**：两家都主动把信寄到铺子里，由铺子代转——"主动往外寄"是天下门房都拦不住的，所以这条路慢些，但**保底一定通**。

于是你在开发机上吩咐一声：

```bash
orca serve --pairing-address devbox.xxx.ts.net --mobile-pairing
```

手机念着玉牌上的名号，无论你在地铁上还是被窝里，都能敲开管家的门。管家誊出小黑板，克劳德的声音接着响起——**那个故事，从始至终，没有断过。**

---

## 对照表

| 故事里 | 现实里 |
|---|---|
| 说书先生克劳德、师兄泽奚 | claude CLI、zsh |
| "没有戏台不说书"的门规 | 程序检查 `isatty()`、依赖终端行为 |
| 堂倌（涂改纸条/摔碗请人/报座次） | TTY 驱动（行编辑回显 / Ctrl+C→SIGINT / 窗口尺寸） |
| 假戏台、台上、窗后 | PTY、slave 端、master 端 |
| 茶馆掌柜 | iTerm / Terminal.app |
| 驿丞、私印、火漆信筒 | sshd、SSH 密钥、加密通道 |
| "散——！" | SIGHUP（连接断开杀死会话） |
| 管家（落户/坐窗后/戏文实录/小黑板） | tmux 或 orca-remote relay（daemon 化 / 握 master / 滚动缓冲 / 虚拟屏幕） |
| 住在你 Mac 上的管家、"6768 号门" | 桌面 Orca 内置的 runtime 服务器、监听的 6768 端口 |
| 同一座大院、院内串门不经门房 | 同一局域网，内网 IP 直接互达（流量不过 NAT） |
| 请帖（门牌+暗号）、长期腰牌 | 配对二维码（地址+一次性密钥）、device token |
| 照管家菜单点菜的客人 | 手机瘦客户端（协议级遥控，不是远程桌面） |
| 大院、重样的 302 室、门房和他的账本 | NAT、私有 IP、路由器的连接映射表 |
| 仙驿、玉牌、"同时寄信"、中转铺 | Tailscale、虚拟 IP、UDP 打洞、DERP 中继 |

## 尾声：四层各司其职

把寓言收起来，整条链其实就是四句话：

- **PTY** 解决"程序需要一个终端"——内核造假戏台，谁握 master 谁当观众；
- **sshd** 解决"隔着网络给你一个终端"——但它握的 master 跟连接同生共死；
- **tmux / orca-remote relay** 解决"连接断了会话不死"——换一个不随差事走的常驻进程来握 master；
- **扫码配对** 解决"客人怎么合法进门"——二维码递上地址和一次性密钥，此后端到端加密，同一局域网下连中间人都没有；
- **Tailscale** 解决"两台设备根本互相够不着"——虚拟局域网 + NAT 打洞 + 中继保底，连上之后玩法与同院无异。

**克劳德只管说书（程序只管面对终端）；谁当听众、听众换不换人、隔不隔千山万水——那是掌柜、驿丞、管家和仙驿的事，一层管一层，谁也不越界。**

## 从寓言到实战：公司禁了 Tailscale，我用反向隧道让手机连回 Mac 的 Orca

寓言讲完，来一段真事——它把上面每一层都用上了。

**处境**：想在手机上跨网络控制我 Mac 上的 [Orca](https://www.onorca.dev/)（一个跑并行 coding agent 的 ADE）。官方推荐的跨网方案是 Tailscale，但我这台是公司统一管控的 Mac，装 Tailscale 一启动就被终端安全软件弹窗拦掉——"应企业安全合规要求，该应用已被禁止使用"。企业禁它不奇怪：它能打穿内外网、绕过公司网络边界，是安全团队的高风险项。

**思路**：回到寓言第六章那条铁律——Mac 躲在 NAT 后面没有公网地址，外面主动敲门一律被门房挡回；但**"主动往外寄信永远畅通"**。于是不打洞、不组网，改用最朴素的一招：**找一台有公网 IP 的服务器当"中转铺"，让 Mac 主动拨过去，把自己的端口"探"到中转铺上**。这就是 SSH 的**反向隧道（remote port forwarding）**，本质和 tmux/relay 一样——借一个够得着的常驻点，让"连接"和"可达性"解耦。

```
手机(任何网络) → 公网服务器:36768 → 反向SSH隧道 → Mac:6768 上的 Orca
  (客人)          (中转铺,有公网IP)    (Mac主动拨出的专线)   (说书的总店)
```

关键点：**没有任何人"主动连 Mac"**，是 Mac 自己拨出去的（门房当正常出站流量放行）；agent 和代码全程在 Mac 上，服务器只是一根管子。

### 落地五步

**① 服务器 sshd：允许隧道端口对外开放**

反向隧道探出的端口，sshd 默认只绑服务器 `localhost`（外面连不到）。开个开关让它听命于客户端：

```bash
# 服务器上，写一个 drop-in（Ubuntu 24.04 默认 Include sshd_config.d/）
echo "GatewayPorts clientspecified" | sudo tee /etc/ssh/sshd_config.d/99-orca-tunnel.conf
sudo systemctl reload ssh   # 温和重读配置，不断开现有连接
```

**② 服务器防火墙：放行端口**

云服务器有两层防火墙。主机层 `ufw allow 36768/tcp`；**云平台层**（ECS 安全组 / 轻量应用服务器的"防火墙"）也要在控制台加一条入方向规则 `TCP 36768 / 0.0.0.0/0`——这层从 SSH 改不了，是最容易漏的一步（我第一次探测非标端口连不通就是卡在这）。

**③ Mac：反向隧道 + 开机自启/断线自愈**

用 `autossh`（不是 VPN，不会被管控拦）建隧道，做成 launchd 服务常驻：

```bash
brew install autossh
# 隧道核心命令：把 Mac:6768 探到 服务器:36768
autossh -M 0 -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -R 0.0.0.0:36768:localhost:6768 deploy@<公网服务器>
```

写进 `~/Library/LaunchAgents/dev.orca.tunnel.plist`，配 `RunAtLoad` + `KeepAlive` + `AUTOSSH_GATETIME=0`，就能开机自启、断线自愈。

**④ 验证**

先在**服务器本机** `curl localhost:36768`——通了说明"隧道 + Mac Orca"这段没问题（这一步不受云防火墙影响）；再从**外部** `curl http://<公网服务器>:36768/`，返回 200 说明云防火墙也放行了，全线贯通。

**⑤ Orca 配对：地址会自动嵌进链接**

隧道让 `<公网服务器>:36768` 等价于 Mac 的 Orca。在桌面 Orca：**Settings → 远程 Orca 服务器 → 「将此应用作为服务器公布」→ 分享此 Orca 服务器 → 新链接**。

这里有个坑：同一页顶部还有个"连接到远程服务器"，那是让**你的 Mac 去连别的 Orca**（反方向），把地址填进那儿会报 `Invalid pairing code`。要用的是最下面的"公布"。

生成的链接里，`orca://pair?code=...` 的 `code` 是一段 base64，解开是：

```json
{ "v": 2, "endpoint": "ws://<公网服务器>:36768", "deviceToken": "…" }
```

`endpoint` 已经自动填成了公网中转地址——**地址和密钥都对，不用手改**。手机装 Orca App 扫码（或直接用它给的 `http://<公网服务器>:36768/web-index.html#pairing=…` 在手机浏览器打开），切到 4G 也能连回 Mac。

### 几条要记住的边界

- **安全**：配对链接里带 `deviceToken`，是访问凭证，别外发；好在 Orca 是端到端加密 + 一次性配对，公网上扫到端口但没配过对的人连不进来，中转服务器也只转发密文、读不到内容。
- **合规**：这套只适合**个人项目**。别把公司代码的 agent 会话穿过个人公网服务器——那和公司禁 Tailscale 想防的是同一类事。公司场景请走内网 devbox + 官方 VPN（飞连）。
- **局限**：Mac 必须保持唤醒（`caffeinate -s`），Orca 才在线；整条链依赖中转服务器和隧道存活。
- **等官方**：Orca 正在做[可选的公网云中继（issue #7208）](https://github.com/stablyai/orca/issues/7208)——桌面主动向公共中继建出站连接、手机连中继，届时这套自建隧道就能退休了。

一句话：**Tailscale 被禁，不代表没路——反向隧道用一台公网中转铺，同样把"够不着"变成了"够得着"，而这正是寓言里仙驿在做的事，只是换了种更朴素的实现。**

## 延伸阅读

想从寓言回到硬核细节，推荐这几篇：

- [The TTY demystified — Linus Åkesson](https://www.linusakesson.net/programming/tty/)：这个领域的经典，line discipline、信号、作业控制讲得最透
- [A toy remote login server — Julia Evans](https://jvns.ca/blog/2022/07/28/toy-remote-login-server/)：手写一个迷你 SSH 服务器，亲眼看 `top` 因为没有 PTY 而拒绝启动
- [Linux 伪终端(pty) — sparkdev](https://www.cnblogs.com/sparkdev/p/11605804.html)：中文图解 master/slave 数据流
- [Remote Orca Servers — Orca Docs](https://www.onorca.dev/docs/remote-servers)：Orca 远程 server 与手机配对的官方文档
- [Orca issue #7208](https://github.com/stablyai/orca/issues/7208)：给手机端加可选公网云中继的提案（免自建隧道）
- `man ssh` 里的 `-R` 与 `sshd_config(5)` 的 `GatewayPorts`：反向端口转发的一手文档
