'use strict';

var logger = require('../../lib/core/logger.js');

describe('core.logger', function() {

  describe('core.logger.log', function() {

    it('calls console.log', function() {
      spyOn(console, 'log');
      logger.log('foo');
      expect(console.log).toHaveBeenCalled();
    });
  });

});
