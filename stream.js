const isal = require('.');
const{ HASH_FIRST, HASH_LAST, HASH_UPDATE } = isal.multi_buffer.HASH_CTX_FLAG;
const { Duplex } = require('stream');
const sha256_mb = isal.sha256_mb;
const LANES = 1;

class ContextManager {
  constructor() {
    this._manager = new sha256_mb.Manager();
    this._availableContexts = [];
    for (let idx = 0; idx < LANES; idx++) {
      this._availableContexts.push(new sha256_mb.Context());
    }
    this._immediate = null;
    this._contextRequestors = [];
  }

  _reassignContext(context, callback, releaseCallback) {
    context.reset();
    process.nextTick(callback,
      Object.assign(context, {
        _releaseCallback: releaseCallback,
      }));
  }

  requestContext({ callback, releaseCallback }) {
    if (this._availableContexts.length > 0) {
      this._reassignContext(this._availableContexts.shift(), callback, releaseCallback);
    } else {
      this._contextRequestors.push(arguments[0]);
    }
  }

  _maybeComplete(context) {
    if (context) {
      if (context._callback) {
        context._thisBuffer = null;
        const callback = context._callback;
        context._callback = null;
        callback();
      }
      if (!context.complete && !context.processing && context._whenProcessed) {
        const whenProcessed = context._whenProcessed;
        context._whenProcessed = null;
        whenProcessed();
      }
      if (context.complete && context._releaseCallback) {
        const releaseCallback = context._releaseCallback;
        context._releaseCallback = null;
        releaseCallback(context);
        if (this._contextRequestors.length > 0) {
          const request = this._contextRequestors.shift();
          this._reassignContext(context, request.callback, request.releaseCallback);
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

  submit(context, buffer, flag, callback) {
    const realSubmit = () => {
      context._thisBuffer = buffer;
      context._callback = callback;
      this._maybeComplete(this._manager.submit(context, buffer, flag));
    };
    if (context.processing) {
      context._whenProcessed = realSubmit;
    } else {
      realSubmit();
    }
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
    this._firstChunk = true;
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
      ContextManager.singleton().requestContext({
        callback: (context) => {
          this._context = context;
          callback(context);
        },
        releaseCallback: this._releaseCallback.bind(this)
      });
    }
  }

  _write(chunk, encoding, callback) {
    if (!chunk instanceof Buffer) {
      this.emit('error', new TypeError('input must be a Buffer'));
      return;
    }

    this._requestContext((context) => {
      ContextManager.singleton().submit(context, chunk,
        this._firstChunk ? HASH_FIRST : HASH_UPDATE, () => {
          this._firstChunk = false;
          callback();
        });
    });
  }

  _releaseCallback(context) {
    // Clone the digest here because this context will be reused and its
    // digest property points to memory held as part of the context.
    this._digest = context.digest.slice(0);
    this._finalCallback();
  }

  _final(callback) {
    this._finalCallback = callback;
    this._requestContext((context) => {
      ContextManager.singleton().submit(context, new Uint8Array(0), HASH_LAST);
    });
  }
}

module.exports = SHA256MBHashStream;
