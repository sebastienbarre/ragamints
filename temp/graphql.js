// curl 'https://www.instagram.com/query/' -H 'Accept: */*'  -H 'Accept-Language: en-US,en;q=0.5' -H 'Content-Type: application/x-www-form-urlencoded' -H 'Cookie: csrftoken=ABCDEFGHIJK' -H 'Referer: https://www.instagram.com/sebastienbarre/' -H 'X-CSRFToken: ABCDEFGHIJK' --data 'q=ig_user(26667401)+%7B+media.after(1183336809898544068%2C+5)+%7B%0A++count%2C%0A++nodes+%7B%0A++++caption%2C%0A++++code%2C%0A++++comments+%7B%0A++++++count%0A++++%7D%2C%0A++++comments_disabled%2C%0A++++date%2C%0A++++dimensions+%7B%0A++++++height%2C%0A++++++width%0A++++%7D%2C%0A++++display_src%2C%0A++++id%2C%0A++++is_video%2C%0A++++likes+%7B%0A++++++count%0A++++%7D%2C%0A++++owner+%7B%0A++++++id%2Cpassword%0A++++%7D%2C%0A++++thumbnail_src%2C%0A++++video_views%0A++%7D%2C%0A++page_info%0A%7D%0A+%7D&ref=users%3A%3Ashow'

var _map = require('lodash/map');
var request = require('superagent');
var fs = require('fs');

// .after(1226314477807700661, 5)
var gql = `
ig_user(26667401) {
  media.after(null, 5) {
    count,
    nodes {
      id,
      code,
      caption,
      caption_is_edited,
      is_video,
      comments_disabled,
      date,
      dimensions {
        height,
        width
      },
      display_src,
      thumbnail_src,
      likes {
        count
      },
      comments {
        count
      },
      usertags {
        nodes {
          x,
          y,
          user {
            id,
            username,
            full_name
          }
        }
      },
      owner {
        id,
        username,
        profile_pic_url,
        full_name
      },
      location {
        has_public_page,
        id,
        name,
        lat,
        lng
      },
      video_views
    },
    page_info
  }
}`;

var endpoint = 'https://www.instagram.com/query/';
var csrf_token = 'ABCDEFGHIJK';
var headers = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.5',
  'content-type': 'application/x-www-form-urlencoded',
  'cookie': 'csrftoken=' + csrf_token,
  'referer': 'https://www.instagram.com/sebastienbarre/',
  'x-csrftoken': csrf_token
};

request
  .post(endpoint)
  .set(headers)
  .send({ q: gql })
  .end(function(err, res) {
    if (err) {
      console.error('an error occurred: ' + err);
    }
    var gql_response = JSON.parse(res.text);
    var nodes_count = gql_response.media.nodes.length;
    // var first_media_id = gql_response.media.nodes[0].id;
    // var last_media_id = gql_response.media.nodes[nodes_count - 1].id;
    // var filename = `medias-${nodes_count}-from-${first_media_id}-to-${last_media_id}.json`;
    // fs.writeFile(filename, JSON.stringify(gql_response.media.nodes), function(err) {
    //   if(err) {
    //     return console.log(err);
    //   }
    //   console.log('Wrote to: ', filename);
    // });
    console.log('Retrieved', nodes_count, 'nodes of', gql_response.media.count);
    console.log(_map(gql_response.media.nodes, 'caption'));
    // console.log(gql_response.media.nodes[nodes_count - 1]);
  });
