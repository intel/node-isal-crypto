const { spawnSync } = require('child_process');

const runs = {
  streamsToStart: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
  streamLength: [524288, 1048576, 2097152, 4194304, 8388608],
  hash: ['sha256'],
  runNodeJS: [true, false]
};

function perfRow(line) {
  return line.match(/\S+/g)[0].replace(/,/g, '');
}

runs.hash.forEach((hash) => (
  runs.runNodeJS.forEach((runNodeJS) => (
    runs.streamsToStart.forEach((streamsToStart) => (
      runs.streamLength.forEach((streamLength) => {
        const options = {
          hash,
          streamLength,
          streamsToStart,
          runNodeJS,
          windowSizePercent: 0,
          quiet: true
        };

        const child = spawnSync('perf', [
          'stat',
          'node',
          'benchmark/stream.js',
          JSON.stringify(options)
        ]);

        console.log('perf stat node benchmark/stream.js ' + JSON.stringify(options));
        console.log('node benchmark/stream.js ' + JSON.stringify(options));
        console.log(streamsToStart);
        console.log(streamLength / 1024);

        const rows = child.stderr.toString().split('\n');
        console.log(perfRow(rows[3]));
        console.log(perfRow(rows[4]));
        console.log(perfRow(rows[5]));
        console.log(perfRow(rows[6]));
        console.log(perfRow(rows[7]));
        console.log(perfRow(rows[8]));
        console.log(perfRow(rows[9]));
        console.log(perfRow(rows[10]));
        console.log(perfRow(rows[12]));
        console.log('');
      })))))));
