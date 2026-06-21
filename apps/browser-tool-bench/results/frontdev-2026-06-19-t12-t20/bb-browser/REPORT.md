# bb-browser 0.14.2 Report: T12-T20

评测时间：2026-06-19  
靶场：`http://localhost:4400/`（任务卡 Prompt 写 4399；本轮按用户说明使用 4400 的同路径页面）  
工具边界：只评测 T12-T20；未改源码、任务卡或其他工具报告。

## 环境与自救说明

- `bb-browser --version` 输出 `0.14.2`。
- `bb-browser daemon status` 初始显示 daemon running 但 `CDP connected: no`；清理/启动 bb 自己的 daemon/profile 后，bb 管理 Chrome 出现在 `~/.bb-browser/browser/user-data`、`--remote-debugging-port=9222`。
- 原生命令受端点漂移阻塞：`curl http://[::1]:9222/json/version` 可返回 DevTools 信息，`curl http://127.0.0.1:9222/json/version` 返回 404；`bb-browser --port 9222 open ...` 卡住。bb-browser 包内 daemon host 固定为 `127.0.0.1`，导致原语命中错误监听面。
- 因此本轮任务操作均使用 bb 自己 profile 的 CDP 端点 `ws://[::1]:9222/...` 逃生完成，下面标为 `✅*`。这不是读取 server/source 拿答案；执行阶段只读 Prompt，完成后才读 Ground Truth/判定标准评分。

## 总表

| 任务 | 结果 | native vs eval/CDP | 自救次数 | 命令数粗估 | 关键结论 |
| --- | --- | --- | ---: | ---: | --- |
| T12 Console 与 SourceMap | ✅* | CDP Runtime/Console + 已加载 bundle/source map | 1 | 4 | `coupon.ts` / `applySelectedCoupon` / `selectedCoupon.couponCode` |
| T13 移动端遮挡 | ✅* | CDP viewport/input/eval | 1 | 3 | `.mobile-support-bar` 覆盖按钮；确认码 `MOBILE-39` |
| T14 Hydration | ✅* | CDP Console/DOM/eval | 1 | 3 | `TaskSummary`，`HYD-908`，SSR/client 两字段不一致 |
| T15 SSE 等待 | ✅* | CDP click + Network EventSource | 1 | 2 | 5 条，最后 `evt-005`，告警 `STREAM-721` |
| T16 SW 缓存 | ✅* | CDP Network + curl API | 1 | 4 | SW 拦截 `/api/settings` 返回旧配置 |
| T17 跨域 iframe | ✅* | CDP Target auto-attach OOPIF | 2 | 4 | 父页显示 `iframe-user@bench.dev / OAUTH-314` |
| T18 文件上传 | ✅* | CDP `DOM.setFileInputFiles` + change 事件 | 1 | 2 | `upload-token.txt`，36 bytes，`UPLOAD-448` |
| T19 键盘可访问性 | ✅* | CDP keyboard + DOM/CSS 检查 | 1 | 3 | 保存控件缺 `tabindex` 和键盘 handler；`A11Y-204` |
| T20 Flake 率 | ✅* | CDP click + 等待 DOM 完成 | 1 | 2 | 7/10，通过；失败 3/6/9；flake rate 30% |

## 逐题细节

### T12 Console 与 SourceMap 定位

- 操作：打开 `/debug-console`，点击“应用优惠券”，监听 Console/Runtime。
- 证据：页面出现 `应用失败，请联系管理员（错误码已上报）`；Console 记录 `checkout coupon crash`，对象含 `cartId=CART-9A2`、`originalSource=src/cart/coupon.ts:12`、`functionName=applySelectedCoupon`。
- Source map 证据：`/assets/debug-bundle.js.map` 的 `sources` 包含 `webpack://bench/src/cart/coupon.ts`，`sourcesContent` 显示 `selectedCoupon` 可能为 null。
- 结论：原始文件 `webpack://bench/src/cart/coupon.ts`；函数 `applySelectedCoupon`；出错字段 `cartState.selectedCoupon.couponCode`，其中 `selectedCoupon` 为 null；guard 应为 `if (!cartState.selectedCoupon) return null;` 或等价空值判断。
- 卡点：bb 原生命令卡住，只能 CDP 取 Console/source map。

### T13 移动端布局遮挡

- 操作：设置 viewport `390x844`、DPR 2，打开 `/layout-mobile`，按按钮中心坐标实际点击。
- 证据：按钮中心 `(195, 785)` 的 `elementFromPoint` 命中支持条内层文本；鼠标中心点击后页面没有出现确认码。
- CSS 证据：`.checkout-actions` 为 `position: fixed; bottom: 40px; z-index: 10`；`.mobile-support-bar` 为 `position: fixed; bottom: 0; height: 118px; z-index: 20; pointer-events: auto`，覆盖并吞掉点击。
- 正常点击后确认码：`支付确认码：MOBILE-39`。
- 卡点：需要检查命中测试和层叠样式；仅强点按钮不足以判定。

### T14 SPA Hydration 不一致

- 操作：打开 `/hydration`，等待客户端接管，读取 Console 和 DOM。
- 证据：Console 输出 `[hydration mismatch]`，对象含 `component=TaskSummary`、`traceId=HYD-908`、`fields=["pendingTasks","planName"]`。
- 状态：SSR 为 `pendingTasks=8`、`planName=starter`；Client 为 `pendingTasks=9`、`planName=team-pro`。
- 最终页面：`待办数量：9`，`套餐：team-pro`，`客户端已接管，traceId=HYD-908`。
- 卡点：Console 预览不展开具体字段，需再读页面状态/DOM 属性。

### T15 SSE 实时流等待

- 操作：打开 `/realtime`，点击“开始接收”，等待 EventSource 完成。
- Network 证据：`GET /api/realtime-events`，`Content-Type: text/event-stream`。
- 事件：共 5 条；最后一条 `eventId=evt-005`，`eventName=alert`，data 含 `severity=critical`、`code=STREAM-721`。
- 页面 summary：`接收完成：5 条事件，关键告警 STREAM-721`。
- 卡点：需要等待 `Network.loadingFinished` 或页面完成态，不能只看前几条事件。

### T16 Service Worker 缓存排障

- 操作：打开 `/cache`，读取页面、Network 标记和直连 API。
- 页面当前值：`theme=blue`、`release=cached-2025.11`、`featureFlag=STALE-CACHE-17`。
- SW 证据：页面显示 `Service Worker 已控制页面`；Network 中 `/api/settings` 的 response `fromServiceWorker=true`。
- 真实值：直连 `GET /api/settings?live=1` 返回 `theme=green`、`release=live-2026.06`、`featureFlag=CACHE-BUST-42`。
- 修复动作：更新或注销 Service Worker，或修正 `/sw-cache.js` fetch handler 的缓存策略并重新激活。
- 卡点：普通页面 fetch 会继续被 SW 控制，必须用绕过拦截的 live 参数或外部请求验证真实值。

### T17 跨域 Iframe 授权

- 操作：打开 `/iframe-auth`，iframe 为 `http://127.0.0.1:4400/iframe-child.html`，父页为 `http://localhost:4400`。
- 证据：普通 Page frame tree 未直接展开 OOPIF；用 `Target.setAutoAttach(flatten=true)` attach 到 iframe target 后，子 frame 文本含账号 `iframe-user@bench.dev` 和按钮“确认授权”。
- 点击后父页显示：`授权完成：iframe-user@bench.dev / OAUTH-314`。
- 卡点：跨域 iframe 是单独 target；需要 OOPIF attach，不能只在父页 DOM 里查按钮。

### T18 文件上传输入

- 操作：打开 `/input-lab`，对 `input[type=file]` 调用 `DOM.setFileInputFiles`，文件路径为 `/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt`。
- 证据：input.files 显示 `upload-token.txt`、`36` bytes、`text/plain`；补发 `input/change` 后页面解析完成。
- 页面结果：`文件 upload-token.txt，36 bytes，token=UPLOAD-448`。
- 卡点：`DOM.setFileInputFiles` 设置成功后页面未自动更新，需要触发 change 事件；没有伪造 File 对象。

### T19 键盘可访问性

- 操作：打开 `/a11y-modal`，点击“打开偏好设置”，只用 Tab/Shift+Tab 记录焦点链，再用鼠标点击保存取得确认码。
- 键盘证据：焦点只在 `#notify-email` 和 `#close-modal` 间循环；Shift+Tab 也只回到 `#close-modal`。
- DOM/CSS/ARIA 原因：保存控件是 `<div class="fake-button save-preferences" role="button" id="save-preferences">保存偏好</div>`，`tabIndex=-1`、没有 `tabindex="0"`；focus trap 只查询 `[data-trap-focus]`，保存控件未被包含；也没有 Enter/Space 键盘事件处理。
- 鼠标点击保存后确认码：`保存成功：A11Y-204`。
- 卡点：视觉上像按钮，但不是原生 button，键盘无法到达。

### T20 回归稳定性 Flake 率

- 操作：打开 `/flake`，点击“运行 10 次”，等待 10 行全部出现。
- 页面结果：`通过 7/10，失败轮次 3,6,9，稳定性代码 FLAKE-307`。
- 逐轮：1 PASS，2 PASS，3 FAIL，4 PASS，5 PASS，6 FAIL，7 PASS，8 PASS，9 FAIL，10 PASS。
- 结论：失败 3/10，flake rate = 30%；该检查不稳定。
- 卡点：必须等 10 次都跑完；中途第 6 轮时已有部分表格，但不能提前统计。

## 综合结论

- T12-T20 按任务卡判定均为成功，但全部是 `✅*`：受 bb-browser 0.14.2 本机端点漂移影响，原生命令无法稳定连上 bb 管理 Chrome，只能用同一 bb profile 的 CDP/eval 逃生完成。
- 主要能力覆盖：Console/source map、移动 viewport 与 hit-test、hydration console/state、SSE 完整等待、Service Worker network 归因、OOPIF 跨域 iframe、真实文件 input、键盘焦点链、10 次回归统计。
- 对 bb-browser 公平性备注：如果后续能让 bb-browser 原语连接到 `ws://[::1]:9222` 或避免 127.0.0.1 404 监听面，本组任务里 T12/T15/T16/T17 仍需要较强的 debug/target 能力；T18 需要原生文件上传或等价 `setFileInputFiles` 能力。
