import fs from "node:fs";
import path from "node:path";
import { Client, StdioClientTransport } from "/Users/bytedance/.nvm/versions/node/v22.21.1/lib/node_modules/chrome-devtools-mcp/build/src/third_party/index.js";

const outDir = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools-rerun2/devtools-mcp";
const evidencePath = path.join(outDir, "evidence.json");
const manifestPath = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/extension-sample/manifest.json";
const lockDir = "/tmp/browser-tool-bench-t09.lockdir";
const base = "http://localhost:4399";
const extId = "jkmndkochpgaleoechlemhdhbikdecnf";

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const originalManifestText = fs.readFileSync(manifestPath, "utf8");
const originalManifest = JSON.parse(originalManifestText);

const transport = new StdioClientTransport({
  command: "chrome-devtools-mcp",
  args: [
    "--browserUrl",
    "http://127.0.0.1:9223",
    "--experimentalIncludeAllPages",
    "--categoryExtensions",
    "--no-usage-statistics",
  ],
  stderr: "pipe",
});
const client = new Client({ name: "browser-tool-bench-rerun2-t09", version: "1.0.0" }, { capabilities: {} });

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

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock() {
  for (let i = 0; i < 120; i++) {
    try {
      fs.mkdirSync(lockDir);
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await wait(500);
    }
  }
  throw new Error(`Timed out acquiring ${lockDir}`);
}

function releaseLock() {
  fs.rmSync(lockDir, { recursive: true, force: true });
}

function setManifestVersion(version) {
  const manifest = JSON.parse(originalManifestText);
  manifest.version = version;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function readBadge(suffix) {
  await tool("new_page", { url: `${base}/?${suffix}=${Date.now()}`, timeout: 10000 });
  await tool("wait_for", { text: ["BENCH EXT", "v1.0."], timeout: 10000 }).catch(() => "");
  return evalJson(`() => ({
    url: location.href,
    title: document.title,
    badge: document.querySelector('#bench-ext-badge')?.textContent || null,
    bodyHead: document.body.innerText.slice(0, 500)
  })`);
}

async function reloadExtension(label) {
  await tool("new_page", { url: "chrome://extensions/", timeout: 10000 });
  await wait(1500);
  const before = await evalJson(`(targetId) => {
    function all(root) {
      const out = [];
      const visit = (node) => {
        if (!node || !node.querySelectorAll) return;
        for (const el of node.querySelectorAll('*')) {
          out.push(el);
          if (el.shadowRoot) visit(el.shadowRoot);
        }
      };
      visit(root);
      return out;
    }
    return all(document)
      .filter((el) => {
        const text = (el.shadowRoot && el.shadowRoot.innerText) || el.innerText || el.textContent || '';
        return text.includes('Bench Badge') || text.includes(targetId) || el.id === targetId;
      })
      .map((el) => ({
        tag: el.tagName,
        id: el.id || '',
        text: ((el.shadowRoot && el.shadowRoot.innerText) || el.innerText || el.textContent || '').slice(0, 600),
      }))
      .slice(0, 20);
  }`);
  const reloadResult = await evalJson(`(targetId) => {
    function all(root) {
      const out = [];
      const visit = (node) => {
        if (!node || !node.querySelectorAll) return;
        for (const el of node.querySelectorAll('*')) {
          out.push(el);
          if (el.shadowRoot) visit(el.shadowRoot);
        }
      };
      visit(root);
      return out;
    }
    const candidates = all(document).filter((el) => {
      const text = (el.shadowRoot && el.shadowRoot.innerText) || el.innerText || el.textContent || '';
      return text.includes('Bench Badge') || text.includes(targetId) || el.id === targetId;
    });
    for (const candidate of candidates) {
      const root = candidate.shadowRoot || candidate;
      const buttons = Array.from(root.querySelectorAll('cr-icon-button, button, [role=button]'));
      const reload = buttons.find((button) => {
        const label = button.getAttribute('aria-label') || button.getAttribute('title') || button.id || button.textContent || '';
        return /reload|重新加载|重载/i.test(label);
      });
      if (reload) {
        reload.click();
        return {
          clicked: true,
          label: reload.getAttribute('aria-label') || reload.getAttribute('title') || reload.id || reload.textContent || '',
          hostTag: candidate.tagName,
          hostId: candidate.id || '',
        };
      }
    }
    return { clicked: false, candidateCount: candidates.length };
  }`);
  await wait(2000);
  return { label, before, reloadResult };
}

await acquireLock();
await client.connect(transport);

try {
  const baseline = await readBadge("t09_devtools_baseline");
  setManifestVersion("1.0.1");
  const reloadTo101 = await reloadExtension("reload-to-1.0.1");
  const badge101 = await readBadge("t09_devtools_101");
  setManifestVersion(originalManifest.version);
  const reloadTo100 = await reloadExtension("reload-to-1.0.0");
  const badge100 = await readBadge("t09_devtools_restore");

  evidence.T09 = {
    originalVersion: originalManifest.version,
    manifestPath,
    baseline,
    reloadTo101,
    badge101,
    reloadTo100,
    badge100,
    finalManifest: JSON.parse(fs.readFileSync(manifestPath, "utf8")),
  };
} catch (error) {
  evidence.T09 = { error: error?.message || String(error), stack: error?.stack || "" };
  throw error;
} finally {
  fs.writeFileSync(manifestPath, originalManifestText);
  evidence.T09 ??= {};
  evidence.T09.restoredManifestAfterFinally = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  await client.close().catch(() => {});
  releaseLock();
}

console.log(JSON.stringify(evidence.T09, null, 2));
