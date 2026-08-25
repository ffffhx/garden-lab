import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  clearSessionCookie,
  createOAuthState,
  createWebSessionToken,
  exchangeGithubCode,
  fetchGithubUser,
  isGithubLoginAllowed,
  readIdentityFromRequest,
  sanitizeReturnTo,
  setSessionCookie,
  verifyOAuthState,
} from "./auth.js";
import { CONFIG } from "./config.js";
import { handlePrivateBlog } from "./private-blog.js";
import { handleArticleChat, handleExplainSelection } from "./selection-explainer.js";
import {
  handleCreateSnapshot,
  handleDeleteSnapshot,
  handleGetSnapshot,
} from "./snapshot-storage.js";

function getPublicBaseUrl(req: IncomingMessage): string {
  if (CONFIG.PUBLIC_URL) {
    return CONFIG.PUBLIC_URL;
  }
  const host = req.headers.host || `localhost:${CONFIG.PORT}`;
  const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  return `${protocol}://${host}`;
}

function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    return false;
  }

  const isAllowed =
    CONFIG.ALLOWED_ORIGINS.includes("*") ||
    CONFIG.ALLOWED_ORIGINS.some((allowed) => allowed.toLowerCase() === origin.toLowerCase());

  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Cache-Control"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}

async function readJsonBody<T = any>(req: IncomingMessage, maxBytes = 4 * 1024 * 1024): Promise<T> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        req.destroy();
        reject(new Error(`Payload too large (max ${maxBytes} bytes)`));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({} as T);
        return;
      }
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(text) as T);
      } catch (err) {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function redirect(res: ServerResponse, location: string): void {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

async function routeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (applyCors(req, res)) {
    return;
  }

  const publicBaseUrl = getPublicBaseUrl(req);
  const isSecure = publicBaseUrl.startsWith("https://");
  const host = req.headers.host || `localhost:${CONFIG.PORT}`;

  const parsedUrl = new URL(req.url || "/", `http://${host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method || "GET";

  // 1. Health check
  if (method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
    sendJson(res, 200, { status: "ok", time: Date.now(), service: "garden-api" });
    return;
  }

  // 2. Auth: Me
  if (method === "GET" && pathname === "/api/auth/me") {
    const identity = readIdentityFromRequest(req);
    if (!identity) {
      sendJson(res, 200, { authenticated: false });
      return;
    }
    sendJson(res, 200, {
      authenticated: true,
      user: {
        userId: identity.userId,
        displayName: identity.displayName,
        githubLogin: identity.githubLogin,
        avatarUrl: identity.avatarUrl,
      },
      isOwner: isGithubLoginAllowed(identity.githubLogin),
    });
    return;
  }

  // 3. Auth: GitHub Start
  if (method === "GET" && pathname === "/api/auth/github/start") {
    if (!CONFIG.GITHUB_CLIENT_ID) {
      sendJson(res, 503, { error: "GitHub OAuth is not configured on this server" });
      return;
    }

    const returnTo = sanitizeReturnTo(parsedUrl.searchParams.get("returnTo"), host);
    const state = createOAuthState(returnTo);
    const redirectUri = `${publicBaseUrl}/api/auth/github/callback`;

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
      CONFIG.GITHUB_CLIENT_ID
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(
      state
    )}&scope=read:user`;

    redirect(res, githubAuthUrl);
    return;
  }

  // 4. Auth: GitHub Callback
  if (method === "GET" && pathname === "/api/auth/github/callback") {
    const code = parsedUrl.searchParams.get("code");
    const stateParam = parsedUrl.searchParams.get("state") || "";
    const state = verifyOAuthState(stateParam);

    if (!code || !state) {
      sendJson(res, 400, { error: "Invalid or expired OAuth state" });
      return;
    }

    try {
      const accessToken = await exchangeGithubCode(code);
      const identity = await fetchGithubUser(accessToken);

      const sessionToken = createWebSessionToken(identity);
      setSessionCookie(res, sessionToken, CONFIG.SESSION_TTL_SECONDS, isSecure);

      const returnTo = sanitizeReturnTo(state.returnTo, host);
      redirect(res, returnTo);
    } catch (err: any) {
      sendJson(res, 500, { error: "Failed to authenticate with GitHub", message: err.message });
    }
    return;
  }

  // 5. Auth: Logout
  if (method === "GET" && pathname === "/api/auth/logout") {
    clearSessionCookie(res, isSecure);
    const returnTo = sanitizeReturnTo(parsedUrl.searchParams.get("returnTo"), host);
    redirect(res, returnTo);
    return;
  }

  // 6. Private Blog: /api/blog/:slug
  const blogMatch = pathname.match(/^\/api\/blog\/([a-z0-9-]+)$/);
  if (method === "GET" && blogMatch) {
    const slug = blogMatch[1];
    await handlePrivateBlog(req, res, slug, publicBaseUrl);
    return;
  }

  // 7. AI: Explain selection
  if (method === "POST" && pathname === "/api/explain-selection") {
    const body = await readJsonBody(req);
    await handleExplainSelection(req, res, body);
    return;
  }

  // 8. AI: Chat article
  if (method === "POST" && pathname === "/api/chat-article") {
    const body = await readJsonBody(req);
    await handleArticleChat(req, res, body);
    return;
  }

  // 9. Snapshots: Create
  if (method === "POST" && pathname === "/api/snapshots") {
    const body = await readJsonBody(req);
    await handleCreateSnapshot(req, res, body);
    return;
  }

  // 10. Snapshots: Get or Delete by ID
  const snapshotMatch = pathname.match(/^\/api\/snapshots\/([a-z0-9-]+)$/);
  if (snapshotMatch) {
    const id = snapshotMatch[1];
    if (method === "GET") {
      await handleGetSnapshot(req, res, id);
      return;
    }
    if (method === "DELETE") {
      await handleDeleteSnapshot(req, res, id);
      return;
    }
  }

  // 404 Fallback
  sendJson(res, 404, { error: "Not Found", path: pathname });
}

export function startServer(): ReturnType<typeof createServer> {
  const server = createServer((req, res) => {
    routeRequest(req, res).catch((err) => {
      console.error("Unhandled request error:", err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal Server Error" });
      }
    });
  });

  server.listen(CONFIG.PORT, CONFIG.HOST, () => {
    console.log(
      `🌿 Garden Lab API running at http://${CONFIG.HOST}:${CONFIG.PORT} (public: ${
        CONFIG.PUBLIC_URL || `http://${CONFIG.HOST}:${CONFIG.PORT}`
      })`
    );
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("server.ts")) {
  startServer();
}
