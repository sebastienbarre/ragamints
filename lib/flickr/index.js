/**
 * Flickr module.
 * @module flickr
 */

/** @see module:flickr/auth */
const auth = require('./auth');

/** @see module:flickr/client */
const client = require('./client');

/** @see module:flickr/constants */
const constants = require('./constants');

/** @see module:flickr/user */
const user = require('./user');

/** @see module:flickr/utils */
const utils = require('./utils');

module.exports = {
  auth,
  client,
  constants,
  user,
  utils,
};
