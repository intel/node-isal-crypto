const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { Readable } = require('stream');

const options = {
  runNodeJS: false,
  runAsTest: false,
  fromFile: false,
  windowSizePercent: 0.5,
  streamsToStart: 500,
  streamLength: 3359545,
  hash: 'sha256',
  quiet: false
};

if (process.argv[2] === '-h' || process.argv[2] === '--help') {
  console.log('Usage: ' + path.basename(__filename) +
    ' [-h|options]\n\nwhere options is a JSON object. ' +
    'The following properties/default values are used:\n' +
    JSON.stringify(options, null, 4));
  process.exit(0);
} else if (process.argv[2] !== undefined) {
  Object.assign(options, JSON.parse(process.argv[2]));
}

const crypto = options.runNodeJS ? require('crypto') : require('..');

if (options.runAsTest) {
  options.windowSizePercent = 0;
}

const results = {
  streamsDesired: options.streamsToStart,
  streamsStarted: 0,
  streamsCompleted: 0,
  streamsMeasured: 0,
  elapsed: null
};

const streamsDesired = options.streamsToStart;
const windowStart =
  Math.round(streamsDesired * ((1 - options.windowSizePercent) / 2));
const windowEnd = streamsDesired - windowStart;
const streamsToMeasure = windowEnd - windowStart;

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

function onStreamFinish() {
  const checksum = this.read().toString('hex');
  if (options.runAsTest) {
    results[checksum] = '';
  }
  results.streamsCompleted++;
  if (this._measure) {
    results.streamsMeasured++;
    if (results.streamsMeasured === streamsToMeasure &&
        results.elapsed !== null) {
      results.elapsed = toNanoSeconds(process.hrtime(results.elapsed));
    }
  }
}

for (let streamIndex = 0; streamIndex < streamsDesired; streamIndex++) {
  if (streamIndex === windowStart) {
    results.elapsed = process.hrtime();
  }

  (options.fromFile ?
      fs.createReadStream(path.join(__dirname, 'input.txt')) :
      (new DataProducer({ toProduce: options.streamLength })))
    .pipe(crypto.createHash(options.hash))
    .on('finish', onStreamFinish)
    ._measure = (streamIndex >= windowStart && streamIndex < windowEnd);
  results.streamsStarted++;
}

process.on('exit', () => {
  if (options.runAsTest) {
    delete results.elapsed;
    delete results.streamsMeasured;
  }
  if (!options.quiet) {
    console.log(JSON.stringify(results, null, 4));
  }
});
