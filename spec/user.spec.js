'use strict';

var rewire = require('rewire');

var log = require('../lib/log');

var user = rewire('../lib/user.js');

describe('user', function() {

  describe('isUserId', function() {
    var isUserId = user.__get__('isUserId');

    it('checks if a user id is valid', function() {
      expect(isUserId('12345678')).toBe(true);
    });

    it('checks if a user id is invalid', function() {
      expect(isUserId('username')).not.toBe(true);
    });
  });

  describe('resolveUserId', function() {
    var resolveUserId = user.__get__('resolveUserId');
    var ig = user.__get__('ig');

    it('resolves a user id to itself', function(done) {
      spyOn(ig, 'user_search');
      resolveUserId('12345678').then(function(user_id) {
        expect(ig.user_search.calls.any()).toEqual(false);
        expect(user_id).toEqual('12345678');
        done();
      });
    });

    it('resolves a username', function(done) {
      var user_search = function(user_id, options, callback) {
        callback(false, [{id: '12345678'}]);
      };
      spyOn(ig, 'user_search').and.callFake(user_search);
      spyOn(console, 'log');
      resolveUserId('username').then(function(user_id) {
        expect(ig.user_search.calls.argsFor(0)[0]).toEqual('username');
        expect(console.log).toHaveBeenCalled();
        expect(user_id).toEqual('12345678');
        done();
      });
    });

    it('rejects on error', function(done) {
      var user_search = function(user_id, options, callback) {
        callback(Error('boom'));
      };
      spyOn(ig, 'user_search').and.callFake(user_search);
      resolveUserId('username').catch(function(err) {
        expect(ig.user_search.calls.argsFor(0)[0]).toEqual('username');
        expect(err.message).toEqual('boom');
        done();
      });
    });

    it('rejects when no result is returned', function(done) {
      var user_search = function(user_id, options, callback) {
        callback(false, []);
      };
      spyOn(ig, 'user_search').and.callFake(user_search);
      resolveUserId('username').catch(function(err) {
        expect(ig.user_search.calls.argsFor(0)[0]).toEqual('username');
        expect(err.message).toEqual(
          log.formatErrorMessage('Could not find user ID for: username'));
        done();
      });
    });
  });

});
