// content.js - Handles LinkedIn page interactions
console.log('LinkedIn Connector content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'sendConnectionRequest') {
        const result = await handleConnectionRequest(message);
        sendResponse({ ...result, url: message.url || location.href });
      } else if (message.action === 'updateStatusHeader') {
        updateStatusHeader(message.current, message.total);
        sendResponse({ status: 'header updated' });
      }
    } catch (err) {
      console.error('Listener error:', err);
      sendResponse({ status: 'error', message: err.message });
    }
  })();
  return true; // keep channel open
});

async function handleConnectionRequest({ note, id, total, name }) {
  console.log(`Starting connection request for ${name} (${id + 1}/${total})`);
  let finalStatus = 'failed'; // Default to failed
  
  try {
    await waitForPageLoad();
    createStatusPanel(total, id + 1);
   
    const profileName = document.querySelector("h1")?.innerText.trim() || name || "Unknown Profile";
    const headline = document.querySelector(".text-body-medium.break-words")?.innerText.trim() || "Headline not available";

    addStatusItem(id, total, profileName, headline);
    
    // Attempt to send connection request
    const requestResult = await sendConnectionRequest(note, id);
    finalStatus = requestResult.status; // Get status from the detailed result
    
  } catch (error) {
    console.error('Connection error:', error);
    finalStatus = 'error'; // Catch any unexpected errors during the process
  } finally {
    updateStatusItem(id, finalStatus); // Always update the status item
    return { id, status: finalStatus }; // Return final status
  }
}

async function sendConnectionRequest(note, id) {
  console.log('Looking for Connect button...');
  let currentStatus = 'processing';

  try {
    // Wait for Connect button or More menu
    let connectBtn = await clickConnectButton();
    // if (!connectBtn) {
    //   const moreBtn = document.querySelector('button[aria-label="More actions"]');
    //   if (moreBtn) {
    //     moreBtn.click();
    //     // Wait until dropdown is visible
    //     const dropdown = await waitForElement('.artdeco-dropdown__content--is-dropdown-element', 3000);
    //     if (dropdown) {
    //       connectBtn = Array.from(dropdown.querySelectorAll('div[role="button"]')).find(btn => btn.innerText.trim().toLowerCase() === 'connect');
    //     }
    //   }
    // }

    if (!connectBtn) {
      console.log('Connect button not found or already connected/pending.');
      if (document.querySelector('button[aria-label*="Pending"]')) {
        return { status: 'pending_already', message: 'Invitation already sent (Pending).' };
      }
      if (document.querySelector('button[aria-label*="Message"]')) {
        return { status: 'connected_already', message: 'Already connected.' };
      }
      return { status: 'failed', message: 'Connect button not found.' };
    }

    console.log('Connect button found, clicking...');
    connectBtn.click();
    await delay(2000); // Wait for modal

    // Check for limit reached modal first
    const limitModal = document.querySelector('.artdeco-modal__content, [role="alert"], .artdeco-toast-item');
    if (limitModal && /you’ve used all your monthly custom invites|cannot send/i.test(limitModal.innerText)) {
      return { status: 'limitReached', message: 'Invitation limit reached' };
    }

    // Handle Add Note
    const addNoteBtn = await waitForElement('button[aria-label="Add a note"], button:has(span[title="Add a note"])', 3000);
    if (addNoteBtn && note) {
      console.log('Add note button found, clicking...');
      addNoteBtn.click();
      await delay(1000);

      const textarea = await waitForElement('textarea[name="message"]', 2000);
      if (textarea) {
        console.log('Textarea found, filling message...');
        textarea.focus();
        textarea.value = note;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(500);
      } else {
        console.warn('Note textarea not found. Proceeding without note.');
      }
    } else if (note) {
      console.warn('Add note button not found, proceeding without note.');
    }

    // Click Send
    console.log('Looking for Send button...');
    const sendBtn = await waitForSendButton();
    if (!sendBtn) {
      return { status: 'failed', message: 'Send button not found.' };
    }

    sendBtn.click();
    await delay(3000);

    // Detect final result
    const result = await detectConnectionResult();
    currentStatus = result;
    return { status: currentStatus, message: `Connection request result: ${currentStatus}` };

  } catch (error) {
    console.error('Error during sendConnectionRequest:', error);
    return { status: 'error', message: error.message };
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
  

  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null) return false; // quick visibility check
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  async function clickConnectButton(timeout = 5000) {
    // 1️⃣ Try to find main Connect button
    let connectBtn = await waitForElement(() => {
      const profileActions = document.querySelector('div.pv-top-card--list-actions, div.ph5') 
                             || document.querySelector('div.display-flex.mt2');
      if (!profileActions) return null;
  
      return Array.from(profileActions.querySelectorAll('button, div[role="button"]'))
        .find(b => b.innerText.trim().toLowerCase() === 'connect' && isVisible(b));
    }, timeout);
  
    if (connectBtn) return connectBtn;
  
    // 2️⃣ If not found, try More dropdown without visibly clicking
    const profileActions = document.querySelector('div.pv-top-card--list-actions, div.ph5') 
                           || document.querySelector('div.display-flex.mt2');
    if (!profileActions) return null;
  
    const moreBtn = profileActions.querySelector('button[aria-label*="More actions"]');
    if (moreBtn) {
      // Wait for dropdown to appear after clicking (or even without clicking)
      moreBtn.click(); // optional, for LinkedIn to render it
      await delay(300); // short delay
  
      const dropdown = await waitForElement(() =>
        document.querySelector('.artdeco-dropdown__content--is-dropdown-element, .artdeco-dropdown__content')
      , 2000);
  
      if (dropdown) {
        // Directly find Connect inside dropdown and return it
        const connectInDropdown = Array.from(dropdown.querySelectorAll('button, div[role="button"]'))
          .find(b => b.innerText.trim().toLowerCase() === 'connect' && isVisible(b));
        if (connectInDropdown) return connectInDropdown;
      }
    }
  
    return null;
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

async function detectConnectionResult() {
  // Check for success: "Invitation sent" toast or "Pending" button
  const successToast = document.querySelector('[role="alert"] .artdeco-toast-item__content, .artdeco-toast-item span[title*="Invitation sent"]');
  if (successToast && successToast.innerText.toLowerCase().includes('invitation sent')) {
    return 'success';
  }

  // Check for a "Pending" button on the profile after interaction
  if (await waitForElement('button[aria-label*="Pending"]', 1000)) {
    return 'success'; // Treat 'Pending' as a successful send
  }

  // Check for LinkedIn limit modal or toast
  const modalOrToast = document.querySelector('.artdeco-modal__content, .msg-overlay-bubble-header, [role="alert"], .artdeco-toast-item');
  if (modalOrToast) {
    const text = modalOrToast.innerText.toLowerCase();
    if (text.includes('you’ve used all your monthly custom invites') || text.includes('cannot send any more invitations')) {
      return 'limitReached';
    }
    if (text.includes('something went wrong') || text.includes('failed to send')) {
      return 'failed';
    }
  }
  
  // Check for generic error messages in the modal
  const errorInModal = document.querySelector('.artdeco-modal__content .artdeco-inline-feedback--error');
  if (errorInModal) {
    const text = errorInModal.innerText.toLowerCase();
    if (text.includes('limit reached') || text.includes('cannot send')) {
      return 'limitReached';
    }
    return 'failed';
  }

  // If we reach here, and no explicit success/failure/limit was detected,
  // it's an unknown state. Consider it a failure for safety.
  return 'failed'; 
}

// ... (other functions like waitForElement, delay, createStatusPanel, addStatusItem, updateStatusHeader remain similar)

function updateStatusItem(id, status, message = '') { // Added message parameter
  const el = document.getElementById(`linkedin-status-${id}`);
  if (!el) return;

  let icon = '';
  let color = '';
  let tooltip = status;

  switch (status) {
    case 'success':
      icon = '✅';
      color = '#28a745'; // Green
      tooltip = 'Invitation Sent';
      break;
    case 'limitReached':
      icon = '🚫';
      color = '#ffc107'; // Yellow/Orange
      tooltip = 'LinkedIn Invitation Limit Reached';
      break;
    case 'failed':
      icon = '❌';
      color = '#dc3545'; // Red
      tooltip = message || 'Failed to send invitation';
      break;
    case 'error': // For unexpected script errors
      icon = '🚨';
      color = '#dc3545';
      tooltip = message || 'An unexpected error occurred';
      break;
    case 'pending_already':
      icon = '🕒';
      color = '#007bff'; // Blue
      tooltip = 'Invitation already pending';
      break;
    case 'connected_already':
      icon = '🤝';
      color = '#6f42c1'; // Purple
      tooltip = 'Already connected';
      break;
    default:
      icon = `<div class="linkedin-spinner"></div>`; // Default processing spinner
      color = '#0073b1';
      tooltip = 'Processing...';
  }
  
  el.innerHTML = `<span style="color:${color};font-size:1.2em;" title="${tooltip}">${icon}</span>`;
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

function createStatusPanel(total,id) {
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

function addStatusItem(id, total, name, headline) {
  const list = document.getElementById("linkedin-status-list");
  if (!list) return;

  const item = document.createElement("div");
  item.id = `linkedin-status-item-${id}`;
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
    <span id="linkedin-status-${id}" style="display:flex;align-items:center;justify-content:center;">
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

function updateStatusItem(id, status) {
  const el = document.getElementById(`linkedin-status-${id}`);
  if (!el) return;

  if (status === "success") el.textContent = "✅";
  else if (status === "limitReached") el.textContent = "⛔"; // Limit reached
  else if (status === "failed") el.textContent = "⚠️";
  else el.innerHTML = `<div class="linkedin-spinner"></div>`;
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