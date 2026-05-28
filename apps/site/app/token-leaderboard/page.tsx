import type { Metadata } from "next";
import Link from "next/link";

import { OPEN_TOKEN_BOARD_URL } from "@/lib/standalone-projects";

const OPEN_TOKEN_BOARD_REPO_URL = "https://github.com/ffffhx/open-token-board";

export const metadata: Metadata = {
  title: "Open Token Board",
  description: "Token 排行榜已经拆成独立公开站点。",
  alternates: {
    canonical: OPEN_TOKEN_BOARD_URL,
  },
};

export default function TokenLeaderboardPage() {
  return (
    <main className="mx-auto grid min-h-[58vh] w-full max-w-4xl place-items-center py-16">
      <section className="w-full border border-slate-900/10 bg-[#fffdf7]/86 p-8 shadow-[0_32px_120px_-72px_rgba(15,23,42,0.62)] sm:p-10">
        <p className="font-mono text-xs font-black uppercase tracking-[0.08em] text-[#8f3f18]">
          Standalone project
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-none tracking-normal text-slate-950 sm:text-6xl">
          Open Token Board
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
          Token 排行榜已经拆成独立公开项目。Garden Lab 保留入口，实际榜单、安装指南和后续迭代都放到新站点维护。
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href={OPEN_TOKEN_BOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-5 font-mono text-xs font-black uppercase text-white transition hover:bg-[#8f3f18] focus:outline-none focus:ring-4 focus:ring-[#245d83]/15"
          >
            打开新站点
          </a>
          <a
            href={OPEN_TOKEN_BOARD_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-950/12 bg-white px-5 font-mono text-xs font-black uppercase text-slate-700 transition hover:border-slate-950/25 hover:text-slate-950"
          >
            查看新仓库
          </a>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-950/12 bg-white px-5 font-mono text-xs font-black uppercase text-slate-700 transition hover:border-slate-950/25 hover:text-slate-950"
          >
            返回首页
          </Link>
        </div>
        <div className="mt-8 rounded-lg border border-slate-900/10 bg-white/70 p-4 text-sm leading-7 text-slate-700">
          <p className="font-semibold text-slate-950">新地址</p>
          <p className="mt-1 break-all">{OPEN_TOKEN_BOARD_URL}</p>
          <p className="mt-4 font-semibold text-slate-950">仓库</p>
          <p className="mt-1 break-all">github.com/ffffhx/open-token-board</p>
        </div>
      </section>
    </main>
  );
}
