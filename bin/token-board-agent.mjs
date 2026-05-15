#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = require.resolve("tsx/cli");
const agentScript = path.join(rootDir, "scripts", "token-usage-agent.ts");
const args = process.argv.slice(2);
const commandArgs = args.length ? args : ["sync"];

const child = spawn(process.execPath, [tsxCli, agentScript, ...commandArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
    TOKEN_BOARD_API_URL: process.env.TOKEN_BOARD_API_URL || "https://8-218-149-148.anyip.dev/token-board",
    TOKEN_BOARD_LEADERBOARD_URL:
      process.env.TOKEN_BOARD_LEADERBOARD_URL || "https://ffffhx.github.io/blog/token-leaderboard/",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
