# 恢复笔记（2026-06-14 rerun，重启会话后续跑用）

## 进度
- ✅ agent-browser：T10a ✅(68) / T11 ✅(HELLO-2026·v1.0.0) / T09 ✅(…v1.0.1) — REPORT 已落盘
- ✅ bb-browser：T10a ✅(68) / T11 ⚠️(靠CDP强开设置页) / T09 ❌(到不了chrome://，reload弄坏扩展) — REPORT 已落盘
- ✅ playwright-cli：T10a ❌(attach企业9223崩溃) / T11 ✅ / T09 ✅(自管context) — REPORT 已落盘
- ⏳ **chrome-devtools-mcp：待跑**（重启会话加载 MCP 后）
- ⏳ 汇总对比 REPORT.md（最后做）
- ⏳ T10b（四工具专用profile持久化）——尚未开始，需各工具人工登录一次GitHub

## 重启后要做什么
1. 确认 MCP 工具可用：ToolSearch 找 `mcp__chrome-devtools-ext__*`（连9224）和 `mcp__chrome-devtools-gh__*`（连9223）。
2. 开 **chrome-devtools-mcp 独立 subagent**，跑 T10a(9223,用 -gh) / T11(9224,用 -ext) / T09(9224,用 -ext)。顺序 T10a→T11→T09。读 SHARED-ENV.md。
   - 注意：chrome-devtools-mcp `--browserUrl` 模式不支持 `--categoryExtensions` 扩展工具，T09 reload 只能走 chrome://extensions UI（且 CfT 默认开发者模式可能关着，需先开 #devMode 才有 reload 入口——agent-browser/playwright 都踩过这坑）。
   - subagent 的 Write 到 REPORT.md 会被 harness 拦——让它把 REPORT 全文返回，主控代为落盘（前3个工具都这么处理的）。
3. 写汇总 REPORT.md + 更新 results-matrix.md。
4. 再处理 T10b（另一阶段，需人工登录）。

## 环境关键事实
- **9224** = 我启动的 Chrome for Testing（独立 nohup 进程，重启 Claude 不受影响），装了 Bench Badge（ID `jkmndkochpgaleoechlemhdhbikdecnf`），扩展正常注入。当前 live=1.0.0、manifest文件=1.0.1（T09前置就绪）。
  - 启动命令见 `/tmp/reset-ext-host.sh`（含 `--disable-features=DisableLoadExtensionCommandLineSwitch --load-extension`，profile=/tmp/bench-ext-host9224）。
  - 复位脚本：`bash /tmp/reset-ext-host.sh`（kill+全新profile重启，结尾manifest→1.0.1）。验证：`node /tmp/verify-host.mjs`（connectOverCDP读徽标，最可靠）。
- **9223** = 用户企业管控的系统 Chrome，已登录 GitHub，仅用于 T10a。企业策略拦截解压扩展，不能跑 T09/T11。
- 靶场 `http://localhost:4399/`（IPv6，已清IPv4双监听）。
- `.mcp.json`（在 /Users/bytedance/Code/）：chrome-devtools-ext→9224，chrome-devtools-gh→9223。

## 重大方法学发现（写进汇总报告）
1. 9223 企业 Chrome 运行时拦截解压扩展（ERR_BLOCKED_BY_CLIENT）→ 扩展测试改用干净 CfT 9224。
2. Chrome/CfT 137+ 忽略命令行 `--load-extension`，需 `--disable-features=DisableLoadExtensionCommandLineSwitch` 恢复。
3. CDP `Extensions.loadUnpacked` 只进注册表、不激活 content script。
4. **agent-browser 粘滞会话会被自起托管 headless 浏览器劫持，`--cdp` 形同虚设**；杀 daemon+托管实例后才正常 attach。上午"attach工具全blocked"部分是这个假象。
5. CfT 137+ reload 解压扩展前必须开开发者模式，否则被判 unsupportedDeveloperExtension 禁用。
