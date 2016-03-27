'use strict';

var rewire     = require('rewire');
var Promise    = require('es6-promise').Promise;

var helpers    = require('../support/helpers');
var mediaData  = require('../data/media');

var constants  = require('../../lib/instagram/constants');

var client     = rewire('../../lib/instagram/client.js');

describe('instagram.client', function() {
  var ig_node = client.__get__('ig_node');
  var core = client.__get__('core');

  var mock_user = {
    username: 'username',
    id: '12345678'
  };

  describe('instagram.client.user_search', function() {

    it('caches calls to ig_node.user_search', function(done) {
      spyOn(core.cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(core.cache, 'set');
      var ig_node_user_search = function(user_id, options, callback) {
        callback(null, [mock_user]);
      };
      spyOn(ig_node, 'user_search').and.callFake(ig_node_user_search);
      client.user_search(mock_user.username, {}, function(err, users) {
        if (err) {
          done.fail(err);
        }
        expect(core.cache.get).toHaveBeenCalled(); // this rejected
        expect(ig_node.user_search).toHaveBeenCalled();
        expect(core.cache.set).toHaveBeenCalled();
        expect(users[0]).toEqual(mock_user);
        done();
      });
    });

    it('does not cache when ig_node.user_search is empty ', function(done) {
      spyOn(core.cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(core.cache, 'set');
      var ig_node_user_search = function(user_id, options, callback) {
        callback(null, []);
      };
      spyOn(ig_node, 'user_search').and.callFake(ig_node_user_search);
      client.user_search(mock_user.username, {}, function(err, users) {
        if (err) {
          done.fail(err);
        }
        expect(core.cache.get).toHaveBeenCalled(); // this rejected
        expect(ig_node.user_search).toHaveBeenCalled();
        expect(core.cache.set).not.toHaveBeenCalled(); // since it returned []
        expect(users).toEqual([]);
        done();
      });
    });

    it('uses the cache instead of ig_node.user_search', function(done) {
      spyOn(core.cache, 'get').and.callFake(function() {
        return Promise.resolve([mock_user]);
      });
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_search');
      // spyOn(core.logger, 'log');
      client.user_search(mock_user.username, {}, function(err, users) {
        if (err) {
          done.fail(err);
        }
        expect(core.cache.get).toHaveBeenCalled();
        expect(core.cache.set).not.toHaveBeenCalled();
        expect(ig_node.user_search).not.toHaveBeenCalled();
        // expect(core.logger.log).toHaveBeenCalled();
        expect(users).toEqual([mock_user]);
        done();
      });
    });

  });

  describe('instagram.client.user_media_recent', function() {
    var page_size = constants.PAGE_SIZE.user_media_recent;
    var half_page_size = Math.floor(page_size / 2);

    // This mock returns a full page of empty medias, indefinitely
    var next = function(callback) {
      setTimeout(function() {
        callback(null, helpers.fillArray(page_size), { next: next });
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
      spyOn(core.cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent);
      var options = {
        count: page_size + half_page_size  // for pagination coverage
      };
      var current_count = 0;
      client.user_media_recent(
        mock_user.id,
        options,
        function(err, medias, pagination) {
          if (err) {
            done.fail(err);
          }
          expect(core.cache.get).toHaveBeenCalled(); // this rejected
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
            expect(core.cache.set).toHaveBeenCalled();
            done();
          });
        }
      );
    });

    it('caches calls to ig_node.user_media_recent (1 page)', function(done) {
      spyOn(core.cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent_once);
      var options = {
        minId: '012345678',
        maxId: '123456789'
      };
      client.user_media_recent(
        mock_user.id,
        options,
        function(err, medias, pagination) {
          if (err) {
            done.fail(err);
          }
          expect(core.cache.get).toHaveBeenCalled(); // this rejected
          expect(ig_node.user_media_recent).toHaveBeenCalled();
          expect(medias.length).toBe(page_size);
          expect(pagination).toEqual({});
          expect(core.cache.set).toHaveBeenCalled();
          done();
        }
      );
    });

    it('uses the cache instead of ig_node.user_media_recent', function(done) {
      spyOn(core.cache, 'get').and.callFake(function() {
        // let's set a situation where the cache has actually more than
        // we are requesting
        return Promise.resolve(helpers.fillArray(page_size * 2));
      });
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_media_recent');
      // spyOn(core.logger, 'log');
      var options = {
        count: page_size + half_page_size  // for pagination coverage
      };
      client.user_media_recent(mock_user.id, options, function(err, medias) {
        if (err) {
          done.fail(err);
        }
        expect(core.cache.get).toHaveBeenCalled();
        expect(core.cache.set).not.toHaveBeenCalled();
        expect(ig_node.user_media_recent).not.toHaveBeenCalled();
        // expect(core.logger.log).toHaveBeenCalled();
        expect(options.count).toEqual(medias.length);
        done();
      });
    });

    it('bails on ig_node.user_media_recent error', function(done) {
      spyOn(core.cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent_fail);
      var options = {};
      client.user_media_recent(
        mock_user.id,
        options,
        function(err, medias, pagination) {
          if (err) {
            expect(err.message).toEqual('Boom');
            expect(core.cache.get).toHaveBeenCalled(); // this rejected
            expect(ig_node.user_media_recent).toHaveBeenCalled();
            expect(medias).toBe(undefined);
            expect(pagination).toBe(undefined);
            expect(core.cache.set).not.toHaveBeenCalled();
            done();
          } else {
            done.fail(err);
          }
        }
      );
    });

  });

  describe('instagram.client.oembed', function() {
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
      client.__set__('fetch', fetch_spy);
      spyOn(core.cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(core.cache, 'set');
      client.oembed(mediaData.image.standard.link).then(function(oembed) {
        expect(core.cache.get).toHaveBeenCalled(); // this rejected
        expect(core.cache.set).toHaveBeenCalled();
        expect(fetch_spy).toHaveBeenCalled();
        expect(oembed).toEqual(mock_oembed);
        done();
      });
    });

    it('uses the cache instead of fetching a oembed object', function(done) {
      fetch_spy = jasmine.createSpy('fetch');
      client.__set__('fetch', fetch_spy);
      spyOn(core.cache, 'get').and.callFake(function() {
        return Promise.resolve(mock_oembed);
      });
      spyOn(core.cache, 'set');
      // spyOn(core.logger, 'log');
      client.oembed(mediaData.image.standard.link).then(function(oembed) {
        expect(core.cache.get).toHaveBeenCalled();
        expect(fetch_spy).not.toHaveBeenCalled();
        expect(core.cache.set).not.toHaveBeenCalled();
        expect(oembed).toEqual(mock_oembed);
        // expect(core.logger.log).toHaveBeenCalled();
        done();
      });
    });

    it('rejects when fetching fails', function(done) {
      spyOn(core.cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      fetch_spy = jasmine.createSpy('fetch').and.callFake(fetch_fail);
      client.__set__('fetch', fetch_spy);
      client.oembed(mediaData.image.standard.link).then(function() {
        done.fail();
      }, function(err) {
        expect(fetch_spy).toHaveBeenCalled();
        expect(err.message).toEqual(
          core.logger.formatErrorMessage(
            'Could not fetch Instagram oembed for ' +
            mediaData.image.standard.link));
        done();
      });
    });
  });

});
