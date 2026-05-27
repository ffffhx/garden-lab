import { describe, expect, it } from "vitest";

import { buildTokenUsageSnapshotFromEvents } from "@/lib/content/token-usage";
import {
  buildTokenAccountUsageProfile,
  buildTokenLeaderboard,
  parseTokenUsageImport,
  type TokenUsageEvent,
} from "@garden-lab/token-board-core";

const now = new Date("2026-05-14T12:00:00.000Z");

describe("token leaderboard", () => {
  it("parses CSV rows into normalized token events", () => {
    const parsed = parseTokenUsageImport(`user,displayName,tool,model,timestamp,inputTokens,outputTokens,totalTokens,messages
feng,Feng,Codex CLI,gpt-5.5,2026-05-14T10:00:00.000Z,1000,200,1300,5`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.entries).toEqual([
      expect.objectContaining({
        userId: "feng",
        displayName: "Feng",
        tool: "Codex CLI",
        model: "gpt-5.5",
        totalTokens: 1200,
        messages: 5,
      }),
    ]);
  });

  it("builds rankings by the selected metric and compares with the previous window", () => {
    const entries: TokenUsageEvent[] = [
      event("a-now", "ava", "Ava", "2026-05-14T10:00:00.000Z", 10_000, 2),
      event("b-now", "kai", "Kai", "2026-05-14T09:00:00.000Z", 18_000, 1),
      event("a-prev", "ava", "Ava", "2026-05-13T10:00:00.000Z", 5_000, 1),
    ];

    const summary = buildTokenLeaderboard(entries, {
      range: "1D",
      metric: "tokens",
      now,
    });

    expect(summary.totalTokens).toBe(28_000);
    expect(summary.users.map((user) => user.userId)).toEqual(["kai", "ava"]);
    expect(summary.users[1].deltaTokens).toBe(1);
    expect(summary.users[0].daily).toEqual([
      { date: "2026-05-13", tokens: 0 },
      { date: "2026-05-14", tokens: 18_000 },
    ]);
  });

  it("uses input plus output tokens as the consumption total without double-counting cache hits", () => {
    const entries: TokenUsageEvent[] = [
      {
        ...event("detailed", "feng", "Feng", "2026-05-14T10:00:00.000Z", 115, 1),
        inputTokens: 100,
        cachedInputTokens: 40,
        outputTokens: 10,
        reasoningOutputTokens: 5,
        totalTokens: 115,
      },
    ];

    const summary = buildTokenLeaderboard(entries, {
      range: "1D",
      metric: "tokens",
      now,
    });

    expect(summary.totalTokens).toBe(110);
    expect(summary.users[0]).toEqual(
      expect.objectContaining({
        tokens: 110,
        inputTokens: 100,
        cachedInputTokens: 40,
        outputTokens: 10,
        reasoningOutputTokens: 5,
      })
    );
    expect(summary.models[0].tokens).toBe(110);
    expect(summary.daily.find((point) => point.date === "2026-05-14")?.tokens).toBe(110);
  });

  it("rejects total-only records instead of using totalTokens as fallback", () => {
    const parsed = parseTokenUsageImport(`user,displayName,tool,model,timestamp,totalTokens,messages
feng,Feng,Codex CLI,gpt-5.5,2026-05-14T10:00:00.000Z,1300,5`);

    expect(parsed.entries).toEqual([]);
    expect(parsed.errors).toEqual(["第 1 行缺少 inputTokens/outputTokens，已拒绝使用 totalTokens 兜底"]);
  });

  it("dedupes stable event ids before aggregation", () => {
    const entries = [
      event("same-id", "feng", "Feng", "2026-05-14T10:00:00.000Z", 10_000, 1),
      event("same-id", "feng", "Feng", "2026-05-14T10:00:00.000Z", 12_000, 1),
    ];

    const summary = buildTokenLeaderboard(entries, {
      range: "7D",
      metric: "tokens",
      now,
    });

    expect(summary.users).toHaveLength(1);
    expect(summary.users[0].tokens).toBe(12_000);
  });

  it("builds the homepage token usage snapshot from server events", () => {
    const snapshot = buildTokenUsageSnapshotFromEvents(
      [
        event("today", "feng", "Feng", "2026-05-14T10:00:00.000Z", 10_000, 1, 0.12),
        event("week", "feng", "Feng", "2026-05-12T10:00:00.000Z", 20_000, 1, 0.24),
        event("last-month", "feng", "Feng", "2026-04-30T10:00:00.000Z", 99_000, 1, 0.99),
      ],
      { now, source: "test" }
    );

    expect(snapshot.periods.today.totalTokens).toBe(10_000);
    expect(snapshot.periods.week.totalTokens).toBe(30_000);
    expect(snapshot.periods.month.totalTokens).toBe(30_000);
    expect(snapshot.periods.month.estimatedCostUsd).toBe(0.36);
  });

  it("builds a GitHub account usage profile from the signed-in user id", () => {
    const profile = buildTokenAccountUsageProfile(
      [
        event("feng-now", "github:1", "Feng", "2026-05-14T10:00:00.000Z", 20_000, 4, 0.2),
        event("feng-project", "github:1", "Feng", "2026-05-13T13:00:00.000Z", 8_000, 2, 0.08),
        event("ava-now", "github:2", "Ava", "2026-05-14T09:00:00.000Z", 30_000, 3, 0.3),
      ],
      { userId: "github:1", range: "7D", now }
    );

    expect(profile.rank).toBe(2);
    expect(profile.totalUsers).toBe(2);
    expect(profile.user?.tokens).toBe(28_000);
    expect(profile.records).toBe(2);
    expect(profile.projects[0]).toEqual(expect.objectContaining({ name: "board", tokens: 28_000 }));
    expect(profile.sessions).toHaveLength(2);
    expect(profile.sessions[0]).toEqual(expect.objectContaining({ id: "feng-now", tokens: 20_000 }));
    expect(profile.heatmap).toHaveLength(168);
    expect(profile.topHour).toBe("18:00");
  });

  it("aggregates account usage by session and sorts sessions by tokens descending", () => {
    const profile = buildTokenAccountUsageProfile(
      [
        {
          ...event("small", "github:1", "Feng", "2026-05-14T09:00:00.000Z", 5_000, 1, 0.05),
          sessionId: "session-small",
          model: "gpt-5.4-mini",
          tool: "Cursor",
          project: "notes",
        },
        {
          ...event("big-a", "github:1", "Feng", "2026-05-13T10:00:00.000Z", 10_000, 2, 0.1),
          sessionId: "session-big",
          sessionTitle: "修复 Token Board session 标题",
          model: "gpt-5.5",
          tool: "Codex CLI",
          project: "board",
        },
        {
          ...event("big-b", "github:1", "Feng", "2026-05-14T11:00:00.000Z", 7_000, 3, 0.07),
          sessionId: "session-big",
          sessionTitle: "修复 Token Board session 标题",
          model: "gpt-5.4",
          tool: "Cursor",
          project: "api",
        },
      ],
      { userId: "github:1", range: "7D", now }
    );

    expect(profile.sessions).toHaveLength(2);
    expect(profile.sessions[0]).toEqual(
      expect.objectContaining({
        id: "session-big",
        title: "修复 Token Board session 标题",
        tokens: 17_000,
        model: "gpt-5.5",
        tool: "Codex CLI",
        project: "board",
        records: 2,
        startAt: "2026-05-13T10:00:00.000Z",
        endAt: "2026-05-14T11:00:00.000Z",
      })
    );
    expect(profile.sessions[1]).toEqual(expect.objectContaining({ id: "session-small", tokens: 5_000 }));
  });
});

function event(
  id: string,
  userId: string,
  displayName: string,
  timestamp: string,
  totalTokens: number,
  messages: number,
  costUsd?: number
): TokenUsageEvent {
  return {
    id,
    userId,
    displayName,
    team: "Friends",
    source: "codex",
    tool: "Codex CLI",
    model: "gpt-5.5",
    project: "board",
    timestamp,
    inputTokens: totalTokens,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens,
    costUsd,
    messages,
    sessionId: id,
  };
}
