# REPORT-A · agent-browser 0.27.2 · 靶场 T01-T11 (chunk A) · Round2 干净复跑

- 日期：2026-06-20 ; 工具：agent-browser 0.27.2 (CLI/Bash)
- 接入：`close --all` 后全程 `--cdp 9223`（Chrome 149 默认 profile，已登录 GitHub user=ffffhx，装 content-script-only 扩展 Bench Badge id jkmndkochpgaleoechlemhdhbikdecnf）
- 账号：agent@bench.dev / bench-2026 ; 独立判定，未参考第1轮/Codex/外场。

## 结果汇总

| 任务 | 判级 | 答案 | 关键证据 |
| --- | --- | --- | --- |
| T01 | ✅ | BENCH-7341 | 登录跳 /dashboard，欢迎语含「工号 BENCH-7341」(t01-dashboard.png) |
| T02 | ✅ | POST /api/orders 500 INSUFFICIENT_INVENTORY「SKU-8821 库存不足，剩余 0 件」 | network requests 抓 500；body 经页内同会话 fetch 重放读取 (t02-evidence.txt) |
| T03 | ✅ | LCP 主因 blocking.css，次 heavy.js 长任务，hero.svg 干扰项 | blocking.css 1213ms render-blocking；trace heavy.js EvaluateScript 800ms 串行；hero.svg 1500ms 并行先于首绘；FCP 2064ms (t03-evidence.txt/t03-trace.json) |
| T04 | ✅ | 空状态 UI(🪴+「暂无成员，去邀请第一位伙伴吧」+「邀请成员」) | route **/api/users -> {"users":[]} 后截图；事后 unroute 恢复 18 (t04-empty-state.png) |
| T05 | ✅ | 12 条，末条口令 LIVE-512 | 8 条 -> 加载更多 -> 4 条，li=12，末「系统公告：今日口令 LIVE-512」(t05-livefeed.png) |
| T06 | ✅ | 12 件，最贵 雷霆工作站 ¥15999 | /api/products?page=1/2 直取 JSON，排序与卡内完全一致 (t06-products.json) |
| T07 | ✅ | plan=team-pro-2026 | 登录态页内 eval fetch('/api/me')->200 plan=team-pro-2026 |
| T08 | ✅ | SHADOW-99 | a11y snapshot 穿透 open shadow，按 ref 点「领取今日奖励」->「兑换码：SHADOW-99」(t08-shadow.png) |
| T09 | ✅ | reload 成功 徽标 v1.0.1 | manifest 1.0.0->1.0.1；chrome://extensions 页内 chrome.developerPrivate.reload->徽标 v1.0.1；做完改回 1.0.0 reload 恢复 (t09-badge-v101.png) |
| T10a | ✅ | 未读 70 条（默认 profile 零打断） | 9223 已登录 ffffhx 直达 notifications 无登录墙；Inbox 70 = garden-lab58+codex-snapshots7+profilepilot4+open-token-board1 (t10a-evidence.txt) |
| T10b | ✅ | 专用 profile 免登录恢复，读到同样 70 未读 | --cdp 9223 state save->1MB 含 GitHub user_session；全新自管 session --state 加载直达 notifications onLogin=false；关会话再起新 session 仍免登录(重启存活)；无风控；测毕删 state (t10b-evidence.txt) |
| T11 | ✅ | HELLO-2026 · v1.0.0 | options.html 一等 target，#badge-text=HELLO-2026 保存->localhost 徽标「HELLO-2026 · v1.0.0」；做完清空保存「恢复默认徽标」回「BENCH EXT v1.0.0」(t11-badge-hello.png) |

## 工具能力观察
- Network(T02)：requests 仅 method/status/headers，无响应体；body 靠页内 eval 重放补齐，可达但非一步。
- route mock(T04)：route --body + unroute 干净可还原。
- 性能(T03)：trace start/stop 产标准 trace 可解析长任务；vitals 此次取错页面(localhost:3002,page 漂移)不可靠，改用 Performance API + trace 自推。
- Shadow(T08)：a11y snapshot 自动穿透 open shadow，ref 直接可点。
- chrome://与扩展(T09/T11)：attach 9223 可 open chrome://extensions 并 eval chrome.developerPrivate(list/reload)，content-script-only 扩展也能 reload；chrome-extension://<id>/options.html 是一等 target。
- 持久化(T10b)：state save/--state 显式机制完整，cookie+storage 一并存，跨会话/重启免登录。
- 坑：navigation 后旧 ref 失效(T11 e2/e3 stale)需重 snapshot 或用 CSS；tab 须用 tN 非裸数字；9223 预存大量历史 tab active page 会漂移，关键操作前显式选 tab 确认 url。

## 恢复确认
- manifest version 复位 1.0.0（徽标 v1.0.0）。
- 扩展徽标文字清空，恢复默认「BENCH EXT v1.0.0」。
- T10b state 文件已删（含凭证，未入 git）。
- /api/users mock 已 unroute（恢复 18 人）。
- 全程只读 GitHub，无写操作。
