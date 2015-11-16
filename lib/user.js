'use strict';

var _assign      = require('lodash/object/assign');
var _isEmpty     = require('lodash/lang/isEmpty');
var _isUndefined = require('lodash/lang/isUndefined');
var _omit        = require('lodash/object/omit');
var Promise      = require('es6-promise').Promise;
var suspend      = require('suspend');

var instagram  = require('./instagram');
var logger     = require('./logger');

const cliOptions = {
  command: {
    'u': {
      alias: 'user-id',
      describe: 'Instagram user ID (or user name)',
      type: 'string'
    },
  },
  getRecentMedias: {
    'c': {
      alias: 'count',
      describe: 'Maximum count of medias to download'
    },
    'm': {
      alias: 'min-id',
      describe: 'Only medias posted later than this media id/url (included)',
      type: 'string'
    },
    'n': {
      alias: 'max-id',
      describe: 'Only medias posted earlier than this media id/url (excluded)',
      type: 'string'
    },
    'o': {
      alias: 'min-timestamp',
      describe: 'Only medias after this UNIX timestamp/datetime',
      type: 'string'
    },
    'p': {
      alias: 'max-timestamp',
      describe: 'Only medias before this UNIX timestamp/datetime',
      type: 'string'
    },
  },
  forEachRecentMedias: {
    's': {
      alias: 'sequential',
      describe: 'Process sequentially (slower)',
      type: 'boolean',
      default: false
    },
    'i': {
      alias: 'include-videos',
      describe: 'Include videos (skipped by default)',
      type: 'boolean',
      default: false
    }
  }
};

/**
 * Check if id is a valid Instagram User ID.
 *
 * @param {String} user_id Instagram User ID
 * @return {Boolean} true if valid
 */
function isUserId(user_id) {
  return /^[0-9]+$/.test(user_id);
}

/**
 * Resolve a User ID, i.e. fetches (asynchronously) a User ID given a User
 * Name, if needed.
 *
 * @param  {String} user_id_or_name User ID or User Name
 * @return {Promise} resolving with a user ID, or rejecting
 */
function resolveUserId(user_id_or_name) {
  return new Promise(function(resolve, reject) {
    if (isUserId(user_id_or_name)) {
      resolve(user_id_or_name);
      return;
    }
    instagram.user_search(
      user_id_or_name, {
        count: 1
      }, function(err, users) {
        if (err) {
          reject(err);
        } else if (!users.length) {
          let msg = `Could not find user ID for ${user_id_or_name}`;
          reject(new logger.Error(msg));
        } else {
          let user_id = users[0].id;
          logger.log('Found user ID', logger.success(user_id),
            'for username', logger.notice(user_id_or_name));
          resolve(user_id);
        }
      }
    );
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
        (!options.count ||
         (options.count && current_count < options.count))) {
      next = new Promise(function(next_resolve, next_reject) {
        pagination.next(handler.bind(null, next_resolve, next_reject));
      });
    } else if (options.count && current_count > options.count) {
      let pos = options.count - current_count;
      medias.splice(pos, -pos);
    }
    let another = current_count > medias.length ? 'another ' : '';
    let media_count = logger.success(medias.length) + ' media(s)';
    let more = next ? ', more to come...' : ', nothing more.';
    logger.log(`Found ${another}${media_count}${more}`);
    resolve({medias: medias, next: next});
  };
  /*eslint-enable max-params */
  // Get the promise to return the first batch
  let user_media_recent_options = {
    count: options.count,
    min_id: options.minId,
    max_id: options.maxId,
    min_timestamp: options.minTimestamp,
    max_timestamp: options.maxTimestamp
  };
  if (_isEmpty(_omit(user_media_recent_options, _isUndefined))) {
    return Promise.resolve({medias: [], next: null});
  }
  return new Promise(function(resolve, reject) {
    instagram.user_media_recent(
      user_id,
      user_media_recent_options,
      handler.bind(null, resolve, reject)
    );
  });
}

/**
 * Iterate over the most recent media published by a user.
 *
 * This function uses getRecentMedias under the hood, which itself is
 * a Promise wrapper around Instagram's GET /users/user-id/media/recent

 * Supported options are:
 *   all options supported by (and passed to) getRecentMedias
 *   {Boolean} sequential True to process each media sequentially (slower)
 *   {Boolean} includeVideos True to process videos as well
 *
 * @param {String} user_id User ID
 * @param {Object} options Query options (see above)
 * @param {Function} callback Callback, to receive a media, to return a Promise
 * @return {Promise} resolving w/ an array of all promises' output.
  */
function forEachRecentMedias(user_id, options, callback) {
  return new Promise(function(resolve, reject) {
    suspend(function*() {
      try {
        let sequential_output = [];
        let promises = options.sequential ? Promise.resolve() : [];
        let it = getRecentMedias(user_id, options);
        while (it) {
          let chunk = yield it;
          chunk.medias.forEach(function(media) {
            if (media.type === 'video' && !options.includeVideos) {
              return;
            }
            // In sequential mode we iterate over the medias returned by
            // getRecentMedias and *chain* the corresponding promises.
            // This ensures everything is done in order (but slower).
            if (options.sequential) {
              promises = promises.then(function() {
                return callback(media, options);
              }).then(function(result) {
                // Keep the output of each promise in a separate array, or we
                // will only receive the output of the last one in the chain.
                sequential_output.push(result);
              }).catch(function(err) {
                // We need bo bubble the error up
                throw err;
              });
            // In parallel mode we iterate over the medias returned by
            // getRecentMedias and *collect* the corresponding promises in an
            // array. This ensures everything starts processing right away.
            // It also conveniently put the output of each promise in an array.
            } else {
              promises.push(callback(media, options));
            }
          });
          it = chunk.next;
        }
        // In parallel mode we still need to wrap our array of promises
        if (!options.sequential) {
          promises = Promise.all(promises);
        }
        // Execute (wait for all promises)
        let promises_output = yield promises;
        // In sequential mode, let's use the separate var we had set up to
        // collect the output of the promises (promise_output would only
        // be the output of the *last* one at this point). In parallel mode
        // we can use promise_output directly. Let's filter out undefined vals.
        let output = options.sequential ? sequential_output : promises_output;
        output = output.filter(function(n) {
          return n !== undefined;
        });
        logger.log('Done iterating over', logger.success(output.length),
          'media(s). Easy peasy.');
        resolve(output);
      }
      catch (err) {
        reject(err);  // We still need to catch errors above.
      }
    })(); // suspend
  }); // new Promise
}

module.exports = {
  resolveUserId: resolveUserId,
  forEachRecentMedias: forEachRecentMedias,
  forEachRecentMediasCliOptions: _assign(
    {},
    cliOptions.command,
    cliOptions.getRecentMedias,
    cliOptions.forEachRecentMedias
    )
};
