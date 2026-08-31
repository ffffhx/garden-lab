import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { CONFIG } from "./config.js";

export type Identity = {
  userId: string;
  displayName: string;
  githubLogin: string;
  avatarUrl?: string;
};

type SessionPayload = {
  purpose: "web" | "oauth-state" | "magic-login";
  exp: number;
  iat: number;
  identity?: Identity;
  returnTo?: string;
  nonce?: string;
};

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

function signPayload(payload: SessionPayload, secret: string): string {
  const data = base64UrlEncode(JSON.stringify(payload));
  const hmac = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${hmac}`;
}

function verifySignedToken(token: string, secret: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [data, signature] = parts;
  const expectedHmac = createHmac("sha256", secret).update(data).digest("base64url");

  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedHmac, "utf8");

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(data)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createWebSessionToken(identity: Identity, ttlSeconds = CONFIG.SESSION_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  return signPayload(
    {
      purpose: "web",
      iat: now,
      exp: now + ttlSeconds,
      identity,
    },
    CONFIG.AUTH_SECRET
  );
}

export function verifyWebSessionToken(token: string): Identity | null {
  const payload = verifySignedToken(token, CONFIG.AUTH_SECRET);
  if (!payload || payload.purpose !== "web" || !payload.identity) {
    return null;
  }
  return payload.identity;
}

export function createOAuthState(returnTo: string, ttlSeconds = 15 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  return signPayload(
    {
      purpose: "oauth-state",
      iat: now,
      exp: now + ttlSeconds,
      returnTo,
      nonce: randomBytes(16).toString("hex"),
    },
    CONFIG.AUTH_SECRET
  );
}

export function verifyOAuthState(token: string): { returnTo?: string } | null {
  const payload = verifySignedToken(token, CONFIG.AUTH_SECRET);
  if (!payload || payload.purpose !== "oauth-state") {
    return null;
  }
  return { returnTo: payload.returnTo };
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  const pairs = header.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

export function readIdentityFromRequest(req: IncomingMessage): Identity | null {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[CONFIG.SESSION_COOKIE_NAME];
  if (!sessionToken) return null;
  return verifyWebSessionToken(sessionToken);
}

export function isGithubLoginAllowed(login: string | undefined): boolean {
  if (!login) return false;
  const allowed = CONFIG.ALLOWED_GITHUB_LOGINS;
  if (!allowed.length) return true;
  return allowed.includes(login.trim().toLowerCase());
}

export function sanitizeReturnTo(returnTo: string | null | undefined, requestHost: string): string {
  if (!returnTo) return "/";
  const trimmed = returnTo.trim();

  // If it is a safe relative path (starts with / and not // or /\)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }

  // If it is an absolute URL, check if its origin is in ALLOWED_ORIGINS or matches the request host
  try {
    const url = new URL(trimmed);
    const origin = url.origin.toLowerCase();
    const isAllowed =
      CONFIG.ALLOWED_ORIGINS.some((allowed) => allowed.toLowerCase() === origin) ||
      origin.includes(requestHost.toLowerCase());
    if (isAllowed) {
      return trimmed;
    }
  } catch {
    // invalid URL
  }

  return "/";
}

export function createMagicLoginToken(
  identity: Identity,
  returnTo = "/",
  ttlSeconds = 30 * 24 * 60 * 60
): string {
  const now = Math.floor(Date.now() / 1000);
  return signPayload(
    {
      purpose: "magic-login",
      iat: now,
      exp: now + ttlSeconds,
      identity,
      returnTo,
      nonce: randomBytes(16).toString("hex"),
    },
    CONFIG.AUTH_SECRET
  );
}

export function verifyMagicLoginToken(token: string): { identity: Identity; returnTo?: string } | null {
  const payload = verifySignedToken(token, CONFIG.AUTH_SECRET);
  if (!payload || payload.purpose !== "magic-login" || !payload.identity) {
    return null;
  }
  return { identity: payload.identity, returnTo: payload.returnTo };
}

export function setSessionCookie(
  res: ServerResponse,
  token: string,
  maxAge = CONFIG.SESSION_TTL_SECONDS,
  isSecure = false
): void {
  const secureFlag = isSecure ? "; Secure; Partitioned" : "";
  const sameSite = isSecure ? "None" : "Lax";
  const cookieVal = `${CONFIG.SESSION_COOKIE_NAME}=${encodeURIComponent(
    token
  )}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=${sameSite}${secureFlag}`;
  res.setHeader("Set-Cookie", cookieVal);
}

export function clearSessionCookie(res: ServerResponse, isSecure = false): void {
  const secureFlag = isSecure ? "; Secure; Partitioned" : "";
  const sameSite = isSecure ? "None" : "Lax";
  const cookieVal = `${CONFIG.SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=${sameSite}${secureFlag}`;
  res.setHeader("Set-Cookie", cookieVal);
}

export async function exchangeGithubCode(code: string): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "GardenLab-API",
    },
    body: JSON.stringify({
      client_id: CONFIG.GITHUB_CLIENT_ID,
      client_secret: CONFIG.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with status ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || "Missing access_token in GitHub response");
  }

  return data.access_token;
}

export async function fetchGithubUser(accessToken: string): Promise<Identity> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "GardenLab-API",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed with status ${response.status}`);
  }

  const user = (await response.json()) as {
    id: number;
    login: string;
    name?: string;
    avatar_url?: string;
  };

  return {
    userId: `github:${user.id}`,
    displayName: user.name || user.login,
    githubLogin: user.login,
    avatarUrl: user.avatar_url,
  };
}
