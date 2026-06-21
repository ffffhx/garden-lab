async (page) => {
  const context = page.context();
  const base = "http://localhost:4399";
  const extId = "jkmndkochpgaleoechlemhdhbikdecnf";
  const fixturePath = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt";
  const results = {};

  async function fresh(label) {
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.setDefaultNavigationTimeout(30000);
    p.__label = label;
    return p;
  }

  async function text(p, selector = "body") {
    return (await p.locator(selector).innerText()).replace(/\s+/g, " ").trim();
  }

  async function run(name, fn) {
    try {
      results[name] = await fn();
    } catch (error) {
      results[name] = { error: String(error && error.message ? error.message : error), stack: String(error && error.stack ? error.stack : "") };
    }
  }

  async function ensureLogin(p) {
    await p.goto(`${base}/login?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator("#email").fill("agent@bench.dev");
    await p.locator("#password").fill("bench-2026");
    await Promise.all([
      p.waitForURL(/\/dashboard/, { timeout: 10000 }),
      p.locator("button[type=submit]").click(),
    ]);
    await p.locator("#greeting").waitFor({ timeout: 10000 });
  }

  await run("cdpProof", async () => {
    const p = await fresh("proof");
    const url = `${base}/?pw_rerun2_proof=${Date.now()}`;
    await p.goto(url, { waitUntil: "domcontentloaded" });
    const title = await p.title();
    return { url, title };
  });

  await run("T01", async () => {
    const p = await fresh("T01");
    await ensureLogin(p);
    return { url: p.url(), greeting: await p.locator("#greeting").innerText() };
  });

  await run("T02", async () => {
    const p = await fresh("T02");
    await ensureLogin(p);
    const responsePromise = p.waitForResponse((res) => res.url().includes("/api/orders") && res.request().method() === "POST");
    await p.locator("#order-btn").click();
    const res = await responsePromise;
    const body = await res.json();
    await p.locator("#order-error:not([hidden])").waitFor();
    return { status: res.status(), body, visibleError: await p.locator("#order-error").innerText() };
  });

  await run("T03", async () => {
    const p = await fresh("T03");
    await p.goto(`${base}/slow?pw_rerun2=${Date.now()}`, { waitUntil: "load" });
    return await p.evaluate(() => {
      const resources = performance.getEntriesByType("resource")
        .filter((entry) => /blocking\.css|heavy\.js|hero\.svg/.test(entry.name))
        .map((entry) => ({
          name: entry.name,
          initiatorType: entry.initiatorType,
          startTime: Math.round(entry.startTime),
          duration: Math.round(entry.duration),
          responseEnd: Math.round(entry.responseEnd),
        }));
      return { resources, title: document.title, h1: document.querySelector("h1")?.textContent || "" };
    });
  });

  await run("T04", async () => {
    const p = await fresh("T04");
    await p.route("**/api/users", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ users: [] }),
      });
    });
    await p.goto(`${base}/users?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator(".empty-state").waitFor();
    const bodyText = await text(p);
    await p.unroute("**/api/users");
    return { hasEmptyState: bodyText.includes("暂无成员"), hasInvite: bodyText.includes("邀请成员"), bodyText };
  });

  await run("T05", async () => {
    const p = await fresh("T05");
    await p.goto(`${base}/livefeed?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: /加载更多/ }).click();
    await p.getByText(/LIVE-512/).waitFor({ timeout: 10000 });
    return await p.evaluate(() => ({
      itemCount: document.querySelectorAll("#feed li").length,
      bodyText: document.body.innerText,
    }));
  });

  await run("T06", async () => {
    const p = await fresh("T06");
    const productResponses = [];
    p.on("response", async (res) => {
      if (res.url().includes("/api/products")) {
        try {
          productResponses.push({ url: res.url(), status: res.status(), body: await res.json() });
        } catch {}
      }
    });
    await p.goto(`${base}/catalog?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator(".prod").nth(7).waitFor();
    await p.locator("#next-page").click();
    await p.waitForFunction(() => document.querySelectorAll(".prod").length === 12);
    const rows = await p.$$eval(".prod", (nodes) => nodes.map((node) => {
      const name = node.querySelector("strong")?.textContent?.trim();
      const stock = Number((node.textContent.match(/库存\s*(\d+)\s*件/) || [])[1]);
      const price = Number((node.querySelector(".pr i")?.textContent || "").replace(/[^\d.]/g, ""));
      return { name, price, stock };
    }));
    rows.sort((a, b) => b.price - a.price);
    return { total: rows.length, rows, mostExpensive: rows[0], responseCount: productResponses.length };
  });

  await run("T07", async () => {
    const p = await fresh("T07");
    await ensureLogin(p);
    return await p.evaluate(async () => fetch("/api/me").then((res) => res.json()));
  });

  await run("T08", async () => {
    const p = await fresh("T08");
    await ensureLogin(p);
    await p.locator("bench-widget").evaluate((el) => el.shadowRoot.querySelector("#claim").click());
    return await p.locator("bench-widget").evaluate((el) => el.shadowRoot.querySelector("#code").textContent);
  });

  await run("T10c", async () => {
    const p = await fresh("T10c");
    const url = `https://github.com/notifications?query=is%3Aunread&t10c=pw-rerun2-${Date.now()}`;
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(2500);
    return await p.evaluate(() => {
      const text = document.body.innerText;
      const rows = Array.from(document.querySelectorAll("a[href*='/notifications']"))
        .map((a) => a.textContent.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 8);
      return { url: location.href, title: document.title, inboxMatch: text.match(/Inbox\s*(\d+)/)?.[1] || null, textHead: text.slice(0, 1000), rows };
    });
  });

  async function setBadge(value) {
    const p = await fresh(`badge-${value || "default"}`);
    await p.goto(`chrome-extension://${extId}/options.html`, { waitUntil: "domcontentloaded" });
    await p.locator("#badge-text").fill(value);
    await p.locator("#save").click();
    await p.locator("#status").waitFor({ timeout: 5000 });
    return { status: await p.locator("#status").innerText(), url: p.url() };
  }

  async function readBadge(targetUrl) {
    const p = await fresh("read-badge");
    await p.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForSelector("#bench-ext-badge", { timeout: 10000 });
    return await p.locator("#bench-ext-badge").innerText();
  }

  await run("T11", async () => {
    const saved = await setBadge("HELLO-2026");
    const badge = await readBadge(`${base}/?t11=pw-rerun2-${Date.now()}`);
    const restored = await setBadge("");
    const finalBadge = await readBadge(`${base}/?t11_restore=pw-rerun2-${Date.now()}`);
    return { saved, badge, restored, finalBadge };
  });

  await run("T12", async () => {
    const p = await fresh("T12");
    const consoleErrors = [];
    p.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await p.goto(`${base}/debug-console?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator("#apply-coupon").click();
    await p.waitForTimeout(500);
    const sourceMap = await p.goto(`${base}/assets/debug-bundle.js.map`).then((res) => res.json());
    const source = sourceMap.sources.find((s) => s.includes("coupon.ts"));
    const sourceText = sourceMap.sourcesContent[sourceMap.sources.indexOf(source)];
    return { consoleErrors, source, functionName: "applySelectedCoupon", field: "cartState.selectedCoupon.couponCode", expectedGuard: "if (!cartState.selectedCoupon) return null;", sourceSnippet: sourceText };
  });

  await run("T13", async () => {
    const p = await fresh("T13");
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`${base}/layout-mobile?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    const hit = await p.evaluate(() => {
      const button = document.querySelector("#pay-button");
      const bar = document.querySelector(".mobile-support-bar");
      const br = button.getBoundingClientRect();
      const hitEl = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
      const csButton = getComputedStyle(button.closest(".checkout-actions"));
      const csBar = getComputedStyle(bar);
      return {
        buttonRect: { top: br.top, bottom: br.bottom, left: br.left, right: br.right, width: br.width, height: br.height },
        hitText: hitEl?.textContent?.replace(/\s+/g, " ").trim(),
        hitTag: hitEl?.tagName,
        barSelector: ".mobile-support-bar[data-bug=\"overlaps-pay-button\"]",
        actionsZ: csButton.zIndex,
        barZ: csBar.zIndex,
        barHeight: csBar.height,
      };
    });
    await p.locator(".mobile-support-bar").evaluate((el) => { el.style.pointerEvents = "none"; });
    await p.locator("#pay-button").click();
    const code = await p.locator("#pay-result").innerText();
    return { hit, code };
  });

  await run("T14", async () => {
    const p = await fresh("T14");
    const errors = [];
    p.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await p.goto(`${base}/hydration?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.getByText(/HYD-908/).waitFor();
    return await p.evaluate(() => ({ store: window.__BENCH_STORE__, text: document.body.innerText }));
  });

  await run("T15", async () => {
    const p = await fresh("T15");
    const requests = [];
    p.on("response", (res) => {
      if (res.url().includes("/api/realtime-events")) requests.push({ url: res.url(), status: res.status(), contentType: res.headers()["content-type"] || "" });
    });
    await p.goto(`${base}/realtime?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: /开始接收/ }).click();
    await p.getByText(/STREAM-721/).waitFor({ timeout: 10000 });
    return { text: await text(p), requests };
  });

  await run("T16", async () => {
    const p = await fresh("T16");
    await p.goto(`${base}/cache?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.getByText(/STALE-CACHE-17/).waitFor({ timeout: 10000 });
    return await p.evaluate(async () => ({
      controller: navigator.serviceWorker.controller?.scriptURL || null,
      text: document.body.innerText,
      live: await fetch("/api/settings?live=1").then((res) => res.json()),
    }));
  });

  await run("T17", async () => {
    const p = await fresh("T17");
    await p.goto(`${base}/iframe-auth?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    const frame = p.frameLocator("iframe");
    await frame.getByRole("button", { name: /确认授权/ }).click();
    await p.getByText(/OAUTH-314/).waitFor({ timeout: 10000 });
    return { text: await text(p), frameText: await frame.locator("body").innerText() };
  });

  await run("T18", async () => {
    const p = await fresh("T18");
    await p.goto(`${base}/input-lab?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator("#token-file").setInputFiles(fixturePath);
    await p.getByText(/UPLOAD-448/).waitFor({ timeout: 10000 });
    return { result: await p.locator("#upload-result").innerText() };
  });

  await run("T19", async () => {
    const p = await fresh("T19");
    await p.goto(`${base}/a11y-modal?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator("#open-modal").click();
    const sequence = [];
    for (const key of ["Tab", "Tab", "Tab", "Shift+Tab"]) {
      await p.keyboard.press(key);
      sequence.push(await p.evaluate((pressed) => {
        const a = document.activeElement;
        return { key: pressed, id: a?.id || "", tag: a?.tagName || "", text: a?.textContent?.trim() || "" };
      }, key));
    }
    const attrs = await p.locator("#save-preferences").evaluate((el) => ({
      tag: el.tagName,
      role: el.getAttribute("role"),
      tabindex: el.getAttribute("tabindex"),
      onkeydown: Boolean(el.onkeydown),
      inTrap: el.hasAttribute("data-trap-focus"),
    }));
    await p.locator("#save-preferences").click();
    return { sequence, attrs, result: await p.locator("#save-result").innerText() };
  });

  await run("T20", async () => {
    const p = await fresh("T20");
    await p.goto(`${base}/flake?pw_rerun2=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator("#run-checks").click();
    await p.getByText(/FLAKE-307/).waitFor({ timeout: 15000 });
    const rows = await p.$$eval("#flake-rows tr", (nodes) => nodes.map((tr) => Array.from(tr.children).map((td) => td.textContent.trim())));
    return { summary: await p.locator("#flake-summary").innerText(), rows };
  });

  await run("R01", async () => {
    const p = await fresh("R01");
    await p.goto("https://github.com/microsoft/playwright", { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.goto(`https://playwright.dev/docs/actionability?r01=pw-rerun2-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.getByRole("heading", { name: /Auto-waiting|Actionability/ }).waitFor({ timeout: 20000 });
    return await p.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr")).map((tr) => Array.from(tr.cells).map((td) => td.textContent.replace(/\s+/g, " ").trim()));
      const clickRow = rows.find((r) => /locator\.click/.test(r[0] || ""));
      return { url: location.href, title: document.title, h1: document.querySelector("h1")?.textContent || "", clickRow };
    });
  });

  await run("R02", async () => results.T10c);

  await run("R03", async () => {
    const p = await fresh("R03");
    await p.goto(`https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API?r03=pw-rerun2-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.getByRole("heading", { name: "Fetch API" }).waitFor({ timeout: 20000 });
    return await p.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h2,h3,dt")).map((el) => el.textContent.replace(/\s+/g, " ").trim());
      const interfacesIndex = headings.findIndex((h) => h === "Interfaces");
      return {
        url: location.href,
        h1: document.querySelector("h1")?.textContent || "",
        interfaces: headings.slice(interfacesIndex + 1, interfacesIndex + 4),
        hasCompatibility: document.body.innerText.includes("Browser compatibility"),
      };
    });
  });

  await run("R04", async () => {
    const p = await fresh("R04");
    await p.goto(`https://www.npmjs.com/package/@playwright/test?r04=pw-rerun2-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(3000);
    return await p.evaluate(() => {
      const text = document.body.innerText;
      const matchAfter = (label) => {
        const m = text.match(new RegExp(`${label}\\n\\n([^\\n]+)`));
        return m ? m[1].trim() : null;
      };
      return {
        url: location.href,
        title: document.title,
        version: matchAfter("Version"),
        license: matchAfter("License"),
        weekly: matchAfter("Weekly Downloads"),
        repository: matchAfter("Repository"),
        textHead: text.slice(0, 1200),
      };
    });
  });

  await run("R05", async () => {
    const p = await fresh("R05");
    const url = `https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi?r05=pw-rerun2-${Date.now()}`;
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(5000);
    return await p.evaluate(() => {
      const text = document.body.innerText;
      return {
        url: location.href,
        title: document.title,
        hasName: text.includes("React Developer Tools"),
        hasMeta: text.includes("Meta"),
        rating: text.match(/\b4\.0\b/)?.[0] || null,
        ratings: text.match(/1,633[^\n]*评分/)?.[0] || null,
        users: text.match(/5,000,000[^\n]*用户/)?.[0] || null,
        button: text.includes("添加至 Chrome") ? "添加至 Chrome" : null,
        textHead: text.slice(0, 1600),
      };
    });
  });

  await run("R06", async () => {
    const initial = await readBadge(`https://ffffhx.github.io/garden-lab/post/agent/?r06_initial=pw-rerun2-${Date.now()}`);
    const saved = await setBadge("REAL-SITE-2026");
    const custom = await readBadge(`https://ffffhx.github.io/garden-lab/post/agent/?r06_custom=pw-rerun2-${Date.now()}`);
    const restored = await setBadge("");
    const finalBadge = await readBadge(`https://ffffhx.github.io/garden-lab/post/agent/?r06_restore=pw-rerun2-${Date.now()}`);
    return { initial, saved, custom, restored, finalBadge };
  });

  await run("R07", async () => {
    const p = await fresh("R07");
    const responses = [];
    p.on("response", async (res) => {
      if (res.url().includes("www.npmjs.com/package/@playwright/test")) {
        const headers = res.headers();
        let bodyHead = "";
        try { bodyHead = (await res.text()).slice(0, 1000); } catch (error) { bodyHead = `ERROR: ${error.message}`; }
        responses.push({ url: res.url(), status: res.status(), contentType: headers["content-type"] || "", bodyHead });
      }
    });
    await p.goto(`https://www.npmjs.com/package/@playwright/test?r07=pw-rerun2-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(3000);
    const pageVersion = await p.evaluate(() => {
      const text = document.body.innerText;
      return (text.match(/Version\n\n([^\n]+)/) || [])[1] || null;
    });
    return { pageVersion, responses };
  });

  await run("R08", async () => {
    const p = await fresh("R08");
    const aborted = [];
    await p.route(/.*\.(png|jpg|jpeg|gif|svg|webp)(\?.*)?$/i, async (route) => {
      aborted.push(route.request().url());
      await route.abort();
    });
    await p.goto(`https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API?r08=pw-rerun2-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(3000);
    const h1 = await p.locator("h1").first().innerText();
    await p.unroute(/.*\.(png|jpg|jpeg|gif|svg|webp)(\?.*)?$/i);
    return { h1, abortedCount: aborted.length, aborted: aborted.slice(0, 10), url: p.url() };
  });

  await run("R09", async () => {
    const p = await fresh("R09");
    const url = `https://ffffhx.github.io/garden-lab/post/agent/?r09=pw-rerun2-${Date.now()}`;
    let navError = null;
    try {
      await p.goto(url, { waitUntil: "load", timeout: 60000 });
    } catch (error) {
      navError = error.message;
    }
    await p.waitForTimeout(3000);
    const perf = await p.evaluate(() => {
      const entries = performance.getEntriesByType("resource")
        .map((entry) => ({ url: entry.name, type: entry.initiatorType, duration: Math.round(entry.duration), responseEnd: Math.round(entry.responseEnd) }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 8);
      return { url: location.href, title: document.title, h1: document.querySelector("h1")?.textContent || "", entries };
    });
    return { navError, perf };
  });

  await run("finalBadge", async () => {
    await setBadge("");
    return await readBadge(`${base}/?final_badge=pw-rerun2-${Date.now()}`);
  });

  return JSON.stringify(results);
}
