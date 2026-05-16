import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/post-card";
import { getAllCategories } from "@/lib/content/categories";
import { SITE } from "@/lib/content/config";
import { getAllPosts } from "@/lib/content/posts";
import { withBasePath } from "@/lib/utils/site-path";

export default function HomePage() {
  const posts = getAllPosts();
  const categories = getAllCategories();
  const featuredPosts = posts.slice(0, 8);
  const priorityCoverSlug = featuredPosts.find((post) => post.cover)?.slug;

  return (
    <main className="min-w-0 space-y-12">
      <section className="relative overflow-hidden rounded-lg border border-slate-950/15 bg-slate-950 text-white shadow-[0_40px_120px_-72px_rgba(15,23,42,0.95)]">
        <div className="absolute left-0 top-20 hidden h-24 w-16 border-y border-white/45 bg-white/80 mix-blend-screen lg:block" />
        <div className="absolute bottom-0 right-0 h-40 w-40 bg-[#b45f28]/35 blur-3xl" />
        <div
          className="relative grid gap-8 bg-cover bg-center px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)] lg:px-12 lg:py-12"
          style={{ backgroundImage: `url('${withBasePath("/images/banner.svg")}')` }}
        >
          <div className="space-y-6 rounded-lg border border-white/12 bg-slate-950/60 p-5 backdrop-blur-sm sm:p-6 lg:p-7">
            <p className="text-sm uppercase tracking-[0.28em] text-white/68">{SITE.subtitle}</p>
            <h1 className="max-w-4xl break-words text-balance text-4xl font-semibold leading-[1.08] tracking-tight [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">
              {SITE.description}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-white/78 sm:text-lg">写作、实验、训练和观察都留在同一张工作台上。</p>
          </div>
          <div className="rounded-lg border border-white/12 bg-white/12 p-5 backdrop-blur-md sm:p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-white/68">内容分区</p>
            <div className="mt-5 space-y-3">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/category/${category.slug}`}
                  className="group block rounded-lg border border-white/14 bg-white/8 px-5 py-4 transition hover:-translate-y-0.5 hover:border-white/28 hover:bg-white/16"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold">{category.label}</h2>
                    <span className="rounded-full bg-white/14 px-3 py-1 text-sm text-white/80 transition group-hover:bg-white/22">
                      {category.posts.length} 篇
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-white/72">
                    {category.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Latest Writing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">最新文章</h2>
          </div>
        </div>
        {featuredPosts.length > 0 ? (
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            {featuredPosts.map((post, index) => (
              <PostCard
                key={post.slug}
                featured={index === 0}
                post={post}
                priority={post.slug === priorityCoverSlug}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="还没有文章" description="内容会在这里出现。" />
        )}
      </section>
    </main>
  );
}
