const isalCrypto = require('bindings')('isal_crypto');

console.log(JSON.stringify(Object.keys(isalCrypto), null, 4));
