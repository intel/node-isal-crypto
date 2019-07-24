module.exports = function requireCrypto(runNodeJS) {
  let crypto;
  if (runNodeJS) {
    crypto = require('crypto');
  } else if (process.env.npm_config_package === 'true') {
    crypto = require('isa-l_crypto');
  } else {
    crypto = require('..');
  }
  return crypto;
};
