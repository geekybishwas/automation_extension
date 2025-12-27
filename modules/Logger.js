// ============================================================================
// LOGGER MODULE
// Centralized logging with levels and formatting
// ============================================================================

import { CONFIG } from '../config.js';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class LoggerClass {
  constructor() {
    this.level = LOG_LEVELS[CONFIG.logging.logLevel] || LOG_LEVELS.info;
    this.enabled = CONFIG.logging.enabled;
  }

  /**
   * Format log message with timestamp and context
   * @private
   */
  _format(level, args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return [prefix, ...args];
  }

  /**
   * Log debug message
   */
  debug(...args) {
    if (this.enabled && this.level <= LOG_LEVELS.debug) {
      console.log(...this._format('debug', args));
    }
  }

  /**
   * Log info message
   */
  info(...args) {
    if (this.enabled && this.level <= LOG_LEVELS.info) {
      console.log(...this._format('info', args));
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    if (this.enabled && this.level <= LOG_LEVELS.warn) {
      console.warn(...this._format('warn', args));
    }
  }

  /**
   * Log error message
   */
  error(...args) {
    if (this.enabled && this.level <= LOG_LEVELS.error) {
      console.error(...this._format('error', args));
    }
  }

  /**
   * Log with custom level
   */
  log(level, ...args) {
    const method = this[level] || this.info;
    method.apply(this, args);
  }

  /**
   * Change log level at runtime
   */
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = LOG_LEVELS[level];
    }
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Group related logs
   */
  group(label, fn) {
    if (this.enabled) {
      console.group(label);
      try {
        fn();
      } finally {
        console.groupEnd();
      }
    } else {
      fn();
    }
  }
}

export const Logger = new LoggerClass();