'use strict';

var iojs         = require('is-iojs');
var Jasmine      = require('jasmine');
var SpecReporter = require('jasmine-spec-reporter');

if (!iojs) {
  var pjson = require('../../package.json');
  require('babel/register')({
    ignore: new RegExp(pjson.name + '/node_modules')
  });
}

var noop = function() {};
var jrunner = new Jasmine();
jrunner.configureDefaultReporter({print: noop}); // remove default reporters
jasmine.getEnv().addReporter(new SpecReporter());
jrunner.loadConfigFile();
jrunner.execute();
