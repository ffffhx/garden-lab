# Pilot Run：agent-browser vs bb-browser（2026-06-12）

## 测试性质声明

这是一轮 **pilot（试跑）**，与正式方法论有三处偏差，解读结论时注意：

1. Agent（Claude Code / Fable 5）在同一个 session 里连续跑两个工具，且**预先知道 ground truth**——成功率指标偏乐观，但"能力有无"类结论（能不能拿响应体、能不能 mock）不受影响。
2. agent-browser 中途从 0.27.0 升级到 0.27.2（T04 发现版本 bug 后），T01/T02 跑在 0.27.0，T04 之后跑在 0.27.2。
3. 命令数包含排障/绕路命令（如实记录，因为真实 Agent 也要付这些成本）。

环境：macOS / Chrome 149（bb-browser 受管实例）、HeadlessChrome 149（agent-browser）/ bb-browser 0.14.2 / 靶场 commit 见 git。

## 结果总览

cell 格式：`结果 · CLI 命令数 · 输出字节（≈context 成本）`

| 任务 | agent-browser 0.27.x | bb-browser 0.14.2 |
| --- | --- | --- |
| T01 登录与页面观察 | ✅ · 8 · 749B | ⚠️ · 31 · 3051B（UI 路径失败，eval 自救） |
| T02 Network 排障 | ✅ · 5 · 1464B | ✅ · 12 · 2820B（需 trace 重放） |
| T04 请求 mock | ✅(0.27.2) ❌(0.27.0) · 17 · 10KB | ❌ 无 route/mock 能力 |
| T05 动态等待 | ✅ · 6 · 1403B | ✅ · 3 · 324B（靠盲 sleep） |
| T06 结构化提取 | ✅ · 4 · 997B | ✅ · 2 · 952B |
| T07 已登录 fetch | ✅ · 6 · 133B | ✅ · 1 · 14B |
| T08 Shadow DOM | ✅ · 8 · 1773B | ⚠️ · 4 · 280B（eval 自救） |

T03（性能）、T09（扩展）、T10（真实登录态）本轮未跑。

## 核心发现

### 1. bb-browser 的 UI 事件注入在本靶场全程失效（最重要发现）

`bb-browser click` / `press Enter` 均报告成功，但页面的 JS 事件处理器（form submit、button click listener）从未触发；`fill` 正常。三个任务复现（T01 登录、T02 下单、T08 领奖），最终都靠 `eval "el.click()"` 自救。**bb-browser 在标准 SPA 交互上当前不可靠，等于只剩"只读观察 + eval 执行"两条腿。**
另外 `get value` 命令返回空（eval 可证值已填入），是第二个独立 bug。

### 2. agent-browser 0.27.0 的 network route mock 完全不生效，0.27.2 修复

同一条 `network route "**/api/users" --body '{"users":[]}'`，0.27.0 下页内 fetch 仍返回真实数据（页面渲染 18 人），升级 0.27.2 后立即生效（空状态截图成功）。**结论：对比这类工具必须把版本钉死，patch 版本差异足以翻转能力结论。**

### 3. 响应体获取：两边都能拿到，但成本结构不同

- agent-browser：被动记录，事后 `network request <id> --json` 直接拿 body（注意：不带 `--json` 只打印 URL，浪费一轮）。点击前不需要任何准备。
- bb-browser：`network requests` 能列请求但拿不到 body；body 必须 `trace start` → **重放动作** → `trace body <id>`。多一次重放成本。
- bb-browser 独有亮点：trace 时间线带因果关联（`request ... trigger:25` → seq 25 是 `click #order-btn`），"哪个动作引发哪个请求"这个信息 agent-browser 给不了。

### 4. 等待原语决定长流程的可靠性

agent-browser 的 `wait --text` 把 T05 的两段流式渲染完全消化；bb-browser 没有 wait 命令，只能盲 sleep（试跑里 sleep 拍对了所以命令数反而更少，但这是运气——sleep 短了就会数出 8 条的错误答案）。
agent-browser 的坑：`wait --url "**/dashboard"` glob 两次失败（一次 daemon busy、一次超时 25s），`wait --text` / `wait @ref` 可靠，建议避开 `--url`。

### 5. Shadow DOM：快照都能穿透，定位/等待原语都不能

两个工具的 a11y 快照都能看见 open shadow root 里的按钮。但 agent-browser 的 `find role/text` 和 `wait --text` 都不穿透 shadow（ref 点击可以）；bb-browser 则是 click 本身坏了。结论：**shadow 内容认准快照 ref，别用文本定位**。

### 6. 环境与会话成本

- agent-browser：开箱即用（自带 headless Chrome + daemon），0 配置。偶发 `os error 35`（daemon busy）瞬时错误 2 次，自动恢复。
- bb-browser：本机残留 OpenClaw relay 配置（cdpPort 18792 指向非 Chrome 进程），叠加端口锁竞争，花了 **13 条命令 + 手动拉 Chrome** 才跑通第一个任务；且 `--port` 不持久化，**每条命令都要带**。对 Agent 来说这是大量不可预期的排障轮次。

### 7. eval 是两边共同的"万能后门"

T06/T07 两个工具都靠 eval 一两条命令搞定（bb-browser T07 仅 14 字节输出）。差异在 eval 之外的原语质量：agent-browser 的快照/wait/route/network 形成闭环；bb-browser 当前更像"CDP eval 壳 + trace 时间线"。

## 对文章断言的回答（本轮范围内）

| 文章断言 | 验证结果 |
| --- | --- |
| agent-browser 快照短、ref 稳、适合长轮次自动化 | ✅ 成立（快照普遍 <1KB，全任务无一靠 eval 自救） |
| bb-browser 通用 Network 能力可用（route/mock） | ❌ 0.14.2 无 route 命令，文章该处需修正 |
| bb-browser 的价值在 site adapter 而非通用操作 | ✅ 间接成立（通用 UI 操作不可靠，靶场无 adapter 可用，全靠 eval） |
| "出错后能否复盘" | bb-browser trace 的 trigger 关联是亮点；agent-browser 的被动 network 记录是亮点 |

## 下一步

1. 文章第 3 节"bb-browser 怎么处理请求"中 `network route` 的描述与 0.14.2 实测不符，建议核对后修订或标注版本。
2. 正式测试时给两个工具各跑全新 Agent session（消除本轮的 ground-truth 污染），并补 T03/T09/T10。
3. bb-browser 的 click 失效值得单独定位（CDP Input.dispatchMouseEvent 坐标问题？），若是本机环境问题需排除后重测。

原始日志：本目录 `agent-browser/`、`bb-browser/` 下按 `T0X-NN-动作.txt` 编号，截图 2 张。
