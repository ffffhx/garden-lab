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
tasks/              任务卡 T01-T11，每张含逐字 prompt、ground truth、判定标准
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

## 被测工具

| 工具 | 接入方式 |
| --- | --- |
| Codex @chrome | Codex + Chrome 插件（注意：Agent 宿主不同，结果单独标注） |
| agent-browser | CLI / skill |
| bb-browser | CLI |
| Chrome DevTools MCP | `npx chrome-devtools-mcp` 挂到 Agent 的 MCP 配置 |
| Playwright | Agent 写脚本执行（裸 Playwright，无封装） |

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

1. @chrome 拿不到 Network 响应体（T02）、做不了 mock（T04）、evaluate 只读（T07）。
2. DevTools MCP 性能诊断"省解释成本"（T03 的 token 与轮数应明显低）。
3. agent-browser 快照短、长轮次省 token（T01/T05/T08 的 token 对比）。
4. 真实登录态场景 @chrome 打断最少（T10 的打断计数）。
5. 结构化提取裸工具成本高（T06），这是 bb-browser adapter 价值的反面印证。
