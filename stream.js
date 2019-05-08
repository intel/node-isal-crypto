const isal = require('.');

// Grab the things we need from isal. The right hand sides are the names of the
// resulting local variables.
const {
  multi_buffer: {
    HASH_CTX_FLAG: hashFlag,
    HASH_CTX_STS: hashStatus
  },
  sha512_mb: {
    HashOpCode: opCode,
    ContextResetFlag: resetFlag,
    SHA512_MAX_LANES: maxLanes,
    sizeof_manager,
    sizeof_context,
    digest_offset_in_context,
    sizeof_job
  },
  sha512_mb: native,
} = isal;

// We'll be subclassing stream's `Duplex` class.
const { Duplex } = require('stream');

// Turn the opcode- and cranking-based processing into actual methods.
class Op {
  constructor(native) {
    this._crank = native.op;
    // Point this Int32Array to the HashOp structure.
    this._op =
      new Int32Array(native, sizeof_manager + maxLanes * sizeof_context, 3);
  }

  requestContext() {
    this._op[0] = opCode.CONTEXT_REQUEST;
    this._crank();
    return this._op[1];
  }

  releaseContext(context) {
    this._op[0] = opCode.CONTEXT_RESET;
    this._op[1] = context;
    this._op[2] = resetFlag.CONTEXT_RESET_FLAG_RELEASE;
    this._crank();
  }

  resetContext(context) {
    this._op[0] = opCode.CONTEXT_RESET;
    this._op[1] = context;
    this._op[2] = resetFlag.CONTEXT_RESET_FLAG_RETAIN;
    this._crank();
  }

  submit(context, buffer, flag) {
    this._op[0] = opCode.MANAGER_SUBMIT;
    this._op[1] = context;
    this._op[2] = flag;
    this._crank(buffer);
    return this._op[1];
  }

  flush() {
    this._op[0] = opCode.MANAGER_FLUSH;
    this._crank();
    return this._op[1];
  }
}

// The class responsible for co-ordinating the current set of streams
class Manager {
  constructor(native) {
    this._contextsInFlight = 0;
    this._contextRequestors = [];
    this._contexts = {};
    this._op = new Op(native);
    this._immediate = null;

    // Create a version of _maybeFlush() bound to this object so we may pass it
    // to setImmediate().
    this._maybeFlushBound = this._maybeFlush.bind(this);

    // Populate the list of contexts.
    for (let index = 0; index < maxLanes; index++) {
      this._contexts[index] = {
        index,
        nativeStatus:
          new Int32Array(native,
            sizeof_manager + index * sizeof_context + sizeof_job, 1),
        digest:
          new Uint8Array(native,
            sizeof_manager + index * sizeof_context + digest_offset_in_context,
              32)
      };
    }

  }

  // Asynchronously request a context. If all contexts are taken up by streams,
  // the request is placed on a queue, to be answered when a stream becomes
  // available.
  requestContext(callback) {
    const index = this._op.requestContext();
    if (index >= 0) {
      this._contextsInFlight++;
      process.nextTick(callback, this._contexts[index]);
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

      // If a context has completed either reassign the context to a stream
      // currently awaiting one, or place it back on the list of available
      // contexts.
      if (context.nativeStatus[0] === hashStatus.HASH_CTX_STS_COMPLETE) {
        if (this._contextRequestors.length > 0) {
          // Re-assign this context to an awaiting requestor.
          this._op.resetContext(context.index);
          process.nextTick(this._contextRequestors.shift(), context);
        } else {
          // Nobody's waiting for a new context, so put this context back on the
          // list of available contexts.
          this._op.releaseContext(context.index);
          this._contextsInFlight--;
        }
      }
    }
  }

  // Add an immediate handler if there is still work left to do, and the queue
  // of streams asking for a context is empty. Perform flush() if called as the
  // immediate handler.
  _maybeFlush() {
    if (this._immediate) {
      this._immediate = null;
      this._maybeComplete(this._contexts[this._op.flush()]);
    }
    if (this._contextRequestors.length === 0 &&
        this._contextsInFlight > 0) {
      this._immediate = setImmediate(this._maybeFlushBound);
    }
  }

  // Asynchronously submit work. The callback is only called after the context
  // has been given to the manager *AND* the manager has given it back,
  // indicating that it has processed the data passed along. During that time
  // span a reference to the buffer must be saved in the context so as to avoid
  // the buffer getting garbage-collected.
  submit(context, buffer, flag, callback) {
    context._thisBuffer = buffer;
    context._callback = callback;
    this._maybeComplete(
      this._contexts[this._op.submit(context.index, buffer, flag)]);
    if (flag === hashFlag.HASH_LAST && !this._immediate) {
      this._maybeFlush();
    }
  }

  // There is only one manager in any given instance of this package.
  static singleton() {
    if (!this._singleton) {
      this._singleton = new Manager(native);
    }
    return this._singleton;
  }
}

// The implementation of a single stream
class SHA512MBHashStream extends Duplex {
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
      this.push(this._digest);
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
      Manager.singleton().requestContext((context) => {
        this._context = context;
        callback(context);
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
      Manager.singleton().submit(context, chunk,
        this._firstChunk ? hashFlag.HASH_FIRST : hashFlag.HASH_UPDATE, () => {
          this._firstChunk = false;
          callback();
        });
    });
  }

  // The stream implementation calls this function to indicate that EOF has been
  // reached.
  _final(callback) {
    this._requestContext((context) => {
      Manager
        .singleton()
        .submit(context, new Uint8Array(0), hashFlag.HASH_LAST, () => {
          this._digest = context.digest;
          callback();
        });
    });
  }
}

module.exports = SHA512MBHashStream;
