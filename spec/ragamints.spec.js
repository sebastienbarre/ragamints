'use strict';

var extend       = require('util')._extend;
var objectPath   = require('object-path');
var path         = require('path');
var Promise      = require('es6-promise').Promise;
var rewire       = require('rewire');
var strip_ansi   = require('strip-ansi');

var constants    = require('../lib/constants');

var exiftoolData = require('./data/exiftool');
var mediaData    = require('./data/media');
var helpers      = require('./support/helpers');

var ragamints    = rewire('../lib/ragamints.js');
var user         = rewire('../lib/user.js');

describe('ragamints', function() {
  var ig = ragamints.__get__('ig');
  var log = ragamints.__get__('log');
  ragamints.__set__('user', user);

  describe('logForMedia', function() {
    var logForMedia = ragamints.__get__('logForMedia');

    beforeEach(function() {
      spyOn(log, 'output');
    });

    it('logs message w/ respect to a media', function() {
      var prefix = '#0001 [Back home. #foo #o]';
      var msg = 'logging';
      logForMedia(mediaData.image.json, msg);
      expect(strip_ansi(log.output.calls.argsFor(0)[0])).toEqual(prefix);
      expect(strip_ansi(log.output.calls.argsFor(0)[1])).toEqual(msg);
    });

    it('logs message w/ respect to a media w/o caption or msg', function() {
      var media_wo_caption = extend({}, mediaData.image.json);
      delete media_wo_caption.caption;
      logForMedia(media_wo_caption);
      var msg = '#0001 [977398127825095465]';
      expect(strip_ansi(log.output.calls.argsFor(0)[0])).toEqual(msg);
    });
  });

  describe('getExifToolArgs', function() {
    var getExifToolArgs = ragamints.__get__('getExifToolArgs');
    var logForMediaSpy;

    beforeEach(function() {
      logForMediaSpy = jasmine.createSpy('logForMedia');
      ragamints.__set__('logForMedia', logForMediaSpy);
    });

    it('gathers args for exiftool and uses GPS location', function() {
      expect(getExifToolArgs(mediaData.image.json, {verbose: true})).toEqual(
        exiftoolData.args);
      expect(logForMediaSpy.calls.count()).toEqual(2);
    });

    it('gathers args for exiftool and assumes local when no GPS', function() {
      expect(
        getExifToolArgs(mediaData.imageWithoutGPS.json, {verbose: true})
      ).toEqual(
        exiftoolData.argsWithoutGPS
      );
      expect(logForMediaSpy.calls.count()).toEqual(2);
    });
  });

  describe('updateFileMetadata', function() {
    var updateFileMetadata = ragamints.__get__('updateFileMetadata');
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
    var logForMediaSpy;

    beforeEach(function() {
      logForMediaSpy = jasmine.createSpy('logForMedia');
      ragamints.__set__('logForMedia', logForMediaSpy);
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
      var child_process = ragamints.__get__('child_process');
      spyOn(child_process, 'spawn').and.returnValue(exiftool_process);
      updateFileMetadata(
        mediaData.image.json, mediaData.image.basename, {}
      ).then(function(res) {
        var args = exiftoolData.args.concat([mediaData.image.basename]);
        expect(child_process.spawn).toHaveBeenCalledWith('exiftool', args);
        expect(res).toBe(true);
        expect(logForMediaSpy).toHaveBeenCalled();
        done();
      });
    });

    it('rejects on error', function(done) {
      var process = extend({}, exiftool_process);
      process.on = function(event, callback) {
        if (event === 'error') {
          callback(Error('boom'));
        }
      };
      var child_process = ragamints.__get__('child_process');
      spyOn(child_process, 'spawn').and.returnValue(process);
      updateFileMetadata(
        mediaData.image.json, mediaData.image.basename, {quiet: true}
      ).catch(function(err) {
        expect(child_process.spawn).toHaveBeenCalled();
        expect(err.message).toBe(
          log.formatErrorMessage('Could not spawn exiftool (boom)'));
        done();
      });
    });

    it('rejects on stderr data', function(done) {
      var process = extend({}, exiftool_process);
      process.stderr.on = function(event, callback) {
        if (event === 'data') {
          callback('boom');
        }
      };
      var child_process = ragamints.__get__('child_process');
      spyOn(child_process, 'spawn').and.returnValue(process);
      updateFileMetadata(
        mediaData.image.json, mediaData.image.basename, {quiet: true}
      ).catch(function(err) {
        expect(child_process.spawn).toHaveBeenCalled();
        expect(err.message).toBe(log.formatErrorMessage('boom'));
        done();
      });
    });
  });

  describe('createMediaFileName', function() {
    var createMediaFileName = ragamints.__get__('createMediaFileName');

    it('creates a file name for the fetched file to be saved as', function() {
      expect(
        createMediaFileName(mediaData.image.json)
      ).toBe(
        mediaData.image.fileName
      );
    });
  });

  describe('fetchMedia', function() {
    var fetchMedia = ragamints.__get__('fetchMedia');
    var fs = ragamints.__get__('fs');
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
    var logForMediaSpy;
    var DownloadSpy;

    beforeEach(function() {
      logForMediaSpy = jasmine.createSpy('logForMedia');
      ragamints.__set__('logForMedia', logForMediaSpy);
      DownloadSpy = jasmine.createSpy('Download').and.callFake(Download);
      ragamints.__set__('Download', DownloadSpy);
    });

    it('skips if the file is already there', function(done) {
      spyOn(fs, 'lstat').and.callFake(lstat_file_exists);
      fetchMedia(
        mediaData.image.json, mediaData.image.defaultResolution, {}
      ).then(function(filename) {
        expect(DownloadSpy.calls.any()).toEqual(false);
        expect(logForMediaSpy).toHaveBeenCalled();
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
        expect(logForMediaSpy).toHaveBeenCalled();
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
        expect(logForMediaSpy).toHaveBeenCalled();
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
      ragamints.__set__('Download', DownloadSpy);
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
      ragamints.__set__('Download', DownloadSpy);
      fetchMedia(
        mediaData.image.json, 'foobar', {}
      ).catch(function(err) {
        expect(fs.lstat.calls.any()).toEqual(false);
        expect(DownloadSpy.calls.any()).toEqual(false);
        expect(err.message).toEqual(
          log.formatErrorMessage('Could not find resolution: foobar'));
        done();
      });
    });
  });

  describe('saveMediaObject', function() {
    var saveMediaObject = ragamints.__get__('saveMediaObject');
    var fs = ragamints.__get__('fs');
    var logForMediaSpy;
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
      logForMediaSpy = jasmine.createSpy('logForMedia');
      ragamints.__set__('logForMedia', logForMediaSpy);
    });

    it('saves a media object', function(done) {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_success);
      ragamints.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_success);
      var dest = 'foo';
      var media_filename = path.join(dest, mediaData.image.jsonBasename);
      saveMediaObject(mediaData.image.json, {
        dest: dest
      }).then(function(filename) {
        let data = JSON.stringify(mediaData.image.json, null, 2);
        expect(mkdirp_spy.calls.argsFor(0)[0]).toEqual(dest);
        expect(fs.writeFile.calls.argsFor(0)[1]).toEqual(data);
        expect(logForMediaSpy).toHaveBeenCalled();
        expect(filename).toBe(media_filename);
        done();
      });
    });

    it('saves a media object filtered by keys', function(done) {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_success);
      ragamints.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_success);
      var dest = 'foo';
      var media_filename = path.join(dest, mediaData.image.jsonBasename);
      var keys = 'id,caption.created_time';
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
        expect(logForMediaSpy).toHaveBeenCalled();
        expect(filename).toBe(media_filename);
        done();
      });
    });

    it('rejects if creating destination directory failed', function(done) {
      mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_fail);
      ragamints.__set__('mkdirp', mkdirp_spy);
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
      ragamints.__set__('mkdirp', mkdirp_spy);
      spyOn(fs, 'writeFile').and.callFake(writeFile_fail);
      saveMediaObject(mediaData.image.json, {
      }).catch(function(err) {
        expect(fs.writeFile).toHaveBeenCalled();
        expect(err.message).toEqual('boom');
        done();
      });
    });
  });

  describe('isMediaId', function() {
    var isMediaId = ragamints.__get__('isMediaId');

    it('checks if a media id is valid', function() {
      expect(isMediaId(mediaData.image.json.id)).toBe(true);
    });

    it('checks if a media id is invalid', function() {
      expect(isMediaId(mediaData.image.json.link)).not.toBe(true);
    });
  });

  describe('isMediaUrl', function() {
    var isMediaUrl = ragamints.__get__('isMediaUrl');

    it('checks if a media url is valid', function() {
      expect(isMediaUrl(mediaData.image.json.link)).toBe(true);
    });

    it('checks if a media url is invalid', function() {
      expect(isMediaUrl(mediaData.image.json.id)).not.toBe(true);
    });
  });

  describe('resolveMediaId', function() {
    var resolveMediaId = ragamints.__get__('resolveMediaId');
    var fetch_spy;

    it('resolves a media id to itself', function(done) {
      fetch_spy = jasmine.createSpy('fetch');
      ragamints.__set__('fetch', fetch_spy);
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
      ragamints.__set__('fetch', fetch_spy);
      spyOn(log, 'output');
      resolveMediaId(mediaData.image.json.link).then(function(media_id) {
        expect(fetch_spy).toHaveBeenCalled();
        expect(log.output).toHaveBeenCalled();
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
      ragamints.__set__('fetch', fetch_spy);
      let link = mediaData.image.json.link;
      resolveMediaId(link).catch(function(err) {
        expect(fetch_spy).toHaveBeenCalled();
        expect(err.message).toEqual(
          log.formatErrorMessage(`Could not retrieve Media Id for: ${link}`));
        done();
      });
    });
  });

  describe('resolveOptions', function() {
    var resolveOptions = ragamints.__get__('resolveOptions');
    var resolveMediaIdSpy;

    beforeEach(function() {
      spyOn(log, 'output');
      spyOn(ig, 'use');
      spyOn(user, 'resolveUserId').and.callFake(
        helpers.promiseValue.bind(null, '12345678'));
      resolveMediaIdSpy = jasmine.createSpy('resolveMediaId').and.callFake(
        helpers.promiseValue.bind(null, mediaData.image.json.id));
      ragamints.__set__('resolveMediaId', resolveMediaIdSpy);
    });

    it('resolves options', function(done) {
      var options = {
        maxId: mediaData.image.json.link,
        minId: mediaData.image.json.link,
        userId: 'username',
        maxTimestamp: 'Thu, 09 Apr 2015 01:19:46 +0000',
        minTimestamp: 'Thu, 09 Apr 2015 01:19:46 +0000'
      };
      var resolved_options = {
        minTimestamp: 1428542386,
        maxTimestamp: 1428542386,
        userId: '12345678',
        minId: mediaData.image.json.id,
        maxId: mediaData.image.json.id,
        accessToken: 'token'
      };
      var env = {};
      env[constants.ACCESS_TOKEN_ENV_VAR] = 'token';
      ragamints.__set__('process', {env: env});
      resolveOptions(options).then(function(res) {
        let link = mediaData.image.json.link;
        expect(user.resolveUserId.calls.argsFor(0)).toEqual(['username']);
        expect(resolveMediaIdSpy.calls.argsFor(0)[0]).toEqual(link);
        expect(resolveMediaIdSpy.calls.argsFor(1)[0]).toEqual(link);
        expect(res).toEqual(resolved_options);
        done();
      }, function(err) {
        fail(err);
        done();
      });
    });

    it('rejects when no access token is found', function(done) {
      ragamints.__set__('process', {env: {}});
      resolveOptions({}).then(function() {
        fail(new Error('should not have succeeded'));
        done();
      }, function(err) {
        expect(err.message).toEqual(
          log.formatErrorMessage('Need Instagram access token'));
        done();
      });
    });

    it('rejects when no user id is found', function(done) {
      resolveOptions({accessToken: 'token'}).then(function() {
        fail(new Error('should not have succeeded'));
        done();
      }, function(err) {
        expect(err.message).toEqual(log.formatErrorMessage('Need user'));
        done();
      });
    });
  });

  describe('query', function() {
    var query = ragamints.__get__('query');
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
      spyOn(log, 'output');
      resolveOptionsSpy = jasmine.createSpy('resolveOptions');
      ragamints.__set__('resolveOptions', resolveOptionsSpy);
      forEachRecentMediasSpy = spyOn(user, 'forEachRecentMedias');
      getRecentMediasSpy = jasmine.createSpy('getRecentMedias');
      user.__set__('getRecentMedias', getRecentMediasSpy);
      fetchMediaSpy = jasmine.createSpy('fetchMedia');
      ragamints.__set__('fetchMedia', fetchMediaSpy);
      updateFileMetadataSpy = jasmine.createSpy('updateFileMetadata');
      ragamints.__set__('updateFileMetadata', updateFileMetadataSpy);
      saveMediaObjectSpy = jasmine.createSpy('saveMediaObject');
      ragamints.__set__('saveMediaObject', saveMediaObjectSpy);

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
        fail(err);
        done();
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
        fail(err);
        done();
      });
    });

    it('rejects on error while resolving options', function(done) {
      resolveOptionsSpy.and.callFake(helpers.promiseRejectError);
      query({}).then(function() {
        fail(new Error('should not have succeeded'));
        done();
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while iterating over medias', function(done) {
      forEachRecentMediasSpy.and.callFake(helpers.promiseRejectError);
      query({}).then(function() {
        fail(new Error('should not have succeeded'));
        done();
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while fetching media', function(done) {
      fetchMediaSpy.and.callFake(helpers.promiseRejectError);
      query({}).then(function() {
        fail(new Error('should not have succeeded'));
        done();
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects on error while updating metadata', function(done) {
      updateFileMetadataSpy.and.callFake(helpers.promiseRejectError);
      query({}).then(function() {
        fail(new Error('should not have succeeded'));
        done();
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
        fail(new Error('should not have succeeded'));
        done();
      }, function(err) {
        expect(err.message).toEqual('boom');
        done();
      });
    });

  });

  describe('main', function() {
    var main = ragamints.__get__('main');
    var program = ragamints.__get__('program');
    var querySpy;

    beforeEach(function() {
      spyOn(log, 'output');
      querySpy = jasmine.createSpy('query').and.callFake(function() {
        return Promise.resolve([{}]);
      });
      ragamints.__set__('query', querySpy);
    });

    it('handles process.args and forwards to query', function(done) {
      var argv = [
        'foo',
        'bar',
        '--access-token', 'token',
        '--user-id', 'username',
        '--count', 3,
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
        resolution: ['thumbnail', 'low_resolution']
      };
      main(argv).then(function(res) {
        var query_calls = querySpy.calls.argsFor(0)[0];
        for (var property in options) {
          expect(query_calls[property]).toEqual(options[property]);
        }
        expect(res).toEqual([{}]);
        done();
      });
    });

    it('rejects and displays help when no args are provided', function(done) {
      var argv = [
        'foo',
        'bar'
      ];
      spyOn(program, 'outputHelp');
      main(argv).catch(function() {
        expect(program.outputHelp).toHaveBeenCalled();
        done();
      });
    });

    it('outputs help on --help', function() {
      spyOn(program, 'on').and.callFake(function(option, callback) {
        if (option === '--help') {
          callback();
        }
        return this;
      });
      spyOn(program, 'parse');
      var argv = [
        'foo',
        'bar',
        '--help'
      ];
      main(argv);
      expect(log.output).toHaveBeenCalledWith(
        '  Check the man page or README file for more.');
    });
  });

});
