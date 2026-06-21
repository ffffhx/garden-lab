# bb-browser 0.14.2 — T11..T20 evidence (CDP 9223, 2026-06-20)

## Tool-level findings (bb-browser short板)
- native `click @ref` reports "已点击: element" but does NOT fire the page handler (no error, no DOM change). Confirmed on /debug-console + fresh reload. => had to eval-click for every interactive task.
- native `console` / `errors` capture returns "没有控制台消息/JS 错误" even after real errors fire => had to install console hooks via eval IIFE.
- NO viewport / device-emulation primitive => cannot reach mobile 390x844 (T13). resizeTo no-op (innerWidth stays 1280). raw CDP websocket refused: 403 "Rejected ... origin" (bb daemon owns the connection, second socket blocked).
- chrome:// and chrome-extension:// URL normalization BUG: `open chrome://extensions` -> `https://chrome://extensions` -> chrome-error://chromewebdata. `open chrome-extension://<id>/options.html` -> target `https://chrome-extension//<id>/options.html` -> chrome-error. => extension options page unreachable (T11).
- NO OOPIF / cross-origin frame switch: snap does not inline the iframe; tab list only shows top-level pages; cannot address the iframe target id (Tab not found). parent eval can't cross origin. (T17)
- trace body NOT available for streaming (SSE T15) responses ("Request not found in trace").
- eval persists a single context: const/var redeclare across calls throws "already declared" => wrap in IIFE.

## Results
- T11 ❌ cannot reach chrome-extension://.../options.html (https:// mangling). Badge stayed default BENCH EXT v1.0.0 (unchanged, no pollution).
- T12 ✅ file webpack://bench/src/cart/coupon.ts, fn applySelectedCoupon, field cartState.selectedCoupon.couponCode (selectedCoupon null), guard `if(!cartState.selectedCoupon) return null;`. Stack debug-bundle.js:5:37; source map sourcesContent verified. (eval click+hook; native click/console broken)
- T13 ⚠️ overlap .mobile-support-bar[data-bug="overlaps-pay-button"] bottom:0 height:118px z-index:20 covers .checkout-actions bottom:40px z-index:10; code MOBILE-39. Diagnosis from CSS+JS source; bb-browser could NOT set 390x844 viewport (no primitive) so no live click-block reproduction.
- T14 ✅ component TaskSummary, traceId HYD-908, SSR pendingTasks=8/planName=starter, client=9/team-pro; final DOM "9 待办 team-pro". (window.__BENCH_STORE__)
- T15 ✅ 5 events, last evt-005, alert STREAM-721 (severity critical). real SSE waited; trace confirmed GET /api/realtime-events.
- T16 ✅ SW /sw-cache.js controls page; intercepts /api/settings -> blue/cached-2025.11/STALE-CACHE-17; bypass ?live=1 (and direct) -> green/live-2026.06/CACHE-BUST-42; fix: update/unregister SW or fix fetch handler.
- T17 ❌ cannot operate cross-origin iframe (no OOPIF switch). Source GT: iframe-user@bench.dev / OAUTH-314 (not obtained via tool interaction).
- T18 ⚠️ page parsed upload-token.txt, 36 bytes, token=UPLOAD-448 — but via eval-constructed File/DataTransfer (no upload primitive), not real file chooser.
- T19 ✅ #save-preferences is <div role=button>, no tabindex (tabIndex=-1), not in focus trap [notify-email,close-modal], only click listener (no keydown) => keyboard cannot reach/activate; mouse confirm code A11Y-204.
- T20 ✅ 7/10 pass, 3 fail, failed rounds 3/6/9, FLAKE-307, flake rate 30% unstable; trace confirmed GET /api/flake-check?run=1..10.
