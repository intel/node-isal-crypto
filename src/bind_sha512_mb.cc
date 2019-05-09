#include "sha512_mb.h"
#include "bind_mb_hash.h"

static inline void
sha512_htonl(SHA512_HASH_CTX* context) {
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
