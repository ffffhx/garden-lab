import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  createAgentSessionToken,
  createOAuthState,
  createWebSessionToken,
  identityFromGitHubUser,
  isGithubIdentityAllowed,
  parseCookieHeader,
  sanitizeReturnTo,
  verifyAgentSessionToken,
  verifyOAuthState,
  verifyWebSessionToken,
  type GitHubUserProfile,
  type TokenBoardIdentity,
} from "../lib/token-board-auth";
import {
  findUserByUploadToken,
  isTokenBoardMetric,
  isTokenBoardRange,
  normalizeUploadUsers,
  sanitizeIngestEvents,
  type TokenBoardUploadUser,
} from "../lib/token-board-automation";
import {
  buildTokenAccountUsageProfile,
  buildTokenLeaderboard,
  type TokenBoardMetric,
  type TokenBoardRange,
} from "../lib/token-leaderboard";
import {
  createTokenUsageStore,
  importTokenUsageEventsFromJsonFile,
  type TokenUsageStore,
} from "../lib/token-board-storage";
import { buildTokenUsageSnapshotFromEvents } from "../lib/content/token-usage";

const PORT = Number(process.env.TOKEN_BOARD_PORT || 8787);
const HOST = process.env.TOKEN_BOARD_HOST || "127.0.0.1";
const DATA_FILE = process.env.TOKEN_BOARD_DATA_FILE || path.join(process.cwd(), ".token-board", "usage-events.json");
const USERS_FILE = process.env.TOKEN_BOARD_USERS_FILE || path.join(process.cwd(), ".token-board", "users.json");
const MAX_BODY_BYTES = Number(process.env.TOKEN_BOARD_MAX_BODY_BYTES || 4 * 1024 * 1024);
const MAX_EVENTS = Number(process.env.TOKEN_BOARD_MAX_EVENTS || 100_000);
const SESSION_COOKIE_NAME = "token_board_session";
const WEB_SESSION_TTL_SECONDS = Number(process.env.TOKEN_BOARD_WEB_SESSION_TTL_SECONDS || 30 * 24 * 60 * 60);
const AGENT_SESSION_TTL_SECONDS = Number(process.env.TOKEN_BOARD_AGENT_SESSION_TTL_SECONDS || 180 * 24 * 60 * 60);
const OAUTH_STATE_TTL_SECONDS = 15 * 60;
let tokenUsageStore: TokenUsageStore | undefined;

async function main() {
  tokenUsageStore = await openTokenUsageStore();

  if (process.env.TOKEN_BOARD_MIGRATE_JSON_ON_START === "true") {
    const result = await importTokenUsageEventsFromJsonFile(tokenUsageStore, DATA_FILE);
    console.log(
      `migrated ${result.accepted}/${result.imported} token usage events from ${result.filePath}; duplicates=${result.duplicates}; records=${result.records}`
    );
  }

  const server = createServer((request, response) => {
    void routeRequest(request, response).catch((error) => {
      sendJson(request, response, 500, {
        error: error instanceof Error ? error.message : "Internal server error",
      });
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`token-board server listening on http://${HOST}:${PORT}`);
    console.log(`storage: ${tokenUsageStore?.kind} (${tokenUsageStore?.label})`);
  });
}

async function migrateJson() {
  const store = await openTokenUsageStore();

  try {
    const result = await importTokenUsageEventsFromJsonFile(store, DATA_FILE);
    console.log(`source: ${result.filePath}`);
    console.log(`storage: ${store.kind} (${store.label})`);
    console.log(`imported: ${result.imported}`);
    console.log(`accepted: ${result.accepted}`);
    console.log(`duplicates: ${result.duplicates}`);
    console.log(`records: ${result.records}`);

    if (result.errors.length) {
      console.log(`parse warnings: ${result.errors.join("; ")}`);
    }
  } finally {
    await store.close?.();
  }
}

async function routeRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  applyCors(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/usage/health") {
    const users = await loadUploadUsers();
    const records = await usageStore().countEvents();
    sendJson(request, response, 200, {
      ok: true,
      users: users.length,
      records,
      storage: usageStore().kind,
      githubAuth: Boolean(process.env.GITHUB_CLIENT_ID),
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    const identity = readWebIdentity(request);
    sendJson(request, response, 200, {
      authenticated: Boolean(identity),
      user: identity,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/logout") {
    response.setHeader("Set-Cookie", clearSessionCookie(request));
    redirect(response, sanitizeReturnTo(url.searchParams.get("returnTo"), allowedReturnOrigins(request), "/"));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/github/start") {
    await handleGithubStart(request, response, url);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/github/callback") {
    await handleGithubCallback(request, response, url);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/device/start") {
    await handleDeviceStart(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/device/poll") {
    await handleDevicePoll(request, response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/usage/stats") {
    const range = parseRange(url.searchParams.get("range"));
    const metric = parseMetric(url.searchParams.get("metric"));
    const now = parseNow(url.searchParams.get("now"));
    const events = await usageStore().listEvents();

    sendJson(request, response, 200, {
      schemaVersion: 1,
      source: "server",
      records: events.length,
      generatedAt: new Date().toISOString(),
      summary: buildTokenLeaderboard(events, { range, metric, now }),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/usage/me") {
    const identity = readWebIdentity(request);

    if (!identity) {
      sendJson(request, response, 401, { error: "GitHub login required" });
      return;
    }

    const range = parseRange(url.searchParams.get("range"));
    const now = parseNow(url.searchParams.get("now"));
    const events = await usageStore().listEvents();
    const profile = buildTokenAccountUsageProfile(events, {
      userId: identity.userId,
      range,
      now,
    });

    sendJson(request, response, 200, {
      schemaVersion: 1,
      source: "server",
      records: profile.records,
      totalRecords: events.length,
      generatedAt: new Date().toISOString(),
      user: identity,
      profile,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/usage/summary") {
    const now = parseNow(url.searchParams.get("now"));
    const ownerUserId = normalizeOptionalText(url.searchParams.get("userId")) || normalizeOptionalText(process.env.TOKEN_BOARD_SUMMARY_USER_ID);
    const events = await usageStore().listEvents();
    const filteredEvents = ownerUserId ? events.filter((event) => event.userId === ownerUserId) : events;

    sendJson(request, response, 200, {
      ...buildTokenUsageSnapshotFromEvents(filteredEvents, {
        now,
        source: ownerUserId ? "token-board-server-user" : "token-board-server",
      }),
      records: filteredEvents.length,
      totalRecords: events.length,
      userId: ownerUserId || null,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/usage/leaderboard") {
    const range = parseRange(url.searchParams.get("range"));
    const metric = parseMetric(url.searchParams.get("metric"));
    const now = parseNow(url.searchParams.get("now"));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const events = await usageStore().listEvents();
    const summary = buildTokenLeaderboard(events, { range, metric, now });

    sendJson(request, response, 200, {
      schemaVersion: 1,
      source: "server",
      users: summary.users.slice(0, limit),
      summary,
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/usage/ingest") {
    await handleIngest(request, response);
    return;
  }

  sendJson(request, response, 404, { error: "Not found" });
}

async function handleIngest(request: IncomingMessage, response: ServerResponse) {
  const identity = await authenticateIngestRequest(request);

  if (!identity) {
    sendJson(request, response, 401, { error: "Login required" });
    return;
  }

  const body = await readJsonBody(request);
  const rawEvents = Array.isArray((body as { events?: unknown }).events)
    ? ((body as { events: Parameters<typeof sanitizeIngestEvents>[0] }).events)
    : [];

  if (!rawEvents.length) {
    sendJson(request, response, 400, { error: "Body must include events[]" });
    return;
  }

  const sanitized = sanitizeIngestEvents(rawEvents, identity, {
    projectMode: parseProjectMode(process.env.TOKEN_BOARD_PROJECT_MODE),
    includeModel: process.env.TOKEN_BOARD_INCLUDE_MODEL !== "false",
    includeSource: process.env.TOKEN_BOARD_INCLUDE_SOURCE !== "false",
    hashSessionId: process.env.TOKEN_BOARD_HASH_SESSION_ID !== "false",
  });
  const result = await usageStore().insertEvents(sanitized.entries);

  sendJson(request, response, 200, {
    ok: true,
    accepted: result.accepted,
    duplicates: result.duplicates,
    errors: sanitized.errors,
    records: result.records,
    user: {
      userId: identity.userId,
      displayName: identity.displayName,
      team: identity.team || "GitHub",
    },
  });
}

async function handleGithubStart(request: IncomingMessage, response: ServerResponse, url: URL) {
  const clientId = requireEnv("GITHUB_CLIENT_ID");
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"), allowedReturnOrigins(request), "/token-leaderboard/");
  const state = createOAuthState(returnTo, authSecret(), OAUTH_STATE_TTL_SECONDS);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${publicBaseUrl(request)}/api/auth/github/callback`,
    scope: "read:user",
    state,
  });

  redirect(response, `https://github.com/login/oauth/authorize?${params.toString()}`);
}

async function handleGithubCallback(request: IncomingMessage, response: ServerResponse, url: URL) {
  const code = url.searchParams.get("code");
  const state = verifyOAuthState(url.searchParams.get("state") || "", authSecret());

  if (!code || !state?.returnTo) {
    sendJson(request, response, 400, { error: "Invalid OAuth callback" });
    return;
  }

  const accessToken = await exchangeGithubCode(code, `${publicBaseUrl(request)}/api/auth/github/callback`);
  const identity = await githubIdentityFromAccessToken(accessToken);

  if (!isGithubIdentityAllowed(identity, allowedGithubLogins())) {
    sendJson(request, response, 403, { error: "This GitHub account is not allowed" });
    return;
  }

  response.setHeader(
    "Set-Cookie",
    sessionCookie(createWebSessionToken(identity, authSecret(), WEB_SESSION_TTL_SECONDS), request, WEB_SESSION_TTL_SECONDS)
  );
  redirect(response, state.returnTo);
}

async function handleDeviceStart(request: IncomingMessage, response: ServerResponse) {
  const clientId = requireEnv("GITHUB_CLIENT_ID");
  const githubResponse = await postGithubForm("https://github.com/login/device/code", {
    client_id: clientId,
    scope: "read:user",
  });

  sendJson(request, response, 200, {
    deviceCode: githubResponse.device_code,
    userCode: githubResponse.user_code,
    verificationUri: githubResponse.verification_uri,
    expiresIn: githubResponse.expires_in,
    interval: githubResponse.interval,
  });
}

async function handleDevicePoll(request: IncomingMessage, response: ServerResponse) {
  const body = (await readJsonBody(request)) as { deviceCode?: string };
  const deviceCode = typeof body.deviceCode === "string" ? body.deviceCode : "";

  if (!deviceCode) {
    sendJson(request, response, 400, { error: "deviceCode is required" });
    return;
  }

  const githubResponse = await postGithubForm("https://github.com/login/oauth/access_token", {
    client_id: requireEnv("GITHUB_CLIENT_ID"),
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });

  if (githubResponse.error) {
    const status = githubResponse.error === "authorization_pending" || githubResponse.error === "slow_down" ? 200 : 400;
    sendJson(request, response, status, {
      status: githubResponse.error,
      interval: githubResponse.interval,
      errorDescription: githubResponse.error_description,
    });
    return;
  }

  const identity = await githubIdentityFromAccessToken(String(githubResponse.access_token || ""));

  if (!isGithubIdentityAllowed(identity, allowedGithubLogins())) {
    sendJson(request, response, 403, { error: "This GitHub account is not allowed" });
    return;
  }

  sendJson(request, response, 200, {
    status: "authorized",
    token: createAgentSessionToken(identity, authSecret(), AGENT_SESSION_TTL_SECONDS),
    user: identity,
    expiresIn: AGENT_SESSION_TTL_SECONDS,
  });
}

async function authenticateIngestRequest(request: IncomingMessage): Promise<TokenBoardIdentity | undefined> {
  const token = readBearerToken(request);
  const agentIdentity = verifyAgentSessionToken(token, authSecret());

  if (agentIdentity) {
    return agentIdentity;
  }

  const legacyUser = findUserByUploadToken(await loadUploadUsers(), token);

  if (legacyUser) {
    return {
      userId: legacyUser.userId,
      displayName: legacyUser.displayName,
      team: legacyUser.team || "Friends",
    };
  }

  return undefined;
}

function readWebIdentity(request: IncomingMessage) {
  const token = parseCookieHeader(request.headers.cookie).get(SESSION_COOKIE_NAME) || "";
  return verifyWebSessionToken(token, authSecret());
}

async function loadUploadUsers(): Promise<TokenBoardUploadUser[]> {
  if (process.env.TOKEN_BOARD_USERS_JSON) {
    return normalizeUploadUsers(JSON.parse(process.env.TOKEN_BOARD_USERS_JSON));
  }

  if (process.env.TOKEN_BOARD_UPLOAD_TOKEN) {
    return [
      {
        userId: process.env.TOKEN_BOARD_USER_ID || "local",
        displayName: process.env.TOKEN_BOARD_DISPLAY_NAME || process.env.TOKEN_BOARD_USER_ID || "Local User",
        team: process.env.TOKEN_BOARD_TEAM || "Friends",
        uploadToken: process.env.TOKEN_BOARD_UPLOAD_TOKEN,
      },
    ];
  }

  try {
    const text = await fs.readFile(USERS_FILE, "utf8");
    return normalizeUploadUsers(JSON.parse(text));
  } catch {
    return [];
  }
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body is too large");
    }

    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

async function exchangeGithubCode(code: string, redirectUri: string) {
  const payload = await postGithubForm("https://github.com/login/oauth/access_token", {
    client_id: requireEnv("GITHUB_CLIENT_ID"),
    client_secret: requireEnv("GITHUB_CLIENT_SECRET"),
    code,
    redirect_uri: redirectUri,
  });

  if (!payload.access_token) {
    throw new Error(String(payload.error_description || payload.error || "GitHub OAuth token exchange failed"));
  }

  return String(payload.access_token);
}

async function githubIdentityFromAccessToken(accessToken: string) {
  if (!accessToken) {
    throw new Error("GitHub access token is empty");
  }

  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "token-board",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user request failed with HTTP ${response.status}`);
  }

  return identityFromGitHubUser((await response.json()) as GitHubUserProfile);
}

async function postGithubForm(url: string, fields: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "token-board",
    },
    body: new URLSearchParams(fields),
  });
  const payload = (await response.json()) as Record<string, string | number | undefined>;

  if (!response.ok) {
    throw new Error(String(payload.error_description || payload.error || `GitHub request failed with HTTP ${response.status}`));
  }

  return payload;
}

function readBearerToken(request: IncomingMessage) {
  const auth = request.headers.authorization || "";

  if (auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }

  const header = request.headers["x-token-board-token"];
  return Array.isArray(header) ? header[0] || "" : header || "";
}

function parseRange(value: string | null): TokenBoardRange {
  return value && isTokenBoardRange(value) ? value : "7D";
}

function parseMetric(value: string | null): TokenBoardMetric {
  return value && isTokenBoardMetric(value) ? value : "tokens";
}

function parseNow(value: string | null) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function parseProjectMode(value: string | undefined) {
  return value === "hash" || value === "none" ? value : "basename";
}

function normalizeOptionalText(value: string | null | undefined) {
  return value?.trim() || "";
}

function allowedGithubLogins() {
  return (process.env.TOKEN_BOARD_ALLOWED_GITHUB_LOGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function allowedReturnOrigins(request: IncomingMessage) {
  return (process.env.TOKEN_BOARD_ALLOWED_RETURN_ORIGINS || process.env.TOKEN_BOARD_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin && origin !== "*")
    .concat(originFromRequest(request));
}

function originFromRequest(request: IncomingMessage) {
  const protocol = request.headers["x-forwarded-proto"] || (process.env.TOKEN_BOARD_PUBLIC_URL?.startsWith("https://") ? "https" : "http");
  return `${Array.isArray(protocol) ? protocol[0] : protocol}://${request.headers.host || `${HOST}:${PORT}`}`;
}

function publicBaseUrl(request: IncomingMessage) {
  return (process.env.TOKEN_BOARD_PUBLIC_URL || originFromRequest(request)).replace(/\/+$/, "");
}

function authSecret() {
  return process.env.TOKEN_BOARD_AUTH_SECRET || "dev-only-token-board-auth-secret";
}

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function openTokenUsageStore() {
  return createTokenUsageStore({
    dataFile: DATA_FILE,
    maxEvents: MAX_EVENTS,
    databaseUrl: normalizeOptionalText(process.env.TOKEN_BOARD_DATABASE_URL) || normalizeOptionalText(process.env.DATABASE_URL),
    postgresSchema: normalizeOptionalText(process.env.TOKEN_BOARD_POSTGRES_SCHEMA) || "token_board",
    postgresSsl: process.env.TOKEN_BOARD_DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.TOKEN_BOARD_DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  });
}

function usageStore() {
  if (!tokenUsageStore) {
    throw new Error("Token usage store is not initialized");
  }

  return tokenUsageStore;
}

function applyCors(request: IncomingMessage, response: ServerResponse) {
  const allowed = (process.env.TOKEN_BOARD_ALLOWED_ORIGINS || "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = request.headers.origin || "";
  const allowOrigin = origin && (allowed.includes("*") || allowed.includes(origin)) ? origin : allowed[0] || "*";

  response.setHeader("Access-Control-Allow-Origin", allowOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Token-Board-Token");
  response.setHeader("Vary", "Origin");
}

function sessionCookie(token: string, request: IncomingMessage, maxAgeSeconds: number) {
  const sameSite = process.env.TOKEN_BOARD_COOKIE_SAMESITE || "Lax";
  const secure =
    process.env.TOKEN_BOARD_COOKIE_SECURE === "true" ||
    (process.env.TOKEN_BOARD_COOKIE_SECURE !== "false" && publicBaseUrl(request).startsWith("https://"));
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearSessionCookie(request: IncomingMessage) {
  return sessionCookie("", request, 0);
}

function redirect(response: ServerResponse, location: string) {
  response.writeHead(302, { Location: location });
  response.end();
}

function sendJson(request: IncomingMessage, response: ServerResponse, status: number, payload: unknown) {
  applyCors(request, response);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function run() {
  const command = process.argv[2] || "serve";

  if (command === "serve" || command === "server") {
    await main();
    return;
  }

  if (command === "migrate-json") {
    await migrateJson();
    return;
  }

  throw new Error(`Unknown token-board command: ${command}`);
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
