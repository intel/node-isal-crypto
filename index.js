const isal = Object.assign(require('bindings')('isal_crypto'), {
  multi_buffer: {
    HASH_CTX_FLAG: {
      HASH_UPDATE: 0,
      HASH_FIRST: 1,
      HASH_LAST: 2,
      HASH_ENTIRE: 3
    },
    HASH_CTX_STS: {
      HASH_CTX_STS_IDLE: 0x00,
      HASH_CTX_STS_PROCESSING: 0x01,
      HASH_CTX_STS_LAST: 0x02,
      HASH_CTX_STS_COMPLETE: 0x04
    }
  }
});

Object.assign(isal.sha512_mb, {
  HashOpCode: {
    NOOP: 0,
    CONTEXT_REQUEST: 1,
    CONTEXT_RESET: 2,
    MANAGER_SUBMIT: 3,
    MANAGER_FLUSH: 4
  },
  ContextResetFlag: {
    CONTEXT_RESET_FLAG_RELEASE: 0,
    CONTEXT_RESET_FLAG_RETAIN: 1
  }
});

module.exports = isal;
