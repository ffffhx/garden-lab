# Chrome DevTools MCP · R01-R09 外场报告

- Subagent：019ee0a3-397f-7682-8517-6d61110cb8d6
- 模型：`gpt-5.5` / `xhigh`
- 工具版本：chrome-devtools-mcp 1.3.0
- 启动：`chrome-devtools start --browserUrl http://127.0.0.1:9223 --no-headless --no-usage-statistics`
- 扩展枚举：Bench Badge `jkmndkochpgaleoechlemhdhbikdecnf` v1.0.0 Enabled

## 结果

| 任务 | 判定 | 证据摘要 |
| --- | --- | --- |
| R01 | ✅ | GitHub 代码导航到 `docs/src/actionability.md`，标题 `Auto-waiting`，`locator.click()` 表完整。 |
| R02 | ✅ | GitHub notifications 未读 `70`，前 5 条仓库为 `ffffhx/garden-lab` x4、`ffffhx/open-token-board` x1。 |
| R03 | ✅ | MDN Fetch API 英文页，读到 `Window.fetch()`、`Window.fetchLater()`、`Headers`、`Request`、`Response` 与兼容性区。 |
| R04 | ✅ | npm `@playwright/test`：版本 `1.61.0`，license Apache-2.0，repo 可见；周下载和 unpacked size 未在当前 DOM 清晰暴露。 |
| R05 | ✅ | Chrome Web Store React Developer Tools：ID `fmkadmapgofadopljbjfkapdkoienihi`，Meta，version `7.0.1`，评分 `4.0 / 1,633`，`5,000,000` users。 |
| R06 | ✅ | options 写入 `REAL-SITE-2026` 后，线上 Garden Lab 文章 DOM 显示 `REAL-SITE-2026 · v1.0.0`。 |
| R07 | ✅ | npm 请求 `GET /package/@playwright/test [200]`，`content-type:text/html`，响应体含 `<title>@playwright/test - npm</title>` 与 `1.61.0`。 |
| R08 | ✅ | 用 daemon `--blockedUrlPattern` 精确阻断一个 MDN SVG，请求出现 `net::ERR_INTERNET_DISCONNECTED`，主文档仍为 `Fetch API` 200。 |
| R09 | ✅ | trace `/tmp/browser-tool-bench-r09-trace.json`，LCP `467ms`，CLS `0.00`；能解释 Bifrost config、manifest、font 对首屏影响。 |

## 结论

DevTools MCP 是本轮唯一 9/9 的工具。它的优势不是“点页面最强”，而是最像真实 DevTools：能进真实 profile，能读扩展和特权页，能保留 Network body，也能输出性能 trace 与 insight。R08 需要注明：它使用的是启动级 URL block，不是运行时 route API。
