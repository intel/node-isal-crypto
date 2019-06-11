#ifndef SRC_BIND_MB_HASH_H_
#define SRC_BIND_MB_HASH_H_

#include <stdlib.h>
#include "common.h"
#include "multi_buffer.h"

// JavaScript interface:
// The addon returns an `ArrayBuffer` containing the contexts and a surface for
// describing an operation that can be executed using the `op()` static method
// which can be found on the `ArrayBuffer` on the JS side. This latter structure
// allows us to avoid heavy passing of parameters to `op()`.

// This enum lists the operations that can be performed by `op()`.
typedef enum {
  CONTEXT_REQUEST = 1,
  CONTEXT_RESET,
  MANAGER_SUBMIT,
  MANAGER_FLUSH
} HashOpCode;

// For the CONTEXT_RESET operation, the context can either be re-added to the
// list of available contexts or reassigned immediately to a different stream.
typedef enum {
  CONTEXT_RESET_FLAG_RELEASE = 1,
  CONTEXT_RESET_FLAG_RETAIN
} ContextResetFlag;

// This is the main class defining the addon.
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
  void (*hash_htonl)(ContextType*)>
class MBHashAddon {
 public:

  MBHashAddon() {
    ManagerInit(&manager);
    for (size_t idx = 0; idx < lane_count; idx++) {
      hash_ctx_init(&js.contexts[idx]);
      available_indices[idx] = idx;
    }
    next_context_idx = lane_count - 1;
  }

  inline void
  process_manager_result(ContextType* context) {
    // Convert hash from hardware to network byte order when it's complete.
    if (context != nullptr && hash_ctx_complete(context)) {
      hash_htonl(context);
    }

    // Write the resulting context's index into `context_id` to serve as the
    // return value in JS.
    js.op.context_idx = (context == nullptr ? -1 : (context - js.contexts));
  }

  // Main interface between JS and native. Read what JS wrote into the `op`
  // portion of the `js` structure, and synchronously execute the request. A
  // return value, if present, is always a context index. It is placed into the
  // context_idx` field of `op` before returning so that JS might read it.
  static napi_value
  bind_op(napi_env env, napi_callback_info info) {
    switch(addon.js.op.code) {
      // A context is being requested. If one is available, write it into the
      // `context_id` field and remove it from the list of available indices so
      // that JS might pick it up. If none are available, -1 will be written.
      case CONTEXT_REQUEST:
        addon.js.op.context_idx = -1;
        if (addon.next_context_idx >= 0) {
          addon.js.op.context_idx =
            addon.available_indices[addon.next_context_idx--];
        }
        break;

      // A context is being reset. The flag indicates whether the index should
      // be returned to the list of available indices or whether the
      // corresponding context should merely be reinitialized so that it might
      // continue to be used by JS.
      case CONTEXT_RESET:
        NAPI_ASSERT_TYPE(env, range, "CONTEXT_RESET_INDEX_OUT_OF_RANGE",
                    addon.js.op.context_idx >= 0 &&
                        addon.js.op.context_idx <
                            static_cast<int32_t>(lane_count),
                    "CONTEXT_RESET index out of range");
        NAPI_ASSERT_TYPE(env, range, "CONTEXT_RESET_FLAG_OUT_OF_RANGE",
                    addon.js.op.flag == CONTEXT_RESET_FLAG_RELEASE ||
                        addon.js.op.flag == CONTEXT_RESET_FLAG_RETAIN,
                    "CONTEXT_RESET flag must be either RELEASE or RETAIN");
        hash_ctx_init(&addon.js.contexts[addon.js.op.context_idx]);
        if (addon.js.op.flag == CONTEXT_RESET_FLAG_RELEASE) {
          addon.available_indices[++addon.next_context_idx] =
              addon.js.op.context_idx;
        }
        break;

      case MANAGER_FLUSH:
        addon.process_manager_result(ManagerFlush(&addon.manager));
        break;

      // Submit to the manager. The data is a JS `Uint8Array` given as the sole
      // argument to the `op()` function in JS.
      case MANAGER_SUBMIT: {
        void* data;
        size_t length, argc = 1;
        napi_value typedarray;
        napi_typedarray_type typedarray_type;

        // Retrieve the sole argument given by JS.
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

        NAPI_ASSERT_TYPE(env, type, "CHUNK_MUST_BE_UINT8ARRAY",
                    typedarray_type == napi_uint8_array,
                    "data must be a Uint8Array");

        addon.process_manager_result(
            ManagerSubmit(&addon.manager,
                          &addon.js.contexts[addon.js.op.context_idx],
                          data,
                          (uint32_t)length,
                          static_cast<HASH_CTX_FLAG>(addon.js.op.flag)));
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

  // Exposes the API to JS. This may be called multiple times from one thread.
  static napi_value
  Init(napi_env env) {
    napi_value jsAddon, op, sizeofContext, maxLanes, sizeofJob,
        digestOffsetInContext;

    // Below we expose the JS portion of the addon data as well as some useful
    // sizes to JS. We use pointer arithmetic instead of `sizeof()` because some
    // fields of the structures are aligned, meaning that their size in memory
    // differs from the size given at compile time by `sizeof()`.

    // Expose the portion of the addon data relevant to JS.
    NAPI_CALL_RETURN_UNDEFINED(env,
        napi_create_external_arraybuffer(env,
                                         &addon.js,
                                         reinterpret_cast<char*>(&addon.js.op) +
                                            sizeof(addon.js.op) -
                                            reinterpret_cast<char*>(&addon.js),
                                         nullptr,
                                         nullptr,
                                         &jsAddon));

    // Expose some sizes that will help JS properly index into the data exposed
    // above.
    NAPI_CALL_RETURN_UNDEFINED(env,
        napi_create_uint32(env,
                           reinterpret_cast<char*>(&addon.js.contexts[1]) -
                               reinterpret_cast<char*>(&addon.js.contexts[0]),
                           &sizeofContext));
    NAPI_CALL_RETURN_UNDEFINED(env,
        napi_create_uint32(env,
          reinterpret_cast<char*>(&addon.js.contexts[0].job.result_digest[0]) -
              reinterpret_cast<char*>(&addon.js.contexts[0]),
          &digestOffsetInContext));
    NAPI_CALL_RETURN_UNDEFINED(env,
        napi_create_uint32(env,
                        reinterpret_cast<char*>(&addon.js.contexts[0].status) -
                            reinterpret_cast<char*>(&addon.js.contexts[0]),
                        &sizeofJob));
    NAPI_CALL_RETURN_UNDEFINED(env,
        napi_create_uint32(env, lane_count, &maxLanes));

    // Expose the `op()` function that is used as the driver of the native side.
    NAPI_CALL_RETURN_UNDEFINED(env,
        napi_create_function(env,
                             "op",
                             NAPI_AUTO_LENGTH,
                             bind_op,
                             nullptr,
                             &op));

    // Collect the values defined above into an array of property descriptors.
    napi_property_descriptor props[] = {
      NAPI_DESCRIBE_VALUE(sizeofContext),
      NAPI_DESCRIBE_VALUE(digestOffsetInContext),
      NAPI_DESCRIBE_VALUE(sizeofJob),
      NAPI_DESCRIBE_VALUE(op),
      NAPI_DESCRIBE_VALUE(maxLanes)
    };

    // Attach the properties to the JS-exposed addon data.
    NAPI_CALL_RETURN_UNDEFINED(env,
        napi_define_properties(env,
                               jsAddon,
                               sizeof(props) / sizeof(*props),
                               props));

    // Return the addon data decorated with the extra properties.
    return jsAddon;
  }

  // This is the structure holding the information exposed to JS.
  struct {
    // These are the contexts which we will be passing into the manager.
    ContextType contexts[lane_count];

    // This is the surface read from and written to by `op()` to inform it as to
    // what JS wants to do.
    struct {
      int32_t code;
      int32_t context_idx;
      int32_t flag;
    } op;
  } js;

  // The hidden portion of the structure.
  ManagerType manager;
  int32_t available_indices[lane_count];
  int32_t next_context_idx;

  // Global static per-thread singleton instance of this class.
  static thread_local MBHashAddon addon;
};

// The single instance must be declared again outside the class.
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
  void (*hash_htonl)(ContextType*)>
 thread_local MBHashAddon<
  ManagerType,
  ContextType,
  lane_count,
  ManagerInit,
  ManagerFlush,
  ManagerSubmit,
  hash_htonl>
MBHashAddon<
  ManagerType,
  ContextType,
  lane_count,
  ManagerInit,
  ManagerFlush,
  ManagerSubmit,
  hash_htonl>::addon;

#endif  // SRC_BIND_MB_HASH_H_
