/**
 * Sync command module.
 * @module commands/sync
 * @see module:commands
 */

const assign = require('lodash/assign');
const Promise = require('es6-promise').Promise;

const flickr = require('../flickr');
const core = require('../core');

const cliOptions = {
  [flickr.constants.CLI_OPTION_NAMES.USER_ID]: {
    describe: 'Flickr user ID (or user name)',
    type: 'string',
  },
  [flickr.constants.CLI_OPTION_NAMES.API_KEY]: {
    describe: 'Flickr API Key',
    type: 'string',
  },
  [flickr.constants.CLI_OPTION_NAMES.API_SECRET]: {
    describe: 'Flickr API Secret',
    type: 'string',
  },
};

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given a Flickr User Name,
 * if needed.
 *
 * @param {string} user_id - The Flickr User Id.
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
function findLastUploadedPhoto(user_id, options) {
  // const params = {
  //   user_id: user_id,
  //   page: 1,
  //   per_page: 1,
  //   extras: 'date_upload,date_taken,geo,tags,machine_tags',
  //   machine_tags: 'uploaded:by=instagram,uploaded:by=ragamints'
  // };
  const params = {
    user_id,
    page: 1,
    per_page: 1,
    extras: 'date_upload,date_taken,geo,tags,machine_tags',
    machine_tags: 'foursquare:venue=4b5a48fbf964a5203fba28e3',
    // machine_tags: 'uploaded:by=instagram,uploaded:by=ragamints',
  };
  return flickr.client.photos.search(params, options).then((result) => {
    const photo = result.photos.photo;
    return photo.length ? photo[0] : false;
  });
}

/**
 * Resolve options. Check if a user was passed, resolve user name to id if needed, check API
 * key/secret, initialize Flickr node API, etc.
 *
 * @param {Object} options - The options to resolve.
 * @returns {Promise} The promise resolving with resolved options, or rejecting.
 */
function resolveOptions(options) {
  const resolved_options = assign({}, options);
  if (resolved_options.flickrApiKey === undefined) {
    const env_token = flickr.constants.ENV_VARS.API_KEY;
    if (process.env && {}.hasOwnProperty.call(process.env, env_token)) {
      resolved_options.flickrApiKey = process.env[env_token];
      if (options.verbose && !options.quiet) {
        core.logger.log('Using', core.logger.success(env_token),
          'environment variable to set Flickr API Key');
      }
    } else {
      return Promise.reject(new core.logger.Error('Need Flickr API Key'));
    }
  }
  if (resolved_options.flickrApiSecret === undefined) {
    const env_token = flickr.constants.ENV_VARS.API_SECRET;
    if (process.env && {}.hasOwnProperty.call(process.env, env_token)) {
      resolved_options.flickrApiSecret = process.env[env_token];
      if (options.verbose && !options.quiet) {
        core.logger.log('Using', core.logger.success(env_token),
          'environment variable to set Flickr API Secret');
      }
    } else {
      return Promise.reject(new core.logger.Error('Need Flickr API Secret'));
    }
  }
  if (!resolved_options.flickrUserId) {
    return Promise.reject(new core.logger.Error('Need Flickr user ID/name'));
  }
  return flickr.user.resolveUserId(
    options.flickrUserId,
    resolved_options
  ).then((value) => {
    resolved_options.flickrUserId = value;
    return resolved_options;
  });
}

/**
 * Run task.
 *
 * @param {Object} unresolved_options - The query options.
 * @returns {Promise} The promise resolving with all medias when done, or rejecting.
  */
function run(unresolved_options) {
  return resolveOptions(unresolved_options).then(options =>
    findLastUploadedPhoto(
      options.flickrUserId, options
    ).then((result) => {
      console.log(result);
    })
  );
}

module.exports = {
  name: 'sync',
  description: 'sync medias from Instagram to Flickr',
  options: cliOptions,
  run,
};
