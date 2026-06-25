import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildAgentPostIndex } from "../lib/content/agent-tools";
import { getAllPosts } from "../lib/content/posts";

// 把全站文章索引生成为静态文件，供 WebMCP agent 工具按需懒加载。
// 之前这份索引由 layout 作为 prop 传给 client 组件 WebMcpTools，会被序列化进
// 每一页的 HTML（约 50K flight payload）。改为静态文件后，普通访客不再下载它，
// 只有支持 WebMCP 的浏览器/agent 在用到工具时才 fetch，显著减小每页 HTML 体积。
const posts = getAllPosts();
const index = buildAgentPostIndex(posts);

const outDir = join(process.cwd(), "public");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "agent-post-index.json");
const json = JSON.stringify(index);
writeFileSync(outFile, json);

console.log(
  `Wrote ${outFile} (${index.length} posts, ${(json.length / 1024).toFixed(1)}KB)`
);
