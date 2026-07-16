import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getPostBySlug } from "../lib/content/posts";

// 把一篇(通常是 hidden 的)文章导出成单文件、自包含的 HTML,交给腾讯云
// token-board 后端做「登录后仅作者可见」的鉴权直出。
//
// 为什么要这个脚本:博客是 Next.js 静态导出到 GitHub Pages,纯静态无服务端,
// 无法做「仅自己可见」。hidden: true 只是把文章移出公开构建(URL 变 404)。
// 真正的私有阅读放到已有的 token-board 后端(GitHub 登录 + owner 白名单)。
// 这里负责产出那份带样式的 HTML。
//
// 用法: pnpm export:private [slug]        (默认 resume-interview-handbook)
// 前置:  先 `pnpm run build`,脚本依赖 out/_next/static/css 里已编译的 CSS。

const slug = process.argv[2] || "resume-interview-handbook";

// 线上公开资源源:图片(post-assets)、字体(_next/static/media)都从这里加载。
// 本地 out 是无 basePath 构建,路径形如 /post-assets/... 与 /_next/...,
// 统一改写到这个绝对前缀,指向 GitHub Pages 上实际部署的公开资源。
const ASSET_ORIGIN = "https://ffffhx.github.io/garden-lab";

const siteRoot = process.cwd();
const outDir = join(siteRoot, "out");
const cssDir = join(outDir, "_next", "static", "css");

function absolutizeRootRelative(text: string) {
  // 把根相对的 /_next/、/post-assets/、/images/ 改写为线上公开绝对 URL。
  // 只匹配出现在 url( 或引号后的根相对路径,避免误伤正文里的普通斜杠。
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

// 复用 next/font 生成的字体变量类名(如 __variable_xxx),它们定义在内联的
// CSS 里。类名 hash 每次构建可能变,所以从任一已构建的 post 页面动态提取,
// 而不是硬编码。
function readHtmlClassName() {
  const postsOut = join(outDir, "post");
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

const post = getPostBySlug(slug);
if (!post) {
  throw new Error(`Post not found for slug: ${slug}`);
}

const css = readInlinedCss();
const htmlClass = readHtmlClassName();

// 防闪烁主题初始化脚本,与 app/layout.tsx 的 themeInitScript 保持一致。
const themeInitScript = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

const contentHtml = post.contentHtml;
const coverUrl = post.cover;

const coverBlock = coverUrl
  ? `<div class="overflow-hidden rounded-2xl border-[1.5px] border-ink/70 bg-paper-deep"><img src="${coverUrl}" alt="${post.title} 封面" class="block h-auto w-full" /></div>`
  : "";

// 页面骨架对齐 app/post/[slug]/page.tsx 与 components/article-body.tsx:
// 仅保留静态排版所需的最小结构(容器 + 标题 + 封面 + .article-content),
// 去掉 AI 聊天、quiz、TOC 等客户端增强。
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

const destDir = join(siteRoot, "tmp", "private-blog");
mkdirSync(destDir, { recursive: true });
const destFile = join(destDir, `${slug}.html`);
// 整页组装完成后统一改写根相对资源 URL,确保封面 src、正文图片、内联 CSS
// 里的字体路径都被覆盖(逐片改写会漏掉尚未加引号的裸路径)。
writeFileSync(destFile, absolutizeRootRelative(page));

console.log(
  `Wrote ${destFile} (${(page.length / 1024).toFixed(1)}KB, css inlined, assets → ${ASSET_ORIGIN})`
);
