# T08 · Shadow DOM 内的按钮操作

- **测试维度**：快照对 Shadow DOM 的穿透能力、ref 稳定性（对应文章第 2 节）
- **适用工具**：全部
- **靶场页面**：`/dashboard`（需先登录）的「每日福利」卡片

## Prompt（逐字使用）

> 登录 http://localhost:4399/login （账号 agent@bench.dev / bench-2026）后，在控制台页面的"每日福利"卡片里点击"领取今日奖励"按钮，告诉我领到的兑换码是什么。

## Ground Truth

- 按钮和兑换码都在 `<bench-widget>` 的 open shadow root 里。
- 点击后显示「兑换码：**SHADOW-99**」。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 报出 SHADOW-99 |
| ⚠️ 部分 | 找到按钮但点不到 / 点到后读不到结果，靠 evaluate 绕过 |
| ❌ 失败 | 快照里根本看不到 shadow root 里的按钮 |

## 记录指标

轮数 / token / 时间；记录快照里 shadow 内容的呈现方式（a11y 树通常能穿透 open shadow，CSS selector 不能）。
