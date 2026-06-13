// 在页面右下角注入徽标。
// 默认显示「BENCH EXT v<版本>」（T09 的判定方式：改 manifest 版本 → reload → 徽标版本变化）。
// 若设置页保存过自定义文字，则显示「<自定义文字> · v<版本>」（T11 的判定方式）。
const version = chrome.runtime.getManifest().version;

chrome.storage.local.get("badgeText").then(({ badgeText }) => {
  const badge = document.createElement("div");
  badge.id = "bench-ext-badge";
  badge.textContent = badgeText ? `${badgeText} · v${version}` : `BENCH EXT v${version}`;
  badge.style.cssText = [
    "position: fixed",
    "right: 12px",
    "bottom: 12px",
    "z-index: 99999",
    "background: #1f2329",
    "color: #fff",
    "font: 12px/1 -apple-system, sans-serif",
    "padding: 6px 10px",
    "border-radius: 6px",
    "opacity: 0.85",
  ].join(";");
  document.documentElement.appendChild(badge);
});
