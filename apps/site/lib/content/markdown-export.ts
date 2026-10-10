import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { PrivatePostData } from "./types";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkStringify, {
  bullet: "-", fences: true, listItemIndent: "one",
});

// Work on parsed nodes so Markdown/HTML examples inside code stay untouched.
export function rewriteMarkdownUrls(source: string, resolve: (url: string) => string) {
  const tree = processor.parse(source);
  visit(tree, (node) => {
    if (node.type === "image" || node.type === "link" || node.type === "definition") {
      node.url = resolve(node.url);
    } else if (node.type === "html") {
      node.value = node.value.replace(
        /(\b(?:src|href|poster)\s*=\s*)(["'])(.*?)\2/gi,
        (_, prefix, quote, url) => `${prefix}${quote}${resolve(url)}${quote}`,
      );
    }
  });
  return processor.stringify(tree);
}

export function markdownFilename(title: string) {
  const name = title.normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "-")
    .replace(/\s+/g, " ").trim().replace(/[. ]+$/g, "");
  const shortened = Array.from(name).slice(0, 80).join("").replace(/[. ]+$/g, "") || "article";
  return `${/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(shortened) ? "_" : ""}${shortened}.md`;
}

async function recoverLegacyMarkdown(html: string) {
  const [{ default: TurndownService }, { gfm }] = await Promise.all([
    import("turndown"), import("turndown-plugin-gfm"),
  ]);
  const converter = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  converter.use(gfm);
  converter.remove(["script", "style", "button"]);
  converter.keep(["video", "audio", "iframe", "details", "figure"]);
  converter.addRule("highlightedCode", {
    filter: "pre",
    replacement: (_content, node) => {
      const code = node.querySelector("code");
      const value = (code || node).textContent || "";
      const language = code?.className.match(/language-([\w-]+)/)?.[1] || "";
      const fence = "`".repeat(Math.max(3, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length + 1)));
      return `\n\n${fence}${language}\n${value.replace(/\n$/, "")}\n${fence}\n\n`;
    },
  });
  return converter.turndown(html);
}

// Use the original article HTML, before interactive enhancements add controls.
// A chapter includes all descendants until the next same-or-higher heading.
export async function createSectionMarkdown(html: string, headingId: string, pageUrl: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const index = headings.findIndex((heading) => heading.id === headingId);
  if (index < 0) throw new Error("Section heading not found");
  const heading = headings[index];
  const depth = Number(heading.tagName[1]);
  const next = headings.slice(index + 1).find((item) => Number(item.tagName[1]) <= depth);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  range.setStartBefore(heading);
  if (next) range.setEndBefore(next);
  const section = doc.createElement("div");
  section.append(range.cloneContents());
  const markdown = await recoverLegacyMarkdown(section.innerHTML);
  return rewriteMarkdownUrls(markdown, (url) => {
    if (!url || url.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(url)) return url;
    try { return new URL(url, pageUrl).href; } catch { return url; }
  });
}

export async function createMarkdownExport(
  post: Pick<PrivatePostData, "title" | "content" | "contentHtml">,
  pageUrl: string,
) {
  const source = post.content ?? await recoverLegacyMarkdown(post.contentHtml);
  const tree = processor.parse(source);
  const first = tree.children[0];
  const title = processor.stringify({ type: "root", children: [
    { type: "heading", depth: 1, children: [{ type: "text", value: post.title.replace(/\s*\n\s*/g, " ") }] },
  ] }).trimEnd();
  // An authored opening H1 already supplies the document title.
  const body = rewriteMarkdownUrls(source, (url) => {
    if (!url || url.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(url)) return url;
    try { return new URL(url, pageUrl).href; } catch { return url; }
  }).trim();
  return {
    filename: markdownFilename(post.title),
    markdown: `${first?.type === "heading" && first.depth === 1 ? "" : `${title}\n\n`}${body}\n`,
  };
}
