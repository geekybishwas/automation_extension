// ============================================================================
// LINKEDIN DOM MODULE
// Low-level DOM manipulation and element finding for LinkedIn
// ============================================================================

import { CONFIG } from '../config.js';
import { delay } from '../modules/Utils.js';

export class LinkedInDOM {
  /**
   * Wait for page to be fully loaded
   */
  static async waitForPageLoad() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 2000);
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 2000);
        });
      }
    });
  }

  /**
   * Check if element is visible
   */
  static isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null) return false;
    
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  /**
   * Wait for element to appear and be visible
   */
  static async waitForElement(selectorOrFunction, timeout = CONFIG.timeouts.elementWait) {
    return new Promise(resolve => {
      const isFunction = typeof selectorOrFunction === 'function';

      // Try immediate
      const immediate = isFunction
        ? selectorOrFunction()
        : document.querySelector(selectorOrFunction);

      if (immediate) {
        resolve(immediate);
        return;
      }

      // Set up observer
      const observer = new MutationObserver(() => {
        const element = isFunction
          ? selectorOrFunction()
          : document.querySelector(selectorOrFunction);

        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Timeout
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Wait for element to be visible
   */
  static async waitUntilVisible(selector, timeout = CONFIG.timeouts.elementWait) {
    return this.waitForElement(() => {
      const el = document.querySelector(selector);
      return el && this.isVisible(el) ? el : null;
    }, timeout);
  }

  /**
   * Find visible button by text content
   */
  static findVisibleButton(text, container = document) {
    const buttons = container.querySelectorAll('button, div[role="button"], a[role="button"]');
    
    return Array.from(buttons).find(btn => {
      if (!this.isVisible(btn)) return false;
      
      const btnText = btn.innerText.trim().toLowerCase();
      return btnText === text.toLowerCase();
    });
  }

  /**
   * Safely click element with scroll and focus
   */
  static async clickElement(element) {
    if (!element) {
      throw new Error('Element not found for clicking');
    }

    // Scroll into view
    try {
      element.scrollIntoView({ block: 'center', behavior: 'auto' });
    } catch (e) {
      // Ignore scroll errors
    }

    await delay(CONFIG.delays.shortDelay);

    // Focus element
    if (element.focus) {
      element.focus();
    }

    // Full click sequence for LinkedIn compatibility
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.click();
  }


  /**
 * Check if profile is already connected
 */
static async isConnected() {
    const container = document.querySelector(CONFIG.selectors.profileActions);
    if (!container) return false;

    // Fast check: Message / Pending / Following
    const indicators = ['message', 'pending', 'following'];

    const buttons = container.querySelectorAll(
      'button, div[role="button"], a[role="button"]'
    );

    const directIndicator = Array.from(buttons).some(btn => {
      if (!this.isVisible(btn)) return false;
      const text = btn.innerText.trim().toLowerCase();
      return indicators.includes(text);
    });

    if (directIndicator) return true;

    // Deep check: "Remove connection" inside More menu
    const removeBtn = await this.findRemoveConnectionButton();
    return !!removeBtn;
  }


  /**
   * Type text into element naturally
   */
  static async typeText(element, text, speed = CONFIG.delays.typing) {
    if (!element) {
      throw new Error('Element not found for typing');
    }

    element.focus();

    for (const char of text) {
      document.execCommand('insertText', false, char);
      await delay(speed);
    }

    // Trigger events
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Get profile information from page
   */
  static getProfileInfo() {
    const name = document.querySelector(CONFIG.selectors.profileName)?.innerText.trim() || 'Unknown Profile';
    const headline = document.querySelector(CONFIG.selectors.profileHeadline)?.innerText.trim() || '';
    
    return { name, headline };
  }

  /**
   * Get post author name
   */
  static getPostAuthor() {
    const selectors = [
      '.update-components-actor__title span[aria-hidden="true"]',
      '.feed-shared-actor__name',
      'h1'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.innerText.trim();
    }

    return 'LinkedIn Post';
  }

  /**
   * Check for pending invitation button
   */
  static hasPendingButton() {
    return !!document.querySelector(CONFIG.selectors.pendingButton);
  }

  /**
   * Find Connect button (direct or in More menu)
   */
  static async findConnectButton() {
    const container = document.querySelector(CONFIG.selectors.profileActions);
    if (!container) return null;

    // Check direct Connect button
    const directBtn = this.findVisibleButton('connect', container);
    if (directBtn) return { button: directBtn, inDropdown: false };

    // Check More dropdown
    const moreBtn = container.querySelector(CONFIG.selectors.moreButton);
    if (!moreBtn || !this.isVisible(moreBtn)) return null;

    // Click More to open dropdown
    await this.clickElement(moreBtn);
    await delay(CONFIG.delays.shortDelay);

    const dropdown = await this.waitUntilVisible(CONFIG.selectors.dropdown, 3000);
    if (!dropdown) return null;

    await delay(500); // Wait for dropdown animation

    const connectBtn = this.findVisibleButton('connect', dropdown);

    await delay(1000);

    return connectBtn ? { button: connectBtn, inDropdown: true } : null;
  }

  /**
   * Detect connection result from LinkedIn's UI
   */
  static async detectConnectionResult() {
    // Success indicators
    const successToast = document.querySelector('[role="alert"] .artdeco-toast-item__content');

    if (successToast?.innerText.toLowerCase().includes('invitation sent')) {
      return CONFIG.statuses.SUCCESS;
    }

    // Check for Pending button
    const pendingBtn = await this.waitForElement(CONFIG.selectors.pendingButton, 2000);
    if (pendingBtn) {
      console.log('Pending button found, indicating connection request is still pending.');
      return CONFIG.statuses.SUCCESS;
    }

    console.log('No pending button found, checking for limit/error modals...');

    // Check for limit/error modals
    const modal = document.querySelector(CONFIG.selectors.modal);

    console.log('Modal found:', !!modal);

    if (modal) {
      const text = modal.innerText.toLowerCase();
      
      if (text.includes('you\'ve used all your monthly custom invites') ||
          text.includes('cannot send any more invitations')) {
        return CONFIG.statuses.LIMIT_REACHED;
      }

      if (text.includes('something went wrong') || text.includes('failed to send')) {
        return CONFIG.statuses.FAILED;
      }
    }

    // Check for inline errors
    const error = document.querySelector(CONFIG.selectors.error);
    if (error) {
      const text = error.innerText.toLowerCase();
      if (text.includes('limit reached') || text.includes('cannot send')) {
        return CONFIG.statuses.LIMIT_REACHED;
      }
      return CONFIG.statuses.FAILED;
    }

    return CONFIG.statuses.SUCCESS;
  }

  /**
   * Close any open message panels
   */
  static async closeMessagePanels() {
    const closeBtn = document.querySelector(CONFIG.selectors.messageClose);
    if (closeBtn && this.isVisible(closeBtn)) {
      await this.clickElement(closeBtn);
      await delay(CONFIG.delays.mediumDelay);
    }
  }

  /**
   * Close message overlay bubble
   */
  static async closeMessageOverlay() {
    const buttons = document.querySelectorAll(CONFIG.selectors.messageOverlayClose);
    
    for (const btn of buttons) {
      const svgUse = btn.querySelector('svg use');
      if (svgUse?.getAttribute('href') === '#close-small' && this.isVisible(btn)) {
        await this.clickElement(btn);
        await delay(CONFIG.delays.mediumDelay);
        return;
      }
    }
  }
}