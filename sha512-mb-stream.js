const isal = require('.');

module.exports = require('./mb-hash-stream-class-factory.js')({
  multi_buffer: isal.multi_buffer,
  native: isal.sha512_mb,
  className: 'SHA512MBHashStream',
  digestLength: 64
});
