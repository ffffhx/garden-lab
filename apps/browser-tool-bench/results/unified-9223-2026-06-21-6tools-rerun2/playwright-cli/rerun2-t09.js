async (page) => {
  const context = page.context();
  const extId = "jkmndkochpgaleoechlemhdhbikdecnf";
  const base = "http://localhost:4399";
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  await p.goto("chrome://extensions", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);

  const before = await p.evaluate((targetId) => {
    function all(root) {
      const out = [];
      const visit = (node) => {
        if (!node || !node.querySelectorAll) return;
        for (const el of node.querySelectorAll("*")) {
          out.push(el);
          if (el.shadowRoot) visit(el.shadowRoot);
        }
      };
      visit(root);
      return out;
    }
    const elements = all(document);
    return elements
      .filter((el) => {
        const text = (el.shadowRoot && el.shadowRoot.innerText) || el.innerText || el.textContent || "";
        return text.includes("Bench Badge") || text.includes(targetId) || el.id === targetId;
      })
      .map((el) => ({
        tag: el.tagName,
        id: el.id || "",
        text: ((el.shadowRoot && el.shadowRoot.innerText) || el.innerText || el.textContent || "").slice(0, 500),
      }))
      .slice(0, 20);
  }, extId);

  const reloadResult = await p.evaluate((targetId) => {
    function all(root) {
      const out = [];
      const visit = (node) => {
        if (!node || !node.querySelectorAll) return;
        for (const el of node.querySelectorAll("*")) {
          out.push(el);
          if (el.shadowRoot) visit(el.shadowRoot);
        }
      };
      visit(root);
      return out;
    }
    const elements = all(document);
    const candidates = elements.filter((el) => {
      const text = (el.shadowRoot && el.shadowRoot.innerText) || el.innerText || el.textContent || "";
      return text.includes("Bench Badge") || text.includes(targetId) || el.id === targetId;
    });
    for (const candidate of candidates) {
      const root = candidate.shadowRoot || candidate;
      const buttons = Array.from(root.querySelectorAll("cr-icon-button, button, [role=button]"));
      const reload = buttons.find((button) => {
        const label = button.getAttribute("aria-label") || button.getAttribute("title") || button.id || button.textContent || "";
        return /reload|重新加载|重载/i.test(label);
      });
      if (reload) {
        reload.click();
        return { clicked: true, hostTag: candidate.tagName, hostId: candidate.id || "", label: reload.getAttribute("aria-label") || reload.getAttribute("title") || reload.id || reload.textContent || "" };
      }
    }
    return { clicked: false, candidateCount: candidates.length };
  }, extId);

  await p.waitForTimeout(2000);
  const target = await context.newPage();
  await target.goto(`${base}/?t09=pw-rerun2-${Date.now()}`, { waitUntil: "domcontentloaded" });
  await target.waitForSelector("#bench-ext-badge", { timeout: 10000 });
  const badge = await target.locator("#bench-ext-badge").innerText();
  return JSON.stringify({ before, reloadResult, badge, extensionsUrl: p.url(), targetUrl: target.url() });
}
