# playwright-cli · unified-9223-2026-06-21

Tool: `playwright-cli 0.1.14`
Mode: `cdp-9223`
CDP: `http://127.0.0.1:9223`

## CDP Proof

- `curl http://127.0.0.1:9223/json/version` returned `Chrome/149.0.7827.116` and `ws://127.0.0.1:9223/devtools/browser/...`.
- `playwright-cli -s=unified-pw-cdp attach --cdp http://127.0.0.1:9223` succeeded and listed existing 9223 tabs.
- Unique URL proof: playwright-cli opened `http://localhost:4399/?pw_cdp_proof=playwright-cli-1781982360001`; `/json/list` returned `hits 1` with `ws://127.0.0.1:9223/devtools/page/B795910D6574C7B32237B70FB4797922`.
- T10c proof: GitHub URL `https://github.com/notifications?query=is%3Aunread&t10c=pw-notif-1781983100001` also appeared in `/json/list` with `hits 1`.

## Metrics

- `elapsed_ms`: `1500000` estimated wall time from first brief/task-card read through report writing.
- `tool_calls`: `82` estimated shell/tool calls.
- `browserOps`: `23` playwright-cli browser subcommands. Most actions ran inside `run-code` scripts; this count is CLI-command based.
- `escapes`: total `34` = `eval_read 29`, `eval_action 4`, `cdp_escape 0`, `init_script 1`.
- `tokens`: unavailable.
- `cost_usd`: unavailable.

## Result Tally

- Pass: `30`
- Warn: `0`
- Fail: `0`
- N-R: `0`
- N/A: `1`
- R10: not defined in this repository.

## Task Results

| Task | Verdict | Escape | Answer / Evidence |
| --- | --- | --- | --- |
| T01 | ✅ | No | Logged in and read `BENCH-7341`. Evidence: `evidence/local-cdp-output.json`, `T01-dashboard.png`. |
| T02 | ✅ | No | `POST /api/orders` returned `500`, `INSUFFICIENT_INVENTORY`, `SKU-8821 库存不足，剩余 0 件`. |
| T03 | ✅ | Yes | `blocking.css` ~1219 ms and render-blocking; `heavy.js` long task ~800 ms; `hero.svg` ~1518 ms but non-blocking. Used one initScript for LCP/longtask observers. |
| T04 | ✅ | No | Routed `/api/users` to `{"users":[]}` and captured empty state. |
| T05 | ✅ | No | Final feed count `12`; last token `LIVE-512`. |
| T06 | ✅ | No | 12 products from `/api/products` responses; most expensive `雷霆工作站` at `15999`. |
| T07 | ✅ | Yes | Page-runtime fetch `/api/me` returned `plan=team-pro-2026`. |
| T08 | ✅ | No | Shadow DOM reward code `SHADOW-99`. |
| T09 | ✅ | Yes | Reloaded Bench Badge on `chrome://extensions` after temporary manifest `1.0.1`; badge became `BENCH EXT v1.0.1`; restored `BENCH EXT v1.0.0`. |
| T10a | ✅ | Yes | 9223 GitHub profile read unread notifications: `70`; first five subjects captured in `notifications-parsed.json`. |
| T10b | N/A | No | Not run: no phase-one saved GitHub state for a playwright-cli dedicated profile, and self-starting a profile would not test strict 9223. |
| T10c | ✅ | Yes | Proved 9223 binding, opened unique notifications URL, read `70` unread and first five subjects. |
| T11 | ✅ | No | Options UI saved `HELLO-2026`; target badge `HELLO-2026 · v1.0.0`; restored default. |
| T12 | ✅ | Yes | Source map located `webpack://bench/src/cart/coupon.ts`; function `applySelectedCoupon`; null field `cartState.selectedCoupon.couponCode`; guard `if (!cartState.selectedCoupon) return null;`. |
| T13 | ✅ | Yes | `.mobile-support-bar[data-bug="overlaps-pay-button"]` covers the pay button; z-index `20` over `10`; confirmed `MOBILE-39` after diagnosis. |
| T14 | ✅ | Yes | `TaskSummary`, `HYD-908`; SSR `8/starter`, client `9/team-pro`; final `9/team-pro`. |
| T15 | ✅ | No | SSE completed 5 events; last `evt-005`; alert code `STREAM-721`. |
| T16 | ✅ | Yes | SW cache caused `blue/cached-2025.11/STALE-CACHE-17`; live API returned `green/live-2026.06/CACHE-BUST-42`; fix update/unregister SW or fix fetch handler. |
| T17 | ✅ | No | Cross-origin iframe authorization returned `iframe-user@bench.dev / OAUTH-314`. |
| T18 | ✅ | No | Uploaded real fixture; page showed `upload-token.txt`, `36 bytes`, `UPLOAD-448`. |
| T19 | ✅ | Yes | Save button is `div role=button` without `tabindex`, not in focus trap, no keyboard handlers; mouse save code `A11Y-204`. Modal open needed eval due page CSS hidden-backdrop interception. |
| T20 | ✅ | No | `7/10` pass, failed runs `3,6,9`, code `FLAKE-307`, flake rate `30%`, unstable. |
| R01 | ✅ | Yes | Final URL `https://playwright.dev/docs/actionability`; title `Auto-waiting`; `locator.click()` checks Visible, Stable, Receives Events, Enabled. |
| R02 | ✅ | Yes | Read-only GitHub notifications via 9223: `70` unread; first five subjects captured; no state-changing controls clicked. |
| R03 | ✅ | Yes | MDN Fetch API page; current Interfaces include `Window.fetch() and WorkerGlobalScope.fetch()`, `Window.fetchLater()`, `DeferredRequestInit`; Browser compatibility present. |
| R04 | ✅ | Yes | npm page: version `1.61.0`, license `Apache-2.0`, weekly downloads `41,880,590`, repository `github.com/microsoft/playwright`; unpacked size not visible. |
| R05 | ✅ | Yes | Chrome Web Store: React Developer Tools, ID `fmkadmapgofadopljbjfkapdkoienihi`, provider Meta, rating `4.0`, `1,633` ratings, `5,000,000` users, button `添加至 Chrome`. |
| R06 | ✅ | No | Real site default badge `BENCH EXT v1.0.0`; options UI saved `REAL-SITE-2026`; refreshed real site showed `REAL-SITE-2026 · v1.0.0`; restored default. |
| R07 | ✅ | No | Browser Network document response from npm was `200 text/html`; body contained `@playwright/test` and latest version `1.61.0`, matching page version. |
| R08 | ✅ | No | Route-aborted MDN image/SVG requests while main Fetch API document loaded. |
| R09 | ✅ | Yes | Performance evidence: slowest resources by PerformanceResourceTiming were JS chunk ~929 ms, font ~882 ms, manifest ~875 ms. JS/CSS/fonts can affect first-screen rendering; manifest is not first-screen critical. |

## State Restoration

- `apps/browser-tool-bench/extension-sample/manifest.json` version is restored to `1.0.0`.
- Final badge check on `http://localhost:4399/?final-restore-check=pw-1781984500001` returned `BENCH EXT v1.0.0`.
- R06/T11 storage changes were restored through the extension options UI.
- Temporary extension lock `/tmp/browser-tool-bench-t09.lockdir` was released.

## Evidence Files

- Local tasks: `evidence/local-cdp-output.json`
- Real-site tasks: `evidence/real-cdp-output.json`
- GitHub login-state parse: `evidence/notifications-parsed.json`
- Extension tasks: `evidence/t09-v101.json`, `evidence/t09-restore-v100.json`, `evidence/t11.json`, `evidence/r06.json`, `evidence/final-extension-restore.json`
- Supplemental fixes: `evidence/r03-r04-fix.json`, `evidence/r07-fix.json`
