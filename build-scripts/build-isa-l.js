const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const run = require('./lib/run');

const isalDir = path.resolve(path.join(__dirname, '..', 'isa-l_crypto'));
const isDebugBuild = (process.env.npm_config_debug === 'true');

run(path.join(isalDir, 'autogen.sh'), [], {
  stdio: 'inherit',
  cwd: isalDir
});

run(path.join(isalDir, 'configure'), [], {
  env: Object.assign({}, process.env, {
    CFLAGS: '-fPIC -DPIC'
  }),
  stdio: 'inherit',
  cwd: isalDir
});

run('make', [], {
  stdio: 'inherit',
  cwd: isalDir
});
