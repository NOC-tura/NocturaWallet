//! The unshield authorization record (spec §4 step 4, INV-AUTH, m-6): what Rust keeps after the
//! human approved `{owner, ata, amount, fee}` in the native dialog, and the opaque id Kotlin
//! hands to JS. The record lives in `state::Inner` beside the keys; the rules that use it
//! (one in flight, consumed by the first take, cleared with the session) are in `state`.

use super::state::{A0Error, Handle};
use std::time::Duration;

/// How long an approval stays usable: 120 s from the biometric approval (m-6).
pub(crate) const AUTH_TTL: Duration = Duration::from_secs(120);

/// An opaque authorization id: 16 bytes from the OS RNG, never derived from the data it
/// authorizes, so JS cannot forge or alter what it stands for. Not a key; `Debug` hides it
/// anyway (it is a capability while it is live).
#[derive(Clone, Copy)]
pub struct AuthId([u8; 16]);

impl AuthId {
    pub fn to_bytes(self) -> [u8; 16] {
        self.0
    }
    pub fn from_bytes(bytes: [u8; 16]) -> Self {
        AuthId(bytes)
    }
    /// Equality that reads every byte (no early exit on the first difference).
    pub(crate) fn same(&self, other: &AuthId) -> bool {
        self.0
            .iter()
            .zip(other.0.iter())
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            == 0
    }
    pub(crate) fn fresh() -> Result<AuthId, A0Error> {
        let mut b = [0u8; 16];
        getrandom::getrandom(&mut b).map_err(|_| A0Error::Rng)?;
        Ok(AuthId(b))
    }
}

impl std::fmt::Debug for AuthId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("AuthId(..)")
    }
}

/// The record (spec §4 step 4): `{owner, ata, amount, fee, pool, mint, handle, expiresAt}`.
/// Task 3's `prove` reads every field after `Inner::take_auth` hands it over.
#[derive(Debug)]
pub(crate) struct Auth {
    pub(crate) id: AuthId,
    pub(crate) handle: Handle,
    pub(crate) owner: [u8; 32],
    pub(crate) ata: [u8; 32],
    pub(crate) amount: u64,
    pub(crate) fee: u64,
    pub(crate) pool: [u8; 32],
    pub(crate) mint: [u8; 32],
    /// On the [`now`] clock: the approval time + [`AUTH_TTL`]; usable while `now < expires_at`.
    pub(crate) expires_at: Duration,
}

/// The authorization clock: time since boot INCLUDING suspend (`CLOCK_BOOTTIME`) on Linux and
/// Android, so a phone that sleeps after the approval does not stretch the 120 s window.
/// (std's `Instant` is `CLOCK_MONOTONIC`, which stops while suspended.) Never goes backwards and
/// is not moved by a wall-clock change. Elsewhere (desktop builds only) a monotonic `Instant`.
/// A clock failure is a refusal (`Clock`), never a panic (a panic would cross the JNI).
#[cfg(any(target_os = "linux", target_os = "android"))]
pub(crate) fn now() -> Result<Duration, A0Error> {
    let mut ts = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    // SAFETY: `ts` is a valid, writable timespec for the duration of the call.
    let rc = unsafe { libc::clock_gettime(libc::CLOCK_BOOTTIME, &mut ts) };
    let secs = u64::try_from(ts.tv_sec).map_err(|_| A0Error::Clock)?;
    let nanos = u32::try_from(ts.tv_nsec).map_err(|_| A0Error::Clock)?;
    if rc != 0 || nanos >= 1_000_000_000 {
        return Err(A0Error::Clock);
    }
    Ok(Duration::new(secs, nanos))
}

#[cfg(not(any(target_os = "linux", target_os = "android")))]
pub(crate) fn now() -> Result<Duration, A0Error> {
    static START: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();
    Ok(START.get_or_init(std::time::Instant::now).elapsed())
}
