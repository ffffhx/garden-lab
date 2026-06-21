# agent-browser CLI · unified 9223 report

- Run window: 2026-06-21 01:56-02:11 CST, approximate elapsed `1500000ms`.
- Tool: `agent-browser 0.27.2`.
- Browser mode: `cdp-9223`.
- CDP preflight: `/json/version` reported `Chrome/149.0.7827.116`, `webSocketDebuggerUrl=ws://127.0.0.1:9223/devtools/browser/88daa777-7389-4a89-8aad-df77b2877f3b`.
- Required CLI proof: `agent-browser --cdp 9223 connect 9223` returned `✓ Done`; `agent-browser --cdp 9223 get cdp-url` returned `ws://127.0.0.1:9223/devtools/browser/88daa777-7389-4a89-8aad-df77b2877f3b`.
- Target-list proof: unique GitHub URL `https://github.com/notifications?query=is%3Aunread&t10c=agent-browser-20260621020426` appeared in `http://127.0.0.1:9223/json/list`.
- Tokens/cost: unavailable in this environment.
- Command metrics: `tool_calls=326` estimated, `browserOps=259` estimated. Counts include repeated CLI subcommands; shell reads/curl/report writes are excluded from browserOps.
- Escapes: `total=30`, `eval_read=17`, `eval_action=13`, `cdp_escape=0`, `init_script=0`.
- Extension restore proof: after T09/T11/R06, `manifest.json` is back to version `1.0.0`; both `http://localhost:4399/` and `https://ffffhx.github.io/garden-lab/post/agent/` show `BENCH EXT v1.0.0`.
- Evidence files: `evidence/T04-empty-state.png`, `evidence/T13-mobile-overlap.png`, `evidence/R09-garden-agent.har`.
- R10: not defined in this repository; not run.

## Results

| Task | Verdict | Escape | Answer | Evidence / notes |
| --- | --- | --- | --- | --- |
| T01 | ✅ | true | `BENCH-7341` | UI fill worked, but normal/form button click did not submit; used `form.requestSubmit()` as `eval_action`. Dashboard text: `欢迎回来，Agent 测试员（工号 BENCH-7341）`. |
| T02 | ✅ | true | `POST /api/orders`, HTTP `500`, `INSUFFICIENT_INVENTORY`, `SKU-8821 库存不足，剩余 0 件` | `network requests` captured request `21320.25`; `network request 21320.25 --json` returned response body with traceId. Extra page fetch used as read backup. |
| T03 | ✅ | true | Main cause: render-blocking `/assets/blocking.css` (~1216ms) followed by `heavy.js` synchronous `crunchAnalytics()` (~800ms); `hero.svg` (~1516ms) is slow but parallel/non-blocking. | Performance entries: blocking.css responseEnd ~1229ms, navigation domInteractive ~2036ms. Network response body for `heavy.js` contains `crunchAnalytics` loop. |
| T04 | ✅ | false | Mocked empty users list; empty state visible. | `network route '**/api/users' --body '{"users":[]}'`; page showed `暂无成员，去邀请第一位伙伴吧`; screenshot saved to `evidence/T04-empty-state.png`. Relative screenshot path failed; absolute path worked. |
| T05 | ✅ | true | `12` activities, final token `LIVE-512`. | Normal button click did not trigger; `eval_action` clicked load-more button. Page showed `已加载 12 条（没有更多了）` and `系统公告：今日口令 LIVE-512`. |
| T06 | ✅ | true | 12 products sorted by price; most expensive `雷霆工作站`, `15999`. | Network bodies for `/api/products?page=1` and `page=2` contained all 12 items. Page-2 button required `eval_action`. |
| T07 | ✅ | true | `team-pro-2026` | Required page-runtime fetch: `fetch('/api/me')` returned JSON with `plan: "team-pro-2026"`. |
| T08 | ⚠️ | true | `SHADOW-99` | Snapshot exposed Shadow DOM button, but ref click did not trigger; `shadowRoot.querySelector('button').click()` revealed `兑换码：SHADOW-99`. |
| T09 | ✅ | false | Reloaded Bench Badge from `v1.0.0` to `v1.0.1`, then restored. | Temporarily patched manifest to `1.0.1`; `chrome://extensions` showed Bench Badge reload button; after reload page badge was `BENCH EXT v1.0.1`. Restored manifest and badge to `BENCH EXT v1.0.0`. |
| T10a | ⚠️ | false | 9223 GitHub unread page: `70` unread; first five include `ffffhx/garden-lab – CI #387`, `#386`, `#376`, `#375`, `ffffhx/open-token-board – CI #41`. | Read succeeded without login, but this run was constrained to 9223 and did not prove the system default Profile requested by T10a. Covered fully by T10c. |
| T10b | N/A | false | Not run under strict 9223. | T10b requires agent-browser self-managed state/profile persistence. This run forbids replacing 9223 with a self-started or persisted profile. |
| T10c | ✅ | false | 9223-bound GitHub notifications: `70` unread; first five as above. | `get cdp-url` returned `ws://127.0.0.1:9223/...`; unique URL with `t10c=agent-browser-20260621020426` appeared in 9223 `/json/list`; final URL stayed on GitHub notifications. |
| T11 | ✅ | false | `HELLO-2026 · v1.0.0`, then restored. | Opened `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`, filled `#badge-text`, clicked Save, local page showed `HELLO-2026 · v1.0.0`; then cleared and restored default badge. |
| T12 | ✅ | true | Source file `webpack://bench/src/cart/coupon.ts`; function `applySelectedCoupon`; bad field `cartState.selectedCoupon.couponCode`; guard `if (!cartState.selectedCoupon) return null;`. | Console showed `checkout coupon crash`; source map `/assets/debug-bundle.js.map` contained the original source and guard comment. Button trigger used `eval_action`. |
| T13 | ✅ | true | Overlay `.mobile-support-bar[data-bug="overlaps-pay-button"]`; it is fixed bottom `0px`, height `118px`, `z-index:20`, covering `.checkout-actions` fixed bottom `40px`, `z-index:10`; confirmation code `MOBILE-39`. | Mobile viewport `390x844`; elementFromPoint at button center returned the support bar; screenshot saved to `evidence/T13-mobile-overlap.png`. Code revealed with `eval_action` click. |
| T14 | ✅ | true | Component `TaskSummary`; traceId `HYD-908`; SSR `pendingTasks=8`, `planName=starter`; client `pendingTasks=9`, `planName=team-pro`; final DOM shows 9/team-pro. | Console emitted `[hydration mismatch]`; `window.__BENCH_STORE__` provided structured states. |
| T15 | ✅ | true | 5 events; last `evt-005`; alert code `STREAM-721`. | EventSource request `/api/realtime-events` captured with status 200 and `text/event-stream`; button trigger used `eval_action`; page summary showed completion. |
| T16 | ✅ | true | Service Worker cache caused stale page values: `blue`, `cached-2025.11`, `STALE-CACHE-17`; live values: `green`, `live-2026.06`, `CACHE-BUST-42`; fix: update/unregister SW or fix fetch cache strategy and reactivate. | Page showed stale values and `Service Worker 已控制页面`; runtime read showed controller `http://localhost:4399/sw-cache.js`; network header `X-Bench-Cache: service-worker-stale`; `/api/settings?live=1` returned live values. |
| T17 | ✅ | false | `iframe-user@bench.dev / OAUTH-314`. | Snapshot inlined cross-origin iframe and exposed `@e5`; clicking it made parent page show `授权完成：iframe-user@bench.dev / OAUTH-314`. |
| T18 | ✅ | false | `upload-token.txt`, `36 bytes`, `UPLOAD-448`. | `agent-browser upload 'input[type="file"]' /Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt`; page parsed expected result. |
| T19 | ✅ | true | Keyboard cannot reach or activate Save; `#save-preferences` is a div with `role="button"` but no `tabindex="0"` and no keyboard handler; mouse save code `A11Y-204`. | Tab sequence stayed on `#notify-email`; DOM attrs confirmed missing tabindex. Save code required `eval_action` click after normal click failed. |
| T20 | ✅ | true | Pass `7/10`, failures `3,6,9`, code `FLAKE-307`, flake rate `30%`, unstable. | `eval_action` started the run; page summary and 10 network calls `/api/flake-check?run=1..10` confirmed all iterations. |
| R01 | ✅ | false | Final page `Auto-waiting | Playwright`; `locator.click()` checks `Visible`, `Stable`, `Receives Events`, `Enabled`. | Opened GitHub repo first, then browser-navigated to official Playwright docs `https://playwright.dev/docs/actionability`; page text contained actionability table. |
| R02 | ✅ | false | Observed 2026-06-21 02:08:06 CST; final URL `https://github.com/notifications?query=is%3Aunread`; unread total `70`; first five repos/titles: `ffffhx/garden-lab – CI #387`, `#386`, `#376`, `#375`, `ffffhx/open-token-board – CI #41`. | Only read page text; did not click notification controls. |
| R03 | ✅ | false | MDN title `Fetch API`; first three Interfaces: `Window.fetch() and WorkerGlobalScope.fetch()`, `Window.fetchLater()`, `DeferredRequestInit`; Browser compatibility section present, no explicit Baseline badge in extracted text. | Final URL `https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API`; page text used as evidence. |
| R04 | ✅ | false | Observed 2026-06-21 02:08:29 CST; version `1.61.0`; license `Apache-2.0`; weekly downloads `41,880,590`; repository `github.com/microsoft/playwright`; unpacked size not visibly displayed. | Final URL `https://www.npmjs.com/package/@playwright/test`; page sidebar provided metadata. |
| R05 | ✅ | false | Extension ID `fmkadmapgofadopljbjfkapdkoienihi`; name `React Developer Tools`; publisher/provider `Meta`; rating `4.0`, `1,633` ratings, `5,000,000` users; main button `添加至 Chrome` and disabled. | Final URL Chrome Web Store detail page; no install/removal clicked. |
| R06 | ✅ | true | Initial real-site badge `BENCH EXT v1.0.0`; after options save, real-site badge `REAL-SITE-2026 · v1.0.0`; final URL `https://ffffhx.github.io/garden-lab/post/agent/`. | Options page reached at `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`. First normal save did not persist, so save used options-page `eval_action` click; then restored default badge. |
| R07 | ✅ | false | Request URL `https://www.npmjs.com/package/@playwright/test`, status `200`, content-type `text/html`; response body contained package name `@playwright/test` and `Latest version: 1.61.0`, consistent with page version `1.61.0`. | `network request 4CA94656570FD6A982E2C261749E256A --json` returned the document response body. Output was very large and truncated in terminal, but the metadata snippet was visible. |
| R08 | ✅ | false | Aborted SVG image resources; main document still loaded with title `Fetch API - Web APIs | MDN` and h1 `Fetch API`. | `network route '**/*.svg' --abort` and `network route '**/*.png' --abort`; image request `https://developer.mozilla.org/static/client/chevron-down...svg` had no status/response headers after abort. Ran `network unroute` afterward. |
| R09 | ✅ | false | HAR saved; slowest 3 resources: external fetch `https://8-218-149-148.anyip.dev/token-board/api/auth/me` 52ms, font `4b9bb515...woff2` 6ms, document `https://ffffhx.github.io/garden-lab/post/agent/` 5ms. | HAR `evidence/R09-garden-agent.har` has 26 requests. The external auth fetch is slowest but not first-screen critical article content; document and font are more directly first-screen relevant, and all were fast in this run. |

## Tally

- Pass: 28
- Warn: 2
- Fail: 0
- N-R: 0
- N/A: 1

