import fs from "node:fs";
import path from "node:path";

export type TokenUsagePeriodKey = "today" | "week" | "month";

export type TokenUsagePeriod = {
  startAt: string;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  events: number;
  estimatedCostUsd: number;
  estimatedCost: {
    inputUsd: number;
    cachedInputUsd: number;
    outputUsd: number;
    unpricedTokens: number;
  };
  models: Record<
    string,
    {
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      events: number;
    }
  >;
};

export type TokenUsageSnapshot = {
  schemaVersion: number;
  updatedAt: string;
  timezone: string;
  source: string;
  filesScanned: number;
  pricing?: {
    currency: string;
    basis: string;
    note: string;
    pricesPerMillionTokens: Record<
      string,
      {
        input: number;
        cachedInput: number;
        output: number;
      }
    >;
  };
  periods: Record<TokenUsagePeriodKey, TokenUsagePeriod>;
};

const EMPTY_PERIOD: TokenUsagePeriod = {
  startAt: new Date(0).toISOString(),
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

export const EMPTY_TOKEN_USAGE_SNAPSHOT: TokenUsageSnapshot = {
  schemaVersion: 1,
  updatedAt: new Date(0).toISOString(),
  timezone: "Asia/Shanghai",
  source: "empty",
  filesScanned: 0,
  periods: {
    today: EMPTY_PERIOD,
    week: EMPTY_PERIOD,
    month: EMPTY_PERIOD,
  },
};

export function getTokenUsageSnapshot(): TokenUsageSnapshot {
  const filePath = path.join(process.cwd(), "public", "stats", "token-usage.json");

  try {
    const content = fs.readFileSync(filePath, "utf8");
    return normalizeTokenUsageSnapshot(JSON.parse(content));
  } catch {
    return EMPTY_TOKEN_USAGE_SNAPSHOT;
  }
}

export function normalizeTokenUsageSnapshot(value: unknown): TokenUsageSnapshot {
  if (!value || typeof value !== "object") {
    return EMPTY_TOKEN_USAGE_SNAPSHOT;
  }

  const snapshot = value as Partial<TokenUsageSnapshot>;
  const schemaVersion = toFiniteNumber(snapshot.schemaVersion);

  return {
    schemaVersion: schemaVersion > 0 ? schemaVersion : 1,
    updatedAt: typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : new Date(0).toISOString(),
    timezone: typeof snapshot.timezone === "string" ? snapshot.timezone : "Asia/Shanghai",
    source: typeof snapshot.source === "string" ? snapshot.source : "unknown",
    filesScanned: toFiniteNumber(snapshot.filesScanned),
    pricing: normalizePricing(snapshot.pricing),
    periods: {
      today: normalizePeriod(snapshot.periods?.today),
      week: normalizePeriod(snapshot.periods?.week),
      month: normalizePeriod(snapshot.periods?.month),
    },
  };
}

function normalizePeriod(value: unknown): TokenUsagePeriod {
  if (!value || typeof value !== "object") {
    return EMPTY_PERIOD;
  }

  const period = value as Partial<TokenUsagePeriod>;

  return {
    startAt: typeof period.startAt === "string" ? period.startAt : new Date(0).toISOString(),
    totalTokens: toFiniteNumber(period.totalTokens),
    inputTokens: toFiniteNumber(period.inputTokens),
    cachedInputTokens: toFiniteNumber(period.cachedInputTokens),
    outputTokens: toFiniteNumber(period.outputTokens),
    reasoningOutputTokens: toFiniteNumber(period.reasoningOutputTokens),
    events: toFiniteNumber(period.events),
    estimatedCostUsd: toFiniteNumber(period.estimatedCostUsd),
    estimatedCost: normalizeEstimatedCost(period.estimatedCost),
    models: normalizeModels(period.models),
  };
}

function normalizeEstimatedCost(value: unknown): TokenUsagePeriod["estimatedCost"] {
  if (!value || typeof value !== "object") {
    return EMPTY_PERIOD.estimatedCost;
  }

  const cost = value as Partial<TokenUsagePeriod["estimatedCost"]>;

  return {
    inputUsd: toFiniteNumber(cost.inputUsd),
    cachedInputUsd: toFiniteNumber(cost.cachedInputUsd),
    outputUsd: toFiniteNumber(cost.outputUsd),
    unpricedTokens: toFiniteNumber(cost.unpricedTokens),
  };
}

function normalizeModels(value: unknown): TokenUsagePeriod["models"] {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([model, modelValue]) => {
      if (!modelValue || typeof modelValue !== "object") {
        return [
          model,
          {
            inputTokens: 0,
            cachedInputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
            events: 0,
          },
        ];
      }

      const modelUsage = modelValue as Partial<TokenUsagePeriod["models"][string]>;

      return [
        model,
        {
          inputTokens: toFiniteNumber(modelUsage.inputTokens),
          cachedInputTokens: toFiniteNumber(modelUsage.cachedInputTokens),
          outputTokens: toFiniteNumber(modelUsage.outputTokens),
          estimatedCostUsd: toFiniteNumber(modelUsage.estimatedCostUsd),
          events: toFiniteNumber(modelUsage.events),
        },
      ];
    })
  );
}

function normalizePricing(value: unknown): TokenUsageSnapshot["pricing"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const pricing = value as Partial<NonNullable<TokenUsageSnapshot["pricing"]>>;

  return {
    currency: typeof pricing.currency === "string" ? pricing.currency : "USD",
    basis: typeof pricing.basis === "string" ? pricing.basis : "estimated-api-equivalent",
    note: typeof pricing.note === "string" ? pricing.note : "",
    pricesPerMillionTokens:
      pricing.pricesPerMillionTokens && typeof pricing.pricesPerMillionTokens === "object"
        ? pricing.pricesPerMillionTokens
        : {},
  };
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
