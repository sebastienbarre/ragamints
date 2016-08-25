/**
 * Flickr auth module.
 * @module flickr/auth
 * @see module:flickr
 */

const fetch = require('node-fetch');
const inquirer = require('inquirer');
const openurl = require('openurl');
const Promise = require('es6-promise').Promise;
const qs = require('qs');

const core = require('../core');

const utils = require('./utils');
const constants = require('./constants');

fetch.Promise = Promise;

const api = {};

/**
 * Get Request Token URL.
 *
 * @param {string} api_key - The Flickr API key.
 * @param {string} api_secret - The Flickr API secret.
 * @param {string} callback_url - The URL to call back.
 * @returns {string} The request token URL.
 */
api.getRequestTokenUrl = (api_key, api_secret, callback_url) => {
  const query = {
    oauth_consumer_key: api_key,
    oauth_callback: callback_url,
  };
  const query_string = utils.getQueryString(query);
  const url = 'https://www.flickr.com/services/oauth/request_token';
  const base_string = utils.getBaseString('GET', url, query_string);
  const signature = utils.createSignature(base_string, api_secret);
  return `${url}?${query_string}&oauth_signature=${signature}`;
};

/**
 * Get Authorize URL.
 *
 * @param {string} oauth_token - The OAuth token.
 * @param {string} [perms] - The comma-separated list of perms.
 * @returns {string} The auth URL.
 */
api.getAuthorizeUrl = (oauth_token, perms) => {
  const query = {
    oauth_token,
    perms: perms || 'write',
  };
  return `https://www.flickr.com/services/oauth/authorize?${qs.stringify(query)}`;
};

/**
 * Get Access Token URL.
 *
 * @param {string} api_key - The Flickr API key.
 * @param {string} api_secret - The Flickr API secret.
 * @param {string} oauth_token - The OAuth Token.
 * @param {string} oauth_token_secret - The OAuth Token Secret.
 * @param {string} oauth_verifier - The OAuth verifier (code).
 * @returns {string} The access token URL.
 */
api.getAccessTokenUrl = ( // eslint-disable-line max-params
  api_key, api_secret,
  oauth_token, oauth_token_secret,
  oauth_verifier) => {
  const query = {
    oauth_consumer_key: api_key,
    oauth_verifier,
    oauth_token,
  };
  const query_string = utils.getQueryString(query);
  const url = 'https://www.flickr.com/services/oauth/access_token';
  const base_string = utils.getBaseString('GET', url, query_string);
  const signature = utils.createSignature(base_string, api_secret, oauth_token_secret);
  return `${url}?${query_string}&oauth_signature=${signature}`;
};

function getConfigurationBundle(
  flickr_api_key,
  flickr_api_secret,
  access_token) {
  return {
    [constants.CLI_OPTION_NAMES.API_KEY]: flickr_api_key,
    [constants.CLI_OPTION_NAMES.API_SECRET]: flickr_api_secret,
    [constants.CLI_OPTION_NAMES.OAUTH_TOKEN]: access_token.oauth_token,
    [constants.CLI_OPTION_NAMES.OAUTH_TOKEN_SECRET]: access_token.oauth_token_secret,
    [constants.CLI_OPTION_NAMES.USER_NAME]: access_token.username,
    [constants.CLI_OPTION_NAMES.USER_ID]: access_token.user_nsid,
  };
}

function suggestUsage(config) {
  core.logger.log('You can now pass the following options to',
    core.logger.notice(core.constants.SOFTWARE), 'or store them in your',
    core.logger.notice(core.constants.CONFIG_FILE), 'config file:');
  core.logger.log(core.logger.notice(JSON.stringify(config, null, 2)));
  core.logger.log('You may also set the following environment variables:');
  const env_mapping = {
    [constants.ENV_VARS.API_KEY]: constants.CLI_OPTION_NAMES.API_KEY,
    [constants.ENV_VARS.API_SECRET]: constants.CLI_OPTION_NAMES.API_SECRET,
    [constants.ENV_VARS.OAUTH_TOKEN]: constants.CLI_OPTION_NAMES.OAUTH_TOKEN,
    [constants.ENV_VARS.OAUTH_TOKEN_SECRET]:
      constants.CLI_OPTION_NAMES.OAUTH_TOKEN_SECRET,
    [constants.ENV_VARS.USER_NAME]: constants.CLI_OPTION_NAMES.USER_NAME,
    [constants.ENV_VARS.USER_ID]: constants.CLI_OPTION_NAMES.USER_ID,
  };
  Object.keys(env_mapping).forEach((p) => {
    core.logger.log(core.logger.notice(`${p}="${config[env_mapping[p]]}"`));
  });
}

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *
 * @param {Object} options - The options.
 * @returns {Promise} The promise resolving with Flickr user ID, or rejecting.
 */
api.authenticate = options => new Promise((resolve, reject) => {
  const api_url = 'https://www.flickr.com/services/api/keys/';
  core.logger.log('Your Flickr API Keys can be found at', core.logger.notice(api_url));
  const api_questions = [{
    type: 'input',
    name: 'flickr_api_key',
    message: 'Enter your Flickr API Key: ',
    default: options.flickrApiKey,
  }, {
    type: 'input',
    name: 'flickr_api_secret',
    message: 'Enter your Flickr API Secret: ',
    default: options.flickrApiSecret,
  }];
  inquirer.prompt(api_questions, (api_answers) => {
    const flickr_api_key = api_answers.flickr_api_key.trim();
    if (!flickr_api_key.length) {
      reject(new core.logger.Error('Failed, Flickr API Key is empty'));
      return;
    }
    const flickr_api_secret = api_answers.flickr_api_secret.trim();
    if (!flickr_api_secret.length) {
      reject(new core.logger.Error('Failed, Flickr API Secret is empty'));
      return;
    }
    const request_token_url = api.getRequestTokenUrl(flickr_api_key, flickr_api_secret, 'oob');
    fetch(request_token_url).then((response) => {
      if (response.ok) {
        return response.text();
      }
      reject(new core.logger.Error('Failed Requesting Token'));
      return false;
    }).then((request_token_text) => {
      const request_token = qs.parse(request_token_text);
      const auth_url = api.getAuthorizeUrl(request_token.oauth_token, 'write');
      openurl.open(auth_url);
      core.logger.log('I opened the below URL in your web browser:');
      core.logger.log(core.logger.notice(auth_url));
      const verifier_questions = [{
        type: 'input',
        name: 'oauth_verifier',
        message: 'Authorize the app then enter the code (xxx-xxx-xxx): ',
      }];
      inquirer.prompt(verifier_questions, (verifier_answers) => {
        const oauth_verifier = verifier_answers.oauth_verifier.trim();
        if (!oauth_verifier.length) {
          reject(new core.logger.Error('Failed, Verifier Code is empty'));
          return;
        }
        const access_token_url = api.getAccessTokenUrl(
          flickr_api_key, flickr_api_secret,
          request_token.oauth_token, request_token.oauth_token_secret,
          verifier_answers.oauth_verifier);
        fetch(access_token_url).then((response) => {
          if (response.ok) {
            return response.text();
          }
          reject(new core.logger.Error('Failed Accessing Token'));
          return false;
        }).then((access_token_text) => {
          const access_token = qs.parse(access_token_text);
          core.logger.log(core.logger.success('Success.'));
          const config = getConfigurationBundle(flickr_api_key, flickr_api_secret, access_token);
          suggestUsage(config);
          resolve(config);
        });
      });
    });
  });
});

module.exports = api;
