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

    // Active heading = the last one whose top has scrolled past a line just
    // below the sticky header. This line is kept slightly above the headings'
    // `scroll-margin-top: 6rem` (96px) so that clicking a TOC link reliably
    // highlights the heading you navigated to — even when it is a content-less
    // divider (e.g. an h2 immediately followed by its first h3). The previous
    // IntersectionObserver band sat 20–35% down the viewport and would catch
    // the next heading instead.
    const OFFSET_PX = 104;
    let frame = 0;

    const update = () => {
      frame = 0;
      let current = headingIds[0];
      for (const id of headingIds) {
        const element = document.getElementById(id);
        if (!element) {
          continue;
        }
        if (element.getBoundingClientRect().top <= OFFSET_PX) {
          current = id;
        } else {
          break;
        }
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
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
