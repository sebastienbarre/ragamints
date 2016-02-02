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
 * Output message
 *
 * @return {void}
 */
api.log = function() {
  console.log.apply(null, arguments);
};

/**
 * Format an error message
 *
 * @param {String} message Message
 * @return {String} formatted message
 */
api.formatErrorMessage = function(message) {
  return constants.ERROR_PREFIX + message;
};

/**
 * Custom error class
 *
 * Overrides message to format it using formatErrorMessage
 */
api.Error = class CustomError extends Error {
  constructor(message) {
    super(message);
    this.message = api.formatErrorMessage(message);
  }
};

module.exports = api;
