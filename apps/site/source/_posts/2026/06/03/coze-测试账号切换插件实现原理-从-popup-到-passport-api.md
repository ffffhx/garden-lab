---
title: "Coze 测试账号切换插件实现原理：从 Popup 到 Passport API"
date: "2026-06-03 23:05:00"
categories:
  - 技术
tags:
  - Chrome Extension
  - Coze
  - CloudIdentity
  - Passport
  - MV3
  - 测试账号
excerpt: "拆解 coze-account-switch-extension 如何用 Chrome MV3 把测试账号查询、CloudIdentity 登录、Coze Passport 写入、订阅权益验权、异常跳过和自己账号会话恢复串成一条可观察的后台接口切换链路。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

`coze-account-switch-extension` 做的是一个很具体、也很容易被低估的工具：在 Chrome 里选择 Coze 套餐权益和企业角色，然后把当前浏览器会话切到一个匹配的测试账号。

它看起来像一个 popup 小插件，真正复杂的部分却在后台：

1. 它是 Chrome Manifest V3 扩展，popup 只负责输入、选择和进度展示。
2. 后台 `service worker` 是总入口，所有高权限动作都通过消息协议收口。
3. 测试账号来自 Stone data service，查询时会携带本轮已跳过账号，避免反复拿到同一个候选。
4. 切换核心不是模拟页面点击，而是后台状态机：查账号、读当前态、退出、登录、写入 Coze Passport、验权。
5. 个人/主账号走 CloudIdentity SDK 登录链路，企业子账号走 CloudIdentity SaaS userlogin 链路。
6. 企业 SaaS 登录需要处理密码加盐 RSA 加密、工作流 token、OAuth 跳转和 `webRequest` 捕获 302。
7. 写 Coze 登录态时调用 Coze Web Passport 接口，带 CSRF、请求签名和 `platform_app_id`；后台裸 `fetch` 会缺反爬库的动态签名而命中反作弊（错误码 7），所以现在优先把这次请求放进 Coze 页面主世界，借页面上的反爬 hook 补齐签名。
8. 成功条件以 Coze API 验证为主：uid、enterprise_id、套餐 level、企业角色都要匹配。
9. content script 只作为页面状态补充信号，主要用于当前态读取、企业页兜底和用户可见反馈。
10. 遇到额外验证、企业审批中、角色不匹配、同权益账号等情况，状态机会跳过或转入人工验证，而不是盲目报成功。
11. “切回自己账号”不是再查一个账号，而是把 Coze/Signin 相关 cookie 快照暂存在 `chrome.storage.session`。
12. 测试覆盖了账号模型、服务请求、CloudIdentity、Coze Passport 签名、验权、tab 策略、service worker 回补和 popup 决策。

<figure class="fz082" data-reveal role="group" aria-label="Coze 账号切换插件三层架构示意图：Popup UI、Service Worker、Content Script 的职责边界"><style>.fz082{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--grn:#4f7233;--grnb:#e7eedd;--grnl:#7c9c54;--cyn:#3f6d79;--cynb:#dcebed;--cyne:#8fbcc4;--amb:#9a6516;--ambb:#f4e8cc;--ambe:#d9b66a;background:var(--paper-soft,#faf6ec);color:var(--ink,#1a1815);font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3vw,30px);margin:0;max-width:100%;box-sizing:border-box;line-height:1.5}.fz082 *{box-sizing:border-box}.fz082 .hd{margin-bottom:.2rem}.fz082 .ttl{font-size:clamp(1.15rem,3.2vw,1.6rem);font-weight:800;letter-spacing:.01em;color:var(--ink,#1a1815);margin:0}.fz082 .sub{font-size:clamp(.78rem,1.9vw,.95rem);color:var(--muted,#6a6155);margin:.45rem 0 0}.fz082 .grid{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:stretch;gap:0;margin:clamp(16px,3vw,26px) 0 0}.fz082 .col{border-radius:16px;padding:clamp(12px,1.6vw,18px);border:1.5px solid;display:flex;flex-direction:column;min-width:0;position:relative}.fz082 .c-cyn{background:var(--cynb,#dcebed);border-color:var(--cyne,#8fbcc4)}.fz082 .c-grn{background:var(--grnb,#e7eedd);border-color:var(--grnl,#7c9c54);box-shadow:0 0 0 0 rgba(124,156,84,.4);animation:fz082pulse 8s ease-in-out infinite}.fz082 .c-amb{background:var(--ambb,#f4e8cc);border-color:var(--ambe,#d9b66a)}.fz082 .ch{font-size:clamp(.95rem,2.3vw,1.18rem);font-weight:800;margin:0 0 .5rem}.fz082 .c-cyn .ch{color:var(--cyn,#3f6d79)}.fz082 .c-grn .ch{color:var(--grn,#4f7233)}.fz082 .c-amb .ch{color:var(--amb,#9a6516)}.fz082 ._tag{display:inline-block;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);padding:.12rem .4rem;border-radius:6px;margin-bottom:.55rem;opacity:.85}.fz082 .c-cyn ._tag{background:var(--cyn,#3f6d79);color:#fff}.fz082 .c-grn ._tag{background:var(--grn,#4f7233);color:#fff}.fz082 .c-amb ._tag{background:var(--amb,#9a6516);color:#fff}.fz082 .body{display:flex;flex-direction:column;flex:1 1 auto}.fz082 .li{font-size:clamp(.74rem,1.7vw,.9rem);color:var(--ink-soft,#3c362c);padding:.26rem 0 .26rem .9rem;position:relative;border-top:1px solid var(--hair,rgba(26,24,21,.18))}.fz082 .li:first-of-type{border-top:none}.fz082 .li::before{content:"";position:absolute;left:0;top:.78em;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.45}.fz082 .c-cyn .li::before{color:var(--cyn,#3f6d79)}.fz082 .c-grn .li::before{color:var(--grn,#4f7233)}.fz082 .c-amb .li::before{color:var(--amb,#9a6516)}.fz082 .badge{align-self:flex-start;margin-top:.8rem;font-size:clamp(.68rem,1.5vw,.82rem);font-weight:700;color:#fff;border-radius:10px;padding:.34rem .7rem}.fz082 .c-cyn .badge{background:var(--cyn,#3f6d79)}.fz082 .c-grn .badge{background:var(--grn,#4f7233)}.fz082 .c-amb .badge{background:var(--amb,#9a6516)}.fz082 .arr{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 clamp(4px,1.2vw,12px);position:relative}.fz082 .arr .ln{height:3px;width:100%;min-width:26px;border-radius:3px;background:linear-gradient(90deg,var(--grnl,#7c9c54),var(--grn,#4f7233));position:relative;overflow:hidden}.fz082 .arr .ln::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(250,246,236,.9),transparent);animation:fz082flow 4s linear infinite}.fz082 .arr.a2 .ln::after{animation-delay:2s}.fz082 .arr .tip{width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:11px solid var(--grn,#4f7233);margin-top:-15px;margin-left:auto;margin-right:-2px}.fz082 .foot{margin-top:clamp(16px,3vw,24px);background:var(--ink,#1a1815);color:var(--paper-soft,#faf6ec);border-radius:12px;padding:clamp(12px,1.8vw,16px) clamp(14px,2vw,20px);font-size:clamp(.78rem,1.9vw,.96rem);font-weight:700;line-height:1.55;position:relative;overflow:hidden}.fz082 .foot::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--grnl,#7c9c54);animation:fz082bar 8s ease-in-out infinite}.fz082 .foot b{color:var(--ambe,#d9b66a);font-weight:800}@keyframes fz082flow{0%{left:-40%}100%{left:120%}}@keyframes fz082pulse{0%,100%{box-shadow:0 0 0 0 rgba(124,156,84,.0)}50%{box-shadow:0 0 0 5px rgba(124,156,84,.16)}}@keyframes fz082bar{0%,100%{opacity:.5}50%{opacity:1}}@media(max-width:560px){.fz082 .grid{grid-template-columns:1fr}.fz082 .arr{padding:8px 0;flex-direction:row;gap:.5rem}.fz082 .arr .ln{height:auto;width:3px;min-width:0;min-height:24px;background:linear-gradient(180deg,var(--grnl,#7c9c54),var(--grn,#4f7233))}.fz082 .arr .ln::after{left:0;top:-40%;width:100%;height:40%;background:linear-gradient(180deg,transparent,rgba(250,246,236,.9),transparent);animation:fz082flowv 4s linear infinite}.fz082 .arr.a2 .ln::after{animation-delay:2s}.fz082 .arr .tip{border-left:7px solid transparent;border-right:7px solid transparent;border-top:11px solid var(--grn,#4f7233);border-bottom:none;margin:-2px auto 0 -15px}}@keyframes fz082flowv{0%{top:-40%}100%{top:120%}}@media (prefers-reduced-motion:reduce){.fz082 .c-grn{animation:none;box-shadow:0 0 0 2px rgba(124,156,84,.22)}.fz082 .arr .ln::after,.fz082 .foot::before{animation:none}.fz082 .foot::before{opacity:1}}</style><div class="hd"><p class="ttl">三层边界：UI 很薄，后台很重，页面只读状态</p><p class="sub">高权限动作集中在 Manifest V3 service worker，popup 和 content script 都不触碰账号密码。</p></div><div class="grid"><div class="col c-cyn"><span class="_tag">popup</span><p class="ch">Popup UI</p><div class="body"><div class="li">保存 JWT</div><div class="li">选择权益和角色</div><div class="li">确认同权益换新账号</div><div class="li">展示 steps 和 lastRun</div></div><span class="badge">只发消息，不做登录</span></div><div class="arr a1"><div class="ln"></div><div class="tip"></div></div><div class="col c-grn"><span class="_tag">service worker</span><p class="ch">Service Worker</p><div class="body"><div class="li">消息协议总入口</div><div class="li">Stone 查询账号</div><div class="li">CloudIdentity 登录</div><div class="li">Coze Passport 写态</div><div class="li">Coze API 验权</div><div class="li">cookie 快照恢复</div></div><span class="badge">高权限收口</span></div><div class="arr a2"><div class="ln"></div><div class="tip"></div></div><div class="col c-amb"><span class="_tag">content script</span><p class="ch">Content Script</p><div class="body"><div class="li">读取页面文案</div><div class="li">识别企业 URL</div><div class="li">提取权益和额度</div><div class="li">发现待审批和无权限</div></div><span class="badge">只兜底，不裁决</span></div></div><div class="foot">账号密码<b>只在后台切换流程中使用</b>，不进入 popup、content script 或 lastRun 展示。</div></figure>

本文观察对象如下：

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/bytedance/Code/coze-account-switch-extension` |
| 观察日期 | `2026-06-03`（`2026-07-03` 修订） |
| 观察 commit | `9da36ab`（修订基于 `5e334ae` 及本地工作区） |
| 工作区状态 | 观察时存在未提交改动，本文基于本地工作区源码阅读 |
| 修订说明 | `2026-07-03` 补充第 6 节 Passport 后台登录的**风控规避机制**：反作弊错误码 7、限流冷却熔断、浏览器模拟点击兜底，以及在 Coze 页面主世界里借反爬 hook 加签的 `loginCozePassportViaPage` 链路 |
| 扩展清单 | `manifest.json` |
| popup 入口 | `src/popup/popup.html`、`src/popup/popup.js` |
| 后台入口 | `src/background/service-worker.js` |
| 切换状态机 | `src/background/switch-controller.js` |
| CloudIdentity 登录 | `src/background/signin-api.js` |
| Coze Passport | `src/background/coze-passport-api.js` |
| Coze 验权 | `src/background/coze-verification-api.js` |
| 自己账号快照 | `src/background/session-snapshot.js` |

这篇文章只讲实现机制，不贴真实 JWT、账号密码、完整签名密钥和可直接复用的敏感请求参数。公开博客适合讲架构和边界，不适合把内部登录材料变成复制粘贴脚本。

## 0. 先把几个词讲清楚

这个插件里有几个容易混在一起的概念。

| 词 | 含义 |
| --- | --- |
| `popup` | 点击扩展图标后出现的小页面，负责填 JWT、选权益和角色、展示状态 |
| `service worker` | MV3 后台脚本，处理 popup 发来的消息，也是高权限动作的总入口 |
| `content script` | 注入 `code.coze.cn` 的页面脚本，只读取页面可见状态，不掌握账号密码 |
| `Stone data service` | 测试账号查询服务，按权益和角色返回候选账号 |
| `CloudIdentity` | 火山侧登录体系，插件用它把账号密码换成 Coze 可用的 auth code |
| `Coze Passport` | Coze Web 登录态接口，插件用它退出当前账号并写入新账号登录态 |
| `权益` | Coze 套餐，比如个人进阶版、企业标准版、企业旗舰版 |
| `角色` | 企业/团队账号里的角色，比如超级管理员、管理员、成员、企业访客 |
| `lastRun` | 后台保存在 `chrome.storage.local` 的最近一次切换记录，用于 popup 重开后回显进度 |

它的产品目标不是“在页面上自动点登录按钮”。更准确地说，它是在 Chrome profile 里重建一条 Coze 登录会话，并证明这条会话确实对应目标权益。

这个定义很重要。因为页面自动化只要按钮文案或 DOM 变了就会碎；而后台接口链路虽然更难写，但它能把每一步变成可测试、可重试、可解释的状态。

## 1. 扩展边界：把高权限动作集中在后台

`manifest.json` 里可以看出这套插件的边界。

它声明了这些关键能力：

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存 JWT、选择项、lastRun 和 session 快照 |
| `tabs` | 复用、打开、刷新 Coze 标签页 |
| `scripting` | 在 Coze 页面注入 content script 读取页面状态 |
| `cookies` | 读取 Passport CSRF cookie，保存和恢复自己账号会话 |
| `webRequest` | 捕获 CloudIdentity SaaS OAuth 302 跳转目标 |
| `host_permissions` | 限定 Coze、CloudIdentity、Volcengine 和账号查询服务域名 |

MV3 的一个好处是边界天然更清楚：popup 页面不是长期运行环境，复杂流程必须进后台 service worker；页面脚本也不能直接跨域请求账号服务或读 cookie。于是职责被分成三层：

| 层 | 文件 | 做什么 | 不做什么 |
| --- | --- | --- | --- |
| UI 层 | `src/popup/*` | 收集选择、保存设置、展示步骤、确认同权益切换 | 不保存账号密码，不直接请求 Passport |
| 后台层 | `src/background/*` | 查账号、登录、退出、验权、cookie 快照、tab 控制 | 不把密码传给页面 |
| 页面层 | `src/content/coze-content.js` | 读页面文案、URL、权益标记、登录迹象 | 不作为最终成功条件 |

这层拆法的收益是：用户看到的是一个简单 popup，代码里的高风险动作却集中在后台，测试也可以用 fake chrome runtime 单独验证。

下面是按源码改写的消息边界片段：

```js
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => { // 后台统一接收 popup 发来的消息
  handleMessage(message) // 把不同 message.type 分发给各自的后台能力
    .then(data => sendResponse({ ok: true, data })) // 成功时只返回可展示数据
    .catch(error => sendResponse({ ok: false, error: toPublicError(error) })); // 失败时裁剪错误对象再返回
  return true; // 告诉 Chrome 这个响应会异步返回
}); // onMessage 监听注册结束
```

这个片段很短，但它解释了整个插件的控制面：popup 不能直接“做切换”，只能请求后台做切换。

## 2. Popup：一个小 UI，背后是一组消息协议

popup 的 DOM 很克制：JWT 输入框、权益选择、角色选择、复用已有 Coze 标签页的 checkbox、切换按钮、自己账号保存/恢复按钮，以及步骤列表。

更值得看的是 `popup.js` 和 `service-worker.js` 之间的消息类型：

| message type | 作用 |
| --- | --- |
| `SETTINGS_GET` | 读取 JWT、权益、角色和 lastRun |
| `SETTINGS_SAVE` | 保存 JWT 和当前选择 |
| `ACCOUNT_LIST_OPTIONS` | 从账号服务刷新可选权益和角色 |
| `ACCOUNT_CURRENT_CONTEXT` | 检查当前 Coze 会话是否已经匹配所选权益 |
| `LAST_RUN_RECONCILE` | popup 重开后，尝试从当前 Coze 状态回补仍在 running 的 lastRun |
| `ACCOUNT_SWITCH` | 发起完整切换流程 |
| `OWN_SESSION_GET` | 查询是否已保存自己账号会话 |
| `OWN_SESSION_CAPTURE` | 保存当前 Coze/Signin cookie 快照 |
| `OWN_SESSION_RESTORE` | 恢复保存过的自己账号 cookie 快照 |

popup 做了一个很实用的保护：如果当前 Coze API 已经确认是同套餐权益账号，它不会直接再切一次，而是弹出确认面板。用户确认后，当前账号会被加入本轮跳过列表，然后后台再查另一个同权益账号。

裁剪后的 popup 发起流程是这样：

```js
async function switchAccountFromPopup() { // 用户点击“切换账号”后的入口
  const selection = readRightsAndRole(); // 读取当前选择的权益和企业角色
  if (!selection.rights) return showWarning("请选择套餐权益"); // 没选权益时先在 popup 内拦住
  await saveSettings(selection); // 把 JWT、权益和角色保存到 local storage
  const current = await askBackground("ACCOUNT_CURRENT_CONTEXT", selection); // 先让后台检查当前 Coze 会话
  if (shouldConfirmSameRightsSwitch(current)) return showSameRightsConfirm(current); // 已是同权益时让用户确认是否换新账号
  const result = await askBackground("ACCOUNT_SWITCH", selection); // 真正切换交给后台状态机
  return renderSwitchResult(result); // 用后台返回的 steps 和 finalMarkers 更新 UI
} // popup 切换入口结束
```

注意这个设计里 popup 没有 try to be smart。它只问后台“当前是谁”“请切换”“结果是什么”。这让 UI 逻辑可以稳定保持薄薄一层。

## 3. 账号查询：把“换一个”变成可重复的排除列表

测试账号查询在 `src/shared/service.js`。它做两类请求：

| 方法 | 用途 |
| --- | --- |
| `listOptions` | 拉取账号服务配置里的权益和角色选项 |
| `queryAccount` | 按 `rights`、`role` 和 skipped accounts 查询一个候选账号 |

`queryAccount` 最关键的不是发请求，而是构造排除条件。因为切换流程里可能遇到这些情况：

- 当前页面已经是同权益账号，用户要换一个新账号。
- 候选账号需要额外验证，暂时跳过。
- 企业账号角色和用户选择不一致，跳过。
- 企业账号尚未加入企业或正在审批，跳过。
- Stone 服务反复返回本轮已跳过账号，需要明确报错。

所以后台不会只传一个 `exclude_account_ids`。它会按账号类型归一出多种身份键：

| 排除维度 | 说明 |
| --- | --- |
| `account_id` | 主账号或企业账号 id |
| `uid` | Coze 用户 uid，个人账号验权时很关键 |
| `user_name` | 企业子账号或测试账号用户名 |

账号对象进入 UI 前会走 `publicAccount`，密码不会出现在 popup、lastRun 或错误展示里。

裁剪后的查询逻辑如下：

```js
async function queryNextAccount(skippedAccounts) { // 从账号服务拿下一个可尝试账号
  const skipped = normalizeSkippedAccounts(skippedAccounts); // 把已跳过账号拆成 id、uid 和用户名
  const account = await service.queryAccount({ rights, role, skipped }); // 带权益、角色和排除列表请求账号服务
  if (roleDoesNotMatch(account, role)) return skipAndQueryAgain(account); // 企业角色不一致时不进入登录流程
  if (alreadySkipped(account, skipped)) return skipAndQueryAgain(account); // 服务返回重复候选时继续查
  return account; // 只有未跳过且角色匹配的账号才进入切换状态机
} // 候选账号查询结束
```

这里的核心思路是：跳过不是 popup 里的临时提示，而是状态机的一部分。只要一个账号被证明“不适合本轮目标”，它就会被记录下来，并影响下一次查询。

## 4. 切换状态机：先证明当前不是目标，再登录新账号

`switch-controller.js` 是插件最值得读的文件。它把一次切换拆成可观察步骤，每一步都会记录 `name`、`status`、`durationMs` 和错误信息。

典型流程是：

1. 查询候选测试账号。
2. 复用或打开 Coze 标签页。
3. 读取当前页面状态。
4. 调 Coze API 检查当前会话。
5. 如果当前已经是目标账号，打开验证页并直接返回成功。
6. 如果当前已登录其他账号，调用 Passport logout。
7. 调 CloudIdentity API 登录目标账号。
8. 检查 Passport 登录限流冷却，若在冷却期内直接转人工兜底。
9. 拿 auth code 调 Coze Passport auth login：有 Coze 标签页时走页面主世界加签，否则退回后台 `fetch`。
10. 打开或刷新 Coze 验证页。
11. 轮询 Coze API，直到身份、权益和角色都匹配。

<figure class="fz083" data-reveal role="group" aria-label="Coze 测试账号切换状态机：从查询账号、读当前态、退出登录、CloudIdentity 登录、写入 Coze Passport 到最终验权的可观察步骤"><style>.fz083{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--green:#4f7233;--green-bg:#e7eedd;--green-br:#7c9c54;--cyan:#3f6d79;--cyan-bg:#dcebed;--cyan-br:#8fbcc4;--amber:#9a6516;--amber-bg:#f4e8cc;--amber-br:#d9b66a;--red:#8f2d20;--red-bg:#f1ddd6;--red-br:#cf9b90;--gray:#917f5c;--gray-bg:#ece4d2;background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(16px,3vw,30px);margin:0;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink,#1a1815);box-sizing:border-box;overflow:hidden}.fz083 *{box-sizing:border-box}.fz083 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz083 .t{font-size:clamp(17px,2.6vw,25px);font-weight:800;line-height:1.3;letter-spacing:.01em}.fz083 .s{margin-top:6px;font-size:clamp(12px,1.6vw,15px);color:var(--muted,#6a6155);line-height:1.45}.fz083 .row{display:flex;flex-wrap:nowrap;align-items:stretch;gap:0}.fz083 .node{flex:1 1 0;min-width:0;background:var(--paper-deep,#ece5d5);border:1.5px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:clamp(9px,1.4vw,14px);display:flex;flex-direction:column;justify-content:center;opacity:.55;transform:translateY(5px);animation:fz083pop 9s ease-in-out infinite}.fz083 .node .nm{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-weight:700;font-size:clamp(12px,1.7vw,16px);line-height:1.2;word-break:break-word}.fz083 .node .de{margin-top:5px;font-size:clamp(10px,1.4vw,13px);color:var(--ink-soft,#3c362c);line-height:1.35}.fz083 .cyan{background:var(--cyan-bg,#dcebed);border-color:var(--cyan-br,#8fbcc4)}.fz083 .cyan .nm{color:var(--cyan,#3f6d79)}.fz083 .green{background:var(--green-bg,#e7eedd);border-color:var(--green-br,#7c9c54)}.fz083 .green .nm{color:var(--green,#4f7233)}.fz083 .amber{background:var(--amber-bg,#f4e8cc);border-color:var(--amber-br,#d9b66a)}.fz083 .amber .nm{color:var(--amber,#9a6516)}.fz083 .red{background:var(--red-bg,#f1ddd6);border-color:var(--red-br,#cf9b90)}.fz083 .red .nm{color:var(--red,#8f2d20)}.fz083 .gray{background:var(--gray-bg,#ece4d2);border-color:var(--hair,rgba(26,24,21,.18))}.fz083 .gray .nm{color:var(--gray,#917f5c)}.fz083 .ar{flex:0 0 clamp(20px,3.2vw,40px);align-self:center;position:relative;height:14px;margin:0 2px}.fz083 .ar::before{content:"";position:absolute;left:0;right:8px;top:50%;height:2px;transform:translateY(-50%);background:linear-gradient(90deg,var(--muted,#6a6155),var(--muted,#6a6155));background-size:200% 100%;opacity:.5;animation:fz083flow 7s linear infinite}.fz083 .ar::after{content:"";position:absolute;right:0;top:50%;transform:translateY(-50%);border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid var(--muted,#6a6155);opacity:.7}.fz083 .n1{animation-delay:0s}.fz083 .n2{animation-delay:.7s}.fz083 .n3{animation-delay:1.4s}.fz083 .n4{animation-delay:2.1s}.fz083 .n5{animation-delay:3.4s}.fz083 .n6{animation-delay:4.1s}.fz083 .n7{animation-delay:4.8s}.fz083 .n8{animation-delay:5.5s}.fz083 .link{position:relative;height:clamp(26px,4vw,40px);margin:2px clamp(6px,2vw,22px)}.fz083 .link .seg{position:absolute;background:var(--muted,#6a6155);opacity:.5}.fz083 .link .h{right:0;top:0;height:2px;left:50%}.fz083 .link .v{left:0;top:0;width:2px;bottom:8px}.fz083 .link .h2{left:0;bottom:8px;height:2px;width:50%}.fz083 .link .pulse{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--red,#8f2d20);top:-2.5px;right:0;opacity:.8;animation:fz083trace 9s ease-in-out infinite}.fz083 .link .dn{position:absolute;left:-4px;bottom:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--muted,#6a6155);opacity:.7}.fz083 .lbl{position:absolute;top:50%;left:50%;transform:translate(-50%,-130%);font-size:clamp(9px,1.3vw,12px);color:var(--muted,#6a6155);background:var(--paper-soft,#faf6ec);padding:0 6px;white-space:nowrap}.fz083 .ban{margin-top:clamp(12px,2vw,18px);background:var(--ink,#1a1815);border-radius:12px;padding:clamp(12px,2vw,18px) clamp(14px,2.4vw,24px);color:var(--paper-soft,#faf6ec);position:relative;overflow:hidden}.fz083 .ban::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 35%,rgba(250,246,236,.07) 50%,transparent 65%);background-size:280% 100%;animation:fz083sheen 10s ease-in-out infinite}.fz083 .ban .b1{font-weight:800;font-size:clamp(13px,1.9vw,17px);line-height:1.4;position:relative}.fz083 .ban .b1 .sk{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);color:var(--red-br,#cf9b90)}.fz083 .ban .b2{margin-top:6px;font-size:clamp(11px,1.5vw,14px);color:var(--cyan-br,#8fbcc4);line-height:1.4;position:relative}.fz083 .ban .b2 .mo{font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace)}@keyframes fz083pop{0%,14%{opacity:.5;transform:translateY(5px)}26%,72%{opacity:1;transform:translateY(0)}90%,100%{opacity:.5;transform:translateY(5px)}}@keyframes fz083flow{0%{background-position:120% 0}100%{background-position:-120% 0}}@keyframes fz083trace{0%,18%{right:0;opacity:0}30%{opacity:.85}50%{right:calc(100% - 7px);opacity:.85}62%,100%{right:calc(100% - 7px);opacity:0}}@keyframes fz083sheen{0%{background-position:160% 0}55%,100%{background-position:-160% 0}}@media(max-width:560px){.fz083 .row{flex-wrap:wrap;gap:8px}.fz083 .node{flex:1 1 42%}.fz083 .ar{display:none}.fz083 .link{margin:4px 18px}}@media(prefers-reduced-motion:reduce){.fz083 .node{animation:none;opacity:1;transform:none}.fz083 .ar::before{animation:none}.fz083 .link .pulse{animation:none;opacity:0}.fz083 .ban::after{animation:none}}</style><div class="hd"><div class="t">切换状态机：每一步都可记录、可跳过、可回补</div><div class="s">状态机先证明当前不是目标，再退出旧账号并登录候选账号。</div></div><div class="row"><div class="node cyan n1"><div class="nm">query-account</div><div class="de">按权益和角色查候选</div></div><div class="ar"></div><div class="node green n2"><div class="nm">acquire-tab</div><div class="de">复用或打开 Coze</div></div><div class="ar"></div><div class="node amber n3"><div class="nm">read-current</div><div class="de">页面和 API 双读</div></div><div class="ar"></div><div class="node red n4"><div class="nm">already target?</div><div class="de">若已匹配则直接收尾</div></div></div><div class="link"><span class="lbl">否 · 退出旧账号</span><span class="seg h"></span><span class="seg v"></span><span class="seg h2"></span><span class="dn"></span><span class="pulse"></span></div><div class="row"><div class="node gray n5"><div class="nm">logout-api</div><div class="de">退出当前 Coze 账号</div></div><div class="ar"></div><div class="node amber n6"><div class="nm">signin-api</div><div class="de">换取 auth code</div></div><div class="ar"></div><div class="node cyan n7"><div class="nm">passport-login</div><div class="de">写入 Coze 登录态</div></div><div class="ar"></div><div class="node green n8"><div class="nm">verify-api</div><div class="de">确认身份权益角色</div></div></div><div class="ban"><div class="b1">失败不是黑盒：额外验证、角色不符、企业待审批都会进入 <span class="sk">skipped accounts</span>。</div><div class="b2"><span class="mo">popup</span> 展示的是后台 <span class="mo">steps</span>，所以用户能知道流程卡在哪里。</div></div></figure>

裁剪后的状态机可以写成这样：

```js
for (let attempt = 0; attempt < accountAttemptLimit; attempt += 1) { // 最多尝试有限个候选账号
  const account = await queryNextAccount(skippedAccounts); // 先从账号池拿一个未跳过候选
  const tab = await acquireCozeTab(account); // 复用或打开一个合适的 Coze 标签页
  const current = await inspectCurrentCozeSession(account, tab); // 同时读取页面状态和 Coze API 状态
  if (current.isTarget) return finishWithoutLogin(account, tab); // 已经是目标账号时不重复登录
  if (current.loggedIn) await logoutCozePassport(); // 当前是其他账号时先走 Passport 退出
  const signin = await loginCloudIdentity(account); // 用 CloudIdentity 把账号密码换成 auth code
  await loginCozePassport(signin.authCode); // 用 Coze Passport 写入 Coze 登录态
  const markers = await waitForCozeVerification(account, tab); // 轮询接口确认 uid、权益和角色
  if (markers.hasTargetMarker) return finishSuccess(account, markers); // 验证通过后返回成功结果
} // 候选账号尝试循环结束
```

这段流程有两个细节特别重要。

第一，个人账号会延迟可见导航。个人账号最终只需要打开 `https://code.coze.cn/home`，所以状态机会尽量先完成后台登录，再把用户页面刷新到目标状态，避免中间页面乱跳。

第二，企业账号会优先进入企业空间或订阅管理页。企业权益不能只看个人首页，最终要检查企业 id、企业角色和套餐 level。

## 5. CloudIdentity：个人主账号和企业子账号是两条登录链

`signin-api.js` 里有两条路径。

个人/主账号路径比较像标准 SDK 登录：

1. `getLoginCredential` 获取登录凭据 id。
2. `mixtureLogin` 提交账号密码事件。
3. 如果返回 `Authenticated`，可能还要做 identity selection。
4. 登录完成后用 `getAuthCodeForLogin` 换 auth code。

企业子账号路径完全不同。它走 CloudIdentity SaaS userlogin：

1. 用公司别名或 `account_id` 查询 SaaS 登录设置。
2. 确认密码登录开启。
3. 获取 workflow token。
4. 获取随机盐。
5. 拉取 JWK 公钥。
6. 用 RSA PKCS#1 v1.5 加密 `password + salt`。
7. 调 `authorizeMixtureLogin`。
8. 从 inline result 或 SaaS OAuth 跳转中解析 auth code。

<figure class="fz084" data-reveal role="group" aria-label="CloudIdentity 双登录链路：个人主账号走 SDK 登录、企业子账号走 SaaS userlogin，两条链路最终都收敛成 Coze auth code 并进入 Coze Passport login"><style>.fz084{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--c:#3f6d79;--cb:#dcebed;--ce:#8fbcc4;--a:#9a6516;--ab:#f4e8cc;--ae:#d9b66a;--p:#54579a;--pb:#e6e7f3;--pe:#a9adcf;--fs:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--fm:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);background:linear-gradient(170deg,var(--paper-soft,#faf6ec),var(--soft,#f7f1e4));border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;padding:24px 22px 26px;margin:1.4rem 0;font-family:var(--fs);color:var(--ink,#1a1815);box-sizing:border-box;max-width:100%;overflow:hidden}.fz084 *{box-sizing:border-box}.fz084 .hd{margin-bottom:18px}.fz084 .ttl{font-size:clamp(17px,3.4vw,23px);font-weight:800;line-height:1.32;letter-spacing:.2px;color:var(--ink,#1a1815)}.fz084 .sub{margin-top:7px;font-size:clamp(12px,2.3vw,14px);line-height:1.55;color:var(--muted,#6a6155)}.fz084 .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fz084 .card{position:relative;border-radius:16px;padding:16px 15px 14px;border:1.5px solid;background:var(--paper-soft,#faf6ec);overflow:hidden}.fz084 .card.psn{border-color:var(--ce,#8fbcc4);background:linear-gradient(180deg,var(--cb,#dcebed),var(--paper-soft,#faf6ec))}.fz084 .card.ent{border-color:var(--ae,#d9b66a);background:linear-gradient(180deg,var(--ab,#f4e8cc),var(--paper-soft,#faf6ec))}.fz084 .ch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:clamp(14px,2.7vw,18px);font-weight:800;margin-bottom:12px}.fz084 .psn .ch{color:var(--c,#3f6d79)}.fz084 .ent .ch{color:var(--a,#9a6516)}.fz084 .tag{font-family:var(--fm);font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;letter-spacing:.4px}.fz084 .psn .tag{color:#fff;background:var(--c,#3f6d79)}.fz084 .ent .tag{color:#fff;background:var(--a,#9a6516)}.fz084 .steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}.fz084 .st{position:relative;display:flex;gap:9px;align-items:flex-start;font-size:clamp(11.5px,2.3vw,13.5px);line-height:1.4;color:var(--ink-soft,#3c362c);padding:6px 9px;border-radius:9px;background:rgba(255,255,255,.42);opacity:.55;animation:fz084rise 9s ease-in-out infinite}.fz084 .st .n{flex:0 0 auto;width:19px;height:19px;border-radius:50%;font-family:var(--fm);font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#fff;margin-top:1px}.fz084 .psn .st .n{background:var(--c,#3f6d79)}.fz084 .ent .st .n{background:var(--a,#9a6516)}.fz084 .st span:last-child{min-width:0;word-break:break-word}.fz084 .st code{font-family:var(--fm);font-size:.92em;background:rgba(26,24,21,.06);padding:.5px 3px;border-radius:4px;word-break:break-all}.fz084 .psn .st:nth-child(1){animation-delay:0s}.fz084 .psn .st:nth-child(2){animation-delay:.5s}.fz084 .psn .st:nth-child(3){animation-delay:1s}.fz084 .psn .st:nth-child(4){animation-delay:1.5s}.fz084 .psn .st:nth-child(5){animation-delay:2s}.fz084 .ent .st:nth-child(1){animation-delay:.25s}.fz084 .ent .st:nth-child(2){animation-delay:.75s}.fz084 .ent .st:nth-child(3){animation-delay:1.25s}.fz084 .ent .st:nth-child(4){animation-delay:1.75s}.fz084 .ent .st:nth-child(5){animation-delay:2.25s}@keyframes fz084rise{0%,18%{opacity:.5;transform:translateY(2px)}34%,72%{opacity:1;transform:translateY(0)}100%{opacity:.5;transform:translateY(2px)}}.fz084 .note{margin-top:11px;font-size:clamp(10.5px,2.2vw,12.5px);font-weight:700;color:#fff;padding:7px 11px;border-radius:11px;line-height:1.4}.fz084 .psn .note{background:var(--c,#3f6d79)}.fz084 .ent .note{background:var(--a,#9a6516)}.fz084 .funnel{position:relative;height:46px;margin-top:2px}.fz084 .funnel .ln{position:absolute;top:0;width:42%;height:100%;border-bottom:2.5px solid var(--p,#54579a);border-radius:0 0 60% 60%/0 0 100% 100%}.fz084 .funnel .ln.l{left:6%;border-left:2.5px solid var(--p,#54579a);border-right:none;border-radius:0 0 0 80%}.fz084 .funnel .ln.r{right:6%;border-right:2.5px solid var(--p,#54579a);border-left:none;border-radius:0 0 80% 0}.fz084 .funnel .flow{position:absolute;top:0;width:7px;height:7px;border-radius:50%;background:var(--p,#54579a);box-shadow:0 0 6px var(--pe,#a9adcf)}.fz084 .funnel .flow.l{left:7%;animation:fz084fl 6s ease-in-out infinite}.fz084 .funnel .flow.r{right:7%;animation:fz084fr 6s ease-in-out infinite}@keyframes fz084fl{0%{left:7%;top:2px;opacity:0}20%{opacity:1}80%{opacity:1}100%{left:47%;top:42px;opacity:0}}@keyframes fz084fr{0%{right:7%;top:2px;opacity:0}20%{opacity:1}80%{opacity:1}100%{right:47%;top:42px;opacity:0}}.fz084 .funnel .dn{position:absolute;left:50%;bottom:-3px;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:11px solid var(--p,#54579a)}.fz084 .exit{position:relative;margin:0 auto;max-width:560px;border-radius:14px;border:1.5px solid var(--pe,#a9adcf);background:var(--pb,#e6e7f3);padding:14px 16px;text-align:center;overflow:hidden}.fz084 .exit .bar{position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(84,87,154,.16) 50%,transparent 70%);transform:translateX(-100%);animation:fz084sweep 6s ease-in-out infinite}@keyframes fz084sweep{0%,40%{transform:translateX(-100%)}70%,100%{transform:translateX(100%)}}.fz084 .exit .lbl{position:relative;font-family:var(--fm);font-size:10px;font-weight:700;letter-spacing:.6px;color:var(--p,#54579a);opacity:.85;margin-bottom:5px}.fz084 .exit .big{position:relative;font-size:clamp(13px,2.8vw,17px);font-weight:800;color:var(--p,#54579a);line-height:1.4}.fz084 .exit .big code{font-family:var(--fm);font-size:.86em;font-weight:700}.fz084 .exit .arr{display:inline-block;margin:0 5px;color:var(--p,#54579a)}@media (max-width:560px){.fz084 .cols{grid-template-columns:1fr;gap:13px}.fz084 .funnel{display:none}.fz084 .exit{margin-top:13px}}@media (prefers-reduced-motion:reduce){.fz084 .st{animation:none!important;opacity:1!important;transform:none!important}.fz084 .funnel .flow{animation:none!important;opacity:1!important}.fz084 .exit .bar{animation:none!important;transform:translateX(100%)!important}}</style><div class="hd"><div class="ttl">CloudIdentity：个人主账号和企业子账号不是一条路</div><div class="sub">后台根据账号类型选择 SDK 登录或 SaaS userlogin，最终都收敛成 Coze auth code。</div></div><div class="cols"><div class="card psn"><div class="ch"><span>个人 / 主账号</span><span class="tag">SDK 登录</span></div><ul class="steps"><li class="st"><span class="n">1</span><span><code>getLoginCredential</code></span></li><li class="st"><span class="n">2</span><span><code>mixtureLogin</code> 密码事件</span></li><li class="st"><span class="n">3</span><span>必要时 identity selection</span></li><li class="st"><span class="n">4</span><span><code>getAuthCodeForLogin</code></span></li><li class="st"><span class="n">5</span><span>返回 AuthCodeForLogin</span></li></ul><div class="note">适合主账号密码登录和身份选择</div></div><div class="card ent"><div class="ch"><span>企业 / SaaS 子账号</span><span class="tag">SaaS userlogin</span></div><ul class="steps"><li class="st"><span class="n">1</span><span>检查公司别名登录设置</span></li><li class="st"><span class="n">2</span><span><code>workflow token</code> + random salt</span></li><li class="st"><span class="n">3</span><span>JWK 公钥加密 password + salt</span></li><li class="st"><span class="n">4</span><span><code>authorizeMixtureLogin</code></span></li><li class="st"><span class="n">5</span><span>OAuth redirect 解析 auth code</span></li></ul><div class="note">需要 webRequest 或临时 tab 捕获跳转</div></div></div><div class="funnel"><span class="ln l"></span><span class="ln r"></span><span class="flow l"></span><span class="flow r"></span><span class="dn"></span></div><div class="exit"><span class="bar"></span><div class="lbl">共同出口</div><div class="big"><code>auth code</code><span class="arr">-&gt;</span>Coze Passport login</div></div></figure>

这里最麻烦的是 OAuth 跳转。扩展里的 `fetch(..., { redirect: "manual" })` 在跨域 302 上不一定能看到 `Location` header，于是代码加了两层兜底：

| 方式 | 用途 |
| --- | --- |
| `chrome.webRequest.onBeforeRedirect` | 捕获同一请求链路上的 `redirectUrl` |
| 临时隐藏 tab | 在真实 Chrome 运行时里导航 OAuth URL，从 tab 更新或 redirect 事件里读 code |

裁剪后的企业登录片段如下：

```js
async function loginEnterpriseUser(account) { // 企业子账号登录入口
  const companyAlias = resolveCompanyAlias(account); // 从账号字段里解析企业别名或企业 id
  await assertPasswordLoginEnabled(companyAlias); // 先确认这个企业允许密码登录
  const workflowToken = await getWorkflowToken(); // 获取 CloudIdentity SaaS 登录工作流 token
  const salt = await getRandomSalt(workflowToken); // 获取本轮密码加密需要的随机盐
  const jwk = await fetchEncryptionKey(); // 拉取服务端公钥，后续只用公钥加密
  const password = await rsaEncrypt(`${account.password}${salt}`, jwk); // 把密码和盐拼接后做 RSA 加密
  const result = await authorizePasswordLogin(account, companyAlias, workflowToken, password); // 提交 SaaS 密码登录事件
  if (result.state === "Pending") throw createVerificationRequiredError(result); // 需要 MFA 或验证码时抛出可识别错误
  const authCode = await resolveOAuthAuthCode(result); // 从 inline 结果或 OAuth 跳转里解析 Coze auth code
  return { authCode, enterprise: true }; // 返回给后续 Coze Passport 登录使用
} // 企业子账号登录结束
```

这也是为什么插件需要 `webRequest` 权限。它不是为了改请求，而是为了在 Chrome 扩展运行时里读取 OAuth 302 的最终目标。

## 6. Coze Passport：不用页面菜单退出，用接口写入登录态

拿到 CloudIdentity auth code 之后，还不能算登录到了 Coze。插件还要调用 Coze Web Passport 接口，把 auth code 换成当前 `code.coze.cn` 下可用的登录态。

相关逻辑在 `coze-passport-api.js`：

| 方法 | 用途 |
| --- | --- |
| `checkCozePassportLoginViaApi` | 调当前用户接口，判断 Coze Passport 是否已登录 |
| `logoutCozePassportViaApi` | 调 logout 接口，`need_redirect=0`，避免页面跳转 |
| `loginCozePassportViaApi` | 后台 `fetch` 直接调 auth login，提交 auth code 和 `platform_app_id` |
| `loginCozePassportViaPage` | 把同一个 auth login 请求丢进 Coze 页面主世界执行，借页面反爬 hook 加签 |
| `loginCozePassport` | 统一入口：有 `tabId` 走页面加签，没有就退回后台 `fetch` |
| `buildCozePassportRequest` | 构造 URL、body、CSRF header、aid sign 和 query sign |

<figure class="fz085" data-reveal role="group" aria-label="Coze Passport 接口登录链路：读取 CSRF、构造签名、退出旧账号、写入新账号四步流水线，以及签名保护与接口化的对比说明"><style>.fz085{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--soft2:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--cy:#3f6d79;--cyb:#dcebed;--cye:#8fbcc4;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--rd:#8f2d20;--rdb:#f1ddd6;--rde:#cf9b90;--gy:#917f5c;--gyb:#ece4d2;font-family:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);color:var(--ink);background:linear-gradient(160deg,var(--paper-soft),var(--soft2));border:1px solid var(--hair);border-radius:14px;padding:clamp(16px,3.4vw,30px);margin:0;max-width:1100px;box-sizing:border-box;line-height:1.5}.fz085 *{box-sizing:border-box}.fz085 .hd{font-size:clamp(17px,2.7vw,25px);font-weight:800;letter-spacing:.3px;color:var(--ink)}.fz085 .sub{margin-top:7px;font-size:clamp(12px,1.7vw,15px);color:var(--muted)}.fz085 .flow{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px;margin-top:clamp(16px,2.6vw,24px)}.fz085 .step{flex:1 1 160px;min-width:140px;border-radius:13px;padding:14px 13px;border:1px solid var(--hair);position:relative;background:var(--soft2);opacity:0;transform:translateY(8px);animation:fz-rise .7s ease forwards}.fz085 .step .k{display:inline-block;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:10px;color:var(--muted);border:1px solid var(--hair);border-radius:5px;padding:1px 6px;margin-bottom:8px}.fz085 .step .t{font-size:clamp(14px,2vw,18px);font-weight:800;line-height:1.25}.fz085 .step .c{margin-top:7px;font-family:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);font-size:clamp(10px,1.4vw,12px);color:var(--ink-soft);word-break:break-word}.fz085 .s1{background:var(--gyb);border-color:var(--gy)}.fz085 .s1 .t{color:var(--ink-soft)}.fz085 .s2{background:var(--cyb);border-color:var(--cye)}.fz085 .s2 .t{color:var(--cy)}.fz085 .s3{background:var(--amb);border-color:var(--ame)}.fz085 .s3 .t{color:var(--am)}.fz085 .s4{background:var(--rdb);border-color:var(--rde)}.fz085 .s4 .t{color:var(--rd)}.fz085 .s1{animation-delay:.05s}.fz085 .s2{animation-delay:.3s}.fz085 .s3{animation-delay:.55s}.fz085 .s4{animation-delay:.8s}.fz085 .ar{flex:0 0 26px;align-self:center;height:3px;border-radius:2px;position:relative;background:var(--hair);overflow:visible}.fz085 .ar::before{content:"";position:absolute;left:-2px;top:50%;width:14px;height:3px;border-radius:2px;transform:translateY(-50%);background:linear-gradient(90deg,transparent,var(--rd));animation:fz-pulse 6s ease-in-out infinite}.fz085 .ar::after{content:"";position:absolute;right:-7px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid var(--rd)}.fz085 .a2::before{animation-delay:.6s}.fz085 .a3::before{animation-delay:1.2s}.fz085 .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:clamp(14px,2.4vw,22px)}.fz085 .card{background:var(--paper-soft);border:1px solid var(--hair);border-radius:13px;padding:14px 16px}.fz085 .card h4{margin:0 0 8px;font-size:clamp(14px,1.9vw,17px);font-weight:800;color:var(--ink)}.fz085 .card p{margin:5px 0;font-size:clamp(12px,1.6vw,14px);color:var(--ink-soft);padding-left:14px;position:relative}.fz085 .card p::before{content:"";position:absolute;left:0;top:.62em;width:6px;height:6px;border-radius:50%;background:var(--ame)}.fz085 .card.c2 p::before{background:var(--cye)}.fz085 .banner{margin-top:clamp(14px,2.4vw,22px);background:var(--ink);color:var(--paper-soft);border-radius:11px;padding:13px 18px;font-size:clamp(12px,1.7vw,15px);font-weight:700;display:flex;align-items:center;gap:11px;position:relative;overflow:hidden}.fz085 .banner::before{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 20%,rgba(143,45,32,.22) 50%,transparent 80%);transform:translateX(-100%);animation:fz-sweep 9s ease-in-out infinite}.fz085 .banner .dot{flex:0 0 auto;width:9px;height:9px;border-radius:50%;background:var(--rde);box-shadow:0 0 0 0 rgba(207,155,144,.5);animation:fz-beat 6s ease-in-out infinite}.fz085 .banner span{position:relative}@keyframes fz-rise{to{opacity:1;transform:translateY(0)}}@keyframes fz-pulse{0%,100%{opacity:.35}45%,55%{opacity:1}}@keyframes fz-sweep{0%,60%{transform:translateX(-100%)}90%,100%{transform:translateX(100%)}}@keyframes fz-beat{0%,100%{box-shadow:0 0 0 0 rgba(207,155,144,.5)}50%{box-shadow:0 0 0 6px rgba(207,155,144,0)}}@media(max-width:560px){.fz085 .flow{flex-direction:column}.fz085 .step{flex:1 1 auto;width:100%}.fz085 .ar{align-self:center;width:3px;height:22px;flex-basis:auto}.fz085 .ar::before{left:50%;top:-2px;width:3px;height:14px;transform:translateX(-50%);background:linear-gradient(180deg,transparent,var(--rd))}.fz085 .ar::after{right:auto;left:50%;top:auto;bottom:-7px;transform:translateX(-50%);border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--rd);border-bottom:0}.fz085 .cards{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.fz085 .step{animation:none;opacity:1;transform:none}.fz085 .ar::before,.fz085 .banner::before,.fz085 .banner .dot{animation:none}.fz085 .ar::before{opacity:1}}</style><div class="hd">Coze Passport：用接口退出旧账号，再写入新登录态</div><div class="sub">CloudIdentity auth code 还不是 Coze 登录态，需要 Passport 接口接住。</div><div class="flow"><div class="step s1"><span class="k">step 1</span><div class="t">读取 CSRF</div><div class="c">passport_csrf_token</div></div><div class="ar a1" aria-hidden="true"></div><div class="step s2"><span class="k">step 2</span><div class="t">构造签名</div><div class="c">query sign + aid sign</div></div><div class="ar a2" aria-hidden="true"></div><div class="step s3"><span class="k">step 3</span><div class="t">退出旧账号</div><div class="c">need_redirect = 0</div></div><div class="ar a3" aria-hidden="true"></div><div class="step s4"><span class="k">step 4</span><div class="t">写入新账号</div><div class="c">auth code + app id</div></div></div><div class="cards"><div class="card c1"><h4>签名保护了什么</h4><p>请求路径、公共参数、业务参数和时间戳</p><p>GET 与 POST 的签名输入不同</p></div><div class="card c2"><h4>为什么不用页面点击</h4><p>菜单和 DOM 容易变，接口步骤可测试</p><p>退出和登录都能记录明确 step</p></div></div><div class="banner"><span class="dot" aria-hidden="true"></span><span>Passport login 成功后，还必须继续等 Coze API 验权通过。</span></div></figure>

Passport 请求的细节比较多：

- CSRF token 从 `passport_csrf_token` 或 `passport_csrf_token_default` cookie 读取。
- GET 和 POST 的签名数据不同，GET 会把业务 data 放进 query。
- query 参数会排序，再和 body data、app key 组合生成签名。
- aid sign 用当天 UTC noon timestamp 派生，避免每次请求都固定不变。
- logout 使用接口退出，而不是点页面头像菜单，减少 DOM 依赖。

裁剪后的请求构造是这样：

```js
async function buildPassportRequest(path, method, data) { // 构造一次 Coze Passport 请求
  const csrfToken = await readPassportCsrfCookie(); // 从 Chrome cookie API 读取 Passport CSRF token
  const timestamp = getNoonUtcTimestamp(); // 生成当天稳定时间戳，用于 Passport 签名
  const common = buildCommonPassportParams(timestamp); // 拼出 aid、语言、SDK 版本等公共参数
  const query = method === "GET" ? { ...data, ...common } : common; // GET 把业务参数放 query，POST 放 body
  const signature = await createQuerySignature(query, data); // 对排序后的 query 和 body 生成请求签名
  const aidSign = await createAidSignature(path, timestamp); // 对 aid、path 和时间戳生成 header 签名
  return { url: joinUrl(path, query, signature), body: encodeBody(method, data), csrfToken, aidSign }; // 返回 fetch 可用请求对象
} // Passport 请求构造结束
```

这层的目标不是“绕过登录”，而是复用 Web 登录体系接受的入口，把 CloudIdentity 已经认证过的 auth code 写成 Coze 当前站点的登录态。

### 6.1 被反作弊拦住：为什么后台裸 `fetch` 会失败

上面那套 CSRF、query sign、aid sign，插件都手搓复刻了。但真实跑起来，`auth login` 经常返回 `error_code: 7`。查 Passport 官方错误码文档就会发现，**7 的含义是“命中反作弊”，不是“访问太频繁”的限流**——插件早期把它当限流处理，其实名字取错了。

真正的原因是：Coze 官方前端（`coze-monorepo`）发这个请求时，除了业务签名，还带了一层**动态风控签名**（`a_bogus` / `X-Bogus` / `msToken` 这一类字段），而插件的后台请求没有。这层签名不是官方业务代码算的，而是页面里另外加载的一套字节反爬库（国内 `sdk-glue.js`，海外 `webmssdk.es5.js`）算的。它的工作方式是：

1. 页面在 `<head>` 用 `<script>` 把反爬库加载进来并初始化。
2. Passport SDK 启动时，把 `/passport` 这些路径**登记**进反爬库的“需要加签清单”。
3. 反爬库把全局 `window.fetch` **替换成自己的加签版本**——凡是打到清单里路径的请求，都在发出前现算签名、塞进去，再走真正的网络。

关键就在第 3 步：被 hook 的是**全局** `fetch`。所以官方页面上任何代码打到 `/passport`，都被这层透明地加了签，业务代码自己一行签名逻辑都不用写。官方是“白嫖”了这套页面上的能力。

而插件的 `service worker` 是一个没有 `window`、没有被 hook 的 `fetch`、没有反爬库的环境，签名恒缺，于是被判为可疑请求 → 错误码 7。

更麻烦的是，这层签名**没法当静态参数抄过来**：

| 特性 | 后果 |
| --- | --- |
| 逐请求变化 | 喂进去的是 URL 和 body，换个请求就变 |
| 带时间戳 | 过一会儿服务端就判过期 |
| 绑定运行环境 | 掺了设备指纹、UA 等熵，换环境算出来对不上 |
| 产自混淆代码 | 算法在远程加密 JS 里，无法离线复刻 |

你能抄到的只是某一次的“产物”，而产物立刻失效。唯一可行的办法是**复用那台正在运行的加签机器**——也就是让请求从装了这套 hook 的页面里发出去。

### 6.2 修复：把登录请求放进 Coze 页面主世界

插件的做法是：不再从 `service worker` 直接 `fetch`，而是用 `chrome.scripting.executeScript({ world: "MAIN" })` 把这次请求丢进 `code.coze.cn` 标签页的**主世界**执行。那里 `window.fetch` 已经被反爬库换成加签版，请求打到 `/passport/web/auth/login/` 时会被透明加签，和官方走的是同一条路。

裁剪后的页面加签逻辑是这样：

```js
async function loginCozePassportViaPage(authCode, tabId) { // 借 Coze 页面主世界完成加签登录
  const request = await buildPassportRequest(AUTH_LOGIN_PATH, "POST", { code: authCode }); // 仍先算好业务签名
  const [{ result }] = await chrome.scripting.executeScript({ // 把请求丢进目标标签页的主世界
    target: { tabId }, // 必须是一个已加载 code.coze.cn 的标签页
    world: "MAIN", // 关键：进主世界才能命中页面被 hook 的 fetch
    func: pagePassportFetch, // 下面这个函数会在页面里跑
    args: [request], // 把算好业务签名的请求传进去
  });
  return parsePassportResponse(result); // 回到后台再按老逻辑解析响应
}

function pagePassportFetch(request) { // 这个函数在页面主世界里执行
  if (typeof window._SdkGlueInit === "function") { // 防御性地补登记 /passport
    window._SdkGlueInit({ bdms: { paths: ["/passport"] } }); // 万一这张标签页还没登记过
  }
  return window.fetch(request.url, { // 用页面被 hook 的 fetch 发出去
    method: request.method, // 反爬库会在这一下自动补上 a_bogus / msToken 等签名
    headers: request.headers, // 业务签名 header 保持不变
    body: request.body, // POST body 保持不变
    credentials: "include", // 带上 code.coze.cn 的 cookie
  }); // 真正的加签发生在这次 fetch 内部
}
```

配套还有两个兜底，处理“页面加签也没救回来”的情况：

- **限流冷却熔断**（`passport-login-cooldown.js`）：一旦命中反作弊，写入一个指数退避的冷却窗口（60 秒起，最长 10 分钟），下次切换先检查冷却，避免连环触发把账号越打越死。
- **浏览器模拟点击兜底**：真扛不住时，popup 弹出确认，改用真实页面点击登录——这条最慢但最像真人，通常能过。

### 6.3 一个小寓言：活印与城门

> 边关有一道城门，进城的信必须盖“活印”。这印子邪门：它随当天的日头、风向、时辰不停地变，上午盖的，下午就作废。
>
> 有个仿造高手，把昨天一封进过城的信翻出来，照着上面的印子一笔一画描到自己信上，自以为天衣无缝。到了城门，守卫扫一眼就把他叉了出去——印是死的，风是活的，对不上。
>
> 隔壁老商人从不自己刻印。他每次都把信递到城门口那台会盖章的机关跟前，机关“咔”地一下，按此时此刻的风与日头盖上活印，他再把信送进去，畅通无阻。
>
> 徒弟不解：“您那印跟他描的，看着一模一样啊。”老商人说：“**印能抄，风抄不了。他抄的是印，我借的是那台机关。**”

对应到这个插件：

| 寓言 | 现实 |
| --- | --- |
| 活印 | 反爬库现算的 `a_bogus` / `msToken` 动态签名 |
| 印随风变 | 签名绑定时间戳、设备指纹、请求内容，逐次失效 |
| 仿造高手描印 | 后台裸 `fetch` 想靠静态参数糊弄，命中反作弊（错误码 7） |
| 城门口会盖章的机关 | Coze 页面里 hook 了 `fetch` 的反爬库 |
| 把信递到机关跟前 | 用 `executeScript({ world: "MAIN" })` 让请求从页面发出去 |
| 借机关而非自刻 | 不复刻签名算法，复用页面这台“正在运行的加签机器” |

一句话：**打不过风控，别去伪造它的签名；把请求送到那个天生就会签名的地方，让它替你签。**

## 7. 验权：成功条件必须来自 Coze 侧事实

很多账号切换工具容易犯一个错：只要登录接口返回成功，就认为切换成功。

这个插件没有这么做。它把“登录成功”和“切到目标权益”分成两件事。最终验收在 `coze-verification-api.js`。

主要检查点如下：

| 检查 | 个人账号 | 企业账号 |
| --- | --- | --- |
| 身份 | Passport user id 匹配 Stone 返回的 `uid` | 订阅信息里的 `enterprise_id` 或火山账号 id 匹配 `account_id` |
| 权益 | `user_level_v2` 命中目标权益映射 | `user_level_v2` 命中企业/团队权益映射 |
| 角色 | 不需要角色 | 企业列表里的 role type 命中目标角色 |
| 额度展示 | 读取资源点 benefit | 同样读取资源点 benefit |

`RIGHTS_TO_USER_LEVELS` 是这层的核心映射。比如“企业旗舰版”会对应 Coze 侧的企业旗舰 level，“个人进阶版（coze1.5）”会兼容旧 level。这样文章、UI 和账号服务里的中文权益名，最终可以落到 Coze API 的数字 level 上。

<figure class="fz086" data-reveal role="group" aria-label="最终裁决：Coze API 主验证先行，页面辅助信号只作兜底，成功条件等于身份加权益加角色匹配"><style>.fz086{--paper-soft:#faf6ec;--paper-deep:#ece5d5;--paper-warm:#f7f1e4;--ink:#1a1815;--ink-soft:#3c362c;--muted:#6a6155;--hair:rgba(26,24,21,.18);--g:#4f7233;--gb:#e7eedd;--gl:#7c9c54;--am:#9a6516;--amb:#f4e8cc;--ame:#d9b66a;--font-serif:var(--font-serif-body,"Songti SC","Source Han Serif SC",Georgia,serif);--font-mono:var(--font-mono,ui-monospace,"SFMono-Regular",monospace);box-sizing:border-box;margin:0;padding:clamp(16px,3vw,28px);background:var(--paper-soft,#faf6ec);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:14px;font-family:var(--font-serif);color:var(--ink,#1a1815);line-height:1.5;max-width:100%;overflow:hidden}.fz086 *{box-sizing:border-box}.fz086 .hd{margin-bottom:clamp(14px,2.4vw,22px)}.fz086 .t1{font-size:clamp(17px,2.6vw,23px);font-weight:800;letter-spacing:.01em;color:var(--ink,#1a1815)}.fz086 .t2{margin-top:6px;font-size:clamp(12px,1.7vw,14px);color:var(--muted,#6a6155)}.fz086 .stage{display:flex;align-items:stretch;gap:clamp(10px,1.6vw,16px)}.fz086 .col{flex:1 1 0;min-width:0;border-radius:16px;padding:clamp(13px,1.8vw,18px);position:relative;overflow:hidden}.fz086 .col.api{background:var(--gb,#e7eedd);border:1.5px solid var(--gl,#7c9c54)}.fz086 .col.page{background:var(--amb,#f4e8cc);border:1.5px solid var(--ame,#d9b66a)}.fz086 .ch{display:flex;align-items:center;gap:8px;font-size:clamp(14px,2vw,18px);font-weight:800;margin-bottom:12px}.fz086 .api .ch{color:var(--g,#4f7233)}.fz086 .page .ch{color:var(--am,#9a6516)}.fz086 .dot{width:9px;height:9px;border-radius:50%;flex:none}.fz086 .api .dot{background:var(--g,#4f7233);animation:fz086pulse 7s ease-in-out infinite}.fz086 .page .dot{background:var(--am,#9a6516)}.fz086 .lst{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}.fz086 .lst .it{position:relative;padding:7px 10px 7px 22px;font-size:clamp(12px,1.55vw,14px);color:var(--ink-soft,#3c362c);background:var(--paper-warm,#f7f1e4);border:1px solid var(--hair,rgba(26,24,21,.18));border-radius:8px;opacity:.55;transform:translateX(var(--sx,-4px));animation:fz086in 8s ease-in-out infinite}.fz086 .col.api .it{--sx:-4px}.fz086 .col.page .it{--sx:4px}.fz086 .it::before{content:"";position:absolute;left:9px;top:50%;width:6px;height:6px;border-radius:50%;transform:translateY(-50%)}.fz086 .api .it::before{background:var(--gl,#7c9c54)}.fz086 .page .it::before{background:var(--ame,#d9b66a)}.fz086 .col .it:nth-child(1){animation-delay:0s}.fz086 .col .it:nth-child(2){animation-delay:.6s}.fz086 .col .it:nth-child(3){animation-delay:1.2s}.fz086 .col .it:nth-child(4){animation-delay:1.8s}.fz086 .col .it:nth-child(5){animation-delay:2.4s}.fz086 code{font-family:var(--font-mono);font-size:.92em;background:rgba(26,24,21,.05);padding:0 3px;border-radius:3px}.fz086 .badge{margin-top:13px;font-size:clamp(11px,1.4vw,13px);font-weight:700;color:#fff;padding:8px 11px;border-radius:9px;line-height:1.35}.fz086 .api .badge{background:var(--g,#4f7233)}.fz086 .page .badge{background:var(--am,#9a6516)}.fz086 .conn{flex:none;align-self:center;width:clamp(34px,5vw,60px);position:relative;height:30px}.fz086 .flow{position:absolute;top:50%;left:0;height:3px;width:100%;transform:translateY(-50%);background:linear-gradient(90deg,var(--g,#4f7233),var(--am,#9a6516));border-radius:2px;overflow:hidden}.fz086 .flow::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(250,246,236,.9),transparent);animation:fz086slide 6s linear infinite}.fz086 .head{position:absolute;top:50%;right:-2px;transform:translateY(-50%);width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:11px solid var(--am,#9a6516)}.fz086 .verdict{margin-top:clamp(14px,2.2vw,20px);background:var(--ink,#1a1815);color:var(--paper-soft,#faf6ec);border-radius:14px;padding:clamp(13px,2vw,18px) clamp(16px,2.4vw,22px);position:relative;overflow:hidden}.fz086 .verdict::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(124,156,84,.16),transparent);transform:translateX(-100%);animation:fz086sweep 9s ease-in-out infinite}.fz086 .vt{position:relative;font-size:clamp(13px,2vw,18px);font-weight:800;letter-spacing:.01em}.fz086 .vt b{color:var(--gl,#7c9c54)}.fz086 .vs{position:relative;margin-top:7px;font-size:clamp(11px,1.5vw,13px);color:rgba(250,246,236,.72)}@keyframes fz086in{0%,14%{opacity:.5;transform:translateX(var(--sx,-4px))}30%,72%{opacity:1;transform:translateX(0)}90%,100%{opacity:.5;transform:translateX(var(--sx,-4px))}}@keyframes fz086slide{0%{left:-40%}100%{left:120%}}@keyframes fz086pulse{0%,100%{box-shadow:0 0 0 0 rgba(79,114,51,.5)}50%{box-shadow:0 0 0 6px rgba(79,114,51,0)}}@keyframes fz086sweep{0%,100%{transform:translateX(-100%)}55%{transform:translateX(100%)}}@media (max-width:560px){.fz086 .stage{flex-direction:column}.fz086 .conn{width:100%;height:34px;transform:rotate(90deg)}}@media (prefers-reduced-motion:reduce){.fz086 *{animation:none!important}.fz086 .lst .it{opacity:1;transform:none}.fz086 .flow::after,.fz086 .verdict::before{display:none}}</style><div class="hd"><div class="t1">最终裁决：Coze API 先验，页面标记只兜底</div><div class="t2">登录接口返回成功不等于切换成功，必须验证目标账号事实。</div></div><div class="stage"><div class="col api"><div class="ch"><span class="dot"></span>API 主验证</div><div class="lst"><div class="it">Passport 当前用户信息</div><div class="it">订阅权益 <code>subscription_v2</code></div><div class="it"><code>uid</code> / <code>enterprise_id</code> 身份匹配</div><div class="it"><code>user_level_v2</code> 映射套餐权益</div><div class="it">企业列表检查角色类型</div></div><div class="badge">输出 finalMarkers，决定 popup 成功态</div></div><div class="conn" aria-hidden="true"><div class="flow"></div><div class="head"></div></div><div class="col page"><div class="ch"><span class="dot"></span>页面辅助信号</div><div class="lst"><div class="it">企业空间 URL 和 enterprise id</div><div class="it">页面上的权益名和额度</div><div class="it">目标用户名或账号 id 文案</div><div class="it">待审批、无权限、登录页标记</div><div class="it">订阅接口 5xx 时有限兜底</div></div><div class="badge">不能覆盖角色校验和明确 API 失败</div></div></div><div class="verdict"><div class="vt">成功条件 = <b>身份匹配</b> + <b>权益匹配</b> + <b>角色匹配</b></div><div class="vs">页面看起来像目标账号，只能作为少数异常场景的补充证据。</div></div></figure>

裁剪后的验权逻辑如下：

```js
async function inspectTargetCozeAccount(account) { // 检查当前 Coze 会话是否是目标账号
  const passport = await checkPassportLogin(); // 先读 Coze Passport 当前用户信息
  const subscription = await fetchSubscriptionDetail(account); // 再按个人或企业账号读取订阅权益详情
  const identityMatched = matchIdentity(account, passport, subscription); // 用 uid 或 enterprise_id 判断身份是否一致
  const levelMatched = matchUserLevel(account, subscription.userLevel); // 用权益名映射出的 level 判断套餐是否一致
  const roleMatched = await inspectEnterpriseRoleIfNeeded(account); // 企业账号继续检查角色，个人账号直接通过
  return buildFinalMarkers(identityMatched, levelMatched, roleMatched, subscription); // 汇总成 popup 可展示的 finalMarkers
} // Coze 目标账号验权结束
```

content script 仍然有价值，但它不是主裁判。

它会读取页面上的这些信号：

- 当前 URL 是否在企业空间。
- 页面上是否出现目标用户名或账号 id。
- 是否能看到权益名、额度、积分。
- 是否出现“申请加入账号所关联的企业”“等待审批”“无权限”等失败标记。
- 页面是否像登录态页面，还是登录落地页。

只有在 Coze 订阅接口出现服务端错误，并且企业账号不要求具体角色时，后台才允许用页面标记做兜底回补。这个条件很窄，避免“页面看起来像”覆盖掉真正的 API 验权。

## 8. 异常恢复：跳过、回补和人工验证

这个插件的体验好不好，很大程度取决于失败路径写得细不细。

它处理了几类典型异常：

| 情况 | 处理方式 |
| --- | --- |
| 当前已是同权益账号 | popup 让用户确认，确认后跳过当前账号再查一个 |
| 企业角色不匹配 | 加入 skipped accounts，继续查下一个 |
| 企业尚未加入或审批中 | 标记跳过，继续查下一个 |
| CloudIdentity 要求额外验证 | 先跳过当前账号，继续查别的候选 |
| 候选账号都需要验证 | 打开真实验证页，让用户完成手机、邮箱或 MFA 验证 |
| Passport 命中反作弊（错误码 7） | 优先靠页面主世界加签重发；仍失败则写入限流冷却窗口，转浏览器模拟点击兜底 |
| Coze 标签页被关闭 | 记录恢复步骤，重新获取 Coze 标签再试 |
| popup 关闭后重开 | 通过 lastRun 轮询和 reconcile 回补结果 |

“需要额外验证”这条尤其细。状态机不会一遇到 `VerificationTypeRequired` 就把用户扔到验证页，而是先把这个账号加入本轮验证候选，继续找下一个账号。只有候选池耗尽时，才打开最后一个真实验证入口。

这背后的产品判断是：测试账号池里也许有另一个不需要 MFA 的账号，能自动完成就不要打断用户。

`lastRun` 也很实用。切换流程可能比 popup 生命周期长；popup 关掉后后台仍可能继续跑。重新打开 popup 时，它会读取 `lastRun`，如果状态还是 `running`，就尝试用当前 Coze API 或页面标记回补成 success。

## 9. 自己账号恢复：保存的是浏览器会话，不是账号密码

“切回自己账号”不是反向调用测试账号服务。插件不会猜测切换前的账号是谁，因为切换前也可能已经是另一个测试账号。

它采用的是显式快照：

1. 用户确认当前 Coze 页面登录的是自己账号。
2. 点击“保存当前为自己账号”。
3. 后台读取 Coze、Signin、SaaS Signin 相关 cookie。
4. 快照写入 `chrome.storage.session`。
5. 切回时先删除当前这些域名下的相关 cookie，再恢复未过期快照。
6. 打开或刷新 Coze 首页。

这里有两个边界值得强调。

第一，快照只存在 session storage。浏览器会话结束后，这份自己账号快照不会像 JWT 那样长期留在 local storage。

第二，恢复范围只覆盖 Coze/Signin 相关 cookie，不做全浏览器 cookie 备份。这避免插件变成一个过宽的 profile 复制工具。

裁剪后的恢复逻辑如下：

```js
async function restoreOwnSessionSnapshot() { // 用户点击“切回自己账号”后的后台入口
  const snapshot = await readSessionSnapshot(); // 从 chrome.storage.session 读取之前保存的快照
  if (!snapshot?.cookies?.length) throw new Error("No saved session"); // 没有 cookie 快照就明确报错
  const currentCookies = await collectCozeAndSigninCookies(); // 收集当前 Coze 和 Signin 相关 cookie
  await removeCookies(currentCookies); // 先清掉当前测试账号会话残留
  const validCookies = snapshot.cookies.filter(cookie => !isExpired(cookie)); // 只恢复仍未过期的 cookie
  await setCookies(validCookies); // 把自己账号 cookie 写回 Chrome profile
  return openCozeHome(); // 最后刷新或打开 Coze 首页给用户确认
} // 自己账号会话恢复结束
```

这条能力的本质是“浏览器会话恢复”，不是“自己的账号自动登录”。这个说法更准确，也更安全。

## 10. 测试：用 fake Chrome runtime 把浏览器行为拆开

这个仓库没有复杂构建链路，`package.json` 里主要是：

```bash
npm test # 使用 node --test 跑单元测试
npm run check # 对核心 JS 文件做 node --check 语法检查
```

测试文件覆盖得比较贴近风险点：

| 测试 | 关注点 |
| --- | --- |
| `account.test.js` | 账号模型、个人/企业判断、权益和角色提取 |
| `service.test.js` | Stone 请求体、JWT header、排除列表 |
| `signin-api.test.js` | 个人登录、企业 SaaS 登录、OAuth redirect 捕获 |
| `coze-passport-api.test.js` | Passport 请求签名、CSRF、login/logout/check、页面主世界加签登录与退回逻辑 |
| `coze-verification-api.test.js` | user level 映射、企业角色、身份匹配 |
| `switch-controller.test.js` | 状态机步骤、跳过策略、标签页恢复、人工验证 |
| `service-worker.test.js` | running lastRun 的页面回补条件 |
| `popup-same-rights.test.js` | 同权益账号确认逻辑 |
| `session-snapshot.test.js` | cookie 快照保存和恢复 |
| `tab-utils.test.js` | 选择最佳 Coze 标签页和 URL 判断 |

最有价值的是 fake Chrome runtime。测试里手写了 `tabs.create`、`tabs.update`、`tabs.sendMessage`、`webRequest.onBeforeRedirect` 等能力，这样状态机不用真的打开浏览器，也能验证“缺 tab 后能恢复”“OAuth redirect 能捕获”“不会走旧 UI 登录消息”这些行为。

这对扩展开发很关键。Chrome 扩展如果只靠手工加载测试，会非常慢；但把 Chrome API 抽成可注入对象，就能把大多数逻辑放进普通 Node 单测里跑。

## 11. 这个实现最值得学的几处取舍

第一，**接口优先，页面兜底**。

插件没有把页面 DOM 当成唯一事实来源。登录、退出、验权都尽量走 API；content script 只读页面状态，用来补充用户可见信号。这让流程更可测，也更抗 UI 改版。

第二，**状态机要把失败也建模进去**。

跳过账号、角色不匹配、企业待审批、额外验证、tab 丢失、lastRun 回补都不是边角异常，而是账号切换产品的核心路径。源码把这些路径写成 step，popup 才能给出可理解反馈。

第三，**成功条件要后置到目标系统事实**。

CloudIdentity 返回 auth code 只是“身份认证完成”。Coze Passport login 成功只是“登录态写入完成”。真正成功必须等 Coze API 证明当前会话有目标 uid、enterprise_id、权益 level 和角色。

第四，**敏感材料不要穿过不必要的边界**。

账号密码只在后台一次切换流程中使用，不写 storage，不发给 content script，不显示在 popup。自己账号恢复保存的是 cookie 快照，而且放在 session storage。这个边界比“工具能用”更重要。

第五，**扩展权限要和解释绑定**。

`cookies`、`webRequest` 这些权限看起来很重，但源码里都有明确用途：前者读 CSRF 和保存恢复会话，后者捕获 SaaS OAuth 跳转。权限不是越少越好，而是每个权限都要能讲清楚为什么存在、在哪里使用、不会做什么。

## 12. 总结

这个插件表面上是“切换 Coze 测试账号”，实际实现的是一条完整的浏览器会话编排链路：

```text
popup 选择权益和角色
  -> service worker 保存配置和 lastRun
  -> Stone 查询候选账号
  -> 当前 Coze 会话检查
  -> Coze Passport 退出旧账号
  -> CloudIdentity 登录目标账号
  -> Coze Passport 写入新登录态
  -> Coze API 验证身份、权益、角色
  -> popup 展示步骤和结果
```

它最好的地方不是用了多少接口，而是把每个边界都处理得比较清楚：

- UI 边界：popup 只展示和确认。
- 权限边界：高权限动作收口在后台。
- 数据边界：密码不进 storage，不进页面。
- 验权边界：Coze API 是主裁判，页面标记只兜底。
- 恢复边界：自己账号是显式 cookie session 快照，不是假定切换前账号。

对 Chrome 扩展、内部测试工具和账号切换类产品来说，这个实现的参考价值很高：不要急着写点击脚本，先把“我要证明什么事实”讲清楚，再围绕这些事实设计状态机。
