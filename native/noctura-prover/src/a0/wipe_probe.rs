//! Test-only observation of a wipe: `record` is called inside a `Drop` (or after a wipe) with a
//! copy of the value's bytes, read while the memory is still owned — never after it is freed.
//! Thread-local, so parallel tests do not see each other's records.

use std::cell::RefCell;

thread_local! {
    static SEEN: RefCell<Vec<(&'static str, Vec<u8>)>> = const { RefCell::new(Vec::new()) };
}

/// The bytes of a value made only of plain integer limbs (no padding, no pointers).
pub(crate) fn bytes_of<T>(value: &T) -> Vec<u8> {
    // SAFETY: `value` is a live reference, so `size_of::<T>()` bytes at its address are
    // readable; the callers pass `Fr` arrays (or a pair of equal ones) and `Keys` (only `Fr`
    // fields, `[u64; 4]` each), so there is no padding and every byte is initialised.
    unsafe {
        std::slice::from_raw_parts((value as *const T).cast::<u8>(), std::mem::size_of::<T>())
    }
    .to_vec()
}

pub(crate) fn record(label: &'static str, bytes: &[u8]) {
    SEEN.with(|s| s.borrow_mut().push((label, bytes.to_vec())));
}

/// Removes and returns this thread's records under `label`.
pub(crate) fn take(label: &str) -> Vec<Vec<u8>> {
    SEEN.with(|s| {
        let mut all = s.borrow_mut();
        let (mine, rest): (Vec<_>, Vec<_>) = all.drain(..).partition(|(l, _)| *l == label);
        *all = rest;
        mine.into_iter().map(|(_, b)| b).collect()
    })
}
