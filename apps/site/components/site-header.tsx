import React from "react";
import Link from "next/link";

import { PrivateBadge, PrivateFeatureGate } from "@/components/private-feature-access";
import { CATEGORY_DEFINITIONS, SITE } from "@/lib/content/config";
import { cn } from "@/lib/utils/cn";
import { normalizeBasePath, withBasePath } from "@/lib/utils/site-path";

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
  private?: boolean;
};

const NAV_LINKS: NavItem[] = [
  { href: "/", label: "首页" },
  { href: `/category/${CATEGORY_DEFINITIONS.tech.slug}`, label: CATEGORY_DEFINITIONS.tech.label },
  {
    href: `/category/${CATEGORY_DEFINITIONS.fitness.slug}`,
    label: CATEGORY_DEFINITIONS.fitness.label,
    private: true,
  },
  {
    href: `/category/${CATEGORY_DEFINITIONS.dailyNews.slug}`,
    label: CATEGORY_DEFINITIONS.dailyNews.label,
  },
  { href: "/pet", label: "桌宠", private: true },
  { href: "/search", label: "搜索" },
];

type SiteHeaderProps = {
  currentPathname?: string | null;
  wide?: boolean;
};

function normalizeNavPathname(pathname: string | null | undefined) {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  let normalizedPathname = pathname || "/";

  normalizedPathname = normalizedPathname.split(/[?#]/)[0] || "/";

  if (
    basePath &&
    (normalizedPathname === basePath || normalizedPathname.startsWith(`${basePath}/`))
  ) {
    normalizedPathname = normalizedPathname.slice(basePath.length) || "/";
  }

  if (!normalizedPathname.startsWith("/")) {
    normalizedPathname = `/${normalizedPathname}`;
  }

  return normalizedPathname.replace(/\/+$/, "") || "/";
}

function isActiveNavItem(item: NavItem, currentPathname: string | null | undefined) {
  if (!currentPathname || item.external) {
    return false;
  }

  const itemPathname = normalizeNavPathname(item.href);
  const activePathname = normalizeNavPathname(currentPathname);

  if (itemPathname === "/") {
    return activePathname === "/";
  }

  return activePathname === itemPathname || activePathname.startsWith(`${itemPathname}/`);
}

function NavLink({
  item,
  mobile = false,
  currentPathname,
}: {
  item: NavItem;
  mobile?: boolean;
  currentPathname?: string | null;
}) {
  const active = isActiveNavItem(item, currentPathname);
  const className = cn(
    mobile
      ? "inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f2d20]/30"
      : "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f2d20]/30",
    active
      ? "bg-[#1a1815] font-semibold !text-[#faf6ec]"
      : "text-[#3c362c] hover:bg-[#1a1815]/14 hover:text-[#1a1815]"
  );
  const labelNode = item.private ? (
    <span className="inline-flex items-center gap-1.5">
      {item.label}
      <PrivateBadge />
    </span>
  ) : (
    item.label
  );
  const link = item.external ? (
    <a href={item.href} target="_blank" rel="noreferrer" className={className}>
      {labelNode}
    </a>
  ) : (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={className}>
      {labelNode}
    </Link>
  );

  return item.private ? <PrivateFeatureGate>{link}</PrivateFeatureGate> : link;
}

export function SiteHeader({ currentPathname, wide = false }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b-[1.5px] border-[#1a1815] bg-[#faf6ec]/90 backdrop-blur-xl">
      {/* 报头单色酒红压线 */}
      <div aria-hidden="true" className="h-[3px] w-full bg-[#8f2d20]" />
      <div
        className={cn(
          "mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8",
          wide ? "max-w-[1680px] 2xl:px-10" : "max-w-7xl"
        )}
      >
        <div className="min-w-0 max-w-xl">
          <Link
            href="/"
            className="group inline-flex items-baseline gap-2.5 text-[#1a1815]"
          >
            <span className="font-display text-[1.6rem] font-normal tracking-[0.01em] sm:text-[1.95rem]">
              {SITE.title}
            </span>
            <span
              className="hidden h-px w-10 translate-y-[-0.4rem] bg-[#1a1815]/30 transition group-hover:w-16 group-hover:bg-[#8f2d20] sm:inline-block"
              aria-hidden="true"
            />
          </Link>
          <p className="font-mono-ui mt-0.5 hidden text-[0.68rem] uppercase tracking-[0.22em] text-[#8f2d20] sm:block">
            {SITE.subtitle}
          </p>
        </div>
        <div className="hidden min-w-0 flex-1 justify-end xl:flex">
          <div className="flex max-w-full items-center gap-1 rounded-full border border-[#1a1815]/30 bg-[#faf6ec]/70 p-1">
            <nav className="flex shrink-0 items-center gap-1">
              {NAV_LINKS.map((item) => (
                <NavLink key={item.href} item={item} currentPathname={currentPathname} />
              ))}
            </nav>
            <form
              action={withBasePath("/search/")}
              role="search"
              toolname="search_blog_posts_form"
              tooldescription="Search this blog by article title keyword and open the search results page."
              toolautosubmit=""
              className="flex min-w-0 items-center gap-1 border-l-[1.5px] border-[#1a1815]/15 pl-1"
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
                className="h-9 w-32 min-w-0 rounded-full border-[1.5px] border-[#1a1815]/15 bg-[#faf6ec]/85 px-3 text-sm text-[#1a1815] outline-none transition placeholder:text-[#6b6457]/60 focus:border-[#1a1815] focus:ring-4 focus:ring-[#1a1815]/15 2xl:w-44"
              />
              <button
                type="submit"
                className="h-9 shrink-0 rounded-full border-[1.5px] border-[#1a1815] bg-[#8f2d20] px-3 text-sm font-semibold text-[#faf6ec] transition hover:bg-[#1a1815] focus:outline-none focus:ring-4 focus:ring-[#8f2d20]/25 xl:px-4"
              >
                搜索
              </button>
            </form>
          </div>
        </div>
        <details className="relative xl:hidden">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center rounded-full border border-[#1a1815] bg-[#faf6ec]/85 px-4 text-sm font-semibold text-[#1a1815] transition hover:bg-[#1a1815]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f2d20]/20 [&::-webkit-details-marker]:hidden">
            菜单
          </summary>
          <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[#1a1815] bg-[#faf6ec]/97 p-3 shadow-[0_20px_50px_-30px_rgba(26,24,21,0.5)] backdrop-blur-xl">
            <nav className="grid grid-cols-2 gap-1">
              {NAV_LINKS.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  mobile
                  currentPathname={currentPathname}
                />
              ))}
            </nav>
            <form
              action={withBasePath("/search/")}
              role="search"
              toolname="search_blog_posts_form_mobile"
              tooldescription="Search this blog by article title keyword and open the search results page."
              toolautosubmit=""
              className="mt-3 grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2 border-t-[1.5px] border-[#1a1815]/12 pt-3"
            >
              <label className="sr-only" htmlFor="site-title-search-mobile">
                按标题搜索
              </label>
              <input
                id="site-title-search-mobile"
                name="q"
                type="search"
                toolparamtitle="query"
                toolparamdescription="Article title keywords to search for."
                placeholder="搜索标题"
                className="min-h-11 min-w-0 rounded-full border-[1.5px] border-[#1a1815]/15 bg-[#faf6ec]/85 px-4 text-sm text-[#1a1815] outline-none transition placeholder:text-[#6b6457]/60 focus:border-[#1a1815] focus:ring-4 focus:ring-[#1a1815]/15"
              />
              <button
                type="submit"
                className="min-h-11 rounded-full border-[1.5px] border-[#1a1815] bg-[#8f2d20] px-4 text-sm font-semibold text-[#faf6ec] transition hover:bg-[#1a1815] focus:outline-none focus:ring-4 focus:ring-[#8f2d20]/25"
              >
                搜索
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
