const path = require('path');
const { spawnSync } = require('child_process');
const run = require('./build-scripts/lib/run');

const benchmarkPath = path.join(__dirname, 'benchmark', 'stream');
const hashes = ['sha256', 'sha512'];
const samples = 20;
const tailSizePercent = 0.05;

const options = Object.assign({},
  require('./benchmark/defaults.json'),
  process.argv[2] !== undefined ? JSON.parse(process.argv[2]) : {});

function measureOneHash(hash) {
  const resultsNode = [];
  const resultsMB = [];
  for (let idx = 0; idx < samples; idx += 1) {
    process.stdout.write('\r\x1b[K' + hash + '(node): iteration ' + idx);
    resultsNode.push(JSON.parse(
      spawnSync(process.execPath, [
        benchmarkPath,
        JSON.stringify(Object.assign({}, options, { hash, runNodeJS: true }))
      ])
        .stdout
        .toString()
    ).elapsed);
    process.stdout.write('\r\x1b[K' + hash + ': iteration ' + idx);
    resultsMB.push(JSON.parse(
      spawnSync(process.execPath, [
        benchmarkPath,
        JSON.stringify(Object.assign({}, options, { hash, runNodeJS: false }))
      ])
        .stdout
        .toString()
    ).elapsed);
  }

  return (
    resultsNode
      .sort()
      .slice(Math.round(samples * tailSizePercent),
        Math.round(samples * (1 - tailSizePercent)))
      .reduce((current, item) => (current + item))
    / resultsMB
      .sort()
      .slice(Math.round(samples * tailSizePercent),
        Math.round(samples * (1 - tailSizePercent)))
      .reduce((current, item) => (current + item)));
}

if (process.argv[2] === 'rebuild') {
  run('bash', [
    '-c',
    'git clean -xfd'
    + '&& git submodule foreach --recursive git clean -xfd'
    + '&& git submodule foreach --recursive git reset --hard'
    + '&& git submodule update --init --recursive'
    + '&& MAKEOPTS=-j120 npm '
    + (process.env.http_proxy ? '--proxy=' + process.env.http_proxy : '')
    + ' install'
  ], {
    stdio: 'inherit'
  });
}

hashes.forEach((hash) => {
  console.log('\r\x1b[K' + hash + ':\t' + measureOneHash(hash));
});
