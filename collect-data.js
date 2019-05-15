const run = require('./build-scripts/lib/run');
const { spawnSync, spawn } = require('child_process');
const benchmarkPath = require('path').join(__dirname, 'benchmark', 'stream');
const hashes = [ 'sha256', 'sha512' ];
const samples = 20;
const tailSizePercent = 0.05;

function measureOneHash(hash) {
  let resultsNode = [];
  let resultsMB = [];
  for (let idx = 0; idx < samples; idx++) {
    process.stdout.write('\r\033[K' + hash + '(node): iteration ' + idx);
    resultsNode.push(JSON.parse(
      spawnSync(process.execPath, [
          benchmarkPath, JSON.stringify({hash, runNodeJS: true})
      ])
        .stdout
        .toString())
      .elapsed);
    process.stdout.write('\r\033[K' + hash + ': iteration ' + idx);
    resultsMB.push(JSON.parse(
      spawnSync(process.execPath, [
          benchmarkPath, JSON.stringify({hash, runNodeJS: false})
      ])
        .stdout
        .toString())
      .elapsed);
  }

  return (
    resultsNode
      .sort()
      .slice(Math.round(samples * tailSizePercent),
        Math.round(samples * (1 - tailSizePercent)))
      .reduce((current, item) => (current + item)) /
    resultsMB
      .sort()
      .slice(Math.round(samples * tailSizePercent),
        Math.round(samples * (1 - tailSizePercent)))
      .reduce((current, item) => (current + item)));
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
  console.log('\r\033[K' + hash + ':\t' + measureOneHash(hash));
});
