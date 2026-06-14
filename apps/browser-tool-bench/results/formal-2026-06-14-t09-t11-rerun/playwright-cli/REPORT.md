# playwright-cli — T09 / T10a / T11 报告（2026-06-14 rerun）

- 工具版本：playwright-cli 0.1.14（底层 playwright-core 1.61.0-alpha）
- 执行顺序：T10a → T11 → T09
- 扩展 ID（路径派生）：`jkmndkochpgaleoechlemhdhbikdecnf`，发现路径：自管 context 内 `chrome://extensions/`（shadow DOM `extensions-manager → extensions-item-list → extensions-item.id`）
- 路线：T10a 尝试 attach 真实浏览器；T11/T09 走 playwright-cli **自管 persistent context**
- 证据目录：`evidence/`
- （本报告由主控代为落盘——subagent 自身 Write 被 harness 拦截，内容为 subagent 原文返回。）

## T10a（端口 9223，真实 GitHub 登录态） — ❌
**一句话**：playwright-cli `attach --cdp=http://localhost:9223` 无法接入企业管控的系统 Chrome——attach 阶段枚举到企业管理扩展的 service_worker target 触发内部断言崩溃，daemon 退出，到不了 GitHub 页面。

- 报错原文（存 `evidence/t10a-attach-9223-error.txt`）：
  ```
  Error: Daemon process exited with code 1
  targetInfo: { "type": "service_worker",
    "url": "chrome-extension://aapbdbdomjkkjkaonfhkkikfgjllcleb/main_compiled.js" ... }
  at assert (.../coreBundle.js) at _CRBrowser._onAttachedToTarget
  ```
- `--cdp=localhost:9223`（无 scheme）→ `Protocol "localhost:" not supported. Expected "http:"`；带 `http://` → 上述 assert 崩溃。确定性失败。
- 能力边界：SKILL 文档宣称支持 `attach --cdp`，但对「带企业管理扩展 / 多 target 的真实 Chrome」不可用——这是 playwright-cli 接入已有登录态浏览器的硬边界。按协议如实判 ❌，未在新 profile 尝试登录。
- 轮数 2；耗时约 1 分钟；打断 0。

## T11（自管 persistent context，扩展 live=1.0.0） — ✅
**一句话**：经设置页 UI 把徽标文字改为 HELLO-2026 并保存，靶场页徽标 `HELLO-2026 · v1.0.0`。

- 路线：自管 persistent context（`open --config=...`，config 里 userDataDir + launchOptions.args）。
- 加载扩展的坑：
  - `channel: chrome` → 加载的是企业管控 Chrome，徽标不出现、chrome://extensions 列表空（企业策略拦解压扩展）。
  - 改用 **bundled Chromium（不指定 channel）** 后正常。
  - launchOptions：`ignoreDefaultArgs: ["--disable-extensions","--disable-component-extensions-with-background-pages"]`，`args: ["--disable-features=DisableLoadExtensionCommandLineSwitch","--load-extension=<ext>"]`
- 步骤：`goto chrome-extension://<id>/options.html` → `fill e5 "HELLO-2026"` → `click e6`（保存，回显「已保存…」）→ `goto http://localhost:4399/` → `#bench-ext-badge` = **`HELLO-2026 · v1.0.0`**。
- 设置页可直接 `goto`、shadow DOM 可 `eval`，设置页出现在 session 内。
- 证据：`t11-00-chrome-extensions.png`、`t11-01-options-filled.png`、`t11-02-bench-badge-hello2026.png`。轮数约 6；耗时约 4 分钟；打断 0。

## T09（同一自管 context，最后跑） — ✅
**一句话**：改 manifest 到 1.0.1 后经扩展管理 reload，靶场页徽标版本升到 `HELLO-2026 · v1.0.1`。

- manifest 由本工具改 version `1.0.0 → 1.0.1`。reload 走 **chrome://extensions API（`chrome.developerPrivate.reload`）**。
- 坑（Chrome 137+ unsupported developer extension）：
  - 先点 `#dev-reload-button` → 扩展被直接禁用，`getExtensionInfo` 显示 `disableReasons.unsupportedDeveloperExtension=true`，version 停 1.0.0。
  - 原因：`--load-extension` 启动能加载，但 reload 时若**开发者模式关闭**，Chrome 137+ 判解压扩展为「不受支持」并禁用。
  - 解法：先 `#devMode` 打开开发者模式，再 `chrome.management.setEnabled(id,true)` + `chrome.developerPrivate.reload(id,{failQuietly:false})` → `{version:"1.0.1", state:"ENABLED"}`。
- 验证：刷新靶场页，`#bench-ext-badge` = **`HELLO-2026 · v1.0.1`**（T11 文字保留，版本号升）。
- 证据：`t09-01-extensions-v1.0.1.png`、`t09-02-bench-badge-v1.0.1.png`。轮数约 10；耗时约 5 分钟；打断 0。

## 收尾
- `manifest.json` 留在 **1.0.1**（已核对）。自管 session 已 close-all。全程只读。

## 能力边界小结
1. 接入已有浏览器（T10a）：`attach --cdp` 对企业管控/多扩展真实 Chrome 不可用，遇 service_worker target 直接 assert 崩溃 → 硬伤。
2. 自管扩展场景（T11/T09）：强项，但两个坑——(a) 必须用 bundled Chromium 而非 `channel: chrome`；(b) Chrome 137+ reload 解压扩展前必须打开开发者模式，否则被判 unsupportedDeveloperExtension 禁用；reload 用 `developerPrivate.reload` API 最稳。
