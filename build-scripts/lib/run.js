const { spawnSync } = require('child_process');

module.exports = function run(command, arguments, options) {
  const result = spawnSync(command, arguments, options);
  if (result.status !== 0) {
    throw Object.assign(new Error(
        'command ' + command +
        ' with arguments ' + JSON.stringify(arguments) + ', ' +
        ' stdout ' + JSON.stringify(result.stdout.toString()) + ', ' +
        ' stderr ' + JSON.stringify(result.stderr.toString()) + ', ' +
        ' and options ' + JSON.stringify(options) +
        ' failed'), {
      status: result.status,
      signal: result.signal,
      error: result.error
    });
  }
}

