# 正式对比补充轮：playwright-cli 0.1.14（2026-06-12）

## 方法

与 ab vs MCP 轮完全一致：每 cell 一个独立 `claude -p` session（claude-fable-5），任务卡 prompt 逐字使用 + 工具限定 + 25 条止损线，cell 间重启靶场、`playwright-cli close && delete-data` 清状态。版本：@playwright/cli 0.1.14（npm latest），引擎复用本机 Chrome 148。

## 结果

cell 格式：`判定 · 操作数 · turns · 墙钟 · 成本`

| 任务 | playwright-cli 0.1.14 |
| --- | --- |
| T01 登录读工号 | ✅ · 8 · 7 · 69s · $0.61 |
| T02 Network 排障 | ✅ · 11 · 10 · 80s · $0.75 |
| T03 性能诊断 | ✅ · 10 · 11 · 145s · $1.04 |
| T04 请求 mock | ✅ · 10 · 12 · 110s · $0.83 |
| T05 动态等待 | ✅ · 6 · 7 · 69s · $0.62 |
| T06 结构化提取 | ✅ · 7 · 8 · 72s · $0.70 |
| T07 已登录 fetch | ✅ · 8 · 7 · 70s · $0.62 |
| T08 Shadow DOM | ✅ · 10 · 12 · 108s · $0.91 |
| **合计** | **8/8 ✅ · 70 · 74 · 12.1min · $6.08** |

8 个 cell 的"卡点"栏全部为"无"（T08 仅一处小绕行：eval 读 main.innerText 拿不到 shadow 内文本，改用快照确认）。**全程零 eval 自救**——是四个工具里唯一做到的。

## 三轮横向对照（8 任务，同宿主 claude -p）

| 指标 | agent-browser 0.27.2 | DevTools MCP 1.2.0 | playwright-cli 0.1.14 |
| --- | --- | --- | --- |
| 判定 | 8/8 ✅ | 7✅+1⚠️ | 8/8 ✅ |
| 操作数 | 94 | 48 | 70 |
| turns | 95 | 72 | 74 |
| 墙钟 | 14.5min | 11.1min | 12.1min |
| 成本 | $8.21 | $7.43 | **$6.08** |
| eval 自救次数 | 1（T08 读 shadow 文本） | 3（T03 辅助/T04 mock/T06 等待） | **0** |

## 核心发现

### 1. actionability 假设被证实——T05 一次通过

agent-browser 在 T05 暴露过"按钮中心在视口外 3px、click 静默假成功"的坑（subagent 多花 16 条命令自查坐标）。playwright-cli 同一个按钮 `click e18` 首次即生效：Playwright 引擎的 actionability 检查（点击前自动滚动到可视区、等待可交互）在 CLI 层完整保留。这是它与 agent-browser 在动作可靠性上的实质差异。

### 2. 能力覆盖面是四个工具里最全的

- 网络层 mock：有原生 `route`（T04 ✅，与 agent-browser 并列，优于 MCP/bb 的 JS 层补丁）
- 响应体：`requests` + `response-body <n>` 两步直达（T02 零摩擦，没有 ab 的 `--json` 暗坑）
- 性能：无 insight 模型，但 Perf API + `response-body` 读源码的组合 145s 完赛，结论与另两工具一致（第三次独立确认 blocking.css 主因），还补了一句"修复 CSS/JS 后 hero.svg 会成为新瓶颈"
- Shadow DOM：快照穿透 + click 原生生效（与 MCP 同级，优于 ab 的文本读取摩擦）
- 状态持久化：state-save/load、cookie/localStorage 全套命令（本轮未考）

### 3. 一个独特设计：快照落盘复用

快照自动写到 `.playwright-cli/page-*.yml`，subagent 多次用 `cat` 重读旧快照而不重新抓取——"观察结果可以离线复用"减少了浏览器往返。这是 agent-browser（每次快照重新生成 ref）没有的设计。

### 4. T04 的小瑕疵与靶场修正

它把 body mock 成 `[]` 而非真实结构 `{"users":[]}`，没先看真实响应——靠页面解构容错（`users` 为 undefined → 空状态）碰巧全对。任务卡原注"mock 成 [] 会让页面 JS 报错"经核实不成立（解构不抛错），已属任务卡需修正的第二处。严格说 agent-browser/MCP 在此任务先验证了响应结构，流程更稳。

### 5. 对文章的影响

文章第 1 节"Playwright 更偏工程师脚本，Agent 要自己写 selector、等待和分析逻辑"已过时：playwright-cli 把 snapshot/ref/auto-wait 全部补齐，且综合成绩（全对 + 最低成本 + 零自救）是本靶场目前的最佳全能选手。文章的工具选型表应增加 playwright-cli 行，并把"写长期回归测试才选 Playwright"的定位扩展为"Agent 日常操作也是第一梯队"。

## 原始数据

本目录：`T0X-pw.json`（claude -p 完整输出）、`prompts/`、`run-cell.sh`、`pw-T04.png`（已人工复核为空状态）。
