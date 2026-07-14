"use client";

import { useEffect } from "react";

import { withBasePath } from "@/lib/utils/site-path";

// 仅在生产构建注册 Service Worker，避免 dev 环境缓存干扰调试
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register(withBasePath("/sw.js"))
      .catch(() => {
        /* 注册失败不影响正常浏览 */
      });
  }, []);

  return null;
}
