'use strict';

var logger = require('../lib/logger.js');

describe('logger', function() {

  describe('logger.log', function() {

    it('calls console.log', function() {
      spyOn(console, 'log');
      logger.log('foo');
      expect(console.log).toHaveBeenCalled();
    });
  });

});
