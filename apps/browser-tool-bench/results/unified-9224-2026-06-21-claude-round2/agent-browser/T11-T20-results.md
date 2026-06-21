# agent-browser (0.27.2, --cdp 9224) · T11-T20 results

All run against localhost:4399 on user's CDP 9224 Chrome (GitHub ffffhx, Bench Badge ext jkmndkochpgaleoechlemhdhbikdecnf).

- T11 ✅ Options page chrome-extension://.../options.html reachable via direct open. Filled #badge-text=HELLO-2026 via UI form, saved (confirm toast), target badge => `HELLO-2026 · v1.0.0`. Restored default (cleared text, saved) => `BENCH EXT v1.0.0`. ext ID known from brief; options page NOT in `tab list` (page targets only). No escape.
- T12 ✅ Console error "checkout coupon crash" {cartId:CART-9A2, originalSource: src/cart/coupon.ts:12, functionName: applySelectedCoupon, TypeError reading 'couponCode'}. File webpack://bench/src/cart/coupon.ts, fn applySelectedCoupon, null field cartState.selectedCoupon (.couponCode). Guard: if(!cartState.selectedCoupon) return null. From `console` only. No escape.
- T13 ✅ viewport 390x844. Native click reported button covered by div. .mobile-support-bar fixed bottom:0 height:118px z-index:20 overlaps .checkout-actions fixed bottom:40px z-index:10. Code MOBILE-39. ESCAPE x2 (eval elementFromPoint + grep page for code).
- T14 ✅ Console [hydration mismatch] {traceId:HYD-908, component:TaskSummary}. window.__BENCH_STORE__: ssr{pending 8, starter} client{pending 9, team-pro}; DOM final 9 待办 / team-pro. ESCAPE x1 (eval store - console truncated nested objs).
- T15 ✅ Clicked 开始接收, DOM rendered 5 events evt-001..evt-005, last evt-005 alert STREAM-721. No escape.
- T16 ✅ Page shows blue/cached-2025.11/STALE-CACHE-17. SW sw-cache.js active scope /. /api/settings(intercepted)=blue/cached-2025.11/STALE-CACHE-17 ; /api/settings?live=1=green/live-2026.06/CACHE-BUST-42. Fix: unregister/update SW. ESCAPE x1 (eval getRegistrations + bypass fetch).
- T17 ✅ Snapshot inlined cross-origin iframe (127.0.0.1:4399). Clicked 确认授权 (ref direct), parent => 授权完成：iframe-user@bench.dev / OAUTH-314. No escape.
- T18 ✅ upload @fileinput fixtures/upload-token.txt => 文件 upload-token.txt，36 bytes，token=UPLOAD-448. Native upload path. No escape.
- T19 ✅ Modal Tab cycle traps #notify-email <-> #close-modal; #save-preferences (<div role=button> no tabindex, no key handler) unreachable by keyboard. Mouse click => A11Y-204. ESCAPE x1 (eval activeElement tracking during Tab).
- T20 ✅ Run 10x: pass 7/10, fail 3/10 rounds 3/6/9, code FLAKE-307, flake rate 30%, unstable. Table read from DOM. No escape. (screenshot T20-flake.png)

Extension restored to default after T11. browserOps ~95, escapes 5 (T13x2, T14, T16, T19).
