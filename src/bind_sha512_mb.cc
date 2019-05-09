#include "sha512_mb.h"
#include "bind_mb_hash.h"

static inline void
sha512_htonl(SHA512_HASH_CTX* context) {
    int idx;
    unsigned char result[8];

    for (idx = 0; idx < SHA512_DIGEST_NWORDS; idx++) {
      result[0] = (context->job.result_digest[idx] >> 56) & 0xff;
      result[1] = (context->job.result_digest[idx] >> 48) & 0xff;
      result[2] = (context->job.result_digest[idx] >> 40) & 0xff;
      result[3] = (context->job.result_digest[idx] >> 32) & 0xff;
      result[4] = (context->job.result_digest[idx] >> 24) & 0xff;
      result[5] = (context->job.result_digest[idx] >> 16) & 0xff;
      result[6] = (context->job.result_digest[idx] >> 8) & 0xff;
      result[7] = (context->job.result_digest[idx] & 0xff);
      context->job.result_digest[idx] = *(uint64_t*)result;
    }
}

extern "C" napi_value
init_sha512_mb(napi_env env) {
  return InitMBHash<
      SHA512_HASH_CTX_MGR,
      SHA512_HASH_CTX,
      SHA512_MAX_LANES,
      sha512_ctx_mgr_init,
      sha512_ctx_mgr_flush,
      sha512_ctx_mgr_submit,
      sha512_htonl
  >(env);
}
