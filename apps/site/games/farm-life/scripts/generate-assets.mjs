import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const TILE = 32;
const COLS = 42;
const ROWS = 28;
const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(root, "public");
const spriteDir = join(publicDir, "assets", "sprites");
const mapDir = join(publicDir, "assets", "maps");
const uiDir = join(publicDir, "assets", "ui");
const farmRpgAssetDir = join(root, "..", "..", "game", "Farm RPG - Tiny Asset Pack - (All in One)");
const SOURCE_TILE = 16;
const CHARACTER_TILE = 32;

const cropCatalog = [
  { id: "turnip", season: "spring", crop: ["Crops", "Spring", "Parsnip.png"], icon: "Parsnip.png" },
  { id: "wheat", season: "summer", crop: ["Crops", "Summer", "Wheat.png"], icon: "Wheat.png" },
  { id: "potato", season: "spring", crop: ["Crops", "Spring", "Potato.png"], icon: "Potato.png" },
  { id: "asparagus", season: "spring", crop: ["Crops", "Spring", "Asparagus.png"], icon: "Asparagus.png" },
  { id: "blueberry", season: "spring", crop: ["Crops", "Spring", "Blueberry.png"], icon: "Blueberry.png" },
  { id: "broccoli", season: "spring", crop: ["Crops", "Spring", "Broccoli.png"], icon: "Broccoli.png" },
  { id: "cabbage", season: "spring", crop: ["Crops", "Spring", "Cabbage.png"], icon: "Cabbage.png" },
  { id: "carrot", season: "spring", crop: ["Crops", "Spring", "Carrot.png"], icon: "Carrot.png" },
  { id: "cauliflower", season: "spring", crop: ["Crops", "Spring", "Cauliflower.png"], icon: "Cauliflower.png" },
  { id: "onion", season: "spring", crop: ["Crops", "Spring", "Onion.png"], icon: "Onion.png" },
  { id: "rice", season: "spring", crop: ["Crops", "Spring", "Rice.png"], icon: "Rice.png" },
  { id: "springOnion", season: "spring", crop: ["Crops", "Spring", "Spring Onion.png"], icon: "Spring Onion.png" },
  { id: "strawberry", season: "spring", crop: ["Crops", "Spring", "Strawberry.png"], icon: "Strawberry.png" },
  { id: "adzukiBean", season: "summer", crop: ["Crops", "Summer", "Adzuki Bean.png"], icon: "Adzuki Bean.png" },
  { id: "bellPepper", season: "summer", crop: ["Crops", "Summer", "Bell Pepper.png"], icon: "Green Bell Pepper.png" },
  { id: "blackberry", season: "summer", crop: ["Crops", "Summer", "Blackberry.png"], icon: "Blackberry.png" },
  { id: "cucumber", season: "summer", crop: ["Crops", "Summer", "Cucumber.png"], icon: "Cucumber.png" },
  { id: "greenBeans", season: "summer", crop: ["Crops", "Summer", "Green Beans.png"], icon: "Green Beans.png" },
  { id: "hotPepper", season: "summer", crop: ["Crops", "Summer", "Hot Pepper.png"], icon: "Hot Pepper.png" },
  { id: "melon", season: "summer", crop: ["Crops", "Summer", "Melon.png"], icon: "Melon.png" },
  { id: "pineapple", season: "summer", crop: ["Crops", "Summer", "Pineapple.png"], icon: "Pineapple.png" },
  { id: "sunflower", season: "summer", crop: ["Crops", "Summer", "Sunflower.png"], icon: "Sunflower.png" },
  { id: "tomato", season: "summer", crop: ["Crops", "Summer", "Tomato.png"], icon: "Tomato.png" },
  { id: "watermelon", season: "summer", crop: ["Crops", "Summer", "Watermelon.png"], icon: "Watermelon.png" },
  { id: "aloe", season: "autumn", crop: ["Crops", "Fall", "Aloe.png"], icon: "Aloe.png" },
  { id: "beetroot", season: "autumn", crop: ["Crops", "Fall", "Beetroot.png"], icon: "Beetroot.png" },
  { id: "corn", season: "autumn", crop: ["Crops", "Fall", "Corn.png"], icon: "Corn.png" },
  { id: "eggplant", season: "autumn", crop: ["Crops", "Fall", "Eggplant.png"], icon: "Eggplant.png" },
  { id: "grapes", season: "autumn", crop: ["Crops", "Fall", "Grapes.png"], icon: "Grapes.png" },
  { id: "pumpkin", season: "autumn", crop: ["Crops", "Fall", "Pumpkin.png"], icon: "Pumpkin.png" },
];

const productCatalog = [
  { id: "chickenEgg", icon: ["Icons", "Food Icons", "Chicken Egg.png"] },
  { id: "duckEgg", icon: ["Icons", "Food Icons", "Duck Egg.png"] },
  { id: "cowMilk", icon: ["Icons", "Food Icons", "Small Cow Milk.png"] },
  { id: "goatMilk", icon: ["Icons", "Food Icons", "Small Goat Milk.png"] },
  { id: "wool", icon: ["Icons", "Food Icons", "Wool.png"] },
  { id: "truffle", icon: ["Icons", "Food Icons", "Truffle.png"] },
  { id: "ostrichEgg", icon: ["Icons", "Food Icons", "Ostrich Egg.png"] },
  { id: "honey", icon: ["Icons", "Food Icons", "Honey.png"] },
  { id: "cheese", icon: ["Icons", "Food Icons", "Cheese.png"] },
  { id: "butter", icon: ["Icons", "Food Icons", "Butter.png"] },
  { id: "jam", icon: ["Icons", "Food Icons", "Jam.png"] },
  { id: "apple", icon: ["Icons", "Food Icons", "Apple.png"] },
  { id: "apricot", icon: ["Icons", "Food Icons", "Apricot.png"] },
  { id: "cherry", icon: ["Icons", "Food Icons", "Cherry.png"] },
  { id: "banana", icon: ["Icons", "Food Icons", "Banana.png"] },
  { id: "mango", icon: ["Icons", "Food Icons", "Mango.png"] },
  { id: "orange", icon: ["Icons", "Food Icons", "Orange.png"] },
  { id: "peach", icon: ["Icons", "Food Icons", "Peach.png"] },
  { id: "coconut", icon: ["Icons", "Food Icons", "Coconut.png"] },
];

const fishCatalog = [
  { id: "creekFish", icon: ["Icons", "Fish", "River", "Chub.png"] },
  { id: "carp", icon: ["Icons", "Fish", "River", "Carp.png"] },
  { id: "silverFish", icon: ["Icons", "Fish", "River", "Perch.png"] },
  { id: "sturgeon", icon: ["Icons", "Fish", "River", "Sturgeon.png"] },
  { id: "sunfish", icon: ["Icons", "Fish", "River", "Sunfish.png"] },
  { id: "redSnapper", icon: ["Icons", "Fish", "Sea", "Red Snapper.png"] },
  { id: "tuna", icon: ["Icons", "Fish", "Sea", "Tuna.png"] },
  { id: "clownfish", icon: ["Icons", "Fish", "Sea", "Clownfish.png"] },
  { id: "crab", icon: ["Icons", "Fish", "Sea", "Creatures", "Crab.png"] },
];

const animalCatalog = [
  { id: "chickenRed", path: ["Animals", "Farm", "Chicken", "Chicken Red.png"], frameWidth: 16, frameHeight: 16 },
  { id: "duckWhite", path: ["Animals", "Farm", "Ducks", "Duck White.png"], frameWidth: 16, frameHeight: 16 },
  { id: "goatBrown", path: ["Animals", "Farm", "Goat", "Goat Female Brown.png"], frameWidth: 32, frameHeight: 32 },
  { id: "sheepWhite", path: ["Animals", "Farm", "Sheep", "Sheep Female.png"], frameWidth: 32, frameHeight: 32 },
  { id: "pigPink", path: ["Animals", "Farm", "Pig", "Pig Pink.png"], frameWidth: 32, frameHeight: 32 },
  { id: "ostrichBrown", path: ["Animals", "Farm", "Ostrich", "Ostrich Brown.png"], frameWidth: 32, frameHeight: 32 },
  { id: "rabbitBrown", path: ["Animals", "Forest", "Rabbit", "Rabbit Brown.png"], frameWidth: 16, frameHeight: 16 },
  { id: "redFox", path: ["Animals", "Forest", "Fox", "Red Fox.png"], frameWidth: 32, frameHeight: 32 },
  { id: "pelican", path: ["Animals", "Forest", "Beach", "Pelican.png"], frameWidth: 16, frameHeight: 16 },
  { id: "seagull", path: ["Animals", "Forest", "Beach", "seagull.png"], frameWidth: 16, frameHeight: 16 },
  { id: "cowBrown", path: ["Animals", "Farm", "Cow", "Common Cow", "Female Cow Brown.png"], frameWidth: 32, frameHeight: 32 },
  { id: "horseBrown", path: ["Animals", "Farm", "Horse", "1", "idle.png"], frameWidth: 32, frameHeight: 32 },
  { id: "deerDoe", path: ["Animals", "Forest", "Deer", "Female", "Idle.png"], frameWidth: 32, frameHeight: 32 },
  { id: "crow", path: ["Animals", "Forest", "Crow", "Crow.png"], frameWidth: 32, frameHeight: 32 },
  { id: "frogBlue", path: ["Animals", "Forest", "Frog", "Blue.png"], frameWidth: 32, frameHeight: 32 },
  { id: "blueDolphin", path: ["Animals", "Forest", "Beach", "Blue Dolphin.png"], frameWidth: 32, frameHeight: 32 },
  { id: "catGinger", path: ["Animals", "Pets", "Cats", "1", "Ginger.png"], frameWidth: 32, frameHeight: 32 },
  { id: "dogBrown", path: ["Animals", "Pets", "Dogs", "Premade", "1", "1.png"], frameWidth: 32, frameHeight: 32 },
];

const fruitTreeCatalog = [
  { id: "appleTree", product: "apple", path: ["Crops", "Fruits Tree", "Fall", "Apple Tree - no shadow.png"], frameWidth: 32, frameHeight: 48 },
  { id: "apricotTree", product: "apricot", path: ["Crops", "Fruits Tree", "Spring", "Apricot Tree - no shadow.png"], frameWidth: 32, frameHeight: 48 },
  { id: "cherryTree", product: "cherry", path: ["Crops", "Fruits Tree", "Spring", "Cherry Tree - no shadow.png"], frameWidth: 32, frameHeight: 48 },
  { id: "bananaTree", product: "banana", path: ["Crops", "Fruits Tree", "Summer", "Banana Tree - no Shadow.png"], frameWidth: 32, frameHeight: 48 },
  { id: "mangoTree", product: "mango", path: ["Crops", "Fruits Tree", "Summer", "Mango Tree - no shadow.png"], frameWidth: 32, frameHeight: 48 },
  { id: "orangeTree", product: "orange", path: ["Crops", "Fruits Tree", "Summer", "Orange Tree - no shadow.png"], frameWidth: 32, frameHeight: 48 },
  { id: "peachTree", product: "peach", path: ["Crops", "Fruits Tree", "Summer", "Peach Tree - no shadow.png"], frameWidth: 32, frameHeight: 48 },
  { id: "coconutTree", product: "coconut", path: ["Crops", "Fruits Tree", "Summer", "Coconut tree - no Shadow.png"], frameWidth: 32, frameHeight: 48 },
];

const enemyCatalog = [
  { id: "blueSlime", path: ["Enemy", "Slimes", "Blue", "Slime.png"], frameWidth: 32, frameHeight: 32 },
  { id: "sproutSlime", path: ["Enemy", "Sprout Slime", "Blue", "Idle.png"], frameWidth: 32, frameHeight: 32 },
  { id: "purpleMyconid", path: ["Enemy", "Myconid", "Purple", "Idle.png"], frameWidth: 32, frameHeight: 32 },
  { id: "spikePlant", path: ["Enemy", "Spike", "idle.png"], frameWidth: 32, frameHeight: 32 },
];

const tileFrames = {
  grass: 0,
  field: 1,
  road: 2,
  soil: 3,
  wet: 4,
  water: 5,
  floor: 6,
  wall: 7,
  counter: 8,
  roofRed: 9,
  wallHome: 10,
  roofGreen: 11,
  wallShop: 12,
  roofGray: 13,
  wallGray: 14,
  roofPurple: 15,
  wallPurple: 16,
  roofOchre: 17,
  wallCream: 18,
  door: 19,
  shipping: 20,
  sign: 21,
  shelf: 22,
  rug: 23,
  lantern: 24,
  board: 25,
  fence: 26,
  flowerRed: 27,
  flowerBlue: 28,
  treeTop: 29,
  treeTrunk: 30,
  rock: 31,
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
  well: 53,
  scarecrow: 54,
  beehive: 55,
  cheesePress: 56,
  butterChurn: 57,
  beachBoat: 58,
  beachFishPoint: 59,
  deepForestAltar: 60,
  mineLamp: 61,
  bonfire: 62,
  coconutTree: 63,
  jamMaker: 64,
};

function tileCount() {
  return Object.keys(tileFrames).length;
}
const tilesetColumns = 8;

const characterFrames = {
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
};

const cropFrames = Object.fromEntries(
  cropCatalog.flatMap((crop, cropIndex) => [0, 1, 2, 3].map((stage) => [`${crop.id}${stage}`, cropIndex * 4 + stage])),
);

const iconFrameNames = [
  "hoe",
  "seedBag",
  "wateringCan",
  "harvestBasket",
  ...cropCatalog.map((crop) => crop.id),
  "coin",
  "sun",
  "rain",
  "mist",
  "energy",
  "order",
  "heart",
  "soundOn",
  "soundOff",
  "berry",
  "mushroom",
  "wildFlower",
  "fishingRod",
  ...fishCatalog.map((fish) => fish.id),
  ...productCatalog.map((product) => product.id),
];

const iconFrames = Object.fromEntries(iconFrameNames.map((name, index) => [name, index]));
const animalFrames = Object.fromEntries(animalCatalog.map((animal, index) => [animal.id, index]));
const fruitTreeFrames = Object.fromEntries(fruitTreeCatalog.map((tree, index) => [tree.id, index]));
const enemyFrames = Object.fromEntries(enemyCatalog.map((enemy, index) => [enemy.id, index]));

function rect(x, y, width, height, fill, opacity = 1) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" fill-opacity="${opacity}"/>`;
}

function circle(cx, cy, r, fill, opacity = 1) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${opacity}"/>`;
}

function ellipse(cx, cy, rx, ry, fill, opacity = 1) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" fill-opacity="${opacity}"/>`;
}

function svg(parts) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}" shape-rendering="crispEdges">${parts.join("")}</svg>`,
  );
}

function tile(base, accent, extras = []) {
  return svg([
    rect(0, 0, TILE, TILE, base),
    rect(0, 0, TILE, 1, "#ffffff", 0.14),
    rect(0, 0, 1, TILE, "#ffffff", 0.14),
    rect(TILE - 1, 0, 1, TILE, "#111827", 0.12),
    rect(0, TILE - 1, TILE, 1, "#111827", 0.12),
    rect(5, 6, 2, 2, accent, 0.28),
    rect(17, 7, 2, 2, accent, 0.24),
    rect(11, 20, 2, 2, accent, 0.2),
    rect(25, 24, 2, 2, accent, 0.18),
    ...extras,
  ]);
}

function tileSprites() {
  return [
    tile("#6fb45f", "#3f8a3c", [rect(8, 25, 2, 4, "#347a35", 0.34), rect(22, 16, 2, 4, "#347a35", 0.28), rect(26, 8, 2, 2, "#f8d96a", 0.65)]),
    tile("#b0a35a", "#7b753a", [rect(0, 0, TILE, TILE, "#e5cf77", 0.14), rect(5, 14, 22, 2, "#8f7f42", 0.18)]),
    tile("#d2ac78", "#a1764f", [rect(0, 14, TILE, 3, "#e5c696", 0.3), rect(0, 24, TILE, 2, "#b58a62", 0.16)]),
    tile("#9b6037", "#5f3a24", [rect(0, 10, TILE, 2, "#b67445", 0.34), rect(0, 22, TILE, 2, "#5f3a24", 0.28)]),
    tile("#64482f", "#30251f", [rect(0, 10, TILE, 2, "#3c3028", 0.36), rect(4, 4, 8, 4, "#7a6048", 0.28)]),
    tile("#3f9fc5", "#1f789e", [rect(0, 9, TILE, 2, "#9dd8ef", 0.26), rect(6, 20, 16, 2, "#9dd8ef", 0.2)]),
    tile("#dfbd7c", "#b99057", [rect(0, 0, TILE, TILE, "#f4dba3", 0.18)]),
    tile("#875737", "#5c3a25", [rect(0, 0, TILE, 6, "#a06b43", 0.42)]),
    tile("#a66c3d", "#70462d", [rect(0, 8, TILE, 4, "#c08652", 0.55)]),
    tile("#b6513a", "#7f2d22", [rect(0, 0, TILE, 8, "#d66a4f", 0.55)]),
    tile("#f5d59a", "#dbb76f", [rect(0, 0, TILE, TILE, "#fff1c2", 0.2)]),
    tile("#2f855a", "#1f5f3f", [rect(0, 0, TILE, 8, "#4db57c", 0.45)]),
    tile("#f1c96a", "#c8952f", [rect(0, 0, TILE, TILE, "#ffe39a", 0.22)]),
    tile("#64748b", "#475569", [rect(0, 0, TILE, 8, "#94a3b8", 0.35)]),
    tile("#e2e8f0", "#94a3b8", [rect(0, 0, TILE, TILE, "#f8fafc", 0.22)]),
    tile("#9f7aea", "#6d4bbd", [rect(0, 0, TILE, 8, "#c4b5fd", 0.35)]),
    tile("#f3e8ff", "#c4b5fd", [rect(0, 0, TILE, TILE, "#faf5ff", 0.3)]),
    tile("#a16207", "#713f12", [rect(0, 0, TILE, 8, "#ca8a04", 0.45)]),
    tile("#fef3c7", "#d6a35d", [rect(0, 0, TILE, TILE, "#fffbeb", 0.24)]),
    svg([ellipse(16, 29, 18, 5, "#111827", 0.12), rect(8, 4, 16, 24, "#6b3f26"), rect(10, 6, 12, 20, "#7c4a2d"), circle(21, 17, 2, "#fcd34d")]),
    svg([rect(5, 9, 22, 17, "#7c4a2d"), rect(8, 6, 16, 6, "#d6a35d"), rect(9, 15, 14, 3, "#3f2a1d"), rect(6, 24, 20, 2, "#3f2a1d", 0.4)]),
    svg([rect(14, 10, 4, 18, "#70462d"), rect(5, 4, 22, 12, "#e7c482"), rect(7, 6, 18, 2, "#fef3c7", 0.45)]),
    svg([rect(5, 4, 22, 24, "#8b5a35"), rect(7, 7, 18, 2, "#70462d"), rect(8, 11, 5, 5, "#facc15"), rect(16, 11, 5, 5, "#22c55e"), rect(9, 21, 11, 5, "#f97316")]),
    tile("#8b3a33", "#5f2420", [rect(4, 8, 24, 16, "#a94b43", 0.7)]),
    svg([rect(12, 6, 8, 18, "#7c2d12"), rect(9, 8, 14, 6, "#f59e0b"), rect(11, 14, 10, 10, "#fb923c"), rect(13, 18, 6, 4, "#fde68a")]),
    svg([
      rect(13, 6, 3, 23, "#5c3c28"),
      rect(4, 4, 24, 17, "#7c4a2d"),
      rect(6, 6, 20, 13, "#f3d28b"),
      rect(8, 9, 16, 2, "#7c2d12"),
      rect(8, 13, 10, 2, "#166534"),
      rect(20, 13, 3, 3, "#dc2626"),
      rect(6, 20, 20, 2, "#3f2a1d", 0.35),
    ]),
    svg([rect(0, 21, TILE, 4, "#70421f"), rect(5, 9, 5, 18, "#8b5a35"), rect(21, 9, 5, 18, "#8b5a35"), rect(4, 10, 24, 4, "#a16207"), rect(4, 24, 24, 3, "#5c3c28", 0.45)]),
    svg([ellipse(16, 28, 14, 4, "#111827", 0.12), rect(15, 15, 3, 11, "#3f7a38"), circle(12, 14, 4, "#ef4444"), circle(18, 11, 4, "#f87171"), circle(21, 16, 3, "#dc2626")]),
    svg([ellipse(16, 28, 14, 4, "#111827", 0.12), rect(15, 15, 3, 11, "#3f7a38"), circle(12, 14, 4, "#60a5fa"), circle(18, 11, 4, "#93c5fd"), circle(21, 16, 3, "#2563eb")]),
    svg([ellipse(16, 29, 18, 4, "#111827", 0.14), circle(11, 14, 8, "#2f855a"), circle(20, 13, 9, "#276749"), circle(16, 8, 9, "#3f9c5d"), rect(9, 18, 15, 5, "#1f6b3d")]),
    svg([ellipse(16, 28, 13, 4, "#111827", 0.16), rect(12, 8, 8, 20, "#7c4a2d"), rect(10, 20, 12, 8, "#5c331b"), rect(16, 9, 3, 15, "#9a5f2d", 0.55)]),
    svg([ellipse(16, 27, 15, 5, "#111827", 0.14), rect(8, 15, 17, 10, "#64748b"), rect(11, 11, 13, 8, "#94a3b8"), rect(14, 13, 5, 3, "#cbd5e1", 0.6), rect(7, 23, 18, 3, "#334155", 0.25)]),
    svg([
      ellipse(16, 28, 14, 4, "#111827", 0.14),
      rect(14, 14, 4, 13, "#7c4a2d"),
      rect(7, 8, 18, 12, "#3b82f6"),
      rect(7, 14, 18, 7, "#1d4ed8"),
      rect(9, 10, 12, 3, "#bfdbfe", 0.76),
      rect(24, 11, 3, 9, "#facc15"),
      rect(5, 19, 22, 3, "#0f172a", 0.22),
    ]),
    svg([
      rect(3, 12, 26, 14, "#8b5a35"),
      rect(5, 14, 22, 10, "#f8dfae"),
      rect(5, 14, 8, 8, "#bfdbfe"),
      rect(14, 15, 12, 7, "#fca5a5"),
      rect(3, 25, 26, 3, "#5c331b"),
      rect(5, 28, 4, 3, "#3f2614"),
      rect(23, 28, 4, 3, "#3f2614"),
    ]),
    svg([
      ellipse(16, 28, 14, 4, "#111827", 0.12),
      rect(7, 13, 18, 12, "#9a5f2d"),
      rect(5, 10, 22, 5, "#d19652"),
      rect(8, 25, 3, 5, "#5c331b"),
      rect(21, 25, 3, 5, "#5c331b"),
      rect(11, 12, 10, 2, "#f8dfae", 0.35),
    ]),
    svg([
      rect(7, 7, 18, 20, "#5c3a25"),
      rect(9, 9, 14, 16, "#7c4a2d"),
      rect(11, 13, 10, 10, "#1f1308"),
      rect(13, 15, 3, 6, "#f97316"),
      rect(17, 14, 3, 8, "#facc15"),
      rect(6, 26, 20, 3, "#3f2614"),
    ]),
    svg([
      ellipse(16, 28, 13, 4, "#111827", 0.12),
      rect(8, 8, 16, 12, "#1f2937"),
      rect(10, 10, 12, 8, "#93c5fd"),
      rect(14, 20, 4, 5, "#475569"),
      rect(10, 25, 12, 3, "#334155"),
      rect(21, 6, 2, 4, "#facc15"),
    ]),
  ];
}

function characterSprite(kind) {
  const isPlayer = kind.startsWith("player");
  const direction = kind.includes("Up")
    ? "up"
    : kind.includes("Left")
      ? "left"
      : kind.includes("Right")
        ? "right"
        : "down";
  const step = kind.endsWith("StepLeft") ? 1 : kind.endsWith("StepRight") ? 2 : 0;
  const skin = kind === "liang" ? "#e8b58c" : kind === "auntChen" ? "#c98f68" : "#f0b98b";
  const shirt =
    isPlayer
      ? "#2563eb"
      : kind === "shopkeeper"
        ? "#14532d"
        : kind === "liang"
          ? "#d97706"
          : kind === "auntChen"
            ? "#7c3aed"
            : "#475569";
  const hat = kind === "shopkeeper" ? "#334155" : kind === "auntChen" ? "#7c2d12" : "#7c2d12";
  const faceDown = direction !== "up";
  const leftLegY = step === 1 ? 27 : 29;
  const rightLegY = step === 2 ? 27 : 29;
  const leftArmY = step === 1 ? 18 : 20;
  const rightArmY = step === 2 ? 18 : 20;
  const sideShade = direction === "left" || direction === "right" ? "#1e3a8a" : shirt;

  return svg([
    ellipse(16, 29, 20, 5, "#111827", 0.22),
    circle(16, 11, 7, skin),
    rect(9, 17, 14, 13, shirt),
    rect(direction === "right" ? 8 : 7, leftArmY, 5, 8, sideShade),
    rect(direction === "left" ? 19 : 20, rightArmY, 5, 8, sideShade),
    rect(11, leftLegY, 4, 5, "#1f2937"),
    rect(18, rightLegY, 4, 5, "#1f2937"),
    rect(8, 6, 16, 5, hat),
    kind === "shopkeeper" ? rect(6, 5, 20, 3, "#facc15") : "",
    kind === "auntChen" ? rect(5, 5, 22, 3, "#fde68a") : "",
    faceDown && direction !== "right" ? circle(13, 11, 1.4, "#111827") : "",
    faceDown && direction !== "left" ? circle(19, 11, 1.4, "#111827") : "",
    faceDown && direction === "left" ? circle(12, 11, 1.4, "#111827") : "",
    faceDown && direction === "right" ? circle(20, 11, 1.4, "#111827") : "",
    !faceDown ? rect(10, 9, 12, 5, hat) : "",
    step > 0 ? rect(11, 16, 10, 2, "#ffffff", 0.12) : "",
  ]);
}

function cropSprite(crop, stage) {
  const colors = {
    turnip: { leaf: "#4f8f56", body: "#f7f2ef", shade: "#d8b4c8" },
    wheat: { leaf: "#8fa23b", body: "#e7b44d", shade: "#b7791f" },
    potato: { leaf: "#5f8f44", body: "#b9824a", shade: "#7c4a2d" },
  }[crop];

  if (stage === 0) {
    return svg([rect(15, 20, 3, 6, colors.leaf), circle(13, 19, 3, colors.leaf), circle(19, 18, 3, colors.leaf)]);
  }

  if (stage === 1) {
    return svg([rect(15, 13, 3, 12, colors.leaf), circle(11, 16, 5, colors.leaf), circle(21, 15, 5, colors.leaf), rect(14, 24, 5, 3, colors.shade, 0.4)]);
  }

  if (stage === 2) {
    return svg([rect(15, 9, 3, 16, colors.leaf), circle(10, 13, 5, colors.leaf), circle(22, 13, 5, colors.leaf), circle(16, 9, 5, colors.leaf), rect(12, 23, 9, 4, colors.shade, 0.45)]);
  }

  if (crop === "wheat") {
    return svg([rect(12, 9, 3, 16, colors.body), rect(17, 8, 3, 17, colors.body), rect(10, 7, 7, 4, "#facc15"), rect(16, 6, 7, 4, "#facc15"), rect(14, 24, 6, 3, colors.leaf)]);
  }

  return svg([circle(16, 18, 8, colors.body), rect(13, 20, 7, 4, colors.shade, 0.34), circle(12, 10, 5, colors.leaf), circle(20, 10, 5, colors.leaf), rect(15, 9, 3, 9, colors.leaf)]);
}

function iconSprite(kind) {
  if (kind === "hoe") {
    return svg([
      rect(14, 5, 4, 23, "#7c4a2d"),
      rect(18, 5, 8, 4, "#9ca3af"),
      rect(20, 8, 4, 7, "#6b7280"),
      rect(12, 25, 8, 3, "#5c331b"),
    ]);
  }

  if (kind === "seedBag") {
    return svg([
      ellipse(16, 26, 13, 4, "#111827", 0.16),
      rect(9, 10, 14, 16, "#d6a35d"),
      rect(11, 7, 10, 5, "#f3d28b"),
      rect(9, 13, 14, 2, "#8b5a35"),
      circle(13, 19, 2, "#5f8f44"),
      circle(18, 20, 2, "#5f8f44"),
      circle(16, 24, 2, "#5f8f44"),
    ]);
  }

  if (kind === "wateringCan") {
    return svg([
      ellipse(16, 26, 14, 4, "#111827", 0.16),
      rect(8, 13, 15, 11, "#4ea5c7"),
      rect(11, 10, 9, 4, "#8fd3e8"),
      rect(22, 14, 6, 3, "#4ea5c7"),
      rect(26, 12, 3, 2, "#8fd3e8"),
      rect(6, 15, 3, 8, "#247aa0"),
      circle(5, 15, 2, "#247aa0"),
      rect(11, 23, 11, 2, "#247aa0", 0.45),
    ]);
  }

  if (kind === "harvestBasket") {
    return svg([
      ellipse(16, 27, 15, 4, "#111827", 0.16),
      rect(7, 15, 18, 10, "#9a5f2d"),
      rect(9, 17, 14, 2, "#d19652"),
      rect(9, 21, 14, 2, "#70421f"),
      rect(10, 11, 2, 6, "#70421f"),
      rect(20, 11, 2, 6, "#70421f"),
      rect(12, 9, 8, 2, "#70421f"),
      circle(12, 14, 3, "#eab308"),
      circle(17, 13, 3, "#ef4444"),
      circle(21, 15, 3, "#22c55e"),
    ]);
  }

  if (kind === "turnip") {
    return svg([
      ellipse(16, 27, 14, 4, "#111827", 0.14),
      circle(16, 17, 8, "#f7f2ef"),
      rect(12, 20, 8, 4, "#d8b4c8", 0.6),
      circle(12, 9, 4, "#4f8f56"),
      circle(19, 9, 4, "#4f8f56"),
      rect(15, 8, 3, 8, "#3f7a38"),
    ]);
  }

  if (kind === "wheat") {
    return svg([
      ellipse(16, 27, 14, 4, "#111827", 0.14),
      rect(11, 9, 3, 16, "#b7791f"),
      rect(17, 7, 3, 18, "#b7791f"),
      rect(8, 8, 8, 4, "#facc15"),
      rect(14, 6, 8, 4, "#facc15"),
      rect(14, 12, 9, 4, "#e7b44d"),
      rect(13, 24, 8, 3, "#5f8f44"),
    ]);
  }

  if (kind === "potato") {
    return svg([
      ellipse(16, 27, 14, 4, "#111827", 0.14),
      circle(16, 18, 8, "#b9824a"),
      rect(12, 20, 8, 4, "#7c4a2d", 0.34),
      circle(12, 10, 4, "#5f8f44"),
      circle(20, 10, 4, "#5f8f44"),
      rect(15, 9, 3, 9, "#4f7f3d"),
    ]);
  }

  if (kind === "coin") {
    return svg([
      ellipse(16, 27, 13, 4, "#111827", 0.16),
      circle(16, 16, 9, "#facc15"),
      circle(16, 16, 6, "#f59e0b"),
      rect(14, 9, 4, 14, "#fde68a"),
      rect(11, 13, 10, 3, "#92400e", 0.32),
      rect(20, 8, 3, 3, "#fff7ad", 0.75),
    ]);
  }

  if (kind === "sun") {
    return svg([
      rect(15, 3, 3, 6, "#facc15"),
      rect(15, 23, 3, 6, "#facc15"),
      rect(3, 15, 6, 3, "#facc15"),
      rect(23, 15, 6, 3, "#facc15"),
      rect(7, 7, 4, 4, "#fbbf24"),
      rect(21, 7, 4, 4, "#fbbf24"),
      rect(7, 21, 4, 4, "#fbbf24"),
      rect(21, 21, 4, 4, "#fbbf24"),
      circle(16, 16, 8, "#fde047"),
      rect(12, 12, 8, 2, "#fff7ad", 0.68),
    ]);
  }

  if (kind === "rain") {
    return svg([
      ellipse(16, 14, 10, 6, "#94a3b8"),
      circle(10, 14, 5, "#cbd5e1"),
      circle(17, 10, 6, "#cbd5e1"),
      circle(23, 15, 5, "#94a3b8"),
      rect(10, 22, 2, 6, "#38bdf8"),
      rect(16, 20, 2, 7, "#38bdf8"),
      rect(22, 23, 2, 5, "#38bdf8"),
    ]);
  }

  if (kind === "mist") {
    return svg([
      ellipse(16, 12, 10, 6, "#e2e8f0", 0.9),
      circle(10, 13, 5, "#f8fafc", 0.9),
      circle(22, 13, 5, "#cbd5e1", 0.9),
      rect(6, 20, 20, 3, "#f8fafc", 0.86),
      rect(10, 25, 16, 3, "#dbeafe", 0.78),
      rect(3, 16, 22, 2, "#f8fafc", 0.55),
    ]);
  }

  if (kind === "energy") {
    return svg([
      ellipse(16, 28, 12, 3, "#111827", 0.16),
      rect(15, 4, 7, 12, "#fde047"),
      rect(10, 14, 9, 4, "#facc15"),
      rect(11, 17, 7, 11, "#f59e0b"),
      rect(18, 10, 5, 5, "#fff7ad", 0.64),
      rect(12, 21, 4, 5, "#92400e", 0.26),
    ]);
  }

  if (kind === "order") {
    return svg([
      ellipse(16, 28, 13, 3, "#111827", 0.14),
      rect(8, 5, 17, 22, "#f3d28b"),
      rect(10, 7, 13, 2, "#fff1c2", 0.72),
      rect(11, 12, 10, 2, "#7c4a2d"),
      rect(11, 17, 8, 2, "#7c4a2d"),
      rect(11, 22, 6, 2, "#7c4a2d"),
      circle(22, 23, 4, "#dc2626"),
    ]);
  }

  if (kind === "soundOn") {
    return svg([
      ellipse(16, 27, 13, 4, "#111827", 0.14),
      rect(7, 13, 6, 8, "#f8dfae"),
      rect(13, 10, 7, 14, "#f59e0b"),
      rect(20, 12, 2, 10, "#92400e", 0.45),
      rect(23, 10, 2, 14, "#fde68a"),
      rect(27, 8, 2, 18, "#fde68a", 0.7),
    ]);
  }

  if (kind === "soundOff") {
    return svg([
      ellipse(16, 27, 13, 4, "#111827", 0.14),
      rect(7, 13, 6, 8, "#d1d5db"),
      rect(13, 10, 7, 14, "#9ca3af"),
      rect(22, 10, 3, 15, "#7c2d12"),
      rect(27, 9, 3, 17, "#7c2d12"),
      rect(21, 20, 10, 3, "#ef4444"),
      rect(25, 16, 3, 11, "#ef4444"),
    ]);
  }

  if (kind === "berry") {
    return svg([
      ellipse(16, 27, 13, 4, "#111827", 0.14),
      rect(15, 10, 3, 15, "#3f7a38"),
      rect(12, 13, 9, 2, "#4f8f56"),
      circle(11, 19, 4, "#dc2626"),
      circle(16, 17, 4, "#ef4444"),
      circle(21, 20, 4, "#b91c1c"),
      circle(13, 16, 1, "#fecaca"),
      circle(18, 14, 1, "#fecaca"),
    ]);
  }

  if (kind === "mushroom") {
    return svg([
      ellipse(16, 27, 13, 4, "#111827", 0.14),
      rect(13, 16, 7, 10, "#f5e6c8"),
      rect(11, 23, 11, 3, "#d6b98c"),
      ellipse(16, 15, 16, 10, "#b45309"),
      rect(5, 15, 22, 4, "#7c2d12"),
      rect(11, 10, 3, 3, "#fde68a"),
      rect(18, 9, 3, 3, "#fde68a"),
      rect(21, 14, 2, 2, "#fde68a"),
    ]);
  }

  if (kind === "wildFlower") {
    return svg([
      ellipse(16, 28, 13, 3, "#111827", 0.14),
      rect(15, 15, 3, 11, "#3f7a38"),
      rect(11, 20, 9, 2, "#4f8f56"),
      circle(16, 11, 4, "#facc15"),
      circle(12, 13, 4, "#60a5fa"),
      circle(20, 13, 4, "#93c5fd"),
      circle(16, 17, 4, "#2563eb"),
      circle(16, 14, 2, "#fef3c7"),
    ]);
  }

  if (kind === "fishingRod") {
    return svg([
      ellipse(16, 28, 13, 4, "#111827", 0.13),
      rect(7, 24, 5, 4, "#7c4a2d"),
      rect(11, 20, 3, 5, "#9a5f2d"),
      rect(14, 16, 3, 5, "#b7791f"),
      rect(17, 12, 3, 5, "#d19652"),
      rect(20, 8, 3, 5, "#f3d28b"),
      rect(23, 8, 1, 14, "#e5e7eb"),
      circle(24, 24, 2, "#38bdf8"),
    ]);
  }

  if (kind === "creekFish") {
    return svg([
      ellipse(16, 28, 13, 4, "#111827", 0.13),
      ellipse(15, 16, 11, 6, "#38bdf8"),
      rect(7, 13, 5, 6, "#0ea5e9"),
      rect(23, 13, 5, 6, "#60a5fa"),
      circle(12, 14, 1.5, "#0f172a"),
      rect(14, 20, 6, 2, "#bae6fd", 0.7),
    ]);
  }

  if (kind === "carp") {
    return svg([
      ellipse(16, 28, 13, 4, "#111827", 0.13),
      ellipse(16, 16, 12, 7, "#f59e0b"),
      rect(6, 13, 6, 7, "#d97706"),
      rect(24, 12, 5, 8, "#fbbf24"),
      circle(12, 14, 1.5, "#0f172a"),
      rect(14, 20, 8, 2, "#fde68a", 0.7),
    ]);
  }

  if (kind === "silverFish") {
    return svg([
      ellipse(16, 28, 13, 4, "#111827", 0.13),
      ellipse(16, 16, 12, 6, "#cbd5e1"),
      rect(6, 13, 6, 6, "#94a3b8"),
      rect(24, 13, 5, 6, "#e5e7eb"),
      circle(12, 14, 1.5, "#0f172a"),
      rect(14, 11, 8, 2, "#ffffff", 0.65),
    ]);
  }

  return svg([
    ellipse(16, 27, 14, 4, "#111827", 0.14),
    rect(15, 23, 3, 4, "#7c2d12"),
    rect(9, 11, 14, 10, "#ef4444"),
    rect(11, 9, 4, 4, "#f87171"),
    rect(17, 9, 4, 4, "#f87171"),
    rect(12, 21, 8, 3, "#991b1b", 0.45),
  ]);
}

async function makeSheet(file, frames, columns) {
  await makeSizedSheet(file, frames, columns, TILE, TILE);
}

async function makeSizedSheet(file, frames, columns, frameWidth, frameHeight) {
  const width = columns * frameWidth;
  const rows = Math.ceil(frames.length / columns);
  const height = rows * frameHeight;
  const base = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const composites = frames.map((input, index) => ({
    input,
    left: (index % columns) * frameWidth,
    top: Math.floor(index / columns) * frameHeight,
  }));

  await base.composite(composites).png().toFile(join(spriteDir, file));
}

function assetPath(...parts) {
  return join(farmRpgAssetDir, ...parts);
}

async function assetFrame(
  file,
  {
    left = 0,
    top = 0,
    width = SOURCE_TILE,
    height = SOURCE_TILE,
    targetWidth = TILE,
    targetHeight = TILE,
    flip = false,
  } = {},
) {
  let source = sharp(file).extract({ left, top, width, height });

  if (flip) {
    source = source.flop();
  }

  const input = await source
    .resize(targetWidth, targetHeight, {
      fit: "fill",
      kernel: "nearest",
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: TILE,
      height: TILE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input,
        left: Math.floor((TILE - targetWidth) / 2),
        top: Math.floor((TILE - targetHeight) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function canvasFrame(
  file,
  {
    left = 0,
    top = 0,
    width = SOURCE_TILE,
    height = SOURCE_TILE,
    canvasWidth = TILE,
    canvasHeight = TILE,
    targetWidth = canvasWidth,
    targetHeight = canvasHeight,
    flip = false,
  } = {},
) {
  let source = sharp(file).extract({ left, top, width, height });

  if (flip) {
    source = source.flop();
  }

  const input = await source
    .resize(targetWidth, targetHeight, {
      fit: "fill",
      kernel: "nearest",
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input,
        left: Math.floor((canvasWidth - targetWidth) / 2),
        top: Math.floor((canvasHeight - targetHeight) / 2),
      },
    ])
    .png()
    .toBuffer();
}

function tileAsset(file, col, row) {
  return assetFrame(file, {
    left: col * SOURCE_TILE,
    top: row * SOURCE_TILE,
    width: SOURCE_TILE,
    height: SOURCE_TILE,
  });
}

function addTileFrame(frames, name, frame) {
  tileFrames[name] = frames.length;
  frames.push(frame);
}

function addChunkFrames(frames, prefix, file, { col = 0, row = 0, width, height }) {
  for (let chunkY = 0; chunkY < height; chunkY += 1) {
    for (let chunkX = 0; chunkX < width; chunkX += 1) {
      addTileFrame(
        frames,
        `${prefix}_${chunkX}_${chunkY}`,
        assetFrame(file, {
          left: (col + chunkX) * SOURCE_TILE,
          top: (row + chunkY) * SOURCE_TILE,
          width: SOURCE_TILE,
          height: SOURCE_TILE,
        }),
      );
    }
  }
}

function characterAsset(file, col, row, flip = false) {
  return assetFrame(file, {
    left: col * CHARACTER_TILE,
    top: row * CHARACTER_TILE,
    width: CHARACTER_TILE,
    height: CHARACTER_TILE,
    targetWidth: CHARACTER_TILE,
    targetHeight: CHARACTER_TILE,
    flip,
  });
}

function smallIcon(file, col = 0, row = 0) {
  return assetFrame(file, {
    left: col * SOURCE_TILE,
    top: row * SOURCE_TILE,
    width: SOURCE_TILE,
    height: SOURCE_TILE,
    targetWidth: 28,
    targetHeight: 28,
  });
}

function wideIcon(file, col = 0, row = 0) {
  return assetFrame(file, {
    left: col * TILE,
    top: row * SOURCE_TILE,
    width: TILE,
    height: SOURCE_TILE,
    targetWidth: TILE,
    targetHeight: SOURCE_TILE,
  });
}

function cropStageAsset(file, frame) {
  return assetFrame(file, {
    left: frame * SOURCE_TILE,
    top: 0,
    width: SOURCE_TILE,
    height: SOURCE_TILE,
  });
}

async function cropStageFrames(file) {
  const metadata = await sharp(file).metadata();
  const frameCount = Math.max(1, Math.floor((metadata.width ?? SOURCE_TILE) / SOURCE_TILE));
  const matureFrame = frameCount >= 10 ? 8 : Math.min(7, frameCount - 1);
  const stageFrames = [1, 3, 5, matureFrame].map((frame) => Math.max(0, Math.min(frame, frameCount - 1)));

  return Promise.all(stageFrames.map((frame) => cropStageAsset(file, frame)));
}

function animalAsset(file, { frameWidth, frameHeight, col = 0, row = 0 }) {
  return assetFrame(file, {
    left: col * frameWidth,
    top: row * frameHeight,
    width: frameWidth,
    height: frameHeight,
    targetWidth: TILE,
    targetHeight: TILE,
  });
}

function fruitTreeAsset(file, { frameWidth, frameHeight }) {
  return canvasFrame(file, {
    left: 0,
    top: 0,
    width: frameWidth,
    height: frameHeight,
    canvasWidth: 48,
    canvasHeight: 48,
    targetWidth: 32,
    targetHeight: 48,
  });
}

function enemyAsset(file, { frameWidth, frameHeight, col = 0, row = 0 }) {
  return assetFrame(file, {
    left: col * frameWidth,
    top: row * frameHeight,
    width: frameWidth,
    height: frameHeight,
    targetWidth: TILE,
    targetHeight: TILE,
  });
}

async function farmRpgTileSprites() {
  const grass = assetPath("Tileset", "Tileset Grass Spring.png");
  const tilledSoil = assetPath("Tileset", "Tilled Soil and wet soil.png");
  const water = assetPath("Tileset", "Water tile.png");
  const house = assetPath("Tileset", "Tileset House.png");
  const doors = assetPath("Objects", "Exterior", "Houses", "Door, windows, and chimney.png");
  const exterior = assetPath("Objects", "Exterior", "Exterior.png");
  const shippingBox = assetPath("Objects", "Exterior", "shipping box.png");
  const fence = assetPath("Objects", "Exterior", "Fence and Bridge", "Fence Wood.png");
  const tree = assetPath("Objects", "Tree", "Common", "No Shadow", "Maple Tree.png");
  const stones = assetPath("Objects", "Props", "Spring", "Stones.png");
  const mushrooms = assetPath("Objects", "Tree", "Deep Forest", "Fantasy Mushroom.png");
  const beds = assetPath("Objects", "Interior", "Beds.png");
  const tables = assetPath("Objects", "Interior", "Tables and desks.png");
  const fireplace = assetPath("Objects", "Interior", "Fireplace.png");
  const interior = assetPath("Objects", "Interior", "Others.png");
  const deepForest = assetPath("Tileset", "Tileset Grass Deep Forest.png");
  const beach = assetPath("Tileset", "Beach animations tiles.png");
  const caves = assetPath("Tileset", "Caves.png");
  const temple = assetPath("Tileset", "Tileset Temple.png");
  const barn = assetPath("Tileset", "Barn tileset.png");
  const cliff = assetPath("Tileset", "Tileset Grass Cliff Tileset Deep Forest.png");
  const beachBridge = assetPath("Tileset", "Bridge Beach Tileset.png");
  const dungeon = assetPath("Tileset", "Dungeon tileset.png");
  const beachExterior = assetPath("Objects", "Exterior", "Beach", "Exterior Beach.png");
  const templeInterior = assetPath("Objects", "Interior", "Temple.png");
  const barnBuilding = assetPath("Objects", "Exterior", "Houses", "Farm Buildings", "Barn", "Barn.png");
  const templeBuilding = assetPath("Objects", "Exterior", "Houses", "NPCS houses", "temple.png");
  const well = assetPath("Objects", "Exterior", "Well .png");
  const scarecrow = assetPath("Objects", "Exterior", "Scarescrow.png");
  const beehive = assetPath("Objects", "Work Benches", "Beehive.png");
  const cheesePress = assetPath("Objects", "Work Benches", "Cheese Press.png");
  const butterChurn = assetPath("Objects", "Work Benches", "Butter Churn.png");
  const jamMaker = assetPath("Objects", "Work Benches", "Jam Maker.png");
  const beachBoat = assetPath("Objects", "Exterior", "Beach", "Wood Boat.png");
  const beachFishPoint = assetPath("Objects", "Exterior", "Beach", "FishPoint.png");
  const deepForestAltar = assetPath("Objects", "Exterior", "Deep Forest", "Altar.png");
  const mineLamp = assetPath("Objects", "Exterior", "Mine and Dungeon", "Lamp .png");
  const bonfire = assetPath("Objects", "Exterior", "Mine and Dungeon", "bonfire.png");
  const coconutTree = assetPath("Objects", "Exterior", "Beach", "Coconut Tree.png");

  const frames = [
    tileAsset(grass, 9, 2),
    tileAsset(tilledSoil, 5, 2),
    tileAsset(grass, 3, 9),
    tileAsset(tilledSoil, 5, 2),
    tileAsset(tilledSoil, 5, 6),
    assetFrame(water),
    tileAsset(house, 13, 1),
    tileAsset(house, 1, 6),
    tileAsset(house, 13, 16),
    tileAsset(house, 0, 0),
    tileAsset(house, 1, 4),
    tileAsset(house, 34, 0),
    tileAsset(house, 34, 4),
    tileAsset(house, 5, 0),
    tileAsset(house, 5, 4),
    tileAsset(house, 15, 0),
    tileAsset(house, 15, 4),
    tileAsset(house, 23, 0),
    tileAsset(house, 23, 4),
    assetFrame(doors, { left: 0, top: 0, width: SOURCE_TILE, height: TILE, targetWidth: SOURCE_TILE, targetHeight: TILE }),
    assetFrame(shippingBox, { left: 0, top: TILE, width: SOURCE_TILE, height: SOURCE_TILE }),
    assetFrame(exterior, { left: 8 * SOURCE_TILE, top: 0, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    tileAsset(exterior, 0, 2),
    tileAsset(house, 20, 0),
    tileAsset(exterior, 0, 10),
    assetFrame(exterior, { left: 9 * SOURCE_TILE, top: 2 * SOURCE_TILE, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    tileAsset(fence, 1, 0),
    tileAsset(exterior, 0, 7),
    assetFrame(mushrooms, { left: 0, top: 6 * SOURCE_TILE, width: SOURCE_TILE, height: SOURCE_TILE }),
    assetFrame(tree, { left: 0, top: 3 * SOURCE_TILE, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(tree, { left: 0, top: 5 * SOURCE_TILE, width: TILE, height: SOURCE_TILE }),
    tileAsset(stones, 0, 0),
    tileAsset(exterior, 3, 10),
    assetFrame(beds, { left: 0, top: 0, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(tables, { left: 0, top: 11 * SOURCE_TILE, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(fireplace, { left: 0, top: 0, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(interior, { left: 4 * SOURCE_TILE, top: SOURCE_TILE, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    tileAsset(deepForest, 1, 1),
    tileAsset(beach, 13, 12),
    tileAsset(caves, 6, 2),
    tileAsset(caves, 1, 1),
    tileAsset(house, 14, 16),
    tileAsset(temple, 1, 1),
    tileAsset(house, 25, 16),
    tileAsset(barn, 1, 1),
    tileAsset(cliff, 1, 1),
    assetFrame(beachBridge, { left: 0, top: 4 * SOURCE_TILE, width: TILE, height: SOURCE_TILE, targetWidth: TILE, targetHeight: TILE }),
    tileAsset(dungeon, 6, 8),
    tileAsset(dungeon, 1, 1),
    tileAsset(barn, 1, 12),
    assetFrame(beachExterior, { left: 8 * SOURCE_TILE, top: 4 * SOURCE_TILE, width: SOURCE_TILE, height: SOURCE_TILE }),
    tileAsset(caves, 12, 2),
    assetFrame(templeInterior, { left: 2 * SOURCE_TILE, top: 2 * SOURCE_TILE, width: SOURCE_TILE, height: SOURCE_TILE }),
    assetFrame(well, { left: 0, top: 0, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(scarecrow, { left: 0, top: 0, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(beehive, { left: 0, top: 0, width: SOURCE_TILE, height: TILE, targetWidth: SOURCE_TILE, targetHeight: TILE }),
    assetFrame(cheesePress, { left: 0, top: 0, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(butterChurn, { left: 0, top: 0, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(beachBoat, { left: 0, top: 0, width: 176, height: 112, targetWidth: TILE, targetHeight: 20 }),
    assetFrame(beachFishPoint, { left: 0, top: 0, width: SOURCE_TILE, height: SOURCE_TILE, targetWidth: 28, targetHeight: 28 }),
    assetFrame(deepForestAltar, { left: 0, top: 0, width: 48, height: 48, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(mineLamp, { left: 0, top: 0, width: 12, height: SOURCE_TILE, targetWidth: 24, targetHeight: TILE }),
    assetFrame(bonfire, { left: 0, top: 0, width: SOURCE_TILE, height: TILE, targetWidth: SOURCE_TILE, targetHeight: TILE }),
    assetFrame(coconutTree, { left: 0, top: 0, width: 40, height: 48, targetWidth: 28, targetHeight: TILE }),
    assetFrame(jamMaker, { left: 0, top: 0, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
  ];

  addChunkFrames(frames, "barnFront", barnBuilding, { col: 0, row: 0, width: 5, height: 5 });
  addChunkFrames(frames, "templeFront", templeBuilding, { col: 0, row: 2, width: 8, height: 11 });

  return Promise.all(frames);
}

async function farmRpgCharacterSprites() {
  const player = assetPath("Character", "Character", "Pre-made", "Manu", "Walk.png");
  const shopkeeper = assetPath("Character", "Character", "Pre-made", "Lyria", "Walk.png");
  const liang = assetPath("Character", "Character", "Pre-made", "Josh", "Walk.png");
  const auntChen = assetPath("Character", "Character", "Pre-made", "Tori", "Walk.png");
  const elder = assetPath("Character", "Character", "Pre-made", "Alex", "Walk.png");

  return Promise.all([
    characterAsset(player, 0, 2),
    characterAsset(player, 1, 2),
    characterAsset(player, 2, 2),
    characterAsset(player, 0, 1),
    characterAsset(player, 1, 1),
    characterAsset(player, 2, 1),
    characterAsset(player, 0, 0, true),
    characterAsset(player, 1, 0, true),
    characterAsset(player, 2, 0, true),
    characterAsset(player, 0, 0),
    characterAsset(player, 1, 0),
    characterAsset(player, 2, 0),
    characterAsset(shopkeeper, 0, 2),
    characterAsset(liang, 0, 2),
    characterAsset(auntChen, 0, 2),
    characterAsset(elder, 0, 2),
  ]);
}

async function farmRpgCropSprites() {
  const cropFramesByCrop = await Promise.all(cropCatalog.map((crop) => cropStageFrames(assetPath(...crop.crop))));

  return cropFramesByCrop.flat();
}

async function farmRpgIconSprites() {
  const woodTools = assetPath("Icons", "RPG icons", "Weapons and Armor", "1. Wood");
  const foodIcons = assetPath("Icons", "Food Icons");
  const weather = assetPath("UI", "weather icons.png");
  const bars = assetPath("UI", "Bars.png");
  const money = assetPath("UI", "Money.png");
  const bags = assetPath("Icons", "RPG icons", "Extras", "Bags.png");
  const exterior = assetPath("Objects", "Exterior", "Exterior.png");
  const mushrooms = assetPath("Objects", "Tree", "Deep Forest", "Fantasy Mushroom.png");
  const music = assetPath("UI", "UI music.png");

  const frames = [
    smallIcon(join(woodTools, "Hoe.png"), 0, 0),
    smallIcon(bags, 0, 0),
    smallIcon(join(woodTools, "Watering can.png"), 0, 0),
    smallIcon(exterior, 0, 2),
    ...cropCatalog.map((crop) => wideIcon(join(foodIcons, crop.icon))),
    smallIcon(money, 0, 0),
    smallIcon(weather, 0, 0),
    smallIcon(weather, 2, 0),
    smallIcon(weather, 1, 1),
    smallIcon(bars, 0, 4),
    assetFrame(exterior, { left: 9 * SOURCE_TILE, top: 2 * SOURCE_TILE, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    smallIcon(bars, 0, 0),
    assetFrame(music, { left: 0, top: 0, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(music, { left: 2 * TILE, top: TILE, width: TILE, height: TILE, targetWidth: TILE, targetHeight: TILE }),
    assetFrame(exterior, { left: 0, top: 7 * SOURCE_TILE, width: SOURCE_TILE, height: SOURCE_TILE, targetWidth: 28, targetHeight: 28 }),
    assetFrame(mushrooms, { left: 0, top: 0, width: SOURCE_TILE, height: SOURCE_TILE, targetWidth: 28, targetHeight: 28 }),
    wideIcon(join(foodIcons, "Sunflower.png")),
    smallIcon(join(woodTools, "Fishing Rod.png"), 0, 0),
    ...fishCatalog.map((fish) => wideIcon(assetPath(...fish.icon))),
    ...productCatalog.map((product) => wideIcon(assetPath(...product.icon))),
  ];

  return Promise.all(frames);
}

async function farmRpgAnimalSprites() {
  return Promise.all(
    animalCatalog.map((animal) =>
      animalAsset(assetPath(...animal.path), {
        frameWidth: animal.frameWidth,
        frameHeight: animal.frameHeight,
      }),
    ),
  );
}

async function farmRpgFruitTreeSprites() {
  return Promise.all(
    fruitTreeCatalog.map((tree) =>
      fruitTreeAsset(assetPath(...tree.path), {
        frameWidth: tree.frameWidth,
        frameHeight: tree.frameHeight,
      }),
    ),
  );
}

async function farmRpgEnemySprites() {
  return Promise.all(
    enemyCatalog.map((enemy) =>
      enemyAsset(assetPath(...enemy.path), {
        frameWidth: enemy.frameWidth,
        frameHeight: enemy.frameHeight,
      }),
    ),
  );
}

async function makeUiAssets() {
  const dialogue = assetPath("UI", "dialogue box.png");
  const buttons = assetPath("UI", "button.png");
  const slots = assetPath("UI", "Inventory", "Slots.png");

  await sharp(dialogue).extract({ left: 0, top: 0, width: 48, height: 48 }).png().toFile(join(uiDir, "panel-light.png"));
  await sharp(slots).extract({ left: 0, top: 0, width: 48, height: 48 }).png().toFile(join(uiDir, "slot.png"));
  await sharp(buttons).extract({ left: 48, top: 0, width: 48, height: 48 }).png().toFile(join(uiDir, "button-amber.png"));
  await sharp(buttons).extract({ left: 0, top: 144, width: 48, height: 16 }).png().toFile(join(uiDir, "button-light.png"));
}

function gid(name) {
  return tileFrames[name] + 1;
}

function emptyLayer(fill = 0) {
  return Array.from({ length: COLS * ROWS }, () => fill);
}

function setTile(data, x, y, value) {
  data[y * COLS + x] = value;
}

function setRect(data, x, y, width, height, value) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      setTile(data, col, row, value);
    }
  }
}

function setChunk(data, prefix, x, y, width, height) {
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      setTile(data, x + col, y + row, gid(`${prefix}_${col}_${row}`));
    }
  }
}

function object(id, name, type, x, y, width = 1, height = 1, properties = {}) {
  return {
    id,
    name,
    type,
    x: x * TILE,
    y: y * TILE,
    width: width * TILE,
    height: height * TILE,
    properties: Object.entries(properties).map(([propName, value]) => ({
      name: propName,
      type: typeof value === "number" ? "int" : "string",
      value,
    })),
  };
}

function tileLayer(id, name, data) {
  return {
    id,
    name,
    type: "tilelayer",
    width: COLS,
    height: ROWS,
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    data,
  };
}

function objectLayer(id, name, objects) {
  return {
    id,
    name,
    type: "objectgroup",
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
    objects,
  };
}

function mapShell(layers) {
  return {
    compressionlevel: -1,
    infinite: false,
    tiledversion: "1.11.2",
    type: "map",
    version: "1.10",
    orientation: "orthogonal",
    renderorder: "right-down",
    width: COLS,
    height: ROWS,
    tilewidth: TILE,
    tileheight: TILE,
    nextlayerid: layers.length + 1,
    nextobjectid: 100,
    layers,
    tilesets: [
      {
        firstgid: 1,
        name: "farm-tiles",
        image: "../sprites/farm-tiles.png",
        imagewidth: 256,
        imageheight: Math.ceil(tileCount() / tilesetColumns) * TILE,
        tilewidth: TILE,
        tileheight: TILE,
        columns: tilesetColumns,
        tilecount: tileCount(),
      },
    ],
  };
}

function makeFarmMap() {
  const ground = emptyLayer(gid("grass"));
  setRect(ground, 20, 22, 3, 6, gid("road"));
  setRect(ground, 5, 23, 18, 2, gid("road"));
  setRect(ground, 5, 6, 2, 19, gid("road"));
  setRect(ground, 8, 20, 16, 2, gid("road"));
  setRect(ground, 9, 8, 14, 11, gid("field"));
  setRect(ground, 29, 16, 7, 6, gid("water"));
  setRect(ground, 23, 17, 7, 2, gid("road"));
  setRect(ground, 30, 8, 2, 12, gid("road"));
  setRect(ground, 23, 19, 9, 2, gid("road"));

  const decor = emptyLayer();
  setRect(decor, 3, 2, 7, 2, gid("roofRed"));
  setRect(decor, 3, 4, 7, 3, gid("wallHome"));
  setTile(decor, 5, 6, gid("door"));
  setTile(decor, 9, 5, gid("shipping"));
  setTile(decor, 10, 5, gid("mailbox"));
  setTile(decor, 21, 27, gid("sign"));
  setRect(decor, 9, 7, 14, 1, gid("fence"));
  setRect(decor, 8, 8, 1, 11, gid("fence"));
  setRect(decor, 23, 8, 1, 11, gid("fence"));
  setRect(decor, 10, 19, 5, 1, gid("fence"));
  setRect(decor, 18, 19, 5, 1, gid("fence"));
  setTile(decor, 12, 22, gid("flowerRed"));
  setTile(decor, 15, 22, gid("flowerBlue"));
  setTile(decor, 26, 21, gid("flowerRed"));
  setTile(decor, 32, 24, gid("flowerBlue"));
    setTile(decor, 25, 24, gid("rock"));
    setTile(decor, 35, 7, gid("flowerBlue"));
    setTile(decor, 37, 8, gid("flowerRed"));
    setTile(decor, 12, 4, gid("well"));
    setTile(decor, 16, 13, gid("scarecrow"));
    setTile(decor, 26, 23, gid("beehive"));
    setTile(decor, 35, 4, gid("treeTop"));
    setTile(decor, 35, 5, gid("treeTrunk"));
  setTile(decor, 38, 13, gid("treeTop"));
  setTile(decor, 38, 14, gid("treeTrunk"));
  setTile(decor, 2, 18, gid("treeTop"));
  setTile(decor, 2, 19, gid("treeTrunk"));
  setTile(decor, 4, 24, gid("treeTop"));
  setTile(decor, 4, 25, gid("treeTrunk"));
  setChunk(decor, "barnFront", 27, 3, 5, 5);
  setTile(decor, 33, 8, gid("hay"));
  setTile(decor, 34, 10, gid("crate"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "farm-plots", "plot-zone", 9, 8, 14, 11),
      object(2, "home", "collision", 3, 2, 7, 5),
      object(3, "pond", "collision", 29, 16, 7, 6),
      object(30, "north-tree", "collision", 35, 5, 1, 1),
      object(31, "east-tree", "collision", 38, 14, 1, 1),
      object(32, "west-tree", "collision", 2, 19, 1, 1),
      object(38, "south-tree", "collision", 4, 25, 1, 1),
      object(33, "field-rock", "collision", 25, 24, 1, 1),
      object(34, "field-fence-north", "collision", 9, 7, 14, 1),
      object(35, "field-fence-west", "collision", 8, 8, 1, 11),
      object(36, "field-fence-east", "collision", 23, 8, 1, 11),
      object(39, "field-fence-south-left", "collision", 10, 19, 5, 1),
      object(40, "field-fence-south-right", "collision", 18, 19, 5, 1),
      object(41, "barn-building", "collision", 27, 3, 5, 5),
      object(46, "well", "interaction", 12, 4, 1, 1, { action: "well", label: "古井" }),
      object(47, "scarecrow", "collision", 16, 13, 1, 1),
      object(48, "beehive", "interaction", 26, 23, 1, 1, { action: "beehive", label: "蜂箱" }),
      object(51, "apple-tree", "fruit-tree", 37, 5, 1, 1, {
        treeId: "appleTree",
        product: "apple",
        displayName: "苹果树",
      }),
      object(52, "apricot-tree", "fruit-tree", 37, 12, 1, 1, {
        treeId: "apricotTree",
        product: "apricot",
        displayName: "杏树",
      }),
      object(53, "cherry-tree", "fruit-tree", 6, 18, 1, 1, {
        treeId: "cherryTree",
        product: "cherry",
        displayName: "樱桃树",
      }),
      object(4, "shipping-bin", "interaction", 9, 5, 1, 1, { action: "ship", label: "售卖箱" }),
      object(5, "home-door", "transition", 5, 6, 1, 1, { targetPlace: "home", targetX: 21, targetY: 25, facing: "down" }),
      object(42, "barn-door", "transition", 29, 7, 2, 1, { targetPlace: "barn", targetX: 21, targetY: 25, facing: "up" }),
      object(37, "mailbox", "interaction", 10, 5, 1, 1, { action: "mailbox", label: "邮箱" }),
      object(43, "chicken-red", "animal", 33, 9, 1, 1, {
        animalId: "chickenRed",
        displayName: "红羽鸡",
        product: "chickenEgg",
        line: "它在谷仓门口啄着草籽，像是在催你开饭。",
      }),
      object(44, "duck-white", "animal", 31, 14, 1, 1, {
        animalId: "duckWhite",
        displayName: "白鸭",
        product: "duckEgg",
        line: "白鸭从池塘边摇回来，脚印湿漉漉的。",
      }),
      object(45, "goat-brown", "animal", 34, 12, 1, 1, {
        animalId: "goatBrown",
        displayName: "褐山羊",
        product: "goatMilk",
        line: "山羊顶了顶围栏，等着今天的一把干草。",
      }),
      object(49, "cow-brown", "animal", 32, 11, 1, 1, {
        animalId: "cowBrown",
        displayName: "褐奶牛",
        product: "cowMilk",
        line: "奶牛慢慢嚼着草，铃铛声压得很低。",
      }),
      object(50, "horse-brown", "animal", 36, 10, 1, 1, {
        animalId: "horseBrown",
        displayName: "栗色马",
        line: "栗色马把头探过栅栏，像是在辨认山路的方向。",
      }),
      object(54, "farm-dog", "animal", 7, 21, 1, 1, {
        animalId: "dogBrown",
        displayName: "山居犬",
        line: "山居犬沿着田埂嗅了一圈，把陌生脚步都记住了。",
      }),
      object(6, "town-road", "transition", 20, 27, 3, 1, { targetPlace: "town", targetX: 21, targetY: 1, facing: "down" }),
      object(7, "aunt-chen", "npc", 12, 22, 1, 1, {
        npcId: "auntChen",
        displayName: "陈婶",
        route: "12,22;15,22;15,21;12,21",
        dialog: "早啊，地要慢慢养，别急着把钱都花完。",
        rainDialog: "下雨天省水，适合多种一垄。",
      }),
    ]),
  ]);
}

function makeHomeMap() {
  const ground = emptyLayer(gid("floor"));
  setRect(ground, 0, 0, COLS, 1, gid("wall"));
  setRect(ground, 0, ROWS - 1, COLS, 1, gid("wall"));
  setRect(ground, 0, 0, 1, ROWS, gid("wall"));
  setRect(ground, COLS - 1, 0, 1, ROWS, gid("wall"));
  setRect(ground, 17, 18, 9, 4, gid("rug"));

  const decor = emptyLayer();
  setTile(decor, 7, 7, gid("bed"));
  setTile(decor, 21, 14, gid("table"));
  setTile(decor, 31, 7, gid("fireplace"));
  setTile(decor, 12, 7, gid("tv"));
  setTile(decor, 21, 26, gid("door"));
  setTile(decor, 6, 16, gid("shelf"));
  setTile(decor, 34, 16, gid("shelf"));
  setTile(decor, 10, 23, gid("flowerBlue"));
  setTile(decor, 31, 23, gid("flowerRed"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "wall-top", "collision", 0, 0, COLS, 1),
      object(2, "wall-bottom", "collision", 0, ROWS - 1, COLS, 1),
      object(3, "wall-left", "collision", 0, 0, 1, ROWS),
      object(4, "wall-right", "collision", COLS - 1, 0, 1, ROWS),
      object(5, "bed", "interaction", 7, 7, 1, 1, { action: "sleep", label: "睡觉" }),
      object(6, "tv", "interaction", 12, 7, 1, 1, { action: "forecast", label: "天气预报" }),
      object(7, "fireplace", "collision", 31, 7, 1, 1),
      object(8, "table", "collision", 21, 14, 1, 1),
      object(9, "left-shelf", "collision", 6, 16, 1, 1),
      object(10, "right-shelf", "collision", 34, 16, 1, 1),
      object(11, "home-exit", "transition", 21, 26, 1, 1, { targetPlace: "farm", targetX: 5, targetY: 7, facing: "down" }),
      object(12, "home-cat", "animal", 15, 15, 1, 1, {
        animalId: "catGinger",
        displayName: "橘猫",
        line: "橘猫在桌边绕了一圈，像是确认这间小屋终于有人住了。",
      }),
    ]),
  ]);
}

function makeTownMap() {
  const ground = emptyLayer(gid("grass"));
  setRect(ground, 20, 0, 3, ROWS, gid("road"));
  setRect(ground, 0, 14, 4, 3, gid("road"));
  setRect(ground, 4, 14, 34, 3, gid("road"));
  setRect(ground, 38, 14, 4, 3, gid("road"));

  const decor = emptyLayer();
  setRect(decor, 16, 6, 10, 2, gid("roofGreen"));
  setRect(decor, 16, 8, 10, 5, gid("wallShop"));
  setTile(decor, 20, 12, gid("door"));
  setRect(decor, 4, 7, 7, 2, gid("roofGray"));
  setRect(decor, 4, 9, 7, 4, gid("wallGray"));
  setChunk(decor, "templeFront", 30, 2, 8, 11);
  setRect(decor, 7, 18, 8, 2, gid("roofOchre"));
  setRect(decor, 7, 20, 8, 4, gid("wallCream"));
  setTile(decor, 21, 0, gid("sign"));
  setTile(decor, 12, 15, gid("lantern"));
  setTile(decor, 30, 15, gid("lantern"));
  setTile(decor, 24, 17, gid("board"));
  setRect(decor, 12, 17, 6, 1, gid("fence"));
  setRect(decor, 27, 17, 6, 1, gid("fence"));
  setTile(decor, 13, 19, gid("flowerRed"));
  setTile(decor, 16, 19, gid("flowerBlue"));
  setTile(decor, 28, 19, gid("flowerRed"));
  setTile(decor, 31, 19, gid("flowerBlue"));
  setTile(decor, 38, 3, gid("treeTop"));
  setTile(decor, 38, 4, gid("treeTrunk"));
  setTile(decor, 3, 20, gid("treeTop"));
  setTile(decor, 3, 21, gid("treeTrunk"));
  setTile(decor, 36, 23, gid("rock"));
  setTile(decor, 5, 25, gid("rock"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "seed-shop-door", "transition", 20, 12, 1, 1, { targetPlace: "shop", targetX: 21, targetY: 25, facing: "up" }),
      object(2, "farm-road", "transition", 20, 0, 3, 1, { targetPlace: "farm", targetX: 21, targetY: 26, facing: "up" }),
      object(15, "beach-road", "transition", 0, 14, 1, 3, { targetPlace: "beach", targetX: 21, targetY: 1, facing: "down" }),
      object(16, "forest-road", "transition", 41, 14, 1, 3, { targetPlace: "deepForest", targetX: 1, targetY: 15, facing: "right" }),
      object(17, "temple-door", "transition", 33, 12, 2, 1, { targetPlace: "temple", targetX: 21, targetY: 25, facing: "up" }),
      object(3, "seed-shop", "collision", 16, 6, 10, 7),
      object(4, "blacksmith", "closed-building", 4, 7, 7, 6, { message: "铁匠铺还在装修，之后再开放。" }),
      object(5, "temple-building", "collision", 30, 2, 8, 11),
      object(6, "home", "closed-building", 7, 18, 8, 6, { message: "居民房今天没有人应门。" }),
      object(7, "liang", "npc", 25, 16, 1, 1, {
        npcId: "liang",
        displayName: "阿良",
        route: "25,16;28,16;28,15;25,15",
        dialog: "种子铺今天有萝卜、小麦和土豆，先从便宜的种起吧。",
        rainDialog: "雨天路滑，不过田里会高兴。",
      }),
      object(8, "elder", "npc", 12, 15, 1, 1, {
        npcId: "elder",
        displayName: "老周",
        route: "12,15;14,15;14,16;12,16",
        dialog: "镇上其他铺子慢慢会开，先把农场盘活。",
        mistDialog: "起雾的时候，小镇看起来像旧照片。",
      }),
      object(9, "order-board", "interaction", 24, 17, 1, 1, { action: "order-board", label: "公告板" }),
      object(10, "order-board-block", "collision", 24, 17, 1, 1),
      object(11, "town-east-tree", "collision", 38, 4, 1, 1),
      object(12, "town-west-tree", "collision", 3, 21, 1, 1),
      object(13, "town-east-rock", "collision", 36, 23, 1, 1),
      object(14, "town-west-rock", "collision", 5, 25, 1, 1),
      object(18, "town-banana-tree", "fruit-tree", 2, 23, 1, 1, {
        treeId: "bananaTree",
        product: "banana",
        displayName: "香蕉树",
      }),
      object(19, "town-mango-tree", "fruit-tree", 36, 21, 1, 1, {
        treeId: "mangoTree",
        product: "mango",
        displayName: "芒果树",
      }),
      object(20, "town-orange-tree", "fruit-tree", 33, 24, 1, 1, {
        treeId: "orangeTree",
        product: "orange",
        displayName: "橙树",
      }),
      object(21, "town-peach-tree", "fruit-tree", 8, 21, 1, 1, {
        treeId: "peachTree",
        product: "peach",
        displayName: "桃树",
      }),
    ]),
  ]);
}

function makeShopMap() {
  const ground = emptyLayer(gid("floor"));
  setRect(ground, 0, 0, COLS, 1, gid("wall"));
  setRect(ground, 0, ROWS - 1, COLS, 1, gid("wall"));
  setRect(ground, 0, 0, 1, ROWS, gid("wall"));
  setRect(ground, COLS - 1, 0, 1, ROWS, gid("wall"));
  setRect(ground, 15, 10, 12, 1, gid("counter"));
  setRect(ground, 18, 19, 7, 3, gid("rug"));

  const decor = emptyLayer();
  for (const [x, y] of [
    [6, 5],
    [7, 5],
    [8, 5],
    [33, 5],
    [34, 5],
    [35, 5],
    [6, 6],
    [7, 6],
    [8, 6],
    [33, 6],
    [34, 6],
    [35, 6],
  ]) {
    setTile(decor, x, y, gid("shelf"));
  }
  setTile(decor, 21, 26, gid("door"));
  setTile(decor, 15, 4, gid("lantern"));
  setTile(decor, 27, 4, gid("lantern"));
  setTile(decor, 13, 6, gid("flowerRed"));
  setTile(decor, 29, 6, gid("flowerBlue"));
  setTile(decor, 11, 17, gid("rock"));
  setTile(decor, 31, 17, gid("rock"));
  setRect(decor, 12, 23, 5, 1, gid("fence"));
  setRect(decor, 26, 23, 5, 1, gid("fence"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "wall-top", "collision", 0, 0, COLS, 1),
      object(2, "wall-bottom", "collision", 0, ROWS - 1, COLS, 1),
      object(3, "wall-left", "collision", 0, 0, 1, ROWS),
      object(4, "wall-right", "collision", COLS - 1, 0, 1, ROWS),
      object(5, "counter", "counter", 15, 10, 12, 1, { message: "老板说：右侧货架也能直接买种子。" }),
      object(6, "left-shelf", "collision", 6, 5, 3, 2),
      object(7, "right-shelf", "collision", 33, 5, 3, 2),
      object(10, "seed-sack-left", "collision", 11, 17, 1, 1),
      object(11, "seed-sack-right", "collision", 31, 17, 1, 1),
      object(8, "shop-exit", "transition", 21, 26, 1, 1, { targetPlace: "town", targetX: 20, targetY: 13, facing: "down" }),
      object(9, "shopkeeper", "npc", 21, 9, 1, 1, {
        npcId: "shopkeeper",
        displayName: "青禾",
        route: "21,9",
        dialog: "欢迎，今天的种子都在右边。攒够钱就试试土豆。",
        rainDialog: "雨天来买种子的人最多，大家都想省一壶水。",
      }),
    ]),
  ]);
}

function makeDeepForestMap() {
  const ground = emptyLayer(gid("deepForestGrass"));
  setRect(ground, 0, 14, 10, 3, gid("road"));
  setRect(ground, 8, 12, 20, 3, gid("road"));
  setRect(ground, 27, 10, 10, 3, gid("road"));
  setRect(ground, 18, 16, 3, 8, gid("road"));
  setRect(ground, 11, 22, 13, 2, gid("road"));
  setRect(ground, 4, 3, 6, 4, gid("water"));

  const decor = emptyLayer();
  for (const [x, y] of [
    [2, 3],
    [6, 9],
    [10, 5],
    [15, 8],
    [24, 4],
    [30, 5],
    [38, 7],
    [5, 20],
    [10, 24],
    [26, 22],
    [34, 19],
    [39, 23],
  ]) {
    setTile(decor, x, y, gid("treeTop"));
    setTile(decor, x, y + 1, gid("treeTrunk"));
  }
  for (const [x, y] of [
    [7, 18],
    [13, 17],
    [27, 15],
    [33, 14],
    [21, 6],
    [36, 22],
  ]) {
    setTile(decor, x, y, gid("flowerBlue"));
  }
  for (const [x, y] of [
    [14, 21],
    [25, 9],
    [31, 18],
    [39, 12],
  ]) {
    setTile(decor, x, y, gid("rock"));
  }
  setRect(decor, 34, 7, 5, 2, gid("caveWall"));
  setRect(decor, 34, 9, 5, 4, gid("cliff"));
  setTile(decor, 36, 12, gid("caveFloor"));
  setTile(decor, 37, 12, gid("mineCrystal"));
  setTile(decor, 19, 20, gid("deepForestAltar"));
  setTile(decor, 23, 21, gid("bonfire"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "forest-top", "collision", 0, 0, COLS, 1),
      object(2, "forest-bottom", "collision", 0, ROWS - 1, COLS, 1),
      object(3, "forest-left", "collision", 0, 0, 1, ROWS),
      object(4, "forest-right", "collision", COLS - 1, 0, 1, ROWS),
      object(5, "forest-pond", "collision", 4, 3, 6, 4),
      object(6, "cave-mouth", "collision", 34, 7, 5, 6),
      object(7, "town-path", "transition", 0, 14, 1, 3, { targetPlace: "town", targetX: 40, targetY: 15, facing: "left" }),
      object(8, "cave-path", "transition", 36, 12, 1, 1, { targetPlace: "cave", targetX: 21, targetY: 25, facing: "up" }),
      object(9, "forest-tree-1", "collision", 2, 4, 1, 1),
      object(10, "forest-tree-2", "collision", 6, 10, 1, 1),
      object(11, "forest-tree-3", "collision", 10, 6, 1, 1),
      object(12, "forest-tree-4", "collision", 15, 9, 1, 1),
      object(13, "forest-tree-5", "collision", 24, 5, 1, 1),
      object(14, "forest-tree-6", "collision", 30, 6, 1, 1),
      object(15, "forest-tree-7", "collision", 38, 8, 1, 1),
      object(16, "forest-tree-8", "collision", 5, 21, 1, 1),
      object(17, "forest-rock-1", "collision", 14, 21, 1, 1),
      object(18, "forest-rock-2", "collision", 31, 18, 1, 1),
      object(21, "forest-altar", "interaction", 19, 20, 1, 1, { action: "altar", label: "林中祭坛" }),
      object(22, "forest-bonfire", "interaction", 23, 21, 1, 1, { action: "bonfire", label: "营火" }),
      object(19, "forest-rabbit", "animal", 13, 16, 1, 1, {
        animalId: "rabbitBrown",
        displayName: "林兔",
        line: "林兔竖起耳朵，停了一下又钻回草丛。",
      }),
      object(20, "forest-fox", "animal", 28, 14, 1, 1, {
        animalId: "redFox",
        displayName: "赤狐",
        line: "赤狐绕着蘑菇走了一圈，像是在巡视这片深林。",
      }),
      object(23, "forest-deer", "animal", 16, 20, 1, 1, {
        animalId: "deerDoe",
        displayName: "林鹿",
        line: "林鹿在古树阴影里停步，鼻尖带着潮湿的草气。",
      }),
      object(24, "forest-crow", "animal", 32, 9, 1, 1, {
        animalId: "crow",
        displayName: "黑鸦",
        line: "黑鸦偏着头看你，像是在记住今天的来客。",
      }),
      object(25, "forest-frog", "animal", 6, 7, 1, 1, {
        animalId: "frogBlue",
        displayName: "蓝蛙",
        line: "蓝蛙贴着水边一跳，叶面晃出一圈小水纹。",
      }),
    ]),
  ]);
}

function makeBeachMap() {
  const ground = emptyLayer(gid("beachSand"));
  setRect(ground, 19, 0, 5, 19, gid("road"));
  setRect(ground, 0, 17, COLS, 11, gid("water"));
  setRect(ground, 32, 6, 10, 11, gid("water"));

  const decor = emptyLayer();
  for (let y = 9; y < 18; y += 1) {
    setTile(decor, 21, y, gid("dock"));
  }
  setTile(decor, 8, 7, gid("crate"));
  setTile(decor, 12, 10, gid("flowerRed"));
  setTile(decor, 27, 8, gid("flowerBlue"));
  setTile(decor, 29, 13, gid("rock"));
  setTile(decor, 35, 5, gid("rock"));
  setTile(decor, 6, 14, gid("sign"));
  setTile(decor, 10, 15, gid("beachBoat"));
  setTile(decor, 22, 15, gid("beachFishPoint"));
  setTile(decor, 30, 6, gid("coconutTree"));
  setTile(decor, 38, 13, gid("coconutTree"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "beach-top", "collision", 0, 0, COLS, 1),
      object(2, "beach-left", "collision", 0, 0, 1, ROWS),
      object(3, "beach-right", "collision", COLS - 1, 0, 1, ROWS),
      object(4, "surf", "collision", 0, 17, COLS, 11),
      object(5, "east-surf", "collision", 32, 6, 10, 11),
      object(6, "north-road", "transition", 19, 0, 5, 1, { targetPlace: "town", targetX: 21, targetY: 17, facing: "down" }),
      object(7, "beach-crate", "collision", 8, 7, 1, 1),
      object(8, "beach-rock-1", "collision", 29, 13, 1, 1),
      object(9, "beach-rock-2", "collision", 35, 5, 1, 1),
      object(12, "beach-boat", "collision", 10, 15, 1, 1),
      object(13, "beach-fish-point", "interaction", 22, 15, 1, 1, { action: "fish-point", label: "鱼影" }),
      object(14, "beach-coconut-left", "collision", 30, 6, 1, 1),
      object(15, "beach-coconut-right", "collision", 38, 13, 1, 1),
      object(17, "beach-coconut-tree-left", "fruit-tree", 30, 6, 1, 1, {
        treeId: "coconutTree",
        product: "coconut",
        displayName: "椰子树",
      }),
      object(18, "beach-coconut-tree-right", "fruit-tree", 38, 13, 1, 1, {
        treeId: "coconutTree",
        product: "coconut",
        displayName: "椰子树",
      }),
      object(10, "beach-pelican", "animal", 13, 11, 1, 1, {
        animalId: "pelican",
        displayName: "鹈鹕",
        line: "鹈鹕站在沙地和水线之间，盯着浪花等鱼影。",
      }),
      object(11, "beach-seagull", "animal", 26, 10, 1, 1, {
        animalId: "seagull",
        displayName: "海鸥",
        line: "海鸥扑了扑翅膀，把码头边的风声搅亮了。",
      }),
      object(16, "beach-dolphin", "animal", 33, 15, 1, 1, {
        animalId: "blueDolphin",
        displayName: "蓝海豚",
        line: "蓝海豚在浅水边露出背鳍，像把浪花往岸边轻轻推了一下。",
      }),
    ]),
  ]);
}

function makeCaveMap() {
  const ground = emptyLayer(gid("caveFloor"));
  setRect(ground, 0, 0, COLS, 1, gid("caveWall"));
  setRect(ground, 0, ROWS - 1, COLS, 1, gid("caveWall"));
  setRect(ground, 0, 0, 1, ROWS, gid("caveWall"));
  setRect(ground, COLS - 1, 0, 1, ROWS, gid("caveWall"));
  setRect(ground, 12, 11, 18, 2, gid("caveWall"));
  setRect(ground, 7, 20, 9, 2, gid("water"));

  const decor = emptyLayer();
  for (const [x, y] of [
    [7, 6],
    [10, 18],
    [28, 7],
    [31, 20],
    [18, 15],
    [34, 14],
  ]) {
    setTile(decor, x, y, gid("mineCrystal"));
  }
  setTile(decor, 21, 2, gid("dungeonWall"));
  setTile(decor, 21, 26, gid("caveFloor"));
  setTile(decor, 13, 10, gid("rock"));
  setTile(decor, 29, 12, gid("rock"));
  setTile(decor, 9, 8, gid("mineLamp"));
  setTile(decor, 32, 8, gid("mineLamp"));
  setTile(decor, 21, 18, gid("bonfire"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "cave-top", "collision", 0, 0, COLS, 1),
      object(2, "cave-bottom", "collision", 0, ROWS - 1, COLS, 1),
      object(3, "cave-left", "collision", 0, 0, 1, ROWS),
      object(4, "cave-right", "collision", COLS - 1, 0, 1, ROWS),
      object(5, "cave-ridge", "collision", 12, 11, 18, 2),
      object(6, "cave-water", "collision", 7, 20, 9, 2),
      object(7, "forest-exit", "transition", 21, 26, 1, 1, { targetPlace: "deepForest", targetX: 36, targetY: 13, facing: "down" }),
      object(8, "dungeon-door", "transition", 21, 0, 1, 1, { targetPlace: "dungeon", targetX: 21, targetY: 25, facing: "up" }),
      object(9, "cave-rock-1", "collision", 13, 10, 1, 1),
      object(10, "cave-rock-2", "collision", 29, 12, 1, 1),
      object(11, "cave-bonfire", "interaction", 21, 18, 1, 1, { action: "bonfire", label: "矿灯营火" }),
      object(12, "cave-slime", "enemy", 18, 16, 1, 1, {
        enemyId: "blueSlime",
        displayName: "蓝史莱姆",
        rewardGold: 18,
        line: "它从湿石边弹起来，啪地一声散成矿洞水光。",
      }),
      object(13, "cave-sprout-slime", "enemy", 31, 18, 1, 1, {
        enemyId: "sproutSlime",
        displayName: "芽史莱姆",
        rewardGold: 24,
        line: "嫩芽从软泥里缩回去，留下几枚亮晶晶的矿砂。",
      }),
    ]),
  ]);
}

function makeDungeonMap() {
  const ground = emptyLayer(gid("dungeonFloor"));
  setRect(ground, 0, 0, COLS, 1, gid("dungeonWall"));
  setRect(ground, 0, ROWS - 1, COLS, 1, gid("dungeonWall"));
  setRect(ground, 0, 0, 1, ROWS, gid("dungeonWall"));
  setRect(ground, COLS - 1, 0, 1, ROWS, gid("dungeonWall"));
  setRect(ground, 8, 8, 10, 2, gid("dungeonWall"));
  setRect(ground, 25, 8, 9, 2, gid("dungeonWall"));
  setRect(ground, 17, 17, 8, 2, gid("dungeonWall"));

  const decor = emptyLayer();
  setTile(decor, 21, 26, gid("door"));
  setTile(decor, 8, 6, gid("lantern"));
  setTile(decor, 33, 6, gid("lantern"));
  setTile(decor, 12, 15, gid("crate"));
  setTile(decor, 29, 15, gid("crate"));
  setTile(decor, 21, 12, gid("templeStatue"));
  setTile(decor, 17, 20, gid("mineCrystal"));
  setTile(decor, 24, 20, gid("mineCrystal"));
  setTile(decor, 13, 6, gid("mineLamp"));
  setTile(decor, 28, 6, gid("mineLamp"));
  setTile(decor, 21, 21, gid("bonfire"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "dungeon-top", "collision", 0, 0, COLS, 1),
      object(2, "dungeon-bottom", "collision", 0, ROWS - 1, COLS, 1),
      object(3, "dungeon-left", "collision", 0, 0, 1, ROWS),
      object(4, "dungeon-right", "collision", COLS - 1, 0, 1, ROWS),
      object(5, "dungeon-north-ridge", "collision", 8, 8, 10, 2),
      object(6, "dungeon-east-ridge", "collision", 25, 8, 9, 2),
      object(7, "dungeon-south-ridge", "collision", 17, 17, 8, 2),
      object(8, "cave-exit", "transition", 21, 26, 1, 1, { targetPlace: "cave", targetX: 21, targetY: 3, facing: "down" }),
      object(9, "dungeon-crate-1", "collision", 12, 15, 1, 1),
      object(10, "dungeon-crate-2", "collision", 29, 15, 1, 1),
      object(11, "dungeon-statue", "collision", 21, 12, 1, 1),
      object(12, "dungeon-bonfire", "interaction", 21, 21, 1, 1, { action: "bonfire", label: "地下营火" }),
      object(13, "dungeon-myconid", "enemy", 14, 13, 1, 1, {
        enemyId: "purpleMyconid",
        displayName: "紫菇卫",
        rewardGold: 36,
        line: "紫色孢子被山风吹散，石室里露出一条更亮的矿脉。",
      }),
      object(14, "dungeon-spike", "enemy", 28, 13, 1, 1, {
        enemyId: "spikePlant",
        displayName: "刺芽",
        rewardGold: 42,
        line: "刺芽收起尖刺，地面只剩一点发烫的根须。",
      }),
    ]),
  ]);
}

function makeTempleMap() {
  const ground = emptyLayer(gid("templeFloor"));
  setRect(ground, 0, 0, COLS, 1, gid("templeWall"));
  setRect(ground, 0, ROWS - 1, COLS, 1, gid("templeWall"));
  setRect(ground, 0, 0, 1, ROWS, gid("templeWall"));
  setRect(ground, COLS - 1, 0, 1, ROWS, gid("templeWall"));
  setRect(ground, 15, 5, 12, 2, gid("templeWall"));
  setRect(ground, 15, 18, 12, 2, gid("templeWall"));
  setRect(ground, 18, 21, 7, 3, gid("rug"));

  const decor = emptyLayer();
  setTile(decor, 21, 26, gid("door"));
  setTile(decor, 21, 11, gid("templeStatue"));
  setTile(decor, 14, 10, gid("lantern"));
  setTile(decor, 28, 10, gid("lantern"));
  setTile(decor, 13, 15, gid("flowerBlue"));
  setTile(decor, 29, 15, gid("flowerRed"));
  setTile(decor, 18, 8, gid("table"));
  setTile(decor, 24, 8, gid("table"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "temple-top", "collision", 0, 0, COLS, 1),
      object(2, "temple-bottom", "collision", 0, ROWS - 1, COLS, 1),
      object(3, "temple-left", "collision", 0, 0, 1, ROWS),
      object(4, "temple-right", "collision", COLS - 1, 0, 1, ROWS),
      object(5, "temple-altar", "collision", 15, 5, 12, 2),
      object(6, "temple-screen", "collision", 15, 18, 12, 2),
      object(7, "temple-statue", "collision", 21, 11, 1, 1),
      object(8, "temple-table-left", "collision", 18, 8, 1, 1),
      object(9, "temple-table-right", "collision", 24, 8, 1, 1),
      object(10, "town-exit", "transition", 21, 26, 1, 1, { targetPlace: "town", targetX: 34, targetY: 13, facing: "down" }),
    ]),
  ]);
}

function makeBarnMap() {
  const ground = emptyLayer(gid("barnFloor"));
  setRect(ground, 0, 0, COLS, 1, gid("barnWall"));
  setRect(ground, 0, ROWS - 1, COLS, 1, gid("barnWall"));
  setRect(ground, 0, 0, 1, ROWS, gid("barnWall"));
  setRect(ground, COLS - 1, 0, 1, ROWS, gid("barnWall"));
  setRect(ground, 6, 7, 9, 4, gid("hay"));
  setRect(ground, 27, 7, 8, 4, gid("hay"));

  const decor = emptyLayer();
  setTile(decor, 21, 26, gid("door"));
  setTile(decor, 10, 14, gid("crate"));
  setTile(decor, 31, 14, gid("crate"));
  setTile(decor, 18, 8, gid("lantern"));
  setTile(decor, 24, 8, gid("lantern"));
  setTile(decor, 20, 16, gid("table"));
  setTile(decor, 22, 16, gid("table"));
  setTile(decor, 17, 15, gid("cheesePress"));
  setTile(decor, 24, 15, gid("butterChurn"));
  setTile(decor, 21, 12, gid("jamMaker"));

  return mapShell([
    tileLayer(1, "Ground", ground),
    tileLayer(2, "Decor", decor),
    objectLayer(3, "Objects", [
      object(1, "barn-top", "collision", 0, 0, COLS, 1),
      object(2, "barn-bottom", "collision", 0, ROWS - 1, COLS, 1),
      object(3, "barn-left", "collision", 0, 0, 1, ROWS),
      object(4, "barn-right", "collision", COLS - 1, 0, 1, ROWS),
      object(5, "left-hay", "collision", 6, 7, 9, 4),
      object(6, "right-hay", "collision", 27, 7, 8, 4),
      object(7, "left-crate", "collision", 10, 14, 1, 1),
      object(8, "right-crate", "collision", 31, 14, 1, 1),
      object(9, "barn-table-left", "collision", 20, 16, 1, 1),
      object(10, "barn-table-right", "collision", 22, 16, 1, 1),
      object(11, "farm-exit", "transition", 21, 26, 1, 1, { targetPlace: "farm", targetX: 30, targetY: 9, facing: "down" }),
      object(15, "cheese-press", "interaction", 17, 15, 1, 1, { action: "workbench", label: "奶酪机" }),
      object(16, "butter-churn", "interaction", 24, 15, 1, 1, { action: "workbench", label: "搅乳桶" }),
      object(18, "jam-maker", "interaction", 21, 12, 1, 1, { action: "workbench", label: "果酱机" }),
      object(12, "sheep-white", "animal", 12, 13, 1, 1, {
        animalId: "sheepWhite",
        displayName: "白绵羊",
        product: "wool",
        line: "绵羊蹭过木柱，留下一点暖乎乎的羊毛。",
      }),
      object(13, "pig-pink", "animal", 29, 13, 1, 1, {
        animalId: "pigPink",
        displayName: "粉猪",
        product: "truffle",
        line: "粉猪拱了拱草堆，好像翻出一枚山野松露。",
      }),
      object(14, "ostrich-brown", "animal", 21, 18, 1, 1, {
        animalId: "ostrichBrown",
        displayName: "褐鸵鸟",
        product: "ostrichEgg",
        line: "鸵鸟把长脚收得很稳，谷仓里一下显得热闹了。",
      }),
      object(17, "barn-cow", "animal", 18, 18, 1, 1, {
        animalId: "cowBrown",
        displayName: "褐奶牛",
        product: "cowMilk",
        line: "奶牛靠着草堆慢慢呼气，牛奶桶还带着温度。",
      }),
    ]),
  ]);
}

async function main() {
  await mkdir(spriteDir, { recursive: true });
  await mkdir(mapDir, { recursive: true });
  await mkdir(uiDir, { recursive: true });

  await makeSheet("farm-tiles.png", await farmRpgTileSprites(), 8);
  await makeSheet("characters.png", await farmRpgCharacterSprites(), 8);
  await makeSheet("crops.png", await farmRpgCropSprites(), 4);
  await makeSheet("icons.png", await farmRpgIconSprites(), 8);
  await makeSheet("animals.png", await farmRpgAnimalSprites(), 8);
  await makeSizedSheet("fruit-trees.png", await farmRpgFruitTreeSprites(), 4, 48, 48);
  await makeSheet("enemies.png", await farmRpgEnemySprites(), 4);
  await makeUiAssets();

  await writeFile(join(mapDir, "farm.json"), `${JSON.stringify(makeFarmMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "home.json"), `${JSON.stringify(makeHomeMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "town.json"), `${JSON.stringify(makeTownMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "shop.json"), `${JSON.stringify(makeShopMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "deep-forest.json"), `${JSON.stringify(makeDeepForestMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "beach.json"), `${JSON.stringify(makeBeachMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "cave.json"), `${JSON.stringify(makeCaveMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "dungeon.json"), `${JSON.stringify(makeDungeonMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "temple.json"), `${JSON.stringify(makeTempleMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "barn.json"), `${JSON.stringify(makeBarnMap(), null, 2)}\n`);

  await writeFile(
    join(spriteDir, "asset-frames.json"),
    `${JSON.stringify({ tileFrames, characterFrames, cropFrames, iconFrames, animalFrames, fruitTreeFrames, enemyFrames }, null, 2)}\n`,
  );
}

await main();
