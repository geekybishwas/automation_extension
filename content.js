// ============================================================================
// CONTENT SCRIPT - LinkedIn Page Interactions
// Handles all DOM manipulation and LinkedIn-specific actions
// ============================================================================

import { LinkedInActions } from './content/LinkedInActions.js';
import { StatusUI } from './content/StatusUI.js';
import { Logger } from './modules/Logger.js';

// ============================================================================
// MESSAGE ROUTER
// ============================================================================

const ACTION_HANDLERS = {
  sendConnectionRequest: LinkedInActions.sendConnectionRequest,
  sendLinkedInMessage: LinkedInActions.sendMessage,
  checkConnectionStatus: LinkedInActions.checkConnectionStatus,
  like_post: LinkedInActions.likePost,
  comment_on_post: LinkedInActions.commentOnPost,
  viewProfile: LinkedInActions.viewProfile
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const handler = ACTION_HANDLERS[message.action];
      
      if (!handler) {
        throw new Error(`Unknown action: ${message.action}`);
      }

      // Create status UI
      StatusUI.create();
      StatusUI.updateProgress(message.current, message.total);

      // Execute action
      const result = await handler(message);

      // Update UI with result
      StatusUI.showResult(result.status, result.message);

      // Send response
      sendResponse({
        ...result,
        url: message.url || window.location.href
      });

    } catch (error) {
      Logger.error('Content script error:', error);
      
      StatusUI.showResult('ERROR', error.message);
      
      sendResponse({
        status: 'ERROR',
        message: error.message || 'Unknown error',
        url: window.location.href
      });
    } finally {
      // Clean up UI after delay
      setTimeout(() => StatusUI.remove(), 4500);
    }
  })();

  return true; // Keep message channel open for async response
}); 