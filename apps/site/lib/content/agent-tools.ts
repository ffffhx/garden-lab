import { CATEGORY_DEFINITIONS } from "@/lib/content/config";
import type { CategoryKey, PostCardSummary } from "@/lib/content/types";
import { normalizeBasePath, withBasePath } from "@/lib/utils/site-path";

export type AgentPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  categories: Array<{
    key: CategoryKey;
    slug: string;
    label: string;
  }>;
  tags: string[];
  dateText: string;
  readingTimeText: string;
  url: string;
};

export type AgentPostSearchInput = {
  query?: unknown;
  category?: unknown;
  limit?: unknown;
};

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function getLimit(value: unknown, fallback = DEFAULT_LIMIT) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsed)));
}

export function normalizeAgentCategory(value: unknown) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  return (
    Object.values(CATEGORY_DEFINITIONS).find((category) => {
      return [category.key, category.slug, category.label].some((candidate) => {
        return normalizeText(candidate) === normalized;
      });
    })?.key ?? null
  );
}

export function buildAgentPostIndex(
  posts: PostCardSummary[],
  basePath = process.env.NEXT_PUBLIC_BASE_PATH
): AgentPostSummary[] {
  return posts.map((post) => {
    return {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      categories: post.categories.map((categoryKey) => {
        const category = CATEGORY_DEFINITIONS[categoryKey];

        return {
          key: category.key,
          slug: category.slug,
          label: category.label,
        };
      }),
      tags: post.tags,
      dateText: post.dateText,
      readingTimeText: post.readingTimeText,
      url: withBasePath(`/post/${post.slug}/`, basePath),
    };
  });
}

function matchesCategory(post: AgentPostSummary, category: CategoryKey | null) {
  if (!category) {
    return true;
  }

  return post.categories.some((postCategory) => postCategory.key === category);
}

function scorePost(post: AgentPostSummary, terms: string[]) {
  const title = normalizeText(post.title);
  const excerpt = normalizeText(post.excerpt);
  const tags = normalizeText(post.tags.join(" "));
  const categories = normalizeText(
    post.categories.map((category) => category.label).join(" ")
  );
  const haystack = [title, excerpt, tags, categories].join(" ");

  if (!terms.every((term) => haystack.includes(term))) {
    return 0;
  }

  return terms.reduce((score, term) => {
    if (title.includes(term)) {
      return score + 4;
    }

    if (tags.includes(term)) {
      return score + 3;
    }

    if (categories.includes(term)) {
      return score + 2;
    }

    return score + 1;
  }, 0);
}

export function searchAgentPosts(
  posts: AgentPostSummary[],
  input: AgentPostSearchInput
) {
  const query = normalizeText(input.query);
  const category = normalizeAgentCategory(input.category);
  const limit = getLimit(input.limit);

  if (!query) {
    return [];
  }

  const terms = query.split(" ");

  return posts
    .map((post, index) => {
      return {
        post,
        index,
        score: matchesCategory(post, category) ? scorePost(post, terms) : 0,
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => {
      return right.score - left.score || left.index - right.index;
    })
    .slice(0, limit)
    .map((result) => result.post);
}

export function listRecentAgentPosts(
  posts: AgentPostSummary[],
  input: Pick<AgentPostSearchInput, "category" | "limit"> = {}
) {
  const category = normalizeAgentCategory(input.category);
  const limit = getLimit(input.limit);

  return posts.filter((post) => matchesCategory(post, category)).slice(0, limit);
}

export function getAgentPostBySlug(posts: AgentPostSummary[], slug: unknown) {
  const normalizedSlug = String(slug ?? "").trim();

  if (!normalizedSlug) {
    return null;
  }

  return posts.find((post) => post.slug === normalizedSlug) ?? null;
}

export function extractPostSlugFromPathname(
  pathname: string,
  basePath = process.env.NEXT_PUBLIC_BASE_PATH
) {
  const normalizedBasePath = normalizeBasePath(basePath);
  let normalizedPathname = pathname || "/";

  if (
    normalizedBasePath &&
    (normalizedPathname === normalizedBasePath ||
      normalizedPathname.startsWith(`${normalizedBasePath}/`))
  ) {
    normalizedPathname = normalizedPathname.slice(normalizedBasePath.length) || "/";
  }

  const match = normalizedPathname.match(/^\/post\/([^/]+)\/?$/);

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
