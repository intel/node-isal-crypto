#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <uv.h>
#include "common.h"
#include "multi_buffer.h"
#include "sha256_mb.h"

typedef enum {
  NOOP,
  CONTEXT_REQUEST,
  CONTEXT_RESET,
  MANAGER_SUBMIT,
  MANAGER_FLUSH
} HashOpCode;

typedef enum {
  CONTEXT_RESET_FLAG_RELEASE,
  CONTEXT_RESET_FLAG_RETAIN
} ContextResetFlag;

typedef struct {
  int32_t opcode;
  int32_t context_idx;
  int32_t flag;
} HashOp;

typedef struct {
  SHA256_HASH_CTX_MGR manager;
  SHA256_HASH_CTX contexts[SHA256_MAX_LANES];
  int32_t available_indices[SHA256_MAX_LANES];
  int32_t next_context_idx;
  HashOp op;
} AddonData;

static uv_once_t init_addon_data_key_once = UV_ONCE_INIT;
static uv_key_t addon_data_key;

static napi_value bind_op(napi_env env, napi_callback_info info) {
  AddonData* addon = uv_key_get(&addon_data_key);
  SHA256_HASH_CTX* context = NULL;
  switch(addon->op.opcode) {
    case NOOP:
      return NULL;

    case CONTEXT_REQUEST:
      addon->op.context_idx = -1;
      if (addon->next_context_idx >= 0) {
        addon->op.context_idx =
          addon->available_indices[addon->next_context_idx--];
      }
      break;

    case CONTEXT_RESET:
      NAPI_ASSERT(env,
                  addon->op.context_idx >= 0 && 
                      addon->op.context_idx < (int32_t)sizeof(addon->contexts),
                  "CONTEXT_RESET index out of range");
      NAPI_ASSERT(env,
                  addon->op.flag == CONTEXT_RESET_FLAG_RELEASE ||
                      addon->op.flag == CONTEXT_RESET_FLAG_RETAIN,
                  "CONTEXT_RESET flag must be either RELEASE or RETAIN");
      context = &addon->contexts[addon->op.context_idx];
      memset(context, 0, sizeof(*(addon->contexts)));
      hash_ctx_init(context);
      if (addon->op.flag == CONTEXT_RESET_FLAG_RELEASE) {
        addon->available_indices[++addon->next_context_idx] =
            addon->op.context_idx;
      }
      break;

    case MANAGER_FLUSH:
      context = sha256_ctx_mgr_flush(&addon->manager);
      addon->op.context_idx =
          ((context == NULL) ? -1 : (context - addon->contexts));
      break;

    case MANAGER_SUBMIT: {
      void* data;
      size_t length, argc = 1;
      napi_value typedarray;
      napi_typedarray_type typedarray_type;

      context = &addon->contexts[addon->op.context_idx];

      NAPI_CALL(env, napi_get_cb_info(env,
                                      info,
                                      &argc,
                                      &typedarray,
                                      NULL,
                                      NULL));

      // Retrieve the native data.
      // TODO (gabrielschulhof): Verify that argv[1] is indeed a typed array.
      NAPI_CALL(env, napi_get_typedarray_info(env,
                                              typedarray,
                                              &typedarray_type,
                                              &length,
                                              &data,
                                              NULL,
                                              NULL));

      NAPI_ASSERT(env,
                  typedarray_type == napi_uint8_array,
                  "data must be a Uint8Array");

      context = sha256_ctx_mgr_submit(&addon->manager,
                                      context,
                                      data,
                                      (uint32_t)length,
                                      addon->op.flag);

      addon->op.context_idx =
          (context == NULL ? -1 : (context - addon->contexts));
      break;
    }
      

    default:
      NAPI_CALL(env, napi_throw_range_error(env,
                                            "UNKNOWN_OPCODE",
                                            "Unknown op code"));
      break;
  }
  return NULL;
}

static void create_addon_data_key_once() {
  int result = uv_key_create(&addon_data_key);
  assert(result == 0 && "Failed to create thread-local addon data key");
}

static void
Addon_finalize(napi_env env, void* data, void* hint) {
  free(data);
}

napi_value
init_sha256_mb(napi_env env) {
  size_t idx;
  napi_value js_addon, op, sizeof_manager, sizeof_context, js_max_lanes,
      sizeof_job, sizeof_uint8_pointer;
  AddonData* addon;

  // Establish the addon data for this thread.
  uv_once(&init_addon_data_key_once, create_addon_data_key_once);
  addon = (AddonData*)uv_key_get(&addon_data_key);
  if (addon == NULL) {
    // If the addon data is not yet stored in TLS on this thread, then
    // initialize it and save it under the TLS key.
    addon = (AddonData*)calloc(1, sizeof(*addon));
    NAPI_ASSERT_BLOCK(env, addon != NULL, "Failed to allocate addon data", {
      napi_value undefined;
      napi_status status = napi_get_undefined(env, &undefined);
      assert(status == napi_ok && "Failed to retrieve undefined");
      return undefined;
    });
    uv_key_set(&addon_data_key, addon);
    sha256_ctx_mgr_init(&addon->manager);

    for (idx = 0;
        idx < sizeof(addon->contexts) / sizeof(*(addon->contexts));
        idx++) {
      hash_ctx_init(&addon->contexts[idx]);
      addon->available_indices[idx] = idx;
    }
    addon->next_context_idx = idx - 1;
  }

  // Below we expose the addon data as well as some useful sizes to JS. We use
  // pointer arithmetic instead of sizeof() because some fields of the
  // structures are aligned, meaning that their size in memory includes padding.

  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_external_arraybuffer(env,
                                       addon,
                                       ((char*)&addon->op) -
                                           ((char*)addon) + sizeof(addon->op),
                                       Addon_finalize,
                                       NULL,
                                       &js_addon));

  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env,
                         ((char*)&addon->contexts[0]) -
                             ((char*)&addon->manager),
                         &sizeof_manager));
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env,
                         ((char*)&addon->contexts[1]) -
                             ((char*)&addon->contexts[0]), &sizeof_context));
  // It's OK to use sizeof here because we just want to expose the size of a
  // pointer.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env, sizeof(uint8_t*), &sizeof_uint8_pointer));
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env,
                         ((char*)&addon->contexts[0].status) -
                             ((char*)&addon->contexts[0]), &sizeof_job));
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env, SHA256_MAX_LANES, &js_max_lanes));
  NAPI_CALL_RETURN_UNDEFINED(env, napi_create_function(env,
                                                       "op",
                                                       NAPI_AUTO_LENGTH,
                                                       bind_op,
                                                       addon,
                                                       &op));

  // Collect the properties into an array of property descriptors.
  napi_property_descriptor props[] = {
    NAPI_DESCRIBE_VALUE(sizeof_manager),
    NAPI_DESCRIBE_VALUE(sizeof_context),
    NAPI_DESCRIBE_VALUE(sizeof_uint8_pointer),
    NAPI_DESCRIBE_VALUE(sizeof_job),
    NAPI_DESCRIBE_VALUE(op),
    { "SHA256_MAX_LANES", NULL, NULL, NULL, NULL, js_max_lanes,
        napi_enumerable, NULL }
  };

  // Attach the properties to the JS-exposed addon data.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_define_properties(env,
                             js_addon,
                             sizeof(props) / sizeof(*props),
                             props));

  return js_addon;
}
