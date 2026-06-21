# 统一 9223 成本评测须知（6 工具 · 2026-06-21）

本轮目标：优先用用户提供的 Chrome profile（CDP `http://127.0.0.1:9223`）重跑浏览器工具评测，并把结果、耗时、token/cost、工具调用数、browserOps、eval/CDP 自救次数放到同一张总表。

## 范围

- 工作目录：`/Users/bytedance/Code/garden-lab`
- 靶场服务：`http://localhost:4399`
- CDP：`http://127.0.0.1:9223`
- 本地任务卡：`apps/browser-tool-bench/tasks/`
- 真实网站任务卡：`apps/browser-tool-bench/tasks-real/`
- 输出目录：`apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools/<tool>/`

当前仓库真实网站任务只有 `R01-R09`，没有 `R10`。本轮不要凭空发明 R10；在报告里明确注明“R10 未定义”。本地任务按仓库现有任务卡执行：`T01-T20`，其中 T10 拆成 `T10a/T10b/T10c` 三张卡。

## 9223 与 fallback 规则

本轮优先连接 `9223`。2026-06-21 用户追加放宽：`@chrome` 如果不能证明连接 9223，可以使用系统默认 Profile；`@browser` 和 `playwright-cli` 如果不能连接 9223，也可以用各自可用的默认 / 自管浏览器能力继续跑。其他工具仍按 9223 优先。

1. 运行前必须用 `curl http://127.0.0.1:9223/json/version` 和 `/json/list` 记录 CDP 可达性。
2. 工具若声称连上了浏览器，必须用一个唯一 URL 参数或目标列表证明该工具实际操作的 tab 出现在 `9223` 的 `/json/list` 中。
3. 如果 `@chrome` 无法证明绑定 `9223`，可以继续用系统默认 Profile 跑，但每个受 profile 影响的任务必须标注 `default Profile fallback`，T10c 仍不能算 9223 成功。
4. 如果 `@browser` 无法绑定 `9223`，可以继续用 in-app browser 跑，但真实登录态、扩展、9223 profile 相关任务必须按实际能力记 `N-R` / `N/A` / `❌`。
5. 如果 `playwright-cli` 无法稳定 attach 9223，可以继续用自管浏览器跑，但真实登录态、9223 上的扩展注入、指定 9223 profile 任务必须按实际能力记 `N-R` / `N/A` / `❌`。
6. 不允许为了完成结果而换成别的工具。你只能使用被分配的工具；shell 可用于读任务卡、预检、写报告、查看 `9223/json/*` 和记录证据。

## 任务执行

- 逐字阅读任务卡的 Prompt、Ground Truth、判定标准。
- 不准凭记忆写答案，必须来自页面、Network、trace、DOM、截图或工具输出证据。
- 靶场账号：`agent@bench.dev` / `bench-2026`。
- 真实网站任务只读，禁止改真实账号或真实网站状态。
- 扩展相关任务只允许改 Bench Badge 本地扩展状态，并且做完必须恢复 `BENCH EXT v1.0.0`。
- T09/T11/R06 会污染扩展状态；执行后要恢复 manifest/storage，并在报告里写恢复证据。
- T10b 是工具自管持久化能力。由于本轮严格 9223，如果该工具无法在 9223 约束下合理表达 T10b，应记 `N/A` 或 `N-R` 并说明原因，不要用自启 profile 替代。

## 成本与自救计量

完成后必须报告这些指标：

- `elapsed_ms`：从开始执行该工具评测到结束写报告的墙钟耗时。
- `tool_calls`：本 subagent 里实际调用工具/命令的大致次数；能精确就精确，不能精确就给估算并说明。
- `browserOps`：真正操作浏览器的次数。CLI 子命令、MCP 浏览器动作、Playwright/Chrome plugin 的浏览器动作都算；读文件、写报告、curl `/json/list` 不算。
- `escapes`：eval 自救、CDP 逃生、initScript、临时页面脚本、直接调用底层协议来绕过工具一等原语的次数。只读 eval 和代操作 eval 分开写明。
- `tokens/cost`：如果运行环境或最终状态能看到 token/cost，就填写；看不到就写 `unavailable`，不要编造。

每个任务都要写：

- `task`
- `verdict`: `✅` / `⚠️` / `❌` / `N-R` / `N/A`
- `escape`: `true` / `false`
- `answer`
- `evidence`
- `notes`

## 输出格式

在 `<tool>/REPORT.md` 写完整报告，并在 `<tool>/summary.json` 写机器可汇总 JSON：

```json
{
  "tool": "agent-browser",
  "model": "gpt-5.5",
  "reasoning_effort": "xhigh",
  "strict_cdp": "http://127.0.0.1:9223",
  "browser_mode": "cdp-9223 | default-profile-fallback | in-app | self-managed",
  "cdp_proof": "describe proof or failure",
  "elapsed_ms": 0,
  "tool_calls": 0,
  "browserOps": 0,
  "escapes": {
    "total": 0,
    "eval_read": 0,
    "eval_action": 0,
    "cdp_escape": 0,
    "init_script": 0,
    "notes": ""
  },
  "tokens": "unavailable",
  "cost_usd": "unavailable",
  "tally": {
    "pass": 0,
    "warn": 0,
    "fail": 0,
    "nr": 0,
    "na": 0
  },
  "results": [
    {
      "task": "T01",
      "verdict": "✅",
      "escape": false,
      "answer": "",
      "evidence": "",
      "notes": ""
    }
  ]
}
```

最终回复必须给出 `REPORT.md` 和 `summary.json` 路径。
