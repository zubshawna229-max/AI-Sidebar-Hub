const BLOCKED_URL_PATTERN = /^(chrome|edge|about|devtools|chrome-extension):/i;
const statusEl = document.querySelector("#status");

document.querySelector("#openSidebar").addEventListener("click", async () => {
  await sendToActiveTab({ type: "AI_SIDEBAR_TOGGLE" });
});

document.querySelector("#copyContext").addEventListener("click", async () => {
  const result = await sendToActiveTab({ type: "AI_SIDEBAR_COPY_CONTEXT" });
  if (result?.ok) {
    statusEl.textContent = "网页上下文已复制。";
  }
});

async function sendToActiveTab(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("未找到当前标签页。");
    if (tab.url && BLOCKED_URL_PATTERN.test(tab.url)) {
      throw new Error("浏览器内部页面不支持注入侧边栏。");
    }

    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["sidebar.css"]
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      return chrome.tabs.sendMessage(tab.id, message);
    }
  } catch (error) {
    statusEl.textContent = error.message || "操作失败，请刷新网页后重试。";
    return null;
  }
}
