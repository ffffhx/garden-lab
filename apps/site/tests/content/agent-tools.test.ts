import { describe, expect, it } from "vitest";

import {
  buildAgentPostIndex,
  extractPostSlugFromPathname,
  getAgentPostBySlug,
  listRecentAgentPosts,
  normalizeAgentCategory,
  searchAgentPosts,
} from "../../lib/content/agent-tools";
import type { PostCardSummary } from "../../lib/content/types";

const posts: PostCardSummary[] = [
  {
    slug: "openai-codex-source",
    title: "OpenAI Codex 源码解析",
    excerpt: "本地 Agent harness 如何组织工具调用。",
    categories: ["tech"],
    tags: ["Codex", "Agent"],
    dateText: "2026-04-15",
    readingTimeText: "6 min read",
    assetBasePath: "/post-assets/openai-codex-source",
    cover: null,
    coverPosition: "above-title",
  },
  {
    slug: "bench-press",
    title: "卧推怎么练",
    excerpt: "从握距、触胸到腿驱。",
    categories: ["fitness"],
    tags: ["训练"],
    dateText: "2026-04-16",
    readingTimeText: "4 min read",
    assetBasePath: "/post-assets/bench-press",
    cover: null,
    coverPosition: "above-title",
  },
  {
    slug: "daily-ai-news",
    title: "AI 与前端热点速览",
    excerpt: "每日新闻与工程圈观察。",
    categories: ["dailyNews"],
    tags: ["AI", "前端"],
    dateText: "2026-04-24",
    readingTimeText: "3 min read",
    assetBasePath: "/post-assets/daily-ai-news",
    cover: null,
    coverPosition: "above-title",
  },
];

describe("agent post tools", () => {
  const index = buildAgentPostIndex(posts, "/garden-lab");

  it("builds machine-readable post summaries with base-path URLs", () => {
    expect(index[0]).toMatchObject({
      slug: "openai-codex-source",
      url: "/garden-lab/post/openai-codex-source/",
      categories: [{ key: "tech", slug: "tech", label: "技术" }],
    });
  });

  it("normalizes category keys, slugs, and labels", () => {
    expect(normalizeAgentCategory("tech")).toBe("tech");
    expect(normalizeAgentCategory("daily-news")).toBe("dailyNews");
    expect(normalizeAgentCategory("健身")).toBe("fitness");
  });

  it("searches across title, excerpt, tags, and category labels", () => {
    expect(searchAgentPosts(index, { query: "agent" })).toEqual([index[0]]);
    expect(searchAgentPosts(index, { query: "前端" })).toEqual([index[2]]);
    expect(searchAgentPosts(index, { query: "训练" })).toEqual([index[1]]);
  });

  it("filters search and recent posts by category", () => {
    expect(searchAgentPosts(index, { query: "AI", category: "daily-news" })).toEqual([
      index[2],
    ]);
    expect(listRecentAgentPosts(index, { category: "fitness" })).toEqual([
      index[1],
    ]);
  });

  it("finds posts by slug and extracts slugs from base-path URLs", () => {
    expect(getAgentPostBySlug(index, "bench-press")).toBe(index[1]);
    expect(extractPostSlugFromPathname("/garden-lab/post/bench-press/", "/garden-lab")).toBe(
      "bench-press"
    );
  });
});
