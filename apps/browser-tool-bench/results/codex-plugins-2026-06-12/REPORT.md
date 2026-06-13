# Codex 插件正式对比：@chrome / @browser / agent-browser（2026-06-12）

## 方法

本轮使用 `apps/browser-tool-bench` 的同一套 T01-T08 任务。为了避免主线程已经读过 ground truth 造成污染，正式结果来自独立 subagent：

- 每个 subagent 使用 `fork_context=false`，只拿到任务 prompt 和工具限制。
- 禁止读取 `tasks/`、`results/`、`server.mjs`、`public/` 源码和旧报告。
- 禁止用 `curl`、shell Playwright、仓库源码等旁路解题。
- `@chrome` 只能用 Chrome 插件；`@browser` 只能用 in-app Browser 插件；`agent-browser` 只能用 agent-browser CLI。
- 长串 subagent 在返回 partial 后，未执行的 cell 用单题 subagent 补跑。

注意：这仍不等同于旧的 `claude -p` 外部独立进程 formal run，因为 `@chrome` / `@browser` 是 Codex 当前线程内的插件后端，不能像 MCP server 那样直接挂给外部 `claude -p`。因此本轮主要比较能力边界和任务完成度，时间/调用数只作粗略参考。

## 结果矩阵

cell 格式：`判定 · 粗略调用数 · 耗时 · 关键路径/阻塞`

| 任务 | @chrome 插件 | @browser 插件 | agent-browser 0.27.2 |
| --- | --- | --- | --- |
| T01 登录与页面观察 | ✅ · ~15 · 16s · 读到 `BENCH-7341` | ✅ · ~12 · 37s · 读到 `BENCH-7341` | ✅ · ~8 · 6s · 读到 `BENCH-7341` |
| T02 Network 排障 | ❌ · ~25 · 50s · 只有页面错误和 console traceId，拿不到状态码/响应体 | ❌ · ~25 · 60s · 同样只有页面错误和 traceId | ✅ · ~40 · 60s · 拿到 `POST /api/orders`、500、`INSUFFICIENT_INVENTORY` |
| T03 性能诊断 | ❌ · ~6 · 2s · 只能列资源名，`performance` / LCP / long task 不可用 | ❌ · ~10 · 19s · 同样无 resource timing / LCP / long task | ✅ · ~9 · 14s · vitals + profile，归因为 render-blocking CSS 最大 |
| T04 请求 mock | ❌ · ~7 · 1s · 无 route/mock，仍是 18 人列表 | ❌ · ~6 · 25s · 无 route/mock，仍是 18 人列表 | ✅ · ~6 · 4s · `network route` mock 空列表并截图 |
| T05 动态等待 | ✅ · ~26 · 54s · 12 条，`LIVE-512` | ✅ · ~16 · 26s · 12 条，`LIVE-512` | ✅ · ~11 · 7s · 12 条，`LIVE-512` |
| T06 结构化提取 | ⚠️ · ~18 · 36s · 最贵答对，但两个 name 混入“缺货”徽标 | ✅ · ~6 · 25s · 12 条、字段干净、排序正确 | ✅ · ~7 · 5s · 12 条、字段干净、排序正确 |
| T07 已登录 fetch | ❌ · ~14 · 13s · page evaluate 无 `fetch` / `window.fetch` | ❌ · ~16 · 3min · `fetch` / XHR 不可用，直接 `/api/me` 被拦 | ✅ · ~8 · 5s · 页面上下文 fetch 得到 `team-pro-2026` |
| T08 Shadow DOM | ✅ · ~8 · 69s · 点击成功，`SHADOW-99` | ✅ · ~5 · 14s · 点击成功，`SHADOW-99` | ✅ · ~11 · 5s · 点击成功，`SHADOW-99` |
| **合计** | **3✅ + 1⚠️ + 4❌** | **4✅ + 4❌** | **8✅** |

## 关键结论

1. **agent-browser 仍然是这套评测集里最完整的一列**：T02 响应体、T03 性能 profile、T04 network route、T07 页面上下文 fetch 都能覆盖，8 题全过。
2. **@chrome 和 @browser 的能力面几乎一致**：都适合页面可见内容、表单、点击、等待、Shadow DOM；都缺 Network body、request mock、performance trace、可写/可请求的 page runtime。
3. **@chrome 的优势不在这套本地靶场，而在真实 Chrome profile**：如果任务需要用户现有登录态、已打开标签或扩展状态，@chrome 有价值；但它不是 DevTools Network/Performance 工具。
4. **@browser 更像轻量页面操作后端**：对 T01/T05/T06/T08 这类页面任务够用；遇到 T02/T03/T04/T07 这种开发者工具能力题会卡在 API 边界。
5. **T06 暴露了“可见文本提取”的常见污染**：@chrome 子 agent 把“缺货”徽标拼进商品名，说明没有接口/结构化 adapter 时，DOM 文本抽取容易把展示徽标混进字段。

## 原始 subagent 摘要

### agent-browser

- T01: `BENCH-7341`
- T02: `POST /api/orders`，HTTP 500，`INSUFFICIENT_INVENTORY` / `SKU-8821 库存不足，剩余 0 件`
- T03: `blocking.css` 约 1206ms 阻塞渲染、`heavy.js` 约 800ms 主线程任务、`hero.svg` 约 1507ms；LCP 最大影响来自 render-blocking CSS
- T04: route mock `{"users":[]}` 成功，截图 `/tmp/agent-browser-t04-users-empty.png`
- T05: 12 条，`LIVE-512`
- T06: 12 条，最贵 `雷霆工作站` 15999
- T07: `team-pro-2026`
- T08: `SHADOW-99`

### @chrome

- 成功：T01、T05、T08
- 部分：T06，最贵答对但 `name` 字段混入“缺货”
- 失败：T02、T03、T04、T07
- 主要阻塞：无 network response body/status、无 route/mock、`evaluate` 中无 `fetch` / `performance`

### @browser

- 成功：T01、T05、T06、T08
- 失败：T02、T03、T04、T07
- 主要阻塞：与 @chrome 类似；T07 里直接导航 `/api/me` 也被 Browser 策略拦截；T06 截图尝试出现过 `Page.captureScreenshot` 超时，但不影响数据读取。

