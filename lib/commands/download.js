'use strict';

var _assign       = require('lodash/object/assign');
var _get          = require('lodash/object/get');
var _indexBy      = require('lodash/collection/indexBy');
var _set          = require('lodash/object/set');
var _values       = require('lodash/object/values');
var child_process = require('child_process');
var Download      = require('download');
var fs            = require('fs');
var mkdirp        = require('mkdirp');
var moment        = require('moment-timezone');
var os            = require('os');
var path          = require('path');
var throat        = require('throat');
var Promise       = require('es6-promise').Promise;
var tzlookup      = require('tz-lookup');

var sugar         = require('sugar'); // eslint-disable-line no-unused-vars

var cache         = require('../cache');
var constants     = require('../constants');
var instagram     = require('../instagram');
var logger        = require('../logger');
var media         = require('../media');
var user          = require('../user');
var utils         = require('../utils');

let cliOptions = {
  'd': {
    alias: 'dest',
    describe: 'Destination directory',
    type: 'string',
    default: './'
  },
  'a': {
    alias: 'always-download',
    describe: 'Always download, even if media is saved already',
    type: 'boolean',
    default: false
  },
  'j': {
    alias: 'json',
    describe: 'Save media json object (accepts keys to pluck)',
    default: false
  },
  'r': {
    alias: 'resolution',
    describe: 'Resolution(s) to download, e.g. ' +
      _values(instagram.RESOLUTIONS).join(','),
    type: 'string',
  }
};

/**
 * Convert a key or key=value parameter into a CLI args suitable for exiftools.
 *
 * @param {String} key Key
 * @param {mixed} value Optional value
 * @return {String} -key or -key=value CLI arg
 */
function cliArg(key, value) {
  return value === undefined ? `-${key}` : `-${key}=${value}`;
}

/**
 * Get the exiftool arguments needed to reference this software.
 *
 * @return {Array} array of command-line arguments
 */
function getExifToolSoftwareArgs() {
  let args = [];
  args.push(cliArg('EXIF:Software', constants.SOFTWARE));
  args.push(cliArg('XMP:CreatorTool', constants.SOFTWARE));
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media,
 * pertaining to its caption.
 *
 * @param {Object} media_obj Media object
 * @return {Array} array of command-line arguments
 */
function getExifToolCaptionArgs(media_obj) {
  let args = [];
  if (media_obj.caption && media_obj.caption.text.length) {
    args.push(cliArg('EXIF:ImageDescription', media_obj.caption.text));
    args.push(cliArg('IPTC:Caption-Abstract', media_obj.caption.text));
    args.push(cliArg('XMP:Description', media_obj.caption.text));
  }
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media,
 * pertaining to its user.
 *
 * @param {Object} media_obj Media object
 * @return {Array} array of command-line arguments
 */
function getExifToolUserArgs(media_obj) {
  let args = [];
  let copyright = 'Copyright ' + media_obj.user.full_name;
  args.push(cliArg('EXIF:Artist', media_obj.user.full_name));
  args.push(cliArg('EXIF:Copyright', copyright));
  args.push(cliArg('IPTC:CopyrightNotice', copyright));
  args.push(cliArg('XMP:Creator', media_obj.user.full_name));
  args.push(cliArg('XMP:Rights', copyright));
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media,
 * pertaining to its tags.
 *
 * @param {Object} media_obj Media object
 * @return {Array} array of command-line arguments
 */
function getExifToolTagArgs(media_obj) {
  let args = [];
  if (media_obj.tags.length) {
    let keywords_sep = ', ';
    let keywords = media_obj.tags.join(keywords_sep);
    args.push(cliArg('sep'));
    args.push(keywords_sep); // can't use -sep= here, for some reasons
    args.push(cliArg('IPTC:Keywords', keywords));
    args.push(cliArg('XMP:Subject', keywords));
  }
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media,
 * pertaining to its creation time.
 *
 * Supported options are:
 *   {Boolean} verbose Display more info
 *   {Boolean} quiet Output less info
 *
 * @param {Object} media_obj Media object
 * @param {Object} options Get options
 * @return {Array} array of command-line arguments
 */
function getExifToolCreatedArgs(media_obj, options) {
  let created = moment.unix(media_obj.created_time);
  if (media_obj.location) {
    // How to get a time zone from a location using latitude and longitude?
    // http://stackoverflow.com/q/16086962/250457
    let tz = tzlookup(
      media_obj.location.latitude,
      media_obj.location.longitude
      );
    created.tz(tz);
    if (options && options.verbose && !options.quiet) {
      let formatted = created.format();
      media.log(
        media_obj, 'Timezone is ' + logger.success(tz));
      media.log(
        media_obj, 'Creation time stored as ' + logger.success(formatted));
    }
  } else {
    if (options && options.verbose && !options.quiet) {
      let formatted = created.local().format();
      media.log(
        media_obj, 'No location, assume timezone ' + logger.warn('local'));
      media.log(
        media_obj, 'Creation time stored as ' + logger.success(formatted));
    }
  }
  let created_ymd = created.format('YYYY:MM:DD');
  let created_hms = created.format('HH:mm:ssZ');
  let created_ymd_hms = `${created_ymd} ${created_hms}`;
  let args = [];
  args.push(cliArg('EXIF:DateTimeOriginal', created_ymd_hms));
  args.push(cliArg('IPTC:DateCreated', created_ymd));
  args.push(cliArg('IPTC:TimeCreated', created_hms));
  args.push(cliArg('XMP:DateCreated', created_ymd_hms));
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media,
 * pertaining to its location.
 *
 * @param {Object} media_obj Media object
 * @return {Array} array of command-line arguments
 */
function getExifToolLocationArgs(media_obj) {
  let args = [];
  if (media_obj.location) {
    args.push(cliArg('EXIF:GPSLatitude', media_obj.location.latitude));
    let lat_ref = media_obj.location.latitude >= 0 ? 'N' : 'S';
    let long_ref = media_obj.location.longitude >= 0 ? 'E' : 'W';
    args.push(cliArg('EXIF:GPSLatitudeRef', lat_ref));
    args.push(cliArg('EXIF:GPSLongitude', media_obj.location.longitude));
    args.push(cliArg('EXIF:GPSLongitudeRef', long_ref));
  }
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media.
 *
 * Supported options are:
 *   {Boolean} verbose Display more info
 *
 * @param {Object} media_obj Media object
 * @param {Object} options Get options
 * @return {Array} array of command-line arguments
 */
function getExifToolArgs(media_obj, options) {
  let args = [];
  args.push(cliArg('q')); // hide informational messages
  args.push(cliArg('q')); // hide minor warnings (IPTC:Caption-Abstract...)
  args.push(cliArg('codedcharacterset', 'utf8'));
  args.push(cliArg('overwrite_original'));
  args = args.concat(
    getExifToolSoftwareArgs(),
    getExifToolCaptionArgs(media_obj),
    getExifToolUserArgs(media_obj),
    getExifToolTagArgs(media_obj),
    getExifToolCreatedArgs(media_obj, options),
    getExifToolLocationArgs(media_obj)
    );
  return args;
}

/**
 * Update (asynchronously) a file's metadata given its filename and a media
 * object containing the metadata information to store as EXIF fields.
 * This requires exiftool to be installed.
 *
 * Supported options are:
 *   {Boolean} quiet Output less info
 *
 * @param {Object} media_obj Media object
 * @param {String} filename Name of file to update metadata for
 * @param {Object} options Update options
 * @return {Promise} resolving on update, or rejecting
 */
function updateFileMetadata(media_obj, filename, options) {
  return new Promise(function(resolve, reject) {
    let basename = path.basename(filename);
    if (media_obj.type !== 'image') {
      resolve(false);
      return;
    }
    let args = getExifToolArgs(media_obj, options);
    args.push(filename);
    // logger.log(args); return;

    let exiftool = child_process.spawn('exiftool', args);
    let error_message = '';

    exiftool.stderr.on('data', function(data) {
      error_message += data.toString();
    });

    exiftool.on('error', function(err) {
      reject(new logger.Error(`Could not spawn exiftool (${err.message})`));
    });

    exiftool.on('close', function() {
      if (error_message) {
        reject(new logger.Error(error_message));
      } else {
        if (!options.quiet) {
          media.log(
            media_obj, 'Updated metadata in ' + logger.success(basename));
        }
        resolve(true);
      }
    });
  });
}

/**
 * Get the URL to the highest resolution for a given media
 * See http://stackoverflow.com/q/31302811/250457
 *
 * @param {Object} media_obj Media object
 * @return {String|Boolean} URL or false if not found
 */
function getUrlToHighestResolution(media_obj) {
  // let url = media_obj.images.low_resolution.url.split('/');
  // console.log(url.slice(0, 5).concat(url.slice(6)).join('/'));
  return media_obj.videos
    ? media_obj.videos
        ? media_obj.videos.standard_resolution.url
        : false
    : media_obj.images
        ? media_obj.images.low_resolution.url.replace(/[ps]320x320\//, '')
        : false;
}

/**
 * Get the URL to a resolution for a given media
 *
 * @param {Object} media_obj Media object
 * @param {String} resolution Resolution, undefined for highest
 * @return {String|Boolean} URL or false if not found
 */
function getUrlToResolution(media_obj, resolution) {
  if (resolution === instagram.RESOLUTIONS.HIGH || resolution === undefined) {
    return getUrlToHighestResolution(media_obj);
  }
  let urls = media_obj.videos ? media_obj.videos : media_obj.images;
  if (urls[resolution]) {
    return urls[resolution].url;
  }
  return false;
}

/**
 * Get basename for media at resolution
 *
 * @param {Object} media_obj Media object
 * @param {String} resolution Resolution to fetch, undefined for highest
 * @return {String} basename
 */
function getMediaBasenameForResolution(media_obj, resolution) {
  let name = media.createMediaFileName(media_obj);
  let suffix = media_obj.type === 'image' && resolution !== undefined
    ? '-' + resolution : '';
  let ext = media_obj.type === 'image' ? '.jpg' : '.mp4';
  return `${name}${suffix}${ext}`;
}

/**
 * Fetch a media (asynchronously)
 *
 * Supported options are:
 *   {String} dest Destination directory
 *   {Boolean} alwaysDownload Always download, even if on disk already
 *   {Boolean} quiet Output less info
 *
 * @param {Object} media_obj Media object
 * @param {String} resolution Resolution to fetch, undefined for highest
 * @param {Object} options Fetch options
 * @return {Promise} resolving w/ filename once fetched, or rejecting
 */
function fetchMedia(media_obj, resolution, options) {
  return new Promise(function(resolve, reject) {
    let url = getUrlToResolution(media_obj, resolution);
    if (url === false) {
      reject(new logger.Error(`Could not find resolution: ${resolution}`));
      return;
    }
    let basename = getMediaBasenameForResolution(media_obj, resolution);
    let dest = options && options.dest ? options.dest : './';
    let filename = path.join(dest, basename);
    fs.lstat(filename, function(lstat_err, stats) {
      // Do not re-download if the file already exists
      if (!lstat_err &&
          stats.isFile() &&
          (!options || !options.alwaysDownload)) {
        if (!options || !options.quiet) {
          media.log(
            media_obj, 'Saved already as ' + logger.success(basename));
        }
        resolve(filename);
      } else {
        new Download()
        .get(url)
        .dest(dest)
        .rename(basename)
        .run(function(download_err, files) {
          if (download_err) {
            reject(download_err);
          } else {
            if (!options || !options.quiet) {
              let file_basename = path.basename(files[0].path);
              media.log(
                media_obj, 'Fetched ' + logger.success(file_basename));
            }
            resolve(files[0].path);
          }
        });
      }
    });
  });
}

/**
 * Get basename for media object
 *
 * @param {Object} media_obj Media object
 * @return {String} basename
 */
function getMediaObjectBasename(media_obj) {
  return media.createMediaFileName(media_obj) + '.json';
}

/**
 * Save a media description (asynchronously)
 *
 * Supported options are:
 *   {String} dest Destination directory
 *   {Boolean} quiet Output less info
 *
 * @param {Object} media_obj Media object
 * @param {Object} options Fetch options
 * @return {Promise} resolving w/ filename once saved, or rejecting
 */
function saveMediaObject(media_obj, options) {
  return new Promise(function(resolve, reject) {
    let basename = getMediaObjectBasename(media_obj);
    let keys = options.json && options.json.constructor === Array
      ? options.json : null;
    let dest = options.dest || './';
    mkdirp(dest, function(mkdirp_err) {
      if (mkdirp_err) {
        reject(mkdirp_err);
      } else {
        let filename = path.join(dest, basename);
        let media_to_save = media_obj;
        if (keys !== null) {
          let filtered_media = {};
          keys.forEach(function(key) {
            let value = _get(media_obj, key);
            if (value !== undefined) {
              _set(filtered_media, key, value);
            }
          });
          media_to_save = filtered_media;
        }
        let stringified = JSON.stringify(media_to_save, null, 2);
        fs.writeFile(filename, stringified, function(err) {
          if (err) {
            reject(err);
          } else {
            if (!options.quiet) {
              media.log(media_obj, 'Saved ' + logger.success(basename));
            }
            resolve(filename);
          }
        });
      }
    });
  });
}

/**
 * Resolve options, i.e. fetches (asynchronously) all options that need
 * resolving through the Instagram API (user id from user name for example).
 *
 * @param  {Object} options Options to resolve
 * @return {Promise} resolving with resolved options, or rejecting
 */
/*eslint-disable complexity */
function resolveOptions(options) {
  let resolved_options = _assign({}, options);
  if (resolved_options.accessToken === undefined) {
    let env_token = constants.ACCESS_TOKEN_ENV_VAR;
    if (process.env && process.env.hasOwnProperty(env_token)) {
      resolved_options.accessToken = process.env[env_token];
      if (options.verbose && !options.quiet) {
        logger.log('Using', logger.success(env_token),
          'environment variable to set Instagram Access Token');
      }
    } else {
      return Promise.reject(new logger.Error('Need Instagram access token'));
    }
  }
  if (!resolved_options.userId) {
    return Promise.reject(new logger.Error('Need user ID or user name'));
  }
  instagram.use({
    access_token: resolved_options.accessToken
  });
  let timestamps = {
    minTimestamp: 'Min Timestamp',
    maxTimestamp: 'Max Timestamp'
  };
  for (let timestamp in timestamps) {
    if (options[timestamp]) {
      resolved_options[timestamp] = utils.isUnixTimestamp(options[timestamp])
        ? options[timestamp]
        : Math.floor(Date.create(options[timestamp]).getTime() / 1000);
      logger.log(
        timestamps[timestamp] + ':', logger.notice(options[timestamp]),
        'is',
        logger.success(moment.unix(resolved_options[timestamp]).format()),
        '(Unix:', resolved_options[timestamp] + ')');
    }
  }
  if (typeof resolved_options.json === 'string') {
    resolved_options.json = resolved_options.json.split(',');
  }
  if (typeof resolved_options.resolution === 'string') {
    resolved_options.resolution = resolved_options.resolution.split(',');
  }
  let before = options.clearCache ? cache.clear() : Promise.resolve();
  let resolvers = Promise.all([
    user.resolveUserId(options.userId).then(function(value) {
      resolved_options.userId = value;
    }),
    media.resolveMediaId(options.minId).then(function(value) {
      resolved_options.minId = value;
    }),
    media.resolveMediaId(options.maxId).then(function(value) {
      resolved_options.maxId = value;
    })
  ]);
  return before.then(function() {
    return resolvers;
  }).then(function() {
    return resolved_options;
  });
}
/*eslint-enable complexity */

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
