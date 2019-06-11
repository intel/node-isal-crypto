const CONTEXT_REQUEST = 1;
const CONTEXT_RESET = 2;
const MANAGER_SUBMIT = 3;
const MANAGER_FLUSH = 4;

const CONTEXT_RESET_FLAG_RELEASE = 1;
const CONTEXT_RESET_FLAG_RETAIN = 2;

// Turn the opcode- and cranking-based processing into actual methods.
class Op {
  constructor(native) {
    this._crank = native.op;
    // Point this Int32Array to the HashOp structure.
    this._op = new Int32Array(native,
      native.maxLanes * native.sizeofContext, 3);
  }

  requestContext() {
    this._op[0] = CONTEXT_REQUEST;
    this._crank();
    return this._op[1];
  }

  releaseContext(context) {
    this._op[0] = CONTEXT_RESET;
    this._op[1] = context;
    this._op[2] = CONTEXT_RESET_FLAG_RELEASE;
    this._crank();
  }

  resetContext(context) {
    this._op[0] = CONTEXT_RESET;
    this._op[1] = context;
    this._op[2] = CONTEXT_RESET_FLAG_RETAIN;
    this._crank();
  }

  submit(context, buffer, flag) {
    this._op[0] = MANAGER_SUBMIT;
    this._op[1] = context;
    this._op[2] = flag;
    this._crank(buffer);
    return this._op[1];
  }

  flush() {
    this._op[0] = MANAGER_FLUSH;
    this._crank();
    return this._op[1];
  }
}

module.exports = Op;
