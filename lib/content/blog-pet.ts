import type { CategoryKey, PostSummary } from "@/lib/content/types";

export const BLOG_PET_MAX_LEVEL = 50;
export const BLOG_PET_LEVEL_THRESHOLDS = Array.from(
  { length: BLOG_PET_MAX_LEVEL },
  (_, index) => {
    if (index === 0) {
      return 0;
    }

    if (index === 1) {
      return 120;
    }

    if (index === 2) {
      return 280;
    }

    const lateLevel = index - 2;

    return Math.round(280 + lateLevel * 160 + lateLevel * (lateLevel + 1) * 28);
  }
);
export const BLOG_PET_SNAPSHOT_VERSION = 3;
export const BLOG_PET_SNAPSHOT_PUBLIC_PATH = "/pet/stats.json";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 30;
const LONGFORM_READING_MINUTES = 8;
const BASE_MEAL_XP = 28;
const FLAVOR_XP = 7;
const RECENT_MEAL_XP = 14;
const STREAK_DAY_XP = 10;
const DIVERSITY_XP = 20;
const ATTRIBUTE_GAIN_PER_FOOD = 3;
const ATTRIBUTE_VALUE_CAP = 200;
const FIVE_DAY_STREAK_GOAL = 5;
const TECH_ROUTE_GOAL = 30;
const LONGFORM_GOAL = 10;
const SERIES_GOAL = 3;
const ANNUAL_GOAL = 30;

export type BlogPetAttributeId = "intelligence" | "stamina" | "speed";
export type BlogPetHungerTone = "empty" | "full" | "steady" | "hungry" | "starving";
export type BlogPetEvolutionId = "code" | "training" | "intel" | "balanced";
export type BlogPetAchievementLayer =
  | "continuity"
  | "balance"
  | "category"
  | "longform"
  | "series"
  | "annual";
export type BlogPetAchievementId =
  | "firstTechPost"
  | "threeDayStreak"
  | "allFlavors"
  | "categoryTenPosts"
  | "fiveDayStreak"
  | "balancedTenPosts"
  | "tenLongPosts"
  | "firstSeries"
  | "annualThirtyPosts"
  | "techThirtyPosts";
export type BlogPetTaskId =
  | "balanceSpeedWithStamina"
  | "fiveDayStreak"
  | "techThirtyPosts";

export type BlogPetFood = {
  category: CategoryKey;
  label: string;
  shortLabel: string;
  attributeId: BlogPetAttributeId;
  attributeLabel: string;
};

export type BlogPetAttribute = {
  id: BlogPetAttributeId;
  label: string;
  value: number;
  maxValue: number;
  ratio: number;
};

export type BlogPetStage = {
  level: number;
  formLevel: number;
  phase: number;
  name: string;
  title: string;
  mood: string;
  phaseLabel: string;
  growthHint: string;
};

export type BlogPetMeal = {
  title: string;
  slug: string;
  dateText: string;
  foods: BlogPetFood[];
  attributeGain: number;
  summary: string;
};

export type BlogPetFoodStat = BlogPetFood & {
  count: number;
  attributeGain: number;
  ratio: number;
};

export type BlogPetAchievement = {
  id: BlogPetAchievementId;
  layer: BlogPetAchievementLayer;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  goal: number;
  progressText: string;
};

export type BlogPetEvolution = {
  id: BlogPetEvolutionId;
  label: string;
  title: string;
  description: string;
  traitLabel: string;
  voiceLabel: string;
};

export type BlogPetTask = {
  id: BlogPetTaskId;
  title: string;
  description: string;
  progress: number;
  goal: number;
  progressText: string;
  completed: boolean;
  food?: BlogPetFood;
};

export type BlogPetEvolutionRoute = {
  id: BlogPetEvolutionId;
  label: string;
  title: string;
  description: string;
  visualCue: string;
  voiceLine: string;
  progress: number;
  goal: number;
  progressText: string;
  current: boolean;
  unlocked: boolean;
};

export type BlogPetAppearance = {
  level: number;
  formLevel: number;
  phase: number;
  name: string;
  title: string;
  mood: string;
  phaseLabel: string;
  growthHint: string;
  unlocked: boolean;
  current: boolean;
};

export type BlogPetGrowthTimelineAchievement = Pick<
  BlogPetAchievement,
  "id" | "layer" | "title"
>;

export type BlogPetGrowthTimelineItem = {
  title: string;
  slug: string;
  dateText: string;
  mealSummary: string;
  previousLevel: number;
  level: number;
  xp: number;
  xpGained: number;
  stageName: string;
  unlockedAchievements: BlogPetGrowthTimelineAchievement[];
};

export type BlogPetNextFocus = {
  label: string;
  detail: string;
  food?: BlogPetFood;
};

export type BlogPetHunger = {
  label: string;
  tone: BlogPetHungerTone;
  ratio: number;
  effectiveDaysSinceLastMeal: number | null;
};

export type BlogPetStats = {
  level: number;
  maxLevel: number;
  xp: number;
  levelStartXp: number;
  nextLevelXp?: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressRatio: number;
  stage: BlogPetStage;
  evolution: BlogPetEvolution;
  totalMeals: number;
  recentMeals: number;
  streakDays: number;
  daysSinceLastMeal: number | null;
  hunger: BlogPetHunger;
  attributes: BlogPetAttribute[];
  dominantAttribute: BlogPetAttribute;
  latestMeal: BlogPetMeal | null;
  favoriteFood: BlogPetFood;
  foodStats: BlogPetFoodStat[];
  achievements: BlogPetAchievement[];
  tasks: BlogPetTask[];
  evolutionRoutes: BlogPetEvolutionRoute[];
  appearanceMap: BlogPetAppearance[];
  growthTimeline: BlogPetGrowthTimelineItem[];
  nextFocus: BlogPetNextFocus;
  mealLog: BlogPetMeal[];
};

export type BlogPetSnapshot = {
  schemaVersion: typeof BLOG_PET_SNAPSHOT_VERSION;
  generatedAt: string;
  pet: BlogPetStats;
};

export const BLOG_PET_FOODS: Record<CategoryKey, BlogPetFood> = {
  tech: {
    category: "tech",
    label: "代码脆片",
    shortLabel: "CODE",
    attributeId: "intelligence",
    attributeLabel: "智力",
  },
  fitness: {
    category: "fitness",
    label: "蛋白饭团",
    shortLabel: "FIT",
    attributeId: "stamina",
    attributeLabel: "体力",
  },
  dailyNews: {
    category: "dailyNews",
    label: "热点糖粒",
    shortLabel: "NEWS",
    attributeId: "speed",
    attributeLabel: "速度",
  },
};

const ATTRIBUTE_LABELS: Record<BlogPetAttributeId, string> = {
  intelligence: "智力",
  stamina: "体力",
  speed: "速度",
};

const BLOG_PET_FORMS = [
  {
    name: "灵感蛋",
    title: "刚入住博客",
    mood: "贴着草稿纸睡觉",
  },
  {
    name: "破壳灵",
    title: "刚长出尾巴和小爪",
    mood: "会追着标题味道转圈",
  },
  {
    name: "墨尾兽",
    title: "会背着稿纸巡逻",
    mood: "把段落叠成小窝，也会甩尾催稿",
  },
  {
    name: "巡夜兽",
    title: "博客页脚守夜兽",
    mood: "闻到 Markdown 就亮角",
  },
  {
    name: "镇站少年",
    title: "开始直立成博客伙伴",
    mood: "把每次发布都系在围巾上",
  },
  {
    name: "星翼法师",
    title: "能追着系列文章飞行",
    mood: "会用星翼给长文贴标",
  },
  {
    name: "长文炼金师",
    title: "人形炼金路线稳定",
    mood: "看到草稿会调配章节药剂",
  },
  {
    name: "灵感领航员",
    title: "披风展开，能在分类之间导航",
    mood: "会替下一篇文章找风向和航线",
  },
  {
    name: "归档守护骑士",
    title: "守着博客年轮和索引",
    mood: "会把老文章擦亮，也会举盾护档",
  },
  {
    name: "炎翼博客星灵",
    title: "满级炎翼共生形态",
    mood: "每次发布都像点燃一颗星",
  },
];

const BLOG_PET_PHASES = [
  {
    phaseLabel: "初醒",
    growthHint: "本形态第 1 阶，基础轮廓稳定。",
  },
  {
    phaseLabel: "蓄能",
    growthHint: "本形态第 2 阶，属性纹理变亮。",
  },
  {
    phaseLabel: "长出小特征",
    growthHint: "本形态第 3 阶，配件轮廓更明显。",
  },
  {
    phaseLabel: "形态预热",
    growthHint: "本形态第 4 阶，动作幅度增加。",
  },
  {
    phaseLabel: "完成蜕变",
    growthHint: "本形态第 5 阶，解锁这一形态的完整样子。",
  },
];

function stageForLevel(level: number): BlogPetStage {
  const safeLevel = Math.min(BLOG_PET_MAX_LEVEL, Math.max(1, Math.floor(level)));
  const formLevel = Math.ceil(safeLevel / 5);
  const phase = ((safeLevel - 1) % 5) + 1;
  const form = BLOG_PET_FORMS[formLevel - 1] ?? BLOG_PET_FORMS[BLOG_PET_FORMS.length - 1];
  const phaseInfo = BLOG_PET_PHASES[phase - 1] ?? BLOG_PET_PHASES[0];

  return {
    level: safeLevel,
    formLevel,
    phase,
    ...form,
    ...phaseInfo,
  };
}

function incubationAppearance(currentLevel: number): BlogPetAppearance {
  return {
    level: 0,
    formLevel: 1,
    phase: 1,
    name: "灵感胚",
    title: "等待第一篇文章孵化",
    mood: "缩成一颗安静的小灵感",
    phaseLabel: "未孵化",
    growthHint: "Lv.0 是博客桌宠的起点，第一篇文章会把它叫醒。",
    unlocked: true,
    current: currentLevel === 0,
  };
}

export function buildBlogPetAppearanceMap(currentLevel: number): BlogPetAppearance[] {
  const safeCurrentLevel = Math.max(0, Math.min(BLOG_PET_MAX_LEVEL, Math.floor(currentLevel)));
  const milestones = [0, ...Array.from({ length: BLOG_PET_MAX_LEVEL / 5 }, (_, index) => (index + 1) * 5)];

  return milestones.map((level) => {
    if (level === 0) {
      return incubationAppearance(safeCurrentLevel);
    }

    const stage = stageForLevel(level);

    return {
      level,
      formLevel: stage.formLevel,
      phase: stage.phase,
      name: stage.name,
      title: stage.title,
      mood: stage.mood,
      phaseLabel: stage.phaseLabel,
      growthHint: stage.growthHint,
      unlocked: safeCurrentLevel >= level,
      current: safeCurrentLevel > level - 5 && safeCurrentLevel <= level,
    };
  });
}

const EVOLUTIONS: Record<BlogPetEvolutionId, BlogPetEvolution> = {
  code: {
    id: "code",
    label: "代码型",
    title: "源码嗅探专家",
    description: "技术文章喂得最多，喜欢把标题拆成模块和接口。",
    traitLabel: "智力外观强化",
    voiceLabel: "会用模块、接口和边界来吐槽文章。",
  },
  training: {
    id: "training",
    label: "训练型",
    title: "能量循环伙伴",
    description: "健身文章喂得最多，动作更弹，饱腹下降也更慢。",
    traitLabel: "体力外观强化",
    voiceLabel: "会用组数、恢复和节奏来陪读。",
  },
  intel: {
    id: "intel",
    label: "情报型",
    title: "热点追踪伙伴",
    description: "热点速览喂得最多，消息气泡更活跃，巡逻节奏更快。",
    traitLabel: "速度外观强化",
    voiceLabel: "会用快讯、信号和风向来回应。",
  },
  balanced: {
    id: "balanced",
    label: "全能型",
    title: "三味均衡伙伴",
    description: "三种口味都吃得均衡，能在技术、训练和热点之间切换状态。",
    traitLabel: "均衡进化",
    voiceLabel: "会在代码、训练和热点三种语气间切换。",
  },
};

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysBetween(left: Date, right: Date) {
  return Math.floor((startOfLocalDay(left) - startOfLocalDay(right)) / MS_PER_DAY);
}

function emptyCategoryCounts(): Record<CategoryKey, number> {
  return {
    tech: 0,
    fitness: 0,
    dailyNews: 0,
  };
}

function emptyAttributeValues(): Record<BlogPetAttributeId, number> {
  return {
    intelligence: 0,
    stamina: 0,
    speed: 0,
  };
}

function attributeRatio(value: number) {
  return Math.max(0, Math.min(1, value / ATTRIBUTE_VALUE_CAP));
}

function activeCategoryCount(categoryCounts: Record<CategoryKey, number>) {
  return Object.values(categoryCounts).filter((count) => count > 0).length;
}

function calculateXp({
  totalMeals,
  flavorCount,
  recentMeals,
  streakDays,
  activeCategories,
}: {
  totalMeals: number;
  flavorCount: number;
  recentMeals: number;
  streakDays: number;
  activeCategories: number;
}) {
  return (
    totalMeals * BASE_MEAL_XP +
    flavorCount * FLAVOR_XP +
    recentMeals * RECENT_MEAL_XP +
    streakDays * STREAK_DAY_XP +
    activeCategories * DIVERSITY_XP
  );
}

function parseReadingMinutes(readingTimeText: string) {
  const match = readingTimeText.match(/(\d+(?:\.\d+)?)/);

  return match ? Number(match[1]) : 0;
}

function isLongformPost(post: PostSummary) {
  return parseReadingMinutes(post.readingTimeText) >= LONGFORM_READING_MINUTES;
}

function seriesKeysForPost(post: PostSummary) {
  const keys = new Set<string>();

  for (const tag of post.tags) {
    const normalizedTag = tag.trim();

    if (normalizedTag) {
      keys.add(normalizedTag);
    }
  }

  const titleSeries = post.title.split(/[：:]/)[0]?.trim();

  if (titleSeries && titleSeries.length >= 2 && titleSeries.length <= 14) {
    keys.add(titleSeries);
  }

  return Array.from(keys);
}

function maxSeriesCount(seriesCounts: Map<string, number>) {
  return Math.max(0, ...Array.from(seriesCounts.values()));
}

function calculateStreakDaysFromDaySet(days: Set<number>) {
  if (days.size === 0) {
    return 0;
  }

  const latestDay = Math.max(...Array.from(days));
  let streakDays = 1;
  let expectedDay = latestDay - MS_PER_DAY;

  while (days.has(expectedDay)) {
    streakDays += 1;
    expectedDay -= MS_PER_DAY;
  }

  return streakDays;
}

function uniqueKnownCategories(categories: CategoryKey[]) {
  return Array.from(new Set(categories.filter((category) => category in BLOG_PET_FOODS)));
}

function fallbackCategories(categories: CategoryKey[]) {
  const known = uniqueKnownCategories(categories);

  return known.length ? known : (["tech"] satisfies CategoryKey[]);
}

export function buildBlogPetMeal(post: PostSummary): BlogPetMeal {
  const foods = fallbackCategories(post.categories).map((category) => BLOG_PET_FOODS[category]);
  const summary = foods
    .map((food) => `${food.label}，${food.attributeLabel} +${ATTRIBUTE_GAIN_PER_FOOD}`)
    .join(" / ");

  return {
    title: post.title,
    slug: post.slug,
    dateText: post.dateText,
    foods,
    attributeGain: foods.length * ATTRIBUTE_GAIN_PER_FOOD,
    summary,
  };
}

function progressForXp(xp: number) {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let level = 1;

  for (let index = 0; index < BLOG_PET_LEVEL_THRESHOLDS.length; index += 1) {
    if (safeXp >= BLOG_PET_LEVEL_THRESHOLDS[index]) {
      level = index + 1;
    }
  }

  const levelStartXp = BLOG_PET_LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextLevelXp =
    level >= BLOG_PET_MAX_LEVEL ? undefined : BLOG_PET_LEVEL_THRESHOLDS[level];
  const xpIntoLevel = safeXp - levelStartXp;
  const xpForNextLevel = nextLevelXp === undefined ? 0 : nextLevelXp - levelStartXp;
  const progressRatio = xpForNextLevel === 0 ? 1 : Math.min(1, xpIntoLevel / xpForNextLevel);

  return {
    level,
    xp: safeXp,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    progressRatio,
  };
}

function hungerForDays(
  daysSinceLastMeal: number | null,
  staminaValue: number
): BlogPetHunger {
  if (daysSinceLastMeal === null) {
    return {
      label: "等第一篇投喂",
      tone: "empty",
      ratio: 0.15,
      effectiveDaysSinceLastMeal: null,
    };
  }

  const staminaBufferDays = Math.floor(Math.max(0, staminaValue) / 12);
  const effectiveDays = Math.max(0, daysSinceLastMeal - staminaBufferDays);

  if (effectiveDays <= 1) {
    return {
      label: "刚吃饱",
      tone: "full",
      ratio: 1,
      effectiveDaysSinceLastMeal: effectiveDays,
    };
  }

  if (effectiveDays <= 6) {
    return {
      label: "精神很好",
      tone: "steady",
      ratio: 0.78,
      effectiveDaysSinceLastMeal: effectiveDays,
    };
  }

  if (effectiveDays <= 13) {
    return {
      label: "想吃新文章",
      tone: "hungry",
      ratio: 0.48,
      effectiveDaysSinceLastMeal: effectiveDays,
    };
  }

  return {
    label: "饿到翻草稿箱",
    tone: "starving",
    ratio: 0.22,
    effectiveDaysSinceLastMeal: effectiveDays,
  };
}

function calculateStreakDays(posts: PostSummary[]) {
  if (posts.length === 0) {
    return 0;
  }

  const uniqueDays = Array.from(new Set(posts.map((post) => startOfLocalDay(post.date)))).sort(
    (left, right) => right - left
  );
  let streakDays = 1;
  let expectedDay = uniqueDays[0] - MS_PER_DAY;

  for (const day of uniqueDays.slice(1)) {
    if (day !== expectedDay) {
      break;
    }

    streakDays += 1;
    expectedDay -= MS_PER_DAY;
  }

  return streakDays;
}

function strongestAttribute(attributes: BlogPetAttribute[]) {
  return attributes.reduce((winner, attribute) => {
    if (attribute.value > winner.value) {
      return attribute;
    }

    return winner;
  }, attributes[0]);
}

function favoriteFoodForCounts(
  categoryCounts: Record<CategoryKey, number>,
  latestMeal: BlogPetMeal | null
) {
  const latestFood = latestMeal?.foods[0];

  return (Object.values(BLOG_PET_FOODS) as BlogPetFood[]).reduce((winner, food) => {
    const count = categoryCounts[food.category];
    const winnerCount = categoryCounts[winner.category];

    if (count > winnerCount) {
      return food;
    }

    if (count === winnerCount && latestFood?.category === food.category) {
      return food;
    }

    return winner;
  }, latestFood ?? BLOG_PET_FOODS.tech);
}

function evolutionForCounts(categoryCounts: Record<CategoryKey, number>) {
  const counts = Object.values(categoryCounts);
  const activeCounts = counts.filter((count) => count > 0);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const max = Math.max(0, ...counts);
  const minActive = Math.min(...activeCounts);
  const balancedSpread = Math.max(2, Math.ceil(total * 0.15));

  if (activeCounts.length === 3 && max - minActive <= balancedSpread) {
    return EVOLUTIONS.balanced;
  }

  if (categoryCounts.fitness > categoryCounts.tech && categoryCounts.fitness >= categoryCounts.dailyNews) {
    return EVOLUTIONS.training;
  }

  if (categoryCounts.dailyNews > categoryCounts.tech && categoryCounts.dailyNews > categoryCounts.fitness) {
    return EVOLUTIONS.intel;
  }

  return EVOLUTIONS.code;
}

function foodStatsForCounts(categoryCounts: Record<CategoryKey, number>) {
  const maxCount = Math.max(1, ...Object.values(categoryCounts));

  return (Object.values(BLOG_PET_FOODS) as BlogPetFood[]).map((food) => {
    const count = categoryCounts[food.category];

    return {
      ...food,
      count,
      attributeGain: count * ATTRIBUTE_GAIN_PER_FOOD,
      ratio: count / maxCount,
    };
  });
}

function achievementProgressText(progress: number, goal: number) {
  return `${Math.min(progress, goal)}/${goal}`;
}

function buildAchievements({
  categoryCounts,
  streakDays,
  longformCount,
  maxSeriesPosts,
  currentYearPostCount,
}: {
  categoryCounts: Record<CategoryKey, number>;
  streakDays: number;
  longformCount: number;
  maxSeriesPosts: number;
  currentYearPostCount: number;
}): BlogPetAchievement[] {
  const categoryVariety = activeCategoryCount(categoryCounts);
  const maxCategoryCount = Math.max(0, ...Object.values(categoryCounts));
  const minCategoryCount = Math.min(...Object.values(categoryCounts));
  const maxCategoryFood =
    (Object.values(BLOG_PET_FOODS) as BlogPetFood[]).find(
      (food) => categoryCounts[food.category] === maxCategoryCount
    ) ?? BLOG_PET_FOODS.tech;

  return [
    {
      id: "firstTechPost",
      layer: "category",
      title: "第一片代码脆片",
      description: "发布第一篇技术文章，桌宠开始增长智力。",
      unlocked: categoryCounts.tech > 0,
      progress: categoryCounts.tech,
      goal: 1,
      progressText: achievementProgressText(categoryCounts.tech, 1),
    },
    {
      id: "threeDayStreak",
      layer: "continuity",
      title: "连续三天投喂",
      description: "最近连续 3 个发布日都有新文章投喂。",
      unlocked: streakDays >= 3,
      progress: streakDays,
      goal: 3,
      progressText: achievementProgressText(streakDays, 3),
    },
    {
      id: "allFlavors",
      layer: "balance",
      title: "三种口味都喂过",
      description: "技术、健身和热点速览都至少投喂过一次。",
      unlocked: categoryVariety >= 3,
      progress: categoryVariety,
      goal: 3,
      progressText: achievementProgressText(categoryVariety, 3),
    },
    {
      id: "categoryTenPosts",
      layer: "category",
      title: "单一口味十连餐",
      description: `任一分类达到 10 篇。当前最高是${maxCategoryFood.label} ${maxCategoryCount} 篇。`,
      unlocked: maxCategoryCount >= 10,
      progress: maxCategoryCount,
      goal: 10,
      progressText: achievementProgressText(maxCategoryCount, 10),
    },
    {
      id: "fiveDayStreak",
      layer: "continuity",
      title: "连续五天投喂",
      description: "连续 5 个发布日都有新文章，桌宠会进入更稳定的巡逻节奏。",
      unlocked: streakDays >= FIVE_DAY_STREAK_GOAL,
      progress: streakDays,
      goal: FIVE_DAY_STREAK_GOAL,
      progressText: achievementProgressText(streakDays, FIVE_DAY_STREAK_GOAL),
    },
    {
      id: "balancedTenPosts",
      layer: "balance",
      title: "三味各十餐",
      description: "技术、健身和热点都达到 10 篇，解锁更稳定的均衡型路线。",
      unlocked: minCategoryCount >= 10,
      progress: minCategoryCount,
      goal: 10,
      progressText: achievementProgressText(minCategoryCount, 10),
    },
    {
      id: "tenLongPosts",
      layer: "longform",
      title: "长文储粮仓",
      description: `累计 ${LONGFORM_GOAL} 篇 ${LONGFORM_READING_MINUTES} 分钟以上长文，桌宠会把它们收进资料库。`,
      unlocked: longformCount >= LONGFORM_GOAL,
      progress: longformCount,
      goal: LONGFORM_GOAL,
      progressText: achievementProgressText(longformCount, LONGFORM_GOAL),
    },
    {
      id: "firstSeries",
      layer: "series",
      title: "系列文章成巢",
      description: `同一标签或同一标题前缀累计 ${SERIES_GOAL} 篇，桌宠会认出一条长期主线。`,
      unlocked: maxSeriesPosts >= SERIES_GOAL,
      progress: maxSeriesPosts,
      goal: SERIES_GOAL,
      progressText: achievementProgressText(maxSeriesPosts, SERIES_GOAL),
    },
    {
      id: "annualThirtyPosts",
      layer: "annual",
      title: "年度三十投",
      description: `当年累计 ${ANNUAL_GOAL} 篇文章，年度回顾路线点亮。`,
      unlocked: currentYearPostCount >= ANNUAL_GOAL,
      progress: currentYearPostCount,
      goal: ANNUAL_GOAL,
      progressText: achievementProgressText(currentYearPostCount, ANNUAL_GOAL),
    },
    {
      id: "techThirtyPosts",
      layer: "category",
      title: "代码型二阶孵化",
      description: `技术文章达到 ${TECH_ROUTE_GOAL} 篇，代码型路线进入下一形态。`,
      unlocked: categoryCounts.tech >= TECH_ROUTE_GOAL,
      progress: categoryCounts.tech,
      goal: TECH_ROUTE_GOAL,
      progressText: achievementProgressText(categoryCounts.tech, TECH_ROUTE_GOAL),
    },
  ];
}

function buildTasks({
  categoryCounts,
  attributeValues,
  streakDays,
}: {
  categoryCounts: Record<CategoryKey, number>;
  attributeValues: Record<BlogPetAttributeId, number>;
  streakDays: number;
}): BlogPetTask[] {
  const speedGap = Math.max(0, attributeValues.stamina - attributeValues.speed);
  const speedPostsNeeded = Math.ceil(speedGap / ATTRIBUTE_GAIN_PER_FOOD);
  const streakDaysNeeded = Math.max(0, FIVE_DAY_STREAK_GOAL - streakDays);
  const techPostsNeeded = Math.max(0, TECH_ROUTE_GOAL - categoryCounts.tech);

  return [
    {
      id: "balanceSpeedWithStamina",
      title:
        speedPostsNeeded > 0
          ? `再发 ${speedPostsNeeded} 篇热点，速度追平体力`
          : "速度已经追平体力",
      description:
        speedPostsNeeded > 0
          ? `当前速度 ${attributeValues.speed}，体力 ${attributeValues.stamina}。补${BLOG_PET_FOODS.dailyNews.label}可以让巡逻节奏更轻。`
          : "热点糖粒储备够用，情报型动作已经跟上体力节奏。",
      progress: attributeValues.speed,
      goal: Math.max(attributeValues.speed, attributeValues.stamina),
      progressText: `${attributeValues.speed}/${Math.max(attributeValues.speed, attributeValues.stamina)}`,
      completed: speedPostsNeeded === 0,
      food: BLOG_PET_FOODS.dailyNews,
    },
    {
      id: "fiveDayStreak",
      title:
        streakDaysNeeded > 0
          ? `再连续发布 ${streakDaysNeeded} 天，解锁连续五天投喂`
          : "连续五天投喂已解锁",
      description:
        streakDaysNeeded > 0
          ? "连续更新会让桌宠进入更稳定的巡逻状态，也会点亮写作连续性成就。"
          : "连续性成就已经点亮，桌宠会把这段节奏记进成长时间线。",
      progress: streakDays,
      goal: FIVE_DAY_STREAK_GOAL,
      progressText: achievementProgressText(streakDays, FIVE_DAY_STREAK_GOAL),
      completed: streakDaysNeeded === 0,
    },
    {
      id: "techThirtyPosts",
      title:
        techPostsNeeded > 0
          ? `技术文达到 ${TECH_ROUTE_GOAL} 篇，进入代码型下一形态`
          : "代码型下一形态已点亮",
      description:
        techPostsNeeded > 0
          ? `当前技术文 ${categoryCounts.tech} 篇，还差 ${techPostsNeeded} 篇代码脆片。`
          : "技术路线储备充足，后续外观会更偏源码嗅探专家。",
      progress: categoryCounts.tech,
      goal: TECH_ROUTE_GOAL,
      progressText: achievementProgressText(categoryCounts.tech, TECH_ROUTE_GOAL),
      completed: techPostsNeeded === 0,
      food: BLOG_PET_FOODS.tech,
    },
  ];
}

function buildEvolutionRoutes({
  categoryCounts,
  evolution,
}: {
  categoryCounts: Record<CategoryKey, number>;
  evolution: BlogPetEvolution;
}): BlogPetEvolutionRoute[] {
  const counts = Object.values(categoryCounts);
  const max = Math.max(0, ...counts);
  const min = Math.min(...counts);
  const balancedGoalProgress = activeCategoryCount(categoryCounts) < 3 ? activeCategoryCount(categoryCounts) : 3;
  const balancedSpread = max - min;

  return [
    {
      id: "code",
      label: EVOLUTIONS.code.label,
      title: EVOLUTIONS.code.title,
      description: "技术文章越多，眼镜、书页和代码型台词越明显。",
      visualCue: "眼镜、小书、偏琥珀的高亮",
      voiceLine: "我会把标题拆成模块、接口和边界。",
      progress: categoryCounts.tech,
      goal: TECH_ROUTE_GOAL,
      progressText: achievementProgressText(categoryCounts.tech, TECH_ROUTE_GOAL),
      current: evolution.id === "code",
      unlocked: categoryCounts.tech >= TECH_ROUTE_GOAL,
    },
    {
      id: "training",
      label: EVOLUTIONS.training.label,
      title: EVOLUTIONS.training.title,
      description: "健身文章越多，动作更有弹性，饱腹下降更慢。",
      visualCue: "更宽的爪子、绿色光晕、伸展动作",
      voiceLine: "我会用组数、恢复和节奏来陪你读。",
      progress: categoryCounts.fitness,
      goal: 20,
      progressText: achievementProgressText(categoryCounts.fitness, 20),
      current: evolution.id === "training",
      unlocked: categoryCounts.fitness >= 20,
    },
    {
      id: "intel",
      label: EVOLUTIONS.intel.label,
      title: EVOLUTIONS.intel.title,
      description: "热点文章越多，气泡更活跃，巡逻动作更快。",
      visualCue: "蓝色光晕、NEWS 贴片、快速巡逻",
      voiceLine: "我会用快讯、信号和风向回应。",
      progress: categoryCounts.dailyNews,
      goal: 15,
      progressText: achievementProgressText(categoryCounts.dailyNews, 15),
      current: evolution.id === "intel",
      unlocked: categoryCounts.dailyNews >= 15,
    },
    {
      id: "balanced",
      label: EVOLUTIONS.balanced.label,
      title: EVOLUTIONS.balanced.title,
      description: "三种口味接近时，外观会混合技术、训练和热点的特征。",
      visualCue: "三色渐变、台词混合、均衡属性提示",
      voiceLine: "我会在代码、训练和热点三种语气间切换。",
      progress: balancedGoalProgress,
      goal: 3,
      progressText:
        activeCategoryCount(categoryCounts) < 3
          ? achievementProgressText(balancedGoalProgress, 3)
          : `最大差距 ${balancedSpread} 篇`,
      current: evolution.id === "balanced",
      unlocked: evolution.id === "balanced",
    },
  ];
}

function buildGrowthTimeline({
  sortedPosts,
  now,
}: {
  sortedPosts: PostSummary[];
  now: Date;
}): BlogPetGrowthTimelineItem[] {
  const chronologicalPosts = [...sortedPosts].reverse();
  const categoryCounts = emptyCategoryCounts();
  const seriesCounts = new Map<string, number>();
  const publishDays = new Set<number>();
  const seenUnlockedAchievements = new Set<BlogPetAchievementId>();
  let flavorCount = 0;
  let recentMeals = 0;
  let longformCount = 0;
  let currentYearPostCount = 0;
  let previousXp = 0;
  let previousLevel = 1;

  const timeline = chronologicalPosts.map((post, index) => {
    const categories = fallbackCategories(post.categories);

    for (const category of categories) {
      categoryCounts[category] += 1;
      flavorCount += 1;
    }

    if (Math.max(0, daysBetween(now, post.date)) <= RECENT_WINDOW_DAYS) {
      recentMeals += 1;
    }

    if (isLongformPost(post)) {
      longformCount += 1;
    }

    if (post.date.getFullYear() === now.getFullYear()) {
      currentYearPostCount += 1;
    }

    for (const seriesKey of seriesKeysForPost(post)) {
      seriesCounts.set(seriesKey, (seriesCounts.get(seriesKey) ?? 0) + 1);
    }

    publishDays.add(startOfLocalDay(post.date));
    const streakDays = calculateStreakDaysFromDaySet(publishDays);
    const xp = calculateXp({
      totalMeals: index + 1,
      flavorCount,
      recentMeals,
      streakDays,
      activeCategories: activeCategoryCount(categoryCounts),
    });
    const progress = progressForXp(xp);
    const achievements = buildAchievements({
      categoryCounts,
      streakDays,
      longformCount,
      maxSeriesPosts: maxSeriesCount(seriesCounts),
      currentYearPostCount,
    });
    const unlockedAchievements = achievements
      .filter((achievement) => achievement.unlocked && !seenUnlockedAchievements.has(achievement.id))
      .map(({ id, layer, title }) => ({ id, layer, title }));

    for (const achievement of achievements) {
      if (achievement.unlocked) {
        seenUnlockedAchievements.add(achievement.id);
      }
    }

    const meal = buildBlogPetMeal(post);
    const item = {
      title: post.title,
      slug: post.slug,
      dateText: post.dateText,
      mealSummary: meal.summary,
      previousLevel,
      level: progress.level,
      xp,
      xpGained: xp - previousXp,
      stageName: stageForLevel(progress.level).name,
      unlockedAchievements,
    } satisfies BlogPetGrowthTimelineItem;

    previousXp = xp;
    previousLevel = progress.level;

    return item;
  });

  return timeline.reverse();
}

function nextFocusForStats({
  categoryCounts,
  achievements,
  nextLevelXp,
  xp,
}: {
  categoryCounts: Record<CategoryKey, number>;
  achievements: BlogPetAchievement[];
  nextLevelXp?: number;
  xp: number;
}): BlogPetNextFocus {
  const missingFood = (Object.values(BLOG_PET_FOODS) as BlogPetFood[]).find(
    (food) => categoryCounts[food.category] === 0
  );

  if (missingFood) {
    return {
      label: `补一篇${missingFood.label}`,
      detail: `还差 ${missingFood.attributeLabel} 口味，发一篇对应分类文章就能解锁“三种口味都喂过”。`,
      food: missingFood,
    };
  }

  const categoryTenAchievement = achievements.find((achievement) => achievement.id === "categoryTenPosts");

  if (categoryTenAchievement && !categoryTenAchievement.unlocked) {
    const closestFood = (Object.values(BLOG_PET_FOODS) as BlogPetFood[]).reduce(
      (winner, food) => {
        if (categoryCounts[food.category] > categoryCounts[winner.category]) {
          return food;
        }

        return winner;
      },
      BLOG_PET_FOODS.tech
    );

    return {
      label: `把${closestFood.label}喂到 10 篇`,
      detail: `当前 ${categoryCounts[closestFood.category]} 篇，再补 ${
        10 - categoryCounts[closestFood.category]
      } 篇可解锁单分类成就。`,
      food: closestFood,
    };
  }

  if (nextLevelXp !== undefined) {
    const underfedFood = (Object.values(BLOG_PET_FOODS) as BlogPetFood[]).reduce(
      (winner, food) => {
        if (categoryCounts[food.category] < categoryCounts[winner.category]) {
          return food;
        }

        return winner;
      },
      BLOG_PET_FOODS.tech
    );

    return {
      label: `冲刺下一形态`,
      detail: `距离下一等级还差 ${Math.max(0, nextLevelXp - xp)} XP，优先补${underfedFood.label}能让属性更均衡。`,
      food: underfedFood,
    };
  }

  return {
    label: "自由投喂",
    detail: "桌宠已经满级，下一阶段可以用系列文章、封面和图表继续扩展成就。",
  };
}

export function buildBlogPetStats(posts: PostSummary[], now = new Date()): BlogPetStats {
  const sortedPosts = [...posts].sort((left, right) => right.date.getTime() - left.date.getTime());
  const categoryCounts = emptyCategoryCounts();
  const attributeValues = emptyAttributeValues();
  const seriesCounts = new Map<string, number>();

  let flavorCount = 0;
  let longformCount = 0;
  let currentYearPostCount = 0;

  for (const post of sortedPosts) {
    const categories = fallbackCategories(post.categories);

    for (const category of categories) {
      const food = BLOG_PET_FOODS[category];

      categoryCounts[category] += 1;
      attributeValues[food.attributeId] += ATTRIBUTE_GAIN_PER_FOOD;
      flavorCount += 1;
    }

    if (isLongformPost(post)) {
      longformCount += 1;
    }

    if (post.date.getFullYear() === now.getFullYear()) {
      currentYearPostCount += 1;
    }

    for (const seriesKey of seriesKeysForPost(post)) {
      seriesCounts.set(seriesKey, (seriesCounts.get(seriesKey) ?? 0) + 1);
    }
  }

  const recentMeals = sortedPosts.filter((post) => {
    const daysSincePost = Math.max(0, daysBetween(now, post.date));

    return daysSincePost <= RECENT_WINDOW_DAYS;
  }).length;
  const streakDays = calculateStreakDays(sortedPosts);
  const xp = calculateXp({
    totalMeals: sortedPosts.length,
    flavorCount,
    recentMeals,
    streakDays,
    activeCategories: activeCategoryCount(categoryCounts),
  });
  const progress = progressForXp(xp);
  const attributes = (Object.keys(attributeValues) as BlogPetAttributeId[]).map((id) => {
    const value = attributeValues[id];

    return {
      id,
      label: ATTRIBUTE_LABELS[id],
      value,
      maxValue: ATTRIBUTE_VALUE_CAP,
      ratio: attributeRatio(value),
    };
  });
  const latestMeal = sortedPosts[0] ? buildBlogPetMeal(sortedPosts[0]) : null;
  const daysSinceLastMeal = sortedPosts[0]
    ? Math.max(0, daysBetween(now, sortedPosts[0].date))
    : null;
  const evolution = evolutionForCounts(categoryCounts);
  const achievements = buildAchievements({
    categoryCounts,
    streakDays,
    longformCount,
    maxSeriesPosts: maxSeriesCount(seriesCounts),
    currentYearPostCount,
  });

  return {
    ...progress,
    maxLevel: BLOG_PET_MAX_LEVEL,
    stage: stageForLevel(progress.level),
    evolution,
    totalMeals: sortedPosts.length,
    recentMeals,
    streakDays,
    daysSinceLastMeal,
    hunger: hungerForDays(daysSinceLastMeal, attributeValues.stamina),
    attributes,
    dominantAttribute: strongestAttribute(attributes),
    latestMeal,
    favoriteFood: favoriteFoodForCounts(categoryCounts, latestMeal),
    foodStats: foodStatsForCounts(categoryCounts),
    achievements,
    tasks: buildTasks({
      categoryCounts,
      attributeValues,
      streakDays,
    }),
    evolutionRoutes: buildEvolutionRoutes({
      categoryCounts,
      evolution,
    }),
    appearanceMap: buildBlogPetAppearanceMap(progress.level),
    growthTimeline: buildGrowthTimeline({
      sortedPosts,
      now,
    }),
    nextFocus: nextFocusForStats({
      categoryCounts,
      achievements,
      nextLevelXp: progress.nextLevelXp,
      xp: progress.xp,
    }),
    mealLog: sortedPosts.map(buildBlogPetMeal),
  };
}
