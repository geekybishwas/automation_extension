// ============================================================================
// ACTION PROCESSOR MODULE
// Generic processor for batch LinkedIn actions with error handling and retries
// ============================================================================

import { CONFIG, getUserMessage } from '../config.js';
import { TabManager } from './TabManager.js';
import { Logger } from './Logger.js';
import { delay } from './Utils.js';

export class ActionProcessor {
  /**
   * @param {Object} config - Processor configuration
   * @param {Array} config.items - Items to process
   * @param {string} config.action - Action type to perform
   * @param {string} config.contentScript - Content script file
   * @param {Function} config.getItemData - Function to prepare message data
   * @param {Function} config.onItemComplete - Callback after each item
   * @param {Function} config.shouldStop - Function to check if processing should stop
   * @param {number} config.pageLoadDelay - Custom delay after page load
   * @param {boolean} config.skipContentScriptAction - Skip sending action to content script
   */
  constructor(config) {
    this.items = config.items || [];
    this.action = config.action;
    this.contentScript = config.contentScript;
    this.getItemData = config.getItemData;
    this.onItemComplete = config.onItemComplete || (() => {});
    this.shouldStop = config.shouldStop || (() => false);
    this.pageLoadDelay = config.pageLoadDelay || 0;
    this.skipContentScriptAction = config.skipContentScriptAction || false;
    
    this.results = [];
  }

  /**
   * Process all items in sequence
   * @returns {Promise<Array>} Array of results
   */
  async processAll() {
    Logger.info(`Starting batch processing: ${this.items.length} items`);

    for (let index = 0; index < this.items.length; index++) {
      if (this.shouldStop()) {
        Logger.info('Processing stopped by user request');
        break;
      }

      const item = this.items[index];
      const result = await this.processItem(item, index);
      
      this.results.push(result);
      this.onItemComplete(result, item);
    }

    Logger.info(`Batch processing complete: ${this.results.length} items processed`);
    return this.results;
  }

  /**
   * Process a single item
   * @param {Object} item - The item to process
   * @param {number} index - Item index in the batch
   * @returns {Promise<Object>} Result object
   */
  async processItem(item, index) {
    const { id, url } = item;
    let tabId = null;

    try {
      Logger.debug(`Processing item ${index + 1}/${this.items.length}: ${url}`);

      // Create tab
      const tab = await TabManager.createTab(url);
      tabId = tab.id;

      // Wait for page to load
      await TabManager.waitForTabLoad(tabId);

      // Custom delay after page load (for dynamic content)
      if (this.pageLoadDelay) {
        await delay(this.pageLoadDelay);
      }

      // Inject content script
      await TabManager.injectContentScript(tabId, this.contentScript);

      let result;

      if (this.skipContentScriptAction) {
        // Just viewing the page, no action needed
        result = { status: CONFIG.statuses.SUCCESS };
      } else {
        // Send action message to content script
        const messageData = this.getItemData(item, index, this.items.length);
        result = await TabManager.sendMessage(tabId, messageData);
      }

      // Add delay before closing tab
      await delay(CONFIG.delays.beforeTabClose);

      // Add user-friendly message for external app
      const userMessage = getUserMessage(this.action, result.status);

      return {
        ...result,
        id,
        url,
        index: index + 1,
        value: userMessage
      };

    } catch (error) {
      Logger.error(`Error processing item ${index + 1}:`, error);
      const userMessage = getUserMessage(this.action, CONFIG.statuses.ERROR);
      
      return {
        id,
        url,
        index: index + 1,
        status: CONFIG.statuses.ERROR,
        message: error.message || 'Unknown error occurred',
        value: userMessage
      };

    } finally {
      // Always attempt to close the tab
      if (tabId) {
        await TabManager.closeTab(tabId).catch(() => {
          Logger.warn(`Failed to close tab ${tabId}, continuing...`);
        });
      }
    }
  }

  /**
   * Get current progress
   * @returns {Object} Progress information
   */
  getProgress() {
    return {
      total: this.items.length,
      completed: this.results.length,
      remaining: this.items.length - this.results.length,
      percentage: Math.round((this.results.length / this.items.length) * 100)
    };
  }
}