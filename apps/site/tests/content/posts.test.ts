import { describe, expect, it } from "vitest";

import {
  getAllPosts,
  getArticlePosts,
  getDailyNewsPosts,
  getPostBySlug,
} from "../../lib/content/posts";

const POST_SCAN_TIMEOUT_MS = 45_000;

describe("getAllPosts", () => {
  it("loads and sorts posts by date descending", () => {
    const posts = getAllPosts();

    expect(posts.length).toBeGreaterThan(1);
    expect(posts[0].date.getTime()).toBeGreaterThanOrEqual(posts[1].date.getTime());
  }, POST_SCAN_TIMEOUT_MS);

  it("separates articles from daily news", () => {
    const articles = getArticlePosts();
    const dailyNews = getDailyNewsPosts();

    expect(articles.length).toBeGreaterThan(0);
    expect(dailyNews.length).toBeGreaterThan(0);
    expect(articles.every((post) => !post.categories.includes("dailyNews"))).toBe(true);
    expect(
      articles.every((post) => {
        return post.categories.some((category) => category === "tech" || category === "fitness");
      })
    ).toBe(true);
    expect(dailyNews.every((post) => post.categories.includes("dailyNews"))).toBe(true);
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

  it("loads article-level content image sizing metadata", () => {
    const post = getPostBySlug("claude-code");

    expect(post).not.toBeNull();
    expect(post?.contentImageSize).toBe("phone-screenshot");
  }, POST_SCAN_TIMEOUT_MS);
});
