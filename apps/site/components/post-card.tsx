import React from "react";
import Link from "next/link";

import { PostMeta } from "@/components/post-meta";
import { PrivateBadge } from "@/components/private-feature-access";
import type { PostCardSummary } from "@/lib/content/types";

type RisoColor = "terra" | "teal" | "pink" | "yellow";

type PostCardProps = {
  featured?: boolean;
  post: PostCardSummary;
  priority?: boolean;
  accent?: RisoColor;
};

export function PostCard({
  featured = false,
  post,
  priority = false,
  accent = "teal",
}: PostCardProps) {
  const href = post.hidden ? `/private-post?slug=${post.slug}` : `/post/${post.slug}`;

  return (
    <article
      className={[
        "riso-card group min-w-0 p-5 sm:p-6",
        `riso-card--${accent}`,
        featured ? "lg:col-span-2" : "",
      ].join(" ")}
    >
      <div
        className={[
          "h-full gap-6",
          featured && post.cover
            ? "grid lg:grid-cols-[minmax(0,0.78fr)_minmax(22rem,1.22fr)] lg:items-center"
            : "flex flex-col",
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PostMeta
              categories={post.categories}
              dateText={post.dateText}
              readingTimeText={post.readingTimeText}
              showTags={false}
              tags={post.tags}
            />
            {post.hidden ? <PrivateBadge withText /> : null}
          </div>
          <div className={post.cover ? "space-y-4" : "space-y-3"}>
            <h2
              className={[
                "font-display break-words font-semibold leading-[1.12] tracking-[-0.015em] text-ink [overflow-wrap:anywhere]",
                featured ? "text-3xl sm:text-[2.6rem]" : "text-2xl",
              ].join(" ")}
            >
              <Link href={href} className="transition-colors hover:text-red">
                {post.title}
              </Link>
            </h2>
            {featured || !post.cover ? (
              <p className="text-[0.98rem] leading-8 text-ink-soft">{post.excerpt}</p>
            ) : null}
          </div>
          <div className="mt-auto">
            <Link
              href={href}
              className="font-mono-ui inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink transition-all group-hover:gap-3 group-hover:text-red"
            >
              继续阅读
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        {post.cover ? (
          <Link
            href={href}
            className="block overflow-hidden rounded-2xl border-[1.5px] border-ink/70 bg-paper-deep"
          >
            <img
              src={post.cover}
              alt={`${post.title} 封面`}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : "low"}
              className="block h-auto w-full transition duration-500 group-hover:scale-[1.02]"
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
