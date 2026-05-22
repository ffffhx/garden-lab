"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_SNAPSHOT_URL = "http://127.0.0.1:4321/";
const DEFAULT_STANDALONE_HREF = "/snapshots/viewer/";

type ConnectionState = "checking" | "ready" | "unavailable";

type CodexSnapshotModuleProps = {
  snapshotUrl?: string;
  standaloneHref?: string;
};

export function CodexSnapshotModule({
  snapshotUrl,
  standaloneHref = DEFAULT_STANDALONE_HREF,
}: CodexSnapshotModuleProps) {
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
      ? "bg-emerald-300"
      : connection === "checking"
        ? "bg-amber-300"
        : "bg-rose-300";

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
          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <Link
              href="/snapshots/share/"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-950/12 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-950/25 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#1d6f78]/15"
            >
              云端分享页
            </Link>
            <Link
              href={standaloneHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold !text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.8)] transition hover:-translate-y-0.5 hover:bg-[#8f3f18] focus:outline-none focus:ring-4 focus:ring-[#b45f28]/20"
            >
              打开独立窗口
            </Link>
          </div>
        </div>

        <div className="border-b border-slate-900/10 bg-slate-950 px-5 py-3 text-sm text-slate-200">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 font-semibold">
              <span className={`size-2 rounded-full ${statusDot}`} aria-hidden="true" />
              {statusLabel}
            </span>
            <code className="min-w-0 truncate rounded-full border border-white/10 bg-white/8 px-3 py-1 font-mono text-xs text-slate-300">
              {viewerUrl}
            </code>
            {connection === "unavailable" ? (
              <button
                type="button"
                onClick={() => setCheckVersion((value) => value + 1)}
                className="inline-flex min-h-8 items-center rounded-full border border-white/12 bg-white/8 px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/14"
              >
                重新检测
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative bg-[#f4f0e7]">
          {connection === "unavailable" ? (
            <div className="grid min-h-[680px] place-items-center px-6 py-12">
              <div className="max-w-2xl rounded-[1.25rem] border border-slate-900/10 bg-[#fffdf7]/92 p-6 text-slate-800 shadow-[0_24px_90px_-64px_rgba(15,23,42,0.65)]">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1d6f78]">
                  Local Data Boundary
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  线上页面不会保存你的会话数据
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-700">
                  这里链接本机地址，是为了让公开部署的博客只作为入口，真正的 Codex /
                  Claude Code / Trae 会话仍由你电脑上的只读 Snapshot 服务提供。
                </p>
                <p className="mt-3 text-base leading-8 text-slate-700">
                  要查看内容，请在本机仓库里启动：
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
              <div className="flex items-center gap-3 rounded-full border border-slate-900/10 bg-white/85 px-5 py-3 text-sm font-semibold text-slate-700 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.6)]">
                <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#1d6f78]" />
                正在加载 Snapshot
              </div>
            </div>
          ) : null}
          {isReady ? (
            <iframe
              title="Codex Snapshot Viewer"
              src={viewerUrl}
              className="h-[calc(100vh-18rem)] min-h-[680px] w-full border-0 bg-[#f4f0e7]"
              onLoad={() => setFrameLoaded(true)}
            />
          ) : null}
        </div>
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
