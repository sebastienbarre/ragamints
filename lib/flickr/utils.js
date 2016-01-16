'use strict';

var _assign  = require('lodash/object/assign');
var crypto   = require('crypto');
var qs       = require('qs');
var sortObj  = require('sort-object');

let api = {};

/**
 * Create API signature.
 *
 * @param  {Object} data data to sign
 * @param  {String} key part of the HMAC key
 * @param  {String} secret optional second part of the HMAC key
 * @return {String} signature
 */
api.createSignature = function(data, key, secret) {
  let hmac_key = `${key}&${secret ? secret : ''}`;
  let hmac = crypto.createHmac('SHA1', hmac_key);
  return encodeURIComponent(hmac.update(data).digest('base64'));
};

/**
 * Get API query string, given a query.
 *
 * This also adds the nonce, signature method, timestamp, and version keys.
 *
 * @param  {Object} query query
 * @return {String} query string
 */
api.getQueryString = function(query) {
  let timestamp = Date.now().toString();
  let md5 = crypto.createHash('md5').update(timestamp).digest('hex');
  let nonce = md5.substring(0,32);
  let more = {
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0'
  };
  return qs.stringify(sortObj(_assign(more, query)));
};

/**
 * Get API base string, given a verb, url, query string
 *
 * @param  {String} verb usually GET or POST
 * @param  {String} url url
 * @param  {String} query_string query string
 * @return {String} base string
  */
api.getBaseString = function(verb, url, query_string) {
  return [
    verb,
    encodeURIComponent(url),
    encodeURIComponent(query_string)
  ].join('&');
};

module.exports = api;
