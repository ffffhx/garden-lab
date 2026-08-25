"use client";

import React from "react";

import { usePrivateFeatureAccess } from "@/components/private-feature-access";

export function HeaderAuthorBadge() {
  const access = usePrivateFeatureAccess();

  if (access.status !== "allowed") {
    return null;
  }

  const loginName = access.viewer?.user?.githubLogin || "ffffhx";
  const logoutUrl = access.apiBaseUrl
    ? `${access.apiBaseUrl}/api/auth/logout?returnTo=${encodeURIComponent(
        typeof window !== "undefined" ? window.location.href : "/"
      )}`
    : "#";

  return (
    <div className="hidden sm:inline-flex items-center gap-1.5">
      <span
        title={`已登录作者：@${loginName}`}
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[0.7rem] font-medium text-amber-800"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        作者模式
      </span>
      <a
        href={logoutUrl}
        title="注销作者登录"
        className="font-mono-ui text-[0.68rem] text-muted hover:text-red transition"
      >
        退出
      </a>
    </div>
  );
}
