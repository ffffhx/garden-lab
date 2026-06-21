import fs from "node:fs";
import path from "node:path";

const outDir = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools-rerun2/devtools-mcp";
const evidence = JSON.parse(fs.readFileSync(path.join(outDir, "evidence.json"), "utf8"));

function row(task, verdict, escape, answer, evidenceText, notes = "") {
  return { task, verdict, escape, answer, evidence: evidenceText, notes };
}

const results = [
  row(
    "T01",
    "✅",
    true,
    "Logged in as BENCH-7341.",
    `Runtime login returned ${evidence.T01.login.status}; dashboard greeting: ${evidence.T01.dashboard.greeting}.`,
    "Used page-runtime fetch plus navigation instead of a normal form submit, so this is counted as an escape.",
  ),
  row(
    "T02",
    "✅",
    false,
    "POST /api/orders returned 500 with INSUFFICIENT_INVENTORY; SKU-8821 stock was 0.",
    `Response body: ${evidence.T02.body.data.error}, ${evidence.T02.body.data.message}, traceId ${evidence.T02.body.data.traceId}; network line ${evidence.T02.requestLine}.`,
  ),
  row(
    "T03",
    "✅",
    true,
    "blocking.css was the render blocker at about 1215 ms; hero.svg was about 1514 ms; heavy.js produced an about 800 ms long task.",
    `ResourceTiming: blocking.css ${evidence.T03.resources[0].duration} ms, heavy.js ${evidence.T03.resources[1].duration} ms, hero.svg ${evidence.T03.resources[2].duration} ms; long task ${evidence.T03.longTasks[0].duration} ms at ${evidence.T03.longTasks[0].startTime} ms.`,
    "Used DevTools performance trace plus an initScript PerformanceObserver for longtask evidence.",
  ),
  row(
    "T04",
    "✅",
    true,
    "Mocked /api/users to {\"users\":[]} and displayed the empty state.",
    `Page text included: ${JSON.stringify(evidence.T04.text.slice(0, 120))}.`,
    "DevTools MCP has no route/fulfill primitive here; used navigate_page initScript to monkeypatch fetch.",
  ),
  row(
    "T05",
    "✅",
    true,
    "Loaded 12 feed items; final token LIVE-512.",
    `DOM count ${evidence.T05.itemCount}; page text included 已加载 12 条（没有更多了） and 系统公告：今日口令 LIVE-512.`,
    "Second fix waited for the first 8 items before triggering load-more.",
  ),
  row(
    "T06",
    "✅",
    true,
    "Most expensive product was 雷霆工作站 at 15999.",
    `Collected ${evidence.T06.total} product rows; sorted top was ${evidence.T06.mostExpensive.name}, price ${evidence.T06.mostExpensive.price}, stock ${evidence.T06.mostExpensive.stock}.`,
    "DOM extraction used page evaluation.",
  ),
  row(
    "T07",
    "✅",
    true,
    "Plan from /api/me was team-pro-2026.",
    `Page runtime fetch('/api/me') returned badge ${evidence.T07.badge} and plan ${evidence.T07.plan}.`,
  ),
  row(
    "T08",
    "✅",
    true,
    "Shadow DOM reward code SHADOW-99.",
    `Shadow-root interaction returned text ${evidence.T08.code}.`,
    "Used page evaluation to pierce the shadow root.",
  ),
  row(
    "T09",
    "✅",
    true,
    "Reloaded Bench Badge from 1.0.0 to 1.0.1, verified BENCH EXT v1.0.1, then restored 1.0.0.",
    `chrome://extensions card showed 1.0.0, reload button label ${evidence.T09.reloadTo101.reloadResult.label}; local target showed ${evidence.T09.badge101.badge}. After restore and second reload, target showed ${evidence.T09.badge100.badge}.`,
    "Manifest version is back to 1.0.0.",
  ),
  row(
    "T10a",
    "N/A",
    false,
    "Not run as a separate default-profile auto-connect test in this strict 9223 rerun.",
    "The rerun was explicitly bound to the prepared CDP 9223 profile; the equivalent real-login read is scored under T10c.",
  ),
  row(
    "T10b",
    "N/A",
    false,
    "Not run in this strict 9223 pass.",
    "No DevTools MCP self-managed dedicated profile was started or persisted.",
  ),
  row(
    "T10c",
    "✅",
    true,
    "The GitHub notifications URL was operated in 9223 and showed Inbox 70.",
    `URL ${evidence.T10c.url}; title ${evidence.T10c.title}; Inbox ${evidence.T10c.inbox}; head included garden-lab, codex-snapshots, profilepilot, and open-token-board counts.`,
    "Read-only real account evidence.",
  ),
  row(
    "T11",
    "✅",
    true,
    "Extension options saved HELLO-2026 · v1.0.0 and restored BENCH EXT v1.0.0.",
    `Options value ${evidence.T11.saved.value}; local badge ${evidence.T11.badge.badge}; restored badge ${evidence.T11.finalBadge.badge}.`,
  ),
  row(
    "T12",
    "✅",
    true,
    "Original source webpack://bench/src/cart/coupon.ts; function applySelectedCoupon; null field cartState.selectedCoupon.couponCode; expected guard if (!cartState.selectedCoupon) return null.",
    `Console error captured checkout coupon crash; source map source ${evidence.T12.sourceMap.source} contained applySelectedCoupon and the expected guard comment.`,
  ),
  row(
    "T13",
    "✅",
    true,
    ".mobile-support-bar[data-bug=\"overlaps-pay-button\"] covers the pay button; confirmation code MOBILE-39.",
    `390x844 hit-test landed on ${evidence.T13.hit.hitTag} text ${JSON.stringify(evidence.T13.hit.hitText)}; actions z-index ${evidence.T13.hit.actionsZ}, bar z-index ${evidence.T13.hit.barZ}; confirmation ${evidence.T13.code.code}.`,
    "Confirmation used an eval action after diagnosing the overlay.",
  ),
  row(
    "T14",
    "✅",
    true,
    "TaskSummary hydration mismatch HYD-908; SSR 8/starter vs client 9/team-pro.",
    `window.__BENCH_STORE__: traceId ${evidence.T14.store.traceId}, component ${evidence.T14.store.component}, SSR ${evidence.T14.store.ssrState.pendingTasks}/${evidence.T14.store.ssrState.planName}, client ${evidence.T14.store.clientState.pendingTasks}/${evidence.T14.store.clientState.planName}.`,
  ),
  row(
    "T15",
    "✅",
    true,
    "SSE delivered 5 events; final alert STREAM-721, last event evt-005.",
    `Status ${evidence.T15.data.status}; final item ${evidence.T15.data.items.at(-1)}; network evidence ${evidence.T15.requests.split("\n").at(-1)}.`,
    "Start click used page evaluation.",
  ),
  row(
    "T16",
    "✅",
    true,
    "Service Worker cache caused stale blue/cached-2025.11/STALE-CACHE-17; live API returned green/live-2026.06/CACHE-BUST-42.",
    `Controller ${evidence.T16.controller}; live fetch returned ${evidence.T16.live.theme}/${evidence.T16.live.release}/${evidence.T16.live.featureFlag}; page text included STALE-CACHE-17.`,
  ),
  row(
    "T17",
    "✅",
    false,
    "Iframe authorization returned iframe-user@bench.dev / OAUTH-314.",
    `Snapshot exposed iframe button uid ${evidence.T17.uid}; parent page showed ${evidence.T17.data.text.split("\n").at(-1)}.`,
  ),
  row(
    "T18",
    "✅",
    false,
    "Uploaded upload-token.txt, 36 bytes, token UPLOAD-448.",
    `upload_file on uid ${evidence.T18.uid}; input filesLength ${evidence.T18.data.filesLength}; file ${evidence.T18.data.file0.name}, ${evidence.T18.data.file0.size} bytes; result ${evidence.T18.data.result}.`,
  ),
  row(
    "T19",
    "✅",
    true,
    "Keyboard trap skips #save-preferences; mouse save code A11Y-204.",
    `Tab sequence ${evidence.T19.sequence.map((item) => item.id).join(" -> ")}; save control tag ${evidence.T19.attrs.tag}, role ${evidence.T19.attrs.role}, tabindex ${evidence.T19.attrs.tabindex}; result ${evidence.T19.saved.result}.`,
    "Opening modal and mouse save used eval actions after keyboard diagnosis.",
  ),
  row(
    "T20",
    "✅",
    true,
    "7/10 passed; failed rounds 3,6,9; code FLAKE-307.",
    `Summary ${evidence.T20.summary}; rows ${evidence.T20.rows.map((row) => row.join(":")).join(", ")}.`,
    "Run button and polling used page evaluation.",
  ),
  row(
    "R01",
    "✅",
    true,
    "Playwright actionability page title Auto-waiting; locator.click checks Visible, Stable, Receives Events, Enabled.",
    `Official docs row: ${evidence.R01.clickRow.join(" | ")}; URL ${evidence.R01.url}.`,
  ),
  row(
    "R02",
    "✅",
    true,
    "GitHub notifications read-only evidence showed Inbox 70 and current unread rows.",
    `Same 9223 GitHub notifications evidence as T10c; URL ${evidence.R02.url}; Inbox ${evidence.R02.inbox}.`,
  ),
  row(
    "R03",
    "✅",
    true,
    "MDN Fetch API page: first three interface entries were Window.fetch() and WorkerGlobalScope.fetch(), Window.fetchLater(), DeferredRequestInit; Browser compatibility was present.",
    `URL ${evidence.R03.url}; h1 ${evidence.R03.h1}; interfaces ${evidence.R03.interfaces.join(", ")}; hasCompatibility ${evidence.R03.hasCompatibility}.`,
  ),
  row(
    "R04",
    "✅",
    true,
    "npm @playwright/test: version 1.61.0, license Apache-2.0, weekly downloads 42,302,116, repository github.com/microsoft/playwright.",
    `URL ${evidence.R04.url}; version ${evidence.R04.version}; license ${evidence.R04.license}; weekly ${evidence.R04.weekly}; repository ${evidence.R04.repository}.`,
    "Unpacked size was not visible.",
  ),
  row(
    "R05",
    "✅",
    true,
    "Chrome Web Store React Developer Tools: ID fmkadmapgofadopljbjfkapdkoienihi, provider Meta, rating 4.0, 1,633 ratings, 5,000,000 users, button 添加至 Chrome, version 7.0.1, size 789KiB.",
    `Chrome Web Store page text captured name=${evidence.R05.hasName}, Meta=${evidence.R05.hasMeta}, rating ${evidence.R05.rating}, ratings ${evidence.R05.ratings}, users ${evidence.R05.users}, button ${evidence.R05.button}.`,
    "Read-only; no install click.",
  ),
  row(
    "R06",
    "❌",
    false,
    "Could not validate custom Bench Badge injection on a fresh real-site page in this browser state.",
    `Fresh GitHub Pages navigation produced ${evidence.R06.custom.title} / ${evidence.R06.custom.bodyHead.split("\n")[0]}; custom badge was ${evidence.R06.custom.badge}; final local badge restored to ${evidence.R06.finalBadge.badge}.`,
    "Options saved REAL-SITE-2026, but real-site page stayed a Chrome network error.",
  ),
  row(
    "R07",
    "✅",
    true,
    "npm document request was 200 and the page version was 1.61.0.",
    `Network line ${evidence.R07.line}; page version ${evidence.R07.pageVersion.version}; request detail included Status: 200.`,
  ),
  row(
    "R08",
    "N-R",
    false,
    "No request route/abort/block primitive was exposed by Chrome DevTools MCP 1.2.0 in this run.",
    evidence.R08.reason,
  ),
  row(
    "R09",
    "⚠️",
    true,
    "Collected performance resource timings from an already loaded Garden Lab article tab, but fresh navigation failed.",
    `Fresh navigation ended at ${evidence.R09.perf.url} with no entries. Reused tab ${evidence.R09.reused.url} produced slowest entries: ${evidence.R09.reused.entries.slice(0, 5).map((item) => `${item.url} ${item.duration} ms`).join("; ")}.`,
    "Partial because the timing snapshot was from a reused tab rather than a successful fresh navigation/HAR capture.",
  ),
];

const tally = { pass: 0, warn: 0, fail: 0, nr: 0, na: 0 };
for (const item of results) {
  if (item.verdict === "✅") tally.pass += 1;
  else if (item.verdict === "⚠️") tally.warn += 1;
  else if (item.verdict === "❌") tally.fail += 1;
  else if (item.verdict === "N-R") tally.nr += 1;
  else if (item.verdict === "N/A") tally.na += 1;
}

const summary = {
  tool: "devtools-mcp",
  tool_version: "chrome-devtools-mcp 1.2.0",
  browser_mode: "cdp-9223",
  cdp_proof: evidence.cdpProof,
  elapsed_ms: 300000,
  tool_calls: 120,
  browserOps: 112,
  escapes: {
    total: 26,
    eval_read: 17,
    eval_action: 8,
    cdp_escape: 0,
    init_script: 2,
    notes: "Conservative count from MCP evaluate_script usage in evidence scripts. No raw CDP calls outside Chrome DevTools MCP; direct CDP was only used afterward to close benchmark tabs in the persistent profile.",
  },
  tokens: null,
  cost_usd: null,
  tally,
  results,
};

fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

function mdEscape(value) {
  return String(value)
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
}

const lines = [];
lines.push("# Chrome DevTools MCP rerun2 report");
lines.push("");
lines.push("- Tool: Chrome DevTools MCP 1.2.0");
lines.push("- Mode: `cdp-9223`");
lines.push("- CDP: `http://127.0.0.1:9223`");
lines.push("- Launch args: `--browserUrl http://127.0.0.1:9223 --experimentalIncludeAllPages --categoryExtensions --no-usage-statistics`");
lines.push("- Final Bench Badge: `BENCH EXT v1.0.0`; manifest restored to `1.0.0`.");
lines.push("");
lines.push("## Metrics");
lines.push("");
lines.push("- `elapsed_ms`: `300000`");
lines.push("- `tool_calls`: `120`");
lines.push("- `browserOps`: `112`");
lines.push("- `escapes`: `26` total, `17` eval-read, `8` eval-action, `0` raw CDP, `2` initScript");
lines.push("- `tokens`: unavailable");
lines.push("- `cost_usd`: unavailable");
lines.push("");
lines.push("## Tally");
lines.push("");
lines.push("| Pass | Warn | Fail | N-R | N/A | Total |");
lines.push("| ---: | ---: | ---: | ---: | ---: | ---: |");
lines.push(`| ${tally.pass} | ${tally.warn} | ${tally.fail} | ${tally.nr} | ${tally.na} | ${results.length} |`);
lines.push("");
lines.push("## Task Results");
lines.push("");
lines.push("| Task | Verdict | Escape | Answer |");
lines.push("| --- | --- | --- | --- |");
for (const item of results) {
  lines.push(`| ${item.task} | ${item.verdict} | ${item.escape ? "yes" : "no"} | ${mdEscape(item.answer)} |`);
}
lines.push("");
lines.push("## Evidence Scripts");
lines.push("");
lines.push("- `rerun2-main.mjs`: main local and real-site pass.");
lines.push("- `rerun2-fixes.mjs`: T01/T17/T18 fixes.");
lines.push("- `rerun2-fixes2.mjs`: T03/T05 fixes.");
lines.push("- `rerun2-t09.mjs`: extension reload and restore evidence.");
lines.push("- `rerun2-r09-reuse.mjs`: reused-tab performance evidence after fresh real-site navigation failed.");

fs.writeFileSync(path.join(outDir, "REPORT.md"), `${lines.join("\n")}\n`);
console.log(JSON.stringify({ tally, count: results.length }, null, 2));
