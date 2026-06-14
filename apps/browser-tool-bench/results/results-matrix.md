# 结果矩阵

cell 格式：`结果 · 轮数 · token · 打断`，例如 `✅ · 6轮 · 12k · 0`。每个 cell 至少 2 次取多数，争议时附运行记录。

> 数据来自 2026-06-12 两个正式轮：①ab vs bb（Agent tool subagent，`formal-2026-06-12/REPORT.md`），cell 格式 `判定 · CLI命令数 · 轮数 · tokens · 耗时`；②ab vs DevTools MCP（`claude -p` 独立 session，`formal-2026-06-12-mcp/REPORT.md`），cell 格式 `判定 · 操作数 · turns · 耗时 · 成本`。agent-browser 列展示第①轮数据（第②轮重跑总量一致：7 任务 83 条 / 10.9min，T03 为第②轮新增）。`*` = 依赖 eval 绕过失效的 UI 原语。

| 任务 | @chrome (Codex) | agent-browser 0.27.2 | bb-browser 0.14.2 | DevTools MCP 1.2.0 | playwright-cli 0.1.14 |
| --- | --- | --- | --- | --- | --- |
| T01 登录与页面观察 | | ✅ · 9 · 4 · 17.4k · 40s | ✅* · 35 · 18 · 24.3k · 199s | ✅ · 5 · 8 · 59s · $0.78 | ✅ · 8 · 7 · 69s · $0.61 |
| T02 Network 排障 | | ✅ · 15 · 11 · 26.1k · 86s | ✅* · 61 · 33 · 33.5k · 386s | ✅ · 8 · 11 · 93s · $0.96 | ✅ · 11 · 10 · 80s · $0.75 |
| T03 性能诊断 | | ✅ · 11+本地解析 · 15 · 215s（轮②） | 未跑 | ✅ · 6 · 9 · 111s · $1.08 | ✅ · 10 · 11 · 145s · $1.04 |
| T04 请求 mock | | ✅ · 16 · 13 · 25.1k · 97s | ⚠️* JS 层 mock · 13 · 11 · 32.6k · 152s | ⚠️ JS 层 mock（initScript）· 10 · 14 · 146s | ✅ · 10 · 12 · 110s · $0.83 |
| T05 动态等待 | | ✅ · 26 · 16 · 28.8k · 141s | ✅* · 19 · 15 · 22.2k · 153s | ✅ · 4 · 8 · 70s · $0.84 | ✅ · 6 · 7 · 69s · $0.62 |
| T06 结构化提取 | | ✅ · 10 · 10 · 27.6k · 72s | ✅* · 13 · 11 · 25.4k · 101s | ✅ · 4 · 6 · 54s · $0.77 | ✅ · 7 · 8 · 72s · $0.70 |
| T07 已登录 fetch | | ✅ · 10 · 7 · 24.1k · 57s | ✅* · 44 · 24 · 26.4k · 255s | ✅ · 5 · 7 · 64s · $0.78 | ✅ · 8 · 7 · 70s · $0.62 |
| T08 Shadow DOM | | ✅ · 18 · 12 · 27.6k · 102s | ✅* · 50 · 28 · 31.2k · 331s | ✅ · 6 · 9 · 70s · $0.88 | ✅ · 10 · 12 · 108s · $0.91 |
| T09 扩展 reload | | ✅ · chrome://ext UI · 0打断 ¹ | ❌ 到不了 chrome:// · runtime.reload 弄坏扩展 · 0打断 ¹ | ✅ · developerPrivate.reload · ~7 · 0打断 ¹ | ✅ · 自管 context · ~10 · 0打断 ¹ |
| T10a 真实登录态（默认 Profile） | 主场，未跑 | ✅ 68 条 · 0打断 ¹ | ✅ 68 条 · ~6 · 0打断 ¹ | ✅ 68 条 · 4 · 0打断 ¹ | ❌ attach 企业 9223 断言崩溃 ¹ |
| T10b 登录态持久化（专用 Profile） | 不适用 | ✅ 可移植状态文件 `--state open` ¹ | △ 无自身机制，仅 attach 持久浏览器 ¹ | ✅\* 持久 userDataDir（换目录即丢）¹ | ✅ 可移植状态文件（先 open 再 load）¹ |
| T11 使用扩展 | | ✅ `HELLO-2026·v1.0.0` · 0打断 ¹ | ⚠️ 改成功但靠 CDP 强开设置页 · ~9 · 0打断 ¹ | ✅ navigate 直达 options · ~8 · 0打断 ¹ | ✅ 自管 context · ~6 · 0打断 ¹ |
| **合计（7 共同任务）** | | **7/7 ✅ · 104 · 73 · 9.9min** | **6✅+1⚠️ · 235 · 140 · 26.3min** | **6✅+1⚠️ · 42 · 63 · 9.3min** | **7/7 ✅ · 60 · 63 · 9.6min** |

> playwright-cli 列 T01-T08 数据来自 `formal-2026-06-12-pw/REPORT.md`（与 DevTools MCP 同宿主同方法）；8 任务全程零 eval 自救，是四工具唯一。原"Playwright（裸脚本）"列被 playwright-cli 取代——微软已为 Agent 补齐了 CLI 封装层。
>
> ¹ T09/T10a/T11 来自 **2026-06-14 rerun**（Claude Code 主控 + 每工具独立 subagent），详见 `formal-2026-06-14-t09-t11-rerun/REPORT.md`。轮数为 subagent 估算、token 未逐任务拆分。**T09/T11 在我另起的干净 Chrome for Testing（9224，`--disable-features=DisableLoadExtensionCommandLineSwitch` 加载 Bench Badge）上跑**——因为系统默认 Chrome（9223，企业管控）运行时拦截解压扩展（ERR_BLOCKED_BY_CLIENT），无法测扩展。**T10a 在真实登录态的 9223 上跑**。@chrome 列本轮未测（用户本轮只比这 4 个工具）。两条关键坑：(a) agent-browser 粘滞会话会被自起托管浏览器劫持，`--cdp` 需先 `close --all` 才真连；(b) Chrome/CfT 137+ 在开发者模式关闭时 reload 解压扩展会被判 unsupportedDeveloperExtension 禁用，3 个成功工具都得先开开发者模式。

## 测试环境

- 日期：
- Agent 宿主与模型：（@chrome 列单独注明 Codex 版本）
- Chrome 版本：
- 工具版本：agent-browser ___ / bb-browser ___ / chrome-devtools-mcp ___ / playwright ___

## 运行记录

每次测试在下面追加一条，失败案例务必记录 Agent 卡住的位置和它的自我诊断。

### 模板

```
#### T0X · 工具名 · 第 N 次 · YYYY-MM-DD
- 结果：✅/⚠️/❌
- 轮数 / token / 时间 / 打断：
- 路径摘要：（Agent 用了哪些子命令/工具，走了聪明路还是笨路）
- 备注：（卡点、意外行为、与文章断言不符的地方）
```
