#include "common.h"
#include "mh_sha256.h"

static napi_value
bind_mh_sha256_init(napi_env env, napi_callback_info info) {
  napi_value context;
  size_t argc = 1;
  void* context_data;
  size_t context_length;
  int result;
  napi_value js_result;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, &context, NULL, NULL));
  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           context,
                                           &context_data,
                                           &context_length));

  result = mh_sha256_init((struct mh_sha256_ctx*)context_data);

  NAPI_CALL(env, napi_create_double(env, result, &js_result));
  return js_result;
}

static napi_value
bind_mh_sha256_update(napi_env env, napi_callback_info info) {
  napi_value argv[2];
  size_t argc = 2;
  void* context_data;
  size_t context_length;
  void* buffer_data;
  size_t buffer_length;
  int result;
  napi_value js_result;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));
  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           argv[0],
                                           &context_data,
                                           &context_length));
  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           argv[1],
                                           &buffer_data,
                                           &buffer_length));

  result = mh_sha256_update((struct mh_sha256_ctx*)context_data,
                            buffer_data,
                            (uint32_t)buffer_length);

  NAPI_CALL(env, napi_create_double(env, result, &js_result));
  return js_result;
}

static napi_value
bind_mh_sha256_finalize(napi_env env, napi_callback_info info) {
  napi_value argv[2];
  size_t argc = 2;
  void* context_data;
  size_t context_length;
  void* buffer_data;
  size_t buffer_length;
  int result;
  napi_value js_result;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));
  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           argv[0],
                                           &context_data,
                                           &context_length));
  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           argv[1],
                                           &buffer_data,
                                           &buffer_length));

  result = mh_sha256_finalize((struct mh_sha256_ctx*)context_data,
                              buffer_data);

  NAPI_CALL(env, napi_create_double(env, result, &js_result));
  return js_result;
}

napi_value
init_mh_sha256(napi_env env) {
  napi_value exports, sizeof_mh_sha256_ctx;

  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_double(env,
                         sizeof(struct mh_sha256_ctx),
                         &sizeof_mh_sha256_ctx));

  napi_property_descriptor bindings[] = {
    NAPI_DESCRIBE_BINDING(mh_sha256_init),
    NAPI_DESCRIBE_BINDING(mh_sha256_update),
    NAPI_DESCRIBE_BINDING(mh_sha256_finalize),
    NAPI_DESCRIBE_VALUE(sizeof_mh_sha256_ctx)
  };

  NAPI_CALL_RETURN_UNDEFINED(env, napi_create_object(env, &exports));
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_define_properties(env,
                             exports,
                             sizeof(bindings) / sizeof(*bindings),
                             bindings));
  

  return exports;
}
