/**
 * Instagram user module.
 * @module instagram/user
 * @see module:instagram
 */

const assign = require('lodash/assign');
const isEmpty = require('lodash/isEmpty');
const isUndefined = require('lodash/isUndefined');
const omitBy = require('lodash/omitBy');
const Promise = require('es6-promise').Promise;
const suspend = require('suspend');

const core = require('../core');

const client = require('./client');
const constants = require('./constants');

const api = {};

const cliOptions = {
  command: {
    't': {
      alias: constants.CLI_OPTION_NAMES.ACCESS_TOKEN,
      describe: 'Instagram Access Token',
      type: 'string',
    },
    'u': {
      alias: constants.CLI_OPTION_NAMES.USER_ID,
      describe: 'Instagram user ID (or user name)',
      type: 'string',
    },
  },
  getRecentMedias: {
    'c': {
      alias: 'count',
      describe: 'Maximum count of medias to download',
    },
    'm': {
      alias: 'min-id',
      describe: 'Only medias posted later than this media id/url (included)',
      type: 'string',
    },
    'n': {
      alias: 'max-id',
      describe: 'Only medias posted earlier than this media id/url (excluded)',
      type: 'string',
    },
  },
  forEachRecentMedias: {
    's': {
      alias: 'sequential',
      describe: 'Process sequentially (slower)',
      type: 'boolean',
      default: false,
    },
    'i': {
      alias: 'include-videos',
      describe: 'Include videos (skipped by default)',
      type: 'boolean',
      default: false,
    },
  },
};

/**
 * Resolve options.
 *
 * @param {Object} options - The options to resolve.
 * @returns {Promise} The promise resolving with resolved options, or rejecting.
 */
api.resolveOptions = (options) => {
  const resolved_options = assign({}, options);
  if (resolved_options.instagramAccessToken === undefined) {
    const env_token = constants.ENV_VARS.ACCESS_TOKEN;
    if (process.env && {}.hasOwnProperty.call(process.env, env_token)) {
      resolved_options.instagramAccessToken = process.env[env_token];
      if (options.verbose && !options.quiet) {
        core.logger.log('Using', core.logger.success(env_token),
          'environment variable to set Instagram Access Token');
      }
    } else {
      return Promise.reject(new core.logger.Error('Need Instagram access token'));
    }
  }
  client.use({
    access_token: resolved_options.instagramAccessToken,
  });
  return Promise.resolve(resolved_options);
};

/**
 * Check if id is a valid Instagram User ID.
 *
 * @param {string} user_id - The Instagram User ID.
 * @returns {boolean} True if valid.
 */
api.isUserId = user_id => /^[0-9]+$/.test(user_id);

/**
 * Resolve Instagram User ID, i.e. fetches (asynchronously) Instagram User ID
 * given Instagram User Name, if needed.
 *
 * @param {string} user_id_or_name - The Instagram User ID or User Name.
 * @returns {Promise} The promise resolving with Instagram user ID, or rejecting.
 */
api.resolveUserId = (user_id_or_name) => {
  if (api.isUserId(user_id_or_name)) {
    return Promise.resolve(user_id_or_name);
  }
  return new Promise((resolve, reject) => {
    client.user_search(
      user_id_or_name, {
        count: 1,
      }, (err, users) => {
        if (err) {
          reject(err);
        } else if (!users.length) {
          reject(new core.logger.Error(`Could not find user ID for ${user_id_or_name}`));
        } else {
          core.logger.log('Found user ID', core.logger.success(users[0].id),
            'for username', core.logger.notice(user_id_or_name));
          resolve(users[0].id);
        }
      }
    );
  });
};

/**
 * Get the most recent media published by a user.
 *
 * A Promise wrapper around Instagram's GET /users/user-id/media/recent.
 *
 * @see {@link https://instagram.com/developer/endpoints/users/#get_users_media_recent}.
 *
 * This function behaves like an iterator -- it returns a promise for each page of results
 * returned by Instagram. Said promise resolves with an object.
 *   {
 *     medias: {Object[]} array of media objects
 *     next: {Promise or false}
 *   }
 *   - 'medias' is an array of media objects,
 *   - 'next' is either:
 *     - false if there are no more medias to return,
 *     - a promise that will resolve identically (i.e. with an object
 *       containing the next batch of medias, and a promise or false)
 *
 * Iteration can be done, for example, from an ES7 generator:
 *   suspend(function*() {
 *    const it = getRecentMedias(user_id, options);
 *    while (it) {
 *      const chunk = yield it;
 *      // do something with chunk.medias
 *      it = chunk.next;
 *    }
 *  })();
 *
 * Supported options are:
 *   {int} count Count of media to download
 *   {String} minId Fetch media later than this minId
 *   {String} maxId Fetch media later than this maxId
 *
 * @param {string} user_id - The Instagram User ID.
 * @param {Object} options - The options.
 * @returns {Promise} resolving w/ {medias:, next: } once fetched, or rejecting.
 */
api.getRecentMedias = (user_id, options) => {
  let current_count = 0;
  const handler = function handler( // eslint-disable-line max-params
    resolve, reject, err, medias, pagination) {
    if (err) {
      reject(err);
      return;
    }
    current_count += medias.length;
    let next = false;
    // If we have more data to fetch, return a promise to get the next batch
    if (pagination.next &&
        (!options.count ||
         (options.count && current_count < options.count))) {
      next = new Promise((next_resolve, next_reject) => {
        pagination.next(handler.bind(null, next_resolve, next_reject));
      });
    } else if (options.count && current_count > options.count) {
      const pos = options.count - current_count;
      medias.splice(pos, -pos);
    }
    const another = current_count > medias.length ? 'another ' : '';
    const media_count = `${core.logger.success(medias.length)} media(s)`;
    const more = next ? ', more to come...' : ', nothing more.';
    core.logger.log(`Found ${another}${media_count}${more}`);
    resolve({ medias, next });
  };
  // Get the promise to return the first batch
  const user_media_recent_options = {
    count: options.count,
    min_id: options.minId,
    max_id: options.maxId,
  };
  if (isEmpty(omitBy(user_media_recent_options, isUndefined))) {
    return Promise.resolve({ medias: [], next: null });
  }
  return new Promise((resolve, reject) => {
    client.user_media_recent(
      user_id,
      user_media_recent_options,
      handler.bind(null, resolve, reject)
    );
  });
};

/**
 * Iterate over the most recent media published by a user.
 *
 * This function uses getRecentMedias under the hood, which itself is a Promise wrapper
 * around Instagram's GET /users/user-id/media/recent.
 *
 * @param {string} user_id - The User ID.
 * @param {Object} options - The options (including all from {@link getRecentMedias}).
 * @param {boolean} options.sequential - True to process each media sequentially (slower).
 * @param {boolean} options.includeVideos - True to process videos as well.
 * @param {Function} callback - The callback, to receive a media, to return a Promise.
 * @returns {Promise} The promise resolving w/ an array of all promises' output.
 */
api.forEachRecentMedias = (user_id, options, callback) => new Promise((resolve, reject) => {
  suspend(function* generator() {
    try {
      const sequential_output = [];
      let promises = options.sequential ? Promise.resolve() : [];
      let skipped_count = 0;
      let it = api.getRecentMedias(user_id, options);
      while (it) {
        const chunk = yield it;
        chunk.medias.forEach((media) => { // eslint-disable-line no-loop-func
          if (media.type === 'video' && !options.includeVideos) {
            skipped_count += 1;
            return;
          }
          // In sequential mode we iterate over the medias returned by getRecentMedias and *chain*
          // the corresponding promises. This ensures everything is done in order (but slower).
          if (options.sequential) {
            promises = promises.then(() => callback(media, options)).then((result) => {
              // Keep the output of each promise in a separate array, or we will only receive the
              // output of the last one in the chain.
              sequential_output.push(result);
            }).catch((err) => {
              // We need bo bubble the error up
              throw err;
            });
          // In parallel mode we iterate over the medias returned by getRecentMedias and *collect*
          // the corresponding promises in an array. This ensures everything starts processing
          // right away. It also conveniently put the output of each promise in an array.
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
      const promises_output = yield promises;
      // In sequential mode, let's use the separate variable we had set up to collect the output
      // of the promises (promise_output would only be the output of the *last* one at this
      // point). In parallel mode we can use promise_output directly. Let's filter out undefined
      // vals.
      let output = options.sequential ? sequential_output : promises_output;
      output = output.filter(n => n !== undefined);
      if (skipped_count) {
        core.logger.log('Skipped', core.logger.success(skipped_count), 'videos(s).');
      }
      core.logger.log('Done iterating over', core.logger.success(output.length),
        'media(s). Easy peasy.');
      resolve(output);
    } catch (err) {
      reject(err);  // We still need to catch errors above.
    }
  })(); // suspend
}); // new Promise

api.forEachRecentMediasCliOptions = assign(
  {},
  cliOptions.command,
  cliOptions.getRecentMedias,
  cliOptions.forEachRecentMedias
  );

module.exports = api;