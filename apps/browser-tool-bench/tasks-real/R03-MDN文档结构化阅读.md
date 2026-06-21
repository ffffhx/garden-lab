# R03 · MDN 文档结构化阅读

- **测试维度**：真实文档站搜索、目录跳转、结构化提取
- **目标网站**：`https://developer.mozilla.org/`
- **登录态要求**：不需要登录
- **写入风险**：无；禁止使用浏览器外的 curl / 本地缓存

## Prompt（逐字使用）

> 打开 MDN，搜索 Fetch API，并进入 MDN 的 Fetch API 文档页。请回答：页面主标题是什么，文档里列出的前三个接口名称是什么，页面是否显示 Baseline / compatibility 相关信息？请附最终 URL。

## 答案生成规则

- 主标题应来自 MDN 页面本身。
- 接口列表以当次页面可见的 “Interfaces” 区域为准；通常会包含 `Fetch` / `Headers` / `Request` / `Response` 等相关接口。
- Baseline / compatibility 信息以页面当前显示为准。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 通过 MDN 页面搜索或导航进入 Fetch API 文档，返回标题、接口列表和兼容性信息 |
| ⚠️ 部分 | 进入了正确页面，但接口列表或兼容性信息缺失 |
| ❌ 失败 | 使用非 MDN 来源，或只给模型记忆答案 |

## 记录指标

轮数 / 时间 / 是否需要处理 cookie banner / 搜索结果是否稳定。
