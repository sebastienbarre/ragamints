'use strict';

var rewire = require('rewire');

var utils = rewire('../lib/utils.js');

describe('utils', function() {

  describe('padRight', function() {
    var padRight = utils.__get__('padRight');

    it('pads a string to the right', function() {
      expect(padRight('foo',
      ' ', 5)).toEqual('foo  ');
    });
  });

  describe('padLeftZero', function() {
    var padLeftZero = utils.__get__('padLeftZero');

    it('pads a number to the left with zeros', function() {
      expect(padLeftZero(15, 4)).toEqual('0015');
    });
  });

  describe('isUnixTimestamp', function() {
    var isUnixTimestamp = utils.__get__('isUnixTimestamp');

    it('checks if a timestamp is valid', function() {
      expect(isUnixTimestamp('1430734958')).toBe(true);
    });

    it('checks if a timestamp is invalid', function() {
      expect(isUnixTimestamp('foobar')).not.toBe(true);
    });
  });

});
