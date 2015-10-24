'use strict';

var Promise = require('es6-promise').Promise;

var ig      = require('./instagram');
var log     = require('./log');

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
          reject(new log.Error(`Could not find user ID for: ${user_id}`));
        } else {
          log.output('Found user ID:', log.success(users[0].id),
            'for username:', log.notice(user_id));
          resolve(users[0].id);
        }
      });
  });
}

/**
 * Get the most recent media published by a user.
 *
 * A Promise wrapper around Instagram's GET /users/user-id/media/recent
 * https://instagram.com/developer/endpoints/users/#get_users_media_recent
 *
 * This function behaves like an iterator -- it returns a promise for each
 * page of results returned by Instagram. Said promise resolves with an object:
 *   {
 *     medias: {Array} array of media objects
 *     next: {Promise or false}
 *   }
 * where:
 *   - 'medias' is an array of media objects,
 *   - 'next' is either:
 *     - false if there are no more medias to return,
 *     - a promise that will resolve identically (i.e. with an object
 *       containing the next batch of medias, and a promise or false)
 *
 * Iteration can be done, for example, from an ES7 generator:
 *   suspend(function*() {
 *    let it = getRecentMedias(user_id, options);
 *    while (it) {
 *      let chunk = yield it;
 *      // do something with chunk.medias
 *      it = chunk.next;
 *    }
 *  })();
 *
 * Supported options are:
 *   {int} count Count of media to download
 *   {String} minId Fetch media later than this minId
 *   {String} maxId Fetch media later than this maxId
 *   {int} minTimestamp Fetch media after this UNIX timestamp
 *   {int} maxTimestamp Fetch media before this UNIX timestamp
 *
 * @param {String} user_id User ID
 * @param {Object} options Query options (see above)
 * @return {Promise} resolving w/ {medias:, next: } once fetched, or rejecting
 */
function getRecentMedias(user_id, options) {
  let current_count = 0;
  /*eslint-disable max-params */
  let handler = function handler(resolve, reject, err, medias, pagination) {
    if (err) {
      reject(err);
      return;
    }
    // Assign an extra, custom fetch_index key to our media, not part of
    // Instagram API but useful for logging.
    medias.forEach(function(media, index) {
      media.fetch_index = current_count + index;
    });
    current_count += medias.length;
    let next = false;
    // If we have more data to fetch, return a promise to get the next batch
    if (pagination.next &&
        (!options.count || (options.count && current_count < options.count))) {
      next = new Promise(function(next_resolve, next_reject) {
        pagination.next(handler.bind(null, next_resolve, next_reject));
      });
    } else if (options.count && current_count > options.count) {
      let pos = options.count - current_count;
      medias.splice(pos, -pos);
    }
    let another = current_count > medias.length ? 'another ' : '';
    let media_count = log.success(medias.length) + ' media(s)';
    let more = next ? ', more to come...' : ', nothing more.';
    log.output(`Found ${another}${media_count}${more}`);
    resolve({medias: medias, next: next});
  };
  /*eslint-enable max-params */
  // Get the promise to return the first batch
  return new Promise(function(resolve, reject) {
    ig.user_media_recent(
      user_id, {
        count: options.count || 1000,
        min_id: options.minId,
        max_id: options.maxId,
        min_timestamp: options.minTimestamp,
        max_timestamp: options.maxTimestamp
      },
      handler.bind(null, resolve, reject)
    );
  });
}

module.exports = {
  isUserId: isUserId,
  resolveUserId: resolveUserId,
  getRecentMedias: getRecentMedias
};
