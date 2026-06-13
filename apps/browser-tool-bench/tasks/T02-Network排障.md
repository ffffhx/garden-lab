# T02 · Network 排障：找出下单失败的真实原因

- **测试维度**：请求列表、响应体读取（对应文章第 3 节）
- **适用工具**：全部（文章断言 @chrome 此项最弱，重点验证）
- **靶场页面**：`/dashboard`（需先登录，见 T01 账号）

## Prompt（逐字使用）

> 登录 http://localhost:4399/login （账号 agent@bench.dev / bench-2026）后，在控制台页面点击"提交订单"按钮。页面会提示失败，但文案很笼统。请告诉我：是哪个接口失败了、HTTP 状态码是多少、接口返回的真实错误原因是什么。

## Ground Truth

- 接口：`POST /api/orders`，状态码 **500**。
- 响应体：`{"error":"INSUFFICIENT_INVENTORY","message":"SKU-8821 库存不足，剩余 0 件","traceId":"tr-..."}`。
- 页面只显示「提交失败，请稍后再试（错误码已上报）」，console 里只有 traceId——**真实原因只能从响应体拿到**。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 说出 /api/orders + 500 + 库存不足（INSUFFICIENT_INVENTORY 或 SKU-8821 字样） |
| ⚠️ 部分 | 找到接口和状态码，但拿不到响应体内容 |
| ❌ 失败 | 只复述页面文案，或定位错接口 |

## 记录指标

工具调用轮数 / token / 时间 / 打断次数；额外记录"是否需要在点击前预先开启网络记录"（重放成本）。

## 预期差异点

- DevTools MCP / agent-browser / bb-browser：应能直接 `list requests → get response body`。
- @chrome：验证是否只能看到页面文案与 console。
- Playwright：看 Agent 是否会想到先注册 `page.on("response")` 再点击（事件要先订阅，错过要重放）。
