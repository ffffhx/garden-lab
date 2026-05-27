import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "../../components/site-header";

describe("SiteHeader", () => {
  it("uses high-contrast hover styles for navigation links", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader));

    expect(markup).toContain("hover:bg-amber-100");
    expect(markup).toContain("hover:text-slate-950");
    expect(markup).not.toContain("hover:bg-slate-950");
    expect(markup).not.toContain("hover:text-white");
  });

  it("keeps the games entry public and hides private preview entries before owner auth resolves", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader));

    expect(markup).toContain('href="/games"');
    expect(markup).toContain(">游戏入口</a>");
    expect(markup).not.toContain('href="/pet"');
    expect(markup).not.toContain(">桌宠</a>");
    expect(markup).toContain('href="/token-leaderboard"');
  });

  it("links the snapshots entry to the standalone project site", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader));

    expect(markup).toContain('href="https://ffffhx.github.io/codex-snapshots/"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain(">会话快照</a>");
  });

  it("highlights the token leaderboard link on the token leaderboard page", () => {
    const markup = renderToStaticMarkup(
      createElement(SiteHeader, { currentPathname: "/token-leaderboard" })
    );

    expect(markup).toContain('href="/token-leaderboard"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("bg-slate-950");
    expect(markup).toContain("!text-white");
  });
});
