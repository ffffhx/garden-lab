import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategorySearchList } from "@/components/category-search-list";
import { DailyNewsModule } from "@/components/daily-news-module";
import { CATEGORY_DEFINITIONS } from "@/lib/content/config";
import { getAllCategories, getCategoryBySlug } from "@/lib/content/categories";
import { getDailyNewsEntries, getLatestDailyNewsPost } from "@/lib/content/daily-news";

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

const CATEGORY_COLORS: Record<string, "terra" | "teal" | "pink" | "yellow"> = {
  tech: "teal",
  fitness: "terra",
  "daily-news": "pink",
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  if (category.slug === CATEGORY_DEFINITIONS.dailyNews.slug) {
    const entries = getDailyNewsEntries();
    const post = getLatestDailyNewsPost();

    if (!post) {
      notFound();
    }

    return <DailyNewsModule entries={entries} post={post} />;
  }

  const color = CATEGORY_COLORS[category.slug] ?? "yellow";

  return (
    <main className="space-y-6">
      <div className={`riso-card riso-card--${color} relative overflow-hidden p-7 sm:p-9`}>
        <div className="riso-blob -right-10 -top-12 h-44 w-44" style={{ background: `var(--riso-${color})`, opacity: 0.4 }} />
        <div className="halftone pointer-events-none absolute inset-0 opacity-[0.4] mix-blend-multiply" />
        <div className="relative">
          <span className={`riso-sticker riso-sticker--${color}`}>Category · 分区</span>
          <h1 className="font-display mt-4 text-4xl font-semibold tracking-[-0.015em] text-ink sm:text-5xl">
            {category.label}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-ink-soft">
            {category.description}
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="font-mono-ui inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-ink/70 transition hover:gap-2.5 hover:text-red"
            >
              <span aria-hidden="true">←</span> 返回首页
            </Link>
          </div>
        </div>
      </div>
      <CategorySearchList
        posts={category.posts}
        label={category.label}
        categoryKey={category.key}
      />
    </main>
  );
}
