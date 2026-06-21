# R09-retest — bb-browser 0.14.2 — Network/timing evidence

- 工具: bb-browser 0.14.2 (global), 通过 `--port 9224` attach 用户现有 CDP Chrome (Chrome/149.0.7827.116)
- 验证控的是 9224 既有实例: tab list 显示 11 个用户既有标签(localhost:4399 靶场、github 等),未自启新浏览器
- 目标 URL: https://ffffhx.github.io/garden-lab/post/agent/
- 最终 URL: https://ffffhx.github.io/garden-lab/post/agent/
- 观察时间: 2026-06-21 18:56:39 CST (UTC 2026-06-21T10:56:39Z) ~ 18:56:46 CST
- 站点可达性: 重测前 curl 4/4 全 200(上次 N-R 的"不可达"未复现)

## 证据采集方式
1. `trace start` → `reload` → `trace events --type request/response` → response.ts - request.ts 估算耗时 (任务卡允许的 Network/timing 等价证据)。文件: R09-retest-trace-requests.json / R09-retest-trace-responses.json / R09-retest-timing-computed.txt
2. 交叉验证(逃生): `eval` 读 PerformanceResourceTiming + Navigation Timing。文件: R09-retest-perf-resourcetiming.json
3. 截图: R09-retest-screenshot.png

## 关键导航指标 (Navigation Timing)
- responseEnd: 102 ms, domContentLoaded: 129 ms, loadEventEnd: 368 ms

## 最慢 3 个资源 (按 PerformanceResourceTiming duration)
1. https://8-218-149-148.anyip.dev/token-board/api/auth/me — 23558 ms — Fetch/XHR (后台 API,transferSize=0 即超时/挂起)
2. https://ffffhx.github.io/garden-lab/images/favicon.svg — 738 ms — Other (favicon)
3. https://ffffhx.github.io/garden-lab/category/tech/index.txt?_rsc=... — 329 ms — Fetch (Next.js RSC 预取)

(trace request/response 法因本次多为缓存命中,除 favicon.svg=742ms 外其余 <100ms;eval 法更能反映真实 duration,二者对 favicon 一致 ~740ms)

## 首屏影响判断
- token-board/auth/me (23.5s): **不影响首屏**。是页面 JS 发起的后台鉴权 fetch,异步、不阻塞渲染;DOMContentLoaded 已在 129ms 完成,loadEvent 368ms。它慢是因为该第三方 API (anyip.dev) 挂起/超时,与首屏内容无关。
- favicon.svg (738ms): **不影响首屏**。浏览器标签图标,低优先级、渲染后加载,不阻塞主内容。
- category/tech/index.txt RSC (329ms): **不影响首屏**。Next.js 路由预取,后台进行,用于后续导航加速。
- 真正构成首屏的 document(98ms)/CSS/JS chunk/字体/cover 图均 <100ms(多为缓存),首屏体验良好。
