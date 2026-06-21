# 浏览器工具靶场 T01–T20 第2轮报告（Claude 独立轮）

## 1. 元信息

| 项 | 值 |
|---|---|
| 轮次 | Round 2（Claude 独立轮） |
| 日期 | 2026-06-20 |
| 环境 | 干净环境（无环境补丁） |
| 浏览器绑定 | 混合模式：`agent-browser` / `bb-browser` / `devtools-mcp` 接入 CDP 9223（真实登录态默认 profile）；`playwright-cli` 自管浏览器 |
| 执行方式 | 每工具 2 chunk，干净 subagent 顺序执行 |
| 参评工具 | agent-browser、bb-browser、devtools-mcp、playwright-cli |
| 任务 | T01–T20 共 21 卡（T10 拆 T10a/T10b） |
| 对照基线 | Round 1（已环境修复合并）`../targetrange-2026-06-20-claude-t01-t20-round1/_matrix-final.json` |

## 2. 判定口径

| 符号 | 含义 |
|---|---|
| ✅ | 完成。核心维度由工具能力达成，答案正确（可含合理逃生舱，escape 字段单列） |
| ⚠️ | 部分完成。机制存在或答案正确，但核心维度未由工具能力达成、或仅用旁路/源码佐证 |
| ❌ | 未完成。工具能力缺失，核心维度无法达成 |
| N-R | Not-Required。按任务卡边界，该工具此格预期不可达（如 playwright-cli 无默认 profile 登录态） |
| escape | 是否使用逃生舱（eval/CDP 旁路等），与 verdict 独立标注 |

## 3. T01–T20 × 4 工具结果矩阵

| 任务 | agent-browser | bb-browser | devtools-mcp | playwright-cli |
|---|---|---|---|---|
| T01 登录与观察 | ✅ | ✅ | ✅ | ✅ |
| T02 Network 排障 | ✅(esc) | ✅ | ✅ | ✅ |
| T03 性能诊断 | ✅(esc) | ✅ | ✅ | ✅ |
| T04 请求 mock | ✅ | ❌ | ✅ | ✅ |
| T05 动态渲染等待 | ✅ | ✅ | ✅ | ✅ |
| T06 结构化提取 | ✅ | ✅ | ✅ | ✅ |
| T07 已登录 fetch | ✅(esc) | ✅ | ✅ | ✅ |
| T08 Shadow DOM | ✅ | ✅(esc) | ✅ | ✅ |
| T09 扩展 reload | ✅(esc) | ❌ | ✅ | ⚠️ |
| T10a 真实登录态读 GitHub | ✅ | ✅ | ✅ | N-R |
| T10b 专用 profile 持久化 | ✅ | ⚠️ | ⚠️ | N-R |
| T11 扩展设置页改徽标 | ✅ | ❌ | ✅ | ✅ |
| T12 source map 排障 | ✅ | ✅ | ✅ | ✅ |
| T13 移动端遮挡诊断 | ✅ | ⚠️(esc) | ✅ | ✅ |
| T14 Hydration mismatch | ✅ | ✅ | ✅ | ✅ |
| T15 SSE 实时流 | ✅ | ✅ | ✅ | ✅ |
| T16 Service Worker 缓存 | ✅ | ✅ | ✅ | ✅ |
| T17 跨域 iframe 授权 | ✅ | ❌ | ✅ | ✅ |
| T18 真实文件上传 | ✅ | ⚠️(esc) | ✅ | ✅ |
| T19 a11y 焦点缺陷 | ✅ | ✅ | ✅ | ✅ |
| T20 Flaky 统计 | ✅ | ✅ | ✅ | ✅ |

## 4. 各工具合计（第2轮）

| 工具 | ✅ | ⚠️ | ❌ | N-R | 备注 |
|---|---|---|---|---|---|
| devtools-mcp | 20 | 1 | 0 | 0 | 仅 T10b ⚠️（无显式两阶段 save/restore 演示能力） |
| agent-browser | 21 | 0 | 0 | 0 | 满分；T02/T03/T07/T09 用逃生舱但核心维度达成 |
| playwright-cli | 18 | 1 | 0 | 2 | T09 ⚠️（unpacked reload 不稳）、T10a/T10b N-R（无默认 profile，公平边界） |
| bb-browser | 14 | 3 | 4 | 0 | ❌：T04/T09/T11/T17；⚠️：T10b/T13/T18 |

> 折算「有效完成率」（✅ 占非 N-R 格数）：devtools-mcp 20/21、agent-browser 21/21、playwright-cli 18/19、bb-browser 14/21。

## 5. 关键答案核对（GT 对照）

四工具凡判 ✅/⚠️ 的格，关键答案与 Ground Truth 完全一致，无偏差：

| 任务 | Ground Truth | 一致性 |
|---|---|---|
| T01 工号 | BENCH-7341 | 全工具一致 |
| T02 报错 | POST /api/orders 500 / INSUFFICIENT_INVENTORY / SKU-8821 库存不足剩余 0 件 | 全工具一致 |
| T03 LCP 主因 | blocking.css 渲染阻塞（主）+ heavy.js crunchAnalytics 800ms（次）；hero.svg 1500ms 为并行干扰项 | 4 工具均正确识别干扰项 |
| T05 口令 | 12 条，末条 LIVE-512 | 全工具一致 |
| T06 最贵 | 12 件，雷霆工作站 ¥15999 | 全工具一致 |
| T07 plan | team-pro-2026 | 全工具一致 |
| T08 兑换码 | SHADOW-99 | 全工具一致 |
| T10a 未读数 | Inbox 70（garden-lab 58 / codex-snapshots 7 / profilepilot 4 / open-token-board 1） | 3 个接入 9223 的工具一致；playwright N-R |
| T11 徽标 | HELLO-2026 · v1.0.0 | 3 工具一致；bb-browser ❌ 未达 |
| T12 | webpack://bench/src/cart/coupon.ts / applySelectedCoupon / cartState.selectedCoupon.couponCode(null) / guard | 全工具一致 |
| T13 遮挡 + 确认码 | .mobile-support-bar[data-bug=overlaps-pay-button] z-index:20 覆盖；MOBILE-39 | 全工具识别遮挡；确认码一致 |
| T14 | TaskSummary / HYD-908 / pendingTasks 8→9 / planName starter→team-pro | 全工具一致 |
| T15 | 5 条，evt-005，STREAM-721（alert/critical） | 全工具一致 |
| T16 | SW /sw-cache.js；旧值 blue/cached-2025.11/STALE-CACHE-17；真值 green/live-2026.06/CACHE-BUST-42 | 全工具一致 |
| T17 | iframe-user@bench.dev / OAUTH-314 | 3 工具一致；bb-browser ❌ 未达 |
| T18 | upload-token.txt / 36 bytes / UPLOAD-448 | 全工具一致 |
| T19 | #save-preferences div[role=button] 缺 tabindex/键盘 handler；A11Y-204 | 全工具一致 |
| T20 | 7/10，失败 3/6/9，FLAKE-307，flake rate 30% | 全工具一致 |

结论：**无任何工具给出错误答案**；差异仅体现在「能否由工具能力达成核心维度」（verdict 等级），不体现在事实正确性。

## 6. 特殊任务小结

- **T03 性能干扰项**：四工具均未被「最慢单资源 hero.svg（1500ms）」带偏，正确锁定 render-blocking 的 blocking.css 为 LCP 主因。devtools-mcp 凭原生 insight 直接给出；其余三工具由 Agent 从 Resource Timing + longtask 原始数据自推，同样命中。
- **T04 请求 mock**：devtools-mcp 用 navigate initScript 注入 fetch override、agent-browser/playwright-cli 用原生 route，均「先看真实结构再 mock 正确 body」。bb-browser 无任何拦截能力 → ❌（且未用改 DOM 旁门伪造，判定诚实）。
- **T09 扩展 reload**：agent-browser 经 `chrome.developerPrivate.reload`、devtools-mcp 经 chrome://extensions UI，均干净往返并复位。playwright-cli 自管路径加载扩展可验证 v1.0.1，但 unpacked 持久上下文 reload 往返不稳 → ⚠️。bb-browser 因 chrome-extension:// scheme 归一化 bug → ❌。
- **T10a/T10b 登录态与持久化**：接入 9223 的三工具均 0 人工打断读到 70 未读。T10b agent-browser 用自身 `state save/--state` 完成专用 profile 两阶段免登录恢复（✅）；devtools-mcp/bb-browser 仅隐式 userDataDir、无显式两阶段演示能力（⚠️）。playwright-cli 按边界 N-R（本地 bench 站验证机制可用）。
- **T11 扩展设置页**：options.html 对 agent-browser/devtools-mcp/playwright-cli 均为一等 target，走 UI 路径改徽标并复位。bb-browser 同 T09 scheme bug → ❌。
- **T13 移动端遮挡**：agent-browser/devtools-mcp/playwright-cli 均能设 390×844 视口、由 actionability 报错 + elementFromPoint 诊断遮挡。bb-browser 无 viewport/emulate，本轮未用 CDP override 复现，遮挡靠源码佐证 → ⚠️（本轮较第1轮回退）。
- **T17 跨域 iframe**：三工具均靠 snapshot 内联跨域子 frame 直接点击。bb-browser 无 OOPIF 切换/坐标点击 → ❌（硬短板）。
- **T18 文件上传**：三工具走真实 file input（upload/setFiles）。bb-browser 无上传命令，用 eval 伪造 File → ⚠️。

## 7. 状态污染检查

所有写操作均已复位，无残留：

- **扩展 manifest / 徽标**：T09 改 1.0.0→1.0.1 后均改回 1.0.0 并 reload 验证徽标回 `BENCH EXT v1.0.0`；T11 改 HELLO-2026 后清空保存恢复默认徽标。agent-browser/devtools-mcp/playwright-cli 均二次确认复位。
- **请求 route mock**：T04 测毕 unroute，agent-browser/playwright-cli 验证 /api/users 恢复 18 人。
- **持久化 state 文件**：T10b agent-browser 的 `t10b-gh-auth.json`（含 GitHub 凭证）测毕 `rm + state clear --all`，未入 git；playwright-cli 本地 bench-auth.json 测毕已删。
- **GitHub**：T10a/T10b 全程只读，无 star/follow/comment 等写操作，无风控触发。
- **视口/设备模拟**：T13 用完 clear（agent-browser/devtools-mcp/playwright-cli），未残留 device metrics override。

结论：**无状态污染**。

## 8. 两轮一致性对照（重点）

逐工具逐任务（84 格 = 4 工具 × 21 卡）比对 Round 1 vs Round 2 的 verdict：

### 8.1 总体

- **稳定一致：77 / 84 格（91.7%）**
- 不一致：7 格，全部集中在 4 个「机制/边界类」任务（T09、T10b、T13、T18），无一例发生在事实判定类核心任务（T01–T08、T12、T14–T17、T19、T20 这 14 卡 × 4 工具 = 56 格全部稳定，唯 bb-browser 的 T13/T18 例外，详见下）。

### 8.2 不一致格逐条分析

| 工具 | 任务 | R1 | R2 | 性质分析 |
|---|---|---|---|---|
| agent-browser | T10b | ⚠️ | ✅ | **方法提升（非 flake）**。R1 用 bench 站演示机制判 ⚠️；R2 用 `state save/--state` 完成 GitHub 专用 profile 两阶段免登录恢复并读到同样 70 未读，核心维度达成 → ✅。属能力被更充分发挥。 |
| bb-browser | T10b | N-R | ⚠️ | **判定口径细化**。R1 因无法 auto-launch managed Chrome 记 N-R；R2 明确「隐式 userDataDir 机制存在、凭证跨重启存活、本地会话复用证明，但规定两阶段 demo 因 9222 端口冲突未跑」→ ⚠️。本质同一结论，仅符号更精确。 |
| bb-browser | T13 | ✅ | ⚠️ | **工具短板暴露（轮间方法差异）**。R1 用原始 CDP `Emulation.setDeviceMetricsOverride` 复现 390×844 → ✅；R2 未走该 CDP 旁路，固定 1280 视口下移动媒体查询不生效、遮挡靠源码佐证 → ⚠️。根因是 bb-browser 无一等 viewport/emulate 命令，能否过关取决于是否动用 CDP 旁路 → **偶发/方法依赖**。 |
| bb-browser | T18 | ✅ | ⚠️ | **判定口径细化**。两轮均用 eval/CDP 伪造 File（bb-browser 无 upload 命令）。R1 用 `DOM.setFileInputFiles`（视为接近原生）判 ✅；R2 用 eval 构造 File+DataTransfer，按「非真实文件选择路径」从严判 ⚠️。同一短板、判定从严。 |
| devtools-mcp | T10b | ✅ | ⚠️ | **判定口径细化**。两轮事实一致：持久 9223 profile 免登录可用、无显式专用 profile + save/restore 两阶段能力。R1 以「对照成立（裸新会话撞登录墙）」判 ✅；R2 以「缺显式两阶段演示能力」从严判 ⚠️。结论实质相同。 |
| playwright-cli | T09 | ✅ | ⚠️ | **工具短板（轮间稳定性差异）**。两轮均经自管 --load-extension 加载扩展。R1 验证 v1.0.1 → ✅；R2 进一步点 chrome://extensions reload 按钮后出现 content script 不再注入、enableToggle=false、徽标 NO-BADGE 的不稳定现象 → ⚠️。根因 unpacked 扩展持久上下文 reload 不稳 → **真实工具 flake**。 |
| playwright-cli | T10b | ✅ | N-R | **判定口径细化**。两轮均无 GitHub 凭证，state-save/load 机制本地验证可用。R1 侧重「机制可用」判 ✅；R2 侧重「GitHub 字面任务无登录态」判 N-R。同一事实、侧重点不同。 |

### 8.3 不一致归因总结

- **7 格中 0 格属事实错误**——无一例是答案对错翻转。
- 5 格（agent-browser T10b、bb-browser T10b/T18、devtools-mcp T10b、playwright-cli T10b）属**判定口径细化/方法提升**，非工具行为漂移。
- 2 格（bb-browser T13、playwright-cli T09）属**真实工具短板的偶发表现**：bb-browser T13 取决于是否动用 CDP 旁路、playwright-cli T09 unpacked reload 本身不稳。这 2 格是真正需要标注「不稳定」的格子。

### 8.4 「两轮都稳定」的高置信结论清单

- **devtools-mcp**：T01–T20 全部稳定为 ✅（含 T10b 两轮虽符号 ✅→⚠️ 但实质同为「持久 profile 可用、无显式两阶段」）。**最稳工具，零事实漂移，零硬失败。**
- **agent-browser**：T01–T09、T10a、T11–T20 共 20 卡两轮均 ✅，能力面满覆盖（含扩展 reload/T11、跨域 iframe/T17、真实上传/T18 等难点）。T10b 两轮均「机制达成」（⚠️→✅ 为提升）。**第二稳，能力最全。**
- **playwright-cli**：T01–T08、T10b(机制)、T11–T20 中除 T09 外两轮均 ✅；T10a 两轮稳定 N-R（公平边界）。**自管浏览器场景稳定可靠，唯一波动在扩展 reload。**
- **bb-browser**：T01–T03、T05–T08、T10a、T12、T14–T16、T19–T20 共 15 卡两轮稳定 ✅（基础导航/网络/性能/SSR/SW/SSE/a11y 等核心能力扎实）；T04/T09/T11/T17 两轮稳定 ❌（mock/扩展/跨域 iframe 硬短板）。**核心能力稳定，但有四类固定硬短板。**

## 9. 靶场最终推荐（综合两轮）

### 9.1 综合能力排序

> 排序依据：两轮有效完成率 + 一致性稳定度 + 能力覆盖面 + 逃生舱依赖度。

**1. devtools-mcp（第一名）** — 两轮 ✅ 20–21 / 21，零硬失败、零事实漂移，逃生舱依赖最低（性能/网络/扩展均有一等原生工具）。唯一弱项 T10b ⚠️（缺显式专用 profile 两阶段持久化演示），不影响实际可用性。

**2. agent-browser（第二名）** — 两轮 ✅ 20–21 / 21，能力面最全：扩展 reload、跨域 iframe、真实文件上传、自带 state save/--state 持久化全覆盖，是四工具中唯一完成 GitHub 专用 profile 两阶段恢复者。代价：T02/T03/T07/T09 部分依赖 eval/CDP 逃生舱（核心维度仍达成）。

**3. playwright-cli（第三名）** — 自管浏览器场景稳定可靠，T11/T13/T17/T18 均一等达成；state-save/load 持久化可用。天然边界：无系统默认 profile 登录态（T10a/T10b N-R），扩展 reload（T09）不稳。

**4. bb-browser（第四名）** — 基础导航/网络/性能/SSR/SW/SSE/a11y 核心能力稳定扎实（15 卡稳定 ✅）。四类固定硬短板：请求 mock（T04 ❌）、扩展操作（T09/T11 ❌，chrome-extension:// scheme 归一化 bug）、跨域 iframe（T17 ❌，无 OOPIF）、无 viewport/upload 一等命令（T13/T18 ⚠️）。GitHub 真实登录态读取（T10a ✅）是其主场亮点。

### 9.2 各工具适用场景（一句话定位）

- **devtools-mcp**：性能诊断 / 网络排障 / 扩展调试 的首选——原生 insight + 自动网络记录 + chrome:// 全开放，最稳、最省逃生舱，适合调试型工作流。
- **agent-browser**：能力最全的全能选手——扩展、跨域 iframe、真实上传、自带跨会话持久化（state save）样样能干，适合需要"一个工具吃下全场"且接受 attach 真实 profile 的自动化。
- **playwright-cli**：自管浏览器、可复现、CI 友好的稳健选项——不碰系统 profile、persistentContext + --config 可控加载扩展，适合隔离环境端到端测试，弱在登录态接入与 unpacked 扩展 reload。
- **bb-browser**：轻量 attach 复用真实登录态读数据的快手——读 GitHub 通知等"已登录只读"场景顺手，但请求 mock、扩展操作、跨域 iframe、文件上传四类是硬短板，复杂自动化不宜首选。
