const rewire = require('rewire');

const mediaData = require('../data/media');

// store.js uses localStorage. Let's provide an implementation
// if we are running in node.js, ones that point at a temporary directory
// so that we do not pollute the ones actually set up in cache.js
// UPDATE: reverting that. This would not test if caching will really
// work for the user, and coverage would go down. In practice, testing
// will only be done by CI or contributors.
// const constants    = require('../lib/constants');
// const temp = require('temp').track();
// const temp_dir = temp.mkdirSync(constants.SOFTWARE);
// const LocalStorage = require('node-localstorage').LocalStorage;
// global.localStorage = new LocalStorage(temp_dir);

const cache = rewire('../../lib/core/cache.js');

/* eslint-disable max-nested-callbacks */
describe('core.cache', () => {
  const store = cache.__get__('store');
  const key = '__test__';

  afterEach(() => {
    cache.enable();
    store.enabled = true;
  });

  it('sets an integer that can be retrieved then removed', (done) => {
    const int_value = 3;
    cache.set(key, int_value).then(() => {
      cache.get(key).then((value) => {
        expect(value).toBe(int_value);
        cache.remove(key).then(() => {
          cache.get(key).then(() => {
            done.fail(`${key} key was not removed`);
          }, (err) => {
            expect(err).toBeUndefined();
            done();
          });
        }, (err) => {
          done.fail(err);
        });
      }, (err) => {
        done.fail(err);
      });
    }, (err) => {
      done.fail(err);
    });
  });

  it('sets a string that can be retrieved then removed', (done) => {
    const string_value = 'foo';
    cache.set(key, string_value).then(() => {
      cache.get(key).then((value) => {
        expect(value).toBe(string_value);
        cache.remove(key).then(() => {
          cache.get(key).then(() => {
            done.fail(`${key} key was not removed`);
          }, (err) => {
            expect(err).toBeUndefined();
            done();
          });
        }, (err) => {
          done.fail(err);
        });
      }, (err) => {
        done.fail(err);
      });
    }, (err) => {
      done.fail(err);
    });
  });

  it('sets an array that can be retrieved then removed', (done) => {
    const array_value = [1, 'foo', true];
    cache.set(key, array_value).then(() => {
      cache.get(key).then((value) => {
        expect(value).toEqual(array_value);
        cache.remove(key).then(() => {
          cache.get(key).then(() => {
            done.fail(`${key} key was not removed`);
          }, (err) => {
            expect(err).toBeUndefined();
            done();
          });
        }, (err) => {
          done.fail(err);
        });
      }, (err) => {
        done.fail(err);
      });
    }, (err) => {
      done.fail(err);
    });
  });

  it('sets an object that can be retrieved then removed', (done) => {
    const object_value = { foo: 'bar', bill: 1, meh: true };
    cache.set(key, object_value).then(() => {
      cache.get(key).then((value) => {
        expect(value).toEqual(object_value);
        cache.remove(key).then(() => {
          cache.get(key).then(() => {
            done.fail(`${key} key was not removed`);
          }, (err) => {
            expect(err).toBeUndefined();
            done();
          });
        }, (err) => {
          done.fail(err);
        });
      }, (err) => {
        done.fail(err);
      });
    }, (err) => {
      done.fail(err);
    });
  });

  it('sets a cache entry with a TTL and rejects when expired', (done) => {
    const int_value = 3;
    const ttl = 30;
    cache.set(key, int_value, ttl).then(() => {
      setTimeout(() => {
        cache.get(key).then((value) => {
          expect(value).toBe(int_value);
          setTimeout(() => {
            cache.get(key).then(() => {
              done.fail();
            }, (err) => {
              expect(err).toBeUndefined();
              cache.remove(key).then(() => {
                done();
              });
            });
          }, ttl * 2);
        }, (err) => {
          done.fail(err);
        });
      }, ttl / 2);
    }, (err) => {
      done.fail(err);
    });
  });

  it('clears all cache entries', (done) => {
    const int_value = 3;
    const key2 = `${key}2`;
    cache.set(key, int_value).then(() => {
      cache.set(key2, int_value).then(() => {
        cache.clear().then(() => {
          cache.get(key).then(() => {
            done.fail(`${key} key was not removed`);
          }, (err) => {
            expect(err).toBeUndefined();
            cache.get(key2).then(() => {
              done.fail(`${key2} key was not removed`);
            }, (err2) => {
              expect(err2).toBeUndefined();
              done();
            });
          });
        }, (err) => {
          done.fail(err);
        });
      }, (err) => {
        done.fail(err);
      });
    }, (err) => {
      done.fail(err);
    });
  });

  it('does not compress small cache entries', (done) => {
    const int_value = 3;
    spyOn(cache, 'decompress').and.callThrough();
    cache.set(key, int_value).then(() => {
      cache.get(key).then((value) => {
        expect(value).toBe(int_value);
        // note that compress *is* always called to decide whether to store
        // the compressed version or not
        expect(cache.decompress).not.toHaveBeenCalled();
        done();
      }, (err) => {
        done.fail(err || 'Could not get value set in cache');
      });
    }, (err) => {
      done.fail(err || 'Could not set value in cache');
    });
  });

  it('compresses large cache entries', (done) => {
    const object_value = mediaData.image.standard;
    spyOn(cache, 'decompress').and.callThrough();
    cache.set(key, object_value).then(() => {
      cache.get(key).then((value) => {
        expect(value).toEqual(object_value);
        // note that compress *is* always called to decide whether to store
        // the compressed version or not
        expect(cache.decompress).toHaveBeenCalled();
        done();
      }, (err) => {
        done.fail(err || 'Could not get value set in cache');
      });
    }, (err) => {
      done.fail(err || 'Could not set value in cache');
    });
  });

  it('fails to set when the cache is disabled', (done) => {
    const int_value = 3;
    cache.disable();
    cache.set(key, int_value).then(() => {
      done.fail('cache is disabled, set should not succeed');
    }, (err) => {
      expect(err).toBeUndefined();
      done();
    });
  });

  it('fails to get when the cache is disabled', (done) => {
    const int_value = 3;
    cache.set(key, int_value).then(() => {
      cache.get(key).then((value) => {
        expect(value).toBe(int_value);
        cache.disable();
        cache.get(key).then(() => {
          done.fail('cache is disabled, get should not succeed');
        }, (err) => {
          expect(err).toBeUndefined();
          cache.enable();
          cache.remove(key).then(done);
        });
      }, (err) => {
        done.fail(err);
      });
    }, (err) => {
      done.fail(err);
    });
  });

  it('fails to remove when the cache is disabled', (done) => {
    const int_value = 3;
    cache.set(key, int_value).then(() => {
      cache.get(key).then((value) => {
        expect(value).toBe(int_value);
        cache.disable();
        cache.remove(key).then(() => {
          done.fail('cache is disabled, remove should not succeed');
        }, (err) => {
          expect(err).toBeUndefined();
          cache.enable();
          cache.remove(key).then(done);
        });
      }, (err) => {
        done.fail(err);
      });
    }, (err) => {
      done.fail(err);
    });
  });

  it('fails to clear when the cache is disabled', (done) => {
    const int_value = 3;
    cache.set(key, int_value).then(() => {
      cache.get(key).then((value) => {
        expect(value).toBe(int_value);
        cache.disable();
        cache.clear().then(() => {
          done.fail('cache is disabled, clear should not succeed');
        }, (err) => {
          expect(err).toBeUndefined();
          cache.enable();
          cache.clear(key).then(done);
        });
      }, (err) => {
        done.fail(err);
      });
    }, (err) => {
      done.fail(err);
    });
  });

  it('creates a stable hash given an object', () => {
    const object_value = { foo: 'bar', bill: 1, meh: true };
    const hash = cache.hash(object_value);
    expect(hash).toEqual('d2415012f4d369bd4a9ce0f4eda3c0d4');
  });

  it('rejects when the internal store is not set properly', (done) => {
    store.enabled = false;
    const int_value = 3;
    cache.set(key, int_value).then(() => {
      done.fail();
    }, (err) => {
      expect(err.message).toBe('Local storage is not supported.');
      cache.get(key).then(() => {
        done.fail();
      }, () => {
        cache.remove(key).then(() => {
          done.fail();
        }, () => {
          cache.clear().then(() => {
            done.fail();
          }, () => {
            done();
          });
        });
      });
    });
  });
});
/* eslint-enable max-nested-callbacks */
