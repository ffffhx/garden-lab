# T09 / T10a / T11 四工具对比（2026-06-14 rerun，Claude Code 主控）

每个工具一个**独立干净 subagent**，只挂自己那一个工具，独立写报告。主控（我）负责环境搭建、扩展状态复位、结果汇总。被测工具版本与用户指定一致：agent-browser 0.27.2 / bb-browser 0.14.2 / chrome-devtools-mcp 1.2.0 / playwright-cli 0.1.14。

## 结果矩阵

| 工具 | T10a 真实登录态(9223) | T11 用扩展(设置页改徽标) | T09 调试扩展(reload) | T10b 持久化(免登录恢复) |
| --- | --- | --- | --- | --- |
| **agent-browser** | ✅ 68 条未读，标题全列 | ✅ `HELLO-2026 · v1.0.0`，走设置页 UI | ✅ `…· v1.0.1`，走 chrome://extensions UI | ✅ 可移植状态文件，`--state open` 一步式 |
| **bb-browser** | ✅ 68 条未读，标题全列 | ⚠️ 徽标改成功但**靠 CDP HTTP 强开设置页**（自身到不了 chrome-extension://） | ❌ **到不了 chrome://extensions**；退用 `chrome.runtime.reload()` 反把扩展弄失效 | △ 自身无持久化机制，只能 attach 别人维持的持久浏览器 |
| **chrome-devtools-mcp** | ✅ 68 条未读，标题全列 | ✅ `HELLO-2026 · v1.0.0`，navigate 直达 options.html | ✅ `…· v1.0.1`，chrome://extensions 页面内调 `developerPrivate.reload` | ✅\* 持久 userDataDir，但换目录即丢、依赖磁盘 cookie 加密 |
| **playwright-cli** | ❌ **attach 企业 9223 崩溃**（service_worker target 断言） | ✅ `HELLO-2026 · v1.0.0`，**自管 persistent context** | ✅ `…· v1.0.1`，自管 context + `developerPrivate.reload` | ✅ 可移植状态文件，需「先 open 再 load」 |

> 判定基线：T11 看徽标文字是否变 `HELLO-2026`（此时 live=1.0.0 → `HELLO-2026 · v1.0.0`）；T09 看版本号是否升到 `v1.0.1`（因任务顺序 T11→T09，徽标会带 T11 留的文字 → `HELLO-2026 · v1.0.1`，版本号正确即算成功）。

## 三个任务横向看

### T10a · 借真实登录态读 GitHub（端口 9223）
- **3 ✅ / 1 ❌**。agent-browser、bb-browser、chrome-devtools-mcp 都能干净 attach 企业管控的系统 Chrome（9223）、读到 **68 条未读**（上午是 67，这轮多了 1 条，合理；具体通知标题已脱敏）。
- **playwright-cli ❌**：`attach --cdp=http://localhost:9223` 在枚举 target 时撞到企业管理扩展的 `service_worker` target，playwright-core 内部 `assert` 失败、daemon 直接退出。这是它"只能驱动自家浏览器"边界的实锤——**接不了带企业扩展/多 target 的真实 Chrome**。
- 反差点：同一台 9223，chrome-devtools-mcp（Google 官方 attach 工具）稳稳连上，playwright-cli 崩。

### T11 · 用扩展功能（chrome-extension:// 设置页改文字）
- **3 ✅ / 1 ⚠️**。徽标硬指标四家其实都做到了 `HELLO-2026 · v1.0.0`，差别在**到达扩展设置页的路径是否"自带"**：
  - agent-browser：直接 `open chrome-extension://…/options.html` 可达，UI 操作顺畅。
  - chrome-devtools-mcp：扩展页**不进 list_pages**（browserUrl 模式无 categoryExtensions），但 `navigate_page` 把当前 tab 导到 options.html 后 fill/click 照常 → 判 ✅（走了用户路径）。
  - playwright-cli：自管 persistent context 内 `goto` 扩展页可达 → ✅。
  - **bb-browser ⚠️**：致命短板——`open`/`goto` 给 `chrome://`、`chrome-extension://` 无脑加 `https://` 前缀并把 `://` 折叠成 `//`（`chrome://extensions/`→`https://chrome//extensions/`），自身根本到不了扩展页；最终靠 **CDP HTTP `curl /json/new` 强开 target** 才让 bb-browser 能 snap/fill/click。能力打折，判 ⚠️。

### T09 · 调试扩展（reload 使版本生效）
- **3 ✅ / 1 ❌**。
  - agent-browser：chrome://extensions 页面 UI（先开开发者模式再点 reload）✅。
  - chrome-devtools-mcp：chrome://extensions 页面上下文 `chrome.developerPrivate.reload` ✅（API 路径比点按钮更稳）。
  - playwright-cli：自管 context 内 `developerPrivate.reload` ✅。
  - **bb-browser ❌**：到不了 chrome://extensions（同上 URL 短板），唯一可达的 reload 入口是页面内 `chrome.runtime.reload()`，但实测把 unpacked 扩展弄成**失效态**（SW 不跑、徽标消失），拿不到 v1.0.1。
- **共性坑（3 个成功工具都踩到）**：Chrome/CfT 137+ 在**开发者模式关闭**时 reload 解压扩展，会判为 `unsupportedDeveloperExtension` 直接禁用——必须先打开开发者模式。这是 T09 最容易误判"已 reload"的地方。

## 各工具到达扩展能力的"路径"（衡量是否一等公民）
| 工具 | 扩展 ID 发现 | 打开设置页 | reload 扩展 |
| --- | --- | --- | --- |
| agent-browser | chrome://extensions shadow DOM `eval` 穿透 | 直接 open chrome-extension:// ✅ | chrome://extensions UI（手开发者模式） |
| bb-browser | 无内建手段（靠外部给） | ❌ 自身不可达，借 CDP HTTP 强开 | ❌ 仅 runtime.reload()，且弄坏扩展 |
| chrome-devtools-mcp | `developerPrivate.getExtensionsInfo` | navigate_page 直达（但不进 list_pages） | `developerPrivate.reload`（页面内 API） |
| playwright-cli | chrome://extensions shadow DOM | 自管 context goto ✅ | `developerPrivate.reload`（自管 context） |

## 与文章/上午那轮断言的对照
1. **"扩展场景偏向能自带/掌控浏览器的工具"——部分成立但被改写**：上午结论是"只有 playwright-cli 能跨过扩展"。本轮证明：只要给 attach 工具一个**扩展真能跑的浏览器**（干净 CfT 9224），agent-browser 和 chrome-devtools-mcp 同样能完整做 T09/T11。真正的分水岭不是"自带浏览器"，而是**能否到达 `chrome://` 和 `chrome-extension://` 特权页**——bb-browser 卡在这（URL 归一化 bug），所以扩展类几乎失能。
2. **"page-only 工具覆盖弱"**：bb-browser 印证（够不到特权页）；但 chrome-devtools-mcp 虽无专用扩展工具，靠"页面内 chrome.developerPrivate API"这条迂回路径照样打通，说明"有没有专用扩展工具"不如"能不能到 chrome://extensions 页面 + 在其上下文 eval 特权 API"重要。
3. **真实登录态主场**：agent-browser / bb-browser / chrome-devtools-mcp 都能借企业管控 Chrome 的登录态；playwright-cli 在这恰恰最弱（attach 即崩）。

## ⚠️ 重大环境/方法学发现（影响结果可信度，务必记入靶场经验）
1. **9223 企业管控 Chrome 运行时拦截解压扩展**：扩展能装上、chrome://extensions 里显示"已启用"，但 content script 不跑、扩展自身 chrome-extension:// 资源返回 `ERR_BLOCKED_BY_CLIENT`。→ **9223 不能用于 T09/T11**，本轮扩展任务改用我另起的干净 Chrome for Testing（端口 9224）。上午"用户手动装进 9223 最公平"的方案被企业策略否决。
2. **Chrome / CfT 137+ 忽略命令行 `--load-extension`**：必须加 `--disable-features=DisableLoadExtensionCommandLineSwitch` 才恢复。这是搭"可被 attach 的扩展 host"的关键，否则扩展根本没加载。
3. **CDP `Extensions.loadUnpacked` 只进注册表、不激活 content script**：用它装的扩展，chrome://extensions 里有、但页面注入不生效。不能用来搭 host。
4. **agent-browser 粘滞会话会被自起的托管 headless 浏览器劫持**：`agent-browser --cdp 9224` 看似连了，实际命中的是它自己 daemon 的托管 Chrome（无扩展），导致一连串 NO_BADGE 假象。**杀掉 daemon/托管实例 + `close --all` 后 `--cdp` 才真连目标**。这点很可能也污染了上午"attach 工具全 blocked"的结论——值得回头复核。
5. **判读扩展注入不能只信工具自己的 eval**：用第二个 CDP 客户端（playwright connectOverCDP）交叉验证 + 截图（像素级 ground truth）才定位到上面 4 的劫持问题。

## T10b（持久化）单列
全部完成，详见 `t10b/REPORT.md`。一句话：**可移植状态文件（agent-browser、playwright-cli）完胜**——存的是已解密明文 cookie，跨会话/跨目录都能恢复，两者打平（ergonomics 微差）。chrome-devtools-mcp 靠持久 userDataDir，能用但不可移植（复制目录即失效）、且依赖浏览器磁盘 cookie 加密（本机 CfT 无 keychain 时默认连原地复用都丢，需 `--use-mock-keychain` 兜底）。bb-browser 在持久化维度最弱：**自身无 state save/load、无 cookie 导入**，只能 attach 一个别人维持登录的浏览器（搭便车），不产出也不保存状态。方法学：为省人工只共享登录一次，各工具用自己原生机制恢复。

## 产物路径
- 各工具：`results/formal-2026-06-14-t09-t11-rerun/<tool>/REPORT.md` + `evidence/`
- 共享协议：`results/formal-2026-06-14-t09-t11-rerun/SHARED-ENV.md`
- 恢复笔记/环境细节：`results/formal-2026-06-14-t09-t11-rerun/RESUME-NOTES.md`
- 扩展 host：CfT @ 9224（独立进程，复位脚本 `/tmp/reset-ext-host.sh`）
