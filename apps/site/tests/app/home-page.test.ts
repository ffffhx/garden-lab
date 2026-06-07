import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "../../app/page";

const HOME_PAGE_RENDER_TIMEOUT_MS = 15_000;

describe("HomePage", () => {
  it("introduces standalone projects with their public sites", () => {
    const markup = renderToStaticMarkup(createElement(HomePage));

    expect(markup).toContain("已独立维护的项目");
    expect(markup).toContain(">会话快照</h3>");
    expect(markup).toContain('href="https://ffffhx.github.io/codex-snapshots/"');
    expect(markup).toContain(">Token榜</h3>");
    expect(markup).toContain('href="https://ffffhx.github.io/open-token-board/"');
    expect(markup).toContain(">游戏入口</h3>");
    expect(markup).toContain('href="https://ffffhx.github.io/games/"');
    expect(markup).toContain(">浏览器档案控制台</h3>");
    expect(markup).toContain('href="https://ffffhx.github.io/profilepilot/"');
  }, HOME_PAGE_RENDER_TIMEOUT_MS);
});
