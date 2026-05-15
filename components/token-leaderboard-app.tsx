"use client";

import { useEffect, useMemo, useState } from "react";

import {
  TOKEN_LEADERBOARD_STORAGE_KEY,
  buildTokenLeaderboard,
  createDemoTokenEntries,
  dedupeTokenEvents,
  parseTokenUsageImport,
  type TokenBoardMetric,
  type TokenBoardRange,
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

const SAMPLE_CSV = `user,displayName,team,tool,model,project,timestamp,inputTokens,cachedInputTokens,outputTokens,reasoningOutputTokens,totalTokens,messages
you,You,Friends,Codex CLI,gpt-5.5,token-board,2026-05-14T10:30:00+08:00,620000,220000,58000,9000,907000,34`;
const NPX_SYNC_COMMAND = "npx --yes --package github:ffffhx/blog#main token-board-agent";
const NPX_WATCH_COMMAND = "npx --yes --package github:ffffhx/blog#main token-board-agent watch";

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
  const [status, setStatus] = useState("已加载示例数据");
  const [loadedSource, setLoadedSource] = useState("demo");
  const [now, setNow] = useState(() => new Date(initialNow));
  const [remoteSummary, setRemoteSummary] = useState<TokenLeaderboardSummary | null>(null);
  const [remoteRecordCount, setRemoteRecordCount] = useState<number | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);

  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    let active = true;

    const localValue = window.localStorage.getItem(TOKEN_LEADERBOARD_STORAGE_KEY);

    if (localValue) {
      const parsed = parseTokenUsageImport(localValue);
      if (parsed.entries.length) {
        setEntries(parsed.entries);
        setLoadedSource("local");
        setStatus(`本地数据 ${parsed.entries.length} 条`);
        return;
      }
    }

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
        }
      })
      .catch(() => {
        if (active) {
          setStatus("使用内置示例数据");
        }
      });

    return () => {
      active = false;
    };
  }, [initialEntries]);

  useEffect(() => {
    if (!normalizedApiBaseUrl) {
      setRemoteSummary(null);
      setRemoteRecordCount(null);
      return;
    }

    let active = true;
    const params = new URLSearchParams({ range, metric });

    setStatus("正在读取后端数据");
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
        setStatus(`后端数据 ${typeof payload.records === "number" ? payload.records : summary.users.length} 条`);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setRemoteSummary(null);
        setRemoteRecordCount(null);
        setLoadedSource("local");
        setStatus(`后端不可用，使用本地数据：${error instanceof Error ? error.message : "读取失败"}`);
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

  const localSummary = useMemo(
    () => buildTokenLeaderboard(entries, { range, metric, now }),
    [entries, metric, now, range]
  );
  const summary = remoteSummary ?? localSummary;
  const recordCount = remoteRecordCount ?? entries.length;
  const sourceLabel = remoteSummary ? "server" : loadedSource;
  const statusMessage = remoteSummary ? `后端数据 ${recordCount} 条` : status;

  const topUsers = summary.users.slice(0, 8);
  const maxDailyTokens = Math.max(1, ...summary.daily.map((point) => point.tokens));

  function importText(text: string, mode: "replace" | "merge" = "merge") {
    const parsed = parseTokenUsageImport(text);

    if (!parsed.entries.length) {
      setStatus(parsed.errors[0] ?? "导入失败");
      return;
    }

    const nextEntries = mode === "replace" ? parsed.entries : dedupeTokenEvents([...entries, ...parsed.entries]);
    setEntries(nextEntries);
    window.localStorage.setItem(
      TOKEN_LEADERBOARD_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, updatedAt: new Date().toISOString(), entries: nextEntries }, null, 2)
    );
    setLoadedSource("local");
    setStatus(`已导入 ${parsed.entries.length} 条，当前 ${nextEntries.length} 条`);
    setDraft("");
  }

  async function importFile(file: File | undefined) {
    if (!file) {
      return;
    }

    importText(await file.text());
  }

  function resetToDemo() {
    const demoEntries = createDemoTokenEntries(new Date());
    setEntries(demoEntries);
    window.localStorage.removeItem(TOKEN_LEADERBOARD_STORAGE_KEY);
    setLoadedSource("demo");
    setStatus(`已恢复示例数据 ${demoEntries.length} 条`);
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
    <main className="font-sans text-slate-950">
      <section className="overflow-hidden rounded-3xl border border-slate-900/10 bg-white shadow-[0_30px_100px_-70px_rgba(15,23,42,0.55)]">
        <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-emerald-200">Open Token Board</p>
              <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">朋友间的 Token 排行榜</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GitHubAuthControl viewer={viewer} onLogin={loginWithGitHub} onLogout={logoutGitHub} />
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

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6 p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="总 Tokens" value={formatTokens(summary.totalTokens)} tone="slate" />
              <StatTile label="活跃用户" value={formatNumber(summary.activeUsers)} tone="emerald" />
              <StatTile label="会话" value={formatNumber(summary.totalSessions)} tone="blue" />
              <StatTile label="估算费用" value={formatUsd(summary.totalCostUsd)} tone="amber" />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div>
                    <h2 className="text-base font-semibold">排行榜</h2>
                    <p className="text-xs text-slate-500">
                      {formatShortDate(summary.startAt)} - {formatShortDate(summary.endAt)}
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {sourceLabel}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">排名</th>
                        <th className="px-4 py-3 font-medium">用户</th>
                        <th className="px-4 py-3 text-right font-medium">Tokens</th>
                        <th className="px-4 py-3 text-right font-medium">费用</th>
                        <th className="px-4 py-3 text-right font-medium">会话</th>
                        <th className="px-4 py-3 text-right font-medium">消息</th>
                        <th className="px-4 py-3 font-medium">常用模型</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.users.map((user) => (
                        <LeaderboardRow key={user.userId} user={user} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Top 使用者</h2>
                  <span className="text-xs text-slate-500">{topUsers.length} 人</span>
                </div>
                <div className="mt-4 space-y-3">
                  {topUsers.map((user) => (
                    <div key={user.userId} className="grid grid-cols-[2rem_minmax(0,1fr)_5rem] items-center gap-3">
                      <Avatar name={user.displayName} index={user.rank} />
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{user.displayName}</p>
                          <p className="text-xs font-medium text-slate-500">{formatPercent(user.share)}</p>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded bg-white">
                          <div
                            className="h-full rounded bg-emerald-500"
                            style={{ width: `${Math.max(2, user.share * 100)}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-right font-mono text-sm">{formatTokens(user.tokens)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Token 趋势</h2>
                  <p className="text-xs text-slate-500">峰值 {formatTokens(maxDailyTokens)}</p>
                </div>
                <div className="mt-4 grid h-56 grid-cols-[repeat(auto-fit,minmax(8px,1fr))] items-end gap-1 border-b border-slate-200 pt-4">
                  {summary.daily.map((point) => (
                    <div key={point.date} className="flex h-full items-end">
                      <div
                        className="w-full rounded-t bg-slate-800 transition hover:bg-emerald-500"
                        title={`${point.date} ${formatTokens(point.tokens)}`}
                        style={{ height: `${Math.max(3, (point.tokens / maxDailyTokens) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>{summary.daily[0]?.date.slice(5) ?? "--"}</span>
                  <span>{summary.daily.at(-1)?.date.slice(5) ?? "--"}</span>
                </div>
              </section>

              <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <BreakdownPanel title="模型消耗" items={summary.models.map((item) => ({
                  name: item.name,
                  value: item.tokens,
                  meta: formatUsd(item.costUsd),
                  share: item.share,
                }))} />
                <BreakdownPanel title="工具分布" items={summary.tools.map((item) => ({
                  name: item.name,
                  value: item.tokens,
                  meta: `${formatNumber(item.sessions)} 会话`,
                  share: item.share,
                }))} />
              </section>
            </div>
          </div>

          <aside className="border-t border-slate-200 bg-slate-50 p-5 sm:p-7 xl:border-l xl:border-t-0">
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">数据入口</h2>
                  <span className="text-xs text-slate-500">{recordCount} 条</span>
                </div>
                <div className="mt-4 space-y-3">
              {normalizedApiBaseUrl ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
                  <p className="font-semibold">自动上报已启用</p>
                  <p className="mt-1 break-all font-mono">{normalizedApiBaseUrl}/api/usage/ingest</p>
                  <p className="mt-2 text-emerald-800">
                    {viewer?.authenticated
                      ? `GitHub 已登录：@${viewer.user?.githubLogin || viewer.user?.displayName}`
                      : "网页端可使用 GitHub 登录；本机统计使用 npx agent。"}
                  </p>
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-white/70 p-2">
                    <p className="text-[11px] font-semibold text-emerald-800">首次统计</p>
                    <code className="mt-1 block break-all font-mono text-[11px] leading-5 text-emerald-950">
                      {NPX_SYNC_COMMAND}
                    </code>
                  </div>
                  <p className="mt-2 break-all text-[11px] text-emerald-800">
                    持续同步：<code className="font-mono">{NPX_WATCH_COMMAND}</code>
                  </p>
                </div>
              ) : null}
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">CSV / JSON</span>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={SAMPLE_CSV}
                      className="mt-2 min-h-40 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton icon="upload" onClick={() => importText(draft)}>
                      导入
                    </ActionButton>
                    <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
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
                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton icon="refresh" variant="secondary" onClick={resetToDemo}>
                      示例
                    </ActionButton>
                    <ActionButton icon="download" variant="secondary" onClick={exportJson}>
                      导出
                    </ActionButton>
                  </div>
                  <p className="min-h-5 text-xs text-slate-500" aria-live="polite">
                    {statusMessage}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-semibold">上报字段</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
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
                    <code key={field} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                      {field}
                    </code>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </section>
    </main>
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
    <div className="inline-flex rounded-lg border border-white/15 bg-white/10 p-1" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={value === item.key}
          onClick={() => onChange(item.key)}
          className={`min-h-9 rounded-md px-3 text-sm font-semibold transition ${
            value === item.key ? "bg-white text-slate-950" : "text-white/78 hover:bg-white/10 hover:text-white"
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
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "blue" | "amber";
}) {
  const tones = {
    slate: "bg-slate-950 text-white",
    emerald: "bg-emerald-50 text-emerald-950",
    blue: "bg-sky-50 text-sky-950",
    amber: "bg-amber-50 text-amber-950",
  };

  return (
    <div className={`rounded-2xl border border-slate-200 p-4 ${tones[tone]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold">{value}</p>
    </div>
  );
}

function LeaderboardRow({ user }: { user: TokenLeaderboardUser }) {
  return (
    <tr className="transition hover:bg-slate-50">
      <td className="px-4 py-3 font-mono text-sm text-slate-500">#{user.rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.displayName} index={user.rank} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.displayName}</p>
            <p className="truncate text-xs text-slate-500">{user.team}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono font-semibold">{formatTokens(user.tokens)}</td>
      <td className="px-4 py-3 text-right font-mono text-slate-600">{formatUsd(user.costUsd)}</td>
      <td className="px-4 py-3 text-right font-mono text-slate-600">{formatNumber(user.sessions)}</td>
      <td className="px-4 py-3 text-right font-mono text-slate-600">{formatNumber(user.messages)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {user.topModel}
          </span>
          {user.deltaTokens !== null ? (
            <span className={`text-xs font-medium ${user.deltaTokens >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {user.deltaTokens >= 0 ? "+" : ""}
              {formatPercent(user.deltaTokens)}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function BreakdownPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; value: number; meta: string; share: number }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.slice(0, 8).map((item) => (
          <div key={item.name}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="truncate font-medium">{item.name}</p>
              <p className="shrink-0 font-mono text-slate-500">{formatTokens(item.value)}</p>
            </div>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3">
              <div className="h-2 overflow-hidden rounded bg-slate-100">
                <div className="h-full rounded bg-sky-600" style={{ width: `${Math.max(2, item.share * 100)}%` }} />
              </div>
              <p className="truncate text-right text-xs text-slate-500">{item.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
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
          ? "bg-slate-950 text-white hover:bg-emerald-700"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
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
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/15"
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
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100"
    >
      <Icon name="github" />
      GitHub 登录
    </button>
  );
}

function Avatar({ name, index }: { name: string; index: number }) {
  const tones = [
    "bg-emerald-100 text-emerald-900",
    "bg-sky-100 text-sky-900",
    "bg-amber-100 text-amber-900",
    "bg-rose-100 text-rose-900",
    "bg-violet-100 text-violet-900",
  ];

  return (
    <span
      className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${tones[index % tones.length]}`}
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

type ViewerState = {
  authenticated: boolean;
  user?: {
    userId?: string;
    displayName?: string;
    githubLogin?: string;
    avatarUrl?: string;
  };
};
