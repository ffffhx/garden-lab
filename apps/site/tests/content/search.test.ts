import { describe, expect, it } from "vitest";

import {
  filterPostsByTitle,
  normalizeTitleSearchQuery,
} from "../../lib/content/search";

const posts = [
  { title: "OpenAI Codex 源码解析" },
  { title: "什么是 Agent Harness" },
  { title: "卧推怎么练从握距触胸到腿驱" },
];

describe("title search", () => {
  it("normalizes whitespace and casing", () => {
    expect(normalizeTitleSearchQuery("  Codex   Agent  ")).toBe("codex agent");
  });

  it("filters posts by title case-insensitively", () => {
    expect(filterPostsByTitle(posts, "codex")).toEqual([posts[0]]);
  });

  it("matches all title terms when the query has spaces", () => {
    expect(filterPostsByTitle(posts, "agent harness")).toEqual([posts[1]]);
  });

  it("does not return all posts for an empty query", () => {
    expect(filterPostsByTitle(posts, "   ")).toEqual([]);
  });
});
