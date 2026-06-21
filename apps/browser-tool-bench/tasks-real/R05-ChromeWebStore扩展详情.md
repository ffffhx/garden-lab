# R05 · Chrome Web Store 扩展详情

- **测试维度**：插件生态真实页面、Chrome Web Store 限制、只读扩展信息
- **目标网站**：`https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi`
- **登录态要求**：不需要登录
- **写入风险**：严禁点击安装、移除、评分、举报或登录

## Prompt（逐字使用）

> 打开 React Developer Tools 在 Chrome Web Store 的详情页： https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi 。不要安装扩展。请回答扩展 ID、名称、发布者、当前页面显示的评分或用户量信息，以及主按钮当前显示什么文案。请附最终 URL。

## Ground Truth

- 扩展 ID：`fmkadmapgofadopljbjfkapdkoienihi`。
- 名称应为 React Developer Tools。
- 评分、用户量、版本和按钮文案可能随账号、地区、Chrome 状态变化，以当次页面为准。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 在不安装扩展的前提下读取扩展 ID、名称、发布者和页面状态 |
| ⚠️ 部分 | 只读到 ID / 名称，未能读取页面状态或按钮文案 |
| ❌ 失败 | 点击安装 / 移除 / 登录，或无法打开 Web Store 页面 |

## 记录指标

轮数 / 时间 / 是否被 Chrome Web Store 特殊权限或浏览器类型限制 / 是否能截图留证。
