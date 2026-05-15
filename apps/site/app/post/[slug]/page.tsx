import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleBody } from "@/components/article-body";
import { BlogPetFeedBadge } from "@/components/blog-pet-feed-badge";
import { PostMeta } from "@/components/post-meta";
import { PostToc } from "@/components/post-toc";
import { TOC_MIN_HEADINGS } from "@/lib/content/config";
import { getAllPostSlugs, getPostBySlug } from "@/lib/content/posts";

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "未找到文章",
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const showToc = post.headings.length >= TOC_MIN_HEADINGS;
  const coverImage = post.cover ? (
    <div className="overflow-hidden rounded-lg border border-slate-950/10 bg-slate-100 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.58)]">
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
    <main className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <article className="min-w-0 rounded-lg border border-slate-950/10 bg-[#fffdf7]/92 p-6 shadow-[0_32px_120px_-72px_rgba(15,23,42,0.68)] sm:p-10">
        <div className="space-y-5">
          {post.coverPosition === "above-title" ? coverImage : null}
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Post</p>
            <h1 className="max-w-4xl break-words text-balance text-3xl font-semibold leading-[1.08] tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">
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
          <BlogPetFeedBadge post={post} />
        </div>
        <div className="mt-10">
          <ArticleBody html={post.contentHtml} />
        </div>
      </article>
      <div className="xl:sticky xl:top-24 xl:h-fit">
        {showToc ? <PostToc headings={post.headings} /> : null}
      </div>
    </main>
  );
}
