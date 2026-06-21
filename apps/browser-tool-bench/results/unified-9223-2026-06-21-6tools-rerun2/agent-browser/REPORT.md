# agent-browser · unified 9223 rerun2 · 2026-06-21

Tool: `agent-browser` CLI  
Browser mode: strict CDP 9223, dedicated session `agent-browser-rerun2`  
Local target: `http://localhost:4399`  
CDP target: `http://127.0.0.1:9223`

## CDP Proof

- `curl http://127.0.0.1:9223/json/version` returned Chrome `149.0.7827.116` and browser websocket `ws://127.0.0.1:9223/devtools/browser/88daa777-7389-4a89-8aad-df77b2877f3b`.
- The default agent-browser session initially reported a stale `9224` URL, so all benchmark browser operations used `--session agent-browser-rerun2 --cdp 9223`.
- `agent-browser --session agent-browser-rerun2 --cdp 9223 get cdp-url` returned `ws://127.0.0.1:9223/devtools/browser/88daa777-7389-4a89-8aad-df77b2877f3b`.
- A unique page URL `http://localhost:4399/?agent_browser_worker=unified-9223-rerun2-1782010101` appeared in `http://127.0.0.1:9223/json/list` with a `ws://127.0.0.1:9223/devtools/page/...` websocket.

## Cost Metrics

- `elapsed_ms`: approx `1050000`
- `tool_calls`: approx `205` commands/tool invocations; rollout JSONL is authoritative.
- `browserOps`: approx `166` agent-browser browser operations.
- `escapes`: `7` read-only eval attempts, no eval action, no raw CDP escape, no init script.
- `tokens`: unavailable
- `cost_usd`: unavailable

## Artifacts

- `t03-trace.json`: trace evidence for T03.
- `t04-empty-state.png`: screenshot evidence for T04.
- `r09.har`: HAR evidence for R09, 31 requests.

## Results

| Task | Verdict | Escape | Answer | Evidence / Notes |
| --- | --- | --- | --- | --- |
| T01 | ✅ | false | Logged in as `BENCH-7341`. | `/login` accepted `agent@bench.dev` / `bench-2026`; dashboard heading showed `欢迎回来，Agent 测试员（工号 BENCH-7341）`. |
| T02 | ✅ | false | `POST /api/orders` failed with `500` and `INSUFFICIENT_INVENTORY`; SKU-8821 stock was 0. | Network request `77506.41` response body: `{"error":"INSUFFICIENT_INVENTORY","message":"SKU-8821 库存不足，剩余 0 件","traceId":"tr-0fb6ebda10e5"}`. |
| T03 | ✅ | false | LCP was mainly delayed by render-blocking `blocking.css`; `heavy.js` added an ~800 ms main-thread long task; `hero.svg` was slow but not the LCP element. | Trace file `t03-trace.json`; `blocking.css` finished around 1266 ms, `heavy.js` eval long task around 800 ms, `hero.svg` around 2068 ms, LCP candidate was text `P` at about 2110 ms. |
| T04 | ✅ | false | Empty users state shown with invite action. | Routed `**/api/users` to `{"users":[]}`; page showed `暂无成员` and `邀请成员`; screenshot `t04-empty-state.png`; route removed afterward. |
| T05 | ✅ | false | Loaded 12 feed items; final code `LIVE-512`. | `/livefeed` after `加载更多` showed `已加载 12 条（没有更多了）` and `系统公告：今日口令 LIVE-512`. |
| T06 | ✅ | false | Most expensive item was `雷霆工作站` at `15999`; full list sorted descending was captured. | `/catalog` page 2 loaded all 12 products; sorted data included `雷霆工作站 15999 stock 2` down to `智能护眼台灯 329 stock 88`. |
| T07 | ✅ | true | Plan from API was `team-pro-2026`. | Used read-only eval on `/dashboard`: `fetch('/api/me')` returned plan `team-pro-2026` and badge `BENCH-7341`; one failed syntax eval attempt preceded the successful read. |
| T08 | ✅ | false | Shadow DOM reward code `SHADOW-99`. | Dashboard snapshot exposed the shadow button `领取今日奖励`; after click, snapshot showed `兑换码：SHADOW-99`. |
| T09 | ✅ | false | Reloaded unpacked Bench Badge from `1.0.0` to `1.0.1`, verified page badge, then restored `1.0.0`. | Temporarily changed only manifest version, clicked reload in `chrome://extensions`, local page showed `BENCH EXT v1.0.1`; restored manifest/storage and verified `BENCH EXT v1.0.0`. |
| T10a | ✅ | false | GitHub notifications unread count was `70`; first five entries were four `ffffhx/garden-lab` CI failures and one `ffffhx/open-token-board` CI failure. | At `2026-06-21 10:58:28 CST`, `https://github.com/notifications?query=is%3Aunread&t10a=agent-browser-rerun2-20260621` showed Inbox `70`; repo counts included `garden-lab 58`, `codex-snapshots 7`, `profilepilot 4`, `open-token-board 1`. |
| T10b | N/A | false | Not applicable under this strict 9223 run. | Brief says T10b is self-managed persistence; user required every browser op to use CDP 9223 and forbade self-started profile substitution. |
| T10c | ✅ | false | Same GitHub notifications evidence as T10a under proven 9223 control. | Final URL included `t10c=agent-browser-rerun2-20260621-1059`; `/json/list` showed the tab on `ws://127.0.0.1:9223/devtools/page/...`; unread count `70`. |
| T11 | ✅ | false | Extension options changed badge to `HELLO-2026 · v1.0.0`, then restored default. | Bench Badge ID `jkmndkochpgaleoechlemhdhbikdecnf`; options page save message confirmed `HELLO-2026`; local page showed custom badge, then was restored to `BENCH EXT v1.0.0`. |
| T12 | ✅ | false | Original source was `webpack://bench/src/cart/coupon.ts`; failing function `applySelectedCoupon`; null field `cartState.selectedCoupon.couponCode`; expected guard `if (!cartState.selectedCoupon) return null;`. | Console error carried `originalSource:"src/cart/coupon.ts:12"`; Network source map listed `webpack://bench/src/cart/coupon.ts` and sourcesContent with the expected guard. |
| T13 | ✅ | false | Mobile pay button was covered by `.mobile-support-bar[data-bug="overlaps-pay-button"]`; mouse-accessible confirmation code was `MOBILE-39`. | Mobile click failed because support bar covered the button; support bar `z-index:20`, actions `z-index:10`; desktop click revealed `支付确认码：MOBILE-39`. |
| T14 | ✅ | true | Hydration mismatch trace `HYD-908`; component `TaskSummary`; SSR `{pendingTasks:8, planName:"starter"}` vs client `{pendingTasks:9, planName:"team-pro"}`. | Console logged `[hydration mismatch]`; read-only eval of `window.__BENCH_STORE__` confirmed component, traceId, SSR and client states. |
| T15 | ✅ | false | SSE delivered 5 events; final alert code `STREAM-721`, last event `evt-005`. | Network showed `GET /api/realtime-events` as `EventSource` with `text/event-stream`; page showed `接收完成：5 条事件，关键告警 STREAM-721`. |
| T16 | ✅ | false | Service worker stale cache returned `STALE-CACHE-17`; live bypass returned `CACHE-BUST-42`. | `/cache` showed stale `theme blue`, `release cached-2025.11`; `/api/settings` had `X-Bench-Cache: service-worker-stale`; `/api/settings?live=1` returned live `green/live-2026.06/CACHE-BUST-42`. |
| T17 | ✅ | false | Iframe auth account `iframe-user@bench.dev`, code `OAUTH-314`. | Iframe button `确认授权` clicked successfully; page showed `授权完成：iframe-user@bench.dev / OAUTH-314`. |
| T18 | ✅ | false | Uploaded `upload-token.txt`, 36 bytes, token `UPLOAD-448`. | File input accepted `apps/browser-tool-bench/fixtures/upload-token.txt`; page showed `文件 upload-token.txt，36 bytes，token=UPLOAD-448`. |
| T19 | ✅ | true | Keyboard trap skipped the save control; mouse click saved with code `A11Y-204`. | Read-only focus eval after tabs cycled `notify-email -> close-modal -> notify-email -> close-modal`; save was a role button div without tabindex; mouse click showed `保存成功：A11Y-204`. |
| T20 | ✅ | false | 7/10 passed; failed rounds `3,6,9`; code `FLAKE-307`; flake rate 30%. | `/flake` after `运行 10 次` showed `通过 7/10，失败轮次 3,6,9，稳定性代码 FLAKE-307`. |
| R01 | ✅ | false | Playwright docs page title `Auto-waiting`; `locator.click()` checks Visible, Stable, Receives Events, Enabled. | Opened Microsoft Playwright repo then official docs `https://playwright.dev/docs/actionability?r01=agent-browser-rerun2`; actionability table showed the checks. |
| R02 | ✅ | false | GitHub notifications unread count `70`; first five repos `ffffhx/garden-lab`, `ffffhx/garden-lab`, `ffffhx/garden-lab`, `ffffhx/garden-lab`, `ffffhx/open-token-board`. | Reused read-only T10a/T10c GitHub evidence from current 9223 profile; no write actions. |
| R03 | ✅ | false | MDN Fetch API page title `Fetch API`; interfaces included `Window.fetch() and WorkerGlobalScope.fetch()`, `Window.fetchLater()`, `DeferredRequestInit`, `FetchLaterResult`, `Headers`, `Request`, `Response`. | Opened `https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API?r03=agent-browser-rerun2`; browser compatibility section was present. |
| R04 | ✅ | false | npm `@playwright/test` page showed version `1.61.0`, weekly downloads `38,582,078`, license `Apache-2.0`, repository `github.com/microsoft/playwright`, last publish `20 hours ago`. | Observation at `2026-06-21 10:59:50 CST`; page said `1.61.0 • Public • Published 6 days ago`. |
| R05 | ✅ | false | Chrome Web Store React Developer Tools: ID `fmkadmapgofadopljbjfkapdkoienihi`, publisher/provider Meta, rating `4.0`, `1,633` ratings, `5,000,000` users, button `添加至 Chrome`. | Page details showed version `7.0.1 (10/20/2025)`, provider `Meta`, developer `Meta Platforms, INC.`, size `789KiB`. |
| R06 | ✅ | false | Real Garden Lab page showed custom extension badge `REAL-SITE-2026 · v1.0.0`, then was restored to `BENCH EXT v1.0.0`. | Options page saved `REAL-SITE-2026`; real URL `https://ffffhx.github.io/garden-lab/post/agent/?r06=agent-browser-rerun2-real-site`; final restore verified local badge default. |
| R07 | ✅ | false | npm metadata source was the document response body: URL `https://www.npmjs.com/package/@playwright/test?r07=agent-browser-rerun2-20260621`, status `200`, content-type `text/html`, package `@playwright/test`, version `1.61.0`; page version matched. | Network document request `B3995736AADF009C90A9CF351B4A9F49`; response body had `<title>@playwright/test - npm</title>`, `og:title @playwright/test`, meta description `Latest version: 1.61.0`, and visible version `1.61.0`. |
| R08 | ✅ | false | Aborted image request `https://developer.mozilla.org/static/client/external-link.4f3a2dc8e402cae5.svg` with route `**/*.svg --abort`; final title `Fetch API - Web APIs | MDN`. | Network request `13982.143` was resourceType `Image` with no response status/headers after local abort; main document loaded successfully and title stayed Fetch API. |
| R09 | ✅ | false | HAR slowest resources: document `353.79 ms`, external `auth/me` fetch `186.43 ms`, route script `15.63 ms`. | HAR `r09.har` saved with 31 requests at `2026-06-21 11:04:02 CST`; final URL `https://ffffhx.github.io/garden-lab/post/agent/?r09=agent-browser-rerun2-har`. Document affected first screen; external auth fetch was post-load/non-critical; route script was cached and short. |

## Final Restore Evidence

- `agent-browser --session agent-browser-rerun2 --cdp 9223 network unroute` returned done.
- `apps/browser-tool-bench/extension-sample/manifest.json` version read as `1.0.0`.
- Current page `#bench-ext-badge` read `BENCH EXT v1.0.0`.

## Tally

- ✅ pass: 30
- ⚠️ warn: 0
- ❌ fail: 0
- N-R: 0
- N/A: 1
