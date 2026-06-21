# devtools-mcp · T11-T20 (2026-06-20)

Tool: mcp__chrome-devtools-gh__* on CDP 9223 (user test Chrome).

- T11 ✅ Bench Badge id=jkmndkochpgaleoechlemhdhbikdecnf (found via chrome.management.getAll on chrome://extensions). options.html opened as first-class target, filled #badge-text=HELLO-2026, save toast "已保存：徽标文字将显示为「HELLO-2026」（刷新靶场页面生效）", localhost badge = "HELLO-2026 · v1.0.0". RESET: cleared field + save → badge back to "BENCH EXT v1.0.0".
- T12 ✅ file webpack://bench/src/cart/coupon.ts, fn applySelectedCoupon, field cartState.selectedCoupon.couponCode (selectedCoupon=null), guard `if (!cartState.selectedCoupon) return null;`. Evidence: console "checkout coupon crash", bundle body + .map sourcesContent.
- T13 ✅ overlay .mobile-support-bar[data-bug="overlaps-pay-button"] fixed bottom:0 height:118px z-index:20 covers .checkout-actions (fixed bottom:40px z-index:10); elementFromPoint at pay btn center = support bar. Confirm code MOBILE-39.
- T14 ✅ component TaskSummary, traceId HYD-908, SSR pendingTasks=8/planName=starter vs client 9/team-pro; final DOM 9 待办 / team-pro. via window.__BENCH_STORE__ + console error.
- T15 ✅ SSE /api/realtime-events, 5 events, last evt-005, alert STREAM-721.
- T16 ✅ SW /sw-cache.js (scope /) controls page; cached /api/settings = blue/cached-2025.11/STALE-CACHE-17; live ?live=1 = green/live-2026.06/CACHE-BUST-42. Fix: update/unregister SW or fix fetch-handler cache policy.
- T17 ✅ clicked 确认授权 inside cross-origin iframe (127.0.0.1, auto-inlined in snapshot); parent shows 授权完成：iframe-user@bench.dev / OAUTH-314.
- T18 ✅ upload_file via file input → 文件 upload-token.txt，36 bytes，token=UPLOAD-448.
- T19 ✅ keyboard Tab cycle = notify-email → close-modal → notify-email (only [data-trap-focus]); #save-preferences is div role=button missing tabindex=0 + no Enter/Space handler → keyboard cannot reach/activate. Mouse click → 保存成功：A11Y-204.
- T20 ✅ 7/10 pass, fails 3/6/9, code FLAKE-307, flake rate 30% → unstable.

escapes (eval to advance, beyond pure read):
- T13: evaluate payBtn.click() to surface MOBILE-39 (overlay blocked real click) — 1 escape.
Other evaluate_script calls were evidence reads (sourcemap fetch, __BENCH_STORE__, SW bypass fetch, a11y activeElement/attr checks) using documented inspection paths.
