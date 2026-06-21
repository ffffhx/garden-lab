# REPORT-B · bb-browser 0.14.2 · 靶场 T11-T20 (Round 2, 干净环境复跑)

- 工具：bb-browser 0.14.2（全局命令，Bash 驱动），`--port 9223` attach 用户测试 Chrome（Chrome 149）
- 接入验证：`status` 显示 `CDP connected: yes`，tab list 含 localhost:4399 多个 tab；本轮新开专用 tab 操作
- 日期：2026-06-20 / 账号：本 chunk 无登录任务
- 已知短板（如实记录）：无 viewport/emulate/resize；无 route/mock；无 file upload / setFileInputFiles；chrome-extension:// scheme 被规范化为 https:// 导致 chrome-error；跨域 iframe/OOPIF 不入快照、不入 tab 列表、contentDocument 为 null、--domain 无法切入子帧。

| 任务 | 判定 | 一句话 |
| --- | --- | --- |
| T11 使用扩展改徽标 | ❌ | 无法导航到 chrome-extension://options.html（scheme 被加 https:// → chrome-error），扩展无 SW 故无独立 target，无 eval 旁路 |
| T12 Console/SourceMap | ✅ | source map 映射回 coupon.ts / applySelectedCoupon / selectedCoupon=null，guard 给出 |
| T13 移动端遮挡 | ⚠️ | 无 viewport 设置能力，无法在 390px 复现遮挡；遮挡元素/CSS 由源码佐证，MOBILE-39 由真实触发确认 |
| T14 Hydration | ✅ | window.__BENCH_STORE__ + console error：TaskSummary / HYD-908 / 8→9 / starter→team-pro |
| T15 SSE | ✅ | DOM + Network(EventSource 200) + 原始流：5 条 / evt-005 / STREAM-721(critical) |
| T16 SW 缓存 | ✅ | SW=/sw-cache.js；缓存值 vs ?live=1 真实值全量；修复=更新/注销 SW |
| T17 跨域 iframe | ❌ | 跨域 iframe(127.0.0.1:4399) 不入快照/tab，contentDocument null，--domain 切不进子帧，无法点 #approve |
| T18 文件上传 | ⚠️ | 无 upload 能力；走 eval 伪造 File→页面解析出 upload-token.txt/36 bytes/UPLOAD-448，但非真实上传路径 |
| T19 键盘可访问性 | ✅ | trap=[notify-email,close-modal]，#save-preferences 是 div role=button、缺 tabindex、无 Enter/Space；鼠标点→A11Y-204 |
| T20 Flake 稳定性 | ✅ | DOM + Network(10 个 /api/flake-check) + 逐 run curl：7/10，失败 3/6/9，FLAKE-307，30% flake |

## 细节

### T11 ❌
- 默认徽标确认：localhost:4399 `#bench-ext-badge` = `BENCH EXT v1.0.0`。
- 扩展 ID jkmndkochpgaleoechlemhdhbikdecnf（content-script-only，无 SW，无独立 page/SW target）。
- `open`/`goto chrome-extension://.../options.html` → URL 被改写为 https://chrome-extension://... → chrome-error://chromewebdata/。
- 页面世界 `location.href='chrome-extension://...'` 被浏览器禁止 → chrome-error。
- `--domain jkmndko/options.html` 只匹配到 chrome-error tab，hasStorage=false。
- 无法到达扩展设置页，无法改徽标。未对扩展做任何改动，storage 默认，无需恢复（复核仍 BENCH EXT v1.0.0）。

### T12 ✅
- bundle /assets/debug-bundle.js，含 //# sourceMappingURL=/assets/debug-bundle.js.map。
- sources: webpack://bench/src/cart/coupon.ts、checkout.ts。
- coupon.ts: applySelectedCoupon 直接 cartState.selectedCoupon.couponCode.toUpperCase()，selectedCoupon 可 null。
- 页面文案 应用失败，请联系管理员（错误码已上报）；bundle 内含 console 'checkout coupon crash'（被 try/catch 包住）。
- guard: if (!cartState.selectedCoupon) return null;
- 注：console 监控对被 catch 的日志捕获不稳，改用 source map + bundle grep 取证。

### T13 ⚠️
- bb-browser 无 viewport/emulate/resize，视口固定 1280×747；@media(max-width:480px) 不生效，.mobile-support-bar 在桌面为 display:none，遮挡不发生。
- 遮挡诊断来自 curl 的 CSS：.checkout-actions{fixed;bottom:40px;z-index:10} 被 .mobile-support-bar[data-bug=overlaps-pay-button]{fixed;bottom:0;height:118px;z-index:20} 覆盖。
- MOBILE-39：桌面宽度真实触发 handler 得 支付确认码：MOBILE-39。
- 无法设 390×844、无法交互复现遮挡 → ⚠️。

### T14 ✅
- window.__BENCH_STORE__ = {traceId:HYD-908, component:TaskSummary, ssrState:{8,starter}, clientState:{9,team-pro}}。
- console [ERROR] [hydration mismatch] Object (hydration:28)。最终 DOM：9 / team-pro。

### T15 ✅
- Network GET /api/realtime-events EventSource 200。页面 接收完成：5 条事件，关键告警 STREAM-721。
- 原始 SSE(curl)：evt-005 event:alert {severity:critical, code:STREAM-721}。
- 注：trace body 对 streaming 取不到，改用 curl。

### T16 ✅
- SW scope localhost:4399/，active /sw-cache.js。
- 拦截值 theme=blue/release=cached-2025.11/featureFlag=STALE-CACHE-17。
- 真实值(?live=1 绕过 + 服务端直连 curl 同) theme=green/release=live-2026.06/featureFlag=CACHE-BUST-42。
- 修复：更新/注销 SW 或修正 fetch handler 缓存策略并重新激活。

### T17 ❌
- 父 origin localhost:4399，iframe src=http://127.0.0.1:4399/iframe-child.html（跨域）。
- snap 只列父页 link，子帧不内联；tab list 无子帧 target；contentDocument null；--domain 127.0.0.1 仍在父页执行。
- 子页 #approve 需真实 click 才 postMessage，bb-browser 点不到 → ❌。未伪造 postMessage 旁路。

### T18 ⚠️
- input type=file + change handler；bb-browser 无 upload/setFileInputFiles。
- eval 旁路：读真实 fixture(36B)→base64→构造 File+DataTransfer→dispatch change。
- 页面解析 文件 upload-token.txt，36 bytes，token=UPLOAD-448（值正确）。
- 非真实上传路径 → ⚠️。

### T19 ✅
- trap [data-trap-focus] = notify-email + close-modal；press Tab 焦点不离开 trap，从不到 #save-preferences。
- #save-preferences = div role=button，tabindex 缺失，无 Enter/Space handler。
- 鼠标 click → 保存成功：A11Y-204。

### T20 ✅
- Network 10 个 GET /api/flake-check?run=1..10（全 200）。
- summary 通过 7/10，失败轮次 3,6,9，FLAKE-307；表格逐行一致。
- 逐 run curl：run 3/6/9 ok:false，其余 true，code 恒 FLAKE-307 → 确定性失败，flake 30%，不稳定。

## bb-browser 观察
- attach 9223 稳定，多 tab 并行无碍；eval/network/trace 取证强。
- click <ref> 偶发「报告已点击但 handler 未触发」（T13/T19 复现），需 eval .click() 兜底。
- console/errors 对被 try/catch 的日志捕获不稳。
- 致命短板：viewport 模拟、文件上传、chrome-extension scheme、跨域 iframe/OOPIF。
