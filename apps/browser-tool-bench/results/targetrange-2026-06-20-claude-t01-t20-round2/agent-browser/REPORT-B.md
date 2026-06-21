# REPORT-B · agent-browser 0.27.2 · 靶场 T11–T20 第2轮（chunk B）

- 工具：agent-browser 0.27.2（CLI，Bash 驱动）
- 接入：`agent-browser close --all` 后全程 `--cdp 9223`（用户专用调试 Chrome，已验证在控 9223）
- 日期：2026-06-20，账号 agent@bench.dev（本 chunk 无需登录），本轮独立复跑

| 任务 | 判定 | 关键结果 |
| --- | --- | --- |
| T11 | ✅ | options.html UI 改徽标 HELLO-2026，localhost 验证 `HELLO-2026 · v1.0.0`，已恢复默认 |
| T12 | ✅ | coupon.ts / applySelectedCoupon / selectedCoupon.couponCode(null) / guard 正确 |
| T13 | ✅ | .mobile-support-bar[data-bug=overlaps-pay-button] z-index:20 遮挡；MOBILE-39 |
| T14 | ✅ | TaskSummary / HYD-908 / SSR(8,starter) vs Client(9,team-pro)，最终 9·team-pro |
| T15 | ✅ | 5 条，evt-005，alert/critical/STREAM-721 |
| T16 | ✅ | SW /sw-cache.js 拦截；旧 blue/cached-2025.11/STALE-CACHE-17；真实 green/live-2026.06/CACHE-BUST-42 |
| T17 | ✅ | 跨域 iframe 点击；iframe-user@bench.dev / OAUTH-314 |
| T18 | ✅ | 真实 file input；upload-token.txt / 36 bytes / UPLOAD-448 |
| T19 | ✅ | 键盘只在 notify-email↔close-modal 循环；#save-preferences 缺 tabindex/键盘 handler；A11Y-204 |
| T20 | ✅ | 7/10、失败 3/6/9、FLAKE-307、30% 不稳定 |

详见各任务证据（screenshots: T11-badge-hello.png, T13-mobile-overlap.png, T17-iframe-auth.png, T20-flake.png）。所有 GT 均有页面/Network/source-map/SSE 证据支撑，扩展改动已恢复默认 `BENCH EXT v1.0.0`。
