module.exports = function test_sha256_mb(isal) {
const assert = require('assert');
const stringToUint = require('./lib/stringToUint');

const sha256_mb = isal.sha256_mb;
const input = 'The quick brown fox jumped over the lazy dog.';
const expected = '68b1282b91de2c054c36629cb8dd447f12f096d3e3c587978dc2248444633483';

function digestToString(digest) {
  return Array.prototype.map.call(new Uint32Array(context.digest),
    (word) => ('00000000' + word.toString(16)).slice(-8)).join('');
}

const manager = new sha256_mb.Manager();
const context = new sha256_mb.Context();

// Test simple operation
assert.strictEqual(digestToString(context.digest),
  '0000000000000000000000000000000000000000000000000000000000000000');

manager.submit(context, stringToUint(input).buffer,
  isal.multi_buffer.HASH_CTX_FLAG.HASH_ENTIRE);

while (!context.complete) {
  manager.flush();
}

assert.strictEqual(digestToString(context.digest), expected);
assert.strictEqual(context.complete, true);
assert.strictEqual(context.manager, undefined);

// Test multi-step operation
manager.submit(context, stringToUint(input.substr(0, 8)).buffer,
  isal.multi_buffer.HASH_CTX_FLAG.HASH_FIRST);
assert.strictEqual(context.complete, false);

for (let Nix = 8; Nix < input.length; Nix += 8) {
  manager.submit(context, stringToUint(input.substr(Nix, 8)).buffer,
    isal.multi_buffer.HASH_CTX_FLAG.HASH_UPDATE);
  assert.strictEqual(context.complete, false);
  assert.strictEqual(context.manager, manager);
}
manager.submit(context, new ArrayBuffer(0),
  isal.multi_buffer.HASH_CTX_FLAG.HASH_LAST);
while (!context.complete) {
  manager.flush();
}

assert.strictEqual(digestToString(context.digest), expected);
assert.strictEqual(context.complete, true);
assert.strictEqual(context.manager, undefined);

};
