"use client";

import { useEffect, useMemo, useState } from "react";

import {
  TOKEN_LEADERBOARD_STORAGE_KEY,
  buildTokenLeaderboard,
  dedupeTokenEvents,
  parseTokenUsageImport,
  type TokenBoardMetric,
  type TokenBoardRange,
  type TokenAccountUsageProfile,
  type TokenLeaderboardSummary,
  type TokenLeaderboardUser,
  type TokenUsageEvent,
} from "@/lib/token-leaderboard";
import { withBasePath } from "@/lib/utils/site-path";

const RANGES: TokenBoardRange[] = ["1D", "7D", "30D", "90D"];

const METRICS: Array<{ key: TokenBoardMetric; label: string }> = [
  { key: "tokens", label: "Tokens" },
  { key: "cost", label: "费用" },
  { key: "sessions", label: "会话" },
  { key: "messages", label: "消息" },
];

const CSV_PLACEHOLDER =
  "user,displayName,team,tool,model,project,timestamp,inputTokens,cachedInputTokens,outputTokens,reasoningOutputTokens,totalTokens,messages";
const NPX_PACKAGE_URL = "https://ffffhx.github.io/garden-lab/token-board-agent.tgz?v=0.4.1";
const NPX_INSTALL_COMMAND =
  `npx --yes --package ${NPX_PACKAGE_URL} -- token-board-agent install`;
const NPX_STATUS_COMMAND =
  `npx --yes --package ${NPX_PACKAGE_URL} -- token-board-agent status`;

export function TokenLeaderboardApp({
  initialEntries,
  initialNow,
  apiBaseUrl,
}: {
  initialEntries: TokenUsageEvent[];
  initialNow: string;
  apiBaseUrl?: string;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [range, setRange] = useState<TokenBoardRange>("7D");
  const [metric, setMetric] = useState<TokenBoardMetric>("tokens");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("正在加载真实用户数据");
  const [loadedSource, setLoadedSource] = useState(initialEntries.length ? "initial" : "loading");
  const [dataLoadState, setDataLoadState] = useState<DataLoadState>(initialEntries.length ? "ready" : "loading");
  const [now, setNow] = useState(() => new Date(initialNow));
  const [remoteSummary, setRemoteSummary] = useState<TokenLeaderboardSummary | null>(null);
  const [remoteRecordCount, setRemoteRecordCount] = useState<number | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [accountProfile, setAccountProfile] = useState<TokenAccountUsageProfile | null>(null);
  const [accountLoadState, setAccountLoadState] = useState<AccountLoadState>("idle");
  const [accountError, setAccountError] = useState("");
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);

  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    if (normalizedApiBaseUrl) {
      return;
    }

    let active = true;

    const localValue = window.localStorage.getItem(TOKEN_LEADERBOARD_STORAGE_KEY);

    if (localValue) {
      const parsed = parseTokenUsageImport(localValue);
      if (parsed.entries.length) {
        setEntries(parsed.entries);
        setLoadedSource("local");
        setStatus(`本地数据 ${parsed.entries.length} 条`);
        setDataLoadState("ready");
        return;
      }
    }

    setDataLoadState(initialEntries.length ? "ready" : "loading");
    setStatus(initialEntries.length ? `初始数据 ${initialEntries.length} 条` : "正在加载真实用户数据");

    fetch(withBasePath("/stats/token-leaderboard.json"), { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.text();
      })
      .then((text) => {
        if (!active) {
          return;
        }

        const parsed = parseTokenUsageImport(text);
        if (parsed.entries.length) {
          setEntries(dedupeTokenEvents([...initialEntries, ...parsed.entries]));
          setLoadedSource("public");
          setStatus(`公开数据 ${parsed.entries.length} 条`);
          setDataLoadState("ready");
          return;
        }

        setStatus("正在等待真实用户数据");
      })
      .catch(() => {
        if (active) {
          setStatus("正在等待真实用户数据");
        }
      });

    return () => {
      active = false;
    };
  }, [initialEntries, normalizedApiBaseUrl]);

  useEffect(() => {
    if (!normalizedApiBaseUrl) {
      setRemoteSummary(null);
      setRemoteRecordCount(null);
      return;
    }

    let active = true;
    const params = new URLSearchParams({ range, metric });

    setRemoteSummary(null);
    setRemoteRecordCount(null);
    setLoadedSource("server");
    setDataLoadState("loading");
    setStatus("正在加载真实用户数据");
    fetch(`${normalizedApiBaseUrl}/api/usage/stats?${params.toString()}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json() as Promise<RemoteStatsResponse>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        const summary = "summary" in payload && payload.summary ? payload.summary : payload;
        if (!isTokenLeaderboardSummary(summary)) {
          throw new Error("后端返回格式不正确");
        }

        setRemoteSummary(summary);
        setRemoteRecordCount(typeof payload.records === "number" ? payload.records : null);
        setLoadedSource("server");
        setDataLoadState("ready");
        setStatus(`后端数据 ${typeof payload.records === "number" ? payload.records : summary.users.length} 条`);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setRemoteSummary(null);
        setRemoteRecordCount(null);
        setLoadedSource("loading");
        setDataLoadState("loading");
        setStatus(`真实用户数据加载中：${error instanceof Error ? error.message : "读取失败"}`);
      });

    return () => {
      active = false;
    };
  }, [metric, normalizedApiBaseUrl, range]);

  useEffect(() => {
    if (!normalizedApiBaseUrl) {
      setViewer(null);
      return;
    }

    let active = true;

    fetch(`${normalizedApiBaseUrl}/api/auth/me`, { cache: "no-store", credentials: "include" })
      .then((response) => (response.ok ? response.json() : { authenticated: false }))
      .then((payload: ViewerState) => {
        if (active) {
          setViewer(payload);
        }
      })
      .catch(() => {
        if (active) {
          setViewer({ authenticated: false });
        }
      });

    return () => {
      active = false;
    };
  }, [normalizedApiBaseUrl]);

  useEffect(() => {
    if (!normalizedApiBaseUrl || !viewer?.authenticated) {
      setAccountProfile(null);
      setAccountLoadState("idle");
      setAccountError("");
      return;
    }

    let active = true;
    const params = new URLSearchParams({ range });

    setAccountLoadState("loading");
    setAccountError("");
    fetch(`${normalizedApiBaseUrl}/api/usage/me?${params.toString()}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json() as Promise<AccountUsageResponse>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        if (!isTokenAccountUsageProfile(payload.profile)) {
          throw new Error("后端返回格式不正确");
        }

        setAccountProfile(payload.profile);
        setAccountLoadState("ready");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setAccountProfile(null);
        setAccountLoadState("error");
        setAccountError(error instanceof Error ? error.message : "读取失败");
      });

    return () => {
      active = false;
    };
  }, [normalizedApiBaseUrl, range, viewer?.authenticated, viewer?.user?.userId]);

  const localSummary = useMemo(
    () => buildTokenLeaderboard(entries, { range, metric, now }),
    [entries, metric, now, range]
  );
  const summary = remoteSummary ?? localSummary;
  const recordCount = remoteRecordCount ?? entries.length;
  const isDataLoading = dataLoadState === "loading" && !remoteSummary && entries.length === 0;
  const sourceLabel = isDataLoading ? "loading" : remoteSummary ? "server" : loadedSource;
  const statusMessage = isDataLoading ? status : remoteSummary ? `后端数据 ${recordCount} 条` : status;

  const topUsers = summary.users.slice(0, 8);
  const leader = summary.users[0];
  const maxDailyTokens = Math.max(1, ...summary.daily.map((point) => point.tokens));
  const selectedMetricLabel = METRICS.find((item) => item.key === metric)?.label ?? "Tokens";
  const topModelLabel = isDataLoading ? "Loading" : summary.topModel === "unknown" ? "--" : summary.topModel;
  const topToolLabel = isDataLoading ? "真实数据加载中" : summary.topTool === "unknown" ? "--" : summary.topTool;
  const recordCountLabel = isDataLoading ? "..." : formatNumber(recordCount);

  function importText(text: string, mode: "replace" | "merge" = "merge") {
    const parsed = parseTokenUsageImport(text);

    if (!parsed.entries.length) {
      setStatus(parsed.errors[0] ?? "导入失败");
      return;
    }

    const nextEntries = mode === "replace" ? parsed.entries : dedupeTokenEvents([...entries, ...parsed.entries]);
    setEntries(nextEntries);
    setRemoteSummary(null);
    setRemoteRecordCount(null);
    window.localStorage.setItem(
      TOKEN_LEADERBOARD_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, updatedAt: new Date().toISOString(), entries: nextEntries }, null, 2)
    );
    setLoadedSource("local");
    setDataLoadState("ready");
    setStatus(`已导入 ${parsed.entries.length} 条，当前 ${nextEntries.length} 条`);
    setDraft("");
  }

  async function importFile(file: File | undefined) {
    if (!file) {
      return;
    }

    importText(await file.text());
  }

  function exportJson() {
    const blob = new Blob(
      [JSON.stringify({ schemaVersion: 1, updatedAt: new Date().toISOString(), entries }, null, 2)],
      { type: "application/json" }
    );
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `token-leaderboard-${range.toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(href);
  }

  function loginWithGitHub() {
    if (!normalizedApiBaseUrl) {
      return;
    }

    window.location.href = `${normalizedApiBaseUrl}/api/auth/github/start?returnTo=${encodeURIComponent(window.location.href)}`;
  }

  function logoutGitHub() {
    if (!normalizedApiBaseUrl) {
      return;
    }

    window.location.href = `${normalizedApiBaseUrl}/api/auth/logout?returnTo=${encodeURIComponent(window.location.href)}`;
  }

  return (
    <main className="min-w-0 font-sans text-stone-950">
      <div className="space-y-5">
        <header className="relative overflow-hidden rounded-[1.25rem] border border-stone-950/15 bg-[#11130f] px-5 py-5 text-[#f8f1e5] shadow-[0_28px_90px_-62px_rgba(17,19,15,0.85)] sm:px-6 lg:px-7">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(135deg,rgba(241,196,92,0.16)_0_1px,transparent_1px_24px),linear-gradient(90deg,rgba(255,255,255,0.07),transparent_42%)]" />
          <div className="relative space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#f1c45c]/35 bg-[#f1c45c]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#f1c45c]">
                    Open Token Board
                  </span>
                  <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold text-white/78">
                    {sourceLabel}
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-5xl">
                  朋友间的 Token 排行榜
                </h1>
                <p className="mt-3 text-sm leading-6 text-white/68">
                  {isDataLoading ? "正在加载真实用户数据" : `${formatShortDate(summary.startAt)} - ${formatShortDate(summary.endAt)}`}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 xl:w-auto xl:items-end">
                <GitHubAuthControl viewer={viewer} onLogin={loginWithGitHub} onLogout={logoutGitHub} />
                <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto">
                  <SegmentedControl
                    items={RANGES.map((item) => ({ key: item, label: item }))}
                    value={range}
                    onChange={(value) => setRange(value as TokenBoardRange)}
                    label="时间范围"
                  />
                  <SegmentedControl
                    items={METRICS.map((item) => ({ key: item.key, label: item.label }))}
                    value={metric}
                    onChange={(value) => setMetric(value as TokenBoardMetric)}
                    label="排序指标"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
              <HeroSignal
                label="当前榜首"
                value={isDataLoading ? "Loading" : leader?.displayName ?? "--"}
                meta={isDataLoading ? "真实数据加载中" : leader ? formatTokens(leader.tokens) : "--"}
              />
              <HeroSignal
                label="排序指标"
                value={selectedMetricLabel}
                meta={isDataLoading ? "Loading" : `${formatNumber(summary.totalMessages)} messages`}
              />
              <HeroSignal label="高频组合" value={topModelLabel} meta={topToolLabel} />
            </div>
          </div>
        </header>

        <AccountUsagePanel
          apiEnabled={Boolean(normalizedApiBaseUrl)}
          error={accountError}
          loadState={accountLoadState}
          onLogin={loginWithGitHub}
          profile={accountProfile}
          range={range}
          viewer={viewer}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="总 Tokens"
                value={isDataLoading ? "Loading" : formatTokens(summary.totalTokens)}
                meta={isDataLoading ? "真实数据加载中" : "Total spend"}
                tone="ink"
              />
              <StatTile
                label="活跃用户"
                value={isDataLoading ? "Loading" : formatNumber(summary.activeUsers)}
                meta={isDataLoading ? "真实数据加载中" : `${topUsers.length} listed`}
                tone="mint"
              />
              <StatTile
                label="会话"
                value={isDataLoading ? "Loading" : formatNumber(summary.totalSessions)}
                meta={isDataLoading ? "真实数据加载中" : "Sessions"}
                tone="blue"
              />
              <StatTile
                label="估算费用"
                value={isDataLoading ? "Loading" : formatUsd(summary.totalCostUsd)}
                meta={isDataLoading ? "真实数据加载中" : "USD estimate"}
                tone="gold"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
              <section className="min-w-0 overflow-hidden rounded-[1.25rem] border border-stone-950/10 bg-[#fffdfa] shadow-[0_20px_70px_-60px_rgba(28,25,23,0.65)]">
                <PanelHeader
                  title="排行榜"
                  meta={isDataLoading ? "loading" : `${summary.users.length} users`}
                  action={isDataLoading ? "Loading" : `${formatShortDate(summary.startAt)} - ${formatShortDate(summary.endAt)}`}
                />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                    <thead className="bg-[#f3ede0] text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">
                      <tr>
                        <th className="px-4 py-3">排名</th>
                        <th className="px-4 py-3">用户</th>
                        <th className="px-4 py-3 text-right">Tokens</th>
                        <th className="px-4 py-3 text-right">费用</th>
                        <th className="px-4 py-3 text-right">会话</th>
                        <th className="px-4 py-3 text-right">消息</th>
                        <th className="px-4 py-3">常用模型</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-950/8">
                      {isDataLoading ? (
                        <LeaderboardLoadingRow />
                      ) : summary.users.length ? (
                        summary.users.map((user) => <LeaderboardRow key={user.userId} user={user} />)
                      ) : (
                        <LeaderboardEmptyRow />
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-[1.25rem] border border-stone-950/10 bg-[#f5efe4] p-4 shadow-[0_18px_65px_-58px_rgba(28,25,23,0.6)]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">份额</h2>
                  <span className="font-mono text-xs text-stone-500">{isDataLoading ? "Loading" : `${topUsers.length} 人`}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {isDataLoading ? <ShareLoadingRows /> : topUsers.length ? topUsers.map((user) => (
                    <ShareRow key={user.userId} user={user} />
                  )) : <EmptyPanelMessage />}
                </div>
              </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(18rem,0.82fr)]">
              <section className="rounded-[1.25rem] border border-stone-950/10 bg-[#fffdfa] p-4 shadow-[0_18px_65px_-58px_rgba(28,25,23,0.6)]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Token 趋势</h2>
                  <p className="font-mono text-xs text-stone-500">峰值 {isDataLoading ? "Loading" : formatTokens(maxDailyTokens)}</p>
                </div>
                <div
                  className="mt-4 grid h-56 grid-cols-[repeat(auto-fit,minmax(8px,1fr))] items-end gap-1 rounded-xl border border-stone-950/8 bg-[linear-gradient(180deg,rgba(17,19,15,0.04),transparent)] px-3 pb-3 pt-5"
                  aria-label="Token 趋势"
                >
                  {isDataLoading ? <TrendLoadingBars /> : summary.daily.map((point, index) => (
                    <div key={point.date} className="flex h-full items-end">
                      <div
                        className={`w-full rounded-t-[3px] transition duration-200 hover:translate-y-[-2px] ${
                          index === summary.daily.length - 1 ? "bg-[#c05c38]" : "bg-[#172018] hover:bg-[#26745e]"
                        }`}
                        title={`${point.date} ${formatTokens(point.tokens)}`}
                        style={{ height: `${Math.max(3, (point.tokens / maxDailyTokens) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between font-mono text-xs text-stone-500">
                  <span>{isDataLoading ? "--" : summary.daily[0]?.date.slice(5) ?? "--"}</span>
                  <span>{isDataLoading ? "--" : summary.daily.at(-1)?.date.slice(5) ?? "--"}</span>
                </div>
              </section>

              <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <BreakdownPanel title="模型消耗" loading={isDataLoading} items={summary.models.map((item) => ({
                  name: item.name,
                  value: item.tokens,
                  meta: formatUsd(item.costUsd),
                  share: item.share,
                }))} />
                <BreakdownPanel title="工具分布" loading={isDataLoading} items={summary.tools.map((item) => ({
                  name: item.name,
                  value: item.tokens,
                  meta: `${formatNumber(item.sessions)} 会话`,
                  share: item.share,
                }))} />
              </section>
            </div>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[1.25rem] border border-stone-950/10 bg-[#fffdfa] p-4 shadow-[0_18px_65px_-58px_rgba(28,25,23,0.6)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">数据入口</h2>
                <span className="rounded-full bg-stone-950 px-2.5 py-1 font-mono text-xs text-white">{recordCountLabel}</span>
              </div>
              <div className="mt-4 space-y-3">
                {normalizedApiBaseUrl ? (
                  <div className="rounded-xl border border-[#26745e]/25 bg-[#eaf5ef] p-3 text-xs text-[#163d33]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">自动上报</p>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px]">live</span>
                    </div>
                    <p className="mt-2 break-all font-mono leading-5">{normalizedApiBaseUrl}/api/usage/ingest</p>
                    <p className="mt-2 text-[#26745e]">
                      {viewer?.authenticated
                        ? `@${viewer.user?.githubLogin || viewer.user?.displayName}`
                        : "GitHub / npx agent"}
                    </p>
                    <div className="mt-3 rounded-lg border border-[#26745e]/18 bg-white/70 p-2">
                      <p className="text-[11px] font-semibold text-[#26745e]">agent install</p>
                      <code className="mt-1 block break-all font-mono text-[11px] leading-5 text-[#163d33]">
                        {NPX_INSTALL_COMMAND}
                      </code>
                    </div>
                    <p className="mt-2 break-all text-[11px] text-[#26745e]">
                      status: <code className="font-mono">{NPX_STATUS_COMMAND}</code>
                    </p>
                  </div>
                ) : null}
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">CSV / JSON</span>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={CSV_PLACEHOLDER}
                    className="mt-2 min-h-36 w-full resize-y rounded-xl border border-stone-950/12 bg-[#fbf7ef] p-3 font-mono text-xs leading-5 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#26745e] focus:bg-white focus:ring-4 focus:ring-[#26745e]/12"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton icon="upload" onClick={() => importText(draft)}>
                    导入
                  </ActionButton>
                  <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-950/15 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-[#26745e]/40 hover:bg-[#eef7f2]">
                    <Icon name="file" />
                    文件
                    <input
                      type="file"
                      accept=".json,.csv,text/csv,application/json"
                      className="sr-only"
                      onChange={(event) => {
                        void importFile(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <div className="grid gap-2">
                  <ActionButton icon="download" variant="secondary" onClick={exportJson}>
                    导出本地
                  </ActionButton>
                </div>
                <p className="min-h-5 rounded-lg bg-[#f5efe4] px-3 py-2 text-xs text-stone-600" aria-live="polite">
                  {statusMessage}
                </p>
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-stone-950/10 bg-[#fffdfa] p-4 shadow-[0_18px_65px_-58px_rgba(28,25,23,0.6)]">
              <h2 className="text-base font-semibold">上报字段</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-600">
                {[
                  "user",
                  "timestamp",
                  "model",
                  "tool",
                  "inputTokens",
                  "outputTokens",
                  "cachedInputTokens",
                  "reasoningOutputTokens",
                  "totalTokens",
                  "sessionId",
                ].map((field) => (
                  <code key={field} className="truncate rounded-md border border-stone-950/10 bg-[#f5efe4] px-2 py-1">
                    {field}
                  </code>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function AccountUsagePanel({
  apiEnabled,
  error,
  loadState,
  onLogin,
  profile,
  range,
  viewer,
}: {
  apiEnabled: boolean;
  error: string;
  loadState: AccountLoadState;
  onLogin: () => void;
  profile: TokenAccountUsageProfile | null;
  range: TokenBoardRange;
  viewer: ViewerState | null;
}) {
  const user = profile?.user ?? null;
  const inputContextTokens = user ? user.inputTokens + user.cachedInputTokens : 0;
  const cacheHitRate = inputContextTokens > 0 && user ? user.cachedInputTokens / inputContextTokens : 0;
  const messagesPerSession = user?.sessions ? user.messages / user.sessions : 0;
  const dashboardProfile = profile && user ? profile : null;

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-[#22342b] bg-[#080b09] text-[#f7f4ec] shadow-[0_28px_90px_-68px_rgba(8,11,9,0.95)]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#7be3a0]">GitHub Account</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">我的 Token 消耗</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 font-mono text-xs text-white/72">
              {range}
            </span>
            {viewer?.authenticated ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#7be3a0]/25 bg-[#123127] px-3 py-1 text-sm font-semibold text-[#bdf5cc]">
                {viewer.user?.avatarUrl ? (
                  <img
                    alt=""
                    className="size-5 rounded-full"
                    src={viewer.user.avatarUrl}
                  />
                ) : null}
                @{viewer.user?.githubLogin || viewer.user?.displayName || "GitHub"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {!apiEnabled ? (
        <AccountEmptyState
          title="等待连接 Token Board 服务"
          description="配置 NEXT_PUBLIC_TOKEN_BOARD_API_URL 后，这里会按当前 GitHub 登录账号展示个人消耗。"
        />
      ) : !viewer ? (
        <AccountLoadingState />
      ) : !viewer.authenticated ? (
        <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
          <div>
            <p className="text-lg font-semibold">登录后查看自己的 GitHub 消耗</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
              这里会只展示当前 GitHub 账号通过 agent 上报的 Token、费用、模型、项目和活跃分布。
            </p>
          </div>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f7f4ec] px-4 text-sm font-semibold text-[#080b09] transition hover:bg-[#ffe2a8]"
          >
            <Icon name="github" />
            GitHub 登录
          </button>
        </div>
      ) : loadState === "loading" ? (
        <AccountLoadingState />
      ) : loadState === "error" ? (
        <AccountEmptyState title="个人消耗加载失败" description={error || "请稍后刷新再试。"} />
      ) : !dashboardProfile || !user ? (
        <AccountEmptyState
          title="还没有这个 GitHub 账号的上报数据"
          description="在本机运行 token-board-agent login 并保持 agent 同步后，这里就会出现个人视图。"
        />
      ) : (
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/6 p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
            <div className="flex items-center gap-4">
              {viewer.user?.avatarUrl ? (
                <img
                  alt=""
                  className="size-12 rounded-2xl border border-white/15"
                  src={viewer.user.avatarUrl}
                />
              ) : (
                <Avatar name={user.displayName} index={user.rank || 0} />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/45">我的排名（按 Token，{range}）</p>
                <p className="mt-1 truncate font-mono text-3xl font-semibold">
                  #{dashboardProfile.rank ?? "--"}
                  <span className="ml-2 text-base text-white/42">/ {formatNumber(dashboardProfile.totalUsers)}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-right">
              <div>
                <p className="text-xs text-white/42">超过</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#bdf5cc]">
                  {dashboardProfile.percentile === null ? "--" : formatPercent(dashboardProfile.percentile)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/42">排名变化</p>
                <p className={`mt-1 font-mono text-xl font-semibold ${rankDeltaTone(dashboardProfile.rankDelta)}`}>
                  {formatRankDelta(dashboardProfile.rankDelta)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <AccountStatCard label="预估费用" value={formatUsd(user.costUsd)} meta="USD estimate" tone="gold" />
            <AccountStatCard label="总 Token" value={formatTokens(user.tokens)} meta={`${formatNumber(dashboardProfile.records)} records`} tone="green" />
            <AccountStatCard label="输入上下文" value={formatTokens(inputContextTokens)} meta={`缓存 ${formatTokens(user.cachedInputTokens)}`} tone="blue" />
            <AccountStatCard label="输出 Token" value={formatTokens(user.outputTokens)} meta={`推理 ${formatTokens(user.reasoningOutputTokens)}`} tone="rose" />
            <AccountStatCard label="缓存命中率" value={formatPercent(cacheHitRate)} meta={user.topTool} tone="ink" />
            <AccountStatCard label="活跃天数" value={`${formatNumber(user.activeDays)}d`} meta={dashboardProfile.topWeekday} tone="green" />
            <AccountStatCard label="会话数" value={formatNumber(user.sessions)} meta={`${formatDecimal(messagesPerSession)} msg/session`} tone="blue" />
            <AccountStatCard label="总消息数" value={formatNumber(user.messages)} meta="messages" tone="ink" />
            <AccountStatCard label="高峰时段" value={dashboardProfile.topHour} meta="Asia/Shanghai" tone="gold" />
            <AccountStatCard label="常用模型" value={user.topModel} meta={`${dashboardProfile.models.length} models`} tone="rose" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
            <AccountDailyTrend daily={dashboardProfile.daily} />
            <AccountHeatmap heatmap={dashboardProfile.heatmap} />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <AccountBreakdownPanel
              title="模型消耗"
              meta={`${dashboardProfile.models.length} 个模型`}
              items={dashboardProfile.models.map((item) => ({
                name: item.name,
                value: item.tokens,
                meta: formatUsd(item.costUsd),
                share: item.share,
              }))}
              barColor="#6ea3ff"
            />
            <AccountBreakdownPanel
              title="工具分布"
              meta={`${dashboardProfile.tools.length} 个工具`}
              items={dashboardProfile.tools.map((item) => ({
                name: item.name,
                value: item.tokens,
                meta: `${formatNumber(item.sessions)} 会话`,
                share: item.share,
              }))}
              barColor="#f1c45c"
            />
            <AccountProjectList projects={dashboardProfile.projects} />
          </div>
        </div>
      )}
    </section>
  );
}

function AccountEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-5 py-8 text-center sm:px-6">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/54">{description}</p>
    </div>
  );
}

function AccountLoadingState() {
  return (
    <div className="space-y-5 px-5 py-5 sm:px-6">
      <div className="h-24 rounded-2xl border border-white/10 bg-white/6 motion-safe:animate-pulse" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="h-28 rounded-xl border border-white/10 bg-white/6 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function AccountStatCard({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta: string;
  tone: "blue" | "gold" | "green" | "ink" | "rose";
}) {
  const tones = {
    blue: "border-[#6ea3ff]/24 bg-[#102034] text-[#d9e8ff]",
    gold: "border-[#f1c45c]/24 bg-[#2e2512] text-[#ffe2a8]",
    green: "border-[#7be3a0]/24 bg-[#10291f] text-[#bdf5cc]",
    ink: "border-white/12 bg-white/8 text-white",
    rose: "border-[#ff9b7c]/24 bg-[#321811] text-[#ffd4c6]",
  };

  return (
    <div className={`min-h-28 rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold text-white/45">{label}</p>
      <p className="mt-3 truncate font-mono text-2xl font-semibold leading-none" title={value}>
        {value}
      </p>
      <p className="mt-3 truncate text-xs text-white/42" title={meta}>
        {meta}
      </p>
    </div>
  );
}

function AccountDailyTrend({ daily }: { daily: TokenAccountUsageProfile["daily"] }) {
  const maxTokens = Math.max(1, ...daily.map((point) => point.tokens));

  return (
    <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">每日趋势</h3>
        <span className="font-mono text-xs text-white/45">峰值 {formatTokens(maxTokens)}</span>
      </div>
      <div className="mt-4 grid h-64 grid-cols-[repeat(auto-fit,minmax(5px,1fr))] items-end gap-1 rounded-xl border border-white/8 bg-black/18 px-3 pb-3 pt-5">
        {daily.map((point, index) => (
          <div key={point.date} className="flex h-full items-end">
            <div
              className={`w-full rounded-t-[3px] transition hover:translate-y-[-2px] ${
                index === daily.length - 1 ? "bg-[#f1c45c]" : "bg-[#43d184] hover:bg-[#7be3a0]"
              }`}
              style={{ height: `${Math.max(2, (point.tokens / maxTokens) * 100)}%` }}
              title={`${point.date} ${formatTokens(point.tokens)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-xs text-white/38">
        <span>{daily[0]?.date.slice(5) ?? "--"}</span>
        <span>{daily.at(-1)?.date.slice(5) ?? "--"}</span>
      </div>
    </section>
  );
}

function AccountHeatmap({ heatmap }: { heatmap: TokenAccountUsageProfile["heatmap"] }) {
  const maxTokens = Math.max(1, ...heatmap.map((cell) => cell.tokens));
  const cells = new Map(heatmap.map((cell) => [`${cell.weekday}:${cell.hour}`, cell]));
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  return (
    <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">分时活跃</h3>
        <span className="font-mono text-xs text-white/45">少 → 多</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[38rem]">
          <div
            className="grid gap-1 text-[10px] text-white/38"
            style={{ gridTemplateColumns: "2.5rem repeat(24, minmax(0, 1fr))" }}
          >
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className={hour % 3 === 0 ? "text-center" : "text-transparent"}>
                {String(hour).padStart(2, "0")}
              </span>
            ))}
            {weekdays.map((weekday, weekdayIndex) => (
              <div key={weekday} className="contents">
                <span className="flex h-4 items-center">{weekday}</span>
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = cells.get(`${weekdayIndex}:${hour}`);
                  const intensity = (cell?.tokens ?? 0) / maxTokens;

                  return (
                    <span
                      key={`${weekday}:${hour}`}
                      className="h-4 rounded-[4px] border border-white/5"
                      style={{ backgroundColor: heatColor(intensity) }}
                      title={`${weekday} ${String(hour).padStart(2, "0")}:00 ${formatTokens(cell?.tokens ?? 0)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AccountBreakdownPanel({
  barColor,
  items,
  meta,
  title,
}: {
  barColor: string;
  items: Array<{ name: string; value: number; meta: string; share: number }>;
  meta: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="font-mono text-xs text-white/45">{meta}</span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.slice(0, 8).map((item) => (
            <div key={item.name}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="truncate font-medium text-white/86">{item.name}</p>
                <p className="shrink-0 font-mono text-white/62">{formatTokens(item.value)}</p>
              </div>
              <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_4.25rem] items-center gap-3">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(2, item.share * 100)}%`, backgroundColor: barColor }}
                  />
                </div>
                <p className="truncate text-right text-xs text-white/42">{item.meta}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-white/10 bg-black/16 px-3 py-4 text-center text-sm text-white/45">暂无数据</p>
        )}
      </div>
    </section>
  );
}

function AccountProjectList({ projects }: { projects: TokenAccountUsageProfile["projects"] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">项目分布</h3>
        <span className="font-mono text-xs text-white/45">{projects.length} 个项目</span>
      </div>
      <div className="mt-4 space-y-3">
        {projects.length ? (
          projects.slice(0, 8).map((project) => (
            <div key={project.name} className="rounded-xl border border-white/8 bg-black/16 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white/88">{project.name}</p>
                  <p className="mt-1 text-xs text-white/42">
                    {formatNumber(project.activeDays)}d · {formatNumber(project.models)} models
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold text-[#ffe2a8]">{formatUsd(project.costUsd)}</p>
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#7be3a0]"
                    style={{ width: `${Math.max(2, project.share * 100)}%` }}
                  />
                </div>
                <p className="text-right font-mono text-xs text-white/56">{formatTokens(project.tokens)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-white/10 bg-black/16 px-3 py-4 text-center text-sm text-white/45">暂无数据</p>
        )}
      </div>
    </section>
  );
}

function SegmentedControl({
  items,
  value,
  onChange,
  label,
}: {
  items: Array<{ key: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="grid w-full grid-cols-4 rounded-xl border border-white/15 bg-white/10 p-1" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={value === item.key}
          onClick={() => onChange(item.key)}
          className={`min-h-9 rounded-lg px-2 text-sm font-semibold transition ${
            value === item.key
              ? "bg-[#f8f1e5] text-[#11130f] shadow-[0_10px_24px_-20px_rgba(255,255,255,0.7)]"
              : "text-white/72 hover:bg-white/10 hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta: string;
  tone: "ink" | "mint" | "blue" | "gold";
}) {
  const tones = {
    ink: "border-[#11130f] bg-[#11130f] text-white",
    mint: "border-[#26745e]/20 bg-[#eaf5ef] text-[#163d33]",
    blue: "border-[#2f6387]/18 bg-[#e9f1f4] text-[#183447]",
    gold: "border-[#b06a2c]/18 bg-[#fff2d6] text-[#5a3419]",
  };

  return (
    <div className={`min-h-32 rounded-[1.15rem] border p-4 shadow-[0_18px_55px_-50px_rgba(28,25,23,0.7)] ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-65">{label}</p>
        <span className="mt-0.5 size-2 rounded-full bg-current opacity-55" />
      </div>
      <p className="mt-5 font-mono text-3xl font-semibold leading-none sm:text-4xl">{value}</p>
      <p className="mt-3 truncate text-xs opacity-60">{meta}</p>
    </div>
  );
}

function HeroSignal({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="min-w-0 border-l border-white/12 pl-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/42">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 truncate font-mono text-xs text-[#f1c45c]">{meta}</p>
    </div>
  );
}

function PanelHeader({ title, meta, action }: { title: string; meta: string; action: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-stone-950/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 font-mono text-xs text-stone-500">{meta}</p>
      </div>
      <span className="w-fit rounded-full border border-stone-950/10 bg-[#f5efe4] px-3 py-1 font-mono text-xs text-stone-600">
        {action}
      </span>
    </div>
  );
}

function LeaderboardRow({ user }: { user: TokenLeaderboardUser }) {
  const rankTone =
    user.rank === 1
      ? "border-[#b06a2c]/30 bg-[#fff2d6] text-[#5a3419]"
      : user.rank === 2
        ? "border-[#2f6387]/20 bg-[#e9f1f4] text-[#183447]"
        : user.rank === 3
          ? "border-[#26745e]/20 bg-[#eaf5ef] text-[#163d33]"
          : "border-stone-950/10 bg-white text-stone-500";

  return (
    <tr className="transition hover:bg-[#f8f2e8]">
      <td className="px-4 py-3">
        <span className={`inline-flex min-w-10 justify-center rounded-full border px-2 py-1 font-mono text-xs font-semibold ${rankTone}`}>
          #{user.rank}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.displayName} index={user.rank} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-stone-950">{user.displayName}</p>
            <p className="truncate text-xs text-stone-500">{user.team}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono font-semibold text-stone-950">{formatTokens(user.tokens)}</td>
      <td className="px-4 py-3 text-right font-mono text-stone-600">{formatUsd(user.costUsd)}</td>
      <td className="px-4 py-3 text-right font-mono text-stone-600">{formatNumber(user.sessions)}</td>
      <td className="px-4 py-3 text-right font-mono text-stone-600">{formatNumber(user.messages)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-stone-950/10 bg-[#f5efe4] px-2 py-1 text-xs font-semibold text-stone-700">
            {user.topModel}
          </span>
          {user.deltaTokens !== null ? (
            <span className={`font-mono text-xs font-semibold ${user.deltaTokens >= 0 ? "text-[#26745e]" : "text-[#c05c38]"}`}>
              {user.deltaTokens >= 0 ? "+" : ""}
              {formatPercent(user.deltaTokens)}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function LeaderboardLoadingRow() {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-12">
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-stone-950/8 bg-[#f8f2e8] p-6 text-center">
          <span className="size-7 rounded-full border-2 border-stone-950/15 border-t-[#26745e] motion-safe:animate-spin" />
          <div>
            <p className="font-semibold text-stone-950">Loading 真实用户数据</p>
            <p className="mt-1 text-xs text-stone-500">数据没回来前不会展示示例排行榜</p>
          </div>
        </div>
      </td>
    </tr>
  );
}

function LeaderboardEmptyRow() {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">
        暂无真实用户数据
      </td>
    </tr>
  );
}

function ShareRow({ user }: { user: TokenLeaderboardUser }) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_5rem] items-center gap-3">
      <Avatar name={user.displayName} index={user.rank} />
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{user.displayName}</p>
          <p className="font-mono text-xs font-semibold text-stone-500">{formatPercent(user.share)}</p>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/80 shadow-inner">
          <div
            className="h-full rounded-full bg-[#26745e]"
            style={{ width: `${Math.max(2, user.share * 100)}%` }}
          />
        </div>
      </div>
      <p className="text-right font-mono text-sm font-semibold">{formatTokens(user.tokens)}</p>
    </div>
  );
}

function ShareLoadingRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="grid grid-cols-[2.25rem_minmax(0,1fr)_5rem] items-center gap-3">
          <span className="size-9 rounded-xl bg-white/80 motion-safe:animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-2/3 rounded-full bg-white/85 motion-safe:animate-pulse" />
            <div className="h-2 rounded-full bg-white/75 motion-safe:animate-pulse" />
          </div>
          <div className="h-3 rounded-full bg-white/80 motion-safe:animate-pulse" />
        </div>
      ))}
    </>
  );
}

function TrendLoadingBars() {
  const heights = [28, 42, 35, 58, 46, 64, 38, 52, 72, 44, 60, 50, 68, 40, 56, 76, 48, 62, 54, 70, 45, 59, 66, 51];

  return (
    <>
      {heights.map((height, index) => (
        <div key={index} className="flex h-full items-end">
          <div
            className="w-full rounded-t-[3px] bg-stone-950/12 motion-safe:animate-pulse"
            style={{ height: `${height}%` }}
          />
        </div>
      ))}
    </>
  );
}

function EmptyPanelMessage() {
  return <p className="rounded-xl border border-stone-950/8 bg-white/60 px-3 py-4 text-center text-sm text-stone-500">暂无真实数据</p>;
}

function BreakdownPanel({
  title,
  items,
  loading = false,
}: {
  title: string;
  items: Array<{ name: string; value: number; meta: string; share: number }>;
  loading?: boolean;
}) {
  return (
    <section className="rounded-[1.25rem] border border-stone-950/10 bg-[#fffdfa] p-4 shadow-[0_18px_65px_-58px_rgba(28,25,23,0.6)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="font-mono text-xs text-stone-500">{loading ? "Loading" : items.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {loading ? <BreakdownLoadingRows /> : items.length ? items.slice(0, 8).map((item) => (
          <div key={item.name}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="truncate font-medium">{item.name}</p>
              <p className="shrink-0 font-mono text-stone-500">{formatTokens(item.value)}</p>
            </div>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3">
              <div className="h-2 overflow-hidden rounded-full bg-[#f0e6d7]">
                <div className="h-full rounded-full bg-[#2f6387]" style={{ width: `${Math.max(2, item.share * 100)}%` }} />
              </div>
              <p className="truncate text-right text-xs text-stone-500">{item.meta}</p>
            </div>
          </div>
        )) : <EmptyPanelMessage />}
      </div>
    </section>
  );
}

function BreakdownLoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="h-3 w-1/2 rounded-full bg-stone-950/10 motion-safe:animate-pulse" />
            <div className="h-3 w-14 rounded-full bg-stone-950/10 motion-safe:animate-pulse" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3">
            <div className="h-2 rounded-full bg-stone-950/10 motion-safe:animate-pulse" />
            <div className="h-3 rounded-full bg-stone-950/10 motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </>
  );
}

function ActionButton({
  children,
  icon,
  variant = "primary",
  onClick,
}: {
  children: string;
  icon: "download" | "refresh" | "upload";
  variant?: "primary" | "secondary";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
        variant === "primary"
          ? "bg-[#11130f] text-white hover:bg-[#26745e]"
          : "border border-stone-950/15 bg-white text-stone-700 hover:border-[#26745e]/40 hover:bg-[#eef7f2]"
      }`}
    >
      <Icon name={icon} />
      {children}
    </button>
  );
}

function GitHubAuthControl({
  viewer,
  onLogin,
  onLogout,
}: {
  viewer: ViewerState | null;
  onLogin: () => void;
  onLogout: () => void;
}) {
  if (!viewer) {
    return null;
  }

  if (viewer.authenticated) {
    return (
      <button
        type="button"
        onClick={onLogout}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/15 xl:w-auto"
      >
        <Icon name="github" />
        @{viewer.user?.githubLogin || viewer.user?.displayName || "GitHub"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onLogin}
      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#f8f1e5] px-3 text-sm font-semibold text-[#11130f] transition hover:bg-[#fff2d6] xl:w-auto"
    >
      <Icon name="github" />
      GitHub 登录
    </button>
  );
}

function Avatar({ name, index }: { name: string; index: number }) {
  const tones = [
    "bg-[#eaf5ef] text-[#163d33] ring-[#26745e]/20",
    "bg-[#e9f1f4] text-[#183447] ring-[#2f6387]/20",
    "bg-[#fff2d6] text-[#5a3419] ring-[#b06a2c]/20",
    "bg-[#f7e4dc] text-[#7b2f1d] ring-[#c05c38]/20",
    "bg-[#ede7d9] text-stone-700 ring-stone-950/10",
  ];

  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ${tones[index % tones.length]}`}
      aria-hidden="true"
    >
      {name.trim().slice(0, 1).toUpperCase() || "U"}
    </span>
  );
}

function Icon({ name }: { name: "download" | "file" | "github" | "refresh" | "upload" }) {
  const paths = {
    download: "M12 3v10m0 0 4-4m-4 4-4-4M5 17v2h14v-2",
    file: "M7 3h7l4 4v14H7V3Zm7 0v5h5",
    github:
      "M15 22v-3.8a3.3 3.3 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.1-.4-3.7 1.4a12.7 12.7 0 0 0-6.7 0C5.7 1.3 4.6 1.7 4.6 1.7a4.8 4.8 0 0 0-.1 3.6A5.2 5.2 0 0 0 3.1 9c0 5.2 3.1 6.4 6.1 6.7a3 3 0 0 0-.8 1.9c-.8.4-2.8 1-4-1.1 0 0-.7-1.3-2.1-1.4 0 0-1.3 0-.1.8 0 0 .9.4 1.5 2 0 0 .8 2.4 4.6 1.6V22",
    refresh: "M4 12a8 8 0 0 1 13.5-5.8M20 12a8 8 0 0 1-13.5 5.8M17 3v4h4M7 21v-4H3",
    upload: "M12 21V11m0 0-4 4m4-4 4 4M5 7V5h14v2",
  };

  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function formatTokens(value: number) {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `${formatCompact(value / 1_000_000_000)}B`;
  }

  if (absValue >= 1_000_000) {
    return `${formatCompact(value / 1_000_000)}M`;
  }

  if (absValue >= 1_000) {
    return `${formatCompact(value / 1_000)}K`;
  }

  return formatNumber(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUsd(value: number) {
  if (value >= 1_000) {
    return `$${formatCompact(value / 1_000)}K`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatRankDelta(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value === 0) {
    return "0";
  }

  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function rankDeltaTone(value: number | null) {
  if (value === null || value === 0) {
    return "text-white/52";
  }

  return value > 0 ? "text-[#bdf5cc]" : "text-[#ffb39d]";
}

function heatColor(intensity: number) {
  if (intensity <= 0) {
    return "rgba(255,255,255,0.06)";
  }

  if (intensity < 0.18) {
    return "#123127";
  }

  if (intensity < 0.38) {
    return "#1f684b";
  }

  if (intensity < 0.62) {
    return "#2ca965";
  }

  if (intensity < 0.82) {
    return "#43d184";
  }

  return "#bdf5cc";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

type RemoteStatsResponse =
  | (TokenLeaderboardSummary & { records?: number })
  | {
      records?: number;
      summary?: TokenLeaderboardSummary;
    };

type AccountUsageResponse = {
  profile?: TokenAccountUsageProfile;
};

function normalizeApiBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") || "";
}

function isTokenLeaderboardSummary(value: unknown): value is TokenLeaderboardSummary {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Array.isArray((value as TokenLeaderboardSummary).users) &&
    Array.isArray((value as TokenLeaderboardSummary).daily)
  );
}

function isTokenAccountUsageProfile(value: unknown): value is TokenAccountUsageProfile {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Array.isArray((value as TokenAccountUsageProfile).daily) &&
    Array.isArray((value as TokenAccountUsageProfile).models) &&
    Array.isArray((value as TokenAccountUsageProfile).tools) &&
    Array.isArray((value as TokenAccountUsageProfile).projects) &&
    Array.isArray((value as TokenAccountUsageProfile).heatmap)
  );
}

type ViewerState = {
  authenticated: boolean;
  user?: {
    userId?: string;
    displayName?: string;
    githubLogin?: string;
    avatarUrl?: string;
  };
};

type DataLoadState = "loading" | "ready";
type AccountLoadState = "error" | "idle" | "loading" | "ready";
