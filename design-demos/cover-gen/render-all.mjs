import fs from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire("/Users/bytedance/Code/garden-lab/apps/site/");
const sharp = require("sharp");

const ROOT = "/Users/bytedance/Code/garden-lab";
const POSTS = `${ROOT}/apps/site/source/_posts`;
const GEN = `${ROOT}/design-demos/cover-gen`;
const TMP = `${ROOT}/tmp/cover-shots`;
fs.mkdirSync(TMP, { recursive: true });

// load covers.js
const body = fs.readFileSync(`${GEN}/covers.js`, "utf8");
const win = {};
new Function("window", body)(win);
const covers = win.COVERS;

const only = process.argv[2] ? process.argv[2].split(",").map(Number) : null;
const ab = (cmd) => execSync(`agent-browser --cdp 9223 ${cmd}`, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const sleep = (ms) => execSync(`sleep ${ms / 1000}`);

// Keep ProfilePilot's fixed control bar below the 1600×900 poster so selector
// screenshots contain only the cover artwork.
ab(`set viewport 1600 1100 2`);

let done = 0;
for (let i = 0; i < covers.length; i++) {
  if (only && !only.includes(i)) continue;
  const c = covers[i];
  const url = `file://${GEN}/template.html?i=${i}&cb=${Date.now()}`;
  ab(`open "${url}"`);
  try { ab(`eval "document.fonts.ready"`); } catch {}
  sleep(750);
  const shot = `${TMP}/${i}.png`;
  ab(`screenshot "#poster" "${shot}"`);
  const outDir = `${POSTS}/${c.dir}`;
  if (!fs.existsSync(outDir)) { console.log(`!! missing dir for ${i}: ${outDir}`); continue; }
  await sharp(shot).resize(1672, 940, { fit: "fill" }).png({ quality: 90, compressionLevel: 9 })
    .toFile(`${outDir}/cover-v1.png`);
  // update frontmatter cover field
  const md = `${outDir}.md`;
  let txt = fs.readFileSync(md, "utf8");
  if (txt.includes('cover: "cover-v1.svg"')) {
    txt = txt.replace('cover: "cover-v1.svg"', 'cover: "cover-v1.png"');
    fs.writeFileSync(md, txt);
  }
  done++;
  console.log(`✓ [${i}] ${c.slug} → ${c.dir}/cover-v1.png`);
}
console.log(`\nDone: ${done} covers.`);
