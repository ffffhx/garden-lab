# REPORT-A · agent-browser 0.27.2 · 靶场 T01-T10b (chunk A)

- 执行日期: 2026-06-20
- 工具: agent-browser 0.27.2 (CLI, 经 Bash 驱动)
- 浏览器接入: 先 `agent-browser close --all` 丢自管会话，再每条命令 `--cdp 9223` 连用户测试 Chrome (Chrome/149.0.7827.116，经 /json/version 验证)。靶场打 http://localhost:4399。
- 账号: agent@bench.dev / bench-2026 (一次登录会话内复用)。

## 结果速览

| 任务 | 判定 | 关键答案 |
| --- | --- | --- |
| T01 | ✅ | 工号 BENCH-7341 |
| T02 | ✅ | POST /api/orders 500, INSUFFICIENT_INVENTORY / SKU-8821 库存不足剩余 0 件 |
| T03 | ✅ | blocking.css(TTFB~1254ms 渲染阻塞)LCP 主因；heavy.js(crunchAnalytics ~800ms 长任务)次之；hero.svg(1555ms 非阻塞)干扰项 |
| T04 | ✅ | mock {"users":[]} → 空状态 🪴+「暂无成员，去邀请第一位伙伴吧」+「邀请成员」 |
| T05 | ✅ | 12 条；最后一条口令 LIVE-512 |
| T06 | ✅ | 12 件；最贵 雷霆工作站 ¥15999 |
| T07 | ✅ | plan = team-pro-2026 (页面内 fetch, status 200) |
| T08 | ✅ | 兑换码 SHADOW-99 (a11y 快照穿透 open shadow root, 原生点击) |
| T09 | ✅ | reload 扩展→徽标 v1.0.1 验证→改回 1.0.0 reload 恢复 |
| T10a | ✅ | GitHub 已登录(默认 9223), 未读 70 条(Inbox 70), 标题以 CI/工作流失败为主 |
| T10b | ⚠️ | agent-browser state save/load 机制端到端验证通过(bench 站点演示)；GitHub 专项因需交互式真人登录未做 |

## 逐任务记录

### T01 — ✅
填表 @e3/@e4 → 点登录 @e5 → 跳 /dashboard，欢迎语「欢迎回来，Agent 测试员（工号 BENCH-7341）」。文本已渲染，无需重试。证据: T01-dashboard.png。

### T02 — ✅
network requests --clear → 点「提交订单」@e7 → filter orders 得 POST /api/orders 500 → network request <id> --json 拿响应体 {"error":"INSUFFICIENT_INVENTORY","message":"SKU-8821 库存不足，剩余 0 件","traceId":"tr-4fe2c008db26"}。需点击前 clear；agent-browser 默认持续抓包无需预订阅。证据: T02-orders-response.json。

### T03 — ✅
无 trace insight 工具，读 Performance API。blocking.css duration1255/ttfb1254 renderBlocking=blocking; heavy.js blocking(curl 确认 crunchAnalytics while 循环 800ms 同步长任务); hero.svg duration1555/ttfb1554 non-blocking 且首绘前完成(1572ms<FCP2112ms)→干扰项。LCP=2112ms 元素=P 文本。结论 Agent 从原始时序推得。证据: T03-perf-timing.json, T03-slow.png。

### T04 — ✅
curl 确认结构 {"users":[...]}(18人) → network route "**/api/users" --body '{"users":[]}' → /users 空状态 → 截图 → unroute 恢复。证据: T04-empty-users.png。

### T05 — ✅
/livefeed → 「加载更多」@e4 出现(第一页8条) → 点击 → wait → 12 条，最后一条「系统公告：今日口令 LIVE-512」。证据: T05-livefeed.png。

### T06 — ✅
聪明路径: 数据来自 /api/products(page1 8件 hasMore, page2 4件)。浏览器点「加载第2页」验证渲染，再页面 runtime fetch 两页按 price 降序。12件最贵 雷霆工作站 15999；两件 stock=0(人体工学椅/电竞鼠标)；排序与 GT 一致。证据: T06-products.json。

### T07 — ✅
/dashboard eval 内 fetch("/api/me",{credentials:"include"}) → 200, plan=team-pro-2026。页面 runtime 带会话 cookie。证据: T07-api-me.json。

### T08 — ✅
snapshot -i 的 a11y 树穿透 open shadow root，按钮=@e9 → 原生 click(非 evaluate 绕过) → 读到「兑换码：SHADOW-99」。证据: T08-shadow-reward.png。

### T09 — ✅
改 manifest version→1.0.1。agent-browser 无扩展 reload 子命令，导航 chrome://extensions/ 用 chrome.developerPrivate.reload("jkmndkochpgaleoechlemhdhbikdecnf")(lastError=none) → getExtensionsInfo version=1.0.1 → 刷新 localhost 徽标=「BENCH EXT v1.0.1」。恢复: manifest→1.0.0 → 再 reload → version=1.0.0 → 徽标回 v1.0.0；manifest 文件已复位。证据: T09-badge-v101.png, T09-badge-restored-v100.png。企业管控未拦截。

### T10a — ✅
9223 已登录 GitHub。github.com/notifications 未撞登录墙(loggedIn=true)。Inbox 70；is:unread 渲染 25 行(全 unread)有下一页；侧栏 repo 计数 garden-lab58+codex-snapshots7+profilepilot4+open-token-board1=70=Inbox，未读总数 70。标题以 CI/工作流失败为主，另 2 条 PR。人工打断 0(attach 已运行 CDP，无弹窗)。只读。证据: T10a-github-notifications.png, T10a-counts.json, T10a-notifications.json。

### T10b — ⚠️
测 agent-browser state save/load + --session-name，独立专用 session(非 9223)。阶段一: --session-name t10b-demo 自启 → 登录 bench → state save(含 sid cookie) → close。阶段二: 全新 --session-name t10b-restore → state load → 直接 open /dashboard 未跳 /login → 欢迎语 + /api/me 200 plan=team-pro-2026 → 免登录恢复成功。机制端到端通过。判 ⚠️: GT 针对 GitHub，但真实 GitHub 首次登录需交互式真人认证(2FA/验证码)，自主子代理无法完成，改用可自主完成的 bench 站演示同一机制。安全: 状态文件用后删除，state clear --all，无残留。证据: T10b-restored-dashboard.png。

## 恢复确认
- 扩展 Bench Badge 已复位 1.0.0(manifest+运行时+页面徽标三处一致)。
- T10b 临时 session/profile/state 全部清除，9223 连接与导航正常。
- 未改任务外状态；GitHub 仅只读。
