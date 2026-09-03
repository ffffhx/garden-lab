import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

import { startServer } from "../src/server.js";
import { createWebSessionToken } from "../src/auth.js";
import { CONFIG } from "../src/config.js";

let server: Server;
let baseUrl: string;
let testDataDir: string;

beforeAll(async () => {
  CONFIG.PORT = 8999;
  testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "garden-api-test-"));
  CONFIG.DATA_DIR = testDataDir;

  await fs.mkdir(CONFIG.PRIVATE_BLOG_DIR, { recursive: true });
  await fs.writeFile(
    path.join(CONFIG.PRIVATE_BLOG_DIR, "internship-defense.json"),
    JSON.stringify({
      slug: "internship-defense",
      title: "面试准备：冯鸿鑫",
      dateText: "2026-08-21",
      contentHtml: "<!DOCTYPE html><html><body><h1>面试准备：冯鸿鑫</h1></body></html>",
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(CONFIG.PRIVATE_BLOG_DIR, "internship-defense.html"),
    "<!DOCTYPE html><html><body><h1>面试准备：冯鸿鑫</h1></body></html>",
    "utf8"
  );

  server = startServer();
  baseUrl = `http://127.0.0.1:8999`;
  await new Promise((resolve) => setTimeout(resolve, 300));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  if (testDataDir) {
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {});
  }
});

describe("Garden Lab API", () => {
  it("GET /health returns 200 ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("garden-api");
  });

  it("GET /api/auth/me returns unauthenticated when no cookie provided", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it("GET /api/blog/:slug redirects unauthenticated user to GitHub login", async () => {
    const res = await fetch(`${baseUrl}/api/blog/internship-defense`, {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/api/auth/github/start?returnTo=");
  });

  it("GET /api/blog/:slug serves private post for authorized owner", async () => {
    const ownerToken = createWebSessionToken({
      userId: "github:12345",
      displayName: "冯鸿鑫",
      githubLogin: "ffffhx",
    });

    const res = await fetch(`${baseUrl}/api/blog/internship-defense`, {
      headers: {
        Cookie: `${CONFIG.SESSION_COOKIE_NAME}=${ownerToken}`,
      },
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("冯鸿鑫");
  });

  it("GET /api/blog/:slug returns 403 for unauthorized login", async () => {
    const strangerToken = createWebSessionToken({
      userId: "github:99999",
      displayName: "Stranger",
      githubLogin: "random-user",
    });

    const res = await fetch(`${baseUrl}/api/blog/internship-defense`, {
      headers: {
        Cookie: `${CONFIG.SESSION_COOKIE_NAME}=${strangerToken}`,
      },
    });

    expect(res.status).toBe(403);
    const html = await res.text();
    expect(html).toContain("仅作者本人可见");
  });

  it("GET /api/private-posts lists private posts for authorized owner", async () => {
    const ownerToken = createWebSessionToken({
      userId: "github:12345",
      displayName: "冯鸿鑫",
      githubLogin: "ffffhx",
    });

    const res = await fetch(`${baseUrl}/api/private-posts`, {
      headers: {
        Cookie: `${CONFIG.SESSION_COOKIE_NAME}=${ownerToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.posts)).toBe(true);
    expect(body.posts.some((p: any) => p.slug === "internship-defense")).toBe(true);
  });

  it("GET /api/private-posts/:slug returns full post JSON for authorized owner", async () => {
    const ownerToken = createWebSessionToken({
      userId: "github:12345",
      displayName: "冯鸿鑫",
      githubLogin: "ffffhx",
    });

    const res = await fetch(`${baseUrl}/api/private-posts/internship-defense`, {
      headers: {
        Cookie: `${CONFIG.SESSION_COOKIE_NAME}=${ownerToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("internship-defense");
    expect(body.title).toContain("冯鸿鑫");
    expect(body.contentHtml).toBeDefined();
  });

  it("GET /api/private-posts returns 403 for unauthorized users", async () => {
    const res = await fetch(`${baseUrl}/api/private-posts`);
    expect(res.status).toBe(403);
  });

  it("POST & GET /api/snapshots works", async () => {
    const createRes = await fetch(`${baseUrl}/api/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Session",
        summary: "Testing snapshots",
      }),
    });

    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    expect(createBody.id).toBeDefined();

    const getRes = await fetch(`${baseUrl}/api/snapshots/${createBody.id}`);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.title).toBe("Test Session");
  });
});
