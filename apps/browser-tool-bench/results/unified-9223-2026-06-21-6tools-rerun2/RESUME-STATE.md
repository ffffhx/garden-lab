# Rerun2 Resume State

Updated: 2026-06-21 18:09 Asia/Shanghai

## Current preflight status

- `9223`: reachable. Chrome `149.0.7827.116` returned `ws://127.0.0.1:9223/devtools/browser/6ee5961f-a2d4-4022-8578-6f6ccabbc724`.
- `9223` owner: Google Chrome process using profile `test03-00064815`.
- `agent-browser --cdp 9223 connect 9223` succeeded, and `agent-browser --cdp 9223 get cdp-url` returned the 9223 websocket.
- `4399`: reachable. `http://127.0.0.1:4399/` returned the browser-tool-bench target page.
- Bench Badge: restored. Local page `http://localhost:4399/` showed `BENCH EXT v1.0.0`.
- Bench Badge extension ID: `jkmndkochpgaleoechlemhdhbikdecnf`.

## Browser tab cleanup

- Cleanup happened at 2026-06-21 17:41 Asia/Shanghai after the rerun left too many tabs open in the persistent 9223 Chrome profile.
- Before cleanup: 94 page targets in 9223.
- Closed: 93 rerun2-generated page targets, including `localhost:4399`, `about:blank`, temporary real-site, docs, extension, and `file:///tmp/real-render.html` tabs.
- After cleanup: 1 page target remains, the existing article tab `https://ffffhx.github.io/garden-lab/post/agent/`.
- Stopped two rerun2 background daemons: the `bb-browser` daemon that had drifted to CDP `9224`, and the `playwright-cli` daemon named `rerun2-pw-9223`.
- Resume rule: future rerun steps must close temporary tabs immediately after each task or batch. Do not leave the persistent 9223 profile with accumulated benchmark tabs.

## Completed in rerun2

- `chrome`: complete summary, `default-profile-fallback`, 31 results.
- `browser`: complete summary, `in-app`, 31 results.
- `agent-browser`: complete summary, `cdp-9223`, 31 results.
- `bb-browser`: complete summary, `cdp-9223-with-daemon-status-drift`, 31 results.
- `devtools-mcp`: complete summary, `cdp-9223`, 31 results.
- `playwright-cli`: complete summary, `cdp-9223`, 31 results.

## bb-browser resume notes

- Source rollout: `~/.codex/sessions/2026/06/21/rollout-2026-06-21T11-07-12-019ee825-8076-7ac1-902f-bc9614761332.jsonl`.
- The original rollout had completed local `T01-T20` and real-site `R01-R06` partially, but did not write `REPORT.md` or `summary.json`.
- Resume verification opened `http://localhost:4399/?bb_rerun2_resume_proof=20260621T1725`; `/json/list` showed it under `ws://127.0.0.1:9223/devtools/page/083C0A976CA9A9E8DFC76FBD345A3A88`.
- `bb-browser status` intermittently reported `cdpPort=9224`; the 9223 `/json/list` target proof is the authoritative evidence for operated tabs.
- R06 was scored `❌` because the custom real-site badge validation did not complete and resumed `bb-browser` rewrote `chrome-extension://.../options.html` to `https://chrome-extension://...`.
- R07 was scored `⚠️` because npm page and Network metadata were captured, but response-body retrieval failed with `No trace session`.
- R09 was scored `❌` because fresh article navigation produced a Chrome network error page and no valid Network/HAR/trace evidence.

## Generated / updated

- `bb-browser/REPORT.md`
- `bb-browser/summary.json`
- `devtools-mcp/T03-trace-rerun2.json.json.gz`
- `devtools-mcp/REPORT.md`
- `devtools-mcp/build-summary.mjs`
- `devtools-mcp/evidence.json`
- `devtools-mcp/rerun2-fixes.mjs`
- `devtools-mcp/rerun2-fixes2.mjs`
- `devtools-mcp/rerun2-main.mjs`
- `devtools-mcp/rerun2-r09-reuse.mjs`
- `devtools-mcp/rerun2-t09.mjs`
- `devtools-mcp/summary.json`
- `playwright-cli/REPORT.md`
- `playwright-cli/summary.json`
- `playwright-cli/rerun2-main.js`
- `playwright-cli/rerun2-fixes.js`
- `playwright-cli/rerun2-t09.js`
- `aggregate-runs.mjs`
- `aggregate-runs.json`
- `AGGREGATE-SNAPSHOT.md`

## Remaining follow-up work

- Rerun2 benchmark execution is complete: all six tools have `summary.json` and `REPORT.md`, each with 31 results.
- `aggregate-runs.json` and `AGGREGATE-SNAPSHOT.md` have been regenerated for the complete six-tool rerun2 set.
- The aggregate comparison against the previous round is generated under `AGGREGATE-SNAPSHOT.md`.
- Article / public matrix sync has not been done in this resume step.

## Aggregate status

The generated aggregate currently has 6 complete rerun2 summaries. It still shows the previous DevTools MCP `4.0m` self-reported time was not comparable to end-to-end wall clock: the previous Codex JSONL wall-clock time for that subagent was `22.2m`. The rerun2 DevTools MCP summary was completed in the main thread, so no separate Codex JSONL rollout/token row exists for it.
