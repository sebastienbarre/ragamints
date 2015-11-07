'use strict';

var _assign       = require('lodash/object/assign');
var child_process = require('child_process');
var Download      = require('download');
var fs            = require('fs');
var mkdirp        = require('mkdirp');
var moment        = require('moment-timezone');
var objectPath    = require('object-path');
var path          = require('path');
var Promise       = require('es6-promise').Promise;
var sugar         = require('sugar'); // Date.create()
var tzlookup      = require('tz-lookup');

var constants     = require('../constants');
var ig            = require('../instagram'); // ig.use
var logger        = require('../logger');
var media         = require('../media');
var user          = require('../user');
var utils         = require('../utils');

let resolutions = ['thumbnail', 'low_resolution', 'standard_resolution'];
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
    describe: 'Resolution(s) to download, e.g. ' + resolutions.join(','),
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
  if (media_obj.user.full_name.length) {
    let copyright = 'Copyright ' + media_obj.user.full_name;
    args.push(cliArg('EXIF:Artist', media_obj.user.full_name));
    args.push(cliArg('EXIF:Copyright', copyright));
    args.push(cliArg('IPTC:CopyrightNotice', copyright));
    args.push(cliArg('XMP:Creator', media_obj.user.full_name));
    args.push(cliArg('XMP:Rights', copyright));
  }
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
    if (options.verbose && !options.quiet) {
      let formatted = created.format();
      media.log(
        media_obj, 'Timezone is ' + logger.success(tz));
      media.log(
        media_obj, 'Creation time stored as ' + logger.success(formatted));
    }
  } else {
    if (options.verbose && !options.quiet) {
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
 * Fetch a media (asynchronously)
 *
 * Supported options are:
 *   {String} dest Destination directory
 *   {Boolean} alwaysDownload Always download, even if on disk already
 *   {Boolean} quiet Output less info
 *
 * @param {Object} media_obj Media object
 * @param {String} resolution Resolution to fetch
 * @param {Object} options Fetch options
 * @return {Promise} resolving w/ filename once fetched, or rejecting
 */
function fetchMedia(media_obj, resolution, options) {
  return new Promise(function(resolve, reject) {
    let urls = media_obj.videos ? media_obj.videos : media_obj.images;
    if (urls[resolution] === undefined) {
      reject(new logger.Error(`Could not find resolution: ${resolution}`));
    } else {
      let resolution_suffix = {
        'thumbnail': '-thumbnail',
        'low_resolution': '-low',
        'standard_resolution': ''
      };
      let name = media.createMediaFileName(media_obj);
      let suffix = media_obj.type === 'image'
        ? resolution_suffix[resolution] : '';
      let ext = media_obj.type === 'image'
        ? '.jpg' : '.mp4';
      let basename = `${name}${suffix}${ext}`;
      let dest = options.dest || './';
      let filename = path.join(dest, basename);
      fs.lstat(filename, function(lstat_err, stats) {
        // Do not re-download if the file already exists
        if (!lstat_err && stats.isFile() && !options.alwaysDownload) {
          if (!options.quiet) {
            media.log(
              media_obj, 'Saved already as ' + logger.success(basename));
          }
          resolve(filename);
        } else {
          new Download()
          .get(urls[resolution].url)
          .dest(dest)
          .rename(basename)
          .run(function(download_err, files) {
            if (download_err) {
              reject(download_err);
            } else {
              if (!options.quiet) {
                let file_basename = path.basename(files[0].path);
                media.log(
                  media_obj, 'Fetched ' + logger.success(file_basename));
              }
              resolve(files[0].path);
            }
          });
        }
      });
    }
  });
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
    let basename = media.createMediaFileName(media_obj) + '.json';
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
            let value = objectPath.get(media_obj, key);
            if (value !== undefined) {
              objectPath.set(filtered_media, key, value);
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
function resolveOptions(options) {
  let resolved_options = _assign({}, options);
  if (resolved_options.accessToken === undefined) {
    let env_var = constants.ACCESS_TOKEN_ENV_VAR;
    if (process.env && process.env.hasOwnProperty(env_var)) {
      resolved_options.accessToken = process.env[env_var];
      if (options.verbose && !options.quiet) {
        logger.log('Using', logger.success(env_var),
          'environment variable to set Instagram Access Token');
      }
    } else {
      return Promise.reject(new logger.Error('Need Instagram access token'));
    }
  }
  ig.use({
    access_token: resolved_options.accessToken
  });
  if (!resolved_options.userId) {
    return Promise.reject(new logger.Error('Need user ID or user name'));
  }
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
  return Promise.all([
    user.resolveUserId(options.userId),
    media.resolveMediaId(options.minId),
    media.resolveMediaId(options.maxId)
    ]).then(function(values) {
      resolved_options.userId = values[0];
      resolved_options.minId = values[1];
      resolved_options.maxId = values[2];
      return resolved_options;
    });
}

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
  function processMedia(media, options) {
    if (media.type === 'video' && !options.includeVideos) {
      return Promise.resolve();
    }
    let promises = [];
    let resolutions = media.type === 'image' && options.resolution
      ? options.resolution : ['standard_resolution'];
    resolutions.forEach(function(resolution) {
      promises.push(
        fetchMedia(media, resolution, options).then(function(filename) {
          return updateFileMetadata(media, filename, options);
        })
      );
    });
    if (options.json) {
      promises.push(saveMediaObject(media, options));
    }
    return Promise.all(promises).then(function() {
      return media;
    });
  }
  return resolveOptions(unresolved_options).then(function(options) {
    return user.forEachRecentMedias(options.userId, options, processMedia);
  });
}

module.exports = {
  name: 'download',
  description: 'download medias from Instagram',
  options: _assign({}, user.getRecentMediasCliOptions, cliOptions),
  run: run
};
