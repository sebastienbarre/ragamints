const rewire = require('rewire');
const Promise = require('es6-promise').Promise;

const helpers = require('../support/helpers');
const mediaData = require('../data/media');

const constants = require('../../lib/instagram/constants');

const client = rewire('../../lib/instagram/client.js');

describe('instagram.client', () => {
  const ig_node = client.__get__('ig_node');
  const core = client.__get__('core');

  const mock_user = {
    username: 'username',
    id: '12345678',
  };

  describe('instagram.client.user_search', () => {
    it('caches calls to ig_node.user_search', (done) => {
      // Prevent the cache from finding anything
      spyOn(core.cache, 'get').and.callFake(() => Promise.reject());
      spyOn(core.cache, 'set');
      const ig_node_user_search = (user_id, options, callback) => {
        callback(null, [mock_user]);
      };
      spyOn(ig_node, 'user_search').and.callFake(ig_node_user_search);
      client.user_search(mock_user.username, {}, (err, users) => {
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

    it('does not cache when ig_node.user_search is empty ', (done) => {
      // Prevent the cache from finding anything
      spyOn(core.cache, 'get').and.callFake(() => Promise.reject());
      spyOn(core.cache, 'set');
      const ig_node_user_search = (user_id, options, callback) => {
        callback(null, []);
      };
      spyOn(ig_node, 'user_search').and.callFake(ig_node_user_search);
      client.user_search(mock_user.username, {}, (err, users) => {
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

    it('uses the cache instead of ig_node.user_search', (done) => {
      spyOn(core.cache, 'get').and.callFake(() => Promise.resolve([mock_user]));
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_search');
      // spyOn(core.logger, 'log');
      client.user_search(mock_user.username, {}, (err, users) => {
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

  describe('instagram.client.user_media_recent', () => {
    const page_size = constants.PAGE_SIZE.user_media_recent;
    const half_page_size = Math.floor(page_size / 2);

    // This mock returns a full page of empty medias, indefinitely
    const next = (callback) => {
      setTimeout(() => {
        callback(null, helpers.fillArray(page_size), { next });
      }, 0);
    };
    const ig_node_user_media_recent = (user_id, options, callback) => {
      next(callback);
    };

    // This mock returns a full page of empty medias, once
    const next_once = (callback) => {
      setTimeout(() => {
        callback(null, helpers.fillArray(page_size), {});
      }, 0);
    };
    const ig_node_user_media_recent_once = (user_id, options, callback) => {
      next_once(callback);
    };

    // This mock fails
    const ig_node_user_media_recent_fail = (user_id, options, callback) => {
      callback(Error('Boom'));
    };

    it('caches calls to ig_node.user_media_recent (2 pages)', (done) => {
      // Prevent the cache from finding anything
      spyOn(core.cache, 'get').and.callFake(() => Promise.reject());
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent);
      const options = {
        count: page_size + half_page_size, // for pagination coverage
      };
      let current_count = 0;
      client.user_media_recent(
        mock_user.id,
        options,
        (err, medias, pagination) => {
          if (err) {
            done.fail(err);
          }
          expect(core.cache.get).toHaveBeenCalled(); // this rejected
          expect(ig_node.user_media_recent).toHaveBeenCalled();
          current_count += medias.length;
          expect(options.count).toBeGreaterThan(current_count);
          // Since we requested more than page_size, pagination needs to occur
          pagination.next((err2, medias2) => {
            if (err2) {
              done.fail(err2);
            }
            current_count += medias2.length;
            expect(options.count).not.toBeGreaterThan(current_count);
            // We should have received enough medias for cache.set to be called
            expect(core.cache.set).toHaveBeenCalled();
            done();
          });
        }
      );
    });

    it('caches calls to ig_node.user_media_recent (1 page)', (done) => {
      // Prevent the cache from finding anything
      spyOn(core.cache, 'get').and.callFake(() => Promise.reject());
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent_once);
      const options = {
        minId: '012345678',
        maxId: '123456789',
      };
      client.user_media_recent(
        mock_user.id,
        options,
        (err, medias, pagination) => {
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

    it('uses the cache instead of ig_node.user_media_recent', (done) => {
      // let's set a situation where the cache has actually more than we are requesting
      spyOn(core.cache, 'get').and.callFake(
        () => Promise.resolve(helpers.fillArray(page_size * 2)));
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_media_recent');
      // spyOn(core.logger, 'log');
      const options = {
        count: page_size + half_page_size, // for pagination coverage
      };
      client.user_media_recent(mock_user.id, options, (err, medias) => {
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

    it('bails on ig_node.user_media_recent error', (done) => {
      // Prevent the cache from finding anything
      spyOn(core.cache, 'get').and.callFake(() => Promise.reject());
      spyOn(core.cache, 'set');
      spyOn(ig_node, 'user_media_recent').and.callFake(
        ig_node_user_media_recent_fail);
      const options = {};
      client.user_media_recent(
        mock_user.id,
        options,
        (err, medias, pagination) => {
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

  describe('instagram.client.oembed', () => {
    const mock_oembed = {
      media_id: mediaData.image.standard.id,
    };
    let fetch_spy;
    const fetch_success = () => Promise.resolve({
      ok: true,
      json: () => mock_oembed,
    });
    const fetch_fail = () => Promise.resolve({
      ok: false,
    });

    it('fetches and caches a oembed object', (done) => {
      fetch_spy = jasmine.createSpy('fetch').and.callFake(fetch_success);
      client.__set__('fetch', fetch_spy);
      // Prevent the cache from finding anything
      spyOn(core.cache, 'get').and.callFake(() => Promise.reject());
      spyOn(core.cache, 'set');
      client.oembed(mediaData.image.standard.link).then((oembed) => {
        expect(core.cache.get).toHaveBeenCalled(); // this rejected
        expect(core.cache.set).toHaveBeenCalled();
        expect(fetch_spy).toHaveBeenCalled();
        expect(oembed).toEqual(mock_oembed);
        done();
      });
    });

    it('uses the cache instead of fetching a oembed object', (done) => {
      fetch_spy = jasmine.createSpy('fetch');
      client.__set__('fetch', fetch_spy);
      spyOn(core.cache, 'get').and.callFake(() => Promise.resolve(mock_oembed));
      spyOn(core.cache, 'set');
      // spyOn(core.logger, 'log');
      client.oembed(mediaData.image.standard.link).then((oembed) => {
        expect(core.cache.get).toHaveBeenCalled();
        expect(fetch_spy).not.toHaveBeenCalled();
        expect(core.cache.set).not.toHaveBeenCalled();
        expect(oembed).toEqual(mock_oembed);
        // expect(core.logger.log).toHaveBeenCalled();
        done();
      });
    });

    it('rejects when fetching fails', (done) => {
      // Prevent the cache from finding anything
      spyOn(core.cache, 'get').and.callFake(() => Promise.reject());
      fetch_spy = jasmine.createSpy('fetch').and.callFake(fetch_fail);
      client.__set__('fetch', fetch_spy);
      client.oembed(mediaData.image.standard.link).then(() => {
        done.fail();
      }, (err) => {
        expect(fetch_spy).toHaveBeenCalled();
        expect(err.message).toEqual(
          core.logger.formatErrorMessage(
            `Could not fetch Instagram oembed for ${mediaData.image.standard.link}`));
        done();
      });
    });
  });
});
