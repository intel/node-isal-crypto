#include "common.h"

napi_value init_mh_sha512(napi_env env);
napi_value init_sha512_mb(napi_env);

#define NAPI_DESCRIBE_INIT(env, name) \
  { #name, NULL, NULL, NULL, NULL, init_##name(env), napi_enumerable, NULL }

napi_value
Init(napi_env env, napi_value exports) {
  napi_property_descriptor sub_exports[] = {
    NAPI_DESCRIBE_INIT(env, mh_sha512),
    NAPI_DESCRIBE_INIT(env, sha512_mb)
  };

  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_define_properties(env,
                             exports,
                             sizeof(sub_exports) / sizeof(*sub_exports),
                             sub_exports));

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
