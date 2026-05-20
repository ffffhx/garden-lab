export const TOKEN_LEADERBOARD_STORAGE_KEY = "friend-token-leaderboard:v1";

export type TokenBoardRange = "1D" | "7D" | "30D" | "90D";

export type TokenBoardMetric = "tokens" | "cost" | "sessions" | "messages";

export type TokenUsageEvent = {
  id: string;
  userId: string;
  displayName: string;
  team?: string;
  source: string;
  model: string;
  project?: string;
  tool?: string;
  timestamp: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  costUsd?: number;
  messages?: number;
  sessionId?: string;
};

export type TokenLeaderboardUser = {
  rank: number;
  userId: string;
  displayName: string;
  team: string;
  tokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  costUsd: number;
  sessions: number;
  messages: number;
  records: number;
  activeDays: number;
  lastReportedAt?: string;
  topModel: string;
  topTool: string;
  share: number;
  deltaTokens: number | null;
};

export type TokenLeaderboardSummary = {
  range: TokenBoardRange;
  startAt: string;
  endAt: string;
  totalTokens: number;
  totalCostUsd: number;
  totalSessions: number;
  totalMessages: number;
  activeUsers: number;
  topModel: string;
  topTool: string;
  daily: Array<{ date: string; tokens: number }>;
  models: Array<{ name: string; tokens: number; costUsd: number; share: number }>;
  tools: Array<{ name: string; tokens: number; sessions: number; share: number }>;
  users: TokenLeaderboardUser[];
};

export type TokenUsageProjectBreakdown = {
  name: string;
  tokens: number;
  costUsd: number;
  sessions: number;
  activeDays: number;
  models: number;
  share: number;
  lastReportedAt: string;
};

export type TokenUsageActivityCell = {
  weekday: number;
  hour: number;
  tokens: number;
  sessions: number;
  messages: number;
};

export type TokenAccountUsageProfile = {
  range: TokenBoardRange;
  startAt: string;
  endAt: string;
  user: TokenLeaderboardUser | null;
  rank: number | null;
  previousRank: number | null;
  rankDelta: number | null;
  totalUsers: number;
  percentile: number | null;
  records: number;
  daily: TokenLeaderboardSummary["daily"];
  models: TokenLeaderboardSummary["models"];
  tools: TokenLeaderboardSummary["tools"];
  projects: TokenUsageProjectBreakdown[];
  heatmap: TokenUsageActivityCell[];
  topHour: string;
  topWeekday: string;
};

const RANGE_DAYS: Record<TokenBoardRange, number> = {
  "1D": 1,
  "7D": 7,
  "30D": 30,
  "90D": 90,
};

const MODEL_PRICING = [
  { match: /gpt-5\.5/i, input: 5, cachedInput: 0.5, output: 30 },
  { match: /gpt-5\.4-mini/i, input: 0.75, cachedInput: 0.075, output: 4.5 },
  { match: /gpt-5\.4/i, input: 2.5, cachedInput: 0.25, output: 15 },
  { match: /gpt-5\.3|gpt-5\.2|gpt-5/i, input: 1.25, cachedInput: 0.125, output: 10 },
  { match: /claude.*opus/i, input: 15, cachedInput: 1.5, output: 75 },
  { match: /claude.*sonnet/i, input: 3, cachedInput: 0.3, output: 15 },
  { match: /gemini/i, input: 1.25, cachedInput: 0.125, output: 10 },
  { match: /deepseek/i, input: 0.55, cachedInput: 0.055, output: 2.19 },
];

export function buildTokenLeaderboard(
  entries: TokenUsageEvent[],
  {
    range,
    metric,
    now = new Date(),
  }: {
    range: TokenBoardRange;
    metric: TokenBoardMetric;
    now?: Date;
  }
): TokenLeaderboardSummary {
  const end = Number.isFinite(now.getTime()) ? now : new Date();
  const rangeMs = RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  const start = new Date(end.getTime() - rangeMs);
  const previousStart = new Date(start.getTime() - rangeMs);
  const normalizedEntries = dedupeTokenEvents(entries.map(normalizeTokenUsageEvent));
  const currentEntries = normalizedEntries.filter((entry) => {
    const timestamp = new Date(entry.timestamp).getTime();
    return timestamp >= start.getTime() && timestamp <= end.getTime();
  });
  const previousEntries = normalizedEntries.filter((entry) => {
    const timestamp = new Date(entry.timestamp).getTime();
    return timestamp >= previousStart.getTime() && timestamp < start.getTime();
  });
  const previousTokensByUser = sumTokensByUser(previousEntries);
  const users = rankUsers(aggregateUsers(currentEntries, previousTokensByUser), metric);
  const totalTokens = users.reduce((sum, user) => sum + user.tokens, 0);
  const totalCostUsd = users.reduce((sum, user) => sum + user.costUsd, 0);
  const totalSessions = users.reduce((sum, user) => sum + user.sessions, 0);
  const totalMessages = users.reduce((sum, user) => sum + user.messages, 0);
  const models = aggregateNamedUsage(currentEntries, "model");
  const tools = aggregateNamedUsage(currentEntries, "tool");

  return {
    range,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    totalTokens,
    totalCostUsd,
    totalSessions,
    totalMessages,
    activeUsers: users.length,
    topModel: models[0]?.name ?? "unknown",
    topTool: tools[0]?.name ?? "unknown",
    daily: buildDailySeries(currentEntries, start, end),
    models,
    tools,
    users: users.map((user) => ({
      ...user,
      share: totalTokens > 0 ? user.tokens / totalTokens : 0,
    })),
  };
}

export function buildTokenAccountUsageProfile(
  entries: TokenUsageEvent[],
  {
    userId,
    range,
    now = new Date(),
  }: {
    userId: string;
    range: TokenBoardRange;
    now?: Date;
  }
): TokenAccountUsageProfile {
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date();
  const normalizedEntries = dedupeTokenEvents(entries.map(normalizeTokenUsageEvent));
  const globalSummary = buildTokenLeaderboard(normalizedEntries, { range, metric: "tokens", now: safeNow });
  const start = new Date(globalSummary.startAt);
  const end = new Date(globalSummary.endAt);
  const accountEntries = normalizedEntries.filter((entry) => {
    const timestamp = new Date(entry.timestamp).getTime();
    return entry.userId === userId && timestamp >= start.getTime() && timestamp <= end.getTime();
  });
  const accountSummary = buildTokenLeaderboard(accountEntries, { range, metric: "tokens", now: safeNow });
  const rankedUser = globalSummary.users.find((user) => user.userId === userId) ?? null;
  const accountUser = accountSummary.users[0]
    ? {
        ...accountSummary.users[0],
        rank: rankedUser?.rank ?? accountSummary.users[0].rank,
        share: rankedUser?.share ?? accountSummary.users[0].share,
        deltaTokens: rankedUser?.deltaTokens ?? accountSummary.users[0].deltaTokens,
      }
    : null;
  const previousSummary = buildTokenLeaderboard(normalizedEntries, { range, metric: "tokens", now: start });
  const previousRank = previousSummary.users.find((user) => user.userId === userId)?.rank ?? null;
  const rank = rankedUser?.rank ?? null;
  const totalUsers = globalSummary.users.length;

  return {
    range,
    startAt: globalSummary.startAt,
    endAt: globalSummary.endAt,
    user: accountUser,
    rank,
    previousRank,
    rankDelta: rank !== null && previousRank !== null ? previousRank - rank : null,
    totalUsers,
    percentile: rank !== null && totalUsers > 0 ? (totalUsers - rank) / totalUsers : null,
    records: accountEntries.length,
    daily: accountSummary.daily,
    models: accountSummary.models,
    tools: accountSummary.tools,
    projects: aggregateProjectUsage(accountEntries),
    heatmap: buildActivityHeatmap(accountEntries),
    topHour: topActivityHour(accountEntries),
    topWeekday: topActivityWeekday(accountEntries),
  };
}

export function parseTokenUsageImport(input: string): {
  entries: TokenUsageEvent[];
  errors: string[];
} {
  const trimmed = input.trim();

  if (!trimmed) {
    return { entries: [], errors: ["没有可导入的数据"] };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonImport(trimmed);
  }

  return parseCsvImport(trimmed);
}

export function dedupeTokenEvents(entries: TokenUsageEvent[]) {
  const byId = new Map<string, TokenUsageEvent>();

  for (const entry of entries) {
    byId.set(entry.id, normalizeTokenUsageEvent(entry));
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function normalizeTokenUsageEvent(value: Partial<TokenUsageEvent>): TokenUsageEvent {
  const inputTokens = toFiniteNumber(value.inputTokens);
  const cachedInputTokens = toFiniteNumber(value.cachedInputTokens);
  const outputTokens = toFiniteNumber(value.outputTokens);
  const reasoningOutputTokens = toFiniteNumber(value.reasoningOutputTokens);
  const computedTokens = inputTokens + cachedInputTokens + outputTokens + reasoningOutputTokens;
  const explicitTotalTokens = toFiniteNumber(value.totalTokens);
  const totalTokens = explicitTotalTokens > 0 ? explicitTotalTokens : computedTokens;
  const userId = normalizeText(value.userId) || normalizeText(value.displayName) || "unknown";
  const timestamp = normalizeDate(value.timestamp);
  const model = normalizeText(value.model) || "unknown";
  const source = normalizeText(value.source) || "manual";
  const sessionId = normalizeText(value.sessionId);
  const id =
    normalizeText(value.id) ||
    [
      userId,
      timestamp,
      source,
      model,
      normalizeText(value.project),
      sessionId,
      totalTokens,
    ].join(":");

  return {
    id,
    userId,
    displayName: normalizeText(value.displayName) || userId,
    team: normalizeText(value.team) || "Friends",
    source,
    model,
    project: normalizeText(value.project),
    tool: normalizeText(value.tool) || source,
    timestamp,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
    costUsd:
      typeof value.costUsd === "number" && Number.isFinite(value.costUsd)
        ? value.costUsd
        : estimateCostUsd({
            model,
            inputTokens,
            cachedInputTokens,
            outputTokens,
          }),
    messages: toFiniteNumber(value.messages),
    sessionId,
  };
}

export function getTokenConsumptionTokens(
  entry: Pick<TokenUsageEvent, "inputTokens" | "cachedInputTokens" | "outputTokens" | "totalTokens">
) {
  const inputContextTokens = toFiniteNumber(entry.inputTokens);
  const outputTokens = toFiniteNumber(entry.outputTokens);
  const computedTokens = inputContextTokens + outputTokens;

  return computedTokens > 0 ? computedTokens : toFiniteNumber(entry.totalTokens);
}

export function createDemoTokenEntries(now = new Date()): TokenUsageEvent[] {
  const users = [
    { userId: "feng", displayName: "Feng", team: "Frontend Lab", weight: 1.05 },
    { userId: "ava", displayName: "Ava", team: "Solo Builders", weight: 0.84 },
    { userId: "kai", displayName: "Kai", team: "Infra Notes", weight: 0.72 },
    { userId: "mira", displayName: "Mira", team: "Design Systems", weight: 0.58 },
    { userId: "leo", displayName: "Leo", team: "Weekend Apps", weight: 0.49 },
    { userId: "nora", displayName: "Nora", team: "Research Desk", weight: 0.38 },
  ];
  const models = ["gpt-5.5", "claude-sonnet-4-6", "gpt-5.4-mini", "gpt-5.3-codex"];
  const tools = ["Codex CLI", "Claude Code", "Cursor", "Gemini CLI"];
  const projects = ["garden-lab", "token-board", "notes", "side-project"];
  const today = startOfUtcDay(now);
  const entries: TokenUsageEvent[] = [];

  users.forEach((user, userIndex) => {
    for (let day = 0; day < 42; day += 1) {
      if ((day + userIndex) % 5 === 4) {
        continue;
      }

      const intensity = user.weight * (1 + ((day + userIndex) % 4) * 0.16);
      const totalTokens = Math.round((3_200_000 + userIndex * 510_000 + day * 47_000) * intensity);
      const outputTokens = Math.round(totalTokens * (0.075 + (userIndex % 3) * 0.008));
      const cachedInputTokens = Math.round(totalTokens * (0.36 + (day % 3) * 0.05));
      const reasoningOutputTokens = Math.round(outputTokens * (0.18 + (day % 2) * 0.04));
      const inputTokens = Math.max(0, totalTokens - outputTokens - cachedInputTokens);
      const timestamp = new Date(
        today.getTime() - day * 24 * 60 * 60 * 1000 + (9 + ((userIndex + day) % 10)) * 60 * 60 * 1000
      );

      entries.push(
        normalizeTokenUsageEvent({
          id: `demo:${user.userId}:${day}`,
          userId: user.userId,
          displayName: user.displayName,
          team: user.team,
          source: tools[(userIndex + day) % tools.length].toLowerCase().replace(/\s+/g, "-"),
          tool: tools[(userIndex + day) % tools.length],
          model: models[(userIndex + day) % models.length],
          project: projects[(userIndex + day) % projects.length],
          timestamp: timestamp.toISOString(),
          inputTokens,
          cachedInputTokens,
          outputTokens,
          reasoningOutputTokens,
          totalTokens,
          messages: 24 + ((day + userIndex) % 9) * 7,
          sessionId: `demo-session-${user.userId}-${day}`,
        })
      );
    }
  });

  return entries;
}

function parseJsonImport(input: string) {
  try {
    const parsed = JSON.parse(input) as unknown;
    const records = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { entries?: unknown }).entries)
        ? (parsed as { entries: unknown[] }).entries
        : [];

    if (!records.length) {
      return { entries: [], errors: ["JSON 需要是数组，或包含 entries 数组"] };
    }

    return recordsToEvents(records);
  } catch (error) {
    return { entries: [], errors: [error instanceof Error ? error.message : "JSON 解析失败"] };
  }
}

function parseCsvImport(input: string) {
  const rows = parseCsvRows(input);
  const [headers, ...bodyRows] = rows;

  if (!headers?.length || !bodyRows.length) {
    return { entries: [], errors: ["CSV 需要表头和至少一行数据"] };
  }

  const records = bodyRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [normalizeHeader(header), row[index] ?? ""]))
  );

  return recordsToEvents(records);
}

function recordsToEvents(records: unknown[]) {
  const errors: string[] = [];
  const entries = records.flatMap((record, index) => {
    if (!record || typeof record !== "object") {
      errors.push(`第 ${index + 1} 行不是对象`);
      return [];
    }

    const value = record as Record<string, unknown>;
    const timestamp = normalizeDate(readField(value, ["timestamp", "date", "bucketStart", "createdAt"]));
    const userId = normalizeText(readField(value, ["userId", "user", "username", "name"]));

    if (!userId) {
      errors.push(`第 ${index + 1} 行缺少 userId/user`);
      return [];
    }

    const rawCostUsd = readField(value, ["costUsd", "cost", "estimatedCostUsd"]);

    return [
      normalizeTokenUsageEvent({
        id: normalizeText(readField(value, ["id", "eventId"])),
        userId,
        displayName: normalizeText(readField(value, ["displayName", "name", "username", "user"])) || userId,
        team: normalizeText(readField(value, ["team", "department", "group"])),
        source: normalizeText(readField(value, ["source", "tool"])),
        tool: normalizeText(readField(value, ["tool", "source"])),
        model: normalizeText(readField(value, ["model"])),
        project: normalizeText(readField(value, ["project", "repo", "workspace"])),
        timestamp,
        inputTokens: toFiniteNumber(readField(value, ["inputTokens", "input_tokens", "promptTokens", "prompt_tokens"])),
        cachedInputTokens: toFiniteNumber(readField(value, ["cachedInputTokens", "cached_input_tokens", "cachedTokens"])),
        outputTokens: toFiniteNumber(readField(value, ["outputTokens", "output_tokens", "completionTokens", "completion_tokens"])),
        reasoningOutputTokens: toFiniteNumber(readField(value, ["reasoningOutputTokens", "reasoning_output_tokens", "reasoningTokens"])),
        totalTokens: toFiniteNumber(readField(value, ["totalTokens", "total_tokens", "tokens"])),
        costUsd: rawCostUsd === undefined || rawCostUsd === "" ? undefined : toFiniteNumber(rawCostUsd),
        messages: toFiniteNumber(readField(value, ["messages", "messageCount"])),
        sessionId: normalizeText(readField(value, ["sessionId", "session", "conversationId"])),
      }),
    ];
  });

  return { entries: dedupeTokenEvents(entries), errors };
}

function aggregateUsers(
  entries: TokenUsageEvent[],
  previousTokensByUser: Map<string, number>
): TokenLeaderboardUser[] {
  const users = new Map<
    string,
    Omit<TokenLeaderboardUser, "rank" | "share" | "deltaTokens" | "topModel" | "topTool"> & {
      modelTokens: Map<string, number>;
      toolTokens: Map<string, number>;
      days: Set<string>;
      sessionIds: Set<string>;
      lastReportedAt: string;
    }
  >();

  for (const entry of entries) {
    const tokens = getTokenConsumptionTokens(entry);
    const user =
      users.get(entry.userId) ??
      {
        userId: entry.userId,
        displayName: entry.displayName,
        team: entry.team || "Friends",
        tokens: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
        costUsd: 0,
        sessions: 0,
        messages: 0,
        records: 0,
        activeDays: 0,
        modelTokens: new Map<string, number>(),
        toolTokens: new Map<string, number>(),
        days: new Set<string>(),
        sessionIds: new Set<string>(),
        lastReportedAt: entry.timestamp,
      };

    user.displayName = entry.displayName || user.displayName;
    user.team = entry.team || user.team;
    user.tokens += tokens;
    user.inputTokens += entry.inputTokens;
    user.cachedInputTokens += entry.cachedInputTokens;
    user.outputTokens += entry.outputTokens;
    user.reasoningOutputTokens += entry.reasoningOutputTokens;
    user.costUsd += entry.costUsd ?? 0;
    user.messages += entry.messages ?? 0;
    user.records += 1;
    user.days.add(toDateKey(entry.timestamp));
    user.sessionIds.add(entry.sessionId || entry.id);
    if (new Date(entry.timestamp).getTime() > new Date(user.lastReportedAt).getTime()) {
      user.lastReportedAt = entry.timestamp;
    }
    addMapValue(user.modelTokens, entry.model, tokens);
    addMapValue(user.toolTokens, entry.tool || entry.source, tokens);
    users.set(entry.userId, user);
  }

  return [...users.values()].map((user) => {
    const previousTokens = previousTokensByUser.get(user.userId) ?? 0;

    return {
      rank: 0,
      userId: user.userId,
      displayName: user.displayName,
      team: user.team,
      tokens: user.tokens,
      inputTokens: user.inputTokens,
      cachedInputTokens: user.cachedInputTokens,
      outputTokens: user.outputTokens,
      reasoningOutputTokens: user.reasoningOutputTokens,
      costUsd: user.costUsd,
      sessions: user.sessionIds.size,
      messages: user.messages,
      records: user.records,
      activeDays: user.days.size,
      lastReportedAt: user.lastReportedAt,
      topModel: topMapEntry(user.modelTokens),
      topTool: topMapEntry(user.toolTokens),
      share: 0,
      deltaTokens: previousTokens > 0 ? (user.tokens - previousTokens) / previousTokens : null,
    };
  });
}

function rankUsers(users: TokenLeaderboardUser[], metric: TokenBoardMetric) {
  return users
    .sort((a, b) => metricValue(b, metric) - metricValue(a, metric) || a.displayName.localeCompare(b.displayName))
    .map((user, index) => ({ ...user, rank: index + 1 }));
}

function metricValue(user: TokenLeaderboardUser, metric: TokenBoardMetric) {
  if (metric === "cost") {
    return user.costUsd;
  }

  if (metric === "sessions") {
    return user.sessions;
  }

  if (metric === "messages") {
    return user.messages;
  }

  return user.tokens;
}

function aggregateNamedUsage(entries: TokenUsageEvent[], key: "model" | "tool") {
  const totalTokens = entries.reduce((sum, entry) => sum + getTokenConsumptionTokens(entry), 0);
  const usage = new Map<string, { tokens: number; costUsd: number; sessions: Set<string> }>();

  for (const entry of entries) {
    const tokens = getTokenConsumptionTokens(entry);
    const name = key === "model" ? entry.model : entry.tool || entry.source;
    const current = usage.get(name) ?? { tokens: 0, costUsd: 0, sessions: new Set<string>() };
    current.tokens += tokens;
    current.costUsd += entry.costUsd ?? 0;
    current.sessions.add(entry.sessionId || entry.id);
    usage.set(name, current);
  }

  return [...usage.entries()]
    .map(([name, value]) => ({
      name,
      tokens: value.tokens,
      costUsd: value.costUsd,
      sessions: value.sessions.size,
      share: totalTokens > 0 ? value.tokens / totalTokens : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 12);
}

function aggregateProjectUsage(entries: TokenUsageEvent[]): TokenUsageProjectBreakdown[] {
  const totalTokens = entries.reduce((sum, entry) => sum + getTokenConsumptionTokens(entry), 0);
  const usage = new Map<
    string,
    {
      tokens: number;
      costUsd: number;
      sessions: Set<string>;
      days: Set<string>;
      models: Set<string>;
      lastReportedAt: string;
    }
  >();

  for (const entry of entries) {
    const tokens = getTokenConsumptionTokens(entry);
    const name = entry.project || "未标记项目";
    const current =
      usage.get(name) ??
      {
        tokens: 0,
        costUsd: 0,
        sessions: new Set<string>(),
        days: new Set<string>(),
        models: new Set<string>(),
        lastReportedAt: entry.timestamp,
      };

    current.tokens += tokens;
    current.costUsd += entry.costUsd ?? 0;
    current.sessions.add(entry.sessionId || entry.id);
    current.days.add(toDateKey(entry.timestamp));
    current.models.add(entry.model || "unknown");
    if (new Date(entry.timestamp).getTime() > new Date(current.lastReportedAt).getTime()) {
      current.lastReportedAt = entry.timestamp;
    }
    usage.set(name, current);
  }

  return [...usage.entries()]
    .map(([name, value]) => ({
      name,
      tokens: value.tokens,
      costUsd: value.costUsd,
      sessions: value.sessions.size,
      activeDays: value.days.size,
      models: value.models.size,
      share: totalTokens > 0 ? value.tokens / totalTokens : 0,
      lastReportedAt: value.lastReportedAt,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 18);
}

function buildActivityHeatmap(entries: TokenUsageEvent[]): TokenUsageActivityCell[] {
  const cells = new Map<
    string,
    {
      weekday: number;
      hour: number;
      tokens: number;
      sessions: Set<string>;
      messages: number;
    }
  >();

  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      cells.set(`${weekday}:${hour}`, { weekday, hour, tokens: 0, sessions: new Set<string>(), messages: 0 });
    }
  }

  for (const entry of entries) {
    const { weekday, hour } = getShanghaiWeekdayHour(entry.timestamp);
    const key = `${weekday}:${hour}`;
    const cell = cells.get(key);

    if (!cell) {
      continue;
    }

    cell.tokens += getTokenConsumptionTokens(entry);
    cell.sessions.add(entry.sessionId || entry.id);
    cell.messages += entry.messages ?? 0;
  }

  return [...cells.values()].map((cell) => ({
    weekday: cell.weekday,
    hour: cell.hour,
    tokens: cell.tokens,
    sessions: cell.sessions.size,
    messages: cell.messages,
  }));
}

function topActivityHour(entries: TokenUsageEvent[]) {
  const hours = new Map<number, number>();

  for (const entry of entries) {
    const { hour } = getShanghaiWeekdayHour(entry.timestamp);
    hours.set(hour, (hours.get(hour) ?? 0) + getTokenConsumptionTokens(entry));
  }

  const hour = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return hour === undefined ? "--" : `${String(hour).padStart(2, "0")}:00`;
}

function topActivityWeekday(entries: TokenUsageEvent[]) {
  const weekdays = new Map<number, number>();

  for (const entry of entries) {
    const { weekday } = getShanghaiWeekdayHour(entry.timestamp);
    weekdays.set(weekday, (weekdays.get(weekday) ?? 0) + getTokenConsumptionTokens(entry));
  }

  const weekday = [...weekdays.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return weekday === undefined ? "--" : WEEKDAY_LABELS[weekday];
}

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function getShanghaiWeekdayHour(value: string) {
  const time = new Date(value).getTime();
  const shifted = new Date((Number.isFinite(time) ? time : Date.now()) + SHANGHAI_OFFSET_MS);

  return {
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
  };
}

function buildDailySeries(entries: TokenUsageEvent[], start: Date, end: Date) {
  const values = new Map<string, number>();
  const startDay = startOfUtcDay(start);
  const endDay = startOfUtcDay(end);

  for (let time = startDay.getTime(); time <= endDay.getTime(); time += 24 * 60 * 60 * 1000) {
    values.set(toDateKey(new Date(time).toISOString()), 0);
  }

  for (const entry of entries) {
    const key = toDateKey(entry.timestamp);
    values.set(key, (values.get(key) ?? 0) + getTokenConsumptionTokens(entry));
  }

  return [...values.entries()].map(([date, tokens]) => ({ date, tokens }));
}

function sumTokensByUser(entries: TokenUsageEvent[]) {
  const result = new Map<string, number>();

  for (const entry of entries) {
    result.set(entry.userId, (result.get(entry.userId) ?? 0) + getTokenConsumptionTokens(entry));
  }

  return result;
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(field.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function estimateCostUsd({
  model,
  inputTokens,
  cachedInputTokens,
  outputTokens,
}: {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}) {
  const pricing = MODEL_PRICING.find((item) => item.match.test(model));

  if (!pricing) {
    return 0;
  }

  return (
    (inputTokens / 1_000_000) * pricing.input +
    (cachedInputTokens / 1_000_000) * pricing.cachedInput +
    (outputTokens / 1_000_000) * pricing.output
  );
}

function addMapValue(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function topMapEntry(map: Map<string, number>) {
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

function readField(record: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (record[name] !== undefined) {
      return record[name];
    }

    const normalizedName = normalizeHeader(name);
    if (record[normalizedName] !== undefined) {
      return record[normalizedName];
    }
  }

  return undefined;
}

function normalizeHeader(value: string) {
  return value.trim().replace(/[-\s]+(.)?/g, (_, next: string | undefined) => (next ? next.toUpperCase() : ""));
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown) {
  const date = new Date(typeof value === "string" && value.trim() ? value : Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function toDateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}
