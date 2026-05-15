import path from "node:path";

import { withBasePath } from "@/lib/utils/site-path";

const ABSOLUTE_URL_RE = /^(?:[a-z]+:)?\/\//i;
const OPTIMIZABLE_IMAGE_EXTENSION_RE = /\.(?:png|jpe?g)(?=$|[?#])/i;

function toPosix(value: string) {
  return value.split(path.sep).join("/");
}

function encodePathSegment(segment: string) {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

function encodeLocalUrlPath(assetUrl: string) {
  if (ABSOLUTE_URL_RE.test(assetUrl) || assetUrl.startsWith("data:")) {
    return assetUrl;
  }

  const [, pathname = "", suffix = ""] = assetUrl.match(/^([^?#]*)(.*)$/) ?? [];
  return `${pathname.split("/").map(encodePathSegment).join("/")}${suffix}`;
}

export function normalizeAssetUrl(assetBasePath: string, assetName: string) {
  const cleanedBase = assetBasePath.replace(/\/+$/, "");
  const cleanedName = assetName.trim().replace(/^\.?\//, "");
  return encodeLocalUrlPath(`${cleanedBase}/${cleanedName}`);
}

export function resolvePostAssetUrl(assetBasePath: string, assetPath: unknown) {
  const normalized = String(assetPath ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("/")) {
    return encodeLocalUrlPath(withBasePath(normalized));
  }

  return normalizeAssetUrl(assetBasePath, normalized);
}

export function resolveOptimizedAssetUrl(assetUrl: string) {
  if (ABSOLUTE_URL_RE.test(assetUrl) || assetUrl.startsWith("data:")) {
    return assetUrl;
  }

  return encodeLocalUrlPath(assetUrl.replace(OPTIMIZABLE_IMAGE_EXTENSION_RE, ".webp"));
}

export function resolveOptimizedPostAssetUrl(
  assetBasePath: string,
  assetPath: unknown
) {
  const assetUrl = resolvePostAssetUrl(assetBasePath, assetPath);
  return assetUrl ? resolveOptimizedAssetUrl(assetUrl) : null;
}

export function getPostAssetBasePath(relativeMarkdownPath: string) {
  const normalized = toPosix(relativeMarkdownPath);
  const parsed = path.posix.parse(normalized);
  return withBasePath(`/post-assets/${parsed.dir}/${parsed.name}`);
}
