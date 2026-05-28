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
});
