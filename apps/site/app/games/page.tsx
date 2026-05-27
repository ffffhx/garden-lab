import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { GAMES_SITE_URL, getAllGames } from "@/lib/games";

export const metadata: Metadata = {
  title: "游戏站",
  description: "Garden Lab 的游戏已经拆到独立公开站点。",
};

export default function GamesPage() {
  const games = getAllGames();

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-900/10 bg-slate-950 p-7 text-white shadow-[0_32px_120px_-68px_rgba(15,23,42,0.85)]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-amber-200">Garden Games</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              游戏已经搬到独立站。
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200">
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-amber-100">
                garden-lab
              </code>{" "}
              继续保留入口；游戏源码、构建、部署和后续联机迭代都迁到新的公开仓库。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={GAMES_SITE_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-amber-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-100"
              >
                打开游戏站
              </a>
              <a
                href="https://github.com/ffffhx/games"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-amber-200 hover:text-amber-100"
              >
                查看新仓库
              </a>
            </div>
          </div>
          <div className="rounded-[1rem] border border-white/10 bg-white/8 p-4 text-sm leading-7 text-slate-200">
            <p className="font-semibold text-amber-100">新地址</p>
            <p className="mt-2 break-all">{GAMES_SITE_URL}</p>
            <p className="mt-4 font-semibold text-amber-100">仓库</p>
            <p className="mt-2 break-all">github.com/ffffhx/games</p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-900/10 bg-white/82 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Archive</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Garden Lab 只保留跳转入口
            </h2>
          </div>
          <Link
            href="/"
            className="inline-flex w-fit items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
          >
            返回首页
          </Link>
        </div>
      </section>

      {games.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {games.map((game) => (
            <article
              key={game.slug}
              className="group rounded-[2rem] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:shadow-[0_32px_96px_-48px_rgba(15,23,42,0.55)]"
            >
              <div className="flex h-full flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
                    游戏
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    {game.status}
                  </span>
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    <a
                      href={game.href}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-amber-700"
                    >
                      {game.title}
                    </a>
                  </h2>
                  <p className="text-base leading-8 text-slate-700">{game.description}</p>
                </div>
                <div className="mt-auto">
                  <a
                    href={game.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 transition group-hover:text-amber-700"
                  >
                    {game.actionLabel ?? "进入游戏"}
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="还没有游戏" description="新的游戏入口会在这里出现。" />
      )}
    </main>
  );
}
