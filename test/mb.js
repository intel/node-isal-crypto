const assert = require('assert');
const path = require('path');
const testRunner = require('./lib/test-runner');

const benchmarkPath = path.resolve(
  path.join(__dirname, '..', 'benchmark', 'stream.js')
);

const streamCount = {
  streamsStarted: 500,
  streamsCompleted: 500,
};

const fileHashes = {
  sha256: {
    '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07': ''
  },
  sha512: {
    ['48628f3646b0adaa86a9f036e52bb21a89b1902023e4be3a3237dae70283140a0d1a8b9'
      + '21c7fa4806097f593cb4f9c8c4dc551b266ba63abe7c2f5409744a20a']: ''
  }
};

const internalHashes = {
  sha256: {
    '30e14955ebf1352266dc2ff8067e68104607e750abb9d3b36582b8af909fcb58': ''
  },
  sha512: {
    ['d6292685b380e338e025b3415a90fe8f9d39a46e7bdba8cb78c50a338cefca741f69e4e'
    + '46411c32de1afdedfb268e579a51f81ff85e56f55b0ee7c33fe8c25c9']: ''
  }
};

[1, 2].forEach((cpus) => {
  Object.keys(fileHashes).forEach((hash) => {
    const child = testRunner([
      benchmarkPath,
      JSON.stringify({
        runNodeJS: false,
        hash,
        cpus,
        runAsTest: true,
        fromFile: true,
        streamsToStart: 3
      })
    ]);
    console.log('cpus: ' + cpus + ', few ' + hash + ' mb streams');
    assert.deepStrictEqual(JSON.parse(child.stdout.toString()),
      Object.assign({}, {
        streamsStarted: 3 * cpus,
        streamsCompleted: 3 * cpus
      }, fileHashes[hash]));
  });

  [false, true].forEach((runNodeJS) => {
    [true, false].forEach((fromFile) => {
      Object.keys(fileHashes).forEach((hash) => {
        const child = testRunner([
          benchmarkPath, JSON.stringify(Object.assign({
            runNodeJS,
            hash,
            cpus,
            fromFile,
            runAsTest: true,
          }, fromFile ? {} : {
            streamLength: 1048576
          }))
        ]);
        console.log(
          'cpus: ' + cpus + ',',
          (fromFile ? 'file' : 'internal'),
          (runNodeJS ? 'nodejs' : 'mb'),
          hash
        );
        assert.deepStrictEqual(
          JSON.parse(child.stdout.toString()),
          Object.assign({}, {
            streamsStarted: streamCount.streamsStarted * cpus,
            streamsCompleted: streamCount.streamsCompleted * cpus,
          }, (fromFile ? fileHashes[hash] : internalHashes[hash]))
        );
      });
    });
  });
});
