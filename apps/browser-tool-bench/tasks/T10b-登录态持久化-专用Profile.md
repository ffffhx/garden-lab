# T10b · 登录态持久化（专用 Profile）：隔天免登录拿数据

- **测试维度**：Agent 专用 Profile / session 的持久化能力——登录一次，之后的全新会话免登录开局（对应文章第 5 节"准备 Agent 专用 profile"路线；与 T10a 互补）
- **适用工具**：agent-browser（state save/load、`--session-name`、自管 profile）、playwright-cli（state-save/state-load、persistent session）、Chrome DevTools MCP（持久 userDataDir）、bb-browser（受管 profile，待 click 修复）；@chrome / @browser 不适用（它们的登录态来自默认 Profile，走 T10a）
- **前置条件**：被测工具使用**独立的专用 profile/会话**（非系统默认 Profile），与日常浏览器完全隔离

## 与 T10a 的分工

T10a 的代价是授权弹窗（安全策略因子），本卡的代价换了位置：**首次登录的人工成本 + 登录态能不能跨会话、跨重启活下来**。risk 也不同：专用 profile 在网站风控眼里是新设备，可能触发额外验证——这也是观察点。

## 测试流程（两阶段）

**阶段一 · 准备（允许人工参与，记录成本）**
1. 用被测工具启动其专用浏览器，打开 github.com/login。
2. 人工完成登录（含可能的二次验证）。
3. 用该工具的持久化机制保存状态：agent-browser `state save ./gh-auth.json`（或 `AGENT_BROWSER_SESSION_NAME`）、playwright-cli `state-save`（或 `-s=<name> --persistent`）、DevTools MCP 固定 `--userDataDir`。
4. **彻底结束会话**：关浏览器、停 daemon。隔一段时间（理想隔天）进入阶段二。

**阶段二 · 被测（独立 Agent session，prompt 逐字使用）**

> 浏览器的登录状态之前已经保存过了。请打开 https://github.com/notifications ，告诉我现在有几条未读通知，并把每条的标题列出来。如果遇到登录页面，不要尝试登录，直接停止并报告。

（环境预置：以工具对应的恢复机制启动——`--state ./gh-auth.json` / `state-load` / 同名 session / 同 userDataDir。Agent 的 prompt 里不解释机制细节，恢复路径是否顺畅本身是被测项。）

## Ground Truth

- 以阶段二执行当时人工核对的未读数和标题为准。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 免登录直达通知页，数据与人工核对一致 |
| ⚠️ 部分 | 登录态部分存活（如 cookie 在但被风控要求二次验证），或需要 Agent 额外折腾恢复机制才生效 |
| ❌ 失败 | 撞登录墙（状态没存住 / 恢复机制失效） |

## 记录指标

1. **阶段一成本**：人工动作数、配置命令数；
2. **阶段二**：是否免登录（核心）、轮数 / 时间；
3. **存活时长**：状态保存到阶段二的间隔（建议至少测"重启 daemon 后"和"隔天"两档）；
4. 是否触发 GitHub 风控（设备验证邮件、二次验证）。

## 预期差异点

- agent-browser 与 playwright-cli 都有全套显式命令（state save/load），这是两者继 T05 actionability 之后的下一个正面对决点；区别可能出在状态文件的覆盖面（cookie 之外是否含 localStorage / IndexedDB）。
- DevTools MCP 走"同一个持久 userDataDir"的隐式路线：没有 state 文件，换机器/换目录就丢——记录这种差异的实际影响。
- 对照组：不做任何持久化的裸启动应 100% 撞登录墙，用它确认靶题有效。

## 安全提醒

- 状态文件（gh-auth.json 等）等同于账号凭证：测完删除，不入 git（确认 .gitignore 覆盖）。
- 只读任务，禁止任何写操作。建议用测试账号而非主账号。
