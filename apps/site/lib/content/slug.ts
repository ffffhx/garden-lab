import crypto from "node:crypto";

function shortHash(input: string, length = 6) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, length);
}

export function slugifyPostStem(stem: string) {
  const asciiTokens = stem.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const base =
    asciiTokens.length > 0
      ? asciiTokens.join("-")
      : stem
          .trim()
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[^\p{Letter}\p{Number}]+/gu, "-");

  return base.replace(/-+/g, "-").replace(/^-|-$/g, "") || shortHash(stem);
}

export function ensureUniqueSlug(
  baseSlug: string,
  seed: string,
  taken: Set<string>
) {
  let slug = baseSlug;

  if (!taken.has(slug)) {
    taken.add(slug);
    return slug;
  }

  const suffix = shortHash(seed);
  slug = `${baseSlug}-${suffix}`;
  let counter = 2;

  while (taken.has(slug)) {
    slug = `${baseSlug}-${suffix}-${counter}`;
    counter += 1;
  }

  taken.add(slug);
  return slug;
}
