'use strict';

var iojs         = require('is-iojs');
var Jasmine      = require('jasmine');
var SpecReporter = require('jasmine-spec-reporter');

// Thanks for maximilianschmitt for this launcher
// https://gist.github.com/maximilianschmitt/8ef57cb679fbf764b108
if (!iojs && Number(process.version.match(/^v(\d+)/)[1]) < 4) {
  // var pjson = require('../../package.json');
  require('babel-register')({
    // ignore: new RegExp(pjson.name + '/node_modules')
  });
  require('babel-polyfill');
}

var noop = function() {};
var jrunner = new Jasmine();
jrunner.configureDefaultReporter({print: noop}); // remove default reporters
// https://github.com/bcaudan/jasmine-spec-reporter
jasmine.getEnv().addReporter(new SpecReporter({displayStacktrace: 'specs'}));
jrunner.loadConfigFile();
jrunner.execute();
