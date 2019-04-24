module.exports = function digestToString(digest) {
  return Array.prototype.map.call(new Uint32Array(digest),
    (word) => ('00000000' + word.toString(16)).slice(-8)).join('');
};
