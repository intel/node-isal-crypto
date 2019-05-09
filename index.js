const isal = require('bindings')('isal_crypto');
const hashStreamClassFactory = require('./lib/mb-hash-stream-class-factory');

const hashConstructors = {
  sha256: hashStreamClassFactory({
    multi_buffer: isal.multi_buffer,
    native: isal.sha256_mb,
    className: 'SHA256MBHashStream',
    digestLength: 32
  }),
  sha512: hashStreamClassFactory({
    multi_buffer: isal.multi_buffer,
    native: isal.sha512_mb,
    className: 'SHA512MBHashStream',
    digestLength: 64
  })
};

module.exports = {
  createHash: function(name) {
    const hashConstructor = hashConstructors[name];
    if (hashConstructor) {
      return new hashConstructor();
    }
    throw new Error('Unknown hash function: ' + name);
  }
};
