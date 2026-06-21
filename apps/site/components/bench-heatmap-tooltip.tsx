"use client";

import { useEffect } from "react";

// Authored heatmap posts (六工具 × 31 任务结果热力图) mark each cell with
// `data-tip`. The cell grid lives inside a horizontally-scrollable container,
// so a pure-CSS `::after` bubble would be clipped at the edges — and the post's
// inline <script> never runs because the body is injected via
// dangerouslySetInnerHTML. This component attaches the behaviour from real
// React land: one body-level, position:fixed bubble that shows instantly on
// hover and is never clipped. It no-ops on posts without a heatmap.
export function BenchHeatmapTooltip({ articleContentId }: { articleContentId: string }) {
  useEffect(() => {
    const container = document.getElementById(articleContentId);
    if (!container || !container.querySelector(".bv-c[data-tip]")) {
      return;
    }

    const tip = document.createElement("div");
    tip.className = "bv-tip";
    document.body.appendChild(tip);
    let current: Element | null = null;

    const hide = () => {
      tip.classList.remove("on");
      current = null;
    };

    const place = (cell: Element) => {
      const text = cell.getAttribute("data-tip");
      if (!text) {
        hide();
        return;
      }
      tip.textContent = text;
      // Measure off-screen first so the fade-in never flashes at a stale spot.
      tip.style.left = "-9999px";
      tip.style.top = "-9999px";
      tip.classList.add("on");
      const rect = cell.getBoundingClientRect();
      const size = tip.getBoundingClientRect();
      let x = rect.left + rect.width / 2 - size.width / 2;
      x = Math.max(6, Math.min(x, window.innerWidth - size.width - 6));
      let y = rect.top - size.height - 8;
      if (y < 6) {
        y = rect.bottom + 8; // flip below when there's no room above
      }
      tip.style.left = `${Math.round(x)}px`;
      tip.style.top = `${Math.round(y)}px`;
    };

    const onOver = (event: Event) => {
      const target = event.target as Element | null;
      const cell = target?.closest?.(".bv-c[data-tip]");
      if (!cell || cell === current) {
        return;
      }
      current = cell;
      place(cell);
    };

    const onOut = (event: MouseEvent) => {
      if (!current) {
        return;
      }
      const to = event.relatedTarget as Element | null;
      if (to && to.closest?.(".bv-c[data-tip]") === current) {
        return;
      }
      hide();
    };

    container.addEventListener("mouseover", onOver);
    container.addEventListener("mouseout", onOut as EventListener);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);

    return () => {
      container.removeEventListener("mouseover", onOver);
      container.removeEventListener("mouseout", onOut as EventListener);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      tip.remove();
    };
  }, [articleContentId]);

  return null;
}
