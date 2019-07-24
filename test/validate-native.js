if (process.argv[2] === '-c') {
  require('./lib/test-runner')([__filename]);
}

const assert = require('assert');
const native = (process.env.npm_config_package === 'true'
  ? require('isa-l_crypto/native')
  : require('../native'));

const CONTEXT_RESET = 2;
const MANAGER_SUBMIT = 3;

const HASH_FIRST = 1;

Object.entries(native).forEach((entry) => {
  const binding = entry[1];
  if (typeof binding !== 'object') {
    return;
  }
  const {
    sizeofContext,
    maxLanes
  } = binding;

  // 0: opcode
  // 1: context id
  // 2: flag
  const op = new Int32Array(binding, maxLanes * sizeofContext, 3);

  // Test that binding throws when the opcode is out of range.
  assert.throws(() => {
    op[0] = 0;
    binding.op();
  }, {
    name: 'RangeError',
    code: 'UNKNOWN_OPCODE'
  });

  // Test that binding throws when the context index is out of range.
  assert.throws(() => {
    op[0] = CONTEXT_RESET;
    op[1] = -1;
    binding.op();
  }, {
    name: 'RangeError',
    code: 'CONTEXT_RESET_INDEX_OUT_OF_RANGE'
  });

  // Test that binding throws when the flag is out of range.
  assert.throws(() => {
    op[0] = CONTEXT_RESET;
    op[1] = 0;
    op[2] = -1;
    binding.op();
  }, {
    name: 'RangeError',
    code: 'CONTEXT_RESET_FLAG_OUT_OF_RANGE'
  });

  // Test that binding throws when submit() is passed an item other than a
  // TypedArray.
  assert.throws(() => {
    op[0] = MANAGER_SUBMIT;
    op[1] = 0;
    op[2] = HASH_FIRST;
    binding.op(new Uint32Array(3));
  }, {
    name: 'TypeError',
    code: 'CHUNK_MUST_BE_UINT8ARRAY'
  });
});
