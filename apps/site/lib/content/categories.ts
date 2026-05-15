import { CATEGORY_DEFINITIONS } from "@/lib/content/config";
import type { CategoryCollection } from "@/lib/content/types";
import { getAllPosts } from "@/lib/content/posts";

export function getAllCategories() {
  const posts = getAllPosts();

  return Object.values(CATEGORY_DEFINITIONS)
    .map((definition) => {
      return {
        ...definition,
        posts: posts.filter((post) => post.categories.includes(definition.key)),
      } satisfies CategoryCollection;
    })
    .filter((collection) => collection.posts.length > 0);
}

export function getCategoryBySlug(slug: string) {
  return getAllCategories().find((collection) => collection.slug === slug) ?? null;
}
