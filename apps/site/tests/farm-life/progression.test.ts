import { describe, expect, it } from "vitest";

import {
  actionEnergyHint,
  actionFeedbackCueHint,
  addMasteryXp,
  adjustedFishingRoll,
  backpackActionHint,
  backpackDecisionHint,
  backpackShortcutHint,
  backpackSortPlanHint,
  backpackValueHint,
  bedtimeChecklistHint,
  bedtimeReadinessHint,
  bedtimeShippingReminderHint,
  bedtimeWarning,
  calendarEventActionHint,
  calendarEventRouteHint,
  calendarEventUrgencyHint,
  calendarPlanHint,
  calendarSocialPrepHint,
  createDefaultMastery,
  cropEconomics,
  cropGrowthStatus,
  dailyAdvice,
  dailyObjectiveHint,
  dayBreakRouteHint,
  dayEndPacingHint,
  dayStartFirstActionHint,
  dayStartPlanHint,
  dayPeriod,
  energyStatus,
  farmRating,
  farmActionFollowUpHint,
  farmActionResultHint,
  fieldActionNextStepHint,
  fieldTileDecisionHint,
  fieldTactileCueHint,
  farmingEnergyCost,
  fieldEnergyPlanHint,
  farmToolStateHint,
  fieldCareSummary,
  fieldWorkloadHint,
  fishingActionJuiceHint,
  fishingBasketRouteHint,
  fishingBiteCueHint,
  fishingCastPreviewHint,
  fishingCatchTier,
  fishingConditionHint,
  fishingResultHint,
  fishingSpotPlanHint,
  forecastSummaryHint,
  festivalReadinessHint,
  festivalChecklistHint,
  forageActionHint,
  forageResultHint,
  forageYield,
  giftAutoUseCount,
  giftChoiceHint,
  giftFriendshipPoints,
  giftMotivationHint,
  giftResultHint,
  hotbarActionHint,
  inventorySlotDetailHint,
  mapInteractionCueHint,
  mailboxResultHint,
  MASTERY_MAX_LEVEL,
  morningSettlementToastHint,
  orderBoardActionHint,
  orderDeadlineHint,
  orderBoardPreviewHint,
  orderFulfillmentProgress,
  orderNextStepHint,
  orderRewardSummary,
  orderSettlementHint,
  orderSourceHint,
  orderStreakBonus,
  orderTurnInHint,
  npcApproachCueHint,
  npcGiftRouteHint,
  npcMapLabel,
  npcScheduleMapHint,
  npcInteractionStateHint,
  npcRoutePlanHint,
  npcRouteHint,
  npcVisitPlanHint,
  objectiveMapActionHint,
  objectiveMapMarkerHint,
  objectiveHudSummaryHint,
  objectiveRouteHint,
  progressForXp,
  questClueRouteHint,
  relationshipCollectionHint,
  relationshipNextHint,
  relationshipProgressLabel,
  relationshipRewardPreviewHint,
  relationshipRewardHint,
  relationshipStage,
  sanitizeMastery,
  seedBatchEconomyHint,
  seedFieldReadinessHint,
  seedPrice,
  seedPurchaseHint,
  seedPurchaseOutcomeHint,
  seedPurchaseReceiptHint,
  seedRouteHint,
  seedShelfDecisionHint,
  seedShopRecommendationHint,
  shippingActionHint,
  shippingBreakdownHint,
  shippingBoxHint,
  shippingDepositHint,
  shippingNextStepHint,
  shippingUrgencyHint,
  shippingPreview,
  settlementNet,
  snackAutoUseCount,
  snackEnergyValue,
  snackResultHint,
  snackTradeoffHint,
  socialActionMemoryHint,
  socialFriendshipBonus,
  socialVisitHint,
  talkResultHint,
  travelArrivalAmbientHint,
  travelArrivalHint,
  travelObjectiveArrivalPlan,
  travelPlanHint,
  transitionArrivalRiskHint,
  transitionDepartureChecklistHint,
  transitionObjectivePromptHint,
  transitionTravelPromptHint,
  toolSelectionToastHint,
  wateringSplashLimit,
  weatherHudPlanHint,
  weatherPlanHint,
} from "../../games/farm-life/src/progression";

describe("farm-life mastery progression", () => {
  it("maps XP to levels and next-level progress", () => {
    expect(progressForXp(0)).toMatchObject({ level: 1, xp: 0, nextLevelXp: 60 });
    expect(progressForXp(60)).toMatchObject({ level: 2, xpIntoLevel: 0, nextLevelXp: 160 });
    expect(progressForXp(559)).toMatchObject({ level: 4, nextLevelXp: 560 });
    expect(progressForXp(560)).toMatchObject({ level: MASTERY_MAX_LEVEL, nextLevelXp: undefined, progressRatio: 1 });
  });

  it("adds XP in-place and reports level-ups only when crossing thresholds", () => {
    const mastery = createDefaultMastery();

    const firstGain = addMasteryXp(mastery, "farming", 59);
    expect(firstGain).toMatchObject({ xpGained: 59, previousLevel: 1, currentLevel: 1, leveledUp: false });
    expect(mastery.farming.xp).toBe(59);

    const levelUp = addMasteryXp(mastery, "farming", 1);
    expect(levelUp).toMatchObject({ xpGained: 1, previousLevel: 1, currentLevel: 2, leveledUp: true });
    expect(mastery.farming.xp).toBe(60);

    const noOp = addMasteryXp(mastery, "farming", -20);
    expect(noOp).toMatchObject({ xpGained: 0, previousLevel: 2, currentLevel: 2, leveledUp: false });
    expect(mastery.farming.xp).toBe(60);
  });

  it("sanitizes missing and invalid saved mastery records", () => {
    const mastery = sanitizeMastery({
      farming: { xp: 85.8 },
      fishing: { xp: -10 },
      social: { xp: "not-a-number" as unknown as number },
    });

    expect(mastery.farming.xp).toBe(85);
    expect(mastery.foraging.xp).toBe(0);
    expect(mastery.fishing.xp).toBe(0);
    expect(mastery.social.xp).toBe(0);
  });

  it("keeps mastery perks modest and deterministic", () => {
    expect(farmingEnergyCost(4, 1)).toBe(4);
    expect(farmingEnergyCost(4, 4)).toBe(2);
    expect(farmingEnergyCost(1, 5)).toBe(1);

    expect(forageYield(1, 1, 1, 3, 15)).toBe(1);
    expect(forageYield(1, 5, 1, 1, 3)).toBe(2);

    expect(adjustedFishingRoll(58, 1)).toBe(58);
    expect(adjustedFishingRoll(58, 4)).toBe(73);
    expect(adjustedFishingRoll(98, 5)).toBe(99);

    expect(socialFriendshipBonus(1)).toBe(0);
    expect(socialFriendshipBonus(3)).toBe(1);
    expect(socialFriendshipBonus(5)).toBe(1);
  });

  it("previews fishing catch tier from the same roll rules used by casts", () => {
    expect(fishingCatchTier({
      baseRoll: 10,
      fishingLevel: 1,
      raining: false,
      pondLightsActive: false,
    })).toBe("miss");
    expect(fishingCatchTier({
      baseRoll: 10,
      fishingLevel: 1,
      raining: false,
      pondLightsActive: true,
    })).toBe("common");
    expect(fishingCatchTier({
      baseRoll: 50,
      fishingLevel: 3,
      raining: false,
      pondLightsActive: false,
    })).toBe("good");
    expect(fishingCatchTier({
      baseRoll: 66,
      fishingLevel: 2,
      raining: true,
      pondLightsActive: false,
    })).toBe("rare");
    expect(fishingCatchTier({
      baseRoll: 73,
      fishingLevel: 1,
      raining: false,
      pondLightsActive: true,
    })).toBe("rare");
  });

  it("formats fishing cast previews with tier and expected value", () => {
    expect(fishingCastPreviewHint({ tier: "miss" })).toBe("空竿风险");
    expect(fishingCastPreviewHint({ tier: "common", catchName: "溪鱼", sellPrice: 34 })).toBe("常见 溪鱼 · 34金");
    expect(fishingCastPreviewHint({ tier: "good", catchName: "鲤鱼", sellPrice: 48 })).toBe("稳中 鲤鱼 · 48金");
    expect(fishingCastPreviewHint({ tier: "rare", catchName: "银鲫", sellPrice: 82 })).toBe("稀有 银鲫 · 82金");
    expect(fishingCastPreviewHint({ tier: "rare", catchName: "  ", sellPrice: Number.NaN })).toBe("稀有 鱼 · 0金");
  });

  it("routes carried fish toward shipping or another cast", () => {
    expect(fishingBasketRouteHint({ fishCount: 0, totalGold: 0, timeMinutes: 12 * 60, energy: 80 })).toBe("鱼篓空 · 找水点");
    expect(fishingBasketRouteHint({ fishCount: 0, totalGold: 0, timeMinutes: 12 * 60, energy: 8 })).toBe("鱼篓空 · 先吃点心");
    expect(fishingBasketRouteHint({ fishCount: 2, totalGold: 68, timeMinutes: 15 * 60, energy: 70 })).toBe("鱼篓2条 · 68金 · 可再钓");
    expect(fishingBasketRouteHint({ fishCount: 3, totalGold: 102, timeMinutes: 16 * 60, energy: 70 })).toBe("鱼篓3条 · 102金 · 可先入箱");
    expect(fishingBasketRouteHint({ fishCount: 1, totalGold: 34, timeMinutes: 21 * 60, energy: 40 })).toBe("鱼篓1条 · 34金 · 睡前入箱");
    expect(fishingBasketRouteHint({ fishCount: 1, totalGold: 34, timeMinutes: 18 * 60, energy: 8 })).toBe("鱼篓1条 · 34金 · 吃点心/回家");
  });

  it("summarizes fishing spot plans with preview basket and urgency", () => {
    expect(fishingSpotPlanHint({
      previewHint: "稳中 鲤鱼 · 42金",
      condition: "雨天好鱼",
      energy: 80,
      timeMinutes: 14 * 60,
      fishInventoryCount: 2,
    })).toBe("鱼点 · 稳中 鲤鱼 · 42金 · 雨天好鱼 · 鱼篓2条 · 可连钓");
    expect(fishingSpotPlanHint({
      previewHint: "空竿风险",
      condition: " ",
      energy: 10,
      timeMinutes: 16 * 60,
      fishInventoryCount: 0,
    })).toBe("鱼点 · 空竿风险 · 普通鱼情 · 鱼篓空 · 先吃点心");
    expect(fishingSpotPlanHint({
      previewHint: " ",
      condition: "夜灯好钓",
      energy: 40,
      timeMinutes: 21 * 60,
      fishInventoryCount: Number.NaN,
    })).toBe("鱼点 · 鱼情未知 · 夜灯好钓 · 鱼篓空 · 睡前入箱");
  });

  it("summarizes fishing action motivation from energy time and conditions", () => {
    expect(fishingActionJuiceHint({
      previewHint: "稀有 银鲫 · 82金",
      energy: 20,
      energyCost: 4,
      minutesPerCast: 20,
      timeMinutes: 18 * 60,
      pondLightsActive: true,
      raining: false,
    })).toBe("抛竿动机 · 夜灯加成 · 可钓5竿/20体 · 睡前5竿");
    expect(fishingActionJuiceHint({
      previewHint: "稳中 鲤鱼 · 48金",
      energy: 16,
      energyCost: 4,
      minutesPerCast: 20,
      timeMinutes: 20 * 60 + 20,
      pondLightsActive: false,
      raining: true,
    })).toBe("抛竿动机 · 雨天加成 · 可钓4竿/16体 · 睡前2竿");
    expect(fishingActionJuiceHint({
      previewHint: "空竿风险",
      energy: 12,
      energyCost: 4,
      minutesPerCast: 20,
      timeMinutes: 21 * 60,
      pondLightsActive: false,
      raining: false,
    })).toBe("抛竿动机 · 谨慎试竿 · 可钓3竿/12体 · 先入箱/回家");
    expect(fishingActionJuiceHint({
      previewHint: "常见 溪鱼 · 34金",
      energy: 3,
      energyCost: 4,
      minutesPerCast: 20,
      timeMinutes: 12 * 60,
      pondLightsActive: false,
      raining: false,
    })).toBe("抛竿动机 · 体力不足需4");
  });

  it("summarizes fishing bite timing cues from tier mastery and conditions", () => {
    expect(fishingBiteCueHint({
      tier: "miss",
      fishingLevel: 1,
      weather: "sunny",
      timeMinutes: 10 * 60,
      pondLightsActive: false,
      energy: 40,
      energyCost: 4,
    })).toBe("咬钩节奏 · 普通虚漂 · 5秒窗 · 等二次涟漪");
    expect(fishingBiteCueHint({
      tier: "rare",
      fishingLevel: 4,
      weather: "rain",
      timeMinutes: 18 * 60,
      pondLightsActive: false,
      energy: 40,
      energyCost: 4,
    })).toBe("咬钩节奏 · 雨天急咬 · 1秒窗 · 亮漂立收");
    expect(fishingBiteCueHint({
      tier: "good",
      fishingLevel: 1,
      weather: "sunny",
      timeMinutes: 19 * 60,
      pondLightsActive: true,
      energy: 40,
      energyCost: 4,
    })).toBe("咬钩节奏 · 夜灯稳咬 · 3秒窗 · 漂沉再收");
    expect(fishingBiteCueHint({
      tier: "common",
      fishingLevel: 2,
      weather: "mist",
      timeMinutes: 12 * 60,
      pondLightsActive: false,
      energy: 3,
      energyCost: 4,
    })).toBe("咬钩节奏 · 体力不足");
    expect(fishingBiteCueHint({
      tier: "common",
      fishingLevel: 2,
      weather: "mist",
      timeMinutes: 21 * 60,
      pondLightsActive: false,
      energy: 40,
      energyCost: 4,
    })).toBe("咬钩节奏 · 收竿入箱");
    expect(fishingBiteCueHint({
      tier: "common",
      fishingLevel: Number.NaN,
      weather: "mist",
      timeMinutes: 12 * 60,
      pondLightsActive: false,
      energy: Number.NaN,
      energyCost: Number.NaN,
    })).toBe("咬钩节奏 · 体力不足");
  });

  it("summarizes fishing results with water condition and next action", () => {
    expect(fishingResultHint({
      caughtName: "鲤鱼",
      sellPrice: 48,
      inventoryCount: 2,
      energy: 72,
      timeMinutes: 18 * 60 + 20,
      condition: "夜灯好钓",
    })).toBe("钓到鲤鱼 · 背包2条 · 48金 · 夜灯好钓 · 18:20 · 72体 · 下一步 · 再抛一竿");
    expect(fishingResultHint({
      caughtName: "",
      energy: 8,
      timeMinutes: 20 * 60,
      condition: "雨天好鱼",
    })).toBe("空竿 · 雨天好鱼 · 20:00 · 8体 · 下一步 · 吃点心/回家");
    expect(fishingResultHint({
      caughtName: "溪鱼",
      sellPrice: 34,
      inventoryCount: 1,
      energy: 30,
      timeMinutes: 21 * 60 + 10,
      condition: " ",
    })).toBe("钓到溪鱼 · 背包1条 · 34金 · 普通鱼情 · 21:10 · 30体 · 下一步 · 入箱回家");
    expect(fishingResultHint({
      caughtName: " ",
      sellPrice: Number.NaN,
      inventoryCount: -1,
      energy: Number.NaN,
      timeMinutes: Number.NaN,
      condition: " ",
    })).toBe("空竿 · 普通鱼情 · 00:00 · 0体 · 下一步 · 吃点心/回家");
  });

  it("previews action energy cost with exhaustion warnings", () => {
    expect(actionEnergyHint({ energy: 30, cost: 4, minutes: 10 })).toBe("4体/10分");
    expect(actionEnergyHint({ energy: 14, cost: 4, minutes: 10 })).toBe("4体/10分 · 做完快见底");
    expect(actionEnergyHint({ energy: 4, cost: 4, minutes: 10 })).toBe("4体/10分 · 会耗尽");
    expect(actionEnergyHint({ energy: 3, cost: 4, minutes: 10 })).toBe("体力不足 · 需4体");
    expect(actionEnergyHint({ energy: Number.NaN, cost: -2, minutes: 0 })).toBe("体力不足 · 需1体");
  });

  it("summarizes action feedback cues from sfx animation and pressure", () => {
    expect(actionFeedbackCueHint({
      action: "till",
      energy: 40,
      timeMinutes: 9 * 60,
    })).toBe("反馈 · 锄声沉一下 · 土块浮字");
    expect(actionFeedbackCueHint({
      action: "water",
      energy: 10,
      timeMinutes: 12 * 60,
    })).toBe("反馈 · 水声短促 · 蓝光溅开 · 轻声收尾");
    expect(actionFeedbackCueHint({
      action: "harvest",
      energy: 40,
      timeMinutes: 21 * 60,
    })).toBe("反馈 · 篮子一响 · 金光浮字 · 夜里收束");
    expect(actionFeedbackCueHint({
      action: "fish-catch",
      energy: 40,
      timeMinutes: 18 * 60,
    })).toBe("反馈 · 鱼线绷紧 · 水花浮字");
    expect(actionFeedbackCueHint({
      action: "fish-miss",
      energy: 40,
      timeMinutes: 18 * 60,
    })).toBe("反馈 · 浮漂轻晃 · 蓝光散开");
    expect(actionFeedbackCueHint({
      action: "ship",
      energy: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("反馈 · 木箱合盖 · 金币浮字 · 轻声收尾");
  });

  it("explains farm tool and plot state mismatches", () => {
    expect(farmToolStateHint({
      tool: "seed",
      tilled: false,
      cropPlanted: false,
      mature: false,
      watered: false,
      raining: false,
      seedCount: 3,
    })).toBe("先用锄头开垦");
    expect(farmToolStateHint({
      tool: "seed",
      tilled: true,
      cropPlanted: false,
      mature: false,
      watered: false,
      raining: false,
      seedCount: 0,
    })).toBe("种子不足");
    expect(farmToolStateHint({
      tool: "water",
      tilled: true,
      cropPlanted: true,
      mature: false,
      watered: true,
      raining: false,
      seedCount: 0,
    })).toBe("已浇水");
    expect(farmToolStateHint({
      tool: "harvest",
      tilled: true,
      cropPlanted: true,
      mature: true,
      watered: true,
      raining: false,
      seedCount: 0,
    })).toBe("可收获");
    expect(farmToolStateHint({
      tool: "hoe",
      tilled: true,
      cropPlanted: true,
      mature: false,
      watered: true,
      raining: false,
      seedCount: 0,
    })).toBe("作物占地 · 换水壶/收获");
  });

  it("summarizes field tool tactile cues from readiness and stamina", () => {
    expect(fieldTactileCueHint({
      tool: "hoe",
      tilled: false,
      cropPlanted: false,
      mature: false,
      watered: false,
      raining: false,
      seedCount: 0,
      energy: 40,
      energyCost: 4,
    })).toBe("手感 · 松土轻敲 · 顺手连做");
    expect(fieldTactileCueHint({
      tool: "seed",
      tilled: true,
      cropPlanted: false,
      mature: false,
      watered: false,
      raining: true,
      seedCount: 3,
      energy: 10,
      energyCost: 2,
    })).toBe("手感 · 撒种雨浇 · 轻做收尾");
    expect(fieldTactileCueHint({
      tool: "water",
      tilled: true,
      cropPlanted: true,
      mature: false,
      watered: true,
      raining: false,
      seedCount: 0,
      energy: 40,
      energyCost: 3,
    })).toBe("手感 · 先换工具");
    expect(fieldTactileCueHint({
      tool: "harvest",
      tilled: true,
      cropPlanted: true,
      mature: true,
      watered: true,
      raining: false,
      seedCount: 0,
      energy: 2,
      energyCost: 2,
    })).toBe("手感 · 篮子快收 · 最后一下");
    expect(fieldTactileCueHint({
      tool: "fish",
      tilled: true,
      cropPlanted: false,
      mature: false,
      watered: false,
      raining: false,
      seedCount: 0,
      energy: 20,
      energyCost: 4,
    })).toBe("手感 · 水边抛竿");
    expect(fieldTactileCueHint({
      tool: "hoe",
      tilled: false,
      cropPlanted: false,
      mature: false,
      watered: false,
      raining: false,
      seedCount: 0,
      energy: Number.NaN,
      energyCost: Number.NaN,
    })).toBe("手感 · 体力不足需1");
  });

  it("turns a faced field tile into the next micro decision", () => {
    expect(fieldTileDecisionHint({
      tool: "hoe",
      tilled: false,
      mature: false,
      watered: false,
      raining: false,
      seedName: "萝卜",
      seedCount: 3,
      energyCost: 4,
      minutesPerAction: 10,
    })).toBe("地块决策 · 开垦 · 4体/10分");
    expect(fieldTileDecisionHint({
      tool: "water",
      tilled: false,
      mature: false,
      watered: false,
      raining: false,
      seedName: "萝卜",
      seedCount: 3,
      energyCost: 3,
      minutesPerAction: 10,
    })).toBe("地块决策 · 换锄头开垦");
    expect(fieldTileDecisionHint({
      tool: "seed",
      tilled: true,
      mature: false,
      watered: false,
      raining: false,
      seedName: "萝卜",
      seedCount: 3,
      energyCost: 2,
      minutesPerAction: 10,
    })).toBe("地块决策 · 播萝卜 · 2体/10分 · 3包");
    expect(fieldTileDecisionHint({
      tool: "harvest",
      tilled: true,
      cropName: "土豆",
      growthLabel: "今日可收",
      mature: true,
      watered: true,
      raining: false,
      seedName: "萝卜",
      seedCount: 0,
      energyCost: 1,
      minutesPerAction: 10,
      sellPrice: 42,
    })).toBe("地块决策 · 收土豆 · 42金 · 1体/10分");
    expect(fieldTileDecisionHint({
      tool: "hoe",
      tilled: true,
      cropName: "小麦",
      growthLabel: "明天可收",
      mature: false,
      watered: false,
      raining: false,
      seedName: "萝卜",
      seedCount: 0,
      energyCost: 4,
      minutesPerAction: 10,
    })).toBe("地块决策 · 换水壶 · 小麦 明天可收");
    expect(fieldTileDecisionHint({
      tool: "water",
      tilled: true,
      cropName: "小麦",
      growthLabel: "还需 2 天",
      mature: false,
      watered: false,
      raining: true,
      seedName: "萝卜",
      seedCount: 0,
      energyCost: 3,
      minutesPerAction: 10,
    })).toBe("地块决策 · 雨水照看 · 小麦 还需 2 天");
  });

  it("explains the selected hotbar action", () => {
    expect(hotbarActionHint({ tool: "hoe" })).toBe("已选锄头 · E开垦");
    expect(hotbarActionHint({ tool: "seed", seedName: "萝卜", seedCount: 3 })).toBe("已选萝卜种子 · 3包 · E播种");
    expect(hotbarActionHint({ tool: "seed", seedName: " ", seedCount: Number.NaN })).toBe("已选种子 · 无库存 · 去商店");
    expect(hotbarActionHint({ tool: "fish" })).toBe("已选鱼竿 · 水边E抛竿");
  });

  it("combines tool selection with the current field next step", () => {
    expect(toolSelectionToastHint({
      actionHint: "已选锄头 · E开垦",
      nextStepHint: "下一步 · 播种2块",
    })).toBe("已选锄头 · E开垦 · 下一步 · 播种2块");
    expect(toolSelectionToastHint({
      actionHint: " ",
      nextStepHint: "下一步 · 查日志",
    })).toBe("已选工具 · 下一步 · 查日志");
    expect(toolSelectionToastHint({
      actionHint: "已选鱼竿 · 水边E抛竿",
      nextStepHint: " ",
    })).toBe("已选鱼竿 · 水边E抛竿");
  });

  it("combines map interaction cues with purpose and next step", () => {
    expect(mapInteractionCueHint({
      actionLabel: "售卖箱",
      purposeHint: "入箱 背包2件 · 2件 · 48金",
      nextStepHint: "夜深 · 先入箱2件",
    })).toBe("E 售卖箱 · 入箱 背包2件 · 2件 · 48金 · 下一步 · 夜深 · 先入箱2件");
    expect(mapInteractionCueHint({
      actionLabel: " ",
      purposeHint: "今日已读",
      nextStepHint: "读信看天",
    })).toBe("E 互动 · 今日已读 · 下一步 · 读信看天");
    expect(mapInteractionCueHint({
      actionLabel: "看天气",
      purposeHint: " ",
      nextStepHint: " ",
    })).toBe("E 看天气");
  });

  it("confirms farm action results with time energy and inventory context", () => {
    expect(farmActionResultHint({
      action: "till",
      energy: 96,
      timeMinutes: 6 * 60 + 10,
    })).toBe("翻地完成 · 06:10 · 96体");
    expect(farmActionResultHint({
      action: "plant",
      cropName: "萝卜",
      energy: 94,
      timeMinutes: 6 * 60 + 20,
      inventoryCount: 3,
      watered: false,
    })).toBe("萝卜已种 · 剩3包 · 06:20 · 94体");
    expect(farmActionResultHint({
      action: "plant",
      cropName: "小麦",
      energy: 94,
      timeMinutes: 6 * 60 + 20,
      inventoryCount: 3,
      watered: true,
    })).toBe("小麦已种 · 雨水代浇 · 06:20 · 94体");
    expect(farmActionResultHint({
      action: "water",
      energy: 90,
      timeMinutes: 7 * 60,
      splashCount: 2,
    })).toBe("浇水完成 · 溅水2块 · 07:00 · 90体");
    expect(farmActionResultHint({
      action: "harvest",
      cropName: "土豆",
      energy: 88,
      timeMinutes: 8 * 60 + 5,
      inventoryCount: 4,
      sellPrice: 42,
    })).toBe("收获土豆 · 背包4件 · 42金 · 08:05 · 88体");
    expect(farmActionResultHint({
      action: "harvest",
      cropName: "  ",
      energy: Number.NaN,
      timeMinutes: Number.NaN,
      inventoryCount: -1,
      sellPrice: Number.NaN,
    })).toBe("收获作物 · 背包0件 · 0金 · 00:00 · 0体");
  });

  it("combines farm action feedback with the next step and urgency", () => {
    expect(farmActionFollowUpHint({
      resultHint: "翻地完成 · 06:10 · 96体",
      nextStepHint: "下一步 · 播种2块",
      energy: 96,
      timeMinutes: 6 * 60 + 10,
    })).toBe("翻地完成 · 06:10 · 96体 · 下一步 · 播种2块");
    expect(farmActionFollowUpHint({
      resultHint: "收获土豆 · 背包4件 · 42金 · 20:40 · 10体",
      nextStepHint: "下一步 · 入箱4件",
      energy: 10,
      timeMinutes: 20 * 60 + 40,
    })).toBe("收获土豆 · 背包4件 · 42金 · 20:40 · 10体 · 下一步 · 入箱4件 · 体力低 · 吃点心/回家");
    expect(farmActionFollowUpHint({
      resultHint: "浇水完成 · 21:00 · 30体",
      nextStepHint: " ",
      energy: 30,
      timeMinutes: 21 * 60,
    })).toBe("浇水完成 · 21:00 · 30体 · 夜深 · 收尾回家");
    expect(farmActionFollowUpHint({
      resultHint: " ",
      nextStepHint: " ",
      energy: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("动作完成 · 体力低 · 吃点心/回家");
  });

  it("points field actions toward the next farming step", () => {
    expect(fieldActionNextStepHint({
      openPlotCount: 2,
      carriedSeeds: 5,
      dryCropCount: 0,
      matureCount: 0,
      sellableInventoryCount: 0,
    })).toBe("下一步 · 播种2块");
    expect(fieldActionNextStepHint({
      openPlotCount: 0,
      carriedSeeds: 0,
      dryCropCount: 3,
      matureCount: 0,
      sellableInventoryCount: 0,
    })).toBe("下一步 · 浇水3块");
    expect(fieldActionNextStepHint({
      openPlotCount: 0,
      carriedSeeds: 0,
      dryCropCount: 3,
      matureCount: 1,
      sellableInventoryCount: 0,
    })).toBe("下一步 · 收获1块");
    expect(fieldActionNextStepHint({
      openPlotCount: 4,
      carriedSeeds: 0,
      dryCropCount: 0,
      matureCount: 0,
      sellableInventoryCount: 2,
    })).toBe("下一步 · 去商店补种");
    expect(fieldActionNextStepHint({
      openPlotCount: 0,
      carriedSeeds: 0,
      dryCropCount: 0,
      matureCount: 0,
      sellableInventoryCount: 2,
    })).toBe("下一步 · 入箱2件");
    expect(fieldActionNextStepHint({
      openPlotCount: Number.NaN,
      carriedSeeds: -1,
      dryCropCount: -1,
      matureCount: -1,
      sellableInventoryCount: -1,
    })).toBe("下一步 · 查日志");
  });

  it("combines gift friendship points from gift quality, events, and mastery", () => {
    expect(giftFriendshipPoints(3, 1, 1)).toBe(5);
    expect(giftFriendshipPoints(-2, 9, 0)).toBe(9);
    expect(giftFriendshipPoints(Number.NaN, 1, 1)).toBe(2);
  });

  it("formats social gift result feedback with event and mastery bonuses", () => {
    expect(
      giftResultHint({
        npcName: "阿良",
        giftName: "鲤鱼",
        loved: true,
        lovedLine: "这正好能做汤。",
        points: 5,
        teaBonus: 1,
        masteryBonus: 1,
        stageLabel: "好友",
        friendship: 18,
        rewardText: " 解锁鱼汤。",
        questText: " 完成邻里线索。",
        masteryText: " 邻里+10xp。",
      }),
    ).toBe("阿良：谢谢你的鲤鱼。这正好能做汤。 好感 +5（茶会 +1）（邻里熟练 +1）（好友 · 18 心） 解锁鱼汤。 完成邻里线索。 邻里+10xp。");
    expect(
      giftResultHint({
        npcName: " ",
        giftName: "",
        loved: false,
        points: Number.NaN,
        stageLabel: "",
        friendship: -1,
      }),
    ).toBe("镇民：谢谢你的礼物。这份心意我收下了。 好感 +0（初识 · 0 心）");
  });

  it("formats daily talk feedback with relationship and bonus details", () => {
    expect(
      talkResultHint({
        dialogText: "阿良：溪水今天很稳。",
        points: 3,
        teaBonus: 1,
        masteryBonus: 1,
        stageLabel: "相熟",
        friendship: 8,
        rewardText: " 解锁鱼饵。",
        questText: " 完成邻里线索。",
        masteryText: " 邻里+5xp。",
      }),
    ).toBe("阿良：溪水今天很稳。 好感 +3（茶会 +1）（邻里熟练 +1）（相熟 · 8 心） 解锁鱼饵。 完成邻里线索。 邻里+5xp。");
    expect(
      talkResultHint({
        dialogText: " ",
        points: Number.NaN,
        stageLabel: "",
        friendship: -1,
      }),
    ).toBe("镇民：今天也要慢慢来。 好感 +0（初识 · 0 心）");
  });

  it("unlocks a modest watering splash at higher farming mastery", () => {
    expect(wateringSplashLimit(1)).toBe(0);
    expect(wateringSplashLimit(3)).toBe(0);
    expect(wateringSplashLimit(4)).toBe(2);
    expect(wateringSplashLimit(9)).toBe(2);
  });

  it("describes crop harvest timing from growth state", () => {
    expect(cropGrowthStatus(-1, 0)).toMatchObject({
      mature: false,
      currentDay: 0,
      growDays: 1,
      remainingDays: 1,
      label: "明天可收",
    });
    expect(cropGrowthStatus(1, 3)).toMatchObject({ mature: false, remainingDays: 2, label: "还需 2 天" });
    expect(cropGrowthStatus(2, 3)).toMatchObject({ mature: false, remainingDays: 1, label: "明天可收" });
    expect(cropGrowthStatus(3, 3)).toMatchObject({ mature: true, remainingDays: 0, label: "今日可收" });
  });

  it("summarizes field care state from planted, watered, and mature counts", () => {
    expect(fieldCareSummary({ plantedCount: 0, wateredCount: 0, matureCount: 0 })).toBe("空田 · 先开垦播种");
    expect(fieldCareSummary({ plantedCount: 4, wateredCount: 1, matureCount: 0 })).toBe("待浇 3 块 · 1/4 已浇");
    expect(fieldCareSummary({ plantedCount: 4, wateredCount: 4, matureCount: 0 })).toBe("全部已浇 · 4/4");
    expect(fieldCareSummary({ plantedCount: 4, wateredCount: 2, matureCount: 1 })).toBe("1 块可收 · 2/4 已浇");
    expect(fieldCareSummary({ plantedCount: -1, wateredCount: 99, matureCount: 99 })).toBe("空田 · 先开垦播种");
  });

  it("estimates remaining field workload in energy and time", () => {
    expect(fieldWorkloadHint({
      dryCount: 3,
      matureCount: 2,
      waterCost: 2,
      harvestCost: 1,
      minutesPerAction: 10,
    })).toBe("收2 · 浇3 · 8体/50分");
    expect(fieldWorkloadHint({
      dryCount: 0,
      matureCount: 2,
      waterCost: 2,
      harvestCost: 1,
      minutesPerAction: 10,
    })).toBe("收2 · 2体/20分");
    expect(fieldWorkloadHint({
      dryCount: -1,
      matureCount: Number.NaN,
      waterCost: 0,
      harvestCost: 0,
      minutesPerAction: 0,
    })).toBe("田地已收尾");
  });

  it("plans field work against current energy and snack recovery", () => {
    expect(fieldEnergyPlanHint({
      energy: 18,
      dryCount: 3,
      matureCount: 2,
      waterCost: 3,
      harvestCost: 2,
    })).toBe("体力够 · 余5");
    expect(fieldEnergyPlanHint({
      energy: 8,
      dryCount: 3,
      matureCount: 2,
      waterCost: 3,
      harvestCost: 2,
      snackEnergyAvailable: 10,
    })).toBe("先吃点心+10体 · 可收尾");
    expect(fieldEnergyPlanHint({
      energy: 3,
      dryCount: 3,
      matureCount: 2,
      waterCost: 3,
      harvestCost: 2,
      snackEnergyAvailable: 4,
    })).toBe("点心后还缺6体");
    expect(fieldEnergyPlanHint({
      energy: Number.NaN,
      dryCount: -1,
      matureCount: Number.NaN,
      waterCost: 0,
      harvestCost: 0,
    })).toBe("体力可留给跑图");
  });

  it("converts edible item value into bounded snack energy", () => {
    expect(snackEnergyValue(-20, "crop")).toBe(4);
    expect(snackEnergyValue(24, "crop")).toBe(8);
    expect(snackEnergyValue(28, "forage")).toBe(15);
    expect(snackEnergyValue(72, "fish")).toBe(32);
    expect(snackEnergyValue(999, "fish")).toBe(35);
  });

  it("summarizes snack value tradeoffs and order reserves", () => {
    expect(snackTradeoffHint({ sellPrice: 24, energyGain: 8 })).toBe("24金 / +8体");
    expect(snackTradeoffHint({ sellPrice: 24, energyGain: 8, orderReserveCount: 3 })).toBe("24金 / +8体 · 委托留3");
    expect(snackTradeoffHint({ sellPrice: Number.NaN, energyGain: -1, orderReserveCount: Number.NaN })).toBe("0金 / +0体");
  });

  it("summarizes snack result energy and readiness", () => {
    expect(snackResultHint({
      snackName: "山莓",
      restoredEnergy: 8,
      energy: 100,
      maxEnergy: 100,
    })).toBe("吃下山莓 · +8体 · 100/100体 · 体力已满");
    expect(snackResultHint({
      snackName: "鲤鱼",
      restoredEnergy: 10,
      energy: 58,
      maxEnergy: 100,
    })).toBe("吃下鲤鱼 · +10体 · 58/100体 · 可继续干活");
    expect(snackResultHint({
      snackName: " ",
      restoredEnergy: Number.NaN,
      energy: 20,
      maxEnergy: 100,
    })).toBe("吃下点心 · +0体 · 20/100体 · 还偏累");
  });

  it("previews forage pickup value and snack energy", () => {
    expect(forageActionHint({ name: "山莓", count: 1, sellPrice: 18, energyGain: 9 })).toBe("山莓 · 18金/+9体");
    expect(forageActionHint({ name: "松露菇", count: 2, sellPrice: 28, energyGain: 15 })).toBe("松露菇 x2 · 56金/+15体");
    expect(forageActionHint({ name: "野花", count: 0, sellPrice: Number.NaN, energyGain: -1 })).toBe("野花 · 0金/+0体");
  });

  it("summarizes forage pickup results with value and next loop action", () => {
    expect(forageResultHint({
      name: "山莓",
      count: 1,
      sellPrice: 18,
      energyGain: 9,
      inventoryCount: 3,
      giftReadyCount: 2,
      timeMinutes: 10 * 60,
    })).toBe("采到山莓 · 背包3件 · 18金/+9体 · 10:00 · 下一步 · 带礼2件");
    expect(forageResultHint({
      name: "松露菇",
      count: 2,
      sellPrice: 28,
      energyGain: 15,
      inventoryCount: 2,
      giftReadyCount: 0,
      timeMinutes: 20 * 60 + 15,
    })).toBe("采到松露菇 x2 · 背包2件 · 56金/+15体 · 20:15 · 下一步 · 入箱回家");
    expect(forageResultHint({
      name: " ",
      count: -1,
      sellPrice: Number.NaN,
      energyGain: -1,
      inventoryCount: -1,
      giftReadyCount: -1,
      timeMinutes: Number.NaN,
    })).toBe("采到采集物 · 背包0件 · 0金/+0体 · 00:00 · 下一步 · 继续采集/入箱");
  });

  it("keeps quick snacks from consuming order-reserved crops", () => {
    expect(snackAutoUseCount({ inventoryCount: 5, orderReserveCount: 3 })).toBe(2);
    expect(snackAutoUseCount({ inventoryCount: 3, orderReserveCount: 3 })).toBe(0);
    expect(snackAutoUseCount({ inventoryCount: 1, orderReserveCount: 3 })).toBe(0);
    expect(snackAutoUseCount({ inventoryCount: Number.NaN, orderReserveCount: -2 })).toBe(0);
  });

  it("keeps automatic gift choice from consuming order-reserved crops first", () => {
    expect(giftAutoUseCount({ inventoryCount: 5, orderReserveCount: 3 })).toBe(2);
    expect(giftAutoUseCount({ inventoryCount: 3, orderReserveCount: 3 })).toBe(0);
    expect(giftAutoUseCount({ inventoryCount: 1, orderReserveCount: 3 })).toBe(0);
    expect(giftAutoUseCount({ inventoryCount: Number.NaN, orderReserveCount: -2 })).toBe(0);
  });

  it("labels gift choices that are safe surplus or would use order reserve", () => {
    expect(giftChoiceHint({
      name: "萝卜",
      points: 4,
      loved: true,
      autoUseCount: 2,
      orderReserveCount: 3,
    })).toBe("萝卜+4❤ · 余2可送");
    expect(giftChoiceHint({
      name: "萝卜",
      points: 4,
      loved: true,
      autoUseCount: 0,
      orderReserveCount: 3,
    })).toBe("萝卜+4❤ · 动用委托");
    expect(giftChoiceHint({
      name: "鲤鱼",
      points: 1,
      loved: false,
      autoUseCount: 0,
      orderReserveCount: 0,
    })).toBe("鲤鱼+1");
  });

  it("turns gifts into relationship milestone motivation", () => {
    expect(giftMotivationHint({
      npcName: "阿良",
      currentFriendship: 9,
      giftName: "鲤鱼",
      giftPoints: 3,
      loved: true,
      alreadyGifted: false,
      nextRewardName: "鲤鱼",
    })).toBe("阿良 · 鲤鱼+3❤ · 可到好友 · 奖励鲤鱼");
    expect(giftMotivationHint({
      npcName: "陈婶",
      currentFriendship: 8,
      giftName: "山莓",
      giftPoints: 2,
      loved: false,
      alreadyGifted: false,
      nextRewardName: "山莓",
    })).toBe("陈婶 · 山莓+2 · 还差2心到好友 · 奖励山莓");
    expect(giftMotivationHint({
      npcName: "老周",
      currentFriendship: 24,
      giftName: "萝卜",
      giftPoints: 4,
      loved: true,
      alreadyGifted: false,
    })).toBe("老周 · 萝卜+4❤ · 知己MAX");
    expect(giftMotivationHint({
      npcName: " ",
      currentFriendship: Number.NaN,
      giftName: " ",
      giftPoints: Number.NaN,
      alreadyGifted: false,
    })).toBe("镇民 · 缺礼物 · 带作物/采集/渔获");
    expect(giftMotivationHint({
      npcName: "阿良",
      currentFriendship: 8,
      giftName: "鲤鱼",
      giftPoints: 3,
      loved: true,
      alreadyGifted: true,
    })).toBe("阿良 · 今日已送 · 明日再刷关系");
  });

  it("shows daily NPC interaction state in the prompt", () => {
    expect(npcInteractionStateHint({
      relationshipLabel: "相熟 8/12",
      talkedToday: false,
      giftedToday: false,
      giftHint: "山莓+4❤",
      socialBonus: 1,
    })).toBe("E 聊天 相熟 8/12 / G 山莓+4❤");
    expect(npcInteractionStateHint({
      relationshipLabel: "相熟 8/12",
      talkedToday: true,
      giftedToday: false,
      giftHint: "山莓+4❤",
      socialBonus: 1,
    })).toBe("E 今日已聊 相熟 8/12 / G 山莓+4❤");
    expect(npcInteractionStateHint({
      relationshipLabel: "知己 MAX",
      talkedToday: true,
      giftedToday: true,
      socialBonus: 2,
    })).toBe("E 今日已聊 知己 MAX / G 今日已送 邻里+2");
    expect(npcInteractionStateHint({
      relationshipLabel: " ",
      talkedToday: false,
      giftedToday: false,
      socialBonus: Number.NaN,
    })).toBe("E 聊天 关系未知 / G 送礼");
  });

  it("summarizes today's NPC social memory after interactions", () => {
    expect(socialActionMemoryHint({
      relationshipLabel: "相熟 8/12",
      talkedToday: true,
      giftedToday: true,
      giftReady: true,
    })).toBe("今日社交完成 · 相熟 8/12");
    expect(socialActionMemoryHint({
      relationshipLabel: "相熟 8/12",
      talkedToday: true,
      giftedToday: false,
      giftReady: true,
    })).toBe("已聊天 · 还能送礼 · 相熟 8/12");
    expect(socialActionMemoryHint({
      relationshipLabel: "相熟 8/12",
      talkedToday: true,
      giftedToday: false,
      giftReady: false,
    })).toBe("已聊天 · 明日带礼 · 相熟 8/12");
    expect(socialActionMemoryHint({
      relationshipLabel: "好友 20/24",
      talkedToday: false,
      giftedToday: true,
      giftReady: false,
    })).toBe("已送礼 · 还可聊天 · 好友 20/24");
    expect(socialActionMemoryHint({
      relationshipLabel: " ",
      talkedToday: false,
      giftedToday: false,
      giftReady: false,
    })).toBe("未互动 · 关系未知");
  });

  it("computes farm rating tiers from persistent progress", () => {
    const sprout = farmRating({
      totalShipped: 0,
      totalShippingIncome: 0,
      completedOrders: 0,
      totalFriendship: 0,
      totalMasteryLevel: 4,
    });
    expect(sprout).toMatchObject({ tier: "sprout", label: "新芽农场", nextScore: 90 });

    const homestead = farmRating({
      totalShipped: 12,
      totalShippingIncome: 600,
      completedOrders: 1,
      totalFriendship: 4,
      totalMasteryLevel: 7,
    });
    expect(homestead.tier).toBe("homestead");
    expect(homestead.score).toBeGreaterThan(sprout.score);

    expect(
      farmRating({
        totalShipped: 80,
        totalShippingIncome: 2600,
        completedOrders: 5,
        totalFriendship: 18,
        totalMasteryLevel: 16,
      }).tier,
    ).toBe("valley");
  });

  it("maps friendship points to relationship stages", () => {
    expect(relationshipStage(0)).toMatchObject({ level: 1, label: "初识", nextPoints: 5 });
    expect(relationshipStage(5)).toMatchObject({ level: 2, label: "相熟", nextPoints: 12 });
    expect(relationshipStage(12)).toMatchObject({ level: 3, label: "好友", nextPoints: 24 });
    expect(relationshipStage(24)).toEqual({ level: 4, label: "知己" });
  });

  it("formats relationship progress toward the next milestone", () => {
    expect(relationshipProgressLabel(Number.NaN)).toBe("初识 0/5");
    expect(relationshipProgressLabel(4)).toBe("初识 4/5");
    expect(relationshipProgressLabel(5)).toBe("相熟 5/12");
    expect(relationshipProgressLabel(20)).toBe("好友 20/24");
    expect(relationshipProgressLabel(24)).toBe("知己 MAX");
  });

  it("summarizes the next relationship milestone", () => {
    expect(relationshipNextHint(Number.NaN)).toBe("关系 · 距相熟还差5心");
    expect(relationshipNextHint(4)).toBe("关系 · 距相熟还差1心");
    expect(relationshipNextHint(8)).toBe("关系 · 距好友还差4心");
    expect(relationshipNextHint(20)).toBe("关系 · 距知己还差4心");
    expect(relationshipNextHint(24)).toBe("关系 · 知己MAX");
  });

  it("summarizes relationship collection progress for the journal", () => {
    expect(relationshipCollectionHint({
      entries: [
        { name: "阿良", points: 10 },
        { name: "陈婶", points: 24 },
        { name: "长者", points: 3 },
      ],
      giftReadyCount: 2,
      talkedTodayCount: 1,
      giftedTodayCount: 0,
    })).toBe("邻里图鉴 · 知己1/3 · 阿良差2心到好友 · 礼物2件 · 已聊1人");
    expect(relationshipCollectionHint({
      entries: [
        { name: "阿良", points: 24 },
        { name: "陈婶", points: 30 },
      ],
      giftReadyCount: 0,
      talkedTodayCount: 2,
      giftedTodayCount: 1,
    })).toBe("邻里图鉴 · 知己2/2 · 全员知己 · 已聊2人 · 已送1人");
    expect(relationshipCollectionHint({
      entries: [],
      giftReadyCount: Number.NaN,
      talkedTodayCount: -1,
      giftedTodayCount: -1,
    })).toBe("邻里图鉴 · 暂无镇民");
  });

  it("makes relationship reward unlocks explicit", () => {
    expect(relationshipRewardHint({
      npcName: "阿良",
      stageLabel: "好友",
      rewardName: "鲤鱼",
    })).toBe("阿良奖励 · 好友解锁鲤鱼 · 已放入背包");
    expect(relationshipRewardHint({
      npcName: "陈婶",
      stageLabel: "知己",
      rewardName: "蘑菇",
      alreadyClaimed: true,
    })).toBe("陈婶奖励 · 知己已领取");
    expect(relationshipRewardHint({
      npcName: " ",
      stageLabel: " ",
      rewardName: " ",
    })).toBe("镇民奖励 · 继续来往");
  });

  it("previews the closest relationship reward before gifting", () => {
    expect(relationshipRewardPreviewHint({
      npcName: "阿良",
      currentFriendship: 10,
      giftPoints: 3,
      nextRewardName: "鲤鱼",
    })).toBe("阿良奖励 · 送礼可解锁鲤鱼");
    expect(relationshipRewardPreviewHint({
      npcName: "陈婶",
      currentFriendship: 8,
      giftPoints: 2,
      nextRewardName: "山莓",
    })).toBe("陈婶奖励 · 送后差2心 · 山莓");
    expect(relationshipRewardPreviewHint({
      npcName: "青禾",
      currentFriendship: 11,
      giftPoints: 3,
      alreadyGifted: true,
      nextRewardName: "小麦种子",
    })).toBe("青禾奖励 · 差1心到好友 · 明日冲小麦种子");
    expect(relationshipRewardPreviewHint({
      npcName: "老周",
      currentFriendship: 24,
      giftPoints: 3,
      nextRewardName: "土豆",
    })).toBe("老周奖励 · 知己MAX");
    expect(relationshipRewardPreviewHint({
      npcName: " ",
      currentFriendship: Number.NaN,
      giftPoints: Number.NaN,
      nextRewardName: " ",
    })).toBe("镇民奖励 · 继续来往");
  });

  it("summarizes the next social visit action", () => {
    expect(socialVisitHint({ samePlaceCount: 2, giftReadyCount: 1, talkedToday: false, giftedToday: false })).toBe("身边 2 人 · 带礼可送");
    expect(socialVisitHint({ samePlaceCount: 1, giftReadyCount: 0, talkedToday: false, giftedToday: false })).toBe("身边 1 人 · 先聊天");
    expect(socialVisitHint({ samePlaceCount: 0, giftReadyCount: 3, talkedToday: false, giftedToday: false })).toBe("背包有礼 · 去找镇民");
    expect(socialVisitHint({ samePlaceCount: 0, giftReadyCount: 0, talkedToday: true, giftedToday: false })).toBe("已聊天 · 明日带礼");
    expect(socialVisitHint({ samePlaceCount: 0, giftReadyCount: 1, talkedToday: true, giftedToday: false })).toBe("已聊天 · 还能送礼");
    expect(socialVisitHint({ samePlaceCount: 9, giftReadyCount: 9, talkedToday: false, giftedToday: true })).toBe("已送礼 · 今日社交完成");
  });

  it("summarizes NPC visit location, gift and activity", () => {
    expect(
      npcVisitPlanHint({
        place: "farm",
        currentPlace: "farm",
        activity: "看田埂",
        giftName: "山莓",
        loved: true,
        alreadyGifted: false,
      }),
    ).toBe("身边 · 带山莓❤ · 看田埂");
    expect(
      npcVisitPlanHint({
        place: "town",
        currentPlace: "farm",
        activity: "",
        giftName: "",
        alreadyGifted: false,
      }),
    ).toBe("小镇 · 先聊天 · 闲逛");
    expect(
      npcVisitPlanHint({
        place: "shop",
        currentPlace: "farm",
        activity: "整理种子",
        giftName: "萝卜",
        loved: false,
        alreadyGifted: true,
      }),
    ).toBe("商店 · 今日已送 · 整理种子");
  });

  it("summarizes cross-place NPC routes with arrival time and gift action", () => {
    expect(
      npcRouteHint({
        place: "town",
        currentPlace: "farm",
        timeMinutes: 7 * 60,
        travelMinutes: 20,
        giftName: "山莓",
        loved: true,
        alreadyGifted: false,
      }),
    ).toBe("去小镇07:20 · 带山莓❤");
    expect(
      npcRouteHint({
        place: "farm",
        currentPlace: "farm",
        timeMinutes: Number.NaN,
        travelMinutes: Number.NaN,
        giftName: "",
        alreadyGifted: false,
      }),
    ).toBe("身边 · 先聊天");
    expect(
      npcRouteHint({
        place: "shop",
        currentPlace: "town",
        timeMinutes: 23 * 60 + 50,
        travelMinutes: 20,
        giftName: "萝卜",
        alreadyGifted: true,
      }),
    ).toBe("去商店00:10 · 今日已送");
  });

  it("adds current activity to NPC route plans in the journal", () => {
    expect(
      npcRoutePlanHint({
        place: "farm",
        currentPlace: "farm",
        activity: "看田埂",
        timeMinutes: 8 * 60,
        travelMinutes: 20,
        giftName: "山莓",
        loved: true,
        alreadyGifted: false,
      }),
    ).toBe("身边 · 带山莓❤ · 看田埂");
    expect(
      npcRoutePlanHint({
        place: "town",
        currentPlace: "farm",
        activity: "买种子",
        timeMinutes: 7 * 60,
        travelMinutes: 20,
        giftName: "",
        alreadyGifted: false,
      }),
    ).toBe("去小镇07:20 · 先聊天 · 买种子");
    expect(
      npcRoutePlanHint({
        place: "home",
        currentPlace: "home",
        activity: "",
        timeMinutes: Number.NaN,
        travelMinutes: Number.NaN,
        alreadyGifted: false,
      }),
    ).toBe("身边 · 先聊天 · 闲逛");
  });

  it("focuses NPC gift routes on today's best social action", () => {
    expect(npcGiftRouteHint({
      npcName: "阿良",
      place: "farm",
      currentPlace: "farm",
      giftName: "山莓",
      loved: true,
      talkedToday: false,
      alreadyGifted: false,
      timeMinutes: 8 * 60,
      travelMinutes: 20,
    })).toBe("阿良 · 聊天后送山莓❤");
    expect(npcGiftRouteHint({
      npcName: "陈婶",
      place: "town",
      currentPlace: "farm",
      giftName: "萝卜",
      talkedToday: true,
      alreadyGifted: false,
      timeMinutes: 8 * 60,
      travelMinutes: 20,
    })).toBe("去小镇08:20 · 送萝卜");
    expect(npcGiftRouteHint({
      npcName: "小夏",
      place: "town",
      currentPlace: "farm",
      giftName: "山莓",
      loved: true,
      talkedToday: false,
      alreadyGifted: false,
      timeMinutes: 21 * 60,
      travelMinutes: 20,
    })).toBe("小夏 · 夜深明日送山莓❤");
    expect(npcGiftRouteHint({
      npcName: " ",
      place: "home",
      currentPlace: "home",
      giftName: "",
      talkedToday: true,
      alreadyGifted: false,
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
    })).toBe("镇民 · 明日带礼");
    expect(npcGiftRouteHint({
      npcName: "陈婶",
      place: "town",
      currentPlace: "town",
      giftName: "茶叶",
      talkedToday: true,
      alreadyGifted: true,
      timeMinutes: 12 * 60,
      travelMinutes: 20,
    })).toBe("陈婶 · 已送礼");
  });

  it("turns NPC schedules into concrete approach cues", () => {
    expect(npcApproachCueHint({
      npcName: "阿良",
      place: "farm",
      currentPlace: "farm",
      activity: "看田埂",
      giftName: "山莓",
      loved: true,
      talkedToday: false,
      alreadyGifted: false,
      timeMinutes: 8 * 60,
      travelMinutes: 20,
    })).toBe("阿良 · 先聊再送山莓❤ · 看田埂");
    expect(npcApproachCueHint({
      npcName: "阿良",
      place: "farm",
      currentPlace: "farm",
      activity: "看田埂",
      giftName: "山莓",
      loved: true,
      talkedToday: true,
      alreadyGifted: false,
      timeMinutes: 8 * 60,
      travelMinutes: 20,
    })).toBe("阿良 · 身边送山莓❤ · 看田埂");
    expect(npcApproachCueHint({
      npcName: "陈婶",
      place: "shop",
      currentPlace: "town",
      activity: "整理种子",
      giftName: "萝卜",
      talkedToday: true,
      alreadyGifted: false,
      timeMinutes: 10 * 60,
      travelMinutes: 20,
    })).toBe("陈婶 · 去商店10:20 · 送萝卜 · 整理种子");
    expect(npcApproachCueHint({
      npcName: "青禾",
      place: "town",
      currentPlace: "farm",
      activity: "逛集市",
      giftName: "茶叶",
      talkedToday: false,
      alreadyGifted: false,
      timeMinutes: 21 * 60,
      travelMinutes: 20,
    })).toBe("青禾 · 夜深明日访 · 逛集市");
    expect(npcApproachCueHint({
      npcName: " ",
      place: "home",
      currentPlace: "home",
      activity: " ",
      talkedToday: true,
      alreadyGifted: true,
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
    })).toBe("镇民 · 今日完成 · 闲逛");
  });

  it("labels map NPCs with current social action state", () => {
    expect(
      npcMapLabel({
        name: "阿良",
        activity: "看溪水",
        talkedToday: false,
        giftedToday: false,
        giftReady: true,
      }),
    ).toBe("阿良 · 可聊/礼 · 看溪水");
    expect(
      npcMapLabel({
        name: "陈婶",
        activity: "",
        talkedToday: true,
        giftedToday: false,
        giftReady: true,
      }),
    ).toBe("陈婶 · 还能送 · 闲逛");
    expect(
      npcMapLabel({
        name: " ",
        activity: "整理种子",
        talkedToday: false,
        giftedToday: true,
        giftReady: true,
      }),
    ).toBe("镇民 · 已送 · 整理种子");
  });

  it("summarizes NPC schedules into a map-focused social target", () => {
    expect(npcScheduleMapHint({
      entries: [
        {
          name: "阿良",
          place: "town",
          activity: "看溪水",
          talkedToday: false,
          giftedToday: false,
          giftReady: true,
        },
        {
          name: "陈婶",
          place: "farm",
          activity: "看田埂",
          talkedToday: false,
          giftedToday: false,
          giftReady: false,
        },
      ],
      currentPlace: "farm",
      giftReadyCount: 2,
    })).toBe("邻里地图 · 身边1人 · 优先阿良@小镇送礼 · 礼物2件");
    expect(npcScheduleMapHint({
      entries: [
        {
          name: "阿良",
          place: "town",
          activity: "看溪水",
          talkedToday: true,
          giftedToday: true,
          giftReady: false,
        },
        {
          name: "陈婶",
          place: "farm",
          activity: "整理种子",
          talkedToday: false,
          giftedToday: false,
          giftReady: false,
        },
      ],
      currentPlace: "farm",
      giftReadyCount: 0,
    })).toBe("邻里地图 · 身边1人 · 找陈婶@农场聊天 · 整理种子");
    expect(npcScheduleMapHint({
      entries: [
        {
          name: "阿良",
          place: "town",
          activity: "看溪水",
          talkedToday: true,
          giftedToday: true,
          giftReady: false,
        },
      ],
      currentPlace: "farm",
      giftReadyCount: Number.NaN,
    })).toBe("邻里地图 · 身边0人 · 今日社交收尾");
    expect(npcScheduleMapHint({
      entries: [],
      currentPlace: "farm",
      giftReadyCount: Number.NaN,
    })).toBe("邻里地图 · 暂无镇民");
  });

  it("adds route ETA to the neighborhood map when timing is available", () => {
    expect(npcScheduleMapHint({
      entries: [
        {
          name: "阿良",
          place: "town",
          activity: "看溪水",
          talkedToday: false,
          giftedToday: false,
          giftReady: true,
        },
        {
          name: "陈婶",
          place: "farm",
          activity: "看田埂",
          talkedToday: false,
          giftedToday: false,
          giftReady: false,
        },
      ],
      currentPlace: "farm",
      giftReadyCount: 2,
      timeMinutes: 8 * 60,
      travelMinutes: 20,
    })).toBe("邻里地图 · 身边1人 · 优先阿良 · 去小镇08:20送礼 · 礼物2件");
    expect(npcScheduleMapHint({
      entries: [
        {
          name: "陈婶",
          place: "farm",
          activity: "看田埂",
          talkedToday: false,
          giftedToday: false,
          giftReady: true,
        },
      ],
      currentPlace: "farm",
      giftReadyCount: 1,
      timeMinutes: 9 * 60,
      travelMinutes: 20,
    })).toBe("邻里地图 · 身边1人 · 优先陈婶 · 身边送礼 · 礼物1件");
    expect(npcScheduleMapHint({
      entries: [
        {
          name: "青禾",
          place: "shop",
          activity: "整理种子",
          talkedToday: false,
          giftedToday: false,
          giftReady: false,
        },
      ],
      currentPlace: "town",
      giftReadyCount: 0,
      timeMinutes: 10 * 60,
      travelMinutes: 20,
    })).toBe("邻里地图 · 身边0人 · 找青禾 · 去商店10:20聊天 · 整理种子");
  });

  it("discounts seed prices from mastery and farm rating without dropping below one", () => {
    expect(seedPrice(20, 1, 0)).toEqual({ price: 20, discountPercent: 0 });
    expect(seedPrice(20, 3, 0)).toEqual({ price: 19, discountPercent: 4 });
    expect(seedPrice(20, 5, 240)).toEqual({ price: 17, discountPercent: 12 });
    expect(seedPrice(2, 5, 999)).toEqual({ price: 1, discountPercent: 16 });
  });

  it("summarizes crop economics for seed shop decisions", () => {
    expect(cropEconomics({ seedCost: 10, sellPrice: 24, growDays: 2 })).toEqual({
      seedCost: 10,
      sellPrice: 24,
      growDays: 2,
      profit: 14,
      profitPerDay: 7,
    });
    expect(cropEconomics({ seedCost: 20, sellPrice: 5, growDays: 0 })).toMatchObject({
      growDays: 1,
      profit: -15,
      profitPerDay: -15,
    });
    expect(cropEconomics({ seedCost: Number.NaN, sellPrice: -5, growDays: Number.NaN })).toMatchObject({
      seedCost: 0,
      sellPrice: 0,
      growDays: 1,
      profit: 0,
    });
  });

  it("recommends seed shop choices by affordability and profit tempo", () => {
    const options = [
      { cropName: "萝卜", seedCost: 10, sellPrice: 24, growDays: 2 },
      { cropName: "小麦", seedCost: 15, sellPrice: 38, growDays: 3 },
      { cropName: "土豆", seedCost: 20, sellPrice: 56, growDays: 4 },
    ];

    expect(seedShopRecommendationHint({ options, gold: 80, openPlotCount: 4 })).toBe("推荐土豆 · 日利9 · 可播4块");
    expect(seedShopRecommendationHint({ options, gold: 18, openPlotCount: 4 })).toBe("推荐小麦 · 日利7 · 可播1块");
    expect(seedShopRecommendationHint({ options, gold: 5, openPlotCount: 4 })).toBe("萝卜还差5金");
    expect(seedShopRecommendationHint({ options, gold: 80, openPlotCount: 0 })).toBe("先开田 · 再买种");
    expect(seedShopRecommendationHint({ options: [], gold: 80, openPlotCount: 4 })).toBe("暂无种子");
  });

  it("previews seed batch economics for the shop purchase panel", () => {
    expect(seedBatchEconomyHint({
      seedCost: 10,
      sellPrice: 24,
      growDays: 2,
      quantity: 5,
      openPlotCount: 3,
    })).toBe("播3块 · 2天后72金 · 净利42金 · 余2包备货");
    expect(seedBatchEconomyHint({
      seedCost: 10,
      sellPrice: 24,
      growDays: 2,
      quantity: 2,
      openPlotCount: 5,
    })).toBe("播2块 · 2天后48金 · 净利28金");
    expect(seedBatchEconomyHint({
      seedCost: 10,
      sellPrice: 24,
      growDays: 2,
      quantity: 4,
      openPlotCount: 0,
    })).toBe("备货4包 · 2天后净利56金");
    expect(seedBatchEconomyHint({
      seedCost: Number.NaN,
      sellPrice: -1,
      growDays: Number.NaN,
      quantity: Number.NaN,
      openPlotCount: -1,
    })).toBe("暂不买种");
  });

  it("summarizes seed purchasing against gold and open plots", () => {
    expect(seedPurchaseHint({ gold: 9, seedPrice: 10, carriedSeeds: 0, openPlotCount: 3 })).toBe("金币不足 · 还差 1 金");
    expect(seedPurchaseHint({ gold: 50, seedPrice: 10, carriedSeeds: 0, openPlotCount: 0 })).toBe("可买 5 包 · 先开垦空田");
    expect(seedPurchaseHint({ gold: 50, seedPrice: 10, carriedSeeds: 3, openPlotCount: 2 })).toBe("种子够播 · 可买 5 包备货");
    expect(seedPurchaseHint({ gold: 50, seedPrice: 10, carriedSeeds: 1, openPlotCount: 4 })).toBe("可买 5 包 · 可播地还缺 3 包");
    expect(seedPurchaseHint({ gold: Number.NaN, seedPrice: -1, carriedSeeds: -1, openPlotCount: -1 })).toBe("金币不足 · 还差 1 金");
  });

  it("turns each shop shelf into a compact seed decision", () => {
    expect(seedShelfDecisionHint({
      cropName: "萝卜",
      gold: 50,
      seedPrice: 10,
      carriedSeeds: 1,
      openPlotCount: 4,
      selected: true,
    })).toBe("已选萝卜 · 买3补田");
    expect(seedShelfDecisionHint({
      cropName: "土豆",
      gold: 40,
      seedPrice: 20,
      carriedSeeds: 0,
      openPlotCount: 4,
    })).toBe("土豆货架 · 买2补田");
    expect(seedShelfDecisionHint({
      cropName: "小麦",
      gold: 30,
      seedPrice: 15,
      carriedSeeds: 4,
      openPlotCount: 3,
      selected: true,
    })).toBe("已选小麦 · 种子够");
    expect(seedShelfDecisionHint({
      cropName: "土豆",
      gold: 60,
      seedPrice: 20,
      carriedSeeds: 4,
      openPlotCount: 3,
    })).toBe("土豆货架 · 备货3包");
    expect(seedShelfDecisionHint({
      cropName: "萝卜",
      gold: 7,
      seedPrice: 10,
      carriedSeeds: 0,
      openPlotCount: 2,
    })).toBe("萝卜货架 · 差3金");
    expect(seedShelfDecisionHint({
      cropName: " ",
      gold: Number.NaN,
      seedPrice: -1,
      carriedSeeds: Number.NaN,
      openPlotCount: -1,
    })).toBe("作物货架 · 先开田");
  });

  it("previews seed purchase outcome before spending gold", () => {
    expect(seedPurchaseOutcomeHint({
      gold: 52,
      seedPrice: 10,
      requestedQuantity: 5,
      carriedSeeds: 0,
      openPlotCount: 5,
    })).toBe("买 5 包花 50 金 · 余 2 金 · 可播满");
    expect(seedPurchaseOutcomeHint({
      gold: 25,
      seedPrice: 10,
      requestedQuantity: 5,
      carriedSeeds: 1,
      openPlotCount: 5,
    })).toBe("买 2 包花 20 金 · 余 5 金 · 还缺 2 包");
    expect(seedPurchaseOutcomeHint({
      gold: 30,
      seedPrice: 10,
      requestedQuantity: 2,
      carriedSeeds: 0,
      openPlotCount: 0,
    })).toBe("买 2 包花 20 金 · 余 10 金 · 先开田");
    expect(seedPurchaseOutcomeHint({
      gold: Number.NaN,
      seedPrice: -1,
      requestedQuantity: -5,
      carriedSeeds: -1,
      openPlotCount: -1,
    })).toBe("金币不足 · 还差 1 金");
  });

  it("turns seed purchase receipts into immediate next-step guidance", () => {
    expect(seedPurchaseReceiptHint({
      gold: 52,
      seedPrice: 10,
      requestedQuantity: 5,
      carriedSeeds: 0,
      openPlotCount: 5,
      currentPlace: "shop",
      timeMinutes: 9 * 60,
      travelMinutes: 20,
    })).toBe("买 5 包花 50 金 · 余 2 金 · 可播满 · 下一步 · 回农场播 5 块");
    expect(seedPurchaseReceiptHint({
      gold: 35,
      seedPrice: 10,
      requestedQuantity: 1,
      carriedSeeds: 0,
      openPlotCount: 4,
      currentPlace: "shop",
      timeMinutes: 9 * 60,
      travelMinutes: 20,
    })).toBe("买 1 包花 10 金 · 余 25 金 · 还缺 3 包 · 下一步 · 买 2 包 · 回农场");
    expect(seedPurchaseReceiptHint({
      gold: 9,
      seedPrice: 10,
      requestedQuantity: 1,
      carriedSeeds: 0,
      openPlotCount: 3,
      currentPlace: "shop",
      timeMinutes: 9 * 60,
      travelMinutes: 20,
    })).toBe("金币不足 · 还差 1 金");
  });

  it("turns seed inventory and open plots into route decisions", () => {
    expect(seedRouteHint({
      currentPlace: "farm",
      openPlotCount: 4,
      carriedSeeds: 4,
      affordableSeeds: 0,
      timeMinutes: 8 * 60,
      travelMinutes: 20,
    })).toBe("播种 4 块");
    expect(seedRouteHint({
      currentPlace: "town",
      openPlotCount: 5,
      carriedSeeds: 2,
      affordableSeeds: 2,
      timeMinutes: 9 * 60,
      travelMinutes: 20,
    })).toBe("去商店09:20 · 买 2 包");
    expect(seedRouteHint({
      currentPlace: "shop",
      openPlotCount: 5,
      carriedSeeds: 2,
      affordableSeeds: 9,
      timeMinutes: 10 * 60,
      travelMinutes: 20,
    })).toBe("买 3 包 · 回农场");
    expect(seedRouteHint({
      currentPlace: "home",
      openPlotCount: 3,
      carriedSeeds: 0,
      affordableSeeds: 0,
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
    })).toBe("缺种 3 包 · 先赚钱");
    expect(seedRouteHint({
      currentPlace: "farm",
      openPlotCount: -1,
      carriedSeeds: 9,
      affordableSeeds: 9,
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
    })).toBe("先开田 · 再买种");
  });

  it("summarizes seed-to-field readiness from plots seeds energy and place", () => {
    expect(seedFieldReadinessHint({
      openPlotCount: 4,
      carriedSeeds: 4,
      energy: 20,
      seedCost: 2,
      minutesPerAction: 10,
      currentPlace: "farm",
    })).toBe("播种准备 · 田边 · 可播满4块/8体/40分");
    expect(seedFieldReadinessHint({
      openPlotCount: 3,
      carriedSeeds: 5,
      energy: 20,
      seedCost: 2,
      minutesPerAction: 10,
      currentPlace: "shop",
    })).toBe("播种准备 · 回农场 · 可播满3块/6体/30分");
    expect(seedFieldReadinessHint({
      openPlotCount: 5,
      carriedSeeds: 2,
      energy: 20,
      seedCost: 2,
      minutesPerAction: 10,
      currentPlace: "farm",
    })).toBe("播种准备 · 田边 · 可播2块/4体/20分 · 缺3包");
    expect(seedFieldReadinessHint({
      openPlotCount: 4,
      carriedSeeds: 4,
      energy: 3,
      seedCost: 2,
      minutesPerAction: 10,
      currentPlace: "farm",
    })).toBe("播种准备 · 田边 · 可播1块/2体/10分 · 体力卡住");
    expect(seedFieldReadinessHint({
      openPlotCount: 4,
      carriedSeeds: 4,
      energy: 1,
      seedCost: 2,
      minutesPerAction: 10,
      currentPlace: "farm",
    })).toBe("播种准备 · 体力不足需2");
    expect(seedFieldReadinessHint({
      openPlotCount: 0,
      carriedSeeds: 4,
      energy: 20,
      seedCost: 2,
      minutesPerAction: 10,
      currentPlace: "farm",
    })).toBe("播种准备 · 先开田");
    expect(seedFieldReadinessHint({
      openPlotCount: 4,
      carriedSeeds: 0,
      energy: 20,
      seedCost: 2,
      minutesPerAction: 10,
      currentPlace: "farm",
    })).toBe("播种准备 · 先买种");
  });

  it("rewards order streaks with a capped deterministic bonus", () => {
    expect(orderStreakBonus(0)).toBe(0);
    expect(orderStreakBonus(1)).toBe(0);
    expect(orderStreakBonus(2)).toBe(16);
    expect(orderStreakBonus(3)).toBe(34);
    expect(orderStreakBonus(99)).toBe(90);
  });

  it("summarizes order reward value density and streak upside", () => {
    expect(orderRewardSummary({ reward: 60, count: 3, nextStreakBonus: 0 })).toBe("奖60 · 单件20");
    expect(orderRewardSummary({ reward: 61, count: 4, nextStreakBonus: 16 })).toBe("奖61 · 单件15 · 连击+16");
    expect(orderRewardSummary({ reward: Number.NaN, count: 0, nextStreakBonus: -5 })).toBe("奖0 · 单件0");
  });

  it("explains order turn-in payout and where completion is blocked", () => {
    expect(orderTurnInHint({
      backpackCount: 0,
      boxedCount: 0,
      requiredCount: 3,
      reward: 60,
      nextStreakBonus: 0,
      accepted: false,
      completed: false,
    })).toBe("接单后交付 · 奖60");
    expect(orderTurnInHint({
      backpackCount: 2,
      boxedCount: 0,
      requiredCount: 3,
      reward: 60,
      nextStreakBonus: 16,
      accepted: false,
      completed: false,
    })).toBe("接单后交付 · 现有2/3 · 奖60+连击16");
    expect(orderTurnInHint({
      backpackCount: 3,
      boxedCount: 0,
      requiredCount: 3,
      reward: 60,
      nextStreakBonus: 16,
      accepted: true,
      completed: false,
    })).toBe("已备齐 · 再入箱 · 奖60+连击16");
    expect(orderTurnInHint({
      backpackCount: 0,
      boxedCount: 3,
      requiredCount: 3,
      reward: 60,
      nextStreakBonus: 16,
      accepted: true,
      completed: false,
    })).toBe("睡醒交付 · 箱内3/3 · 奖60+连击16");
    expect(orderTurnInHint({
      backpackCount: 1,
      boxedCount: 1,
      requiredCount: 4,
      reward: 60,
      nextStreakBonus: 0,
      accepted: true,
      completed: false,
    })).toBe("还差2 · 交付奖60");
    expect(orderTurnInHint({
      backpackCount: Number.NaN,
      boxedCount: -1,
      requiredCount: 0,
      reward: Number.NaN,
      nextStreakBonus: -1,
      accepted: true,
      completed: true,
    })).toBe("今日已交付");
  });

  it("summarizes the next order action after checking progress", () => {
    expect(orderNextStepHint({
      backpackCount: 0,
      boxedCount: 0,
      requiredCount: 3,
      accepted: false,
      completed: false,
    })).toBe("先去公告板接单");
    expect(orderNextStepHint({
      backpackCount: 1,
      boxedCount: 1,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toBe("继续收集2件");
    expect(orderNextStepHint({
      backpackCount: 3,
      boxedCount: 1,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toBe("把背包3件入箱");
    expect(orderNextStepHint({
      backpackCount: 0,
      boxedCount: 4,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toBe("回家睡觉结算");
    expect(orderNextStepHint({
      backpackCount: Number.NaN,
      boxedCount: -1,
      requiredCount: 0,
      accepted: true,
      completed: true,
    })).toBe("明早看新委托");
  });

  it("summarizes order board interaction prompts with concrete next action", () => {
    expect(orderBoardActionHint({
      cropName: "萝卜",
      backpackCount: 0,
      boxedCount: 0,
      requiredCount: 3,
      accepted: false,
      completed: false,
    })).toBe("公告板 接萝卜单 · 需3件");
    expect(orderBoardActionHint({
      cropName: "萝卜",
      backpackCount: 1,
      boxedCount: 0,
      requiredCount: 3,
      accepted: false,
      completed: false,
    })).toBe("公告板 接萝卜单 · 现有1/3");
    expect(orderBoardActionHint({
      cropName: " ",
      backpackCount: 1,
      boxedCount: 1,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toBe("公告板 还差2 · 继续收集2件");
    expect(orderBoardActionHint({
      cropName: "小麦",
      backpackCount: 3,
      boxedCount: 1,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toBe("公告板 已备齐 · 把背包3件入箱");
    expect(orderBoardActionHint({
      cropName: "小麦",
      backpackCount: Number.NaN,
      boxedCount: -1,
      requiredCount: 0,
      accepted: true,
      completed: true,
    })).toBe("公告板 今日完成");
  });

  it("summarizes order settlement payouts with event and streak context", () => {
    expect(orderSettlementHint({
      orderReward: 102,
      streakBonus: 16,
      eventTitle: "山风集市",
      completed: true,
    })).toBe("山风集市委托 +102金 · 连击+16 · 合计118金");
    expect(orderSettlementHint({
      orderReward: 60,
      streakBonus: 0,
      eventTitle: " ",
      completed: true,
    })).toBe("公告板委托 +60金");
    expect(orderSettlementHint({
      orderReward: Number.NaN,
      streakBonus: -1,
      completed: false,
    })).toBe("委托未交付 · 连击中断");
  });

  it("previews order board decisions before and after accepting", () => {
    expect(orderBoardPreviewHint({
      cropName: "萝卜",
      availableCount: 4,
      requiredCount: 3,
      reward: 60,
      nextStreakBonus: 16,
      accepted: false,
      completed: false,
      timeMinutes: 8 * 60,
    })).toBe("接单即备齐 · 萝卜 3/3 · 76金");
    expect(orderBoardPreviewHint({
      cropName: "土豆",
      availableCount: 1,
      requiredCount: 4,
      reward: 92,
      nextStreakBonus: 0,
      accepted: false,
      completed: false,
      timeMinutes: 9 * 60,
    })).toBe("可接土豆 · 现有1/4 · 还差3 · 92金");
    expect(orderBoardPreviewHint({
      cropName: " ",
      availableCount: 1,
      requiredCount: 3,
      reward: Number.NaN,
      nextStreakBonus: -1,
      accepted: true,
      completed: false,
      timeMinutes: 21 * 60,
    })).toBe("已接作物 · 还差2 · 夜里紧急");
    expect(orderBoardPreviewHint({
      cropName: "胡萝卜",
      availableCount: 0,
      requiredCount: 0,
      reward: 40,
      nextStreakBonus: 0,
      accepted: true,
      completed: true,
      timeMinutes: Number.NaN,
    })).toBe("胡萝卜委托已完成 · 明早刷新");
  });

  it("summarizes order fulfillment progress from available crops", () => {
    expect(orderFulfillmentProgress({
      availableCount: -2,
      requiredCount: 0,
      accepted: false,
      completed: false,
    })).toMatchObject({ status: "open", availableCount: 0, requiredCount: 1, remainingCount: 1, ready: false });
    expect(orderFulfillmentProgress({
      availableCount: 2,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toMatchObject({ status: "in_progress", remainingCount: 2, ready: false });
    expect(orderFulfillmentProgress({
      availableCount: 5,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toMatchObject({ status: "ready", remainingCount: 0, ready: true });
    expect(orderFulfillmentProgress({
      availableCount: 0,
      requiredCount: 4,
      accepted: true,
      completed: true,
    })).toMatchObject({ status: "completed" });
  });

  it("summarizes order contribution from backpack and shipping box", () => {
    expect(orderSourceHint({
      backpackCount: 2,
      boxedCount: 1,
      requiredCount: 4,
      accepted: false,
      completed: false,
    })).toBe("未接单 · 现有 3/4");
    expect(orderSourceHint({
      backpackCount: 2,
      boxedCount: 2,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toBe("已备齐 4/4 · 记得入箱");
    expect(orderSourceHint({
      backpackCount: 0,
      boxedCount: 4,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toBe("箱内备齐 4/4");
    expect(orderSourceHint({
      backpackCount: 1,
      boxedCount: 1,
      requiredCount: 4,
      accepted: true,
      completed: false,
    })).toBe("背包1 · 箱内1 · 还差2");
    expect(orderSourceHint({
      backpackCount: Number.NaN,
      boxedCount: -1,
      requiredCount: 0,
      accepted: true,
      completed: false,
    })).toBe("还差1 · 去种/买");
    expect(orderSourceHint({
      backpackCount: 0,
      boxedCount: 0,
      requiredCount: 4,
      accepted: true,
      completed: true,
    })).toBe("今日已完成");
  });

  it("summarizes order deadline urgency through the day", () => {
    expect(orderDeadlineHint({
      accepted: false,
      completed: false,
      ready: false,
      remainingCount: 3,
      timeMinutes: 9 * 60,
    })).toBe("今日接单 · 睡前结算");
    expect(orderDeadlineHint({
      accepted: true,
      completed: false,
      ready: true,
      remainingCount: 0,
      timeMinutes: 20 * 60,
    })).toBe("已备齐 · 睡前入箱");
    expect(orderDeadlineHint({
      accepted: true,
      completed: false,
      ready: false,
      remainingCount: 2,
      timeMinutes: 18 * 60,
    })).toBe("傍晚收尾 · 还差 2 件");
    expect(orderDeadlineHint({
      accepted: true,
      completed: false,
      ready: false,
      remainingCount: 1,
      timeMinutes: 21 * 60,
    })).toBe("夜里紧急 · 还差 1 件");
    expect(orderDeadlineHint({
      accepted: true,
      completed: true,
      ready: false,
      remainingCount: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("今日已交付");
  });

  it("prioritizes daily advice from urgent order, weather, then low mastery", () => {
    expect(dailyAdvice({
      weather: "sunny",
      orderAccepted: true,
      orderCompleted: false,
      orderStreak: 2,
      lowestMastery: "fishing",
    })).toContain("公告板委托");
    expect(dailyAdvice({
      weather: "rain",
      orderAccepted: false,
      orderCompleted: false,
      orderStreak: 0,
      lowestMastery: "farming",
    })).toContain("省下浇水体力");
    expect(dailyAdvice({
      weather: "sunny",
      orderAccepted: false,
      orderCompleted: false,
      orderStreak: 0,
      lowestMastery: "social",
    })).toContain("镇民");
  });

  it("turns mailbox reading into the next daily step", () => {
    expect(mailboxResultHint({
      message: "欢迎搬来山里。",
      seedBonus: 2,
      nextObjectiveLabel: "接公告板",
    })).toBe("欢迎搬来山里。 · 萝卜种子+2 · 下一步接公告板");
    expect(mailboxResultHint({
      message: "雨天会帮你浇田。",
      seedBonus: 0,
      nextObjectiveLabel: "照看田地",
    })).toBe("雨天会帮你浇田。 · 下一步照看田地");
    expect(mailboxResultHint({
      message: " ",
      seedBonus: Number.NaN,
      nextObjectiveLabel: " ",
    })).toBe("今天没有新信 · 下一步整理农场");
  });

  it("labels day periods from the in-game clock", () => {
    expect(dayPeriod(6 * 60)).toEqual({ id: "morning", label: "上午" });
    expect(dayPeriod(12 * 60)).toEqual({ id: "afternoon", label: "午后" });
    expect(dayPeriod(17 * 60)).toEqual({ id: "evening", label: "傍晚" });
    expect(dayPeriod(21 * 60)).toEqual({ id: "night", label: "夜里" });
    expect(dayPeriod(24 * 60)).toEqual({ id: "late", label: "深夜" });
  });

  it("labels energy status with safe clamping and snack hints", () => {
    expect(energyStatus(100, 100)).toMatchObject({ id: "full", label: "满格", ratio: 1 });
    expect(energyStatus(70, 100)).toMatchObject({ id: "steady", label: "充沛" });
    expect(energyStatus(25, 100)).toMatchObject({ id: "tired", label: "疲惫" });
    expect(energyStatus(10, 100)).toMatchObject({ id: "exhausted", label: "快见底" });
    expect(energyStatus(120, 100)).toMatchObject({ id: "full", ratio: 1 });
    expect(energyStatus(Number.NaN, 0)).toMatchObject({ id: "exhausted", ratio: 0 });
  });

  it("summarizes fishing conditions from weather and time", () => {
    expect(fishingConditionHint({ weather: "sunny", timeMinutes: 19 * 60, pondLights: true })).toBe("夜灯好钓");
    expect(fishingConditionHint({ weather: "rain", timeMinutes: 10 * 60, pondLights: false })).toBe("雨天好鱼");
    expect(fishingConditionHint({ weather: "sunny", timeMinutes: 18 * 60, pondLights: false })).toBe("傍晚鱼活");
    expect(fishingConditionHint({ weather: "mist", timeMinutes: 9 * 60, pondLights: false })).toBe("雾天稳钓");
    expect(fishingConditionHint({ weather: "sunny", timeMinutes: 9 * 60, pondLights: true })).toBe("普通鱼情");
  });

  it("turns weather into a concrete field plan", () => {
    expect(weatherPlanHint({ weather: "rain", plantedCount: 4, dryCount: 4, seedCount: 3 })).toBe("雨天代浇 · 可扩种 3 粒");
    expect(weatherPlanHint({ weather: "rain", plantedCount: 4, dryCount: 4, seedCount: 0 })).toBe("雨天代浇 · 省体力跑镇");
    expect(weatherPlanHint({ weather: "mist", plantedCount: 4, dryCount: 2, seedCount: 0 })).toBe("雾天慢节奏 · 先浇 2 块");
    expect(weatherPlanHint({ weather: "sunny", plantedCount: 4, dryCount: 3, seedCount: 5 })).toBe("晴天要浇 3 块 · 预留体力");
    expect(weatherPlanHint({ weather: "sunny", plantedCount: -1, dryCount: 99, seedCount: Number.NaN })).toBe("晴天稳工 · 采集补金");
  });

  it("combines TV forecast into an actionable summary", () => {
    expect(forecastSummaryHint({
      seasonName: "春季第 3 天",
      weatherName: "雨天",
      weatherNote: "雨水会照看作物。",
      weatherPlan: "雨天代浇 · 可扩种 3 粒",
      advice: "雨天省下浇水体力。",
    })).toBe("明天是春季第 3 天 · 雨天。雨水会照看作物。 雨天代浇 · 可扩种 3 粒。雨天省下浇水体力。");
    expect(forecastSummaryHint({
      seasonName: " ",
      weatherName: " ",
      weatherNote: " ",
      weatherPlan: " ",
      advice: " ",
    })).toBe("明天是明天 · 天气未知。按日志安排一天。 先看田地。保持节奏，睡前记得入箱。");
  });

  it("keeps current weather plan compact for the HUD", () => {
    expect(weatherHudPlanHint({
      weatherName: "雨天",
      weatherPlan: "雨天代浇 · 可扩种 3 粒",
    })).toBe("雨天 · 雨天代浇 · 可扩种 3 粒");
    expect(weatherHudPlanHint({
      weatherName: " ",
      weatherPlan: " ",
    })).toBe("天气 · 按日志安排");
    expect(weatherHudPlanHint({
      weatherName: "晴天",
      weatherPlan: "晴天要浇 12 块 · 预留体力 · 先吃点心",
    })).toBe("晴天 · 晴天要浇 12 块 · 预留体力");
  });

  it("summarizes travel purpose from current loop needs", () => {
    expect(travelPlanHint({
      target: "town",
      orderNeedsBoard: true,
      giftReadyCount: 2,
      seedShortage: 0,
      sellableInventoryCount: 0,
      timeMinutes: 10 * 60,
    })).toBe("公告板优先");
    expect(travelPlanHint({
      target: "shop",
      orderNeedsBoard: false,
      giftReadyCount: 0,
      seedShortage: 3,
      sellableInventoryCount: 0,
      timeMinutes: 10 * 60,
    })).toBe("补种子 3 包");
    expect(travelPlanHint({
      target: "farm",
      orderNeedsBoard: false,
      giftReadyCount: 0,
      seedShortage: 0,
      sellableInventoryCount: 4,
      timeMinutes: 17 * 60,
    })).toBe("回农场入箱 4 件");
    expect(travelPlanHint({
      target: "home",
      orderNeedsBoard: false,
      giftReadyCount: 0,
      seedShortage: 0,
      sellableInventoryCount: 0,
      timeMinutes: 22 * 60,
    })).toBe("回家睡觉");
  });

  it("confirms travel arrival with destination time and next purpose", () => {
    expect(travelArrivalHint({
      target: "town",
      plan: "公告板优先",
      arrivalTimeMinutes: 8 * 60 + 15,
    })).toBe("抵达小镇街道 · 08:15 · 公告板优先");
    expect(travelArrivalHint({
      target: "home",
      plan: "回家睡觉",
      arrivalTimeMinutes: 21 * 60,
    })).toBe("抵达山间小屋 · 21:00 · 回家睡觉 · 夜深了");
    expect(travelArrivalHint({
      target: "shop",
      plan: "  ",
      arrivalTimeMinutes: Number.NaN,
    })).toBe("抵达种子商店 · 00:00 · 整理行程");
  });

  it("adds ambient arrival cues by place weather and urgency", () => {
    expect(travelArrivalAmbientHint({
      target: "town",
      plan: "公告板优先",
      arrivalTimeMinutes: 10 * 60,
      weather: "sunny",
    })).toBe("到达氛围 · 镇口人声 · 脚步落稳 · 公告板优先");
    expect(travelArrivalAmbientHint({
      target: "farm",
      plan: "回农场入箱",
      arrivalTimeMinutes: 16 * 60,
      weather: "rain",
    })).toBe("到达氛围 · 泥土湿润 · 雨声铺路 · 回农场入箱");
    expect(travelArrivalAmbientHint({
      target: "home",
      plan: "回家整理",
      arrivalTimeMinutes: 21 * 60,
      weather: "sunny",
    })).toBe("到达氛围 · 屋灯暖着 · 虫鸣收尾 · 直接睡");
    expect(travelArrivalAmbientHint({
      target: "shop",
      plan: " ",
      arrivalTimeMinutes: Number.NaN,
      weather: "mist",
    })).toBe("到达氛围 · 柜台木铃 · 雾气压低 · 整理行程");
  });

  it("connects travel arrival purpose to the active objective", () => {
    expect(travelObjectiveArrivalPlan({
      plan: "公告板优先",
      objectiveLabel: "接公告板",
      arrivedAtObjective: true,
    })).toBe("接公告板 · 公告板优先");
    expect(travelObjectiveArrivalPlan({
      plan: "拜访/采集",
      objectiveLabel: "照看田地",
      arrivedAtObjective: false,
    })).toBe("拜访/采集");
    expect(travelObjectiveArrivalPlan({
      plan: "   ",
      objectiveLabel: "   ",
      arrivedAtObjective: true,
    })).toBe("整理行程");
  });

  it("marks transition prompts that lead to the current objective", () => {
    expect(transitionObjectivePromptHint({
      plan: "公告板优先",
      objectiveLabel: "接公告板",
      targetIsObjective: true,
    })).toBe("目标接公告板 · 公告板优先");
    expect(transitionObjectivePromptHint({
      plan: "拜访/采集",
      objectiveLabel: "照看田地",
      targetIsObjective: false,
    })).toBe("拜访/采集");
    expect(transitionObjectivePromptHint({
      plan: " ",
      objectiveLabel: " ",
      targetIsObjective: true,
    })).toBe("整理行程");
  });

  it("flags risky transition arrival times before leaving", () => {
    expect(transitionArrivalRiskHint({
      timeMinutes: 20 * 60,
      travelMinutes: 15,
    })).toBe("抵达安全");
    expect(transitionArrivalRiskHint({
      timeMinutes: 20 * 60 + 55,
      travelMinutes: 15,
    })).toBe("抵达夜深");
    expect(transitionArrivalRiskHint({
      timeMinutes: 23 * 60 + 55,
      travelMinutes: 10,
    })).toBe("抵达已过午夜");
  });

  it("summarizes a departure checklist before map transitions", () => {
    expect(transitionDepartureChecklistHint({
      target: "town",
      sellableInventoryCount: 0,
      giftReadyCount: 2,
      seedShortage: 0,
      timeMinutes: 9 * 60,
    })).toBe("出发前 · 带礼2件");
    expect(transitionDepartureChecklistHint({
      target: "shop",
      sellableInventoryCount: 0,
      giftReadyCount: 0,
      seedShortage: 3,
      timeMinutes: 10 * 60,
    })).toBe("出发前 · 补种缺3包");
    expect(transitionDepartureChecklistHint({
      target: "farm",
      sellableInventoryCount: 4,
      giftReadyCount: 0,
      seedShortage: 0,
      timeMinutes: 16 * 60,
    })).toBe("出发前 · 回农场入箱4件");
    expect(transitionDepartureChecklistHint({
      target: "home",
      sellableInventoryCount: 4,
      giftReadyCount: 2,
      seedShortage: 3,
      timeMinutes: 21 * 60,
    })).toBe("出发前 · 回家睡觉");
    expect(transitionDepartureChecklistHint({
      target: "town",
      sellableInventoryCount: Number.NaN,
      giftReadyCount: Number.NaN,
      seedShortage: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("出发前 · 路线清晰");
  });

  it("previews transition travel with ETA and objective context", () => {
    expect(transitionTravelPromptHint({
      actionLabel: "去小镇",
      plan: "公告板优先",
      objectiveLabel: "接公告板",
      targetIsObjective: true,
      timeMinutes: 8 * 60,
      travelMinutes: 15,
    })).toBe("去小镇 15分 到08:15 · 目标接公告板 · 公告板优先");
    expect(transitionTravelPromptHint({
      actionLabel: "回农场",
      plan: "回农场照看田",
      objectiveLabel: "接公告板",
      targetIsObjective: false,
      timeMinutes: 23 * 60 + 50,
      travelMinutes: 20,
    })).toBe("回农场 20分 到00:10 · 回农场照看田 · 抵达已过午夜");
    expect(transitionTravelPromptHint({
      actionLabel: " ",
      plan: " ",
      objectiveLabel: " ",
      targetIsObjective: true,
      timeMinutes: Number.NaN,
      travelMinutes: -1,
    })).toBe("移动 0分 到00:00 · 整理行程");
    expect(transitionTravelPromptHint({
      actionLabel: "去小镇",
      plan: "带礼拜访 2 件",
      objectiveLabel: "拜访邻里",
      targetIsObjective: true,
      timeMinutes: 9 * 60,
      travelMinutes: 20,
      departureHint: "出发前 · 带礼2件",
    })).toBe("去小镇 20分 到09:20 · 目标拜访邻里 · 带礼拜访 2 件 · 出发前 · 带礼2件");
  });

  it("prioritizes the next daily objective through the core loop", () => {
    const base = {
      mailRead: true,
      orderAccepted: true,
      orderCompleted: false,
      plantedCount: 3,
      wateredCount: 3,
      socialDone: true,
      shippedCount: 1,
      timeMinutes: 16 * 60,
      energy: 60,
    };

    expect(dailyObjectiveHint({ ...base, mailRead: false }).id).toBe("mail");
    expect(dailyObjectiveHint({ ...base, orderAccepted: false }).id).toBe("order");
    expect(dailyObjectiveHint({ ...base, plantedCount: 0, wateredCount: 0 }).id).toBe("field");
    expect(dailyObjectiveHint({ ...base, wateredCount: 1 }).detail).toContain("还要浇 2 块");
    expect(dailyObjectiveHint({ ...base, socialDone: false }).id).toBe("social");
    expect(dailyObjectiveHint({ ...base, shippedCount: 0 }).id).toBe("shipping");
    expect(dailyObjectiveHint({ ...base, timeMinutes: 22 * 60 }).id).toBe("sleep");
    expect(dailyObjectiveHint(base).id).toBe("free");
  });

  it("turns morning settlement into a first-action plan", () => {
    expect(dayStartPlanHint({
      objectiveLabel: "读信看天",
      objectiveDetail: "先确认邮箱和天气",
      weather: "sunny",
      netGold: 156,
      eventTitle: "山风集市",
    })).toBe("晴天开局 · 先读信看天（先确认邮箱和天气） · 昨净+156金 · 今日山风集市");
    expect(dayStartPlanHint({
      objectiveLabel: "照看田地",
      objectiveDetail: "还要浇 2 块",
      weather: "rain",
      netGold: 0,
    })).toBe("雨天开局 · 先照看田地（还要浇 2 块） · 昨夜无收入");
    expect(dayStartPlanHint({
      objectiveLabel: "  ",
      objectiveDetail: "  ",
      weather: "mist",
      netGold: Number.NaN,
      eventTitle: "  ",
    })).toBe("雾天开局 · 先整理农场 · 昨夜无收入");
  });

  it("routes the daybreak plan from home to the first objective", () => {
    expect(dayBreakRouteHint({
      objectiveId: "mail",
      objectiveLabel: "读信看天",
      timeMinutes: 6 * 60,
      travelMinutes: 15,
    })).toBe("就地处理 · 小屋 · 读信看天");
    expect(dayBreakRouteHint({
      objectiveId: "order",
      objectiveLabel: "接公告板",
      timeMinutes: 6 * 60,
      travelMinutes: 15,
    })).toBe("小屋→小镇 · 到06:15 · 接公告板");
    expect(dayBreakRouteHint({
      objectiveId: "field",
      objectiveLabel: "照看田地",
      timeMinutes: 6 * 60,
      travelMinutes: 15,
    })).toBe("小屋→农场 · 到06:15 · 照看田地");
  });

  it("turns the day start state into a first action shortcut", () => {
    expect(dayStartFirstActionHint({
      objectiveId: "mail",
      weather: "sunny",
      seedCount: 0,
      openPlotCount: 0,
      giftReadyCount: 0,
      sellableInventoryCount: 0,
    })).toBe("清晨 · 先读邮箱/天气");
    expect(dayStartFirstActionHint({
      objectiveId: "order",
      weather: "mist",
      seedCount: 0,
      openPlotCount: 0,
      giftReadyCount: 0,
      sellableInventoryCount: 0,
    })).toBe("清晨 · 去公告板接委托");
    expect(dayStartFirstActionHint({
      objectiveId: "field",
      weather: "rain",
      seedCount: 3,
      openPlotCount: 2,
      giftReadyCount: 0,
      sellableInventoryCount: 0,
    })).toBe("清晨 · 雨天免浇，收获/播种");
    expect(dayStartFirstActionHint({
      objectiveId: "field",
      weather: "sunny",
      seedCount: 3,
      openPlotCount: 2,
      giftReadyCount: 0,
      sellableInventoryCount: 0,
    })).toBe("清晨 · 选种播2块");
    expect(dayStartFirstActionHint({
      objectiveId: "social",
      weather: "sunny",
      seedCount: 0,
      openPlotCount: 0,
      giftReadyCount: 2,
      sellableInventoryCount: 0,
      eventTitle: "山风集市",
    })).toBe("清晨 · 带2份礼物去山风集市");
    expect(dayStartFirstActionHint({
      objectiveId: "shipping",
      weather: "sunny",
      seedCount: Number.NaN,
      openPlotCount: Number.NaN,
      giftReadyCount: Number.NaN,
      sellableInventoryCount: 4,
    })).toBe("清晨 · 睡前入箱4件");
    expect(dayStartFirstActionHint({
      objectiveId: "free",
      weather: "mist",
      seedCount: Number.NaN,
      openPlotCount: Number.NaN,
      giftReadyCount: Number.NaN,
      sellableInventoryCount: Number.NaN,
      eventTitle: "  ",
    })).toBe("清晨 · 按日志推进");
  });

  it("marks the active map with current objective destination", () => {
    expect(objectiveMapMarkerHint({
      objectiveLabel: "照看田地",
      currentPlace: "farm",
      targetPlace: "farm",
    })).toBe("目标在这里 · 照看田地");
    expect(objectiveMapMarkerHint({
      objectiveLabel: "接公告板",
      currentPlace: "home",
      targetPlace: "town",
    })).toBe("目标接公告板 · 去小镇");
    expect(objectiveMapMarkerHint({
      objectiveLabel: "   ",
      currentPlace: "shop",
      targetPlace: "home",
    })).toBe("目标当前目标 · 去小屋");
  });

  it("adds ETA and late risk to objective map markers when timing is known", () => {
    expect(objectiveMapMarkerHint({
      objectiveLabel: "接公告板",
      currentPlace: "farm",
      targetPlace: "town",
      timeMinutes: 8 * 60,
      travelMinutes: 15,
    })).toBe("目标接公告板 · 去小镇08:15");
    expect(objectiveMapMarkerHint({
      objectiveLabel: "回家睡觉",
      currentPlace: "town",
      targetPlace: "home",
      timeMinutes: 21 * 60,
      travelMinutes: 15,
    })).toBe("目标回家睡觉 · 去小屋21:15 · 夜深");
    expect(objectiveMapMarkerHint({
      objectiveLabel: "照看田地",
      currentPlace: "farm",
      targetPlace: "farm",
      timeMinutes: 21 * 60,
      travelMinutes: 15,
    })).toBe("目标在这里 · 照看田地");
    expect(objectiveMapMarkerHint({
      objectiveLabel: " ",
      currentPlace: "shop",
      targetPlace: "farm",
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
    })).toBe("目标当前目标 · 去农场00:00");
  });

  it("adds an immediate map action line for current objectives", () => {
    expect(objectiveMapActionHint({
      objectiveLabel: "照看田地",
      objectiveDetail: "还要浇 2 块",
      currentPlace: "farm",
      targetPlace: "farm",
      timeMinutes: 8 * 60,
      travelMinutes: 15,
    })).toBe("在这里 · 照看田地 · 还要浇 2 块");
    expect(objectiveMapActionHint({
      objectiveLabel: "接公告板",
      objectiveDetail: "去小镇公告板",
      currentPlace: "farm",
      targetPlace: "town",
      timeMinutes: 8 * 60,
      travelMinutes: 15,
    })).toBe("去小镇 · 到08:15 · 接公告板");
    expect(objectiveMapActionHint({
      objectiveLabel: "回家睡觉",
      objectiveDetail: "确认入箱",
      currentPlace: "town",
      targetPlace: "home",
      timeMinutes: 21 * 60,
      travelMinutes: 15,
    })).toBe("去小屋 · 到21:15 · 夜深");
    expect(objectiveMapActionHint({
      objectiveLabel: "  ",
      objectiveDetail: "这是一段很长很长的目标详情需要被截断",
      currentPlace: "shop",
      targetPlace: "shop",
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
    })).toBe("在这里 · 当前目标 · 这是一段很长很长的目标详情");
  });

  it("keeps the current objective compact for the HUD", () => {
    expect(objectiveHudSummaryHint({
      objectiveLabel: "照看田地",
      objectiveDetail: "还要浇 2 块",
    })).toBe("目标 照看田地 · 还要浇 2 块");
    expect(objectiveHudSummaryHint({
      objectiveLabel: "自由经营",
      objectiveDetail: "",
    })).toBe("目标 自由经营");
    expect(objectiveHudSummaryHint({
      objectiveLabel: " ",
      objectiveDetail: "这是一段很长很长的目标详情需要被截断",
    })).toBe("目标 当前目标 · 这是一段很长很长的目标详情需要");
  });

  it("turns calendar events into route planning hints", () => {
    expect(calendarPlanHint({
      eventTitle: "山风集市",
      daysUntil: 0,
      currentPlace: "farm",
      timeMinutes: 8 * 60,
    })).toBe("今日集市 · 去小镇看委托");
    expect(calendarPlanHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "farm",
      timeMinutes: 18 * 60,
    })).toBe("夜灯正亮 · 去池塘抛竿");
    expect(calendarPlanHint({
      eventTitle: "邻里茶会",
      daysUntil: 0,
      currentPlace: "town",
      timeMinutes: 12 * 60,
      giftReadyCount: 2,
    })).toBe("今日茶会 · 带礼拜访 2 件");
    expect(calendarPlanHint({
      eventTitle: "山风集市",
      daysUntil: 2,
      currentPlace: "home",
      timeMinutes: Number.NaN,
    })).toBe("2天后集市 · 留作物冲订单");
    expect(calendarPlanHint({
      eventTitle: "  ",
      daysUntil: Number.NaN,
      currentPlace: "farm",
      timeMinutes: Number.NaN,
    })).toBe("今日无特别安排 · 按日志推进");
  });

  it("turns calendar events into concrete action or prep hints", () => {
    expect(calendarEventActionHint({
      eventTitle: "山风集市",
      daysUntil: 0,
      currentPlace: "farm",
      giftReadyCount: 0,
      orderAccepted: false,
      sellableInventoryCount: 0,
      energy: 90,
      timeMinutes: 9 * 60,
    })).toBe("行动 · 去小镇公告板");
    expect(calendarEventActionHint({
      eventTitle: "山风集市",
      daysUntil: 0,
      currentPlace: "town",
      giftReadyCount: 0,
      orderAccepted: true,
      sellableInventoryCount: 3,
      energy: 90,
      timeMinutes: 9 * 60,
    })).toBe("行动 · 留作物入箱");
    expect(calendarEventActionHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "home",
      giftReadyCount: 0,
      orderAccepted: false,
      sellableInventoryCount: 0,
      energy: 42,
      timeMinutes: 17 * 60,
    })).toBe("行动 · 傍晚留42体钓鱼");
    expect(calendarEventActionHint({
      eventTitle: "邻里茶会",
      daysUntil: 0,
      currentPlace: "town",
      giftReadyCount: 2,
      orderAccepted: false,
      sellableInventoryCount: 0,
      energy: 80,
      timeMinutes: 12 * 60,
    })).toBe("行动 · 送礼2件");
    expect(calendarEventActionHint({
      eventTitle: "邻里茶会",
      daysUntil: 2,
      currentPlace: "farm",
      giftReadyCount: 0,
      orderAccepted: false,
      sellableInventoryCount: 0,
      energy: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("准备 · 采集作礼物");
    expect(calendarEventActionHint({
      eventTitle: " ",
      daysUntil: Number.NaN,
      currentPlace: "farm",
      giftReadyCount: -1,
      orderAccepted: false,
      sellableInventoryCount: -1,
      energy: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("行动 · 按日志推进");
  });

  it("turns calendar events into destination route hints", () => {
    expect(calendarEventRouteHint({
      eventTitle: "山风集市",
      daysUntil: 0,
      currentPlace: "farm",
      timeMinutes: 8 * 60,
      travelMinutes: 15,
    })).toBe("今日路线 · 去小镇到08:15 · 接公告板");
    expect(calendarEventRouteHint({
      eventTitle: "邻里茶会",
      daysUntil: 0,
      currentPlace: "town",
      timeMinutes: 12 * 60,
      travelMinutes: 15,
      giftReadyCount: 2,
    })).toBe("今日路线 · 已在小镇 · 带礼2件");
    expect(calendarEventRouteHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "town",
      timeMinutes: 17 * 60,
      travelMinutes: 15,
    })).toBe("今日路线 · 去农场到17:15 · 18:00后池塘");
    expect(calendarEventRouteHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "farm",
      timeMinutes: 18 * 60,
      travelMinutes: 15,
    })).toBe("今日路线 · 已在农场 · 池塘抛竿");
    expect(calendarEventRouteHint({
      eventTitle: "邻里茶会",
      daysUntil: 2,
      currentPlace: "home",
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
      giftReadyCount: 3,
    })).toBe("2天后路线 · 备礼3件");
  });

  it("summarizes calendar event urgency for the quest slip", () => {
    expect(calendarEventUrgencyHint({
      eventTitle: "山风集市",
      daysUntil: 0,
      currentPlace: "farm",
      timeMinutes: 8 * 60,
      travelMinutes: 20,
      sellableInventoryCount: 3,
    })).toBe("日历 · 集市 · 去小镇08:20");
    expect(calendarEventUrgencyHint({
      eventTitle: "山风集市",
      daysUntil: 0,
      currentPlace: "farm",
      timeMinutes: 21 * 60,
      travelMinutes: 20,
      sellableInventoryCount: 3,
    })).toBe("日历 · 山风集市将错过 · 明日复盘");
    expect(calendarEventUrgencyHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "town",
      timeMinutes: 17 * 60,
      travelMinutes: 20,
      energy: 42,
    })).toBe("日历 · 夜灯18:00 · 留42体");
    expect(calendarEventUrgencyHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "farm",
      timeMinutes: 18 * 60,
      travelMinutes: 20,
      energy: 42,
    })).toBe("日历 · 夜灯进行中 · 池塘");
    expect(calendarEventUrgencyHint({
      eventTitle: "邻里茶会",
      daysUntil: 2,
      currentPlace: "home",
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
      giftReadyCount: 2,
    })).toBe("日历 · 2天后茶会 · 留2礼");
    expect(calendarEventUrgencyHint({
      eventTitle: " ",
      daysUntil: Number.NaN,
      currentPlace: "farm",
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
    })).toBe("日历 · 今日自由经营");
  });

  it("connects calendar events with social preparation", () => {
    expect(calendarSocialPrepHint({
      eventTitle: "邻里茶会",
      daysUntil: 2,
      currentPlace: "farm",
      giftReadyCount: 2,
      samePlaceCount: 0,
      talkedToday: false,
      giftedToday: false,
      timeMinutes: 10 * 60,
    })).toBe("茶会准备 · 留2份礼");
    expect(calendarSocialPrepHint({
      eventTitle: "邻里茶会",
      daysUntil: 0,
      currentPlace: "town",
      giftReadyCount: 2,
      samePlaceCount: 1,
      talkedToday: false,
      giftedToday: false,
      timeMinutes: 12 * 60,
    })).toBe("茶会行动 · 送2份礼");
    expect(calendarSocialPrepHint({
      eventTitle: "邻里茶会",
      daysUntil: 0,
      currentPlace: "farm",
      giftReadyCount: 0,
      samePlaceCount: 0,
      talkedToday: false,
      giftedToday: false,
      timeMinutes: 12 * 60,
    })).toBe("茶会行动 · 先聊天采礼");
    expect(calendarSocialPrepHint({
      eventTitle: "山风集市",
      daysUntil: 0,
      currentPlace: "farm",
      giftReadyCount: 2,
      samePlaceCount: 1,
      talkedToday: false,
      giftedToday: false,
      timeMinutes: 12 * 60,
    })).toBe("社交 · 身边1人可送");
    expect(calendarSocialPrepHint({
      eventTitle: " ",
      daysUntil: Number.NaN,
      currentPlace: "home",
      giftReadyCount: 0,
      samePlaceCount: 0,
      talkedToday: true,
      giftedToday: false,
      timeMinutes: 14 * 60,
    })).toBe("社交 · 明日再带礼");
    expect(calendarSocialPrepHint({
      eventTitle: " ",
      daysUntil: Number.NaN,
      currentPlace: "home",
      giftReadyCount: Number.NaN,
      samePlaceCount: Number.NaN,
      talkedToday: false,
      giftedToday: false,
      timeMinutes: 21 * 60,
    })).toBe("社交 · 夜深明日访");
    expect(calendarSocialPrepHint({
      eventTitle: "邻里茶会",
      daysUntil: 0,
      currentPlace: "town",
      giftReadyCount: 2,
      samePlaceCount: 1,
      talkedToday: true,
      giftedToday: true,
      timeMinutes: 12 * 60,
    })).toBe("社交 · 今日已送礼");
  });

  it("summarizes festival readiness from inventory, energy and location", () => {
    expect(festivalReadinessHint({
      eventTitle: "山风集市",
      daysUntil: 2,
      currentPlace: "farm",
      sellableInventoryCount: 3,
      giftReadyCount: 0,
      energy: 80,
      timeMinutes: 9 * 60,
    })).toBe("节日准备 · 留3件作物");
    expect(festivalReadinessHint({
      eventTitle: "山风集市",
      daysUntil: 0,
      currentPlace: "town",
      sellableInventoryCount: 0,
      giftReadyCount: 0,
      energy: 80,
      timeMinutes: 9 * 60,
    })).toBe("节日就绪 · 公告板顺路");
    expect(festivalReadinessHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "farm",
      sellableInventoryCount: 0,
      giftReadyCount: 0,
      energy: 42,
      timeMinutes: 18 * 60,
    })).toBe("节日就绪 · 池塘抛竿");
    expect(festivalReadinessHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "town",
      sellableInventoryCount: 0,
      giftReadyCount: 0,
      energy: 30,
      timeMinutes: 17 * 60,
    })).toBe("节日准备 · 傍晚前留30体");
    expect(festivalReadinessHint({
      eventTitle: "邻里茶会",
      daysUntil: 0,
      currentPlace: "farm",
      sellableInventoryCount: 0,
      giftReadyCount: 2,
      energy: 80,
      timeMinutes: 12 * 60,
    })).toBe("节日行动 · 去小镇带礼");
    expect(festivalReadinessHint({
      eventTitle: " ",
      daysUntil: Number.NaN,
      currentPlace: "home",
      sellableInventoryCount: Number.NaN,
      giftReadyCount: Number.NaN,
      energy: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("节日 · 按日志参与");
  });

  it("turns festival readiness into concrete checklist items", () => {
    expect(festivalChecklistHint({
      eventTitle: "山风集市",
      daysUntil: 2,
      currentPlace: "farm",
      sellableInventoryCount: 3,
      giftReadyCount: 0,
      energy: 80,
      timeMinutes: 9 * 60,
      travelMinutes: 15,
    })).toBe("清单 · 留作物3件");
    expect(festivalChecklistHint({
      eventTitle: "山风集市",
      daysUntil: 0,
      currentPlace: "farm",
      sellableInventoryCount: 0,
      giftReadyCount: 0,
      energy: 80,
      timeMinutes: 9 * 60,
      travelMinutes: 15,
    })).toBe("清单 · 去小镇09:15");
    expect(festivalChecklistHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "farm",
      sellableInventoryCount: 0,
      giftReadyCount: 0,
      energy: 42,
      timeMinutes: 17 * 60,
      travelMinutes: 15,
    })).toBe("清单 · 18:00池塘 · 留42体");
    expect(festivalChecklistHint({
      eventTitle: "溪畔夜灯",
      daysUntil: 0,
      currentPlace: "town",
      sellableInventoryCount: 0,
      giftReadyCount: 0,
      energy: 42,
      timeMinutes: 18 * 60,
      travelMinutes: 15,
    })).toBe("清单 · 回农场18:15");
    expect(festivalChecklistHint({
      eventTitle: "邻里茶会",
      daysUntil: 0,
      currentPlace: "town",
      sellableInventoryCount: 0,
      giftReadyCount: 2,
      energy: 80,
      timeMinutes: 12 * 60,
      travelMinutes: 15,
    })).toBe("清单 · 送礼2件");
    expect(festivalChecklistHint({
      eventTitle: "邻里茶会",
      daysUntil: 0,
      currentPlace: "farm",
      sellableInventoryCount: 0,
      giftReadyCount: 0,
      energy: 80,
      timeMinutes: 12 * 60,
      travelMinutes: 15,
    })).toBe("清单 · 先采礼1件");
    expect(festivalChecklistHint({
      eventTitle: " ",
      daysUntil: Number.NaN,
      currentPlace: "home",
      sellableInventoryCount: Number.NaN,
      giftReadyCount: Number.NaN,
      energy: Number.NaN,
      timeMinutes: Number.NaN,
      travelMinutes: Number.NaN,
    })).toBe("清单 · 看日历");
  });

  it("summarizes journal route focus from current place to objective target", () => {
    expect(objectiveRouteHint({
      objectiveLabel: "接公告板",
      currentPlace: "farm",
      targetPlace: "town",
      timeMinutes: 8 * 60,
      travelMinutes: 15,
    })).toBe("农场→小镇 · 到08:15 · 接公告板");
    expect(objectiveRouteHint({
      objectiveLabel: "照看田地",
      currentPlace: "farm",
      targetPlace: "farm",
      timeMinutes: 10 * 60,
      travelMinutes: 15,
    })).toBe("就地处理 · 农场 · 照看田地");
    expect(objectiveRouteHint({
      objectiveLabel: "回家睡觉",
      currentPlace: "town",
      targetPlace: "home",
      timeMinutes: 21 * 60,
      travelMinutes: 15,
    })).toBe("小镇→小屋 · 到21:15 · 回家睡觉 · 夜深");
    expect(objectiveRouteHint({
      objectiveLabel: "  ",
      currentPlace: "shop",
      targetPlace: "farm",
      timeMinutes: Number.NaN,
      travelMinutes: -1,
    })).toBe("商店→农场 · 到00:00 · 当前目标");
  });

  it("surfaces active story clues with route and trigger hints", () => {
    expect(questClueRouteHint({
      questTitle: "接下第一张委托",
      questHint: "沿南边山路去小镇公告板。",
      completedCount: 1,
      totalCount: 8,
      complete: false,
      currentPlace: "farm",
      targetPlace: "town",
      timeMinutes: 8 * 60,
      travelMinutes: 15,
    })).toBe("线索 1/8 · 先去地点 · 农场→小镇 · 到08:15 · 接下第一张委托 · 沿南边山路去小镇公告板。");
    expect(questClueRouteHint({
      questTitle: "翻开一块地",
      questHint: "选锄头，对农田按 E。",
      completedCount: 2,
      totalCount: 8,
      complete: false,
      currentPlace: "farm",
      targetPlace: "farm",
      timeMinutes: 10 * 60,
      travelMinutes: 15,
    })).toBe("线索 2/8 · 就地触发 · 就地处理 · 农场 · 翻开一块地 · 选锄头，对农田按 E。");
    expect(questClueRouteHint({
      questTitle: " ",
      questHint: " ",
      completedCount: Number.NaN,
      totalCount: Number.NaN,
      complete: false,
      currentPlace: "shop",
      targetPlace: "farm",
      timeMinutes: Number.NaN,
      travelMinutes: -1,
    })).toBe("线索 0/1 · 先去地点 · 商店→农场 · 到00:00 · 当前线索 · 按日志推进");
    expect(questClueRouteHint({
      questTitle: "认识一位邻里",
      questHint: "靠近 NPC 按 E 聊天，或按 G 送礼。",
      completedCount: 8,
      totalCount: 8,
      complete: true,
      currentPlace: "town",
      targetPlace: "town",
      timeMinutes: 12 * 60,
      travelMinutes: 15,
    })).toBe("线索完成 8/8 · 自由经营");
  });

  it("prioritizes bedtime warnings for orders, late time, then low energy", () => {
    expect(bedtimeWarning({
      orderAccepted: true,
      orderCompleted: false,
      shippedForOrder: 1,
      orderCount: 3,
      timeMinutes: 25 * 60,
      energy: 4,
    })).toContain("还差 2 件");
    expect(bedtimeWarning({
      orderAccepted: false,
      orderCompleted: false,
      shippedForOrder: 0,
      orderCount: 0,
      timeMinutes: 24 * 60,
      energy: 40,
    })).toContain("很晚");
    expect(bedtimeWarning({
      orderAccepted: false,
      orderCompleted: false,
      shippedForOrder: 0,
      orderCount: 0,
      timeMinutes: 18 * 60,
      energy: 12,
      sellableInventoryCount: 9,
    })).toContain("体力快见底");
    expect(bedtimeWarning({
      orderAccepted: false,
      orderCompleted: false,
      shippedForOrder: 0,
      orderCount: 0,
      timeMinutes: 18 * 60,
      energy: 80,
      sellableInventoryCount: 4,
    })).toContain("背包还有 4 件");
  });

  it("summarizes the bedtime checklist compactly", () => {
    expect(bedtimeChecklistHint({
      orderAccepted: true,
      orderCompleted: false,
      orderReady: false,
      shippedCount: 2,
      sellableInventoryCount: 3,
      energy: 9,
      timeMinutes: 24 * 60,
    })).toBe("委托未齐 · 箱内2件 · 背包3件可售 · 体力低 · 深夜");
    expect(bedtimeChecklistHint({
      orderAccepted: true,
      orderCompleted: false,
      orderReady: true,
      shippedCount: 4,
      sellableInventoryCount: 0,
      energy: 40,
      timeMinutes: 20 * 60,
    })).toBe("委托可交 · 箱内4件");
    expect(bedtimeChecklistHint({
      orderAccepted: false,
      orderCompleted: false,
      orderReady: false,
      shippedCount: 0,
      sellableInventoryCount: 0,
      energy: 80,
      timeMinutes: 18 * 60,
    })).toBe("可安心睡");
  });

  it("summarizes bedtime readiness with settlement and late-night nudges", () => {
    expect(bedtimeReadinessHint({
      checklist: "委托可交 · 箱内4件",
      expectedGold: 156,
      orderWillComplete: true,
      timeMinutes: 21 * 60 + 20,
    })).toBe("委托可交 · 箱内4件 · 睡醒+156金 · 委托连击保留 · 夜深建议睡 · 明早满体力");
    expect(bedtimeReadinessHint({
      checklist: "可安心睡",
      expectedGold: 0,
      orderWillComplete: false,
      timeMinutes: 18 * 60,
    })).toBe("可安心睡 · 明早满体力");
    expect(bedtimeReadinessHint({
      checklist: "   ",
      expectedGold: Number.NaN,
      orderWillComplete: false,
      timeMinutes: 24 * 60,
    })).toBe("可安心睡 · 马上睡防昏倒 · 明早满体力");
  });

  it("reminds players to ship backpack sellables before sleeping", () => {
    expect(bedtimeShippingReminderHint({
      sellableInventoryCount: 3,
      sellableInventoryGold: 72,
      boxedItemCount: 1,
      boxedGold: 24,
      orderWillComplete: false,
      timeMinutes: 20 * 60,
    })).toBe("先去售卖箱 · 背包3件可售/72金");
    expect(bedtimeShippingReminderHint({
      sellableInventoryCount: 2,
      sellableInventoryGold: 48,
      boxedItemCount: 0,
      boxedGold: 0,
      orderWillComplete: false,
      timeMinutes: 22 * 60,
    })).toBe("夜深先入箱 · 背包2件可售/48金");
    expect(bedtimeShippingReminderHint({
      sellableInventoryCount: 0,
      sellableInventoryGold: 0,
      boxedItemCount: 4,
      boxedGold: 156,
      orderWillComplete: true,
      timeMinutes: 21 * 60,
    })).toBe("保存到清晨 · 箱内4件/156金 · 委托睡醒交付");
    expect(bedtimeShippingReminderHint({
      sellableInventoryCount: Number.NaN,
      sellableInventoryGold: Number.NaN,
      boxedItemCount: Number.NaN,
      boxedGold: Number.NaN,
      orderWillComplete: false,
      timeMinutes: 22 * 60,
    })).toBe("保存到清晨 · 空箱也该睡");
  });

  it("prioritizes day-end pacing from orders inventory boxes and time", () => {
    expect(dayEndPacingHint({
      timeMinutes: 24 * 60,
      energy: 40,
      sellableInventoryCount: 0,
      boxedItemCount: 0,
      boxedGold: 0,
      orderReady: false,
      orderMissingCount: 0,
      currentPlace: "town",
    })).toBe("日末节奏 · 立刻睡觉防昏倒");
    expect(dayEndPacingHint({
      timeMinutes: 20 * 60,
      energy: 40,
      sellableInventoryCount: 0,
      boxedItemCount: 4,
      boxedGold: 156,
      orderReady: true,
      orderMissingCount: 0,
      currentPlace: "farm",
    })).toBe("日末节奏 · 委托可结 · 农场睡醒交付");
    expect(dayEndPacingHint({
      timeMinutes: 21 * 60,
      energy: 40,
      sellableInventoryCount: 0,
      boxedItemCount: 1,
      boxedGold: 24,
      orderReady: false,
      orderMissingCount: 2,
      currentPlace: "town",
    })).toBe("日末节奏 · 委托还差2件 · 保守收尾");
    expect(dayEndPacingHint({
      timeMinutes: 21 * 60,
      energy: 40,
      sellableInventoryCount: 3,
      boxedItemCount: 0,
      boxedGold: 0,
      orderReady: false,
      orderMissingCount: 0,
      currentPlace: "farm",
    })).toBe("日末节奏 · 夜深 · 先入箱3件");
    expect(dayEndPacingHint({
      timeMinutes: 20 * 60,
      energy: 40,
      sellableInventoryCount: 0,
      boxedItemCount: 2,
      boxedGold: 68,
      orderReady: false,
      orderMissingCount: 0,
      currentPlace: "home",
    })).toBe("日末节奏 · 箱内2件/68金 · 床边睡觉");
    expect(dayEndPacingHint({
      timeMinutes: 18 * 60,
      energy: 80,
      sellableInventoryCount: 0,
      boxedItemCount: 0,
      boxedGold: 0,
      orderReady: false,
      orderMissingCount: 0,
      currentPlace: "farm",
    })).toBe("日末节奏 · 还能自由经营");
  });

  it("previews shipping income with optional order and streak rewards", () => {
    expect(shippingPreview({
      sellableIncome: 80,
      orderAccepted: false,
      orderCompleted: false,
      shippedForOrder: 0,
      orderCount: 3,
      orderReward: 60,
      nextStreakBonus: 16,
    })).toMatchObject({ total: 80, orderWillComplete: false });
    expect(shippingPreview({
      sellableIncome: 80,
      orderAccepted: true,
      orderCompleted: false,
      shippedForOrder: 3,
      orderCount: 3,
      orderReward: 60,
      nextStreakBonus: 16,
    })).toMatchObject({ total: 156, orderWillComplete: true, orderReward: 60, streakBonus: 16 });
  });

  it("summarizes shipping box value for HUD prompts", () => {
    expect(shippingBoxHint({ itemCount: 0, totalGold: 0, orderWillComplete: false })).toBe("空箱");
    expect(shippingBoxHint({ itemCount: 3, totalGold: 88, orderWillComplete: false })).toBe("3件 · 88金");
    expect(shippingBoxHint({ itemCount: 3, totalGold: 156, orderWillComplete: true })).toBe("3件 · 156金 · 委托可完成");
    expect(shippingBoxHint({ itemCount: -1, totalGold: Number.NaN, orderWillComplete: true })).toBe("空箱");
  });

  it("separates shipping actions from already boxed items", () => {
    expect(shippingActionHint({
      backpackCount: 2,
      boxCount: 3,
      totalGold: 140,
      orderWillComplete: true,
    })).toBe("入箱 背包2件 · 5件 · 140金 · 委托可完成");
    expect(shippingActionHint({
      backpackCount: 0,
      boxCount: 3,
      totalGold: 88,
      orderWillComplete: false,
    })).toBe("箱内已放 3件 · 88金");
    expect(shippingActionHint({
      backpackCount: -1,
      boxCount: 0,
      totalGold: Number.NaN,
      orderWillComplete: true,
    })).toBe("售卖箱空");
  });

  it("summarizes shipping settlement sources before sleep", () => {
    expect(shippingBreakdownHint({ sellableIncome: 80, orderReward: 60, streakBonus: 16 })).toBe("售卖80 · 委托60 · 连击16");
    expect(shippingBreakdownHint({ sellableIncome: 80, orderReward: 0, streakBonus: 0 })).toBe("售卖80");
    expect(shippingBreakdownHint({ sellableIncome: 0, orderReward: 60, streakBonus: 16 })).toBe("委托60 · 连击16");
    expect(shippingBreakdownHint({ sellableIncome: -1, orderReward: Number.NaN, streakBonus: 0 })).toBe("暂无收入");
  });

  it("summarizes shipping deposit results and bedtime readiness", () => {
    expect(shippingDepositHint({
      shippedCount: 4,
      totalGold: 156,
      sellableIncome: 80,
      orderReward: 60,
      streakBonus: 16,
      orderWillComplete: true,
      timeMinutes: 21 * 60,
    })).toBe("入箱4件 · 预计156金（售卖80 · 委托60 · 连击16） · 委托睡醒交付 · 可回家睡觉");
    expect(shippingDepositHint({
      shippedCount: 2,
      totalGold: 48,
      sellableIncome: 48,
      orderReward: 0,
      streakBonus: 0,
      orderWillComplete: false,
      timeMinutes: 18 * 60,
    })).toBe("入箱2件 · 预计48金（售卖48）");
    expect(shippingDepositHint({
      shippedCount: Number.NaN,
      totalGold: Number.NaN,
      sellableIncome: Number.NaN,
      orderReward: -1,
      streakBonus: -1,
      orderWillComplete: true,
      timeMinutes: Number.NaN,
    })).toBe("没有可入箱物");
  });

  it("nudges the next action after shipping deposits", () => {
    expect(shippingNextStepHint({
      shippedCount: 0,
      expectedGold: 0,
      orderWillComplete: false,
      timeMinutes: 18 * 60,
      energy: 40,
      sellableInventoryCount: 3,
    })).toBe("下一步 · 还有3件可入箱");
    expect(shippingNextStepHint({
      shippedCount: 4,
      expectedGold: 156,
      orderWillComplete: true,
      timeMinutes: 20 * 60,
      energy: 30,
      sellableInventoryCount: 0,
    })).toBe("下一步 · 回家睡觉保连击");
    expect(shippingNextStepHint({
      shippedCount: 2,
      expectedGold: 48,
      orderWillComplete: false,
      timeMinutes: 21 * 60,
      energy: 30,
      sellableInventoryCount: 0,
    })).toBe("下一步 · 回家睡觉");
    expect(shippingNextStepHint({
      shippedCount: 2,
      expectedGold: 48,
      orderWillComplete: false,
      timeMinutes: 18 * 60,
      energy: 30,
      sellableInventoryCount: 0,
    })).toBe("下一步 · 明早收款48金");
    expect(shippingNextStepHint({
      shippedCount: 2,
      expectedGold: 48,
      orderWillComplete: false,
      timeMinutes: 18 * 60,
      energy: 30,
      sellableInventoryCount: 1,
    })).toBe("下一步 · 继续入箱1件");
    expect(shippingNextStepHint({
      shippedCount: Number.NaN,
      expectedGold: Number.NaN,
      orderWillComplete: false,
      timeMinutes: Number.NaN,
      energy: Number.NaN,
      sellableInventoryCount: Number.NaN,
    })).toBe("下一步 · 查日志");
  });

  it("surfaces sell box urgency for the nightly shipping loop", () => {
    expect(shippingUrgencyHint({
      backpackCount: 0,
      boxCount: 3,
      totalGold: 156,
      orderWillComplete: true,
      timeMinutes: 20 * 60,
      energy: 40,
    })).toBe("售卖节奏 · 委托已稳 · 回家睡");
    expect(shippingUrgencyHint({
      backpackCount: 2,
      boxCount: 0,
      totalGold: 48,
      orderWillComplete: false,
      timeMinutes: 21 * 60,
      energy: 40,
    })).toBe("售卖节奏 · 夜深先入箱2件");
    expect(shippingUrgencyHint({
      backpackCount: 2,
      boxCount: 0,
      totalGold: 48,
      orderWillComplete: false,
      timeMinutes: 18 * 60,
      energy: 8,
    })).toBe("售卖节奏 · 低体先入箱2件");
    expect(shippingUrgencyHint({
      backpackCount: 2,
      boxCount: 1,
      totalGold: 72,
      orderWillComplete: false,
      timeMinutes: 12 * 60,
      energy: 40,
    })).toBe("售卖节奏 · 背包可入2件");
    expect(shippingUrgencyHint({
      backpackCount: 0,
      boxCount: 1,
      totalGold: 24,
      orderWillComplete: false,
      timeMinutes: 12 * 60,
      energy: 40,
    })).toBe("售卖节奏 · 明早收24金");
    expect(shippingUrgencyHint({
      backpackCount: Number.NaN,
      boxCount: -1,
      totalGold: Number.NaN,
      orderWillComplete: false,
      timeMinutes: Number.NaN,
      energy: Number.NaN,
    })).toBe("售卖节奏 · 箱空不急");
  });

  it("summarizes carried sellable inventory value", () => {
    expect(backpackValueHint({ itemCount: 0, totalGold: 0 })).toBe("暂无可售物");
    expect(backpackValueHint({ itemCount: 4, totalGold: 132 })).toBe("可售 4件 · 132金");
    expect(backpackValueHint({ itemCount: -1, totalGold: Number.NaN })).toBe("暂无可售物");
  });

  it("adds inventory slot affordance to detail text", () => {
    expect(inventorySlotDetailHint({
      detail: "24金 / +8体",
      count: 3,
      actionLabel: "点选吃",
    })).toBe("24金 / +8体 · 点选吃");
    expect(inventorySlotDetailHint({
      detail: "10 金",
      count: 2,
    })).toBe("10 金");
    expect(inventorySlotDetailHint({
      detail: "24金 / +8体",
      count: 0,
      actionLabel: "点选吃",
    })).toBe("24金 / +8体 · 暂无");
    expect(inventorySlotDetailHint({
      detail: "24金 / +8体 · 委托留3",
      count: 5,
      actionLabel: "点选吃",
      safeActionCount: 2,
      safeActionLabel: "安全吃",
    })).toBe("24金 / +8体 · 委托留3 · 安全吃2");
    expect(inventorySlotDetailHint({
      detail: "24金 / +8体 · 委托留3",
      count: 3,
      actionLabel: "点选吃",
      safeActionCount: 0,
    })).toBe("24金 / +8体 · 委托留3 · 别动委托");
    expect(inventorySlotDetailHint({
      detail: "  ",
      count: Number.NaN,
    })).toBe("查看 · 暂无");
  });

  it("prioritizes backpack next actions around orders snacks and shipping", () => {
    expect(backpackActionHint({
      sellableCount: 3,
      sellableGold: 72,
      snackCount: 3,
      reservedForOrder: 3,
      energy: 80,
      maxEnergy: 100,
    })).toBe("委托留3件 · 别误吃/卖");
    expect(backpackActionHint({
      sellableCount: 5,
      sellableGold: 120,
      snackCount: 5,
      reservedForOrder: 3,
      energy: 80,
      maxEnergy: 100,
    })).toBe("委托留3件 · 余2件可处理");
    expect(backpackActionHint({
      sellableCount: 2,
      sellableGold: 48,
      snackCount: 2,
      energy: 40,
      maxEnergy: 100,
    })).toBe("点心2件 · R补体");
    expect(backpackActionHint({
      sellableCount: 2,
      sellableGold: 48,
      snackCount: 2,
      energy: 70,
      maxEnergy: 100,
    })).toBe("可入箱2件 · 48金");
    expect(backpackActionHint({
      sellableCount: Number.NaN,
      sellableGold: Number.NaN,
      snackCount: Number.NaN,
      reservedForOrder: -1,
      energy: Number.NaN,
      maxEnergy: -1,
    })).toBe("背包轻装 · 去采收");
  });

  it("summarizes backpack sell, keep and order-reserve decisions", () => {
    expect(backpackDecisionHint({
      sellableCount: 3,
      sellableGold: 72,
      reservedForOrder: 3,
      snackCount: 3,
      energy: 80,
      maxEnergy: 100,
      timeMinutes: 18 * 60,
    })).toBe("委托3件优先入箱");
    expect(backpackDecisionHint({
      sellableCount: 5,
      sellableGold: 120,
      reservedForOrder: 3,
      snackCount: 5,
      energy: 80,
      maxEnergy: 100,
      timeMinutes: 18 * 60,
    })).toBe("委托3件先留 · 余2件可卖/吃");
    expect(backpackDecisionHint({
      sellableCount: 2,
      sellableGold: 48,
      snackCount: 2,
      energy: 20,
      maxEnergy: 100,
      timeMinutes: 12 * 60,
    })).toBe("体力低 · 留点心2件");
    expect(backpackDecisionHint({
      sellableCount: 2,
      sellableGold: 48,
      snackCount: 0,
      energy: 80,
      maxEnergy: 100,
      timeMinutes: 22 * 60,
    })).toBe("夜深 · 先入箱2件");
    expect(backpackDecisionHint({
      sellableCount: Number.NaN,
      sellableGold: Number.NaN,
      energy: Number.NaN,
      maxEnergy: -1,
      timeMinutes: Number.NaN,
    })).toBe("背包无压力 · 继续采收");
  });

  it("prioritizes backpack sorting for orders gifts snacks and sellables", () => {
    expect(backpackSortPlanHint({
      sellableCount: 4,
      giftReadyCount: 2,
      snackCount: 4,
      reservedForOrder: 3,
      energy: 80,
      maxEnergy: 100,
      timeMinutes: 12 * 60,
    })).toBe("整理 · 委托锁定3件");
    expect(backpackSortPlanHint({
      sellableCount: 4,
      giftReadyCount: 2,
      snackCount: 4,
      energy: 80,
      maxEnergy: 100,
      timeMinutes: 12 * 60,
    })).toBe("整理 · 礼物置顶2件");
    expect(backpackSortPlanHint({
      sellableCount: 0,
      giftReadyCount: 0,
      snackCount: 2,
      energy: 20,
      maxEnergy: 100,
      timeMinutes: 12 * 60,
    })).toBe("整理 · 点心放热键2件");
    expect(backpackSortPlanHint({
      sellableCount: 3,
      giftReadyCount: 2,
      snackCount: 3,
      energy: 80,
      maxEnergy: 100,
      timeMinutes: 21 * 60,
    })).toBe("整理 · 可售全入箱3件");
    expect(backpackSortPlanHint({
      sellableCount: 3,
      giftReadyCount: 0,
      snackCount: 3,
      energy: 80,
      maxEnergy: 100,
      timeMinutes: 12 * 60,
    })).toBe("整理 · 可售靠箱3件");
    expect(backpackSortPlanHint({
      sellableCount: Number.NaN,
      giftReadyCount: Number.NaN,
      snackCount: Number.NaN,
      reservedForOrder: -1,
      energy: Number.NaN,
      maxEnergy: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("整理 · 背包轻装");
  });

  it("surfaces backpack shortcut priorities for inventory affordances", () => {
    expect(backpackShortcutHint({
      seedCount: 3,
      openPlotCount: 2,
      sellableCount: 4,
      snackCount: 4,
      energy: 30,
      maxEnergy: 100,
      timeMinutes: 22 * 60,
    })).toBe("快捷 · 选种播2块");
    expect(backpackShortcutHint({
      seedCount: 0,
      openPlotCount: 0,
      sellableCount: 1,
      snackCount: 2,
      energy: 30,
      maxEnergy: 100,
      timeMinutes: 12 * 60,
    })).toBe("快捷 · R吃点心");
    expect(backpackShortcutHint({
      seedCount: 0,
      openPlotCount: 0,
      sellableCount: 3,
      snackCount: 0,
      energy: 80,
      maxEnergy: 100,
      timeMinutes: 21 * 60,
    })).toBe("快捷 · E入箱3件");
    expect(backpackShortcutHint({
      seedCount: 0,
      openPlotCount: 0,
      sellableCount: 3,
      snackCount: 0,
      energy: 80,
      maxEnergy: 100,
      timeMinutes: 14 * 60,
    })).toBe("快捷 · 睡前入箱3件");
    expect(backpackShortcutHint({
      seedCount: 0,
      openPlotCount: 2,
      sellableCount: 0,
      snackCount: 0,
      energy: Number.NaN,
      maxEnergy: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("快捷 · 去买种子");
    expect(backpackShortcutHint({
      seedCount: Number.NaN,
      openPlotCount: Number.NaN,
      sellableCount: Number.NaN,
      snackCount: Number.NaN,
      energy: Number.NaN,
      maxEnergy: Number.NaN,
      timeMinutes: Number.NaN,
    })).toBe("快捷 · J看日志");
  });

  it("calculates net settlement with separate streak bonus", () => {
    expect(settlementNet({ income: 80, orderReward: 60, streakBonus: 16, passOutFee: 0 })).toBe(156);
    expect(settlementNet({ income: 80, orderReward: 60, streakBonus: 16, passOutFee: 30 })).toBe(126);
    expect(settlementNet({ income: -1, orderReward: Number.NaN, streakBonus: 10, passOutFee: 99 })).toBe(-89);
  });

  it("summarizes morning settlement into one daybreak report", () => {
    expect(morningSettlementToastHint({
      income: 80,
      orderReward: 60,
      streakBonus: 16,
      passOutFee: 0,
      shippedItems: 4,
      farmRatingLabel: "小有起色",
      farmRatingScore: 128,
      eventTitle: "山风集市",
    })).toBe("清晨结算 · 售卖4件+80金 · 山风集市委托 +60金 · 连击+16 · 合计76金 · 净+156金 · 小有起色128分");
    expect(morningSettlementToastHint({
      income: 0,
      orderReward: 0,
      streakBonus: 0,
      passOutFee: 30,
      shippedItems: 0,
      farmRatingLabel: " ",
      farmRatingScore: Number.NaN,
    })).toBe("清晨结算 · 夜间照看-30金 · 净-30金");
    expect(morningSettlementToastHint({
      income: Number.NaN,
      orderReward: Number.NaN,
      streakBonus: -1,
      passOutFee: -1,
      shippedItems: -1,
      farmRatingLabel: " ",
      farmRatingScore: Number.NaN,
    })).toBe("清晨结算 · 净0金");
  });
});
