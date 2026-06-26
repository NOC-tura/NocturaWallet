// Noctura shielded key — native BLST (BLS12-381) bridge.
//
// sk_spend (EIP-2333 path m/12381/371/1/0) is derived and used ONLY here, in
// native code; it is zeroized before returning and NEVER crosses back to JS.
// JS receives only the public key (G1, 48-byte compressed) and signatures
// (G2, 96-byte compressed). The seed is passed in (it already lives in the
// wallet's secure storage / JS for transparent keys); full seed-in-native
// hardening is a later step.
#include <jni.h>
#include <string>
#include <vector>
#include <cstring>
#include "blst.h"
#include "blst_aux.h"

// min-pk scheme domain for the shielded-op signature (C2 refines the payload).
static const char NOCTURA_DST[] = "NOCTURA_SHIELDED_BLS_SIG_V1_";

static std::string toHex(const uint8_t* d, size_t n) {
  static const char* H = "0123456789abcdef";
  std::string s;
  s.reserve(n * 2);
  for (size_t i = 0; i < n; i++) {
    s.push_back(H[d[i] >> 4]);
    s.push_back(H[d[i] & 0xf]);
  }
  return s;
}

static int hexNibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

static bool fromHex(const std::string& s, std::vector<uint8_t>& out) {
  if (s.size() % 2 != 0) return false;
  out.clear();
  out.reserve(s.size() / 2);
  for (size_t i = 0; i + 1 < s.size(); i += 2) {
    int hi = hexNibble(s[i]);
    int lo = hexNibble(s[i + 1]);
    if (hi < 0 || lo < 0) return false;
    out.push_back((uint8_t)((hi << 4) | lo));
  }
  return true;
}

// Derive sk_spend (EIP-2333 m/12381/371/1/0) from the BIP-39 seed.
static bool deriveSpendSk(const std::vector<uint8_t>& seed, blst_scalar* out) {
  if (seed.empty()) return false;
  blst_scalar master, a, b, c;
  blst_derive_master_eip2333(&master, seed.data(), seed.size());
  blst_derive_child_eip2333(&a, &master, 12381);
  blst_derive_child_eip2333(&b, &a, 371);
  blst_derive_child_eip2333(&c, &b, 1);
  blst_derive_child_eip2333(out, &c, 0);
  // zeroize intermediates
  std::memset(&master, 0, sizeof(master));
  std::memset(&a, 0, sizeof(a));
  std::memset(&b, 0, sizeof(b));
  std::memset(&c, 0, sizeof(c));
  return true;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_nocturawallet_shieldedkey_NocturaKeyModule_nativeGetShieldedPublicKey(
    JNIEnv* env, jobject /*thiz*/, jstring seedHex) {
  const char* s = env->GetStringUTFChars(seedHex, nullptr);
  std::vector<uint8_t> seed;
  bool ok = fromHex(std::string(s), seed);
  env->ReleaseStringUTFChars(seedHex, s);
  if (!ok) return env->NewStringUTF("");

  blst_scalar sk;
  if (!deriveSpendSk(seed, &sk)) {
    std::memset(seed.data(), 0, seed.size());
    return env->NewStringUTF("");
  }
  blst_p1 pk;
  blst_sk_to_pk_in_g1(&pk, &sk);
  uint8_t out[48];
  blst_p1_compress(out, &pk);

  std::memset(&sk, 0, sizeof(sk));
  std::memset(seed.data(), 0, seed.size());
  return env->NewStringUTF(toHex(out, 48).c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_nocturawallet_shieldedkey_NocturaKeyModule_nativeSignShieldedOp(
    JNIEnv* env, jobject /*thiz*/, jstring seedHex, jstring payloadHex) {
  const char* s = env->GetStringUTFChars(seedHex, nullptr);
  std::vector<uint8_t> seed;
  bool okSeed = fromHex(std::string(s), seed);
  env->ReleaseStringUTFChars(seedHex, s);

  const char* p = env->GetStringUTFChars(payloadHex, nullptr);
  std::vector<uint8_t> payload;
  bool okPayload = fromHex(std::string(p), payload);
  env->ReleaseStringUTFChars(payloadHex, p);

  if (!okSeed || !okPayload) {
    if (!seed.empty()) std::memset(seed.data(), 0, seed.size());
    return env->NewStringUTF("");
  }

  blst_scalar sk;
  if (!deriveSpendSk(seed, &sk)) {
    std::memset(seed.data(), 0, seed.size());
    return env->NewStringUTF("");
  }
  blst_p2 hash, sig;
  blst_hash_to_g2(&hash, payload.data(), payload.size(),
                  (const byte*)NOCTURA_DST, sizeof(NOCTURA_DST) - 1, nullptr, 0);
  blst_sign_pk_in_g1(&sig, &hash, &sk);
  uint8_t out[96];
  blst_p2_compress(out, &sig);

  std::memset(&sk, 0, sizeof(sk));
  std::memset(seed.data(), 0, seed.size());
  return env->NewStringUTF(toHex(out, 96).c_str());
}
