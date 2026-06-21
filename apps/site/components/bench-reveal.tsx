"use client";

import { useEffect } from "react";

// Scroll-reveal enhancer for the authored figures in data-heavy posts
// (能力公式 hero、选型路由流、热力图、能力分层图…). The post body is injected
// via dangerouslySetInnerHTML, so inline <script> never runs — this component
// is the JS layer, mirroring BenchHeatmapTooltip. It arms each target figure by
// adding `.bench-anim` (which switches on the hidden initial state defined in
// globals.css), then adds `.in-view` via IntersectionObserver to play the
// staggered entrance. The figures' own continuous CSS animations run regardless.
//
// Progressive enhancement: with no JS the figures are fully visible. With
// `prefers-reduced-motion: reduce` we never arm them, so nothing hides or moves.
const TARGET_SELECTOR =
  ".capformula, .pickflow, .benchviz, .bench-layers, .bench-planes, .bench-pos, [data-reveal]";

export function BenchReveal({ articleContentId }: { articleContentId: string }) {
  useEffect(() => {
    const container = document.getElementById(articleContentId);
    if (!container) {
      return;
    }

    const figures = Array.from(
      container.querySelectorAll<HTMLElement>(TARGET_SELECTOR)
    );
    if (figures.length === 0) {
      return;
    }

    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Reduced motion (or no IntersectionObserver support): show everything, no
    // arming, no animation.
    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      figures.forEach((fig) => fig.classList.add("in-view"));
      return;
    }

    // Arm: enable the hidden initial state, then reveal on scroll.
    figures.forEach((fig) => fig.classList.add("bench-anim"));

    const reveal = (fig: Element) => {
      fig.classList.add("in-view");
      // Drive the optional JS-stepped layer the figures opt into via
      // `.is-playing` (e.g. sequential node light-up); CSS still self-loops
      // without it, so this is purely additive.
      window.setTimeout(() => fig.classList.add("is-playing"), 280);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.18 }
    );

    figures.forEach((fig) => observer.observe(fig));

    // Failsafe: never leave a figure hidden if the observer somehow doesn't fire.
    const failsafe = window.setTimeout(() => {
      figures.forEach((fig) => reveal(fig));
    }, 3500);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [articleContentId]);

  return null;
}
