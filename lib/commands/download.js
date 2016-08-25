/**
 * Download command module.
 * @module commands/download
 * @see module:commands
 */

const assign = require('lodash/assign');
const get = require('lodash/get');
const keyBy = require('lodash/keyBy');
const set = require('lodash/set');
const values = require('lodash/values');
const child_process = require('child_process');
const Download = require('download');
const fs = require('fs');
const mkdirp = require('mkdirp');
const moment = require('moment-timezone');
const os = require('os');
const path = require('path');
const throat = require('throat');
const Promise = require('es6-promise').Promise;
const tzlookup = require('tz-lookup');

const sugar = require('sugar'); // eslint-disable-line no-unused-vars

const core = require('../core');
const instagram = require('../instagram');

const cliOptions = {
  'd': {
    alias: 'dest',
    describe: 'Destination directory',
    type: 'string',
    default: './',
  },
  'a': {
    alias: 'always-download',
    describe: 'Always download, even if media is saved already',
    type: 'boolean',
    default: false,
  },
  'j': {
    alias: 'json',
    describe: 'Save media json object (accepts keys to pluck)',
    default: false,
  },
  'r': {
    alias: 'resolution',
    describe: `Resolution(s) to download, e.g. ${values(instagram.client.RESOLUTIONS).join(',')}`,
    type: 'string',
  },
};

/**
 * Convert a key or key=value parameter into a CLI args suitable for exiftools.
 *
 * @param {string} key - The key.
 * @param {*} value - An optional value.
 * @returns {string} The -key or -key=value CLI arg.
 */
function cliArg(key, value) {
  return value === undefined ? `-${key}` : `-${key}=${value}`;
}

/**
 * Get the exiftool arguments needed to reference this software.
 *
 * @returns {Object} The command-line arguments.
 */
function getExifToolSoftwareArgs() {
  const args = [];
  args.push(cliArg('EXIF:Software', core.constants.SOFTWARE));
  args.push(cliArg('XMP:CreatorTool', core.constants.SOFTWARE));
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media, pertaining to its
 * caption.
 *
 * @param {Object} media_obj - The media object.
 * @returns {Array} - The array of command-line arguments.
 */
function getExifToolCaptionArgs(media_obj) {
  const args = [];
  if (media_obj.caption && media_obj.caption.text.length) {
    args.push(cliArg('EXIF:ImageDescription', media_obj.caption.text));
    args.push(cliArg('IPTC:Caption-Abstract', media_obj.caption.text));
    args.push(cliArg('XMP:Description', media_obj.caption.text));
  }
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media, pertaining to its
 * user metadata.
 *
 * @param {Object} media_obj - The media object.
 * @returns {Array} The array of command-line arguments.
 */
function getExifToolUserArgs(media_obj) {
  const args = [];
  const copyright = `Copyright ${media_obj.user.full_name}`;
  args.push(cliArg('EXIF:Artist', media_obj.user.full_name));
  args.push(cliArg('EXIF:Copyright', copyright));
  args.push(cliArg('IPTC:CopyrightNotice', copyright));
  args.push(cliArg('XMP:Creator', media_obj.user.full_name));
  args.push(cliArg('XMP:Rights', copyright));
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media, pertaining to its
 * tags.
 *
 * @param {Object} media_obj - The media object.
 * @returns {Array} The array of command-line arguments.
 */
function getExifToolTagArgs(media_obj) {
  const args = [];
  if (media_obj.tags.length) {
    const keywords_sep = ', ';
    const keywords = media_obj.tags.join(keywords_sep);
    args.push(cliArg('sep'));
    args.push(keywords_sep); // can't use -sep= here, for some reasons
    args.push(cliArg('IPTC:Keywords', keywords));
    args.push(cliArg('XMP:Subject', keywords));
  }
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media, pertaining to its
 * creation time.
 *
 * @param {Object} media_obj - The media object.
 * @param {Object} [options] - The options.
 * @param {boolean} [options.verbose] - Display more info.
 * @param {boolean} [options.quiet] - Display less info.
 * @returns {Array} The array of command-line arguments.
 */
function getExifToolCreatedArgs(media_obj, options) {
  const created = moment.unix(media_obj.created_time);
  if (media_obj.location) {
    // How to get a time zone from a location using latitude and longitude?
    // http://stackoverflow.com/q/16086962/250457
    const tz = tzlookup(
      media_obj.location.latitude,
      media_obj.location.longitude
      );
    created.tz(tz);
    if (options && options.verbose && !options.quiet) {
      const formatted = created.format();
      instagram.media.log(media_obj, `Timezone is ${core.logger.success(tz)}`);
      instagram.media.log(media_obj, `Creation time stored as ${core.logger.success(formatted)}`);
    }
  } else if (options && options.verbose && !options.quiet) {
    const formatted = created.local().format();
    instagram.media.log(media_obj, `No location, assume timezone ${core.logger.warn('local')}`);
    instagram.media.log(media_obj, `Creation time stored as ${core.logger.success(formatted)}`);
  }
  const created_ymd = created.format('YYYY:MM:DD');
  const created_hms = created.format('HH:mm:ssZ');
  const created_ymd_hms = `${created_ymd} ${created_hms}`;
  const args = [];
  args.push(cliArg('EXIF:DateTimeOriginal', created_ymd_hms));
  args.push(cliArg('IPTC:DateCreated', created_ymd));
  args.push(cliArg('IPTC:TimeCreated', created_hms));
  args.push(cliArg('XMP:DateCreated', created_ymd_hms));
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media, pertaining to its
 * location.
 *
 * @param {Object} media_obj - The media object.
 * @returns {Array} The array of command-line arguments.
 */
function getExifToolLocationArgs(media_obj) {
  const args = [];
  if (media_obj.location) {
    args.push(cliArg('EXIF:GPSLatitude', media_obj.location.latitude));
    const lat_ref = media_obj.location.latitude >= 0 ? 'N' : 'S';
    const long_ref = media_obj.location.longitude >= 0 ? 'E' : 'W';
    args.push(cliArg('EXIF:GPSLatitudeRef', lat_ref));
    args.push(cliArg('EXIF:GPSLongitude', media_obj.location.longitude));
    args.push(cliArg('EXIF:GPSLongitudeRef', long_ref));
  }
  return args;
}

/**
 * Get the exiftool arguments needed to update a media's metadata.
 *
 * @param {Object} media_obj - The media object.
 * @param {Object} [options] - The options.
 * @returns {Array} The array of command-line arguments.
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
 * Update (asynchronously) a file's metadata given its filename and a media object containing the
 * metadata information to store as EXIF fields. This requires exiftool to be installed.
 *
 * @param {Object} media_obj - The media object.
 * @param {string} filename - The name of the file to update metadata for.
 * @param {Object} [options] - The options.
 * @param {boolean} [options.quiet] - Display less info.
 * @returns {Promise} The promise resolving on update, or rejecting.
 */
function updateFileMetadata(media_obj, filename, options) {
  return new Promise((resolve, reject) => {
    const basename = path.basename(filename);
    if (media_obj.type !== 'image') {
      resolve(false);
      return;
    }
    const args = getExifToolArgs(media_obj, options);
    args.push(filename);
    // core.logger.log(args); return;

    const exiftool = child_process.spawn('exiftool', args);
    let error_message = '';

    exiftool.stderr.on('data', (data) => {
      error_message += data.toString();
    });

    exiftool.on('error', (err) => {
      reject(new core.logger.Error(`Can not spawn exiftool (${err.message})`));
    });

    exiftool.on('close', () => {
      if (error_message) {
        reject(new core.logger.Error(error_message));
      } else {
        if (!options || !options.quiet) {
          instagram.media.log(media_obj, `Updated metadata in ${core.logger.success(basename)}`);
        }
        resolve(true);
      }
    });
  });
}

/**
 * Get the URL to the highest resolution for a given media.
 *
 * @see {@link http://stackoverflow.com/q/31302811/250457} for more.
 *
 * @param {Object} media_obj - The media object.
 * @returns {string|boolean} The URL or false if not found.
 */
function getUrlToHighestResolution(media_obj) {
  // const url = media_obj.images.low_resolution.url.split('/');
  // console.log(url.slice(0, 5).concat(url.slice(6)).join('/'));
  if (media_obj.videos) {
    return media_obj.videos.standard_resolution.url;
  }
  return media_obj.images
    ? media_obj.images.low_resolution.url.replace(/[ps]320x320\//, '')
    : false;
}

/**
 * Get the URL to a resolution for a given media.
 *
 * @param {Object} media_obj - The media object.
 * @param {string} [resolution] - The resolution; omit to request highest res.
 * @returns {string|boolean} The URL or false if not found.
 */
function getUrlToResolution(media_obj, resolution) {
  if (resolution === instagram.constants.RESOLUTIONS.high || resolution === undefined) {
    return getUrlToHighestResolution(media_obj);
  }
  const urls = media_obj.videos ? media_obj.videos : media_obj.images;
  if (urls[resolution]) {
    return urls[resolution].url;
  }
  return false;
}

/**
 * Get basename for media at resolution.
 *
 * @param {Object} media_obj - The media object.
 * @param {string} [resolution] - The resolution; omit to request highest res.
 * @returns {string} The basename.
 */
function getMediaBasenameForResolution(media_obj, resolution) {
  const name = instagram.media.createMediaFileName(media_obj);
  const suffix = media_obj.type === 'image' && resolution !== undefined ? `-${resolution}` : '';
  const ext = media_obj.type === 'image' ? '.jpg' : '.mp4';
  return `${name}${suffix}${ext}`;
}

/**
 * Fetch a media (asynchronously).
 *
 * @param {Object} media_obj - The media object.
 * @param {string} [resolution] - The resolution; omit to request highest res.
 * @param {Object} [options] - The options.
 * @param {string} [options.dest] - The destination directory.
 * @param {boolean} [options.alwaysDownload] - Always download, even if on disk already.
 * @param {boolean} [options.quiet] - Output less info.
 * @returns {Promise} The promise resolving w/ filename once fetched, or rejecting.
 */
function fetchMedia(media_obj, resolution, options) {
  return new Promise((resolve, reject) => {
    const url = getUrlToResolution(media_obj, resolution);
    if (url === false) {
      reject(new core.logger.Error(`Can not find resolution: ${resolution}`));
      return;
    }
    const basename = getMediaBasenameForResolution(media_obj, resolution);
    const dest = options && options.dest ? options.dest : './';
    const filename = path.join(dest, basename);
    fs.lstat(filename, (lstat_err, stats) => {
      // Do not re-download if the file already exists
      if (!lstat_err &&
          stats.isFile() &&
          (!options || !options.alwaysDownload)) {
        if (!options || !options.quiet) {
          instagram.media.log(media_obj, `Saved already as ${core.logger.success(basename)}`);
        }
        resolve(filename);
      } else {
        new Download()
        .get(url)
        .dest(dest)
        .rename(basename)
        .run((download_err, files) => {
          if (download_err) {
            reject(download_err);
          } else {
            if (!options || !options.quiet) {
              const file_basename = path.basename(files[0].path);
              instagram.media.log(media_obj, `Fetched ${core.logger.success(file_basename)}`);
            }
            resolve(files[0].path);
          }
        });
      }
    });
  });
}

/**
 * Get basename for media object.
 *
 * @param {Object} media_obj - The media object.
 * @returns {string} The basename.
 */
function getMediaObjectBasename(media_obj) {
  return `${instagram.media.createMediaFileName(media_obj)}.json`;
}

/**
 * Save a media description (asynchronously).
 *
 * @param {Object} media_obj - The media object.
 * @param {Object} [options] - The options.
 * @param {string[]} [options.json] - The specific keys to extract from media_obj, all otherwise.
 * @param {string} [options.dest] - The destination directory.
 * @param {boolean} [options.quiet] - Output less info.
 * @returns {Promise} The promise resolving w/ filename once saved, or rejecting.
 */
function saveMediaObject(media_obj, options) {
  return new Promise((resolve, reject) => {
    const basename = getMediaObjectBasename(media_obj);
    const keys = options.json && options.json.constructor === Array ? options.json : null;
    const dest = options.dest || './';
    mkdirp(dest, (mkdirp_err) => {
      if (mkdirp_err) {
        reject(mkdirp_err);
      } else {
        const filename = path.join(dest, basename);
        let media_to_save = media_obj;
        if (keys !== null) {
          const filtered_media = {};
          keys.forEach((key) => {
            const value = get(media_obj, key);
            if (value !== undefined) {
              set(filtered_media, key, value);
            }
          });
          media_to_save = filtered_media;
        }
        const stringified = JSON.stringify(media_to_save, null, 2);
        fs.writeFile(filename, stringified, (err) => {
          if (err) {
            reject(err);
          } else {
            if (!options || !options.quiet) {
              instagram.media.log(media_obj, `Saved ${core.logger.success(basename)}`);
            }
            resolve(filename);
          }
        });
      }
    });
  });
}

/**
 * Resolve options. Check if a user was passed, resolve user name to id if needed, resolve
 * timestamps, resolve media URL to media id, etc.
 *
 * @param {Object} options - The options to resolve.
 * @returns {Promise} The promise resolving with resolved options, or rejecting.
 */
function resolveOptions(options) {
  const resolved_options = assign({}, options);
  if (!resolved_options.instagramUserId) {
    return Promise.reject(
      new core.logger.Error('Need Instagram user ID/name'));
  }
  instagram.client.use({
    access_token: resolved_options.instagramAccessToken,
  });
  if (typeof resolved_options.json === 'string') {
    resolved_options.json = resolved_options.json.split(',');
  }
  if (typeof resolved_options.resolution === 'string') {
    resolved_options.resolution = resolved_options.resolution.split(',');
  }
  const resolvers = Promise.all([
    instagram.user.resolveOptions(options),
    instagram.user.resolveUserId(options.instagramUserId).then((id) => {
      resolved_options.instagramUserId = id;
    }),
    instagram.media.resolveMediaId(options.minId).then((id) => {
      resolved_options.minId = id;
    }),
    instagram.media.resolveMediaId(options.maxId).then((id) => {
      resolved_options.maxId = id;
    }),
  ]);
  return resolvers.then(() => resolved_options);
}

/**
 * Run task.
 *
 * @param {Object} unresolved_options - The unresolved, query options.
 * @returns {Promise} The promise resolving with all medias when done, or rejecting.
 */
function run(unresolved_options) {
  const q = throat(os.cpus().length);
  /**
   * Process media.
   *
   * @param {Object} media_obj - The media object.
   * @param {Object} options - The options.
   * @returns {Promise} The promise resolving with all medias when done, or rejecting.
   */
  function processMedia(media_obj, options) {
    const promises = [];
    if (options.json) {
      promises.push(saveMediaObject(media_obj, options));
    }
    if (options.resolution !== false) {
      let resolutions = media_obj.type === 'image' && options.resolution
        ? options.resolution
        : [undefined]; // undefined will try to retrieve the highest res
      // De-duplicate the requested resolutions
      resolutions = values(keyBy(resolutions, getUrlToResolution.bind(this, media_obj)));
      resolutions.forEach((resolution) => {
        promises.push(
          fetchMedia(media_obj, resolution, options).then(
            filename => q(updateFileMetadata.bind(this, media_obj, filename, options))
          )
        );
      });
    }
    return Promise.all(promises).then(() => media_obj);
  }
  return resolveOptions(unresolved_options).then(options =>
    instagram.user.forEachRecentMedias(options.instagramUserId, options, processMedia)
  );
}

const options = assign(
  {},
  instagram.user.forEachRecentMediasCliOptions,
  cliOptions
);

module.exports = {
  name: 'download',
  description: 'download medias from Instagram',
  options,
  run,
};
