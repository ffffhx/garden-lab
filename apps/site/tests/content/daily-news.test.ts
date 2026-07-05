import { describe, expect, it } from "vitest";

import {
  extractDailyNewsLeadStory,
  extractDailyNewsStories,
  getAllDailyNewsDateSlugs,
  getDailyNewsArchiveMonths,
  getDailyNewsCurrentThread,
  getDailyNewsEntries,
  getDailyNewsIssueNavigation,
  getDailyNewsPostByDateSlug,
  getLatestDailyNewsEntry,
  getLatestDailyNewsPost,
} from "../../lib/content/daily-news";

const POST_SCAN_TIMEOUT_MS = 45_000;

describe("daily news module content", () => {
  it("builds unique date-based entries from daily news posts", () => {
    const entries = getDailyNewsEntries();
    const dateSlugs = getAllDailyNewsDateSlugs();

    expect(entries.length).toBeGreaterThan(0);
    expect(dateSlugs).toEqual(entries.map((entry) => entry.dateSlug));
    expect(new Set(dateSlugs).size).toBe(dateSlugs.length);
    expect(dateSlugs.every((dateSlug) => /^\d{4}-\d{2}-\d{2}$/.test(dateSlug))).toBe(true);
    expect(dateSlugs).toContain("2026-05-02");
    expect(entries.map((entry) => entry.slug)).not.toContain(
      "codex-april-2026-updates-from-code-agent-to-workbench"
    );
    expect(entries.every((entry) => entry.leadStory.length > 0)).toBe(true);
    expect(entries.every((entry) => entry.storyCount > 0)).toBe(true);
    expect(entries.every((entry) => /^\d+ 条热点 · \d+ min$/.test(entry.archiveMetaText))).toBe(
      true
    );
  }, POST_SCAN_TIMEOUT_MS);

  it("uses the first numbered news heading as the archive lead story", () => {
    expect(
      extractDailyNewsLeadStory({
        headings: [
          { depth: 2, id: "focus", text: "今日重点" },
          {
            depth: 2,
            id: "story-1",
            text: "1. Meta 推出自有品牌 AI 眼镜：智能硬件开始用价格和样式抢日常入口",
          },
          {
            depth: 2,
            id: "story-2",
            text: "2. Anthropic 发布 Claude Tag：团队协作里的 agent 从工具变成频道成员",
          },
        ],
      })
    ).toBe("Meta 推出自有品牌 AI 眼镜：智能硬件开始用价格和样式抢日常入口");
    expect(
      extractDailyNewsStories({
        headings: [
          { depth: 2, id: "focus", text: "今日重点" },
          {
            depth: 2,
            id: "story-1",
            text: "1. Meta 推出自有品牌 AI 眼镜：智能硬件开始用价格和样式抢日常入口",
          },
          {
            depth: 2,
            id: "story-2",
            text: "2. Anthropic 发布 Claude Tag：团队协作里的 agent 从工具变成频道成员",
          },
        ],
      })
    ).toEqual([
      "Meta 推出自有品牌 AI 眼镜：智能硬件开始用价格和样式抢日常入口",
      "Anthropic 发布 Claude Tag：团队协作里的 agent 从工具变成频道成员",
    ]);
  });

  it("groups the archive by month", () => {
    const entries = getDailyNewsEntries();
    const groups = getDailyNewsArchiveMonths(entries);
    const juneGroup = groups.find((group) => group.key === "2026-06");

    expect(groups.length).toBeGreaterThan(0);
    expect(juneGroup?.label).toMatch(/^2026 年 6 月 · \d+ 期$/);
    expect(juneGroup?.entries.every((entry) => entry.dateSlug.startsWith("2026-06"))).toBe(true);
  }, POST_SCAN_TIMEOUT_MS);

  it("builds current-thread and issue navigation data", () => {
    const entries = getDailyNewsEntries();
    const latestEntry = entries[0];
    const thread = getDailyNewsCurrentThread(entries);
    const navigation = getDailyNewsIssueNavigation(entries, latestEntry.dateSlug);

    expect(thread.label).toMatch(/^最近 7 天 · \d+ 期$/);
    expect(thread.title).toContain("当前主线");
    expect(thread.summary).not.toBe(latestEntry.excerpt);
    expect(thread.entries.length).toBeGreaterThan(0);
    expect(navigation.newer).toBeNull();
    expect(navigation.older?.dateSlug).toBe(entries[1]?.dateSlug);
    expect(navigation.random?.dateSlug).not.toBe(latestEntry.dateSlug);
  });

  it("resolves the latest issue and date route back to the full post", () => {
    const latestEntry = getLatestDailyNewsEntry();
    const latestPost = getLatestDailyNewsPost();

    expect(latestEntry).not.toBeNull();
    expect(latestPost).not.toBeNull();
    expect(latestPost?.slug).toBe(latestEntry?.slug);
    expect(getDailyNewsPostByDateSlug(latestEntry?.dateSlug ?? "")?.slug).toBe(latestEntry?.slug);
    expect(getDailyNewsPostByDateSlug("1999-01-01")).toBeNull();
  }, POST_SCAN_TIMEOUT_MS);
});
