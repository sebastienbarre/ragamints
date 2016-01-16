'use strict';

var rewire    = require('rewire');

var helpers   = require('./support/helpers');

var cli       = rewire('../lib/cli.js');

describe('cli', function() {
  var logger = cli.__get__('logger');

  describe('cli.resolveOptions', function() {
    var cache = cli.__get__('cache');
    var instagram = cli.__get__('instagram');
    var reverseSetProcess;

    beforeEach(function() {
      spyOn(cache, 'clear').and.callFake(helpers.promiseValue);
      spyOn(logger, 'log');
      spyOn(instagram.client, 'use');
      var env = {};
      env[instagram.constants.ACCESS_TOKEN_ENV_VAR] = 'token';
      reverseSetProcess = cli.__set__('process', {env: env});
    });

    afterEach(function() {
      reverseSetProcess();
    });

    it('resolves options', function(done) {
      var options = {
        verbose: true
      };
      var resolved_options = {
        verbose: true,
        instagramAccessToken: 'token'
      };
      cli.resolveOptions(options).then(function(res) {
        expect(instagram.client.use).toHaveBeenCalled();
        expect(cache.clear).not.toHaveBeenCalled();
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
        expect(cache.clear).toHaveBeenCalled();
        done();
      }, function(err) {
        done.fail(err);
      });
    });

    it('rejects when no access token is found', function(done) {
      cli.__set__('process', {env: {}});
      cli.resolveOptions({}).then(function() {
        done.fail(new Error('should not have succeeded'));
      }, function(err) {
        expect(err.message).toEqual(
          logger.formatErrorMessage('Need Instagram access token'));
        done();
      });
    });
  });

  describe('cli.main', function() {
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
      }
    }];
    cli.__set__('commands', commands);

    beforeEach(function() {
      spyOn(logger, 'log');
    });

    it('lists commands (then rejects) when none is provided', function(done) {
      var argv = [];
      cli.main(argv).then(function() {
        done.fail();
      }).catch(function() {
        var output = logger.log.calls.argsFor(0)[0];
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
        var output = logger.log.calls.argsFor(0)[0];
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
        var output = logger.log.calls.argsFor(0)[0];
        expect(output.indexOf('-d, --dest')).not.toBe(-1);
        expect(output.indexOf('-v, --verbose')).not.toBe(-1);
        expect(output.indexOf('-h, --help')).not.toBe(-1);
        done();
      });
    });

    it('runs a command when given one', function(done) {
      commands[0].run = helpers.promiseValue.bind(null, 'OK');
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

    it('rejects when a command fails', function(done) {
      commands[0].run = helpers.promiseRejectError;
      var argv = [
        'dummy'
      ];
      cli.main(argv).then(function() {
        done.fail();
      }, function(err) {
        expect(err.message).toBe('boom');
        expect(logger.log.calls.argsFor(0)[0].indexOf('--help')).not.toBe(-1);
        done();
      });
    });

  });

});
