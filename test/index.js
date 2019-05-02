const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
fs.readdirSync(__dirname).forEach((item) => {
  const fullPath = path.join(__dirname, item);
  if (fullPath.match(/[.]js$/) && fullPath !== __filename) {
    const child = spawnSync(process.execPath, [ fullPath ]);
    if (child.status !== 0) {
      console.log('*** ' + fullPath + ' failed ***');
      console.log('stdout:');
      console.log(child.stdout.toString());
      console.log('stderr:');
      console.log(child.stderr.toString());
      throw new Error(child.error);
    }
  }
});
