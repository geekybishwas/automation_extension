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
      return; // Already exists
    }

    const panel = this._createPanelElement();
    
    // Hide panel initially
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(20px)';
    panel.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    document.body.appendChild(panel);

    this._injectStyles();
    this._attachEventListeners();
    
    // Don't show yet - wait for content to be added
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
    let logoHTML = '🔗'; // Fallback emoji
    try {
      const logoURL = chrome.runtime.getURL('icons/128.png');
      logoHTML = `<img src="${logoURL}" alt="Extension" style="width: 24px; height: 24px; margin-right: 8px; border-radius: 4px;" onerror="this.style.display='none'; this.parentElement.innerHTML='🔗';" />`;
    } catch (e) {
      // If chrome.runtime.getURL fails, use emoji
      logoHTML = '<span style="font-size: 24px; margin-right: 8px;">🔗</span>';
    }

    panel.innerHTML = `
      <div id="${this.HEADER_ID}" style="
        padding: 8px;
        border-bottom: 1px solid #f0f0f0;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #f8f8f8;
        color: #333;
        flex-direction: column;
      ">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div style="display: flex; align-items: center;">
            ${logoHTML}
          </div>
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
            ">⏹</button>
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
        <div id="${this.PROGRESS_ID}" style="
          font-size: 12px;
          color: #555;
          margin-top: 4px;
          width: 100%;
        "></div>
      </div>
      <div id="${this.LIST_ID}" style="
        max-height: 300px;
        overflow-y: auto;
        padding: 8px;
      "></div>
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

      #${this.PANEL_ID} #close-panel:hover {
        background-color: #e0e0e0;
      }

      #${this.PANEL_ID} #stop-btn:hover {
        background-color: rgba(220, 53, 69, 0.1);
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
        this.remove();
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