# Local On-Device ZK Proving — Design

**Date:** 2026-07-13
**Status:** Approved design → plan
**Mainnet blocker:** #1 (noteSecret privacy) — wallet half
**Related:** [[project_shielded_relayer_contract]], [[project_shielded_mainnet_blockers]], [[project_zkprover_implementation]]

## 1. Problem & Goal

Today `proveShielded()` (`src/modules/zkProver/zkProverModule.ts`) POSTs the full
circuit witness — **including `noteSecret`** — to the hosted prover at
`${API_BASE}/zk/prove`. `noteSecret` is the de-facto spend authority for a note
(`nullifier = poseidon3(0x02, noteSecret, leafIndex)`; the deployed circuits
impose no separate key-knowledge constraint). So a compromised/subpoenaed/malicious
backend that has proved a note can spend it. `localProver.ts` is a stub
(`supported: false`).

**Goal:** generate every shielded proof **on the device** so `noteSecret` never
leaves the phone and never reaches the backend. Android **and** iOS, single
integration, no rework when the circuits change.

## 2. Security Boundary — what this closes vs. residual

**Closes (this spec):** the "`noteSecret` leaves the device / goes to the backend"
exposure — the largest vector (network interception, third-party trust, remote
compromise). After this, `noteSecret` is generated/stored in JS+MMKV as today but
is only ever passed to the **on-device** prover; it never crosses the network.

**Residual (OUT OF SCOPE — tracked ICO dependency, finding #1 part b):**
`noteSecret` remains the *sole* spend authority even on-device, so device-local
compromise (malware, MMKV extraction) still equals theft. Closing this requires a
**circuit key-knowledge constraint** bound to a native `sk_spend` (BLS12-381 in
Secure Enclave / Android Keystore) — a circuits-repo change owned by the ZK/ICO
team. This spec designs its interfaces to accept that change as **new assets + an
added native witness input, not a rewrite** (see §9).

**Non-goals:** the circuit change itself; trusted-setup ceremony; the SSL-pinning
/ RPC-proxy items (finding #4); re-enabling the native BLST module (though §5
unblocks it as a side effect).

## 3. Chosen Approach (decided)

- **Proving stack: `mopro` (zkmopro / PSE).** A Rust core exposed to both platforms
  via UniFFI-generated **Swift (iOS)** and **Kotlin (Android)** bindings from one
  codebase — the "write once, both platforms" property. Under the hood it uses the
  battle-tested **rapidsnark + witnesscalc** for circom Groth16 (seconds on modern
  hardware). Circuits are Groth16 / BN254 (256-byte proof = A·G1 + B·G2 + C·G1,
  uncompressed), which mopro's circom adapter supports directly. Future-proof: mopro
  also covers Halo2 and other systems if the circuits ever migrate.
  - *Rejected:* rapidsnark + witnesscalc integrated directly (same engine but two
    libs wired per-platform by hand → the "do it twice" we're avoiding);
    `@callstack/polygen` (AOT-WASM witness gen is slower/memory-heavy for depth-20
    and still needs a separate Groth16 backend).
- **Asset delivery: hybrid.** Bundle the small witness `.wasm` in the app; download
  each `.zkey` on first use with a **SHA-256 hash pinned in the app** + a persistent
  cache. (§6)
- **Fallback: local-only.** Shielded proofs are generated **only** locally. The
  hosted prover is **removed** for shielded ops. No silent fallback — same principle
  as the relayer hard-switch. (§7)

## 4. Architecture / Components

```
transferFlow / depositFlow / withdrawFlow / withdrawChangeFlow
        │  proveShielded(circuitId, params)          [unchanged callers]
        ▼
localProver.ts  ──ensure assets──►  provingAssets.ts
   │  prove(circuitId, witness,          (resolve/download/verify/cache
   │        wasmPath, zkeyPath)           .wasm + .zkey per circuitId)
   ▼
NocturaProver (RN native module)  ──JS↔native bridge──►  mopro (Rust core)
                                                            │ UniFFI
                                              iOS (Swift) / Android (Kotlin)
                                              rapidsnark + witnesscalc (Groth16)
```

- **`mopro` Rust core** — builds the four circuits' proving into one Rust crate;
  UniFFI emits Swift + Kotlin bindings.
- **`NocturaProver` (new RN native module)** — thin bridge only:
  `prove(circuitId, witnessJson, wasmPath, zkeyPath) → { proofBytes, publicInputs }`.
  No business logic; no key handling beyond passing the witness through to mopro.
- **`localProver.ts`** — the existing stub becomes the real implementation of the
  SAME public interface (`supported`, `prove`). Nothing else in the prover chain
  changes shape.
- **`provingAssets.ts` (new)** — resolves a `circuitId` to a bundled `.wasm` path
  and a cached/downloaded `.zkey` path; downloads (pinned URL), verifies SHA-256,
  caches, and re-verifies on load. Never returns an unverified `.zkey`.
- **Circuit-agnostic:** every path is keyed by `circuitId ∈ {deposit, withdraw,
  withdraw_change, transfer}`. A circuit change = new `.wasm`/`.zkey` + new pinned
  hash; **no code change**.

## 5. Native integration + the `libc++` landmine

Adding a Rust/C++ native module re-triggers the exact risk in
[[project_native_libcpp_crash]]: a bundled `libc++_shared.so` (NDK) conflicting
with React Native's → **silent startup crash on release builds** (this is why the
native BLST module is currently excluded from all builds).

**Mitigation (solve it correctly, once):**
- Android: link mopro's native lib with `ANDROID_STL=c++_static` (static libc++,
  no bundled `libc++_shared` — cleanest), OR
  `packagingOptions { jniLibs { pickFirst '**/libc++_shared.so' } }` so RN's wins —
  whichever mopro's build supports cleanly; verify ABI compatibility.
- iOS: standard static linking of the mopro `.a`/xcframework; no libc++ conflict on
  iOS in practice.
- **On-device verification is milestone 1** (§8): before ANY further work, prove
  that a release build with mopro **launches and generates one valid proof** on a
  real Android arm64 device AND an iOS device. C1 (BLST) shipped unverified and
  crashed — do not repeat.
- **Side benefit:** solving the STL-linking pattern here **unblocks re-enabling the
  native BLST module** (same root cause) when part-b needs a native `sk_spend`.

## 6. Assets — delivery & integrity

| Asset | Size | Delivery |
|-------|------|----------|
| witness `.wasm` (×4) | small (~MB) | **bundled** in the app (offline, immediate) |
| proving `.zkey` (×4) | large (10s–100s MB) | **download on first use**, SHA-256-pinned, cached |

- The SHA-256 of each `.zkey` is a **constant pinned in the app** (`constants/`).
  A downloaded `.zkey` whose hash mismatches is **rejected** (delete + error);
  proving does not proceed. This blocks a MITM (or a compromised host) from
  swapping the key.
- `.zkey` cached on the filesystem (not MMKV — too large); a cache entry is
  re-verified against the pinned hash on load (cheap streaming SHA-256), so cache
  tampering is also caught.
- Download uses the pinned-TLS path where available; integrity does **not** depend
  on TLS (the SHA-256 pin is the real guarantee), so even the direct fetch is safe
  for this asset.
- **Privacy note:** downloading a public `.zkey` (identical for all users) is not
  per-user-identifying beyond "uses Noctura"; it is one-time-per-circuit and
  cached. Acceptable.

## 7. Fallback & device capability

- **Shielded proofs are local-only.** `proveShielded` routes to `localProver`; the
  hosted-prover code path for shielded ops is **removed** (deletes the
  `noteSecret`-to-backend footgun entirely). A transient failure (OOM spike, asset
  download blip) → retry via the existing `proofQueue`; it never falls back to
  hosted.
- **Capability check** at entry to shielded flows: architecture (arm64) + a RAM
  floor. If the device cannot prove, the shielded UI states clearly that private
  mode is unavailable on this device; **transparent mode still works**. `noteSecret`
  is never sent anywhere as a "fallback."
- **UX:** proving takes seconds on modern phones; reuse the existing
  `ProofProgressOverlay` + staged progress. Low-end devices may take longer — the
  overlay covers it.

## 8. Testing & Rollout

**JS unit (TDD, native mocked):**
- `localProver`: supported-flag gating; `prove` delegates to the native module with
  the resolved asset paths; error/throw paths.
- `provingAssets`: resolve bundled wasm; download → SHA-256 verify → cache; **reject
  on hash mismatch**; re-verify cached entry on load; no unverified return.
- prover chain: shielded proofs never touch the hosted path; transient failure →
  queue, not hosted.

**On-device integration (parity gate — the real proof it works):**
- For a fixed witness, the **locally-generated proof must verify against the same
  verifying key** the hosted prover / on-chain program uses (Groth16 verify parity),
  on Android arm64 **and** iOS. This is the golden-vector analogue for proving:
  same inputs → an on-chain-acceptable proof. Run on devnet against the live pool.

**Rollout milestones:**
- **M1 — native PoC:** release build with mopro launches + generates one valid
  proof on-device, both platforms (closes the §5 libc++ risk before anything else).
- **M2 — assets pipeline:** `provingAssets` download/verify/cache, wasm bundling.
- **M3 — wire flows:** `localProver` replaces hosted in all four flows
  (deposit/withdraw/withdraw_change/transfer); on-device parity gate passes.
- **M4 — remove hosted:** delete the hosted-prover path for shielded ops.

## 9. Forward-compatibility with part-b (circuit key-knowledge constraint)

When the ZK/ICO team adds the key-knowledge constraint (so `noteSecret` alone is not
spend authority, bound to a native `sk_spend`):
- The `.zkey`/`.wasm` for the affected circuits change → swap assets + pinned hash
  (no code change — §4 circuit-agnostic).
- The witness gains a spend-key-derived input. The witness builders
  (`transferWitness.ts` etc.) add that field; the native `sk_spend` derivation/sign
  happens in native (Secure Enclave / Keystore) and is fed into the witness — the
  `NocturaProver.prove` signature is designed to accept an opaque extra witness
  field, so no interface break.
- The §5 STL-linking work also unblocks the native BLST module needed here.

## 10. ICO / coordination dependencies

- Deliver, for all four circuits: witness `.wasm`, proving `.zkey`, each `.zkey`'s
  **SHA-256 hash**, and a **pinned download URL**.
- Confirm the circuits currently deployed are the ones the wallet must prove against
  (VK parity) before M3.
- Part-b (key-knowledge constraint + native `sk_spend` model) is a separate circuit
  spec; this wallet interface accepts it without a rewrite.

## 11. Risks

- **libc++ startup crash** (§5) — highest risk; mitigated by making the on-device
  launch+prove the very first milestone, both platforms.
- **`.zkey` size / download UX** — large first-use download; mitigated by cache +
  clear progress; exact sizes pending from ICO (drives whether any small `.zkey`
  could instead be bundled).
- **Low-end device performance** — mitigated by capability gate + transparent-mode
  fallback (never a privacy fallback).
- **iOS build config** — iOS is otherwise unconfigured (separate blocker); the mopro
  integration must build for iOS from the start (mopro makes this one effort, but it
  still needs the iOS project set up).
