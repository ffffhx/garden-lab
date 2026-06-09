import { SITE } from "@/lib/content/config";
import { cn } from "@/lib/utils/cn";

export function SiteFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer className="border-t border-slate-900/10 bg-[#fffdf7]/70 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-2 px-4 py-6 text-sm text-slate-600 sm:px-6 lg:px-8",
          wide ? "max-w-[1680px] 2xl:px-10" : "max-w-7xl"
        )}
      >
        <p className="font-semibold text-slate-950">{SITE.title}</p>
        <p>{SITE.subtitle}</p>
      </div>
    </footer>
  );
}
