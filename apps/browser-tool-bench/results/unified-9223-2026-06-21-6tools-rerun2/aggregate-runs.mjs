import fs from "node:fs";
import path from "node:path";

const repo = "/Users/bytedance/Code/garden-lab";
const resultRoot = path.join(
  repo,
  "apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools-rerun2",
);
const previousRoot = path.join(
  repo,
  "apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools",
);
const sessionDir = path.join(
  process.env.HOME,
  ".codex/sessions/2026/06/21",
);

const previous = [
  ["chrome", "rollout-2026-06-21T01-28-08-019ee613-5a27-7f60-8578-4ba2d87eef41.jsonl"],
  ["browser", "rollout-2026-06-21T01-39-53-019ee61e-1c3b-74b0-b21b-f419c98bcaf2.jsonl"],
  ["agent-browser", "rollout-2026-06-21T01-54-51-019ee62b-d122-7b51-afb0-4f5a73161326.jsonl"],
  ["bb-browser", "rollout-2026-06-21T02-14-36-019ee63d-e5e9-7e01-a9e1-94df8e6825d8.jsonl"],
  ["devtools-mcp", "rollout-2026-06-21T02-41-30-019ee656-83ee-7e03-800c-61acec1abbfd.jsonl"],
  ["playwright-cli", "rollout-2026-06-21T03-04-13-019ee66b-52a7-7350-9705-1639d271cf44.jsonl"],
];

const rerun2 = [
  ["chrome", "rollout-2026-06-21T10-20-55-019ee7fb-20f9-7f41-adc0-5f1af3292e38.jsonl"],
  ["browser", "rollout-2026-06-21T10-34-31-019ee807-9432-7632-a8ac-b34a1949eef3.jsonl"],
  ["agent-browser", "rollout-2026-06-21T10-46-50-019ee812-d9bf-79b3-9a47-5575617c54b7.jsonl"],
  ["bb-browser", "rollout-2026-06-21T11-07-12-019ee825-8076-7ac1-902f-bc9614761332.jsonl"],
  ["devtools-mcp", null],
  ["playwright-cli", null],
];

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizeTally(tally) {
  if (!tally) return null;
  if (tally.total) tally = tally.total;
  return {
    pass: tally.pass ?? 0,
    warn: tally.warn ?? tally.partial ?? 0,
    fail: tally.fail ?? 0,
    nr: tally.nr ?? 0,
    na: tally.na ?? 0,
  };
}

function fmtMin(value) {
  return value == null ? "" : `${value}m`;
}

function readRollout(fileName) {
  if (!fileName) return { file: null, exists: false };
  const file = path.join(sessionDir, fileName);
  if (!fs.existsSync(file)) return { file, exists: false };

  let firstTime = null;
  let lastTime = null;
  let model = null;
  let finalUsage = null;
  let compacted = false;
  let responseItems = 0;
  let toolCalls = 0;

  for (const line of fs.readFileSync(file, "utf8").trim().split("\n")) {
    if (!line) continue;
    const event = JSON.parse(line);
    if (event.timestamp) {
      firstTime ??= event.timestamp;
      lastTime = event.timestamp;
    }
    if (event.type === "turn_context") {
      model =
        event.payload?.model ??
        event.payload?.collaboration_mode?.settings?.model ??
        model;
    }
    if (event.type === "compacted") compacted = true;
    if (event.type === "response_item") {
      responseItems++;
      if (event.payload?.type === "function_call") toolCalls++;
    }
    if (event.payload?.info?.total_token_usage) {
      finalUsage = event.payload.info.total_token_usage;
    }
  }

  const elapsedMs =
    firstTime && lastTime
      ? Date.parse(lastTime) - Date.parse(firstTime)
      : null;

  return {
    file,
    exists: true,
    firstTime,
    lastTime,
    elapsedMs,
    elapsedMin: elapsedMs == null ? null : +(elapsedMs / 60000).toFixed(1),
    model,
    compacted,
    responseItems,
    toolCalls,
    tokenUsage: finalUsage,
  };
}

function readRun(root, tool, rolloutFile) {
  const summary = readJsonIfExists(path.join(root, tool, "summary.json"));
  return {
    tool,
    summaryExists: Boolean(summary),
    browserMode: summary?.browser_mode ?? summary?.browserMode ?? null,
    cdpProof: summary?.cdp_proof ?? summary?.proof_9223 ?? null,
    summaryElapsedMs: summary?.elapsed_ms ?? null,
    summaryElapsedMin:
      summary?.elapsed_ms == null ? null : +(summary.elapsed_ms / 60000).toFixed(1),
    tally: normalizeTally(summary?.tally),
    resultCount: Array.isArray(summary?.results) ? summary.results.length : 0,
    summaryTokens: summary?.tokens ?? null,
    summaryCostUsd: summary?.cost_usd ?? summary?.cost ?? null,
    rollout: readRollout(rolloutFile),
  };
}

function byTask(summary) {
  const out = new Map();
  for (const row of summary?.results ?? []) {
    out.set(row.task ?? row.id, normalizeVerdict(row.verdict));
  }
  return out;
}

function normalizeVerdict(verdict) {
  const value = String(verdict ?? "").trim();
  const lower = value.toLowerCase();
  if (lower === "pass" || value === "✅") return "✅";
  if (lower === "partial" || lower === "warn" || value === "⚠️") return "⚠️";
  if (lower === "fail" || value === "❌") return "❌";
  if (lower === "nr" || lower === "n-r" || value === "N-R") return "N-R";
  if (lower === "na" || lower === "n/a" || value === "N/A") return "N/A";
  return value;
}

const previousRuns = previous.map(([tool, file]) => readRun(previousRoot, tool, file));
const rerun2Runs = rerun2.map(([tool, file]) => readRun(resultRoot, tool, file));

const comparisons = [];
for (const current of rerun2Runs) {
  const old = previousRuns.find((r) => r.tool === current.tool);
  if (!old?.summaryExists || !current.summaryExists) continue;
  const oldSummary = readJsonIfExists(path.join(previousRoot, current.tool, "summary.json"));
  const newSummary = readJsonIfExists(path.join(resultRoot, current.tool, "summary.json"));
  const oldTasks = byTask(oldSummary);
  const newTasks = byTask(newSummary);
  const changed = [];
  for (const task of [...new Set([...oldTasks.keys(), ...newTasks.keys()])].sort()) {
    const before = oldTasks.get(task) ?? "missing";
    const after = newTasks.get(task) ?? "missing";
    if (before !== after) changed.push({ task, before, after });
  }
  comparisons.push({ tool: current.tool, changed });
}

const output = {
  generatedAt: new Date().toISOString(),
  note: "Dollar cost is not present in local rollout logs; token usage is recorded.",
  previousRuns,
  rerun2Runs,
  comparisons,
};

fs.writeFileSync(
  path.join(resultRoot, "aggregate-runs.json"),
  `${JSON.stringify(output, null, 2)}\n`,
);

const lines = [];
lines.push("# Rerun2 Aggregate Snapshot");
lines.push("");
lines.push("This is a machine-generated snapshot for the complete rerun2 set. All six tools have `summary.json` and `REPORT.md` files.");
lines.push("");
lines.push("## Previous Round");
lines.push("");
lines.push("| Tool | Mode | Tally | Summary elapsed | JSONL elapsed | Tokens | Cached input | Output |");
lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |");
for (const run of previousRuns) {
  const t = run.tally;
  const u = run.rollout.tokenUsage ?? {};
  lines.push(
    `| ${run.tool} | ${run.browserMode ?? ""} | ${t ? `${t.pass}✅/${t.warn}⚠️/${t.fail}❌/${t.nr} N-R/${t.na} N/A` : ""} | ${fmtMin(run.summaryElapsedMin)} | ${fmtMin(run.rollout.elapsedMin)} | ${u.total_tokens ?? ""} | ${u.cached_input_tokens ?? ""} | ${u.output_tokens ?? ""} |`,
  );
}
lines.push("");
lines.push("## Rerun2 Complete");
lines.push("");
lines.push("| Tool | Complete summary | Mode | Tally | Summary elapsed | JSONL elapsed | Tokens | Cached input | Output |");
lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |");
for (const run of rerun2Runs) {
  const t = run.tally;
  const u = run.rollout.tokenUsage ?? {};
  lines.push(
    `| ${run.tool} | ${run.summaryExists ? "yes" : "no"} | ${run.browserMode ?? ""} | ${t ? `${t.pass}✅/${t.warn}⚠️/${t.fail}❌/${t.nr} N-R/${t.na} N/A` : ""} | ${fmtMin(run.summaryElapsedMin)} | ${fmtMin(run.rollout.elapsedMin)} | ${u.total_tokens ?? ""} | ${u.cached_input_tokens ?? ""} | ${u.output_tokens ?? ""} |`,
  );
}
lines.push("");
lines.push("## Changed Verdicts");
for (const item of comparisons) {
  lines.push("");
  lines.push(`### ${item.tool}`);
  if (!item.changed.length) {
    lines.push("");
    lines.push("No changed verdicts.");
    continue;
  }
  lines.push("");
  lines.push("| Task | Previous | Rerun2 |");
  lines.push("| --- | --- | --- |");
  for (const row of item.changed) {
    lines.push(`| ${row.task} | ${row.before} | ${row.after} |`);
  }
}

fs.writeFileSync(path.join(resultRoot, "AGGREGATE-SNAPSHOT.md"), `${lines.join("\n")}\n`);

console.log(path.join(resultRoot, "aggregate-runs.json"));
console.log(path.join(resultRoot, "AGGREGATE-SNAPSHOT.md"));
