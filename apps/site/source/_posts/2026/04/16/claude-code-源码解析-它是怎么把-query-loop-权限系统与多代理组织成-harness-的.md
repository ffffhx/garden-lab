---
title: "Claude Code 源码解析：它是怎么把 Query Loop、权限系统与多代理组织成 Harness 的"
date: 2026-04-16 19:40:00
categories:
  - 技术
tags:
  - AI
  - Agent
  - LLM
  - Claude Code
  - Codex
  - TypeScript
  - Rust
  - Harness Engineering
  - 源码解析
excerpt: "从术语预备讲起，拆解 Claude Code 的 query loop、工具系统、权限判定、上下文治理与 subagent 机制，并与 openai/codex 的 thread/turn/item、AGENTS.md、exec policy 与 app-server 控制面做对照。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

最近我集中看了两个仓库：

- Claude Code 的逆向还原版：[Syfyivan/claude-code](https://github.com/Syfyivan/claude-code)
- Codex 的官方开源实现：[openai/codex](https://github.com/openai/codex)

如果只按功能表去看，很容易把注意力放到这些标签上：

- 会读代码
- 会改文件
- 会跑命令
- 会调工具
- 会分出多个 agent

但真正值得看的，不是功能数，而是这两个系统各自如何把一个会写代码的大模型，关进一套可持续运行的本地执行系统里。

这篇文章我会沿着四条主线拆：

1. `query loop` 是怎么推进一轮任务的
1. 工具和权限是怎么被 runtime 收束的
1. `CLAUDE.md`、git snapshot 和 compact 是怎么变成上下文预算制度的
1. Claude Code 与 Codex 为什么会走向两种很不一样的架构重心

先说明一个边界：

**`Syfyivan/claude-code` 不是 Anthropic 官方开源仓库，而是 reverse-engineered / decompiled 的还原项目。**

所以本文分析的不是“官方源码逐行真相”，而是：

**一个恢复出来的 Claude Code 架构骨架，到底暴露了怎样的 runtime 设计。**

另外，下面出现的代码块都遵循同一个规则：

- 只保留表达意思的主体逻辑
- 不是完整可运行代码
- 每一行都加注释，目的是让你直接看懂设计意图

## 0. 阅读预备：先把几个词说人话

{% asset_img figure-01.svg %}

在进入正文之前，先把几个容易陌生、但整篇文章反复会用到的词放到正确位置上。

- `Harness`
  - 包在模型外面的控制壳。它不负责“聪明”，它负责“边界”。
- `Agent Runtime`
  - 让模型真正跑起来的运行时，负责接收输入、组织上下文、调模型、执行工具、记录状态。
- `Query Loop`
  - 一轮任务推进的主循环。模型输出如果触发 `tool_use`，系统就执行工具，再把结果喂回模型，直到任务结束。
- `Tool Pool`
  - 当前这一轮真正暴露给模型的工具集合。不是仓库里“所有工具”，而是经过模式和权限过滤后的可见集合。
- `Compact`
  - 对历史消息做摘要、裁剪、折叠，避免上下文无限膨胀。
- `Prompt Cache`
  - 让相同前缀请求复用缓存的机制。Claude Code 在 subagent/fork 设计里明显在主动优化这一点。
- `Subagent`
  - 被主 agent 派生出来的子任务执行体。它可能继承上下文，但不一定继承全部权限。
- `Thread / Turn / Item`
  - 这是 Codex 更强调的三个原语：会话、轮次、事件项。后面对比时会反复提到。

如果把这些词压成一句话：

**模型负责做概率决策，runtime 负责推进循环，harness 负责限制边界。**

## 1. Claude Code 的整体分层

{% asset_img figure-02.svg %}

先把 Claude Code 当成一个分层系统来看，会比较容易抓住重点。

大体上可以拆成这几层：

- `src/main.tsx`
  - CLI 入口，负责参数、模式、会话启动
- `src/QueryEngine.ts`
  - 会话级编排器，把工具、prompt、上下文和状态拼成一次 query
- `src/query.ts`
  - 真正的主循环，模型调用、工具跟进、compact 都发生在这里
- `src/Tool.ts` + `src/tools.ts`
  - 工具抽象和工具池装配
- `src/utils/permissions/*`
  - 权限模式、规则匹配、hook、headless 分支
- `src/context.ts` + `src/utils/claudemd.ts`
  - `CLAUDE.md`、git status、当前日期、memory 装配
- `src/tools/AgentTool/*`
  - subagent、fork agent、上下文继承、权限收缩

如果只挑一个最值得看的文件，我不会选 `main.tsx`，而会选：

- `src/query.ts`

原因很直接：Claude Code 的工程性能力最后都要附着到那条主循环上。

也就是说，这个系统的重点不是“终端 UI 长什么样”，而是：

- 一轮任务怎么持续推进
- 工具什么时候进入循环
- 权限什么时候介入
- 上下文什么时候被压缩
- 子代理什么时候被派生

这决定了它更像一个 agent runtime，而不是一个聊天壳。

## 2. 从 CLI 到 Query Loop：一轮请求是怎么起跑的

{% asset_img figure-03.svg %}

从主链路上看，一轮请求大概这样走：

1. `src/main.tsx` 解析参数、初始化 app state
1. `QueryEngine.ts` 组装工具、prompt、上下文和权限回调
1. `query.ts` 进入主循环并调用模型
1. 如果流里出现 `tool_use`，就执行工具并继续下一轮
1. 如果没有 `tool_use`，这轮任务结束

这一段最值得看的，不是 UI 层，而是 `QueryEngine.ts` 怎么给 `query.ts` 备料。

下面是裁剪版骨架：

```ts
const wrappedCanUseTool = async (tool, input, toolUseContext, assistantMessage, toolUseID) => { // 包装原始权限函数
  const result = await canUseTool(tool, input, toolUseContext, assistantMessage, toolUseID) // 先调用真正的权限判断
  if (result.behavior !== 'allow') { // 只要结果不是 allow
    this.permissionDenials.push({ tool_name: tool.name, tool_use_id: toolUseID, tool_input: input }) // 就记录一次权限拒绝事件
  } // 结束拒绝记录分支
  return result // 把权限结果继续传给后面的 query loop
} // wrappedCanUseTool 定义结束

const promptParts = await fetchSystemPromptParts({ tools, mainLoopModel, mcpClients }) // 先取回 system prompt 与上下文部件
const systemPrompt = asSystemPrompt(promptParts.defaultSystemPrompt) // 再把默认 system prompt 组装成最终提示
const userContext = promptParts.userContext // 用户上下文单独保存
const systemContext = promptParts.systemContext // 系统上下文单独保存
yield* query({ messages, systemPrompt, userContext, systemContext, canUseTool: wrappedCanUseTool, toolUseContext }) // 最后才真正进入主循环
```

从这段骨架能看出来，`QueryEngine` 的职责不是“替代主循环”，而是：

- 先把 prompt 拼好
- 先把上下文分层
- 先把权限回调接上
- 再把这些东西一次性交给 `query.ts`

所以它更像一个**会话编排器**，而不是心跳本身。

## 3. 为什么 `query.ts` 才是 Claude Code 的心脏

{% asset_img figure-04.svg %}

看 `src/query.ts`，最重要的不是某个工具，而是它把整个任务做成了一条可持续推进的循环。

裁剪版骨架如下：

```ts
while (true) { // 只要任务没结束就继续转
  const pendingSkillPrefetch = startSkillDiscoveryPrefetch(null, messages, toolUseContext) // 先把技能发现这类可并行工作藏到后台
  let messagesForQuery = [...getMessagesAfterCompactBoundary(messages)] // 取出当前轮实际要送模型的消息窗口
  messagesForQuery = await applyToolResultBudget(messagesForQuery, toolUseContext.contentReplacementState) // 先限制工具结果体积
  messagesForQuery = snipCompactIfNeeded(messagesForQuery).messages // 再做 snip 级别的历史裁剪
  messagesForQuery = (await deps.microcompact(messagesForQuery, toolUseContext, querySource)).messages // 再做微压缩
  const autoCompact = await deps.autocompact(messagesForQuery, toolUseContext, compactContext, querySource, tracking, 0) // 检查是否要自动压缩
  messagesForQuery = autoCompact.compactionResult ? buildPostCompactMessages(autoCompact.compactionResult) : messagesForQuery // 如果压缩触发就替换成压缩后的窗口
  const fullSystemPrompt = asSystemPrompt(appendSystemContext(systemPrompt, systemContext)) // 把系统上下文接到 system prompt 后面
  const stream = deps.callModel({ messages: prependUserContext(messagesForQuery, userContext), systemPrompt: fullSystemPrompt, tools }) // 正式向模型发起请求
  const toolUseBlocks = await collectToolUses(stream) // 从流式输出里收集本轮 tool_use
  if (toolUseBlocks.length === 0) return { reason: 'completed' } // 没有工具调用就说明这一轮结束了
  const toolResults = await executeTools(toolUseBlocks, canUseTool, toolUseContext) // 有工具调用就执行工具
  messages = appendToolResults(messages, toolResults) // 把工具结果接回历史消息
  await pendingSkillPrefetch // 等后台预取收尾
} // 进入下一轮
```

从这条骨架里，至少能看出三件事。

第一，Claude Code 默认把一次请求看成“一轮持续推进的任务”，而不是“一问一答”。

第二，`compact` 不是外围补丁，而是主循环里的内生步骤。`tool result budget / snip / microcompact / autocompact` 都是在每一轮里显式发生的。

第三，模型真正消费的上下文，不是原始历史，而是 runtime 处理过的、预算受控的窗口。

所以 Claude Code 的核心不是“能调工具”，而是：

**它把工具调用、上下文压缩和模型续跑，统一塞进同一条 query loop 里。**

## 4. 工具系统：工具不是裸函数，而是带治理属性的执行单元

{% asset_img figure-05.svg %}

Claude Code 的工具系统很值得看，因为它明显不是“给模型挂几个函数”那么简单。

先看工具抽象本身：

```ts
type Tool = { // 每个工具都被当成一个完整的治理单元
  name: string // 工具名同时给 runtime 和模型识别
  maxResultSizeChars: number // 工具输出多大以后要改成落盘或摘要
  validateInput?: (input, context) => Promise<ValidationResult> // 先校验输入是否合法
  checkPermissions: (input, context) => Promise<PermissionResult> // 再决定是否需要用户许可
  preparePermissionMatcher?: (input) => Promise<(pattern: string) => boolean> // 为规则匹配预处理可复用 matcher
  prompt: (options) => Promise<string> // 生成暴露给模型看的工具说明
} // Tool 定义结束
```

这说明 Claude Code 对工具的理解是：

- 先有描述
- 再有校验
- 再有权限
- 最后才是执行

再看工具池装配：

```ts
const builtInTools = getTools(permissionContext) // 先拿到当前模式下可用的内置工具
const allowedMcpTools = filterToolsByDenyRules(mcpTools, permissionContext) // deny 规则先把 MCP 工具过滤一遍
const orderedBuiltIns = [...builtInTools].sort(byName) // 内置工具按名字稳定排序
const orderedMcpTools = allowedMcpTools.sort(byName) // MCP 工具也按名字稳定排序
return uniqBy(orderedBuiltIns.concat(orderedMcpTools), 'name') // 最后合并并按名字去重
```

这里最关键的不是排序本身，而是两件事：

- deny 规则会在“工具暴露给模型之前”就先过滤一轮
- 排序是为了 prompt cache 稳定，而不是为了代码好看

也就是说，Claude Code 的工具系统不是执行层小配件，而是：

**先收窄模型可见世界，再决定模型如何规划。**

## 5. 权限系统：它不是一个开关，而是一条分层决策链

{% asset_img figure-06.svg %}

`src/utils/permissions/PermissionMode.ts` 暴露了几种显式模式：

- `default`
- `plan`
- `acceptEdits`
- `bypassPermissions`
- `dontAsk`
- 条件启用的 `auto`

但真正有意思的不是模式名，而是 `permissions.ts` 里那条决策链。

先看裁剪版骨架：

```ts
const result = await hasPermissionsToUseToolInner(tool, input, context) // 先跑基础权限判断
if (result.behavior === 'allow') return result // 如果已经允许就直接放行
if (context.getAppState().toolPermissionContext.mode === 'dontAsk' && result.behavior === 'ask') { // dontAsk 模式会拦截 ask
  return { behavior: 'deny', message: DONT_ASK_REJECT_MESSAGE(tool.name) } // ask 会被硬转成 deny
} // dontAsk 分支结束
if (context.getAppState().toolPermissionContext.mode === 'auto' && result.behavior === 'ask') { // auto 模式下不立刻弹窗
  return await runClassifierOrHooks(tool, input, context, result) // 先交给 classifier 或 hook 做自动判定
} // auto 分支结束
return result // 其他情况把 ask/deny 结果交给上层继续处理
```

如果把这一段翻译成人话，就是：

1. 先跑规则匹配
1. 再跑工具自己的权限检查
1. 再给 hook 插手的机会
1. 如果当前是 `dontAsk`，把 `ask` 直接打成 `deny`
1. 如果当前是 `auto`，先让 classifier 尝试自动决策
1. 最后才轮到 UI 去问用户

这意味着 Claude Code 的权限系统不是“一个总开关”，而是一条**分层过滤链**。

这条链的实际意义是：

- 权限不是为了多弹几个窗
- 权限是为了把模型碰真实世界的接触面变成一条可审计的决策路径

所以它真正要回答的问题不是“模型能不能执行命令”，而是：

**在什么模式下、通过什么规则、由谁来承担这次真实动作的放行责任。**

## 6. 上下文治理：`CLAUDE.md`、git snapshot 与 compact 是一套预算制度

{% asset_img figure-07.svg %}

Claude Code 的上下文治理有两个特别关键的组件：

- `src/utils/claudemd.ts`
- `src/context.ts`

前者告诉你规则从哪里来，后者告诉你这些规则和环境事实怎么被注入到 query loop 里。

先看 `CLAUDE.md` 的层次：

```ts
const memoryOrder = [ // Claude Code 不是只读一个 CLAUDE.md 文件
  'managed memory', // 系统级规则先进入上下文
  'user memory', // 用户级全局规则继续叠加
  'project memory', // 项目级规则再往上叠
  'local memory', // 本地私有规则优先级最高
] // 分层 memory 顺序结束
const memoryFiles = await getMemoryFiles() // 从当前目录向上发现所有相关记忆文件
const claudeMd = getClaudeMds(filterInjectedMemoryFiles(memoryFiles)) // 再把它们拼成真正送模型的规则文本
```

再看上下文装配：

```ts
const gitStatus = await getGitStatus() // 取会话开始时的 git 快照
const systemContext = { ...(gitStatus && { gitStatus }) } // 系统上下文主要放环境事实
const claudeMd = getClaudeMds(filterInjectedMemoryFiles(await getMemoryFiles())) // 用户上下文里放分层 CLAUDE.md
const userContext = { ...(claudeMd && { claudeMd }), currentDate: `Today's date is ${getLocalISODate()}.` } // 用户上下文里还会显式放当前日期
```

这里最值得注意的点有三个。

第一，`CLAUDE.md` 在 Claude Code 里不是单文件提示词，而是一套层级化 memory。

第二，`git status` 是会话开始时的快照。它会被明确标记成 stale，不会在会话中自动刷新。

第三，当前日期也被当成上下文事实显式注入。

这说明 Claude Code 的上下文不是“聊天历史附带信息”，而是：

- 一部分是规则
- 一部分是环境事实
- 一部分是被预算控制过的历史窗口

再加上第 3 节里看到的 `snip / microcompact / autocompact`，可以更准确地说：

**Claude Code 的上下文系统，本质上是一套持续运行的预算制度。**

## 7. 多代理与 Fork：重点不是“多开”，而是“继承上下文并收缩权限”

{% asset_img figure-08.svg %}

Claude Code 的多代理设计，最容易被误读成“并发开几个 worker”。

但从 `runAgent.ts` 和 `forkSubagent.ts` 看，它真正优化的是三件事：

- 上下文怎么继承
- 权限怎么重写
- prompt cache 怎么尽量复用

先看 `runAgent.ts` 里对子代理权限的处理：

```ts
const contextMessages = forkContextMessages ? filterIncompleteToolCalls(forkContextMessages) : [] // fork 时先继承父代理上下文
const initialMessages = [...contextMessages, ...promptMessages] // 再把子任务提示接到后面
if (allowedTools !== undefined) { // 如果调用方明确指定了子代理工具白名单
  toolPermissionContext = { // 就重写子代理自己的权限上下文
    ...toolPermissionContext, // 先保留其他权限字段
    alwaysAllowRules: { // 只修改 allow rules
      cliArg: state.toolPermissionContext.alwaysAllowRules.cliArg, // 继续保留 SDK 层的显式授权
      session: [...allowedTools], // 但把 session 级权限收缩成子代理白名单
    }, // allow rules 结束
  } // 权限上下文重写结束
} // allowedTools 分支结束
```

这段代码说明一件事：

**子代理可以继承上下文，但不应该默认继承父代理已经拿到的全部权限。**

再看 `forkSubagent.ts` 里对 prompt cache 的处理：

```ts
const toolResultBlocks = toolUseBlocks.map(block => ({ // 为每个父消息里的 tool_use 造一个统一的结果块
  type: 'tool_result', // 结果块类型固定
  tool_use_id: block.id, // 仍然绑定原来的 tool_use_id
  content: [{ type: 'text', text: FORK_PLACEHOLDER_RESULT }], // 内容统一成同一个 placeholder 文本
})) // placeholder 结果块构造结束
const toolResultMessage = createUserMessage({ // 再把这些 placeholder 包成一条用户消息
  content: [...toolResultBlocks, { type: 'text', text: buildChildMessage(directive) }], // 只有最后的 directive 会因子代理不同而变化
}) // fork 用户消息构造结束
```

这一段非常关键，因为它明显不是在解决“能不能 fork”，而是在解决：

- 多个 fork child 怎么共享尽可能多的相同前缀
- 从而提高 prompt cache 命中率

所以 Claude Code 的多代理设计重点不是“多开”，而是：

- 继承父上下文
- 用 placeholder 保持前缀稳定
- 用 `allowedTools` 收缩子代理权限
- 让 child 在尽量共享缓存的前提下分工

这是一种明显带成本意识的 subagent 设计。

## 8. 与 Codex 的对比：Claude Code 是 runtime-first，Codex 是 control-plane-first

{% asset_img figure-09.svg %}

把 Claude Code 和 Codex 放在一起看，差异会非常明显。

我会把结论先压成一句话：

- `Claude Code` 更像一个围绕单条任务流构建的 agent runtime
- `Codex` 更像一个把 agent 行为对象化、协议化、持久化的控制面平台

这个判断在 Codex 源码里可以直接看到。

先看 `build_initial_context(...)` 的裁剪版骨架：

```rust
let mut developer_sections = Vec::<String>::with_capacity(8); // 单独收集 developer 控制面消息
let mut contextual_user_sections = Vec::<String>::with_capacity(2); // 单独收集 contextual user 消息
developer_sections.push(DeveloperInstructions::from_policy(...).into_text()); // 把权限和审批策略显式注入 developer 区
developer_sections.push(render_skills_section(&implicit_skills).unwrap()); // 把 skills 也显式注入 developer 区
developer_sections.push(render_plugins_section(loaded_plugins.capability_summaries()).unwrap()); // 把 plugins 继续注入 developer 区
contextual_user_sections.push(UserInstructions { text: user_instructions.to_string(), directory: turn_context.cwd.to_string_lossy().into_owned() }.serialize_to_text()); // 把 AGENTS.md 一类用户规则包装成独立片段
contextual_user_sections.push(EnvironmentContext::from_turn_context(turn_context, shell.as_ref()).serialize_to_xml()); // 把 cwd、shell、date、timezone 包成结构化环境片段
items.push(build_developer_update_item(developer_sections).unwrap()); // 生成 developer message
items.push(build_contextual_user_message(contextual_user_sections).unwrap()); // 生成 contextual user message
```

这段代码和 Claude Code 的差异非常大。

Claude Code 更像是在为 query loop 备料：

- `systemPrompt`
- `userContext`
- `systemContext`
- `tools`

Codex 则更像是在构建一套显式控制面对象：

- developer message
- contextual user message
- `AGENTS.md` 片段
- environment context 片段
- skills / plugins / approvals / sandbox policy

再看 `project_doc.rs` 的裁剪版骨架：

```rust
const DEFAULT_PROJECT_DOC_FILENAME: &str = "AGENTS.md"; // Codex 把项目规则文件统一命名为 AGENTS.md
let paths = discover_project_doc_paths(config, fs).await?; // 先从 project root 到 cwd 发现所有 AGENTS.md
for p in paths { // 再按层级顺序逐个处理
    let data = fs.read_file(&p, None).await?; // 读取单个 AGENTS.md 文件
    parts.push(String::from_utf8_lossy(&data).to_string()); // 把内容拼成 project-doc 片段
} // 层级扫描结束
```

这又进一步说明，Codex 更强调：

- 显式的层级规则
- 显式的会话原语
- 显式的控制面注入

所以两者的差异可以压成这张表：

| 维度 | Claude Code | Codex |
| --- | --- | --- |
| 主组织单元 | `query loop / messages / toolUseContext` | `thread / turn / item` |
| 本地规则文件 | `CLAUDE.md` 分层 memory | `AGENTS.md` 分层 project docs |
| 上下文表达 | 运行时拼装的上下文块 | typed fragments / `ResponseItem` |
| 权限治理 | mode + rule + hook + classifier | sandbox + exec policy + approvals |
| 多代理 | fork/subagent，强调 cache reuse | spawned agents，强调 protocol 与 lifecycle |
| 系统气质 | runtime-first | control-plane-first |

如果再压成一句更短的话：

- Claude Code 更关心“怎么把一轮任务一路干完”
- Codex 更关心“怎么把 agent 做成平台级能力”

## 9. 结论：Claude Code 值得学的，是它怎样把模型关进一条可持续推进的循环

{% asset_img figure-10.svg %}

把整篇文章再收束一次，我觉得 Claude Code 最值得学的不是功能清单，而是下面这几件事。

第一，它明确承认了 agent 系统的几个现实：

- 模型会不稳定
- 上下文一定会膨胀
- 工具调用会有风险
- 子代理会放大复杂度

第二，它没有把这些问题放到系统外面补，而是直接把它们写进 runtime 骨架里：

- 用 `query loop` 推进任务
- 用 `tool pool` 约束模型可见世界
- 用权限链管理真实动作
- 用 compact 管理上下文预算
- 用 subagent + cache reuse 管理并行复杂度

第三，把它和 Codex 放在一起看，会更容易看清两条路线：

- Claude Code 路线：把单条任务流做强
- Codex 路线：把 agent 控制面做清楚

这两条路线没有谁天然更高明，它们只是回答了不同的问题。

但无论哪一条，最后都指向同一个结论：

**真正成熟的 coding agent，不是 prompt engineering 的胜利，而是 harness engineering 的胜利。**

## 参考资料

- [Syfyivan/claude-code](https://github.com/Syfyivan/claude-code)
- [Syfyivan/claude-code `src/query.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/query.ts)
- [Syfyivan/claude-code `src/QueryEngine.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/QueryEngine.ts)
- [Syfyivan/claude-code `src/Tool.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/Tool.ts)
- [Syfyivan/claude-code `src/tools.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/tools.ts)
- [Syfyivan/claude-code `src/context.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/context.ts)
- [Syfyivan/claude-code `src/utils/claudemd.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/utils/claudemd.ts)
- [Syfyivan/claude-code `src/tools/AgentTool/runAgent.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/tools/AgentTool/runAgent.ts)
- [Syfyivan/claude-code `src/tools/AgentTool/forkSubagent.ts`](https://github.com/Syfyivan/claude-code/blob/604110272f3adf80a41ace495210af86f4a9a8fe/src/tools/AgentTool/forkSubagent.ts)
- [openai/codex](https://github.com/openai/codex)
- [openai/codex `codex-rs/app-server/README.md`](https://github.com/openai/codex/blob/b0324f9f0569ebfc5534fd6844971d9ae029c791/codex-rs/app-server/README.md)
- [openai/codex `codex-rs/core/src/codex.rs`](https://github.com/openai/codex/blob/b0324f9f0569ebfc5534fd6844971d9ae029c791/codex-rs/core/src/codex.rs)
- [openai/codex `codex-rs/core/src/project_doc.rs`](https://github.com/openai/codex/blob/b0324f9f0569ebfc5534fd6844971d9ae029c791/codex-rs/core/src/project_doc.rs)
