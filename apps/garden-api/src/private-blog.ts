import { promises as fs } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import { isGithubLoginAllowed, readIdentityFromRequest } from "./auth.js";
import { CONFIG } from "./config.js";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export async function handleListPrivatePosts(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const identity = readIdentityFromRequest(req);

  if (!identity || !isGithubLoginAllowed(identity.githubLogin)) {
    sendJson(res, 403, { error: "Forbidden", message: "Only the author can access private posts" });
    return;
  }

  try {
    const dirEntries = await fs.readdir(CONFIG.PRIVATE_BLOG_DIR, { withFileTypes: true });
    const jsonFiles = dirEntries.filter(
      (entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "snapshots.json"
    );

    const posts: any[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(CONFIG.PRIVATE_BLOG_DIR, file.name);
        const raw = await fs.readFile(filePath, "utf8");
        const data = JSON.parse(raw);
        // Exclude contentHtml from list payload to keep response lightweight
        const { contentHtml, ...summary } = data;
        posts.push(summary);
      } catch {
        // skip malformed JSON files
      }
    }

    // Sort by date or title if available
    posts.sort((a, b) => {
      const dateA = a.dateText ? new Date(a.dateText).getTime() : 0;
      const dateB = b.dateText ? new Date(b.dateText).getTime() : 0;
      return dateB - dateA;
    });

    sendJson(res, 200, { posts });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      sendJson(res, 200, { posts: [] });
    } else {
      sendJson(res, 500, { error: "Failed to read private posts" });
    }
  }
}

export async function handleGetPrivatePostJson(
  req: IncomingMessage,
  res: ServerResponse,
  slug: string
): Promise<void> {
  if (!SLUG_REGEX.test(slug)) {
    sendJson(res, 400, { error: "Invalid slug parameter" });
    return;
  }

  const identity = readIdentityFromRequest(req);

  if (!identity || !isGithubLoginAllowed(identity.githubLogin)) {
    sendJson(res, 403, { error: "Forbidden", message: "Only the author can access private posts" });
    return;
  }

  const jsonFilePath = path.join(CONFIG.PRIVATE_BLOG_DIR, `${slug}.json`);

  try {
    const raw = await fs.readFile(jsonFilePath, "utf8");
    const data = JSON.parse(raw);
    sendJson(res, 200, data);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      sendJson(res, 404, { error: "Private post not found" });
    } else {
      sendJson(res, 500, { error: "Failed to read private post" });
    }
  }
}

export async function handlePrivateBlog(
  req: IncomingMessage,
  res: ServerResponse,
  slug: string,
  publicBaseUrl: string
): Promise<void> {
  if (!SLUG_REGEX.test(slug)) {
    sendHtml(
      res,
      400,
      `<!DOCTYPE html><meta charset="utf-8"><title>非法文章标识</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:20vh auto;text-align:center;color:#333"><h1 style="font-size:1.4rem">非法文章标识</h1></body>`
    );
    return;
  }

  const identity = readIdentityFromRequest(req);

  // 未登录 -> 重定向至 GitHub OAuth 登录
  if (!identity) {
    const returnTo = `${publicBaseUrl}/api/blog/${slug}`;
    const loginUrl = `${publicBaseUrl}/api/auth/github/start?returnTo=${encodeURIComponent(returnTo)}`;
    res.statusCode = 302;
    res.setHeader("Location", loginUrl);
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }

  // 已登录但不是作者本人 -> 403 拦截
  if (!isGithubLoginAllowed(identity.githubLogin)) {
    sendHtml(
      res,
      403,
      `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>仅作者可见 · Garden Lab</title>
<style>
body { font-family: system-ui, -apple-system, sans-serif; background: #faf8f5; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 80vh; margin: 0; padding: 1rem; }
.card { background: white; border: 1.5px solid #0f172a; border-radius: 1.25rem; padding: 2.5rem; max-width: 28rem; text-align: center; box-shadow: 4px 4px 0 #0f172a; }
h1 { font-size: 1.5rem; margin-top: 0; color: #0f172a; }
p { font-size: 0.95rem; color: #475569; line-height: 1.6; }
.badge { display: inline-block; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 9999px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; margin-bottom: 1rem; }
a { display: inline-block; margin-top: 1.5rem; padding: 0.6rem 1.25rem; background: #0f172a; color: white; text-decoration: none; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; }
a:hover { background: #334155; }
</style>
</head>
<body>
<div class="card">
  <div class="badge">🔒 Private Post</div>
  <h1>仅作者本人可见</h1>
  <p>当前登录账号 <strong>@${escapeHtml(identity.githubLogin)}</strong> 无权访问该私有文档。</p>
  <a href="/">返回博客首页</a>
</div>
</body>
</html>`
    );
    return;
  }

  const filePath = path.join(CONFIG.PRIVATE_BLOG_DIR, `${slug}.html`);

  try {
    const html = await fs.readFile(filePath, "utf8");
    sendHtml(res, 200, html);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      sendHtml(
        res,
        404,
        `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>未找到文章 · Garden Lab</title>
<style>
body { font-family: system-ui, -apple-system, sans-serif; background: #faf8f5; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 80vh; margin: 0; padding: 1rem; }
.card { background: white; border: 1.5px solid #0f172a; border-radius: 1.25rem; padding: 2.5rem; max-width: 28rem; text-align: center; box-shadow: 4px 4px 0 #0f172a; }
h1 { font-size: 1.5rem; margin-top: 0; color: #0f172a; }
p { font-size: 0.95rem; color: #475569; }
</style>
</head>
<body>
<div class="card">
  <h1>未找到文章</h1>
  <p>未找到对应的私密文章构建产物 (<code>${escapeHtml(slug)}.html</code>)。</p>
</div>
</body>
</html>`
      );
    } else {
      sendHtml(res, 500, `<!DOCTYPE html><meta charset="utf-8"><title>服务器异常</title><body>读取文章失败</body>`);
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function sendHtml(res: ServerResponse, statusCode: number, html: string): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, must-revalidate");
  res.end(html);
}
