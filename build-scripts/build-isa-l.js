const path = require('path');
const fs = require('fs');
const spawnSync = require('child_process').spawnSync;
const rimraf = require('rimraf');

const patchesDir = path.join(__dirname, '..', 'patches');
const isalDir = path.resolve(path.join(__dirname, '..', 'isa-l_crypto'));

function run(command, arguments, options) {
  const result = spawnSync(command, arguments, options);
  if (result.status !== 0) {
    throw Object.assign(new Error(
        'command ' + command +
        ' with arguments ' + JSON.stringify(arguments) + ', ' +
        ' stdout ' + JSON.stringify(result.stdout.toString()) + ', ' +
        ' stderr ' + JSON.stringify(result.stderr.toString()) + ', ' +
        ' and options ' + JSON.stringify(options) +
        ' failed'), {
      status: result.status,
      signal: result.signal,
      error: result.error
    });
  }
}

function touch(filename) {
  fs.closeSync(fs.openSync(filename, 'w'));
}

// Apply patches
fs.readdirSync(path.resolve(patchesDir))
  .forEach((item) => {

    // Look for a <patchname>.applied file and only apply the patch if absent.
    const appliedFile = path.join(isalDir, item + '.applied');
    if (!fs.existsSync(appliedFile)) {
      run('git', [ 'apply', path.join(patchesDir, item) ], {
        cwd: isalDir,
        shell: true,
        stdio: 'inherit',
      });
      touch(appliedFile);
    }
  });

let cflags = ['-fpic'];
let defines = ['-D PIC'];
const debugBuildFile = path.join(isalDir, 'is_debug_build');
if (process.env.npm_config_debug === 'true') {
  cflags = cflags.concat(['-g', '-O0']);
  defines = defines.concat(['-D DEBUG']);
} else {
  cflags = cflags.concat(['-O2']);
  defines = defines.concat(['-D NDEBUG']);
}

// Rebuild isa-l_crypto if we're switching between debug and non-debug builds.
if (process.env.npm_config_debug === 'true' && !fs.existsSync(debugBuildFile) ||
    process.env.npm_config_debug !== 'true' && fs.existsSync(debugBuildFile)) {
  rimraf.sync(path.join(isalDir, 'bin'));
  rimraf.sync(debugBuildFile);
}

// Run make
run('make', [
    '-f',
    'Makefile.unx',
    'DEBUG="' + cflags.join(' ') + '"',
    'DEFINES="' + defines.join(' ') + '"'
  ], {
  cwd: isalDir,
  stdio: 'inherit',
  shell: true
});

if (process.env.npm_config_debug === 'true') {
  touch(debugBuildFile);
}
