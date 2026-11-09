//! The A0 key set of one seed (spec §3, R1, R9, R12): `sk → nk → ivk`, `d_self`,
//! `addrField(d_self)`, and the values computed from them. Everything here is crate-private:
//! no item of this module is reachable from outside the crate, and no method returns `sk`
//! (it is not kept), `nk`, `ivk`, `d_self` or `addrField` to anything but crate code.

use super::eip2333::{derive_path, SPEND_PATH};
use super::field::{
    be_mod_order, fr_to_be32, mint_hash, poseidon, Fr, TAG_ADDR, TAG_CM, TAG_IVK, TAG_NK, TAG_NULL,
};
use super::state::A0Error;
use sha2::{Digest, Sha512};
use zeroize::{Zeroize, Zeroizing};

/// `d_self = be_mod_r(SHA-512(D_SELF_DOMAIN ‖ be32(nk)))` (R9).
const D_SELF_DOMAIN: &[u8] = b"noctura/a0/self-d/v1";
/// `rho(i) = be_mod_r(SHA-512(DEPOSIT_RHO_DOMAIN ‖ be32(nk) ‖ u64be(i)))` (R1).
const DEPOSIT_RHO_DOMAIN: &[u8] = b"noctura/a0/deposit-rho/v1";
/// A BIP-39 seed is 64 bytes; `keysOpen` takes nothing else.
pub(crate) const SEED_LEN: usize = 64;

/// The secrets of one open handle. `sk` is not kept: nothing in M1 needs it once `nk` exists.
/// Only `Fr` fields (four `u64` limbs each, no padding) — the wipe probe relies on it.
pub(crate) struct Keys {
    nk: Fr,
    ivk: Fr,
    d_self: Fr,
    addr_self: Fr,
}

fn sha512_mod_r(parts: &[&[u8]]) -> Fr {
    let mut h = Sha512::new();
    for p in parts {
        h.update(p);
    }
    let mut digest: [u8; 64] = h.finalize().into();
    let v = be_mod_order(&digest);
    digest.zeroize();
    v
}

impl Keys {
    /// Derives the key set from a 64-byte BIP-39 seed and wipes `seed` — on success the moment
    /// `sk` exists, on refusal before returning. Built inside its `Box`, so the long-lived copy
    /// is the heap one the drop wipes.
    pub(crate) fn derive(seed: &mut [u8]) -> Result<Box<Keys>, A0Error> {
        if seed.len() != SEED_LEN {
            let got = seed.len();
            seed.zeroize();
            return Err(A0Error::SeedLength { got });
        }
        let sk = derive_path(seed, &SPEND_PATH);
        seed.zeroize();
        let sk = sk.expect("a 64-byte seed is at least 256 bits");

        let mut keys = Box::new(Keys {
            nk: Fr::from(0u64),
            ivk: Fr::from(0u64),
            d_self: Fr::from(0u64),
            addr_self: Fr::from(0u64),
        });
        // nk = Poseidon3(TAG_NK, sk_hi, sk_lo), the 16-byte big-endian halves of sk
        let mut sk_hi: Fr = be_mod_order(&sk[..16]);
        let mut sk_lo: Fr = be_mod_order(&sk[16..]);
        drop(sk);
        keys.nk = poseidon(&[TAG_NK, sk_hi, sk_lo]);
        sk_hi.zeroize();
        sk_lo.zeroize();
        keys.ivk = poseidon(&[TAG_IVK, keys.nk]);
        let nk_be = Zeroizing::new(fr_to_be32(&keys.nk));
        keys.d_self = sha512_mod_r(&[D_SELF_DOMAIN, &nk_be[..]]);
        keys.addr_self = poseidon(&[TAG_ADDR, keys.nk, keys.d_self]);
        Ok(keys)
    }

    /// `nk` — for the witness (Task 3); never leaves the crate.
    pub(crate) fn nk(&self) -> &Fr {
        &self.nk
    }

    /// `ivk` — M2 scans with it; derived and held here, never returned.
    #[cfg(test)]
    pub(crate) fn ivk(&self) -> &Fr {
        &self.ivk
    }

    /// `d_self` — the private `d` / `change_d` of every own note (R9); for the witness (Task 3).
    pub(crate) fn d_self(&self) -> &Fr {
        &self.d_self
    }

    /// `addrField(d_self)` — viewing material (C4); only the commitment uses it.
    #[cfg(test)]
    pub(crate) fn addr_self(&self) -> &Fr {
        &self.addr_self
    }

    /// Deposit `rho(i)` (R1) — public once deposited.
    pub(crate) fn deposit_rho(&self, i: u64) -> Fr {
        let nk_be = Zeroizing::new(fr_to_be32(&self.nk));
        sha512_mod_r(&[DEPOSIT_RHO_DOMAIN, &nk_be[..], &i.to_be_bytes()])
    }

    /// `nullifier(rho) = Poseidon3(TAG_NULL, nk, rho)` — crate-internal (R12): it leaves only as
    /// a `withdraw_change` public input (Task 3), never through a call of its own.
    pub(crate) fn nullifier(&self, rho: &Fr) -> Fr {
        poseidon(&[TAG_NULL, self.nk, *rho])
    }

    /// `commitment(amount, rho) = Poseidon5(TAG_CM, addrField(d_self), amount, mintHash, rho)`.
    pub(crate) fn commitment(&self, amount: u64, rho: &Fr) -> Fr {
        poseidon(&[TAG_CM, self.addr_self, Fr::from(amount), mint_hash(), *rho])
    }

    #[cfg(test)]
    pub(crate) fn probe_bytes_for_test(&self) -> Vec<u8> {
        super::wipe_probe::bytes_of(self)
    }
}

impl Zeroize for Keys {
    fn zeroize(&mut self) {
        self.nk.zeroize();
        self.ivk.zeroize();
        self.d_self.zeroize();
        self.addr_self.zeroize();
    }
}

impl Drop for Keys {
    fn drop(&mut self) {
        self.zeroize();
        #[cfg(test)]
        super::wipe_probe::record("keys", &super::wipe_probe::bytes_of(self));
    }
}
