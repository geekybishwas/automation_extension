// ============================================================================
// STATUS UI MODULE
// Manages the floating status panel for user feedback
// ============================================================================

import { CONFIG } from '../config.js';

export class StatusUI {
  static PANEL_ID = 'linkedin-status-panel';
  static HEADER_ID = 'linkedin-status-header';
  static LIST_ID = 'linkedin-status-list';
  static PROGRESS_ID = 'executing-header';
  static SPINNER_STYLE_ID = 'linkedin-spinner-style';

  /**
   * Create the status panel
   */
  static create() {
    if (document.getElementById(this.PANEL_ID)) {
      return;
    }

    const panel = this._createPanelElement();

    // Hide panel initially
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(20px)';
    panel.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    document.body.appendChild(panel);

    this._injectStyles();
    this._attachEventListeners();

  }

  /**
   * Show the panel with animation (called after content is added)
   */
  static show() {
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    // Small delay to ensure DOM has updated
    setTimeout(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    }, 50);
  }

  /**
   * Remove the status panel
   */
  static remove() {
    const panel = document.getElementById(this.PANEL_ID);
    if (panel) {
      panel.remove();
    }
  }

  /**
   * Update progress header (e.g., "Executing 3 of 10")
   */
  static updateProgress(current, total) {
    const header = document.getElementById(this.PROGRESS_ID);
    if (!header) return;

    if (current && total) {
      header.textContent = `Executing ${current} of ${total}`;
    } else {
      header.textContent = '';
    }
  }

  /**
   * Add a status item to the list
   */
  static addItem(name, subtitle = '') {
    const list = document.getElementById(this.LIST_ID);
    if (!list) return null;

    const itemId = `status-item-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const item = document.createElement('div');
    item.id = itemId;
    item.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 4px;
      border-bottom: 1px solid #f0f0f0;
    `;

    item.innerHTML = `
      <div>
        <div style="font-weight:500">${this._escapeHtml(name || 'Unknown')}</div>
        ${subtitle ? `<div style="font-size:12px;color:#666">${this._escapeHtml(subtitle)}</div>` : ''}
      </div>
      <span id="${itemId}-status">
        ${this._getSpinnerHTML()}
      </span>
    `;

    list.appendChild(item);

    // Show panel now that content is added
    this.show();

    return itemId;
  }

  /**
   * Update a specific status item
   */
  static updateItem(itemId, status, message = '') {
    const statusEl = document.getElementById(`${itemId}-status`);
    if (!statusEl) return;

    const icon = CONFIG.ui.statusIcons[status] || '⏳';
    const color = CONFIG.ui.statusColors[status] || '#0073b1';
    const tooltip = message || status;

    statusEl.innerHTML = `
      <span style="color:${color};font-size:1.2em;" title="${this._escapeHtml(tooltip)}">
        ${icon}
      </span>
    `;
  }

  /**
   * Show result in the most recent item
   */
  static showResult(status, message = '') {
    const list = document.getElementById(this.LIST_ID);
    if (!list) return;

    const lastItem = list.lastElementChild;
    if (!lastItem) return;

    const statusEl = lastItem.querySelector('[id$="-status"]');
    if (!statusEl) return;

    const icon = CONFIG.ui.statusIcons[status] || '⏳';
    const color = CONFIG.ui.statusColors[status] || '#0073b1';
    const tooltip = message || status;

    statusEl.innerHTML = `
      <span style="color:${color};font-size:1.2em;" title="${this._escapeHtml(tooltip)}">
        ${icon}
      </span>
    `;
  }

  /**
   * Create the panel DOM element
   * @private
   */
  static _createPanelElement() {
    const panel = document.createElement('div');
    panel.id = this.PANEL_ID;
    panel.style.cssText = `
      position: fixed;
      right: ${CONFIG.ui.panel.position.right};
      bottom: ${CONFIG.ui.panel.position.bottom};
      width: ${CONFIG.ui.panel.width};
      background: #fff;
      border: 1px solid rgba(0,0,0,0.15);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      border-radius: 8px;
      font-family: Segoe UI, Roboto, sans-serif;
      z-index: 999999;
    `;

    // Try to get logo URL, fallback to emoji if fails
    let logoHTML = '🔗';
    try {
      const logoURL = chrome.runtime.getURL('icons/128.png');
      logoHTML = `<img src="${logoURL}" alt="Extension" style="width: 24px; height: 24px; margin-right: 8px; border-radius: 4px;" onerror="this.style.display='none'; this.parentElement.innerHTML='🔗';" />`;
    } catch (e) {
      // If chrome.runtime.getURL fails
      logoHTML = '<span style="font-size: 24px; margin-right: 8px;">🔗</span>';
    }

    panel.innerHTML = `
  <div id="${this.HEADER_ID}" style="
    padding: 8px;
    border-bottom: 1px solid #f0f0f0;
    font-weight: 600;
    background-color: #f8f8f8;
    color: #333;
  ">
    <!-- Top row -->
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    ">
      <!-- Logo -->
      <div style="display: flex; align-items: center;">
        ${logoHTML}
      </div>

      <!-- Action buttons -->
      <div style="display: flex; align-items: center; gap: 4px;">
      <button
        id="stop-btn"
        title="Stop"
        aria-label="Stop execution"
        style="
          width: 18px;
          height: 18px;
          background: #dc2626;
          border: none;
          border-radius: 5px;
          padding: 4px; /* was 3px */
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        "
      >
        <div
          style="
            width: 12px;      /* smaller */
            height: 12px;     /* smaller */
            background: #ffffff;
            border-radius: 3px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.15);
          "
        ></div>
      </button>
        <button
        id="close-panel"
        title="Close"
        aria-label="Close panel"
        style="
          width: 24px;
          height: 24px;
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          transition: all 0.15s ease;
        "
        onmouseenter="this.style.background='#f3f4f6'; this.style.color='#374151';"
        onmouseleave="this.style.background='transparent'; this.style.color='#666';"
        >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="2" y1="2" x2="10" y2="10" />
          <line x1="10" y1="2" x2="2" y2="10" />
        </svg>
      </button>
      </div>
    </div>

    <!-- Progress text -->
    <div
      id="${this.PROGRESS_ID}"
      style="
        font-size: 12px;
        color: #555;
        margin-top: 4px;
        width: 100%;
      "
    ></div>
  </div>

  <div
    id="${this.LIST_ID}"
    style="
      max-height: 300px;
      overflow-y: auto;
      padding: 8px;
    "
  ></div>
`;
    return panel;
  }

  /**
   * Inject CSS styles
   * @private
   */
  static _injectStyles() {
    if (document.getElementById(this.SPINNER_STYLE_ID)) {
      return; // Already injected
    }

    const style = document.createElement('style');
    style.id = this.SPINNER_STYLE_ID;
    style.textContent = `
      .linkedin-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #ccc;
        border-top: 2px solid #0073b1;
        border-radius: 50%;
        animation: linkedin-spin 0.8s linear infinite;
        display: inline-block;
      }

      @keyframes linkedin-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      #${this.PANEL_ID} #stop-btn:active {
        transform: scale(0.95);
      }

      #${this.PANEL_ID} #close-panel:active {
        transform: scale(0.95);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   * @private
   */
  static _attachEventListeners() {
    const stopBtn = document.getElementById('stop-btn');
    const closeBtn = document.getElementById('close-panel');

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stopProcessing' });
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stopProcessing' });
      });
    }
  }

  /**
   * Get spinner HTML
   * @private
   */
  static _getSpinnerHTML() {
    return '<div class="linkedin-spinner"></div>';
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  static _escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
}