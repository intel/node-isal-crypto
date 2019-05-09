#include "sha1_mb.h"
#include "bind_mb_hash.h"

// Convert the digest from hardware byte order to network byte order if the
// context is complete.
static inline void
sha1_htonl(SHA1_HASH_CTX* context) {
  int idx;
  unsigned char result[4];

  for (idx = 0; idx < SHA1_DIGEST_NWORDS; idx++) {
    result[0] = (context->job.result_digest[idx] >> 24) & 0xff;
    result[1] = (context->job.result_digest[idx] >> 16) & 0xff;
    result[2] = (context->job.result_digest[idx] >> 8) & 0xff;
    result[3] = (context->job.result_digest[idx] & 0xff);
    context->job.result_digest[idx] = *(uint32_t*)result;
  }
}

extern "C" napi_value
init_sha1_mb(napi_env env) {
  return InitMBHash<
      SHA1_HASH_CTX_MGR,
      SHA1_HASH_CTX,
      SHA1_MAX_LANES,
      sha1_ctx_mgr_init,
      sha1_ctx_mgr_flush,
      sha1_ctx_mgr_submit,
      sha1_htonl
  >(env);
}
