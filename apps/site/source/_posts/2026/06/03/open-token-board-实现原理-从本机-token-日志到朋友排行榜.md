---
title: "Open Token Board 实现原理：从本机 Token 日志到朋友排行榜"
date: "2026-06-03 21:20:00"
categories:
  - 技术
tags:
  - Open Token Board
  - Token
  - Agent
  - Next.js
  - PostgreSQL
  - GitHub OAuth
excerpt: "拆解 open-token-board 如何把 Codex、Claude Code、Cursor、Trae 的本机用量日志采集成统一事件，再通过 GitHub Device Flow、后端二次清洗、PostgreSQL/JSON 存储、滚动时间窗口聚合和 Next.js 榜单 UI，做成一个朋友之间可公开查看的 AI 编码 Token 排行榜。"
cover: "cover-v1.svg"
coverPosition: "below-title"
---

## 摘要

`Open Token Board` 做的是一件很具体的事：把大家本机 AI 编码工具产生的 token 用量，变成一张可以一起看的朋友排行榜。

先给结论：

1. 它是一个 `pnpm workspace`，把 `web`、`api`、`core`、`deploy` 和 `npx agent` 分成了清晰边界。
2. 真正发给朋友安装的是单文件 `token-board-agent`，不是整个仓库。
3. agent 在本机扫描 `Codex`、`Claude Code`、`Cursor`、`Trae` 的用量记录，并把不同格式归一成 `TokenUsageEvent`。
4. Codex 日志里的 `total_token_usage` 是累计值，agent 会转成相邻 token_count 之间的增量，避免重复计数。
5. 首次安装走 GitHub Device Flow，后端签发 agent session token；旧的 upload token 机制还保留作兼容。
6. 上传到后端后还会再做一次清洗：替换用户身份、截断字段、限制时间范围、hash session id、按配置隐藏模型或项目。
7. 存储层优先用 PostgreSQL；没有数据库配置时回退到 JSON 文件。两种实现都用事件 `id` 去重。
8. 排行榜不是预先写死的表，而是查询时按 `1D`、`7D`、`30D`、`90D` 滚动窗口聚合。
9. 前端页面只读后端 API，不再用假数据兜底；读不到真实服务时会明确显示错误状态。
10. 站点发布时会把 `token-board-agent` 打成 `token-board-agent.tgz`，和 Next.js 静态页面一起由 GitHub Pages 分发。

{% asset_img figure-01.svg %}

本文观察对象如下：

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/bytedance/Code/open-token-board` |
| 观察日期 | `2026-06-03` |
| 观察 commit | `0f679baeb22b62ede9c49c0aa231a3577902998b` |
| 前端入口 | `apps/web/app/board/page.tsx` |
| API 入口 | `apps/token-board-api/src/server.ts` |
| core 聚合 | `packages/token-board-core/src/token-leaderboard.ts` |
| 发布 agent | `tools/token-board-agent-npx/bin/token-board-agent.mjs` |

## 0. 先把几个词讲清楚

这个项目里最核心的概念不是“排行榜”，而是 `TokenUsageEvent`。

它是一条已经清洗过的用量事件，大致包含：

| 字段 | 含义 |
| --- | --- |
| `id` | 事件主键，用来去重和幂等导入 |
| `userId` / `displayName` | 榜单用户身份 |
| `source` / `tool` | 数据来自哪个工具，比如 Codex CLI、Claude Code、Cursor |
| `model` | 这条事件对应的模型名 |
| `project` | 项目名，默认只保留 basename |
| `timestamp` | 这次用量发生的时间 |
| `inputTokens` | 输入上下文 token |
| `cachedInputTokens` | 输入上下文里缓存命中的部分 |
| `outputTokens` | 模型输出 token |
| `reasoningOutputTokens` | 推理 token，主要作为副指标展示 |
| `sessionId` / `sessionTitle` | 会话标识和短标题，默认会对 session id 做 hash |

这里还有一个口径要提前说清楚：榜单里的“总消耗”按 `inputTokens + outputTokens` 算。`cachedInputTokens` 是输入上下文里的缓存命中子集，费用估算会用到，但不会从总消耗里扣掉。项目也明确拒绝只拿 `totalTokens` 兜底，因为不同工具对 `total_tokens` 的定义可能不一致。

另一个词是 `rolling range`。排行榜支持 `1D`、`7D`、`30D`、`90D`，不是自然日、自然周、自然月，而是以当前时间为结束点向前滚动取窗口。比如 `7D` 就是“现在往前 7 天”。

## 1. 总体架构：把不稳定的本机日志挡在 core 外面

这个仓库的边界分得很直接：

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| Web | `apps/web` | Next.js 静态站点、安装说明、榜单 UI |
| API | `apps/token-board-api` | HTTP API、GitHub OAuth、上传鉴权、查询接口 |
| Core | `packages/token-board-core` | 事件模型、采集解析、隐私清洗、排行榜聚合、存储接口 |
| Deploy | `deploy/token-board` | PostgreSQL + API 的 Docker Compose 部署包 |
| Agent | `tools/token-board-agent-npx` | 朋友通过 `npx` 安装的轻量同步工具 |
| Pack | `scripts/pack-agent.mjs` | 把 agent 打成 `apps/web/public/token-board-agent.tgz` |

这套拆法背后的思路是：**本机日志格式随工具变化而变化，但排行榜核心只接受统一事件。**

所以，复杂度主要被分到两段：

- 采集端负责尽可能兼容不同工具的本地文件。
- 服务端负责二次清洗、鉴权、落库和聚合。

前端不直接理解 Codex JSONL、Cursor SQLite 或 Claude history。它只消费 `/api/usage/stats`、`/api/usage/me` 这种已经成形的 JSON。

{% asset_img figure-02.svg %}

## 2. 本机 agent：从多种日志里抠出同一种事件

朋友安装时执行的命令长这样：

```bash
npx --yes token-board-agent install # 安装并启动本机 token 同步 agent
```

安装命令做了三件事：

1. 引导 GitHub Device Login。
2. 保存后端签发的 agent session token 到 `~/.token-board-agent.json`。
3. 注册后台同步任务：macOS 用 `LaunchAgent`，Windows 用 `Task Scheduler`。

后台任务默认每 5 分钟跑一次。真正上传前，它会先扫描本机默认路径：

| 工具 | 默认扫描位置 |
| --- | --- |
| Codex CLI | `~/.codex/sessions`、`~/.codex/archived_sessions`、`~/.codex/projects` |
| Claude Code | `~/.claude/projects`、`~/.claude/history.jsonl` |
| Cursor | 用户 `globalStorage` 和 logs |
| Trae / Trae CN | 用户 `globalStorage`、logs、AI agent 数据目录、`.trae*` 目录 |

也可以用 `TOKEN_BOARD_USAGE_PATHS` 补充自定义 JSON / JSONL / CSV 路径，或用 `TOKEN_BOARD_INCLUDE_DEFAULT_SOURCES=false` 关掉默认扫描源。

采集逻辑不是“看到数字就加总”。它会先找可能含 token 的文件，再根据文件类型解析：

| 文件类型 | 处理方式 |
| --- | --- |
| `.json` | 递归遍历 JSON，寻找 token 字段组合 |
| `.jsonl` / `.log` | 按行 parse JSON，再递归抽取 |
| `.csv` | 读表头，识别 `inputTokens`、`outputTokens` 等字段 |
| `.vscdb` / `state.vscdb` | 用 `sqlite3 -readonly -json` 查询可能包含 usage 的 KV |
| Codex `.jsonl` | 单独解析 `token_count` 事件，并处理累计值差分 |

Codex 的情况最值得单独讲。Codex JSONL 里常见的是 `total_token_usage`，它表示到当前为止这条会话累计用了多少 token。如果每一行都直接拿累计值记一条事件，排行榜会爆炸式重复计数。

所以 agent 会保留上一条累计值，把当前累计值减去上一条累计值，得到这次增量。

下面是按发布版 agent 改写的裁剪片段：

```js
function readCodexUsage(row, previousTotalUsage) { // 读取一行 Codex JSONL 里的 token 用量
  const payload = row.payload || {}; // 取出事件载荷，缺失时给空对象兜底
  if (row.type !== "event_msg") return null; // 非事件消息不产生用量记录
  if (payload.type !== "token_count") return null; // 只有 token_count 才代表一次用量更新
  const info = payload.info || {}; // token 详情放在 payload.info 里
  const total = info.total_token_usage; // Codex 常见字段是会话累计用量
  const usage = total ? diffUsage(total, previousTotalUsage) : info.last_token_usage; // 有累计值就转成增量，没有累计值才读单次值
  if (!usage) return null; // 没有可用 token 字段就跳过
  return usage; // 返回后续可归一化的单次 token 用量
} // Codex 单行用量读取结束
```

这个设计带来两个结果：

- 榜单按“每次新增消耗”计数，而不是按“会话累计快照”计数。
- agent 可以重复扫描最近 30 天文件，因为最终会用稳定事件 `id` 去重。

## 3. 隐私边界：客户端少传，服务端再洗一遍

这个项目适合公开排名，但不适合公开 prompt。它的隐私边界主要靠两层实现。

第一层在 agent。本机采集时会跳过 `content`、`prompt`、`text`、`body`、`transcript` 这类明显可能包含正文的字段，只抽 token 计数、模型、工具、时间、项目 basename 和 session 信息。对于 Codex，会话短标题可能来自 `session_index.jsonl` 或用户首条消息的短摘要，但会被截断。

第二层在 API。即使 agent 传了某些字段，`/api/usage/ingest` 也不会原样信任。后端会用当前认证身份覆盖 `userId`、`displayName`、`team`，再调用 `sanitizeIngestEvents` 重新生成稳定 `id`。

{% asset_img figure-03.svg %}

服务端可配置的隐私开关包括：

| 配置 | 行为 |
| --- | --- |
| `TOKEN_BOARD_PROJECT_MODE=basename` | 默认只保留项目 basename |
| `TOKEN_BOARD_PROJECT_MODE=hash` | 把项目名变成 `project:<hash>` |
| `TOKEN_BOARD_PROJECT_MODE=none` | 不保存项目名 |
| `TOKEN_BOARD_INCLUDE_MODEL=false` | 模型名统一写成 `hidden` |
| `TOKEN_BOARD_INCLUDE_SOURCE=false` | 来源统一写成 `local-agent` |
| `TOKEN_BOARD_HASH_SESSION_ID=false` | 允许不 hash session id，默认是 hash |

裁剪后的清洗逻辑大概是这样：

```ts
function sanitizeUploadedEvent(event, identity, options) { // 清洗一条上传事件
  const normalized = normalizeTokenUsageEvent(event); // 先把各种字段名归一成 TokenUsageEvent
  const project = sanitizeProjectName(normalized.project, options.projectMode); // 根据配置保留、隐藏或 hash 项目名
  const sessionId = hashSessionId(normalized.sessionId); // 默认只保存 session id 的短 hash
  const model = options.includeModel === false ? "hidden" : normalized.model; // 服务端可以统一隐藏模型名
  const source = options.includeSource === false ? "local-agent" : normalized.source; // 服务端可以统一隐藏真实来源
  return normalizeTokenUsageEvent({ ...normalized, userId: identity.userId, project, sessionId, model, source }); // 用认证身份覆盖用户字段后返回
} // 上传事件清洗结束
```

这一步的重点不是“绝对安全”，而是建立一个清楚的产品边界：公开的是统计，不是对话内容。排行榜可以讨论“谁最近在高强度使用 agent”，但不应该让朋友看到你的完整 prompt、绝对路径或原始 transcript。

## 4. 鉴权：网页登录和 agent 登录是两种 token

项目里有三类签名 token：

| token purpose | 用途 |
| --- | --- |
| `web` | 浏览器登录后放在 cookie 里，用于 `/api/auth/me` 和 `/api/usage/me` |
| `agent` | Device Flow 登录后给本机 agent，用于 `/api/usage/ingest` 和 `/api/usage/replace` |
| `oauth-state` | GitHub OAuth 回调时防 CSRF 和携带 returnTo |

签名方式很朴素：把 payload 做 base64url，再用 `HMAC-SHA256` 签名，格式是：

```text
base64url(payload).base64url(hmac) # token 由载荷和 HMAC 签名两段组成
```

网页端走常规 GitHub OAuth：`/api/auth/github/start` 跳到 GitHub 授权页，callback 里换 access token，再取 GitHub profile，最后设置 `token_board_session` cookie。

agent 端走 GitHub Device Flow：命令行先请求 `/api/auth/device/start`，展示 `verificationUri` 和 `userCode`；用户在浏览器授权后，agent 轮询 `/api/auth/device/poll`。授权成功时，后端签一个长期 `agent` token 返回给本机。

这个区分很重要：

- 浏览器 cookie 适合网页查看个人视图。
- agent bearer token 适合后台任务静默上传。
- 两者都从 GitHub 身份派生，但权限用途不同。

后端还保留了旧的 `uploadToken` 机制。如果请求里的 bearer token 不是 agent token，就会去 `TOKEN_BOARD_USERS_JSON`、`TOKEN_BOARD_UPLOAD_TOKEN` 或 users 文件里找旧 token。这个兼容层让早期部署不用一次性迁移。

## 5. 存储：PostgreSQL 是正式路径，JSON 文件是轻量兜底

存储层有统一接口：

| 方法 | 作用 |
| --- | --- |
| `listEvents()` | 读取可用于聚合的事件 |
| `countEvents()` | 统计总记录数 |
| `insertEvents(events)` | 插入事件并返回 accepted / duplicates |
| `deleteEventsForUser(userId)` | 清掉某个用户的记录，用于 replace |
| `getUserConfig(userId)` | 读取 agent 上报的用户配置摘要 |
| `upsertUserConfig(userId, config)` | 更新用户配置摘要 |

如果设置了 `TOKEN_BOARD_DATABASE_URL`，API 启动时会创建 PostgreSQL store；否则回退到 `.token-board/usage-events.json`。

PostgreSQL 表的主键是 `id`。插入时走 `ON CONFLICT (id)`，所以 agent 反复 `resync` 不会制造重复记录。比较细的是：如果冲突事件这次带了新的 `session_title`，数据库会补上标题，但不会把整条历史记录覆盖掉。

裁剪后的插入逻辑像这样：

```sql
INSERT INTO usage_events (id, user_id, reported_at, input_tokens, output_tokens) -- 以事件 id 作为幂等主键写入
VALUES ($1, $2, $3, $4, $5) -- 每条上传事件对应一行标准记录
ON CONFLICT (id) DO UPDATE -- 重复上传时不新增第二条记录
SET session_title = COALESCE(EXCLUDED.session_title, usage_events.session_title); -- 只补充更完整的会话标题
```

JSON 文件 store 的策略也类似：读出已有事件，按 `id` 合并，排序后截到 `maxEvents`。文件写入会先写临时文件，再 rename 到正式文件，降低半写入状态的风险。

这里还有一个 `replace` 入口。`token-board-agent replace` 会调用 `/api/usage/replace`：后端先删除当前认证用户的旧记录，再插入这次本机能采集到的记录。这个命令适合后端迁移或历史数据脏掉时用，但它只影响当前用户，不会清空全库。

## 6. 排行榜：查询时按时间窗口重新聚合

排行榜核心在 `buildTokenLeaderboard`。

它做的不是数据库里的 `ORDER BY sum(tokens)`，而是先拿到事件列表，再在 core 里按窗口聚合。流程是：

1. 根据 `range` 计算当前窗口 `[start, end]`。
2. 再计算前一段等长窗口，用来算 `deltaTokens`。
3. 对事件做 normalize + dedupe。
4. 过滤当前窗口事件。
5. 按用户聚合 token、费用、会话数、消息数、活跃天数、top model、top tool。
6. 按选择的 metric 排名：`tokens`、`cost`、`sessions` 或 `messages`。
7. 生成全局 daily、models、tools 分布。

{% asset_img figure-04.svg %}

下面是按源码改写后的最小结构：

```ts
function buildLeaderboard(entries, range, metric, now) { // 构建某个时间窗口的排行榜
  const end = validDate(now); // 以当前时间作为滚动窗口结束点
  const start = subtractRange(end, range); // 根据 1D/7D/30D/90D 算开始时间
  const previousStart = subtractRange(start, range); // 再往前取一个等长窗口用于环比
  const normalized = dedupe(entries.map(normalize)); // 先归一化并按事件 id 去重
  const current = filterBetween(normalized, start, end); // 只保留当前窗口事件
  const previous = filterBetween(normalized, previousStart, start); // 只保留前一窗口事件
  const users = rankUsers(aggregateUsers(current, previous), metric); // 聚合用户后按指标排序
  return { range, startAt: start, endAt: end, users }; // 返回前端可直接渲染的 summary
} // 排行榜构建结束
```

费用估算也在这一层。`MODEL_PRICING` 按模型名正则匹配单价，区分 input、cached input 和 output。因为这是公开价格估算，所以前端也明确提示“费用为公开模型单价估算，不代表实际账单”。

个人视图复用了同一套聚合逻辑。`buildTokenAccountUsageProfile` 会先构建全局排行榜，找出当前用户 rank；再只过滤当前用户事件，计算项目分布、session 明细、活跃小时热力图和上一窗口排名变化。

## 7. 前端：只读真实 API，不用假榜单糊住问题

前端榜单入口是 `apps/web/app/board/page.tsx`，它把默认 API 地址传给 `TokenLeaderboardApp`：

```tsx
<TokenLeaderboardApp apiBaseUrl={process.env.NEXT_PUBLIC_TOKEN_BOARD_API_URL || DEFAULT_API_URL} initialNow={INITIAL_NOW} /> // 页面把 API 地址和初始时间传给客户端榜单组件
```

客户端组件主要读三个接口：

| 接口 | 前端用途 |
| --- | --- |
| `/api/usage/stats?range=...&metric=...` | 榜单总览、用户排名、模型/工具分布 |
| `/api/auth/me` | 判断当前浏览器是否已 GitHub 登录 |
| `/api/usage/me?range=...` | 登录后读取自己的个人分析面板 |

一个很好的取舍是：页面不再展示 demo 榜单。代码里会构建一个空 summary 让组件结构不崩，但只要真实 API 未配置或请求失败，UI 就进入 error state，并显示“不会回退到静态或本地数据”。

这让排行榜更可信。朋友打开页面时看到的要么是真实后端数据，要么是明确的加载失败，而不是一份看起来很热闹的示例排名。

页面上的控制也都直接映射到 core：

| 控件 | 对应 core 参数 |
| --- | --- |
| `1D / 7D / 30D / 90D` | `TokenBoardRange` |
| `总消耗 / 费用 / 会话 / 消息` | `TokenBoardMetric` |
| 个人面板 | `buildTokenAccountUsageProfile` |
| 缓存命中率 | `cachedInputTokens / inputTokens` |
| 消耗 / 会话 | `inputTokens + outputTokens` 除以 session 数 |

## 8. 发布链路：站点和 agent 共用一个 Pages 出口

项目的发布也挺简洁：

1. `scripts/pack-agent.mjs` 进入 `tools/token-board-agent-npx` 执行 `npm pack`。
2. 打包产物被重命名为 `apps/web/public/token-board-agent.tgz`。
3. `pnpm build` 再构建 Next.js 静态站点。
4. GitHub Pages 同时发布网页和 agent tarball。

{% asset_img figure-05.svg %}

这就是为什么 README 里可以给出这种安装命令：

```bash
npx --yes --package https://ffffhx.github.io/open-token-board/token-board-agent.tgz?v=0.4.11 -- token-board-agent install # 从 Pages 下载 agent tarball 并执行安装
```

它绕开了“朋友要先 clone 仓库”的门槛。朋友只需要执行一条命令，后续采集和上传都由本机后台任务负责。

后端部署走 `deploy/token-board/compose.yaml`。Compose 里有两个服务：

| 服务 | 作用 |
| --- | --- |
| `postgres` | PostgreSQL 17，持久化 token 事件 |
| `token-board` | API 服务，读取 `.env`，连接 PostgreSQL |

API 容器通过 `TOKEN_BOARD_DATABASE_URL` 连到 Postgres；如果不配数据库，开发环境仍然可以用 JSON 文件跑起来。

## 9. 这套实现最值得学的几个点

第一，排行榜的最小单位不是“用户总量”，而是“事件”。只要事件 `id` 稳定，采集端可以反复扫、本地可以 resync、服务端可以去重，后面的排名才稳。

第二，隐私边界要放在两边。agent 少传是一层，服务端按认证身份重写和清洗又是一层。只做前者会太依赖客户端版本，只做后者又会让不该离开本机的字段先离开本机。

第三，采集和聚合不要混在一起。采集端面对的是各种工具奇形怪状的日志；聚合端只面对 `TokenUsageEvent`。这个边界让前端和 API 不需要随着每个工具的日志变化一起抖。

第四，真实数据产品不要用漂亮假数据兜底。Open Token Board 的前端宁愿显示“API 未配置”，也不展示 demo 排行榜。这对一个朋友间可对比的榜单很重要。

第五，轻量发布路径会改变使用门槛。`npx agent + GitHub Device Flow + 后台任务` 这条链路，把“让朋友持续上报”从仓库协作问题变成了一条命令的问题。

当然，这版也还有一些工程上的边界：

- 目前验证层主要是 `typecheck` 和 agent help，没有看到完整单元测试覆盖解析器。
- Cursor、Trae 这类本地存储格式可能变化，解析器需要持续跟进。
- 费用估算依赖内置模型单价表，和真实账单天然会有差异。
- 文档里部分环境变量示例和源码枚举可能会漂移，部署时最好以源码里的 `parseProjectMode` 这类函数为准。

但整体看下来，这个项目的骨架是清楚的：**本机 agent 把噪声日志归一成事件，后端把事件变成可信数据，前端把可信数据变成可讨论的排行榜。**

这也是 Open Token Board 最有意思的地方。它不是一个复杂的大系统，但把“采集、隐私、鉴权、幂等、聚合、发布”这几个小系统都接上了。对于一个朋友局工具来说，这个尺度刚刚好。
