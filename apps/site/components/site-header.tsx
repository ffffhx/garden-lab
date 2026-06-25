import React from "react";
import Link from "next/link";

import { PrivateBadge, PrivateFeatureGate } from "@/components/private-feature-access";
import { CATEGORY_DEFINITIONS, SITE } from "@/lib/content/config";
import { cn } from "@/lib/utils/cn";
import { normalizeBasePath } from "@/lib/utils/site-path";

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
    href: "/daily-news",
    label: CATEGORY_DEFINITIONS.dailyNews.label,
  },
  { href: "/pet", label: "桌宠", private: true },
];

type SiteHeaderProps = {
  currentPathname?: string | null;
  wide?: boolean;
};

function LogoMark({ className }: { className?: string }) {
  // 「抽芽花饰」站标：与 favicon 同形——纸张瓦片 + 墨黑/酒红双叶
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Garden Lab"
    >
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="14"
        fill="#f4efe4"
        stroke="#1a1815"
        strokeWidth="2"
        className="transition group-hover:stroke-[#8f2d20]"
      />
      <path
        d="M32 50 V28"
        stroke="#1a1815"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M32 33 C 23 33, 18 28, 17 19 C 27 19, 32 24, 32 33 Z" fill="#1a1815" />
      <path d="M32 27 C 41 27, 46 22, 47 14 C 38 14, 33 19, 32 27 Z" fill="#8f2d20" />
      <circle cx="32" cy="52" r="2.2" fill="#8f2d20" />
    </svg>
  );
}

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
            className="group inline-flex items-center gap-2.5 text-[#1a1815]"
          >
            <LogoMark className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <span className="font-display text-[1.6rem] font-normal tracking-[0.01em] sm:text-[1.95rem]">
              {SITE.title}
            </span>
            <span
              className="hidden h-px w-10 bg-[#1a1815]/30 transition group-hover:w-16 group-hover:bg-[#8f2d20] sm:inline-block"
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
          </div>
        </details>
      </div>
    </header>
  );
}
