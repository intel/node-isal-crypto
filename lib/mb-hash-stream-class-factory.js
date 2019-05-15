// We'll be subclassing stream's `Duplex` class.
const { Duplex } = require('stream');
const Op = require('./op');

// Flags used with submit() to indicate what part of the stream we're handling.
const HASH_UPDATE = 0;
const HASH_FIRST = 1;
const HASH_LAST = 2;

// Status of the last submitted chunk.
const HASH_CTX_STS_COMPLETE = 0x04;

// An array used with HASH_LAST to tie off the stream in _final().
const emptyArray = new Uint8Array(0);

module.exports = (options) => {
  // Grab the things we need from the native side. Local variables are created
  // having the same name as the names of the properies listed.
  const {
    native: {
      maxLanes, sizeofContext, digestOffsetInContext, sizeofJob
    },
    native, className, digestLength
  } = options;

  // Declare the class responsible for co-ordinating the current set of streams.
  class Manager {
    constructor(binding) {
      this._contextsInFlight = 0;
      this._requests = [];
      this._contexts = [];
      this._op = new Op(binding);
      this._immediate = null;

      // Create a version of _maybeFlush() bound to this object so we may pass it
      // to setImmediate().
      this._maybeFlushBound = this._maybeFlush.bind(this);

      // For each lane, create a function that will write to it.
      for (let index = 0; index < maxLanes; index += 1) {
        this._contexts.push(Object.assign(this._writeImpl.bind(this, index), {
          status: new Int32Array(native, index * sizeofContext + sizeofJob, 1),
          digest:
            new Uint8Array(native,
              index * sizeofContext + digestOffsetInContext, digestLength)
        }));
      }
    }

    // Asynchronously submit work to a lane. The callback is only called after
    // the context has been submitted to the manager *AND* the manager has
    // returned it, indicating that it has processed the data passed along.
    _writeImpl(index, buffer, flag, callback) {
      const context = this._contexts[index];
      context._callback = callback;

      // Store the buffer on the context until the write completes so as to
      // prevent its garbage collection.
      context._buffer = buffer;
      this._maybeComplete(this._op.submit(index, buffer, flag));
      if (!this._immediate) {
        this._maybeFlush();
      }
    }

    // Asynchronously request a writer. If all writers are taken up by streams,
    // the request is placed on a queue, to be answered when a lane becomes
    // available.
    requestWriter(callback) {
      const index = this._op.requestContext();
      if (index >= 0) {
        this._contextsInFlight += 1;
        callback(this._contexts[index]);
      } else {
        this._requests.push(callback);
      }
    }

    // The context resulting from a call to the native .submit() or .flush() is
    // processed here.
    _maybeComplete(index) {
      if (index >= 0) {
        const context = this._contexts[index];
        // If a context was returned indicate by calling the callback that the
        // write has completed.
        context._callback();

        // If a context has completed either reassign the context to a stream
        // currently awaiting one or place it back on the list of available
        // contexts.
        if (context.status[0] === HASH_CTX_STS_COMPLETE) {
          if (this._requests.length > 0) {
            // Re-assign this writer to an awaiting requestor.
            this._op.resetContext(index);
            this._requests.shift()(context);
          } else {
            // Nobody's waiting for a new writer, so put it back on the list of
            // available writers.
            this._op.releaseContext(index);
            this._contextsInFlight -= 1;
          }
        }
      }
    }

    // Add an immediate handler if there is still work left to do. Perform flush()
    // if called as the immediate handler.
    _maybeFlush() {
      if (this._immediate) {
        this._immediate = null;
        this._maybeComplete(this._op.flush());
      }
      if (this._contextsInFlight > 0) {
        this._immediate = setImmediate(this._maybeFlushBound);
      }
    }
  }

  // All streams are managed by a singleton instance of Manager.
  const manager = new Manager(native);

  // Declare the class whose instances handle individual streams.
  const MBHashStream = class extends Duplex {
    // TODO (gabrielschulhof): _read() takes a parameter `size`. What if the
    // size requested for reading is less than the size of the digest? What if
    // this.push() returns false, meaning stop pushing - unlikely, given that the
    // buffer size is 16 KiB.
    _read() {
      if (this._writer.status[0] === HASH_CTX_STS_COMPLETE) {
        this.push(this._writer.digest);
      }
    }

    // Accept a chunk of data and pass it to the manager for processing.
    _write(chunk, encoding, callback) {
      if (encoding !== 'buffer') {
        this.emit('error', new TypeError('input must be a Buffer'));
        return;
      }

      if (this._writer) {
        process.nextTick(this._writer, chunk, HASH_UPDATE, callback);
      } else {
        manager.requestWriter((writer) => {
          this._writer = writer;
          writer(chunk, HASH_FIRST, callback);
        });
      }
    }

    // The stream implementation calls this function to indicate that EOF has been
    // reached.
    _final(callback) {
      this._writer(emptyArray, HASH_LAST, callback);
    }
  };

  // Set the name of the class we are about to return.
  return Object.defineProperty(MBHashStream, 'name', { value: className });
};
