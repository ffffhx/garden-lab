# R09 · 真实网站 HAR 与性能快照

- **测试维度**：真实网站瀑布图、HAR / trace / performance 证据、资源瓶颈解释
- **目标网站**：`https://ffffhx.github.io/garden-lab/post/agent/`
- **登录态要求**：不需要登录
- **写入风险**：无

## Prompt（逐字使用）

> 打开 https://ffffhx.github.io/garden-lab/post/agent/ ，记录一次页面加载的 Network / HAR / trace 或 performance 证据。请告诉我本次加载里最慢的 3 个资源 URL、各自耗时或等待时间、资源类型，以及你判断它们是否影响首屏体验的理由。请附观察时间和最终 URL。

## 答案生成规则

- 资源耗时会随网络波动变化，以当次 trace / HAR / Network 证据为准。
- 成功答案必须区分“最慢资源”和“影响首屏的关键资源”，不能只按 duration 排名。
- 如果工具没有 HAR / trace 导出，但能提供 Network 列表和 timing，也可判成功。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 留下 Network / HAR / trace / performance 证据，列出最慢 3 个资源并解释首屏影响 |
| ⚠️ 部分 | 只有资源列表，没有 timing 或首屏影响判断 |
| ❌ 失败 | 只能截图或复述页面内容，拿不到加载证据 |

## 记录指标

轮数 / 时间 / 是否能导出 HAR 或 trace / 是否能分页查看 network entries / 是否能保存证据文件。
