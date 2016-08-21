// body
//   #react-root
//     section
//       main
//         article           - the main page
//           header          - the header
//           div
//             div           - media area, which will receive more rows of photos as we scroll
//               div         - a row of 3 media
//               ...
//               div         - another row of 3 media
//                 a         - [href] to photo page, ex: /p/BJEFDFDhkzy/?taken-by=sebastienbarre
//                   div
//                     div
//                       img - [alt] partial caption, [src] media thumbnail
//             div           - some iframe
//             div           - the Load More button

// https://github.com/segmentio/nightmare/blob/master/test/index.js
// var url = require('url');
// function fixture(path) {
//   return url.resolve(base, path);
// }
// .goto(fixture('navigation'))
// doc url.resolve('/one/two/three', 'four')         // '/one/two/four'
// var base = 'http://localhost:7500/';
// server.listen(7500, done);
// var app = module.exports = express();
// var serve = require('serve-static');
// app.use(serve(path.resolve(__dirname, 'fixtures')));

// https://github.com/rosshinkley/nightmare-examples/blob/master/docs/beginner/vo.md
// https://github.com/rosshinkley/nightmare-examples/blob/master/docs/common-pitfalls/async-operations-loops.md
// https://github.com/segmentio/nightmare/issues/703
// https://github.com/segmentio/nightmare/issues/625

var Nightmare = require('nightmare');
var vo = require('vo');

// https://github.com/rosshinkley/nightmare-load-filter
require('nightmare-load-filter')(Nightmare);

var nightmare = Nightmare({
  show: false,
  webPreferences: {
    images: false // disable images. how to disable fonts load or css
  }
});

var filtered_urls = [
  // 'https://connect.facebook.net/en_US/sdk.js',
  '*://connect.facebook.net/*/sdk.js',
  // 'https://connect.facebook.net/fbevents/sdk.js',
  '*://connect.facebook.net/*/fbevents.js',
  // https://instagramstatic-a.akamaihd.net/h1/webfonts/proximanova-reg-webfont.ttf/99e19808976a.ttf
  '*://*.akamaihd.net/*/webfonts/*',
  // => https://instagramstatic-a.akamaihd.net/h1/scripts/webfont.js/c0456c81549b.js
  '*://*.akamaihd.net/*/webfont.js/*',
  // => https://www.instagram.com/ajax/bz
  '*://www.instagram.com/ajax/*',
];

var getCurrentHeight = function() {
  return function(nightmare) {
    nightmare.evaluate(function() {
      return document.body.scrollHeight;
    });
  };
};

var getMedias = function() {
  return function(nightmare) {
    nightmare.evaluate(function() {
      var nodes = document.querySelectorAll('article > div > div > div > a');
      var hrefs = [];
      for (var i = 0; i < nodes.length; ++i) {
        hrefs.push(nodes[i].href);
      }
      return hrefs;
    });
  };
};

var run = function*(url) {
  yield nightmare
    .filter({
      urls: filtered_urls
    }, function(details, cb) {
      console.log(details.url); // use DEBUG=electron:stdout to show
      return cb({ cancel: true });
    })
    .goto(url)
    .wait('#react-root'); // we have the first page (12)

  // Load another page (12 + 12 = 24)
  yield nightmare.click('article > div > div > a').wait(1000);

  // From here "Load more" is gone, and new pages come up as we scroll down infinitely
  // Let's scroll down to bring another page (24 + 12 = 36)
  var currentHeight = yield nightmare.use(getCurrentHeight());
  yield nightmare.scrollTo(currentHeight, 0).wait(1000);

  // Let's scroll down to bring another page (36 + 12 = 48)
  var currentHeight = yield nightmare.use(getCurrentHeight());
  yield nightmare.scrollTo(currentHeight, 0).wait(1000);

  // Get medias
  var result = yield nightmare.use(getMedias());
  yield nightmare.end();
  return result;
};

var url = 'https://www.instagram.com/sebastienbarre/';
vo(run)(url, function(err, result) {
  if (err) {
    console.error('an error occurred: ' + err);
  }
  console.log('Retrieved: ', result.length);
  console.log(result);
});
