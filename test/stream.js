const SHA256MBStream = require('../stream');
const path = require('path');
const fs = require('fs');
const expected = '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07';
const digestToString = require('./lib/digestToString');
const assert = require('assert');
const hashes = {};
const crypto = require('crypto');
const doNodeJS = (process.argv[2] === 'nodejs');

let count = 0;
const interval = setInterval(() => {
  if (count++ < 100) {
    const input = fs.createReadStream(path.join(__dirname, 'input.txt'));
    const stream = (doNodeJS ? crypto.createHash('sha256') : new SHA256MBStream());
    const x = input.pipe(stream);
    x.on('finish', () => {
      hashes[x.read().toString('hex')] = true;
    });
  } else {
    clearInterval(interval);
  }
}, 0);

process.on('exit', () => {
  console.log(JSON.stringify(hashes, null, 4));
});
