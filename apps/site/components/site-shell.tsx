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
  const normalizedPathname =
    currentPathname && currentPathname !== "/"
      ? currentPathname.replace(/\/+$/, "")
      : currentPathname;
  const isSnapshotsIndex = normalizedPathname === "/snapshots";
  const shellClassName = isSnapshotsIndex
    ? "site-grain flex h-screen min-h-0 flex-col overflow-hidden"
    : "site-grain min-h-screen";
  const contentClassName = isSnapshotsIndex
    ? "mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden px-2 pb-2 pt-2 sm:px-4 lg:px-6"
    : "mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-7xl flex-col px-4 pb-16 pt-7 sm:px-6 lg:px-8";

  return (
    <div className={shellClassName}>
      <SiteHeader currentPathname={currentPathname} />
      <div className={contentClassName}>{children}</div>
      {isSnapshotsIndex ? null : <SiteFooter />}
      {showPet ? (
        <PrivateFeatureGate>
          <BlogPet />
        </PrivateFeatureGate>
      ) : null}
    </div>
  );
}
