'use strict';

var moment    = require('moment-timezone');
var constants = require('../../lib/constants');
var mediaData = require('./media');

var standard_args_common = [
  '-q',
  '-q',
  '-codedcharacterset=utf8',
  '-overwrite_original',
  '-EXIF:Software=' + constants.SOFTWARE,
  '-XMP:CreatorTool=' + constants.SOFTWARE,
  '-EXIF:ImageDescription=Flower girl is picture-shy. #farmwedding #shy',
  '-IPTC:Caption-Abstract=Flower girl is picture-shy. #farmwedding #shy',
  '-XMP:Description=Flower girl is picture-shy. #farmwedding #shy',
  '-EXIF:Artist=Sébastien B',
  '-EXIF:Copyright=Copyright Sébastien B',
  '-IPTC:CopyrightNotice=Copyright Sébastien B',
  '-XMP:Creator=Sébastien B',
  '-XMP:Rights=Copyright Sébastien B',
  '-sep',
  ', ',
  '-IPTC:Keywords=farmwedding, shy',
  '-XMP:Subject=farmwedding, shy'
];

var standard_args_with_gps = standard_args_common.concat([
  '-EXIF:DateTimeOriginal=2015:05:30 18:41:28-04:00',
  '-IPTC:DateCreated=2015:05:30',
  '-IPTC:TimeCreated=18:41:28-04:00',
  '-XMP:DateCreated=2015:05:30 18:41:28-04:00',
  '-EXIF:GPSLatitude=42.6550407',
  '-EXIF:GPSLatitudeRef=N',
  '-EXIF:GPSLongitude=-73.9760895',
  '-EXIF:GPSLongitudeRef=W'
]);

var created = moment.unix(mediaData.image.standard.created_time); // local time
var created_ymd = created.format('YYYY:MM:DD');
var created_hms = created.format('HH:mm:ssZ');
var created_ymd_hms = `${created_ymd} ${created_hms}`;

var standard_args_without_gps = standard_args_common.concat([
  '-EXIF:DateTimeOriginal=' + created_ymd_hms,
  '-IPTC:DateCreated=' + created_ymd,
  '-IPTC:TimeCreated=' + created_hms,
  '-XMP:DateCreated=' + created_ymd_hms
]);

var high_args_with_gps = [
  '-q',
  '-q',
  '-codedcharacterset=utf8',
  '-overwrite_original',
  '-EXIF:Software=' + constants.SOFTWARE,
  '-XMP:CreatorTool=' + constants.SOFTWARE,
  '-EXIF:Artist=Sébastien B',
  '-EXIF:Copyright=Copyright Sébastien B',
  '-IPTC:CopyrightNotice=Copyright Sébastien B',
  '-XMP:Creator=Sébastien B',
  '-XMP:Rights=Copyright Sébastien B',
  '-EXIF:DateTimeOriginal=2015:11:22 03:06:49+05:00',
  '-IPTC:DateCreated=2015:11:22',
  '-IPTC:TimeCreated=03:06:49+05:00',
  '-XMP:DateCreated=2015:11:22 03:06:49+05:00',
  '-EXIF:GPSLatitude=-42.657302',
  '-EXIF:GPSLatitudeRef=S',
  '-EXIF:GPSLongitude=73.773118',
  '-EXIF:GPSLongitudeRef=E'
];

module.exports = {
  image: {
    standard: standard_args_with_gps,
    high: high_args_with_gps,
    no_gps: standard_args_without_gps
  }
};
