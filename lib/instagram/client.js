'use strict';

var _assign   = require('lodash/object/assign');
var fetch     = require('node-fetch');
var ig_node   = require('instagram-node').instagram();

fetch.Promise = Promise;

var cache     = require('../cache');
var logger    = require('../logger');

var constants = require('./constants');

let api = {
  use: ig_node.use,
};

/**
 * Get cache key for user_search signature
 *
 * @param  {String} user_name User name
 * @param  {Object} options set of options
 * @return {String} cache key
 */
function user_search_cache_key(user_name, options) {
  let hash = cache.hash(options);
  return `ig_user_search_${user_name}_${hash}`;
}

/**
 * Front-end for instagram-node user_search, with cache.
 *
 * @param  {String} user_name User name
 * @param  {Object} options set of options
 * @param  {Function} callback callback
 * @return {void}
 */
api.user_search = function(user_name, options, callback) {
  let cache_key = user_search_cache_key(user_name, options);
  cache.get(cache_key).then(function(users) {
    // logger.log('user_search for', logger.notice(user_name), 'in cache');
    callback(null, users);
  }, function() {
    ig_node.user_search(
      user_name,
      options,
      function(err, users, remaining, limit) { //eslint-disable-line max-params
        if (!err && users.length) {
          cache.set(cache_key, users, constants.CACHE_TTL.user_search);
        }
        callback(err, users, remaining, limit);
      }
    );
  });
};

/**
 * Get cache key for user_media_recent signature
 *
 * @param  {String} user_id User ID
 * @param  {Object} options set of options
 * @return {String} cache key
 */
function user_media_recent_cache_key(user_id, options) {
  let hash = cache.hash(options);
  return `ig_user_media_recent_${user_id}_${hash}`;
}

/**
 * Front-end for instagram-node user_media_recent, with cache.
 *
 * @param  {String} user_id User name
 * @param  {Object} options set of options
 * @param  {Function} callback callback
 * @return {void}
 */
api.user_media_recent = function(user_id, options, callback) {
  // When requesting n medias, request up to the next page size -- e.g. when
  // requesting 3 retrieve 33, when requesting 15 retrieve 33, when requesting
  // 35 retrieve 66, etc. Cache for that page size so that on the next request
  // for 2, 3, 15 medias, we will hit the cache because we are actually
  // requesting the same 33 medias each time -- which is in the cache already.
  let optimized_options = _assign({}, options);
  if (optimized_options.count) {
    let page_size = constants.PAGE_SIZE.user_media_recent;
    optimized_options.count =
      Math.ceil(optimized_options.count / page_size) * page_size;
  }
  // TODO: better caching strategies
  // 2) When requesting n medias, check if we have *any* medias in the cache
  // for that call signature (*without* options.count). If we already have
  // enough in the cache, return a slice of it. If we do not, retrieve only
  // the *remaining* medias, i.e. the medias posted *earlier* than the id
  // of the last media already in the cache. Use that remainder to build a
  // larger cache entry, and store it. In other words, each subsequent call
  // may increase the number of medias in the cache entry. Note that the
  // max_id API option can be used for that query.
  let cache_key = user_media_recent_cache_key(user_id, optimized_options);
  let all_medias = [];
  let next_callback = callback;
  function handler( //eslint-disable-line max-params
    err, medias, pagination, remaining, limit) {
    if (!err) {
      all_medias.push.apply(all_medias, medias);
      // The pagination object is a tuple {next_max_id: ..., next: callback}.
      // Consider the API request without the options.count parameter: if
      // Instagram finds any number of media higher than options.count, then
      // the pagination object will be set. In other words, if options.count
      // is the only parameter, then the pagination object will be set until
      // all photos have been returned (e.g., if options.count is 3,
      // then 3 medias will be returned and pagination.next will point to
      // the *next* 3 medias after pagination.next_max_id).
      // Similarly, If options.minId or options.maxId are set, then pagination
      // will also be set until all the medias in between minId and maxId are
      // returned. If we request 3, and there are more than 3, pagination will
      // be set to return another 3. If we request 3, and there are only 3
      // remaining, then pagination will be empty.
      // In other words options.count also acts as a page count, one that can
      // not be greater than the built-in max page size for that API call.
      // While pagination.next being empty is a sure sign that the request
      // is done and we should cache the all_medias, we will also assume the
      // caller is keeping track of how many medias have been returned, and
      // will stop when the requested number is reached; this is especially
      // true when only options.count is used, which will paginate until all
      // photos have been found, even if options.count medias have already
      // been returned. Let's keep track of that count as well, and set the
      // case entry when it is reached. Even if we are wrong and the caller
      // keeps going, the cache will be overriden when pagination is empty.
      if (!pagination ||
          !pagination.next ||
          options.count && all_medias.length >= options.count) {
        cache.set(
          cache_key, all_medias, constants.CACHE_TTL.user_media_recent);
      }
    }
    if (pagination && pagination.next) {
      let old_next = pagination.next;
      pagination.next = function(cb) { // eslint-disable-line no-param-reassign
        next_callback = cb;
        old_next(handler);
      };
    }
    next_callback(err, medias, pagination, remaining, limit);
  }
  cache.get(cache_key).then(function(medias) {
    // logger.log('user_media_recent for', logger.notice(user_id), 'in cache');
    let sliced = options.count && medias.length > options.count;
    next_callback(null, sliced ? medias.slice(0, options.count) : medias, {});
  }, function() {
    ig_node.user_media_recent(user_id, optimized_options, handler);
  });
};

/**
 * Get cache key for oembed signature
 *
 * @param  {String} media_url Media URL
 * @return {String} cache key
 */
function oembed_cache_key(media_url) {
  return 'ig_oembed_' + cache.hash(media_url);
}

/**
 * Front-end for http://api.instagram.com/oembed, with cache.
 *
 * @param  {String} media_url Media URL
 * @return {Promise} resolving w/ the oembed object, or rejecting
 */
api.oembed = function(media_url) {
  let cache_key = oembed_cache_key(media_url);
  return cache.get(cache_key).then(function(oembed) {
    // logger.log('oembed for', logger.notice(media_url), 'in cache');
    return oembed;
  }, function() {
    let url = 'http://api.instagram.com/oembed?callback=&url=' + media_url;
    return fetch(url).then(function(response) {
      if (response.ok) {
        return response.json();
      }
      throw new logger.Error(
        'Could not fetch Instagram oembed for ' + media_url);
    }).then(function(oembed) {
      cache.set(cache_key, oembed, constants.CACHE_TTL.oembed);
      return oembed;
    });
  });
};

module.exports = api;