// background.js - Handle external messages and tab management
let stopRequested = false;
let connectionResults = []; // To store results for external app

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.action === "connectMultiple" && Array.isArray(msg.connections) && msg.connections.length) {
    const connections = msg.connections;
    let index = 0;
    stopRequested = false;
    connectionResults = []; // Reset results for new batch

    function next() {
      if (stopRequested) {
        console.log("Stop requested. Halting sequence.");
        return sendResponse({ status: "stopped", results: connectionResults }); // Send accumulated results
      }

      if (index >= connections.length) {
        console.log("All connections processed.");
        return sendResponse({ status: "done", results: connectionResults }); // Send accumulated results
      }

      const { url, note } = connections[index];
      const currentConnectionIndex = index; // Capture for async callbacks

      console.log(`Processing connection ${currentConnectionIndex + 1}/${connections.length}: ${url}`);
      
      chrome.tabs.create({ url: url, active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          const errorMsg = `Tab creation error for ${url}: ${chrome.runtime.lastError.message}`;
          console.error(errorMsg);
          connectionResults.push({ index: currentConnectionIndex, url, status: 'error', message: errorMsg });
          index++;
          next();
          return;
        }

        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          }).then(() => {
            console.log('Content script injected successfully');

            chrome.tabs.sendMessage(tab.id, {
              action: "updateStatusHeader",
              current: currentConnectionIndex + 1,
              total: connections.length
            });
            
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, {
                action: "sendConnectionRequest",
                note: note || "Hi, I'd like to connect with you on LinkedIn.",
                index: currentConnectionIndex,
                total: connections.length,
                name: 'Biswas',
                url: url // Pass original URL
              }, (response) => {
                if (chrome.runtime.lastError) {
                  const errorMsg = `Message error to content.js for tab ${tab.id}: ${chrome.runtime.lastError.message}`;
                  console.error(errorMsg);
                  connectionResults.push({ index: currentConnectionIndex, url, status: 'error', message: errorMsg });
                } else if (response) {
                  console.log(`Content script responded for ${url}:`, response);
                  connectionResults.push({ ...response, url }); // Store detailed response
                } else {
                    // This can happen if the content script closes before responding, or for other reasons
                    console.warn(`No response from content script for ${url}. Assuming timeout/failure.`);
                    connectionResults.push({ index: currentConnectionIndex, url, status: 'failed', message: 'No response from content script.' });
                }
              });
            }, 1000); // Wait for content script to be ready
            
          }).catch((error) => {
            const errorMsg = `Script injection error for ${url}: ${error.message}`;
            console.error(errorMsg);
            connectionResults.push({ index: currentConnectionIndex, url, status: 'error', message: errorMsg });
          });

          // Close tab and move to next after delay
          setTimeout(() => {
            chrome.tabs.remove(tab.id);
            index++; // Increment global index for next iteration
            next();
          }, 12000); 
          
        }, 3000); // Wait for LinkedIn page to load
      });
    }

    next();
    return true; 
  }
});

// ... (extractNameFromUrl, delay functions remain)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "stopProcessing") {
    console.log("Stop signal received from panel");
    stopRequested = true;
    sendResponse({ status: "stopping" });
    // No need to send results here, the next() function's stopRequested check will handle it.
  }
});