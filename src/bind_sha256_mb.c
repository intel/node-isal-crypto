#include "common.h"
#include "multi_buffer.h"
#include "sha256_mb.h"

static napi_value bind_hash_ctx_init(napi_env env, napi_callback_info info) {
  napi_value buffer;
  size_t argc = 1;
  void* context;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, &buffer, NULL, NULL));
  NAPI_CALL(env, napi_get_arraybuffer_info(env, buffer, &context, NULL));
  hash_ctx_init((SHA256_HASH_CTX*)context);

  return NULL;
}

static napi_value
bind_sha256_ctx_mgr_init(napi_env env, napi_callback_info info) {
  napi_value context_manager;
  size_t argc = 1;
  void* context_manager_data;

  NAPI_CALL(env, napi_get_cb_info(env,
                                  info,
                                  &argc,
                                  &context_manager,
                                  NULL,
                                  NULL));
  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           context_manager,
                                           &context_manager_data,
                                           NULL));

  sha256_ctx_mgr_init((SHA256_HASH_CTX_MGR*)context_manager_data);

  return NULL;
}

static napi_value
bind_sha256_ctx_mgr_submit(napi_env env, napi_callback_info info) {
  napi_value argv[4], js_resulting_context;
  size_t argc = 4;
  void* context_manager;
  void* context;
  void* buffer;
  size_t buffer_length;
  int hash_ctx_flag;
  SHA256_HASH_CTX* resulting_context;

  NAPI_CALL(env, napi_get_cb_info(env,
                                  info,
                                  &argc,
                                  argv,
                                  NULL,
                                  NULL));

  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           argv[0],
                                           &context_manager,
                                           NULL));
  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           argv[1],
                                           &context,
                                           NULL));
  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           argv[2],
                                           &buffer,
                                           &buffer_length));
  NAPI_CALL(env, napi_get_value_int32(env, argv[3], &hash_ctx_flag));

  resulting_context =
      sha256_ctx_mgr_submit((SHA256_HASH_CTX_MGR*)context_manager,
                            (SHA256_HASH_CTX*)context,
                            buffer,
                            (uint32_t)buffer_length,
                            hash_ctx_flag);

  if (resulting_context == NULL) {
    NAPI_CALL(env, napi_get_null(env, &js_resulting_context));
  } else {
    NAPI_CALL(env, napi_create_external_arraybuffer(env,
                                                    resulting_context,
                                                    sizeof(SHA256_HASH_CTX),
                                                    NULL,
                                                    NULL,
                                                    &js_resulting_context));
  }

  return js_resulting_context;
}

static napi_value
bind_sha256_ctx_mgr_flush(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value js_context_manager, js_resulting_context;
  void* context_manager;
  SHA256_HASH_CTX* resulting_context;

  NAPI_CALL(env, napi_get_cb_info(env,
                                  info,
                                  &argc,
                                  &js_context_manager,
                                  NULL,
                                  NULL));

  NAPI_CALL(env, napi_get_arraybuffer_info(env,
                                           js_context_manager,
                                           &context_manager,
                                           NULL));

  resulting_context =
      sha256_ctx_mgr_flush((SHA256_HASH_CTX_MGR*)context_manager);

  if (resulting_context == NULL) {
    NAPI_CALL(env, napi_get_null(env, &js_resulting_context));
  } else {
    NAPI_CALL(env, napi_create_external_arraybuffer(env,
                                                    resulting_context,
                                                    sizeof(SHA256_HASH_CTX),
                                                    NULL,
                                                    NULL,
                                                    &js_resulting_context));
  }

  return js_resulting_context;
}

napi_value
init_sha256_mb(napi_env env) {
  napi_value exports, sizeof_SHA256_HASH_CTX_MGR, sizeof_SHA256_HASH_CTX;

  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env,
                         sizeof(SHA256_HASH_CTX_MGR),
                         &sizeof_SHA256_HASH_CTX_MGR));

  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env,
                         sizeof(SHA256_HASH_CTX),
                         &sizeof_SHA256_HASH_CTX));

  napi_property_descriptor bindings[] = {
    NAPI_DESCRIBE_BINDING(hash_ctx_init),
    NAPI_DESCRIBE_BINDING(sha256_ctx_mgr_init),
    NAPI_DESCRIBE_BINDING(sha256_ctx_mgr_submit),
    NAPI_DESCRIBE_BINDING(sha256_ctx_mgr_flush),
    NAPI_DESCRIBE_VALUE(sizeof_SHA256_HASH_CTX_MGR),
    NAPI_DESCRIBE_VALUE(sizeof_SHA256_HASH_CTX)
  };

  NAPI_CALL_RETURN_UNDEFINED(env, napi_create_object(env, &exports));

  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_define_properties(env,
                             exports,
                             sizeof(bindings)/sizeof(*bindings),
                             bindings));

  return exports;
}
