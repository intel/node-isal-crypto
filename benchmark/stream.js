const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { Readable } = require('stream');
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
  .option('H', {
    alias: 'hash',
    describe: 'The hash to benchmark',
    default: 'sha256'
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
  .alias('h', 'help')
  .help('help')
  .usage(path.basename(__filename) + ' [options]')
  .argv;
const crypto = argv.nodejs ? require('crypto') : require('..');

let overallHRTime = process.hrtime();

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

const streamsDesired = argv.count;
const windowStart = Math.round(streamsDesired * ((1 - argv.windowSizePercent) / 2));
const windowEnd = streamsDesired - windowStart;
const streamsToMeasure = windowEnd - windowStart;
// const inputFile = path.join(__dirname, 'input.txt');

const buf = new Uint8Array(16384);

class DataProducer extends Readable {
  constructor(options) {
    super(options);
    this._toProduce = options.toProduce;
    this._soFar = 0;
  }
  _read(size) {
    const toProduce = Math.min(this._toProduce - this._soFar, size);
    this.push(toProduce === buf.byteLength ? buf :
      toProduce > 0 ? new Uint8Array(buf.buffer, 0, toProduce) :
      null);
    this._soFar += toProduce;
  }
}

function toNanoSeconds(hrtime) {
  return hrtime[0] * 1e9 + hrtime[1];
}

function runPerf(length) {
  const perf = spawn('perf', [
    'record', '-F', '99', '-p', '' + process.pid, '-g', '--', 'sleep', ('' + length)
  ], {
    stdio: 'inherit'
  });
  perf.on('exit', function(number, signal) {
    console.log(toNanoSeconds(process.hrtime(overallHRTime)) +
      ': perf exit: ' + number + ', and signal ' + signal);
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
      results.elapsed = toNanoSeconds(process.hrtime(results.elapsed));
      if (argv.perfLength > 0) {
        console.log(toNanoSeconds(process.hrtime(overallHRTime)) +
          ': window end');
      }
    }
  }
}

if (argv.perfLength > 0) {
  console.log(toNanoSeconds(process.hrtime(overallHRTime)) +
    ': starting to submit streams');
}

for (let streamIndex = 0; streamIndex < streamsDesired; streamIndex++) {
  if (streamIndex === windowStart) {
    if (argv.perfLength > 0) {
      console.log(toNanoSeconds(process.hrtime(overallHRTime)) +
        ': perf start');
      runPerf(argv.perfLength);
    }
    results.elapsed = process.hrtime();
  }

  (new DataProducer({ toProduce: 3359545}))
//  fs.createReadStream(inputFile)
    .pipe(crypto.createHash(argv.hash))
    .on('finish', onStreamFinish)
    ._measure = (streamIndex >= windowStart && streamIndex < windowEnd);
  results.streamsStarted++;
}

process.on('exit', () => {
  if (argv.test) {
    delete results.elapsed;
    delete results.streamsMeasured;
  }
  console.log(JSON.stringify(results, null, 4));
});
