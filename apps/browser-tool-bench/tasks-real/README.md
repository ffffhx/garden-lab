# 真实网站外场任务 R01-R09

这组任务不是替代 `tasks/T01-T20` 的靶场基准，而是补一层真实网站外场测试。

靶场回答的是“能力边界能否被稳定复现”；外场回答的是“同样能力放到真实网站、真实登录态、真实网络波动里会不会好用”。因此外场结果不直接混进 T01-T20 总分，必须带上观察日期、目标 URL、profile、登录态和证据。

## 安全规则

1. 只做只读操作；不得购买、提交业务表单、安装扩展、授权 OAuth、删除内容、标记通知已读或改变账号状态。
2. 需要真实登录态的任务只允许使用专用调试 profile；不要接管日常主 profile。
3. 记录执行时间、最终 URL、工具版本、浏览器版本、CDP 端口和截图 / network / trace 证据。
4. 外部网站会变，Ground Truth 使用“答案生成规则 + 当次证据”，不把动态数字写死成长期标准答案。
5. 工具为完成任务使用 `eval`、CDP 逃生、外部脚本或手动强开 target 时必须标 `*`，并写明原因。

## 评分口径

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 在不写入真实网站状态的前提下完成目标，并留下可复查证据 |
| ⚠️ 部分 | 完成主要观察，但关键证据缺失；或依赖明显逃生路径 |
| ❌ 失败 | 无法完成目标，或必须修改真实账号 / 网站状态才能推进 |
| N-R | 当前工具或当前 profile 不暴露该能力，未运行 |

## 任务索引

| 任务 | 真实目标 | 核心维度 |
| --- | --- | --- |
| R01 GitHub 公共仓库代码导航 | `github.com/microsoft/playwright` | 真实 SPA、代码导航、站内搜索 |
| R02 GitHub 登录态只读通知 | `github.com/notifications` | 真实 profile、只读登录态、账号状态风险 |
| R03 MDN 文档结构化阅读 | `developer.mozilla.org` | 文档搜索、结构化提取、真实页面语义 |
| R04 npm 包页面元数据 | `npmjs.com/package/@playwright/test` | 动态页面、元数据提取、页面与网络证据交叉 |
| R05 Chrome Web Store 扩展详情 | Chrome Web Store | 插件生态、商店页限制、只读扩展信息 |
| R06 扩展注入真实网站 | 线上 Garden Lab 文章 | 插件 content script、options 页、真实页面注入 |
| R07 真实网站 Network 响应体 | npm 包页面 | Network request 列表、响应体、动态 JSON |
| R08 真实网站请求拦截 | MDN 文档页 | route / abort / mock、资源降级验证 |
| R09 真实网站 HAR / 性能快照 | 线上 Garden Lab 文章 | trace / HAR / 瀑布图、资源性能证据 |
