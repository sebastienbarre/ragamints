'use strict';

var _assign       = require('lodash/object/assign');
var Flickr        = require('flickrapi');
var Promise       = require('es6-promise').Promise;

// var cache         = require('../cache');
var constants     = require('../constants');
// var instagram     = require('../instagram');
var logger        = require('../logger');
// var media         = require('../media');
// var user          = require('../user');
// var utils         = require('../utils');

let cliOptions = {
  'f': {
    alias: 'flickr-user-id',
    describe: 'Flickr user',
    type: 'string'
  },
  'flickr-api-key': {
    describe: 'Flickr API Key',
    type: 'string'
  },
  'flickr-api-secret': {
    describe: 'Flickr API Secret',
    type: 'string'
  }
};

/**
 * Check if id is a valid Flickr User ID.
 *
 * @param {String} user_id Flickr User ID
 * @return {Boolean} true if valid
 */
function isFlickrUserId(user_id) {
  return /^[0-9@N]+$/.test(user_id);
}

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param  {String} user_id_or_name Flickr User ID or User Name
 * @param  {Object} options options
 * @return {Promise} resolving with Flickr user ID, or rejecting
 */
function resolveFlickrUserId(user_id_or_name, options) {
  return new Promise(function(resolve, reject) {
    if (isFlickrUserId(user_id_or_name)) {
      resolve(user_id_or_name);
      return;
    }
    Flickr.tokenOnly({
      api_key: options.flickrApiKey,
      secret: options.flickrApiSecret
    }, function(err, flickr) {
      if (err) {
        reject(err);
      } else {
        flickr.people.findByUsername({
          username: user_id_or_name
        }, function(err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result.user.nsid);
          }
        });
      }
    });
  });
}

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param  {Object} options options
 * @return {Promise} resolving with Flickr user ID, or rejecting
 */
function findLastUploadedPhoto(options) {
  return new Promise(function(resolve, reject) {
    Flickr.tokenOnly({
      api_key: options.flickrApiKey,
      secret: options.flickrApiSecret
    }, function(err, flickr) {
      if (err) {
        reject(err);
      } else {
        flickr.photos.search({
          user_id: options.flickrUserId,
          page: 1,
          per_page: 1,
          extras: 'date_upload,date_taken,geo,tags,machine_tags',
          machine_tags: 'uploaded:by=instagram,uploaded:by=ragamints'
        }, function(err, result) {
          if (err) {
            reject(err);
          } else {
            let photo = result.photos.photo;
            resolve(photo.length ? photo[0] : false);
          }
        });
      }
    });
  });
}

/**
 * Resolve options.
 *
 * Check if a user was passed, resolve user name to id if needed,
 * check API key/secret, initialize Flickr node API, etc.
 *
 * @param  {Object} options Options to resolve
 * @return {Promise} resolving with resolved options, or rejecting
 */
function resolveOptions(options) {
  let resolved_options = _assign({}, options);
  if (resolved_options.flickrApiKey === undefined) {
    let env_token = constants.FLICKR_API_KEY_ENV_VAR;
    if (process.env && process.env.hasOwnProperty(env_token)) {
      resolved_options.flickrApiKey = process.env[env_token];
      if (options.verbose && !options.quiet) {
        logger.log('Using', logger.success(env_token),
          'environment variable to set Flickr API Key');
      }
    } else {
      return Promise.reject(new logger.Error('Need Flickr API Key'));
    }
  }
  if (resolved_options.flickrApiSecret === undefined) {
    let env_token = constants.FLICKR_API_SECRET_ENV_VAR;
    if (process.env && process.env.hasOwnProperty(env_token)) {
      resolved_options.flickrApiSecret = process.env[env_token];
      if (options.verbose && !options.quiet) {
        logger.log('Using', logger.success(env_token),
          'environment variable to set Flickr API Secret');
      }
    } else {
      return Promise.reject(new logger.Error('Need Flickr API Secret'));
    }
  }
  if (!resolved_options.flickrUserId) {
    return Promise.reject(new logger.Error('Need Flickr user ID or name'));
  }
  return resolveFlickrUserId(
    options.flickrUserId,
    resolved_options
  ).then(function(value) {
    resolved_options.flickrUserId = value;
    return resolved_options;
  });
}

/**
 * Run task.
 *
 * @param {Object} unresolved_options Query options
 * @return {Promise} resolving with all medias when done, or rejecting
  */
function run(unresolved_options) {
  return resolveOptions(unresolved_options).then(function(options) {
    return findLastUploadedPhoto(options).then(function(result) {
      console.log(result);
    });
  });
}

module.exports = {
  name: 'sync',
  description: 'sync medias from Instagram to Flickr',
  options: cliOptions,
  run: run
};
