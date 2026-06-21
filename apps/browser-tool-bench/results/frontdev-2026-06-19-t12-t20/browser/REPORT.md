# browser / in-app Browser 评测报告（T12-T20）

- 评测时间：2026-06-19
- 工作区：`/Users/bytedance/Code/garden-lab`
- 工具限定：Codex `@browser` / in-app Browser Plugin
- 靶场地址：用户说明服务跑在 `http://localhost:4400/`；任务卡 Prompt 写 `4399`，本次实际使用 `4400`
- 约束遵守：未使用 agent-browser、Playwright CLI、DevTools MCP、bb-browser；未读取 server/source；先只读 Prompt 执行，完成后再读取 Ground Truth/判定标准评分
- 写入范围：仅本报告文件

## 总表

| 任务 | 结果 | native @browser 完成 | 关键证据 | 限制影响 |
| --- | --- | --- | --- | --- |
| T12 Console 与 SourceMap 定位 | ⚠️ | 部分 | 点击后页面显示 `应用失败，请联系管理员（错误码已上报）`；console 捕获 `checkout coupon crash Object`，来源 `http://localhost:4400/assets/debug-bundle.js` | raw JS / sourcemap URL 在 in-app Browser 中被 `ERR_BLOCKED_BY_CLIENT` 拦截，console 对象详情不可展开 |
| T13 移动端布局遮挡 | ⚠️ | 部分 | 390x844 视口下按钮中心 `elementFromPoint(195,785)` 命中 `.mobile-support-bar` 内文案；computed style：`position: fixed; bottom: 0px; height: 118px; z-index: 20`；按钮点击后无确认码 | 能定位遮挡和 CSS 原因，但读 GT 前未通过 native 点击获得 `MOBILE-39` |
| T14 SPA Hydration 不一致 | ✅ | 是 | 页面最终显示 `待办数量：9`、`套餐：team-pro`、`traceId=HYD-908`；内联初始状态给出 `component=TaskSummary`、SSR `{8, starter}`、client `{9, team-pro}`；console 有 `[hydration mismatch] Object` | 无 |
| T15 SSE 实时流等待 | ✅ | 是 | 点击 `开始接收` 后页面显示 `接收完成：5 条事件，关键告警 STREAM-721`；列表最后一条为 `evt-005 · alert · STREAM-721` | 无法直接观察 streaming response，只依赖页面 DOM 完成态 |
| T16 ServiceWorker 缓存排障 | ⚠️ | 部分 | 页面显示旧配置 `blue / cached-2025.11 / STALE-CACHE-17`，状态为 `Service Worker 已控制页面`；页面脚本显示读取 `/api/settings` 且注册 `/sw-cache.js`；直接打开 `/api/settings` 仍返回旧值 | page-scope 禁用 `fetch` / `XMLHttpRequest`，raw `/sw-cache.js` 和 `127.0.0.1` raw API 导航被 `ERR_BLOCKED_BY_CLIENT` 拦截；读 GT 前未拿到 `/api/settings?live=1` 真实值 |
| T17 跨域 iframe 授权 | ✅ | 是 | DOM snapshot 内联 iframe 内容；用 `frameLocator('iframe')` 点击 `确认授权`；父页面显示 `授权完成：iframe-user@bench.dev / OAUTH-314` | 无 |
| T18 文件上传输入 | N-R | 否 | 页面存在标准 `input[type=file]#token-file`；尝试 `fill('/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt')` 失败：`Input of type "file" cannot be filled` | 当前 in-app Browser API 未暴露 `setInputFiles` 或文件选择器/拖拽文件上传能力 |
| T19 键盘可访问性 | ✅ | 是 | 弹窗 snapshot 显示 `textbox "通知邮箱"`、`button "保存偏好"`、`button "关闭"`；DOM 显示保存为 `<div class="fake-button save-preferences" role="button" id="save-preferences">`，无 `tabindex`；focus trap 查询 `[data-trap-focus]`，保存不在集合内；鼠标点击后显示 `保存成功：A11Y-204` | keyboard 事件采集中焦点停在 body，但 DOM/ARIA/CSS 证据足够定位键盘不可达原因 |
| T20 回归稳定性 Flake 率 | ✅ | 是 | 点击 `运行 10 次` 后表格 10 行：PASS 7 次，FAIL 轮次 3/6/9，代码 `FLAKE-307`；结论 flake rate = 30%，不稳定 | 无 |

## 逐题细节

### T12 Console 与 SourceMap 定位：⚠️

实际操作：
- 打开 `http://localhost:4400/debug-console`
- 点击 `应用优惠券`
- 读取页面文案和 console 日志
- 尝试用 in-app Browser 打开 `http://localhost:4400/assets/debug-bundle.js` 和 `.map`

证据：
- 页面失败文案：`应用失败，请联系管理员（错误码已上报）`
- console：`checkout coupon crash Object`
- console URL：`http://localhost:4400/assets/debug-bundle.js`
- sourcemap / bundle raw URL：均被 in-app Browser 报 `net::ERR_BLOCKED_BY_CLIENT`

评分依据：
- Ground Truth 要求原始文件 `webpack://bench/src/cart/coupon.ts`、函数 `applySelectedCoupon`、字段 `cartState.selectedCoupon.couponCode`、guard。
- 本次读 GT 前只定位到 bundle 和 console 异常，未能用 native @browser 读 sourcemap，因此记 ⚠️。

### T13 移动端布局遮挡：⚠️

实际操作：
- 设置 viewport 为 `390x844`
- 打开 `http://localhost:4400/layout-mobile`
- 定位 `提交支付` 按钮中心点并检查 `elementFromPoint`
- 尝试点击按钮

证据：
- 按钮 rect：`top=766, bottom=804, height=38`
- 按钮中心点：`(195,785)`
- 中心点命中元素：`.mobile-support-bar` 内的 `移动端帮助条错误覆盖了支付按钮。`
- `.mobile-support-bar` computed style：`position=fixed; bottom=0px; height=118px; z-index=20; pointer-events=auto`
- 按钮点击后页面未出现确认码

评分依据：
- 能说明遮挡元素和 CSS 原因。
- Ground Truth 还要求报出正常点击确认码 `MOBILE-39`；读 GT 前未通过 native 浏览器路径获得确认码，因此记 ⚠️。

### T14 SPA Hydration 不一致：✅

实际操作：
- 打开 `http://localhost:4400/hydration`
- 等待客户端接管
- 读取 console 和页面内联状态

证据：
- console：`[hydration mismatch] Object`
- 组件：`TaskSummary`
- traceId：`HYD-908`
- SSR 状态：`pendingTasks=8`、`planName=starter`
- Client 状态：`pendingTasks=9`、`planName=team-pro`
- 最终 DOM：`待办数量：9`、`套餐：team-pro`

评分依据：完全匹配 Ground Truth，记 ✅。

### T15 SSE 实时流等待：✅

实际操作：
- 打开 `http://localhost:4400/realtime`
- 点击 `开始接收`
- 等待页面完成态

证据：
- 页面 summary：`接收完成：5 条事件，关键告警 STREAM-721`
- 事件列表：
  - `evt-001 · connected · SSE 通道已建立`
  - `evt-002 · metric · checkout_latency_ms`
  - `evt-003 · metric · cart_items`
  - `evt-004 · notice · 库存同步完成`
  - `evt-005 · alert · STREAM-721`

评分依据：报出 5 条、最后 id `evt-005`、关键告警 `STREAM-721`，记 ✅。

### T16 ServiceWorker 缓存排障：⚠️

实际操作：
- 打开 `http://localhost:4400/cache`
- 等待 Service Worker 控制页面
- 读取页面配置、页面脚本、直接 API 导航结果

证据：
- 页面当前值：`theme=blue`、`release=cached-2025.11`、`featureFlag=STALE-CACHE-17`
- 页面状态：`Service Worker 已控制页面`
- 页面脚本：注册 `/sw-cache.js`，读取 `/api/settings`
- 直接打开 `http://localhost:4400/api/settings` 仍返回 `{"theme":"blue","release":"cached-2025.11","featureFlag":"STALE-CACHE-17"}`

限制：
- in-app Browser 的 `evaluate` 环境中 `fetch` 不是函数，`XMLHttpRequest` 也不是构造器。
- 直接打开 `/sw-cache.js`、raw asset、`127.0.0.1` raw API 被 `ERR_BLOCKED_BY_CLIENT` 拦截。
- 读 GT 前未能拿到 `/api/settings?live=1` 的真实网络值。

评分依据：
- 能证明 SW 控制和旧值，但缺真实值 `green / live-2026.06 / CACHE-BUST-42`，记 ⚠️。
- 修复动作应为更新/注销 Service Worker，或修正 fetch handler 缓存策略并重新激活。

### T17 跨域 Iframe 授权：✅

实际操作：
- 打开 `http://localhost:4400/iframe-auth`
- 使用 `frameLocator('iframe')` 定位并点击 iframe 内 `确认授权`
- 读取父页面结果

证据：
- iframe 内账号：`iframe-user@bench.dev`
- 父页面结果：`授权完成：iframe-user@bench.dev / OAUTH-314`

评分依据：完成 iframe 内点击并从父页面读到账号和授权码，记 ✅。

### T18 文件上传输入：N-R

实际操作：
- 打开 `http://localhost:4400/input-lab`
- 确认页面有 `input[type=file]#token-file`
- 尝试用 locator `fill()` 写入本地 fixture 路径

证据：
- DOM：`input type=file id=token-file`
- 错误：`Input of type "file" cannot be filled`

评分依据：
- 当前 in-app Browser API 文档中没有 `setInputFiles`，也没有可操作系统文件选择器或上传文件的接口。
- 未使用 eval 伪造 File 对象，也未读取本地文件绕过页面上传路径。
- 记为 N-R：`@browser file upload capability unavailable in this context`。

### T19 键盘可访问性：✅

实际操作：
- 打开 `http://localhost:4400/a11y-modal`
- 点击 `打开偏好设置`
- 用键盘 Tab 尝试推进焦点
- 读取弹窗 DOM/ARIA 属性
- 鼠标点击保存确认最终码

证据：
- 弹窗 snapshot：`textbox "通知邮箱"`、`button "保存偏好"`、`button "关闭"`
- 保存控件 DOM：`DIV#save-preferences.fake-button.save-preferences[role=button]`
- 保存控件没有 `tabindex="0"`
- focus trap 只查询 `[data-trap-focus]`；输入框 `#notify-email` 有该属性，保存控件没有
- 鼠标点击后页面显示 `保存成功：A11Y-204`

评分依据：
- 明确指出键盘到不了保存按钮、缺 `tabindex` / 键盘 handler，并报出 `A11Y-204`，记 ✅。

### T20 回归稳定性 Flake 率：✅

实际操作：
- 打开 `http://localhost:4400/flake`
- 点击 `运行 10 次`
- 等待表格出现 10 行后统计

证据：
- 通过：7 次
- 失败：3 次
- 失败轮次：3、6、9
- 稳定性代码：`FLAKE-307`
- flake rate：30%

评分依据：完全匹配 Ground Truth，记 ✅。

## 综合结论

本轮 in-app Browser 对普通 DOM、iframe、SSE 页面完成态、viewport/盒模型、键盘可访问性 DOM 诊断、表格统计表现可用；T14/T15/T17/T19/T20 均可完成。

主要短板集中在三类能力：

- Source map / raw asset：T12 中直接打开 JS 或 `.map` 被 `ERR_BLOCKED_BY_CLIENT` 拦截，console 也不能展开对象详情，导致只能定位到 bundle。
- Service Worker / raw API bypass：T16 能证明 SW 控制和旧值，但受限于 page-scope 无 `fetch`/`XMLHttpRequest`、raw URL 拦截，无法在读 GT 前用浏览器拿到 live bypass 值。
- 文件上传：T18 缺少 `setInputFiles` 或文件选择器自动化能力，标准文件上传任务在当前 @browser 上下文不可运行。

总计：
- ✅ 成功：5 / 9
- ⚠️ 部分：3 / 9
- N-R：1 / 9
- ❌ 失败：0 / 9
