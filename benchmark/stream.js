const SHA256MBStream = require('../stream');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const argv = require('yargs')
  .option('c', {
    alias: 'count',
    type: 'number',
    default: 500,
    describe: 'How many streams to start'
  })
  .option('n', {
    alias: 'nodejs',
    type: 'boolean',
    describe: 'Run Node.js implementation'
  })
  .option('t', {
    alias: 'test',
    type: 'boolean',
    describe: 'Record hashes and ignore elapsed time'
  })
  .option('w', {
    alias: 'window-size-percent',
    type: 'number',
    default: 0.5,
    describe: 'Percentage of streams in the middle of the run to measure'
  })
  .option('p', {
    alias: 'perf-length',
    type: 'number',
    default: 0,
    describe: 'Number of seconds of perf data to record'
  })
  .help('h')
  .argv;

if (argv.test) {
  argv.windowSizePercent = 0;
}

const results = {
  streamsDesired: argv.count,
  streamsStarted: 0,
  streamsCompleted: 0,
  streamsMeasured: 0,
  elapsed: null
};

const streamsDesired = 500;
const windowStart = Math.round(streamsDesired * ((1 - argv.windowSizePercent) / 2));
const windowEnd = streamsDesired - windowStart;
const streamsToMeasure = windowEnd - windowStart;
const inputFile = path.join(__dirname, 'input.txt');

function runPerf(length) {
  const perf = spawn('perf', [
    'record', '-F', '99', '-p', '' + process.pid, '-g', '--', 'sleep', ('' + length)
  ], {
    stdio: 'inherit'
  });
  perf.on('exit', function(number, signal) {
    console.log('perf exit: ' + number + ', and signal ' + signal);
  });
}

function onStreamFinish() {
  const checksum = this.read().toString('hex');
  if (argv.test) {
    results[checksum] = '';
  }
  results.streamsCompleted++;
  if (this._measure) {
    results.streamsMeasured++;
    if (results.streamsMeasured === streamsToMeasure &&
        results.elapsed !== null) {
      results.elapsed = process
        .hrtime(results.elapsed)
        .reduce((first, second) => first * 1e9 + second);
    }
  }
}

for (let streamIndex = 0; streamIndex < streamsDesired; streamIndex++) {
  if (streamIndex === windowStart) {
    if (argv.perfLength > 0) {
      runPerf(argv.perfLength);
    }
    results.elapsed = process.hrtime();
  }

  fs.createReadStream(inputFile)
    .pipe(argv.nodejs ? crypto.createHash('sha256') : new SHA256MBStream())
    .on('finish', onStreamFinish)
    ._measure = (streamIndex >= windowStart && streamIndex < windowEnd);
  results.streamsStarted++;
}

process.on('exit', () => {
  if (argv.test) {
    delete results.elapsed;
  }
  console.log(JSON.stringify(results, null, 4));
});
