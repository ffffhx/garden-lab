# Jev 优先执行 × Garden Lab 原任务复测

运行批次：jev-core-2026-09-20T12-39-30-184Z。已完成 36/36 次。

**批次状态：36 次尝试已全部记录。Jev 优先 17/18 通过，原流程 18/18；CDP 连接归属错误 0。第 32 条输出格式不符，并因超时收尾异常中断；保留该条失败后继续余下四条。超时异常已在评测结束后修复，通过 70 项回归；原始成绩未改变。**

## 原题正确性与产品完成分开统计

**原题验收**要求答案正确且独立页面状态与请求日志证明确实操作；**产品完成**在此基础上还要求状态为 completed。后者比原文题目多一层交付要求。答案正确但 finish_task 证据格式校验失败而返回 partial，记作原题通过、产品未正常完成。原始 grade 保留不改。

表中“原题；产品”分开计数。时间是原题通过样本的中位数（最小–最大），单位秒；配对仅取同题同轮两组均通过原题验收的样本。回退 SDK 的运行仍计入 Jev 组，不按实际执行路径事后挑选样本。

| 任务 | Jev 原题；产品 | Jev 中位数（范围） | 原流程 原题；产品 | 原流程中位数（范围） | Jev 启动 SDK | 配对耗时减少中位数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| T05 动态列表 | 3/3；3/3 | 55.7（45.7–57.5） | 3/3；3/3 | 75.2（66.9–86.2） | 3/3 | 31.7%（3 对） |
| T06 分页商品 JSON | 2/3；2/3 | 175.5（128.5–222.6） | 3/3；3/3 | 158.9（120.0–182.5） | 3/3 | -27.9%（2 对） |
| T15 SSE 实时流 | 3/3；3/3 | 14.0（13.7–17.9） | 3/3；3/3 | 44.8（42.4–56.4） | 0/3 | 68.3%（3 对） |
| T20 10 次检查统计 | 3/3；3/3 | 74.0（52.4–80.4） | 3/3；3/3 | 85.3（81.5–86.5） | 3/3 | 13.2%（3 对） |
| T08 登录与 Shadow DOM | 3/3；3/3 | 108.3（106.1–113.1） | 3/3；3/3 | 130.3（122.5–134.5） | 3/3 | 16.9%（3 对） |
| T18 文件上传 | 3/3；3/3 | 57.8（53.5–61.6） | 3/3；3/3 | 80.1（58.6–87.7） | 3/3 | 23.1%（3 对） |

### 测试准备与边界

- 独立的准备会话先打开相同首页并结束，然后才启动正式任务会话和计时。浏览器已启动，因此不测应用冷启动。
- 预试验 jev-core-2026-09-20T11-31-48-371Z（6 条）和旧正式批次 jev-core-2026-09-20T11-42-02-059Z（8 条）均因 CDP 会话归属拒绝中断，整批保留，均不混入本次结果。前一批调整了测试准备方式；后一批定位到页面控制条错误采用并释放了 Agent 的 CDP Session。
- 修复页面控制条的 Session 归属后，通过 78 项回归检查及真实浏览器 12 次循环验证，再单独重启桌面应用加载修复。Gateway 和四个 Chrome 进程保留。本批次从头运行 36 次，期间冻结产品执行代码；详见旧正式批次中的 GATEWAY-DIAGNOSIS.md。
- 本批第 32 条 T06-driver-r3 遇到四分钟定时器对 partial 任务执行 pause 的未处理异常，进程退出。保留该条失败，不重跑替换；原文件商品数值正确，但 columns/rows 格式不满足题目要求的对象数组。240 秒为时限截尾标记，不是精确完成耗时；独立验收、请求日志和最终 SDK 用量缺失。随后核验同一产品哈希、模型、Gateway 和 Profile，仅继续余下四条。详见 RUNTIME-INTERRUPTION.md；manifest.continuations 记录恢复时间。因此这是有一次运行中断并恢复的 36 次尝试，不是连续无故障的 36 次运行。
- 正式批次首次出现会话归属拒绝即停止，不重试绕过。每次正式运行前核验产品代码哈希。
- 未纳入 Network mock、性能追踪、扩展安装等开发者工具任务，因为超出当前产品的页面操作工具范围。也不与旧文章六种工具的历史数字直接排名。
- 每题每组只有三次，本地受控任务不代表淘宝、BOSS 或内网页面的普遍效果。线上延迟和缓存会波动，不能据此断言统计显著性。

## 条件与口径

复用文章《浏览器 Agent 工具怎么选》对应的六张原任务卡和原页面：T05、T06、T08、T15、T18、T20。题目逐字复用，原文不会改写为本次结果。三轮、两种模式，共 36 次计划执行。

- 主模型：kimi-k3；Jev：typesafe；Windows、同一已启动的真实 Chrome 独立测试 Profile，Gateway 端口 9227。
- 每次新建任务存储及 SDK 会话，清空靶场服务端测试登录态；从相同首页开始，模式顺序交替，任务顺序每轮轮换。附件仅预先选定原任务的 upload-token.txt。
- 两组使用相同题目、授权、时间/动作/SDK 费用上限。每任务最多 4 分钟、35 次操作、SDK 估算费用上限 0.6 美元。准备首页与独立验收不计时；任务执行、SDK 收尾与释放计时。
- 成功要求：Agent 报告 completed、答案符合原标准、独立页面状态及请求记录符合原标准。JSON 提取逐项验证 12 件商品的名称、数字价格、库存和排序；上传验证实际 File 对象。验收答案和源码没有传给模型。
- 失败、超时、人工请求保留，不人工救场，不把失败快速退出算作提速。成功耗时只对成功样本取中位数；配对变化只计算同题同轮两组都成功的样本。
- 原流程是“Kimi/Claude Agent SDK 执行 + Jev 辅助”，不是纯 Kimi，也不是 Codex。新流程同时改变页面读取、模型调用与辅助方式，因此不是 Jev 模型本身的独立消融实验。
- 每个运行前验证执行代码哈希未变。源文件和原题哈希见 [manifest.json](manifest.json)。测试站只增加私有 IPC 重置与请求日志，不改页面和业务响应。
- SDK 金额不包含 Jev、直接文本辅助，不可作为总费用比较。缓存和线上模型延迟仍可能波动；本地三轮样本不能代表所有网站。

## 汇总

| 任务 | Jev 成功 | 成功中位数/秒 | 原流程成功 | 成功中位数/秒 | Jev 启动完整 SDK | 成功配对耗时减少中位数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| T05 动态列表 | 3/3 | 55.7 | 3/3 | 75.2 | 3/3 | 31.7%（3 对） |
| T06 分页商品 JSON | 2/3 | 175.5 | 3/3 | 158.9 | 3/3 | -27.9%（2 对） |
| T15 SSE 实时流 | 3/3 | 14.0 | 3/3 | 44.8 | 0/3 | 68.3%（3 对） |
| T20 10 次检查统计 | 3/3 | 74.0 | 3/3 | 85.3 | 3/3 | 13.2%（3 对） |
| T08 登录与 Shadow DOM | 3/3 | 108.3 | 3/3 | 130.3 | 3/3 | 16.9%（3 对） |
| T18 文件上传 | 3/3 | 57.8 | 3/3 | 80.1 | 3/3 | 23.1%（3 对） |

正数表示 Jev 优先更快，负数表示更慢。失败率必须和耗时一起看；成功样本数不同的两列中位数不能单独当作公平配对结论。

```json
{
  "driver": {
    "runs": 18,
    "passed": 17,
    "fallback": 15,
    "jevActions": 12,
    "jevCalls": 53,
    "helperCalls": 9,
    "sdkEstimatedUsd": 1.17195875,
    "infrastructureFailures": 0,
    "unverifiedCompletions": 0
  },
  "advisory": {
    "runs": 18,
    "passed": 18,
    "fallback": 18,
    "jevActions": 0,
    "jevCalls": 41,
    "helperCalls": 0,
    "sdkEstimatedUsd": 1.626697,
    "infrastructureFailures": 0,
    "unverifiedCompletions": 0
  }
}
```

## 全部运行

| 任务 | 轮次 | 模式 | 结果 / 状态 | 秒 | Jev 直接动作 | 文本辅助 | 完整 SDK | 分类 | 证据 |
| --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| T05 | 1 | driver | pass / completed | 45.7 | 0 | 0 | 是 | 通过 | [JSON](T05-driver-r1.json) |
| T05 | 1 | advisory | pass / completed | 66.9 | 0 | 0 | 是 | 通过 | [JSON](T05-advisory-r1.json) |
| T06 | 1 | advisory | pass / completed | 120.0 | 0 | 0 | 是 | 通过 | [JSON](T06-advisory-r1.json) |
| T06 | 1 | driver | pass / completed | 222.6 | 1 | 0 | 是 | 通过 | [JSON](T06-driver-r1.json) |
| T15 | 1 | driver | pass / completed | 14.0 | 1 | 1 | 否 | 通过 | [JSON](T15-driver-r1.json) |
| T15 | 1 | advisory | pass / completed | 42.4 | 0 | 0 | 是 | 通过 | [JSON](T15-advisory-r1.json) |
| T20 | 1 | advisory | pass / completed | 85.3 | 0 | 0 | 是 | 通过 | [JSON](T20-advisory-r1.json) |
| T20 | 1 | driver | pass / completed | 74.0 | 1 | 0 | 是 | 通过 | [JSON](T20-driver-r1.json) |
| T08 | 1 | driver | pass / completed | 108.3 | 1 | 2 | 是 | 通过 | [JSON](T08-driver-r1.json) |
| T08 | 1 | advisory | pass / completed | 130.3 | 0 | 0 | 是 | 通过 | [JSON](T08-advisory-r1.json) |
| T18 | 1 | advisory | pass / completed | 80.1 | 0 | 0 | 是 | 通过 | [JSON](T18-advisory-r1.json) |
| T18 | 1 | driver | pass / completed | 61.6 | 0 | 0 | 是 | 通过 | [JSON](T18-driver-r1.json) |
| T15 | 2 | advisory | pass / completed | 44.8 | 0 | 0 | 是 | 通过 | [JSON](T15-advisory-r2.json) |
| T15 | 2 | driver | pass / completed | 13.7 | 1 | 1 | 否 | 通过 | [JSON](T15-driver-r2.json) |
| T20 | 2 | driver | pass / completed | 52.4 | 1 | 0 | 是 | 通过 | [JSON](T20-driver-r2.json) |
| T20 | 2 | advisory | pass / completed | 86.5 | 0 | 0 | 是 | 通过 | [JSON](T20-advisory-r2.json) |
| T08 | 2 | advisory | pass / completed | 122.5 | 0 | 0 | 是 | 通过 | [JSON](T08-advisory-r2.json) |
| T08 | 2 | driver | pass / completed | 113.1 | 1 | 2 | 是 | 通过 | [JSON](T08-driver-r2.json) |
| T18 | 2 | driver | pass / completed | 53.5 | 0 | 0 | 是 | 通过 | [JSON](T18-driver-r2.json) |
| T18 | 2 | advisory | pass / completed | 58.6 | 0 | 0 | 是 | 通过 | [JSON](T18-advisory-r2.json) |
| T05 | 2 | advisory | pass / completed | 86.2 | 0 | 0 | 是 | 通过 | [JSON](T05-advisory-r2.json) |
| T05 | 2 | driver | pass / completed | 57.5 | 0 | 0 | 是 | 通过 | [JSON](T05-driver-r2.json) |
| T06 | 2 | driver | pass / completed | 128.5 | 1 | 0 | 是 | 通过 | [JSON](T06-driver-r2.json) |
| T06 | 2 | advisory | pass / completed | 182.5 | 0 | 0 | 是 | 通过 | [JSON](T06-advisory-r2.json) |
| T08 | 3 | driver | pass / completed | 106.1 | 1 | 2 | 是 | 通过 | [JSON](T08-driver-r3.json) |
| T08 | 3 | advisory | pass / completed | 134.5 | 0 | 0 | 是 | 通过 | [JSON](T08-advisory-r3.json) |
| T18 | 3 | advisory | pass / completed | 87.7 | 0 | 0 | 是 | 通过 | [JSON](T18-advisory-r3.json) |
| T18 | 3 | driver | pass / completed | 57.8 | 0 | 0 | 是 | 通过 | [JSON](T18-driver-r3.json) |
| T05 | 3 | driver | pass / completed | 55.7 | 0 | 0 | 是 | 通过 | [JSON](T05-driver-r3.json) |
| T05 | 3 | advisory | pass / completed | 75.2 | 0 | 0 | 是 | 通过 | [JSON](T05-advisory-r3.json) |
| T06 | 3 | advisory | pass / completed | 158.9 | 0 | 0 | 是 | 通过 | [JSON](T06-advisory-r3.json) |
| T06 | 3 | driver | fail / partial | ≥240（中断） | 1 | 0 | 是 | 运行时异常；输出格式不符；记录恢复 | [JSON](T06-driver-r3.json) |
| T15 | 3 | driver | pass / completed | 17.9 | 1 | 1 | 否 | 通过 | [JSON](T15-driver-r3.json) |
| T15 | 3 | advisory | pass / completed | 56.4 | 0 | 0 | 是 | 通过 | [JSON](T15-advisory-r3.json) |
| T20 | 3 | advisory | pass / completed | 81.5 | 0 | 0 | 是 | 通过 | [JSON](T20-advisory-r3.json) |
| T20 | 3 | driver | pass / completed | 80.4 | 1 | 0 | 是 | 通过 | [JSON](T20-driver-r3.json) |

## 复现

在 ProfilePilot 仓库运行：

```powershell
node scripts/bench-jev-garden.mjs <明确分配的独立Profile-ID> <逻辑端口> 3
node scripts/summarize-jev-benchmark.mjs <本次结果目录>
```

测试账号和文件均为原靶场虚构数据。不要使用正在由用户或其他会话控制的 Profile。
