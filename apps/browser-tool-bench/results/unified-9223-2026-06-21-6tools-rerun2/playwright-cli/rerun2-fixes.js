async (page) => {
  const context = page.context();
  const base = "http://localhost:4399";
  const extId = "jkmndkochpgaleoechlemhdhbikdecnf";
  const out = {};

  async function fresh(label) {
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.setDefaultNavigationTimeout(45000);
    p.__label = label;
    return p;
  }

  async function run(name, fn) {
    try {
      out[name] = await fn();
    } catch (error) {
      out[name] = { error: String(error && error.message ? error.message : error), stack: String(error && error.stack ? error.stack : "") };
    }
  }

  async function setBadge(value) {
    const p = await fresh(`badge-${value || "default"}`);
    await p.goto(`chrome-extension://${extId}/options.html`, { waitUntil: "domcontentloaded" });
    await p.locator("#badge-text").fill(value);
    await p.locator("#save").click();
    await p.locator("#status").waitFor();
    return await p.locator("#status").innerText();
  }

  async function openRealArticle(label) {
    const url = `https://ffffhx.github.io/garden-lab/post/agent/?${label}=pw-rerun2-${Date.now()}`;
    const p = await fresh(label);
    let navError = null;
    for (let i = 0; i < 3; i += 1) {
      try {
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await p.waitForTimeout(2500);
        return { page: p, url, navError, reused: false };
      } catch (error) {
        navError = error.message;
        await p.waitForTimeout(1500);
      }
    }
    const existing = context.pages().find((candidate) =>
      candidate.url().includes("https://ffffhx.github.io/garden-lab/post/agent/") &&
      !candidate.url().startsWith("chrome-error:")
    );
    if (!existing) throw new Error(navError || "no existing article page");
    return { page: existing, url: existing.url(), navError, reused: true };
  }

  await run("T15", async () => {
    const p = await fresh("T15-fix");
    const requests = [];
    p.on("response", (res) => {
      if (res.url().includes("/api/realtime-events")) requests.push({ url: res.url(), status: res.status(), contentType: res.headers()["content-type"] || "" });
    });
    await p.goto(`${base}/realtime?pw_rerun2_fix=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator("#start-stream").click();
    await p.locator("#stream-status").waitFor({ state: "visible" });
    await p.waitForFunction(() => document.querySelector("#stream-status")?.textContent.includes("STREAM-721"));
    const items = await p.$$eval("#events li", (nodes) => nodes.map((li) => li.textContent.trim()));
    return { status: await p.locator("#stream-status").innerText(), items, requests };
  });

  await run("T19", async () => {
    const p = await fresh("T19-fix");
    await p.goto(`${base}/a11y-modal?pw_rerun2_fix=${Date.now()}`, { waitUntil: "domcontentloaded" });
    let openClickError = null;
    try {
      await p.locator("#open-modal").click({ timeout: 3000 });
    } catch (error) {
      openClickError = error.message;
      await p.locator("#open-modal").evaluate((el) => el.click());
    }
    await p.locator("#notify-email").waitFor();
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
      hasKeydown: Boolean(el.onkeydown),
      inTrap: el.hasAttribute("data-trap-focus"),
    }));
    await p.locator("#save-preferences").click({ force: true });
    return { openClickError, sequence, attrs, result: await p.locator("#save-result").innerText() };
  });

  await run("T20", async () => {
    const p = await fresh("T20-fix");
    await p.goto(`${base}/flake?pw_rerun2_fix=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator("#run-checks").click();
    await p.waitForFunction(() => document.querySelectorAll("#flake-rows tr").length === 10);
    const rows = await p.$$eval("#flake-rows tr", (nodes) => nodes.map((tr) => Array.from(tr.children).map((td) => td.textContent.trim())));
    return { summary: await p.locator("#flake-summary").innerText(), rows };
  });

  await run("R06", async () => {
    const initialPage = await openRealArticle("r06_initial_fix");
    const initial = await initialPage.page.locator("#bench-ext-badge").innerText({ timeout: 10000 });
    const saved = await setBadge("REAL-SITE-2026");
    const customPage = await openRealArticle("r06_custom_fix");
    const custom = await customPage.page.locator("#bench-ext-badge").innerText({ timeout: 10000 });
    const restored = await setBadge("");
    const finalPage = await openRealArticle("r06_restore_fix");
    const finalBadge = await finalPage.page.locator("#bench-ext-badge").innerText({ timeout: 10000 });
    return {
      initial,
      saved,
      custom,
      restored,
      finalBadge,
      nav: {
        initial: { url: initialPage.url, navError: initialPage.navError, reused: initialPage.reused },
        custom: { url: customPage.url, navError: customPage.navError, reused: customPage.reused },
        final: { url: finalPage.url, navError: finalPage.navError, reused: finalPage.reused },
      },
    };
  });

  await run("R09", async () => {
    const opened = await openRealArticle("r09_fix");
    const p = opened.page;
    await p.waitForTimeout(3000);
    const perf = await p.evaluate(() => {
      const entries = performance.getEntriesByType("resource")
        .map((entry) => ({ url: entry.name, type: entry.initiatorType, duration: Math.round(entry.duration), responseEnd: Math.round(entry.responseEnd) }))
        .filter((entry) => entry.duration >= 0)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);
      return { url: location.href, title: document.title, h1: document.querySelector("h1")?.textContent || "", entries };
    });
    return { opened: { url: opened.url, navError: opened.navError, reused: opened.reused }, perf };
  });

  await run("finalBadge", async () => {
    await setBadge("");
    const p = await fresh("final-badge-fix");
    await p.goto(`${base}/?pw_rerun2_final=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await p.locator("#bench-ext-badge").waitFor();
    return await p.locator("#bench-ext-badge").innerText();
  });

  return JSON.stringify(out);
}
