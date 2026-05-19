---
title: "Codex App 远程控制实现原理：从云端 Relay 到 App Server"
date: 2026-05-19 12:20:00
categories:
  - 技术
tags:
  - Codex
  - OpenAI
  - App Server
  - Remote Control
  - WebSocket
  - Agent
excerpt: "Codex App 的跨设备连接不是手机直连电脑，而是本机 App Server 主动连到 ChatGPT 云端 relay。本文基于官方文章和 openai/codex 的 remote_control 源码，拆解 enrollment、WebSocket、分片、ack、客户端复用和安全边界。"
cover: "cover-v1.svg"
coverPosition: "below-title"
---

## 摘要

先给结论：

**Codex App 和 PC / Mac 之间的跨设备连接，公开源码里已经能看到本机侧实现，但看不到云端 relay 服务端的完整实现。**

更准确地说，OpenAI 公开了三层材料：

- 官方产品文章解释了“从任意设备继续用 Codex”的产品形态：手机端可以连接正在运行 Codex 的机器，文件、凭据和本地环境仍留在那台机器上，中间通过安全 relay 转发状态和指令。
- 官方 App Server 文章解释了 Codex 如何把桌面 App、IDE、Web runtime 等不同界面收敛到同一个本地 harness 上。
- `openai/codex` 仓库里已经出现了 `remote_control` 传输层源码，能看到本机 App Server 如何 enroll 到云端、如何建立 WebSocket、如何把远端客户端消息转成 App Server 的 JSON-RPC 连接。

所以这篇文章不会假装“云端 relay 服务端也开源了”。它要做的是把公开部分拆清楚：

1. 什么是 relay，它在链路里到底转发什么。
2. 本机 App Server 为什么是整个远程控制的执行端。
3. `remote_control` 源码里如何完成 enrollment、鉴权、WebSocket 建连、分片、ack 和重连。
4. 手机端或 Web 端的消息如何被映射成本机 App Server 的 `thread/start`、`turn/start`、`item/*` 事件流。
5. 哪些安全边界能从源码确认，哪些仍然只能等官方公开。

本文观察范围：

- 官方文章：[Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)
- 官方文章：[Unlocking Codex with the App Server](https://openai.com/index/unlocking-the-codex-harness/)
- 仓库：[openai/codex](https://github.com/openai/codex)
- 观察 commit：[`80fdd4688f6fa8143488c206d4c14dc193905254`](https://github.com/openai/codex/tree/80fdd4688f6fa8143488c206d4c14dc193905254)
- 观察日期：2026-05-19

{% asset_img figure-01.svg %}

## 0. 先把几个词讲清楚

这套机制里最容易混在一起的是四个词：Codex App、App Server、remote control、relay。

**Codex App** 是用户看到的桌面工作台。它负责展示线程、diff、终端、浏览器、审批和多 agent 状态。

**App Server** 是本机真正承载 Codex 任务的服务层。官方 App Server README 说它是 Codex 用来支撑 VS Code 扩展等富界面的接口，协议是 JSON-RPC 2.0。它暴露的核心对象是 `Thread`、`Turn`、`Item`：

- `Thread`：一条连续会话。
- `Turn`：一次用户输入到模型完成输出的执行轮次。
- `Item`：这一轮里的最小事件，例如用户消息、agent 输出、命令、文件修改、审批请求。

**Remote Control** 是公开源码里本机 App Server 的一个传输层。它不是一个新的 agent，而是让远端客户端也能像本地 IDE / App 一样，接入同一个 App Server。

**Relay** 是云端中转层。它不等于把你的项目搬到云端执行，而是负责让手机、Web 或其他受信任界面和本机 App Server 互相找到、互相转发消息。你的电脑通常在 NAT 或防火墙后面，relay 的价值就是让本机主动发起出站连接，不需要暴露一个公网端口。

换句话说，链路不是：

```text
手机直接连电脑公网端口
```

而更像：

```text
手机 / Web 客户端
  -> ChatGPT 云端 relay
  -> 本机 Codex App Server
  -> 本机项目、终端、浏览器、Git
```

## 1. 公开到什么程度：源码边界在哪里

这次能找到的公开源码，最关键的目录是：

```text
codex-rs/app-server-transport/src/transport/remote_control/
```

里面有这些文件：

| 文件 | 作用 |
| --- | --- |
| `protocol.rs` | 定义远程控制 envelope、client event、server event，并把 relay URL 规范化成 enroll / websocket 地址 |
| `enroll.rs` | 本机服务向云端注册 remote-control server，拿到 `server_id` 和 `environment_id` |
| `websocket.rs` | 建立远程控制 WebSocket，负责重连、鉴权恢复、ping/pong、seq、ack、出站缓存 |
| `segment.rs` | 对大消息做分片、base64 编码和重组，避免单帧过大 |
| `client_tracker.rs` | 把远端的 `(client_id, stream_id)` 映射成本机 App Server 的连接 |
| `mod.rs` | 启停 remote control，维护连接状态，向 App Server 暴露 handle |

同时也能看到相关的上层入口：

| 文件 | 作用 |
| --- | --- |
| `codex-rs/app-server/src/request_processors/remote_control_processor.rs` | 实现 `remoteControl/enable`、`remoteControl/disable`、`remoteControl/status/read` |
| `codex-rs/app-server-daemon/src/remote_control_client.rs` | daemon 通过本地 socket 启用 remote control |
| `codex-rs/cli/src/remote_control_cmd.rs` | `codex remote-control` 命令入口 |
| `codex-rs/state/src/runtime/remote_control.rs` | 把 enrollment 信息持久化到本机 SQLite |

但没有公开的是：

- ChatGPT relay 服务端的实现。
- 手机 App / Web UI 如何选择某台机器的完整前端逻辑。
- 设备授权、撤销、推送通知、账号后台策略的服务端细节。
- 桌面 App 自身 UI 壳的全部源码。

所以本文的边界很明确：**我们能解析本机侧 remote-control client 和 App Server 如何接入 relay；不能把云端 relay 服务端说成已开源。**

{% asset_img figure-02.svg %}

## 2. App Server：为什么远程控制最后会落到 JSON-RPC

Codex 不是让手机直接发 shell 命令到电脑。公开 App Server 协议里，所有富客户端都是通过一套 JSON-RPC 连接和本机运行时交互。

App Server 支持多种本地传输：

```rust
pub enum AppServerTransport { // 定义 App Server 可以监听的传输入口
    Stdio, // 通过标准输入输出传输 JSON-RPC 消息
    UnixSocket { socket_path: AbsolutePathBuf }, // 通过本机 Unix socket 暴露控制面
    WebSocket { bind_address: SocketAddr }, // 通过实验性 WebSocket 监听地址
    Off, // 不暴露本地传输入口
} // AppServerTransport 枚举结束
```

这段裁剪自 `codex-rs/app-server-transport/src/transport/mod.rs`，它解释了一个关键点：App Server 本来就是多客户端的。VS Code、桌面 App、本地 socket 客户端都可以接入，只要它们遵守同一套 JSON-RPC 协议。

远程控制只是再加一类连接来源：

```rust
pub enum ConnectionOrigin { // 标记一个 App Server 连接来自哪里
    Stdio, // 来自标准输入输出
    InProcess, // 来自进程内客户端
    WebSocket, // 来自本地 WebSocket 监听器
    RemoteControl, // 来自云端 relay 转发过来的远程客户端
} // ConnectionOrigin 枚举结束
```

这就把问题简化了：

- 本机 App Server 已经会处理 `initialize`、`thread/start`、`turn/start`、`turn/interrupt` 等请求。
- 也已经会流式发回 `item/started`、`item/completed`、`command/exec/outputDelta`、`turn/completed` 等通知。
- remote control 只需要把远端客户端的消息变成一条普通 App Server 连接。

这也是它不像传统远程桌面的地方。它传的不是屏幕像素流，而是 Codex App Server 的结构化事件流。

## 3. 启用 remote control：本机先准备一条出站长连接

`codex-rs/app-server/src/lib.rs` 里可以看到 App Server 启动时会根据运行选项决定是否启用 remote control。真正启动远程控制的是 `start_remote_control`：

```rust
let remote_control_enabled = remote_control_requested && state_db.is_some(); // 只有请求开启且 SQLite 状态库可用时才真的开启
let (accept_handle, remote_control_handle) = start_remote_control( // 启动远程控制传输任务
    RemoteControlStartConfig { // 构造远程控制启动配置
        remote_control_url: config.chatgpt_base_url.clone(), // relay 基础地址来自 ChatGPT 后端地址
        installation_id: installation_id.clone(), // 使用本机安装 ID 标识这台 Codex 安装
    }, // 启动配置结束
    state_db.clone(), // 传入 SQLite 状态库用于保存 enrollment
    auth_manager.clone(), // 传入 ChatGPT 鉴权管理器
    transport_event_tx.clone(), // 传入 App Server 内部 transport 事件通道
    transport_shutdown_token.clone(), // 传入关闭信号
    app_server_client_name_rx, // 传入客户端名称，用于 enrollment 维度隔离
    remote_control_enabled, // 传入初始启用状态
).await?; // 等待远程控制任务启动完成
```

这段代码透露出几个设计取舍。

第一，remote control 依赖 SQLite state DB。原因不是“必须有数据库才能联网”，而是 enrollment 需要被持久化。机器 enroll 以后会拿到 `server_id` 和 `environment_id`，下次重连要复用。

第二，它用的是 ChatGPT auth。`websocket.rs` 里明确拒绝 API key auth：remote control 需要 ChatGPT 账号登录态。这很合理，因为跨设备控制本质上是“账号下的受信任设备”能力，而不是普通 OpenAI API 调用。

第三，本机是主动连接方。无论手机在哪里，电脑都不需要开放公网端口。App Server 通过出站 HTTPS / WSS 连接 ChatGPT relay。

## 4. URL 规范化：只接受 ChatGPT 或本地测试地址

`protocol.rs` 里有一个非常直接的安全边界：remote control URL 不是随便给一个域名就能连。

公开源码会接受：

- `https://chatgpt.com/...`
- `https://*.chatgpt.com/...`
- `https://chatgpt-staging.com/...`
- `https://*.chatgpt-staging.com/...`
- 本地测试用的 `localhost` HTTP / HTTPS

规范化以后，它会拼出两个地址：

```rust
let enroll_url = remote_control_url.join( // 从基础 URL 拼出注册端点
    "wham/remote/control/server/enroll", // 注册本机 remote-control server 的路径
)?; // enroll URL 拼接结束
let websocket_url = remote_control_url.join( // 从基础 URL 拼出 WebSocket 端点
    "wham/remote/control/server", // 远程控制长连接路径
)?; // websocket URL 拼接结束
```

这解释了 relay 的第一层样子：

```text
POST /backend-api/wham/remote/control/server/enroll
WSS  /backend-api/wham/remote/control/server
```

这里的 `/backend-api/` 来自 ChatGPT 后端基础地址，路径后半段由 `normalize_remote_control_url` 拼出来。测试里也能看到同样的期望路径：`/backend-api/wham/remote/control/server/enroll`。

这个限制有两个好处：

- 默认不会把本机 Codex remote control 连到任意第三方 relay。
- 本地开发和测试仍然能用 `localhost` mock relay。

## 5. Enrollment：让云端知道“这台机器是谁”

remote control 建连前先 enroll。`enroll.rs` 里定义了本机发给 relay 的注册请求：

```rust
let request = EnrollRemoteServerRequest { // 构造本机注册到 relay 的请求体
    name: server_name.to_string(), // 上报本机名称，通常来自 hostname
    os: std::env::consts::OS, // 上报操作系统类型
    arch: std::env::consts::ARCH, // 上报 CPU 架构
    app_server_version: env!("CARGO_PKG_VERSION"), // 上报 App Server 版本
    installation_id: installation_id.to_string(), // 上报本机 Codex 安装 ID
}; // 注册请求体构造结束
```

请求还会带上几类 header：

- ChatGPT auth headers。
- `chatgpt-account-id`。
- `x-codex-installation-id`。

云端返回的是：

- `server_id`：relay 侧给这台 remote-control server 分配的 ID。
- `environment_id`：暴露给客户端选择机器 / 环境的 ID。

本机随后把 enrollment 写入 SQLite：

```sql
INSERT INTO remote_control_enrollments ( -- 插入或更新本机远程控制 enrollment
    websocket_url, -- relay websocket 地址
    account_id, -- ChatGPT 账号 ID
    app_server_client_name, -- App Server 客户端名称
    server_id, -- relay 返回的 server ID
    environment_id, -- relay 返回给客户端识别环境的 ID
    server_name, -- 本机名称
    updated_at -- 本地更新时间戳
) VALUES (?, ?, ?, ?, ?, ?, ?) -- SQLite 参数占位
ON CONFLICT(websocket_url, account_id, app_server_client_name) DO UPDATE SET -- 同一账号和客户端名下重复注册时更新
    server_id = excluded.server_id, -- 更新 server ID
    environment_id = excluded.environment_id, -- 更新 environment ID
    server_name = excluded.server_name, -- 更新机器名称
    updated_at = excluded.updated_at; -- 更新时间戳
```

这张表的主键是：

```text
(websocket_url, account_id, app_server_client_name)
```

它说明 Codex 不是只按“机器”维度保存连接，而是至少按 relay 地址、账号、客户端名称三个维度隔离。账号换了，源码会清理内存中的旧 enrollment；WebSocket 返回 404 时，也会认为本地 enrollment 过期并清掉后重新 enroll。

{% asset_img figure-03.svg %}

## 6. WebSocket：relay 不是一次请求，而是一条可恢复的数据通道

Enrollment 之后，本机 App Server 会向 relay 建立 WebSocket。

建连请求会带这些 header：

- `x-codex-server-id`：enrollment 得到的 server ID。
- `x-codex-name`：base64 编码后的机器名称。
- `x-codex-protocol-version`：公开源码里当前是 `3`。
- ChatGPT auth headers。
- `chatgpt-account-id`。
- `x-codex-installation-id`。
- `x-codex-subscribe-cursor`：可选，用于断线后从上次 cursor 继续订阅。

可以把它理解成：

```rust
set_header("x-codex-server-id", enrollment.server_id); // 告诉 relay 当前连接属于哪个已注册 server
set_header("x-codex-protocol-version", "3"); // 告诉 relay 使用 remote-control 协议版本 3
set_header("chatgpt-account-id", auth.account_id); // 告诉 relay 当前 ChatGPT 账号 ID
set_header("x-codex-installation-id", installation_id); // 告诉 relay 当前本机安装 ID
set_header("x-codex-subscribe-cursor", cursor); // 断线重连时携带订阅游标
```

真正跑起来以后，`websocket.rs` 里分成两个循环：

- writer：把本机 App Server 产生的 server event 发到 relay。
- reader：从 relay 读取远端客户端发来的 client event。

writer 侧有一个 `BoundedOutboundBuffer`。它按 `(client_id, stream_id)` 缓存已经发出但还没被远端 ack 的 `ServerEnvelope`。如果 WebSocket 断了，重连后会先把未确认的 envelope 重新发出去。

reader 侧会处理几种消息：

| 类型 | 含义 |
| --- | --- |
| `ClientMessage` | 一个完整 JSON-RPC 消息 |
| `ClientMessageChunk` | 一个被分片的 JSON-RPC 消息片段 |
| `Ack` | 远端确认已经收到某个 server envelope |
| `Ping` | 远端保活 |
| `ClientClosed` | 远端关闭客户端流 |

这就是 relay 比普通 HTTP 转发复杂的地方：它要承受移动端网络切换、Web 页面刷新、消息较大、连接重建等情况。源码里因此有 seq、cursor、ack、chunk、ping/pong 和指数退避重连。

## 7. 分片与 ack：为什么需要自己做一层 envelope

App Server 的事件有时会很大，例如：

- 一段较长的终端输出。
- 大 diff。
- 多个 item 的历史恢复。
- 含 base64 内容的文件或进程输出事件。

`segment.rs` 里设置了几个上限：

| 常量 | 数值 | 含义 |
| --- | --- | --- |
| `REMOTE_CONTROL_SEGMENT_TARGET_BYTES` | 100 KB | 目标分片大小 |
| `REMOTE_CONTROL_SEGMENT_MAX_BYTES` | 150 KB | 单个分片最大 wire size |
| `REMOTE_CONTROL_REASSEMBLED_MAX_BYTES` | 100 MB | 重组后的消息最大大小 |
| `REMOTE_CONTROL_SEGMENT_COUNT_MAX` | 1024 | 单条消息最多分片数 |

服务端发给 relay 的 envelope 也带 seq：

```rust
let server_envelope = ServerEnvelope { // 构造一条发往远端客户端的服务端 envelope
    event: queued_server_envelope.event, // 包装 App Server 要发出的实际消息
    client_id: queued_server_envelope.client_id, // 指定目标远端客户端
    stream_id: queued_server_envelope.stream_id, // 指定目标客户端流
    seq_id, // 指定当前流上的递增序号
}; // 服务端 envelope 构造结束
```

远端客户端收到后会回 ack。本机收到 ack 后，从 outbound buffer 删除已经确认的 envelope：

```rust
buffer.retain(|server_envelope| { // 遍历当前 stream 中缓存的已发送 envelope
    let envelope_cursor = cursor_of(server_envelope); // 计算这条 envelope 对应的确认游标
    let is_acked = envelope_cursor <= acked_cursor; // 判断是否已经被远端确认
    !is_acked // 只保留尚未确认的 envelope
}); // 出站缓存清理结束
```

这套机制不是为了“加密”，加密由 HTTPS / WSS 和账号鉴权承担；它主要解决可靠传输和断线恢复。

## 8. ClientTracker：远端客户端如何变成本地连接

`client_tracker.rs` 是理解 remote control 的关键。

relay 发来的消息不是直接喂给某个线程，而是先带着：

- `client_id`
- `stream_id`
- `seq_id`
- `event`

本机会用 `(client_id, stream_id)` 作为一个远端连接的 key。第一次看到 `initialize` 这类启动连接的消息时，它会在 App Server 内部创建一个新的 connection：

```rust
let connection_id = next_connection_id(); // 为这个远端 stream 分配本机连接 ID
self.send_transport_event( // 向 App Server 主循环发送 transport 事件
    TransportEvent::ConnectionOpened { // 表示新连接已经打开
        connection_id, // 本机连接 ID
        origin: ConnectionOrigin::RemoteControl, // 标记来源是 remote control
        writer: writer_tx, // 连接的出站写通道
        disconnect_sender: Some(disconnect_token), // 连接断开信号
    }, // ConnectionOpened 事件结束
).await?; // 等待事件成功送入 App Server
```

之后同一个 `(client_id, stream_id)` 上的 `ClientMessage` 会被转成：

```rust
TransportEvent::IncomingMessage { // 表示某个连接收到一条 JSON-RPC 消息
    connection_id, // 对应刚才创建的本机连接 ID
    message, // 远端客户端发来的 JSON-RPC 消息
} // IncomingMessage 事件结束
```

App Server 主循环收到以后，走的就是普通 `MessageProcessor`：

- `initialize` 完成握手。
- `thread/start` 创建线程。
- `turn/start` 开始一轮 Codex 执行。
- `turn/interrupt` 中断执行。
- `remoteControl/status/read` 读取远程控制状态。
- 各种 `item/*`、`turn/*`、`command/*` 通知再沿反方向发回远端客户端。

这一步非常重要：**remote control 没有另写一套“手机专用 Codex 协议”，而是把手机 / Web 端接成 App Server 的另一个 JSON-RPC 客户端。**

{% asset_img figure-04.svg %}

## 9. 安全边界：能确认的和不能确认的

从公开源码能确认的安全边界包括：

第一，本机不需要开放公网端口。remote control 是本机 App Server 主动连 ChatGPT relay。

第二，远程控制 URL 有 host allowlist。正常只接受 ChatGPT / staging 域名，本地测试只接受 localhost。

第三，它要求 ChatGPT auth，不支持 API key auth。源码里如果检测到 API key 模式，会返回“remote control requires ChatGPT authentication”。

第四，enrollment 按账号、relay 地址和客户端名称持久化。本机账号切换、WebSocket 404、认证失败都会触发清理或恢复流程。

第五，App Server 仍然保留原有的权限、审批、沙箱和事件模型。remote control 是 transport，不是绕过 Codex harness 的后门。

第六，`remoteControl/disable` 是关闭当前 App Server 进程的 remote control。官方 README 也说明它不会撤销已经 enroll 的控制设备。这意味着真正的设备撤销、账号管理和安全策略，大概率还在云端服务侧。

不能从公开源码确认的部分包括：

- ChatGPT relay 服务端如何保存 server / client 映射。
- 手机端如何展示可连接机器列表。
- 设备授权、过期、撤销和风控策略。
- 多端同时连接同一台机器时的产品级冲突处理。
- 企业策略、合规日志和数据驻留策略在 relay 层的具体实现。

这些部分只能说“从客户端协议可以推测需要存在”，不能当作源码事实。

## 10. 如果自己实现类似能力，架构会长什么样

如果抛开 Codex 的私有云端服务，自己要实现一个“手机控制本机 agent”的系统，公开源码给出的参考架构很清楚：

1. 本机 agent 启动一个本地 server，统一抽象任务、事件、审批和文件操作。
2. 本机 agent 用账号登录态主动 enroll 到云端 relay。
3. 云端 relay 返回 server id / environment id，并把这台机器挂到用户账号下。
4. 本机 agent 建立出站 WebSocket，并持续订阅发给自己的客户端消息。
5. 手机或 Web 端通过同一账号连接 relay，选择某个 environment。
6. relay 把手机端 JSON-RPC 消息包成 client envelope 转给本机。
7. 本机把它映射成本地 server 的连接和请求。
8. 本地执行结果、状态、diff、终端输出再包成 server envelope 发回 relay。
9. relay 转给手机端，并用 seq / ack / cursor 处理断线恢复。
10. 所有高风险动作仍然由本地 server 的权限系统和审批流控制。

这个架构最值得学的一点是：**不要让远端入口直接拥有真实执行权，而是让它接入同一个受控 harness。**

也就是说，relay 只是让消息能跨网络抵达；真正决定“能不能读文件、能不能跑命令、要不要审批”的，仍然是本机 App Server 和 Codex core。

## 11. 小结

回到最开始的问题：Codex App 可以和 PC / Mac 版连接，云端 relay 到底是什么意思？

从公开源码看，它可以拆成一句话：

**本机 Codex App Server 用 ChatGPT 账号主动 enroll 到 ChatGPT relay，建立一条带 seq、ack、cursor、分片和重连能力的 WebSocket；手机或 Web 端通过 relay 发来的消息，被本机映射成普通 App Server JSON-RPC 连接，最后仍由本机 Codex harness 执行任务。**

这套设计的几个关键词是：

- 出站连接，而不是公网入站端口。
- 账号级 enrollment，而不是裸 socket。
- JSON-RPC 事件流，而不是屏幕远程桌面。
- App Server 复用，而不是手机专用 agent。
- relay 负责转发，harness 负责权限。

所以能找到源码吗？

答案是：**能找到本机侧 remote-control 实现；找不到云端 relay 服务端完整源码。**

但就理解实现原理而言，公开的这部分已经足够说明产品骨架：Codex 远程控制的关键不在“手机怎么神奇地摸到电脑”，而在“所有界面都接入同一个本机 App Server，再由云端 relay 把跨设备消息转过去”。

## 参考资料

- [Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)
- [Unlocking Codex with the App Server](https://openai.com/index/unlocking-the-codex-harness/)
- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [openai/codex 仓库](https://github.com/openai/codex)
- [`remote_control` 源码目录](https://github.com/openai/codex/tree/80fdd4688f6fa8143488c206d4c14dc193905254/codex-rs/app-server-transport/src/transport/remote_control)
- [`app-server` README](https://github.com/openai/codex/blob/80fdd4688f6fa8143488c206d4c14dc193905254/codex-rs/app-server/README.md)
