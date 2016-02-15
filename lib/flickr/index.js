/**
 * Flickr module.
 * @module flickr
 */
'use strict';

module.exports = {
  /** @see module:flickr/auth */
  auth: require('./auth'),
  /** @see module:flickr/client */
  client: require('./client'),
  /** @see module:flickr/constants */
  constants: require('./constants'),
  /** @see module:flickr/user */
  user: require('./user'),
  /** @see module:flickr/utils */
  utils: require('./utils')
};
