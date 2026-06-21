# R01 · GitHub 公共仓库代码导航

- **测试维度**：真实 SPA、仓库代码导航、站内搜索、URL / breadcrumb 证据
- **目标网站**：`https://github.com/microsoft/playwright`
- **登录态要求**：不需要登录
- **写入风险**：禁止 star、fork、watch、评论、创建 issue / PR

## Prompt（逐字使用）

> 打开 https://github.com/microsoft/playwright ，不要使用终端、curl 或直接读本地源码。请只通过浏览器在 GitHub 页面里找到 Playwright 文档里描述 actionability checks 的文件或页面，并回答：这个页面/文件的标题是什么，Locator.click 在表格里需要通过哪些 actionability checks？请附上你最终停留的 URL。

## 答案生成规则

- 目标应落在 Playwright 官方仓库或官方文档中的 actionability 说明。
- `Locator.click` 至少应包含 `Visible`、`Stable`、`Receives Events`、`Enabled` 这几个检查项；若 GitHub / 文档页面改版，以当次页面表格为准。
- 必须给出最终 URL 与页面证据，不能只凭模型记忆作答。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 通过浏览器页面定位到官方说明，答出 `Locator.click` 的 actionability checks，并附 URL |
| ⚠️ 部分 | 答案基本对，但没有 URL / 页面证据，或依赖搜索引擎摘要 |
| ❌ 失败 | 未进入 GitHub / 官方文档页面，或使用本地源码 / curl 绕过浏览器 |

## 记录指标

轮数 / 时间 / 是否需要站内搜索 / 是否遇到 GitHub SPA loading 或代码搜索限制。
