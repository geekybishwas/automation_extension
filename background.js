// ============================================================================
// BACKGROUND SERVICE WORKER - LinkedIn Automation Extension
// ============================================================================

import { CONFIG,getUserMessage } from './config.js';
import { TabManager } from './modules/TabManager.js';
import { ActionProcessor } from './modules/ActionProcessor.js';
import { Logger } from './modules/Logger.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

class ExtensionState {
  constructor() {
    this.stopRequested = false;
    this.currentResults = [];
    this.currentAction = null;
  }

  reset() {
    this.stopRequested = false;
    this.currentResults = [];
    this.currentAction = null;
  }

  addResult(result) {
    this.currentResults.push(result);
  }

  requestStop() {
    this.stopRequested = true;
    Logger.info('Stop requested by user');
  }
}

const state = new ExtensionState();

// ============================================================================
// ACTION HANDLERS REGISTRY
// ============================================================================

const ACTION_HANDLERS = {
  likePostsOnLinkedIn: handleLikePosts,
  commentOnLinkedInPost: handleCommentPosts,
  connectMultiple: handleConnections,
  sendMultipleMessages: handleMessages,
  viewProfiles: handleProfileViews,
  checkConnectionStatus: handleStatusChecks,
  stopProcessing: handleStop
};

// ============================================================================
// MAIN MESSAGE LISTENER
// ============================================================================

console.log("Service worker started successfully!");


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({ status: "ok" });
  }
  return true;
});


chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const handler = ACTION_HANDLERS[message.action];
  
  if (!handler) {
    sendResponse({ 
      status: 'error', 
      message: `Unknown action: ${message.action}` 
    });
    return false;
  }

  // Execute handler asynchronously
  handler(message, sendResponse).catch(error => {
    Logger.error(`Handler failed for ${message.action}:`, error);
    sendResponse({ 
      status: 'error', 
      message: error.message 
    });
  });

  return true; // Keep channel open for async response
});

// Internal message listener (for popup/content scripts)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'stopProcessing') {
    handleStop(message, sendResponse);
    return false;
  }
});

// ============================================================================
// ACTION HANDLER IMPLEMENTATIONS
// ============================================================================

async function handleLikePosts(message, sendResponse) {
  const { posts } = message;
  
  if (!Array.isArray(posts) || posts.length === 0) {
    return sendResponse({ 
      status: 'error', 
      message: 'Invalid posts data' 
    });
  }

  state.reset();
  state.currentAction = 'like';

  const processor = new ActionProcessor({
    items: posts,
    action: 'like_post',
    contentScript: 'content.js',
    getItemData: (post, index, total) => ({
      action: 'like_post',
      current: index + 1,
      total
    }),
    onItemComplete: (result, item) => {
      state.addResult({ ...result, id: item.id, url: item.url });
    },
    shouldStop: () => state.stopRequested
  });

  const results = await processor.processAll();
  
  sendResponse({
    status: state.stopRequested ? 'stopped' : 'done',
    results
  });
}

async function handleCommentPosts(message, sendResponse) {
  const { targets } = message;
  
  if (!Array.isArray(targets) || targets.length === 0) {
    return sendResponse({ 
      status: 'error', 
      message: 'Invalid targets data' 
    });
  }

  state.reset();
  state.currentAction = 'comment';

  const processor = new ActionProcessor({
    items: targets,
    action: 'comment_on_post',
    contentScript: 'content.js',
    getItemData: (item, index, total) => ({
      action: 'comment_on_post',
      comment: item.comment || 'Great post!',
      current: index + 1,
      total
    }),
    onItemComplete: (result, item) => {
      state.addResult({ ...result, id: item.id, url: item.url });
    },
    shouldStop: () => state.stopRequested
  });

  const results = await processor.processAll();
  
  sendResponse({
    status: state.stopRequested ? 'stopped' : 'done',
    results
  });
}

async function handleConnections(message, sendResponse) {
  const { connections } = message;
  
  if (!Array.isArray(connections) || connections.length === 0) {
    return sendResponse({ 
      status: 'error', 
      message: 'Invalid connections data' 
    });
  }

  state.reset();
  state.currentAction = 'connect';

  const processor = new ActionProcessor({
    items: connections,
    action: 'sendConnectionRequest',
    contentScript: 'content.js',
    pageLoadDelay: CONFIG.delays.pageLoad,
    getItemData: (item, index, total) => ({
      action: 'sendConnectionRequest',
      note: item.note || CONFIG.defaults.connectionNote,
      id: item.id,
      current: index + 1,
      total,
      url: item.url
    }),
    onItemComplete: (result, item) => {
      state.addResult({ ...result, id: item.id, url: item.url });
    },
    shouldStop: () => state.stopRequested
  });

  const results = await processor.processAll();
  
  sendResponse({
    status: state.stopRequested ? 'stopped' : 'done',
    results
  });
}

async function handleMessages(message, sendResponse) {
  const { targets } = message;
  
  if (!Array.isArray(targets) || targets.length === 0) {
    return sendResponse({ 
      status: 'error', 
      message: 'Invalid targets data' 
    });
  }

  state.reset();
  state.currentAction = 'message';

  const processor = new ActionProcessor({
    items: targets,
    action: 'sendLinkedInMessage',
    contentScript: 'content.js',
    pageLoadDelay: CONFIG.delays.pageLoad,
    getItemData: (item, index, total) => ({
      action: 'sendLinkedInMessage',
      message: item.message,
      id: item.id,
      current: index + 1,
      total,
      url: item.url
    }),
    onItemComplete: (result, item) => {
      state.addResult({ ...result, id: item.id, url: item.url });
    },
    shouldStop: () => state.stopRequested
  });

  const results = await processor.processAll();
  
  sendResponse({
    status: state.stopRequested ? 'stopped' : 'done',
    results
  });
}

async function handleProfileViews(message, sendResponse) {
  const { urls } = message;
  
  if (!Array.isArray(urls) || urls.length === 0) {
    return sendResponse({ 
      status: 'error', 
      message: 'Invalid urls data' 
    });
  }

  state.reset();
  state.currentAction = 'view';

  const processor = new ActionProcessor({
    items: urls,
    action: 'viewProfile', // Changed from null to 'viewProfile'
    contentScript: 'content.js',
    skipContentScriptAction: false, // Changed to false so content script runs
    pageLoadDelay: CONFIG.delays.profileView + Math.random() * 2000,
    getItemData: (item, index, total) => ({
      action: 'viewProfile', // Pass action to content script
      current: index + 1,
      total
    }),
    onItemComplete: (result, item) => {
      state.addResult({ ...result, id: item.id, url: item.url });
    },
    shouldStop: () => state.stopRequested
  });

  const results = await processor.processAll();
  
  sendResponse({
    status: state.stopRequested ? 'stopped' : 'done',
    results
  });
}
// async function handleProfileViews(message, sendResponse) {
//   const { urls } = message;
  
//   if (!Array.isArray(urls) || urls.length === 0) {
//     return sendResponse({ 
//       status: 'error', 
//       message: 'Invalid urls data' 
//     });
//   }

//   state.reset();
//   state.currentAction = 'view';

//   const processor = new ActionProcessor({
//     items: urls,
//     action: null, // View only, no content script action needed
//     contentScript: 'content.js',
//     skipContentScriptAction: true,
//     pageLoadDelay: CONFIG.delays.profileView + Math.random() * 2000,
//     getItemData: (item) => ({}),
//     onItemComplete: (result, item) => {
//       state.addResult({ 
//         id: item.id, 
//         url: item.url, 
//         status: 'SUCCESS' ,
//         value: getUserMessage('viewProfile', 'SUCCESS') 
//       });
//     },
//     shouldStop: () => state.stopRequested
//   });

//   const results = await processor.processAll();
  
//   sendResponse({
//     status: state.stopRequested ? 'stopped' : 'done',
//     results
//   });
// }

async function handleStatusChecks(message, sendResponse) {
  const { connections } = message;
  
  if (!Array.isArray(connections) || connections.length === 0) {
    return sendResponse({ 
      status: 'error', 
      message: 'Invalid connections data' 
    });
  }

  state.reset();
  state.currentAction = 'status_check';

  const processor = new ActionProcessor({
    items: connections,
    action: 'checkConnectionStatus',
    contentScript: 'content.js',
    getItemData: (item, index, total) => ({
      action: 'checkConnectionStatus',
      current: index + 1,
      total
    }),
    onItemComplete: (result, item) => {
      state.addResult({ 
        id: item.id, 
        url: item.url,
        status: result.status,
        message: result.message || ''
      });
    },
    shouldStop: () => state.stopRequested
  });

  const results = await processor.processAll();
  
  sendResponse({
    status: state.stopRequested ? 'stopped' : 'done',
    results
  });
}

async function handleStop(message, sendResponse) {
  state.requestStop();
  sendResponse({ status: 'stopping' });
}

// ============================================================================
// LIFECYCLE
// ============================================================================

Logger.info('LinkedIn Automation Extension - Background service worker loaded');