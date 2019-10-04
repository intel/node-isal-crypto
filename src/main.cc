#include "common.h"
#include "bind_mb_hash.h"
#include "sha256_mb.h"
#include "sha512_mb.h"

// Convert a uint32_t-based digest from hardware byte order to network byte
// order.
#ifndef _WIN32
static
#endif  // !_WIN32
inline void
htonl_uint32(SHA256_HASH_CTX* context) {
  size_t idx;
  uint32_t result;

  for (idx = 0; idx < SHA256_DIGEST_NWORDS; idx++) {
    reinterpret_cast<unsigned char*>(&result)[0] =
        (context->job.result_digest[idx] >> 24) & 0xff;
    reinterpret_cast<unsigned char*>(&result)[1] =
        (context->job.result_digest[idx] >> 16) & 0xff;
    reinterpret_cast<unsigned char*>(&result)[2] =
        (context->job.result_digest[idx] >> 8) & 0xff;
    reinterpret_cast<unsigned char*>(&result)[3] =
        (context->job.result_digest[idx] & 0xff);
    context->job.result_digest[idx] = result;
  }
}

// Convert a uint64_t-based digest from hardware byte order to network byte
// order.
#ifndef _WIN32
static
#endif  // !_WIN32
inline void
htonl_uint64(SHA512_HASH_CTX* context) {
    int idx;
    uint64_t result;

    for (idx = 0; idx < SHA512_DIGEST_NWORDS; idx++) {
      ((unsigned char*)&result)[0] =
        (context->job.result_digest[idx] >> 56) & 0xff;
      ((unsigned char*)&result)[1] =
        (context->job.result_digest[idx] >> 48) & 0xff;
      ((unsigned char*)&result)[2] =
        (context->job.result_digest[idx] >> 40) & 0xff;
      ((unsigned char*)&result)[3] =
        (context->job.result_digest[idx] >> 32) & 0xff;
      ((unsigned char*)&result)[4] =
        (context->job.result_digest[idx] >> 24) & 0xff;
      ((unsigned char*)&result)[5] =
        (context->job.result_digest[idx] >> 16) & 0xff;
      ((unsigned char*)&result)[6] =
        (context->job.result_digest[idx] >>  8) & 0xff;
      ((unsigned char*)&result)[7] =
        (context->job.result_digest[idx] >>  0) & 0xff;
      context->job.result_digest[idx] = result;
    }
}

/* napi_value */
NAPI_MODULE_INIT(/* napi_env env, napi_value exports */) {
  napi_value sha256_mb = MBHashAddon<
    SHA256_HASH_CTX_MGR,
    SHA256_HASH_CTX,
    SHA256_MAX_LANES,
    sha256_ctx_mgr_init,
    sha256_ctx_mgr_flush,
    sha256_ctx_mgr_submit,
    htonl_uint32
  >::Init(env);

  napi_value sha512_mb = MBHashAddon<
    SHA512_HASH_CTX_MGR,
    SHA512_HASH_CTX,
    SHA512_MAX_LANES,
    sha512_ctx_mgr_init,
    sha512_ctx_mgr_flush,
    sha512_ctx_mgr_submit,
    htonl_uint64
  >::Init(env);

  napi_property_descriptor sub_exports[] = {
    NAPI_DESCRIBE_VALUE(sha256_mb),
    NAPI_DESCRIBE_VALUE(sha512_mb)
  };

  NAPI_CALL_RETURN_UNDEFINED(env,
      napi_define_properties(env,
                             exports,
                             sizeof(sub_exports) / sizeof(*sub_exports),
                             sub_exports));

  return exports;
}
