#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = (process.env.TOKEN_BOARD_API_URL || "https://8-218-149-148.anyip.dev/token-board").replace(/\/+$/, "");
const LEADERBOARD_URL = process.env.TOKEN_BOARD_LEADERBOARD_URL || "https://ffffhx.github.io/garden-lab/token-leaderboard/";
const CONFIG_FILE = process.env.TOKEN_BOARD_AGENT_CONFIG || path.join(os.homedir(), ".token-board-agent.json");
const STATE_FILE = process.env.TOKEN_BOARD_AGENT_STATE_FILE || path.join(os.homedir(), ".token-board-agent-state.json");
const INTERVAL_MS = readPositiveNumber(process.env.TOKEN_BOARD_INTERVAL_MS, 5 * 60 * 1000);
const SINCE_MS = readPositiveNumber(process.env.TOKEN_BOARD_SINCE_HOURS, 24 * 30) * 60 * 60 * 1000;
const MAX_FILES = readPositiveNumber(process.env.TOKEN_BOARD_MAX_FILES, 800);
const MAX_FILE_BYTES = readPositiveNumber(process.env.TOKEN_BOARD_MAX_FILE_BYTES, 5 * 1024 * 1024);
const BATCH_SIZE = 1000;
const VERSION = "0.4.2";
const PACKAGE_URL = `https://ffffhx.github.io/garden-lab/token-board-agent.tgz?v=${VERSION}`;
const INSTALL_DIR = path.join(os.homedir(), ".token-board-agent");
const INSTALLED_AGENT_FILE = path.join(INSTALL_DIR, "token-board-agent.mjs");
const LAUNCH_AGENT_LABEL = "dev.ffffhx.token-board-agent";
const LAUNCH_AGENT_PLIST = path.join(os.homedir(), "Library", "LaunchAgents", `${LAUNCH_AGENT_LABEL}.plist`);
const LOG_FILE = path.join(INSTALL_DIR, "agent.log");
const ERROR_LOG_FILE = path.join(INSTALL_DIR, "agent.err.log");
const TOKEN_KEYS = new Set([
  "cached_input_tokens",
  "cachedInputTokens",
  "cache_creation_input_tokens",
  "cacheCreationInputTokens",
  "cache_read_input_tokens",
  "cacheReadInputTokens",
  "cachedTokens",
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
  "reasoningTokens",
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
const USAGE_FILE_EXTENSIONS = new Set([".csv", ".json", ".jsonl", ".log", ".vscdb"]);
const USAGE_FILE_NAMES = new Set(["state.vscdb", "state.vscdb.backup", "storage.json"]);
const SKIP_DIR_NAMES = new Set([
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
  "node_modules",
  "extensions",
  "builtin_skills",
]);
const DEFAULT_SOURCE_TARGETS = [
  {
    source: "codex",
    tool: "Codex CLI",
    paths: [homePath(".codex", "sessions"), homePath(".codex", "projects")],
  },
  {
    source: "claude-code",
    tool: "Claude Code",
    paths: [homePath(".claude", "projects"), homePath(".claude", "history.jsonl")],
  },
  {
    source: "cursor",
    tool: "Cursor",
    paths: [
      appSupportPath("Cursor", "User", "globalStorage"),
      appSupportPath("Cursor", "logs"),
      configPath("Cursor", "User", "globalStorage"),
      configPath("Cursor", "logs"),
      appDataPath("Cursor", "User", "globalStorage"),
      appDataPath("Cursor", "logs"),
    ],
  },
  {
    source: "trae",
    tool: "Trae",
    paths: [
      appSupportPath("Trae", "User", "globalStorage"),
      appSupportPath("Trae CN", "User", "globalStorage"),
      appSupportPath("Trae", "logs"),
      appSupportPath("Trae CN", "logs"),
      appSupportPath("Trae", "ModularData", "ai-agent"),
      appSupportPath("Trae CN", "ModularData", "ai-agent"),
      configPath("Trae", "User", "globalStorage"),
      configPath("Trae CN", "User", "globalStorage"),
      appDataPath("Trae", "User", "globalStorage"),
      appDataPath("Trae CN", "User", "globalStorage"),
      homePath(".trae"),
      homePath(".trae-cn"),
      homePath(".trae-aicc-internal"),
    ],
  },
];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  const command = process.argv[2] || "sync";
  console.log(`[token-board-agent] running ${command}`);

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "login") {
    await login();
    return;
  }

  if (command === "install") {
    ensureMacosLaunchd();
    await loadOrLoginConfig();
    await installLaunchAgent();
    return;
  }

  if (command === "uninstall") {
    await uninstallLaunchAgent();
    return;
  }

  if (command === "status") {
    await printLaunchAgentStatus();
    return;
  }

  if (command === "sync" || command === "upload") {
    await uploadOnce(await loadOrLoginConfig());
    console.log(`Open leaderboard: ${LEADERBOARD_URL}`);
    return;
  }

  if (command === "resync") {
    await uploadOnce(await loadOrLoginConfig(), { force: true });
    console.log(`Open leaderboard: ${LEADERBOARD_URL}`);
    return;
  }

  if (command === "collect") {
    const config = await readAgentConfig();
    const events = await collectLocalUsageEvents(config);
    console.log(JSON.stringify({ schemaVersion: 1, client: clientInfo(), events }, null, 2));
    return;
  }

  if (command === "watch") {
    const config = await loadOrLoginConfig();
    console.log(`Token usage agent watching every ${Math.round(INTERVAL_MS / 1000)}s.`);

    while (true) {
      await uploadOnce(config).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
      });
      await sleep(INTERVAL_MS);
    }
  }

  printHelp();
  process.exitCode = 1;
}

async function installLaunchAgent() {
  ensureMacosLaunchd();

  await fs.mkdir(INSTALL_DIR, { recursive: true });
  await fs.mkdir(path.dirname(LAUNCH_AGENT_PLIST), { recursive: true });
  await fs.copyFile(fileURLToPath(import.meta.url), INSTALLED_AGENT_FILE);
  await fs.chmod(INSTALLED_AGENT_FILE, 0o755);
  await fs.writeFile(LAUNCH_AGENT_PLIST, launchAgentPlist(), { mode: 0o644 });

  if (process.env.TOKEN_BOARD_AGENT_SKIP_LAUNCHCTL === "1") {
    console.log(`Installed launch agent files without launchctl: ${LAUNCH_AGENT_PLIST}`);
    return;
  }

  const domain = launchctlDomain();
  await runLaunchctl(["bootout", domain, LAUNCH_AGENT_PLIST], { allowFailure: true });
  await runLaunchctl(["bootstrap", domain, LAUNCH_AGENT_PLIST]);
  await runLaunchctl(["enable", `${domain}/${LAUNCH_AGENT_LABEL}`], { allowFailure: true });
  await runLaunchctl(["kickstart", "-k", `${domain}/${LAUNCH_AGENT_LABEL}`]);

  console.log("Token board background sync installed.");
  console.log(`LaunchAgent: ${LAUNCH_AGENT_PLIST}`);
  console.log(`Logs: ${LOG_FILE}`);
}

async function uninstallLaunchAgent() {
  ensureMacosLaunchd();

  if (process.env.TOKEN_BOARD_AGENT_SKIP_LAUNCHCTL !== "1") {
    await runLaunchctl(["bootout", launchctlDomain(), LAUNCH_AGENT_PLIST], { allowFailure: true });
  }

  await fs.rm(LAUNCH_AGENT_PLIST, { force: true });
  await fs.rm(INSTALLED_AGENT_FILE, { force: true });
  console.log("Token board background sync uninstalled.");
  console.log(`Kept auth config: ${CONFIG_FILE}`);
  console.log(`Kept upload state: ${STATE_FILE}`);
}

async function printLaunchAgentStatus() {
  ensureMacosLaunchd();
  const plistExists = await fileExists(LAUNCH_AGENT_PLIST);
  const installedScriptExists = await fileExists(INSTALLED_AGENT_FILE);
  const config = await readAgentConfig();
  const state = await readJson(STATE_FILE);
  const stateMatches = uploadStateMatchesConfig(state, config);
  const uploadedIds = stateMatches && Array.isArray(state.uploadedIds) ? state.uploadedIds.length : 0;

  console.log(`LaunchAgent plist: ${plistExists ? LAUNCH_AGENT_PLIST : "not installed"}`);
  console.log(`Installed script: ${installedScriptExists ? INSTALLED_AGENT_FILE : "not installed"}`);
  console.log(`Logs: ${LOG_FILE}`);
  console.log(`Upload state: ${STATE_FILE}`);
  console.log(`Last uploaded: ${stateMatches && state.lastUploadedAt ? state.lastUploadedAt : "never"}`);
  console.log(`Tracked uploaded IDs: ${uploadedIds}`);

  if (process.env.TOKEN_BOARD_AGENT_SKIP_LAUNCHCTL === "1") {
    return;
  }

  const result = await runLaunchctl(["print", `${launchctlDomain()}/${LAUNCH_AGENT_LABEL}`], { allowFailure: true });
  if (result.code === 0) {
    console.log("launchd status: loaded");
    console.log(result.stdout.split("\n").slice(0, 12).join("\n"));
  } else {
    console.log("launchd status: not loaded");
  }
}

async function loadOrLoginConfig() {
  const config = await readAgentConfig();

  if (typeof config.agentToken === "string" && config.agentToken) {
    return config;
  }

  console.log("No saved GitHub agent session found. Starting login first.");
  await login();
  return readAgentConfig();
}

async function login() {
  const start = await postJson(`${API_URL}/api/auth/device/start`, {});

  console.log("Open GitHub device login and enter the code:");
  console.log(`  ${start.verificationUri}`);
  console.log(`  ${start.userCode}`);

  const expiresAt = Date.now() + Number(start.expiresIn || 900) * 1000;
  let intervalMs = Number(start.interval || 5) * 1000;

  while (Date.now() < expiresAt) {
    await sleep(intervalMs);
    const poll = await postJson(`${API_URL}/api/auth/device/poll`, { deviceCode: start.deviceCode });

    if (poll.status === "authorized" && poll.token) {
      const config = {
        apiUrl: API_URL,
        agentToken: poll.token,
        userId: poll.user?.userId || os.userInfo().username,
        displayName: poll.user?.displayName || poll.user?.githubLogin || os.userInfo().username,
        team: poll.user?.team || "GitHub",
      };
      await writeJson(CONFIG_FILE, config);
      console.log(`Logged in as ${poll.user?.githubLogin || poll.user?.displayName || "GitHub user"}.`);
      console.log(`Saved agent session to ${CONFIG_FILE}`);
      return;
    }

    if (poll.status === "slow_down") {
      intervalMs += 5000;
    } else if (poll.status !== "authorization_pending") {
      throw new Error(poll.errorDescription || poll.error || poll.status || "GitHub device login failed");
    }
  }

  throw new Error("GitHub device login expired. Run this command again.");
}

async function uploadOnce(config, options = {}) {
  const state = await readJson(STATE_FILE);
  const force = options.force === true || process.env.TOKEN_BOARD_FORCE_RESYNC === "1";
  const stateMatches = uploadStateMatchesConfig(state, config);
  const uploadedIds = force || !stateMatches ? new Set() : new Set(Array.isArray(state.uploadedIds) ? state.uploadedIds : []);
  const collectedEvents = await collectLocalUsageEvents(config);
  const events = collectedEvents.filter((event) => !uploadedIds.has(event.id));

  if (!events.length) {
    console.log(
      force
        ? "No token usage events collected for resync."
        : "No new token usage events to upload."
    );
    console.log("Checked Codex, Claude Code, Cursor, Trae, and custom usage paths for recent token logs.");
    return;
  }

  const result = { accepted: 0, duplicates: 0, records: 0 };

  for (const batch of chunk(events, BATCH_SIZE)) {
    const batchResult = await postIngest(config, batch);
    result.accepted += Number(batchResult.accepted || 0);
    result.duplicates += Number(batchResult.duplicates || 0);
    result.records = Number(batchResult.records || result.records || 0);
  }

  await writeJson(STATE_FILE, {
    apiUrl: API_URL,
    userId: config.userId,
    uploadedIds: [...new Set([...uploadedIds, ...events.map((event) => event.id)])].slice(-50_000),
    lastUploadedAt: new Date().toISOString(),
  });

  console.log(
    `${force ? "Resynced" : "Uploaded"} ${events.length} events. accepted=${result.accepted} duplicates=${result.duplicates} records=${result.records}`
  );
}

function uploadStateMatchesConfig(state, config) {
  if (!state || typeof state !== "object") {
    return false;
  }

  const stateApiUrl = typeof state.apiUrl === "string" ? state.apiUrl.replace(/\/+$/, "") : "";
  const stateUserId = typeof state.userId === "string" ? state.userId : "";

  return (!stateApiUrl || stateApiUrl === API_URL) && (!stateUserId || stateUserId === config.userId);
}

async function collectLocalUsageEvents(config) {
  const targets = sourceTargets(config);
  const minMtime = Date.now() - SINCE_MS;
  const files = [];

  for (const target of targets) {
    const targetFiles = [];
    for (const targetPath of target.paths) {
      await collectFiles(expandHome(targetPath), target, targetFiles, minMtime, 0);
    }
    files.push(...targetFiles);
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const events = [];
  for (const file of files.slice(0, MAX_FILES * Math.max(1, targets.length))) {
    events.push(...(await parseUsageFile(file.path, file.target, config)));
  }

  return dedupe(events);
}

function sourceTargets(config) {
  const targets = [];
  const usagePaths = readListEnv("TOKEN_BOARD_USAGE_PATHS") || readStringArray(config.usagePaths) || [];
  const includeDefaultSources =
    process.env.TOKEN_BOARD_INCLUDE_DEFAULT_SOURCES === "false" ? false : config.includeDefaultSources !== false;

  if (includeDefaultSources) {
    targets.push(...DEFAULT_SOURCE_TARGETS);
  }

  if (usagePaths.length) {
    targets.push({
      source: "custom",
      tool: "Custom Usage",
      paths: usagePaths,
    });
  }

  return targets;
}

async function collectFiles(inputPath, target, files, minMtime, depth) {
  if (files.length >= MAX_FILES || depth > 8) {
    return;
  }

  const stat = await fs.stat(inputPath).catch(() => undefined);
  if (!stat) {
    return;
  }

  if (stat.isFile()) {
    if (stat.size <= MAX_FILE_BYTES && stat.mtimeMs >= minMtime && isUsageFile(inputPath)) {
      files.push({ path: inputPath, mtimeMs: stat.mtimeMs, target });
    }
    return;
  }

  if (!stat.isDirectory() || (depth > 0 && shouldSkipDirectory(inputPath))) {
    return;
  }

  let entries;
  try {
    entries = await fs.readdir(inputPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= MAX_FILES) {
      return;
    }
    await collectFiles(path.join(inputPath, entry.name), target, files, minMtime, depth + 1);
  }
}

async function parseUsageFile(filePath, target, config) {
  if (target.source === "codex" && path.extname(filePath).toLowerCase() === ".jsonl") {
    return parseCodexJsonl(filePath, target, config);
  }

  if (isSqliteUsageFile(filePath)) {
    return parseSqliteUsageFile(filePath, target, config);
  }

  const text = await fs.readFile(filePath, "utf8").catch(() => "");
  if (!text) {
    return [];
  }

  const ext = path.extname(filePath).toLowerCase();
  const context = baseExtractionContext(filePath, target, config);

  if (ext === ".csv") {
    return parseCsvUsage(text, context);
  }

  if (ext === ".jsonl" || ext === ".log") {
    return dedupe(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => {
          const parsed = safeJson(line);
          return parsed === undefined ? [] : extractUsageEventsFromJson(parsed, context);
        })
    );
  }

  const parsed = safeJson(text);
  return parsed === undefined ? [] : extractUsageEventsFromJson(parsed, context);
}

async function parseCodexJsonl(filePath, target, config) {
  const text = await fs.readFile(filePath, "utf8").catch(() => "");
  const entries = [];
  let model = "unknown";
  let project = projectFromFile(filePath, target.source);
  let sequence = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.includes('"token_count"') && !line.includes('"model"') && !line.includes('"cwd"')) {
      continue;
    }

    const parsed = safeJson(line);
    const payload = parsed && typeof parsed.payload === "object" ? parsed.payload : {};

    if ((parsed?.type === "turn_context" || parsed?.type === "session_meta") && typeof payload.model === "string") {
      model = payload.model;
    }

    if ((parsed?.type === "turn_context" || parsed?.type === "session_meta") && typeof payload.cwd === "string") {
      project = path.basename(payload.cwd);
    }

    const usage = payload?.info?.last_token_usage;
    if (parsed?.type !== "event_msg" || payload.type !== "token_count" || !usage || !parsed.timestamp) {
      continue;
    }

    sequence += 1;
    const event = usageRecordToEvent(usage, {
      config,
      source: target.source,
      tool: target.tool,
      filePath,
      model,
      project,
      sessionId: filePath,
      sequence,
      timestamp: parsed.timestamp,
    });

    if (event.totalTokens > 0) {
      entries.push(event);
    }
  }

  return entries;
}

function extractUsageEventsFromJson(value, context) {
  const entries = [];
  visitJson(value, context, entries, { sequence: 0 }, 0);
  return dedupe(entries);
}

function visitJson(value, context, entries, state, depth) {
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

  const record = value;
  const nextContext = enrichContext(context, record);

  if (hasUsageShape(record)) {
    state.sequence += 1;
    const event = usageRecordToEvent(record, { ...nextContext, sequence: state.sequence });
    if (event.totalTokens > 0) {
      entries.push(event);
    }
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    if (isSensitiveTextKey(key) && (typeof child === "string" || Array.isArray(child))) {
      continue;
    }

    visitJson(child, nextContext, entries, state, depth + 1);
  }
}

function usageRecordToEvent(usage, context) {
  const baseInputTokens = numberFromFields(usage, ["inputTokens", "input_tokens", "inputTokenCount", "promptTokens", "prompt_tokens"]);
  const additiveCachedInputTokens =
    numberFromFields(usage, ["cache_read_input_tokens", "cacheReadInputTokens"]) +
    numberFromFields(usage, ["cache_creation_input_tokens", "cacheCreationInputTokens"]);
  const inputTokens = baseInputTokens + additiveCachedInputTokens;
  const cachedInputTokens =
    numberFromFields(usage, ["cachedInputTokens", "cached_input_tokens", "cachedTokens"]) +
    additiveCachedInputTokens;
  const outputTokens = numberFromFields(usage, ["outputTokens", "output_tokens", "outputTokenCount", "completionTokens", "completion_tokens"]);
  const reasoningOutputTokens = numberFromFields(usage, [
    "reasoningOutputTokens",
    "reasoning_output_tokens",
    "reasoningTokens",
  ]);
  const explicitTotal = numberFromFields(usage, ["totalTokens", "total_tokens", "totalTokenCount", "tokens"]);
  const computedTotal = inputTokens + outputTokens;
  const totalTokens = computedTotal > 0 ? computedTotal : explicitTotal;
  const idTotalTokens = explicitTotal > 0 ? explicitTotal : totalTokens;
  const timestamp = normalizeTimestamp(context.timestamp || textFromFields(usage, ["timestamp", "createdAt", "created_at", "date", "time"]));
  const model = cleanLabel(context.model || textFromFields(usage, ["model", "modelName", "model_name"]), 80) || "unknown";
  const rawProject = context.project || textFromFields(usage, ["project", "repo", "workspace", "cwd", "root", "directory"]);
  const project = projectBasename(rawProject);
  const rawSessionId =
    context.sessionId || textFromFields(usage, ["sessionId", "session_id", "conversationId", "conversation_id", "requestId", "id"]) || context.filePath;
  const sessionId = rawSessionId ? `session:${sha256(rawSessionId).slice(0, 16)}` : "";
  const base = [
    context.config.userId,
    timestamp,
    context.source,
    model,
    project || "",
    sessionId,
    context.sequence,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    idTotalTokens,
  ].join("\n");

  return {
    id: `usage:${sha256(base).slice(0, 32)}`,
    userId: context.config.userId,
    displayName: context.config.displayName,
    team: context.config.team || "GitHub",
    source: context.source,
    tool: context.tool,
    model,
    project,
    sessionId,
    timestamp,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
    messages: numberFromFields(usage, ["messages", "messageCount", "message_count"]),
  };
}

async function postIngest(config, events) {
  const response = await fetch(`${API_URL}/api/usage/ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.agentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schemaVersion: 1,
      client: clientInfo(),
      events,
    }),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || `Upload failed with HTTP ${response.status}`);
  }

  return payload;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with HTTP ${response.status}`);
  }

  return payload;
}

async function parseSqliteUsageFile(filePath, target, config) {
  const context = baseExtractionContext(filePath, target, config);
  const entries = [];
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
      if (!row || typeof row !== "object") {
        continue;
      }

      const value = typeof row.value === "string" ? row.value : "";
      const parsed = safeJson(value);
      if (parsed === undefined) {
        continue;
      }

      entries.push(
        ...extractUsageEventsFromJson(parsed, {
          ...context,
          sessionId: `${filePath}:${typeof row.key === "string" ? row.key : "sqlite"}`,
        })
      );
    }
  }

  return dedupe(entries);
}

function querySqliteJson(filePath, sql) {
  return new Promise((resolve) => {
    execFile("sqlite3", ["-readonly", "-json", filePath, sql], { maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve([]);
        return;
      }

      const parsed = safeJson(stdout);
      resolve(Array.isArray(parsed) ? parsed : []);
    });
  });
}

function parseCsvUsage(text, context) {
  const rows = parseCsvRows(text);
  const [headers, ...bodyRows] = rows;
  if (!headers?.length || !bodyRows.length) {
    return [];
  }

  const entries = bodyRows.flatMap((row, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header.trim(), row[column] ?? ""]));
    const event = usageRecordToEvent(record, {
      ...enrichContext(context, record),
      sessionId: textFromFields(record, ["sessionId", "session", "conversationId"]) || `${context.filePath}:${index}`,
      sequence: index + 1,
    });
    return event.totalTokens > 0 ? [event] : [];
  });

  return dedupe(entries);
}

function parseCsvRows(input) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function baseExtractionContext(filePath, target, config) {
  return {
    config,
    source: target.source,
    tool: target.tool,
    filePath,
    project: projectFromFile(filePath, target.source),
    sessionId: filePath,
  };
}

function enrichContext(context, record) {
  return {
    ...context,
    timestamp: textFromFields(record, ["timestamp", "createdAt", "created_at", "date", "time"]) || context.timestamp,
    model: textFromFields(record, ["model", "modelName", "model_name"]) || context.model,
    project: textFromFields(record, ["project", "repo", "workspace", "cwd", "root", "directory"]) || context.project,
    sessionId:
      textFromFields(record, ["sessionId", "session_id", "conversationId", "conversation_id", "requestId", "id"]) ||
      context.sessionId,
  };
}

function hasUsageShape(record) {
  return Object.keys(record).some((key) => TOKEN_KEYS.has(key)) && sumKnownTokens(record) > 0;
}

function sumKnownTokens(record) {
  return [...TOKEN_KEYS].reduce((sum, key) => sum + toNumber(record[key]), 0);
}

function numberFromFields(record, fields) {
  return fields.reduce((sum, field) => sum + toNumber(record[field]), 0);
}

function textFromFields(record, fields) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeTimestamp(value) {
  const date = new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function cleanLabel(value, maxLength) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
}

function projectBasename(value) {
  const text = cleanLabel(value, 240);
  return text ? cleanLabel(path.basename(text.replace(/\\/g, "/")), 80) : undefined;
}

function projectFromFile(filePath, source) {
  const parts = filePath.split(path.sep);
  const projectsIndex = parts.lastIndexOf("projects");

  if ((source === "claude-code" || source === "codex") && projectsIndex >= 0 && parts[projectsIndex + 1]) {
    return parts[projectsIndex + 1];
  }

  return path.basename(path.dirname(filePath));
}

function isSensitiveTextKey(key) {
  return /^(content|prompt|text|body|transcript)$/i.test(key);
}

function isUsageFile(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return USAGE_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase()) || USAGE_FILE_NAMES.has(name);
}

function isSqliteUsageFile(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return name === "state.vscdb" || name === "state.vscdb.backup" || path.extname(filePath).toLowerCase() === ".vscdb";
}

function shouldSkipDirectory(dirPath) {
  return SKIP_DIR_NAMES.has(path.basename(dirPath));
}

function expandHome(inputPath) {
  return inputPath.startsWith("~/") ? path.join(os.homedir(), inputPath.slice(2)) : inputPath;
}

async function readAgentConfig() {
  const config = await readJson(CONFIG_FILE);
  const username = os.userInfo().username || "local";

  return {
    ...config,
    userId: cleanLabel(config.userId, 80) || username,
    displayName: cleanLabel(config.displayName, 80) || cleanLabel(config.githubLogin, 80) || username,
    team: cleanLabel(config.team, 80) || "GitHub",
    usagePaths: readStringArray(config.usagePaths) || [],
  };
}

function readStringArray(value) {
  return Array.isArray(value) ? value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : [])) : undefined;
}

function readListEnv(name) {
  const value = process.env[name];
  return value?.trim()
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

function clientInfo() {
  return { name: "token-board-agent", version: VERSION, hostId: os.hostname() };
}

function printHelp() {
  console.log(`Usage:
  npx --yes --package ${PACKAGE_URL} -- token-board-agent
  npx --yes --package ${PACKAGE_URL} -- token-board-agent install
  npx --yes --package ${PACKAGE_URL} -- token-board-agent status
  npx --yes --package ${PACKAGE_URL} -- token-board-agent uninstall
  npx --yes --package ${PACKAGE_URL} -- token-board-agent watch
  npx --yes --package ${PACKAGE_URL} -- token-board-agent login
  npx --yes --package ${PACKAGE_URL} -- token-board-agent collect
  npx --yes --package ${PACKAGE_URL} -- token-board-agent upload
  npx --yes --package ${PACKAGE_URL} -- token-board-agent resync`);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function dedupe(events) {
  const seen = new Set();
  return events.filter((event) => {
    if (seen.has(event.id)) {
      return false;
    }
    seen.add(event.id);
    return true;
  });
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function readPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function homePath(...segments) {
  return path.join(os.homedir(), ...segments);
}

function appSupportPath(...segments) {
  return path.join(os.homedir(), "Library", "Application Support", ...segments);
}

function configPath(...segments) {
  return path.join(os.homedir(), ".config", ...segments);
}

function appDataPath(...segments) {
  return process.env.APPDATA ? path.join(process.env.APPDATA, ...segments) : path.join(os.homedir(), "AppData", "Roaming", ...segments);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureMacosLaunchd() {
  if (process.platform !== "darwin") {
    throw new Error("Background install currently supports macOS LaunchAgent only. Use `watch` on this platform.");
  }
}

function launchAgentPlist() {
  const environment = {
    TOKEN_BOARD_API_URL: API_URL,
    TOKEN_BOARD_LEADERBOARD_URL: LEADERBOARD_URL,
    TOKEN_BOARD_AGENT_CONFIG: CONFIG_FILE,
    TOKEN_BOARD_AGENT_STATE_FILE: STATE_FILE,
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(LAUNCH_AGENT_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(process.execPath)}</string>
    <string>${escapeXml(INSTALLED_AGENT_FILE)}</string>
    <string>watch</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(environment)
  .map(([key, value]) => `    <key>${escapeXml(key)}</key>\n    <string>${escapeXml(value)}</string>`)
  .join("\n")}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(LOG_FILE)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(ERROR_LOG_FILE)}</string>
</dict>
</plist>
`;
}

function launchctlDomain() {
  return `gui/${process.getuid()}`;
}

function runLaunchctl(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("launchctl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (options.allowFailure) {
        resolve({ code: 1, stdout, stderr: error.message });
      } else {
        reject(error);
      }
    });
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) {
        resolve({ code: code || 0, stdout, stderr });
      } else {
        reject(new Error(stderr.trim() || `launchctl ${args.join(" ")} failed with exit ${code}`));
      }
    });
  });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
