const isal = require('.');

// Grab the things we need from isal. The right hand sides are the names of the
// resulting local variables.
const {
  multi_buffer: {
    HASH_CTX_FLAG: hashFlag,
    HASH_CTX_STS: hashStatus
  },
  sha256_mb: {
    HashOpCode: opCode,
    ContextResetFlag: resetFlag,
    SHA256_MAX_LANES: maxLanes,
    sizeof_manager,
    sizeof_context,
    digest_offset_in_context,
    sizeof_job
  },
  sha256_mb: native,
} = isal;

const { Duplex } = require('stream');

// Turn the opcode- and cranking-based processing into actual methods.
class Op {
  constructor(native) {
    this._native = native;
    // Point this Int32Array to the HashOp structure.
    this._op = new Int32Array(native,
      // sizeof(SHA256_HASH_CTX_MGR)
      sizeof_manager +
      // sizeof(contexts)
      maxLanes * sizeof_context,
      3);
  }

  requestContext() {
    this._op[0] = opCode.CONTEXT_REQUEST;
    this._native.op();
    return this._op[1];
  }

  releaseContext(context) {
    this._op[0] = opCode.CONTEXT_RESET;
    this._op[1] = context;
    this._op[2] = resetFlag.CONTEXT_RESET_FLAG_RELEASE;
    this._native.op();
  }

  resetContext(context) {
    this._op[0] = opCode.CONTEXT_RESET;
    this._op[1] = context;
    this._op[2] = resetFlag.CONTEXT_RESET_FLAG_RETAIN;
    this._native.op();
  }

  submit(context, buffer, flag) {
    this._op[0] = opCode.MANAGER_SUBMIT;
    this._op[1] = context;
    this._op[2] = flag;
    this._native.op(buffer);
    return this._op[1];
  }

  flush() {
    this._op[0] = opCode.MANAGER_FLUSH;
    this._native.op();
    return this._op[1];
  }
}

class Context {
  constructor(native, index, releaseCallback) {
    this._index = index;
    this._releaseCallback = releaseCallback;
    this._nativeStatus = new Int32Array(native,
      sizeof_manager +
      index * sizeof_context +
      sizeof_job, 1);

    this._digest = new Uint8Array(native,
      sizeof_manager +
      index * sizeof_context +
      digest_offset_in_context, 32);
  }

  get complete() {
    return (this._nativeStatus[0] === hashStatus.HASH_CTX_STS_COMPLETE);
  }

  get processing() {
    return (this._nativeStatus[0] & hashStatus.HASH_CTX_STS_PROCESSING);
  }

  get digest() {
    return this._digest.slice(0);
  }
}

// The class responsible for co-ordinating the current set of streams
class Manager {
  constructor(native) {
    this._immediate = null;
    this._contextRequestors = [];
    this._contexts = { length: 0 };
    this._native = native;
    this._op = new Op(native);
  }

  // Asynchronously request a context. If all contexts are taken up by streams,
  // the request is placed on a queue, to be answered when a stream becomes
  // available.
  requestContext({ callback, releaseCallback }) {
    const index = this._op.requestContext();
    if (index >= 0) {
      this._contexts[index] = new Context(this._native, index, releaseCallback);
      this._contexts.length++;
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
          this._op.resetContext(context._index);
          this._contexts[context._index] =
            new Context(this._native, context._index, request.releaseCallback);
          process.nextTick(request.callback, this._contexts[context._index]);
        } else {
          // Nobody's waiting for a new context, so put this context back on the
          // list of available contexts.
          this._contexts[context._index] = null;
          this._contexts.length--;
          this._op.releaseContext(context._index);
        }
      }
    }

    // As long as some contexts are still in use, add an idle callback to flush
    // the manager whenever there is nothing else to do.
    if (this._contexts.length > 0 && this._immediate === null) {
      this._immediate = setImmediate(() => {
        this._immediate = null;
        this._maybeComplete(this._contexts[this._op.flush()]);
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
      this._maybeComplete(this._contexts[this._op.submit(context._index, buffer, flag)]);
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
      this._singleton = new Manager(native);
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
      Manager.singleton().requestContext({
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
      Manager.singleton().submit(context, chunk,
        this._firstChunk ? hashFlag.HASH_FIRST : hashFlag.HASH_UPDATE, () => {
          this._firstChunk = false;
          callback();
        });
    });
  }

  // The manager calls this function when the digest is ready to go.
  _releaseCallback(context) {
    // Clone the digest here because this context will be reused and its
    // digest property points to memory held as part of the context.
    this._digest = context.digest;
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
      Manager
        .singleton()
        .submit(context, new Uint8Array(0), hashFlag.HASH_LAST);
    });
  }
}

module.exports = SHA256MBHashStream;
