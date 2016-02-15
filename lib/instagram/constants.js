/**
 * Instagram constants module.
 * @module instagram/constants
 * @see module:instagram
 */
'use strict';

var core = require('../core');

/**
 * Enum for image resolutions.
 *
 * @constant
 * @enum {string}
 */
const RESOLUTIONS = {
  high: 'high_resolution',
  standard: 'standard_resolution',
  low: 'low_resolution',
  thumbnail: 'thumbnail'
};

/**
 * Enum for cache Time-To-Live values per API endpoint.
 *
 * @constant
 * @enum {number}
 */
const CACHE_TTL = {
  oembed: 2 * core.cache.TTL.day,
  user_search: core.cache.TTL.week,
  user_media_recent: 10 * core.cache.TTL.minute
};

/**
 * Enum for size of page returned by endpoint.
 *
 * @constant
 * @enum {number}
 */
const PAGE_SIZE = {
  user_media_recent: 33
};

/**
 * Enum for environment variables.
 *
 * @constant
 * @enum {string}
 */
const ENV_VARS = {
  ACCESS_TOKEN: 'RAGAMINTS_INSTAGRAM_ACCESS_TOKEN',
  USER_ID: 'RAGAMINTS_INSTAGRAM_USER_ID',
};

/**
 * Enum for names of CLI options.
 *
 * @constant
 * @enum {string}
 */
const CLI_OPTION_NAMES = {
  ACCESS_TOKEN: 'instagram-access-token',
  USER_ID: 'instagram-user-id',
};

module.exports = {
  ENV_VARS: ENV_VARS,
  CLI_OPTION_NAMES: CLI_OPTION_NAMES,
  RESOLUTIONS: RESOLUTIONS,
  CACHE_TTL: CACHE_TTL,
  PAGE_SIZE: PAGE_SIZE
};
