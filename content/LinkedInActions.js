// ============================================================================
// LINKEDIN ACTIONS MODULE
// High-level action implementations for LinkedIn automation
// ============================================================================

import { CONFIG } from '../config.js';
import { LinkedInDOM } from './LinkedInDOM.js';
import { StatusUI } from './StatusUI.js';
import { delay, escapeHtml } from '../modules/Utils.js';
import { Logger } from '../modules/Logger.js';

export class LinkedInActions {
  /**
   * Send connection request
   */
  static async sendConnectionRequest(message) {
    const { note, current, total } = message;

    try {
      await LinkedInDOM.waitForPageLoad();

      const profile = LinkedInDOM.getProfileInfo();
      StatusUI.addItem(profile.name, profile.headline);

      // Check if already pending
      if (LinkedInDOM.hasPendingButton()) {
        return {
          status: CONFIG.statuses.PENDING,
          message: 'Pending'
        };
      }

      // Find Connect button
      const connectInfo = await LinkedInDOM.findConnectButton();

      if (!connectInfo) {
        // Check if already connected
        const connected = await LinkedInDOM.isConnected();

        if (connected) {
          return {
            status: CONFIG.statuses.CONNECTED,
            message: 'Already connected'
          };
        }

        // Check for pending
        if (LinkedInDOM.hasPendingButton()) {
          return {
            status: CONFIG.statuses.PENDING,
            message: 'Pending'
          };
        }

        // True failure
        return {
          status: CONFIG.statuses.FAILED,
          message: 'Connect button not available'
        };
      }


      // Click Connect
      await LinkedInDOM.clickElement(connectInfo.button);
      await delay(CONFIG.delays.mediumDelay);

      // Handle Add Note if provided
      if (note) {
        const addNoteBtn = await LinkedInDOM.waitForElement(
          'button[aria-label="Add a note"]',
          3000
        );

        if (addNoteBtn) {
          await LinkedInDOM.clickElement(addNoteBtn);

          // Check for limit modal
          await delay(500);
          const limitModal = document.querySelector('.artdeco-modal.modal-upsell');
          if (limitModal) {
            const text = limitModal.innerText.toLowerCase();
            if (text.includes('unlimited personalized invites') ||
                text.includes('you\'ve used all your monthly custom invites')) {
              return {
                status: CONFIG.statuses.LIMIT_REACHED,
                message: 'Invitation limit reached'
              };
            }
          }

          // Type note
          const textarea = await LinkedInDOM.waitForElement('textarea[name="message"]', 2000);
          if (textarea) {
            textarea.focus();
            textarea.value = note;
            textarea.dispatchEvent(new InputEvent('input', {
              bubbles: true,
              composed: true,
              inputType: 'insertText',
              data: note
            }));
            await delay(CONFIG.delays.shortDelay);
          }
        }
      }

      // Click Send
      const sendBtn = await LinkedInDOM.waitForElement(() =>
        LinkedInDOM.findVisibleButton('send')
      , 5000);

      if (!sendBtn) {
        return {
          status: CONFIG.statuses.FAILED,
          message: 'Send button not found'
        };
      }

      await LinkedInDOM.clickElement(sendBtn);
      await delay(CONFIG.delays.longDelay);

      // Detect result
      const result = await LinkedInDOM.detectConnectionResult();

      return {
        status: result,
        message: result === CONFIG.statuses.SUCCESS
          ? 'Invitation sent successfully'
          : 'Failed to send invitation'
      };

    } catch (error) {
      Logger.error('Connection request error:', error);
      return {
        status: CONFIG.statuses.ERROR,
        message: error.message
      };
    }
  }

  /**
   * Send LinkedIn message
   */
  static async sendMessage(message) {
    const { message: messageText, current, total } = message;

    try {
      await LinkedInDOM.waitForPageLoad();

      const profile = LinkedInDOM.getProfileInfo();
      StatusUI.addItem(profile.name, profile.headline);

      await LinkedInDOM.closeMessagePanels();
      await delay(CONFIG.delays.mediumDelay);

      // Check connection status
      if (LinkedInDOM.hasPendingButton()) {
        return {
          status: CONFIG.statuses.PENDING,
          message: 'Invitation pending - cannot message'
        };
      }

      const connectInfo = await LinkedInDOM.findConnectButton();
      if (connectInfo) {
        return {
          status: CONFIG.statuses.NOT_CONNECTED,
          message: 'Not connected - cannot message'
        };
      }

      // Find Message button
      const messageBtn = await LinkedInDOM.waitForElement(() =>
        LinkedInDOM.findVisibleButton('message')
      , 6000);

      if (!messageBtn) {
        return {
          status: CONFIG.statuses.SKIPPED,
          message: 'No Message button available'
        };
      }

      await LinkedInDOM.clickElement(messageBtn);
      await delay(CONFIG.delays.longDelay);

      // Find message input
      const input = await LinkedInDOM.waitForElement(
        CONFIG.selectors.messageInput,
        8000
      );

      if (!input) {
        throw new Error('Message input not found');
      }

      // Type message
      await LinkedInDOM.typeText(input, messageText);
      await delay(CONFIG.delays.mediumDelay);

      // Find and click Send
      const sendBtn = await LinkedInDOM.waitForElement(() =>
        Array.from(document.querySelectorAll(CONFIG.selectors.sendButton))
      .find(btn => LinkedInDOM.isVisible(btn) && !btn.disabled &&
      btn.innerText.trim().toLowerCase() === 'send')
      , 7000);
      
      if (!sendBtn) {
        throw new Error('Send button not found');
      }
      await LinkedInDOM.clickElement(sendBtn);
      await delay(2500);

      // Close overlay
      await LinkedInDOM.closeMessageOverlay();

      return {
        status: CONFIG.statuses.SUCCESS,
        message: 'Message sent successfully'
      };

    } catch (error) {
      Logger.error('Send message error:', error);
      await LinkedInDOM.closeMessagePanels();
      
      return {
        status: CONFIG.statuses.ERROR,
        message: error.message
      };
    }
  }

  /**
   * Check connection status
   */
  static async checkConnectionStatus(message) {
    const { current, total } = message;

    try {
      await LinkedInDOM.waitForPageLoad();

      const profile = LinkedInDOM.getProfileInfo();
      StatusUI.addItem(profile.name, profile.headline);

      // Check Pending first
      if (LinkedInDOM.hasPendingButton()) {
        return {
          status: CONFIG.statuses.PENDING,
          message: 'Invitation already pending'
        };
      }

      console.log('Checking for Connect button...');

      // Check for Connect button
      const connectInfo = await LinkedInDOM.findConnectButton();

      if (connectInfo) {
        return {
          status: CONFIG.statuses.NOT_CONNECTED,
          message: connectInfo.inDropdown
            ? 'Connect button in More menu'
            : 'Connect button available'
        };
      }

      // No Connect or Pending = Connected
      return {
        status: CONFIG.statuses.CONNECTED,
        message: 'Already connected'
      };

    } catch (error) {
      Logger.error('Status check error:', error);
      return {
        status: CONFIG.statuses.ERROR,
        message: error.message
      };
    }
  }

  /**
   * Like a post
   */
  static async likePost(message) {
    const { current, total } = message;

    try {
      await LinkedInDOM.waitForPageLoad();

      const author = LinkedInDOM.getPostAuthor();
      StatusUI.addItem(author, 'Liking post');

      // Find Like button (not already liked)
      const likeBtn = await LinkedInDOM.waitForElement(() =>
        Array.from(document.querySelectorAll(CONFIG.selectors.likeButton))
          .find(b =>
            LinkedInDOM.isVisible(b) &&
            b.getAttribute('aria-pressed') === 'false' &&
            (b.innerText.trim().toLowerCase() === 'like' ||
             b.getAttribute('aria-label')?.toLowerCase().includes('like')) &&
            !b.getAttribute('aria-label')?.toLowerCase().includes('comment')
          )
      , 6000);

      if (!likeBtn) {
        return {
          status: CONFIG.statuses.ALREADY_LIKED,
          message: 'Post already liked or Like button not found'
        };
      }

      await delay(1000); // Human-like pause
      await LinkedInDOM.clickElement(likeBtn);
      await delay(CONFIG.delays.longDelay);

      // Verify like was applied
      const isLiked = likeBtn.getAttribute('aria-pressed') === 'true';

      return {
        status: isLiked ? CONFIG.statuses.SUCCESS : CONFIG.statuses.FAILED,
        message: isLiked ? 'Post liked successfully' : 'Failed to confirm like'
      };

    } catch (error) {
      Logger.error('Like post error:', error);
      return {
        status: CONFIG.statuses.ERROR,
        message: error.message
      };
    }
  }

  /**
   * Comment on a post
   */
  static async commentOnPost(message) {
    const { comment, current, total } = message;

    try {
      await LinkedInDOM.waitForPageLoad();

      const author = LinkedInDOM.getPostAuthor();
      StatusUI.addItem(author, 'Commenting on post');

      // Click Comment trigger
      const commentTrigger = await LinkedInDOM.waitForElement(() =>
        Array.from(document.querySelectorAll(CONFIG.selectors.commentTrigger))
          .find(b =>
            LinkedInDOM.isVisible(b) &&
            (b.getAttribute('aria-label')?.toLowerCase().includes('comment') ||
             b.innerText.trim().toLowerCase() === 'comment')
          )
      , 8000);

      if (!commentTrigger) {
        throw new Error('Comment button not found');
      }

      await LinkedInDOM.clickElement(commentTrigger);
      await delay(600);

      // Wait for editor
      const editor = await LinkedInDOM.waitForElement(() =>
        Array.from(document.querySelectorAll(CONFIG.selectors.commentEditor))
          .find(e => LinkedInDOM.isVisible(e))
      , 8000);

      if (!editor) {
        throw new Error('Comment editor not found');
      }

      editor.focus();

      // Try HTML insertion first, fallback to typing
      try {
        editor.innerHTML = `<p>${escapeHtml(comment)}</p>`;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      } catch {
        await LinkedInDOM.typeText(editor, comment, CONFIG.delays.typing);
      }

      await delay(900);

      // Find and click Post button
      const postBtn = await LinkedInDOM.waitForElement(() =>
        Array.from(document.querySelectorAll(CONFIG.selectors.commentSubmit))
          .find(b =>
            LinkedInDOM.isVisible(b) &&
            (b.innerText.trim().toLowerCase() === 'comment' ||
             b.getAttribute('aria-label')?.toLowerCase().includes('comment'))
          )
      , 6000);

      if (!postBtn) {
        throw new Error('Submit comment button not found');
      }

      await delay(400 + Math.random() * 500);
      await LinkedInDOM.clickElement(postBtn);
      await delay(CONFIG.delays.longDelay);

      // Verify comment posted (editor cleared)
      const editorCleared = await LinkedInDOM.waitForElement(() => {
        const ed = Array.from(document.querySelectorAll(CONFIG.selectors.commentEditor))
          .find(e => LinkedInDOM.isVisible(e));
        
        if (!ed) return null;
        
        const text = ed.innerText.trim();
        const html = ed.innerHTML.trim().toLowerCase();
        
        return (text === '' || text === '\n' || html.includes('<p><br>')) ? ed : null;
      }, 3000);

      const status = editorCleared ? CONFIG.statuses.SUCCESS : CONFIG.statuses.FAILED;

      return {
        status,
        message: status === CONFIG.statuses.SUCCESS
          ? 'Comment posted successfully'
          : 'Failed to verify comment'
      };

    } catch (error) {
      Logger.error('Comment post error:', error);
      return {
        status: CONFIG.statuses.ERROR,
        message: error.message
      };
    }
  }

  /**
   * View a profile (with UI display)
   */
  static async viewProfile(message) {
    const { current, total } = message;

    try {
      await LinkedInDOM.waitForPageLoad();

      const profile = LinkedInDOM.getProfileInfo();
      StatusUI.addItem(profile.name, 'Viewing profile...');

      // Wait for human-like duration
      const viewDuration = 4000 + Math.random() * 2000;
      await delay(viewDuration);

      return {
        status: CONFIG.statuses.SUCCESS,
        message: 'Profile viewed successfully'
      };

    } catch (error) {
      Logger.error('View profile error:', error);
      return {
        status: CONFIG.statuses.ERROR,
        message: error.message
      };
    }
  }
}