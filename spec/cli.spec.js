'use strict';

var path     = require('path');
var rewire   = require('rewire');
var _flatten = require('lodash/flatten');

var helpers = require('./support/helpers');

var cli     = rewire('../lib/cli.js');

describe('cli', function() {
  var core = cli.__get__('core');

  describe('cli.resolveOptions', function() {

    beforeEach(function() {
      spyOn(core.cache, 'clear').and.callFake(helpers.promiseValue);
      spyOn(core.logger, 'log');
    });

    it('resolves command-line options', function(done) {
      var options = {
        verbose: true
      };
      var resolved_options = {
        verbose: true,
      };
      cli.resolveOptions(options).then(function(res) {
        expect(core.cache.clear).not.toHaveBeenCalled();
        expect(res).toEqual(resolved_options);
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('clears the cache before resolving options', function(done) {
      var options = {
        clearCache: true
      };
      cli.resolveOptions(options).then(function() {
        expect(core.cache.clear).toHaveBeenCalled();
        done();
      }, function(err) {
        done.fail(err);
      });
    });

  });

  describe('cli.main', function() {
    var fs = cli.__get__('fs');
    var JSON = cli.__get__('JSON');
    var commands = [{
      name: 'dummy',
      description: 'dummy command',
      options: {
        'd': {
          alias: 'dest',
          describe: 'Destination directory',
          type: 'string',
          default: './'
        }
      },
      run: helpers.promiseValue.bind(null, 'OK')
    }];
    cli.__set__('commands', commands);

    beforeEach(function() {
      spyOn(core.logger, 'log');
    });

    it('lists commands (then rejects) when none is provided', function(done) {
      var argv = [];
      cli.main(argv).then(function() {
        done.fail();
      }).catch(function() {
        var output = core.logger.log.calls.argsFor(0)[0];
        expect(output.indexOf('dummy  dummy command')).not.toBe(-1);
        expect(output.indexOf('-h, --help')).not.toBe(-1);
        done();
      });
    });

    it('lists commands (then rejects) on --help', function(done) {
      var argv = [
        '--help'
      ];
      cli.main(argv).catch(function() {
        var output = core.logger.log.calls.argsFor(0)[0];
        expect(output.indexOf('dummy  dummy command')).not.toBe(-1);
        expect(output.indexOf('-h, --help')).not.toBe(-1);
        done();
      });
    });

    it('lists options for a command on --help', function(done) {
      var argv = [
        'dummy',
        '--help'
      ];
      cli.main(argv).catch(function() {
        var output = core.logger.log.calls.argsFor(0)[0];
        expect(output.indexOf('-d, --dest')).not.toBe(-1);
        expect(output.indexOf('-v, --verbose')).not.toBe(-1);
        expect(output.indexOf('-h, --help')).not.toBe(-1);
        done();
      });
    });

    it('runs a command when given one', function(done) {
      var argv = [
        'dummy'
      ];
      cli.main(argv).then(function(output) {
        expect(output).toBe('OK');
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('reads command options from a config file', function(done) {
      var filename = path.resolve('.foorc');
      var argv = [
        'dummy',
        '--config',
        filename,
      ];
      var payload = { foo: true };
      spyOn(cli, 'resolveOptions').and.callThrough();
      var original_fs_readFileSync = fs.readFileSync;
      spyOn(fs, 'readFileSync').and.callFake(function(file, options) {
        if (file === filename) {
          return JSON.stringify(payload);
        }
        return original_fs_readFileSync(file, options);
      });
      cli.main(argv).then(function(output) {
        expect(_flatten(fs.readFileSync.calls.allArgs()).indexOf(filename)).not.toBe(-1);
        expect(cli.resolveOptions.calls.argsFor(0)[0].foo).toBe(payload.foo);
        expect(output).toBe('OK');
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('fails silently if a config file does not exist', function(done) {
      var filename = path.resolve('.foorc');
      var argv = [
        'dummy',
        '--config',
        filename,
      ];
      spyOn(cli, 'resolveOptions').and.callThrough();
      var original_fs_readFileSync = fs.readFileSync;
      spyOn(fs, 'readFileSync').and.callFake(function(file, options) {
        if (file === filename) {
          throw new Error('boom');
        }
        return original_fs_readFileSync(file, options);
      });
      cli.main(argv).then(function(output) {
        expect(_flatten(fs.readFileSync.calls.allArgs()).indexOf(filename)).not.toBe(-1);
        expect(cli.resolveOptions.calls.argsFor(0)[0].foo).toBe(undefined);
        expect(output).toBe('OK');
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('rejects when a command fails', function(done) {
      commands[0].run = helpers.promiseRejectError;
      var argv = [
        'dummy'
      ];
      cli.main(argv).then(function() {
        done.fail();
      }, function(err) {
        expect(err.message).toBe('boom');
        expect(
          core.logger.log.calls.argsFor(0)[0].indexOf('--help')).not.toBe(-1);
        done();
      });
    });

  });

});
