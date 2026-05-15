import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const TIMEZONE = "Asia/Shanghai";
const TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const OUTPUT_FILE = path.join(process.cwd(), "public", "stats", "token-usage.json");
const TOKENS_PER_MILLION = 1_000_000;
const PRESERVE_UPDATED_AT_IF_UNCHANGED = process.argv.includes(
  "--preserve-updated-at-if-unchanged"
);
const MODEL_PRICES = [
  { id: "gpt-5.5", input: 5, cachedInput: 0.5, output: 30 },
  { id: "gpt-5.4-mini", input: 0.75, cachedInput: 0.075, output: 4.5 },
  { id: "gpt-5.4", input: 2.5, cachedInput: 0.25, output: 15 },
  { id: "gpt-5.3-codex", input: 1.75, cachedInput: 0.175, output: 14 },
  { id: "gpt-5.2-codex", input: 1.75, cachedInput: 0.175, output: 14 },
  { id: "gpt-5.2", input: 1.75, cachedInput: 0.175, output: 14 },
  { id: "gpt-5.1-codex-mini", input: 0.25, cachedInput: 0.025, output: 2 },
  { id: "gpt-5.1-codex", input: 1.25, cachedInput: 0.125, output: 10 },
  { id: "gpt-5.1", input: 1.25, cachedInput: 0.125, output: 10 },
  { id: "gpt-5-codex", input: 1.25, cachedInput: 0.125, output: 10 },
  { id: "gpt-5", input: 1.25, cachedInput: 0.125, output: 10 },
];

function getShanghaiParts(date) {
  const shifted = new Date(date.getTime() + TIMEZONE_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(),
  };
}

function fromShanghaiStartOfDay({ year, month, date }) {
  return new Date(Date.UTC(year, month, date) - TIMEZONE_OFFSET_MS);
}

function getPeriodStarts(now) {
  const parts = getShanghaiParts(now);
  const today = fromShanghaiStartOfDay(parts);
  const daysSinceMonday = (parts.day + 6) % 7;
  const week = new Date(today.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  const month = fromShanghaiStartOfDay({ ...parts, date: 1 });

  return { today, week, month };
}

function createBucket(startAt) {
  return {
    startAt: startAt.toISOString(),
    totalTokens: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    events: 0,
    estimatedCostUsd: 0,
    estimatedCost: {
      inputUsd: 0,
      cachedInputUsd: 0,
      outputUsd: 0,
      unpricedTokens: 0,
    },
    models: {},
  };
}

function addUsage(bucket, usage, model) {
  const inputTokens = toNumber(usage.input_tokens);
  const cachedInputTokens = Math.min(inputTokens, toNumber(usage.cached_input_tokens));
  const outputTokens = toNumber(usage.output_tokens);
  const reasoningOutputTokens = toNumber(usage.reasoning_output_tokens);
  const explicitTotal = toNumber(usage.total_tokens);
  const totalTokens =
    explicitTotal ||
    inputTokens + cachedInputTokens + outputTokens + reasoningOutputTokens;

  bucket.totalTokens += totalTokens;
  bucket.inputTokens += inputTokens;
  bucket.cachedInputTokens += cachedInputTokens;
  bucket.outputTokens += outputTokens;
  bucket.reasoningOutputTokens += reasoningOutputTokens;
  bucket.events += 1;

  addCost(bucket, {
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
  });
}

function addCost(bucket, { model, inputTokens, cachedInputTokens, outputTokens }) {
  const price = getModelPrice(model);
  const modelKey = price?.id || model || "unknown";
  const modelBucket = bucket.models[modelKey] || {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    events: 0,
  };

  modelBucket.inputTokens += inputTokens;
  modelBucket.cachedInputTokens += cachedInputTokens;
  modelBucket.outputTokens += outputTokens;
  modelBucket.events += 1;

  if (!price) {
    const unpricedTokens = inputTokens + outputTokens;
    bucket.estimatedCost.unpricedTokens += unpricedTokens;
    bucket.models[modelKey] = modelBucket;
    return;
  }

  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const inputUsd = (uncachedInputTokens / TOKENS_PER_MILLION) * price.input;
  const cachedInputUsd = (cachedInputTokens / TOKENS_PER_MILLION) * price.cachedInput;
  const outputUsd = (outputTokens / TOKENS_PER_MILLION) * price.output;
  const estimatedCostUsd = inputUsd + cachedInputUsd + outputUsd;

  bucket.estimatedCostUsd += estimatedCostUsd;
  bucket.estimatedCost.inputUsd += inputUsd;
  bucket.estimatedCost.cachedInputUsd += cachedInputUsd;
  bucket.estimatedCost.outputUsd += outputUsd;
  modelBucket.estimatedCostUsd += estimatedCostUsd;
  bucket.models[modelKey] = modelBucket;
}

function getModelPrice(model) {
  if (!model) {
    return undefined;
  }

  const normalizedModel = model.toLowerCase();

  return MODEL_PRICES.find((price) => normalizedModel.startsWith(price.id));
}

function toNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

async function collectJsonlFiles(root) {
  const filesByName = new Map();
  const roots = [
    path.join(root, "sessions"),
    path.join(root, "archived_sessions"),
  ];

  for (const currentRoot of roots) {
    await walk(currentRoot, (file) => {
      if (file.endsWith(".jsonl")) {
        filesByName.set(path.basename(file), file);
      }
    });
  }

  return [...filesByName.values()].sort();
}

async function walk(dir, onFile) {
  let entries;

  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, onFile);
        return;
      }

      if (entry.isFile()) {
        onFile(fullPath);
      }
    })
  );
}

async function readUsageEvents(file, onEvent) {
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
  let currentModel = "unknown";

  for await (const line of lines) {
    if (!line.includes("\"token_count\"") && !line.includes("\"model\"")) {
      continue;
    }

    let entry;

    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (
      (entry?.type === "turn_context" || entry?.type === "session_meta") &&
      typeof entry?.payload?.model === "string"
    ) {
      currentModel = entry.payload.model;
    }

    const usage = entry?.payload?.info?.last_token_usage;
    const timestamp = Date.parse(entry?.timestamp);

    if (
      entry?.type !== "event_msg" ||
      entry?.payload?.type !== "token_count" ||
      !Number.isFinite(timestamp) ||
      !usage
    ) {
      continue;
    }

    onEvent(new Date(timestamp), usage, currentModel);
  }
}

function finalizeBucket(bucket) {
  bucket.estimatedCostUsd = roundUsd(bucket.estimatedCostUsd);
  bucket.estimatedCost.inputUsd = roundUsd(bucket.estimatedCost.inputUsd);
  bucket.estimatedCost.cachedInputUsd = roundUsd(bucket.estimatedCost.cachedInputUsd);
  bucket.estimatedCost.outputUsd = roundUsd(bucket.estimatedCost.outputUsd);

  for (const model of Object.values(bucket.models)) {
    model.estimatedCostUsd = roundUsd(model.estimatedCostUsd);
  }

  bucket.models = Object.fromEntries(
    Object.entries(bucket.models).sort((a, b) => b[1].estimatedCostUsd - a[1].estimatedCostUsd)
  );

  return bucket;
}

function roundUsd(value) {
  return Number(value.toFixed(4));
}

async function readExistingSnapshot() {
  try {
    return JSON.parse(await fs.promises.readFile(OUTPUT_FILE, "utf8"));
  } catch {
    return undefined;
  }
}

function withoutUpdatedAt(snapshot) {
  return JSON.stringify(snapshot, (key, value) =>
    key === "updatedAt" ? undefined : value
  );
}

async function main() {
  const now = new Date();
  const starts = getPeriodStarts(now);
  const periods = {
    today: createBucket(starts.today),
    week: createBucket(starts.week),
    month: createBucket(starts.month),
  };
  const files = await collectJsonlFiles(CODEX_HOME);

  if (files.length === 0) {
    if (fs.existsSync(OUTPUT_FILE)) {
      console.log(`No Codex session logs found under ${CODEX_HOME}; kept existing token usage file.`);
      return;
    }

    if (process.env.CI) {
      console.log(`No Codex session logs found under ${CODEX_HOME}; skipped token usage sync in CI.`);
      return;
    }
  }

  const oldestStart = starts.month.getTime();
  const nowWithSkew = now.getTime() + 5 * 60 * 1000;

  for (const file of files) {
    await readUsageEvents(file, (timestamp, usage, model) => {
      const time = timestamp.getTime();

      if (time < oldestStart || time > nowWithSkew) {
        return;
      }

      if (time >= starts.today.getTime()) {
        addUsage(periods.today, usage, model);
      }

      if (time >= starts.week.getTime()) {
        addUsage(periods.week, usage, model);
      }

      addUsage(periods.month, usage, model);
    });
  }

  for (const key of Object.keys(periods)) {
    periods[key] = finalizeBucket(periods[key]);
  }

  const snapshot = {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    timezone: TIMEZONE,
    source: "local-codex-jsonl",
    filesScanned: files.length,
    pricing: {
      currency: "USD",
      basis: "estimated-api-equivalent",
      note: "Estimated from local Codex token logs and public model rates. This is not an invoice.",
      pricesPerMillionTokens: Object.fromEntries(
        MODEL_PRICES.map((price) => [
          price.id,
          {
            input: price.input,
            cachedInput: price.cachedInput,
            output: price.output,
          },
        ])
      ),
    },
    periods,
  };

  if (PRESERVE_UPDATED_AT_IF_UNCHANGED) {
    const existingSnapshot = await readExistingSnapshot();

    if (
      existingSnapshot &&
      withoutUpdatedAt(existingSnapshot) === withoutUpdatedAt(snapshot)
    ) {
      console.log(
        `No token usage changes since ${existingSnapshot.updatedAt}; kept existing token usage file.`
      );
      return;
    }
  }

  await fs.promises.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.promises.writeFile(OUTPUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`);

  console.log(
    `Synced token usage: today=${periods.today.totalTokens}, week=${periods.week.totalTokens}, month=${periods.month.totalTokens}, monthCost=$${periods.month.estimatedCostUsd}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
