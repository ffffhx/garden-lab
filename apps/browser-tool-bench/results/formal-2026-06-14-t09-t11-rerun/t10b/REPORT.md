# T10b · 登录态持久化（专用 profile，隔会话免登录）四工具对比（2026-06-14 rerun）

## 方法学（重要）
- **单次共享登录**：为降低人工成本（避免 4 次 GitHub 2FA），只人工登录一次——在一个有头 CfT（专用 profile，端口 9230）里登录 `ffffhx`。然后用**每个工具各自的原生持久化机制**从该会话抓取/复用状态，阶段二各自在全新会话验证免登录。
- 阶段二 prompt（逐字）：「浏览器的登录状态之前已经保存过了。请打开 https://github.com/notifications …如果遇到登录页面，不要尝试登录，直接停止并报告。」
- Ground truth：未读 **68 条**（ffffhx）。
- agent-browser / playwright-cli 走**独立干净 subagent**跑阶段二；devtools-mcp / bb-browser 因机制特殊（见下）由主控直接、忠实地用各自原生路径验证。

## 结果

| 工具 | 结果 | 持久化机制 | 跨全新会话免登录? | 可移植? |
| --- | --- | --- | --- | --- |
| **agent-browser** | ✅ | `state save/load` **可移植状态文件**（`--state <file> open <url>` 一步式） | 是 | **是**（文件存 CDP 拿到的明文 cookie，52 条/18 github） |
| **playwright-cli** | ✅ | `state-save/load` **可移植状态文件**（Playwright storageState） | 是 | **是**；小坑：必须「先 open 再 state-load 再 goto」 |
| **chrome-devtools-mcp** | ✅\* | **持久 userDataDir**（复用同一 profile 目录，无状态文件） | 是（同目录原地复用）；**换目录/复制就丢**（实测复制 profile → 撞登录墙） | **否**（目录绑定，不可移植） |
| **bb-browser** | △ | **自身无任何持久化机制**（无 state save/load、无 cookie 导入，只有只读 `cookies` 查看 + `--port` attach） | 仅当 attach 到一个**别人维持登录的持久浏览器**时能读到 | **否**（自己不产出也不保存状态） |

## 各工具阶段二实录
- **agent-browser ✅**：`agent-browser --state /tmp/t10b/gh-agentbrowser.json open https://github.com/notifications` 一条命令完成"加载先于导航"，免登录直达，读到 68 条未读 + 标题（ffffhx）。恢复体验最顺：一步式 `--state open` 天然满足顺序约束。（独立 subagent，1 轮命中，0 打断）
- **playwright-cli ✅**：`-s=t10b-stage2 open` → `state-load /tmp/t10b/gh-playwright.json` → `goto notifications`，免登录直达，68 条 + 标题。坑：`state-load` 必须在 `open` 之后（直接带状态文件启动会报 "browser is not open"）。（独立 subagent，1 轮，0 打断）
- **chrome-devtools-mcp ✅\***：机制是"复用持久 userDataDir"。**关键环境坑**：macOS 上 CfT keychain 被拒（`userCanceledErr`），默认 on-disk cookie 加密 key 丢失 → **登录态根本没持久化到磁盘**，原地复用同一 dir 也撞登录墙；用 `--use-mock-keychain`（固定加密 key）后，干净关闭→重启同一 profile→`connectOverCDP` 验证**免登录、ffffhx、68 条**成功。结论：userDataDir 路线能持久，但 (a) 不可移植（复制目录即失效，实测确认），(b) 依赖浏览器 on-disk cookie 加密可用。
- **bb-browser △**：自身没有可移植状态机制。用 `bb-browser --port 9234` attach 到上面那个持久 profile 浏览器后，能 `open notifications` 并读到**免登录、ffffhx、68 条**——但这完全是**搭了外部持久浏览器的便车**，bb-browser 既不产出状态文件也不管理 profile。严格说它"做不了"T10b 的持久化，只是"能读一个已经持久登录的浏览器"。

## 与文章/任务卡断言对照
1. **「agent-browser 与 playwright-cli 都有全套 state save/load，是正面对决点」——成立，且打平**：两者都用可移植状态文件一次性恢复成功，差别只在 ergonomics（agent-browser `--state open` 一步式更顺；playwright-cli 需「先 open 再 load」）。
2. **「DevTools MCP 走隐式持久 userDataDir，换机器/换目录就丢」——实测确认**：复制 profile 即失效；且本环境还暴露了"无 keychain 时默认连原地都丢"的更脆点，需 `--use-mock-keychain` 兜底。
3. **可移植状态文件 > userDataDir 依赖**：ab/pw 的状态文件存的是**已解密明文 cookie**，不依赖浏览器磁盘加密，跨目录/跨实例都能用；这正是它们比 userDataDir 路线稳的根因。
4. **bb-browser 在持久化维度最弱**：继 T09/T11 扩展失能后，T10b 再证它缺少状态管理能力，只能 attach 别人维持的浏览器。

## 证据/产物
- 状态文件：`/tmp/t10b/gh-agentbrowser.json`、`/tmp/t10b/gh-playwright.json`（**等同账号凭证，测完即删，未入 git**）。
- 阶段二截图：`t10b/evidence-agent-browser/`、`t10b/evidence-playwright-cli/`。
- 全程只读，未对真实 GitHub 账号做任何写操作。
