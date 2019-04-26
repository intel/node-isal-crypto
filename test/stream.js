const SHA256MBStream = require('../stream');
const path = require('path');
const fs = require('fs');
const expected = '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07';
const digestToString = require('./lib/digestToString');
const assert = require('assert');
const hashes = {};

let count = 0;
const interval = setInterval(() => {
  if (count++ < 100) {
    const stream = new SHA256MBStream();
    const input = fs.createReadStream(path.join(__dirname, 'input.txt'));
    const x = input.pipe(stream);
    x.on('finish', () => {
      hashes[digestToString(x.read().buffer)] = true;
    });
  } else {
    clearInterval(interval);
    console.log(JSON.stringify(hashes, null, 4));
  }
}, 0);



