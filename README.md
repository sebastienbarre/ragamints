# Ragamints

[![Build Status][_self_:build-status:shield]][_self_:build-status] [![Coverage Status][_self_:coverage:shield]][_self_:coverage] [![Dependencies Status][_self_:dependencies-status:shield]][_self_:dependencies-status] [![Node Version][_self_:node-version:shield]][_self_:node-version] [![License][_self_:license:shield]][BSD License] [![semantic-release][semantic-release:shield]][semantic-release] [![Commitizen friendly][commitizen:shield]][commitizen]

Ragamints is a command-line interface for Node.js. It is intended for downloading Instagram photos while preserving caption, photographer name, geolocation, tags, and creation time as EXIF, IPTC, and XMP fields.

Ragamints may come handy when importing Instagram photos back to applications that can interpret such metadata. [Adobe Lightroom] or [Google+] will happily re-use the caption and GPS location originally set from Instagram, for example.

<img src="doc/ragamints.gif" width="564px" height="170px" />

**WARNING: ON JUNE 1, 2016 INSTAGRAM SEVERELY RESTRICTED WHAT ANY THIRD-PARTY INSTAGRAM APPLICATION CAN DO.**

It is very unfortunate that Instagram decided to turn their back on developers. Tools such as `ragamints` are now considered [invalid use cases][instagram-invalid-use-cases] and constrained to a [Sandbox mode][instagram-sandbox-mode]. This effectively blocks most of `ragamints` functionalities. You will need to generate a new access token, which will grant you access to your 20 most recent media, with reduced API [rate limits][instagram-rate-limits]. That's about it. You will no longer be able to download photos from other Instagram accounts, perform searches, or access any of your photos past the first 20. I will keep `ragamints` alive for the time being, should Instagram relax its policy.

For more on this issue:
- [Instagram hates developers]
- [Instagram to third-party developers: drop dead]
- [I quit Instagram]

## Table of Contents

<!-- MarkdownTOC autolink=true bracket=round -->

- [Installation](#installation)
- [Requirements](#requirements)
- [Usage](#usage)
- [Examples](#examples)
- [Timezones](#timezones)
- [Supported Metadata](#supported-metadata)
- [Performance](#performance)
- [Thanks](#thanks)
- [Troubleshooting](#troubleshooting)
- [Authors](#authors)
- [Contribute](#contribute)
- [License](#license)
- [Change Log](#change-log)

<!-- /MarkdownTOC -->

## Installation

[![NPM][_self_:npm:badge]][_self_:npm]

Using [npm] >= 0.11:

```bash
$ npm install ragamints -g
```

Don't forget `-g`. Note that there are two specific **requirements** to meet for `ragamints` to work -- an *Instagram Access Token* and *ExifTool*. Read on.

## Requirements

### Instagram Access Token

Since `ragamints` talks to the Instagram API, it does require an API Client Key, which I can't provide in this source code. Fortunately, obtaining such Access Token is a breeze.

1. Head to the [Instagram Developers Page], and click on **Register Your Application**,
2. Click on **Register a New Client** from the [Manage Clients][instagram-register-app] page,
3. Set **Application Name** to any identifier, say, `ineedatoken`,
4. Set **Description**, **Company Name**, and **Website URL** to anything,
5. Set **Valid redirect URIs** to `http://localhost`,
4. Set **Contact email** to your email,
5. In the **Security** tab, uncheck **[ ] Disable implicit OAuth:**, and uncheck **[ ] Enforce signed requests:**,
7. Answer the Captcha challenge,
8. Click on the **Register** button to submit your client,
9. Write down your new **CLIENT ID**, a 32-characters long string,
10. Navigate to the following URL in your web browser, replacing `[CLIENT_ID]` with your actual **CLIENT ID**: `https://instagram.com/oauth/authorize/?client_id=[CLIENT_ID]&redirect_uri=http://localhost&response_type=token&scope=public_content`
11. Click on **Authorize** when Instagram asks you to grant access to your account.
12. Once redirected to your localhost, your newly generated **ACCESS TOKEN** will be appended to the url after `http://localhost/#access_token=`. It should be about 50-characters long. Congratulations. Write it down, do not share it.

If the above doesn't work, I'd recommend reading [How to get Instagram API access token] by Brandon Webster.

### ExifTool

Ragamints leverages Phil Harvey's excellent [ExifTool] to manipulate metadata. There are stand-alone Windows and Mac OSX executables ready to download -- just make sure ExifTool can be found in your `PATH`. If you are using [Homebrew] on a Mac already, this will do too:

```bash
$ brew install exiftool
$ exiftool -ver
9.90
```

## Usage

Show available commands:
```
$ ragamints

Commands:
  download  download medias from Instagram

Options:
  -h, --help  Show help  [boolean]

Check the man page or README file for more
```

Show available options for the `download` command:
```

$ ragamints download --help

Options:
  -u, --user-id          Instagram user ID (or user name)  [string]
  -c, --count            Maximum count of medias to download
  -m, --min-id           Only medias posted later than this media id/url (included)  [string]
  -n, --max-id           Only medias posted earlier than this media id/url (excluded)  [string]
  -s, --sequential       Process sequentially (slower)  [boolean] [default: false]
  -i, --include-videos   Include videos (skipped by default)  [boolean] [default: false]
  -d, --dest             Destination directory  [string] [default: "./"]
  -a, --always-download  Always download, even if media is saved already  [boolean] [default: false]
  -j, --json             Save media json object (accepts keys to pluck)  [default: false]
  -r, --resolution       Resolution(s) to download, e.g. high_resolution,standard_resolution,low_resolution,thumbnail  [string]
  -t, --access-token     Instagram Access Token  [string]
  -l, --clear-cache      Clear the cache  [boolean] [default: false]
  -v, --verbose          Output more info  [boolean] [default: false]
  -q, --quiet            Output less info  [boolean] [default: false]
  --config               Load config file  [default: "~/.ragamints.json"]
  -h, --help             Show help  [boolean]

Check the man page or README file for more
```

## Examples

In the examples presented below, `[ACCESS TOKEN]` is to be replaced with your **Instagram Access Token** (see the [Requirements](#requirements) section). Alternatively, you may omit `--access-token` by:

* setting the `RAGAMINTS_ACCESS_TOKEN` environment variable beforehand.
```bash
$ export RAGAMINTS_ACCESS_TOKEN=[ACCESS_TOKEN]
```

* or setting the corresponding option in a default `.ragamints.json` configuration file in your `HOME` directory, or any other configuration file of your choosing using the `--config` option.
```json
{
  "access-token": [ACCESS_TOKEN]
}
```

### Fetch your last *n* medias

**WARNING: THIS FUNCTIONALITY WAS AFFECTED BY THE NEW INSTAGRAM API AS OF JUNE 1, 2016. YOU WILL NO LONGER BE ABLE TO FETCH MORE THAN YOUR FIRST 20 MEDIAS.**

Let's fetch the last 3 medias from my [Instagram feed][sebastienbarre:Instagram]. `ragamints` will output how it interpreted some of its arguments, and what is being done for each media. Each step references a media by an index (`#0001`, `#0002`, ...) followed by a short excerpt from its caption (`[Back home. Done sp]`). In this example two steps can be identified for each media -- fetching the file and updating its metadata.

```
$ ragamints download --access-token [ACCESS_TOKEN] --user-id sebastienbarre --count 3
Found user ID 26667401 for username sebastienbarre
Found 3 media(s), nothing more.
#0001 [Back home. Done sp] Fetched 2015-05-04_1430734958.jpg
#0001 [Back home. Done sp] Updated metadata in 2015-05-04_1430734958.jpg
#0002 [The Dtonbori canal] Fetched 2015-05-04_1430734351.jpg
#0002 [The Dtonbori canal] Updated metadata in 2015-05-04_1430734351.jpg
#0003 [Neither Times Squa] Fetched 2015-05-04_1430734239.jpg
#0003 [Neither Times Squa] Updated metadata in 2015-05-04_1430734239.jpg
Done processing 3 media(s). Easy peasy.

$ ls -lh *.jpg | awk '{print $9, $5}'
2015-05-04_1430734239.jpg 157K
2015-05-04_1430734351.jpg 177K
2015-05-04_1430734958.jpg 154K
```

Note that I reordered the indexes numerically for clarity. All network requests being performed in parallel for performance, it is unlikely such ordering will occur. Whichever file finishes downloading first (likely the smallest) will appear first.

The highest known image resolution is fetched by default but `--resolution` can be used to download specific resolutions as well -- Instagram stores multiple on its servers. Conversely, use `--no-resolution` to skip all of them, say, if you wanted to use `--json` on its own. Video files are not fetched by default, unless `--include-videos` is specified.

### Fetch all medias found between two specific medias

**WARNING: THIS FUNCTIONALITY WAS DISABLED BY THE NEW INSTAGRAM API AS OF JUNE 1, 2016.**

Let's fetch the medias I had posted *later in time than (but including)* https://instagram.com/p/2QY1JYJYqN/ (`--min-id`), and *earlier in time than (but excluding)* https://instagram.com/p/2QZcrCpYrM/ (`--max-id`). I'm using my user ID here (`26667401`) instead of my username (`sebastienbarre`) to save a round-trip. The Instagram API expects both `--min-id` and `--max-id` to reference media IDs, but these can be difficult to gather -- use photo URLs instead and `ragamints` will look-up these IDs for you.

```
$ ragamints download --access-token [ACCESS_TOKEN] --user-id 26667401 --min-id https://instagram.com/p/2QY1JYJYqN/ --max-id https://instagram.com/p/2QZcrCpYrM/
Found media ID 977393040662825676_26667401 for media url https://instagram.com/p/2QZcrCpYrM/
Found media ID 977390324456721037_26667401 for media url https://instagram.com/p/2QY1JYJYqN/
Found 2 media(s), nothing more.
#0001 [Neither Times Squa] Saved already as 2015-05-04_1430734239.jpg
#0001 [Neither Times Squa] Updated metadata in 2015-05-04_1430734239.jpg
#0002 [Last sunset in Osa] Fetched 2015-05-04_1430734027.jpg
#0002 [Last sunset in Osa] Updated metadata in 2015-05-04_1430734027.jpg
Done processing 2 media(s). Easy peasy.
```

Note that `#0001` was *not* fetched, as it had been saved already in our previous example -- a photo can not be replaced on Instagram, it is assumed its contents has not changed; its metadata *is* updated though, since captions *can* be edited. Use `--always-download` to force `ragamints` to always fetch.

### Fetch all medias found between two timestamps

**WARNING: THIS FUNCTIONALITY WAS COMPLETELY REMOVED FROM THE INSTAGRAM API AS OF JUNE 1, 2016.**

Let's fetch the medias I had posted *later in time than* 5 weeks ago (`--min-timestamp`), but *earlier in time than* 10 days ago (`--max-timestamp`). The Instagram API expects both `--min-timestamp` and `--max-timestamp` to reference a [Unix Timestamp] but `ragamints` will accept [a variety of date formats][sugarjs], for convenience. The `--dest` parameter can be used to save to a specific folder (here, `archive`).

```
$ ragamints download --access-token [ACCESS_TOKEN] --user-id 26667401 --dest archive --max-timestamp '10 days ago' --min-timestamp '5 weeks ago' --quiet
Min Timestamp: 5 weeks ago is 2015-04-08T21:19:46-04:00 (1428542386)
Max Timestamp: 10 days ago is 2015-05-03T21:19:46-04:00 (1430702386)
Found 33 media(s), more to come...
Found another 33 media(s), more to come...
Found another 30 media(s), nothing more.
Done processing 96 media(s). Easy peasy.
```

Note that the Instagram API paginate its results -- 33 at a time, as of this writing. `ragamints` will fetch 33, start downloading all medias in parallel, then fetch another 33, etc., until it is done. Use `--quiet` to hide intermediate steps.

## Timezones

The Instagram API exposes a media's Creation Date/Time as a [Unix Timestamp], i.e. as the number of seconds that have elapsed since 00:00:00 Coordinated Universal Time (UTC), Thursday, 1 January 1970, not counting leap seconds.

For example, `1428542386` refers to *Thu, 09 Apr 2015 01:19:46 +0000* (UTC). Since Instagram does not encode (or expose) the timezone directly, this timestamp does not tell us what the *local time* was *where* you took the photo:

* possibly *Wed, 08 Apr 2015 21:19:46 -0400* in New York City, USA ([EDT] - Eastern Daylight Time, 4 hours behind UTC),
* or maybe *Thu, 09 Apr 2015 10:19:46 +0900* in Tokyo, Japan ([JST] - Japan Standard Time, 9 hours ahead of UTC).

Now these two possibilities above still refer to the same moment in time, so this wouldn't be such an issue if we could encode this Unix Timestamp in the same way in our JPEG metadata fields, be it `EXIF:DateTimeOriginal` or `XMP:DateCreated`. This isn't quite the case though, as the [ExifTool FAQ][] points out.

What `ragamints` *can* do, though, is look at the GPS location, infer the timezone, and store the date/time with the timezone offset, say `2015:04:08 21:19:46-04:00`. This conveys exactly when the picture was taken, in local time. If no GPS location is found, it is assumed the picture was taken in the current timezone.

Use `--verbose` to display which timezone was picked. In the example below, the first picture was taken in Tokyo and the second one in New York.

```
$ ragamints download --access-token [ACCESS_TOKEN] --user-id 26667401 --max-timestamp '23 days ago' --min-timestamp '30 days ago' --verbose
Min Timestamp: 30 days ago is 2015-04-14T13:21:45-04:00 (1429030905)
Max Timestamp: 23 days ago is 2015-04-21T13:21:45-04:00 (1429635705)
Found 2 media(s), nothing more.
#0001 [After a long journ] Fetched 2015-04-21_1429621553.jpg
#0001 [After a long journ] Timezone is Asia/Tokyo
#0001 [After a long journ] Creation time stored as 2015-04-21T22:05:53+09:00
#0001 [After a long journ] Updated metadata in 2015-04-21_1429621553.jpg
#0002 [PSA: Spring is her] Fetched 2015-04-19_1429475496.jpg
#0002 [PSA: Spring is her] Timezone is America/New_York
#0002 [PSA: Spring is her] Creation time stored as 2015-04-19T16:31:36-04:00
#0002 [PSA: Spring is her] Updated metadata in 2015-04-19_1429475496.jpg
Done processing 2 media(s). Easy peasy.
```

## Supported Metadata

The following metadata fields are set on each JPEG file, if the corresponding Instagram fields are found. Video files are not updated -- they are not fetched by default either, unless `--include-videos` is used.

| Metadata Field          | Instagram Field            |
|-------------------------|----------------------------|
| `EXIF:Artist`           | Profile Name               |
| `EXIF:Copyright`        | Copyright + Profile Name   |
| `EXIF:DateTimeOriginal` | Media Creation Date/Time   |
| `EXIF:GPSLatitude`      | GPS Latitude               |
| `EXIF:GPSLatitudeRef`   | N or S                     |
| `EXIF:GPSLongitude`     | GPS Longitude              |
| `EXIF:GPSLongitudeRef`  | E or W                     |
| `EXIF:ImageDescription` | Media Caption              |
| `IPTC:Caption-Abstract` | Media Caption              |
| `IPTC:CopyrightNotice`  | Copyright + Profile Name   |
| `IPTC:DateCreated`      | Media Creation Date        |
| `IPTC:Keywords`         | Tags                       |
| `IPTC:TimeCreated`      | Media Creation Time        |
| `XMP:Creator`           | Profile Name               |
| `XMP:DateCreated`       | Media Creation Date/Time   |
| `XMP:Description`       | Media Caption              |
| `XMP:Rights`            | Copyright + Profile Name   |
| `XMP:Subject`           | Tags                       |

## Performance

* All networks requests are performed in parallel whenever possible.
* `ragamints` makes heavy use of [ES6 Promises & Generators][archibald:promises] and therefore requires an extra-step at run-time to transpile to ES5 for [Node.js]. Use [io.js] to avoid that overhead.
* The `--user-id`, `--min-id`, and `--max-id` options require a round-trip to the Instagram API to resolve usernames and photo URLs back to user ids and photo ids, respectively. Use ids whenever possible.

## Thanks

* [Max Schmitt][maximilianschmitt] for his gist on [Making io.js CLI apps compatible with node.js][iojs-nodejs-compatibility],
* [TOTEMS::Tech][totemstech] for providing a no-nonsense [instagram-node] driver,
* [The good people][momentjs:contributors] behind [momentjs],
* [Matt Bornski][mattbornski] for providing Timezone Lookup code in [tzwhere],
* [The Dark Sky Company][darkskyapp] for providing a faster Timezone Lookup code in [tz-lookup],
* [Jake Archibald] for his 2013 post on [Promises and Generators][archibald:promises],
* [John MacFarlane] for [pandoc], a universal document converter.

## Troubleshooting

#### `npm WARN optional dep failed, continuing fsevents@n.n.n`

You may see this message when installing `ragamints` on Windows. It is *not* indicative of a problem and originates from the [chokidar] npm module, a dependency of the [babel] module, the ES6 transpiler. [FSEvents][fsevents:wiki] is an API only available on OS X. The [fsevents][fsevents:github] npm module, which provides a node interface to that OS API, cannot be built on systems other than OS X and thus is marked as "optional dependency" by modules such as [chokidar], and reported as such.

### `This request requires scope=public_content, but this access token is not authorized with this scope. The user must re-authorize your application with scope=public_content to be granted this permissions.`

You may encounter this error if you generated an Instagram token before Instagram made changes to its API in June of 2016. You will need to create a new token.

## Authors

**Sebastien Barre**

* Email: sebastien.barre@gmail.com
* Twitter: [sebastienbarre][sebastienbarre:Twitter]
* Instagram: [sebastienbarre][sebastienbarre:Instagram]

## Contribute

* Check for [open issues][_self_:issues], especially the ones [up-for-grabs][_self_:issues:up-for-grabs], or open a fresh issue to start a discussion around a feature idea or a bug.
* If you feel uncomfortable or uncertain about an issue or your changes, feel free to [email me][sebastienbarre:email] and I will happily give you a hand.
* Fork the [repository][_self_:repo] on GitHub to start making your changes to the *master* branch (or branch off of it).
* Write a test which shows that the bug was fixed or that the feature works as expected.
* Do *not* use `git commit` to commit your code; use `npm run commit` instead; this will ensure a [Commitizen]-friendly commit message will be generated, a convention that will in turn be leveraged by [semantic-release].
* Send a pull request and notify me :) Thanks.

## License

This software is released under the [BSD License].

## Change Log

All notable changes to this project are documented automatically on the Github [releases][_self_:releases] page. This project believes in [Semantic Versioning] and [Keep a CHANGELOG]. It uses [commitizen] and [semantic-release] to help with that endeavor.

[_self_:build-status:shield]: https://img.shields.io/travis/sebastienbarre/ragamints.svg
[_self_:build-status]: https://travis-ci.org/sebastienbarre/ragamints
[_self_:coverage:shield]: https://img.shields.io/codecov/c/github/sebastienbarre/ragamints.svg
[_self_:coverage]: https://codecov.io/github/sebastienbarre/ragamints
[_self_:dependencies-status:shield]: https://img.shields.io/gemnasium/sebastienbarre/ragamints.svg
[_self_:dependencies-status]: https://gemnasium.com/sebastienbarre/ragamints
[_self_:issues:up-for-grabs]: https://github.com/sebastienbarre/ragamints/labels/up-for-grabs
[_self_:issues]: https://github.com/sebastienbarre/ragamints/issues
[_self_:license:shield]: https://img.shields.io/npm/l/ragamints.svg
[_self_:node-version:shield]: https://img.shields.io/node/v/ragamints.svg
[_self_:node-version]: https://www.npmjs.com/package/ragamints
[_self_:npm:badge]: https://nodei.co/npm/ragamints.png?downloads=true
[_self_:npm]: https://nodei.co/npm/ragamints/
[_self_:releases]: https://github.com/sebastienbarre/ragamints/releases
[_self_:repo]: https://github.com/sebastienbarre/ragamints
[Adobe Lightroom]: https://lightroom.adobe.com/
[archibald:promises]: http://www.html5rocks.com/en/tutorials/es6/promises/
[babel]: https://github.com/babel/babel
[BSD License]: http://opensource.org/licenses/BSD-3-Clause
[chokidar]: https://github.com/paulmillr/chokidar
[commitizen:shield]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen]: https://github.com/commitizen/cz-cli
[darkskyapp]: https://github.com/darkskyapp
[EDT]: http://www.timeanddate.com/time/zones/edt
[EXIF]: http://en.wikipedia.org/wiki/Exchangeable_image_file_format
[ExifTool FAQ]: http://www.sno.phy.queensu.ca/~phil/exiftool/faq.html#Q5
[ExifTool]:  http://www.sno.phy.queensu.ca/~phil/exiftool/
[fsevents:github]: https://github.com/strongloop/fsevents
[FSEvents:wiki]: http://en.wikipedia.org/wiki/FSEvents
[Google+]: https://plus.google.com/
[Homebrew]: http://brew.sh/
[How to get Instagram API access token]: https://medium.com/@bkwebster/how-to-get-instagram-api-access-token-and-fix-your-broken-feed-c8ad470e3f02#.z5xed2tbz
[I quit Instagram]: https://inbound.org/discuss/i-quit-instagram
[Instagram Developers Page]: https://instagram.com/developer/
[Instagram hates developers]: https://writing.natwelch.com/post/585
[Instagram to third-party developers: drop dead]: http://www.zeldman.com/2016/06/04/instagram-third-party-developers-drop-dead/
[instagram-invalid-use-cases]: https://www.instagram.com/developer/authorization/
[instagram-node]: https://github.com/totemstech/instagram-node
[instagram-rate-limits]: https://www.instagram.com/developer/limits/
[instagram-register-app]: https://instagram.com/developer/clients/manage/
[instagram-sandbox-mode]: https://www.instagram.com/developer/sandbox/
[Instagram]: http://instagram.com
[io.js]: https://iojs.org/
[iojs-nodejs-compatibility]: https://gist.github.com/maximilianschmitt/8ef57cb679fbf764b108
[IPTC]: http://en.wikipedia.org/wiki/IPTC_Information_Interchange_Model
[Jake Archibald]: http://jakearchibald.com/
[John MacFarlane]: http://johnmacfarlane.net/
[JST]: http://www.timeanddate.com/time/zones/jst
[Keep a CHANGELOG]: http://keepachangelog.com/
[mattbornski]: https://github.com/mattbornski
[maximilianschmitt]: https://github.com/maximilianschmitt
[momentjs:contributors]: https://github.com/moment/moment/graphs/contributors
[momentjs]:http://momentjs.com/
[Node.js]: https://nodejs.org/
[npm]: https://www.npmjs.com/
[pandoc]: http://pandoc.org/
[sebastienbarre:email]: mailto:sebastien.barre@gmail.com
[sebastienbarre:Instagram]: https://instagram.com/sebastienbarre/
[sebastienbarre:Twitter]: https://twitter.com/sebastienbarre/
[Semantic Versioning]: http://semver.org/
[semantic-release:shield]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release]: https://github.com/semantic-release/semantic-release
[sugarjs]: http://sugarjs.com/features#date
[totemstech]: https://github.com/totemstech
[tz-lookup]: https://github.com/darkskyapp/tz-lookup
[tzwhere]: https://github.com/mattbornski/tzwhere
[Unix Timestamp]: http://en.wikipedia.org/wiki/Unix_time
[XMP]: http://en.wikipedia.org/wiki/Extensible_Metadata_Platform

