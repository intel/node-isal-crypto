#include "common.h"
#include "multi_buffer.h"

napi_value init_multi_buffer(napi_env env) {

  napi_value exports;

  NAPI_CALL_RETURN_UNDEFINED(env, napi_create_object(env, &exports));

  {
    napi_value js_enum;
    NAPI_CALL_RETURN_UNDEFINED(env, napi_create_object(env, &js_enum));

    napi_property_descriptor enum_values[4] = {
      { "HASH_UPDATE", NULL, NULL, NULL, NULL, NULL, napi_enumerable, NULL },
      { "HASH_FIRST", NULL, NULL, NULL, NULL, NULL, napi_enumerable, NULL },
      { "HASH_LAST", NULL, NULL, NULL, NULL, NULL, napi_enumerable, NULL },
      { "HASH_ENTIRE", NULL, NULL, NULL, NULL, NULL, napi_enumerable, NULL }
    };

    NAPI_CALL_RETURN_UNDEFINED(env, napi_create_uint32(env, HASH_UPDATE, &enum_values[0].value));
    NAPI_CALL_RETURN_UNDEFINED(env, napi_create_uint32(env, HASH_FIRST, &enum_values[1].value));
    NAPI_CALL_RETURN_UNDEFINED(env, napi_create_uint32(env, HASH_LAST, &enum_values[2].value));
    NAPI_CALL_RETURN_UNDEFINED(env, napi_create_uint32(env, HASH_ENTIRE, &enum_values[3].value));

    NAPI_CALL_RETURN_UNDEFINED(env,
        napi_define_properties(env,
                               js_enum,
                               sizeof(enum_values) / sizeof(*enum_values),
                               enum_values));
    NAPI_CALL_RETURN_UNDEFINED(env, napi_set_named_property(env,
                                                            exports,
                                                            "HASH_CTX_FLAG",
                                                            js_enum));
  }

  return exports;
}
