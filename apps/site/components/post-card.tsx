import React from "react";
import Link from "next/link";

import { PostMeta } from "@/components/post-meta";
import type { PostCardSummary } from "@/lib/content/types";

type PostCardProps = {
  featured?: boolean;
  post: PostCardSummary;
  priority?: boolean;
};

export function PostCard({
  featured = false,
  post,
  priority = false,
}: PostCardProps) {
  return (
    <article
      className={[
        "group min-w-0 rounded-lg border border-slate-950/10 bg-[#fffdf7]/88 p-5 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.48)] transition hover:-translate-y-1 hover:border-slate-950/18 hover:shadow-[0_32px_96px_-56px_rgba(15,23,42,0.62)] sm:p-6",
        featured ? "lg:col-span-2" : "",
      ].join(" ")}
    >
      <div
        className={[
          "h-full gap-5",
          featured && post.cover
            ? "grid lg:grid-cols-[minmax(0,0.78fr)_minmax(22rem,1.22fr)] lg:items-center"
            : "flex flex-col",
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <PostMeta
            categories={post.categories}
            dateText={post.dateText}
            readingTimeText={post.readingTimeText}
            showTags={false}
            tags={post.tags}
          />
          <div className={post.cover ? "space-y-4" : "space-y-3"}>
            <h2
              className={[
                "break-words font-semibold leading-tight tracking-tight text-slate-950 [overflow-wrap:anywhere]",
                featured ? "text-3xl sm:text-4xl" : "text-2xl",
              ].join(" ")}
            >
              <Link href={`/post/${post.slug}`} className="hover:text-[#9b481c]">
                {post.title}
              </Link>
            </h2>
            {featured || !post.cover ? (
              <p className="text-base leading-8 text-slate-700">{post.excerpt}</p>
            ) : null}
          </div>
          <div className="mt-auto">
            <Link
              href={`/post/${post.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 transition group-hover:text-[#9b481c]"
            >
              继续阅读
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        {post.cover ? (
          <Link
            href={`/post/${post.slug}`}
            className="block overflow-hidden rounded-lg border border-slate-950/10 bg-slate-100 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.55)]"
          >
            <img
              src={post.cover}
              alt={`${post.title} 封面`}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : "low"}
              className="block h-auto w-full transition duration-500 group-hover:scale-[1.018]"
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
