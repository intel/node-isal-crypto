#include "sha1_mb.h"
#include "bind_mb_hash.h"

extern "C" napi_value
init_sha1_mb(napi_env env) {
  return InitMBHash<
      SHA1_HASH_CTX_MGR,
      SHA1_HASH_CTX,
      SHA1_MAX_LANES,
      sha1_ctx_mgr_init,
      sha1_ctx_mgr_flush,
      sha1_ctx_mgr_submit,
      hash_htonl_uint32<SHA1_HASH_CTX, SHA1_DIGEST_NWORDS>
  >(env);
}
