'use strict';

var _assign = require('lodash/object/assign');
var crypto  = require('crypto');
var fetch   = require('node-fetch');
var Flickr  = require('flickrapi');
var Promise = require('es6-promise').Promise;

var logger  = require('./logger');

fetch.Promise = Promise;

let api = {
  TokenOnly: null,
  Authenticated: null
};

/**
 * Create API signature.
 *
 * @param  {Object} data data to sign
 * @param  {String} key part of the HMAC key
 * @param  {String} secret optional second part of the HMAC key
 * @return {String} signature
 */
function createSignature(data, key, secret) {
  let hmac_key = `${key}&${secret ? secret : ''}`;
  let hmac = crypto.createHmac('SHA1', hmac_key);
  return encodeURIComponent(hmac.update(data).digest('base64'));
}

/**
 * Get API query string, given a query.
 *
 * This also adds the nonce, signature method, timestamp, and version keys.
 *
 * @param  {Object} query query
 * @return {String} query string
 */
function getQueryString(query) {
  let timestamp = Date.now().toString();
  let md5 = crypto.createHash('md5').update(timestamp).digest('hex');
  let nonce = md5.substring(0,32);
  let more = {
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0'
  };
  let full_query = _assign(more, query);
  return Object.keys(full_query).sort().map(function(key) {
    return `${key}=${encodeURIComponent(full_query[key])}`;
  }).join('&');
}

/**
 * Get API base string, given a verb, url, query string
 *
 * @param  {String} verb usually GET or POST
 * @param  {String} url url
 * @param  {String} query_string query string
 * @return {String} base string
  */
function getBaseString(verb, url, query_string) {
  return [
    verb,
    encodeURIComponent(url),
    encodeURIComponent(query_string)
  ].join('&');
}

/**
 * Get Request Token URL.
 *
 * @param  {String} api_key Flickr API key
 * @param  {String} api_secret Flickr API secret
 * @param  {String} callback_url URL to callback
 * @return {String} request token URL
 */
function getRequestTokenUrl(api_key, api_secret, callback_url) {
  let query = {
    oauth_consumer_key: api_key,
    oauth_callback: callback_url
  };
  let query_string = getQueryString(query);
  let url = 'https://www.flickr.com/services/oauth/request_token';
  let base_string = getBaseString('GET', url, query_string);
  let signature = createSignature(base_string, api_secret);
  return `${url}?${query_string}&oauth_signature=${signature}`;
}

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param  {Object} options options
 * @return {Promise} resolving with Flickr user ID, or rejecting
 */
function authenticate(options) {
  let request_token_url = getRequestTokenUrl(
    options.flickrApiKey, options.flickrApiSecret, 'http://localhost');
  return fetch(request_token_url).then(function(response) {
    console.log(response);
    if (response.ok) {
      return response.json();
    }
    throw new logger.Error('Failed Requesting Token');
  }).then(function(params) {
    console.log(params);
    return true;
  });
}

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param  {Object} options options
 * @return {Promise} resolving with Flickr user ID, or rejecting
 */
function getUnauthenticatedInstance(options) {
  if (api.TokenOnly) {
    return Promise.resolve(api.TokenOnly);
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
        api.TokenOnly = flickr;
        resolve(api.TokenOnly);
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
function getAuthenticatedInstance(options) {
  if (api.Authenticated) {
    return Promise.resolve(api.Authenticated);
  }
  let errors = [];
  if (!options.flickrApiKey) {
    errors.push('Missing Flickr API Key');
  }
  if (!options.flickrApiSecret) {
    errors.push('Missing Flickr API Secret');
  }
  if (!options.flickrOauthToken) {
    errors.push('Missing Flickr OAuth Token');
  }
  if (!options.flickrOauthTokenSecret) {
    errors.push('Missing Flickr OAuth Token Secret');
  }
  if (errors.length) {
    return authenticate(options);
    // return Promise.reject(Error(errors.join('. ')));
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
        api.Authenticated = flickr;
        resolve(api.Authenticated);
      }
    });
  });
}

/**
 * Check if id is a valid Flickr User ID.
 *
 * @param {String} user_id Flickr User ID
 * @return {Boolean} true if valid
 */
function isUserId(user_id) {
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
function resolveUserId(user_id_or_name, options) {
  if (isUserId(user_id_or_name)) {
    return Promise.resolve(user_id_or_name);
    return;
  }
  return getUnauthenticatedInstance(options).then(function(flickr_api) {
    return new Promise(function(resolve, reject) {
      flickr_api.people.findByUsername({
        username: user_id_or_name
      }, function(err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result.user.nsid);
        }
      });
    });
  });
}

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param  {Object} params parameters
 * @param  {Object} options options
 * @return {Promise} resolving with Flickr user ID, or rejecting
 */
function photosSearch(params, options) {
  return getAuthenticatedInstance(options).then(function(flickr_api) {
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
}

module.exports = {
  getUnauthenticatedInstance: getUnauthenticatedInstance,
  getAuthenticatedInstance: getAuthenticatedInstance,
  resolveUserId: resolveUserId,
  photosSearch: photosSearch
};
