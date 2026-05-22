---
title: "Codex Appshot 实现原理：左右 Command 如何变成输入框截图"
date: "2026-05-22 15:40:00"
categories:
  - 技术
tags:
  - Codex
  - Electron
  - macOS
  - Appshot
  - Computer Use
excerpt: "从本机 Codex Desktop 26.519.31651 的 app bundle 出发，拆解左右 Command 触发 Appshot 的链路：bare modifier monitor 如何监听裸修饰键、Electron 主进程如何转成 appshot-shortcut、Computer Use 服务如何完成截图与辅助功能文本采集，最后为什么输入框里出现的是 composer attachment。"
cover: "cover-v1.svg"
coverPosition: "below-title"
---

## 摘要

最近我注意到 Codex 里有一个很顺手的入口：**同时按下左右两个 Command，会截取当前屏幕，并把这次截图放进 Codex 输入框里**。这个交互看起来像普通快捷键，但实现上其实绕过了很多常规路径。

先给结论：

1. 左右 Command 不是普通的 `globalShortcut`，而是一个 `bare modifier key` 组合。
2. Codex Desktop 在主进程里把 `leftcommand+rightcommand` 归一成 `DoubleCommand`。
3. 真正监听按键的是一个原生 helper：`bare-modifier-monitor`。
4. helper 通过 macOS 全局事件监听 `flagsChanged`，把 `down` / `up` 等状态写到 stdout。
5. Electron 主进程读到 `down` 后，会给当前窗口发 `appshot-shortcut`。
6. 渲染进程收到这个消息后，走 appshot 捕获流程，把结果作为 `composer attachment` 挂进输入框。
7. 截图和辅助功能文本不是 Electron 自己直接拿的，而是交给 `Codex Computer Use.app` 这个后台服务。

{% asset_img figure-01.svg %}

本文观察对象是我本机安装的 Codex Desktop：

| 项 | 值 |
| --- | --- |
| App | `/Applications/Codex.app` |
| 版本 | `26.519.31651` |
| Electron bundle | `Contents/Resources/app.asar` |
| 按键 helper | `Contents/Resources/native/bare-modifier-monitor` |
| Computer Use 服务 | `~/.codex/computer-use/Codex Computer Use.app` |

需要先说明边界：这里不是官方源码解析，而是基于本机 app bundle、asar 产物、Mach-O 符号和字符串做的行为还原。主进程、worker、原生 helper、Computer Use 服务这几层能确认；渲染进程里“具体哪个 React reducer 把截图插进 composer”的代码在本地包里不可读到足够完整，所以我会把那部分标成推断。

## 0. 先把两个词讲清楚

这次最容易卡住的是两个词：`bare modifier key` 和 `composer attachment`。

`bare modifier key` 指的是**单独按修饰键本身就触发动作**。比如只按左 Command、只按右 Option，或者同时按左右 Command。它和 `Command + K` 这种普通快捷键不同：普通快捷键有一个非修饰键 `K`，系统可以通过常规 keydown 组合识别；裸修饰键只有 modifier flag 变化，没有真正的字符键。

所以 Codex 不能只靠 Electron 的普通快捷键注册。它需要盯住 macOS 事件里的 `modifierFlags`，判断左 Command 和右 Command 是否同时处在按下状态。

`composer attachment` 指的是**输入框里的附件对象**。这里的 composer 就是 Codex 底部输入区域；attachment 则可以是图片、文件、appshot、辅助功能文本等结构化内容。按下左右 Command 后，Codex 不是把一长串 base64 文字塞进 textarea，而是把捕获结果作为附件挂到这次待发送消息上。UI 上看起来像“输入框里多了一张截图卡片”，数据结构上更像：

```text
composer
  text: 用户输入的正文
  attachments[]
    type: appshot
    screenshot: data:image/png;base64,...
    axText: 当前前台窗口的辅助功能文本
```

这两个词合起来，就能解释这个功能的产品形态：**裸修饰键负责低摩擦触发，composer attachment 负责把屏幕状态变成模型可消费的上下文**。

## 1. 为什么不是普通快捷键

如果快捷键是 `Command + Shift + 4`，Electron 可以走更标准的键盘 shortcut 体系。但“左右 Command 同时按”不是这种形态。

我在 `app.asar` 解出来的主进程 bundle 里能看到一张别名表，大意是把多种写法都收敛到同一个内部值：

| 用户/配置写法 | 内部值 |
| --- | --- |
| `leftcommand+rightcommand` | `DoubleCommand` |
| `leftcmd+rightcmd` | `DoubleCommand` |
| `leftmeta+rightmeta` | `DoubleCommand` |
| `leftcommand` | `LeftCommand` |
| `rightcommand` | `RightCommand` |
| `leftoption+rightoption` | `DoubleOption` |

默认 appshot 热键就是 `DoubleCommand`。这说明 Codex 把“左右 Command”当成一个特殊的裸修饰键，而不是普通 accelerator。

裁剪成可读伪代码，大概是这样：

```js
const defaultHotkey = "DoubleCommand"; // 默认把左右 Command 作为 appshot 入口
const hotkey = state.get("appshotHotkey") ?? defaultHotkey; // 读取用户配置，没有配置就使用默认值
const monitor = registerBareModifier(hotkey, { // 为裸修饰键启动原生监听器
  onPressed() { // 当 helper 报告 down 事件时进入这里
    focusComposerIfNeeded(); // 如果 Codex 窗口刚才不在前台，就先回到输入页
    sendToRenderer({ type: "appshot-shortcut" }); // 把 appshot 快捷键信号发给渲染进程
  }, // onPressed 回调结束
}); // 裸修饰键注册完成
```

这里的关键不是 `sendToRenderer`，而是 `registerBareModifier` 背后并没有调用普通的 `globalShortcut.register("Command+...")`。它会启动一个随 app 打包的原生二进制。

## 2. bare-modifier-monitor：专门监听裸修饰键的小进程

Codex app bundle 里有一个文件：

```text
/Applications/Codex.app/Contents/Resources/native/bare-modifier-monitor
```

它是一个 macOS Mach-O 可执行文件。通过 `strings` 可以看到它暴露的命令行用法：

```bash
bare-modifier-monitor --key DoubleCommand --immediate # 监听左右 Command，一旦满足条件就立刻输出 down
bare-modifier-monitor --key LeftCommand --trigger-on-release # 监听左 Command，等释放时再触发动作
```

它支持的 key 包括：

| key | 含义 |
| --- | --- |
| `LeftCommand` | 只监听左 Command |
| `RightCommand` | 只监听右 Command |
| `DoubleCommand` | 同时监听左右 Command |
| `LeftOption` | 只监听左 Option |
| `RightOption` | 只监听右 Option |
| `DoubleOption` | 同时监听左右 Option |

`nm` 里还能看到一些很直白的 Swift / AppKit 符号：`BareModifierMonitorSession`、`BareModifierKey`、`handleModifierFlagsChanged`、`leftCommandModifierMask`、`rightCommandModifierMask`、`installKeyDownMonitorIfNeeded`。这些名字基本把职责写在脸上了。

{% asset_img figure-02.svg %}

抽象成伪代码，它做的事像这样：

```swift
let mask = NSEvent.EventTypeMask.flagsChanged // 只关心修饰键状态变化
NSEvent.addGlobalMonitorForEvents(matching: mask) { event in // 注册 macOS 全局事件监听器
  let flags = event.modifierFlags // 从事件里读取当前 modifierFlags
  let leftDown = flags.contains(leftCommandMask) // 判断左 Command 是否处于按下状态
  let rightDown = flags.contains(rightCommandMask) // 判断右 Command 是否处于按下状态
  if leftDown && rightDown { print("down") } // 左右 Command 同时按下时向 stdout 写 down
} // 全局修饰键监听回调结束
```

Electron 主进程启动这个 helper 后，会逐行读 stdout。观察到的状态值包括：

| stdout 行 | 主进程含义 |
| --- | --- |
| `ready` | helper 已经启动，可以开始监听 |
| `down` | 目标裸修饰键进入触发状态 |
| `up` | 目标裸修饰键释放 |
| `permission-denied` | macOS 权限不足，无法监听 |

也就是说，这个功能的第一段链路是一个很经典的“Electron 壳 + 原生 helper”组合：Electron 负责产品状态和窗口通信，原生 helper 负责系统级输入事件。

## 3. 从按键到 appshot-shortcut

主进程拿到 `down` 之后，不会直接截图。它先做窗口和路由处理，然后发一个语义化消息给渲染进程。

这里有一个细节很有意思：如果 Codex 主窗口在最近一段时间没有获得焦点，主进程会先把窗口带回到输入页，并带上一个 `focusComposerNonce`。也就是说，左右 Command 不只是“截图”，还隐含着“回到可以输入和附加上下文的位置”。

简化后的链路是：

```js
if (line === "down") { // helper 在 stdout 写出 down
  const win = windowManager.getPrimaryWindow(); // 找到 Codex 当前主窗口
  if (!wasFocusedRecently(win)) focusComposer(win); // 主窗口不在最近焦点里时先聚焦输入框
  win.webContents.send("message", { type: "appshot-shortcut" }); // 发送给渲染进程的语义事件
} // down 事件处理结束
```

这里的 `appshot-shortcut` 是一个边界点。它把系统输入层和 UI 层解耦了：

- 主进程不需要知道 composer 里有几个 attachment。
- 渲染进程不需要知道 macOS 左右 Command 的 modifier mask。
- 后续如果入口换成菜单、按钮或别的快捷键，只要也发同一个语义事件就可以复用捕获流程。

这一层还有一个 `preload` bridge。Codex 的 preload 会把主进程消息转成浏览器里的 `MessageEvent`，类似：

```js
ipcRenderer.on("message", (_event, data) => { // preload 收到主进程消息
  window.dispatchEvent(new MessageEvent("message", { data })); // 转成 renderer 可以订阅的 window message
}); // preload 桥接结束
```

所以渲染层看到的不是“某个二进制输出了 down”，而是一个干净的 UI 事件：`type: "appshot-shortcut"`。

## 4. 截图不是主进程直接截：Computer Use 服务接管

接下来才进入 appshot 捕获。

主进程里可以看到两个相关 IPC：

| IPC | 作用 |
| --- | --- |
| `computer-use-frontmost-window` | 读取当前前台窗口信息 |
| `computer-use-start-capture` | 启动一次捕获流程 |

`start-capture` 后，主进程会启动一个 worker。worker 再通过 Apple Events 跟一个后台 app 通信：

```text
~/.codex/computer-use/Codex Computer Use.app
```

这个后台 app 的 bundle id 是：

```text
com.openai.sky.CUAService
```

它是一个 `LSUIElement=1` 的菜单栏/后台型 app，真正的可执行文件叫 `SkyComputerUseService`。`otool` 和符号里能看到它链接了 `ScreenCaptureKit.framework`、`CoreGraphics`、`ApplicationServices`、`AppKit`，并调用了 `AXIsProcessTrusted`、`CGPreflightScreenCaptureAccess`、`SCScreenshotManager`、`SCShareableContent`、`SCWindow` 等系统 API。

也就是说，截图和辅助功能文本采集是这个后台服务完成的，不是 Electron 主进程自己用一段 JS 截屏。

{% asset_img figure-03.svg %}

这一段可以还原成这样的流程：

```js
const request = { app: bundleIdentifier, animationTarget, requestId }; // worker 构造一次捕获请求
sendAppleEvent("ComputerUseIPCAppStartCaptureRequest", request); // 通过 Apple Event 请求后台服务开始捕获
const update = await nextCaptureUpdate(requestId); // 继续拉取这次捕获的增量更新
if (update.type === "screenshot") { // 如果后台服务返回截图更新
  const dataURL = readSafeImage(update.fileURL); // 校验并读取临时目录里的图片文件
  postMessage({ type: "screenshot", screenshotDataURL: dataURL }); // 把截图 data URL 回传给渲染进程
} // 截图更新处理结束
```

worker 对返回文件做了安全校验，这点也值得注意：

| 校验 | 目的 |
| --- | --- |
| 必须是 `file://` | 避免把任意远程 URL 当作本地截图读取 |
| 必须位于 `/tmp/com.openai.sky.CUAService` | 限定 Computer Use 服务的临时输出目录 |
| 扩展名必须是 `.png` / `.jpg` / `.jpeg` | 限定图片类型 |
| 文件大小不能超过约 25 MB | 避免异常大文件进入 renderer |

捕获更新不只有截图。worker 的更新类型还包括：

| update | 内容 |
| --- | --- |
| `metadata` | 捕获元信息 |
| `axText` | macOS Accessibility 树里提取出的文本 |
| `screenshot` | 图片路径和转换后的 data URL |
| `completed` | 捕获完成和过渡快照 |
| `failed` | 捕获失败原因 |

这解释了为什么 appshot 比“普通截图”更适合给 agent 用：它不只是一张图，还可能携带可访问性文本。模型既能看像素，也能读 UI 文本结构。

## 5. 为什么最后是 attachment，而不是 textarea 文本

当渲染进程收到 capture update 后，UI 要做的不是把图片内容插进输入框字符串，而是更新 composer 状态。

这一层本地包里没有完整可读的 React reducer，但从 UI 文案和主进程消息能确认产品模型。locale 字符串里有这些 key：

| key | 说明 |
| --- | --- |
| `appshotAttachment.accessibilityTextPreviewTitle` | appshot 附件可以展示辅助功能文本预览 |
| `appshotAttachment.showVisualPreview` | 可以切换视觉截图预览 |
| `appshotAttachment.showAccessibilityText` | 可以切换辅助功能文本 |
| `appshotAttachment.viewAccessibilityText` | 可以查看辅助功能文本详情 |

所以更合理的状态流是：

```js
const attachment = { // 构造一个输入框附件对象
  type: "appshot", // 标记这是一次 appshot 捕获
  screenshotDataURL, // 保存截图 data URL，用于视觉预览和发送上下文
  accessibilityText, // 保存辅助功能文本，用于补充 UI 语义
}; // appshot attachment 构造结束
composer.attachments.push(attachment); // 把附件挂到当前 composer，而不是写入 textarea
```

这就是 `composer attachment` 的意义。textarea 只适合保存用户正在输入的自然语言；截图、文件、网页、appshot 这种内容需要保留类型、预览、删除按钮、上传状态和发送时的序列化方式。把它们做成附件，后续模型请求也更容易区分“用户正文”和“附加上下文”。

## 6. 权限和开关：为什么它有时不会触发

这条链路涉及至少三类 macOS 能力：

| 权限/能力 | 用途 |
| --- | --- |
| 输入监听或辅助功能相关能力 | 让 helper 能观察全局裸修饰键状态 |
| Screen Recording | 允许 Computer Use 服务截取屏幕内容 |
| Accessibility | 允许 Computer Use 服务读取前台窗口 UI 文本 |

`Codex Computer Use.app` 里能看到一段很直接的权限说明：

```text
Codex needs these permissions to take appshots.
Appshots are captured when you attach from the + menu or press both command keys simultaneously.
```

这句话把两个入口也说清楚了：appshot 不只来自左右 Command，也可以来自输入框的 `+` 菜单。左右 Command 只是更快的入口。

{% asset_img figure-04.svg %}

另外，主进程里还有 `appshotsEnabled` 这样的功能开关，以及一个管理 Computer Use 服务的类。它会确保后台服务存在、启停服务，并把 appshot 能力和 app 状态绑在一起。也就是说，这不是一个孤立脚本，而是桌面 app 的正式能力模块。

## 7. 这套设计值得学的地方

我觉得这个实现最值得学的不是“怎么截屏”，而是它把一个很复杂的跨层功能拆得很干净。

第一，触发层很薄。裸修饰键监听只负责输出 `down` / `up`，不掺杂截图逻辑。这样 helper 很容易测试，也容易替换。

第二，主进程只做编排。它负责配置、窗口、路由和 IPC，不直接持有截图实现。Electron 里最容易变乱的地方，就是把系统 API、业务状态和 UI 操作全塞在一起；Codex 这里把边界分得比较明确。

第三，截图能力交给独立服务。ScreenCaptureKit、Accessibility、Apple Events、权限弹窗这些都放在 `Codex Computer Use.app` 里，Electron app 只消费捕获结果。这样权限和系统 API 的复杂度不会污染 renderer。

第四，输入框只接收 attachment。appshot 本质上是多模态上下文，不是文本。把它抽象成 composer attachment，UI 才能自然支持预览、删除、切换视觉/文本视图和发送时序列化。

最后用一张文字链路收束：

```text
左右 Command
  -> bare-modifier-monitor 监听 modifierFlags
  -> stdout: down
  -> Electron main 收到裸修饰键事件
  -> renderer message: appshot-shortcut
  -> computer-use-start-capture
  -> worker 通过 Apple Events 调用 Codex Computer Use 服务
  -> ScreenCaptureKit 截图 + Accessibility 文本
  -> capture update 回到 renderer
  -> composer 增加 appshot attachment
```

这就是“左右 Command 变成输入框截图”的核心机制：它不是一个单点魔法，而是一条从 macOS 输入事件、Electron 主进程、后台系统服务到 composer 状态管理的产品链路。
