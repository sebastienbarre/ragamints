'use strict';

var Promise   = require('es6-promise').Promise;

var constants = require('./constants');
var ig        = require('./instagram');
var log       = require('./log');

const ERROR_PREFIX = constants.ERROR_PREFIX;

/**
 * Check if id is a valid Instagram User ID.
 *
 * @param {String} id Instagram User ID
 * @return {Boolean} true if valid
 */
function isUserId(id) {
  return /^[0-9]+$/.test(id);
}

/**
 * Resolve a User ID, i.e. fetches (asynchronously) a User ID given a User
 * Name, if needed.
 *
 * @param  {String} user_id User ID or User Name
 * @return {Promise} resolving with a user ID, or rejecting
 */
function resolveUserId(user_id) {
  return new Promise(function(resolve, reject) {
    if (isUserId(user_id)) {
      resolve(user_id);
      return;
    }
    ig.user_search(
      user_id, {
        count: 1
      }, function(err, users) {
        if (err) {
          reject(err);
        } else if (!users.length) {
          reject(new Error(
            `${ERROR_PREFIX} Could not find user ID for: ${user_id}`));
        } else {
          console.log('Found user ID:', log.success(users[0].id), 'for username:',
            log.notice(user_id));
          resolve(users[0].id);
        }
      });
  });
}

module.exports = {
  isUserId: isUserId,
  resolveUserId: resolveUserId
};
