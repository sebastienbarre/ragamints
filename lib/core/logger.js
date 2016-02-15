/**
 * Core logger module.
 * @module core/logger
 * @see module:core
 */
'use strict';

var chalk = require('chalk');

var constants = require('./constants');

let api = {
  warn: chalk.yellow,
  notice: chalk.cyan,
  success: chalk.green,
  error: chalk.red.bold
};

/**
 * Output message.
 */
api.log = function() {
  console.log.apply(null, arguments);
};

/**
 * Format an error message.
 *
 * @param {string} message - The message.
 * @returns {string} The formatted message.
 */
api.formatErrorMessage = function(message) {
  return constants.ERROR_PREFIX + message;
};

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
