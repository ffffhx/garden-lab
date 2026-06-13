# 正式轮 · 每 cell 原始记录（subagent 自报）

执行顺序按编号；每 cell 前重启靶场服务。指标：CLI 命令数（自报清单）/ 轮数（tool_uses）/ tokens（subagent_tokens）/ 耗时。

## Cell 1 · T01 × agent-browser — ✅ BENCH-7341 · 9 / 4 / 17,388 / 40s

命令：skills get core → open → snapshot → fill×2 → click → wait 1000 → snapshot → close。卡点：无。

## Cell 2 · T01 × bb-browser — ✅* BENCH-7341 · 35 / 18 / 24,270 / 199s

click 5（登录按钮）多次无效；fill 后 type 导致值叠加重复；最终 `eval requestSubmit()` 登录成功。卡点自述：click 无法触发 submit 事件、fill+type 值叠加。

## Cell 3 · T02 × bb-browser — ✅* 接口/状态码/响应体全对 · 61 / 33 / 33,534 / 386s

登录段重复 Cell 2 的 click 排障（约 40 条）；`trace body` 传事件 seq 报错需改用 requestId；trace start → eval click → trace body 拿到 500 响应体。

## Cell 4 · T02 × agent-browser — ✅ 全对 · 15 / 11 / 26,141 / 86s

被动 network 记录直接可查；唯一摩擦：`network request <id>` 需加 `--json` 才显示响应体。

## Cell 5 · T04 × agent-browser — ✅ 空状态截图 · 16 / 13 / 25,053 / 97s

先查真实响应结构再 `network route --body '{"users":[]}'`，reload 后截图。卡点：无（--json 小摩擦）。

## Cell 6 · T04 × bb-browser — ⚠️* JS 层 mock · 13 / 11 / 32,601 / 152s

确认无 mock/intercept 命令后，monkey-patch `window.fetch` + 重执行页面内联脚本，页面自身渲染空状态后截图。网络层无该能力，方案刷新即失效。

## Cell 7 · T05 × bb-browser — ✅* 12 条 + LIVE-512 · 19 / 15 / 22,246 / 153s

click @2（加载更多）两次无效 → eval `load-more.click()`；等待靠重复 eval 轮询。

## Cell 8 · T05 × agent-browser — ✅ 12 条 + LIVE-512 · 26 / 16 / 28,760 / 141s

新发现：用 CSS selector 点击 `#load-more`，按钮中心在视口外 3px，click 静默空操作两次；subagent 查出坐标问题，`scrollintoview` 后成功。快照 ref 路径可避开（pilot 验证）。

## Cell 9 · T06 × agent-browser — ✅ 12 件全对 · 10 / 10 / 27,620 / 72s

snapshot ref 点击翻页 + `wait --fn` + eval 提取，缺货 badge、千分位都处理正确。卡点：无。

## Cell 10 · T06 × bb-browser — ✅* 12 件全对 · 13 / 11 / 25,415 / 101s

click 翻页两次无效 → eval `next-page.click()`，eval 提取数据全对。

## Cell 11 · T07 × bb-browser — ✅* team-pro-2026 · 44 / 24 / 26,405 / 255s

登录段再次完整复现 click/press Enter 失效（trace 确认零网络请求）→ eval requestSubmit → eval fetch /api/me。

## Cell 12 · T07 × agent-browser — ✅ team-pro-2026 · 10 / 7 / 24,060 / 57s

登录一次通过，eval fetch 拿 plan。卡点：无。

## Cell 13 · T08 × agent-browser — ✅ SHADOW-99 · 18 / 12 / 27,574 / 102s

ref 点击 shadow 内按钮直接生效；读结果时 querySelectorAll 看不到 shadow 文本，绕了几轮后用快照 + shadowRoot 遍历确认。

## Cell 14 · T08 × bb-browser — ✅* SHADOW-99 · 50 / 28 / 31,240 / 331s

登录 click 失效（再次）+ shadow 内 claim 按钮 click 失效 → 双重 eval 自救后拿到兑换码。

---

bug 复现统计（无偏，subagent 不知情）：
- bb click/press 不触发事件监听器：6 个场景（4×登录、翻页、shadow 按钮），7/7 cell 依赖 eval
- bb fill→type 值叠加：2 次
- bb `get value` 返回空：3 次
- ab `network request` 无 `--json` 不显示 body：2 次
- ab 视口外 click 静默"成功"：1 次（T05，CSS selector 路径）
