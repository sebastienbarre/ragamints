'use strict';

var rewire = require('rewire');

var log = rewire('../lib/log.js');

describe('log', function() {

  describe('output', function() {
    var output = log.__get__('output');

    it('calls console.log for output', function() {
      spyOn(console, 'log');
      log.output('foo');
      expect(console.log).toHaveBeenCalled();
    });
  });

});
