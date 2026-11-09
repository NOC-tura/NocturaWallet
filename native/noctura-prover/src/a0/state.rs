//! The one `Mutex` state of the A0 core (spec §3 "Rust state", m5) and its public surface —
//! the functions the JNI binds (Task 4): `keys_open`, `keys_close`, `deposit_rho`,
//! `match_spent`, `commitment`. Each returns only values that are public once used.
//!
//! Rules (spec §3, m5):
//! - one session at a time; `keys_open` ALWAYS ends the previous one — even when it then refuses
//!   the new seed — so a stale handle never reaches live keys;
//! - a handle is an opaque, never-zero `u64`, never repeated within the process (one counter for
//!   every `Core`, so one state's handle is never another's);
//! - `keys_close` with a handle that is not the live one is refused and closes nothing;
//! - a poisoned lock (a panic while holding it) wipes the keys and refuses every later call:
//!   fail closed until the process restarts.

use super::field::{fr_from_be32, fr_to_be32, Fr};
use super::keys::Keys;
use std::collections::HashSet;
use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
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
        }
    }
}

impl std::error::Error for A0Error {}

/// The live session: its handle and its keys (boxed, so the wiped copy is the only long-lived one).
pub(crate) struct Session {
    pub(crate) handle: Handle,
    pub(crate) keys: Box<Keys>,
}

/// Everything behind the one lock. Task 2 adds `auth: Option<Auth>` here and clears it in
/// [`Inner::end_session`], the single place a session ends.
pub(crate) struct Inner {
    session: Option<Session>,
}

impl Inner {
    /// Ends the live session, if any: dropping the `Box<Keys>` wipes it.
    pub(crate) fn end_session(&mut self) {
        self.session = None;
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
            inner: Mutex::new(Inner { session: None }),
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

    /// Test-only: panic while holding the lock, to exercise the poison path.
    #[cfg(test)]
    pub(crate) fn poison_for_test(&self) {
        let _guard = self.inner.lock();
        panic!("poisoning the A0 state on purpose");
    }
}
