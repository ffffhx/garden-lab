# playwright-cli 0.1.14 评测报告（T12-T20）

- 工具：`playwright-cli 0.1.14`
- 靶场：`http://localhost:4400/`
- 范围：只评测新增任务 T12-T20
- 执行方式：先只读取任务卡 Prompt，逐题实际操作页面；完成后再读取 Ground Truth / 判定标准评分
- 约束：未读取 server/source；未修改源码、任务卡或其他工具报告

## 总表

| 任务 | 结果 | 关键答案 | native tool 原语完成 | eval / 脚本逃生舱 | 主要命令/轮数粗略统计 | 卡点 |
| --- | --- | --- | --- | --- | --- | --- |
| T12 Console 与 SourceMap 定位 | ✅ | `webpack://bench/src/cart/coupon.ts`；`applySelectedCoupon`；`selectedCoupon.couponCode`，`selectedCoupon=null`；加空值 guard | 是：`open` / `click` / `console` / `requests` / `response-body` | 否 | 约 6 条命令 | Console 对象摘要截断，需打开 source map URL 补证据 |
| T13 移动端布局遮挡 | ✅ | `.mobile-support-bar[data-bug="overlaps-pay-button"]` 覆盖按钮；确认码 `MOBILE-39` | 部分：遮挡诊断由原生 `click` 失败日志完成 | 是：为获取确认码，用 `run-code` 临时关闭遮挡元素 pointer events 后点击 | 约 7 条命令 | 中心点击被客服条持续拦截 |
| T14 SPA Hydration 不一致 | ✅ | `TaskSummary`；`HYD-908`；SSR `pendingTasks=8` / `planName=starter`，Client `pendingTasks=9` / `planName=team-pro` | 是：`snapshot` / `console` / `requests` / `response-body` | 否 | 约 5 条命令 | Console 折叠对象，需读取浏览器响应体里的状态对象 |
| T15 SSE 实时流等待 | ✅ | 5 条；最后 `evt-005`；告警 `STREAM-721` | 是：`click` 后等待并读页面最终 DOM | 否 | 约 4 条命令 | `requests` 未展开 EventSource 流细节，主要依赖页面完成态 |
| T16 Service Worker 缓存排障 | ✅ | 页面旧值 `blue` / `cached-2025.11` / `STALE-CACHE-17`；实时值 `green` / `live-2026.06` / `CACHE-BUST-42`；修复 SW 缓存策略或 unregister/update | 是：独立 session、`snapshot`、`response-body`、直接打开 `/api/settings?live=1` | 否 | 约 7 条命令 | `delete-data` 在无持久数据时关闭了 session，需重开；补了 `?live=1` 明确绕过证据 |
| T17 跨域 Iframe 授权 | ✅ | `iframe-user@bench.dev` / `OAUTH-314` | 是：快照内联 iframe，直接 `click` iframe 内 ref | 否 | 约 3 条命令 | 无明显卡点 |
| T18 文件上传输入 | ✅ | `upload-token.txt`；`36 bytes`；`UPLOAD-448` | 是：`click` 文件按钮后 `upload` fixture | 否 | 约 4 条命令 | 直接 `upload` 失败，需先点击触发 file chooser |
| T19 键盘可访问性 | ✅ | 键盘到不了保存；`#save-preferences` 是 `div role=button`，缺 `tabindex="0"` 和 Enter/Space handler；确认码 `A11Y-204` | 是：`press Tab` / `press Enter` 验证键盘路径，鼠标 `click` 获取确认码 | 否 | 约 8 条命令 | 初始 DOM 中 backdrop/dialog 已存在且 hidden backdrop 拦截打开按钮；Tab 只在输入框和关闭按钮间循环 |
| T20 回归稳定性 Flake 率 | ✅ | 通过 7/10；失败 3/10；失败轮次 3,6,9；`FLAKE-307`；flake rate 30%，不稳定 | 是：点击后等待完整 10 行表格 | 否 | 约 3 条命令 | 无明显卡点 |

## 逐题细节

### T12 Console 与 SourceMap 定位

- 操作证据：
  - 打开 `/debug-console`，点击“应用优惠券”。
  - `console` 显示 `checkout coupon crash`，含 `originalSource: src/cart/coupon.ts:12`、`functionName: applySelectedCoupon`，异常为 `Cannot read properties of null (reading 'couponCode')`。
  - 打开 `/assets/debug-bundle.js.map` 后，source map `sources` 包含 `webpack://bench/src/cart/coupon.ts`，`sourcesContent` 中的 guard 提示为 `if (!cartState.selectedCoupon) return null;`。
- 结论：真实前端异常来自 `webpack://bench/src/cart/coupon.ts` 的 `applySelectedCoupon`，读取 `cartState.selectedCoupon.couponCode` 时 `selectedCoupon` 为 `null`。应在读取前加 `if (!cartState.selectedCoupon) return null;` 或等价空值判断。
- 评分：✅。

### T13 移动端布局遮挡

- 操作证据：
  - 使用 `resize 390 844`。
  - 点击“提交支付”超时，Playwright 日志明确显示：`<aside class="mobile-support-bar" data-bug="overlaps-pay-button">` 子树拦截 pointer events。
  - `run-code` 读取盒模型：支付按钮 `y=766 height=38`，客服条 `y=726 height=118`；客服条 computed style 为 `position: fixed`、`bottom: 0px`、`zIndex: 20`、`pointerEvents: auto`。
  - 临时关闭客服条 pointer events 后点击，页面显示 `支付确认码：MOBILE-39`。
- 结论：`.mobile-support-bar[data-bug="overlaps-pay-button"]` 固定在底部且 z-index 更高，覆盖并吞掉支付按钮点击。确认码为 `MOBILE-39`。
- 评分：✅。确认码获取使用了 `run-code` 逃生舱，遮挡定位本身由原生点击失败日志完成。

### T14 SPA Hydration 不一致

- 操作证据：
  - 初始快照显示待办 `8`、套餐 `starter`、状态“等待客户端状态接管…”。
  - 等待后快照显示待办 `9`、套餐 `team-pro`、`traceId=HYD-908`。
  - Console 显示 `[hydration mismatch] {traceId: HYD-908, component: TaskSummary, ...}`。
  - `response-body` 显示 `window.__BENCH_STORE__`：`component: "TaskSummary"`，`ssrState: { pendingTasks: 8, planName: "starter" }`，`clientState: { pendingTasks: 9, planName: "team-pro" }`。
- 结论：组件 `TaskSummary` 发生 hydration/state mismatch；不一致字段是 `pendingTasks` 和 `planName`；客户端最终显示 9 个待办、`team-pro` 套餐。
- 评分：✅。

### T15 SSE 实时流等待

- 操作证据：
  - 打开 `/realtime`，点击“开始接收”，等待页面完成。
  - 最终快照显示：`接收完成：5 条事件，关键告警 STREAM-721`。
  - 列表完整显示 `evt-001` 到 `evt-005`，最后一条为 `evt-005 · alert · STREAM-721`。
- 结论：共收到 5 条事件，最后一条 id 是 `evt-005`，关键告警 code 是 `STREAM-721`。
- 评分：✅。

### T16 Service Worker 缓存排障

- 操作证据：
  - 打开 `/cache` 后页面显示 `Service Worker 已控制页面`。
  - 当前页面显示旧配置：theme `blue`，release `cached-2025.11`，featureFlag `STALE-CACHE-17`。
  - 当前受控页面的 `/api/settings` response body 也是旧配置。
  - 独立 session 直接打开 `/api/settings?live=1`，返回 `{"theme":"green","release":"live-2026.06","featureFlag":"CACHE-BUST-42"}`。
- 结论：这是 Service Worker 缓存/拦截导致，不是普通 HTTP cache 或页面渲染问题。修复动作应为更新或注销 Service Worker，或修正 fetch handler 对 `/api/settings` 的缓存策略并重新激活。
- 评分：✅。

### T17 跨域 Iframe 授权

- 操作证据：
  - `/iframe-auth` 快照内联显示 iframe 内容，账号为 `iframe-user@bench.dev`。
  - 点击 iframe 内“确认授权”后，父页面显示 `授权完成：iframe-user@bench.dev / OAUTH-314`。
- 结论：iframe 内授权点击成功，父页面收到账号 `iframe-user@bench.dev` 和授权码 `OAUTH-314`。
- 评分：✅。

### T18 文件上传输入

- 操作证据：
  - 打开 `/input-lab`。
  - 直接 `upload` 提示必须先有 file chooser modal state。
  - 点击 `Choose File` 后，`upload /Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt` 成功。
  - 页面显示 `文件 upload-token.txt，36 bytes，token=UPLOAD-448`。
- 结论：真实文件上传路径完成；文件名 `upload-token.txt`，大小 `36 bytes`，token `UPLOAD-448`。
- 评分：✅。

### T19 键盘可访问性

- 操作证据：
  - 点击“打开偏好设置”被 hidden backdrop 拦截；初始快照已显示 dialog。
  - 键盘 Tab 顺序：`#notify-email` -> `#close-modal` -> `#notify-email`，跳过“保存偏好”。
  - Enter 在输入框上没有触发保存。
  - 鼠标点击“保存偏好”后显示 `保存成功：A11Y-204`。
  - `response-body` 显示保存控件为 `<div class="fake-button save-preferences" role="button" id="save-preferences">保存偏好</div>`；focus trap 只查询 `[data-trap-focus]`，只有输入框和关闭按钮。
- 结论：键盘不能到达并激活“保存偏好”。具体原因是 `#save-preferences` 使用 `div role=button` 伪按钮，缺少 `tabindex="0"`，也没有 Enter/Space 键盘事件处理，同时 focus trap 列表不包含它。鼠标确认码为 `A11Y-204`。
- 评分：✅。

### T20 回归稳定性 Flake 率

- 操作证据：
  - 打开 `/flake`，点击“运行 10 次”，等待完整表格。
  - 最终快照显示 `通过 7/10，失败轮次 3,6,9，稳定性代码 FLAKE-307`。
  - 表格 10 行完整：第 3、6、9 行为 `FAIL`，其余为 `PASS`。
- 结论：通过 7 次，失败 3 次，失败轮次 3/6/9，稳定性代码 `FLAKE-307`。flake rate = 3/10 = 30%，该检查不稳定。
- 评分：✅。

## 综合结论

`playwright-cli 0.1.14` 在 T12-T20 中整体通过 9/9。它的优势是 accessibility snapshot、iframe 内联 ref、file chooser、键盘事件、网络响应体和 Console 读取都比较直接，能覆盖大多数前端诊断任务。

主要短板有三点：

1. Console 对象会折叠，T12/T14 需要额外读取 source map 或 response body 才能拿到完整字段。
2. SSE streaming 细节没有直接展开，本次 T15 主要依赖页面最终 DOM，而不是逐条 EventSource response inspection。
3. 对遮挡场景，原生 click 能很好给出拦截元素；但若还要拿“正常点击后确认码”，T13 需要 `run-code` 临时调整页面状态，已按逃生舱记录。

本轮没有 staging / commit。
