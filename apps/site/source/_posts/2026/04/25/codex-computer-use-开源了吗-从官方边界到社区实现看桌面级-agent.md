---
title: "Codex Computer Use 开源了吗：从官方边界到社区实现看桌面级 Agent"
date: 2026-04-25 23:45:00
categories:
  - 技术
tags:
  - Codex
  - Computer Use
  - MCP
  - Agent
  - macOS
  - Accessibility
  - 源码解析
excerpt: "官方 Codex 已经发布 Computer Use，但截至 2026-04-25，openai/codex 开源的是 feature flag、plugin、tool_search 和 dynamic tool 接入边界，实际桌面执行器仍以 proprietary bundled plugin 形态分发。本文对照官方边界和社区实现，拆解 Computer Use 的通用工程形态。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

> 结论先行：截至 2026-04-25，我没有在官方 `openai/codex` 仓库里看到 Computer Use 桌面执行器的源码。官方开源的是 Codex Runtime 里的接入边界：feature flag、插件发现、tool_search 特判、Dynamic Tool/App Server 协议。真正控制 macOS 桌面的执行器，在我本机看到的是 `computer-use@openai-bundled` 插件包里的 proprietary app binary。

这并不等于 Computer Use 没有东西可分析。恰恰相反，官方仓库已经把它怎样接入 Codex 暴露得比较清楚；社区也出现了几类开源实现，可以帮助我们理解“桌面级 Agent”一般会怎样感知屏幕、定位元素、执行输入、回传证据，以及做权限和安全控制。

{% asset_img figure-01.svg 官方 Codex 仓库与 Computer Use 执行器的开源边界 %}

## 我核对了哪些来源

这篇文章基于下面几个观察点：

| 来源 | 我看的版本或状态 | 作用 |
| --- | --- | --- |
| [OpenAI 官方公告：Codex for almost everything](https://openai.com/index/codex-for-almost-everything/) | 2026-04-25 读取 | 确认官方已经把 Codex desktop app 和 background computer use 作为产品能力发布 |
| [openai/codex](https://github.com/openai/codex) | `a2db6f97fb9353edfbcb82ea4fbb89c8346d1222` | 确认官方仓库里开源的 feature、plugin、dynamic tool 边界 |
| 本机 Codex bundled plugin | `computer-use` 版本 `1.0.758`，license 标注为 `Proprietary` | 确认官方 Computer Use 执行器以二进制插件形式分发 |
| [openai/codex issue #16666](https://github.com/openai/codex/issues/16666) | 社区提案 | 说明社区对 native GUI tools 的接口形态和安全边界已有讨论 |
| [understudy-ai/codex-cua PR #3](https://github.com/understudy-ai/codex-cua/pull/3) | `82f5a63f68979226a74972d093221e84866fb757` | 看一个“内嵌到 Codex Rust core”的 GUI tools 实现 |
| [iFurySt/open-codex-computer-use](https://github.com/iFurySt/open-codex-computer-use) | `87d7bafe76aea867a8347dfa299fd68517151a82` | 看一个“独立 MCP server”的 Computer Use 实现 |
| [trycua/cua](https://github.com/trycua/cua) | `fa044d05ea16d59eecb64b326bfab93cb8201fca` | 看一个更偏底层、支持后台驱动的 macOS CUA driver 实现 |

所以本文的判断是：**官方实现没有完整开源，但官方接入层已经开源；社区实现可以作为原理参照，不能等同于 OpenAI 官方实现。**

## 官方仓库真正开源了什么

先看官方 `openai/codex`。如果只搜索“Computer Use”，能看到几个非常关键的边界点。

第一，`codex-rs/features` 里有稳定 feature gate。`ComputerUse` 被定义为 `Stable`，默认开启，注释说这是允许 Codex Computer Use 的要求侧开关。这个位置说明 Computer Use 已经进入 Codex Runtime 的正式能力矩阵，但它只是门禁，不是执行器。

第二，`codex-rs/core/src/plugins/discoverable.rs` 里有插件 allowlist，里面包含 `computer-use@openai-bundled`。这说明官方桌面版把 Computer Use 看作一个 bundled plugin，而不是把执行逻辑直接写在 Codex core 里。

第三，`tool_search` 对 `computer-use` 这个 MCP server 有单独处理。官方仓库里可以看到 `COMPUTER_USE_MCP_SERVER_NAME = "computer-use"`，并给它更高的 tool search limit。这意味着 Computer Use 工具数量和描述可能比普通动态工具更多，Codex 需要在懒加载工具时给它更大的检索预算。

第四，`app-server-protocol` 和 `core/tools/handlers/dynamic.rs` 暴露了动态工具调用链路。模型想调用某个动态工具时，Codex core 不直接执行，而是发出一个 `DynamicToolCallRequest`，由外部客户端或插件执行，再把文本、图片等 content item 回传给 Codex。

下面是官方 dynamic tool handler 逻辑的裁剪版，重点是看“模型工具调用”怎样变成“客户端工具执行请求”：

```rust
let event = EventMsg::DynamicToolCallRequest(DynamicToolCallRequest { // 构造一条发给客户端的动态工具请求事件
    call_id: call_id.clone(), // 用模型本轮工具调用的 call_id 做关联
    turn_id: turn_id.clone(), // 记录这次请求属于哪一轮 turn
    namespace: namespace.clone(), // 保留工具命名空间，方便插件或客户端分组
    tool: tool.clone(), // 记录实际要调用的工具名
    arguments: arguments.clone(), // 把模型生成的参数原样带给客户端执行器
}); // 完成请求事件构造
session.send_event(turn_context, event).await; // 通过 Codex 会话事件流把请求发给外部客户端
let response = rx_response.await.ok(); // 等待客户端把工具执行结果送回 Codex
```

这段边界代码非常重要。它告诉我们，Codex 对 Computer Use 的官方接入更像是“运行时协议 + 插件执行器”的组合：

1. 模型选择一个 Computer Use 工具，比如观察窗口、点击、输入或按键。
2. Codex core 把工具名和参数封装成 dynamic tool request。
3. 桌面 app 或 bundled plugin 接收请求，真正调用操作系统能力。
4. 执行器返回文本状态、截图或结构化内容。
5. Codex 把结果交给模型，模型继续下一步推理。

## 为什么说实际执行器没有开源

官方仓库里能看到 `computer-use` 这个名字，但看不到真正的 macOS 桌面控制实现。例如在官方 `openai/codex` 里，我没有找到类似 `AXUIElement`、`CGEvent`、`gui_observe`、`get_app_state` 执行逻辑这类典型桌面自动化代码。

再看本机 Codex 缓存的 bundled plugin，`plugin.json` 里写得更直接：

| 字段 | 观察到的内容 |
| --- | --- |
| `name` | `computer-use` |
| `version` | `1.0.758` |
| `license` | `Proprietary` |
| `description` | 在 macOS 上让 Codex 控制桌面应用 |
| `mcpServers` | 指向 `.mcp.json` |

`.mcp.json` 指向的是一个 macOS app bundle 里的 `SkyComputerUseClient` 可执行文件，并用 `mcp` 参数启动。插件目录下能看到 app bundle、二进制、图标和 manifest，但没有对应源码。

所以更准确的说法是：

> OpenAI 开源了 Codex 如何发现、加载、调用 Computer Use 工具的外壳和协议边界；没有开源官方 Computer Use 如何采集屏幕、读取无障碍树、模拟输入和处理后台窗口的执行器源码。

这个区分很关键。很多文章容易把“Codex 开源了”写成“Computer Use 也开源了”，但从目前证据看，这两个命题不是一回事。

## Computer Use 的通用闭环

无论官方执行器是否开源，Computer Use 的工程形态基本绕不开一个闭环：

{% asset_img figure-02.svg Computer Use 的观察、定位、执行、验证、安全闭环 %}

这个闭环里有五个核心环节。

**第一是观察。** 执行器要拿到目标应用的窗口截图、窗口尺寸、前台状态、无障碍树，最好还能知道哪个元素被选中或聚焦。截图给模型视觉上下文，无障碍树给模型结构化定位依据。

**第二是定位。** 最朴素的方式是坐标点击，但坐标对窗口移动、缩放、滚动非常敏感。更稳的方式是元素索引、accessibility element、语义 target，或者先让一个 grounding 模块把“右上角的搜索按钮”解析成可执行坐标。

**第三是执行。** 对按钮、菜单、输入框这类控件，优先用 Accessibility action 或 set value；对画布、拖拽、跨应用交互，往往需要底层 mouse/keyboard event。macOS 上常见路径是 `AXUIElement`、`CGEvent`、ScreenCaptureKit、`screencapture`，更激进的后台操作还可能用到 SkyLight 私有接口。

**第四是验证。** 每次点击或输入之后，都要重新观察。桌面自动化和浏览器 DOM 自动化不同，视觉状态可能被动画、弹窗、权限窗口、焦点抢占打断。没有 verify，Agent 很容易在错误状态里连续犯错。

**第五是安全。** Computer Use 会读屏幕、发键盘、点按钮，它天然比普通代码工具更敏感。一个可用的实现至少要有权限检查、目标 app 限制、截图隐私控制、资源锁、紧急停止，以及 secret 输入策略。

## 社区实现一：codex-cua 的内嵌式 GUI tools

`understudy-ai/codex-cua` 的 PR #3 不是官方实现，但它很适合作为“如果把 GUI tools 直接嵌进 Codex Rust core，会长什么样”的样本。

它在 tool registry 里根据配置注册一组 `gui_*` 工具，包括观察、点击、拖拽、滚动、输入、按键、移动和等待。下面是裁剪后的注册逻辑：

```rust
if config.gui_tools { // 只有开启 GUI tools 配置时才注册桌面工具
    plan.push_spec(create_gui_observe_tool_with_options(gui_options), false, config.code_mode_enabled); // 注册截图和语义观察工具
    plan.push_spec(create_gui_click_tool_with_options(gui_options), false, config.code_mode_enabled); // 注册语义点击工具
    plan.push_spec(create_gui_type_tool(), false, config.code_mode_enabled); // 注册文本输入工具
    plan.push_spec(create_gui_key_tool(), false, config.code_mode_enabled); // 注册键盘按键工具
    plan.register_handler("gui_observe", ToolHandlerKind::Gui); // 把 observe 请求交给 GUI handler
    plan.register_handler("gui_click", ToolHandlerKind::Gui); // 把 click 请求交给 GUI handler
} // GUI tools 注册结束
```

这条路线的特点是：GUI 能力是 Codex core 的一等工具。模型看到的是 `gui_observe`、`gui_click`、`gui_type` 这类内建工具，而不是外部 MCP 插件工具。

它的实现里有几个值得注意的点。

**语义优先，而不是坐标优先。** `gui_click` 默认不鼓励裸坐标，要求传入 `target` 描述，再由 grounding 流程根据截图和上下文解析目标位置。这和桌面 Agent 的可靠性目标一致：让模型描述“点哪个东西”，而不是硬背一个像素点。

**observe-act-verify 被写进系统提示。** `gui_instructions.rs` 要求模型每次动作后重新观察，优先用可见截图证据写 target，点不中时切换更复杂的 grounding mode。这等于把桌面自动化的运行纪律写进 prompt，而不是只靠模型自觉。

**平台层被抽象成 trait。** `GuiPlatform` 负责 readiness、权限检查、截图、观察、事件执行、cleanup 和 emergency monitor。这样 Rust core 不直接依赖 macOS API，具体平台逻辑藏在 `platform_macos.rs`、helper 和 provider 里。

**macOS helper 用 Swift 编译和缓存。** `platform_macos.rs` 会把 Swift helper 源码写入临时目录，按源码 hash 编译缓存，然后用 JSON-lines 和 helper 进程通信。Swift helper 里能看到 AppKit、ApplicationServices、CoreGraphics、Carbon 这些 macOS 桌面自动化常用框架。

**安全状态被封装成 session。** `GuiActionSession` 会做文件锁、conversation 绑定、隐藏和恢复其他 app、启动 emergency monitor，并在 drop 时清理输入状态、恢复 app、释放锁。Escape 急停也在这个层面处理。

这类内嵌式方案的优点是 Codex core 和 GUI 工具可以深度协同，系统提示、tool schema、执行策略和验证策略都能一起设计。代价是它侵入 Codex core，也更难独立复用到其他 Agent 客户端。

## 社区实现二：open-computer-use 的 MCP 外挂式服务

`iFurySt/open-codex-computer-use` 选择了另一条路线：把 Computer Use 做成独立 MCP server。它的 README 明确说这是一个 open-source Computer Use service，可以被 Codex、Claude、Gemini、opencode 等 MCP 客户端接入。

这条路线和官方 bundled plugin 的产品形态更像：Codex 不需要把 GUI handler 编进 core，只要发现一个 MCP server，然后调用它暴露的工具即可。

它的 dispatcher 基本就是一张“工具名到本地服务方法”的分发表：

```swift
switch name { // 根据 MCP tool 名称分发到本地 Computer Use 服务
case "get_app_state": // 读取目标应用的当前状态
    let app = requireString("app", in: arguments) // 从参数中取目标应用名
    return try service.getAppState(app: app) // 返回截图、无障碍树和元素索引
case "type_text": // 执行文本输入
    let app = requireString("app", in: arguments) // 取目标应用名
    let text = requireString("text", in: arguments) // 取要输入的文本
    return try service.typeText(app: app, text: text) // 把文本投递到目标应用
default: // 没有匹配到任何已注册工具
    throw ComputerUseError.unsupportedTool(name) // 抛出不支持的工具错误
} // 分发结束
```

它的关键模块也比较典型：

1. `AccessibilitySnapshot` 负责检查 Accessibility 权限，创建目标 app 的 `AXUIElement`，拿 focused window、focused element、selected text、无障碍树和截图。
2. `WindowCapture` 负责窗口截图，macOS 下用到 ScreenCaptureKit。
3. `InputSimulation` 负责点击、拖拽、滚动、输入和按键，既支持全局事件，也支持向目标 pid 投递事件。
4. `ComputerUseToolDispatcher` 把 MCP tool call 转成本地服务调用。

它暴露的接口和我们在 Codex 桌面环境里看到的 Computer Use 工具非常接近：`list_apps`、`get_app_state`、`click`、`scroll`、`drag`、`type_text`、`press_key`、`set_value`、`perform_secondary_action`。这种接口的好处是容易被多个模型客户端复用，坏处是 Agent 的语义 grounding 通常要在 MCP server 外部补齐，或者只能依赖元素索引和坐标。

## 社区实现三：cua-driver 的后台驱动路线

`trycua/cua` 里的 `cua-driver` 更偏底层。它的定位是 background computer-use driver，目标是驱动原生 macOS app 而不抢焦点。

从目录结构能看到它拆出了 Apps、Capture、Cursor、Focus、Input、Permissions、Windows 等模块，server 侧再暴露 `ListApps`、`GetWindowState`、`Click`、`TypeText`、`PressKey`、`Scroll`、`SetValue`、`Screenshot` 等工具。

这条路线的工程重点和前两者不完全一样。它更关心“后台窗口怎么收事件”“不抢焦点怎么输入”“怎么用窗口 ID 和 pid 精准投递”。因此它会用到 Accessibility、Screen Recording 权限，也会碰到 SkyLight 这类 macOS 私有 SPI。

它说明了 Computer Use 的一个现实：如果只做前台窗口操作，Accessibility 和 CGEvent 已经能覆盖很多需求；如果要做真正后台控制、避免抢焦点、跨窗口精确投递，系统私有能力和平台兼容风险就会快速上升。

{% asset_img figure-03.svg 三种 Computer Use 实现路线对比 %}

## 设计取舍：Computer Use 难在哪里

Computer Use 看起来像“截图加点击”，实际难点远不止这些。

**信息输入要互补。** 单靠截图，模型能看见界面，但很难知道控件层级、可点击区域和文本值；单靠无障碍树，模型能知道结构，但会丢掉视觉布局、图标状态和画布内容。靠谱实现一般会把截图、AX tree、窗口信息、焦点状态一起给模型。

**动作执行要分层。** 能用 `AXPress`、set value、menu action 时，应该优先用结构化动作；必须模拟鼠标键盘时，才退到 `CGEvent` 或 pid-targeted event。这样可以减少坐标漂移，也能降低误点风险。

**定位策略决定可靠性。** `element_index` 简单直接，适合从结构化树里点元素；坐标适合画布和非标准控件；语义 grounding 适合让模型说“点设置按钮”再由系统解析。不同定位方式不是互斥，而是要按场景组合。

**验证不是可选项。** 桌面 UI 有动画、弹窗、权限请求、输入法、系统通知、焦点变化。一次动作之后必须拿新状态，否则 Agent 很可能在旧截图上继续行动。

**安全边界要前置。** Computer Use 会接触用户屏幕和输入设备，权限、截图、剪贴板、密码输入都不能含糊。官方插件描述里也强调用户可以控制允许的 app、停止动作、管理截图训练偏好。社区实现里常见的文件锁、急停、secret env var、窗口排除，也都是为这个问题服务。

{% asset_img figure-04.svg macOS Computer Use 底层信号路径 %}

## 回到问题：Codex Computer Use 开源了吗

如果问题是“OpenAI 有没有把官方 Computer Use 执行器源码放进 `openai/codex`”，我的答案是：**没有看到。**

如果问题是“有没有开源代码能解释 Codex Computer Use 的实现原理”，答案是：**有，但要分层看。**

官方仓库提供的是接入层原理：

1. `ComputerUse` feature gate 说明能力被纳入 Codex Runtime。
2. `computer-use@openai-bundled` 说明官方把执行器作为 bundled plugin 发现和加载。
3. `tool_search` 特判说明 Computer Use 工具通过动态工具检索暴露给模型。
4. `DynamicToolCallRequest` 说明模型工具调用怎样穿过 Codex core 到达外部执行器。

社区仓库提供的是执行层原理：

1. `codex-cua` 展示了内嵌式 GUI tools、语义 grounding、observe-act-verify、平台抽象和安全 session。
2. `open-computer-use` 展示了 MCP server 形态下的截图、AX tree、元素索引和输入模拟。
3. `cua-driver` 展示了更底层的后台窗口驱动、pid 定向事件和平台权限处理。

所以一条准确的阅读路线应该是：先读官方 `openai/codex` 的 dynamic tool 和 plugin 边界，确认 Codex 怎么把工具调用交给外部服务；再读社区 Computer Use 项目，理解外部服务如何用操作系统 API 完成观察、定位、执行和验证。

## 参考资料

- OpenAI 官方公告：[Codex for almost everything](https://openai.com/index/codex-for-almost-everything/)
- 官方 Codex 仓库：[openai/codex](https://github.com/openai/codex)
- 官方 dynamic tool handler：[dynamic.rs](https://github.com/openai/codex/blob/a2db6f97fb9353edfbcb82ea4fbb89c8346d1222/codex-rs/core/src/tools/handlers/dynamic.rs#L78-L141)
- 官方 Computer Use feature gate：[features/src/lib.rs](https://github.com/openai/codex/blob/a2db6f97fb9353edfbcb82ea4fbb89c8346d1222/codex-rs/features/src/lib.rs#L167-L170)
- 官方 bundled plugin allowlist：[discoverable.rs](https://github.com/openai/codex/blob/a2db6f97fb9353edfbcb82ea4fbb89c8346d1222/codex-rs/core/src/plugins/discoverable.rs#L14-L24)
- 社区提案：[openai/codex issue #16666](https://github.com/openai/codex/issues/16666)
- 社区内嵌式实现：[understudy-ai/codex-cua PR #3](https://github.com/understudy-ai/codex-cua/pull/3)
- 社区 MCP 实现：[iFurySt/open-codex-computer-use](https://github.com/iFurySt/open-codex-computer-use)
- 社区后台驱动：[trycua/cua](https://github.com/trycua/cua)
