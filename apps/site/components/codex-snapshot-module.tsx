"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const DEFAULT_SNAPSHOT_URL = "http://127.0.0.1:4321/";

type CodexSnapshotModuleProps = {
  snapshotUrl?: string;
};

export function CodexSnapshotModule({ snapshotUrl }: CodexSnapshotModuleProps) {
  const viewerUrl = useMemo(() => normalizeSnapshotUrl(snapshotUrl), [snapshotUrl]);
  const [loaded, setLoaded] = useState(false);

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/86 shadow-[0_32px_120px_-68px_rgba(15,23,42,0.65)]">
        <div className="flex flex-col gap-5 border-b border-slate-900/10 bg-[#fffdf7]/90 p-6 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1d6f78]">
              Private Module
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Codex Snapshots
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700">
              本地只读会话审阅台，挂在站点里但数据仍从你的机器读取。
            </p>
          </div>
          <Link
            href={viewerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold !text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.8)] transition hover:-translate-y-0.5 hover:bg-[#8f3f18] focus:outline-none focus:ring-4 focus:ring-[#b45f28]/20"
          >
            打开独立窗口
          </Link>
        </div>

        <div className="border-b border-slate-900/10 bg-slate-950 px-5 py-3 text-sm text-slate-200">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 font-semibold">
              <span
                className={`size-2 rounded-full ${loaded ? "bg-emerald-300" : "bg-amber-300"}`}
                aria-hidden="true"
              />
              {loaded ? "已连接" : "加载中"}
            </span>
            <code className="min-w-0 truncate rounded-full border border-white/10 bg-white/8 px-3 py-1 font-mono text-xs text-slate-300">
              {viewerUrl}
            </code>
          </div>
        </div>

        <div className="relative bg-[#f4f0e7]">
          {!loaded ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4f0e7]">
              <div className="flex items-center gap-3 rounded-full border border-slate-900/10 bg-white/85 px-5 py-3 text-sm font-semibold text-slate-700 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.6)]">
                <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#1d6f78]" />
                正在加载 Snapshot
              </div>
            </div>
          ) : null}
          <iframe
            title="Codex Snapshot Viewer"
            src={viewerUrl}
            className="h-[calc(100vh-18rem)] min-h-[680px] w-full border-0 bg-[#f4f0e7]"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </section>
    </main>
  );
}

function normalizeSnapshotUrl(value: string | undefined) {
  const normalized = value?.trim() || DEFAULT_SNAPSHOT_URL;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}
