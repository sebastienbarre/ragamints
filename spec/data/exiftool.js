'use strict';

var moment    = require('moment-timezone');
var constants = require('../../lib/constants');
var mediaData = require('./media');

var args_common = [
  '-q',
  '-q',
  '-codedcharacterset=utf8',
  '-overwrite_original',
  '-EXIF:Software=' + constants.SOFTWARE,
  '-XMP:CreatorTool=' + constants.SOFTWARE,
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

var args_with_gps = args_common.concat([
  '-EXIF:DateTimeOriginal=2015:05:04 02:22:38-08:00',
  '-IPTC:DateCreated=2015:05:04',
  '-IPTC:TimeCreated=02:22:38-08:00',
  '-XMP:DateCreated=2015:05:04 02:22:38-08:00',
  '-EXIF:GPSLatitude=58.298348257',
  '-EXIF:GPSLatitudeRef=N',
  '-EXIF:GPSLongitude=-134.403743603',
  '-EXIF:GPSLongitudeRef=W'
]);

var created = moment.unix(mediaData.image.json.created_time);  // local time
var created_ymd = created.format('YYYY:MM:DD');
var created_hms = created.format('HH:mm:ssZ');
var created_ymd_hms = `${created_ymd} ${created_hms}`;

var args_without_gps = args_common.concat([
  '-EXIF:DateTimeOriginal=' + created_ymd_hms,
  '-IPTC:DateCreated=' + created_ymd,
  '-IPTC:TimeCreated=' + created_hms,
  '-XMP:DateCreated=' + created_ymd_hms
]);

module.exports = {
  args: args_with_gps,
  argsWithoutGPS: args_without_gps
};
