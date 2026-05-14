import { describe, expect, it } from "vitest";

import {
  buildTokenLeaderboard,
  parseTokenUsageImport,
  type TokenUsageEvent,
} from "@/lib/token-leaderboard";

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
        totalTokens: 1300,
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
});

function event(
  id: string,
  userId: string,
  displayName: string,
  timestamp: string,
  totalTokens: number,
  messages: number
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
    messages,
    sessionId: id,
  };
}
