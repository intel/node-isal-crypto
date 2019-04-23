module.exports = function test_mh_sha256({mh_sha256}) {

const assert = require('assert');
const stringToUint = require('./lib/stringToUint');

const context = new ArrayBuffer(mh_sha256.sizeof_mh_sha256_ctx);
const input = 'The quick brown fox jumped over the lazy dog.';
const expected = '06569176175fa86129926025b4d2c2c184095ad991177e8fe6db2b2797703ac9';

assert.strictEqual(mh_sha256.mh_sha256_init(context), 0);
assert.strictEqual(
    mh_sha256.mh_sha256_update(context, stringToUint(input).buffer),
    0);

const hashBuf = new ArrayBuffer(32);
assert.strictEqual(mh_sha256.mh_sha256_finalize(context, hashBuf), 0);
assert.strictEqual(
    Array.prototype.map.call(new Uint8Array(hashBuf), (byte) =>
        ('00' + byte.toString(16)).slice(-2)).join(''),
    expected);

};
