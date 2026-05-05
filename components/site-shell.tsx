import type { ReactNode } from "react";

import { BlogPet } from "@/components/blog-pet";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(180,83,9,0.15),transparent_28%),linear-gradient(180deg,#fffaf1_0%,#f3ecdf_100%)]">
      <SiteHeader />
      <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-7xl flex-col px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        {children}
      </div>
      <SiteFooter />
      <BlogPet />
    </div>
  );
}
