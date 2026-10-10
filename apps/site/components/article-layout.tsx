import React from "react";
import { ArticleBody } from "@/components/article-body";
import { ArticleMarkdownActions } from "@/components/article-markdown-actions";
import { BuildStamp } from "@/components/build-stamp";
import { PostMeta } from "@/components/post-meta";
import { PostToc } from "@/components/post-toc";
import { PrivateBadge } from "@/components/private-feature-access";
import { TOC_MIN_HEADINGS } from "@/lib/content/config";
import type { PrivatePostData } from "@/lib/content/types";

export function ArticleLayout({ post, privateArticle = false }: { post: PrivatePostData; privateArticle?: boolean }) {
  const showToc = post.headings.length >= TOC_MIN_HEADINGS;
  const coverImage = post.cover ? (
    <div className="overflow-hidden rounded-2xl border-[1.5px] border-ink/70 bg-paper-deep">
      <img
        src={post.cover}
        alt={`${post.title} 封面`}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        className="block h-auto w-full"
      />
    </div>
  ) : null;

  return (
    <main className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:gap-8">
      <article className="riso-card riso-card--teal min-w-0 p-6 sm:p-10 2xl:p-12">
        <div className="space-y-5">
          {post.coverPosition === "above-title" ? coverImage : null}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="riso-sticker riso-sticker--terra">Post · {privateArticle ? "私密文章" : "文章"}</span>
              {privateArticle ? <PrivateBadge withText /> : null}
              <BuildStamp />
            </div>
            <h1 className="font-display max-w-[72rem] break-words text-balance text-3xl font-semibold leading-[1.06] tracking-[-0.02em] text-ink [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">
              {post.title}
            </h1>
          </div>
          {post.coverPosition === "below-title" ? coverImage : null}
          <PostMeta
            categories={post.categories}
            dateText={post.dateText}
            readingTimeText={post.readingTimeText}
            tags={post.tags}
          />
          <ArticleMarkdownActions
            key={post.slug}
            title={post.title}
            content={post.content}
            contentHtml={post.content === undefined ? post.contentHtml : undefined}
          />
        </div>
        <div className="mt-10">
          <ArticleBody
            contentImageSize={post.contentImageSize}
            html={post.contentHtml}
            slug={post.slug}
          />
        </div>
      </article>
      <div className="xl:sticky xl:top-24 xl:h-fit">
        {showToc ? <PostToc key={post.slug} headings={post.headings} contentHtml={post.contentHtml} /> : null}
      </div>
    </main>
  );
}
