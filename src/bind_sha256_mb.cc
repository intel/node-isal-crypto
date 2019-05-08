#include "sha256_mb.h"
#include "bind_mb_hash.h"

// Convert the digest from hardware byte order to network byte order if the
// context is complete.
class SHA256_HashHTONL : public HashHTONL<SHA256_HASH_CTX, SHA256_HashHTONL> {
 public:
  static inline void HTONL(SHA256_HASH_CTX* context) {
    int idx;
    unsigned char result[4];

    for (idx = 0; idx < SHA256_DIGEST_NWORDS; idx++) {
      result[0] = (context->job.result_digest[idx] >> 24) & 0xff;
      result[1] = (context->job.result_digest[idx] >> 16) & 0xff;
      result[2] = (context->job.result_digest[idx] >> 8) & 0xff;
      result[3] = (context->job.result_digest[idx] & 0xff);
      context->job.result_digest[idx] = *(uint32_t*)result;
    }
  }
};

extern "C" napi_value
init_sha256_mb(napi_env env) {
  return InitMBHash<
      SHA256_HASH_CTX_MGR,
      SHA256_HASH_CTX,
      SHA256_MAX_LANES,
      sha256_ctx_mgr_init,
      sha256_ctx_mgr_flush,
      sha256_ctx_mgr_submit,
      SHA256_HashHTONL>(env);
}
