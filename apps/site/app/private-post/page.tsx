"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ArticleBody } from "@/components/article-body";
import { BuildStamp } from "@/components/build-stamp";
import { PostMeta } from "@/components/post-meta";
import { PostToc } from "@/components/post-toc";
import {
  getAuthHeaders,
  PrivateBadge,
  PrivateFeaturePageFallback,
  usePrivateFeatureAccess,
} from "@/components/private-feature-access";
import { TOC_MIN_HEADINGS } from "@/lib/content/config";
import type { CategoryKey, ContentImageSize, Heading } from "@/lib/content/types";

type PrivatePostData = {
  slug: string;
  title: string;
  excerpt: string;
  categories: CategoryKey[];
  tags: string[];
  dateText: string;
  readingTimeText: string;
  assetBasePath: string;
  cover: string | null;
  coverPosition: "above-title" | "below-title";
  hidden: boolean;
  contentHtml: string;
  contentImageSize: ContentImageSize;
  headings: Heading[];
};

function PrivatePostContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug");
  const access = usePrivateFeatureAccess();

  const [post, setPost] = useState<PrivatePostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("未指定文章标识 (slug)");
      setLoading(false);
      return;
    }

    if (access.status === "loading") {
      return;
    }

    if (access.status !== "allowed") {
      setLoading(false);
      return;
    }

    if (!access.apiBaseUrl) {
      setError("未配置 Garden API 服务地址");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetch(`${access.apiBaseUrl}/api/private-posts/${encodeURIComponent(slug)}`, {
      credentials: "include",
      cache: "no-store",
      headers: getAuthHeaders(),
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            throw new Error("无权访问该私密文章，请登录作者账号");
          }
          if (res.status === 404) {
            throw new Error(`未找到私密文章「${slug}」，可能未同步至服务端数据目录`);
          }
          throw new Error(`加载文章失败 (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((data: PrivatePostData) => {
        if (active) {
          setPost(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "加载文章失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [access.apiBaseUrl, access.status, slug]);

  if (access.status === "loading" || (loading && !error)) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="riso-card riso-card--teal animate-pulse space-y-6 p-6 sm:p-10">
          <div className="h-4 w-28 rounded bg-ink/10" />
          <div className="h-10 w-3/4 rounded bg-ink/15" />
          <div className="h-5 w-48 rounded bg-ink/10" />
          <div className="space-y-3 pt-6">
            <div className="h-4 w-full rounded bg-ink/10" />
            <div className="h-4 w-5/6 rounded bg-ink/10" />
            <div className="h-4 w-4/6 rounded bg-ink/10" />
          </div>
        </div>
      </main>
    );
  }

  if (access.status !== "allowed") {
    return <PrivateFeaturePageFallback />;
  }

  if (error || !post) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center p-4">
        <section className="w-full rounded-[1.25rem] border border-ink/20 bg-paper-soft p-8 text-center shadow-lg">
          <span className="riso-sticker riso-sticker--terra">Error · 提示</span>
          <h1 className="font-display mt-4 text-2xl font-semibold text-ink">
            无法读取私密文章
          </h1>
          <p className="mt-3 text-sm text-ink-soft">{error || "未知错误"}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold !text-paper-soft transition hover:bg-red"
            >
              返回首页
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const showToc = post.headings && post.headings.length >= TOC_MIN_HEADINGS;
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
              <span className="riso-sticker riso-sticker--terra">Post · 私密文章</span>
              <PrivateBadge withText />
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
        </div>
        <div className="mt-10">
          <ArticleBody
            contentImageSize={post.contentImageSize}
            enableAiChat
            excerpt={post.excerpt}
            headings={post.headings}
            html={post.contentHtml}
            slug={post.slug}
            title={post.title}
          />
        </div>
      </article>
      <div className="xl:sticky xl:top-24 xl:h-fit">
        {showToc ? <PostToc headings={post.headings} /> : null}
      </div>
    </main>
  );
}

export default function PrivatePostPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <div className="riso-card riso-card--teal animate-pulse p-10">
            <div className="h-6 w-32 rounded bg-ink/10" />
          </div>
        </main>
      }
    >
      <PrivatePostContent />
    </Suspense>
  );
}
