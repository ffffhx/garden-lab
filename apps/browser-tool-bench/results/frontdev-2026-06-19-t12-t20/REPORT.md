# T12-T20 前端开发者专项评测总报告

- 日期：2026-06-19
- 靶场：`http://localhost:4400/`
- 范围：新增任务 T12-T20
- 执行方式：每个工具一个独立 subagent，先按任务卡 Prompt 实操，再读 Ground Truth/判定标准核分
- 注意：任务卡 Prompt 仍写 `localhost:4399`；本轮因 4399 已被占用，按同路径使用 `localhost:4400`

## 判定口径

- `✅`：任务答案完整，且主要由该工具常规能力完成。
- `✅*`：答案完整，但依赖 eval、CDP 逃生舱或临时页面脚本补齐关键步骤。
- `⚠️`：能定位核心问题，但缺少题目要求的部分关键证据或确认码。
- `N-R`：当前工具运行时不可用，或该能力在当前工具上下文未暴露。

## 总览

| 工具 | T12-T20 结果 | 关键结论 | 子报告 |
| --- | --- | --- | --- |
| Chrome DevTools MCP 1.2.0 | 9/9 ✅ | 对 console、network、source map、SW、iframe、文件上传、键盘和等待型任务覆盖最完整；少数底层诊断会用 `evaluate_script`，但没有伪造业务结果。 | `devtools-mcp/REPORT.md` |
| playwright-cli 0.1.14 | 9/9 ✅ | 自动化稳定性最好，文件上传、键盘、iframe、等待完整；T13 为取确认码用了 `run-code` 临时解除遮挡。 | `playwright-cli/REPORT.md` |
| agent-browser 0.27.2 | 9/9 ✅，其中 7 题带 `*` | 连接 9223 后能完成全部答案；T17/T18 纯原语完成，但 console 展开、按钮 click、focus/keyboard 和部分等待任务需要 eval 补齐。 | `agent-browser/REPORT.md` |
| bb-browser 0.14.2 | 9/9 ✅* | bb 自管 Chrome 可通过 CDP 完成任务，但原生命令受 `127.0.0.1`/`[::1]` 端点漂移阻塞，本轮不应计为 native 成功。 | `bb-browser/REPORT.md` |
| Codex `@browser` | 5 ✅ / 3 ⚠️ / 1 N-R | DOM、iframe、SSE 完成态、可访问性和表格统计可用；raw asset/source map、SW live bypass、文件上传能力不足。 | `browser/REPORT.md` |
| Codex `@chrome` | 9 N-R | Chrome 与 Native Host 存在，但 selected profile 中 Codex Chrome Extension 处于 disabled，runtime 不可用；未代跑。 | `chrome/REPORT.md` |

## 任务矩阵

| 任务 | @chrome | @browser | agent-browser | bb-browser | DevTools MCP | playwright-cli |
| --- | --- | --- | --- | --- | --- | --- |
| T12 Console 与 SourceMap 定位 | N-R | ⚠️ | ✅* | ✅* | ✅ | ✅ |
| T13 移动端布局遮挡 | N-R | ⚠️ | ✅* | ✅* | ✅* | ✅* |
| T14 SPA 状态 / Hydration 不一致 | N-R | ✅ | ✅* | ✅* | ✅ | ✅ |
| T15 SSE 实时流等待 | N-R | ✅ | ✅* | ✅* | ✅ | ✅ |
| T16 Service Worker 缓存排障 | N-R | ⚠️ | ✅* | ✅* | ✅ | ✅ |
| T17 跨域 iframe 授权 | N-R | ✅ | ✅ | ✅* | ✅ | ✅ |
| T18 文件上传与拖拽输入 | N-R | N-R | ✅ | ✅* | ✅ | ✅ |
| T19 键盘可访问性 | N-R | ✅ | ✅* | ✅* | ✅ | ✅ |
| T20 回归稳定性 / Flake Rate | N-R | ✅ | ✅* | ✅* | ✅ | ✅ |

## 最终结论

如果只从这组新增前端调试任务里推荐一款工具，首选 **Chrome DevTools MCP 1.2.0**。它在 T12-T20 全部完成，并且能力边界最贴近前端开发者日常排障：console、network、source map、Service Worker、iframe、file input、keyboard 都能落到可解释证据。

`playwright-cli 0.1.14` 是最接近的第二名，更适合把这些任务沉淀成可重复执行的自动化检查。它同样 9/9，但在遮挡任务里为了拿确认码用了脚本解除遮挡；从“调试工具”角度，DevTools MCP 的网络、控制台和页面运行时证据更自然。

`agent-browser 0.27.2` 适合需要复用常驻登录态、按自然浏览器流程操作的场景，本轮连接 9223 后答案全部正确；但若严格要求不用 eval，它在 T12/T14/T15/T19/T20 等任务上的原语能力还不够稳。

`@browser` 可以保留为轻量查看和普通交互工具，但它不适合作为完整前端调试评测工具。`bb-browser` 这轮因为本机端点漂移只能用 CDP 逃生，结论应标注环境问题。`@chrome` 当前 runtime 不可用，所以本轮不参与能力排名。
