import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArticleBody } from "../../components/article-body";
import type { Heading } from "../../lib/content/types";

const headings: Heading[] = [
  {
    depth: 2,
    id: "overview",
    text: "背景",
  },
];

describe("ArticleBody", () => {
  it("renders article text and gates the AI chat entry point", () => {
    const markup = renderToStaticMarkup(
      createElement(ArticleBody, {
        enableAiChat: true,
        excerpt: "一段摘要",
        headings,
        html: "<p>正文内容</p>",
        slug: "demo-post",
        title: "Demo Post",
      })
    );

    expect(markup).toContain('id="article-content-demo-post"');
    expect(markup).toContain('data-content-image-size="default"');
    expect(markup).toContain("正文内容");
    expect(markup).not.toContain('aria-label="打开文章问答"');
    expect(markup).not.toContain('aria-label="文章问答"');
    expect(markup).not.toContain("问文章");
  });
});
