import Link from "next/link";

import { BuildStamp } from "@/components/build-stamp";
import { CATEGORY_DEFINITIONS, SITE } from "@/lib/content/config";
import { cn } from "@/lib/utils/cn";

const FOOTER_SECTIONS = [
  { href: "/", label: "首页" },
  { href: `/category/${CATEGORY_DEFINITIONS.tech.slug}`, label: CATEGORY_DEFINITIONS.tech.label },
  {
    href: "/daily-news",
    label: CATEGORY_DEFINITIONS.dailyNews.label,
  },
];

export function SiteFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer className="relative mt-8 border-t-[3px] border-double border-[#1a1815] bg-[#faf6ec]/75 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8",
          wide ? "max-w-[1680px] 2xl:px-10" : "max-w-7xl"
        )}
      >
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md space-y-3">
            <Link href="/" className="inline-flex items-baseline gap-2.5 text-[#1a1815]">
              <span
                aria-hidden="true"
                className="-mb-0.5 inline-block h-2.5 w-2.5 rounded-full bg-[#8f2d20]"
              />
              <span className="font-display text-2xl font-semibold tracking-[-0.01em]">
                {SITE.title}
              </span>
            </Link>
            <p className="text-sm leading-7 text-[#3c362c]">{SITE.description}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_SECTIONS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-mono-ui text-[0.78rem] uppercase tracking-[0.1em] text-[#6b6457] transition hover:text-[#8f2d20]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t-[1.5px] border-[#1a1815]/12 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono-ui text-[0.72rem] uppercase tracking-[0.14em] text-[#6b6457]/80">
            {SITE.subtitle}
          </p>
          <BuildStamp />
          <a
            href="#top"
            className="font-mono-ui inline-flex items-center gap-1.5 self-start text-[0.72rem] uppercase tracking-[0.14em] text-[#6b6457] transition hover:gap-2.5 hover:text-[#8f2d20] sm:self-auto"
          >
            回到顶部 <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
