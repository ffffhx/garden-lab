# T09/T10/T11 fixed-env rerun 总报告

日期：2026-06-14

工作区：`/Users/bytedance/Code/garden-lab`

靶场：`http://localhost:4399/`

主目标 profile：Chrome CDP `127.0.0.1:9223`

本轮目标：先补齐前置，再重新比较六个工具在 T09/T10/T11 上的真实能力边界。

## 本轮前置修复

本轮不再把“没安装”当成能力结论，而是先修前置：

1. `9223` profile 已安装 Bench Badge。
   - 通过 CDP `Extensions.loadUnpacked` 装载 `apps/browser-tool-bench/extension-sample/`。
   - 扩展 ID：`jkmndkochpgaleoechlemhdhbikdecnf`。
   - 验证结果：新开 `http://localhost:4399/` 页面可看到 `BENCH EXT v1.0.0`。

2. Chrome DevTools MCP 已安装。
   - npm 全局安装：`chrome-devtools-mcp@1.2.0`。
   - 运行命令：`chrome-devtools-mcp --browserUrl http://127.0.0.1:9223 --experimentalIncludeAllPages --categoryExtensions --no-usage-statistics`。
   - `tools/list` 暴露 `list_extensions`、`reload_extension`、`install_extension`、`new_page`、`evaluate_script` 等工具。
   - Codex 当前插件安装列表里没有可安装的 Chrome DevTools MCP 插件命名空间，因此本轮用 npm MCP server + stdio JSON-RPC 客户端执行。

3. T09 的 manifest 修改用原子目录锁串行化。
   - 锁路径：`/tmp/browser-tool-bench-t09.lockdir`。
   - macOS 本机没有 `flock`，所以改用 `mkdir` 原子锁。
   - 每个成功或失败路径都要求恢复 `manifest.json` 到 `1.0.0`。

4. 收尾状态已核验。
   - `apps/browser-tool-bench/extension-sample/manifest.json` 当前版本为 `1.0.0`。
   - `git diff -- apps/browser-tool-bench/extension-sample/manifest.json` 为空。
   - `/tmp/browser-tool-bench-t09.lockdir` 不存在。
   - `git diff --check` 通过。

## 源码与任务卡佐证

T09 不是简单刷新页面，而是要求扩展 reload 后徽标版本变化。任务卡写明前置是页面显示 `BENCH EXT v1.0.0`，成功标准是 reload 后徽标变成 `BENCH EXT v1.0.1`。

T10a 测的是默认/真实 profile 的 GitHub 登录态复用。判定标准是免登录拿到未读数和标题；撞登录墙、不能接入默认 profile，均为失败。

T10b 测的是工具自有专用 profile/session 的持久化。它与 T10a 不同，要求先在工具专用 profile 中登录并保存，之后新会话免登录读取通知页。`@chrome` / `@browser` 在任务卡中就是不适用对照项，因为它们不提供工具自管专用 profile 路线。

T11 测的是扩展 options 页用户路径。任务卡要求 Agent 自己发现扩展 ID，打开 `chrome-extension://<id>/options.html`，在 `#badge-text` 输入 `HELLO-2026`，点保存，再到靶场验证 `HELLO-2026 · v1.0.0`。

扩展源码与这些判据一致：

- `manifest.json` 声明 `Bench Badge` 版本 `1.0.0`，`options_ui.page = options.html`，content script 只匹配 `localhost:4399` / `127.0.0.1:4399`。
- `content.js` 用 `chrome.runtime.getManifest().version` 生成徽标；无自定义文字时显示 `BENCH EXT v<version>`，有自定义文字时显示 `<badgeText> · v<version>`。
- `options.js` 把 `#badge-text` 写入 `chrome.storage.local.badgeText`，保存成功后显示提示。

因此本轮所有 T09/T11 的通过结论，都必须同时满足“扩展侧动作成功”和“靶场页面徽标验证成功”。

## 最终矩阵

| 工具 | T09 扩展 reload | T10a 真实登录态默认 profile | T10b 专用 profile 持久化 | T11 扩展 options 页 | 本轮能力边界 |
| --- | --- | --- | --- | --- | --- |
| Codex `@chrome` | ❌ | ✅ | N/A | ❌ | 能读当前 Chrome 登录态页面，但 `chrome://extensions` 与 `chrome-extension://` 被 URL policy 拦截；没有扩展管理 API。 |
| Codex `@browser` | ❌ | ❌ | N/A | ❌ | in-app Browser 与用户 Chrome profile 隔离，无 GitHub 登录态，也不能访问 `chrome://` / `chrome-extension://`。 |
| `agent-browser 0.27.2` | ❌（严格 9223）/ ✅（托管 profile 诊断） | ❌ | ❌ | ❌（严格 9223）/ ✅（托管 profile 诊断） | `--cdp 9223` / `connect 9223` 在本机没有可靠命中 9223，实际动作落到 agent-browser 自管 Chrome for Testing。托管 profile 能做扩展 reload/options，但不能记为 9223 成功。 |
| `bb-browser 0.14.2` | ⚠️ | ✅ | ❌ | ❌ | `--port 9223` 能读真实登录态；扩展 reload 需要 `eval` 点内部按钮，原生 click 失败且 v1.0.1 成功证据受并发污染，只能记条件成功；`chrome-extension://` options 页路径失败。 |
| Chrome DevTools MCP `1.2.0` | ✅ | ✅ | ⚠️ | ✅ | 扩展工具是强项：能 list/reload extension，也能把 options 页作为一等 target 操作。T10b 只证明 fresh MCP session 能复用 9223 现有登录 target；没有完整验证独立 `userDataDir` 专用 profile。 |
| `playwright-cli 0.1.14` | ✅ | ❌ | ⚠️ | ✅ | 自管 persistent Chromium/CfT 路线可以加载和操作扩展；不能接入系统默认 Chrome 登录态。T10b 机制存在，但没有首轮人工登录 state，因此只能到登录墙。 |

## 各工具结论

### Codex `@chrome`

T10a 成功：打开 GitHub Notifications 后免登录，读到 `Inbox 68`，分页为 `25 + 25 + 18`，未执行任何写操作。

T09/T11 失败不是“Bench Badge 没装”这么简单。当前 `@chrome` 连接的 Chrome profile 没有在靶场页注入 Bench Badge，同时 `chrome://extensions/` 和已知 ID 的 `chrome-extension://.../options.html` 都被 Browser Use URL policy 拦截。即使外部把扩展装好，`@chrome` 本轮也没有暴露 reload/options 操作通道。

### Codex `@browser`

`@browser` 是 in-app Browser。它没有继承用户 Chrome 的 GitHub 登录态，T10a 打到 GitHub 登录页。它也不能打开 `chrome://extensions/` 或 `chrome-extension://.../options.html`，所以 T09/T11 失败是产品安全/封装边界。

### `agent-browser`

按用户要求，browser 命令都带了 `--cdp 9223`。但独立 target 检查显示：

- `agent-browser --cdp 9223 open <unique-url>` 后，`agent-browser get url` 能看到该 URL；
- `curl http://127.0.0.1:9223/json/list` 找不到该 URL；
- 同一 URL 出现在 agent-browser 自管 Chrome for Testing 的 CDP 端口 `127.0.0.1:62070`；
- 进程命令行显示该浏览器使用临时 `agent-browser-chrome-*` user-data-dir。

所以严格 9223/profile 维度下，T09/T10a/T10b/T11 都不能记为成功。托管 profile 诊断中，T09 reload 和 T11 options UI 都能跑通，这说明 agent-browser 的扩展页操作能力存在；失败点是本机 0.27.2 对外部 `9223` profile 的绑定不可靠。

### `bb-browser`

`bb-browser --port 9223` 能命中真实 GitHub 登录态，T10a 读取到 `68` 条未读通知，且没有登录或写操作。

T09 比旧报告有进展：本轮 `chrome://extensions/` 可达，并能通过 `bb-browser eval` 点击 Bench Badge 的 `dev-reload-button`。但原生 `click` 内部按钮失败；v1.0.1 成功证据发生在锁修正前，可能受并发 manifest 修改影响。锁内最终只验证了恢复基线 `v1.0.0`，所以更严谨地记为 `⚠️ 条件成功`。

T11 失败：能发现扩展 ID，但 `open chrome-extension://.../options.html` 被规范化成错误 URL，JS navigation / detail-page options entry 最终到 `chrome-error://chromewebdata/`，无法进入 `#badge-text` 和 `#save`。

T10b 失败：bb 自管 profile 在 `[::1]:9222`，不是裸 `127.0.0.1:9222`；显式 `BB_BROWSER_CDP_URL=http://[::1]:9222` 可连，但 GitHub 是登录页，没有保存过可用登录态。

### Chrome DevTools MCP

本轮 DevTools MCP 是补齐环境后最清晰的成功列。

T09：`list_extensions` 看到 Bench Badge，`reload_extension` 在 manifest `1.0.1` 时 reload 后，靶场徽标变成 `BENCH EXT v1.0.1`；恢复后重新验证 `BENCH EXT v1.0.0`。

T10a：通过 `--browserUrl http://127.0.0.1:9223` 使用真实 profile，GitHub Notifications 无登录墙，读到 `68` 条。

T11：通过 `list_extensions` 发现 ID，打开 `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html`，用 MCP 的 `fill` / `click` 走 UI 保存 `HELLO-2026`，靶场验证 `HELLO-2026 · v1.0.0`，最后清空恢复默认徽标。

T10b 只能记 `⚠️`：fresh MCP session 能重新选择已有 GitHub 通知 target 并读到登录态，但两次 `new_page` 新开通知页超时，而且这仍然是复用 9223，不是独立 MCP `userDataDir` 专用 profile 路线。

### `playwright-cli`

T09 和 T11 都通过，但通过的是 `playwright-cli` 自管 persistent Chromium/CfT 路线，而不是系统默认 Chrome profile。

T09：带锁把 manifest 改为 `1.0.1`，在 `chrome://extensions` reload 后，靶场徽标验证为 `BENCH EXT v1.0.1`；之后恢复 `1.0.0`。

T11：自管 persistent session 加载 extension，发现 ID，打开 options 页，保存 `HELLO-2026`，靶场验证 `HELLO-2026 · v1.0.0`。

T10a 失败：`--cdp=chrome` 解析到 `ws://localhost:9222/devtools/browser` 后 404；`--extension=chrome` 找不到 Playwright Extension。它没有成功接入系统默认 Chrome 登录态。

T10b 部分：`state-save` / `state-load` 机制存在，persistent profile 机制也存在；但没有阶段一人工登录的 GitHub state，fresh dedicated profile 只能到 GitHub 登录页。

## 与旧报告的差异

旧报告的第二轮矩阵大致是：

- `@chrome`：T09 blocked，T10 pass；
- `@browser`：T09 blocked，T10 blocked；
- `agent-browser`：T09 pass，T10 pass；
- `bb-browser`：T09 blocked，T10 pass；
- DevTools MCP：T09 pass，T10 pass；
- `playwright-cli`：T09 pass，T10 blocked。

本轮主要差异与解释：

1. `agent-browser` 从旧报告的 T09/T10 pass，改为“严格 9223 下失败，托管 profile 诊断成功”。
   - 原因：这次加了目标归属核验，证明 `--cdp 9223` 的页面动作实际落在 `62070` 的 agent-browser managed Chrome，而不是 `9223`。
   - 结论：旧报告能证明它有扩展操作/页面读取能力，但不能证明它稳定控制了指定 9223 profile。对于本用户环境的 9223 固定要求，本轮结论更能代表真实边界。

2. `bb-browser` 的 T09 从 blocked 变成 `⚠️ 条件成功`。
   - 原因：这次明确清理 daemon 状态并使用 `--port 9223`，`chrome://extensions` 可达；通过 eval 能点到 reload button。
   - 但原生 click 仍失败，且 v1.0.1 成功证据有并发污染风险，所以不能升级为完全成功。

3. DevTools MCP 的扩展能力从“可能缺 MCP / profile 不一致”变成明确通过。
   - 原因：本轮安装了 `chrome-devtools-mcp@1.2.0`，并把 Bench Badge 装进 9223，然后用 MCP extension tools 操作。
   - 结论：T09/T11 的通过是工具能力边界的正面体现，不再是“刚好连到 9222 有扩展”的偶然。

4. `playwright-cli` 的 T09/T11 通过是真能力，但边界也更清楚。
   - 它适合自管 persistent Chromium/CfT 扩展测试。
   - 它不适合 T10a 这种“借用系统默认 Chrome 登录态”的任务。

5. GitHub 未读数从旧报告的 `66` 变成 `68`。
   - 这是 GitHub 实时账户状态变化，不是工具能力变化。
   - 本轮所有成功读取 T10a 的工具都读到同一个 `68`，说明读数一致性正常。

6. `@chrome` / `@browser` 的扩展页结论没有实质变化。
   - `@chrome` 仍是只读真实登录态页面强，扩展内部页弱。
   - `@browser` 仍是隔离浏览器，不继承真实 Chrome 登录态，也不支持扩展内部页。

## 哪次更能代表真实工具边界

对 T09/T11：以本轮为准。

理由是本轮先把 Bench Badge 安装到目标 profile，再用任务卡要求的徽标变化验证成功/失败，并且锁住 manifest 修改。旧报告中 T09 受 `9222` / `9223` profile 漂移和共享状态污染影响较大，只能作为历史诊断材料。

对 T10a：只比较“是否命中真实登录态 profile”，不要比较具体未读数。

旧报告的 `66` 与本轮的 `68` 都可能是当时真实值。真正边界是：

- `@chrome`、`bb-browser --port 9223`、DevTools MCP `--browserUrl 9223` 能读真实登录态；
- `@browser`、`playwright-cli` 自管 profile 不能；
- `agent-browser 0.27.2` 在本机不能可靠按 `--cdp 9223` 命中真实登录态。

对 T10b：本轮没有任何工具完整通过“阶段一人工登录并保存状态，阶段二新会话免登录”的闭环。

真实边界应写成：

- `agent-browser` 和 `playwright-cli` 有 state/profile 机制，但本轮没有可用的已登录 state；
- DevTools MCP 可复用 9223 的已有 profile 状态，但这不是独立专用 profile 闭环；
- `bb-browser` 自管 profile 没有 GitHub 登录态；
- `@chrome` / `@browser` 不适用这个任务模型。

## 产物

六个 subagent 的原始报告：

- `chrome/REPORT.md`
- `browser/REPORT.md`
- `agent-browser/REPORT.md`
- `bb-browser/REPORT.md`
- `devtools-mcp/REPORT.md`
- `playwright-cli/REPORT.md`

旧的未修复前置/初跑目录仍保留在 `formal-2026-06-14-t09-t11-subagents/`，不要和本轮 fixed-env 结果混用。
