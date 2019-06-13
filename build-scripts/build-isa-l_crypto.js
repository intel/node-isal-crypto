const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const isalDir = path.resolve(path.join(__dirname, '..', 'isa-l_crypto'));

if (!fs.existsSync(path.join(isalDir, 'configure'))) {
  spawnSync(path.join(isalDir, 'autogen.sh'), [], {
    stdio: 'inherit',
    cwd: isalDir
  });
}

const cflags = new Set(['-fPIC', '-DPIC', '-O2']);
if (process.env.npm_config_perf === 'true') {
  cflags.add('-g');
}
if (process.env.npm_config_debug === 'true') {
  cflags.add('-g');
  cflags.add('-O0');
  cflags.delete('-O2');
}

if (!fs.existsSync(path.join(isalDir, 'Makefile'))) {
  spawnSync(path.join(isalDir, 'configure'),
    ['--disable-shared']
      .concat((process.env.npm_config_debug === 'true'
        ? ['--enable-debug']
        : [])), {
      env: Object.assign({}, process.env, {
        CFLAGS: Array.from(cflags).join(' ')
      }),
      stdio: 'inherit',
      cwd: isalDir
    });
}

if (!fs.existsSync(path.join(isalDir, '.libs', 'libisal_crypto.a'))) {
  spawnSync('make', ['-j', Math.round(os.cpus().length * 1.5)], {
    stdio: 'inherit',
    cwd: isalDir
  });
}
