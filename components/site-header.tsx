import React from "react";
import Link from "next/link";

import { CATEGORY_DEFINITIONS, SITE } from "@/lib/content/config";
import { withBasePath } from "@/lib/utils/site-path";

const NAV_LINKS = [
  { href: "/", label: "首页" },
  { href: `/category/${CATEGORY_DEFINITIONS.tech.slug}`, label: CATEGORY_DEFINITIONS.tech.label },
  {
    href: `/category/${CATEGORY_DEFINITIONS.fitness.slug}`,
    label: CATEGORY_DEFINITIONS.fitness.label,
  },
  {
    href: `/category/${CATEGORY_DEFINITIONS.dailyNews.slug}`,
    label: CATEGORY_DEFINITIONS.dailyNews.label,
  },
  { href: "/games", label: "游戏入口" },
  { href: "/pet", label: "桌宠" },
  { href: "/search", label: "搜索" },
  { href: "/about", label: "关于" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-slate-900/10 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-1">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight text-slate-950"
          >
            {SITE.title}
          </Link>
          <p className="text-sm text-slate-600">{SITE.description}</p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <nav className="flex flex-wrap items-center gap-2">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-amber-100 hover:text-slate-950 hover:ring-1 hover:ring-amber-200"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form
            action={withBasePath("/search/")}
            role="search"
            toolname="search_blog_posts_form"
            tooldescription="Search this blog by article title keyword and open the search results page."
            toolautosubmit=""
            className="flex w-full min-w-0 max-w-md gap-2"
          >
            <label className="sr-only" htmlFor="site-title-search">
              按标题搜索
            </label>
            <input
              id="site-title-search"
              name="q"
              type="search"
              toolparamtitle="query"
              toolparamdescription="Article title keywords to search for."
              placeholder="搜索标题"
              className="min-h-10 min-w-0 flex-1 rounded-full border border-slate-300 bg-white/85 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-200/70"
            />
            <button
              type="submit"
              className="min-h-10 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-amber-800 focus:outline-none focus:ring-4 focus:ring-amber-200"
            >
              搜索
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
