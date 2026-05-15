import type { Metadata } from "next";

import { ArticleBody } from "@/components/article-body";
import { getAboutPage } from "@/lib/content/pages";
import { formatDate } from "@/lib/utils/date";

export const metadata: Metadata = {
  title: "关于",
};

export default function AboutPage() {
  const page = getAboutPage();

  return (
    <main className="mx-auto w-full max-w-4xl">
      <article className="rounded-[2rem] border border-slate-900/10 bg-white/88 p-7 shadow-[0_32px_120px_-68px_rgba(15,23,42,0.65)] sm:p-10">
        <div className="mb-8 space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">About</p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{page.title}</h1>
          {page.date ? (
            <p className="text-sm text-slate-500">{formatDate(page.date)}</p>
          ) : null}
        </div>
        <ArticleBody html={page.contentHtml} />
      </article>
    </main>
  );
}
