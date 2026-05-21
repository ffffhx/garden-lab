# Codex Snapshot

Read-only snapshots for local Codex sessions.

This tool scans local Codex JSONL session files, renders a safe transcript preview, flags likely sharing risks, and exports a static HTML or Markdown snapshot. It never writes back to Codex session files and it never resumes or executes a session.

## Usage

```bash
pnpm snapshot list
pnpm snapshot preview <session-id>
pnpm snapshot export <session-id> --html --output snapshot.html
pnpm snapshot export <session-id> --md --output snapshot.md
pnpm snapshot serve --port 4321
pnpm snapshot record-trae --port 4732
```

The default Codex home is `$CODEX_HOME` or `~/.codex`.

## Trae Local Recorder

Trae does not always keep full assistant replies in readable local storage. The recorder is an explicit, local-only capture layer for your own Trae window:

```bash
pnpm snapshot record-trae --port 4732
```

Then open Trae DevTools for the Trae window you want to record and run:

```js
import("http://127.0.0.1:4732/trae-recorder.js")
```

If dynamic import is blocked:

```js
fetch("http://127.0.0.1:4732/trae-recorder.js").then((r) => r.text()).then((code) => (0, eval)(code))
```

The injected recorder hooks `fetch`, fetch response streams, `WebSocket`, and `EventSource`, then stores local JSONL capture events under `~/.codex-snapshot/trae-recordings`. The normal web UI lists these under the Trae module as `local recorder` sessions.

By default it records full request/response message bodies and stream chunks, but does not persist headers. Use `--record-sensitive-context` only when you also want request/response headers saved locally for protocol debugging:

```bash
pnpm snapshot record-trae --port 4732 --record-sensitive-context
```

## Safety Model

- Exports user and assistant messages by default.
- Skips developer/system/bootstrap messages.
- Hides tool calls unless `--include-tools` is passed.
- Hides tool output unless `--include-tool-output` is passed.
- Redacts common secrets, bearer tokens, JWTs, private key blocks, cookies, and local home paths.
- Produces static snapshots only; recipients cannot continue or operate the original thread.
- Trae recorder capture is opt-in per window and writes only to a local directory you control.

The redactor is intentionally conservative but not perfect. Review the risk panel before sharing exported files.
