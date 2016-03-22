'use strict';

var _assign    = require('lodash/assign');
var Promise    = require('es6-promise').Promise;
var rewire     = require('rewire');
var strip_ansi = require('strip-ansi');

var mediaData  = require('../data/media');

var media      = rewire('../../lib/instagram/media.js');

describe('instagram.media', function() {
  var core = media.__get__('core');

  describe('instagram.media.isMediaId', function() {

    it('checks if a media id is valid', function() {
      expect(media.isMediaId(mediaData.image.standard.id)).toBe(true);
    });

    it('checks if a media id is invalid', function() {
      expect(media.isMediaId(mediaData.image.standard.link)).not.toBe(true);
    });
  });

  describe('instagram.media.isMediaUrl', function() {

    it('returns the canonical form of a valid media url', function() {
      expect(media.isMediaUrl(mediaData.image.standard.link)).toBe(
        mediaData.image.standard.link);
    });

    it('returns false if a media url is invalid', function() {
      expect(media.isMediaUrl(mediaData.image.standard.id)).not.toBe(true);
    });
  });

  describe('instagram.media.resolveMediaId', function() {
    var client = media.__get__('client');

    it('resolves a media id to itself', function(done) {
      spyOn(client, 'oembed');
      media.resolveMediaId(mediaData.image.standard.id)
      .then(function(media_id) {
        expect(client.oembed).not.toHaveBeenCalled();
        expect(media_id).toEqual(mediaData.image.standard.id);
        done();
      });
    });

    it('rejects when the media url is invalid', function(done) {
      spyOn(client, 'oembed');
      media.resolveMediaId('foo').catch(function(err) {
        expect(client.oembed).not.toHaveBeenCalled();
        expect(err.message).toEqual(
          core.logger.formatErrorMessage(
            'foo is not a valid Instagram media url'));
        done();
      });
    });

    it('resolves a media url to a media id', function(done) {
      var mock_oembed = {
        media_id: mediaData.image.standard.id
      };
      spyOn(client, 'oembed').and.callFake(function() {
        return Promise.resolve(mock_oembed);
      });
      spyOn(core.logger, 'log');
      media.resolveMediaId(mediaData.image.standard.link)
      .then(function(media_id) {
        expect(client.oembed).toHaveBeenCalled();
        expect(core.logger.log).toHaveBeenCalled();
        expect(media_id).toEqual(mediaData.image.standard.id);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

  });

  describe('instagram.media.createMediaFileName', function() {

    it('creates a file name for the fetched file to be saved as', function() {
      expect(media.createMediaFileName(mediaData.image.standard)).toBe(
        '2015-05-30_1433025688');
    });
  });

  describe('instagram.media.log', function() {

    beforeEach(function() {
      spyOn(core.logger, 'log');
    });

    it('logs message w/ respect to a media', function() {
      var prefix = '[Flower girl is pic]';
      var msg = 'logging';
      media.log(mediaData.image.standard, msg);
      expect(strip_ansi(core.logger.log.calls.argsFor(0)[0])).toEqual(prefix);
      expect(strip_ansi(core.logger.log.calls.argsFor(0)[1])).toEqual(msg);
    });

    it('logs message w/ respect to a media w/o caption or msg', function() {
      var media_wo_caption = _assign({}, mediaData.image.standard);
      delete media_wo_caption.caption;
      media.log(media_wo_caption);
      var msg = '[996614167159212902]';
      expect(strip_ansi(core.logger.log.calls.argsFor(0)[0])).toEqual(msg);
    });
  });

});
