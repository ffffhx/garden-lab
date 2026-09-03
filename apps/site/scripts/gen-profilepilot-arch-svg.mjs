// Generator script for figure-wb-08-profilepilot-arch.svg
// ProfilePilot System Architecture: Control Plane vs. Data Plane
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.resolve(
  __dirname,
  "..",
  "source",
  "_posts",
  "2026",
  "08",
  "21",
  "实习答辩-冯鸿鑫"
);

function generateProfilePilotArchSvg() {
  const width = 1440;
  const height = 1580;

  // Colors
  // Blue (Control/Client)
  const cBlue = {
    fill: "#eff6ff",
    stroke: "#93c5fd",
    text: "#1d4ed8",
    darkText: "#1e3a8a",
    badge: "#2563eb",
    accent: "#3b82f6"
  };
  // Purple (Gateway/Security)
  const cPurple = {
    fill: "#f5f3ff",
    stroke: "#c4b5fd",
    text: "#6d28d9",
    darkText: "#4c1d95",
    badge: "#7c3aed",
    accent: "#8b5cf6"
  };
  // Emerald / Teal (Runtime & Profiles)
  const cTeal = {
    fill: "#f0fdf4",
    stroke: "#86efac",
    text: "#15803d",
    darkText: "#14532d",
    badge: "#16a34a",
    accent: "#10b981"
  };
  // Amber / Orange (Focus Engine & Special Highlighting)
  const cAmber = {
    fill: "#fffbeb",
    stroke: "#fcd34d",
    text: "#b45309",
    darkText: "#78350f",
    badge: "#d97706",
    accent: "#f59e0b"
  };
  // Rose (Windows Security & OS Crypt)
  const cRose = {
    fill: "#fff1f2",
    stroke: "#fecdd3",
    text: "#be123c",
    darkText: "#881337",
    badge: "#e11d48",
    accent: "#f43f5e"
  };
  // Slate (Neutral / System)
  const cSlate = {
    fill: "#f8fafc",
    stroke: "#cbd5e1",
    text: "#475569",
    darkText: "#0f172a",
    badge: "#64748b",
    accent: "#94a3b8"
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <style>
      .bg { fill: #f8fafc; }
      .frame { fill: #ffffff; stroke: #e2e8f0; stroke-width: 1.5; }
      .header-title { font: 800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #0f172a; }
      .header-sub { font: 500 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #64748b; }
      .col-title { font: 700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; }
      .col-sub { font: 500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; }

      .sec-box { rx: 10; stroke-width: 1.5; }
      .card-box { rx: 7; stroke-width: 1.2; }
      .inner-box { rx: 6; stroke-width: 1; }

      .pill { rx: 4; }
      .pill-text { font: 700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; fill: #ffffff; text-anchor: middle; dominant-baseline: central; }

      .card-title { font: 700 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; dominant-baseline: central; }
      .card-desc { font: 500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #475569; }
      .code-text { font: 600 11.5px "JetBrains Mono", Consolas, Menlo, monospace; }
      .badge-text { font: 700 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; dominant-baseline: central; }

      .flow-arrow { stroke-width: 1.8; fill: none; }
      .flow-dash { stroke-width: 1.8; stroke-dasharray: 5 4; fill: none; }
      .tag { rx: 3; }
      .tag-text { font: 600 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; dominant-baseline: central; }
    </style>

    <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6"/>
    </marker>
    <marker id="arrow-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#8b5cf6"/>
    </marker>
    <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b"/>
    </marker>
    <marker id="arrow-teal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981"/>
    </marker>
  </defs>

  <!-- Canvas Background -->
  <rect class="bg" width="${width}" height="${height}" rx="16"/>
  <rect class="frame" x="16" y="16" width="${width - 32}" height="${height - 32}" rx="14"/>

  <!-- Top Header Banner -->
  <g transform="translate(48, 46)">
    <rect class="pill" x="0" y="0" width="168" height="24" fill="#0284c7" rx="5"/>
    <text class="pill-text" x="84" y="12">系统架构 · 控制面与数据面</text>

    <text class="header-title" x="0" y="54">ProfilePilot：本机优先 Chrome 控制面与多 Agent 协同双核架构</text>
    <text class="header-sub" x="0" y="80">左翼：可编程 Agent 协同控制面（租约权威 · Ticket 鉴权 · 专用 Pipe · Shadow DOM 悬浮条） │ 右翼：本机优先 Profile 数据管理面（单例握手置顶 · macOS/Win 登录态加密差异 · 隔离副本池）</text>
  </g>

  <!-- Main Dual-Column Layout -->
  <!-- Left Column X: 48, Width: 656 -->
  <!-- Right Column X: 736, Width: 656 -->
`;

  const colWidth = 656;
  const leftX = 48;
  const rightX = 736;
  const topY = 155;

  // ==========================================
  // LEFT COLUMN: 可编程 Agent 协同控制面 (Control Plane)
  // ==========================================
  svg += `
  <!-- ==================== LEFT WING HEADER ==================== -->
  <g transform="translate(${leftX}, ${topY})">
    <rect class="sec-box" x="0" y="0" width="${colWidth}" height="1350" fill="#f8fafc" stroke="#93c5fd"/>
    <!-- Banner -->
    <path d="M 0 10 Q 0 0 10 0 L ${colWidth - 10} 0 Q ${colWidth} 0 ${colWidth} 10 L ${colWidth} 50 L 0 50 Z" fill="#eff6ff"/>
    <line x1="0" y1="50" x2="${colWidth}" y2="50" stroke="#bfdbfe" stroke-width="1.5"/>
    <rect class="pill" x="18" y="14" width="76" height="22" fill="#2563eb"/>
    <text class="pill-text" x="56" y="25">控制面</text>
    <text class="col-title" x="104" y="27" fill="#1e3a8a">可编程 Agent 协同控制面 (Control Plane)</text>
    <text class="col-sub" x="104" y="43" fill="#64748b">会话透明拦截 · Gateway 租约与 Ticket 鉴权 · 受控 Pipe 转发 · 页面悬浮条可见接管</text>
  </g>
`;

  // Left 1: 接入与命令透明拦截层
  svg += `
  <!-- Left Layer 1: 接入与命令透明拦截层 -->
  <g transform="translate(${leftX + 16}, ${topY + 66})">
    <rect class="card-box" x="0" y="0" width="${colWidth - 32}" height="144" fill="#ffffff" stroke="#bfdbfe"/>
    <rect class="pill" x="14" y="12" width="146" height="22" fill="#3b82f6"/>
    <text class="pill-text" x="87" y="23">1. 接入与命令透明拦截层</text>
    <text class="card-title" x="170" y="23" fill="#1e40af">Agent 驱动入口 &amp; 零感知 Session 映射</text>

    <!-- 2 Sub-blocks -->
    <!-- Block A: External Agents -->
    <rect class="inner-box" x="14" y="44" width="288" height="86" fill="#f0f9ff" stroke="#bae6fd"/>
    <text class="card-title" x="26" y="62" fill="#0369a1" style="font-size: 12.5px;">外部 Agent 与测试框架调用</text>
    <text class="card-desc" x="26" y="82">• <tspan class="code-text" fill="#0284c7">Codex / Claude Code</tspan> 执行自动化验证</text>
    <text class="card-desc" x="26" y="100">• <tspan class="code-text" fill="#0284c7">agent-browser / Playwright CLI</tspan> 测试驱动</text>
    <text class="card-desc" x="26" y="118">• 标准 CLI 命令 (如: <tspan class="code-text" fill="#0369a1">open, click, snapshot</tspan>)</text>

    <!-- Block B: ~/.zshenv + Wrapper -->
    <rect class="inner-box" x="318" y="44" width="306" height="86" fill="#eff6ff" stroke="#bfdbfe"/>
    <text class="card-title" x="330" y="62" fill="#1d4ed8" style="font-size: 12.5px;">透明拦截器 (Agent Browser Wrapper)</text>
    <text class="card-desc" x="330" y="82">• <tspan class="code-text" fill="#2563eb">~/.zshenv</tspan> 自动注入 <tspan class="code-text" fill="#2563eb">AGENT_BROWSER_SESSION</tspan></text>
    <text class="card-desc" x="330" y="100">• 业务侧/Agent 零感知（无需手工加 <tspan class="code-text" fill="#2563eb">--session</tspan>）</text>
    <text class="card-desc" x="330" y="118">• 拦截命令并提取目标端口，向 Gateway 申请租约</text>
  </g>
`;

  // Left Arrow 1 -> 2
  svg += `
  <g transform="translate(${leftX + colWidth / 2}, ${topY + 210})">
    <line class="flow-arrow" x1="0" y1="0" x2="0" y2="22" stroke="#3b82f6" marker-end="url(#arrow-blue)"/>
    <rect x="-105" y="4" width="210" height="18" rx="4" fill="#ffffff" stroke="#bfdbfe" stroke-width="1"/>
    <text class="tag-text" x="0" y="13" text-anchor="middle" fill="#1d4ed8">向网关申领 Profile 租约与一次性 Ticket</text>
  </g>
`;

  // Left 2: 核心网关与调度中枢 (Browser Gateway - Core Authority)
  svg += `
  <!-- Left Layer 2: 核心网关与调度中枢 -->
  <g transform="translate(${leftX + 16}, ${topY + 236})">
    <rect class="card-box" x="0" y="0" width="${colWidth - 32}" height="550" fill="#ffffff" stroke="#c4b5fd"/>
    <rect class="pill" x="14" y="14" width="168" height="22" fill="#7c3aed"/>
    <text class="pill-text" x="98" y="25">2. Browser Gateway 控制中枢</text>
    <text class="card-title" x="192" y="25" fill="#5b21b6">租约权威、安全鉴权与受控 CDP 路由核心</text>

    <!-- Sub Module 2.1: 租约与并发管理 -->
    <g transform="translate(14, 46)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="108" fill="#f5f3ff" stroke="#ddd6fe"/>
      <rect class="pill" x="12" y="10" width="138" height="20" fill="#6d28d9"/>
      <text class="pill-text" x="81" y="20">❶ 租约与并发管理中枢</text>
      <text class="card-title" x="160" y="20" fill="#4c1d95" style="font-size: 13px;">Lease &amp; Concurrency Authority</text>

      <text class="card-desc" x="14" y="48">• <tspan font-weight="700" fill="#4c1d95">端口与 Session 原子独占绑定：</tspan>每个已启动 Profile 端口同一时刻仅承载一个 Agent 独占租约</text>
      <text class="card-desc" x="14" y="68">• <tspan font-weight="700" fill="#4c1d95">候选池自动切流：</tspan>目标 Profile 处于占用状态时，Gateway 自动调度候选空闲 Profile，杜绝命令抛错阻断</text>
      <text class="card-desc" x="14" y="88">• <tspan font-weight="700" fill="#4c1d95">抢占互斥保护：</tspan>彻底解决多个 Agent 或开发者在同一窗口争抢焦点与键鼠输入的冲突痛点</text>
    </g>

    <!-- Sub Module 2.2: 安全鉴权与票据引擎 -->
    <g transform="translate(14, 164)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="114" fill="#faf5ff" stroke="#e9d5ff"/>
      <rect class="pill" x="12" y="10" width="144" height="20" fill="#7e22ce"/>
      <text class="pill-text" x="84" y="20">❷ 安全鉴权与票据引擎</text>
      <text class="card-title" x="166" y="20" fill="#581c87" style="font-size: 13px;">Ticket &amp; Security Engine</text>

      <text class="card-desc" x="14" y="48">• <tspan font-weight="700" fill="#581c87">HMAC-SHA256 一次性票据 (Ticket)：</tspan>每次建立 CDP 连接前必须由 Gateway 签名签发，防伪造与越权</text>
      <text class="card-desc" x="14" y="68">• <tspan font-weight="700" fill="#581c87">15 秒短 TTL 与防重放保护：</tspan>Ticket 仅允许在握手窗口内消费一次，消费即作废，防止链接泄露重放</text>
      <text class="card-desc" x="14" y="88">• <tspan font-weight="700" fill="#581c87">控制代次锁 (Generation Guard)：</tspan>每次接管或租约流转递增代次，阻断断开连接的滞后指令穿透</text>
    </g>

    <!-- Sub Module 2.3: 受控 CDP 指令管道与策略过滤 -->
    <g transform="translate(14, 288)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="112" fill="#f5f3ff" stroke="#ddd6fe"/>
      <rect class="pill" x="12" y="10" width="148" height="20" fill="#6d28d9"/>
      <text class="pill-text" x="86" y="20">❸ 受控 CDP 管道与策略代理</text>
      <text class="card-title" x="170" y="20" fill="#4c1d95" style="font-size: 13px;">Policy &amp; Dedicated Pipe Proxy</text>

      <text class="card-desc" x="14" y="48">• <tspan font-weight="700" fill="#4c1d95">高危指令主动拦截：</tspan>卡口过滤 <tspan class="code-text" fill="#6d28d9">AGENT_DENIED_TARGET_METHODS</tspan>，禁止 Agent 越权操作宿主设置</text>
      <text class="card-desc" x="14" y="68">• <tspan font-weight="700" fill="#4c1d95">设备与视口虚拟化：</tspan>按需注入 Device/Viewport Emulation，保持多端响应式测试环境一致性</text>
      <text class="card-desc" x="14" y="88">• <tspan font-weight="700" fill="#4c1d95">长连事件缓冲与转发：</tspan>驱动通过独立 WS 接入，经网关检验后由 Dedicated Pipe 单向转发浏览器</text>
    </g>

    <!-- Sub Module 2.4: 会话追踪与接管状态机 -->
    <g transform="translate(14, 410)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="124" fill="#faf5ff" stroke="#e9d5ff"/>
      <rect class="pill" x="12" y="10" width="154" height="20" fill="#7e22ce"/>
      <text class="pill-text" x="89" y="20">❹ 会话追踪与人机接管状态机</text>
      <text class="card-title" x="176" y="20" fill="#581c87" style="font-size: 13px;">Session Tailer &amp; Takeover State Machine</text>

      <text class="card-desc" x="14" y="46">• <tspan font-weight="700" fill="#581c87">会话日志增量 Tailer：</tspan>监听 Claude <tspan class="code-text" fill="#7e22ce">.jsonl</tspan> 与 Codex <tspan class="code-text" fill="#7e22ce">rollout-*.jsonl</tspan>，提取自然语言动作与进度</text>
      <text class="card-desc" x="14" y="66">• <tspan font-weight="700" fill="#581c87">接管状态机流转：</tspan><tspan class="code-text" fill="#16a34a">active</tspan> (运行) ⇄ <tspan class="code-text" fill="#d97706">parked</tspan> (挂起缓冲) ⇄ <tspan class="code-text" fill="#dc2626">takenOver</tspan> (彻底接管) ⇄ <tspan class="code-text" fill="#2563eb">resumed</tspan> (交还)</text>
      <text class="card-desc" x="14" y="86">• <tspan font-weight="700" fill="#581c87">Park 挂起协同：</tspan>用户微调页面时保持 WS 连接、排队暂存事件流，交还时唤醒 Agent 重新快照</text>
      <text class="card-desc" x="14" y="106">• <tspan font-weight="700" fill="#581c87">Takeover 强接管：</tspan>优雅终止 Agent 驱动 daemon 进程，目标 Chrome 窗口保持开启，无缝转交人类</text>
    </g>
  </g>
`;

  // Left Arrow 2 -> 3
  svg += `
  <g transform="translate(${leftX + colWidth / 2}, ${topY + 786})">
    <line class="flow-arrow" x1="0" y1="0" x2="0" y2="24" stroke="#8b5cf6" marker-end="url(#arrow-purple)"/>
    <rect x="-105" y="4" width="210" height="18" rx="4" fill="#ffffff" stroke="#ddd6fe" stroke-width="1"/>
    <text class="tag-text" x="0" y="13" text-anchor="middle" fill="#6d28d9">CDP 动态注入悬浮控制条与绑定信号</text>
  </g>
`;

  // Left 3: 页面级人机协同注入 (In-Page Overlay)
  svg += `
  <!-- Left Layer 3: 页面级人机协同注入 -->
  <g transform="translate(${leftX + 16}, ${topY + 814})">
    <rect class="card-box" x="0" y="0" width="${colWidth - 32}" height="198" fill="#ffffff" stroke="#93c5fd"/>
    <rect class="pill" x="14" y="12" width="154" height="22" fill="#2563eb"/>
    <text class="pill-text" x="91" y="23">3. 页面级人机协同注入</text>
    <text class="card-title" x="178" y="23" fill="#1e40af">In-Page Agent Overlay (可见可接管悬浮条)</text>

    <!-- Sub Content -->
    <g transform="translate(14, 44)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="140" fill="#f0f9ff" stroke="#bae6fd"/>
      <text class="card-desc" x="14" y="26">• <tspan font-weight="700" fill="#0369a1">CDP 原生静默注入：</tspan>通过 <tspan class="code-text" fill="#0284c7">Page.addScriptToEvaluateOnNewDocument</tspan> 跨页面持久存在，无需用户安装扩展</text>
      <text class="card-desc" x="14" y="48">• <tspan font-weight="700" fill="#0369a1">Closed Shadow DOM 隔离：</tspan>样式与 DOM 树完全封装于 closed 容器，彻底防止宿主网页 CSS/JS 干扰状态条渲染</text>
      <text class="card-desc" x="14" y="70">• <tspan font-weight="700" fill="#0369a1">aria-hidden="true" 降噪设计：</tspan>阻止 Agent 的 Accessibility Snapshot 将状态条扫描为正文，终结死循环自交互</text>
      <text class="card-desc" x="14" y="92">• <tspan font-weight="700" fill="#0369a1">实时进度与意图流：</tspan>展示主会话 Agent 名称、当前执行动作（如“正在填写验证码”）、已完成步骤 (<tspan class="code-text" fill="#0369a1">2/5</tspan>)</text>
      <text class="card-desc" x="14" y="114">• <tspan font-weight="700" fill="#0369a1">双击二次确认接管：</tspan>提供「暂停」与「接管」按钮，3 秒防手滑二次确认，通过 <tspan class="code-text" fill="#0369a1">Runtime.addBinding</tspan> 上报信号</text>
    </g>
  </g>
`;

  // Left Arrow 3 -> 4
  svg += `
  <g transform="translate(${leftX + colWidth / 2}, ${topY + 1012})">
    <line class="flow-arrow" x1="0" y1="0" x2="0" y2="24" stroke="#10b981" marker-end="url(#arrow-teal)"/>
    <rect x="-95" y="4" width="190" height="18" rx="4" fill="#ffffff" stroke="#86efac" stroke-width="1"/>
    <text class="tag-text" x="0" y="13" text-anchor="middle" fill="#15803d">独占 Pipe 管道受控驱动目标 Chrome</text>
  </g>
`;

  // Left 4: 运行时受控 Chrome 实例
  svg += `
  <!-- Left Layer 4: 运行时受控 Chrome 实例 -->
  <g transform="translate(${leftX + 16}, ${topY + 1040})">
    <rect class="card-box" x="0" y="0" width="${colWidth - 32}" height="286" fill="#ffffff" stroke="#86efac"/>
    <rect class="pill" x="14" y="12" width="154" height="22" fill="#16a34a"/>
    <text class="pill-text" x="91" y="23">4. 运行时受控 Chrome 实例</text>
    <text class="card-title" x="178" y="23" fill="#14532d">Controlled Chrome Runtime &amp; Pipe Driver</text>

    <!-- Sub Content -->
    <g transform="translate(14, 44)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="228" fill="#f0fdf4" stroke="#bbf7d0"/>
      <text class="card-desc" x="14" y="28">• <tspan font-weight="700" fill="#14532d">--remote-debugging-pipe 专用独占通道：</tspan></text>
      <text class="card-desc" x="28" y="48">采用 Stdio 独占管道替代常规 TCP 调试端口，本机对外不暴露任何可探测网络端口，消除公网/内网恶意渗透风险</text>

      <text class="card-desc" x="14" y="78">• <tspan font-weight="700" fill="#14532d">多维度探活与端口兜底机制：</tspan></text>
      <text class="card-desc" x="28" y="98">集成 <tspan class="code-text" fill="#14532d">lsof</tspan> 进程探测与轻量级 CDP 探活徽章；自动解析 Chrome 144+ <tspan class="code-text" fill="#14532d">DevToolsActivePort</tspan>，杜绝 404 失联</text>

      <text class="card-desc" x="14" y="128">• <tspan font-weight="700" fill="#14532d">优雅退出 (Graceful Exit) 保留登录态：</tspan></text>
      <text class="card-desc" x="28" y="148">关闭或回收 Profile 时优先发送系统级优雅退出指令 (macOS ⌘Q / SIGTERM)，严禁直接暴力 kill 进程；</text>
      <text class="card-desc" x="28" y="168">留足磁盘 I/O 窗口让 SQLite (Cookies) 与 LevelDB (LocalStorage) 正常合并刷盘，根治“一关浏览器就掉登录态”的业界难题</text>

      <text class="card-desc" x="14" y="198">• <tspan font-weight="700" fill="#14532d">外部实例 (External Chrome) 兼容接管：</tspan></text>
      <text class="card-desc" x="28" y="218">自动嗅探并以只读方式发现第三方工具开启的 Chromium 实例，提供统一的置顶唤起与安全关闭能力</text>
    </g>
  </g>
`;

  // ==========================================
  // RIGHT COLUMN: 本机优先 Profile 数据管理面 (Data Plane)
  // ==========================================
  svg += `
  <!-- ==================== RIGHT WING HEADER ==================== -->
  <g transform="translate(${rightX}, ${topY})">
    <rect class="sec-box" x="0" y="0" width="${colWidth}" height="1350" fill="#f8fafc" stroke="#86efac"/>
    <!-- Banner -->
    <path d="M 0 10 Q 0 0 10 0 L ${colWidth - 10} 0 Q ${colWidth} 0 ${colWidth} 10 L ${colWidth} 50 L 0 50 Z" fill="#f0fdf4"/>
    <line x1="0" y1="50" x2="${colWidth}" y2="50" stroke="#bbf7d0" stroke-width="1.5"/>
    <rect class="pill" x="18" y="14" width="76" height="22" fill="#16a34a"/>
    <text class="pill-text" x="56" y="25">数据面</text>
    <text class="col-title" x="104" y="27" fill="#14532d">本机优先 Profile 数据管理面 (Data Plane)</text>
    <text class="col-sub" x="104" y="43" fill="#64748b">单例握手精确置顶 · 跨平台登录态加密同步 · 物理目录沙箱 · 干净用完即弃池</text>
  </g>
`;

  // Right 1: 桌面交互与运维控制台
  svg += `
  <!-- Right Layer 1: 桌面交互与运维控制台 -->
  <g transform="translate(${rightX + 16}, ${topY + 66})">
    <rect class="card-box" x="0" y="0" width="${colWidth - 32}" height="144" fill="#ffffff" stroke="#86efac"/>
    <rect class="pill" x="14" y="12" width="168" height="22" fill="#16a34a"/>
    <text class="pill-text" x="98" y="23">1. 桌面交互与运维控制台</text>
    <text class="card-title" x="192" y="23" fill="#14532d">Desktop Management Console (Electron Native)</text>

    <!-- 2 Sub-blocks -->
    <rect class="inner-box" x="14" y="44" width="288" height="86" fill="#f0fdf4" stroke="#bbf7d0"/>
    <text class="card-title" x="26" y="62" fill="#15803d" style="font-size: 12.5px;">原生 TS 极简控制面板</text>
    <text class="card-desc" x="26" y="82">• <tspan font-weight="700" fill="#15803d">零重型前端框架：</tspan>启动秒开，极致轻量资源开销</text>
    <text class="card-desc" x="26" y="100">• Profile 列表 / 运行状态徽章 / 端口分配监控</text>
    <text class="card-desc" x="26" y="118">• Mini 悬浮小窗模式 / Live View 页面实时窥见</text>

    <rect class="inner-box" x="318" y="44" width="306" height="86" fill="#f0fdf4" stroke="#bbf7d0"/>
    <text class="card-title" x="330" y="62" fill="#15803d" style="font-size: 12.5px;">运维向导与资产调度</text>
    <text class="card-desc" x="330" y="82">• 一键创建独立测试 Profile / 绑定固定 CDP 端口</text>
    <text class="card-desc" x="330" y="100">• 插件迁移向导：扫描 Web Store / 本地已解包插件</text>
    <text class="card-desc" x="330" y="118">• 账号会话无损同步：差异比对、暂停、取消、一键克隆</text>
  </g>
`;

  // Right Arrow 1 -> 2
  svg += `
  <g transform="translate(${rightX + colWidth / 2}, ${topY + 210})">
    <line class="flow-arrow" x1="0" y1="0" x2="0" y2="22" stroke="#f59e0b" marker-end="url(#arrow-amber)"/>
    <rect x="-105" y="4" width="210" height="18" rx="4" fill="#ffffff" stroke="#fde68a" stroke-width="1"/>
    <text class="tag-text" x="0" y="13" text-anchor="middle" fill="#b45309">调用多层窗口激活策略（解决实例串台）</text>
  </g>
`;

  // Right 2: 跨平台窗口台前激活引擎 (Cross-Platform Window Focus Engine) ★ 核心亮点
  svg += `
  <!-- Right Layer 2: 跨平台窗口台前激活引擎 -->
  <g transform="translate(${rightX + 16}, ${topY + 236})">
    <rect class="card-box" x="0" y="0" width="${colWidth - 32}" height="286" fill="#ffffff" stroke="#fcd34d"/>
    <rect class="pill" x="14" y="14" width="180" height="22" fill="#d97706"/>
    <text class="pill-text" x="104" y="25">2. 跨平台窗口台前激活引擎</text>
    <text class="card-title" x="204" y="25" fill="#92400e">精准置顶特定 Profile 窗口 · 终结多实例串台痛点</text>

    <!-- Focus Pain Point Box -->
    <g transform="translate(14, 46)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="42" fill="#fffbeb" stroke="#fde68a"/>
      <text class="card-desc" x="12" y="26"><tspan font-weight="700" fill="#b45309">多实例激活难题：</tspan>当系统同时运行多个相同 bundle (<tspan class="code-text" fill="#b45309">Google Chrome.app</tspan> 或相同 <tspan class="code-text" fill="#b45309">chrome.exe</tspan>) 时，常规系统 API 极易发生错误串台！</text>
    </g>

    <!-- 3 Steps -->
    <g transform="translate(14, 96)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="174" fill="#ffffff" stroke="#fde68a"/>

      <!-- Step 1 -->
      <text class="badge-text" x="14" y="22" fill="#b45309">① 第一层 · 协议级无副作用置顶：</text>
      <text class="card-desc" x="32" y="42">若 Profile 运行着调试端口，首先发送 CDP <tspan class="code-text" fill="#b45309">Page.bringToFront</tspan> 命令，无侵入尝试聚焦页面；</text>

      <!-- Step 2 -->
      <text class="badge-text" x="14" y="68" fill="#b45309">② 第二层 · 系统级原生轻量激活：</text>
      <text class="card-desc" x="32" y="88">调用 macOS AppleScript 或 Win32 <tspan class="code-text" fill="#b45309">SetForegroundWindow</tspan>。若确认目标 PID 已处于系统最前台则直接完成；</text>

      <!-- Step 3 (Core highlight) -->
      <text class="badge-text" x="14" y="114" fill="#b45309">③ 第三层 (终极杀手锏) · Chrome 单例握手置前 (Singleton Handshake)：</text>
      <text class="card-desc" x="32" y="134">• 向目标实例专属目录再次触发轻量启动命令 ➔ 检测到 <tspan class="code-text" fill="#b45309">SingletonLock</tspan> 后由内部 IPC 握手转交当前实例自我置顶；</text>
      <text class="card-desc" x="32" y="154">• <tspan font-weight="700" fill="#b45309">消除副作用：</tspan>提前记录已有标签页快照，单例握手置顶后<tspan font-weight="700" fill="#d97706">自动通过 CDP 关闭新弹出的空白新标签页 (Clean NTP)</tspan>！</text>
    </g>
  </g>
`;

  // Right Arrow 2 -> 3
  svg += `
  <g transform="translate(${rightX + colWidth / 2}, ${topY + 522})">
    <line class="flow-arrow" x1="0" y1="0" x2="0" y2="24" stroke="#e11d48" marker-end="url(#arrow-blue)"/>
    <rect x="-105" y="4" width="210" height="18" rx="4" fill="#ffffff" stroke="#fecdd3" stroke-width="1"/>
    <text class="tag-text" x="0" y="13" text-anchor="middle" fill="#be123c">底层登录态资产同步与跨平台加密解密</text>
  </g>
`;

  // Right 3: 跨平台账号会话无损同步引擎 (Account Sync Engine) ★ 核心亮点
  svg += `
  <!-- Right Layer 3: 跨平台账号会话无损同步引擎 -->
  <g transform="translate(${rightX + 16}, ${topY + 550})">
    <rect class="card-box" x="0" y="0" width="${colWidth - 32}" height="462" fill="#ffffff" stroke="#fecdd3"/>
    <rect class="pill" x="14" y="14" width="186" height="22" fill="#e11d48"/>
    <text class="pill-text" x="107" y="25">3. 跨平台账号会话无损同步</text>
    <text class="card-title" x="210" y="25" fill="#9f1239">Account &amp; Session Sync · 破解 OS Crypt 密钥藩篱</text>

    <!-- Sub Module 3.1: 同步资产与脏缓存过滤 -->
    <g transform="translate(14, 46)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="106" fill="#fff1f2" stroke="#fecdd3"/>
      <text class="card-title" x="14" y="20" fill="#be123c" style="font-size: 13px;">精细化数据颗粒度与智能缓存清洗 (Data Sanitation)</text>

      <text class="card-desc" x="14" y="44">• <tspan font-weight="700" fill="#9f1239">同步的核心资产：</tspan><tspan class="code-text" fill="#9f1239">Cookies (Network/Cookies SQLite)</tspan>、<tspan class="code-text" fill="#9f1239">Local Storage (leveldb)</tspan>、<tspan class="code-text" fill="#9f1239">Session Storage</tspan>、<tspan class="code-text" fill="#9f1239">IndexedDB</tspan></text>
      <text class="card-desc" x="14" y="64">• <tspan font-weight="700" fill="#9f1239">剥离污染源：</tspan>严格保留目标 Profile 既有扩展，不复制来源插件污染安装记录 (<tspan class="code-text" fill="#9f1239">Secure Preferences</tspan>)</text>
      <text class="card-desc" x="14" y="84">• <tspan font-weight="700" fill="#9f1239">清洗巨型脏缓存：</tspan>自动过滤数 GB、数万个文件的 <tspan class="code-text" fill="#9f1239">CacheStorage</tspan>，根治 Windows 平台启动扫盘卡死现象</text>
    </g>

    <!-- Sub Module 3.2: 跨平台操作系统加密差异机制 (OS Cryptography Mechanism) ★ 重点展开 -->
    <g transform="translate(14, 160)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="286" fill="#ffffff" stroke="#fecdd3"/>
      <rect class="pill" x="12" y="10" width="186" height="20" fill="#be123c"/>
      <text class="pill-text" x="105" y="20">⚡ 操作系统底层加密差异机制</text>
      <text class="card-title" x="208" y="20" fill="#881337" style="font-size: 12.5px;">macOS Keychain vs Windows DPAPI / App-Bound</text>

      <!-- macOS Comparison -->
      <g transform="translate(14, 38)">
        <rect class="inner-box" x="0" y="0" width="${colWidth - 88}" height="94" fill="#f0fdf4" stroke="#86efac"/>
        <rect class="pill" x="10" y="8" width="112" height="18" fill="#16a34a"/>
        <text class="pill-text" x="66" y="17" style="font-size: 10.5px;">🍏 macOS 平台机制</text>
        <text class="card-title" x="130" y="18" fill="#14532d" style="font-size: 12px;">系统级钥匙串集中鉴权 (Chrome Safe Storage)</text>

        <text class="card-desc" x="12" y="42">• 凭据加密基于当前 macOS 用户会话统一的 <tspan font-weight="700" fill="#14532d">Keychain</tspan> 项，解密不严格限定物理路径；</text>
        <text class="card-desc" x="12" y="62">• <tspan font-weight="700" fill="#16a34a">原生系统 Profile ➔ 隔离 Profile：</tspan>数据拷贝后，浏览器能正常读钥匙串解密 Cookies；</text>
        <text class="card-desc" x="12" y="82">• <tspan font-weight="700" fill="#14532d">成果：</tspan>实现从系统默认 Chrome 无缝复制完整登录态至独立测试环境！</text>
      </g>

      <!-- Windows Comparison -->
      <g transform="translate(14, 140)">
        <rect class="inner-box" x="0" y="0" width="${colWidth - 88}" height="134" fill="#fff1f2" stroke="#fecdd3"/>
        <rect class="pill" x="10" y="8" width="124" height="18" fill="#e11d48"/>
        <text class="pill-text" x="72" y="17" style="font-size: 10.5px;">🪟 Windows 平台机制</text>
        <text class="card-title" x="142" y="18" fill="#9f1239" style="font-size: 12px;">App-Bound Encryption 保护藩篱与 DPAPI 副本突破</text>

        <text class="card-desc" x="12" y="42">• <tspan font-weight="700" fill="#9f1239">Chrome 127+ 应用绑定加密：</tspan>密钥存储于 <tspan class="code-text" fill="#9f1239">app_bound_encrypted_key</tspan>，由提权 Windows 服务校验；</text>
        <text class="card-desc" x="12" y="62">• <tspan font-weight="700" fill="#e11d48">原生系统 Profile 无法复制：</tspan>密钥强绑定原生默认目录，拷贝到自定义目录解密失败（保护防黑客搬运）；</text>
        <text class="card-desc" x="12" y="82">• <tspan font-weight="700" fill="#be123c">ProfilePilot 隔离 Profile 间克隆突破：</tspan>隔离实例使用 DPAPI 密钥 (<tspan class="code-text" fill="#be123c">os_crypt.encrypted_key</tspan>)；</text>
        <text class="card-desc" x="12" y="104">• ProfilePilot 在隔离副本间精准提取并原子同步旧版 DPAPI 密钥，<tspan font-weight="700" fill="#be123c">实现隔离环境间 100% 完整无损克隆！</tspan></text>
      </g>
    </g>
  </g>
`;

  // Right Arrow 3 -> 4
  svg += `
  <g transform="translate(${rightX + colWidth / 2}, ${topY + 1012})">
    <line class="flow-arrow" x1="0" y1="0" x2="0" y2="24" stroke="#10b981" marker-end="url(#arrow-teal)"/>
    <rect x="-95" y="4" width="190" height="18" rx="4" fill="#ffffff" stroke="#86efac" stroke-width="1"/>
    <text class="tag-text" x="0" y="13" text-anchor="middle" fill="#15803d">目录沙箱隔离与用完即弃生命周期</text>
  </g>
`;

  // Right 4: 本机存储资产与隔离沙箱
  svg += `
  <!-- Right Layer 4: 本机存储资产与隔离沙箱 -->
  <g transform="translate(${rightX + 16}, ${topY + 1040})">
    <rect class="card-box" x="0" y="0" width="${colWidth - 32}" height="286" fill="#ffffff" stroke="#86efac"/>
    <rect class="pill" x="14" y="12" width="168" height="22" fill="#16a34a"/>
    <text class="pill-text" x="98" y="23">4. 本机存储资产与隔离沙箱</text>
    <text class="card-title" x="192" y="23" fill="#14532d">Storage Sandbox &amp; Disposable Clean-Room</text>

    <!-- Sub Content -->
    <g transform="translate(14, 44)">
      <rect class="inner-box" x="0" y="0" width="${colWidth - 60}" height="228" fill="#f0fdf4" stroke="#bbf7d0"/>
      <text class="card-desc" x="14" y="28">• <tspan font-weight="700" fill="#14532d">Chrome 原生 Profile 目录体系：</tspan></text>
      <text class="card-desc" x="28" y="48">自动解析 Chrome <tspan class="code-text" fill="#14532d">Local State</tspan>，发现日常在用的 <tspan class="code-text" fill="#14532d">Default</tspan> 与 <tspan class="code-text" fill="#14532d">Profile 1..N</tspan>；主账号设置删除保护卡口，禁止误删</text>

      <text class="card-desc" x="14" y="78">• <tspan font-weight="700" fill="#14532d">独立测试沙箱 (--user-data-dir 物理隔离)：</tspan></text>
      <text class="card-desc" x="28" y="98">给每个测试或 Agent Profile 建立独立物理目录，彻底隔绝与日常主力浏览器的数据、缓存与 Cookie 交叉污染</text>

      <text class="card-desc" x="14" y="128">• <tspan font-weight="700" fill="#14532d">用完即弃副本池 (Disposable Clean-Room Pool)：</tspan></text>
      <text class="card-desc" x="28" y="148">QA 与 Agent 验证支持一键启动“一次性克隆”，保留源 Profile 最新登录态；</text>
      <text class="card-desc" x="28" y="168">进程退出或关闭窗口后由主进程 Reaper <tspan font-weight="700" fill="#16a34a">自动移入废纸篓彻底销毁</tspan>，确保每次自动化测试均从绝对干净一致的基线开始</text>

      <text class="card-desc" x="14" y="198">• <tspan font-weight="700" fill="#14532d">覆盖前自动安全快照 (Pre-sync Snapshot)：</tspan></text>
      <text class="card-desc" x="28" y="218">在任何账号同步或扩展覆写前，系统自动在后台创建轻量增量备份快照，支持随时秒级一键回滚防意外</text>
    </g>
  </g>
`;

  // ==========================================
  // BOTTOM SUMMARY BAR: 3 CORE WORKFLOWS
  // ==========================================
  svg += `
  <!-- Bottom Cross-cutting Flows Banner -->
  <g transform="translate(48, ${height - 62})">
    <rect x="0" y="0" width="${width - 96}" height="38" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
    <text class="badge-text" x="16" y="19" fill="#0f172a" style="font-size: 12px;">核心业务协同流线：</text>
    <text class="card-desc" x="130" y="23" fill="#1e40af">🔵 <tspan font-weight="700">透明调度流：</tspan>Agent 无感调用 ➔ Wrapper 拦截 ➔ Gateway 原子绑定空闲 Profile ➔ 签发 15s Ticket</text>
    <text class="card-desc" x="600" y="23" fill="#6d28d9">🟣 <tspan font-weight="700">受控 CDP 流：</tspan>Daemon 携票握手 ➔ 策略卡口过滤高危命令 ➔ 专用 Pipe 管道安全转发</text>
    <text class="card-desc" x="1050" y="23" fill="#b45309">🟠 <tspan font-weight="700">人机接管流：</tspan>Shadow DOM 双击接管 ➔ Park 挂起缓冲 ➔ 单例握手置顶</text>
  </g>

</svg>`;

  return svg;
}

const svgContent = generateProfilePilotArchSvg();
const outputPath = path.join(targetDir, "figure-wb-08-profilepilot-arch.svg");
fs.writeFileSync(outputPath, svgContent, "utf-8");
console.log(`Successfully generated: ${outputPath} (${svgContent.length} bytes)`);
