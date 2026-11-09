//! EIP-2333 secret-key derivation (BLS12-381 key tree), pure Rust: HKDF-SHA256, the Lamport
//! intermediate and a reduction modulo the BLS12-381 subgroup order `r`. No curve operation is
//! needed — A0 uses `sk` only as bytes feeding `nk` (spec §3) — so no BLS library is linked.
//!
//! Every buffer this module allocates holding secret material is a `Zeroizing` one. The internal
//! state of `sha2` / `hmac` / `hkdf` (0.10 / 0.12) cannot be wiped from outside: a stated limit.

use super::field::be_mod_order;
use ark_ff::{BigInteger, PrimeField, Zero};
use hkdf::Hkdf;
use sha2::{Digest, Sha256};
use zeroize::{Zeroize, Zeroizing};

/// The BLS12-381 scalar field (EIP-2333's `r`), defined here so no BLS crate is pulled in.
/// ark-ff 0.4's derive trips two lints in a downstream crate, silenced for this module alone (the
/// derive reads every attribute on the struct as one of its own): it emits
/// `cfg(feature = "asm")` for ark-ff's own feature, which this crate does not have (false here:
/// the portable path), and it wraps its `impl`s in a generated function (`non_local_definitions`).
#[allow(unexpected_cfgs, non_local_definitions)]
mod bls_fr {
    use ark_ff::fields::{Fp256, MontBackend, MontConfig};

    #[derive(MontConfig)]
    #[modulus = "52435875175126190479447740508185965837690552500527637822603658699938581184513"]
    #[generator = "7"]
    pub(crate) struct BlsFrConfig;
    pub(crate) type BlsFr = Fp256<MontBackend<BlsFrConfig, 4>>;
}
use bls_fr::BlsFr;

/// `m/12381/371/1/0` — the shielded spend path (memory: paths immutable, spend = 1/0).
pub(crate) const SPEND_PATH: [u32; 4] = [12381, 371, 1, 0];

const KEYGEN_SALT: &[u8] = b"BLS-SIG-KEYGEN-SALT-";
const LAMPORT_CHUNKS: usize = 255;

/// `HKDF_mod_r(IKM)` with an empty `key_info` (EIP-2333 §hkdf_mod_r, L = 48).
fn hkdf_mod_r(ikm: &[u8]) -> Zeroizing<[u8; 32]> {
    let mut input = Zeroizing::new(Vec::with_capacity(ikm.len() + 1));
    input.extend_from_slice(ikm);
    input.push(0x00); // IKM || I2OSP(0, 1)
    let mut salt: [u8; 32] = Sha256::digest(KEYGEN_SALT).into();
    loop {
        let mut okm = Zeroizing::new([0u8; 48]);
        Hkdf::<Sha256>::new(Some(&salt), &input)
            .expand(&[0x00, 0x30], &mut okm[..]) // key_info || I2OSP(L, 2)
            .expect("48 bytes is within HKDF-SHA256's 8160-byte limit");
        let mut sk: BlsFr = be_mod_order(&okm[..]);
        if !sk.is_zero() {
            let mut out = Zeroizing::new([0u8; 32]);
            let mut be = sk.into_bigint().to_bytes_be();
            out.copy_from_slice(&be);
            be.zeroize();
            sk.zeroize();
            return out;
        }
        salt = Sha256::digest(salt).into();
    }
}

/// `IKM_to_lamport_SK(IKM, salt)`: 255 chunks of 32 bytes, as one buffer.
fn ikm_to_lamport_sk(ikm: &[u8], salt: &[u8]) -> Zeroizing<Vec<u8>> {
    let mut okm = Zeroizing::new(vec![0u8; 32 * LAMPORT_CHUNKS]);
    Hkdf::<Sha256>::new(Some(salt), ikm)
        .expand(&[], &mut okm[..])
        .expect("8160 bytes is exactly HKDF-SHA256's limit");
    okm
}

/// `parent_SK_to_lamport_PK(parent_SK, index)` → the compressed Lamport public key.
/// It determines the child key, so it is secret too.
pub(crate) fn parent_sk_to_lamport_pk(parent_sk: &[u8; 32], index: u32) -> Zeroizing<[u8; 32]> {
    let salt = index.to_be_bytes();
    let lamport_0 = ikm_to_lamport_sk(parent_sk, &salt);
    let mut not_ikm = Zeroizing::new(*parent_sk);
    for b in not_ikm.iter_mut() {
        *b = !*b;
    }
    let lamport_1 = ikm_to_lamport_sk(&not_ikm[..], &salt);
    let mut hasher = Sha256::new();
    for chunk in lamport_0.chunks(32).chain(lamport_1.chunks(32)) {
        hasher.update(Sha256::digest(chunk));
    }
    Zeroizing::new(hasher.finalize().into())
}

/// `derive_master_SK(seed)`; `None` for a seed under 256 bits (the EIP's MUST).
pub(crate) fn derive_master(seed: &[u8]) -> Option<Zeroizing<[u8; 32]>> {
    (seed.len() >= 32).then(|| hkdf_mod_r(seed))
}

/// `derive_child_SK(parent_SK, index)`.
pub(crate) fn derive_child(parent_sk: &[u8; 32], index: u32) -> Zeroizing<[u8; 32]> {
    let lamport_pk = parent_sk_to_lamport_pk(parent_sk, index);
    hkdf_mod_r(&lamport_pk[..])
}

/// `m/<path…>` from the seed; every intermediate key is wiped as soon as its child exists.
pub(crate) fn derive_path(seed: &[u8], path: &[u32]) -> Option<Zeroizing<[u8; 32]>> {
    let mut sk = derive_master(seed)?;
    for &index in path {
        sk = derive_child(&sk, index);
    }
    Some(sk)
}
