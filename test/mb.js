const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const benchmarkPath =
  path.resolve(path.join(__dirname, '..', 'benchmark', 'stream.js'));

const streamCount = {
  streamsDesired: 500,
  streamsStarted: 500,
  streamsCompleted: 500,
};

const results = {
  fromFile: {
    sha256: Object.assign({}, streamCount, {
      '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07': ''
    }),
    sha512: Object.assign({}, streamCount, {
      '48628f3646b0adaa86a9f036e52bb21a89b1902023e4be3a3237dae70283140a0d1a8b921c7fa4806097f593cb4f9c8c4dc551b266ba63abe7c2f5409744a20a': ''
    })
  },
  internal: {
    sha256: Object.assign({}, streamCount, {
      '30e14955ebf1352266dc2ff8067e68104607e750abb9d3b36582b8af909fcb58': ''
    }),
    sha512: Object.assign({}, streamCount, {
      'd6292685b380e338e025b3415a90fe8f9d39a46e7bdba8cb78c50a338cefca741f69e4e46411c32de1afdedfb268e579a51f81ff85e56f55b0ee7c33fe8c25c9': ''
    })
  },
};

[true, false].forEach((runNodeJS) => {
  Object.keys(results).forEach((runTypeKey) => {
    Object.keys(results[runTypeKey]).forEach((hash) => {
      const child = spawnSync(process.execPath, [
        benchmarkPath, JSON.stringify(Object.assign({
          runNodeJS,
          hash,
          runAsTest: true,
          fromFile: (runTypeKey === 'fromFile')
        }, (runTypeKey === 'fromFile') ? {} : {
          streamLength: 1048576
        }))
      ]);
      console.log(runTypeKey, (runNodeJS ? 'nodejs' : 'mb'), hash);
      assert.deepStrictEqual(
        JSON.parse(child.stdout.toString()), results[runTypeKey][hash]);
    });
  });
});
