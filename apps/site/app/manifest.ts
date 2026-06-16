import type { MetadataRoute } from "next";

import { SITE } from "@/lib/content/config";
import { withBasePath } from "@/lib/utils/site-path";

// 静态导出（output: export）下生成 /manifest.webmanifest
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.title,
    short_name: SITE.title,
    description: SITE.description,
    start_url: withBasePath("/"),
    scope: withBasePath("/"),
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#f4efe4",
    icons: [
      {
        src: withBasePath("/images/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: withBasePath("/images/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: withBasePath("/images/icon-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
