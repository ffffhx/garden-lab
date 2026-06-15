import fs from "node:fs";
import { execSync } from "node:child_process";

const root = "/Users/bytedance/Code/garden-lab/apps/site/source/_posts";
const files = execSync(`grep -rl 'cover: "cover-v1.svg"' 2026`, { cwd: root })
  .toString().trim().split("\n");

const out = [];
for (const f of files) {
  const dir = f.replace(/\.md$/, "");
  const svg = `${root}/${dir}/cover-v1.svg`;
  let texts = [];
  try {
    const s = fs.readFileSync(svg, "utf8");
    texts = [...s.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1].trim()).filter(Boolean);
  } catch {}
  const md = fs.readFileSync(`${root}/${f}`, "utf8");
  const title = (md.match(/^title:\s*"?(.+?)"?\s*$/m) || [])[1];
  const cat = (md.match(/categories:\s*\n\s*-\s*(.+)/) || [])[1];
  const date = (md.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})/m) || [])[1];
  out.push({ dir, cat, date, title, texts });
}
fs.writeFileSync(new URL("./extracted.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("posts:", out.length);
for (const p of out) {
  console.log("\n### " + p.dir);
  console.log("CAT:", p.cat, "| DATE:", p.date);
  console.log("TITLE:", p.title);
  console.log("TEXTS:", JSON.stringify(p.texts));
}
