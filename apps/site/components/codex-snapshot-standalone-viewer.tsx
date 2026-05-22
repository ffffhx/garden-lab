"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_SNAPSHOT_URL = "http://127.0.0.1:4321/";

type ConnectionState = "checking" | "ready" | "unavailable";

type CodexSnapshotStandaloneViewerProps = {
  snapshotUrl?: string;
};

export function CodexSnapshotStandaloneViewer({
  snapshotUrl,
}: CodexSnapshotStandaloneViewerProps) {
  const viewerUrl = useMemo(() => normalizeSnapshotUrl(snapshotUrl), [snapshotUrl]);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const isReady = connection === "ready";

  useEffect(() => {
    let isActive = true;

    setConnection("checking");
    setFrameLoaded(false);

    pingSnapshotUrl(viewerUrl).then((ok) => {
      if (!isActive) {
        return;
      }

      setConnection(ok ? "ready" : "unavailable");
    });

    return () => {
      isActive = false;
    };
  }, [viewerUrl, checkVersion]);

  const statusLabel =
    connection === "ready"
      ? "本机服务已连接"
      : connection === "checking"
        ? "正在检测本机服务"
        : "未连接本机服务";
  const statusDot =
    connection === "ready"
      ? "bg-emerald-400"
      : connection === "checking"
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f0e7] text-slate-950">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-950/15 bg-[#fffdf7] px-5 py-3 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.7)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1d6f78]">
            Codex Snapshots
          </span>
          <span className="hidden h-5 w-px bg-slate-950/15 sm:block" aria-hidden="true" />
          <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700">
            <span className={`size-2 rounded-full ${statusDot}`} aria-hidden="true" />
            {statusLabel}
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
        {connection === "unavailable" ? (
          <div className="grid min-h-[calc(100vh-3.5rem)] place-items-center px-6 py-12">
            <div className="max-w-2xl rounded-[1.25rem] border border-slate-900/10 bg-[#fffdf7]/92 p-6 text-slate-800 shadow-[0_24px_90px_-64px_rgba(15,23,42,0.65)]">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1d6f78]">
                Local Data Boundary
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                需要连接你本机的 Snapshot 服务
              </h1>
              <p className="mt-4 text-base leading-8 text-slate-700">
                这个独立窗口只是站内壳层。会话数据不会部署到 GitHub Pages，
                也不会上传到博客服务器；它只会读取你电脑上的本地服务。
              </p>
              <code className="mt-4 block overflow-x-auto rounded-lg border border-slate-900/10 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100">
                pnpm snapshot serve --port 4321
              </code>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCheckVersion((value) => value + 1)}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-[#8f3f18]"
                >
                  重新检测
                </button>
                <a
                  href={viewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-900/12 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-900/25 hover:text-slate-950"
                >
                  打开本机地址
                </a>
              </div>
            </div>
          </div>
        ) : null}
        {isReady && !frameLoaded ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4f0e7]">
            <div className="flex items-center gap-3 rounded-full border border-slate-900/10 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-700 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.6)]">
              <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#1d6f78]" />
              正在加载 Snapshot
            </div>
          </div>
        ) : null}
        {isReady ? (
          <iframe
            title="Codex Snapshot Viewer"
            src={viewerUrl}
            className="h-[calc(100vh-3.5rem)] w-full border-0 bg-[#f4f0e7]"
            onLoad={() => setFrameLoaded(true)}
          />
        ) : null}
      </section>
    </main>
  );
}

function normalizeSnapshotUrl(value: string | undefined) {
  const normalized = value?.trim() || DEFAULT_SNAPSHOT_URL;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

async function pingSnapshotUrl(url: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);

  try {
    await fetch(url, {
      cache: "no-store",
      mode: "no-cors",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
