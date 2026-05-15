import { describe, expect, it } from "vitest";

import { getAllPosts, getPostBySlug } from "../../lib/content/posts";

const POST_SCAN_TIMEOUT_MS = 15_000;

describe("getAllPosts", () => {
  it("loads and sorts posts by date descending", () => {
    const posts = getAllPosts();

    expect(posts.length).toBeGreaterThan(1);
    expect(posts[0].date.getTime()).toBeGreaterThanOrEqual(posts[1].date.getTime());
  }, POST_SCAN_TIMEOUT_MS);
});

describe("getPostBySlug", () => {
  it("returns a known post body by slug", () => {
    const firstPost = getAllPosts()[0];
    const post = getPostBySlug(firstPost.slug);

    expect(post).not.toBeNull();
    expect(post?.title.length).toBeGreaterThan(0);
    expect(post?.contentHtml.length).toBeGreaterThan(0);
  }, POST_SCAN_TIMEOUT_MS);

  it("loads post cover metadata when configured", () => {
    const post = getAllPosts().find(
      (item) => item.title === "从 ChatGPT 到 Codex：AI 使用方式是怎么一步步变化的"
    );

    expect(post).not.toBeNull();
    expect(post?.cover).toContain("/cover-v2.webp");
    expect(post?.coverPosition).toBe("below-title");
  }, POST_SCAN_TIMEOUT_MS);
});
