"use client";

import React, { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const META_LIGHT = "#f4efe4";
const META_DARK = "#1a1714";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? META_DARK : META_LIGHT);
  }
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  // 初始渲染先占位（mounted 前不显示图标），避免与 SSR（默认日间）水合不一致
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 隐私模式下 localStorage 不可用，忽略即可
    }
  }

  const isDark = theme === "dark";
  const label = isDark ? "切换为日间模式" : "切换为夜间模式";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/30 bg-paper-soft/70 text-ink transition hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/30",
        className
      )}
    >
      <span aria-hidden="true" className={cn("transition-opacity", mounted ? "opacity-100" : "opacity-0")}>
        {isDark ? (
          // 月亮（当前夜间）
          <svg viewBox="0 0 24 24" className="h-[1.05rem] w-[1.05rem]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" />
          </svg>
        ) : (
          // 太阳（当前日间）
          <svg viewBox="0 0 24 24" className="h-[1.05rem] w-[1.05rem]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  );
}
