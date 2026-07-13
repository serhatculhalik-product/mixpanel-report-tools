// On toolbar-icon click, inject the transpose script into ALL frames of the active tab.
// allFrames: true is required because the table can live inside a cross-origin iframe.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["transpose.js"],
    });
  } catch (e) {
    console.error("Mixpanel Transposer injection error:", e);
  }
});
