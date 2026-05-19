#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { chmod, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
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
const larkBaseUrl = (args.larkBaseUrl || "https://open.feishu.cn/open-apis").replace(/\/+$/, "");

const appA = args.botAFromLarkCli ? readLarkCliAppConfig("") : readAppConfig("BOT_A");
const appB = args.botBFromLarkCliDir
  ? readLarkCliAppConfig(resolvePath(args.botBFromLarkCliDir))
  : readAppConfig("BOT_B");

if (appA.appId === appB.appId) {
  throw new Error("BOT_A_APP_ID and BOT_B_APP_ID must be different for two visible Feishu robots.");
}

if (!args.skipOnlineFeishu) {
  if (appA.mode === "cli") {
    checkLarkCliApp("Bot A");
  } else {
    await checkFeishuApp("Bot A", appA);
  }
  if (appB.mode === "cli") {
    checkLarkCliApp("Bot B", appB.configDir);
  } else {
    await checkFeishuApp("Bot B", appB);
  }
}

if (args.dryRun) {
  console.log(`would update ${path.relative(workspaceRoot, envAPath)} with Bot A app ${appA.appId}`);
  console.log(`would update ${path.relative(workspaceRoot, envBPath)} with Bot B app ${appB.appId}`);
} else {
  const updatesA = appA.mode === "cli"
    ? {
      LARK_APP_ID: appA.appId,
      LARK_BASE_URL: larkBaseUrl,
      LARK_REPLY_MODE: "cli",
      RESULT_REPLY_MODE: "worker",
    }
    : {
      LARK_APP_ID: appA.appId,
      LARK_APP_SECRET: appA.appSecret,
      LARK_BASE_URL: larkBaseUrl,
      LARK_REPLY_MODE: "openapi",
      RESULT_REPLY_MODE: "worker",
    };
  await updateWorkerEnv(envAPath, updatesA);
  const updatesB = appB.mode === "cli"
    ? {
      LARKSUITE_CLI_CONFIG_DIR: appB.configDir,
      LARK_APP_ID: appB.appId,
      LARK_APP_SECRET: "",
      LARK_BASE_URL: larkBaseUrl,
      LARK_REPLY_MODE: "cli",
      RESULT_REPLY_MODE: "worker",
    }
    : {
      LARK_APP_ID: appB.appId,
      LARK_APP_SECRET: appB.appSecret,
      LARK_BASE_URL: larkBaseUrl,
      LARK_REPLY_MODE: "openapi",
      RESULT_REPLY_MODE: "worker",
    };
  await updateWorkerEnv(envBPath, updatesB);

  console.log(`updated ${path.relative(workspaceRoot, envAPath)} with Bot A app ${appA.appId}`);
  console.log(`updated ${path.relative(workspaceRoot, envBPath)} with Bot B app ${appB.appId}`);
}

if (args.restartLaunchd) {
  restartLaunchdAgents(args.dryRun);
}

console.log("done");

function readAppConfig(prefix) {
  const appId = process.env[`${prefix}_APP_ID`] || "";
  const appSecret = process.env[`${prefix}_APP_SECRET`] || "";
  if (!appId || !appSecret) {
    throw new Error(`${prefix}_APP_ID and ${prefix}_APP_SECRET are required.`);
  }
  if (isPlaceholder(appId) || isPlaceholder(appSecret)) {
    throw new Error(`${prefix}_APP_ID and ${prefix}_APP_SECRET must be real values, not placeholders.`);
  }
  return { appId, appSecret, mode: "openapi" };
}

async function updateWorkerEnv(filePath, updates) {
  if (!existsSync(filePath)) {
    throw new Error(`env file not found: ${filePath}`);
  }

  const seen = new Set();
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).map((line) => {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    if (!match || !(match[1] in updates)) {
      return line;
    }
    seen.add(match[1]);
    return `${match[1]}=${updates[match[1]]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  await writeFile(filePath, lines.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 });
  await chmod(filePath, 0o600);
}

async function checkFeishuApp(label, app) {
  const response = await fetch(`${larkBaseUrl}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      app_id: app.appId,
      app_secret: app.appSecret,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok && data.code === 0 && data.tenant_access_token) {
    console.log(`${label} Feishu token ok (${app.appId})`);
    return;
  }

  const code = data.code ?? "unknown";
  const message = data.msg || data.message || response.statusText || "unknown error";
  throw new Error(`${label} Feishu token failed: HTTP ${response.status} code=${code} ${message}`);
}

function restartLaunchdAgents(dryRun) {
  if (process.platform !== "darwin") {
    throw new Error("--restart-launchd is only supported on macOS.");
  }
  const uid = process.getuid?.();
  if (!uid) {
    throw new Error("cannot determine current user id for launchd restart.");
  }

  const labels = [
    "dev.ffffhx.lark-codex-worker-a",
    "dev.ffffhx.lark-codex-worker-b",
  ];

  for (const label of labels) {
    const target = `gui/${uid}/${label}`;
    if (dryRun) {
      console.log(`would restart ${target}`);
      continue;
    }
    const result = spawnSync("launchctl", ["kickstart", "-k", target], {
      encoding: "utf8",
      stdio: "pipe",
    });
    if (result.status !== 0) {
      const detail = `${result.stderr || result.stdout}`.trim();
      throw new Error(`failed to restart ${target}: ${detail || `exit ${result.status}`}`);
    }
    console.log(`restarted ${target}`);
  }
}

function parseArgs(argv) {
  const parsed = {
    botAFromLarkCli: false,
    botBFromLarkCliDir: "",
    dryRun: false,
    envA: "",
    envB: "",
    larkBaseUrl: "",
    restartLaunchd: false,
    skipOnlineFeishu: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--bot-a-from-lark-cli") {
      parsed.botAFromLarkCli = true;
      continue;
    }
    if (arg === "--bot-b-from-lark-cli-dir") {
      parsed.botBFromLarkCliDir = readArgValue(argv, ++index, arg);
      continue;
    }
    if (arg === "--restart-launchd") {
      parsed.restartLaunchd = true;
      continue;
    }
    if (arg === "--skip-online-feishu") {
      parsed.skipOnlineFeishu = true;
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
    if (arg === "--lark-base-url") {
      parsed.larkBaseUrl = readArgValue(argv, ++index, arg);
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return parsed;
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

function isPlaceholder(value) {
  return /^(cli_bot_[ab]|replace-with-|xxx|yyy|your-|example)/i.test(value);
}

function readLarkCliAppConfig(configDir) {
  const resolvedConfigDir = configDir ? path.resolve(configDir) : path.join(homedir(), ".lark-cli");
  const configPath = path.join(resolvedConfigDir, "config.json");
  if (!existsSync(configPath)) {
    throw new Error(`lark-cli config not found: ${configPath}`);
  }

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const app = Array.isArray(config.apps) ? config.apps[0] : null;
  const appId = app?.appId || "";
  if (!appId) {
    throw new Error(`lark-cli config does not contain appId: ${configPath}`);
  }
  if (isPlaceholder(appId)) {
    throw new Error("lark-cli config contains placeholder app id.");
  }
  return { appId, configDir: configDir ? resolvedConfigDir : "", mode: "cli" };
}

function checkLarkCliApp(label, configDir = "") {
  const result = spawnSync("lark-cli", ["auth", "scopes", "--format", "json"], {
    encoding: "utf8",
    env: configDir
      ? { ...process.env, LARKSUITE_CLI_CONFIG_DIR: configDir }
      : process.env,
    stdio: "pipe",
  });
  if (result.status !== 0) {
    const detail = `${result.stderr || result.stdout}`.trim();
    throw new Error(`${label} lark-cli app scope check failed: ${detail || `exit ${result.status}`}`);
  }
  const data = parseJsonTail(result.stdout);
  if (!data?.appId) {
    throw new Error(`${label} lark-cli app scope check did not return an appId.`);
  }
  console.log(`${label} lark-cli app ok (${data.appId})`);
}

function parseJsonTail(output) {
  const start = output.indexOf("{");
  if (start === -1) {
    return null;
  }
  return JSON.parse(output.slice(start));
}
