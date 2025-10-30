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
        else if (message.action === 'checkConnectionStatus') {
          const statusResult = await checkConnectionStatus(); // no redefinition
          sendResponse({ ...statusResult, url: message.url || location.href });
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

  async function checkConnectionStatus() {
    try {
      await waitForPageLoad();
      createStatusPanel(); // Ensure panel is ready
  
      const profileName = document.querySelector("h1")?.innerText.trim() || "Unknown Profile";
      const headline = document.querySelector(".text-body-medium.break-words")?.innerText.trim() || "Headline not available";
      addStatusItem(0, 1, profileName, headline); // Add a single status item for this check
  
      // 1️⃣ Check for 'Pending' button first
      const pendingBtn = await waitForElement(() =>
        Array.from(document.querySelectorAll('button[aria-label*="Pending"], button span[aria-label*="Pending"], button'))
          .find(b => isVisible(b) && (b.innerText.trim().toLowerCase().includes('pending') || b.getAttribute('aria-label')?.toLowerCase().includes('pending')))
        , 2000); // Shorter timeout as it's a primary check
  
      if (pendingBtn) {
        updateStatusItem('PENDING');
        await delay(1000);
        return { status: 'PENDING', message: 'Invitation already sent (Pending).' };
      }
  
      // 2️⃣ Check for 'Connect' button directly on the profile
      const profileActionsContainer = document.querySelector('div.pv-top-card--list-actions') || document.querySelector('div.ph5');
      if (!profileActionsContainer) {
        updateStatusItem('ERROR', 'Profile actions container not found');
        await delay(1000);
        return { status: 'ERROR', message: 'Profile actions container not found.' };
      }
  
      const directConnectBtn = Array.from(profileActionsContainer.querySelectorAll('button, div[role="button"]'))
        .find(b => isVisible(b) && b.innerText.trim().toLowerCase() === 'connect');
  
      if (directConnectBtn) {
        updateStatusItem('NOT_CONNECTED');
        await delay(1000);
        return { status: 'NOT_CONNECTED', message: 'Connect button available directly.' };
      }
  
      // 3️⃣ Check "More" dropdown for Connect button
      const moreBtn = profileActionsContainer.querySelector('button[aria-label*="More"]');

      console.log('More button found:', moreBtn);
      if (moreBtn && isVisible(moreBtn)) {
        console.log('Clicking "More" button to check dropdown...');
        moreBtn.click();
        await delay(300); 
        const dropdown = await waitUntilVisible(
          'div.artdeco-dropdown__content[aria-hidden="false"], div.artdeco-dropdown__content[role="menu"]',
          8000
        );

        console.log('Dropdown after More click:', dropdown);

        await delay(5000);
      
        if (dropdown) {
          const connectInDropdown = Array.from(dropdown.querySelectorAll('div[role="button"], button'))
            .find(b => isVisible(b) && b.innerText.trim().toLowerCase().includes('connect'));
          

          if (connectInDropdown) {
            updateStatusItem('NOT_CONNECTED');
            await delay(500);
            return { status: 'NOT_CONNECTED', message: 'Connect button available in "More" menu.' };
          } else {
            updateStatusItem('CONNECTED');
            await delay(500);
            return { status: 'CONNECTED', message: 'Already connected or no Connect button in More menu.' };
          }
        } else {
          updateStatusItem('ERROR', 'More dropdown did not appear.');
          return { status: 'ERROR', message: 'More dropdown did not appear after click.' };
        }
      }
      
  
      // 4️⃣ Default fallback: If no Pending, no direct Connect, and no Connect in More, assume CONNECTED
      updateStatusItem('CONNECTED');
      await delay(1000);
      return { status: 'CONNECTED', message: 'No "Connect" or "Pending" indicators found, assuming already connected.' };
  
    } catch (err) {
      console.error('❌ checkConnectionStatus error:', err);
      updateStatusItem('error', `DOM interaction failed: ${err.message || 'Unknown error'}`);
      await delay(1000);
      return { status: 'ERROR', message: `DOM interaction failed: ${err.message || 'Unknown error'}` };
    } finally {
      // Optionally remove the status panel after a short delay
      // This allows the user to see the result briefly
      setTimeout(() => {
        const panel = document.getElementById("linkedin-status-panel");
        if (panel) panel.remove();
      }, 5000);
    }
  }
  

async function sendLinkedInMessage(messageText) {
  let finalStatus = "FAILED"; // Default status
  const total = 1;
  const id = 0;

  try {
    console.log("🔍 Starting message sending process...");

    await waitForPageLoad();
    createStatusPanel();

    const profileName = document.querySelector("h1")?.innerText.trim() || "Unknown Profile";
    const headline = document.querySelector(".text-body-medium.break-words")?.innerText.trim() || "Headline not available";

    addStatusItem(id, total, profileName, headline);

    await closeAnyOpenMessagePanels();
    await delay(800);

    if (document.querySelector('button[aria-label*="Pending"]')) {
      finalStatus = 'PENDING';
      throw new Error("Invitation pending. Message skipped.");
    }

    const messageButton = await waitForElement(() =>
      Array.from(document.querySelectorAll('button, a[role="button"]'))
        .find(b => isVisible(b) && b.innerText.trim().toLowerCase() === 'message')
    , 6000);

    if (!messageButton) {
      finalStatus = "SKIPPED";
      throw new Error("No Message button available");
    }

    messageButton.click();
    await delay(1500);

    const inputEl = await waitForElement(() =>
      document.querySelector('div.msg-form__contenteditable[role="textbox"]')
    , 8000);

    if (!inputEl) throw new Error("Message input not found!");

    console.log("✍️ Typing message...");
    await insertTextProperly(inputEl, messageText, 40);
    await delay(1200);

    const sendBtn = await waitForElement(() =>
      Array.from(document.querySelectorAll('button[type="submit"], button.msg-form__send-button, button[aria-label*="Send"]'))
        .find(btn => isVisible(btn) && !btn.disabled && btn.innerText.trim().toLowerCase() === 'send')
    , 7000);

    if (!sendBtn) throw new Error("Send button missing!");

    sendBtn.click();
    await delay(2500);

    await closeMessageOverlayBubble();

    console.log("✅ Message sending finished!");
    finalStatus = "SUCCESS";

  } catch (err) {
    console.error("❌ Error sending message:", err.message);
    await closeAnyOpenMessagePanels();
  }

  // ✅ Always update the status panel
  updateStatusItem(id, finalStatus);

  return {
    id,
    status: finalStatus,
    message: `Message status: ${finalStatus}`
  };
}

// Close main modal (Dismiss / Close chat)
async function closeAnyOpenMessagePanels() {
  const modalCloseBtn = document.querySelector('button[aria-label*="Dismiss"], button[aria-label*="Close chat"], button[aria-label="Close"]');
  if (modalCloseBtn && isVisible(modalCloseBtn)) {
    console.log("🛑 Closing main modal...");
    modalCloseBtn.click();
    await delay(1000);
  }
}

// Close overlay bubble (the correct X button, not minimize)
async function closeMessageOverlayBubble() {
  const overlayCloseBtn = Array.from(document.querySelectorAll('button.msg-overlay-bubble-header__control'))
    .find(btn => {
      const svgUse = btn.querySelector('svg use');
      return svgUse && svgUse.getAttribute('href') === '#close-small';
    });

  if (overlayCloseBtn && isVisible(overlayCloseBtn)) {
    console.log("🛑 Closing overlay message bubble (X button)...");
    overlayCloseBtn.click();
    await delay(1000);
  } else {
    console.warn("⚠️ Overlay close button not found.");
  }
}

async function insertTextProperly(element, text, delayTime = 50) {
  element.focus();

  for (let char of text) {
    document.execCommand("insertText", false, char);
    await new Promise(res => setTimeout(res, delayTime)); // Typing speed control
  }

  element.dispatchEvent(new InputEvent("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}


async function handleConnectionRequest({ note, id, total, name }) {
  console.log(`Starting connection request for ${name} (${id + 1}/${total})`);
  let finalStatus = 'FAILED'; // Default to FAILED
  
  try {
    await waitForPageLoad();
    createStatusPanel();
   
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

    // ✅ First check Pending state (most reliable for success)
    const pendingBtn = await waitForElement(
      'button[aria-label*="Pending"], button:has(span[aria-label*="Pending"])',
      5000
    );

    if (pendingBtn) {
      console.log("✅ Success: Pending button detected!");
      return { status: 'SUCCESS', message: 'Invitation sent successfully.' };
    }

    await delay(2000); // small fallback wait

    // ✅ Fallback detection (toast, modal, errors)
    const result = await detectConnectionResult();
    console.log("🔍 detectConnectionResult():", result);

    return { status: result, message: result };



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

  
async function waitUntilVisible(selector, timeout = 5000) {
  return waitForElement(() => {
    const el = document.querySelector(selector);
    return el && isVisible(el) ? el : null;
  }, timeout);
}

async function clickConnectButton() {
  const profileActions =
    document.querySelector('div.pv-top-card--list-actions') ||
    document.querySelector('div.ph5');

  if (!profileActions) return null;

  // ✅ Try main Connect button first
  const directBtn = [...profileActions.querySelectorAll('button, div[role="button"]')]
    .find(b => b.innerText.trim().toLowerCase() === "connect" && isVisible(b));

  if (directBtn) {
    console.log("✅ Clicking direct Connect button");
    directBtn.click();
    return directBtn;
  }

  // ✅ Fallback to “More”
  const moreBtn = profileActions.querySelector('button[aria-label*="More"]');

  if (!moreBtn && !isVisible(moreBtn)) return null;

  console.log("🔄 Clicking More button");
  moreBtn.click();
  await delay(300); 


  const dropdown = await waitUntilVisible(
    'div.artdeco-dropdown__content[aria-hidden="false"], div.artdeco-dropdown__content[role="menu"]',
    8000
  );

  console.log('Dropdown after More click:', dropdown);

  await delay(2000);
  if (!dropdown) {
    console.log("❌ Dropdown didn't appear");
    return null;
  }

  console.log("✅ Dropdown visible:", dropdown);

  // ✅ Look for Connect in the dropdown
  const connectBtn = [...dropdown.querySelectorAll('div[role="button"], button')]
    .find(b => b.innerText.trim().toLowerCase().includes("connect") && isVisible(b));

  console.log('Connect button in dropdown:', connectBtn);

  if (!connectBtn) {
    console.log("❌ Connect not found inside dropdown");
    return null;
  }

  console.log("✅ Clicking Connect from dropdown:", connectBtn);

  // ✅ CLICK BEFORE RETURNING to avoid navigation racing
  connectBtn.click();
  await delay(800); // small buffer for modal to appear

  return connectBtn;
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

  console.log('Checking for success toast:', successToast);

  if (successToast && successToast.innerText.toLowerCase().includes('invitation sent')) {
    return 'SUCCESS';
  }

  // Check for a "Pending" button on the profile after interaction
  if (await waitForElement('button[aria-label*="Pending"]', 1000)) {

    console.log('Pending button found, treating as successful send.');
    return 'SUCCESS'; // Treat 'Pending' as a successful send
  }

  // Check for LinkedIn limit modal or toast
  const modalOrToast = document.querySelector('.artdeco-modal__content, .msg-overlay-bubble-header, [role="alert"], .artdeco-toast-item');
  console.log('Checking for limit/error modal or toast:', modalOrToast);

  await delay(10000);
  if (modalOrToast) {
    const text = modalOrToast.innerText.toLowerCase();
    if (text.includes('you’ve used all your monthly custom invites') || text.includes('cannot send any more invitations')) {

      console.log('Limit reached message detected.');
      return 'LIMIT_REACHED';
    }
    if (text.includes('something went wrong') || text.includes('FAILED to send')) {
      console.log('Error message detected, treating as failed.');
      return 'FAILED';
    }
  }
  
  // Check for generic error messages in the modal
  const errorInModal = document.querySelector('.artdeco-modal__content .artdeco-inline-feedback--error');
  console.log('Checking for error messages in modal:', errorInModal);

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

function updateStatusItem(status, message = '') { // Added message parameter
  const el = document.getElementById(`linkedin-status`);
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

function createStatusPanel() {
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

function updateStatusItem(status) {
  const el = document.getElementById(`linkedin-status`);
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