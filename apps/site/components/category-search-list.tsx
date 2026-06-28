"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/post-card";
import { filterPostsByTitle } from "@/lib/content/search";
import type { PostCardSummary } from "@/lib/content/types";

const ACCENT_CYCLE = ["teal", "pink", "terra", "yellow"] as const;

type CategorySearchListProps = {
  posts: PostCardSummary[];
  label: string;
};

export function CategorySearchList({ posts, label }: CategorySearchListProps) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed ? filterPostsByTitle(posts, query) : posts),
    [posts, query, trimmed]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-ink/15 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:max-w-sm">
          <span className="sr-only">在「{label}」里按标题搜索</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={`在「${label}」里搜索标题…`}
            className="min-h-11 w-full rounded-full border border-ink/60 bg-paper-soft px-4 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-red focus:ring-4 focus:ring-red/12"
          />
        </label>
        <p className="font-mono-ui shrink-0 text-xs uppercase tracking-[0.1em] text-muted">
          {trimmed ? `匹配 ${results.length} 篇` : `共 ${posts.length} 篇`}
        </p>
      </div>

      {results.length > 0 ? (
        <div className="grid gap-x-6 gap-y-8 lg:grid-cols-2">
          {results.map((post, index) => (
            <PostCard
              key={post.slug}
              accent={ACCENT_CYCLE[index % ACCENT_CYCLE.length]}
              post={post}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={trimmed ? "没有匹配的文章" : "这个分类还没有内容"}
          description={trimmed ? "换一个标题关键词再试。" : "稍后再来看看。"}
        />
      )}
    </div>
  );
}
