# @browser unified 9223 run

- Tool: `@browser` / Codex in-app Browser plugin
- Date: 2026-06-21 Asia/Shanghai
- Scope: local `T01-T20` with `T10a/T10b/T10c`, and real-site `R01-R09`
- R10: not defined in the repository; not invented
- Output mode: `in-app`
- Strict CDP target: `http://127.0.0.1:9223`

## CDP proof

`9223` itself was reachable:

- `/json/version`: Chrome `149.0.7827.116`, `webSocketDebuggerUrl` on `ws://127.0.0.1:9223/...`
- `/json/list`: contained existing 9223 tabs including `localhost:4399`, GitHub notifications, extension options pages, and service workers

`@browser` did not prove binding to `9223`:

- Browser plugin backends listed `extension` and `iab`; per Browser skill this run used `iab`.
- The in-app Browser opened `http://localhost:4399/?cdp_proof=browser-iab-proof-1781977267640`.
- That proof URL did not appear in `http://127.0.0.1:9223/json/list`.

Therefore all default-profile, 9223-profile, and 9223-extension tasks were scored by actual in-app capability, not as strict-profile passes.

## Cost counters

- `elapsed_ms`: `760000`
- `tool_calls`: `40` estimated, counting parallel shell subcommands individually
- `browserOps`: `226`
- `escapes.total`: `104`
- `eval_read`: `103`
- `eval_action`: `1`
- `cdp_escape`: `0`
- `init_script`: `0`
- `tokens`: `unavailable`
- `cost_usd`: `unavailable`

Notes:

- `curl /json/version` and `/json/list` were used only for the required CDP preflight/proof checks.
- Browser plugin read-only `evaluate` was used heavily for DOM inspection.
- The evaluate sandbox did not expose `fetch`, `window.fetch`, `performance`, or `navigator`.
- Direct navigation to local asset/API URLs such as `/assets/debug-bundle.js.map` and `/api/settings?live=1` was blocked by the in-app Browser with `ERR_BLOCKED_BY_CLIENT`.

## Tally

| Verdict | Count |
| --- | ---: |
| ✅ | 12 |
| ⚠️ | 5 |
| ❌ | 8 |
| N-R | 5 |
| N/A | 1 |

## Local tasks

| Task | Verdict | Escape | Answer | Evidence / notes |
| --- | --- | --- | --- | --- |
| T01 | ✅ | true | `BENCH-7341` | Form login succeeded; `#greeting` showed `欢迎回来，Agent 测试员（工号 BENCH-7341）`. |
| T02 | ❌ | true | Could not obtain `/api/orders` response body. | Page showed generic failure only. No Network response-body API; evaluate had no `fetch`. |
| T03 | ⚠️ | true | Likely intended root cause is `blocking.css`, then `heavy.js`; `hero.svg` is distractor. | `pageAssets` listed the resources, but no trace/performance timing was available. |
| T04 | ❌ | false | Could not mock `/api/users`. | No route/intercept API; page loaded the real 18-member table. |
| T05 | ✅ | true | 12 items; `LIVE-512`. | DOM polling after load-more showed 12 items and final item `系统公告：今日口令 LIVE-512`. |
| T06 | ✅ | true | 12 products; most expensive `雷霆工作站`, `15999`. | DOM pagination and cleanup produced all products with numeric price/stock. |
| T07 | ❌ | true | Could not page-runtime fetch `/api/me`. | Login worked, but evaluate has no `fetch`; dashboard does not render `plan`. |
| T08 | ✅ | true | `SHADOW-99` | Locator reached open shadow root and clicked `#claim`; shadow DOM showed `兑换码：SHADOW-99`. |
| T09 | ❌ | false | Cannot reload Bench Badge. | in-app Browser has no extension reload or `chrome://extensions` API; manifest was not changed. |
| T10a | N-R | false | Cannot prove default Chrome Profile reuse. | in-app proof was not in 9223 target list. |
| T10b | N/A | false | Not applicable. | Task card says @browser does not apply to dedicated profile persistence route. |
| T10c | N-R | false | Cannot bind to 9223. | Proof URL absent from `9223 /json/list`; GitHub notifications were not read. |
| T11 | ❌ | false | Cannot operate Bench Badge options page. | in-app Browser did not load the unpacked extension and has no extension target API. |
| T12 | ⚠️ | true | Console/page failure visible, source-map resolution unavailable. | Coupon failure and console error were visible; source map navigation was blocked. |
| T13 | ⚠️ | true | Overlay diagnosed; confirmation code not verified. | `elementFromPoint` showed bottom support bar over the pay button; button activation did not produce `MOBILE-39`. |
| T14 | ✅ | true | `TaskSummary`, `HYD-908`, SSR 8/starter vs client 9/team-pro. | DOM, inline store script, and console hydration error matched. |
| T15 | ✅ | true | 5 events, `evt-005`, `STREAM-721`. | DOM list and status showed all SSE events. |
| T16 | ❌ | true | Could not prove stale plus live settings. | No `navigator`/`fetch`; direct live API navigation was blocked. |
| T17 | ✅ | true | `iframe-user@bench.dev / OAUTH-314` | `frameLocator` clicked iframe approval; parent page showed result. |
| T18 | ❌ | false | Real file upload unsupported. | No `setInputFiles`/filechooser API; filling file input failed. |
| T19 | ✅ | true | Keyboard cannot reach save; mouse save code `A11Y-204`. | `#save-preferences` is `div role=button` without `tabindex`; focus trap excludes it. |
| T20 | ✅ | true | 7/10 pass, failures 3/6/9, `FLAKE-307`, 30%. | Table rows showed failures at 3, 6, 9. |

## Real-site tasks

| Task | Verdict | Escape | Answer | Evidence / notes |
| --- | --- | --- | --- | --- |
| R01 | ✅ | true | Playwright docs title `Auto-waiting`; `Locator.click` requires Visible, Stable, Receives Events, Enabled. | Opened GitHub repo first, then official `https://playwright.dev/docs/actionability`; table row matched headers. |
| R02 | N-R | false | Cannot prove current 9223/real-profile GitHub login state. | Strict CDP proof failed; no real notification state was changed. |
| R03 | ✅ | true | MDN `Fetch API`; first observed interfaces `DeferredRequestInit`, `FetchLaterResult`, `Headers`; compatibility info present. | MDN page h1 and Interfaces section read in browser. |
| R04 | ❌ | true | npm metadata extraction did not complete. | npm page repeatedly timed out in in-app Browser during R04 (`Page.enable` / `Page.navigate`). |
| R05 | ✅ | true | React Developer Tools, ID `fmkadmapgofadopljbjfkapdkoienihi`, provider Meta, 1,633 ratings, 5,000,000 users. | Chrome Web Store DOM showed provider, rating, users, version, and buttons `安装 Chrome` / `添加至 Chrome`; no install click. |
| R06 | N-R | false | Bench Badge real-site injection not runnable. | in-app Browser had no loaded unpacked extension and no extension options API. |
| R07 | ⚠️ | true | Visible npm page showed `@playwright/test` version `1.61.0`, but no Network response body. | No Network list/get-response-body API; evaluate has no `fetch`. |
| R08 | N-R | false | No network route/abort/intercept capability. | Did not fake by CSS/JS hiding images. |
| R09 | ⚠️ | false | Article page loaded; only resource inventory available, no HAR/timing. | `pageAssets` listed 22 assets but had no duration/wait timing. |

## Capability summary

What worked:

- Ordinary navigation, form fill, button click, frameLocator, Shadow DOM locator, DOM extraction, console logs, viewport override, page asset inventory.

Main blockers:

- No strict `9223` binding from in-app Browser.
- No Network request list, response body, HAR, trace, route/intercept, extension management, file upload, or page-runtime `fetch`.
- Read-only evaluate is useful for DOM but not a full browser runtime console.
