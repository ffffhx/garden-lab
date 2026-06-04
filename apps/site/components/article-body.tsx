import React from "react";

import { ArticleAiChat } from "@/components/article-ai-chat";
import { ArticleSelectionTooltip } from "@/components/article-selection-tooltip";
import type { Heading } from "@/lib/content/types";

type ArticleBodyProps = {
  enableAiChat?: boolean;
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
          dangerouslySetInnerHTML={{ __html: html }}
          id={articleContentId}
        />
      </ArticleSelectionTooltip>
      {enableAiChat ? (
        <ArticleAiChat
          articleContentId={articleContentId}
          excerpt={excerpt ?? ""}
          headings={headings}
          slug={slug}
          title={title}
        />
      ) : null}
    </>
  );
}
