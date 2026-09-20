# Jev 优先执行 × Garden Lab 原任务复测

运行批次：jev-core-2026-09-20T11-31-48-371Z。已完成 5/36 次。

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
| T05 动态列表 | 1/1 | 61.0 | 0/1 | — | 1/1 | —（0 对） |
| T06 分页商品 JSON | 1/1 | 135.2 | 1/1 | 172.9 | 1/1 | 21.8%（1 对） |
| T15 SSE 实时流 | 1/1 | 9.4 | 0/0 | — | 0/1 | —（0 对） |
| T20 10 次检查统计 | 0/0 | — | 0/0 | — | 0/0 | —（0 对） |
| T08 登录与 Shadow DOM | 0/0 | — | 0/0 | — | 0/0 | —（0 对） |
| T18 文件上传 | 0/0 | — | 0/0 | — | 0/0 | —（0 对） |

正数表示 Jev 优先更快，负数表示更慢。失败率必须和耗时一起看；成功样本数不同的两列中位数不能单独当作公平配对结论。

```json
{
  "driver": {
    "runs": 3,
    "passed": 3,
    "fallback": 2,
    "jevActions": 2,
    "jevCalls": 11,
    "helperCalls": 1,
    "sdkEstimatedUsd": 0.212563,
    "infrastructureFailures": 0,
    "unverifiedCompletions": 0
  },
  "advisory": {
    "runs": 2,
    "passed": 1,
    "fallback": 2,
    "jevActions": 0,
    "jevCalls": 2,
    "helperCalls": 0,
    "sdkEstimatedUsd": 0.27652499999999997,
    "infrastructureFailures": 1,
    "unverifiedCompletions": 0
  }
}
```

## 全部运行

| 任务 | 轮次 | 模式 | 结果 / 状态 | 秒 | Jev 直接动作 | 文本辅助 | 完整 SDK | 分类 | 证据 |
| --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| T05 | 1 | driver | pass / completed | 61.0 | 0 | 0 | 是 | 通过 | [JSON](T05-driver-r1.json) |
| T05 | 1 | advisory | fail / waiting_user | 93.0 | 0 | 0 | 是 | 连接/会话异常 | [JSON](T05-advisory-r1.json) |
| T06 | 1 | advisory | pass / completed | 172.9 | 0 | 0 | 是 | 通过 | [JSON](T06-advisory-r1.json) |
| T06 | 1 | driver | pass / completed | 135.2 | 1 | 0 | 是 | 通过 | [JSON](T06-driver-r1.json) |
| T15 | 1 | driver | pass / completed | 9.4 | 1 | 1 | 否 | 通过 | [JSON](T15-driver-r1.json) |

## 复现

在 ProfilePilot 仓库运行：

```powershell
node scripts/bench-jev-garden.mjs <明确分配的独立Profile-ID> <逻辑端口> 3
node scripts/summarize-jev-benchmark.mjs <本次结果目录>
```

测试账号和文件均为原靶场虚构数据。不要使用正在由用户或其他会话控制的 Profile。
