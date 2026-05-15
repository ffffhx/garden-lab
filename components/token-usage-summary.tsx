"use client";

import { useEffect, useMemo, useState } from "react";

import type { TokenUsagePeriodKey, TokenUsageSnapshot } from "@/lib/content/token-usage";
import { withBasePath } from "@/lib/utils/site-path";

const PERIODS: Array<{ key: TokenUsagePeriodKey; label: string; range: string }> = [
  { key: "today", label: "今日", range: "今天 00:00 到现在" },
  { key: "week", label: "本周", range: "本周一 00:00 到现在" },
  { key: "month", label: "本月", range: "本月 1 日 00:00 到现在" },
];

export function TokenUsageSummary({
  initialSnapshot,
}: {
  initialSnapshot: TokenUsageSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    let active = true;

    fetch(withBasePath("/stats/token-usage.json"), { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load token usage: ${response.status}`);
        }

        return response.json() as Promise<TokenUsageSnapshot>;
      })
      .then((nextSnapshot) => {
        if (active) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch(() => {
        // Keep the build-time snapshot if runtime refresh is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  const updatedAt = useMemo(
    () => formatUpdatedAt(snapshot.updatedAt),
    [snapshot.updatedAt]
  );

  return (
    <div className="space-y-3" aria-label="Token 使用量">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PERIODS.map((period) => (
          <div
            key={period.key}
            className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 shadow-[0_18px_60px_-42px_rgba(255,255,255,0.5)]"
          >
            <p className="text-xs font-medium text-white/68">{period.label}</p>
            <p className="mt-2 text-3xl font-semibold leading-none tracking-normal text-white tabular-nums">
              {formatTokenCount(snapshot.periods[period.key].totalTokens)}
            </p>
            <p className="mt-2 text-xs font-medium text-white/58">tokens</p>
          </div>
        ))}
        <div className="rounded-lg border border-emerald-200/20 bg-emerald-200/10 px-4 py-3 shadow-[0_18px_60px_-42px_rgba(255,255,255,0.5)]">
          <p className="text-xs font-medium text-white/68">本月估算</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-normal text-white tabular-nums">
            {formatUsd(snapshot.periods.month.estimatedCostUsd)}
          </p>
          <p className="mt-2 text-xs font-medium text-white/58">USD</p>
        </div>
      </div>
      <div className="rounded-lg border border-white/12 bg-slate-950/35 px-4 py-3 font-mono text-sm leading-7 text-white/72">
        {PERIODS.map((period) => (
          <p key={`${period.key}-range`} className="flex flex-wrap gap-x-3">
            <span className="min-w-14 font-semibold text-white/90">{period.key}:</span>
            <span>{period.range}</span>
          </p>
        ))}
      </div>
      <p className="text-xs leading-5 text-white/58">更新于 {updatedAt}</p>
    </div>
  );
}

function formatTokenCount(value: number) {
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

  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
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

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date.getTime() === 0) {
    return "等待同步";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}
