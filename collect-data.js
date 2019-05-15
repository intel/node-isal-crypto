const run = require('./build-scripts/lib/run');
const { spawnSync, spawn } = require('child_process');
const benchmarkPath = require('path').join(__dirname, 'benchmark', 'stream');
const hashes = [ 'sha256', 'sha512' ];
const samples = 20;

function getOneAverage(hash, runNodeJS) {
  let result = 0;
  for (let idx = 0; idx < samples; idx++) {
    process.stdout.write('\r\033[K' + hash + (runNodeJS ? '(node)' : '') +
      ': iteration ' + idx);
    result += JSON.parse(
      spawnSync(process.execPath, [
          benchmarkPath, JSON.stringify({hash, runNodeJS})
      ])
        .stdout
        .toString())
      .elapsed;
  }
  return (result / samples);
}

if (process.argv[2] === 'rebuild') {
  run('bash', [
    '-c',
    'git clean -xfd && ' +
    'git submodule foreach --recursive git clean -xfd && ' +
    'git submodule foreach --recursive git reset --hard && ' +
    'git submodule update --init --recursive && ' +
    'MAKEOPTS=-j120 npm ' +
    (process.env.http_proxy ? '--proxy=' + process.env.http_proxy : '') +
    ' install'
  ], {
    stdio: 'inherit'
  });
}

hashes.forEach((hash) => {
  console.log('\r\033[K' + hash + ':\t' +
    getOneAverage(hash, true) / getOneAverage(hash, false));
});
