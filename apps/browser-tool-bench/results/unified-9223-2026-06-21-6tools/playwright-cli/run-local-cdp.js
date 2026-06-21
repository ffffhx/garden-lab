async page => {
  const base = "http://localhost:4399";
  const evidenceDir = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/results/unified-9223-2026-06-21-6tools/playwright-cli/evidence";
  const uploadFile = "/Users/bytedance/Code/garden-lab/apps/browser-tool-bench/fixtures/upload-token.txt";
  const context = page.context();
  const results = {};
  const pages = [];

  async function newPage(path, options = {}) {
    const p = await context.newPage();
    pages.push(p);
    if (options.viewport) await p.setViewportSize(options.viewport);
    if (path) await p.goto(path.startsWith("http") ? path : `${base}${path}`, { waitUntil: options.waitUntil || "domcontentloaded" });
    return p;
  }

  async function login(p) {
    await p.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
    await p.fill("#email", "agent@bench.dev");
    await p.fill("#password", "bench-2026");
    await Promise.all([
      p.waitForURL("**/dashboard", { timeout: 10000 }),
      p.click('button[type="submit"]'),
    ]);
    await p.locator("text=BENCH-7341").waitFor({ timeout: 10000 });
  }

  async function text(p, selector) {
    return (await p.locator(selector).textContent()).trim();
  }

  // T01
  {
    const p = await newPage();
    await login(p);
    const greeting = await text(p, "#greeting");
    await p.screenshot({ path: `${evidenceDir}/T01-dashboard.png`, fullPage: true });
    results.T01 = { greeting, answer: "BENCH-7341", evidence: "T01-dashboard.png" };
  }

  // T02
  {
    const p = await newPage();
    await login(p);
    const responsePromise = p.waitForResponse((r) => r.url().endsWith("/api/orders") && r.request().method() === "POST");
    await p.click("#order-btn");
    const response = await responsePromise;
    const body = await response.json();
    await p.locator("#order-error:not([hidden])").waitFor({ timeout: 5000 });
    const pageError = await text(p, "#order-error");
    await p.screenshot({ path: `${evidenceDir}/T02-order-failure.png`, fullPage: true });
    results.T02 = {
      request: "POST /api/orders",
      status: response.status(),
      body,
      pageError,
      evidence: "T02-order-failure.png",
    };
  }

  // T03
  {
    const p = await newPage();
    await p.addInitScript(() => {
      window.__benchPerf = { lcp: [], longtasks: [] };
      try {
        new PerformanceObserver((list) => {
          window.__benchPerf.lcp.push(...list.getEntries().map((entry) => ({
            name: entry.name,
            startTime: entry.startTime,
            renderTime: entry.renderTime,
            loadTime: entry.loadTime,
            size: entry.size,
            element: entry.element ? entry.element.tagName : null,
          })));
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          window.__benchPerf.longtasks.push(...list.getEntries().map((entry) => ({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          })));
        }).observe({ type: "longtask", buffered: true });
      } catch (error) {
        window.__benchPerf.error = String(error);
      }
    });
    await p.goto(`${base}/slow`, { waitUntil: "load" });
    await p.waitForTimeout(800);
    const perf = await p.evaluate(() => {
      const resources = performance.getEntriesByType("resource")
        .filter((entry) => entry.name.includes("/assets/"))
        .map((entry) => ({
          name: new URL(entry.name).pathname,
          duration: Math.round(entry.duration),
          responseEnd: Math.round(entry.responseEnd),
          transferSize: entry.transferSize,
          renderBlockingStatus: entry.renderBlockingStatus || "",
        }));
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        resources,
        nav: nav ? { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) } : null,
        observed: window.__benchPerf,
      };
    });
    results.T03 = { answer: "blocking.css is the LCP-critical blocker; heavy.js adds an ~800ms long task; hero.svg is slow but parallel/non-blocking.", perf };
  }

  // T04
  {
    const p = await newPage();
    await p.route("**/api/users", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: JSON.stringify({ users: [] }) });
    });
    await p.goto(`${base}/users`, { waitUntil: "domcontentloaded" });
    await p.locator("text=暂无成员，去邀请第一位伙伴吧").waitFor({ timeout: 5000 });
    const emptyText = await p.locator(".empty-state").innerText();
    await p.screenshot({ path: `${evidenceDir}/T04-empty-users.png`, fullPage: true });
    await p.unroute("**/api/users");
    results.T04 = { emptyText, mockedBody: { users: [] }, evidence: "T04-empty-users.png" };
  }

  // T05
  {
    const p = await newPage("/livefeed");
    await p.locator("#load-more").waitFor({ state: "visible", timeout: 6000 });
    await p.click("#load-more");
    await p.locator("text=LIVE-512").waitFor({ timeout: 6000 });
    const items = await p.locator("#feed li").allTextContents();
    results.T05 = { count: items.length, last: items.at(-1), status: await text(p, "#status") };
  }

  // T06
  {
    const p = await newPage();
    const firstResponse = p.waitForResponse((r) => r.url().includes("/api/products?page=1"));
    await p.goto(`${base}/catalog`, { waitUntil: "domcontentloaded" });
    const first = await (await firstResponse).json();
    const secondResponse = p.waitForResponse((r) => r.url().includes("/api/products?page=2"));
    await p.click("#next-page");
    const second = await (await secondResponse).json();
    const products = [...first.items, ...second.items].sort((a, b) => b.price - a.price);
    results.T06 = { count: products.length, products, mostExpensive: products[0] };
  }

  // T07
  {
    const p = await newPage();
    await login(p);
    const me = await p.evaluate(async () => {
      const response = await fetch("/api/me");
      return { status: response.status, body: await response.json() };
    });
    results.T07 = { status: me.status, plan: me.body.plan, bodyKeys: Object.keys(me.body) };
  }

  // T08
  {
    const p = await newPage();
    await login(p);
    await p.getByRole("button", { name: "领取今日奖励" }).click();
    await p.locator("text=SHADOW-99").waitFor({ timeout: 5000 });
    const code = await p.getByText(/兑换码/).textContent();
    await p.screenshot({ path: `${evidenceDir}/T08-shadow-reward.png`, fullPage: true });
    results.T08 = { code: code.trim(), evidence: "T08-shadow-reward.png" };
  }

  // T12
  {
    const p = await newPage("/debug-console");
    const consoleMessages = [];
    p.on("console", async (msg) => {
      const args = [];
      for (const arg of msg.args()) {
        try { args.push(await arg.jsonValue()); } catch { args.push(String(arg)); }
      }
      consoleMessages.push({ type: msg.type(), text: msg.text(), args });
    });
    await p.click("#apply-coupon");
    await p.locator("#coupon-error:not([hidden])").waitFor({ timeout: 5000 });
    const sourceMap = await p.evaluate(async () => {
      const response = await fetch("/assets/debug-bundle.js.map");
      return response.json();
    });
    const couponSource = sourceMap.sourcesContent[sourceMap.sources.indexOf("webpack://bench/src/cart/coupon.ts")];
    await p.screenshot({ path: `${evidenceDir}/T12-debug-console.png`, fullPage: true });
    results.T12 = {
      pageError: await text(p, "#coupon-error"),
      consoleMessages,
      source: sourceMap.sources[0],
      functionName: "applySelectedCoupon",
      field: "cartState.selectedCoupon.couponCode",
      guardEvidence: couponSource.match(/Expected guard: ([^;]+;)/)?.[1] || null,
      evidence: "T12-debug-console.png",
    };
  }

  // T13
  {
    const p = await newPage("/layout-mobile", { viewport: { width: 390, height: 844 } });
    let clickError = "";
    try {
      await p.click("#pay-button", { timeout: 1500 });
    } catch (error) {
      clickError = String(error).split("\n")[0];
    }
    const diagnosis = await p.evaluate(() => {
      const button = document.querySelector("#pay-button");
      const overlay = document.querySelector(".mobile-support-bar");
      const buttonBox = button.getBoundingClientRect();
      const hit = document.elementFromPoint(buttonBox.left + buttonBox.width / 2, buttonBox.top + buttonBox.height / 2);
      const overlayStyle = getComputedStyle(overlay);
      const actionsStyle = getComputedStyle(document.querySelector(".checkout-actions"));
      return {
        hitSelector: hit ? `${hit.tagName.toLowerCase()}${hit.className ? "." + String(hit.className).trim().replace(/\s+/g, ".") : ""}` : null,
        overlaySelector: ".mobile-support-bar[data-bug=\"overlaps-pay-button\"]",
        overlay: { position: overlayStyle.position, height: overlayStyle.height, bottom: overlayStyle.bottom, zIndex: overlayStyle.zIndex },
        actions: { position: actionsStyle.position, bottom: actionsStyle.bottom, zIndex: actionsStyle.zIndex },
      };
    });
    await p.evaluate(() => document.querySelector("#pay-button").click());
    await p.locator("text=MOBILE-39").waitFor({ timeout: 5000 });
    const result = await text(p, "#pay-result");
    await p.screenshot({ path: `${evidenceDir}/T13-mobile-overlay.png`, fullPage: true });
    results.T13 = { clickError, diagnosis, result, evidence: "T13-mobile-overlay.png" };
  }

  // T14
  {
    const p = await newPage();
    const consoleMessages = [];
    p.on("console", async (msg) => {
      const args = [];
      for (const arg of msg.args()) {
        try { args.push(await arg.jsonValue()); } catch { args.push(String(arg)); }
      }
      consoleMessages.push({ type: msg.type(), text: msg.text(), args });
    });
    await p.goto(`${base}/hydration`, { waitUntil: "domcontentloaded" });
    const initial = await p.evaluate(() => ({
      component: document.querySelector("#task-card").dataset.component,
      pendingText: document.querySelector("#pending-count").textContent,
      pendingSSR: document.querySelector("#pending-count").dataset.ssrValue,
      planText: document.querySelector("#plan-name").textContent,
      planSSR: document.querySelector("#plan-name").dataset.ssrValue,
      store: window.__BENCH_STORE__,
    }));
    await p.locator("text=客户端已接管").waitFor({ timeout: 3000 });
    const final = await p.evaluate(() => ({
      pendingText: document.querySelector("#pending-count").textContent,
      planText: document.querySelector("#plan-name").textContent,
      status: document.querySelector("#hydration-status").textContent,
    }));
    await p.screenshot({ path: `${evidenceDir}/T14-hydration.png`, fullPage: true });
    results.T14 = { initial, final, consoleMessages, evidence: "T14-hydration.png" };
  }

  // T15
  {
    const p = await newPage("/realtime");
    const sse = p.waitForResponse((r) => r.url().includes("/api/realtime-events"));
    await p.click("#start-stream");
    const response = await sse;
    await p.locator("#stream-status", { hasText: "STREAM-721" }).waitFor({ timeout: 7000 });
    const events = await p.locator("#events li").allTextContents();
    await p.screenshot({ path: `${evidenceDir}/T15-realtime.png`, fullPage: true });
    results.T15 = { request: { url: response.url(), status: response.status(), contentType: response.headers()["content-type"] }, count: events.length, events, status: await text(p, "#stream-status"), evidence: "T15-realtime.png" };
  }

  // T16
  {
    const p = await newPage();
    await p.goto(`${base}/cache`, { waitUntil: "domcontentloaded" });
    await p.locator("text=Service Worker 已控制页面").waitFor({ timeout: 10000 });
    await p.locator("text=STALE-CACHE-17").waitFor({ timeout: 5000 });
    const state = await p.evaluate(async () => {
      const shown = {
        theme: document.querySelector("#theme").textContent,
        release: document.querySelector("#release").textContent,
        featureFlag: document.querySelector("#flag").textContent,
      };
      const liveResponse = await fetch("/api/settings?live=1");
      const live = await liveResponse.json();
      const registrations = await navigator.serviceWorker.getRegistrations();
      return {
        shown,
        live,
        controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
        registrations: registrations.map((registration) => ({
          scope: registration.scope,
          active: registration.active && registration.active.scriptURL,
        })),
      };
    });
    await p.screenshot({ path: `${evidenceDir}/T16-cache.png`, fullPage: true });
    results.T16 = { state, fix: "Update/unregister the Service Worker or fix its fetch handler cache strategy, then activate the new worker.", evidence: "T16-cache.png" };
  }

  // T17
  {
    const p = await newPage("/iframe-auth");
    await p.frameLocator("#auth-frame").getByRole("button", { name: "确认授权" }).click();
    await p.locator("text=OAUTH-314").waitFor({ timeout: 5000 });
    const result = await text(p, "#auth-result");
    await p.screenshot({ path: `${evidenceDir}/T17-iframe-auth.png`, fullPage: true });
    results.T17 = { result, evidence: "T17-iframe-auth.png" };
  }

  // T18
  {
    const p = await newPage("/input-lab");
    await p.locator("#token-file").setInputFiles(uploadFile);
    await p.locator("text=UPLOAD-448").waitFor({ timeout: 5000 });
    const result = await text(p, "#upload-result");
    await p.screenshot({ path: `${evidenceDir}/T18-upload.png`, fullPage: true });
    results.T18 = { result, file: uploadFile, evidence: "T18-upload.png" };
  }

  // T19
  {
    const p = await newPage("/a11y-modal");
    await p.evaluate(() => document.querySelector("#open-modal").click());
    const focusTrace = [];
    for (const key of ["Tab", "Tab", "Shift+Tab", "Enter"]) {
      await p.keyboard.press(key);
      focusTrace.push(await p.evaluate(() => document.activeElement && {
        id: document.activeElement.id,
        tag: document.activeElement.tagName,
        role: document.activeElement.getAttribute("role"),
        text: document.activeElement.textContent,
      }));
    }
    const saveMeta = await p.evaluate(() => {
      const el = document.querySelector("#save-preferences");
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        tabindex: el.getAttribute("tabindex"),
        hasDataTrapFocus: el.hasAttribute("data-trap-focus"),
        className: el.className,
      };
    });
    await p.click("#save-preferences");
    await p.locator("text=A11Y-204").waitFor({ timeout: 5000 });
    const result = await text(p, "#save-result");
    await p.screenshot({ path: `${evidenceDir}/T19-a11y-modal.png`, fullPage: true });
    results.T19 = { focusTrace, saveMeta, result, evidence: "T19-a11y-modal.png" };
  }

  // T20
  {
    const p = await newPage("/flake");
    await p.click("#run-checks");
    await p.locator("#flake-rows tr").nth(9).waitFor({ timeout: 10000 });
    await p.locator("#flake-summary", { hasText: "通过 7/10" }).waitFor({ timeout: 10000 });
    const summary = await text(p, "#flake-summary");
    const rows = await p.locator("#flake-rows tr").evaluateAll((trs) => trs.map((tr) => {
      const tds = Array.from(tr.querySelectorAll("td")).map((td) => td.textContent);
      return { run: Number(tds[0]), result: tds[1], code: tds[2] };
    }));
    await p.screenshot({ path: `${evidenceDir}/T20-flake.png`, fullPage: true });
    results.T20 = { summary, rows, evidence: "T20-flake.png" };
  }

  for (const p of pages) {
    if (!p.isClosed()) {
      try { await p.close(); } catch {}
    }
  }
  return results;
}
