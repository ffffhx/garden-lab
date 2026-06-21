# 真实网站外场基准 R01–R09 · 第2轮（精度复跑）· chrome-devtools-mcp

- 工具：chrome-devtools-mcp（MCP mcp__chrome-devtools-gh__*），绑定 CDP 9223
- 浏览器：已起好的 Chrome 149，常驻测试 profile（已登录 GitHub ffffhx，已装 Bench Badge 扩展）
- 连接确认：list_pages 成功列出 9223 上的已开标签，未自起新浏览器
- 观察时间：2026-06-20 02:13–02:19 (GMT+8)
- 本轮为独立复跑，未参考任何第1轮 / Codex 结论

---

## R01 · GitHub 公共仓库代码导航 — 成功
- 最终 URL：https://github.com/microsoft/playwright/blob/main/docs/src/actionability.md
- 页面标题：playwright/docs/src/actionability.md at main · microsoft/playwright
- Locator.click 的 actionability checks（当次页面表格逐字）：Visible / Stable / Receives Events / Enabled（Editable 为 -，不要求）
- 证据来自浏览器渲染后 DOM 表格（evaluate_script 读取 table.innerText），非模型记忆
- 路径：直接进入官方仓库文档源文件页；未用站内搜索（直达 URL）
- 证据：R01-actionability.png

## R02 · GitHub 真实登录态只读通知 — 成功
- 最终 URL：https://github.com/notifications?query=is%3Aunread （/notifications 自动重定向到未读筛选）
- 登录态证明：meta[name=user-login] = ffffhx
- 未读总数（Inbox 徽标）：70
- 前 5 条通知所属仓库：
  1. ffffhx/garden-lab – CI #387
  2. ffffhx/garden-lab – CI #386
  3. ffffhx/garden-lab – CI #376
  4. ffffhx/garden-lab – CI #375
  5. ffffhx/open-token-board – CI #41
- 观察时间：2026-06-20 02:13:37 (GMT+8)
- 只读：全程仅 navigate + evaluate_script 读取，未点击任何写状态控件；未抢焦点、未开新 tab
- 证据：R02-notifications.png

## R03 · MDN 文档结构化阅读 — 成功
- 最终 URL：https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- 页面主标题（h1）：Fetch API
- Interfaces 区域前三项（当次页面 dl/dt 结构）：
  1. Window.fetch() and WorkerGlobalScope.fetch()
  2. Window.fetchLater()
  3. DeferredRequestInit
  （区域还含 FetchLaterResult / Headers / Request / Response）
- Baseline / compatibility：该概览页未显示 Baseline 徽标组件；但存在 Browser compatibility 章节（h2 标题确认）。如实区分
- 证据：R03-fetch-api.png

## R04 · npm 包页面元数据 — 成功
- 最终 URL：https://www.npmjs.com/package/@playwright/test
- 当前版本：1.61.0
- License：Apache-2.0
- Weekly Downloads：42,613,659
- Repository：github.com/microsoft/playwright（Homepage：playwright.dev）
- Last publish：6 hours ago
- Unpacked Size / Total Files：页面侧栏未显示（npm 该页未给出，未臆造）
- 观察时间：2026-06-20 02:14:33 (GMT+8)
- 字段来自可见页面 DOM（侧栏 h3 标签 + 文本）
- 证据：R04-npm-page.png

## R05 · Chrome Web Store 扩展详情 — 成功
- 最终 URL：https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi
- 扩展 ID：fmkadmapgofadopljbjfkapdkoienihi
- 名称：React Developer Tools
- 发布者：Meta（开发者：Meta Platforms, INC.）
- 评分：4.0（1,633 个评分）；用户量：5,000,000 用户；精选；类别 开发者工具；版本 7.0.1 (10/20/2025)
- 主按钮文案：添加至 Chrome（未点击）
- 未安装 / 未登录 / 未评分 / 未举报
- 证据：R05-webstore.png

## R06 · 扩展注入真实网站 — 成功
- 最终 URL：https://ffffhx.github.io/garden-lab/post/agent/
- 扩展 ID 发现路径：目标页定位注入徽标 #bench-ext-badge（默认 BENCH EXT v1.0.0）；网络请求排查多个 content-script 扩展（bpoad… 实为 Immersive Translate，非本扩展）；最终导航 chrome-extension://jkmndkochpgaleoechlemhdhbikdecnf/options.html 验证页面标题为 Bench Badge 设置，锁定 ID = jkmndkochpgaleoechlemhdhbikdecnf
- 操作：设置页 UI 输入框 fill REAL-SITE-2026，click 保存。验证 chrome.storage.local -> {badgeText: REAL-SITE-2026}
- 回真实文章刷新后徽标完整内容：REAL-SITE-2026 · v1.0.0（DOM 读取 #bench-ext-badge 确认）
- 通过设置页 UI 修改（非直接写 storage），并在真实线上页面验证 -> 成功
- 状态恢复：chrome.storage.local.remove(badgeText) 清键，storage 回到 {}；刷新文章确认徽标恢复默认 BENCH EXT v1.0.0。起点已干净
- 证据：R06-options-saved.png、R06-badge-realsite.png

## R07 · 真实网站 Network 响应体 — 成功
- 最终 URL：https://www.npmjs.com/package/@playwright/test
- 证据来源：浏览器 Network 主文档响应体（reqid=3536，重新加载后捕获）
- 请求 URL：https://www.npmjs.com/package/@playwright/test
- HTTP 状态码：200
- Content-Type：text/html（npm 服务端渲染，元数据 JSON island 内联文档；vary: x-spiferack）
- 响应体 package name / version：name=@playwright/test、version=1.61.0、license=Apache-2.0、dist-tags.latest=1.61.0
- 交叉验证：响应体 version 1.61.0 与页面显示版本 1.61.0 一致
- 说明：本工具可事后读取已捕获请求响应体（get_network_request + responseFilePath）；XHR/fetch 中无独立元数据 JSON，按任务规则使用 document 响应体并注明来源
- 证据：R07-npm-document.network-response

## R08 · 真实网站请求拦截 — 部分（escape，JS 层 initScript 拦截，非工具网络层 route/abort）
- 最终 URL：https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- 工具能力实况：chrome-devtools-mcp 没有 route/abort/intercept 网络层 API。先试 initScript 注入 meta CSP img-src none -> 失败，图片照常 200（注入晚于页面 CSP/请求已发）
- 改用 initScript 在 HTMLImageElement.prototype 的 src setter 与 setAttribute(src) 上拦截，阻止 src 赋值使浏览器从不发出该 GET
- 被拦截请求（3 个广告位图片，均 https://developer.mozilla.org/pimg/... base64 编码 buysellads），例：
  /pimg/aHR0cHM6Ly9zdGF0aWM0LmJ1eXNlbGxhZHMubmV0L3V1LzIvMTc2NDc2LzE3ODAwNzE0MjgtVHJhbnNwYXJlbnRfQmFja2dyb3VuZF9VcGRhdGUub3JpZ2luYWwucG5n...
- 拦截方式：JS 层 initScript（prototype src 拦截，请求真正未发出，强于 CSS 隐藏）
- 验证降级后可读：被拦图片在本次 image 网络列表中确实缺席（对照未拦截 load 少了 3 个 /pimg/）；主文档正常，title=Fetch API - Web APIs | MDN，h1=Fetch API
- 判级理由：请求确被本地阻断、主文档可读，但这是 JS 层而非工具网络层 route/abort。按本轮 R08 规则 -> 部分 + escape=true
- 证据：R08-fetch-images-blocked.png；两次 image 网络列表对照

## R09 · 真实网站 HAR 与性能快照 — 成功
- 最终 URL：https://ffffhx.github.io/garden-lab/post/agent/
- 证据：performance trace（R09-trace.json.json.gz）+ Resource Timing
- Web Vitals（lab）：LCP 180 ms（render delay 165ms 为主），CLS 0.00，TTFB 2ms
- 最慢 3 个资源（Resource Timing duration）：
  1. https://8-218-149-148.anyip.dev/token-board/api/auth/me — fetch，57 ms，startTime 319ms
  2. _next/static/chunks/app/post/[slug]/page-29aefa01488dacdc.js — script，19 ms，startTime 6ms
  3. _next/static/chunks/42-228cfaa1f6e390a1.js / 654-...js — script，各 18 ms，startTime 6ms
- 首屏影响判断（区分最慢与关键）：
  - 最慢 auth/me（57ms）是扩展/content-script 注入的第三方 XHR，startTime 319ms（首绘之后才发），不影响首屏
  - 真正影响首屏的是早期（startTime≈6ms）Next.js JS chunk 与 CSS（render-blocking 邻近），各仅 18–19ms，体量小；LCP 已 180ms 完成，CLS 0 无抖动
  - 结论：本次加载无明显首屏瓶颈；最慢资源非关键资源
- 观察时间：2026-06-20 02:19:22 (GMT+8)
- 证据：R09-trace.json.json.gz、R09-article-loaded.png

---

## 汇总
- 成功 ×8：R01 R02 R03 R04 R05 R06 R07 R09
- 部分 ×1：R08（JS 层 initScript 拦截，非工具网络层 route/abort，escape=true）
- 失败 / N-R：无
- R06 状态已恢复默认 BENCH EXT v1.0.0（storage badgeText 键已清）
- 全程未写真实网站状态；唯一写入为 R06 扩展本地 storage 且已恢复
- escape 任务：仅 R08
