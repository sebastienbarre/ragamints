/**
 * Core constants module.
 * @module core/constants
 * @see module:core
 */

/**
 * The name of the software.
 *
 * @constant
 * @type {string}
 * @default
 */
const SOFTWARE = 'ragamints';

/**
 * The prefix to use in front of each error.
 *
 * @constant
 * @type {string}
 * @default
 */
const ERROR_PREFIX = 'ragamints: ';

/**
 * The name of the user configuration file.
 *
 * @constant
 * @type {string}
 * @default
 */
const CONFIG_FILE = '.ragamintsrc';

module.exports = {
  SOFTWARE,
  ERROR_PREFIX,
  CONFIG_FILE,
};
