import {
  getDailyNewsIssueDateSlug,
  isDailyNewsIssueTitle,
} from "@/lib/content/daily-news-date";
import { getDailyNewsPosts, getPostBySlug } from "@/lib/content/posts";
import type { Post, PostSummary } from "@/lib/content/types";

export {
  extractDailyNewsIssueDateSlug,
  formatDailyNewsDateSlug,
  getDailyNewsIssueDateSlug,
  isDailyNewsIssueTitle,
} from "@/lib/content/daily-news-date";

export type DailyNewsEntry = PostSummary & {
  dateSlug: string;
  href: string;
  leadStory: string;
  storyCount: number;
  storyCountText: string;
  readingTimeCompact: string;
  archiveMetaText: string;
};

const DAILY_NEWS_STORY_HEADING_PATTERN = /^\s*\d+[.、]\s*(.+?)\s*$/;
const DAILY_NEWS_META_HEADINGS = [
  "今日重点",
  "Codex/Claude Code 更新追踪",
  "我的观察",
  "来源列表",
];

const DAY_MS = 24 * 60 * 60 * 1000;

const DAILY_NEWS_TOPIC_DEFINITIONS = [
  {
    label: "AI 产品落地",
    terms: ["产品", "Enterprise", "Slack", "团队", "工作流", "协作", "入口", "平台", "部署"],
  },
  {
    label: "coding agent",
    terms: ["Codex", "Claude Code", "Cursor", "coding", "代码", "补丁", "开发者", "agent"],
  },
  {
    label: "硬件入口",
    terms: ["眼镜", "硬件", "设备", "Apple", "手机", "内存", "存储"],
  },
  {
    label: "内容授权",
    terms: ["Cloudflare", "beehiiv", "Crawl", "创作者", "内容", "授权", "爬虫"],
  },
  {
    label: "AI 基础设施",
    terms: ["TOP500", "LineShine", "算力", "数据中心", "GPU", "超级计算", "供应链"],
  },
  {
    label: "安全与治理",
    terms: ["Security", "安全", "政策", "风险", "调查", "漏洞", "治理"],
  },
  {
    label: "AI 创作",
    terms: ["视频", "Seedance", "素材", "创作", "生成"],
  },
];

export type DailyNewsArchiveMonth = {
  key: string;
  label: string;
  entries: DailyNewsEntry[];
};

export type DailyNewsIssueNavigation = {
  newer: DailyNewsEntry | null;
  older: DailyNewsEntry | null;
  random: DailyNewsEntry | null;
};

export type DailyNewsCurrentThread = {
  label: string;
  title: string;
  summary: string;
  topics: string[];
  entries: DailyNewsEntry[];
};

function cleanStoryHeading(text: string) {
  return text
    .replace(DAILY_NEWS_STORY_HEADING_PATTERN, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isMetaHeading(text: string) {
  const normalized = cleanStoryHeading(text);

  return DAILY_NEWS_META_HEADINGS.some((heading) => normalized.startsWith(heading));
}

export function extractDailyNewsStories(post: Pick<Post, "headings">) {
  return post.headings
    .filter((heading) => {
      return heading.depth === 2 && DAILY_NEWS_STORY_HEADING_PATTERN.test(heading.text);
    })
    .map((heading) => cleanStoryHeading(heading.text))
    .filter(Boolean);
}

export function extractDailyNewsLeadStory(post: Pick<Post, "headings">) {
  const [numberedStory] = extractDailyNewsStories(post);

  if (numberedStory) {
    return numberedStory;
  }

  const firstStoryHeading = post.headings.find((heading) => {
    return heading.depth === 2 && !isMetaHeading(heading.text);
  });

  return firstStoryHeading ? cleanStoryHeading(firstStoryHeading.text) : "";
}

function formatReadingTimeCompact(readingTimeText: string) {
  return readingTimeText.replace(/\s+read$/i, "").trim();
}

function formatStoryCountText(storyCount: number) {
  return storyCount > 0 ? `${storyCount} 条热点` : "热点速览";
}

function toDailyNewsEntry(post: PostSummary): DailyNewsEntry {
  const dateSlug = getDailyNewsIssueDateSlug(post.title, post.date);
  const fullPost = getPostBySlug(post.slug);
  const stories = fullPost ? extractDailyNewsStories(fullPost) : [];
  const storyCountText = formatStoryCountText(stories.length);
  const readingTimeCompact = formatReadingTimeCompact(post.readingTimeText);

  return {
    ...post,
    dateSlug,
    href: `/daily-news/${dateSlug}`,
    leadStory: fullPost ? extractDailyNewsLeadStory(fullPost) : "",
    storyCount: stories.length,
    storyCountText,
    readingTimeCompact,
    archiveMetaText: `${storyCountText} · ${readingTimeCompact}`,
  };
}

export function getDailyNewsEntries() {
  const seenDateSlugs = new Set<string>();

  return getDailyNewsPosts()
    .filter((post) => isDailyNewsIssueTitle(post.title))
    .map(toDailyNewsEntry)
    .filter((entry) => {
      if (seenDateSlugs.has(entry.dateSlug)) {
        return false;
      }

      seenDateSlugs.add(entry.dateSlug);
      return true;
    });
}

export function getAllDailyNewsDateSlugs() {
  return getDailyNewsEntries().map((entry) => entry.dateSlug);
}

export function getLatestDailyNewsEntry() {
  return getDailyNewsEntries()[0] ?? null;
}

export function getDailyNewsEntryByDateSlug(dateSlug: string) {
  return getDailyNewsEntries().find((entry) => entry.dateSlug === dateSlug) ?? null;
}

export function getDailyNewsArchiveMonths(entries: DailyNewsEntry[]) {
  const groups: DailyNewsArchiveMonth[] = [];

  for (const entry of entries) {
    const [year, month] = entry.dateSlug.split("-");
    const key = `${year}-${month}`;
    const existingGroup = groups.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.entries.push(entry);
      continue;
    }

    groups.push({
      key,
      label: `${year} 年 ${Number(month)} 月 · 1 期`,
      entries: [entry],
    });
  }

  return groups.map((group) => ({
    ...group,
    label: `${group.key.slice(0, 4)} 年 ${Number(group.key.slice(5))} 月 · ${
      group.entries.length
    } 期`,
  }));
}

function hashString(input: string) {
  return Array.from(input).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 7);
}

export function getDailyNewsIssueNavigation(
  entries: DailyNewsEntry[],
  activeDateSlug: string
): DailyNewsIssueNavigation {
  const activeIndex = entries.findIndex((entry) => entry.dateSlug === activeDateSlug);
  const randomCandidates = entries.filter((entry) => entry.dateSlug !== activeDateSlug);

  return {
    newer: activeIndex > 0 ? entries[activeIndex - 1] : null,
    older:
      activeIndex >= 0 && activeIndex < entries.length - 1 ? entries[activeIndex + 1] : null,
    random: randomCandidates[hashString(activeDateSlug) % randomCandidates.length] ?? null,
  };
}

function parseDateSlugTime(dateSlug: string) {
  return Date.parse(`${dateSlug}T00:00:00.000Z`);
}

function getRecentDailyNewsEntries(entries: DailyNewsEntry[], days: number) {
  const latestTime = parseDateSlugTime(entries[0]?.dateSlug ?? "");

  if (!Number.isFinite(latestTime)) {
    return [];
  }

  const threshold = latestTime - (days - 1) * DAY_MS;

  return entries.filter((entry) => {
    const entryTime = parseDateSlugTime(entry.dateSlug);
    return Number.isFinite(entryTime) && entryTime <= latestTime && entryTime >= threshold;
  });
}

function formatChineseList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]}与${items[1]}`;
  }

  return `${items.slice(0, -1).join("、")}与${items[items.length - 1]}`;
}

function getTopicScore(topic: (typeof DAILY_NEWS_TOPIC_DEFINITIONS)[number], entries: DailyNewsEntry[]) {
  return entries.reduce((score, entry) => {
    const text = `${entry.title} ${entry.leadStory} ${entry.tags.join(" ")}`.toLowerCase();
    const matched = topic.terms.some((term) => text.includes(term.toLowerCase()));

    return score + (matched ? 1 : 0);
  }, 0);
}

export function getDailyNewsCurrentThread(entries: DailyNewsEntry[]): DailyNewsCurrentThread {
  const recentEntries = getRecentDailyNewsEntries(entries, 7);
  const scoredTopics = DAILY_NEWS_TOPIC_DEFINITIONS.map((topic) => ({
    label: topic.label,
    score: getTopicScore(topic, recentEntries),
  }))
    .filter((topic) => topic.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
  const topics = scoredTopics.slice(0, 3).map((topic) => topic.label);
  const topicText = formatChineseList(topics);
  const leadStories = recentEntries
    .map((entry) => entry.leadStory)
    .filter(Boolean)
    .slice(0, 3);

  return {
    label: `最近 7 天 · ${recentEntries.length} 期`,
    title: topicText ? `${topicText}成为当前主线` : "最近 7 天热点正在向产品现场收束",
    summary: leadStories.length
      ? `${leadStories.join("；")} 等事件连在一起看，焦点已经不只是模型发布，而是入口、权限、成本和协作现场怎样真正落地。`
      : "最近几期的新闻焦点正在从单点发布转向入口、权限、成本和协作现场怎样真正落地。",
    topics,
    entries: recentEntries,
  };
}

export function getDailyNewsPostByDateSlug(dateSlug: string): Post | null {
  const entry = getDailyNewsEntryByDateSlug(dateSlug);

  if (!entry) {
    return null;
  }

  return getPostBySlug(entry.slug);
}

export function getLatestDailyNewsPost() {
  const latest = getLatestDailyNewsEntry();

  if (!latest) {
    return null;
  }

  return getPostBySlug(latest.slug);
}
