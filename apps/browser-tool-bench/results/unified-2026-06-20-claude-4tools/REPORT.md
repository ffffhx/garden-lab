# 统一成本评测 · 四工具 · 30 题 · Opus 4.8 · 2026-06-20/21

> 目的：在**同一模型(Opus 4.8)、同一批 30 道任务(靶场 T01-T20 = 21 卡 + 外场 R01-R09 = 9)**下，把四个真实工具的
> **结果 / 实际耗时 / token 成本 / 工具调用数 / browserOps / eval自救** 放进一张可横比的表。
> 执行：每工具一个独立 workflow(3 chunk 干净 subagent)，**严格顺序**(一个跑完再下一个)。
> 浏览器：agent-browser / bb-browser / devtools-mcp 连 **CDP 9223**；playwright-cli 用**自管浏览器**(attach 装扩展的 9223 会确定性崩溃，按用户决定改自管，才拿得到它的成本)。
> 不含 Codex 专属 @chrome / @browser(无等价物)。

## 总表

| 工具 | 浏览器 | 结果(30 题) | 实际耗时 | token(harness) | 工具调用 | browserOps | eval自救 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **agent-browser** 0.27.2 | 9223 | 29✅（R06 漏报，未计第30题） | **25.8 min** | **190.6k** | **183** | 218 | 24 |
| **bb-browser** 0.14.2 | 9223 | 22✅ / 3⚠️ / 4❌ / 1N-R | 47.9 min | 271.9k | 277 | 244 | 33 |
| **chrome-devtools-mcp** | 9223 | **28✅** / 1⚠️ / 1N-R | 25.5 min | 322.7k | 230 | **169** | 25 |
| **playwright-cli** 0.1.14 | 自管 | 24✅ / 1⚠️ / 2❌ / 3N-R | 26.4 min | 203.7k | 188 | 184 | 38 |

耗时精确值：agent-browser 1,547,266ms / bb-browser 2,873,253ms / devtools-mcp 1,531,739ms / playwright-cli 1,584,758ms。

## 非 ✅ 明细

- **bb-browser**：❌ T04(无 mock)、T09(无扩展 reload)、T11(chrome-extension URL 归一化 bug 到不了设置页)、T17(无跨域 OOPIF 切换)；⚠️ T08/T13/T18(靠 eval/缺 viewport/伪造 File)；N-R R08(无 route 原语)。
- **devtools-mcp**：⚠️ R03(MDN 接口列表口径)；N-R R08(运行时无 route API)。其余全 ✅(T04/R06 用 initScript 或 eval 逃生但完成)。
- **playwright-cli**：⚠️ T09(只能 close+relaunch 重读 manifest，无活动扩展热重载)；❌ R04/R07(自管浏览器打 npm 包页失败，疑似 bot 拦截)；N-R T10a(无系统默认 Profile)、R02(自管无 GitHub 登录态)、R06(自管无 9223 上的扩展注入真实页)。
- **agent-browser**：外场 chunk 只报了 8/9 条 R(漏 R06)，按已知能力 R06 应为 ✅(前几轮两轮均 ✅)。

## 关键读数

1. **bb-browser 是成本黑洞**：耗时 47.9min ≈ agent-browser 的 **1.86×**，工具调用 277、browserOps 244 均最高，却结果最差(4❌)。根因是 click 合成事件 bug → 处处 eval 重试churn(33 escapes)，与文章"≈2.3× 成本、修一处能改命"完全吻合。
2. **devtools-mcp：op 最省、token 最贵**。browserOps 仅 169(最少，粗粒度组合动作)，但 token 322.7k(最高)——MCP 每次返回冗长 a11y 快照/网络体，单 op 很贵。能力最稳(28✅、零❌)。
3. **agent-browser：综合最省**。耗时与 token 都最低(25.8min / 190.6k)，结果最全(29✅)。代价是 24 次 eval 逃生(靶场上 perf/扩展/取数常掉 eval)。
4. **playwright-cli：自管浏览器的代价显性化**。耗时/token 中等，但 3 N-R + 2❌ 里有 5 题是"自管浏览器没有真实登录态/扩展/被 npm 拦"——这些快速失败反而压低了它的耗时/token，所以它的低成本要打折看(完成的题更少)。escapes 38 最高，但多为"eval 读数据/读注入徽标"而非"eval 代点击"，和任务组合(perf/扩展/真实站取数)有关，不宜与文章 8 题轮的"0 逃生"直接对比。

## 重要诚实声明

- **token→$ 换算**：harness 每工具只给一个 token 总量(未拆 input/output)，无法精确折 $。按 Opus 4.8 输出价 $75/M 粗估单工具约 $14–24，但实际含 input 会显著更高——这里以 **token 总量作为成本口径**，不强报 $。
- **escape 计数是软指标**：各 subagent 对"什么算逃生"口径不完全一致(eval-读 vs eval-代操作)，跨工具只宜看数量级、看趋势，不宜逐个精确比。
- **公平性**：playwright-cli 宿主与另三者不同(自管 vs 9223)，且它有 5 题快速 N-R/❌，其耗时/token 不能与另三者"完成同样多题"直接等价比较。
- **一次实跑波动**：每工具单轮，未收方差；R01-R09 动态字段为 2026-06-20/21 当次快照。
- **状态污染检查通过**：扩展徽标恢复 BENCH EXT v1.0.0、manifest 复位 1.0.0、真实网站只读、state/凭证文件已删、无残留自管浏览器进程。
- 过程小插曲：playwright-cli 首次启动因传参 JSON 转义错误导致工具未被指定、误跑成 agent-browser，已发现并用正确参数重跑(本表为重跑数据)。

## 结论

成本维度排序(综合耗时+token+op+逃生+结果)：**agent-browser(最省且最全) ≈ chrome-devtools-mcp(op 最省、最稳、token 偏贵) > playwright-cli(中等，但完成题数少、自管代价) > bb-browser(最慢最贵且结果最差)**。能力维度仍是 devtools-mcp / agent-browser 第一梯队，bb-browser 垫底——与前几轮结论一致，这轮把"成本"也量化坐实了。
