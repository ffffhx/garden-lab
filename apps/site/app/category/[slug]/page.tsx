import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/post-card";
import { getAllCategories, getCategoryBySlug } from "@/lib/content/categories";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllCategories().map((category) => ({
    slug: category.slug,
  }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return {
      title: "未找到分类",
    };
  }

  return {
    title: `${category.label}`,
    description: category.description,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <div className="rounded-[2rem] border border-slate-900/10 bg-white/82 p-7 shadow-[0_32px_120px_-68px_rgba(15,23,42,0.65)]">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Category</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          {category.label}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700">
          {category.description}
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="text-sm font-semibold text-amber-800 underline decoration-amber-400/50 underline-offset-4"
          >
            返回首页
          </Link>
        </div>
      </div>
      {category.posts.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {category.posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <EmptyState title="这个分类还没有内容" description="稍后再来看看。" />
      )}
    </main>
  );
}
