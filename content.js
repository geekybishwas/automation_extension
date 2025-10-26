// content.js - Handles LinkedIn page interactions
console.log('LinkedIn Connector content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'sendConnectionRequest') {
        const result = await handleConnectionRequest(message);
        sendResponse({ ...result, url: message.url || location.href });
      } 
      else if (message.action === 'sendLinkedInMessage') {
        const { message: messageText, id, url } = message;
        const result = await sendLinkedInMessage(messageText);
        sendResponse({ ...result, id, url });
      } 
      else if (message.action === 'updateStatusHeader') {
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

async function sendLinkedInMessage(messageText) {
  try {
    console.log("🔍 Starting message sending process...");

    // Close any pre-existing message panels before starting a new one.
    // This handles cases where a previous automation might have left a panel open.
    closeAnyOpenMessagePanels();
    await delay(800);

    console.log("🔍 Now looking for the 'Message' button to open a new modal...");

    // Check for 'Pending' invitation status on the profile.
    if (document.querySelector('button[aria-label*="Pending"]')) {
      console.log("ℹ️ Invitation already sent (Pending). Skipping message.");
      return { status: 'PENDING', message: 'Invitation already sent (Pending).' };
    }

    // Find the 'Message' button on the profile page.
    const messageButton = await waitForElement(() => {
      const btns = Array.from(document.querySelectorAll('button, a[role="button"]'));
      return btns.find(b =>
        isVisible(b) &&
        b.innerText.trim().toLowerCase() === 'message'
      );
    }, 6000);

    if (!messageButton) {
      console.warn("⚠️ No 'Message' button found. Profile is likely not connected or not messageable.");
      return { status: "skipped", message: "Not messageable" };
    }

    console.log("💬 Clicking the 'Message' button to open the chat modal...");
    messageButton.click();
    await delay(1500); // Give time for the modal to fully appear

    console.log("⌛ Waiting for the message input field to become available...");

    const inputEl = await waitForElement(() =>
      document.querySelector('div.msg-form__contenteditable[role="textbox"]')
    , 8000);

    if (!inputEl) {
      throw new Error("Message box (contenteditable input field) not found!");
    }

    console.log("✍️ Inserting message using simulated typing...");
    insertTextProperly(inputEl, messageText);
    await delay(1500); // Give LinkedIn time to register the input and enable the Send button

    // Find the 'Send' button within the active message modal.
    const sendBtn = await waitForElement(() =>
      Array.from(document.querySelectorAll('button[type="submit"], button.msg-form__send-button, button[aria-label*="Send"]')).find(btn =>
        isVisible(btn) &&
        btn.innerText.trim().toLowerCase() === 'send' &&
        !btn.disabled // Ensure the send button is enabled
      )
    , 7000); // Increased timeout for robustness

    if (!sendBtn) {
      // Check if a disabled send button exists to give a more specific error
      const disabledSendBtn = document.querySelector('button[type="submit"][disabled], button.msg-form__send-button[disabled], button[aria-label*="Send"][disabled]');
      if (disabledSendBtn) {
          throw new Error("Send button found, but it is disabled. Input might not have fully registered.");
      }
      throw new Error("Send button not found after message input.");
    }

    console.log("📨 Clicking 'Send' button...");
    sendBtn.click();
    await delay(2500); // Wait for message to send and potential success toast to appear

    // Check for success toast or immediate status change
    const successToast = document.querySelector('.artdeco-toast-item__content span[title*="Message sent"], [role="alert"] span[title*="Message sent"]');
    if (successToast) {
        console.log("✅ Message sent successfully (toast detected!).");
        return { status: "success", message: "Message sent successfully" };
    } else {
        console.warn("❗ Message sent, but confirmation toast not found. Assuming success.");
        return { status: "success", message: "Message sent (confirmation toast not found)" };
    }

  } catch (e) {
    console.error("❌ Error sending message:", e.message);
    return { status: "error", message: e.message };
  } finally {
    // ALWAYS attempt to close the message panel after the process, regardless of success or failure.
    console.log("🧹 Attempting to close the message panel after sending/error...");
    closeAnyOpenMessagePanels();
    await delay(500); // Small delay to let close animation start
  }
}

// Renamed and refined close function
function closeAnyOpenMessagePanels() {
  console.log("Attempting to close message panels...");

  // Priority 1: Main message modal (often has an 'x' or 'Dismiss' button)
  let closedModal = false;
  const modalCloseBtn = document.querySelector('button[aria-label*="Dismiss"], button[aria-label*="Close chat"], button[aria-label="Close"]');
  if (modalCloseBtn && isVisible(modalCloseBtn)) {
    modalCloseBtn.click();
    console.log("🛑 Closed main message modal.");
    closedModal = true;
  }

  // Priority 2: Message overlay bubble (the smaller, fixed-position chat window)
  // This one usually has a minimize button, but sometimes an 'x' as well.
  const overlayCloseBtn = document.querySelector('button.msg-overlay-bubble-header__control[aria-label*="Minimize message window"], button.msg-overlay-bubble-header__control[aria-label*="Close message window"]');
  if (!closedModal && overlayCloseBtn && isVisible(overlayCloseBtn)) {
    overlayCloseBtn.click();
    console.log("🛑 Minimized/Closed message overlay bubble.");
  }
   // Add a small delay for UI to react to the close click
   // A quick check if a modal element is still in the DOM might be useful if closing is flaky.
   // E.g., const modalStillPresent = document.querySelector('.msg-convo-form');
   // If modalStillPresent, try clicking again or logging a warning.
}


function insertTextProperly(element, text) {
  element.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  for (let char of text) {
    document.execCommand("insertText", false, char);
  }

  element.dispatchEvent(new InputEvent("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function handleConnectionRequest({ note, id, total, name }) {
  console.log(`Starting connection request for ${name} (${id + 1}/${total})`);
  let finalStatus = 'FAILED'; // Default to FAILED
  
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

    if (document.querySelector('button[aria-label*="Pending"]')) {
      return { status: 'PENDING', message: 'Invitation already sent (Pending).' };
    }
    // Wait for Connect button or More menu
    let connectBtn = await clickConnectButton();
    if (!connectBtn) {
      console.warn('No Connect button found on this profile.');
      return { status: 'FAILED', message: 'No Connect button available' };
    }
    console.log('Connect button found, clicking...');
    connectBtn.click();
    await delay(2000); // Wait for modal


    // Handle Add Note if available
    const addNoteBtn = await waitForElement(
      'button[aria-label="Add a note"], button:has(span[title="Add a note"])',
      3000
    );
    if (addNoteBtn && note) {
      console.log('Add note button found, clicking...');
      addNoteBtn.click();
      await delay(1500);

      // Detect "limit reached" upsell modal
    const upsellModal = document.querySelector('.artdeco-modal.modal-upsell');
    console.log('Checking for upsell modal...' , upsellModal);
    if (upsellModal) {
      const headline = upsellModal.querySelector('h2.modal-upsell__headline')?.innerText || '';
      const subtitle = upsellModal.querySelector('p.modal-upsell__subtitle')?.innerText || '';

      if (/unlimited personalized invites/i.test(headline) || /you’ve used all your monthly custom invites/i.test(subtitle)) {
        console.log('Detected invitation limit reached modal.');
        return { status: 'LIMIT_REACHED', message: 'Invitation limit reached (Premium upsell).' };
      }
    }

      const textarea = await waitForElement('textarea[name="message"]', 2000);
      if (textarea) {
        textarea.focus();
        textarea.value = note;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(500);
      }
    }

    // Click Send
    console.log('Looking for Send button...');
    const sendBtn = await waitForSendButton();
    if (!sendBtn) {
      return { status: 'FAILED', message: 'Send button not found.' };
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
    if (el.offsetParent === null) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

  
async function clickConnectButton(timeout = 5000) {
  return waitForElement(() => {
      const profileActions =
        document.querySelector('div.pv-top-card--list-actions, div.ph5') ||
        document.querySelector('div.display-flex.mt2');
      if (!profileActions) return null;
  
      // Check for main Connect button
      let btn = Array.from(profileActions.querySelectorAll('button, div[role="button"]'))
        .find(b => b.innerText.trim().toLowerCase() === 'connect' && isVisible(b));
      if (btn) return btn;
  
      // Fallback to More button
      const moreBtn = profileActions.querySelector('button[aria-label*="More actions"]');
      if (moreBtn && isVisible(moreBtn)) {
        moreBtn.click(); // open dropdown
  
        const dropdown = document.querySelector(
          '.artdeco-dropdown__content--is-dropdown-element, .artdeco-dropdown__content'
        );
  
        const connectInDropdown = Array.from(dropdown.querySelectorAll('button, div[role="button"]'))
          .find(b => b.innerText.trim().toLowerCase() === 'connect' && isVisible(b));
  
        if (connectInDropdown) return connectInDropdown;
      }
  
      return null;
  }, timeout);
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
  // Check for SUCCESS: "Invitation sent" toast or "Pending" button
  const successToast = document.querySelector('[role="alert"] .artdeco-toast-item__content, .artdeco-toast-item span[title*="Invitation sent"]');
  if (successToast && successToast.innerText.toLowerCase().includes('invitation sent')) {
    return 'SUCCESS';
  }

  // Check for a "Pending" button on the profile after interaction
  if (await waitForElement('button[aria-label*="Pending"]', 1000)) {
    return 'SUCCESS'; // Treat 'Pending' as a successful send
  }

  // Check for LinkedIn limit modal or toast
  const modalOrToast = document.querySelector('.artdeco-modal__content, .msg-overlay-bubble-header, [role="alert"], .artdeco-toast-item');
  if (modalOrToast) {
    const text = modalOrToast.innerText.toLowerCase();
    if (text.includes('you’ve used all your monthly custom invites') || text.includes('cannot send any more invitations')) {
      return 'LIMIT_REACHED';
    }
    if (text.includes('something went wrong') || text.includes('FAILED to send')) {
      return 'FAILED';
    }
  }
  
  // Check for generic error messages in the modal
  const errorInModal = document.querySelector('.artdeco-modal__content .artdeco-inline-feedback--error');
  if (errorInModal) {
    const text = errorInModal.innerText.toLowerCase();
    if (text.includes('limit reached') || text.includes('cannot send')) {
      return 'LIMIT_REACHED';
    }
    return 'FAILED';
  }

  // If we reach here, and no explicit SUCCESS/failure/limit was detected,
  // it's an unknown state. Consider it a failure for safety.
  return 'FAILED'; 
}

// ... (other functions like waitForElement, delay, createStatusPanel, addStatusItem, updateStatusHeader remain similar)

function updateStatusItem(id, status, message = '') { // Added message parameter
  const el = document.getElementById(`linkedin-status-${id}`);
  if (!el) return;

  let icon = '';
  let color = '';
  let tooltip = status;

  switch (status) {
    case 'SUCCESS':
      icon = '✅';
      color = '#28a745'; // Green
      tooltip = 'Invitation Sent';
      break;
    case 'LIMIT_REACHED':
      icon = '🚫';
      color = '#ffc107'; // Yellow/Orange
      tooltip = 'LinkedIn Invitation Limit Reached';
      break;
    case 'FAILED':
      icon = '❌';
      color = '#dc3545'; // Red
      tooltip = message || 'FAILED to send invitation';
      break;
    case 'error': // For unexpected script errors
      icon = '🚨';
      color = '#dc3545';
      tooltip = message || 'An unexpected error occurred';
      break;
    case 'PENDING':
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

  if (status === "SUCCESS") el.textContent = "✅";
  else if (status === "LIMIT_REACHED") el.textContent = "⛔"; // Limit reached
  else if (status === "FAILED") el.textContent = "⚠️";
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