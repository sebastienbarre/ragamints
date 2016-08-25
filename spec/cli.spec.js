const path = require('path');
const rewire = require('rewire');
const flatten = require('lodash/flatten');

const helpers = require('./support/helpers');

const cli = rewire('../lib/cli.js');

describe('cli', () => {
  const core = cli.__get__('core');
  describe('cli.resolveOptions', () => {
    beforeEach(() => {
      spyOn(core.cache, 'clear').and.callFake(helpers.promiseValue);
      spyOn(core.logger, 'log');
    });

    it('resolves command-line options', (done) => {
      const options = {
        verbose: true,
      };
      const resolved_options = {
        verbose: true,
      };
      cli.resolveOptions(options).then((res) => {
        expect(core.cache.clear).not.toHaveBeenCalled();
        expect(res).toEqual(resolved_options);
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('clears the cache before resolving options', (done) => {
      const options = {
        clearCache: true,
      };
      cli.resolveOptions(options).then(() => {
        expect(core.cache.clear).toHaveBeenCalled();
        done();
      }, (err) => {
        done.fail(err);
      });
    });
  });

  describe('cli.main', () => {
    const fs = cli.__get__('fs');
    const JSON = cli.__get__('JSON');
    const dummy_command = {
      name: 'dummy',
      description: 'dummy command',
      options: {
        'd': {
          alias: 'dest',
          describe: 'Destination directory',
          type: 'string',
          default: './',
        },
      },
      run: helpers.promiseValue.bind(null, 'OK'),
    };
    cli.addCommand(dummy_command);

    beforeEach(() => {
      spyOn(core.logger, 'log');
    });

    it('lists commands (then rejects) when none is provided', (done) => {
      const argv = [];
      cli.main(argv).then(() => {
        done.fail();
      }).catch(() => {
        const output = core.logger.log.calls.argsFor(0)[0];
        expect(output.indexOf('dummy command')).not.toBe(-1);
        expect(output.indexOf('-h, --help')).not.toBe(-1);
        done();
      });
    });

    it('lists commands (then rejects) on --help', (done) => {
      const argv = [
        '--help',
      ];
      cli.main(argv).catch(() => {
        const output = core.logger.log.calls.argsFor(0)[0];
        expect(output.indexOf('dummy command')).not.toBe(-1);
        expect(output.indexOf('-h, --help')).not.toBe(-1);
        done();
      });
    });

    it('lists options for a command on --help', (done) => {
      const argv = [
        'dummy',
        '--help',
      ];
      cli.main(argv).catch(() => {
        const output = core.logger.log.calls.argsFor(0)[0];
        expect(output.indexOf('-d, --dest')).not.toBe(-1);
        expect(output.indexOf('-v, --verbose')).not.toBe(-1);
        expect(output.indexOf('-h, --help')).not.toBe(-1);
        done();
      });
    });

    it('runs a command when given one', (done) => {
      const argv = [
        'dummy',
      ];
      cli.main(argv).then((output) => {
        expect(output).toBe('OK');
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('reads command options from a config file', (done) => {
      const filename = path.resolve('.foorc');
      const argv = [
        'dummy',
        '--config',
        filename,
      ];
      const payload = { foo: true };
      spyOn(cli, 'resolveOptions').and.callThrough();
      const original_fs_readFileSync = fs.readFileSync;
      spyOn(fs, 'readFileSync').and.callFake((file, options) => {
        if (file === filename) {
          return JSON.stringify(payload);
        }
        return original_fs_readFileSync(file, options);
      });
      cli.main(argv).then((output) => {
        expect(flatten(fs.readFileSync.calls.allArgs()).indexOf(filename)).not.toBe(-1);
        expect(cli.resolveOptions.calls.argsFor(0)[0].foo).toBe(payload.foo);
        expect(output).toBe('OK');
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('fails silently if a config file does not exist', (done) => {
      const filename = path.resolve('.foorc');
      const argv = [
        'dummy',
        '--config',
        filename,
      ];
      spyOn(cli, 'resolveOptions').and.callThrough();
      const original_fs_readFileSync = fs.readFileSync;
      spyOn(fs, 'readFileSync').and.callFake((file, options) => {
        if (file === filename) {
          throw new Error('boom');
        }
        return original_fs_readFileSync(file, options);
      });
      cli.main(argv).then((output) => {
        expect(flatten(fs.readFileSync.calls.allArgs()).indexOf(filename)).not.toBe(-1);
        expect(cli.resolveOptions.calls.argsFor(0)[0].foo).toBe(undefined);
        expect(output).toBe('OK');
        done();
      }, (err) => {
        done.fail(err);
      });
    });

    it('rejects when a command fails', (done) => {
      const failing_command = {
        name: 'failing',
        run: helpers.promiseRejectError,
      };
      cli.addCommand(failing_command);
      const argv = [
        'failing',
      ];
      cli.main(argv).then(() => {
        done.fail();
      }, (err) => {
        expect(err.message).toBe('boom');
        expect(
          core.logger.log.calls.argsFor(0)[0].indexOf('--help')).not.toBe(-1);
        done();
      });
    });
  });
});
