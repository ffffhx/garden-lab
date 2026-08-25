"use client";

import React, { useMemo } from "react";

import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/post-card";
import { usePrivatePosts } from "@/components/private-feature-access";
import type { PostCardSummary } from "@/lib/content/types";

type LatestArticlesListProps = {
  initialPosts: PostCardSummary[];
  priorityCoverSlug?: string;
};

export function LatestArticlesList({
  initialPosts,
  priorityCoverSlug,
}: LatestArticlesListProps) {
  const { privatePosts, isAllowed } = usePrivatePosts();

  const posts = useMemo(() => {
    if (!isAllowed || !privatePosts.length) {
      return initialPosts;
    }

    const existingSlugs = new Set(initialPosts.map((p) => p.slug));
    const newPrivate = privatePosts.filter((p) => !existingSlugs.has(p.slug));

    return [...newPrivate, ...initialPosts];
  }, [initialPosts, isAllowed, privatePosts]);

  if (posts.length === 0) {
    return <EmptyState title="还没有文章" description="内容会在这里出现。" />;
  }

  return (
    <div className="grid min-w-0 gap-x-6 gap-y-8 lg:grid-cols-2">
      {posts.map((post) => (
        <PostCard
          key={post.slug}
          post={post}
          priority={post.slug === priorityCoverSlug}
        />
      ))}
    </div>
  );
}
