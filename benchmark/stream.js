const SHA256MBStream = require('../stream');
const path = require('path');
const fs = require('fs');
const expected = '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07';
const assert = require('assert');
const crypto = require('crypto');
const doNodeJS = (process.argv[2] === 'nodejs');
const testCorrectness = (process.argv[3] === 'test');
const results = {
  streamsStarted: 0,
  streamsDesired: 200,
  streamsComplete: 0
};
const windowStart = (results.streamsDesired >> 2);
const windowEnd = windowStart * 3;
let time;
const interval = setInterval(() => {
  if (results.streamsStarted < results.streamsDesired) {
    results.streamsStarted++;
    const input = fs.createReadStream(path.join(__dirname, 'input.txt'));
    const stream = (doNodeJS ? crypto.createHash('sha256') : new SHA256MBStream());
    const x = input.pipe(stream);
    x.on('finish', () => {
      const checksum = x.read().toString('hex');
      results.streamsComplete++;
      if (results.streamsComplete === windowStart) {
        time = process.hrtime();
      } else if (results.streamsComplete === windowEnd) {
        time = process.hrtime(time);
      }
      if (testCorrectness) {
        results[checksum] = '';
      }
      if (results.streamsComplete === results.streamsDesired) {
        if (testCorrectness) {
          console.log(JSON.stringify(results, null, 4));
        } else {
          console.log((windowEnd - windowStart + 1) +
            ' streams in ' + (time[0] * 1e9 + time[1]) + ' ns');
        }
      }
    });
  } else {
    clearInterval(interval);
  }
}, 0);
