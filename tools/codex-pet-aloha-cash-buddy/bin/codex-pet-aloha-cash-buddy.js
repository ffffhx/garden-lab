#!/usr/bin/env node

import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PET_ID = "aloha-cash-buddy";
const OPTIONAL_FILES = ["preview.png"];
const REQUIRED_FILES = ["pet.json", "spritesheet.webp"];

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const sourceDir = path.join(packageRoot, "pets", PET_ID);
  const manifest = await readManifest(sourceDir);
  const codexHome = path.resolve(
    options.codexHome || process.env.CODEX_HOME || path.join(homedir(), ".codex"),
  );
  const installDir = path.join(codexHome, "pets", manifest.id);

  if (options.dryRun) {
    console.log(`Would install ${manifest.displayName} (${manifest.id})`);
    console.log(installDir);
    return;
  }

  await mkdir(installDir, { recursive: true });
  for (const fileName of REQUIRED_FILES) {
    await copyFile(path.join(sourceDir, fileName), path.join(installDir, fileName));
  }
  for (const fileName of OPTIONAL_FILES) {
    if (await exists(path.join(sourceDir, fileName))) {
      await copyFile(path.join(sourceDir, fileName), path.join(installDir, fileName));
    }
  }

  console.log(`Installed ${manifest.displayName} (${manifest.id})`);
  console.log(installDir);
}

function parseArgs(args) {
  const options = {
    codexHome: "",
    dryRun: false,
    help: false,
  };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--codex-home") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--codex-home requires a directory");
      }
      options.codexHome = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    }
    positionals.push(arg);
  }

  const [command, petId, ...extra] = normalizePositionals(positionals);
  if (extra.length > 0) {
    throw new Error("too many arguments");
  }
  if (command && !["add", "install"].includes(command)) {
    throw new Error(`unknown command: ${command}`);
  }
  if (petId && petId !== PET_ID) {
    throw new Error(`this package only installs ${PET_ID}`);
  }

  return options;
}

function normalizePositionals(positionals) {
  if (positionals.length === 0) {
    return [];
  }
  if (positionals[0] === PET_ID) {
    return ["add", positionals[0], ...positionals.slice(1)];
  }
  return positionals;
}

async function readManifest(sourceDir) {
  const manifestPath = path.join(sourceDir, "pet.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.id !== PET_ID) {
    throw new Error(`pet.json id must be ${PET_ID}`);
  }
  if (manifest.spritesheetPath !== "spritesheet.webp") {
    throw new Error("pet.json spritesheetPath must be spritesheet.webp");
  }
  for (const fileName of REQUIRED_FILES) {
    if (!(await exists(path.join(sourceDir, fileName)))) {
      throw new Error(`missing required pet file: ${fileName}`);
    }
  }
  return manifest;
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(`Usage:
  codex-pet-aloha-cash-buddy
  codex-pet-aloha-cash-buddy add aloha-cash-buddy

Options:
  --codex-home <dir>  Install under a custom Codex home
  --dry-run           Print the target install path
  -h, --help          Show this help`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
