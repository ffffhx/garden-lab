# playwright-cli T09/T10/T11 rerun report

Date: 2026-06-14
Workspace: `/Users/bytedance/Code/garden-lab`
Tested tool: `playwright-cli` only
Version: `playwright-cli --version` -> `0.1.14`
Bench server: `http://localhost:4399/` returned HTTP 200 during the run.

## Scope and constraints

- Browser operations used only `playwright-cli`.
- Shell was used only to read task/source files, check process/file state, serialize the T09 manifest mutation, and write this report.
- I did not use agent-browser, bb-browser, Chrome plugin, Browser MCP, or DevTools MCP as a browser-control substitute.
- Temporary Playwright profiles/config/output were created under `/tmp/garden-lab-pwcli-rerun-fixed-env.IwU7md`, not inside the repo.
- `flock` is not installed on this macOS host, so T09 used an equivalent atomic directory lock at `/tmp/browser-tool-bench-t09.lockdir`.

## Summary

| Task | Result | Short finding |
| --- | --- | --- |
| T09 local extension reload | PASS | With the atomic lock held, manifest was changed `1.0.0 -> 1.0.1`, `chrome://extensions` reload changed the extension card from `1.0.0` to `1.0.1`, and the bench badge verified `BENCH EXT v1.0.1`. Manifest was restored and rechecked as `1.0.0`. |
| T10a default Profile GitHub notifications | FAIL | `playwright-cli` could not attach to the system default Chrome Profile via `--cdp=chrome` or `--extension=chrome`; GitHub notifications were not opened, and no login/write action was attempted. |
| T10b dedicated Profile persistence | PARTIAL / blocked before manual login | `state-save`/`state-load` work, but a fresh dedicated profile hits GitHub's login page. Loading the anonymous saved state still hits the login page, so a first manual GitHub login is required before there is authenticated state to persist. |
| T11 use extension options page | PASS | The CLI-loaded extension was reachable, ID was discovered from `chrome://extensions`, the options UI saved `HELLO-2026`, and the bench page verified `HELLO-2026 · v1.0.0`. |

## T09 - local extension reload

Result: PASS

Baseline:
- Clean `rerun-t09-clean` profile opened `http://localhost:4399/`.
- Initial badge: `BENCH EXT v1.0.0`.
- `chrome://extensions/` listed `Bench Badge`, ID `jkmndkochpgaleoechlemhdhbikdecnf`, version `1.0.0`.

Serialized mutation/reload/restore:
- Attempted `flock /tmp/browser-tool-bench-t09.lock ...`, but the host returned `command not found: flock`.
- Used atomic directory lock instead:
  - `while ! mkdir /tmp/browser-tool-bench-t09.lockdir 2>/dev/null; do sleep 0.2; done`
  - restore/lock cleanup were attached to shell traps.
- Inside the lock:
  - `pre_version=1.0.0`
  - changed manifest to `modified_version=1.0.1`
  - enabled Developer Mode in `chrome://extensions`
  - clicked the Bench Badge reload button through the extensions page DOM
  - extension card changed from `{ before: "1.0.0", after: "1.0.1" }`
  - refreshed the bench page and read badge `BENCH EXT v1.0.1`
  - restored manifest and checked `restored_version=1.0.0`

Concurrency note:
- Before the locked T09 run, I observed an unrelated transient flip of `apps/browser-tool-bench/extension-sample/manifest.json` to `1.0.1`; it then returned to `1.0.0` before my restore patch could apply.
- After closing CLI sessions, the manifest was again observed as `1.0.1`. I reacquired the same atomic directory lock and restored it to `final_restored_version=1.0.0`.
- Because of that, only the locked `rerun-t09-clean` sequence above should be used for scoring. The earlier pre-lock observation may have been affected by concurrent agents.

Interruptions: 0 user/manual browser actions. Reload path: `chrome://extensions` page operation, not an extension-management API.

## T10a - default Profile GitHub notifications

Result: FAIL

Commands attempted:
- `playwright-cli -s=rerun-t10a-cdp attach --cdp=chrome`
- `playwright-cli -s=rerun-t10a-ext attach --extension=chrome`

Observed failures:
- `--cdp=chrome` failed before page access. The CLI tried the default Chrome DevToolsActivePort path and resolved `chrome` to `ws://localhost:9222/devtools/browser`, but the websocket returned `404 Not Found`. The CLI message asked to enable remote debugging in `chrome://inspect/#remote-debugging`.
- `--extension=chrome` failed before page access: `Playwright Extension not found in "/Users/bytedance/Library/Application Support/Google/Chrome"`.

GitHub result:
- No unread count or titles were collected because the CLI never attached to the default Profile.
- I did not open `github.com/notifications` through another profile for this task.
- I did not log in, mark anything read, click notifications, or perform any write action.

Interruptions performed: 0. Required interruptions if pursuing this path would include enabling remote debugging or installing/authorizing the Playwright Extension in the default Profile, which this test did not do.

## T10b - dedicated Profile persistence

Result: PARTIAL / blocked before manual login

Capability check:
- `playwright-cli state-save --help` and `state-load --help` are available.
- A dedicated persistent profile was launched with `playwright-cli -s=rerun-t10b open https://github.com/notifications --persistent --profile /tmp/.../profile-t10b --headed`.

Fresh dedicated profile result:
- URL after navigation: `https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fnotifications`
- Title: `Sign in to GitHub · GitHub`
- Login input present: `true`
- Password input present: `true`

State persistence check without login:
- Saved the current anonymous state to `/tmp/garden-lab-pwcli-rerun-fixed-env.IwU7md/t10b-anonymous-state.json`.
- Loaded that state into a new `rerun-t10b-load` session.
- Opening `https://github.com/notifications` still redirected to the same GitHub login URL with login/password inputs present.

Conclusion:
- playwright-cli has the mechanics needed for a dedicated persistent profile or explicit state file.
- For GitHub notifications, the dedicated profile must first be manually logged in, including any 2FA/passkey/device verification. Without that phase-one manual login, there is no authenticated GitHub state for `state-save`, `state-load`, or profile reuse to restore.
- No login was attempted and no authenticated state file was created.

## T11 - use extension options page

Result: PASS

Setup:
- Started a headed persistent Chromium session through playwright-cli with launch args:
  - `--disable-extensions-except=/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/extension-sample`
  - `--load-extension=/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/extension-sample`
- Initial bench badge on `http://localhost:4399/`: `BENCH EXT v1.0.0`.

Extension discovery and options operation:
- Opened `chrome://extensions/`.
- Discovered `Bench Badge` ID from the extensions page shadow DOM: `jkmndkochpgaleoechlemhdhbikdecnf`.
- Opened `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`.
- Filled `#badge-text` with `HELLO-2026`.
- Clicked `#save`.
- Options status text: `已保存：徽标文字将显示为「HELLO-2026」（刷新靶场页面生效）`.

Final verification:
- Reopened `http://localhost:4399/`.
- Final badge: `HELLO-2026 · v1.0.0`.

Interruptions: 0 user/manual browser actions. ID discovery path: `chrome://extensions` page plus shadow DOM evaluation. The options page was reachable as a `chrome-extension://.../options.html` target.

## Final integrity checks

- All `playwright-cli` sessions used for this run were closed; `playwright-cli list` reported `(no browsers)`.
- `apps/browser-tool-bench/extension-sample/manifest.json` was restored to version `1.0.0` and had no git diff at the final restore check.
- The temporary T10b anonymous state file was deleted after the `state-load` verification.
- The only intended repo artifact from this agent is this report file.
