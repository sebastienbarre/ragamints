/**
 * Instagram module.
 * @module instagram
 */

/** @see module:instagram/client */
const client = require('./client');

/** @see module:instagram/constants */
const constants = require('./constants');

/** @see module:instagram/media */
const media = require('./media');

/** @see module:instagram/user */
const user = require('./user');

module.exports = {
  client,
  constants,
  media,
  user,
};
