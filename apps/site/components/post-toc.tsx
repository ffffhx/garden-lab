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
    <aside className="riso-card riso-card--pink p-5 backdrop-blur xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:overscroll-contain 2xl:p-6">
      <p className="font-mono-ui mb-4 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#1a1815] xl:sticky xl:top-0 xl:bg-[#faf6ec]/95 xl:pb-3 xl:backdrop-blur">
        目录 · Index
      </p>
      <nav aria-label="文章目录" className="space-y-1">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm leading-6 text-[#3c362c] transition hover:bg-[#1a1815]/12 hover:text-[#1a1815]",
              heading.depth === 3 && "ml-3",
              heading.depth === 4 && "ml-6",
              activeId === heading.id &&
                "border-l-2 border-[#8f2d20] bg-[#8f2d20]/14 font-semibold text-[#1a1815] hover:bg-[#8f2d20]/14"
            )}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
