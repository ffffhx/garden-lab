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
const imageLightboxScript = `(function(){function initLightbox(){var images=document.querySelectorAll('.article-content img');if(!images.length)return;var overlay=document.createElement('div');overlay.id='lightbox-modal';overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:99999;display:none;align-items:center;justify-content:center;cursor:zoom-out;user-select:none;flex-direction:column;';var toolbar=document.createElement('div');toolbar.style.cssText='position:absolute;top:16px;right:16px;display:flex;gap:8px;z-index:100000;';toolbar.innerHTML='<button id="lb-zin" style="background:rgba(255,255,255,0.15);color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">+</button><button id="lb-zout" style="background:rgba(255,255,255,0.15);color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">-</button><button id="lb-rst" style="background:rgba(255,255,255,0.15);color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;">1:1</button><button id="lb-cls" style="background:#ef4444;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">✕</button>';overlay.appendChild(toolbar);var imgWrapper=document.createElement('div');imgWrapper.style.cssText='flex:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;';var bigImg=document.createElement('img');bigImg.style.cssText='max-height:85vh;max-width:92vw;object-fit:contain;transition:transform 0.1s ease-out;border-radius:8px;box-shadow:0 20px 40px rgba(0,0,0,0.5);cursor:grab;';imgWrapper.appendChild(bigImg);overlay.appendChild(imgWrapper);var caption=document.createElement('div');caption.style.cssText='position:absolute;bottom:16px;background:rgba(0,0,0,0.6);color:#fff;padding:4px 16px;border-radius:6px;font-size:13px;max-width:80%;text-align:center;pointer-events:none;';overlay.appendChild(caption);document.body.appendChild(overlay);var scale=1,posX=0,posY=0,isDragging=false,startX=0,startY=0,startPosX=0,startPosY=0;function updateTransform(){bigImg.style.transform='translate('+posX+'px, '+posY+'px) scale('+scale+')';bigImg.style.cursor=scale>1?(isDragging?'grabbing':'grab'):'zoom-out';}function open(src,alt){scale=1;posX=0;posY=0;bigImg.src=src;caption.textContent=alt||'';caption.style.display=alt?'block':'none';updateTransform();overlay.style.display='flex';document.body.style.overflow='hidden';}function close(){overlay.style.display='none';document.body.style.overflow='';}images.forEach(function(img){img.style.cursor='zoom-in';img.title='点击或双击放大查看';function trigger(e){e.preventDefault();e.stopPropagation();open(img.currentSrc||img.src,img.alt);}img.addEventListener('click',trigger);img.addEventListener('dblclick',trigger);});overlay.addEventListener('click',function(e){if(e.target===overlay||e.target===imgWrapper)close();});toolbar.querySelector('#lb-cls').onclick=close;toolbar.querySelector('#lb-zin').onclick=function(e){e.stopPropagation();scale=Math.min(5,scale*1.25);updateTransform();};toolbar.querySelector('#lb-zout').onclick=function(e){e.stopPropagation();scale=Math.max(0.5,scale/1.25);if(scale<=1){posX=0;posY=0;}updateTransform();};toolbar.querySelector('#lb-rst').onclick=function(e){e.stopPropagation();scale=1;posX=0;posY=0;updateTransform();};bigImg.addEventListener('dblclick',function(e){e.stopPropagation();scale=scale>1.2?1:2.4;if(scale===1){posX=0;posY=0;}updateTransform();});overlay.addEventListener('wheel',function(e){e.preventDefault();var factor=e.deltaY<0?1.15:0.85;scale=Math.min(5,Math.max(0.5,scale*factor));if(scale<=1){posX=0;posY=0;}updateTransform();},{passive:false});bigImg.addEventListener('mousedown',function(e){if(scale<=1)return;e.preventDefault();isDragging=true;startX=e.clientX;startY=e.clientY;startPosX=posX;startPosY=posY;});window.addEventListener('mousemove',function(e){if(!isDragging)return;posX=startPosX+(e.clientX-startX);posY=startPosY+(e.clientY-startY);updateTransform();});window.addEventListener('mouseup',function(){isDragging=false;updateTransform();});window.addEventListener('keydown',function(e){if(overlay.style.display==='flex'&&e.key==='Escape')close();});}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initLightbox);}else{initLightbox();}})();`;

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
<script>${imageLightboxScript}</script>
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
