# T10c 指定浏览器登录态（CDP 9223）运行记录

- 任务卡：`apps/browser-tool-bench/tasks/T10c-指定浏览器登录态-CDP9223.md`
- 目标：验证每个工具能否复用用户指定的现成 `9223` Chrome profile 登录态。
- 模型要求：每个工具一个独立 Subagent，`gpt-5.5` / `xhigh`。
- 执行方式：顺序执行，不并行抢同一个 9223 浏览器。
- 观察时间：2026-06-20 19:05-19:18 Asia/Shanghai。

## 前置状态

用户启动 9223 后，本轮预检确认：

```text
lsof -nP -iTCP:9223 -sTCP:LISTEN
Google 96425 ... TCP 127.0.0.1:9223 (LISTEN)

curl http://127.0.0.1:9223/json/version
Browser: Chrome/149.0.7827.116
webSocketDebuggerUrl: ws://127.0.0.1:9223/devtools/browser/88daa777-7389-4a89-8aad-df77b2877f3b

ps:
--user-data-dir=/Users/bytedance/Library/Application Support/Codex Chrome Profile Manager/profiles/test03-00064815
--remote-debugging-address=127.0.0.1
--remote-debugging-port=9223
```

`/json/list` 中可以看到 Codex Chrome Extension popup 与 service worker，说明扩展安装/启用在 9223 profile 中成立；但扩展 popup 显示 `Disconnected`，这是 Codex Chrome plugin bridge 的连接状态，不等同于 9223 CDP 连接状态。

## 汇总

| 工具 | Subagent | 判定 | 关键证据 |
| --- | --- | --- | --- |
| @chrome | Lorentz | ❌ | Chrome plugin 可连接并能读 GitHub 登录态，但唯一 URL 未出现在 `127.0.0.1:9223/json/list` |
| @browser | Noether | N-R | in-app browser 可用，但无绑定外部 CDP endpoint 的 API |
| agent-browser 0.27.2 | Banach | ✅ | `get cdp-url` 返回 `ws://127.0.0.1:9223/...`，唯一 URL 命中 9223 target |
| bb-browser 0.14.2 | Bohr | ✅ | `status --port 9223 --json` 显示 `cdpConnected=true` / `cdpPort=9223`，唯一 URL 命中 9223 target |
| DevTools MCP 1.3.0 | Hegel | ✅ | daemon args 包含 `--browser-url http://127.0.0.1:9223`，唯一 URL 命中 9223 target |
| playwright-cli 0.1.14 | Kepler | ✅ | `attach --cdp=http://127.0.0.1:9223` 成功，唯一 URL 命中 9223 target |

## 分工具记录

### agent-browser

- 版本：`agent-browser 0.27.2`
- 绑定证据：
  - `agent-browser --cdp 9223 connect 9223` -> `Done`
  - `agent-browser --cdp 9223 get cdp-url` -> `ws://127.0.0.1:9223/devtools/browser/88daa777-7389-4a89-8aad-df77b2877f3b`
  - `/json/list` 中存在唯一 URL，target 为 `ws://127.0.0.1:9223/devtools/page/9C7B30D4872E8678A4B843F7C8171971`
- 最终 URL：`https://github.com/notifications?query=is%3Aunread&t10c=agent-browser-20260620190614`
- GitHub 登录态：已登录，页面标题为 `Notifications`，服务 worker target 中可见 `current_user=ffffhx`
- 未读通知：`70`（页面显示 `Inbox 70` / `1-25 of 70`）
- 前 5 条：
  1. `ffffhx/garden-lab - CI #387`
  2. `ffffhx/garden-lab - CI #386`
  3. `ffffhx/garden-lab - CI #376`
  4. `ffffhx/garden-lab - CI #375`
  5. `ffffhx/open-token-board - CI #41`
- 写状态风险：仅打开、读取、snapshot、curl；未点击通知或标记已读控件。

### bb-browser

- 版本：`bb-browser 0.14.2`
- 绑定证据：
  - `bb-browser status --port 9223 --json` 显示 `cdpConnected=true`、`cdpHost=127.0.0.1`、`cdpPort=9223`
  - `/json/list` 中存在唯一 URL，target 为 `ws://127.0.0.1:9223/devtools/page/8CFF90037C20E34451EB944DF15703E3`
- 最终 URL：`https://github.com/notifications?query=is%3Aunread&t10c=bb-browser-20260620190809`
- GitHub 登录态：已登录，页面标题为 `Notifications`
- 未读通知：`70`
- 前 5 条：
  1. `ffffhx/garden-lab - CI #387`
  2. `ffffhx/garden-lab - CI #386`
  3. `ffffhx/garden-lab - CI #376`
  4. `ffffhx/garden-lab - CI #375`
  5. `ffffhx/open-token-board - CI #41`
- 写状态风险：仅 `open`、`status`、`tab list`、`snap`、只读 `eval` 和 `/json/list`。

### DevTools MCP

- 版本：`chrome-devtools-mcp --version` 输出 `1.2.0`；实际 daemon 为 `1.3.0`
- 绑定证据：
  - `chrome-devtools status` 的 daemon args 包含 `--browser-url http://127.0.0.1:9223`
  - `/json/version` 返回 `ws://127.0.0.1:9223/devtools/browser/...`
  - `/json/list` 中存在唯一 URL，target 为 `ws://127.0.0.1:9223/devtools/page/4BC9000EBA1596D2EDEED0F824494F1F`
- 最终 URL：`https://github.com/notifications?query=is%3Aunread&t10c=devtools-mcp-20260620191048`
- GitHub 登录态：已登录，snapshot/DOM 显示通知页、Inbox、Unread、通知列表
- 未读通知：`70`
- 前 5 条：
  1. `ffffhx/garden-lab - CI #387`
  2. `ffffhx/garden-lab - CI #386`
  3. `ffffhx/garden-lab - CI #376`
  4. `ffffhx/garden-lab - CI #375`
  5. `ffffhx/open-token-board - CI #41`
- 写状态风险：仅打开页面、读取 snapshot/DOM、`/json/list` 复核；一次只读 `evaluate_script` selector 写错后重试，无状态影响。

### playwright-cli

- 版本：`playwright-cli 0.1.14`
- 绑定证据：
  - `playwright-cli attach --cdp=http://127.0.0.1:9223` 输出 `Session default created, attached to http://127.0.0.1:9223`
  - `/json/version` 返回 `Chrome/149.0.7827.116`、`ws://127.0.0.1:9223/devtools/browser/88daa777-...`
  - `/json/list` 中存在唯一 URL，target 为 `ws://127.0.0.1:9223/devtools/page/3362C8B49F6C78E1A4FAC761C494EDE9`
- 最终 URL：`https://github.com/notifications?query=is%3Aunread&t10c=playwright-cli-20260620191437`
- GitHub 登录态：已登录，页面标题为 `Notifications`，可见用户导航头像
- 未读通知：`71`（运行期间出现一条新的 GitHub invitation，动态字段从 70 变为 71）
- 前 5 条：
  1. `Mitsuiiiiiii/2026keshe - Invitation to join Mitsuiiiiiii/2026keshe`
  2. `ffffhx/garden-lab - CI #387`
  3. `ffffhx/garden-lab - CI #386`
  4. `ffffhx/garden-lab - CI #376`
  5. `ffffhx/garden-lab - CI #375`
- 写状态风险：未点击通知、复选框、Dismiss、Get started、标记已读或任何状态按钮；未使用 state 文件或自启 browser。

### @chrome

- 工具状态：Codex Chrome plugin 已连接；bundle `chrome/26.616.32156`；extension id `hehggadaopoacecdllhhajmbjkdcmajg`
- @chrome 打开的唯一 URL：`https://github.com/notifications?query=is%3Aunread&t10c=chrome-plugin-20260620T111729162Z`
- 最终 URL：同上
- GitHub 登录态：已登录，DOM `meta[name="user-login"] = ffffhx`
- 未读通知：`71`
- 前 5 条：
  1. `Mitsuiiiiiii/2026keshe - Invitation to join Mitsuiiiiiii/2026keshe`
  2. `ffffhx/garden-lab - CI #387`
  3. `ffffhx/garden-lab - CI #386`
  4. `ffffhx/garden-lab - CI #376`
  5. `ffffhx/garden-lab - CI #375`
- 绑定 9223 证据：未通过。`curl http://127.0.0.1:9223/json/list` 没有出现 `t10c=chrome-plugin-20260620T111729162Z`；只看到其他工具留下的 notifications targets，以及 Codex Chrome Extension 的 service worker。
- 判定：❌。@chrome 可运行且能免登录读 GitHub，但不能证明控制的是用户指定 9223 profile；T10c 的核心要求不是“某个 Chrome 有登录态”，而是“指定现成 9223 profile”。

### @browser

- 工具状态：@browser `control-in-app-browser` bootstrap 成功；选择 `Codex In-app Browser`，类型为 `iab`
- 绑定 9223 证据：无。`iab` browser 级能力只有 `visibility` / `viewport`，没有指定外部 CDP endpoint 的 connect/bind API；tab 级 `cdp` 能力是当前 in-app tab 的受限调试通道，不是连接 `http://127.0.0.1:9223`
- 最终 URL / GitHub 登录态 / 未读通知：N/A，按任务要求确认无绑定能力后停止，未用 in-app 独立浏览器代跑。
- 判定：N-R。

## 结论

T10c 把“复用登录态”拆得更清楚：

- `agent-browser --cdp 9223`、`bb-browser --port 9223`、`DevTools MCP --browserUrl http://127.0.0.1:9223`、`playwright-cli attach --cdp=http://127.0.0.1:9223` 本轮都能复用用户指定的 9223 profile。
- `@chrome` 能通过 Codex Chrome plugin 控制一个已登录 Chrome，但本轮无法证明它控制的是 9223，因此应记 ❌ 而不是 ✅。
- `@browser` 是 in-app browser，没有绑定外部 9223 profile 的能力，应记 N-R。

这也解释了 Chrome 扩展 popup 的 `Disconnected`：它表示 Codex Chrome plugin bridge 没有连接到该扩展实例；而 9223 的 CDP 连接本身可以同时是正常的。
