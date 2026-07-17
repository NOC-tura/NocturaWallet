# M1 Stage 2 — flip localProving ON, on-device deposit → devnet accept

**Date:** 2026-07-17
**Status:** Design approved
**Context:** Stage 1 ([[project_m1_prover_spike]]) confirmed on-device native proving end-to-end (app launches — libc++ gate passed; native deposit prove in ~1067ms; publicInputs match hosted). Stage 2 is the final confirmation: a REAL deposit, proved on-device by the native prover, accepted by the devnet program `NPkc…HfES` — which also flips `localProving` ON (mainnet blocker #1 resolved for deposit: `noteSecret` never leaves the device).

## Approach — config flip, no code change

The whole native path is already wired and Stage-1-tested: `depositShield` → `proveShielded('deposit', params)` → (flag ON) `localProver.prove` → `ensureCircuitAssets` + `nativeProve` → `{proofBytes, publicInputs}` → `buildDepositIx` → `submitPoolTx`. So Stage 2 is a **one-line config change + rebuild**:

- Set `LOCAL_PROVING=true` in `.env.devnet` (gitignored) → `isLocalProvingEnabled()` true → `proveShielded` routes ALL shielded proofs through the native `localProver` (no hosted fallback — by design).
- Rebuild the devnet release APK (native prover already in `jniLibs`), deliver to `~/Downloads`.

No source change to the repo — only the gitignored env flag and a rebuild.

## On-device test (user)

Wallet state (on-chain verified 2026-07-17): transparent test-token account `ByLmVNmn68CJGrFxnDxpKztg1vLB2Ybr9qdiTzN3ZFMs` holds **7.1** test tokens (mint `AtjVK…`); `Da83c…e31B` has **0.474 SOL** for fees; **2.3** already shielded.

1. Install the APK, open Shielded → **Shield** a small amount (e.g. 0.1 test token).
2. The deposit proof is generated on-device by the native prover (`noteSecret` stays local).
3. Devnet accepts → shielded balance +0.1, success screen with a tx signature.

## Verification protocol

The user reports the **tx signature**. Confirm on-chain (devnet RPC): the `deposit` instruction to `NPkc…HfES` succeeded (`err: null`), a new commitment leaf was inserted, and the pool vault balance rose. A landed deposit whose proof was produced by the native prover = the devnet program **accepted the native proofBytes** → Stage 2 complete, `localProving` effectively ON for deposit.

## Scope / notes

- **Global flag:** `localProving` is global → withdraw/transfer also route native (same proven `witness_wasmi` + `proof_bytes` mechanism, but on-device-untested). The user tests **deposit**; unshield (withdraw native) is an optional bonus given the 2.3 shielded balance. Per-circuit gating would be a code change — global is simpler and recommended.
- **No fallback:** with the flag ON, a native failure aborts the shield (localProving is fail-closed, never silently self-relays). Devnet test build → acceptable; any failure is diagnosed + fixed.
- **First-shield download:** the first native prove downloads+verifies the deposit zkey+wasm (~2.6 MB, a few seconds behind the ZkProofScreen spinner).
- **Debug screen** (Stage 1) with the flag ON compares native-vs-native (meaningless) — irrelevant to Stage 2, which uses the real Shield UI.

## Non-goals

- Mainnet flag flip (this is devnet). On-device withdraw/transfer validation (follow-up). Per-circuit gating.

## Plan (folded in — trivial)

1. `LOCAL_PROVING=true` → `.env.devnet`.
2. `cargo ndk` .so present (unchanged) → `ENVFILE=.env.devnet ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease` → copy APK to `~/Downloads/NocturaWallet-localproving.apk`.
3. Update `STATUS.md`. User tests + reports tx sig → on-chain verify.
