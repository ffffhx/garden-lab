import { describe, expect, it } from "vitest";

import {
  buildAgentPostIndex,
  extractDailyNewsDateSlugFromPathname,
  extractPostSlugFromPathname,
  getAgentPostBySlug,
  isDailyNewsIndexPathname,
  listRecentAgentPosts,
  normalizeAgentCategory,
  searchAgentPosts,
  type AgentPostIndexSource,
} from "../../lib/content/agent-tools";

const posts: AgentPostIndexSource[] = [
  {
    slug: "openai-codex-source",
    title: "OpenAI Codex 源码解析",
    excerpt: "本地 Agent harness 如何组织工具调用。",
    categories: ["tech"],
    tags: ["Codex", "Agent"],
    dateText: "2026-04-15",
    date: new Date(2026, 3, 15, 12),
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
    date: new Date(2026, 3, 16, 12),
    readingTimeText: "4 min read",
    assetBasePath: "/post-assets/bench-press",
    cover: null,
    coverPosition: "above-title",
  },
  {
    slug: "daily-ai-news",
    title: "每日新闻：2026-04-24 AI 与前端热点速览",
    excerpt: "每日新闻与工程圈观察。",
    categories: ["dailyNews"],
    tags: ["AI", "前端"],
    dateText: "2026-04-24",
    date: new Date(2026, 3, 24, 12),
    readingTimeText: "3 min read",
    assetBasePath: "/post-assets/daily-ai-news",
    cover: null,
    coverPosition: "above-title",
  },
  {
    slug: "codex-monthly-update",
    title: "Codex 和 Claude Code 最近一个月更新了什么",
    excerpt: "月度工作台观察。",
    categories: ["dailyNews"],
    tags: ["Codex", "Claude Code"],
    dateText: "2026-04-24",
    date: new Date(2026, 3, 24, 12),
    readingTimeText: "10 min read",
    assetBasePath: "/post-assets/codex-monthly-update",
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
    expect(index[2]).toMatchObject({
      slug: "daily-ai-news",
      dailyNewsDateSlug: "2026-04-24",
      url: "/garden-lab/daily-news/2026-04-24/",
    });
    expect(index[3]).toMatchObject({
      slug: "codex-monthly-update",
      url: "/garden-lab/post/codex-monthly-update/",
    });
    expect(index[3].dailyNewsDateSlug).toBeUndefined();
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
    expect(
      extractDailyNewsDateSlugFromPathname("/garden-lab/daily-news/2026-04-24/", "/garden-lab")
    ).toBe("2026-04-24");
    expect(isDailyNewsIndexPathname("/garden-lab/daily-news/", "/garden-lab")).toBe(true);
  });
});
