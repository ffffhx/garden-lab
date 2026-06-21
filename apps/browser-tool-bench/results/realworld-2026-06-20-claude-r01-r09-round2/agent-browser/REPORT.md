# 真实网站外场基准 R01-R09 · agent-browser · Round 2（精度复跑）

- 工具：**agent-browser 0.27.2**（CLI，Bash 驱动）
- 浏览器：连接已起好的 CDP 9223 Chrome 149，登录态 GitHub 用户 `ffffhx`，已加载 content-script-only 扩展 Bench Badge（id `jkmndkochpgaleoechlemhdhbikdecnf`，无 service worker）
- 连接：先 `agent-browser close --all`（丢自管会话），随后每条命令带 `--cdp 9223`。`open github.com` + `meta[name=user-login]` 读到 `ffffhx`，确认在控 9223。
- 本轮独立判定，未参考第 1 轮或 Codex 结论。观察日期 2026-06-20（CST）。

## 总览
| 任务 | 结果 | escape | 说明 |
| --- | --- | --- | --- |
| R01 GitHub 代码导航 | ✅ | 否 | 站内 code search → blob 页读 actionability 表 |
| R02 GitHub 只读通知 | ✅ | 否 | 真实登录态只读，未点写入控件 |
| R03 MDN Fetch API | ✅ | 否 | 站内搜索进入，标题/接口/兼容性齐全 |
| R04 npm 元数据 | ✅ | 否 | 版本/license/weekly/repo 全到，诚实标注 Unpacked Size 未显示 |
| R05 Chrome Web Store | ✅ | 否 | ID/名称/发布者/评分/用户量/按钮文案齐全 |
| R06 扩展注入 | ✅ | 否 | 经 options UI 改徽标并真实页面验证；已恢复默认 |
| R07 Network 响应体 | ✅ | 否 | Document 响应体内联 JSON 含 name/version，交叉一致 |
| R08 请求拦截 | ✅ | 否 | route **/*.svg --abort，40 个 SVG 被 abort，主文档正常 |
| R09 HAR/性能 | ✅ | 否 | HAR 导出 + Performance API，最慢 3 资源 + 首屏分析 |

无任务用 eval/CDP 逃生完成。R02/R06 的 eval 仅只读 DOM 提取与登录态自检；R06 恢复默认用 `chrome.storage.local.remove('badgeText')`，属 brief 许可写入，不计逃生。

## R01 ✅
站内 code search `repo:microsoft/playwright actionability` → 命中 docs/src/actionability.md。
最终 URL: https://github.com/microsoft/playwright/blob/main/docs/src/actionability.md
文件标题: actionability（"Playwright performs a range of actionability checks…"）。
表格 Locator.click 行: Yes Yes Yes Yes -（Editable 不需要）→ 需通过 **Visible / Stable / Receives Events / Enabled**。
证据 R01-actionability.png。

## R02 ✅
登录态 ffffhx。最终 URL: https://github.com/notifications?query=is%3Aunread（GitHub 自动重定向 is:unread）。观察时间 2026-06-20 01:45 CST。
未读总数 **70**（is:unread 侧栏分组 garden-lab 58 + codex-snapshots 7 + profilepilot 4 + open-token-board 1 = 70，与 Inbox 70 一致；当页 25 条，有下一页）。
前 5 条仓库: ffffhx/garden-lab, ffffhx/garden-lab, ffffhx/garden-lab, ffffhx/garden-lab, ffffhx/open-token-board（均 CI/Actions runs）。
只读：仅 open + 只读 eval；未点 Done/Unsubscribe/Mark as read，未抢焦点，未开新 tab。证据 R02-notifications.png。

## R03 ✅
MDN 首页(重定向 zh-CN) → 搜索 "Fetch API" → 选建议 Web APIs Fetch API。
最终 URL: https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API
主标题 h1: **Fetch API**。
接口区前三: 1) Window.fetch() 和 WorkerGlobalScope.fetch()  2) Window.fetchLater()  3) DeferredRequestInit（后续 FetchLaterResult/Headers/Request/Response）。
兼容性: 有 "浏览器兼容性" 区(BCD 表 api.fetch / api.Window.fetchLater)；**Baseline widget 在本概览页未显示**（如实标注）。证据 R03-mdn-fetch.png。

## R04 ✅
最终 URL: https://www.npmjs.com/package/@playwright/test，观察时间 2026-06-20 01:47 CST。
版本 **1.61.0** | License **Apache-2.0** | Weekly Downloads **42,613,659** | Repository **https://github.com/microsoft/playwright** | Last publish 5 hours ago。
Unpacked Size / Total Files：**当前页面未显示**（现代 npm 侧栏无此字段，innerText 中无该字面）—— 区分"页面未显示"非"工具未找到"。证据 R04-npm.png。

## R05 ✅
最终 URL: https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi（zh-CN）。
扩展 ID **fmkadmapgofadopljbjfkapdkoienihi** | 名称 **React Developer Tools** | 提供方 **Meta** | 评分 **4.0（1,633 个评分）** | 用户量 **5,000,000 用户** | 主按钮 **添加至 Chrome**。
未安装/移除/评分/登录。证据 R05-webstore.png。

## R06 ✅
扩展 ID 发现路径: brief/全局指令给出 jkmndkochpgaleoechlemhdhbikdecnf；直接 open chrome-extension://.../options.html 成功打开 "Bench Badge 设置" 验证 ID。该扩展 content-script-only 无 SW，不在 /json，DOM/资源不暴露其 chrome-extension:// 资源（徽标内联 DOM），故枚举不到 extension target，靠已知 ID 直达。
初始徽标 `BENCH EXT v1.0.0`（R06-before.png）。
改文字: options UI fill textbox "REAL-SITE-2026" → 点保存（R06-options-saved.png），未绕设置页直写 storage。
真实页验证: https://ffffhx.github.io/garden-lab/post/agent/ reload → #bench-ext-badge = **REAL-SITE-2026 · v1.0.0**（R06-after-verified.png）。
恢复: options UI 清空保存 + chrome.storage.local.remove('badgeText')（after={}），reload 确认徽标回 **BENCH EXT v1.0.0**（R06-restored.png）。未触发企业策略。

## R07 ✅
最终 URL: https://www.npmjs.com/package/@playwright/test，观察时间 2026-06-20 01:51 CST。
npm 现代前端 SSR HTML，无独立 JSON 元数据 fetch；元数据内联 Document 响应体。按题目允许用 document 响应体结构化数据并说明来源。
请求: Document GET https://www.npmjs.com/package/@playwright/test | 状态 **200** | content-type **text/html** | 响应体含 "name":"@playwright/test"、"version":"1.61.0"、dist-tags.latest "1.61.0"。
交叉验证: 响应体 version 1.61.0 == 页面版本 1.61.0，一致。证据来自 network request --json 的 responseBody。文件 R07-document-metadata.json。

## R08 ✅
最终 URL: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
拦截方式(网络层): network route "**/*.svg" --abort（另 *.png/*.jpg/*.webp）。
结果: 清日志后 reload 共 114 请求，其中 **40 个 SVG Image 全部无 status/无 responseBody（被 abort）**；对照 CSS/JS/Document 均 200，证明网络层拦截非 CSS 隐藏。
被拦截 URL 示例: https://developer.mozilla.org/static/client/chevron-down.7c923b7054da305b.svg（及 github/firefox 等共 40 个）。
主文档加载成功: title `Fetch API - Web APIs | MDN`，h1 `Fetch API`。证据 R08-mdn-images-blocked.png、R08-network-requests.json。完成后 unroute。

## R09 ✅
最终 URL: https://ffffhx.github.io/garden-lab/post/agent/，观察时间 2026-06-20 01:53 CST。
证据: network har 导出 R09-load.har（31 请求）+ Performance 快照 R09-performance.json。
时间: FP/FCP=228ms, DCL=199ms, loadEvent=391ms。
最慢 3 资源(HAR total):
1) https://8-218-149-148.anyip.dev/token-board/api/auth/me — 54.4ms(wait 53.9), application/json, 第三方 fetch
2) https://ffffhx.github.io/garden-lab/post/agent/ — 9.4ms, text/html, 主文档
3) https://ffffhx.github.io/garden-lab/images/icon-192.png — 4.7ms, image/png
首屏影响: 最慢的 auth/me(55ms) startTime≈328ms 晚于 FCP(228ms)，是登录态异步探测，**不影响首屏**；真正影响首屏的是早期关键资源(主文档 HTML + _next layout/page chunk + CSS，startTime≈62ms 先于 FCP)。结论: 加载很快，"最慢" ≠ "首屏关键"。

## 指标小结
全程在 9223 常驻 profile，未自起浏览器，用完未 close 9223。原语 snapshot -i / click @ref / fill / get / eval(只读) / network requests|request|route --abort|har / screenshot 均可用。`find ... scrollintoview` 子动作不存在（不影响任务）。9 项全 ✅，无 escape，无写真实网站状态，R06 已恢复默认。
