#!/usr/bin/env node
'use strict';

var chalk         = require('chalk');
var child_process = require('child_process');
var Download      = require('download');
var extend        = require('util')._extend;
var fetch         = require('node-fetch');
var fs            = require('fs');
var ig            = require('instagram-node').instagram();
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

/*
 * Given a media object, fields of interest:
 *   caption.text                   ('Back home!')
 *   created_time                   (1430734958)
 *   id                             (977399508246039160)
 *   images.standard_resolution.url (url to image or video cover file, .jpg)
 *   videos.standard_resolution.url (url to video file, .mp4)
 *   link                           (https://instagram.com/p/2Qams1JYsp/)
 *   likes.count                    (15)
 *   location.latitude              (58.298348257)
 *   location.longitude             (-134.403743603)
 *   tags                           ([ 'osaka' ])
 *   type                           ('image')
 *   user.full_name                 ('Sebastien B.')
 */
// const fake = '[{"tags":["99","Osaka"],"type":"image","location":{"latitude":58.298348257,"name":"Port of Juneau -Alaska- USA","longitude":-134.403743603,"id":270494303},"created_time":"1430734958","link":"https://instagram.com/p/2Qams1JYsp/","images":{"low_resolution":{"url":"https://scontent.cdninstagram.com/hphotos-xat1/t51.2885-15/s306x306/e15/11193066_896012850450861_10425589_n.jpg","width":306,"height":306},"thumbnail":{"url":"https://scontent.cdninstagram.com/hphotos-xat1/t51.2885-15/s150x150/e15/11193066_896012850450861_10425589_n.jpg","width":150,"height":150},"standard_resolution":{"url":"https://scontent.cdninstagram.com/hphotos-xat1/t51.2885-15/e15/11193066_896012850450861_10425589_n.jpg","width":640,"height":640}},"caption":{"created_time":"1430734958","text":"Back home. Done spamming your Insta with Japan. Now go check it out, it\'s beautiful and fun. 🇯🇵🇺🇸 #99"},"id":"977398127825095465_26667401","user":{"username":"sebastienbarre","full_name":"Sébastien B"}}]';

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
  let caption = media.caption ? media.caption.text.replace(/[\u007F-\uFFFF]/g, '').substr(0, excerpt_max_len) : null;
  let excerpt = padRight(caption || id, ' ', excerpt_max_len);
  let index = '#' + padLeftZero((media.fetch_index || 0) + 1, 4);
  console.log(notice(index + ' [' + excerpt + ']') + (msg ? ' ' + msg : ''));
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
  let created = moment.unix(media.created_time);
  if (media.location) {
    // How to get a time zone from a location using latitude and longitude?
    // http://stackoverflow.com/q/16086962/250457
    let tz = tzlookup(media.location.latitude, media.location.longitude);
    created.tz(tz);
    if (options.verbose && !options.quiet) {
      logForMedia(media, 'Found in ' + success(tz) + ' timezone');
      logForMedia(media, 'Creation time stored as ' + success(created.format()));
    }
  } else {
    if (options.verbose && !options.quiet) {
      logForMedia(media, 'No location, assume ' + warn('local') + ' timezone');
      logForMedia(media, 'Creation time stored as ' + success(created.local().format()));
    }
  }
  let created_ymd = created.format('YYYY:MM:DD');
  let created_hms = created.format('HH:mm:ssZ');
  let created_ymd_hms = created_ymd + ' ' + created_hms;

  let args = [
    '-q',  // hide informational messages
    '-q',  // hide minor warnings (IPTC:Caption-Abstract exceeds length limit)
    '-codedcharacterset=utf8',
    '-overwrite_original'
  ];

  function add_metadata(prop, value) {
    args.push('-' + prop + '=' + value);
  }

  let software = 'ragamints';
  add_metadata('EXIF:Software', software);
  add_metadata('XMP:CreatorTool', software);

  if (media.caption && media.caption.text.length) {
    add_metadata('EXIF:ImageDescription', media.caption.text);
    add_metadata('IPTC:Caption-Abstract', media.caption.text);
    add_metadata('XMP:Description', media.caption.text);
  }

  if (media.user.full_name.length) {
    let copyright = 'Copyright ' + media.user.full_name;
    add_metadata('EXIF:Artist', media.user.full_name);
    add_metadata('EXIF:Copyright', copyright);
    add_metadata('IPTC:CopyrightNotice', copyright);
    add_metadata('XMP:Creator', media.user.full_name);
    add_metadata('XMP:Rights', copyright);
  }

  if (media.tags.length) {
    let keywords_sep = ', ';
    let keywords = media.tags.join(keywords_sep);
    args.push('-sep');
    args.push(keywords_sep);
    add_metadata('IPTC:Keywords', keywords);
    add_metadata('XMP:Subject', keywords);
  }

  add_metadata('EXIF:DateTimeOriginal', created_ymd_hms);
  add_metadata('IPTC:DateCreated', created_ymd);
  add_metadata('IPTC:TimeCreated', created_hms);
  add_metadata('XMP:DateCreated', created_ymd_hms);

  if (media.location) {
    add_metadata('EXIF:GPSLatitude', media.location.latitude);
    add_metadata('EXIF:GPSLatitudeRef', media.location.latitude >= 0 ? 'N' : 'S');
    add_metadata('EXIF:GPSLongitude', media.location.longitude);
    add_metadata('EXIF:GPSLongitudeRef', media.location.longitude >= 0 ? 'E' : 'W');
  }

  return args;
}

/**
 * Update (asynchronously) the metadata on a filename given a specific media.
 * This requires exiftool to be installed.
 *
 * @param {object} media Media object
 * @param {String} filename Name of file to update metadata for
 * @param {object} options Update options
 * @return {Promise} Promise resolving on update, rejecting on error
 */
function updateMetadata(media, filename, options) {
  return new Promise(function(resolve, reject) {
    let basename = path.basename(filename);
    if (media.type !== 'image') {
      if (!options.quiet) {
        logForMedia(media, warn('Ignored non-image ' + basename));
      }
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
      reject(new Error('Could not spawn exiftool (' + err.message + ')'));
    });

    exiftool.on('close', function() {
      if (error_message) {
        reject(Error(error_message));
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
 * Get the basename of the file to save media as.
 *
 * @param {object} media Media object
 * @return {String} Basename
 */
function getFetchBasename(media) {
  let created = moment.unix(media.created_time);
  let ext = media.type === 'image' ? '.jpg' : '.mp4';
  return created.utc().format('YYYY-MM-DD') + '_' + media.created_time + ext;
}

/**
 * Fetch a media (asynchronously)
 *
 * Supported options are:
 *   {String} dest Destination directory
 *   {Boolean} alwaysDownload Always download, even if on disk already
 *
 * @param {object} media Media object
 * @param {object} options Fetch options
 * @return {Promise} Promise resolving with a filename once fetched, rejecting on error
 */
function fetchMedia(media, options) {
  return new Promise(function(resolve, reject) {
    let basename = getFetchBasename(media);
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
        let url = media.videos ? media.videos.standard_resolution.url : media.images.standard_resolution.url;
        new Download()
        .get(url)
        .dest(dest)
        .rename(basename)
        .run(function(download_err, files) {
          if (download_err) {
            reject(download_err);
          } else {
            if (!options.quiet) {
              logForMedia(media, 'Fetched ' + success(path.basename(files[0].path)));
            }
            resolve(files[0].path);
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
 * @return {Promise} Promise resolving with {medias:, next: } once fetched, rejecting on error
 */
function getRecentMedias(user_id, options) {
  let current_count = 0;
  let ig_handler = function(resolve, reject, err, medias, pagination) {
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
        pagination.next(ig_handler.bind(null, next_resolve, next_reject));
      });
    } else if (options.count && current_count > options.count) {
      medias.splice(options.count - current_count, current_count - options.count);
    }
    console.log('Found ' + (current_count > medias.length ? 'another ' : '') + success(medias.length) + ' media(s)' + (next ? ', more to come...' : ', nothing more.'));
    resolve({medias: medias, next: next});
  };
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
      ig_handler.bind(null, resolve, reject)
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
 * @return {Promise} Promise resolving with a user ID, rejecting on error
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
          reject(Error('Could not find user ID for: ' + user_id));
        } else {
          console.log('Found user ID: ' + success(users[0].id) + ' for username: ' + notice(user_id));
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
 * @return {Promise} Promise resolving with a media ID, rejecting on error
 */
function resolveMediaId(media_id) {
  if (isMediaId(media_id) || media_id === undefined) {
    return Promise.resolve(media_id);
  }
  let media_url_prefix = 'http://instagram.com/p/';
  var media_url = isMediaUrl(media_id) ? media_id : media_url_prefix + media_id + '/';
  let endpoint = 'http://api.instagram.com/oembed?callback=&url=' + media_url;
  return fetch(endpoint).then(function(response) {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Could not retrieve Media Id for: ' + media_url);
  }).then(function(json) {
    console.log('Found media ID: ' + success(json.media_id) + ' for media url: ' + notice(media_url));
    return json.media_id;
  });
}

/**
 * Resolve options, i.e. fetches (asynchronously) all options that need
 * resolving through the Instagram API (user id from user name for example).
 *
 * @param  {object} options Options to resolve
 * @return {Promise} Promise resolving with resolved options, rejecting on error
 */
function resolveOptions(options) {
  let options2 = extend({}, options);
  if (options2.accessToken === undefined) {
    if (process.env.RAGAMINTS_ACCESS_TOKEN) {
      options2.accessToken = process.env.RAGAMINTS_ACCESS_TOKEN;
      console.log('Using', success('RAGAMINTS_ACCESS_TOKEN'), 'environment variable to set Instagram Access Token');
    } else {
      return Promise.reject(Error('Need access token'));
    }
  }
  ig.use({
    access_token: options2.accessToken
  });
  if (!options2.userId) {
    return Promise.reject(Error('Need user'));
  }
  if (options.minTimestamp) {
    options2.minTimestamp = isUnixTimestamp(options.minTimestamp) ? options.minTimestamp : Math.floor(Date.create(options.minTimestamp).getTime() / 1000);
    console.log('Min Timestamp:', notice(options.minTimestamp), 'is', success(moment.unix(options2.minTimestamp).format()), '(' + options2.minTimestamp + ')');
  }
  if (options.maxTimestamp) {
    options2.maxTimestamp = isUnixTimestamp(options.maxTimestamp) ? options.maxTimestamp : Math.floor(Date.create(options.maxTimestamp).getTime() / 1000);
    console.log('Max Timestamp:', notice(options.maxTimestamp), 'is', success(moment.unix(options2.maxTimestamp).format()), '(' + options2.maxTimestamp + ')');
  }
  return Promise.all([
    resolveUserId(options.userId),
    resolveMediaId(options.minId),
    resolveMediaId(options.maxId)
    ]).then(function(resolved_options) {
      options2.userId = resolved_options[0];
      options2.minId = resolved_options[1];
      options2.maxId = resolved_options[2];
      return options2;
    });
}

/**
 * Query Instagram (i.e., let's go)
 *
 * Supported options are:
 *   {String} userId User Id
 *
 * @param {object} options Query options
 * @return {Promise} Promise resolving with all medias when done, rejecting on error
  */
function query(options) {
  return new Promise(function(resolve, reject) {
    suspend(function*() {
      try {
        options = yield resolveOptions(options);
        let all_promises = [];
        let all_medias = [];
        let it = getRecentMedias(options.userId, options);
        while (it) {
          let chunk = yield it;
          // We have a chunk of medias, let's append all the corresponding
          // promises, which will start fetching and updating right away.
          // Note that we still need to catch errors here because errors are
          // only bubbling up from a yield inside the generator, not where we
          // map our medias to promises.
          let chunk_promises = chunk.medias.map(function(media) {
            return fetchMedia(media, options).then(function(filename) {
                return updateMetadata(media, filename, options);
              }).catch(function(err) {
                reject(err);
              });
          });
          all_promises = all_promises.concat(chunk_promises);
          all_medias = all_medias.concat(chunk.medias);
          it = chunk.next;
        }
        // Make sure everything has completed
        yield Promise.all(all_promises);
        console.log('Done processing ' + success(all_promises.length) + ' media(s). Easy peasy.');
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
 * @return {Promise} Promise resolving when done, rejecting on error
 */
function main(argv) {
  program
  .option('-t, --access-token <token>', 'Instagram Access Token')
  .option('-u, --user-id <id|name>', 'Instagram User ID, or User Name')
  .option('-c, --count <count>', 'Maximum count of media to download', parseInt)
  .option('-m, --min-id <id|url>', 'Fetch media later than this min_id (included)')
  .option('-n, --max-id <id|url>', 'Fetch media earlier than this max_id (excluded)')
  .option('-o, --min-timestamp <timestamp|string>', 'Fetch media after this UNIX timestamp')
  .option('-p, --max-timestamp <timestamp|string>', 'Fetch media before this UNIX timestamp')
  .option('-d, --dest [dir]', 'Destination dir, current dir otherwise', './')
  .option('-a, --always-download', 'Always download, even if media is saved already')
  .option('-v, --verbose', 'Output more info (timezone, creation time)')
  .option('-q, --quiet', 'Output less info')
  .on('--help', function() {
    console.log('  Check the man page or README file for more.');
  })
  .parse(argv);

  if (!argv.slice(2).length) {
    program.outputHelp();
    return Promise.reject();
  }
  return query(program);
}

module.exports = {
  main: main
};
