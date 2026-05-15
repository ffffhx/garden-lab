import { SITE } from "@/lib/content/config";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-900/10 bg-[#fffdf7]/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-slate-600 sm:px-6 lg:px-8">
        <p className="font-semibold text-slate-950">{SITE.title}</p>
        <p>{SITE.subtitle}</p>
      </div>
    </footer>
  );
}
