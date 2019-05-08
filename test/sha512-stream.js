const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const child = spawnSync(process.execPath, [
  path.resolve(path.join(__dirname, '..', 'benchmark', 'stream.js')),
  '-t', '-H', 'sha512'
]);
assert.deepStrictEqual(JSON.parse(child.stdout.toString()), {
  '48628f3646b0adaa86a9f036e52bb21a89b1902023e4be3a3237dae70283140a0d1a8b921c7fa4806097f593cb4f9c8c4dc551b266ba63abe7c2f5409744a20a': '',
  'streamsDesired': 500,
  'streamsCompleted': 500,
  'streamsStarted': 500,
  'streamsMeasured': 0
});
