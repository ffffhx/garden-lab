"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils/cn";
import type { Heading } from "@/lib/content/types";

type PostTocProps = {
  headings: Heading[];
};

export function PostToc({ headings }: PostTocProps) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  const headingIds = useMemo(() => headings.map((heading) => heading.id), [headings]);

  useEffect(() => {
    if (headingIds.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];

        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: [0, 1],
      }
    );

    for (const id of headingIds) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [headingIds]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <aside className="rounded-lg border border-slate-950/10 bg-[#fffdf7]/84 p-5 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.58)] backdrop-blur xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:overscroll-contain 2xl:p-6">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 xl:sticky xl:top-0 xl:bg-[#fffdf7]/95 xl:pb-3 xl:backdrop-blur">
        目录
      </p>
      <nav aria-label="文章目录" className="space-y-1">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={cn(
              "block rounded-md px-3 py-2 text-sm leading-6 text-slate-600 transition hover:bg-[#fff4cf] hover:text-[#7c3b16]",
              heading.depth === 3 && "ml-3",
              heading.depth === 4 && "ml-6",
              activeId === heading.id &&
                "bg-[#fff4cf] text-slate-950 ring-1 ring-[#b45f28]/18 hover:bg-[#fff4cf] hover:text-slate-950"
            )}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
