const isal = require('.');
const{ HASH_FIRST, HASH_LAST, HASH_UPDATE } = isal.multi_buffer.HASH_CTX_FLAG;
const { Duplex } = require('stream');
const sha256_mb = isal.sha256_mb;
const LANES = isal.sha256_mb.SHA256_MAX_LANES;

// The class responsible for co-ordinating the current set of streams
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

  // Re-initialize a context so as to use it with a new stream.
  _reassignContext(context, callback, releaseCallback) {
    context.reset();
    process.nextTick(callback,
      Object.assign(context, {
        _releaseCallback: releaseCallback,
      }));
  }

  // Asynchronously request a context. If all contexts are taken up by streams,
  // the request is placed on a queue, to be answered when a stream becomes
  // available.
  requestContext({ callback, releaseCallback }) {
    if (this._availableContexts.length > 0) {
      this._reassignContext(this._availableContexts.shift(), callback,
        releaseCallback);
    } else {
      this._contextRequestors.push(arguments[0]);
    }
  }

  // The context resulting from a call to the native .submit() or .flush() is
  // processed here.
  _maybeComplete(context) {
    if (context) {
      // If a context was returned and a write was pending, indicate by calling
      // the callback that the write has completed. Also, dereference the
      // buffer associated with that write.
      if (context._callback) {
        context._thisBuffer = null;
        const callback = context._callback;
        context._callback = null;
        callback();
      }

      // If a submission was deferred because a write was in progress, then
      // execute the submission here.
      if (!context.complete && !context.processing && context._whenProcessed) {
        const whenProcessed = context._whenProcessed;
        context._whenProcessed = null;
        whenProcessed();
      }

      // If a context has completed then inform the release callback and
      // either reassign the context to a stream currently awaiting one, or
      // place it back on the list of available contexts.
      if (context.complete && context._releaseCallback) {
        // Call the release callback associated with the context.
        const releaseCallback = context._releaseCallback;
        context._releaseCallback = null;
        releaseCallback(context);

        if (this._contextRequestors.length > 0) {
          // Re-assign this context to an awaiting requestor.
          const request = this._contextRequestors.shift();
          this._reassignContext(context, request.callback,
            request.releaseCallback);
        } else {
          // Nobody's waiting for a new context, so put this context back on the
          // list of available contexts.
          this._availableContexts.push(context);
        }
      }
    }

    // As long as some contexts are still in use, add an idle callback to flush
    // the manager whenever there is nothing else to do.
    if (this._availableContexts.length < LANES && this._immediate === null) {
      this._immediate = setImmediate(() => {
        this._immediate = null;
        this._maybeComplete(this._manager.flush());
      });
    }
  }

  // Asynchronously submit work. The callback is only called after the context
  // has been given to the manager *AND* the manager has given it back,
  // indicating that it has processed the data passed along. During that time
  // span a reference to the buffer must be saved in the context so as to avoid
  // the buffer getting garbage-collected.
  submit(context, buffer, flag, callback) {
    const realSubmit = () => {
      context._thisBuffer = buffer;
      context._callback = callback;
      this._maybeComplete(this._manager.submit(context, buffer, flag));
    };
    if (context.processing) {
      context._whenProcessed = realSubmit;
    } else {
      process.nextTick(realSubmit);
    }
  }

  // There is only one manager in any given instance of this package.
  static singleton() {
    if (!this._singleton) {
      this._singleton = new ContextManager();
    }
    return this._singleton;
  }
}

// The implementation of a single stream
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

  // Asynchronously request a context. The first time around, a context is
  // further requested from the manager and saved into an instance variable,
  // also asynchronously, but on subsequent occasions the already-saved context
  // is returned. process.nextTick() is used to ensure that the behaviour in the
  // case of an already-saved context is minimally asynchronous.
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

  // Accept a chunk of data and pass it to the manager for processing.
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

  // The manager calls this function when the digest is ready to go.
  _releaseCallback(context) {
    // Clone the digest here because this context will be reused and its
    // digest property points to memory held as part of the context.
    this._digest = context.digest.slice(0);
    this._finalCallback();
  }

  // The stream implementation calls this function to indicate that EOF has been
  // reached.
  _final(callback) {
    // We save the callback here so as to run it when the manager informs us
    // that the digest is ready to go. We must save the callback here *BEFORE*
    // we submit to the manager the last, empty chunk.
    this._finalCallback = callback;
    this._requestContext((context) => {
      ContextManager.singleton().submit(context, new Uint8Array(0), HASH_LAST);
    });
  }
}

module.exports = SHA256MBHashStream;
