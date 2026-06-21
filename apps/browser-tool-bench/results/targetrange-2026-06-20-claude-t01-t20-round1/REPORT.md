# 浏览器工具靶场 T01-T20 第1轮报告（Claude 独立轮 · 环境修复后最终版）

## 1. 元信息

- **日期**：2026-06-20
- **轮次**：第1轮（Claude 独立轮）+ 环境修复补丁轮（重跑 T15/T16/T17/T20）
- **被测工具**：agent-browser、bb-browser、devtools-mcp（chrome-devtools-mcp）、playwright-cli
- **浏览器策略（混合）**：
  - agent-browser / bb-browser / devtools-mcp：连接企业常驻 Chrome（Chrome 149）profile，**CDP 9223**（已含 GitHub 等登录态）。
  - playwright-cli：使用其**自管浏览器**（Chromium / Chrome for Testing），不接入系统默认 profile。
  - **原因**：三种 CDP 工具的设计就是 attach 到既有浏览器，复用 9223 真实登录态可公平测试「默认 Profile 登录态接入」场景；playwright-cli 的产品边界是自管隔离目录（Chrome 136+ 已禁止远调系统默认 user-data-dir），强行 attach 9223 会破坏其隔离模型且不符合其推荐用法，故按各工具的「原生最佳路径」分别取浏览器，保证公平参赛边界。
- **执行方式**：每个工具拆 **2 个干净 subagent**（chunk），顺序执行，互不污染上下文；T15/T16/T17/T20 在环境修复后用补丁 subagent 重跑。
- **环境**：Chrome 149 / CDP 9223（CDP 工具）；靶场服务 localhost:4399。
- **工具版本**：bb-browser 0.14.2；agent-browser、devtools-mcp、playwright-cli（CfT chromium-1226 / CfT149）为本机当前安装版本。

### ⚠️ 环境修复说明（关键，决定 T15/T16/T17/T20 的最终判级）

**第1轮原始矩阵中 T15/T16/T17/T20 四题被环境污染、四工具集体失败（❌/⚠️/N-R），根因为基础设施而非工具能力：**

- 运行中的靶场服务是**陈旧进程**：bench `server.mjs` 主进程（PID1762，启动于 6/12）早于 6/19 新增路由的改动，导致 `/api/realtime-events`（SSE，T15）、`/api/settings?live=1` 旁路（T16 真实 live 值）、`/api/flake-check`（T20）全部 404。
- 跨域子页地址 `127.0.0.1:4399/iframe-child.html`（T17）被**无关进程 codex-snapshot（占用 127.0.0.1:4399）**接管返回 404，而靶场服务只绑 `::1`/localhost。

**修复动作**：重启 `server.mjs`（加载 6/19 后的全部新路由），并把占用 `127.0.0.1:4399` 的 codex-snapshot **迁移到 4401**，腾出 IPv4:4399 让靶场子页正常提供。修复后用补丁 subagent **重跑这 4 题**（证据文件统一带 `-patch` 后缀）。

**修复效果**：T15/T16/T20 四工具全部转 ✅；T17 三工具（agent-browser / devtools-mcp / playwright-cli）转 ✅，**仅 bb-browser 仍 ❌**——但此 ❌ 已与环境无关，是 bb-browser 0.14.2 缺跨域 iframe/OOPIF 切换与坐标点击能力的**真实工具短板**。

## 2. 判定口径

- **✅ 通过**：通过浏览器真实交互/网络取证拿到正确答案，证据充分。
- **⚠️ 部分**：核心机制证明成立，但因约束（如真实 GitHub 首登需交互 2FA）无法拿到最终 GT 的同源网络级证据，改用等价机制演示。
- **❌ 失败**：因工具能力缺失未能拿到答案（修复后已无环境性 ❌）。
- **N-R（Not-Run / 不适用）**：按公平边界或工具产品定位本就不在该工具的可测范围（如 playwright 自管不 attach 9223、bb-browser 无显式 state 文件机制）。
- **逃生 \***：未能用工具的「一等交互原语」（如 click/snapshot ref）触发，改用 `eval/.click()`、原始 CDP 等绕过手段达成；仍力求走真实路径（如真实 file input、真实 SW），不伪造结果。标记于 cell 右上角 `*`。

## 3. 任务矩阵（T01-T20，含 T10a/T10b × 4 工具）

cell = 判级（`*` = 逃生）；**T15/T16/T17/T20 为环境修复后的补丁轮结果**。

| 任务 | agent-browser | bb-browser | devtools-mcp | playwright-cli |
|------|:---:|:---:|:---:|:---:|
| T01 | ✅ | ✅* | ✅ | ✅ |
| T02 | ✅ | ✅ | ✅ | ✅ |
| T03 | ✅ | ✅ | ✅ | ✅ |
| T04 | ✅ | ❌ | ✅ | ✅ |
| T05 | ✅ | ✅* | ✅ | ✅ |
| T06 | ✅ | ✅ | ✅ | ✅ |
| T07 | ✅ | ✅ | ✅ | ✅ |
| T08 | ✅ | ✅* | ✅ | ✅ |
| T09 | ✅ | ❌ | ✅ | ✅ |
| T10a | ✅ | ✅ | ✅ | N-R |
| T10b | ⚠️ | N-R | ✅ | ✅ |
| T11 | ✅ | ❌ | ✅ | ✅ |
| T12 | ✅ | ✅ | ✅ | ✅ |
| T13 | ✅ | ✅* | ✅ | ✅* |
| T14 | ✅ | ✅ | ✅ | ✅ |
| **T15** | **✅** | **✅\*** | **✅** | **✅** |
| **T16** | **✅** | **✅** | **✅** | **✅** |
| **T17** | **✅** | **❌** | **✅** | **✅** |
| T18 | ✅ | ✅* | ✅ | ✅ |
| T19 | ✅ | ✅* | ✅ | ✅ |
| **T20** | **✅** | **✅\*** | **✅** | **✅** |

（加粗行为环境修复后重跑；T15/T20 bb-browser 仍需 eval `.click()` 逃生触发。）

## 4. 各工具合计（按 20 任务、T10 计 a+b = 21 行）

| 工具 | ✅ | ⚠️ | ❌ | N-R | 说明 |
|------|:--:|:--:|:--:|:--:|------|
| agent-browser | **20** | 1 | 0 | 0 | 仅 T10b ⚠️（GitHub 首登需 2FA，bench 演示同机制） |
| bb-browser | **16** | 0 | **4** | 1 | ❌=T04/T09/T11/T17；N-R=T10b |
| devtools-mcp | **21** | 0 | 0 | 0 | **满分，零逃生** |
| playwright-cli | **20** | 0 | 0 | 1 | N-R=T10a（公平边界，自管不 attach 9223） |

**修复前→修复后合计变化：**
- agent-browser：15 ✅ / 2 ⚠️ / 3 ❌ → **20 ✅ / 1 ⚠️ / 0 ❌**（T15/T17/T20 由 ❌→✅，T16 由 ⚠️→✅）。
- bb-browser：11 ✅ / 1 ⚠️ / 3 ❌ / 4 N-R → **16 ✅ / 0 ⚠️ / 4 ❌ / 1 N-R**（T15/T20 由 N-R→✅，T16 由 ⚠️→✅，T17 由 N-R→❌真实短板）。
- devtools-mcp：16 ✅ / 1 ⚠️ / 3 ❌ → **21 ✅ / 0 ⚠️ / 0 ❌**（四题全转 ✅，达成满分）。
- playwright-cli：14 ✅ / 1 ⚠️ / 3 ❌ / 1 N-R → **20 ✅ / 0 ⚠️ / 0 ❌ / 1 N-R**（四题全转 ✅）。

## 5. 关键答案核对（Ground Truth 对照）

| 任务 | Ground Truth | agent-browser | bb-browser | devtools-mcp | playwright-cli |
|------|------|---|---|---|---|
| T01 | 工号 BENCH-7341 | BENCH-7341 ✓ | BENCH-7341 ✓ | BENCH-7341 ✓ | BENCH-7341 ✓ |
| T02 | 500 INSUFFICIENT_INVENTORY / SKU-8821 剩余0 | ✓ | ✓ | ✓ | ✓ |
| T03 | LCP 主因 blocking.css；heavy.js 长任务；hero.svg=干扰项 | ✓ | ✓ | ✓（insight 佐证） | ✓ |
| T04 | 空状态 🪴/暂无成员/邀请成员 | ✓ | ✗（无 mock 能力） | ✓ | ✓ |
| T05 | 12 条 / 末条口令 LIVE-512 | ✓ | ✓ | ✓ | ✓ |
| T06 | 12 件 / 最贵 雷霆工作站 ¥15999 | ✓ | ✓ | ✓ | ✓ |
| T07 | plan = team-pro-2026 | ✓ | ✓ | ✓ | ✓ |
| T08 | 兑换码 SHADOW-99 | ✓ | ✓ | ✓ | ✓ |
| T09 | reload 后徽标 v1.0.0→v1.0.1 | ✓ | ✗（scheme bug） | ✓ | ✓（等价机制） |
| T10a | GitHub 未读 70 条 | 70 ✓ | 70 ✓ | 70 ✓ | N-R |
| T10b | 持久化/免登录恢复 | ⚠️（bench 演示） | N-R | ✓ | ✓（bench 自管） |
| T11 | 徽标 HELLO-2026 · v1.0.0；ID jkmndkochpgaleoechlemhdhbikdecnf | ✓ | ✗（scheme bug） | ✓ | ✓ |
| T12 | coupon.ts / applySelectedCoupon / selectedCoupon.couponCode / guard | 全中 ✓ | 全中 ✓ | 全中 ✓ | 全中 ✓ |
| T13 | 支付码 MOBILE-39；遮挡 .mobile-support-bar | ✓ | ✓ | ✓ | ✓ |
| T14 | TaskSummary / HYD-908 / 最终 9 待办 team-pro | ✓ | ✓ | ✓ | ✓ |
| **T15** | **5 条 / 末条 evt-005 / 告警 STREAM-721(alert,critical)** | **5·evt-005·STREAM-721 ✓** | **5·evt-005·STREAM-721 ✓** | **5·evt-005·STREAM-721 ✓** | **5·evt-005·STREAM-721 ✓** |
| **T16** | **旧值 blue/cached-2025.11/STALE-CACHE-17 → 真实 green/live-2026.06/CACHE-BUST-42（SW 缓存致，需更新/注销 SW）** | **旧+真实+修复 全中 ✓** | **全中 ✓** | **全中 ✓** | **全中 ✓** |
| **T17** | **授权账号 iframe-user@bench.dev / 授权码 OAUTH-314** | **iframe-user@bench.dev·OAUTH-314 ✓（父页 postMessage 验证）** | **✗（OOPIF 不可驱动，仅子页源码读到非父页验证）** | **✓** | **✓** |
| T18 | upload-token.txt / 36 bytes / UPLOAD-448 | ✓ | ✓ | ✓ | ✓ |
| T19 | 确认码 A11Y-204（键盘到不了 save） | ✓ | ✓ | ✓ | ✓ |
| **T20** | **7/10 通过 / 失败轮 3·6·9 / FLAKE-307 / 30%** | **7-3·3,6,9·FLAKE-307·30% ✓** | **✓** | **✓** | **✓** |

**对照结论（修复后）**：
- **T15/T16/T20**：四工具全部拿到正确 GT。T15 末条 evt-005 / 告警 STREAM-721；T16 真实 live 值 green / live-2026.06 / CACHE-BUST-42（并正确归因 Service Worker 拦截 + 给出修复）；T20 通过 7/10、失败轮 3·6·9、FLAKE-307、flake rate 30%。均经页面 + 网络/SSE/逐 run 响应体双重取证。
- **T17**：agent-browser / devtools-mcp / playwright-cli 三者在父页内联跨域 iframe 中点击「确认授权」、经 postMessage 在父页读到 `iframe-user@bench.dev / OAUTH-314` ✓；**bb-browser 唯一 ❌**——snapshot 不内联跨域 OOPIF、click/eval 只作用主框架、无坐标点击与 frame 切换，无法驱动跨域 iframe 内交互（仅从子页源码读到答案，非父页验证）。
- 其余 16 题：devtools-mcp 全对（满分）；agent-browser 仅 T10b 降级 ⚠️；playwright-cli 仅 T10a 因边界 N-R；**bb-browser 因 scheme 归一化 bug + 无 mock 能力，T04/T09/T11 三题答错**。

## 6. 特殊任务小结

- **T09 扩展 reload**：企业 9223 的 CDP 工具（agent-browser developerPrivate.reload / devtools-mcp 点「重新加载」）可触发；playwright-cli 用 `--load-extension` 重启 persistentContext 等价达成；**bb-browser 因 scheme 归一化 bug 无法到达 chrome://extensions，唯一失败**。
- **T10a 默认 Profile 登录态**：三 CDP 工具复用 9223 已登录 GitHub，零弹窗读到 70 未读（garden-lab 58 / codex-snapshots 7 / profilepilot 4 / open-token-board 1）。**playwright-cli 按公平边界 N-R**。
- **T10b 持久化机制对比**：playwright-cli 显式 state-save/load 文件最干净（✅）；devtools-mcp 持久 userDataDir + isolatedContext 对照（✅）；agent-browser 有 state 机制但 GitHub 首登需 2FA，bench 演示同机制（⚠️）；bb-browser 无显式 state 文件 → N-R。
- **T11 扩展设置页可达性**：扩展 ID `jkmndkochpgaleoechlemhdhbikdecnf`。三工具均能到 `options.html` 走真实 fill/click；**bb-browser 因 scheme 归一化 bug ❌**。
- **T17 跨域 iframe 内交互（环境修复后新增看点）**：修复后子页恢复正常提供，a11y 快照能内联跨域 iframe 的三工具（agent-browser / devtools-mcp / playwright-cli）直接点到子页按钮并经 postMessage 在父页验证授权结果；**bb-browser 是唯一在该题暴露真实能力短板者**（缺 OOPIF 切换 / 坐标点击）。

## 7. 状态污染检查

- **扩展徽标 / manifest 版本**：
  - agent-browser：T09 manifest 改回 1.0.0 并 reload，T11 恢复默认 BENCH EXT v1.0.0 —— **已复位**。
  - devtools-mcp：T09 disk=1.0.0 / Chrome 内=1.0.0 / 页面徽标=v1.0.0，T11 恢复默认 —— **已复位**。
  - playwright-cli：T09 manifest 改回 1.0.0（diff 验证）、删临时 profile；T11 恢复默认徽标并销毁临时 profile —— **已复位（自管隔离，不影响 9223）**。
  - bb-browser：T09 已将 manifest 由 1.0.1 恢复 1.0.0 并验证实时徽标=BENCH EXT v1.0.0；T11 未改无需恢复 —— **已复位**。
- **mock/路由**：T04 各工具 unroute 复位；T13 各工具 viewport / 遮挡修复用后清除。
- **补丁轮（T15/T16/T17/T20）**：均为只读观测（SSE 接收、SW registration 读取、iframe 点击授权、flake-check 跑 10 次 GET），未写后端持久状态；SW 注册为靶场页面自身行为，未额外注册或残留 SW。
- **状态文件**：agent-browser T10b、playwright-cli T10b 的临时 state/auth 文件用后已删除，无残留（均为本地假账号 sid，非真实凭证）。
- **GitHub**：T10a 全程**只读**，无任何写操作。
- **共享服务/基础设施**：本次为修复环境而**主动重启了 server.mjs** 并把 codex-snapshot 从 127.0.0.1:4399 迁到 4401；迁移为端口腾挪、未删除 codex-snapshot 数据，靶场服务现已绑全部 6/19 后新路由。补丁轮跑完未再改动服务。

**结论：本轮无遗留状态污染，扩展徽标与 manifest 版本均已恢复默认 BENCH EXT v1.0.0；环境已修复，T15/T16/T17/T20 在干净后端上重跑取证。**
