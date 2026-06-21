# REPORT · playwright-cli 0.1.14 · R01-R09 真实网站外场 Round2（精度复跑）

- 工具：playwright-cli 0.1.14（@playwright/cli，全局命令 playwright-cli）
- 浏览器：必须 attach 已起好的 CDP 9223 Chrome 149（Chrome/149.0.7827.116），已登录 GitHub、已装 content-script-only 扩展 Bench Badge
- 观察时间（UTC）：2026-06-19T18:23Z 起
- 结论：connectOverCDP attach 在枚举扩展 service_worker target 时确定性崩溃，连接无法建立。9 个任务全部 N-R（escape=false）。

## 独立复现：attach 9223 崩溃

attach 的 CDP 参数为 `--cdp=<endpoint>`（来自 `playwright-cli attach --help`）。按用户硬约束只 attach 9223，绝不自起浏览器。

CDP 端点存活：GET http://127.0.0.1:9223/json/version -> Browser: Chrome/149.0.7827.116，
webSocketDebuggerUrl: ws://127.0.0.1:9223/devtools/browser/af505d05-3f16-46e1-ad0d-4d33932285a5
/json/list 28 个 target，含多个扩展 service_worker（如 chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/background.js）。
（Bench Badge content-script-only 确无 service worker、不出现在 /json；崩溃源是 9223 上其它带 background SW 的扩展。）

### 三次尝试，全部确定性崩溃
1) playwright-cli attach --cdp=http://127.0.0.1:9223            -> exit=1（attach-attempt-1.log）
2) playwright-cli attach --cdp=http://127.0.0.1:9223（重复）     -> exit=1，同一断言（attach-attempt-2.log）
3) playwright-cli attach --cdp=ws://127.0.0.1:9223/devtools/browser/<id> -> exit=1，同一断言（attach-attempt-3-ws.log）

### 确切报错 / 堆栈
Error: Daemon pid=63709: Daemon process exited with code 1
Error: targetInfo: {
  "targetId": "45F2B5F5EF21017ABB5F42C12E8A3B23",
  "type": "service_worker",
  "title": "Service Worker chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/background.js",
  "url": "chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/background.js",
  "attached": true, "canAccessOpener": false
}
    at assert (.../playwright-core/lib/coreBundle.js:663:11)
    at _CRBrowser._onAttachedToTarget (.../playwright-core/lib/coreBundle.js:37805:9)
    at _CRSession.emit (node:events:519:28)
    at .../playwright-core/lib/coreBundle.js:34583:18

### 根因（coreBundle.js:37805，见 assertion-source-37805.txt）
_onAttachedToTarget({ targetInfo, sessionId }) {
  if (targetInfo.type === "browser") return;
  const session2 = this._session.createChildSession(sessionId);
  assert(targetInfo.browserContextId, "targetInfo: " + JSON.stringify(targetInfo, null, 2)); // 在此崩溃
}
attach 时 playwright 用 setAutoAttach 枚举全部 target；企业 Chrome 上的扩展 service_worker target 不带 browserContextId，
assert(targetInfo.browserContextId) 失败 -> daemon 子进程 code 1 退出 -> CLI 抛 "Daemon process exited with code 1"。
未建立任何 page session；playwright-cli list 显示 (no browsers)。
确定性：3 次尝试、2 种 endpoint 形式（HTTP base / ws browser）均同一断言、同一 target 类型崩溃。

## 任务结果（R01-R09 全部 N-R，escape=false）
attach 无法建立连接 -> 无 page session -> 9 个任务全部 N-R。证据=本次 attach 崩溃日志。
R06 未触碰 Bench Badge storage，默认 BENCH EXT v1.0.0 未改动。

## 安全 / 状态确认
- 未自起任何新浏览器；9223 三次 attach 均握手阶段崩溃，未建立连接。
- playwright-cli list = (no browsers)，我的 attach 未残留 session。
- 9223 Chrome 仍存活（Chrome/149.0.7827.116），未 close，未改任何网站/账号状态。
- R06 Bench Badge 本地 storage 未触碰，仍为默认 BENCH EXT v1.0.0（从未修改，无需恢复）。

## 证据文件
- attach-attempt-1.log / attach-attempt-2.log / attach-attempt-3-ws.log — 三次 attach 崩溃完整 stdout+stderr
- assertion-source-37805.txt — 崩溃断言源码上下文
