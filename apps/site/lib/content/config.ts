import type { CategoryDefinition, CategoryKey } from "@/lib/content/types";

export const SITE = {
  title: "个人博客",
  subtitle: "技术、健身与每日新闻",
  description: "记录技术学习、工程实践、健身过程和每日新闻观察。",
  author: "你的名字",
};

export const TOC_MIN_HEADINGS = 3;

export const CATEGORY_LABEL_TO_KEY: Record<string, CategoryKey> = {
  技术: "tech",
  健身: "fitness",
  每日新闻: "dailyNews",
};

export const CATEGORY_DEFINITIONS: Record<CategoryKey, CategoryDefinition> = {
  tech: {
    key: "tech",
    slug: "tech",
    label: "技术",
    description: "源码解析、工程实践、工具使用和问题排查。",
  },
  fitness: {
    key: "fitness",
    slug: "fitness",
    label: "健身",
    description: "训练记录、动作笔记、饮食复盘和阶段总结。",
  },
  dailyNews: {
    key: "dailyNews",
    slug: "daily-news",
    label: "每日新闻",
    description: "AI、前端与工程圈每天值得关注的热点速览。",
  },
};
