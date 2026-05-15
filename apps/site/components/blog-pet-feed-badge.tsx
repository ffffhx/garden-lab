import Link from "next/link";

import { PrivateFeatureGate } from "@/components/private-feature-access";
import { buildBlogPetMeal } from "@/lib/content/blog-pet";
import type { PostSummary } from "@/lib/content/types";

type BlogPetFeedBadgeProps = {
  post: PostSummary;
};

export function BlogPetFeedBadge({ post }: BlogPetFeedBadgeProps) {
  const meal = buildBlogPetMeal(post);

  return (
    <PrivateFeatureGate>
      <Link
        href="/pet"
        className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-amber-300 hover:bg-amber-100"
      >
        <span className="text-amber-900">这篇喂了桌宠：</span>
        <span className="min-w-0 text-slate-950">{meal.summary}</span>
      </Link>
    </PrivateFeatureGate>
  );
}
