import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PostCard } from "../../components/post-card";
import type { PostSummary } from "../../lib/content/types";

const basePost: PostSummary = {
  slug: "cover-post",
  title: "封面文章标题",
  excerpt: "这是一段摘要。",
  categories: ["tech"],
  tags: ["AI"],
  date: new Date("2026-04-22T00:00:00.000Z"),
  dateText: "2026年4月22日",
  readingTimeText: "26 min read",
  assetBasePath: "/post-assets/cover-post",
  cover: "/post-assets/cover-post/cover.webp",
  coverPosition: "below-title",
};

describe("PostCard", () => {
  it("renders a title link for posts with cover images", () => {
    const markup = renderToStaticMarkup(createElement(PostCard, { post: basePost }));

    expect(markup).toContain("<h2");
    expect(markup).toContain('href="/post/cover-post"');
    expect(markup).toContain(">封面文章标题</a>");
  });

  it("hides tags in list cards", () => {
    const markup = renderToStaticMarkup(createElement(PostCard, { post: basePost }));

    expect(markup).not.toContain("#AI");
  });
});
