const assign = require('lodash/assign');
const Promise = require('es6-promise').Promise;
const rewire = require('rewire');
const strip_ansi = require('strip-ansi');

const mediaData = require('../data/media');

const media = rewire('../../lib/instagram/media.js');

describe('instagram.media', () => {
  const core = media.__get__('core');
  describe('instagram.media.isMediaId', () => {
    it('checks if a media id is valid', () => {
      expect(media.isMediaId(mediaData.image.standard.id)).toBe(true);
    });

    it('checks if a media id is invalid', () => {
      expect(media.isMediaId(mediaData.image.standard.link)).not.toBe(true);
    });
  });

  describe('instagram.media.isMediaUrl', () => {
    it('returns the canonical form of a valid media url', () => {
      expect(media.isMediaUrl(mediaData.image.standard.link)).toBe(
        mediaData.image.standard.link);
    });

    it('returns false if a media url is invalid', () => {
      expect(media.isMediaUrl(mediaData.image.standard.id)).not.toBe(true);
    });
  });

  describe('instagram.media.resolveMediaId', () => {
    const client = media.__get__('client');

    it('resolves a media id to itself', (done) => {
      spyOn(client, 'oembed');
      media.resolveMediaId(mediaData.image.standard.id)
      .then((media_id) => {
        expect(client.oembed).not.toHaveBeenCalled();
        expect(media_id).toEqual(mediaData.image.standard.id);
        done();
      });
    });

    it('rejects when the media url is invalid', (done) => {
      spyOn(client, 'oembed');
      media.resolveMediaId('foo').catch((err) => {
        expect(client.oembed).not.toHaveBeenCalled();
        expect(err.message).toEqual(
          core.logger.formatErrorMessage(
            'foo is not a valid Instagram media url'));
        done();
      });
    });

    it('resolves a media url to a media id', (done) => {
      const mock_oembed = {
        media_id: mediaData.image.standard.id,
      };
      spyOn(client, 'oembed').and.callFake(() => Promise.resolve(mock_oembed));
      spyOn(core.logger, 'log');
      media.resolveMediaId(mediaData.image.standard.link)
      .then((media_id) => {
        expect(client.oembed).toHaveBeenCalled();
        expect(core.logger.log).toHaveBeenCalled();
        expect(media_id).toEqual(mediaData.image.standard.id);
        done();
      }, (err) => {
        done.fail(err);
      });
    });
  });

  describe('instagram.media.createMediaFileName', () => {
    it('creates a file name for the fetched file to be saved as', () => {
      expect(media.createMediaFileName(mediaData.image.standard)).toBe(
        '2015-05-30_1433025688');
    });
  });

  describe('instagram.media.log', () => {
    beforeEach(() => {
      spyOn(core.logger, 'log');
    });

    it('logs message w/ respect to a media', () => {
      const prefix = '[Flower girl is pic]';
      const msg = 'logging';
      media.log(mediaData.image.standard, msg);
      expect(strip_ansi(core.logger.log.calls.argsFor(0)[0])).toEqual(prefix);
      expect(strip_ansi(core.logger.log.calls.argsFor(0)[1])).toEqual(msg);
    });

    it('logs message w/ respect to a media w/o caption or msg', () => {
      const media_wo_caption = assign({}, mediaData.image.standard);
      delete media_wo_caption.caption;
      media.log(media_wo_caption);
      const msg = '[996614167159212902]';
      expect(strip_ansi(core.logger.log.calls.argsFor(0)[0])).toEqual(msg);
    });
  });
});
