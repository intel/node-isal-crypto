const {
  Worker, isMainThread, parentPort, workerData
} = require('worker_threads');

if (isMainThread) {
  // When running as the main thread, handle the command line, assemble the
  // options, and start the workers.
  const path = require('path');

  const options = Object.assign({}, require('./defaults.json'));

  if (process.argv[2] === '-h' || process.argv[2] === '--help') {
    console.log('Usage: '
      + path.basename(__filename)
      + ' [-h|options]\n\nwhere options is a JSON object. '
      + 'The following properties/default values are used:\n'
      + JSON.stringify(options, null, 4));
    process.exit(0);
  } else if (process.argv[2] !== undefined) {
    Object.assign(options, JSON.parse(process.argv[2]));
  }

  if (options.runAsTest) {
    options.windowSizePercent = 0;
  }

  // When benchmarking, store the results in a SharedArrayBuffer with
  // the following structure:
  // {
  //   uint32 nextIndex;
  //   {
  //     uint32 streamsMeasured;
  //     uint32[2] start;
  //     uint32[2] end;
  //   } results[cpuCount];
  // }
  const resultsData = new SharedArrayBuffer(4 + options.cpus * 20);

  function* workerList(cpuCount) {
    for (let index = 0; index < cpuCount; index += 1) {
      yield new Promise((accept) => new Worker(__filename, {
        workerData: Object.assign(options, options.runAsTest ? {} : {
          resultsData
        })
      // When benchmarking, we are not interested in messages coming in from the
      // thread, because the data is being stored in the SharedArrayBuffer
      }).on(options.runAsTest ? 'message' : 'exit', accept));
    }
  }

  Promise.all([...workerList(options.cpus)]).then((results) => {
    if (options.runAsTest) {
      results = results.reduce((soFar, item) => {
        soFar.streamsStarted += item.streamsStarted;
        soFar.streamsCompleted += item.streamsCompleted;
        return soFar;
      });
    } else {
      const resultsArray = new Uint32Array(resultsData);
      results = {
        streamsMeasured: resultsArray[1],
        start: resultsArray[2] * 1e9 + resultsArray[3],
        end: resultsArray[4] * 1e9 + resultsArray[5]
      };
      for (let index = 1; index < options.cpus; index += 1) {
        results.streamsMeasured += resultsArray[index * 5 + 1];
        results.start = Math.min(results.start,
          resultsArray[index * 5 + 2] * 1e9 + resultsArray[index * 5 + 3]);
        results.end = Math.min(results.end,
          resultsArray[index * 5 + 4] * 1e9 + resultsArray[index * 5 + 5]);
      }
    }
    if (options.runAsTest) {
      delete results.start;
      delete results.end;
      delete results.streamsMeasured;
    } else {
      results.elapsed = results.end - results.start;
      delete results.start;
      delete results.end;
    }
    if (!options.quiet) {
      console.log(JSON.stringify(results, null, 4));
    }
  });
} else {
  // When running as a worker thread, run the runner and send the results to
  // the main thread.
  const runner = require('./runner');
  if (workerData.runAsTest) {
    runner(workerData).then((results) => parentPort.postMessage(results));
  } else {
    const { resultsData } = workerData;
    const resultsArray = new Uint32Array(resultsData);
    const myIndex = Atomics.add(resultsArray, 0, 1);
    runner(workerData).then((results) => {
      resultsArray[myIndex * 5 + 1] = results.streamsMeasured;
      if (results.streamsMeasured > 0) {
        resultsArray[myIndex * 5 + 2] = results.start[0];
        resultsArray[myIndex * 5 + 3] = results.start[1];
        resultsArray[myIndex * 5 + 4] = results.end[0];
        resultsArray[myIndex * 5 + 5] = results.end[1];
      }
    });
  }
}
