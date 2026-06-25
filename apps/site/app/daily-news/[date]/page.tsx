import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DailyNewsModule } from "@/components/daily-news-module";
import {
  getAllDailyNewsDateSlugs,
  getDailyNewsEntries,
  getDailyNewsPostByDateSlug,
} from "@/lib/content/daily-news";

type DailyNewsDatePageProps = {
  params: Promise<{ date: string }>;
};

export function generateStaticParams() {
  return getAllDailyNewsDateSlugs().map((date) => ({ date }));
}

export async function generateMetadata({
  params,
}: DailyNewsDatePageProps): Promise<Metadata> {
  const { date } = await params;
  const post = getDailyNewsPostByDateSlug(date);

  if (!post) {
    return {
      title: "未找到每日新闻",
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function DailyNewsDatePage({ params }: DailyNewsDatePageProps) {
  const { date } = await params;
  const entries = getDailyNewsEntries();
  const post = getDailyNewsPostByDateSlug(date);

  if (!post) {
    notFound();
  }

  return <DailyNewsModule entries={entries} post={post} />;
}
