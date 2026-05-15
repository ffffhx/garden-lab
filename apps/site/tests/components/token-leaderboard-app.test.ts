import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TokenLeaderboardApp } from "../../components/token-leaderboard-app";
import publicLeaderboard from "../../public/stats/token-leaderboard.json";

const initialNow = "2026-05-14T12:00:00.000Z";
(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("TokenLeaderboardApp", () => {
  it("renders loading instead of fake users before real data is ready", () => {
    const markup = renderToStaticMarkup(
      React.createElement(TokenLeaderboardApp, {
        apiBaseUrl: "https://example.com/token-board",
        initialEntries: [],
        initialNow,
      })
    );

    expect(markup).toContain("Loading 真实用户数据");
    expect(markup).toContain("数据没回来前不会展示示例排行榜");
    expect(markup).not.toContain("Feng");
    expect(markup).not.toContain("Ava");
    expect(markup).not.toContain("you,You");
    expect(markup).not.toContain("已加载示例数据");
  });

  it("does not ship seed leaderboard entries in the public fallback file", () => {
    expect(publicLeaderboard.entries).toEqual([]);
  });
});
