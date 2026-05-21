"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const DEFAULT_SNAPSHOT_URL = "http://127.0.0.1:4321/";

type CodexSnapshotStandaloneViewerProps = {
  snapshotUrl?: string;
};

export function CodexSnapshotStandaloneViewer({
  snapshotUrl,
}: CodexSnapshotStandaloneViewerProps) {
  const viewerUrl = useMemo(() => normalizeSnapshotUrl(snapshotUrl), [snapshotUrl]);
  const [loaded, setLoaded] = useState(false);

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f0e7] text-slate-950">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-950/15 bg-[#fffdf7] px-5 py-3 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.7)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1d6f78]">
            Codex Snapshots
          </span>
          <span className="hidden h-5 w-px bg-slate-950/15 sm:block" aria-hidden="true" />
          <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700">
            <span
              className={`size-2 rounded-full ${loaded ? "bg-emerald-400" : "bg-amber-400"}`}
              aria-hidden="true"
            />
            {loaded ? "已连接" : "加载中"}
          </span>
          <code className="hidden max-w-[38vw] truncate rounded-full border border-slate-950/10 bg-white/75 px-3 py-1 font-mono text-xs text-slate-500 md:block">
            {viewerUrl}
          </code>
        </div>
        <Link
          href="/snapshots/"
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-950/10 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-950/20 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#1d6f78]/15"
        >
          返回模块
        </Link>
      </header>

      <section className="relative min-h-0 flex-1">
        {!loaded ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4f0e7]">
            <div className="flex items-center gap-3 rounded-full border border-slate-900/10 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-700 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.6)]">
              <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#1d6f78]" />
              正在加载 Snapshot
            </div>
          </div>
        ) : null}
        <iframe
          title="Codex Snapshot Viewer"
          src={viewerUrl}
          className="h-[calc(100vh-3.5rem)] w-full border-0 bg-[#f4f0e7]"
          onLoad={() => setLoaded(true)}
        />
      </section>
    </main>
  );
}

function normalizeSnapshotUrl(value: string | undefined) {
  const normalized = value?.trim() || DEFAULT_SNAPSHOT_URL;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}
