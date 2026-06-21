# REPORT-B · playwright-cli · 靶场 T11–T20 (chunk B)

- 工具：playwright-cli 0.1.14（自管浏览器：default 会话 channel=chrome 自启；T11 用 chromium-1226=Chrome for Testing + launchPersistentContext + `--load-extension`）
- 日期：2026-06-20 · 靶场 http://localhost:4399（本地）
- 接入：按用户约定**用 playwright-cli 自管浏览器**，未 attach 9223。

## 环境根因（影响 T15 / T16 / T17 / T20）

抓证据时发现两处**环境缺陷**（非工具能力问题）：

1. **靶场服务进程陈旧**：监听 `*:4399`(IPv6) 的 bench 服务 PID **1762 启动于 6/12 19:59**，而 `server.mjs` 最后修改于 **6/19 20:36**（新增 `/api/realtime-events`、`/api/flake-check`、`/api/settings` 等路由）。运行中的进程加载的是旧模块，**没有这些新路由**。
   - 验证：`/api/products`(旧)→200；`/api/realtime-events`、`/api/settings?live=1`、`/api/flake-check?run=1` 全部→**404**（curl + 浏览器 Network 双重确认）。证据 `ENV-stale-server-rootcause.txt`。
2. **127.0.0.1:4399 端口被占**：另一进程 PID **74361 = `codex-snapshots serve --port 4399`** 占着 IPv4 `127.0.0.1:4399`。T17 跨域 iframe `http://127.0.0.1:4399/iframe-child.html` 因此打到 codex-snapshots(404)，而非 bench(其 `localhost:4399/iframe-child.html`=200，文件存在)。证据 `T17-rootcause.txt`。

按铁律「不改任务外状态」「跑不通如实记」，**未重启/杀掉这两个共享进程**。受影响任务如实记 ❌/⚠️ 并附根因。

## 逐任务结果

| 任务 | 结果 | 关键答案 | 证据 |
| --- | --- | --- | --- |
| T11 使用扩展 | ✅ | 徽标 `HELLO-2026 · v1.0.0`；扩展 ID `jkmndkochpgaleoechlemhdhbikdecnf` | T11-badge-HELLO-2026.png |
| T12 Console/SourceMap | ✅ | 文件 `webpack://bench/src/cart/coupon.ts`，函数 `applySelectedCoupon`，空字段 `cartState.selectedCoupon.couponCode`(selectedCoupon=null)，guard `if (!cartState.selectedCoupon) return null;` | T12-console.txt / T12-debug-bundle.js.map |
| T13 移动端遮挡 | ✅ | `.mobile-support-bar[data-bug="overlaps-pay-button"]`(fixed,bottom:0,height:118px,z-index:20) 盖住 `.checkout-actions`(z-index:10)；确认码 `MOBILE-39` | T13-overlay-blocking.png / T13-code-MOBILE-39.png |
| T14 Hydration | ✅ | 组件 `TaskSummary`，traceId `HYD-908`，SSR pendingTasks=8/planName=starter，Client 9/team-pro；最终 9 待办 team-pro | T14-console.txt / T14-store.txt |
| T15 SSE 流 | ❌(env) | `/api/realtime-events`→**404**(陈旧服务)，EventSource 报错，0 条事件，拿不到 5/evt-005/STREAM-721 | T15-requests.txt / T15-stream-error.png |
| T16 SW 缓存 | ⚠️(env) | **已证 SW 拦截**：`/api/settings`→200 带 `X-Bench-Cache: service-worker-stale`，旧值 theme=blue/release=cached-2025.11/featureFlag=STALE-CACHE-17；修复=更新/注销 SW。**真实 live 值取不到**：`/api/settings?live=1`→404(陈旧服务) | T16-sw-bypass.json / T16-cache-stale.png |
| T17 跨域 iframe | ❌(env) | iframe `http://127.0.0.1:4399/iframe-child.html` 打到 codex-snapshots(占端口)→404，无「确认授权」按钮，拿不到 OAUTH-314 | T17-rootcause.txt / T17-iframe-notfound.png |
| T18 文件上传 | ✅ | 真实 file chooser 上传 `upload-token.txt`；页面解析 `文件 upload-token.txt，36 bytes，token=UPLOAD-448` | T18-upload-result.png |
| T19 键盘可访问性 | ✅ | Tab 只在 #notify-email↔#close-modal 循环，永不到 `#save-preferences`(`<div role=button>` 缺 tabindex=0、无 Enter/Space handler、未入 focus trap)；鼠标点击→`保存成功：A11Y-204` | T19-a11y-findings.txt / T19-a11y-saved.png |
| T20 Flake 率 | ❌(env) | `/api/flake-check?run=1`→**404**(陈旧服务)，表格空、状态停在"尚未运行"，拿不到 7/10/FLAKE-307/30% | T20-requests.txt / T20-flake-empty.png |

## 工具行为观察

- 自管浏览器对本地靶场完全够用：导航/快照/键盘/上传/Network/console/eval 都顺。
- 扩展（T11）一等公民：`--config`(launchOptions.args+userDataDir)+`--persistent` 用 CfT 加载已解压扩展；`chrome://extensions` 可达且 Playwright 穿透 shadow DOM 直接读出扩展 ID；`chrome-extension://<id>/options.html` 作为普通 tab，fill/click 走真实 UI，保存提示语逐字匹配。改完**已恢复默认徽标**并销毁 /tmp 临时 profile。
- T13 click 超时日志自带遮挡诊断：直接点名 `<aside class="mobile-support-bar" data-bug="overlaps-pay-button"> subtree intercepts pointer events`。
- Network/SW 证据能力强：requests/response-headers + 页内 fetch eval 证明 SW 拦截(X-Bench-Cache)与 live bypass 的 404，是 T16 定性关键。
- eval 标注：T13 用 eval 把遮挡条 display:none(即真实修复"移除遮挡")后再做**真实** click 触发 MOBILE-39，属 DOM 修改+真实点击非 force-click，标 escape*；其余 eval 均为只读观察(computed style/__BENCH_STORE__/activeElement/fetch 状态码)；T11/T12/T14/T18/T19 主操作走真实 UI 无旁路。

## 复跑 env-blocked 任务前置

需重启 bench 服务（确保加载 6/19 版 server.mjs）并释放 127.0.0.1:4399（停 codex-snapshots serve 或换端口）。届时 T15/T16-live/T17/T20 可正常取证。
