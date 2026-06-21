# agent-browser · R01-R09 外场报告

- Subagent：019ee08d-6eb3-7f70-a75e-e37f9ed3dee9
- 模型：`gpt-5.5` / `xhigh`
- 工具版本：agent-browser 0.27.2
- 连接：`agent-browser --cdp 9223 connect 9223` 后，`get cdp-url` 为 `ws://127.0.0.1:9223/devtools/browser/af505d05-3f16-46e1-ad0d-4d33932285a5`
- 约束：任务执行阶段不使用 curl、读源码或网页外脚本旁路；只允许操作 9223 测试 profile

## 结果

| 任务 | 判定 | 证据摘要 |
| --- | --- | --- |
| R01 | ✅ | GitHub / Playwright 文档定位到 `docs/src/actionability.md`，标题 `Auto-waiting`，`locator.click()` 对 Visible / Stable / Receives Events / Enabled 为 Yes。 |
| R02 | ✅ | GitHub notifications 未读 `70`，页面范围 `1-25 of 70`，前 5 条仓库为 `ffffhx/garden-lab` x4、`ffffhx/open-token-board` x1。 |
| R03 | ✅ | MDN zh-CN Fetch API，读到 `Window.fetch()` / `WorkerGlobalScope.fetch()`、`Window.fetchLater()`、`DeferredRequestInit` 与兼容性表。 |
| R04 | ✅ | npm `@playwright/test`：版本 `1.61.0`，license `Apache-2.0`，周下载 `42,613,659`，仓库 `github.com/microsoft/playwright`。 |
| R05 | ✅ | Chrome Web Store React Developer Tools：Meta，评分 `4.0`，`1,633` ratings，`5,000,000` users，按钮 `添加至 Chrome`。 |
| R06 | ⚠️ | options 写入 `REAL-SITE-2026` 后，Subagent 未观察到线上文章 badge；主控用 DevTools 复核同页 DOM 为 `REAL-SITE-2026 · v1.0.0`，说明功能链成功但观察漏判。 |
| R07 | ✅ | npm 文档请求 `GET https://www.npmjs.com/package/@playwright/test`，`200 text/html`，响应体含标题与 `1.61.0`。 |
| R08 | ✅ | `network route "**/*.svg" --abort` 成功，MDN 页面仍可读，拦截到 `trash-2.73b28bc66fb8543c.svg`；随后 `network unroute` 清理。 |
| R09 | ✅ | HAR 导出 `/tmp/browser-tool-bench-r09-agent-browser.har`，30 个请求；最慢主文档 `1251.84ms`，wait `901.61ms`，能解释首屏影响。 |

## 结论

agent-browser 是本轮最强 CLI。它能按用户要求稳定连接 9223，覆盖真实登录态、扩展页面、Network body、route/abort 和 HAR。主要短板不是能力，而是观察稳定性：R06 的 badge 已经存在，但 Subagent 的可见性判断漏掉了页面右下角注入元素。
