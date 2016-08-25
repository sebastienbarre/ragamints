const logger = require('../../lib/core/logger');

describe('core.logger', () => {
  describe('core.logger.log', () => {
    it('calls console.log', () => {
      spyOn(console, 'log');
      logger.log('foo');
      expect(console.log).toHaveBeenCalled();
    });
  });
});
