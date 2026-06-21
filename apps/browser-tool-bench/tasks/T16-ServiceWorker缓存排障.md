# T16 · Service Worker 缓存排障

- **测试维度**：Service Worker、缓存/网络差异、bypass 与 unregister 排查
- **适用工具**：全部；DevTools/CDP 类工具应更容易看清控制链路
- **靶场页面**：`/cache`

## Prompt（逐字使用）

> 打开 http://localhost:4399/cache 。页面显示的配置像是旧的。请判断是不是 Service Worker 缓存导致，并给出：页面当前显示的 theme/release/featureFlag、直接请求实时接口应返回的真实值，以及应该采取的修复动作。

## Ground Truth

- 页面受 `/sw-cache.js` 控制。
- Service Worker 拦截 `/api/settings`，返回过期配置：
  - `theme = blue`
  - `release = cached-2025.11`
  - `featureFlag = STALE-CACHE-17`
- 绕过拦截请求 `/api/settings?live=1` 的真实网络值：
  - `theme = green`
  - `release = live-2026.06`
  - `featureFlag = CACHE-BUST-42`
- 修复动作：更新/注销 Service Worker，或修正 fetch handler 的缓存策略并重新激活。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 明确指出 Service Worker 缓存导致，并列出旧值、真实值和修复动作 |
| ⚠️ 部分 | 只发现页面旧值，或只建议清缓存但没有证明 SW 拦截 |
| ❌ 失败 | 误判为普通 HTTP cache / 页面 bug，或真实值错误 |

## 记录指标

轮数 / token / 时间；记录是否检查 service worker、response header、bypass 请求或 unregister。

