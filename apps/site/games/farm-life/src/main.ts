import Phaser from "phaser";

import {
  actionEnergyHint,
  actionFeedbackCueHint,
  addMasteryXp,
  backpackActionHint,
  backpackDecisionHint,
  backpackShortcutHint,
  backpackSortPlanHint,
  bedtimeChecklistHint,
  bedtimeReadinessHint,
  bedtimeShippingReminderHint,
  backpackValueHint,
  bedtimeWarning,
  calendarEventActionHint,
  calendarEventRouteHint,
  calendarPlanHint,
  calendarSocialPrepHint,
  createDefaultMastery,
  cropEconomics,
  cropGrowthStatus,
  dailyAdvice,
  dailyObjectiveHint,
  dayEndPacingHint,
  dayBreakRouteHint,
  dayStartFirstActionHint,
  dayStartPlanHint,
  dayPeriod,
  energyStatus,
  farmRating,
  farmActionFollowUpHint,
  farmActionResultHint,
  fieldActionNextStepHint,
  fieldTactileCueHint,
  fieldTileDecisionHint,
  farmingEnergyCost,
  fieldEnergyPlanHint,
  farmToolStateHint,
  fieldCareSummary,
  fieldWorkloadHint,
  fishingBasketRouteHint,
  fishingActionJuiceHint,
  fishingBiteCueHint,
  fishingCastPreviewHint,
  fishingCatchTier,
  fishingConditionHint,
  fishingResultHint,
  fishingSpotPlanHint,
  forecastSummaryHint,
  festivalChecklistHint,
  festivalReadinessHint,
  forageActionHint,
  forageResultHint,
  forageYield,
  giftAutoUseCount,
  giftFriendshipPoints,
  giftMotivationHint,
  giftResultHint,
  hotbarActionHint,
  inventorySlotDetailHint,
  mapInteractionCueHint,
  mailboxResultHint,
  masteryLevel,
  morningSettlementToastHint,
  orderRewardSummary,
  orderStreakBonus,
  orderBoardActionHint,
  orderDeadlineHint,
  orderBoardPreviewHint,
  orderNextStepHint,
  orderFulfillmentProgress,
  orderSourceHint,
  orderTurnInHint,
  masteryTrackIds,
  npcApproachCueHint,
  npcMapLabel,
  npcScheduleMapHint,
  npcInteractionStateHint,
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
  transitionDepartureChecklistHint,
  transitionTravelPromptHint,
  toolSelectionToastHint,
  wateringSplashLimit,
  weatherHudPlanHint,
  weatherPlanHint,
  type DailyObjectiveId,
  type FishingCatchTier,
  type TravelTarget,
  type MasteryState,
  type MasteryTrackId,
} from "./progression";
import "./style.css";

const TILE = 32;
const MAP_COLS = 42;
const MAP_ROWS = 28;
const MAP_X = 0;
const MAP_Y = 0;
const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const HUD_MARGIN = 18;
const HOTBAR_HEIGHT = 72;
const UI_FONT = "Inter, PingFang SC, Microsoft YaHei, sans-serif";
const UI_COLORS = {
  ink: 0x181425,
  night: 0x222b45,
  nightSoft: 0x2d3658,
  shadow: 0x070914,
  gold: 0xfec742,
  goldSoft: 0xffe2a8,
  cream: 0xfff3cf,
  paper: 0xf8dfae,
  paperSoft: 0xfff1c2,
  mint: 0x7be3a0,
  blue: 0x5acde8,
  rose: 0xff9b7c,
  red: 0xff6b5f,
  green: 0x43d184,
  brown: 0x6b3f1d,
  brownDark: 0x3f2614,
  muted: 0xb8c0d6,
  white: 0xffffff,
};
const SAVE_KEY = "farm-life-mvp-save-v2";
const AUDIO_KEY = "farm-life-mvp-audio";
const MAX_ENERGY = 100;
const START_TIME = 6 * 60;
const LATE_TIME = 26 * 60;
const ACTION_MINUTES = 10;
const EAT_MINUTES = 5;
const TRAVEL_MINUTES = 15;
const SHOP_MINUTES = 5;
const FISHING_MINUTES = 20;

const TILE_FRAMES = {
  grass: 0,
  field: 1,
  road: 2,
  soil: 3,
  wet: 4,
  water: 5,
  floor: 6,
  wall: 7,
  counter: 8,
  mailbox: 32,
  bed: 33,
  table: 34,
  fireplace: 35,
  tv: 36,
  deepForestGrass: 37,
  beachSand: 38,
  caveFloor: 39,
  caveWall: 40,
  templeFloor: 41,
  templeWall: 42,
  barnFloor: 43,
  barnWall: 44,
  cliff: 45,
  dock: 46,
  dungeonFloor: 47,
  dungeonWall: 48,
  hay: 49,
  crate: 50,
  mineCrystal: 51,
  templeStatue: 52,
} as const;

const CHARACTER_FRAMES = {
  playerDown: 0,
  playerDownStepLeft: 1,
  playerDownStepRight: 2,
  playerUp: 3,
  playerUpStepLeft: 4,
  playerUpStepRight: 5,
  playerLeft: 6,
  playerLeftStepLeft: 7,
  playerLeftStepRight: 8,
  playerRight: 9,
  playerRightStepLeft: 10,
  playerRightStepRight: 11,
  shopkeeper: 12,
  liang: 13,
  auntChen: 14,
  elder: 15,
} as const;

const CROP_FRAME_OFFSET = {
  turnip: 0,
  wheat: 4,
  potato: 8,
} as const;

const ICON_FRAMES = {
  hoe: 0,
  seedBag: 1,
  wateringCan: 2,
  harvestBasket: 3,
  turnip: 4,
  wheat: 5,
  potato: 6,
  coin: 7,
  sun: 8,
  rain: 9,
  mist: 10,
  energy: 11,
  order: 12,
  heart: 13,
  soundOn: 14,
  soundOff: 15,
  berry: 16,
  mushroom: 17,
  wildFlower: 18,
  fishingRod: 19,
  creekFish: 20,
  carp: 21,
  silverFish: 22,
} as const;

const CROPS = {
  turnip: {
    name: "萝卜",
    seedName: "萝卜种子",
    seedPrice: 10,
    sellPrice: 24,
    growDays: 2,
  },
  wheat: {
    name: "小麦",
    seedName: "小麦种子",
    seedPrice: 15,
    sellPrice: 38,
    growDays: 3,
  },
  potato: {
    name: "土豆",
    seedName: "土豆种子",
    seedPrice: 20,
    sellPrice: 56,
    growDays: 4,
  },
} as const;

const FORAGE = {
  berry: {
    name: "山莓",
    sellPrice: 18,
    icon: "berry",
  },
  mushroom: {
    name: "松露菇",
    sellPrice: 28,
    icon: "mushroom",
  },
  wildFlower: {
    name: "野花",
    sellPrice: 16,
    icon: "wildFlower",
  },
} as const;

const FISH = {
  creekFish: {
    name: "溪鱼",
    sellPrice: 34,
    icon: "creekFish",
  },
  carp: {
    name: "鲤鱼",
    sellPrice: 46,
    icon: "carp",
  },
  silverFish: {
    name: "银鳞鱼",
    sellPrice: 72,
    icon: "silverFish",
  },
} as const;

const WEATHER = {
  sunny: {
    name: "晴",
    note: "阳光很好，记得浇水。",
  },
  rain: {
    name: "雨",
    note: "今天下雨，作物会自动浇水。",
  },
  mist: {
    name: "雾",
    note: "雾气很重，小镇慢了半拍。",
  },
} as const;

const SEASONS = {
  spring: {
    name: "早春",
    tint: 0xdcfce7,
    alpha: 0.03,
  },
  summer: {
    name: "盛夏",
    tint: 0xfef08a,
    alpha: 0.055,
  },
  autumn: {
    name: "金秋",
    tint: 0xf59e0b,
    alpha: 0.075,
  },
  winter: {
    name: "初冬",
    tint: 0xdbeafe,
    alpha: 0.12,
  },
} as const;

type CropId = keyof typeof CROPS;
type ForageId = keyof typeof FORAGE;
type FishId = keyof typeof FISH;
type WeatherId = keyof typeof WEATHER;
type SeasonId = keyof typeof SEASONS;
type ToolId = "hoe" | "seed" | "water" | "harvest" | "fish";
type HotbarId = ToolId | `seed:${CropId}`;
type PlaceId = "farm" | "home" | "town" | "shop" | "deepForest" | "beach" | "cave" | "dungeon" | "temple" | "barn";
type Direction = "up" | "down" | "left" | "right";
type ItemId = `${CropId}_seed` | `${CropId}_crop` | `${ForageId}_forage` | `${FishId}_fish`;
type NpcId = "shopkeeper" | "liang" | "auntChen" | "elder";
type GiftCategory = "crop" | "forage" | "fish";
type SfxId = "step" | "hoe" | "seed" | "water" | "harvest" | "fish" | "coin" | "menu" | "day" | "ambient";

type PlotState = {
  tilled: boolean;
  watered: boolean;
  cropId?: CropId;
  growth: number;
};

type PlayerState = {
  place: PlaceId;
  x: number;
  y: number;
  facing: Direction;
};

type DailyOrder = {
  day: number;
  cropId: CropId;
  count: number;
  reward: number;
  accepted: boolean;
  completed: boolean;
};

type FarmSave = {
  day: number;
  gold: number;
  energy: number;
  timeMinutes: number;
  lastAction: string;
  player: PlayerState;
  selectedTool: ToolId;
  selectedSeed: CropId;
  inventory: Partial<Record<ItemId, number>>;
  shipping: Partial<Record<CropId, number>>;
  forageShipping: Partial<Record<ForageId, number>>;
  fishShipping: Partial<Record<FishId, number>>;
  stats: FarmStats;
  collectedForage: Partial<Record<string, number>>;
  plots: Record<string, PlotState>;
  friendship: Partial<Record<NpcId, number>>;
  talkedToNpcs: Partial<Record<NpcId, number>>;
  giftGivenToNpcs: Partial<Record<NpcId, number>>;
  relationshipRewards: Partial<Record<string, number>>;
  mastery: MasteryState;
  mailReadDay: number;
  dailyOrder: DailyOrder;
  seenStoryEvents: Partial<Record<string, number>>;
  storyProgress: Partial<Record<QuestStepId, number>>;
};

type TilePoint = {
  x: number;
  y: number;
};

type FarmStats = {
  totalShipped: number;
  totalShippingIncome: number;
  completedOrders: number;
  totalOrderRewards: number;
  currentOrderStreak: number;
  bestOrderStreak: number;
};

type TiledProperty = {
  name: string;
  type?: string;
  value: string | number | boolean;
};

type TiledObject = {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TiledProperty[];
};

type TiledLayer =
  | {
      id: number;
      name: string;
      type: "tilelayer";
      width: number;
      height: number;
      data: number[];
      visible: boolean;
      opacity: number;
    }
  | {
      id: number;
      name: string;
      type: "objectgroup";
      objects: TiledObject[];
      visible: boolean;
      opacity: number;
    };

type TiledMap = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
};

type NpcActor = {
  id: NpcId;
  name: string;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  route: TilePoint[];
  routeIndex: number;
  x: number;
  y: number;
  nextMoveAt: number;
  activity: string;
  dialog: string;
  rainDialog?: string;
  mistDialog?: string;
};

type HotbarEntry = {
  id: HotbarId;
  icon: number;
  count?: number;
  onClick: () => void;
};

type TileFeedback = {
  color: number;
  icon?: number;
  label: string;
  labelColor?: number;
};

type SnackCandidate = {
  item: ItemId;
  name: string;
  icon: number;
  energy: number;
  orderReserveCount?: number;
};

type GiftCandidate = {
  item: ItemId;
  category: GiftCategory;
  name: string;
  icon: number;
  orderReserveCount?: number;
};

type JournalRow = {
  label: string;
  done: boolean;
  detail: string;
};

type CalendarEvent = {
  seasonDay: number;
  title: string;
  note: string;
  icon: number;
};

type NpcScheduleBlock = {
  start: number;
  end: number;
  place: PlaceId;
  route: string;
  activity: string;
  dialog: string;
  rainDialog?: string;
  mistDialog?: string;
};

type StoryBeat = {
  id: string;
  title: string;
  message: string;
  place: PlaceId;
  start: number;
  end: number;
  icon: number;
  day?: number;
  seasonDay?: number;
};

type QuestStepId =
  | "read-mail"
  | "accept-order"
  | "till-plot"
  | "plant-crop"
  | "water-crop"
  | "ship-first"
  | "sleep-after-shipping"
  | "meet-neighbor";

type StoryQuestDefinition = {
  id: QuestStepId;
  title: string;
  detail: string;
  hint: string;
  icon: number;
};

type ForageSpawn = {
  id: ForageId;
  place: "farm" | "town";
  x: number;
  y: number;
};

const cropIds = Object.keys(CROPS) as CropId[];
const forageIds = Object.keys(FORAGE) as ForageId[];
const fishIds = Object.keys(FISH) as FishId[];
const npcIds: NpcId[] = ["shopkeeper", "liang", "auntChen", "elder"];

const forageSpawnPoints: Record<"farm" | "town", TilePoint[]> = {
  farm: [
    { x: 3, y: 15 },
    { x: 7, y: 3 },
    { x: 14, y: 23 },
    { x: 27, y: 8 },
    { x: 33, y: 14 },
    { x: 38, y: 23 },
    { x: 25, y: 25 },
    { x: 6, y: 21 },
  ],
  town: [
    { x: 6, y: 16 },
    { x: 13, y: 19 },
    { x: 18, y: 18 },
    { x: 29, y: 19 },
    { x: 34, y: 16 },
    { x: 8, y: 25 },
    { x: 36, y: 24 },
    { x: 24, y: 22 },
  ],
};

const seasonalForage: Record<SeasonId, ForageId[]> = {
  spring: ["wildFlower", "berry"],
  summer: ["berry", "wildFlower"],
  autumn: ["mushroom", "berry"],
  winter: ["mushroom"],
};

const toolLabels: Record<ToolId, string> = {
  hoe: "锄头",
  seed: "种子",
  water: "水壶",
  harvest: "收获",
  fish: "钓鱼",
};

const placeLabels: Record<PlaceId, string> = {
  farm: "山间农场",
  home: "山间小屋",
  town: "小镇街道",
  shop: "种子商店",
  deepForest: "山林深处",
  beach: "溪口海滩",
  cave: "山腹矿洞",
  dungeon: "旧矿地下城",
  temple: "林中古寺",
  barn: "农场谷仓",
};

const placeTravelActions: Record<PlaceId, string> = {
  farm: "回农场",
  home: "进屋",
  town: "去小镇",
  shop: "进商店",
  deepForest: "进深林",
  beach: "去海滩",
  cave: "进矿洞",
  dungeon: "下地下城",
  temple: "进古寺",
  barn: "进谷仓",
};

const npcDisplayNames: Record<NpcId, string> = {
  shopkeeper: "青禾",
  liang: "阿良",
  auntChen: "陈婶",
  elder: "老周",
};

const npcGiftPreferences: Record<NpcId, { loves: GiftCategory[]; line: string }> = {
  shopkeeper: {
    loves: ["crop"],
    line: "青禾会认真记下好种子的收成。",
  },
  liang: {
    loves: ["fish"],
    line: "阿良最喜欢听水边带回来的故事。",
  },
  auntChen: {
    loves: ["forage"],
    line: "陈婶总能把野味做成温暖的饭。",
  },
  elder: {
    loves: ["crop", "forage"],
    line: "老周喜欢带着土地气息的礼物。",
  },
};

const relationshipRewardItems: Record<NpcId, Partial<Record<number, ItemId>>> = {
  shopkeeper: {
    2: "turnip_seed",
    3: "wheat_seed",
    4: "potato_seed",
  },
  liang: {
    2: "creekFish_fish",
    3: "carp_fish",
    4: "silverFish_fish",
  },
  auntChen: {
    2: "wildFlower_forage",
    3: "berry_forage",
    4: "mushroom_forage",
  },
  elder: {
    2: "turnip_crop",
    3: "wheat_crop",
    4: "potato_crop",
  },
};

const relationshipStageLabels: Partial<Record<number, string>> = {
  2: "相熟",
  3: "好友",
  4: "知己",
};

const masteryDisplay: Record<MasteryTrackId, { name: string; shortName: string; icon: keyof typeof ICON_FRAMES }> = {
  farming: {
    name: "耕作",
    shortName: "农",
    icon: "turnip",
  },
  foraging: {
    name: "采集",
    shortName: "采",
    icon: "wildFlower",
  },
  fishing: {
    name: "钓鱼",
    shortName: "鱼",
    icon: "fishingRod",
  },
  social: {
    name: "邻里",
    shortName: "邻",
    icon: "heart",
  },
};

const npcSchedules: Record<NpcId, NpcScheduleBlock[]> = {
  shopkeeper: [
    {
      start: 6 * 60,
      end: 8 * 60,
      place: "town",
      route: "20,13;22,14;23,16;20,13",
      activity: "开门前巡店",
      dialog: "我先看看公告板，今天有人想换新鲜收成。",
      rainDialog: "雨天买种子的人多，我得早些开门。",
    },
    {
      start: 8 * 60,
      end: 18 * 60,
      place: "shop",
      route: "20,9;21,9;22,9;21,9",
      activity: "整理当季种子",
      dialog: "今天的种子都在右边。想稳一点就从萝卜开始。",
      rainDialog: "雨天来买种子很划算，田会自己喝饱水。",
    },
    {
      start: 18 * 60,
      end: LATE_TIME,
      place: "town",
      route: "22,15;23,17;25,17;22,15",
      activity: "清点委托",
      dialog: "关店后我会看一眼委托，明天好安排进货。",
      mistDialog: "起雾时灯笼最管用，客人不容易错过店门。",
    },
  ],
  liang: [
    {
      start: 6 * 60,
      end: 12 * 60,
      place: "town",
      route: "25,16;28,16;28,15;25,15",
      activity: "送货跑腿",
      dialog: "早上跑几趟腿，小镇一天就醒过来了。",
      rainDialog: "雨天路滑，不过田里会高兴。",
    },
    {
      start: 12 * 60,
      end: 17 * 60,
      place: "farm",
      route: "27,16;27,19;28,22;25,22",
      activity: "看池塘水色",
      dialog: "你这口池塘不错，傍晚水面会更有动静。",
      rainDialog: "雨点一落，水里的影子就藏得更深。",
    },
    {
      start: 17 * 60,
      end: LATE_TIME,
      place: "town",
      route: "18,15;21,15;25,15;28,15",
      activity: "晚间闲逛",
      dialog: "晚风一吹，小镇路上的脚步声就慢了下来。",
      mistDialog: "雾里走路得认灯笼，别只看脚下。",
    },
  ],
  auntChen: [
    {
      start: 6 * 60,
      end: 11 * 60,
      place: "farm",
      route: "12,22;15,22;15,21;12,21",
      activity: "看田埂",
      dialog: "早啊，地要慢慢养，别急着把钱都花完。",
      rainDialog: "下雨天省水，适合多种一垄。",
    },
    {
      start: 11 * 60,
      end: 18 * 60,
      place: "town",
      route: "11,19;13,19;14,21;11,21",
      activity: "备午后茶点",
      dialog: "我在屋前晒一点香草，路过的人都能闻见。",
      mistDialog: "雾天适合煮热汤，也适合把话说慢一点。",
    },
    {
      start: 18 * 60,
      end: LATE_TIME,
      place: "farm",
      route: "6,23;8,23;8,21;6,21",
      activity: "晚饭后散步",
      dialog: "睡前把售卖箱看一眼，第二天心里就踏实。",
    },
  ],
  elder: [
    {
      start: 6 * 60,
      end: 10 * 60,
      place: "town",
      route: "12,15;14,15;14,16;12,16",
      activity: "修路边篱笆",
      dialog: "镇上其他铺子慢慢会开，先把农场盘活。",
      mistDialog: "起雾的时候，小镇看起来像旧照片。",
    },
    {
      start: 10 * 60,
      end: 16 * 60,
      place: "farm",
      route: "5,23;7,23;7,20;5,20",
      activity: "看山路",
      dialog: "这条路通向镇上，也会把镇上的消息带回来。",
      rainDialog: "雨后路软，走慢一点，鞋底才不会吃泥。",
    },
    {
      start: 16 * 60,
      end: LATE_TIME,
      place: "town",
      route: "12,15;15,15;18,15;15,16",
      activity: "守公告板",
      dialog: "公告板不只是订单，也是镇上每天的脉搏。",
    },
  ],
};

const calendarEvents: CalendarEvent[] = [
  {
    seasonDay: 3,
    title: "山风集市",
    note: "镇民会在公告板前交换当天的好价委托。",
    icon: ICON_FRAMES.order,
  },
  {
    seasonDay: 5,
    title: "溪畔夜灯",
    note: "傍晚去池塘边抛竿，更容易钓到稀有渔获。",
    icon: ICON_FRAMES.fishingRod,
  },
  {
    seasonDay: 7,
    title: "邻里茶会",
    note: "和镇民聊天、送礼，会额外感受到小镇的热闹。",
    icon: ICON_FRAMES.heart,
  },
];

const storyBeats: StoryBeat[] = [
  {
    id: "arrival-mailbox",
    day: 1,
    place: "home",
    start: 6 * 60,
    end: 9 * 60,
    title: "山居晨光",
    message: "小屋还很空，但门外的邮箱、电视和售卖箱已经等着你开始第一天。",
    icon: ICON_FRAMES.sun,
  },
  {
    id: "first-town-board",
    day: 1,
    place: "town",
    start: 8 * 60,
    end: 20 * 60,
    title: "第一张委托",
    message: "公告板旁有人留下了收购单。接下它，今晚把作物放进售卖箱就能结算奖励。",
    icon: ICON_FRAMES.order,
  },
  {
    id: "market-board",
    seasonDay: 3,
    place: "town",
    start: 8 * 60,
    end: 18 * 60,
    title: "山风集市",
    message: "今天订单奖励更高。镇民会围在公告板附近交换收成消息。",
    icon: ICON_FRAMES.order,
  },
  {
    id: "pond-lights",
    seasonDay: 5,
    place: "farm",
    start: 18 * 60,
    end: 23 * 60,
    title: "溪畔夜灯",
    message: "池塘边亮起小灯，傍晚抛竿更容易钓到好鱼。",
    icon: ICON_FRAMES.fishingRod,
  },
  {
    id: "tea-gossip",
    seasonDay: 7,
    place: "town",
    start: 11 * 60,
    end: 17 * 60,
    title: "邻里茶会",
    message: "今天聊天和送礼会多一点心意，适合顺路拜访镇民。",
    icon: ICON_FRAMES.heart,
  },
];

const storyQuestDefinitions: StoryQuestDefinition[] = [
  {
    id: "read-mail",
    title: "读第一封信",
    detail: "先了解今天的天气和搬来的缘由。",
    hint: "在小屋门外邮箱前按 E。",
    icon: ICON_FRAMES.sun,
  },
  {
    id: "accept-order",
    title: "接下第一张委托",
    detail: "去小镇公告板接一单，给种田一个目标。",
    hint: "沿南边山路去小镇公告板。",
    icon: ICON_FRAMES.order,
  },
  {
    id: "till-plot",
    title: "翻开一块地",
    detail: "把农场里的荒地开成能播种的田。",
    hint: "选锄头，对农田按 E。",
    icon: ICON_FRAMES.hoe,
  },
  {
    id: "plant-crop",
    title: "种下第一粒种子",
    detail: "让土地真正开始长东西。",
    hint: "选种子，对翻好的地按 E。",
    icon: ICON_FRAMES.seedBag,
  },
  {
    id: "water-crop",
    title: "照看幼苗",
    detail: "浇过水的作物会在夜里成长。",
    hint: "选水壶给作物浇水，雨天会自动完成。",
    icon: ICON_FRAMES.wateringCan,
  },
  {
    id: "ship-first",
    title: "把收成放进入箱",
    detail: "作物、采集物和渔获都能换成金币。",
    hint: "带着可售物靠近售卖箱按 E。",
    icon: ICON_FRAMES.harvestBasket,
  },
  {
    id: "sleep-after-shipping",
    title: "睡一觉等清晨结算",
    detail: "售卖箱会在第二天早上结算收入。",
    hint: "回小屋床边按 E。",
    icon: ICON_FRAMES.coin,
  },
  {
    id: "meet-neighbor",
    title: "认识一位邻里",
    detail: "小镇的关系网会慢慢打开新的故事。",
    hint: "靠近 NPC 按 E 聊天，或按 G 送礼。",
    icon: ICON_FRAMES.heart,
  },
];

const playerFrames: Record<Direction, number> = {
  down: CHARACTER_FRAMES.playerDown,
  up: CHARACTER_FRAMES.playerUp,
  left: CHARACTER_FRAMES.playerLeft,
  right: CHARACTER_FRAMES.playerRight,
};

const playerWalkFrames: Record<Direction, [number, number, number]> = {
  down: [CHARACTER_FRAMES.playerDown, CHARACTER_FRAMES.playerDownStepLeft, CHARACTER_FRAMES.playerDownStepRight],
  up: [CHARACTER_FRAMES.playerUp, CHARACTER_FRAMES.playerUpStepLeft, CHARACTER_FRAMES.playerUpStepRight],
  left: [CHARACTER_FRAMES.playerLeft, CHARACTER_FRAMES.playerLeftStepLeft, CHARACTER_FRAMES.playerLeftStepRight],
  right: [CHARACTER_FRAMES.playerRight, CHARACTER_FRAMES.playerRightStepLeft, CHARACTER_FRAMES.playerRightStepRight],
};

const toolEnergyCosts: Record<ToolId, number> = {
  hoe: 4,
  seed: 2,
  water: 3,
  harvest: 2,
  fish: 6,
};

function plotKey(x: number, y: number) {
  return `${x},${y}`;
}

function seedItem(cropId: CropId): ItemId {
  return `${cropId}_seed`;
}

function cropItem(cropId: CropId): ItemId {
  return `${cropId}_crop`;
}

function forageItem(forageId: ForageId): ItemId {
  return `${forageId}_forage`;
}

function fishItem(fishId: FishId): ItemId {
  return `${fishId}_fish`;
}

function forageKey(day: number, place: PlaceId, forageId: ForageId, x: number, y: number) {
  return `${day}:${place}:${forageId}:${x},${y}`;
}

function createInitialPlots() {
  const plots: Record<string, PlotState> = {};

  for (let y = 8; y <= 18; y += 1) {
    for (let x = 9; x <= 22; x += 1) {
      plots[plotKey(x, y)] = {
        tilled: false,
        watered: false,
        growth: 0,
      };
    }
  }

  return plots;
}

function createDailyOrder(day: number): DailyOrder {
  const normalizedDay = Math.max(1, Math.floor(day));
  const cropId = cropIds[(normalizedDay - 1) % cropIds.length];
  const count = 2 + ((normalizedDay * 7) % 4);
  const marketBonus = seasonDayFor(normalizedDay) === 3 ? 42 : 0;
  const reward = count * CROPS[cropId].sellPrice + 18 + ((normalizedDay * 11) % 12) + marketBonus;

  return {
    day: normalizedDay,
    cropId,
    count,
    reward,
    accepted: false,
    completed: false,
  };
}

function createDefaultSave(): FarmSave {
  return {
    day: 1,
    gold: 90,
    energy: MAX_ENERGY,
    timeMinutes: START_TIME,
    lastAction: "",
    player: {
      place: "home",
      x: 6,
      y: 6,
      facing: "down",
    },
    selectedTool: "hoe",
    selectedSeed: "turnip",
    inventory: {
      turnip_seed: 4,
    },
    shipping: {},
    forageShipping: {},
    fishShipping: {},
    stats: {
      totalShipped: 0,
      totalShippingIncome: 0,
      completedOrders: 0,
      totalOrderRewards: 0,
      currentOrderStreak: 0,
      bestOrderStreak: 0,
    },
    collectedForage: {},
    plots: createInitialPlots(),
    friendship: {},
    talkedToNpcs: {},
    giftGivenToNpcs: {},
    relationshipRewards: {},
    mastery: createDefaultMastery(),
    mailReadDay: 0,
    dailyOrder: createDailyOrder(1),
    seenStoryEvents: {},
    storyProgress: {},
  };
}

function clampCount(value: number | undefined) {
  return Math.max(0, Math.floor(value ?? 0));
}

function isCropId(value: unknown): value is CropId {
  return typeof value === "string" && value in CROPS;
}

function isForageId(value: unknown): value is ForageId {
  return typeof value === "string" && value in FORAGE;
}

function isFishId(value: unknown): value is FishId {
  return typeof value === "string" && value in FISH;
}

function isToolId(value: unknown): value is ToolId {
  return value === "hoe" || value === "seed" || value === "water" || value === "harvest" || value === "fish";
}

function isPlaceId(value: unknown): value is PlaceId {
  return typeof value === "string" && value in placeLabels;
}

function isDirection(value: unknown): value is Direction {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

function isNpcId(value: unknown): value is NpcId {
  return value === "shopkeeper" || value === "liang" || value === "auntChen" || value === "elder";
}

function sanitizeNpcRecord(value: Partial<Record<NpcId, number>> | undefined) {
  const record: Partial<Record<NpcId, number>> = {};

  for (const npcId of npcIds) {
    const count = Math.max(0, Math.floor(value?.[npcId] ?? 0));

    if (count > 0) {
      record[npcId] = count;
    }
  }

  return record;
}

function sanitizeForageRecord(value: Partial<Record<string, number>> | undefined, day: number) {
  const record: Partial<Record<string, number>> = {};
  const prefix = `${day}:`;

  for (const [key, collectedDay] of Object.entries(value ?? {})) {
    if (key.startsWith(prefix) && Math.floor(collectedDay ?? 0) === day) {
      record[key] = day;
    }
  }

  return record;
}

function sanitizeStoryEvents(value: Partial<Record<string, number>> | undefined, day: number) {
  const record: Partial<Record<string, number>> = {};
  const lowerBound = Math.max(1, day - 28);

  for (const [key, seenDay] of Object.entries(value ?? {})) {
    const normalizedDay = Math.floor(seenDay ?? 0);

    if (normalizedDay >= lowerBound && normalizedDay <= day) {
      record[key] = normalizedDay;
    }
  }

  return record;
}

function sanitizeStoryProgress(value: Partial<Record<QuestStepId, number>> | undefined) {
  const record: Partial<Record<QuestStepId, number>> = {};
  const ids = new Set(storyQuestDefinitions.map((step) => step.id));

  for (const [key, completedDay] of Object.entries(value ?? {})) {
    if (ids.has(key as QuestStepId)) {
      record[key as QuestStepId] = Math.max(1, Math.floor(completedDay ?? 1));
    }
  }

  return record;
}

function sanitizeFarmStats(value: Partial<FarmStats> | undefined): FarmStats {
  return {
    totalShipped: Math.max(0, Math.floor(value?.totalShipped ?? 0)),
    totalShippingIncome: Math.max(0, Math.floor(value?.totalShippingIncome ?? 0)),
    completedOrders: Math.max(0, Math.floor(value?.completedOrders ?? 0)),
    totalOrderRewards: Math.max(0, Math.floor(value?.totalOrderRewards ?? 0)),
    currentOrderStreak: Math.max(0, Math.floor(value?.currentOrderStreak ?? 0)),
    bestOrderStreak: Math.max(0, Math.floor(value?.bestOrderStreak ?? 0)),
  };
}

function sanitizeRelationshipRewards(value: Partial<Record<string, number>> | undefined) {
  const record: Partial<Record<string, number>> = {};

  for (const [key, day] of Object.entries(value ?? {})) {
    const [npcId, stage] = key.split(":");
    const normalizedStage = Math.floor(Number(stage));

    if (isNpcId(npcId) && normalizedStage >= 2 && normalizedStage <= 4) {
      record[`${npcId}:${normalizedStage}`] = Math.max(1, Math.floor(day ?? 1));
    }
  }

  return record;
}

function itemName(itemId: ItemId) {
  if (itemId.endsWith("_seed")) {
    return CROPS[itemId.replace("_seed", "") as CropId].seedName;
  }

  if (itemId.endsWith("_crop")) {
    return CROPS[itemId.replace("_crop", "") as CropId].name;
  }

  if (itemId.endsWith("_forage")) {
    return FORAGE[itemId.replace("_forage", "") as ForageId].name;
  }

  return FISH[itemId.replace("_fish", "") as FishId].name;
}

function itemIcon(itemId: ItemId) {
  if (itemId.endsWith("_seed") || itemId.endsWith("_crop")) {
    return ICON_FRAMES[itemId.replace(/_(seed|crop)$/, "") as CropId];
  }

  if (itemId.endsWith("_forage")) {
    return ICON_FRAMES[FORAGE[itemId.replace("_forage", "") as ForageId].icon];
  }

  return ICON_FRAMES[FISH[itemId.replace("_fish", "") as FishId].icon];
}

function sanitizeDailyOrder(value: Partial<DailyOrder> | undefined, day: number) {
  const fallback = createDailyOrder(day);

  if (!value || value.day !== day || !isCropId(value.cropId)) {
    return fallback;
  }

  return {
    day,
    cropId: value.cropId,
    count: Math.max(1, Math.floor(value.count ?? fallback.count)),
    reward: Math.max(1, Math.floor(value.reward ?? fallback.reward)),
    accepted: Boolean(value.accepted),
    completed: Boolean(value.completed),
  };
}

function hexColor(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function formatTime(minutes: number) {
  const wrapped = ((Math.floor(minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function weatherForDay(day: number): WeatherId {
  const pattern: WeatherId[] = ["sunny", "rain", "sunny", "mist", "sunny", "rain", "sunny"];
  return pattern[(Math.max(1, day) - 1) % pattern.length];
}

function seasonForDay(day: number): SeasonId {
  const pattern: SeasonId[] = ["spring", "summer", "autumn", "winter"];
  return pattern[Math.floor((Math.max(1, day) - 1) / 7) % pattern.length];
}

function seasonDayFor(day: number) {
  return ((Math.max(1, day) - 1) % 7) + 1;
}

function calendarEventForDay(day: number) {
  const seasonDay = seasonDayFor(day);
  return calendarEvents.find((event) => event.seasonDay === seasonDay);
}

function nextCalendarEvent(day: number) {
  const seasonDay = seasonDayFor(day);
  const upcoming = calendarEvents.find((event) => event.seasonDay >= seasonDay) ?? calendarEvents[0];
  const daysUntil = upcoming.seasonDay >= seasonDay
    ? upcoming.seasonDay - seasonDay
    : 7 - seasonDay + upcoming.seasonDay;

  return {
    ...upcoming,
    daysUntil,
  };
}

function activeNpcSchedule(npcId: NpcId, minutes: number) {
  const schedule = npcSchedules[npcId];
  const clampedMinutes = Math.max(START_TIME, Math.min(LATE_TIME - 1, Math.floor(minutes)));
  return schedule.find((block) => clampedMinutes >= block.start && clampedMinutes < block.end) ?? schedule[0];
}

function hasCalendarEvent(day: number, title: string) {
  return calendarEventForDay(day)?.title === title;
}

function storyBeatKey(beat: StoryBeat, day: number) {
  return `${beat.id}:${day}`;
}

function objectProp<T extends string | number | boolean>(
  object: TiledObject,
  name: string,
  fallback: T,
) {
  const prop = object.properties?.find((item) => item.name === name);
  return (prop?.value ?? fallback) as T;
}

function objectTileRect(object: TiledObject) {
  return {
    x: Math.floor(object.x / TILE),
    y: Math.floor(object.y / TILE),
    width: Math.max(1, Math.ceil(object.width / TILE)),
    height: Math.max(1, Math.ceil(object.height / TILE)),
  };
}

function containsTile(object: TiledObject, x: number, y: number) {
  const rect = objectTileRect(object);
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function parseRoute(route: string | number | boolean, fallback: TilePoint) {
  if (typeof route !== "string" || route.trim().length === 0) {
    return [fallback];
  }

  const points = route
    .split(";")
    .map((part) => {
      const [x, y] = part.split(",").map((item) => Number.parseInt(item.trim(), 10));
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    })
    .filter((point): point is TilePoint => Boolean(point));

  return points.length > 0 ? points : [fallback];
}

class FarmLifeScene extends Phaser.Scene {
  private save: FarmSave = createDefaultSave();
  private maps: Record<PlaceId, TiledMap> | null = null;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private overlayObjects: Phaser.GameObjects.GameObject[] = [];
  private messageObjects: Phaser.GameObjects.GameObject[] = [];
  private menuObjects: Phaser.GameObjects.GameObject[] = [];
  private npcActors: NpcActor[] = [];
  private playerSprite?: Phaser.GameObjects.Image;
  private audioContext?: AudioContext;
  private ambientTimer?: Phaser.Time.TimerEvent;
  private audioMuted = false;
  private inventoryOpen = false;
  private moving = false;
  private nextMoveAt = 0;
  private nextStoryCheckAt = 0;
  private readonly handleGlobalKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "i" || key === "b") {
      event.preventDefault();
      void this.ensureAudio();
      this.toggleInventory();
      return;
    }

    if (key === "j") {
      event.preventDefault();
      void this.ensureAudio();
      this.toggleJournal();
      return;
    }

    if (key === "escape" && this.inventoryOpen) {
      event.preventDefault();
      this.hideInventory();
    }

    if (event.defaultPrevented) {
      return;
    }
  };

  constructor() {
    super("farm-life");
  }

  preload() {
    this.load.spritesheet("tiles", "assets/sprites/farm-tiles.png", {
      frameWidth: TILE,
      frameHeight: TILE,
    });
    this.load.spritesheet("characters", "assets/sprites/characters.png", {
      frameWidth: TILE,
      frameHeight: TILE,
    });
    this.load.spritesheet("crops", "assets/sprites/crops.png", {
      frameWidth: TILE,
      frameHeight: TILE,
    });
    this.load.spritesheet("icons", "assets/sprites/icons.png", {
      frameWidth: TILE,
      frameHeight: TILE,
    });
    this.load.json("map-farm", "assets/maps/farm.json");
    this.load.json("map-home", "assets/maps/home.json");
    this.load.json("map-town", "assets/maps/town.json");
    this.load.json("map-shop", "assets/maps/shop.json");
    this.load.json("map-deep-forest", "assets/maps/deep-forest.json");
    this.load.json("map-beach", "assets/maps/beach.json");
    this.load.json("map-cave", "assets/maps/cave.json");
    this.load.json("map-dungeon", "assets/maps/dungeon.json");
    this.load.json("map-temple", "assets/maps/temple.json");
    this.load.json("map-barn", "assets/maps/barn.json");
  }

  create() {
    this.maps = {
      farm: this.cache.json.get("map-farm") as TiledMap,
      home: this.cache.json.get("map-home") as TiledMap,
      town: this.cache.json.get("map-town") as TiledMap,
      shop: this.cache.json.get("map-shop") as TiledMap,
      deepForest: this.cache.json.get("map-deep-forest") as TiledMap,
      beach: this.cache.json.get("map-beach") as TiledMap,
      cave: this.cache.json.get("map-cave") as TiledMap,
      dungeon: this.cache.json.get("map-dungeon") as TiledMap,
      temple: this.cache.json.get("map-temple") as TiledMap,
      barn: this.cache.json.get("map-barn") as TiledMap,
    };

    this.loadSave();
    this.normalizePlayerPosition();
    this.audioMuted = window.localStorage.getItem(AUDIO_KEY) === "muted";
    this.mergePlotZonesFromMap();
    this.ensureDailyOrder();

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        e: Phaser.Input.Keyboard.KeyCodes.E,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE,
        one: Phaser.Input.Keyboard.KeyCodes.ONE,
        two: Phaser.Input.Keyboard.KeyCodes.TWO,
        three: Phaser.Input.Keyboard.KeyCodes.THREE,
        four: Phaser.Input.Keyboard.KeyCodes.FOUR,
        five: Phaser.Input.Keyboard.KeyCodes.FIVE,
        six: Phaser.Input.Keyboard.KeyCodes.SIX,
        seven: Phaser.Input.Keyboard.KeyCodes.SEVEN,
        eight: Phaser.Input.Keyboard.KeyCodes.EIGHT,
        g: Phaser.Input.Keyboard.KeyCodes.G,
        j: Phaser.Input.Keyboard.KeyCodes.J,
        i: Phaser.Input.Keyboard.KeyCodes.I,
        b: Phaser.Input.Keyboard.KeyCodes.B,
        r: Phaser.Input.Keyboard.KeyCodes.R,
        escape: Phaser.Input.Keyboard.KeyCodes.ESC,
      }) as Record<string, Phaser.Input.Keyboard.Key>;
    }

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      void this.ensureAudio();
      this.handlePointer(pointer);
    });
    window.addEventListener("keydown", this.handleGlobalKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("keydown", this.handleGlobalKeyDown);
      this.ambientTimer?.remove(false);
    });

    this.renderAll();
    this.startAmbientLoop();
    this.showToast(`${WEATHER[this.currentWeather()].note} 按 J 打开山居日志。`);
  }

  update(time: number) {
    this.updateNpcActors(time);

    if (!this.inventoryOpen && this.messageObjects.length === 0 && time >= this.nextStoryCheckAt) {
      this.nextStoryCheckAt = time + 1200;
      this.checkStoryBeat();
    }

    if (this.moving) {
      return;
    }

    if (this.inventoryOpen) {
      return;
    }

    if (this.justDown(this.keys.one)) {
      this.selectTool("hoe");
    } else if (this.justDown(this.keys.two)) {
      this.selectTool("seed");
    } else if (this.justDown(this.keys.three)) {
      this.selectTool("water");
    } else if (this.justDown(this.keys.four)) {
      this.selectTool("harvest");
    } else if (this.justDown(this.keys.five)) {
      this.selectTool("fish");
    } else if (this.justDown(this.keys.six)) {
      this.selectSeed("turnip");
    } else if (this.justDown(this.keys.seven)) {
      this.selectSeed("wheat");
    } else if (this.justDown(this.keys.eight)) {
      this.selectSeed("potato");
    } else if (this.justDown(this.keys.r)) {
      this.eatBestSnack();
      return;
    }

    const heldDirection = this.heldMoveDirection();

    if (heldDirection && time >= this.nextMoveAt) {
      this.movePlayer(heldDirection.dx, heldDirection.dy, heldDirection.facing);
    }

    if (this.justDown(this.keys.e) || this.justDown(this.keys.space)) {
      this.interact();
    } else if (this.justDown(this.keys.g)) {
      this.giveGiftToNearbyNpc();
    }
  }

  private justDown(key?: Phaser.Input.Keyboard.Key) {
    return Boolean(key && Phaser.Input.Keyboard.JustDown(key));
  }

  private keyDown(key?: Phaser.Input.Keyboard.Key) {
    return Boolean(key?.isDown);
  }

  private heldMoveDirection() {
    if (this.keyDown(this.cursors?.left) || this.keyDown(this.keys.left)) {
      return { dx: -1, dy: 0, facing: "left" as Direction };
    }

    if (this.keyDown(this.cursors?.right) || this.keyDown(this.keys.right)) {
      return { dx: 1, dy: 0, facing: "right" as Direction };
    }

    if (this.keyDown(this.cursors?.up) || this.keyDown(this.keys.up)) {
      return { dx: 0, dy: -1, facing: "up" as Direction };
    }

    if (this.keyDown(this.cursors?.down) || this.keyDown(this.keys.down)) {
      return { dx: 0, dy: 1, facing: "down" as Direction };
    }

    return undefined;
  }

  private currentWeather() {
    return weatherForDay(this.save.day);
  }

  private currentSeason() {
    return seasonForDay(this.save.day);
  }

  private currentStoryBeat() {
    return storyBeats.find((beat) => {
      if (beat.place !== this.save.player.place) {
        return false;
      }

      if (beat.day !== undefined && beat.day !== this.save.day) {
        return false;
      }

      if (beat.seasonDay !== undefined && beat.seasonDay !== seasonDayFor(this.save.day)) {
        return false;
      }

      return this.save.timeMinutes >= beat.start && this.save.timeMinutes < beat.end;
    });
  }

  private storyQuestStatus() {
    const steps = storyQuestDefinitions.map((step) => ({
      ...step,
      done: Boolean(this.save.storyProgress[step.id]),
    }));
    const completed = steps.filter((step) => step.done).length;
    const active = steps.find((step) => !step.done) ?? steps[steps.length - 1];

    return {
      steps,
      active,
      completed,
      total: steps.length,
      complete: completed >= steps.length,
    };
  }

  private markQuestProgress(id: QuestStepId) {
    if (this.save.storyProgress[id]) {
      return "";
    }

    const step = storyQuestDefinitions.find((item) => item.id === id);

    if (!step) {
      return "";
    }

    this.save.storyProgress[id] = this.save.day;

    if (this.playerSprite) {
      this.showFloatingIcon(step.icon, this.playerSprite.x, this.playerSprite.y - 24, 0.48);
    }

    return ` 手账更新：${step.title}。`;
  }

  private currentFarmRating() {
    return farmRating({
      totalShipped: this.save.stats.totalShipped,
      totalShippingIncome: this.save.stats.totalShippingIncome,
      completedOrders: this.save.stats.completedOrders,
      totalFriendship: npcIds.reduce((sum, npcId) => sum + clampCount(this.save.friendship[npcId]), 0),
      totalMasteryLevel: masteryTrackIds.reduce(
        (sum, track) => sum + masteryLevel(this.save.mastery, track),
        0,
      ),
    });
  }

  private currentBedtimeWarning() {
    const order = this.ensureDailyOrder();

    return bedtimeWarning({
      orderAccepted: order.accepted,
      orderCompleted: order.completed,
      shippedForOrder: clampCount(this.save.shipping[order.cropId]),
      orderCount: order.count,
      timeMinutes: this.save.timeMinutes,
      energy: this.save.energy,
      sellableInventoryCount: this.currentSellableInventoryCount(),
    });
  }

  private currentBedtimeChecklist() {
    const order = this.ensureDailyOrder();

    return bedtimeChecklistHint({
      orderAccepted: order.accepted,
      orderCompleted: order.completed,
      orderReady: clampCount(this.save.shipping[order.cropId]) >= order.count,
      shippedCount: this.currentShippingItemCount(),
      sellableInventoryCount: this.currentSellableInventoryCount(),
      energy: this.save.energy,
      timeMinutes: this.save.timeMinutes,
    });
  }

  private currentBoxShippingPreview() {
    const order = this.ensureDailyOrder();
    const cropIncome = cropIds.reduce(
      (sum, cropId) => sum + clampCount(this.save.shipping[cropId]) * CROPS[cropId].sellPrice,
      0,
    );
    const forageIncome = forageIds.reduce(
      (sum, forageId) => sum + clampCount(this.save.forageShipping[forageId]) * FORAGE[forageId].sellPrice,
      0,
    );
    const fishIncome = fishIds.reduce(
      (sum, fishId) => sum + clampCount(this.save.fishShipping[fishId]) * FISH[fishId].sellPrice,
      0,
    );
    const shippedForOrder = clampCount(this.save.shipping[order.cropId]);
    const nextStreakBonus = orderStreakBonus(this.save.stats.currentOrderStreak + 1);

    return shippingPreview({
      sellableIncome: cropIncome + forageIncome + fishIncome,
      orderAccepted: order.accepted,
      orderCompleted: order.completed,
      shippedForOrder,
      orderCount: order.count,
      orderReward: order.reward,
      nextStreakBonus,
    });
  }

  private currentBedtimeReadiness() {
    const preview = this.currentBoxShippingPreview();

    return bedtimeReadinessHint({
      checklist: this.currentBedtimeChecklist(),
      expectedGold: preview.total,
      orderWillComplete: preview.orderWillComplete,
      timeMinutes: this.save.timeMinutes,
    });
  }

  private currentBedtimeShippingReminderHint() {
    const boxPreview = this.currentBoxShippingPreview();

    return bedtimeShippingReminderHint({
      sellableInventoryCount: this.currentSellableInventoryCount(),
      sellableInventoryGold: this.currentSellableInventoryValue(),
      boxedItemCount: this.currentShippingItemCount(),
      boxedGold: boxPreview.total,
      orderWillComplete: boxPreview.orderWillComplete,
      timeMinutes: this.save.timeMinutes,
    });
  }

  private currentDayEndPacingHint() {
    const order = this.ensureDailyOrder();
    const boxPreview = this.currentBoxShippingPreview();
    const shippedForOrder = clampCount(this.save.shipping[order.cropId]);

    return dayEndPacingHint({
      timeMinutes: this.save.timeMinutes,
      energy: this.save.energy,
      sellableInventoryCount: this.currentSellableInventoryCount(),
      boxedItemCount: this.currentShippingItemCount(),
      boxedGold: boxPreview.total,
      orderReady: order.accepted && !order.completed && shippedForOrder >= order.count,
      orderMissingCount: order.accepted && !order.completed ? Math.max(0, order.count - shippedForOrder) : 0,
      currentPlace: this.save.player.place,
    });
  }

  private currentShippingPreview() {
    const order = this.ensureDailyOrder();
    const cropIncome = cropIds.reduce(
      (sum, cropId) =>
        sum +
        (clampCount(this.save.inventory[cropItem(cropId)]) + clampCount(this.save.shipping[cropId])) *
          CROPS[cropId].sellPrice,
      0,
    );
    const forageIncome = forageIds.reduce(
      (sum, forageId) =>
        sum +
        (clampCount(this.save.inventory[forageItem(forageId)]) + clampCount(this.save.forageShipping[forageId])) *
          FORAGE[forageId].sellPrice,
      0,
    );
    const fishIncome = fishIds.reduce(
      (sum, fishId) =>
        sum +
        (clampCount(this.save.inventory[fishItem(fishId)]) + clampCount(this.save.fishShipping[fishId])) *
          FISH[fishId].sellPrice,
      0,
    );
    const shippedForOrder = this.currentOrderAvailableCount(order);
    const nextStreakBonus = orderStreakBonus(this.save.stats.currentOrderStreak + 1);

    return shippingPreview({
      sellableIncome: cropIncome + forageIncome + fishIncome,
      orderAccepted: order.accepted,
      orderCompleted: order.completed,
      shippedForOrder,
      orderCount: order.count,
      orderReward: order.reward,
      nextStreakBonus,
    });
  }

  private currentOrderAvailableCount(order = this.ensureDailyOrder()) {
    return clampCount(this.save.inventory[cropItem(order.cropId)]) + clampCount(this.save.shipping[order.cropId]);
  }

  private currentOrderProgress(order = this.ensureDailyOrder()) {
    return orderFulfillmentProgress({
      availableCount: this.currentOrderAvailableCount(order),
      requiredCount: order.count,
      accepted: order.accepted,
      completed: order.completed,
    });
  }

  private grantRelationshipReward(npcId: NpcId, stageLevel: number, x: number, y: number) {
    const rewardItem = relationshipRewardItems[npcId][stageLevel];

    if (!rewardItem) {
      return "";
    }

    const key = `${npcId}:${stageLevel}`;

    if (this.save.relationshipRewards[key]) {
      return "";
    }

    this.save.relationshipRewards[key] = this.save.day;
    this.save.inventory[rewardItem] = clampCount(this.save.inventory[rewardItem]) + 1;
    this.showFloatingIcon(itemIcon(rewardItem), x, y - 28, 0.5);

    return ` ${relationshipRewardHint({
      npcName: npcDisplayNames[npcId],
      stageLabel: relationshipStageLabels[stageLevel] ?? "关系",
      rewardName: itemName(rewardItem),
    })}。`;
  }

  private gainMastery(track: MasteryTrackId, amount: number, floating = true) {
    const result = addMasteryXp(this.save.mastery, track, amount);

    if (result.xpGained === 0) {
      return "";
    }

    const display = masteryDisplay[track];

    if (floating && this.playerSprite) {
      const label = result.leveledUp
        ? `${display.name} Lv.${result.currentLevel}`
        : `+${result.xpGained} ${display.name}`;
      this.showFloatingIcon(ICON_FRAMES[display.icon], this.playerSprite.x, this.playerSprite.y - 22, 0.38);
      this.showFloatingText(label, this.playerSprite.x, this.playerSprite.y - 42, result.leveledUp ? 0xffefba : 0xecfccb);
    }

    return result.leveledUp
      ? ` ${display.name}提升到 ${result.currentLevel} 级！`
      : ` ${display.name}经验 +${result.xpGained}。`;
  }

  private rememberAction(action: string) {
    this.save.lastAction = action.slice(0, 28);
  }

  private checkStoryBeat() {
    const beat = this.currentStoryBeat();

    if (!beat) {
      return;
    }

    const key = storyBeatKey(beat, this.save.day);

    if (this.save.seenStoryEvents[key]) {
      return;
    }

    this.save.seenStoryEvents[key] = this.save.day;
    this.persist();
    this.playSfx("menu");

    if (this.playerSprite) {
      this.showFloatingIcon(beat.icon, this.playerSprite.x, this.playerSprite.y - 20, 0.5);
    }

    this.showToast(`${beat.title}：${beat.message}`);
  }

  private currentMap() {
    if (!this.maps) {
      throw new Error("Tiled maps have not loaded.");
    }

    return this.maps[this.save.player.place];
  }

  private viewWidth() {
    return this.scale.width || VIEW_WIDTH;
  }

  private viewHeight() {
    return this.scale.height || VIEW_HEIGHT;
  }

  private playerScreenPoint() {
    const playerX = this.tileCenterX(this.save.player.x);
    const playerY = this.tileCenterY(this.save.player.y);

    return {
      x: playerX - this.cameras.main.scrollX,
      y: playerY - this.cameras.main.scrollY,
    };
  }

  private playerOverlapsScreenRect(x: number, y: number, width: number, height: number, padding = 0) {
    const player = this.playerScreenPoint();

    return (
      player.x >= x - padding &&
      player.x <= x + width + padding &&
      player.y >= y - padding &&
      player.y <= y + height + padding
    );
  }

  private mapPixelWidth() {
    return this.currentMap().width * TILE;
  }

  private mapPixelHeight() {
    return this.currentMap().height * TILE;
  }

  private getObjects(place = this.save.player.place, type?: string) {
    const map = this.maps?.[place];

    if (!map) {
      return [];
    }

    return map.layers
      .filter((layer): layer is Extract<TiledLayer, { type: "objectgroup" }> => layer.type === "objectgroup")
      .flatMap((layer) => layer.objects)
      .filter((object) => !type || object.type === type);
  }

  private loadSave() {
    const raw = window.localStorage.getItem(SAVE_KEY) ?? window.localStorage.getItem("farm-life-mvp-save-v1");

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<FarmSave>;
      const fallback = createDefaultSave();
      const parsedPlayer = parsed.player ?? fallback.player;
      const day = Math.max(1, Math.floor(parsed.day ?? fallback.day));

      this.save = {
        day,
        gold: Math.max(0, Math.floor(parsed.gold ?? fallback.gold)),
        energy: Math.max(0, Math.min(MAX_ENERGY, Math.floor(parsed.energy ?? fallback.energy))),
        timeMinutes: Math.max(START_TIME, Math.min(LATE_TIME, Math.floor(parsed.timeMinutes ?? fallback.timeMinutes))),
        lastAction: typeof parsed.lastAction === "string" ? parsed.lastAction.slice(0, 28) : fallback.lastAction,
        player: {
          place: isPlaceId(parsedPlayer.place) ? parsedPlayer.place : fallback.player.place,
          x: Math.max(0, Math.floor(parsedPlayer.x ?? fallback.player.x)),
          y: Math.max(0, Math.floor(parsedPlayer.y ?? fallback.player.y)),
          facing: isDirection(parsedPlayer.facing) ? parsedPlayer.facing : fallback.player.facing,
        },
        selectedTool: isToolId(parsed.selectedTool) ? parsed.selectedTool : fallback.selectedTool,
        selectedSeed: isCropId(parsed.selectedSeed) ? parsed.selectedSeed : fallback.selectedSeed,
        inventory: {
          ...fallback.inventory,
          ...(parsed.inventory ?? {}),
        },
        shipping: {
          ...(parsed.shipping ?? {}),
        },
        forageShipping: {
          ...(parsed.forageShipping ?? {}),
        },
        fishShipping: {
          ...(parsed.fishShipping ?? {}),
        },
        stats: sanitizeFarmStats(parsed.stats),
        collectedForage: sanitizeForageRecord(parsed.collectedForage, day),
        plots: {
          ...fallback.plots,
          ...(parsed.plots ?? {}),
        },
        friendship: sanitizeNpcRecord(parsed.friendship),
        talkedToNpcs: sanitizeNpcRecord(parsed.talkedToNpcs),
        giftGivenToNpcs: sanitizeNpcRecord(parsed.giftGivenToNpcs),
        relationshipRewards: sanitizeRelationshipRewards(parsed.relationshipRewards),
        mastery: sanitizeMastery(parsed.mastery),
        mailReadDay: Math.max(0, Math.floor(parsed.mailReadDay ?? fallback.mailReadDay)),
        dailyOrder: sanitizeDailyOrder(parsed.dailyOrder, day),
        seenStoryEvents: sanitizeStoryEvents(parsed.seenStoryEvents, day),
        storyProgress: sanitizeStoryProgress(parsed.storyProgress),
      };
    } catch {
      window.localStorage.removeItem(SAVE_KEY);
      window.localStorage.removeItem("farm-life-mvp-save-v1");
    }
  }

  private normalizePlayerPosition() {
    const map = this.maps?.[this.save.player.place];

    if (!map) {
      return;
    }

    const x = Phaser.Math.Clamp(this.save.player.x, 1, map.width - 2);
    const y = Phaser.Math.Clamp(this.save.player.y, 1, map.height - 2);

    if (!this.isBlocked(this.save.player.place, x, y)) {
      this.save.player.x = x;
      this.save.player.y = y;
      return;
    }

    const fallback: Record<PlaceId, TilePoint> = {
      farm: { x: 5, y: 7 },
      home: { x: 21, y: 25 },
      town: { x: 21, y: 26 },
      shop: { x: 21, y: 25 },
      deepForest: { x: 1, y: 15 },
      beach: { x: 21, y: 1 },
      cave: { x: 21, y: 25 },
      dungeon: { x: 21, y: 25 },
      temple: { x: 21, y: 25 },
      barn: { x: 21, y: 25 },
    };
    this.save.player.x = fallback[this.save.player.place].x;
    this.save.player.y = fallback[this.save.player.place].y;
  }

  private mergePlotZonesFromMap() {
    for (const object of this.getObjects("farm", "plot-zone")) {
      const rect = objectTileRect(object);

      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) {
          const key = plotKey(x, y);
          this.save.plots[key] ??= {
            tilled: false,
            watered: false,
            growth: 0,
          };
        }
      }
    }
  }

  private ensureDailyOrder() {
    if (this.save.dailyOrder.day !== this.save.day) {
      this.save.dailyOrder = createDailyOrder(this.save.day);
    }

    return this.save.dailyOrder;
  }

  private persist() {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
  }

  private async ensureAudio() {
    if (this.audioMuted) {
      return;
    }

    const AudioCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtor) {
      return;
    }

    this.audioContext ??= new AudioCtor();

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume().catch(() => undefined);
    }
  }

  private toggleAudio() {
    this.audioMuted = !this.audioMuted;
    window.localStorage.setItem(AUDIO_KEY, this.audioMuted ? "muted" : "on");

    if (!this.audioMuted) {
      void this.ensureAudio().then(() => this.emitSfx("menu"));
    }

    this.renderUi();
  }

  private startAmbientLoop() {
    this.ambientTimer?.remove(false);
    this.ambientTimer = this.time.addEvent({
      delay: 6400,
      loop: true,
      callback: () => this.playSfx("ambient"),
    });
  }

  private playSfx(kind: SfxId) {
    if (this.audioMuted) {
      return;
    }

    void this.ensureAudio().then(() => this.emitSfx(kind));
  }

  private emitSfx(kind: SfxId) {
    const ctx = this.audioContext;

    if (!ctx || ctx.state !== "running") {
      return;
    }

    if (kind === "hoe") {
      this.playTone(140, 0.045, "square", 0, 0.034);
      this.playTone(92, 0.06, "triangle", 0.035, 0.028);
      return;
    }

    if (kind === "seed") {
      this.playTone(520, 0.045, "triangle", 0, 0.026);
      this.playTone(660, 0.055, "triangle", 0.045, 0.022);
      return;
    }

    if (kind === "water") {
      [620, 740, 880].forEach((freq, index) => this.playTone(freq, 0.05, "sine", index * 0.035, 0.018));
      return;
    }

    if (kind === "harvest") {
      this.playTone(392, 0.055, "triangle", 0, 0.028);
      this.playTone(784, 0.085, "sine", 0.055, 0.026);
      return;
    }

    if (kind === "fish") {
      [520, 620, 740].forEach((freq, index) => this.playTone(freq, 0.07, "sine", index * 0.055, 0.018));
      this.playTone(150, 0.09, "triangle", 0.18, 0.018);
      return;
    }

    if (kind === "coin") {
      this.playTone(880, 0.055, "square", 0, 0.024);
      this.playTone(1175, 0.08, "triangle", 0.06, 0.026);
      return;
    }

    if (kind === "menu") {
      this.playTone(330, 0.045, "triangle", 0, 0.022);
      this.playTone(440, 0.045, "triangle", 0.05, 0.018);
      return;
    }

    if (kind === "day") {
      [392, 494, 587].forEach((freq, index) => this.playTone(freq, 0.16, "triangle", index * 0.12, 0.022));
      return;
    }

    if (kind === "step") {
      this.playTone(105, 0.025, "triangle", 0, 0.012);
      return;
    }

    const weather = this.currentWeather();
    if (weather === "rain") {
      [660, 720, 600].forEach((freq, index) => this.playTone(freq, 0.035, "sine", index * 0.05, 0.01));
    } else {
      [262, 330].forEach((freq, index) => this.playTone(freq, 0.22, "triangle", index * 0.18, 0.01));
    }
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    delay = 0,
    volume = 0.02,
  ) {
    const ctx = this.audioContext;

    if (!ctx) {
      return;
    }

    const startAt = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.035);
  }

  private renderAll() {
    this.clearObjects(this.mapObjects);
    this.clearObjects(this.uiObjects);
    this.clearObjects(this.overlayObjects);
    this.clearObjects(this.messageObjects);
    this.clearObjects(this.menuObjects);
    this.inventoryOpen = false;
    this.npcActors = [];
    this.playerSprite?.destroy();
    this.playerSprite = undefined;

    this.addMapObject(
      this.add
        .rectangle(this.mapPixelWidth() / 2, this.mapPixelHeight() / 2, this.mapPixelWidth(), this.mapPixelHeight(), 0x2a1a10)
        .setDepth(-10),
    );
    this.renderMap();
    this.renderCrops();
    this.renderForage();
    this.renderNpcs();
    this.renderPlayer();
    this.setupCamera();
    this.renderWeather();
    this.renderInteractionOverlay();
    this.renderUi();
  }

  private setupCamera() {
    const camera = this.cameras.main;
    const mapWidth = this.mapPixelWidth();
    const mapHeight = this.mapPixelHeight();

    camera.setBackgroundColor(0x2a1a10);
    camera.setBounds(0, 0, mapWidth, mapHeight);

    if (this.playerSprite) {
      camera.startFollow(this.playerSprite, true, 0.18, 0.18, 0, 40);
    }
  }

  private clearObjects(objects: Phaser.GameObjects.GameObject[]) {
    for (const object of objects) {
      object.destroy();
    }
    objects.length = 0;
  }

  private addMapObject<T extends Phaser.GameObjects.GameObject>(object: T) {
    this.mapObjects.push(object);
    return object;
  }

  private fixedToCamera<T extends Phaser.GameObjects.GameObject>(object: T) {
    const fixed = object as T & { setScrollFactor?: (x: number, y?: number) => T };
    fixed.setScrollFactor?.(0);
    return object;
  }

  private addUiObject<T extends Phaser.GameObjects.GameObject>(object: T) {
    this.fixedToCamera(object);
    this.uiObjects.push(object);
    return object;
  }

  private addOverlayObject<T extends Phaser.GameObjects.GameObject>(object: T) {
    this.overlayObjects.push(object);
    return object;
  }

  private addMessageObject<T extends Phaser.GameObjects.GameObject>(object: T) {
    this.fixedToCamera(object);
    this.messageObjects.push(object);
    return object;
  }

  private addMenuObject<T extends Phaser.GameObjects.GameObject>(object: T) {
    this.fixedToCamera(object);
    this.menuObjects.push(object);
    return object;
  }

  private renderMap() {
    const map = this.currentMap();
    let depth = 0;

    for (const layer of map.layers) {
      if (layer.type !== "tilelayer" || !layer.visible) {
        continue;
      }

      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const gid = layer.data[y * map.width + x];

          if (gid === 0) {
            continue;
          }

          const frame = this.getDynamicTileFrame(layer.name, gid - 1, x, y);
          this.addTileFrame(frame, x, y, depth);
        }
      }

      depth += 2;
    }

    this.addMapObject(
      this.add
        .rectangle(MAP_X - 2, MAP_Y - 2, this.mapPixelWidth() + 4, this.mapPixelHeight() + 4)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xf8fafc, 0.35),
    );

    this.renderMapLabels();
  }

  private getDynamicTileFrame(layerName: string, fallbackFrame: number, x: number, y: number) {
    if (this.save.player.place !== "farm" || layerName !== "Ground") {
      return fallbackFrame;
    }

    const plot = this.save.plots[plotKey(x, y)];

    if (!plot) {
      return fallbackFrame;
    }

    if (!plot.tilled) {
      return TILE_FRAMES.field;
    }

    return plot.watered || this.currentWeather() === "rain" ? TILE_FRAMES.wet : TILE_FRAMES.soil;
  }

  private tileFrameAt(place: PlaceId, x: number, y: number) {
    const map = this.maps?.[place];

    if (!map || !this.inMap(x, y, place)) {
      return undefined;
    }

    for (const layer of map.layers) {
      if (layer.type !== "tilelayer" || !layer.visible) {
        continue;
      }

      const gid = layer.data[y * map.width + x];

      if (gid > 0) {
        return gid - 1;
      }
    }

    return undefined;
  }

  private isFishableWater(x: number, y: number) {
    return this.tileFrameAt(this.save.player.place, x, y) === TILE_FRAMES.water;
  }

  private renderCrops() {
    if (this.save.player.place !== "farm") {
      return;
    }

    for (const [key, plot] of Object.entries(this.save.plots)) {
      if (!plot.cropId) {
        continue;
      }

      const [x, y] = key.split(",").map((part) => Number.parseInt(part, 10));

      if (!this.inMap(x, y)) {
        continue;
      }

      this.addMapObject(
        this.add
          .image(this.tileCenterX(x), this.tileCenterY(y), "crops", this.getCropFrame(plot))
          .setDepth(6),
      );
    }
  }

  private renderForage() {
    for (const spawn of this.forageSpawns()) {
      const item = FORAGE[spawn.id];
      const sprite = this.addMapObject(
        this.add
          .image(this.tileCenterX(spawn.x), this.tileCenterY(spawn.y), "icons", ICON_FRAMES[item.icon])
          .setScale(0.64)
          .setDepth(7),
      );

      this.tweens.add({
        targets: sprite,
        y: sprite.y - 3,
        yoyo: true,
        repeat: -1,
        duration: 900 + ((spawn.x + spawn.y) % 4) * 120,
        ease: "Sine.easeInOut",
      });
    }
  }

  private forageSpawns(place = this.save.player.place): ForageSpawn[] {
    if (place !== "farm" && place !== "town") {
      return [];
    }

    const pool = seasonalForage[this.currentSeason()];
    const placeBias = place === "town" ? 7 : 3;

    return forageSpawnPoints[place]
      .map((point, index) => ({
        id: pool[(this.save.day + index + placeBias) % pool.length],
        place,
        x: point.x,
        y: point.y,
      }))
      .filter((_spawn, index) => ((this.save.day * 23 + index * 11 + placeBias) % 10) < 7)
      .slice(0, place === "farm" ? 4 : 5)
      .filter((spawn) => !this.save.collectedForage[forageKey(this.save.day, spawn.place, spawn.id, spawn.x, spawn.y)]);
  }

  private forageAt(x: number, y: number) {
    return this.forageSpawns().find((spawn) => spawn.x === x && spawn.y === y);
  }

  private renderNpcs() {
    const weather = this.currentWeather();
    const objectsByNpc = new Map<NpcId, TiledObject>();

    for (const object of this.getObjects(this.save.player.place, "npc")) {
      const npcId = objectProp(object, "npcId", object.name);

      if (!isNpcId(npcId)) {
        continue;
      }

      objectsByNpc.set(npcId, object);
    }

    npcIds.forEach((npcId, index) => {
      const schedule = activeNpcSchedule(npcId, this.save.timeMinutes);

      if (schedule.place !== this.save.player.place) {
        return;
      }

      const object = objectsByNpc.get(npcId);
      const fallback = object ? objectTileRect(object) : { x: 1, y: 1 };
      const route = parseRoute(schedule.route, fallback);
      const minutesIntoBlock = Math.max(0, this.save.timeMinutes - schedule.start);
      const routeIndex = Math.max(0, (Math.floor(minutesIntoBlock / 30) + this.save.day + index) % route.length);
      const start = route[routeIndex];
      const displayName = npcDisplayNames[npcId];
      const statusLabel = this.npcMapLabelFor(npcId, displayName, schedule.activity);
      const sprite = this.addMapObject(
        this.add
          .image(this.tileCenterX(start.x), this.tileCenterY(start.y), "characters", CHARACTER_FRAMES[npcId])
          .setDepth(18),
      );
      const label = this.addMapObject(
        this.add
          .text(this.tileCenterX(start.x), this.tileCenterY(start.y) + 17, statusLabel, {
            color: weather === "mist" ? "#f8fafc" : "#1f2937",
            fontFamily: "Inter, PingFang SC, Microsoft YaHei, sans-serif",
            fontSize: "9px",
            fontStyle: "700",
          })
          .setOrigin(0.5, 0)
          .setDepth(19),
      );

      this.npcActors.push({
        id: npcId,
        name: displayName,
        sprite,
        label,
        route,
        routeIndex,
        x: start.x,
        y: start.y,
        nextMoveAt: this.time.now + 1200 + index * 260,
        activity: schedule.activity,
        dialog: schedule.dialog,
        rainDialog: schedule.rainDialog ?? (object ? String(objectProp(object, "rainDialog", "")) || undefined : undefined),
        mistDialog: schedule.mistDialog ?? (object ? String(objectProp(object, "mistDialog", "")) || undefined : undefined),
      });
    });
  }

  private npcMapLabelFor(npcId: NpcId, name: string, activity: string) {
    return npcMapLabel({
      name,
      activity,
      talkedToday: this.save.talkedToNpcs[npcId] === this.save.day,
      giftedToday: this.save.giftGivenToNpcs[npcId] === this.save.day,
      giftReady: this.save.giftGivenToNpcs[npcId] !== this.save.day && Boolean(this.chooseGiftForNpc(npcId)),
    });
  }

  private refreshNpcActorLabel(npc: NpcActor) {
    npc.label.setText(this.npcMapLabelFor(npc.id, npc.name, npc.activity));
  }

  private updateNpcActors(time: number) {
    for (const actor of this.npcActors) {
      if (actor.route.length <= 1 || time < actor.nextMoveAt || this.tweens.isTweening(actor.sprite)) {
        continue;
      }

      const nextIndex = (actor.routeIndex + 1) % actor.route.length;
      const next = actor.route[nextIndex];

      if (this.save.player.x === next.x && this.save.player.y === next.y) {
        actor.nextMoveAt = time + 900;
        continue;
      }

      actor.routeIndex = nextIndex;
      actor.x = next.x;
      actor.y = next.y;
      actor.nextMoveAt = time + 1600;

      this.tweens.add({
        targets: [actor.sprite, actor.label],
        x: this.tileCenterX(next.x),
        y: (target: Phaser.GameObjects.GameObject) =>
          target === actor.label ? this.tileCenterY(next.y) + 17 : this.tileCenterY(next.y),
        duration: 520,
        ease: "Sine.easeInOut",
      });
    }
  }

  private renderPlayer() {
    this.playerSprite = this.add
      .image(
        this.tileCenterX(this.save.player.x),
        this.tileCenterY(this.save.player.y),
        "characters",
        playerFrames[this.save.player.facing],
      )
      .setDepth(20);
  }

  private renderWeather() {
    const weather = this.currentWeather();

    if (weather === "sunny") {
      this.addMapObject(
        this.add
          .rectangle(MAP_X, MAP_Y, this.mapPixelWidth(), this.mapPixelHeight(), 0xfff4b8, 0.08)
          .setOrigin(0, 0)
          .setDepth(30),
      );
      this.renderSeasonTint();
      this.renderTimeTint();
      return;
    }

    if (weather === "mist") {
      this.addMapObject(
        this.add
          .rectangle(MAP_X, MAP_Y, this.mapPixelWidth(), this.mapPixelHeight(), 0xdbeafe, 0.24)
          .setOrigin(0, 0)
          .setDepth(30),
      );

      for (let i = 0; i < 8; i += 1) {
        const band = this.addMapObject(
          this.add
            .ellipse(MAP_X + 100 + i * 150, MAP_Y + 80 + ((i * 53) % Math.max(360, this.mapPixelHeight() - 160)), 190, 22, 0xf8fafc, 0.18)
            .setDepth(31),
        );
        this.tweens.add({
          targets: band,
          x: band.x + 22,
          yoyo: true,
          repeat: -1,
          duration: 2200 + i * 180,
          ease: "Sine.easeInOut",
        });
      }
      this.renderSeasonTint();
      this.renderTimeTint();
      return;
    }

    this.addMapObject(
      this.add
        .rectangle(MAP_X, MAP_Y, this.mapPixelWidth(), this.mapPixelHeight(), 0x0f172a, 0.18)
        .setOrigin(0, 0)
        .setDepth(30),
    );

    for (let i = 0; i < 86; i += 1) {
      const x = MAP_X + ((i * 53 + this.save.day * 17) % this.mapPixelWidth());
      const y = MAP_Y + ((i * 29 + this.save.day * 11) % this.mapPixelHeight());
      const drop = this.addMapObject(
        this.add
          .rectangle(x, y, 2, 13, 0x93c5fd, 0.62)
          .setAngle(-15)
          .setDepth(32),
      );
      this.tweens.add({
        targets: drop,
        y: y + 42,
        alpha: 0.1,
        repeat: -1,
        duration: 760 + (i % 5) * 70,
        delay: (i % 8) * 60,
      });
    }

    this.renderSeasonTint();
    this.renderTimeTint();
  }

  private renderSeasonTint() {
    const season = SEASONS[this.currentSeason()];

    if (season.alpha <= 0) {
      return;
    }

    this.addMapObject(
      this.add
        .rectangle(MAP_X, MAP_Y, this.mapPixelWidth(), this.mapPixelHeight(), season.tint, season.alpha)
        .setOrigin(0, 0)
        .setDepth(33),
    );
  }

  private renderTimeTint() {
    const hour = this.save.timeMinutes / 60;
    let alpha = 0;
    let color = 0x0f172a;

    if (hour < 7) {
      alpha = 0.1;
      color = 0xf59e0b;
    } else if (hour >= 18) {
      alpha = Math.min(0.32, 0.08 + ((hour - 18) / 8) * 0.24);
    }

    if (alpha <= 0) {
      return;
    }

    this.addMapObject(
      this.add
        .rectangle(MAP_X, MAP_Y, this.mapPixelWidth(), this.mapPixelHeight(), color, alpha)
        .setOrigin(0, 0)
        .setDepth(35),
    );
  }

  private refreshInteractionOverlay() {
    this.clearObjects(this.overlayObjects);
    this.renderInteractionOverlay();
  }

  private renderInteractionOverlay() {
    const front = this.frontTile();

    if (!this.inMap(front.x, front.y)) {
      return;
    }

    const plot = this.save.player.place === "farm" ? this.save.plots[plotKey(front.x, front.y)] : undefined;
    const label = this.interactionLabelAt(front.x, front.y);

    if (!plot && !label) {
      return;
    }

    const x = this.tileCenterX(front.x);
    const y = this.tileCenterY(front.y);
    this.addOverlayObject(
      this.add
        .rectangle(x, y, TILE - 5, TILE - 5)
        .setStrokeStyle(2, label ? 0xfff0a3 : 0xf8fafc, label ? 0.95 : 0.45)
        .setDepth(36),
    );

    if (!label) {
      return;
    }

    const labelWidth = Math.max(104, Math.min(260, label.length * 9));
    this.addOverlayObject(
      this.add
        .rectangle(x, y - 32, labelWidth, 24, 0x3a2212, 0.88)
        .setStrokeStyle(2, 0xf8d9a0, 0.9)
        .setDepth(38),
    );
    this.addOverlayObject(
      this.add
        .text(x, y - 39, label, {
          color: "#fff3c4",
          fontFamily: UI_FONT,
          fontSize: "11px",
          fontStyle: "700",
        })
        .setOrigin(0.5, 0)
        .setDepth(39),
    );
  }

  private interactionLabelAt(x: number, y: number) {
    const npc = this.getNpcForInteraction(x, y);

    if (npc) {
      const bonus = socialFriendshipBonus(masteryLevel(this.save.mastery, "social"));
      const gift = this.chooseGiftForNpc(npc.id);
      const relation = relationshipProgressLabel(clampCount(this.save.friendship[npc.id]));
      const talkedToday = this.save.talkedToNpcs[npc.id] === this.save.day;
      const giftedToday = this.save.giftGivenToNpcs[npc.id] === this.save.day;

      if (gift) {
        const teaBonus = hasCalendarEvent(this.save.day, "邻里茶会") ? 1 : 0;
        const points = giftFriendshipPoints(gift.points, teaBonus, bonus);

        return npcInteractionStateHint({
          relationshipLabel: relation,
          talkedToday,
          giftedToday,
          giftHint: giftMotivationHint({
            npcName: npcDisplayNames[npc.id],
            currentFriendship: clampCount(this.save.friendship[npc.id]),
            giftName: gift.name,
            giftPoints: points,
            loved: gift.loved,
            alreadyGifted: giftedToday,
            nextRewardName: this.nextRelationshipRewardName(npc.id),
          }),
          socialBonus: bonus,
        });
      }

      return npcInteractionStateHint({
        relationshipLabel: relation,
        talkedToday,
        giftedToday,
        socialBonus: bonus,
      });
    }

    const forage = this.forageAt(x, y);

    if (forage) {
      const forageData = FORAGE[forage.id];
      const count = forageYield(1, masteryLevel(this.save.mastery, "foraging"), this.save.day, forage.x, forage.y);
      const energyGain = snackEnergyValue(forageData.sellPrice, "forage");

      return `E 采集 ${forageActionHint({
        name: forageData.name,
        count,
        sellPrice: forageData.sellPrice,
        energyGain,
      })} · 5分`;
    }

    const transition = this.getObjects(this.save.player.place, "transition").find((object) => containsTile(object, x, y));

    if (transition) {
      const targetPlace = objectProp<string>(transition, "targetPlace", "");

      if (isPlaceId(targetPlace)) {
        return `E ${this.transitionTravelPromptFor(targetPlace, placeTravelActions[targetPlace])}`;
      }

      return "E 前往 15分";
    }

    const interaction = this.getObjects(this.save.player.place, "interaction").find((object) => containsTile(object, x, y));

    if (interaction) {
      const action = objectProp<string>(interaction, "action", "");

      if (action === "sleep") {
        return mapInteractionCueHint({
          actionLabel: "睡觉",
          purposeHint: this.currentBedtimeReadiness(),
          nextStepHint: this.currentBedtimeShippingReminderHint(),
        });
      }

      if (action === "ship") {
        const preview = this.currentShippingPreview();
        const boxCount = this.currentShippingItemCount();
        const backpackCount = this.currentSellableInventoryCount();

        return mapInteractionCueHint({
          actionLabel: "售卖箱",
          purposeHint: shippingActionHint({
            backpackCount,
            boxCount,
            totalGold: preview.total,
            orderWillComplete: preview.orderWillComplete,
          }),
          nextStepHint: this.currentShippingUrgencyHint(),
        });
      }

      if (action === "order-board") {
        const order = this.ensureDailyOrder();

        return mapInteractionCueHint({
          actionLabel: "公告板",
          purposeHint: this.orderBoardActionHintFor(order),
          nextStepHint: this.orderNextStepHintFor(order),
        });
      }

      if (action === "mailbox") {
        return mapInteractionCueHint({
          actionLabel: "读信",
          purposeHint: this.save.mailReadDay === this.save.day ? "今日已读" : "新信/天气",
          nextStepHint: this.currentDailyObjective().label,
        });
      }

      if (action === "forecast") {
        return mapInteractionCueHint({
          actionLabel: "看天气",
          purposeHint: weatherHudPlanHint({ weatherName: WEATHER[this.currentWeather()].name, weatherPlan: this.weatherPlanFor(this.currentWeather()) }),
          nextStepHint: "安排田地",
        });
      }

      return `E ${objectProp(interaction, "label", "互动")}`;
    }

    const closed = this.getObjects(this.save.player.place, "closed-building").find((object) => containsTile(object, x, y));

    if (closed) {
      return mapInteractionCueHint({
        actionLabel: "查看",
        purposeHint: objectProp<string>(closed, "label", "暂未开放"),
        nextStepHint: "看日志/地图",
      });
    }

    const counter = this.getObjects(this.save.player.place, "counter").find((object) => containsTile(object, x, y));

    if (counter) {
      return mapInteractionCueHint({
        actionLabel: "柜台",
        purposeHint: "买种子",
        nextStepHint: this.currentSeedRouteHint(),
      });
    }

    if (this.save.selectedTool === "fish" && this.isFishableWater(x, y)) {
      const catchTier = this.fishingCatchTierAt(x, y);
      const previewFishId = this.fishIdForTier(catchTier);
      const previewText = previewFishId
        ? fishingCastPreviewHint({
            tier: catchTier,
            catchName: FISH[previewFishId].name,
            sellPrice: FISH[previewFishId].sellPrice,
          })
        : fishingCastPreviewHint({ tier: catchTier });
      const hint = fishingConditionHint({
        weather: this.currentWeather(),
        timeMinutes: this.save.timeMinutes,
        pondLights: hasCalendarEvent(this.save.day, "溪畔夜灯"),
      });
      const spotPlan = fishingSpotPlanHint({
        previewHint: previewText,
        condition: hint,
        energy: this.save.energy,
        timeMinutes: this.save.timeMinutes,
        fishInventoryCount: this.currentFishInventoryCount(),
      });
      const actionJuice = this.fishingActionJuiceFor(previewText);
      const biteCue = this.fishingBiteCueFor(catchTier);
      const basketRoute = this.currentFishingBasketRouteHint();

      const energyText = actionEnergyHint({
        energy: this.save.energy,
        cost: this.energyCostForTool("fish"),
        minutes: FISHING_MINUTES,
      });

      return `E 抛竿 ${energyText} · ${spotPlan} · ${biteCue} · ${actionJuice} · ${basketRoute}`;
    }

    if (this.save.player.place === "farm" && this.save.plots[plotKey(x, y)]) {
      return this.farmActionPreview(x, y);
    }

    return undefined;
  }

  private farmActionPreview(x: number, y: number) {
    const plot = this.save.plots[plotKey(x, y)];
    const energyText = actionEnergyHint({
      energy: this.save.energy,
      cost: this.energyCostForTool(this.save.selectedTool),
      minutes: ACTION_MINUTES,
    });
    const farmingLevel = masteryLevel(this.save.mastery, "farming");
    const perkText = farmingLevel >= 2 ? " 熟练省体" : "";

    if (!plot) {
      return undefined;
    }

    const crop = plot.cropId ? CROPS[plot.cropId] : undefined;
    const growth = crop ? cropGrowthStatus(plot.growth, crop.growDays) : undefined;
    const seedCount = clampCount(this.save.inventory[seedItem(this.save.selectedSeed)]);
    const stateHint = farmToolStateHint({
      tool: this.save.selectedTool,
      tilled: plot.tilled,
      cropPlanted: Boolean(plot.cropId),
      mature: Boolean(growth?.mature),
      watered: plot.watered,
      raining: this.currentWeather() === "rain",
      seedCount,
    });
    const decisionHint = fieldTileDecisionHint({
      tool: this.save.selectedTool,
      tilled: plot.tilled,
      cropName: crop?.name,
      growthLabel: growth?.label,
      mature: Boolean(growth?.mature),
      watered: plot.watered,
      raining: this.currentWeather() === "rain",
      seedName: CROPS[this.save.selectedSeed].name,
      seedCount,
      energyCost: this.energyCostForTool(this.save.selectedTool),
      minutesPerAction: ACTION_MINUTES,
      sellPrice: crop?.sellPrice,
    });
    const tactileHint = fieldTactileCueHint({
      tool: this.save.selectedTool,
      tilled: plot.tilled,
      cropPlanted: Boolean(plot.cropId),
      mature: Boolean(growth?.mature),
      watered: plot.watered,
      raining: this.currentWeather() === "rain",
      seedCount,
      energy: this.save.energy,
      energyCost: this.energyCostForTool(this.save.selectedTool),
    });

    if (this.save.selectedTool === "seed") {
      if (stateHint !== "可播种") {
        return `${stateHint} · ${decisionHint} · ${tactileHint}`;
      }

      return `E 播${CROPS[this.save.selectedSeed].name} ${energyText} · ${seedCount}包${perkText} · ${decisionHint} · ${tactileHint}`;
    }

    if (this.save.selectedTool === "harvest") {
      if (!plot.cropId || !crop || !growth) {
        return `${stateHint} · ${decisionHint} · ${tactileHint}`;
      }

      const status = growth.mature ? "收获" : `${crop.name} ${growth.label}`;

      return `E ${status} ${energyText}${perkText} · ${decisionHint} · ${tactileHint}`;
    }

    if (this.save.selectedTool === "water") {
      return stateHint === "可浇水"
        ? `E 浇水 ${energyText}${perkText} · ${decisionHint} · ${tactileHint}`
        : `${stateHint} · ${decisionHint} · ${tactileHint}`;
    }

    if (this.save.selectedTool === "hoe" && stateHint !== "可开垦") {
      return `${stateHint} · ${decisionHint} · ${tactileHint}`;
    }

    return `E ${toolLabels[this.save.selectedTool]} ${energyText}${perkText} · ${decisionHint} · ${tactileHint}`;
  }

  private renderMapLabels() {
    const place = this.save.player.place;
    this.addMapText(this.currentObjectiveMapMarker(), 1.2, 1.1, 11, 0x7c2d12);
    this.addMapText(this.currentObjectiveMapAction(), 1.2, 2.0, 10, 0x92400e);

    if (place === "farm") {
      this.addMapText("售卖箱", 8.55, 4.2, 12, 0x374151);
      this.addMapText("谷仓", 29.15, 7.3, 12, 0x7c2d12);
      this.addMapText("小镇", 20.35, 26.2, 12, 0x374151);
      return;
    }

    if (place === "town") {
      this.addMapText("海滩", 1.1, 15.7, 12, 0x0f766e);
      this.addMapText("种子铺", 18.4, 11.5, 13, 0x14532d);
      this.addMapText("铁匠", 6.1, 11.4, 13, 0x334155);
      this.addMapText("古寺", 33.1, 11.4, 13, 0x6d28d9);
      this.addMapText("公告板", 23.25, 17.95, 12, 0x7c2d12);
      this.addMapText("深林", 38.7, 15.7, 12, 0x14532d);
      this.addMapText("农场", 20.35, 26.2, 12, 0x374151);
      return;
    }

    if (place === "shop") {
      this.addMapText("山风种子铺", 18.1, 4.2, 16, 0x14532d);
      this.addMapText("柜台", 20.2, 10.75, 12, 0x374151);
      return;
    }

    if (place === "deepForest") {
      this.addMapText("小镇", 1.1, 15.75, 12, 0x374151);
      this.addMapText("矿洞", 35.15, 12.3, 12, 0x854d0e);
      return;
    }

    if (place === "beach") {
      this.addMapText("回小镇", 19.9, 1.3, 12, 0x374151);
      this.addMapText("钓鱼码头", 19.2, 16.15, 12, 0x0f766e);
      return;
    }

    if (place === "cave") {
      this.addMapText("地下城", 19.85, 2.35, 12, 0x6d28d9);
      this.addMapText("回深林", 19.85, 25.2, 12, 0x374151);
      return;
    }

    if (place === "dungeon") {
      this.addMapText("旧矿地下城", 18.2, 4.2, 14, 0x7c2d12);
      this.addMapText("回矿洞", 20.1, 25.2, 12, 0x374151);
      return;
    }

    if (place === "temple") {
      this.addMapText("古寺正殿", 18.7, 4.2, 14, 0x6d28d9);
      this.addMapText("回小镇", 20.1, 25.2, 12, 0x374151);
      return;
    }

    if (place === "barn") {
      this.addMapText("草料", 8.7, 6.35, 12, 0x7c2d12);
      this.addMapText("回农场", 20.1, 25.2, 12, 0x374151);
      return;
    }

    this.addMapText("床", 6.65, 6.2, 12, 0x374151);
    this.addMapText("天气", 11.55, 6.2, 12, 0x1d4ed8);
    this.addMapText("出门", 20.35, 25.2, 12, 0x374151);
  }

  private currentObjectiveMapMarker() {
    const objective = this.currentDailyObjective();

    return objectiveMapMarkerHint({
      objectiveLabel: objective.label,
      currentPlace: this.save.player.place,
      targetPlace: this.targetPlaceForObjective(objective.id),
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
    });
  }

  private currentObjectiveMapAction() {
    const objective = this.currentDailyObjective();

    return objectiveMapActionHint({
      objectiveLabel: objective.label,
      objectiveDetail: objective.detail,
      currentPlace: this.save.player.place,
      targetPlace: this.targetPlaceForObjective(objective.id),
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
    });
  }

  private renderUi() {
    this.clearObjects(this.uiObjects);
    this.renderPocketSummary();
    this.renderTopHud();
    this.renderHotbar();

    if (this.save.player.place === "shop") {
      this.renderShopShelf();
    } else {
      this.renderQuestSlip();
    }
  }

  private renderPocketSummary() {
    const objective = this.currentDailyObjective();
    const shippedCount = this.currentShippingItemCount();
    const backpackHint = this.currentBackpackActionHint();
    const shippingPreview = this.currentShippingPreview();
    const shippingHint = shippingBoxHint({
      itemCount: shippedCount,
      totalGold: shippingPreview.total,
      orderWillComplete: shippingPreview.orderWillComplete,
    });
    const shippingUrgency = this.currentShippingUrgencyHint();
    const selectedLabel = this.save.selectedTool === "seed"
      ? `${toolLabels.seed}:${CROPS[this.save.selectedSeed].name}`
      : toolLabels[this.save.selectedTool];
    const masteryLine = masteryTrackIds
      .map((track) => `${masteryDisplay[track].shortName}Lv${progressForXp(this.save.mastery[track].xp).level}`)
      .join("  ");

    this.addPanel(HUD_MARGIN, HUD_MARGIN, 380, 108, UI_COLORS.night, UI_COLORS.ink, 64);
    this.addUiText(placeLabels[this.save.player.place], HUD_MARGIN + 16, HUD_MARGIN + 10, 15, UI_COLORS.goldSoft, 280, 67);
    this.addUiText(
      objectiveHudSummaryHint({ objectiveLabel: objective.label, objectiveDetail: objective.detail }),
      HUD_MARGIN + 16,
      HUD_MARGIN + 31,
      10,
      UI_COLORS.cream,
      330,
      67,
    );
    this.addUiText(`售卖箱 ${shippingHint} · ${shippingUrgency}  J 日志  I/B 背包`, HUD_MARGIN + 16, HUD_MARGIN + 50, 11, UI_COLORS.goldSoft, 338, 67);
    this.addUiText(`背包 ${backpackHint}`, HUD_MARGIN + 16, HUD_MARGIN + 70, 10, UI_COLORS.cream, 338, 67);
    this.addUiText(`当前 ${selectedLabel} · 熟练度 ${masteryLine}`, HUD_MARGIN + 16, HUD_MARGIN + 88, 10, UI_COLORS.mint, 338, 67);
    const pocketHitArea = this.addUiObject(
      this.add
        .rectangle(HUD_MARGIN, HUD_MARGIN, 380, 108, 0xffffff, 0)
        .setOrigin(0, 0)
        .setDepth(90),
    );
    pocketHitArea.setInteractive({ useHandCursor: true });
    pocketHitArea.on("pointerdown", () => this.showInventory());
  }

  private currentShippingItemCount() {
    return (
      cropIds.reduce((sum, cropId) => sum + clampCount(this.save.shipping[cropId]), 0) +
      forageIds.reduce((sum, forageId) => sum + clampCount(this.save.forageShipping[forageId]), 0) +
      fishIds.reduce((sum, fishId) => sum + clampCount(this.save.fishShipping[fishId]), 0)
    );
  }

  private currentShippingUrgencyHint() {
    const preview = this.currentShippingPreview();

    return shippingUrgencyHint({
      backpackCount: this.currentSellableInventoryCount(),
      boxCount: this.currentShippingItemCount(),
      totalGold: preview.total,
      orderWillComplete: preview.orderWillComplete,
      timeMinutes: this.save.timeMinutes,
      energy: this.save.energy,
    });
  }

  private currentSellableInventoryCount() {
    return (
      cropIds.reduce((sum, cropId) => sum + clampCount(this.save.inventory[cropItem(cropId)]), 0) +
      forageIds.reduce((sum, forageId) => sum + clampCount(this.save.inventory[forageItem(forageId)]), 0) +
      fishIds.reduce((sum, fishId) => sum + clampCount(this.save.inventory[fishItem(fishId)]), 0)
    );
  }

  private currentSellableInventoryValue() {
    return (
      cropIds.reduce((sum, cropId) => sum + clampCount(this.save.inventory[cropItem(cropId)]) * CROPS[cropId].sellPrice, 0) +
      forageIds.reduce((sum, forageId) => sum + clampCount(this.save.inventory[forageItem(forageId)]) * FORAGE[forageId].sellPrice, 0) +
      fishIds.reduce((sum, fishId) => sum + clampCount(this.save.inventory[fishItem(fishId)]) * FISH[fishId].sellPrice, 0)
    );
  }

  private currentSeedInventoryCount() {
    return cropIds.reduce((sum, cropId) => sum + clampCount(this.save.inventory[seedItem(cropId)]), 0);
  }

  private currentFishInventoryCount() {
    return fishIds.reduce((sum, fishId) => sum + clampCount(this.save.inventory[fishItem(fishId)]), 0);
  }

  private currentFishInventoryValue() {
    return fishIds.reduce((sum, fishId) => sum + clampCount(this.save.inventory[fishItem(fishId)]) * FISH[fishId].sellPrice, 0);
  }

  private currentFishingBasketRouteHint() {
    return fishingBasketRouteHint({
      fishCount: this.currentFishInventoryCount(),
      totalGold: this.currentFishInventoryValue(),
      timeMinutes: this.save.timeMinutes,
      energy: this.save.energy,
    });
  }

  private fishingActionJuiceFor(previewHint: string) {
    return fishingActionJuiceHint({
      previewHint,
      energy: this.save.energy,
      energyCost: this.energyCostForTool("fish"),
      minutesPerCast: FISHING_MINUTES,
      timeMinutes: this.save.timeMinutes,
      pondLightsActive: hasCalendarEvent(this.save.day, "溪畔夜灯") && this.save.timeMinutes >= 18 * 60 && this.save.timeMinutes < 23 * 60,
      raining: this.currentWeather() === "rain",
    });
  }

  private fishingBiteCueFor(tier: FishingCatchTier) {
    return fishingBiteCueHint({
      tier,
      fishingLevel: masteryLevel(this.save.mastery, "fishing"),
      weather: this.currentWeather(),
      timeMinutes: this.save.timeMinutes,
      pondLightsActive: hasCalendarEvent(this.save.day, "溪畔夜灯") && this.save.timeMinutes >= 18 * 60 && this.save.timeMinutes < 23 * 60,
      energy: this.save.energy,
      energyCost: this.energyCostForTool("fish"),
    });
  }

  private currentDryCropCount() {
    if (this.currentWeather() === "rain") {
      return 0;
    }

    return Object.values(this.save.plots).filter((plot) => plot.cropId && !plot.watered).length;
  }

  private currentMatureCropCount() {
    return Object.values(this.save.plots).filter((plot) => this.isMature(plot)).length;
  }

  private currentFieldActionNextStepHint() {
    return fieldActionNextStepHint({
      openPlotCount: this.currentOpenPlotCount(),
      carriedSeeds: this.currentSeedInventoryCount(),
      dryCropCount: this.currentDryCropCount(),
      matureCount: this.currentMatureCropCount(),
      sellableInventoryCount: this.currentSellableInventoryCount(),
    });
  }

  private currentBackpackActionHint() {
    const order = this.ensureDailyOrder();

    return backpackActionHint({
      sellableCount: this.currentSellableInventoryCount(),
      sellableGold: this.currentSellableInventoryValue(),
      snackCount: this.currentSellableInventoryCount(),
      reservedForOrder: order.cropId ? this.orderReserveCountForCrop(order.cropId) : 0,
      energy: this.save.energy,
      maxEnergy: MAX_ENERGY,
    });
  }

  private socialActionMemoryFor(npcId: NpcId) {
    return socialActionMemoryHint({
      relationshipLabel: relationshipProgressLabel(clampCount(this.save.friendship[npcId])),
      talkedToday: this.save.talkedToNpcs[npcId] === this.save.day,
      giftedToday: this.save.giftGivenToNpcs[npcId] === this.save.day,
      giftReady: this.save.giftGivenToNpcs[npcId] !== this.save.day && Boolean(this.chooseGiftForNpc(npcId)),
    });
  }

  private currentBackpackDecisionHint() {
    const order = this.ensureDailyOrder();

    return backpackDecisionHint({
      sellableCount: this.currentSellableInventoryCount(),
      sellableGold: this.currentSellableInventoryValue(),
      snackCount: this.currentSellableInventoryCount(),
      reservedForOrder: order.cropId ? this.orderReserveCountForCrop(order.cropId) : 0,
      energy: this.save.energy,
      maxEnergy: MAX_ENERGY,
      timeMinutes: this.save.timeMinutes,
    });
  }

  private currentBackpackSortPlanHint() {
    const order = this.ensureDailyOrder();

    return backpackSortPlanHint({
      sellableCount: this.currentSellableInventoryCount(),
      giftReadyCount: this.giftCandidates().length,
      snackCount: this.currentSellableInventoryCount(),
      reservedForOrder: order.cropId ? this.orderReserveCountForCrop(order.cropId) : 0,
      energy: this.save.energy,
      maxEnergy: MAX_ENERGY,
      timeMinutes: this.save.timeMinutes,
    });
  }

  private currentBackpackShortcutHint() {
    return backpackShortcutHint({
      seedCount: this.currentSeedInventoryCount(),
      openPlotCount: this.currentOpenPlotCount(),
      sellableCount: this.currentSellableInventoryCount(),
      snackCount: this.currentSellableInventoryCount(),
      energy: this.save.energy,
      maxEnergy: MAX_ENERGY,
      timeMinutes: this.save.timeMinutes,
    });
  }

  private renderTopHud() {
    const weather = this.currentWeather();
    const season = this.currentSeason();
    const period = dayPeriod(this.save.timeMinutes);
    const x = this.viewWidth() - 218;
    const y = HUD_MARGIN;

    this.addPanel(x, y, 200, 146, UI_COLORS.night, UI_COLORS.ink, 70);
    this.addUiText(`第 ${this.save.day} 天 · ${SEASONS[season].name}`, x + 16, y + 12, 14, UI_COLORS.cream, 158, 74);
    this.addUiText(formatTime(this.save.timeMinutes), x + 16, y + 36, 24, UI_COLORS.gold, 142, 74);
    this.addUiText(period.label, x + 116, y + 45, 12, period.id === "late" || period.id === "night" ? UI_COLORS.rose : UI_COLORS.mint, 48, 76);
    this.addUiIcon(ICON_FRAMES.coin, x + 27, y + 70, 0.72, 76);
    this.addUiText(String(this.save.gold), x + 48, y + 62, 14, UI_COLORS.goldSoft, 88, 76);
    this.addUiIcon(this.weatherIconFrame(weather), x + 27, y + 95, 0.72, 76);
    this.addUiText(
      `${WEATHER[weather].name} · ${weather === "rain" ? "雨水浇田" : "记得浇水"}`,
      x + 48,
      y + 88,
      10,
      weather === "rain" ? UI_COLORS.blue : UI_COLORS.cream,
      108,
      76,
    );
    this.addSoundButton(x + 158, y + 94);
    this.addEnergyBar(x + 16, y + 126, 160, 75);
  }

  private renderQuestSlip() {
    const order = this.ensureDailyOrder();
    const quest = this.storyQuestStatus();
    const objective = this.currentDailyObjective();
    const rewardSummary = this.orderRewardSummaryFor(order);
    const progress = this.currentOrderProgress(order);
    const orderState = order.completed ? "已完成" : order.accepted ? "进行中" : "去小镇接单";
    const width = 224;
    const height = 218;
    const defaultX = this.viewWidth() - width - HUD_MARGIN;
    const defaultY = 188;
    const overlapsPlayer = this.playerOverlapsScreenRect(defaultX, defaultY, width, height, 28);
    const x = overlapsPlayer ? HUD_MARGIN : defaultX;
    const y = overlapsPlayer ? 138 : defaultY;
    this.addPanel(x, y, width, height, UI_COLORS.night, UI_COLORS.ink, 65);
    this.addUiIcon(ICON_FRAMES.order, x + 29, y + 22, 0.7, 68);
    this.addUiText("公告板委托", x + 50, y + 12, 15, UI_COLORS.goldSoft, 136, 68);
    this.addUiIcon(ICON_FRAMES[order.cropId], x + 28, y + 58, 0.72, 68);
    this.addUiText(`${CROPS[order.cropId].name} x${order.count}`, x + 54, y + 49, 13, UI_COLORS.cream, 138, 68);
    this.addUiIcon(ICON_FRAMES.coin, x + 28, y + 88, 0.6, 68);
    this.addUiText(rewardSummary, x + 54, y + 80, 10, UI_COLORS.goldSoft, 148, 68);
    this.addUiText(`状态 ${orderState} · 进度 ${progress.availableCount}/${progress.requiredCount}`, x + 16, y + 108, 10, UI_COLORS.cream, 188, 68);
    this.addUiText(`线索 ${quest.completed}/${quest.total} · ${quest.complete ? "继续经营" : quest.active.title}`, x + 16, y + 130, 10, UI_COLORS.mint, 188, 68);
    this.addUiText(`下一步：${objective.label}`, x + 16, y + 154, 11, UI_COLORS.goldSoft, 188, 68);
    this.addUiText(objective.detail, x + 16, y + 174, 9, UI_COLORS.cream, 188, 68);
    this.addUiText(this.currentQuestClueRouteHint(), x + 16, y + 194, 8, UI_COLORS.muted, 188, 68);
  }

  private renderShopShelf() {
    const x = this.viewWidth() - 230;
    const y = 184;
    this.addPanel(x, y, 212, 206, UI_COLORS.night, UI_COLORS.ink, 65);
    this.addUiText("山风种子铺", x + 16, y + 14, 15, UI_COLORS.goldSoft, 164, 68);
    this.addUiText("点击购买，或用底部工具栏选种。", x + 16, y + 38, 10, UI_COLORS.cream, 174, 68);
    this.addUiText(this.currentSeedShopRecommendationHint(), x + 16, y + 54, 9, UI_COLORS.mint, 174, 68);

    cropIds.forEach((cropId, index) => {
      this.addBuyButton(cropId, x + 16, y + 70 + index * 40);
    });
  }

  private toggleInventory() {
    if (this.inventoryOpen) {
      this.hideInventory();
      return;
    }

    this.showInventory();
  }

  private showInventory() {
    this.inventoryOpen = true;
    this.clearObjects(this.menuObjects);
    this.renderInventoryPanel();
    this.playSfx("menu");
  }

  private hideInventory() {
    this.inventoryOpen = false;
    this.clearObjects(this.menuObjects);
    this.playSfx("menu");
  }

  private toggleJournal() {
    if (this.inventoryOpen) {
      this.hideInventory();
      return;
    }

    this.showJournal();
  }

  private showJournal() {
    this.inventoryOpen = true;
    this.clearObjects(this.menuObjects);
    this.renderJournalPanel();
    this.playSfx("menu");
  }

  private renderJournalPanel() {
    const width = 690;
    const height = 532;
    const x = Math.round((this.viewWidth() - width) / 2);
    const y = Math.round((this.viewHeight() - height) / 2);
    const weather = this.currentWeather();
    const season = this.currentSeason();
    const todayEvent = calendarEventForDay(this.save.day);
    const nextEvent = nextCalendarEvent(this.save.day);
    const calendarTarget = todayEvent ?? nextEvent;
    const order = this.ensureDailyOrder();
    const calendarPlan = calendarPlanHint({
      eventTitle: calendarTarget.title,
      daysUntil: todayEvent ? 0 : nextEvent.daysUntil,
      currentPlace: this.save.player.place,
      timeMinutes: this.save.timeMinutes,
      giftReadyCount: this.giftCandidates().length,
    });
    const calendarAction = calendarEventActionHint({
      eventTitle: calendarTarget.title,
      daysUntil: todayEvent ? 0 : nextEvent.daysUntil,
      currentPlace: this.save.player.place,
      giftReadyCount: this.giftCandidates().length,
      orderAccepted: order.accepted,
      sellableInventoryCount: this.currentSellableInventoryCount(),
      energy: this.save.energy,
      timeMinutes: this.save.timeMinutes,
    });
    const calendarRoute = calendarEventRouteHint({
      eventTitle: calendarTarget.title,
      daysUntil: todayEvent ? 0 : nextEvent.daysUntil,
      currentPlace: this.save.player.place,
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
      giftReadyCount: this.giftCandidates().length,
    });
    const talkedToday = npcIds.some((npcId) => this.save.talkedToNpcs[npcId] === this.save.day);
    const giftedToday = npcIds.some((npcId) => this.save.giftGivenToNpcs[npcId] === this.save.day);
    const calendarSocialPrep = calendarSocialPrepHint({
      eventTitle: calendarTarget.title,
      daysUntil: todayEvent ? 0 : nextEvent.daysUntil,
      currentPlace: this.save.player.place,
      giftReadyCount: this.giftCandidates().length,
      samePlaceCount: npcIds.filter((npcId) => activeNpcSchedule(npcId, this.save.timeMinutes).place === this.save.player.place).length,
      talkedToday,
      giftedToday,
      timeMinutes: this.save.timeMinutes,
    });
    const festivalReadiness = festivalReadinessHint({
      eventTitle: calendarTarget.title,
      daysUntil: todayEvent ? 0 : nextEvent.daysUntil,
      currentPlace: this.save.player.place,
      sellableInventoryCount: this.currentSellableInventoryCount(),
      giftReadyCount: this.giftCandidates().length,
      energy: this.save.energy,
      timeMinutes: this.save.timeMinutes,
    });
    const festivalChecklist = festivalChecklistHint({
      eventTitle: calendarTarget.title,
      daysUntil: todayEvent ? 0 : nextEvent.daysUntil,
      currentPlace: this.save.player.place,
      sellableInventoryCount: this.currentSellableInventoryCount(),
      giftReadyCount: this.giftCandidates().length,
      energy: this.save.energy,
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
    });
    const rows = this.journalRows();
    const quest = this.storyQuestStatus();
    const rating = this.currentFarmRating();
    const weatherPlan = this.weatherPlanFor(weather);
    const objective = this.currentDailyObjective();
    const routeHint = objectiveRouteHint({
      objectiveLabel: objective.label,
      currentPlace: this.save.player.place,
      targetPlace: this.targetPlaceForObjective(objective.id),
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
    });

    this.addMenuPanel(x, y, width, height);
    this.addMenuText("山居日志", x + 30, y + 24, 22, 0xffefba);
    this.addMenuText("J / Esc 关闭", x + width - 122, y + 30, 11, 0xf8d9a0);
    this.addMenuObject(this.add.image(x + 42, y + 82, "icons", this.weatherIconFrame(weather)).setScale(0.68).setDepth(170));
    this.addMenuText(
      `第 ${this.save.day} 天 · ${SEASONS[season].name}第 ${seasonDayFor(this.save.day)} 天 · ${WEATHER[weather].name}`,
      x + 70,
      y + 72,
      13,
      0x3a2212,
      300,
      170,
    );
    this.addMenuText(`${WEATHER[weather].note} ${weatherPlan}`, x + 70, y + 96, 11, 0x5f3719, 360, 170);
    this.addMenuText(
      `山居线索 ${quest.completed}/${quest.total} · ${quest.complete ? "继续经营农场" : quest.active.title}`,
      x + 70,
      y + 116,
      10,
      0x7a4a22,
      360,
      170,
    );

    this.addMenuObject(
      this.add
        .rectangle(x + 30, y + 130, 384, 356, 0xf8dfae)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0x8a5a2b)
        .setDepth(168),
    );
    this.addMenuText("今天的节奏", x + 52, y + 148, 15, 0x3a2212, 160, 170);
    this.addMenuText(routeHint, x + 52, y + 168, 10, 0x7c2d12, 324, 171);
    rows.forEach((row, index) => {
      const rowY = y + 202 + index * 35;
      const fill = row.done ? 0xe7c482 : 0xf3d28b;
      this.addMenuObject(
        this.add
          .rectangle(x + 52, rowY, 332, 28, fill)
          .setOrigin(0, 0)
          .setStrokeStyle(2, row.done ? 0x6b3f1d : 0xb9793a)
          .setDepth(169),
      );
      this.addMenuText(row.done ? "完成" : "待办", x + 64, rowY + 6, 10, row.done ? 0x14532d : 0x7c2d12, 34, 171);
      this.addMenuText(row.label, x + 112, rowY + 4, 12, 0x3a2212, 118, 171);
      this.addMenuText(row.detail, x + 230, rowY + 5, 10, 0x5f3719, 138, 171);
    });
    const masterySummary = masteryTrackIds
      .map((track) => {
        const progress = progressForXp(this.save.mastery[track].xp);
        const next = progress.nextLevelXp === undefined
          ? "MAX"
          : `${Math.round(progress.progressRatio * 100)}%`;

        return `${masteryDisplay[track].shortName}${progress.level}(${next})`;
      })
      .join("  ");
    this.addMenuText(`熟练度 ${masterySummary}`, x + 54, y + 392, 10, 0x7a4a22, 320, 171);

    const sideX = x + 442;
    this.addMenuObject(
      this.add
        .rectangle(sideX, y + 130, 218, 356, 0xf8dfae)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0x8a5a2b)
        .setDepth(168),
    );
    this.addMenuText("小镇日历", sideX + 18, y + 148, 15, 0x3a2212, 140, 170);
    this.addMenuObject(this.add.image(sideX + 32, y + 190, "icons", calendarTarget.icon).setScale(0.62).setDepth(170));
    this.addMenuText(todayEvent ? `今日 · ${todayEvent.title}` : `${nextEvent.daysUntil} 天后 · ${nextEvent.title}`, sideX + 58, y + 178, 13, 0x3a2212, 130, 170);
    this.addMenuText(calendarTarget.note, sideX + 22, y + 214, 10, 0x5f3719, 174, 170);
    this.addMenuText(`${calendarPlan} · ${calendarAction} · ${calendarSocialPrep}`, sideX + 22, y + 234, 9, 0x7c2d12, 174, 170);
    this.addMenuText(`${calendarRoute} · ${festivalReadiness} · ${festivalChecklist}`, sideX + 22, y + 244, 8, 0x14532d, 174, 170);

    this.addMenuText("当前线索", sideX + 18, y + 250, 13, 0x3a2212, 120, 170);
    this.addMenuObject(this.add.image(sideX + 31, y + 284, "icons", quest.active.icon).setScale(0.42).setDepth(170));
    this.addMenuText(this.currentQuestClueRouteHint(), sideX + 50, y + 274, 8, 0x5f3719, 142, 170);

    this.addMenuText("农场评级", sideX + 18, y + 310, 13, 0x3a2212, 120, 170);
    this.addMenuObject(this.add.image(sideX + 31, y + 344, "icons", ICON_FRAMES.coin).setScale(0.42).setDepth(170));
    this.addMenuText(`${rating.label} · ${rating.score} 分`, sideX + 50, y + 334, 10, 0x7a4a22, 142, 170);
    this.addMenuText(
      rating.nextScore ? `距下一档 ${rating.nextScore - rating.score} 分` : "山谷已经记住你了",
      sideX + 50,
      y + 352,
      8,
      0x5f3719,
      142,
      170,
    );

    this.addMenuText("邻里去向", sideX + 18, y + 374, 13, 0x3a2212, 120, 170);
    this.addMenuText(this.currentRelationshipCollectionHint(), sideX + 18, y + 392, 8, 0x14532d, 184, 170);
    this.addMenuText(this.currentNpcScheduleMapHint(), sideX + 18, y + 404, 7, 0x7c2d12, 184, 170);
    this.addMenuText(this.currentRelationshipRewardPreviewHint(), sideX + 18, y + 416, 7, 0x14532d, 184, 170);
    npcIds.forEach((npcId, index) => {
      const rowY = y + 432 + index * 14;
      const schedule = activeNpcSchedule(npcId, this.save.timeMinutes);
      const friendship = clampCount(this.save.friendship[npcId]);
      const gift = this.chooseGiftForNpc(npcId);
      const approachCue = npcApproachCueHint({
        npcName: npcDisplayNames[npcId],
        place: schedule.place,
        currentPlace: this.save.player.place,
        activity: schedule.activity,
        giftName: gift?.name,
        loved: gift?.loved,
        talkedToday: this.save.talkedToNpcs[npcId] === this.save.day,
        alreadyGifted: this.save.giftGivenToNpcs[npcId] === this.save.day,
        timeMinutes: this.save.timeMinutes,
        travelMinutes: TRAVEL_MINUTES,
      });
      this.addMenuObject(this.add.image(sideX + 28, rowY + 7, "icons", ICON_FRAMES.heart).setScale(0.28).setDepth(170));
      this.addMenuText(npcDisplayNames[npcId], sideX + 44, rowY, 9, 0x3a2212, 44, 170);
      this.addMenuText(relationshipProgressLabel(friendship), sideX + 88, rowY, 9, 0x7c2d12, 50, 170);
      this.addMenuText(approachCue, sideX + 140, rowY, 7, 0x5f3719, 72, 170);
    });
  }

  private currentRelationshipCollectionHint() {
    return relationshipCollectionHint({
      entries: npcIds.map((npcId) => ({
        name: npcDisplayNames[npcId],
        points: clampCount(this.save.friendship[npcId]),
      })),
      giftReadyCount: this.giftCandidates().length,
      talkedTodayCount: npcIds.filter((npcId) => this.save.talkedToNpcs[npcId] === this.save.day).length,
      giftedTodayCount: npcIds.filter((npcId) => this.save.giftGivenToNpcs[npcId] === this.save.day).length,
    });
  }

  private currentRelationshipRewardPreviewHint() {
    const teaBonus = hasCalendarEvent(this.save.day, "邻里茶会") ? 1 : 0;
    const perkBonus = socialFriendshipBonus(masteryLevel(this.save.mastery, "social"));
    const candidates = npcIds
      .map((npcId) => {
        const friendship = clampCount(this.save.friendship[npcId]);
        const stage = relationshipStage(friendship);
        const gift = this.chooseGiftForNpc(npcId);
        const giftPoints = gift && this.save.giftGivenToNpcs[npcId] !== this.save.day
          ? giftFriendshipPoints(gift.points, teaBonus, perkBonus)
          : 0;

        return {
          npcId,
          friendship,
          remaining: stage.nextPoints === undefined ? Number.POSITIVE_INFINITY : Math.max(0, stage.nextPoints - friendship),
          giftPoints,
          rewardName: this.nextRelationshipRewardName(npcId),
          maxed: stage.nextPoints === undefined,
        };
      })
      .filter((candidate) => candidate.rewardName && !candidate.maxed)
      .sort((left, right) => left.remaining - right.remaining || right.giftPoints - left.giftPoints);
    const target = candidates[0];

    if (!target) {
      return "邻里奖励 · 继续来往";
    }

    return relationshipRewardPreviewHint({
      npcName: npcDisplayNames[target.npcId],
      currentFriendship: target.friendship,
      giftPoints: target.giftPoints,
      alreadyGifted: this.save.giftGivenToNpcs[target.npcId] === this.save.day,
      nextRewardName: target.rewardName,
    });
  }

  private currentNpcScheduleMapHint() {
    return npcScheduleMapHint({
      entries: npcIds.map((npcId) => {
        const schedule = activeNpcSchedule(npcId, this.save.timeMinutes);

        return {
          name: npcDisplayNames[npcId],
          place: schedule.place,
          activity: schedule.activity,
          talkedToday: this.save.talkedToNpcs[npcId] === this.save.day,
          giftedToday: this.save.giftGivenToNpcs[npcId] === this.save.day,
          giftReady: this.save.giftGivenToNpcs[npcId] !== this.save.day && Boolean(this.chooseGiftForNpc(npcId)),
        };
      }),
      currentPlace: this.save.player.place,
      giftReadyCount: this.giftCandidates().length,
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
    });
  }

  private nextRelationshipRewardName(npcId: NpcId) {
    const stage = relationshipStage(clampCount(this.save.friendship[npcId]));

    if (stage.nextPoints === undefined) {
      return undefined;
    }

    const rewardItem = relationshipRewardItems[npcId][stage.level + 1];

    return rewardItem ? itemName(rewardItem) : undefined;
  }

  private targetPlaceForObjective(objectiveId: DailyObjectiveId): TravelTarget {
    if (objectiveId === "mail" || objectiveId === "sleep") {
      return "home";
    }

    if (objectiveId === "order" || objectiveId === "social") {
      return "town";
    }

    return "farm";
  }

  private targetPlaceForQuestStep(stepId: QuestStepId): TravelTarget {
    if (stepId === "read-mail" || stepId === "sleep-after-shipping") {
      return "home";
    }

    if (stepId === "accept-order" || stepId === "meet-neighbor") {
      return "town";
    }

    return "farm";
  }

  private currentQuestClueRouteHint() {
    const quest = this.storyQuestStatus();

    return questClueRouteHint({
      questTitle: quest.active.title,
      questHint: quest.active.hint,
      completedCount: quest.completed,
      totalCount: quest.total,
      complete: quest.complete,
      currentPlace: this.save.player.place,
      targetPlace: this.targetPlaceForQuestStep(quest.active.id),
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
    });
  }

  private journalRows(): JournalRow[] {
    const order = this.ensureDailyOrder();
    const plantedPlots = Object.values(this.save.plots).filter((plot) => plot.cropId);
    const planted = plantedPlots.length;
    const watered = plantedPlots.filter((plot) => plot.watered || this.currentWeather() === "rain").length;
    const cropGrowth = plantedPlots.map((plot) => cropGrowthStatus(plot.growth, CROPS[plot.cropId as CropId].growDays));
    const mature = cropGrowth.filter((growth) => growth.mature).length;
    const dry = Math.max(0, planted - watered);
    const fieldWorkload = fieldWorkloadHint({
      dryCount: dry,
      matureCount: mature,
      waterCost: this.energyCostForTool("water"),
      harvestCost: this.energyCostForTool("harvest"),
      minutesPerAction: ACTION_MINUTES,
    });
    const snackEnergyAvailable = Math.max(
      0,
      ...this.snackCandidates()
        .filter((snack) =>
          snackAutoUseCount({
            inventoryCount: clampCount(this.save.inventory[snack.item]),
            orderReserveCount: snack.orderReserveCount,
          }) > 0,
        )
        .map((snack) => snack.energy),
    );
    const fieldEnergyPlan = fieldEnergyPlanHint({
      energy: this.save.energy,
      dryCount: dry,
      matureCount: mature,
      waterCost: this.energyCostForTool("water"),
      harvestCost: this.energyCostForTool("harvest"),
      snackEnergyAvailable,
    });
    const harvestHint = cropGrowth.some((growth) => growth.mature)
      ? "有作物可收"
      : cropGrowth.length > 0
        ? cropGrowth.reduce((soonest, growth) => growth.remainingDays < soonest.remainingDays ? growth : soonest).label
        : "先开垦播种";
    const shippedCount =
      cropIds.reduce((sum, cropId) => sum + clampCount(this.save.shipping[cropId]), 0) +
      forageIds.reduce((sum, forageId) => sum + clampCount(this.save.forageShipping[forageId]), 0) +
      fishIds.reduce((sum, fishId) => sum + clampCount(this.save.fishShipping[fishId]), 0);
    const shippingPreview = this.currentShippingPreview();
    const shippingBreakdown = shippingBreakdownHint(shippingPreview);
    const talked = npcIds.some((npcId) => this.save.talkedToNpcs[npcId] === this.save.day);
    const gifted = npcIds.some((npcId) => this.save.giftGivenToNpcs[npcId] === this.save.day);
    const socialHint = socialVisitHint({
      samePlaceCount: npcIds.filter((npcId) => activeNpcSchedule(npcId, this.save.timeMinutes).place === this.save.player.place).length,
      giftReadyCount: this.giftCandidates().length,
      talkedToday: talked,
      giftedToday: gifted,
    });
    const seedRoute = this.currentSeedRouteHint();

    return [
      {
        label: "读信看天",
        done: this.save.mailReadDay === this.save.day,
        detail: this.save.mailReadDay === this.save.day ? "邮箱已读" : "小屋门口邮箱",
      },
      {
        label: "接下委托",
        done: order.accepted || order.completed,
        detail: order.completed
          ? `连击 ${this.save.stats.currentOrderStreak}`
          : order.accepted ? "今晚入箱" : "小镇公告板",
      },
      {
        label: "照看田地",
        done: planted > 0 && watered >= planted,
        detail: planted > 0
          ? `${fieldCareSummary({ plantedCount: planted, wateredCount: watered, matureCount: mature })} · ${
            fieldWorkload === "田地已收尾" ? harvestHint : `${fieldWorkload} · ${fieldEnergyPlan}`
          }`
          : `${fieldCareSummary({ plantedCount: planted, wateredCount: watered, matureCount: mature })} · ${seedRoute}`,
      },
      {
        label: "拜访邻里",
        done: talked || gifted,
        detail: socialHint,
      },
      {
        label: "睡前入箱",
        done: shippedCount > 0,
        detail: shippedCount > 0 ? `${shippedCount} 件 · ${shippingBreakdown}` : this.currentBackpackDecisionHint(),
      },
    ];
  }

  private currentDailyObjective() {
    const order = this.ensureDailyOrder();
    const planted = Object.values(this.save.plots).filter((plot) => plot.cropId).length;
    const watered = Object.values(this.save.plots).filter((plot) => plot.cropId && (plot.watered || this.currentWeather() === "rain")).length;
    const socialDone = npcIds.some(
      (npcId) => this.save.talkedToNpcs[npcId] === this.save.day || this.save.giftGivenToNpcs[npcId] === this.save.day,
    );
    const shippedCount =
      cropIds.reduce((sum, cropId) => sum + clampCount(this.save.shipping[cropId]), 0) +
      forageIds.reduce((sum, forageId) => sum + clampCount(this.save.forageShipping[forageId]), 0) +
      fishIds.reduce((sum, fishId) => sum + clampCount(this.save.fishShipping[fishId]), 0);

    return dailyObjectiveHint({
      mailRead: this.save.mailReadDay === this.save.day,
      orderAccepted: order.accepted,
      orderCompleted: order.completed,
      plantedCount: planted,
      wateredCount: watered,
      socialDone,
      shippedCount,
      timeMinutes: this.save.timeMinutes,
      energy: this.save.energy,
    });
  }

  private weatherPlanFor(weather: WeatherId) {
    const plantedPlots = Object.values(this.save.plots).filter((plot) => plot.cropId);
    const planted = plantedPlots.length;
    const watered = plantedPlots.filter((plot) => plot.watered || weather === "rain").length;

    return weatherPlanHint({
      weather,
      plantedCount: planted,
      dryCount: Math.max(0, planted - watered),
      seedCount: this.currentSeedInventoryCount(),
    });
  }

  private travelPlanFor(target: TravelTarget) {
    const order = this.ensureDailyOrder();

    return travelPlanHint({
      target,
      orderNeedsBoard: !order.accepted && !order.completed,
      giftReadyCount: this.giftCandidates().length,
      seedShortage: Math.max(0, this.currentOpenPlotCount() - this.currentSeedInventoryCount()),
      sellableInventoryCount: this.currentSellableInventoryCount(),
      timeMinutes: this.save.timeMinutes,
    });
  }

  private transitionTravelPromptFor(target: TravelTarget, actionLabel: string) {
    const objective = this.currentDailyObjective();

    return transitionTravelPromptHint({
      actionLabel,
      plan: this.travelPlanFor(target),
      objectiveLabel: objective.label,
      targetIsObjective: target === this.targetPlaceForObjective(objective.id),
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
      departureHint: transitionDepartureChecklistHint({
        target,
        sellableInventoryCount: this.currentSellableInventoryCount(),
        giftReadyCount: this.giftCandidates().length,
        seedShortage: Math.max(0, this.currentOpenPlotCount() - this.currentSeedInventoryCount()),
        timeMinutes: this.save.timeMinutes,
      }),
    });
  }

  private showBuyPanel(cropId: CropId) {
    const crop = CROPS[cropId];
    const price = this.seedPriceFor(cropId);
    const economics = cropEconomics({
      seedCost: price.price,
      sellPrice: crop.sellPrice,
      growDays: crop.growDays,
    });
    const affordable = this.maxAffordableSeeds(cropId);
    const previewQuantity = Math.max(1, Math.min(affordable, 5));
    const width = 356;
    const height = 312;
    const x = Math.round((this.viewWidth() - width) / 2);
    const y = Math.round((this.viewHeight() - height) / 2);

    this.inventoryOpen = true;
    this.clearObjects(this.menuObjects);
    this.addMenuPanel(x, y, width, height);
    this.addMenuObject(this.add.image(x + 58, y + 76, "icons", ICON_FRAMES[cropId]).setScale(1.2).setDepth(170));
    this.addMenuText(crop.seedName, x + 104, y + 46, 20, 0xffefba, 180);
    this.addMenuObject(this.add.image(x + 112, y + 88, "icons", ICON_FRAMES.coin).setScale(0.56).setDepth(170));
    this.addMenuText(`${price.price} 金 / 包`, x + 134, y + 80, 13, 0x3a2212, 130);
    this.addMenuText(
      price.discountPercent > 0 ? `农场折扣 -${price.discountPercent}%（原价 ${crop.seedPrice}）` : "经营越熟练，种子铺会给更好价。",
      x + 48,
      y + 112,
      10,
      price.discountPercent > 0 ? 0x14532d : 0x5f3719,
      240,
    );
    this.addMenuText(
      `${economics.growDays} 天成熟 · 售价 ${economics.sellPrice} 金 · 利润 ${economics.profit} 金（日均 ${economics.profitPerDay}）`,
      x + 48,
      y + 134,
      10,
      economics.profit >= 0 ? 0x14532d : 0x7c2d12,
      260,
    );
    this.addMenuText(this.seedPurchaseHintFor(cropId), x + 48, y + 158, 11, affordable > 0 ? 0x14532d : 0x7c2d12, 240);
    this.addMenuText(this.currentSeedRouteHint(), x + 48, y + 174, 9, 0x5f3719, 260);
    this.addMenuText(
      this.seedPurchaseOutcomeHintFor(cropId, previewQuantity),
      x + 48,
      y + 190,
      9,
      affordable > 0 ? 0x5f3719 : 0x7c2d12,
      260,
    );
    this.addMenuText(
      seedBatchEconomyHint({
        seedCost: price.price,
        sellPrice: crop.sellPrice,
        growDays: crop.growDays,
        quantity: affordable > 0 ? previewQuantity : 0,
        openPlotCount: this.currentOpenPlotCount(),
      }),
      x + 48,
      y + 206,
      9,
      affordable > 0 ? 0x14532d : 0x7c2d12,
      260,
    );

    this.addMenuButton("买 1", x + 42, y + 224, 76, () => this.buySeeds(cropId, 1));
    this.addMenuButton("买 5", x + 132, y + 224, 76, () => this.buySeeds(cropId, 5));
    this.addMenuButton("买最多", x + 222, y + 224, 76, () => this.buySeeds(cropId, Math.max(1, affordable)));
    this.addMenuButton("取消", x + 120, y + 262, 116, () => this.hideInventory());
    this.playSfx("menu");
  }

  private renderInventoryPanel() {
    const width = 624;
    const height = 444;
    const x = Math.round((this.viewWidth() - width) / 2);
    const y = Math.round((this.viewHeight() - height) / 2);
    const order = this.ensureDailyOrder();
    const backpackHint = backpackValueHint({
      itemCount: this.currentSellableInventoryCount(),
      totalGold: this.currentSellableInventoryValue(),
    });

    this.addMenuPanel(x, y, width, height);
    this.addMenuText("背包", x + 30, y + 22, 22, 0xffefba);
    this.addMenuText(backpackHint, x + 94, y + 30, 10, UI_COLORS.mint, 168, 170);
    this.addMenuText(this.currentBackpackActionHint(), x + 94, y + 44, 9, UI_COLORS.cream, 210, 170);
    this.addMenuText(this.currentBackpackSortPlanHint(), x + 304, y + 44, 8, UI_COLORS.rose, 146, 170);
    this.addMenuText(this.currentBackpackDecisionHint(), x + 94, y + 58, 8, 0x7c2d12, 210, 170);
    this.addMenuText(this.currentBackpackShortcutHint(), x + 304, y + 58, 8, 0x14532d, 146, 170);
    this.addMenuText("I/B 或 Esc 关闭", x + width - 148, y + 28, 11, 0xf8d9a0);

    const closeButton = this.addMenuObject(
      this.add
        .rectangle(x + width - 48, y + 18, 28, 24, 0x5b371c)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xf8d9a0)
        .setDepth(170),
    );
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerdown", () => this.hideInventory());
    this.addMenuText("关", x + width - 40, y + 22, 12, 0xffefba, undefined, 171).setInteractive({ useHandCursor: true }).on(
      "pointerdown",
      () => this.hideInventory(),
    );

    this.addMenuText("种子", x + 32, y + 66, 13, 0x3a2212);
    cropIds.forEach((cropId, index) => {
      this.addInventorySlot({
        x: x + 32 + index * 132,
        y: y + 90,
        icon: ICON_FRAMES[cropId],
        label: CROPS[cropId].seedName,
        count: clampCount(this.save.inventory[seedItem(cropId)]),
        detail: `${CROPS[cropId].seedPrice} 金`,
      });
    });

    this.addMenuText("收获物（点选可吃，R 快速点心）", x + 32, y + 160, 13, 0x3a2212);
    cropIds.forEach((cropId, index) => {
      const snack = this.cropSnack(cropId);
      const count = clampCount(this.save.inventory[cropItem(cropId)]);
      const reserve = snack.orderReserveCount ?? 0;

      this.addInventorySlot({
        x: x + 32 + index * 132,
        y: y + 184,
        icon: snack.icon,
        label: CROPS[cropId].name,
        count,
        detail: snackTradeoffHint({
          sellPrice: CROPS[cropId].sellPrice,
          energyGain: snack.energy,
          orderReserveCount: reserve,
        }),
        actionLabel: "点选吃",
        safeActionCount: reserve > 0
          ? snackAutoUseCount({
            inventoryCount: count,
            orderReserveCount: reserve,
          })
          : undefined,
        safeActionLabel: reserve > 0 ? "安全吃" : undefined,
        blockedActionLabel: reserve > 0 ? "别动委托" : undefined,
        onClick: () => this.eatSnack(snack),
      });
    });

    this.addMenuText("采集物", x + 32, y + 254, 13, 0x3a2212);
    forageIds.forEach((forageId, index) => {
      const snack = this.forageSnack(forageId);

      this.addInventorySlot({
        x: x + 32 + index * 132,
        y: y + 278,
        icon: snack.icon,
        label: FORAGE[forageId].name,
        count: clampCount(this.save.inventory[forageItem(forageId)]),
        detail: snackTradeoffHint({ sellPrice: FORAGE[forageId].sellPrice, energyGain: snack.energy }),
        actionLabel: "点选吃",
        onClick: () => this.eatSnack(snack),
      });
    });

    this.addMenuText("渔获", x + 32, y + 348, 13, 0x3a2212);
    fishIds.forEach((fishId, index) => {
      const snack = this.fishSnack(fishId);

      this.addInventorySlot({
        x: x + 32 + index * 132,
        y: y + 372,
        icon: snack.icon,
        label: FISH[fishId].name,
        count: clampCount(this.save.inventory[fishItem(fishId)]),
        detail: snackTradeoffHint({ sellPrice: FISH[fishId].sellPrice, energyGain: snack.energy }),
        actionLabel: "点选吃",
        onClick: () => this.eatSnack(snack),
      });
    });

    const sideX = x + 438;
    const cropShippingCount = cropIds.reduce((sum, cropId) => sum + clampCount(this.save.shipping[cropId]), 0);
    const forageShippingCount = forageIds.reduce((sum, forageId) => sum + clampCount(this.save.forageShipping[forageId]), 0);
    const fishShippingCount = fishIds.reduce((sum, fishId) => sum + clampCount(this.save.fishShipping[fishId]), 0);
    const orderSource = orderSourceHint({
      backpackCount: clampCount(this.save.inventory[cropItem(order.cropId)]),
      boxedCount: clampCount(this.save.shipping[order.cropId]),
      requiredCount: order.count,
      accepted: order.accepted,
      completed: order.completed,
    });
    this.addMenuObject(
      this.add
        .rectangle(sideX, y + 72, 150, 342, 0xf8dfae)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0x8a5a2b)
        .setDepth(168),
    );
    this.addMenuObject(this.add.image(sideX + 24, y + 98, "icons", ICON_FRAMES.order).setScale(0.64).setDepth(170));
    this.addMenuText("今日委托", sideX + 46, y + 88, 13, 0x3a2212, 92, 170);
    this.addMenuObject(this.add.image(sideX + 26, y + 133, "icons", ICON_FRAMES[order.cropId]).setScale(0.64).setDepth(170));
    this.addMenuText(`${CROPS[order.cropId].name} x${order.count}`, sideX + 48, y + 124, 12, 0x3a2212, 84, 170);
    this.addMenuObject(this.add.image(sideX + 26, y + 164, "icons", ICON_FRAMES.coin).setScale(0.52).setDepth(170));
    this.addMenuText(`${order.reward} 金`, sideX + 48, y + 156, 12, 0x3a2212, 84, 170);
    this.addMenuText(orderSource, sideX + 18, y + 188, 9, 0x5f3719, 116, 170);
    this.addMenuText(this.orderStatusShort(order), sideX + 18, y + 206, 8, 0x7a4a22, 116, 170);
    this.addMenuText(this.orderTurnInHintFor(order), sideX + 18, y + 222, 8, 0x7c2d12, 116, 170);
    this.addMenuText(this.orderNextStepHintFor(order), sideX + 18, y + 236, 8, 0x14532d, 116, 170);

    this.addMenuObject(this.add.image(sideX + 26, y + 252, "icons", ICON_FRAMES.harvestBasket).setScale(0.54).setDepth(170));
    this.addMenuText("售卖箱", sideX + 48, y + 242, 13, 0x3a2212, 84, 170);
    this.addMenuText(`作物 ${cropShippingCount}`, sideX + 48, y + 264, 10, 0x5f3719, 76, 170);
    this.addMenuText(`采集 ${forageShippingCount}`, sideX + 48, y + 282, 10, 0x5f3719, 76, 170);
    this.addMenuText(`渔获 ${fishShippingCount}`, sideX + 48, y + 300, 10, 0x5f3719, 76, 170);

    this.addMenuText("好感", sideX + 18, y + 318, 13, 0x3a2212, 120, 170);
    npcIds.forEach((npcId, index) => {
      const rowY = y + 340 + index * 18;
      this.addMenuObject(this.add.image(sideX + 12, rowY + 7, "icons", ICON_FRAMES.heart).setScale(0.34).setDepth(170));
      this.addMenuText(npcDisplayNames[npcId], sideX + 26, rowY, 10, 0x3a2212, 42, 170);
      this.addMenuText(String(clampCount(this.save.friendship[npcId])), sideX + 116, rowY, 10, 0x7c2d12, 20, 170);
    });
  }

  private renderHotbar() {
    const entries = this.hotbarEntries();
    const layout = this.hotbarLayout();
    const actionHint = this.save.selectedTool === "seed"
      ? `${this.currentHotbarActionHint()} · ${this.currentSeedFieldReadinessHint()}`
      : this.currentHotbarActionHint();

    this.addPanel(layout.panelX, layout.panelY, layout.panelWidth, layout.panelHeight, UI_COLORS.night, UI_COLORS.ink, 72);
    this.addUiText(actionHint, layout.startX - 3, layout.y + 45, 8, UI_COLORS.goldSoft, layout.totalWidth + 6, 80);

    entries.forEach((entry, index) => {
      const x = layout.startX + index * (layout.slot + layout.gap);
      const active = this.isHotbarActive(entry.id);
      const fill = active ? UI_COLORS.gold : UI_COLORS.nightSoft;
      const stroke = active ? UI_COLORS.cream : UI_COLORS.gold;
      const rect = this.addUiObject(
        this.add
          .rectangle(x, layout.y, layout.slot, 42, fill)
          .setOrigin(0, 0)
          .setStrokeStyle(active ? 3 : 2, stroke)
          .setDepth(78),
      );
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", entry.onClick);

      this.addUiText(String(index + 1), x + 4, layout.y + 2, 8, active ? UI_COLORS.ink : UI_COLORS.goldSoft, undefined, 80);
      const icon = this.addUiObject(
        this.add
          .image(x + layout.slot / 2, layout.y + 21, "icons", entry.icon)
          .setScale(0.88)
          .setDepth(80),
      );
      icon.setInteractive({ useHandCursor: true });
      icon.on("pointerdown", entry.onClick);

      if (entry.count !== undefined) {
        this.addUiObject(
          this.add
            .rectangle(x + layout.slot - 16, layout.y + 27, 14, 12, UI_COLORS.ink, 0.86)
            .setOrigin(0, 0)
            .setDepth(81),
        );
        this.addUiText(String(entry.count), x + layout.slot - 12, layout.y + 27, 8, UI_COLORS.goldSoft, undefined, 82);
      }
    });
  }

  private hotbarLayout() {
    const entryCount = this.hotbarEntries().length;
    const slot = 48;
    const gap = 5;
    const totalWidth = entryCount * slot + (entryCount - 1) * gap;
    const startX = Math.round((this.viewWidth() - totalWidth) / 2);
    const bottomY = this.viewHeight() - HOTBAR_HEIGHT;
    const y = this.shouldDockHotbarTop(bottomY) ? HUD_MARGIN + 10 : bottomY;
    const panelWidth = totalWidth + 24;
    const panelHeight = 62;

    return {
      slot,
      gap,
      totalWidth,
      startX,
      y,
      panelX: startX - 12,
      panelY: y - 10,
      panelWidth,
      panelHeight,
    };
  }

  private shouldDockHotbarTop(bottomY: number) {
    const player = this.playerScreenPoint();

    return player.y + TILE * 0.7 >= bottomY - 12;
  }

  private hotbarEntries(): HotbarEntry[] {
    return [
      {
        id: "hoe" as HotbarId,
        icon: ICON_FRAMES.hoe,
        onClick: () => this.selectTool("hoe"),
      },
      {
        id: "seed" as HotbarId,
        icon: ICON_FRAMES.seedBag,
        onClick: () => this.selectTool("seed"),
      },
      {
        id: "water" as HotbarId,
        icon: ICON_FRAMES.wateringCan,
        onClick: () => this.selectTool("water"),
      },
      {
        id: "harvest" as HotbarId,
        icon: ICON_FRAMES.harvestBasket,
        onClick: () => this.selectTool("harvest"),
      },
      {
        id: "fish" as HotbarId,
        icon: ICON_FRAMES.fishingRod,
        onClick: () => this.selectTool("fish"),
      },
      ...cropIds.map((cropId) => ({
        id: `seed:${cropId}` as HotbarId,
        icon: ICON_FRAMES[cropId],
        count: clampCount(this.save.inventory[seedItem(cropId)]),
        onClick: () => this.selectSeed(cropId),
      })),
    ];
  }

  private currentHotbarActionHint() {
    return hotbarActionHint({
      tool: this.save.selectedTool,
      seedName: CROPS[this.save.selectedSeed].name,
      seedCount: clampCount(this.save.inventory[seedItem(this.save.selectedSeed)]),
    });
  }

  private currentToolSelectionToastHint() {
    const nextStepHint = this.save.selectedTool === "seed"
      ? `${this.currentFieldActionNextStepHint()} · ${this.currentSeedFieldReadinessHint()}`
      : this.currentFieldActionNextStepHint();

    return toolSelectionToastHint({
      actionHint: this.currentHotbarActionHint(),
      nextStepHint,
    });
  }

  private isHotbarActive(id: HotbarId) {
    if (id.startsWith("seed:")) {
      return this.save.selectedTool === "seed" && id === `seed:${this.save.selectedSeed}`;
    }

    return this.save.selectedTool === id;
  }

  private addPanel(x: number, y: number, width: number, height: number, fill: number, stroke: number, depth: number) {
    this.addUiObject(
      this.add
        .rectangle(x + 6, y + 7, width, height, UI_COLORS.shadow, 0.46)
        .setOrigin(0, 0)
        .setDepth(depth - 2),
    );
    this.addUiObject(
      this.add
        .rectangle(x, y, width, height, fill)
        .setOrigin(0, 0)
        .setStrokeStyle(4, stroke)
        .setDepth(depth),
    );
    this.addUiObject(
      this.add
        .rectangle(x + 5, y + 5, width - 10, height - 10, UI_COLORS.white, 0.04)
        .setOrigin(0, 0)
        .setStrokeStyle(1, UI_COLORS.gold, 0.34)
        .setDepth(depth + 1),
    );
    this.addUiObject(
      this.add
        .rectangle(x + 8, y + 8, width - 16, 3, UI_COLORS.gold, 0.72)
        .setOrigin(0, 0)
        .setDepth(depth + 1),
    );
  }

  private addMenuPanel(x: number, y: number, width: number, height: number) {
    this.addMenuObject(
      this.add
        .rectangle(this.viewWidth() / 2, this.viewHeight() / 2, this.viewWidth(), this.viewHeight(), UI_COLORS.ink, 0.5)
        .setDepth(158)
        .setInteractive(),
    );
    this.addMenuObject(
      this.add
        .rectangle(x + 8, y + 9, width, height, UI_COLORS.shadow, 0.56)
        .setOrigin(0, 0)
        .setDepth(159),
    );
    this.addMenuObject(
      this.add
        .rectangle(x, y, width, height, UI_COLORS.ink)
        .setOrigin(0, 0)
        .setStrokeStyle(5, UI_COLORS.gold)
        .setDepth(160),
    );
    this.addMenuObject(
      this.add
        .rectangle(x + 10, y + 10, width - 20, 48, UI_COLORS.night)
        .setOrigin(0, 0)
        .setStrokeStyle(2, UI_COLORS.brown)
        .setDepth(161),
    );
    this.addMenuObject(
      this.add
        .rectangle(x + 10, y + 58, width - 20, height - 68, UI_COLORS.paperSoft)
        .setOrigin(0, 0)
        .setStrokeStyle(2, UI_COLORS.brown)
        .setDepth(161),
    );
    this.addMenuObject(
      this.add
        .rectangle(x + 16, y + 16, width - 32, 4, UI_COLORS.gold, 0.72)
        .setOrigin(0, 0)
        .setDepth(162),
    );
  }

  private addUiText(
    text: string,
    x: number,
    y: number,
    size: number,
    color: number,
    wordWrapWidth?: number,
    depth = 80,
  ) {
    return this.addUiObject(
      this.add.text(x, y, text, {
        color: hexColor(color),
        fontFamily: UI_FONT,
        fontSize: `${size}px`,
        fontStyle: size >= 16 ? "700" : "600",
        wordWrap: wordWrapWidth ? { width: wordWrapWidth } : undefined,
      }).setDepth(depth),
    );
  }

  private addMenuText(
    text: string,
    x: number,
    y: number,
    size: number,
    color: number,
    wordWrapWidth?: number,
    depth = 170,
  ) {
    return this.addMenuObject(
      this.add.text(x, y, text, {
        color: hexColor(color),
        fontFamily: UI_FONT,
        fontSize: `${size}px`,
        fontStyle: size >= 13 ? "700" : "600",
        wordWrap: wordWrapWidth ? { width: wordWrapWidth } : undefined,
      }).setDepth(depth),
    );
  }

  private addInventorySlot({
    x,
    y,
    icon,
    label,
    count,
    detail,
    actionLabel,
    safeActionCount,
    safeActionLabel,
    blockedActionLabel,
    onClick,
  }: {
    x: number;
    y: number;
    icon: number;
    label: string;
    count: number;
    detail: string;
    actionLabel?: string;
    safeActionCount?: number;
    safeActionLabel?: string;
    blockedActionLabel?: string;
    onClick?: () => void;
  }) {
    const slot = this.addMenuObject(
      this.add
        .rectangle(x, y, 116, 58, 0xf8dfae)
        .setOrigin(0, 0)
        .setStrokeStyle(2, count > 0 ? 0x6b3f1d : 0xb99057)
        .setDepth(168),
    );
    if (onClick && count > 0) {
      slot.setInteractive({ useHandCursor: true });
      slot.on("pointerdown", onClick);
    }
    this.addMenuObject(this.add.image(x + 25, y + 29, "icons", icon).setScale(count > 0 ? 0.68 : 0.52).setDepth(170));
    this.addMenuText(label, x + 48, y + 10, 11, count > 0 ? 0x3a2212 : 0x8a5a2b, 58, 170);
    this.addMenuText(`x${count}`, x + 48, y + 29, 12, count > 0 ? 0x3a2212 : 0x8a5a2b, 40, 170);
    this.addMenuText(
      inventorySlotDetailHint({ detail, count, actionLabel, safeActionCount, safeActionLabel, blockedActionLabel }),
      x + 48,
      y + 44,
      8,
      0x7a4a22,
      62,
      170,
    );
  }

  private addMenuButton(label: string, x: number, y: number, width: number, onClick: () => void) {
    const button = this.addMenuObject(
      this.add
        .rectangle(x, y, width, 32, 0x5b371c)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xf8d9a0)
        .setDepth(170),
    );
    button.setInteractive({ useHandCursor: true });
    button.on("pointerdown", onClick);
    this.addMenuText(label, x + width / 2 - label.length * 6, y + 8, 12, 0xffefba, width - 12, 171)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", onClick);
  }

  private showShippingSummary({
    income,
    orderReward,
    streakBonus,
    passOutFee,
    passedOut,
  }: {
    income: number;
    orderReward: number;
    streakBonus: number;
    passOutFee: number;
    passedOut: boolean;
  }) {
    const width = 376;
    const height = 344;
    const x = Math.round((this.viewWidth() - width) / 2);
    const y = Math.round((this.viewHeight() - height) / 2);
    const net = settlementNet({ income, orderReward, streakBonus, passOutFee });
    const rows = [
      { label: "售卖箱", value: income, icon: ICON_FRAMES.harvestBasket, color: 0x3a2212 },
      { label: "委托奖励", value: orderReward, icon: ICON_FRAMES.order, color: 0x3a2212 },
      { label: "连击奖励", value: streakBonus, icon: ICON_FRAMES.order, color: 0x14532d },
      { label: "夜间照看", value: -passOutFee, icon: ICON_FRAMES.energy, color: 0x7c2d12 },
      { label: "净收入", value: net, icon: ICON_FRAMES.coin, color: net >= 0 ? 0x14532d : 0x7c2d12 },
    ];

    this.inventoryOpen = true;
    this.addMenuPanel(x, y, width, height);
    this.addMenuText("清晨结算", x + 30, y + 24, 22, 0xffefba);
    this.addMenuText(`第 ${this.save.day} 天`, x + width - 96, y + 30, 12, 0xf8d9a0, 70);

    rows.forEach((row, index) => {
      const rowY = y + 76 + index * 46;
      this.addMenuObject(
        this.add
          .rectangle(x + 34, rowY, width - 68, 34, 0xf8dfae)
          .setOrigin(0, 0)
          .setStrokeStyle(2, 0x8a5a2b)
          .setDepth(168),
      );
      this.addMenuObject(this.add.image(x + 56, rowY + 17, "icons", row.icon).setScale(0.54).setDepth(170));
      this.addMenuText(row.label, x + 82, rowY + 8, 13, 0x3a2212, 140, 170);
      this.addMenuText(`${row.value >= 0 ? "+" : ""}${row.value} 金`, x + width - 126, rowY + 8, 13, row.color, 92, 170);
    });

    this.addMenuText(
      passedOut ? "太晚会扣除照看费用，明天早点回家。" : WEATHER[this.currentWeather()].note,
      x + 38,
      y + 302,
      11,
      0x5f3719,
      214,
      170,
    );
    const closeButton = this.addMenuObject(
      this.add
        .rectangle(x + width - 86, y + height - 58, 54, 28, 0x5b371c)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xf8d9a0)
        .setDepth(170),
    );
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerdown", () => this.hideInventory());
    this.addMenuText("继续", x + width - 76, y + height - 52, 12, 0xffefba, 36, 171).setInteractive({ useHandCursor: true }).on(
      "pointerdown",
      () => this.hideInventory(),
    );
  }

  private addUiIcon(frame: number, x: number, y: number, scale = 0.68, depth = 80) {
    return this.addUiObject(this.add.image(x, y, "icons", frame).setScale(scale).setDepth(depth));
  }

  private addSoundButton(x: number, y: number) {
    const button = this.addUiObject(
      this.add
        .rectangle(x - 13, y - 13, 26, 26, UI_COLORS.ink)
        .setStrokeStyle(2, UI_COLORS.gold)
        .setDepth(76),
    );
    button.setInteractive({ useHandCursor: true });
    button.on("pointerdown", () => this.toggleAudio());

    const icon = this.addUiObject(
      this.add
        .image(x, y, "icons", this.audioMuted ? ICON_FRAMES.soundOff : ICON_FRAMES.soundOn)
        .setScale(0.68)
        .setDepth(77),
    );
    icon.setInteractive({ useHandCursor: true });
    icon.on("pointerdown", () => this.toggleAudio());
  }

  private weatherIconFrame(weather: WeatherId) {
    if (weather === "rain") {
      return ICON_FRAMES.rain;
    }

    if (weather === "mist") {
      return ICON_FRAMES.mist;
    }

    return ICON_FRAMES.sun;
  }

  private addEnergyBar(x: number, y: number, width = 118, depth = 80) {
    const status = energyStatus(this.save.energy, MAX_ENERGY);
    const ratio = Phaser.Math.Clamp(status.ratio, 0, 1);
    const statusColor = status.id === "exhausted" ? UI_COLORS.red : status.id === "tired" ? UI_COLORS.rose : UI_COLORS.mint;

    this.addUiIcon(ICON_FRAMES.energy, x + 7, y - 9, 0.42, depth);
    this.addUiText(`${this.save.energy}/${MAX_ENERGY}`, x + 18, y - 16, 11, UI_COLORS.cream, undefined, depth);
    this.addUiText(status.label, x + width - 38, y - 16, 10, statusColor, 34, depth);
    this.addUiObject(this.add.rectangle(x, y, width, 9, UI_COLORS.ink).setOrigin(0, 0).setStrokeStyle(1, UI_COLORS.gold, 0.55).setDepth(depth));
    this.addUiObject(
      this.add
        .rectangle(x + 2, y + 2, Math.max(2, (width - 4) * ratio), 5, ratio < 0.25 ? UI_COLORS.red : UI_COLORS.green)
        .setOrigin(0, 0)
        .setDepth(depth + 1),
    );
    if (status.id === "exhausted" || status.id === "tired") {
      this.addUiText(status.hint, x, y + 12, 9, statusColor, width + 14, depth);
    }
  }

  private orderStatusText(order: DailyOrder) {
    const cropName = CROPS[order.cropId].name;
    const progress = this.currentOrderProgress(order);
    const rewardSummary = this.orderRewardSummaryFor(order);
    const deadline = this.orderDeadlineHintFor(order);

    if (order.completed) {
      return `今日订单已完成：${cropName} x${order.count}`;
    }

    if (order.accepted) {
      return `已接：${cropName} ${progress.availableCount}/${progress.requiredCount}，${deadline}，${rewardSummary}。`;
    }

    return `小镇公告板有订单：${cropName} ${progress.availableCount}/${progress.requiredCount}，${deadline}，${rewardSummary}。`;
  }

  private orderRewardSummaryFor(order: DailyOrder) {
    return orderRewardSummary({
      reward: order.reward,
      count: order.count,
      nextStreakBonus: orderStreakBonus(this.save.stats.currentOrderStreak + 1),
    });
  }

  private orderTurnInHintFor(order: DailyOrder) {
    return orderTurnInHint({
      backpackCount: clampCount(this.save.inventory[cropItem(order.cropId)]),
      boxedCount: clampCount(this.save.shipping[order.cropId]),
      requiredCount: order.count,
      reward: order.reward,
      nextStreakBonus: orderStreakBonus(this.save.stats.currentOrderStreak + 1),
      accepted: order.accepted,
      completed: order.completed,
    });
  }

  private orderNextStepHintFor(order: DailyOrder) {
    return orderNextStepHint({
      backpackCount: clampCount(this.save.inventory[cropItem(order.cropId)]),
      boxedCount: clampCount(this.save.shipping[order.cropId]),
      requiredCount: order.count,
      accepted: order.accepted,
      completed: order.completed,
    });
  }

  private orderBoardActionHintFor(order: DailyOrder) {
    return orderBoardActionHint({
      cropName: CROPS[order.cropId].name,
      backpackCount: clampCount(this.save.inventory[cropItem(order.cropId)]),
      boxedCount: clampCount(this.save.shipping[order.cropId]),
      requiredCount: order.count,
      accepted: order.accepted,
      completed: order.completed,
    });
  }

  private orderBoardPreviewFor(order: DailyOrder) {
    const progress = this.currentOrderProgress(order);

    return orderBoardPreviewHint({
      cropName: CROPS[order.cropId].name,
      availableCount: progress.availableCount,
      requiredCount: progress.requiredCount,
      reward: order.reward,
      nextStreakBonus: orderStreakBonus(this.save.stats.currentOrderStreak + 1),
      accepted: order.accepted,
      completed: order.completed,
      timeMinutes: this.save.timeMinutes,
    });
  }

  private orderDeadlineHintFor(order: DailyOrder) {
    const progress = this.currentOrderProgress(order);

    return orderDeadlineHint({
      accepted: order.accepted,
      completed: order.completed,
      ready: progress.ready,
      remainingCount: progress.remainingCount,
      timeMinutes: this.save.timeMinutes,
    });
  }

  private orderStatusShort(order: DailyOrder) {
    return this.orderBoardPreviewFor(order);
  }

  private addMapText(text: string, tileX: number, tileY: number, size: number, color: number) {
    return this.addMapObject(
      this.add
        .text(MAP_X + tileX * TILE, MAP_Y + tileY * TILE, text, {
          color: hexColor(color),
          fontFamily: "Inter, PingFang SC, Microsoft YaHei, sans-serif",
          fontSize: `${size}px`,
          fontStyle: "700",
        })
        .setDepth(8),
    );
  }

  private addBuyButton(cropId: CropId, x: number, y: number) {
    const price = this.seedPriceFor(cropId);
    const economics = cropEconomics({
      seedCost: price.price,
      sellPrice: CROPS[cropId].sellPrice,
      growDays: CROPS[cropId].growDays,
    });
    this.addButton({
      x,
      y,
      width: 152,
      height: 30,
      label: `    ${CROPS[cropId].seedName} ${price.price}`,
      active: this.save.selectedSeed === cropId && this.save.selectedTool === "seed",
      onClick: () => this.showBuyPanel(cropId),
    });
    const icon = this.addUiObject(
      this.add
        .image(x + 17, y + 15, "icons", ICON_FRAMES[cropId])
        .setScale(0.72)
        .setDepth(82),
    );
    icon.setInteractive({ useHandCursor: true });
    icon.on("pointerdown", () => this.showBuyPanel(cropId));
    this.addUiText(
      `${economics.growDays}天 · 利${economics.profit} / 日${economics.profitPerDay}`,
      x + 38,
      y + 29,
      8,
      economics.profit >= 0 ? 0x14532d : 0x7c2d12,
      116,
      82,
    );
    this.addUiText(
      this.seedShelfDecisionHintFor(cropId),
      x + 38,
      y + 18,
      8,
      this.maxAffordableSeeds(cropId) > 0 ? 0x5f3719 : 0x7c2d12,
      116,
      82,
    );
  }

  private currentOpenPlotCount() {
    return Object.values(this.save.plots).filter((plot) => plot.tilled && !plot.cropId).length;
  }

  private currentSeedShopRecommendationHint() {
    return seedShopRecommendationHint({
      options: cropIds.map((cropId) => ({
        cropName: CROPS[cropId].name,
        seedCost: this.seedPriceFor(cropId).price,
        sellPrice: CROPS[cropId].sellPrice,
        growDays: CROPS[cropId].growDays,
      })),
      gold: this.save.gold,
      openPlotCount: this.currentOpenPlotCount(),
    });
  }

  private seedPurchaseHintFor(cropId: CropId) {
    return seedPurchaseHint({
      gold: this.save.gold,
      seedPrice: this.seedPriceFor(cropId).price,
      carriedSeeds: clampCount(this.save.inventory[seedItem(cropId)]),
      openPlotCount: this.currentOpenPlotCount(),
    });
  }

  private seedShelfDecisionHintFor(cropId: CropId) {
    return seedShelfDecisionHint({
      cropName: CROPS[cropId].name,
      gold: this.save.gold,
      seedPrice: this.seedPriceFor(cropId).price,
      carriedSeeds: clampCount(this.save.inventory[seedItem(cropId)]),
      openPlotCount: this.currentOpenPlotCount(),
      selected: this.save.selectedSeed === cropId && this.save.selectedTool === "seed",
    });
  }

  private seedPurchaseOutcomeHintFor(cropId: CropId, requestedQuantity: number) {
    return seedPurchaseOutcomeHint({
      gold: this.save.gold,
      seedPrice: this.seedPriceFor(cropId).price,
      requestedQuantity,
      carriedSeeds: clampCount(this.save.inventory[seedItem(cropId)]),
      openPlotCount: this.currentOpenPlotCount(),
    });
  }

  private seedPurchaseReceiptHintFor(cropId: CropId, requestedQuantity: number) {
    return seedPurchaseReceiptHint({
      gold: this.save.gold,
      seedPrice: this.seedPriceFor(cropId).price,
      requestedQuantity,
      carriedSeeds: clampCount(this.save.inventory[seedItem(cropId)]),
      openPlotCount: this.currentOpenPlotCount(),
      currentPlace: this.save.player.place,
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
    });
  }

  private currentSeedRouteHint() {
    const cropId = this.save.selectedSeed;

    return seedRouteHint({
      currentPlace: this.save.player.place,
      openPlotCount: this.currentOpenPlotCount(),
      carriedSeeds: this.currentSeedInventoryCount(),
      affordableSeeds: this.maxAffordableSeeds(cropId),
      timeMinutes: this.save.timeMinutes,
      travelMinutes: TRAVEL_MINUTES,
    });
  }

  private currentSeedFieldReadinessHint() {
    return seedFieldReadinessHint({
      openPlotCount: this.currentOpenPlotCount(),
      carriedSeeds: this.currentSeedInventoryCount(),
      energy: this.save.energy,
      seedCost: this.energyCostForTool("seed"),
      minutesPerAction: ACTION_MINUTES,
      currentPlace: this.save.player.place,
    });
  }

  private orderReserveCountForCrop(cropId: CropId) {
    const order = this.ensureDailyOrder();

    if (order.completed || !order.accepted || order.cropId !== cropId) {
      return 0;
    }

    return Math.max(0, order.count - clampCount(this.save.shipping[cropId]));
  }

  private seedPriceFor(cropId: CropId) {
    return seedPrice(
      CROPS[cropId].seedPrice,
      masteryLevel(this.save.mastery, "farming"),
      this.currentFarmRating().score,
    );
  }

  private addButton({
    x,
    y,
    width,
    height,
    label,
    active,
    onClick,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    active: boolean;
    onClick: () => void;
  }) {
    const fill = active ? 0xffd37a : 0xf8dfae;
    const stroke = active ? 0x4b2e17 : 0x8a5a2b;
    const color = 0x2a160b;

    const rect = this.addUiObject(
      this.add
        .rectangle(x, y, width, height, fill)
        .setOrigin(0, 0)
        .setStrokeStyle(active ? 3 : 2, stroke)
        .setDepth(78),
    );
    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerdown", onClick);

    const text = this.addUiObject(
      this.add
        .text(x + width / 2, y + height / 2, label, {
          color: hexColor(color),
          fontFamily: UI_FONT,
          fontSize: "12px",
          fontStyle: "700",
        })
        .setOrigin(0.5)
        .setDepth(80),
    );
    text.setInteractive({ useHandCursor: true });
    text.on("pointerdown", onClick);
  }

  private selectTool(tool: ToolId) {
    this.save.selectedTool = tool;
    this.persist();
    this.refreshInteractionOverlay();
    this.renderUi();
    this.playSfx("menu");
    this.showToast(this.currentToolSelectionToastHint());
  }

  private selectSeed(cropId: CropId) {
    this.save.selectedSeed = cropId;
    this.save.selectedTool = "seed";
    this.persist();
    this.refreshInteractionOverlay();
    this.renderUi();
    this.playSfx("menu");
    this.showToast(this.currentToolSelectionToastHint());
  }

  private buySeed(cropId: CropId) {
    this.buySeeds(cropId, 1);
  }

  private maxAffordableSeeds(cropId: CropId) {
    return Math.floor(this.save.gold / this.seedPriceFor(cropId).price);
  }

  private snackCandidates() {
    const cropSnacks = cropIds.map((cropId) => this.cropSnack(cropId));
    const forageSnacks = forageIds.map((forageId) => this.forageSnack(forageId));
    const fishSnacks = fishIds.map((fishId) => this.fishSnack(fishId));

    return [...cropSnacks, ...forageSnacks, ...fishSnacks].filter((snack) => clampCount(this.save.inventory[snack.item]) > 0);
  }

  private cropSnack(cropId: CropId): SnackCandidate {
    return {
      item: cropItem(cropId),
      name: CROPS[cropId].name,
      icon: ICON_FRAMES[cropId],
      energy: snackEnergyValue(CROPS[cropId].sellPrice, "crop"),
      orderReserveCount: this.orderReserveCountForCrop(cropId),
    };
  }

  private forageSnack(forageId: ForageId): SnackCandidate {
    return {
      item: forageItem(forageId),
      name: FORAGE[forageId].name,
      icon: ICON_FRAMES[FORAGE[forageId].icon],
      energy: snackEnergyValue(FORAGE[forageId].sellPrice, "forage"),
    };
  }

  private fishSnack(fishId: FishId): SnackCandidate {
    return {
      item: fishItem(fishId),
      name: FISH[fishId].name,
      icon: ICON_FRAMES[FISH[fishId].icon],
      energy: snackEnergyValue(FISH[fishId].sellPrice, "fish"),
    };
  }

  private eatBestSnack() {
    if (this.save.energy >= MAX_ENERGY) {
      this.showToast("体力已经满了，把点心留到晚些时候吧。");
      return;
    }

    const allSnacks = this.snackCandidates();
    const snacks = allSnacks
      .filter((snack) =>
        snackAutoUseCount({
          inventoryCount: clampCount(this.save.inventory[snack.item]),
          orderReserveCount: snack.orderReserveCount,
        }) > 0,
      )
      .sort((left, right) => left.energy - right.energy);

    if (snacks.length === 0) {
      if (allSnacks.length > 0) {
        this.showToast("背包里只有委托要留的作物，手动点选仍可吃。");
        return;
      }

      this.showToast("背包里没有可吃的收获物。采集、钓鱼或收获后可按 R 补充体力。");
      return;
    }

    const deficit = MAX_ENERGY - this.save.energy;
    const snack = snacks.find((candidate) => candidate.energy >= deficit) ?? snacks[snacks.length - 1];
    this.eatSnack(snack);
  }

  private eatSnack(snack: SnackCandidate) {
    if (this.save.energy >= MAX_ENERGY) {
      this.showToast("体力已经满了，把点心留到晚些时候吧。");
      return;
    }

    if (clampCount(this.save.inventory[snack.item]) <= 0) {
      this.showToast(`${snack.name}已经吃完了。`);
      return;
    }

    const before = this.save.energy;
    this.save.inventory[snack.item] = clampCount(this.save.inventory[snack.item]) - 1;
    this.save.energy = Math.min(MAX_ENERGY, this.save.energy + snack.energy);
    this.rememberAction(`吃${snack.name}`);

    if (this.advanceTime(EAT_MINUTES)) {
      return;
    }

    this.persist();
    if (this.inventoryOpen) {
      this.clearObjects(this.menuObjects);
      this.renderInventoryPanel();
    } else {
      this.renderUi();
    }
    this.playSfx("menu");

    if (this.playerSprite) {
      this.showFloatingIcon(snack.icon, this.playerSprite.x, this.playerSprite.y - 18, 0.48);
      this.showFloatingText(`+${this.save.energy - before}体`, this.playerSprite.x, this.playerSprite.y - 34, 0xd9f99d);
    }

    this.showToast(`${snackResultHint({
      snackName: snack.name,
      restoredEnergy: this.save.energy - before,
      energy: this.save.energy,
      maxEnergy: MAX_ENERGY,
    })}（按 R 会优先少浪费）。`);
  }

  private buySeeds(cropId: CropId, quantity: number) {
    const crop = CROPS[cropId];
    const price = this.seedPriceFor(cropId);
    const amount = Math.min(Math.max(1, Math.floor(quantity)), this.maxAffordableSeeds(cropId));

    if (amount <= 0) {
      this.showToast("金币不够。");
      return;
    }

    const purchaseHint = this.seedPurchaseReceiptHintFor(cropId, amount);
    this.save.gold -= price.price * amount;
    const item = seedItem(cropId);
    this.save.inventory[item] = clampCount(this.save.inventory[item]) + amount;
    this.save.selectedSeed = cropId;
    this.save.selectedTool = "seed";
    this.rememberAction(`买${crop.seedName}x${amount}`);

    if (this.advanceTime(SHOP_MINUTES)) {
      return;
    }

    this.persist();
    this.hideInventory();
    this.renderUi();
    this.playSfx("coin");
    this.showFloatingIcon(ICON_FRAMES[cropId], this.viewWidth() - 124, 254 + cropIds.indexOf(cropId) * 40, 0.56, true);
    this.showFloatingText(`-${price.price * amount}`, this.viewWidth() - 118, 82, 0xffd0b2, true);
    this.showToast(`买到 ${amount} 包${crop.seedName}${price.discountPercent > 0 ? `（折扣 -${price.discountPercent}%）` : ""}。${purchaseHint}`);
  }

  private handlePointer(pointer: Phaser.Input.Pointer) {
    if (this.isPointerOverFixedUi(pointer.x, pointer.y)) {
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    if (
      worldPoint.x < MAP_X ||
      worldPoint.x >= MAP_X + this.mapPixelWidth() ||
      worldPoint.y < MAP_Y ||
      worldPoint.y >= MAP_Y + this.mapPixelHeight()
    ) {
      return;
    }

    const x = Math.floor((worldPoint.x - MAP_X) / TILE);
    const y = Math.floor((worldPoint.y - MAP_Y) / TILE);

    if (!this.inMap(x, y)) {
      return;
    }

    this.faceToward(x, y);

    if (this.save.selectedTool === "fish" && this.isFishableWater(x, y) && this.isNear(x, y)) {
      this.fishAt(x, y);
      return;
    }

    const forage = this.forageAt(x, y);

    if (forage && this.isNear(x, y)) {
      this.collectForage(forage);
      return;
    }

    if (this.save.player.place === "farm" && this.save.plots[plotKey(x, y)] && this.isNear(x, y)) {
      this.useToolAt(x, y);
      return;
    }

    if (this.isNear(x, y)) {
      this.interactAt(x, y);
    }
  }

  private isPointerOverFixedUi(x: number, y: number) {
    const width = this.viewWidth();
    const hotbar = this.hotbarLayout();

    if (
      x >= hotbar.panelX &&
      x <= hotbar.panelX + hotbar.panelWidth &&
      y >= hotbar.panelY &&
      y <= hotbar.panelY + hotbar.panelHeight
    ) {
      return true;
    }

    if (x <= 374 && y <= 86) {
      return true;
    }

    if (x >= width - 258 && y <= 430) {
      return true;
    }

    return this.inventoryOpen;
  }

  private movePlayer(dx: number, dy: number, facing: Direction) {
    this.nextMoveAt = this.time.now + 92;
    const { player } = this.save;
    const target = {
      x: player.x + dx,
      y: player.y + dy,
    };

    player.facing = facing;
    this.playerSprite?.setFrame(playerFrames[facing]);

    const transition = this.getTransitionForMove(target);

    if (transition) {
      this.applyTransition(transition);
      return;
    }

    if (!this.inMap(target.x, target.y) || this.isBlocked(player.place, target.x, target.y)) {
      this.persist();
      this.refreshInteractionOverlay();
      return;
    }

    player.x = target.x;
    player.y = target.y;

    this.persist();
    this.renderUi();
    this.playSfx("step");

    if (!this.playerSprite) {
      this.renderAll();
      return;
    }

    this.moving = true;
    this.nextMoveAt = this.time.now + 128;
    const walkFrames = playerWalkFrames[facing];
    this.playerSprite.setFrame(walkFrames[1]);
    this.time.delayedCall(62, () => {
      if (this.playerSprite && this.save.player.facing === facing) {
        this.playerSprite.setFrame(walkFrames[2]);
      }
    });
    this.tweens.add({
      targets: this.playerSprite,
      x: this.tileCenterX(target.x),
      y: this.tileCenterY(target.y),
      duration: 120,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.playerSprite?.setFrame(walkFrames[0]);
        this.moving = false;
        this.refreshInteractionOverlay();
      },
    });
  }

  private getTransitionForMove(target: TilePoint) {
    if (this.inMap(target.x, target.y)) {
      return this.getObjects(this.save.player.place, "transition").find((object) => containsTile(object, target.x, target.y));
    }

    return this.getObjects(this.save.player.place, "transition").find((object) =>
      containsTile(object, this.save.player.x, this.save.player.y),
    );
  }

  private applyTransition(object: TiledObject) {
    const targetPlace = objectProp(object, "targetPlace", "farm");
    const facing = objectProp(object, "facing", "down");

    if (!isPlaceId(targetPlace)) {
      return;
    }

    this.changePlace(
      targetPlace,
      Number(objectProp(object, "targetX", 11)),
      Number(objectProp(object, "targetY", 13)),
      isDirection(facing) ? facing : "down",
    );
  }

  private changePlace(place: PlaceId, x: number, y: number, facing: Direction) {
    if (this.advanceTime(TRAVEL_MINUTES)) {
      return;
    }

    this.save.player = {
      place,
      x,
      y,
      facing,
    };
    const objective = this.currentDailyObjective();
    const arrivalHint = travelArrivalHint({
      target: place,
      plan: travelObjectiveArrivalPlan({
        plan: this.travelPlanFor(place),
        objectiveLabel: objective.label,
        arrivedAtObjective: place === this.targetPlaceForObjective(objective.id),
      }),
      arrivalTimeMinutes: this.save.timeMinutes,
    });
    const ambientHint = travelArrivalAmbientHint({
      target: place,
      plan: this.travelPlanFor(place),
      arrivalTimeMinutes: this.save.timeMinutes,
      weather: this.currentWeather(),
    });
    this.persist();
    this.cameras.main.fadeOut(90, 15, 23, 42);
    this.time.delayedCall(95, () => {
      this.renderAll();
      this.cameras.main.fadeIn(120, 15, 23, 42);
      this.showToast(`${arrivalHint}。${ambientHint}`);
    });
  }

  private interact() {
    const front = this.frontTile();

    if (this.save.selectedTool === "fish" && this.isFishableWater(front.x, front.y)) {
      this.fishAt(front.x, front.y);
      return;
    }

    if (this.save.player.place === "farm" && this.save.plots[plotKey(front.x, front.y)]) {
      this.useToolAt(front.x, front.y);
      return;
    }

    this.interactAt(front.x, front.y);
  }

  private interactAt(x: number, y: number) {
    const npc = this.getNpcForInteraction(x, y);

    if (npc) {
      this.talkToNpc(npc);
      return;
    }

    const forage = this.forageAt(x, y);

    if (forage) {
      this.collectForage(forage);
      return;
    }

    const transition = this.getObjects(this.save.player.place, "transition").find((object) => containsTile(object, x, y));

    if (transition) {
      this.applyTransition(transition);
      return;
    }

    const interaction = this.getObjects(this.save.player.place, "interaction").find((object) => containsTile(object, x, y));

    if (interaction) {
      const action = objectProp<string>(interaction, "action", "");

      if (action === "sleep") {
        this.sleep();
        return;
      }

      if (action === "ship") {
        this.shipAllCrops();
        return;
      }

      if (action === "order-board") {
        this.showOrderBoard();
        return;
      }

      if (action === "mailbox") {
        this.showMailbox();
        return;
      }

      if (action === "forecast") {
        this.showForecast();
        return;
      }
    }

    const closed = this.getObjects(this.save.player.place, "closed-building").find((object) => containsTile(object, x, y));

    if (closed) {
      this.showToast(String(objectProp(closed, "message", "这里暂未开放。")));
      return;
    }

    const counter = this.getObjects(this.save.player.place, "counter").find((object) => containsTile(object, x, y));

    if (counter) {
      this.showToast(String(objectProp(counter, "message", "柜台后有人在整理种子。")));
      return;
    }

    if (this.save.player.place === "shop") {
      this.showToast("货架上摆着当季种子。");
    } else if (this.save.player.place === "town") {
      this.showToast("小镇今天很安静。");
    } else {
      this.showToast("这里暂时没有可互动的东西。");
    }
  }

  private getNpcForInteraction(x: number, y: number) {
    return this.npcActors.find((actor) => {
      const distance = Math.abs(actor.x - x) + Math.abs(actor.y - y);
      const counterTalk = this.save.player.place === "shop" && y === actor.y + 1 && Math.abs(actor.x - x) <= 1;
      return distance <= 1 || counterTalk;
    });
  }

  private dialogForNpc(npc: NpcActor) {
    const weather = this.currentWeather();
    const event = calendarEventForDay(this.save.day);
    let line = npc.dialog;

    if (weather === "rain" && npc.rainDialog) {
      line = npc.rainDialog;
    } else if (weather === "mist" && npc.mistDialog) {
      line = npc.mistDialog;
    } else if (event?.title === "山风集市" && npc.activity.includes("委托")) {
      line = "今天公告板最热闹，趁人多接单准没错。";
    } else if (event?.title === "邻里茶会") {
      line = "今天大家说话都不急，送点小礼物会被记得更久。";
    }

    return `${npc.name}：${line}`;
  }

  private talkToNpc(npc: NpcActor) {
    const alreadyTalked = this.save.talkedToNpcs[npc.id] === this.save.day;
    let message = this.dialogForNpc(npc);

    if (!alreadyTalked) {
      const teaBonus = hasCalendarEvent(this.save.day, "邻里茶会") ? 1 : 0;
      const perkBonus = socialFriendshipBonus(masteryLevel(this.save.mastery, "social"));
      const gain = 1 + teaBonus + perkBonus;
      const friendship = clampCount(this.save.friendship[npc.id]) + gain;
      const stage = relationshipStage(friendship);
      const relationshipNext = relationshipNextHint(friendship);
      const reward = this.grantRelationshipReward(npc.id, stage.level, npc.sprite.x, npc.sprite.y);
      this.rememberAction(`和${npc.name}聊天`);
      this.save.friendship[npc.id] = friendship;
      this.save.talkedToNpcs[npc.id] = this.save.day;
      message = talkResultHint({
        dialogText: message,
        points: gain,
        teaBonus,
        masteryBonus: perkBonus,
        stageLabel: stage.label,
        friendship,
        rewardText: reward,
        questText: this.markQuestProgress("meet-neighbor"),
        masteryText: this.gainMastery("social", 4 + teaBonus),
      });
      message = `${message} ${relationshipNext}。`;
      this.showFloatingIcon(ICON_FRAMES.heart, npc.sprite.x, npc.sprite.y - 18, 0.42);
      this.showFloatingText(`+${gain}心`, npc.sprite.x, npc.sprite.y - 34, 0xfce7f3);
      this.refreshNpcActorLabel(npc);
    }

    if (this.advanceTime(ACTION_MINUTES)) {
      return;
    }

    this.persist();
    this.renderUi();
    this.playSfx("menu");
    this.showToast(`${message} ${this.socialActionMemoryFor(npc.id)}。`);
  }

  private nearbyNpc() {
    const front = this.frontTile();
    const facingNpc = this.getNpcForInteraction(front.x, front.y);

    if (facingNpc) {
      return facingNpc;
    }

    return this.npcActors.find((actor) => Math.abs(actor.x - this.save.player.x) + Math.abs(actor.y - this.save.player.y) <= 1);
  }

  private giftCandidates(): GiftCandidate[] {
    return [
      ...cropIds.map((cropId) => ({
        item: cropItem(cropId),
        category: "crop" as GiftCategory,
        name: CROPS[cropId].name,
        icon: ICON_FRAMES[cropId],
        orderReserveCount: this.orderReserveCountForCrop(cropId),
      })),
      ...forageIds.map((forageId) => ({
        item: forageItem(forageId),
        category: "forage" as GiftCategory,
        name: FORAGE[forageId].name,
        icon: ICON_FRAMES[FORAGE[forageId].icon],
      })),
      ...fishIds.map((fishId) => ({
        item: fishItem(fishId),
        category: "fish" as GiftCategory,
        name: FISH[fishId].name,
        icon: ICON_FRAMES[FISH[fishId].icon],
      })),
    ].filter((gift) => clampCount(this.save.inventory[gift.item]) > 0);
  }

  private chooseGiftForNpc(npcId: NpcId) {
    const gifts = this.giftCandidates();

    if (gifts.length === 0) {
      return undefined;
    }

    const safeGifts = gifts.filter((gift) =>
      giftAutoUseCount({
        inventoryCount: clampCount(this.save.inventory[gift.item]),
        orderReserveCount: gift.orderReserveCount,
      }) > 0,
    );
    const giftPool = safeGifts.length > 0 ? safeGifts : gifts;
    const preferred = giftPool.find((gift) => npcGiftPreferences[npcId].loves.includes(gift.category));
    const gift = preferred ?? giftPool[0];

    return {
      ...gift,
      points: preferred ? 3 : 1,
      loved: Boolean(preferred),
    };
  }

  private giveGiftToNearbyNpc() {
    const npc = this.nearbyNpc();

    if (!npc) {
      this.showToast("附近没有可以送礼的人。");
      return;
    }

    if (this.save.giftGivenToNpcs[npc.id] === this.save.day) {
      this.showToast(`${npc.name}：今天已经收到过礼物了，明天再来吧。`);
      return;
    }

    const gift = this.chooseGiftForNpc(npc.id);

    if (!gift) {
      this.showToast("背包里没有可以送出的收获物。");
      return;
    }

    this.save.inventory[gift.item] = clampCount(this.save.inventory[gift.item]) - 1;
    const teaBonus = hasCalendarEvent(this.save.day, "邻里茶会") ? 1 : 0;
    const perkBonus = socialFriendshipBonus(masteryLevel(this.save.mastery, "social"));
    const points = giftFriendshipPoints(gift.points, teaBonus, perkBonus);
    const friendship = clampCount(this.save.friendship[npc.id]) + points;
    const stage = relationshipStage(friendship);
    const relationshipNext = relationshipNextHint(friendship);
    const reward = this.grantRelationshipReward(npc.id, stage.level, npc.sprite.x, npc.sprite.y);
    this.rememberAction(`送${npc.name}${gift.name}`);
    this.save.friendship[npc.id] = friendship;
    this.save.giftGivenToNpcs[npc.id] = this.save.day;
    const questUpdate = this.markQuestProgress("meet-neighbor");
    const masteryUpdate = this.gainMastery("social", gift.loved ? 10 + teaBonus : 6 + teaBonus);

    if (this.advanceTime(ACTION_MINUTES)) {
      return;
    }

    this.persist();
    this.renderUi();
    this.playSfx(gift.loved ? "coin" : "menu");
    this.showFloatingIcon(gift.icon, npc.sprite.x, npc.sprite.y - 18, 0.48);
    this.showFloatingIcon(ICON_FRAMES.heart, npc.sprite.x + 15, npc.sprite.y - 20, 0.36);
    this.showFloatingText(`+${points}心${gift.loved ? " ❤" : ""}`, npc.sprite.x, npc.sprite.y - 36, gift.loved ? 0xffefba : 0xfce7f3);
    this.refreshNpcActorLabel(npc);
    this.showToast(
      `${giftResultHint({
        npcName: npc.name,
        giftName: gift.name,
        loved: gift.loved,
        lovedLine: npcGiftPreferences[npc.id].line,
        points,
        teaBonus,
        masteryBonus: perkBonus,
        stageLabel: stage.label,
        friendship,
        rewardText: reward,
        questText: questUpdate,
        masteryText: masteryUpdate,
      })} ${this.socialActionMemoryFor(npc.id)}。${relationshipNext}。`,
    );
  }

  private collectForage(spawn: ForageSpawn) {
    if (!this.isNear(spawn.x, spawn.y)) {
      this.showToast("离采集物再近一点。");
      return;
    }

    const item = FORAGE[spawn.id];
    const key = forageKey(this.save.day, spawn.place, spawn.id, spawn.x, spawn.y);

    if (this.save.collectedForage[key]) {
      this.showToast("这里今天已经采过了。");
      return;
    }

    const count = forageYield(1, masteryLevel(this.save.mastery, "foraging"), this.save.day, spawn.x, spawn.y);
    this.rememberAction(`采集${item.name}`);
    this.save.collectedForage[key] = this.save.day;
    this.save.inventory[forageItem(spawn.id)] = clampCount(this.save.inventory[forageItem(spawn.id)]) + count;
    const masteryUpdate = this.gainMastery("foraging", 8 + (count > 1 ? 2 : 0));

    if (this.advanceTime(SHOP_MINUTES)) {
      return;
    }

    this.persist();
    this.renderAll();
    this.playSfx("harvest");
    this.playTileFeedback(spawn.x, spawn.y, {
      color: 0xfacc15,
      icon: ICON_FRAMES[item.icon],
      label: count > 1 ? `+${item.name} x${count}` : `+${item.name}`,
      labelColor: 0xfff7ad,
    });
    this.showToast(`${forageResultHint({
      name: item.name,
      count,
      sellPrice: item.sellPrice,
      energyGain: snackEnergyValue(item.sellPrice, "forage"),
      inventoryCount: clampCount(this.save.inventory[forageItem(spawn.id)]),
      giftReadyCount: this.giftCandidates().length,
      timeMinutes: this.save.timeMinutes,
    })}${count > 1 ? "（采集熟练加成）" : ""}。${masteryUpdate}`);
  }

  private fishingCatchTierAt(x: number, y: number) {
    const baseRoll = (this.save.day * 29 + this.save.timeMinutes * 7 + x * 13 + y * 17) % 100;
    const pondLightsActive =
      hasCalendarEvent(this.save.day, "溪畔夜灯") && this.save.timeMinutes >= 18 * 60 && this.save.timeMinutes < 23 * 60;

    return fishingCatchTier({
      baseRoll,
      fishingLevel: masteryLevel(this.save.mastery, "fishing"),
      raining: this.currentWeather() === "rain",
      pondLightsActive,
    });
  }

  private fishIdForTier(tier: FishingCatchTier) {
    if (tier === "miss") {
      return undefined;
    }

    if (tier === "rare") {
      return "silverFish" as FishId;
    }

    if (tier === "good") {
      return "carp" as FishId;
    }

    return "creekFish" as FishId;
  }

  private fishForCast(x: number, y: number) {
    return this.fishIdForTier(this.fishingCatchTierAt(x, y));
  }

  private fishAt(x: number, y: number) {
    if (!this.isNear(x, y)) {
      this.showToast("离水边再近一点。");
      return;
    }

    if (!this.isFishableWater(x, y)) {
      this.showToast("这里下不了竿。");
      return;
    }

    if (!this.spendEnergy(toolEnergyCosts.fish)) {
      return;
    }

    const caught = this.fishForCast(x, y);

    if (caught) {
      this.rememberAction(`钓到${FISH[caught].name}`);
      this.save.inventory[fishItem(caught)] = clampCount(this.save.inventory[fishItem(caught)]) + 1;
    } else {
      this.rememberAction("钓鱼空竿");
    }
    const masteryUpdate = caught ? this.gainMastery("fishing", caught === "silverFish" ? 18 : 12) : "";

    if (this.advanceTime(FISHING_MINUTES)) {
      return;
    }

    this.persist();
    this.renderAll();
    this.playSfx("fish");
    this.playToolAnimation("fish");
    const condition = fishingConditionHint({
      weather: this.currentWeather(),
      timeMinutes: this.save.timeMinutes,
      pondLights: hasCalendarEvent(this.save.day, "溪畔夜灯"),
    });
    const nextTier = this.fishingCatchTierAt(x, y);
    const nextFishId = this.fishIdForTier(nextTier);
    const nextPreview = nextFishId
      ? fishingCastPreviewHint({
          tier: nextTier,
          catchName: FISH[nextFishId].name,
          sellPrice: FISH[nextFishId].sellPrice,
        })
      : fishingCastPreviewHint({ tier: nextTier });
    const spotPlan = fishingSpotPlanHint({
      previewHint: nextPreview,
      condition,
      energy: this.save.energy,
      timeMinutes: this.save.timeMinutes,
      fishInventoryCount: this.currentFishInventoryCount(),
    });
    const actionJuice = this.fishingActionJuiceFor(nextPreview);
    const biteCue = this.fishingBiteCueFor(nextTier);
    const basketRoute = this.currentFishingBasketRouteHint();

    if (!caught) {
      const feedbackCue = actionFeedbackCueHint({
        action: "fish-miss",
        energy: this.save.energy,
        timeMinutes: this.save.timeMinutes,
      });
      this.playTileFeedback(x, y, {
        color: 0x38bdf8,
        icon: ICON_FRAMES.fishingRod,
        label: "空竿",
        labelColor: 0xdbeafe,
      });
      this.showToast(`水面晃了一下，但鱼跑掉了。${fishingResultHint({
        energy: this.save.energy,
        timeMinutes: this.save.timeMinutes,
        condition,
      })}。${feedbackCue}。${spotPlan}。${biteCue}。${actionJuice}。${basketRoute}。`);
      return;
    }

    const fish = FISH[caught];
    const feedbackCue = actionFeedbackCueHint({
      action: "fish-catch",
      energy: this.save.energy,
      timeMinutes: this.save.timeMinutes,
    });
    this.playTileFeedback(x, y, {
      color: 0x38bdf8,
      icon: ICON_FRAMES[fish.icon],
      label: `+${fish.name}`,
      labelColor: 0xdbeafe,
    });
    this.showToast(`${fishingResultHint({
      caughtName: fish.name,
      sellPrice: fish.sellPrice,
      inventoryCount: clampCount(this.save.inventory[fishItem(caught)]),
      energy: this.save.energy,
      timeMinutes: this.save.timeMinutes,
      condition,
    })}。${feedbackCue}。${spotPlan}。${biteCue}。${actionJuice}。${basketRoute}。${masteryUpdate}`);
  }

  private mailForToday() {
    const weather = this.currentWeather();
    const season = SEASONS[this.currentSeason()].name;
    const event = calendarEventForDay(this.save.day);

    if (this.save.day === 1) {
      return "欢迎搬来山里。先把门前这片地照顾起来，随信附上几包萝卜种子。";
    }

    if (event) {
      return `今天是${event.title}。${event.note}`;
    }

    if (weather === "rain") {
      return "雨天会帮你浇田。要是体力还够，可以去小镇看看公告板。";
    }

    if (this.save.day % 5 === 0) {
      return `${season}的野外采集物会每天刷新，路边的小东西也能卖出好价钱。`;
    }

    return "镇上的店铺会一点点开起来。今天先把售卖箱和委托循环跑顺。";
  }

  private showMailbox() {
    const alreadyRead = this.save.mailReadDay === this.save.day;

    if (alreadyRead) {
      this.playSfx("menu");
      this.showToast("邮箱：今天的信已经读过了，里面只剩一点木头香。");
      return;
    }

    const message = this.mailForToday();
    let seedBonus = 0;
    this.save.mailReadDay = this.save.day;

    if (this.save.day === 1) {
      this.save.inventory.turnip_seed = clampCount(this.save.inventory.turnip_seed) + 2;
      seedBonus = 2;
      this.showFloatingIcon(ICON_FRAMES.turnip, this.tileCenterX(10), this.tileCenterY(5) - 12, 0.54);
    }

    const questUpdate = this.markQuestProgress("read-mail");

    if (this.advanceTime(SHOP_MINUTES)) {
      return;
    }

    this.persist();
    this.renderUi();
    this.playSfx("menu");
    this.showToast(`邮箱：${mailboxResultHint({
      message,
      seedBonus,
      nextObjectiveLabel: this.currentDailyObjective().label,
    })}${questUpdate}`);
  }

  private showForecast() {
    const tomorrowWeather = weatherForDay(this.save.day + 1);
    const tomorrowSeason = SEASONS[seasonForDay(this.save.day + 1)].name;
    const order = this.ensureDailyOrder();
    const lowestMastery = masteryTrackIds.reduce((lowest, track) =>
      masteryLevel(this.save.mastery, track) < masteryLevel(this.save.mastery, lowest) ? track : lowest,
    );
    const advice = dailyAdvice({
      weather: tomorrowWeather,
      orderAccepted: order.accepted,
      orderCompleted: order.completed,
      orderStreak: this.save.stats.currentOrderStreak,
      lowestMastery,
    });

    this.playSfx("menu");
    this.showToast(
      `电视：${forecastSummaryHint({
        seasonName: tomorrowSeason,
        weatherName: WEATHER[tomorrowWeather].name,
        weatherNote: WEATHER[tomorrowWeather].note,
        weatherPlan: this.weatherPlanFor(tomorrowWeather),
        advice,
      })}`,
    );
  }

  private showOrderBoard() {
    const order = this.ensureDailyOrder();
    const cropName = CROPS[order.cropId].name;
    const progress = this.currentOrderProgress(order);

    if (order.completed) {
      this.showToast(`公告板：今天的${cropName}订单已经完成了。`);
      return;
    }

    if (!order.accepted) {
      order.accepted = true;
      const questUpdate = this.markQuestProgress("accept-order");

      if (this.advanceTime(SHOP_MINUTES)) {
        return;
      }

      this.persist();
      this.renderUi();
      this.playSfx("coin");
      this.showToast(
        `接下订单：今晚售卖箱放入 ${cropName} x${order.count}，${this.orderRewardSummaryFor(order)}。现有 ${progress.availableCount}/${progress.requiredCount}${progress.ready ? "，已经备齐" : `，还差 ${progress.remainingCount}`}。${this.orderNextStepHintFor(order)}。${questUpdate}`,
      );
      return;
    }

    this.playSfx("menu");
    this.showToast(
      `订单进行中：${cropName} ${progress.availableCount}/${progress.requiredCount}，${this.orderDeadlineHintFor(order)}。${this.orderTurnInHintFor(order)}。${this.orderNextStepHintFor(order)}。`,
    );
  }

  private useToolAt(x: number, y: number) {
    const plot = this.save.plots[plotKey(x, y)];
    let toast = "";
    let feedback: TileFeedback | undefined;
    let splashTiles: TilePoint[] = [];
    const questUpdates: string[] = [];
    let masteryUpdate = "";
    let resultHint = "";
    let feedbackAction: "till" | "plant" | "water" | "harvest" | undefined;

    if (!plot) {
      this.showToast("这里不能耕种。");
      return;
    }

    if (!this.isNear(x, y)) {
      this.showToast("离地块再近一点。");
      return;
    }

    if (this.save.selectedTool === "fish") {
      this.showToast("去水边对着水面抛竿。");
      return;
    }

    const tactileHint = fieldTactileCueHint({
      tool: this.save.selectedTool,
      tilled: plot.tilled,
      cropPlanted: Boolean(plot.cropId),
      mature: this.isMature(plot),
      watered: plot.watered,
      raining: this.currentWeather() === "rain",
      seedCount: clampCount(this.save.inventory[seedItem(this.save.selectedSeed)]),
      energy: this.save.energy,
      energyCost: this.energyCostForTool(this.save.selectedTool),
    });

    if (this.save.selectedTool === "hoe") {
      if (plot.cropId) {
        this.showToast("作物还在地里。");
        return;
      }

      if (!this.spendEnergy(toolEnergyCosts.hoe)) {
        return;
      }

      plot.tilled = true;
      plot.watered = false;
      this.rememberAction("翻地");
      toast = "土地翻好了。";
      feedbackAction = "till";
      resultHint = farmActionResultHint({
        action: "till",
        energy: this.save.energy,
        timeMinutes: this.save.timeMinutes + ACTION_MINUTES,
      });
      questUpdates.push(this.markQuestProgress("till-plot"));
      masteryUpdate = this.gainMastery("farming", 3);
      feedback = {
        color: 0xf59e0b,
        icon: ICON_FRAMES.hoe,
        label: "翻地",
      };
    } else if (this.save.selectedTool === "seed") {
      const seed = seedItem(this.save.selectedSeed);

      if (!plot.tilled) {
        this.showToast("先用锄头开垦土地。");
        return;
      }

      if (plot.cropId) {
        this.showToast("这里已经种下作物。");
        return;
      }

      if (clampCount(this.save.inventory[seed]) <= 0) {
        this.showToast("背包里没有这种种子。");
        return;
      }

      if (!this.spendEnergy(toolEnergyCosts.seed)) {
        return;
      }

      this.save.inventory[seed] = clampCount(this.save.inventory[seed]) - 1;
      plot.cropId = this.save.selectedSeed;
      plot.growth = 0;
      plot.watered = this.currentWeather() === "rain";
      this.rememberAction(`播种${CROPS[this.save.selectedSeed].name}`);
      toast = `${CROPS[this.save.selectedSeed].name}种下去了。`;
      feedbackAction = "plant";
      resultHint = farmActionResultHint({
        action: "plant",
        cropName: CROPS[this.save.selectedSeed].name,
        energy: this.save.energy,
        timeMinutes: this.save.timeMinutes + ACTION_MINUTES,
        inventoryCount: clampCount(this.save.inventory[seed]),
        watered: plot.watered,
      });
      questUpdates.push(this.markQuestProgress("plant-crop"));
      if (plot.watered) {
        questUpdates.push(this.markQuestProgress("water-crop"));
      }
      masteryUpdate = this.gainMastery("farming", 4);
      feedback = {
        color: 0x22c55e,
        icon: ICON_FRAMES[this.save.selectedSeed],
        label: CROPS[this.save.selectedSeed].name,
        labelColor: 0xecfccb,
      };
    } else if (this.save.selectedTool === "water") {
      if (!plot.cropId) {
        this.showToast("这里还没有作物。");
        return;
      }

      if (this.currentWeather() === "rain") {
        this.showToast("今天下雨，这块地已经喝饱了。");
        return;
      }

      if (plot.watered) {
        this.showToast("这块地已经浇过水了。");
        return;
      }

      if (!this.spendEnergy(toolEnergyCosts.water)) {
        return;
      }

      plot.watered = true;
      splashTiles = this.waterSplashFrom(x, y);
      this.rememberAction("浇水");
      toast = `浇过水了${splashTiles.length > 0 ? `，熟练溅水照看 ${splashTiles.length} 块邻田` : ""}。`;
      feedbackAction = "water";
      resultHint = farmActionResultHint({
        action: "water",
        energy: this.save.energy,
        timeMinutes: this.save.timeMinutes + ACTION_MINUTES,
        splashCount: splashTiles.length,
      });
      questUpdates.push(this.markQuestProgress("water-crop"));
      masteryUpdate = this.gainMastery("farming", 3);
      feedback = {
        color: 0x38bdf8,
        icon: ICON_FRAMES.wateringCan,
        label: "浇水",
        labelColor: 0xdbeafe,
      };
    } else {
      if (!plot.cropId || !this.isMature(plot)) {
        this.showToast("作物还没成熟。");
        return;
      }

      if (!this.spendEnergy(toolEnergyCosts.harvest)) {
        return;
      }

      const crop = plot.cropId;
      const item = cropItem(crop);
      masteryUpdate = this.gainMastery("farming", 10 + CROPS[crop].growDays * 2);
      this.rememberAction(`收获${CROPS[crop].name}`);
      this.save.inventory[item] = clampCount(this.save.inventory[item]) + 1;
      plot.cropId = undefined;
      plot.growth = 0;
      plot.watered = false;
      plot.tilled = true;
      toast = `收获了${CROPS[crop].name}。`;
      feedbackAction = "harvest";
      resultHint = farmActionResultHint({
        action: "harvest",
        cropName: CROPS[crop].name,
        energy: this.save.energy,
        timeMinutes: this.save.timeMinutes + ACTION_MINUTES,
        inventoryCount: clampCount(this.save.inventory[item]),
        sellPrice: CROPS[crop].sellPrice,
      });
      feedback = {
        color: 0xfef08a,
        icon: ICON_FRAMES[crop],
        label: `+${CROPS[crop].name}`,
        labelColor: 0xfff7ad,
      };
    }

    if (this.advanceTime(ACTION_MINUTES)) {
      return;
    }

    this.persist();
    this.renderAll();
    const nextStepHint = this.currentFieldActionNextStepHint();
    if (feedback) {
      this.playSfx(this.save.selectedTool);
      this.playToolAnimation(this.save.selectedTool);
      this.playTileFeedback(x, y, feedback);
      splashTiles.forEach((tile) => {
        this.playTileFeedback(tile.x, tile.y, {
          color: 0x38bdf8,
          icon: ICON_FRAMES.wateringCan,
          label: "溅水",
          labelColor: 0xdbeafe,
        });
      });
    }
    const actionFollowUpHint = farmActionFollowUpHint({
      resultHint,
      nextStepHint,
      energy: this.save.energy,
      timeMinutes: this.save.timeMinutes,
    });
    const feedbackCue = feedbackAction
      ? actionFeedbackCueHint({
          action: feedbackAction,
          energy: this.save.energy,
          timeMinutes: this.save.timeMinutes,
        })
      : "";

    this.showToast(`${toast} ${actionFollowUpHint}。${tactileHint}。${feedbackCue}。${questUpdates.filter(Boolean).join("")}${masteryUpdate}`);
  }

  private waterSplashFrom(x: number, y: number) {
    const limit = wateringSplashLimit(masteryLevel(this.save.mastery, "farming"));

    if (limit <= 0) {
      return [];
    }

    const candidates: TilePoint[] = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];
    const wateredTiles: TilePoint[] = [];

    for (const tile of candidates) {
      if (wateredTiles.length >= limit) {
        break;
      }

      const adjacentPlot = this.save.plots[plotKey(tile.x, tile.y)];

      if (!adjacentPlot?.cropId || adjacentPlot.watered) {
        continue;
      }

      adjacentPlot.watered = true;
      wateredTiles.push(tile);
    }

    return wateredTiles;
  }

  private spendEnergy(cost: number) {
    const adjustedCost = this.energyCostForTool(this.save.selectedTool, cost);

    if (this.save.energy < adjustedCost) {
      this.showToast("体力不够了，回家睡一觉吧。");
      return false;
    }

    this.save.energy -= adjustedCost;
    return true;
  }

  private energyCostForTool(tool: ToolId, cost = toolEnergyCosts[tool]) {
    if (tool !== "fish") {
      return farmingEnergyCost(cost, masteryLevel(this.save.mastery, "farming"));
    }

    return Math.max(1, cost - Math.floor(masteryLevel(this.save.mastery, "fishing") / 3));
  }

  private advanceTime(minutes: number) {
    this.save.timeMinutes = Math.min(LATE_TIME, this.save.timeMinutes + minutes);

    if (this.save.timeMinutes >= LATE_TIME) {
      this.sleep(true);
      return true;
    }

    return false;
  }

  private sleep(passedOut = false) {
    let income = 0;
    let orderReward = 0;
    let streakBonus = 0;
    let shippedItems = 0;
    const bedtimeNote = this.currentBedtimeWarning();
    const weather = this.currentWeather();
    const order = this.ensureDailyOrder();
    const orderEventTitle = calendarEventForDay(this.save.day)?.title;

    if (order.accepted && !order.completed && clampCount(this.save.shipping[order.cropId]) >= order.count) {
      order.completed = true;
      this.save.stats.currentOrderStreak += 1;
      this.save.stats.bestOrderStreak = Math.max(this.save.stats.bestOrderStreak, this.save.stats.currentOrderStreak);
      streakBonus = orderStreakBonus(this.save.stats.currentOrderStreak);
      orderReward = order.reward;
      this.save.stats.completedOrders += 1;
    } else if (order.accepted && !order.completed) {
      this.save.stats.currentOrderStreak = 0;
    }
    const orderMasteryUpdate = orderReward > 0 ? this.gainMastery("farming", 20, false).trim() : "";

    for (const cropId of cropIds) {
      const count = clampCount(this.save.shipping[cropId]);
      shippedItems += count;
      income += count * CROPS[cropId].sellPrice;
      this.save.shipping[cropId] = 0;
    }

    for (const forageId of forageIds) {
      const count = clampCount(this.save.forageShipping[forageId]);
      shippedItems += count;
      income += count * FORAGE[forageId].sellPrice;
      this.save.forageShipping[forageId] = 0;
    }

    for (const fishId of fishIds) {
      const count = clampCount(this.save.fishShipping[fishId]);
      shippedItems += count;
      income += count * FISH[fishId].sellPrice;
      this.save.fishShipping[fishId] = 0;
    }
    this.save.stats.totalShipped += shippedItems;
    this.save.stats.totalShippingIncome += income;
    this.save.stats.totalOrderRewards += orderReward + streakBonus;

    for (const plot of Object.values(this.save.plots)) {
      if (plot.cropId && (plot.watered || weather === "rain") && plot.growth < CROPS[plot.cropId].growDays) {
        plot.growth += 1;
      }
      plot.watered = false;
    }

    const passOutFee = passedOut ? Math.min(this.save.gold + income + orderReward + streakBonus, 30) : 0;
    const questUpdate = income + orderReward > 0 ? this.markQuestProgress("sleep-after-shipping").trim() : "";
    this.save.day += 1;
    this.save.gold += income + orderReward + streakBonus - passOutFee;
    this.save.energy = MAX_ENERGY;
    this.save.timeMinutes = START_TIME;
    this.save.talkedToNpcs = {};
    this.save.giftGivenToNpcs = {};
    this.save.collectedForage = {};
    this.save.dailyOrder = createDailyOrder(this.save.day);
    this.save.player = {
      place: "home",
      x: 6,
      y: 6,
      facing: "down",
    };
    this.rememberAction("睡醒迎接清晨");
    const rating = this.currentFarmRating();
    const netIncome = settlementNet({ income, orderReward, streakBonus, passOutFee });
    const morningSettlement = morningSettlementToastHint({
      income,
      orderReward,
      streakBonus,
      passOutFee,
      shippedItems,
      farmRatingLabel: rating.label,
      farmRatingScore: rating.score,
      eventTitle: orderEventTitle,
    });
    const morningObjective = this.currentDailyObjective();
    const morningEvent = calendarEventForDay(this.save.day);
    const morningPlan = dayStartPlanHint({
      objectiveLabel: morningObjective.label,
      objectiveDetail: morningObjective.detail,
      weather: this.currentWeather(),
      netGold: netIncome,
      eventTitle: morningEvent?.title,
    });
    const morningRoute = dayBreakRouteHint({
      objectiveId: morningObjective.id,
      objectiveLabel: morningObjective.label,
      timeMinutes: START_TIME,
      travelMinutes: TRAVEL_MINUTES,
    });
    const morningFirstAction = dayStartFirstActionHint({
      objectiveId: morningObjective.id,
      weather: this.currentWeather(),
      seedCount: this.currentSeedInventoryCount(),
      openPlotCount: this.currentOpenPlotCount(),
      giftReadyCount: this.giftCandidates().length,
      sellableInventoryCount: this.currentSellableInventoryCount(),
      eventTitle: morningEvent?.title,
    });
    this.persist();
    this.renderAll();

    const messages = [
      passedOut ? "太晚了，你醒来时已经回到床上。" : "",
      morningSettlement,
      bedtimeNote.startsWith("今天的节奏") ? "" : bedtimeNote,
      orderMasteryUpdate,
      questUpdate,
      morningPlan,
      morningRoute,
      morningFirstAction,
    ].filter(Boolean);

    this.showDayBreakBanner(messages.length > 0 ? messages.join(" ") : WEATHER[this.currentWeather()].note);
    this.showShippingSummary({ income, orderReward, streakBonus, passOutFee, passedOut });
    this.playSfx("day");
    this.showToast(messages.length > 0 ? messages.join(" ") : WEATHER[this.currentWeather()].note);
  }

  private shipAllCrops() {
    let shipped = 0;

    for (const cropId of cropIds) {
      const item = cropItem(cropId);
      const count = clampCount(this.save.inventory[item]);

      if (count > 0) {
        this.save.shipping[cropId] = clampCount(this.save.shipping[cropId]) + count;
        this.save.inventory[item] = 0;
        shipped += count;
      }
    }

    for (const forageId of forageIds) {
      const item = forageItem(forageId);
      const count = clampCount(this.save.inventory[item]);

      if (count > 0) {
        this.save.forageShipping[forageId] = clampCount(this.save.forageShipping[forageId]) + count;
        this.save.inventory[item] = 0;
        shipped += count;
      }
    }

    for (const fishId of fishIds) {
      const item = fishItem(fishId);
      const count = clampCount(this.save.inventory[item]);

      if (count > 0) {
        this.save.fishShipping[fishId] = clampCount(this.save.fishShipping[fishId]) + count;
        this.save.inventory[item] = 0;
        shipped += count;
      }
    }

    if (shipped === 0) {
      this.showToast("背包里没有可售卖的作物、采集物或渔获。");
      return;
    }

    const preview = this.currentShippingPreview();
    const questUpdate = this.markQuestProgress("ship-first");
    this.rememberAction(`入箱${shipped}件`);

    if (this.advanceTime(SHOP_MINUTES)) {
      return;
    }

    this.persist();
    this.renderUi();
    this.playSfx("coin");
    const nextStep = shippingNextStepHint({
      shippedCount: shipped,
      expectedGold: preview.total,
      orderWillComplete: preview.orderWillComplete,
      timeMinutes: this.save.timeMinutes,
      energy: this.save.energy,
      sellableInventoryCount: this.currentSellableInventoryCount(),
    });
    const urgency = this.currentShippingUrgencyHint();
    const feedbackCue = actionFeedbackCueHint({
      action: "ship",
      energy: this.save.energy,
      timeMinutes: this.save.timeMinutes,
    });
    const toastParts = [
      shippingDepositHint({
        shippedCount: shipped,
        totalGold: preview.total,
        sellableIncome: preview.sellableIncome,
        orderReward: preview.orderReward,
        streakBonus: preview.streakBonus,
        orderWillComplete: preview.orderWillComplete,
        timeMinutes: this.save.timeMinutes,
      }),
      urgency,
      feedbackCue,
      nextStep,
      questUpdate.trim(),
    ].filter(Boolean);
    this.showFloatingIcon(ICON_FRAMES.harvestBasket, this.tileCenterX(9), this.tileCenterY(5) - 8, 0.58);
    this.showFloatingText(`${shipped} 件入箱`, this.tileCenterX(9), this.tileCenterY(5) - 26, 0xffefba);
    this.showToast(toastParts.join("。"));
  }

  private frontTile() {
    const { x, y, facing } = this.save.player;

    if (facing === "up") {
      return { x, y: y - 1 };
    }

    if (facing === "down") {
      return { x, y: y + 1 };
    }

    if (facing === "left") {
      return { x: x - 1, y };
    }

    return { x: x + 1, y };
  }

  private faceToward(x: number, y: number) {
    const dx = x - this.save.player.x;
    const dy = y - this.save.player.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.save.player.facing = dx < 0 ? "left" : "right";
    } else if (dy !== 0) {
      this.save.player.facing = dy < 0 ? "up" : "down";
    }

    this.playerSprite?.setFrame(playerFrames[this.save.player.facing]);
    this.refreshInteractionOverlay();
  }

  private isNear(x: number, y: number) {
    return Math.abs(this.save.player.x - x) + Math.abs(this.save.player.y - y) <= 1;
  }

  private isMature(plot: PlotState) {
    return Boolean(plot.cropId && plot.growth >= CROPS[plot.cropId].growDays);
  }

  private getCropStage(plot: PlotState) {
    if (!plot.cropId) {
      return 0;
    }

    if (this.isMature(plot)) {
      return 3;
    }

    const growDays = CROPS[plot.cropId].growDays;
    return Math.max(0, Math.min(2, Math.floor((plot.growth / growDays) * 3)));
  }

  private getCropFrame(plot: PlotState) {
    if (!plot.cropId) {
      return 0;
    }

    return CROP_FRAME_OFFSET[plot.cropId] + this.getCropStage(plot);
  }

  private isBlocked(place: PlaceId, x: number, y: number) {
    if (this.getObjects(place, "transition").some((object) => containsTile(object, x, y))) {
      return false;
    }

    if (
      this.getObjects(place).some(
        (object) =>
          (object.type === "collision" || object.type === "closed-building" || object.type === "counter") &&
          containsTile(object, x, y),
      )
    ) {
      return true;
    }

    return this.npcActors.some((actor) => actor.x === x && actor.y === y);
  }

  private inMap(x: number, y: number, place = this.save.player.place) {
    const map = this.maps?.[place];
    const width = map?.width ?? MAP_COLS;
    const height = map?.height ?? MAP_ROWS;

    return x >= 0 && y >= 0 && x < width && y < height;
  }

  private flashTile(x: number, y: number, color: number) {
    const flash = this.add
      .rectangle(this.tileCenterX(x), this.tileCenterY(y), TILE - 6, TILE - 6, color, 0.35)
      .setDepth(34);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.35,
      duration: 240,
      onComplete: () => flash.destroy(),
    });
  }

  private playTileFeedback(x: number, y: number, feedback: TileFeedback) {
    const centerX = this.tileCenterX(x);
    const centerY = this.tileCenterY(y);

    this.flashTile(x, y, feedback.color);
    this.showFloatingIcon(feedback.icon, centerX + 10, centerY - 16, 0.5);
    this.showFloatingText(feedback.label, centerX, centerY - 22, feedback.labelColor ?? 0xffefba);
  }

  private playToolAnimation(tool: ToolId) {
    if (!this.playerSprite) {
      return;
    }

    const swing = this.save.player.facing === "left" ? -10 : this.save.player.facing === "right" ? 10 : 0;
    const yOffset = tool === "seed" ? -3 : tool === "water" ? -1 : 2;
    const scaleX = tool === "water" ? 0.94 : 1.08;
    const scaleY = tool === "water" ? 1.08 : 0.94;

    this.tweens.add({
      targets: this.playerSprite,
      angle: tool === "seed" ? 0 : swing,
      y: this.playerSprite.y + yOffset,
      scaleX,
      scaleY,
      duration: 95,
      yoyo: true,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.playerSprite?.setAngle(0).setScale(1).setFrame(playerFrames[this.save.player.facing]);
      },
    });
  }

  private showFloatingIcon(frame: number | undefined, x: number, y: number, scale = 0.5, fixed = false) {
    if (frame === undefined) {
      return;
    }

    const icon = this.add.image(x, y, "icons", frame).setScale(scale).setDepth(140);
    if (fixed) {
      icon.setScrollFactor(0);
    }

    this.tweens.add({
      targets: icon,
      y: y - 24,
      alpha: 0,
      duration: 820,
      ease: "Sine.easeOut",
      onComplete: () => icon.destroy(),
    });
  }

  private showFloatingText(text: string, x: number, y: number, color = 0xffefba, fixed = false) {
    const label = this.add
      .text(x, y, text, {
        color: hexColor(color),
        fontFamily: UI_FONT,
        fontSize: "14px",
        fontStyle: "800",
        stroke: "#3a2212",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(141);
    if (fixed) {
      label.setScrollFactor(0);
    }

    this.tweens.add({
      targets: label,
      y: y - 26,
      alpha: 0,
      duration: 900,
      ease: "Sine.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private showDayBreakBanner(summary: string) {
    const width = 304;
    const height = 58;
    const x = Math.round((this.viewWidth() - width) / 2);
    const y = 24;
    const weather = this.currentWeather();
    const objects = [
      this.add.rectangle(x + 6, y + 7, width, height, UI_COLORS.shadow, 0.48).setOrigin(0, 0).setDepth(150).setScrollFactor(0),
      this.add.rectangle(x, y, width, height, UI_COLORS.night).setOrigin(0, 0).setStrokeStyle(4, UI_COLORS.gold).setDepth(151).setScrollFactor(0),
      this.add.image(x + 30, y + 30, "icons", this.weatherIconFrame(weather)).setScale(0.64).setDepth(152).setScrollFactor(0),
      this.add
        .text(x + 56, y + 10, `第 ${this.save.day} 天`, {
          color: hexColor(UI_COLORS.goldSoft),
          fontFamily: UI_FONT,
          fontSize: "16px",
          fontStyle: "800",
        })
        .setDepth(152)
        .setScrollFactor(0),
      this.add
        .text(x + 56, y + 34, summary, {
          color: hexColor(UI_COLORS.cream),
          fontFamily: UI_FONT,
          fontSize: "11px",
          fontStyle: "700",
          wordWrap: { width: 226 },
        })
        .setDepth(152)
        .setScrollFactor(0),
    ];

    this.time.delayedCall(2600, () => {
      this.tweens.add({
        targets: objects,
        alpha: 0,
        duration: 360,
        onComplete: () => {
          objects.forEach((object) => object.destroy());
        },
      });
    });
  }

  private speakerFrame(speaker: string) {
    const npcId = npcIds.find((id) => npcDisplayNames[id] === speaker);

    return npcId ? CHARACTER_FRAMES[npcId] : undefined;
  }

  private showToast(message: string) {
    this.clearObjects(this.messageObjects);

    const speakerSplit = message.indexOf("：");
    const hasSpeaker = speakerSplit > 0 && speakerSplit <= 6;
    const speaker = hasSpeaker ? message.slice(0, speakerSplit) : "";
    const line = hasSpeaker ? message.slice(speakerSplit + 1) : message;
    const playerScreenY = this.playerSprite ? this.playerSprite.y - this.cameras.main.scrollY : this.viewHeight() / 2;
    const width = hasSpeaker ? Math.min(760, this.viewWidth() - 96) : Math.min(420, this.viewWidth() - 96);
    const height = hasSpeaker ? 92 : 54;
    const x = Math.round((this.viewWidth() - width) / 2);
    const bottomY = this.viewHeight() - HOTBAR_HEIGHT - height - 18;
    const topY = hasSpeaker ? 92 : 82;
    const y = hasSpeaker && playerScreenY > this.viewHeight() * 0.55 ? topY : hasSpeaker ? bottomY : topY;

    this.addMessageObject(
      this.add
        .rectangle(x + 6, y + 7, width, height, UI_COLORS.shadow, 0.5)
        .setOrigin(0, 0)
        .setDepth(116),
    );
    this.addMessageObject(
      this.add
        .rectangle(x, y, width, height, UI_COLORS.night)
        .setOrigin(0, 0)
        .setStrokeStyle(4, UI_COLORS.gold)
        .setDepth(118),
    );

    if (hasSpeaker) {
      const portraitFrame = this.speakerFrame(speaker);
      this.addMessageObject(
        this.add
          .rectangle(x + 18, y + 18, 74, 46, UI_COLORS.ink)
          .setOrigin(0, 0)
          .setStrokeStyle(3, UI_COLORS.gold)
          .setDepth(119),
      );

      if (portraitFrame !== undefined) {
        this.addMessageObject(
          this.add
            .image(x + 55, y + 37, "characters", portraitFrame)
            .setScale(1.05)
            .setDepth(120),
        );
        this.addMessageObject(
          this.add
            .text(x + 55, y + 54, speaker, {
              color: hexColor(UI_COLORS.goldSoft),
              fontFamily: UI_FONT,
              fontSize: "10px",
              fontStyle: "700",
            })
            .setOrigin(0.5, 0)
            .setDepth(121),
        );
      } else {
        this.addMessageObject(
          this.add
            .text(x + 55, y + 30, speaker, {
              color: hexColor(UI_COLORS.goldSoft),
              fontFamily: UI_FONT,
              fontSize: "13px",
              fontStyle: "700",
            })
            .setOrigin(0.5, 0)
            .setDepth(120),
        );
      }
    }

    this.addMessageObject(
      this.add
        .text(hasSpeaker ? x + 112 : x + 22, hasSpeaker ? y + 18 : y + 15, line, {
          color: hexColor(UI_COLORS.cream),
          fontFamily: UI_FONT,
          fontSize: hasSpeaker ? "15px" : "13px",
          fontStyle: "700",
          wordWrap: {
            width: hasSpeaker ? width - 148 : width - 44,
          },
        })
        .setDepth(120),
    );

    if (hasSpeaker) {
      this.addMessageObject(
        this.add
          .text(x + width - 94, y + height - 24, "E/Space", {
            color: hexColor(UI_COLORS.mint),
            fontFamily: UI_FONT,
            fontSize: "11px",
            fontStyle: "700",
          })
          .setDepth(120),
      );
    }

    const objects = [...this.messageObjects];
    this.time.delayedCall(hasSpeaker ? 3600 : 1800, () => {
      this.tweens.add({
        targets: objects,
        alpha: 0,
        duration: 260,
        onComplete: () => {
          for (const object of objects) {
            const index = this.messageObjects.indexOf(object);

            if (index >= 0) {
              this.messageObjects.splice(index, 1);
            }

            object.destroy();
          }
        },
      });
    });
  }

  private addTileFrame(frame: number, x: number, y: number, depth = 0) {
    return this.addMapObject(
      this.add
        .image(this.tileCenterX(x), this.tileCenterY(y), "tiles", frame)
        .setDepth(depth),
    );
  }

  private tileCenterX(x: number) {
    return MAP_X + x * TILE + TILE / 2;
  }

  private tileCenterY(y: number) {
    return MAP_Y + y * TILE + TILE / 2;
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  parent: "game-root",
  backgroundColor: "#2a1a10",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [FarmLifeScene],
};

new Phaser.Game(config);
