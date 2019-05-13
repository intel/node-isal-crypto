# Node.js bindings for [isa-l_crypto](https://github.com/01org/isa-l_crypto)
This project exposes SHA digest API (sha1, sha256, sha512) to the Node.js runtime via native addon.

## Usage:

```JS
const SHA256MBStream = require('isa-l_crypto');
const fs = require('fs');
fs.createReadStream('input-file.txt')
  .pipe(new SHA256MBStream)
  .on('finish', function() {
    console.log('sha256sum is: ' + this.red().toString('hex'));
  });
```

## Notes:

The library works best for use cases where there are many incoming streams, for
all of which a SHA256 sum needs to be computed. There is a performance penalty
when there are only a few streams in progress.
