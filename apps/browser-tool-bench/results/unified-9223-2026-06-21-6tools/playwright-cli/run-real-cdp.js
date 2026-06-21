async page => {
  const evidenceDir = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools/playwright-cli/evidence";
  const context = page.context();
  const results = {};
  const pages = [];
  const stamp = "pw-real-1781983300001";

  async function newPage() {
    const p = await context.newPage();
    pages.push(p);
    p.setDefaultTimeout(20000);
    p.setDefaultNavigationTimeout(60000);
    return p;
  }

  async function run(name, fn) {
    try {
      results[name] = await fn();
    } catch (error) {
      results[name] = { error: String(error), stack: error && error.stack ? String(error.stack).slice(0, 1500) : "" };
    }
  }

  await run("R01", async () => {
    const p = await newPage();
    await p.goto("https://github.com/microsoft/playwright", { waitUntil: "domcontentloaded" });
    const startTitle = await p.title();
    await p.goto("https://playwright.dev/docs/actionability", { waitUntil: "domcontentloaded" });
    await p.locator("h1").waitFor({ timeout: 20000 });
    const data = await p.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr")).map((tr) =>
        Array.from(tr.querySelectorAll("th,td")).map((td) => td.textContent.trim().replace(/\s+/g, " "))
      );
      const clickRow = rows.find((row) => row.some((cell) => /locator\.click/i.test(cell)));
      return {
        title: document.querySelector("h1")?.textContent?.trim() || document.title,
        url: location.href,
        clickRow,
        bodySnippet: document.body.innerText.slice(0, 2500),
      };
    });
    await p.screenshot({ path: `${evidenceDir}/R01-actionability.png`, fullPage: true });
    return { startTitle, ...data, evidence: "R01-actionability.png" };
  });

  await run("R03", async () => {
    const p = await newPage();
    await p.goto("https://developer.mozilla.org/en-US/search?q=Fetch%20API", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    const searchHref = await p.evaluate(() => {
      const link = Array.from(document.querySelectorAll("a[href]")).find((a) => a.href.includes("/docs/Web/API/Fetch_API"));
      return link ? link.href : "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API";
    });
    await p.goto(searchHref, { waitUntil: "domcontentloaded" });
    await p.locator("h1").waitFor({ timeout: 20000 });
    const data = await p.evaluate(() => {
      const body = document.body.innerText;
      const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
      const interfacesIndex = lines.findIndex((line) => /^Interfaces$/i.test(line));
      const interfaces = [];
      if (interfacesIndex >= 0) {
        for (const line of lines.slice(interfacesIndex + 1)) {
          if (/^(Examples|Specifications|Browser compatibility|See also|Concepts|Related pages)$/i.test(line)) break;
          if (/^[A-Z][A-Za-z0-9]+$/.test(line) && !interfaces.includes(line)) interfaces.push(line);
          if (interfaces.length >= 5) break;
        }
      }
      return {
        title: document.querySelector("h1")?.textContent?.trim() || document.title,
        url: location.href,
        interfaces: interfaces.slice(0, 3),
        baselineText: lines.find((line) => /Baseline|Widely available|Browser compatibility/i.test(line)) || "",
        bodySnippet: body.slice(0, 3000),
      };
    });
    await p.screenshot({ path: `${evidenceDir}/R03-mdn-fetch.png`, fullPage: true });
    return { searchHref, ...data, evidence: "R03-mdn-fetch.png" };
  });

  await run("R04", async () => {
    const p = await newPage();
    await p.goto(`https://www.npmjs.com/package/@playwright/test?r04=${stamp}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(5000);
    const data = await p.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
      const findAfter = (label) => {
        const i = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
        return i >= 0 ? lines[i + 1] || "" : "";
      };
      const version = (text.match(/@playwright\/test\s+([0-9]+\.[0-9]+\.[0-9][^\s]*)/) || [])[1] || findAfter("Version") || "";
      const license = findAfter("License") || (text.match(/\bApache-2\.0\b/) || [])[0] || "";
      const weeklyDownloads = findAfter("Weekly Downloads") || findAfter("Downloads") || "";
      const unpackedSize = findAfter("Unpacked Size") || "";
      const repo = Array.from(document.querySelectorAll("a[href]")).map((a) => a.href).find((href) => href.includes("github.com/microsoft/playwright")) || "";
      return { url: location.href, title: document.title, version, license, weeklyDownloads, unpackedSize, repo, bodySnippet: text.slice(0, 3000) };
    });
    await p.screenshot({ path: `${evidenceDir}/R04-npm-package.png`, fullPage: true });
    return { ...data, evidence: "R04-npm-package.png" };
  });

  await run("R05", async () => {
    const p = await newPage();
    const url = `https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi?r05=${stamp}`;
    await p.goto(url, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(8000);
    const data = await p.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
      const buttons = Array.from(document.querySelectorAll("button")).map((b) => b.innerText.trim()).filter(Boolean);
      const publisherLine = lines.find((line) => /^Offered by|提供方|开发者|Publisher/i.test(line)) || "";
      const ratingLine = lines.find((line) => /[0-9.]+\s*(star|星)|ratings|评分|users|用户/i.test(line)) || "";
      return {
        url: location.href,
        title: document.title,
        id: "fmkadmapgofadopljbjfkapdkoienihi",
        name: lines.find((line) => /React Developer Tools/i.test(line)) || document.title,
        publisherLine,
        ratingOrUsers: ratingLine,
        primaryButtons: buttons.slice(0, 8),
        bodySnippet: text.slice(0, 3500),
      };
    });
    await p.screenshot({ path: `${evidenceDir}/R05-webstore.png`, fullPage: true });
    return { ...data, evidence: "R05-webstore.png" };
  });

  await run("R07", async () => {
    const p = await newPage();
    const jsonResponses = [];
    p.on("response", async (response) => {
      const contentType = response.headers()["content-type"] || "";
      if (!/json|html|javascript/.test(contentType)) return;
      const url = response.url();
      if (!url.includes("npmjs.com") && !url.includes("replicate.npmjs.com") && !url.includes("registry.npmjs.org")) return;
      try {
        const body = await response.text();
        if (body.includes("@playwright/test") && body.includes("version")) {
          jsonResponses.push({ url, status: response.status(), contentType, body: body.slice(0, 6000) });
        }
      } catch {}
    });
    await p.goto(`https://www.npmjs.com/package/@playwright/test?r07=${stamp}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(7000);
    const pageVersion = await p.evaluate(() => {
      const text = document.body.innerText;
      return (text.match(/@playwright\/test\s+([0-9]+\.[0-9]+\.[0-9][^\s]*)/) || [])[1] || "";
    });
    const picked = jsonResponses.find((item) => item.body.includes('"name"') || item.body.includes("&quot;name&quot;")) || jsonResponses[0] || null;
    let bodyPackage = null;
    if (picked) {
      const nameMatch = picked.body.match(/"name"\s*:\s*"(@playwright\/test)"/) || picked.body.match(/&quot;name&quot;\s*:\s*&quot;(@playwright\/test)&quot;/);
      const versionMatch = picked.body.match(/"version"\s*:\s*"([^"]+)"/) || picked.body.match(/&quot;version&quot;\s*:\s*&quot;([^&]+)&quot;/);
      bodyPackage = { name: nameMatch && nameMatch[1], version: versionMatch && versionMatch[1] };
    }
    await p.screenshot({ path: `${evidenceDir}/R07-npm-network.png`, fullPage: true });
    return { finalUrl: p.url(), pageVersion, picked: picked && { url: picked.url, status: picked.status, contentType: picked.contentType, bodyPackage, bodySnippet: picked.body.slice(0, 1200) }, capturedCount: jsonResponses.length, evidence: "R07-npm-network.png" };
  });

  await run("R08", async () => {
    const p = await newPage();
    const blocked = [];
    await p.route("**/*", async (route) => {
      const request = route.request();
      const url = request.url();
      if (request.resourceType() === "image" || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)) {
        blocked.push({ url, resourceType: request.resourceType(), method: "route.abort" });
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await p.goto(`https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API?r08=${stamp}`, { waitUntil: "domcontentloaded" });
    await p.locator("h1").waitFor({ timeout: 20000 });
    await p.waitForTimeout(2000);
    const data = await p.evaluate(() => ({
      title: document.querySelector("h1")?.textContent?.trim() || document.title,
      url: location.href,
      bodyStart: document.body.innerText.slice(0, 1200),
    }));
    await p.screenshot({ path: `${evidenceDir}/R08-mdn-block-images.png`, fullPage: true });
    return { ...data, blocked: blocked.slice(0, 5), evidence: "R08-mdn-block-images.png" };
  });

  await run("R09", async () => {
    const p = await newPage();
    const finished = [];
    p.on("requestfinished", async (request) => {
      try {
        const timing = request.timing();
        const response = await request.response();
        const duration = timing.responseEnd >= 0 ? Math.round(timing.responseEnd - timing.startTime) : null;
        finished.push({ url: request.url(), resourceType: request.resourceType(), duration, timing, status: response && response.status() });
      } catch {}
    });
    await p.goto(`https://ffffhx.github.io/garden-lab/post/agent/?r09=${stamp}`, { waitUntil: "load" });
    await p.waitForTimeout(3000);
    const perf = await p.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const lcp = performance.getEntriesByType("largest-contentful-paint").at(-1);
      return {
        finalUrl: location.href,
        title: document.title,
        h1: document.querySelector("h1")?.textContent?.trim() || "",
        nav: nav ? { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) } : null,
        lcp: lcp ? { startTime: Math.round(lcp.startTime), element: lcp.element && lcp.element.tagName } : null,
        resources: performance.getEntriesByType("resource").map((entry) => ({ name: entry.name, duration: Math.round(entry.duration), initiatorType: entry.initiatorType })).sort((a, b) => b.duration - a.duration).slice(0, 10),
      };
    });
    const top = finished.filter((item) => item.duration !== null).sort((a, b) => b.duration - a.duration).slice(0, 8);
    await p.screenshot({ path: `${evidenceDir}/R09-garden-performance.png`, fullPage: true });
    return { ...perf, topRequests: top, evidence: "R09-garden-performance.png" };
  });

  for (const p of pages) {
    if (!p.isClosed()) {
      try { await p.close(); } catch {}
    }
  }
  return results;
}
