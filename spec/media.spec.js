'use strict';

var _assign      = require('lodash/object/assign');
var Promise      = require('es6-promise').Promise;
var rewire       = require('rewire');
var strip_ansi   = require('strip-ansi');

var mediaData    = require('./data/media');

var media        = rewire('../lib/media.js');

describe('media', function() {
  var logger = media.__get__('logger');

  describe('isMediaId', function() {
    var isMediaId = media.__get__('isMediaId');

    it('checks if a media id is valid', function() {
      expect(isMediaId(mediaData.image.json.id)).toBe(true);
    });

    it('checks if a media id is invalid', function() {
      expect(isMediaId(mediaData.image.json.link)).not.toBe(true);
    });
  });

  describe('isMediaUrl', function() {
    var isMediaUrl = media.__get__('isMediaUrl');

    it('checks if a media url is valid', function() {
      expect(isMediaUrl(mediaData.image.json.link)).toBe(true);
    });

    it('checks if a media url is invalid', function() {
      expect(isMediaUrl(mediaData.image.json.id)).not.toBe(true);
    });
  });

  describe('resolveMediaId', function() {
    var resolveMediaId = media.__get__('resolveMediaId');
    var fetch_spy;

    it('resolves a media id to itself', function(done) {
      fetch_spy = jasmine.createSpy('fetch');
      media.__set__('fetch', fetch_spy);
      resolveMediaId(mediaData.image.json.id).then(function(media_id) {
        expect(fetch_spy.calls.any()).toEqual(false);
        expect(media_id).toEqual(mediaData.image.json.id);
        done();
      });
    });

    it('resolves a media url', function(done) {
      var fetch = function() {
        return Promise.resolve({
          ok: true,
          json: function() {
            return {media_id: mediaData.image.json.id};
          }
        });
      };
      fetch_spy = jasmine.createSpy('fetch').and.callFake(fetch);
      media.__set__('fetch', fetch_spy);
      spyOn(logger, 'log');
      resolveMediaId(mediaData.image.json.link).then(function(media_id) {
        expect(fetch_spy).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalled();
        expect(media_id).toEqual(mediaData.image.json.id);
        done();
      });
    });

    it('rejects on error', function(done) {
      var fetch = function() {
        return Promise.resolve({
          ok: false
        });
      };
      fetch_spy = jasmine.createSpy('fetch').and.callFake(fetch);
      media.__set__('fetch', fetch_spy);
      let link = mediaData.image.json.link;
      resolveMediaId(link).catch(function(err) {
        expect(fetch_spy).toHaveBeenCalled();
        expect(err.message).toEqual(
          logger.formatErrorMessage(
            `Could not retrieve Media Id for: ${link}`));
        done();
      });
    });
  });

  describe('createMediaFileName', function() {
    var createMediaFileName = media.__get__('createMediaFileName');

    it('creates a file name for the fetched file to be saved as', function() {
      expect(
        createMediaFileName(mediaData.image.json)
      ).toBe(
        mediaData.image.fileName
      );
    });
  });

  describe('log', function() {
    var log = media.__get__('log');

    beforeEach(function() {
      spyOn(logger, 'log');
    });

    it('logs message w/ respect to a media', function() {
      var prefix = '#0001 [Back home. #foo #o]';
      var msg = 'logging';
      log(mediaData.image.json, msg);
      expect(strip_ansi(logger.log.calls.argsFor(0)[0])).toEqual(prefix);
      expect(strip_ansi(logger.log.calls.argsFor(0)[1])).toEqual(msg);
    });

    it('logs message w/ respect to a media w/o caption or msg', function() {
      var media_wo_caption = _assign({}, mediaData.image.json);
      delete media_wo_caption.caption;
      log(media_wo_caption);
      var msg = '#0001 [977398127825095465]';
      expect(strip_ansi(logger.log.calls.argsFor(0)[0])).toEqual(msg);
    });
  });

});
