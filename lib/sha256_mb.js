const { Duplex } = require('stream');

const HashOpCode = {
  NOOP: 0,
  CONTEXT_REQUEST: 1,
  CONTEXT_RESET: 2,
  MANAGER_SUBMIT: 3,
  MANAGER_FLUSH: 4
};

const ContextResetFlag = {
  CONTEXT_RESET_FLAG_RELEASE: 0,
  CONTEXT_RESET_FLAG_RETAIN: 1
};

module.exports = function DeclareSHA256MBClasses(isal) {

const { sha256_mb, multi_buffer } = isal;

const {
  SHA256_MAX_LANES,
  sizeof_manager,
  sizeof_context,
  op
} = sha256_mb;

// Traverse the fields of a native context
class NativeContext {
}

// Turn the opcode- and cranking-based processing into actual methods.
class Op {
  constructor(native) {
    this._native = native;
    // Point this Int32Array to the HashOp structure.
    this._op = new Int32Array(native,
      // sizeof(SHA256_HASH_CTX_MGR)
      manager_size +
      // sizeof(contexts)
      SHA256_MAX_LANES * sizeof_context +
      // sizeof(available_indices)
      SHA256_MAX_LANES * 4 +
      // sizeof(next_context_id)
      4,
      // sizeof(HashOp)
      12);
  }

  requestContext() {
    this._op[0] = HashOpCode.CONTEXT_REQUEST;
    this._native.op();
    return this._op[1];
  }

  releaseContext(context) {
    this._op[0] = HashOpCode.CONTEXT_RESET;
    this._op[1] = context;
    this._op[2] = ContextResetFlag.CONTEXT_RESET_FLAG_RELEASE;
    this._native.op();
  }

  resetContext(context) {
    this._op[0] = HashOpCode.CONTEXT_RESET;
    this._op[1] = context;
    this._op[2] = ContextResetFlag.CONTEXT_RESET_FLAG_RETAIN;
    this._native.op();
  }

  submit(context, buffer, flag) {
    this._op[0] = HashOpCode.MANAGER_SUBMIT;
    this._op[1] = context;
    this._op[2] = flag;
    this._native.op(buffer);
    return this._op[1];
  }

  flush() {
    this._op[0] = HashOpCode.MANAGER_FLUSH;
    this._native.op();
    return this._op[1];
  }
}

class Context {
  constructor(native, index) {
    this._index = index;
    this._op = new Op(native);
    this._status = new DataView(native,
      native.sizeof_manager +
      index * native.sizeof_context +
      native.sizeof_job);
  }
  reset() {
    this._op.resetContext();
  }
  release() {
    this._op.releaseContext();
  }
  get processing() {
    return (this._status.getUint32() &
      isal.multi_buffer.HASH_CTX_STS.HASH_CTX_STS_PROCESSING);
  }
  get complete() {
    return (this._status.getUint32() ===
      isal.multi_buffer.HASH_CTX_STS.HASH_CTX_STS_COMPLETE);
  }
}

class Manager {
  constructor(native) {
    this._immediate = null;
    this._contextRequestors = [];
    this._contextData = {};
    this._native = native;
    this._op = new Op(native);
  }

  // Re-initialize a context so as to use it with a new stream.
  _reassignContext(context, callback, releaseCallback) {
    this._contextData[context] = { releaseCallback };
    process.nextTick(callback, context);
  }

  // Asynchronously request a context. If all contexts are taken up by streams,
  // the request is placed on a queue, to be answered when a stream becomes
  // available.
  requestContext({ callback, releaseCallback }) {
    const context = this._op.requestContext();

    if (resultingContext === -1) {
      this._contextRequestors.push(arguments[0]);
    } else {
      this._reassignContext(resultingContext, callback, releaseCallback);
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
      this._contextData[context]._thisBuffer = buffer;
      this._contextData[context]._callback = callback;
      this._maybeComplete(this._op.submit(context, buffer, flag));
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
      this._singleton = new Manager(sha256_mb);
    }
    return this._singleton;
  }
}

class HashStream extends Duplex {
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
        this._firstChunk ? HASH_FIRST : HASH_UPDATE, () => {
          this._firstChunk = false;
          callback();
        });
    });
  }
}

Object.assign(nativeBinding, { HashStream });
};
