#include "napi.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports["something"] = Napi::Number::New(env, 42);

  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
