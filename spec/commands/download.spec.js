const assign = require('lodash/assign');
const get = require('lodash/get');
const set = require('lodash/set');
const path = require('path');
const Promise = require('es6-promise').Promise;
const rewire = require('rewire');

const exiftoolData = require('../data/exiftool');
const mediaData = require('../data/media');

const helpers = require('../support/helpers');

const download_cmd = rewire('../../lib/commands/download.js');

describe('commands.download', () => {
  const core = download_cmd.__get__('core');
  const instagram = download_cmd.__get__('instagram');

  describe('commands.download.getExifToolArgs', () => {
    const getExifToolArgs = download_cmd.__get__('getExifToolArgs');

    beforeEach(() => {
      spyOn(instagram.media, 'log');
    });

    it('gathers args for exiftool and uses GPS location', () => {
      expect(getExifToolArgs(
        mediaData.image.standard, { verbose: true })
      ).toEqual(exiftoolData.image.standard);
      expect(getExifToolArgs(
        mediaData.image.high)
      ).toEqual(exiftoolData.image.high);
      expect(instagram.media.log.calls.count()).toEqual(2);
    });

    it('gathers args for exiftool and assumes local when no GPS', () => {
      expect(
        getExifToolArgs(mediaData.image.no_gps, { verbose: true })
      ).toEqual(exiftoolData.image.no_gps);
      expect(instagram.media.log.calls.count()).toEqual(2);
    });
  });

  describe('commands.download.updateFileMetadata', () => {
    const updateFileMetadata = download_cmd.__get__('updateFileMetadata');
    const exiftool_process = {
      on: (event, callback) => {
        if (event === 'close') {
          callback();
        }
      },
      stderr: {
        on: () => {},
      },
    };

    beforeEach(() => {
      spyOn(instagram.media, 'log');
    });

    it('does not update metadata for video media', (done) => {
      updateFileMetadata(mediaData.video, 'foo.jpg', {}).then((res) => {
        expect(res).toBe(false);
        done();
      });
    });

    it('spawns a child process to invoke exiftool', (done) => {
      const child_process = download_cmd.__get__('child_process');
      spyOn(child_process, 'spawn').and.returnValue(exiftool_process);
      updateFileMetadata(
        mediaData.image.standard, 'foo', {}
      ).then((res) => {
        const args = exiftoolData.image.standard.concat(['foo']);
        expect(child_process.spawn).toHaveBeenCalledWith('exiftool', args);
        expect(res).toBe(true);
        expect(instagram.media.log).toHaveBeenCalled();
        done();
      });
    });

    it('rejects on error', (done) => {
      const process = assign({}, exiftool_process);
      process.on = (event, callback) => {
        if (event === 'error') {
          callback(Error('boom'));
        }
      };
      const child_process = download_cmd.__get__('child_process');
      spyOn(child_process, 'spawn').and.returnValue(process);
      updateFileMetadata(
        mediaData.image.standard, 'foo', { quiet: true }
      ).then(() => {
        done.fail();
      }).catch((err) => {
        expect(child_process.spawn).toHaveBeenCalled();
        expect(err.message).toBe(
          core.logger.formatErrorMessage('Can not spawn exiftool (boom)'));
        done();
      });
    });

    it('rejects on stderr data', (done) => {
      const process = assign({}, exiftool_process);
      process.stderr.on = (event, callback) => {
        if (event === 'data') {
          callback('boom');
        }
      };
      const child_process = download_cmd.__get__('child_process');
      spyOn(child_process, 'spawn').and.returnValue(process);
      updateFileMetadata(
        mediaData.image.standard, 'foo', { quiet: true }
      ).catch((err) => {
        expect(child_process.spawn).toHaveBeenCalled();
        expect(err.message).toBe(core.logger.formatErrorMessage('boom'));
        done();
      });
    });
  });

  describe('commands.download.fetchMedia', () => {
    const fetchMedia = download_cmd.__get__('fetchMedia');
    const getMediaBasenameForResolution = download_cmd.__get__('getMediaBasenameForResolution');
    const fs = download_cmd.__get__('fs');
    const stats_is_file = {
      isFile: () => true,
    };
    const lstat_file_exists = (filename, callback) => {
      callback(null, stats_is_file);
    };
    const lstat_file_does_not_exist = (filename, callback) => {
      callback(true, stats_is_file);
    };
    const downloadStub = () => {
      let temp_basename;
      let temp_dest;
      return {
        get: () => this,
        dest: (dest) => {
          temp_dest = dest;
          return this;
        },
        rename: (basename) => {
          temp_basename = basename;
          return this;
        },
        run: (callback) => {
          callback(null, [{ path: path.join(temp_dest, temp_basename) }]);
        },
      };
    };
    let DownloadSpy;

    beforeEach(() => {
      spyOn(instagram.media, 'log');
      DownloadSpy = jasmine.createSpy('Download').and.callFake(downloadStub);
      download_cmd.__set__('Download', DownloadSpy);
    });

    it('skips if the file is already there', (done) => {
      spyOn(fs, 'lstat').and.callFake(lstat_file_exists);
      fetchMedia(mediaData.image.standard).then((filename) => {
        expect(DownloadSpy).not.toHaveBeenCalled();
        expect(instagram.media.log).toHaveBeenCalled();
        const basename = getMediaBasenameForResolution(mediaData.image.standard);
        expect(filename).toBe(basename);
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('fetches a media', (done) => {
      spyOn(fs, 'lstat').and.callFake(lstat_file_does_not_exist);
      const dest = 'foo';
      fetchMedia(
        mediaData.image.standard,
        instagram.constants.RESOLUTIONS.standard,
        { dest }
      ).then((filename) => {
        expect(DownloadSpy).toHaveBeenCalled();
        expect(instagram.media.log).toHaveBeenCalled();
        const basename = getMediaBasenameForResolution(
          mediaData.image.standard, instagram.constants.RESOLUTIONS.standard);
        const media_filename = path.join(dest, basename);
        expect(filename).toBe(media_filename);
        done();
      });
    });

    it('fetches a media even if it exists when forcing', (done) => {
      spyOn(fs, 'lstat').and.callFake(lstat_file_exists);
      fetchMedia(
        mediaData.video.standard, undefined, { alwaysDownload: true }
      ).then((filename) => {
        expect(DownloadSpy).toHaveBeenCalled();
        expect(instagram.media.log).toHaveBeenCalled();
        const basename = getMediaBasenameForResolution(mediaData.video.standard);
        expect(filename).toBe(basename);
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('rejects if fetching failed', (done) => {
      spyOn(fs, 'lstat').and.callFake(lstat_file_does_not_exist);
      const Download_fail = () => {
        const d = downloadStub();
        d.run = (callback) => {
          callback(Error('boom'));
        };
        return d;
      };
      DownloadSpy = jasmine.createSpy('Download').and.callFake(Download_fail);
      download_cmd.__set__('Download', DownloadSpy);
      fetchMedia(mediaData.image.standard).catch((err) => {
        expect(DownloadSpy).toHaveBeenCalled();
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects if resolution is not found in media object', (done) => {
      spyOn(fs, 'lstat').and.callFake(lstat_file_does_not_exist);
      DownloadSpy = jasmine.createSpy('Download');
      download_cmd.__set__('Download', DownloadSpy);
      fetchMedia(
        mediaData.video.standard, 'foobar', {}
      ).catch((err) => {
        expect(fs.lstat).not.toHaveBeenCalled();
        expect(DownloadSpy).not.toHaveBeenCalled();
        expect(err.message).toEqual(
          core.logger.formatErrorMessage('Can not find resolution: foobar'));
        done();
      });
    });
  });

  describe('commands.download.saveMediaObject', () => {
    const saveMediaObject = download_cmd.__get__('saveMediaObject');
    const getMediaObjectBasename =
      download_cmd.__get__('getMediaObjectBasename');
    const fs = download_cmd.__get__('fs');
    let mkdirp_spy;
    const writeFile_success = (filename, data, callback) => {
      callback();
    };
    const writeFile_fail = (filename, data, callback) => {
      callback(Error('boom'));
    };
    const mkdirp_success = (dest, callback) => {
      callback();
    };
    const mkdirp_fail = (dest, callback) => {
      callback(Error('boom2'));
    };

    beforeEach(() => {
      spyOn(instagram.media, 'log');
    });

    it('saves a media object', (done) => {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_success);
      download_cmd.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_success);
      const dest = 'foo';
      const basename = getMediaObjectBasename(mediaData.image.standard);
      const media_filename = path.join(dest, basename);
      saveMediaObject(mediaData.image.standard, { dest }).then((filename) => {
        const data = JSON.stringify(mediaData.image.standard, null, 2);
        expect(mkdirp_spy.calls.argsFor(0)[0]).toEqual(dest);
        expect(fs.writeFile.calls.argsFor(0)[1]).toEqual(data);
        expect(instagram.media.log).toHaveBeenCalled();
        expect(filename).toBe(media_filename);
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('saves a media object filtered by keys', (done) => {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_success);
      download_cmd.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_success);
      const dest = 'foo';
      const basename = getMediaObjectBasename(mediaData.image.standard);
      const media_filename = path.join(dest, basename);
      const keys = ['id', 'caption.created_time', '__foobar__'];
      saveMediaObject(mediaData.image.standard, { dest, json: keys }).then((filename) => {
        const filtered_media = {};
        set(
          filtered_media,
          'id',
          get(mediaData.image.standard, 'id'));
        set(
          filtered_media,
          'caption.created_time',
          get(mediaData.image.standard, 'caption.created_time'));
        const data = JSON.stringify(filtered_media, null, 2);
        expect(mkdirp_spy.calls.argsFor(0)[0]).toEqual(dest);
        expect(fs.writeFile.calls.argsFor(0)[1]).toEqual(data);
        expect(instagram.media.log).toHaveBeenCalled();
        expect(filename).toBe(media_filename);
        done();
      });
    });

    it('rejects if creating destination directory failed', (done) => {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_fail);
      download_cmd.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_success);
      const dest = 'foo';
      saveMediaObject(mediaData.image.standard, { dest }).catch((err) => {
        expect(mkdirp_spy.calls.argsFor(0)[0]).toEqual(dest);
        expect(fs.writeFile).not.toHaveBeenCalled();
        expect(err.message).toEqual('boom2');
        done();
      });
    });

    it('rejects if saving failed', (done) => {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_success);
      download_cmd.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_fail);
      saveMediaObject(mediaData.image.standard, {
      }).catch((err) => {
        expect(fs.writeFile).toHaveBeenCalled();
        expect(err.message).toEqual('boom');
        done();
      });
    });
  });

  describe('commands.download.resolveOptions', () => {
    const resolveOptions = download_cmd.__get__('resolveOptions');

    beforeEach(() => {
      spyOn(core.logger, 'log');
      spyOn(instagram.user, 'resolveOptions');
      spyOn(instagram.user, 'resolveUserId').and.callFake(
        helpers.promiseValue.bind(null, '12345678'));
      spyOn(instagram.media, 'resolveMediaId').and.callFake(
        helpers.promiseValue.bind(null, mediaData.image.standard.id));
    });

    it('resolves options', (done) => {
      const options = {
        instagramAccessToken: 'token',
        instagramUserId: 'username',
        json: 'foo,bar',
        maxId: mediaData.image.standard.link,
        minId: mediaData.image.standard.link,
        resolution: 'thumbnail,low_resolution',
        verbose: true,
      };
      const resolved_options = {
        instagramAccessToken: 'token',
        instagramUserId: '12345678',
        json: ['foo', 'bar'],
        maxId: mediaData.image.standard.id,
        minId: mediaData.image.standard.id,
        resolution: [
          instagram.constants.RESOLUTIONS.thumbnail,
          instagram.constants.RESOLUTIONS.low,
        ],
        verbose: true,
      };
      resolveOptions(options).then((res) => {
        const link = mediaData.image.standard.link;
        expect(instagram.user.resolveOptions).toHaveBeenCalled();
        expect(instagram.user.resolveUserId.calls.argsFor(0)).toEqual(
          ['username']);
        expect(instagram.media.resolveMediaId.calls.argsFor(0)[0]).toEqual(
          link);
        expect(instagram.media.resolveMediaId.calls.argsFor(1)[0]).toEqual(
          link);
        expect(res).toEqual(resolved_options);
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('rejects when no user id is found', (done) => {
      resolveOptions({}).then(() => {
        done.fail(new Error('should not have succeeded'));
      }, (err) => {
        expect(err.message).toEqual(
          core.logger.formatErrorMessage('Need Instagram user ID/name'));
        done();
      });
    });
  });

  describe('commands.download.run', () => {
    const pageTotal = 3;
    const medias = helpers.fillArray(pageTotal, false, mediaData.image.standard);
    medias[pageTotal - 1] = mediaData.video.standard; // last one is a video

    // This fake getRecentMedias will first return a page with 2 empty
    // medias, then a page with the rest (pageTotal).
    const getRecentMedias = () => Promise.resolve({
      medias: medias.slice(0, 2),
      next: Promise.resolve({
        medias: medias.slice(2),
        next: false,
      }),
    });

    let resolveOptionsSpy;
    let getRecentMediasSpy;
    let forEachRecentMediasSpy;
    let fetchMediaSpy;
    let updateFileMetadataSpy;
    let saveMediaObjectSpy;

    beforeEach(() => {
      spyOn(core.logger, 'log');
      resolveOptionsSpy = jasmine.createSpy('resolveOptions');
      download_cmd.__set__('resolveOptions', resolveOptionsSpy);
      forEachRecentMediasSpy = spyOn(instagram.user, 'forEachRecentMedias');
      getRecentMediasSpy = spyOn(instagram.user, 'getRecentMedias');
      fetchMediaSpy = jasmine.createSpy('fetchMedia');
      download_cmd.__set__('fetchMedia', fetchMediaSpy);
      updateFileMetadataSpy = jasmine.createSpy('updateFileMetadata');
      download_cmd.__set__('updateFileMetadata', updateFileMetadataSpy);
      saveMediaObjectSpy = jasmine.createSpy('saveMediaObject');
      download_cmd.__set__('saveMediaObject', saveMediaObjectSpy);

      // The default, working mock workflow
      resolveOptionsSpy.and.callFake(helpers.promiseValue);
      forEachRecentMediasSpy.and.callThrough();
      getRecentMediasSpy.and.callFake(getRecentMedias);
      fetchMediaSpy.and.callFake(helpers.promiseValue.bind(null, 'foo'));
      updateFileMetadataSpy.and.callFake(helpers.promiseValue);
      saveMediaObjectSpy.and.callFake(helpers.promiseValue);
    });

    it('resolves options & processes medias (wo/ videos)', (done) => {
      const options = {
        instagramUserId: '12345678',
        json: true,
      };
      download_cmd.run(options).then((res) => {
        const processed_count = pageTotal - 1; // except the video
        expect(resolveOptionsSpy).toHaveBeenCalledWith(options);
        expect(forEachRecentMediasSpy.calls.argsFor(0)[0]).toEqual(
          options.instagramUserId);
        expect(forEachRecentMediasSpy.calls.argsFor(0)[1]).toEqual(options);
        expect(fetchMediaSpy.calls.argsFor(0)).toEqual(
          [mediaData.image.standard, undefined, options]);
        expect(fetchMediaSpy.calls.count()).toEqual(processed_count);
        expect(updateFileMetadataSpy.calls.argsFor(0)).toEqual(
          [mediaData.image.standard, 'foo', options]);
        expect(updateFileMetadataSpy.calls.count()).toEqual(processed_count);
        expect(saveMediaObjectSpy.calls.argsFor(0)).toEqual(
          [mediaData.image.standard, options]);
        expect(saveMediaObjectSpy.calls.count()).toEqual(processed_count);
        expect(res).toEqual(medias.slice(0, processed_count));
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('de-duplicates resolutions before processing medias', (done) => {
      const options = {
        instagramUserId: '12345678',
        // the high_resolution here points to the standard, because
        // the media was created before Insta introduced the 1080 res
        resolution: [
          instagram.constants.RESOLUTIONS.high,
          instagram.constants.RESOLUTIONS.standard,
        ],
      };
      download_cmd.run(options).then((res) => {
        const processed_count = pageTotal - 1; // except the video & de-dup
        expect(resolveOptionsSpy).toHaveBeenCalledWith(options);
        expect(forEachRecentMediasSpy.calls.argsFor(0)[0]).toEqual(
          options.instagramUserId);
        expect(forEachRecentMediasSpy.calls.argsFor(0)[1]).toEqual(options);
        expect(fetchMediaSpy.calls.argsFor(0)).toEqual([
          mediaData.image.standard,
          instagram.constants.RESOLUTIONS.standard,
          options,
        ]);
        expect(fetchMediaSpy.calls.count()).toEqual(processed_count);
        expect(updateFileMetadataSpy.calls.argsFor(0)).toEqual(
          [mediaData.image.standard, 'foo', options]);
        expect(updateFileMetadataSpy.calls.count()).toEqual(processed_count);
        expect(res).toEqual(medias.slice(0, processed_count));
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('rejects on error while resolving options', (done) => {
      resolveOptionsSpy.and.callFake(helpers.promiseRejectError);
      download_cmd.run({}).then(() => {
        done.fail(new Error('should not have succeeded'));
      }, (err) => {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while iterating over medias', (done) => {
      forEachRecentMediasSpy.and.callFake(helpers.promiseRejectError);
      download_cmd.run({}).then(() => {
        done.fail(new Error('should not have succeeded'));
      }, (err) => {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while fetching media', (done) => {
      fetchMediaSpy.and.callFake(helpers.promiseRejectError);
      download_cmd.run({}).then(() => {
        done.fail(new Error('should not have succeeded'));
      }, (err) => {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while updating metadata', (done) => {
      updateFileMetadataSpy.and.callFake(helpers.promiseRejectError);
      download_cmd.run({}).then(() => {
        done.fail(new Error('should not have succeeded'));
      }, (err) => {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while saving JSON object', (done) => {
      saveMediaObjectSpy.and.callFake(helpers.promiseRejectError);
      const options = {
        json: true,
      };
      download_cmd.run(options).then(() => {
        done.fail(new Error('should not have succeeded'));
      }, (err) => {
        expect(err.message).toEqual('boom');
        done();
      });
    });
  });
});
