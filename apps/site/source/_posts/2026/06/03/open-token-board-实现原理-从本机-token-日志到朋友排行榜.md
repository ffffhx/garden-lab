---
title: "Open Token Board 项目复盘：从本机 Token 日志到可信用量平台"
date: "2026-06-03 21:20:00"
categories:
  - 技术
tags:
  - Open Token Board
  - Agent
  - TypeScript
  - Next.js
  - PostgreSQL
  - GitHub OAuth
  - 数据工程
  - 工程实践
excerpt: "一份面向技术面试的源码解析与项目复盘：Open Token Board 如何把 Codex、Claude Code、Gemini CLI、opencode 等本机日志归一成可信事件，用幂等上报、安全全量替换、PostgreSQL 聚合、隐私清洗和回归测试，做成可自托管的 AI 编码用量平台；过程中有哪些口径陷阱、失败方案与工程取舍。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

> 本文最初写于 2026 年 6 月 3 日，当时项目还是一张基础朋友榜。项目随后持续演进，本文已按 2026 年 7 月 11 日的 `f6f6638` 源码与 Git 历史重写。代码片段为讲解裁剪版，目标不是背 API，而是理解每个设计解决了什么问题、失败时怎样保护数据，以及面试中怎样建立证据链。

## 1. 项目定位与面试开场

如果面试官只给我 30 秒，我会这样介绍 Open Token Board：

> Open Token Board 是一个可自托管的 AI 编码用量平台。它在用户本机通过轻量 agent 读取 Codex、Claude Code、Gemini CLI 和 opencode 等工具的用量日志，归一、脱敏后可靠上报；服务端用 GitHub 身份绑定数据，以事件主键保证幂等，用 PostgreSQL 完成窗口聚合；前端再提供朋友榜、个人画像、额度墙、Wrapped 和飞书战报。最难的不是画排行榜，而是让多种不断变化的日志在同一时间口径下可对账，并保证重试、断网、重复文件和全量重同步都不会把历史数据算重或清空。

项目边界可以概括为四点：

- **采集边界**：只读取 AI 编码工具已经落盘的本地记录，不修改源文件；
- **隐私边界**：默认上传 token 计数与有限元数据，不上传 prompt、回复正文、文件内容、完整路径和密钥；
- **一致性边界**：普通同步允许重试且保持幂等，全量替换必须完整扫描、分批暂存、校验清单后才提交；
- **部署边界**：静态 Web、npm agent、API 服务与 PostgreSQL 分开部署，仓库仍保持一套共享领域模型。

面试时最值得讲的不是功能数量，而是下面四类工程问题：

1. 多个工具的日志格式、累计/增量语义和缓存字段都不同，怎样归一成一套可信事件；
2. agent 每五分钟运行一次，网络也会重试，怎样避免同一用量被重复计算；
3. 用户要求“用本机历史整体覆盖线上”时，怎样避免先删旧数据、后上传失败；
4. 数据量增长后，怎样把全表拉回 Node 聚合改成 PostgreSQL 内完成，同时保留轻量 JSON 兜底。

<style>
.otb-map{--p:var(--paper-soft,#faf6ec);--d:var(--paper-deep,#ece5d5);--i:var(--ink,#1a1815);--m:var(--muted,#6a6155);--l:color-mix(in srgb,var(--i) 22%,transparent);--v:#6650a8;--g:#4f7233;--a:#a86718;--r:#9a3b2d;--b:#315f9a;margin:1.5rem 0;padding:clamp(14px,2.8vw,24px);border:1.5px solid var(--l);border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--p) 94%,var(--v) 6%),var(--p));color:var(--i);overflow:hidden}.otb-map *{box-sizing:border-box}.otb-map .k{margin:0 0 5px;font:700 11px/1.2 var(--font-mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--v)}.otb-map .t{margin:0 0 16px;font:700 clamp(17px,2.4vw,22px)/1.25 var(--font-display,system-ui,sans-serif)}.otb-map .track{display:flex;align-items:stretch;gap:8px;min-width:0}.otb-map .n{flex:1 1 0;min-width:0;padding:12px;border:1px solid var(--l);border-radius:11px;background:color-mix(in srgb,var(--p) 88%,white 12%)}.otb-map .n b{display:block;font-size:13px;line-height:1.35}.otb-map .n small{display:block;margin-top:5px;font-size:11.5px;line-height:1.45;color:var(--m)}.otb-map .n[data-c="g"]{border-color:color-mix(in srgb,var(--g) 55%,transparent)}.otb-map .n[data-c="a"]{border-color:color-mix(in srgb,var(--a) 55%,transparent)}.otb-map .n[data-c="r"]{border-color:color-mix(in srgb,var(--r) 55%,transparent)}.otb-map .n[data-c="b"]{border-color:color-mix(in srgb,var(--b) 55%,transparent)}.otb-map .ar{flex:0 0 auto;align-self:center;color:var(--v);font-weight:800}.otb-map .note{margin:14px 0 0;padding-top:12px;border-top:1px dashed var(--l);font-size:12px;line-height:1.55;color:var(--m)}.otb-map code{font-family:var(--font-mono,ui-monospace,monospace)}@media(max-width:720px){.otb-map .track{display:grid;grid-template-columns:1fr}.otb-map .ar{transform:rotate(90deg);justify-self:center;margin:-5px 0}}
</style>

<figure class="otb-map" role="group" aria-label="Open Token Board 从本机日志到产品页面的五段数据链路">
  <p class="k">End-to-end pipeline</p>
  <p class="t">从不稳定的本机日志，到可查询、可解释的用量事实</p>
  <div class="track">
    <div class="n"><b>本机日志</b><small>Codex · Claude Code<br>Gemini · opencode</small></div>
    <span class="ar">→</span>
    <div class="n" data-c="g"><b>token-board-agent</b><small>发现 · 解析 · 去重<br>脱敏 · checkpoint</small></div>
    <span class="ar">→</span>
    <div class="n" data-c="a"><b>API 边界</b><small>GitHub 身份 · 校验<br>二次清洗 · 幂等写</small></div>
    <span class="ar">→</span>
    <div class="n" data-c="b"><b>PostgreSQL</b><small>事件表 · 用户配置<br>时间窗口 · SQL 聚合</small></div>
    <span class="ar">→</span>
    <div class="n" data-c="r"><b>产品层</b><small>榜单 · 额度 · 主页<br>Wrapped · 飞书战报</small></div>
  </div>
  <p class="note">核心设计：让日志格式变化停在采集层，让身份与隐私收敛在 API，让统计口径集中在 core / storage，而不是散落到每个页面。</p>
</figure>

## 2. 项目之前是什么，现在是什么

第一版更接近“把自己的静态统计放到网页上”；当前版本已经是一套跨本机与服务端的用量基础设施。

| 维度 | 早期版本 | 当前版本 |
| --- | --- | --- |
| 用户 | 单人展示 | GitHub 身份绑定的朋友/团队 |
| 采集 | 少量手写解析 | `agent-session-core` + Gemini/opencode 专用解析 + Cursor best-effort |
| 同步 | 上传新事件 | checkpoint、重试、健康检查、`resync`、事务化 `replace` |
| 存储 | JSON / Node 内存聚合 | PostgreSQL 正式路径 + JSON 轻量兜底 |
| 口径 | 总 token 排名 | 输入、缓存写、缓存读、输出四分类计价与明确窗口 |
| 页面 | 单张榜单 | 榜单、个人主页、额度墙、Wrapped、分享卡、导出 |
| 自动化 | 手动刷新 | LaunchAgent / Task Scheduler、飞书日报周报、CI/CD |
| 质量 | 手工验证 | typecheck、API 回归、Playwright E2E、独立工具对账 |

项目演进不是“功能列表越堆越多”，而是每一阶段都在修正上一阶段暴露的事实边界：

1. **MVP：先证明分享需求**。把本机用量做成朋友能看的榜单；
2. **独立服务：拆出 Web / API / core / agent**。让本机采集、服务端存储和静态页面不再互相绑死；
3. **可靠性：修正解析、鉴权与隐私**。处理累计值、重复文件、会话标题、上传权限和敏感字段；
4. **规模化：下推 PostgreSQL 聚合并加入快照缓存**。解决榜单超时与重复计算；
5. **产品化：额度、荣誉、个人主页、Wrapped、飞书战报、多工具与导出**；
6. **可信度：引入原子替换、反作弊校验、回归套件和跨工具对账**。

这里有一个适合面试讲的判断：**先验证有没有人愿意看，再投入时间证明数字为什么可信。** 对数据产品来说，后半句最终比 UI 更重要。

## 3. 当前架构：五条职责链

仓库是一个 `pnpm workspace`，主要边界如下：

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| Web | `apps/web` | Next.js 静态导出、榜单与个人页面、额度墙、分享体验 |
| API | `apps/token-board-api` | HTTP 路由、GitHub 登录、上传/查询、飞书任务 |
| Core | `packages/token-board-core` | 事件模型、采集适配、隐私清洗、聚合、计价、存储接口 |
| Agent | `tools/token-board-agent-npx` | npm 分发、后台安装、登录、采集、同步、MCP/statusline |
| Deploy | `deploy/token-board` | API + PostgreSQL 的 Docker Compose 部署 |

五条职责链分别是：

- **采集链**：本机文件 → source discovery → parser → `TokenUsageEvent`；
- **同步链**：本地 checkpoint → batch upload → retry → 服务端幂等写入；
- **身份链**：GitHub Device Flow / Web OAuth → agent token / session cookie → 用户身份覆盖；
- **查询链**：range + metric → PostgreSQL 聚合或 JSON fallback → API response；
- **产品链**：真实 API → 榜单、个人画像、额度、目标、荣誉、Wrapped 与飞书卡片。

这种拆法的价值在于：前端完全不需要理解 Codex JSONL 或 opencode SQLite，采集器也不需要知道排行榜卡片长什么样。两端只通过统一事件和 API 合同协作。

## 4. 统一事件：先把统计语言定义清楚

项目最核心的领域对象不是“用户”，而是 `TokenUsageEvent`：

```ts
type TokenUsageEvent = {
  id: string;
  upstreamEventId?: string;
  userId: string;
  source: string;
  model: string;
  project?: string;
  timestamp: string;
  inputTokens: number;
  cacheCreationInputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  sessionId?: string;
  sessionTitle?: string;
};
```

`id` 是服务端主键；`upstreamEventId` 是采集器原生、尽量不受可变元数据影响的稳定键。两者分开后，项目可以在同一个用量事件上补齐标题等元数据，而不把它误算成新消费。

### 4.1 “总消耗”为什么不是盲信 `totalTokens`

当前榜单统一使用：

```ts
consumption = inputTokens + outputTokens
```

并且缺少这两个字段时直接报错，不用来源里的 `totalTokens` 静默兜底。原因是各工具对 `total` 的定义可能不同：有的已包含缓存，有的是累计值，有的会把推理字段重复算进来。宁可暴露缺字段，也不要产出一个看起来合理、实际不可解释的数字。

### 4.2 四分类计价与排行榜 token 是两件事

`inputTokens` 表示完整输入上下文，其中包含缓存读和缓存写；所以排行榜总量不额外相加缓存字段。费用计算则拆成四类：

```ts
billableInput = inputTokens - cacheRead - cacheCreation

cost = billableInput * inputPrice
     + cacheRead * cacheReadPrice
     + cacheCreation * cacheCreationPrice
     + outputTokens * outputPrice
```

这个边界非常适合面试追问：**同一份数据为了“工作量对比”和“费用估算”，需要两套不同但不矛盾的投影。**

## 5. 难点一：多源日志怎样归一，而不重复计算

### 5.1 先统一发现，再保留来源专用解析

Codex 与 Claude Code 通过 `agent-session-core` 发现和解析会话；Gemini CLI、opencode 和 Cursor 的本地形态不同，仍保留对应解析器。这里没有强行把所有来源塞进一个万能 JSON walker，而是把共性放在统一事件，把差异留在 source adapter。

采集流程大致是：

```text
discover roots
  → 按时间范围发现候选文件
  → 按 dev + inode 去重物理文件
  → 解析逻辑 session
  → 映射统一 token 字段
  → hash session id / 清理标题 / project basename
  → 生成稳定事件键
```

### 5.2 为什么要按 inode 去重

同一份 Codex 会话可能同时出现在 `~/.codex/sessions`、归档目录、项目索引或其他 runtime home 中；某些路径还是硬链接镜像。只按字符串路径去重，会把同一个物理文件解析多次。

因此 agent 用 `(dev, inode)` 识别物理文件，先出现的根目录赢，既避免重复，也保持事件 id 在多次运行间稳定。

### 5.3 累计值必须先转增量

本地日志不保证每条记录都是“本次调用花了多少”。如果来源记录的是会话累计值：

```text
第 1 条：1000
第 2 条：1800
第 3 条：2400
```

直接求和会得到 `5200`，真实增量却是 `1000 + 800 + 600 = 2400`。解析层必须识别累计快照，用相邻差值构造事件；遇到重启、回退和字段缺失时还要定义清楚边界，而不是简单相减。

### 5.4 活跃日志为什么天然会漂移

正在运行的会话文件还会继续追加。两个工具即使读取同一路径，只要扫描时刻不同，就可能得到不同结果。因此项目的对账工具明确要求：

- 选择已经结束的 Asia/Shanghai 自然日；
- 对 token-board、ccusage、Tokscale 使用同一个闭区间；
- 差值只证明“定义、扫描根或快照时刻不同”，不能直接证明谁错。

这个原则比“我的数字一定对”更专业：**先统一窗口，再定位差异属于发现、解析、归一还是展示。**

## 6. 难点二：隐私、身份和幂等必须在不同层防守

### 6.1 客户端少传，服务端再洗一遍

agent 默认只保留项目 basename、短标题和 hash 后的 session id。API 收到事件后仍会：

- 用已认证身份覆盖 `userId` / `displayName`，不信任客户端自报；
- 再次截断字符串、校验数字和时间范围；
- 根据 `projectMode` 选择 basename、hash 或完全隐藏；
- 按配置隐藏 model、source、session title；
- 拒绝负数、token 加总不自洽和异常质量计数。

为什么两边都做？客户端清洗减少敏感数据离开机器的概率；服务端清洗保护共享数据库不被旧版或恶意客户端污染。两层目标不同，不能互相替代。

### 6.2 Web OAuth 与 Device Flow 为什么分开

浏览器登录需要 session cookie 和返回页；后台 agent 没有稳定浏览器回调地址，更适合 GitHub Device Flow：

1. agent 请求 device code；
2. 用户在 GitHub 页面输入短码；
3. agent 轮询授权结果；
4. API 根据 GitHub 用户生成长期 agent session token；
5. 后续上传使用 Bearer token。

这两条链最终汇入同一个 `TokenBoardIdentity`，但 token 的载体、有效期和使用场景不同。把它们硬合成一种登录方式，反而会让安全边界变模糊。

### 6.3 幂等不等于“客户端记住上传过”

客户端 checkpoint 只是一层优化：避免每次都上传全部事件。真正的一致性底座在服务端：PostgreSQL 的 `usage_events.id` 是主键，写入使用 `ON CONFLICT`；重复事件不会增加统计量，但允许补齐 session title、质量计数等元数据。

因此网络超时后的安全策略是“可以重试”，不是“猜上一请求到底成功没有”。

<figure class="otb-map" role="group" aria-label="Open Token Board 普通同步的三层去重结构">
  <p class="k">Idempotent sync</p>
  <p class="t">checkpoint 提速，稳定事件键识别，数据库主键兜底</p>
  <div class="track">
    <div class="n"><b>本地 checkpoint</b><small>active window 内已上传 id<br>减少无效网络请求</small></div>
    <span class="ar">→</span>
    <div class="n" data-c="g"><b>稳定事件键</b><small>同一上游消费<br>跨扫描保持身份</small></div>
    <span class="ar">→</span>
    <div class="n" data-c="b"><b>PRIMARY KEY</b><small><code>ON CONFLICT</code><br>重试不增加统计量</small></div>
  </div>
  <p class="note">只做第一层会在状态文件丢失时重复；只做第三层虽然正确，但每轮都全量上传会浪费扫描、网络和数据库资源。</p>
</figure>

## 7. 难点三：全量替换为什么要做成分阶段事务

普通 `resync` 只是忽略本地 checkpoint，重新上传扫描窗口内的事件；它不会删除服务端历史。真正的“以本机为准整体覆盖”是 `replace`。

最危险的直觉方案是：

```text
DELETE user history
→ collect local files
→ upload all events
```

只要解析中途失败、网络断开或进程退出，用户就会留下空历史或半份历史。

当前协议分四相：

1. **start**：客户端上报 `expectedEvents`、完整性标志和事件清单 digest；
2. **append**：按批上传，服务端清洗后暂存在 `replaceId + userId` 对应的 stage；
3. **commit**：校验事件数与 digest；
4. **abort / expire**：主动放弃或 30 分钟超时清理，旧历史不受影响。

客户端在发起 start 之前还会拒绝两种情况：

- 采集结果为空；
- 任一必要会话文件解析失败，扫描不完整。

最终提交时，PostgreSQL 在同一事务里执行按用户删除和批量插入：

```ts
await client.query("BEGIN");
await client.query("DELETE FROM usage_events WHERE user_id = $1", [userId]);
await insertPostgresEvents(client, replacement);
await client.query("COMMIT");
```

异常时 `ROLLBACK`。JSON fallback 则使用临时文件、`fsync`、原子 rename 和每日备份。

这里最值得讲的工程判断是：**网络上传的 staging 与数据库提交的 transaction 是两层不同的原子性。** 前者保证“完整数据到齐前不动旧历史”，后者保证“正式切换要么全部成功，要么全部失败”。

## 8. 难点四：时间窗口与数据库聚合

### 8.1 自然日和滚动窗口不能混着说

项目同时支持两类窗口：

- `1D / 7D / 30D / 90D`：以当前时刻为终点向前滚动；
- `today / week / month / lastweek / lastmonth`：按 Asia/Shanghai 自然边界切分；
- `from / to`：显式日历区间。

“今天”和“过去 24 小时”在凌晨附近差别很大。如果 UI、API、飞书日报和对账脚本各自解释时间，榜单就会出现无法说明的差异。因此窗口创建、趋势桶和对比周期都集中在 core，并把 `startAt / endAt` 返回给前端显示。

### 8.2 为什么 Node 全量聚合会拖垮榜单

早期查询路径会读取全部事件，再在 Node 中过滤、分组和排序。数据量小时简单直接；事件增长后，每个请求都承担：

- 从数据库传输大量无关行；
- 在 Node 创建对象、Set 和 Map；
- 多个 range/metric 请求重复做相同工作；
- API 进程内存与延迟随历史总量增长。

后来把常用窗口的统计下推到 PostgreSQL：用 `WHERE reported_at >= ...` 限定范围，按用户 `GROUP BY`，用 SQL `SUM` 聚合 token、费用、会话等指标，再利用 `reported_at`、`user_id + reported_at`、model、tool 索引。

API 仍保留 JSON store 和特殊窗口的通用路径；快照缓存则减少热门 range/metric 的重复查询。这个演进体现了很好的取舍：**先保留简单实现验证语义，再在真实瓶颈出现时把计算移动到离数据更近的位置。**

## 9. 从数据管道到产品：哪些功能共享同一事实底座

项目后来长出很多页面，但它们没有各算各的：

- **公共榜单**：按 token、费用、会话、消息、活跃人数、代码行等维度排序；
- **个人主页**：365 天贡献图、模型/工具/项目分布、个人 PB 与荣誉；
- **Wrapped**：按月或年聚合成五屏叙事；
- **额度墙**：展示 Codex 和 Claude Code 的窗口、剩余比例、burn rate 与重置时间；
- **飞书日报周报**：从同一窗口快照计算冠军、排名变化、PB、等级和目标；
- **导出与 MCP**：把同一真实数据以 CSV、JSON 或工具调用形式提供出去。

额度数据需要单独说明：它不是根据 token 总量凭空反推。Codex 会在本地日志写 rate limit 快照；Claude Code 的精确订阅窗口主要来自 statusline JSON，因此安装流程会生成一个 capture shim，把状态离线保存后再由 agent 上传。

这也是面试里应该主动澄清的边界：**用量事件回答“花了多少”，额度快照回答“订阅窗口还剩多少”，两者相关但不是同一事实。**

## 10. 部署与后台运行：一套仓库，三种发布物

项目最终交付的是三类东西：

1. **静态 Web**：Next.js `output: export`，由 GitHub Pages 发布；
2. **npm agent**：`token-board-agent`，发布时带 npm provenance；
3. **API 服务**：Node + PostgreSQL，通过 Docker Compose 运行在独立主机。

agent 的后台任务不是“开着一个终端”：

- macOS 使用 LaunchAgent，在用户登录后按计划运行；
- Windows 使用隐藏 Task Scheduler 任务；
- 每轮先做健康检查，上传有超时、有限重试和退避；
- `status` 会区分任务安装状态、最近同步时间、源文件发现和数据新鲜度。

API 自动部署还保留上一镜像标签，重建后访问健康接口；失败时回滚到 `backup-previous`。这不是完整的蓝绿发布，但已经建立了“发布后必须验证，失败要有恢复路径”的工程闭环。

## 11. 我踩过的坑，以及方案怎样被纠正

### 11.1 把累计 token 当单次增量

**症状**：榜单数字明显偏大。

**根因**：来源日志记录会话累计快照，直接求和重复包含过去消费。

**修正**：在 parser 层转增量，并用固定窗口对账。

### 11.2 只按路径去重文件

**症状**：多个 Codex home 或 runtime 镜像导致重复历史。

**根因**：同一物理文件通过不同路径被发现。

**修正**：按 `(dev, inode)` 去重，逻辑 session 再去重一层。

### 11.3 先删线上、再做全量上传

**症状**：任何中途失败都可能留下空历史。

**修正**：`start → append → commit`，空扫描和不完整扫描禁止提交，数据库正式替换再包事务。

### 11.4 在 Node 中读取全表聚合

**症状**：榜单接口随历史增长超时。

**修正**：常用榜单聚合下推 PostgreSQL，加范围索引与快照缓存。

### 11.5 把“数字不同”直接判成某个工具算错

**症状**：多个统计工具互相对不上，却无法解释。

**根因**：时间窗、扫描根、子代理计入规则或活跃文件快照不同。

**修正**：独立 parity harness 固定 Asia/Shanghai 已结束窗口，只报告 delta，不越过证据下结论。

### 11.6 为了好看用 demo 数据兜底

**症状**：真实 API 故障时，用户仍看到一张漂亮但假的榜单。

**修正**：前端明确显示 loading、empty、stale 和 error；数据产品宁可暴露不可用，也不能伪装正常。

## 12. 测试策略：围绕不变式，而不是页面截图

当前验证分四层：

1. **类型与构建**：workspace typecheck、Web 静态构建、agent 打包、Docker image；
2. **API 回归**：临时目录、随机端口、测试专用 token，覆盖 ingest、range、自然月、额度墙、导出与错误输入；
3. **E2E**：构建静态站点后用本地 static server 服务 `apps/web/out`，Playwright 验证真实 API 联调；
4. **外部对账**：同一自然日窗口对比 ccusage、Tokscale 与可选 Kaboo 导出。

真正要守住的不变式包括：

- 同一事件重复上传不增加总量；
- 客户端不能替别人写数据；
- 缓存读写不会既算进输入又额外叠加到排行榜总量；
- `replace` 未完成或 digest 不一致时旧历史不变；
- Postgres 与 JSON store 在相同事件集上产出相同领域结果；
- “今天”和滚动 1D 使用各自明确的起止时间；
- 静态页面 API 故障时显示真实错误，不回退假榜单。

测试 harness 用临时数据目录和程序化签发的测试身份，不依赖开发者真实 token 日志。这样既保护隐私，也让回归可复现。

## 13. 面试复盘：我会怎样回答

### 13.1 我最满意的工程判断

不是加了最多页面，而是把“可信”拆成了可执行的几层：采集器用稳定事件键，服务端覆盖身份并二次清洗，数据库用主键幂等，全量替换用 staging + transaction，对账工具固定窗口。每层都有明确失败语义。

### 13.2 我踩得最深的坑

数据口径问题最深。一个总数偏大，根因可能在文件发现、累计转增量、缓存分类、时间归属、重复 session 或前端二次相加中的任何一层。后来我不再从 UI 数字反推，而是固定一个已结束窗口，沿“源文件 → 统一事件 → 存储行 → 聚合结果”逐层对账。

### 13.3 如果再做一遍，我会更早做什么

1. 更早把稳定的 `upstreamEventId` 与可变展示元数据分开；
2. 更早建立黄金 fixture，覆盖累计值、缓存四分类、子代理和重复物理文件；
3. 更早让每个 API 返回明确的窗口起止时间和 freshness；
4. 更早设计全量替换协议，而不是把 resync 和 replace 混成一个概念；
5. 更早用查询计划和真实数据量决定哪些聚合下推数据库。

### 13.4 下一步我会怎么做

1. 把 replace stage 从单进程内存迁到可恢复存储，支持 API 重启后继续或安全回收；
2. 为 source adapter 建版本化 fixture 与兼容性矩阵，降低上游日志变更风险；
3. 给 PostgreSQL 聚合增加持续 benchmark 与 `EXPLAIN ANALYZE` 基线；
4. 把数据 freshness、最后完整扫描和解析失败数做成统一可观测指标；
5. 继续把隐私策略从环境变量提升为用户可审阅、可导出的同步清单。

## 14. 一句话收束

Open Token Board 表面是一张朋友间的 AI Token 排行榜，工程主线却是：**把不稳定、私密、口径各异的本机日志，转换成带身份、可幂等、可对账、可恢复的共享数据事实。**

面试中可以用三组证据建立完整闭环：多源日志归一与 inode 去重展示数据工程能力；`start → append → commit` 与数据库事务展示故障设计；PostgreSQL 聚合、快照缓存和固定窗口对账展示性能与可信度治理。

---

## 15. 互动题：你真的理解这个项目了吗？

建议先独立回答，再展开参考答案。选择题要说明排除其他选项的原因，简答题要同时覆盖事实、判断和边界。

### 第一组：定位、架构与口径

#### 题 1｜单选题

**问题：下面哪一项最准确地概括 Open Token Board？**

- A. 只展示本机 Codex 用量的静态页面
- B. 采集、归一、可靠同步并聚合多种 AI 编码工具用量的可自托管平台
- C. 用提示词估算 token 的浏览器插件
- D. 代理转发大模型请求的 API Gateway

<details>
<summary><strong>答案与解析</strong></summary>

**答案：B。** 它包含本机 agent、身份与上传 API、存储/聚合、静态 Web 和后台报告。它读取已落盘日志，不代理模型请求。

</details>

#### 题 2｜单选题

**问题：为什么 Web 不直接解析 Codex / Claude Code 日志？**

- A. 浏览器不会运行 JavaScript
- B. 日志属于本机文件且格式不稳定，应由采集层归一，Web 只消费领域 API
- C. PostgreSQL 不能存 token
- D. Next.js 不能发网络请求

<details>
<summary><strong>答案与解析</strong></summary>

**答案：B。** 这同时保护本地文件边界，也避免把来源格式变化扩散到页面组件。

</details>

#### 题 3｜多选题

**问题：`TokenUsageEvent` 中哪些字段共同服务于幂等与元数据演进？**

- A. `id`
- B. `upstreamEventId`
- C. `sessionTitle`
- D. `coverPosition`

<details>
<summary><strong>答案与解析</strong></summary>

**答案：A、B、C。** `id` 是存储主键，`upstreamEventId` 是尽量稳定的上游键，标题可以在冲突更新中补齐而不新增消费。D 属于博客字段。

</details>

#### 题 4｜单选题

**问题：排行榜的总消耗为什么不再用 `totalTokens` 兜底？**

- A. `totalTokens` 一定是字符串
- B. 各来源定义可能不同，静默兜底会制造不可解释的统计口径
- C. 输出 token 不重要
- D. 数据库不支持加法

<details>
<summary><strong>答案与解析</strong></summary>

**答案：B。** 当前统一用 `inputTokens + outputTokens`；字段缺失直接暴露错误，比产出错误但漂亮的总数更安全。

</details>

#### 题 5｜简答题

**问题：请用 90 秒介绍项目，覆盖用户问题、核心链路、两个难点和结果。**

<details>
<summary><strong>参考答案</strong></summary>

Open Token Board 解决朋友或团队无法统一查看 AI 编码工具用量的问题。本机 agent 读取 Codex、Claude Code、Gemini CLI 和 opencode 日志，先按物理文件与逻辑 session 去重，再归一成统一事件并脱敏；API 用 GitHub 身份覆盖客户端身份，做二次校验后以事件主键幂等写入 PostgreSQL；查询侧按滚动或上海自然日窗口聚合，页面展示榜单、个人画像、额度和 Wrapped。两个核心难点是多源累计/缓存口径归一，以及断网、重试和全量覆盖下的数据一致性。项目最终建立了后台安装、事务化 replace、SQL 聚合、API/E2E 回归和独立工具对账闭环。

</details>

### 第二组：采集、隐私与幂等

#### 题 6｜单选题

**问题：为什么只按文件路径去重不够？**

- A. 路径太短
- B. 同一个物理文件可能通过硬链接或多个扫描根出现
- C. 路径不能包含中文
- D. PostgreSQL 不认识路径

<details>
<summary><strong>答案与解析</strong></summary>

**答案：B。** agent 使用 `(dev, inode)` 去重物理文件，再用逻辑 session 身份去重，避免多 home 镜像重复计数。

</details>

#### 题 7｜计算题

**问题：某来源依次写出累计 token `1000、1800、2400`，三条记录直接求和与正确增量各是多少？**

<details>
<summary><strong>答案与解析</strong></summary>

直接求和是 `5200`；正确增量是 `1000 + (1800-1000) + (2400-1800) = 2400`。这说明解析器必须识别累计快照语义。

</details>

#### 题 8｜多选题

**问题：默认不应上传哪些内容？**

- A. prompt / 回复正文
- B. 完整项目路径
- C. token 计数
- D. 文件内容与密钥

<details>
<summary><strong>答案与解析</strong></summary>

**答案：A、B、D。** token 计数是产品核心数据；项目名默认只保留 basename，也可 hash 或隐藏。

</details>

#### 题 9｜单选题

**问题：为什么 API 必须用认证身份覆盖客户端上传的 `userId`？**

- A. 为了让 JSON 更短
- B. 否则任意客户端都可以伪装成别的用户写榜单数据
- C. GitHub 不允许用户名
- D. 前端只能显示数字 ID

<details>
<summary><strong>答案与解析</strong></summary>

**答案：B。** 身份归属必须由服务端认证事实决定，客户端自报只能作为不可信输入。

</details>

#### 题 10｜多选题

**问题：普通同步的三层去重分别是什么？**

- A. 本地 uploaded-id checkpoint
- B. 稳定事件键
- C. 数据库主键与 `ON CONFLICT`
- D. CSS class 去重

<details>
<summary><strong>答案与解析</strong></summary>

**答案：A、B、C。** 第一层提速，第二层建立跨扫描身份，第三层保证最终一致性。

</details>

### 第三组：全量替换、存储与性能

#### 题 11｜排序题

**问题：请给安全全量替换协议排序。**

- A. commit 校验并正式替换
- B. append 分批暂存事件
- C. start 声明数量、完整性与 digest
- D. 失败时 abort 或等待 stage 过期

<details>
<summary><strong>答案与解析</strong></summary>

**答案：C → B → A；任何未完成路径进入 D。** 旧历史在 commit 前保持不变。

</details>

#### 题 12｜多选题

**问题：客户端在哪些情况下必须拒绝 replace？**

- A. 全量扫描结果为空
- B. 有必要会话文件解析失败
- C. 事件很多，需要分批
- D. 用户配置为空

<details>
<summary><strong>答案与解析</strong></summary>

**答案：A、B。** 分批是正常路径；用户配置不是历史替换完整性的必要条件。

</details>

#### 题 13｜简答题

**问题：为什么已有网络 staging，PostgreSQL commit 仍要事务？**

<details>
<summary><strong>参考答案</strong></summary>

staging 只保证完整候选集已经到达服务端；正式替换仍包含删除旧行和插入新行两个数据库动作。如果没有事务，插入失败会留下空历史。两层分别解决“跨请求完整性”和“数据库切换原子性”。

</details>

#### 题 14｜单选题

**问题：把榜单聚合下推 PostgreSQL 的主要收益是什么？**

- A. 页面颜色更统一
- B. 减少无关行传输和 Node 对象聚合，让数据库利用范围过滤、索引与 GROUP BY
- C. 不再需要任何缓存
- D. JSON fallback 会自动消失

<details>
<summary><strong>答案与解析</strong></summary>

**答案：B。** 快照缓存和 fallback 仍有各自用途；SQL 下推解决的是主要查询热路径。

</details>

#### 题 15｜单选题

**问题：`today` 与 `1D` 的区别是什么？**

- A. 没有区别
- B. `today` 是上海自然日，`1D` 是当前时刻向前滚动 24 小时
- C. `today` 只用于飞书
- D. `1D` 总是从 UTC 零点开始

<details>
<summary><strong>答案与解析</strong></summary>

**答案：B。** 面试时应主动说明时间边界，否则任何趋势与对账都可能产生歧义。

</details>

### 第四组：产品化、测试与系统设计

#### 题 16｜多选题

**问题：用量事件与订阅额度快照的区别有哪些？**

- A. 用量事件表示已经发生的消费
- B. 额度快照表示窗口剩余、重置与 burn rate
- C. Claude Code 精确额度可通过 statusline capture 获得
- D. 两者永远可以互相无损推导

<details>
<summary><strong>答案与解析</strong></summary>

**答案：A、B、C。** D 错误；订阅容量、动态限制和窗口状态不是仅靠 token 历史就能可靠反推的。

</details>

#### 题 17｜多选题

**问题：哪些是不变式测试，而不只是 UI 快照？**

- A. 同一事件重复上传不增加总量
- B. replace digest 不一致时旧历史不变
- C. 客户端不能替其他身份写数据
- D. 所有榜单行必须永远是紫色

<details>
<summary><strong>答案与解析</strong></summary>

**答案：A、B、C。** 这些约束直接决定数据可信度，视觉颜色不属于领域不变式。

</details>

#### 题 18｜系统设计题

**问题：如果数据量增长到十亿事件，你会怎样演进？**

<details>
<summary><strong>参考答案</strong></summary>

先用真实查询与 `EXPLAIN ANALYZE` 识别瓶颈，再考虑：按 `reported_at` 做时间分区；常用日/用户/模型维度做增量物化汇总；原始事件保留有限热数据并归档冷数据；把 ingest 与重聚合解耦到消息队列或作业系统；为事件 schema 和 source adapter 加版本；replace 改为生成新版本数据集后切换 active generation，而不是原表大事务删除；继续保留原始事件到汇总表的可追溯链。不能一开始就堆分布式组件，演进必须由数据量、延迟目标和恢复要求驱动。

</details>

#### 题 19｜故障分析题

**问题：用户说“昨天 token 比 ccusage 高 20%”，你会怎样排查？**

<details>
<summary><strong>参考答案</strong></summary>

先确认双方都使用已经结束的 Asia/Shanghai 同一天，再固定扫描根和版本；比较 Codex/Claude 分来源总量；检查同一物理文件是否多路径发现、子代理是否计入、累计值是否正确转增量、缓存读写是否重复相加、事件 id 是否稳定、数据库是否存在旧来源历史；最后从源文件、统一事件、存储行到 API 聚合逐层缩小差异。20% 差值本身不是某一方错误的证明。

</details>

#### 题 20｜开放题

**问题：这个项目最能证明候选人的哪三种能力？请用代码证据回答。**

<details>
<summary><strong>参考答案</strong></summary>

第一是数据工程与口径治理：多源 adapter、累计转增量、缓存四分类、inode 和逻辑 session 去重；第二是可靠性设计：checkpoint、有限重试、服务端主键幂等、分阶段 replace、PostgreSQL transaction 与 JSON 原子写；第三是完整产品交付：GitHub 身份、npm agent、后台任务、静态 Web、Docker API、飞书报告、CI/API/E2E 和对账工具。回答时应把每种能力绑定到具体失败模式和验证方式，而不是只罗列技术栈。

</details>

### 自测标准

- **基础掌握**：能说清统一事件、总量口径、滚动窗口与自然日的区别；
- **进阶掌握**：能解释 inode 去重、服务端身份覆盖、三层幂等与 SQL 聚合；
- **面试可讲**：能用 90 秒完整介绍，并复盘累计值重复、全量替换和固定窗口对账；
- **系统设计能力**：能讨论十亿事件、可恢复 replace 和 source schema 演进，同时给出不过度设计的阶段边界。

---

项目源码：<https://github.com/ffffhx/open-token-board>
