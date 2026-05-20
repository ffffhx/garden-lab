import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  dedupeTokenEvents,
  normalizeTokenUsageEvent,
  parseTokenUsageImport,
  type TokenUsageEvent,
} from "./token-leaderboard";

export type TokenUsageCollectorConfig = {
  userId?: string;
  displayName?: string;
  team?: string;
  usagePaths?: string[];
  includeDefaultSources?: boolean;
  sinceHours?: number;
  maxFiles?: number;
  maxFileBytes?: number;
  maxCodexFileBytes?: number;
};

type SourceTarget = {
  source: string;
  tool: string;
  paths: string[];
};

type ExtractionContext = {
  source: string;
  tool: string;
  filePath?: string;
  userId?: string;
  displayName?: string;
  team?: string;
  timestamp?: string;
  model?: string;
  project?: string;
  sessionId?: string;
};

const DEFAULT_SINCE_HOURS = 24 * 30;
const DEFAULT_MAX_FILES = 800;
const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_CODEX_FILE_BYTES = 256 * 1024 * 1024;
const execFileAsync = promisify(execFile);
const TOKEN_KEYS = new Set([
  "cached_input_tokens",
  "cachedInputTokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
  "completion_tokens",
  "completionTokens",
  "input_tokens",
  "inputTokenCount",
  "inputTokens",
  "output_tokens",
  "outputTokenCount",
  "outputTokens",
  "prompt_tokens",
  "promptTokens",
  "reasoning_output_tokens",
  "reasoningOutputTokens",
  "total_tokens",
  "totalTokenCount",
  "totalTokens",
  "tokens",
]);
const SQLITE_USAGE_NEEDLES = [
  "input_tokens",
  "output_tokens",
  "total_tokens",
  "prompt_tokens",
  "completion_tokens",
  "cached_input_tokens",
  "cache_read_input_tokens",
  "cache_creation_input_tokens",
  "token_usage",
  "tokenusage",
];

export async function collectLocalTokenUsage(config: TokenUsageCollectorConfig = {}) {
  const targets = buildSourceTargets(config);
  const maxFiles = config.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileBytes = config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxCodexFileBytes = config.maxCodexFileBytes ?? DEFAULT_MAX_CODEX_FILE_BYTES;
  const sinceMs = Date.now() - (config.sinceHours ?? DEFAULT_SINCE_HOURS) * 60 * 60 * 1000;
  const entries: TokenUsageEvent[] = [];

  for (const target of targets) {
    let scannedFiles = 0;

    for (const targetPath of target.paths) {
      const files = await listUsageFiles(expandHome(targetPath), {
        source: target.source,
        maxFiles: Math.max(0, maxFiles - scannedFiles),
        maxFileBytes,
        maxCodexFileBytes,
        sinceMs,
      });
      scannedFiles += files.length;

      for (const filePath of files) {
        entries.push(
          ...(await parseUsageFile(filePath, {
            source: target.source,
            tool: target.tool,
            filePath,
            userId: config.userId,
            displayName: config.displayName,
            team: config.team,
            project: path.basename(path.dirname(filePath)),
            sessionId: path.basename(filePath),
          }))
        );
      }
    }
  }

  return dedupeTokenEvents(entries);
}

export function extractTokenUsageEventsFromJson(value: unknown, context: ExtractionContext) {
  const entries: TokenUsageEvent[] = [];

  visitJson(value, context, entries, { sequence: 0 }, 0);

  return dedupeTokenEvents(entries);
}

export async function parseUsageFile(filePath: string, context: ExtractionContext) {
  if (isSqliteUsageFile(filePath)) {
    return parseSqliteUsageFile(filePath, context);
  }

  const text = await fs.readFile(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".csv") {
    return applyContext(parseTokenUsageImport(text).entries, context);
  }

  if (context.source === "codex" && ext === ".jsonl") {
    return parseCodexSessionJsonl(text, context);
  }

  if (ext === ".jsonl" || ext === ".log") {
    const objects = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => parseJsonLine(line));

    return dedupeTokenEvents(objects.flatMap((object) => extractTokenUsageEventsFromJson(object, context)));
  }

  const parsed = safeJsonParse(text);

  if (parsed !== undefined) {
    const directImport = parseTokenUsageImport(text);
    if (directImport.entries.length) {
      return applyContext(directImport.entries, context);
    }

    return extractTokenUsageEventsFromJson(parsed, context);
  }

  return [];
}

function parseCodexSessionJsonl(text: string, context: ExtractionContext) {
  const entries: TokenUsageEvent[] = [];
  let currentModel = context.model || "unknown";
  let currentProject = context.project;
  let sequence = 0;
  let previousTotalUsage: Record<string, unknown> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line.includes('"token_count"') && !line.includes('"model"') && !line.includes('"cwd"')) {
      continue;
    }

    const parsed = safeJsonParse(line);

    if (!isRecord(parsed)) {
      continue;
    }

    const payload = isRecord(parsed.payload) ? parsed.payload : {};
    const type = typeof parsed.type === "string" ? parsed.type : "";

    if ((type === "turn_context" || type === "session_meta") && typeof payload.model === "string") {
      currentModel = payload.model;
    }

    if ((type === "turn_context" || type === "session_meta") && typeof payload.cwd === "string") {
      currentProject = path.basename(payload.cwd);
    }

    const info = isRecord(payload.info) ? payload.info : {};
    const timestamp = typeof parsed.timestamp === "string" ? parsed.timestamp : "";

    if (type !== "event_msg" || payload.type !== "token_count" || !timestamp) {
      continue;
    }

    const totalUsage = isRecord(info.total_token_usage) ? info.total_token_usage : undefined;
    const usage = totalUsage
      ? tokenUsageDelta(totalUsage, previousTotalUsage)
      : isRecord(info.last_token_usage)
        ? info.last_token_usage
        : undefined;
    if (totalUsage) {
      previousTotalUsage = totalUsage;
    }

    if (!usage || tokenUsageTotal(usage) <= 0) {
      continue;
    }

    sequence += 1;
    const event = tryRecordToUsageEvent(
      usage,
      {
        ...context,
        timestamp,
        model: currentModel,
        project: currentProject,
        sessionId: context.sessionId || textFromFields(payload, ["id"]) || context.filePath,
      },
      sequence
    );

    if (event) {
      entries.push(event);
    }
  }

  return dedupeTokenEvents(entries);
}

function tokenUsageDelta(current: Record<string, unknown>, previous: Record<string, unknown>) {
  const fields = ["input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens", "total_tokens"];

  return Object.fromEntries(
    fields.map((field) => [field, Math.max(0, toNumber(current[field]) - toNumber(previous[field]))])
  );
}

function tokenUsageTotal(record: Record<string, unknown>) {
  return toNumber(record.input_tokens) + toNumber(record.output_tokens);
}

async function parseSqliteUsageFile(filePath: string, context: ExtractionContext) {
  const entries: TokenUsageEvent[] = [];
  const valueMatches = SQLITE_USAGE_NEEDLES.map(
    (needle) => `lower(cast(value as text)) like '%${needle.replace(/'/g, "''")}%'`
  );
  const where = [`lower(key) like '%usage%'`, ...valueMatches].join(" or ");

  for (const table of ["ItemTable", "cursorDiskKV"]) {
    const rows = await querySqliteJson(
      filePath,
      `select key, cast(value as text) as value from ${table} where ${where} limit 200;`
    );

    for (const row of rows) {
      if (!isRecord(row) || typeof row.value !== "string") {
        continue;
      }

      const parsed = safeJsonParse(row.value);
      if (parsed === undefined) {
        continue;
      }

      entries.push(
        ...extractTokenUsageEventsFromJson(parsed, {
          ...context,
          sessionId: `${filePath}:${typeof row.key === "string" ? row.key : "sqlite"}`,
        })
      );
    }
  }

  return dedupeTokenEvents(entries);
}

async function querySqliteJson(filePath: string, sql: string) {
  try {
    const { stdout } = await execFileAsync("sqlite3", ["-readonly", "-json", filePath, sql], {
      maxBuffer: 2 * 1024 * 1024,
    });
    const parsed = safeJsonParse(stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function defaultSourceTargets(): SourceTarget[] {
  return [
    {
      source: "codex",
      tool: "Codex CLI",
      paths: ["~/.codex/sessions", "~/.codex/archived_sessions", "~/.codex/projects"],
    },
    {
      source: "claude-code",
      tool: "Claude Code",
      paths: ["~/.claude/projects"],
    },
    {
      source: "cursor",
      tool: "Cursor",
      paths: [
        "~/Library/Application Support/Cursor/User/globalStorage",
        "~/Library/Application Support/Cursor/logs",
        "~/.config/Cursor/User/globalStorage",
        "~/.config/Cursor/logs",
      ],
    },
    {
      source: "trae",
      tool: "Trae",
      paths: [
        "~/Library/Application Support/Trae/User/globalStorage",
        "~/Library/Application Support/Trae CN/User/globalStorage",
        "~/Library/Application Support/Trae/logs",
        "~/Library/Application Support/Trae CN/logs",
        "~/Library/Application Support/Trae/ModularData/ai-agent",
        "~/Library/Application Support/Trae CN/ModularData/ai-agent",
        "~/.config/Trae/User/globalStorage",
        "~/.config/Trae CN/User/globalStorage",
        "~/.trae",
        "~/.trae-cn",
        "~/.trae-aicc-internal",
      ],
    },
    {
      source: "gemini-cli",
      tool: "Gemini CLI",
      paths: ["~/.gemini"],
    },
  ];
}

function buildSourceTargets(config: TokenUsageCollectorConfig): SourceTarget[] {
  const targets: SourceTarget[] = [];

  if (config.usagePaths?.length) {
    targets.push({
      source: "custom",
      tool: "Custom Usage",
      paths: config.usagePaths,
    });
  }

  if (config.includeDefaultSources !== false) {
    targets.push(...defaultSourceTargets());
  }

  return targets;
}

async function listUsageFiles(
  inputPath: string,
  {
    source,
    maxFiles,
    maxFileBytes,
    maxCodexFileBytes,
    sinceMs,
  }: {
    source: string;
    maxFiles: number;
    maxFileBytes: number;
    maxCodexFileBytes: number;
    sinceMs: number;
  }
) {
  const files: string[] = [];

  async function walk(currentPath: string, depth: number) {
    if (files.length >= maxFiles || depth > 8) {
      return;
    }

    let stat;
    try {
      stat = await fs.stat(currentPath);
    } catch {
      return;
    }

    if (stat.isDirectory()) {
      if (shouldSkipDirectory(currentPath)) {
        return;
      }

      const children = await fs.readdir(currentPath);
      for (const child of children) {
        await walk(path.join(currentPath, child), depth + 1);
      }
      return;
    }

    const maxBytes =
      source === "codex" && path.extname(currentPath).toLowerCase() === ".jsonl"
        ? maxCodexFileBytes
        : maxFileBytes;

    if (
      stat.isFile() &&
      files.length < maxFiles &&
      stat.size <= maxBytes &&
      stat.mtimeMs >= sinceMs &&
      isUsageFile(currentPath)
    ) {
      files.push(currentPath);
    }
  }

  await walk(inputPath, 0);
  return files;
}

function visitJson(
  value: unknown,
  context: ExtractionContext,
  entries: TokenUsageEvent[],
  state: { sequence: number },
  depth: number
) {
  if (depth > 14 || value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => visitJson(item, context, entries, state, depth + 1));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const nextContext = enrichContext(context, record);

  if (hasUsageShape(record)) {
    state.sequence += 1;
    const event = tryRecordToUsageEvent(record, nextContext, state.sequence);
    if (event) {
      entries.push(event);
    }
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    if (typeof child === "string" && isSensitiveTextKey(key)) {
      continue;
    }

    visitJson(child, nextContext, entries, state, depth + 1);
  }
}

function recordToUsageEvent(record: Record<string, unknown>, context: ExtractionContext, sequence: number) {
  const baseInputTokens = numberFromFields(record, ["inputTokens", "input_tokens", "inputTokenCount", "promptTokens", "prompt_tokens"]);
  const additiveCachedInputTokens =
    numberFromFields(record, ["cache_read_input_tokens", "cacheReadInputTokens"]) +
    numberFromFields(record, ["cache_creation_input_tokens", "cacheCreationInputTokens"]);
  const inputTokens = baseInputTokens + additiveCachedInputTokens;
  const cachedInputTokens =
    numberFromFields(record, ["cachedInputTokens", "cached_input_tokens", "cachedTokens"]) +
    additiveCachedInputTokens;
  const outputTokens = numberFromFields(record, ["outputTokens", "output_tokens", "outputTokenCount", "completionTokens", "completion_tokens"]);
  const reasoningOutputTokens = numberFromFields(record, [
    "reasoningOutputTokens",
    "reasoning_output_tokens",
    "reasoningTokens",
  ]);
  const totalTokens = inputTokens + outputTokens;

  if (totalTokens <= 0) {
    throw new Error("missing input/output token fields; total_tokens fallback is disabled");
  }

  const timestamp = context.timestamp || new Date().toISOString();
  const model = context.model || textFromFields(record, ["model", "modelName", "model_name"]) || "unknown";
  const sessionId = context.sessionId || textFromFields(record, ["sessionId", "session_id", "conversationId", "id"]);
  const project = context.project || textFromFields(record, ["project", "repo", "workspace", "cwd"]);

  return normalizeTokenUsageEvent({
    id: stableCollectorId(context, timestamp, model, sessionId, sequence, {
      inputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningOutputTokens,
      totalTokens,
    }),
    userId: context.userId || "local",
    displayName: context.displayName || context.userId || "Local User",
    team: context.team || "Friends",
    source: context.source,
    tool: context.tool,
    model,
    project,
    timestamp,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
    messages: numberFromFields(record, ["messages", "messageCount", "message_count"]),
    sessionId,
  });
}

function tryRecordToUsageEvent(record: Record<string, unknown>, context: ExtractionContext, sequence: number) {
  try {
    return recordToUsageEvent(record, context, sequence);
  } catch {
    return null;
  }
}

function enrichContext(context: ExtractionContext, record: Record<string, unknown>): ExtractionContext {
  return {
    ...context,
    timestamp: context.timestamp || textFromFields(record, ["timestamp", "createdAt", "created_at", "date", "time"]),
    model: context.model || textFromFields(record, ["model", "modelName", "model_name"]),
    project: context.project || textFromFields(record, ["project", "repo", "workspace", "cwd", "root", "directory"]),
    sessionId:
      context.sessionId ||
      textFromFields(record, ["sessionId", "session_id", "conversationId", "conversation_id", "requestId", "id"]),
  };
}

function applyContext(entries: TokenUsageEvent[], context: ExtractionContext) {
  return entries.map((entry) =>
    normalizeTokenUsageEvent({
      ...entry,
      userId: entry.userId || context.userId || "local",
      displayName: entry.displayName || context.displayName || context.userId || "Local User",
      team: entry.team || context.team || "Friends",
      source: entry.source === "manual" ? context.source : entry.source,
      tool: entry.tool === "manual" ? context.tool : entry.tool,
      project: entry.project || context.project,
      sessionId: entry.sessionId || context.sessionId,
    })
  );
}

function hasUsageShape(record: Record<string, unknown>) {
  return Object.keys(record).some((key) => TOKEN_KEYS.has(key)) && sumKnownTokens(record) > 0;
}

function sumKnownTokens(record: Record<string, unknown>) {
  return [...TOKEN_KEYS].reduce((sum, key) => sum + toNumber(record[key]), 0);
}

function numberFromFields(record: Record<string, unknown>, fields: string[]) {
  return fields.reduce((sum, field) => sum + toNumber(record[field]), 0);
}

function textFromFields(record: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parseJsonLine(line: string) {
  const parsed = safeJsonParse(line);
  return parsed === undefined ? [] : [parsed];
}

function safeJsonParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUsageFile(filePath: string) {
  const basename = path.basename(filePath).toLowerCase();
  return (
    [".csv", ".json", ".jsonl", ".log", ".vscdb"].includes(path.extname(filePath).toLowerCase()) ||
    basename === "state.vscdb.backup"
  );
}

function isSqliteUsageFile(filePath: string) {
  const basename = path.basename(filePath).toLowerCase();
  return (
    basename === "state.vscdb" ||
    basename === "state.vscdb.backup" ||
    path.extname(filePath).toLowerCase() === ".vscdb"
  );
}

function shouldSkipDirectory(dirPath: string) {
  const name = path.basename(dirPath);
  return [
    "node_modules",
    ".git",
    ".ripgrep",
    "Cache",
    "CachedData",
    "CachedExtensionVSIXs",
    "Code Cache",
    "Crashpad",
    "GPUCache",
    "IndexedDB",
    "Local Storage",
    "extensions",
    "builtin_skills",
  ].includes(name);
}

function isSensitiveTextKey(key: string) {
  return /^(content|prompt|text|body|transcript)$/i.test(key);
}

function expandHome(inputPath: string) {
  return inputPath.startsWith("~/") ? path.join(os.homedir(), inputPath.slice(2)) : inputPath;
}

function stableCollectorId(
  context: ExtractionContext,
  timestamp: string,
  model: string,
  sessionId: string,
  sequence: number,
  tokens: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
    totalTokens: number;
  }
) {
  const hash = createHash("sha256")
    .update(
      [
        context.source,
        context.filePath || "",
        timestamp,
        model,
        sessionId,
        sequence,
        tokens.inputTokens,
        tokens.cachedInputTokens,
        tokens.outputTokens,
        tokens.reasoningOutputTokens,
        tokens.totalTokens,
      ].join("\n")
    )
    .digest("hex")
    .slice(0, 32);

  return `local:${hash}`;
}
