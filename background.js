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

  if (msg.action === "sendMultipleMessages" && Array.isArray(msg.targets) && msg.targets.length) {
    const targets = msg.targets;
    stopRequested = false;
    connectionResults = [];

    (async function processMessages() {
      for (let index = 0; index < targets.length; index++) {
        if (stopRequested) {
          sendResponse({ status: "stopped", results: connectionResults });
          return;
        }

        const { id, url, message } = targets[index];
        console.log(`📨 [${index + 1}/${targets.length}] Sending message to: ${url}`);

        try {
          const tab = await createTab(url);
          await delay(3000);
          await injectContentScript(tab.id, "content.js");

          // Update header (like connection flow)
          chrome.tabs.sendMessage(tab.id, {
            action: "updateStatusHeader",
            current: index + 1,
            total: targets.length,
          });

          // Core message sending
          const result = await sendMessageToProfile(tab.id, message, id, targets.length, 'Bishwas', url);
          connectionResults.push({ ...result, id, url });

          await removeTab(tab.id);
        } catch (error) {
          console.error(`❌ Error on ${url}:`, error);
          connectionResults.push({ id, url, status: "error", message: error.message });
        }
      }

      console.log("✅ All messages processed.");
      sendResponse({ status: "done", results: connectionResults });
    })();

    return true;
  }

  if (msg.action === "viewProfiles" && Array.isArray(msg.urls) && msg.urls.length) {
    const profiles = msg.urls;
    stopRequested = false;
    connectionResults = [];
  
    (async function processProfileViews() {
      for (let index = 0; index < profiles.length; index++) {
        if (stopRequested) {
          sendResponse({ status: "stopped", results: connectionResults });
          return;
        }
  
        const profile = profiles[index];
        const url = profile.url;
  
        try {
          const tab = await createTab(url);
  
          // Wait for the page to fully load
          await waitForTabLoad(tab.id);
  
          // Then wait human-like time before closing
          await delay(4000 + Math.random() * 2000); 
  
          connectionResults.push({ id: profile.id, url, status: "SUCCESS" });
  
          await removeTab(tab.id);
        } catch (error) {
          console.error(`Error viewing ${url}:`, error);
          connectionResults.push({
            id: profile.id,
            url,
            status: "error",
            message: error.message,
          });
        }
      }
  
      sendResponse({ status: "done", results: connectionResults });
    })();
  
    return true;
  }
  if (msg.action === "checkConnectionStatus" && Array.isArray(msg.connections) && msg.connections.length) {
    const profilesToCheck = msg.connections;
    stopRequested = false;
    connectionResults = [];
  
    (async function processStatusChecks() {
      for (let i = 0; i < profilesToCheck.length; i++) {
        if (stopRequested) {
          sendResponse({ status: "stopped", results: connectionResults });
          return;
        }
  
        const { id, url } = profilesToCheck[i];
        console.log(`🔎 [${i + 1}/${profilesToCheck.length}] Checking connection for ID: ${id}, URL: ${url}`);
  
        let tabId = null;
  
        try {
          // 1️⃣ Create new tab
          const tab = await createTab(url);
          tabId = tab.id;
          await waitForTabLoad(tabId);
  
          // 2️⃣ Inject content script dynamically
          await injectContentScript(tabId, "content.js");
  
          // 3️⃣ Send message to content.js
          const contentResponse = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: "checkConnectionStatus" }, (response) => {
              if (chrome.runtime.lastError) {
                console.error(`❌ Error on tab ${tabId}:`, chrome.runtime.lastError.message);
                resolve({ status: "ERROR", message: chrome.runtime.lastError.message });
              } else {
                // Ensure a response object is always returned
                resolve(response || { status: "ERROR", message: "No response from content script." });
              }
            });
          });
  
          // 4️⃣ Store results
          connectionResults.push({
            id,
            url,
            status: contentResponse.status,
            message: contentResponse.message || "",
          });
  
        } catch (error) {
          console.error(`❌ Failed to check connection for ID: ${id}, URL: ${url}:`, error);
          connectionResults.push({
            id,
            url,
            status: "ERROR",
            message: error.message || "Unknown error",
          });
        } finally {
          // 5️⃣ Close tab
          if (tabId) {
            await removeTab(tabId).catch(() => {});
          }
        }
      }
  
      console.log("✅ All profiles checked. Results:", connectionResults);
      sendResponse({ status: "done", results: connectionResults });
    })();
  
    return true; // Keep channel open for async response
  }
});

function sendMessageToProfile(tabId, message, id, total, name, url) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, {
      action: "sendLinkedInMessage",
      message,
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

async function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}
