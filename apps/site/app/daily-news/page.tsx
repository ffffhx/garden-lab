import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DailyNewsModule } from "@/components/daily-news-module";
import { CATEGORY_DEFINITIONS } from "@/lib/content/config";
import { getDailyNewsEntries, getLatestDailyNewsPost } from "@/lib/content/daily-news";

export const metadata: Metadata = {
  title: CATEGORY_DEFINITIONS.dailyNews.label,
  description: CATEGORY_DEFINITIONS.dailyNews.description,
};

export default function DailyNewsPage() {
  const entries = getDailyNewsEntries();
  const post = getLatestDailyNewsPost();

  if (!post) {
    notFound();
  }

  return <DailyNewsModule entries={entries} post={post} />;
}
