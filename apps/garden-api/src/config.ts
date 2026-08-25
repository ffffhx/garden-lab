import path from "node:path";

function parseCsv(value: string | undefined, fallback: string[] = []): string[] {
  if (!value?.trim()) {
    return fallback;
  }
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const CONFIG = {
  PORT: positiveNumber(process.env.GARDEN_API_PORT, 8787),
  HOST: process.env.GARDEN_API_HOST || "0.0.0.0",
  PUBLIC_URL: (process.env.GARDEN_API_PUBLIC_URL || "").trim().replace(/\/+$/, ""),
  ALLOWED_ORIGINS: parseCsv(process.env.GARDEN_ALLOWED_ORIGINS, [
    "https://ffffhx.github.io",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]),
  AUTH_SECRET: process.env.GARDEN_AUTH_SECRET || "dev-only-garden-auth-secret-change-in-prod-32chars",
  ALLOWED_GITHUB_LOGINS: parseCsv(process.env.GARDEN_ALLOWED_GITHUB_LOGINS, ["ffffhx"]),
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "",
  DATA_DIR: process.env.GARDEN_DATA_DIR || path.join(process.cwd(), "data"),
  get PRIVATE_BLOG_DIR() {
    return process.env.GARDEN_PRIVATE_BLOG_DIR || path.join(this.DATA_DIR, "private-blog");
  },
  get SNAPSHOTS_FILE() {
    return process.env.GARDEN_SNAPSHOTS_FILE || path.join(this.DATA_DIR, "snapshots.json");
  },
  KIMI_API_KEY: process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || "",
  KIMI_BASE_URL: (process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1").replace(/\/+$/, ""),
  SESSION_COOKIE_NAME: "garden_session",
  SESSION_TTL_SECONDS: positiveNumber(process.env.GARDEN_SESSION_TTL_SECONDS, 30 * 24 * 60 * 60),
};
