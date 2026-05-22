import { ArticleSelectionTooltip } from "@/components/article-selection-tooltip";

type ArticleBodyProps = {
  html: string;
  slug: string;
  title: string;
};

export function ArticleBody({ html, slug, title }: ArticleBodyProps) {
  return (
    <ArticleSelectionTooltip slug={slug} title={title}>
      <div
        className="article-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ArticleSelectionTooltip>
  );
}
