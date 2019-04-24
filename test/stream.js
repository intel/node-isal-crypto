const SHA256MBStream = require('../stream');
const path = require('path');
const fs = require('fs');
const expected = '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07';
const digestToString = require('./lib/digestToString');
const assert = require('assert');

function newStream() {
  const stream = new SHA256MBStream();
  const input = fs.createReadStream(path.join(__dirname, 'input.txt'));
  const x = input.pipe(stream);
  x.on('finish', () => {
    assert.strictEqual(digestToString(x.read().buffer), expected);
  });
}


newStream();

