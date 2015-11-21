var promiseRejectError = function() {
  return Promise.reject(Error('boom'));
};

var promiseValue = function(value) {
  return Promise.resolve(value);
};

function fillArray(size, with_index, value) {
  return Array.apply(null, new Array(size)).map(function(currentValue, index) {
    if (with_index === true) {
      return index;
    }
    var data = value || {};
    if (with_index) {
      data[with_index] = index;
    }
    return data;
  });
};

module.exports = {
  promiseRejectError: promiseRejectError,
  promiseValue: promiseValue,
  fillArray: fillArray
};
