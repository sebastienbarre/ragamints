'use strict';

let api = {};

/**
 * Pad string to the right.
 *
 * @param {string} str - The string to pad.
 * @param {char} char - The char to pad with.
 * @param {int} length - The total length after padding.
 * @returns {string} The padded string.
 */
api.padRight = function(str, char, length) {
  return str + char.repeat(Math.max(0, length - str.length));
};

/**
 * Pad number with zeros to the left.
 *
 * @param {number} num - The number to pad (assumed positive and not float).
 * @param {int} length - The total length after padding.
 * @returns {string} The padded number.
 */
api.padLeftZero = function(num, length) {
  let pad = Math.max(0, length - num.toString().length);
  return Math.pow(10, pad).toString().substr(1) + num;
};

/**
 * Check if timestamp is a valid Unix Timestamp.
 *
 * @param {int} timestamp - The Unix timestamp.
 * @returns {boolean} True if valid.
 */
api.isUnixTimestamp = function(timestamp) {
  return /^[0-9]+$/.test(timestamp);
};

module.exports = api;
