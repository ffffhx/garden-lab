import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";

import {
  CATEGORY_LABEL_TO_KEY,
  CATEGORY_DEFINITIONS,
} from "@/lib/content/config";
import {
  getPostAssetBasePath,
  resolveOptimizedPostAssetUrl,
} from "@/lib/content/assets";
import { compileMarkdown } from "@/lib/content/markdown";
import { ensureUniqueSlug, slugifyPostStem } from "@/lib/content/slug";
import type {
  CategoryKey,
  CoverPosition,
  Post,
  PostSummary,
} from "@/lib/content/types";
import { formatDate, parseDateInput } from "@/lib/utils/date";

const POSTS_ROOT = path.join(process.cwd(), "source", "_posts");

let cachedPosts: Post[] | null = null;

function walkMarkdownFiles(dir: string, files: string[] = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkMarkdownFiles(fullPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeCategories(input: unknown) {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  return values
    .map((value) => CATEGORY_LABEL_TO_KEY[String(value).trim()])
    .filter(Boolean) as CategoryKey[];
}

function normalizeTags(input: unknown) {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  return values.map((value) => String(value).trim()).filter(Boolean);
}

function normalizeCoverPosition(input: unknown): CoverPosition {
  return input === "below-title" ? "below-title" : "above-title";
}

function deriveExcerpt(explicitExcerpt: unknown, content: string) {
  const explicit = String(explicitExcerpt ?? "").trim();
  if (explicit) {
    return explicit.replace(/^"|"$/g, "");
  }

  const normalized = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => {
      return (
        block &&
        !block.startsWith("#") &&
        !block.startsWith("{%") &&
        !block.startsWith("```")
      );
    });

  return (normalized ?? "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[`*_>#-]/g, "")
    .slice(0, 160)
    .trim();
}

function decodeContentForReadingTime(content: string) {
  try {
    return decodeURI(content);
  } catch {
    return content;
  }
}

function toSummary(post: Post): PostSummary {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    categories: post.categories,
    tags: post.tags,
    date: post.date,
    dateText: post.dateText,
    readingTimeText: post.readingTimeText,
    assetBasePath: post.assetBasePath,
    cover: post.cover,
    coverPosition: post.coverPosition,
  };
}

function loadPosts() {
  const markdownFiles = walkMarkdownFiles(POSTS_ROOT);
  const takenSlugs = new Set<string>();

  return markdownFiles
    .map((filePath) => {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);
      const relativePath = path.relative(POSTS_ROOT, filePath);
      const date = parseDateInput(parsed.data.date);
      const assetBasePath = getPostAssetBasePath(relativePath);
      const compiled = compileMarkdown(parsed.content, assetBasePath);
      const slug = ensureUniqueSlug(
        slugifyPostStem(path.parse(filePath).name),
        relativePath,
        takenSlugs
      );
      const categories = normalizeCategories(parsed.data.categories);
      const tags = normalizeTags(parsed.data.tags);
      const cover = resolveOptimizedPostAssetUrl(assetBasePath, parsed.data.cover);
      const coverPosition = normalizeCoverPosition(parsed.data.coverPosition);
      const reading = readingTime(decodeContentForReadingTime(compiled.content));

      return {
        slug,
        title: String(parsed.data.title || path.parse(filePath).name),
        excerpt: deriveExcerpt(parsed.data.excerpt, compiled.content),
        categories: categories.length ? categories : [CATEGORY_DEFINITIONS.tech.key],
        tags,
        date,
        dateText: formatDate(date),
        readingTimeText: reading.text,
        assetBasePath,
        cover,
        coverPosition,
        content: compiled.content,
        contentHtml: compiled.contentHtml,
        headings: compiled.headings,
        sourcePath: relativePath,
      } satisfies Post;
    })
    .sort((left, right) => right.date.getTime() - left.date.getTime());
}

function getPostRecords() {
  if (!cachedPosts) {
    cachedPosts = loadPosts();
  }

  return cachedPosts;
}

export function getAllPosts() {
  return getPostRecords().map(toSummary);
}

export function getAllPostSlugs() {
  return getPostRecords().map((post) => post.slug);
}

export function getPostBySlug(slug: string) {
  return getPostRecords().find((post) => post.slug === slug) ?? null;
}
