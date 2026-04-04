# Noctura Wallet — Architecture Validation Design

**Date:** 2026-04-04
**Status:** Validated
**Source of truth:** `.instructions.md` (v1.9, 4,377 lines)

This document captures the 9 architecture decisions validated during brainstorming before implementation begins. These resolve ambiguities, contradictions, and unstated assumptions in the spec.

---

## 1. ZK Circuits & Backend API — Separate Projects

The circom circuits (Groth16/BN254), Noctura backend API (`api.noc-tura.io`), and Phase 2 on-chain programs (`noctura_verifier`, `noctura_tree`, `noctura_nullifiers`) do **not** exist yet and are built separately from this React Native project.

**Impact on implementation:**
- Steps 27–31 (shielded flows): build client modules with spec-matching interfaces (`MerkleModule`, `ZKProverModule`, etc.) that call the API endpoints defined in `.instructions.md`
- Use mock/stub responses during dev and testing
- Local Polygen AOT prover: stubbed (no `.wasm` or `.zkey` files)
- `spec/vectors/` test vectors: don't exist — derive from spec or create placeholders
- Interfaces must match spec exactly for zero-change plug-in when backend ships

---

## 2. Native BLS12-381 — BLST (Supranational)

**Library:** [BLST](https://github.com/supranational/blst) (MIT license) for both platforms.

**Why BLST:**
- Industry standard, audited, used in Ethereum 2.0 clients (Lighthouse, Prysm, Teku)
- Single library = identical cryptographic behavior cross-platform
- Built-in EIP-2333 functions (`blst_derive_master_eip2333`, `blst_derive_child_eip2333`)
- Hand-optimized ARM64 assembly (critical for mobile performance)

**Integration:**
- **iOS (Swift):** Compile BLST as static C library → Swift C interop (bridging header) → XCFramework
- **Android (Kotlin):** Compile BLST via NDK → JNI → wrap in `NocturaKeyStore.kt`

**Native API surface:**
```
blst_derive_master_eip2333(seed) → master key
blst_derive_child_eip2333(master, path) → sk_spend at m/12381/371/1/0
blst_sk_to_pk → pk_shielded (G1 point, returned to JS once per session unlock)
blst_sign → BLS signatures on spend authorization payloads
```

`sk_spend` never leaves native boundary. `pk_shielded` passed to JS once after unlock for display and Zustand cache.

---

## 3. EIP-2333 Key Derivation Paths — Confirmed & Immutable

```
m/12381/371/1/0     — sk_spend  (native only, BLST)
m/12381/371/2/0     — sk_view   (JS allowed, micro-key-producer/bls.js)
m/12381/371/3/{idx} — disclosure (JS allowed, micro-key-producer/bls.js)
```

- **Coin type 371:** Internal Noctura convention, not registered in SLIP-0044
- **Immutable:** Paths are baked into ZK circuit constraints. Changing them would break all existing shielded balances.
- Must be identical in wallet client (BLST native + micro-key-producer JS) and ZK circuits

---

## 4. README Corrections

The README contained two inaccuracies from before the spec was finalized. Both corrected:

| Field | README (old) | Spec (correct) |
|-------|-------------|----------------|
| Solana SDK | Web3.js 2.x | `@solana/web3.js >= 1.95.8` (v1.x) |
| ZK proofs | snarkjs | `@callstack/polygen` AOT + hosted prover |

README updated to match `.instructions.md`.

---

## 5. Canonical Poseidon Field Element Conversions

All BLS12-381 → BN254 field element conversions use **big-endian byte interpretation**.

**pk_recipient (48 bytes BLS12-381 G1 compressed):**
```
pk_hi = BigInt('0x' + hex(pk[0:24]))  % BN254_ORDER   // bytes 0–23, big-endian
pk_lo = BigInt('0x' + hex(pk[24:48])) % BN254_ORDER   // bytes 24–47, big-endian
pk_field = Poseidon_3(0x05, pk_hi, pk_lo)              // domain tag 0x05
```

**mint_field (32 bytes Solana pubkey):**
```
mint_field = BigInt('0x' + hex(mint_bytes)) % BN254_ORDER  // big-endian, mod reduced
```

**Constants:**
- `BN254_ORDER` = scalar field order (not base field)
- Domain tags: `0x01` commitment, `0x02` nullifier, `0x03` Merkle node, `0x04` note ID, `0x05` pk-to-field

**Canonical reference:** `src/modules/shielded/primitives.ts` — the circom circuit **MUST** replicate this exact computation. Any endianness mismatch = invalid proofs.

---

## 6. Solana SDK & Anchor Versions

- **`@solana/web3.js >= 1.95.8`** (v1.x) — do NOT use `@solana/kit` yet
- **Anchor 1.0.0** (released April 2, 2026) — still uses web3.js v1.x internally
- **TS package renamed:** use `@anchor-lang/core` (NOT `@coral-xyz/anchor`)
- Migration to `@solana/kit` deferred until Anchor adds support
- Connection/provider abstraction in `src/modules/solana/` isolates Anchor interaction for future swap

---

## 7. Dual MMKV Instances — No Migration

Two separate MMKV instances. No migration between them.

### `noctura-public` (unencrypted, available at module scope)
```typescript
const mmkvPublic = new MMKV({ id: 'noctura-public' });
```
**Contents:** Language, theme, AMOLED mode, analytics opt-out, `ONBOARDING_COMPLETED`, `WALLET_EXISTS`, `APP_FORCE_UPDATE_REQUIRED`, `SCHEMA_VERSION`, `BACKUP_DISMISSED_SESSION`, and any other non-sensitive pre-onboarding settings.

### `noctura-secure` (encrypted, lazy-initialized after onboarding)
```typescript
let mmkvSecure: MMKV | null = null;
function initSecureMmkv(encryptionKey: string) {
  mmkvSecure = new MMKV({ id: 'noctura-secure', encryptionKey });
}
```
- **Encryption key:** `PBKDF2-SHA512(mnemonic, "noctura-mmkv", 600_000 iterations)` → stored in keychain
- **Contents:** All wallet state, balances, shielded notes, Merkle state, address book, proof queue
- Created once during onboarding (Step 14, KORAK 9), re-opened on every subsequent unlock

### `sessionStore` — No MMKV at all (in-memory only per spec)

Each `MMKV_KEYS` entry documents which instance it belongs to.

---

## 8. Settings Store — Two Stores, One Facade Hook

Zustand's persist middleware serializes the entire store as one JSON blob — don't fight it.

```typescript
// Internal — two stores, each persisted to its own MMKV
const usePublicSettingsStore = create(persist(..., { storage: mmkvPublicAdapter }));
const useSecureSettingsStore = create(persist(..., { storage: mmkvSecureAdapter }));

// Public API — one hook, consumers don't know about the split
export const useSettings = () => ({
  ...usePublicSettingsStore(),
  ...useSecureSettingsStore(),
});
```

- Components use `useSettings().language` — no storage boundary leakage
- `useSecureSettingsStore` returns sensible defaults when `mmkv-secure` isn't initialized (pre-onboarding)
- For render optimization on a single key, import the specific internal store directly (rare)

---

## 9. ZK Prover Module — Real HTTP, Stub Only Local

**Real code (functional):**
- Hosted prover: real HTTP calls to `POST /v1/prove/{circuit_type}` (will 404/timeout until backend exists)
- Proof queue: real MMKV persistence, real retry logic, real failure UX
- Fallback chain: hosted → local → queue — exercised end-to-end with real timeouts

**Stubbed (local Polygen only):**
- Full `LocalProver` interface implemented
- `checkViability()` returns `{ supported: false }`
- Logs: `"Local prover: @callstack/polygen not yet integrated"`
- Fallback chain skips it cleanly, moves to queue

**Do NOT** return mock proofs from the hosted path — let it fail naturally. The proof queue's retry + failure UX gets tested with real failure scenarios.

**Testing strategy:**
- Downstream consumers (deposit/transfer/withdraw): mock at `ZKProverModule` interface level
- Prover module tests: mock at HTTP layer (MSW or similar)
- Queue tests: real MMKV serialization

---

## Implementation Sequence

The 35-step sequence from `.instructions.md` Section "IMPLEMENTATION SEQUENCE" is **final and unchanged**. Each step is a deployable checkpoint. The verification checklist (146+ items) gates each step completion.
