//! The one `Mutex` state of the A0 core (spec §3 "Rust state", m5) and its public surface —
//! the functions the JNI binds (Task 4): `keys_open`, `keys_close`, `deposit_rho`,
//! `match_spent`, `commitment`, `authorize_unshield`. Each returns only values that are public
//! once used (an `AuthId` carries nothing but a random token).
//!
//! Rules (spec §3, m5):
//! - one session at a time; `keys_open` ALWAYS ends the previous one — even when it then refuses
//!   the new seed — so a stale handle never reaches live keys;
//! - a handle is an opaque, never-zero `u64`, never repeated within the process (one counter for
//!   every `Core`, so one state's handle is never another's);
//! - `keys_close` with a handle that is not the live one is refused and closes nothing;
//! - a poisoned lock (a panic while holding it) wipes the keys and refuses every later call:
//!   fail closed until the process restarts.
//!
//! The unshield authorization (spec §4 step 4, INV-AUTH) lives behind the same lock, so the
//! UI thread's `authorize_unshield` and the proving thread's `take_auth` never see it half
//! written:
//! - at most one at a time: `authorize_unshield` is refused while a live (unexpired) one exists;
//!   an expired one is dropped and replaced;
//! - recorded under the live handle and cleared by [`Inner::end_session`] — so `keys_close`, a
//!   second `keys_open` (even a refused one) and a poisoned lock all invalidate it;
//! - consumed by the FIRST `take_auth`, whatever that call then decides (a wrong id, another
//!   handle or an expired record still uses it up — fail closed);
//! - usable while `now < approval + 120 s` on the boot clock (`auth::now`).

use super::auth::{self, Auth, AuthId, AUTH_TTL};
use super::field::{fr_from_be32, fr_to_be32, Fr, MINT};
use super::keys::Keys;
use super::unshield::{self, POOL};
use std::collections::HashSet;
use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;
use zeroize::Zeroizing;

/// The process-wide state the JNI binds to (Task 4). Tests use their own `Core::new()`.
pub static CORE: Core = Core::new();

/// The last handle issued in this process, by any `Core`.
static LAST_HANDLE: AtomicU64 = AtomicU64::new(0);

/// An opaque session handle (spec §3: "opaque handle"). Not secret.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Handle(u64);

impl Handle {
    pub fn raw(self) -> u64 {
        self.0
    }
    pub fn from_raw(raw: u64) -> Self {
        Handle(raw)
    }
}

/// Refusals. No variant carries a secret or an input value.
#[derive(Debug, PartialEq, Eq)]
pub enum A0Error {
    /// The seed is not the 64 bytes of a BIP-39 seed.
    SeedLength { got: usize },
    /// Not the live handle of this state (closed, replaced, or never issued).
    UnknownHandle,
    /// A field value that is not canonical 32-byte big-endian `< r`.
    NonCanonical { what: &'static str, index: usize },
    /// The same own `rho` twice in one `match_spent` call (a `rho` never repeats for one key).
    DuplicateRho { index: usize },
    /// A thread panicked while holding the state; the keys were wiped.
    StatePoisoned,
    /// The unshield owner is not base58 (a character outside the alphabet).
    OwnerNotBase58,
    /// The unshield owner does not decode to 32 bytes.
    OwnerLength { got: usize },
    /// The unshield owner is off the Ed25519 curve (a PDA, for one) — m3.
    OwnerOffCurve,
    /// The unshield owner decompresses, but is not the canonical encoding of its point.
    OwnerNonCanonical,
    /// The unshield owner is a point of order 1, 2, 4 or 8 (the System Program's bytes, for one).
    OwnerSmallOrder,
    /// The unshield owner has a torsion component (not a possible Ed25519 public key).
    OwnerTorsion,
    /// No bump 255..=1 gives an off-curve address (never observed).
    NoProgramAddress,
    /// `amount` or `fee` is not a canonical decimal u64.
    NotU64 { what: &'static str },
    /// The unshield amount is 0.
    AmountZero,
    /// The relayer fee is above the pinned sanity ceiling.
    FeeAboveCeiling,
    /// `amount + fee` does not fit a u64.
    AmountPlusFeeOverflow,
    /// An authorization is already live; one at a time.
    AuthInFlight,
    /// No live authorization (never given, already used, or cleared with its session).
    AuthAbsent,
    /// The id is not the live authorization's (the live one is now used up).
    AuthMismatch,
    /// The live authorization was recorded under another handle (it is now used up).
    AuthWrongHandle,
    /// The authorization's 120 s have passed (it is now used up).
    AuthExpired,
    /// The OS random source failed.
    Rng,
    /// The boot clock could not be read.
    Clock,
}

impl fmt::Display for A0Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            A0Error::SeedLength { got } => write!(f, "seed must be 64 bytes, got {got}"),
            A0Error::UnknownHandle => write!(f, "unknown or closed key handle"),
            A0Error::NonCanonical { what, index } => {
                write!(f, "{what}[{index}] is not a canonical field element")
            }
            A0Error::DuplicateRho { index } => write!(f, "ownRhos[{index}] repeats an earlier rho"),
            A0Error::StatePoisoned => write!(f, "shielded key state poisoned; restart the app"),
            A0Error::OwnerNotBase58 => write!(f, "destination owner is not a base58 address"),
            A0Error::OwnerLength { got } => {
                write!(f, "destination owner must be 32 bytes, got {got}")
            }
            A0Error::OwnerOffCurve => {
                write!(
                    f,
                    "destination owner is off the curve (not a wallet address)"
                )
            }
            A0Error::OwnerNonCanonical => {
                write!(
                    f,
                    "destination owner is not a canonical public key encoding"
                )
            }
            A0Error::OwnerSmallOrder | A0Error::OwnerTorsion => {
                write!(f, "destination owner is not a possible wallet public key")
            }
            A0Error::NoProgramAddress => write!(f, "no program address for this owner"),
            A0Error::NotU64 { what } => write!(f, "{what} is not a decimal u64"),
            A0Error::AmountZero => write!(f, "amount must be greater than 0"),
            A0Error::FeeAboveCeiling => write!(f, "fee is above the pinned ceiling"),
            A0Error::AmountPlusFeeOverflow => write!(f, "amount + fee overflows u64"),
            A0Error::AuthInFlight => write!(f, "an unshield authorization is already in flight"),
            A0Error::AuthAbsent => write!(f, "no live unshield authorization"),
            A0Error::AuthMismatch => write!(f, "not the live unshield authorization"),
            A0Error::AuthWrongHandle => {
                write!(f, "unshield authorization belongs to another key handle")
            }
            A0Error::AuthExpired => write!(f, "unshield authorization expired"),
            A0Error::Rng => write!(f, "the OS random source failed"),
            A0Error::Clock => write!(f, "the boot clock could not be read"),
        }
    }
}

impl std::error::Error for A0Error {}

/// The live session: its handle and its keys (boxed, so the wiped copy is the only long-lived one).
pub(crate) struct Session {
    pub(crate) handle: Handle,
    pub(crate) keys: Box<Keys>,
}

/// Everything behind the one lock: the session's keys and the one unshield authorization.
pub(crate) struct Inner {
    session: Option<Session>,
    auth: Option<Auth>,
}

impl Inner {
    /// Ends the live session, if any: dropping the `Box<Keys>` wipes it, and the authorization
    /// (recorded under that session's handle) goes with it. The single place a session ends.
    pub(crate) fn end_session(&mut self) {
        self.session = None;
        self.auth = None;
    }

    /// Hands the live authorization to `prove` (Task 3) — and consumes it FIRST, so whatever
    /// this call decides, the record cannot be used again. Refuses, in this order: `handle` not
    /// live (`UnknownHandle`); none live (`AuthAbsent`); another id (`AuthMismatch`); recorded
    /// under another handle (`AuthWrongHandle`); `now >= expires_at` (`AuthExpired`).
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "consumed by Task 3's withdraw_change prove")
    )]
    pub(crate) fn take_auth(
        &mut self,
        handle: Handle,
        auth_id: &AuthId,
        now: Duration,
    ) -> Result<Auth, A0Error> {
        let auth = self.auth.take();
        self.keys_for(handle)?;
        let auth = auth.ok_or(A0Error::AuthAbsent)?;
        if !auth.id.same(auth_id) {
            return Err(A0Error::AuthMismatch);
        }
        if auth.handle != handle {
            return Err(A0Error::AuthWrongHandle);
        }
        if now >= auth.expires_at {
            return Err(A0Error::AuthExpired);
        }
        Ok(auth)
    }

    /// Test-only: plant a record as if `end_session` had failed to clear it.
    #[cfg(test)]
    pub(crate) fn plant_auth_for_test(&mut self, auth: Auth) {
        self.auth = Some(auth);
    }

    /// Test-only: the live record's expiry, without consuming it.
    #[cfg(test)]
    pub(crate) fn peek_auth_expiry_for_test(&self) -> Option<Duration> {
        self.auth.as_ref().map(|a| a.expires_at)
    }

    /// The keys of `handle`, or `UnknownHandle`.
    pub(crate) fn keys_for(&self, handle: Handle) -> Result<&Keys, A0Error> {
        match &self.session {
            Some(s) if s.handle == handle => Ok(&s.keys),
            _ => Err(A0Error::UnknownHandle),
        }
    }
}

/// The A0 core state: `Mutex<Inner>`.
pub struct Core {
    inner: Mutex<Inner>,
}

impl Default for Core {
    fn default() -> Self {
        Core::new()
    }
}

fn canonical(bytes: &[u8; 32], what: &'static str, index: usize) -> Result<Fr, A0Error> {
    fr_from_be32(bytes).ok_or(A0Error::NonCanonical { what, index })
}

impl Core {
    pub const fn new() -> Self {
        Core {
            inner: Mutex::new(Inner {
                session: None,
                auth: None,
            }),
        }
    }

    /// The lock; on poison, wipes the keys and refuses (fail closed).
    pub(crate) fn lock(&self) -> Result<MutexGuard<'_, Inner>, A0Error> {
        self.inner.lock().map_err(|poisoned| {
            poisoned.into_inner().end_session();
            A0Error::StatePoisoned
        })
    }

    /// `keysOpen(seed) -> handle`: ends any live session, derives the keys, wipes `seed`
    /// (whatever the outcome), and returns a fresh handle.
    pub fn keys_open(&self, seed: &mut [u8]) -> Result<Handle, A0Error> {
        let mut inner = match self.lock() {
            Ok(g) => g,
            Err(e) => {
                zeroize::Zeroize::zeroize(seed);
                return Err(e);
            }
        };
        inner.end_session();
        let keys = Keys::derive(seed)?;
        let handle = Handle(LAST_HANDLE.fetch_add(1, Ordering::Relaxed) + 1);
        inner.session = Some(Session { handle, keys });
        Ok(handle)
    }

    /// `keysClose(handle)`: wipes the keys of the live handle; any other handle is refused.
    pub fn keys_close(&self, handle: Handle) -> Result<(), A0Error> {
        let mut inner = self.lock()?;
        inner.keys_for(handle)?;
        inner.end_session();
        Ok(())
    }

    /// `depositRho(handle, i) -> 32 bytes BE` — public once deposited (R1).
    pub fn deposit_rho(&self, handle: Handle, i: u64) -> Result<[u8; 32], A0Error> {
        let inner = self.lock()?;
        Ok(fr_to_be32(&inner.keys_for(handle)?.deposit_rho(i)))
    }

    /// `commitment(handle, amount, rho) -> 32 bytes BE` — an own note's commitment (d_self implicit).
    pub fn commitment(
        &self,
        handle: Handle,
        amount: u64,
        rho: &[u8; 32],
    ) -> Result<[u8; 32], A0Error> {
        let inner = self.lock()?;
        let keys = inner.keys_for(handle)?;
        let rho = canonical(rho, "rho", 0)?;
        Ok(fr_to_be32(&keys.commitment(amount, &rho)))
    }

    /// `matchSpent(handle, chainNullifiers, ownRhos) -> indices` (R12): the indices into
    /// `own_rhos`, ascending, of the notes whose `nullifier(rho)` is in `chain_nullifiers`.
    /// `chain_nullifiers` is a set (order and repeats do not matter); a repeated own `rho` is
    /// refused; every value must be canonical. The computed nullifiers never leave this call.
    pub fn match_spent(
        &self,
        handle: Handle,
        chain_nullifiers: &[[u8; 32]],
        own_rhos: &[[u8; 32]],
    ) -> Result<Vec<usize>, A0Error> {
        let inner = self.lock()?;
        let keys = inner.keys_for(handle)?;
        let mut chain = HashSet::with_capacity(chain_nullifiers.len());
        for (i, n) in chain_nullifiers.iter().enumerate() {
            canonical(n, "chainNullifier", i)?;
            chain.insert(*n);
        }
        let mut seen = HashSet::with_capacity(own_rhos.len());
        let mut rhos = Vec::with_capacity(own_rhos.len());
        for (i, r) in own_rhos.iter().enumerate() {
            let rho = canonical(r, "ownRho", i)?;
            if !seen.insert(*r) {
                return Err(A0Error::DuplicateRho { index: i });
            }
            rhos.push(rho);
        }
        let mut spent = Vec::new();
        for (i, rho) in rhos.iter().enumerate() {
            let nf = Zeroizing::new(fr_to_be32(&keys.nullifier(rho)));
            if chain.contains(&*nf) {
                spent.push(i);
            }
        }
        Ok(spent)
    }

    /// `authorizeUnshield(handle, owner, amount, fee) -> authId` — Kotlin only (spec §3, §4
    /// step 4), called on the biometric approval: re-parses the three strings exactly as
    /// `parseUnshield` does (the record holds Rust's values, never the caller's), and records
    /// `{owner, ata, amount, fee, pool, mint, handle, expiresAt = now + 120 s}`.
    pub fn authorize_unshield(
        &self,
        handle: Handle,
        owner: &str,
        amount: &str,
        fee: &str,
    ) -> Result<AuthId, A0Error> {
        let now = auth::now()?;
        self.authorize_unshield_at(handle, owner, amount, fee, now)
    }

    /// [`Core::authorize_unshield`] at an injected time (tests; `now` is on the `auth::now` clock).
    pub(crate) fn authorize_unshield_at(
        &self,
        handle: Handle,
        owner: &str,
        amount: &str,
        fee: &str,
        now: Duration,
    ) -> Result<AuthId, A0Error> {
        let mut inner = self.lock()?;
        inner.keys_for(handle)?;
        let parsed = unshield::parse(owner, amount, fee)?;
        if let Some(live) = &inner.auth {
            if now < live.expires_at {
                return Err(A0Error::AuthInFlight);
            }
        }
        let id = AuthId::fresh()?;
        inner.auth = Some(Auth {
            id,
            handle,
            owner: parsed.owner,
            ata: parsed.ata,
            amount: parsed.amount,
            fee: parsed.fee,
            pool: POOL,
            mint: MINT,
            expires_at: now + AUTH_TTL,
        });
        Ok(id)
    }

    /// Test-only: the state behind a poisoned lock, to observe what the poison path left.
    #[cfg(test)]
    pub(crate) fn lock_ignoring_poison_for_test(&self) -> MutexGuard<'_, Inner> {
        self.inner
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    /// Test-only: panic while holding the lock, to exercise the poison path.
    #[cfg(test)]
    pub(crate) fn poison_for_test(&self) {
        let _guard = self.inner.lock();
        panic!("poisoning the A0 state on purpose");
    }
}
