'use strict';

var _assign      = require('lodash/object/assign');
var objectPath   = require('object-path');
var path         = require('path');
var Promise      = require('es6-promise').Promise;
var rewire       = require('rewire');
var strip_ansi   = require('strip-ansi');

var constants    = require('../lib/constants');

var exiftoolData = require('./data/exiftool');
var mediaData    = require('./data/media');

var helpers      = require('./support/helpers');

var cli          = rewire('../lib/cli.js');
var media        = rewire('../lib/media.js');
var user         = rewire('../lib/user.js');

describe('cli', function() {
  var ig = cli.__get__('ig');
  var logger = cli.__get__('logger');
  cli.__set__('user', user);
  cli.__set__('media', media);

  describe('getExifToolArgs', function() {
    var getExifToolArgs = cli.__get__('getExifToolArgs');

    beforeEach(function() {
      spyOn(media, 'log');
    });

    it('gathers args for exiftool and uses GPS location', function() {
      expect(getExifToolArgs(mediaData.image.json, {verbose: true})).toEqual(
        exiftoolData.args);
      expect(media.log.calls.count()).toEqual(2);
    });

    it('gathers args for exiftool and assumes local when no GPS', function() {
      expect(
        getExifToolArgs(mediaData.imageWithoutGPS.json, {verbose: true})
      ).toEqual(
        exiftoolData.argsWithoutGPS
      );
      expect(media.log.calls.count()).toEqual(2);
    });
  });

  describe('updateFileMetadata', function() {
    var updateFileMetadata = cli.__get__('updateFileMetadata');
    var exiftool_process = {
      on: function(event, callback) {
        if (event === 'close') {
          callback();
        }
      },
      stderr: {
        on: function() {}
      }
    };

    beforeEach(function() {
      spyOn(media, 'log');
    });

    it('does not update metadata for video media', function(done) {
      var video = {
        type: 'video'
      };
      updateFileMetadata(mediaData.video, 'foo.jpg', {}).then(function(res) {
        expect(res).toBe(false);
        done();
      });
    });

    it('spawns a child process to invoke exiftool', function(done) {
      var child_process = cli.__get__('child_process');
      spyOn(child_process, 'spawn').and.returnValue(exiftool_process);
      updateFileMetadata(
        mediaData.image.json, mediaData.image.basename, {}
      ).then(function(res) {
        var args = exiftoolData.args.concat([mediaData.image.basename]);
        expect(child_process.spawn).toHaveBeenCalledWith('exiftool', args);
        expect(res).toBe(true);
        expect(media.log).toHaveBeenCalled();
        done();
      });
    });

    it('rejects on error', function(done) {
      var process = _assign({}, exiftool_process);
      process.on = function(event, callback) {
        if (event === 'error') {
          callback(Error('boom'));
        }
      };
      var child_process = cli.__get__('child_process');
      spyOn(child_process, 'spawn').and.returnValue(process);
      updateFileMetadata(
        mediaData.image.json, mediaData.image.basename, {quiet: true}
      ).catch(function(err) {
        expect(child_process.spawn).toHaveBeenCalled();
        expect(err.message).toBe(
          logger.formatErrorMessage('Could not spawn exiftool (boom)'));
        done();
      });
    });

    it('rejects on stderr data', function(done) {
      var process = _assign({}, exiftool_process);
      process.stderr.on = function(event, callback) {
        if (event === 'data') {
          callback('boom');
        }
      };
      var child_process = cli.__get__('child_process');
      spyOn(child_process, 'spawn').and.returnValue(process);
      updateFileMetadata(
        mediaData.image.json, mediaData.image.basename, {quiet: true}
      ).catch(function(err) {
        expect(child_process.spawn).toHaveBeenCalled();
        expect(err.message).toBe(logger.formatErrorMessage('boom'));
        done();
      });
    });
  });

  describe('fetchMedia', function() {
    var fetchMedia = cli.__get__('fetchMedia');
    var fs = cli.__get__('fs');
    var stats_is_file = {
      isFile: function() {
        return true;
      }
    };
    var lstat_file_exists = function(filename, callback) {
      callback(null, stats_is_file);
    };
    var lstat_file_does_not_exist = function(filename, callback) {
      callback(true, stats_is_file);
    };
    var Download = function() {
      var _basename;
      var _dest;
      return {
        get: function() {
          return this;
        },
        dest: function(dest) {
          _dest = dest;
          return this;
        },
        rename: function(basename) {
          _basename = basename;
          return this;
        },
        run: function(callback) {
          callback(null, [{path: path.join(_dest, _basename)}]);
        }
      };
    };
    var DownloadSpy;

    beforeEach(function() {
      spyOn(media, 'log');
      DownloadSpy = jasmine.createSpy('Download').and.callFake(Download);
      cli.__set__('Download', DownloadSpy);
    });

    it('skips if the file is already there', function(done) {
      spyOn(fs, 'lstat').and.callFake(lstat_file_exists);
      fetchMedia(
        mediaData.image.json, mediaData.image.defaultResolution, {}
      ).then(function(filename) {
        expect(DownloadSpy.calls.any()).toEqual(false);
        expect(media.log).toHaveBeenCalled();
        expect(filename).toBe(mediaData.image.basename);
        done();
      });
    });

    it('fetches a media', function(done) {
      spyOn(fs, 'lstat').and.callFake(lstat_file_does_not_exist);
      var dest = 'foo';
      var media_filename = path.join(dest, mediaData.image.basename);
      fetchMedia(
        mediaData.image.json, mediaData.image.defaultResolution, {dest: dest}
      ).then(function(filename) {
        expect(DownloadSpy).toHaveBeenCalled();
        expect(media.log).toHaveBeenCalled();
        expect(filename).toBe(media_filename);
        done();
      });
    });

    it('fetches a media even if it exists when forcing', function(done) {
      spyOn(fs, 'lstat').and.callFake(lstat_file_exists);
      fetchMedia(
        mediaData.video.json,
        mediaData.image.defaultResolution,
        {
          alwaysDownload: true
        }
      ).then(function(filename) {
        expect(DownloadSpy).toHaveBeenCalled();
        expect(media.log).toHaveBeenCalled();
        expect(filename).toBe(mediaData.video.basename);
        done();
      });
    });

    it('rejects if fetching failed', function(done) {
      spyOn(fs, 'lstat').and.callFake(lstat_file_does_not_exist);
      var Download_fail = function() {
        var d = Download();
        d.run = function(callback) {
          callback(Error('boom'));
        };
        return d;
      };
      DownloadSpy = jasmine.createSpy('Download').and.callFake(Download_fail);
      cli.__set__('Download', DownloadSpy);
      fetchMedia(
        mediaData.image.json, mediaData.image.defaultResolution, {}
      ).catch(function(err) {
        expect(DownloadSpy).toHaveBeenCalled();
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects if resolution not found', function(done) {
      spyOn(fs, 'lstat').and.callFake(lstat_file_does_not_exist);
      DownloadSpy = jasmine.createSpy('Download');
      cli.__set__('Download', DownloadSpy);
      fetchMedia(
        mediaData.image.json, 'foobar', {}
      ).catch(function(err) {
        expect(fs.lstat.calls.any()).toEqual(false);
        expect(DownloadSpy.calls.any()).toEqual(false);
        expect(err.message).toEqual(
          logger.formatErrorMessage('Could not find resolution: foobar'));
        done();
      });
    });
  });

  describe('saveMediaObject', function() {
    var saveMediaObject = cli.__get__('saveMediaObject');
    var fs = cli.__get__('fs');
    var mkdirp_spy;
    var writeFile_success = function(filename, data, callback) {
      callback();
    };
    var writeFile_fail = function(filename, data, callback) {
      callback(Error('boom'));
    };
    var mkdirp_success = function(dest, callback) {
      callback();
    };
    var mkdirp_fail = function(dest, callback) {
      callback(Error('boom2'));
    };

    beforeEach(function() {
      spyOn(media, 'log');
    });

    it('saves a media object', function(done) {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_success);
      cli.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_success);
      var dest = 'foo';
      var media_filename = path.join(dest, mediaData.image.jsonBasename);
      saveMediaObject(mediaData.image.json, {
        dest: dest
      }).then(function(filename) {
        let data = JSON.stringify(mediaData.image.json, null, 2);
        expect(mkdirp_spy.calls.argsFor(0)[0]).toEqual(dest);
        expect(fs.writeFile.calls.argsFor(0)[1]).toEqual(data);
        expect(media.log).toHaveBeenCalled();
        expect(filename).toBe(media_filename);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('saves a media object filtered by keys', function(done) {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_success);
      cli.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_success);
      var dest = 'foo';
      var media_filename = path.join(dest, mediaData.image.jsonBasename);
      var keys = ['id', 'caption.created_time'];
      saveMediaObject(mediaData.image.json, {
        dest: dest,
        json: keys
      }).then(function(filename) {
        let filtered_media = {};
        objectPath.set(
          filtered_media,
          'id',
          objectPath.get(mediaData.image.json, 'id'));
        objectPath.set(
          filtered_media,
          'caption.created_time',
          objectPath.get(mediaData.image.json, 'caption.created_time'));
        let data = JSON.stringify(filtered_media, null, 2);
        expect(mkdirp_spy.calls.argsFor(0)[0]).toEqual(dest);
        expect(fs.writeFile.calls.argsFor(0)[1]).toEqual(data);
        expect(media.log).toHaveBeenCalled();
        expect(filename).toBe(media_filename);
        done();
      });
    });

    it('rejects if creating destination directory failed', function(done) {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_fail);
      cli.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_success);
      var dest = 'foo';
      saveMediaObject(mediaData.image.json, {
        dest: dest
      }).catch(function(err) {
        expect(mkdirp_spy.calls.argsFor(0)[0]).toEqual(dest);
        expect(fs.writeFile.calls.any()).toEqual(false);
        expect(err.message).toEqual('boom2');
        done();
      });
    });

    it('rejects if saving failed', function(done) {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_success);
      cli.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_fail);
      saveMediaObject(mediaData.image.json, {
      }).catch(function(err) {
        expect(fs.writeFile).toHaveBeenCalled();
        expect(err.message).toEqual('boom');
        done();
      });
    });
  });

  describe('resolveOptions', function() {
    var resolveOptions = cli.__get__('resolveOptions');

    beforeEach(function() {
      spyOn(logger, 'log');
      spyOn(ig, 'use');
      spyOn(user, 'resolveUserId').and.callFake(
        helpers.promiseValue.bind(null, '12345678'));
      spyOn(media, 'resolveMediaId').and.callFake(
        helpers.promiseValue.bind(null, mediaData.image.json.id));
    });

    it('resolves options', function(done) {
      var options = {
        maxId: mediaData.image.json.link,
        minId: mediaData.image.json.link,
        userId: 'username',
        maxTimestamp: 'Thu, 09 Apr 2015 01:19:46 +0000',
        minTimestamp: 'Thu, 09 Apr 2015 01:19:46 +0000',
        json: 'foo,bar',
        resolution: 'thumbnail,low_resolution',
        verbose: true
      };
      var resolved_options = {
        minTimestamp: 1428542386,
        maxTimestamp: 1428542386,
        userId: '12345678',
        minId: mediaData.image.json.id,
        maxId: mediaData.image.json.id,
        json: ['foo', 'bar'],
        resolution: ['thumbnail', 'low_resolution'],
        verbose: true,
        accessToken: 'token'
      };
      var env = {};
      env[constants.ACCESS_TOKEN_ENV_VAR] = 'token';
      cli.__set__('process', {env: env});
      resolveOptions(options).then(function(res) {
        let link = mediaData.image.json.link;
        expect(user.resolveUserId.calls.argsFor(0)).toEqual(['username']);
        expect(media.resolveMediaId.calls.argsFor(0)[0]).toEqual(link);
        expect(media.resolveMediaId.calls.argsFor(1)[0]).toEqual(link);
        expect(res).toEqual(resolved_options);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('rejects when no access token is found', function(done) {
      cli.__set__('process', {env: {}});
      resolveOptions({}).then(function() {
        fail(new Error('should not have succeeded'));
        done();
      }, function(err) {
        expect(err.message).toEqual(
          logger.formatErrorMessage('Need Instagram access token'));
        done();
      });
    });

    it('rejects when no user id is found', function(done) {
      resolveOptions({accessToken: 'token'}).then(function() {
        fail(new Error('should not have succeeded'));
        done();
      }, function(err) {
        expect(err.message).toEqual(
          logger.formatErrorMessage('Need user ID or user name'));
        done();
      });
    });
  });

  describe('query', function() {
    var query = cli.__get__('query');
    var pageTotal = 3;
    var medias = helpers.fillArray(pageTotal);
    medias[pageTotal - 1].type = 'video'; // last one is a video

    // This fake getRecentMedias will first return a page with 2 empty
    // medias, then a page with the rest (pageTotal).
    var getRecentMedias = function() {
      return Promise.resolve({
        medias: medias.slice(0, 2),
        next: Promise.resolve({
          medias: medias.slice(2),
          next: false
        })
      });
    };

    var resolveOptionsSpy;
    var getRecentMediasSpy;
    var forEachRecentMediasSpy;
    var fetchMediaSpy;
    var updateFileMetadataSpy;
    var saveMediaObjectSpy;

    beforeEach(function() {
      spyOn(logger, 'log');
      resolveOptionsSpy = jasmine.createSpy('resolveOptions');
      cli.__set__('resolveOptions', resolveOptionsSpy);
      forEachRecentMediasSpy = spyOn(user, 'forEachRecentMedias');
      getRecentMediasSpy = jasmine.createSpy('getRecentMedias');
      user.__set__('getRecentMedias', getRecentMediasSpy);
      fetchMediaSpy = jasmine.createSpy('fetchMedia');
      cli.__set__('fetchMedia', fetchMediaSpy);
      updateFileMetadataSpy = jasmine.createSpy('updateFileMetadata');
      cli.__set__('updateFileMetadata', updateFileMetadataSpy);
      saveMediaObjectSpy = jasmine.createSpy('saveMediaObject');
      cli.__set__('saveMediaObject', saveMediaObjectSpy);

      // The default, working mock workflow
      resolveOptionsSpy.and.callFake(helpers.promiseValue);
      forEachRecentMediasSpy.and.callThrough();
      getRecentMediasSpy.and.callFake(getRecentMedias);
      fetchMediaSpy.and.callFake(
        helpers.promiseValue.bind(null, mediaData.image.basename));
      updateFileMetadataSpy.and.callFake(helpers.promiseValue);
      saveMediaObjectSpy.and.callFake(helpers.promiseValue);
    });

    it('resolves options & processes medias (wo/ videos)', function(done) {
      var options = {
        userId: '12345678',
        json: true
      };
      query(options).then(function(res) {
        let processed_count = pageTotal - 1; // except the video
        expect(resolveOptionsSpy).toHaveBeenCalledWith(options);
        expect(forEachRecentMediasSpy.calls.argsFor(0)[0]).toEqual(
          options.userId);
        expect(forEachRecentMediasSpy.calls.argsFor(0)[1]).toEqual(options);
        expect(fetchMediaSpy.calls.argsFor(0)).toEqual(
          [{}, mediaData.image.defaultResolution, options]);
        expect(fetchMediaSpy.calls.count()).toEqual(processed_count);
        expect(updateFileMetadataSpy.calls.argsFor(0)).toEqual(
          [{}, mediaData.image.basename, options]);
        expect(updateFileMetadataSpy.calls.count()).toEqual(processed_count);
        expect(saveMediaObjectSpy.calls.argsFor(0)).toEqual([{}, options]);
        expect(saveMediaObjectSpy.calls.count()).toEqual(processed_count);
        expect(res).toEqual(medias.slice(0, processed_count));
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('resolves options & processes medias (w/ videos)', function(done) {
      var options = {
        userId: '12345678',
        json: true,
        includeVideos: true
      };
      query(options).then(function(res) {
        expect(fetchMediaSpy.calls.count()).toEqual(pageTotal);
        expect(updateFileMetadataSpy.calls.count()).toEqual(pageTotal);
        expect(saveMediaObjectSpy.calls.count()).toEqual(pageTotal);
        expect(res).toEqual(medias);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('rejects on error while resolving options', function(done) {
      resolveOptionsSpy.and.callFake(helpers.promiseRejectError);
      query({}).then(function() {
        done.fail(new Error('should not have succeeded'));
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while iterating over medias', function(done) {
      forEachRecentMediasSpy.and.callFake(helpers.promiseRejectError);
      query({}).then(function() {
        done.fail(new Error('should not have succeeded'));
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while fetching media', function(done) {
      fetchMediaSpy.and.callFake(helpers.promiseRejectError);
      query({}).then(function() {
        done.fail(new Error('should not have succeeded'));
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while updating metadata', function(done) {
      updateFileMetadataSpy.and.callFake(helpers.promiseRejectError);
      query({}).then(function() {
        done.fail(new Error('should not have succeeded'));
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while saving JSON object', function(done) {
      saveMediaObjectSpy.and.callFake(helpers.promiseRejectError);
      var options = {
        json: true,
      };
      query(options).then(function() {
        done.fail(new Error('should not have succeeded'));
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

  });

  describe('main', function() {
    var main = cli.__get__('main');
    var querySpy;

    beforeEach(function() {
      spyOn(logger, 'log');
      querySpy = jasmine.createSpy('query');
      cli.__set__('query', querySpy);
    });

    it('rejects when no command is provided', function(done) {
      var argv = [];
      main(argv).catch(function() {
        expect(logger.log.calls.argsFor(0)[0].indexOf('--help')).not.toBe(-1);
        done();
      });
    });

    it('outputs help on --help', function() {
      var argv = [
        '--help'
      ];
      main(argv).catch(function() {
        expect(logger.log.calls.argsFor(0)[0].indexOf('--help')).not.toBe(-1);
        done();
      });
    });

    it('parses argv and forwards to query', function(done) {
      querySpy.and.callFake(helpers.promiseValue.bind(null, [{}]));
      var argv = [
        'download',
        '--access-token', 'token',
        '--user-id', 'username',
        '--count', '3',
        '--min-timestamp', '2015-01-01 23:10:10',
        '--max-timestamp', '2015-12-31 13:10:10',
        '--min-id', mediaData.image.json.link,
        '--max-id', mediaData.image.json.link,
        '--resolution', 'thumbnail,low_resolution'
      ];
      var options = {
        accessToken: 'token',
        userId: 'username',
        count: 3,
        minTimestamp: '2015-01-01 23:10:10',
        maxTimestamp: '2015-12-31 13:10:10',
        minId: mediaData.image.json.link,
        maxId: mediaData.image.json.link,
        resolution: 'thumbnail,low_resolution'
      };
      main(argv).then(function(res) {
        var query_calls = querySpy.calls.argsFor(0)[0];
        for (var property in options) {
          expect(query_calls[property]).toEqual(options[property]);
        }
        expect(res).toEqual([{}]);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('rejects when a command fails', function(done) {
      querySpy.and.callFake(helpers.promiseRejectError);
      var argv = ['download'];
      main(argv).then(function() {
        done.fail(err);
      }, function() {
        expect(logger.log.calls.argsFor(0)[0].indexOf('--help')).not.toBe(-1);
        done();
      });
    });

  });

});
