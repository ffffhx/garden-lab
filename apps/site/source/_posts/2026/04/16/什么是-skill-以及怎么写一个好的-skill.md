---
title: "什么是 Skill，以及怎么写一个好的 Skill"
date: 2026-04-16 21:30:00
categories:
  - 技术
tags:
  - AI
  - Agent
  - Skill
  - OpenAI
  - Anthropic
  - Agent Skills
excerpt: "基于 OpenAI、Agent Skills 开放规范、Anthropic 与 Microsoft Learn 的官方资料，系统解释什么是 Skill、常见陌生术语是什么意思、它是怎么工作的，以及怎样把一个 Skill 写成可发现、可复用、可维护的工作流组件。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

很多人第一次看到 `skill`，会把它理解成“模型学会了一个新能力”。

但如果把官方资料放在一起看，你会发现这个理解并不准确。

- OpenAI 在 Help Center 里把 `skill` 解释成 **reusable, shareable workflows**
- Agent Skills 开放规范把它定义为：**一个至少包含 `SKILL.md` 的目录**
- OpenAI Codex 的官方介绍则强调：`skill` 会把 instructions、resources、scripts 打包起来，让 agent 能按团队偏好稳定完成任务

所以更准确的理解是：

**Skill 不是在训练一个新模型，而是在给 agent 提供一份可复用、可按需加载的执行手册。**

本文主要依据以下资料整理，观察时间截至 `2026-04-16`：

- OpenAI Help Center: [Skills in ChatGPT](https://help.openai.com/en/articles/20001066-skills-in-chatgpt)
- OpenAI Academy: [Skills](https://academy.openai.com/public/resources/skills)
- OpenAI: [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- Agent Skills: [What are skills?](https://agentskills.io/what-are-skills) / [Specification](https://agentskills.io/specification)
- Anthropic Docs: [Skill 撰写最佳实践](https://platform.claude.com/docs/zh-TW/agents-and-tools/agent-skills/best-practices)
- Microsoft Learn: [Agent Skills](https://learn.microsoft.com/en-us/agent-framework/agents/skills)

## 0. 阅读前先把陌生词说清楚

这篇文章会反复出现一些英文词。如果先把它们粗略翻成日常语言，后面会容易很多。

### 0.1 先分清角色

| 术语 | 可以先理解成 | 在本文里的意思 |
| --- | --- | --- |
| `model` | 基础大脑 | 负责理解文字、生成文字和代码的模型本体，例如 GPT、Claude 这类大语言模型。它本身不会因为你写了一个 skill 就被重新训练。 |
| `agent` | 会执行任务的助手 | 它在模型之上多了一层任务执行能力：会读上下文、选择工具、调用 skill、分步骤完成用户目标。可以把它理解成“模型 + 工具使用 + 任务编排”。 |
| `prompt` | 当场交代的一段话 | 你这一次发给模型或 agent 的请求，比如“帮我总结这篇文章”。它通常只服务于当前这一轮任务。 |
| `workflow` | 有顺序的办事流程 | 不只是一个请求，而是一套稳定步骤，例如“先查官方资料，再提取定义，再写摘要，再列来源”。 |
| `skill` | 给 agent 用的执行手册包 | 它把一个常见任务的做法、规则、模板、脚本打包起来，让 agent 下次遇到类似任务时按同一套方法做。 |
| `tool` | 可以被调用的具体能力 | 比如读文件、查网页、运行测试、操作浏览器、创建文档。工具负责“能做什么动作”。 |
| `MCP` | 工具接入协议 | 全称是 Model Context Protocol。它不是某一个工具，而是一套让 agent 发现工具、调用工具、读取返回结果的通信规范。 |
| `client` | 发起调用的一侧 | 例如 Codex、Claude Code、Cursor 这类 agent 应用。它们决定什么时候使用某个 skill 或工具。 |
| `server` | 提供能力的一侧 | 在 MCP 语境里，server 通常是一个本地或远程进程，向 client 暴露一组可调用工具。 |

所以，`agent`、`skill`、`tool`、`MCP` 的关系可以先这样记：

**agent 是执行者，skill 是做事方法，tool 是具体动作，MCP 是连接工具的协议。**

### 0.2 再看 Skill 文件里的词

| 术语 | 通俗解释 | 需要注意的点 |
| --- | --- | --- |
| `SKILL.md` | skill 的主说明书 | 一个 skill 至少要有这个文件。它通常包含元数据和正文说明。 |
| `name` | skill 的名字 | 越短越清楚越好，方便 agent 和人都能识别。 |
| `description` | skill 的使用说明和触发条件 | 它不是广告语，而是 agent 判断“这个任务要不要用这个 skill”的主要依据。 |
| `instructions` | 指令 | 也就是明确告诉 agent 应该怎么做、不要怎么做、先做什么、后做什么。 |
| `resources` | 辅助材料的统称 | 可以包括参考文档、模板、图片、示例、脚本等，不一定一开始全部读进上下文。 |
| `references/` | 参考资料目录 | 适合放长说明、术语表、背景资料、检查清单。 |
| `assets/` | 素材目录 | 适合放模板、示例输出、图片、固定文案等可以复用的材料。 |
| `scripts/` | 脚本目录 | 适合放可以直接执行的代码，比如抓取链接、格式转换、校验文件。 |
| `metadata` | 机器先读的摘要信息 | 常见形式是文件开头的 YAML 字段，例如 `name`、`description`。它帮助系统先发现 skill。 |
| `Output contract` | 输出约定 | 说明最终答案应该长什么样，例如必须有摘要、必须列来源、必须区分事实和推断。 |
| `Edge cases` | 容易出错的特殊情况 | 例如资料冲突、权限不足、输入不完整、脚本可能写文件等。提前写清楚可以减少误操作。 |

### 0.3 最容易误解的机制词

| 术语 | 详细解释 |
| --- | --- |
| `context window` / 上下文窗口 | 模型一次能“看见”的信息空间。用户请求、系统规则、读进来的文件、工具返回结果都会占用它。窗口不是无限的，所以不能把所有资料都一股脑塞进去。 |
| `token` | 模型处理文本时使用的基本单位。它不完全等于中文汉字或英文单词，可以粗略理解成“文字被模型切成的小片段”。上下文越长，token 越多，成本和干扰也越高。 |
| `progressive disclosure` | 渐进式披露，也就是按需加载。先只让 agent 看到 skill 的名字和描述；确定需要时再读 `SKILL.md`；正文真的用到某个资源时，再读外部文件或执行脚本。 |
| `prompt engineering` | 提示词工程。它不是神秘技巧，本质是把任务、约束、例子和输出格式写清楚，让模型更稳定地完成任务。skill 可以理解成把常用提示词工程固化成可维护文件。 |
| `fine-tuning` | 微调。它是用训练数据继续调整模型，让模型参数发生变化。写 skill 不会改模型参数，所以 skill 不是 fine-tuning。 |
| `model parameters` / 模型参数 | 模型内部的权重。它们决定模型如何理解和生成内容。普通用户写 prompt、写 skill、调用工具，都不会直接改这些参数。 |
| `reusable` / 可复用 | 不是只为当前一次对话服务，而是下次类似任务还能继续用。 |
| `shareable` / 可共享 | skill 可以作为文件夹分享给团队或其他环境使用，但前提是对方的 agent 或客户端支持对应规范和工具。 |
| `implementation extension` / 实现扩展 | 某些字段不是所有 skill 规范都强制支持，而是某个客户端自己扩展出来的能力。比如 `allowed-tools` 可能在某些 agent 里有用，但不能默认假设所有平台都认识它。 |

## 1. Skill 到底是什么

<figure class="fz028" data-reveal role="group" aria-label="Skill 到底是什么：Prompt、Tool/MCP、Skill、Agent 概念对比，以及 Skill 的发现层、规则层、资源层核心三层组成"><style>.fz028{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);--cyan:#3f6d79;--cyanb:#dcebed;--cyane:#8fbcc4;--amber:#9a6516;--amberb:#f4e8cc;--ambere:#d9b66a;--red:#8f2d20;--redb:#f1ddd6;--rede:#cf9b90;--purple:#54579a;--purpleb:#e6e7f3;--purplee:#a9adcf;--green:#4f7233;--greenb:#e7eedd;--greene:#7c9c54;box-sizing:border-box;margin:0;padding:clamp(16px,3vw,30px);background:linear-gradient(160deg,var(--paper-soft,#faf6ec),#f7f1e4 60%,var(--paper-deep,#ece5d5));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;font-family:var(--serif);color:var(--ink,#1a1815);max-width:980px}.fz028 *{box-sizing:border-box}.fz028 .hd{margin-bottom:clamp(16px,2.6vw,24px)}.fz028 .ttl{font-size:clamp(20px,3.4vw,30px);font-weight:700;letter-spacing:.5px;color:var(--ink,#1a1815)}.fz028 .sub{margin-top:7px;font-size:clamp(12px,1.9vw,15px);line-height:1.55;color:var(--muted,#6a6155)}.fz028 .row{display:flex;align-items:stretch;gap:clamp(6px,1.4vw,12px);flex-wrap:nowrap}.fz028 .node{flex:1 1 0;min-width:0;border-radius:14px;padding:clamp(11px,1.8vw,16px) clamp(8px,1.4vw,12px);text-align:center;border:1.5px solid var(--hair);background:#fffdf8;display:flex;flex-direction:column;justify-content:center;gap:6px;position:relative}.fz028 .node .nm{font-size:clamp(14px,2.2vw,19px);font-weight:700;color:var(--ink,#1a1815)}.fz028 .node .ds{font-size:clamp(10px,1.6vw,13px);color:var(--ink-soft,#3c362c);line-height:1.45}.fz028 .n-prompt{background:var(--purpleb);border-color:var(--purplee)}.fz028 .n-prompt .nm{color:var(--purple)}.fz028 .n-tool{background:var(--cyanb);border-color:var(--cyane)}.fz028 .n-tool .nm{color:var(--cyan)}.fz028 .n-agent{background:var(--greenb);border-color:var(--greene)}.fz028 .n-agent .nm{color:var(--green)}.fz028 .n-skill{flex:1.5 1 0;background:linear-gradient(155deg,#fbeecb,var(--amberb));border:2.5px solid var(--ambere);box-shadow:0 0 0 0 rgba(217,182,106,.55);animation:fz028pulse 8s ease-in-out infinite}.fz028 .n-skill .nm{color:var(--amber);font-size:clamp(16px,2.6vw,22px)}.fz028 .n-skill .code{font-family:var(--mono);font-size:clamp(9px,1.4vw,12px);color:var(--amber);background:rgba(154,101,22,.1);border-radius:6px;padding:3px 6px;margin-top:2px;letter-spacing:-.2px}.fz028 .arr{flex:0 0 auto;align-self:center;width:clamp(20px,3.4vw,40px);height:14px;position:relative;overflow:hidden}.fz028 .arr::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);height:2.5px;width:100%;background:linear-gradient(90deg,transparent,var(--muted) 40%,var(--muted));border-radius:2px}.fz028 .arr::after{content:"";position:absolute;right:1px;top:50%;width:0;height:0;transform:translateY(-50%);border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid var(--muted)}.fz028 .arr .flow{position:absolute;left:-30%;top:50%;transform:translateY(-50%);height:3px;width:30%;border-radius:3px;background:linear-gradient(90deg,transparent,var(--amber),transparent);animation:fz028flow 3.2s linear infinite}.fz028 .arr.a2 .flow{animation-delay:1.6s}.fz028 .panel{margin-top:clamp(16px,2.6vw,26px);border:1.5px solid var(--hair);border-radius:16px;background:#fffdf8;padding:clamp(14px,2.2vw,20px)}.fz028 .ph{text-align:center;font-size:clamp(15px,2.3vw,20px);font-weight:700;color:var(--ink,#1a1815);margin-bottom:clamp(12px,2vw,18px)}.fz028 .layers{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(8px,1.6vw,14px)}.fz028 .lay{border-radius:12px;padding:clamp(11px,1.8vw,16px) clamp(8px,1.4vw,12px);text-align:center;border:1.5px solid var(--hair);opacity:.55;transform:translateY(5px);animation:fz028layer 9s ease-in-out infinite}.fz028 .lay:nth-child(1){background:var(--amberb);border-color:var(--ambere);animation-delay:0s}.fz028 .lay:nth-child(2){background:var(--greenb);border-color:var(--greene);animation-delay:3s}.fz028 .lay:nth-child(3){background:var(--redb);border-color:var(--rede);animation-delay:6s}.fz028 .lay .lt{font-size:clamp(13px,2vw,17px);font-weight:700}.fz028 .lay:nth-child(1) .lt{color:var(--amber)}.fz028 .lay:nth-child(2) .lt{color:var(--green)}.fz028 .lay:nth-child(3) .lt{color:var(--red)}.fz028 .lay .lc{margin-top:6px;font-family:var(--mono);font-size:clamp(9px,1.4vw,12px);color:var(--ink-soft,#3c362c);letter-spacing:-.2px;line-height:1.4}@keyframes fz028pulse{0%,100%{box-shadow:0 0 0 0 rgba(217,182,106,0);transform:translateY(0)}50%{box-shadow:0 0 0 7px rgba(217,182,106,.28);transform:translateY(-2px)}}@keyframes fz028flow{0%{left:-30%}100%{left:100%}}@keyframes fz028layer{0%,18%{opacity:.5;transform:translateY(5px)}33%,55%{opacity:1;transform:translateY(0)}75%,100%{opacity:.5;transform:translateY(5px)}}@keyframes fz028layerm{0%,18%{opacity:.5}33%,55%{opacity:1}75%,100%{opacity:.5}}@media(max-width:560px){.fz028 .row{flex-wrap:wrap;justify-content:center}.fz028 .node,.fz028 .n-skill{flex:1 1 40%}.fz028 .arr{display:none}.fz028 .layers{grid-template-columns:1fr}.fz028 .lay{transform:none;animation:fz028layerm 9s ease-in-out infinite}}@media(prefers-reduced-motion:reduce){.fz028 .n-skill{animation:none;box-shadow:0 0 0 4px rgba(217,182,106,.28)}.fz028 .arr .flow{animation:none;opacity:0}.fz028 .lay{animation:none;opacity:1;transform:none}}</style><div class="hd"><div class="ttl">Skill 到底是什么</div><div class="sub">它不是"模型升级包"，而是一份可被 agent 发现、加载、执行的工作流说明</div></div><div class="row"><div class="node n-prompt"><div class="nm">Prompt</div><div class="ds">一次性请求</div></div><div class="node n-tool"><div class="nm">Tool / MCP</div><div class="ds">能力入口与连接方式</div></div><div class="arr a1"><span class="flow"></span></div><div class="node n-skill"><div class="nm">Skill</div><div class="ds">可复用 workflow</div><div class="code">name + description + SKILL.md</div></div><div class="arr a2"><span class="flow"></span></div><div class="node n-agent"><div class="nm">Agent</div><div class="ds">执行者</div></div></div><div class="panel"><div class="ph">Skill 的核心组成</div><div class="layers"><div class="lay"><div class="lt">发现层</div><div class="lc">name / description</div></div><div class="lay"><div class="lt">规则层</div><div class="lc">SKILL.md 正文</div></div><div class="lay"><div class="lt">资源层</div><div class="lc">scripts / references / assets</div></div></div></div></figure>

如果只用一句话概括：

**Skill 是把“这件事应该怎么做”封装成一个可复用工作流的格式。**

这里的“封装”，不是把能力写进模型内部，而是把稳定的做事方法整理成文件：什么时候使用、按什么顺序做、输出什么格式、哪些地方不能乱来、需要哪些参考资料和脚本。agent 读到这些规则后，就能把一次性的经验变成下次还能重复执行的流程。

它通常包含三层东西：

1. `name` 和 `description`
   这是 skill 的门牌和简介。agent 通常会先看这些短信息，判断当前任务是否匹配。
2. `SKILL.md` 正文
   这是真正的执行说明。它要讲清楚这件事具体怎么做、顺序是什么、输出长什么样、哪些坑要避开。
3. 可选资源
   比如 `scripts/`、`references/`、`assets/`。它们分别承载可执行代码、详细参考文档和模板素材，只有任务需要时才继续读取或执行。

把它和几个经常混淆的概念分开，会更容易理解：

- `prompt`
  一次性请求。它解决的是“我这次想让模型做什么”。比如你现在写一句“帮我把这篇文章改得更好懂”，这就是 prompt。
- `tool` 或 `MCP`
  能力入口。`tool` 是具体可调用动作，比如读文件、运行命令、查网页；`MCP` 是把这类工具接给 agent 的协议。它们解决的是“agent 可以连接什么、调用什么”。
- `skill`
  执行手册。它不一定提供新动作，而是告诉 agent “遇到这类任务时应该按什么方法做”。
- `agent`
  执行者。它负责把用户目标、上下文、工具和 skill 组合起来，决定先读什么、再调用什么、最后怎么交付结果。

从这个角度看，`skill` 更像：

- 团队知识的打包件
- 重复流程的标准化载体
- prompt engineering 的可维护版本

最后一句很关键：它不是 fine-tuning，也不是模型参数更新，更不是单纯的工具列表。fine-tuning 会改变模型内部权重；工具列表只说明“能调用什么”；skill 则说明“为了完成某类任务，应该怎么组织这些能力”。

## 2. 一个 Skill 是怎么工作的

<figure class="fz029" data-reveal role="group" aria-label="Skill 工作机制图：progressive disclosure 四步渐进式披露，从发现、激活、补充到完成任务，并说明这种设计为何重要"><style>.fz029{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);box-sizing:border-box;margin:0;padding:clamp(16px,3.4vw,30px);background:radial-gradient(120% 140% at 12% 0%,var(--paper-soft,#faf6ec),var(--paper-deep,#ece5d5));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;color:var(--ink,#1a1815);font-family:var(--serif);line-height:1.5}.fz029 *{box-sizing:border-box}.fz029 .hd{margin-bottom:clamp(16px,2.6vw,24px)}.fz029 .ttl{font-size:clamp(19px,3.4vw,27px);font-weight:700;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz029 .sub{margin-top:7px;font-size:clamp(12px,1.9vw,14.5px);color:var(--muted,#6a6155);line-height:1.6}.fz029 .sub code{font-family:var(--mono);font-size:.92em;color:var(--ink-soft,#3c362c);background:rgba(26,24,21,.05);padding:.05em .34em;border-radius:4px}.fz029 .flow{display:grid;grid-template-columns:repeat(4,1fr);gap:0;align-items:stretch}.fz029 .step{position:relative;display:flex;flex-direction:column;padding:clamp(13px,1.6vw,18px) clamp(11px,1.4vw,16px);border:1.5px solid;border-radius:16px;background:var(--bd);border-color:var(--bc);opacity:0;transform:translateY(8px);animation:fz029-pop 9s ease-in-out infinite}.fz029 .step:nth-child(1){--bd:#e8f0fe;--bc:#8bb3ff;--ac:#3f6d79;animation-delay:0s}.fz029 .step:nth-child(3){--bd:var(--paper,#f4e8cc);--bc:#d9b66a;--ac:#9a6516;animation-delay:1.5s;background:#f4e8cc}.fz029 .step:nth-child(5){--bd:#e7eedd;--bc:#7c9c54;--ac:#4f7233;animation-delay:3s}.fz029 .step:nth-child(7){--bd:#e6e7f3;--bc:#a9adcf;--ac:#54579a;animation-delay:4.5s}.fz029 .num{font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--ac);opacity:.85}.fz029 .sh{margin:5px 0 9px;font-size:clamp(14px,2.1vw,17px);font-weight:700;color:var(--ink,#1a1815)}.fz029 .sd{font-size:clamp(11.5px,1.7vw,13.5px);color:var(--ink-soft,#3c362c);line-height:1.55}.fz029 .sd code{font-family:var(--mono);font-size:.9em;color:var(--ac);font-weight:600;word-break:break-word}.fz029 .lk{display:flex;align-items:center;justify-content:center;padding:0 1px;align-self:center}.fz029 .arr{position:relative;width:100%;min-width:14px;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--hair,rgba(26,24,21,.18)),var(--hair,rgba(26,24,21,.18)));overflow:visible}.fz029 .arr::before{content:"";position:absolute;left:-30%;top:0;width:30%;height:100%;border-radius:2px;background:linear-gradient(90deg,transparent,#917f5c,transparent);animation:fz029-flow 4.5s ease-in-out infinite}.fz029 .lk:nth-child(2) .arr::before{animation-delay:0s}.fz029 .lk:nth-child(4) .arr::before{animation-delay:1.5s}.fz029 .lk:nth-child(6) .arr::before{animation-delay:3s}.fz029 .arr::after{content:"";position:absolute;right:-1px;top:50%;transform:translateY(-50%);border-left:7px solid var(--muted,#6a6155);border-top:5px solid transparent;border-bottom:5px solid transparent}.fz029 .why{margin-top:clamp(18px,2.8vw,26px);padding:clamp(14px,2vw,20px);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:16px;background:rgba(247,241,228,.55)}.fz029 .wh{text-align:center;font-size:clamp(14px,2.1vw,17px);font-weight:700;margin-bottom:clamp(11px,1.6vw,15px);color:var(--ink,#1a1815)}.fz029 .pills{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(8px,1.4vw,13px)}.fz029 .pill{text-align:center;padding:clamp(9px,1.5vw,13px) 8px;border-radius:12px;font-size:clamp(11.5px,1.8vw,14px);font-weight:600;border:1px solid;opacity:0;transform:scale(.96);animation:fz029-rise 9s ease-in-out infinite}.fz029 .pill code{font-family:var(--mono);font-size:.9em;font-weight:700}.fz029 .pill:nth-child(1){background:#e6e7f3;border-color:#a9adcf;color:#54579a;animation-delay:5.4s}.fz029 .pill:nth-child(2){background:#dcebed;border-color:#8fbcc4;color:#3f6d79;animation-delay:5.9s}.fz029 .pill:nth-child(3){background:#f4e8cc;border-color:#d9b66a;color:#9a6516;animation-delay:6.4s}.fz029 .concl{margin-top:clamp(13px,2vw,18px);text-align:center;font-size:clamp(11.5px,1.8vw,13.5px);color:var(--muted,#6a6155);line-height:1.6}.fz029 .concl b{color:var(--ink-soft,#3c362c);font-weight:700}@keyframes fz029-pop{0%{opacity:0;transform:translateY(8px)}14%,100%{opacity:1;transform:translateY(0)}}@keyframes fz029-rise{0%{opacity:0;transform:scale(.96)}10%,100%{opacity:1;transform:scale(1)}}@keyframes fz029-flow{0%{left:-30%}55%,100%{left:100%}}@media(max-width:560px){.fz029 .flow{grid-template-columns:1fr}.fz029 .lk{padding:5px 0}.fz029 .arr{width:3px;height:18px;margin:0 auto}.fz029 .arr::before{left:0;top:-30%;width:100%;height:30%;background:linear-gradient(180deg,transparent,#917f5c,transparent);animation:fz029-flowv 4.5s ease-in-out infinite}.fz029 .lk:nth-child(2) .arr::before{animation-delay:0s}.fz029 .lk:nth-child(4) .arr::before{animation-delay:1.5s}.fz029 .lk:nth-child(6) .arr::before{animation-delay:3s}.fz029 .arr::after{right:50%;top:auto;bottom:-1px;transform:translateX(50%);border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid var(--muted,#6a6155);border-bottom:0}.fz029 .pills{grid-template-columns:1fr}}@keyframes fz029-flowv{0%{top:-30%}55%,100%{top:100%}}@media (prefers-reduced-motion:reduce){.fz029 .step,.fz029 .pill{animation:none;opacity:1;transform:none}.fz029 .arr::before{animation:none;display:none}}</style><div class="hd"><div class="ttl">Skill 是怎么工作的</div><div class="sub">核心机制不是“全量注入”，而是 <code>progressive disclosure</code>：先发现，再加载，再按需读取资源</div></div><div class="flow"><div class="step"><span class="num">STEP 1</span><span class="sh">发现</span><span class="sd">启动时只看 <code>name</code> / <code>description</code></span></div><div class="lk"><span class="arr"></span></div><div class="step"><span class="num">STEP 2</span><span class="sh">激活</span><span class="sd">任务匹配后读取完整 <code>SKILL.md</code></span></div><div class="lk"><span class="arr"></span></div><div class="step"><span class="num">STEP 3</span><span class="sh">补充</span><span class="sd">按需读取 <code>references</code> / <code>assets</code> 或执行 <code>scripts</code></span></div><div class="lk"><span class="arr"></span></div><div class="step"><span class="num">STEP 4</span><span class="sh">完成任务</span><span class="sd">把说明、资源和工具组合成执行结果</span></div></div><div class="why"><div class="wh">为什么这种设计重要</div><div class="pills"><div class="pill">减少上下文拥堵</div><div class="pill">降低 <code>token</code> 成本</div><div class="pill">把 skill 做成可组合积木</div></div></div><div class="concl"><b>结论：</b>好的 skill 不是塞更多信息，而是把信息放到 agent 真正需要的时候再交给它</div></figure>

Agent Skills 规范和 Microsoft Learn 都强调同一个核心机制：`progressive disclosure`，也就是按需加载。

这个词直译是“渐进式披露”。放在 skill 里，它的意思是：不要一上来就把所有说明、所有模板、所有参考资料都塞给模型，而是先给最小必要信息；确认任务需要之后，再逐层打开更多细节。

典型过程通常是这样的：

1. 启动时，agent 只预加载每个 skill 的 `name` 和 `description`
2. 当用户任务和某个 skill 的描述匹配时，agent 再读取完整的 `SKILL.md`
3. 只有在正文提到某个参考文档、模板或脚本时，agent 才继续按需读取 `references/`、`assets/` 或执行 `scripts/`

这个设计很重要，因为上下文窗口是共享资源。

上下文窗口可以理解成 agent 当前能带进模型里的工作台。用户原始问题、系统规则、已经读过的文件、工具返回结果、skill 正文，都会挤在这个工作台上。token 则是这些内容被模型处理时的计量单位。工作台越满，成本越高，干扰也越多。

如果把所有细节、所有模板、所有脚本说明一开始都塞进提示词，问题会马上出现：

- token 成本会快速升高
- 真实用户请求会被淹没
- agent 反而更不容易选对信息

所以，好的 skill 不是“资料越多越好”，而是“需要的时候才暴露足够的信息”。

这也解释了为什么官方资料普遍建议把 skill 做成小而明确的构件：

- 一个 skill 负责一个清晰场景
- 多阶段任务可以组合多个 skill
- 不要做一个什么都想管的巨型 `万能 skill`

我的归纳是：

**Skill 的运行逻辑，本质上是一种面向 agent 的分层上下文治理。**

它先靠描述完成发现，再靠正文完成执行，再靠资源完成细节补充。

## 3. 怎么写一个好的 Skill

<figure class="fz030" data-reveal role="group" aria-label="一个好 Skill 的结构：发现层、规则层、资源层、验证层四层，及对应的四个判断问题"><style>.fz030{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--gn:#4f7233;--gnb:#e7eedd;--gnl:#7c9c54;--bl:#3a5f93;--blb:#dde6f1;--ble:#94aed1;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--pp:#54579a;--ppb:#e6e7f3;--ppe:#a9adcf;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(160deg,var(--paper-soft),var(--soft));border:1px solid var(--hair);border-radius:18px;padding:clamp(18px,3.4vw,32px);margin:0;max-width:920px;box-sizing:border-box}.fz030 *{box-sizing:border-box}.fz030 .hd{margin-bottom:1.3em}.fz030 .ttl{font-size:clamp(1.25rem,3.4vw,1.7rem);font-weight:700;letter-spacing:.01em;color:var(--ink)}.fz030 .sub{font-size:clamp(.78rem,1.9vw,.94rem);color:var(--muted);margin-top:.5em;line-height:1.55}.fz030 .panel{border:1px solid var(--hair);border-radius:14px;background:rgba(255,253,250,.55);padding:clamp(12px,2.4vw,20px)}.fz030 .layers{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,1.6vw,14px)}.fz030 .lay{position:relative;border-radius:12px;padding:clamp(10px,1.8vw,16px) clamp(8px,1.4vw,12px);text-align:center;border:1.5px solid;opacity:0;transform:translateY(10px);animation:fzin .7s ease forwards}.fz030 .lay:nth-child(1){animation-delay:.15s}.fz030 .lay:nth-child(2){animation-delay:.5s}.fz030 .lay:nth-child(3){animation-delay:.85s}.fz030 .lay:nth-child(4){animation-delay:1.2s}.fz030 .l1{background:var(--blb);border-color:var(--ble)}.fz030 .l1 .lh{color:var(--bl)}.fz030 .l2{background:var(--amb);border-color:var(--ame)}.fz030 .l2 .lh{color:var(--am)}.fz030 .l3{background:var(--gnb);border-color:var(--gnl)}.fz030 .l3 .lh{color:var(--gn)}.fz030 .l4{background:var(--ppb);border-color:var(--ppe)}.fz030 .l4 .lh{color:var(--pp)}.fz030 .lh{font-size:clamp(.92rem,2.2vw,1.12rem);font-weight:700;margin-bottom:.5em}.fz030 .li{font-size:clamp(.7rem,1.7vw,.85rem);color:var(--ink-soft);line-height:1.7}.fz030 .li b{font-weight:600;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:.92em}.fz030 .conn{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,1.6vw,14px);margin:clamp(10px,1.8vw,16px) 0}.fz030 .wire{height:30px;position:relative;display:flex;justify-content:center}.fz030 .wire::before{content:"";width:2px;height:100%;background:var(--hair)}.fz030 .wire::after{content:"";position:absolute;top:0;left:calc(50% - 1px);width:2px;height:40%;border-radius:2px;animation:fzflow 6s ease-in-out infinite}.fz030 .w1::after{background:var(--bl);animation-delay:0s}.fz030 .w2::after{background:var(--am);animation-delay:.5s}.fz030 .w3::after{background:var(--gn);animation-delay:1s}.fz030 .w4::after{background:var(--pp);animation-delay:1.5s}.fz030 .qgrp{border:1px solid var(--hair);border-radius:14px;background:var(--paper-deep);padding:clamp(12px,2.4vw,18px) clamp(10px,2vw,16px);margin-top:clamp(4px,1vw,8px)}.fz030 .qhd{text-align:center;font-size:clamp(.95rem,2.3vw,1.15rem);font-weight:700;color:var(--ink);margin-bottom:clamp(10px,1.8vw,16px)}.fz030 .qs{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,1.6vw,14px)}.fz030 .q{border-radius:11px;padding:clamp(12px,2vw,18px) clamp(6px,1.2vw,10px);text-align:center;font-size:clamp(.74rem,1.8vw,.9rem);line-height:1.55;color:var(--ink-soft);border:1px solid var(--hair);background:#fffdf9;position:relative;animation:fzpulse 8s ease-in-out infinite}.fz030 .q b{display:block;font-weight:700;color:var(--ink)}.fz030 .q1{background:var(--blb);animation-delay:0s}.fz030 .q2{background:var(--amb);animation-delay:2s}.fz030 .q3{background:var(--gnb);animation-delay:4s}.fz030 .q4{background:var(--ppb);animation-delay:6s}@keyframes fzin{to{opacity:1;transform:translateY(0)}}@keyframes fzflow{0%,15%{top:-40%;opacity:0}25%{opacity:1}55%{top:100%;opacity:1}65%,100%{top:100%;opacity:0}}@keyframes fzpulse{0%,100%{box-shadow:0 0 0 0 rgba(26,24,21,0)}45%{box-shadow:0 1px 10px rgba(26,24,21,.1)}}@media (max-width:560px){.fz030 .layers,.fz030 .conn,.fz030 .qs{grid-template-columns:repeat(2,1fr)}.fz030 .wire{height:18px}}@media (prefers-reduced-motion:reduce){.fz030 .lay{animation:none;opacity:1;transform:none}.fz030 .wire::after{animation:none;height:100%;opacity:.7}.fz030 .q{animation:none}}</style><div class="hd"><div class="ttl">一个好 Skill 的结构</div><div class="sub">发现、规则、资源、验证，四层都要清楚，skill 才能既好命中，也好执行</div></div><div class="panel"><div class="layers"><div class="lay l1"><div class="lh">发现层</div><div class="li">好 <b>name</b><br>好 <b>description</b></div></div><div class="lay l2"><div class="lh">规则层</div><div class="li"><b>Workflow</b><br><b>Output contract</b></div></div><div class="lay l3"><div class="lh">资源层</div><div class="li"><b>references / assets</b><br><b>scripts</b></div></div><div class="lay l4"><div class="lh">验证层</div><div class="li">真实任务测试<br>失败回写</div></div></div><div class="conn"><div class="wire w1"></div><div class="wire w2"></div><div class="wire w3"></div><div class="wire w4"></div></div><div class="qgrp"><div class="qhd">四个判断问题</div><div class="qs"><div class="q q1"><b>Agent 能否</b>发现它</div><div class="q q2"><b>Agent 能否</b>按顺序执行</div><div class="q q3"><b>上下文成本</b>是否合理</div><div class="q q4"><b>真实任务里</b>是否稳定</div></div></div></div></figure>

这一部分最重要。

从 OpenAI Academy、Anthropic 最佳实践和 Agent Skills 规范综合来看，一个好的 skill 至少要同时满足四个标准：

- 它容易被发现
- 它指令足够清楚
- 它上下文成本不过载
- 它在真实任务里稳定可用

### 3.1 先把 `description` 写对

`description` 不是宣传语，而是发现机制的一部分。

这里的“发现机制”，指的是 agent 在很多个 skill 之间做选择的过程。它不可能一开始就把所有 `SKILL.md` 全部读完，所以通常会先看每个 skill 的 `name` 和 `description`。如果描述太泛，agent 就很难判断该不该用它。

Agent 通常先看到的不是正文，而是这个字段。所以这里要同时写清两件事：

- 这个 skill 能做什么
- 什么情况下应该使用它

一个好描述通常会同时包含：

- 任务对象
  也就是处理什么东西，比如官方文档、会议纪要、图片、源码仓库、表格文件。
- 动作
  也就是要做什么，比如总结、翻译、生成、检查、转换、发布。
- 触发条件
  也就是用户怎样提问时应该使用它，比如“当用户要求整理 release note 时使用”。
- 关键术语
  也就是用户或团队常用的关键词，比如 `changelog`、`source-linked briefing`、`design token`。

比如下面这种写法就更有效：

```yaml
description: Summarize official documentation, release notes, and standards into structured Chinese notes. Use when the user asks for product doc summaries, comparisons, changelog interpretation, or source-linked briefings.
```

这句话其实分成两半：

- `Summarize official documentation...`
  说明这个 skill 做什么：把官方文档、发布说明、标准页面总结成中文结构化笔记。
- `Use when the user asks...`
  说明什么时候用：当用户要产品文档摘要、对比、更新日志解释、带来源的简报时使用。

它比下面这种模糊写法更好：

```yaml
description: Help with documents.
```

Anthropic 的最佳实践还特别强调两点：

- 用第三人称写
- 具体，且包含关键触发词

第三人称写法的意思是，不要写成“我可以帮你处理文档”，而要写成“Summarize official documentation...”。这样更像一个系统可读取的能力说明。具体触发词则能提高命中率，因为 agent 不是在“读广告文案”，而是在“做选择”。

### 3.2 正文只写模型本来不知道、但任务又必须知道的内容

Anthropic 的建议里有一句很值得记住的原则：**默认假设模型已经很聪明。**

所以在 `SKILL.md` 正文里，不要重复一堆常识，而要聚焦这几类高价值信息：

- 你团队自己的流程
- 输出格式要求
- 顺序不能乱的步骤
- 易错点和禁止项
- 关键示例

这类内容最值得写进去，因为它们不是通用世界知识，而是任务成功率真正依赖的局部知识。

一个实用的正文结构可以是：

1. `When to use this skill`
2. `Output contract`
3. `Workflow`
4. `Edge cases`
5. `Resources`
6. `Scripts`

这些标题可以这样理解：

- `When to use this skill`
  写清楚适用场景和不适用场景，避免 skill 被误用。
- `Output contract`
  写清楚最终交付物的格式、字段、顺序和必须包含的信息。
- `Workflow`
  写清楚执行步骤，尤其是哪些步骤必须先做、哪些步骤可以按需做。
- `Edge cases`
  写清楚特殊情况，例如信息不足、权限失败、来源冲突、文件不存在时怎么办。
- `Resources`
  写清楚哪些外部材料可以按需读取，以及什么时候读取。
- `Scripts`
  写清楚有哪些脚本可以执行、参数怎么传、脚本会不会写文件或产生副作用。

如果某件事非常脆弱、顺序必须严格、参数不能乱改，那就要明确写死，而不要让模型自由发挥。

### 3.3 把资源拆到合适的目录里

规范给出的基础目录结构很简单：

```text
my-skill/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```

它们适合承载不同类型的信息：

- `SKILL.md`
  放短而关键的规则
- `references/`
  放详细说明、术语表、流程细节。它适合“有用但不一定每次都要读”的长内容。
- `assets/`
  放模板、样板文本、示例输出。它适合“拿来复用”的固定材料。
- `scripts/`
  放真正需要执行的代码。它适合“让程序确定性完成”的事情，比如格式转换、批量校验、抓取固定来源。

Agent Skills 规范和 Microsoft Learn 都建议资源按需读取，脚本则只在需要时执行。

这意味着你应该把 skill 写成：

- 主体短
  `SKILL.md` 只保留决策和执行所需的核心规则。
- 辅助材料外置
  长背景、长模板、长示例放到外部目录，不要一开始就占满上下文。
- 路径清楚
  正文里写明文件路径，让 agent 能准确找到资源。
- 依赖明确
  脚本需要什么运行环境、会读写哪些文件、失败时怎样处理，都要说清楚。

如果正文已经长到像半篇白皮书，通常说明你还没有把信息分层。

### 3.4 一个好 skill 的检查清单

在真正发布之前，我建议至少过一遍下面这张清单：

- `name` 是否短、清楚、可搜索
- `description` 是否同时说明“做什么”和“什么时候用”
- 正文是否只保留高价值指令，而不是堆基础知识
- 步骤顺序是否明确
- 输出格式是否清楚
- 关键失败场景是否说明
- 脚本行为是否与正文承诺一致
- 参考材料是否按需拆分到了外部目录
- 是否至少用真实任务测过几次

## 4. 一个可直接复用的 Skill 模板

<figure class="fz031" data-reveal role="group" aria-label="一个可复用的 Skill 模板：左侧目录结构映射到右侧 SKILL.md、references/assets、scripts 三类职责"><style>.fz031{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);line-height:1.5;box-sizing:border-box}.fz031 *{box-sizing:border-box}.fz031 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz031 .ttl{font-size:clamp(18px,2.6vw,24px);font-weight:700;letter-spacing:.01em;margin:0 0 .4em}.fz031 .sub{font-size:clamp(12px,1.6vw,14.5px);color:var(--muted,#6a6155);margin:0;max-width:60ch}.fz031 .grid{display:grid;grid-template-columns:minmax(0,1.02fr) auto minmax(0,.98fr);gap:clamp(10px,2vw,22px);align-items:stretch}.fz031 .tree{background:#1f1d18;border:1px solid #322e26;border-radius:16px;padding:clamp(14px,2.2vw,22px);font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(11px,1.5vw,14px);line-height:1.95;color:#e9e2d2;overflow:hidden}.fz031 .root{color:#d9cdb0;font-weight:600;margin-bottom:.5em;display:block}.fz031 .row{display:block;white-space:nowrap;position:relative;opacity:.22;animation:fzln 9s ease-in-out infinite}.fz031 .row .k{opacity:.5}.fz031 .row b{font-weight:600}.fz031 .leaf{padding-left:1.7em;font-size:.92em}.fz031 .r1{animation-delay:0s}.fz031 .r1l{animation-delay:.5s}.fz031 .r2{animation-delay:1.4s}.fz031 .r2l{animation-delay:1.9s}.fz031 .r3{animation-delay:2.8s}.fz031 .r3l{animation-delay:3.3s}.fz031 .c-skill{color:#9fc0d6}.fz031 .c-ref{color:#e3c98c}.fz031 .c-asset{color:#9cc77f}.fz031 .c-scr{color:#b6a4dd}.fz031 .leaf .lf{color:#f3ecdd}.fz031 .conn{display:flex;flex-direction:column;justify-content:space-around;align-items:center;min-width:34px;padding:18px 0}.fz031 .wire{position:relative;width:30px;height:3px;border-radius:3px;background:var(--hair,rgba(26,24,21,.18));overflow:hidden}.fz031 .wire::after{content:"";position:absolute;inset:0;border-radius:3px;background:linear-gradient(90deg,transparent,currentColor,transparent);background-size:220% 100%;animation:fzflow 7s linear infinite}.fz031 .wire::before{content:"";position:absolute;right:-2px;top:50%;transform:translateY(-50%);border:5px solid transparent;border-left-color:currentColor;opacity:.85}.fz031 .w1{color:#3f6d79}.fz031 .w2{color:#9a6516}.fz031 .w3{color:#4f7233}.fz031 .w2::after{animation-delay:.9s}.fz031 .w3::after{animation-delay:1.8s}.fz031 .roles{display:flex;flex-direction:column;gap:clamp(10px,1.8vw,16px)}.fz031 .card{border-radius:14px;padding:clamp(12px,2vw,18px) clamp(13px,2.2vw,20px);border:1px solid;position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;animation:fzcard 9s ease-in-out infinite}.fz031 .card .ch{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-weight:700;font-size:clamp(13px,1.9vw,17px);margin:0 0 .35em;letter-spacing:.01em}.fz031 .card .ct{font-size:clamp(11.5px,1.6vw,14px);color:var(--ink-soft,#3c362c);margin:0}.fz031 .card::before{content:"";position:absolute;left:0;top:14%;bottom:14%;width:4px;border-radius:4px}.fz031 .k-skill{background:var(--cyan-bg,#dcebed);border-color:var(--cyan-bd,#8fbcc4);animation-delay:.2s}.fz031 .k-skill::before{background:#3f6d79}.fz031 .k-skill .ch{color:#2c5862}.fz031 .k-ref{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-bd,#d9b66a);animation-delay:1.5s}.fz031 .k-ref::before{background:#9a6516}.fz031 .k-ref .ch{color:#7a4f12}.fz031 .k-scr{background:var(--green-bg,#e7eedd);border-color:var(--green-lt,#7c9c54);animation-delay:2.8s}.fz031 .k-scr::before{background:#4f7233}.fz031 .k-scr .ch{color:#3c5826}@keyframes fzln{0%,12%{opacity:.22}26%,72%{opacity:1}90%,100%{opacity:.22}}@keyframes fzflow{0%{background-position:120% 0}100%{background-position:-120% 0}}@keyframes fzcard{0%,12%{transform:translateY(2px);box-shadow:0 0 0 rgba(0,0,0,0)}30%,70%{transform:translateY(0);box-shadow:0 2px 10px rgba(26,24,21,.07)}90%,100%{transform:translateY(2px);box-shadow:0 0 0 rgba(0,0,0,0)}}@media (max-width:560px){.fz031 .grid{grid-template-columns:1fr}.fz031 .conn{flex-direction:row;min-width:0;width:100%;padding:4px 0;gap:14px}.fz031 .wire{width:auto;flex:1;height:3px}.fz031 .wire::before{right:50%;top:auto;bottom:-7px;transform:translateX(50%) rotate(90deg)}}@media (prefers-reduced-motion:reduce){.fz031 .row,.fz031 .card{animation:none;opacity:1;transform:none;box-shadow:0 1px 6px rgba(26,24,21,.06)}.fz031 .wire::after{animation:none;background:currentColor;opacity:.6}}</style><div class="hd"><p class="ttl">一个可复用的 Skill 模板</p><p class="sub">把元数据、正文、外部资源和脚本放在最适合它们的位置，而不是全部塞进一个大文件。</p></div><div class="grid"><div class="tree" aria-label="目录结构"><span class="root">summarizing-official-docs/</span><span class="row r1"><span class="k">├──</span> <b class="c-skill">SKILL.md</b></span><span class="row r2"><span class="k">├──</span> <b class="c-ref">references/</b></span><span class="row r2l leaf"><span class="k">└──</span> <span class="lf">source-checklist.md</span></span><span class="row r2"><span class="k">├──</span> <b class="c-asset">assets/</b></span><span class="row r2l leaf"><span class="k">└──</span> <span class="lf">output-template.md</span></span><span class="row r3"><span class="k">└──</span> <b class="c-scr">scripts/</b></span><span class="row r3l leaf"><span class="k">└──</span> <span class="lf">collect-links.sh</span></span></div><div class="conn" aria-hidden="true"><span class="wire w1"></span><span class="wire w2"></span><span class="wire w3"></span></div><div class="roles"><div class="card k-skill"><p class="ch">SKILL.md</p><p class="ct">最短路径的规则与输出约定</p></div><div class="card k-ref"><p class="ch">references / assets</p><p class="ct">详细知识与模板外置，按需读取</p></div><div class="card k-scr"><p class="ch">scripts</p><p class="ct">只有在确实需要执行动作时才调用</p></div></div></div></figure>

如果你想从零开始写一个 skill，下面这个最小模板基本够用。

目录结构：

```text
summarizing-official-docs/
├── SKILL.md
├── references/
│   └── source-checklist.md
├── assets/
│   └── output-template.md
└── scripts/
    └── collect-links.sh
```

`SKILL.md` 示例：

```md
---
name: summarizing-official-docs
description: Summarize official documentation, release notes, and standards into structured Chinese notes. Use when the user asks for product doc summaries, release-note interpretation, standards comparison, or source-linked briefings.
---

# Summarizing Official Docs

## When to use this skill
Use this skill when the task requires reading official product documentation,
release notes, standards pages, or help-center articles and turning them into
clear Chinese summaries with source links.

## Output contract
- Start with a short executive summary.
- Keep exact product names and exact dates.
- Separate source-backed facts from inference.
- End with a flat source list.

## Workflow
1. Prefer official documentation and standards pages.
2. If multiple official pages exist, prioritize the newest one.
3. Extract definitions, scope, limitations, and dates.
4. Summarize in Chinese for fast reading.
5. Mark any synthesis or inference explicitly.

## Edge cases
- If official sources conflict, surface the conflict instead of guessing.
- If information is outdated or incomplete, say so clearly.

## Resources
- Read [source-checklist](references/source-checklist.md) before finalizing.
- Use [output-template](assets/output-template.md) when the user wants a full article.

## Scripts
When collecting links from a known list, run:
scripts/collect-links.sh
```

这个模板的重点不是格式本身，而是它体现了一个好的 skill 写法：

- 元数据负责发现
  也就是 `name` 和 `description` 先帮助 agent 判断“该不该打开这个 skill”。
- 正文负责规则
  也就是 `SKILL.md` 的主体告诉 agent “打开之后应该怎么做”。
- 外部资源负责细节
  也就是 `references/` 和 `assets/` 承担长资料、模板、示例，不让正文变得过重。
- 脚本负责执行
  也就是 `scripts/` 把稳定、可自动化的步骤交给程序，而不是让模型每次手工猜。

如果你的 skill 还需要限制工具范围，可以在你的具体 agent 实现支持的前提下，再加入类似 `allowed-tools` 之类的扩展字段。这里要注意：**这类字段通常属于实现扩展，不一定是所有客户端都通用的核心标准。**

所谓“核心标准”，可以理解成大家都约定要认识的基础格式；所谓“实现扩展”，则是某个具体客户端额外支持的能力。写 skill 时最好把两者分开：通用规则写在正文里，只有当前环境明确支持的字段，才作为扩展字段使用。

## 5. 常见错误与迭代方法

<figure class="fz032" data-reveal role="group" aria-label="Skill 的迭代闭环：写初稿、试运行、记录失败、回写优化四步顺时针循环，围绕中心的真实任务持续迭代"><style>.fz032{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--r:#8f2d20;--rb:#f1ddd6;--re:#cf9b90;--p:#54579a;--pb:#e6e7f3;--pe:#a9adcf;margin:0;padding:clamp(16px,3vw,30px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:18px;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-sizing:border-box;overflow:hidden}.fz032 *{box-sizing:border-box}.fz032 .hd{margin-bottom:clamp(14px,2.4vw,24px)}.fz032 .ti{font-size:clamp(19px,3.1vw,28px);font-weight:700;letter-spacing:.5px;color:var(--ink,#1a1815)}.fz032 .sub{margin-top:7px;font-size:clamp(12px,1.7vw,15px);line-height:1.6;color:var(--muted,#6a6155)}.fz032 .stage{position:relative;width:100%;max-width:660px;margin:0 auto;aspect-ratio:1/.86}.fz032 .ring{position:absolute;left:50%;top:50%;width:46%;aspect-ratio:1/1;transform:translate(-50%,-50%);border-radius:50%;border:2px dashed var(--ae,#d9b66a);opacity:.5;animation:fz-spin 18s linear infinite}.fz032 .core{position:absolute;left:50%;top:50%;width:30%;aspect-ratio:1/1;transform:translate(-50%,-50%);border-radius:50%;background:var(--ab,#f4e8cc);border:3px solid var(--ae,#d9b66a);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 4px 16px rgba(154,101,22,.18);animation:fz-pulse 7s ease-in-out infinite}.fz032 .core b{font-size:clamp(14px,2.4vw,20px);font-weight:700;color:var(--a,#9a6516)}.fz032 .core small{margin-top:4px;font-size:clamp(10px,1.5vw,13px);color:var(--ink-soft,#3c362c)}.fz032 .node{position:absolute;width:33%;min-width:118px;padding:clamp(9px,1.6vw,15px) clamp(8px,1.4vw,14px);border-radius:14px;text-align:center;border:2px solid var(--hair);background:var(--paper-deep,#ece5d5);box-shadow:0 3px 10px rgba(26,24,21,.07);animation:fz-rise 6.5s ease-in-out infinite}.fz032 .node b{display:block;font-size:clamp(13px,2vw,17px);font-weight:700}.fz032 .node small{display:block;margin-top:5px;font-size:clamp(10px,1.4vw,12.5px);line-height:1.45;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);color:var(--ink-soft,#3c362c)}.fz032 .n1{left:2%;top:11%;background:var(--cb,#dcebed);border-color:var(--ce,#8fbcc4);animation-delay:0s}.fz032 .n1 b{color:var(--c,#3f6d79)}.fz032 .n2{right:2%;top:11%;background:var(--gb,#e7eedd);border-color:var(--gl,#7c9c54);animation-delay:1.6s}.fz032 .n2 b{color:var(--g,#4f7233)}.fz032 .n3{right:2%;bottom:11%;background:var(--ab,#f4e8cc);border-color:var(--ae,#d9b66a);animation-delay:3.2s}.fz032 .n3 b{color:var(--a,#9a6516)}.fz032 .n4{left:2%;bottom:11%;background:var(--pb,#e6e7f3);border-color:var(--pe,#a9adcf);animation-delay:4.8s}.fz032 .n4 b{color:var(--p,#54579a)}.fz032 .arc{position:absolute;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,var(--muted,#6a6155),transparent);background-size:220% 100%;animation:fz-flow 3.4s linear infinite}.fz032 .arc::after{content:"";position:absolute;width:0;height:0;border-style:solid}.fz032 .top{top:16%;left:34%;width:32%}.fz032 .top::after{right:-9px;top:-5px;border-width:6.5px 0 6.5px 11px;border-color:transparent transparent transparent var(--muted,#6a6155)}.fz032 .bot{bottom:16%;left:34%;width:32%;animation-delay:1.7s}.fz032 .bot::after{left:-9px;top:-5px;border-width:6.5px 11px 6.5px 0;border-color:transparent var(--muted,#6a6155) transparent transparent}.fz032 .rgt{right:13%;top:50%;width:30%;transform:rotate(90deg);transform-origin:center;animation-delay:.85s}.fz032 .rgt::after{right:-9px;top:-5px;border-width:6.5px 0 6.5px 11px;border-color:transparent transparent transparent var(--muted,#6a6155)}.fz032 .lft{left:13%;top:50%;width:30%;transform:rotate(90deg);transform-origin:center;animation-delay:2.55s}.fz032 .lft::after{left:-9px;top:-5px;border-width:6.5px 11px 6.5px 0;border-color:transparent var(--muted,#6a6155) transparent transparent}@keyframes fz-flow{0%{background-position:120% 0}100%{background-position:-120% 0}}@keyframes fz-pulse{0%,100%{box-shadow:0 4px 16px rgba(154,101,22,.18);transform:translate(-50%,-50%) scale(1)}50%{box-shadow:0 6px 26px rgba(154,101,22,.32);transform:translate(-50%,-50%) scale(1.045)}}@keyframes fz-rise{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes fz-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}.fz032 .cap{margin-top:clamp(12px,2vw,20px);text-align:center;font-size:clamp(11px,1.6vw,14px);color:var(--muted,#6a6155);font-style:italic}@media(max-width:560px){.fz032 .stage{aspect-ratio:auto;display:flex;flex-direction:column;gap:10px;max-width:340px}.fz032 .ring,.fz032 .arc{display:none}.fz032 .core{position:relative;left:auto;top:auto;transform:none;width:70%;margin:2px auto;aspect-ratio:auto;padding:14px;animation:fz-pulse 7s ease-in-out infinite}.fz032 .node{position:relative;left:auto;right:auto;top:auto;bottom:auto;width:100%}.fz032 .node::before{content:"↓";display:block;margin:-4px 0 6px;font-family:var(--font-mono);color:var(--muted);font-size:15px}.fz032 .n1::before{content:""}}@media (prefers-reduced-motion:reduce){.fz032 *{animation:none!important}.fz032 .core{transform:translate(-50%,-50%) scale(1)}.fz032 .arc{background:var(--muted,#6a6155)}.fz032 .ring{opacity:.4}}</style><div class="hd"><div class="ti">Skill 的迭代闭环</div><div class="sub">好 skill 不是第一次就写对，而是通过真实任务持续收窄边界、修正文案、补足示例</div></div><div class="stage"><div class="ring"></div><div class="core"><b>真实任务</b><small>才是最终评测集</small></div><div class="node n1"><b>1. 写初稿</b><small>name / description / body</small></div><div class="node n2"><b>2. 试运行</b><small>看是否命中与执行稳定</small></div><div class="node n3"><b>3. 记录失败</b><small>模糊描述、漏步骤、坏示例</small></div><div class="node n4"><b>4. 回写优化</b><small>修描述、补示例、拆资源</small></div><div class="arc top"></div><div class="arc rgt"></div><div class="arc bot"></div><div class="arc lft"></div></div><div class="cap">写初稿 → 试运行 → 记录失败 → 回写优化，围绕真实任务持续循环</div></figure>

大多数写坏的 skill，问题都不是“模型不够强”，而是作者把边界写糊了。

最常见的错误有五类：

### 5.1 描述太泛

例如：

- `helper`
- `tools`
- `research`

这类名字和描述几乎不告诉 agent 任何选择信号，结果就是 skill 不容易被命中，或者被乱命中。

“选择信号”指的是能帮助 agent 判断适用场景的信息。`research` 只说明“和研究有关”，但没有说明研究什么、查什么来源、输出什么格式、什么时候该用。更好的描述应该把任务对象和动作写出来，例如“Search official product docs and produce source-linked Chinese summaries”。

### 5.2 正文太长，像一份培训文档

如果 `SKILL.md` 里全是背景知识、概念科普、重复解释，说明你把上下文预算浪费在了低价值信息上。

Microsoft Learn 建议把 `SKILL.md` 控制在较短范围内，把详细材料放到单独资源文件里；Anthropic 也反复强调“简洁是关键”。

这里的“上下文预算”，就是前面说的 context window 和 token 限制。正文越长，agent 留给用户真实问题、文件内容和工具结果的空间就越少。好的写法不是删除所有细节，而是把细节搬到 `references/`，并在正文里写清“什么时候读它”。

### 5.3 一个 skill 想做所有事

比如既想负责“数据清洗”，又想负责“图表制作”，又想负责“汇报文案”，又想负责“邮件发送”。

这通常会带来三个问题：

- 描述越来越模糊
- 正文越来越长
- 成功标准越来越不一致

更稳妥的方式通常是拆成多个小 skill，再由 agent 在任务里组合使用。

### 5.4 脚本和说明不一致

正文说“只读”，脚本却会写文件。

正文说“先校验再执行”，脚本却直接修改。

这种错最危险，因为它会让 skill 从“工作流说明”退化成“不可预测的黑箱”。

脚本尤其要写清楚副作用。副作用指它除了返回结果之外，还会不会改文件、发请求、创建资源、删除内容、提交代码。如果正文没有说明，agent 和使用者都很难判断这个脚本是否安全。

### 5.5 没有用真实任务测试

Anthropic 的最佳实践明确建议：用你计划实际使用的模型去测试 skill。

我会建议把测试做成一个简单闭环：

1. 挑 5 到 10 个真实任务
2. 观察 skill 是否会被正确命中
3. 看输出是否稳定符合预期
4. 把失败案例回写到 `description`、正文或示例里

一个 skill 是否好，不是看它写得多漂亮，而是看它在真实上下文里是否稳定工作。

最后把本文压成一句话：

**好 skill 的本质，不是“内容很多”，而是“让 agent 在对的时机，加载对的信息，并按对的方法完成任务”。**

**参考资料**

- [OpenAI Help Center: Skills in ChatGPT](https://help.openai.com/en/articles/20001066-skills-in-chatgpt)
- [OpenAI Academy: Skills](https://academy.openai.com/public/resources/skills)
- [OpenAI: Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [Agent Skills: What are skills?](https://agentskills.io/what-are-skills)
- [Agent Skills: Specification](https://agentskills.io/specification)
- [Anthropic Docs: Skill 撰写最佳实践](https://platform.claude.com/docs/zh-TW/agents-and-tools/agent-skills/best-practices)
- [Microsoft Learn: Agent Skills](https://learn.microsoft.com/en-us/agent-framework/agents/skills)
