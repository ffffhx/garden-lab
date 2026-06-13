# T04 · 请求 mock：构造空状态并截图

- **测试维度**：请求拦截 / mock（对应文章第 3 节 route 能力）
- **适用工具**：agent-browser、bb-browser、Playwright、DevTools MCP；@chrome 预期不可行（验证它）
- **靶场页面**：`/users`

## Prompt（逐字使用）

> 我想看 http://localhost:4399/users 页面在没有任何成员时的空状态长什么样，但接口实际会返回 18 个成员。请把 /api/users 接口 mock 成空列表，然后截一张空状态的图给我。

## Ground Truth

- `/api/users` 真实返回 18 个成员。
- mock 成 `{"users":[]}` 后页面显示空状态：🪴 图标 +「暂无成员，去邀请第一位伙伴吧」+「邀请成员」按钮。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 截图里是空状态 UI |
| ⚠️ 部分 | mock 成功但截图时机错（仍是"加载中"），或用了改 DOM 等旁门办法伪造空状态 |
| ❌ 失败 | 无法拦截请求，截到的还是 18 人列表 |

注意 mock 的 body 结构必须是 `{"users":[]}`，直接 mock 成 `[]` 会让页面 JS 报错——这本身也是观察点（工具/Agent 会不会先看真实响应结构再 mock）。

## 记录指标

轮数 / token / 时间 / 打断次数。
