
let stopRequested = false;

// background.js - Handle external messages and tab management
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.action === "connectMultiple" && Array.isArray(msg.connections) && msg.connections.length) {
    const connections = msg.connections;
    let index = 0;
    stopRequested = false;

    stopRequested = false;

    function next() {
      if (stopRequested) {
        console.log("Stop requested. Halting sequence.");
        return sendResponse({ status: "stopped" });
      }

      if (index >= connections.length) {
        return sendResponse({ status: "done" });
      }

      const { url, note } = connections[index];

      console.log(`Processing connection ${index + 1}/${connections.length}: ${url}`);
      
      chrome.tabs.create({ url: url, active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Tab creation error:', chrome.runtime.lastError);
          index++;
          next();
          return;
        }

        // Wait for page to load, then inject content script
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          }).then(() => {
            console.log('Content script injected successfully');

            chrome.tabs.sendMessage(tab.id, {
              action: "updateStatusHeader",
              current: index + 1,
              total: connections.length
            });
            
            // Wait a bit more for content script to be ready
            setTimeout(() => {
              // Send parameters to content.js
              chrome.tabs.sendMessage(tab.id, {
                action: "sendConnectionRequest",
                note: note || "Hi, I'd like to connect with you on LinkedIn.",
                index,
                total: connections.length,
                name: extractNameFromUrl(url),
              }, (response) => {
                console.log('Content script response:', response);
                if (chrome.runtime.lastError) {
                  console.error('Message error:', chrome.runtime.lastError);
                }
              });
            }, 1000);
            
          }).catch((error) => {
            console.error('Script injection error:', error);
          });

          // Close tab and move to next after delay
          setTimeout(() => {
            chrome.tabs.remove(tab.id);
            index++;
            next();
          }, 12000); // Reduced from 15000 to 12000
          
        }, 3000); // Wait for LinkedIn page to load
      });
    }

    next();
    return true; // Keep the message channel open for async response
  }
});

function extractNameFromUrl(url) {
  const match = url.match(/linkedin\.com\/in\/([^\/]+)/);
  return match ? match[1].replace(/-/g, ' ') : 'Unknown Profile';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "stopProcessing") {
    console.log("Stop signal received from panel");
    stopRequested = true;
    sendResponse({ status: "stopping" });
  }
});
