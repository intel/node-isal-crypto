#ifndef SRC_BIND_MB_HASH_H_
#define SRC_BIND_MB_HASH_H_

#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <uv.h>
#include "common.h"
#include "multi_buffer.h"

// JavaScript interface:
// The addon returns an `ArrayBuffer` containing the manager, the contexts, and a
// surface for describing an operation that can be executed using the `op()`
// method which can be found on the `ArrayBuffer` on the JS side. This latter
// structure allows us to avoid heavy passing of parameters to `op()`.

// The operations that can be written into the surface that `op()` reads.
typedef enum {
  NOOP,
  CONTEXT_REQUEST,
  CONTEXT_RESET,
  MANAGER_SUBMIT,
  MANAGER_FLUSH
} HashOpCode;

// For CONTEXT_RESET, the context can either be re-added to the list of
// available contexts.
typedef enum {
  CONTEXT_RESET_FLAG_RELEASE,
  CONTEXT_RESET_FLAG_RETAIN
} ContextResetFlag;

// The surface read by `op()`, which informs it as to what JS wants to do.
struct HashOp {
  int32_t code;
  int32_t context_idx;
  int32_t flag;
};

// The portion of the addon data that is exposed to JS.
template <typename ManagerType, typename ContextType, size_t lane_count>
struct JSAddonData {
  ManagerType manager;
  ContextType contexts[lane_count];
  HashOp op;
};

// The entirety of the addon data.
template <typename ManagerType, typename ContextType, size_t lane_count>
struct AddonData {
  JSAddonData<ManagerType, ContextType, lane_count> js;

  // The hidden portion of the structure.
  int32_t available_indices[lane_count];
  int32_t next_context_idx;
};

// Items needed for storing the addon data in a thread-local fashion.
static uv_once_t init_addon_data_key_once = UV_ONCE_INIT;
static uv_key_t addon_data_key;

// Main interface between JS and native. Read what JS wrote into the `op`
// portion of the JSAddonData structure, and synchronously execute the request.
// A return value, if present, is always a context index. It is placed into the
// `context_idx` field of `op` before returning so that JS might read it.
template <
  typename ManagerType,
  typename ContextType,
  size_t lane_count,
  ContextType* (*ManagerFlush)(ManagerType*),
  ContextType* (*ManagerSubmit)(ManagerType*,
                                ContextType*,
                                const void*,
                                uint32_t,
                                HASH_CTX_FLAG),
  void (*hash_htonl)(ContextType*)>
static napi_value
bind_op(napi_env env, napi_callback_info info) {
  AddonData<ManagerType, ContextType, lane_count>* addon =
      (AddonData<ManagerType, ContextType, lane_count>*)
          uv_key_get(&addon_data_key);
  ContextType* context = nullptr;
  switch(addon->js.op.code) {
    case NOOP:
      return nullptr;

    // A context is being requested. If one is available, write it into the
    // remove it from the list of available indices and write it to the
    // `context_id` field so that JS might pick it up.
    case CONTEXT_REQUEST:
      addon->js.op.context_idx = -1;
      if (addon->next_context_idx >= 0) {
        addon->js.op.context_idx =
          addon->available_indices[addon->next_context_idx--];
      }
      break;

    // A context is being reset. The flag indicates whether the index should be
    // returned to the list of available indices or whether the corresponding
    // context should merely be zeroed out so that it might continue to be used
    // by JS.
    case CONTEXT_RESET:
      NAPI_ASSERT(env,
                  addon->js.op.context_idx >= 0 && 
                      addon->js.op.context_idx <
                          (int32_t)sizeof(addon->js.contexts),
                  "CONTEXT_RESET index out of range");
      NAPI_ASSERT(env,
                  addon->js.op.flag == CONTEXT_RESET_FLAG_RELEASE ||
                      addon->js.op.flag == CONTEXT_RESET_FLAG_RETAIN,
                  "CONTEXT_RESET flag must be either RELEASE or RETAIN");
      context = &addon->js.contexts[addon->js.op.context_idx];
      memset(context, 0, sizeof(*(addon->js.contexts)));
      hash_ctx_init(context);
      if (addon->js.op.flag == CONTEXT_RESET_FLAG_RELEASE) {
        addon->available_indices[++addon->next_context_idx] =
            addon->js.op.context_idx;
      }
      break;

    // Flush the manager and return the index of the resulting context to the
    // `context_idx` field.
    case MANAGER_FLUSH:
      context = ManagerFlush(&addon->js.manager);
      if (context != nullptr && hash_ctx_complete(context)) {
        hash_htonl(context);
      }
      addon->js.op.context_idx =
          ((context == nullptr) ? -1 : (context - addon->js.contexts));
      break;

    // Submit to the manager. The data is a JS `Uint8Array` given as the sole
    // argument to the `op()` function in JS.
    case MANAGER_SUBMIT: {
      void* data;
      size_t length, argc = 1;
      napi_value typedarray;
      napi_typedarray_type typedarray_type;

      // Establish the context.
      context = &addon->js.contexts[addon->js.op.context_idx];

      // Retrieve the arguments given by JS.
      NAPI_CALL(env, napi_get_cb_info(env,
                                      info,
                                      &argc,
                                      &typedarray,
                                      nullptr,
                                      nullptr));

      // Retrieve the native data.
      // TODO (gabrielschulhof): Verify that argv[1] is indeed a typed array.
      NAPI_CALL(env, napi_get_typedarray_info(env,
                                              typedarray,
                                              &typedarray_type,
                                              &length,
                                              &data,
                                              nullptr,
                                              nullptr));

      NAPI_ASSERT(env,
                  typedarray_type == napi_uint8_array,
                  "data must be a Uint8Array");

      context = ManagerSubmit(&addon->js.manager,
                              context,
                              data,
                              (uint32_t)length,
                              (HASH_CTX_FLAG)addon->js.op.flag);
      if (context != nullptr && hash_ctx_complete(context)) {
        hash_htonl(context);
      }

      // Write the resulting context's index into `context_id` to serve as the
      // return value in JS.
      addon->js.op.context_idx =
          (context == nullptr ? -1 : (context - addon->js.contexts));
      break;
    }

    default:
      NAPI_CALL(env, napi_throw_range_error(env,
                                            "UNKNOWN_OPCODE",
                                            "Unknown op code"));
      break;
  }
  return nullptr;
}

// This is called once for all threads to spawn within this process. It
// allocates the thread-local storage for the addon data.
static void
create_addon_data_key_once() {
  int result = uv_key_create(&addon_data_key);
  assert(result == 0 && "Failed to create thread-local addon data key");
}

// Destroys the addon data when the addon is unloaded.
template <typename ManagerType, typename ContextType, size_t lane_count>
static void
Addon_finalize(napi_env env, void* data, void* hint) {
  free(data);
}

// Exposes the API to JS.

template <
  typename ManagerType,
  typename ContextType,
  size_t lane_count,
  void (*ManagerInit)(ManagerType*),
  ContextType* (*ManagerFlush)(ManagerType*),
  ContextType* (*ManagerSubmit)(ManagerType*,
                                ContextType*,
                                const void*,
                                uint32_t,
                                HASH_CTX_FLAG),
  void (*hash_htonl)(ContextType*)
  >
static napi_value
InitMBHash(napi_env env) {
  size_t idx;
  napi_value js_addon, op, sizeof_manager, sizeof_context, js_max_lanes,
      sizeof_job, digest_offset_in_context;
  AddonData<ManagerType, ContextType, lane_count>* addon;

  // Establish the addon data for this thread.

  // Ensure the thread-local area where we store addon data for this thread
  // exists.
  uv_once(&init_addon_data_key_once, create_addon_data_key_once);

  // Retrieve the addon data from thread-local storage.
  addon = (AddonData<ManagerType, ContextType, lane_count>*)
      uv_key_get(&addon_data_key);

  // The data will be absent if this is the first instance of the addon on this
  // thread. In that case, we need to allocate it and store the pointer in the
  // thread-local storage.
  if (addon == nullptr) {
    // If the addon data is not yet stored in TLS on this thread, then
    // allocate it, initialize it, and save it under the TLS key.
    addon = (AddonData<ManagerType, ContextType, lane_count>*)
      malloc(sizeof(*addon));
    NAPI_ASSERT_BLOCK(env, addon != nullptr, "Failed to allocate addon data", {
      napi_value undefined;
      napi_status status = napi_get_undefined(env, &undefined);
      assert(status == napi_ok && "Failed to retrieve undefined");
      return undefined;
    });

    ManagerInit(&addon->js.manager);

    for (idx = 0;
        idx < sizeof(addon->js.contexts) / sizeof(*(addon->js.contexts));
        idx++) {
      hash_ctx_init(&addon->js.contexts[idx]);
      addon->available_indices[idx] = idx;
    }

    addon->next_context_idx = idx - 1;

    // Save a pointer to the addon data in thread-local storage.
    uv_key_set(&addon_data_key, addon);
  }

  // Below we expose the JS portion of the addon data as well as some useful
  // sizes to JS. We use pointer arithmetic instead of `sizeof()` because some
  // fields of the structures are aligned, meaning that their size in memory
  // differs from the size given at compile time by `sizeof()`.

  // Expose the portion of the addon data relevant to JS.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_external_arraybuffer(env,
                           addon,
                           ((char*)&addon->available_indices[0]) -
                               ((char*)addon),
                           Addon_finalize<ManagerType, ContextType, lane_count>,
                           nullptr,
                           &js_addon));

  // Expose some sizes that will help JS properly index into the data exposed
  // above.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env,
                         ((char*)&addon->js.contexts[0]) -
                             ((char*)&addon->js.manager),
                         &sizeof_manager));
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env,
                         ((char*)&addon->js.contexts[1]) -
                             ((char*)&addon->js.contexts[0]), &sizeof_context));
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env,
                         ((char*)&addon->js.contexts[0].job.result_digest[0]) -
                             ((char*)&addon->js.contexts[0]),
                         &digest_offset_in_context));
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env,
                         ((char*)&addon->js.contexts[0].status) -
                             ((char*)&addon->js.contexts[0]), &sizeof_job));
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_uint32(env, lane_count, &js_max_lanes));

  // Expose the `op()` function that is used as the driver of the native side.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_function(env,
                           "op",
                           NAPI_AUTO_LENGTH,
                           bind_op<
                             ManagerType,
                             ContextType,
                             lane_count,
                             ManagerFlush,
                             ManagerSubmit,
                             hash_htonl>,
                           addon,
                           &op));

  // Collect the values defined above into an array of property descriptors.
  napi_property_descriptor props[] = {
    NAPI_DESCRIBE_VALUE(sizeof_manager),
    NAPI_DESCRIBE_VALUE(sizeof_context),
    NAPI_DESCRIBE_VALUE(digest_offset_in_context),
    NAPI_DESCRIBE_VALUE(sizeof_job),
    NAPI_DESCRIBE_VALUE(op),
    { "maxLanes", nullptr, nullptr, nullptr, nullptr, js_max_lanes,
        napi_enumerable, nullptr }
  };

  // Attach the properties to the JS-exposed addon data.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_define_properties(env,
                             js_addon,
                             sizeof(props) / sizeof(*props),
                             props));

  // Return the addon data decorated with the extra properties.
  return js_addon;
}

// Convert a digest from hardware byte order to network byte order.
template <typename ContextType, size_t word_count>
void hash_htonl_uint32(ContextType* context) {
  size_t idx;
  uint32_t result;

  for (idx = 0; idx < word_count; idx++) {
    ((unsigned char*)&result)[0] = (context->job.result_digest[idx] >> 24) & 0xff;
    ((unsigned char*)&result)[1] = (context->job.result_digest[idx] >> 16) & 0xff;
    ((unsigned char*)&result)[2] = (context->job.result_digest[idx] >> 8) & 0xff;
    ((unsigned char*)&result)[3] = (context->job.result_digest[idx] & 0xff);
    context->job.result_digest[idx] = result;
  }
}

#endif  // SRC_BIND_MB_HASH_H_
