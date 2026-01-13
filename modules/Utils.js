// ============================================================================
// UTILITY FUNCTIONS
// Reusable helper functions used across the extension
// ============================================================================

/**
 * Delay execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {Object} options - Retry options
   * @returns {Promise<any>}
   */
  export async function retry(fn, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2
    } = options;
  
    let lastError;
    let currentDelay = initialDelay;
  
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          await delay(currentDelay);
          currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
        }
      }
    }
  
    throw lastError;
  }
  
  /**
   * Safely get nested property from object
   * @param {Object} obj - Source object
   * @param {string} path - Dot-notation path
   * @param {any} defaultValue - Default if not found
   * @returns {any}
   */
  export function getNestedValue(obj, path, defaultValue = null) {
    return path.split('.').reduce((acc, part) => 
      acc && acc[part] !== undefined ? acc[part] : defaultValue,
      obj
    );
  }
  
  /**
   * Generate random delay for human-like behavior
   * @param {number} baseMs - Base delay in milliseconds
   * @param {number} variancePercent - Variance as percentage (0-100)
   * @returns {number}
   */
  export function randomDelay(baseMs, variancePercent = 20) {
    const variance = baseMs * (variancePercent / 100);
    return baseMs + (Math.random() * variance * 2 - variance);
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string}
   */
  export function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
  
  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function}
   */
  export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in ms
   * @returns {Function}
   */
  export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  /**
   * Format name from LinkedIn URL slug
   * @param {string} name - Name from URL
   * @returns {string}
   */
  export function formatName(name) {
    if (!name || name === 'Unknown Profile') {
      return 'LinkedIn Profile';
    }
    
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Parse LinkedIn profile data from URL
   * @param {string} url - LinkedIn URL
   * @returns {Object}
   */
  export function parseLinkedInUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      return {
        isValid: urlObj.hostname.includes('linkedin.com'),
        type: pathParts[0], // 'in', 'company', 'posts', etc.
        identifier: pathParts[1] || null,
        isProfile: pathParts[0] === 'in',
        isCompany: pathParts[0] === 'company',
        isPost: pathParts[0] === 'posts'
      };
    } catch {
      return { isValid: false };
    }
  }