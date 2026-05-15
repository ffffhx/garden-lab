---
title: "bytedcli 源码解析：为什么它更像一个面向 Agent 的 CLI 平台"
date: 2026-04-18 13:55:00
categories:
  - 技术
tags:
  - AI
  - Agent
  - CLI
  - TypeScript
  - ByteDance
  - 源码解析
  - 平台架构
excerpt: "从“内部工具箱”和“Agent 友好型 CLI 平台”的区别讲起，拆解 bytedcli 的命令分层、启动装配、认证与多站点、统一 HTTP/输出底座、MCP/Skills 桥接，以及它为什么能在能力越来越多时仍然继续长大。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

最近我花了一些时间看内部仓库 [byteapi/bytedcli](https://code.byted.org/byteapi/bytedcli)。

如果只看它的 README，你很容易先记住这些标签：

- ByteDance 内部工具 CLI
- 用 TypeScript 写的命令行工具
- 覆盖 Codebase、RDS、TCC、TCE、Log、Grafana、Cloud Docs 等很多域
- 支持 JSON 输出
- 支持 MCP
- 还自带 `skills/`

但真正进源码以后，我觉得它最值得看的地方不是“命令很多”，而是下面这件事：

**它并不是把一堆内部系统随手包成命令，而是在做一个既给人用、也给 Agent 用的 CLI 平台。**

这句话换成更直白的说法就是：

- 普通 CLI 更关心“人类好不好敲”
- `bytedcli` 除了关心“好不好敲”，还关心“脚本好不好调”“Agent 好不好接”“错误能不能稳定消费”

所以这篇文章不会按 README 的功能列表一条条数命令，而是按下面这条主线来讲：

1. 先把几个容易陌生的词说人话
1. 再解释为什么它不只是一个“内部工具箱”
1. 然后看它真正稳定的核心分层
1. 再看程序启动时是怎么把整棵命令树装起来的
1. 接着分析认证、多站点和会话恢复为什么是难点
1. 再看配置、HTTP、输出、错误这些底座怎么统一收口
1. 然后解释它为什么天然适合 Agent、MCP 和 Skills
1. 最后分析它为什么能继续长大，以及如果你要拿它做分享该怎么讲

为了避免版本漂移，先说明本文的观察范围：

- 仓库：`https://code.byted.org/byteapi/bytedcli`
- 默认分支：`master`
- 观察版本：`package.json` 中的 `0.40.0`
- 观察时间：`2026-04-18`

另外，下面所有代码片段都是**基于源码裁剪后的讲解版**：

- 只保留表达设计意图的主体功能
- 去掉了不少边界条件、日志和细节分支
- 每一行都补了中文注释，方便没接触过 TypeScript 的读者直接看懂

## 0. 阅读预备：先把几个词翻成人话

{% asset_img figure-01.svg %}

正式开始之前，先把文中会反复出现的几个词讲清楚。

- `CLI`
  - 命令行工具，也就是你在终端里敲命令时用的工具
- `Domain`
  - 业务域，可以理解成一类能力分组，比如 `codebase`、`rds`、`tcc`
- `Handler`
  - 处理输入输出的那一层。它离终端最近，负责接参数、调底层、组装结果
- `Service`
  - 编排层。它不直接负责终端展示，而是负责把多个 API 调用串起来
- `API Client`
  - 真正发请求、调平台接口的那层
- `MCP`
  - `Model Context Protocol`，可以简单理解成“让 Agent 接工具的一种统一协议”
- `Skill`
  - 给 Agent 的工作说明书，告诉它某个领域里通常应该怎么操作

如果你先记住一句话，后面会轻松很多：

**`bytedcli` 的重点不是“命令多”，而是“把命令、认证、输出、MCP 和 Skills 组织成一套可复用的平台”。**

## 1. 为什么说它不是一个“内部工具大杂烩”

{% asset_img figure-02.svg %}

我觉得读这个仓库时，第一步就要先把视角摆正：

**它不是“很多内部命令的集合”，而是“把很多内部能力收敛成统一调用面的平台”。**

这个判断不是我硬拔高，而是仓库自己已经给了很多信号。

比如 README 里明确写了两件事：

- 它是一个用 TypeScript 实现的命令行工具
- 它“专为 AI 使用设计”，强调结构化输出和完整上下文

这两句话连起来，就很说明问题了。

普通 CLI 常见的优化目标通常是这些：

- 参数是不是顺手
- 帮助信息是不是清楚
- 文本输出是不是好看

但 `bytedcli` 额外还要解决这些问题：

- 脚本能不能稳定拿到机器可读结果
- Agent 能不能判断本次到底成功还是失败
- 出错时是不是能拿到结构化上下文，而不是一大段散乱提示
- 同一套能力是不是既能给人手敲，也能给 MCP 工具层复用

这也是为什么它的入口文件一上来处理的，不只是“执行命令”，还包括“运行时环境是否稳定”。

下面这段代码来自 `src/bytedcli.ts`，我做了裁剪：

```ts
const netModule = require("node:net"); // 读取 Node.js 的网络模块
netModule.setDefaultAutoSelectFamilyAttemptTimeout?.(2000); // 把 IPv6/IPv4 自动选择等待时间调大，减少内网环境下先试 IPv6 造成的连接抖动
import { runCli } from "@/cli"; // 真正的命令装配和执行逻辑在 cli 层
import { isJsonMode } from "@/utils/output"; // 判断当前是不是 JSON 输出模式
import { toAppError } from "@/utils/error"; // 把各种异常统一转换成应用级错误
runCli().catch((error) => { // 启动 CLI，如果失败就走统一兜底
  if (!isJsonMode()) { // 只有文本模式才打印人类可读错误
    const appError = toAppError(error); // 先把原始错误收口成统一结构
    console.error(appError.message); // 再输出一条尽量稳定、尽量能看懂的报错信息
  } // 文本模式报错处理结束
  process.exitCode = 1; // 告诉外部进程：这次命令执行失败了
}); // 启动阶段的统一异常处理结束
```

这段代码很短，但它透露出一个关键信号：

**作者知道这个工具不是只运行在“理想的本地终端环境”，它还要运行在内网、代理、脚本、Agent 和自动化流程里。**

所以，`bytedcli` 真正的目标不是“把命令做全”，而是：

**把一大堆内部能力，收敛成一套行为一致、输出稳定、可继续扩展的执行界面。**

## 2. 真正稳定的核心：先分层，再加命令

{% asset_img figure-03.svg %}

如果你问我，这个仓库最值得学的是什么，我会先答一句：

**不是它接了多少系统，而是它在命令越来越多之前，先把边界分好了。**

这一点在仓库里的 `AGENTS.md` 说得很明确：

- `src/cli/commands/*`
  - 只定义命令和参数，不写业务逻辑
- `src/cli/handlers/*`
  - 负责接参数、调服务、组织输出
- `src/services/*`
  - 负责跨 API 编排
- `src/api/*`
  - 负责真正发请求
- `src/auth/*`
  - 负责认证和凭据存储
- `src/presenters/*`
  - 负责文本展示模板
- `src/utils/*`
  - 负责 config、http、error、logger 这些基础设施

这套分层看上去很朴素，但它解决了一个很现实的问题：

**当 CLI 能力从 5 个域涨到 50 个域时，你最怕的不是命令多，而是命令和逻辑全部搅成一锅。**

如果没有这套边界，后面通常会出现这几类问题：

- 命令层里直接拼 HTTP 请求
- 认证逻辑散落在不同命令里
- 文本输出和 JSON 输出各写一套
- 新增一个 domain，就要从头抄一遍旧代码

而 `bytedcli` 反过来做的是：

- 命令层只关心“这个命令长什么样”
- handler 层只关心“输入怎么变成调用”
- service 层只关心“复杂流程怎么串”
- api 层只关心“请求怎么发出去”

这就让它很像一个平台，而不是一组脚本。

你可以把它理解成一句很朴素的工程原则：

**能力可以越接越多，但每一层只做自己那一层的事。**

从读者角度看，这还有一个额外好处：

- 你想理解参数怎么设计，就看 `commands`
- 你想理解一条命令最后做了什么，就看 `handlers`
- 你想理解真实调用链，就看 `services` 和 `api`

所以当你准备自己讲这个仓库时，一定不要从“有哪些命令”讲起，而要从“为什么要先分层”讲起。

## 3. 启动时发生了什么：根命令怎样长成整棵命令树

{% asset_img figure-04.svg %}

理解完分层以后，再去看启动流程，就不会被海量命令名吓住。

真正的关键，在 `src/cli/index.ts` 里的 `buildProgram()`。

下面是我按源码裁剪后的版本：

```ts
export function buildProgram(): Command { // 构建整棵 CLI 根命令
  const program = new Command(); // 创建 commander 的根命令对象
  program.enablePositionalOptions(); // 要求全局参数写在子命令前面，这样子命令可以安全复用常见参数名
  program.exitOverride(); // 不让 commander 直接退出进程，而是把退出权交回 bytedcli 自己控制
  program.showHelpAfterError(true); // 文本模式下，参数出错后自动补一段帮助信息
  program.showSuggestionAfterError(false); // 关闭 commander 默认建议，改成 bytedcli 自己统一组织错误输出
  program.option("-d, --debug", "Enable debug logging"); // 注册调试开关
  program.option("-j, --json", "Output JSON only"); // 注册 JSON 输出开关
  program.option("--site <site>", "ByteCloud site"); // 注册站点切换参数
  program.option("--auth-site <sso>", "SSO environment override"); // 注册 SSO 环境覆盖参数
  program.option("--http-timeout-ms <timeoutMs>", "HTTP timeout in ms"); // 注册全局 HTTP 超时参数
  registerCommands(program); // 把所有业务域命令都挂到根命令下面
  return program; // 返回已经装好的命令树
} // 根命令构建结束
```

这段代码最重要的地方，不是某一个参数，而是整体姿势：

**先把“全局运行规则”建好，再把业务命令整批挂上去。**

接着看 `registerCommands()`，这个函数在 `src/cli/commands/index.ts`：

```ts
export function registerCommands(program: Command): void { // 按业务域批量注册顶层命令
  registerAuthCommands(program); // 挂上 auth 这组命令
  registerCodebaseCommands(program); // 挂上 codebase 这组命令
  registerRdsCommands(program); // 挂上 rds 这组命令
  registerTccCommands(program); // 挂上 tcc 这组命令
  registerTceCommands(program); // 挂上 tce 这组命令
  registerLogCommands(program); // 挂上 log 这组命令
  registerGrafanaCommands(program); // 挂上 grafana 这组命令
  registerMcpCommands(program); // 挂上 mcp 这组命令
} // 顶层命令注册结束
```

这里我刻意只保留了少量 domain，真实文件里远不止这些。

但只看这个裁剪版，你已经能理解它的扩展方式了：

- 新增一个业务域，不是往一个大文件里继续堆逻辑
- 而是新增一个域目录，然后在总入口这里注册一下

这就是很典型的平台化套路：

**入口稳定，域能力按模块插进去。**

再往后看 `runCli()`，你会更清楚它为什么强调 JSON 和统一错误。

```ts
export async function runCli(args = process.argv.slice(2)): Promise<void> { // 执行一次完整的 CLI 调用
  const program = buildProgram(); // 先构建根命令和整棵命令树
  const mappedArgs = mapArgs(args); // 先把别名参数和兼容参数做一次标准化
  const earlyJson = mappedArgs.includes("--json") || mappedArgs.includes("-j"); // 提前判断这次是不是 JSON 模式
  setJsonMode(earlyJson); // 把 JSON 模式写进运行时状态
  commanderOutputEnabled = !earlyJson; // JSON 模式下关闭 commander 默认文本输出，避免污染 stdout
  if (earlyJson && mappedArgs.length === 0) { // 如果用户只写了 bytedcli --json
    outputResult("success", { help: buildHelpSchema(program, program) }, null, contextWithTime(Date.now(), "CLI")); // 就直接输出结构化帮助信息
    return; // 这次执行到这里结束
  } // JSON 帮助分支结束
  await program.parseAsync(mappedArgs, { from: "user" }); // 让 commander 正常解析并执行命令
} // 一次 CLI 执行流程结束
```

这段代码很能说明 `bytedcli` 的气质：

- 它不是“先把文本打出来，再顺手给点 JSON”
- 它是从执行入口就明确区分“文本模式”和“机器模式”

对人来说，这只是一个 `--json` 参数。

但对脚本和 Agent 来说，这其实是一条很重要的承诺：

**只要你走 JSON 模式，我就尽量给你稳定、可继续处理的输出。**

## 4. 最难的其实不是命令，而是认证、多站点和会话恢复

{% asset_img figure-05.svg %}

很多人看内部 CLI，第一反应是：

“难点应该是接口多、命令多吧？”

但真正做过这一类工具的人通常会告诉你：

**真正麻烦的往往不是命令名，而是认证、多环境和会话状态。**

`bytedcli` 在这方面的痕迹非常明显。

先看 `src/cli/commands/auth/index.ts` 里的裁剪版：

```ts
export function registerAuthCommands(program: Command): void { // 注册 auth 顶层命令
  const authCmd = program.command("auth"); // 创建 auth 命令分组
  const loginCmd = authCmd.command("login"); // 创建 login 子命令
  loginCmd.option("--session", "复用浏览器会话登录"); // 允许复用本地浏览器里已有的登录态
  loginCmd.option("--qr-image [path]", "把二维码保存成图片"); // 允许把二维码写成图片，方便异步扫码
  loginCmd.option("--no-terminal-qr", "不在终端里显示二维码"); // 允许关闭终端二维码输出
  loginCmd.option("--begin", "开始一个非阻塞登录流程"); // 先发起登录，再把流程挂起
  loginCmd.option("--complete <token>", "继续之前的登录流程"); // 后续再带着 token 把登录流程补完
  loginCmd.action((opts) => { // 真正执行时，把参数交给 handler 层处理
    return handleAuthLogin(opts); // 由 handler 统一处理二维码、session、恢复流程和输出
  }); // login 子命令注册结束
} // auth 命令注册结束
```

这段代码很有代表性，因为它已经暴露了几个事实：

1. 登录方式不只一种  
   不只有“终端里扫一下码”这么简单，还有浏览器会话复用、二维码落盘、非阻塞恢复

2. 登录不是只给人设计的  
   `--begin` / `--complete` 这种模式，明显就是为了脚本和 Agent 准备的

3. 认证和站点是绑定的  
   不同 `site` 背后可能对应不同 SSO 环境，不能把所有 token 混成一锅

再看 `src/utils/config.ts` 里的默认配置，就能发现“站点”本身就是全局运行时的一部分：

```ts
const defaultConfig: Config = { // 定义运行时默认配置
  ssoEnv: "bytedance", // 默认使用 ByteDance 这套 SSO 环境
  cloudSite: "cn", // 默认站点是国内
  httpTimeoutMs: 20000, // 默认 HTTP 超时 20 秒
  httpRetryCount: 2, // 默认失败后重试 2 次
  httpRetryBaseDelayMs: 200, // 重试基础等待时间是 200 毫秒
  httpRetryMaxDelayMs: 2000, // 最长重试等待时间不超过 2 秒
}; // 默认配置定义结束

export function loadConfigFromEnv(env = process.env): Partial<Config> { // 从环境变量读取覆盖配置
  const resolved: Partial<Config> = {}; // 先准备一个空的运行时配置
  if (env.BYTEDCLI_CLOUD_SITE) { // 如果外部显式传了站点环境变量
    resolved.cloudSite = normalizeCloudSite(env.BYTEDCLI_CLOUD_SITE)!; // 就覆盖默认站点
  } // 站点覆盖结束
  if (env.BYTEDCLI_AUTH_SITE) { // 如果外部显式传了 SSO 环境
    resolved.authSite = env.BYTEDCLI_AUTH_SITE as "bytedance" | "tiktok" | "test"; // 就覆盖默认 SSO 选择
  } // SSO 环境覆盖结束
  return resolved; // 返回环境变量这一层解析出来的配置
} // 环境变量配置读取结束
```

这说明 `bytedcli` 不是把“登录”当成一个孤立小功能，而是把它视为**整套平台的运行前提**。

对内部 CLI 来说，这非常重要。

因为它面对的通常不是单一系统，而是：

- 多站点
- 多 SSO 环境
- 多类 token
- 浏览器态和 CLI 态混用
- 有时还要照顾非交互式流程

所以如果你拿这个仓库做分享，我非常建议你强调一句：

**内部 CLI 的难点，经常不是“命令能不能写出来”，而是“命令背后的身份状态能不能被稳定管理”。**

## 5. 平台化真正的底座：配置、HTTP、输出、错误怎么收口

{% asset_img figure-06.svg %}

如果说认证解决的是“能不能访问”，那配置、HTTP、输出、错误解决的就是：

**访问以后，整个系统能不能保持一致的行为。**

这部分我觉得 `bytedcli` 做得很平台化。

### 5.1 配置优先级是统一的

README 里已经写得很明确：

**CLI 参数 > 环境变量 > 默认值**

这句话看上去很常识，但真正重要的是：

- 这个优先级不能在不同 domain 里各写各的
- 必须由统一的 config 层收口

否则最后就会变成：

- `codebase` 一套规则
- `rds` 一套规则
- `grafana` 又一套规则

### 5.2 HTTP 不是一个函数，而是一套底座

`src/utils/http/index.ts` 不是一个巨大的“万能请求函数”，而是把 HTTP 底座拆成了几个子模块统一导出：

- `proxy`
- `http2`
- `retry`
- `api`
- `trace`

这说明作者很清楚，HTTP 在这种 CLI 里不是“小工具”，而是横跨全仓库的基础设施。

也就是说，它要同时管这些事：

- 代理
- 超时
- 重试
- trace
- 请求体和响应体打印
- HTTP/2 特殊处理

### 5.3 JSON 输出有统一出口

再看 `src/utils/output.ts`，你会发现 JSON 结果是统一从一个地方吐出来的：

```ts
export function outputResult(status, data, error, context): void { // 统一输出 JSON 结果
  if (!jsonMode) { // 如果当前不是 JSON 模式
    return; // 就直接返回，让文本模式走别的渲染逻辑
  } // JSON 模式判断结束
  const result = { // 把这次执行的核心信息统一收成一个对象
    status, // 成功还是失败
    data: data === undefined ? null : data, // 真实数据内容
    error: error ?? null, // 错误信息
    context: context ?? {}, // 执行时间、时间戳、接口端点等上下文
  }; // 统一结果对象组装结束
  const line = JSON.stringify(result); // 序列化成单行 JSON
  process.stdout.write(`${line}\n`); // 写到标准输出，方便脚本和 Agent 继续消费
} // 统一 JSON 输出结束
```

这段代码背后的设计点非常朴素，但非常关键：

**不要让每个命令自己决定 JSON 怎么长。**

否则最后 Agent 或脚本看到的会是：

- 这个命令字段叫 `message`
- 那个命令字段叫 `msg`
- 另一个命令又把错误打在 `stdout` 里

而统一出口的好处是：

- 输出形状更稳定
- 错误结构更统一
- 调试和 trace 信息更容易补进去

所以你会发现，`bytedcli` 不是简单地“封装了一层 fetch”。

它做的其实是：

**把配置、请求、错误和输出统一成一条可预测的执行链。**

## 6. 为什么它天然适合 Agent：JSON、MCP、Skills 其实是一条线

{% asset_img figure-07.svg %}

我觉得这是整个仓库最有意思的部分。

很多人会把这三个词分开看：

- JSON 输出
- MCP
- Skills

但在 `bytedcli` 里，这三件事其实是一条线上的。

### 6.1 第一步：先让 CLI 变得可机器消费

如果一个 CLI 连稳定 JSON 都给不了，那后面谈 MCP 和 Agent，基本都只是口号。

所以 `bytedcli` 先做的是：

- 用 `--json` 保证机器可读输出
- 用统一错误结构保证失败也能被消费
- 用帮助 schema 保证工具自己也能被发现

### 6.2 第二步：再把 CLI 命令桥接成 MCP 工具

这一步在 `src/mcp/server.ts` 里很清楚。

下面是我按源码裁剪后的版本：

```ts
function registerFlatTools(server, options): number { // 把 CLI 命令批量映射成 MCP 工具
  const program = buildProgram(); // 先复用同一棵 CLI 命令树
  const specs = collectCliCommandSpecs(program); // 把每条命令抽成结构化规格
  for (const spec of specs) { // 遍历每一条命令规格
    const name = toToolName(spec.path); // 把命令路径转成 MCP 工具名
    const inputSchema = buildNamedInputSchema(spec.options); // 把命令参数转成工具输入 schema
    registerTool(server, name, { inputSchema }, async (input) => { // 向 MCP server 注册这个工具
      const args = buildCliArgs(spec.path, input); // 把工具输入重新拼回 CLI 参数
      const { stdout, stderr, exitCode } = await runCliCaptured(args); // 直接复用现成的 CLI 执行链路
      const output = stdout.trim() || stderr.trim() || "(no output)"; // 统一整理文本结果
      return { content: [{ type: "text", text: output }], isError: exitCode !== 0 }; // 再包装成 MCP 结果
    }); // 单个工具注册结束
  } // 所有命令遍历结束
  return specs.length; // 返回本次一共注册了多少个工具
} // CLI 到 MCP 的桥接结束
```

这段代码的核心思路特别值得讲：

**不是再手写一套 MCP 逻辑，而是复用已经成熟的 CLI 命令树。**

这能带来两个直接好处：

1. 一处维护，多处复用  
   命令一旦稳定，终端用户、脚本、MCP 客户端都能共享同一套能力

2. 行为更一致  
   CLI 的参数、校验、帮助、错误处理，不需要在 MCP 层重写一遍

### 6.3 第三步：把技能说明书跟着包一起发出去

`package.json` 里还有一个很有意思的细节：

- 发布文件里不只有 `dist`
- 还把 `skills` 一起带上了

这其实说明一个判断：

**作者认为这个包不只是“可执行程序”，还是“能力 + 使用说明”的组合包。**

这很像现代 Agent 系统的思路：

- 命令负责执行
- MCP 负责接入
- Skills 负责告诉 Agent 应该怎么用这些能力

所以如果你问我，为什么 `bytedcli` 看上去有点像“命令平台”而不是“命令工具箱”？

答案就在这里：

**它把执行能力、协议接入和工作说明书放在了一条统一链路上。**

## 7. 为什么它还能继续长大：工程治理比命令本身更重要

{% asset_img figure-08.svg %}

到这里其实就能回答一个很现实的问题了：

`bytedcli` 已经接了这么多域，为什么还没有因为命令数量爆炸而完全失控？

我觉得答案不是“作者写得快”，而是它在工程治理上做了几件很对的事。

### 7.1 它有很强的分层纪律

`AGENTS.md` 里反复强调：

- command 只定义命令
- handler 只做 CLI 入口
- service 不反向依赖 CLI
- auth 不要散落到各层

这类约束听上去有点“啰嗦”，但平台类仓库最怕的就是没人持续说这些话。

### 7.2 它要求对外说明和代码一起演进

这个仓库不只是要求改代码，还要求同步这些内容：

- `README.md`
- `website/`
- `skills/*`
- help 文案

这说明它很清楚一件事：

**平台类工具的“接口”不只是代码，文档和帮助本身也是接口。**

### 7.3 它在测试和发布上也按平台来设计

从 `package.json` 能看出几件事：

- 有 lint
- 有 build
- 有 test
- 有覆盖率
- 有技能校验
- 发布时同时带上技能资产

这意味着它不是“写完命令就算了”，而是要保证整套平台资产能一起工作。

如果你准备把这个仓库拿去做技术分享，我建议不要按“支持哪些命令”去讲，那样很快就会变成产品介绍。

更好的讲法是按下面这 8 页来讲：

1. `bytedcli` 解决的问题是什么  
   重点讲它为什么不是普通 CLI
1. 它的稳定核心是什么  
   重点讲分层
1. 根命令是怎么装出来的  
   重点讲 `buildProgram` 和命令注册
1. 为什么认证是难点  
   重点讲多站点、多 SSO、session 恢复
1. 统一底座怎么做  
   重点讲 config / http / output / error
1. 为什么它天然适合 Agent  
   重点讲 JSON 输出和 MCP 桥接
1. 为什么 Skills 不是“附属品”  
   重点讲执行能力和工作说明书一起发布
1. 它为什么能继续长大  
   重点讲工程治理和文档同步

如果你只有 20 到 30 分钟，我建议把时间分配成这样：

- 5 分钟讲“它到底是什么”
- 8 分钟讲“它怎么分层”
- 5 分钟讲“认证和底座”
- 5 分钟讲“Agent / MCP / Skills”
- 3 分钟讲“工程治理和总结”

## 结论

最后我想把这篇文章压成一句话：

**`bytedcli` 最值得学的，不是“怎么把几十个内部系统都接进来”，而是“怎么在能力越来越多之前，先把命令、认证、输出、MCP 和 Skills 放进一个可持续扩张的框架里”。**

如果只把它看成“内部工具集合”，你会觉得它只是命令很多。

但如果把它看成“面向人和 Agent 的 CLI 平台”，很多设计就会一下子变得很合理：

- 为什么它这么重视 JSON
- 为什么它要统一 config / http / error
- 为什么它要认真处理多站点和登录恢复
- 为什么它要把 CLI 再桥接成 MCP
- 为什么它发布时连 `skills` 都一起带上

这也是我看完这个仓库以后最大的感受：

**真正难的从来不是“再加一个命令”，而是“加了很多命令以后，整套系统还能不能继续讲得清、跑得稳、接得出去”。**
