const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const child = spawnSync(process.execPath, [
  path.resolve(path.join(__dirname, '..', 'benchmark', 'stream.js')),
  '-t', '-H', 'sha256'
]);
assert.deepStrictEqual(JSON.parse(child.stdout.toString()), {
  '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07': '',
  'streamsDesired': 500,
  'streamsCompleted': 500,
  'streamsStarted': 500,
  'streamsMeasured': 0
});
