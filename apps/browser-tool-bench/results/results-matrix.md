# 结果矩阵

cell 格式：`结果 · 轮数 · token · 打断`，例如 `✅ · 6轮 · 12k · 0`。每个 cell 至少 2 次取多数，争议时附运行记录。

> 数据来自 2026-06-12 两个正式轮：①ab vs bb（Agent tool subagent，`formal-2026-06-12/REPORT.md`），cell 格式 `判定 · CLI命令数 · 轮数 · tokens · 耗时`；②ab vs DevTools MCP（`claude -p` 独立 session，`formal-2026-06-12-mcp/REPORT.md`），cell 格式 `判定 · 操作数 · turns · 耗时 · 成本`。agent-browser 列展示第①轮数据（第②轮重跑总量一致：7 任务 83 条 / 10.9min，T03 为第②轮新增）。`*` = 依赖 eval 绕过失效的 UI 原语。

| 任务 | @chrome 无完整 CDP 默认 Profile (Codex) | @chrome 开权限默认 Profile (Codex) | @browser (Codex) | agent-browser 0.27.2 | bb-browser 0.14.2 | DevTools MCP 1.2.0 | playwright-cli 0.1.14 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 登录与页面观察 | ✅ | ✅ | | ✅ · 9 · 4 · 17.4k · 40s | ✅* · 35 · 18 · 24.3k · 199s | ✅ · 5 · 8 · 59s · $0.78 | ✅ · 8 · 7 · 69s · $0.61 |
| T02 Network 排障 | ❌ 无响应体 | ✅ Network body | | ✅ · 15 · 11 · 26.1k · 86s | ✅* · 61 · 33 · 33.5k · 386s | ✅ · 8 · 11 · 93s · $0.96 | ✅ · 11 · 10 · 80s · $0.75 |
| T03 性能诊断 | ❌ 无 perf API | ✅ timing + Runtime | | ✅ · 11+本地解析 · 15 · 215s（轮②） | 未跑 | ✅ · 6 · 9 · 111s · $1.08 | ✅ · 10 · 11 · 145s · $1.04 |
| T04 请求 mock | ❌ 无 route | ❌ 无可靠 route | | ✅ · 16 · 13 · 25.1k · 97s | ⚠️* JS 层 mock · 13 · 11 · 32.6k · 152s | ⚠️ JS 层 mock（initScript）· 10 · 14 · 146s | ✅ · 10 · 12 · 110s · $0.83 |
| T05 动态等待 | ✅ | ✅ | | ✅ · 26 · 16 · 28.8k · 141s | ✅* · 19 · 15 · 22.2k · 153s | ✅ · 4 · 8 · 70s · $0.84 | ✅ · 6 · 7 · 69s · $0.62 |
| T06 结构化提取 | ✅ | ✅ | | ✅ · 10 · 10 · 27.6k · 72s | ✅* · 13 · 11 · 25.4k · 101s | ✅ · 4 · 6 · 54s · $0.77 | ✅ · 7 · 8 · 72s · $0.70 |
| T07 已登录 fetch | ❌ evaluate 无 fetch | ✅ Runtime fetch | | ✅ · 10 · 7 · 24.1k · 57s | ✅* · 44 · 24 · 26.4k · 255s | ✅ · 5 · 7 · 64s · $0.78 | ✅ · 8 · 7 · 70s · $0.62 |
| T08 Shadow DOM | ✅ | ✅* Runtime 穿透 | | ✅ · 18 · 12 · 27.6k · 102s | ✅* · 50 · 28 · 31.2k · 331s | ✅ · 6 · 9 · 70s · $0.88 | ✅ · 10 · 12 · 108s · $0.91 |
| T09 扩展 reload | ❌ chrome:// 被策略拦 | ❌ chrome:// 仍被拦 | | ✅ · chrome://ext UI · 0打断 ¹ | ❌ 到不了 chrome:// · runtime.reload 弄坏扩展 · 0打断 ¹ | ✅ · developerPrivate.reload · ~7 · 0打断 ¹ | ✅ · 自管 context · ~10 · 0打断 ¹ |
| T10a 真实登录态（默认 Profile） | ✅ 70（默认 Profile） | ✅ 70（默认 Profile） | | ✅ 68 条 · 0打断 ¹ | ✅ 68 条 · ~6 · 0打断 ¹ | ✅ 68 条 · 4 · 0打断 ¹ | ❌ attach 企业 9223 断言崩溃 ¹ |
| T10b 登录态持久化（专用 Profile） | 不适用 | 不适用 | | ✅ 可移植状态文件 `--state open` ¹ | △ 无自身机制，仅 attach 持久浏览器 ¹ | ✅\* 持久 userDataDir（换目录即丢）¹ | ✅ 可移植状态文件（先 open 再 load）¹ |
| T10c 指定浏览器登录态（CDP 9223） | N-R 无 9223 绑定 | ❌ 仍不能证明 9223 | N-R 无外部 CDP 绑定 | ✅ 9223 · 70/71 ² | ✅ 9223 · 70 ² | ✅ 9223 · 70 ² | ✅ attach 9223 · 71 ² |
| T11 使用扩展 | ❌ options 被拦 | ❌ options 仍被拦 | | ✅ `HELLO-2026·v1.0.0` · 0打断 ¹ | ⚠️ 改成功但靠 CDP 强开设置页 · ~9 · 0打断 ¹ | ✅ navigate 直达 options · ~8 · 0打断 ¹ | ✅ 自管 context · ~6 · 0打断 ¹ |
| T12 Console 与 Source Map 定位 | ⚠️ 仅 console/bundle | ✅ | ⚠️ raw sourcemap blocked | ✅* eval 取 map | ✅* CDP 逃生 | ✅ | ✅ |
| T13 移动端布局遮挡 | ❌ 无 viewport | ✅* hit-test 后临时隐藏 | ⚠️ 未拿确认码 | ✅* eval 补确认码 | ✅* CDP 逃生 | ✅* 临时解除遮挡 | ✅* `run-code` 补确认码 |
| T14 SPA 状态 / Hydration 不一致 | ✅ | ✅ | ✅ | ✅* eval 读 store | ✅* CDP 逃生 | ✅ | ✅ |
| T15 SSE 实时流等待 | ✅ | ✅ | ✅ | ✅* eval 触发 click | ✅* CDP 逃生 | ✅ | ✅ |
| T16 Service Worker 缓存排障 | ⚠️ 只证旧值 | ✅ | ⚠️ 未拿 live 值 | ✅* eval/SW 诊断 | ✅* CDP 逃生 | ✅ | ✅ |
| T17 跨域 iframe 授权 | ✅ | ✅ | ✅ | ✅ | ✅* CDP 逃生 | ✅ | ✅ |
| T18 文件上传与拖拽输入 | ❌ no upload API | ✅ | N-R no upload API | ✅ | ✅* CDP 逃生 | ✅ | ✅ |
| T19 键盘可访问性 | ✅ | ✅ | ✅ | ✅* eval 补确认码 | ✅* CDP 逃生 | ✅ | ✅ |
| T20 回归稳定性 / Flake Rate | ✅ | ✅ | ✅ | ✅* eval 触发 click | ✅* CDP 逃生 | ✅ | ✅ |
| **合计（T01-T08）** | **4✅4❌** | **6✅+1✅*+1❌** | | **8/8 ✅ · 104 · 73 · 9.9min** | **6✅+1⚠️+1未跑 · 235 · 140 · 26.3min** | **7✅+1⚠️ · 42 · 63 · 9.3min** | **8/8 ✅ · 60 · 63 · 9.6min** |
| **合计（T12-T20 新增任务）** | **4✅+2⚠️+3❌** | **8✅+1✅*** | **5✅+3⚠️+1 N-R** | **9/9 ✅（7*）** | **9/9 ✅*（CDP 逃生）** | **9/9 ✅** | **9/9 ✅** |

> playwright-cli 列 T01-T08 数据来自 `formal-2026-06-12-pw/REPORT.md`（与 DevTools MCP 同宿主同方法）；8 任务全程零 eval 自救，是四工具唯一。原"Playwright（裸脚本）"列被 playwright-cli 取代——微软已为 Agent 补齐了 CLI 封装层。
>
> ¹ T09/T10a/T11 来自 **2026-06-14 rerun**（Claude Code 主控 + 每工具独立 subagent），详见 `formal-2026-06-14-t09-t11-rerun/REPORT.md`。轮数为 subagent 估算、token 未逐任务拆分。**T09/T11 在我另起的干净 Chrome for Testing（9224，`--disable-features=DisableLoadExtensionCommandLineSwitch` 加载 Bench Badge）上跑**——因为系统默认 Chrome（9223，企业管控）运行时拦截解压扩展（ERR_BLOCKED_BY_CLIENT），无法测扩展。**T10a 在真实登录态的 9223 上跑**。@chrome 列本轮未测（用户本轮只比这 4 个工具）。两条关键坑：(a) agent-browser 粘滞会话会被自起托管浏览器劫持，`--cdp` 需先 `close --all` 才真连；(b) Chrome/CfT 137+ 在开发者模式关闭时 reload 解压扩展会被判 unsupportedDeveloperExtension 禁用，3 个成功工具都得先开开发者模式。
>
> T12-T20 来自 **2026-06-19 前端开发者专项新增评测**，详见 `frontdev-2026-06-19-t12-t20/REPORT.md`。本轮每个工具一个独立 subagent，实际靶场为 `http://localhost:4400/`。`@chrome 无完整 CDP 默认 Profile`来自 `chrome-default-profile-no-cdp-rerun-2026-06-21/REPORT.md`，修正了早期 Codex Chrome Extension disabled 导致的 9 N-R；`@chrome 开权限默认 Profile`来自 `chrome-default-profile-rerun-2026-06-20/REPORT.md` 的追加复测；`bb-browser` 因本机原生命令端点漂移，结果只代表同一 bb profile 的 CDP 逃生能力。
>
> T10c 是 2026-06-20 新增任务卡，专门测“工具能否复用用户指定的现成 9223 Chrome profile”。它与 T10b 不同：T10b 测工具自管专用 profile / state 持久化，T10c 禁止自启或 state-load 替代，必须证明控制的是 `http://127.0.0.1:9223`。
>
> ² T10c 来自 `results/t10c-cdp9223-2026-06-20/REPORT.md`。本轮 9223 为 `test03-00064815` profile，Chrome 149，GitHub notifications 动态未读数在运行中从 70 变为 71。`@chrome` 本轮已经能连接 Codex Chrome plugin 并读到 GitHub 登录态，但它开的唯一 URL 没出现在 9223 target 列表，所以按 T10c 记 ❌；`playwright-cli attach --cdp=http://127.0.0.1:9223` 本轮成功，不沿用 R01-R09 外场轮的 attach 崩溃结论。

## 真实网站外场任务（R01-R09，2026-06-19/20 已跑一轮）

> ⚠️ 本表为 2026-06-19/20 那一轮的记录。其中 **playwright-cli「0/9 · 9 N-R」已被 2026-06-21 轮更新**：playwright-cli 之后成功 attach 9223、R 任务大部分通过（见文末「2026-06-21 统一六工具轮」C.1）。当时的全 N-R 是那一轮带多扩展 profile 触发 SW target 断言所致，非工具铁律。

这组任务在 `apps/browser-tool-bench/tasks-real/`，不并入上面的 T01-T20 总分。原因是外部网站会变，动态字段必须按当次 URL、时间戳、profile 和证据判定。2026-06-19 23:45 - 2026-06-20 00:32（Asia/Shanghai）已按“每个工具一个独立 Codex Subagent，`gpt-5.5` / `xhigh`，顺序使用同一个 9223 测试 Chrome profile”的方式跑完一轮。原始报告见 `results/realworld-2026-06-20-r01-r09/`。

| 任务 | @chrome 无完整 CDP 默认 Profile | @chrome 开权限默认 Profile | @browser | agent-browser 0.27.2 | bb-browser 0.14.2 | DevTools MCP 1.3.0 | playwright-cli 0.1.14 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R01 GitHub 公共仓库代码导航 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N-R |
| R02 GitHub 真实登录态只读通知 | ✅ 70 | ✅ 70 | N-R | ✅ | ✅ | ✅ | N-R |
| R03 MDN 文档结构化阅读 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N-R |
| R04 npm 包页面元数据 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N-R |
| R05 Chrome Web Store 扩展详情 | ❌ Web Store 不可脚本化 | ❌ detached | ✅ | ✅ | ✅ | ✅ | N-R |
| R06 扩展注入真实网站 | ⚠️ 可见注入，options 不可达 | ⚠️ 可见注入，options 不可达 | N-R | ⚠️ | ❌ | ✅ | N-R |
| R07 真实网站 Network 响应体 | ❌ 无响应体 | ✅ | N-R | ✅ | ✅ | ✅ | N-R |
| R08 真实网站请求拦截 | N-R 无 route | ✅* URL block | N-R | ✅ | N-R | ✅* | N-R |
| R09 真实网站 HAR 与性能快照 | ❌ 无 timing | ✅ timing | ⚠️ | ✅ | ⚠️ | ✅ | N-R |
| **合计（R01-R09）** | **4✅+1⚠️+3❌+1 N-R** | **6✅+1✅*+1⚠️+1❌** | **4✅+1⚠️+4 N-R** | **8✅+1⚠️** | **6✅+1⚠️+1❌+1 N-R** | **9/9 ✅** | **0/9 · 9 N-R** |

> `✅*` = DevTools MCP 使用 daemon 启动参数 `--blockedUrlPattern` 精确阻断指定资源，或 @chrome 开权限后用 `Network.setBlockedURLs` 做 URL block；能证明浏览器网络层阻断，但不是运行时 route API。agent-browser 的 R06 记 `⚠️`：扩展 options 写入与真实页面注入实际成功，主控复核 DOM 为 `REAL-SITE-2026 · v1.0.0`，但该 Subagent 自己观察漏判。@chrome 无完整 CDP 默认 Profile 复测能跑公共页和真实登录态，但无 Network body、route、HAR/timing、Web Store 脚本化与扩展 options；@chrome 开权限默认 Profile 复测能验证 Bench Badge content script 注入，但 options 页不可达，所以 R06 只记 ⚠️；@browser 是 in-app browser，不能绑定 9223；playwright-cli 在 R01-R09 轮按约束不能自启浏览器，attach 9223 又因扩展 `service_worker` target 断言失败。T10c 单题 attach 9223 成功，单独见上方脚注 ²。

## 测试环境

- 日期：2026-06-12 首轮 → 2026-06-21 统一六工具轮（最新，见文末新章节）。
- Agent 宿主与模型：Claude Code（Opus 4.8）轮 + Codex（gpt-5.5 / xhigh）轮，各自独立、每工具一个干净 subagent 顺序跑；`@chrome` / `@browser` 为 Codex 专属，只在 Codex 轮测。
- Chrome 版本：系统默认企业管控 Chrome 149（CDP 9223，真实登录态 GitHub `ffffhx`/`test03-*`）；扩展任务（T09/T11）改用干净 Chrome for Testing 149（`--disable-features=DisableLoadExtensionCommandLineSwitch --load-extension`）。
- 工具版本：agent-browser 0.27.2 / bb-browser 0.14.2 / chrome-devtools-mcp 1.2.0（T01-08）·1.3.0（R 任务） / playwright-cli 0.1.14。

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

---

## Claude Code 独立复跑（2026-06-20，外场×2 + 靶场×2）

与同日 Codex 轮独立。方法：每工具一个干净 subagent、顺序轮流共用浏览器（不并行）。完整总览见 `results/CLAUDE-ROUND-2026-06-20-SUMMARY.md`。被测 4 工具：agent-browser 0.27.2 / bb-browser 0.14.2 / chrome-devtools-mcp(gh) / playwright-cli 0.1.14。

**外场 R01-R09（全 9223，×2 轮合计，两轮高度一致）：**

| 工具 | 合计 | 一句话 |
| --- | --- | --- |
| agent-browser | 9✅ / 9✅ | 唯一同时拿下运行时 route(R08)+HAR(R09)+扩展 options(R06)，零逃生最稳 |
| chrome-devtools-mcp | 8✅+1N-R / 8✅+1⚠️* | 仅 R08 无运行时拦截原语，其余全绿 |
| bb-browser | 7✅+1⚠️+1N-R / 7✅+1❌+1N-R | chrome-extension URL bug(R06)、无 route(R08)、无完整 HAR |
| playwright-cli | 9N-R / 9N-R | 受「必须 attach 9223」约束，扩展 SW target 断言确定性崩溃 |

**靶场 T01-T20（21 卡，混合浏览器，×2 轮，84 格 77 稳定/0 事实错误）：**

| 工具 | 第1轮 | 第2轮 |
| --- | --- | --- |
| devtools-mcp | 21✅ | 20✅+1⚠️ |
| agent-browser | 20✅+1⚠️ | 21✅ |
| playwright-cli | 20✅+1N-R | 18✅+1⚠️+2N-R |
| bb-browser | 16✅+4❌+1N-R | 14✅+4❌+3⚠️ |

综合排序：devtools-mcp（最稳零逃生）> agent-browser（最全能）> playwright-cli（自管/CI 稳健，弱登录态）> bb-browser（读取类快手，mock/扩展/跨域 iframe/拦截四短板）。

**环境处置**：靶场第1轮 T15/16/17/20 集体失败系陈旧靶场服务（6/12 启动缺路由）+ codex-snapshot 占 127.0.0.1:4399；已重启 server.mjs、把 codex-snapshot 迁 4401、对四题做环境补丁轮重跑。GT 全对，状态污染检查通过（徽标/manifest 复位、真实网站只读）。

---

## 2026-06-21 统一六工具轮（最新，已并入文章总表）

> 这一节归并 2026-06-21 三轮统一评测，是当前文章总表与成本表的数据源。口径：31 格 = T01-T20（T10 拆 T10a/b/c，共 22 格）+ R01-R09（9 格）。`⚠️` 部分完成/能力降级；`N-R` 运行时不可用/能力未暴露；`N/A` 任务不适用于该工具。
>
> 原始报告：
> - Codex 单轮（gpt-5.5）：`unified-9223-2026-06-21-6tools/REPORT.md`
> - Codex rerun2（含真实 token）：`unified-9223-2026-06-21-6tools-rerun2/AGGREGATE-SNAPSHOT.md`
> - Claude/Opus 4.8 两轮（4 工具，9223→9224）：`unified-9224-2026-06-21-claude-round2/REPORT.md`（续 `unified-2026-06-20-claude-4tools/`）

### A. 31 格判定（Codex 轮：单轮 → rerun2）

| 工具 | 浏览器模式 | 单轮（6tools） | rerun2 |
| --- | --- | --- | --- |
| `@chrome` | 默认 Profile fallback（9223 未证明） | 13✅/5⚠️/10❌/2 N-R/1 N/A | 15✅/2⚠️/1❌/12 N-R/1 N/A |
| `@browser` | in-app browser（9223 未证明） | 12✅/5⚠️/8❌/5 N-R/1 N/A | 14✅/2⚠️/0❌/14 N-R/1 N/A |
| `agent-browser` | CDP 9223 ✅ | 28✅/2⚠️/0❌/0 N-R/1 N/A | **30✅/0⚠️/0❌/0 N-R/1 N/A** |
| `bb-browser` | CDP 9223 ✅（rerun2 daemon status drift） | 20✅/1⚠️/7❌/1 N-R/2 N/A | 19✅/4⚠️/5❌/1 N-R/2 N/A |
| `Chrome DevTools MCP` | CDP 9223 ✅ | 27✅/1⚠️/0❌/1 N-R/2 N/A | 26✅/1⚠️/1❌/1 N-R/2 N/A |
| `playwright-cli` | CDP 9223 ✅（本轮成功 attach） | **30✅/0⚠️/0❌/0 N-R/1 N/A** | 28✅/1⚠️/1❌/0 N-R/1 N/A |

> rerun2 里 `@chrome`/`@browser` 的 N-R 暴涨（→12/14）是严格 9223 证明口径所致：两者证不了命中 9223 的格直接记 N-R。changed-verdict 明细见 AGGREGATE-SNAPSHOT.md。

### B. 真实成本/token（首次拿到逐工具数据）

rerun2 的 token 来自 Codex session JSONL（`AGGREGATE-SNAPSHOT.md` 行 16-25）。总 token 95%+ 为缓存输入（便宜），真实生成量看 output。

| 工具 | 总 token | 缓存输入 | output | 自报耗时 | tool_calls | browserOps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `@chrome` | 5,471,590 | 5,086,976 | 44,739 | 11.9m | 61 | 245 |
| `@browser` | 6,621,147 | 6,325,888 | 40,871 | 10.9m | 64 | 129 |
| `agent-browser` | 14,760,026 | 14,289,152 | 49,262 | 17.5m | 205 | 166 |
| `bb-browser` | 14,645,635 | 14,398,080 | 37,575 | 30.0m | 242 | 198 |
| `Chrome DevTools MCP` | 未采全 | — | — | 5.0m（自报，疑低估） | 120 | 112 |
| `playwright-cli` | 未采全 | — | — | 26.0m | 68 | 62 |

> ⚠️ Codex 耗时是 subagent 自报，**不可跨宿主与 Claude 轮比**（如 DevTools MCP 5.0m 几乎肯定低估）。token/耗时只在同一宿主内可比。

Claude/Opus 4.8 两轮（同宿主可比，单一 token 总量未拆 in/out，单位 k）：

| 工具 | 轮 | 结果（30题） | 耗时 | token | tool_calls | browserOps | eval 自救 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| agent-browser | R1·9223 / R2·9224 | 29✅(R06漏报) / **30✅** | 25.8 / 26.4m | 190.6 / 205.0 | 183 / 233 | 218 / 378 | 24 / 6 |
| bb-browser | R1 / R2 | 22✅3⚠️4❌1NR / 26✅1⚠️2❌1NR(R09重测✅*) | 47.9 / 41.9m | 271.9 / 233.3 | 277 / 252 | 244 / 311 | 33 / 39 |
| devtools-mcp | R1 / R2 | 28✅1⚠️1NR / **29✅1NR** | 25.5 / 23.6m | 322.7 / 327.4 | 230 / 220 | 169 / 161 | 25 / 17 |
| playwright-cli | R1·自管 / R2·自管 | 24✅1⚠️2❌3NR / 25✅2❌3NR | 26.4 / 24.3m | 203.7 / 209.3 | 188 / 188 | 184 / 189 | 38 / 18 |

> 文章成本表①把 playwright/bb 的自管 N-R 折进 ❌（playwright R1 记 5❌、bb R1 记 5❌），这里保留 REPORT 原始的 ❌+N-R 拆分。可比指标只有耗时、token；browserOps/eval 自救两轮摆动大（口径不一），只看趋势。

### C. 相对 6/20 的新结论 / 更正

1. **playwright-cli 能 attach 9223 了**（推翻旧 R 表的「0/9 · 9 N-R」）。Codex 轮用唯一 URL 在 `/json/list` 证明命中，单轮 30✅、rerun2 28✅。早期外场轮的「attach 装扩展 9223 确定性崩溃」与环境/扩展集/版本有关，**不是铁律**；Claude 轮 attach 装扩展的 9223/9224 仍崩，故改自管。两条都对，差在浏览器是否带多扩展 SW target。
2. **agent-browser rerun2 干净 30✅**（T08/T10a 由 ⚠️→✅），与「能力第一梯队、全绿」一致。
3. **bb-browser R09 的 N-R/❌ 是站点抽风**（ffffhx.github.io 偶发 000）：站点稳定后单独重测 = ✅*；其 T04/T11/T13/T17 在 ❌↔✅* 间跳是原语弱+逃生力度差异（真实短板），非测错。
4. **npm 被 Cloudflare/403 拦**是环境噪声（curl 实测 403）：playwright-cli 自管浏览器 R04/R07 ❌，但走 9223 已登录 Chrome 的 agent-browser/devtools-mcp R04/R07 ✅——同题不同会话结果不同。
5. **DevTools MCP 唯一稳定短板 = R08 无运行时 route/abort/intercept 原语**（rerun2 记 N-R/❌），其余全绿。

### D. 能力梯队（三轮 + 能力表三方一致）

`devtools-mcp / agent-browser`（第一梯队，稳定全绿；devtools 仅 R08 无运行时 route，agent-browser 独占运行时 route+HAR+扩展 options+可移植登录态）> `playwright-cli`（自管/CI 稳健，弱在接用户现成登录态、外场受 npm 网络拦）> `bb-browser`（原语弱、靠 CDP 逃生才勉强，最慢最贵最不稳）。`@chrome`/`@browser` 受扩展安全域 + 默认 Profile 限制，大量任务做不成。

**成本三轴（仅 Claude 同宿主可比）**：速度上 agent-browser / devtools-mcp / playwright-cli 挤在 ~24.6–26.1min 实质平手，bb-browser ~45min（1.8×）独慢；token 上 agent-browser 最省（~198k）、devtools-mcp 最贵（~325k，1.6×）做同样多活——「只装一款」结论指向 **agent-browser**（前端纯调试且不在乎 token 才选 DevTools MCP）。
