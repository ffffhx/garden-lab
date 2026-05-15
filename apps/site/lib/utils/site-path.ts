const ABSOLUTE_URL_RE = /^(?:[a-z]+:)?\/\//i;

export function normalizeBasePath(basePath = "") {
  if (!basePath || basePath === "/") {
    return "";
  }

  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

export function withBasePath(
  pathname: string,
  basePath = process.env.NEXT_PUBLIC_BASE_PATH
) {
  if (ABSOLUTE_URL_RE.test(pathname) || pathname.startsWith("data:")) {
    return pathname;
  }

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalizedBasePath = normalizeBasePath(basePath);

  if (!normalizedBasePath) {
    return normalizedPath;
  }

  return `${normalizedBasePath}${normalizedPath}`;
}
