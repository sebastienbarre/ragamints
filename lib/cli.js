'use strict';

var _assign   = require('lodash/object/assign');
var _find     = require('lodash/collection/find');
var path      = require('path');
var Promise   = require('es6-promise').Promise;
var yargs     = require('yargs');

var constants = require('./constants');
var logger    = require('./logger');

let commands = [
  require('./commands/download')
];

/**
 * Main. Parses CLI args
 *
 * @param {Array} argv command-line arguments
 * @return {Promise} resolving when done, or rejecting
 */
function main(argv) {
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
      't': {
        alias: 'access-token',
        describe: 'Instagram Access Token',
        type: 'string'
      },
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
        default: path.join(home, `.${constants.SOFTWARE}.json`),
        config: true
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
      command.run(yargv).then(resolve, on_fail);
      return;
    }

    // No commands were run
    logger.log(yargs.help());
    reject();
  });
}

module.exports = {
  main: main
};
