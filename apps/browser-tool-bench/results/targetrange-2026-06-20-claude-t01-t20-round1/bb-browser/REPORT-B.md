# REPORT-B · bb-browser 0.14.2 · 靶场 T11-T20 (chunk B)

- 工具：bb-browser 0.14.2（全局命令，Bash 驱动）
- 浏览器接入：CDP 9223 测试 Chrome 149（`bb-browser --port 9223 ...`），导航 localhost:4399。已验证连接（`/json/version` → Chrome/149.0.7827.116，`status` → CDP connected: yes）。
- 日期：2026-06-20

## 关键环境缺陷（影响 T15 / T16 / T17 / T20）

`localhost:4399` 实际由**两个过期/不匹配的服务进程**监听，均缺失新版 API 路由：
- PID 1762 IPv6 `*:4399` → `node .../server.mjs`，启动于 **6/12 19:59**（`localhost` 默认解析到这里）。
- PID 74361 IPv4 `127.0.0.1:4399` → `node dist/cli/codex-snapshot.mjs serve`，启动于 **6/14**。

而磁盘上的 `server.mjs` 修改于 **6/19 20:36**（晚于 PID 1762 启动），其中才定义了 `/api/settings`(L199)、`/api/flake-check`(L204)、`/api/realtime-events`(L214)、以及 `iframe-child.html`。运行中的进程是旧构建。

实测（curl 与 CDP 浏览器同源 fetch 双重验证）：
- `/api/feed` `/api/products` `/api/users` → 200（旧路由，可用）
- `/api/settings`（网络）→ 404；浏览器看到 200 **仅因残留 Service Worker `sw-cache.js` 拦截**返回 stale 数据
- `/api/settings?live=1` → 404
- `/api/flake-check?run=N` → 404
- `/api/realtime-events`（EventSource）→ 404
- `http://127.0.0.1:4399/iframe-child.html` → 404（IPv4 由 codex-snapshot 服务，无此文件；同名文件在 localhost/IPv6 返回 200）

> 未重启服务器（超出本 chunk 职责、属共享基础设施，重启可能干扰其他 chunk）。受影响任务如实记 N-R / 部分 并附证据，未凭磁盘源码/记忆补 Ground Truth。

## bb-browser 工具短板（本轮实测）

1. **chrome-extension:// / chrome:// URL 归一化 bug**：`open`/`goto` 对所有非 http(s) scheme 强行前缀 `https://`，得到 `https://chrome-extension://...` → 实际加载 `chrome-error://chromewebdata/`。导致 T11 无法到达扩展 options 页、也无法打开 `chrome://extensions`。
2. **无 viewport/emulate/resize 命令**：无法设置移动端视口（T13）。用原始 CDP `Emulation.setDeviceMetricsOverride` 逃生补齐。
3. **无 upload/file-chooser 命令**：无法走文件选择器上传（T18）。用原始 CDP `DOM.setFileInputFiles` 逃生（仍是浏览器原生上传路径）。
4. **console 捕获不完整**：page 上下文的 `console.error`（T12 的 `checkout coupon crash`、T14 的 `[hydration mismatch] Object`）未被 `console`/`errors` 命令捕获，且对象参数不展开。改用 `source grep` + source map + `window.__BENCH_STORE__` 取证。
5. **snapshot ref 的 click 偶发不触发 handler**：T13/T19 用 snapshot ref `click` 报 “已点击” 但页面 handler 未执行；改用 `eval ...click()` 触发真实 handler。
6. 跨域 iframe 内容未内联进 snapshot（T17，需 CDP 进 frame target）。

## 逐任务结果

| 任务 | 判定 | 逃生 | 关键值 | 说明 |
| --- | --- | --- | --- | --- |
| T11 | ❌ | 否 | — | URL 归一化 bug，无法到达 chrome-extension:// options 页；扩展无 SW/page target 可附加。徽标保持默认未改，无需恢复。 |
| T12 | ✅ | 否 | coupon.ts / applySelectedCoupon | source map sources=`webpack://bench/src/cart/coupon.ts`，函数 `applySelectedCoupon`，空字段 `cartState.selectedCoupon.couponCode`（selectedCoupon=null），guard `if(!cartState.selectedCoupon) return null;`（源码注释原文）。 |
| T13 | ✅ | 是* | MOBILE-39 | CDP 模拟 390×844 后复现；`.mobile-support-bar[data-bug="overlaps-pay-button"]`（fixed bottom:0 / h:118px / z-index:20）覆盖支付按钮（z-index:10 / bottom:40px），elementFromPoint 命中其内 DIV；触发按钮得 `支付确认码：MOBILE-39`。 |
| T14 | ✅ | 否 | HYD-908 | `window.__BENCH_STORE__`：component=`TaskSummary`，traceId=`HYD-908`，SSR(pendingTasks=8,planName=starter) vs Client(9,team-pro)；最终 DOM “待办数量：9 / 套餐：team-pro / 客户端已接管”。 |
| T15 | N-R | 否 | — | 环境缺陷：EventSource `/api/realtime-events` 在运行服务返回 404，页面 “连接异常，事件未收全”，0 事件。bb-browser 能抓到 EventSource 请求及其 404，但后端无此路由。 |
| T16 | ⚠️ | 否 | STALE-CACHE-17（真实值不可得） | 已证明 SW 缓存：`sw-cache.js` scope `/` activated，`/api/settings` 带 header `X-Bench-Cache: service-worker-stale`，stale 值 theme=blue/release=cached-2025.11/featureFlag=STALE-CACHE-17，修复=注销/更新 SW。但 `?live=1` 真实值（应 green/CACHE-BUST-42）在运行服务 404，真实值无法验证 → 部分。 |
| T17 | N-R | 否 | — | 环境缺陷：跨域 iframe `http://127.0.0.1:4399/iframe-child.html` 返回 “not found”（IPv4 端口由 codex-snapshot 服务，无此文件）。无授权按钮可点，postMessage 不会触发。用原始 CDP 进入 frame target 确认其 body 为 “not found”。 |
| T18 | ✅ | 是* | UPLOAD-448 | bb-browser 无上传命令，用 CDP `DOM.setFileInputFiles` 走原生 file input；页面解析 “文件 upload-token.txt，36 bytes，token=UPLOAD-448”。 |
| T19 | ✅ | 否 | A11Y-204 | `#save-preferences` 为 `<div role="button">`，缺 `tabindex="0"`、不在 `[data-trap-focus]`（trap 仅含 #notify-email、#close-modal）、无 Enter/Space handler → 键盘无法聚焦/激活。鼠标点击得 “保存成功：A11Y-204”。 |
| T20 | N-R | 否 | — | 环境缺陷：`/api/flake-check?run=N` 在运行服务全部 404，页面表格空（“尚未运行”）。无法观测 7/10、3/6/9、FLAKE-307。bb-browser 可脚本化 10 次 fetch，瓶颈在后端缺路由。 |

* 逃生 = 用了原始 CDP 协议补 bb-browser 缺失的能力（viewport 模拟 / 文件上传）；均仍走浏览器原生路径，未伪造结果。

## 恢复确认

- T11 未修改扩展徽标（无法到达设置页），徽标保持默认 `BENCH EXT v1.0.0`，无需恢复。
- 残留 Service Worker `sw-cache.js`（scope /）是先前 T16 轮遗留，非本轮注册；本轮未注销它。
- 工作 tab eff8 及临时破损扩展 tab 已关闭；未动其他既有 tab。
