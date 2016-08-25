const assign = require('lodash/assign');

const image_standard_resolution = require('./image_standard_resolution.json');
const image_high_resolution = require('./image_high_resolution.json');
const video = require('./video.json');

const image_no_gps = assign({}, image_standard_resolution);
delete image_no_gps.location;

module.exports = {
  image: {
    high: image_high_resolution,
    standard: image_standard_resolution,
    no_gps: image_no_gps,
  },
  video: {
    standard: video,
  },
};
