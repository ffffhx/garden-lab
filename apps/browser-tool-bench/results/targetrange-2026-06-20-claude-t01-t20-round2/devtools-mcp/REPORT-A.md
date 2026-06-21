# 靶场 T01-T20 第2轮 · chunk A 报告（chrome-devtools-mcp，绑 9223）

工具：chrome-devtools-mcp（MCP mcp__chrome-devtools-gh__*），attach 到用户 CDP 9223 测试 Chrome（Chrome 149，已登录 GitHub，已装 Bench Badge 扩展）。
环境：本地靶场 http://localhost:4399。账号 agent@bench.dev / bench-2026。独立复跑，自行判定。

## T01 登录与页面观察 — ✅
工号 = BENCH-7341。/login 登录跳 /dashboard，wait_for「工号」后读欢迎语「欢迎回来，Agent 测试员（工号 BENCH-7341）」。证据 T01-dashboard.png。

## T02 Network 排障 — ✅
POST /api/orders，HTTP 500，响应体 {"error":"INSUFFICIENT_INVENTORY","message":"SKU-8821 库存不足，剩余 0 件","traceId":"tr-6f6cb1032025"}。点击前无需预订阅，直接读 body。

## T03 性能诊断 — ✅
LCP≈2235ms（render delay 99.6%），LCP 元素是文本(P nodeId33)非图片。主因 /assets/blocking.css 渲染阻塞 ~1400ms；次因 /assets/heavy.js 同步长任务 crunchAnalytics（CSS 后串行）；干扰项 /assets/hero.svg 1500ms 但非阻塞并行首绘前完成，未被带偏。证据 T03-trace.json。

## T04 请求 mock 空状态 — ✅
先看真实结构 {"users":[...18...]}，用 navigate initScript 注入 fetch override 返回 {"users":[]}（结构正确非[]非改DOM）。空状态：🪴+「暂无成员，去邀请第一位伙伴吧」+「邀请成员」。证据 T04-empty-state.png。MCP 无原生 route，用 initScript 等效请求层 mock。

## T05 动态渲染与等待 — ✅
wait_for「加载更多」→click→wait_for「LIVE-512」。最终 12 条（页面「已加载 12 条（没有更多了）」），末条「系统公告：今日口令 LIVE-512」。

## T06 结构化提取 — ✅
evaluate fetch /api/products + ?page=2 直接拿 12 条 JSON。最贵 雷霆工作站 15999 元（第2页）。降序与 GT 完全一致，price/stock 为数字，两件缺货 stock=0。证据 T06-products.json。

## T07 已登录 fetch — ✅
evaluate 页面内 fetch('/api/me',{credentials:'include'})→200，plan=team-pro-2026。复用 session cookie。

## T08 Shadow DOM — ✅
a11y 快照穿透 open shadow root，click「领取今日奖励」→wait_for「兑换码」。结果 兑换码：SHADOW-99，走用户点击非 evaluate 绕过。

## T09 扩展 reload — ✅（含恢复）
manifest 1.0.0→1.0.1；navigate chrome://extensions（快照穿透嵌套 shadow DOM）找到 Bench Badge「重新加载」click；扩展页版本 1.0.1，刷新靶场徽标「BENCH EXT v1.0.1」。证据 T09-badge-v1.0.1.png。恢复：manifest 改回 1.0.0 再 reload，版本回 1.0.0，徽标回「BENCH EXT v1.0.0」，已复位。9223 未拦截，无人工。

## T10a 真实登录态默认 Profile GitHub 通知 — ✅
9223 即已登录 GitHub 常用 profile。github.com/notifications 快照：未读 70（Inbox 70 徽标 + 分页 1-25 of 70）。仓库：garden-lab 58、codex-snapshots 7、profilepilot 4、open-token-board 1。第1页标题多为 CI workflow run failed（garden-lab CI #387/#386/#376/#375、open-token-board CI #41、profilepilot Build Release Packages #7/#3/#2/#1、codex-snapshots CI #18/#17/#16、PR #2/#1 等）。人工打断 0 次（扩展安全域 attach 默认 profile，无 Allow 弹窗无重登）。只读。证据 T10a-github-notifications.png。GT 以执行当时为准，70 为本次 live 读数。

## T10b 登录态持久化专用 Profile — ⚠️ 部分
机制走「同一持久 userDataDir」隐式路线（无 state 文件 save/load）。已验证 9223 on-disk profile 的 GitHub 登录态跨会话/重启存活，attach 即免登录直达 /notifications（fetch 不跳 /login）。受限：本工具只能 attach 运行中的 9223，无 launch/指定独立专用 userDataDir/导出导入 state 的入口，无法跑显式 save→杀daemon→新session恢复两阶段，也无法用本工具起与日常隔离的专用 profile（isolatedContext 临时不落盘）。结论：持久化机制存在可用，但缺「专用 profile + 显式 save/restore 到新会话」完整演示能力。

备注：全程未用其它工具替跑，结论均有页面/Network/trace 证据；扩展改动已完全复位；未在 GitHub 真实账号做任何写操作。
