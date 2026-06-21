# R01-R09 真实网站外场评测总报告

- 时间：2026-06-19 23:45 - 2026-06-20 00:32（Asia/Shanghai）
- 执行方式：每个工具一个独立 Codex Subagent，顺序执行，不并行抢同一个浏览器
- Subagent 配置：`gpt-5.5` / `xhigh`
- 目标浏览器：用户提供的测试 Chrome profile，CDP 端口 `9223`
- 浏览器版本：Chrome 149，`ws://127.0.0.1:9223/devtools/browser/af505d05-3f16-46e1-ad0d-4d33932285a5`
- 扩展前置：Bench Badge `jkmndkochpgaleoechlemhdhbikdecnf` v1.0.0；为了 R06，`extension-sample/manifest.json` 增加了线上 Garden Lab 匹配规则 `https://ffffhx.github.io/garden-lab/*`

## 判定口径

- `✅`：工具按任务目标完成，并留下页面、Network、trace 或扩展状态证据。
- `⚠️`：核心能力可完成，但证据链或工具原语不完整；或需要主控复核才能确认。
- `❌`：工具可运行，但未完成该任务。
- `N-R`：本轮运行时不可用，或该工具没有暴露对应能力。

外场结果不并入 T01-T20 总分。R01-R09 的动态字段会随网站变化，长期只保留“这轮在这个 profile、这个时间点、这些版本下的证据”。

## 总览

| 工具 | 版本 / 状态 | R01-R09 结果 | 结论 |
| --- | --- | --- | --- |
| Chrome DevTools MCP | 1.3.0 | 9✅ | 本轮最完整：真实 profile、扩展、Network body、Performance trace 都能闭环。R08 是启动级 `blockedUrlPattern`，不是运行时 route。 |
| agent-browser | 0.27.2 | 8✅ + 1⚠️ | 综合很强，能连 9223，Network body、route/abort、HAR 都可用；R06 实际注入成功，但 Subagent 自己观察误判，需要主控复核。 |
| bb-browser | 0.14.2 | 6✅ + 1⚠️ + 1❌ + 1 N-R | 页面阅读与基础 Network 够用；chrome-extension URL 归一化失败、无 route/abort、无完整 HAR 是硬伤。 |
| @browser | Codex in-app browser | 4✅ + 1⚠️ + 4 N-R | 只能测公共网页阅读；不能接 9223，所以真实登录态、扩展、Network body、拦截都不可判为通过。 |
| playwright-cli | 0.1.14 | 9 N-R | 按用户约束不能自启浏览器；attach 到 9223 因扩展 service_worker target 断言崩溃，全套外场未跑。 |
| @chrome | Codex Chrome 插件不可用 | 9 N-R | 本机 selected Chrome profile 里 Codex Chrome Extension 为 disabled，插件工具不可用，且无法证明绑定 9223。 |

## 任务矩阵

| 任务 | @chrome | @browser | agent-browser | bb-browser | DevTools MCP | playwright-cli |
| --- | --- | --- | --- | --- | --- | --- |
| R01 GitHub 公共仓库代码导航 | N-R | ✅ | ✅ | ✅ | ✅ | N-R |
| R02 GitHub 真实登录态只读通知 | N-R | N-R | ✅ | ✅ | ✅ | N-R |
| R03 MDN 文档结构化阅读 | N-R | ✅ | ✅ | ✅ | ✅ | N-R |
| R04 npm 包页面元数据 | N-R | ✅ | ✅ | ✅ | ✅ | N-R |
| R05 Chrome Web Store 扩展详情 | N-R | ✅ | ✅ | ✅ | ✅ | N-R |
| R06 扩展注入真实网站 | N-R | N-R | ⚠️ | ❌ | ✅ | N-R |
| R07 真实网站 Network 响应体 | N-R | N-R | ✅ | ✅ | ✅ | N-R |
| R08 真实网站请求拦截 | N-R | N-R | ✅ | N-R | ✅* | N-R |
| R09 真实网站 HAR 与性能快照 | N-R | ⚠️ | ✅ | ⚠️ | ✅ | N-R |

`✅*`：DevTools MCP 使用 daemon 启动参数 `--blockedUrlPattern` 拦截指定资源，能证明浏览器网络层阻断，但不是 agent-browser / Playwright 那种运行时 route API。

## 关键证据

- R01：三款能接真实 Chrome 的工具都定位到 Playwright `docs/src/actionability.md` 与 `locator.click()` 的 actionability 表；@browser 也能在公共网页完成。
- R02：9223 profile 已登录 GitHub。agent-browser、bb-browser、DevTools MCP 都只读到通知页，未写账号状态；本轮未读数为 `70`。
- R04 / R07：npm `@playwright/test` 本轮页面版本为 `1.61.0`，license `Apache-2.0`，周下载量 `42,613,659`；agent-browser、bb-browser、DevTools MCP 能拿到真实文档响应体。
- R05：Chrome Web Store React Developer Tools 扩展页可读，发布方 Meta，评分 `4.0`，评分数 `1,633`，用户数 `5,000,000`。
- R06：DevTools MCP 写入扩展 options 后，线上 Garden Lab 文章显示 `REAL-SITE-2026 · v1.0.0`。agent-browser 的写入与注入链实际成功，但 Subagent 的可见性观察漏掉 badge，因此记 `⚠️`。
- R08：agent-browser 能用 `network route "**/*.svg" --abort` 拦截 MDN SVG；DevTools MCP 能用 `--blockedUrlPattern` 让指定 SVG 出现网络错误；bb-browser 和 @browser 本轮没有对应能力。
- R09：DevTools MCP trace 给出 LCP `467ms`、CLS `0.00`，并能解释 Bifrost 配置、manifest、字体等资源的首屏影响；agent-browser 导出 HAR；bb-browser 只能给 trace 请求列表；@browser 只能列资源，无 timing。

## 状态污染检查

本轮外场避免修改真实网站状态。唯一允许写入的是本地测试扩展 Bench Badge 的 `chrome.storage.local.badgeText`，用于 R06 验证 content script 在真实线上页面的注入链路。R06 后已回到默认测试状态，不需要关闭 9223 常驻 profile。

## 对选型结论的影响

这轮真实网站外场没有推翻文章里的推荐，反而把“前端开发者首选 Chrome DevTools MCP”的理由补强了：它是唯一在真实网站里同时覆盖真实登录态、Chrome Web Store、扩展 options、content script、Network response body、性能 trace 的工具。

agent-browser 仍然是最值得保留的 CLI 备选，尤其在请求拦截、HAR、可脚本化运行方面更像自动化工具。bb-browser 的方向有价值，但当前版本的特权页和 route/HAR 能力不够。playwright-cli 依旧适合自管浏览器/CI，但在“必须接用户现成 9223 profile”这个外场约束下本轮直接出局。
