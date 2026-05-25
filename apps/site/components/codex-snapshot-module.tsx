"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_SNAPSHOT_URL = "http://127.0.0.1:4321/";
const DEFAULT_STANDALONE_HREF = "/snapshots/viewer/";

type ConnectionState = "checking" | "ready" | "unavailable";
type SyncState = "idle" | "syncing" | "done" | "error";

type ActiveSnapshot = {
  selected: string;
  title: string;
  engineLabel: string;
  redacted: boolean;
  options: Record<string, string>;
};

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
  const [activeSnapshot, setActiveSnapshot] = useState<ActiveSnapshot | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const isReady = connection === "ready";

  useEffect(() => {
    let isActive = true;

    setConnection("checking");
    setFrameLoaded(false);
    setActiveSnapshot(null);
    setSyncState("idle");
    setSyncMessage("");
    setShareUrl("");

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

  useEffect(() => {
    const viewerOrigin = readOrigin(viewerUrl);

    function handleSnapshotMessage(event: MessageEvent) {
      if (viewerOrigin && event.origin !== viewerOrigin) {
        return;
      }
      const nextSnapshot = parseSnapshotBridgeMessage(event.data);
      if (!nextSnapshot) {
        return;
      }
      setActiveSnapshot(nextSnapshot);
      setSyncState("idle");
      setSyncMessage("");
      setShareUrl("");
    }

    window.addEventListener("message", handleSnapshotMessage);
    return () => window.removeEventListener("message", handleSnapshotMessage);
  }, [viewerUrl]);

  const handleSync = useCallback(async () => {
    if (!activeSnapshot) {
      setSyncState("error");
      setSyncMessage("请先在下方选择一条会话");
      return;
    }

    setSyncState("syncing");
    setSyncMessage("正在同步到云端...");
    setShareUrl("");

    try {
      const params = new URLSearchParams(activeSnapshot.options);
      params.set("id", activeSnapshot.selected);
      params.set("redact", "1");

      const publishUrl = new URL("/api/publish", viewerUrl);
      publishUrl.search = params.toString();

      const response = await fetch(publishUrl.toString(), {
        method: "POST",
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!response.ok) {
        throw new Error(result.error || "同步失败");
      }
      if (!result.url) {
        throw new Error("云端没有返回分享链接");
      }

      setShareUrl(result.url);
      setSyncState("done");
      setSyncMessage("已同步，分享链接已复制");
      await navigator.clipboard?.writeText(result.url).catch(() => undefined);
    } catch (error) {
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : String(error));
    }
  }, [activeSnapshot, viewerUrl]);

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
  const canSync = isReady && Boolean(activeSnapshot) && syncState !== "syncing";
  const syncButtonLabel = syncState === "syncing" ? "同步中..." : "同步";

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border border-slate-900/10 bg-white/86 shadow-[0_32px_120px_-68px_rgba(15,23,42,0.65)]">
        <div className="flex flex-col gap-2 border-b border-slate-900/10 bg-[#fffdf7]/90 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              Codex Snapshots
            </h1>
            <p className="text-xs leading-5 text-slate-600">
              本地只读会话审阅台，挂在站点里但数据仍从你的机器读取。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <button
              type="button"
              onClick={handleSync}
              disabled={!canSync}
              title={
                !isReady
                  ? "需要先连接本机 Snapshot 服务"
                  : activeSnapshot
                    ? `同步「${activeSnapshot.title}」`
                    : "请先在下方选择一条会话"
              }
              className="inline-flex min-h-8 items-center justify-center rounded-full bg-[#1d6f78] px-3 text-xs font-semibold text-white shadow-[0_18px_40px_-24px_rgba(29,111,120,0.8)] transition hover:-translate-y-0.5 hover:bg-[#165a62] focus:outline-none focus:ring-4 focus:ring-[#1d6f78]/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:hover:translate-y-0"
            >
              {syncButtonLabel}
            </button>
            <Link
              href="/snapshots/share/"
              className="inline-flex min-h-8 items-center justify-center rounded-full border border-slate-950/12 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-950/25 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#1d6f78]/15"
            >
              云端分享页
            </Link>
            <Link
              href={standaloneHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-8 items-center justify-center rounded-full bg-slate-950 px-3 text-xs font-semibold !text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.8)] transition hover:-translate-y-0.5 hover:bg-[#8f3f18] focus:outline-none focus:ring-4 focus:ring-[#b45f28]/20"
            >
              打开独立窗口
            </Link>
          </div>
        </div>

        <div className="border-b border-slate-900/10 bg-slate-950 px-4 py-1.5 text-xs text-slate-200">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 font-semibold">
              <span className={`size-2 rounded-full ${statusDot}`} aria-hidden="true" />
              {statusLabel}
            </span>
            <code className="min-w-0 truncate rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 font-mono text-[11px] text-slate-300">
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
            {activeSnapshot ? (
              <span className="min-w-0 truncate text-xs text-slate-400">
                当前：{activeSnapshot.title}
              </span>
            ) : null}
            {syncMessage ? (
              <span
                className={`min-w-0 truncate text-xs font-semibold ${
                  syncState === "error" ? "text-rose-200" : "text-emerald-200"
                }`}
              >
                {syncMessage}
              </span>
            ) : null}
            {shareUrl ? (
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-xs font-semibold text-sky-200 underline decoration-white/30 underline-offset-4 hover:text-white"
              >
                打开分享链接
              </a>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-[#f4f0e7]">
          {connection === "unavailable" ? (
            <div className="grid min-h-full place-items-center px-6 py-12">
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
              className="h-full min-h-0 w-full border-0 bg-[#f4f0e7]"
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

function readOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function parseSnapshotBridgeMessage(data: unknown): ActiveSnapshot | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const message = data as Record<string, unknown>;
  if (message.type !== "codex-snapshot:state" || message.version !== 1) {
    return null;
  }
  const selected = typeof message.selected === "string" ? message.selected : "";
  if (!selected) {
    return null;
  }
  const rawOptions = message.options;
  const options: Record<string, string> = {};
  if (rawOptions && typeof rawOptions === "object") {
    for (const [key, value] of Object.entries(rawOptions as Record<string, unknown>)) {
      if (typeof value === "string") {
        options[key] = value;
      }
    }
  }

  return {
    selected,
    title: typeof message.title === "string" && message.title ? message.title : selected,
    engineLabel:
      typeof message.engineLabel === "string" && message.engineLabel ? message.engineLabel : "Codex",
    redacted: Boolean(message.redacted),
    options,
  };
}
