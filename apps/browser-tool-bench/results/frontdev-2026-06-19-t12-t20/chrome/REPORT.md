# Codex @chrome / Chrome Plugin Report: T12-T20

评测对象：Codex `@chrome` / Chrome Plugin

执行环境：

- 工作区：`/Users/bytedance/Code/garden-lab`
- 目标服务：用户说明为 `http://localhost:4400/`；任务卡 Prompt 仍写 `http://localhost:4399/`。
- 约束：只评测 T12-T20；不改源码、不改任务卡、不改其他工具报告；不使用 agent-browser、Playwright CLI、DevTools MCP、bb-browser 代跑。
- 本报告是唯一写入文件：`apps/browser-tool-bench/results/frontdev-2026-06-19-t12-t20/chrome/REPORT.md`。

## @chrome 可用性结论

本轮无法运行网页任务：当前 Codex Chrome Plugin 能力不可用。

按要求先通过 `tool_search` 查找 @chrome/Chrome Plugin 能力；当前上下文暴露的是 Chrome Plugin 的 `node_repl` 控制路径。按 `chrome:control-chrome` 技能进行 bootstrap 时，`agent.browsers.get("extension")` 返回：

```text
Browser is not available: extension
```

按 Chrome Plugin 故障排查文档重试一次后仍失败。随后做只读环境检查，结果为：

- Chrome 已运行。
- Google Chrome 已安装，版本 `149.0.7827.116`。
- Native Messaging Host manifest 存在且正确，允许的 extension origin 为 `chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/`。
- Codex Chrome Extension 在 selected profile `Default` 中 `installed=true`，但 `enabled=false`，`disabled=true`，`disableReasons=[2]`。

因此本轮 N-R 反映的是当前 Codex 工具环境无法和 Codex Chrome Extension 通信，不是 T12-T20 网页任务本身不可运行或失败。

## 总表

| 任务 | 结果 | 关键证据 | 是否 native @chrome 完成 | 是否受 @chrome URL/runtime/console/network 限制影响 |
| --- | --- | --- | --- | --- |
| T12 Console 与 SourceMap 定位 | N-R | `Browser is not available: extension`；Codex Chrome Extension installed but disabled | 否 | 是，runtime 不可用，无法打开页面/读取 console/network |
| T13 移动端布局遮挡 | N-R | 同上 | 否 | 是，runtime 不可用，无法设置视口/点击/截图 |
| T14 SPA 状态 Hydration 不一致 | N-R | 同上 | 否 | 是，runtime 不可用，无法读取页面/console |
| T15 SSE 实时流等待 | N-R | 同上 | 否 | 是，runtime 不可用，无法点击/等待流/看 network |
| T16 ServiceWorker 缓存排障 | N-R | 同上 | 否 | 是，runtime 不可用，无法读取 SW/network |
| T17 跨域 Iframe 授权 | N-R | 同上 | 否 | 是，runtime 不可用，无法操作 iframe |
| T18 文件上传输入 | N-R | 同上 | 否 | 是，runtime 不可用，无法上传文件 |
| T19 键盘可访问性 | N-R | 同上 | 否 | 是，runtime 不可用，无法键盘遍历/点击 |
| T20 回归稳定性 Flake 率 | N-R | 同上 | 否 | 是，runtime 不可用，无法运行 10 次检查 |

## 逐题细节

### T12 Console 与 SourceMap 定位

Prompt 要求打开 `/debug-console`，点击“应用优惠券”，用 Console / Network / source map 证据定位真实前端异常。

结果：N-R。@chrome runtime 未连接，无法打开页面、点击按钮、读取 console、network 或 source map。未使用其他浏览器工具代跑。

### T13 移动端布局遮挡

Prompt 要求设置移动端视口 `390x844`，打开 `/layout-mobile` 并尝试点击“提交支付”。

结果：N-R。@chrome runtime 未连接，无法设置视口、执行点击或收集遮挡证据。未使用其他浏览器工具代跑。

### T14 SPA 状态 Hydration 不一致

Prompt 要求打开 `/hydration`，诊断 hydration/state mismatch。

结果：N-R。@chrome runtime 未连接，无法读取页面最终状态或 console 报错。未使用其他浏览器工具代跑。

### T15 SSE 实时流等待

Prompt 要求打开 `/realtime`，点击“开始接收”，等待实时事件流完成。

结果：N-R。@chrome runtime 未连接，无法触发页面交互、等待 SSE 或读取 network。未使用其他浏览器工具代跑。

### T16 ServiceWorker 缓存排障

Prompt 要求打开 `/cache`，判断是否为 Service Worker 缓存导致，并对比页面旧值和实时接口真实值。

结果：N-R。@chrome runtime 未连接，无法读取页面、Service Worker 状态或 network 请求。未使用其他浏览器工具代跑。

### T17 跨域 Iframe 授权

Prompt 要求打开 `/iframe-auth`，在第三方授权 iframe 中点击“确认授权”。

结果：N-R。@chrome runtime 未连接，无法进入页面或操作 iframe。未使用其他浏览器工具代跑。

### T18 文件上传输入

Prompt 要求打开 `/input-lab`，上传 `apps/browser-tool-bench/fixtures/upload-token.txt`。

结果：N-R。@chrome runtime 未连接，无法打开页面或执行文件上传。未使用其他浏览器工具代跑。

### T19 键盘可访问性

Prompt 要求打开 `/a11y-modal`，只用键盘 Tab/Shift+Tab 检查弹窗保存按钮可达性。

结果：N-R。@chrome runtime 未连接，无法执行键盘遍历、焦点检查或鼠标验证。未使用其他浏览器工具代跑。

### T20 回归稳定性 Flake 率

Prompt 要求打开 `/flake`，运行页面上的“运行 10 次”检查。

结果：N-R。@chrome runtime 未连接，无法触发检查或统计页面结果。未使用其他浏览器工具代跑。

## 综合结论

本轮 T12-T20 全部为 N-R。直接原因是当前 Codex Chrome Plugin 无法访问 `extension` backend：Chrome 与 Native Host 均存在，但 selected Chrome profile 中 Codex Chrome Extension 处于 disabled 状态。

该结果只说明当前 Codex @chrome 工具环境不可用；没有对靶场页面本身、任务设计、服务状态或其他浏览器工具能力作失败判定。为保持公平性，本轮未用 agent-browser、Playwright、DevTools MCP、bb-browser 或脚本浏览器替代执行。
