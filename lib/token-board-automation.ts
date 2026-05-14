import { createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";

import {
  dedupeTokenEvents,
  normalizeTokenUsageEvent,
  type TokenBoardMetric,
  type TokenBoardRange,
  type TokenUsageEvent,
} from "./token-leaderboard";

export type TokenBoardUploadUser = {
  userId: string;
  displayName: string;
  team?: string;
  uploadToken?: string;
  uploadTokenHash?: string;
  disabled?: boolean;
};

export type TokenBoardPrivacyOptions = {
  projectMode?: "basename" | "hash" | "none";
  includeModel?: boolean;
  includeSource?: boolean;
  hashSessionId?: boolean;
  maxEventAgeDays?: number;
};

export type TokenBoardIngestPayload = {
  schemaVersion?: number;
  client?: {
    name?: string;
    version?: string;
    hostId?: string;
  };
  events?: Array<Partial<TokenUsageEvent>>;
};

export type TokenBoardIngestResult = {
  entries: TokenUsageEvent[];
  errors: string[];
};

const DEFAULT_MAX_EVENT_AGE_DAYS = 120;

export function hashUploadToken(token: string) {
  return `sha256:${sha256(token)}`;
}

export function normalizeUploadUsers(value: unknown): TokenBoardUploadUser[] {
  const rawUsers = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { users?: unknown }).users)
      ? (value as { users: unknown[] }).users
      : [];

  return rawUsers.flatMap((rawUser) => {
    if (!rawUser || typeof rawUser !== "object") {
      return [];
    }

    const record = rawUser as Record<string, unknown>;
    const userId = sanitizeLabel(record.userId ?? record.user ?? record.username, 80);
    const displayName = sanitizeLabel(record.displayName ?? record.name ?? record.username ?? userId, 80);

    if (!userId || !displayName) {
      return [];
    }

    return [
      {
        userId,
        displayName,
        team: sanitizeLabel(record.team ?? record.group, 80) || undefined,
        uploadToken: sanitizeSecret(record.uploadToken ?? record.token),
        uploadTokenHash: sanitizeSecret(record.uploadTokenHash ?? record.tokenHash),
        disabled: record.disabled === true,
      },
    ];
  });
}

export function findUserByUploadToken(users: TokenBoardUploadUser[], token: string) {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return undefined;
  }

  return users.find((user) => {
    if (user.disabled) {
      return false;
    }

    const configuredHash = user.uploadTokenHash || (user.uploadToken ? hashUploadToken(user.uploadToken) : "");
    return timingSafeTokenEqual(configuredHash, hashUploadToken(normalizedToken));
  });
}

export function sanitizeIngestEvents(
  events: Array<Partial<TokenUsageEvent>>,
  user: TokenBoardUploadUser,
  options: TokenBoardPrivacyOptions = {}
): TokenBoardIngestResult {
  const errors: string[] = [];
  const now = Date.now();
  const maxAgeDays = options.maxEventAgeDays ?? DEFAULT_MAX_EVENT_AGE_DAYS;
  const minTime = now - maxAgeDays * 24 * 60 * 60 * 1000;

  const entries = events.flatMap((event, index) => {
    try {
      const normalized = normalizeTokenUsageEvent(event);
      const timestamp = new Date(normalized.timestamp).getTime();

      if (!Number.isFinite(timestamp) || timestamp < minTime || timestamp > now + 24 * 60 * 60 * 1000) {
        errors.push(`第 ${index + 1} 条记录时间超出允许范围`);
        return [];
      }

      if (normalized.totalTokens <= 0) {
        errors.push(`第 ${index + 1} 条记录没有 token 用量`);
        return [];
      }

      const project = sanitizeProjectName(normalized.project, options.projectMode ?? "basename");
      const sessionId =
        options.hashSessionId === false
          ? sanitizeLabel(normalized.sessionId, 120)
          : normalized.sessionId
            ? `session:${sha256(normalized.sessionId).slice(0, 16)}`
            : "";
      const source = options.includeSource === false ? "local-agent" : sanitizeLabel(normalized.source, 60) || "local-agent";
      const model = options.includeModel === false ? "hidden" : sanitizeLabel(normalized.model, 80) || "unknown";
      const stableId = stableTokenEventId({
        ...normalized,
        userId: user.userId,
        displayName: user.displayName,
        team: user.team || "Friends",
        project,
        sessionId,
        source,
        model,
      });

      return [
        normalizeTokenUsageEvent({
          ...normalized,
          id: stableId,
          userId: user.userId,
          displayName: user.displayName,
          team: user.team || "Friends",
          source,
          tool: sanitizeLabel(normalized.tool, 60) || source,
          model,
          project,
          sessionId,
        }),
      ];
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `第 ${index + 1} 条记录解析失败`);
      return [];
    }
  });

  return { entries: dedupeTokenEvents(entries), errors };
}

export function mergeTokenEvents(existing: TokenUsageEvent[], incoming: TokenUsageEvent[], maxEvents = 100_000) {
  return dedupeTokenEvents([...incoming, ...existing]).slice(0, maxEvents);
}

export function sanitizeProjectName(value: unknown, mode: TokenBoardPrivacyOptions["projectMode"] = "basename") {
  const text = sanitizeLabel(value, 240);

  if (!text || mode === "none") {
    return undefined;
  }

  if (mode === "hash") {
    return `project:${sha256(text).slice(0, 12)}`;
  }

  return sanitizeLabel(path.basename(text.replace(/\\/g, "/")), 80) || undefined;
}

export function createIngestPayload(
  events: TokenUsageEvent[],
  client: TokenBoardIngestPayload["client"] = { name: "token-usage-agent" }
): TokenBoardIngestPayload {
  return {
    schemaVersion: 1,
    client,
    events,
  };
}

export function isTokenBoardRange(value: string): value is TokenBoardRange {
  return value === "1D" || value === "7D" || value === "30D" || value === "90D";
}

export function isTokenBoardMetric(value: string): value is TokenBoardMetric {
  return value === "tokens" || value === "cost" || value === "sessions" || value === "messages";
}

function stableTokenEventId(event: TokenUsageEvent) {
  return `usage:${sha256(
    [
      event.userId,
      event.timestamp,
      event.source,
      event.model,
      event.project || "",
      event.sessionId || "",
      event.inputTokens,
      event.cachedInputTokens,
      event.outputTokens,
      event.reasoningOutputTokens,
      event.totalTokens,
    ].join("\n")
  ).slice(0, 32)}`;
}

function timingSafeTokenEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(normalizeTokenHash(left));
  const rightBuffer = Buffer.from(normalizeTokenHash(right));

  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeTokenHash(value: string) {
  return sanitizeSecret(value).replace(/^sha256:/, "");
}

function sanitizeSecret(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeLabel(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
