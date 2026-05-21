import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TokenLeaderboardApp } from "../../components/token-leaderboard-app";

const initialNow = "2026-05-14T12:00:00.000Z";
(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("TokenLeaderboardApp", () => {
  it("renders loading instead of fake users before real data is ready", () => {
    const markup = renderToStaticMarkup(
      React.createElement(TokenLeaderboardApp, {
        apiBaseUrl: "https://example.com/token-board",
        initialNow,
      })
    );

    expect(markup).toContain("Loading 真实用户数据");
    expect(markup).toContain("motion-safe:animate-spin");
    expect(markup).toContain("使用安装指南");
    expect(markup).toContain("数据没回来前不会展示示例排行榜");
    expect(markup).not.toContain("Feng");
    expect(markup).not.toContain("Ava");
    expect(markup).not.toContain("you,You");
    expect(markup).not.toContain("已加载示例数据");
  });

  it("does not render static/manual fallbacks or reporting internals", () => {
    const markup = renderToStaticMarkup(
      React.createElement(TokenLeaderboardApp, {
        apiBaseUrl: "https://example.com/token-board",
        initialNow,
      })
    );

    expect(markup).not.toContain("上报链路");
    expect(markup).not.toContain("上报字段");
    expect(markup).not.toContain("agent only");
    expect(markup).not.toContain("usage/ingest");
    expect(markup).not.toContain("cachedInputTokens");
    expect(markup).not.toContain("复制安装命令");
    expect(markup).not.toContain("token-board-agent install");
    expect(markup).not.toContain("CSV / JSON");
    expect(markup).not.toContain("导出本地");
    expect(markup).not.toContain("清空本地");
    expect(markup).not.toContain("当前使用静态或本地数据");
  });
});
