'use strict';

var chalk = require('chalk');

var constants = require('./constants');

/**
 * Output message
 */
function output() {
  console.log.apply(null, arguments);
}

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
  output: output,
  warn: chalk.yellow,
  notice: chalk.cyan,
  success: chalk.green,
  error: chalk.red.bold,
  Error: CustomError,
  formatErrorMessage: formatErrorMessage
};
