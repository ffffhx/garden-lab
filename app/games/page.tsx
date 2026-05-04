import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { getAllGames } from "@/lib/games";

export const metadata: Metadata = {
  title: "游戏入口",
  description: "暂时存放仓库中的游戏入口和游戏原型方案。",
};

export default function GamesPage() {
  const games = getAllGames();

  return (
    <main className="space-y-6">
      <div className="rounded-[2rem] border border-slate-900/10 bg-white/82 p-7 shadow-[0_32px_120px_-68px_rgba(15,23,42,0.65)]">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Games</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          游戏入口
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700">
          暂时存放仓库里的可玩内容和游戏原型方案。
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="text-sm font-semibold text-amber-800 underline decoration-amber-400/50 underline-offset-4"
          >
            返回首页
          </Link>
        </div>
      </div>

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
                    <Link href={game.href} className="hover:text-amber-700">
                      {game.title}
                    </Link>
                  </h2>
                  <p className="text-base leading-8 text-slate-700">{game.description}</p>
                </div>
                <div className="mt-auto">
                  <Link
                    href={game.href}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 transition group-hover:text-amber-700"
                  >
                    {game.actionLabel ?? "进入游戏"}
                    <span aria-hidden="true">→</span>
                  </Link>
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
