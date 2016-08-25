const assign = require('lodash/assign');
const find = require('lodash/find');
const fs = require('fs');
const path = require('path');
const Promise = require('es6-promise').Promise;
const yargs = require('yargs');

const core = require('./core');
const commands = require('./commands');

const api = {};

/**
 * Parse configuration file.
 *
 * @param {string} configPath - Path to config file.
 * @returns {Object} The options read from the config file.
 */
api.configParser = (configPath) => {
  try {
    // yargs uses require(), which would not parse a .*rc file
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    return {};
  }
};

/**
 * Resolve options.
 *
 * @param {Object} options - Options to resolve.
 * @returns {Promise} The promise resolving with resolved options, or rejecting.
 */
api.resolveOptions = function resolveOptions(options) {
  const resolved_options = assign({}, options);
  const before = options.clearCache ? core.cache.clear() : Promise.resolve();
  return before.then(() => resolved_options);
};

/**
 * Add command.
 *
 * @param {Object} command - Command to add.
 */
api.addCommand = function addCommand(command) {
  commands.push(command);
};

/**
 * Main. Parses CLI args.
 *
 * @param {Array} argv - Command-line arguments.
 * @returns {Promise} The promise resolving when done, or rejecting.
 */
api.main = argv => new Promise((resolve, reject) => {
  const is_win32 = process.platform === 'win32';
  const home = process.env[is_win32 ? 'USERPROFILE' : 'HOME'];

  const help_options = {
    'h': {
      alias: 'help',
      describe: 'Show help',
      type: 'boolean',
    },
  };

  const common_options = {
    'l': {
      alias: 'clear-cache',
      describe: 'Clear the cache',
      type: 'boolean',
      default: false,
    },
    'v': {
      alias: 'verbose',
      describe: 'Output more info',
      type: 'boolean',
      default: false,
    },
    'q': {
      alias: 'quiet',
      describe: 'Output less info',
      type: 'boolean',
      default: false,
    },
    'config': {
      describe: 'Load config file',
      default: path.join(home, core.constants.CONFIG_FILE),
      config: true,
      configParser: api.configParser,
    },
  };

  // Prevent yargs from exiting the process, since we need to reject()
  const on_fail = (msg) => {
    core.logger.log(`Specify --${help_options.h.alias} for available options`);
    reject(msg);
  };

  // We need to reset yargs for each command -- let's use a function
  const reset_yargs = () => yargs
    .reset()
    .epilogue('Check the man page or README file for more')
    .wrap(null)
    .exitProcess(false)
    .fail(on_fail);

  // Setup all commands
  reset_yargs().usage('$0 command').options(help_options);
  commands.forEach((command) => {
    yargs.command(command.name, command.description);
  });
  let yargv = yargs.parse(argv);

  // If a command was passed, bring its options
  const command = find(commands, { name: yargv._[0] });
  if (command) {
    const options = assign({}, command.options, common_options, help_options);
    yargv = reset_yargs().usage('$0 download', options).parse(argv);
  }

  // For any --help, be it the top one, or the command ones, display options
  if (yargv[help_options.h.alias]) {
    yargs.showHelp(core.logger.log);
    reject();
    return;
  }

  // Run the command
  if (command && command.run) {
    api.resolveOptions(yargv).then((options) => {
      command.run(options).then(resolve, on_fail);
    });
    return;
  }

  // No commands were run
  yargs.showHelp(core.logger.log);
  reject();
});

module.exports = api;
