# REPORT-B · chrome-devtools-mcp (绑 9223) · T11–T20

工具：chrome-devtools-mcp (`mcp__chrome-devtools-gh__*`)，连 CDP 9223 测试 Chrome（Chrome 149）。日期 2026-06-20。本 chunk 任务页面均无需登录。证据目录：本目录。

## 环境关键发现（影响 T15/T16/T17/T20）
端口 4399 实际由两个进程抢占，都不是完整 server.mjs：
- PID 74361 `node dist/cli/codex-snapshot.mjs serve --port 4399` → 监听 IPv4 127.0.0.1:4399（快照回放服务器）。
- PID 1762 `node .../server.mjs` → 监听 IPv6 *:4399，是旧版（有 public/ 静态页，代码缺 API 路由）。

curl 服务端直连验证（绕过浏览器/SW）：
- /api/settings → 404（浏览器看到的 200 是 SW 合成的，非服务器）
- /api/settings?live=1 → 404 ; /api/flake-check?run=1 → 404 ; /api/realtime-events → 404
- http://127.0.0.1:4399/iframe-child.html → 404（localhost 同名文件 200，但跨域子页在 127.0.0.1 快照里没有）
- 页面 HTML（/realtime /flake /cache /iframe-auth）+ /api/feed /api/products → 200

结论：跑在 4399 的是快照/旧版服务器，缺 T15(SSE)/T16(live bypass)/T17(127.0.0.1 iframe-child)/T20(flake) 依赖的动态路由。属任务外基础设施问题，按须知不擅自重启（可能影响并行 chunk-A），如实记。磁盘 server.mjs 源码有这些路由，纯属运行进程陈旧。

## 逐任务
T11 使用扩展改徽标 — ✅。默认徽标 BENCH EXT v1.0.0。扩展 ID jkmndkochpgaleoechlemhdhbikdecnf，navigate 到 options.html（标题 Bench Badge 设置）。#badge-text 填 HELLO-2026 → 保存，状态栏逐字「已保存：徽标文字将显示为「HELLO-2026」（刷新靶场页面生效）」。localhost 刷新后 #bench-ext-badge = HELLO-2026 · v1.0.0（走 UI 用户路径）。已恢复：清空保存→徽标回 BENCH EXT v1.0.0。注：options target 不在 list_pages 枚举，但 navigate_page 直达可用。证据 T11-options-saved.png / T11-badge-hello2026.png

T12 Console+SourceMap — ✅。/debug-console 点应用优惠券→Console error「checkout coupon crash」。bundle /assets/debug-bundle.js→map。sourcesContent 原始文件 webpack://bench/src/cart/coupon.ts，函数 applySelectedCoupon，字段 cartState.selectedCoupon.couponCode（selectedCoupon=null），guard if (!cartState.selectedCoupon) return null;。证据 T12-debug-console.png

T13 移动端遮挡 — ✅。emulate 390x844 mobile+resize，截图确认 390px 移动布局（documentElement.clientWidth=390）。elementFromPoint(按钮中心)=.mobile-support-bar 内 DIV。遮挡元素 .mobile-support-bar[data-bug="overlaps-pay-button"]：fixed bottom:0 height:118px z-index:20，压在 .checkout-actions(fixed bottom:40px z-index:10) 上。临时套修复(隐藏遮挡条)后真实点击→支付确认码：MOBILE-39。证据 T13-mobile-confirmed.png

T14 Hydration — ✅。/hydration Console「[hydration mismatch]」；window.__BENCH_STORE__ 全状态。组件 TaskSummary，traceId HYD-908。SSR pendingTasks=8 planName=starter；Client pendingTasks=9 planName=team-pro。最终 DOM：9 待办 team-pro。证据 T14-hydration.png

T15 SSE — ❌（环境阻断）。/realtime 开始接收→GET /api/realtime-events 404，页面「连接异常，事件未收全」。curl 同 404。拿不到 5条/evt-005/STREAM-721 证据，不凭记忆答。

T16 SW 缓存 — ⚠️（部分）。getRegistrations scope localhost:4399 active /sw-cache.js。SW 源码仅拦 /api/settings（无 live）返回 STALE 并加 X-Bench-Cache: service-worker-stale。/cache 显示旧值 theme=blue release=cached-2025.11 featureFlag=STALE-CACHE-17，Network 该请求带 X-Bench-Cache 响应头→证明 SW 拦截非 HTTP cache。修复：更新/注销 SW 或修 fetch handler 策略。缺口：?live=1 取真实值→服务器 404（旧版无 live 分支，curl 同），真实值无法取证→降 ⚠️。证据 T16-cache-stale.png

T17 跨域 iframe — ❌（环境阻断）。/iframe-auth 内嵌 http://127.0.0.1:4399/iframe-child.html 显示 not found。curl 该 URL 404（快照 127.0.0.1 origin 无此文件）。iframe 内无确认授权按钮，无法触发 postMessage，父页停在「等待授权完成…」。拿不到 iframe-user@bench.dev/OAUTH-314。证据 T17-iframe-notfound.png

T18 文件上传 — ✅。/input-lab file input #token-file(accept=.txt)，upload_file 上传 fixtures/upload-token.txt（真实上传路径）。页面显示「文件 upload-token.txt，36 bytes，token=UPLOAD-448」。证据 T18-upload.png

T19 键盘可访问性 — ✅。/a11y-modal 打开偏好设置。#save-preferences = <div class="fake-button save-preferences" role="button">，无 tabindex(null)、无 data-trap-focus、无 Enter/Space 处理。focus trap 仅 #notify-email + #close-modal。键盘验证 Tab 循环 notify-email↔close-modal，永远到不了 #save-preferences。鼠标点保存→保存成功：A11Y-204。证据 T19-a11y.png

T20 Flake — ❌（环境阻断）。/flake 运行10次→GET /api/flake-check?run=1 404，页面停「尚未运行」表格空。curl 同 404。无法统计 7/10、3/6/9、FLAKE-307、30%。页面说明文案「第3/6/9次会失败」是题面非运行结果，不据此答 GT。

## 汇总
| 任务 | 结果 | 关键答案 |
|---|---|---|
| T11 | ✅ | HELLO-2026 · v1.0.0（已恢复默认） |
| T12 | ✅ | coupon.ts / applySelectedCoupon / selectedCoupon null / guard |
| T13 | ✅ | .mobile-support-bar z-index:20 遮挡 / MOBILE-39 |
| T14 | ✅ | TaskSummary / HYD-908 / 8→9 starter→team-pro |
| T15 | ❌ | /api/realtime-events 404（环境） |
| T16 | ⚠️ | SW 旧值 blue/cached-2025.11/STALE-CACHE-17 已证；?live=1 404 取不到真实值 |
| T17 | ❌ | 127.0.0.1/iframe-child.html 404（环境） |
| T18 | ✅ | upload-token.txt / 36 bytes / UPLOAD-448 |
| T19 | ✅ | #save-preferences 缺 tabindex+键盘handler / A11Y-204 |
| T20 | ❌ | /api/flake-check 404（环境） |

T15/T16/T17/T20 受影响同一根因：跑在 4399 的是快照/旧版服务器，缺动态 API 路由与 127.0.0.1 iframe 快照。未擅自重启该任务外服务。
