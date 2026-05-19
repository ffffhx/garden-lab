#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(packageRoot, "../..");
const args = parseArgs(process.argv.slice(2));
const configDir = resolvePath(args.configDir || path.join(packageRoot, ".lark-cli.bot-b"));
const configPath = path.join(configDir, "config.json");

if (existsSync(configPath) && !args.force) {
  throw new Error(`Bot B lark-cli config already exists: ${configPath}\nUse --force to re-run setup.`);
}

if (args.dryRun) {
  console.log(`would create/use Bot B lark-cli config dir: ${path.relative(workspaceRoot, configDir)}`);
  console.log(`would run: LARKSUITE_CLI_CONFIG_DIR=${configDir} lark-cli config init --new`);
  process.exit(0);
}

await mkdir(configDir, { recursive: true });

console.log(`Bot B lark-cli config dir: ${path.relative(workspaceRoot, configDir)}`);
console.log("A browser page will open. Complete the Feishu app creation/configuration there.");

const result = spawnSync("lark-cli", ["config", "init", "--new"], {
  encoding: "utf8",
  env: {
    ...process.env,
    LARKSUITE_CLI_CONFIG_DIR: configDir,
  },
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log("");
console.log("Bot B lark-cli config saved.");
console.log("Next:");
console.log("  pnpm lark:codex-apply-two-bots -- --bot-a-from-lark-cli --bot-b-from-lark-cli-dir tools/lark-codex-bot/.lark-cli.bot-b --restart-launchd");
console.log("  pnpm lark:codex-check-two-workers -- --online-hub --online-feishu");

function parseArgs(argv) {
const parsed = {
    configDir: "",
    dryRun: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--force") {
      parsed.force = true;
      continue;
    }
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--config-dir") {
      parsed.configDir = readArgValue(argv, ++index, arg);
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
