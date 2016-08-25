const Jasmine = require('jasmine');
const SpecReporter = require('jasmine-spec-reporter');

const noop = () => {};
const jrunner = new Jasmine();
jrunner.configureDefaultReporter({ print: noop }); // remove default reporters
// https://github.com/bcaudan/jasmine-spec-reporter
jasmine.getEnv().addReporter(new SpecReporter({ displayStacktrace: 'specs' }));
jrunner.loadConfigFile();
jrunner.execute();
