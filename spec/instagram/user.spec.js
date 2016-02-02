'use strict';

var rewire     = require('rewire');
var strip_ansi = require('strip-ansi');

var helpers   = require('../support/helpers');

var constants = require('../../lib/instagram/constants');

var user      = rewire('../../lib/instagram/user.js');

describe('instagram.user', function() {
  var core = user.__get__('core');
  var client = user.__get__('client');

  var mock_user = {
    username: 'username',
    id: '12345678'
  };

  describe('instagram.user.resolveOptions', function() {
    var reverseSetProcess;

    beforeEach(function() {
      spyOn(core.logger, 'log');
      spyOn(client, 'use');
      var env = {};
      env[constants.ACCESS_TOKEN_ENV_VAR] = 'token';
      reverseSetProcess = user.__set__('process', {env: env});
    });

    afterEach(function() {
      reverseSetProcess();
    });

    it('resolves options', function(done) {
      var options = {
        verbose: true
      };
      var resolved_options = {
        verbose: true,
        instagramAccessToken: 'token'
      };
      user.resolveOptions(options).then(function(res) {
        expect(client.use).toHaveBeenCalled();
        expect(res).toEqual(resolved_options);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('rejects when no access token is found', function(done) {
      user.__set__('process', {env: {}});
      user.resolveOptions({}).then(function() {
        done.fail(new Error('should not have succeeded'));
      }, function(err) {
        expect(err.message).toEqual(
          core.logger.formatErrorMessage('Need Instagram access token'));
        done();
      });
    });
  });

  describe('instagram.user.isUserId', function() {

    it('checks if a user id is valid', function() {
      expect(user.isUserId(mock_user.id)).toBe(true);
    });

    it('checks if a user id is invalid', function() {
      expect(user.isUserId(mock_user.username)).not.toBe(true);
    });
  });

  describe('instagram.user.resolveUserId', function() {

    it('resolves a user id to itself', function(done) {
      spyOn(client, 'user_search');
      user.resolveUserId(mock_user.id).then(function(user_id) {
        expect(client.user_search).not.toHaveBeenCalled();
        expect(user_id).toEqual(mock_user.id);
        done();
      });
    });

    it('resolves a username', function(done) {
      var user_search = function(user_id, options, callback) {
        callback(null, [mock_user]);
      };
      spyOn(client, 'user_search').and.callFake(user_search);
      spyOn(core.logger, 'log');
      user.resolveUserId(mock_user.username).then(function(user_id) {
        expect(client.user_search.calls.argsFor(0)[0]).toEqual(
          mock_user.username);
        expect(core.logger.log).toHaveBeenCalled();
        expect(user_id).toEqual(mock_user.id);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('rejects on error', function(done) {
      var user_search = function(user_id, options, callback) {
        callback(Error('boom'));
      };
      spyOn(client, 'user_search').and.callFake(user_search);
      user.resolveUserId(mock_user.username).then(function(user_id) {
        done.fail(Error('Should not have found ' + user_id));
      }, function(err) {
        expect(client.user_search.calls.argsFor(0)[0]).toEqual(
          mock_user.username);
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects when no result is returned', function(done) {
      var user_search = function(user_id, options, callback) {
        callback(null, []);
      };
      spyOn(client, 'user_search').and.callFake(user_search);
      user.resolveUserId(mock_user.username).then(function(user_id) {
        done.fail(Error('Should not have found ' + user_id));
      }, function(err) {
        expect(client.user_search.calls.argsFor(0)[0]).toEqual(
          mock_user.username);
        expect(err.message).toEqual(
          core.logger.formatErrorMessage(
            'Could not find user ID for username'));
        done();
      });
    });
  });

  describe('instagram.user.getRecentMedias', function() {
    var page_size = constants.PAGE_SIZE.user_media_recent;

    // Our client.user_media_recent returns a page of empty media objects.
    var next = function(callback) {
      setTimeout(function() {
        callback(null, helpers.fillArray(page_size), {next: next});
      }, 0);
    };
    var user_media_recent = function(user_id, options, callback) {
      next(callback);
    };

    beforeEach(function() {
      spyOn(core.logger, 'log');
    });

    it('fetches recent medias, page by page', function(done) {
      spyOn(client, 'user_media_recent').and.callFake(user_media_recent);
      // Let's query more than one page, but less than two pages
      var half_page_size = Math.floor(page_size / 2);
      var count = page_size + half_page_size;
      var medias = [];
      // Unfortunately, it does not seem that suspend and generators are
      // supported by jasmine. Let's manually wait for the two promises
      // we are supposed to get, since we are querying 1 and a half pages.
      user.getRecentMedias(mock_user.id, {count: count}).then(function(page1) {
        medias = medias.concat(page1.medias);
        page1.next.then(function(page2) {
          medias = medias.concat(page2.medias);
          expect(client.user_media_recent.calls.argsFor(0)[0]).toBe(
            mock_user.id);
          expect(medias.length).toEqual(count);
          expect(strip_ansi(core.logger.log.calls.argsFor(0)[0])).toEqual(
            `Found ${page_size} media(s), more to come...`);
          expect(strip_ansi(core.logger.log.calls.argsFor(1)[0])).toEqual(
            `Found another ${half_page_size} media(s), nothing more.`);
          done();
        }, function(err) {
          done.fail(err);
        });
      }, function(err) {
        done.fail(err);
      });
    });

    it('fetches no medias without options', function(done) {
      spyOn(client, 'user_media_recent').and.callFake(user_media_recent);
      user.getRecentMedias(mock_user.id, {}).then(function(page) {
        expect(client.user_media_recent).not.toHaveBeenCalled();
        expect(page.medias).toEqual([]);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('rejects on errors', function(done) {
      // Our client.user_media_recent just returns an error
      var user_media_recent = function(user_id, options, callback) {
        callback(Error('boom'));
      };
      spyOn(client, 'user_media_recent').and.callFake(user_media_recent);
      user.getRecentMedias(mock_user.id, {count: 3}).catch(function(err) {
        expect(client.user_media_recent.calls.argsFor(0)[0]).toEqual(
          mock_user.id);
        expect(err.message).toEqual('boom');
        done();
      });
    });
  });

  describe('instagram.user.forEachRecentMedias', function() {
    var requested_count = 4;

    // This fake getRecentMedias will first return a page with 2 empty
    // medias, then a page with the rest (requested_count).
    var getRecentMedias = function() {
      var medias = helpers.fillArray(requested_count, 'index');
      medias[medias.length - 1].type = 'video';
      return Promise.resolve({
        medias: medias.slice(0, 2),
        next: Promise.resolve({
          medias: medias.slice(2),
          next: false
        })
      });
    };

    // This callback will return a promise that will resolve to the index
    // of the media it is passed, after waiting an amount of time inverse
    // to that index. It will also push that index to a side effect var.
    // The rationale here is that if the callbacks are called sequentially,
    // it won't matter how long each promise will take, they will all be
    // resolved in order. If the callbacks are called in parallel, the
    // the order will be reversed, since the first media will resolve last.
    var callbackTimeout = function(side_effect, media) {
      return new Promise(function(resolve) {
        setTimeout(function() {
          side_effect.push(media.index);
          resolve(media.index);
        }, (requested_count - 1 - media.index) * 3);
      });
    };

    // This callback will return a promise that will reject with an error,
    // after waiting an amount of time inverse to the media index.
    var callbackTimeoutError = function(side_effect, media) {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          side_effect.push(media.index);
          reject(Error('boom'));
        }, (requested_count - 1 - media.index) * 3);
      });
    };

    var getRecentMediasSpy;
    var callbackSpy;

    beforeEach(function() {
      spyOn(core.logger, 'log');
      getRecentMediasSpy = spyOn(user, 'getRecentMedias');
      callbackSpy = jasmine.createSpy('callbackSpy');

      // The default, working mock workflow
      getRecentMediasSpy.and.callFake(getRecentMedias);
    });

    it('iterates over medias in parallel (wo/ videos)', function(done) {
      var side_effect = [];
      callbackSpy.and.callFake(callbackTimeout.bind(null, side_effect));
      var options = {
        count: requested_count,
        includeVideos: false
      };
      user.forEachRecentMedias(
        mock_user.id,
        options,
        callbackSpy
      ).then(function(output) {
        var actual_total = requested_count - 1; // skip video
        expect(getRecentMediasSpy).toHaveBeenCalledWith(mock_user.id, options);
        expect(callbackSpy.calls.count()).toEqual(actual_total);
        expect(callbackSpy.calls.argsFor(0)).toEqual(
          [{index: 0}, options]);
        expect(callbackSpy.calls.argsFor(actual_total - 1)).toEqual(
          [{index: actual_total - 1}, options]);
        expect(strip_ansi(core.logger.log.calls.argsFor(0)[0])).toEqual(
          'Skipped');
        expect(strip_ansi(core.logger.log.calls.argsFor(0)[1])).toEqual(
          (requested_count - actual_total).toString());
        expect(strip_ansi(core.logger.log.calls.argsFor(1)[0])).toEqual(
          'Done iterating over');
        expect(strip_ansi(core.logger.log.calls.argsFor(1)[1])).toEqual(
          actual_total.toString());
        // No matter how long each promise took, the resulting array of indices
        // should be in order. The side effect var, however, should be in
        // reverse order, because the first promise resolved last.
        var indices = helpers.fillArray(actual_total, true);
        expect(output).toEqual(indices);
        expect(side_effect).toEqual(indices.reverse());
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('iterates over medias sequentially (wo/ videos)', function(done) {
      var side_effect = [];
      callbackSpy.and.callFake(callbackTimeout.bind(null, side_effect));
      var options = {
        count: requested_count,
        sequential: true,
        includeVideos: false
      };
      user.forEachRecentMedias(
        mock_user.id,
        options,
        callbackSpy
      ).then(function(output) {
        var actual_total = requested_count - 1; // skip video
        expect(getRecentMediasSpy).toHaveBeenCalledWith(mock_user.id, options);
        expect(callbackSpy.calls.count()).toEqual(actual_total);
        expect(callbackSpy.calls.argsFor(0)).toEqual(
          [{index: 0}, options]);
        expect(callbackSpy.calls.argsFor(actual_total - 1)).toEqual(
          [{index: actual_total - 1}, options]);
        expect(strip_ansi(core.logger.log.calls.argsFor(0)[0])).toEqual(
          'Skipped');
        expect(strip_ansi(core.logger.log.calls.argsFor(0)[1])).toEqual(
          (requested_count - actual_total).toString());
        expect(strip_ansi(core.logger.log.calls.argsFor(1)[0])).toEqual(
          'Done iterating over');
        expect(strip_ansi(core.logger.log.calls.argsFor(1)[1])).toEqual(
          actual_total.toString());
        // No matter how long each promise took, the resulting array of indices
        // should be in order. The side effect var should be in order as well,
        // because we should be executing sequentially.
        var indices = helpers.fillArray(actual_total, true);
        expect(output).toEqual(indices);
        expect(side_effect).toEqual(indices);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('rejects on getting a recent medias error', function(done) {
      getRecentMediasSpy.and.callFake(helpers.promiseRejectError);
      user.forEachRecentMedias(mock_user.id,{}).then(function() {
        done.fail(new Error('should not have succeeded'));
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on getting an error in parallel (w/ videos)', function(done) {
      var side_effect = [];
      callbackSpy.and.callFake(callbackTimeoutError.bind(null, side_effect));
      var options = {
        count: requested_count,
        includeVideos: true
      };
      user.forEachRecentMedias(
        mock_user.id,
        options,
        callbackSpy
      ).then(function(output) {
        done.fail(output); // we should not fail collecting all the promises
      }, function(err) {
        // In parallel mode, everything should execute separately; the failure
        // of one promise should not stop the whole process:
        //   - the callback should have been called for each media,
        //   - the side effect var should reflect that the promise of the last
        //     index should reject first (it had the shortest delay).
        expect(callbackSpy.calls.count()).toEqual(requested_count);
        expect(side_effect).toEqual([requested_count - 1]);
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on getting an error sequentially (w/ videos)', function(done) {
      var side_effect = [];
      callbackSpy.and.callFake(callbackTimeoutError.bind(null, side_effect));
      var options = {
        count: requested_count,
        sequential: true,
        includeVideos: true
      };
      user.forEachRecentMedias(
        mock_user.id,
        options,
        callbackSpy
      ).then(function(res) {
        done.fail(res); // we should not fail chaining all the promises
      }, function(err) {
        // In sequential mode, everything should execute in sequence; the
        // failure of one promise should stop the whole process:
        //   - the callback should have been called for one media,
        //   - the side effect var should reflect that the promise of the first
        //     index should reject first (even if it had the longest delay).
        expect(callbackSpy.calls.count()).toEqual(1);
        expect(side_effect).toEqual([0]);
        expect(err.message).toEqual('boom');
        done();
      });
    });

  });

});
