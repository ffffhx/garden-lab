# REPORT-A · chrome-devtools-mcp (CDP 9223) · T01–T10b

工具：chrome-devtools-mcp（mcp__chrome-devtools-gh__*），绑定用户 CDP 9223 测试 Chrome（Chrome 149，已登录 GitHub，已装 content-script-only 扩展 Bench Badge）。
执行日期：2026-06-20。靶场 http://localhost:4399（本地）。登录会话（agent@bench.dev / bench-2026）本 chunk 内登录一次复用。

## 结果汇总

| 任务 | 判定 | 答案 | 证据 |
| --- | --- | --- | --- |
| T01 | ✅ | 工号 BENCH-7341 | T01-dashboard.png；登录后 /dashboard 欢迎语 |
| T02 | ✅ | POST /api/orders 500，INSUFFICIENT_INVENTORY「SKU-8821 库存不足，剩余 0 件」 | T02-order-fail.png, T02-orders-response.json |
| T03 | ✅ | blocking.css(1206ms 阻塞渲染)=LCP 主因；heavy.js(crunchAnalytics ~800ms 长任务)次之；hero.svg(1508ms)并行非阻塞=干扰项 | T03-slow-trace.json；LCPBreakdown/RenderBlocking insight + resource timing |
| T04 | ✅ | /api/users mock 成 {"users":[]} → 空状态 🪴「暂无成员，去邀请第一位伙伴吧」 | T04-empty-state.png；navigate initScript fetch override |
| T05 | ✅ | 12 条；最后一条口令 LIVE-512 | T05-livefeed-12.png |
| T06 | ✅ | 12 件；最贵 雷霆工作站 15999 元（第2页） | T06-catalog.json；读 /api/products?page=1,2 |
| T07 | ✅ | plan = team-pro-2026 | evaluate_script 页面内 fetch('/api/me') 200 |
| T08 | ✅ | 兑换码 SHADOW-99 | T08-shadow-reward.png；a11y 快照穿透 open shadow root |
| T09 | ✅ | manifest 1.0.0→1.0.1→reload→徽标 v1.0.1→改回 1.0.0 reload 恢复 | T09-badge-v101.png；chrome://extensions「重新加载」+ 页面徽标验证 |
| T10a | ✅ | GitHub 未读 70（默认 9223 profile，零重新登录） | T10a-github-notifications.png |
| T10b | ✅ | 持久 profile 免登录直达；隔离新会话撞登录墙（对照） | T10b-fresh-context-loginwall.png |

## 关键说明
- T02：页面只显示笼统文案，真实原因从响应体读取；devtools-mcp 自动记录网络，list→get request 直接拿 500 body。
- T03：trace LCP 2069ms，render delay 99.8%，LCP 元素为文本段落。blocking.css 1206ms 阻塞渲染=主因；hero.svg 1508ms 但 responseEnd 1515ms 在 LCP 前且非阻塞=干扰项；heavy.js 下载8ms 但 crunchAnalytics 同步 ~800ms 长任务，CSS 返回后串行。
- T04：先读真实结构(18人 {"users":[...]})，再用 navigate initScript 注入 fetch override 返回正确结构 {"users":[]}（未踩 mock 成 [] 报错坑）。
- T08：a11y 快照穿透 open shadow root，按钮和兑换码直接出现在快照，正常 click 非 evaluate 绕过。
- T09：9223 企业管控未拦截解压扩展 reload，chrome://extensions 正常操作，页面徽标二次验证。已完整恢复。
- T10a：连默认 9223 profile（已授权 auto-connect），零人工打断零重新登录，只读未写。
- T10b：devtools-mcp 持久化=同一持久 userDataDir（无显式 state 文件）。默认 context 直达 notifications(70 未读)；新建 isolatedContext 新会话访问被重定向到 github.com/login，证明登录态绑定持久 profile，裸新会话失败（对照成立）。隔天/换目录存活未单独验证（受限固定 9223）。

## 扩展恢复确认
- manifest.json version = 1.0.0（disk 确认）；Chrome 内 Bench Badge = 1.0.0；页面徽标 = BENCH EXT v1.0.0。未改 badgeText，未触碰其他扩展状态。
