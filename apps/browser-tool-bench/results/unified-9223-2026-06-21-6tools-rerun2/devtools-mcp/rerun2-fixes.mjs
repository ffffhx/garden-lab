import fs from "node:fs";
import { Client, StdioClientTransport } from "/Users/bytedance/.nvm/versions/node/v22.21.1/lib/node_modules/chrome-devtools-mcp/build/src/third_party/index.js";

const evidencePath = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools-rerun2/devtools-mcp/evidence.json";
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const base = "http://localhost:4399";
const fixturePath = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt";

const transport = new StdioClientTransport({
  command: "chrome-devtools-mcp",
  args: ["--browserUrl", "http://127.0.0.1:9223", "--experimentalIncludeAllPages", "--categoryExtensions", "--no-usage-statistics"],
  stderr: "pipe",
});
const client = new Client({ name: "browser-tool-bench-rerun2-fixes", version: "1.0.0" }, { capabilities: {} });

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

await run("T01", async () => {
  await tool("new_page", { url: `${base}/login?devtools_fix=${Date.now()}`, timeout: 10000 });
  const login = await evalJson(`async () => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'agent@bench.dev', password: 'bench-2026' })
    });
    return { status: res.status, ok: res.ok };
  }`);
  await tool("navigate_page", { type: "url", url: `${base}/dashboard?devtools_fix=${Date.now()}`, timeout: 10000 });
  await tool("wait_for", { text: ["BENCH-7341"], timeout: 10000 });
  const dashboard = await evalJson(`() => ({ url: location.href, greeting: document.querySelector('#greeting')?.textContent || document.body.innerText })`);
  return { login, dashboard };
});

await run("T17", async () => {
  await tool("new_page", { url: `${base}/iframe-auth?devtools_fix=${Date.now()}`, timeout: 10000 });
  const snapshot = await tool("take_snapshot");
  const uid = (snapshot.match(/uid=(\S+) button "确认授权"/) || [])[1];
  if (uid) await tool("click", { uid, includeSnapshot: false });
  await tool("wait_for", { text: ["OAUTH-314"], timeout: 10000 });
  const data = await evalJson(`() => ({ text: document.body.innerText })`);
  return { uid, snapshotHead: snapshot.slice(0, 1200), data };
});

await run("T18", async () => {
  await tool("new_page", { url: `${base}/input-lab?devtools_fix=${Date.now()}`, timeout: 10000 });
  const snapshot = await tool("take_snapshot", { verbose: true });
  const uid = (snapshot.match(/uid=(\S+) button "选择文件"/) || [])[1];
  if (uid) await tool("upload_file", { uid, filePath: fixturePath, includeSnapshot: false });
  await tool("wait_for", { text: ["UPLOAD-448"], timeout: 10000 }).catch(() => "");
  const data = await evalJson(`() => ({
    value: document.querySelector('#token-file').value,
    filesLength: document.querySelector('#token-file').files.length,
    file0: document.querySelector('#token-file').files[0] ? { name: document.querySelector('#token-file').files[0].name, size: document.querySelector('#token-file').files[0].size } : null,
    result: document.querySelector('#upload-result').textContent
  })`);
  return { uid, data };
});

await client.close();
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, T01: evidence.T01, T17: evidence.T17, T18: evidence.T18 }));
