// ============================================================================
// CONFIGURATION MODULE
// Centralized configuration for all automation behaviors
// ============================================================================

export const CONFIG = {
    // Timing delays (in milliseconds)
    delays: {
      pageLoad: 3000,
      beforeTabClose: 1000,
      afterAction: 1000,
      profileView: 4000,
      typing: 40, // Per character
      shortDelay: 300,
      mediumDelay: 800,
      longDelay: 1500
    },
  
    // Timeout values
    timeouts: {
      elementWait: 8000,
      tabLoad: 30000,
      contentScriptResponse: 15000
    },
  
    // Default values
    defaults: {
      connectionNote: "Hi, I'd like to connect with you on LinkedIn.",
      comment: "Great post!"
    },
  
    // LinkedIn-specific selectors
    selectors: {
      // Profile elements
      profileName: 'h1',
      profileHeadline: '.text-body-medium.break-words',
      profileActions: 'div.pv-top-card--list-actions, div.ph5',
      
      // Buttons
      connectButton: 'button, div[role="button"]',
      moreButton: 'button[aria-label*="More"]',
      pendingButton: 'button[aria-label*="Pending"]',
      messageButton: 'button, a[role="button"]',
      sendButton: 'button[type="submit"], button.msg-form__send-button, button[aria-label*="Send"]',
      
      // Dropdowns
      dropdown: 'div.artdeco-dropdown__content[aria-hidden="false"], div.artdeco-dropdown__content[role="menu"]',
      
      // Comment/Post interactions
      commentTrigger: 'button[aria-label*="Comment"], button.comment-button, button[data-finite-scroll-hotkey="c"]',
      commentEditor: '.ql-editor[contenteditable="true"], .editor-content .ql-editor',
      commentSubmit: 'button.comments-comment-box__submit-button--cr, button.artdeco-button--primary',
      
      // Like button
      likeButton: '.feed-shared-social-action-bar__action-button button',
      
      // Messaging
      messageInput: 'div.msg-form__contenteditable[role="textbox"]',
      messageClose: 'button[aria-label*="Dismiss"], button[aria-label*="Close chat"], button[aria-label="Close"]',
      messageOverlayClose: 'button.msg-overlay-bubble-header__control',
      
      // Status indicators
      toast: '[role="alert"] .artdeco-toast-item__content',
      modal: '.artdeco-modal__content',
      error: '.artdeco-inline-feedback--error'
    },
  
    // Status types
    statuses: {
      SUCCESS: 'SUCCESS',
      FAILED: 'FAILED',
      ERROR: 'ERROR',
      PENDING: 'PENDING',
      LIMIT_REACHED: 'LIMIT_REACHED',
      NOT_CONNECTED: 'NOT_CONNECTED',
      CONNECTED: 'CONNECTED',
      ALREADY_LIKED: 'ALREADY_LIKED',
      SKIPPED: 'SKIPPED'
    },

     // User-friendly messages for external app (by action type)
    messages: {
      sendConnectionRequest: {
        SUCCESS: 'Request Sent',
        LIMIT_REACHED: 'Hourly Limit Reached',
        PENDING: 'Already Pending',
        FAILED: 'Request Failed',
        ERROR: 'Request Failed'
      },
      sendLinkedInMessage: {
        SUCCESS: 'Message Sent',
        PENDING: 'Cannot Send (Invitation Pending)',
        NOT_CONNECTED: 'Cannot Send (Not Connected)',
        FAILED: 'Message Not Sent',
        ERROR: 'Message Not Sent',
        SKIPPED: 'Message Not Sent'
      },
      checkConnectionStatus: {
        CONNECTED: 'Connected',
        PENDING: 'Pending',
        NOT_CONNECTED: 'Not Connected',
        FAILED: 'Failed To Check',
        ERROR: 'Failed To Check'
      },
      like_post: {
        SUCCESS: 'Post Liked',
        ALREADY_LIKED: 'Already Liked',
        FAILED: 'Failed To Like',
        ERROR: 'Failed To Like'
      },
      comment_on_post: {
        SUCCESS: 'Comment Posted',
        FAILED: 'Failed To Comment',
        ERROR: 'Failed To Comment'
      },
      viewProfile: {
        SUCCESS: 'Profile Viewed',
        FAILED: 'Unsuccessful',
        ERROR: 'Unsuccessful'
      }
    },
  
    // UI Configuration
    ui: {
      panel: {
        width: '320px',
        position: { right: '20px', bottom: '20px' }
      },
      statusIcons: {
        SUCCESS: '✅',
        FAILED: '❌',
        ERROR: '🚨',
        PENDING: '🕒',
        LIMIT_REACHED: '🚫',
        NOT_CONNECTED: '🔗',
        CONNECTED: '🤝',
        ALREADY_LIKED: '👍',
        SKIPPED: '⏭️'
      },
      statusColors: {
        SUCCESS: '#28a745',
        FAILED: '#dc3545',
        ERROR: '#dc3545',
        PENDING: '#007bff',
        LIMIT_REACHED: '#ffc107',
        NOT_CONNECTED: '#17a2b8',
        CONNECTED: '#6f42c1',
        ALREADY_LIKED: '#ffc107',
        SKIPPED: '#6c757d'
      }
    },
  
    // Logging
    logging: {
      enabled: true,
      logLevel: 'info' // 'debug', 'info', 'warn', 'error'
    }
  };
  
  // Utility to get nested config values safely
  export function getConfig(path, defaultValue = null) {
    return path.split('.').reduce((obj, key) => 
      obj && obj[key] !== undefined ? obj[key] : defaultValue, 
      CONFIG
    );
  }

  /**
 * Get user-friendly message for external app
 * Maps internal status codes to display-friendly messages
 * 
 * @param {string} action - The action type (e.g., 'sendConnectionRequest', 'like_post')
 * @param {string} status - The status code (e.g., 'SUCCESS', 'FAILED')
 * @returns {string} User-friendly message (e.g., 'Request Sent', 'Post Liked')
 * 
 * @example
 * getUserMessage('sendConnectionRequest', 'SUCCESS') // Returns: "Request Sent"
 * getUserMessage('like_post', 'ALREADY_LIKED')      // Returns: "Already Liked"
 * getUserMessage('sendLinkedInMessage', 'PENDING')  // Returns: "Cannot Send (Invitation Pending)"
 */
  export function getUserMessage(action, status) {
    const actionMessages = CONFIG.messages[action];
    
    // If action not found in messages config, return status code as fallback
    if (!actionMessages) {
      console.warn(`No message mapping found for action: ${action}`);
      return status;
    }
    
    // If status not found in action's messages, return status code as fallback
    if (!actionMessages[status]) {
      console.warn(`No message mapping found for action: ${action}, status: ${status}`);
      return status;
    }
    
    return actionMessages[status];
  }