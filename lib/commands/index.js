/**
 * Commands module.
 * @module commands
 */
'use strict';

/** @see module:commands/download */
let download = require('./download');

/** @see module:commands/sync */
let sync = require('./sync');

module.exports = [
  download,
  sync,
];
