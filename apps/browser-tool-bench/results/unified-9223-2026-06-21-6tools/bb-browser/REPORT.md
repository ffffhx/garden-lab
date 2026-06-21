# bb-browser CLI 统一成本评测报告

- 工具：`bb-browser` CLI `0.14.2`
- 模式：连接用户常驻 Chrome CDP `127.0.0.1:9223`
- 评测窗口：2026-06-21 02:17-02:38 CST 左右
- 结果目录：`apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools/bb-browser/`
- tokens / cost：不可见，记为 `unavailable`

## CDP 9223 证明

- 初始 `bb-browser --port 9223 status --json` 能列出 9223 tabs，但 daemon 一度显示 `cdpConnected:false`，`open` 报 `Daemon did not start in time`。
- 只清理了 stale `bb-browser` daemon 进程，没有关闭 Chrome；随后 `bb-browser daemon start --port 9223 --json` 返回 `cdpConnected:true`、`cdpPort:9223`。
- 证明 URL：`http://localhost:4399/?bb_proof=bb-browser-20260621021542`。
- `bb-browser open ... --port 9223` 得到 tab `af54`，target `D0E1882FDE3951B2094E1E0B4ED8AF54`。
- `http://127.0.0.1:9223/json/list` 中出现同一 URL 与 websocket `ws://127.0.0.1:9223/devtools/page/D0E1882FDE3951B2094E1E0B4ED8AF54`。

## 总览

- 本地任务：13 ✅ / 1 ⚠️ / 6 ❌ / 2 N/A。
- 真实网站：7 ✅ / 1 ❌ / 1 N-R。
- 总计：20 ✅ / 1 ⚠️ / 7 ❌ / 2 N/A / 1 N-R。
- 主要逃生舱：`eval_read` 49 次、`eval_action` 18 次、`cdp_escape` 0、`init_script` 0。
- 计数说明：`bb-browser` 不暴露 token/cost/命令计数；`tool_calls=221`、`browserOps=184` 为按执行记录保守手工估算，不能用 daemon `seq` 代替。

## 关键限制

- 多数 `click` 返回成功但没有触发页面 handler，登录、提交订单、加载更多、shadow 按钮、SSE、flake 等都需要 `eval_action` 才触发。
- `fill` / `type` 对登录输入会重复写入；对 file input 只返回 value，不会设置真实 `FileList`。
- 没有 `route` / `mock` / `intercept`，无法完成网络 mock 或真实网站资源 abort。
- 没有 viewport/emulation 命令，不能验证移动端 390x844。
- `chrome://extensions` 被改写为 `https://chrome//extensions`，`chrome-extension://.../options.html` 被改写为 `https://chrome-extension//...`，扩展 reload/options UI 不可达。
- 跨域 iframe target 出现在 9223 `/json/list`，但 `bb-browser tab list` 不暴露 iframe target，也无 frame/坐标点击能力。

## 本地任务结果

| Task | Verdict | 结论 |
| --- | --- | --- |
| T01 登录与页面观察 | ⚠️ | 正常 fill/click 失败且输入重复；用 `eval_action` 设置表单并 `requestSubmit()` 后进入 dashboard，工号 `BENCH-7341`。 |
| T02 Network 排障 | ✅ | 普通 click 不触发；`eval_action` 后 `/api/orders` 500，body 为 `INSUFFICIENT_INVENTORY`、`SKU-8821 库存不足，剩余 0 件`、`traceId=tr-81e76855e5c8`。 |
| T03 性能诊断 | ✅ | `/slow`：`blocking.css` 约 1216ms 且阻塞渲染；`heavy.js` 同步执行 `crunchAnalytics()`；`hero.svg` 约 1514ms 但为图片资源。 |
| T04 请求 mock | ❌ | `route/intercept/mock` 均无子命令；无法把 `/api/users` mock 为空。页面仍显示 18 个成员；截图 `T04-no-mock-users.png`。 |
| T05 动态渲染 | ✅ | 普通 click 不触发；`eval_action` 后加载 12 条，末条 `系统公告：今日口令 LIVE-512`。 |
| T06 商品目录 | ✅ | 普通 click 不触发；`eval_action` 后请求 `/api/products?page=2`，共 12 个商品，按价格降序首尾为 `雷霆工作站` / `智能护眼台灯`。 |
| T07 已登录 fetch | ✅ | 页面 runtime fetch `/api/me` 返回 `Agent 测试员`、badge `BENCH-7341`、plan `team-pro-2026`。 |
| T08 Shadow DOM | ✅ | snapshot 可见 open shadow；普通 click 不触发；`eval_action` shadow button 后得到兑换码 `SHADOW-99`。 |
| T09 扩展 reload | ❌ | 临时改 manifest `1.0.1` 后无法进入 `chrome://extensions` reload；页面刷新后徽标仍 `BENCH EXT v1.0.0`。已恢复 manifest `1.0.0`。 |
| T10a 默认 profile | N/A | 本轮被要求严格使用 9223，不允许回退默认 profile。 |
| T10b 专用 profile 持久化 | N/A | 本轮被要求严格使用 9223，不允许使用 bb-browser 自管 profile。 |
| T10c 9223 GitHub 登录态 | ✅ | 2026-06-21 02:26:42 CST，只读打开 notifications；unread `70`，前 5 条仓库：`ffffhx/garden-lab` x4、`ffffhx/open-token-board` x1。 |
| T11 使用扩展 | ❌ | `chrome-extension://.../options.html` 被改写成 `https://chrome-extension//...`，`ERR_NAME_NOT_RESOLVED`；未写 storage。 |
| T12 Console/SourceMap | ✅ | 普通 click 不触发；`eval_action` 后 console `checkout coupon crash`，source map 指向 `src/cart/coupon.ts:12`，缺少 `selectedCoupon` 空值 guard。 |
| T13 Mobile layout | ❌ | 无 viewport/emulation；实际视口 `1280x749`，`.mobile-support-bar` 在桌面下 `display:none`，无法验证 390x844 覆盖问题。 |
| T14 Hydration | ✅ | console 报 `[hydration mismatch]`；组件 `TaskSummary`，traceId `HYD-908`，SSR `{pendingTasks:8, planName:"starter"}`，client `{pendingTasks:9, planName:"team-pro"}`。 |
| T15 SSE | ✅ | 普通 click 不触发；`eval_action` 后 EventSource `/api/realtime-events` 收到 5 条，最后 `evt-005 · alert · STREAM-721`。 |
| T16 SW cache | ✅ | 页面受 `sw-cache.js` 控制，显示旧值 `blue / cached-2025.11 / STALE-CACHE-17`；页面 fetch live 得到 `green / live-2026.06 / CACHE-BUST-42`。 |
| T17 iframe | ❌ | `/json/list` 可见 `iframe-child.html` target，但 `bb-browser` 不能作为 tab 操作，父页跨 origin 不可访问，无法点击 iframe 内授权。 |
| T18 文件上传 | ❌ | `fill`/`type` 返回 path value，但 `input.files` 为空，页面仍 `等待文件...`；未用 eval 伪造 File。 |
| T19 a11y modal | ✅ | 键盘 Tab 不移动焦点；保存控件为 `DIV#save-preferences role=button tabIndex=-1`。`eval_action` click 后得到 `A11Y-204`。 |
| T20 flake | ✅ | 普通 click 不触发；`eval_action` 后 10 次结果为 7/10，通过，失败轮次 `3,6,9`，代码 `FLAKE-307`，flake rate 30%。 |

## 真实网站任务结果

| Task | Verdict | 结论 |
| --- | --- | --- |
| R01 GitHub/Playwright actionability | ✅ | 从 GitHub 仓库开始，最终 URL `https://playwright.dev/docs/actionability`；页面标题 `Auto-waiting`；`locator.click()` checks 为 `Visible`、`Stable`、`Receives Events`、`Enabled`，`Editable` 为 `-`。 |
| R02 GitHub notifications | ✅ | 2026-06-21 02:34:54 CST，最终 URL `https://github.com/notifications?query=is%3Aunread&r02=bb-browser-202606210236`；unread `70`；前 5 条仓库：`ffffhx/garden-lab`、`ffffhx/garden-lab`、`ffffhx/garden-lab`、`ffffhx/garden-lab`、`ffffhx/open-token-board`。 |
| R03 MDN Fetch API | ✅ | 从 MDN search 进入 `https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API`；主标题 `Fetch API`；Interfaces 区域当前前三个可见条目为 `Window.fetch() and WorkerGlobalScope.fetch()`、`Window.fetchLater()`、`DeferredRequestInit`，前三个纯接口名为 `DeferredRequestInit`、`FetchLaterResult`、`Headers`；页面显示 Browser compatibility 区域。 |
| R04 npm 页面元数据 | ✅ | 2026-06-21 02:35:45 CST；最终 URL `https://www.npmjs.com/package/@playwright/test`；version `1.61.0`、license `Apache-2.0`、weekly downloads `41,880,590`、repository `github.com/microsoft/playwright`；页面未显示 unpacked size。 |
| R05 Chrome Web Store | ✅ | URL 为 React Developer Tools 详情页；ID `fmkadmapgofadopljbjfkapdkoienihi`，名称 `React Developer Tools`，提供方 `Meta`，显示 `4.0` / `1,633 个评分` / `5,000,000 用户`，主按钮 `添加至 Chrome` 且 disabled。未点击安装。 |
| R06 扩展注入真实网站 | ❌ | 真实文章页徽标注入成功：`BENCH EXT v1.0.0`，content script ID `ngbeieahpajgaoakojeamhkacekiicfk`；但 options 页被改写为 `https://chrome-extension//...` 并 `ERR_NAME_NOT_RESOLVED`，无法通过 UI 改成 `REAL-SITE-2026`。 |
| R07 npm Network 响应体 | ✅ | 重新加载 npm 页面；document 请求 `https://www.npmjs.com/package/@playwright/test?r07=bb-browser-202606210240`，status `200`，content-type `text/html`；response body meta description 包含 package `@playwright/test` 与 latest version `1.61.0`，与页面显示一致。另有 `/package/@playwright/test/v/1.61.0/provenance` JSON 请求。 |
| R08 真实网站请求拦截 | N-R | `bb-browser` 无 `route` / `abort` / `intercept` 命令，无法表达网络层图片 abort；MDN 主文档可正常加载，未用 CSS/JS 假拦截。 |
| R09 HAR/性能快照 | ✅ | 2026-06-21 02:38:13 CST，最终 URL `https://ffffhx.github.io/garden-lab/post/agent/?r09=bb-browser-202606210243`；navigation load 约 672ms。最慢资源：`https://8-218-149-148.anyip.dev/token-board/api/auth/me` fetch 61ms、`.../chunks/app/post/[slug]/page-29aefa01488dacdc.js` script 53ms、`.../chunks/42-228cfaa1f6e390a1.js` script 25ms（同档还有 `654`/`layout` chunk 25ms）。首屏主要受 document 与 Next chunks 影响；token-board fetch 是异步鉴权请求，不是首屏关键资源。 |

## 结束状态

- 扩展页面状态复核：线上文章页 `#bench-ext-badge` 为 `BENCH EXT v1.0.0`。
- `apps/browser-tool-bench/extension-sample/manifest.json` 版本为 `1.0.0`。
- 本轮没有回滚其他文件；只写入 `bb-browser/` 结果目录。
