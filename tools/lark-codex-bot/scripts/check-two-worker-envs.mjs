#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(packageRoot, "../..");

const args = parseArgs(process.argv.slice(2));
const envAPath = resolvePath(args.envA || path.join(packageRoot, ".env.worker.bot-a"));
const envBPath = resolvePath(args.envB || path.join(packageRoot, ".env.worker.bot-b"));
const checks = [];

const envA = readEnvFile(envAPath, "Bot A");
const envB = readEnvFile(envBPath, "Bot B");

checkWorkerEnv("Bot A", envA, envB);
checkWorkerEnv("Bot B", envB, envA);
checkPair(envA, envB);
await checkHub(envA);
checkCodex(envA);
checkCodex(envB);
if (args.onlineFeishu) {
  await checkFeishuIdentity("Bot A", envA, envB);
  await checkFeishuIdentity("Bot B", envB, envA);
  checkVisibleRobotPair(envA, envB);
}

printReport();
if (checks.some((check) => check.status === "fail")) {
  process.exit(1);
}

function readEnvFile(filePath, label) {
  if (!existsSync(filePath)) {
    addCheck("fail", `${label} env file exists`, filePath);
    return {};
  }

  addCheck("pass", `${label} env file exists`, path.relative(workspaceRoot, filePath));
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    env[match[1]] = unquote(match[2].trim());
  }
  return env;
}

function checkWorkerEnv(label, env, peerEnv) {
  requireValue(label, env, "HUB_BASE_URL");
  requireValue(label, env, "HUB_WORKER_TOKEN");
  requireValue(label, env, "WORKER_ID");
  requireValue(label, env, "RELAY_BOT_ID");
  requireValue(label, env, "RELAY_PEER_BOT_ID");
  requireValue(label, env, "RELAY_FINAL_BOT_ID");
  requireValue(label, env, "CODEX_BIN");
  requireValue(label, env, "CODEX_WORKDIR");
  requireValue(label, env, "CODEX_SESSION_STORE");

  checkBoolean(label, env, "RELAY_ENABLED", true);
  checkBoolean(label, env, "RELAY_FINAL_ENABLED", true);
  checkBoolean(label, env, "RELAY_REPLY_INTERMEDIATE", true);

  if (env.RESULT_REPLY_MODE !== "worker") {
    addCheck("fail", `${label} RESULT_REPLY_MODE`, "expected worker");
  } else {
    addCheck("pass", `${label} RESULT_REPLY_MODE`, "worker");
  }

  if (env.LARK_REPLY_MODE !== "openapi" && env.LARK_REPLY_MODE !== "cli") {
    addCheck("fail", `${label} LARK_REPLY_MODE`, "expected openapi or cli");
  } else {
    addCheck("pass", `${label} LARK_REPLY_MODE`, env.LARK_REPLY_MODE);
  }

  if (env.LARK_REPLY_MODE === "openapi") {
    requireValue(label, env, "LARK_APP_ID");
    requireValue(label, env, "LARK_APP_SECRET");
    checkNotPlaceholder(label, env, "LARK_APP_ID");
    checkNotPlaceholder(label, env, "LARK_APP_SECRET");
  } else if (env.LARK_REPLY_MODE === "cli") {
    addCheck("skip", `${label} OpenAPI credentials`, "not required when LARK_REPLY_MODE=cli");
  }

  if (env.RELAY_PEER_BOT_ID && peerEnv.RELAY_BOT_ID && env.RELAY_PEER_BOT_ID !== peerEnv.RELAY_BOT_ID) {
    addCheck("fail", `${label} peer bot id`, `expected ${peerEnv.RELAY_BOT_ID}`);
  } else if (env.RELAY_PEER_BOT_ID) {
    addCheck("pass", `${label} peer bot id`, env.RELAY_PEER_BOT_ID);
  }

  if (!existsSync(path.resolve(env.CODEX_WORKDIR || ""))) {
    addCheck("fail", `${label} CODEX_WORKDIR exists`, env.CODEX_WORKDIR || "<empty>");
  } else {
    addCheck("pass", `${label} CODEX_WORKDIR exists`, env.CODEX_WORKDIR);
  }

  for (const dir of parseListEnv(env.CODEX_ADD_DIRS)) {
    const resolved = path.resolve(dir);
    if (!existsSync(resolved)) {
      addCheck("fail", `${label} CODEX_ADD_DIRS path exists`, dir);
    } else {
      addCheck("pass", `${label} CODEX_ADD_DIRS path exists`, resolved);
    }
  }
}

function checkPair(envA, envB) {
  if (envA.HUB_BASE_URL && envB.HUB_BASE_URL && envA.HUB_BASE_URL !== envB.HUB_BASE_URL) {
    addCheck("fail", "A/B hub URL match", "HUB_BASE_URL differs");
  } else if (envA.HUB_BASE_URL) {
    addCheck("pass", "A/B hub URL match", envA.HUB_BASE_URL);
  }

  if (envA.HUB_WORKER_TOKEN && envB.HUB_WORKER_TOKEN && envA.HUB_WORKER_TOKEN !== envB.HUB_WORKER_TOKEN) {
    addCheck("fail", "A/B worker token match", "tokens differ");
  } else if (envA.HUB_WORKER_TOKEN) {
    addCheck("pass", "A/B worker token match", "<redacted>");
  }

  if (envA.RELAY_BOT_ID && envB.RELAY_BOT_ID && envA.RELAY_BOT_ID === envB.RELAY_BOT_ID) {
    addCheck("fail", "A/B relay bot ids differ", envA.RELAY_BOT_ID);
  } else if (envA.RELAY_BOT_ID && envB.RELAY_BOT_ID) {
    addCheck("pass", "A/B relay bot ids differ", `${envA.RELAY_BOT_ID} / ${envB.RELAY_BOT_ID}`);
  }

  if (envA.CODEX_SESSION_STORE && envB.CODEX_SESSION_STORE && path.resolve(envA.CODEX_SESSION_STORE) === path.resolve(envB.CODEX_SESSION_STORE)) {
    addCheck("fail", "A/B session stores differ", envA.CODEX_SESSION_STORE);
  } else if (envA.CODEX_SESSION_STORE && envB.CODEX_SESSION_STORE) {
    addCheck("pass", "A/B session stores differ", "isolated");
  }

  const addDirsA = parseListEnv(envA.CODEX_ADD_DIRS).map((dir) => path.resolve(dir));
  const addDirsB = parseListEnv(envB.CODEX_ADD_DIRS).map((dir) => path.resolve(dir));
  if (addDirsA.length || addDirsB.length) {
    const normalizedA = JSON.stringify(addDirsA);
    const normalizedB = JSON.stringify(addDirsB);
    if (normalizedA !== normalizedB) {
      addCheck("fail", "A/B CODEX_ADD_DIRS match", `${addDirsA.join(",") || "<empty>"} / ${addDirsB.join(",") || "<empty>"}`);
    } else {
      addCheck("pass", "A/B CODEX_ADD_DIRS match", addDirsA.join(","));
    }
  }

  if (envA.RELAY_FINAL_BOT_ID && envA.RELAY_FINAL_BOT_ID !== envA.RELAY_BOT_ID && envA.RELAY_FINAL_BOT_ID !== envB.RELAY_BOT_ID) {
    addCheck("fail", "final bot id belongs to A or B", envA.RELAY_FINAL_BOT_ID);
  } else if (envA.RELAY_FINAL_BOT_ID) {
    addCheck("pass", "final bot id belongs to A or B", envA.RELAY_FINAL_BOT_ID);
  }
}

async function checkHub(env) {
  if (!args.onlineHub) {
    addCheck("skip", "hub health check", "pass --online-hub to verify network reachability");
    return;
  }

  if (!env.HUB_BASE_URL) {
    addCheck("fail", "hub health check", "missing HUB_BASE_URL");
    return;
  }

  try {
    const response = await fetch(`${env.HUB_BASE_URL.replace(/\/+$/, "")}/health`);
    const text = await response.text();
    if (!response.ok) {
      addCheck("fail", "hub health check", `HTTP ${response.status}: ${summarizeText(text)}`);
      return;
    }
    const data = tryParseJson(text);
    if (!data?.ok) {
      addCheck("fail", "hub health check", `unexpected response: ${summarizeText(text)}`);
      return;
    }
    addCheck("pass", "hub health check", data.mode ? `mode=${data.mode}` : "ok");
  } catch (error) {
    addCheck("fail", "hub health check", error.message);
  }
}

function checkCodex(env) {
  const label = env.RELAY_BOT_ID || env.WORKER_ID || "worker";
  if (!env.CODEX_BIN) {
    addCheck("fail", `${label} codex binary`, "missing CODEX_BIN");
    return;
  }

  const command = process.platform === "win32" ? "where" : "command";
  const commandArgs = process.platform === "win32" ? [env.CODEX_BIN] : ["-v", env.CODEX_BIN];
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    shell: process.platform !== "win32",
  });
  if (result.status === 0) {
    addCheck("pass", `${label} codex binary`, env.CODEX_BIN);
  } else {
    addCheck("fail", `${label} codex binary`, `not found: ${env.CODEX_BIN}`);
  }
}

async function checkFeishuApp(label, env) {
  if (!env.LARK_APP_ID || !env.LARK_APP_SECRET || isPlaceholder(env.LARK_APP_ID) || isPlaceholder(env.LARK_APP_SECRET)) {
    addCheck("fail", `${label} Feishu token`, "missing or placeholder credentials");
    return;
  }

  const baseUrl = (env.LARK_BASE_URL || "https://open.feishu.cn/open-apis").replace(/\/+$/, "");
  try {
    const response = await fetch(`${baseUrl}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        app_id: env.LARK_APP_ID,
        app_secret: env.LARK_APP_SECRET,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.code === 0 && data.tenant_access_token) {
      addCheck("pass", `${label} Feishu token`, "tenant_access_token ok");
    } else {
      addCheck("fail", `${label} Feishu token`, `HTTP ${response.status} code=${data.code ?? "unknown"}`);
    }
  } catch (error) {
    addCheck("fail", `${label} Feishu token`, error.message);
  }
}

async function checkFeishuIdentity(label, env) {
  if (env.LARK_REPLY_MODE === "cli") {
    checkLarkCli(label, env);
    return;
  }

  await checkFeishuApp(label, env);
}

function checkVisibleRobotPair(envA, envB) {
  if (envA.LARK_REPLY_MODE === "cli" && envB.LARK_REPLY_MODE === "cli") {
    const appA = readCliAppId(envA);
    const appB = readCliAppId(envB);
    const dirA = normalizeCliConfigDir(envA.LARKSUITE_CLI_CONFIG_DIR);
    const dirB = normalizeCliConfigDir(envB.LARKSUITE_CLI_CONFIG_DIR);
    if (dirA === dirB) {
      addCheck("fail", "visible Feishu robot identities", "both workers use the same lark-cli config dir");
      return;
    }
    if (appA && appB && appA === appB) {
      addCheck("fail", "visible Feishu robot identities", `same lark-cli app id: ${appA}`);
      return;
    }
    addCheck("pass", "visible Feishu robot identities", `${appA || "cli A"} / ${appB || "cli B"}`);
    return;
  }

  if (
    envA.LARK_REPLY_MODE === "openapi" &&
    envB.LARK_REPLY_MODE === "openapi" &&
    envA.LARK_APP_ID &&
    envB.LARK_APP_ID &&
    envA.LARK_APP_ID === envB.LARK_APP_ID
  ) {
    addCheck("fail", "visible Feishu robot identities", `same app id: ${envA.LARK_APP_ID}`);
    return;
  }

  addCheck("pass", "visible Feishu robot identities", "distinct reply identities configured");
}

function checkLarkCli(label, env) {
  const result = spawnSync("lark-cli", ["auth", "scopes", "--format", "json"], {
    encoding: "utf8",
    env: env.LARKSUITE_CLI_CONFIG_DIR
      ? { ...process.env, LARKSUITE_CLI_CONFIG_DIR: env.LARKSUITE_CLI_CONFIG_DIR }
      : process.env,
    shell: false,
  });
  if (result.status !== 0) {
    addCheck("fail", `${label} lark-cli app`, summarizeText(result.stderr || result.stdout || `exit ${result.status}`));
    return;
  }
  const data = tryParseJsonTail(result.stdout);
  if (data?.appId) {
    addCheck("pass", `${label} lark-cli app`, `app: ${data.appId} (${data.brand || "unknown"})`);
  } else {
    addCheck("fail", `${label} lark-cli app`, "scope check did not return an appId");
  }
}

function tryParseJsonTail(output) {
  const start = output.indexOf("{");
  if (start === -1) {
    return null;
  }
  return tryParseJson(output.slice(start));
}

function readCliAppId(env) {
  try {
    const configPath = path.join(normalizeCliConfigDir(env.LARKSUITE_CLI_CONFIG_DIR), "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    return config.apps?.[0]?.appId || "";
  } catch {
    return "";
  }
}

function normalizeCliConfigDir(value) {
  if (value) {
    return path.resolve(value);
  }
  return path.join(process.env.HOME || "", ".lark-cli");
}

function requireValue(label, env, key) {
  if (!env[key]) {
    addCheck("fail", `${label} ${key}`, "missing");
    return false;
  }
  addCheck("pass", `${label} ${key}`, isSecretKey(key) ? "<redacted>" : env[key]);
  return true;
}

function checkBoolean(label, env, key, expected) {
  const actual = parseBoolean(env[key]);
  if (actual !== expected) {
    addCheck("fail", `${label} ${key}`, `expected ${expected}`);
  } else {
    addCheck("pass", `${label} ${key}`, String(expected));
  }
}

function checkNotPlaceholder(label, env, key) {
  if (!env[key]) {
    return;
  }
  if (isPlaceholder(env[key])) {
    addCheck("fail", `${label} ${key} is real`, "placeholder value");
  } else {
    addCheck("pass", `${label} ${key} is real`, isSecretKey(key) ? "<redacted>" : env[key]);
  }
}

function isPlaceholder(value) {
  return /^(cli_bot_[ab]|replace-with-|xxx|yyy|your-|example)/i.test(value);
}

function isSecretKey(key) {
  return /SECRET|TOKEN/.test(key);
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function parseListEnv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function addCheck(status, name, detail) {
  checks.push({ status, name, detail });
}

function printReport() {
  const width = Math.max(...checks.map((check) => check.name.length), 0);
  for (const check of checks) {
    const icon = check.status === "pass" ? "PASS" : check.status === "fail" ? "FAIL" : "SKIP";
    console.log(`${icon} ${check.name.padEnd(width)} ${check.detail}`);
  }
  const failed = checks.filter((check) => check.status === "fail").length;
  const skipped = checks.filter((check) => check.status === "skip").length;
  console.log(`summary: ${checks.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`);
}

function parseArgs(argv) {
  const parsed = {
    envA: "",
    envB: "",
    onlineFeishu: false,
    onlineHub: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--online-feishu") {
      parsed.onlineFeishu = true;
      continue;
    }
    if (arg === "--online-hub") {
      parsed.onlineHub = true;
      continue;
    }
    if (arg === "--env-a") {
      parsed.envA = readArgValue(argv, ++index, arg);
      continue;
    }
    if (arg === "--env-b") {
      parsed.envB = readArgValue(argv, ++index, arg);
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return parsed;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarizeText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "<empty>";
  }
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function readArgValue(argv, index, option) {
  const value = argv[index];
  if (!value) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function resolvePath(value) {
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.resolve(workspaceRoot, value);
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
