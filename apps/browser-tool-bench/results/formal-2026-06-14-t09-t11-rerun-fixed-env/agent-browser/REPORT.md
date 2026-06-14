# agent-browser CLI · T09/T10/T11 rerun

- Run time: 2026-06-14 14:32 CST
- Tool: `agent-browser 0.27.2`
- Rule followed: every browser action was invoked as `agent-browser --cdp 9223 ...`; non-browser commands such as `skills get core` and `--version` did not use `--cdp`.
- No Playwright, bb-browser, or Chrome plugin was used for task actions. Shell was used only for `lsof` / `ps` / `curl /json/*` / file-state cross-checks.

## Core Finding

`agent-browser --cdp 9223` did **not** reliably target the requested `127.0.0.1:9223` Chrome profile in this run.

Independent target check:

- Opened unique URL through the tested command: `agent-browser --cdp 9223 open http://localhost:4399/?ab_cdp9223_probe=20260614T141855-22288`.
- `agent-browser --cdp 9223 get url` returned that exact unique URL.
- `curl http://127.0.0.1:9223/json/list` had **no** matching URL; its bench tab still showed `http://localhost:4399/?connectWsProbe=1`.
- The same unique URL appeared under `curl http://127.0.0.1:62070/json/list`.
- `ps` showed `62070` belonged to agent-browser's managed Chrome for Testing process with `--remote-debugging-port=0` and a temp `agent-browser-chrome-*` user-data-dir.

Therefore the final capability boundary is: agent-browser's managed browser can perform some extension tasks, but this run does not prove it can reliably target the specified `9223` profile. For benchmark cells whose requirement is "control 9223/profile", results must be scored as failed/invalid despite managed-profile successes.

## Results Under The 9223 Requirement

| Task | Result | Reason |
| --- | --- | --- |
| T09 local extension reload | ❌ invalid for 9223 | The reload action did not land in `9223`; the unique URL check proved task actions were executed in the managed Chrome for Testing profile. |
| T10a GitHub notifications | ❌ | The tested command opened GitHub in the managed profile and hit the GitHub login page. It did not reuse the logged-in `9223` profile. No login or write action was attempted. |
| T10b dedicated persistence | ❌ / blocked | No saved GitHub state file was found under `apps/browser-tool-bench`; the managed profile was not logged in and hit the login wall. No login was attempted. |
| T11 extension options | ❌ invalid for 9223 | The options-page workflow succeeded only in the managed Chrome for Testing profile, not in the requested `9223` profile. |

## Managed Profile Diagnosis

This section describes what actually happened in agent-browser's managed Chrome for Testing profile after it ignored/missed the intended `9223` target.

| Task | Managed-profile result | Evidence |
| --- | --- | --- |
| T09 local extension reload | ✅ | With exact directory lock `/tmp/browser-tool-bench-t09.lockdir`: initial manifest `1.0.0`, changed to `1.0.1`, opened `chrome://extensions/`, clicked Bench Badge `重新加载`, and verified `BENCH EXT v1.0.1` on `http://localhost:4399/?t09_reload_101_exactlock=...`. Then restored manifest to `1.0.0`, reloaded again, and verified `BENCH EXT v1.0.0`. |
| T10a GitHub notifications | ❌ | `https://github.com/notifications` redirected to `https://github.com/login?return_to=...`; snapshot showed the GitHub sign-in form. |
| T10b dedicated persistence | ❌ / blocked | Same login wall; no prior saved state was available for this subagent to load. |
| T11 extension options | ✅ | Discovered extension ID from the details URL: `jkmndkochpgaleoechlemhdhbikdecnf`; opened `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`, filled `HELLO-2026`, saved through the UI, and verified `HELLO-2026 · v1.0.0` on the bench page. Then reset the option to empty and verified `BENCH EXT v1.0.0`. |

## T09 Locking / Restore Notes

- `flock` is not installed on this macOS environment; the first `flock ...` attempt did not execute the body and did not modify files.
- I then mistakenly used `/tmp/browser-tool-bench-t09.lock.d` for one attempt. That attempt did execute, so it is not used as the authoritative T09 result; it may have been exposed to concurrency because it did not use the requested lock path.
- I reran T09 under the corrected atomic directory lock `/tmp/browser-tool-bench-t09.lockdir`. That second run had clean initial version `1.0.0`, succeeded in the managed profile, restored to `1.0.0`, and released the lock directory.
- Final verification: `manifest.json` version is `1.0.0`, `git diff -- apps/browser-tool-bench/extension-sample/manifest.json` is empty, and `/tmp/browser-tool-bench-t09.lockdir` is absent.

## Command Evidence Summary

Non-browser / cross-check commands:

- `agent-browser skills get core`
- `agent-browser --version` -> `agent-browser 0.27.2`
- `lsof -nP -iTCP:9223 -sTCP:LISTEN` -> `Google` listening on `127.0.0.1:9223`
- `curl http://127.0.0.1:9223/json/version` -> Chrome `149.0.7827.103`
- `curl http://127.0.0.1:9223/json/list` and `curl http://127.0.0.1:62070/json/list` for target comparison
- `ps` confirmed `9223` was the Codex Chrome Profile Manager profile and `62070` was agent-browser Chrome for Testing

Browser commands, all invoked with `--cdp 9223`:

- `open`, `get url`, `tab`, `snapshot`, `click`, `fill`, `eval`, and `wait`
- Extension reload path: `chrome://extensions/` -> Bench Badge `重新加载`
- T11 options path: `chrome://extensions/?id=jkmndkochpgaleoechlemhdhbikdecnf` -> `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`

## Final Boundary

For the strict fixed-env benchmark, agent-browser CLI should be recorded as **not reliable for targeting the specified `9223` profile** in this environment. Its managed Chrome profile can reload and use the Bench Badge extension, but those successes are not valid evidence for "works against 9223".
