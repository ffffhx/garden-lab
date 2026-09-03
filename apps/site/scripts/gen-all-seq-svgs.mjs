// Generator script for all sequence diagrams in 实习答辩-冯鸿鑫
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

function getTextWidth(text) {
  let len = 0;
  for (const char of text) {
    len += char.charCodeAt(0) > 255 ? 13.5 : 7.5;
  }
  return Math.ceil(len);
}

// ==========================================
// DIAGRAM 1: figure-wb-05-benefits-3-seq.svg
// ==========================================
function generateBenefits3Seq() {
  const width = 1140;
  const height = 1280;

  const participants = [
    { id: "user", name: "用户", x: 100, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
    { id: "caller", name: "调用方 (业务功能入口)", x: 380, color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
    { id: "benefit", name: "商业化侧 (统一权益能力)", x: 700, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    { id: "backend", name: "商业化后端", x: 1000, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  ];

  const pMap = Object.fromEntries(participants.map(p => [p.id, p]));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <style>
      .bg { fill: #f8fafc; }
      .frame { fill: #ffffff; stroke: #e2e8f0; stroke-width: 1.5; }
      .title { font: 700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #0f172a; }
      .subtitle { font: 500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #64748b; }
      .p-box { rx: 8; stroke-width: 1.5; }
      .p-text { font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; text-anchor: middle; dominant-baseline: middle; }
      .lifeline { stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 6 5; }
      .msg-line { stroke: #3b82f6; stroke-width: 1.8; fill: none; }
      .msg-return { stroke: #64748b; stroke-width: 1.8; stroke-dasharray: 5 4; fill: none; }
      .msg-text { font: 500 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #1e293b; text-anchor: middle; dominant-baseline: central; }
      .msg-bg { fill: #ffffff; rx: 4; stroke: #e2e8f0; stroke-width: 1; }
      .section-banner { fill: #fff7ed; stroke: #fdba74; stroke-width: 1.5; rx: 6; }
      .section-title { font: 700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #c2410c; dominant-baseline: central; }
      .alt-frame { fill: #f8fafc; stroke: #94a3b8; stroke-width: 1.2; rx: 6; }
      .alt-badge { font: 700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; fill: #ffffff; dominant-baseline: central; text-anchor: middle; }
      .alt-cond { font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #334155; dominant-baseline: central; }
      .divider { stroke: #cbd5e1; stroke-width: 1; stroke-dasharray: 4 4; }
    </style>

    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6"/>
    </marker>
    <marker id="arrow-return" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 1 2 L 7 5 L 1 8" fill="none" stroke="#64748b" stroke-width="1.8" stroke-linecap="round"/>
    </marker>
    <marker id="arrow-self" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6"/>
    </marker>
  </defs>

  <rect class="bg" width="${width}" height="${height}" rx="16"/>
  <rect class="frame" x="16" y="16" width="${width - 32}" height="${height - 32}" rx="14"/>

  <text class="title" x="48" y="58">商业化权益 3.0：跨端无头拦截与推导时序图</text>
  <text class="subtitle" x="48" y="84">业务逻辑与 UI 视图彻底解耦 · 统一判断与套餐推导 · 调用方仅传权益类型与新增量</text>
`;

  const topY = 145;
  const bottomY = height - 75;

  participants.forEach(p => {
    svg += `  <line class="lifeline" x1="${p.x}" y1="${topY}" x2="${p.x}" y2="${bottomY}"/>\n`;
  });

  participants.forEach(p => {
    const boxW = 160;
    const boxH = 38;
    svg += `
    <rect class="p-box" x="${p.x - boxW/2}" y="${topY - boxH}" width="${boxW}" height="${boxH}" fill="${p.bg}" stroke="${p.border}"/>
    <text class="p-text" x="${p.x}" y="${topY - boxH/2 + 1}" fill="${p.color}">${p.name}</text>`;
  });

  function msg(fromId, toId, y, text, isReturn = false) {
    const x1 = pMap[fromId].x;
    const x2 = pMap[toId].x;
    const textX = (x1 + x2) / 2;
    const lineClass = isReturn ? "msg-return" : "msg-line";
    const marker = isReturn ? "url(#arrow-return)" : "url(#arrow)";
    const targetX = x1 < x2 ? x2 - 2 : x2 + 2;

    const tw = getTextWidth(text);
    const padW = tw + 18;
    const padH = 22;

    return `
    <line class="${lineClass}" x1="${x1}" y1="${y}" x2="${targetX}" y2="${y}" marker-end="${marker}"/>
    <rect class="msg-bg" x="${textX - padW/2}" y="${y - padH/2}" width="${padW}" height="${padH}"/>
    <text class="msg-text" x="${textX}" y="${y}">${text}</text>`;
  }

  function selfLoop(pId, y, text) {
    const x = pMap[pId].x;
    const loopW = 38;
    const loopH = 34;
    const tw = getTextWidth(text);
    const padW = tw + 16;
    return `
    <path class="msg-line" d="M ${x} ${y} C ${x + loopW} ${y - 4}, ${x + loopW} ${y + loopH + 4}, ${x + 3} ${y + loopH}" marker-end="url(#arrow-self)"/>
    <rect class="msg-bg" x="${x + loopW + 6}" y="${y + loopH/2 - 11}" width="${padW}" height="22"/>
    <text class="msg-text" style="text-anchor: start;" x="${x + loopW + 14}" y="${y + loopH/2}">${text}</text>`;
  }

  svg += msg("user", "caller", 200, "触发受权益管控的操作");
  svg += msg("caller", "benefit", 245, "useBenefitCheck (权益类型, 本次新增量, 当前使用量)");
  svg += msg("benefit", "backend", 290, "查询套餐等级 / 权益策略 / 权益额度");
  svg += msg("backend", "benefit", 335, "返回套餐权益数据", true);
  svg += selfLoop("benefit", 365, "统一权益判断：当前使用量 + 新增量 ≤ 权益额度？");

  const altTop = 425;
  const altBottom = 1115;
  svg += `
    <rect class="alt-frame" x="48" y="${altTop}" width="${width - 96}" height="${altBottom - altTop}"/>
    <rect x="48" y="${altTop}" width="42" height="24" rx="4" fill="#475569"/>
    <text class="alt-badge" x="69" y="${altTop + 12}">alt</text>

    <text class="alt-cond" x="100" y="${altTop + 12}">[权益可用]</text>
  `;

  svg += msg("benefit", "caller", 475, "权益可用（未达上限）", true);
  svg += msg("caller", "user", 520, "继续执行原操作", true);

  const divY = 560;
  svg += `
    <line class="divider" x1="48" y1="${divY}" x2="${width - 48}" y2="${divY}"/>
    <text class="alt-cond" x="100" y="${divY + 16}">[权益不足：拦截与推荐]</text>
  `;

  svg += selfLoop("benefit", 595, "套餐推导：按缺口自动推荐满足新增量的目标套餐");
  svg += msg("benefit", "user", 665, "弹出权益拦截弹窗（权益文案由商业化集中管理）");
  svg += msg("user", "benefit", 710, "用户确认升级");
  svg += msg("benefit", "user", 755, "弹出专属支付弹窗，引导完成购买");
  svg += msg("user", "benefit", 800, "完成支付（支付成功回调）");
  svg += msg("benefit", "backend", 845, "刷新 / 重新同步最新权益额度");
  svg += msg("benefit", "caller", 890, "权益已生效（放行操作）", true);
  svg += msg("caller", "user", 935, "继续（重试）原操作", true);

  svg += `
    <g transform="translate(68, 990)">
      <rect class="section-banner" x="0" y="0" width="${width - 136}" height="34"/>
      <text class="section-title" x="18" y="17">扩容类权益：可用性由业务方后端自行判断，商业化侧只收口统一拦截弹窗与支付流程</text>
    </g>
  `;

  participants.forEach(p => {
    const boxW = 160;
    const boxH = 34;
    svg += `
    <rect class="p-box" x="${p.x - boxW/2}" y="${bottomY}" width="${boxW}" height="${boxH}" fill="${p.bg}" stroke="${p.border}"/>
    <text class="p-text" x="${p.x}" y="${bottomY + boxH/2 + 1}" fill="${p.color}">${p.name}</text>`;
  });

  svg += "\n</svg>\n";
  fs.writeFileSync(path.join(targetDir, "figure-wb-05-benefits-3-seq.svg"), svg, "utf-8");
  console.log("Successfully generated: figure-wb-05-benefits-3-seq.svg");
}

// ==========================================
// DIAGRAM 2: figure-wb-06-account-seq.svg
// ==========================================
function generateAccountSeq() {
  const width = 1320;
  const height = 1860;

  const participants = [
    { id: "user", name: "用户 / Agent", x: 110, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
    { id: "plugin", name: "Chrome 插件", x: 285, color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
    { id: "stone", name: "Stone (前端)", x: 460, color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
    { id: "oauth", name: "ByteCloud OAuth", x: 645, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    { id: "kani", name: "Kani (权限服务)", x: 815, color: "#0d9488", bg: "#f0fdf4", border: "#bbf7d0" },
    { id: "session", name: "Session 服务", x: 975, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    { id: "coze", name: "Coze 页面", x: 1130, color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  ];

  const pMap = Object.fromEntries(participants.map(p => [p.id, p]));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <style>
      .bg { fill: #f8fafc; }
      .frame { fill: #ffffff; stroke: #e2e8f0; stroke-width: 1.5; }
      .title { font: 700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #0f172a; }
      .subtitle { font: 500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #64748b; }
      .p-box { rx: 8; stroke-width: 1.5; }
      .p-text { font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; text-anchor: middle; dominant-baseline: middle; }
      .lifeline { stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 6 5; }
      .msg-line { stroke: #3b82f6; stroke-width: 1.8; fill: none; }
      .msg-return { stroke: #64748b; stroke-width: 1.8; stroke-dasharray: 5 4; fill: none; }
      .msg-text { font: 500 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #1e293b; text-anchor: middle; dominant-baseline: central; }
      .msg-bg { fill: #ffffff; rx: 4; stroke: #e2e8f0; stroke-width: 1; }
      .section-banner { fill: #fff7ed; stroke: #fdba74; stroke-width: 1.5; rx: 6; }
      .section-title { font: 700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #c2410c; dominant-baseline: central; }
      .alt-frame { fill: #f8fafc; stroke: #94a3b8; stroke-width: 1.2; rx: 6; }
      .alt-subframe { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1; rx: 5; }
      .alt-badge { font: 700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; fill: #ffffff; dominant-baseline: central; text-anchor: middle; }
      .alt-cond { font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #334155; dominant-baseline: central; }
      .divider { stroke: #cbd5e1; stroke-width: 1; stroke-dasharray: 4 4; }
      .note-box { fill: #fef3c7; stroke: #f59e0b; stroke-width: 1.5; rx: 6; }
      .note-text { font: 600 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #b45309; text-anchor: middle; dominant-baseline: central; }
      .success-text { font: 700 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #16a34a; text-anchor: middle; dominant-baseline: central; }
      .fail-text { font: 700 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #dc2626; text-anchor: middle; dominant-baseline: central; }
    </style>

    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6"/>
    </marker>
    <marker id="arrow-return" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 1 2 L 7 5 L 1 8" fill="none" stroke="#64748b" stroke-width="1.8" stroke-linecap="round"/>
    </marker>
    <marker id="arrow-self" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6"/>
    </marker>
  </defs>

  <rect class="bg" width="${width}" height="${height}" rx="16"/>
  <rect class="frame" x="16" y="16" width="${width - 32}" height="${height - 32}" rx="14"/>

  <text class="title" x="48" y="58">账号切换工具链：鉴权与切换时序图</text>
  <text class="subtitle" x="48" y="84">双重身份校验（ByteCloud OAuth + Kani）· 业务 Token 换 Session · 飞书静默无感复用</text>
`;

  const topY = 145;
  const bottomY = height - 85;

  participants.forEach(p => {
    svg += `  <line class="lifeline" x1="${p.x}" y1="${topY}" x2="${p.x}" y2="${bottomY}"/>\n`;
  });

  participants.forEach(p => {
    const boxW = 132;
    const boxH = 38;
    svg += `
    <rect class="p-box" x="${p.x - boxW/2}" y="${topY - boxH}" width="${boxW}" height="${boxH}" fill="${p.bg}" stroke="${p.border}"/>
    <text class="p-text" x="${p.x}" y="${topY - boxH/2 + 1}" fill="${p.color}">${p.name}</text>`;
  });

  function msg(fromId, toId, y, text, isReturn = false) {
    const x1 = pMap[fromId].x;
    const x2 = pMap[toId].x;
    const textX = (x1 + x2) / 2;
    const lineClass = isReturn ? "msg-return" : "msg-line";
    const marker = isReturn ? "url(#arrow-return)" : "url(#arrow)";
    const targetX = x1 < x2 ? x2 - 2 : x2 + 2;

    const tw = getTextWidth(text);
    const padW = tw + 18;
    const padH = 22;

    return `
    <line class="${lineClass}" x1="${x1}" y1="${y}" x2="${targetX}" y2="${y}" marker-end="${marker}"/>
    <rect class="msg-bg" x="${textX - padW/2}" y="${y - padH/2}" width="${padW}" height="${padH}"/>
    <text class="msg-text" x="${textX}" y="${y}">${text}</text>`;
  }

  function selfLoop(pId, y, text) {
    const x = pMap[pId].x;
    const loopW = 38;
    const loopH = 34;
    const tw = getTextWidth(text);
    const padW = tw + 16;
    return `
    <path class="msg-line" d="M ${x} ${y} C ${x + loopW} ${y - 4}, ${x + loopW} ${y + loopH + 4}, ${x + 3} ${y + loopH}" marker-end="url(#arrow-self)"/>
    <rect class="msg-bg" x="${x + loopW + 6}" y="${y + loopH/2 - 11}" width="${padW}" height="22"/>
    <text class="msg-text" style="text-anchor: start;" x="${x + loopW + 14}" y="${y + loopH/2}">${text}</text>`;
  }

  function banner(y, title) {
    return `
    <g transform="translate(48, ${y})">
      <rect class="section-banner" x="0" y="0" width="${width - 96}" height="32"/>
      <text class="section-title" x="18" y="16">${title}</text>
    </g>`;
  }

  svg += banner(160, "一、获取业务 Token（首次登录 / Token 失效时）");
  svg += msg("user", "plugin", 220, "发起鉴权");
  svg += msg("plugin", "stone", 262, "请求鉴权");
  svg += msg("stone", "oauth", 304, "ByteCloud OAuth 授权重定向");
  svg += msg("oauth", "user", 346, "弹出 OAuth 授权页面 / 确认提示", true);
  svg += msg("user", "oauth", 388, "确认授权（使用企业员工账号）");
  svg += msg("oauth", "stone", 430, "返回员工身份凭证（OAuth Code / Token）", true);
  svg += msg("stone", "kani", 472, "校验员工 Coze 内部业务权限");
  svg += msg("kani", "stone", 514, "鉴权通过（具备对应项目权限）", true);
  svg += msg("stone", "plugin", 556, "签发业务 Token（含过期时间）", true);

  svg += `
    <rect class="note-box" x="${pMap.plugin.x - 90}" y="586" width="180" height="28"/>
    <text class="note-text" x="${pMap.plugin.x}" y="600">仅持有受限业务 Token</text>
  `;

  svg += banner(638, "二、账号切换与环境校验");
  svg += msg("user", "plugin", 698, "选择操作：切回本人账号 / 切换测试账号");

  const outerAltTop = 735;
  const outerAltBottom = 1715;
  svg += `
    <rect class="alt-frame" x="48" y="${outerAltTop}" width="${width - 96}" height="${outerAltBottom - outerAltTop}"/>
    <rect x="48" y="${outerAltTop}" width="42" height="24" rx="4" fill="#475569"/>
    <text class="alt-badge" x="69" y="${outerAltTop + 12}">alt</text>

    <text class="alt-cond" x="100" y="${outerAltTop + 12}">[切回本人账号]</text>
  `;

  svg += msg("plugin", "coze", 780, "Tab 跳转 Coze 页面（携带 prompt=none）");
  svg += selfLoop("coze", 806, "复用飞书登录态（静默登录）");
  svg += msg("coze", "user", 874, "完成切换（恢复为本人身份）", true);

  const div1Y = 910;
  svg += `
    <line class="divider" x1="48" y1="${div1Y}" x2="${width - 48}" y2="${div1Y}"/>
    <text class="alt-cond" x="100" y="${div1Y + 16}">[切换测试账号]</text>
  `;

  svg += msg("user", "plugin", 955, "选择目标测试账号");
  svg += msg("plugin", "coze", 998, "检查当前已登录账号信息");

  const nestAltTop = 1035;
  const nestAltBottom = 1690;
  svg += `
    <rect class="alt-subframe" x="66" y="${nestAltTop}" width="${width - 132}" height="${nestAltBottom - nestAltTop}"/>
    <rect x="66" y="${nestAltTop}" width="42" height="22" rx="4" fill="#64748b"/>
    <text class="alt-badge" x="87" y="${nestAltTop + 11}">alt</text>

    <text class="alt-cond" x="118" y="${nestAltTop + 11}">[已是目标账号]</text>
  `;

  svg += msg("plugin", "user", 1080, "当前已在该测试账号下，直接完成", true);

  const div2Y = 1118;
  svg += `
    <line class="divider" x1="66" y1="${div2Y}" x2="${width - 66}" y2="${div2Y}"/>
    <text class="alt-cond" x="118" y="${div2Y + 15}">[非目标账号：执行 Cookie 换绑]</text>
  `;

  svg += msg("plugin", "stone", 1162, "请求目标账号 Session（携带业务 Token）");
  svg += msg("stone", "session", 1206, "通过测试 UID 换取合法 Session");
  svg += msg("session", "stone", 1250, "返回有效 Session 数据", true);
  svg += msg("stone", "plugin", 1294, "返回目标账号 Session 凭证", true);
  svg += msg("plugin", "coze", 1338, "替换目标 Cookie（注入 Coze Session Cookie）");
  svg += msg("plugin", "coze", 1382, "触发页面刷新 / 校验当前账号、所属企业与权限");

  const subSubAltTop = 1422;
  const subSubAltBottom = 1665;
  svg += `
    <rect class="alt-frame" style="fill: #ffffff; stroke: #cbd5e1;" x="84" y="${subSubAltTop}" width="${width - 168}" height="${subSubAltBottom - subSubAltTop}"/>
    <rect x="84" y="${subSubAltTop}" width="38" height="20" rx="3" fill="#94a3b8"/>
    <text class="alt-badge" style="font-size: 11px;" x="103" y="${subSubAltTop + 10}">alt</text>

    <text class="alt-cond" x="132" y="${subSubAltTop + 10}">[校验一致]</text>
  `;

  svg += `
    <line class="msg-return" style="stroke: #16a34a;" x1="${pMap.plugin.x}" y1="1485" x2="${pMap.user.x + 2}" y2="1485" marker-end="url(#arrow-return)"/>
    <rect class="msg-bg" style="stroke: #bbf7d0; fill: #f0fdf4;" x="120" y="1472" width="156" height="26"/>
    <text class="success-text" x="198" y="1485">✅ 切换成功 (耗时 &lt;10s)</text>
  `;

  const div3Y = 1545;
  svg += `
    <line class="divider" x1="84" y1="${div3Y}" x2="${width - 84}" y2="${div3Y}"/>
    <text class="alt-cond" x="132" y="${div3Y + 15}">[不一致 / Session 失效]</text>
  `;

  svg += `
    <line class="msg-return" style="stroke: #dc2626;" x1="${pMap.plugin.x}" y1="1610" x2="${pMap.user.x + 2}" y2="1610" marker-end="url(#arrow-return)"/>
    <rect class="msg-bg" style="stroke: #fecaca; fill: #fef2f2;" x="110" y="1597" width="176" height="26"/>
    <text class="fail-text" x="198" y="1610">❌ 切换失败，提示重新授权</text>
  `;

  participants.forEach(p => {
    const boxW = 132;
    const boxH = 34;
    svg += `
    <rect class="p-box" x="${p.x - boxW/2}" y="${bottomY}" width="${boxW}" height="${boxH}" fill="${p.bg}" stroke="${p.border}"/>
    <text class="p-text" x="${p.x}" y="${bottomY + boxH/2 + 1}" fill="${p.color}">${p.name}</text>`;
  });

  svg += "\n</svg>\n";
  fs.writeFileSync(path.join(targetDir, "figure-wb-06-account-seq.svg"), svg, "utf-8");
  console.log("Successfully generated: figure-wb-06-account-seq.svg");
}

// ==========================================
// DIAGRAM 3: figure-wb-07-profilepilot-seq.svg
// ==========================================
function generateProfilePilotSeq() {
  const width = 1380;
  const height = 1860;

  const participants = [
    { id: "agent", name: "Agent (Codex/Claude Code)", x: 120, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
    { id: "env", name: "~/.zshenv (环境层)", x: 340, color: "#64748b", bg: "#f8fafc", border: "#cbd5e1" },
    { id: "wrapper", name: "agent-browser Wrapper", x: 560, color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
    { id: "daemon", name: "agent-browser Daemon", x: 780, color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
    { id: "gateway", name: "Gateway (租约权威)", x: 1010, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    { id: "chrome", name: "真实 Chrome Profile", x: 1240, color: "#0d9488", bg: "#f0fdf4", border: "#bbf7d0" },
  ];

  const pMap = Object.fromEntries(participants.map(p => [p.id, p]));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <style>
      .bg { fill: #f8fafc; }
      .frame { fill: #ffffff; stroke: #e2e8f0; stroke-width: 1.5; }
      .title { font: 700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #0f172a; }
      .subtitle { font: 500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #64748b; }
      .p-box { rx: 8; stroke-width: 1.5; }
      .p-text { font: 600 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; text-anchor: middle; dominant-baseline: middle; }
      .lifeline { stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 6 5; }
      .msg-line { stroke: #3b82f6; stroke-width: 1.8; fill: none; }
      .msg-return { stroke: #64748b; stroke-width: 1.8; stroke-dasharray: 5 4; fill: none; }
      .msg-text { font: 500 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #1e293b; text-anchor: middle; dominant-baseline: central; }
      .msg-bg { fill: #ffffff; rx: 4; stroke: #e2e8f0; stroke-width: 1; }
      .section-banner { fill: #fff7ed; stroke: #fdba74; stroke-width: 1.5; rx: 6; }
      .section-title { font: 700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #c2410c; dominant-baseline: central; }
      .alt-frame { fill: #f8fafc; stroke: #94a3b8; stroke-width: 1.2; rx: 6; }
      .opt-frame { fill: #f0fdf4; stroke: #86efac; stroke-width: 1.2; rx: 6; }
      .loop-frame { fill: #f5f3ff; stroke: #c4b5fd; stroke-width: 1.2; rx: 6; }
      .alt-badge { font: 700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; fill: #ffffff; dominant-baseline: central; text-anchor: middle; }
      .alt-cond { font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #334155; dominant-baseline: central; }
      .divider { stroke: #cbd5e1; stroke-width: 1; stroke-dasharray: 4 4; }
    </style>

    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6"/>
    </marker>
    <marker id="arrow-return" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 1 2 L 7 5 L 1 8" fill="none" stroke="#64748b" stroke-width="1.8" stroke-linecap="round"/>
    </marker>
    <marker id="arrow-self" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6"/>
    </marker>
  </defs>

  <rect class="bg" width="${width}" height="${height}" rx="16"/>
  <rect class="frame" x="16" y="16" width="${width - 32}" height="${height - 32}" rx="14"/>

  <text class="title" x="48" y="58">ProfilePilot：多 Agent 调度与受控 CDP 通信时序图</text>
  <text class="subtitle" x="48" y="84">Gateway 集中管理 Chrome Profile 租约 · 一次性 Ticket 防篡改 · 独立 Pipe 转发 · 人机无缝暂停与接管</text>
`;

  const topY = 145;
  const bottomY = height - 75;

  participants.forEach(p => {
    svg += `  <line class="lifeline" x1="${p.x}" y1="${topY}" x2="${p.x}" y2="${bottomY}"/>\n`;
  });

  participants.forEach(p => {
    const boxW = 168;
    const boxH = 38;
    svg += `
    <rect class="p-box" x="${p.x - boxW/2}" y="${topY - boxH}" width="${boxW}" height="${boxH}" fill="${p.bg}" stroke="${p.border}"/>
    <text class="p-text" x="${p.x}" y="${topY - boxH/2 + 1}" fill="${p.color}">${p.name}</text>`;
  });

  function msg(fromId, toId, y, text, isReturn = false) {
    const x1 = pMap[fromId].x;
    const x2 = pMap[toId].x;
    const textX = (x1 + x2) / 2;
    const lineClass = isReturn ? "msg-return" : "msg-line";
    const marker = isReturn ? "url(#arrow-return)" : "url(#arrow)";
    const targetX = x1 < x2 ? x2 - 2 : x2 + 2;

    const tw = getTextWidth(text);
    const padW = tw + 18;
    const padH = 22;

    return `
    <line class="${lineClass}" x1="${x1}" y1="${y}" x2="${targetX}" y2="${y}" marker-end="${marker}"/>
    <rect class="msg-bg" x="${textX - padW/2}" y="${y - padH/2}" width="${padW}" height="${padH}"/>
    <text class="msg-text" x="${textX}" y="${y}">${text}</text>`;
  }

  function selfLoop(pId, y, text) {
    const x = pMap[pId].x;
    const loopW = 38;
    const loopH = 34;
    const tw = getTextWidth(text);
    const padW = tw + 16;
    return `
    <path class="msg-line" d="M ${x} ${y} C ${x + loopW} ${y - 4}, ${x + loopW} ${y + loopH + 4}, ${x + 3} ${y + loopH}" marker-end="url(#arrow-self)"/>
    <rect class="msg-bg" x="${x + loopW + 6}" y="${y + loopH/2 - 11}" width="${padW}" height="22"/>
    <text class="msg-text" style="text-anchor: start;" x="${x + loopW + 14}" y="${y + loopH/2}">${text}</text>`;
  }

  svg += msg("env", "agent", 195, "注入 AGENT_BROWSER_SESSION=cc-xxx（Agent 零感知）", true);
  svg += msg("agent", "wrapper", 240, "agent-browser --cdp 9223 open ... (不带 --session)");
  svg += selfLoop("wrapper", 270, "解析 session=cc-xxx + requestedPort=9223");
  svg += msg("wrapper", "gateway", 335, "acquire(requestedPort=9223, session, autoSwitch=true)");
  svg += selfLoop("gateway", 365, "读取目标 Profile 与候选备用配置");

  const alt1Top = 425;
  const alt1Bottom = 665;
  svg += `
    <rect class="alt-frame" x="48" y="${alt1Top}" width="${width - 96}" height="${alt1Bottom - alt1Top}"/>
    <rect x="48" y="${alt1Top}" width="42" height="24" rx="4" fill="#475569"/>
    <text class="alt-badge" x="69" y="${alt1Top + 12}">alt</text>

    <text class="alt-cond" x="100" y="${alt1Top + 12}">[目标 Profile 空闲]</text>
  `;

  svg += selfLoop("gateway", 460, "原子绑定 9223 ↔ cc-xxx");

  const div1 = 510;
  svg += `
    <line class="divider" x1="48" y1="${div1}" x2="${width - 48}" y2="${div1}"/>
    <text class="alt-cond" x="100" y="${div1 + 16}">[目标 Profile 被占用，且有可用候选]</text>
  `;
  svg += selfLoop("gateway", 540, "自动选择可用候选并原子绑定（无需用户确认）");

  const div2 = 590;
  svg += `
    <line class="divider" x1="48" y1="${div2}" x2="${width - 48}" y2="${div2}"/>
    <text class="alt-cond" x="100" y="${div2 + 16}">[目标 Profile 被占用，且无可用候选]</text>
  `;
  svg += msg("gateway", "wrapper", 635, "返回 PROFILE_ALREADY_IN_USE（阻断执行）", true);

  svg += `
    <g transform="translate(48, 680)">
      <rect class="section-banner" x="0" y="0" width="${width - 96}" height="32"/>
      <text class="section-title" x="18" y="16">以下步骤仅在 Gateway 成功建立租约后继续</text>
    </g>
  `;

  const optTop = 728;
  const optBottom = 810;
  svg += `
    <rect class="opt-frame" x="48" y="${optTop}" width="${width - 96}" height="${optBottom - optTop}"/>
    <rect x="48" y="${optTop}" width="42" height="24" rx="4" fill="#16a34a"/>
    <text class="alt-badge" x="69" y="${optTop + 12}">opt</text>
    <text class="alt-cond" style="fill: #166534;" x="100" y="${optTop + 12}">[选中的 Chrome Profile 未启动]</text>
  `;
  svg += msg("gateway", "chrome", 772, "spawn 浏览器（--remote-debugging-pipe 独占，无真实对外开放端口）");

  svg += msg("gateway", "wrapper", 845, "返回 chosenProfile + 一次性 Ticket + wsUrl", true);
  svg += msg("wrapper", "daemon", 890, "启动或复用 daemon，传入 wsUrl");
  svg += msg("daemon", "gateway", 935, "WebSocket 握手（携带 Ticket）");
  svg += selfLoop("gateway", 965, "校验 Ticket（签名有效性 / 防过期 / 防重放）");
  svg += msg("wrapper", "daemon", 1030, "执行当前指令");

  const loopTop = 1075;
  const loopBottom = 1250;
  svg += `
    <rect class="loop-frame" x="48" y="${loopTop}" width="${width - 96}" height="${loopBottom - loopTop}"/>
    <rect x="48" y="${loopTop}" width="46" height="24" rx="4" fill="#7c3aed"/>
    <text class="alt-badge" x="71" y="${loopTop + 12}">loop</text>
    <text class="alt-cond" style="fill: #5b21b6;" x="104" y="${loopTop + 12}">[当前命令产生的每条 CDP 消息]</text>
  `;
  svg += msg("daemon", "gateway", 1120, "发送 CDP 原始请求");
  svg += selfLoop("gateway", 1148, "校验 Session 控制权 + 控制代次 (Generation)");
  svg += msg("gateway", "chrome", 1215, "通过 Dedicated Pipe 转发执行");

  svg += `
    <g transform="translate(48, 1270)">
      <rect class="section-banner" x="0" y="0" width="${width - 96}" height="32"/>
      <text class="section-title" x="18" y="16">用户接管 → park（保持长连 · 拦截命令 · 缓存事件）；交还 → resume（Agent 重新 snapshot）</text>
    </g>
  `;

  const alt2Top = 1320;
  const alt2Bottom = 1500;
  svg += `
    <rect class="alt-frame" x="48" y="${alt2Top}" width="${width - 96}" height="${alt2Bottom - alt2Top}"/>
    <rect x="48" y="${alt2Top}" width="42" height="24" rx="4" fill="#475569"/>
    <text class="alt-badge" x="69" y="${alt2Top + 12}">alt</text>

    <text class="alt-cond" x="100" y="${alt2Top + 12}">[任务正常完成]</text>
  `;
  svg += msg("agent", "wrapper", 1365, "agent-browser profilepilot complete");

  const div3 = 1410;
  svg += `
    <line class="divider" x1="48" y1="${div3}" x2="${width - 48}" y2="${div3}"/>
    <text class="alt-cond" x="100" y="${div3 + 16}">[明确放弃任务]</text>
  `;
  svg += msg("agent", "wrapper", 1455, "agent-browser profilepilot release");

  svg += msg("wrapper", "gateway", 1545, "通知结束 Session 并释放 Profile 租约");
  svg += msg("wrapper", "daemon", 1590, "结束 daemon 进程");

  participants.forEach(p => {
    const boxW = 168;
    const boxH = 34;
    svg += `
    <rect class="p-box" x="${p.x - boxW/2}" y="${bottomY}" width="${boxW}" height="${boxH}" fill="${p.bg}" stroke="${p.border}"/>
    <text class="p-text" x="${p.x}" y="${bottomY + boxH/2 + 1}" fill="${p.color}">${p.name}</text>`;
  });

  svg += "\n</svg>\n";
  fs.writeFileSync(path.join(targetDir, "figure-wb-07-profilepilot-seq.svg"), svg, "utf-8");
  console.log("Successfully generated: figure-wb-07-profilepilot-seq.svg");
}

generateBenefits3Seq();
generateAccountSeq();
generateProfilePilotSeq();
