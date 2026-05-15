#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = (process.env.TOKEN_BOARD_API_URL || "https://8-218-149-148.anyip.dev/token-board").replace(/\/+$/, "");
const LEADERBOARD_URL = process.env.TOKEN_BOARD_LEADERBOARD_URL || "https://ffffhx.github.io/blog/token-leaderboard/";
const CONFIG_FILE = process.env.TOKEN_BOARD_AGENT_CONFIG || path.join(os.homedir(), ".token-board-agent.json");
const STATE_FILE = process.env.TOKEN_BOARD_AGENT_STATE_FILE || path.join(os.homedir(), ".token-board-agent-state.json");
const INTERVAL_MS = readPositiveNumber(process.env.TOKEN_BOARD_INTERVAL_MS, 5 * 60 * 1000);
const SINCE_MS = readPositiveNumber(process.env.TOKEN_BOARD_SINCE_HOURS, 24 * 30) * 60 * 60 * 1000;
const MAX_FILES = readPositiveNumber(process.env.TOKEN_BOARD_MAX_FILES, 800);
const MAX_FILE_BYTES = readPositiveNumber(process.env.TOKEN_BOARD_MAX_FILE_BYTES, 5 * 1024 * 1024);
const BATCH_SIZE = 1000;
const VERSION = "0.3.0";
const INSTALL_DIR = path.join(os.homedir(), ".token-board-agent");
const INSTALLED_AGENT_FILE = path.join(INSTALL_DIR, "token-board-agent.mjs");
const LAUNCH_AGENT_LABEL = "dev.ffffhx.token-board-agent";
const LAUNCH_AGENT_PLIST = path.join(os.homedir(), "Library", "LaunchAgents", `${LAUNCH_AGENT_LABEL}.plist`);
const LOG_FILE = path.join(INSTALL_DIR, "agent.log");
const ERROR_LOG_FILE = path.join(INSTALL_DIR, "agent.err.log");

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

  console.log(`LaunchAgent plist: ${plistExists ? LAUNCH_AGENT_PLIST : "not installed"}`);
  console.log(`Installed script: ${installedScriptExists ? INSTALLED_AGENT_FILE : "not installed"}`);
  console.log(`Logs: ${LOG_FILE}`);

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
  const config = await readJson(CONFIG_FILE);

  if (typeof config.agentToken === "string" && config.agentToken) {
    return config;
  }

  console.log("No saved GitHub agent session found. Starting login first.");
  await login();
  return readJson(CONFIG_FILE);
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

async function uploadOnce(config) {
  const state = await readJson(STATE_FILE);
  const uploadedIds = new Set(Array.isArray(state.uploadedIds) ? state.uploadedIds : []);
  const events = (await collectCodexEvents(config)).filter((event) => !uploadedIds.has(event.id));

  if (!events.length) {
    console.log("No new token usage events to upload.");
    console.log("Checked ~/.codex/sessions and ~/.codex/projects for recent Codex token_count logs.");
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
    uploadedIds: [...new Set([...uploadedIds, ...events.map((event) => event.id)])].slice(-50_000),
    lastUploadedAt: new Date().toISOString(),
  });

  console.log(
    `Uploaded ${events.length} events. accepted=${result.accepted} duplicates=${result.duplicates} records=${result.records}`
  );
}

async function collectCodexEvents(config) {
  const roots = [path.join(os.homedir(), ".codex", "sessions"), path.join(os.homedir(), ".codex", "projects")];
  const minMtime = Date.now() - SINCE_MS;
  const files = [];

  for (const root of roots) {
    await collectFiles(root, files, minMtime);
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const events = [];
  for (const file of files.slice(0, MAX_FILES)) {
    events.push(...(await parseCodexJsonl(file.path, config)));
  }

  return dedupe(events);
}

async function collectFiles(dir, files, minMtime) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, files, minMtime);
      continue;
    }

    if (!entry.isFile() || !fullPath.endsWith(".jsonl")) {
      continue;
    }

    const stat = await fs.stat(fullPath).catch(() => undefined);
    if (!stat || stat.size > MAX_FILE_BYTES || stat.mtimeMs < minMtime) {
      continue;
    }

    files.push({ path: fullPath, mtimeMs: stat.mtimeMs });
  }
}

async function parseCodexJsonl(filePath, config) {
  const text = await fs.readFile(filePath, "utf8").catch(() => "");
  const entries = [];
  let model = "unknown";
  let project = undefined;
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
    const event = usageToEvent(usage, {
      config,
      filePath,
      model,
      project,
      sequence,
      timestamp: parsed.timestamp,
    });

    if (event.totalTokens > 0) {
      entries.push(event);
    }
  }

  return entries;
}

function usageToEvent(usage, context) {
  const inputTokens = numberField(usage, "input_tokens");
  const cachedInputTokens = numberField(usage, "cached_input_tokens");
  const outputTokens = numberField(usage, "output_tokens");
  const reasoningOutputTokens = numberField(usage, "reasoning_output_tokens");
  const explicitTotal = numberField(usage, "total_tokens");
  const totalTokens = explicitTotal > 0 ? explicitTotal : inputTokens + cachedInputTokens + outputTokens + reasoningOutputTokens;
  const sessionId = `session:${sha256(context.filePath).slice(0, 16)}`;
  const base = [
    context.config.userId,
    context.timestamp,
    context.model,
    context.project || "",
    sessionId,
    context.sequence,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
  ].join("\n");

  return {
    id: `usage:${sha256(base).slice(0, 32)}`,
    userId: context.config.userId,
    displayName: context.config.displayName,
    team: context.config.team || "GitHub",
    source: "codex",
    tool: "Codex CLI",
    model: context.model,
    project: context.project,
    sessionId,
    timestamp: new Date(context.timestamp).toISOString(),
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
    messages: 0,
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
      client: { name: "token-board-agent", version: VERSION, hostId: os.hostname() },
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

function printHelp() {
  console.log(`Usage:
  npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz -- token-board-agent
  npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz -- token-board-agent install
  npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz -- token-board-agent status
  npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz -- token-board-agent uninstall
  npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz -- token-board-agent watch
  npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz -- token-board-agent login
  npx --yes --package https://ffffhx.github.io/blog/token-board-agent.tgz -- token-board-agent upload`);
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

function numberField(record, key) {
  const value = Number(record?.[key]);
  return Number.isFinite(value) && value > 0 ? value : 0;
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
