'use strict';

var core = require('../core');

const RESOLUTIONS = {
  high: 'high_resolution',
  standard: 'standard_resolution',
  low: 'low_resolution',
  thumbnail: 'thumbnail'
};

const CACHE_TTL = {
  oembed: 2 * core.cache.TTL.day,
  user_search: core.cache.TTL.week,
  user_media_recent: 10 * core.cache.TTL.minute
};

const PAGE_SIZE = {
  user_media_recent: 33
};

module.exports = {
  ACCESS_TOKEN_ENV_VAR: 'RAGAMINTS_INSTAGRAM_ACCESS_TOKEN',
  USER_ID_ENV_VAR: 'RAGAMINTS_INSTAGRAM_USER_ID',
  ACCESS_TOKEN_CLI_OPTION: 'instagram-access-token',
  USER_ID_CLI_OPTION: 'instagram-user-id',
  RESOLUTIONS: RESOLUTIONS,
  CACHE_TTL: CACHE_TTL,
  PAGE_SIZE: PAGE_SIZE
};
