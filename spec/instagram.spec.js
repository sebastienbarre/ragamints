'use strict';

var rewire     = require('rewire');
var helpers    = require('./support/helpers');
var Promise    = require('es6-promise').Promise;

var instagram  = rewire('../lib/instagram.js');

var mediaData  = require('./data/media');

describe('instagram', function() {
  var cache = instagram.__get__('cache');
  var ig_node = instagram.__get__('ig_node');
  var logger = instagram.__get__('logger');

  var mock_user = {
    username: 'username',
    id: '12345678'
  };

  describe('user_search', function() {
    var user_search = instagram.__get__('user_search');

    it('caches calls to ig_node.user_search', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(cache, 'set');
      var ig_node_user_search = function(user_id, options, callback) {
        callback(null, [mock_user]);
      };
      spyOn(ig_node, 'user_search').and.callFake(ig_node_user_search);
      user_search(mock_user.username, {}, function(err, users) {
        if (err) {
          done.fail(err);
        }
        expect(cache.get).toHaveBeenCalled(); // this rejected
        expect(ig_node.user_search).toHaveBeenCalled();
        expect(cache.set).toHaveBeenCalled();
        expect(users[0]).toEqual(mock_user);
        done();
      });
    });

    it('does not cache when ig_node.user_search is empty ', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(cache, 'set');
      var ig_node_user_search = function(user_id, options, callback) {
        callback(null, []);
      };
      spyOn(ig_node, 'user_search').and.callFake(ig_node_user_search);
      user_search(mock_user.username, {}, function(err, users) {
        if (err) {
          done.fail(err);
        }
        expect(cache.get).toHaveBeenCalled(); // this rejected
        expect(ig_node.user_search).toHaveBeenCalled();
        expect(cache.set).not.toHaveBeenCalled(); // since it returned []
        expect(users).toEqual([]);
        done();
      });
    });

    it('uses the cache instead of ig_node.user_search', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.resolve([mock_user]);
      });
      spyOn(cache, 'set');
      spyOn(ig_node, 'user_search');
      // spyOn(logger, 'log');
      user_search(mock_user.username, {}, function(err, users) {
        if (err) {
          done.fail(err);
        }
        expect(cache.get).toHaveBeenCalled();
        expect(cache.set).not.toHaveBeenCalled();
        expect(ig_node.user_search).not.toHaveBeenCalled();
        // expect(logger.log).toHaveBeenCalled();
        expect(users).toEqual([mock_user]);
        done();
      });
    });

  });

  describe('user_media_recent', function() {
    var user_media_recent = instagram.__get__('user_media_recent');
    var page_size = instagram.__get__('pageSize').user_media_recent;
    var half_page_size = Math.floor(page_size / 2);

    // This mock returns a full page of empty medias, indefinitely
    var next = function(callback) {
      setTimeout(function() {
        callback(null, helpers.fillArray(page_size), {next: next});
      }, 0);
    };
    var ig_node_user_media_recent = function(user_id, options, callback) {
      next(callback);
    };

    // This mock returns a full page of empty medias, once
    var next_once = function(callback) {
      setTimeout(function() {
        callback(null, helpers.fillArray(page_size), {});
      }, 0);
    };
    var ig_node_user_media_recent_once = function(user_id, options, callback) {
      next_once(callback);
    };

    // This mock fails
    var ig_node_user_media_recent_fail = function(user_id, options, callback) {
      callback(Error('Boom'));
    };

    it('caches calls to ig_node.user_media_recent (2 pages)', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(cache, 'set');
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent);
      var options = {
        count: page_size + half_page_size  // for pagination coverage
      };
      var current_count = 0;
      user_media_recent(
        mock_user.id,
        options,
        function(err, medias, pagination) {
          if (err) {
            done.fail(err);
          }
          expect(cache.get).toHaveBeenCalled(); // this rejected
          expect(ig_node.user_media_recent).toHaveBeenCalled();
          current_count += medias.length;
          expect(options.count).toBeGreaterThan(current_count);
          // Since we requested more than page_size, pagination needs to occur
          pagination.next(function(err, medias) {
            if (err) {
              done.fail(err);
            }
            current_count += medias.length;
            expect(options.count).not.toBeGreaterThan(current_count);
            // We should have received enough medias for cache.set to be called
            expect(cache.set).toHaveBeenCalled();
            done();
          });
        }
      );
    });

    it('uses the cache instead of ig_node.user_media_recent', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        // let's set a situation where the cache has actually more than
        // we are requesting
        return Promise.resolve(helpers.fillArray(page_size * 2));
      });
      spyOn(cache, 'set');
      spyOn(ig_node, 'user_media_recent');
      // spyOn(logger, 'log');
      var options = {
        count: page_size + half_page_size  // for pagination coverage
      };
      user_media_recent(mock_user.id, options, function(err, medias) {
        if (err) {
          done.fail(err);
        }
        expect(cache.get).toHaveBeenCalled();
        expect(cache.set).not.toHaveBeenCalled();
        expect(ig_node.user_media_recent).not.toHaveBeenCalled();
        // expect(logger.log).toHaveBeenCalled();
        expect(options.count).toEqual(medias.length);
        done();
      });
    });

    it('caches calls to ig_node.user_media_recent (1 page)', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(cache, 'set');
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent_once);
      var options = {
        minId: '012345678',
        maxId: '123456789'
      };
      user_media_recent(
        mock_user.id,
        options,
        function(err, medias, pagination) {
          if (err) {
            done.fail(err);
          }
          expect(cache.get).toHaveBeenCalled(); // this rejected
          expect(ig_node.user_media_recent).toHaveBeenCalled();
          expect(medias.length).toBe(page_size);
          expect(pagination).toEqual({});
          expect(cache.set).toHaveBeenCalled();
          done();
        }
      );
    });

    it('bails on ig_node.user_media_recent error', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(cache, 'set');
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent_fail);
      var options = {};
      user_media_recent(
        mock_user.id,
        options,
        function(err, medias, pagination) {
          if (err) {
            expect(err.message).toEqual('Boom');
            expect(cache.get).toHaveBeenCalled(); // this rejected
            expect(ig_node.user_media_recent).toHaveBeenCalled();
            expect(medias).toBe(undefined);
            expect(pagination).toBe(undefined);
            expect(cache.set).not.toHaveBeenCalled();
            done();
          } else {
            done.fail(err);
          }
        }
      );
    });

  });

  describe('oembed', function() {
    var oembed = instagram.__get__('oembed');
    var mock_oembed = {
      media_id: mediaData.image.standard.id
    };
    var fetch_spy;
    var fetch_success = function() {
      return Promise.resolve({
        ok: true,
        json: function() {
          return mock_oembed;
        }
      });
    };
    var fetch_fail = function() {
      return Promise.resolve({
        ok: false
      });
    };

    it('fetches and caches a oembed object', function(done) {
      fetch_spy = jasmine.createSpy('fetch').and.callFake(fetch_success);
      instagram.__set__('fetch', fetch_spy);
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(cache, 'set');
      oembed(mediaData.image.standard.link).then(function(oembed) {
        expect(cache.get).toHaveBeenCalled(); // this rejected
        expect(cache.set).toHaveBeenCalled();
        expect(fetch_spy).toHaveBeenCalled();
        expect(oembed).toEqual(mock_oembed);
        done();
      });
    });

    it('uses the cache instead of fetching a oembed object', function(done) {
      fetch_spy = jasmine.createSpy('fetch');
      instagram.__set__('fetch', fetch_spy);
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.resolve(mock_oembed);
      });
      spyOn(cache, 'set');
      // spyOn(logger, 'log');
      oembed(mediaData.image.standard.link).then(function(oembed) {
        expect(cache.get).toHaveBeenCalled();
        expect(fetch_spy).not.toHaveBeenCalled();
        expect(cache.set).not.toHaveBeenCalled();
        expect(oembed).toEqual(mock_oembed);
        // expect(logger.log).toHaveBeenCalled();
        done();
      });
    });

    it('rejects when fetching fails', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      fetch_spy = jasmine.createSpy('fetch').and.callFake(fetch_fail);
      instagram.__set__('fetch', fetch_spy);
      oembed(mediaData.image.standard.link).then(function() {
        done.fail();
      }, function(err) {
        expect(fetch_spy).toHaveBeenCalled();
        expect(err.message).toEqual(
          logger.formatErrorMessage(
            'Could not fetch oembed for ' + mediaData.image.standard.link));
        done();
      });
    });
  });

});
