import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center">
      <div className="w-full rounded-[2rem] border border-slate-900/10 bg-white/82 px-8 py-16 text-center shadow-[0_32px_120px_-68px_rgba(15,23,42,0.65)]">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
          页面不存在
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-slate-600">
          这条链接可能已经失效，或者你访问的是旧站点路径。
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
