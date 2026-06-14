# Codex @browser / in-app Browser T09-T11 rerun

Date: 2026-06-14

Tester scope: only the Browser plugin's in-app Browser client was used. I selected `agent.browsers.get("iab")`, reported by the runtime as `Codex In-app Browser` with `type=iab` and `codexIabTabMode=singleTab`.

Guardrails followed:

- Did not use Chrome plugin, agent-browser, bb-browser, playwright-cli, raw CDP, or Chrome DevTools MCP.
- Did not log in to GitHub, type credentials, mark notifications read, or open notification detail pages.
- Did not modify `apps/browser-tool-bench/extension-sample/manifest.json`; it remained `1.0.0`.
- Did not use the runtime-listed separate `Chrome` extension client. It was observed in `agent.browsers.list()`, but this cell is specifically for the in-app Browser (`iab`) surface.

Observed Browser surface:

- Browser capabilities on `iab`: `visibility`, `viewport`.
- Tab capabilities on `iab`: `pageAssets`.
- No exposed extension-management API, extension target enumeration API, state save/load API, or configurable profile/userDataDir API.
- `browser.user.openTabs()` returned `[]` for the in-app Browser context.

## Results

| Task | Result | Evidence | Boundary |
| --- | --- | --- | --- |
| T09 · local extension reload | ❌ | Opened `http://localhost:4399/`; `document.querySelector("#bench-ext-badge")` returned `null`. Then attempted `tab.goto("chrome://extensions/")`; Browser rejected the navigation by URL policy and stayed on the bench page. | Failure is not just "Bench Badge missing". The in-app Browser also cannot reach `chrome://extensions/` and exposes no extension reload API, so the required reload path is unavailable. |
| T10a · real login state/default Profile | ❌ | Opened `https://github.com/notifications`; final URL was `https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fnotifications`, title `Sign in to GitHub · GitHub`, with username/password fields visible. | The in-app Browser did not inherit the real default Chrome profile's GitHub login state. No notification count or titles were readable. |
| T10b · dedicated persistent profile | N/A | Opened `https://github.com/notifications` in a fresh in-app Browser tab and again reached the GitHub login page. The exposed `iab` API has no dedicated profile/session restore mechanism equivalent to state save/load or persistent userDataDir. | T10b is outside the in-app Browser capability model. This is a tool boundary, not a GitHub credential failure. |
| T11 · extension options page | ❌ | `chrome://extensions/` was blocked, so Browser could not discover the Bench Badge extension ID through the UI. A direct support probe to `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html` was also rejected by the same Browser URL policy before any options page loaded. | The in-app Browser cannot access either `chrome://extensions` or `chrome-extension://.../options.html`; no options form interaction was possible. |

## Detailed evidence

### Tool identity

`agent.browsers.list()` returned both a `Chrome` extension client and a `Codex In-app Browser` client. Per this task's scope, I used only:

```text
name: Codex In-app Browser
type: iab
metadata.codexIabTabMode: singleTab
```

The separate `Chrome` extension client was not selected or used.

### T09

Baseline page probe:

```json
{
  "url": "http://localhost:4399/",
  "title": "Bench 靶场 · 首页",
  "badgeText": null
}
```

`chrome://extensions/` probe:

```text
Browser Use rejected this action due to browser security policy.
Reason: Browser Use cannot visit the requested page because its URL is blocked by the Browser Use URL policy.
```

The tab remained at `http://localhost:4399/`. Because Browser cannot open the extension management page and has no extension reload API, T09 cannot be completed on `iab`.

### T10a

Read-only GitHub probe:

```json
{
  "urlAttempted": "https://github.com/notifications",
  "finalUrl": "https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fnotifications",
  "title": "Sign in to GitHub · GitHub",
  "hasLoginForm": true,
  "candidateNotificationItems": []
}
```

No login was attempted. Result: no unread notification count or title list was available through the in-app Browser.

### T10b

The task card says `@chrome / @browser` are not applicable for the dedicated-profile route because their login state route is the default-profile route tested by T10a. I still checked the in-app Browser boundary:

```json
{
  "browserCapabilities": ["visibility", "viewport"],
  "finalUrl": "https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fnotifications",
  "title": "Sign in to GitHub · GitHub",
  "hasLoginForm": true
}
```

No persisted dedicated profile was available or configurable from the Browser `iab` surface.

### T11

The extension ID could not be discovered through `chrome://extensions/` because that URL was blocked. To avoid treating "no badge on localhost" as the whole answer, I also made a direct scheme support probe using the Bench Badge ID known from existing benchmark evidence:

```json
{
  "urlAttempted": "chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html",
  "gotoOk": false,
  "finalUrl": "https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fnotifications",
  "hasBadgeInput": false,
  "hasSaveButton": false
}
```

The direct `chrome-extension://` navigation was rejected by Browser URL policy, so the options page could not be loaded and no form operation was possible.

## Metrics

| Task | Browser actions counted | Elapsed browser-side evidence | User interruptions | Notes |
| --- | ---: | --- | ---: | --- |
| T09 | 2 | bench page probe ~0.4s; `chrome://extensions/` rejection ~0.06s | 0 | No manifest edit was performed. |
| T10a | 1 | GitHub navigation/probe ~1.5s | 0 | Stopped at login wall. |
| T10b | 1 | GitHub navigation/probe ~0.4s | 0 | No dedicated profile restore mechanism exposed. |
| T11 | 2 | `chrome://extensions/` blocked; direct `chrome-extension://` rejection ~0.06s | 0 | No options UI reached. |

Token usage was not available per cell from the Browser plugin runtime.

## Conclusion

For the Browser plugin's in-app Browser (`iab`) surface in this fixed-env rerun:

- It does not support Chrome extension development operations required by T09.
- It does not support `chrome://extensions/`.
- It does not support `chrome-extension://.../options.html`.
- It did not inherit the real default Chrome profile's GitHub login state for T10a.
- It has no dedicated persistent profile/state restore surface for T10b.

This should be recorded as an in-app Browser capability boundary, not as a simple missing-extension precondition.
