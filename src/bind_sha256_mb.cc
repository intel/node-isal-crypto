#include "sha256_mb.h"
#include "bind_mb_hash.h"

// Convert a uint32_t-based digest from hardware byte order to network byte
// order.
static inline void
sha256_htonl(SHA256_HASH_CTX* context) {
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

extern "C" napi_value
init_sha256_mb(napi_env env) {
  return MBHashAddon<
      SHA256_HASH_CTX_MGR,
      SHA256_HASH_CTX,
      SHA256_MAX_LANES,
      sha256_ctx_mgr_init,
      sha256_ctx_mgr_flush,
      sha256_ctx_mgr_submit,
      sha256_htonl
  >::Init(env);
}
