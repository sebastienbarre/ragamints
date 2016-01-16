'use strict';

var cache = require('../cache');

const RESOLUTIONS = {
  high: 'high_resolution',
  standard: 'standard_resolution',
  low: 'low_resolution',
  thumbnail: 'thumbnail'
};

const CACHE_TTL = {
  oembed: 2 * cache.TTL.day,
  user_search: cache.TTL.week,
  user_media_recent: 10 * cache.TTL.minute
};

const PAGE_SIZE = {
  user_media_recent: 33
};

module.exports = {
  ACCESS_TOKEN_ENV_VAR: 'RAGAMINTS_INSTAGRAM_ACCESS_TOKEN',
  RESOLUTIONS: RESOLUTIONS,
  CACHE_TTL: CACHE_TTL,
  PAGE_SIZE: PAGE_SIZE
};
