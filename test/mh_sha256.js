module.exports = function(binding) {

const crypto = require('crypto');
const assert = require('assert');
const context = new ArrayBuffer(binding.mh_sha256_context_size);
const input = 'The quick brown fox jumped over the lazy dog.';
const expected = '06569176175fa86129926025b4d2c2c184095ad991177e8fe6db2b2797703ac9';

// Conversion copied from:
// https://stackoverflow.com/questions/17191945/conversion-between-utf-8-arraybuffer-and-string#answer-17192845
function stringToUint(string) {
    var string = unescape(encodeURIComponent(string)),
        charList = string.split(''),
        uintArray = [];
    for (var i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
}

assert.strictEqual(binding.mh_sha256_init(context), 0);
assert.strictEqual(
    binding.mh_sha256_update(context, stringToUint(input).buffer),
    0);

const hashBuf = new ArrayBuffer(32);
assert.strictEqual(binding.mh_sha256_finalize(context, hashBuf), 0);
assert.strictEqual(
    Array.prototype.map.call(new Uint8Array(hashBuf), (byte) =>
        ('00' + byte.toString(16)).slice(-2)).join(''),
    expected);

};
