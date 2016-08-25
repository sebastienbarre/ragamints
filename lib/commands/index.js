/**
 * Commands module.
 * @module commands
 */

/** @see module:commands/download */
const download = require('./download');

/** @see module:commands/sync */
const sync = require('./sync');

module.exports = [
  download,
  sync,
];
