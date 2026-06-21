# 真实网站外场基准 R01-R09 · bb-browser 0.14.2 报告

- 工具：bb-browser 0.14.2（CLI，daemon = bb-browser-daemon）
- 浏览器：attach 到已起好的 CDP 9223 Chrome 149（Chrome/149.0.7827.116），已登录 GitHub（ffffhx），已加载本地 Bench Badge 扩展。未自起任何浏览器。
- 连接：bb-browser daemon stop -> bb-browser --port 9223 daemon start；9223 /json/version = Chrome 149，9222 不可达 -> 确认控的就是 9223。
- 日期：2026-06-20

## 原语摸底
- attach 现有 CDP：有（--port 9223）
- 页面读取：有（snap -i / eval / get url|title；get text 需 ref，eval 读 DOM 最稳）
- 点击：click @ref 不稳定，常报 Unknown ref / Unknown ref xpath（R03 多次失败）
- Network 列表：network requests [--json] 有 status/mime/headers，无 duration 字段
- trace：trace start/events/body/stop，request/response 事件带 ts，可算 duration
- 响应体：trace body <requestId> 可读 JSON/HTML body
- route/abort/intercept/mock：完全没有
- HAR 导出：无
- chrome-extension:// 页：URL 归一化 bug，open/goto 把 chrome-extension:// 改写成 https://chrome-extension//... -> DNS 失败，无法到达 options 页

## 逐任务
### R01 GitHub 代码导航 — 成功
标题 playwright/docs/src/actionability.md at main · microsoft/playwright；Locator.click checks: Visible=Yes Stable=Yes Receives Events=Yes Enabled=Yes Editable=-。URL .../blob/main/docs/src/actionability.md。证据 R01-actionability.png。

### R02 GitHub 登录态只读通知 — 成功（只读）
观察 2026-06-20 01:07:46 CST；Inbox 未读 70，首页 25 条；前5仓库 ffffhx/garden-lab x4(CI#387/386/376/375)、ffffhx/open-token-board(CI#41)。仅 eval 读 DOM，未点任何按钮。证据 R02-notifications.png。

### R03 MDN Fetch API — 成功
MDN 站内搜索命中后（click @ref 失败改直接导航）到 .../Web/API/Fetch_API。主标题 Fetch API；Interfaces 前三（当次顺序）Window.fetch()/WorkerGlobalScope.fetch()、Window.fetchLater()、DeferredRequestInit；顶部无 Baseline 指示器但有 Browser compatibility 区块。证据 R03-fetch-api.png。

### R04 npm 元数据 — 成功
观察 01:10:48 CST。Version 1.61.0；License Apache-2.0；Weekly Downloads 42,613,659；Repository github.com/microsoft/playwright；Unpacked Size/Total Files 该页未显示。证据 R04-npm.png。

### R05 Chrome Web Store — 成功（未安装）
ID fmkadmapgofadopljbjfkapdkoienihi；名称 React Developer Tools；发布者 Meta；评分 4.0(1,633 评分)；5,000,000 用户；主按钮"添加至 Chrome"。证据 R05-webstore.png。

### R06 扩展注入 — 部分（escape，绕过设置页直接写 storage）
扩展ID发现：Bench Badge 无 background SW，故不在 /json/list SW target；CDP attach garden-lab 页，枚举 content-script 隔离世界 origin 逐个 chrome.runtime.getManifest().name -> Bench Badge = jkmndkochpgaleoechlemhdhbikdecnf(v1.0.0)。
卡点：open/goto 把 chrome-extension://.../options.html 改写成 https://chrome-extension//... DNS失败，无法到达设置页UI。
逃生：content-script 隔离世界 chrome.storage.local.set badgeText=REAL-SITE-2026 -> reload 真实页验证 REAL-SITE-2026 · v1.0.0（R06-badge-real-site.png）。
恢复：chrome.storage.local.remove('badgeText')，reload 后回到 BENCH EXT v1.0.0（R06-badge-restored.png）。已恢复默认。

### R07 npm 响应体 — 成功
trace start -> reload -> trace body。文档 .../package/@playwright/test status 200 text/html，内嵌 "name":"@playwright/test","license":"Apache-2.0","version":"1.61.0"；provenance .../v/1.61.0/provenance status 200 application/json，ref tags/v1.61.0。与页面版本 1.61.0 一致。证据 R07-document-embedded-meta.txt / R07-provenance-body.json / R07-network-requests.json。

### R08 请求拦截 — N-R（工具原生无；escape 仅演示）
bb-browser CLI 完全无 route/abort/intercept/block/mock -> N-R。CDP 逃生演示：Fetch.enable{Image}+failRequest BlockedByClient abort 3 个 SVG，主文档仍加载，标题 Fetch API - Web APIs | MDN。证据 R08-interception-note.txt。

### R09 HAR/性能 — 成功
观察 01:20:53 CST。无 HAR，但 trace request/response 带 ts，按 response_ts-request_ts 算耗时(27配对)。最慢3(均 Next.js JS chunk)：page-29aefa01.js 317ms(首屏关键)、layout-5ce7bee0.js 301ms(首屏关键)、483-365ef981.js 243ms。文档本身仅92ms；Next.js 需执行JS后渲染，故 Script chunk 影响首屏。证据 R09-timing-analysis.txt / R09-network-requests.json / R09-page.png。

## R06 恢复确认
已恢复：chrome.storage.local 清空 badgeText（现 {}），真实页徽标回到默认 BENCH EXT v1.0.0。

## 总结
读取/快照/eval/Network列表/trace响应体/trace计时够用，R01-R05/R07/R09全绿。硬伤：(1)无任何请求拦截原语(R08 N-R)；(2)chrome-extension:// URL 被改写成 https 致 options 设置页不可达(R06 只能 CDP 逃生写 storage，降 部分)。另 click @ref 解析不稳定(R03 靠直接导航绕过)。
