import { describe, expect, it } from "vitest";

import { BLOG_PET_MAX_LEVEL, buildBlogPetMeal, buildBlogPetStats } from "../../lib/content/blog-pet";
import type { CategoryKey, PostSummary } from "../../lib/content/types";

function post(slug: string, date: string, categories: CategoryKey[]): PostSummary {
  return {
    slug,
    title: `${slug} title`,
    excerpt: "",
    categories,
    tags: [],
    date: new Date(`${date}T09:00:00`),
    dateText: date,
    readingTimeText: "1 min read",
    assetBasePath: `/post-assets/${slug}`,
    cover: null,
    coverPosition: "above-title",
  };
}

describe("buildBlogPetStats", () => {
  it("feeds the pet with category flavors and matching attributes", () => {
    const stats = buildBlogPetStats(
      [
        post("tech", "2026-05-05", ["tech"]),
        post("fitness", "2026-05-04", ["fitness"]),
        post("news-one", "2026-05-03", ["dailyNews"]),
        post("news-two", "2026-04-20", ["dailyNews"]),
      ],
      new Date("2026-05-05T12:00:00")
    );

    expect(stats.level).toBe(3);
    expect(stats.maxLevel).toBe(BLOG_PET_MAX_LEVEL);
    expect(stats.maxLevel).toBe(50);
    expect(stats.stage).toMatchObject({
      formLevel: 1,
      phase: 3,
      phaseLabel: "长出小特征",
    });
    expect(stats.appearanceMap).toHaveLength(11);
    expect(stats.appearanceMap[0]).toMatchObject({
      level: 0,
      name: "灵感胚",
      unlocked: true,
    });
    expect(stats.xp).toBe(286);
    expect(stats.streakDays).toBe(3);
    expect(stats.recentMeals).toBe(4);
    expect(stats.latestMeal?.foods[0]).toMatchObject({
      label: "代码脆片",
      attributeLabel: "智力",
    });
    expect(stats.favoriteFood).toMatchObject({
      category: "dailyNews",
      label: "热点糖粒",
    });
    expect(stats.attributes).toContainEqual(
      expect.objectContaining({ id: "speed", label: "速度", value: 6, maxValue: 200, ratio: 0.03 })
    );
    expect(stats.evolution).toMatchObject({ id: "balanced", label: "全能型" });
    expect(stats.achievements).toContainEqual(
      expect.objectContaining({ id: "allFlavors", layer: "balance", unlocked: true })
    );
    expect(stats.tasks).toContainEqual(
      expect.objectContaining({ id: "fiveDayStreak", title: "再连续发布 2 天，解锁连续五天投喂" })
    );
    expect(stats.evolutionRoutes).toContainEqual(
      expect.objectContaining({ id: "balanced", current: true })
    );
    expect(stats.growthTimeline[0]).toMatchObject({
      slug: "tech",
      level: 3,
      mealSummary: "代码脆片，智力 +3",
    });
  });

  it("reports hunger from the latest published meal", () => {
    const stats = buildBlogPetStats(
      [post("old", "2026-04-01", ["fitness"])],
      new Date("2026-05-05T12:00:00")
    );

    expect(stats.daysSinceLastMeal).toBe(34);
    expect(stats.hunger).toMatchObject({
      label: "饿到翻草稿箱",
      tone: "starving",
    });
  });

  it("keeps a stable empty state before the first post", () => {
    const stats = buildBlogPetStats([], new Date("2026-05-05T12:00:00"));

    expect(stats.level).toBe(1);
    expect(stats.xp).toBe(0);
    expect(stats.latestMeal).toBeNull();
    expect(stats.hunger).toMatchObject({
      label: "等第一篇投喂",
      tone: "empty",
    });
    expect(stats.tasks).toContainEqual(
      expect.objectContaining({ id: "techThirtyPosts", progress: 0, goal: 30 })
    );
    expect(stats.growthTimeline).toEqual([]);
  });

  it("supports ten visual forms across fifty levels", () => {
    const posts = Array.from({ length: 2500 }, (_, index) =>
      post(`deep-archive-${index}`, "2026-01-01", ["tech"])
    );
    const stats = buildBlogPetStats(posts, new Date("2026-05-05T12:00:00"));

    expect(stats.level).toBe(50);
    expect(stats.stage).toMatchObject({
      formLevel: 10,
      phase: 5,
      name: "炎翼博客星灵",
    });
  });

  it("unlocks category milestones and code evolution from writing history", () => {
    const posts = Array.from({ length: 10 }, (_, index) =>
      post(`tech-${index}`, `2026-04-${String(index + 1).padStart(2, "0")}`, ["tech"])
    );
    const stats = buildBlogPetStats(posts, new Date("2026-05-05T12:00:00"));

    expect(stats.evolution).toMatchObject({ id: "code", label: "代码型" });
    expect(stats.achievements).toContainEqual(
      expect.objectContaining({ id: "firstTechPost", unlocked: true })
    );
    expect(stats.achievements).toContainEqual(
      expect.objectContaining({ id: "categoryTenPosts", layer: "category", unlocked: true })
    );
    expect(stats.achievements).toContainEqual(
      expect.objectContaining({ id: "fiveDayStreak", layer: "continuity", unlocked: true })
    );
    expect(stats.foodStats).toContainEqual(
      expect.objectContaining({ category: "tech", count: 10, attributeGain: 30 })
    );
  });

  it("turns writing history into concrete next tasks and timeline unlocks", () => {
    const posts = [
      ...Array.from({ length: 23 }, (_, index) =>
        post(`tech-${index}`, `2026-04-${String(index + 1).padStart(2, "0")}`, ["tech"])
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        post(`fitness-${index}`, `2026-03-${String(index + 1).padStart(2, "0")}`, ["fitness"])
      ),
      ...Array.from({ length: 7 }, (_, index) =>
        post(`daily-${index}`, `2026-02-${String(index + 1).padStart(2, "0")}`, ["dailyNews"])
      ),
    ];
    const stats = buildBlogPetStats(posts, new Date("2026-05-05T12:00:00"));

    expect(stats.tasks).toContainEqual(
      expect.objectContaining({
        id: "balanceSpeedWithStamina",
        title: "再发 1 篇热点，速度追平体力",
      })
    );
    expect(stats.tasks).toContainEqual(
      expect.objectContaining({
        id: "techThirtyPosts",
        progressText: "23/30",
      })
    );
    expect(stats.achievements).toContainEqual(
      expect.objectContaining({
        id: "annualThirtyPosts",
        layer: "annual",
        unlocked: true,
      })
    );
    expect(stats.growthTimeline.some((event) => event.unlockedAchievements.length > 0)).toBe(true);
  });

  it("builds per-post meal summaries for article feed badges", () => {
    const meal = buildBlogPetMeal(post("daily", "2026-05-05", ["dailyNews"]));

    expect(meal.summary).toBe("热点糖粒，速度 +3");
    expect(meal.attributeGain).toBe(3);
  });
});
