#include "sha256_mb.h"
#include "bind_mb_hash.h"

extern "C" napi_value
init_sha256_mb(napi_env env) {
  return InitMBHash<
      SHA256_HASH_CTX_MGR,
      SHA256_HASH_CTX,
      SHA256_MAX_LANES,
      sha256_ctx_mgr_init,
      sha256_ctx_mgr_flush,
      sha256_ctx_mgr_submit,
      hash_htonl_uint32<SHA256_HASH_CTX, SHA256_DIGEST_NWORDS>
  >(env);
}
