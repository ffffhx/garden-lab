"use client";

import React, { useEffect, useRef, useState } from "react";
import { copyMarkdown } from "@/components/article-markdown-actions";
import type { Heading } from "@/lib/content/types";

export function SectionCopyButton({ heading, contentHtml }: { heading: Heading; contentHtml: string }) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const [manualCopy, setManualCopy] = useState("");
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (manualCopy) { manualRef.current?.focus(); manualRef.current?.select(); }
  }, [manualCopy]);

  async function handleCopy() {
    if (status === "copying") return;
    if (timer.current) clearTimeout(timer.current);
    setStatus("copying");
    setManualCopy("");
    let markdown = "";
    try {
      const { createSectionMarkdown } = await import("@/lib/content/markdown-export");
      markdown = await createSectionMarkdown(contentHtml, heading.id, window.location.href);
      await copyMarkdown(markdown);
      setStatus("copied");
      timer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("failed");
      setManualCopy(markdown);
    }
  }

  return <>
    <button
      type="button"
      onClick={handleCopy}
      disabled={status === "copying"}
      aria-label={`复制章节：${heading.text}`}
      title="复制本章及下属小节（Markdown）"
      className="my-0.5 mr-1 inline-flex min-h-9 min-w-12 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-[0.7rem] text-muted transition-colors hover:bg-ink/10 hover:text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:opacity-50 print:hidden"
    >
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {status === "copied" ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}
      </svg>
      {status === "copied" ? "已复制" : status === "copying" ? "复制中" : status === "failed" ? "重试" : "复制"}
    </button>
    <span role="status" aria-live="polite" className={status === "failed" ? "w-full px-3 pb-2 text-xs text-red" : "sr-only"}>
      {status === "copied" ? `已复制章节：${heading.text}` : status === "failed" ? (manualCopy ? "浏览器未允许自动复制，已选中本章内容，可手动复制。" : "章节复制失败，请重试。") : ""}
    </span>
    {manualCopy ? <textarea
      ref={manualRef}
      aria-label={`手动复制章节：${heading.text}`}
      value={manualCopy}
      readOnly
      className="mx-2 mb-2 h-36 w-full rounded-md border border-ink/30 bg-paper-soft p-2 font-mono text-xs text-ink focus-visible:outline-2 focus-visible:outline-red"
    /> : null}
  </>;
}
