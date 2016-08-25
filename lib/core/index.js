/**
 * Core module.
 * @module core
 */

/** @see module:core/cache */
const cache = require('./cache');

/** @see module:core/constants */
const constants = require('./constants');

/** @see module:core/logger */
const logger = require('./logger');

/** @see module:core/utils */
const utils = require('./utils');

module.exports = {
  cache,
  constants,
  logger,
  utils,
};
