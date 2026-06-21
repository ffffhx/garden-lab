# R07 · 真实网站 Network 响应体

- **测试维度**：真实 Network request 列表、响应体读取、页面与 JSON 元数据交叉验证
- **目标网站**：`https://www.npmjs.com/package/@playwright/test`
- **登录态要求**：不需要登录
- **写入风险**：无；禁止使用终端 curl、npm CLI 或本地缓存

## Prompt（逐字使用）

> 打开 https://www.npmjs.com/package/@playwright/test ，重新加载页面并观察浏览器 Network。请找出一个用于提供这个包元数据的真实网络请求，告诉我请求 URL、HTTP 状态码、content-type、响应体里显示的 package name 和 version，并说明它是否和页面上显示的版本一致。

## 答案生成规则

- 请求 URL 和版本号会随 npm 前端实现变化，以当次 Network 证据为准。
- 成功答案必须来自浏览器 Network 响应体，而不是页面可见文本、终端、npm CLI 或模型记忆。
- 如果页面实现变成纯 HTML 内联数据，也可以使用 document 响应体中的结构化数据，但必须说明证据来源。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 给出真实请求 URL、状态码、content-type、响应体 package name / version，并与页面版本交叉验证 |
| ⚠️ 部分 | 只能列出请求和状态码，但拿不到响应体 |
| ❌ 失败 | 只复述页面版本，或使用浏览器外请求绕过 Network |

## 记录指标

轮数 / 时间 / 是否需要点击前预先开启 Network / 是否能事后读取响应体 / 是否需要重放页面。
