const { spawnSync } = require('child_process');

const isCoverageRun = (process.argv[2] === '-c');

const haveWorkers = (() => {
  try {
    require('worker_threads');
    return true;
  } catch (anError) {
    return false;
  }
})();

module.exports = function testRunner(argv, options) {
  return spawnSync(isCoverageRun ? 'c8' : process.execPath,
    (isCoverageRun
      ? ['--clean=false', '--reporter=none', process.execPath]
      : [])
      .concat(haveWorkers ? [] : ['--experimental-worker'])
      .concat(argv),
    options);
};
