# Chrome DevTools MCP rerun2 report

- Tool: Chrome DevTools MCP 1.2.0
- Mode: `cdp-9223`
- CDP: `http://127.0.0.1:9223`
- Launch args: `--browserUrl http://127.0.0.1:9223 --experimentalIncludeAllPages --categoryExtensions --no-usage-statistics`
- Final Bench Badge: `BENCH EXT v1.0.0`; manifest restored to `1.0.0`.

## Metrics

- `elapsed_ms`: `300000`
- `tool_calls`: `120`
- `browserOps`: `112`
- `escapes`: `26` total, `17` eval-read, `8` eval-action, `0` raw CDP, `2` initScript
- `tokens`: unavailable
- `cost_usd`: unavailable

## Tally

| Pass | Warn | Fail | N-R | N/A | Total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 26 | 1 | 1 | 1 | 2 | 31 |

## Task Results

| Task | Verdict | Escape | Answer |
| --- | --- | --- | --- |
| T01 | ✅ | yes | Logged in as BENCH-7341. |
| T02 | ✅ | no | POST /api/orders returned 500 with INSUFFICIENT_INVENTORY; SKU-8821 stock was 0. |
| T03 | ✅ | yes | blocking.css was the render blocker at about 1215 ms; hero.svg was about 1514 ms; heavy.js produced an about 800 ms long task. |
| T04 | ✅ | yes | Mocked /api/users to {"users":[]} and displayed the empty state. |
| T05 | ✅ | yes | Loaded 12 feed items; final token LIVE-512. |
| T06 | ✅ | yes | Most expensive product was 雷霆工作站 at 15999. |
| T07 | ✅ | yes | Plan from /api/me was team-pro-2026. |
| T08 | ✅ | yes | Shadow DOM reward code SHADOW-99. |
| T09 | ✅ | yes | Reloaded Bench Badge from 1.0.0 to 1.0.1, verified BENCH EXT v1.0.1, then restored 1.0.0. |
| T10a | N/A | no | Not run as a separate default-profile auto-connect test in this strict 9223 rerun. |
| T10b | N/A | no | Not run in this strict 9223 pass. |
| T10c | ✅ | yes | The GitHub notifications URL was operated in 9223 and showed Inbox 70. |
| T11 | ✅ | yes | Extension options saved HELLO-2026 · v1.0.0 and restored BENCH EXT v1.0.0. |
| T12 | ✅ | yes | Original source webpack://bench/src/cart/coupon.ts; function applySelectedCoupon; null field cartState.selectedCoupon.couponCode; expected guard if (!cartState.selectedCoupon) return null. |
| T13 | ✅ | yes | .mobile-support-bar[data-bug="overlaps-pay-button"] covers the pay button; confirmation code MOBILE-39. |
| T14 | ✅ | yes | TaskSummary hydration mismatch HYD-908; SSR 8/starter vs client 9/team-pro. |
| T15 | ✅ | yes | SSE delivered 5 events; final alert STREAM-721, last event evt-005. |
| T16 | ✅ | yes | Service Worker cache caused stale blue/cached-2025.11/STALE-CACHE-17; live API returned green/live-2026.06/CACHE-BUST-42. |
| T17 | ✅ | no | Iframe authorization returned iframe-user@bench.dev / OAUTH-314. |
| T18 | ✅ | no | Uploaded upload-token.txt, 36 bytes, token UPLOAD-448. |
| T19 | ✅ | yes | Keyboard trap skips #save-preferences; mouse save code A11Y-204. |
| T20 | ✅ | yes | 7/10 passed; failed rounds 3,6,9; code FLAKE-307. |
| R01 | ✅ | yes | Playwright actionability page title Auto-waiting; locator.click checks Visible, Stable, Receives Events, Enabled. |
| R02 | ✅ | yes | GitHub notifications read-only evidence showed Inbox 70 and current unread rows. |
| R03 | ✅ | yes | MDN Fetch API page: first three interface entries were Window.fetch() and WorkerGlobalScope.fetch(), Window.fetchLater(), DeferredRequestInit; Browser compatibility was present. |
| R04 | ✅ | yes | npm @playwright/test: version 1.61.0, license Apache-2.0, weekly downloads 42,302,116, repository github.com/microsoft/playwright. |
| R05 | ✅ | yes | Chrome Web Store React Developer Tools: ID fmkadmapgofadopljbjfkapdkoienihi, provider Meta, rating 4.0, 1,633 ratings, 5,000,000 users, button 添加至 Chrome, version 7.0.1, size 789KiB. |
| R06 | ❌ | no | Could not validate custom Bench Badge injection on a fresh real-site page in this browser state. |
| R07 | ✅ | yes | npm document request was 200 and the page version was 1.61.0. |
| R08 | N-R | no | No request route/abort/block primitive was exposed by Chrome DevTools MCP 1.2.0 in this run. |
| R09 | ⚠️ | yes | Collected performance resource timings from an already loaded Garden Lab article tab, but fresh navigation failed. |

## Evidence Scripts

- `rerun2-main.mjs`: main local and real-site pass.
- `rerun2-fixes.mjs`: T01/T17/T18 fixes.
- `rerun2-fixes2.mjs`: T03/T05 fixes.
- `rerun2-t09.mjs`: extension reload and restore evidence.
- `rerun2-r09-reuse.mjs`: reused-tab performance evidence after fresh real-site navigation failed.
