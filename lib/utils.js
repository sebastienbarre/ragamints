'use strict';

let api = {};

/**
 * Pad string to the right.
 *
 * @param {String} str String to pad
 * @param {char} char Char to pad with
 * @param {int} length Total length after padding
 * @return {String} Padded string
 */
api.padRight = function(str, char, length) {
  return str + char.repeat(Math.max(0, length - str.length));
};

/**
 * Pad number with zeros to the left.
 *
 * @param {Number} num Number to pad (assumed positive and not float)
 * @param {int} length Total length after padding
 * @return {String} Padded number
 */
api.padLeftZero = function(num, length) {
  let pad = Math.max(0, length - num.toString().length);
  return Math.pow(10, pad).toString().substr(1) + num;
};

/**
 * Check if timestamp is a valid Unix Timestamp.
 *
 * @param {int} timestamp Unix timestamp
 * @return {Boolean} true if valid
 */
api.isUnixTimestamp = function(timestamp) {
  return /^[0-9]+$/.test(timestamp);
};

module.exports = api;
