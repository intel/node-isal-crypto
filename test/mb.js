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
  sha1: Object.assign({}, streamCount, {
    '1c3dce4aa96d882b4986040cfdaf2fc9c68a8356': ''
  }),
  sha256: Object.assign({}, streamCount, {
    '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07': ''
  }),
  sha512: Object.assign({}, streamCount, {
    '48628f3646b0adaa86a9f036e52bb21a89b1902023e4be3a3237dae70283140a0d1a8b921c7fa4806097f593cb4f9c8c4dc551b266ba63abe7c2f5409744a20a': ''
  }),
  md5: Object.assign({}, streamCount, {
    '4bfdeee272e5f2f6654c40717133a028': ''
  })
};

Object.keys(results).forEach((key) => {
  const child = spawnSync(process.execPath, [
    benchmarkPath, '-t', '-H', key
  ]);
  assert.deepStrictEqual(JSON.parse(child.stdout.toString()), results[key]);
});
