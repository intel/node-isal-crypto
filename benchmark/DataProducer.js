const { Readable } = require('stream');

const buf = new Uint8Array(16384);

class DataProducer extends Readable {
  constructor(options) {
    super(options);
    this._toProduce = options.toProduce;
    this._soFar = 0;
  }

  _read(size) {
    const toProduce = Math.min(this._toProduce - this._soFar, size);
    let push = buf;
    if (toProduce !== buf.byteLength) {
      push = (toProduce > 0 ? new Uint8Array(buf.buffer, 0, toProduce) : null);
    }
    this.push(push);
    this._soFar += toProduce;
  }
}

module.exports = DataProducer;
