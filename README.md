# Node.js bindings for [isa-l_crypto](https://github.com/01org/isa-l_crypto)

This project exposes the multi-buffer SHA digest API (sha256, sha512) to the
Node.js runtime via a native addon. It uses the same interface as the Node.js
built-in `crypto` module, but it does not support synchronous operation.

## Installation

```sh
npm i isa-l_crypto
```

## Usage

```JS
const crypto = require('isa-l_crypto');
const fs = require('fs');
fs.createReadStream('input-file.txt')
  .pipe(crypto.createHash('sha256'))
  .on('finish', function() {
    console.log('sha256sum is: ' + this.read().toString('hex'));
  });
```

## Notes

The library provides the greatest speedup for use cases where there are many
incoming streams, for all of which a SHA256 sum needs to be computed. There is a
performance penalty when there are only a few streams in progress.
