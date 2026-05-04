import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

const TILE = 32;
const COLS = 42;
const ROWS = 28;
const root = new URL("..", import.meta.url).pathname;
const publicDir = join(root, "public");
const spriteDir = join(publicDir, "assets", "sprites");
const mapDir = join(publicDir, "assets", "maps");

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
};

const tileCount = Object.keys(tileFrames).length;
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

const cropFrames = {
  turnip0: 0,
  turnip1: 1,
  turnip2: 2,
  turnip3: 3,
  wheat0: 4,
  wheat1: 5,
  wheat2: 6,
  wheat3: 7,
  potato0: 8,
  potato1: 9,
  potato2: 10,
  potato3: 11,
};

const iconFrames = {
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
};

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
  const width = columns * TILE;
  const rows = Math.ceil(frames.length / columns);
  const height = rows * TILE;
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
    left: (index % columns) * TILE,
    top: Math.floor(index / columns) * TILE,
  }));

  await base.composite(composites).png().toFile(join(spriteDir, file));
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
        imageheight: Math.ceil(tileCount / tilesetColumns) * TILE,
        tilewidth: TILE,
        tileheight: TILE,
        columns: tilesetColumns,
        tilecount: tileCount,
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
  setTile(decor, 35, 4, gid("treeTop"));
  setTile(decor, 35, 5, gid("treeTrunk"));
  setTile(decor, 38, 13, gid("treeTop"));
  setTile(decor, 38, 14, gid("treeTrunk"));
  setTile(decor, 2, 18, gid("treeTop"));
  setTile(decor, 2, 19, gid("treeTrunk"));
  setTile(decor, 4, 24, gid("treeTop"));
  setTile(decor, 4, 25, gid("treeTrunk"));

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
      object(4, "shipping-bin", "interaction", 9, 5, 1, 1, { action: "ship", label: "售卖箱" }),
      object(5, "home-door", "transition", 5, 6, 1, 1, { targetPlace: "home", targetX: 21, targetY: 25, facing: "down" }),
      object(37, "mailbox", "interaction", 10, 5, 1, 1, { action: "mailbox", label: "邮箱" }),
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
    ]),
  ]);
}

function makeTownMap() {
  const ground = emptyLayer(gid("grass"));
  setRect(ground, 20, 0, 3, ROWS, gid("road"));
  setRect(ground, 4, 14, 34, 3, gid("road"));

  const decor = emptyLayer();
  setRect(decor, 16, 6, 10, 2, gid("roofGreen"));
  setRect(decor, 16, 8, 10, 5, gid("wallShop"));
  setTile(decor, 20, 12, gid("door"));
  setRect(decor, 4, 7, 7, 2, gid("roofGray"));
  setRect(decor, 4, 9, 7, 4, gid("wallGray"));
  setRect(decor, 31, 7, 7, 2, gid("roofPurple"));
  setRect(decor, 31, 9, 7, 4, gid("wallPurple"));
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
      object(3, "seed-shop", "collision", 16, 6, 10, 7),
      object(4, "blacksmith", "closed-building", 4, 7, 7, 6, { message: "铁匠铺还在装修，之后再开放。" }),
      object(5, "clinic", "closed-building", 31, 7, 7, 6, { message: "医馆还在装修，之后再开放。" }),
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

async function main() {
  await mkdir(spriteDir, { recursive: true });
  await mkdir(mapDir, { recursive: true });

  await makeSheet("farm-tiles.png", tileSprites(), 8);
  await makeSheet(
    "characters.png",
    [
      characterSprite("playerDown"),
      characterSprite("playerDownStepLeft"),
      characterSprite("playerDownStepRight"),
      characterSprite("playerUp"),
      characterSprite("playerUpStepLeft"),
      characterSprite("playerUpStepRight"),
      characterSprite("playerLeft"),
      characterSprite("playerLeftStepLeft"),
      characterSprite("playerLeftStepRight"),
      characterSprite("playerRight"),
      characterSprite("playerRightStepLeft"),
      characterSprite("playerRightStepRight"),
      characterSprite("shopkeeper"),
      characterSprite("liang"),
      characterSprite("auntChen"),
      characterSprite("elder"),
    ],
    8,
  );
  await makeSheet(
    "crops.png",
    [
      cropSprite("turnip", 0),
      cropSprite("turnip", 1),
      cropSprite("turnip", 2),
      cropSprite("turnip", 3),
      cropSprite("wheat", 0),
      cropSprite("wheat", 1),
      cropSprite("wheat", 2),
      cropSprite("wheat", 3),
      cropSprite("potato", 0),
      cropSprite("potato", 1),
      cropSprite("potato", 2),
      cropSprite("potato", 3),
    ],
    4,
  );
  await makeSheet(
    "icons.png",
    [
      iconSprite("hoe"),
      iconSprite("seedBag"),
      iconSprite("wateringCan"),
      iconSprite("harvestBasket"),
      iconSprite("turnip"),
      iconSprite("wheat"),
      iconSprite("potato"),
      iconSprite("coin"),
      iconSprite("sun"),
      iconSprite("rain"),
      iconSprite("mist"),
      iconSprite("energy"),
      iconSprite("order"),
      iconSprite("heart"),
      iconSprite("soundOn"),
      iconSprite("soundOff"),
      iconSprite("berry"),
      iconSprite("mushroom"),
      iconSprite("wildFlower"),
      iconSprite("fishingRod"),
      iconSprite("creekFish"),
      iconSprite("carp"),
      iconSprite("silverFish"),
    ],
    8,
  );

  await writeFile(join(mapDir, "farm.json"), `${JSON.stringify(makeFarmMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "home.json"), `${JSON.stringify(makeHomeMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "town.json"), `${JSON.stringify(makeTownMap(), null, 2)}\n`);
  await writeFile(join(mapDir, "shop.json"), `${JSON.stringify(makeShopMap(), null, 2)}\n`);

  await writeFile(
    join(spriteDir, "asset-frames.json"),
    `${JSON.stringify({ tileFrames, characterFrames, cropFrames, iconFrames }, null, 2)}\n`,
  );
}

await main();
