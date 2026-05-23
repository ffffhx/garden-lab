import type { ReactNode } from "react";

import { BlogPet } from "@/components/blog-pet";
import { PrivateFeatureGate } from "@/components/private-feature-access";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function SiteShell({
  children,
  showPet = true,
  currentPathname,
}: {
  children: ReactNode;
  showPet?: boolean;
  currentPathname?: string | null;
}) {
  return (
    <div className="site-grain min-h-screen">
      <SiteHeader currentPathname={currentPathname} />
      <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-7xl flex-col px-4 pb-16 pt-7 sm:px-6 lg:px-8">
        {children}
      </div>
      <SiteFooter />
      {showPet ? (
        <PrivateFeatureGate>
          <BlogPet />
        </PrivateFeatureGate>
      ) : null}
    </div>
  );
}
