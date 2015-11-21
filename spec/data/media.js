'use strict';

var _assign = require('lodash/object/assign');

var image_standard_resolution = require('./image_standard_resolution.json');
var image_high_resolution     = require('./image_high_resolution.json');
var video                     = require('./video.json');

var image_no_gps = _assign({}, image_standard_resolution);
delete image_no_gps.location;

module.exports = {
  image: {
    high: image_high_resolution,
    standard: image_standard_resolution,
    no_gps: image_no_gps
  },
  video: {
    standard: video
  }
};
