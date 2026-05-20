import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  findUserByUploadToken,
  hashUploadToken,
  normalizeUploadUsers,
  sanitizeIngestEvents,
} from "@/lib/token-board-automation";
import { defaultSourceTargets, extractTokenUsageEventsFromJson, parseUsageFile } from "@/lib/token-usage-collector";

describe("token board automation", () => {
  it("collects from the friend agent default coding tools", () => {
    const tools = defaultSourceTargets().map((target) => target.tool);

    expect(tools).toEqual(expect.arrayContaining(["Codex CLI", "Claude Code", "Cursor", "Trae"]));
  });

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
        totalTokens: 1800,
      })
    );
    expect(JSON.stringify(entries)).not.toContain("do not upload me");
  });

  it("parses Codex session logs from last_token_usage only", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "token-board-codex-"));
    const file = path.join(dir, "session.jsonl");
    const lines = [
      {
        timestamp: "2026-05-14T08:00:00.000Z",
        type: "session_meta",
        payload: {
          cwd: "/Users/feng/work/token-board",
          model: "gpt-5.5",
        },
      },
      {
        timestamp: "2026-05-14T08:01:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 10_000,
              cached_input_tokens: 4_000,
              output_tokens: 1_000,
              reasoning_output_tokens: 500,
              total_tokens: 11_500,
            },
            last_token_usage: {
              input_tokens: 100,
              cached_input_tokens: 40,
              output_tokens: 10,
              reasoning_output_tokens: 5,
              total_tokens: 115,
            },
          },
        },
      },
    ];

    await fs.writeFile(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);

    const entries = await parseUsageFile(file, {
      source: "codex",
      tool: "Codex CLI",
      userId: "feng",
      displayName: "Feng",
      team: "Friends",
      filePath: file,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        model: "gpt-5.5",
        project: "token-board",
        totalTokens: 110,
        inputTokens: 100,
        cachedInputTokens: 40,
        outputTokens: 10,
        reasoningOutputTokens: 5,
      })
    );
  });
});
