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
7. 写 Coze 登录态时调用 Coze Web Passport 接口，带 CSRF、请求签名和 `platform_app_id`。
8. 成功条件以 Coze API 验证为主：uid、enterprise_id、套餐 level、企业角色都要匹配。
9. content script 只作为页面状态补充信号，主要用于当前态读取、企业页兜底和用户可见反馈。
10. 遇到额外验证、企业审批中、角色不匹配、同权益账号等情况，状态机会跳过或转入人工验证，而不是盲目报成功。
11. “切回自己账号”不是再查一个账号，而是把 Coze/Signin 相关 cookie 快照暂存在 `chrome.storage.session`。
12. 测试覆盖了账号模型、服务请求、CloudIdentity、Coze Passport 签名、验权、tab 策略、service worker 回补和 popup 决策。

{% asset_img figure-01.svg %}

本文观察对象如下：

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/bytedance/Code/coze-account-switch-extension` |
| 观察日期 | `2026-06-03` |
| 观察 commit | `9da36ab87ae92efeb62771d3fdb9580f522964ad` |
| 工作区状态 | 观察时存在未提交改动，本文基于本地工作区源码阅读 |
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
8. 拿 auth code 调 Coze Passport auth login。
9. 打开或刷新 Coze 验证页。
10. 轮询 Coze API，直到身份、权益和角色都匹配。

{% asset_img figure-02.svg %}

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

{% asset_img figure-03.svg %}

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
| `loginCozePassportViaApi` | 调 auth login 接口，提交 auth code 和 `platform_app_id` |
| `buildCozePassportRequest` | 构造 URL、body、CSRF header、aid sign 和 query sign |

{% asset_img figure-04.svg %}

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

{% asset_img figure-05.svg %}

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
| `coze-passport-api.test.js` | Passport 请求签名、CSRF、login/logout/check |
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
