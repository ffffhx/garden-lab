import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

import { getPostBySlug } from "../lib/content/posts";
import type { Post } from "../lib/content/types";

// 把(通常是 hidden 的)私密文章导出成单文件、自包含的 HTML 及 JSON 数据,
// 供 garden-api 后端做「登录后仅作者可见」的鉴权直出和前端动态展示。
//
// 用法: pnpm export:private [slug | "all"]  (默认导出全部私密文章)
// 前置: 先 `pnpm run build`,脚本依赖 out/_next/static/css 里已编译的 CSS。

const argSlug = process.argv[2] || "all";

// 线上公开资源源:图片(post-assets)、字体(_next/static/media)都从这里加载。
const ASSET_ORIGIN = "https://ffffhx.github.io/garden-lab";

const siteRoot = process.cwd();
const outDir = join(siteRoot, "out");
const cssDir = join(outDir, "_next", "static", "css");

function inlineLocalImages(text: string) {
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };

  return text.replace(/(src=["'])\/(post-assets|images)\/([^"'\s>]+)(["'])/g, (match, prefix, folder, relPath, suffix) => {
    const candidatePaths = [
      join(siteRoot, "public", folder, decodeURIComponent(relPath)),
      join(siteRoot, "out", folder, decodeURIComponent(relPath)),
      join(siteRoot, "source", folder === "post-assets" ? "_posts" : "images", decodeURIComponent(relPath)),
    ];
    for (const filePath of candidatePaths) {
      try {
        if (existsSync(filePath)) {
          const ext = extname(filePath).toLowerCase();
          const mime = mimeMap[ext] || "application/octet-stream";
          const data = readFileSync(filePath).toString("base64");
          return `${prefix}data:${mime};base64,${data}${suffix}`;
        }
      } catch {
        // skip
      }
    }
    return match;
  });
}

function inlineSingleAsset(url: string | null | undefined): string | null {
  if (!url) return null;
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };
  const match = url.match(/^\/(post-assets|images)\/([^"'\s>]+)$/);
  if (!match) return url;
  const [, folder, relPath] = match;
  const decodedRelPath = decodeURIComponent(relPath);
  const candidatePaths = [
    join(siteRoot, "public", folder, decodedRelPath),
    join(siteRoot, "out", folder, decodedRelPath),
    join(siteRoot, "source", folder === "post-assets" ? "_posts" : "images", decodedRelPath),
  ];
  for (const filePath of candidatePaths) {
    try {
      if (existsSync(filePath)) {
        const ext = extname(filePath).toLowerCase();
        const mime = mimeMap[ext] || "application/octet-stream";
        const data = readFileSync(filePath).toString("base64");
        return `data:${mime};base64,${data}`;
      }
    } catch {
      // skip
    }
  }
  return url;
}

function absolutizeRootRelative(text: string) {
  return text
    .replace(/(url\(['"]?)\/(_next|post-assets|images)\//g, `$1${ASSET_ORIGIN}/$2/`)
    .replace(/(["'])\/(_next|post-assets|images)\//g, `$1${ASSET_ORIGIN}/$2/`);
}

function readInlinedCss() {
  const files = readdirSync(cssDir).filter((name) => name.endsWith(".css"));
  if (!files.length) {
    throw new Error(
      `No CSS found in ${cssDir}. Run \`pnpm run build\` first.`
    );
  }
  return files
    .sort()
    .map((name) => readFileSync(join(cssDir, name), "utf8"))
    .join("\n");
}

function readHtmlClassName() {
  const postsOut = join(outDir, "post");
  if (!existsSync(postsOut)) {
    return "";
  }
  const dirs = readdirSync(postsOut, { withFileTypes: true }).filter((d) =>
    d.isDirectory()
  );
  for (const dir of dirs) {
    const file = join(postsOut, dir.name, "index.html");
    try {
      const html = readFileSync(file, "utf8");
      const match = html.match(/<html[^>]*\sclass="([^"]*)"/);
      if (match) {
        return match[1];
      }
    } catch {
      // skip
    }
  }
  return "";
}

const KNOWN_PRIVATE_SLUGS = ["internship-defense", "resume-interview-handbook"];

const slugsToExport =
  argSlug === "all"
    ? KNOWN_PRIVATE_SLUGS
    : [argSlug];

const css = readInlinedCss();
const htmlClass = readHtmlClassName();
const themeInitScript = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

const destDir = join(siteRoot, "tmp", "private-blog");
mkdirSync(destDir, { recursive: true });
const apiDataDir = join(siteRoot, "..", "garden-api", "data", "private-blog");
try {
  mkdirSync(apiDataDir, { recursive: true });
} catch {}

for (const slug of slugsToExport) {
  const post = getPostBySlug(slug);
  if (!post) {
    console.warn(`Post not found for slug: ${slug}`);
    continue;
  }

  exportSinglePost(post, slug);
}

function exportSinglePost(post: Post, slug: string) {
  const contentHtml = post.contentHtml;
  const coverUrl = post.cover;

  const coverBlock = coverUrl
    ? `<div class="overflow-hidden rounded-2xl border-[1.5px] border-ink/70 bg-paper-deep"><img src="${coverUrl}" alt="${post.title} 封面" class="block h-auto w-full" /></div>`
    : "";

  const page = `<!DOCTYPE html>
<html lang="zh-CN" class="${htmlClass}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${post.title}</title>
<style>${css}</style>
<script>${themeInitScript}</script>
</head>
<body>
<main class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
<article class="riso-card riso-card--teal min-w-0 p-6 sm:p-10">
<div class="space-y-5">
<div class="flex flex-wrap items-center gap-3">
<span class="riso-sticker riso-sticker--terra">Post · 文章</span>
</div>
<h1 class="font-display max-w-[72rem] break-words text-balance text-3xl font-semibold leading-[1.06] tracking-[-0.02em] text-ink [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">${post.title}</h1>
${coverBlock}
</div>
<div class="mt-10">
<div class="article-content" data-content-image-size="${post.contentImageSize}">${contentHtml}</div>
</div>
</article>
</main>
</body>
</html>`;

  const destFile = join(destDir, `${slug}.html`);
  const inlinedPage = inlineLocalImages(page);
  const finalHtml = absolutizeRootRelative(inlinedPage);
  writeFileSync(destFile, finalHtml);

  // 生成 JSON 格式（供前端 Next.js 页面动态渲染）
  const inlinedContentHtml = absolutizeRootRelative(inlineLocalImages(contentHtml));
  const postJson = {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    categories: post.categories,
    tags: post.tags,
    dateText: post.dateText,
    readingTimeText: post.readingTimeText,
    assetBasePath: post.assetBasePath,
    cover: inlineSingleAsset(post.cover),
    coverPosition: post.coverPosition,
    hidden: true,
    contentHtml: inlinedContentHtml,
    contentImageSize: post.contentImageSize,
    headings: post.headings,
  };
  const destJsonFile = join(destDir, `${slug}.json`);
  writeFileSync(destJsonFile, JSON.stringify(postJson, null, 2));

  // 同时同步写入 apps/garden-api
  try {
    writeFileSync(join(apiDataDir, `${slug}.html`), finalHtml);
    writeFileSync(join(apiDataDir, `${slug}.json`), JSON.stringify(postJson, null, 2));
    console.log(`Synced to ${join(apiDataDir, `${slug}.html`)} and .json`);
  } catch (err: any) {
    console.warn(`Failed to sync to garden-api: ${err.message}`);
  }

  console.log(
    `Wrote ${slug} (${(finalHtml.length / 1024).toFixed(1)}KB HTML, ${(JSON.stringify(postJson).length / 1024).toFixed(1)}KB JSON)`
  );
}
