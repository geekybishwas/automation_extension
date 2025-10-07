// background.js - Handle external messages and tab management
let stopRequested = false;
let connectionResults = []; // Stores results for external app

// Utility delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main listener for external requests
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.action === "connectMultiple" && Array.isArray(msg.connections) && msg.connections.length) {
    const connections = msg.connections;
    stopRequested = false;
    connectionResults = []; 

    (async function processConnections() {
      for (let index = 0; index < connections.length; index++) {
        if (stopRequested) {
          console.log("Stop requested. Halting sequence.");
          sendResponse({ status: "stopped", results: connectionResults });
          return;
        }

        const { id, url, note } = connections[index];

        console.log(`Processing connection ${index + 1}/${connections.length}: ${url}`);

        try {
          const tab = await createTab(url);

          // Wait a few seconds for LinkedIn to load dynamic content
          await delay(3000);

          await injectContentScript(tab.id, "content.js");

          // Update status header in content.js
          chrome.tabs.sendMessage(tab.id, {
            action: "updateStatusHeader",
            current: index + 1,
            total: connections.length
          });

          // Send connection request and wait for response
          const result = await sendConnectionRequest(tab.id, note, id, connections.length, 'Biswas', url);
          connectionResults.push({ ...result, id, url });


          // Close the tab before moving to next
          await removeTab(tab.id);

        } catch (error) {
          console.error(`Error processing ${url}:`, error);
          connectionResults.push({ index, url, status: 'error', message: error.message });
        }
      }

      console.log("All connections processed.");
      sendResponse({ status: "done", results: connectionResults });
    })();

    return true; // Keep channel open for async response
  }
});

// Stop signal listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "stopProcessing") {
    console.log("Stop signal received from panel");
    stopRequested = true;
    sendResponse({ status: "stopping" });
  }
});

// --- Helper functions ---

function createTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: true }, tab => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Tab creation error: ${chrome.runtime.lastError.message}`));
      } else {
        resolve(tab);
      }
    });
  });
}

function removeTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => resolve());
  });
}

function injectContentScript(tabId, scriptFile) {
  return chrome.scripting.executeScript({
    target: { tabId },
    files: [scriptFile]
  }).then(() => {
    console.log("Content script injected successfully");
  }).catch(err => {
    throw new Error(`Script injection error: ${err.message}`);
  });
}

function sendConnectionRequest(tabId, note, id, total, name, url) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, {
      action: "sendConnectionRequest",
      note: note || "Hi, I'd like to connect with you on LinkedIn.",
      id,
      total,
      name,
      url
    }, response => {
      if (chrome.runtime.lastError) {
        console.error(`Message error to content.js for tab ${tabId}: ${chrome.runtime.lastError.message}`);
        resolve({ id, status: 'error', message: chrome.runtime.lastError.message });
      } else if (response) {
        resolve(response);
      } else {
        console.warn(`No response from content script for tab ${tabId}.`);
        resolve({ id, status: 'failed', message: 'No response from content script.' });
      }
    });
  });
}
