'use strict';

var crypto    = require('crypto');
var lzstring  = require('lz-string');
var Promise   = require('es6-promise').Promise;
var stringify = require('json-stable-stringify');

var constants = require('./constants');

// The Web Storage working draft defines local storage values as DOMString.
// DOMStrings are defined as sequences of 16-bit units using UTF-16 encoding.
let encoding = 'utf16le';

// store.js requires localStorage. We first need to provide an implementation
// if we are running in node.js; however, it is using UTF-8
if (typeof global.localStorage === 'undefined' ||
    global.localStorage === null) {
  encoding = 'utf8';
  var path = require('path');
  var mkdirp = require('mkdirp');
  var LocalStorage = require('node-localstorage').LocalStorage;
  let is_win32 = process.platform == 'win32';
  let home = process.env[is_win32 ? 'USERPROFILE' : 'HOME'];
  let app_dir = constants.SOFTWARE;
  if (!is_win32) {
    app_dir = '.' + app_dir;
  }
  // localStorage uses a directory where each entry is a file
  let cache_dir = path.join(home, app_dir, 'cache');
  mkdirp.sync(cache_dir);
  global.localStorage = new LocalStorage(cache_dir);
}

var store   = require('store');

let enabled = true;

/**
 * Enable cache
 */
function enable() {
  enabled = true;
}

/**
 * Disable cache
 */
function disable() {
  enabled = false;
}

/**
 * Compress a stringified cache entry
 *
 * @param {String} stringified_entry
 * @return {String} compressed cache entry
 */
function compress(stringified_entry) {
  return encoding === 'utf8'
    ? lzstring.compressToBase64(stringified_entry)
    : lzstring.compressToUTF16(stringified_entry);
}

/**
 * Decompress a cache entry
 *
 * @param {String} compressed_entry
 * @return {String} stringified cache entry
 */
function decompress(compressed_entry) {
  return encoding === 'utf8'
    ? lzstring.decompressFromBase64(compressed_entry)
    : lzstring.decompressFromUTF16(compressed_entry);
}

/**
 * Get the Error to throw when local storage has not been enabled
 *
 * @return {Error}
 */
function storeNotEnabledError() {
  return Error(`Local storage is not supported.`);
}

/**
 * Set a cache entry
 *
 * @param {String} key Key
 * @param {mixed} value Value
 * @param {int} ttl Optional TTL, in ms
 * @return {Promise} reject on error, resolve w/ true otherwise
 */
function set(key, value, ttl) {
  if (!enabled) {
    return Promise.reject();
  }
  if (!store.enabled) {
    return Promise.reject(storeNotEnabledError());
  }
  let entry = {
    value: value
  };
  // If the entry is not set to expire, do not bother adding properties
  if (ttl && ttl > 0) {
    entry.ttl = ttl;
    entry.expire = new Date().getTime() + ttl;
  }
  // Let's try to compress the entry; if it is smaller than its stringified
  // representation, use it.
  // http://stackoverflow.com/a/7411549/250457
  let stringified_entry = JSON.stringify(entry);
  let compressed_entry = compress(stringified_entry);
  let use_compression =
    Buffer.byteLength(stringified_entry, encoding) >
    Buffer.byteLength(compressed_entry, encoding);
  store.set(key, use_compression ? compressed_entry : entry);
  return Promise.resolve(true);
}

/**
 * Get a cache entry
 *
 * @param {String} key Key
 * @return {Promise} resolve w/ value, reject on error or not found or expired
 */
function get(key) {
  if (!enabled) {
    return Promise.reject();
  }
  if (!store.enabled) {
    return Promise.reject(storeNotEnabledError());
  }
  let entry = store.get(key);
  if (entry === undefined) {
    return Promise.reject();
  }
  // If we retrieved a string, then its the compressed representation of
  // the cache entry.
  if (typeof entry === 'string') {
    let decompressed_entry = decompress(entry);
    entry = JSON.parse(decompressed_entry);
  }
  // If it has expired, bail (remove it too)
  if (entry.ttl) {
    let now = new Date().getTime();
    if (now > entry.expire) {
      remove(key);
      return Promise.reject();
    }
  }
  return Promise.resolve(entry.value);
}

/**
 * Remove a cache entry
 *
 * @param {String} key Key
 * @return {Promise} reject on error, resolve w/ true otherwise
 */
function remove(key) {
  if (!enabled) {
    return Promise.reject();
  }
  if (!store.enabled) {
    return Promise.reject(storeNotEnabledError());
  }
  store.remove(key);
  return Promise.resolve(true);
}

/**
 * Clear all cache entries
 *
 * @return {Promise} reject on error, resolve w/ true otherwise
 */
function clear() {
  if (!enabled) {
    return Promise.reject();
  }
  if (!store.enabled) {
    return Promise.reject(storeNotEnabledError());
  }
  store.clear();
  return Promise.resolve(true);
}

/**
 * Get a hash
 *
 * @param {mixed} value
 * @return {String} hash
 */
function hash(value) {
  return crypto.createHash('md5').update(stringify(value)).digest('hex');
}

module.exports = {
  set: set,
  get: get,
  remove: remove,
  clear: clear,
  hash: hash,
  enable: enable,
  disable: disable,
  ttl: {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000
  }
};
