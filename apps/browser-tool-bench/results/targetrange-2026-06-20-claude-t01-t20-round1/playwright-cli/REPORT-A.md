# REPORT-A · playwright-cli · chunk A (T01-T08, T09, T10a, T10b)

- 工具：playwright-cli 0.1.14（全局命令，Bash 驱动）
- 接入方式：自管浏览器（self-launch / persistentContext），未 attach 9223（按用户约定 + 共享须知，attach 装扩展的 9223 会崩）。
- 默认会话 chrome channel 自管；T09 用 playwright 自带 Chrome for Testing 149（chromium-1226）+ --config 注入 --load-extension。
- 靶场：http://localhost:4399（本地）；账号 agent@bench.dev / bench-2026，登录一次会话内复用。
- 注意点：playwright-cli 的 daemon 会话以 cwd 的 .playwright-cli/ 为键，必须固定在 app 根目录跑命令；快照/截图默认落 cwd。

## 结果总览

| 任务 | 判定 | 关键答案 | 证据 |
| --- | --- | --- | --- |
| T01 | ✅ | 工号 BENCH-7341 | T01-dashboard.png |
| T02 | ✅ | POST /api/orders → 500，INSUFFICIENT_INVENTORY（SKU-8821 库存不足） | T02-orders-network.txt |
| T03 | ✅ | LCP 主因 blocking.css(TTFB~1203ms)，次因 heavy.js 长任务(800ms@1248ms串联)，hero.svg 干扰项 | T03-perf-diagnosis.txt + T03-trace.trace |
| T04 | ✅ | mock /api/users={"users":[]} → 空状态 🪴/暂无成员/邀请成员 | T04-users-empty.png |
| T05 | ✅ | 12 条，最后一条口令 LIVE-512 | T05-livefeed-12.png |
| T06 | ✅ | 12 件，最贵 雷霆工作站 ¥15999 | T06-catalog.json |
| T07 | ✅ | plan = team-pro-2026（页面内 fetch /api/me 复用 session） | T07-api-me-fetch.txt |
| T08 | ✅ | 兑换码 SHADOW-99（snapshot 穿透 open shadow root，真实点击） | T08-shadow-reward.png |
| T09 | ✅ | 徽标 BENCH EXT v1.0.1 | T09-badge-v1.0.1.png + T09-ext-config.json |
| T10a | N-R | 自管浏览器无默认 Profile GitHub 登录态，无接入机制 | — |
| T10b | ✅ | state-save→新会话 state-load→免登录直达 /dashboard | T10b-bench-auth.json + T10b-restored-dashboard.png |

## 逐任务说明

### T01 ✅
fill e10/e12 + click e13 登录 → 跳 /dashboard。snapshot 直接拿到 heading「欢迎回来，Agent 测试员（工号 BENCH-7341）」。已等到 /api/me 异步渲染完，未踩「加载中」时机坑。

### T02 ✅
登录后 click 提交订单。requests 列出 7. [POST] /api/orders => [500]；response-body 7 拿到 {"error":"INSUFFICIENT_INVENTORY","message":"SKU-8821 库存不足，剩余 0 件","traceId":"tr-613fa137b10f"}。playwright-cli requests 为回放式记录，无需点击前预订阅即可读响应体。

### T03 ✅
tracing-start + goto /slow，用 Performance API 取证：blocking.css TTFB~1203ms/responseEnd 1248ms（渲染阻塞）；hero.svg duration 1505ms 但并行、responseEnd 1548ms（首绘前完成，干扰项）；longtask 1 个 startTime 1248ms/duration 800ms（恰在 css responseEnd 后，证明 css→heavy.js 串联）；FCP 2420ms。结论由 Agent 从原始数据推理（无 insight 引擎）。

### T04 ✅
先 eval 读真实 /api/users 确认结构 {"users":[...18...]}（避免 mock 成 [] 触发 JS 报错）。route "**/api/users" --body '{"users":[]}' → reload → 空状态 UI（🪴 + 暂无成员，去邀请第一位伙伴吧 + 邀请成员按钮）。截图后 unroute 复位。

### T05 ✅
goto /livefeed，等首页 8 条逐条渲染完 → 加载更多出现 → click → 等第二页 4 条 → 已加载 12 条（没有更多了），最后一条「系统公告：今日口令 LIVE-512」。靠 sleep 主动等待 + snapshot 重试。

### T06 ✅
发现数据来自 /api/products?page=N（聪明路径）。页面内 fetch page=1/2 拿干净 JSON（total 12），脚本清洗 + price 降序，最贵 雷霆工作站 15999（第 2 页）。

### T07 ✅
eval 在页面 runtime 执行 fetch('/api/me',{credentials:'include'})，复用登录 session cookie，拿到 plan: team-pro-2026（200）。

### T08 ✅
snapshot 穿透 bench-widget 的 open shadow root，直接列出 button 领取今日奖励(ref e20)。真实 click e20（非 eval 绕过）→ 读到「兑换码：SHADOW-99」。

### T09 ✅（自管浏览器 + CfT --load-extension）
playwright-cli 无 chrome://extensions UI、无扩展管理 API，不能对运行中扩展原地 reload。采用等价机制：manifest version 改 1.0.1 → 用 --config（schema 支持 browser.launchOptions.args/userDataDir/headless）注入 --disable-extensions-except + --load-extension，以 headed persistentContext 启动 playwright 自带 Chrome for Testing 149（CfT 支持 --load-extension；正式版 Chrome 137+ 会静默忽略）。扩展随启动以 1.0.1 加载，打开 localhost:4399/ → 徽标 BENCH EXT v1.0.1（eval 读 #bench-ext-badge + 截图双证）。即「reload 后用页面徽标验证新版本」成立。恢复：关 extsession、manifest 改回 1.0.0（diff 验证无残差）、删临时 profile。

### T10a N-R（预期）
任务要借用本机日常 Chrome 默认 Profile 已登录的 GitHub。playwright-cli 用自管浏览器，无接入系统默认 Profile 的机制（--profile 只指向自管持久目录；Chrome 136+ 禁止对默认 user-data-dir 开 remote-debugging）。按约定不 attach 9223。故无法触达默认 Profile 的 GitHub 登录态 → N-R（与共享须知预期一致，是公平参赛边界非工具缺陷）。

### T10b ✅（本工具自管持久化机制）
测 playwright-cli 自己的 state-save/state-load。登录 /dashboard（sid cookie）→ state-save T10b-bench-auth.json（含 sid）→ close（list 显示 no browsers）→ open 全新浏览器（新 pid 72224）→ state-load 恢复 → 直接 goto /dashboard，免登录停在 /dashboard 显示欢迎语 BENCH-7341（未被踢回 /login）。证明 state 文件跨会话存活、恢复路径顺畅。注：靶场只连 localhost，本卡用本地 bench 会话演示机制本身；auth 文件仅含本地 bench 假账号 sid，非真实凭证。

## 恢复确认
- 扩展 manifest.json 已改回 1.0.0（diff 验证一致）。
- 所有 playwright-cli 会话已关闭（default + extsession），临时 profile /tmp/pw-ext-profile 已删。
- 未改任何任务外靶场状态（T04 route 已 unroute）。
