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

const cflags = new Set(['-fPIC', '-DPIC', '-O2']);
if (process.env.npm_config_perf === 'true') {
  cflags.add('-g');
}
if (process.env.npm_config_debug === 'true') {
  cflags.add('-g');
  cflags.add('-O0');
  cflags.delete('-O2');
}

run(path.join(isalDir, 'configure'),
  (process.env.npm_config_debug === 'true' ? ['--enable-debug'] : []), {
  env: Object.assign({}, process.env, {
    CFLAGS: Array.from(cflags).join(' ')
  }),
  stdio: 'inherit',
  cwd: isalDir
});

run('make', [], {
  stdio: 'inherit',
  cwd: isalDir
});
