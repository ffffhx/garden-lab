import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PostToc } from "../../components/post-toc";
import type { Heading } from "../../lib/content/types";

const headings: Heading[] = [
  {
    id: "summary",
    text: "摘要",
    depth: 2,
  },
  {
    id: "layer-three",
    text: "2.3 第三层：Raw API",
    depth: 3,
  },
  {
    id: "factory",
    text: "3.1 它先建的是 Factory，而不是客户端",
    depth: 3,
  },
];

describe("PostToc", () => {
  it("renders the active heading with explicit contrast classes", () => {
    const markup = renderToStaticMarkup(createElement(PostToc, { headings }));

    expect(markup).toContain(
      'href="#summary" class="block rounded-md px-3 py-2 text-sm leading-6'
    );
    expect(markup).toContain("bg-[#fff4cf]");
    expect(markup).toContain("text-slate-950");
  });

  it("renders a scrollable toc container for long article navigation", () => {
    const markup = renderToStaticMarkup(createElement(PostToc, { headings }));

    expect(markup).toContain('aria-label="文章目录"');
    expect(markup).toContain("overflow-y-auto");
    expect(markup).toContain("overscroll-contain");
    expect(markup).toContain("max-h-[calc(100vh-7rem)]");
  });
});
