import { describe, expect, it } from "vitest";

import {
  findUserByUploadToken,
  hashUploadToken,
  normalizeUploadUsers,
  sanitizeIngestEvents,
} from "@/lib/token-board-automation";
import { extractTokenUsageEventsFromJson } from "@/lib/token-usage-collector";

describe("token board automation", () => {
  it("authenticates upload users by token hash", () => {
    const users = normalizeUploadUsers({
      users: [
        {
          userId: "feng",
          displayName: "Feng",
          uploadTokenHash: hashUploadToken("secret-token"),
        },
      ],
    });

    expect(findUserByUploadToken(users, "secret-token")?.userId).toBe("feng");
    expect(findUserByUploadToken(users, "wrong-token")).toBeUndefined();
  });

  it("overrides client identity and filters private project/session values", () => {
    const user = normalizeUploadUsers({
      users: [
        {
          userId: "server-user",
          displayName: "Server User",
          team: "Friends",
          uploadToken: "secret-token",
        },
      ],
    })[0]!;

    const sanitized = sanitizeIngestEvents(
      [
        {
          userId: "spoofed-user",
          displayName: "Spoofed",
          source: "codex",
          tool: "Codex CLI",
          model: "gpt-5.5",
          project: "/Users/feng/private/repo-name",
          sessionId: "/Users/feng/private/session.jsonl",
          timestamp: new Date().toISOString(),
          inputTokens: 1000,
          outputTokens: 200,
          totalTokens: 1200,
        },
      ],
      user
    );

    expect(sanitized.errors).toEqual([]);
    expect(sanitized.entries[0]).toEqual(
      expect.objectContaining({
        userId: "server-user",
        displayName: "Server User",
        project: "repo-name",
      })
    );
    expect(sanitized.entries[0].sessionId).toMatch(/^session:/);
    expect(sanitized.entries[0].sessionId).not.toContain("/Users/feng");
  });

  it("extracts aggregate usage from nested local logs without prompt text", () => {
    const entries = extractTokenUsageEventsFromJson(
      {
        timestamp: "2026-05-14T08:00:00.000Z",
        model: "gpt-5.5",
        cwd: "/Users/feng/work/token-board",
        messages: [{ role: "user", content: "do not upload me" }],
        response: {
          usage: {
            input_tokens: 1500,
            cache_read_input_tokens: 200,
            output_tokens: 300,
          },
        },
      },
      {
        source: "codex",
        tool: "Codex CLI",
        userId: "feng",
        displayName: "Feng",
        team: "Friends",
      }
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        userId: "feng",
        model: "gpt-5.5",
        totalTokens: 2000,
      })
    );
    expect(JSON.stringify(entries)).not.toContain("do not upload me");
  });
});
