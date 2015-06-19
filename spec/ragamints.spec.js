#!/usr/bin/env node
'use strict';

var extend     = require('util')._extend;
var moment     = require('moment-timezone');
var path       = require('path');
var Promise    = require('es6-promise').Promise;
var rewire     = require('rewire');
var strip_ansi = require('strip-ansi');

var ragamints = rewire('../index.js');

var cdn = 'https://scontent.cdninstagram.com/hphotos-xat1/t51.2885-15/';
var media = {
  'id': '977398127825095465_26667401',
  'user': {
    'username': 'sebastienbarre',
    'full_name': 'Sébastien B'
  },
  'tags': [
    '99',
    'Osaka'
  ],
  'type': 'image',
  'location': {
    'latitude': 58.298348257,
    'longitude': -134.403743603,
    'id': 270494303
  },
  'created_time': '1430734958',
  'link': 'https://instagram.com/p/2Qams1JYsp/',
  'images': {
    'low_resolution': {
      'url': cdn + 's320x320/e15/11193066_896012850450861_10425589_n.jpg',
      'width': 320,
      'height': 320
    },
    'thumbnail': {
      'url': cdn + 's150x150/e15/11193066_896012850450861_10425589_n.jpg',
      'width': 150,
      'height': 150
    },
    'standard_resolution': {
      'url': cdn + 'e15/11193066_896012850450861_10425589_n.jpg',
      'width': 640,
      'height': 640
    }
  },
  'caption': {
    'created_time': '1430734958',
    'text': 'Back home. #foo #osaka'
  }
};
var media_file_name = '2015-05-04_1430734958';
var media_basename = media_file_name + '.jpg';
var media_object_basename = media_file_name + '.json';

var media_no_gps = extend({}, media);
delete media_no_gps.location;

var video_media = extend({}, media);
video_media.type = 'video';
video_media.videos = {
  'standard_resolution': {
    'url': cdn + '11193066_896012850450861_10425589_n.mp4'
  }
};
delete video_media.images;
var video_media_basename = media_file_name + '.mp4';

var exiftool_args_common = [
  '-q',
  '-q',
  '-codedcharacterset=utf8',
  '-overwrite_original',
  '-EXIF:Software=ragamints',
  '-XMP:CreatorTool=ragamints',
  '-EXIF:ImageDescription=Back home. #foo #osaka',
  '-IPTC:Caption-Abstract=Back home. #foo #osaka',
  '-XMP:Description=Back home. #foo #osaka',
  '-EXIF:Artist=Sébastien B',
  '-EXIF:Copyright=Copyright Sébastien B',
  '-IPTC:CopyrightNotice=Copyright Sébastien B',
  '-XMP:Creator=Sébastien B',
  '-XMP:Rights=Copyright Sébastien B',
  '-sep',
  ', ',
  '-IPTC:Keywords=99, Osaka',
  '-XMP:Subject=99, Osaka'
];

var exiftool_args = exiftool_args_common.concat([
  '-EXIF:DateTimeOriginal=2015:05:04 02:22:38-08:00',
  '-IPTC:DateCreated=2015:05:04',
  '-IPTC:TimeCreated=02:22:38-08:00',
  '-XMP:DateCreated=2015:05:04 02:22:38-08:00',
  '-EXIF:GPSLatitude=58.298348257',
  '-EXIF:GPSLatitudeRef=N',
  '-EXIF:GPSLongitude=-134.403743603',
  '-EXIF:GPSLongitudeRef=W'
]);

var created = moment.unix(media.created_time);  // local time
var created_ymd = created.format('YYYY:MM:DD');
var created_hms = created.format('HH:mm:ssZ');
var created_ymd_hms = `${created_ymd} ${created_hms}`;

var exiftool_args_no_gps = exiftool_args_common.concat([
  '-EXIF:DateTimeOriginal=' + created_ymd_hms,
  '-IPTC:DateCreated=' + created_ymd,
  '-IPTC:TimeCreated=' + created_hms,
  '-XMP:DateCreated=' + created_ymd_hms
]);

var ig_page_size = 33;

function fill_array(size) {
  return Array.apply(null, new Array(size)).map(function() { return {}; });
}

describe('padRight', function() {
  var padRight = ragamints.__get__('padRight');

  it('pads a string to the right', function() {
    expect(padRight('foo',
    ' ', 5)).toEqual('foo  ');
  });
});

describe('padLeftZero', function() {
  var padLeftZero = ragamints.__get__('padLeftZero');

  it('pads a number to the left with zeros', function() {
    expect(padLeftZero(15, 4)).toEqual('0015');
  });
});

describe('logForMedia', function() {
  var logForMedia = ragamints.__get__('logForMedia');

  beforeEach(function() {
    spyOn(console, 'log');
  });

  it('logs message w/ respect to a media', function() {
    var prefix = '#0001 [Back home. #foo #o]';
    var msg = 'logging';
    logForMedia(media, msg);
    expect(strip_ansi(console.log.calls.argsFor(0)[0])).toEqual(prefix);
    expect(strip_ansi(console.log.calls.argsFor(0)[1])).toEqual(msg);
  });

  it('logs message w/ respect to a media even w/o caption or msg', function() {
    var media_wo_caption = extend({}, media);
    delete media_wo_caption.caption;
    logForMedia(media_wo_caption);
    var msg = '#0001 [977398127825095465]';
    expect(strip_ansi(console.log.calls.argsFor(0)[0])).toEqual(msg);
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
    expect(getExifToolArgs(media, {verbose: true})).toEqual(exiftool_args);
    expect(logForMediaSpy.calls.count()).toEqual(2);
  });

  it('gathers args for exiftool and assumes local when no GPS', function() {
    expect(getExifToolArgs(media_no_gps, {verbose: true})).toEqual(
      exiftool_args_no_gps);
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
    updateFileMetadata(video, 'foo.jpg', {}).then(function(res) {
      expect(res).toBe(false);
      expect(logForMediaSpy).toHaveBeenCalled();
      done();
    });
  });

  it('spawns a child process to invoke exiftool', function(done) {
    var child_process = ragamints.__get__('child_process');
    spyOn(child_process, 'spawn').and.returnValue(exiftool_process);
    updateFileMetadata(media, media_basename, {}).then(function(res) {
      var spawn_args = exiftool_args.concat([media_basename]);
      expect(child_process.spawn).toHaveBeenCalledWith('exiftool', spawn_args);
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
      media, media_basename, {quiet: true}
    ).catch(function(err) {
      expect(child_process.spawn).toHaveBeenCalled();
      expect(err.message).toBe('Could not spawn exiftool (boom)');
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
      media, media_basename, {quiet: true}
    ).catch(function(err) {
      expect(child_process.spawn).toHaveBeenCalled();
      expect(err.message).toBe('boom');
      done();
    });
  });
});

describe('createMediaFileName', function() {
  var createMediaFileName = ragamints.__get__('createMediaFileName');

  it('creates a file name for the fetched file to be saved as', function() {
    expect(createMediaFileName(media)).toBe(media_file_name);
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
    spyOn(fs, 'lstat').and.callFake(function(filename, callback) {
      callback(false, stats_is_file);
    });
    fetchMedia(media, {}).then(function(filename) {
      expect(DownloadSpy.calls.any()).toEqual(false);
      expect(logForMediaSpy).toHaveBeenCalled();
      expect(filename).toBe(media_basename);
      done();
    });
  });

  it('fetches a media', function(done) {
    spyOn(fs, 'lstat').and.callFake(function(filename, callback) {
      callback(true, stats_is_file);
    });
    var dest = 'foo';
    var media_filename = path.join(dest, media_basename);
    fetchMedia(media, {dest: dest}).then(function(filename) {
      expect(DownloadSpy).toHaveBeenCalled();
      expect(logForMediaSpy).toHaveBeenCalled();
      expect(filename).toBe(media_filename);
      done();
    });
  });

  it('fetches a media even if it exists when forcing', function(done) {
    spyOn(fs, 'lstat').and.callFake(function(filename, callback) {
      callback(false, stats_is_file);
    });
    fetchMedia(video_media, {alwaysDownload: true}).then(function(filename) {
      expect(DownloadSpy).toHaveBeenCalled();
      expect(logForMediaSpy).toHaveBeenCalled();
      expect(filename).toBe(video_media_basename);
      done();
    });
  });

  it('rejects if fetching failed', function(done) {
    spyOn(fs, 'lstat').and.callFake(function(filename, callback) {
      callback(true, stats_is_file);
    });
    var Download_failed = function() {
      var d = Download();
      d.run = function(callback) {
        callback(Error('boom'));
      };
      return d;
    };
    DownloadSpy = jasmine.createSpy('Download').and.callFake(Download_failed);
    ragamints.__set__('Download', DownloadSpy);
    fetchMedia(media, {}).catch(function(err) {
      expect(DownloadSpy).toHaveBeenCalled();
      expect(err.message).toEqual('boom');
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
    var media_filename = path.join(dest, media_object_basename);
    saveMediaObject(media, {dest: dest}).then(function(filename) {
      let data = JSON.stringify(media, null, 2);
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
    saveMediaObject(media, {dest: dest}).catch(function(err) {
      expect(mkdirp_spy.calls.argsFor(0)[0]).toEqual(dest);
      expect(fs.writeFile.calls.count()).toEqual(0);
      expect(err.message).toEqual('boom2');
      done();
    });
  });

  it('rejects if saving failed', function(done) {
    mkdirp_spy = jasmine.createSpy('mkdirp').and.callFake(mkdirp_success);
    ragamints.__set__('mkdirp', mkdirp_spy);
    spyOn(fs, 'writeFile').and.callFake(writeFile_fail);
    saveMediaObject(media, {}).catch(function(err) {
      expect(fs.writeFile).toHaveBeenCalled();
      expect(err.message).toEqual('boom');
      done();
    });
  });
});

describe('getRecentMedias', function() {
  var getRecentMedias = ragamints.__get__('getRecentMedias');
  var ig = ragamints.__get__('ig');

  beforeEach(function() {
    spyOn(console, 'log');
  });

  it('fetches a media', function(done) {
    var next = function(callback) {
      setTimeout(function() {
        callback(null, fill_array(ig_page_size), {next: next});
      }, 0);
    };
    var user_media_recent = function(user_id, options, callback) {
      next(callback);
    };
    var count = Math.floor(ig_page_size * 1.5);
    var medias = [];
    spyOn(ig, 'user_media_recent').and.callFake(user_media_recent);
    // Unfortunately, it does not seem that suspend and generators are
    // supported by jasmine. Let's manually wait for the two promises
    // we are supposed to get.
    getRecentMedias('26667401', {count: count}).then(function(chunk1) {
      medias = medias.concat(chunk1.medias);
      chunk1.next.then(function(chunk2) {
        medias = medias.concat(chunk2.medias);
        expect(ig.user_media_recent.calls.argsFor(0)[0]).toEqual('26667401');
        expect(medias.length).toEqual(count);
        expect(medias[count - 1].fetch_index).toEqual(count - 1);
        expect(strip_ansi(console.log.calls.argsFor(0)[0])).toEqual(
          'Found 33 media(s), more to come...');
        expect(strip_ansi(console.log.calls.argsFor(1)[0])).toEqual(
          'Found another 16 media(s), nothing more.');
        done();
      });
    });
  });

  it('rejects on errors', function(done) {
    var user_media_recent = function(user_id, options, callback) {
      callback(Error('boom'));
    };
    spyOn(ig, 'user_media_recent').and.callFake(user_media_recent);
    // Unfortunately, it does not seem that suspend and generators are
    // supported by jasmine. Let's manually wait for the two promises
    // we are supposed to get.
    getRecentMedias('26667401', {count: 3}).catch(function(err) {
      expect(ig.user_media_recent.calls.argsFor(0)[0]).toEqual('26667401');
      expect(err.message).toEqual('boom');
      done();
    });
  });
});

describe('isUserId', function() {
  var isUserId = ragamints.__get__('isUserId');

  it('checks if a user id is valid', function() {
    expect(isUserId('26667401')).toBe(true);
  });

  it('checks if a user id is invalid', function() {
    expect(isUserId('sebastienbarre')).not.toBe(true);
  });
});

describe('resolveUserId', function() {
  var resolveUserId = ragamints.__get__('resolveUserId');
  var ig = ragamints.__get__('ig');

  it('resolves a user id to itself', function(done) {
    spyOn(ig, 'user_search');
    resolveUserId('26667401').then(function(user_id) {
      expect(ig.user_search.calls.count()).toEqual(0);
      expect(user_id).toEqual('26667401');
      done();
    });
  });

  it('resolves a username', function(done) {
    var user_search = function(user_id, options, callback) {
      callback(false, [{id: '26667401'}]);
    };
    spyOn(ig, 'user_search').and.callFake(user_search);
    spyOn(console, 'log');
    resolveUserId('sebastienbarre').then(function(user_id) {
      expect(ig.user_search.calls.argsFor(0)[0]).toEqual('sebastienbarre');
      expect(console.log).toHaveBeenCalled();
      expect(user_id).toEqual('26667401');
      done();
    });
  });

  it('rejects on error', function(done) {
    var user_search = function(user_id, options, callback) {
      callback(Error('boom'));
    };
    spyOn(ig, 'user_search').and.callFake(user_search);
    resolveUserId('sebastienbarre').catch(function(err) {
      expect(ig.user_search.calls.argsFor(0)[0]).toEqual('sebastienbarre');
      expect(err.message).toEqual('boom');
      done();
    });
  });

  it('rejects when no result is returned', function(done) {
    var user_search = function(user_id, options, callback) {
      callback(false, []);
    };
    spyOn(ig, 'user_search').and.callFake(user_search);
    resolveUserId('sebastienbarre').catch(function(err) {
      expect(ig.user_search.calls.argsFor(0)[0]).toEqual('sebastienbarre');
      expect(err.message).toEqual(
        'Could not find user ID for: sebastienbarre');
      done();
    });
  });
});

describe('isMediaId', function() {
  var isMediaId = ragamints.__get__('isMediaId');

  it('checks if a media id is valid', function() {
    expect(isMediaId(media.id)).toBe(true);
  });

  it('checks if a media id is invalid', function() {
    expect(isMediaId(media.link)).not.toBe(true);
  });
});

describe('isMediaUrl', function() {
  var isMediaUrl = ragamints.__get__('isMediaUrl');

  it('checks if a media url is valid', function() {
    expect(isMediaUrl(media.link)).toBe(true);
  });

  it('checks if a media url is invalid', function() {
    expect(isMediaUrl(media.id)).not.toBe(true);
  });
});

describe('isUnixTimestamp', function() {
  var isUnixTimestamp = ragamints.__get__('isUnixTimestamp');

  it('checks if a timestamp is valid', function() {
    expect(isUnixTimestamp(media.created_time)).toBe(true);
  });

  it('checks if a timestamp is invalid', function() {
    expect(isUnixTimestamp('foobar')).not.toBe(true);
  });
});

describe('resolveMediaId', function() {
  var resolveMediaId = ragamints.__get__('resolveMediaId');
  var fetch_spy;

  it('resolves a media id to itself', function(done) {
    fetch_spy = jasmine.createSpy('fetch');
    ragamints.__set__('fetch', fetch_spy);
    resolveMediaId(media.id).then(function(media_id) {
      expect(fetch_spy.calls.count()).toEqual(0);
      expect(media_id).toEqual(media.id);
      done();
    });
  });

  it('resolves a media url', function(done) {
    var fetch = function() {
      return Promise.resolve({
        ok: true,
        json: function() {
          return {media_id: media.id};
        }
      });
    };
    fetch_spy = jasmine.createSpy('fetch').and.callFake(fetch);
    ragamints.__set__('fetch', fetch_spy);
    spyOn(console, 'log');
    resolveMediaId(media.link).then(function(media_id) {
      expect(fetch_spy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      expect(media_id).toEqual(media.id);
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
    resolveMediaId(media.link).catch(function(err) {
      expect(fetch_spy).toHaveBeenCalled();
      expect(err.message).toEqual(
        'Could not retrieve Media Id for: ' + media.link);
      done();
    });
  });
});

describe('resolveOptions', function() {
  var resolveOptions = ragamints.__get__('resolveOptions');
  var ig = ragamints.__get__('ig');
  var resolveUserIdSpy;
  var resolveMediaIdSpy;

  beforeEach(function() {
    spyOn(console, 'log');
    spyOn(ig, 'use');
    resolveUserIdSpy = jasmine.createSpy(
      'resolveUserId'
    ).and.callFake(function() {
      return Promise.resolve('26667401');
    });
    ragamints.__set__('resolveUserId', resolveUserIdSpy);
    resolveMediaIdSpy = jasmine.createSpy(
      'resolveMediaId'
    ).and.callFake(function() {
      return Promise.resolve(media.id);
    });
    ragamints.__set__('resolveMediaId', resolveMediaIdSpy);
  });

  it('resolves options', function(done) {
    var options = {
      maxId: media.link,
      minId: media.link,
      userId: 'sebastienbarre',
      maxTimestamp: 'Thu, 09 Apr 2015 01:19:46 +0000',
      minTimestamp: 'Thu, 09 Apr 2015 01:19:46 +0000'
    };
    var resolved_options = {
      minTimestamp: 1428542386,
      maxTimestamp: 1428542386,
      userId: '26667401',
      minId: media.id,
      maxId: media.id,
      accessToken: 'token'
    };
    ragamints.__set__('process', {env: {RAGAMINTS_ACCESS_TOKEN: 'token'}});
    resolveOptions(options).then(function(res) {
      expect(resolveUserIdSpy.calls.argsFor(0)[0]).toEqual('sebastienbarre');
      expect(resolveMediaIdSpy.calls.argsFor(0)[0]).toEqual(media.link);
      expect(resolveMediaIdSpy.calls.argsFor(1)[0]).toEqual(media.link);
      expect(res).toEqual(resolved_options);
      done();
    });
  });

  it('rejects when no access token is found', function(done) {
    ragamints.__set__('process', {env: {}});
    resolveOptions({}).catch(function(err) {
      expect(err.message).toEqual('Need access token');
      done();
    });
  });

  it('rejects when no user id is found', function(done) {
    resolveOptions({accessToken: 'token'}).catch(function(err) {
      expect(err.message).toEqual('Need user');
      done();
    });
  });
});

describe('query', function() {
  var query = ragamints.__get__('query');
  var resolveOptionsSpy;
  var getRecentMediasSpy;
  var fetchMediaSpy;
  var updateFileMetadataSpy;
  var saveMediaObjectSpy;

  beforeEach(function() {
    spyOn(console, 'log');
    resolveOptionsSpy = jasmine.createSpy(
      'resolveOptions'
    ).and.callFake(function(options) {
      return Promise.resolve(options);
    });
    ragamints.__set__('resolveOptions', resolveOptionsSpy);
    getRecentMediasSpy = jasmine.createSpy(
      'getRecentMedias'
    ).and.callFake(function() {
      return Promise.resolve({medias: fill_array(ig_page_size), next: false});
    });
    ragamints.__set__('getRecentMedias', getRecentMediasSpy);
    fetchMediaSpy = jasmine.createSpy('fetchMedia').and.callFake(function() {
      return Promise.resolve(media_basename);
    });
    ragamints.__set__('fetchMedia', fetchMediaSpy);
    updateFileMetadataSpy = jasmine.createSpy(
      'updateFileMetadata'
    ).and.callFake(function() {
      return Promise.resolve();
    });
    ragamints.__set__('updateFileMetadata', updateFileMetadataSpy);
    saveMediaObjectSpy = jasmine.createSpy(
      'saveMediaObject'
    ).and.callFake(function() {
      return Promise.resolve();
    });
    ragamints.__set__('saveMediaObject', saveMediaObjectSpy);
  });

  it('queries and process medias in parallel', function(done) {
    var options = {userId: '26667401', json: true};
    query(options).then(function(res) {
      expect(resolveOptionsSpy).toHaveBeenCalled();
      expect(getRecentMediasSpy).toHaveBeenCalled();
      expect(getRecentMediasSpy.calls.argsFor(0)[0]).toEqual(options.userId);
      expect(fetchMediaSpy.calls.argsFor(0)).toEqual([{}, options]);
      expect(fetchMediaSpy.calls.count()).toEqual(ig_page_size);
      expect(updateFileMetadataSpy.calls.argsFor(0)).toEqual(
        [{}, media_basename, options]);
      expect(updateFileMetadataSpy.calls.count()).toEqual(ig_page_size);
      expect(saveMediaObjectSpy.calls.argsFor(0)).toEqual([{}, options]);
      expect(saveMediaObjectSpy.calls.count()).toEqual(ig_page_size);
      expect(res.length).toEqual(ig_page_size);
      expect(strip_ansi(console.log.calls.argsFor(0)[0])).toEqual(
        'Done processing');
      expect(strip_ansi(console.log.calls.argsFor(0)[1])).toEqual(
        ig_page_size.toString());
      done();
    });
  });

  it('queries and process medias sequentially', function(done) {
    var options = {userId: '26667401', sequential: true, json: true};
    query(options).then(function(res) {
      expect(resolveOptionsSpy).toHaveBeenCalled();
      expect(getRecentMediasSpy).toHaveBeenCalled();
      expect(getRecentMediasSpy.calls.argsFor(0)[0]).toEqual(options.userId);
      expect(fetchMediaSpy.calls.argsFor(0)).toEqual([{}, options]);
      expect(fetchMediaSpy.calls.count()).toEqual(ig_page_size);
      expect(updateFileMetadataSpy.calls.argsFor(0)).toEqual(
        [{}, media_basename, options]);
      expect(updateFileMetadataSpy.calls.count()).toEqual(ig_page_size);
      expect(saveMediaObjectSpy.calls.argsFor(0)).toEqual([{}, options]);
      expect(saveMediaObjectSpy.calls.count()).toEqual(ig_page_size);
      expect(res.length).toEqual(ig_page_size);
      expect(strip_ansi(console.log.calls.argsFor(0)[0])).toEqual(
        'Done processing');
      expect(strip_ansi(console.log.calls.argsFor(0)[1])).toEqual(
        ig_page_size.toString());
      done();
    });
  });

  it('rejects on fetch error in parallel', function(done) {
    fetchMediaSpy = jasmine.createSpy('fetchMedia').and.callFake(function() {
      return Promise.reject(Error('boom'));
    });
    ragamints.__set__('fetchMedia', fetchMediaSpy);
    query({}).catch(function(err) {
      expect(err.message).toEqual('boom');
      expect(console.log.calls.count()).toEqual(0);
      done();
    });
  });

  it('rejects on save media object error in parallel', function(done) {
    saveMediaObjectSpy = jasmine.createSpy(
      'saveMediaObject'
    ).and.callFake(function() {
      return Promise.reject(Error('boom'));
    });
    ragamints.__set__('saveMediaObject', saveMediaObjectSpy);
    query({json: true}).catch(function(err) {
      expect(err.message).toEqual('boom');
      expect(console.log.calls.count()).toEqual(0);
      done();
    });
  });

  it('rejects on fetch error sequentially', function(done) {
    fetchMediaSpy = jasmine.createSpy('fetchMedia').and.callFake(function() {
      return Promise.reject(Error('boom'));
    });
    ragamints.__set__('fetchMedia', fetchMediaSpy);
    query({sequential: true}).catch(function(err) {
      expect(err.message).toEqual('boom');
      expect(console.log.calls.count()).toEqual(0);
      done();
    });
  });

  it('rejects on save media object error sequentially', function(done) {
    saveMediaObjectSpy = jasmine.createSpy(
      'saveMediaObject'
    ).and.callFake(function() {
      return Promise.reject(Error('boom'));
    });
    ragamints.__set__('saveMediaObject', saveMediaObjectSpy);
    query({sequential: true, json: true}).catch(function(err) {
      expect(err.message).toEqual('boom');
      expect(console.log.calls.count()).toEqual(0);
      done();
    });
  });

  it('rejects on getting recent medias error', function(done) {
    getRecentMediasSpy = jasmine.createSpy(
      'getRecentMedias'
    ).and.callFake(function() {
      return Promise.reject(Error('boom'));
    });
    ragamints.__set__('getRecentMedias', getRecentMediasSpy);
    query({}).catch(function(err) {
      expect(err.message).toEqual('boom');
      expect(console.log.calls.count()).toEqual(0);
      done();
    });
  });
});

describe('main', function() {
  var main = ragamints.__get__('main');
  var program = ragamints.__get__('program');
  var querySpy;

  beforeEach(function() {
    spyOn(console, 'log');
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
      '--user-id', 'sebastienbarre',
      '--count', 3,
      '--min-timestamp', '2015-01-01 23:10:10',
      '--max-timestamp', '2015-12-31 13:10:10',
      '--min-id', media.link,
      '--max-id', media.link
    ];
    var options = {
      accessToken: 'token',
      userId: 'sebastienbarre',
      count: 3,
      minTimestamp: '2015-01-01 23:10:10',
      maxTimestamp: '2015-12-31 13:10:10',
      minId: media.link,
      maxId: media.link
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
    expect(console.log).toHaveBeenCalledWith(
      '  Check the man page or README file for more.');
  });
});
