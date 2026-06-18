import fs from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire("/Users/bytedance/Code/garden-lab/apps/site/");
const sharp = require("sharp");

const ROOT = "/Users/bytedance/Code/garden-lab";
const GEN = `${ROOT}/design-demos/cover-gen`;
const TMP = `${ROOT}/tmp/cover-shots`;
fs.mkdirSync(TMP, { recursive: true });

const i = Number(process.argv[2] ?? 29);
const write = process.argv[3] === "--write"; // only overwrite real cover when asked

const body = fs.readFileSync(`${GEN}/covers.js`, "utf8");
const win = {};
new Function("window", body)(win);
const c = win.COVERS[i];

// self-managed headless agent-browser (NO --cdp) so the user's daily Chrome (9223) is untouched
const ab = (cmd) => execSync(`agent-browser ${cmd}`, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const sleep = (ms) => execSync(`sleep ${ms / 1000}`);

ab(`set viewport 1600 900 2`);
const url = `file://${GEN}/template.html?i=${i}&cb=${Date.now()}`;
ab(`open "${url}"`);
try { ab(`eval "document.fonts.ready"`); } catch {}
sleep(1200);
const shot = `${TMP}/${i}-preview.png`;
ab(`screenshot "#poster" "${shot}"`);

const out = write
  ? `${ROOT}/apps/site/source/_posts/${c.dir}/cover-v1.png`
  : `${TMP}/${i}-cover-preview.png`;
await sharp(shot).resize(1672, 940, { fit: "fill" }).png({ quality: 90, compressionLevel: 9 }).toFile(out);
console.log(`✓ [${i}] ${c.slug} → ${out}`);
