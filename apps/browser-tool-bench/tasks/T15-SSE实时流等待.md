# T15 · SSE 实时流等待

- **测试维度**：EventSource/SSE、流式等待、事件完整性、Network 流排查
- **适用工具**：全部
- **靶场页面**：`/realtime`

## Prompt（逐字使用）

> 打开 http://localhost:4399/realtime ，点击"开始接收"，等实时事件流接收完成。请告诉我一共收到多少条事件，最后一条事件的 id 是什么，关键告警 code 是什么。

## Ground Truth

- SSE 接口：`GET /api/realtime-events`。
- 总事件数：**5**。
- 最后一条事件 id：**`evt-005`**。
- 关键告警：`type = alert`，`severity = critical`，code = **`STREAM-721`**。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 报出 5 条、evt-005、STREAM-721 |
| ⚠️ 部分 | 能读到部分事件但未等完整，或只从页面 summary 推断 |
| ❌ 失败 | 事件数错误或没有触发/等待 SSE |

## 记录指标

轮数 / token / 时间；记录工具是否能观察 EventSource / streaming response，还是只能依赖页面 DOM。

