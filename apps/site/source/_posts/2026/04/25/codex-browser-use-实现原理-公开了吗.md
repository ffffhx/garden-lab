---
title: "Codex Browser Use 实现原理公开了吗：一次基于公开源码的边界分析"
date: 2026-04-25 20:40:00
categories:
  - 技术
tags:
  - Codex
  - Browser Use
  - Agent
  - App Server
  - Plugin
  - Sandbox
excerpt: "Codex 的 Browser Use 目前不是完整开源形态：公开的 openai/codex 仓库能看到 App Server、插件加载、feature gate 和沙箱 socket 放行，但看不到 browser-use 插件本体与 browser-client 浏览器控制运行时。这篇文章把公开源码能证明的边界、可推导的执行链路和不能过度解读的部分分开讲清楚。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

先给结论：

**截至 2026-04-25，我没有在公开的 `openai/codex` 仓库里看到 Codex Browser Use 的完整实现源码。**

更准确地说，它是一个“外围机制开源、本体运行时未完整公开”的状态：

- 公开仓库里能看到 `in_app_browser`、`browser_use` 这样的 feature gate
- 能看到 Codex App Server、插件系统、技能注入、MCP 配置加载等通用机制
- 能看到 macOS 沙箱测试里专门放行 `/tmp/codex-browser-use` 这类 Unix socket 路径
- 但看不到 `browser-use` 插件目录、`browser-client` 运行时、内置浏览器后端和网页动作执行器的完整源码

所以这篇文章不会假装做“完整源码逐行解析”。它的目标是把公开部分拆清楚：Codex 为 Browser Use 预留了哪些开源基础设施？这些基础设施暗示了怎样的浏览器控制链路？哪些地方仍然不能从公开源码下结论？

本文观察的公开仓库是：

- 仓库：[openai/codex](https://github.com/openai/codex)
- 观察 commit：[`a2db6f97fb9353edfbcb82ea4fbb89c8346d1222`](https://github.com/openai/codex/tree/a2db6f97fb9353edfbcb82ea4fbb89c8346d1222)
- 观察日期：2026-04-25

{% asset_img figure-01.svg %}

## 1. 为什么说它没有“完整开源”

判断一个能力有没有完整开源，不能只看仓库里有没有出现名字。对 Browser Use 来说，公开仓库里确实能搜到 `browser_use`，但命中的位置主要是 feature gate、配置 schema、测试和沙箱策略。

我用下面这些关键词在公开仓库里搜索：

```bash
rg -n "setupAtlasRuntime|agent\\.browser|codex-browser-use|browser-client|Browser Use|browser_use|in_app_browser"
```

结果里有价值的公开命中大致分成三类：

- `codex-rs/features/src/lib.rs`：声明 `InAppBrowser`、`BrowserUse`、`ComputerUse`
- `codex-rs/core/src/config/config_tests.rs`：验证云端 requirements 可以关闭 `in_app_browser` 和 `browser_use`
- `codex-rs/sandboxing/src/seatbelt_tests.rs`：验证 macOS Seatbelt 沙箱可以额外放行 `/tmp/codex-browser-use`

但是，仓库里没有找到下面这些本体实现：

- 没有公开的 `browser-use` 插件目录
- 没有公开的 `browser-client.mjs`
- 没有公开的 `setupAtlasRuntime`
- 没有公开的 `agent.browser.*` 浏览器 API 实现
- 没有公开的内置浏览器后端如何接收动作、管理 tab、截图、DOM snapshot、Playwright locator 的完整实现

这就形成了一个很清楚的边界：**Codex 开源的是承载 Browser Use 的平台层，不是 Browser Use 的全部浏览器控制运行时。**

这个判断也和官方对 Codex 插件体系的描述一致。OpenAI Academy 对插件的解释是：插件帮助 Codex 连接外部工具和信息源，可以包含技能、工具或应用能力；但这并不意味着每个官方 bundled plugin 的实现都在 `openai/codex` 仓库里公开。

## 2. 公开源码里最直接的证据：feature gate

公开源码里最明确的证据在 `codex-rs/features/src/lib.rs`。这里把 Browser Use 和 In-App Browser 放在同一组 feature 中。

下面是裁剪后的示意代码，不是原文件完整拷贝：

```rust
pub enum Feature { // 定义 Codex 运行时里可被开关控制的能力集合
    InAppBrowser, // 允许桌面应用展示内置浏览器面板
    BrowserUse, // 允许 Agent 集成 Browser Use 来操作内置浏览器
    ComputerUse, // 允许 Codex 使用桌面级电脑操作能力
} // Feature 枚举结束

FeatureSpec { // 注册一个具体 feature 的元数据
    id: Feature::BrowserUse, // 这个配置项对应 BrowserUse 能力
    key: "browser_use", // 用户或 requirements 层看到的配置 key
    stage: Stage::Stable, // 当前被标记为稳定 feature
    default_enabled: true, // 默认处于开启状态，最终仍会被 requirements 归一化
} // BrowserUse 的 feature spec 结束
```

这个片段说明两件事。

第一，Browser Use 被 Codex 当成一等能力管理，而不是临时写死在某个 UI 分支里。它有自己的 feature key，和 `in_app_browser`、`computer_use` 并列。

第二，注释里写得很关键：`InAppBrowser` 和 `BrowserUse` 都是 requirements-only gate。也就是说，最终开关不只是本地用户配置说了算，还会被组织、产品、账号或远端要求层归一化。

公开测试里也能看到这个归一化逻辑：

```rust
entries: BTreeMap::from([ // 构造一组来自 requirements 的 feature 约束
    ("in_app_browser".to_string(), false), // 要求关闭内置浏览器面板
    ("browser_use".to_string(), false), // 要求关闭 Browser Use 集成
]), // requirements feature map 构造结束

assert!(!config.features.enabled(Feature::InAppBrowser)); // 验证内置浏览器最终确实被关闭
assert!(!config.features.enabled(Feature::BrowserUse)); // 验证 Browser Use 最终确实被关闭
```

从工程设计上看，这解释了为什么同一个 Codex 版本在不同账号、不同 workspace、不同平台上可能看到不同能力。Browser Use 不是一个单纯的本地命令，而是被产品要求层控制的能力。

{% asset_img figure-02.svg %}

## 3. 插件系统开源了，但 Browser Use 插件本体不在公开仓库里

要理解 Browser Use，必须先理解 Codex 的 plugin 模型。

公开源码里，插件被抽象成一个本地 bundle。一个插件可以贡献三类东西：

- Skills：告诉模型“遇到某类任务时应该怎么操作”
- MCP servers：把外部能力暴露成可调用工具
- Apps：把 ChatGPT / Codex connector 能力接进来

这点在 `codex-rs/plugin/src/load_outcome.rs` 里可以直接看到。下面是裁剪版：

```rust
pub struct LoadedPlugin<M> { // 表示一个已经从磁盘加载出来的插件
    pub skill_roots: Vec<AbsolutePathBuf>, // 插件贡献的 skill 根目录
    pub mcp_servers: HashMap<String, M>, // 插件贡献的 MCP server 配置
    pub apps: Vec<AppConnectorId>, // 插件贡献的 app connector
    pub enabled: bool, // 插件当前是否启用
    pub error: Option<String>, // 插件加载失败时记录错误
} // LoadedPlugin 结构体结束
```

插件 manifest 的公开解析逻辑也能看到。`codex-rs/core-plugins/src/manifest.rs` 会读取 `.codex-plugin/plugin.json`，并解析 `skills`、`mcpServers`、`apps` 这些路径。

```rust
struct RawPluginManifest { // 反序列化 plugin.json 的原始结构
    name: String, // 插件名称
    version: Option<String>, // 插件版本
    skills: Option<String>, // 自定义 skills 目录
    mcp_servers: Option<String>, // 自定义 MCP 配置路径
    apps: Option<String>, // 自定义 apps 配置路径
} // 原始 manifest 结构结束
```

插件加载时，Codex 会把这些能力合并到当前会话里：

```rust
let manifest = load_plugin_manifest(plugin_root.as_path()); // 读取插件根目录下的 plugin.json
loaded_plugin.skill_roots = plugin_skill_roots(&plugin_root, manifest_paths); // 解析插件提供的 skills
loaded_plugin.mcp_servers = mcp_servers; // 合并插件提供的 MCP server
loaded_plugin.apps = load_plugin_apps(plugin_root.as_path()).await; // 合并插件提供的 app connector
```

这说明 Browser Use 最自然的落点就是一个 bundled plugin：它可以用 skill 指导模型什么时候使用浏览器，用 MCP 或 Node runtime 暴露动作接口，再由 Codex App 侧的内置浏览器后端执行动作。

但关键问题在于：**公开仓库只有 plugin 平台，没有 Browser Use 插件源码本体。**

公开 GitHub issue 里也有人提到本机插件缓存中能看到 `browser-use` 和 `chrome` 这类 bundled plugin 目录，这能佐证它是随 Codex App 分发的插件形态；但 issue 不是源码发布，不能把它等同于开源实现。

{% asset_img figure-03.svg %}

## 4. 最有信息量的线索：沙箱为何要放行 `/tmp/codex-browser-use`

公开源码里最接近 Browser Use 运行机制的线索，不在插件系统，而在 macOS 沙箱测试。

`codex-rs/sandboxing/src/seatbelt_tests.rs` 里有一组测试专门验证额外 Unix socket allowlist。测试里出现了 `/tmp/codex-browser-use`：

```rust
let extra_allow_unix_sockets = vec![ // 准备一组额外允许访问的 Unix socket 路径
    absolute_path("/tmp/codex-browser-use"), // Browser Use 相关的本地 socket 根路径
]; // allowlist 构造结束

let args = create_seatbelt_command_args(CreateSeatbeltCommandArgsParams { // 生成 macOS Seatbelt 沙箱参数
    network_sandbox_policy: NetworkSandboxPolicy::Restricted, // 当前网络策略仍然是受限模式
    extra_allow_unix_sockets: &extra_allow_unix_sockets, // 但额外允许访问指定 Unix socket
    ..params // 其他参数沿用测试上下文
}); // 沙箱参数生成结束

assert!(policy.contains("(allow system-socket (socket-domain AF_UNIX))")); // 验证沙箱允许使用 AF_UNIX socket
```

这个测试很值得细看。

如果 Browser Use 只是普通网页请求，它不需要专门在 macOS 沙箱里放行一个本地 Unix socket。如果它只是 Computer Use 那类屏幕级点击，也不一定需要一个名字如此明确的 `codex-browser-use` socket。

更合理的解释是：

**Agent 所在的受限执行环境需要通过本地 socket 和一个浏览器控制进程通信。**

这个浏览器控制进程可能在 Codex App 或内置浏览器侧，负责真正管理 tab、截图、页面状态和动作执行。Agent 不能随便绕过沙箱访问系统资源，但可以通过明确 allowlist 的 socket 访问这个受控后端。

这也符合 Codex 的整体架构思路：模型不直接拥有真实世界权限，它通过工具、App Server、插件和权限层逐步拿到受约束的能力。

{% asset_img figure-04.svg %}

## 5. 从公开部分推导出的执行链路

把上面这些线索放在一起，可以得到一个比较稳妥的链路推断：

```plaintext
用户请求
  -> Codex Desktop / App Server
  -> Codex core agent loop
  -> feature requirements 判断 browser_use 是否可用
  -> 插件系统把 Browser Use 相关 skill / tool 能力注入会话
  -> Agent 选择浏览器动作
  -> 受限执行环境通过 /tmp/codex-browser-use 这类本地 socket 访问浏览器后端
  -> Codex 内置浏览器执行导航、点击、输入、截图、页面状态读取
  -> 结果回到 Agent 上下文，继续下一步
```

这里面，前半段是公开源码能比较直接支撑的：

- App Server 是 Codex 多客户端统一入口，官方文章也明确说 Codex Desktop、VS Code、Web runtime 等 surface 会围绕 App Server / Codex core 组织
- feature gate 和 requirements 归一化在公开源码里
- plugin / skill / MCP / app connector 的加载和注入在公开源码里
- macOS sandbox 的额外 Unix socket 放行在公开源码里

后半段只能说是合理推断：

- socket 后面的 Browser Use backend 如何实现，不在公开仓库里
- 浏览器 tab 如何和 Codex thread / turn 绑定，不在公开仓库里
- DOM snapshot、截图、locator、点击、输入、等待这些动作怎样封装，不在公开仓库里
- URL 访问控制、站点授权、下载上传策略等产品安全细节，也不能仅靠公开仓库完整还原

这个边界非常重要。写实现解析时，不能把“我能推断它大概率这样工作”写成“源码就是这样写的”。

## 6. Browser Use 和 Computer Use 的实现层级不同

公开 feature gate 把 `BrowserUse` 和 `ComputerUse` 分开，也说明 OpenAI 并不是把它们当成同一个东西。

从能力边界看，二者很可能是两条不同路径：

| 能力 | 更接近的控制层 | 主要对象 | 优势 | 限制 |
| --- | --- | --- | --- | --- |
| Browser Use | 浏览器运行时 / 内置浏览器后端 | Web page、tab、DOM、截图 | 对前端页面语义更强，适合调试 localhost 和网页流程 | 主要覆盖浏览器上下文 |
| Computer Use | 操作系统 UI / Accessibility / 截图 | 整个桌面、任意 App | 跨 App 能力强，能处理系统弹窗、原生应用 | 对网页内部状态不如浏览器协议精细 |

这也解释了为什么 Browser Use 对前端开发特别有价值。它不只是“点屏幕”，而是更可能拿到浏览器语义：URL、tab、页面结构、截图、可点击目标和加载状态。

但同样要强调：这些浏览器语义的具体实现没有在公开 `openai/codex` 仓库里完整出现。

## 7. 这个设计值得学什么

虽然 Browser Use 本体没有完整开源，公开出来的平台层依然很有学习价值。

第一，能力要放在 feature gate 后面。

Browser Use 这种高权限能力，既要能默认启用，又要能被 workspace 或 requirements 统一关闭。公开源码里把它设计成 requirements-only gate，说明产品能力、组织策略和本地运行时之间有明确边界。

第二，插件系统只定义“能力如何进入 Codex”，不把所有能力写死在 core 里。

`LoadedPlugin` 同时承载 skills、MCP servers 和 apps，这让 Codex core 不需要理解每个具体插件的业务逻辑。Browser Use 可以作为 bundled plugin 进入系统，而不是把所有浏览器动作硬编码到 agent loop。

第三，沙箱不是简单的“全禁”或“全放”。

`/tmp/codex-browser-use` 这个测试线索说明，Codex 的沙箱可以对少量本地 IPC 通道做精确放行。这样 Agent 仍在受限环境里运行，但可以通过受控桥接访问浏览器后端。

第四，浏览器自动化最好是“语义 + 视觉”的组合。

从产品形态上看，Browser Use 面向本地开发页面、点击流程、截图和验证任务。纯 DOM 自动化对视觉 bug 不够，纯截图点击又不够稳定；最实用的浏览器 Agent 往往会同时使用 DOM / locator / accessibility / screenshot 这些信号。

## 8. 最后结论

如果问题是“Codex 是否已经完整开源 Browser Use 实现”，我的判断是：

**没有。至少截至 2026-04-25，公开 `openai/codex` 仓库没有包含 Browser Use 插件本体和浏览器控制 runtime 的完整源码。**

如果问题是“能不能从公开源码理解它的大致实现原理”，答案是：

**可以，但要限定范围。**

公开源码能证明的是：Codex 已经把 Browser Use 纳入稳定 feature、受 requirements 控制、通过插件体系进入会话，并且为本地浏览器控制链路预留了沙箱 socket 通道。

公开源码不能证明的是：`browser-client` 如何实现、内置浏览器后端如何接动作、Playwright 风格 API 如何被封装、站点权限和安全策略如何完整落地。

所以，这次更像是一篇“实现边界解析”：它告诉我们 Codex Browser Use 不是一个孤立的浏览器脚本，而是接在 Codex App Server、agent loop、plugin、skill、MCP、安全策略和本地 IPC 之上的能力。但它真正驱动浏览器的那层，目前仍不属于公开 `openai/codex` 源码的一部分。

## 参考资料

- [openai/codex GitHub 仓库](https://github.com/openai/codex)
- [本次观察的 openai/codex commit](https://github.com/openai/codex/tree/a2db6f97fb9353edfbcb82ea4fbb89c8346d1222)
- [OpenAI：Unlocking the Codex harness: how we built the App Server](https://openai.com/index/unlocking-the-codex-harness/)
- [OpenAI Academy：Plugins and skills](https://openai.com/academy/codex-plugins-and-skills/)
- [openai/codex issue #18404：bundled plugin 缓存目录的公开用户报告](https://github.com/openai/codex/issues/18404)
- [公开源码：feature gate 定义](https://github.com/openai/codex/blob/a2db6f97fb9353edfbcb82ea4fbb89c8346d1222/codex-rs/features/src/lib.rs)
- [公开源码：plugin loader](https://github.com/openai/codex/blob/a2db6f97fb9353edfbcb82ea4fbb89c8346d1222/codex-rs/core-plugins/src/loader.rs)
- [公开源码：plugin manifest 解析](https://github.com/openai/codex/blob/a2db6f97fb9353edfbcb82ea4fbb89c8346d1222/codex-rs/core-plugins/src/manifest.rs)
- [公开源码：macOS Seatbelt socket allowlist 测试](https://github.com/openai/codex/blob/a2db6f97fb9353edfbcb82ea4fbb89c8346d1222/codex-rs/sandboxing/src/seatbelt_tests.rs)
