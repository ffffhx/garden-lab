# 统一成本评测 · 六工具 · 9223 优先 · 2026-06-21

本轮按用户要求顺序执行：每个工具一个独立 `gpt-5.5` / `xhigh` subagent，前一个工具完成后再启动下一个工具，避免上下文污染。浏览器优先连接 `http://127.0.0.1:9223`；用户中途放宽口径：`@chrome` 无法证明 9223 时可用系统默认 Profile，`@browser` / `playwright-cli` 无法证明 9223 时可用自身 fallback。

## 口径说明

- 仓库当前真实外场任务只有 `R01-R09`，没有 `R10`，本轮没有编造 R10。
- 仓库当前实际结果单元为 31 格：`T01-T20` 中 `T10` 拆为 `T10a/T10b/T10c` 三张卡，共 22 格；外场 `R01-R09` 共 9 格。
- `⚠️` 表示部分完成或必须注明能力降级；`N-R` 表示运行时不可用或能力未暴露；`N/A` 表示任务不适用于该工具 / 当前口径。
- `escapes` = eval 自救、CDP 逃生、initScript 或临时页面脚本。读数据型 eval 与代操作型 eval 都单独列出。
- `tokens/cost`：本轮 subagent 运行环境没有暴露逐 agent token / dollar cost，均记 `unavailable`，不做臆测。

## 总表

| 工具 | 浏览器模式 | 9223 命中 | 31 格结果 | 实际耗时 | token/cost | tool_calls | browserOps | escapes 总数 | escape 分解 |
| --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- |
| `@chrome` | default Profile fallback | ❌ 未证明 | 13✅ / 5⚠️ / 10❌ / 2 N-R / 1 N/A | 9.5 min | unavailable | 55 | 221 | 36 | read 34 / action 2 / CDP 0 / init 0 |
| `@browser` | in-app browser | ❌ 未证明 | 12✅ / 5⚠️ / 8❌ / 5 N-R / 1 N/A | 12.7 min | unavailable | 40 | 226 | 104 | read 103 / action 1 / CDP 0 / init 0 |
| `agent-browser` | CDP 9223 | ✅ | 28✅ / 2⚠️ / 0❌ / 0 N-R / 1 N/A | 25.0 min | unavailable | 326 | 259 | 30 | read 17 / action 13 / CDP 0 / init 0 |
| `bb-browser` | CDP 9223 | ✅ | 20✅ / 1⚠️ / 7❌ / 1 N-R / 2 N/A | 21.6 min | unavailable | 221 | 184 | 67 | read 49 / action 18 / CDP 0 / init 0 |
| `Chrome DevTools MCP` | CDP 9223 | ✅ | 27✅ / 1⚠️ / 0❌ / 1 N-R / 2 N/A | 4.0 min（自报，疑似低估） | unavailable | 318 | 291 | 34 | read 30 / action 3 / CDP 0 / init 1 |
| `playwright-cli` | CDP 9223 | ✅ | 30✅ / 0⚠️ / 0❌ / 0 N-R / 1 N/A | 25.0 min | unavailable | 82 | 23 | 34 | read 29 / action 4 / CDP 0 / init 1 |

## 关键观察

1. `playwright-cli` 本轮成功 attach 9223，并用唯一 URL 在 `/json/list` 证明命中；这是和早期外场 attach 崩溃不同的新结果。31 格里唯一 `N/A` 是 `T10b`，因为严格 9223 下没有预存的 playwright-cli 专用 GitHub state，不能拿自管 profile 替代。
2. `agent-browser` 也稳定命中 9223，结果接近满格：28✅ + 2⚠️ + 1 N/A。它的 `tool_calls` 多，主要是 CLI 粒度细和若干点击需要 eval action 自救。
3. `Chrome DevTools MCP` 结果强，但 4.0 分钟耗时不应和其他工具直接横比。它的 summary 里写明有 targeted 补跑、额外 probe 估算和 final manual result correction；因此该耗时更像子代理自报的局部墙钟/估算值，而不是完整干净跑完 31 格的端到端耗时。它的 `R08` 仍是 `N-R`，因为当前 MCP 没有运行时 route/abort/block URL 一等能力；`T18` 为 ⚠️，原因是上传后需要 eval/DataTransfer 逃生触发页面解析。
4. `bb-browser` 能证明命中 9223，但结果明显受原语限制影响：7❌ + 1 N-R + 2 N/A，且 eval action 较多。
5. `@chrome` 和 `@browser` 都没有证明命中 9223。本轮按用户放宽后的 fallback 继续跑：`@chrome` 用系统默认 Profile，`@browser` 用 in-app browser。因此它们的真实登录态、扩展、指定 9223 profile 相关任务不可直接和 9223 工具同口径比较。
6. `@browser` 的 eval_read 数最高，是因为 in-app browser 主要靠只读 evaluate 做 DOM/文本提取；这不是 raw CDP 能力。

## 文件索引

| 工具 | 报告 | summary |
| --- | --- | --- |
| `@chrome` | `chrome/REPORT.md` | `chrome/summary.json` |
| `@browser` | `browser/REPORT.md` | `browser/summary.json` |
| `agent-browser` | `agent-browser/REPORT.md` | `agent-browser/summary.json` |
| `bb-browser` | `bb-browser/REPORT.md` | `bb-browser/summary.json` |
| `Chrome DevTools MCP` | `devtools-mcp/REPORT.md` | `devtools-mcp/summary.json` |
| `playwright-cli` | `playwright-cli/REPORT.md` | `playwright-cli/summary.json` |
| `@chrome` 严格 9223 预检 | `chrome-strict-9223-preflight/REPORT.md` | `chrome-strict-9223-preflight/summary.json` |

## 状态恢复

- 各 subagent 均声明 Bench Badge 最终恢复为 `BENCH EXT v1.0.0`。
- `apps/browser-tool-bench/extension-sample/manifest.json` 在本轮前已是脏文件；各 subagent 没有回滚既有改动，只确认 version 字段恢复为 `1.0.0`。
- `playwright-cli` 已从 9223 detach，没有关闭用户的常驻 Chrome。
