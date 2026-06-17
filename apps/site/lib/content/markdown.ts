import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { resolveOptimizedPostAssetUrl } from "@/lib/content/assets";
import type { Heading } from "@/lib/content/types";

import bash from "shiki/langs/bash.mjs";
import go from "shiki/langs/go.mjs";
import http from "shiki/langs/http.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import makefile from "shiki/langs/makefile.mjs";
import markdown from "shiki/langs/markdown.mjs";
import python from "shiki/langs/python.mjs";
import rust from "shiki/langs/rust.mjs";
import sql from "shiki/langs/sql.mjs";
import swift from "shiki/langs/swift.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import yaml from "shiki/langs/yaml.mjs";
import nightOwl from "shiki/themes/night-owl.mjs";

// Build-time syntax highlighter. We use Shiki's synchronous core + JS RegExp
// engine so the whole markdown pipeline stays synchronous (no async refactor of
// the post loader). Languages are preloaded explicitly; anything not in this
// list degrades to plain text via `fallbackLanguage` rather than failing the build.
const highlighter = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine({ forgiving: true }),
  themes: [nightOwl],
  langs: [
    typescript,
    tsx,
    javascript,
    bash,
    json,
    yaml,
    rust,
    go,
    python,
    swift,
    sql,
    markdown,
    makefile,
    http,
  ],
});

const HEXO_ASSET_IMAGE_RE =
  /\{%\s*asset_img\s+([^\s%]+)(?:\s+[^%]*)?%\}/g;

const RELATIVE_MARKDOWN_IMAGE_RE =
  /!\[([^\]]*)\]\((?!https?:\/\/|\/|data:)([^)\s]+)(?:\s+"([^"]*)")?\)/g;

type HastElement = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
};

type UnistTree = Parameters<typeof visit>[0];

function rehypeImageAttributes() {
  return (tree: UnistTree) => {
    visit(tree, "element", (node) => {
      const element = node as HastElement;

      if (element.tagName !== "img") {
        return;
      }

      element.properties = {
        ...element.properties,
        loading: element.properties?.loading ?? "lazy",
        decoding: element.properties?.decoding ?? "async",
        fetchPriority: element.properties?.fetchPriority ?? "low",
      };
    });
  };
}

export function transformHexoAssetTags(source: string, assetBasePath: string) {
  let transformed = source.replace(HEXO_ASSET_IMAGE_RE, (_match, assetName) => {
    return `![](${resolveOptimizedPostAssetUrl(assetBasePath, assetName)})`;
  });

  transformed = transformed.replace(
    RELATIVE_MARKDOWN_IMAGE_RE,
    (_match, alt, assetName, title) => {
      const titlePart = title ? ` "${title}"` : "";
      return `![${alt}](${resolveOptimizedPostAssetUrl(
        assetBasePath,
        assetName
      )}${titlePart})`;
    }
  );

  return transformed;
}

export function extractHeadings(source: string) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source);
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];

  visit(tree, "heading", (node) => {
    if (node.depth < 2 || node.depth > 4) {
      return;
    }

    const text = toString(node).trim();
    if (!text) {
      return;
    }

    headings.push({
      id: slugger.slug(text),
      text,
      depth: node.depth as 2 | 3 | 4,
    });
  });

  return headings;
}

export function compileMarkdown(source: string, assetBasePath: string) {
  const content = transformHexoAssetTags(source, assetBasePath);
  const headings = extractHeadings(content);
  const contentHtml = String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeSlug)
      .use(rehypeImageAttributes)
      .use(
        rehypeShikiFromHighlighter,
        // createHighlighterCoreSync returns HighlighterCore, which the plugin's
        // HighlighterGeneric<any, any> param rejects nominally — cast to its expected type.
        highlighter as Parameters<typeof rehypeShikiFromHighlighter>[0],
        {
          theme: "night-owl",
          defaultLanguage: "text",
          fallbackLanguage: "text",
        }
      )
      .use(rehypeStringify)
      .processSync(content)
  );

  return {
    content,
    contentHtml,
    headings,
  };
}
