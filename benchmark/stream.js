const SHA256MBStream = require('../stream');
const path = require('path');
const fs = require('fs');
const expected = '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07';
const assert = require('assert');
const crypto = require('crypto');
const doNodeJS = (process.argv[2] === 'nodejs');
const testCorrectness = (process.argv[3] === 'test');
const hashes = {};
const streamCount = 100;
let streamsComplete = 0;

let count = 0;
const start = process.hrtime();
const interval = setInterval(() => {
  if (count++ < streamCount) {
    const input = fs.createReadStream(path.join(__dirname, 'input.txt'));
    const stream = (doNodeJS ? crypto.createHash('sha256') : new SHA256MBStream());
    const x = input.pipe(stream);
    x.on('finish', () => {
      const result = x.read().toString('hex');
      streamsComplete++;
      if (testCorrectness) {
        hashes[result] = '';
      }
      if (streamsComplete == streamCount) {
        const elapsed = process.hrtime(start);
        if (testCorrectness) {
          console.log(JSON.stringify(hashes, null, 4));
        } else {
          console.log('elapsed: ' + (elapsed[0] * 1e9 + elapsed[1]) + ' ns');
        }
      }
    });
  } else {
    clearInterval(interval);
  }
}, 0);
