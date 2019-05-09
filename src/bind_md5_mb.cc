#include "md5_mb.h"
#include "bind_mb_hash.h"

// Convert the digest from hardware byte order to network byte order if the
// context is complete.
static inline void
md5_htonl(MD5_HASH_CTX* context) {
  (void) context;
}

extern "C" napi_value
init_md5_mb(napi_env env) {
  return InitMBHash<
      MD5_HASH_CTX_MGR,
      MD5_HASH_CTX,
      MD5_MAX_LANES,
      md5_ctx_mgr_init,
      md5_ctx_mgr_flush,
      md5_ctx_mgr_submit,
      md5_htonl
  >(env);
}
