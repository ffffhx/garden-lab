import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createTokenUsageStore } from "@garden-lab/token-board-core/storage";
import type { TokenUsageEvent } from "@garden-lab/token-board-core";

describe("token board storage", () => {
  it("deletes only the selected user's usage events from file storage", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "token-board-storage-"));
    const store = await createTokenUsageStore({
      dataFile: path.join(dir, "usage-events.json"),
      maxEvents: 100,
    });

    await store.insertEvents([
      usageEvent({ id: "usage:a", userId: "github:1" }),
      usageEvent({ id: "usage:b", userId: "github:2" }),
      usageEvent({ id: "usage:c", userId: "github:1" }),
    ]);

    const result = await store.deleteEventsForUser("github:1");
    const remaining = await store.listEvents();

    expect(result).toEqual({ deleted: 2, records: 1 });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe("github:2");
  });

  it("stores current user config separately from usage events in file storage", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "token-board-storage-"));
    const store = await createTokenUsageStore({
      dataFile: path.join(dir, "usage-events.json"),
      maxEvents: 100,
    });
    const config = {
      updatedAt: "2026-05-25T12:00:00.000Z",
      agent: { name: "token-board-agent", version: "0.4.11", platform: "macOS" },
      codex: {
        model: "gpt-5.5",
        modelContextWindow: 250_000,
        modelAutoCompactTokenLimit: 200_000,
      },
    };

    await store.upsertUserConfig("github:1", config);
    await store.insertEvents([usageEvent({ id: "usage:a", userId: "github:1" })]);

    expect(await store.getUserConfig("github:1")).toEqual(config);
    expect(await store.getUserConfig("github:missing")).toBeNull();
    expect(await store.listEvents()).toHaveLength(1);
  });
});

function usageEvent(overrides: Partial<TokenUsageEvent>): TokenUsageEvent {
  return {
    id: "usage:test",
    userId: "github:1",
    displayName: "Feng",
    team: "GitHub",
    source: "codex",
    tool: "Codex CLI",
    model: "gpt-5.5",
    project: "garden-lab",
    sessionId: "session:test",
    timestamp: "2026-05-20T12:00:00.000Z",
    inputTokens: 100,
    cachedInputTokens: 40,
    outputTokens: 10,
    reasoningOutputTokens: 5,
    totalTokens: 110,
    messages: 1,
    ...overrides,
  };
}
