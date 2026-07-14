import React from "react";

import { ArticleAiChat } from "@/components/article-ai-chat";
import { ArticleQuizEnhancer } from "@/components/article-quiz-enhancer";
import { ArticleSelectionTooltip } from "@/components/article-selection-tooltip";
import { BenchHeatmapTooltip } from "@/components/bench-heatmap-tooltip";
import { BenchReveal } from "@/components/bench-reveal";
import { PrivateFeatureGate } from "@/components/private-feature-access";
import { RequestGatesLab } from "@/components/request-gates-lab";
import type { ContentImageSize, Heading } from "@/lib/content/types";

type ArticleBodyProps = {
  enableAiChat?: boolean;
  contentImageSize?: ContentImageSize;
  excerpt?: string;
  headings?: Heading[];
  html: string;
  slug: string;
  title: string;
};

function toArticleContentId(slug: string) {
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");

  return `article-content-${safeSlug || "post"}`;
}

export function ArticleBody({
  contentImageSize = "default",
  enableAiChat = false,
  excerpt,
  headings = [],
  html,
  slug,
  title,
}: ArticleBodyProps) {
  const articleContentId = toArticleContentId(slug);

  return (
    <>
      <ArticleSelectionTooltip slug={slug} title={title}>
        <div
          className="article-content"
          data-content-image-size={contentImageSize}
          dangerouslySetInnerHTML={{ __html: html }}
          id={articleContentId}
        />
      </ArticleSelectionTooltip>
      <ArticleQuizEnhancer articleContentId={articleContentId} />
      <BenchHeatmapTooltip articleContentId={articleContentId} />
      <BenchReveal articleContentId={articleContentId} />
      <RequestGatesLab articleContentId={articleContentId} />
      {enableAiChat ? (
        <PrivateFeatureGate>
          <ArticleAiChat
            articleContentId={articleContentId}
            excerpt={excerpt ?? ""}
            headings={headings}
            slug={slug}
            title={title}
          />
        </PrivateFeatureGate>
      ) : null}
    </>
  );
}
