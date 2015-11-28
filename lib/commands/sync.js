'use strict';

var _assign       = require('lodash/object/assign');
var Promise       = require('es6-promise').Promise;

// var cache         = require('../cache');
// var constants     = require('../constants');
// var instagram     = require('../instagram');
var logger        = require('../logger');
// var media         = require('../media');
// var user          = require('../user');
// var utils         = require('../utils');

let cliOptions = {
  'flickr-user-id': {
    describe: 'Flickr user',
    type: 'string'
  }
};

/**
 * Resolve options.
 *
 * It fetches (asynchronously) all options that need resolving through the
 * Flickr API (user id from user name for example).
 *
 * @param  {Object} options Options to resolve
 * @return {Promise} resolving with resolved options, or rejecting
 */
function resolveOptions(options) {
  let resolved_options = _assign({}, options);
  if (!resolved_options.flickrUserId) {
    return Promise.reject(new logger.Error('Need Flickr user ID or name'));
  }
  return Promise.resolve(resolved_options);
}

/**
 * Run task.
 *
 * @param {Object} unresolved_options Query options
 * @return {Promise} resolving with all medias when done, or rejecting
  */
function run(unresolved_options) {
  return resolveOptions(unresolved_options).then(function() {
    return true;
  });
}

module.exports = {
  name: 'sync',
  description: 'sync medias from Instagram to Flickr',
  options: cliOptions,
  run: run
};
