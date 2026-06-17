// Cover data for garden-lab blog. Rendered by template.html (?i=N) → cover-v1.png
// dir is relative to apps/site/source/_posts
window.COVERS = (function () {
  const NEWS_EN = "AI × FRONTEND DAILY";
  const news = (dir, date, topics, theme, tag) => ({
    slug: date, dir, scene: "feed", cat: "每日新闻", en: NEWS_EN,
    titleSize: 84, title: `AI 与前端<br><span class="hr">每日热点</span>`,
    sub: theme, kw: [], date, topics, tagline: tag,
  });

  const N = [
    news("2026/05/02/2026-05-02-x-上-ai-与前端热点速览", "2026-05-02",
      ["AI 模型", "Agent 权限", "前端供应链"],
      "成本曲线、身份审计与依赖供应链同时收紧，AI 工程开始被治理。",
      "Grok 4.3 成本 · 身份/审计/确认 · npm / PyPI / CI·CD"),
    news("2026/05/04/2026-05-04-x-上-ai-与前端热点速览", "2026-05-04",
      ["搜索入口", "模型评估", "Agent 控制面"],
      "从搜索入口到 Agent 控制面，AI 网关正在成为新的基础设施。",
      "Ask.com 问答 · DeepSeek V4 成本 · Portkey AI Gateway"),
    news("2026/05/05/2026-05-05-x-上-ai-与前端热点速览", "2026-05-05",
      ["模型审查", "Agent 体验", "身份安全"],
      "从模型能力到企业落地，agent 需要可治理的产品和安全边界。",
      "白宫安全测试 · Sierra 客户流程 · Cisco / Astrix"),
    news("2026/05/06/2026-05-06-x-上-ai-与前端热点速览", "2026-05-06",
      ["默认模型", "个人 Agent", "供应链安全"],
      "AI 入口开始替用户执行动作，权限、记忆与审计要同步设计。",
      "GPT-5.5 Instant · Gemini / Instagram · DAEMON Tools"),
    news("2026/05/07/2026-05-07-x-上-ai-与前端热点速览", "2026-05-07",
      ["算力限额", "公开应用", "浏览器模型"],
      "AI 工具变成默认运行时，前端要解释算力、权限与发布成本。",
      "Claude Code · Vibe Coding · Gemini Nano"),
    news("2026/05/09/2026-05-09-x-上-ai-与前端热点速览", "2026-05-09",
      ["算力限额", "实时语音", "芯片成本"],
      "模型、限额、证书与芯片成本，越来越像产品运行时的一部分。",
      "Claude Code · GPT-Realtime-2 · OpenAI / Broadcom"),
    news("2026/05/10/2026-05-10-x-上-ai-与前端热点速览", "2026-05-10",
      ["Agent 安全", "AI 渗透测试", "算力成本"],
      "agent 安全与算力成本，被放进了同一张工程治理表。",
      "Anthropic · Palo Alto Networks · ByteDance"),
    news("2026/05/11/2026-05-11-x-上-ai-与前端热点速览", "2026-05-11",
      ["界面回炉", "验证入口", "agentic 安全"],
      "设计系统、设备证明与 agentic 安全，正在成为默认项。",
      "macOS 27 可读性 · reCAPTCHA 设备证明 · 默认安全"),
    news("2026/05/12/2026-05-12-x-上-ai-与前端热点速览", "2026-05-12",
      ["供应链攻击", "AI 生成零日", "实时交互模型"],
      "AI 安全、前端依赖与实时多模态，被绑在了同一条链路上。",
      "TanStack npm · Google 零日 · Thinking Machines"),
    news("2026/05/13/2026-05-13-x-上-ai-与前端热点速览", "2026-05-13",
      ["AI-native OS", "Shai-Hulud 扩散", "指标治理"],
      "AI 操作系统、供应链安全与产出指标治理同时上场。",
      "Gemini Intelligence · npm / PyPI · tokenmaxxing"),
    news("2026/05/14/2026-05-14-x-上-ai-与前端热点速览", "2026-05-14",
      ["计费边界", "多 agent 安全", "浏览器上下文"],
      "Agent 计费边界与多 agent 安全流水线，推动 AI 工程化。",
      "Agent SDK credit · Microsoft MDASH · Edge Copilot"),
    news("2026/05/15/2026-05-15-x-上-ai-与前端热点速览", "2026-05-15",
      ["Agent 控制面", "Copilot CLI", "npm 供应链"],
      "手机、CLI 与供应链：AI coding 工具进入治理与成本选择。",
      "Codex mobile · Copilot CLI · npm 供应链安全"),
    news("2026/06/12/2026-06-12-x-上-ai-与前端热点速览", "2026-06-12",
      ["护栏可见", "收购 Ona", "基础设施叙事"],
      "agent 需要真实执行记录，长任务走向持久的云端工作区。",
      "Fable 5 护栏 · Codex Ona · Vercel AI Gateway"),
    news("2026/06/13/2026-06-13-x-上-ai-与前端热点速览", "2026-06-13",
      ["事实核验", "token 价格战", "agent harness"],
      "来源、成本与运行时：企业内容要能回链到可核验的证据。",
      "KPMG 幻觉 · MiMo Code · Vercel AI SDK"),
    news("2026/06/14/2026-06-14-x-上-ai-与前端热点速览", "2026-06-14",
      ["模型访问", "成本治理", "系统级 agent"],
      "模型能力，正在变成可用性、成本与合规的工程治理问题。",
      "Fable / Mythos · Kimi K2.7 · HarmonyOS 2000+ agents"),
    news("2026/06/15/2026-06-15-x-上-ai-与前端热点速览", "2026-06-15",
      ["模型供应链", "学习回路", "推理芯片", "年龄门槛", "无障碍"],
      "AI 工程，正在从单点的模型调用，变成系统级的治理问题。",
      "Anthropic · ByteDance · UK under-16 · Rylo"),
    news("2026/06/16/2026-06-16-x-上-ai-与前端热点速览", "2026-06-16",
      ["agent 治理", "身份权限", "开源安全", "算力融资", "工具更新"],
      "Agent 进入生产系统后，权限、审计、成本与修复链路都要产品化。",
      "Anthropic · Salesforce Fin · NewCore · Athena · Codex 0.140"),
    news("2026/06/17/2026-06-17-x-上-ai-与前端热点速览", "2026-06-17",
      ["AI coding", "开发平台", "安全补丁", "算法控制", "移动系统"],
      "AI coding、开发平台和移动/社交入口，都在被 AI 重新定价。",
      "Cursor · GitHub/AWS · SoftBank/OpenAI · Threads · Android 17"),
  ];

  const T = [
    {
      slug: "codex-claude-updates", dir: "2026/05/02/codex-april-2026-updates-from-code-agent-to-workbench",
      scene: "flow", cat: "每日新闻", en: "CODEX × CLAUDE CODE", accent: "violet", glyph: "stack", glyphColor: "acid",
      titleSize: 72, title: `两个 Coding Agent<br>都在变<span class="hr">工作台</span>`,
      sub: "GPT-5.5、Browser Use、Automations、Ultrareview、Claude Security——从代码 Agent 到常驻工作台与开发平台。",
      codex: ["GPT-5.5", "Browser Use", "Automations", "云端工作区"],
      claude: ["Ultrareview", "Claude Security", "Agent View", "开发平台"],
    },
    {
      slug: "codex-cli-feishu", dir: "2026/05/16/codex-cli-接入飞书机器人-把本机-coding-agent-接进群聊",
      scene: "flow", cat: "技术", en: "FEISHU BOT × CODEX", accent: "blue", glyph: "bot", glyphColor: "yellow",
      titleSize: 78, title: `阿里云做入口<br>Mac 跑 <span class="hr latin">Codex</span>`,
      sub: "事件回调、任务队列、非交互执行、按群续聊——把本机 coding agent 接进飞书群聊。",
      kw: ["事件回调", "任务队列", "非交互执行", "按群续聊"],
      nodes: [
        { label: "飞书消息", sub: "@Codex / 群聊" },
        { label: "阿里云 hub", sub: "事件回调 / 任务队列" },
        { label: "Mac worker", sub: "codex resume 续聊" },
      ],
    },
    {
      slug: "codex-app-remote", dir: "2026/05/19/codex-app-远程控制实现原理-从云端-relay-到-app-server",
      scene: "flow", cat: "技术", en: "RELAY → APP SERVER", accent: "teal", glyph: "cloud", glyphColor: "yellow",
      titleSize: 86, title: `Codex App<br><span class="hr">远程控制</span>`,
      sub: "从云端 Relay 到本机 App Server 的源码拆解：手机发指令、云端转发，文件与终端仍留在本机执行。",
      kw: ["查看线程", "发送指令", "审批动作", "JSON-RPC"],
      nodes: [
        { label: "手机端", sub: "查看线程 / 发指令 / 审批" },
        { label: "云端 Relay", sub: "转发 JSON-RPC Envelope" },
        { label: "App Server", sub: "文件 · 凭据 · 终端在本机" },
      ],
    },
    {
      slug: "codex-share", dir: "2026/05/21/codex-会话分享工具实现解析-把本地-agent-历史做成只读-snapshot",
      scene: "flow", cat: "技术", en: "READ-ONLY SNAPSHOT", accent: "red", glyph: "share", glyphColor: "acid",
      titleSize: 70, title: `本地 Agent 历史<br>做成<span class="hr">只读快照</span>`,
      sub: "只读扫描不写回原文件，把 JSONL 历史冻结成一份可审阅的静态快照——朋友只能阅读，不能继续操作。",
      kw: ["只读扫描", "脱敏导出", "静态快照", "不可续聊"],
      nodes: [
        { label: "本地历史", sub: "JSONL / history / recorder" },
        { label: "Snapshot", sub: "turns[] · redact + export" },
        { label: "只读分享", sub: "HTML / Markdown" },
      ],
    },
    {
      slug: "codex-appshot", dir: "2026/05/22/codex-appshot-实现原理-左右-command-如何变成输入框截图",
      scene: "flow", cat: "技术", en: "CODEX APPSHOT", accent: "yellow", glyph: "cmd", glyphColor: "red",
      titleSize: 70, title: `左右 Command<br>变<span class="hr">输入框截图</span>`,
      sub: "从裸修饰键事件到多模态输入附件：左右 ⌘ 触发，Electron 捕获截图与辅助功能文本，落进 Composer。",
      kw: ["modifierFlags", "bare modifier", "appshot attachment", "多模态输入"],
      nodes: [
        { label: "裸修饰键", sub: "Left ⌘ / Right ⌘" },
        { label: "Electron main", sub: "appshot-shortcut" },
        { label: "Composer 附件", sub: "截图 + 辅助功能文本" },
      ],
    },
    {
      slug: "open-token-board", dir: "2026/06/03/open-token-board-实现原理-从本机-token-日志到朋友排行榜",
      scene: "flow", cat: "技术", en: "OPEN TOKEN BOARD", accent: "violet", glyph: "chart", glyphColor: "acid",
      titleSize: 68, title: `本机 Token 日志<br>变<span class="hr">朋友排行榜</span>`,
      sub: "统一事件模型 TokenUsageEvent：采集、脱敏、去重、上报，再把多家 Agent 的用量做成 1D / 7D / 30D 排行榜。",
      kw: ["TokenUsageEvent", "采集差分", "脱敏去重", "排行榜"],
      nodes: [
        { label: "本机日志", sub: "Codex / Claude / Cursor / Trae" },
        { label: "采集 / 脱敏", sub: "差分 / 去重" },
        { label: "API + 存储", sub: "GitHub 鉴权 · PostgreSQL" },
        { label: "排行榜", sub: "1D / 7D / 30D · Token / 费用" },
      ],
    },
    {
      slug: "coze-switch", dir: "2026/06/03/coze-测试账号切换插件实现原理-从-popup-到-passport-api",
      scene: "flow", cat: "技术", en: "ACCOUNT SWITCHER", accent: "teal", glyph: "key", glyphColor: "yellow",
      titleSize: 72, title: `从 <span class="latin">Popup</span><br>到 <span class="hr latin">Passport API</span>`,
      sub: "不用页面点击猜结果，用后台接口登录，再用 Coze API 证明账号、权益和角色——一条可观察的切换链路。",
      kw: ["后台接口", "CloudIdentity", "Auth Code", "订阅验权"],
      nodes: [
        { label: "Popup", sub: "JWT / 权益 / 角色 / 进度" },
        { label: "后台状态机", sub: "查账号 / 退出 / 登录" },
        { label: "CloudIdentity", sub: "密码登录 / Auth Code" },
        { label: "Coze Passport", sub: "写入登录态 / 验权" },
      ],
    },
    {
      slug: "codex-snapshots", dir: "2026/06/03/codex-snapshots-实现原理-从本地会话到云端只读快照",
      scene: "flow", cat: "技术", en: "CODEX SNAPSHOTS", accent: "blue", glyph: "cloud", glyphColor: "yellow",
      titleSize: 70, title: `本地会话<br>到<span class="hl">云端只读快照</span>`,
      sub: "扫描、归一、脱敏、审阅、发布：一条有边界的 Agent 会话分享链路，把本地历史变成云端只读快照。",
      kw: ["扫描归一", "脱敏审阅", "发布", "只读分享"],
      nodes: [
        { label: "本地历史", sub: "Codex / Claude / Trae" },
        { label: "隐私闸门", sub: "risk / redact / sanitize" },
        { label: "只读分享", sub: "share API" },
      ],
    },
    {
      slug: "claude-proxy", dir: "2026/06/10/claude-code-代理配置复盘-从住宅-ip-到-clash-verge-rev-分流",
      scene: "flow", cat: "技术", en: "CLAUDE CODE PROXY", accent: "red", glyph: "proxy", glyphColor: "acid",
      titleSize: 88, title: `代理配置<br><span class="hr">复盘</span>`,
      sub: "把出口 IP、系统代理、本机端口和规则命中分清楚：从住宅 IP 到 Clash Verge Rev 的分流链路。",
      kw: ["出口 IP", "系统代理", "Clash Verge Rev", "CLI 环境变量"],
      nodes: [
        { label: "应用", sub: "Chrome / CLI" },
        { label: "本机端口", sub: "127.0.0.1:7897" },
        { label: "规则出口", sub: "住宅 IP / UK" },
      ],
    },
    {
      slug: "browser-tools", dir: "2026/06/08/浏览器自动化工具能力边界-chrome-插件-cdp-mcp-和-devtools-差异",
      scene: "browser", cat: "技术", en: "BROWSER AGENTS", accent: "blue",
      titleSize: 96, title: `浏览器 <span class="hl latin">Agent</span><br>工具<em style="background:var(--acid)">怎么选</em>`,
      sub: "从 Agent 友好度，横看 Chrome 插件 · CDP · MCP · DevTools · Playwright 与 bb-browser —— 谁能让 Agent 更容易看懂页面、稳定点击、复用登录态、看清请求与性能。",
      kw: ["快照", "稳定引用", "点击输入", "Network", "性能分析", "真实登录态", "Site Adapter"],
      stageHTML: `
        <div class="field" style="background:var(--blue)"></div>
        <div class="field-stripe"></div><div class="field-dots"></div>
        <div class="win">
          <div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url"></span></div>
          <div class="body">
            <div class="line l"></div><div class="line m"></div><div class="line s"></div><div class="line m"></div>
            <div class="el btn"><span class="ref">@e3</span><span class="t">登录</span></div>
          </div>
        </div>
        <div class="eye"><span class="pupil"></span></div>
        <div class="scan"></div>
        <div class="tools">
          <span class="pill">@chrome</span><span class="pill a">CDP</span><span class="pill b">MCP</span>
          <span class="pill">DevTools</span><span class="pill c">Playwright</span><span class="pill">bb-browser</span>
        </div>`,
    },
    {
      slug: "browser-agent-bench", dir: "2026/06/12/浏览器-agent-工具实测-六工具八任务横评",
      scene: "browser", cat: "技术", en: "BROWSER AGENTS × BENCH", accent: "violet",
      titleSize: 80, title: `浏览器 <span class="hv latin">Agent</span> 工具<br>分层 × <em style="background:var(--violet);color:#fff">实测</em>`,
      sub: "先用能力分层和安全域解释每个工具的边界，再用一个有标准答案的基准站、互相隔离的无偏会话实测六款工具——谁更能让 Agent 看懂页面、复用真实登录态、跨会话续命。",
      kw: ["能力分层", "安全域", "chrome:// 特权页", "真实登录态", "跨会话持久化", "无偏会话"],
      stageHTML: `
        <div class="field" style="background:var(--violet)"></div>
        <div class="field-stripe"></div><div class="field-dots"></div>
        <div class="win">
          <div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url"></span></div>
          <div class="body">
            <div class="line l"></div><div class="line m"></div><div class="line s"></div><div class="line m"></div>
            <div class="el btn"><span class="ref">@e3</span><span class="t">登录</span></div>
          </div>
        </div>
        <div class="eye"><span class="pupil"></span></div>
        <div class="scan"></div>
        <div style="position:absolute;left:46px;top:120px;z-index:21;background:var(--acid);border:4px solid var(--ink);box-shadow:6px 6px 0 rgba(0,0,0,.35);font-family:var(--mono);font-weight:800;font-size:18px;color:var(--ink);padding:8px 14px;transform:rotate(-4deg)">11 任务 · 6 工具</div>
        <div class="tools">
          <span class="pill a">@chrome</span><span class="pill">@browser</span><span class="pill b">agent-browser</span>
          <span class="pill">bb-browser</span><span class="pill">DevTools MCP</span><span class="pill c">playwright-cli</span>
        </div>`,
    },
    {
      slug: "profilepilot", dir: "2026/06/16/profilepilot-源码解析-本机优先的-chrome-profile-控制台是怎么实现的",
      scene: "flow", cat: "技术", en: "PROFILEPILOT · SOURCE", accent: "violet", glyph: "console",
      titleSize: 84, title: `给真实 Chrome<br>补一块 <span class="hv">控制面</span>`,
      sub: "本机优先：从 Local State 发现 Profile、用 ps/lsof 还原运行态、给隔离 Profile 固定 CDP 端口交给 Agent，再把登录态在 Profile 间「暂存 + 原子替换 + 可回滚」地搬运。",
      kw: ["Local State", "ps / lsof", "固定 CDP", "原子替换 + 回滚", "Electron"],
    },
  ];

  return [...N, ...T];
})();
