const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
fs.readdirSync(__dirname).forEach((item) => {
  const fullPath = path.join(__dirname, item);
  if (fullPath.match(/[.]js$/) && fullPath !== __filename) {
    const child = spawnSync(process.execPath, [ fullPath ], {
      stdio: 'inherit'
    });
    if (child.status !== 0) {
      throw new Error(child.error);
    }
  }
});
