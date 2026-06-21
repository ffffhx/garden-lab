# browser-tool-bench：浏览器 Agent 工具对比靶场

给文章《浏览器 Agent 工具怎么选》做实测验证的靶场。核心思路：**固定 Agent + 固定任务 prompt + 只换浏览器工具**，用统一指标量化"Agent 友好度"。

## 快速开始

```bash
pnpm bench:dev        # 仓库根目录，或在本目录 node server.mjs
# 靶场地址 http://localhost:4399
# 测试账号 agent@bench.dev / bench-2026
```

零依赖，纯 Node 实现，无需安装。

## 目录结构

```
server.mjs          靶场服务（所有"坑"都埋在这里，含注释）
public/             靶场页面
extension-sample/   MV3 扩展：T09 测 reload（版本徽标），T11 测使用（options 页改徽标文字，经 chrome.storage 生效）
fixtures/           T18 文件上传任务使用的本地 fixture
tasks/              任务卡 T01-T20（T10 拆 a/b/c），每张含逐字 prompt、ground truth、判定标准
tasks-real/         真实网站外场任务 R01-R09，覆盖 GitHub、MDN、npm、Chrome Web Store、真实 Network 与扩展注入
results/            结果矩阵模板和运行记录
```

## 靶场埋了哪些坑

| 页面 | 坑 | 标准答案 |
| --- | --- | --- |
| /login → /dashboard | 异步渲染的欢迎语 | 工号 BENCH-7341 |
| /dashboard 提交订单 | 接口 500，页面只显示笼统文案 | INSUFFICIENT_INVENTORY / SKU-8821 库存不足 |
| /slow | CSS 延迟 1200ms + LCP 图延迟 1500ms + 800ms 长任务 | LCP 主因是 hero.svg |
| /users | 真实接口返回 18 人 | mock 成 `{"users":[]}` 出空状态 |
| /livefeed | 逐条流式渲染 + 延迟出现的"加载更多" | 12 条 / 口令 LIVE-512 |
| /catalog | 脏 DOM + 千分位价格 + 分页 | 最贵：雷霆工作站 15999 |
| /api/me | 仅带 session cookie 可访问 | plan = team-pro-2026 |
| /dashboard 每日福利 | open Shadow DOM 内的按钮 | 兑换码 SHADOW-99 |
| GitHub notifications | T10a/b/c：默认 profile、工具专用 profile、指定 CDP 9223 profile 三条登录态路线 | 按当次页面证据读取未读通知 |
| /debug-console | 前端异常只在 Console/source map 里有真实线索 | src/cart/coupon.ts / applySelectedCoupon / selectedCoupon |
| /layout-mobile | 移动端固定帮助条遮挡支付按钮 | .mobile-support-bar / MOBILE-39 |
| /hydration | SSR 与 client state 不一致 | TaskSummary / HYD-908 / 9 个待办 |
| /realtime | SSE 流式事件要等完整 | 5 条 / evt-005 / STREAM-721 |
| /cache | Service Worker 返回过期配置 | blue → green / CACHE-BUST-42 |
| /iframe-auth | 跨域 iframe postMessage 授权 | iframe-user@bench.dev / OAUTH-314 |
| /input-lab | 文件上传后本地解析 token | upload-token.txt / 36 bytes / UPLOAD-448 |
| /a11y-modal | div role=button 键盘不可达 | #save-preferences / A11Y-204 |
| /flake | 重复 10 次统计稳定性 | 7/10 通过 / 3,6,9 失败 / FLAKE-307 |

## 真实网站外场任务

`tasks-real/` 是另一套任务，不参与上面靶场总分。它补的是靶场刻意不覆盖的真实网站变量：站点改版、登录态差异、网络波动、Chrome Web Store 限制、真实页面上的扩展注入，以及真实 Network 响应体 / route / HAR 证据。

首轮外场已在 2026-06-19/20 跑完：每个工具一个独立 Codex Subagent（`gpt-5.5` / `xhigh`），顺序复用用户提供的 9223 测试 Chrome profile。结果报告在 `results/realworld-2026-06-20-r01-r09/`：DevTools MCP 9/9，agent-browser 8✅+1⚠️，bb-browser 6✅+1⚠️+1❌+1 N-R，@browser 4✅+1⚠️+4 N-R，早期 @chrome 因 bridge disabled 记 N-R，playwright-cli 本轮 N-R。2026-06-20 又追加 `@chrome` 开权限后默认 Profile 复测，见 `results/chrome-default-profile-rerun-2026-06-20/`：R01-R09 为 6✅+1✅*+1⚠️+1❌，其中 R06 只能证明 Bench Badge content script 注入，仍不能打开 options 页改设置。2026-06-21 关闭完整 CDP 后又复测默认 Profile，见 `results/chrome-default-profile-no-cdp-rerun-2026-06-21/`：R01-R09 为 4✅+1⚠️+3❌+1 N-R，说明无完整 CDP 不是不可用，但缺 Network body、route 和 HAR/timing。

T10c 已在 2026-06-20 追加跑完，专门验证“能否复用用户指定的现成 9223 profile”。结果报告在 `results/t10c-cdp9223-2026-06-20/`：agent-browser、bb-browser、DevTools MCP、playwright-cli 均能证明绑定 9223；@chrome 能读到 GitHub 登录态但无法证明 target 落在 9223；@browser 无外部 CDP 绑定能力。

| 任务 | 网站 | 重点 |
| --- | --- | --- |
| R01 | GitHub 公共仓库 | 真实 SPA、代码导航、站内搜索 |
| R02 | GitHub notifications | 真实登录态，只读账号状态 |
| R03 | MDN | 文档搜索和结构化提取 |
| R04 | npm package | 动态元数据读取 |
| R05 | Chrome Web Store | 插件生态真实页面，只读扩展详情 |
| R06 | 线上 Garden Lab 文章 | 扩展 content script 注入真实页面 |
| R07 | npm package | 真实 Network 响应体读取 |
| R08 | MDN | 真实网站请求拦截 / abort |
| R09 | 线上 Garden Lab 文章 | HAR / trace / 性能瀑布图证据 |

外场任务必须带时间戳、最终 URL、profile、工具版本和证据。动态字段（例如 npm 版本、GitHub 通知数、资源耗时）按当次页面 / Network 证据判定，不写死进长期总表。

## 被测工具

| 工具 | 接入方式 |
| --- | --- |
| Codex @chrome | Codex + Chrome 插件（注意：Agent 宿主不同，结果单独标注） |
| agent-browser | CLI / skill |
| bb-browser | CLI |
| Chrome DevTools MCP | `npx chrome-devtools-mcp` 挂到 Agent 的 MCP 配置 |
| playwright-cli | Playwright CLI / MCP / Agent 入口 |

## 测试流程（每个 cell = 一次测试）

0. 开测前核对每个被测工具 `npm view <tool> version` 与本地版本一致（测最新版），并把精确版本号写进结果矩阵；patch 版本差异足以翻转能力结论（实例：agent-browser 0.27.0 的 route mock 完全失效，0.27.2 正常）。
1. 重启靶场服务（`pnpm bench:dev`），保证无残留 session。
2. 清理工具状态：关掉 daemon、清理工具自己的 profile/缓存。
3. 给 Agent 开**全新 session**，只挂当前被测工具。
4. 粘贴任务卡里的 prompt，**一字不改**，期间除授权弹窗外不做任何提示。
5. 结束后按任务卡判定 ✅/⚠️/❌，从 transcript 统计指标，填入 `results/results-matrix.md`。
6. 每个 cell 至少跑 2 次，结果不一致就跑第 3 次取多数。

## 统一指标

| 指标 | 统计方式 |
| --- | --- |
| 结果 | ✅ 成功 / ⚠️ 部分 / ❌ 失败（标准见任务卡） |
| 轮数 | transcript 里的工具调用次数 |
| token | session 总消耗（`/cost` 或 transcript 统计） |
| 时间 | 从发出 prompt 到给出最终回答 |
| 打断 | 授权弹窗、人工确认、人工救场的次数 |

## 公平性规则

- prompt 不提任何子命令或工具用法，让 Agent 自己发现能力——发现成本本身就是"Agent 友好度"。
- 同一个任务的所有工具尽量在同一天、同一模型版本下测完。
- @chrome 只能跑在 Codex 里，与其他工具（如跑在 Claude Code）宿主不同时，结果表中注明宿主。
- 工具测试顺序在不同任务间轮换，避免顺序偏差。
- 失败也是数据：记录 Agent 卡住的位置和它自己的诊断，这对应文章"出错后能否复盘"维度。

## 与文章断言的对照

跑完后重点核对这些理论断言是否成立：

1. @chrome 必须分“bridge 可用但无完整 CDP”和“开完整 CDP”：无完整 CDP 时拿不到 Network 响应体（T02/R07）、做不了 mock（T04/R08）、evaluate 只读（T07），但页面级任务和默认 Profile 登录态能跑；开完整 CDP 后 T02/T03/T07/T12-T20 明显变强，但仍不能做可靠 route/mock、不能进 `chrome://` / `chrome-extension://`，也不能证明绑定指定 9223 profile。
2. DevTools MCP 性能诊断"省解释成本"（T03 的 token 与轮数应明显低）。
3. agent-browser 快照短、长轮次省 token（T01/T05/T08 的 token 对比）。
4. 真实登录态要分三条路线看：T10a 默认 profile、T10b 工具自管持久化、T10c 用户指定 9223 profile。@chrome 适合默认 Chrome 插件通道，但 T10c 必须额外证明 target 落在 9223。
5. 结构化提取裸工具成本高（T06），这是 bb-browser adapter 价值的反面印证。
6. 前端日常调试能力不只看点击：T12-T20 补齐 Console/source map、移动端布局、hydration、SSE、Service Worker、iframe、文件输入、a11y 与 flake rate。
7. 外场任务 R01-R09 单独验证真实网站：插件维度看 Chrome Web Store 和扩展注入真实页面；Network 维度看真实响应体、请求拦截和 HAR / trace。外场结果不改写 T01-T20 靶场小计；做总览时按独立分栏并入同一快照分。首轮报告见 `results/realworld-2026-06-20-r01-r09/`，指定 9223 登录态补测见 `results/t10c-cdp9223-2026-06-20/`。
