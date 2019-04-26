#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "common.h"
#include "multi_buffer.h"
#include "sha256_mb.h"

// JS Interface:
//
// class Context {
//   readonly Manager manager;
//   readonly bool complete;
//   readonly bool processing;
//   readonly ArrayBuffer digest;
//   readonly void reset();
// };
//
// class Manager {
//   readonly Context submit(Context, Uint8Array, flag);
//   readonly Context flush();
// };

typedef struct {
  SHA256_HASH_CTX_MGR base;
} JSSHA256ContextManager;

typedef struct {
  SHA256_HASH_CTX base;
  napi_ref js_manager;
  napi_ref js_self;
} JSSHA256HashContext;

// Convert SHA256_HASH_CTX to its JS equivalent, and release references to itself
// and the manager when hashing is complete so the object might be garbage-
// collected if no longer used.
static napi_value
js_context_from_incoming_context(napi_env env,
                                 SHA256_HASH_CTX* ctx) {
  JSSHA256HashContext* context = (JSSHA256HashContext*)ctx;
  napi_value result = NULL;
  if (context != NULL) {
    assert(context->js_self != NULL &&
        "Context self-reference must not be NULL");
    NAPI_CALL(env, napi_get_reference_value(env, context->js_self, &result));

    if (hash_ctx_complete(ctx)) {
      NAPI_CALL(env, napi_delete_reference(env, context->js_self));
      context->js_self = NULL;
      NAPI_CALL(env, napi_delete_reference(env, context->js_manager));
      context->js_manager = NULL;
    }
  }
  return result;
}

// When the JS Context instance is garbage-collected, we free the corresponding
// native context.
static void
finalize_Context(napi_env env, void* data, void* hint) {
  (void) hint;
  JSSHA256HashContext* ctx = (JSSHA256HashContext*)data;

  NAPI_ASSERT_BLOCK(env,
                  ctx->js_self == NULL,
                  "Context self-reference must be NULL at garbage-collection", {
                    return;
                  });
  NAPI_ASSERT_BLOCK(env,
               ctx->js_manager == NULL,
               "Context manager reference must be NULL at garbage-collection", {
                 return;
               });
  free(ctx);
}

// Construct a new JS Context instance. We construct a corresponding native hash
// context, and place the pointer to it into the JS Context instance.
static napi_value
Context(napi_env env, napi_callback_info info) {
  napi_value this;

  // TODO (gabrielschulhof): Assert via exception that there is a new.target.
  // Skipped here for performance.

  NAPI_CALL(env, napi_get_cb_info(env, info, NULL, NULL, &this, NULL));

  JSSHA256HashContext* ctx = calloc(1, sizeof(*ctx));
  NAPI_ASSERT(env, ctx != NULL, "Failed to allocate context");

  // Place the pointer to the native context into the `this` object.
  NAPI_CALL_BLOCK(env, napi_wrap(env,
                                 this,
                                 ctx,
                                 finalize_Context,
                                 NULL,
                                 NULL), {
    free(ctx);
    return NULL;
  });

  hash_ctx_init(&ctx->base);
  return NULL;
}

// Reset the native portion of a JS Context instance.
static napi_value
Context_reset(napi_env env, napi_callback_info info) {
  napi_value this;
  JSSHA256HashContext* context;

  NAPI_CALL(env, napi_get_cb_info(env, info, NULL, NULL, &this, NULL));

  NAPI_CALL(env, napi_unwrap(env, this, (void**)&context));

  NAPI_ASSERT(env, 
              context->js_self == NULL,
              "context self-reference must be NULL upon reset");
  NAPI_ASSERT(env,
              context->js_manager == NULL,
              "context manager reference must be NULL upon reset");

  memset(&context->base, 0, sizeof(context->base));
  hash_ctx_init(&context->base);

  return NULL;
}

// Getter for the JS Context instance's `complete` property.
static napi_value
Context_complete(napi_env env, napi_callback_info info) {
  napi_value js_is_complete = NULL, this;
  JSSHA256HashContext* context;

  NAPI_CALL(env, napi_get_cb_info(env, info, NULL, NULL, &this, NULL));

  NAPI_CALL(env, napi_unwrap(env, this, (void**)&context));

  NAPI_CALL(env, napi_get_boolean(env,
                                  hash_ctx_complete(&context->base),
                                  &js_is_complete));

  return js_is_complete;
}

// Getter for the JS Context instance's `processing` property.
static napi_value
Context_processing(napi_env env, napi_callback_info info) {
  napi_value js_is_processing = NULL, this;
  JSSHA256HashContext* context;

  NAPI_CALL(env, napi_get_cb_info(env, info, NULL, NULL, &this, NULL));

  NAPI_CALL(env, napi_unwrap(env, this, (void**)&context));

  NAPI_CALL(env, napi_get_boolean(env,
                                  hash_ctx_processing(&context->base),
                                  &js_is_processing));

  return js_is_processing;
}

// Getter for the JS Context instance's `digest` property.
static napi_value
Context_digest(napi_env env, napi_callback_info info) {
  napi_value this, result = NULL;
  JSSHA256HashContext* context;
  int idx;

  NAPI_CALL(env, napi_get_cb_info(env, info, NULL, NULL, &this, NULL));

  NAPI_CALL(env, napi_unwrap(env, this, (void**)&context));

  // Get rid of the byte order.
  for (idx = 0; idx < SHA256_DIGEST_NWORDS; idx++) {
    unsigned char transform[4] = { 0 };
    uint32_t source = context->base.job.result_digest[idx];
    transform[0] = (source >> 24) & 0xff;
    transform[1] = (source >> 16) & 0xff;
    transform[2] = (source >> 8) & 0xff;
    transform[3] = source & 0xff;
    context->base.job.result_digest[idx] = *(uint32_t*)transform;
  }

  if (hash_ctx_complete(&context->base)) {

    NAPI_CALL(env, napi_create_external_buffer(env,
        SHA256_DIGEST_NWORDS * sizeof(*(context->base.job.result_digest)),
        ((uint8_t*)(context->base.job.result_digest)),
        NULL,
        NULL,
        &result));
  }

  return result;
}

// Getter for the JS Context instance's `manager` property.
static napi_value
Context_manager(napi_env env, napi_callback_info info) {
  napi_value this;
  JSSHA256HashContext* ctx = NULL;

  NAPI_CALL(env, napi_get_cb_info(env, info, NULL, NULL, &this, NULL));

  NAPI_CALL(env, napi_unwrap(env, this, (void**)&ctx));

  if (ctx->js_manager != NULL) {
    napi_value manager;
    NAPI_CALL(env, napi_get_reference_value(env, ctx->js_manager, &manager));
    return manager;
  }

  return NULL;
}

// When the JS Manager instance is garbage-collected, we free the corresponding
// native structure.
static void
finalize_Manager(napi_env env, void* data, void* hint) {
  (void) env;
  (void) hint;

  free((JSSHA256ContextManager*)data);
}

// Constructor for the JS Manager instance.
static napi_value
Manager(napi_env env, napi_callback_info info) {
  napi_value this;

  // TODO (gabrielschulhof): Assert that there is a new.target.

  NAPI_CALL(env, napi_get_cb_info(env, info, NULL, NULL, &this, NULL));

  JSSHA256ContextManager* manager = calloc(1, sizeof(*manager));
  NAPI_ASSERT(env, manager != NULL, "Failed to allocate manager");

  // We embed the pointer to the native manager context into the JS Manager
  // instance.
  NAPI_CALL_BLOCK(env, napi_wrap(env,
                                 this,
                                 manager,
                                 finalize_Manager,
                                 NULL,
                                 NULL), {
    free(manager);
    return NULL;
  });

  sha256_ctx_mgr_init(&manager->base);

  return NULL;
}

// The Manager instance's submit() method.
static napi_value
Manager_submit(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3], this;
  JSSHA256ContextManager* manager;
  JSSHA256HashContext* context;
  void* data;
  size_t length;
  napi_typedarray_type typedarray_type;
  HASH_CTX_FLAG flag;

  // TODO (gabrielschulhof): Verify that argv[0] is indeed an instance of
  // Context, wrapping a pointer to a JSSHA256HashContext. To do that, create a
  // strong reference to the JSSHA256HashContext constructor in init(), to be
  // finalized when exports goes out of scope, and pass it as function data to
  // this function.

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, &this, NULL));

  // Retrieve the native manager.
  NAPI_CALL(env, napi_unwrap(env, this, (void**)&manager));

  // Retrieve the native context.
  NAPI_CALL(env, napi_unwrap(env, argv[0], (void**)&context));

  // Retrieve the native data.
  // TODO (gabrielschulhof): Verify that argv[1] is indeed a typed array.
  NAPI_CALL(env, napi_get_typedarray_info(env,
                                          argv[1],
                                          &typedarray_type,
                                          &length,
                                          &data,
                                          NULL,
                                          NULL));

  NAPI_ASSERT(env,
              typedarray_type == napi_uint8_array,
              "data must be a Uint8Array");

  // Retrieve the native flag.
  NAPI_CALL(env, napi_get_value_uint32(env, argv[2], (uint32_t*)&flag));

  // If we don't have a self-reference we need to create one.
  // TODO (gabrielschulhof): Under what circumstances shall we assert that
  // js_self is or is not NULL? For example, if flag is HASH_FIRST then js_self
  // must be NULL.
  if (context->js_self == NULL) {
    NAPI_CALL(env, napi_create_reference(env, argv[0], 1, &context->js_self));
  }

  // If this context has no ownership, take ownership here.
  // TODO (gabrielschulhof): Under what circumstances shall we assert that
  // manager is or is not NULL? For example, if flag is HASH_FIRST then manager
  // must be NULL.
  if (context->js_manager == NULL) {
    NAPI_CALL(env, napi_create_reference(env, this, 1, &context->js_manager));
  }

  return js_context_from_incoming_context(env,
      sha256_ctx_mgr_submit(&manager->base,
                            &context->base,
                            (void*)((uint8_t*)data),
                            (uint32_t)length,
                            flag));
}

// The manager instance's flush() method.
static napi_value
Manager_flush(napi_env env, napi_callback_info info) {
  napi_value js_manager;
  JSSHA256ContextManager* manager;

  NAPI_CALL(env, napi_get_cb_info(env, info, NULL, NULL, &js_manager, NULL));

  // Retrieve the native manager.
  NAPI_CALL(env, napi_unwrap(env, js_manager, (void**)&manager));

  return js_context_from_incoming_context(env,
                                          sha256_ctx_mgr_flush(&manager->base));
}

// Expose the above bindings to JS.
napi_value
init_sha256_mb(napi_env env) {
  napi_value exports, context_class, manager_class, js_max_lanes;

  // List the properties of the Context class.
  napi_property_descriptor context_props[] = {
    { "complete", NULL, NULL, Context_complete, NULL, NULL, napi_enumerable,
      NULL },
    { "digest", NULL, NULL, Context_digest, NULL, NULL, napi_enumerable, NULL },
    { "reset", NULL, Context_reset, NULL, NULL, NULL, napi_enumerable, NULL },
    { "manager", NULL, NULL, Context_manager, NULL, NULL, napi_enumerable,
      NULL },
    { "processing", NULL, NULL, Context_processing, NULL, NULL, napi_enumerable,
      NULL },
  };

  // Define the Context class.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_define_class(env,
                        "Context",
                        NAPI_AUTO_LENGTH,
                        Context,
                        NULL,
                        sizeof(context_props) / sizeof(*context_props),
                        context_props,
                        &context_class));

  // Describe the properties of the Manager class.
  napi_property_descriptor manager_props[] = {
    { "submit", NULL, Manager_submit, NULL, NULL, NULL, napi_enumerable, NULL },
    { "flush", NULL, Manager_flush, NULL, NULL, NULL, napi_enumerable, NULL }
  };

  // Define the Manager class.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_define_class(env,
                        "Manager",
                        NAPI_AUTO_LENGTH,
                        Manager,
                        NULL,
                        sizeof(manager_props) / sizeof(*manager_props),
                        manager_props,
                        &manager_class));

  // Create the JS value for SHA256_MAX_LANES.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_create_double(env, SHA256_MAX_LANES, &js_max_lanes));

  // Describe the exports of the addon.
  napi_property_descriptor addon_props[] = {
    { "Context", NULL, NULL, NULL, NULL, context_class, napi_enumerable, NULL },
    { "Manager", NULL, NULL, NULL, NULL, manager_class, napi_enumerable, NULL },
    { "SHA256_MAX_LANES", NULL, NULL, NULL, NULL, js_max_lanes, napi_enumerable,
      NULL },
  };

  // Create an empty JS object that will have the above properties.
  NAPI_CALL_RETURN_UNDEFINED(env, napi_create_object(env, &exports));

  // Add the above properties onto the object.
  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_define_properties(env,
                             exports,
                             sizeof(addon_props) / sizeof(*addon_props),
                             addon_props));

  // Return the object.
  return exports;
}
