import type { Metadata } from "next";

import { PostTitleSearch } from "@/components/post-title-search";
import { getArticlePosts } from "@/lib/content/posts";
import type { PostCardSummary } from "@/lib/content/types";

export const metadata: Metadata = {
  title: "搜索",
  description: "按标题搜索技术与健身文章",
};

export default function SearchPage() {
  const posts: PostCardSummary[] = getArticlePosts().map(({ date, ...post }) => post);

  return <PostTitleSearch posts={posts} />;
}
