# @chrome / Chrome plugin 统一 9223 评测报告

- 工具：@chrome（Codex Chrome plugin / Chrome Browser Use）
- 插件线索：openai-bundled Chrome skill `26.616.32156`
- 执行时间：2026-06-21 Asia/Shanghai
- 严格 CDP：`http://127.0.0.1:9223`
- 靶场：`http://localhost:4399`
- 结论：`N-R`。Chrome plugin 可以操作一个 Chrome tab，但无法证明该 tab 属于 `9223`；按 `SHARED-BRIEF.md`，未继续用默认 profile 或其它 profile 跑任务。

## 9223 绑定证据

1. Shell 预检 `http://127.0.0.1:9223/json/version` 成功：
   - `Browser`: `Chrome/149.0.7827.116`
   - `webSocketDebuggerUrl`: `ws://127.0.0.1:9223/devtools/browser/88daa777-7389-4a89-8aad-df77b2877f3b`
2. Shell 预检 `/json/list` 成功，9223 内已有多个 page / extension / service_worker target。
3. Chrome plugin 打开唯一 proof URL：
   - `http://localhost:4399/?chrome_proof=chrome-plugin-9223-1781975526972`
   - Chrome plugin 返回标题：`Bench 靶场 · 首页`
   - Chrome plugin `browser.user.openTabs()` 也能看到该 proof tab。
4. 但随后读取 `http://127.0.0.1:9223/json/list`，筛选该 proof id 的结果为 `0`：
   - 命令：`curl -sS http://127.0.0.1:9223/json/list | jq '[.[] | select(.url | contains("chrome-plugin-9223-1781975526972"))] | length'`
   - 输出：`0`

判定：不能证明 @chrome 当前控制的 tab 命中 `9223`。本轮严格规则要求不能改用默认 Profile、in-app browser、自启浏览器或其它端口替跑，因此停止任务执行。

## 扩展状态恢复

本轮未进入 T09 / T11 / R06 的扩展修改步骤，未通过 @chrome 修改 9223 内 Bench Badge storage。仓库内 `apps/browser-tool-bench/extension-sample/manifest.json` 当前显示 `"version": "1.0.0"`。由于 @chrome 未证明可操作 9223，未尝试用它改 9223 扩展状态。

## 指标

- `elapsed_ms`: `180000`（估算，包含读 brief / 任务卡、9223 预检、Chrome plugin bootstrap、proof、写报告）
- `tool_calls`: `26`（估算，按可见 shell / node_repl / apply_patch 等调用计）
- `browserOps`: `8`
  - `nameSession`
  - `tabs.new`
  - `goto(proofUrl)`
  - `waitForLoadState`
  - `title`
  - `url`
  - `browser.user.openTabs`
  - `tabs.finalize`
- `escapes`: total `0`
  - `eval_read`: `0`
  - `eval_action`: `0`
  - `cdp_escape`: `0`
  - `init_script`: `0`
  - 说明：shell 读取 `/json/version` 和 `/json/list` 只用于本轮强制绑定证明，不用于操作页面或完成任务。
- `tokens`: `unavailable`
- `cost_usd`: `unavailable`

## 逐任务结果

| task | verdict | escape | answer | evidence | notes |
| --- | --- | --- | --- | --- | --- |
| T01 | N-R | false | 未执行 | @chrome proof URL 未出现在 9223 `/json/list`，匹配数 0。 | 未使用默认 profile 替跑。 |
| T02 | N-R | false | 未执行 | 同上。 | 未点击提交订单，未读取 Network。 |
| T03 | N-R | false | 未执行 | 同上。 | 未采集 performance/trace。 |
| T04 | N-R | false | 未执行 | 同上。 | 未 mock 请求，未截图。 |
| T05 | N-R | false | 未执行 | 同上。 | 未加载 livefeed。 |
| T06 | N-R | false | 未执行 | 同上。 | 未读取 catalog。 |
| T07 | N-R | false | 未执行 | 同上。 | 未执行页面内 fetch。 |
| T08 | N-R | false | 未执行 | 同上。 | 未操作 Shadow DOM。 |
| T09 | N-R | false | 未执行 | 同上；未能证明 @chrome 可在 9223 内操作扩展页。 | 未改 manifest/storage；manifest 当前为 1.0.0。 |
| T10a | N-R | false | 未执行 | 同上。 | 本轮严格 9223，不采用 @chrome 默认 profile 主场口径。 |
| T10b | N/A | false | 不适用 | @chrome 没有工具自管专用 profile/state 持久化机制；brief 允许 T10b 对 @chrome 记 N/A。 | 也未证明可绑定 9223。 |
| T10c | N-R | false | 未执行 | T10c 要求先证明绑定 9223；proof URL 不在 9223 target 列表。 | 未读取 GitHub notifications。 |
| T11 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未改 Bench Badge 设置。 |
| T12 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未读取 Console / source map。 |
| T13 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未设置移动 viewport。 |
| T14 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未读取 hydration 证据。 |
| T15 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未触发 SSE。 |
| T16 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未检查 Service Worker。 |
| T17 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未操作跨域 iframe。 |
| T18 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未上传文件。 |
| T19 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未做键盘检查。 |
| T20 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未运行 10 次 flake 检查。 |
| R01 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未访问 GitHub 仓库页。 |
| R02 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未读取真实通知页。 |
| R03 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未访问 MDN。 |
| R04 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未访问 npm 页面。 |
| R05 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未访问 Chrome Web Store。 |
| R06 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未改真实网站注入状态。 |
| R07 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未读取真实 Network 响应体。 |
| R08 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未做网络层拦截。 |
| R09 | N-R | false | 未执行 | @chrome proof 绑定失败。 | 未采集 HAR / performance。 |

R10 未定义：仓库 `tasks-real/` 当前只有 R01-R09，本报告不编造 R10。
