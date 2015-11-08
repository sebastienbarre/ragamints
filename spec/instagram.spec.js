'use strict';

var rewire     = require('rewire');
var helpers    = require('./support/helpers');

var instagram  = rewire('../lib/instagram.js');

describe('instagram', function() {
  var cache = instagram.__get__('cache');
  var ig_node = instagram.__get__('ig_node');
  // var logger = instagram.__get__('logger');

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
      var ig_node_user_search = function(user_id, options, callback) {
        callback(null, [mock_user]);
      };
      spyOn(ig_node, 'user_search').and.callFake(ig_node_user_search);
      spyOn(cache, 'set');
      user_search(mock_user.username, {}, function(err, users) {
        if (err) {
          done.fail(err);
        };
        expect(cache.get).toHaveBeenCalled(); // this rejected
        expect(ig_node.user_search).toHaveBeenCalled();
        expect(cache.set).toHaveBeenCalled();
        expect(users[0]).toEqual(mock_user);
        done();
      });
    });

    it('uses the cache instead of ig_node.user_search', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.resolve([mock_user]);
      });
      spyOn(ig_node, 'user_search');
      // spyOn(logger, 'log');
      user_search(mock_user.username, {}, function(err, users) {
        if (err) {
          done.fail(err);
        };
        expect(cache.get).toHaveBeenCalled();
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

    // Our mock returns a full page of empty medias, indefinitely
    var next = function(callback) {
      setTimeout(function() {
        callback(null, helpers.fillArray(page_size), {next: next});
      }, 0);
    };
    var ig_node_user_media_recent = function(user_id, options, callback) {
      next(callback);
    };

    it('caches calls to ig_node.user_media_recent', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        return Promise.reject(); // Prevent the cache from finding anything
      });
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent);
      spyOn(cache, 'set');
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
        };
        expect(cache.get).toHaveBeenCalled(); // this rejected
        expect(ig_node.user_media_recent).toHaveBeenCalled();
        current_count += medias.length;
        expect(options.count).toBeGreaterThan(current_count);
        // Since we requested more than page_size, pagination needs to occur
        pagination.next(function(err, medias) {
          if (err) {
            done.fail(err);
          };
          current_count += medias.length;
          expect(options.count).not.toBeGreaterThan(current_count);
          // We should have received enough medias for cache.set to be called
          expect(cache.set).toHaveBeenCalled();
          done();
        });
      });
    });

    it('uses the cache instead of ig_node.user_media_recent', function(done) {
      spyOn(cache, 'get').and.callFake(function() {
        // let's set a situation where the cache has actually more than
        // we are requesting
        return Promise.resolve(helpers.fillArray(page_size * 2));
      });
      spyOn(ig_node, 'user_media_recent');
      spyOn(cache, 'set');
      // spyOn(logger, 'log');
      var options = {
        count: page_size + half_page_size  // for pagination coverage
      };
      user_media_recent(mock_user.id, options, function(err, medias) {
        if (err) {
          done.fail(err);
        };
        expect(cache.get).toHaveBeenCalled();
        expect(ig_node.user_media_recent).not.toHaveBeenCalled();
        expect(cache.set).not.toHaveBeenCalled();
        // expect(logger.log).toHaveBeenCalled();
        expect(options.count).toEqual(medias.length);
        done();
      });
    });

  });
});
