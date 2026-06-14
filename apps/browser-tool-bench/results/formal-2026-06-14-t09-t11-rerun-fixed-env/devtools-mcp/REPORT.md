# Chrome DevTools MCP · T09/T10/T11 Rerun Report

Date: 2026-06-14

Tool under test: `chrome-devtools-mcp` 1.2.0

MCP server command used for browser actions:

```bash
chrome-devtools-mcp --browserUrl http://127.0.0.1:9223 --experimentalIncludeAllPages --categoryExtensions --no-usage-statistics
```

All browser task actions were performed through the MCP server's JSON-RPC tools, not raw CDP. Shell/Node was used only as the stdio JSON-RPC client wrapper, to hold the T09 lock, and to edit/restore `manifest.json` for the T09 precondition.

## Environment

- Local bench server was already reachable on `http://localhost:4399/`.
- CDP 9223 was reachable.
- `tools/list` exposed `list_pages`, `new_page`, `navigate_page`, `evaluate_script`, `take_snapshot`, `fill`, `click`, `list_extensions`, `reload_extension`, `install_extension`, `uninstall_extension`, and `trigger_extension_action`.
- `list_extensions` showed:
  - `id=fojafabhljdngfcjlodcnjdfkadchofa "Coze Test Account Switcher" v0.1.0 Enabled`
  - `id=jkmndkochpgaleoechlemhdhbikdecnf "Bench Badge" v1.0.0 Enabled`
- Final cleanup check: `apps/browser-tool-bench/extension-sample/manifest.json` is restored to `"version": "1.0.0"` and has no git diff.

## Summary

| Task | Result | Key evidence |
| --- | --- | --- |
| T09 · local extension reload | ✅ Success | Under atomic lockdir, baseline badge `BENCH EXT v1.0.0` → reload at manifest `1.0.1` showed `BENCH EXT v1.0.1` → restored reload showed `BENCH EXT v1.0.0`. |
| T10a · real logged-in profile notifications | ✅ Success | Opened GitHub notifications through MCP on 9223, no login wall, unread total `68`, extracted all 68 unread notification titles across three pages. |
| T10b · persistent dedicated profile | ⚠️ Partial | A fresh MCP stdio session could read an existing GitHub notifications target with no login wall and total `68`, proving the 9223 profile state was usable. However fresh-session `new_page` to GitHub timed out twice, so the exact “open page from fresh session” path did not complete cleanly. This was also `browserUrl 9223`, not a separate MCP-launched `--userDataDir` route. |
| T11 · use extension options page | ✅ Success | Discovered extension ID via `list_extensions`, opened `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`, filled and saved `HELLO-2026` via UI, verified bench badge `HELLO-2026 · v1.0.0`, then cleared via UI and verified `BENCH EXT v1.0.0`. |

## T09 · Local Extension Reload

Important coordination note:

- Before the later coordination messages arrived, I had already performed one successful T09 run without a lock. That first run could theoretically have been affected by concurrency, although its observed evidence matched the later locked runs.
- After the first correction, I reran under a `fcntl.flock(LOCK_EX)` lock.
- After the macOS-specific correction, I reran again under the requested atomic directory lock:

```bash
while ! mkdir /tmp/browser-tool-bench-t09.lockdir 2>/dev/null; do sleep 1; done
trap 'rmdir /tmp/browser-tool-bench-t09.lockdir' EXIT
```

The lockdir run is the authoritative T09 result in this report.

Lockdir evidence:

```json
{
  "baseline": {
    "version": "1.0.0",
    "badge": "BENCH EXT v1.0.0"
  },
  "updated": {
    "version": "1.0.1",
    "badge": "BENCH EXT v1.0.1"
  },
  "restored": {
    "version": "1.0.0",
    "badge": "BENCH EXT v1.0.0"
  }
}
```

Path:

1. MCP `reload_extension` with `id=jkmndkochpgaleoechlemhdhbikdecnf` at manifest `1.0.0`.
2. MCP `list_extensions` confirmed Bench Badge `v1.0.0`.
3. MCP `new_page` opened `http://localhost:4399/`.
4. MCP `evaluate_script` read `#bench-ext-badge` as `BENCH EXT v1.0.0`.
5. Under the same lock, manifest version changed to `1.0.1`.
6. MCP `reload_extension` reloaded the extension.
7. MCP `list_extensions` confirmed Bench Badge `v1.0.1`.
8. MCP `new_page` opened `http://localhost:4399/`.
9. MCP `evaluate_script` read `#bench-ext-badge` as `BENCH EXT v1.0.1`.
10. Under the same lock, manifest version restored to `1.0.0`.
11. MCP `reload_extension`, `list_extensions`, and page badge verification confirmed the restored baseline.

Manual interruptions: `0`.

## T10a · Real Logged-In Profile Notifications

Result: ✅ success.

MCP opened/read `https://github.com/notifications?query=is%3Aunread` in the 9223 browser profile. The page title was `Notifications`, `loginWall=false`, and GitHub showed `1-25 of 68`, then `26-50 of 68`, then `51-68 of 68` through read-only pagination.

Unread total: `68`.

Unread notification titles:

_[标题清单已脱敏] 共 68 条未读，全部为本人各仓库的 CI / Build / Deploy / Sync 等 workflow 失败通知 + 2 条 PR review；具体标题与仓库名按惯例不入公开仓库（数量与计数已核验自洽）。_

Manual interruptions: `0`. No GitHub write action was performed.

## T10b · Persistent Dedicated Profile

Result: ⚠️ partial.

Observed:

- A new MCP stdio session using the same `--browserUrl http://127.0.0.1:9223` could enumerate and select an existing GitHub notifications target.
- The selected target had `loginWall=false`, `title="Notifications"`, and total unread `68`.
- The selected target on the last page showed `51-68 of 68` with 18 visible titles.

Evidence from the fresh MCP session selecting an existing target:

```json
{
  "url": "https://github.com/notifications?after=Y3Vyc29yOjUw&query=is%3Aunread",
  "title": "Notifications",
  "loginWall": false,
  "unreadTotal": 68,
  "visibleTitleCount": 18,
  "footer": "51-68 of 68"
}
```

Why partial:

- The T10b card's clean route is a dedicated persistent profile / `userDataDir` route. This run was constrained to the already-running 9223 browser via `--browserUrl`, so it did not test a separate MCP-launched `--userDataDir`.
- In two fresh MCP stdio sessions, `new_page` to GitHub notifications timed out before returning. No login wall appeared; the failure mode was page-opening timeout.
- Reattaching to an existing notifications target proved the 9223 profile remained authenticated and readable from a fresh MCP session, but it did not fully satisfy the prompt's fresh “open notifications” action.

Manual interruptions: `0`. No GitHub write action was performed.

## T11 · Use Extension Options Page

Result: ✅ success.

Path:

1. MCP `list_extensions` discovered Bench Badge:
   - `id=jkmndkochpgaleoechlemhdhbikdecnf "Bench Badge" v1.0.0 Enabled`
2. MCP `new_page` opened:
   - `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`
3. MCP `list_pages` output grouped it under `## Extension Pages`, so the extension page was visible as a first-class page target.
4. MCP `take_snapshot` found:
   - `uid=1_4 textbox "徽标文字"`
   - `uid=1_5 button "保存"`
5. MCP `fill` set the textbox to `HELLO-2026`.
6. MCP `click` clicked `保存`.
7. MCP `take_snapshot` confirmed:
   - textbox value `HELLO-2026`
   - status text `已保存：徽标文字将显示为「HELLO-2026」（刷新靶场页面生效）`
8. MCP `new_page` opened `http://localhost:4399/`.
9. MCP `evaluate_script` read:

```json
{
  "url": "http://localhost:4399/",
  "badge": "HELLO-2026 · v1.0.0"
}
```

Cleanup:

1. MCP reopened the options page.
2. MCP `fill` set the textbox to an empty string.
3. MCP `click` clicked `保存`.
4. MCP opened `http://localhost:4399/` and verified:

```json
{
  "url": "http://localhost:4399/",
  "badge": "BENCH EXT v1.0.0"
}
```

Manual interruptions: `0`.

## Final State

- `manifest.json` final version: `1.0.0`.
- Bench Badge runtime after cleanup: `BENCH EXT v1.0.0`.
- `/tmp/browser-tool-bench-t09.lockdir` was removed.
- Only this report file was added for the requested output path.
