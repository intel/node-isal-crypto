const isal = require('.');

module.exports = require('./mb-hash-stream-class-factory.js')({
  multi_buffer: isal.multi_buffer,
  native: isal.sha256_mb,
  className: 'SHA256MBHashStream',
  digestLength: 32
});
