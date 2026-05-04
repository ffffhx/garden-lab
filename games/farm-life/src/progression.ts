export const masteryTrackIds = ["farming", "foraging", "fishing", "social"] as const;

export type MasteryTrackId = (typeof masteryTrackIds)[number];

export type MasteryTrackState = {
  xp: number;
};

export type MasteryState = Record<MasteryTrackId, MasteryTrackState>;

export const MASTERY_MAX_LEVEL = 5;

export const masteryLevelThresholds = [0, 60, 160, 320, 560] as const;

export type MasteryProgress = {
  level: number;
  xp: number;
  levelStartXp: number;
  nextLevelXp?: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressRatio: number;
};

export type MasteryGainResult = {
  track: MasteryTrackId;
  xpGained: number;
  previousLevel: number;
  currentLevel: number;
  leveledUp: boolean;
  progress: MasteryProgress;
};

export type FarmRatingInput = {
  totalShipped: number;
  totalShippingIncome: number;
  completedOrders: number;
  totalFriendship: number;
  totalMasteryLevel: number;
};

export type FarmRating = {
  score: number;
  tier: "sprout" | "homestead" | "orchard" | "valley";
  label: string;
  nextScore?: number;
};

export type RelationshipStage = {
  level: number;
  label: string;
  nextPoints?: number;
};

export type OrderFulfillmentStatus = "open" | "in_progress" | "ready" | "completed";

export type DailyObjectiveId = "mail" | "order" | "field" | "social" | "shipping" | "sleep" | "free";

export type DailyObjectiveHint = {
  id: DailyObjectiveId;
  label: string;
  detail: string;
};

export type DayPeriodId = "morning" | "afternoon" | "evening" | "night" | "late";

export type DayPeriod = {
  id: DayPeriodId;
  label: string;
};

export type EnergyStatusId = "full" | "steady" | "tired" | "exhausted";

export type EnergyStatus = {
  id: EnergyStatusId;
  label: string;
  hint: string;
  ratio: number;
};

export type CropGrowthStatus = {
  mature: boolean;
  currentDay: number;
  growDays: number;
  remainingDays: number;
  progressRatio: number;
  label: string;
};

export type SnackCategory = "crop" | "forage" | "fish";

export type TravelTarget = "farm" | "home" | "town" | "shop";

export type FishingCatchTier = "miss" | "common" | "good" | "rare";

export type FarmActionResult = "till" | "plant" | "water" | "harvest";

function normalizeXp(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  return Math.max(0, Math.floor(Number.isFinite(numericValue) ? numericValue : 0));
}

export function createDefaultMastery(): MasteryState {
  return masteryTrackIds.reduce((mastery, track) => {
    mastery[track] = { xp: 0 };
    return mastery;
  }, {} as MasteryState);
}

export function progressForXp(value: number): MasteryProgress {
  const xp = normalizeXp(value);
  let level = 1;

  for (let index = 0; index < masteryLevelThresholds.length; index += 1) {
    if (xp >= masteryLevelThresholds[index]) {
      level = index + 1;
    }
  }

  const levelStartXp = masteryLevelThresholds[level - 1] ?? 0;
  const nextLevelXp = level >= MASTERY_MAX_LEVEL ? undefined : masteryLevelThresholds[level];
  const xpIntoLevel = xp - levelStartXp;
  const xpForNextLevel = nextLevelXp === undefined ? 0 : nextLevelXp - levelStartXp;
  const progressRatio = xpForNextLevel === 0 ? 1 : Math.min(1, xpIntoLevel / xpForNextLevel);

  return {
    level,
    xp,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    progressRatio,
  };
}

export function sanitizeMastery(value: unknown): MasteryState {
  const fallback = createDefaultMastery();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const source = value as Partial<Record<MasteryTrackId, Partial<MasteryTrackState>>>;

  return masteryTrackIds.reduce((mastery, track) => {
    mastery[track] = {
      xp: normalizeXp(source[track]?.xp),
    };
    return mastery;
  }, {} as MasteryState);
}

export function addMasteryXp(
  mastery: MasteryState,
  track: MasteryTrackId,
  amount: number,
): MasteryGainResult {
  const xpGained = normalizeXp(amount);
  const before = progressForXp(mastery[track]?.xp ?? 0);

  if (xpGained === 0) {
    return {
      track,
      xpGained,
      previousLevel: before.level,
      currentLevel: before.level,
      leveledUp: false,
      progress: before,
    };
  }

  mastery[track] ??= { xp: 0 };
  mastery[track].xp += xpGained;

  const after = progressForXp(mastery[track].xp);

  return {
    track,
    xpGained,
    previousLevel: before.level,
    currentLevel: after.level,
    leveledUp: after.level > before.level,
    progress: after,
  };
}

export function masteryLevel(mastery: MasteryState, track: MasteryTrackId) {
  return progressForXp(mastery[track]?.xp ?? 0).level;
}

export function farmingEnergyCost(baseCost: number, farmingLevel: number) {
  const reduction = Math.floor(Math.max(1, farmingLevel) / 2);

  return Math.max(1, normalizeXp(baseCost) - reduction);
}

export function actionEnergyHint({
  energy,
  cost,
  minutes,
}: {
  energy: number;
  cost: number;
  minutes: number;
}) {
  const current = normalizeXp(energy);
  const actionCost = Math.max(1, normalizeXp(cost));
  const duration = Math.max(1, normalizeXp(minutes));

  if (current < actionCost) {
    return `体力不足 · 需${actionCost}体`;
  }

  const base = `${actionCost}体/${duration}分`;
  const remaining = current - actionCost;

  if (remaining === 0) {
    return `${base} · 会耗尽`;
  }

  return remaining <= 12 ? `${base} · 做完快见底` : base;
}

export function farmToolStateHint({
  tool,
  tilled,
  cropPlanted,
  mature,
  watered,
  raining,
  seedCount,
}: {
  tool: "hoe" | "seed" | "water" | "harvest" | "fish";
  tilled: boolean;
  cropPlanted: boolean;
  mature: boolean;
  watered: boolean;
  raining: boolean;
  seedCount: number;
}) {
  if (tool === "hoe") {
    if (cropPlanted) {
      return "作物占地 · 换水壶/收获";
    }

    return tilled ? "已开垦 · 可播种" : "可开垦";
  }

  if (tool === "seed") {
    if (!tilled) {
      return "先用锄头开垦";
    }

    if (cropPlanted) {
      return "已有作物 · 换水壶/收获";
    }

    return normalizeXp(seedCount) > 0 ? "可播种" : "种子不足";
  }

  if (tool === "water") {
    if (raining) {
      return "雨天代浇";
    }

    if (!cropPlanted) {
      return "先播种再浇水";
    }

    return watered ? "已浇水" : "可浇水";
  }

  if (tool === "harvest") {
    if (!cropPlanted) {
      return "没有作物可收";
    }

    return mature ? "可收获" : "还没成熟";
  }

  return "去水边抛竿";
}

export function fieldTactileCueHint({
  tool,
  tilled,
  cropPlanted,
  mature,
  watered,
  raining,
  seedCount,
  energy,
  energyCost,
}: {
  tool: "hoe" | "seed" | "water" | "harvest" | "fish";
  tilled: boolean;
  cropPlanted: boolean;
  mature: boolean;
  watered: boolean;
  raining: boolean;
  seedCount: number;
  energy: number;
  energyCost: number;
}) {
  const stamina = normalizeXp(energy);
  const cost = Math.max(1, normalizeXp(energyCost));

  if (stamina < cost) {
    return `手感 · 体力不足需${cost}`;
  }

  const canAct =
    tool === "hoe"
      ? !tilled && !cropPlanted
      : tool === "seed"
        ? tilled && !cropPlanted && normalizeXp(seedCount) > 0
        : tool === "water"
          ? cropPlanted && !watered && !raining
          : tool === "harvest"
            ? cropPlanted && mature
            : false;

  if (!canAct) {
    return tool === "fish" ? "手感 · 水边抛竿" : "手感 · 先换工具";
  }

  const remaining = stamina - cost;
  const rhythm = remaining === 0 ? "最后一下" : remaining <= 12 ? "轻做收尾" : "顺手连做";
  const action =
    tool === "hoe"
      ? "松土轻敲"
      : tool === "seed"
        ? raining
          ? "撒种雨浇"
          : "撒种覆土"
        : tool === "water"
          ? "水壶短按"
          : "篮子快收";

  return `手感 · ${action} · ${rhythm}`;
}

export function fieldTileDecisionHint({
  tool,
  tilled,
  cropName,
  growthLabel,
  mature,
  watered,
  raining,
  seedName,
  seedCount,
  energyCost,
  minutesPerAction,
  sellPrice,
}: {
  tool: "hoe" | "seed" | "water" | "harvest" | "fish";
  tilled: boolean;
  cropName?: string;
  growthLabel?: string;
  mature: boolean;
  watered: boolean;
  raining: boolean;
  seedName?: string;
  seedCount: number;
  energyCost: number;
  minutesPerAction: number;
  sellPrice?: number;
}) {
  const crop = cropName?.trim();
  const growth = growthLabel?.trim();
  const seed = seedName?.trim() || "种子";
  const seeds = normalizeXp(seedCount);
  const cost = Math.max(1, normalizeXp(energyCost));
  const minutes = Math.max(1, normalizeXp(minutesPerAction));
  const actionCost = `${cost}体/${minutes}分`;

  if (!crop) {
    if (!tilled) {
      return tool === "hoe" ? `地块决策 · 开垦 · ${actionCost}` : "地块决策 · 换锄头开垦";
    }

    if (seeds === 0) {
      return "地块决策 · 缺种 · 去商店";
    }

    return tool === "seed"
      ? `地块决策 · 播${seed} · ${actionCost} · ${seeds}包`
      : `地块决策 · 换种子播${seed} · ${seeds}包`;
  }

  if (mature) {
    const harvest = `收${crop} · ${normalizeXp(sellPrice)}金`;

    return tool === "harvest" ? `地块决策 · ${harvest} · ${actionCost}` : `地块决策 · 换篮子${harvest}`;
  }

  const cropStatus = `${crop}${growth ? ` ${growth}` : ""}`;

  if (raining) {
    return `地块决策 · 雨水照看 · ${cropStatus}`;
  }

  if (!watered) {
    return tool === "water"
      ? `地块决策 · 浇${crop} · ${growth || "生长中"} · ${actionCost}`
      : `地块决策 · 换水壶 · ${cropStatus}`;
  }

  return `地块决策 · 已照看 · ${cropStatus}`;
}

export function hotbarActionHint({
  tool,
  seedName,
  seedCount,
}: {
  tool: "hoe" | "seed" | "water" | "harvest" | "fish";
  seedName?: string;
  seedCount?: number;
}) {
  if (tool === "seed") {
    const name = seedName?.trim();
    const label = name ? `${name}种子` : "种子";
    const count = normalizeXp(seedCount);

    return count > 0 ? `已选${label} · ${count}包 · E播种` : `已选${label} · 无库存 · 去商店`;
  }

  const actions = {
    hoe: "已选锄头 · E开垦",
    water: "已选水壶 · E浇水",
    harvest: "已选篮子 · E收获/采集",
    fish: "已选鱼竿 · 水边E抛竿",
  } satisfies Record<Exclude<typeof tool, "seed">, string>;

  return actions[tool];
}

export function toolSelectionToastHint({
  actionHint,
  nextStepHint,
}: {
  actionHint: string;
  nextStepHint: string;
}) {
  const action = actionHint.trim() || "已选工具";
  const next = nextStepHint.trim();

  return next ? `${action} · ${next}` : action;
}

export function mapInteractionCueHint({
  actionLabel,
  purposeHint,
  nextStepHint,
}: {
  actionLabel: string;
  purposeHint: string;
  nextStepHint?: string;
}) {
  const action = actionLabel.trim() || "互动";
  const purpose = purposeHint.trim();
  const next = nextStepHint?.trim();
  const parts = [`E ${action}`, purpose, next ? `下一步 · ${next}` : undefined].filter(Boolean);

  return parts.join(" · ");
}

export function farmActionResultHint({
  action,
  cropName,
  energy,
  timeMinutes,
  inventoryCount,
  sellPrice,
  watered = false,
  splashCount = 0,
}: {
  action: FarmActionResult;
  cropName?: string;
  energy: number;
  timeMinutes: number;
  inventoryCount?: number;
  sellPrice?: number;
  watered?: boolean;
  splashCount?: number;
}) {
  const minutes = normalizeXp(timeMinutes) % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const suffix = `${clock} · ${normalizeXp(energy)}体`;
  const crop = cropName?.trim() || "作物";

  if (action === "till") {
    return `翻地完成 · ${suffix}`;
  }

  if (action === "plant") {
    const seedCount = normalizeXp(inventoryCount);

    return `${crop}已种 · ${watered ? "雨水代浇" : `剩${seedCount}包`} · ${suffix}`;
  }

  if (action === "water") {
    const splash = normalizeXp(splashCount);

    return splash > 0 ? `浇水完成 · 溅水${splash}块 · ${suffix}` : `浇水完成 · ${suffix}`;
  }

  return `收获${crop} · 背包${normalizeXp(inventoryCount)}件 · ${normalizeXp(sellPrice)}金 · ${suffix}`;
}

export function farmActionFollowUpHint({
  resultHint,
  nextStepHint,
  energy,
  timeMinutes,
}: {
  resultHint: string;
  nextStepHint: string;
  energy: number;
  timeMinutes: number;
}) {
  const result = resultHint.trim() || "动作完成";
  const nextStep = nextStepHint.trim();
  const stamina = normalizeXp(energy);
  const minutes = normalizeXp(timeMinutes) % (24 * 60);
  const urgency = minutes >= 21 * 60 ? "夜深 · 收尾回家" : stamina <= 12 ? "体力低 · 吃点心/回家" : "";

  return [result, nextStep, urgency].filter(Boolean).join(" · ");
}

export function actionFeedbackCueHint({
  action,
  energy,
  timeMinutes,
}: {
  action: FarmActionResult | "fish-catch" | "fish-miss" | "ship";
  energy: number;
  timeMinutes: number;
}) {
  const cues = {
    till: "锄声沉一下 · 土块浮字",
    plant: "撒种轻响 · 绿芽浮字",
    water: "水声短促 · 蓝光溅开",
    harvest: "篮子一响 · 金光浮字",
    "fish-catch": "鱼线绷紧 · 水花浮字",
    "fish-miss": "浮漂轻晃 · 蓝光散开",
    ship: "木箱合盖 · 金币浮字",
  } satisfies Record<FarmActionResult | "fish-catch" | "fish-miss" | "ship", string>;
  const cue = cues[action] ?? "动作反馈";
  const stamina = normalizeXp(energy);
  const late = normalizeXp(timeMinutes) >= 21 * 60;
  const pressure = late ? " · 夜里收束" : stamina <= 12 ? " · 轻声收尾" : "";

  return `反馈 · ${cue}${pressure}`;
}

export function fieldActionNextStepHint({
  openPlotCount,
  carriedSeeds,
  dryCropCount,
  matureCount,
  sellableInventoryCount,
}: {
  openPlotCount: number;
  carriedSeeds: number;
  dryCropCount: number;
  matureCount: number;
  sellableInventoryCount: number;
}) {
  const mature = normalizeXp(matureCount);
  const dry = normalizeXp(dryCropCount);
  const openPlots = normalizeXp(openPlotCount);
  const seeds = normalizeXp(carriedSeeds);
  const sellables = normalizeXp(sellableInventoryCount);

  if (mature > 0) {
    return `下一步 · 收获${mature}块`;
  }

  if (dry > 0) {
    return `下一步 · 浇水${dry}块`;
  }

  if (openPlots > 0 && seeds > 0) {
    return `下一步 · 播种${Math.min(openPlots, seeds)}块`;
  }

  if (openPlots > 0) {
    return "下一步 · 去商店补种";
  }

  if (sellables > 0) {
    return `下一步 · 入箱${sellables}件`;
  }

  return "下一步 · 查日志";
}

export function forageYield(baseCount: number, foragingLevel: number, day: number, x: number, y: number) {
  const normalizedBase = Math.max(1, normalizeXp(baseCount));

  if (foragingLevel < 3) {
    return normalizedBase;
  }

  const roll = (day * 17 + x * 11 + y * 7 + foragingLevel * 13) % 100;
  const bonusChance = foragingLevel >= 5 ? 38 : 20;

  return normalizedBase + (roll < bonusChance ? 1 : 0);
}

export function adjustedFishingRoll(baseRoll: number, fishingLevel: number) {
  return Math.min(99, normalizeXp(baseRoll) + Math.max(0, fishingLevel - 1) * 5);
}

export function fishingCatchTier({
  baseRoll,
  fishingLevel,
  raining,
  pondLightsActive,
}: {
  baseRoll: number;
  fishingLevel: number;
  raining: boolean;
  pondLightsActive: boolean;
}): FishingCatchTier {
  const roll = adjustedFishingRoll(baseRoll, fishingLevel);

  if (roll < (pondLightsActive ? 9 : 18)) {
    return "miss";
  }

  if (pondLightsActive && roll > 42) {
    return roll > 72 ? "rare" : "good";
  }

  if (raining && roll > 70) {
    return "rare";
  }

  return roll > 58 ? "good" : "common";
}

export function fishingCastPreviewHint({
  tier,
  catchName,
  sellPrice,
}: {
  tier: FishingCatchTier;
  catchName?: string;
  sellPrice?: number;
}) {
  if (tier === "miss") {
    return "空竿风险";
  }

  const name = catchName?.trim() || "鱼";
  const tierLabel = tier === "rare" ? "稀有" : tier === "good" ? "稳中" : "常见";

  return `${tierLabel} ${name} · ${normalizeXp(sellPrice)}金`;
}

export function fishingBasketRouteHint({
  fishCount,
  totalGold,
  timeMinutes,
  energy,
}: {
  fishCount: number;
  totalGold: number;
  timeMinutes: number;
  energy: number;
}) {
  const count = normalizeXp(fishCount);
  const gold = normalizeXp(totalGold);
  const minutes = normalizeXp(timeMinutes) % (24 * 60);
  const stamina = normalizeXp(energy);

  if (count === 0) {
    return stamina <= 12 ? "鱼篓空 · 先吃点心" : "鱼篓空 · 找水点";
  }

  const value = `鱼篓${count}条 · ${gold}金`;

  if (minutes >= 21 * 60) {
    return `${value} · 睡前入箱`;
  }

  if (stamina <= 12) {
    return `${value} · 吃点心/回家`;
  }

  return gold >= 80 ? `${value} · 可先入箱` : `${value} · 可再钓`;
}

export function fishingSpotPlanHint({
  previewHint,
  condition,
  energy,
  timeMinutes,
  fishInventoryCount,
}: {
  previewHint: string;
  condition: string;
  energy: number;
  timeMinutes: number;
  fishInventoryCount: number;
}) {
  const preview = previewHint.trim() || "鱼情未知";
  const water = condition.trim() || "普通鱼情";
  const stamina = normalizeXp(energy);
  const minutes = normalizeXp(timeMinutes) % (24 * 60);
  const fishCount = normalizeXp(fishInventoryCount);
  const action = minutes >= 21 * 60 ? "睡前入箱" : stamina <= 12 ? "先吃点心" : "可连钓";
  const basket = fishCount > 0 ? `鱼篓${fishCount}条` : "鱼篓空";

  return `鱼点 · ${preview} · ${water} · ${basket} · ${action}`;
}

export function fishingActionJuiceHint({
  previewHint,
  energy,
  energyCost,
  minutesPerCast,
  timeMinutes,
  pondLightsActive,
  raining,
}: {
  previewHint: string;
  energy: number;
  energyCost: number;
  minutesPerCast: number;
  timeMinutes: number;
  pondLightsActive: boolean;
  raining: boolean;
}) {
  const preview = previewHint.trim();
  const stamina = normalizeXp(energy);
  const cost = Math.max(1, normalizeXp(energyCost));
  const duration = Math.max(1, normalizeXp(minutesPerCast));

  if (stamina < cost) {
    return `抛竿动机 · 体力不足需${cost}`;
  }

  const castsByEnergy = Math.floor(stamina / cost);
  const minutes = normalizeXp(timeMinutes);
  const castsBeforeNight = minutes >= 21 * 60 ? 0 : Math.floor(Math.max(0, 21 * 60 - minutes) / duration);
  const safeCasts = Math.min(castsByEnergy, castsBeforeNight);
  const motive = pondLightsActive
    ? "夜灯加成"
    : raining
      ? "雨天加成"
      : preview.includes("稀有")
        ? "追稀有"
        : preview.includes("空竿")
          ? "谨慎试竿"
          : "稳定收益";
  const nightPlan = safeCasts > 0 ? `睡前${safeCasts}竿` : "先入箱/回家";

  return `抛竿动机 · ${motive} · 可钓${castsByEnergy}竿/${castsByEnergy * cost}体 · ${nightPlan}`;
}

export function fishingBiteCueHint({
  tier,
  fishingLevel,
  weather,
  timeMinutes,
  pondLightsActive,
  energy,
  energyCost,
}: {
  tier: FishingCatchTier;
  fishingLevel: number;
  weather: "sunny" | "rain" | "mist";
  timeMinutes: number;
  pondLightsActive: boolean;
  energy: number;
  energyCost: number;
}) {
  const stamina = normalizeXp(energy);
  const cost = Math.max(1, normalizeXp(energyCost));
  const minutes = normalizeXp(timeMinutes) % (24 * 60);

  if (stamina < cost) {
    return "咬钩节奏 · 体力不足";
  }

  if (minutes >= 21 * 60) {
    return "咬钩节奏 · 收竿入箱";
  }

  const level = Math.max(1, normalizeXp(fishingLevel));
  const masteryTrim = Math.floor((level - 1) / 2);
  const baseWindow = tier === "rare" ? 2 : tier === "good" ? 3 : tier === "common" ? 4 : 5;
  const windowSeconds = Math.max(1, baseWindow - masteryTrim);
  const boost = pondLightsActive ? "夜灯" : weather === "rain" ? "雨天" : weather === "mist" ? "雾天" : "普通";
  const bite = tier === "rare" ? "急咬" : tier === "good" ? "稳咬" : tier === "common" ? "轻咬" : "虚漂";
  const reaction =
    tier === "rare" ? "亮漂立收" : tier === "good" ? "漂沉再收" : tier === "common" ? "轻点收线" : "等二次涟漪";

  return `咬钩节奏 · ${boost}${bite} · ${windowSeconds}秒窗 · ${reaction}`;
}

export function fishingResultHint({
  caughtName,
  sellPrice,
  inventoryCount,
  energy,
  timeMinutes,
  condition,
}: {
  caughtName?: string;
  sellPrice?: number;
  inventoryCount?: number;
  energy: number;
  timeMinutes: number;
  condition: string;
}) {
  const minutes = normalizeXp(timeMinutes) % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const stamina = normalizeXp(energy);
  const fish = caughtName?.trim();
  const water = condition.trim() || "普通鱼情";
  const next = stamina <= 12 ? "下一步 · 吃点心/回家" : minutes >= 21 * 60 ? "下一步 · 入箱回家" : "下一步 · 再抛一竿";

  if (!fish) {
    return `空竿 · ${water} · ${clock} · ${stamina}体 · ${next}`;
  }

  return `钓到${fish} · 背包${normalizeXp(inventoryCount)}条 · ${normalizeXp(sellPrice)}金 · ${water} · ${clock} · ${stamina}体 · ${next}`;
}

export function socialFriendshipBonus(socialLevel: number) {
  return Math.floor(Math.max(1, socialLevel) / 3);
}

export function giftFriendshipPoints(basePoints: number, teaBonus: number, masteryBonus: number) {
  return Math.max(0, normalizeXp(basePoints) + normalizeXp(teaBonus) + normalizeXp(masteryBonus));
}

export function relationshipProgressLabel(points: number) {
  const normalizedPoints = normalizeXp(points);
  const stage = relationshipStage(normalizedPoints);

  return stage.nextPoints === undefined ? `${stage.label} MAX` : `${stage.label} ${normalizedPoints}/${stage.nextPoints}`;
}

export function relationshipNextHint(points: number) {
  const normalizedPoints = normalizeXp(points);
  const stage = relationshipStage(normalizedPoints);

  if (stage.nextPoints === undefined) {
    return "关系 · 知己MAX";
  }

  const nextLabels: Record<number, string> = {
    5: "相熟",
    12: "好友",
    24: "知己",
  };
  const nextLabel = nextLabels[stage.nextPoints] ?? "下一阶段";

  return `关系 · 距${nextLabel}还差${Math.max(0, stage.nextPoints - normalizedPoints)}心`;
}

export function relationshipRewardHint({
  npcName,
  stageLabel,
  rewardName,
  alreadyClaimed = false,
}: {
  npcName: string;
  stageLabel: string;
  rewardName: string;
  alreadyClaimed?: boolean;
}) {
  const npc = npcName.trim() || "镇民";
  const stage = stageLabel.trim() || "关系";
  const reward = rewardName.trim();

  if (alreadyClaimed) {
    return `${npc}奖励 · ${stage}已领取`;
  }

  if (!reward) {
    return `${npc}奖励 · 继续来往`;
  }

  return `${npc}奖励 · ${stage}解锁${reward} · 已放入背包`;
}

export function relationshipRewardPreviewHint({
  npcName,
  currentFriendship,
  giftPoints = 0,
  alreadyGifted = false,
  nextRewardName,
}: {
  npcName: string;
  currentFriendship: number;
  giftPoints?: number;
  alreadyGifted?: boolean;
  nextRewardName?: string;
}) {
  const npc = (npcName.trim() || "镇民").slice(0, 6);
  const current = normalizeXp(currentFriendship);
  const stage = relationshipStage(current);
  const reward = nextRewardName?.trim();

  if (stage.nextPoints === undefined) {
    return `${npc}奖励 · 知己MAX`;
  }

  if (!reward) {
    return `${npc}奖励 · 继续来往`;
  }

  const nextStage = relationshipStage(stage.nextPoints).label;
  const remaining = Math.max(0, stage.nextPoints - current);
  const points = normalizeXp(giftPoints);

  if (alreadyGifted) {
    return `${npc}奖励 · 差${remaining}心到${nextStage} · 明日冲${reward}`;
  }

  if (points >= remaining) {
    return `${npc}奖励 · 送礼可解锁${reward}`;
  }

  if (points > 0) {
    return `${npc}奖励 · 送后差${remaining - points}心 · ${reward}`;
  }

  return `${npc}奖励 · 差${remaining}心到${nextStage} · ${reward}`;
}

export function relationshipCollectionHint({
  entries,
  giftReadyCount,
  talkedTodayCount,
  giftedTodayCount,
}: {
  entries: Array<{ name: string; points: number }>;
  giftReadyCount: number;
  talkedTodayCount: number;
  giftedTodayCount: number;
}) {
  const normalizedEntries = entries.map((entry) => {
    const points = normalizeXp(entry.points);
    const stage = relationshipStage(points);

    return {
      name: (entry.name.trim() || "镇民").slice(0, 6),
      points,
      stage,
      remaining: stage.nextPoints === undefined ? 0 : Math.max(0, stage.nextPoints - points),
    };
  });
  const total = normalizedEntries.length;

  if (total === 0) {
    return "邻里图鉴 · 暂无镇民";
  }

  const maxed = normalizedEntries.filter((entry) => entry.stage.nextPoints === undefined).length;
  const nextTarget = normalizedEntries
    .filter((entry) => entry.stage.nextPoints !== undefined)
    .sort((left, right) => left.remaining - right.remaining || right.points - left.points)[0];
  const parts = [`邻里图鉴 · 知己${maxed}/${total}`];

  if (nextTarget) {
    const nextLabels: Record<number, string> = {
      5: "相熟",
      12: "好友",
      24: "知己",
    };
    const nextLabel = nextLabels[nextTarget.stage.nextPoints ?? 0] ?? "下一阶段";
    parts.push(`${nextTarget.name}差${nextTarget.remaining}心到${nextLabel}`);
  } else {
    parts.push("全员知己");
  }

  const gifts = normalizeXp(giftReadyCount);
  const talked = normalizeXp(talkedTodayCount);
  const gifted = normalizeXp(giftedTodayCount);

  if (gifts > 0) {
    parts.push(`礼物${gifts}件`);
  }

  if (talked > 0) {
    parts.push(`已聊${talked}人`);
  }

  if (gifted > 0) {
    parts.push(`已送${gifted}人`);
  }

  return parts.join(" · ");
}

export function socialVisitHint({
  samePlaceCount,
  giftReadyCount,
  talkedToday,
  giftedToday,
}: {
  samePlaceCount: number;
  giftReadyCount: number;
  talkedToday: boolean;
  giftedToday: boolean;
}) {
  const nearby = normalizeXp(samePlaceCount);
  const gifts = normalizeXp(giftReadyCount);

  if (giftedToday) {
    return "已送礼 · 今日社交完成";
  }

  if (talkedToday) {
    return gifts > 0 ? "已聊天 · 还能送礼" : "已聊天 · 明日带礼";
  }

  if (nearby > 0 && gifts > 0) {
    return `身边 ${nearby} 人 · 带礼可送`;
  }

  if (nearby > 0) {
    return `身边 ${nearby} 人 · 先聊天`;
  }

  return gifts > 0 ? "背包有礼 · 去找镇民" : "去小镇碰面";
}

export function npcVisitPlanHint({
  place,
  currentPlace,
  activity,
  giftName,
  loved,
  alreadyGifted,
}: {
  place: TravelTarget;
  currentPlace: TravelTarget;
  activity: string;
  giftName?: string;
  loved?: boolean;
  alreadyGifted: boolean;
}) {
  const placeLabels: Record<TravelTarget, string> = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  };
  const location = place === currentPlace ? "身边" : placeLabels[place];
  const action = alreadyGifted ? "今日已送" : giftName?.trim() ? `带${giftName.trim()}${loved ? "❤" : ""}` : "先聊天";
  const task = activity.trim() || "闲逛";

  return `${location} · ${action} · ${task}`;
}

export function npcRouteHint({
  place,
  currentPlace,
  timeMinutes,
  travelMinutes,
  giftName,
  loved,
  alreadyGifted,
}: {
  place: TravelTarget;
  currentPlace: TravelTarget;
  timeMinutes: number;
  travelMinutes: number;
  giftName?: string;
  loved?: boolean;
  alreadyGifted: boolean;
}) {
  const placeLabels: Record<TravelTarget, string> = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  };
  const action = alreadyGifted ? "今日已送" : giftName?.trim() ? `带${giftName.trim()}${loved ? "❤" : ""}` : "先聊天";

  if (place === currentPlace) {
    return `身边 · ${action}`;
  }

  const arrival = normalizeXp(timeMinutes) + normalizeXp(travelMinutes);
  const wrapped = arrival % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

  return `去${placeLabels[place]}${clock} · ${action}`;
}

export function npcRoutePlanHint({
  place,
  currentPlace,
  activity,
  timeMinutes,
  travelMinutes,
  giftName,
  loved,
  alreadyGifted,
}: {
  place: TravelTarget;
  currentPlace: TravelTarget;
  activity: string;
  timeMinutes: number;
  travelMinutes: number;
  giftName?: string;
  loved?: boolean;
  alreadyGifted: boolean;
}) {
  const route = npcRouteHint({ place, currentPlace, timeMinutes, travelMinutes, giftName, loved, alreadyGifted });
  const task = activity.trim() || "闲逛";

  return `${route} · ${task}`;
}

export function npcGiftRouteHint({
  npcName,
  place,
  currentPlace,
  giftName,
  loved = false,
  talkedToday,
  alreadyGifted,
  timeMinutes,
  travelMinutes,
}: {
  npcName: string;
  place: TravelTarget;
  currentPlace: TravelTarget;
  giftName?: string;
  loved?: boolean;
  talkedToday: boolean;
  alreadyGifted: boolean;
  timeMinutes: number;
  travelMinutes: number;
}) {
  const name = (npcName.trim() || "镇民").slice(0, 6);
  const gift = giftName?.trim();
  const heart = loved ? "❤" : "";
  const placeLabels = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  } satisfies Record<TravelTarget, string>;

  if (alreadyGifted) {
    return `${name} · 已送礼`;
  }

  if (!gift) {
    return talkedToday ? `${name} · 明日带礼` : `${name} · 先聊天`;
  }

  if (currentPlace === place) {
    return talkedToday ? `${name} · 送${gift}${heart}` : `${name} · 聊天后送${gift}${heart}`;
  }

  const arrival = normalizeXp(timeMinutes) + Math.max(0, normalizeXp(travelMinutes));

  if (arrival >= 21 * 60) {
    return `${name} · 夜深明日送${gift}${heart}`;
  }

  const wrapped = arrival % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

  return `去${placeLabels[place]}${clock} · 送${gift}${heart}`;
}

export function npcApproachCueHint({
  npcName,
  place,
  currentPlace,
  activity,
  giftName,
  loved = false,
  talkedToday,
  alreadyGifted,
  timeMinutes,
  travelMinutes,
}: {
  npcName: string;
  place: TravelTarget;
  currentPlace: TravelTarget;
  activity: string;
  giftName?: string;
  loved?: boolean;
  talkedToday: boolean;
  alreadyGifted: boolean;
  timeMinutes: number;
  travelMinutes: number;
}) {
  const name = (npcName.trim() || "镇民").slice(0, 6);
  const task = activity.trim() || "闲逛";
  const gift = giftName?.trim();
  const heart = loved ? "❤" : "";
  const placeLabels = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  } satisfies Record<TravelTarget, string>;

  if (talkedToday && alreadyGifted) {
    return `${name} · 今日完成 · ${task}`;
  }

  if (place === currentPlace) {
    if (gift && !alreadyGifted) {
      return talkedToday ? `${name} · 身边送${gift}${heart} · ${task}` : `${name} · 先聊再送${gift}${heart} · ${task}`;
    }

    return talkedToday ? `${name} · 今日已聊 · ${task}` : `${name} · 身边聊天 · ${task}`;
  }

  const arrival = normalizeXp(timeMinutes) + Math.max(0, normalizeXp(travelMinutes));

  if (arrival >= 21 * 60) {
    return `${name} · 夜深明日访 · ${task}`;
  }

  const wrapped = arrival % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const action = gift && !alreadyGifted ? `送${gift}${heart}` : "聊天";

  return `${name} · 去${placeLabels[place]}${clock} · ${action} · ${task}`;
}

export function npcMapLabel({
  name,
  activity,
  talkedToday,
  giftedToday,
  giftReady,
}: {
  name: string;
  activity: string;
  talkedToday: boolean;
  giftedToday: boolean;
  giftReady: boolean;
}) {
  const displayName = name.trim() || "镇民";
  const task = activity.trim() || "闲逛";
  const status = giftedToday ? "已送" : talkedToday ? (giftReady ? "还能送" : "已聊") : giftReady ? "可聊/礼" : "可聊";

  return `${displayName} · ${status} · ${task}`;
}

export function npcScheduleMapHint({
  entries,
  currentPlace,
  giftReadyCount,
  timeMinutes,
  travelMinutes,
}: {
  entries: Array<{
    name: string;
    place: TravelTarget;
    activity: string;
    talkedToday: boolean;
    giftedToday: boolean;
    giftReady: boolean;
  }>;
  currentPlace: TravelTarget;
  giftReadyCount: number;
  timeMinutes?: number;
  travelMinutes?: number;
}) {
  const placeLabels = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  } satisfies Record<TravelTarget, string>;
  const routeAction = (place: TravelTarget, action: "送礼" | "聊天") => {
    if (place === currentPlace) {
      return `身边${action}`;
    }

    if (timeMinutes === undefined || travelMinutes === undefined) {
      return `@${placeLabels[place]}${action}`;
    }

    const arrival = normalizeXp(timeMinutes) + Math.max(0, normalizeXp(travelMinutes));
    const wrapped = arrival % (24 * 60);
    const hour = Math.floor(wrapped / 60);
    const minute = wrapped % 60;
    const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

    return `去${placeLabels[place]}${clock}${action}`;
  };
  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    name: (entry.name.trim() || "镇民").slice(0, 6),
    activity: (entry.activity.trim() || "闲逛").slice(0, 6),
  }));
  const nearby = normalizedEntries.filter((entry) => entry.place === currentPlace);
  const gifts = normalizeXp(giftReadyCount);
  const giftTarget =
    nearby.find((entry) => entry.giftReady && !entry.giftedToday) ??
    normalizedEntries.find((entry) => entry.giftReady && !entry.giftedToday);

  if (normalizedEntries.length === 0) {
    return "邻里地图 · 暂无镇民";
  }

  if (giftTarget) {
    if (timeMinutes === undefined || travelMinutes === undefined) {
      return `邻里地图 · 身边${nearby.length}人 · 优先${giftTarget.name}@${placeLabels[giftTarget.place]}送礼 · 礼物${gifts}件`;
    }

    return `邻里地图 · 身边${nearby.length}人 · 优先${giftTarget.name} · ${routeAction(giftTarget.place, "送礼")} · 礼物${gifts}件`;
  }

  const talkTarget =
    nearby.find((entry) => !entry.talkedToday) ??
    normalizedEntries.find((entry) => !entry.talkedToday);

  if (talkTarget) {
    if (timeMinutes === undefined || travelMinutes === undefined) {
      return `邻里地图 · 身边${nearby.length}人 · 找${talkTarget.name}@${placeLabels[talkTarget.place]}聊天 · ${talkTarget.activity}`;
    }

    return `邻里地图 · 身边${nearby.length}人 · 找${talkTarget.name} · ${routeAction(talkTarget.place, "聊天")} · ${talkTarget.activity}`;
  }

  return `邻里地图 · 身边${nearby.length}人 · 今日社交收尾`;
}

export function wateringSplashLimit(farmingLevel: number) {
  return Math.max(1, farmingLevel) >= 4 ? 2 : 0;
}

export function cropGrowthStatus(growth: number, growDays: number): CropGrowthStatus {
  const normalizedGrowDays = Math.max(1, normalizeXp(growDays));
  const currentDay = Math.min(normalizeXp(growth), normalizedGrowDays);
  const remainingDays = Math.max(0, normalizedGrowDays - currentDay);
  const mature = remainingDays === 0;

  return {
    mature,
    currentDay,
    growDays: normalizedGrowDays,
    remainingDays,
    progressRatio: currentDay / normalizedGrowDays,
    label: mature ? "今日可收" : remainingDays === 1 ? "明天可收" : `还需 ${remainingDays} 天`,
  };
}

export function fieldCareSummary({
  plantedCount,
  wateredCount,
  matureCount,
}: {
  plantedCount: number;
  wateredCount: number;
  matureCount: number;
}) {
  const planted = normalizeXp(plantedCount);
  const watered = Math.min(planted, normalizeXp(wateredCount));
  const mature = Math.min(planted, normalizeXp(matureCount));
  const dry = Math.max(0, planted - watered);

  if (planted === 0) {
    return "空田 · 先开垦播种";
  }

  if (mature > 0) {
    return `${mature} 块可收 · ${watered}/${planted} 已浇`;
  }

  if (dry > 0) {
    return `待浇 ${dry} 块 · ${watered}/${planted} 已浇`;
  }

  return `全部已浇 · ${watered}/${planted}`;
}

export function fieldWorkloadHint({
  dryCount,
  matureCount,
  waterCost,
  harvestCost,
  minutesPerAction,
}: {
  dryCount: number;
  matureCount: number;
  waterCost: number;
  harvestCost: number;
  minutesPerAction: number;
}) {
  const dry = normalizeXp(dryCount);
  const mature = normalizeXp(matureCount);
  const waterEnergy = Math.max(1, normalizeXp(waterCost));
  const harvestEnergy = Math.max(1, normalizeXp(harvestCost));
  const minutes = Math.max(1, normalizeXp(minutesPerAction));
  const actions = dry + mature;

  if (actions === 0) {
    return "田地已收尾";
  }

  const tasks = [
    mature > 0 ? `收${mature}` : undefined,
    dry > 0 ? `浇${dry}` : undefined,
  ].filter(Boolean).join(" · ");
  const energy = dry * waterEnergy + mature * harvestEnergy;

  return `${tasks} · ${energy}体/${actions * minutes}分`;
}

export function fieldEnergyPlanHint({
  energy,
  dryCount,
  matureCount,
  waterCost,
  harvestCost,
  snackEnergyAvailable = 0,
}: {
  energy: number;
  dryCount: number;
  matureCount: number;
  waterCost: number;
  harvestCost: number;
  snackEnergyAvailable?: number;
}) {
  const dry = normalizeXp(dryCount);
  const mature = normalizeXp(matureCount);
  const required = dry * Math.max(1, normalizeXp(waterCost)) + mature * Math.max(1, normalizeXp(harvestCost));
  const current = normalizeXp(energy);
  const snack = normalizeXp(snackEnergyAvailable);

  if (required === 0) {
    return "体力可留给跑图";
  }

  if (current >= required) {
    return `体力够 · 余${current - required}`;
  }

  const shortage = required - current;

  if (snack >= shortage) {
    return `先吃点心+${snack}体 · 可收尾`;
  }

  return snack > 0 ? `点心后还缺${shortage - snack}体` : `体力缺${shortage} · 先补给`;
}

export function snackEnergyValue(sellPrice: number, category: SnackCategory) {
  const value = normalizeXp(sellPrice);
  const categoryConfig: Record<SnackCategory, { multiplier: number; minimum: number }> = {
    crop: { multiplier: 0.35, minimum: 4 },
    forage: { multiplier: 0.55, minimum: 6 },
    fish: { multiplier: 0.45, minimum: 8 },
  };
  const config = categoryConfig[category];

  return Math.min(35, Math.max(config.minimum, Math.floor(value * config.multiplier)));
}

export function snackTradeoffHint({
  sellPrice,
  energyGain,
  orderReserveCount = 0,
}: {
  sellPrice: number;
  energyGain: number;
  orderReserveCount?: number;
}) {
  const base = `${normalizeXp(sellPrice)}金 / +${normalizeXp(energyGain)}体`;
  const reserve = normalizeXp(orderReserveCount);

  return reserve > 0 ? `${base} · 委托留${reserve}` : base;
}

export function snackResultHint({
  snackName,
  restoredEnergy,
  energy,
  maxEnergy,
}: {
  snackName: string;
  restoredEnergy: number;
  energy: number;
  maxEnergy: number;
}) {
  const name = snackName.trim() || "点心";
  const restored = normalizeXp(restoredEnergy);
  const current = normalizeXp(energy);
  const max = Math.max(1, normalizeXp(maxEnergy));
  const ratio = current / max;
  const status = current >= max ? "体力已满" : ratio <= 0.35 ? "还偏累" : "可继续干活";

  return `吃下${name} · +${restored}体 · ${Math.min(current, max)}/${max}体 · ${status}`;
}

export function forageActionHint({
  name,
  count,
  sellPrice,
  energyGain,
}: {
  name: string;
  count: number;
  sellPrice: number;
  energyGain: number;
}) {
  const amount = Math.max(1, normalizeXp(count));

  return `${name}${amount > 1 ? ` x${amount}` : ""} · ${normalizeXp(sellPrice) * amount}金/+${normalizeXp(energyGain)}体`;
}

export function forageResultHint({
  name,
  count,
  sellPrice,
  energyGain,
  inventoryCount,
  giftReadyCount,
  timeMinutes,
}: {
  name: string;
  count: number;
  sellPrice: number;
  energyGain: number;
  inventoryCount: number;
  giftReadyCount: number;
  timeMinutes: number;
}) {
  const item = name.trim() || "采集物";
  const amount = Math.max(1, normalizeXp(count));
  const totalValue = normalizeXp(sellPrice) * amount;
  const minutes = normalizeXp(timeMinutes) % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const gifts = normalizeXp(giftReadyCount);
  const late = minutes >= 20 * 60;
  const next = gifts > 0 ? `下一步 · 带礼${gifts}件` : late ? "下一步 · 入箱回家" : "下一步 · 继续采集/入箱";

  return `采到${item}${amount > 1 ? ` x${amount}` : ""} · 背包${normalizeXp(inventoryCount)}件 · ${totalValue}金/+${normalizeXp(energyGain)}体 · ${clock} · ${next}`;
}

export function snackAutoUseCount({
  inventoryCount,
  orderReserveCount = 0,
}: {
  inventoryCount: number;
  orderReserveCount?: number;
}) {
  return Math.max(0, normalizeXp(inventoryCount) - normalizeXp(orderReserveCount));
}

export function giftAutoUseCount({
  inventoryCount,
  orderReserveCount = 0,
}: {
  inventoryCount: number;
  orderReserveCount?: number;
}) {
  return Math.max(0, normalizeXp(inventoryCount) - normalizeXp(orderReserveCount));
}

export function giftChoiceHint({
  name,
  points,
  loved,
  autoUseCount,
  orderReserveCount = 0,
}: {
  name: string;
  points: number;
  loved: boolean;
  autoUseCount: number;
  orderReserveCount?: number;
}) {
  const base = `${name}+${normalizeXp(points)}${loved ? "❤" : ""}`;
  const reserve = normalizeXp(orderReserveCount);

  if (reserve === 0) {
    return base;
  }

  const usable = normalizeXp(autoUseCount);

  return usable > 0 ? `${base} · 余${usable}可送` : `${base} · 动用委托`;
}

export function giftMotivationHint({
  npcName,
  currentFriendship,
  giftName,
  giftPoints,
  loved = false,
  alreadyGifted,
  nextRewardName,
}: {
  npcName: string;
  currentFriendship: number;
  giftName?: string;
  giftPoints: number;
  loved?: boolean;
  alreadyGifted: boolean;
  nextRewardName?: string;
}) {
  const name = (npcName.trim() || "镇民").slice(0, 6);
  const current = normalizeXp(currentFriendship);
  const points = normalizeXp(giftPoints);
  const stage = relationshipStage(current);

  if (alreadyGifted) {
    return `${name} · 今日已送 · 明日再刷关系`;
  }

  const gift = giftName?.trim();

  if (!gift) {
    return `${name} · 缺礼物 · 带作物/采集/渔获`;
  }

  const giftLabel = `${gift}+${points}${loved ? "❤" : ""}`;

  if (stage.nextPoints === undefined) {
    return `${name} · ${giftLabel} · 知己MAX`;
  }

  const projected = current + points;
  const reward = nextRewardName?.trim();
  const rewardText = reward ? ` · 奖励${reward}` : "";

  if (projected >= stage.nextPoints) {
    return `${name} · ${giftLabel} · 可到${relationshipStage(projected).label}${rewardText}`;
  }

  return `${name} · ${giftLabel} · 还差${stage.nextPoints - projected}心到${relationshipStage(stage.nextPoints).label}${rewardText}`;
}

export function npcInteractionStateHint({
  relationshipLabel,
  talkedToday,
  giftedToday,
  giftHint,
  socialBonus,
}: {
  relationshipLabel: string;
  talkedToday: boolean;
  giftedToday: boolean;
  giftHint?: string;
  socialBonus: number;
}) {
  const relation = relationshipLabel.trim() || "关系未知";
  const bonus = normalizeXp(socialBonus);
  const talk = talkedToday ? "E 今日已聊" : "E 聊天";

  if (giftedToday) {
    return `${talk} ${relation} / G 今日已送${bonus > 0 ? ` 邻里+${bonus}` : ""}`;
  }

  const gift = giftHint?.trim() || `送礼${bonus > 0 ? ` 邻里+${bonus}` : ""}`;

  return `${talk} ${relation} / G ${gift}`;
}

export function socialActionMemoryHint({
  relationshipLabel,
  talkedToday,
  giftedToday,
  giftReady,
}: {
  relationshipLabel: string;
  talkedToday: boolean;
  giftedToday: boolean;
  giftReady: boolean;
}) {
  const relation = relationshipLabel.trim() || "关系未知";

  if (talkedToday && giftedToday) {
    return `今日社交完成 · ${relation}`;
  }

  if (talkedToday) {
    return giftReady ? `已聊天 · 还能送礼 · ${relation}` : `已聊天 · 明日带礼 · ${relation}`;
  }

  if (giftedToday) {
    return `已送礼 · 还可聊天 · ${relation}`;
  }

  return `未互动 · ${relation}`;
}

export function giftResultHint({
  npcName,
  giftName,
  loved,
  lovedLine,
  points,
  teaBonus = 0,
  masteryBonus = 0,
  stageLabel,
  friendship,
  rewardText = "",
  questText = "",
  masteryText = "",
}: {
  npcName: string;
  giftName: string;
  loved: boolean;
  lovedLine?: string;
  points: number;
  teaBonus?: number;
  masteryBonus?: number;
  stageLabel: string;
  friendship: number;
  rewardText?: string;
  questText?: string;
  masteryText?: string;
}) {
  const giver = npcName.trim() || "镇民";
  const item = giftName.trim() || "礼物";
  const reaction = loved ? lovedLine?.trim() || "这正是我喜欢的。" : "这份心意我收下了。";
  const tea = normalizeXp(teaBonus);
  const mastery = normalizeXp(masteryBonus);

  return `${giver}：谢谢你的${item}。${reaction} 好感 +${normalizeXp(points)}${tea > 0 ? `（茶会 +${tea}）` : ""}${
    mastery > 0 ? `（邻里熟练 +${mastery}）` : ""
  }（${stageLabel.trim() || "初识"} · ${normalizeXp(friendship)} 心）${rewardText}${questText}${masteryText}`;
}

export function talkResultHint({
  dialogText,
  points,
  teaBonus = 0,
  masteryBonus = 0,
  stageLabel,
  friendship,
  rewardText = "",
  questText = "",
  masteryText = "",
}: {
  dialogText: string;
  points: number;
  teaBonus?: number;
  masteryBonus?: number;
  stageLabel: string;
  friendship: number;
  rewardText?: string;
  questText?: string;
  masteryText?: string;
}) {
  const dialog = dialogText.trim() || "镇民：今天也要慢慢来。";
  const tea = normalizeXp(teaBonus);
  const mastery = normalizeXp(masteryBonus);

  return `${dialog} 好感 +${normalizeXp(points)}${tea > 0 ? `（茶会 +${tea}）` : ""}${
    mastery > 0 ? `（邻里熟练 +${mastery}）` : ""
  }（${stageLabel.trim() || "初识"} · ${normalizeXp(friendship)} 心）${rewardText}${questText}${masteryText}`;
}

export function farmRating(input: FarmRatingInput): FarmRating {
  const score =
    normalizeXp(input.totalShipped) * 2 +
    Math.floor(normalizeXp(input.totalShippingIncome) / 12) +
    normalizeXp(input.completedOrders) * 18 +
    normalizeXp(input.totalFriendship) * 4 +
    normalizeXp(input.totalMasteryLevel) * 6;

  if (score >= 420) {
    return { score, tier: "valley", label: "山谷名农" };
  }

  if (score >= 220) {
    return { score, tier: "orchard", label: "丰收小院", nextScore: 420 };
  }

  if (score >= 90) {
    return { score, tier: "homestead", label: "安稳农舍", nextScore: 220 };
  }

  return { score, tier: "sprout", label: "新芽农场", nextScore: 90 };
}

export function relationshipStage(points: number): RelationshipStage {
  const normalizedPoints = normalizeXp(points);

  if (normalizedPoints >= 24) {
    return { level: 4, label: "知己" };
  }

  if (normalizedPoints >= 12) {
    return { level: 3, label: "好友", nextPoints: 24 };
  }

  if (normalizedPoints >= 5) {
    return { level: 2, label: "相熟", nextPoints: 12 };
  }

  return { level: 1, label: "初识", nextPoints: 5 };
}

export function seedPrice(basePrice: number, farmingLevel: number, ratingScore: number) {
  const normalizedBase = Math.max(1, normalizeXp(basePrice));
  const masteryDiscount = Math.max(0, Math.min(10, (Math.max(1, farmingLevel) - 1) * 2));
  const ratingDiscount = Math.max(0, Math.min(8, Math.floor(normalizeXp(ratingScore) / 120) * 2));
  const discountPercent = Math.min(18, masteryDiscount + ratingDiscount);
  const discountedPrice = Math.floor(normalizedBase * (100 - discountPercent) / 100);

  return {
    price: Math.max(1, discountedPrice),
    discountPercent,
  };
}

export function cropEconomics({
  seedCost,
  sellPrice,
  growDays,
}: {
  seedCost: number;
  sellPrice: number;
  growDays: number;
}) {
  const normalizedSeedCost = normalizeXp(seedCost);
  const normalizedSellPrice = normalizeXp(sellPrice);
  const normalizedGrowDays = Math.max(1, normalizeXp(growDays));
  const profit = normalizedSellPrice - normalizedSeedCost;

  return {
    seedCost: normalizedSeedCost,
    sellPrice: normalizedSellPrice,
    growDays: normalizedGrowDays,
    profit,
    profitPerDay: Math.floor(profit / normalizedGrowDays),
  };
}

export function seedBatchEconomyHint({
  seedCost,
  sellPrice,
  growDays,
  quantity,
  openPlotCount,
}: {
  seedCost: number;
  sellPrice: number;
  growDays: number;
  quantity: number;
  openPlotCount: number;
}) {
  const economics = cropEconomics({ seedCost, sellPrice, growDays });
  const amount = normalizeXp(quantity);
  const openPlots = normalizeXp(openPlotCount);

  if (amount === 0) {
    return "暂不买种";
  }

  if (openPlots === 0) {
    return `备货${amount}包 · ${economics.growDays}天后净利${economics.profit * amount}金`;
  }

  const planted = Math.min(amount, openPlots);
  const reserve = Math.max(0, amount - planted);
  const revenue = economics.sellPrice * planted;
  const profit = economics.profit * planted;
  const reserveHint = reserve > 0 ? ` · 余${reserve}包备货` : "";

  return `播${planted}块 · ${economics.growDays}天后${revenue}金 · 净利${profit}金${reserveHint}`;
}

export function seedShopRecommendationHint({
  options,
  gold,
  openPlotCount,
}: {
  options: Array<{
    cropName: string;
    seedCost: number;
    sellPrice: number;
    growDays: number;
  }>;
  gold: number;
  openPlotCount: number;
}) {
  const normalizedOptions = options
    .map((option) => ({
      ...cropEconomics({
        seedCost: option.seedCost,
        sellPrice: option.sellPrice,
        growDays: option.growDays,
      }),
      cropName: option.cropName.trim() || "作物",
    }))
    .filter((option) => option.seedCost > 0);

  if (normalizedOptions.length === 0) {
    return "暂无种子";
  }

  const coins = normalizeXp(gold);
  const openPlots = normalizeXp(openPlotCount);

  if (openPlots === 0) {
    return "先开田 · 再买种";
  }

  const affordable = normalizedOptions.filter((option) => option.seedCost <= coins);

  if (affordable.length === 0) {
    const cheapest = [...normalizedOptions].sort((left, right) => left.seedCost - right.seedCost)[0];

    return `${cheapest.cropName}还差${cheapest.seedCost - coins}金`;
  }

  const best = [...affordable].sort((left, right) =>
    right.profitPerDay - left.profitPerDay || right.profit - left.profit || left.growDays - right.growDays,
  )[0];
  const plantable = Math.min(openPlots, Math.floor(coins / Math.max(1, best.seedCost)));

  return `推荐${best.cropName} · 日利${best.profitPerDay} · 可播${plantable}块`;
}

export function seedPurchaseHint({
  gold,
  seedPrice,
  carriedSeeds,
  openPlotCount,
}: {
  gold: number;
  seedPrice: number;
  carriedSeeds: number;
  openPlotCount: number;
}) {
  const price = Math.max(1, normalizeXp(seedPrice));
  const affordable = Math.floor(normalizeXp(gold) / price);
  const carried = normalizeXp(carriedSeeds);
  const openPlots = normalizeXp(openPlotCount);

  if (affordable === 0) {
    return `金币不足 · 还差 ${price - normalizeXp(gold)} 金`;
  }

  if (openPlots === 0) {
    return `可买 ${affordable} 包 · 先开垦空田`;
  }

  const needed = Math.max(0, openPlots - carried);

  if (needed === 0) {
    return `种子够播 · 可买 ${affordable} 包备货`;
  }

  return `可买 ${affordable} 包 · 可播地还缺 ${needed} 包`;
}

export function seedShelfDecisionHint({
  cropName,
  gold,
  seedPrice,
  carriedSeeds,
  openPlotCount,
  selected = false,
}: {
  cropName: string;
  gold: number;
  seedPrice: number;
  carriedSeeds: number;
  openPlotCount: number;
  selected?: boolean;
}) {
  const name = cropName.trim() || "作物";
  const prefix = selected ? `已选${name}` : `${name}货架`;
  const price = Math.max(1, normalizeXp(seedPrice));
  const coins = normalizeXp(gold);
  const openPlots = normalizeXp(openPlotCount);
  const carried = normalizeXp(carriedSeeds);
  const affordable = Math.floor(coins / price);

  if (openPlots === 0) {
    return `${prefix} · 先开田`;
  }

  if (affordable === 0) {
    return `${prefix} · 差${price - coins}金`;
  }

  const missing = Math.max(0, openPlots - carried);

  if (missing === 0) {
    return selected ? `${prefix} · 种子够` : `${prefix} · 备货${affordable}包`;
  }

  return `${prefix} · 买${Math.min(missing, affordable)}补田`;
}

export function seedPurchaseOutcomeHint({
  gold,
  seedPrice,
  requestedQuantity,
  carriedSeeds,
  openPlotCount,
}: {
  gold: number;
  seedPrice: number;
  requestedQuantity: number;
  carriedSeeds: number;
  openPlotCount: number;
}) {
  const normalizedGold = normalizeXp(gold);
  const price = Math.max(1, normalizeXp(seedPrice));
  const requested = Math.max(1, normalizeXp(requestedQuantity));
  const affordable = Math.floor(normalizedGold / price);
  const amount = Math.min(requested, affordable);

  if (amount === 0) {
    return `金币不足 · 还差 ${price - normalizedGold} 金`;
  }

  const cost = amount * price;
  const remainingGold = normalizedGold - cost;
  const openPlots = normalizeXp(openPlotCount);
  const seedTotal = normalizeXp(carriedSeeds) + amount;
  const remainingNeed = Math.max(0, openPlots - seedTotal);
  const base = `买 ${amount} 包花 ${cost} 金 · 余 ${remainingGold} 金`;

  if (openPlots === 0) {
    return `${base} · 先开田`;
  }

  return remainingNeed === 0 ? `${base} · 可播满` : `${base} · 还缺 ${remainingNeed} 包`;
}

export function seedPurchaseReceiptHint({
  gold,
  seedPrice,
  requestedQuantity,
  carriedSeeds,
  openPlotCount,
  currentPlace,
  timeMinutes,
  travelMinutes,
}: {
  gold: number;
  seedPrice: number;
  requestedQuantity: number;
  carriedSeeds: number;
  openPlotCount: number;
  currentPlace: TravelTarget;
  timeMinutes: number;
  travelMinutes: number;
}) {
  const outcome = seedPurchaseOutcomeHint({ gold, seedPrice, requestedQuantity, carriedSeeds, openPlotCount });
  const normalizedGold = normalizeXp(gold);
  const price = Math.max(1, normalizeXp(seedPrice));
  const requested = Math.max(1, normalizeXp(requestedQuantity));
  const affordable = Math.floor(normalizedGold / price);
  const amount = Math.min(requested, affordable);

  if (amount === 0) {
    return outcome;
  }

  const remainingGold = normalizedGold - amount * price;
  const carriedAfterPurchase = normalizeXp(carriedSeeds) + amount;
  const affordableAfterPurchase = Math.floor(remainingGold / price);
  const nextStep = seedRouteHint({
    currentPlace,
    openPlotCount,
    carriedSeeds: carriedAfterPurchase,
    affordableSeeds: affordableAfterPurchase,
    timeMinutes,
    travelMinutes,
  });

  return `${outcome} · 下一步 · ${nextStep}`;
}

export function seedRouteHint({
  currentPlace,
  openPlotCount,
  carriedSeeds,
  affordableSeeds,
  timeMinutes,
  travelMinutes,
}: {
  currentPlace: TravelTarget;
  openPlotCount: number;
  carriedSeeds: number;
  affordableSeeds: number;
  timeMinutes: number;
  travelMinutes: number;
}) {
  const openPlots = normalizeXp(openPlotCount);
  const carried = normalizeXp(carriedSeeds);
  const affordable = normalizeXp(affordableSeeds);
  const missing = Math.max(0, openPlots - carried);

  if (openPlots === 0) {
    return "先开田 · 再买种";
  }

  if (missing === 0) {
    return currentPlace === "farm" ? `播种 ${openPlots} 块` : `回农场播 ${openPlots} 块`;
  }

  if (affordable === 0) {
    return `缺种 ${missing} 包 · 先赚钱`;
  }

  const amount = Math.min(missing, affordable);

  if (currentPlace === "shop") {
    return `买 ${amount} 包 · 回农场`;
  }

  const arrival = normalizeXp(timeMinutes) + normalizeXp(travelMinutes);
  const wrapped = arrival % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

  return `去商店${clock} · 买 ${amount} 包`;
}

export function seedFieldReadinessHint({
  openPlotCount,
  carriedSeeds,
  energy,
  seedCost,
  minutesPerAction,
  currentPlace,
}: {
  openPlotCount: number;
  carriedSeeds: number;
  energy: number;
  seedCost: number;
  minutesPerAction: number;
  currentPlace: TravelTarget;
}) {
  const openPlots = normalizeXp(openPlotCount);
  const seeds = normalizeXp(carriedSeeds);
  const plantable = Math.min(openPlots, seeds);
  const stamina = normalizeXp(energy);
  const cost = Math.max(1, normalizeXp(seedCost));
  const minutes = Math.max(1, normalizeXp(minutesPerAction));
  const place = currentPlace === "farm" ? "田边" : "回农场";

  if (openPlots === 0) {
    return "播种准备 · 先开田";
  }

  if (seeds === 0) {
    return "播种准备 · 先买种";
  }

  if (stamina < cost) {
    return `播种准备 · 体力不足需${cost}`;
  }

  const energyLimited = Math.floor(stamina / cost);
  const actions = Math.min(plantable, energyLimited);

  if (actions <= 0) {
    return `播种准备 · 体力不足需${cost}`;
  }

  const workload = `${actions}块/${actions * cost}体/${actions * minutes}分`;

  if (actions < plantable) {
    return `播种准备 · ${place} · 可播${workload} · 体力卡住`;
  }

  if (plantable < openPlots) {
    return `播种准备 · ${place} · 可播${workload} · 缺${openPlots - plantable}包`;
  }

  return `播种准备 · ${place} · 可播满${workload}`;
}

export function orderStreakBonus(streak: number) {
  const normalizedStreak = normalizeXp(streak);

  if (normalizedStreak <= 1) {
    return 0;
  }

  return Math.min(90, normalizedStreak * 8 + Math.floor(normalizedStreak / 3) * 10);
}

export function orderRewardSummary({
  reward,
  count,
  nextStreakBonus,
}: {
  reward: number;
  count: number;
  nextStreakBonus: number;
}) {
  const normalizedReward = normalizeXp(reward);
  const normalizedCount = Math.max(1, normalizeXp(count));
  const normalizedBonus = normalizeXp(nextStreakBonus);
  const perItem = Math.floor(normalizedReward / normalizedCount);

  return normalizedBonus > 0
    ? `奖${normalizedReward} · 单件${perItem} · 连击+${normalizedBonus}`
    : `奖${normalizedReward} · 单件${perItem}`;
}

export function orderTurnInHint({
  backpackCount,
  boxedCount,
  requiredCount,
  reward,
  nextStreakBonus,
  accepted,
  completed,
}: {
  backpackCount: number;
  boxedCount: number;
  requiredCount: number;
  reward: number;
  nextStreakBonus: number;
  accepted: boolean;
  completed: boolean;
}) {
  if (completed) {
    return "今日已交付";
  }

  const backpack = normalizeXp(backpackCount);
  const boxed = normalizeXp(boxedCount);
  const required = Math.max(1, normalizeXp(requiredCount));
  const total = backpack + boxed;
  const remaining = Math.max(0, required - total);
  const payout = normalizeXp(nextStreakBonus) > 0
    ? `奖${normalizeXp(reward)}+连击${normalizeXp(nextStreakBonus)}`
    : `奖${normalizeXp(reward)}`;

  if (!accepted) {
    return total > 0 ? `接单后交付 · 现有${Math.min(total, required)}/${required} · ${payout}` : `接单后交付 · ${payout}`;
  }

  if (boxed >= required) {
    return `睡醒交付 · 箱内${boxed}/${required} · ${payout}`;
  }

  if (total >= required) {
    return `已备齐 · 再入箱 · ${payout}`;
  }

  return `还差${remaining} · 交付${payout}`;
}

export function orderNextStepHint({
  backpackCount,
  boxedCount,
  requiredCount,
  accepted,
  completed,
}: {
  backpackCount: number;
  boxedCount: number;
  requiredCount: number;
  accepted: boolean;
  completed: boolean;
}) {
  if (completed) {
    return "明早看新委托";
  }

  const backpack = normalizeXp(backpackCount);
  const boxed = normalizeXp(boxedCount);
  const required = Math.max(1, normalizeXp(requiredCount));
  const total = backpack + boxed;

  if (!accepted) {
    return "先去公告板接单";
  }

  if (boxed >= required) {
    return "回家睡觉结算";
  }

  if (total >= required) {
    return `把背包${Math.max(0, required - boxed)}件入箱`;
  }

  return `继续收集${required - total}件`;
}

export function orderBoardActionHint({
  cropName,
  backpackCount,
  boxedCount,
  requiredCount,
  accepted,
  completed,
}: {
  cropName: string;
  backpackCount: number;
  boxedCount: number;
  requiredCount: number;
  accepted: boolean;
  completed: boolean;
}) {
  if (completed) {
    return "公告板 今日完成";
  }

  const name = cropName.trim() || "作物";
  const backpack = normalizeXp(backpackCount);
  const boxed = normalizeXp(boxedCount);
  const required = Math.max(1, normalizeXp(requiredCount));
  const available = Math.min(required, backpack + boxed);

  if (!accepted) {
    return available > 0 ? `公告板 接${name}单 · 现有${available}/${required}` : `公告板 接${name}单 · 需${required}件`;
  }

  const nextStep = orderNextStepHint({ backpackCount, boxedCount, requiredCount, accepted, completed });

  return available >= required ? `公告板 已备齐 · ${nextStep}` : `公告板 还差${required - available} · ${nextStep}`;
}

export function orderSettlementHint({
  orderReward,
  streakBonus,
  eventTitle,
  completed,
}: {
  orderReward: number;
  streakBonus: number;
  eventTitle?: string;
  completed: boolean;
}) {
  if (!completed) {
    return "委托未交付 · 连击中断";
  }

  const reward = normalizeXp(orderReward);
  const streak = normalizeXp(streakBonus);
  const total = reward + streak;
  const source = eventTitle?.trim() === "山风集市" ? "山风集市委托" : "公告板委托";

  return streak > 0 ? `${source} +${reward}金 · 连击+${streak} · 合计${total}金` : `${source} +${reward}金`;
}

export function orderBoardPreviewHint({
  cropName,
  availableCount,
  requiredCount,
  reward,
  nextStreakBonus,
  accepted,
  completed,
  timeMinutes,
}: {
  cropName: string;
  availableCount: number;
  requiredCount: number;
  reward: number;
  nextStreakBonus: number;
  accepted: boolean;
  completed: boolean;
  timeMinutes: number;
}) {
  const crop = cropName.trim() || "作物";
  const available = normalizeXp(availableCount);
  const required = Math.max(1, normalizeXp(requiredCount));
  const remaining = Math.max(0, required - available);
  const payout = normalizeXp(reward) + normalizeXp(nextStreakBonus);
  const urgent = normalizeXp(timeMinutes) >= 21 * 60;

  if (completed) {
    return `${crop}委托已完成 · 明早刷新`;
  }

  if (available >= required) {
    return `${accepted ? "已接可交" : "接单即备齐"} · ${crop} ${Math.min(available, required)}/${required} · ${payout}金`;
  }

  if (accepted) {
    return `已接${crop} · 还差${remaining} · ${urgent ? "夜里紧急" : "今日入箱"}`;
  }

  return `可接${crop} · 现有${available}/${required} · 还差${remaining} · ${payout}金`;
}

export function orderFulfillmentProgress({
  availableCount,
  requiredCount,
  accepted,
  completed,
}: {
  availableCount: number;
  requiredCount: number;
  accepted: boolean;
  completed: boolean;
}) {
  const available = normalizeXp(availableCount);
  const required = Math.max(1, normalizeXp(requiredCount));
  const remaining = Math.max(0, required - available);
  const ready = available >= required;
  const status: OrderFulfillmentStatus = completed ? "completed" : !accepted ? "open" : ready ? "ready" : "in_progress";

  return {
    status,
    availableCount: available,
    requiredCount: required,
    remainingCount: remaining,
    ready,
  };
}

export function orderSourceHint({
  backpackCount,
  boxedCount,
  requiredCount,
  accepted,
  completed,
}: {
  backpackCount: number;
  boxedCount: number;
  requiredCount: number;
  accepted: boolean;
  completed: boolean;
}) {
  const backpack = normalizeXp(backpackCount);
  const boxed = normalizeXp(boxedCount);
  const required = Math.max(1, normalizeXp(requiredCount));
  const total = backpack + boxed;

  if (completed) {
    return "今日已完成";
  }

  if (!accepted) {
    return `未接单 · 现有 ${total}/${required}`;
  }

  if (total >= required) {
    return boxed >= required ? `箱内备齐 ${boxed}/${required}` : `已备齐 ${total}/${required} · 记得入箱`;
  }

  const remaining = required - total;

  if (boxed > 0 || backpack > 0) {
    return `背包${backpack} · 箱内${boxed} · 还差${remaining}`;
  }

  return `还差${remaining} · 去种/买`;
}

export function orderDeadlineHint({
  accepted,
  completed,
  ready,
  remainingCount,
  timeMinutes,
}: {
  accepted: boolean;
  completed: boolean;
  ready: boolean;
  remainingCount: number;
  timeMinutes: number;
}) {
  const remaining = normalizeXp(remainingCount);
  const time = normalizeXp(timeMinutes);

  if (completed) {
    return "今日已交付";
  }

  if (!accepted) {
    return "今日接单 · 睡前结算";
  }

  if (ready) {
    return "已备齐 · 睡前入箱";
  }

  if (time >= 21 * 60) {
    return `夜里紧急 · 还差 ${remaining} 件`;
  }

  if (time >= 18 * 60) {
    return `傍晚收尾 · 还差 ${remaining} 件`;
  }

  return `今日截止 · 还差 ${remaining} 件`;
}

export function dailyAdvice({
  weather,
  orderAccepted,
  orderCompleted,
  orderStreak,
  lowestMastery,
}: {
  weather: "sunny" | "rain" | "mist";
  orderAccepted: boolean;
  orderCompleted: boolean;
  orderStreak: number;
  lowestMastery: MasteryTrackId;
}) {
  if (orderAccepted && !orderCompleted) {
    return `先完成公告板委托，连击 ${normalizeXp(orderStreak)} 天会越滚越值钱。`;
  }

  if (weather === "rain") {
    return "雨天省下浇水体力，适合多播种、钓鱼或拜访邻里。";
  }

  if (weather === "mist") {
    return "雾天节奏慢，先看日志，把路程短的采集和社交做掉。";
  }

  const masteryHints: Record<MasteryTrackId, string> = {
    farming: "今天适合多照看田地，把耕作熟练度补起来。",
    foraging: "路过树篱和镇边时多采集，采集熟练会带来额外收获。",
    fishing: "傍晚去水边抛竿，钓鱼熟练会让好鱼更常出现。",
    social: "找镇民聊天或送礼，邻里关系会回馈农场经营。",
  };

  return masteryHints[lowestMastery];
}

export function mailboxResultHint({
  message,
  seedBonus,
  nextObjectiveLabel,
}: {
  message: string;
  seedBonus: number;
  nextObjectiveLabel: string;
}) {
  const text = message.trim() || "今天没有新信";
  const seeds = normalizeXp(seedBonus);
  const objective = nextObjectiveLabel.trim() || "整理农场";
  const reward = seeds > 0 ? ` · 萝卜种子+${seeds}` : "";

  return `${text}${reward} · 下一步${objective}`;
}

export function dayPeriod(timeMinutes: number): DayPeriod {
  const time = normalizeXp(timeMinutes);

  if (time >= 24 * 60) {
    return { id: "late", label: "深夜" };
  }

  if (time >= 21 * 60) {
    return { id: "night", label: "夜里" };
  }

  if (time >= 17 * 60) {
    return { id: "evening", label: "傍晚" };
  }

  if (time >= 12 * 60) {
    return { id: "afternoon", label: "午后" };
  }

  return { id: "morning", label: "上午" };
}

export function energyStatus(energy: number, maxEnergy: number): EnergyStatus {
  const maximum = Math.max(1, normalizeXp(maxEnergy));
  const current = Math.min(maximum, normalizeXp(energy));
  const ratio = current / maximum;

  if (ratio >= 1) {
    return { id: "full", label: "满格", hint: "适合出门做重活", ratio };
  }

  if (ratio <= 0.15) {
    return { id: "exhausted", label: "快见底", hint: "按 R 或吃背包点心", ratio };
  }

  if (ratio <= 0.35) {
    return { id: "tired", label: "疲惫", hint: "留体力回家睡觉", ratio };
  }

  return { id: "steady", label: "充沛", hint: "还能安排几件事", ratio };
}

export function fishingConditionHint({
  weather,
  timeMinutes,
  pondLights,
}: {
  weather: "sunny" | "rain" | "mist";
  timeMinutes: number;
  pondLights: boolean;
}) {
  const time = normalizeXp(timeMinutes);

  if (pondLights && time >= 18 * 60 && time < 23 * 60) {
    return "夜灯好钓";
  }

  if (weather === "rain") {
    return "雨天好鱼";
  }

  if (time >= 17 * 60 && time < 21 * 60) {
    return "傍晚鱼活";
  }

  if (weather === "mist") {
    return "雾天稳钓";
  }

  return "普通鱼情";
}

export function weatherPlanHint({
  weather,
  plantedCount,
  dryCount,
  seedCount,
}: {
  weather: "sunny" | "rain" | "mist";
  plantedCount: number;
  dryCount: number;
  seedCount: number;
}) {
  const planted = normalizeXp(plantedCount);
  const dry = Math.min(planted, normalizeXp(dryCount));
  const seeds = normalizeXp(seedCount);

  if (weather === "rain") {
    if (seeds > 0) {
      return `雨天代浇 · 可扩种 ${seeds} 粒`;
    }

    return planted > 0 ? "雨天代浇 · 省体力跑镇" : "雨天省体力 · 钓鱼采集";
  }

  if (weather === "mist") {
    return dry > 0 ? `雾天慢节奏 · 先浇 ${dry} 块` : "雾天慢节奏 · 适合拜访";
  }

  if (dry > 0) {
    return `晴天要浇 ${dry} 块 · 预留体力`;
  }

  return seeds > 0 ? `晴天稳种 · 还带 ${seeds} 粒种子` : "晴天稳工 · 采集补金";
}

export function forecastSummaryHint({
  seasonName,
  weatherName,
  weatherNote,
  weatherPlan,
  advice,
}: {
  seasonName: string;
  weatherName: string;
  weatherNote: string;
  weatherPlan: string;
  advice: string;
}) {
  const season = seasonName.trim() || "明天";
  const weather = weatherName.trim() || "天气未知";
  const note = weatherNote.trim() || "按日志安排一天。";
  const plan = weatherPlan.trim() || "先看田地";
  const tip = advice.trim() || "保持节奏，睡前记得入箱。";

  return `明天是${season} · ${weather}。${note} ${plan}。${tip}`;
}

export function weatherHudPlanHint({
  weatherName,
  weatherPlan,
}: {
  weatherName: string;
  weatherPlan: string;
}) {
  const weather = weatherName.trim() || "天气";
  const plan = (weatherPlan.trim() || "按日志安排")
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");

  return `${weather} · ${plan}`;
}

export function travelPlanHint({
  target,
  orderNeedsBoard,
  giftReadyCount,
  seedShortage,
  sellableInventoryCount,
  timeMinutes,
}: {
  target: TravelTarget;
  orderNeedsBoard: boolean;
  giftReadyCount: number;
  seedShortage: number;
  sellableInventoryCount: number;
  timeMinutes: number;
}) {
  const gifts = normalizeXp(giftReadyCount);
  const seedNeed = normalizeXp(seedShortage);
  const sellables = normalizeXp(sellableInventoryCount);
  const late = normalizeXp(timeMinutes) >= 21 * 60;

  if (target === "town") {
    if (orderNeedsBoard) {
      return "公告板优先";
    }

    return gifts > 0 ? `带礼拜访 ${gifts} 件` : late ? "夜里收尾" : "拜访/采集";
  }

  if (target === "shop") {
    return seedNeed > 0 ? `补种子 ${seedNeed} 包` : "看种子价格";
  }

  if (target === "farm") {
    return sellables > 0 ? `回农场入箱 ${sellables} 件` : seedNeed > 0 ? "回农场播种" : "回农场照看田";
  }

  return late ? "回家睡觉" : sellables > 0 ? "回家前先入箱" : "回家整理";
}

export function travelArrivalHint({
  target,
  plan,
  arrivalTimeMinutes,
}: {
  target: TravelTarget;
  plan: string;
  arrivalTimeMinutes: number;
}) {
  const labels: Record<TravelTarget, string> = {
    farm: "山间农场",
    home: "山间小屋",
    town: "小镇街道",
    shop: "种子商店",
  };
  const minutes = normalizeXp(arrivalTimeMinutes) % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const purpose = plan.trim() || "整理行程";
  const late = normalizeXp(arrivalTimeMinutes) >= 21 * 60;

  return `抵达${labels[target]} · ${clock} · ${purpose}${late ? " · 夜深了" : ""}`;
}

export function travelArrivalAmbientHint({
  target,
  plan,
  arrivalTimeMinutes,
  weather,
}: {
  target: TravelTarget;
  plan: string;
  arrivalTimeMinutes: number;
  weather: "sunny" | "rain" | "mist";
}) {
  const rawMinutes = normalizeXp(arrivalTimeMinutes);
  const minutes = rawMinutes % (24 * 60);
  const purpose = plan.trim() || "整理行程";
  const late = rawMinutes >= 21 * 60;
  const evening = minutes >= 17 * 60 && minutes < 21 * 60;
  const air = late ? "虫鸣收尾" : weather === "rain" ? "雨声铺路" : weather === "mist" ? "雾气压低" : "脚步落稳";
  const scene = late
    ? target === "home"
      ? "屋灯暖着"
      : "夜色收尾"
    : target === "farm"
      ? weather === "rain"
        ? "泥土湿润"
        : evening
          ? "田埂金光"
          : "农场鸟鸣"
      : target === "town"
        ? weather === "rain"
          ? "街檐雨声"
          : "镇口人声"
        : target === "shop"
          ? "柜台木铃"
          : "屋里安静";
  const next = late ? (target === "home" ? "直接睡" : target === "farm" ? "先入箱再回家" : "别逗留") : purpose;

  return `到达氛围 · ${scene} · ${air} · ${next}`;
}

export function travelObjectiveArrivalPlan({
  plan,
  objectiveLabel,
  arrivedAtObjective,
}: {
  plan: string;
  objectiveLabel: string;
  arrivedAtObjective: boolean;
}) {
  const purpose = plan.trim() || "整理行程";
  const objective = objectiveLabel.trim();

  if (!arrivedAtObjective || !objective) {
    return purpose;
  }

  return `${objective} · ${purpose}`;
}

export function transitionObjectivePromptHint({
  plan,
  objectiveLabel,
  targetIsObjective,
}: {
  plan: string;
  objectiveLabel: string;
  targetIsObjective: boolean;
}) {
  const purpose = plan.trim() || "整理行程";
  const objective = objectiveLabel.trim();

  if (!targetIsObjective || !objective) {
    return purpose;
  }

  return `目标${objective} · ${purpose}`;
}

export function transitionArrivalRiskHint({
  timeMinutes,
  travelMinutes,
}: {
  timeMinutes: number;
  travelMinutes: number;
}) {
  const arrival = normalizeXp(timeMinutes) + Math.max(0, normalizeXp(travelMinutes));

  if (arrival >= 24 * 60) {
    return "抵达已过午夜";
  }

  if (arrival >= 21 * 60) {
    return "抵达夜深";
  }

  return "抵达安全";
}

export function transitionDepartureChecklistHint({
  target,
  sellableInventoryCount,
  giftReadyCount,
  seedShortage,
  timeMinutes,
}: {
  target: TravelTarget;
  sellableInventoryCount: number;
  giftReadyCount: number;
  seedShortage: number;
  timeMinutes: number;
}) {
  const sellables = normalizeXp(sellableInventoryCount);
  const gifts = normalizeXp(giftReadyCount);
  const seeds = normalizeXp(seedShortage);
  const late = normalizeXp(timeMinutes) >= 21 * 60;

  if (target === "home" && late) {
    return "出发前 · 回家睡觉";
  }

  if (target === "farm" && sellables > 0) {
    return `出发前 · 回农场入箱${sellables}件`;
  }

  if (target === "town" && gifts > 0) {
    return `出发前 · 带礼${gifts}件`;
  }

  if (target === "shop" && seeds > 0) {
    return `出发前 · 补种缺${seeds}包`;
  }

  if (late && sellables > 0) {
    return `出发前 · 先入箱${sellables}件`;
  }

  return "出发前 · 路线清晰";
}

export function transitionTravelPromptHint({
  actionLabel,
  plan,
  objectiveLabel,
  targetIsObjective,
  timeMinutes,
  travelMinutes,
  departureHint,
}: {
  actionLabel: string;
  plan: string;
  objectiveLabel: string;
  targetIsObjective: boolean;
  timeMinutes: number;
  travelMinutes: number;
  departureHint?: string;
}) {
  const action = actionLabel.trim() || "移动";
  const duration = Math.max(0, normalizeXp(travelMinutes));
  const arrival = (normalizeXp(timeMinutes) + duration) % (24 * 60);
  const hour = Math.floor(arrival / 60);
  const minute = arrival % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const objectivePrompt = transitionObjectivePromptHint({ plan, objectiveLabel, targetIsObjective });
  const risk = transitionArrivalRiskHint({ timeMinutes, travelMinutes });
  const riskText = risk === "抵达安全" ? "" : ` · ${risk}`;
  const departure = departureHint?.trim();
  const departureText = departure ? ` · ${departure}` : "";

  return `${action} ${duration}分 到${clock} · ${objectivePrompt}${riskText}${departureText}`;
}

export function calendarPlanHint({
  eventTitle,
  daysUntil,
  currentPlace,
  timeMinutes,
  giftReadyCount = 0,
}: {
  eventTitle: string;
  daysUntil: number;
  currentPlace: TravelTarget;
  timeMinutes: number;
  giftReadyCount?: number;
}) {
  const title = eventTitle.trim();
  const days = normalizeXp(daysUntil);
  const gifts = normalizeXp(giftReadyCount);
  const today = days === 0;
  const prefix = today ? "今日" : `${days}天后`;

  if (title === "山风集市") {
    return today
      ? currentPlace === "town" || currentPlace === "shop"
        ? "今日集市 · 公告板顺路接单"
        : "今日集市 · 去小镇看委托"
      : `${prefix}集市 · 留作物冲订单`;
  }

  if (title === "溪畔夜灯") {
    if (!today) {
      return `${prefix}夜灯 · 留体力钓鱼`;
    }

    return normalizeXp(timeMinutes) >= 18 * 60 ? "夜灯正亮 · 去池塘抛竿" : "今日夜灯 · 傍晚留体力";
  }

  if (title === "邻里茶会") {
    if (!today) {
      return `${prefix}茶会 · 备礼物`;
    }

    return gifts > 0 ? `今日茶会 · 带礼拜访 ${gifts} 件` : "今日茶会 · 去小镇聊天";
  }

  return today ? "今日无特别安排 · 按日志推进" : `${prefix}${title || "活动"} · 提前安排路线`;
}

export function calendarEventActionHint({
  eventTitle,
  daysUntil,
  currentPlace,
  giftReadyCount,
  orderAccepted,
  sellableInventoryCount,
  energy,
  timeMinutes,
}: {
  eventTitle: string;
  daysUntil: number;
  currentPlace: TravelTarget;
  giftReadyCount: number;
  orderAccepted: boolean;
  sellableInventoryCount: number;
  energy: number;
  timeMinutes: number;
}) {
  const title = eventTitle.trim();
  const today = normalizeXp(daysUntil) === 0;
  const gifts = normalizeXp(giftReadyCount);
  const sellables = normalizeXp(sellableInventoryCount);
  const stamina = normalizeXp(energy);
  const townSide = currentPlace === "town" || currentPlace === "shop";

  if (title === "山风集市") {
    if (!today) {
      return sellables > 0 ? `准备 · 留${sellables}件作物` : "准备 · 种作物备委托";
    }

    if (!townSide) {
      return "行动 · 去小镇公告板";
    }

    return orderAccepted ? (sellables > 0 ? "行动 · 留作物入箱" : "行动 · 看委托进度") : "行动 · 接公告板";
  }

  if (title === "溪畔夜灯") {
    if (!today) {
      return "准备 · 留体力和鱼竿";
    }

    if (normalizeXp(timeMinutes) < 18 * 60) {
      return `行动 · 傍晚留${stamina}体钓鱼`;
    }

    return currentPlace === "farm" ? "行动 · 池塘抛竿" : "行动 · 回农场池塘";
  }

  if (title === "邻里茶会") {
    if (!today) {
      return gifts > 0 ? `准备 · 留礼物${gifts}件` : "准备 · 采集作礼物";
    }

    if (gifts === 0) {
      return "行动 · 先采收备礼";
    }

    return townSide ? `行动 · 送礼${gifts}件` : "行动 · 去小镇送礼";
  }

  return today ? "行动 · 按日志推进" : "准备 · 规划路线";
}

export function calendarEventRouteHint({
  eventTitle,
  daysUntil,
  currentPlace,
  timeMinutes,
  travelMinutes,
  giftReadyCount = 0,
}: {
  eventTitle: string;
  daysUntil: number;
  currentPlace: TravelTarget;
  timeMinutes: number;
  travelMinutes: number;
  giftReadyCount?: number;
}) {
  const title = eventTitle.trim();
  const today = normalizeXp(daysUntil) === 0;
  const gifts = normalizeXp(giftReadyCount);
  const duration = Math.max(0, normalizeXp(travelMinutes));
  const arrival = normalizeXp(timeMinutes) + duration;
  const wrapped = arrival % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const placeLabels = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  } satisfies Record<TravelTarget, string>;
  const targetByEvent: Record<string, TravelTarget> = {
    山风集市: "town",
    邻里茶会: "town",
    溪畔夜灯: "farm",
  };
  const target = targetByEvent[title] ?? currentPlace;

  if (!today) {
    if (title === "山风集市") {
      return `${normalizeXp(daysUntil)}天后路线 · 先留作物`;
    }

    if (title === "邻里茶会") {
      return gifts > 0 ? `${normalizeXp(daysUntil)}天后路线 · 备礼${gifts}件` : `${normalizeXp(daysUntil)}天后路线 · 先采礼`;
    }

    if (title === "溪畔夜灯") {
      return `${normalizeXp(daysUntil)}天后路线 · 傍晚回农场`;
    }

    return `${normalizeXp(daysUntil)}天后路线 · 先看日志`;
  }

  const route = currentPlace === target
    ? `已在${placeLabels[target]}`
    : `去${placeLabels[target]}到${clock}`;

  if (title === "山风集市") {
    return `今日路线 · ${route} · 接公告板`;
  }

  if (title === "邻里茶会") {
    return gifts > 0 ? `今日路线 · ${route} · 带礼${gifts}件` : `今日路线 · ${route} · 先聊天`;
  }

  if (title === "溪畔夜灯") {
    return normalizeXp(timeMinutes) >= 18 * 60
      ? `今日路线 · ${route} · 池塘抛竿`
      : `今日路线 · ${route} · 18:00后池塘`;
  }

  return `今日路线 · ${route} · 按日志推进`;
}

export function calendarEventUrgencyHint({
  eventTitle,
  daysUntil,
  currentPlace,
  timeMinutes,
  travelMinutes,
  giftReadyCount = 0,
  sellableInventoryCount = 0,
  energy = 0,
}: {
  eventTitle: string;
  daysUntil: number;
  currentPlace: TravelTarget;
  timeMinutes: number;
  travelMinutes: number;
  giftReadyCount?: number;
  sellableInventoryCount?: number;
  energy?: number;
}) {
  const title = eventTitle.trim();
  const days = normalizeXp(daysUntil);
  const today = days === 0;
  const gifts = normalizeXp(giftReadyCount);
  const sellables = normalizeXp(sellableInventoryCount);
  const stamina = normalizeXp(energy);
  const minutes = normalizeXp(timeMinutes);
  const targetByEvent: Record<string, TravelTarget> = {
    山风集市: "town",
    邻里茶会: "town",
    溪畔夜灯: "farm",
  };
  const placeLabels = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  } satisfies Record<TravelTarget, string>;
  const target = targetByEvent[title] ?? currentPlace;
  const arrival = currentPlace === target ? minutes : minutes + Math.max(0, normalizeXp(travelMinutes));
  const wrapped = arrival % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const route = currentPlace === target ? `已在${placeLabels[target]}` : `去${placeLabels[target]}${clock}`;

  if (!title) {
    return today ? "日历 · 今日自由经营" : `日历 · ${days}天后看日志`;
  }

  if (!today) {
    if (title === "山风集市") {
      return sellables > 0 ? `日历 · ${days}天后集市 · 留${sellables}件` : `日历 · ${days}天后集市 · 备作物`;
    }

    if (title === "邻里茶会") {
      return gifts > 0 ? `日历 · ${days}天后茶会 · 留${gifts}礼` : `日历 · ${days}天后茶会 · 采礼`;
    }

    if (title === "溪畔夜灯") {
      return stamina >= 35 ? `日历 · ${days}天后夜灯 · 留体力` : `日历 · ${days}天后夜灯 · 少劳作`;
    }

    return `日历 · ${days}天后${title}`;
  }

  if (title === "溪畔夜灯") {
    if (minutes >= 23 * 60) {
      return "日历 · 夜灯将熄 · 回家收尾";
    }

    if (minutes < 18 * 60) {
      return `日历 · 夜灯18:00 · 留${stamina}体`;
    }

    return currentPlace === "farm" ? "日历 · 夜灯进行中 · 池塘" : `日历 · 夜灯进行中 · ${route}`;
  }

  if (arrival >= 21 * 60) {
    return `日历 · ${title}将错过 · 明日复盘`;
  }

  if (title === "山风集市") {
    return currentPlace === "town" || currentPlace === "shop" ? "日历 · 集市进行中 · 公告板" : `日历 · 集市 · ${route}`;
  }

  if (title === "邻里茶会") {
    const action = gifts > 0 ? `带礼${gifts}` : "先采礼";

    return currentPlace === "town" || currentPlace === "shop" ? `日历 · 茶会进行中 · ${action}` : `日历 · 茶会 · ${route}${gifts > 0 ? `带礼${gifts}` : ""}`;
  }

  return `日历 · 今日${title} · ${route}`;
}

export function calendarSocialPrepHint({
  eventTitle,
  daysUntil,
  currentPlace,
  giftReadyCount,
  samePlaceCount,
  talkedToday,
  giftedToday,
  timeMinutes,
}: {
  eventTitle: string;
  daysUntil: number;
  currentPlace: TravelTarget;
  giftReadyCount: number;
  samePlaceCount: number;
  talkedToday: boolean;
  giftedToday: boolean;
  timeMinutes: number;
}) {
  const title = eventTitle.trim();
  const today = normalizeXp(daysUntil) === 0;
  const gifts = normalizeXp(giftReadyCount);
  const nearby = normalizeXp(samePlaceCount);
  const townSide = currentPlace === "town" || currentPlace === "shop";
  const late = normalizeXp(timeMinutes) >= 21 * 60;

  if (giftedToday) {
    return "社交 · 今日已送礼";
  }

  if (title === "邻里茶会") {
    if (!today) {
      return gifts > 0 ? `茶会准备 · 留${gifts}份礼` : "茶会准备 · 采集礼物";
    }

    if (gifts > 0) {
      return townSide ? `茶会行动 · 送${gifts}份礼` : "茶会行动 · 去小镇带礼";
    }

    return "茶会行动 · 先聊天采礼";
  }

  if (late && gifts === 0) {
    return "社交 · 夜深明日访";
  }

  if (gifts > 0 && nearby > 0) {
    return `社交 · 身边${nearby}人可送`;
  }

  if (gifts > 0) {
    return "社交 · 带礼找镇民";
  }

  if (talkedToday) {
    return "社交 · 明日再带礼";
  }

  return "社交 · 先聊天";
}

export function festivalReadinessHint({
  eventTitle,
  daysUntil,
  currentPlace,
  sellableInventoryCount,
  giftReadyCount,
  energy,
  timeMinutes,
}: {
  eventTitle: string;
  daysUntil: number;
  currentPlace: TravelTarget;
  sellableInventoryCount: number;
  giftReadyCount: number;
  energy: number;
  timeMinutes: number;
}) {
  const title = eventTitle.trim();
  const today = normalizeXp(daysUntil) === 0;
  const sellables = normalizeXp(sellableInventoryCount);
  const gifts = normalizeXp(giftReadyCount);
  const stamina = normalizeXp(energy);
  const minutes = normalizeXp(timeMinutes);
  const townSide = currentPlace === "town" || currentPlace === "shop";

  if (title === "山风集市") {
    if (!today) {
      return sellables > 0 ? `节日准备 · 留${sellables}件作物` : "节日准备 · 种作物冲订单";
    }

    return townSide ? "节日就绪 · 公告板顺路" : "节日行动 · 去小镇公告板";
  }

  if (title === "溪畔夜灯") {
    if (!today) {
      return stamina >= 35 ? "节日准备 · 留体力钓鱼" : "节日准备 · 少劳作保体力";
    }

    if (minutes < 18 * 60) {
      return `节日准备 · 傍晚前留${stamina}体`;
    }

    return currentPlace === "farm" ? "节日就绪 · 池塘抛竿" : "节日行动 · 回农场池塘";
  }

  if (title === "邻里茶会") {
    if (!today) {
      return gifts > 0 ? `节日准备 · 留${gifts}份礼` : "节日准备 · 采集礼物";
    }

    if (gifts === 0) {
      return "节日行动 · 先采礼再访";
    }

    return townSide ? `节日就绪 · 送${gifts}份礼` : "节日行动 · 去小镇带礼";
  }

  return today ? "节日 · 按日志参与" : "节日准备 · 看日历";
}

export function festivalChecklistHint({
  eventTitle,
  daysUntil,
  currentPlace,
  sellableInventoryCount,
  giftReadyCount,
  energy,
  timeMinutes,
  travelMinutes,
}: {
  eventTitle: string;
  daysUntil: number;
  currentPlace: TravelTarget;
  sellableInventoryCount: number;
  giftReadyCount: number;
  energy: number;
  timeMinutes: number;
  travelMinutes: number;
}) {
  const title = eventTitle.trim();
  const today = normalizeXp(daysUntil) === 0;
  const gifts = normalizeXp(giftReadyCount);
  const sellables = normalizeXp(sellableInventoryCount);
  const stamina = normalizeXp(energy);
  const townSide = currentPlace === "town" || currentPlace === "shop";
  const farmSide = currentPlace === "farm" || currentPlace === "home";
  const arrival = normalizeXp(timeMinutes) + Math.max(0, normalizeXp(travelMinutes));
  const wrapped = arrival % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

  if (title === "山风集市") {
    if (!today) {
      return sellables > 0 ? `清单 · 留作物${sellables}件` : "清单 · 种/收可售物";
    }

    return townSide ? "清单 · 公告板+委托" : `清单 · 去小镇${clock}`;
  }

  if (title === "溪畔夜灯") {
    if (!today) {
      return stamina >= 35 ? "清单 · 留35体钓鱼" : "清单 · 明日少耗体";
    }

    if (normalizeXp(timeMinutes) < 18 * 60) {
      return `清单 · 18:00池塘 · 留${stamina}体`;
    }

    return farmSide ? "清单 · 鱼竿池塘" : `清单 · 回农场${clock}`;
  }

  if (title === "邻里茶会") {
    if (!today) {
      return gifts > 0 ? `清单 · 留礼${gifts}件` : "清单 · 采礼1件";
    }

    if (gifts === 0) {
      return "清单 · 先采礼1件";
    }

    return townSide ? `清单 · 送礼${gifts}件` : `清单 · 去小镇${clock}`;
  }

  return "清单 · 看日历";
}

export function dailyObjectiveHint({
  mailRead,
  orderAccepted,
  orderCompleted,
  plantedCount,
  wateredCount,
  socialDone,
  shippedCount,
  timeMinutes,
  energy,
}: {
  mailRead: boolean;
  orderAccepted: boolean;
  orderCompleted: boolean;
  plantedCount: number;
  wateredCount: number;
  socialDone: boolean;
  shippedCount: number;
  timeMinutes: number;
  energy: number;
}): DailyObjectiveHint {
  if (!mailRead) {
    return { id: "mail", label: "读信看天", detail: "先确认邮箱和天气" };
  }

  if (!orderAccepted && !orderCompleted) {
    return { id: "order", label: "接公告板", detail: "去小镇接今日委托" };
  }

  if (normalizeXp(plantedCount) === 0) {
    return { id: "field", label: "开垦播种", detail: "先种下今天的作物" };
  }

  if (normalizeXp(wateredCount) < normalizeXp(plantedCount)) {
    return { id: "field", label: "照看田地", detail: `还要浇 ${normalizeXp(plantedCount) - normalizeXp(wateredCount)} 块` };
  }

  if (!socialDone) {
    return { id: "social", label: "拜访邻里", detail: "聊天或送礼推进关系" };
  }

  if (normalizeXp(shippedCount) === 0) {
    return { id: "shipping", label: "睡前入箱", detail: "把收获放进售卖箱" };
  }

  if (normalizeXp(timeMinutes) >= 21 * 60 || normalizeXp(energy) <= 15) {
    return { id: "sleep", label: "回家睡觉", detail: "保存体力和委托连击" };
  }

  return { id: "free", label: "自由经营", detail: "钓鱼、采集或逛小镇" };
}

export function dayStartPlanHint({
  objectiveLabel,
  objectiveDetail,
  weather,
  netGold,
  eventTitle,
}: {
  objectiveLabel: string;
  objectiveDetail: string;
  weather: "sunny" | "rain" | "mist";
  netGold: number;
  eventTitle?: string;
}) {
  const weatherLabels = {
    sunny: "晴天",
    rain: "雨天",
    mist: "雾天",
  } satisfies Record<"sunny" | "rain" | "mist", string>;
  const objective = objectiveLabel.trim() || "整理农场";
  const detail = objectiveDetail.trim();
  const net = normalizeXp(netGold);
  const incomeText = net > 0 ? `昨净+${net}金` : "昨夜无收入";
  const eventText = eventTitle?.trim() ? ` · 今日${eventTitle.trim()}` : "";

  return `${weatherLabels[weather]}开局 · 先${objective}${detail ? `（${detail}）` : ""} · ${incomeText}${eventText}`;
}

export function dayBreakRouteHint({
  objectiveId,
  objectiveLabel,
  timeMinutes,
  travelMinutes,
}: {
  objectiveId: DailyObjectiveId;
  objectiveLabel: string;
  timeMinutes: number;
  travelMinutes: number;
}) {
  const targetByObjective: Record<DailyObjectiveId, TravelTarget> = {
    mail: "home",
    order: "town",
    field: "farm",
    social: "town",
    shipping: "farm",
    sleep: "home",
    free: "farm",
  };

  return objectiveRouteHint({
    objectiveLabel,
    currentPlace: "home",
    targetPlace: targetByObjective[objectiveId],
    timeMinutes,
    travelMinutes,
  });
}

export function dayStartFirstActionHint({
  objectiveId,
  weather,
  seedCount,
  openPlotCount,
  giftReadyCount,
  sellableInventoryCount,
  eventTitle,
}: {
  objectiveId: DailyObjectiveId;
  weather: "sunny" | "rain" | "mist";
  seedCount: number;
  openPlotCount: number;
  giftReadyCount: number;
  sellableInventoryCount: number;
  eventTitle?: string;
}) {
  const event = eventTitle?.trim();
  const seeds = normalizeXp(seedCount);
  const openPlots = normalizeXp(openPlotCount);
  const gifts = normalizeXp(giftReadyCount);
  const sellables = normalizeXp(sellableInventoryCount);

  if (event && gifts > 0) {
    return `清晨 · 带${gifts}份礼物去${event}`;
  }

  if (objectiveId === "mail") {
    return "清晨 · 先读邮箱/天气";
  }

  if (objectiveId === "order") {
    return "清晨 · 去公告板接委托";
  }

  if (objectiveId === "field" && weather === "rain") {
    return "清晨 · 雨天免浇，收获/播种";
  }

  if (objectiveId === "field" && seeds > 0 && openPlots > 0) {
    return `清晨 · 选种播${Math.min(seeds, openPlots)}块`;
  }

  if (objectiveId === "social" && gifts > 0) {
    return `清晨 · 带${gifts}份礼物去小镇`;
  }

  if (objectiveId === "shipping" && sellables > 0) {
    return `清晨 · 睡前入箱${sellables}件`;
  }

  return "清晨 · 按日志推进";
}

export function objectiveMapMarkerHint({
  objectiveLabel,
  currentPlace,
  targetPlace,
  timeMinutes,
  travelMinutes,
}: {
  objectiveLabel: string;
  currentPlace: TravelTarget;
  targetPlace: TravelTarget;
  timeMinutes?: number;
  travelMinutes?: number;
}) {
  const placeLabels = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  } satisfies Record<TravelTarget, string>;
  const objective = (objectiveLabel.trim() || "当前目标").slice(0, 12);

  if (currentPlace === targetPlace) {
    return `目标在这里 · ${objective}`;
  }

  if (timeMinutes !== undefined && travelMinutes !== undefined) {
    const arrivalMinutes = normalizeXp(timeMinutes) + Math.max(0, normalizeXp(travelMinutes));
    const wrapped = arrivalMinutes % (24 * 60);
    const hour = Math.floor(wrapped / 60);
    const minute = wrapped % 60;
    const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    const risk = arrivalMinutes >= 21 * 60 ? " · 夜深" : "";

    return `目标${objective} · 去${placeLabels[targetPlace]}${clock}${risk}`;
  }

  return `目标${objective} · 去${placeLabels[targetPlace]}`;
}

export function objectiveMapActionHint({
  objectiveLabel,
  objectiveDetail,
  currentPlace,
  targetPlace,
  timeMinutes,
  travelMinutes,
}: {
  objectiveLabel: string;
  objectiveDetail: string;
  currentPlace: TravelTarget;
  targetPlace: TravelTarget;
  timeMinutes: number;
  travelMinutes: number;
}) {
  const placeLabels = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  } satisfies Record<TravelTarget, string>;
  const objective = (objectiveLabel.trim() || "当前目标").slice(0, 12);
  const detail = objectiveDetail.trim().slice(0, 13);

  if (currentPlace === targetPlace) {
    return detail ? `在这里 · ${objective} · ${detail}` : `在这里 · ${objective}`;
  }

  const arrivalMinutes = normalizeXp(timeMinutes) + Math.max(0, normalizeXp(travelMinutes));
  const minutes = arrivalMinutes % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const route = `去${placeLabels[targetPlace]} · 到${clock}`;

  if (arrivalMinutes >= 21 * 60) {
    return `${route} · 夜深`;
  }

  return `${route} · ${objective}`;
}

export function objectiveHudSummaryHint({
  objectiveLabel,
  objectiveDetail,
}: {
  objectiveLabel: string;
  objectiveDetail: string;
}) {
  const label = objectiveLabel.trim() || "当前目标";
  const detail = objectiveDetail.trim();
  const summary = detail ? `${label} · ${detail}` : label;

  return `目标 ${summary.slice(0, 22)}`;
}

export function objectiveRouteHint({
  objectiveLabel,
  currentPlace,
  targetPlace,
  timeMinutes,
  travelMinutes,
}: {
  objectiveLabel: string;
  currentPlace: TravelTarget;
  targetPlace: TravelTarget;
  timeMinutes: number;
  travelMinutes: number;
}) {
  const labels: Record<TravelTarget, string> = {
    farm: "农场",
    home: "小屋",
    town: "小镇",
    shop: "商店",
  };
  const objective = objectiveLabel.trim() || "当前目标";

  if (currentPlace === targetPlace) {
    return `就地处理 · ${labels[currentPlace]} · ${objective}`;
  }

  const arrivalMinutes = normalizeXp(timeMinutes) + Math.max(0, normalizeXp(travelMinutes));
  const minutes = arrivalMinutes % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const late = arrivalMinutes >= 21 * 60;

  return `${labels[currentPlace]}→${labels[targetPlace]} · 到${clock} · ${objective}${late ? " · 夜深" : ""}`;
}

export function questClueRouteHint({
  questTitle,
  questHint,
  completedCount,
  totalCount,
  complete,
  currentPlace,
  targetPlace,
  timeMinutes,
  travelMinutes,
}: {
  questTitle: string;
  questHint: string;
  completedCount: number;
  totalCount: number;
  complete: boolean;
  currentPlace: TravelTarget;
  targetPlace: TravelTarget;
  timeMinutes: number;
  travelMinutes: number;
}) {
  const completed = normalizeXp(completedCount);
  const total = Math.max(1, normalizeXp(totalCount));

  if (complete) {
    return `线索完成 ${completed}/${total} · 自由经营`;
  }

  const title = questTitle.trim() || "当前线索";
  const hint = questHint.trim() || "按日志推进";
  const route = objectiveRouteHint({
    objectiveLabel: title,
    currentPlace,
    targetPlace,
    timeMinutes,
    travelMinutes,
  });
  const focus = currentPlace === targetPlace ? "就地触发" : "先去地点";

  return `线索 ${completed}/${total} · ${focus} · ${route} · ${hint}`;
}

export function bedtimeWarning({
  orderAccepted,
  orderCompleted,
  shippedForOrder,
  orderCount,
  timeMinutes,
  energy,
  sellableInventoryCount = 0,
}: {
  orderAccepted: boolean;
  orderCompleted: boolean;
  shippedForOrder: number;
  orderCount: number;
  timeMinutes: number;
  energy: number;
  sellableInventoryCount?: number;
}) {
  if (orderAccepted && !orderCompleted && normalizeXp(shippedForOrder) < normalizeXp(orderCount)) {
    return `委托还差 ${Math.max(0, normalizeXp(orderCount) - normalizeXp(shippedForOrder))} 件，睡觉会断掉连击。`;
  }

  if (normalizeXp(timeMinutes) >= 24 * 60) {
    return "已经很晚了，再拖下去可能会在外面昏倒。";
  }

  if (normalizeXp(energy) <= 12) {
    return "体力快见底了，适合收尾、入箱，然后回家睡觉。";
  }

  if (normalizeXp(sellableInventoryCount) > 0) {
    return `背包还有 ${normalizeXp(sellableInventoryCount)} 件可售物，睡前去售卖箱更安心。`;
  }

  return "今天的节奏不错，确认入箱后就能安心睡觉。";
}

export function bedtimeChecklistHint({
  orderAccepted,
  orderCompleted,
  orderReady,
  shippedCount,
  sellableInventoryCount,
  energy,
  timeMinutes,
}: {
  orderAccepted: boolean;
  orderCompleted: boolean;
  orderReady: boolean;
  shippedCount: number;
  sellableInventoryCount: number;
  energy: number;
  timeMinutes: number;
}) {
  const parts = [
    orderAccepted && !orderCompleted ? orderReady ? "委托可交" : "委托未齐" : undefined,
    normalizeXp(shippedCount) > 0 ? `箱内${normalizeXp(shippedCount)}件` : undefined,
    normalizeXp(sellableInventoryCount) > 0 ? `背包${normalizeXp(sellableInventoryCount)}件可售` : undefined,
    normalizeXp(energy) <= 12 ? "体力低" : undefined,
    normalizeXp(timeMinutes) >= 24 * 60 ? "深夜" : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "可安心睡";
}

export function bedtimeReadinessHint({
  checklist,
  expectedGold,
  orderWillComplete,
  timeMinutes,
}: {
  checklist: string;
  expectedGold: number;
  orderWillComplete: boolean;
  timeMinutes: number;
}) {
  const parts = [(checklist.trim() || "可安心睡").slice(0, 36)];
  const gold = normalizeXp(expectedGold);
  const minutes = normalizeXp(timeMinutes);

  if (gold > 0) {
    parts.push(`睡醒+${gold}金`);
  }

  if (orderWillComplete) {
    parts.push("委托连击保留");
  }

  if (minutes >= 24 * 60) {
    parts.push("马上睡防昏倒");
  } else if (minutes >= 21 * 60) {
    parts.push("夜深建议睡");
  }

  parts.push("明早满体力");

  return parts.join(" · ");
}

export function bedtimeShippingReminderHint({
  sellableInventoryCount,
  sellableInventoryGold,
  boxedItemCount,
  boxedGold,
  orderWillComplete,
  timeMinutes,
}: {
  sellableInventoryCount: number;
  sellableInventoryGold: number;
  boxedItemCount: number;
  boxedGold: number;
  orderWillComplete: boolean;
  timeMinutes: number;
}) {
  const sellables = normalizeXp(sellableInventoryCount);
  const sellableGold = normalizeXp(sellableInventoryGold);
  const boxed = normalizeXp(boxedItemCount);
  const boxGold = normalizeXp(boxedGold);
  const late = normalizeXp(timeMinutes) >= 21 * 60;

  if (sellables > 0) {
    const urgency = late ? "夜深先入箱" : "先去售卖箱";
    const gold = sellableGold > 0 ? `/${sellableGold}金` : "";

    return `${urgency} · 背包${sellables}件可售${gold}`;
  }

  if (boxed > 0 || boxGold > 0) {
    const order = orderWillComplete ? " · 委托睡醒交付" : "";

    return `保存到清晨 · 箱内${boxed}件/${boxGold}金${order}`;
  }

  return late ? "保存到清晨 · 空箱也该睡" : "保存到清晨";
}

export function dayEndPacingHint({
  timeMinutes,
  energy,
  sellableInventoryCount,
  boxedItemCount,
  boxedGold,
  orderReady,
  orderMissingCount,
  currentPlace,
}: {
  timeMinutes: number;
  energy: number;
  sellableInventoryCount: number;
  boxedItemCount: number;
  boxedGold: number;
  orderReady: boolean;
  orderMissingCount: number;
  currentPlace: TravelTarget;
}) {
  const minutes = normalizeXp(timeMinutes);
  const stamina = normalizeXp(energy);
  const sellables = normalizeXp(sellableInventoryCount);
  const boxed = normalizeXp(boxedItemCount);
  const gold = normalizeXp(boxedGold);
  const missing = normalizeXp(orderMissingCount);
  const place = currentPlace === "home" ? "床边" : currentPlace === "farm" ? "农场" : "先回农场";

  if (minutes >= 24 * 60) {
    return "日末节奏 · 立刻睡觉防昏倒";
  }

  if (orderReady) {
    return `日末节奏 · 委托可结 · ${place}睡醒交付`;
  }

  if (missing > 0 && minutes >= 21 * 60) {
    return `日末节奏 · 委托还差${missing}件 · 保守收尾`;
  }

  if (sellables > 0) {
    return `${minutes >= 21 * 60 ? "日末节奏 · 夜深" : "日末节奏"} · 先入箱${sellables}件`;
  }

  if (boxed > 0 || gold > 0) {
    return `日末节奏 · 箱内${boxed}件/${gold}金 · ${place}睡觉`;
  }

  if (minutes >= 21 * 60 || stamina <= 12) {
    return `日末节奏 · ${place}睡觉`;
  }

  return "日末节奏 · 还能自由经营";
}

export function shippingPreview({
  sellableIncome,
  orderAccepted,
  orderCompleted,
  shippedForOrder,
  orderCount,
  orderReward,
  nextStreakBonus,
}: {
  sellableIncome: number;
  orderAccepted: boolean;
  orderCompleted: boolean;
  shippedForOrder: number;
  orderCount: number;
  orderReward: number;
  nextStreakBonus: number;
}) {
  const orderWillComplete =
    orderAccepted && !orderCompleted && normalizeXp(shippedForOrder) >= normalizeXp(orderCount);
  const earnedOrderReward = orderWillComplete ? normalizeXp(orderReward) : 0;
  const earnedStreakBonus = orderWillComplete ? normalizeXp(nextStreakBonus) : 0;

  return {
    orderWillComplete,
    sellableIncome: normalizeXp(sellableIncome),
    orderReward: earnedOrderReward,
    streakBonus: earnedStreakBonus,
    total: normalizeXp(sellableIncome) + earnedOrderReward + earnedStreakBonus,
  };
}

export function shippingBoxHint({
  itemCount,
  totalGold,
  orderWillComplete,
}: {
  itemCount: number;
  totalGold: number;
  orderWillComplete: boolean;
}) {
  const count = normalizeXp(itemCount);
  const total = normalizeXp(totalGold);

  if (count === 0 && total === 0) {
    return "空箱";
  }

  const base = `${count}件 · ${total}金`;

  return orderWillComplete ? `${base} · 委托可完成` : base;
}

export function shippingActionHint({
  backpackCount,
  boxCount,
  totalGold,
  orderWillComplete,
}: {
  backpackCount: number;
  boxCount: number;
  totalGold: number;
  orderWillComplete: boolean;
}) {
  const backpack = normalizeXp(backpackCount);
  const box = normalizeXp(boxCount);

  if (backpack > 0) {
    return `入箱 背包${backpack}件 · ${shippingBoxHint({ itemCount: backpack + box, totalGold, orderWillComplete })}`;
  }

  if (box > 0) {
    return `箱内已放 ${shippingBoxHint({ itemCount: box, totalGold, orderWillComplete })}`;
  }

  return "售卖箱空";
}

export function shippingBreakdownHint({
  sellableIncome,
  orderReward,
  streakBonus,
}: {
  sellableIncome: number;
  orderReward: number;
  streakBonus: number;
}) {
  const sellable = normalizeXp(sellableIncome);
  const reward = normalizeXp(orderReward);
  const streak = normalizeXp(streakBonus);
  const parts = [
    sellable > 0 ? `售卖${sellable}` : undefined,
    reward > 0 ? `委托${reward}` : undefined,
    streak > 0 ? `连击${streak}` : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "暂无收入";
}

export function shippingDepositHint({
  shippedCount,
  totalGold,
  sellableIncome,
  orderReward,
  streakBonus,
  orderWillComplete,
  timeMinutes,
}: {
  shippedCount: number;
  totalGold: number;
  sellableIncome: number;
  orderReward: number;
  streakBonus: number;
  orderWillComplete: boolean;
  timeMinutes: number;
}) {
  const count = normalizeXp(shippedCount);

  if (count === 0) {
    return "没有可入箱物";
  }

  const total = normalizeXp(totalGold);
  const breakdown = shippingBreakdownHint({ sellableIncome, orderReward, streakBonus });
  const order = orderWillComplete ? " · 委托睡醒交付" : "";
  const bedtime = normalizeXp(timeMinutes) >= 21 * 60 ? " · 可回家睡觉" : "";

  return `入箱${count}件 · 预计${total}金（${breakdown}）${order}${bedtime}`;
}

export function shippingNextStepHint({
  shippedCount,
  expectedGold,
  orderWillComplete,
  timeMinutes,
  energy,
  sellableInventoryCount,
}: {
  shippedCount: number;
  expectedGold: number;
  orderWillComplete: boolean;
  timeMinutes: number;
  energy: number;
  sellableInventoryCount: number;
}) {
  const shipped = normalizeXp(shippedCount);
  const gold = normalizeXp(expectedGold);
  const minutes = normalizeXp(timeMinutes);
  const stamina = normalizeXp(energy);
  const sellables = normalizeXp(sellableInventoryCount);

  if (shipped === 0) {
    return sellables > 0 ? `下一步 · 还有${sellables}件可入箱` : "下一步 · 查日志";
  }

  if (sellables > 0) {
    return `下一步 · 继续入箱${sellables}件`;
  }

  if (orderWillComplete) {
    return "下一步 · 回家睡觉保连击";
  }

  if (minutes >= 21 * 60 || stamina <= 12) {
    return "下一步 · 回家睡觉";
  }

  return gold > 0 ? `下一步 · 明早收款${gold}金` : "下一步 · 查日志";
}

export function shippingUrgencyHint({
  backpackCount,
  boxCount,
  totalGold,
  orderWillComplete,
  timeMinutes,
  energy,
}: {
  backpackCount: number;
  boxCount: number;
  totalGold: number;
  orderWillComplete: boolean;
  timeMinutes: number;
  energy: number;
}) {
  const backpack = normalizeXp(backpackCount);
  const boxed = normalizeXp(boxCount);
  const gold = normalizeXp(totalGold);
  const minutes = normalizeXp(timeMinutes);
  const stamina = normalizeXp(energy);
  const late = minutes >= 21 * 60;

  if (orderWillComplete) {
    return "售卖节奏 · 委托已稳 · 回家睡";
  }

  if (backpack > 0 && late) {
    return `售卖节奏 · 夜深先入箱${backpack}件`;
  }

  if (backpack > 0 && stamina <= 12) {
    return `售卖节奏 · 低体先入箱${backpack}件`;
  }

  if (backpack > 0) {
    return `售卖节奏 · 背包可入${backpack}件`;
  }

  if (boxed > 0 || gold > 0) {
    return `售卖节奏 · 明早收${gold}金`;
  }

  return "售卖节奏 · 箱空不急";
}

export function backpackValueHint({
  itemCount,
  totalGold,
}: {
  itemCount: number;
  totalGold: number;
}) {
  const count = normalizeXp(itemCount);
  const total = normalizeXp(totalGold);

  return count > 0 || total > 0 ? `可售 ${count}件 · ${total}金` : "暂无可售物";
}

export function inventorySlotDetailHint({
  detail,
  count,
  actionLabel,
  safeActionCount,
  safeActionLabel,
  blockedActionLabel,
}: {
  detail: string;
  count: number;
  actionLabel?: string;
  safeActionCount?: number;
  safeActionLabel?: string;
  blockedActionLabel?: string;
}) {
  const base = detail.trim() || "查看";

  if (normalizeXp(count) === 0) {
    return `${base} · 暂无`;
  }

  const action = actionLabel?.trim();
  const safeActions = safeActionCount === undefined ? undefined : normalizeXp(safeActionCount);

  if (action && safeActions !== undefined) {
    if (safeActions === 0) {
      return `${base} · ${blockedActionLabel?.trim() || "别动委托"}`;
    }

    return `${base} · ${(safeActionLabel?.trim() || action)}${safeActions}`;
  }

  return action ? `${base} · ${action}` : base;
}

export function backpackActionHint({
  sellableCount,
  sellableGold,
  snackCount,
  reservedForOrder = 0,
  energy,
  maxEnergy,
}: {
  sellableCount: number;
  sellableGold: number;
  snackCount: number;
  reservedForOrder?: number;
  energy: number;
  maxEnergy: number;
}) {
  const sellables = normalizeXp(sellableCount);
  const gold = normalizeXp(sellableGold);
  const snacks = normalizeXp(snackCount);
  const reserved = Math.min(sellables, normalizeXp(reservedForOrder));
  const safeSellables = Math.max(0, sellables - reserved);
  const energyRatio = Math.max(1, normalizeXp(maxEnergy)) === 0 ? 0 : normalizeXp(energy) / Math.max(1, normalizeXp(maxEnergy));

  if (reserved > 0 && safeSellables === 0) {
    return `委托留${reserved}件 · 别误吃/卖`;
  }

  if (reserved > 0) {
    return `委托留${reserved}件 · 余${safeSellables}件可处理`;
  }

  if (snacks > 0 && energyRatio <= 0.45) {
    return `点心${snacks}件 · R补体`;
  }

  if (safeSellables > 0) {
    return `可入箱${safeSellables}件 · ${gold}金`;
  }

  if (snacks > 0) {
    return `点心${snacks}件 · 留到疲惫`;
  }

  return "背包轻装 · 去采收";
}

export function backpackDecisionHint({
  sellableCount,
  sellableGold,
  reservedForOrder = 0,
  snackCount = 0,
  energy,
  maxEnergy,
  timeMinutes,
}: {
  sellableCount: number;
  sellableGold: number;
  reservedForOrder?: number;
  snackCount?: number;
  energy: number;
  maxEnergy: number;
  timeMinutes: number;
}) {
  const sellables = normalizeXp(sellableCount);
  const reserved = Math.min(sellables, normalizeXp(reservedForOrder));
  const safe = Math.max(0, sellables - reserved);
  const snacks = normalizeXp(snackCount);
  const gold = normalizeXp(sellableGold);
  const tired = normalizeXp(energy) / Math.max(1, normalizeXp(maxEnergy)) <= 0.35;
  const late = normalizeXp(timeMinutes) >= 21 * 60;

  if (reserved > 0 && safe === 0) {
    return `委托${reserved}件优先入箱`;
  }

  if (reserved > 0) {
    return `委托${reserved}件先留 · 余${safe}件可卖/吃`;
  }

  if (late && sellables > 0) {
    return `夜深 · 先入箱${sellables}件`;
  }

  if (tired && snacks > 0) {
    return `体力低 · 留点心${snacks}件`;
  }

  if (sellables > 0) {
    return `可卖${sellables}件 · 预计${gold}金`;
  }

  return "背包无压力 · 继续采收";
}

export function backpackSortPlanHint({
  sellableCount,
  giftReadyCount,
  snackCount,
  reservedForOrder = 0,
  energy,
  maxEnergy,
  timeMinutes,
}: {
  sellableCount: number;
  giftReadyCount: number;
  snackCount: number;
  reservedForOrder?: number;
  energy: number;
  maxEnergy: number;
  timeMinutes: number;
}) {
  const sellables = normalizeXp(sellableCount);
  const reserved = Math.min(sellables, normalizeXp(reservedForOrder));
  const gifts = normalizeXp(giftReadyCount);
  const snacks = normalizeXp(snackCount);
  const energyRatio = normalizeXp(energy) / Math.max(1, normalizeXp(maxEnergy));
  const late = normalizeXp(timeMinutes) >= 21 * 60;

  if (reserved > 0) {
    return `整理 · 委托锁定${reserved}件`;
  }

  if (!late && gifts > 0) {
    return `整理 · 礼物置顶${gifts}件`;
  }

  if (energyRatio <= 0.35 && snacks > 0) {
    return `整理 · 点心放热键${snacks}件`;
  }

  if (late && sellables > 0) {
    return `整理 · 可售全入箱${sellables}件`;
  }

  if (sellables > 0) {
    return `整理 · 可售靠箱${sellables}件`;
  }

  return "整理 · 背包轻装";
}

export function backpackShortcutHint({
  seedCount,
  openPlotCount,
  sellableCount,
  snackCount,
  energy,
  maxEnergy,
  timeMinutes,
}: {
  seedCount: number;
  openPlotCount: number;
  sellableCount: number;
  snackCount: number;
  energy: number;
  maxEnergy: number;
  timeMinutes: number;
}) {
  const seeds = normalizeXp(seedCount);
  const openPlots = normalizeXp(openPlotCount);
  const sellables = normalizeXp(sellableCount);
  const snacks = normalizeXp(snackCount);
  const energyRatio = normalizeXp(energy) / Math.max(1, normalizeXp(maxEnergy));
  const late = normalizeXp(timeMinutes) >= 21 * 60;

  if (seeds > 0 && openPlots > 0) {
    return `快捷 · 选种播${Math.min(seeds, openPlots)}块`;
  }

  if (energyRatio <= 0.35 && snacks > 0) {
    return "快捷 · R吃点心";
  }

  if (late && sellables > 0) {
    return `快捷 · E入箱${sellables}件`;
  }

  if (sellables > 0) {
    return `快捷 · 睡前入箱${sellables}件`;
  }

  if (seeds === 0 && openPlots > 0) {
    return "快捷 · 去买种子";
  }

  return "快捷 · J看日志";
}

export function settlementNet({
  income,
  orderReward,
  streakBonus,
  passOutFee,
}: {
  income: number;
  orderReward: number;
  streakBonus: number;
  passOutFee: number;
}) {
  return normalizeXp(income) + normalizeXp(orderReward) + normalizeXp(streakBonus) - normalizeXp(passOutFee);
}

export function morningSettlementToastHint({
  income,
  orderReward,
  streakBonus,
  passOutFee,
  shippedItems,
  farmRatingLabel,
  farmRatingScore,
  eventTitle,
}: {
  income: number;
  orderReward: number;
  streakBonus: number;
  passOutFee: number;
  shippedItems: number;
  farmRatingLabel: string;
  farmRatingScore: number;
  eventTitle?: string;
}) {
  const shipped = normalizeXp(shippedItems);
  const sellIncome = normalizeXp(income);
  const reward = normalizeXp(orderReward);
  const bonus = normalizeXp(streakBonus);
  const fee = normalizeXp(passOutFee);
  const net = settlementNet({ income, orderReward, streakBonus, passOutFee });
  const parts: string[] = [];

  if (shipped > 0) {
    parts.push(`售卖${shipped}件+${sellIncome}金`);
  }

  if (reward > 0) {
    parts.push(orderSettlementHint({ orderReward: reward, streakBonus: bonus, eventTitle, completed: true }));
  }

  if (fee > 0) {
    parts.push(`夜间照看-${fee}金`);
  }

  parts.push(net > 0 ? `净+${net}金` : net < 0 ? `净${net}金` : "净0金");

  if (shipped > 0) {
    const label = farmRatingLabel.trim() || "农场";
    parts.push(`${label}${normalizeXp(farmRatingScore)}分`);
  }

  return `清晨结算 · ${parts.join(" · ")}`;
}
