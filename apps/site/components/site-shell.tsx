import type { ReactNode } from "react";

import { BlogPet } from "@/components/blog-pet";
import { PrivateFeatureGate } from "@/components/private-feature-access";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils/cn";

export function SiteShell({
  children,
  showPet = true,
  currentPathname,
}: {
  children: ReactNode;
  showPet?: boolean;
  currentPathname?: string | null;
}) {
  const shellClassName = "site-grain min-h-screen";
  const isPostRoute = currentPathname?.startsWith("/post/") ?? false;
  const frameWidthClassName = isPostRoute ? "max-w-[1680px] 2xl:px-10" : "max-w-7xl";
  const contentClassName = cn(
    "mx-auto flex min-h-[calc(100vh-9rem)] w-full flex-col px-4 pb-16 pt-7 sm:px-6 lg:px-8",
    frameWidthClassName
  );

  return (
    <div className={shellClassName}>
      <SiteHeader currentPathname={currentPathname} wide={isPostRoute} />
      <div className={contentClassName}>{children}</div>
      <SiteFooter wide={isPostRoute} />
      {showPet ? (
        <PrivateFeatureGate>
          <BlogPet />
        </PrivateFeatureGate>
      ) : null}
    </div>
  );
}
