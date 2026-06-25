import Link from "next/link";

import { ArticleBody } from "@/components/article-body";
import { BuildStamp } from "@/components/build-stamp";
import { PostMeta } from "@/components/post-meta";
import { PostToc } from "@/components/post-toc";
import { TOC_MIN_HEADINGS } from "@/lib/content/config";
import {
  getDailyNewsArchiveMonths,
  getDailyNewsCurrentThread,
  getDailyNewsIssueNavigation,
  type DailyNewsCurrentThread,
  type DailyNewsEntry,
} from "@/lib/content/daily-news";
import { getDailyNewsIssueDateSlug } from "@/lib/content/daily-news-date";
import type { Post } from "@/lib/content/types";

type DailyNewsModuleProps = {
  entries: DailyNewsEntry[];
  post: Post;
};

function cleanIssueTitle(title: string, dateSlug: string) {
  const [year, month, day] = dateSlug.split("-");
  const datePattern = new RegExp(`${year}[/-]${month}[/-]${day}`);

  return title
    .replace(/^每日新闻[：:]\s*/, "")
    .replace(datePattern, "")
    .replace(/^[\s:：-]+|[\s:：-]+$/g, "")
    .trim();
}

function issueNumberFor(entries: DailyNewsEntry[], activeDateSlug: string) {
  const activeIndex = entries.findIndex((entry) => entry.dateSlug === activeDateSlug);

  if (activeIndex < 0) {
    return entries.length;
  }

  return entries.length - activeIndex;
}

function getArchiveEntryTitle(entry: DailyNewsEntry) {
  return entry.leadStory || cleanIssueTitle(entry.title, entry.dateSlug) || entry.title;
}

function ArchiveIssueLink({
  active,
  entry,
  variant,
}: {
  active: boolean;
  entry: DailyNewsEntry;
  variant: "mobile" | "sidebar";
}) {
  const entryTitle = getArchiveEntryTitle(entry);
  const baseClass =
    variant === "mobile"
      ? "block min-w-0 max-w-full overflow-hidden rounded-[6px] px-3 py-2.5 transition"
      : "group block min-w-0 max-w-full overflow-hidden rounded-[6px] px-3 py-3 transition";
  const inactiveClass =
    variant === "mobile"
      ? "bg-[#fffaf0]/62 text-[#3c362c] ring-1 ring-[#1a1815]/10 hover:bg-[#fffaf0] hover:ring-[#8f2d20]/35"
      : "text-[#3c362c] hover:bg-[#8f2d20]/[0.055] hover:text-[#1a1815]";

  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      className={[
        baseClass,
        active ? "bg-[#1a1815] text-[#faf6ec] shadow-[0_14px_30px_-26px_rgba(26,24,21,0.65)]" : inactiveClass,
      ].join(" ")}
    >
      <span className="font-mono-ui block text-[0.72rem] font-semibold uppercase tracking-[0.1em]">
        {entry.dateSlug}
      </span>
      <span
        className={[
          "mt-1 block truncate",
          variant === "mobile" ? "text-xs" : "text-sm",
          active ? "text-[#faf6ec]/82" : "text-[#6a6155] group-hover:text-[#3c362c]",
        ].join(" ")}
      >
        {entryTitle}
      </span>
      <span
        className={[
          "font-mono-ui mt-1.5 block truncate text-[0.64rem] uppercase tracking-[0.08em]",
          active ? "text-[#faf6ec]/62" : "text-[#8a7d6c]",
        ].join(" ")}
      >
        {entry.archiveMetaText}
      </span>
    </Link>
  );
}

function IssueArchive({
  activeDateSlug,
  entries,
  variant,
}: {
  activeDateSlug: string;
  entries: DailyNewsEntry[];
  variant: "mobile" | "sidebar";
}) {
  const archiveMonths = getDailyNewsArchiveMonths(entries);

  if (variant === "mobile") {
    return (
      <nav
        className="min-w-0 max-w-full overflow-hidden rounded-[6px] bg-[#efe6d6]/38 px-3 py-3 xl:hidden"
        aria-label="每日新闻日期档案"
      >
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl text-[#1a1815]">日期档案</h2>
          <span className="font-mono-ui text-[0.68rem] uppercase tracking-[0.14em] text-[#6a6155]">
            {entries.length} 期
          </span>
        </div>
        <div className="max-h-[22rem] min-w-0 max-w-full space-y-4 overflow-y-auto overflow-x-hidden pr-1">
          {archiveMonths.map((month) => (
            <section key={month.key} className="space-y-2">
              <h3 className="font-mono-ui sticky top-0 z-10 bg-[#faf6ec]/95 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#8f2d20] backdrop-blur">
                {month.label}
              </h3>
              <div className="grid min-w-0 max-w-full grid-cols-2 gap-2">
                {month.entries.map((entry) => (
                  <ArchiveIssueLink
                    key={entry.dateSlug}
                    active={entry.dateSlug === activeDateSlug}
                    entry={entry}
                    variant="mobile"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="hidden min-w-0 max-w-full overflow-hidden rounded-[6px] bg-[#efe6d6]/32 px-3 py-4 xl:block"
      aria-label="每日新闻日期档案"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl text-[#1a1815]">日期档案</h2>
        <span className="font-mono-ui text-[0.68rem] uppercase tracking-[0.14em] text-[#6a6155]">
          {entries.length} 期
        </span>
      </div>
      <div className="mt-4 min-w-0 max-w-full space-y-5 pr-1">
        {archiveMonths.map((month) => (
          <section key={month.key} className="space-y-1">
            <h3 className="font-mono-ui sticky top-0 z-10 bg-[#faf6ec]/95 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#8f2d20] backdrop-blur">
              {month.label}
            </h3>
            {month.entries.map((entry) => (
              <ArchiveIssueLink
                key={entry.dateSlug}
                active={entry.dateSlug === activeDateSlug}
                entry={entry}
                variant="sidebar"
              />
            ))}
          </section>
        ))}
      </div>
    </nav>
  );
}

function CurrentThreadPanel({ thread }: { thread: DailyNewsCurrentThread }) {
  if (!thread.entries.length) {
    return null;
  }

  return (
    <section className="rounded-[6px] bg-[#efe6d6]/45 px-4 py-4 shadow-[inset_0_1px_0_rgba(26,24,21,0.08)] sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="font-mono-ui text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#8f2d20]">
          Current Thread · 当前主线
        </p>
        <p className="font-mono-ui text-[0.68rem] uppercase tracking-[0.14em] text-[#6a6155]">
          {thread.label}
        </p>
      </div>
      <h2 className="font-display mt-3 text-balance text-2xl leading-tight text-[#1a1815] sm:text-3xl">
        {thread.title}
      </h2>
      <p className="mt-2 max-w-5xl text-sm leading-7 text-[#3c362c] sm:text-base">
        {thread.summary}
      </p>
      {thread.topics.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {thread.topics.map((topic) => (
            <span
              key={topic}
              className="font-mono-ui border border-[#1a1815]/20 bg-[#fffaf0]/70 px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.08em] text-[#6a6155]"
            >
              {topic}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function IssueNavigator({
  activeDateSlug,
  entries,
  variant,
}: {
  activeDateSlug: string;
  entries: DailyNewsEntry[];
  variant: "mobile" | "sidebar";
}) {
  const navigation = getDailyNewsIssueNavigation(entries, activeDateSlug);
  const items = [
    { entry: navigation.newer, label: "上一篇", meta: "更新一期" },
    { entry: navigation.older, label: "下一篇", meta: "更早一期" },
    { entry: navigation.random, label: "随机一期", meta: "跳读档案" },
  ];

  return (
    <nav
      className={[
        "min-w-0 max-w-full overflow-hidden rounded-[6px] bg-[#fffaf0]/52 px-3 py-4",
        variant === "mobile" ? "xl:hidden" : "hidden xl:block",
      ].join(" ")}
      aria-label="每日新闻阅读导航"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl text-[#1a1815]">历史漫游</h2>
        <span className="font-mono-ui text-[0.68rem] uppercase tracking-[0.14em] text-[#6a6155]">
          Jump
        </span>
      </div>
      <div
        className={
          variant === "mobile"
            ? "mt-3 grid min-w-0 max-w-full gap-2 sm:grid-cols-3"
            : "mt-4 min-w-0 max-w-full space-y-2"
        }
      >
        {items.map((item) => {
          if (!item.entry) {
            return (
              <div
                key={item.label}
                aria-disabled="true"
                className="min-w-0 max-w-full overflow-hidden rounded-[6px] bg-[#1a1815]/[0.035] px-3 py-3 text-[#8a7d6c]/70"
              >
                <span className="font-mono-ui block text-[0.66rem] font-semibold uppercase tracking-[0.12em]">
                  {item.label}
                </span>
                <span className="mt-1 block text-xs">没有更多期数</span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.entry.href}
              className="group block min-w-0 max-w-full overflow-hidden rounded-[6px] bg-[#faf6ec]/72 px-3 py-3 ring-1 ring-[#1a1815]/10 transition hover:bg-[#1a1815] hover:text-[#faf6ec] hover:ring-[#1a1815]"
            >
              <span className="font-mono-ui flex items-center justify-between gap-3 text-[0.66rem] font-semibold uppercase tracking-[0.12em]">
                <span>{item.label}</span>
                <span className="text-[#8a7d6c] group-hover:text-[#faf6ec]/65">{item.meta}</span>
              </span>
              <span className="font-mono-ui mt-2 block text-[0.72rem] font-semibold tracking-[0.08em]">
                {item.entry.dateSlug}
              </span>
              <span className="mt-1 block truncate text-sm text-[#6a6155] group-hover:text-[#faf6ec]/78">
                {getArchiveEntryTitle(item.entry)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DailyNewsModule({ entries, post }: DailyNewsModuleProps) {
  const activeDateSlug = getDailyNewsIssueDateSlug(post.title, post.date);
  const activeEntry = entries.find((entry) => entry.dateSlug === activeDateSlug);
  const issueNumber = issueNumberFor(entries, activeDateSlug);
  const showToc = post.headings.length >= TOC_MIN_HEADINGS;
  const activeIssueTitle = cleanIssueTitle(post.title, activeDateSlug) || post.title;
  const [issueYear, issueMonth, issueDay] = activeDateSlug.split("-");
  const currentThread = getDailyNewsCurrentThread(entries);

  return (
    <main className="daily-news-module grid min-w-0 gap-6 xl:h-[calc(100dvh-8.25rem)] xl:min-h-[34rem] xl:overflow-hidden xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_23rem] 2xl:gap-8">
      <div className="daily-news-pane min-w-0 space-y-5 sm:space-y-6 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pb-6 xl:pr-3 [scrollbar-gutter:stable]">
        <div className="edition-bar">
          <span>Daily News · 每日新闻</span>
          <span className="hidden sm:inline">Issue {String(issueNumber).padStart(2, "0")}</span>
          <span>{activeDateSlug}</span>
        </div>

        <section className="grid gap-5 rounded-[6px] bg-[#fffaf0]/38 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-8 sm:px-5">
          <div className="min-w-0">
            <span className="riso-sticker riso-sticker--pink">Module · 新闻档案</span>
            <h1 className="font-display mt-3 max-w-4xl text-balance text-4xl leading-[1.02] text-[#1a1815] sm:text-6xl">
              每日新闻
            </h1>
            <p className="mt-4 max-w-4xl overflow-hidden text-base leading-8 text-[#3c362c] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:5] sm:text-lg lg:[-webkit-line-clamp:4]">
              {post.excerpt}
            </p>
          </div>

          <div className="rounded-[6px] bg-[#efe6d6]/55 px-4 py-4 shadow-[inset_0_1px_0_rgba(26,24,21,0.1)]">
            <div className="flex items-start justify-between gap-4">
              <p className="font-mono-ui text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#8f2d20]">
                Current Edition
              </p>
              <p className="font-mono-ui text-[0.68rem] uppercase tracking-[0.16em] text-[#6a6155]">
                No. {String(issueNumber).padStart(2, "0")}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
              <p className="font-display text-5xl leading-[0.9] text-[#1a1815] sm:text-6xl lg:text-5xl">
                {issueMonth}
              </p>
              <div className="border-l border-[#8f2d20]/22 pl-3">
                <p className="font-display text-5xl leading-[0.9] text-[#1a1815] sm:text-6xl lg:text-5xl">
                  {issueDay}
                </p>
                <p className="font-mono-ui mt-2 text-[0.7rem] uppercase tracking-[0.12em] text-[#6a6155]">
                  {issueYear}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#6a6155]">
              {activeEntry?.dateText ?? post.dateText} ·{" "}
              {activeEntry?.archiveMetaText ?? post.readingTimeText}
            </p>
          </div>
        </section>

        <CurrentThreadPanel thread={currentThread} />

        <IssueArchive activeDateSlug={activeDateSlug} entries={entries} variant="mobile" />
        <IssueNavigator activeDateSlug={activeDateSlug} entries={entries} variant="mobile" />

        <article className="daily-news-issue riso-card riso-card--pink min-w-0 p-5 sm:p-8 2xl:p-10">
          <header className="space-y-4 pb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="riso-sticker riso-sticker--terra">Edition · 单日速览</span>
              <BuildStamp />
            </div>
            <h2 className="font-display max-w-[74rem] break-words text-balance text-3xl leading-[1.04] text-[#1a1815] [overflow-wrap:anywhere] sm:text-5xl">
              {activeIssueTitle}
            </h2>
            <PostMeta
              categories={post.categories}
              dateText={post.dateText}
              readingTimeText={post.readingTimeText}
              showTags={false}
              tags={post.tags}
            />
          </header>

          <div className="mt-7">
            <ArticleBody
              contentImageSize={post.contentImageSize}
              enableAiChat
              excerpt={post.excerpt}
              headings={post.headings}
              html={post.contentHtml}
              slug={post.slug}
              title={post.title}
            />
          </div>
        </article>
      </div>

      <aside className="daily-news-sidebar min-w-0 space-y-5 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pb-6 xl:pl-4 xl:pr-1 [scrollbar-gutter:stable]">
        <IssueArchive activeDateSlug={activeDateSlug} entries={entries} variant="sidebar" />
        <IssueNavigator activeDateSlug={activeDateSlug} entries={entries} variant="sidebar" />
        {showToc ? <PostToc headings={post.headings} /> : null}
      </aside>
    </main>
  );
}
