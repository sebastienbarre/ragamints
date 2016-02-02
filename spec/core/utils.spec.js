'use strict';

var utils = require('../../lib/core/utils.js');

describe('core.utils', function() {

  describe('core.utils.padRight', function() {
    it('pads a string to the right', function() {
      expect(utils.padRight('foo',
      ' ', 5)).toEqual('foo  ');
    });
  });

  describe('core.utils.padLeftZero', function() {
    it('pads a number to the left with zeros', function() {
      expect(utils.padLeftZero(15, 4)).toEqual('0015');
    });
  });

  describe('core.utils.isUnixTimestamp', function() {
    it('checks if a timestamp is valid', function() {
      expect(utils.isUnixTimestamp('1430734958')).toBe(true);
    });

    it('checks if a timestamp is invalid', function() {
      expect(utils.isUnixTimestamp('foobar')).not.toBe(true);
    });
  });

});
