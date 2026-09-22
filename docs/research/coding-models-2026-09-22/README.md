**Coding 模型与 Agent 综合调研｜2026-09-22**

结论：在本次选取的八个模型配置中，Fable 5.1 的代码生成与代码修改表现最稳定；Astra 的统一框架终端执行表现最强。实际产品 Agent 的测试里，Fable 5.1 + Claude Code 与 Astra + Codex 属于同一领先梯队。综合考虑该 Agent 测试中的质量、API 成本和耗时，Astra + Codex 是很有依据的主力选择；偏代码生成、算法实现，可以优先看 Fable 5.1。

这是一份公开评测的研究汇总，没有重新调用模型跑测。三个 Agent 分别核查编码任务、Agent 可靠性、模型效率，最后统一版本与口径。下文“综合分”是本报告的计算结果，不是官方榜单、能力百分比或行业共识。

**范围与版本**

- 主表八个配置：GPT-6 Astra、GPT-5.6 Sol / Terra / Luna、Claude Fable 5 / 5.1、Gemini 3.8 Flash、Grok 4.7。
- Gemini 当前通用系列最新为 3.8 Flash；Pro 参照为 3.1 Pro Preview。3.8 Live 为语音产品，不列入 coding 主表。[Google 模型目录](https://ai.google.dev/gemini-api/docs/models)、[更新日志](https://ai.google.dev/gemini-api/docs/changelog)
- LiveBench 使用 `2026-06-25` 题集；这是题集版本，不是新模型测试日期。Vals TB2.1 页面更新于 9 月 21 日。AA 模型数据为当前 v4.3.2，Agent 数据为 v1.5。访问日期均为 2026-09-22。
- Fable 的部分成绩包含服务端 fallback，即请求触发安全机制后改由 Opus 回答。它们是公开服务配置成绩，不能全部归因于单一模型。具体逐表说明。

**怎样判断这些榜单是否值得参考**

| 来源 | 本报告采用的内容 | 为什么采用 | 主要限制 |
|---|---|---|---|
| LiveBench | 代码生成、Agentic Coding、通用 IF | 原始 CSV 与分类映射公开，可复核计算 | 公开题集有污染风险；分类名称不能当成完整工程能力 |
| Vals | 统一 Terminus 2 的 Terminal-Bench 2.1、任务成本与时间 | 同框架横比，披露配置与标准误 | 推理档位不同，部分有 fallback；不是同成本预算比较 |
| Artificial Analysis | mini-swe-agent 的 TB4、SciCode、AA-LCR，以及单独的原生 Agent 榜 | 方法、版本与分项明确，覆盖当前型号较好 | 私有测试、模型裁判、商业机构的取舍仍影响结果 |
| SkillsBench / Vals | 提供 skills 前后的任务通过率 | 能观察 skills 的实际帮助 | 不等于“正确召回技能”的准确率；新模型缺项 |
| MTAC-IFBench / METR | 多轮工程指令、长任务测量方法 | 对应普通 coding 榜遗漏的能力 | 当前目标新型号覆盖不足，不参与综合分 |
| CodeRabbit | 专项代码审查案例 | 有真实审查系统经验 | 不同文章的系统与指标不同，无法拼成统一名次 |

没有一家在所有能力上都更权威。这里优先看同题、同框架、公开方法和原始分项，并用不同来源互相核对；没有使用 AA 的总“智能指数”代替 coding 排名。

原始入口：[LiveBench 数据](https://livebench.ai/table_2026_06_25.csv)、[分类映射](https://livebench.ai/categories_2026_06_25.json)、[Vals TB2.1](https://www.vals.ai/benchmarks/terminal-bench-2-1)、[AA 模型方法](https://artificialanalysis.ai/methodology/intelligence-benchmarking)、[AA Agent 方法](https://artificialanalysis.ai/methodology/coding-agents-benchmarking)。

**一、共同覆盖的 coding 综合排名**

下表综合五项测试，归为三个等权领域：代码生成、代码修改、终端执行。它覆盖十类需求中的可比核心部分；代码审查、工程指令遵循、安全防御等缺少完整数据的能力没有被假装纳入。

| 参考顺序 | 模型 | 本报告合成分 | LiveBench 代码生成 | LiveBench Agentic Coding | SciCode | Vals TB2.1 | AA 模型 TB4 |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | Claude Fable 5.1* | 97.6 | 86.4 | 66.1 | 63 | 85.0 | 52 |
| 2 | GPT-6 Astra | 92.6 | 80.4 | 57.3 | 56 | 87.3 | 59 |
| 3 | Claude Fable 5* | 91.3 | 86.0 | 62.2 | 61 | 80.5 | 42 |
| 4 | GPT-5.6 Sol | 87.3 | 83.9 | 56.2 | 57 | 85.8 | 40 |
| 5 | GPT-5.6 Terra | 82.1 | 78.2 | 54.9 | 55 | 77.5 | 35 |
| 6–7 | Gemini 3.8 Flash | 77.6 | 72.5 | 54.2 | 57 | 81.3 | 20 |
| 6–7 | Grok 4.7 | 77.5 | 77.2 | 51.8 | 57 | 73.4 | 26 |
| 8 | GPT-5.6 Luna | 73.2 | 82.9 | 48.4 | 54 | 79.0 | 12 |

五个原始成绩列均以百分数展示；合成分不是成功率。Gemini 与 Grok 的微小差距不应解释为确定强弱。范围是本次八个配置，不是全球所有模型名次。

LiveBench 的 Coding 是代码生成与补全任务平均值，Agentic Coding 是 Python、JavaScript、TypeScript 三项平均值。后者提供代码修改证据，但不等于完整的大型仓库维护。SciCode 是科学计算编程，采用 AA 的子问题评分，不是完整科学项目成功率。

来源：[LiveBench 原始表](https://livebench.ai/table_2026_06_25.csv)、[Vals 原榜](https://www.vals.ai/benchmarks/terminal-bench-2-1)。AA 分项逐组来源：[Astra / Fable 5.1](https://artificialanalysis.ai/models/comparisons/gpt-6-astra-vs-claude-fable-5-1)、[Fable 5](https://artificialanalysis.ai/models/comparisons/gpt-6-astra-vs-claude-fable-5)、[Sol / Gemini](https://artificialanalysis.ai/models/comparisons/gemini-3-8-flash-vs-gpt-5-6-sol)、[Terra / Luna](https://artificialanalysis.ai/models/comparisons/gpt-5-6-luna-vs-gpt-5-6-terra)、[Grok 4.7 原始评测图](https://cdn.sanity.io/images/6vfeftx9/articles/1f2405a4068e4d384ea3079fef3c1df8a82c9bb1-4864x4072.png)。

配置限制：

- LiveBench：GPT 与 Fable 均为 max；Gemini 为 high，Grok 为 xhigh。
- Vals：Fable 5.1 为 **high**，不是 max；Fable 5 为 max，且明确含 Opus 4.8 fallback。其余 GPT 为 max，Gemini 为 high，Grok 为 xhigh。Fable 5.1 的公开行没有足够信息拆出无 fallback 结果。
- AA：Fable 5.1 为 max + default fallback；Fable 5 为 max + Opus 4.8 fallback。因此星号不能省略。不能用本表断言“纯 Fable 模型”必胜。
- Vals TB2.1 用 Terminus 2；AA 模型 TB4 用 mini-swe-agent。每个榜内部有统一框架，两个榜之间并非同一个实验。
- AA 分项这里只取得整数显示精度，没有捏造小数。Vals 有标准误，但本报告没有跨榜成对显著性检验，合成分没有统计置信区间。

fallback 披露：[Fable 5.1](https://artificialanalysis.ai/articles/claude-fable-5-1)、[Fable 5](https://artificialanalysis.ai/articles/claude-fable-5-mythos-intelligence-index)。

**计算方法与敏感性**

每项先除以本次八个配置中的最高成绩，再乘 100，得到相对于该项领先者的分数。随后：

```text
生成分 = 平均(标准化 LiveBench Coding, 标准化 SciCode)
修改分 = 标准化 LiveBench Agentic Coding
终端分 = 平均(标准化 Vals TB2.1, 标准化 AA TB4)
综合分 = (生成分 + 修改分 + 终端分) / 3
```

这是透明的选型摘要，不是经过外部验证的新 benchmark。它避免直接相加不同量纲，也让两个终端榜只占一个领域；但归一化不能消除题目难度、框架和预算差异。这些测试也并非统计独立。更换候选集合、权重或计分方法，名次可能变化。

| 方案 | 生成 / 修改 / 终端权重 | 前四名 | 需要注意 |
|---|---|---|---|
| 默认 | 各 1/3 | Fable5.1、Astra、Fable5、Sol | 主表采用 |
| 偏终端执行 | 20% / 20% / 60% | Fable5.1、Astra、Fable5、Sol | 前两名 95.67 / 95.55，实际应视作同档 |
| 偏代码生成 | 60% / 20% / 20% | Fable5.1、Fable5、Astra、Sol | Fable5 与 Astra 次序反转 |
| 改用领域平均名次 | 各 1/3 | Fable5.1、Fable5、Astra、Sol | 同样说明第二、第三名依赖方法 |

Fable 5.1 在上述四种方案里均第一；这支持其在这些公开配置上的广泛优势，不证明所有软件开发工作都第一。Grok 与 Gemini 在不同权重下互换；应看下一张原生 Agent 表。

**二、实际 Codex / Claude Code 等 Agent 排名**

AA Coding Agent Index v1.5 使用三个子测试等权：DeepSWE v1.1、Terminal-Bench 4.0、SWE-Atlas-QnA。下面的分数属于“模型 + 软件 Agent + 配置”。它独立于上面的模型综合分，不能混到同一列。

| 目标配置 | Agent 指数 | 仓库修复 DeepSWE | 终端 TB4 | 仓库问答 Atlas | 美元/题 | 分钟/题 |
|---|---:|---:|---:|---:|---:|---:|
| Fable5.1 max + Claude Code，含 fallback | 62.2 | 64.3 | 57.6 | 64.8 | 12.39 | 34.8 |
| Astra max + Codex | 61.6 | 67.6 | 55.6 | 61.8 | 7.47 | 29.4 |
| Grok4.7 xhigh + Grok Build | 56.3 | 72.6 | 33.3 | 62.9 | 8.82 | 39.2 |
| Sol max + Codex | 54.6 | 72.3 | 37.4 | 54.0 | 6.35 | 20.6 |
| Gemini3.8 high + Antigravity SDK | 41.9 | 65.8 | 14.6 | 45.2 | 2.47 | 11.7 |

Fable5、Terra、Luna 在本版原生 Agent 榜缺项，不能当成零分。补充参照：Claude Opus5 + Claude Code 为 59.7，位于 Astra 与 Grok 之间；它不在八模型主表内。

前两名仅差约 0.58 分，没有成对显著性证据，适合归为同一档。Astra 该套任务平均 API 成本约低 40%，Agent 运行时间约短 15%；这支持以 Codex 为主力的效率判断。Grok 的仓库修复分很强，不能只看前面统一框架综合第六、第七档就认定它不擅长开发。

来源：[AA Agent 主榜](https://artificialanalysis.ai/agents/coding-agents)、[Claude Code / Codex](https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex)、[Codex / Grok Build](https://artificialanalysis.ai/agents/coding-agents/comparisons/codex-vs-grok-build)。

费用是该套测试的按量 API 成本，包含缓存价格，不是订阅费用或人工监督成本。时间是 Agent 活跃运行时间，未计环境启动、验收与裁判。Agent 软件版本随子测试而不同，详见 `aa-agents.json`，不能声称全表使用同一个软件版本。[AA 方法](https://artificialanalysis.ai/methodology/coding-agents-benchmarking)

**三、十项能力分别能得出什么结论**

| 需求 | 本次最相关证据 | 当前判断 | 覆盖情况 |
|---|---|---|---|
| 代码生成 | LiveBench Coding、SciCode | Fable5.1 / Fable5 领先这组配置 | 主表完整覆盖 |
| 代码理解与推理 | SWE-Atlas-QnA | Fable5.1、Grok、Astra 均有较强结果 | 原生 Agent 部分覆盖；通用 Reasoning 不是代码理解分 |
| 仓库级修复 | DeepSWE；LiveBench Agentic Coding 作辅助 | Grok Build / Sol-Codex 在 DeepSWE 突出；Fable 在另一类修改任务突出 | 依任务和 Agent 而变，没有统一赢家 |
| 终端与工具 | Vals TB2.1、AA 模型 TB4 | Astra 在两套统一框架结果里均领先 | 完整覆盖；原生 Agent 上 Fable 略高 |
| 代码审查 | CodeRabbit 专项 | Astra 对 Sol 有同篇比较优势；无法与 Fable 跨文章排序 | 缺共同实验，不计合成分 |
| 指令遵循 | LiveBench IF；MTAC-IFBench | 前者只能证明文本约束，后者未覆盖本次新型号 | 工程流程、AGENTS.md 遵循无完整新榜 |
| 长上下文 | AA-LCR v1.1 | Fable5.1 数字最高，其他数个模型接近 | 多文档代理指标，不能直接等同巨大代码库维护 |
| 长程 Agent | DeepSWE / TB4；METR | 任务完成率有证据，连续数小时自主可靠性缺最新全表 | 不把 METR 时间跨度解释成 Agent 无监督运行时长 |
| 安全与鲁棒性 | 模型卡、AA 拒绝与轨迹审计 | 可观察局部行为，不能排总体防注入能力 | 无完整同条件攻击测试，不计合成分 |
| 效率与成本 | Vals 任务成本/时间、AA Agent 成本/时间 | Astra 在头部 Agent 中更省；Luna 的低价很突出 | 完整或较完整，但依具体任务 |

因此，目前不能诚实地给出“这十项全部测齐”的单一权威榜。这里用数值主榜回答可比的部分，保留专项证据和缺口，让未知不会被算成差。

**指令、推理与长上下文的辅助分数**

| 模型 | LiveBench 通用 IF | LiveBench 通用 Reasoning | AA-LCR v1.1 |
|---|---:|---:|---:|
| Fable5.1 | 73.0 | 91.7 | 85 |
| Astra | 75.6 | 92.7 | 81 |
| Fable5 | 75.8 | 89.7 | 82 |
| Sol | 71.8 | 91.7 | 84 |
| Terra | 64.6 | 90.6 | 83 |
| Gemini3.8 | 81.4 | 89.3 | 81 |
| Grok4.7 | 75.3 | 82.7 | 77 |
| Luna | 60.1 | 85.6 | 84 |

LiveBench IF 包括改写、简化、故事生成、总结约束；不是 skill 选择正确率。Reasoning 包括逻辑、空间等题。AA-LCR 是长文档推理。三列均不进入本报告 coding 合成分。它们不能推出“Astra 一定更听工程指令”或“Fable 一定更聪明”的笼统结论。来源同主表的 LiveBench 原始数据和 AA 分项页面。

[MTAC-IFBench](https://arxiv.org/html/2609.14992v1)确实专测多轮 coding 的仓库规则、工具与流程约束，但 9 月 14 日预印本未覆盖这批新 GPT、Fable、Grok 与 Gemini3.8。它不能补齐上表空白。[METR 主页](https://metr.org/time-horizons/)当前展示的数据更新日期为 5 月 8 日，本次也不用于新模型名次。

**Skills 的补充证据**

Vals 的 SkillsBench 当前页面可提取以下 OpenHands 配置。比较的是有无任务相关 skills 的任务完成率，并非“技能召回准确率”。每个条件三次运行。Astra、Fable5、Grok4.7 未找到对应行，不能用旧型号替代。

| 模型 | 无 skills | 有 skills | 增加百分点 | 有 skills 美元/题 |
|---|---:|---:|---:|---:|
| Fable5.1 max | 44.83 | 61.55 | 16.72 | 4.52 |
| Luna max | 45.19 | 60.45 | 15.26 | 0.16 |
| Terra max | 48.84 | 58.90 | 10.05 | 1.40 |
| Gemini3.8 high | 41.05 | 57.99 | 16.94 | 2.34 |
| Sol max | 43.31 | 54.10 | 10.79 | 4.14 |

这些临近分数的标准误约 4–5 个百分点，不能据此稳排几个模型的强弱。一个实际发现是：廉价模型配上相关 skills，也可能在这套任务上接近昂贵模型。但任务分布、Agent 版本和 skill 内容都影响结果，不能直接移植到 Codex 或 Claude Code。

数据采用页面图表嵌入 JSON；该页正文的旧“榜首”摘要与图表不同步，没有使用旧摘要排最新名次。[Vals SkillsBench](https://www.vals.ai/benchmarks/skillsbench)、[原项目榜](https://www.skillsbench.ai/)

**代码审查与“过度防御”**

CodeRabbit 的 Astra 文章报告 actionable bug coverage：Astra 61.3%、Sol 59.0%；其 Fable5.1 文章报告另一版审查系统的 recall / precision，例如 Low 配置 61.0% / 37.3%。两篇的指标与流水线不同，**61.3 和 61.0 不能直接比较**。[Astra 审查评测](https://www.coderabbit.ai/blog/gpt-6-astra-code-review-evaluation)、[Fable5.1 审查评测](https://www.coderabbit.ai/blog/fable-5-1-model-review)

AA 原生 Agent 任务里，Astra 的安全拒绝终止率约 1.16%；Fable5.1 触发拒绝约 8.84%，全部由 fallback 恢复，终止率为 0；Sol 终止率约 0.09%，Grok 与 Gemini 在该样本为 0。拒绝涉及具体任务与安全边界，不代表日常开发“爱停下来问确认”的频率；拒绝少也不代表更安全。该样本不支持“Astra 肯定最过度防御”这样的泛化。[AA 原生 Agent 数据](https://artificialanalysis.ai/agents/coding-agents)

TB4 审计中 Gemini 配置 4/198 条轨迹被标记违规，其余上述配置 0/198；标记项已计零分，不应再次扣分。审计用于查篡改验收、获取答案等行为，不是提示注入防御测试，更不是人格判断。详细口径保存在 `aa-agents.json`。

**四、费用与速度：使用任务实测，而非只看 Token 单价**

| Vals TB2.1 配置 | 成功率 % | 标准误 | API 美元/题 | 平均分钟/题 |
|---|---:|---:|---:|---:|
| Astra max | 87.27 | 0.38 | 1.34 | 4.57 |
| Sol max | 85.77 | 1.35 | 1.02 | 6.21 |
| Fable5.1 high | 85.02 | 0.99 | 3.07 | 8.34 |
| Gemini3.8 high | 81.27 | 0.38 | 1.54 | 9.25 |
| Fable5 max + fallback | 80.52 | 1.35 | 1.43 | 8.41 |
| Luna max | 79.03 | 0.99 | 0.054 | 5.93 |
| Terra max | 77.53 | 2.25 | 0.47 | 8.66 |
| Grok4.7 xhigh | 73.41 | 1.50 | 1.08 | 13.30 |

来源：[Vals TB2.1](https://www.vals.ai/benchmarks/terminal-bench-2-1)、[重复运行与误差方法](https://www.vals.ai/methodology)。标准误描述三次运行成绩波动，不能覆盖所有环境或提示变化。这里的“每题”包含失败尝试，不是保证完成一项真实需求的价格，也没有与另一个任务集的成本直接合并。

Luna 在这套测试中约为 Astra 每题成本的 1/25，但更难的新 TB4 只有 12%，不能从 79% 的旧榜成绩断言它能廉价替代所有复杂工程任务。Gemini 的输出 Token 很快，也没有在此终端测试中自动转化为更短完成时间。

**选择建议**

- 综合复杂开发、终端操作、质量和 API 成本：优先 Astra + Codex。证据来自统一终端测试和原生 Agent 测试。
- 更重代码生成、多语言代码修改，愿意承担更高任务成本：优先 Fable5.1 + Claude Code；留意公开成绩含 fallback 的配置。
- 想降低主力成本：Sol 是有数据支撑的折中，原生 Codex 的仓库修复结果也强。
- 大量有自动验收的简单生成任务：Luna 值得考虑；Terra 位于更均衡的中间档。不能把低价榜当复杂任务的质量榜。
- Grok4.7：更值得结合 Grok Build 看；统一框架与原生 Agent 的差别很大。
- Gemini3.8：可看快速交互与具体工具生态，但本次没有证据把它排在复杂 coding 的第一梯队。

以上是依据公开结果的选型推断，不是已经验证过用户仓库的结论；也不要求用户重新跑一遍评测才能采用。

**补充、排除与文件说明**

Gemini3.1 Pro Preview 参照：LiveBench Coding 76.45、Agentic 44.14、IF 79.10；Vals TB2.1 70.79%、0.583 美元/题；AA 模型 TB4 4%、SciCode 59%、AA-LCR 82%。它留在原始 JSON 中，未加入八模型主排名。AA 对比页未明确努力档位，不能补写成 high。[AA 参照](https://artificialanalysis.ai/models/comparisons/gemma-4-31b-non-reasoning-vs-gemini-3-1-pro-preview)

LiveCodeBench 原站可取得的模型表没有本次新型号完整数据；SWE-bench 未取得这些配置可交叉验证的完整同表矩阵；ProgramBench 同样缺少多个目标新型号。因此未拿二手汇总站补空白，也未混入不同题集版本。[LiveCodeBench](https://livecodebench.github.io/leaderboard.html)、[SWE-bench](https://www.swebench.com/)、[ProgramBench](https://programbench.com/)

本目录：

- `comparison.csv`：可在 Excel 筛选的完整分项与三组权重结果。
- `comparison-data.json`：计算结果与公式说明；名次列是机械排序，阅读时仍应把近分和敏感名次归为同档。
- `livebench-original.csv`、`livebench-selected.json`：原始与目标模型分类均值。
- `vals-tb21-selected.json`：精确成绩、标准误、成本、时长和配置。
- `aa-models.json`：AA 模型分项、来源与缺失标记。
- `aa-agents.json`：原生 Agent 配置、子分数与局部可靠性数据。
- `skillsbench-selected.json`：skills 补充比较与标准误。

所有结论对应 2026-09-22 抓取快照。榜单会更新，应连同题集、推理档位、框架和 fallback 标签一起引用。
