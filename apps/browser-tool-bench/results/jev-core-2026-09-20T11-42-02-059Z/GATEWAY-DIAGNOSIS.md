# 浏览器会话故障定位（2026-09-20）

结论：已在独立的 ProfilePilot 受管 Chrome 环境中复现出与评测相同的错误，并找到具体的桌面端会话管理缺陷。修复不需要重启 Gateway 或关闭现有 Chrome；已编译的修复需要重新加载 ProfilePilot 桌面进程。当前用户桌面进程尚未重启。

## 具体原因

Gateway 会把 Chrome 的 Target 事件转发给内部观察连接。页面内的控制条 AgentOverlayManager 使用显式 attach 命令建立自己的会话，但同时保留了一个处理 Target.attachedToTarget 广播事件的旧逻辑：看到事件就把其中的 sessionId 写进自己的页面状态。

这个广播事件可能来自 agent-browser，而非控制条自己的 attach。于是控制条会误用 Agent 的会话来初始化；当控制条清理或关闭时，还会对这个编号发送 Target.detachFromTarget。Gateway 随后正确移除该编号的归属映射，Agent 下一次读取页面继续使用原编号，就收到 `CDP error (Runtime.evaluate): CDP Session 不属于当前 Agent 连接`。

这解释了为何问题与时序有关：错误地使用编号不一定立刻失败，清理该编号后才会报错。此处的页面控制条是浏览器里的接管/交还控件，与此前设置为默认关闭的桌面悬浮小窗不是同一个组件。

## 实际证据

复现使用独立的测试 Profile、Gateway 与原有 wrapper，没有接管或重启用户的 9223、9224、9226、9227，也没有调用模型或使用账号密钥。

| 条件 | 结果 | 含义 |
| --- | --- | --- |
| 无控制条，连续创建任务 | 12/12 通过 | 单独切换任务未复现 |
| 旧控制条持续开启 | 12/12 通过，但记录到 96 次内部客户端误用 Agent 会话 | 存在错误归属使用，尚未触发清理 |
| 旧控制条，打开页面后清理控制条再读取 | 第 1 次复现相同错误，立即停止 | 精确捕捉到内部客户端 detach Agent 会话 |
| 修复后的控制条，执行相同清理场景 | 12/12 通过，误用 Agent 会话次数为 0 | 局部修复切断了故障路径 |

基线明确记录：12:25:46.278 UTC，内部连接对属于 Agent 的 `796F1A12077C7BC7BF2F3820C8D5D3E4` 发送 detach；12:25:46.617 UTC，Agent 用同一编号 Runtime.evaluate，此时归属记录已不存在。

历史那次评测没有保存完整 CDP 事件流，因此不能声称已逐事件证明每一次旧故障都来自此路径；但相同错误已经在真实 Chrome 中可重复触发，并通过修改单一桌面模块消除。

一次早期探索使用了错误的测试目标列表读取配置，它也暴露了编号误用，但未作为正式前后对照依据。最终对照的目标列表配置一致。

## 修复与验证

- 修改 `profilepilot/src/main/agent-overlay.ts`：忽略 attach 广播对会话归属的影响；只接受自己发出的 attach 命令响应提供的编号。
- 新增回归测试：收到另一客户端的 attach 事件时，不覆盖自己的编号，也不能在清理时 detach 对方编号。
- `npm run build` 通过；`node --test tests/overlay.test.js tests/browser-gateway-server.test.js` 共 78 项全部通过。
- 同一份诊断脚本，基线加载修复前的 overlay，修复组使用当前编译版本。Gateway、Chrome 操作和场景相同。
- 缺陷处于 Windows/macOS 共用的 TypeScript 逻辑，没有新增平台分支。真实浏览器验证在当前 Windows 环境完成；未声称已运行 macOS 实测。

诊断脚本：`profilepilot/scripts/diagnose-gateway-sessions.mjs`。

```powershell
node scripts/diagnose-gateway-sessions.mjs --overlay --cycle-overlay --baseline-overlay
node scripts/diagnose-gateway-sessions.mjs --overlay --cycle-overlay
```

原始证据：[修复前](diagnosis-before.json)、[修复后](diagnosis-after.json)。

## 是否需要重启

- **无需重启 Gateway**：修复位于桌面控制条代码，Gateway 无需修改；原服务 PID 26328 仍在运行。
- **无需关闭 Chrome**：受管浏览器由独立 Gateway 进程持有，桌面进程退出流程不负责关闭 Gateway。
- **需要重新加载桌面应用才能应用修复**：目前运行的桌面 PID 65728 仍加载旧代码。已完成编译，但没有擅自重启这个实例。
- 不再要求仅因协议 14/15 不同而重启；版本 15 的 Windows 下载路径改动不足以解释本问题。评测脚本改为记录并固定实际 Gateway PID/版本。

原先提出关闭所有受管窗口的方案不再需要。36 次速度评测仍未完成，诊断次数不能充当 Jev/Kimi 的模型评测样本。
