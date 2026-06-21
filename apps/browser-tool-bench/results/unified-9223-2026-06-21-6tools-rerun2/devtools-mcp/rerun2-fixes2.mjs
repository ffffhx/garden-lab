import fs from "node:fs";
import { Client, StdioClientTransport } from "/Users/bytedance/.nvm/versions/node/v22.21.1/lib/node_modules/chrome-devtools-mcp/build/src/third_party/index.js";

const evidencePath = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools-rerun2/devtools-mcp/evidence.json";
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const base = "http://localhost:4399";

const transport = new StdioClientTransport({
  command: "chrome-devtools-mcp",
  args: ["--browserUrl", "http://127.0.0.1:9223", "--experimentalIncludeAllPages", "--categoryExtensions", "--no-usage-statistics"],
  stderr: "pipe",
});
const client = new Client({ name: "browser-tool-bench-rerun2-fixes2", version: "1.0.0" }, { capabilities: {} });

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

async function evalJson(fn) {
  return parseJsonBlock(await tool("evaluate_script", { function: fn }));
}

async function run(name, fn) {
  try {
    evidence[name] = await fn();
  } catch (error) {
    evidence[name] = { error: error?.message || String(error), stack: error?.stack || "" };
  }
}

await client.connect(transport);

await run("T03", async () => {
  await tool("new_page", { url: `${base}/`, timeout: 10000 });
  await tool("navigate_page", {
    type: "url",
    url: `${base}/slow?devtools_fix2=${Date.now()}`,
    initScript: `
      window.__benchLongTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__benchLongTasks.push({
            name: entry.name,
            startTime: Math.round(entry.startTime),
            duration: Math.round(entry.duration)
          });
        }
      }).observe({ type: 'longtask', buffered: true });
    `,
    timeout: 10000,
  });
  await tool("wait_for", { text: ["关键资源加载完成"], timeout: 10000 }).catch(() => "");
  return evalJson(`() => ({
    resources: performance.getEntriesByType('resource')
      .filter(e => /blocking\\.css|heavy\\.js|hero\\.svg/.test(e.name))
      .map(e => ({ name: e.name, type: e.initiatorType, duration: Math.round(e.duration), responseEnd: Math.round(e.responseEnd) })),
    longTasks: window.__benchLongTasks || [],
    bodyHead: document.body.innerText.slice(0, 500)
  })`);
});

await run("T05", async () => {
  await tool("new_page", { url: `${base}/livefeed?devtools_fix2=${Date.now()}`, timeout: 10000 });
  await tool("wait_for", { text: ["已加载 8 条"], timeout: 10000 });
  await evalJson(`() => {
    document.querySelector('#load-more').click();
    return { clicked: true };
  }`);
  await tool("wait_for", { text: ["LIVE-512", "已加载 12 条"], timeout: 10000 });
  return evalJson(`() => ({
    itemCount: document.querySelectorAll('#feed li').length,
    text: document.body.innerText
  })`);
});

await client.close();
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, T03: evidence.T03, T05: evidence.T05 }, null, 2));
