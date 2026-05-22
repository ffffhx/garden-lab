"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LoadState = "idle" | "loading" | "ready" | "error";

type SnapshotShareResponse = {
  share?: {
    id: string;
    title: string;
    engine?: string;
    engineLabel?: string;
    createdAt?: string;
    updatedAt?: string;
    expiresAt?: string | null;
    redacted?: boolean;
    turnCount?: number;
  };
  snapshot?: SnapshotPayload;
  error?: string;
};

type SnapshotPayload = {
  id?: string;
  title?: string;
  engineLabel?: string;
  displayCwd?: string;
  generatedAt?: string;
  redacted?: boolean;
  includeTools?: boolean;
  includeToolOutput?: boolean;
  turns?: SnapshotTurn[];
};

type SnapshotTurn = {
  kind?: string;
  role?: string;
  name?: string;
  text?: string;
  html?: string;
  images?: SnapshotImage[];
};

type SnapshotImage = {
  alt?: string;
  mimeType?: string;
  size?: string;
  src?: string;
  unavailableReason?: string;
};

type CodexSnapshotCloudShareProps = {
  apiBaseUrl?: string;
};

export function CodexSnapshotCloudShare({ apiBaseUrl }: CodexSnapshotCloudShareProps) {
  const [shareId, setShareId] = useState("");
  const [state, setState] = useState<LoadState>("idle");
  const [payload, setPayload] = useState<SnapshotShareResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resolvedApiBaseUrl = useResolvedApiBaseUrl(apiBaseUrl);

  useEffect(() => {
    setShareId(new URLSearchParams(window.location.search).get("id")?.trim() || "");
  }, []);

  useEffect(() => {
    if (!shareId) {
      setState("idle");
      setPayload(null);
      return;
    }

    if (!resolvedApiBaseUrl) {
      setState("error");
      setError("缺少云端 Snapshot API 地址。请配置 NEXT_PUBLIC_SNAPSHOT_SHARE_API_URL 或 NEXT_PUBLIC_TOKEN_BOARD_API_URL。");
      return;
    }

    let active = true;
    const controller = new AbortController();

    setState("loading");
    setError("");
    setPayload(null);

    fetch(`${resolvedApiBaseUrl}/api/snapshots/${encodeURIComponent(shareId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as SnapshotShareResponse;

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
      })
      .then((data) => {
        if (!active) {
          return;
        }

        setPayload(data);
        setState("ready");
      })
      .catch((fetchError) => {
        if (!active || controller.signal.aborted) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        setState("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [resolvedApiBaseUrl, shareId]);

  const snapshot = payload?.snapshot;
  const share = payload?.share;
  const title = share?.title || snapshot?.title || "Cloud Snapshot";
  const turns = snapshot?.turns || [];
  const shareUrl = typeof window === "undefined" ? "" : window.location.href;

  async function copyShareUrl() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="snapshot-cloud mx-auto w-full max-w-[1460px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-900/10 bg-[#fffdf7]/88 shadow-[0_32px_120px_-72px_rgba(15,23,42,0.62)]">
        <header className="grid gap-5 border-b-[3px] border-slate-950 bg-[#f4f0e7] px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="font-mono text-xs font-black uppercase tracking-[0.08em] text-[#245d83]">
              Cloud Read-only Snapshot
            </p>
            <h1 className="mt-2 max-w-5xl text-4xl font-semibold leading-[0.98] tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              {title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {shareUrl ? (
              <button
                type="button"
                onClick={copyShareUrl}
                className="min-h-11 rounded-full bg-slate-950 px-5 font-mono text-xs font-black text-white transition hover:bg-[#8f3f18] focus:outline-none focus:ring-4 focus:ring-[#245d83]/15"
              >
                {copied ? "已复制" : "复制链接"}
              </button>
            ) : null}
            <Link
              href="/snapshots/"
              className="inline-flex min-h-11 items-center rounded-full border border-slate-950/12 bg-white px-5 font-mono text-xs font-black text-slate-700 transition hover:border-slate-950/25 hover:text-slate-950"
            >
              返回模块
            </Link>
          </div>
        </header>

        <section className="bg-[#f4f0e7] px-6 py-5 sm:px-8">
          {state === "idle" ? <EmptyState apiBaseUrl={resolvedApiBaseUrl} /> : null}
          {state === "loading" ? <LoadingState /> : null}
          {state === "error" ? <ErrorState message={error} /> : null}
          {state === "ready" && snapshot ? (
            <>
              <MetaBar share={share} snapshot={snapshot} apiBaseUrl={resolvedApiBaseUrl} />
              <Transcript turns={turns} />
            </>
          ) : null}
        </section>
      </section>
      <SnapshotCloudStyles />
    </main>
  );
}

function EmptyState({ apiBaseUrl }: { apiBaseUrl: string }) {
  return (
    <div className="grid min-h-[520px] place-items-center">
      <div className="w-full max-w-2xl rounded-[1.25rem] border border-slate-900/10 bg-[#fffdf7]/92 p-6 text-slate-800 shadow-[0_24px_90px_-64px_rgba(15,23,42,0.65)]">
        <p className="font-mono text-xs font-black uppercase tracking-[0.08em] text-[#245d83]">
          Waiting for share id
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          这个页面用来打开云端分享快照
        </h2>
        <p className="mt-4 text-base leading-8 text-slate-700">
          在本机发布一条会话后，链接会带上 <code>?id=...</code>，朋友打开这个页面就会从云端读取只读快照。
        </p>
        <code className="mt-4 block overflow-x-auto rounded-lg border border-slate-900/10 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100">
          pnpm snapshot publish &lt;session-id&gt; --api-url {apiBaseUrl || "https://your-api.example.com"}
        </code>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[520px] place-items-center">
      <div className="inline-flex items-center gap-3 rounded-full border border-slate-900/10 bg-white/90 px-5 py-3 font-mono text-sm font-black text-slate-700 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.6)]">
        <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#245d83]" />
        正在加载云端快照
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="grid min-h-[520px] place-items-center">
      <div className="w-full max-w-2xl rounded-[1.25rem] border border-red-900/10 bg-[#fff3ef] p-6 text-slate-800 shadow-[0_24px_90px_-64px_rgba(15,23,42,0.65)]">
        <p className="font-mono text-xs font-black uppercase tracking-[0.08em] text-[#ad3728]">
          Load failed
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          没有取到这份快照
        </h2>
        <p className="mt-4 overflow-wrap-anywhere text-base leading-8 text-slate-700">
          {message || "请确认链接里的 id 是否正确，或者云端 API 是否在线。"}
        </p>
      </div>
    </div>
  );
}

function MetaBar({
  share,
  snapshot,
  apiBaseUrl,
}: {
  share: SnapshotShareResponse["share"];
  snapshot: SnapshotPayload;
  apiBaseUrl: string;
}) {
  return (
    <div className="grid gap-3 border border-slate-950/10 bg-[#fffdf8]/82 p-4 font-mono text-sm font-black leading-6 text-slate-500 shadow-[0_24px_70px_-60px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <span>{share?.engineLabel || snapshot.engineLabel || "Codex"}</span>
        <span>|</span>
        <span>{share?.id || "unknown share"}</span>
        <span>|</span>
        <span>{snapshot.displayCwd || "cloud snapshot"}</span>
        <span>|</span>
        <span>{share?.turnCount ?? snapshot.turns?.length ?? 0} entries</span>
        <span>|</span>
        <span>redacted: {share?.redacted ?? snapshot.redacted ? "yes" : "no"}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span>updated {formatDate(share?.updatedAt || snapshot.generatedAt)}</span>
        {share?.expiresAt ? <span>expires {formatDate(share.expiresAt)}</span> : null}
        {apiBaseUrl ? <span className="min-w-0 truncate">api {apiBaseUrl}</span> : null}
      </div>
    </div>
  );
}

function Transcript({ turns }: { turns: SnapshotTurn[] }) {
  if (!turns.length) {
    return <div className="mt-8 rounded-lg border border-slate-900/10 bg-white/70 p-5 text-slate-600">这份快照里没有可展示的消息。</div>;
  }

  return (
    <section className="snapshot-cloud-turns mx-auto mt-10 grid w-full max-w-[1600px] gap-12">
      {turns.map((turn, index) => (
        <article
          key={`${turn.role || "turn"}-${index}`}
          className={`snapshot-cloud-turn ${turn.kind === "tool" ? "tool" : turn.role === "user" ? "user" : "assistant"}`}
        >
          <div className="message-card">
            {turn.kind === "tool" ? (
              <details className="tool-details" open>
                <summary>Tool{turn.name ? ` / ${turn.name}` : ""}</summary>
                <pre>{turn.text || ""}</pre>
              </details>
            ) : (
              <div className="body">
                <div dangerouslySetInnerHTML={{ __html: sanitizeClientHtml(turn.html || renderPlainText(turn.text)) }} />
                <ImageAttachments images={turn.images || []} />
              </div>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

function ImageAttachments({ images }: { images: SnapshotImage[] }) {
  if (!images.length) {
    return null;
  }

  return (
    <div className="attachment-grid">
      {images.map((image, index) => {
        const label = image.size ? `${image.mimeType || "image"} / ${image.size}` : image.mimeType || "image";

        return (
          <figure
            className={`image-attachment ${image.src ? "" : "image-unavailable"}`}
            key={`${image.alt || "image"}-${index}`}
          >
            {image.src ? (
              <img src={image.src} alt={image.alt || `Image attachment ${index + 1}`} decoding="async" />
            ) : (
              <div>{image.unavailableReason || "Image unavailable"}</div>
            )}
            <figcaption>{label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function useResolvedApiBaseUrl(value: string | undefined) {
  const configured = useMemo(() => normalizeApiBaseUrl(value), [value]);
  const [localFallback, setLocalFallback] = useState("");

  useEffect(() => {
    if (configured || !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
      return;
    }

    setLocalFallback("http://127.0.0.1:8787");
  }, [configured]);

  return configured || localFallback;
}

function normalizeApiBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") || "";
}

function renderPlainText(value: string | undefined) {
  return String(value || "")
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function sanitizeClientHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | undefined | null) {
  if (!value) {
    return "unknown";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toISOString().replace("T", " ").slice(0, 16);
}

function SnapshotCloudStyles() {
  return (
    <style>{`
      .snapshot-cloud {
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
      }
      .snapshot-cloud code,
      .snapshot-cloud pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .snapshot-cloud-turn {
        display: flex;
        min-width: 0;
      }
      .snapshot-cloud-turn.user {
        justify-content: flex-end;
      }
      .snapshot-cloud-turn.assistant,
      .snapshot-cloud-turn.tool {
        justify-content: flex-start;
      }
      .snapshot-cloud .message-card {
        min-width: 0;
        max-width: min(1160px, 74%);
        border: 0;
        background: transparent;
        padding: 0;
        box-shadow: none;
      }
      .snapshot-cloud-turn.user .message-card {
        max-width: min(1220px, 76%);
        border: 1px solid #d6e9e5;
        border-radius: 18px;
        background: #eef9f6;
        padding: 22px 32px 25px;
        box-shadow: 0 26px 64px -56px rgba(22, 25, 31, 0.48);
      }
      .snapshot-cloud-turn.assistant .message-card {
        max-width: min(1120px, 74%);
      }
      .snapshot-cloud-turn.tool .message-card {
        max-width: min(1160px, 80%);
        border: 1px solid #efd99f;
        border-radius: 8px;
        background: #fff8df;
        padding: 16px 18px;
      }
      .snapshot-cloud .body {
        min-width: 0;
        max-width: 78ch;
        color: #16191f;
        font-size: 20px;
        line-height: 1.7;
      }
      .snapshot-cloud .body > div > * {
        margin: 0;
      }
      .snapshot-cloud .body > div > * + * {
        margin-top: 18px;
      }
      .snapshot-cloud .body p,
      .snapshot-cloud .body li {
        overflow-wrap: anywhere;
      }
      .snapshot-cloud .body strong {
        font-weight: 800;
      }
      .snapshot-cloud .body a {
        color: #155e75;
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
      }
      .snapshot-cloud .body code {
        border: 1px solid rgba(22, 25, 31, 0.12);
        border-radius: 6px;
        background: rgba(22, 25, 31, 0.06);
        padding: 0.08rem 0.34rem;
        font-size: 0.9em;
      }
      .snapshot-cloud .body pre {
        position: relative;
        max-width: 100%;
        overflow: auto;
        border: 1px solid #253043;
        border-radius: 8px;
        background: #111722;
        color: #edf4ff;
        padding: 38px 16px 16px;
        font: 13px/1.58 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre;
        box-shadow: 0 26px 64px -52px rgba(22, 25, 31, 0.8);
      }
      .snapshot-cloud .body pre[data-language]::before {
        position: absolute;
        top: 10px;
        right: 12px;
        max-width: calc(100% - 24px);
        overflow: hidden;
        color: #aeb8c8;
        content: attr(data-language);
        font: 900 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        text-overflow: ellipsis;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .snapshot-cloud .body pre code {
        display: block;
        min-width: max-content;
        border: 0;
        background: transparent;
        padding: 0;
        color: inherit;
      }
      .snapshot-cloud .body .hljs-keyword,
      .snapshot-cloud .body .hljs-selector-tag,
      .snapshot-cloud .body .hljs-built_in {
        color: #8ab4f8;
      }
      .snapshot-cloud .body .hljs-title,
      .snapshot-cloud .body .hljs-title.class_,
      .snapshot-cloud .body .hljs-title.function_ {
        color: #f2cc60;
      }
      .snapshot-cloud .body .hljs-string,
      .snapshot-cloud .body .hljs-attr,
      .snapshot-cloud .body .hljs-symbol {
        color: #9ccc65;
      }
      .snapshot-cloud .body .hljs-number,
      .snapshot-cloud .body .hljs-literal {
        color: #f8a978;
      }
      .snapshot-cloud .body .hljs-comment {
        color: #7d8796;
        font-style: italic;
      }
      .snapshot-cloud .body .hljs-type,
      .snapshot-cloud .body .hljs-params,
      .snapshot-cloud .body .hljs-variable,
      .snapshot-cloud .body .hljs-property {
        color: #c4b5fd;
      }
      .snapshot-cloud .body ul,
      .snapshot-cloud .body ol {
        padding-left: 1.35rem;
      }
      .snapshot-cloud .body li + li {
        margin-top: 0.25rem;
      }
      .snapshot-cloud .body blockquote {
        border-left: 3px solid #ccd5df;
        margin-left: 0;
        padding-left: 14px;
        color: #4b5563;
      }
      .snapshot-cloud .body h1,
      .snapshot-cloud .body h2,
      .snapshot-cloud .body h3 {
        line-height: 1.25;
        font-size: 1.08em;
      }
      .snapshot-cloud .attachment-grid {
        display: grid;
        gap: 18px;
        margin-top: 24px;
      }
      .snapshot-cloud .image-attachment {
        margin: 0;
        min-width: 0;
      }
      .snapshot-cloud .image-attachment img {
        display: block;
        max-width: 100%;
        max-height: 540px;
        border: 1px solid rgba(22, 25, 31, 0.18);
        border-radius: 8px;
        background: #fff;
        object-fit: contain;
        box-shadow: 0 24px 54px -50px rgba(22, 25, 31, 0.6);
      }
      .snapshot-cloud .image-attachment figcaption {
        margin-top: 10px;
        color: #69717d;
        font: 800 14px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .snapshot-cloud .image-unavailable {
        border: 1px dashed #d9dee4;
        border-radius: 8px;
        padding: 16px;
        color: #69717d;
      }
      .snapshot-cloud .tool-details summary {
        min-height: 34px;
        color: #a56d13;
        font: 800 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        text-transform: uppercase;
      }
      .snapshot-cloud .tool-details pre {
        overflow: auto;
        max-height: 520px;
        margin: 8px 0 0;
        border: 1px solid #253043;
        background: #111722;
        color: #edf4ff;
        padding: 14px;
        line-height: 1.55;
        white-space: pre-wrap;
      }
      @media (max-width: 820px) {
        .snapshot-cloud-turns {
          gap: 36px;
        }
        .snapshot-cloud .message-card,
        .snapshot-cloud-turn.user .message-card {
          max-width: 94%;
        }
        .snapshot-cloud-turn.assistant .message-card {
          max-width: 100%;
        }
        .snapshot-cloud-turn.user .message-card {
          padding: 18px 20px 20px;
        }
        .snapshot-cloud .body {
          font-size: 18px;
        }
      }
    `}</style>
  );
}
