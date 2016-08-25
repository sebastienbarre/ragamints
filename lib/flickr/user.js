/**
 * Flickr user module.
 * @module flickr/user
 * @see module:flickr
 */

const Promise = require('es6-promise').Promise;

const core = require('../core');

const client = require('./client');

const api = {};

/**
 * Check if id is a valid Flickr User ID.
 *
 * @param {string} user_id - The Flickr User ID.
 * @returns {boolean} True if valid.
 */
api.isUserId = user_id => /^[0-9@N]+$/.test(user_id);

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param {string} user_id_or_name - The Flickr User ID or User Name.
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
api.resolveUserId = (user_id_or_name, options) => {
  if (api.isUserId(user_id_or_name)) {
    return Promise.resolve(user_id_or_name);
  }
  const params = {
    username: user_id_or_name,
  };
  return client.people.findByUsername(params, options).then((result) => {
    const user_id = result.user.nsid;
    core.logger.log('Found user ID', core.logger.success(user_id),
      'for username', core.logger.notice(user_id_or_name));
    return user_id;
  },
  () => new core.logger.Error(`Could not find user ID for ${user_id_or_name}`)
  );
};

module.exports = api;
