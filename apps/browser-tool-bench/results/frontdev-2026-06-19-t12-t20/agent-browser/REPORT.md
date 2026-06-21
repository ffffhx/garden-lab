# agent-browser 0.27.2 Report: T12-T20

评测对象：`agent-browser 0.27.2`

执行环境：

- 工作区：`/Users/bytedance/Code/garden-lab`
- 目标服务：用户说明为 `http://localhost:4400/`；任务卡 Prompt 仍写 `http://localhost:4399/`，本轮按 4400 的同路径执行。
- CDP 预检：先执行 `agent-browser --cdp 9223 connect 9223`，再执行 `agent-browser --cdp 9223 get cdp-url`，确认输出为 `ws://127.0.0.1:9223/devtools/browser/...`。
- 约束：未读取 server/source；先只读 Prompt，完成实操后再读取 Ground Truth/判定标准。未 staging/commit。

## 总表

| 任务 | 结果 | 关键答案 | Native 原语完成 | eval/脚本逃生舱 | 粗略命令数 | 主要卡点 |
| --- | --- | --- | --- | --- | ---: | --- |
| T12 Console 与 SourceMap 定位 | ✅ | `webpack://bench/src/cart/coupon.ts`；`applySelectedCoupon`；`cartState.selectedCoupon.couponCode`，`selectedCoupon=null`；guard: `if (!cartState.selectedCoupon) return null;` | ⚠️ 部分 | 是 | 8 | 原生 click 后页面未显式输出错误；console 未展开异常，需 fetch bundle/map |
| T13 移动端布局遮挡 | ✅ | `.mobile-support-bar[data-bug="overlaps-pay-button"]` fixed bottom, height 118px, z-index 20 覆盖按钮；确认码 `MOBILE-39` | ⚠️ 部分 | 是 | 8 | 原生 click 正确报告 covered；确认码需 JS 触发按钮 |
| T14 Hydration 状态不一致 | ✅ | `TaskSummary`；`HYD-908`；SSR `pendingTasks=8`, `planName=starter`；Client `pendingTasks=9`, `planName=team-pro` | ⚠️ 部分 | 是 | 5 | console 折叠对象，只能看到字段摘要，需读 `window.__BENCH_STORE__` |
| T15 SSE 实时流等待 | ✅ | 5 条；最后 `evt-005`；告警 `STREAM-721` | ❌ | 是 | 7 | ref click 返回成功但未触发 EventSource；需 `button.click()` |
| T16 Service Worker 缓存排障 | ✅ | SW `/sw-cache.js` 控制；页面旧值 `blue/cached-2025.11/STALE-CACHE-17`；实时值 `green/live-2026.06/CACHE-BUST-42` | ⚠️ 部分 | 是 | 4 | 需要检查 SW 注册和 bypass 请求 `/api/settings?live=1` |
| T17 跨域 iframe 授权 | ✅ | 父页面显示 `iframe-user@bench.dev / OAUTH-314` | ✅ | 否 | 3 | iframe 被 snapshot 内联，ref 可直接点击 |
| T18 文件上传输入 | ✅ | `upload-token.txt`；`36 bytes`；`UPLOAD-448` | ✅ | 否 | 4 | 上传后需要短暂等待页面异步解析 |
| T19 键盘可访问性 | ✅ | 键盘到不了/激活不了保存；`#save-preferences` 是无 `tabindex`、无键盘 handler 的 `div role=button`；确认码 `A11Y-204` | ❌ | 是 | 10 | hidden backdrop 干扰 click/Tab；保存的原生 click 未触发，确认码用 `.click()` |
| T20 Flake 率 | ✅ | 通过 7/10，失败 3/10，失败轮次 3/6/9，`FLAKE-307`，flake rate 30%，不稳定 | ❌ | 是 | 5 | ref click 返回成功但未触发监听；需 `.click()` 后等 10 次完成 |

## 逐题细节

### T12 Console 与 SourceMap 定位

操作：打开 `/debug-console`，点击“应用优惠券”，读取 console/network，并通过页面网络资产读取 `/assets/debug-bundle.js` 与 `/assets/debug-bundle.js.map`。

证据：

- Network 显示加载 `/assets/debug-bundle.js`。
- bundle 末尾有 `//# sourceMappingURL=/assets/debug-bundle.js.map`。
- source map `sources` 包含 `webpack://bench/src/cart/coupon.ts`。
- `sourcesContent` 中 `applySelectedCoupon(cartState)` 直接访问 `cartState.selectedCoupon.couponCode.toUpperCase()`，注释给出期望 guard。

判定：✅。答案完整，但不是纯 native；必须用 eval fetch 网络资产补齐 source map 证据。

### T13 移动端布局遮挡

操作：`set viewport 390 844`，打开 `/layout-mobile`，点击“提交支付”。

证据：

- 原生点击返回 covered：按钮点击点被 `<div>`/`<aside.mobile-support-bar>` 覆盖。
- `elementFromPoint` 与 computed style 显示覆盖容器是 `.mobile-support-bar[data-bug="overlaps-pay-button"]`，`position: fixed; bottom: 0px; height: 118px; z-index: 20`。
- 按钮区域位于底部，正常触发后显示 `支付确认码：MOBILE-39`。

判定：✅。遮挡诊断由 native click + computed style 得出；确认码用 eval 触发按钮得到。

### T14 SPA Hydration 状态不一致

操作：打开 `/hydration`，等待客户端接管，读取正文与 console。

证据：

- 可见最终状态：`待办数量：9`，`套餐：team-pro`，`traceId=HYD-908`。
- console：`[hydration mismatch]`，component 为 `TaskSummary`。
- 页面 store：SSR `pendingTasks=8`, `planName=starter`；Client `pendingTasks=9`, `planName=team-pro`；字段为 `pendingTasks` 和 `planName`。

判定：✅。console 原语能发现 mismatch，但完整字段和值依赖 eval 读取页面 store。

### T15 SSE 实时流等待

操作：打开 `/realtime`，尝试点击“开始接收”，等待完成。原生 ref click 未触发状态变化，改用 `document.querySelector('#start-stream').click()`，再等待页面显示完成。

证据：

- Network 出现 `GET /api/realtime-events (EventSource) 200`。
- 页面显示 `接收完成：5 条事件，关键告警 STREAM-721`。
- 列表最后一条：`evt-005 · alert · STREAM-721`。

判定：✅。结果完整，但触发依赖 eval；native click 在本页不可靠。

### T16 Service Worker 缓存排障

操作：打开 `/cache`，读取页面、network、SW 注册状态，并请求 bypass 接口。

证据：

- 页面显示：theme `blue`，release `cached-2025.11`，featureFlag `STALE-CACHE-17`。
- `navigator.serviceWorker.controller.scriptURL` 为 `http://localhost:4400/sw-cache.js`。
- SW 注册 scope 为 `http://localhost:4400/`，active script 为 `/sw-cache.js`。
- `/api/settings?live=1` 返回：theme `green`，release `live-2026.06`，featureFlag `CACHE-BUST-42`。
- `/sw-cache.js` 的 fetch handler 对无 `live` 参数的 `/api/settings` 返回 stale JSON。

修复动作：更新/注销该 Service Worker，或修正 fetch handler 的缓存策略并重新激活；不建议泛泛清理用户浏览器数据。

判定：✅。

### T17 跨域 Iframe 授权

操作：打开 `/iframe-auth`，snapshot 内联出 “第三方授权窗口”，直接点击 iframe 内 `确认授权`。

证据：

- snapshot 中 iframe 内按钮可见，ref 可直接操作。
- 父页面显示：`授权完成：iframe-user@bench.dev / OAUTH-314`。

判定：✅。纯 native agent-browser 原语完成，无需显式 frame 切换。

### T18 文件上传输入

操作：打开 `/input-lab`，用 `upload @e3 /Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt` 上传。

证据：

- 文件 input 显示 `upload-token.txt`。
- 页面最终显示：`文件 upload-token.txt，36 bytes，token=UPLOAD-448`。

判定：✅。走真实页面上传路径；未伪造 File 对象。

### T19 键盘可访问性

操作：打开 `/a11y-modal`，尝试点击“打开偏好设置”，再用 Tab/Shift+Tab 检查焦点。由于 hidden backdrop 干扰原生点击和 Tab，使用 eval 打开弹窗后继续键盘检查焦点，并读取 DOM 结构。

证据：

- focus trap 代码只收集 `[data-trap-focus]`，实际包含 `#notify-email` 和 `#close-modal`。
- “保存偏好”为 `<div class="fake-button save-preferences" role="button" id="save-preferences">保存偏好</div>`。
- 该元素缺少 `tabindex="0"`，且只有 click handler，没有 Enter/Space 键盘 handler。
- 鼠标/直接 click 保存后确认码：`A11Y-204`。

判定：✅。可访问性原因完整；但 agent-browser 在该页的 native click/keyboard 表现不稳定，确认码用 eval 获取。

### T20 回归稳定性 Flake 率

操作：打开 `/flake`，尝试点击“运行 10 次”。原生 ref click 未触发运行，改用 `document.querySelector('#run-checks').click()`，等待 `稳定性代码 FLAKE-307`。

证据：

- 页面表格列出 1-10 轮。
- PASS：1,2,4,5,7,8,10，共 7 次。
- FAIL：3,6,9，共 3 次。
- 每轮代码为 `FLAKE-307`。
- Network 出现 `/api/flake-check?run=1` 到 `run=10` 共 10 个请求。

结论：检查不稳定，flake rate = 30%。

判定：✅。

## 综合结论

agent-browser 0.27.2 在本组任务里读取页面、snapshot、iframe、上传、网络/SW 观察能力可用，T17/T18 能纯原语完成。T13 的遮挡判断也有直接价值，原生 click 能准确报告 covered。

主要短板集中在点击/焦点触发可靠性：T15/T20 的普通按钮 click 返回成功但未触发监听，T19 的 hidden backdrop 影响 click/Tab，T12/T14 的 console 对象展开不足。这些任务最终都能完成，但多题需要 eval 作为逃生舱，因此如果按“严格 native agent-browser 原语”评分，只有 T17/T18 是无争议成功，T13/T16 属于原语诊断成功但答案补全依赖 eval，其余需要脚本辅助。
