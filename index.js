const isal = require('bindings')('isal_crypto');
const hashStreamClassFactory = require('./lib/mb-hash-stream-class-factory');

// Define the hash classes we expose and store them by hash name.
const hashConstructors = {
  sha256: hashStreamClassFactory({
    native: isal.sha256_mb,
    className: 'SHA256MBHashStream',
    digestLength: 32
  }),
  sha512: hashStreamClassFactory({
    native: isal.sha512_mb,
    className: 'SHA512MBHashStream',
    digestLength: 64
  })
};

// Provide the same interface for creating a hash instance as the built-in
// `crypto` module.
module.exports = {
  createHash(name) {
    const HashConstructor = hashConstructors[name];
    if (HashConstructor) {
      return new HashConstructor();
    }
    throw new Error('Unknown hash function: ' + name);
  }
};
