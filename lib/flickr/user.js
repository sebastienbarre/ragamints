'use strict';

var Promise = require('es6-promise').Promise;

var core    = require('../core');

var client  = require('./client');

let api = {};

/**
 * Check if id is a valid Flickr User ID.
 *
 * @param {String} user_id Flickr User ID
 * @return {Boolean} true if valid
 */
api.isUserId = function(user_id) {
  return /^[0-9@N]+$/.test(user_id);
};

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param  {String} user_id_or_name Flickr User ID or User Name
 * @param  {Object} options options
 * @return {Promise} resolving with Flickr user ID, or rejecting
 */
api.resolveUserId = function(user_id_or_name, options) {
  if (api.isUserId(user_id_or_name)) {
    return Promise.resolve(user_id_or_name);
  }
  let params = {
    username: user_id_or_name
  };
  return client.people.findByUsername(params, options).then(function(result) {
    let user_id = result.user.nsid;
    core.logger.log('Found user ID', core.logger.success(user_id),
      'for username', core.logger.notice(user_id_or_name));
    return user_id;
  }, function() {
    let msg = `Could not find user ID for ${user_id_or_name}`;
    return new core.logger.Error(msg);
  });
};

module.exports = api;
