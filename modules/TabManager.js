// modules/TabManager.js
export class TabManager {
    static async createTab(url) {
      return await chrome.tabs.create({ url, active: false });
    }
  
    static async waitForTabLoad(tabId) {
      return new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(id, info) {
          if (id === tabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });
    }
    static async injectContentScript(tabId, filePath) {
      return chrome.scripting.executeScript({
        target: { tabId },
        func: async (path) => {
          // This is the bridge: it dynamically imports the file as a module
          await import(chrome.runtime.getURL(path));
        },
        args: [filePath]
      });
    }
  
    static async sendMessage(tabId, message) {
      return await chrome.tabs.sendMessage(tabId, message);
    }
  
    static async closeTab(tabId) {
      await chrome.tabs.remove(tabId);
    }
  }