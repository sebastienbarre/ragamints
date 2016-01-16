'use strict';

var fetch    = require('node-fetch');
var inquirer = require('inquirer');
var Promise  = require('es6-promise').Promise;
var qs       = require('qs');

var logger   = require('../logger');

var utils    = require('./utils');

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

/**
 * Resolve Flickr User ID, i.e. fetches (asynchronously) Flickr User ID given
 * a Flickr User Name, if needed.
 *s
 * @param  {Object} options options
 * @return {Promise} resolving with Flickr user ID, or rejecting
 */
api.authenticate = function(options) {
  let request_token_url = api.getRequestTokenUrl(
    options.flickrApiKey, options.flickrApiSecret, 'oob');
  console.log(request_token_url);
  return fetch(request_token_url).then(function(response) {
    if (response.ok) {
      return response.text();
    }
    throw new logger.Error('Failed Requesting Token');
  }).then(function(text) {
    let request_token = qs.parse(text);
    let auth_url = api.getAuthorizeUrl(request_token.oauth_token, 'write');
    console.log('1) Open this URL in your web browser:');
    console.log(auth_url);
    console.log('2) Authorize the application');
    var questions = [{
      type: 'input',
      name: 'oauth_verifier',
      message: '3) Enter the code (xxx-xxx-xxx): '
    }];
    return new Promise(function(resolve, reject) {
      inquirer.prompt(questions, function(answers) {
        let oauth_verifier = answers.oauth_verifier.trim();
        if (!oauth_verifier.length) {
          reject(new logger.Error('Failed, code is empty'));
          return;
        }
        let access_token_url = api.getAccessTokenUrl(
          options.flickrApiKey, options.flickrApiSecret,
          request_token.oauth_token, request_token.oauth_token_secret,
          answers.oauth_verifier);
        console.log(access_token_url);
        fetch(access_token_url).then(function(response) {
          if (response.ok) {
            return response.text();
          }
          throw new logger.Error('Failed Accessing Token');
        }).then(function(text) {
          let access_token = qs.parse(text);
          console.log(access_token);
          resolve(access_token);
        });
      });
    });
  });
};

module.exports = api;
