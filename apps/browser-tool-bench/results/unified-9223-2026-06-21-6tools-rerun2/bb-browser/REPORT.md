# bb-browser rerun2 report

Tool: `bb-browser`
Model: `gpt-5.5`
Reasoning effort: `xhigh`
Mode: `cdp-9223-with-daemon-status-drift`

## Preflight and recovery

- 9223 was reachable before resume: Chrome `149.0.7827.116`, websocket `ws://127.0.0.1:9223/devtools/browser/6ee5961f-a2d4-4022-8578-6f6ccabbc724`.
- The 9223 Chrome process was the persistent profile `test03-00064815`.
- Bench server `http://127.0.0.1:4399/` was reachable and served the browser-tool-bench target.
- Bench Badge was found as extension ID `jkmndkochpgaleoechlemhdhbikdecnf` from Secure Preferences.
- R06 had left the extension text as `REAL-SITE-2026`; it was restored through the extension options page. The local target page later showed `BENCH EXT v1.0.0`.

## 9223 proof

`bb-browser` opened a unique local URL:

```text
http://localhost:4399/?bb_rerun2_resume_proof=20260621T1725
```

The tab appeared in `http://127.0.0.1:9223/json/list` as:

```text
ws://127.0.0.1:9223/devtools/page/083C0A976CA9A9E8DFC76FBD345A3A88
```

`bb-browser status` intermittently reported `cdpPort=9224`, but the 9223 target list showed the actual operated tabs. I treat `/json/list` target evidence as authoritative for the successful 9223 operations.

## Cost and self-rescue

- `elapsed_ms`: `1800000`
- `tool_calls`: `242`
- `browserOps`: `198`
- `tokens`: `unavailable`
- `cost_usd`: `unavailable`
- `escapes`: `69`
  - `eval_read`: `50`
  - `eval_action`: `19`
  - `cdp_escape`: `0`
  - `init_script`: `0`

The counts are conservative estimates from the parsed bb-browser rollout plus the resume tail. bb-browser frequently needed eval for DOM reads and several actions; no raw CDP or init script was used.

## Tally

| Pass | Warn | Fail | N-R | N/A | Total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 19 | 4 | 5 | 1 | 2 | 31 |

## Task results

| Task | Verdict | Escape | Answer |
| --- | --- | --- | --- |
| T01 | ⚠️ | yes | Logged in as `BENCH-7341`, but final submit needed eval/requestSubmit. |
| T02 | ✅ | no | Order failed with `INSUFFICIENT_INVENTORY`; `SKU-8821` stock was `0`. |
| T03 | ✅ | no | `blocking.css` and `hero.svg` were slow; `heavy.js` ran `crunchAnalytics`. |
| T04 | ❌ | no | `/api/users` mock did not take effect; page still showed 18 members. |
| T05 | ✅ | no | Loaded 12 feed items; final code `LIVE-512`. |
| T06 | ✅ | no | Most expensive product was `雷霆工作站`, price `15999`. |
| T07 | ✅ | yes | `/api/me` plan was `team-pro-2026`. |
| T08 | ✅ | yes | Shadow DOM reward code `SHADOW-99`. |
| T09 | ❌ | no | Could not operate `chrome://extensions`; URL was rewritten to `https://chrome://extensions/`. |
| T10a | N/A | no | Not applicable for this strict 9223 bb-browser scoring route. |
| T10b | N/A | no | Not applicable because no self-managed bb-browser profile was used. |
| T10c | ✅ | no | GitHub notifications were readable in 9223; Inbox count `70`. |
| T11 | ✅ | no | Options changed badge to `HELLO-2026 · v1.0.0`, then restored `BENCH EXT v1.0.0`. |
| T12 | ✅ | no | Source was `webpack://bench/src/cart/coupon.ts`; failing function `applySelectedCoupon`; missing selected-coupon guard. |
| T13 | ⚠️ | yes | Mobile bug and `MOBILE-39` found, but true 390px viewport could not be set. |
| T14 | ✅ | yes | `TaskSummary`, trace `HYD-908`; SSR `8/starter`, client `9/team-pro`. |
| T15 | ✅ | no | SSE delivered 5 events; final alert `STREAM-721`, last event `evt-005`. |
| T16 | ✅ | no | Stale SW cache `STALE-CACHE-17`; live bypass `CACHE-BUST-42`. |
| T17 | ❌ | no | Iframe target was visible in 9223, but bb-browser could not operate it as required. |
| T18 | ⚠️ | yes | Uploaded `upload-token.txt`, 36 bytes, token `UPLOAD-448`, but only via DataTransfer/File eval. |
| T19 | ✅ | yes | Keyboard trap skipped save; mouse click saved with `A11Y-204`. |
| T20 | ✅ | no | `7/10` passed; failed rounds `3,6,9`; code `FLAKE-307`. |
| R01 | ✅ | no | Playwright actionability checks: Visible, Stable, Receives Events, Enabled. |
| R02 | ✅ | no | GitHub notifications reused current 9223 evidence; Inbox `70`. |
| R03 | ✅ | yes | MDN Fetch API interfaces and compatibility section were readable. |
| R04 | ✅ | yes | npm `@playwright/test`: `1.61.0`, `Apache-2.0`, `41,880,590` weekly downloads. |
| R05 | ✅ | yes | Chrome Web Store React DevTools: ID `fmkadmapgofadopljbjfkapdkoienihi`, Meta, rating `4.0`, version `7.0.1`. |
| R06 | ❌ | no | Could not complete custom badge validation on a real site; extension options URL was later scheme-mangled. |
| R07 | ⚠️ | yes | npm page and network metadata captured, but response body read failed with `No trace session`. |
| R08 | N-R | no | No usable route/intercept/abort primitive. |
| R09 | ❌ | no | Article navigation/trace evidence failed; network evidence was empty. |

## Notes

- R06 is scored strictly as failed because the custom real-site validation did not complete and the resumed bb-browser state could not reopen `chrome-extension://.../options.html`.
- R07 is partial because page and network metadata were available, but the required body/version cross-check from trace response body was not.
- R09 is failed because no valid HAR/trace/performance evidence was produced.
- The Bench Badge final state was restored outside the bb-browser scoring path with the user-required `agent-browser --cdp 9223` profile operation.
