# @chrome · 系统默认 Profile · 无完整 CDP 权限复测

- 运行时间：2026-06-21 00:10-00:22（Asia/Shanghai）
- 工具：Codex `@chrome` / Chrome extension bridge
- Profile：系统默认 Chrome Profile，不使用 9223
- 权限状态：关闭“启用完整 CDP 访问权限”
- 能力探针：Browser capabilities 为空；Tab capabilities 仅 `pageAssets`；`tab.playwright.evaluate(...)` 为 read-only page scope，`fetch` 与 `performance` 均不可用

## 结论

这轮修正了早期“未开权限”列过多 N-R 的问题：当时大量 N-R 是 Codex Chrome Extension / bridge 不可用，不是无完整 CDP 权限本身的能力边界。

无完整 CDP 但 bridge 可用时，`@chrome` 能完成大部分页面级操作：登录、点击、等待、DOM 读取、Shadow DOM、iframe、SSE、GitHub 登录态只读、MDN/npm/GitHub 公共页阅读。真正缺的是 DevTools 面：Network response body、Performance timing/HAR、route/mock、移动 viewport、文件上传、`chrome://` / `chrome-extension://` 特权页、指定 9223 profile 绑定。

## T01-T20（含 T10a/T10b/T10c）

| 任务 | 结果 | 证据摘要 |
| --- | --- | --- |
| T01 登录与观察 | ✅ | 登录后欢迎语含 `BENCH-7341` |
| T02 Network 排障 | ❌ | 只能看到页面笼统错误和 console traceId；无 Network response body，拿不到 `/api/orders` 500 body |
| T03 性能诊断 | ❌ | `performance` 为 `undefined`；`pageAssets` 只有资源清单没有 timing |
| T04 请求 mock | ❌ | 无 route/mock/intercept；页面仍显示真实 18 人列表 |
| T05 动态等待 | ✅ | 12 条动态，最后口令 `LIVE-512` |
| T06 结构化提取 | ✅ | 12 件商品，最贵 `雷霆工作站`，`15999` 元 |
| T07 已登录 fetch | ❌ | read-only evaluate 中 `fetch` 为 `undefined`，不能做页面内 `/api/me` 请求 |
| T08 Shadow DOM | ✅ | 快照可见按钮，role click 后读到 `SHADOW-99` |
| T09 扩展 reload | ❌ | 已打开的 `chrome://extensions/` tab 不能 claim；新开 `chrome://extensions/` 被 URL policy 拦截 |
| T10a 真实登录态（默认 Profile） | ✅ | GitHub notifications 免登录，Inbox `70`，前几条仓库含 `ffffhx/garden-lab` / `ffffhx/open-token-board` |
| T10b 登录态持久化（专用 Profile） | N/A | `@chrome` 只复用系统默认 Profile，不提供自管专用 profile 持久化路线 |
| T10c 指定浏览器登录态（CDP 9223） | N-R | 本轮按系统默认 Profile 跑；`@chrome` 仍不能证明绑定用户指定的 9223 |
| T11 用扩展（设置页改徽标） | ❌ | 靶场可见 `BENCH EXT v1.0.0`，但 `chrome-extension://.../options.html` 被 URL policy 拦截 |
| T12 Console 与 Source Map 定位 | ⚠️ | 可读 console `checkout coupon crash` 与 bundle URL；`.map` 读取被 `ERR_BLOCKED_BY_CLIENT` 拦，无法映射到 `coupon.ts` |
| T13 移动端布局遮挡 | ❌ | 无 viewport/device metrics 控制；实际 `innerWidth=1512`，不能复现 390px 遮挡 |
| T14 SPA 状态 / Hydration 不一致 | ✅ | 读到 `TaskSummary`、`HYD-908`、SSR `8/starter`、client `9/team-pro` |
| T15 SSE 实时流等待 | ✅ | 5 条事件，最后 `evt-005`，告警 `STREAM-721` |
| T16 Service Worker 缓存排障 | ⚠️ | 能证明页面由 SW 控制并显示旧值 `blue/cached-2025.11/STALE-CACHE-17`；直接打开 live 接口被 `ERR_BLOCKED_BY_CLIENT` 拦，缺真实值证据 |
| T17 跨域 iframe 授权 | ✅ | iframe 内确认授权，父页显示 `iframe-user@bench.dev / OAUTH-314` |
| T18 文件上传与拖拽输入 | ❌ | 受限 Playwright API 无 `setInputFiles` / file chooser；`fill` file input 失败 |
| T19 键盘可访问性 | ✅ | Tab 只到 `notify-email` / `close-modal`；`#save-preferences` 缺 `tabindex`，鼠标确认码 `A11Y-204` |
| T20 回归稳定性 / Flake Rate | ✅ | `7/10` 通过，失败轮次 `3,6,9`，`FLAKE-307` |

合计：`10✅ + 2⚠️ + 8❌ + 1 N-R + 1 N/A`。

## R01-R09 真实网站外场

| 任务 | 结果 | 证据摘要 |
| --- | --- | --- |
| R01 GitHub 公共仓库代码导航 | ✅ | `microsoft/playwright/docs/src/actionability.md`；`Locator.click` checks 含 `Visible` / `Stable` / `Receives Events` / `Enabled` |
| R02 GitHub 真实登录态只读通知 | ✅ | GitHub notifications 免登录，Inbox `70`，前 5 条仓库可读 |
| R03 MDN 文档结构化阅读 | ✅ | `Fetch API` 页面可读，含 `Fetch` / `Headers` / `Request` / `Response` 与 Baseline/compatibility 信息 |
| R04 npm 包页面元数据 | ✅ | DOM snapshot 读到 `@playwright/test` version `1.61.0`、license `Apache-2.0`、repo `github.com/microsoft/playwright`、weekly downloads `41,880,590` |
| R05 Chrome Web Store 扩展详情 | ❌ | 页面能打开到 React Developer Tools，但 Chrome Web Store 报 `The extensions gallery cannot be scripted`，连截图也被拦 |
| R06 扩展注入真实网站 | ⚠️ | 线上文章可见 `BENCH EXT v1.0.0`；options 页被 URL policy 拦，不能改 `REAL-SITE-2026` |
| R07 真实网站 Network 响应体 | ❌ | DOM snapshot 可读页面版本，但无 Network request/response body API |
| R08 真实网站请求拦截 | N-R | 无 route/abort/intercept/block API |
| R09 真实网站 HAR 与性能快照 | ❌ | `performance` 为 `undefined`；`pageAssets` 仅给资源清单，无 timing/HAR/trace |

合计：`4✅ + 1⚠️ + 3❌ + 1 N-R`。

## 合并计分

T01-T20 与 R01-R09 共 31 格：`14✅ + 3⚠️ + 11❌ + 2 N-R + 1 N/A`。

这列应理解为“`@chrome` bridge 可用，但未启用完整 CDP 权限”的结果；不要再和早期“Codex Chrome Extension disabled 导致 N-R”的历史结果混在一起。
