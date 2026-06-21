# REPORT-B · chrome-devtools-mcp (T11–T20) · Round2 干净复跑

- 工具：chrome-devtools-mcp（MCP `mcp__chrome-devtools-gh__*`），绑 CDP 9223 测试 Chrome（Chrome 149）
- 站点：http://localhost:4399（本地靶场）
- 日期：2026-06-20
- 证据目录：本目录下 T11–T20 截图 + 本报告内联的 Network/DOM 证据

所有 10 个任务均独立复跑、用页面/Network/source-map/DOM 证据判定，未参考第 1 轮结果。

---

## T11 · 使用扩展改徽标 — ✅
- 扩展 ID 发现路径：`chrome://extensions` 的 `extensions-manager` shadow DOM 枚举 → Bench Badge = `jkmndkochpgaleoechlemhdhbikdecnf`（同时列出其它 7 个扩展）。
- options 页是该工具的一等 target：`navigate_page` 直达 `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`，snapshot 可读到 `#badge-text` 输入框与「保存」。
- 走 UI 路径：填 `HELLO-2026` → 点保存 → 状态栏逐字 `已保存：徽标文字将显示为「HELLO-2026」（刷新靶场页面生效）`。
- 在 localhost:4399 验证 `#bench-ext-badge` = **`HELLO-2026 · v1.0.0`**。
- 复位：options 页清空 → 保存（`已保存：恢复默认徽标`）→ reload localhost → 徽标回 `BENCH EXT v1.0.0`（已恢复默认）。
- 证据：T11-options-saved.png / T11-badge-changed.png / T11-badge-restored.png

## T12 · Console 与 Source Map — ✅
- 点「应用优惠券」→ 页面笼统文案 `应用失败，请联系管理员（错误码已上报）`；Console error `checkout coupon crash`。
- 读 `/assets/debug-bundle.js.map` 的 `sourcesContent`：原始文件 **`webpack://bench/src/cart/coupon.ts`**，函数 **`applySelectedCoupon`**。
- 出错字段 **`cartState.selectedCoupon.couponCode`**（`selectedCoupon` 为 `null`）。
- guard：**`if (!cartState.selectedCoupon) return null;`**（source map 注释里亦写明同样的 Expected guard）。
- 证据：T12-debug-console.png + source map sourcesContent。

## T13 · 移动端布局遮挡 — ✅
- viewport 设 390×844（emulate mobile+touch）。
- `elementFromPoint(按钮中心)` 命中 `div[data-bug="overlaps-pay-button"]`；点击未触发确认。
- 遮挡元素：**`.mobile-support-bar[data-bug="overlaps-pay-button"]`** — `position:fixed; bottom:0; height:118px; z-index:20`，盖住 `.checkout-actions`（`fixed; bottom:40px; z-index:10`）。
- 正常确认码：**`支付确认码：MOBILE-39`**（页面 handler 源码确认，非强点上报）。
- 证据：T13-layout-mobile.png + computed style。

## T14 · SPA Hydration 不一致 — ✅
- Console error `[hydration mismatch]`；`window.__BENCH_STORE__` 给出全量证据。
- 组件 **`TaskSummary`**，traceId **`HYD-908`**。
- SSR：`pendingTasks=8, planName=starter`；Client：`pendingTasks=9, planName=team-pro`。
- 客户端接管后 DOM：**9 个待办，team-pro 套餐**。
- 证据：T14-hydration.png + store dump。

## T15 · SSE 实时流 — ✅
- 点「开始接收」，等流结束。Network `eventsource` 请求 `GET /api/realtime-events` [200, text/event-stream]。
- 响应体含 evt-001..evt-005。总数 **5**，最后 id **`evt-005`**。
- 关键告警：evt-005 `type=alert, severity=critical, code=STREAM-721` → **`STREAM-721`**。
- 证据：T15-realtime.png + SSE 响应体。

## T16 · Service Worker 缓存 — ✅
- SW `getRegistrations()`：`/sw-cache.js`，scope `http://localhost:4399/`，state `activated`，控制页面。
- 页面（SW 拦截 `/api/settings`）旧值：theme=**blue**，release=**cached-2025.11**，featureFlag=**STALE-CACHE-17**。
- 绕过 `/api/settings?live=1` 真实值：theme=**green**，release=**live-2026.06**，featureFlag=**CACHE-BUST-42**。
- 修复：更新/注销 Service Worker（或修正 fetch handler 缓存策略并重新激活）。
- 证据：T16-cache.png + SW info + 两路 fetch 对比。

## T17 · 跨域 iframe 授权 — ✅
- iframe 来自 `http://127.0.0.1:4399/iframe-child.html`，与父页 `localhost:4399` 不同源；snapshot 内联了子 frame。
- 在 iframe 内点「确认授权」→ 父页 postMessage 显示 **`授权完成：iframe-user@bench.dev / OAUTH-314`**。
- account=`iframe-user@bench.dev`，code=**`OAUTH-314`**。
- 证据：T17-iframe-auth.png。

## T18 · 文件上传 — ✅
- `upload_file` 把仓库 `fixtures/upload-token.txt` 经 file input 真实上传。
- 页面显示 **`文件 upload-token.txt，36 bytes，token=UPLOAD-448`**。
- 文件名 `upload-token.txt`、**36 bytes**、token **`UPLOAD-448`**。
- 证据：T18-input-lab.png。

## T19 · 键盘可访问性 — ✅
- 点「打开偏好设置」。键盘 Tab：`#notify-email` → `#close-modal` → 回 `#notify-email`，**focus trap 永远到不了保存按钮**。
- `#save-preferences` 是 `<div class="fake-button save-preferences" role="button">`，**缺 `tabindex="0"`**、无 Enter/Space handler、无 `[data-trap-focus]` → 键盘无法聚焦/激活。
- 鼠标点击保存后确认码：**`保存成功：A11Y-204`**。
- 证据：T19-a11y-modal.png + DOM 属性 + 实测 Tab 序列。

## T20 · Flake Rate — ✅
- 独立脚本 `fetch /api/flake-check?run=1..10`：run 3/6/9 `ok:false`，其余 `ok:true`，code 全为 `FLAKE-307`。
- 页面「运行 10 次」UI 同样显示：通过 **7/10**，失败轮次 **3,6,9**，稳定性代码 **`FLAKE-307`**。
- 结论：不稳定，flake rate = **30%**。
- 证据：T20-flake.png + API 逐次结果。

---

### 汇总
| 任务 | 结果 |
|---|---|
| T11 | ✅ |
| T12 | ✅ |
| T13 | ✅ |
| T14 | ✅ |
| T15 | ✅ |
| T16 | ✅ |
| T17 | ✅ |
| T18 | ✅ |
| T19 | ✅ |
| T20 | ✅ |

扩展改动（T11）已恢复默认徽标 `BENCH EXT v1.0.0`，未遗留任务外状态。
