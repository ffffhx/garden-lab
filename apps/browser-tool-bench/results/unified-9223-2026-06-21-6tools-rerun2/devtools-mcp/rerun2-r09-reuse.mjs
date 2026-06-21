import fs from "node:fs";
import { Client, StdioClientTransport } from "/Users/bytedance/.nvm/versions/node/v22.21.1/lib/node_modules/chrome-devtools-mcp/build/src/third_party/index.js";

const evidencePath = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools-rerun2/devtools-mcp/evidence.json";
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));

const transport = new StdioClientTransport({
  command: "chrome-devtools-mcp",
  args: ["--browserUrl", "http://127.0.0.1:9223", "--experimentalIncludeAllPages", "--categoryExtensions", "--no-usage-statistics"],
  stderr: "pipe",
});
const client = new Client({ name: "browser-tool-bench-rerun2-r09-reuse", version: "1.0.0" }, { capabilities: {} });

function textOf(result) {
  return result?.content?.map((part) => part.text || "").join("\n") || "";
}

async function tool(name, args = {}) {
  return textOf(await client.callTool({ name, arguments: args }));
}

function parseJsonBlock(text) {
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return { raw: text };
  return JSON.parse(match[1]);
}

await client.connect(transport);
const pages = await tool("list_pages").catch((error) => `list_pages error: ${error.message}`);
let reused = null;
try {
  reused = parseJsonBlock(await tool("evaluate_script", {
    function: `() => ({
      url: location.href,
      title: document.title,
      h1: document.querySelector('h1')?.textContent || '',
      entries: performance.getEntriesByType('resource')
        .map(e => ({ url: e.name, type: e.initiatorType, duration: Math.round(e.duration), responseEnd: Math.round(e.responseEnd) }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
    })`,
  }));
} catch (error) {
  reused = { error: error?.message || String(error) };
}
evidence.R09 = { ...evidence.R09, pages, reused };
await client.close();
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence.R09, null, 2));
