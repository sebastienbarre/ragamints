/**
 * Core module.
 * @module core
 */
'use strict';

module.exports = {
  /** @see module:core/cache */
  cache: require('./cache'),
  /** @see module:core/constants */
  constants: require('./constants'),
  /** @see module:core/logger */
  logger: require('./logger'),
  /** @see module:core/utils */
  utils: require('./utils')
};
