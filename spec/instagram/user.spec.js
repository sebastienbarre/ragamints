const rewire = require('rewire');
const strip_ansi = require('strip-ansi');

const helpers = require('../support/helpers');

const constants = require('../../lib/instagram/constants');

const user = rewire('../../lib/instagram/user.js');

describe('instagram.user', () => {
  const core = user.__get__('core');
  const client = user.__get__('client');

  const mock_user = {
    username: 'username',
    id: '12345678',
  };

  describe('instagram.user.resolveOptions', () => {
    let reverseSetProcess;

    beforeEach(() => {
      spyOn(core.logger, 'log');
      spyOn(client, 'use');
      const env = {};
      env[constants.ENV_VARS.ACCESS_TOKEN] = 'token';
      reverseSetProcess = user.__set__('process', { env });
    });

    afterEach(() => {
      reverseSetProcess();
    });

    it('resolves options', (done) => {
      const options = {
        verbose: true,
      };
      const resolved_options = {
        verbose: true,
        instagramAccessToken: 'token',
      };
      user.resolveOptions(options).then((res) => {
        expect(client.use).toHaveBeenCalled();
        expect(res).toEqual(resolved_options);
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('rejects when no access token is found', (done) => {
      user.__set__('process', { env: {} });
      user.resolveOptions({}).then(() => {
        done.fail(new Error('should not have succeeded'));
      }, (err) => {
        expect(err.message).toEqual(
          core.logger.formatErrorMessage('Need Instagram access token'));
        done();
      });
    });
  });

  describe('instagram.user.isUserId', () => {
    it('checks if a user id is valid', () => {
      expect(user.isUserId(mock_user.id)).toBe(true);
    });

    it('checks if a user id is invalid', () => {
      expect(user.isUserId(mock_user.username)).not.toBe(true);
    });
  });

  describe('instagram.user.resolveUserId', () => {
    it('resolves a user id to itself', (done) => {
      spyOn(client, 'user_search');
      user.resolveUserId(mock_user.id).then((user_id) => {
        expect(client.user_search).not.toHaveBeenCalled();
        expect(user_id).toEqual(mock_user.id);
        done();
      });
    });

    it('resolves a username', (done) => {
      const user_search = (user_id, options, callback) => {
        callback(null, [mock_user]);
      };
      spyOn(client, 'user_search').and.callFake(user_search);
      spyOn(core.logger, 'log');
      user.resolveUserId(mock_user.username).then((user_id) => {
        expect(client.user_search.calls.argsFor(0)[0]).toEqual(
          mock_user.username);
        expect(core.logger.log).toHaveBeenCalled();
        expect(user_id).toEqual(mock_user.id);
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('rejects on error', (done) => {
      const user_search = (user_id, options, callback) => {
        callback(Error('boom'));
      };
      spyOn(client, 'user_search').and.callFake(user_search);
      user.resolveUserId(mock_user.username).then((user_id) => {
        done.fail(Error(`Should not have found ${user_id}`));
      }, (err) => {
        expect(client.user_search.calls.argsFor(0)[0]).toEqual(
          mock_user.username);
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects when no result is returned', (done) => {
      const user_search = (user_id, options, callback) => {
        callback(null, []);
      };
      spyOn(client, 'user_search').and.callFake(user_search);
      user.resolveUserId(mock_user.username).then((user_id) => {
        done.fail(Error(`Should not have found ${user_id}`));
      }, (err) => {
        expect(client.user_search.calls.argsFor(0)[0]).toEqual(
          mock_user.username);
        expect(err.message).toEqual(
          core.logger.formatErrorMessage(
            'Could not find user ID for username'));
        done();
      });
    });
  });

  describe('instagram.user.getRecentMedias', () => {
    const page_size = constants.PAGE_SIZE.user_media_recent;

    // Our client.user_media_recent returns a page of empty media objects.
    const next = (callback) => {
      setTimeout(() => {
        callback(null, helpers.fillArray(page_size), { next });
      }, 0);
    };
    const user_media_recent = (user_id, options, callback) => {
      next(callback);
    };

    beforeEach(() => {
      spyOn(core.logger, 'log');
    });

    it('fetches recent medias, page by page', (done) => {
      spyOn(client, 'user_media_recent').and.callFake(user_media_recent);
      // Let's query more than one page, but less than two pages
      const half_page_size = Math.floor(page_size / 2);
      const count = page_size + half_page_size;
      let medias = [];
      // Unfortunately, it does not seem that suspend and generators are
      // supported by jasmine. Let's manually wait for the two promises
      // we are supposed to get, since we are querying 1 and a half pages.
      user.getRecentMedias(mock_user.id, { count }).then((page1) => {
        medias = medias.concat(page1.medias);
        page1.next.then((page2) => {
          medias = medias.concat(page2.medias);
          expect(client.user_media_recent.calls.argsFor(0)[0]).toBe(
            mock_user.id);
          expect(medias.length).toEqual(count);
          expect(strip_ansi(core.logger.log.calls.argsFor(0)[0])).toEqual(
            `Found ${page_size} media(s), more to come...`);
          expect(strip_ansi(core.logger.log.calls.argsFor(1)[0])).toEqual(
            `Found another ${half_page_size} media(s), nothing more.`);
          done();
        }, (err) => {
          done.fail(err);
        });
      }, (err) => {
        done.fail(err);
      });
    });

    it('fetches no medias without options', (done) => {
      spyOn(client, 'user_media_recent').and.callFake(user_media_recent);
      user.getRecentMedias(mock_user.id, {}).then((page) => {
        expect(client.user_media_recent).not.toHaveBeenCalled();
        expect(page.medias).toEqual([]);
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('rejects on errors', (done) => {
      // Our client.user_media_recent just returns an error
      const user_media_recent_fail = (user_id, options, callback) => {
        callback(Error('boom'));
      };
      spyOn(client, 'user_media_recent').and.callFake(user_media_recent_fail);
      user.getRecentMedias(mock_user.id, { count: 3 }).catch((err) => {
        expect(client.user_media_recent.calls.argsFor(0)[0]).toEqual(mock_user.id);
        expect(err.message).toEqual('boom');
        done();
      });
    });
  });

  describe('instagram.user.forEachRecentMedias', () => {
    const requested_count = 4;

    // This fake getRecentMedias will first return a page with 2 empty
    // medias, then a page with the rest (requested_count).
    const getRecentMedias = () => {
      const medias = helpers.fillArray(requested_count, 'index');
      medias[medias.length - 1].type = 'video';
      return Promise.resolve({
        medias: medias.slice(0, 2),
        next: Promise.resolve({
          medias: medias.slice(2),
          next: false,
        }),
      });
    };

    // This callback will return a promise that will resolve to the index
    // of the media it is passed, after waiting an amount of time inverse
    // to that index. It will also push that index to a side effect var.
    // The rationale here is that if the callbacks are called sequentially,
    // it won't matter how long each promise will take, they will all be
    // resolved in order. If the callbacks are called in parallel, the
    // the order will be reversed, since the first media will resolve last.
    const callbackTimeout = (side_effect, media) => new Promise((resolve) => {
      setTimeout(() => {
        side_effect.push(media.index);
        resolve(media.index);
      }, (requested_count - 1 - media.index) * 3);
    });

    // This callback will return a promise that will reject with an error,
    // after waiting an amount of time inverse to the media index.
    const callbackTimeoutError = (side_effect, media) => new Promise((resolve, reject) => {
      setTimeout(() => {
        side_effect.push(media.index);
        reject(Error('boom'));
      }, (requested_count - 1 - media.index) * 3);
    });

    let getRecentMediasSpy;
    let callbackSpy;

    beforeEach(() => {
      spyOn(core.logger, 'log');
      getRecentMediasSpy = spyOn(user, 'getRecentMedias');
      callbackSpy = jasmine.createSpy('callbackSpy');

      // The default, working mock workflow
      getRecentMediasSpy.and.callFake(getRecentMedias);
    });

    it('iterates over medias in parallel (wo/ videos)', (done) => {
      const side_effect = [];
      callbackSpy.and.callFake(callbackTimeout.bind(null, side_effect));
      const options = {
        count: requested_count,
        includeVideos: false,
      };
      user.forEachRecentMedias(
        mock_user.id,
        options,
        callbackSpy
      ).then((output) => {
        const actual_total = requested_count - 1; // skip video
        expect(getRecentMediasSpy).toHaveBeenCalledWith(mock_user.id, options);
        expect(callbackSpy.calls.count()).toEqual(actual_total);
        expect(callbackSpy.calls.argsFor(0)).toEqual(
          [{ index: 0 }, options]);
        expect(callbackSpy.calls.argsFor(actual_total - 1)).toEqual(
          [{ index: actual_total - 1 }, options]);
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
        const indices = helpers.fillArray(actual_total, true);
        expect(output).toEqual(indices);
        expect(side_effect).toEqual(indices.reverse());
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('iterates over medias sequentially (wo/ videos)', (done) => {
      const side_effect = [];
      callbackSpy.and.callFake(callbackTimeout.bind(null, side_effect));
      const options = {
        count: requested_count,
        sequential: true,
        includeVideos: false,
      };
      user.forEachRecentMedias(
        mock_user.id,
        options,
        callbackSpy
      ).then((output) => {
        const actual_total = requested_count - 1; // skip video
        expect(getRecentMediasSpy).toHaveBeenCalledWith(mock_user.id, options);
        expect(callbackSpy.calls.count()).toEqual(actual_total);
        expect(callbackSpy.calls.argsFor(0)).toEqual(
          [{ index: 0 }, options]);
        expect(callbackSpy.calls.argsFor(actual_total - 1)).toEqual(
          [{ index: actual_total - 1 }, options]);
        expect(strip_ansi(core.logger.log.calls.argsFor(0)[0])).toEqual(
          'Skipped');
        expect(strip_ansi(core.logger.log.calls.argsFor(0)[1])).toEqual(
          (requested_count - actual_total).toString());
        expect(strip_ansi(core.logger.log.calls.argsFor(1)[0])).toEqual(
          'Done iterating over');
        expect(strip_ansi(core.logger.log.calls.argsFor(1)[1])).toEqual(
          actual_total.toString());
        // No matter how long each promise took, the resulting array of indices
        // should be in order. The side effect const should be in order as well,
        // because we should be executing sequentially.
        const indices = helpers.fillArray(actual_total, true);
        expect(output).toEqual(indices);
        expect(side_effect).toEqual(indices);
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('rejects on getting a recent medias error', (done) => {
      getRecentMediasSpy.and.callFake(helpers.promiseRejectError);
      user.forEachRecentMedias(mock_user.id, {}).then(() => {
        done.fail(new Error('should not have succeeded'));
      }, (err) => {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on getting an error in parallel (w/ videos)', (done) => {
      const side_effect = [];
      callbackSpy.and.callFake(callbackTimeoutError.bind(null, side_effect));
      const options = {
        count: requested_count,
        includeVideos: true,
      };
      user.forEachRecentMedias(
        mock_user.id,
        options,
        callbackSpy
      ).then((output) => {
        done.fail(output); // we should not fail collecting all the promises
      }, (err) => {
        // In parallel mode, everything should execute separately; the failure
        // of one promise should not stop the whole process:
        //   - the callback should have been called for each media,
        //   - the side effect const should reflect that the promise of the last
        //     index should reject first (it had the shortest delay).
        expect(callbackSpy.calls.count()).toEqual(requested_count);
        expect(side_effect).toEqual([requested_count - 1]);
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on getting an error sequentially (w/ videos)', (done) => {
      const side_effect = [];
      callbackSpy.and.callFake(callbackTimeoutError.bind(null, side_effect));
      const options = {
        count: requested_count,
        sequential: true,
        includeVideos: true,
      };
      user.forEachRecentMedias(
        mock_user.id,
        options,
        callbackSpy
      ).then((res) => {
        done.fail(res); // we should not fail chaining all the promises
      }, (err) => {
        // In sequential mode, everything should execute in sequence; the
        // failure of one promise should stop the whole process:
        //   - the callback should have been called for one media,
        //   - the side effect const should reflect that the promise of the first
        //     index should reject first (even if it had the longest delay).
        expect(callbackSpy.calls.count()).toEqual(1);
        expect(side_effect).toEqual([0]);
        expect(err.message).toEqual('boom');
        done();
      });
    });
  });
});
