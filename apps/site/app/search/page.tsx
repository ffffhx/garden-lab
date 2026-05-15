import type { Metadata } from "next";

import { PostTitleSearch } from "@/components/post-title-search";
import { getAllPosts } from "@/lib/content/posts";
import type { PostCardSummary } from "@/lib/content/types";

export const metadata: Metadata = {
  title: "搜索",
  description: "按标题搜索文章",
};

export default function SearchPage() {
  const posts: PostCardSummary[] = getAllPosts().map(({ date, ...post }) => post);

  return <PostTitleSearch posts={posts} />;
}
