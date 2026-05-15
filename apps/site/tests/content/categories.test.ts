import { describe, expect, it } from "vitest";

import { getAllCategories } from "../../lib/content/categories";
import { getAllPosts } from "../../lib/content/posts";

describe("getAllCategories", () => {
  it("builds category collections from post metadata", () => {
    const categories = getAllCategories();

    expect(categories.map((item) => item.slug)).toContain("tech");
    expect(categories.map((item) => item.slug)).toContain("fitness");
  });
});

describe("asset urls", () => {
  it("assigns derived post asset base paths", () => {
    const post = getAllPosts().find((item) => item.assetBasePath.includes("/post-assets/"));

    expect(post).toBeDefined();
    expect(post?.assetBasePath.startsWith("/post-assets/")).toBe(true);
  });
});
