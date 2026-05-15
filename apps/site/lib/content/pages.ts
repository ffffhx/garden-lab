import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { compileMarkdown } from "@/lib/content/markdown";
import type { PageContent } from "@/lib/content/types";
import { parseDateInput } from "@/lib/utils/date";

const ABOUT_PAGE_PATH = path.join(process.cwd(), "source", "about", "index.md");

let cachedAboutPage: PageContent | null = null;

export function getAboutPage() {
  if (cachedAboutPage) {
    return cachedAboutPage;
  }

  const raw = fs.readFileSync(ABOUT_PAGE_PATH, "utf8");
  const parsed = matter(raw);
  const compiled = compileMarkdown(parsed.content, "");

  cachedAboutPage = {
    title: String(parsed.data.title || "关于"),
    date: parsed.data.date ? parseDateInput(parsed.data.date) : null,
    content: compiled.content,
    contentHtml: compiled.contentHtml,
    headings: compiled.headings,
  };

  return cachedAboutPage;
}
