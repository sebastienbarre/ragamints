#!/usr/bin/env node
'use strict';

var chalk         = require('chalk');
var child_process = require('child_process');
var Download      = require('download');
var extend        = require('util')._extend;
var fetch         = require('node-fetch');
var fs            = require('fs');
var ig            = require('instagram-node').instagram();
var mkdirp        = require('mkdirp');
var moment        = require('moment-timezone');
var path          = require('path');
var program       = require('commander');
var Promise       = require('es6-promise').Promise;
var suspend       = require('suspend');
var tzlookup      = require('tz-lookup');

require('sugar'); // Date.create()

fetch.Promise = Promise;

const warn    = chalk.yellow;
const notice  = chalk.cyan;
const success = chalk.green;

const SOFTWARE = 'ragamints';
const ERROR_PREFIX = SOFTWARE + ':';
const ACCESS_TOKEN_ENV_VAR = 'RAGAMINTS_ACCESS_TOKEN';

/*
 * Given a media object, fields of interest:
 *   caption.text                   ('Back home!')
 *   created_time                   (1430734958)
 *   id                             (977399508246039160)
 *   images.[resolution].url        (url to image or video cover file, .jpg)
 *   videos.[resolution].url        (url to video file, .mp4)
 *   link                           (https://instagram.com/p/2Qams1JYsp/)
 *   likes.count                    (15)
 *   location.latitude              (58.298348257)
 *   location.longitude             (-134.403743603)
 *   tags                           ([ 'osaka' ])
 *   type                           ('image')
 *   user.full_name                 ('Sebastien B.')
 */

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

/**
 * Log message with respect to a specific media.
 * This just calls console.log with a prefix uniquely identifying the media.
 *
 * @param {object} media Media object
 * @param {String} msg Message to log
 */
function logForMedia(media, msg) {
  let excerpt_max_len = 18;
  let id = media.id.substr(0, 18);
  // Let's clean up the caption -- remove all UTF8 emojis, for example.
  let regexp = /[\u007F-\uFFFF]/g;
  let caption = media.caption
    ? media.caption.text.replace(regexp, '').substr(0, excerpt_max_len)
    : null;
  let excerpt = padRight(caption || id, ' ', excerpt_max_len);
  let index = '#' + padLeftZero((media.fetch_index || 0) + 1, 4);
  console.log(notice(`${index} [${excerpt}]`), (msg ? msg : ''));
}

/**
 * Convert a key or key=value parameter into a CLI args suitable for exiftools.
 *
 * @param {string} key Key
 * @param {mixed} value Optional value
 * @return {string} -key or -key=value CLI arg
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
  args.push(cliArg('EXIF:Software', SOFTWARE));
  args.push(cliArg('XMP:CreatorTool', SOFTWARE));
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media,
 * pertaining to its caption.
 *
 * @param {object} media Media object
 * @return {Array} array of command-line arguments
 */
function getExifToolCaptionArgs(media) {
  let args = [];
  if (media.caption && media.caption.text.length) {
    args.push(cliArg('EXIF:ImageDescription', media.caption.text));
    args.push(cliArg('IPTC:Caption-Abstract', media.caption.text));
    args.push(cliArg('XMP:Description', media.caption.text));
  }
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media,
 * pertaining to its user.
 *
 * @param {object} media Media object
 * @return {Array} array of command-line arguments
 */
function getExifToolUserArgs(media) {
  let args = [];
  if (media.user.full_name.length) {
    let copyright = 'Copyright ' + media.user.full_name;
    args.push(cliArg('EXIF:Artist', media.user.full_name));
    args.push(cliArg('EXIF:Copyright', copyright));
    args.push(cliArg('IPTC:CopyrightNotice', copyright));
    args.push(cliArg('XMP:Creator', media.user.full_name));
    args.push(cliArg('XMP:Rights', copyright));
  }
  return args;
}

/**
 * Get the exiftool arguments needed to update the metadata for a given media,
 * pertaining to its tags.
 *
 * @param {object} media Media object
 * @return {Array} array of command-line arguments
 */
function getExifToolTagArgs(media) {
  let args = [];
  if (media.tags.length) {
    let keywords_sep = ', ';
    let keywords = media.tags.join(keywords_sep);
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
 * @param {object} media Media object
 * @param {object} options Get options
 * @return {Array} array of command-line arguments
 */
function getExifToolCreatedArgs(media, options) {
  let created = moment.unix(media.created_time);
  if (media.location) {
    // How to get a time zone from a location using latitude and longitude?
    // http://stackoverflow.com/q/16086962/250457
    let tz = tzlookup(media.location.latitude, media.location.longitude);
    created.tz(tz);
    if (options.verbose && !options.quiet) {
      let formatted = created.format();
      logForMedia(media, 'Timezone is ' + success(tz));
      logForMedia(media, 'Creation time stored as ' + success(formatted));
    }
  } else {
    if (options.verbose && !options.quiet) {
      let formatted = created.local().format();
      logForMedia(media, 'No location, assume timezone is ' + warn('local'));
      logForMedia(media, 'Creation time stored as ' + success(formatted));
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
 * @param {object} media Media object
 * @return {Array} array of command-line arguments
 */
function getExifToolLocationArgs(media) {
  let args = [];
  if (media.location) {
    args.push(cliArg('EXIF:GPSLatitude', media.location.latitude));
    let lat_ref = media.location.latitude >= 0 ? 'N' : 'S';
    let long_ref = media.location.longitude >= 0 ? 'E' : 'W';
    args.push(cliArg('EXIF:GPSLatitudeRef', lat_ref));
    args.push(cliArg('EXIF:GPSLongitude', media.location.longitude));
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
 * @param {object} media Media object
 * @param {object} options Get options
 * @return {Array} array of command-line arguments
 */
function getExifToolArgs(media, options) {
  let args = [];
  args.push(cliArg('q')); // hide informational messages
  args.push(cliArg('q')); // hide minor warnings (IPTC:Caption-Abstract...)
  args.push(cliArg('codedcharacterset', 'utf8'));
  args.push(cliArg('overwrite_original'));
  args = args.concat(
    getExifToolSoftwareArgs(),
    getExifToolCaptionArgs(media),
    getExifToolUserArgs(media),
    getExifToolTagArgs(media),
    getExifToolCreatedArgs(media, options),
    getExifToolLocationArgs(media)
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
 * @param {object} media Media object
 * @param {String} filename Name of file to update metadata for
 * @param {object} options Update options
 * @return {Promise} resolving on update, or rejecting
 */
function updateFileMetadata(media, filename, options) {
  return new Promise(function(resolve, reject) {
    let basename = path.basename(filename);
    if (media.type !== 'image') {
      resolve(false);
      return;
    }
    let args = getExifToolArgs(media, options);
    args.push(filename);
    // console.log(args); return;

    let exiftool = child_process.spawn('exiftool', args);
    let error_message = '';

    exiftool.stderr.on('data', function(data) {
      error_message += data.toString();
    });

    exiftool.on('error', function(err) {
      reject(new Error(
        `${ERROR_PREFIX} Could not spawn exiftool (${err.message})`));
    });

    exiftool.on('close', function() {
      if (error_message) {
        reject(new Error(`${ERROR_PREFIX} ${error_message}`));
      } else {
        if (!options.quiet) {
          logForMedia(media, 'Updated metadata in ' + success(basename));
        }
        resolve(true);
      }
    });
  });
}

/**
 * Create a file 'name' based on a media object. A full filename will require
 * a path/dir to be prepended and a file extension to be appended.
 *
 * @param {object} media Media object
 * @return {String} File name
 */
function createMediaFileName(media) {
  let created = moment.unix(media.created_time);
  let formatted = created.utc().format('YYYY-MM-DD');
  return `${formatted}_${media.created_time}`;
}

/**
 * Fetch a media (asynchronously)
 *
 * Supported options are:
 *   {String} dest Destination directory
 *   {Boolean} alwaysDownload Always download, even if on disk already
 *   {Boolean} quiet Output less info
 *
 * @param {object} media Media object
 * @param {String} resolution Resolution to fetch
 * @param {object} options Fetch options
 * @return {Promise} resolving w/ filename once fetched, or rejecting
 */
function fetchMedia(media, resolution, options) {
  return new Promise(function(resolve, reject) {
    let urls = media.videos ? media.videos : media.images;
    if (urls[resolution] === undefined) {
      reject(new Error(
        `${ERROR_PREFIX} Could not find resolution in media: ${resolution}`));
    } else {
      let resolution_suffix = {
        'thumbnail': '-thumbnail',
        'low_resolution': '-low',
        'standard_resolution': ''
      };
      let name = createMediaFileName(media);
      let suffix = media.type === 'image' ? resolution_suffix[resolution] : '';
      let ext = media.type === 'image' ? '.jpg' : '.mp4';
      let basename = `${name}${suffix}${ext}`;
      let dest = options.dest || './';
      let filename = path.join(dest, basename);
      fs.lstat(filename, function(lstat_err, stats) {
        // Do not re-download if the file already exists
        if (!lstat_err && stats.isFile() && !options.alwaysDownload) {
          if (!options.quiet) {
            logForMedia(media, 'Saved already as ' + success(basename));
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
                logForMedia(media, 'Fetched ' + success(file_basename));
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
 * @param {object} media Media object
 * @param {object} options Fetch options
 * @return {Promise} resolving w/ filename once saved, or rejecting
 */
function saveMediaObject(media, options) {
  return new Promise(function(resolve, reject) {
    let basename = createMediaFileName(media) + '.json';
    let dest = options.dest || './';
    mkdirp(dest, function(mkdirp_err) {
      if (mkdirp_err) {
        reject(mkdirp_err);
      } else {
        let filename = path.join(dest, basename);
        fs.writeFile(filename, JSON.stringify(media, null, 2), function(err) {
          if (err) {
            reject(err);
          } else {
            if (!options.quiet) {
              logForMedia(media, 'Saved ' + success(basename));
            }
            resolve(filename);
          }
        });
      }
    });
  });
}

/**
 * Get recent media for a user.
 * This function behaves like an iterator returning a promise, since the
 * Instagram API paginates its results. It returns a promise resolving with:
 *   {
 *     medias: {Array} array of medias
 *     next: {Promise or false}
 *   }
 * where medias is an array of medias and next is either false if there are
 * no more medias to retrieve, or a promise that will resolve identically (i.e.
 * with an object containing the next batch of medias, and a promise or false).
 *
 * Iteration can be done, for example, from a generator:
 *   suspend(function*() {
 *    let it = getRecentMedias(user_id, options);
 *    while (it) {
 *      let chunk = yield it;
 *      // do something with chunk.medias
 *      it = chunk.next;
 *    }
 *  })();
 *
 * Supported options are:
 *   {int} count Count of media to download
 *   {String} minId Fetch media later than this minId
 *   {String} maxId Fetch media later than this maxId
 *   {int} minTimestamp Fetch media after this UNIX timestamp
 *   {int} maxTimestamp Fetch media before this UNIX timestamp
 *
 * @param {String} user_id User ID
 * @param {object} options Query options
 * @return {Promise} resolving w/ {medias:, next: } once fetched, or rejecting
 */
function getRecentMedias(user_id, options) {
  let current_count = 0;
  /*eslint-disable max-params */
  let handler = function handler(resolve, reject, err, medias, pagination) {
    if (err) {
      reject(err);
      return;
    }
    // Assign an extra, custom fetch_index key to our media, not part of
    // Instagram API but useful for logging.
    medias.forEach(function(media, index) {
      media.fetch_index = current_count + index;
    });
    current_count += medias.length;
    let next = false;
    // If we have more data to fetch, return a promise to get the next batch
    if (pagination.next &&
        (!options.count || (options.count && current_count < options.count))) {
      next = new Promise(function(next_resolve, next_reject) {
        pagination.next(handler.bind(null, next_resolve, next_reject));
      });
    } else if (options.count && current_count > options.count) {
      let pos = options.count - current_count;
      medias.splice(pos, -pos);
    }
    let another = current_count > medias.length ? 'another ' : '';
    let media_count = success(medias.length) + ' media(s)';
    let more = next ? ', more to come...' : ', nothing more.';
    console.log(`Found ${another}${media_count}${more}`);
    resolve({medias: medias, next: next});
  };
  /*eslint-enable max-params */
  // Get the promise to return the first batch
  return new Promise(function(resolve, reject) {
    ig.user_media_recent(
      user_id, {
        count: options.count || 1000,
        min_id: options.minId,
        max_id: options.maxId,
        min_timestamp: options.minTimestamp,
        max_timestamp: options.maxTimestamp
      },
      handler.bind(null, resolve, reject)
    );
  });
}

/**
 * Check if id is a valid Instagram User ID.
 *
 * @param {String} id Instagram User ID
 * @return {Boolean} true if valid
 */
function isUserId(id) {
  return /^[0-9]+$/.test(id);
}

/**
 * Resolve a User ID, i.e. fetches (asynchronously) a User ID given a User
 * Name, if needed.
 *
 * @param  {String} user_id User ID or User Name
 * @return {Promise} resolving with a user ID, or rejecting
 */
function resolveUserId(user_id) {
  return new Promise(function(resolve, reject) {
    if (isUserId(user_id)) {
      resolve(user_id);
      return;
    }
    ig.user_search(
      user_id, {
        count: 1
      }, function(err, users) {
        if (err) {
          reject(err);
        } else if (!users.length) {
          reject(new Error(
            `${ERROR_PREFIX} Could not find user ID for: ${user_id}`));
        } else {
          console.log('Found user ID:', success(users[0].id), 'for username:',
            notice(user_id));
          resolve(users[0].id);
        }
      });
  });
}

/**
 * Check if id is a valid Instagram Media ID.
 *
 * @param {String} id Instagram Media ID
 * @return {Boolean} true if valid
 */
function isMediaId(id) {
  return /^[0-9_]+$/.test(id);
}

/**
 * Check if id is a valid Instagram Media ID.
 *
 * @param {String} id Instagram Media ID
 * @return {Boolean} true if valid
 */
function isMediaUrl(url) {
  return /^https?:\/\/instagram.com\/p\/[A-Za-z0-9\-]+\/.*$/.test(url);
}

/**
 * Check if timestamp is a valid Unix Timestamp.
 *
 * @param {int} timestamp Unix timestamp
 * @return {Boolean} true if valid
 */
function isUnixTimestamp(timestamp) {
  return /^[0-9]+$/.test(timestamp);
}

/**
 * Resolve a Media ID, i.e. fetches (asynchronously) a Media ID given a Media
 * Url, if needed.
 *
 * @param  {String} media_id Media ID or Media Name
 * @return {Promise} resolving with a media ID, or rejecting
 */
function resolveMediaId(media_id) {
  if (isMediaId(media_id) || media_id === undefined) {
    return Promise.resolve(media_id);
  }
  let media_url_prefix = 'http://instagram.com/p/';
  var media_url = isMediaUrl(media_id)
    ? media_id
    : `${media_url_prefix}${media_id}/`;
  let endpoint = 'http://api.instagram.com/oembed?callback=&url=' + media_url;
  return fetch(endpoint).then(function(response) {
    if (response.ok) {
      return response.json();
    }
    throw new Error(
      `${ERROR_PREFIX} Could not retrieve Media Id for: ${media_url}`);
  }).then(function(json) {
    console.log('Found media ID:', success(json.media_id), 'for media url:',
      notice(media_url));
    return json.media_id;
  });
}

/**
 * Resolve options, i.e. fetches (asynchronously) all options that need
 * resolving through the Instagram API (user id from user name for example).
 *
 * @param  {object} options Options to resolve
 * @return {Promise} resolving with resolved options, or rejecting
 */
function resolveOptions(options) {
  let resolved_options = extend({}, options);
  if (resolved_options.accessToken === undefined) {
    if (process.env[ACCESS_TOKEN_ENV_VAR]) {
      resolved_options.accessToken = process.env[ACCESS_TOKEN_ENV_VAR];
      console.log('Using', success(ACCESS_TOKEN_ENV_VAR),
        'environment variable to set Instagram Access Token');
    } else {
      return Promise.reject(new Error(`${ERROR_PREFIX} Need access token`));
    }
  }
  ig.use({
    access_token: resolved_options.accessToken
  });
  if (!resolved_options.userId) {
    return Promise.reject(new Error(`${ERROR_PREFIX} Need user`));
  }
  let timestamps = {
    minTimestamp: 'Min Timestamp',
    maxTimestamp: 'Max Timestamp'
  };
  for (let timestamp in timestamps) {
    if (options[timestamp]) {
      resolved_options[timestamp] = isUnixTimestamp(options[timestamp])
        ? options[timestamp]
        : Math.floor(Date.create(options[timestamp]).getTime() / 1000);
      console.log(timestamps[timestamp] + ':', notice(options[timestamp]),
        'is', success(moment.unix(resolved_options[timestamp]).format()),
        '(Unix:', resolved_options[timestamp] + ')');
    }
  }
  return Promise.all([
    resolveUserId(options.userId),
    resolveMediaId(options.minId),
    resolveMediaId(options.maxId)
    ]).then(function(values) {
      resolved_options.userId = values[0];
      resolved_options.minId = values[1];
      resolved_options.maxId = values[2];
      return resolved_options;
    });
}

/**
 * Query Instagram and process (i.e., let's go), asynchronous version
 *
 * Supported options are:
 *   {String} userId User Id
 *
 * @param {object} options Query options
 * @return {Promise} resolving with all medias when done, or rejecting
  */
function query(unresolved_options) {
  return new Promise(function(resolve, reject) {
    suspend(function*() {
      try {
        let options = yield resolveOptions(unresolved_options);
        let all_medias = [];
        let it = getRecentMedias(options.userId, options);
        // Note that we still need to catch errors in catch() below
        // because errors are only bubbling up to the try {} catch from a
        // yield'ed promise inside the generator.
        if (options.sequential) {
          let all_promises = Promise.resolve();
          while (it) {
            let chunk = yield it;
            // In sequential mode, let's iterate over the newly retrieved
            // medias and *chain* the corresponding promises to our original
            // promise. This ensures everything is done in order (but slower).
            chunk.medias.forEach(function(media) {
              if (media.type === 'video' && !options.includeVideos) {
                return;
              }
              all_medias.push(media);
              let resolutions = media.type === 'image'
                ? options.resolution : ['standard_resolution'];
              resolutions.forEach(function(resolution) {
                all_promises = all_promises.then(function() {
                  return fetchMedia(media, resolution, options);
                }).then(function(filename) {
                  return updateFileMetadata(media, filename, options);
                }).catch(function(err) {
                  throw err;
                });
              });
              if (options.json) {
                all_promises = all_promises.then(function() {
                  return saveMediaObject(media, options);
                }).catch(function(err) {
                  throw err;
                });
              }
            });
            it = chunk.next;
          }
          // Make sure everything has completed. In sequential mode, we only
          // have one promise chain to deal with, yield it.
          yield all_promises;
        } else {
          let all_promises = [];
          while (it) {
            let chunk = yield it;
            // In parallel mode, let's iterate over the newly retrieved
            // medias and *collect* the corresponding promises, which will
            // start fetching and updating right away.
            let chunk_promises = [];
            chunk.medias.forEach(function(media) {
              if (media.type === 'video' && !options.includeVideos) {
                return;
              }
              all_medias.push(media);
              let resolutions = media.type === 'image'
                ? options.resolution : ['standard_resolution'];
              resolutions.forEach(function(resolution) {
                let fp = fetchMedia(
                  media, resolution, options
                ).then(function(filename) {
                  return updateFileMetadata(media, filename, options);
                }).catch(function(err) {
                  throw err;
                });
                chunk_promises.push(fp);
              });
              if (options.json) {
                let sp = saveMediaObject(media, options).catch(function(err) {
                  throw err;
                });
                chunk_promises.push(sp);
              }
            });
            all_promises = all_promises.concat(chunk_promises);
            it = chunk.next;
          }
          // Make sure everything has completed. In parallel mode we have an
          // array of promises, hence Promise.all().
          yield Promise.all(all_promises);
        }
        console.log('Done processing', success(all_medias.length),
          'media(s). Easy peasy.');
        resolve(all_medias);
      }
      catch (err) {
        reject(err);
      }
    })();
  });
}

/**
 * Main. Parses CLI args
 *
 * @param {argv} command-line arguments
 * @return {Promise} resolving when done, or rejecting
 */
function main(argv) {
  function program_list(val) {
    return val.split(',');
  }
  program.option(
    '-t, --access-token <token>',
    'Instagram Access Token'
  ).option(
    '-u, --user-id <id|name>',
    'Instagram User ID, or User Name'
  ).option(
    '-c, --count <count>',
    'Maximum count of media to download',
    parseInt
  ).option(
    '-m, --min-id <id|url>',
    'Fetch media later than this min_id (included)'
  ).option(
    '-n, --max-id <id|url>',
    'Fetch media earlier than this max_id (excluded)'
  ).option(
    '-o, --min-timestamp <timestamp|string>',
    'Fetch media after this UNIX timestamp'
  ).option(
    '-p, --max-timestamp <timestamp|string>',
    'Fetch media before this UNIX timestamp'
  ).option(
    '-d, --dest [dir]',
    'Destination dir, current dir otherwise',
    './'
  ).option(
    '-a, --always-download',
    'Always download, even if media is saved already',
    false
  ).option(
    '-j, --json',
    'Save the json object describing the media',
    false
  ).option(
    '-r, --resolution <resolutions>',
    'Resolution(s) to fetch (thumbnail,low_resolution,standard_resolution)',
    program_list,
    ['standard_resolution']
  ).option(
    '-s, --sequential',
    'Process everything sequentially (slower)',
    false
  ).option(
    '-i, --include-videos',
    'Fetch videos as well (skipped by default)',
    false
  ).option(
    '-v, --verbose',
    'Output more info (timezone, creation time)',
    false
  ).option(
    '-q, --quiet',
    'Output less info',
    false
  ).on('--help', function() {
    console.log('  Check the man page or README file for more.');
  }).parse(argv);

  if (!argv.slice(2).length) {
    program.outputHelp();
    return Promise.reject();
  }
  return query(program);
}

module.exports = {
  main: main
};