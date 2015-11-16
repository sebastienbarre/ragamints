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

    it('returns the canonical form of a valid media url', function() {
      expect(isMediaUrl(mediaData.image.json.link)).toBe(
        mediaData.image.json.link);
    });

    it('returns false if a media url is invalid', function() {
      expect(isMediaUrl(mediaData.image.json.id)).not.toBe(true);
    });
  });

  describe('resolveMediaId', function() {
    var instagram = media.__get__('instagram');
    var resolveMediaId = media.__get__('resolveMediaId');

    it('resolves a media id to itself', function(done) {
      spyOn(instagram, 'oembed');
      resolveMediaId(mediaData.image.json.id).then(function(media_id) {
        expect(instagram.oembed).not.toHaveBeenCalled();
        expect(media_id).toEqual(mediaData.image.json.id);
        done();
      });
    });

    it('rejects when the media url is invalid', function(done) {
      spyOn(instagram, 'oembed');
      resolveMediaId('foo').catch(function(err) {
        expect(instagram.oembed).not.toHaveBeenCalled();
        expect(err.message).toEqual(
          logger.formatErrorMessage('foo is not a valid media url'));
        done();
      });
    });

    it('resolves a media url to a media id', function(done) {
      var mock_oembed = {
        media_id: mediaData.image.json.id
      };
      spyOn(instagram, 'oembed').and.callFake(function() {
        return Promise.resolve(mock_oembed);
      });
      spyOn(logger, 'log');
      resolveMediaId(mediaData.image.json.link).then(function(media_id) {
        expect(instagram.oembed).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalled();
        expect(media_id).toEqual(mediaData.image.json.id);
        done();
      }, function(err) {
        done.fail(err);
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
