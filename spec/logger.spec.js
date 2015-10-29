'use strict';

var rewire = require('rewire');

var logger = rewire('../lib/logger.js');

describe('logger', function() {

  describe('log', function() {
    var log = logger.__get__('log');

    it('calls console.log', function() {
      spyOn(console, 'log');
      logger.log('foo');
      expect(console.log).toHaveBeenCalled();
    });
  });

});
