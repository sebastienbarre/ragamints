'use strict';

var fetch     = require('node-fetch');
var inquirer  = require('inquirer');
var openurl   = require('openurl');
var Promise   = require('es6-promise').Promise;
var qs        = require('qs');

var app_constants = require('../constants');
var logger    = require('../logger') ;

var utils     = require('./utils');
var constants = require('./constants');

fetch.Promise = Promise;

let api = {};

/**
 * Get Request Token URL.
 *
 * @param  {String} api_key Flickr API key
 * @param  {String} api_secret Flickr API secret
 * @param  {String} callback_url URL to callback
 * @return {String} request token URL
 */
api.getRequestTokenUrl = function(api_key, api_secret, callback_url) {
  let query = {
    oauth_consumer_key: api_key,
    oauth_callback: callback_url
  };
  let query_string = utils.getQueryString(query);
  let url = 'https://www.flickr.com/services/oauth/request_token';
  let base_string = utils.getBaseString('GET', url, query_string);
  let signature = utils.createSignature(base_string, api_secret);
  return `${url}?${query_string}&oauth_signature=${signature}`;
};

/**
 * Get Authorize URL.
 *
 * @param  {String} oauth_token OAuth token
 * @param  {String} perms optional comma-separated list of perms
 * @return {String} auth URL
 */
api.getAuthorizeUrl = function(oauth_token, perms) {
  let query = {
    oauth_token: oauth_token,
    perms: perms || 'write'
  };
  return 'https://www.flickr.com/services/oauth/authorize?' +
    qs.stringify(query);
};

/**
 * Get Access Token URL.
 *
 * @param  {String} api_key Flickr API key
 * @param  {String} api_secret Flickr API secret
 * @param  {String} oauth_token OAuth Token
 * @param  {String} oauth_token_secret OAuth Token Secret
 * @param  {String} oauth_verifier OAuth verifier (code)
 * @return {String} access token URL
 */
api.getAccessTokenUrl = function( // eslint-disable-line max-params
  api_key, api_secret,
  oauth_token, oauth_token_secret,
  oauth_verifier) {
  let query = {
    oauth_consumer_key: api_key,
    oauth_verifier: oauth_verifier,
    oauth_token: oauth_token
  };
  let query_string = utils.getQueryString(query);
  let url = 'https://www.flickr.com/services/oauth/access_token';
  let base_string = utils.getBaseString('GET', url, query_string);
  let signature = utils.createSignature(
    base_string, api_secret, oauth_token_secret);
  return `${url}?${query_string}&oauth_signature=${signature}`;
};

function getConfigurationBundle(
  flickr_api_key,
  flickr_api_secret,
  access_token) {
  return {
    'flickr-api-key': flickr_api_key,
    'flickr-api-secret': flickr_api_secret,
    'flickr-oauth-token': access_token.oauth_token,
    'flickr-oauth-token-secret': access_token.oauth_token_secret,
    'flickr-user-name': access_token.username,
    'flickr-user-id': access_token.user_nsid
  };
}

function suggestUsage(config) {
  logger.log('You can now pass the following options to',
    logger.notice(app_constants.SOFTWARE), 'or store them in your',
    logger.notice(app_constants.CONFIG_FILE), 'config file:');
  logger.log(logger.notice(JSON.stringify(config, null, 2)));
  logger.log('Or you may set the following environment variables:');
  let suffix = '_ENV_VAR';
  Object.keys(config).forEach(function(p) {
    let v = p.replace('flickr-', '').replace(/-/g, '_').toUpperCase() + suffix;
    if (constants[v] && config[p]) {
      logger.log(logger.notice(`${constants[v]}="${config[p]}"`));
    }
  });
}

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *s
 * @param  {Object} options options
 * @return {Promise} resolving with Flickr user ID, or rejecting
 */
api.authenticate = function(options) {
  return new Promise(function(resolve, reject) {
    let api_url = 'https://www.flickr.com/services/api/keys/';
    logger.log('Your Flickr API Keys can be found at', logger.notice(api_url));
    let api_questions = [{
      type: 'input',
      name: 'flickr_api_key',
      message: 'Enter your Flickr API Key: ',
      default: options.flickrApiKey
    }, {
      type: 'input',
      name: 'flickr_api_secret',
      message: 'Enter your Flickr API Secret: ',
      default: options.flickrApiSecret
    }];
    inquirer.prompt(api_questions, function(api_answers) {
      let flickr_api_key = api_answers.flickr_api_key.trim();
      if (!flickr_api_key.length) {
        reject(new logger.Error('Failed, Flickr API Key is empty'));
        return;
      }
      let flickr_api_secret = api_answers.flickr_api_secret.trim();
      if (!flickr_api_secret.length) {
        reject(new logger.Error('Failed, Flickr API Secret is empty'));
        return;
      }
      let request_token_url = api.getRequestTokenUrl(
        flickr_api_key, flickr_api_secret, 'oob');
      fetch(request_token_url).then(function(response) {
        if (response.ok) {
          return response.text();
        }
        reject(new logger.Error('Failed Requesting Token'));
      }).then(function(text) {
        let request_token = qs.parse(text);
        let auth_url = api.getAuthorizeUrl(request_token.oauth_token, 'write');
        openurl.open(auth_url);
        logger.log('I opened the below URL in your web browser:');
        logger.log(logger.notice(auth_url));
        var verifier_questions = [{
          type: 'input',
          name: 'oauth_verifier',
          message: 'Authorize the app then enter the code (xxx-xxx-xxx): '
        }];
        inquirer.prompt(verifier_questions, function(verifier_answers) {
          let oauth_verifier = verifier_answers.oauth_verifier.trim();
          if (!oauth_verifier.length) {
            reject(new logger.Error('Failed, Verifier Code is empty'));
            return;
          }
          let access_token_url = api.getAccessTokenUrl(
            flickr_api_key, flickr_api_secret,
            request_token.oauth_token, request_token.oauth_token_secret,
            verifier_answers.oauth_verifier);
          fetch(access_token_url).then(function(response) {
            if (response.ok) {
              return response.text();
            }
            reject(new logger.Error('Failed Accessing Token'));
          }).then(function(text) {
            let access_token = qs.parse(text);
            logger.log(logger.success('Success.'));
            let config = getConfigurationBundle(
              flickr_api_key, flickr_api_secret, access_token);
            suggestUsage(config);
            resolve(config);
          });
        });
      });
    });
  });
};

module.exports = api;
