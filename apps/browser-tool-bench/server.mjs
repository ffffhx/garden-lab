// 浏览器 Agent 工具对比靶场服务。
// 零依赖纯 Node，所有"故障"都是故意埋的，标准答案见 tasks/ 目录。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 4399);
const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

// ---- 测试账号（任务卡 T01 使用）----
const ACCOUNT = { email: "agent@bench.dev", password: "bench-2026" };
const PROFILE = { user: "Agent 测试员", badge: "BENCH-7341", plan: "team-pro-2026" };

// ---- 故意延迟的静态资源（任务卡 T03 性能诊断的根因）----
const ASSET_DELAYS = {
  "/assets/blocking.css": 1200, // 渲染阻塞 CSS
  "/assets/hero.svg": 1500, // LCP 图片
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const sessions = new Map();

// ---- 数据：商品（T06 结构化提取的 ground truth 来源）----
const PRODUCTS = [
  { id: 1, name: "静音机械键盘", price: 399, stock: 23 },
  { id: 2, name: "4K 专业显示器", price: 2499, stock: 7 },
  { id: 3, name: "人体工学椅", price: 1899, stock: 0 },
  { id: 4, name: "降噪耳机 Pro", price: 899, stock: 41 },
  { id: 5, name: "便携 SSD 1TB", price: 749, stock: 16 },
  { id: 6, name: "桌面监听音箱", price: 1299, stock: 5 },
  { id: 7, name: "智能护眼台灯", price: 329, stock: 88 },
  { id: 8, name: "电竞鼠标", price: 459, stock: 0 },
  { id: 9, name: "雷霆工作站", price: 15999, stock: 2 },
  { id: 10, name: "全画幅扫描仪", price: 3699, stock: 3 },
  { id: 11, name: "USB-C 扩展坞", price: 549, stock: 64 },
  { id: 12, name: "会议级摄像头", price: 1599, stock: 11 },
];

// ---- 数据：动态流（T05 动态等待的 ground truth 来源）----
const FEED_PAGE_1 = [
  "小林 发布了新文档《季度复盘》",
  "构建流水线 #4821 通过",
  "阿芳 评论了你的合并请求",
  "监控告警已恢复：api-gateway 延迟",
  "新成员 莫莫 加入了团队",
  "周报机器人推送了上周摘要",
  "设计稿《新版首页》更新到 v7",
  "数据库备份任务完成",
];
const FEED_PAGE_2 = [
  "老张 关闭了工单 #233",
  "灰度发布已扩量到 50%",
  "客服值班表已更新",
  "系统公告：今日口令 LIVE-512",
];

// ---- 数据：用户列表（T04 mock 请求的对象）----
const USERS = Array.from({ length: 18 }, (_, i) => ({
  id: i + 1,
  name: `成员${String(i + 1).padStart(2, "0")}`,
  role: i === 0 ? "管理员" : i % 5 === 0 ? "维护者" : "成员",
  joined: `2025-${String((i % 12) + 1).padStart(2, "0")}-0${(i % 9) + 1}`,
}));

// ---- 数据：前端调试扩展任务的 ground truth 来源（T15/T16/T20）----
const REALTIME_EVENTS = [
  { id: "evt-001", type: "connected", message: "SSE 通道已建立" },
  { id: "evt-002", type: "metric", name: "checkout_latency_ms", value: 184 },
  { id: "evt-003", type: "metric", name: "cart_items", value: 3 },
  { id: "evt-004", type: "notice", message: "库存同步完成" },
  { id: "evt-005", type: "alert", severity: "critical", code: "STREAM-721", message: "支付通道抖动" },
];

const LIVE_SETTINGS = {
  theme: "green",
  release: "live-2026.06",
  featureFlag: "CACHE-BUST-42",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function getSession(req) {
  const sid = parseCookies(req).sid;
  return sid ? sessions.get(sid) : undefined;
}

function sendJSON(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf-8");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

async function serveStatic(res, urlPath) {
  const file = urlPath === "/" ? "/index.html" : urlPath;
  const full = normalize(join(PUBLIC_DIR, file));
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const data = await readFile(full.includes(".") ? full : `${full}.html`);
    const ext = extname(full) || ".html";
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>页面不存在，回 <a href='/'>首页</a></p>");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ---- API ----
  if (path === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    await sleep(250);
    if (body.email === ACCOUNT.email && body.password === ACCOUNT.password) {
      const sid = randomBytes(16).toString("hex");
      sessions.set(sid, { ...PROFILE, loginAt: new Date().toISOString() });
      sendJSON(res, 200, { ok: true }, { "Set-Cookie": `sid=${sid}; HttpOnly; Path=/; SameSite=Lax` });
    } else {
      sendJSON(res, 401, { error: "INVALID_CREDENTIALS", message: "邮箱或密码错误" });
    }
    return;
  }

  if (path === "/api/me") {
    const session = getSession(req);
    if (!session) return sendJSON(res, 401, { error: "UNAUTHORIZED", message: "未登录" });
    return sendJSON(res, 200, session);
  }

  // T02：固定失败的下单接口。页面上只显示笼统的错误文案，
  // 真实原因只能从这个 500 响应体里看到。
  if (path === "/api/orders" && req.method === "POST") {
    if (!getSession(req)) return sendJSON(res, 401, { error: "UNAUTHORIZED", message: "未登录" });
    await sleep(300);
    return sendJSON(res, 500, {
      error: "INSUFFICIENT_INVENTORY",
      message: "SKU-8821 库存不足，剩余 0 件",
      traceId: `tr-${randomBytes(6).toString("hex")}`,
    });
  }

  if (path === "/api/users") {
    await sleep(400);
    return sendJSON(res, 200, { users: USERS });
  }

  if (path === "/api/feed") {
    const page = url.searchParams.get("page") === "2" ? FEED_PAGE_2 : FEED_PAGE_1;
    await sleep(300);
    return sendJSON(res, 200, { items: page, hasMore: page === FEED_PAGE_1 });
  }

  if (path === "/api/products") {
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = 8;
    await sleep(200);
    return sendJSON(res, 200, {
      page,
      total: PRODUCTS.length,
      items: PRODUCTS.slice((page - 1) * pageSize, page * pageSize),
      hasMore: page * pageSize < PRODUCTS.length,
    });
  }

  if (path === "/api/settings") {
    await sleep(150);
    return sendJSON(res, 200, LIVE_SETTINGS, { "Cache-Control": "no-store" });
  }

  if (path === "/api/flake-check") {
    const run = Number(url.searchParams.get("run") || 0);
    await sleep(80);
    return sendJSON(res, 200, {
      run,
      ok: run > 0 && run % 3 !== 0,
      code: "FLAKE-307",
    });
  }

  if (path === "/api/realtime-events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    for (const event of REALTIME_EVENTS) {
      await sleep(220);
      res.write(`id: ${event.id}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
    return;
  }

  // ---- 需要登录的页面 ----
  if (path === "/dashboard") {
    if (!getSession(req)) {
      res.writeHead(302, { Location: "/login" }).end();
      return;
    }
  }

  // ---- 故意延迟的静态资源（T03）----
  if (ASSET_DELAYS[path]) await sleep(ASSET_DELAYS[path]);

  await serveStatic(res, path);
});

server.listen(PORT, () => {
  console.log(`browser-tool-bench 靶场已启动: http://localhost:${PORT}`);
  console.log(`测试账号: ${ACCOUNT.email} / ${ACCOUNT.password}`);
});
