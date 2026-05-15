---
title: "OpenAI Codex 源码解析：它为什么必须是一个带 Harness 的本地 Agent"
date: 2026-04-15 21:20:00
categories:
  - 技术
tags:
  - AI
  - Agent
  - LLM
  - OpenAI
  - Codex
  - Rust
  - 源码解析
  - 平台架构
excerpt: "从本地 Agent 与普通聊天的差别讲起，拆解 openai/codex 的 CLI、TUI、App Server、Core、Tools、State、Memory 设计，并解释为什么真正的关键不是“会调工具”，而是用 harness 把概率模型变成受控执行系统。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

最近我花了一些时间看 [openai/codex](https://github.com/openai/codex) 这个仓库。

如果只看 README，你很容易先记住这些标签：

- 终端里的 coding agent
- 本地运行
- 可以读代码、跑命令、改文件
- 可以接 IDE、桌面 App、MCP、plugins、skills

但真进源码以后，我觉得它最值得看的地方不是“支持了多少工具”，而是下面这件事：

**它是怎么把一个本来只会做概率输出的大模型，包进一套受控执行的本地 runtime 里。**

这件事说得再直白一点就是：

- 普通聊天里，模型错了，通常只是“答案错了”
- 本地 Agent 里，模型错了，可能会变成“命令跑错了、文件改坏了、分支污染了、数据发错了”

所以，`Codex` 真正要解决的问题不只是“怎么让模型会调用工具”，而是：

**怎么让模型在真的拥有工具以后，依然可控、可审计、可恢复。**

这篇文章会按下面这条主线展开：

1. 先把文中几个容易陌生的词讲清楚
1. 再说明为什么 `Codex` 想做的是本地 Agent，而不是普通聊天
1. 然后拆开它的整体分层：`CLI / TUI / App Server / Core / Tools / State`
1. 接着看一轮 `Turn` 到底怎么执行到底
1. 重点解释为什么工具执行必须带审批、沙箱和策略控制
1. 再看为什么它把 `MCP / plugins / skills` 做成一等公民
1. 最后分析 `rollout / SQLite / memory pipeline` 这种长期状态设施，以及整套架构的 tradeoff

为了避免版本漂移，先说明本文的观察范围：

- 仓库：[openai/codex](https://github.com/openai/codex)
- 分支：`main`
- 阅读快照：`2e1003728c61e62636dd7a29a7fee95050fb9cc6`
- 观察时间：`2026-04-15`

另外，下面所有代码片段都是**裁剪版源码片段**：

- 只保留表达设计意图的主体逻辑
- 去掉了很多类型、日志、错误处理和边界分支
- 目的是让你在正文里就能直接看懂“它到底想怎么组织系统”

## 0. 阅读预备：先把几个词说人话

在看 `Codex` 这种仓库时，最容易把人绕晕的，往往不是某个函数，而是几个词混在一起以后看不清边界。

{% asset_img figure-01.svg %}

### 0.1 什么是本地 Agent

- `本地 Agent` 可以简单理解成：**模型不是只回答问题，而是真的在你这台机器上参与执行任务**

它会做的事通常包括：

- 读取仓库文件
- 查看 git 状态
- 执行终端命令
- 修改工作区文件
- 再根据执行结果继续下一步

所以它不是“聊天机器人 + 一个 shell 示例”，而是一个贴着本地环境工作的执行体。

### 0.2 什么是 Agent runtime

- `Agent runtime` 可以理解成：**让大模型真的跑起来的那层运行时骨架**

它通常负责：

- 接收用户输入
- 构建上下文
- 调模型
- 注册和暴露工具
- 执行工具
- 把工具结果再喂回模型
- 把过程写入历史和状态

也就是说，它更像“让模型干活的操作系统”，而不是模型本身。

### 0.3 什么是 Harness

这是本文最想强调的词。

- `Harness` 可以把它理解成：**包在模型外面、负责约束能力边界的那层保护壳**

它至少要负责五件事：

1. 决定模型能看到什么能力
1. 决定这些能力在什么权限下执行
1. 决定执行时用什么沙箱和策略
1. 决定过程怎么记录和回放
1. 决定出错后怎么恢复或回滚

一句话说：

**模型负责做概率决策，harness 负责把这些决策限制在可接受的执行边界内。**

### 0.4 什么是 Tool Calling

- `tool calling` 指的是：**模型在回答过程中，不直接凭空输出最终答案，而是先请求系统帮它调用某个工具**

比如：

- 读文件
- 跑命令
- 搜索代码
- 发起网络请求
- 申请额外权限

所以 tool calling 的本质是：

- 模型负责规划
- runtime 负责执行

### 0.5 什么是 Thread / Turn / Item

这是 `Codex` 里非常关键的一组建模。

- `Thread`：一条连续会话
- `Turn`：一次完整交互
- `Item`：这次交互中的最小事件单元

在 `app-server` 的描述里，这三者基本可以理解成：

- thread 是一段长期任务线
- turn 是这条任务线里的一轮输入到输出
- item 是这轮执行里真正落盘和展示的事件

例如 item 可以是：

- 用户消息
- agent message
- shell command
- approval request
- file edit
- tool output

### 0.6 什么是 MCP / Skills / Plugins

这三个词都在扩展系统能力，但侧重点不同：

- `MCP`：协议化的外部工具 / 资源接入方式
- `Skill`：把某类经验、流程、约束封装成可注入的能力片段
- `Plugin`：更完整的能力包，可能同时带 skill、app、MCP server 等

粗暴理解：

- MCP 更像“统一接口”
- Skill 更像“经验模板”
- Plugin 更像“能力发行包”

### 0.7 什么是 Rollout / SQLite State / Memory Pipeline

这三个词对应的是长期状态问题：

- `Rollout`：原始事件流落盘
- `SQLite State`：方便查询、索引和管理的结构化状态层
- `Memory Pipeline`：从过去会话里提炼出更高层次记忆的管道

你可以把它理解成三层：

- 第一层：先把发生过的事记下来
- 第二层：再把这些记录整理成可查询状态
- 第三层：最后从状态里提炼对未来还有用的记忆

## 1. Codex 想解决什么问题：为什么需要“本地 Agent”而不是普通聊天

先说结论：

**Codex 想做的，不是“更会写代码的聊天窗口”，而是“真的能在本地工作环境里完成任务的 agent”。**

{% asset_img figure-02.svg %}

### 1.1 普通聊天的问题，不是模型不够聪明

普通聊天已经很擅长这些事：

- 解释概念
- 帮你看报错
- 给你一段示例代码
- 提供排查思路

但它有个天然问题：

**它不在你的真实环境里。**

它看不到：

- 你当前 branch 是什么
- 你工作区里有没有未提交改动
- 你的测试到底是怎么挂的
- 你的依赖和脚本在本地是不是能跑
- 你项目里具体有哪些文件和配置

所以普通聊天的典型工作流其实是：

1. 你把一段上下文贴给模型
1. 模型给建议
1. 你自己执行
1. 执行失败后再把报错贴回去

这本质上还是：

- 人负责执行
- 模型负责建议

### 1.2 本地 Agent 的目标，是把“建议循环”变成“执行闭环”

到了本地 Agent，目标就变成：

1. 模型理解你的意图
1. 模型自己去看代码
1. 模型自己去运行命令
1. 模型自己去修改文件
1. 模型自己根据反馈继续下一步
1. 必要时再向你申请高风险操作的批准

这时候系统就不再是问答产品，而开始变成执行系统。

### 1.3 一旦进入执行闭环，错误的性质就变了

这也是为什么 `harness` 必须出现。

在普通聊天里，模型出错往往是：

- 理解错
- 推理错
- 代码建议不完美

但到了本地 Agent，模型出错会变成：

- 在错误目录执行命令
- 修改了不该改的文件
- 发起了不该发起的网络请求
- 做了高风险 git 操作
- 输出了一段有副作用的错误操作链

换句话说：

- 聊天里的错误更像“认知错误”
- Agent 里的错误更像“执行错误”

而执行错误的代价，显然要高得多。

### 1.4 所以 Codex 的核心不只是“会调工具”

如果只用一句话概括这一章，我会这么说：

> `Codex` 真正做的，不是给聊天产品加几个工具，而是给一个概率模型套上一层能约束副作用的本地执行 harness。

这句话后面几章会反复被验证。

## 2. 整体分层：CLI / TUI / App Server / Core / Tools / State

如果你第一次看 `openai/codex` 仓库，很容易被目录吓到。

- 顶层有 Node / pnpm
- 里面有大量 Rust crate
- 既有 CLI，又有 TUI，又有 app-server，又有 SDK

但如果从职责去看，其实它的结构非常清楚。

{% asset_img figure-03.svg %}

### 2.1 顶层 Node，不等于核心实现是 Node

从仓库结构上看，顶层有：

- `package.json`
- `pnpm-workspace.yaml`
- `sdk/`
- `codex-cli/`

但真正的核心实现，已经明显收敛到了 `codex-rs/` 这个 Rust workspace 里。

顶层 Node 更像负责：

- 安装分发
- 一些仓库级脚本
- SDK 和外层包装

而不是整个系统的执行核心。

### 2.2 CLI 只是入口，不是全部

看 `codex-rs/cli/src/main.rs` 的子命令定义，你会发现它其实是在统一调度多种运行方式：

```rust
#[derive(Debug, clap::Subcommand)] // 这里告诉 `clap`：下面这个枚举要被当成“子命令集合”来解析
enum Subcommand { // 这里定义 `codex` 顶层支持的所有子命令
    Exec(ExecCli), // `codex exec`：非交互地跑一段任务
    Review(ReviewArgs), // `codex review`：走代码审查模式
    Mcp(McpCli), // `codex mcp`：管理外部 MCP 服务
    AppServer(AppServerCommand), // `codex app-server`：启动本地协议服务
    Sandbox(SandboxArgs), // `codex sandbox`：直接使用 Codex 提供的沙箱能力
    Resume(ResumeCommand), // `codex resume`：恢复以前的会话
    Fork(ForkCommand), // `codex fork`：从旧会话分叉出一条新任务线
} // 这里结束子命令枚举定义
```

对应源码：

- [`codex-rs/cli/src/main.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/cli/src/main.rs)

这段代码透露出一个很重要的信息：

**`codex` 不是单一交互程序，而是一个多入口、多运行形态的 agent 平台前门。**

### 2.3 TUI 是终端界面层

`codex-rs/tui` 负责的是：

- 全屏终端 UI
- 流式显示 agent 过程
- 展示审批弹层
- 展示 tool output、历史记录、状态信息

这层的意义在于“体验”，但它不应该和执行内核耦死。

### 2.4 App Server 是协议层

`codex-rs/app-server` 很值得重点讲。

它本质上是把 Codex 的能力包装成一个本地服务，向外暴露：

- thread
- turn
- item
- fs
- command
- skills
- apps
- models
- approval

这意味着：

- TUI 可以用它
- IDE 集成可以用它
- 桌面 App 可以用它
- 未来别的客户端也可以用它

也就是说，Codex 并没有把 agent 内核和某个 UI 绑死，而是在做一种**多前端共享同一套 runtime** 的设计。

### 2.5 Core 才是整个系统的重心

看 `codex-rs/core/src/lib.rs`，它几乎把所有关键能力都汇总在一个中心 crate 里：

```rust
mod codex; // 核心会话与运行时主逻辑
mod tasks; // 一轮 turn 对应的各种任务类型和调度逻辑
mod tools; // 工具注册、路由、审批、执行等相关逻辑
pub mod config; // 配置系统，对外公开
pub mod skills; // skill 加载与注入逻辑，对外公开
pub mod plugins; // plugin 发现、安装和管理逻辑，对外公开
pub use codex_thread::CodexThread; // 把线程对象重新导出，供其他 crate 直接使用
pub use thread_manager::ThreadManager; // 把线程管理器重新导出，作为更高层入口
```

对应源码：

- [`codex-rs/core/src/lib.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/lib.rs)

这里能看出 `codex-core` 真正在负责的事情：

- 会话和线程
- turn 执行
- tools
- skills / plugins
- config
- state 与 runtime 的桥接

所以，如果你要判断“Codex 的灵魂在哪”，答案基本就是：

**在 `codex-core`。**

### 2.6 Tools 和 State 是两个非常关键的基础面

再往下看，有两层特别重要：

- `tools`：决定模型能调什么，以及这些东西怎么被真正执行
- `state / rollout / thread-store`：决定系统如何记住过去发生过什么

这两层一层负责“行动”，一层负责“记忆”。

前者决定 Agent 能不能干活。  
后者决定 Agent 会不会像失忆一样每轮重来。

## 3. 一次 Turn 如何执行到底

如果你只想抓住 `Codex` 的主线，我建议不要先背目录树，而是先看：

**一轮 turn 到底怎么跑完整条链路。**

{% asset_img figure-04.svg %}

### 3.1 先理解 `Thread / Turn / Item`

在 `app-server` 的定义里，这三个概念是顶层原语：

- `Thread`：一条会话
- `Turn`：一轮交互
- `Item`：这轮交互里的具体事件

这组抽象非常漂亮，因为它一套模型同时服务了三件事：

1. UI 展示
1. runtime 执行
1. 持久化回放

这比“只把历史存成一段大文本”强很多，因为它让系统可以知道：

- 哪一段是用户输入
- 哪一段是工具调用
- 哪一段是执行输出
- 哪一段是最终回答

### 3.2 一个 turn 的本质，是一个异步任务

在 `core/src/tasks/mod.rs` 里，`SessionTask` 这个 trait 很能说明问题：

```rust
pub(crate) trait SessionTask: Send + Sync + 'static { // 所有 turn 任务都要满足可线程安全共享、可异步运行这些约束
    fn kind(&self) -> TaskKind; // 任务类型：用于 UI 展示和遥测打点
    fn span_name(&self) -> &'static str; // tracing span 的名字：便于日志和链路追踪

    fn run( // 真正执行任务的方法
        self: Arc<Self>, // 任务对象本身，以引用计数方式跨异步边界传递
        session: Arc<SessionTaskContext>, // 这轮任务能访问到的 session 级上下文
        ctx: Arc<TurnContext>, // 这一次 turn 的运行上下文
        input: Vec<UserInput>, // 用户给到本轮任务的输入
        cancellation_token: CancellationToken, // 外部中断时用来取消任务的令牌
    ) -> impl Future<Output = Option<String>> + Send; // 返回一个异步 future，完成后可选地产生最终消息
} // 这里结束任务接口定义
```

对应源码：

- [`codex-rs/core/src/tasks/mod.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/tasks/mod.rs)

这段代码其实已经把事情说穿了：

- 一次 turn 不是“同步调用一下模型”
- 它是一个可取消、可观测、可流式输出的后台任务

### 3.3 一轮 turn 大致会经历这些阶段

我把它拆成最通俗的 9 步：

1. 用户输入进入系统
1. runtime 为这轮构造 `TurnContext`
1. 系统收集历史、配置、skills、可用 tools
1. 构造模型输入
1. 模型开始流式输出
1. 如果模型触发 tool call，就进入 tool runtime
1. 工具结果再回填模型继续推理
1. UI 端持续收到流式事件
1. turn 结束后，把过程写入 rollout 和 state

### 3.4 `TurnContext` 是这一轮执行的“工作台”

虽然 `TurnContext` 本身结构很大，但从概念上看，它像是本轮任务的工作台，里面放着：

- cwd
- sandbox policy
- approval policy
- 可用工具
- 当前线程和 turn 元数据
- 模型配置
- 与 state / telemetry / auth / network policy 相关的上下文

这一步非常关键，因为：

**模型看到的不是裸环境，而是 harness 为这轮任务准备好的可见世界。**

### 3.5 为什么这条链路要做成“流式事件”

这也是很多人第一次看 Codex 容易忽略的点。

如果系统只是：

- 收到输入
- 过一会儿返回一个答案

那就还是聊天式产品。

但 `Codex` 在过程里会持续发出事件：

- item started
- item completed
- command output delta
- approval requested
- agent message delta
- turn completed

这样 UI 才能真实反映：

- 它现在在干什么
- 哪一步卡住了
- 哪一步需要你批准
- 哪一步已经成功

也就是说，`Codex` 的体验不是“看最终结果”，而是“看执行过程”。

### 3.6 这套 turn 模型的工程价值

如果只用一句话总结这一章，我会说：

> 在 Codex 里，一轮交互不是一段文本，而是一串可执行、可展示、可回放、可恢复的 item 流。

这就是为什么它能做成 agent runtime，而不只是聊天壳。

## 4. 为什么工具执行必须带审批、沙箱和策略控制

这一章是全文最关键的部分。

如果你要抓住 `Codex` 和“聊天 + shell”这类简单系统的本质差别，重点就在这里。

{% asset_img figure-05.svg %}

### 4.1 模型只能“提议动作”，不能直接拥有执行权

这是我看完 `Codex` 后最强烈的一个感受。

在它的设计里，模型不是直接拿着系统权限乱跑，而是：

- 模型提议要调用某个工具
- runtime 判断这个动作该不该允许
- runtime 决定用什么权限级别执行
- runtime 决定失败后能不能重试、要不要升级

这个分工非常重要。

因为它意味着：

**模型只负责做决策，真正的权限边界掌握在 runtime 手里。**

### 4.2 Tool Orchestrator 把风险控制收口了

`core/src/tools/orchestrator.rs` 开头就已经把设计意图写得很直白了：

- approval
- sandbox selection
- retry semantics

如果把它裁剪成最核心的逻辑，大致是这样：

```rust
pub async fn run(...) -> Result<OrchestratorRunResult<Out>, ToolError> { // 工具总调度入口：把审批、沙箱、重试都收口在这里
    // 1) 先决定这次调用是直接放行、需要审批，还是直接禁止
    let requirement = tool.exec_approval_requirement(req) // 先询问具体工具：这次调用有没有特殊审批要求
        .unwrap_or_else(|| default_exec_approval_requirement(...)); // 如果工具没特殊要求，就退回通用默认策略

    match requirement { // 按审批结论进入不同分支
        ExecApprovalRequirement::Skip { .. } => {} // 可以直接继续，说明这次调用不需要额外确认
        ExecApprovalRequirement::Forbidden { reason } => { // 如果策略明确禁止
            return Err(ToolError::Rejected(reason)); // 直接拒绝，不再尝试执行
        } // 这里结束禁止分支
        ExecApprovalRequirement::NeedsApproval { .. } => { // 如果这次调用必须先审批
            let decision = tool.start_approval_async(req, approval_ctx).await; // 走异步审批流程，可能找用户，也可能找 guardian
            if decision.is_rejected() { // 如果审批结果是不允许
                return Err(ToolError::Rejected("rejected".into())); // 立即终止本次工具执行
            } // 这里结束“审批被拒”分支
        } // 这里结束“需要审批”分支
    } // 这里结束审批判断

    // 2) 在选定的 sandbox 里做第一次尝试
    let initial_sandbox = self.sandbox.select_initial(...); // 先挑一个初始沙箱级别，而不是默认给最高权限
    let first_result = Self::run_attempt(tool, req, tool_ctx, &initial_attempt, ...).await; // 在这个沙箱里真的跑一次

    // 3) 如果因为 sandbox 被拒绝，再决定要不要升级重试
    match first_result { // 根据第一次执行结果继续分流
        Ok(out) => Ok(...), // 如果直接成功，就把结果返回给上层
        Err(ToolError::Codex(CodexErr::Sandbox(...))) => { // 如果失败原因是沙箱限制
            // 根据策略决定是否升级
            ... // 这里会继续判断：能不能提权、要不要重试、需不需要再次审批
        } // 这里结束“沙箱拒绝”分支
        Err(err) => Err(err), // 其他类型的错误原样向上抛出
    } // 这里结束首次尝试结果处理
} // 这里结束 orchestrator 的主执行函数
```

对应源码：

- [`codex-rs/core/src/tools/orchestrator.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/tools/orchestrator.rs)

如果只看这段流程，你会发现它其实是在做一个非常典型的 harness 动作：

1. 先判断风险
1. 再判断权限
1. 再选择隔离环境
1. 再决定是否执行
1. 最后再看是否允许升级

### 4.3 审批不是体验负担，而是副作用熔断器

很多人看 agent 时会觉得审批很烦。

但站在系统设计角度，审批的真正作用是：

**在模型即将做高风险动作时，给系统一个“从自动回到受控”的机会。**

它不是为了打断用户，而是为了防止这些问题直接落地：

- 未经确认的高风险命令
- 越权写文件
- 外部网络访问
- 破坏性 git 操作
- 可疑数据外发

### 4.4 沙箱不是可选优化，而是本地 Agent 的底线

一旦 agent 能跑命令、改文件、联网，沙箱就不再是“锦上添花”，而是最基本的安全边界。

在 `Codex` 里，沙箱不是某个命令行 flag 的附属品，而是 runtime 一等公民：

- 先在受限环境里尝试
- 再按策略决定是否升级
- 平台上分别处理 macOS / Linux / Windows

你可以把它理解成：

- 审批负责“要不要做”
- 沙箱负责“最多能做到什么程度”

### 4.5 连 `apply_patch` 都不是随便放行的

`apply_patch` 很容易被误以为只是一个普通文件编辑工具，但 `Codex` 对它也做了专门的安全判断：

```rust
match assess_patch_safety(...) { // 先对 patch 做安全评估，而不是直接应用
    SafetyCheck::AutoApprove { .. } => { // 如果这个 patch 足够安全，可以自动放行
        DelegateToRuntime(ApplyPatchRuntimeInvocation { // 把真正执行 patch 的动作交给 runtime
            exec_approval_requirement: ExecApprovalRequirement::Skip { ... }, // 标记为这次无需再额外审批
            ... // 其余字段包括 patch 本身和运行时所需元信息
        }) // 返回“交给 runtime 执行”的指令
    } // 这里结束自动放行分支
    SafetyCheck::AskUser => { // 如果 patch 有副作用，但风险没有高到直接拒绝
        DelegateToRuntime(ApplyPatchRuntimeInvocation { // 同样交给 runtime 去真正执行
            exec_approval_requirement: ExecApprovalRequirement::NeedsApproval { ... }, // 但这次先要求用户审批
            ... // 其余字段保持不变
        }) // 返回“需要审批后再执行”的指令
    } // 这里结束需要用户确认分支
    SafetyCheck::Reject { reason } => { // 如果 patch 风险太高或者明显不合理
        Output(Err(FunctionCallError::RespondToModel( // 直接构造一个返回给模型的错误结果
            format!("patch rejected: {reason}") // 把拒绝原因拼成模型能读懂的消息
        ))) // 让这次 apply_patch 到此结束
    } // 这里结束直接拒绝分支
} // 这里结束 patch 安全评估
```

对应源码：

- [`codex-rs/core/src/apply_patch.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/apply_patch.rs)

这段逻辑很值得强调，因为它说明：

**即便是“改文件”这种看似日常的动作，在 agent runtime 里也必须先经过风险判断。**

### 4.6 Guardian 的意义：在高风险点再加一层 reviewer

除了用户审批，Codex 还有一层很有意思的设计：`guardian`。

它的想法不是“永远相信主模型”，而是在高风险审批点，引入一个专门的审查子代理帮助做判断。

这件事说明它已经不是“一个模型 + 一堆工具”的朴素设计，而开始引入更复杂的**模型间制衡**。

### 4.7 本章的核心判断

如果只记住一句话，我建议记这个：

> 在 Codex 里，工具不是模型直接拥有的权力，而是 runtime 按审批、策略和沙箱有条件借给模型的能力。

这就是 harness 的精髓。

## 5. 为什么 MCP、plugins、skills 必须是一等公民

如果只做一个“本地读文件 + 跑 shell”的 agent，其实不需要那么复杂的扩展系统。

但 `Codex` 很明显不是这么想的。

{% asset_img figure-06.svg %}

### 5.1 真实世界的 Agent，能力来源一定是分散的

真正的工作环境里，能力来源从来不是单一的：

- 本地 shell
- 文件系统
- git
- 文档系统
- issue / PR 系统
- 数据库
- 企业内部工具
- 云服务和第三方 API

如果把所有这些能力都硬写进 `codex-core`，很快就会遇到几个问题：

- core 越来越臃肿
- 发布节奏被绑死
- 权限和认证处理越来越乱
- 某些能力只适用于部分用户

所以，平台化扩展面几乎是必然的。

### 5.2 MCP 的角色：把外部能力协议化

MCP 在 `Codex` 里的位置很关键。

它不是简单地多加一个“远程工具调用”功能，而是在说：

**外部能力接入，应该通过统一协议来完成。**

这样 core 不需要认识所有外部系统的细节，只需要知道：

- 这是一个 MCP server
- 它暴露了哪些 tool / resource
- 调用时用统一的 schema 和流程处理

这会显著降低扩展时的耦合度。

### 5.3 Skill 的角色：把经验和流程结构化

`Skill` 和 MCP 不一样。

MCP 更偏“连接外部能力”，而 skill 更偏“把经验注入模型”。

它通常会包含：

- 某类任务的背景知识
- 推荐的工作流程
- 工具使用约束
- 特定场景下的 prompt / 指令

这相当于把零散经验，变成可复用的能力单元。

### 5.4 Plugin 的角色：把能力打成包

Plugin 更进一步。

它往往不只是一段说明，而是一个完整的扩展单元，可能同时包含：

- skills
- apps
- MCP server
- marketplace 元数据

所以插件的作用，不只是“多一个功能”，而是让 Codex 从产品走向平台。

### 5.5 工具注册计划暴露了 Codex 的扩展哲学

`tools/src/tool_registry_plan.rs` 里有一段代码特别能说明问题：

```rust
if config.has_environment { // 只有当前运行环境允许访问本地环境时，才暴露本地执行工具
    plan.push_spec(create_exec_command_tool(...), true, ...); // 把 `exec_command` 这种本地执行工具加进工具表
} // 这里结束“本地环境工具”分支

if params.mcp_tools.is_some() { // 如果这轮上下文里存在 MCP 工具
    plan.push_spec(create_list_mcp_resources_tool(), true, ...); // 暴露“列出 MCP 资源”工具
    plan.push_spec(create_read_mcp_resource_tool(), true, ...); // 暴露“读取 MCP 资源”工具
} // 这里结束 MCP 工具注册分支

plan.push_spec(create_update_plan_tool(), false, ...); // 无论如何都把 `update_plan` 这种元工具放进来

if config.request_permissions_tool_enabled { // 如果当前特性开关允许模型申请额外权限
    plan.push_spec(create_request_permissions_tool(...), false, ...); // 就把 `request_permissions` 工具暴露给模型
} // 这里结束权限申请工具注册分支
```

对应源码：

- [`codex-rs/tools/src/tool_registry_plan.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/tools/src/tool_registry_plan.rs)

这段代码说明了几个很关键的设计点：

1. 工具是按配置和能力条件被拼出来的
1. 本地环境工具和 MCP 工具是同一注册体系的一部分
1. `request_permissions`、`update_plan` 这种“元工具”也是一等公民

这不是随手塞几个函数，而是在构建一张**能力暴露面**。

### 5.6 为什么说它们必须是一等公民

因为如果不是一等公民，就会出现这些坏味道：

- 扩展只能靠修改 core
- 不同类型的能力没有统一暴露模型的方法
- UI 很难统一展示和审批
- 状态系统很难理解这些外部能力发生过什么

而 `Codex` 现在的方向很明显是相反的：

**能力可以很多样，但进入模型和 runtime 的方式必须统一。**

## 6. 为什么需要 rollout、SQLite、memory pipeline 这类长期状态设施

如果一个系统只有“单轮问答”，那历史状态并不那么重要。

但 agent 一旦要做长期协作，状态层就变成刚需。

{% asset_img figure-07.svg %}

### 6.1 Rollout：先把过程记下来

`rollout` 这层你可以理解成事件流落盘。

它记录的不是一句最终答案，而是过程里的很多 item：

- 用户消息
- agent message
- tool call
- command output
- file change
- completion event

这很重要，因为对 agent 来说，过程本身就是价值的一部分。

### 6.2 这三层到底是“当前 session 的”，还是“长期持久的”？

这个问题非常容易混淆，我单独说一下。

短答案是：

- `rollout` 不是只活在当前一轮对话里的临时记忆，而是**以 thread / session 为单位持久化的原始记录**
- `SQLite state` 不是某个 session 自己的私有记忆，而是**整个 Codex 本地运行时跨 session 的结构化状态库**
- `memory pipeline` 更进一步，它不是只服务当前 session，而是**从多个历史 session 中提炼长期记忆，用来服务未来 session**

如果想用一句更容易记的话来区分：

- `rollout`：这个 session 里到底发生了什么
- `SQLite state`：整个系统如何高效管理很多 session 的状态
- `memory pipeline`：从很多 session 中抽出未来还值得继续记住的东西

所以它们三者都不是“只在当前 turn 里活一下”的临时状态，但持久化范围不同：

- `rollout` 更贴近单个 session
- `SQLite state` 更贴近全局状态管理
- `memory pipeline` 更贴近跨 session 的长期记忆

### 6.3 SQLite State：再把过程整理成可查询状态

仅有原始 rollout 还不够，因为日志虽然完整，但不适合直接做各种状态查询。

这时 `state` 层就出现了。

`codex-rs/state/src/lib.rs` 开头非常直接：

```rust
//! SQLite-backed state for rollout metadata. // 这句模块文档直接说明：这里存的是从 rollout 中抽出来的结构化状态

mod extract; // 负责从 rollout item 中抽取结构化字段
pub mod log_db; // 暴露日志数据库相关能力
mod migrations; // 管理 SQLite 表结构的迁移
mod model; // 定义线程、日志、作业等数据模型
mod runtime; // 提供真正对外使用的状态运行时封装

pub use runtime::StateRuntime; // 重新导出状态运行时，给外部模块作为主入口
pub use model::ThreadMetadata; // 重新导出线程元数据结构，方便其他模块直接引用
```

对应源码：

- [`codex-rs/state/src/lib.rs`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/state/src/lib.rs)

这说明 `state` 层的职责很清晰：

- 从 rollout 里抽取结构化信息
- 写进 SQLite
- 提供线程、日志、记忆、作业等查询能力

如果只用一句话概括：

- rollout 像原始日志
- SQLite state 像索引和状态视图

### 6.4 Memory Pipeline：再从“发生过什么”里提炼“未来还要记什么”

`memory` 这层更进一步。

根据 `core/src/memories/README.md`，它大致分两步：

```text
Phase 1:
- 从近期 rollout 中挑选可用线程
- 抽取结构化 raw_memory 和 rollout_summary
- 写回 state DB

Phase 2:
- 选出最有价值的 stage-1 outputs
- 刷新本地 memory artifacts
- 再让 consolidation agent 做全局整理
```

对应文档：

- [`codex-rs/core/src/memories/README.md`](https://github.com/openai/codex/blob/2e1003728c61e62636dd7a29a7fee95050fb9cc6/codex-rs/core/src/memories/README.md)

这背后的本质问题是：

- 历史越来越长
- 上下文窗口永远有限

所以你不能只是“都塞给模型”，而是得分层处理：

1. 原始过程先落盘
1. 再抽成结构化状态
1. 再提炼成更稠密、对未来更有用的记忆

### 6.5 这也是为什么 Codex 不像一个临时脚本

一旦有了 rollout、SQLite、memory pipeline，Codex 的味道就变了。

它不再像一个“临时运行一下就结束”的小工具，而更像一个会逐步积累状态的本地协作系统。

你可以把它理解成：

- 没有 rollout，系统就没法复盘
- 没有 state，系统就没法高效管理历史
- 没有 memory，系统就没法把过去经验变成未来上下文

### 6.6 一句话总结这一章

> Agent 不是一次性函数调用，而是长期运行的状态机；既然是状态机，就必须有日志层、状态层和记忆层。

## 7. 这个架构的主要 tradeoff

看到这里，`Codex` 的设计看起来已经很完整了。

但越是完整的系统，越要诚实地看 tradeoff。

{% asset_img figure-08.svg %}

### 7.1 贴近本地，意味着必须拥抱操作系统复杂性

本地 Agent 最大的好处是：

- 真能贴着你的环境干活

但代价也很明显：

- macOS、Linux、Windows 的执行隔离完全不是一回事
- 路径、shell、权限、sandbox 细节各平台差异巨大
- 一套跨平台 harness 很难写得既统一又不失真

所以，本地执行能力越强，跨平台复杂度就越高。

### 7.2 UI 解耦带来了平台化收益，也带来了协议维护成本

`App Server` 让 TUI、IDE、桌面端都能复用同一套核心能力，这是很大的收益。

但成本是：

- 协议要长期维护
- streaming 语义要稳定
- 客户端和服务端要做更多兼容
- 出问题时排查链路更长

所以 UI 解耦从来不是“没有代价的优雅”。

### 7.3 状态层越强，一致性问题越真实

一旦同时存在：

- rollout
- SQLite state
- memory pipeline
- UI 事件流
- thread fork / resume

系统就不得不面对一致性问题：

- 哪一层是事实来源
- 异步任务失败怎么办
- history 和 memory 不一致怎么办
- 中断执行后如何恢复

这些问题在聊天产品里不明显，但在 agent runtime 里会越来越关键。

### 7.4 Harness 越强，用户体验就越要在安全和流畅之间找平衡

强 harness 的好处是：

- 更安全
- 更可控
- 更可审计

但它也会带来：

- 审批弹窗更多
- 权限模型更复杂
- 运行链路更长
- 出错分支更多

所以 Codex 这种系统，永远在做一件事：

**在自动化体验和执行安全之间找一个用户能接受的平衡点。**

### 7.5 这也是为什么“做成产品”比“做成 demo”难很多

如果只是做 demo：

- 有个 shell tool
- 有个 file edit
- 有个 prompt

其实已经能跑出很唬人的效果。

但一旦真要做成产品，你就必须解决：

- 权限
- 审批
- 沙箱
- 状态
- 回放
- 恢复
- 跨前端一致性
- 扩展性

这就是 `Codex` 真正有工程含量的地方。

## 8. 写在最后：怎么评价 Codex 这套设计

我觉得看完 `openai/codex` 之后，最值得记住的不是某个具体子模块，而是下面这个整体判断。

{% asset_img figure-09.svg %}

### 8.1 它的核心不在“会不会调工具”

今天很多 agent 项目看起来都能：

- 读文件
- 跑命令
- 改代码

所以如果只看表面功能，很容易觉得它们差不多。

但 `Codex` 真正拉开差距的地方，不是“工具列表更长”，而是：

**它把工具调用放进了一套受控执行系统里。**

### 8.2 它更像一个本地 Agent Runtime，而不是终端聊天壳

这体现在几乎每一层：

- CLI / TUI 只是入口和界面
- App Server 负责多前端共享能力
- Core 负责会话、turn、tool orchestration、state bridge
- Tools 负责能力暴露和执行收口
- State / Memory 负责长期状态

这不是“把模型包成一个终端程序”，而是“把模型放进一个本地执行平台”。

### 8.3 Harness 是理解 Codex 的最佳视角

如果只用一句话概括全文，我会写成这样：

> `Codex` 的核心价值，不是让模型会调用工具，而是用 harness 把一个会犯随机错误的概率模型，包装成一个副作用可控、风险可管理、状态可积累的本地 Agent。

### 8.4 如果只记住 4 句话

我建议记这 4 句：

1. `Codex` 不是普通聊天，而是本地执行闭环
1. 一旦有副作用，Agent 设计重心就从 prompt 转向 harness
1. `CLI / TUI / App Server / Core / Tools / State` 这套分层，本质上是在分离“交互、执行、扩展、状态”
1. 真正的壁垒不是工具数量，而是受控执行、长期状态和跨前端一致性

这也是为什么我会觉得，`openai/codex` 最值得看的，不是某个炫技功能，而是它把 Agent 工程化这件事做得非常彻底。
