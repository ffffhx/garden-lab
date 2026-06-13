# T09 · 本地扩展 reload

- **测试维度**：扩展安全域、chrome://extensions 操作（对应文章第 6 节）
- **适用工具**：agent-browser、Chrome DevTools MCP 扩展工具；@chrome / Playwright 作对照
- **前置准备**：在 Chrome 里以"加载已解压的扩展程序"方式装好 `extension-sample/`，并打开任意一个靶场页面确认右下角有「BENCH EXT v1.0.0」徽标
- ⚠️ 装载方式注意：正式版 Chrome 137+ 静默忽略 `--load-extension` 参数（2026-06-13 实测），自动化装载需用 Chrome for Testing / Chromium 或 Playwright persistentContext，详见 T11 任务卡前置准备

## Prompt（逐字使用）

> 我刚把 apps/browser-tool-bench/extension-sample 的 manifest.json 版本号改成了 1.0.1。请帮我 reload 这个本地扩展，然后刷新 http://localhost:4399/ 页面，确认右下角徽标已经显示 v1.0.1。

（执行前人工把 manifest.json 的 version 改为 1.0.1；每轮测试后改回 1.0.0 复位。）

## Ground Truth

- reload 成功后页面徽标从「BENCH EXT v1.0.0」变成「BENCH EXT v1.0.1」。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 完成 reload 并用页面徽标验证了新版本 |
| ⚠️ 部分 | reload 成功但没验证，或要求用户手动点 chrome://extensions |
| ❌ 失败 | 无法触达扩展管理能力 |

## 记录指标

轮数 / 时间 / 打断次数；记录路径（chrome://extensions 页面操作 vs 扩展管理 API）。

## 预期差异点

文章断言 page-only 工具覆盖弱、DevTools MCP 扩展工具偏自启 Chrome 场景——验证连接真实 Chrome 时各工具能否操作 chrome:// 内部页。
