import fs from "node:fs";
import path from "node:path";

import {
  EMPTY_TOKEN_USAGE_SNAPSHOT,
  normalizeTokenUsageSnapshot,
  type TokenUsageSnapshot,
} from "@garden-lab/token-board-core/snapshot";

export {
  buildTokenUsageSnapshotFromEvents,
  EMPTY_TOKEN_USAGE_SNAPSHOT,
  normalizeTokenUsageSnapshot,
  type TokenUsagePeriod,
  type TokenUsagePeriodKey,
  type TokenUsageSnapshot,
} from "@garden-lab/token-board-core/snapshot";

export function getTokenUsageSnapshot(): TokenUsageSnapshot {
  const filePath = path.join(process.cwd(), "public", "stats", "token-usage.json");

  try {
    const content = fs.readFileSync(filePath, "utf8");
    return normalizeTokenUsageSnapshot(JSON.parse(content));
  } catch {
    return EMPTY_TOKEN_USAGE_SNAPSHOT;
  }
}
