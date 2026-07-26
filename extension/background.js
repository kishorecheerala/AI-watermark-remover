// AI Watermark Remover Studio - Browser Extension Service Worker

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "clean_ai_watermark",
    title: "✨ Clean AI Watermark & Download",
    contexts: ["image", "video"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "clean_ai_watermark" && info.srcUrl) {
    chrome.downloads.download({
      url: info.srcUrl,
      filename: "clean_media_" + Date.now() + ".png",
      saveAs: false
    });
  }
});
