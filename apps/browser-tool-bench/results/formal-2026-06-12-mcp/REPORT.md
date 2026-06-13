# 正式对比：agent-browser 0.27.2 vs Chrome DevTools MCP 1.2.0（2026-06-12）

## 方法

- 每个 cell 一个**完全独立的 Claude Code 无头 session**（`claude -p`，模型 claude-fable-5），不知道 ground truth，prompt 为任务卡原文 + 工具限定 + 约 25 次操作止损线。
- 与上一轮（ab vs bb，Agent tool subagent）相比，本轮宿主改为 `claude -p`：因为 MCP server 只能在 session 启动时挂载，subagent 接不到。**两列都跑在同一宿主下**，agent-browser 列为同日重跑（顺带获得轮间方差数据）。
- DevTools MCP 通过 `--mcp-config` 挂载 `chrome-devtools-mcp@1.2.0`（自管 Chrome，持久 profile），`--strict-mcp-config` 隔离其他 MCP；agent-browser cell 仅允许 Bash。两边都禁止 curl/WebFetch 旁路。
- 每 cell 之间重启靶场（清 session）并清理对应浏览器状态。任务集为 T01-T08 全部 8 个（**本轮加入 T03 性能诊断**——DevTools MCP 的主场任务）。
- 指标：操作数（subagent 自报清单）/ turns（num_turns）/ 墙钟 / 成本（total_cost_usd）。

环境：macOS / Chrome 149（MCP 自管）+ HeadlessChrome 149（ab）/ claude CLI 2.1.175（经用户的 Clash 代理封装，NO_PROXY 含 localhost，靶场流量不走代理）。

## 结果矩阵

cell 格式：`判定 · 操作数 · turns · 墙钟 · 成本`

| 任务 | agent-browser 0.27.2 | Chrome DevTools MCP 1.2.0 |
| --- | --- | --- |
| T01 登录读工号 | ✅ · 9 · 8 · 58s · $0.72 | ✅ · 5 · 8 · 59s · $0.78 |
| T02 Network 排障 | ✅ · 16 · 12 · 101s · $0.96 | ✅ · 8 · 11 · 93s · $0.96 |
| T03 性能诊断 | ✅ · 11+本地解析 · 15 · 215s · $1.62 | ✅ · 6 · 9 · 111s · $1.08 |
| T04 请求 mock | ✅ · 9 · 14 · 136s · $1.09 | ⚠️ · 10 · 14 · 146s · $1.34 |
| T05 动态等待 | ✅ · 13 · 12 · 91s · $0.96 | ✅ · 4 · 8 · 70s · $0.84 |
| T06 结构化提取 | ✅ · 9 · 11 · 89s · $0.95 | ✅ · 4 · 6 · 54s · $0.77 |
| T07 已登录 fetch | ✅ · 10 · 8 · 66s · $0.73 | ✅ · 5 · 7 · 64s · $0.78 |
| T08 Shadow DOM | ✅ · 17 · 15 · 111s · $1.19 | ✅ · 6 · 9 · 70s · $0.88 |
| **合计** | **8/8 ✅ · 94 · 95 · 14.5min · $8.21** | **7✅+1⚠️ · 48 · 72 · 11.1min · $7.43** |

T04×MCP 的 ⚠️：chrome-devtools-mcp 没有网络层 mock 工具，subagent 用 `navigate_page` 的 `initScript` 在页面脚本运行前补丁 fetch/XHR 完成了 JS 层 mock（比 bb-browser 的事后补丁更体面，但仍非网络层），另撞上 `take_screenshot` 不能写工作区外路径的限制，用 Bash mv 收尾。

## 核心发现

### 1. 两边全对，DevTools MCP 的操作效率约为 agent-browser 的 2 倍

答案正确率 8/8 vs 8/8（MCP 的 T04 方式打折）。差距在过程：MCP 总操作数 48 vs 94，时间 11.1 vs 14.5 分钟。效率来自三个高杠杆工具设计：
- `fill_form` 一次调用填多个字段（ab 要逐个 fill）；
- `wait_for(text)` 等待 + 确认合一，T05 整个任务只用 4 次调用；
- `click` 可顺带返回新快照（includeSnapshot），动作和复盘合一。

这验证了一个普适规律：**MCP 工具的"粗粒度组合动作"比 CLI 的"细粒度原语"更省轮次**——代价是灵活性。

### 2. T03 性能诊断：文章断言"DevTools MCP 更省解释成本"成立，但 agent-browser 比预期能打

- MCP：`performance_start_trace` + `performance_analyze_insight`（LCPBreakdown / RenderBlocking / NetworkDependencyTree）直接产出结构化归因，6 次调用、111 秒。诊断模型是现成的。
- ab：subagent 从 `skills get core --full` 自己挖到了 `profiler` 命令，导出 trace 后**用 python 本地解析** + Performance API 交叉验证，得出与 MCP 完全一致的结论——但花了 215 秒、$1.62（两边最贵 cell），diagnosis 是 Agent 自己推理出来的。
- 结论：两边都能到达终点，MCP 把"解释"内置在工具里，ab 把"解释"外包给模型。模型强时结论相同，弱模型下差距会放大。

### 3. 测试把靶场自己的 ground truth 修正了

两个独立 Agent 用不同方法一致证明：T03 任务卡原写的"hero.svg 是 LCP 主因"是错的。真实链路：blocking.css（1205ms TTFB，渲染阻塞 + 阻塞后续同步脚本）→ heavy.js（804ms 长任务）串行 ≈ 2.1s LCP；hero.svg 虽是最慢资源但并行加载、首绘前完成，是干扰项。任务卡已修正，并把"会不会被最慢资源带偏"升格为正式考点。**这是"用 Agent 验证 Agent 基建"的意外收获：测试工具的过程同时测出了测试设计的错误。**

### 4. T04 能力分界最清晰

agent-browser 是唯一有网络层 mock（`network route`）的：9 次操作干净完成。DevTools MCP 没有对应工具，靠 initScript 补丁达成效果。如果任务升级成"mock 一个非同源 API"或"abort 流量"，JS 层补丁就不够了——这条能力边界值得写进文章。

### 5. Shadow DOM：MCP 的 uid 体系全程无感知穿透

MCP 的 click(uid) 对 shadow 内按钮直接生效、快照直接读到兑换码，6 次调用零摩擦；ab 这轮在"读取 shadow 内文本"上花了 8 次额外操作（get text / snapshot -c 看不到，最终 eval shadowRoot）。对照上一轮 bb 的 click 全坏——三个工具在 shadow 上形成了"无感知 / 可用但有摩擦 / 不可用"的完整光谱。

### 6. agent-browser 轮间方差（同日两轮，不同宿主）

7 个共同任务：上一轮（Agent tool）104 条命令 / 9.9min，本轮（claude -p）83 条 / 10.9min——总量稳定。单 cell 方差最大的是 T05（26 条 → 13 条）：上轮 subagent 走 CSS selector 路径撞了视口外静默点击坑，本轮走 ref 路径完全避开。**工具的可靠性区间由"Agent 选哪条路径"决定，这种路径敏感性本身就是友好度的一部分。**

## 对文章断言的回答

| 断言 | 结果 |
| --- | --- |
| DevTools MCP 像 F12 一样排查 Network / 性能最顺手 | ✅ 成立，T02/T03 均为最低操作数；性能 insight 是独有优势 |
| agent-browser 适合 Agent 连续操作 + 看请求 | ✅ 成立，且被低估了——profiler/HAR 让它在性能任务也能完赛 |
| DevTools MCP "日常页面操作上下文效率取决于工具输出" | 实测页面操作效率反而是两者中最高（fill_form/wait_for/click+snapshot 的组合动作设计） |
| mock/route 类任务 DevTools MCP 合适 | ❌ 不成立，它没有网络层拦截工具，此项 agent-browser 独占 |

## 原始数据

本目录：`T0X-{ab,mcp}.json`（claude -p 完整输出，含 usage）、`prompts/`（16 个 cell 的逐字 prompt）、`run-cell.sh`（执行器）、`ab-T04.png` / `mcp-T04.png`（截图）。版本：agent-browser 0.27.2、chrome-devtools-mcp 1.2.0、claude CLI 2.1.175、模型 claude-fable-5。
