const isal = require('.');
const{ HASH_FIRST, HASH_LAST, HASH_UPDATE } = isal.multi_buffer.HASH_CTX_FLAG;
const { Duplex } = require('stream');
const sha256_mb = isal.sha256_mb;
const LANES = 32;

class ContextManager {
  constructor() {
    this._contextIndex = 0;
    this._manager = new sha256_mb.Manager();
    this._availableContexts = [];
    for (let idx = 0; idx < LANES; idx++) {
      this._availableContexts.push(Object.assign(new sha256_mb.Context(), {
        releaseCallback: null
      }));
    }
    this._immediate = null;
    this._contextRequestors = [];
  }

  requestContext(callback) {
    if (this._availableContexts.length > 0) {
      process.nextTick(callback,
        Object.assign(this._availableContexts.shift(), {
          index: this._contextIndex++
        }));
    } else {
      this._contextRequestors.push(callback);
    }
  }

  _maybeComplete(context) {
    if (context) {
      if (!context.complete && !context.processing && context._whenProcessed) {
        const whenProcessed = context._whenProcessed;
        context._whenProcessed = null;
        whenProcessed();
      }
      if (context.complete && context.releaseCallback) {
        context.releaseCallback(context);
        context.releaseCallback = null;
        if (this._contextRequestors.length > 0) {
          process.nextTick(this._contextRequestors.shift(), context);
        } else {
          this._availableContexts.push(context);
        }
      }
    }

    if (this._availableContexts.length < LANES && this._immediate === null) {
      this._immediate = setImmediate(() => {
        this._immediate = null;
        this._maybeComplete(this._manager.flush());
      });
    }
  }

  submit(context, buffer, flag, releaseCallback) {
    if (!context.releaseCallback && releaseCallback) {
      context.releaseCallback = releaseCallback;
    }
    return this._maybeComplete(this._manager.submit(context, buffer, flag));
  }

  static singleton() {
    if (!this._singleton) {
      this._singleton = new ContextManager();
    }
    return this._singleton;
  }
}

class SHA256MBHashStream extends Duplex {
  constructor(options) {
    super(options);
    this.firstChunk = true;
  }

  // TODO (gabrielschulhof): _read() takes a parameter `size`. What if the
  // size requested for reading is less than the size of the digest? What if
  // this.push() returns false, meaning stop pushing - unlikely, given that the
  // buffer size is 16 KiB.
  _read(size) {
    if (this._digest) {
      this.push(new Uint8Array(this._digest));
    }
  }

  _requestContext(callback) {
    if (this._context) {
      process.nextTick(callback, this._context);
    } else {
      ContextManager.singleton().requestContext((context) => {
        this._context = context;
        callback(context);
      });
    }
  }

  _submitWhenNotProcessing(context, chunk, flag, callback, releaseCallback) {
    const submit = () => {
      ContextManager
        .singleton()
        .submit(context, chunk, flag, releaseCallback);
      this.firstChunk = false;
      if (callback) {
        callback();
      }
    };
    if (context.processing) {
      context._whenProcessed = submit;
    } else {
      submit();
    }
  }

  _write(chunk, encoding, callback) {
    if (!chunk instanceof Buffer) {
      this.emit('error', new TypeError('input must be a Buffer'));
      return;
    }

    this._requestContext((context) => {
      this._submitWhenNotProcessing(context, chunk,
        this.firstChunk ? HASH_FIRST : HASH_UPDATE, callback);
    });
  }

  _final(callback) {
    this._requestContext((context) => {
      this._submitWhenNotProcessing(context, new Uint8Array(0), HASH_LAST,
        null, () => {
          // Clone the digest here because this context will be reused and its
          // digest property points to memory held as part of the context.
          this._digest = context.digest.slice(0);
          callback();
        });
    });
  }
}

module.exports = SHA256MBHashStream;
