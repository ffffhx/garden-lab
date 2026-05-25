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
    const targets = defaultSourceTargets();
    const tools = targets.map((target) => target.tool);
    const codexTarget = targets.find((target) => target.source === "codex");

    expect(tools).toEqual(expect.arrayContaining(["Codex CLI", "Claude Code", "Cursor", "Trae"]));
    expect(codexTarget?.paths).toEqual(expect.arrayContaining(["~/.codex/archived_sessions"]));
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
          sessionTitle: "Fix Token Board session labels",
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
        sessionTitle: "Fix Token Board session labels",
      })
    );
    expect(sanitized.entries[0].sessionId).toMatch(/^session:/);
    expect(sanitized.entries[0].sessionId).not.toContain("/Users/feng");
  });

  it("rejects total-only uploads instead of using totalTokens as fallback", () => {
    const user = normalizeUploadUsers({
      users: [
        {
          userId: "server-user",
          displayName: "Server User",
          uploadToken: "secret-token",
        },
      ],
    })[0]!;

    const sanitized = sanitizeIngestEvents(
      [
        {
          source: "codex",
          tool: "Codex CLI",
          model: "gpt-5.5",
          timestamp: new Date().toISOString(),
          totalTokens: 1200,
        },
      ],
      user
    );

    expect(sanitized.entries).toEqual([]);
    expect(sanitized.errors[0]).toContain("不能使用 totalTokens 兜底");
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

  it("parses Codex session logs from cumulative token_count deltas", async () => {
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
        timestamp: "2026-05-14T08:00:10.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "帮我修复 Session 明细里看不懂的 hash 标题",
        },
      },
      {
        timestamp: "2026-05-14T08:01:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 100,
              cached_input_tokens: 40,
              output_tokens: 10,
              reasoning_output_tokens: 5,
              total_tokens: 115,
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
      {
        timestamp: "2026-05-14T08:01:30.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 100,
              cached_input_tokens: 40,
              output_tokens: 10,
              reasoning_output_tokens: 5,
              total_tokens: 115,
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
      {
        timestamp: "2026-05-14T08:02:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 150,
              cached_input_tokens: 50,
              output_tokens: 20,
              reasoning_output_tokens: 8,
              total_tokens: 178,
            },
            last_token_usage: {
              input_tokens: 50,
              cached_input_tokens: 10,
              output_tokens: 10,
              reasoning_output_tokens: 3,
              total_tokens: 63,
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

    const sortedEntries = [...entries].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

    expect(sortedEntries).toHaveLength(2);
    expect(sortedEntries[0]).toEqual(
      expect.objectContaining({
        model: "gpt-5.5",
        project: "token-board",
        sessionTitle: "帮我修复 Session 明细里看不懂的 hash 标题",
        totalTokens: 110,
        inputTokens: 100,
        cachedInputTokens: 40,
        outputTokens: 10,
        reasoningOutputTokens: 5,
      })
    );
    expect(sortedEntries[1]).toEqual(
      expect.objectContaining({
        totalTokens: 60,
        inputTokens: 50,
        cachedInputTokens: 10,
        outputTokens: 10,
        reasoningOutputTokens: 3,
      })
    );
  });
});
