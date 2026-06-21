# Chrome DevTools MCP 1.2.0 - T12-T20 评测报告

评测时间：2026-06-19

工具：`chrome-devtools-mcp` 1.2.0，自管浏览器，未连接 9223。

靶场：用户说明服务在 `http://localhost:4400/`，任务卡 Prompt 内仍写 `localhost:4399`；本轮实际按 `4400` 等价路径执行。未读取 `server.mjs` 或仓库源码拿答案；执行完成后才读取任务卡 Ground Truth/判定标准核分。最终只写入本报告。

## 总表

| 任务 | 结果 | 关键答案 | native DevTools MCP 完成 | evaluate_script/脚本逃生舱 | 卡点 |
| --- | --- | --- | --- | --- | --- |
| T12 Console 与 SourceMap 定位 | ✅ | `webpack://bench/src/cart/coupon.ts`；`applySelectedCoupon`；`cartState.selectedCoupon.couponCode`，`selectedCoupon` 为 `null`；guard: `if (!cartState.selectedCoupon) return null;` | 是，click/console/network/sourcemap 取证 | 用于打开并解析 sourcemap JSON | 初次 uid 解析误点静态文本，补跑后正确点击按钮 |
| T13 移动端布局遮挡 | ✅ | 遮挡元素 `.mobile-support-bar[data-bug="overlaps-pay-button"]`；`position: fixed; bottom: 0; height: 118px; z-index: 20` 覆盖 `z-index: 10` 的 `.checkout-actions`；确认码 `MOBILE-39` | 是，移动 viewport、click、snapshot | 用于 `elementFromPoint`/computed style；为读取确认码临时关闭遮挡层 pointer-events 后再 native click | DevTools MCP 的 click 会报告 clicked，但实际页面无确认码，需 hit-test 才能发现遮挡 |
| T14 Hydration 不一致 | ✅ | 组件 `TaskSummary`；traceId `HYD-908`；SSR `pendingTasks=8, planName=starter`；Client `pendingTasks=9, planName=team-pro`；最终显示 9 / team-pro | 是，console + snapshot | 否，另一次 DOM eval 写错选择器但不影响结论 | 无 |
| T15 SSE 实时流等待 | ✅ | 5 条事件；最后 `evt-005`；告警 `STREAM-721` | 是，click、等待、snapshot、network | 仅用于读 body 文本复核 | MCP network 只列 EventSource 请求，事件明细主要从页面 DOM 读取 |
| T16 Service Worker 缓存 | ✅ | 页面旧值：`blue / cached-2025.11 / STALE-CACHE-17`；live 值：`green / live-2026.06 / CACHE-BUST-42`；由 `/sw-cache.js` 控制导致 | 是，snapshot、network、浏览器打开 live 接口 | 用于检查 `navigator.serviceWorker.controller` 和页面内 fetch | localhost 下 `/api/settings` 被 SW 拦截；用 `127.0.0.1:4400/api/settings?live=1` 绕开 localhost SW 证明真实值 |
| T17 跨域 iframe 授权 | ✅ | `iframe-user@bench.dev / OAUTH-314` | 是，snapshot 内联 iframe + click | 仅用于读父页面 body 复核 | 无需显式 frame 切换 |
| T18 文件上传输入 | ✅ | `upload-token.txt`；`36 bytes`；`UPLOAD-448` | 是，`upload_file` 到 file input，snapshot 显示解析结果 | 用于诊断 input.files；未伪造 File | `upload_file` 返回的即时 snapshot 仍显示等待，随后 snapshot 才出现解析结果 |
| T19 键盘可访问性 | ✅ | 键盘到不了/不能激活保存；`#save-preferences` 是 fake button div，缺 `tabindex="0"` 和 Enter/Space handler；鼠标确认码 `A11Y-204` | 是，Tab/Shift+Tab、snapshot、mouse click | 用于检查 DOM/CSS/ARIA 属性 | focus trap 只在 input 与关闭按钮间循环 |
| T20 回归稳定性 Flake 率 | ✅ | 通过 7/10，失败 3/10，失败轮次 3/6/9，代码 `FLAKE-307`，flake rate 30%，不稳定 | 是，click 后等待 10 次完成并读表格 | 仅用于读 body 文本复核 | 初次 uid 解析误点说明文本，补跑后正确点击按钮 |

## 逐题细节

### T12

- 操作：`new_page /debug-console` -> `take_snapshot` -> `click` 应用优惠券 -> `list_console_messages` -> `get_console_message` -> `list_network_requests` -> `get_network_request` 读取 bundle -> 浏览器打开 `/assets/debug-bundle.js.map`。
- 证据：
  - 页面出现 `应用失败，请联系管理员（错误码已上报）`。
  - Console：`checkout coupon crash`，结构化对象含 `originalSource: "src/cart/coupon.ts:12"`、`functionName: "applySelectedCoupon"`。
  - Stack 映射到 `coupon.ts`。
  - sourcemap `sources` 含 `webpack://bench/src/cart/coupon.ts`，`sourcesContent` 片段显示 `selectedCoupon can be null` 与预期 guard。
- 判定：✅。能给出原始源码文件、函数、空字段和 guard。

### T13

- 操作：`emulate viewport: 390x844x2,mobile,touch`，点击 `提交支付`，无确认码；用 hit-test 检查按钮中心点。
- 证据：
  - `#pay-button` rect 约 `x=20 y=766 w=350 h=38`。
  - `elementFromPoint` 顶层命中 `.mobile-support-bar` 内文本；元素链显示 `.mobile-support-bar` rect `x=0 y=726 w=390 h=118`，CSS `position: fixed; z-index: 20; bottom: 0px`。
  - 被覆盖的 `.checkout-actions` CSS 为 `position: fixed; z-index: 10; bottom: 40px`。
  - 临时把 `.mobile-support-bar` 设为 `pointer-events: none` 后，再用 MCP native `click` 点击按钮，页面显示 `支付确认码：MOBILE-39`。
- 判定：✅。主要诊断来自盒模型/hit-test；确认码读取有脚本辅助解除遮挡，报告中单独标明。

### T14

- 操作：打开 `/hydration`，等待客户端接管，读取 snapshot 和 console 详情。
- 证据：
  - Console `[hydration mismatch]` 参数：`traceId: HYD-908`，`component: TaskSummary`。
  - `fields: ["pendingTasks","planName"]`。
  - `ssrState: { pendingTasks: 8, planName: "starter" }`。
  - `clientState: { pendingTasks: 9, planName: "team-pro" }`。
  - 最终 DOM 显示 `待办数量：9`、`套餐：team-pro`。
- 判定：✅。

### T15

- 操作：打开 `/realtime`，点击 `开始接收`，等待流完成，再读 snapshot/network。
- 证据：
  - Network：`GET /api/realtime-events [200]`。
  - 页面 summary：`接收完成：5 条事件，关键告警 STREAM-721`。
  - 明细：`evt-001` 到 `evt-005`，最后一条 `evt-005 · alert · STREAM-721`。
- 判定：✅。

### T16

- 操作：打开 `/cache`，读页面旧值；检查 SW 控制状态；在浏览器内请求同源 `/api/settings`；再打开 `http://127.0.0.1:4400/api/settings?live=1` 获取绕过 localhost SW 的实时值。
- 证据：
  - 页面显示旧值：theme `blue`，release `cached-2025.11`，featureFlag `STALE-CACHE-17`。
  - `navigator.serviceWorker.controller.scriptURL` 为 `http://localhost:4400/sw-cache.js`。
  - localhost 页面内 fetch `/api/settings` 仍返回旧值，证明被 SW 拦截。
  - `127.0.0.1:4400/api/settings?live=1` 返回 `{"theme":"green","release":"live-2026.06","featureFlag":"CACHE-BUST-42"}`。
- 修复动作：更新或注销旧 Service Worker；修正 fetch handler 对 `/api/settings` 的缓存策略，重新 activate/claim 后让页面 reload 到新 SW。
- 判定：✅。

### T17

- 操作：打开 `/iframe-auth`，snapshot 内直接包含跨源 iframe 的可访问树，点击 iframe 内 `确认授权`。
- 证据：
  - iframe URL：`http://127.0.0.1:4400/iframe-child.html`，父页是 `localhost:4400`，不同源。
  - 点击后父页面显示：`授权完成：iframe-user@bench.dev / OAUTH-314`。
- 判定：✅。

### T18

- 操作：打开 `/input-lab`，对 `#token-file` 对应的 `选择文件` 控件调用 `upload_file`，文件路径为 `/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt`。
- 证据：
  - `upload_file` 后 input value 为 `upload-token.txt`。
  - 诊断显示 input.files 有 1 个文件：`name=upload-token.txt`、`size=36`、`type=text/plain`。
  - 随后 snapshot 显示：`文件 upload-token.txt，36 bytes，token=UPLOAD-448`。
- 判定：✅。没有伪造 File，也没有读取本地文件内容作为答案。

### T19

- 操作：打开 `/a11y-modal`，点击 `打开偏好设置`，连续 Tab/Shift+Tab 检查焦点，再鼠标点击保存。
- 证据：
  - Tab 焦点只在 `#notify-email` 输入框和 `#close-modal` 关闭按钮间循环。
  - DOM：`<div class="fake-button save-preferences" role="button" id="save-preferences">保存偏好</div>`。
  - 该 div 不在 `button` 列表里，无 `tabindex="0"`；作为 role=button 也缺少 Enter/Space 键盘事件处理，因此键盘无法聚焦/激活保存。
  - MCP native mouse click 保存后页面显示：`保存成功：A11Y-204`。
- 判定：✅。

### T20

- 操作：打开 `/flake`，点击 `运行 10 次`，等待全部 10 行结果出现。
- 证据：
  - 页面 summary：`通过 7/10，失败轮次 3,6,9，稳定性代码 FLAKE-307`。
  - 表格 10 行完整：1/2/4/5/7/8/10 为 PASS，3/6/9 为 FAIL。
  - 失败率 `3 / 10 = 30%`。
- 结论：不稳定。
- 判定：✅。

## 工具调用统计

粗略合计多轮补跑：

| MCP tool | 次数 |
| --- | ---: |
| `new_page` | 18 |
| `take_snapshot` | 33 |
| `click` | 12 |
| `list_console_messages` | 4 |
| `get_console_message` | 4 |
| `list_network_requests` | 4 |
| `get_network_request` | 1 |
| `emulate` | 2 |
| `press_key` | 12 |
| `upload_file` | 3 |
| `evaluate_script` | 18 |

`evaluate_script` 主要用于：DOM/CSS hit-test、Service Worker 控制状态、sourcemap JSON 解析、文件 input 诊断、body 文本复核。没有通过 eval 伪造业务结果；T13 为读取正常确认码临时解除遮挡层 pointer events，已在逐题记录中标明。

## 综合结论

Chrome DevTools MCP 1.2.0 对 T12-T20 的覆盖结果为 **9/9 成功**。强项是 console/stack/network/snapshot/iframe/file input/keyboard 路径都能直接完成；弱点是复杂 CSS 遮挡、SW 绕行、文件上传异步状态这类问题仍需要 `evaluate_script` 做底层诊断。对 T20 这类等待型任务，native click 后读取完整表格即可，不需要循环脚本统计。
