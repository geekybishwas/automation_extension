// content.js - Handles LinkedIn page interactions
console.log('LinkedIn Connector content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'sendConnectionRequest') {
    handleConnectionRequest(message);
    sendResponse({ status: 'received' });
  }
  if (message.action === 'updateStatusHeader') {
    updateStatusHeader(message.current, message.total);
    sendResponse({ status: 'header updated' });
  }
  return true; // Keep message channel open
});

async function handleConnectionRequest({ note, index, total, name }) {
  console.log(`Starting connection request for ${name} (${index + 1}/${total})`);
  
  try {
    // Wait for page to be fully loaded
    await waitForPageLoad();
    
    createStatusPanel(total, index+1);
   
    // const profileName =
    //   document.querySelector(".pv-text-details__left-panel h1")?.innerText.trim() ||
    //   name || "Unknown";
    const name =
      document.querySelector("h1")?.innerText.trim() || "Unknown Profile";
    

    // Scrape headline/job title (LinkedIn often puts it here)
    const headline =
      document.querySelector(".text-body-medium.break-words")?.innerText.trim() ||
      "Headline not available";

    // Add row to panel
    addStatusItem(index, total, name, headline);
    
    const result = await sendConnectionRequest(note, index);
    updateStatusItem(index, result ? 'success' : 'failed');
    
    return { index, status: result ? 'success' : 'failed' };
  } catch (error) {
    console.error('Connection error:', error);
    updateStatusItem(index, 'failed');
    return { index, status: 'error', error: error.message };
  }
}

async function sendConnectionRequest(note, index) {
  console.log('Looking for Connect button...');
  
  // Wait for Connect button to be available
  const connectBtn = await waitForConnectButton();
  if (!connectBtn) {
    console.log('Connect button not found');
    return false;
  }

  console.log('Connect button found, clicking...');
  connectBtn.click();
  
  // Wait for modal to appear
  await delay(2000);
  
  // Look for "Add a note" button
  const addNoteBtn = await waitForElement('button[aria-label="Add a note"]', 3000);
  if (addNoteBtn && note) {
    console.log('Add note button found, clicking...');
    addNoteBtn.click();
    await delay(1000);
    
    // Fill in the message
    const textarea = await waitForElement('textarea[name="message"]', 2000);
    if (textarea) {
      console.log('Textarea found, filling message...');
      textarea.focus();
      textarea.value = note;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      await delay(500);
    }
  }
  
  // Find and click Send button
  console.log('Looking for Send button...');
  const sendBtn = await waitForSendButton();
  if (sendBtn) {
    console.log('Send button found, clicking...');
    sendBtn.click();
    await delay(2000);
    return true;
  } else {
    console.log('Send button not found');
    return false;
  }
}

function waitForPageLoad() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      setTimeout(resolve, 2000); // Extra delay for LinkedIn's dynamic content
    } else {
      window.addEventListener('load', () => {
        setTimeout(resolve, 2000);
      });
    }
  });
}

function waitForConnectButton() {
  return waitForElement(() => {
    const buttons = document.querySelectorAll('button');
    return Array.from(buttons).find(btn => {
      const text = btn.innerText.trim().toLowerCase();
      return text === 'connect' && btn.offsetParent !== null; // Make sure it's visible
    });
  }, 5000);
}

function waitForSendButton() {
  return waitForElement(() => {
    const buttons = document.querySelectorAll('button');
    return Array.from(buttons).find(btn => {
      const text = btn.innerText.trim().toLowerCase();
      return (text === 'send' || text === 'send invitation') && btn.offsetParent !== null;
    });
  }, 5000);
}

function waitForElement(selectorOrFunction, timeout = 10000) {
  return new Promise((resolve) => {
    const isFunction = typeof selectorOrFunction === 'function';
    
    // Try to find element immediately
    const element = isFunction ? selectorOrFunction() : document.querySelector(selectorOrFunction);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = isFunction ? selectorOrFunction() : document.querySelector(selectorOrFunction);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

function createStatusPanel(total,index) {
  let panel = document.getElementById("linkedin-status-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "linkedin-status-panel";
    panel.style.position = "fixed";
    panel.style.right = "20px";
    panel.style.bottom = "20px";
    panel.style.width = "320px";
    panel.style.background = "#fff";
    panel.style.border = "1px solid rgba(0,0,0,0.15)";
    panel.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    panel.style.borderRadius = "8px";
    panel.style.fontFamily = "Segoe UI, Roboto, sans-serif";
    panel.style.zIndex = "999999";
    document.body.appendChild(panel);
  }

  if (!document.getElementById("linkedin-spinner-style")) {
    const style = document.createElement("style");
    style.id = "linkedin-spinner-style";
    style.textContent = `
      .linkedin-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #ccc;
        border-top: 2px solid #0073b1; /* LinkedIn blue */
        border-radius: 50%;
        animation: linkedin-spin 0.8s linear infinite;
      }
  
      @keyframes linkedin-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  

  panel.innerHTML = `
  <div style="
      padding: 8px 8px;
      border-bottom: 1px solid #f0f0f0;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #f8f8f8;
      color: #333;
    ">
    <div></div>
      <div style="display: flex; align-items: center;">
        <button id="stop-btn" style="
          margin-right: 8px;
          width: 18px;
          height: 18px;
          background-color: transparent;
          border: 2px solid #dc3545;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          color: #dc3545;
        ">
          <i data-lucide="square" width="12" height="12" stroke-width="2.5"></i>
        </button>
        <span id="close-panel" style="
          cursor: pointer;
          font-size: 1.3em;
          color: #777;
          padding: 2px 7px;
          border-radius: 4px;
          transition: background-color 0.2s ease;
        ">×</span>
      </div>
  </div>
  <div id="linkedin-status-list" style="max-height:300px;overflow-y:auto;padding:8px"></div>
`;

// Handle Stop button
document.getElementById("stop-btn")?.addEventListener("click", () => {
  console.log("Stop button clicked");
  chrome.runtime.sendMessage({ action: "stopProcessing" });
});


}

function addStatusItem(index, total, name, headline) {
  const list = document.getElementById("linkedin-status-list");
  if (!list) return;

  const item = document.createElement("div");
  item.id = `linkedin-status-item-${index}`;
  item.style.display = "flex";
  item.style.justifyContent = "space-between";
  item.style.alignItems = "center";
  item.style.padding = "6px 4px";
  item.style.borderBottom = "1px solid #f0f0f0";

  item.innerHTML = `
    <div>
      <div style="font-weight:500">${name || "Unknown"}</div>
      <div style="font-size:12px;color:#666">${headline || ""}</div>
    </div>
    <span id="linkedin-status-${index}" style="display:flex;align-items:center;justify-content:center;">
    <div class="linkedin-spinner"></div>
   </span>
  `;

  list.appendChild(item);
}

function updateStatusHeader(current, total) {
  const header = document.getElementById("linkedin-task-header");
  if (header) {
    header.textContent = `Executing task ${current} of ${total}`;
  }
}

function updateStatusItem(index, status) {
  const el = document.getElementById(`linkedin-status-${index}`);
  if (!el) return;
  if (status === "success") el.textContent = "✅";
  else if (status === "failed") el.textContent = "⚠️";
  else el.textContent = "⏳";
}


function formatName(name) {
  if (!name || name === 'Unknown Profile') return 'LinkedIn Profile';
  return name.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}