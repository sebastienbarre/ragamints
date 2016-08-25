/**
 * Core cache module.
 * @module core/cache
 * @see module:core
 */

const crypto = require('crypto');
const LocalStorage = require('node-localstorage').LocalStorage;
const lzstring = require('lz-string');
const mkdirp = require('mkdirp');
const path = require('path');
const Promise = require('es6-promise').Promise;
const stringify = require('json-stable-stringify');

const constants = require('./constants');

/**
 * Enum for convenient Time-To-Live values.
 *
 * @constant
 * @enum {number}
 */
const TTL = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

const api = {
  TTL,
};

let enabled = true;

// The Web Storage working draft defines local storage values as DOMString.
// DOMStrings are defined as sequences of 16-bit units using UTF-16 encoding.
let encoding = 'utf16le';

// store.js requires localStorage. We first need to provide an implementation if we are running in
// node.js; however, it is using UTF-8
if (typeof global.localStorage === 'undefined' ||
    global.localStorage === null) {
  const is_win32 = process.platform === 'win32';
  const home = process.env[is_win32 ? 'USERPROFILE' : 'HOME'];
  let app_dir = constants.SOFTWARE;
  if (!is_win32) {
    app_dir = `.${app_dir}`;
  }
  // localStorage uses a directory where each entry is a file
  const cache_dir = path.join(home, app_dir, 'cache');
  mkdirp.sync(cache_dir);
  global.localStorage = new LocalStorage(cache_dir);
}
if (global.localStorage instanceof LocalStorage) {
  encoding = 'utf8';
}

const store = require('store');

/**
 * Get the Error to throw when local storage has not been enabled.
 *
 * @returns {Error} The error.
 */
function storeNotEnabledError() {
  return Error('Local storage is not supported.');
}

/**
 * Enable cache.
 */
api.enable = () => {
  enabled = true;
};

/**
 * Disable cache.
 */
api.disable = () => {
  enabled = false;
};

/**
 * Compress a stringified cache entry.
 *
 * @param {string} stringified_entry - The stringified string to compress.
 * @returns {string} The compressed cache entry.
 */
api.compress = stringified_entry =>
  (encoding === 'utf8'
    ? lzstring.compressToBase64(stringified_entry)
    : lzstring.compressToUTF16(stringified_entry));

/**
 * Decompress a cache entry.
 *
 * @param {string} compressed_entry - The entry to decompress.
 * @returns {string} The stringified cache entry.
 */
api.decompress = compressed_entry =>
  (encoding === 'utf8'
    ? lzstring.decompressFromBase64(compressed_entry)
    : lzstring.decompressFromUTF16(compressed_entry));

/**
 * Set a cache entry.
 *
 * @param {string} key - The key.
 * @param {*} value - The value.
 * @param {int} [ttl] - The TTL, in ms.
 * @returns {Promise} The promise rejecting on error, resolving w/ true otherwise.
 */
api.set = (key, value, ttl) => {
  if (!enabled) {
    return Promise.reject();
  }
  if (!store.enabled) {
    return Promise.reject(storeNotEnabledError());
  }
  const entry = {
    value,
  };
  // If the entry is not set to expire, do not bother adding properties
  if (ttl && ttl > 0) {
    entry.ttl = ttl;
    entry.expire = new Date().getTime() + ttl;
  }
  // Let's try to compress the entry; if it is smaller than its stringified
  // representation, use it.
  // http://stackoverflow.com/a/7411549/250457
  const stringified_entry = JSON.stringify(entry);
  const compressed_entry = api.compress(stringified_entry);
  const use_compression =
    Buffer.byteLength(stringified_entry, encoding) >
    Buffer.byteLength(compressed_entry, encoding);
  store.set(key, use_compression ? compressed_entry : entry);
  return Promise.resolve(true);
};

/**
 * Get a cache entry.
 *
 * @param {string} key - The key.
 * @returns {Promise} The promise resolving w/ value, rejecting on error or not found or expired.
 */
api.get = (key) => {
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
    entry = JSON.parse(api.decompress(entry));
  }
  // If it has expired, bail (remove it too)
  if (entry.ttl) {
    const now = new Date().getTime();
    if (now > entry.expire) {
      api.remove(key);
      return Promise.reject();
    }
  }
  return Promise.resolve(entry.value);
};

/**
 * Remove a cache entry.
 *
 * @param {string} key - The key.
 * @returns {Promise} The promise rejecting on error, resolving w/ true otherwise.
 */
api.remove = (key) => {
  if (!enabled) {
    return Promise.reject();
  }
  if (!store.enabled) {
    return Promise.reject(storeNotEnabledError());
  }
  store.remove(key);
  return Promise.resolve(true);
};

/**
 * Clear all cache entries.
 *
 * @returns {Promise} The promise rejecting on error, resolving w/ true otherwise.
 */
api.clear = () => {
  if (!enabled) {
    return Promise.reject();
  }
  if (!store.enabled) {
    return Promise.reject(storeNotEnabledError());
  }
  store.clear();
  return Promise.resolve(true);
};

/**
 * Compute a hash.
 *
 * @param {*} value - The value to hash.
 * @returns {string} The hash.
 */
api.hash = value => crypto.createHash('md5').update(stringify(value)).digest('hex');

module.exports = api;
