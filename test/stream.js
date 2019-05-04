const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const child = spawnSync(process.execPath, [
  path.resolve(path.join(__dirname, '..', 'benchmark', 'stream.js')),
  '',
  'test'
]);
assert.deepStrictEqual(JSON.parse(child.stdout.toString()), {
  '1feba561bf9106f3cbf6d78dd0c6056eef6ab59f15a30e64530ea6aea91d4e07': '',
  'streamsComplete': 200
});
