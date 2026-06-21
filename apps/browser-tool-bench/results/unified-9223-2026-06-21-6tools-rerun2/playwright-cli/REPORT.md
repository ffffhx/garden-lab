# playwright-cli rerun2 report

Tool: `playwright-cli 0.1.14`
Mode: `cdp-9223`
CDP: `http://127.0.0.1:9223`

## CDP proof

- `playwright-cli -s=rerun2-pw-9223 attach --cdp http://127.0.0.1:9223` succeeded.
- Unique proof URL `http://localhost:4399/?pw_rerun2_proof=1782033708449` appeared in `/json/list` as `ws://127.0.0.1:9223/devtools/page/0005C536DC61EE9516823CE54D5C4EC7`.
- T10c GitHub URL and final T09 restore URL also appeared under the 9223 target list.
- Final Bench Badge check returned `BENCH EXT v1.0.0`; manifest version is restored to `1.0.0`.

## Metrics

- `elapsed_ms`: `1560000`
- `tool_calls`: `68`
- `browserOps`: `62`
- `escapes`: `42` total, `33` eval-read, `9` eval-action, `0` raw CDP, `1` initScript
- `tokens`: unavailable
- `cost_usd`: unavailable

## Tally

| Pass | Warn | Fail | N-R | N/A | Total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 28 | 1 | 1 | 0 | 1 | 31 |

## Task results

| Task | Verdict | Escape | Answer |
| --- | --- | --- | --- |
| T01 | ✅ | no | Logged in as `BENCH-7341`. |
| T02 | ✅ | no | `POST /api/orders` returned `500`, `INSUFFICIENT_INVENTORY`, `SKU-8821` stock 0. |
| T03 | ✅ | yes | `blocking.css` ~1224ms, `hero.svg` ~1525ms, `heavy.js` long task ~800ms. |
| T04 | ✅ | no | Network route mocked `/api/users` to empty state. |
| T05 | ✅ | no | 12 feed items, token `LIVE-512`. |
| T06 | ✅ | yes | Most expensive product `雷霆工作站`, `15999`. |
| T07 | ✅ | yes | `/api/me` plan `team-pro-2026`. |
| T08 | ✅ | yes | Shadow DOM reward `SHADOW-99`. |
| T09 | ✅ | yes | Reloaded Bench Badge to `v1.0.1`, then restored `v1.0.0`. |
| T10a | ✅ | yes | 9223 GitHub notifications showed Inbox `70`. |
| T10b | N/A | no | Strict 9223 run did not start a dedicated playwright profile. |
| T10c | ✅ | yes | GitHub notifications URL proved in `/json/list` under 9223. |
| T11 | ✅ | no | Options saved `HELLO-2026 · v1.0.0`, then restored default. |
| T12 | ✅ | yes | `webpack://bench/src/cart/coupon.ts`, `applySelectedCoupon`, missing selected-coupon guard. |
| T13 | ✅ | yes | Mobile support bar covered pay button; confirmation `MOBILE-39`. |
| T14 | ✅ | yes | `TaskSummary`, `HYD-908`, SSR `8/starter`, client `9/team-pro`. |
| T15 | ✅ | no | SSE 5 events, final `evt-005`, alert `STREAM-721`. |
| T16 | ✅ | yes | SW stale cache `STALE-CACHE-17`; live `CACHE-BUST-42`. |
| T17 | ✅ | no | iframe auth `iframe-user@bench.dev / OAUTH-314`. |
| T18 | ✅ | no | Real file upload `upload-token.txt`, 36 bytes, `UPLOAD-448`. |
| T19 | ✅ | yes | Keyboard cannot reach save; mouse save code `A11Y-204`. |
| T20 | ✅ | no | `7/10` pass, failed `3,6,9`, code `FLAKE-307`. |
| R01 | ✅ | yes | Playwright `locator.click()` checks Visible, Stable, Receives Events, Enabled. |
| R02 | ✅ | yes | GitHub notifications read-only evidence, Inbox `70`. |
| R03 | ✅ | yes | MDN Fetch API interfaces and compatibility section captured. |
| R04 | ✅ | yes | npm metadata: `1.61.0`, `Apache-2.0`, weekly `42,302,116`. |
| R05 | ✅ | yes | Chrome Web Store React DevTools metadata captured. |
| R06 | ❌ | no | Fresh real-site navigation failed; custom `REAL-SITE-2026` badge was not validated. |
| R07 | ✅ | yes | npm response body and page version both showed `1.61.0`. |
| R08 | ✅ | no | Playwright route aborted MDN image/SVG requests while document loaded. |
| R09 | ⚠️ | yes | Performance timing collected from reused article tab; fresh navigation failed. |

## Evidence scripts

- `rerun2-main.js`: main local and real-site pass.
- `rerun2-fixes.js`: T15/T19/T20 fixes and R06/R09 retry evidence.
- `rerun2-t09.js`: extension reload and restore evidence.
