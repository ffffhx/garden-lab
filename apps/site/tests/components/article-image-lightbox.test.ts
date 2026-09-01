import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArticleImageLightbox } from "../../components/article-image-lightbox";

describe("ArticleImageLightbox", () => {
  it("renders null on server-side rendering without breaking", () => {
    const markup = renderToStaticMarkup(
      createElement(ArticleImageLightbox, {
        articleContentId: "article-content-test",
      })
    );

    expect(markup).toBe("");
  });
});
