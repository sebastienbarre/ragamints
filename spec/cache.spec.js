'use strict';

var rewire       = require('rewire');

var mediaData    = require('./data/media');

// store.js uses localStorage. Let's provide an implementation
// if we are running in node.js, ones that point at a temporary directory
// so that we do not pollute the ones actually set up in cache.js
// UPDATE: reverting that. This would not test if caching will really
// work for the user, and coverage would go down. In practice, testing
// will only be done by CI or contributors.
// var constants    = require('../lib/constants');
// var temp = require('temp').track();
// var temp_dir = temp.mkdirSync(constants.SOFTWARE);
// var LocalStorage = require('node-localstorage').LocalStorage;
// global.localStorage = new LocalStorage(temp_dir);

var cache        = rewire('../lib/cache.js');

/*eslint-disable max-nested-callbacks */
describe('cache', function() {
  var store = cache.__get__('store');
  var key = '__test__';

  afterEach(function() {
    cache.enable();
    store.enabled = true;
  });

  it('sets an integer that can be retrieved then removed', function(done) {
    var int_value = 3;
    cache.set(key, int_value).then(function() {
      cache.get(key).then(function(value) {
        expect(value).toBe(int_value);
        cache.remove(key).then(function() {
          cache.get(key).then(function() {
            done.fail(key + ' key was not removed');
          }, function(err) {
            expect(err).toBeUndefined();
            done();
          });
        }, function(err) {
          done.fail(err);
        });
      }, function(err) {
        done.fail(err);
      });
    }, function(err) {
      done.fail(err);
    });
  });

  it('sets a string that can be retrieved then removed', function(done) {
    var string_value = 'foo';
    cache.set(key, string_value).then(function() {
      cache.get(key).then(function(value) {
        expect(value).toBe(string_value);
        cache.remove(key).then(function() {
          cache.get(key).then(function() {
            done.fail(key + ' key was not removed');
          }, function(err) {
            expect(err).toBeUndefined();
            done();
          });
        }, function(err) {
          done.fail(err);
        });
      }, function(err) {
        done.fail(err);
      });
    }, function(err) {
      done.fail(err);
    });
  });

  it('sets an array that can be retrieved then removed', function(done) {
    var array_value = [1, 'foo', true];
    cache.set(key, array_value).then(function() {
      cache.get(key).then(function(value) {
        expect(value).toEqual(array_value);
        cache.remove(key).then(function() {
          cache.get(key).then(function() {
            done.fail(key + ' key was not removed');
          }, function(err) {
            expect(err).toBeUndefined();
            done();
          });
        }, function(err) {
          done.fail(err);
        });
      }, function(err) {
        done.fail(err);
      });
    }, function(err) {
      done.fail(err);
    });
  });

  it('sets an object that can be retrieved then removed', function(done) {
    var object_value = {foo: 'bar', bill: 1, meh: true};
    cache.set(key, object_value).then(function() {
      cache.get(key).then(function(value) {
        expect(value).toEqual(object_value);
        cache.remove(key).then(function() {
          cache.get(key).then(function() {
            done.fail(key + ' key was not removed');
          }, function(err) {
            expect(err).toBeUndefined();
            done();
          });
        }, function(err) {
          done.fail(err);
        });
      }, function(err) {
        done.fail(err);
      });
    }, function(err) {
      done.fail(err);
    });
  });

  it('sets a cache entry with a TTL and rejects when expired', function(done) {
    var int_value = 3;
    var ttl = 30;
    cache.set(key, int_value, ttl).then(function() {
      setTimeout(function() {
        cache.get(key).then(function(value) {
          expect(value).toBe(int_value);
          setTimeout(function() {
            cache.get(key).then(function() {
              done.fail();
            }, function(err) {
              expect(err).toBeUndefined();
              cache.remove(key).then(function() {
                done();
              });
            });
          }, ttl * 2);
        }, function(err) {
          done.fail(err);
        });
      }, ttl / 2);
    }, function(err) {
      done.fail(err);
    });
  });

  it('does not compress small cache entries', function(done) {
    var int_value = 3;
    var decompress_spy = jasmine.createSpy('decompress');
    decompress_spy.and.callFake(cache.__get__('decompress'));
    cache.__set__('decompress', decompress_spy);
    cache.set(key, int_value).then(function() {
      cache.get(key).then(function(value) {
        expect(value).toBe(int_value);
        // note that compress *is* always called to decide whether to store
        // the compressed version or not
        expect(decompress_spy).not.toHaveBeenCalled();
        done();
      }, function(err) {
        done.fail(err || 'Could not get value set in cache');
      });
    }, function(err) {
      done.fail(err || 'Could not set value in cache');
    });
  });

  it('compresses large cache entries', function(done) {
    var object_value = mediaData.image.json;
    var decompress_spy = jasmine.createSpy('decompress');
    decompress_spy.and.callFake(cache.__get__('decompress'));
    cache.__set__('decompress', decompress_spy);
    cache.set(key, object_value).then(function() {
      cache.get(key).then(function(value) {
        expect(value).toEqual(object_value);
        // note that compress *is* always called to decide whether to store
        // the compressed version or not
        expect(decompress_spy).toHaveBeenCalled();
        done();
      }, function(err) {
        done.fail(err || 'Could not get value set in cache');
      });
    }, function(err) {
      done.fail(err || 'Could not set value in cache');
    });
  });

  it('fails to set when cache is disabled', function(done) {
    var int_value = 3;
    cache.disable();
    cache.set(key, int_value).then(function() {
      done.fail('cache is disabled, set should not succeed');
    }, function(err) {
      expect(err).toBeUndefined();
      done();
    });
  });

  it('fails to get when cache is disabled', function(done) {
    var int_value = 3;
    cache.set(key, int_value).then(function() {
      cache.get(key).then(function(value) {
        expect(value).toBe(int_value);
        cache.disable();
        cache.get(key).then(function() {
          done.fail('cache is disabled, get should not succeed');
        }, function(err) {
          expect(err).toBeUndefined();
          cache.enable();
          cache.remove(key).then(done);
        });
      }, function(err) {
        done.fail(err);
      });
    }, function(err) {
      done.fail(err);
    });
  });

  it('fails to remove when cache is disabled', function(done) {
    var int_value = 3;
    cache.set(key, int_value).then(function() {
      cache.get(key).then(function(value) {
        expect(value).toBe(int_value);
        cache.disable();
        cache.remove(key).then(function() {
          done.fail('cache is disabled, remove should not succeed');
        }, function(err) {
          expect(err).toBeUndefined();
          cache.enable();
          cache.remove(key).then(done);
        });
      }, function(err) {
        done.fail(err);
      });
    }, function(err) {
      done.fail(err);
    });
  });

  it('creates a stable hash given an object', function() {
    var object_value = {foo: 'bar', bill: 1, meh: true};
    var hash = cache.hash(object_value);
    expect(hash).toEqual('d2415012f4d369bd4a9ce0f4eda3c0d4');
  });

  it('rejects when the internal store is not set properly', function(done) {
    store.enabled = false;
    var int_value = 3;
    cache.set(key, int_value).then(function() {
      done.fail();
    }, function(err) {
      expect(err.message).toBe('Local storage is not supported.');
      cache.get(key).then(function() {
        done.fail();
      }, function() {
        cache.remove(key).then(function() {
          done.fail();
        }, function() {
          done();
        });
      });
    });
  });

});
/*eslint-enable max-nested-callbacks */
