
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.action === "connectMultiple" && msg.urls?.length) {
    let index = 0;

    function next() {
      if (index >= msg.urls.length) return sendResponse({ status: "done" });

      chrome.tabs.create({ url: msg.urls[index], active: false }, (tab) => {
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });
        }, 5000); 

        setTimeout(() => {
          chrome.tabs.remove(tab.id);
          index++;
          next();
        }, 15000);
      });
    }

    next();
    return true; 
  }
});
