// 设置页：读写 chrome.storage.local 里的 badgeText。
const input = document.getElementById("badge-text");
const status = document.getElementById("status");

chrome.storage.local.get("badgeText").then(({ badgeText }) => {
  if (badgeText) input.value = badgeText;
});

document.getElementById("save").addEventListener("click", async () => {
  const value = input.value.trim();
  await chrome.storage.local.set({ badgeText: value });
  status.textContent = value
    ? `已保存：徽标文字将显示为「${value}」（刷新靶场页面生效）`
    : "已保存：恢复默认徽标";
});
