'use strict';

/**
 * Pad string to the right.
 *
 * @param {String} str String to pad
 * @param {char} char Char to pad with
 * @param {int} length Total length after padding
 * @return {String} Padded string
 */
function padRight(str, char, length) {
  return str + char.repeat(Math.max(0, length - str.length));
}

/**
 * Pad number with zeros to the left.
 *
 * @param {Number} num Number to pad (assumed positive and not float)
 * @param {int} length Total length after padding
 * @return {String} Padded number
 */
function padLeftZero(num, length) {
  let pad = Math.max(0, length - num.toString().length);
  return Math.pow(10, pad).toString().substr(1) + num;
}

module.exports = {
  padRight: padRight,
  padLeftZero: padLeftZero
};
