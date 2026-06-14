# Codex @chrome / Chrome plugin rerun report

Date: 2026-06-14  
Repo: `/Users/bytedance/Code/garden-lab`  
Bench target: `http://localhost:4399/`  
Tool under test: Codex `@chrome` / Chrome plugin only

## Scope

- Browser operations used only the Chrome plugin extension backend exposed as `agent.browsers.get("extension")`.
- I did not use `agent-browser`, `bb-browser`, Playwright CLI, raw CDP, DevTools target enumeration, or profile-file inspection.
- Shell was used for local task/source/report reads, checking the bench HTTP endpoint, creating the result directory, and writing this report.
- I did not modify `apps/browser-tool-bench/extension-sample/manifest.json`; it was `1.0.0` during this run, and the user asked not to modify other files.
- GitHub notification access was read-only. I did not log in, open notification detail pages, mark notifications read/done, or change account state.

## Tool Identity

- Chrome backend type: `extension`
- Backend metadata: `profileName=您的 Chrome`, `profileIsLastUsed=true`
- Codex Chrome extension id reported by backend: `hehggadaopoacecdllhhajmbjkdcmajg`
- Browser-scoped capabilities exposed by @chrome: none
- Tab-scoped capabilities exposed by @chrome: `pageAssets`
- Open user tabs were visible to the plugin, but no extension-management API or dedicated-profile save/load API was exposed.

## Command / Tool Action Summary

- Read task cards:
  - `apps/browser-tool-bench/tasks/T09-扩展reload.md`
  - `apps/browser-tool-bench/tasks/T10a-真实登录态-默认Profile.md`
  - `apps/browser-tool-bench/tasks/T10b-登录态持久化-专用Profile.md`
  - `apps/browser-tool-bench/tasks/T11-使用扩展.md`
- Read extension source:
  - `extension-sample/manifest.json`
  - `extension-sample/content.js`
  - `extension-sample/options.html`
  - `extension-sample/options.js`
- Verified `http://localhost:4399/` responded with HTTP 200.
- Chrome plugin actions:
  - Listed browser metadata/capabilities.
  - Opened `http://localhost:4399/` and read `#bench-ext-badge`.
  - Attempted `chrome://extensions/`.
  - Attempted known Bench Badge options URL `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html` to test `chrome-extension://` scheme reachability.
  - Opened `https://github.com/notifications`, followed only pagination URLs, and extracted unread notification titles.
  - Finalized/closed agent-created tabs.

## 判定表

| Task | Result | 判定 |
| --- | --- | --- |
| T09 · 本地扩展 reload | ❌ 失败 / blocked | 当前 @chrome profile 的靶场页没有 `#bench-ext-badge`；`chrome://extensions/` 被 @chrome URL policy 拦截，无法触达 reload UI/API。另因本轮不得修改其它文件，未把 manifest 改成 `1.0.1`。 |
| T10a · 真实登录态默认 Profile | ✅ 成功 | `https://github.com/notifications` 免登录进入 unread 列表；显示 `Inbox 68`；三页共读取 68 条标题；人工打断 0。 |
| T10b · 登录态持久化专用 Profile | N/A / unsupported | 任务卡说明 @chrome/@browser 不适用：它们复用默认/当前 Chrome profile，而不是工具自管专用 profile。实际能力列表也没有 create/save/load dedicated profile 机制。 |
| T11 · 使用扩展 options 页 | ❌ 失败 / blocked | 当前 @chrome profile 的靶场页没有 Bench Badge 注入；`chrome://extensions/` 无法用于发现 ID；直接打开已知 Bench Badge `chrome-extension://.../options.html` 也被 URL policy 拦截，无法到达 options UI。 |

## Evidence

### T09 / T11 Extension Baseline

`http://localhost:4399/` was opened through @chrome.

```json
{
  "url": "http://localhost:4399/",
  "title": "Bench 靶场 · 首页",
  "bodyHeading": "浏览器 Agent 工具对比靶场",
  "badgeExists": false,
  "badgeText": null
}
```

Interpretation: the connected @chrome profile did not show Bench Badge on the target page during this run. This is a missing runtime precondition for both T09 and T11, but it is not the only blocker.

### T09 Extension Management Attempt

Attempted to navigate the @chrome-controlled tab to:

```text
chrome://extensions/
```

Result:

```text
Browser Use rejected this action due to browser security policy. Reason: Browser Use cannot visit the requested page because its URL is blocked by the Browser Use URL policy.
```

The tab stayed on `http://localhost:4399/`. Because @chrome exposed no browser-level extension-management capability and `chrome://extensions/` was blocked, no reload path was available through @chrome.

### T11 Options Page Attempt

A previous local Playwright evidence file for the same bench extension identified this Bench Badge id:

```text
jkmndkochpgaleoechlemhdhbikdecnf
```

I used it only to test whether @chrome can open a `chrome-extension://` page at all:

```text
chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html
```

Result:

```json
{
  "navigated": false,
  "urlAfter": "about:blank",
  "titleAfter": "about:blank",
  "error": "Browser Use rejected this action due to browser security policy. Reason: Browser Use cannot visit the requested page because its URL is blocked by the Browser Use URL policy."
}
```

Interpretation: this is a scheme/security-policy boundary, not merely an unknown-extension-id result. @chrome blocked the navigation before the page could prove installed/missing.

### T10a GitHub Notifications

Opened through @chrome:

```text
https://github.com/notifications
```

Resolved page:

```text
https://github.com/notifications?query=is%3Aunread
```

Signals:

- Page title: `Notifications`
- Login form detected: `false`
- Inbox link: `Inbox 68`
- Pagination ranges: `1-25 of 68`, `26-50 of 68`, `51-68 of 68`
- Manual interruptions: 0
- Pages visited: unread list page plus its `Next` pagination URLs only

Unread titles read during this run:

_[标题清单已脱敏] 共 68 条未读，全部为本人各仓库的 CI / Build / Deploy / Sync 等 workflow 失败通知 + 2 条 PR review；具体标题与仓库名按惯例不入公开仓库（数量与计数已核验自洽）。_

Ground-truth caveat: I did not have a separate human baseline snapshot for comparison, so the ✅ is based on the live unread page state read by @chrome at execution time.

## Source / Safety Boundary Explanation

### Why T09 is not just "extension missing"

The bench page did not show Bench Badge in the @chrome-connected profile, but @chrome also blocked `chrome://extensions/`. That means the tool could neither verify the installed extension inventory through Chrome's extension UI nor reload an unpacked extension. Even if Bench Badge were installed elsewhere, this @chrome session did not expose an extension-management path.

### Why T11 is a Chrome plugin boundary

T11 requires discovering the extension id and operating:

```text
chrome-extension://<id>/options.html
```

This run tested both discovery and direct options reachability:

- Discovery through `chrome://extensions/`: blocked by URL policy.
- Direct known-id options URL: blocked by URL policy before page load.
- Browser capabilities: no extension-management or target-enumeration capability.

So the result is a @chrome product/security boundary for `chrome://` and `chrome-extension://` pages, not merely a failure to guess the id.

### Why T10b is unsupported for @chrome

T10b evaluates a tool-owned dedicated profile/session that survives across agent sessions. The Chrome plugin backend is a browser extension running in an existing Chrome profile; its exposed API in this run did not include:

- creating an isolated browser profile,
- saving/restoring GitHub auth state,
- selecting a non-default dedicated user-data-dir,
- attaching to the CDP `9223` profile.

Therefore T10b is outside @chrome's applicable surface as defined by the task card.
