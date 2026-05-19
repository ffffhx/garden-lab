import React from "react";
import Link from "next/link";

import { PrivateFeatureGate } from "@/components/private-feature-access";
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
  { href: "/games", label: "游戏入口", private: true },
  { href: "/token-leaderboard", label: "Token榜" },
  { href: "/pet", label: "桌宠", private: true },
  { href: "/search", label: "搜索" },
  { href: "/about", label: "关于" },
];

function NavLink({ item }: { item: (typeof NAV_LINKS)[number] }) {
  const link = (
    <Link
      key={item.href}
      href={item.href}
      prefetch={false}
      className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-amber-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b45f28]/30"
    >
      {item.label}
    </Link>
  );

  return item.private ? <PrivateFeatureGate>{link}</PrivateFeatureGate> : link;
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-900/10 bg-[#fffdf7]/82 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-xl">
          <Link
            href="/"
            prefetch={false}
            className="inline-flex items-baseline gap-3 text-2xl font-semibold tracking-tight text-slate-950"
          >
            <span>{SITE.title}</span>
            <span className="hidden h-px w-12 bg-slate-950/25 sm:inline-block" aria-hidden="true" />
          </Link>
          <p className="mt-1 text-sm leading-6 text-slate-600">{SITE.description}</p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <nav className="flex flex-wrap items-center gap-1 rounded-full border border-slate-900/10 bg-white/65 p-1 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.45)]">
            {NAV_LINKS.map((item) => (
              <NavLink key={item.href} item={item} />
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
              className="min-h-10 min-w-0 flex-1 rounded-full border border-slate-900/12 bg-white/75 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#b45f28] focus:ring-4 focus:ring-[#b45f28]/15"
            />
            <button
              type="submit"
              className="min-h-10 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-[#8f3f18] focus:outline-none focus:ring-4 focus:ring-[#b45f28]/20"
            >
              搜索
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
