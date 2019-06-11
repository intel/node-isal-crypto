#ifndef SRC_COMMON_H_
#define SRC_COMMON_H_

#define NAPI_EXPERIMENTAL
#include "node_api.h"
#include "assert.h"

#define NAPI_THROW_LAST_ERROR(env)                                 \
  do {                                                             \
    const napi_extended_error_info* error_info = NULL;             \
    status = napi_get_last_error_info((env), &error_info);         \
    assert(status == napi_ok && "Failed to retrieve error info");  \
    status = napi_throw_error(env, "", error_info->error_message); \
    assert(status == napi_ok && "Failed to throw error");          \
  } while(0)

#define NAPI_ASSERT(env, condition, code, message)                     \
  do {                                                                 \
    if (!(condition)) {                                                \
      napi_status status = napi_throw_error((env), (code), (message)); \
      assert(status == napi_ok && "Failed to throw error");            \
      return NULL;                                                     \
    }                                                                  \
  } while(0)

#define NAPI_ASSERT_TYPE(env, error_type, code, condition, message)      \
  do {                                                                   \
    if (!(condition)) {                                                  \
      napi_status status =                                               \
          napi_throw_ ## error_type ## _error((env), (code), message);   \
      assert(status == napi_ok && "Failed to throw error");              \
      return NULL;                                                       \
    }                                                                    \
  } while(0)

#define NAPI_CALL_BLOCK(env, call, returnBlock)                      \
  do {                                                               \
    napi_status status = (call);                                     \
    if (status != napi_ok) {                                         \
      NAPI_THROW_LAST_ERROR((env));                                  \
      returnBlock                                                    \
    }                                                                \
  } while(0)

#define NAPI_CALL(env, call) \
  NAPI_CALL_BLOCK((env), (call), { return NULL; })

#define NAPI_CALL_RETURN_UNDEFINED(env, call)                             \
  NAPI_CALL_BLOCK((env), (call), {                                        \
    napi_value undefined;                                                 \
    napi_status status = napi_get_undefined((env), &undefined);           \
    assert(status == napi_ok && "Unable to retrieve JS undefined value"); \
    return undefined;                                                     \
  })

#define NAPI_DESCRIBE_VALUE(value) \
  { #value, NULL, NULL, NULL, NULL, (value), napi_enumerable, NULL }

#endif  // SRC_COMMON_H_
