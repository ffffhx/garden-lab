---
title: "从 ChatGPT 到 Codex：AI 使用方式是怎么一步步变化的"
date: 2026-04-22 15:30:00
categories:
  - 技术
tags:
  - AI
  - ChatGPT
  - GitHub Copilot
  - Cursor
  - Claude Code
  - Codex
  - Agent
  - Browser
  - Computer Use
excerpt: "按官方资料把这几年 AI 的使用方式串起来回看一遍：网页对话、Tab 补全、仓库级 IDE Agent、CLI Agent、多代理和自动化，以及浏览器和电脑操作开始扩展 AI 执行边界的新阶段。"
cover: "cover-v2.png"
coverPosition: "below-title"
---

## 摘要

如果只看我自己，以及我身边很多开发者这几年的真实使用路径，大概都能画出一条很像的线：

- 先是在网页里和 AI 对话
- 再开始在编辑器里按 `Tab` 接受补全
- 再往后，把 `Cursor` 这类能读整个仓库的 AI IDE 当成副驾驶
- 然后进入 `Claude Code`、`Codex CLI` 这种命令行 Agent 阶段
- 到现在，工具已经开始往“多代理并行、后台执行、自动化协作”的方向发展
- 再往后，AI 开始进入浏览器、网页系统和桌面环境

但这里要先说清楚一个容易混淆的事实：

**如果按产品发布时间排序，这条线并不严格成立。**

例如，`GitHub Copilot` 的技术预览发布时间是 `2021-06-29`，比 `ChatGPT` 的 `2022-11-30` 还早。也就是说，**市场上的产品时间线**和**普通开发者真正形成习惯的采用路径**，不是一回事。

这篇文章我会优先沿着“采用路径”来写，因为它更接近真实体验；但所有关键节点，我都尽量用官方资料把日期和产品定位钉住。

{% asset_img figure-01.svg %}

## 1. 第一阶段：网页对话，AI 先成为“会聊天的外脑”

`2022-11-30`，OpenAI 在 [Introducing ChatGPT](https://openai.com/index/chatgpt/) 里把 ChatGPT 作为 research preview 推出。官方当时强调的是：

- 它可以用对话方式回答追问
- 可以承认错误
- 可以质疑错误前提
- 也可以拒绝不合适请求

这一步的意义，不只是“多了一个聊天机器人”，而是：

**AI 第一次以极低门槛进入了普通人的日常工作流。**

很多人第一次真正把 AI 用起来，不是因为它会写代码，而是因为网页对话这件事太顺手了：

- 报错了，把错误粘进去
- 不懂一个概念，直接问
- 想写个脚本，先让它给个雏形
- 看不懂一段代码，贴进去让它解释

甚至在 ChatGPT 的首发页面里，官方样例里就有“这段代码不工作，怎么修”的场景。这很说明问题：**网页对话虽然没有直接连接仓库，但已经开始承接程序员的真实需求了。**

不过这个阶段的局限也非常明显：

- 上下文靠手工复制粘贴
- 模型看到的是你贴进去的局部，不是你的工程全貌
- 它能回答，但不能直接验证
- 它能给方案，但不能替你跑命令、改文件、看测试结果

所以这时的 AI 更像一个“外脑”：

- 它擅长解释、归纳、起草
- 但它并不真正处在你的工程执行面里

## 2. 第二阶段：Tab 补全，AI 被塞回编辑器的击键流里

如果说网页对话解决的是“先问再做”，那 `GitHub Copilot` 代表的下一步，解决的就是“边写边做”。

`GitHub` 在 `2021-06-29` 发布的 [Introducing GitHub Copilot: your AI pair programmer](https://github.blog/news-insights/product-news/introducing-github-copilot-ai-pair-programmer/) 中，把 Copilot 定义成一个能“根据你正在写的代码，建议整行甚至整个函数”的 AI pair programmer。

这里有个地方很容易混淆：`Tab` 补全这个交互本身并不是 `GitHub Copilot` 发明的。

在 Copilot 之前，命令行、IDE、`IntelliSense`、`LSP`、代码片段工具，早就可以用 `Tab` 或回车来接受补全了。传统补全更多依赖的是：

- 语法分析
- 类型信息
- 符号表
- 已导入模块
- API 列表
- snippet 模板

这些能力当然很重要，但它们不一定是 AI。它们回答的更多是：“当前位置有哪些合法的变量、方法、参数或模板？”

`Copilot` 真正改变的不是“按 `Tab` 接受建议”，而是**灰色建议背后的生成机制变了**。

也就是说，开发者看到的还是一个熟悉的编辑器交互：

```plaintext
灰色建议出现 -> 按 Tab 接受 -> 代码进入文件
```

但背后已经从规则、索引和 snippet，变成了由模型根据上下文生成整行甚至整个函数。

所以，`2021-06-29` 这个时间点当然已经有 AI。只是那时还没有 `ChatGPT` 这种大众化对话入口。`GitHub` 在 `2025-08-29` 的 [Under the hood: Exploring the AI models powering GitHub Copilot](https://github.blog/ai-and-ml/github-copilot/under-the-hood-exploring-the-ai-models-powering-github-copilot/) 里回顾得很清楚：`Copilot` 刚发布技术预览时，`OpenAI` 还没有推出 `ChatGPT`；当时的 `Copilot` 由单一模型 `Codex` 驱动，而 `Codex` 是 `GPT-3` 的后代模型。

换句话说：

**2021 年的 Copilot 已经是 AI 补全；`Tab` 只是接受建议的交互方式，真正变化的是补全内容开始由代码大模型生成。**

如果放在开发者的使用方式这条线里看，这一步最关键的变化还不只是模型更强，而是**交互位置变了**：

- AI 不再待在浏览器标签页里
- 它进入了编辑器
- 它不要求你先停下来提问
- 它开始在你写代码的瞬间给出低延迟预测

很多开发者真正形成稳定高频使用习惯，其实就是从这里开始的。原因很简单：

- 接受建议只要一个 `Tab`
- 不打断当前心流
- 对样板代码、测试、API 调用、重复逻辑特别有效

但是，早期 `Tab` 补全的边界也很明显。`GitHub` 在 `2023-05-17` 的 [How GitHub Copilot is getting better at understanding your code](https://github.blog/ai-and-ml/github-copilot/how-github-copilot-is-getting-better-at-understanding-your-code/) 一文里明确提到：

- 最初版本主要只看当前文件
- 后来才逐步加入 `neighboring tabs`、`Fill-in-the-Middle`、向量检索等机制
- 目标是让它从“当前光标附近”走向“更懂整个项目”

这说明 `Tab` 补全阶段的本质仍然是：

**AI 已经进入编辑器，但它主要还是一个局部预测器，而不是一个完整的工程执行者。**

{% asset_img figure-02.svg %}

## 3. 第三阶段：仓库级 IDE Agent，AI 开始“先读代码库，再动手”

真正把“补全”推进到“代理”的，是 `Cursor` 这类 AI IDE。

我觉得 `Cursor` 做对的一件事，是它不再把 AI 只当成一个在光标后面吐 token 的模型，而是把它变成了一个会先理解仓库、再决定怎么改代码的系统。

从官方资料看，这个变化是分几步成形的：

- `Cursor` 文档里的 [Codebase Indexing](https://docs.cursor.com/chat/codebase) 明确写了：打开项目后，Cursor 会自动为代码库里的文件计算 embeddings，并逐步建立索引
- `2025-02-19` 的 [Agent is ready and UI refresh](https://www.cursor.com/en/changelog/agent-is-ready-and-ui-refresh) 里，Cursor 直接把 `Agent` 设成默认模式
- `2025-05-15` 的 [0.50 更新](https://cursor.com/cn/changelog/0-50) 又把 `Background Agent` 推出来
- 到 `2026-04-02` 的 [Cursor 3 / Agents Window](https://cursor.com/changelog) 阶段，官方已经在强调“可以在不同 repo、不同环境里并行运行多个 agents”

而在产品页 [Cursor Agent](https://cursor.com/product) 上，官方现在的表述已经非常直接：

- `Cursor deeply learns your codebase before writing a single line`
- 子代理可以并行探索代码库
- 它覆盖从规划、编写到 review 的完整流程

这一步和 `Tab` 补全的差别，已经不是“建议更准一点”了，而是下面这些能力开始组合起来：

- 代码库索引
- 跨文件检索
- 多文件修改
- 终端命令
- 团队规则
- PR / 提交历史等更长链路上下文

换句话说，`Cursor` 代表的是：

**AI 不再只对“你正在写的这一行”负责，而是开始对“这个任务在整个仓库里应该怎么落地”负责。**

这时开发者和 AI 的关系也变了：

- 原来是“我写，AI 补”
- 现在更像是“我描述任务，AI 先探索，再给出改动，我审查和修正”

{% asset_img figure-03.svg %}

## 4. 第四阶段：CLI Agent，AI 真正进入工程执行面

再往后，很多人会发现一个很自然的结果：

如果 AI 已经能读仓库、改多文件、跑命令，那它最适合待的地方，往往不是 IDE 侧栏，而是**终端**。

`Claude Code` 是这个阶段最有代表性的产品之一。

从官方信息看，`Anthropic` 在 `2025-02-27` 的活动页 [AI agents in the Enterprise](https://www.anthropic.com/webinars/ai-agents-in-enterprise) 中，已经把 `Claude Code` 描述为其“first agent product in research preview”的首次公开演示。后续在 [Claude Code Quickstart](https://code.claude.com/docs/en/quickstart) 和 [Claude Code 产品页](https://www.anthropic.com/product/claude-code) 里，Anthropic 把它的工作方式写得非常清楚：

- 安装后直接在项目目录里运行
- 可以读取项目文件理解代码库
- 可以修改文件
- 可以执行命令
- 可以用 git
- 可以跑测试
- 默认会在关键动作前请求许可

Anthropic 甚至在产品页上直接把它定义成：

**`agentic, not autocomplete`**

这句话我觉得非常准确。因为到了 CLI 阶段，AI 的身份彻底变了：

- 它不再主要是“补全器”
- 也不只是“IDE 里的聊天框”
- 它开始成为一个真正站在工程执行面上的协作者

为什么 CLI 这么重要？因为工程师本来的主战场就一直在这里：

- `git`
- `build`
- `test`
- `lint`
- `docker`
- `ssh`
- 各种项目脚本和自定义命令

也就是说，CLI Agent 并不是多开了一块新界面，而是直接进入了原来最关键的那块界面。

OpenAI 在 `2025-05-16` 的 [Introducing Codex](https://openai.com/index/introducing-codex/) 里也给出了同样的信号：官方在介绍云端 Codex 的同时明确写到，`Last month, we launched Codex CLI`。而到了 `2026-02-02` 的 [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/) 里，OpenAI 又进一步把 `CLI / web / IDE-extension / app` 这些表面统一到同一个 Codex 体系之下。

所以我会把 CLI 阶段理解成一个分水岭：

**从这里开始，AI 不再只是“帮你写代码”，而是开始“替你推进软件工程任务”。**

{% asset_img figure-04.svg %}

## 5. 第五阶段：多代理和自动化，AI 开始处理长任务

最近这一阶段，真正新的地方不是“又多了几个 AI 编程工具”，而是：

- AI 不再只处理眼前这一个对话
- 开始把一个任务拆成多个并行子任务
- 开始在后台持续运行
- 开始接手可重复的日常工程动作

如果看官方资料，这条线在 `Cursor` 和 `OpenAI Codex` 上已经很清楚。

到 `2026-04-02` 的 `Agents Window`，`Cursor` 官方已经在强调：

- 多代理并行
- 多 repo / 多环境
- 本地、云端、远程 SSH、worktree 联动

而在 `2025-05-15` 的 [0.50 更新](https://cursor.com/cn/changelog/0-50) 里，`Background Agent` 也已经被 Cursor 直接定义成用于 `parallel task execution` 的能力。

`OpenAI Codex` 这边也一样。`2025-05-16` 的官方介绍页已经把 Codex 定义成：

- 能并行处理多个任务的云端软件工程 Agent
- 每个任务运行在独立 cloud sandbox 中

到 `2026-02-02` 的 [Codex app](https://openai.com/index/introducing-the-codex-app/) ，OpenAI 更是把这条线写得更完整了：

- 可以 `parallel` 地和多个 agents 一起工作
- 可以把 `recurring work` 交给 `automations`
- 自动化会按设定时间在后台运行，并把结果送回 review queue

我觉得这一步很关键，因为它意味着 AI 编程开始从“交互式辅助”走向“持续性执行”。

以前更像这样：

- 我问一次
- AI 回一次
- 我再决定下一步

现在更像这样：

- 我定义一个较大的目标
- AI 拆成多个任务并行推进
- 一部分任务在后台慢慢跑
- 一部分重复性工作被做成自动化
- 我在关键节点回来审查结果和纠偏

所以第五阶段真正发生的变化不是“产品变多了”，而是：

**AI 开始从一次性回答工具，变成能并行处理、后台运行、重复执行的软件工程执行系统。**

{% asset_img figure-05.svg %}

## 6. 第六阶段：浏览器和电脑操作，AI 开始进入真实工作环境

如果说第五阶段解决的是“任务能不能并行、后台、持续地跑”，那接下来这一步解决的是另一个问题：

**AI 能不能进入人真正工作的那些界面。**

这里的界面，不只是代码编辑器和终端，而是：

- 浏览器
- 网页后台
- DevTools 和请求链路
- 公司内部研发平台
- 桌面应用
- 系统窗口和本机文件

OpenAI 在 `2026-04-16` 的 [Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/) 里，把这条线写得很直接：Codex 开始通过 `background computer use` 看屏幕、点击、输入，并且在 Codex app 里加入内置浏览器。官方同时提到，这类能力对前端迭代、应用测试，以及那些没有 API 的工具尤其有用。

这一步的变化很大。

以前即使 AI 能把代码改好，很多工程动作还是会卡在网页系统里：

- 要去平台上创建一个研发任务
- 要去需求系统里新建一个 Meego
- 要打开 BITS 绑定分支、触发流水线、查看构建结果
- 要进网页控制台复现一次操作
- 要看浏览器里真实发出的请求
- 要在一个没有开放 API 的后台系统里点几个按钮

这些动作很长一段时间都还是“人自己打开网页去做”。因为它们不在仓库里，也不在终端里，更不是一个可以直接 `curl` 的稳定接口。

现在这个边界开始松动了。

对 `Claude Code` 来说，官方文档已经把它描述成一个可以运行在终端、IDE、桌面应用和浏览器里的编码工具；同时通过 [MCP](https://code.claude.com/docs/en/mcp)，它可以接到 issue tracker、监控平台、数据库、设计工具、Slack、Google Drive 这类外部系统。更底层一点，Anthropic 的 [Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool) 也已经把“通过截图理解界面、再用鼠标和键盘操作桌面环境”定义成一类工具能力。

所以这一阶段我不会把它简单理解成“AI 又多了一个浏览器”。更准确地说，它意味着：

**AI 开始从软件工程环境，扩展到真实工作环境。**

这会让很多过去不适合交给 AI 的事情，开始进入可协作范围：

- 前端页面改完后，让 AI 自己打开页面检查视觉和交互
- 让 AI 在浏览器里复现一个 bug，再回到代码里修
- 让 AI 在网页平台上创建任务、绑定分支、触发流程
- 让 AI 抓取一次真实请求，反推前后端接口关系
- 让 AI 操作一个只有 GUI、没有 API 的工具

但这一步也更需要边界。

因为浏览器和电脑操作一旦接上真实账号、真实系统、真实数据，风险就不再只是“代码改错了”。它可能变成：

- 点错按钮
- 提交错误表单
- 触发错误流程
- 泄露敏感页面信息
- 被网页内容里的 prompt injection 误导

所以这一阶段真正成熟的标志，不只是“AI 能点鼠标”，而是下面这些能力一起出现：

- 操作前有权限确认
- 高风险动作有人审查
- 浏览器和桌面环境有沙箱
- 登录态和敏感数据有隔离
- 操作过程可以回放和追踪
- 规则能明确告诉 AI 什么不能做

也就是说，AI 进入浏览器和电脑，并不是为了把人完全挤出流程，而是把更多过去只能由人手动完成的界面操作，纳入一个可观察、可审查、可回滚的协作链路里。

{% asset_img figure-06.svg %}

## 7. 这几年真正变了什么

如果只挑最本质的变化，我觉得是下面五件事。

### 7.1 上下文来源变了

- 网页对话时代：上下文靠手工粘贴
- Tab 补全时代：上下文主要来自当前文件和光标附近
- 仓库级 IDE 时代：上下文扩展到整个代码库
- CLI / 多代理 / 自动化时代：上下文扩展到仓库、终端、测试、PR、规则、历史任务、外部工具
- 浏览器 / 电脑操作时代：上下文继续扩展到网页、请求、后台系统、桌面应用和真实操作结果

### 7.2 动作能力变了

- 一开始，AI 只能回答
- 后来，它能补全
- 再后来，它能改文件
- 再往后，它能读代码、跑命令、过测试、提 PR、并行做多件事
- 现在，它开始能打开网页、填写表单、查看请求、操作桌面应用

### 7.3 人的角色变了

- 最开始，开发者是“提问的人”
- 然后是“接收补全的人”
- 接着变成“给任务、审改动的人”
- 再往后，更像是“给目标、设边界、做 review、做仲裁的人”
- 到浏览器和电脑操作阶段，人还要负责审批高风险动作、保护账号和敏感数据

### 7.4 工具形态也变了

过去我们会问：

- 哪个模型更强？
- 哪个补全更准？

现在更常见的问题已经变成：

- 它能不能读我的整个仓库？
- 它能不能调用终端和外部工具？
- 它有没有规则、记忆、审批和沙箱？
- 它能不能和 IDE、CLI、云端任务、后台自动化打通？
- 它能不能进入浏览器和桌面应用，完成那些没有 API 的真实流程？

也就是说，竞争点已经从“回答质量”逐步转向“上下文组织能力 + 执行能力 + 安全边界 + 工作流整合能力”。

### 7.5 执行边界变了

过去 AI 编程工具的边界基本围绕代码展开：

- 代码文件
- 终端命令
- 测试结果
- Git 历史
- PR 评论

但很多真实工作流并不只在这些地方发生。

一个软件工程任务从想法到上线，中间往往还会穿过需求系统、项目管理平台、CI/CD 页面、监控后台、权限系统、工单系统、设计稿、文档和各种内部网页。

浏览器和电脑操作的意义就在这里：

**AI 开始有机会把这些原本断开的界面串起来。**

这也解释了为什么我会把它单独列成第六阶段。它不是第五阶段“后台执行”的重复，而是把执行范围从工程工具链继续往外推了一层。

## 8. 我的结论

回头看这条路，我会把每一阶段概括成一句话：

- `ChatGPT` 让普通人第一次学会了怎么和 AI 说话
- `GitHub Copilot` 让 AI 进入了击键流，变成随时可用的补全器
- `Cursor` 让 AI 从“写下一行”升级成“先读仓库再改代码”的 IDE Agent
- `Claude Code`、`Codex CLI` 让 AI 真正进入终端，成为工程执行面上的协作者
- `Codex`、`Cursor` 等新一代产品，则开始把多代理、后台执行、自动化、规则、记忆和工具系统拼成一套完整工作流
- 带有浏览器和 `Computer Use` 能力的 Agent，让 AI 开始进入网页系统和桌面环境，连接真实工作流

所以，今天再看“我在用哪个 AI 编程工具”这个问题，已经不太够了。

更值得问的问题其实是：

**你的 AI 现在能看到多少上下文，能做多少动作，能不能在可控边界里持续把任务推进下去。**

这才是这几年真正发生的跃迁。

## 参考资料

下面这些链接，我优先选的是官方产品页、官方文档和官方博客：

- OpenAI, `2022-11-30`：[Introducing ChatGPT](https://openai.com/index/chatgpt/)
- GitHub, `2021-06-29`：[Introducing GitHub Copilot: your AI pair programmer](https://github.blog/news-insights/product-news/introducing-github-copilot-ai-pair-programmer/)
- GitHub, `2023-05-17`：[How GitHub Copilot is getting better at understanding your code](https://github.blog/ai-and-ml/github-copilot/how-github-copilot-is-getting-better-at-understanding-your-code/)
- Cursor Docs：[Codebase Indexing](https://docs.cursor.com/chat/codebase)
- Cursor, `2025-02-19`：[Agent is ready and UI refresh](https://www.cursor.com/en/changelog/agent-is-ready-and-ui-refresh)
- Cursor, `2025-05-15`：[0.50 更新：Background Agent 等能力](https://cursor.com/cn/changelog/0-50)
- Cursor, `2026-04-02`：[Cursor Changelog / Agents Window](https://cursor.com/changelog)
- Anthropic, `2025-02-27`：[AI agents in the Enterprise](https://www.anthropic.com/webinars/ai-agents-in-enterprise)
- Anthropic Docs：[Claude Code Quickstart](https://code.claude.com/docs/en/quickstart)
- Anthropic：[Claude Code Product Page](https://www.anthropic.com/product/claude-code)
- OpenAI, `2025-05-16`：[Introducing Codex](https://openai.com/index/introducing-codex/)
- OpenAI, `2026-02-02`：[Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- OpenAI, `2026-04-16`：[Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/)
- Anthropic Docs：[Claude Code overview](https://code.claude.com/docs)
- Anthropic Docs：[Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- Anthropic Docs：[Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
