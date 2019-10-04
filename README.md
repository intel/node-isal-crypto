# Node.js bindings for [isa-l_crypto](https://github.com/01org/isa-l_crypto)

This project exposes the multi-buffer SHA digest API (sha256, sha512) to the
Node.js runtime via a native addon. It uses the same interface as the Node.js
built-in `crypto` module, but it does not support synchronous operation.

## Prerequisites

You need the followings in order to install `isa-l_crypto`:

* `nasm` version 2.13.03 or later
    * `yasm` version 1.3.0 or later on Windows
* A C++ compiler
* `make` on POSIX platforms
* `python`
* Node.js

## Installation

```sh
npm i isa-l_crypto
```

## Usage

`isa-l_crypto` intentionally exposes the same JavaScript interface as the
Node.js `crypto` built-in library, and provides SHA256 and SHA512 hashing.

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
performance penalty when there are only a few streams in progress at the same
time.

## Benchmarks

This package includes a benchmark that compares performance to the Node.js
built-in `crypto` module. You can run it as follows:

```sh
node benchmark/stream.js '<JSON object>'
```

where `<JSON object>` may have the following fields (defaults given):
```JSON
{
  "runNodeJS": false,
  "runAsTest": false,
  "fromFile": false,
  "streamsToStart": 500,
  "windowSizePercent": 0.5,
  "streamLength": 3359545,
  "hash": "sha256",
  "cpus": 1,
  "quiet": false
}
```

- `runNodeJS`: `true` to measure Node.js `crypto` performance instead of
`isa-l_crypto` performance.
- `runAsTest`: `true` to record the resulting hashes and to not take any
measurements.
- `fromFile`: `true` to use file `benchmark/input.txt` instead of a statically
allocated buffer.
- `streamsToStart`: The total number of streams to start.
- `windowSizePercent`: Measure this percentage of the streams started. The
measurements are performed such that streams are started up to the beginning of
the window, then the subsequent streams, up to a number corresponding to the
percentage chosen are marked for measurement and measured, then the rest of the
streams are left to run unmeasured. In the diagram below, each number in square
brackets represents a stream that gets launched by the benchmark. The streams
are launched such that a new stream is launched without waiting for an old
stream to finish. At its default value of 0.5, and with `streamsToStart` set at
100, the measuring window would be applied as follows:

    ```
                   {----window---}
     [ 0] ... [24]  [25] ... [74]  [75] ... [99]
    {-----skip----}{---measure---}{----skip-----}
    ```
- `streamLength`: The default length of the stream. If `fromFile` is set, this
value is ignored.
- `hash`: The hash to measure/test. One of `"sha256"` or `"sha512"`.
- `cpus`: The number of CPUs on which to run. Node.js `worker_thread` instances
are used to exploit multiple CPUs.
- `quiet`: `true` to produce no output. This is useful when measuring using an
external tool such as `perf`.

## Development

### Running the tests

```sh
npm install && npm test
```

### Building with debug symbols

```sh
npm install --debug
```

### Testing distribution

The tarball generated with `npm pack` may or may not have everything that is
needed to successfully install and run on a target user's system. The tests
provided with this package can be configured to `require('isa-l_crypto)` instead
of loading the package via a local `require()` call.

Note that testing whether the release package tarball contains the correct files
requires that the test script be able to install a package globally. That is, it
must have the privilege to run `npm install -g <package>`.

To test this scenario, run the following command:

```sh
npm install -g $(npm pack) \
  && npm install --ignore-scripts \
  && npm link isa-l_crypto \
  && npm test --package \
  && npm rm -g isa-l_crypto
``` 

This runs `npm pack`, the output of which is the name of the generated tarball.
It passes the name of the tarball as the last argument of `npm install -g`,
which then installs the package globally. It then installs the development
packages for `isa-l_crypto` locally without actually building the native addon.
The last command runs the tests, specifying via the `--package` argument that
the addon is to be loaded from the global package. Lastly, it removes the
globally installed package.

### Coverage

Test coverage data can be generated for both the JavaScript code and the native
code that is part of the package. To produce such coverage data, run

```sh
npm install --coverage && npm run-script coverage
```
