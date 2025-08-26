// chrome.runtime.onMessage.addListener((msg) => {
//   if (msg.action === "connectMultiple") {
//     let index = 0;

//     function next() {
//       if (index >= msg.urls.length) return;

//       chrome.tabs.create({ url: msg.urls[index], active: false }, (tab) => {
//         setTimeout(() => {
//           chrome.scripting.executeScript({
//             target: { tabId: tab.id },
//             files: ["content.js"]
//           });
//         }, 5000); // wait for page load

//         setTimeout(() => {
//           chrome.tabs.remove(tab.id);
//           index++;
//           next();
//         }, 15000); // wait 15s before closing
//       });
//     }

//     next();
//   }
// });
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
        }, 5000); // wait for page load

        setTimeout(() => {
          chrome.tabs.remove(tab.id);
          index++;
          next();
        }, 15000); // wait 15s before closing
      });
    }

    next();
    return true; // required to indicate async sendResponse
  }
});
