/**
 * Instagram media module.
 * @module instagram/media
 * @see module:instagram
 */

const moment = require('moment-timezone');
const Promise = require('es6-promise').Promise;

const core = require('../core');

const client = require('./client');

const api = {};

/**
 * Check if id is a valid Instagram Media ID.
 *
 * @param {string} id - The Instagram Media ID.
 * @returns {boolean} True if valid.
 */
api.isMediaId = id => /^[0-9_]+$/.test(id);

/**
 * Check if url is a valid Instagram Media URL.
 *
 * @param {string} url - The Instagram Media URL.
 * @returns {boolean|string} False if not valid, canonical URL form otherwise.
 */
api.isMediaUrl = (url) => {
  const r = /^https?:\/\/(?:www\.)?(instagram.com\/p\/[A-Za-z0-9\-]+)\/?.*$/;
  const matches = r.exec(url);
  return matches === null ? false : `https://${matches[1]}/`;
};

/**
 * Resolve a Media ID, i.e. fetches (asynchronously) a Media ID given a Media URL, if needed.
 *
 * @param {string} media_id_or_url - The Media ID or Media URL.
 * @returns {Promise} The promise resolving with a media_obj ID, or rejecting.
 */
api.resolveMediaId = (media_id_or_url) => {
  if (api.isMediaId(media_id_or_url) || media_id_or_url === undefined) {
    return Promise.resolve(media_id_or_url);
  }
  const media_url = api.isMediaUrl(media_id_or_url);
  if (media_url === false) {
    return Promise.reject(new core.logger.Error(
      `${media_id_or_url} is not a valid Instagram media url`));
  }
  return client.oembed(media_url).then((oembed) => {
    core.logger.log('Found media ID', core.logger.success(oembed.media_id),
      'for media url', core.logger.notice(media_id_or_url));
    return oembed.media_id;
  });
};

/**
 * Create a file 'name' based on a media object. A full filename will require a path/dir to be
 * prepended and a file extension to be appended.
 *
 * @param {Object} media_obj - The media object.
 * @returns {string} The file name.
 */
api.createMediaFileName = (media_obj) => {
  const created = moment.unix(media_obj.created_time);
  const formatted = created.utc().format('YYYY-MM-DD');
  return `${formatted}_${media_obj.created_time}`;
};

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
 * @param {Object} media_obj - The media object.
 * @param {string} msg - The Message to log.
 */
api.log = (media_obj, msg) => {
  const excerpt_max_len = 18;
  const id = media_obj.id.substr(0, 18);
  // Let's clean up the caption -- remove all UTF8 emojis, for example.
  const regexp = /[\n\u007F-\uFFFF]/g;
  const caption = media_obj.caption
    ? media_obj.caption.text.replace(regexp, '').substr(0, excerpt_max_len)
    : null;
  const excerpt = core.utils.padRight(caption || id, ' ', excerpt_max_len);
  core.logger.log(core.logger.notice(`[${excerpt}]`), msg || '');
};

module.exports = api;
