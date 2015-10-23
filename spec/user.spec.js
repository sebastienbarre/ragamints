'use strict';

var rewire     = require('rewire');
var strip_ansi = require('strip-ansi');

var log = require('../lib/log');

var user = rewire('../lib/user.js');

var mediaData    = require('./data/media');

describe('user', function() {

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
    var ig = user.__get__('ig');

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
      spyOn(console, 'log');
      resolveUserId('username').then(function(user_id) {
        expect(ig.user_search.calls.argsFor(0)[0]).toEqual('username');
        expect(console.log).toHaveBeenCalled();
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
    var ig = user.__get__('ig');

    beforeEach(function() {
      spyOn(console, 'log');
    });

    it('fetches a media', function(done) {
      var next = function(callback) {
        setTimeout(function() {
          callback(
            null,
            mediaData.fillArray(mediaData.defaultQueryPageSize),
            {next: next}
          );
        }, 0);
      };
      var user_media_recent = function(user_id, options, callback) {
        next(callback);
      };
      var count = Math.floor(mediaData.defaultQueryPageSize * 1.5);
      var medias = [];
      spyOn(ig, 'user_media_recent').and.callFake(user_media_recent);
      // Unfortunately, it does not seem that suspend and generators are
      // supported by jasmine. Let's manually wait for the two promises
      // we are supposed to get.
      getRecentMedias('12345678', {count: count}).then(function(chunk1) {
        medias = medias.concat(chunk1.medias);
        chunk1.next.then(function(chunk2) {
          medias = medias.concat(chunk2.medias);
          expect(ig.user_media_recent.calls.argsFor(0)[0]).toEqual('12345678');
          expect(medias.length).toEqual(count);
          expect(medias[count - 1].fetch_index).toEqual(count - 1);
          expect(strip_ansi(console.log.calls.argsFor(0)[0])).toEqual(
            'Found 33 media(s), more to come...');
          expect(strip_ansi(console.log.calls.argsFor(1)[0])).toEqual(
            'Found another 16 media(s), nothing more.');
          done();
        });
      });
    });

    it('rejects on errors', function(done) {
      var user_media_recent = function(user_id, options, callback) {
        callback(Error('boom'));
      };
      spyOn(ig, 'user_media_recent').and.callFake(user_media_recent);
      // Unfortunately, it does not seem that suspend and generators are
      // supported by jasmine. Let's manually wait for the two promises
      // we are supposed to get.
      getRecentMedias('12345678', {count: 3}).catch(function(err) {
        expect(ig.user_media_recent.calls.argsFor(0)[0]).toEqual('12345678');
        expect(err.message).toEqual('boom');
        done();
      });
    });
  });

});
