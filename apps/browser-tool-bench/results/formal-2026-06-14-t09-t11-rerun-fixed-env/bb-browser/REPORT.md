# bb-browser T09/T10a/T10b/T11 fixed-env rerun

- Date: 2026-06-14
- Workdir: `/Users/bytedance/Code/garden-lab`
- Tool: `bb-browser`
- Version: `0.14.2`
- Main target profile: user profile on CDP `127.0.0.1:9223`
- bb managed profile: Chrome on `[::1]:9222`
- Scope guard: GitHub notifications were read-only. I did not open notification details, select checkboxes, mark anything read, or attempt login.

## Results

| Task | Result | Route | Evidence summary |
| --- | --- | --- | --- |
| T09 extension reload | ⚠️ Conditional success | `bb-browser --port 9223` | 9223 baseline badge was `BENCH EXT v1.0.0`. `chrome://extensions/` was reachable and Bench Badge was discovered as `jkmndkochpgaleoechlemhdhbikdecnf`. Native `bb-browser click 15` failed with `Unknown ref xpath: div[2]/cr-icon-button`, but `bb-browser eval` clicked the Bench Badge `dev-reload-button`. During the unlocked attempt, manifest was observed as `1.0.1` and reload verified `BENCH EXT v1.0.1`; however this subagent did not serialize the manifest change before that observation, so the v1.0.1 success may have been affected by concurrent setup. Final locked cleanup verified manifest `1.0.0` and badge `BENCH EXT v1.0.0`. |
| T10a real login/default profile | ✅ Success | `bb-browser --port 9223` | GitHub Notifications loaded without login wall. Inbox unread count was `68`; pagination was `25 + 25 + 18`, with no `Next` on the last page. |
| T10b dedicated profile persistence | ❌ Failed | `[::1]:9222` via `BB_BROWSER_CDP_URL` | Bare `bb-browser --port 9222` hits `127.0.0.1:9222`, where `/json/version` returns HTTP 404, so it cannot reach the bb profile. With `BB_BROWSER_CDP_URL=http://[::1]:9222`, bb-browser can list/open the bb profile and verify Bench Badge `v1.0.0`, but `https://github.com/notifications` redirects to `https://github.com/login?...`; no saved GitHub session. |
| T11 use extension options | ❌ Failed | `bb-browser --port 9223` | Extension ID was discoverable from `chrome://extensions`. Direct `open chrome-extension://.../options.html` was normalized to invalid `https://chrome-extension//...`. JS navigation and the `chrome://extensions` detail-page options entry both ended at `chrome-error://chromewebdata/` with `ERR_BLOCKED_BY_CLIENT`; no `#badge-text` input or `#save` button became available. Badge was not changed to `HELLO-2026`. |

## T09 locking and concurrency note

- `flock` is not installed on this macOS host; the first requested `flock /tmp/browser-tool-bench-t09.lock ...` command failed before doing any file change.
- After the correction, I used the atomic directory lock pattern:
  - `while ! mkdir /tmp/browser-tool-bench-t09.lockdir 2>/dev/null; do sleep 0.2; done`
  - `trap 'rmdir "$lockdir"' EXIT`
- Inside that lock, `manifest.json` was already `1.0.0` on entry and remained `1.0.0` on exit.
- Inside that same locked section, I clicked the Bench Badge reload button through `bb-browser eval`, refreshed `http://localhost:4399/`, and verified `BENCH EXT v1.0.0`.
- Before the lock requirement was clarified, I had already observed `manifest.json` as `1.0.1` and verified a reload to `BENCH EXT v1.0.1`. Because that happened without the lock and the subagent did not perform the serialized manifest change, this T09 success has a possible concurrency/precondition contamination risk.

## Profile and port findings

Live listeners during the run:

| Address | Process / profile | Behavior |
| --- | --- | --- |
| `127.0.0.1:9223` | Chrome PID `29832`, Codex Chrome Profile Manager profile `test03-00064815` | Real target for T09/T10a/T11. Bench Badge present; GitHub logged in. |
| `127.0.0.1:9222` | Chrome PID `5816`, regular Chrome command line `--profile-directory=Default --no-first-run` | Not a usable DevTools endpoint for bb-browser in this run. `curl http://127.0.0.1:9222/json/version` returned HTTP 404. |
| `[::1]:9222` | Chrome PID `66859`, `/Users/bytedance/.bb-browser/browser/user-data` | bb-browser managed profile. CDP JSON works on IPv6; Bench Badge `v1.0.0` present; GitHub notifications hit login wall. |

Important bb-browser daemon behavior:

- The daemon is a singleton control plane on `127.0.0.1:19824`.
- If a daemon is already connected to 9223, `bb-browser --port 9222 status` can still report `cdpPort: 9223`, while showing cached/prefixed `localhost:9222:*` targets.
- If a daemon is already connected to `[::1]:9222`, a later `bb-browser --port 9223` command can reuse the wrong daemon/profile until `bb-browser daemon stop` is run.
- For profile-sensitive tests, the daemon must be stopped between 9223 and `[::1]:9222` runs.

## T10a unread notifications

Count: `68`

_[标题清单已脱敏] 共 68 条未读，全部为本人各仓库的 CI / Build / Deploy / Sync 等 workflow 失败通知 + 2 条 PR review；具体标题与仓库名按惯例不入公开仓库（数量与计数已核验自洽）。_

## Key command evidence

- `bb-browser --version` -> `0.14.2`
- `bb-browser --port 9223 tab list --json` worked after clearing a stale daemon.
- Stale daemon failure: `bb-browser --port 9223 tab list --json` initially failed with `bb-browser: Daemon did not start in time`; process inspection showed an old `dist/daemon.js --cdp-port 9223` on `127.0.0.1:19824` that the CLI could not recognize because `/status` returned `Unauthorized`. Killing only that bb-browser daemon fixed the control plane.
- T09 native click failure: `bb-browser --port 9223 click 15 --tab 0097 --json` -> `Unknown ref xpath: div[2]/cr-icon-button`.
- T09 eval reload success path: `bb-browser --port 9223 eval "...dev-reload-button.click()..." --tab 0097 --json` -> `{ ok: true, item: "jkmndkochpgaleoechlemhdhbikdecnf", button: "dev-reload-button", aria: "重新加载" }`.
- T09 final cleanup: locked restore check printed `before_version=1.0.0`, `after_version=1.0.0`, and badge verification returned `BENCH EXT v1.0.0`.
- T10a extraction used only `a.notification-list-item-link` text and `Next` pagination links.
- T10b bare `bb-browser --port 9222 tab list --json` -> `Cannot find a Chromium-based browser`; `curl -v http://127.0.0.1:9222/json/version` -> HTTP `404 Not Found`.
- T10b explicit IPv6 route: `BB_BROWSER_CDP_URL=http://[::1]:9222 bb-browser tab list --json` listed bb profile tabs; opening GitHub notifications produced `Sign in to GitHub · GitHub`.
- T11 direct open bug: `bb-browser --port 9223 open chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html --json` returned `https://chrome-extension://...` or created `https://chrome-extension//...`.
- T11 blocked options page: eval on the target returned `href: "chrome-error://chromewebdata/"`, `input: false`, `save: false`, body containing `ERR_BLOCKED_BY_CLIENT`.

## Final state

- `apps/browser-tool-bench/extension-sample/manifest.json` version: `1.0.0`
- 9223 bench page badge after final reload: `BENCH EXT v1.0.0`
- bb-browser daemon: stopped with `bb-browser daemon stop`; follow-up `bb-browser daemon status` reported `Daemon not running`.
- No GitHub write actions were performed.
