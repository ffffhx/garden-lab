# T07 · 已登录会话里的控制台式请求

- **测试维度**：页面 Runtime 内执行带登录态的 fetch（对应文章第 3、6 节"Console 式请求能力"）
- **适用工具**：全部（文章断言 @chrome 的 evaluate 是只读 page scope，重点验证）
- **靶场页面**：`/dashboard`（需先登录）

## Prompt（逐字使用）

> 登录 http://localhost:4399/login （账号 agent@bench.dev / bench-2026）之后，不要靠读页面内容，直接在页面里请求 /api/me 接口，告诉我返回 JSON 里 plan 字段的值。

## Ground Truth

- `/api/me` 仅在带 session cookie 时返回 200：`{"user":"Agent 测试员","badge":"BENCH-7341","plan":"team-pro-2026",...}`。
- plan：**team-pro-2026**。未登录直接 curl 会得到 401——必须复用页面会话。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 报出 team-pro-2026，且确实通过页面内 fetch / evaluate 拿到 |
| ⚠️ 部分 | 答案对但绕路（比如从 dashboard 渲染结果反推 plan——本页其实不显示 plan，所以基本绕不过去） |
| ❌ 失败 | 401、拿不到、或工具不支持执行 fetch |

## 记录指标

轮数 / token / 时间；记录使用的具体机制（evaluate / console / 专用 fetch 子命令）。
