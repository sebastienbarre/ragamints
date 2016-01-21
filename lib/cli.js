'use strict';

var _assign   = require('lodash/object/assign');
var _find     = require('lodash/collection/find');
var fs        = require('fs');
var path      = require('path');
var Promise   = require('es6-promise').Promise;
var yargs     = require('yargs');

var cache     = require('./cache');
var commands  = require('./commands');
var constants = require('./constants');
var logger    = require('./logger');

let api = {};

/**
 * Resolve options.
 *
 * @param  {Object} options Options to resolve
 * @return {Promise} resolving with resolved options, or rejecting
 */
api.resolveOptions = function(options) {
  let resolved_options = _assign({}, options);
  let before = options.clearCache ? cache.clear() : Promise.resolve();
  return before.then(function() {
    return resolved_options;
  });
};

/**
 * Main. Parses CLI args
 *
 * @param {Array} argv command-line arguments
 * @return {Promise} resolving when done, or rejecting
 */
api.main = function(argv) {
  return new Promise(function(resolve, reject) {

    let is_win32 = process.platform === 'win32';
    let home = process.env[is_win32 ? 'USERPROFILE' : 'HOME'];

    let help_options = {
      'h': {
        alias: 'help',
        describe: 'Show help',
        type: 'boolean'
      }
    };

    let common_options = {
      'l': {
        alias: 'clear-cache',
        describe: 'Clear the cache',
        type: 'boolean',
        default: false
      },
      'v': {
        alias: 'verbose',
        describe: 'Output more info',
        type: 'boolean',
        default: false
      },
      'q': {
        alias: 'quiet',
        describe: 'Output less info',
        type: 'boolean',
        default: false
      },
      'config': {
        describe: 'Load config file',
        default: path.join(home, constants.CONFIG_FILE),
        config: true,
        configParser: function(configPath) {
          try {
            // yargs uses require(), which would not parse a .*rc file
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          } catch (err) {
            return {};
          }
        }
      }
    };

    // Prevent yargs from exiting the process, since we need to reject()
    let on_fail = function(msg) {
      logger.log(`Specify --${help_options.h.alias} for available options`);
      reject(msg);
    };

    // We need to reset yargs for each command -- let's use a function
    let reset_yargs = function(yargs) {
      return yargs
        .reset()
        .epilogue('Check the man page or README file for more')
        .wrap(null)
        .exitProcess(false)
        .fail(on_fail);
    };

    // Setup all commands
    yargs = reset_yargs(yargs).usage('$0 command').options(help_options);
    commands.forEach(function(command) {
      yargs.command(command.name, command.description);
    });
    let yargv = yargs.parse(argv);

    // If a command was passed, bring its options
    let command = _find(commands, {name: yargv._[0]});
    if (command) {
      let options = _assign({}, command.options, common_options, help_options);
      yargv = reset_yargs(yargs).usage('$0 download', options).parse(argv);
    }

    // For any --help, be it the top one, or the command ones, display options
    if (yargv[help_options.h.alias]) {
      logger.log(yargs.help());
      reject();
      return;
    }

    // Run the command
    if (command && command.run) {
      api.resolveOptions(yargv).then(function(options) {
        command.run(options).then(resolve, on_fail);
      });
      return;
    }

    // No commands were run
    logger.log(yargs.help());
    reject();
  });
};

module.exports = api;
