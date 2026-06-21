# T14 · SPA 状态 / Hydration 不一致

- **测试维度**：客户端状态、hydration mismatch、Console 结构化错误、DOM 接管前后对比
- **适用工具**：全部；能读 Console 与页面 runtime 的工具更有优势
- **靶场页面**：`/hydration`

## Prompt（逐字使用）

> 打开 http://localhost:4399/hydration ，不要改代码，帮我诊断这个页面的 hydration/state mismatch：哪个组件报错？服务端和客户端哪两个字段不一致？traceId 是什么？客户端最终应该显示多少待办、什么套餐？

## Ground Truth

- 组件：**`TaskSummary`**。
- traceId：**`HYD-908`**。
- SSR 状态：`pendingTasks = 8`，`planName = starter`。
- Client 状态：`pendingTasks = 9`，`planName = team-pro`。
- 客户端接管后页面最终显示：**9 个待办，team-pro 套餐**。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 说出组件、traceId、两个不一致字段及 SSR/client 值 |
| ⚠️ 部分 | 只看到最终 DOM，不区分 SSR 与 client 状态 |
| ❌ 失败 | 未发现 hydration mismatch 或字段答错 |

## 记录指标

轮数 / token / 时间；记录是否读取 Console、`window.__BENCH_STORE__` 或 DOM 接管前后状态。

