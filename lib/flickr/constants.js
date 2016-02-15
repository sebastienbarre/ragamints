'use strict';

/**
 * Enum for environment variables.
 *
 * @constant
 * @enum {string}
 * @default
 */
const ENV_VARS = {
  API_KEY: 'RAGAMINTS_FLICKR_API_KEY',
  API_SECRET: 'RAGAMINTS_FLICKR_API_SECRET',
  OAUTH_TOKEN: 'RAGAMINTS_FLICKR_OAUTH_TOKEN',
  OAUTH_TOKEN_SECRET: 'RAGAMINTS_FLICKR_OAUTH_TOKEN_SECRET',
  USER_NAME: 'RAGAMINTS_FLICKR_USER_NAME',
  USER_ID: 'RAGAMINTS_FLICKR_USER_ID',
};

/**
 * Enum for names of CLI options.
 *
 * @constant
 * @enum {string}
 * @default
 */
const CLI_OPTION_NAMES = {
  API_KEY: 'flickr-api-key',
  API_SECRET: 'flickr-api-secret',
  OAUTH_TOKEN: 'flickr-oauth-token',
  OAUTH_TOKEN_SECRET: 'flickr-oauth-token-secret',
  USER_NAME: 'flickr-user-name',
  USER_ID: 'flickr-user-id'
};

module.exports = {
  ENV_VARS: ENV_VARS,
  CLI_OPTION_NAMES: CLI_OPTION_NAMES,
};
