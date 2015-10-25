'use strict';

var rewire     = require('rewire');
var strip_ansi = require('strip-ansi');

var mediaData  = require('./data/media');
var helpers    = require('./support/helpers');

var user = rewire('../lib/user.js');

describe('user', function() {
  var ig = user.__get__('ig');
  var log = user.__get__('log');

  describe('isUserId', function() {
    var isUserId = user.__get__('isUserId');

    it('checks if a user id is valid', function() {
      expect(isUserId('12345678')).toBe(true);
    });

    it('checks if a user id is invalid', function() {
      expect(isUserId('username')).not.toBe(true);
    });
  });

  describe('resolveUserId', function() {
    var resolveUserId = user.__get__('resolveUserId');

    it('resolves a user id to itself', function(done) {
      spyOn(ig, 'user_search');
      resolveUserId('12345678').then(function(user_id) {
        expect(ig.user_search.calls.any()).toEqual(false);
        expect(user_id).toEqual('12345678');
        done();
      });
    });

    it('resolves a username', function(done) {
      var user_search = function(user_id, options, callback) {
        callback(false, [{id: '12345678'}]);
      };
      spyOn(ig, 'user_search').and.callFake(user_search);
      spyOn(log, 'output');
      resolveUserId('username').then(function(user_id) {
        expect(ig.user_search.calls.argsFor(0)[0]).toEqual('username');
        expect(log.output).toHaveBeenCalled();
        expect(user_id).toEqual('12345678');
        done();
      });
    });

    it('rejects on error', function(done) {
      var user_search = function(user_id, options, callback) {
        callback(Error('boom'));
      };
      spyOn(ig, 'user_search').and.callFake(user_search);
      resolveUserId('username').catch(function(err) {
        expect(ig.user_search.calls.argsFor(0)[0]).toEqual('username');
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects when no result is returned', function(done) {
      var user_search = function(user_id, options, callback) {
        callback(false, []);
      };
      spyOn(ig, 'user_search').and.callFake(user_search);
      resolveUserId('username').catch(function(err) {
        expect(ig.user_search.calls.argsFor(0)[0]).toEqual('username');
        expect(err.message).toEqual(
          log.formatErrorMessage('Could not find user ID for: username'));
        done();
      });
    });
  });

  describe('getRecentMedias', function() {
    var getRecentMedias = user.__get__('getRecentMedias');

    beforeEach(function() {
      spyOn(log, 'output');
    });

    it('fetches a media', function(done) {
      // Our ig.user_media_recent returns a page of empty media objects async.
      var next = function(callback) {
        setTimeout(function() {
          callback(
            null,
            helpers.fillArray(mediaData.defaultQueryPageSize),
            {next: next}
          );
        }, 0);
      };
      var user_media_recent = function(user_id, options, callback) {
        next(callback);
      };
      spyOn(ig, 'user_media_recent').and.callFake(user_media_recent);
      // Let's query more than one page, but less than two pages
      var page_size = mediaData.defaultQueryPageSize;
      var half_page_size = Math.floor(mediaData.defaultQueryPageSize / 2);
      var count = page_size + half_page_size;
      var medias = [];
      // Unfortunately, it does not seem that suspend and generators are
      // supported by jasmine. Let's manually wait for the two promises
      // we are supposed to get, since we are querying 1 and a half pages.
      getRecentMedias('12345678', {count: count}).then(function(chunk1) {
        medias = medias.concat(chunk1.medias);
        chunk1.next.then(function(chunk2) {
          medias = medias.concat(chunk2.medias);
          expect(ig.user_media_recent.calls.argsFor(0)[0]).toEqual('12345678');
          expect(medias.length).toEqual(count);
          expect(medias[count - 1].fetch_index).toEqual(count - 1);
          expect(strip_ansi(log.output.calls.argsFor(0)[0])).toEqual(
            `Found ${page_size} media(s), more to come...`);
          expect(strip_ansi(log.output.calls.argsFor(1)[0])).toEqual(
            `Found another ${half_page_size} media(s), nothing more.`);
          done();
        });
      });
    });

    it('rejects on errors', function(done) {
      // Our ig.user_media_recent just returns an error
      var user_media_recent = function(user_id, options, callback) {
        callback(Error('boom'));
      };
      spyOn(ig, 'user_media_recent').and.callFake(user_media_recent);
      getRecentMedias('12345678', {count: 3}).catch(function(err) {
        expect(ig.user_media_recent.calls.argsFor(0)[0]).toEqual('12345678');
        expect(err.message).toEqual('boom');
        done();
      });
    });
  });

  describe('forEachRecentMedias', function() {
    var forEachRecentMedias = user.__get__('forEachRecentMedias');
    var pageTotal = 3;

    // This fake getRecentMedias will first return a page with 2 empty
    // medias, then a page with the rest (pageTotal).
    var getRecentMedias = function() {
      var medias = helpers.fillArray(pageTotal, 'index');
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
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          side_effect.push(media.index);
          resolve(media.index);
        }, (pageTotal - 1 - media.index) * 3);
      });
    };

    // This callback will return a promise that will reject with an error,
    // after waiting an amount of time inverse to the media index.
    var callbackTimeoutError = function(side_effect, media) {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          side_effect.push(media.index);
          reject(Error('boom'));
        }, (pageTotal - 1 - media.index) * 3);
      });
    };

    var getRecentMediasSpy;
    var callbackSpy;

    beforeEach(function() {
      spyOn(log, 'output');
      getRecentMediasSpy = jasmine.createSpy('getRecentMedias');
      user.__set__('getRecentMedias', getRecentMediasSpy);
      callbackSpy = jasmine.createSpy('callbackSpy');

      // The default, working mock workflow
      getRecentMediasSpy.and.callFake(getRecentMedias);
    });

    it('iterates over medias in parallel', function(done) {
      var side_effect = [];
      callbackSpy.and.callFake(callbackTimeout.bind(null, side_effect));
      var options = {};
      forEachRecentMedias(
        '12345678',
        options,
        callbackSpy
      ).then(function(output) {
        expect(getRecentMediasSpy).toHaveBeenCalledWith('12345678', options);
        expect(callbackSpy.calls.count()).toEqual(pageTotal);
        expect(callbackSpy.calls.argsFor(0)).toEqual(
          [{index: 0}, options]);
        expect(callbackSpy.calls.argsFor(pageTotal - 1)).toEqual(
          [{index: pageTotal - 1}, options]);
        expect(strip_ansi(log.output.calls.argsFor(0)[0])).toEqual(
          'Done iterating over');
        expect(strip_ansi(log.output.calls.argsFor(0)[1])).toEqual(
          pageTotal.toString());
        // No matter how long each promise took, the resulting array of indices
        // should be in order. The side effect var, however, should be in
        // reverse order, because the first promise resolved last.
        var indices = helpers.fillArray(pageTotal, true);
        expect(output).toEqual(indices);
        expect(side_effect).toEqual(indices.reverse());
        done();
      }, function(err) {
        fail(err); // we should not fail collecting all the promises
        done();
      });
    });

    it('iterates over medias sequentially', function(done) {
      var side_effect = [];
      callbackSpy.and.callFake(callbackTimeout.bind(null, side_effect));
      var options = {
        sequential: true
      };
      forEachRecentMedias(
        '12345678',
        options,
        callbackSpy
      ).then(function(output) {
        expect(getRecentMediasSpy).toHaveBeenCalledWith('12345678', options);
        expect(callbackSpy.calls.count()).toEqual(pageTotal);
        expect(callbackSpy.calls.argsFor(0)).toEqual(
          [{index: 0}, options]);
        expect(callbackSpy.calls.argsFor(pageTotal - 1)).toEqual(
          [{index: pageTotal - 1}, options]);
        expect(strip_ansi(log.output.calls.argsFor(0)[0])).toEqual(
          'Done iterating over');
        expect(strip_ansi(log.output.calls.argsFor(0)[1])).toEqual(
          pageTotal.toString());
        // No matter how long each promise took, the resulting array of indices
        // should be in order. The side effect var should be in order as well,
        // because we should be executing sequentially.
        var indices = helpers.fillArray(pageTotal, true);
        expect(output).toEqual(indices);
        expect(side_effect).toEqual(indices);
        done();
      }, function(err) {
        fail(err); // we should not fail chaining all the promises
        done();
      });
    });

    it('rejects on getting a recent medias error', function(done) {
      getRecentMediasSpy.and.callFake(helpers.promiseRejectError);
      forEachRecentMedias('12345678',{}).then(function() {
        fail(new Error('should not have succeeded'));
        done();
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on getting an error in parallel', function(done) {
      var side_effect = [];
      callbackSpy.and.callFake(callbackTimeoutError.bind(null, side_effect));
      var options = {};
      forEachRecentMedias(
        '12345678',
        options,
        callbackSpy
      ).then(function(output) {
        fail(output); // we should not fail collecting all the promises
        done();
      }, function(err) {
        // In parallel mode, everything should execute separately; the failure
        // of one promise should not stop the whole process:
        //   - the callback should have been called for each media,
        //   - the side effect var should reflect that the promise of the last
        //     index should reject first (it had the shortest delay).
        expect(callbackSpy.calls.count()).toEqual(pageTotal);
        expect(side_effect).toEqual([pageTotal - 1]);
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on getting an error sequentially', function(done) {
      var side_effect = [];
      callbackSpy.and.callFake(callbackTimeoutError.bind(null, side_effect));
      var options = {
        sequential: true
      };
      forEachRecentMedias(
        '12345678',
        options,
        callbackSpy
      ).then(function(res) {
        fail(err); // we should not fail chaining all the promises
        done();
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
