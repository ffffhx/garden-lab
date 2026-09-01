import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "../../components/site-header";

describe("SiteHeader", () => {
  it("uses high-contrast hover styles for navigation links", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader));

    expect(markup).toContain("hover:bg-ink/14");
    expect(markup).toContain("hover:text-ink");
    expect(markup).not.toContain("hover:bg-slate-950");
    expect(markup).not.toContain("hover:text-white");
  });

  it("hides standalone project entries from the menu and private preview entries before owner auth resolves", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader));

    expect(markup).not.toContain('href="/games"');
    expect(markup).not.toContain(">游戏入口</a>");
    expect(markup).not.toContain('href="https://ffffhx.github.io/codex-snapshots/"');
    expect(markup).not.toContain(">会话快照</a>");
    expect(markup).not.toContain('href="https://ffffhx.github.io/open-token-board/"');
    expect(markup).not.toContain(">Token榜</a>");
    expect(markup).not.toContain('href="/pet"');
    expect(markup).not.toContain(">桌宠</a>");
  });

  it("does not render an OAuth link with a root-only return target before hydration", () => {
    const previousApiUrl = process.env.NEXT_PUBLIC_GARDEN_API_URL;
    process.env.NEXT_PUBLIC_GARDEN_API_URL = "https://api.example.com/garden-api";

    try {
      const markup = renderToStaticMarkup(createElement(SiteHeader));

      expect(markup).not.toContain("/api/auth/github/start");
      expect(markup).not.toContain("returnTo=%2F");
    } finally {
      if (previousApiUrl === undefined) {
        delete process.env.NEXT_PUBLIC_GARDEN_API_URL;
      } else {
        process.env.NEXT_PUBLIC_GARDEN_API_URL = previousApiUrl;
      }
    }
  });

  it("links daily news to the module instead of the category article list", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader));

    expect(markup).toContain('href="/daily-news"');
    expect(markup).not.toContain('href="/category/daily-news"');
  });
});
