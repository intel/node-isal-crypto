const acceptNotReady = 0;
const acceptCall = 1;
const acceptCalled = 2;

const path = require('path');
const fs = require('fs');
const DataProducer = require('./DataProducer');

module.exports = (options) => new Promise((accept) => {
  const crypto = require('./require-crypto')(options.runNodeJS);

  const results = {
    streamsStarted: 0,
    streamsCompleted: 0,
    streamsMeasured: 0
  };
  let acceptStatus = acceptNotReady;

  const streamsDesired = options.streamsToStart;
  const windowStart = Math.round(streamsDesired
    * ((1 - options.windowSizePercent) / 2));
  const windowEnd = streamsDesired - windowStart;
  const streamsToMeasure = windowEnd - windowStart;

  function onStreamFinish() {
    const checksum = this.read().toString('hex');
    if (options.runAsTest) {
      results[checksum] = '';
    }
    results.streamsCompleted += 1;
    if (this._measure) {
      results.streamsMeasured += 1;
      if (results.streamsMeasured === streamsToMeasure) {
        results.end = process.hrtime();
        if (!options.runAsTest) {
          acceptStatus = acceptCall;
        }
      }
    }
    if ((results.streamsCompleted === streamsDesired
      || acceptStatus === acceptCall) && acceptStatus !== acceptCalled) {
      accept(results);
      acceptStatus = acceptCalled;
    }
  }

  for (let streamIndex = 0; streamIndex < streamsDesired; streamIndex += 1) {
    if (streamIndex === windowStart && windowEnd > windowStart) {
      results.start = process.hrtime();
    }

    (options.fromFile
      ? fs.createReadStream(path.join(__dirname, 'input.txt'))
      : (new DataProducer({ toProduce: options.streamLength })))
      .pipe(crypto.createHash(options.hash))
      .on('finish', onStreamFinish)
      ._measure = (streamIndex >= windowStart && streamIndex < windowEnd);

    results.streamsStarted += 1;
  }
});
