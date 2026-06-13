# 正式对比：agent-browser 0.27.2 vs bb-browser 0.14.2（2026-06-12）

## 方法

- 每个 cell（任务 × 工具）由一个**独立 subagent**（Claude Code general-purpose agent，Fable 5，全新上下文）执行，**不知道 ground truth**，prompt 为任务卡原文 + 工具限定 + 约 25 条命令止损线。
- 工具是唯一变量；禁止 curl/WebFetch 旁路；允许查工具自带帮助（两边对称）。
- 每个 cell 之间重启靶场服务（清 session）、重置浏览器会话。任务内两工具执行顺序逐任务轮换。
- 指标来自 harness 计数（tool_uses、subagent_tokens、duration），CLI 命令数来自 subagent 自报清单（与轮数交叉校验）。
- 每 cell 跑 1 次；T03/T09/T10 不在本轮范围。

环境披露：bb-browser 环境预置到可用基线（Chrome + daemon 已启动），且 prompt 中告知"每条命令必须带 --port 19333"（不带必失败，属本机历史遗留 + CLI 端口不持久化）。环境自举成本未计入本轮，参考 pilot 数据（约 13 条命令）。agent-browser 零预置零提示。

## 结果矩阵（按任务卡标准判定）

cell 格式：`判定 · CLI命令数 · 轮数 · tokens · 耗时`

| 任务 | agent-browser 0.27.2 | bb-browser 0.14.2 |
| --- | --- | --- |
| T01 登录读工号 | ✅ · 9 · 4 · 17.4k · 40s | ✅* · 35 · 18 · 24.3k · 199s |
| T02 Network 排障 | ✅ · 15 · 11 · 26.1k · 86s | ✅* · 61 · 33 · 33.5k · 386s |
| T04 请求 mock | ✅ · 16 · 13 · 25.1k · 97s | ⚠️* · 13 · 11 · 32.6k · 152s |
| T05 动态等待 | ✅ · 26 · 16 · 28.8k · 141s | ✅* · 19 · 15 · 22.2k · 153s |
| T06 结构化提取 | ✅ · 10 · 10 · 27.6k · 72s | ✅* · 13 · 11 · 25.4k · 101s |
| T07 已登录 fetch | ✅ · 10 · 7 · 24.1k · 57s | ✅* · 44 · 24 · 26.4k · 255s |
| T08 Shadow DOM | ✅ · 18 · 12 · 27.6k · 102s | ✅* · 50 · 28 · 31.2k · 331s |
| **合计** | **7/7 ✅ · 104 条 · 73 轮 · 176.6k · 9.9min** | **6✅+1⚠️ · 235 条 · 140 轮 · 195.7k · 26.3min** |

`*` = 该 cell 依赖 `eval` 绕过失效的原生 UI 原语才完成（bb-browser 7/7 全部带星）。
T04×bb 的 ⚠️：工具无网络层 mock 能力，subagent 改在页面里 monkey-patch `window.fetch` 并重执行页面加载脚本——空状态是页面自身逻辑渲染的（未伪造 DOM），但 mock 不在网络层、刷新即失效。

## 成本对比（bb / ab 倍数）

| 指标 | agent-browser | bb-browser | 倍数 |
| --- | --- | --- | --- |
| CLI 命令 | 104 | 235 | 2.3× |
| Agent 轮数 | 73 | 140 | 1.9× |
| tokens | 176.6k | 195.7k | 1.1× |
| 墙钟时间 | 9.9 min | 26.3 min | 2.7× |

tokens 倍数远低于命令倍数，因为 bb 单条输出小；但轮数和时间的差距真实反映了 Agent 的"挣扎程度"。

## 核心发现

### 1. bb-browser 的合成事件 bug 被无偏复现 6 次，是全部成本差的来源

4 个登录场景 + 翻页按钮 + Shadow 按钮，每个 subagent 都在不知情的前提下独立撞上"`click`/`press Enter` 报告成功但页面事件监听器不触发"（fill 写值正常）。每个 subagent 也都独立收敛到同一个解法：`eval` 调 `form.requestSubmit()` / `el.click()`。趋同的自救路径说明这是工具层缺陷而非 Agent 波动。附带 bug：先 `fill` 后 `type` 会叠加成重复值（2 次复现）、`get value` 永远返回空（3 次复现）。

### 2. agent-browser 也有一个危险的静默失败：视口外点击

T05×ab 中，subagent 用 CSS selector 点击"加载更多"，按钮中心点在视口下沿外 3px——**click 报告成功但什么都没发生**，连续两次。subagent 自己查出坐标问题并用 `scrollintoview` 修复，多花约 16 条命令。这说明 ab 的 click 没有 Playwright 式的 actionability 检查（自动滚动到可视区）。值得注意：我在 pilot 里用快照 ref 点击就没踩这个坑——**ref 路径和 selector 路径的可靠性不一样**，而 subagent 不一定选 ref 路径。

### 3. 答案正确率两边都是 7/7，差距全在过程成本

两个工具下 subagent 都拿到了全部正确答案（BENCH-7341 / 500+INSUFFICIENT_INVENTORY / 空状态截图 / 12+LIVE-512 / 雷霆工作站 15999 / team-pro-2026 / SHADOW-99）。模型够强时，工具缺陷表现为 token 和时间的倍数，而不是失败——但这依赖"eval 这个万能后门存在"。如果某个工具连 eval 都没有，缺陷就会直接变成失败。

### 4. 文档引导价值可测量

所有 ab subagent 第一条命令都是 `agent-browser skills get core`，1 条命令换来标准的 snapshot→ref→wait 工作流；bb 只有 `--help`，subagent 在等待（盲 sleep）、取文本（`get text` 需要 ref 的报错）上反复试错。"工具自带可拉取的深度文档"是 Agent 友好度的实际组成部分。

### 5. 与 pilot 的对照

- bb click bug、`network request --json` 摩擦、trace 重放成本：pilot 发现，正式轮全部无偏复现 ✅
- pilot 未发现的新坑：ab 视口外静默点击失败（pilot 中我走 ref 路径避开了）
- pilot 的 agent-browser 命令数普遍更少（如 T05：6 vs 26）：知道答案的操作者会走最短路径，**无偏 Agent 的真实成本比熟练者高 2-4 倍**——这正是需要正式轮的原因。

## 结论（对应文章断言）

1. "agent-browser 适合 Agent 长轮次自动化"：**成立**，7/7 全绿、零 eval 依赖、总成本约为 bb 的一半以下。
2. "bb-browser 通用浏览器操作可用"：**当前版本不成立**。0.14.2 的合成事件层是坏的，等于只有"观察 + eval"两条腿；其 trace 因果链（request→trigger action）仍是独有亮点。文章第 3 节的 `bb-browser network route` 描述与 0.14.2 不符，需修订。
3. 两个工具的"快照 + 编号引用"在 open Shadow DOM 上都能看见元素；差异在动作层。

## 原始数据

- 每 cell 的 subagent 完整命令清单见本目录 `cells.md`（由 subagent 自报，含卡点自述）。
- 截图：`ab-T04.png`、`bb-T04.png`（均人工复核为空状态）。
- 版本：agent-browser 0.27.2 / bb-browser 0.14.2 / Chrome 149.0.7827.103（bb 受管实例）与 HeadlessChrome 149（ab）/ 模型 claude-fable-5。
