# REPORT-A · playwright-cli 0.1.14 · 靶场 T01-T11 (chunk A) · Round 2

- 日期: 2026-06-20 ; 工具: playwright-cli 0.1.14 (Bash 驱动)
- 浏览器策略: 自管浏览器 (self-launch / persistentContext)，未 attach 9223
- 靶场 http://localhost:4399 ; 账号 agent@bench.dev / bench-2026
- 本轮独立复跑，未参考第 1 轮结论。

## 结果总览
| 任务 | 判定 | 关键答案 / 证据 |
| --- | --- | --- |
| T01 | ✅ | 工号 BENCH-7341（/dashboard 欢迎语，/api/me 200 后读取）|
| T02 | ✅ | POST /api/orders => 500，body INSUFFICIENT_INVENTORY / "SKU-8821 库存不足，剩余 0 件" |
| T03 | ✅ | blocking.css ttfb~1202ms 为 LCP 主因；heavy.js crunchAnalytics 长任务 800ms(start=1248,串接CSS)次之；hero.svg 1504ms 并行/首绘前完成,干扰项;LCP=2440ms 元素为<P> |
| T04 | ✅ | route **/api/users -> {"users":[]}，截图为空状态 UI(🪴 暂无成员... + 邀请成员) |
| T05 | ✅ | 12 条，最后一条「系统公告：今日口令 LIVE-512」|
| T06 | ✅ | 12 件，最贵 雷霆工作站 15999；走 /api/products(?page=2)，排序与 GT 完全一致 |
| T07 | ✅ | 页面内 fetch('/api/me') -> plan = team-pro-2026 |
| T08 | ✅ | 兑换码 SHADOW-99；a11y 快照穿透 open shadow root，ref e20 直接 click |
| T09 | ⚠️ | 加载时徽标 v1.0.1 已验证(磁盘版本生效)；chrome://extensions 可达/可枚举(id jkmndkochpgaleoechlemhdhbikdecnf,有 reload 按钮)，但点 reload 后 content script 不再注入、扩展被 disabled，徽标消失，reload 往返未干净复现 |
| T10a | N-R | 自管浏览器无 GitHub 登录态，撞 github.com/login；无接入默认 Profile/9223 机制(预期 N-R) |
| T10b | N-R(机制已验证) | GitHub 字面任务 N-R(无登录态)；state-save/load 持久化机制在本地 bench session 验证可用:新会话 load 后免登录直达 /dashboard |
| T11 | ✅ | options.html UI 改 #badge-text=HELLO-2026 保存，靶场页徽标 = HELLO-2026 · v1.0.0；做完恢复默认 BENCH EXT v1.0.0 |

## 详细
T01 ✅ fill 邮箱/密码 -> click 登录 -> /dashboard，main.innerText「欢迎回来，Agent 测试员（工号 BENCH-7341）」。
T02 ✅ click 提交订单；requests --static 见 POST /api/orders [500]；response-body 8 = {"error":"INSUFFICIENT_INVENTORY","message":"SKU-8821 库存不足，剩余 0 件","traceId":"tr-6e85e4f45400"}。
T03 ✅ ResourceTiming+PerfObserver: blocking.css start45/ttfb1202/end1248; heavy.js 下载即时但长任务 start1248 dur800(函数 crunchAnalytics); hero.svg ttfb1504/end1549 并行; FP/FCP/LCP=2440 元素 <P>。
T04 ✅ 先确认真实结构 {"users":[...]}(18人) 再 route 成 {"users":[]} reload，文案逐字匹配。截图 t04-empty-state.png。做完 unroute。
T05 ✅ 等首页8条渲染完->加载更多->click->等第二页4条->共12条 LIVE-512。
T06 ✅ /api/products page1(8)+page2(4)=12 本地降序排序;最贵 雷霆工作站 15999。t06-products.json。
T07 ✅ 复用登录态 fetch('/api/me',{credentials:'include'}) -> plan=team-pro-2026。
T08 ✅ a11y 快照穿透 bench-widget open shadow root(e20),click 后 paragraph「兑换码：SHADOW-99」,shadowRoot 二次确认。
T09 ⚠️ config(launchOptions.args=--load-extension..., userDataDir, headless=false, cli.persistent=true) 装扩展成功; manifest 先改 1.0.1 启动后徽标 BENCH EXT v1.0.1(已验证); chrome://extensions 可达可枚举; 点 #dev-reload-button 后 content script 失注入、扩展 disabled、徽标消失; 无一等扩展 reload 命令; 详见 t09-notes.txt; manifest 已改回 1.0.0(与备份一致)。
T10a N-R goto github.com/notifications -> github.com/login;无 GitHub 身份/无接入默认 Profile 或 9223 机制;任务卡预期 N-R。
T10b N-R(机制已验证) GitHub 任务 N-R(无登录态,禁登录);本地替身: 登录->state-save(sid cookie)->close->新会话 state-load->goto /dashboard 免登录直达(BENCH-7341)。证明 state-save/load 跨会话恢复鉴权态;bench cookie-only 故 origins 空;详见 t10b-notes.txt;状态文件测后已删。
T11 ✅ chrome://extensions 发现 ID -> options.html(一等 tab) fill #badge-text=HELLO-2026 保存「已保存：徽标文字将显示为「HELLO-2026」(刷新靶场页面生效)」-> 靶场 reload 徽标 HELLO-2026 · v1.0.0(截图 t11-badge-hello.png) -> 清空保存「已保存：恢复默认徽标」-> 徽标回 BENCH EXT v1.0.0。

## 清理
- 所有 playwright-cli 会话 close-all。
- manifest.json 恢复 1.0.0(逐字与备份一致)。徽标恢复默认。
- 鉴权状态文件已删除。临时 profile 已删除。
