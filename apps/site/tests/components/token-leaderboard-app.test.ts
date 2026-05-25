import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccountSessionList, DailyTokenTrendChart, INSTALL_GUIDES, TokenLeaderboardApp } from "../../components/token-leaderboard-app";

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
    expect(markup).not.toContain("消息");
  });

  it("renders readable hover data for the token trend chart", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DailyTokenTrendChart, {
        daily: [
          { date: "2026-05-16", tokens: 388_007_536 },
          { date: "2026-05-17", tokens: 91_875_795 },
        ],
        loading: false,
        maxDailyTokens: 388_007_536,
      })
    );

    expect(markup).toContain('data-token-trend-point="2026-05-16"');
    expect(markup).toContain('data-token-trend-tooltip="2026-05-16"');
    expect(markup).toContain('data-token-trend-tooltip-placement="top-rail"');
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain("2026-05-16");
    expect(markup).toContain("388,007,536 tokens");
  });

  it("defines separate macOS and Windows install guides", () => {
    expect(INSTALL_GUIDES.macos.steps).toHaveLength(4);
    expect(INSTALL_GUIDES.windows.steps).toHaveLength(4);
    expect(INSTALL_GUIDES.macos.steps[0].note).toContain("LaunchAgent");
    expect(INSTALL_GUIDES.windows.steps[0].note).toContain("TokenBoardAgent");
    expect(INSTALL_GUIDES.windows.steps[1].description).toContain("Task Scheduler");
    expect(INSTALL_GUIDES.windows.steps[0].command).toContain("token-board-agent install");
    expect(INSTALL_GUIDES.macos.steps[3].command).toContain("token-board-agent uninstall");
    expect(INSTALL_GUIDES.windows.steps[3].note).toContain("TokenBoardAgent");
  });

  it("renders session detail rows sorted by token usage", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AccountSessionList, {
        sessions: [
          {
            id: "session-small",
            tokens: 5_000,
            inputTokens: 4_000,
            cachedInputTokens: 500,
            outputTokens: 1_000,
            reasoningOutputTokens: 0,
            costUsd: 0.05,
            messages: 1,
            records: 1,
            model: "gpt-5.4-mini",
            tool: "Cursor",
            project: "notes",
            models: 1,
            tools: 1,
            projects: 1,
            startAt: "2026-05-14T09:00:00.000Z",
            endAt: "2026-05-14T09:02:00.000Z",
          },
          {
            id: "session-big",
            title: "修复 Token Board session 标题",
            tokens: 17_000,
            inputTokens: 15_000,
            cachedInputTokens: 3_000,
            outputTokens: 2_000,
            reasoningOutputTokens: 0,
            costUsd: 0.17,
            messages: 5,
            records: 2,
            model: "gpt-5.5",
            tool: "Codex CLI",
            project: "garden-lab",
            models: 2,
            tools: 1,
            projects: 1,
            startAt: "2026-05-13T10:00:00.000Z",
            endAt: "2026-05-14T11:00:00.000Z",
          },
        ],
      })
    );

    expect(markup).toContain("Session 明细");
    expect(markup).toContain("按 token 降序");
    expect(markup).toContain("修复 Token Board session 标题");
    expect(markup.indexOf("session-big")).toBeLessThan(markup.indexOf("session-small"));
    expect(markup).toContain("17K");
    expect(markup).toContain("gpt-5.5");
    expect(markup).toContain("Codex CLI");
    expect(markup).toContain("garden-lab");
    expect(markup).toContain("开始时间");
    expect(markup).toContain("结束时间");
    expect(markup).toContain("2026-05-13T10:00:00.000Z");
    expect(markup).toContain("2026-05-14T11:00:00.000Z");
  });
});
