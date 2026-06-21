# REPORT-B · agent-browser · 靶场 T11-T20 (chunk B)

- 工具：agent-browser 0.27.2（CLI，Bash 驱动）
- 浏览器：用户 CDP 9223 测试 Chrome（Chrome 149，UA 已核）；`close --all` 丢自管会话后每条命令 `--cdp 9223`
- 日期：2026-06-20
- 账号：本 chunk 无任务需登录

## 关键环境发现（影响 T15/T16/T17/T20）

端口 4399 上有两个进程在监听：
- `localhost`/`::1`:4399 → PID 1762 = `apps/browser-tool-bench/server.mjs`（真正的靶场服务）
- `127.0.0.1`:4399 → PID 74361 = `dist/cli/codex-snapshot.mjs serve`（无关进程）

两个独立问题：
1. 靶场服务进程过期：PID 1762 启动于 6/12 19:59，server.mjs 磁盘文件改于 6/19 20:36。磁盘第 199-228 行已含 /api/settings、/api/flake-check、/api/realtime-events，但运行进程是旧版，这三条路由全部 404（老路由 /api/me /users /feed /products 正常）。→ 打掉 T15、T20 网络数据源，并使 T16 的 live 旁路失败。
2. 127.0.0.1 被占：T17 跨域 iframe src=http://127.0.0.1:4399/iframe-child.html，但 127.0.0.1:4399 是 codex-snapshot（PID74361）返回 404。靶场服务只绑 ::1。→ iframe 内容永远加载不出。

按铁律「不改任务以外状态、跑不通记 ❌/N-R 写清卡点」，未重启 PID1762/未杀 PID74361（任务外基础设施，且会干扰并行 chunk-A）。

## 逐任务

### T11 使用扩展 — ✅
扩展 ID 经 chrome://extensions shadow DOM 枚举得 Bench Badge=jkmndkochpgaleoechlemhdhbikdecnf（content-script-only，不在 /json/list）。options 页为一等 target，填 HELLO-2026 保存，状态逐字「已保存：徽标文字将显示为「HELLO-2026」（刷新靶场页面生效）」。localhost 验证 #bench-ext-badge = HELLO-2026 · v1.0.0（T11-badge-hello.png）。已恢复默认 BENCH EXT v1.0.0。

### T12 Console/SourceMap — ✅
/debug-console 点应用优惠券。Console error: checkout coupon crash, functionName=applySelectedCoupon, TypeError reading 'couponCode'（T12-console.json）。/assets/debug-bundle.js.map sourcesContent: 文件 webpack://bench/src/cart/coupon.ts，函数 applySelectedCoupon，字段 cartState.selectedCoupon.couponCode（selectedCoupon=null），guard if(!cartState.selectedCoupon) return null;（T12-debug-bundle.js.map）。

### T13 移动端遮挡 — ✅
set viewport 390x844。工具 click 被拒「covered by <div>」。elementsFromPoint 含 .mobile-support-bar[data-bug=overlaps-pay-button]。CSS：support-bar fixed bottom:0 height:118px z-index:20 盖住 .checkout-actions(fixed bottom:40px z-index:10)。确认码 支付确认码：MOBILE-39（T13-mobile-overlap.png）。

### T14 Hydration — ✅
/hydration Console [hydration mismatch] traceId HYD-908 component TaskSummary。window.__BENCH_STORE__：SSR pendingTasks=8 planName=starter；Client pendingTasks=9 planName=team-pro。DOM 最终 9 待办 team-pro（T14-store.json）。

### T15 SSE — ❌（环境阻断）
点开始接收，EventSource GET /api/realtime-events = 404 text/html（CDP 抓到），页面 onerror「连接异常，事件未收全」。过期服务进程缺路由，事件流从不产生，无法得 5条/evt-005/STREAM-721 网络证据。拒绝凭源码答。T15-sse-error.png / T15-T16-T20-blocker.txt。

### T16 Service Worker 缓存 — ⚠️（部分）
已证 SW 导致：/sw-cache.js active 控制 scope localhost:4399/，fetch handler 对无 ?live 的 /api/settings respondWith 过期配置（header X-Bench-Cache: service-worker-stale）。旧值 theme=blue release=cached-2025.11 featureFlag=STALE-CACHE-17。修复：更新/注销 SW。缺口：旁路 /api/settings?live=1 = 404（过期服务进程缺路由），拿不到真实 live 网络值，拒绝凭源码答 → 判 ⚠️。T16-cache-stale.png / T16-evidence.txt。

### T17 跨域 iframe — ❌（环境阻断）
iframe src=http://127.0.0.1:4399/iframe-child.html，127.0.0.1:4399=codex-snapshot 404 "not found"，iframe 内容不渲染（跨域无 contentDocument）。靶场服务只绑 ::1（localhost/[::1]/iframe-child.html 才 200，含确认授权按钮+OAUTH-314）。无按钮可点/无 postMessage，父页停在等待授权完成。T17-iframe-notfound.png / T17-blocker.txt。

### T18 文件上传 — ✅
/input-lab upload input[type=file]（input#token-file）真实上传 fixtures/upload-token.txt（实测 36 bytes）。页面显示 文件 upload-token.txt，36 bytes，token=UPLOAD-448（T18-upload.png）。

### T19 键盘可访问性 — ✅
/a11y-modal 打开弹窗。Tab/Shift+Tab 循环只在 #notify-email ↔ #close-modal，永不到 #save-preferences。保存=<div role=button id=save-preferences> 缺 tabindex(null)、无 data-trap-focus、无 Enter/Space handler。鼠标点击确认码 A11Y-204（T19-a11y.png）。

### T20 Flake — ❌（环境阻断）
/flake 点运行10次，GET /api/flake-check?run=1 = 404，run 不推进，停「尚未运行」，无 7-3/3-6-9/FLAKE-307 统计。过期服务进程缺路由。拒绝凭文案/源码答。T20-flake.png。

## 汇总表

| 任务 | 判级 | 关键 |
| --- | --- | --- |
| T11 | ✅ | HELLO-2026 · v1.0.0（已恢复） |
| T12 | ✅ | coupon.ts/applySelectedCoupon/selectedCoupon.couponCode/guard |
| T13 | ✅ | .mobile-support-bar[data-bug=overlaps-pay-button] z-index:20；MOBILE-39 |
| T14 | ✅ | TaskSummary/HYD-908/8→9/starter→team-pro |
| T15 | ❌ | /api/realtime-events 404 过期服务进程 |
| T16 | ⚠️ | SW 旧值齐(blue/cached-2025.11/STALE-CACHE-17)+修复；live旁路404 |
| T17 | ❌ | iframe 127.0.0.1 被 codex-snapshot 占 404 |
| T18 | ✅ | upload-token.txt/36 bytes/UPLOAD-448 |
| T19 | ✅ | 键盘到不了 #save-preferences（缺 tabindex/handler）；A11Y-204 |
| T20 | ❌ | /api/flake-check 404 过期服务进程 |

恢复：扩展徽标复位 BENCH EXT v1.0.0；viewport 复位 1512×746；未重启/杀任何服务进程。
