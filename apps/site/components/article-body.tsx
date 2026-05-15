export function ArticleBody({ html }: { html: string }) {
  return (
    <div
      className="article-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
