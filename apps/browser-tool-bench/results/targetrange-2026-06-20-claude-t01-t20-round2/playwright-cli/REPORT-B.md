# REPORT-B · playwright-cli 0.1.14 · 靶场 T11-T20（第2轮，干净环境精度复跑）

- 工具：playwright-cli 0.1.14（全局命令，Bash 驱动）。自管浏览器（未 attach 9223）。
- 站点：http://localhost:4399（本地靶场，运行中）。
- 浏览器：T11 用 persistentContext + 内置 Chromium（chromium-1226）经 --config 注入 --load-extension；其余任务用默认自管 chromium 会话。
- 日期：2026-06-20。证据目录：./evidence/。

| 任务 | 判定 | 结论 |
| --- | --- | --- |
| T11 | ✅ | 经 options.html UI 改徽标，localhost 验证 HELLO-2026 · v1.0.0，做完恢复默认 |
| T12 | ✅ | 经 source map 定位到原始文件/函数/空字段/guard |
| T13 | ✅ | 定位遮挡元素+CSS 原因，报出 MOBILE-39 |
| T14 | ✅ | TaskSummary / HYD-908 / 两字段 SSR vs client 全中 |
| T15 | ✅ | 5 条、evt-005、STREAM-721 |
| T16 | ✅ | 证明 SW 拦截，旧值/真实值/修复动作齐全 |
| T17 | ✅ | 跨域 iframe 内点击，父页读到 iframe-user@bench.dev / OAUTH-314 |
| T18 | ✅ | 真实 file input 上传，upload-token.txt / 36 bytes / UPLOAD-448 |
| T19 | ✅ | 键盘到不了保存按钮+缺 tabindex/handler，报 A11Y-204 |
| T20 | ✅ | 7/10、失败 3/6/9、FLAKE-307、30% flake rate |

10/10 任务 ✅。

## 工具能力要点
- T11（扩展）是关键差异点：playwright-cli 的 attach 9223 会因装扩展崩溃（按共享须知不走该路径）。改用 CLI 的 --config 文件注入 browser.launchOptions.args（--load-extension/--disable-extensions-except）+ userDataDir 持久化 + 内置 Chromium channel + --headed，全链路打通：扩展注入默认徽标 → chrome://extensions（shadow DOM）读出扩展 ID → chrome-extension://<id>/options.html 作为一等 tab 打开 → 表单改写+保存 → localhost 刷新验证 → 经 UI 清空恢复默认。扩展 options 页对 playwright-cli 是一等公民（可枚举/打开/操作）。
- Console 工具直接给出结构化 error payload（含 originalSource/functionName）；source map 经 HTTP 拉 .js.map 的 sourcesContent 验证。
- Playwright 的 actionability（pointer-events 拦截报错）天然适合 T13 遮挡诊断，无需 JS force-click。
- SSE/SW/iframe 均可经 in-page eval fetch + DOM + 原始 endpoint 三重取证。

## 各任务证据

### T11 ✅ 使用扩展
- 启动：config launchOptions.args=[--disable-extensions-except=<extension-sample>, --load-extension=<extension-sample>]，channel chromium，headed，persistent userDataDir。
- 首次加载默认徽标 BENCH EXT v1.0.0。
- 扩展 ID 发现路径：chrome://extensions 页 shadow DOM 遍历 extensions-manager > extensions-item-list > extensions-item → jkmndkochpgaleoechlemhdhbikdecnf（name "Bench Badge"）。
- options 页在 tab 列表中可见（一等公民）：chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html。
- 填 #badge-text=HELLO-2026 → 点保存 → 状态栏逐字匹配「已保存：徽标文字将显示为「HELLO-2026」（刷新靶场页面生效）」。
- localhost:4399 刷新后 #bench-ext-badge = HELLO-2026 · v1.0.0。
- 恢复：options 清空保存（状态「已保存：恢复默认徽标」）→ 刷新 localhost 徽标回 BENCH EXT v1.0.0。会话与临时 profile 已清理。
- 证据：evidence/T11-extension.txt、evidence/T11-badge-hello2026.png。

### T12 ✅ Console + Source Map
- Console error: checkout coupon crash {cartId: CART-9A2, originalSource: src/cart/coupon.ts:12, functionName: applySelectedCoupon, error: TypeError: Cannot read properties of null (reading 'couponCode')}。
- source map /assets/debug-bundle.js.map 的 sourcesContent → 原始文件 webpack://bench/src/cart/coupon.ts。
- 出错函数 applySelectedCoupon；出错字段 cartState.selectedCoupon.couponCode（selectedCoupon 为 null）。
- guard：if (!cartState.selectedCoupon) return null;。
- 证据：evidence/T12-console.json、evidence/T12-sourcemap.json。

### T13 ✅ 移动端遮挡（390×844）
- UI 点击「提交支付」→ Playwright TimeoutError：<div> from <aside class="mobile-support-bar" data-bug="overlaps-pay-button"> ... intercepts pointer events。
- .mobile-support-bar：position fixed, bottom 0, height 118px, z-index 20（覆盖 y726-844）；.checkout-actions：fixed, bottom 40px, height 54px, z-index 10（按钮中心 y≈785）。
- elementFromPoint(按钮中心) → closest('.mobile-support-bar')===true。
- 遮挡元素 .mobile-support-bar[data-bug="overlaps-pay-button"]。隐藏遮挡后真实 UI 点击 → 支付确认码：MOBILE-39。
- 证据：evidence/T13-overlap.txt。

### T14 ✅ Hydration mismatch
- Console: [hydration mismatch] {traceId: HYD-908, component: TaskSummary, ...}；window.__BENCH_STORE__ = {traceId:HYD-908, component:TaskSummary, clientState:{pendingTasks:9,planName:team-pro}, ssrState:{pendingTasks:8,planName:starter}}。
- 组件 TaskSummary，traceId HYD-908，不一致字段 pendingTasks(8→9) 与 planName(starter→team-pro)，最终 DOM「待办数量：9，套餐：team-pro」。
- 证据：evidence/T14-console.json、evidence/T14-store-raw.txt。

### T15 ✅ SSE
- 点「开始接收」后 DOM「接收完成：5 条事件，关键告警 STREAM-721」，evt-001..evt-005。
- 原始 GET /api/realtime-events 5 帧，最后 evt-005 event:alert severity:critical code:STREAM-721。
- 总数 5，末条 evt-005，告警 STREAM-721。
- 证据：evidence/T15-sse-raw.txt、evidence/T15-dom.txt。

### T16 ✅ Service Worker 缓存
- navigator.serviceWorker.getRegistrations()：scope /，active /sw-cache.js，state activated。
- in-page fetch /api/settings（经 SW）→ blue / cached-2025.11 / STALE-CACHE-17（页面显示值）。
- in-page fetch /api/settings?live=1（绕过 SW）→ green / live-2026.06 / CACHE-BUST-42（真实值）。
- sw-cache.js 源码确认：fetch handler 对 /api/settings 且无 live 参数时返回硬编码 STALE_SETTINGS。
- 修复：更新/注销 SW（/sw-cache.js）或修正 fetch handler 缓存策略并重新激活。
- 证据：evidence/T16-proof.txt、evidence/T16-sw-cache.js。
- 注：直接 curl 两个接口都返回 live（curl 不受浏览器 SW 控制），故取证用 in-page fetch 对比。

### T17 ✅ 跨域 iframe
- iframe src http://127.0.0.1:4399/iframe-child.html，父页 origin http://localhost:4399（跨域）。
- snapshot 内联 iframe；点击 frame 内「确认授权」（Playwright 自动切 contentFrame）。
- 父页显示 授权完成：iframe-user@bench.dev / OAUTH-314。
- 证据：evidence/T17-parent-result.txt。

### T18 ✅ 文件上传
- 点「Choose File」触发 file chooser → upload 真实 setFiles fixtures/upload-token.txt。
- 页面解析 文件 upload-token.txt，36 bytes，token=UPLOAD-448（走真实 file input，非 eval 伪造）。
- 证据：evidence/T18-upload-result.txt。

### T19 ✅ 键盘可访问性
- #save-preferences = <div class="fake-button save-preferences" role="button">，tabindex=null，无 data-trap-focus。
- focus trap(data-trap-focus) 只含 #notify-email、#close-modal。从 #notify-email 起 Tab 循环：close-modal ↔ notify-email，永不到达 #save-preferences。
- 原因：缺 tabindex="0" 且无 Enter/Space handler，被排除在 focus trap 外。鼠标点击保存 → A11Y-204。
- 证据：evidence/T19-a11y.txt。

### T20 ✅ Flake Rate
- DOM「通过 7/10，失败轮次 3,6,9，稳定性代码 FLAKE-307」，逐行表 1-10。
- 独立验证 /api/flake-check?run=1..10：run 3/6/9 ok:false，其余 ok:true，code 全为 FLAKE-307。
- 7/10 通过，失败 3/6/9，FLAKE-307，flake rate 30%，不稳定。
- 证据：evidence/T20-api.txt、evidence/T20-dom.txt。
