import React from "react";

import { CATEGORY_DEFINITIONS } from "@/lib/content/config";
import type { CategoryKey } from "@/lib/content/types";

const categoryLabels: Record<CategoryKey, string> = {
  tech: CATEGORY_DEFINITIONS.tech.label,
  fitness: CATEGORY_DEFINITIONS.fitness.label,
  dailyNews: CATEGORY_DEFINITIONS.dailyNews.label,
};

type PostMetaProps = {
  categories: CategoryKey[];
  dateText: string;
  readingTimeText: string;
  showTags?: boolean;
  tags: string[];
};

export function PostMeta({
  categories,
  dateText,
  readingTimeText,
  showTags = true,
  tags,
}: PostMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className="rounded-full border border-[#b45f28]/15 bg-[#fff4cf] px-3 py-1 font-medium text-[#7c3b16]"
          >
            {categoryLabels[category]}
          </span>
        ))}
      </div>
      <span>{dateText}</span>
      <span>{readingTimeText}</span>
      {showTags && tags.length > 0 ? (
        <span className="text-slate-500">{tags.map((tag) => `#${tag}`).join(" ")}</span>
      ) : null}
    </div>
  );
}
