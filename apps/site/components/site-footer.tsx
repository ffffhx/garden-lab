import Link from "next/link";

import { CATEGORY_DEFINITIONS, SITE } from "@/lib/content/config";
import { cn } from "@/lib/utils/cn";

// 构建戳：CI 在每次部署时注入 commit SHA 与时间（见 .github/workflows/pages.yml）。
// 本地开发无此环境变量时显示 "dev"。用来一眼判断线上页面是不是最新一次 push。
const BUILD_SHA_FULL = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
const BUILD_SHA = BUILD_SHA_FULL ? BUILD_SHA_FULL.slice(0, 7) : "dev";
const BUILD_TIME = (process.env.NEXT_PUBLIC_BUILD_TIME ?? "").slice(0, 16).replace("T", " ");

const FOOTER_SECTIONS = [
  { href: "/", label: "首页" },
  { href: `/category/${CATEGORY_DEFINITIONS.tech.slug}`, label: CATEGORY_DEFINITIONS.tech.label },
  {
    href: `/category/${CATEGORY_DEFINITIONS.dailyNews.slug}`,
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
          <a
            href={BUILD_SHA_FULL ? `https://github.com/ffffhx/garden-lab/commit/${BUILD_SHA_FULL}` : undefined}
            target="_blank"
            rel="noreferrer"
            title="本页构建版本（commit）——和仓库最新 commit 对得上就是最新；点开看对应提交"
            className="font-mono-ui text-[0.72rem] tracking-[0.08em] text-[#6b6457]/70 transition hover:text-[#8f2d20]"
          >
            build {BUILD_SHA}
            {BUILD_TIME ? ` · ${BUILD_TIME}` : ""}
          </a>
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
