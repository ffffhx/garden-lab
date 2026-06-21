# bb-browser 0.14.2 · 靶场 T01-T10b（chunk A）· Round2 复跑报告

- 工具：bb-browser 0.14.2（全局命令，Bash 驱动），attach CDP 9223（用户真实 Chrome 149）
- 环境：本地靶场 http://localhost:4399，账号 agent@bench.dev / bench-2026
- 日期：2026-06-20，独立复跑（未参考第1轮结果）
- 接入验证：`bb-browser status --port 9223` → CDP connected yes，21+ tabs，确在控 9223
- 证据目录：本目录（t01..t10b 各文件 + 截图）

## 结果总表

| 任务 | 判定 | 答案 / 关键证据 |
| --- | --- | --- |
| T01 登录与页面观察 | ✅ | 工号 BENCH-7341（/dashboard 欢迎语，/api/me 异步渲染后读到）|
| T02 Network 排障 | ✅ | POST /api/orders 500；body INSUFFICIENT_INVENTORY / "SKU-8821 库存不足，剩余 0 件"（trace body 拿到）|
| T03 性能诊断 | ✅ | blocking.css 主因(TTFB~1208-1212ms 阻塞渲染+阻塞同步 heavy.js)；heavy.js 长任务 800ms(crunchAnalytics) 次之；hero.svg 1510ms 但并行非阻塞=干扰项 |
| T04 请求 mock | ❌ | bb-browser 无任何请求拦截/mock/route 能力；network 仅只读 requests。真实 18 人已确认 |
| T05 动态渲染等待 | ✅ | 12 条；最后一条「系统公告：今日口令 LIVE-512」|
| T06 结构化提取 | ✅ | 12 件商品，price desc 排序对，最贵 雷霆工作站 15999（走 /api/products 智能路径）|
| T07 已登录 fetch | ✅ | plan = team-pro-2026（eval 在页内 fetch /api/me，复用 session）|
| T08 Shadow DOM | ✅ | 兑换码 SHADOW-99（snap 穿透 open shadow，但 click 靠 eval 触发）|
| T09 扩展 reload | ❌ | 无扩展管理能力；chrome:// 被强制前缀 https:// 无法访问；content-script-only 无 worker 可 attach。manifest 保持 1.0.0 未改 |
| T10a 默认 Profile 读 GitHub | ✅ | attach 9223 真实登录态，零授权打断读到通知：Inbox 70，未读视图 25 行，跨 4 repo（garden-lab58/codex-snapshots7/profilepilot4/open-token-board1）|
| T10b 专用 Profile 持久化 | ⚠️ | 持久化=持久 user-data-dir(~/.bb-browser/chrome-data，含 Cookies/Login Data，跨重启)；无显式 state save/load；但受管 Chrome 硬编码端口 9222 与本机已占 9222 冲突→无法启动受管 profile，GitHub 两阶段免登录 demo 未能执行。本地 session cookie 复用已部分验证 |

## bb-browser 工具短板（如实记录，不美化）

1. **click @ref 不可靠**：对 React onClick / 普通 button JS handler，`bb-browser click @ref` 常不触发处理逻辑（T01 登录按钮、T05 load-more、T08 shadow 按钮均如此）。三处都需改用 `eval ... .click()` / `form.requestSubmit()` 才生效。snap/fill/eval/network/trace 正常。
2. **无 route/mock**：network 子命令只读（requests/body），无请求拦截 → T04 直接失败。
3. **chrome:// scheme 处理错误**：open/goto "chrome://extensions/" 被强制前缀成 "https://chrome://extensions/" → chrome-error，无法访问扩展管理页；也无扩展管理 API → T09 失败。
4. **受管 profile 端口固定**：受管模式硬编码 9222，本机被占即无法自启 → T10b 无法做规定的两阶段 demo。
5. **eval 上下文跨调用复用**：同 tab 连续 eval 共享作用域（变量重复声明报错），需用 IIFE 包裹。

## 工具优点

- attach 现有 CDP（9223）丝滑，直接复用真实登录态 → T10a 零打断（强项主场）。
- trace start/events/body 链路好用：T02 直接拿到失败接口的 response body。
- snap -i 的 a11y 树能穿透 open shadow root（T08 按钮可见）。
- 页内 eval（含 fetch credentials）稳定 → T06/T07 走 API 智能路径省 token。

## 复跑后状态恢复

- 我打开的 bench tabs 全部 close（未动用户既有 tab）。
- extension-sample/manifest.json 保持 version 1.0.0（T09 未改动）。
- 未对 GitHub 做任何写操作（T10a 只读）。
