const path = require('path');
const fs = require('fs');
const spawnSync = require('child_process').spawnSync;

const patchesDir = path.join(__dirname, '..', 'patches');
const isalDir = path.resolve(path.join(__dirname, '..', 'isa-l_crypto'));

// Apply patches
fs.readdirSync(path.resolve(patchesDir))
  .forEach((item) => {
    spawnSync('git', [ 'apply', path.join(patchesDir, item) ], {
      cwd: isalDir,
      shell: true
    });
  });

// Run make
spawnSync('make', [ '-f', 'Makefile.unx' ], {
  cwd: isalDir,
  shell: true
});
