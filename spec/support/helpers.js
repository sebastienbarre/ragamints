const promiseRejectError = () => Promise.reject(Error('boom'));

const promiseValue = value => Promise.resolve(value);

/**
 * Get an array of specific size, with index and value.
 *
 * @param {number} size - The size of the array.
 * @param {boolean} [with_index] - Each array element is the index of the element if true.
 * @param {*} [value] - Each array element is value.
 * @returns {Array} The array.
 */
function fillArray(size, with_index, value) {
  return Array(...new Array(size)).map((currentValue, index) => {
    if (with_index === true) {
      return index;
    }
    const data = value || {};
    if (with_index) {
      data[with_index] = index;
    }
    return data;
  });
}

module.exports = {
  promiseRejectError,
  promiseValue,
  fillArray,
};
