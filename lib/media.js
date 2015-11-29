'use strict';

var moment    = require('moment-timezone');
var Promise   = require('es6-promise').Promise;

var instagram = require('./instagram');
var logger    = require('./logger');
var utils     = require('./utils');

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
 * Check if url is a valid Instagram Media URL.
 *
 * @param {String} url Instagram Media URL
 * @return {Boolean|String} false if not valid, canonical URL form otherwise
 */
function isMediaUrl(url) {
  let r = /^https?:\/\/(?:www\.)?(instagram.com\/p\/[A-Za-z0-9\-]+)\/?.*$/;
  let matches = r.exec(url);
  return matches === null ? false : `https://${matches[1]}/`;
}

/**
 * Resolve a Media ID, i.e. fetches (asynchronously) a Media ID given a Media
 * Url, if needed.
 *
 * @param  {String} media_id_or_url Media ID or Media URL
 * @return {Promise} resolving with a media_obj ID, or rejecting
 */
function resolveMediaId(media_id_or_url) {
  if (isMediaId(media_id_or_url) || media_id_or_url === undefined) {
    return Promise.resolve(media_id_or_url);
  }
  let media_url = isMediaUrl(media_id_or_url);
  if (media_url === false) {
    return Promise.reject(new logger.Error(
      media_id_or_url + ' is not a valid Instagram media url'));
  }
  return instagram.oembed(media_url).then(function(oembed) {
    logger.log('Found media ID', logger.success(oembed.media_id),
      'for media url', logger.notice(media_id_or_url));
    return oembed.media_id;
  });
}

/**
 * Create a file 'name' based on a media object. A full filename will require
 * a path/dir to be prepended and a file extension to be appended.
 *
 * @param {Object} media_obj Media object
 * @return {String} File name
 */
function createMediaFileName(media_obj) {
  let created = moment.unix(media_obj.created_time);
  let formatted = created.utc().format('YYYY-MM-DD');
  return `${formatted}_${media_obj.created_time}`;
}

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
 * Log message with respect to a specific media.
 *
 * @param {Object} media_obj Media object
 * @param {String} msg Message to log
 * @return {void}
 */
function log(media_obj, msg) {
  let excerpt_max_len = 18;
  let id = media_obj.id.substr(0, 18);
  // Let's clean up the caption -- remove all UTF8 emojis, for example.
  let regexp = /[\n\u007F-\uFFFF]/g;
  let caption = media_obj.caption
    ? media_obj.caption.text.replace(regexp, '').substr(0, excerpt_max_len)
    : null;
  let excerpt = utils.padRight(caption || id, ' ', excerpt_max_len);
  logger.log(logger.notice(`[${excerpt}]`), msg ? msg : '');
}

module.exports = {
  createMediaFileName: createMediaFileName,
  resolveMediaId: resolveMediaId,
  log: log
};
