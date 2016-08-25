/**
 * Flickr client module.
 * @module flickr/client
 * @see module:flickr
 */

const assign = require('lodash/assign');
const Flickr = require('flickrapi');
const Promise = require('es6-promise').Promise;

const core = require('../core');

const auth = require('./auth');

const instances = {
  TokenOnly: null,
  Authenticated: null,
};

const api = {
  people: {},
  photos: {},
};

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given a Flickr User Name,
 * if needed.
 *
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
api.getUnauthenticatedInstance = (options) => {
  if (instances.TokenOnly) {
    return Promise.resolve(instances.TokenOnly);
  }
  const errors = [];
  if (!options.flickrApiKey) {
    errors.push('Missing Flickr API Key');
  }
  if (!options.flickrApiSecret) {
    errors.push('Missing Flickr API Secret');
  }
  if (errors.length) {
    return Promise.reject(Error(errors.join('. ')));
  }
  return new Promise((resolve, reject) => {
    Flickr.tokenOnly({
      api_key: options.flickrApiKey,
      secret: options.flickrApiSecret,
    }, (err, flickr) => {
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
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given a Flickr User Name,
 * if needed.
 *
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
api.getAuthenticatedInstance = (options) => {
  if (instances.Authenticated) {
    return Promise.resolve(instances.Authenticated);
  }
  const missing = [];
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
    const all_missing = missing.join(', ');
    core.logger.log(core.logger.error(`Flickr authentication failed; missing ${all_missing}`));
    core.logger.log('Let\'s go through the authentication process together.');
    return auth.authenticate(options);
  }
  const params = {
    api_key: options.flickrApiKey,
    secret: options.flickrApiSecret,
    access_token: options.flickrOauthToken,
    access_token_secret: options.flickrOauthTokenSecret,
  };
  return new Promise((resolve, reject) => {
    Flickr.authenticate(params, (err, flickr) => {
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
api.photos.search = (params, options) =>
  api.getAuthenticatedInstance(options).then(flickr_api => new Promise((resolve, reject) => {
    const auth_params = assign({ authenticated: true }, params);
    flickr_api.photos.search(auth_params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  })
);

/**
 * Invoke Flickr people.findByUsername endpoint.
 *
 * @param {Object} params - The parameters.
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
api.people.findByUsername = (params, options) =>
  api.getUnauthenticatedInstance(options).then(flickr_api => new Promise((resolve, reject) => {
    flickr_api.people.findByUsername(params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  })
);

module.exports = api;
