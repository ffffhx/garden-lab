# 真实网站外场基准 R01–R09 · bb-browser 0.14.2 · Round 2（独立精度复跑）

- 工具：bb-browser 0.14.2（全局命令 bb-browser，Bash 驱动）
- 浏览器：连接到已起好的 CDP 9223（Chrome 149.0.7827.116，已登录 GitHub，已装 content-script-only 扩展 Bench Badge）
- 连接方式：bb-browser <cmd> --port 9223。status 显示 CDP connected: yes，daemon attach 成功，未自起新浏览器。
- 观察日期：2026-06-20。本轮独立判定，未参考第 1 轮或 Codex 结论。

## 连接与原语摸底
- attach：--port 9223 连到现有 CDP（daemon 模式），/json/version=Chrome/149。
- 页面读取：get url/title、eval（主世界，无 chrome.*）、snap -i、screenshot。
- network：network requests（有 URL/类型/状态，无 timing）。
- trace：trace start/stop/events/body；request/response 事件带 epoch-ms ts + requestId，可算耗时；trace body 取响应体（完整 Document body 落盘）。
- route/abort/intercept/block/mock：不存在（未知子命令只回显通用 help）。无网络层拦截。
- chrome-extension:// 归一化缺陷复现：open/goto/eval(location) 对非 http(s) 一律加 https:// 前缀 → chrome-error://chromewebdata/。设置页不可达。
- 无原生 HAR 导出；以 trace JSON + network 列表 + 计算 timing 作等价证据。

## R01 GitHub Playwright actionability — ✅
- URL: https://github.com/microsoft/playwright/blob/main/docs/src/actionability.md
- 标题: playwright/docs/src/actionability.md at main · microsoft/playwright
- Locator.click 需要: Visible / Stable / Receives Events / Enabled（Editable 为 -，不需要）。
- 直接导航到官方文档路径，答案来自 GitHub 页面表格。证据 R01-actionability.png。

## R02 GitHub 登录态只读通知 — ✅
- 时间 2026-06-20 01:59:01 CST，URL https://github.com/notifications?query=is%3Aunread
- 已登录（未跳登录页，"Select all 70 notifications"）。Unread 总数 70。
- 前 5 仓库: ffffhx/garden-lab(#387)、ffffhx/garden-lab(#386)、ffffhx/garden-lab(#376)、ffffhx/garden-lab(#375)、ffffhx/open-token-board(#41)。
- 纯只读（eval 读 DOM，未点任何写状态控件）。证据 R02-notifications.png。

## R03 MDN Fetch API — ✅
- 经站内搜索 search?q=Fetch+API 进入；URL https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API，h1=Fetch API。
- Interfaces 章节前三项: Window.fetch() and WorkerGlobalScope.fetch() / Window.fetchLater() / DeferredRequestInit（后续含 Headers/Request/Response）。
- 有 Browser compatibility 章节；本聚合页顶部无单独 Baseline widget（如实记）。证据 R03-fetch-api.png。

## R04 npm @playwright/test 元数据 — ✅
- 时间 2026-06-20 02:01:38 CST，URL https://www.npmjs.com/package/@playwright/test
- 版本 1.61.0；License Apache-2.0；Weekly Downloads 42,613,659；Repository github.com/microsoft/playwright。
- Unpacked Size / Total Files：页面侧栏未显示（如实记"未显示"非"未找到"）。证据 R04-npm-page.png。

## R05 Chrome Web Store React DevTools — ✅
- 时间 2026-06-20 02:02:13 CST，URL .../detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi
- ID fmkadmapgofadopljbjfkapdkoienihi；名称 React Developer Tools；评分 4.0(1,633)；用户 5,000,000；按钮"添加至 Chrome"。
- 发布者：此版式标题区无明确品牌名文本；支持网站链接指向 github.com/facebook/react(React/Meta)。未点安装/登录。证据 R05-webstore.png。

## R06 扩展注入真实网站 — ❌（工具能力卡点）
- 目标页徽标确认: #bench-ext-badge = BENCH EXT v1.0.0（默认）。
- 扩展 ID 发现: ①brief 给 jkmndkochpgaleoechlemhdhbikdecnf ②本地 manifest 确认 MV3 content-only 无 SW 故不在 /json ③chrome-error 页正文显示 "jkmndkochpgaleoechlemhdhbikdecnf 已被屏蔽"，三方交叉确认。
- 卡点: open/goto/eval(location) 对 chrome-extension:// 强加 https:// 前缀 → chrome-error://chromewebdata/，无法到达 options.html 设置页。
- 备选不可行: eval 在页面主世界，目标页 chrome 判 no-storage，无法从页面写 chrome.storage.local；工具不暴露 raw CDP/extension target。
- 判 ❌（无法到达 chrome-extension:// 设置页）。
- 状态恢复: 全程未写任何 storage，徽标始终默认 BENCH EXT v1.0.0（reload 再确认），无需恢复。证据 R06-badge-default.png、R06-options-blocked.png。
- 注: /json 中 bpoadfkcbjbfhfodiogcnhhhpibjhbnh 是另一无关扩展。

## R07 npm Network 响应体 — ✅
- 时间 2026-06-20 02:06:27 CST，URL https://www.npmjs.com/package/@playwright/test
- trace 定位主文档: requestId 66BFED221691E20F40DAC738F76F1613，状态 200，Document(text/html)。
- trace body 取响应体(R07-document-body.html, 789KB)：含 "name":"@playwright/test"、"license":"Apache-2.0"、"distTags".latest=1.61.0、"version":"1.61.0"。与页面版本 1.61.0 一致。
- 加分: .../v/1.61.0/provenance（Fetch,200,application/json）亦指向 v1.61.0。证据来源严格为 Network 响应体。

## R08 真实网站请求拦截 — N-R
- bb-browser 0.14.2 无 route/abort/intercept/block/mock 原语，不暴露 CDP Fetch.failRequest。仅能 CSS 隐藏（rubric 明确不算）。无法表达网络层拦截 → N-R。
- 目标页加载确认: Fetch API - Web APIs | MDN。证据 R08-mdn-fetch.png。

## R09 HAR 与性能快照 — ✅
- 时间 2026-06-20 02:08:20 CST，URL https://ffffhx.github.io/garden-lab/post/agent/
- trace 录制 55 events(27 req+27 resp+1 action)，trace events --json 落盘；按 response.ts-request.ts 算耗时(ms，整次 span≈406ms)。无原生 HAR，用 trace JSON+network+timing 作等价证据。
- 最慢 3: ①.../chunks/app/post/[slug]/page-29aefa01488dacdc.js ~133ms Script ②.../chunks/app/layout-5ce7bee09b11075e.js ~132ms Script ③.../post/agent/ 主文档 ~91ms Document。
- 首屏判断: 两个 Next.js JS chunk render-blocking 影响首屏 hydration；主文档关键路径；对比 anyip.dev/token-board/api/auth/me(Fetch~55ms)是 hydration 后异步 API 不阻塞首屏 —— 体现"最慢资源≠首屏关键资源"。证据 R09-trace-events.json、R09-network-requests.txt、R09-garden-lab.png。

## 汇总
| 任务 | 等级 | escape |
| --- | --- | --- |
| R01 | ✅ | 否 |
| R02 | ✅ | 否 |
| R03 | ✅ | 否 |
| R04 | ✅ | 否 |
| R05 | ✅ | 否 |
| R06 | ❌ | 否 |
| R07 | ✅ | 否 |
| R08 | N-R | 否 |
| R09 | ✅ | 否 |

两处确诊短板：①无网络拦截原语(R08 N-R)；②chrome-extension:// URL 被强加 https 前缀致设置页不可达 + eval 仅主世界无 chrome.*(R06 ❌)。其余 7 项稳定通过，无逃生手段。R06 状态已恢复默认 BENCH EXT v1.0.0。
