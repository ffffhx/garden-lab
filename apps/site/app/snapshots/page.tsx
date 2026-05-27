import type { Metadata } from "next";

import { withBasePath } from "@/lib/utils/site-path";

const CODEX_SNAPSHOTS_URL =
  process.env.NEXT_PUBLIC_CODEX_SNAPSHOTS_URL || withBasePath("/codex-snapshots/index.html");

export const metadata: Metadata = {
  title: "Codex Snapshots",
  description: "会话快照独立项目入口。",
};

export default function SnapshotsPage() {
  return (
    <main className="mx-auto grid min-h-[58vh] w-full max-w-4xl place-items-center py-16">
      <section className="w-full border border-slate-900/10 bg-[#fffdf7]/86 p-8 shadow-[0_32px_120px_-72px_rgba(15,23,42,0.62)] sm:p-10">
        <p className="font-mono text-xs font-black uppercase tracking-[0.08em] text-[#245d83]">
          Standalone project
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-none tracking-normal text-slate-950 sm:text-6xl">
          Codex Snapshots
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
          会话快照已经拆成独立项目。Garden Lab 保留入口，实际审阅台、文档和分享页都放到新站点维护。
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href={CODEX_SNAPSHOTS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-5 font-mono text-xs font-black uppercase text-white transition hover:bg-[#8f3f18] focus:outline-none focus:ring-4 focus:ring-[#245d83]/15"
          >
            打开新站点
          </a>
          <a
            href="http://127.0.0.1:4321/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-950/12 bg-white px-5 font-mono text-xs font-black uppercase text-slate-700 transition hover:border-slate-950/25 hover:text-slate-950"
          >
            打开本机 Viewer
          </a>
        </div>
      </section>
    </main>
  );
}
