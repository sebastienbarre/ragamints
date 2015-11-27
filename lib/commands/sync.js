'use strict';

// var cache         = require('../cache');
// var constants     = require('../constants');
// var instagram     = require('../instagram');
// var logger        = require('../logger');
// var media         = require('../media');
// var user          = require('../user');
// var utils         = require('../utils');

let cliOptions = {
  'flickr-user': {
    describe: 'Flickr user',
    type: 'string'
  }
};

/**
 * Run task.
 * Query Instagram and process (i.e., let's go), asynchronous version
 *
 * Supported options are:
 *   {String} userId User Id
 *
 * @param {Object} unresolved_options Query options
 * @return {Promise} resolving with all medias when done, or rejecting
  */
function run(unresolved_options) {
  let q = throat(os.cpus().length);
  function processMedia(media_obj, options) {
    let promises = [];
    if (options.json) {
      promises.push(saveMediaObject(media_obj, options));
    }
    if (options.resolution !== false) {
      let resolutions = media_obj.type === 'image' && options.resolution
        ? options.resolution
        : [undefined]; // undefined will try to retrieve the highest res
      // De-duplicate the requested resolutions
      resolutions = _values(
        _indexBy(resolutions, getUrlToResolution.bind(this, media_obj)));
      resolutions.forEach(function(resolution) {
        promises.push(
          fetchMedia(media_obj, resolution, options).then(function(filename) {
            return q(
              updateFileMetadata.bind(this, media_obj, filename, options));
          })
        );
      });
    }
    return Promise.all(promises).then(function() {
      return media_obj;
    });
  }
  return resolveOptions(unresolved_options).then(function(options) {
    return user.forEachRecentMedias(options.userId, options, processMedia);
  });
}

module.exports = {
  name: 'download',
  description: 'download medias from Instagram',
  options: _assign({}, user.forEachRecentMediasCliOptions, cliOptions),
  run: run
};
