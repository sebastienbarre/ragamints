'use strict';

var chalk = require('chalk');

var constants = require('./constants');

/**
 * Format an error message
 *
 * @param {String} message Message
 * @return {String} formatted message
 */
function formatErrorMessage(message) {
  return constants.ERROR_PREFIX + message;
}

/**
 * Custom error class
 *
 * Overrides message to format it using formatErrorMessage
 */
class CustomError extends Error {
  constructor(message) {
    super(message);
    this.message = formatErrorMessage(message);
  }
}

module.exports = {
  warn: chalk.yellow,
  notice: chalk.cyan,
  success: chalk.green,
  Error: CustomError,
  formatErrorMessage: formatErrorMessage
};
