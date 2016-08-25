/**
 * Flickr utils module.
 * @module flickr/utils
 * @see module:flickr
 */

const assign = require('lodash/assign');
const crypto = require('crypto');
const qs = require('qs');
const sortObj = require('sort-object');

const api = {};

/**
 * Create API signature.
 *
 * @param {Object} data - The data to sign.
 * @param {string} key - The first part of the HMAC key.
 * @param {string} [secret] - The second part of the HMAC key.
 * @returns {string} The signature.
 */
api.createSignature = (data, key, secret) => {
  const hmac_key = `${key}&${secret || ''}`;
  const hmac = crypto.createHmac('SHA1', hmac_key);
  return encodeURIComponent(hmac.update(data).digest('base64'));
};

/**
 * Get API query string, given a query. This also adds the nonce, signature method, timestamp,
 * and version keys.
 *
 * @param {Object} query - The query.
 * @returns {string} The query string.
 */
api.getQueryString = (query) => {
  const timestamp = Date.now().toString();
  const md5 = crypto.createHash('md5').update(timestamp).digest('hex');
  const nonce = md5.substring(0, 32);
  const more = {
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
  };
  return qs.stringify(sortObj(assign(more, query)));
};

/**
 * Get API base string, given a verb, url, query string.
 *
 * @param {string} verb - The verb, usually GET or POST.
 * @param {string} url - The URL.
 * @param {string} query_string - The query string.
 * @returns {string} The base string.
  */
api.getBaseString = (verb, url, query_string) => [
  verb,
  encodeURIComponent(url),
  encodeURIComponent(query_string),
].join('&');

module.exports = api;
