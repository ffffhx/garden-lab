import React from "react";

import { CATEGORY_DEFINITIONS } from "@/lib/content/config";
import type { CategoryKey } from "@/lib/content/types";

const categoryLabels: Record<CategoryKey, string> = {
  tech: CATEGORY_DEFINITIONS.tech.label,
  fitness: CATEGORY_DEFINITIONS.fitness.label,
  dailyNews: CATEGORY_DEFINITIONS.dailyNews.label,
};

const categoryColor: Record<CategoryKey, string> = {
  tech: "riso-sticker--teal",
  fitness: "riso-sticker--terra",
  dailyNews: "riso-sticker--pink",
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <span key={category} className={`riso-sticker ${categoryColor[category]}`}>
            {categoryLabels[category]}
          </span>
        ))}
      </div>
      <span className="font-mono-ui inline-flex items-center gap-2 text-[0.78rem] tracking-[0.02em] text-muted">
        <span aria-hidden="true" className="text-red/60">✦</span>
        {dateText}
        <span aria-hidden="true" className="text-ink/60">✦</span>
        {readingTimeText}
      </span>
      {showTags && tags.length > 0 ? (
        <span className="text-muted/70">{tags.map((tag) => `#${tag}`).join(" ")}</span>
      ) : null}
    </div>
  );
}
