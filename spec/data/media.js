'use strict';

var extend = require('util')._extend;

var cdn = 'https://scontent.cdninstagram.com/hphotos-xat1/t51.2885-15/';

var image_json = {
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
var image_file_name = '2015-05-04_1430734958';
var image_basename = image_file_name + '.jpg';
var image_json_basename = image_file_name + '.json';
var image_default_resolution = 'standard_resolution';

var image_without_gps_json = extend({}, image_json);
delete image_without_gps_json.location;

var video_json = extend({}, image_json);
video_json.type = 'video';
video_json.videos = {
  'standard_resolution': {
    'url': cdn + '11193066_896012850450861_10425589_n.mp4'
  }
};
delete video_json.images;
var video_basename = image_file_name + '.mp4';

module.exports = {
  image: {
    json: image_json,
    fileName: image_file_name,
    basename: image_basename,
    jsonBasename: image_json_basename,
    defaultResolution: image_default_resolution
  },
  imageWithoutGPS: {
    json: image_without_gps_json
  },
  video: {
    json: video_json,
    basename: video_basename
  }
};
