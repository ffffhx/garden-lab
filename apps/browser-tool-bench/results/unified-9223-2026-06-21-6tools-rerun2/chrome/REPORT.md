# @chrome rerun2 benchmark report

- Tool: @chrome / Chrome plugin
- Browser mode: default-profile-fallback
- Strict CDP target: http://127.0.0.1:9223
- CDP proof: failed. @chrome opened proof URL but it was absent from 9223 /json/list, so profile-bound 9223 tasks were downgraded.
- Elapsed ms: 711915
- Tool calls: 61 estimated
- Browser ops: 245 estimated/tracked
- Escapes: total 105; eval_read 105; eval_action 0; cdp_escape 0; init_script 0
- Tokens/cost: unavailable
- Final Bench Badge baseline: BENCH EXT v1.0.0 at http://localhost:4399/?final_badge_baseline_chrome_rerun2=1782009163547

## Tally

✅ 15 / ⚠️ 2 / ❌ 1 / N-R 12 / N/A 1

## Key boundary notes

- @chrome could not prove control of 9223, so T10c is N-R and the run is marked default-profile-fallback.
- chrome://extensions was blocked by Browser Use URL policy; extension reload/options tasks were not bypassed.
- Chrome plugin exposed no Network response body, route/intercept, HAR/trace, or viewport emulation API in this session.
- Bench Badge state was not modified; final localhost badge remained BENCH EXT v1.0.0.

## Results

### T01 ✅

- Escape: false
- Answer: BENCH-7341
- Evidence: 登录后 http://localhost:4399/dashboard; 欢迎语包含 欢迎回来，Agent 测试员（工号 BENCH-7341）
- Notes: 通过 Chrome plugin 填表并等待 /dashboard 异步欢迎语

### T02 ❌

- Escape: false
- Answer: Chrome plugin 只能确认页面笼统失败文案/console，不能读取 Network response body，因此未能证明 /api/orders 500 与真实错误原因。
- Evidence: 页面: 提交失败，请稍后再试（错误码已上报）; console: log:当前浏览器已安装埋点验证插件true | log:当前浏览器已安装埋点验证插件true | log:当前浏览器已安装埋点验证插件true | log:当前浏览器已安装埋点验证插件true | log:当前浏览器已安装埋点验证插件true | log:当前浏览器已安装埋点验证插件true | log:当前浏览器已安装埋点验证插件true | error:order submit failed tr-8729a1411371
- Notes: 无 Network request/response-body API；未用 fetch POST 或 raw CDP 绕过

### T03 N-R

- Escape: true
- Answer: N-R: Chrome plugin 没有 trace/HAR/performance timing 能力；read-only evaluate 沙箱中 performance/window.performance 不可用，不能给出资源耗时或主线程证据。
- Evidence: 尝试读取 performance.getEntriesByType 报 TypeError；window.performance 返回不可用，resources/nav/paints/longtasks 为空；browser capabilities=[]，tab capabilities 只有 pageAssets（无 timing）。
- Notes: 未凭源码或记忆伪造 blocking.css/heavy.js/hero.svg 耗时结论

### T04 N-R

- Escape: false
- Answer: N-R: Chrome plugin 没有 route/mock/abort 能力，不能把 /api/users mock 成 {users:[]}.
- Evidence: browser capabilities=[]; tab capabilities=[{"id":"pageAssets","description":"List assets already observed in the current page state and bundle selected assets into a temporary local artifact."}]; 当前页面仍为真实成员列表，文本片段: Bench 靶场 控制台 团队成员  加载中…
- Notes: 未通过 DOM 伪造空状态，未截图虚假结果

### T05 ✅

- Escape: true
- Answer: 最终 12 条；最后口令 LIVE-512。
- Evidence: DOM items=12; last=系统公告：今日口令 LIVE-512; page contains LIVE-512=true
- Notes: 等待首屏按钮出现后点击加载更多，再等待第二页流式渲染完成

### T06 ✅

- Escape: true
- Answer: [{"name":"雷霆工作站","price":15999,"stock":2},{"name":"全画幅扫描仪","price":3699,"stock":3},{"name":"4K 专业显示器","price":2499,"stock":7},{"name":"人体工学椅","price":1899,"stock":0},{"name":"会议级摄像头","price":1599,"stock":11},{"name":"桌面监听音箱","price":1299,"stock":5},{"name":"降噪耳机 Pro","price":899,"stock":41},{"name":"便携 SSD 1TB","price":749,"stock":16},{"name":"USB-C 扩展坞","price":549,"stock":64},{"name":"电竞鼠标","price":459,"stock":0},{"name":"静音机械键盘","price":399,"stock":23},{"name":"智能护眼台灯","price":329,"stock":88}]; 最贵：雷霆工作站 15999 元
- Evidence: DOM main text parsed 12 products after second page; sorted top three=[{"name":"雷霆工作站","price":15999,"stock":2},{"name":"全画幅扫描仪","price":3699,"stock":3},{"name":"4K 专业显示器","price":2499,"stock":7}]
- Notes: 通过页面 DOM 文本读取两页商品，价格/库存清洗为数字

### T07 N-R

- Escape: true
- Answer: N-R: Chrome plugin read-only evaluate 沙箱没有 fetch/window.fetch，不能在页面 runtime 内请求 /api/me。
- Evidence: window.fetch /api/me result={"error":"TypeError: window.fetch is not a function\n    at __playwrightEvaluate (<anonymous>:2642:30)\n    at <anonymous>:2646:14\n    at runUserScript (<anonymous>:2647:10)\n    at <anonymous>:2651:10\n    at <anonymous>:2652:3"}
- Notes: 未用直接打开 /api/me 或 curl 代替页面内 fetch；这验证了 @chrome 的 console/fetch 边界

### T08 ✅

- Escape: false
- Answer: SHADOW-99
- Evidence: button count=1; shadowText="\n            \n              .box { border: 1px dashed #cfd3da; border-radius: 8px; padding: 14px; font-size: 14px; }\n              button { padding: 7px 16px; border: none; border-radius: 6px; background: #00a86b; color: #fff; cursor: pointer; }\n              .code { margin-top: 10px; font-weight: 700; color: #00a86b; }\n            \n            \n              每天可以领取一次奖励。\n              领取今日奖励\n              兑换码：SHADOW-99\n            "; snapshot has button=true
- Notes: 用 locator 点击 open shadow root 内按钮，再读 shadow DOM 文本验证

### T09 N-R

- Escape: false
- Answer: N-R: @chrome fallback profile 中有 Bench Badge v1.0.0，但 Chrome plugin 无 extension reload API，且 chrome://extensions 被 Browser Use URL policy 拒绝；本 worker 也被限制只能写 results/chrome，未改 manifest 到 1.0.1。
- Evidence: Baseline badge check showed BENCH EXT v1.0.0; chrome://extensions navigation rejected; browser capabilities=[]; tab capabilities only pageAssets.
- Notes: 未修改 manifest/storage，保持基线

### T10a ✅

- Escape: true
- Answer: 观察时间 2026-06-21T02:28:18.060Z; unread total=70; 标题 70 条: ffffhx/garden-lab – CI #387: CI workflow run failed for main branch | ffffhx/garden-lab – CI #386: CI workflow run failed for main branch | ffffhx/garden-lab – CI #376: CI workflow run failed for main branch | ffffhx/garden-lab – CI #375: CI workflow run failed for main branch | ffffhx/open-token-board – CI #41: CI workflow run failed for main branch | ffffhx/profilepilot – Build Release Packages #7: Build Release Packages workflow run failed for main branch | ffffhx/profilepilot – Build Release Packages #3: Build Release Packages workflow run failed for v0.1.0 branch | ffffhx/profilepilot – Build Release Packages #2: Build Release Packages workflow run failed for v0.1.0 branch | ffffhx/profilepilot – Build Release Packages #1: Build Release Packages workflow run failed for v0.1.0 branch | ffffhx/codex-snapshots – CI #18: CI workflow run failed for main branch | ffffhx/garden-lab – CI #340: CI workflow run failed for main branch | ffffhx/garden-lab – CI #339: CI workflow run failed for main branch | ffffhx/garden-lab – CI #338: CI workflow run failed for main branch | ffffhx/codex-snapshots – CI #17: CI workflow run failed for main branch | ffffhx/codex-snapshots – CI #16: CI workflow run failed for main branch | ffffhx/codex-snapshots #2: Refactor snapshot runtime and secure local publishing | ffffhx/codex-snapshots #1: Refactor site to React TypeScript Tailwind | ffffhx/garden-lab – CI #325: CI workflow run failed for main branch | ffffhx/garden-lab – CI #300: CI workflow run failed for main branch | ffffhx/codex-snapshots – Deploy Pages #2: Deploy Pages workflow run failed for main branch | ffffhx/codex-snapshots – Deploy Pages #1: Deploy Pages workflow run failed for main branch | ffffhx/garden-lab – CI #268: CI workflow run failed for main branch | ffffhx/garden-lab – CI #228: CI workflow run failed for main branch | ffffhx/garden-lab – Deploy To GitHub Pages #109: Deploy To GitHub Pages workflow run failed for main branch | ffffhx/garden-lab – CI #227: CI workflow run failed for main branch | ffffhx/garden-lab – Deploy To GitHub Pages #108: Deploy To GitHub Pages workflow run failed for main branch | ffffhx/garden-lab – Deploy To GitHub Pages #107: Deploy To GitHub Pages workflow run failed for main branch | ffffhx/garden-lab – CI #226: CI workflow run failed for main branch | ffffhx/garden-lab – CI #140: CI workflow run failed for main branch | ffffhx/garden-lab – CI #138: CI workflow run failed for main branch | ffffhx/garden-lab – CI #137: CI workflow run failed for main branch | ffffhx/garden-lab – CI #136: CI workflow run failed for main branch | ffffhx/garden-lab – CI #135: CI workflow run failed for main branch | ffffhx/garden-lab – Deploy To GitHub Pages #91: Deploy To GitHub Pages workflow run failed for main branch | ffffhx/garden-lab – CI #134: CI workflow run failed for main branch | ffffhx/garden-lab – Deploy To GitHub Pages #90: Deploy To GitHub Pages workflow run failed for main branch | ffffhx/garden-lab – Deploy To GitHub Pages #89: Deploy To GitHub Pages workflow run failed for main branch | ffffhx/garden-lab – CI #116: CI workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #148: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #141: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #134: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #133: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #129: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #127: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #126: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #120: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #119: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #118: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #103: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #102: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #101: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #100: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #93: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #92: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #80: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #77: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #76: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #75: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #74: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #70: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #52: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #48: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #44: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #43: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #41: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #32: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #27: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Sync Token Usage #11: Sync Token Usage workflow run failed for main branch | ffffhx/garden-lab – Deploy GitHub Pages #2: Deploy GitHub Pages workflow run failed for main branch | ffffhx/garden-lab – Deploy GitHub Pages #1: Deploy GitHub Pages workflow run failed for main branch
- Evidence: GitHub notifications default profile; urls=["https://github.com/notifications?query=is%3Aunread&r02_chrome_rerun2=1782008902869","https://github.com/notifications?after=Y3Vyc29yOjI1&query=is%3Aunread","https://github.com/notifications?after=Y3Vyc29yOjUw&query=is%3Aunread"]; sidebar Inbox=70; collected 70 visible notification rows; first5=["ffffhx/garden-lab – CI #387: CI workflow run failed for main branch","ffffhx/garden-lab – CI #386: CI workflow run failed for main branch","ffffhx/garden-lab – CI #376: CI workflow run failed for main branch","ffffhx/garden-lab – CI #375: CI workflow run failed for main branch","ffffhx/open-token-board – CI #41: CI workflow run failed for main branch"]
- Notes: default-profile-fallback；只读打开 GitHub notifications，未点击任何写状态控件

### T10b N/A

- Escape: false
- Answer: N/A: @chrome 依赖系统默认 Chrome/Codex 扩展所在 profile，不提供工具自管专用 profile/state save-load 机制。
- Evidence: Chrome plugin browser capabilities=[];本轮已按 default-profile-fallback 运行 T10a；没有 dedicated profile persistence API.
- Notes: 不使用默认 profile 冒充 T10b 专用 profile

### T10c N-R

- Escape: false
- Answer: N-R: @chrome 打开的唯一 proof URL 未出现在 http://127.0.0.1:9223/json/list，不能证明绑定指定 9223。
- Evidence: proofUrl=http://localhost:4399/?chrome-proof-1782008530563=1; /json/list jq filter returned no matching target; Chrome plugin openTabs showed proof tab in default-profile session group.
- Notes: 按 brief 使用 default-profile-fallback；未用 9223 代跑 T10c

### T11 N-R

- Escape: false
- Answer: N-R: 当前 profile 有 Bench Badge 注入，但 Chrome plugin 安全策略阻止 chrome://extensions，无法发现扩展 ID 或打开 chrome-extension:// options 页改写 HELLO-2026。
- Evidence: badge baseline BENCH EXT v1.0.0; chrome://extensions attempt returned Browser Use URL policy rejection.
- Notes: 未直接写 chrome.storage；未改变扩展状态

### T12 ⚠️

- Escape: false
- Answer: 看到 console coupon crash，但 Chrome plugin 无 source-map/source 内容读取能力，未能证明 webpack://bench/src/cart/coupon.ts 与 applySelectedCoupon guard。
- Evidence: page=应用失败，请联系管理员（错误码已上报）; console=log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | error:order submit failed tr-8729a1411371 @ http://localhost:4399/dashboard | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | log:当前浏览器已安装埋点验证插件true @ chrome-extension://ngbeieahpajgaoakojeamhkacekiicfk/js/inject.min.js | error:checkout coupon crash Object @ http://localhost:4399/assets/debug-bundle.js
- Notes: tab.dev.logs 可读 console；无 Network/source-map API，未用本地源码或 curl 代替

### T13 N-R

- Escape: false
- Answer: N-R: Chrome plugin 没有设置移动端 viewport/设备模拟的 API，本轮无法按 390x844 真实点击复现遮挡。
- Evidence: current page=http://localhost:4399/layout-mobile; capabilities={"browserCaps":[],"tabCaps":[{"id":"pageAssets","description":"List assets already observed in the current page state and bundle selected assets into a temporary local artifact."}]}; 未执行 JS 强点或 CSS 伪造
- Notes: 不把静态知识当作移动视口点击证据

### T14 ✅

- Escape: true
- Answer: 组件 TaskSummary；traceId HYD-908；SSR pendingTasks=8, planName=starter；Client pendingTasks=9, planName=team-pro；最终显示 9 个待办、team-pro 套餐。
- Evidence: DOM attrs/text={"component":"TaskSummary","pending":{"clientText":"9","ssr":"8"},"plan":{"clientText":"team-pro","ssr":"starter"},"status":"客户端已接管，traceId=HYD-908","text":"Bench 靶场\n任务概览\n\n待办数量：9\n\n套餐：team-pro\n\n客户端已接管，traceId=HYD-908"}; console=当前浏览器已安装埋点验证插件true | [hydration mismatch] Object | 当前浏览器已安装埋点验证插件true | 当前浏览器已安装埋点验证插件true | 当前浏览器已安装埋点验证插件true | 当前浏览器已安装埋点验证插件true | 当前浏览器已安装埋点验证插件true | 当前浏览器已安装埋点验证插件true | 当前浏览器已安装埋点验证插件true | [hydration mismatch] Object
- Notes: DOM data-ssr-value 给出 SSR 值，接管后 textContent 给出 client 值

### T15 ✅

- Escape: true
- Answer: 共收到 5 条事件；最后一条 id=evt-005；关键告警 code=STREAM-721。
- Evidence: DOM text=Bench 靶场 | 实时事件流 |  | 点击开始后，页面会通过 EventSource 接收 5 条事件。 |  | 开始接收 |  | 接收完成：5 条事件，关键告警 STREAM-721 |  | evt-001 · connected · SSE 通道已建立 | evt-002 · metric · checkout_latency_ms | evt-003 · metric · cart_items | evt-004 · notice · 库存同步完成 | evt-005 · alert · STREAM-721; rows=["evt-001 · connected · SSE 通道已建立","evt-002 · metric · checkout_latency_ms","evt-003 · metric · cart_items","evt-004 · notice · 库存同步完成","evt-005 · alert · STREAM-721"]
- Notes: 通过页面按钮触发 SSE，等待 DOM summary 完整

### T16 ⚠️

- Escape: true
- Answer: 页面旧值可见，但 live API 未能完整读取。
- Evidence: cache page=Bench 靶场 | 配置中心 |  | 页面会读取 /api/settings，但 Service Worker 故意返回过期配置。 |  | 主题 | blue | 版本 | cached-2025.11 | Feature Flag | STALE-CACHE-17 |  | Service Worker 已控制页面; sw={"error":"TypeError: Cannot read properties of undefined (reading 'serviceWorker')\n    at __playwrightEvaluate (<anonymous>:2641:138)\n    at <anonymous>:2642:14\n    at runUserScript (<anonymous>:2643:10)\n    at <anonymous>:2647:10\n    at <anonymous>:2648:3"}; 127 live API=Browser Use cannot open http://127.0.0.1:4399/api/settings in tab 745248831. Browser reported: net::ERR_BLOCKED_BY_CLIENT
- Notes: localhost /api/settings?live=1 被默认 Profile 客户端拦截，改用浏览器访问 127.0.0.1 同服务 live URL；未用 curl

### T17 ✅

- Escape: false
- Answer: iframe-user@bench.dev / OAUTH-314
- Evidence: frame button count=1; parent text=Bench 靶场 | 第三方授权 |  | 下方 iframe 来自 127.0.0.1，与 localhost 页面不同源。 |  | 授权完成：iframe-user@bench.dev / OAUTH-314
- Notes: 使用 frameLocator 操作跨 origin iframe 并从父页读取 postMessage 结果

### T18 ✅

- Escape: false
- Answer: upload-token.txt, 36 bytes, token=UPLOAD-448
- Evidence: filechooser flow; page=Bench 靶场 | 上传凭证 |  | 选择或拖入 fixture 文件，页面会在本地解析 token。 |  | 也可以把文件拖到这里 |  | 文件 upload-token.txt，36 bytes，token=UPLOAD-448
- Notes: 使用 Chrome plugin file chooser setFiles 真实上传本地 fixture

### T19 ✅

- Escape: true
- Answer: 键盘不能到达/激活“保存偏好”：#save-preferences 是 role=button 的 div，但缺 tabindex=0，且不在 data-trap-focus 列表中，也无键盘 handler；鼠标保存确认码 A11Y-204。
- Evidence: keyboard active after Tabs=notify-email; save={"cls":"fake-button save-preferences","role":"button","tabindex":null,"tag":"DIV","text":"保存偏好","trapFocus":false}; trap=[{"id":"notify-email","tag":"INPUT","text":"agent@bench.dev"},{"id":"close-modal","tag":"BUTTON","text":"关闭"}]; mouse result=A11Y-204
- Notes: 执行 Tab 键检查，再用鼠标点击保存读取确认码

### T20 ✅

- Escape: true
- Answer: 通过 7/10，失败 3/10，失败轮次 3、6、9，稳定性代码 FLAKE-307；不稳定，flake rate=30%。
- Evidence: summary=通过 7/10，失败轮次 3,6,9，稳定性代码 FLAKE-307; rows=[["1","PASS","FLAKE-307"],["2","PASS","FLAKE-307"],["3","FAIL","FLAKE-307"],["4","PASS","FLAKE-307"],["5","PASS","FLAKE-307"],["6","FAIL","FLAKE-307"],["7","PASS","FLAKE-307"],["8","PASS","FLAKE-307"],["9","FAIL","FLAKE-307"],["10","PASS","FLAKE-307"]]
- Notes: 等待 summary 完成后统计表格，不按首个 FLAKE-307 过早结束

### R01 ✅

- Escape: true
- Answer: 页面/文件标题：Auto-waiting | Playwright; Locator.click checks: Visible, Stable, Receives Events, Enabled. 最终 URL: https://playwright.dev/docs/actionability
- Evidence: opened GitHub repo then official docs; title=Auto-waiting | Playwright; text has Visible=true, Stable=true, Receives Events=true, Enabled=true; excerpt=
- Notes: 只通过浏览器页面读取官方 Playwright 文档；未用本地源码/终端

### R02 ✅

- Escape: true
- Answer: 观察时间 2026-06-21T02:28:22.869Z; final URL https://github.com/notifications?query=is%3Aunread&r02_chrome_rerun2=1782008902869; unread total=70; 前 5 个仓库: ffffhx/garden-lab, ffffhx/codex-snapshots, ffffhx/profilepilot, ffffhx/open-token-board, vercel-labs/agent-browser
- Evidence: GitHub notifications default profile; sidebar Inbox=70; repositories list showed ffffhx/garden-lab=58, ffffhx/codex-snapshots=7, ffffhx/profilepilot=4, ffffhx/open-token-board=1, vercel-labs/agent-browser; notification pages sampled=["https://github.com/notifications?query=is%3Aunread&r02_chrome_rerun2=1782008902869","https://github.com/notifications?after=Y3Vyc29yOjI1&query=is%3Aunread","https://github.com/notifications?after=Y3Vyc29yOjUw&query=is%3Aunread"]
- Notes: 真实站点只读；未点击任何通知操作

### R03 ✅

- Escape: true
- Answer: 主标题：Fetch API；前三个接口：Fetch, Request, Response；页面显示 Baseline/compatibility 信息：是；最终 URL: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- Evidence: title=Fetch API - Web APIs | MDN; interfaces excerpt=Interfaces | HTTP headers | Specifications | Browser compatibility | See also | Concepts and usage |  | The Fetch API uses Request and Response objects (and other things involved with network requests), as well as related concepts such as CORS and the HTTP Origin header semantics. |  | For making a request and fetching a resource, use the fetch() method. It is a global method in both Window and Worker contexts. This makes it available in pretty much any context you might want to fetch resources in. |  | The fetch() method takes one mandatory argument, the path to the resource you want to fetch. It returns a Promise that resolves to the Response to that request — as soon as the server responds with headers — even if the server response is an HTTP error status. You can also optionally pass i; baselineOrCompat=true
- Notes: 通过浏览器打开 MDN 并读取文档页文本

### R04 ✅

- Escape: false
- Answer: 观察时间 2026-06-21T02:31:55.286Z; version=1.61.0; license=Apache-2.0; weekly downloads=38,582,078; unpacked size=页面未显示/未定位; repo=https://github.com/microsoft/playwright; final URL=https://www.npmjs.com/package/@playwright/test
- Evidence: DOM snapshot metadata lines=["- heading \"Repository\" [level=3]","- paragraph:","- link \"Repository github.com/microsoft/playwright\":","- /url: https://github.com/microsoft/playwright","- text: github.com/microsoft/playwright","- heading \"Homepage\" [level=3]","- paragraph:","- link \"Homepage playwright.dev\":","- /url: https://playwright.dev","- text: playwright.dev","- button \"Showing weekly downloads\":","- heading \"Weekly Downloads\" [level=3]:","- text: Weekly Downloads","- paragraph: 38,582,078","- heading \"Version\" [level=3]","- paragraph: 1.61.0","- button \"View more provenance details\":","- heading \"License\" [level=3]","- paragraph: Apache-2.0","- heading \"Last publish\" [level=3]","- paragraph:","- time: 20 hours ago"]; snapshot title=@playwright/test - npm
- Notes: 使用 Chrome plugin DOM snapshot；evaluate 在 npm 页被扩展/gallery限制阻断，未用 npm CLI/curl

### R05 N-R

- Escape: false
- Answer: N-R: Chrome plugin 对 Chrome Web Store / extensions gallery 页面报 “The extensions gallery cannot be scripted”，无法安全读取详情页状态或主按钮文案。
- Evidence: Navigation/read attempt to https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi failed with Chrome plugin error: The extensions gallery cannot be scripted / Detached while handling command.
- Notes: 未点击安装、登录、评分；未用其它工具或 raw CDP 绕过 Web Store 限制

### R06 N-R

- Escape: false
- Answer: 真实网站初始注入徽标=BENCH EXT v1.0.0; 但 Chrome plugin 阻止 chrome://extensions / chrome-extension settings，无法通过 options 页改为 REAL-SITE-2026。
- Evidence: {"url":"https://ffffhx.github.io/garden-lab/post/agent/?r06_chrome_rerun2=1782009138839","title":"浏览器 Agent 工具怎么选：@chrome、@browser、agent-browser、bb-browser、Chrome DevTools MCP、playwright-cli 二十任务实测 | Garden Lab","snapHasBadgeText":false,"eval":{"badge":"BENCH EXT v1.0.0","title":"浏览器 Agent 工具怎么选：@chrome、@browser、agent-browser、bb-browser、Chrome DevTools MCP、playwright-cli 二十任务实测 | Garden Lab","url":"https://ffffhx.github.io/garden-lab/post/agent/?r06_chrome_rerun2=1782009138839"}}; chrome://extensions attempt rejected by Browser Use URL policy
- Notes: 仅验证注入；未修改真实网站或扩展 storage

### R07 N-R

- Escape: false
- Answer: N-R: Chrome plugin 没有 Network request 列表/response body API，不能读取 npm 元数据响应体、状态码与 content-type。
- Evidence: browser capabilities=[]; tab capabilities=[pageAssets only]; R04 仅能通过 DOM snapshot 读取页面字段。
- Notes: 未用终端 curl/npm CLI 或页面可见文本冒充 Network response body

### R08 N-R

- Escape: false
- Answer: N-R: Chrome plugin 没有 route/abort/intercept API，不能在浏览器层拦截 MDN 图片资源请求。
- Evidence: browser capabilities=[]; tab capabilities=[pageAssets only]; no route/mock/abort primitive in Chrome plugin documentation.
- Notes: 未用 CSS/JS 隐藏图片冒充网络拦截

### R09 N-R

- Escape: false
- Answer: N-R: Chrome plugin 没有 HAR/trace/network timing API；read-only evaluate 环境也无 performance/window.performance timing，可打开页面但不能列出最慢 3 个资源及耗时证据。
- Evidence: T03 performance attempts returned unavailable timing; capabilities only pageAssets, which lists assets but no timing/HAR.
- Notes: 未按模型记忆或截图内容伪造性能结论
