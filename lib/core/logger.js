/**
 * Core logger module.
 * @module core/logger
 * @see module:core
 */

const chalk = require('chalk');

const constants = require('./constants');

const api = {
  warn: chalk.yellow,
  notice: chalk.cyan,
  success: chalk.green,
  error: chalk.red.bold,
};

/**
 * Output message.
 */
api.log = (...args) => {
  console.log.apply(null, args);
};

/**
 * Format an error message.
 *
 * @param {string} message - The message.
 * @returns {string} The formatted message.
 */
api.formatErrorMessage = message => constants.ERROR_PREFIX + message;

/**
 * Custom error class. Overrides message to format it using formatErrorMessage
 *
 * @extends Error
 */
api.Error = class CustomError extends Error {
  /**
   * Create an error.
   *
   * @param {string} message - The message.
   */
  constructor(message) {
    super(message);
    this.message = api.formatErrorMessage(message);
  }
};

module.exports = api;
