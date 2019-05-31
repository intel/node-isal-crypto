const fs = require('fs');
const path = require('path');
const { Suite } = require('benchmark');
const nodejsCrypto = require('crypto');
const DataProducer = require('./DataProducer');
const defaults = require('./defaults.json');
const mbCrypto = require('..');

const options = Object.assign({}, defaults,
  process.argv[2] ? JSON.parse(process.argv[2]) : {});

const crypto = options.runNodeJS ? nodejsCrypto : mbCrypto;
const cryptoMessage = options.runNodeJS ? 'nodejs' : 'mb';

(new Suite())
  .add(`${options.hash}(${cryptoMessage})`,
    (deferred) => {
      let streamsComplete = 0;
      function onFinish() {
        streamsComplete += 1;
        if (streamsComplete === options.streamsToStart) {
          deferred.resolve();
        }
      }
      for (let index = 0; index < options.streamsToStart; index += 1) {
        (options.fromFile
          ? fs.createReadStream(path.join(__dirname, 'input.txt'))
          : (new DataProducer({ toProduce: options.streamLength })))
          .pipe(crypto.createHash(options.hash))
          .on('finish', onFinish);
      }
    }, { defer: true })
  .on('cycle', (event) => console.log(String(event.target)))
  .run({ async: true });
