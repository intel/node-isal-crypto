const opCode = {
  NOOP: 0,
  CONTEXT_REQUEST: 1,
  CONTEXT_RESET: 2,
  MANAGER_SUBMIT: 3,
  MANAGER_FLUSH: 4
};
const resetFlag = {
  CONTEXT_RESET_FLAG_RELEASE: 0,
  CONTEXT_RESET_FLAG_RETAIN: 1
};

// Turn the opcode- and cranking-based processing into actual methods.
class Op {
  constructor(native) {
    this._crank = native.op;
    // Point this Int32Array to the HashOp structure.
    this._op =
      new Int32Array(native, native.sizeof_manager +
        native.maxLanes * native.sizeof_context, 3);
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

module.exports = Op;
