const utils = require('../../lib/core/utils');

describe('core.utils', () => {
  describe('core.utils.padRight', () => {
    it('pads a string to the right', () => {
      expect(utils.padRight('foo', ' ', 5)).toEqual('foo  ');
    });
  });

  describe('core.utils.padLeftZero', () => {
    it('pads a number to the left with zeros', () => {
      expect(utils.padLeftZero(15, 4)).toEqual('0015');
    });
  });

  describe('core.utils.isUnixTimestamp', () => {
    it('checks if a timestamp is valid', () => {
      expect(utils.isUnixTimestamp('1430734958')).toBe(true);
    });

    it('checks if a timestamp is invalid', () => {
      expect(utils.isUnixTimestamp('foobar')).not.toBe(true);
    });
  });
});
