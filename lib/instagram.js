'use strict';

var ig = require('instagram-node').instagram();
module.exports = {
  use: ig.use,
  user_media_recent: ig.user_media_recent,
  user_search: ig.user_search
};
