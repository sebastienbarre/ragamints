/**
 * Flickr client module.
 * @module flickr/client
 * @see module:flickr
 */
'use strict';

var _assign = require('lodash/object/assign');
var Flickr  = require('flickrapi');
var Promise = require('es6-promise').Promise;

var core    = require('../core');

var auth    = require('./auth');

let instances = {
  TokenOnly: null,
  Authenticated: null
};

let api = {
  people: {},
  photos: {}
};

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
api.getUnauthenticatedInstance = function(options) {
  if (instances.TokenOnly) {
    return Promise.resolve(instances.TokenOnly);
  }
  let errors = [];
  if (!options.flickrApiKey) {
    errors.push('Missing Flickr API Key');
  }
  if (!options.flickrApiSecret) {
    errors.push('Missing Flickr API Secret');
  }
  if (errors.length) {
    return Promise.reject(Error(errors.join('. ')));
  }
  return new Promise(function(resolve, reject) {
    Flickr.tokenOnly({
      api_key: options.flickrApiKey,
      secret: options.flickrApiSecret
    }, function(err, flickr) {
      if (err) {
        reject(err);
      } else {
        instances.TokenOnly = flickr;
        resolve(instances.TokenOnly);
      }
    });
  });
};

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
api.getAuthenticatedInstance = function(options) {
  if (instances.Authenticated) {
    return Promise.resolve(instances.Authenticated);
  }
  let missing = [];
  if (!options.flickrApiKey) {
    missing.push('Flickr API Key');
  }
  if (!options.flickrApiSecret) {
    missing.push('Flickr API Secret');
  }
  if (!options.flickrOauthToken) {
    missing.push('Flickr OAuth Token');
  }
  if (!options.flickrOauthTokenSecret) {
    missing.push('Flickr OAuth Token Secret');
  }
  if (missing.length) {
    core.logger.log(
      core.logger.error('Flickr authentication failed; missing ' +
      missing.join(', ')));
    core.logger.log('Let\'s go through the authentication process together.');
    return auth.authenticate(options);
  }
  let params = {
    api_key: options.flickrApiKey,
    secret: options.flickrApiSecret,
    access_token: options.flickrOauthToken,
    access_token_secret: options.flickrOauthTokenSecret
  };
  return new Promise(function(resolve, reject) {
    Flickr.authenticate(params, function(err, flickr) {
      if (err) {
        reject(err);
      } else {
        instances.Authenticated = flickr;
        resolve(instances.Authenticated);
      }
    });
  });
};

/**
 * Invoke Flickr photos.search endpoint.
 *
 * @param {Object} params - The parameters.
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
api.photos.search = function(params, options) {
  return api.getAuthenticatedInstance(options).then(function(flickr_api) {
    // console.log(flickr_api);
    return new Promise(function(resolve, reject) {
      let auth_params = _assign({authenticated: true}, params);
      flickr_api.photos.search(auth_params, function(err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  });
};

/**
 * Invoke Flickr people.findByUsername endpoint.
 *
 * @param {Object} params - The parameters.
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
api.people.findByUsername = function(params, options) {
  return api.getUnauthenticatedInstance(options).then(function(flickr_api) {
    return new Promise(function(resolve, reject) {
      flickr_api.people.findByUsername(params, function(err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  });
};

module.exports = api;
