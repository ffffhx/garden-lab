import fs from "node:fs";
import path from "node:path";
import { Client, StdioClientTransport } from "/Users/bytedance/.nvm/versions/node/v22.21.1/lib/node_modules/chrome-devtools-mcp/build/src/third_party/index.js";

const outDir = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools-rerun2/devtools-mcp";
const base = "http://localhost:4399";
const extId = "jkmndkochpgaleoechlemhdhbikdecnf";
const fixturePath = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt";
const evidence = {};

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
const client = new Client({ name: "browser-tool-bench-rerun2", version: "1.0.0" }, { capabilities: {} });

function textOf(result) {
  return result?.content?.map((part) => part.text || "").join("\n") || "";
}

async function tool(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  return textOf(result);
}

function parseJsonBlock(text) {
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return { raw: text };
  return JSON.parse(match[1]);
}

async function evalJson(fn, args = {}) {
  return parseJsonBlock(await tool("evaluate_script", { function: fn, ...args }));
}

async function run(name, fn) {
  try {
    evidence[name] = await fn();
  } catch (error) {
    evidence[name] = { error: error?.message || String(error), stack: error?.stack || "" };
  }
}

async function newPage(url, timeout = 30000) {
  return tool("new_page", { url, timeout });
}

async function setBadge(value) {
  await newPage(`chrome-extension://${extId}/options.html`, 10000);
  const saved = await evalJson(`() => {
    const input = document.querySelector('#badge-text');
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#save').click();
    return { value: input.value, status: document.querySelector('#status').textContent, url: location.href };
  }`);
  await tool("wait_for", { text: ["已保存"], timeout: 5000 }).catch(() => "");
  return saved;
}

async function readBadge(url) {
  await newPage(url, 45000);
  await tool("wait_for", { text: ["BENCH EXT", "HELLO-2026", "REAL-SITE-2026"], timeout: 10000 }).catch(() => "");
  return evalJson(`() => ({ url: location.href, title: document.title, badge: document.querySelector('#bench-ext-badge')?.textContent || null, bodyHead: document.body.innerText.slice(0, 500) })`);
}

await client.connect(transport);

await run("cdpProof", async () => {
  const url = `${base}/?devtools_mcp_rerun2_proof=${Date.now()}`;
  await newPage(url, 10000);
  return evalJson(`() => ({ url: location.href, title: document.title })`);
});

await run("T01", async () => {
  await newPage(`${base}/login?devtools_rerun2=${Date.now()}`, 10000);
  return evalJson(`async () => {
    document.querySelector('#email').value = 'agent@bench.dev';
    document.querySelector('#password').value = 'bench-2026';
    await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'agent@bench.dev', password: 'bench-2026' }) });
    location.href = '/dashboard';
    await new Promise(resolve => setTimeout(resolve, 800));
    return { url: location.href, greeting: document.querySelector('#greeting')?.textContent || document.body.innerText };
  }`);
});

await run("T02", async () => {
  await newPage(`${base}/dashboard?devtools_rerun2=${Date.now()}`, 10000);
  const body = await evalJson(`async () => {
    const res = await fetch('/api/orders', { method: 'POST' });
    const data = await res.json();
    return { status: res.status, data };
  }`);
  const requests = await tool("list_network_requests", { includePreservedRequests: true });
  const requestLine = (requests.match(/reqid=\d+ .*\/api\/orders \[500\]/) || [null])[0];
  return { body, requestLine, requestsHead: requests.slice(0, 1200) };
});

await run("T03", async () => {
  await newPage(`${base}/slow?devtools_rerun2=${Date.now()}`, 10000);
  const tracePath = path.join(outDir, "T03-trace-rerun2.json.gz");
  const trace = await tool("performance_start_trace", { reload: true, autoStop: true, filePath: tracePath });
  const timings = await evalJson(`() => ({
    resources: performance.getEntriesByType('resource')
      .filter(e => /blocking\\.css|heavy\\.js|hero\\.svg/.test(e.name))
      .map(e => ({ name: e.name, type: e.initiatorType, duration: Math.round(e.duration), responseEnd: Math.round(e.responseEnd) }))
  })`);
  return { tracePath, traceHead: trace.slice(0, 1600), timings };
});

await run("T04", async () => {
  await newPage(`${base}/`, 10000);
  await tool("navigate_page", {
    type: "url",
    url: `${base}/users?devtools_rerun2=${Date.now()}`,
    initScript: `const originalFetch = window.fetch.bind(window); window.fetch = async (input, init) => { const url = typeof input === 'string' ? input : input.url; if (url.includes('/api/users')) return new Response(JSON.stringify({users: []}), {status: 200, headers: {'content-type': 'application/json'}}); return originalFetch(input, init); };`,
    timeout: 10000,
  });
  await tool("wait_for", { text: ["暂无成员"], timeout: 10000 });
  return evalJson(`() => ({ text: document.body.innerText })`);
});

await run("T05", async () => {
  await newPage(`${base}/livefeed?devtools_rerun2=${Date.now()}`, 10000);
  return evalJson(`async () => {
    document.querySelector('#load-more').click();
    await new Promise(resolve => setTimeout(resolve, 900));
    return { itemCount: document.querySelectorAll('#feed li').length, text: document.body.innerText };
  }`);
});

await run("T06", async () => {
  await newPage(`${base}/catalog?devtools_rerun2=${Date.now()}`, 10000);
  return evalJson(`async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    document.querySelector('#next-page').click();
    await new Promise(resolve => setTimeout(resolve, 700));
    const rows = Array.from(document.querySelectorAll('.prod')).map(node => ({
      name: node.querySelector('strong')?.textContent?.trim(),
      stock: Number((node.textContent.match(/库存\\s*(\\d+)\\s*件/) || [])[1]),
      price: Number((node.querySelector('.pr i')?.textContent || '').replace(/[^\\d.]/g, '')),
    })).sort((a, b) => b.price - a.price);
    return { total: rows.length, rows, mostExpensive: rows[0] };
  }`);
});

await run("T07", async () => {
  await newPage(`${base}/dashboard?devtools_rerun2=${Date.now()}`, 10000);
  return evalJson(`async () => fetch('/api/me').then(res => res.json())`);
});

await run("T08", async () => {
  await newPage(`${base}/dashboard?devtools_rerun2=${Date.now()}`, 10000);
  return evalJson(`() => {
    const widget = document.querySelector('bench-widget');
    widget.shadowRoot.querySelector('#claim').click();
    return { code: widget.shadowRoot.querySelector('#code').textContent };
  }`);
});

await run("T10c", async () => {
  const url = `https://github.com/notifications?query=is%3Aunread&t10c=devtools-rerun2-${Date.now()}`;
  await newPage(url, 45000);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  return evalJson(`() => {
    const text = document.body.innerText;
    return {
      url: location.href,
      title: document.title,
      inbox: (text.match(/Inbox\\s*(\\d+)/) || [])[1] || null,
      head: text.slice(0, 1200)
    };
  }`);
});

await run("T11", async () => {
  const saved = await setBadge("HELLO-2026");
  const badge = await readBadge(`${base}/?t11=devtools-rerun2-${Date.now()}`);
  const restored = await setBadge("");
  const finalBadge = await readBadge(`${base}/?t11_restore=devtools-rerun2-${Date.now()}`);
  return { saved, badge, restored, finalBadge };
});

await run("T12", async () => {
  await newPage(`${base}/debug-console?devtools_rerun2=${Date.now()}`, 10000);
  await evalJson(`() => { document.querySelector('#apply-coupon').click(); return { clicked: true }; }`);
  const consoleMessages = await tool("list_console_messages");
  const sourceMap = await evalJson(`async () => fetch('/assets/debug-bundle.js.map').then(res => res.json()).then(map => {
    const idx = map.sources.findIndex(s => s.includes('coupon.ts'));
    return { source: map.sources[idx], sourceText: map.sourcesContent[idx] };
  })`);
  return { consoleMessages: consoleMessages.slice(0, 2000), sourceMap };
});

await run("T13", async () => {
  await newPage(`${base}/layout-mobile?devtools_rerun2=${Date.now()}`, 10000);
  await tool("emulate", { viewport: "390x844x2,mobile,touch" });
  const hit = await evalJson(`() => {
    const button = document.querySelector('#pay-button');
    const bar = document.querySelector('.mobile-support-bar');
    const br = button.getBoundingClientRect();
    const hitEl = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return {
      hitText: hitEl?.textContent?.replace(/\\s+/g, ' ').trim(),
      hitTag: hitEl?.tagName,
      buttonRect: { top: br.top, bottom: br.bottom, left: br.left, right: br.right },
      barSelector: '.mobile-support-bar[data-bug="overlaps-pay-button"]',
      actionsZ: getComputedStyle(button.closest('.checkout-actions')).zIndex,
      barZ: getComputedStyle(bar).zIndex,
      barHeight: getComputedStyle(bar).height
    };
  }`);
  const code = await evalJson(`() => {
    document.querySelector('.mobile-support-bar').style.pointerEvents = 'none';
    document.querySelector('#pay-button').click();
    return { code: document.querySelector('#pay-result').textContent };
  }`);
  return { hit, code };
});

await run("T14", async () => {
  await newPage(`${base}/hydration?devtools_rerun2=${Date.now()}`, 10000);
  await tool("wait_for", { text: ["HYD-908"], timeout: 10000 });
  return evalJson(`() => ({ store: window.__BENCH_STORE__, text: document.body.innerText })`);
});

await run("T15", async () => {
  await newPage(`${base}/realtime?devtools_rerun2=${Date.now()}`, 10000);
  await evalJson(`() => { document.querySelector('#start-stream').click(); return { clicked: true }; }`);
  await tool("wait_for", { text: ["STREAM-721"], timeout: 10000 });
  const data = await evalJson(`() => ({ status: document.querySelector('#stream-status').textContent, items: Array.from(document.querySelectorAll('#events li')).map(li => li.textContent) })`);
  const requests = await tool("list_network_requests", { resourceTypes: ["eventsource"], includePreservedRequests: true });
  return { data, requests };
});

await run("T16", async () => {
  await newPage(`${base}/cache?devtools_rerun2=${Date.now()}`, 10000);
  await tool("wait_for", { text: ["STALE-CACHE-17"], timeout: 10000 });
  return evalJson(`async () => ({
    controller: navigator.serviceWorker.controller?.scriptURL || null,
    text: document.body.innerText,
    live: await fetch('/api/settings?live=1').then(res => res.json())
  })`);
});

await run("T17", async () => {
  await newPage(`${base}/iframe-auth?devtools_rerun2=${Date.now()}`, 10000);
  const snapshot = await tool("take_snapshot");
  const uid = (snapshot.match(/uid=(\\S+) button "确认授权"/) || [])[1];
  if (uid) await tool("click", { uid, includeSnapshot: false });
  await tool("wait_for", { text: ["OAUTH-314"], timeout: 10000 });
  const data = await evalJson(`() => ({ text: document.body.innerText })`);
  return { uid, snapshotHead: snapshot.slice(0, 1200), data };
});

await run("T18", async () => {
  await newPage(`${base}/input-lab?devtools_rerun2=${Date.now()}`, 10000);
  const snapshot = await tool("take_snapshot", { verbose: true });
  const uid = (snapshot.match(/uid=(\\S+) button "选择文件"/) || [])[1];
  if (uid) await tool("upload_file", { uid, filePath: fixturePath, includeSnapshot: false });
  await tool("wait_for", { text: ["UPLOAD-448"], timeout: 10000 }).catch(() => "");
  const data = await evalJson(`() => ({ value: document.querySelector('#token-file').value, filesLength: document.querySelector('#token-file').files.length, file0: document.querySelector('#token-file').files[0] ? { name: document.querySelector('#token-file').files[0].name, size: document.querySelector('#token-file').files[0].size } : null, result: document.querySelector('#upload-result').textContent })`);
  return { uid, data };
});

await run("T19", async () => {
  await newPage(`${base}/a11y-modal?devtools_rerun2=${Date.now()}`, 10000);
  const opened = await evalJson(`() => { document.querySelector('#open-modal').click(); return { opened: true }; }`);
  const sequence = [];
  for (const key of ["Tab", "Tab", "Tab", "Shift+Tab"]) {
    await tool("press_key", { key });
    sequence.push(await evalJson(`() => ({ id: document.activeElement?.id || '', tag: document.activeElement?.tagName || '', text: document.activeElement?.textContent?.trim() || '' })`));
  }
  const attrs = await evalJson(`() => {
    const el = document.querySelector('#save-preferences');
    return { tag: el.tagName, role: el.getAttribute('role'), tabindex: el.getAttribute('tabindex'), hasKeydown: Boolean(el.onkeydown), inTrap: el.hasAttribute('data-trap-focus') };
  }`);
  const saved = await evalJson(`() => { document.querySelector('#save-preferences').click(); return { result: document.querySelector('#save-result').textContent }; }`);
  return { opened, sequence, attrs, saved };
});

await run("T20", async () => {
  await newPage(`${base}/flake?devtools_rerun2=${Date.now()}`, 10000);
  return evalJson(`async () => {
    document.querySelector('#run-checks').click();
    while (document.querySelectorAll('#flake-rows tr').length < 10) await new Promise(resolve => setTimeout(resolve, 100));
    return { summary: document.querySelector('#flake-summary').textContent, rows: Array.from(document.querySelectorAll('#flake-rows tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim())) };
  }`);
});

await run("R01", async () => {
  await newPage("https://github.com/microsoft/playwright", 45000);
  await newPage(`https://playwright.dev/docs/actionability?r01=devtools-rerun2-${Date.now()}`, 45000);
  return evalJson(`() => {
    const rows = Array.from(document.querySelectorAll('tr')).map(tr => Array.from(tr.cells).map(td => td.textContent.replace(/\\s+/g, ' ').trim()));
    return { url: location.href, title: document.title, h1: document.querySelector('h1')?.textContent || '', clickRow: rows.find(r => /locator\\.click/.test(r[0] || '')) };
  }`);
});

await run("R02", async () => evidence.T10c);

await run("R03", async () => {
  await newPage(`https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API?r03=devtools-rerun2-${Date.now()}`, 45000);
  return evalJson(`() => {
    const headings = Array.from(document.querySelectorAll('h2,h3,dt')).map(el => el.textContent.replace(/\\s+/g, ' ').trim());
    const idx = headings.findIndex(h => h === 'Interfaces');
    return { url: location.href, h1: document.querySelector('h1')?.textContent || '', interfaces: headings.slice(idx + 1, idx + 4), hasCompatibility: document.body.innerText.includes('Browser compatibility') };
  }`);
});

await run("R04", async () => {
  await newPage(`https://www.npmjs.com/package/@playwright/test?r04=devtools-rerun2-${Date.now()}`, 45000);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  return evalJson(`() => {
    const text = document.body.innerText;
    const after = (label) => (text.match(new RegExp(label + '\\\\n\\\\n([^\\\\n]+)')) || [])[1] || null;
    return { url: location.href, title: document.title, version: after('Version'), license: after('License'), weekly: after('Weekly Downloads'), repository: after('Repository'), head: text.slice(0, 1200) };
  }`);
});

await run("R05", async () => {
  await newPage(`https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi?r05=devtools-rerun2-${Date.now()}`, 60000);
  await new Promise((resolve) => setTimeout(resolve, 4000));
  return evalJson(`() => {
    const text = document.body.innerText;
    return { url: location.href, title: document.title, hasName: text.includes('React Developer Tools'), hasMeta: text.includes('Meta'), rating: (text.match(/\\b4\\.0\\b/) || [])[0] || null, ratings: (text.match(/1,633[^\\n]*评分/) || [])[0] || null, users: (text.match(/5,000,000[^\\n]*用户/) || [])[0] || null, button: text.includes('添加至 Chrome') ? '添加至 Chrome' : null, head: text.slice(0, 1600) };
  }`);
});

await run("R06", async () => {
  const initial = await readBadge(`https://ffffhx.github.io/garden-lab/post/agent/?r06_initial=devtools-rerun2-${Date.now()}`);
  const saved = await setBadge("REAL-SITE-2026");
  let custom;
  try {
    custom = await readBadge(`https://ffffhx.github.io/garden-lab/post/agent/?r06_custom=devtools-rerun2-${Date.now()}`);
  } catch (error) {
    custom = { error: error.message };
  }
  const restored = await setBadge("");
  const finalBadge = await readBadge(`${base}/?r06_restore=devtools-rerun2-${Date.now()}`);
  return { initial, saved, custom, restored, finalBadge };
});

await run("R07", async () => {
  await newPage(`https://www.npmjs.com/package/@playwright/test?r07=devtools-rerun2-${Date.now()}`, 45000);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const requests = await tool("list_network_requests", { includePreservedRequests: true });
  const line = requests
    .split("\n")
    .find((item) => item.includes("GET https://www.npmjs.com/package/@playwright/test") && item.includes("[200]")) || null;
  const reqid = line ? Number((line.match(/reqid=(\d+)/) || [])[1]) : undefined;
  const detail = reqid ? await tool("get_network_request", { reqid }) : "";
  const pageVersion = await evalJson(`() => ({ version: (document.body.innerText.match(/Version\\n\\n([^\\n]+)/) || [])[1] || null })`);
  return { line, reqid, detailHead: detail.slice(0, 1600), pageVersion };
});

await run("R08", async () => {
  return { verdict: "N-R", reason: "Chrome DevTools MCP 1.2.0 exposes network read tools but no request route/abort/block primitive in the listed tools." };
});

await run("R09", async () => {
  let navError = null;
  try {
    await newPage(`https://ffffhx.github.io/garden-lab/post/agent/?r09=devtools-rerun2-${Date.now()}`, 60000);
  } catch (error) {
    navError = error.message;
  }
  let perf = null;
  try {
    perf = await evalJson(`() => ({
      url: location.href,
      title: document.title,
      h1: document.querySelector('h1')?.textContent || '',
      entries: performance.getEntriesByType('resource').map(e => ({ url: e.name, type: e.initiatorType, duration: Math.round(e.duration), responseEnd: Math.round(e.responseEnd) })).sort((a, b) => b.duration - a.duration).slice(0, 10)
    })`);
  } catch (error) {
    perf = { error: error.message };
  }
  return { navError, perf };
});

await run("finalBadge", async () => {
  await setBadge("");
  return readBadge(`${base}/?final_badge=devtools-rerun2-${Date.now()}`);
});

await client.close();
fs.writeFileSync(path.join(outDir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, keys: Object.keys(evidence), evidencePath: path.join(outDir, "evidence.json") }));
