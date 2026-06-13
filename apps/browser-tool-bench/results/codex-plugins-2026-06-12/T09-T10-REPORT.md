# Browser 工具专项对比：T09 / T10（2026-06-12）

## 方法

本轮只补测 `apps/browser-tool-bench` 的两个真实环境任务：

- T09：本地 Chrome 扩展 reload。测试时先把 `apps/browser-tool-bench/extension-sample/manifest.json` 改到 `1.0.1`，要求工具 reload 已加载的本地 unpacked 扩展，再刷新 `http://localhost:4399/` 并看到 `BENCH EXT v1.0.1`。
- T10：真实登录态。要求工具使用用户已经登录的浏览器打开 `https://github.com/notifications`，只读统计未读通知数量和标题，不重新登录、不修改通知。

为了保持上下文干净，本轮每个 cell 都用独立 subagent，且 `fork_context=false`。subagent 只拿到任务 prompt 和对应工具限制，禁止读取 `apps/browser-tool-bench/results/*`，也禁止用其它浏览器工具替代被测工具。

T10 涉及真实 GitHub 通知标题，标题已由 subagent 实际读取并在当前线程输出中验证；本仓库报告只记录数量和能力结论，不落盘完整标题。

## 结果矩阵

| 工具 | T09 扩展 reload | T10 真实登录态 | 结论 |
| --- | --- | --- | --- |
| Codex `@chrome` | BLOCKED | BLOCKED | 当前 Codex Chrome bridge 不可用，`Browser is not available: extension` |
| Codex `@browser` | BLOCKED | BLOCKED | in-app Browser 没有扩展 reload 能力，也没有用户 Chrome GitHub 登录态 |
| `agent-browser` | PASS | PASS | 两题都能使用真实 Chrome/扩展状态完成 |
| `bb-browser` | BLOCKED | BLOCKED | 托管浏览器无 GitHub 登录态；无扩展 reload 命令，`chrome://extensions` 被改写失败 |
| Chrome DevTools MCP | BLOCKED | PASS | 能连 9223 真实登录态；扩展 API 存在但本轮可访问 profile 中没有 Bench Badge |
| `playwright-cli` | BLOCKED | BLOCKED | 默认隔离 profile 无登录态；可在新 profile 加载扩展但不满足“reload 已加载真实扩展” |

## T09 明细

### Codex `@chrome`

- 状态：BLOCKED
- 观察：`@chrome` setup 和 retry 都返回 `Browser is not available: extension`。
- 结果：无法 reload 扩展，也无法刷新页面验证徽标。

### Codex `@browser`

- 状态：BLOCKED
- 观察：in-app Browser 只暴露页面可见交互能力，没有 extension reload API。
- 观察：尝试打开 `chrome://extensions/` 被 Browser URL policy 拦截。
- 结果：无法操作本地 Chrome 扩展。

### `agent-browser`

- 状态：PASS
- 观察：能打开 `chrome://extensions`，找到 `Bench Badge`。
- 观察：开启 Developer Mode 后，扩展详情显示版本 `1.0.1`。
- 观察：点击扩展的 reload，再刷新 `http://localhost:4399/`。
- 结果：页面 DOM/snapshot 显示 `BENCH EXT v1.0.1`。

### `bb-browser`

- 状态：BLOCKED
- 观察：`bb-browser --help` 没有 extension/reload-extension 命令。
- 观察：打开 `chrome://extensions/` 被改写成 `https://chrome//extensions/`，进入证书错误页。
- 观察：刷新靶场后没有看到 `v1.0.1` 徽标。
- 结果：无法完成真实扩展 reload。

### Chrome DevTools MCP

- 状态：BLOCKED
- 观察：MCP 暴露了 `list_extensions` / `reload_extension`。
- 观察：默认 MCP profile 和 `browserUrl` 9222 都显示没有扩展。
- 观察：`browserUrl` 9223 只看到 `Coze Test Account Switcher`，没有 `Bench Badge`。
- 结果：有 reload 能力面，但本轮可访问 profile 中没有目标扩展，无法完成 T09。

### `playwright-cli`

- 状态：BLOCKED
- 观察：Playwright 可以在新建 `/tmp` Chromium profile 里加载 `Bench Badge` 并看到 `BENCH EXT v1.0.1`。
- 观察：这不满足 T09 的“reload 已加载的用户 Chrome 扩展”前置。
- 观察：`connectOverCDP` 到现有 Chrome 9223 时在附着扩展 service worker 上崩溃；9222 是 bb-browser profile，不作为有效成功路径。
- 结果：不能按原题完成真实扩展 reload。

## T10 明细

### Codex `@chrome`

- 状态：BLOCKED
- 登录态：unknown
- 观察：同 T09，`@chrome` bridge 返回 `Browser is not available: extension`。
- 结果：无法打开 GitHub Notifications。

### Codex `@browser`

- 状态：BLOCKED
- 登录态：no
- 观察：打开 `https://github.com/notifications` 后跳到 GitHub 登录页。
- 结果：in-app Browser 没有用户 Chrome 的 GitHub 登录态。

### `agent-browser`

- 状态：PASS
- 登录态：yes
- 未读通知：66
- 观察：`--auto-connect` / CDP 9222 落到 GitHub 登录页，切到 CDP 9223 后成功使用现有登录态。
- 观察：`is:unread` 页分页计数为 `25 + 25 + 16`，无下一页。
- 结果：未重新登录、未点击通知详情、未修改通知状态。

### `bb-browser`

- 状态：BLOCKED
- 登录态：no
- 观察：`bb-browser open https://github.com/notifications` 进入托管浏览器 tab。
- 观察：页面跳转到 GitHub 登录页；`--port` / `--openclaw` 检查仍是同一个 9222 bb-browser session。
- 结果：没有用户现有 GitHub 登录态。

### Chrome DevTools MCP

- 状态：PASS
- 登录态：yes
- 未读通知：66
- 观察：连接到现有 Chrome `http://127.0.0.1:9223`。
- 观察：页面显示 `meta[name=user-login]=ffffhx` 且 `signedOut=false`。
- 观察：未读页分页计数为 `25 + 25 + 16`。
- 结果：未重新登录、未点击通知详情、未修改通知状态。

### `playwright-cli`

- 状态：BLOCKED
- 登录态：no
- 观察：使用 Playwright CLI/runtime 打开 `https://github.com/notifications`。
- 观察：默认 profile 跳到 GitHub 登录页。
- 结果：没有用户现有 GitHub 登录态。

## 第二轮复测

第二轮继续使用独立 subagent，并把 T09 做成更严格的串行前置控制：

1. 每个 T09 cell 前先确认真实 Chrome 目标页是 `BENCH EXT v1.0.0`。
2. 再把 `apps/browser-tool-bench/extension-sample/manifest.json` 切到 `1.0.1`。
3. 只把该工具放进 subagent 里执行 reload 和验证。
4. cell 结束后恢复到 `1.0.0` 再继续下一个工具。

T10 仍为只读登录态测试，允许并行跑，但每个工具仍在独立 subagent 内执行。

### 第二轮结果矩阵

| 工具 | T09 扩展 reload | T10 真实登录态 | 第二轮变化 |
| --- | --- | --- | --- |
| Codex `@chrome` | BLOCKED | PASS | bridge 本轮可用，T10 通过；T09 卡在 `chrome://extensions` 安全策略 |
| Codex `@browser` | BLOCKED | BLOCKED | 与第一轮一致 |
| `agent-browser` | PASS | PASS | 与第一轮一致 |
| `bb-browser` | BLOCKED | PASS | T10 通过：本轮成功用 `--port 9223` 连接真实 Chrome 登录态 |
| Chrome DevTools MCP | PASS | PASS | T09 通过：本轮连到含 Bench Badge 的 9222 profile 并 reload 成功 |
| `playwright-cli` | PASS | BLOCKED | T09 通过：本轮 `connectOverCDP` 到含 Bench Badge 的 9222 profile |

### 第二轮 T09 明细

#### Codex `@chrome`

- 状态：BLOCKED
- 观察：本轮 `@chrome` bridge 可以连接，并能看到目标页和一个 `chrome://extensions/` tab。
- 观察：已有内部扩展 tab 不能被 claim；打开新的 `chrome://extensions/` 被 `@chrome` 安全策略拒绝。
- 结果：不能执行扩展 reload。

#### Codex `@browser`

- 状态：BLOCKED
- 观察：in-app Browser 可以打开/刷新 `http://localhost:4399/`，但 `chrome://extensions/` 被 URL policy 拦截。
- 结果：没有本地 Chrome 扩展 reload 能力。

#### `agent-browser`

- 状态：PASS
- 观察：连接已有 `http://localhost:4399/` tab。
- 观察：`chrome://extensions/` 里看到 `Bench Badge` 的 `重新加载` button。
- 观察：点击 reload 后刷新靶场。
- 结果：页面 snapshot 显示 `BENCH EXT v1.0.1`。

#### `bb-browser`

- 状态：BLOCKED
- 观察：本轮能连接 `127.0.0.1:9223` 并读取目标页，初始 badge 是 `BENCH EXT v1.0.0`。
- 观察：CLI 没有 extension reload/management 命令。
- 观察：`chrome://extensions` 会被规范化为 `https://chrome//extensions` 并进入错误页。
- 结果：刷新页面后 badge 仍是 `BENCH EXT v1.0.0`。

#### Chrome DevTools MCP

- 状态：PASS
- 观察：通过 `--browserUrl http://127.0.0.1:9222` 连接到含目标 tab 和 Bench Badge 的 profile。
- 观察：`chrome://extensions` 找到来自 `apps/browser-tool-bench/extension-sample` 的 unpacked `Bench Badge`。
- 观察：`developerPrivate.reload(...)` 返回 `reloadError:null`，扩展版本变为 `1.0.1`。
- 结果：刷新靶场后看到 `BENCH EXT v1.0.1`。

#### `playwright-cli`

- 状态：PASS
- 观察：Playwright `connectOverCDP` 连接到已有 Chrome `127.0.0.1:9222`。
- 观察：`chrome://extensions` 显示 `Bench Badge` version `1.0.1` 和 reload button。
- 观察：通过 Playwright 点击 reload 后刷新 `http://localhost:4399/`。
- 结果：页面 DOM 包含 fixed-position badge `BENCH EXT v1.0.1`。

### 第二轮 T10 明细

#### Codex `@chrome`

- 状态：PASS
- 登录态：yes
- 未读通知：66
- 观察：能使用现有 Chrome profile 打开 GitHub Notifications。
- 观察：页面是 logged-in GitHub UI；读到 66 个 unread rows，另有 1 个非 unread inbox row。
- 结果：未重新登录，未打开通知详情，未修改通知状态。

#### Codex `@browser`

- 状态：BLOCKED
- 登录态：no
- 观察：打开 GitHub Notifications 后跳到 GitHub 登录页。
- 结果：in-app Browser 没有用户 Chrome 登录态。

#### `agent-browser`

- 状态：PASS
- 登录态：yes
- 未读通知：66
- 观察：使用 `--auto-connect` 打开 `https://github.com/notifications?query=is%3Aunread`。
- 观察：分页计数为 `25 + 25 + 16`。
- 结果：未重新登录，未点击通知详情，未修改通知状态。

#### `bb-browser`

- 状态：PASS
- 登录态：yes
- 未读通知：66
- 观察：默认 9222 仍是 GitHub sign-in，但 `bb-browser --port 9223` 能列出已登录的 GitHub Notifications tab。
- 观察：DOM 显示 `Inbox 66`，分页范围是 `1-25 of 66`、`26-50 of 66`、`51-66 of 66`。
- 结果：本轮证明 bb-browser 只要显式连到 9223，也能使用真实登录态。

#### Chrome DevTools MCP

- 状态：PASS
- 登录态：yes
- 未读通知：66
- 观察：连接到现有 Chrome `http://127.0.0.1:9223`，而不是临时 MCP profile。
- 观察：GitHub 页面暴露 `meta[name=user-login]=ffffhx`。
- 观察：分页范围是 `1-25 of 66`、`26-50 of 66`、`51-66 of 66`。
- 结果：未点击通知详情，未修改通知状态。

#### `playwright-cli`

- 状态：BLOCKED
- 登录态：no
- 观察：Playwright 启动 isolated Chrome 打开 Notifications 后跳到 GitHub 登录页。
- 结果：默认 profile 不带用户 Chrome 登录态。

## 两轮小结

1. **agent-browser 两轮都稳定通过 T09/T10**：这是这两个真实状态任务里最稳定的一列。
2. **Chrome DevTools MCP 第二轮 T09/T10 都通过**：第一轮 T09 失败是因为连到的 profile 没有 Bench Badge；第二轮连到含 Bench Badge 的 9222 后，能用 `developerPrivate.reload` 完成扩展 reload。
3. **Playwright 第二轮 T09 通过，但 T10 仍 blocked**：它可以 `connectOverCDP` 到已有 Chrome 并操作 `chrome://extensions`，但默认启动的 isolated profile 没有 GitHub 登录态。
4. **bb-browser 第二轮 T10 通过，但 T09 仍 blocked**：显式 `--port 9223` 可以读真实登录态；但它缺少扩展 reload 通道，`chrome://extensions` URL 处理也不支持。
5. **Codex `@chrome` 第二轮 T10 通过但 T09 blocked**：bridge 本轮已恢复，真实登录态可用；扩展 reload 仍被 `chrome://extensions` 控制/安全边界限制。
6. **Codex `@browser` 两轮都不适合 T09/T10**：它是 in-app Browser，会话隔离且不能操作 Chrome 扩展页。

## 两轮差异原因复盘

两轮结果不同，主要不是任务本身随机，而是 T09/T10 都依赖机器上正在运行的共享 Chrome 状态；两轮之间这个状态发生了变化。

当前机器同时有两个 CDP Chrome：

- `127.0.0.1:9222`：`bb-browser` 管理的 Chrome，启动参数包含 `--user-data-dir=/Users/bytedance/.bb-browser/browser/user-data`。
- `127.0.0.1:9223`：Codex Chrome Profile Manager 的 Chrome，启动参数包含 `--user-data-dir=/Users/bytedance/Library/Application Support/Codex Chrome Profile Manager/profiles/test03-00064815`。

两者不是同一个 profile。后续本机检查显示：

- `9222` 的 profile 里安装了 Bench Badge，扩展 ID 是 `jkmndkochpgaleoechlemhdhbikdecnf`，路径是 `/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/extension-sample`。
- `9223` 的 profile 里没有 Bench Badge，但有用户 GitHub 登录态。

这解释了 T09/T10 的主要波动：

- T09 看的是“当前连接的 Chrome profile 里有没有 Bench Badge，以及能不能 reload 它”。第一轮 DevTools MCP / Playwright 没连到含 Bench Badge 的 profile，所以失败；第二轮它们连到了 `9222`，因此通过。
- T10 看的是“当前连接的 Chrome profile 里有没有 GitHub 登录态”。第一轮 bb-browser 主要落在默认 `9222`，所以失败；第二轮显式 `--port 9223` 后能读到登录态，所以通过。
- Codex `@chrome` 第一轮失败是 bridge transient unavailable，报 `Browser is not available: extension`；第二轮 bridge 可用，所以 T10 通过。但 T09 仍然卡在 `chrome://extensions` 这类内部页控制边界，结论没有真正反转。

因此第一轮里至少有两类不可比因素：

1. **前置 profile 不一致**：不同工具和 subagent 连接到了不同 CDP 端口，导致“有没有 Bench Badge / 有没有 GitHub 登录态”不同。
2. **评测过程污染了后续前置**：T09/cleanup 会 reload 或 load unpacked extension，这会改变共享 Chrome profile；第二轮不再是第一轮开始时的原始机器状态。

更严谨的后续评测应固定端口和 profile，例如分别定义：

- T09 固定只测 `9222`，并在每个 cell 前确认 `Bench Badge v1.0.0` 已安装且页面已显示。
- T10 固定只测 `9223`，并在每个 cell 前确认 GitHub 已登录。
- 对不支持指定 CDP 端口的工具，直接记录为“不支持指定 profile”，不要让它自动选择。
