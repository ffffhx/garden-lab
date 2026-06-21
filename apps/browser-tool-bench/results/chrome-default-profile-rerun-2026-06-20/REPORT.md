# @chrome · 系统默认 Profile 复跑报告

- 运行时间：2026-06-20
- 工具：Codex `@chrome` / Chrome extension bridge
- Profile：系统默认 Chrome，`profileName="您的 Chrome"`，`profileIsLastUsed=true`
- 排除项：T10 全部排除；T10c 仍要求证明绑定 `127.0.0.1:9223`，本轮明确不测 9223。
- 外场任务：仓库现有 `tasks-real/` 为 R01-R09 共 9 个任务，没有 R10。
- 原始证据：`raw-results.json`

## 能力探针

本轮 `@chrome` 已不再是单纯页面可见域工具，tab capability 暴露了 raw CDP：

| 能力 | 结果 | 说明 |
| --- | --- | --- |
| `Network.enable` | ✅ | 可读取请求、状态码和响应体 |
| `Runtime.evaluate` | ✅ | 可在页面登录态内执行表达式和 fetch |
| `Performance.enable` / Performance API | ✅ | 可读资源 timing |
| `Fetch.enable` / route mock | ❌ | 不能可靠拦截 XHR；实测会卡 Document；`Network.setRequestInterception` 不支持 |
| `chrome://extensions` | ❌ | 被 Browser Use URL policy 拦截 |
| Bench Badge 扩展 | ⚠️ | 首轮系统默认 profile 未加载；用户手动安装后，本地页与真实线上页均能看到 `BENCH EXT v1.0.0`，但 `chrome://` / `chrome-extension://` 仍被 URL policy 拦截 |

## T01-T20（排除 T10）

| 任务 | 结果 | 结论 |
| --- | --- | --- |
| T01 登录与观察 | ✅ | 登录成功，欢迎语工号 `BENCH-7341`。 |
| T02 Network 排障 | ✅ | `Network.getResponseBody` 读到 `POST /api/orders` 500，响应体含 `INSUFFICIENT_INVENTORY` / `SKU-8821`。 |
| T03 性能诊断 | ✅ | `blocking.css` responseEnd 约 1226ms，DCL 约 2042ms，中间约 816ms 对应 `heavy.js` 同步 `crunchAnalytics`；`hero.svg` 是并行干扰项。 |
| T04 请求 mock | ❌ | 没有可靠 route/mock；`Fetch`/`Network.setRequestInterception`/`Page.addScriptToEvaluateOnNewDocument` 均不能完成网络层 mock。 |
| T05 动态等待 | ✅ | 12 条动态，最后口令 `LIVE-512`。 |
| T06 结构化提取 | ✅ | 12 件商品，最贵 `雷霆工作站`，`15999` 元。 |
| T07 已登录 fetch | ✅ | CDP Runtime 在页面会话内 `fetch('/api/me')`，`plan=team-pro-2026`。 |
| T08 Shadow DOM | ✅* | 通过 CDP Runtime 穿透 open shadow root 点击，读到 `SHADOW-99`。 |
| T09 扩展 reload | ❌ | 默认 profile 无 Bench Badge，且 `chrome://extensions` 被 policy 拦截。 |
| T11 使用扩展 | ❌ | 默认 profile 无 Bench Badge，`chrome://` / `chrome-extension://` 设置页不可达。 |
| T12 Console / Source Map | ✅ | Console 异常 + source map 定位 `webpack://bench/src/cart/coupon.ts`、`applySelectedCoupon`、`selectedCoupon.couponCode`。 |
| T13 移动端遮挡 | ✅* | CDP 设 390x844；定位 `.mobile-support-bar` z-index 20 覆盖按钮；临时隐藏后验证 `MOBILE-39`。 |
| T14 Hydration | ✅ | `TaskSummary`，`HYD-908`，SSR `8/starter`，client `9/team-pro`。 |
| T15 SSE | ✅ | 5 条事件，最后 `evt-005`，告警 `STREAM-721`。 |
| T16 Service Worker | ✅ | 旧值 `blue/cached-2025.11/STALE-CACHE-17`；live 值 `green/live-2026.06/CACHE-BUST-42`。 |
| T17 跨域 iframe | ✅ | iframe 内确认授权，父页显示 `iframe-user@bench.dev / OAUTH-314`。 |
| T18 文件上传 | ✅ | file chooser 真实上传 `upload-token.txt`，页面解析 `36 bytes` / `UPLOAD-448`。 |
| T19 键盘可访问性 | ✅ | Tab 只在 `notify-email` / `close-modal` 循环；`#save-preferences` 缺 `tabindex` 和键盘 handler；鼠标确认码 `A11Y-204`。 |
| T20 Flake Rate | ✅ | 10 次：7/10 通过，失败轮次 3/6/9，`FLAKE-307`，flake rate 30%。 |

合计：`14✅ + 2✅* + 3❌`，共 19 格。

## R01-R09 真实网站外场

| 任务 | 结果 | 结论 |
| --- | --- | --- |
| R01 GitHub 公共仓库代码导航 | ✅ | GitHub `microsoft/playwright` 仓库文件 `docs/src/actionability.md` 可读；`Locator.click` 需要 `Visible` / `Stable` / `Receives Events` / `Enabled`。 |
| R02 GitHub 真实登录态只读通知 | ✅ | 默认 profile 已登录 GitHub；未读总数 `70`；前 5 条仓库为 `ffffhx/garden-lab` x4、`ffffhx/open-token-board` x1。 |
| R03 MDN 文档结构化阅读 | ✅ | MDN Fetch API 页面可读；接口/条目含 `fetch()`、`Headers`、`Request`、`Response`；有兼容性/Baseline 信息。 |
| R04 npm 包页面元数据 | ✅ | `@playwright/test` 页面：version `1.61.0`，license `Apache-2.0`，repo `github.com/microsoft/playwright`；weekly downloads / unpacked size 当前 DOM 未清晰显示。 |
| R05 Chrome Web Store 扩展详情 | ❌ | 连续两次打开 React Developer Tools 详情页时 tab detached，未能稳定读取。 |
| R06 扩展注入真实网站 | N-R | 默认 profile 未加载 Bench Badge，且扩展设置页不可达，无法做 content script 注入验证。 |
| R07 真实网站 Network 响应体 | ✅ | `Network.getResponseBody` 读取 npm document `200 text/html`，响应体含 `@playwright/test` 与版本信息。 |
| R08 真实网站请求拦截 | ✅* | `Network.setBlockedURLs` 本地阻断图片资源，捕获 `Network.loadingFailed blockedReason=inspector`，主文档仍为 Fetch API。不是 route API。 |
| R09 真实网站 HAR / 性能快照 | ✅ | Performance entries 给出最慢 3 个资源和 DCL；可解释首屏相关脚本、字体、CSS 资源。 |

合计：`6✅ + 1✅* + 1❌ + 1 N-R`，共 9 格。

## 结论变化

这轮权限变化显著抬高了 `@chrome` 的上限：它现在能覆盖 Network response body、页面 Runtime fetch、Performance timing、Console/source map、文件上传、iframe、SSE、Service Worker 等任务。

### Bench Badge 手动安装后补测

用户随后把 `apps/browser-tool-bench/extension-sample/` 手动安装进系统默认 Chrome Profile。我用同一个 `@chrome` 通道复测：

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 本地靶场注入 | ✅ | `http://localhost:4399/` 可读到 `#bench-ext-badge = BENCH EXT v1.0.0`。 |
| 真实网站注入 | ✅ | `https://ffffhx.github.io/garden-lab/post/agent/` 可读到 `#bench-ext-badge = BENCH EXT v1.0.0`。 |
| 扩展 options 页 | ❌ | `chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html` 被 Browser Use URL policy 拦截。 |

因此 R06 从“没有扩展所以 N-R”提升为“能验证 content script 注入，但不能按任务要求进入 options 页把徽标改成 `REAL-SITE-2026`”，评分按 ⚠️。T09 reload 和 T11 设置页仍是 ❌。

但边界仍然清楚：

- 不能绑定用户指定的 `9223` profile；这轮是系统默认 profile。
- `chrome://extensions` / `chrome-extension://` 仍不可达，扩展管理和 options 页仍失败；手动装扩展只解决 content script 注入，不解决扩展管理面。
- 没有可靠 route/mock API；`Network.setBlockedURLs` 可以做 URL block，但不能替代 Playwright/agent-browser 那种运行时 route fulfill。
- Chrome Web Store 在本轮 `@chrome` 下连续 detached，不能算稳定可用。

因此如果把目标限定成“系统默认 profile 的只读网页操作 + CDP 观察”，`@chrome` 已经很强；如果目标是“前端调试全能力 + 指定 profile + 扩展管理 + route/mock”，它仍然不是 DevTools MCP / agent-browser 那类工具的替代品。
