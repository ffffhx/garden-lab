import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  appendTokenToUrl,
  clearSessionCookie,
  createOAuthState,
  createWebSessionToken,
  exchangeGithubCode,
  fetchGithubUser,
  isGithubLoginAllowed,
  readIdentityFromRequest,
  sanitizeReturnTo,
  setSessionCookie,
  verifyMagicLoginToken,
  verifyOAuthState,
} from "./auth.js";
import { CONFIG } from "./config.js";
import {
  handleGetPrivatePostJson,
  handleListPrivatePosts,
  handlePrivateBlogRedirect,
} from "./private-blog.js";

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
  let pathname = parsedUrl.pathname;

  // Support reverse proxy forwarding both with or without /garden-api prefix
  if (pathname.startsWith("/garden-api")) {
    pathname = pathname.slice("/garden-api".length) || "/";
  }

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
      const redirectUrl = appendTokenToUrl(returnTo, sessionToken);
      redirect(res, redirectUrl);
    } catch (err: any) {
      const returnTo = sanitizeReturnTo(state.returnTo, host);
      const retryTarget = new URL(returnTo, `${publicBaseUrl}/`);
      if (retryTarget.host === host && retryTarget.pathname === "/applications/api/auth/callback") {
        retryTarget.pathname = "/applications/";
        retryTarget.search = "?login_error=unavailable";
        redirect(res, retryTarget.toString());
        return;
      }
      sendJson(res, 500, { error: "Failed to authenticate with GitHub", message: err.message });
    }
    return;
  }

  // 4.1 Auth: Magic Login (Direct signed token login for author)
  if (method === "GET" && pathname === "/api/auth/magic") {
    const token = parsedUrl.searchParams.get("token") || "";
    const verified = verifyMagicLoginToken(token);

    if (!verified) {
      sendJson(res, 400, { error: "Invalid or expired magic login token" });
      return;
    }

    const sessionToken = createWebSessionToken(verified.identity);
    setSessionCookie(res, sessionToken, CONFIG.SESSION_TTL_SECONDS, isSecure);

    const targetReturn = parsedUrl.searchParams.get("returnTo") || verified.returnTo || "/";
    const returnTo = sanitizeReturnTo(targetReturn, host);
    const redirectUrl = appendTokenToUrl(returnTo, sessionToken);
    redirect(res, redirectUrl);
    return;
  }

  // 5. Auth: Logout
  if (method === "GET" && pathname === "/api/auth/logout") {
    clearSessionCookie(res, isSecure);
    const returnTo = sanitizeReturnTo(parsedUrl.searchParams.get("returnTo"), host);
    redirect(res, returnTo);
    return;
  }

  // 6. Legacy private article URL: redirect to the shared site renderer
  const blogMatch = pathname.match(/^\/api\/blog\/([a-z0-9-]+)$/);
  if (method === "GET" && blogMatch) {
    const slug = blogMatch[1];
    handlePrivateBlogRedirect(res, slug);
    return;
  }

  // 6.1 Private Posts: List (JSON)
  if (method === "GET" && pathname === "/api/private-posts") {
    await handleListPrivatePosts(req, res);
    return;
  }

  // 6.2 Private Posts: Get by slug (JSON)
  const privatePostMatch = pathname.match(/^\/api\/private-posts\/([a-z0-9-]+)$/);
  if (method === "GET" && privatePostMatch) {
    const slug = privatePostMatch[1];
    await handleGetPrivatePostJson(req, res, slug);
    return;
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
