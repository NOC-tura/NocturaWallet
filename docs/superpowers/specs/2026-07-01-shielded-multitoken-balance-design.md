# Design — Shielded real multi-token balance + per-token shield (Feature A)

**Date:** 2026-07-01
**Status:** Approved (brainstorm complete) — pending spec review → writing-plans.
**Scope:** Wallet-side. Make the shielded dashboard show the user's REAL shielded balances (read from notes, per SPL mint) instead of a mirror of the transparent balance, wire the encrypted note store to initialize app-wide (not just during a deposit), and let the user pick WHICH pool-backed token to shield. Multi-token-capable by construction (devnet demonstrates it with the AtjVK test mint; the code is not hardcoded to one token). Foundation for the multi-token shielded vision.

**Lineage:** builds on the merged shield deposit path (PRs #43/#46) + the secure-MMKV init stopgap in `depositFlow.ts` (this promotes it to app-wide). Design source of truth: the existing shielded dashboard (#11 mode=shielded) + shield-unshield (#16) visual layout in `/home/user/Downloads/index.html` — this feature feeds REAL data into that layout, it does not redesign it.

**Decided in brainstorm:** shielded assets are **SPL tokens** (the deployed pool is per-mint SPL: `pool=["pool",mint]`, vault = SPL token account, `deposit` = SPL transfer). Native SOL is NOT directly shieldable; SOL support will come later via **wSOL** (wrap → shield the wSOL SPL token; wallet hides the wrap/unwrap) — OUT OF SCOPE here. Which tokens are actually shieldable = which pools exist on-chain (devnet: AtjVK; mainnet: NOC + selectively others — anonymity favors fewer, busier pools).

---

## Scope

**IN:** (1) central `initSecureMmkv` wiring so the note store is readable app-wide; (2) a config list of shielded-pool mints; (3) the dashboard shielded view reads real per-mint shielded balances from notes (+ USD via existing prices) with an empty state; (4) real "Anonymity set" from the pool's on-chain merkle-tree leaf count; (5) per-token shield — a token picker (pool mints) whose selected mint flows #16 → #18 → `depositShield(mint)` (replacing the hardcoded `SHIELDED_DEVNET_MINT`).

**OUT (follow-ups):** SOL-via-wSOL (wrap/unwrap); initializing pools for NOC/other tokens (ICO/mainnet); withdraw/unshield (Feature B); private transfer (Project 2); a truly unified cross-token anonymity set (needs a multi-asset circuit).

---

## Components

### 1. Central `initSecureMmkv` wiring (app-wide)

`initSecureMmkv()` (`store/mmkv/instances.ts`) was designed but never called anywhere, so the encrypted note store is null until the deposit flow's stopgap `ensureSecureMmkv(seed)` runs. The dashboard needs to READ notes at app start, so the secure store must be initialized whenever a wallet session begins.

- **Key derivation (shared, deterministic):** extract `deriveSecureStorageKey(seed: Uint8Array): string` (= `sha256(seed ‖ utf8("noctura-secure-mmkv-v1"))[0:16]` as hex) into a shared util (e.g. `src/modules/keychain/secureStorageKey.ts`). It MUST produce the SAME key as `depositFlow.ensureSecureMmkv` currently derives inline, so both open the same encrypted store. Refactor `ensureSecureMmkv` to call the shared derivation (kept as an idempotent safety net).
- **Wire at two points** (both already have or can retrieve the seed):
  - **Unlock** (`src/screens/UnlockScreen.tsx` — after a successful PIN/biometric unlock): retrieve the seed (`keychainManager.retrieveSeed()` → `mnemonicToSeed`), call `initSecureMmkv(deriveSecureStorageKey(seed))`, zeroize the seed. This runs once per app session; subsequent note reads/writes need no further biometric.
  - **Onboarding completion** (`SuccessScreen.handleOpenWallet` — already holds the mnemonic/seed): call `initSecureMmkv(deriveSecureStorageKey(seed))` before navigating to the dashboard, so a freshly-onboarded session can read/write notes without a lock/unlock cycle.
- Idempotent: `initSecureMmkv` re-init with the same key is harmless; guard on `mmkvSecure()` being null where cheap.

### 2. Shielded-pool mints config

Add `SHIELDED_POOL_MINTS: readonly string[]` to `src/constants/programs.ts` — the SPL mints that have a shielded pool (i.e. what's shieldable + displayable). Devnet: `[SHIELDED_DEVNET_MINT]` (AtjVK). Mainnet: `[NOC_MINT]` (extend when more pools ship). Also expose a small helper to resolve each mint's display metadata (symbol/name/logo/decimals) — reuse the existing token metadata/`TokenManager` where the mint is known (NOC), and a minimal fallback (symbol from a short map, 9 decimals) for the devnet test mint.

### 3. Dashboard shielded view reads real balances

In `DashboardScreen.tsx`, when `mode === 'shielded'`, compute the shielded assets from `noteStore.getBalance(mint)` for each `mint` in `SHIELDED_POOL_MINTS`, instead of reusing the transparent `holdings`. For each pool mint with a non-zero (or any) shielded balance: show a row (token logo/symbol, `<amount> · shielded`, USD = amount × price from the existing price map). The "Shielded · vault balance" total = Σ USD of shielded balances. **Empty state** (no shielded notes across all pool mints): show a "Nothing shielded yet — tap Shield to make a token private" placeholder (keep the layout; no fake rows). The transparent view is unchanged.

- Reads are LOCAL (notes in the encrypted MMKV) — no RPC, fast, reactive. Re-read on focus + after a successful shield (bump a counter or subscribe to a note-store version). A lightweight `noteStore` change signal (module-level version integer bumped in `addNote`/`markSpent`, read via a hook) drives re-render; if that's heavier than needed, re-read on screen focus is sufficient for A.

### 4. Real "Anonymity set" (merkle leaf count)

Replace the hardcoded `Anonymity set · 1,284` (DashboardScreen `:531`) with the pool's real leaf count. The `MerkleTree` PDA (`merkleTreePda(poolPda(mint))`) is a zero-copy account whose first field after the 8-byte anchor discriminator is `next_leaf_index: u64` (LE) — read it via `connection.getAccountInfo` and parse bytes `[8..16)`. Add `fetchAnonymitySet(mint): Promise<number>` in a shielded module (e.g. `shieldedService` or a new `poolState.ts`); cache briefly; show the sum across displayed pool mints (or per-mint on the row). On RPC error, hide the anonymity line rather than showing a fake number.

### 5. Per-token shield

Currently the shield flow is SOL-hardcoded: #16 ShieldUnshield → #18 ZkProofScreen → `depositShield(SHIELDED_DEVNET_MINT, ...)`. Make it token-aware:
- **#16 ShieldUnshield** — add a token picker (reuse the existing `TokenSelector` component, seen in `DepositScreen`) limited to `SHIELDED_POOL_MINTS`; default to the first (devnet: AtjVK; mainnet: NOC). Show the selected token's transparent balance as "Available", parse the amount at the token's decimals.
- **Thread the mint** through the navigation param (#16 → #18) alongside `amount`/`direction`.
- **#18 ZkProofScreen** — `runDepositShield` uses `route.params.mint` (fall back to `SHIELDED_POOL_MINTS[0]` if absent) instead of the hardcoded `SHIELDED_DEVNET_MINT`. `depositShield` already takes the mint.
- The success screen already shows the shielded amount; label it with the selected token's symbol.

---

## Data flow

- Notes (local encrypted MMKV, unlocked in §1) → `getBalance(mint)` per `SHIELDED_POOL_MINTS` → shielded rows + total.
- Pool `merkle_tree` account (RPC, §4) → `next_leaf_index` → anonymity set.
- Existing price map → USD per row + total.
- Shield: #16 picks mint + amount → #18 → `depositShield(seed, feePayer, mint, amount)` → note stored → note-store version bumps → dashboard re-reads.

## Error handling

- Secure store not yet initialized (edge: dashboard renders before unlock wired it): `getBalance` guards already throw a clear "requires mmkvSecure" — treat a null store as "0 shielded / empty state" on the dashboard rather than crashing (wrap the read).
- Anonymity RPC failure → hide the line (no fake number).
- Missing price for a mint → show the amount without USD (—), don't block the row.
- Unknown/no pool mint selected → shield button disabled with a clear message.

## Testing

- **Unit:** shielded balance aggregation from a fixture note set (per mint); `deriveSecureStorageKey` determinism + equality with the old inline derivation (so existing notes still open); `SHIELDED_POOL_MINTS` config; `next_leaf_index` byte parsing from a fixture account; per-token param threading (#16 builds the nav param with the selected mint).
- **On-device (devnet):** after a shield, the shielded dashboard shows the real AtjVK shielded balance (not a SOL mirror), the anonymity set reflects the pool, and the empty state shows before any shield; shielding a second time updates the balance.

## Out of scope / deferred

- SOL via wSOL (wrap/unwrap, wallet-hidden) — the agreed SOL path.
- On-chain pools for NOC / other tokens (ICO / mainnet); pool selection curated for anonymity.
- Withdraw / unshield (Feature B) + private transfer (Project 2).
- Cross-token unified anonymity set (multi-asset circuit).
- Chain-side note discovery/scanning (deposits are self-created; the local note store is the source of truth for the user's own shielded balance — same as the deposit path).
