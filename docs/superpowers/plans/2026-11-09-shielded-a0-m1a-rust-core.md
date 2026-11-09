# Shielded on A0 · Plan M1a — the Rust core (keys, field values, the unshield authorization, proving with pinned A0 keys, the JNI / Kotlin / JS surface, the old blst module removed, the on-phone checkpoint) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 1 (2026-11-09):** first issue, dry-run in full.

- **The dry run:** every task was implemented for real on scratch clones of `feat/shielded-a0-m1` c888096 (spec rev 3.1), chained one commit per task: **7fc14e2, d30a178, 633f7b1, 5c02d72, db1e508, ee939bf**. Each task was red on its predecessor for the reason it states, and green on its own tree.
- **Gates:** `cargo fmt --check`, `cargo clippy --all-targets --locked -- -D warnings` (also with `--features jni-host`), `cargo test --locked` (97 lib + 1 interop at Task 6), root `tsc` 0, root jest (1260 passed, 1 skipped at Task 6), eslint on touched files, the no-TGE check, the Kotlin JVM tests (22 at Task 6), the desk tests (11, `node --test`).
- **Builds:** the arm64 `.so` NEEDs only libc / libm / libdl and exports exactly its 10 JNI functions. The devnet and production APKs build (Tasks 4–6), and both are free of `libnoctura_key.so`.
- **Named mutations:** 140, of which 136 compile and go red, and 4 are stated equivalents or second guards (Task 1 18; Task 2 33; Task 3 24, 1 equivalent; Task 4 21, 1 redundant; Task 5 16, 2 second guards; Task 6 28). Mutants that did not compile are recorded INVALID and not counted.
- **Measured on the desk:**
  - the Rust public inputs equal the offline JS values;
  - desktop deposit and withdraw_change proofs verify against the pinned VKs;
  - the two landed withdraw_change proofs verify under our layout;
  - the deposit VK read from devnet (Pool `8VMe…` at slot 520213277) equals the pinned `deposit_vk.json`;
  - prove times on the desktop: deposit ≈ 0.6 s, withdraw_change ≈ 4.2 s.
- **Replay:** replaying task-1 … task-6's blocks from this file onto `git archive c888096` reproduces each chain commit's tree byte for byte at every prefix (Self-review). The committed fixtures are produced by the generator commands each task gives, never pasted.
- **Next:** a Fable 5.1 review (owner rule), then the owner.

**Fable review 1 (2026-11-09, `.superpowers/sdd/m1a-plan-review-1.md`): 0 Critical, 6 Important, 8 Minor** — cryptography, the secret boundary and the proving path confirmed correct, the keyed suite re-run green under `CI=true`, the generators' `--check` re-derive every fixture. The controller's rulings, **binding on the executor** of the task named (each a row it adds with its test, a negative control and a named mutation, plus a "Spec rev 3.2 line" where the spec's text changes):
- **R1-I1 → Task 6 (supersedes the front-matter ruling below where they differ):** before EVERY install (devnet, production, test APK) the desk script reads the installed package's signer (`adb shell dumpsys package <pkg>` / `apksigner verify --print-certs` on the pulled APK) and compares it with the APK's; a different or unreadable signer → STOP before installing (fail closed), naming the package and both fingerprints; an install answering `INSTALL_FAILED_*` → STOP, no further adb call, never `uninstall`, never `pm clear`. The README's step that removes the test app becomes optional and says it removes only `com.nocturawallet.devnet.test` (an instrumentation APK, no user data); nothing else is ever uninstalled. Test rows: mocked adb answering a different signer, an unreadable signer, `INSTALL_FAILED_UPDATE_INCOMPATIBLE` — each STOPs with no further call.
- **R1-I2 → Task 6:** before installing the production APK over an installed wallet, the desk script `adb pull`s the installed base APK into the checkpoint's output dir (the rollback, sha256 recorded) and refuses to continue if the pull fails; the README requires the recovery phrase at hand AND names the rollback command (`adb install -r <pulled apk>`). Test row: a failed pull → STOP.
- **R1-I3 → Task 5:** the v1 React method `proveV1` refuses (a typed `E_V1_REMOVED` before any native call) — the v1 prover (unpinned keys, no allow-list, `seed_from_u64(0)`) is unreachable from JS from Task 5 on; the native v1 code itself is deleted with the v1 flows in M1b. Test row + mutation; the v1 JS callers (devnet-only, shielded off in production) surface the error.
- **R1-I4 → Task 5 (CI):** the native workflow also runs the three generators' `--check` (Node 24, the program side's repo NOT required for the two that do not read it; the prove generator's `--check` runs where its pinned inputs are committed, else is stated hand-run), the desk tests (`node --test scripts/m1a-checkpoint/`), and its `paths` filter includes every file the Rust tests `include_str!` (incl. `src/modules/shielded/a0/__tests__/golden-vectors.json`). A Gradle job for the Kotlin JVM tests is NOT added (cost); it stays a stated known gap.
- **R1-I5 → text (Spec rev 3.2 lines, Task 3 Notes):** the stated limits — the `Completed` witness copy of `nk` / `d_self` lives until the prove returns (seconds), arkworks' internal copies and the JSON witness values are not wiped; INV-NK's "zeroized on keysClose" means the keys state, not an in-flight prove's working copies.
- **R1-I6 → accepted (controller):** the withdraw_change VK is checked against the pinned `vk.json` (tied to the chain by the two landed proofs); reading `wchange_vk` from chain is M1c's.
- **Minors:** RNG test strengthened so an `s = r` mutant goes red (Task 3); the proving thread gets an explicit stack size (8 MiB) (Task 4); the rest are text in the tasks' Notes.
- **Rev 3.2 of the spec** is written after execution from the tasks' "Spec rev 3.2 lines" (text only).

**Goal:** Build spec plan M1a (§16): the native core of shielded on A0 — every secret (`sk`, `nk`, `ivk`, `d_self`, `addrField`) derived and kept in Rust, the field values and commitments, the deterministic deposit `rho`, `matchSpent`, the unshield authorization record, proving with per-circuit allow-lists against sha256-pinned A0 keys, the JNI / Kotlin / JS surface with its boundary tests, the old blst module removed with the build gated, and the on-phone checkpoint.

**Architecture:** One pure-Rust `.so` (`native/noctura-prover`, no C++ runtime) owns every secret behind one `Mutex` state and returns only values that are public once used. A desktop-tested `a0::bridge` turns JSON-and-string calls into results with stable `E_A0_*` codes; `android.rs` only marshals. Kotlin binds the JS-visible surface (the seed as bytes, zero-filled) and keeps `parseUnshield` / `authorizeUnshield` internal for M1c's native dialog. JS sees a typed bridge that has no function able to return a secret. Every vector is produced by an independent implementation (offline Node scripts), never by the code under test.

**Tech Stack:** Rust 1.90 (arkworks 0.4 family, `light-poseidon =0.1.2` constants with the crate's own wiping permutation, `curve25519-dalek =4.1.3`, `sha2` / `hkdf` / `zeroize`, `jni 0.21`), cargo-ndk 4.1.2, NDK 27.1.12297006, Kotlin (React Native 0.84 New Architecture), TypeScript strict, Jest, Node ≥ 22 for the offline generators (Node 24 or `--experimental-strip-types` for the one importing TypeScript).

**Spec:** `docs/superpowers/specs/2026-11-08-shielded-a0-m1-design.md` **rev 3.1** (owner-approved 2026-11-08). The dry run's departures are listed per task under "Spec rev 3.2 lines"; Task 6's executor writes rev 3.2 from them (text only; no owner decision changes). Decisions: `.superpowers/sdd/shielded-a0-m1-decisions.md` (S1–S12, R1–R13). Program-side facts: `.superpowers/sdd/shielded-ico-state-2026-11-08.md`. Brief and ledger of this dry run: `.superpowers/sdd/m1a-plan-brief.md`, `.superpowers/sdd/m1a-plan-ledger.md`.

## Global Constraints

- **The secret boundary (spec §3):**
  - **INV-NK:** the seed, `sk`, `nk`, `ivk`, `d_self` and every `addrField` never cross JNI, are never logged, and are zeroized on `keysClose`, on replacement and on drop.
  - **INV-NULL:** no JNI call returns an own note's nullifier except as public input [1] of a `withdraw_change` proof.
  - **INV-AUTH:** an unshield proof exists only for an `{owner, ata, amount, fee}` a human approved, once, within 120 s, under the same handle.
- **The seed crosses as bytes, never as a string.** It is zero-filled on the JS side and in Kotlin; Rust wipes its copy once `sk` is derived. Stated limit: the React Native bridge's own copies.
- **Pinned in Rust:**
  - the program `FeGSS…`, the pool `8VMe…`, the mint `ERkp…`, decimals 9, the fee ceiling 1,000,000;
  - the A0 key files by sha256: deposit zkey `fef08f02…3fe9` / wasm `1d69d7f8…dfff1`, withdraw_change zkey `ec55bdbb…d756f2` / wasm `01b0ec1f…45e0b9`;
  - the VKs `zk/keys/v2/*_vk.json`.
- **Allow-lists, not deny-lists:** deposit `{amount, depositIndex}`, withdraw_change `{merkleRoot, inputAmount, rho, pathElements[20], pathIndices[20]}`, transfer refused in M1.
- **Pure Rust only:** the arm64 `.so` NEEDs ⊆ {libc, libm, libdl, liblog}, exports exactly the 10 `Java_*` functions, and is packaged for `arm64-v8a` only; `isSupported()` is false elsewhere.
- **Vectors are never produced by the code under test** (the anti-circularity boundary). The offline generators are committed under `scripts/` with a `--check` mode.
- **Large key files are never committed.** Tests read them from `NOCTURA_A0_KEYS_DIR` (sha256-checked), skip LOUDLY when it is absent, and fail under `CI=true`. CI downloads them by digest from the content-addressed URLs, the same way it gets the v1 artifacts; no test contacts a host.
- **Never:**
  - contact `*.noc-tura.io` or solscan.io from a test;
  - touch mainnet;
  - open `/home/user/Downloads/index.html` as text.
  
  The one sanctioned devnet read is the checkpoint script's `getAccountInfo` of the pool (a refusal list guards the host).
- **CLAUDE.md cardinal rules** (no placeholders, integer amounts, TypeScript strict — no `any`, no `@ts-ignore`).
- **A truthful commit trailer** naming the model that wrote the commit.
- **Controller ruling for the checkpoint (binding on Task 6's executor; added after the dry run):** the phone may hold an app installed under another signing key (the September inventory records a debug-signed devnet build). The checkpoint **never uninstalls anything and never wipes app data**. If an `adb install -r` fails (e.g. `INSTALL_FAILED_UPDATE_INCOMPATIBLE`), the desk script stops with STOP, names the package and both key fingerprints, and asks the owner. The executor adds this rule to `scripts/m1a-checkpoint/README.md` and to the install step, with a test row (a mocked adb answering `INSTALL_FAILED_UPDATE_INCOMPATIBLE` → STOP, no further adb call) and a named mutation.
- **Mutation method** (the dry run's lesson):
  - Rust mutants run in fresh `git archive` copies, with every file of the copy `touch`ed: a shared target otherwise reuses a stale build-script output.
  - Kotlin and Gradle mutants may run in place (each followed by `git checkout`), because a Gradle copy needs its own 7 GB `node_modules`.
  - Android builds in a clone use a hard-linked (`cp -al`) `node_modules`, never a symlink to the main checkout.

## Review Focus

The five input classes or failure modes most likely to bite that no task's tests exercise:

1. **The owner's phone refuses to instrument a non-debuggable app.** Task 6 instruments the devnet *release* app (`testBuildType "release"`) so that the checkpoint runs the library that ships. Some devices refuse instrumentation of a release build.
   - **Known limitation, with a fallback:** `testBuildType "debug"` plus one cold debug build, with the harness code unchanged (Task 6 Notes).
   - The owner sees the refusal on the first run; nothing is installed or changed by it.
2. **Proving on the phone: time, memory and the thread's stack.** Desktop withdraw_change takes ≈ 4.2 s (zkey parse ≈ 4.6 s in release before proving). A phone is slower, and a low-RAM device may be killed by the OS.
   - **Measured only at the checkpoint:** the desk script records both prove times.
   - M1c's progress screen uses real stages (spec §6.9) and needs these numbers.
3. **Installing the production APK over a wallet signed with another key.** This is the controller ruling above: never uninstall, STOP and ask.
   - **Tested** (Task 6's added row and mutation).
4. **A key file corrupted or truncated on the device or in CI.**
   - **Tested:** Rust re-checks every file's sha256 before parsing. A one-byte change and a truncation are refused (Task 3), and CI's download fails closed on a digest mismatch (Task 3).
5. **The app killed mid-prove, or a second operation while an authorization is live.**
   - **Tested in Rust:**
     - one authorization in flight, with a second refused;
     - consumed by the first prove;
     - invalidated by `keysClose` and `keysOpen` (Task 2);
     - every prove consumes a live authorization first (Task 3).
   - **Known limitation:** process death drops the native state by construction. The handle dies with the process, so no authorization survives a restart. JS then starts again from a fresh `keysOpen`; that state machine is M1c's.

---

## How to read the steps

- A **new file** is given in full ("Create `path`"); a whole-file rewrite is "Replace `path` with"; a **changed file** is a unified diff against the previous task's tree. Apply each ```diff block on its own, in order, with `git apply --recount` from the repository root — never concatenate blocks. Deletions are the `git rm` commands the task gives.
- **Generated files** (the vector fixtures, the VK fixture, the devnet pool fixture) are produced by the commands the task gives and then checked (`--check`); never paste them.
- Digests, sizes and test counts quoted inside a task are those of its dry-run tree; a later task may change them (each task says when). Compare counts and equalities, never a quoted digest of a file a later task changes.
- **Each task ends with its named mutations** and **"Notes for the executor"** (its rulings, then the dry run's rulings, deviations and hand-over; part of the plan).

## Tasks

### Task 1: Keys and field values in Rust — `native/noctura-prover/src/a0/` (EIP-2333 `sk` at `m/12381/371/1/0` in pure Rust: HKDF-SHA256 + Lamport + mod r, no curve op; `nk`, `ivk`, `d_self`, `addrField(d_self)`; `mintHash` of the pinned devnet mint; the circomlib Poseidon as the crate's own wiped permutation over light-poseidon 0.1.2's constants; deposit `rho(i)`; the internal nullifier; `rho_change`; commitments; `matchSpent`; the one `Mutex` state `Core` / `Handle` / `A0Error` with zeroization on close, replacement, drop and poison); the offline vector generator `scripts/a0-vectors/gen-key-vectors.mjs` (bls.js + poseidon-lite via `fieldEquations.ts` + @noble/hashes) and its committed fixture; the EIP's own four cases; 28 tests, 18 named mutations

**Spec:** §3 (key derivation: `sk` EIP-2333 at `m/12381/371/1/0`, the seed zeroized the moment `sk` is derived; `nk = Poseidon3(TAG_NK, sk_hi, sk_lo)` with 16-byte BE limbs; `ivk = Poseidon2(TAG_IVK, nk)` derived, held, never returned; `d_self` (R9); `addrField(d)` never leaves Rust; `nullifier(rho)`; `commitment(amount, rho)` with the pinned `mintHash = be_mod_r(mint)`; deposit `rho(i)` (R1, 512-bit reduction); `rho_change = Poseidon3(TAG_RHO, nullifier, 0)`; `be_mod_r` = the program's `be_mod_f`; Poseidon (m12) circomlib-compatible on the locked arkworks 0.4 family; the JNI surface's `keysOpen` / `keysClose` / `depositRho` / `matchSpent` / `commitment` as Rust functions — the JNI itself is Task 4; "No pre-spend nullifier in JS" (R12: no `nullifier()` call, `matchSpent` recomputes inside Rust); handle lifetime (m5: a second `keysOpen` replaces the first); "Rust state is one `Mutex<{keys, auth}>`" — `auth` is Task 2's; INV-NK's zeroization half), §12 (pure-Rust crates, `Cargo.lock` in the same PR, no `libc++_shared`), §14 Rust (EIP-2333 against the EIP's four published cases; bls.js's `deriveSeedTree` at `m/12381/371/1/0` equal to Rust's for the repo's public test seed, its JS side produced OFFLINE by a script under `scripts/` (I-6); `nk`, `ivk`, `addrField`, `nullifier`, `commitment`, `matchSpent` against values computed independently in JS from the frozen equations; the Rust Poseidon against the a0 golden vectors with a named round-constant mutation; `rho(i)` and `d_self` against a JS reimplementation; zeroization and the seed wiped after `keysOpen`; named mutations). **Not here:** ATA, `parseUnshield`, the authorization record (Task 2); `prove`, allow-lists, pinned keys, witness completion (Task 3 — it consumes `nk`, `d_self`, `nullifier`, `commitment`, `rho_change`, `mint_hash` from here); the JNI, Kotlin, JS bridge and INV-NULL / INV-AUTH (Task 4); the `readelf` CI step (Task 5 — this task runs the check once by hand, Step 7).

**Files:**
- Create: `native/noctura-prover/src/a0/mod.rs`, `src/a0/eip2333.rs`, `src/a0/field.rs`, `src/a0/keys.rs`, `src/a0/state.rs`, `src/a0/wipe_probe.rs` (test-only), `scripts/a0-vectors/gen-key-vectors.mjs`
- Create (generated, committed): `native/noctura-prover/tests/fixtures/a0-key-vectors.json` (734 lines, written by the script — Step 2; not pasted)
- Create (tests): `native/noctura-prover/src/a0/tests.rs` (28 tests; in-crate, because every secret accessor is `pub(crate)`)
- Modify: `native/noctura-prover/Cargo.toml` (+`light-poseidon =0.1.2`, `sha2 0.10`, `hkdf 0.12`, `zeroize 1`), `native/noctura-prover/Cargo.lock` (+2 packages, +4 dependency lines — written by `cargo fetch`), `native/noctura-prover/src/lib.rs` (`pub mod a0;`)
- **Not changed, on purpose:** `src/prover.rs`, `src/proof_bytes.rs`, `src/witness_wasmi.rs`, `src/android.rs` (the existing prover and JNI stay as they are until Tasks 3–4), `tests/prove_to_bytes.rs`, `.github/workflows/native-prover.yml` (Task 5 adds the `readelf` step; the existing interop assertion is untouched and still passes), `src/modules/shielded/a0/fieldEquations.ts` and its `golden-vectors.json` (read, never written).

**Interfaces:**
- Consumes: `ark_bn254::Fr`, `ark_ff` 0.4.1 (`PrimeField`, `MontConfig` derive, `Zeroize` for `Fp`), `light_poseidon::parameters::bn254_x5::get_poseidon_parameters` (constants only), `sha2::{Sha256, Sha512}`, `hkdf::Hkdf`, `zeroize`; the golden rows `src/modules/shielded/a0/__tests__/golden-vectors.json` (read by the tests in place); for the script: `micro-key-producer/bls.js` 0.8.5 (`deriveMaster`, `deriveChild`, `deriveSeedTree`), `poseidon-lite` 0.3.0, `@noble/hashes` 2.0.1 `sha512`, `@scure/bip39` 2.0.1 `mnemonicToSeedSync`, `@scure/base` 2.0.0 `base58`, `src/modules/shielded/a0/fieldEquations.ts` (`TAG`, `FIELD_MODULUS`, `addrField`, `commitment`, `nullifier`, `rhoOut`).
- Produces — public (`noctura_prover::a0`, the only items reachable from outside the crate; each returns a value that is public once used):
  ```rust
  pub static CORE: Core;                                  // the process-wide state Task 4's JNI binds
  pub struct Core { /* Mutex<Inner> */ }
  impl Core {
      pub const fn new() -> Self;                         // tests use their own
      pub fn keys_open(&self, seed: &mut [u8]) -> Result<Handle, A0Error>;
      //   ends any live session FIRST (even if the seed is then refused); seed must be 64 bytes
      //   (else SeedLength{got}); `seed` is zero-filled on every path, success or refusal
      pub fn keys_close(&self, handle: Handle) -> Result<(), A0Error>;   // not the live handle → UnknownHandle, closes nothing
      pub fn deposit_rho(&self, handle: Handle, i: u64) -> Result<[u8; 32], A0Error>;           // rho(i), 32 bytes BE
      pub fn commitment(&self, handle: Handle, amount: u64, rho: &[u8; 32]) -> Result<[u8; 32], A0Error>;
      //   rho must be canonical (< r) → else NonCanonical{what: "rho", index: 0}
      pub fn match_spent(&self, handle: Handle, chain_nullifiers: &[[u8; 32]], own_rhos: &[[u8; 32]])
          -> Result<Vec<usize>, A0Error>;
      //   ascending indices into own_rhos whose nullifier(rho) ∈ chain_nullifiers; chain is a set
      //   (order / repeats irrelevant); a repeated own rho → DuplicateRho{index of the repeat};
      //   any value ≥ r → NonCanonical{what: "chainNullifier" | "ownRho", index}; empty in → empty out
  }
  #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)] pub struct Handle(u64);
  impl Handle { pub fn raw(self) -> u64; pub fn from_raw(raw: u64) -> Self; }   // never 0, never repeated in the process (one AtomicU64 for every Core)
  #[derive(Debug, PartialEq, Eq)] pub enum A0Error {
      SeedLength { got: usize }, UnknownHandle, NonCanonical { what: &'static str, index: usize },
      DuplicateRho { index: usize }, StatePoisoned,       // Display carries no secret and no input value
  }
  ```
- Produces — crate-private (what Tasks 2 and 3 build on; none of it is `pub`):
  ```rust
  // a0::state
  pub(crate) struct Inner { session: Option<Session> }                 // Task 2 adds `auth: Option<Auth>`
  impl Inner {
      pub(crate) fn end_session(&mut self);                            // THE single place a session ends — Task 2 adds `self.auth = None;` here;
                                                                       // keys_open, keys_close and the poison path all call it
      pub(crate) fn keys_for(&self, handle: Handle) -> Result<&Keys, A0Error>;
  }
  pub(crate) struct Session { pub(crate) handle: Handle, pub(crate) keys: Box<Keys> }
  impl Core { pub(crate) fn lock(&self) -> Result<MutexGuard<'_, Inner>, A0Error>; }  // poison → wipes keys, StatePoisoned
  // a0::keys
  pub(crate) struct Keys { nk, ivk, d_self, addr_self: Fr }            // Zeroize + Drop wipes; sk is NOT kept
  impl Keys {
      pub(crate) fn derive(seed: &mut [u8]) -> Result<Box<Keys>, A0Error>;   // wipes seed
      pub(crate) fn nk(&self) -> &Fr;                                  // Task 3 (witness `nk`)
      pub(crate) fn d_self(&self) -> &Fr;                              // Task 3 (witness `d`, `change_d`)
      pub(crate) fn deposit_rho(&self, i: u64) -> Fr;
      pub(crate) fn nullifier(&self, rho: &Fr) -> Fr;                  // Task 3 (public input [1]); never a call of its own (R12)
      pub(crate) fn commitment(&self, amount: u64, rho: &Fr) -> Fr;    // Task 3 (deposit commitment, changeCommitment)
  }
  // a0::field
  pub(crate) use ark_bn254::Fr;
  pub(crate) const TAG_CM, TAG_NULL, TAG_ADDR, TAG_RHO, TAG_NK, TAG_IVK: Fr;   // 0x10..0x15
  pub(crate) const MINT: [u8; 32];                                     // ERkpCFGa…PKCs
  pub(crate) fn mint_hash() -> Fr;                                     // Task 3 (public input mintHash)
  pub(crate) fn rho_change(nullifier: &Fr) -> Fr;                      // Task 3 (change note rho)
  pub(crate) fn poseidon<const N: usize>(inputs: &[Fr; N]) -> Fr;      // N in 1..=5, circomlib Poseidon(N)
  pub(crate) fn be_mod_order<F: PrimeField>(bytes: &[u8]) -> F;        // be_mod_r; Task 3: recipientField = be_mod_r(ata)
  pub(crate) fn fr_from_be32(bytes: &[u8; 32]) -> Option<Fr>;          // canonical or None (never reduces)
  pub(crate) fn fr_to_be32(v: &Fr) -> [u8; 32];
  // a0::eip2333
  pub(crate) const SPEND_PATH: [u32; 4];                               // [12381, 371, 1, 0]
  ```
- **What later tasks rely on:** Task 2 — `Inner` (adds `auth`), `Inner::end_session` as the one place to clear it (so `keys_open` / `keys_close` / poison invalidate the authorization with no further edit), `Core::lock`, `Inner::keys_for` (an authorization records the `Handle` and is refused for another). Task 3 — `Keys::{nk, d_self, nullifier, commitment}`, `field::{mint_hash, rho_change, be_mod_order, fr_from_be32, fr_to_be32, Fr}`; `nk()`, `d_self()` and `rho_change` carry `#[cfg_attr(not(test), expect(dead_code, …))]` today — **Task 3 must delete those three attributes when it uses them** (an `expect` that is no longer fulfilled is itself a warning, so clippy `-D warnings` forces the removal). Task 4 — `CORE` and the five `Core` methods are the whole Rust side of `keysOpen` / `keysClose` / `depositRho` / `matchSpent` / `commitment`; the JNI copies the `jbyteArray` into a `Zeroizing<Vec<u8>>` and passes `&mut` of it (it is wiped inside), converts a `jlong` deposit index with a refusal of negative values, and maps `A0Error`'s `Display` to the rejection message. Task 5 — the four new crates are pure Rust (Step 7's `readelf`), and Task 4 should re-run the check once `a0` is reachable from the exported JNI symbols (today the linker may drop it).

**The rule, stated once.** The seed comes in as bytes and is zero-filled before `keys_open` returns, whatever it returns. `sk` exists only inside `Keys::derive` and is wiped there. `nk`, `ivk`, `d_self` and `addrField(d_self)` live in one heap `Keys` behind one lock, are reachable only from crate code, and are wiped when the session ends — by `keys_close`, by the next `keys_open` (even a refused one), by dropping the state, or by a poisoned lock — and the wipe is observed by a test, not asserted by a comment. Outside the crate there are only a handle and values that are public once used: a deposit `rho`, a commitment, and the indices of own notes the chain has already spent. Every expected value in the tests comes from code that shares nothing with this crate.

- [ ] **Step 1: Add the four crates and lock them.**

Apply to `native/noctura-prover/Cargo.toml`:

```diff
diff --git a/native/noctura-prover/Cargo.toml b/native/noctura-prover/Cargo.toml
index a709889..d9fd861 100644
--- a/native/noctura-prover/Cargo.toml
+++ b/native/noctura-prover/Cargo.toml
@@ -38,6 +38,13 @@ fnv = "1"
 serde_json = "1"
 hex = "0.4"
 wasmi = "1.1.0"
+# A0 keys and field values (src/a0/) — all pure Rust, no C/C++ (the readelf gate).
+# light-poseidon 0.1.2 is the newest release that resolves here: 0.1.3+ require
+# num-bigint ^0.4.4, which ark-circom's `=0.4.3` pin forbids; 0.3+ are arkworks 0.5.
+light-poseidon = "=0.1.2"
+sha2 = "0.10"
+hkdf = "0.12"
+zeroize = "1"
 
 # Android JNI bridge (pure Rust — no C++, no libc++_shared).
 [target.'cfg(target_os = "android")'.dependencies]
```

**Why `=0.1.2`:** `light-poseidon` 0.1.3 and 0.2.0 require `num-bigint ^0.4.4`, which ark-circom's `num-bigint = "=0.4.3"` (rev 4d99060) forbids; 0.3+ are arkworks 0.5 / 0.6. From the crates.io index (`curl -s https://index.crates.io/li/gh/light-poseidon`): `0.1.2 [ark-bn254 ^0.4.0, ark-ff ^0.4.0, thiserror ^1.0]`, `0.1.3 [… num-bigint ^0.4.4 …]`, `0.2.0 [… num-bigint ^0.4.4 …]`, `0.3.0 [ark-bn254 ^0.5.0 …]`. `sha2 0.10.9`, `zeroize 1.9.0` and `hmac 0.12.1` are already in the lock (transitively); only `hkdf` and `light-poseidon` are new packages.

Then write the lock (from `native/noctura-prover`):

```bash
cargo fetch
git diff --stat Cargo.lock
```

Expected: ` native/noctura-prover/Cargo.lock | 24 ++++++++++++++++++++++++` — exactly this diff (the dry run checked that `cargo fetch` on the base lock reproduces it byte for byte):

```diff
diff --git a/native/noctura-prover/Cargo.lock b/native/noctura-prover/Cargo.lock
index c7b885b..9115e63 100644
--- a/native/noctura-prover/Cargo.lock
+++ b/native/noctura-prover/Cargo.lock
@@ -1201,6 +1201,15 @@ version = "0.4.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7f24254aa9a54b5c858eaee2f5bccdb46aaf0e486a595ed5fd8f86ba55232a70"
 
+[[package]]
+name = "hkdf"
+version = "0.12.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7b5f8eb2ad728638ea2c7d47a21db23b7b58a72ed6a38256b8a1849f15fbbdf7"
+dependencies = [
+ "hmac",
+]
+
 [[package]]
 name = "hmac"
 version = "0.12.1"
@@ -1437,6 +1446,17 @@ version = "0.2.16"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "b6d2cec3eae94f9f509c767b45932f1ada8350c4bdb85af2fcab4a3c14807981"
 
+[[package]]
+name = "light-poseidon"
+version = "0.1.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a5b439809cdfc0d86ecc7317f1724df13dfa665df48991b79e90e689411451f7"
+dependencies = [
+ "ark-bn254",
+ "ark-ff",
+ "thiserror",
+]
+
 [[package]]
 name = "linux-raw-sys"
 version = "0.4.15"
@@ -1548,11 +1568,15 @@ dependencies = [
  "ark-std",
  "fnv",
  "hex",
+ "hkdf",
  "jni",
+ "light-poseidon",
  "num-bigint",
  "num-traits",
  "serde_json",
+ "sha2",
  "wasmi",
+ "zeroize",
 ]
 
 [[package]]
```

- [ ] **Step 2: Write the offline vector generator and run it.**

Create `scripts/a0-vectors/gen-key-vectors.mjs`:

```js
#!/usr/bin/env node
/**
 * Offline generator of the A0 key and field vectors the Rust core is tested against
 * (spec 2026-11-08 shielded A0 M1 §3, §14; I-6).
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Every value in the fixture is computed here by
 * implementations that share no code with `native/noctura-prover`:
 *   - EIP-2333 (seed → sk at m/12381/371/1/0): `micro-key-producer/bls.js`, itself first held to
 *     the EIP's own four published test cases, copied below from the ERC text (a mismatch stops
 *     the script before anything is written);
 *   - Poseidon: `poseidon-lite`, through the app's own A0 equations
 *     (`src/modules/shielded/a0/fieldEquations.ts`, held to the circuit-validated golden vectors —
 *     re-checked below, one row of each equation, before anything is written);
 *   - SHA-512: `@noble/hashes`; BIP-39: `@scure/bip39`; base58: `@scure/base`.
 * Nothing here reads a Rust output, and the Rust code never writes this file.
 *
 * Run by hand from the repository root (Node 24, or Node ≥ 22.6 with --experimental-strip-types,
 * because the app's equations are TypeScript):
 *   node scripts/a0-vectors/gen-key-vectors.mjs           write the fixture
 *   node scripts/a0-vectors/gen-key-vectors.mjs --check   regenerate and compare, write nothing
 *
 * The seeds are public test material only (the repo's own test mnemonics and constant byte
 * strings) — never a real seed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveChild,
  deriveMaster,
  deriveSeedTree,
} from 'micro-key-producer/bls.js';
import { poseidon2, poseidon3 } from 'poseidon-lite';
import { sha512 } from '@noble/hashes/sha2.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { base58 } from '@scure/base';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(
  ROOT,
  'native/noctura-prover/tests/fixtures/a0-key-vectors.json',
);
const OUT_REL = relative(ROOT, OUT);
const GOLDEN = join(
  ROOT,
  'src/modules/shielded/a0/__tests__/golden-vectors.json',
);
const EQ = await import(
  join(ROOT, 'src/modules/shielded/a0/fieldEquations.ts')
);
const { TAG, FIELD_MODULUS: R } = EQ;

/** The shielded spend path — this script is the one place outside native that names it (I-6). */
const SPEND_PATH = 'm/12381/371/1/0';
/** The view path — a second path through the same tree, so a wrong index order cannot pass. */
const VIEW_PATH = 'm/12381/371/2/0';
/** The pinned devnet A0 pool mint (spec §1). */
const MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const D_SELF_DOMAIN = 'noctura/a0/self-d/v1';
const DEPOSIT_RHO_DOMAIN = 'noctura/a0/deposit-rho/v1';

const fail = msg => {
  console.error(`gen-key-vectors: ${msg}`);
  process.exit(1);
};
const hex = bytes => Buffer.from(bytes).toString('hex');
const be32 = v => {
  if (v < 0n || v >= R) {
    fail(`value outside the BN254 scalar field: ${v}`);
  }
  return v.toString(16).padStart(64, '0');
};
const os2ip = bytes => (bytes.length === 0 ? 0n : BigInt('0x' + hex(bytes)));
const u64be = i => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, i, false);
  return b;
};
const concat = (...parts) => Uint8Array.from(parts.flatMap(p => [...p]));
const fieldBytes = v => Uint8Array.from(Buffer.from(be32(v), 'hex'));

// ---- 1. bls.js against the EIP's own published cases (ERC text, ethereum/ERCs ERCS/erc-2333.md) ----
const EIP_SOURCE = {
  url: 'https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-2333.md',
  commit: 'be307c948f28897adb8f25afcc253c2c909de35d',
  sha256: '0c8ee48c99befe1a7dd491d2cdde1d9d70ff99ed84d940d9ca14dfe4b9016616',
};
const EIP_CASES = [
  {
    label: 'Test Case 0',
    seed: 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
    master:
      '6083874454709270928345386274498605044986640685124978867557563392430687146096',
    childIndex: 0,
    child:
      '20397789859736650942317412262472558107875392172444076792671091975210932703118',
    // From the EIP's "Test Vector with Intermediate values" section, copied, not re-derived here
    // (bls.js does not export parentSKToLamportPK); the Rust test checks its own intermediate.
    compressedLamportPK:
      'dd635d27d1d52b9a49df9e5c0c622360a4dd17cba7db4e89bce3cb048fb721a5',
  },
  {
    label: 'Test Case 1',
    seed: '3141592653589793238462643383279502884197169399375105820974944592',
    master:
      '29757020647961307431480504535336562678282505419141012933316116377660817309383',
    childIndex: 3141592653,
    child:
      '25457201688850691947727629385191704516744796114925897962676248250929345014287',
  },
  {
    label: 'Test Case 2',
    seed: '0099ff991111002299dd7744ee3355bbdd8844115566cc55663355668888cc00',
    master:
      '27580842291869792442942448775674722299803720648445448686099262467207037398656',
    childIndex: 4294967295,
    child:
      '29358610794459428860402234341874281240803786294062035874021252734817515685787',
  },
  {
    label: 'Test Case 3',
    seed: 'd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
    master:
      '19022158461524446591288038168518313374041767046816487870552872741050760015818',
    childIndex: 42,
    child:
      '31372231650479070279774297061823572166496564838472787488249775572789064611981',
  },
];
for (const c of EIP_CASES) {
  const master = deriveMaster(Buffer.from(c.seed, 'hex'));
  if (os2ip(master).toString() !== c.master) {
    fail(`bls.js deriveMaster disagrees with the EIP's ${c.label}`);
  }
  if (os2ip(deriveChild(master, c.childIndex)).toString() !== c.child) {
    fail(`bls.js deriveChild disagrees with the EIP's ${c.label}`);
  }
}
// The EIP's Test Case 0 seed is BIP-39 of the repo's test mnemonic under passphrase "TREZOR".
const ABANDON =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
if (hex(mnemonicToSeedSync(ABANDON, 'TREZOR')) !== EIP_CASES[0].seed) {
  fail(
    'BIP-39 of the test mnemonic + "TREZOR" is not the EIP Test Case 0 seed',
  );
}

// ---- 2. the app's equations against the circuit-validated golden vectors (every row) ----
const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')).vectors;
const g = (name, fn) => {
  for (const row of golden[name]) {
    if (fn(row.in).toString() !== row.out) {
      fail(
        `fieldEquations.${name} disagrees with golden-vectors.json "${row.label}"`,
      );
    }
  }
};
g('addrField', i => EQ.addrField(BigInt(i.nk), BigInt(i.d)));
g('commitment', i =>
  EQ.commitment({
    addrField: BigInt(i.addrField),
    amount: BigInt(i.amount),
    mintHash: BigInt(i.mintHash),
    rho: BigInt(i.rho),
  }),
);
g('nullifier', i => EQ.nullifier(BigInt(i.nk), BigInt(i.rho)));
g('rhoOut', i => EQ.rhoOut(BigInt(i.nullifierIn0), Number(i.index)));

// ---- 3. the wallet-only derivations (spec §3), from the frozen text ----
const mintBytes = base58.decode(MINT);
if (mintBytes.length !== 32) {
  fail('mint is not 32 bytes');
}
const mintHash = os2ip(mintBytes) % R; // be_mod_r(mint)

const SEEDS = [
  {
    label: 'repo test mnemonic (abandon … about), no passphrase',
    mnemonic: ABANDON,
    passphrase: '',
  },
  {
    label: 'repo second test mnemonic (zoo … wrong), no passphrase',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    passphrase: '',
  },
  {
    label: 'EIP-2333 Test Case 0 seed (abandon … about + "TREZOR")',
    mnemonic: ABANDON,
    passphrase: 'TREZOR',
  },
  { label: 'edge: 64 zero bytes', seedHex: '00'.repeat(64) },
  { label: 'edge: 64 0xff bytes', seedHex: 'ff'.repeat(64) },
];
const DEPOSIT_INDICES = [0n, 1n, 2n, 4294967296n, 18446744073709551615n];
const AMOUNTS = [0n, 1n, 1000000000n, 18446744073709551615n];

const seeds = SEEDS.map(s => {
  const seed = s.seedHex
    ? Uint8Array.from(Buffer.from(s.seedHex, 'hex'))
    : mnemonicToSeedSync(s.mnemonic, s.passphrase);
  const sk = deriveSeedTree(seed, SPEND_PATH);
  const skHi = os2ip(sk.slice(0, 16));
  const skLo = os2ip(sk.slice(16, 32));
  const nk = poseidon3([TAG.NK, skHi, skLo]);
  const ivk = poseidon2([TAG.IVK, nk]);
  const dSelf =
    os2ip(
      sha512(concat(new TextEncoder().encode(D_SELF_DOMAIN), fieldBytes(nk))),
    ) % R;
  const addrSelf = EQ.addrField(nk, dSelf);
  const notes = DEPOSIT_INDICES.map(i => {
    const rho =
      os2ip(
        sha512(
          concat(
            new TextEncoder().encode(DEPOSIT_RHO_DOMAIN),
            fieldBytes(nk),
            u64be(i),
          ),
        ),
      ) % R;
    const nf = EQ.nullifier(nk, rho);
    return {
      depositIndex: i.toString(),
      rho: be32(rho),
      nullifier: be32(nf),
      rhoChange: be32(EQ.rhoOut(nf, 0)),
      commitments: AMOUNTS.map(a => ({
        amount: a.toString(),
        commitment: be32(
          EQ.commitment({ addrField: addrSelf, amount: a, mintHash, rho }),
        ),
      })),
    };
  });
  return {
    label: s.label,
    ...(s.mnemonic ? { mnemonic: s.mnemonic, passphrase: s.passphrase } : {}),
    seed: hex(seed),
    sk: hex(sk),
    viewKey: hex(deriveSeedTree(seed, VIEW_PATH)),
    nk: be32(nk),
    ivk: be32(ivk),
    dSelf: be32(dSelf),
    addrSelf: be32(addrSelf),
    notes,
  };
});

const fixture = {
  schema: 'noctura.a0.key-vectors/1',
  _provenance:
    'Written by scripts/a0-vectors/gen-key-vectors.mjs from micro-key-producer/bls.js (EIP-2333, itself checked against the EIP cases below), poseidon-lite via src/modules/shielded/a0/fieldEquations.ts (checked against golden-vectors.json), @noble/hashes SHA-512, @scure/bip39 and @scure/base. No Rust output is read. Rerun: node scripts/a0-vectors/gen-key-vectors.mjs [--check].',
  _byteOrder:
    'Every field value is 32-byte BIG-ENDIAN hex, unprefixed, zero-padded, canonical (< r). sk is the 32-byte EIP-2333 I2OSP output. Amounts and indices are decimal strings.',
  equations: {
    sk: `EIP-2333 at ${SPEND_PATH} from the BIP-39 seed`,
    viewKey: `EIP-2333 at ${VIEW_PATH} from the BIP-39 seed (a path check only; not used by A0 M1)`,
    nk: 'Poseidon3(TAG_NK = 0x14, sk_hi, sk_lo); sk_hi = OS2IP(sk[0..16]), sk_lo = OS2IP(sk[16..32])',
    ivk: 'Poseidon2(TAG_IVK = 0x15, nk)',
    dSelf: `be_mod_r(SHA-512("${D_SELF_DOMAIN}" || be32(nk)))`,
    addrSelf: 'Poseidon3(TAG_ADDR = 0x12, nk, dSelf)',
    mintHash: 'be_mod_r(mint as 32 bytes)',
    rho: `be_mod_r(SHA-512("${DEPOSIT_RHO_DOMAIN}" || be32(nk) || u64be(depositIndex)))`,
    nullifier: 'Poseidon3(TAG_NULL = 0x11, nk, rho)',
    rhoChange: 'Poseidon3(TAG_RHO = 0x13, nullifier, 0)',
    commitment: 'Poseidon5(TAG_CM = 0x10, addrSelf, amount, mintHash, rho)',
  },
  constants: {
    spendPath: SPEND_PATH,
    viewPath: VIEW_PATH,
    fieldModulus: R.toString(),
    mint: MINT,
    mintBytes: hex(mintBytes),
    mintHash: be32(mintHash),
    dSelfDomain: D_SELF_DOMAIN,
    depositRhoDomain: DEPOSIT_RHO_DOMAIN,
  },
  eip2333: { source: EIP_SOURCE, cases: EIP_CASES },
  seeds,
};

const text = JSON.stringify(fixture, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== text) {
    fail(
      `${OUT_REL} differs from a fresh run — regenerate it and review the diff`,
    );
  }
  console.log(
    `gen-key-vectors: ${OUT_REL} matches a fresh run (${seeds.length} seeds, ${EIP_CASES.length} EIP cases)`,
  );
} else {
  writeFileSync(OUT, text);
  console.log(
    `gen-key-vectors: wrote ${OUT_REL} (${seeds.length} seeds, ${EIP_CASES.length} EIP cases)`,
  );
}
```

Run it from the repository root (Node 24.10 in the dry run; on Node 22 add `--experimental-strip-types` — it imports the app's TypeScript equations), then the `--check` mode:

```bash
mkdir -p native/noctura-prover/tests/fixtures
node scripts/a0-vectors/gen-key-vectors.mjs 2>/dev/null
node scripts/a0-vectors/gen-key-vectors.mjs --check 2>/dev/null; echo $?
sha256sum native/noctura-prover/tests/fixtures/a0-key-vectors.json
```

Expected (stderr carries only Node's `MODULE_TYPELESS_PACKAGE_JSON` warning about the `.ts` import):

```
gen-key-vectors: wrote native/noctura-prover/tests/fixtures/a0-key-vectors.json (5 seeds, 4 EIP cases)
gen-key-vectors: native/noctura-prover/tests/fixtures/a0-key-vectors.json matches a fresh run (5 seeds, 4 EIP cases)
0
0ccc2eae0ac067c98b056db0f0053728b09d8749b51f8fdf98832abe15685047  native/noctura-prover/tests/fixtures/a0-key-vectors.json
```

The fixture is deterministic (no randomness, no clock), so the digest must match. Spot values for the repo's test seed (`abandon … about`, no passphrase), to compare by eye: `sk` `3ffaa65f057573ad70a1ff0d50ddae9d6948b3d5714aad08e447a99f0fdcf921`, `viewKey` `30171f354d910bcd87d1a0573900419e17e04c1015c4aa6ea127be66fdccd6dc` (= the vector `src/modules/keyDerivation/__tests__/shielded.test.ts` already pins for `m/12381/371/2/0` — a third, older agreement), `nk` `22ca14c21f6dabfd352911586cb04f1ac4c64aa45a952634e68a4a8711f7ebf9`, `dSelf` `00ea430a7eb70d922124512aae98af0b731c8cfa0bb62ce7a9a27993d15ce574` (a leading zero byte — the 32-byte padding is exercised), `rho(0)` `12d576a44d29fa15379dfda30a5cce14c828f6a2d2789d9a0730c47f62d7518e`; `mintHash` `05ee2f1a32b56046bcfab53bb4ac502bdc7689c4e2a8446db77130db7fccdca4` (the mint bytes `c77f68e5…` are above r, so the reduction is exercised).

Negative controls on the generator (each in a scratch copy, `git archive HEAD | tar -x -C <dir>` + the `node_modules` symlink), measured:
- one digit of the EIP's Test Case 2 `master` changed (`…398656` → `…398657`): `gen-key-vectors: bls.js deriveMaster disagrees with the EIP's Test Case 2`, exit 1, nothing written;
- one hex digit of the first seed's `nk` in the fixture changed: `--check` → `gen-key-vectors: native/noctura-prover/tests/fixtures/a0-key-vectors.json differs from a fresh run — regenerate it and review the diff`, exit 1; and `cargo test --lib a0::` → `keys_match_the_offline_vectors_for_every_fixture_seed ... FAILED`, `27 passed; 1 failed`.

- [ ] **Step 3: Write the failing tests.**

Create `native/noctura-prover/src/a0/tests.rs`:

```rust
//! A0 keys and field values against vectors this crate did not produce (spec §3, §14):
//! - `tests/fixtures/a0-key-vectors.json`, written OFFLINE by `scripts/a0-vectors/gen-key-vectors.mjs`
//!   from micro-key-producer/bls.js, poseidon-lite (via the app's `fieldEquations.ts`) and
//!   @noble/hashes — rerun `node scripts/a0-vectors/gen-key-vectors.mjs --check` to confirm it;
//! - the EIP-2333 published cases (copied into that fixture from the ERC text, with its commit);
//! - `src/modules/shielded/a0/__tests__/golden-vectors.json`, the program side's circuit-validated
//!   Poseidon rows (read in place, never copied).
//!
//! Nothing here computes an expected value with the code under test.

use super::eip2333::{self, SPEND_PATH};
use super::field::{
    self, fr_from_be32, fr_to_be32, mint_hash, poseidon, rho_change, Fr, MINT, TAG_ADDR, TAG_CM,
    TAG_NULL, TAG_RHO,
};
use super::keys::Keys;
use super::state::{A0Error, Core, Handle};
use super::wipe_probe;
use ark_ff::{BigInteger, PrimeField, Zero};
use num_bigint::BigUint;
use serde_json::Value;
use zeroize::Zeroizing;

const KEY_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-key-vectors.json"
));
const GOLDEN: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../src/modules/shielded/a0/__tests__/golden-vectors.json"
));
const VIEW_PATH: [u32; 4] = [12381, 371, 2, 0];

fn vectors() -> Value {
    serde_json::from_str(KEY_VECTORS).unwrap()
}
fn golden() -> Value {
    serde_json::from_str(GOLDEN).unwrap()
}
fn s(v: &Value) -> &str {
    v.as_str().unwrap()
}
fn bytes(v: &Value) -> Vec<u8> {
    hex::decode(s(v)).unwrap()
}
fn b32(v: &Value) -> [u8; 32] {
    bytes(v).try_into().unwrap()
}
fn dec_fr(v: &Value) -> Fr {
    let n: BigUint = s(v).parse().unwrap();
    Fr::from_be_bytes_mod_order(&n.to_bytes_be())
}
fn hex_fr(v: &Value) -> Fr {
    fr_from_be32(&b32(v)).expect("fixture value is canonical")
}
fn decimal(be: &[u8]) -> String {
    BigUint::from_bytes_be(be).to_string()
}
fn seeds() -> Vec<Value> {
    vectors()["seeds"].as_array().unwrap().clone()
}
fn seed64(v: &Value) -> [u8; 64] {
    bytes(&v["seed"]).try_into().unwrap()
}
fn open(core: &Core, v: &Value) -> Handle {
    let mut seed = seed64(v);
    core.keys_open(&mut seed).unwrap()
}

// ---------------------------------------------------------------- EIP-2333

#[test]
fn eip2333_master_and_child_match_the_eips_published_cases() {
    let cases = vectors()["eip2333"]["cases"].as_array().unwrap().clone();
    assert_eq!(cases.len(), 4, "the EIP publishes four cases");
    for c in &cases {
        let master = eip2333::derive_master(&bytes(&c["seed"])).unwrap();
        assert_eq!(
            decimal(&master[..]),
            s(&c["master"]),
            "{} master",
            c["label"]
        );
        let index = u32::try_from(c["childIndex"].as_u64().unwrap()).unwrap();
        let child = eip2333::derive_child(&master, index);
        assert_eq!(decimal(&child[..]), s(&c["child"]), "{} child", c["label"]);
    }
}

#[test]
fn eip2333_case0_intermediate_compressed_lamport_pk_matches_the_eip() {
    let c = &vectors()["eip2333"]["cases"][0];
    let master = eip2333::derive_master(&bytes(&c["seed"])).unwrap();
    let pk = eip2333::parent_sk_to_lamport_pk(&master, 0);
    assert_eq!(hex::encode(&pk[..]), s(&c["compressedLamportPK"]));
}

#[test]
fn eip2333_refuses_a_seed_shorter_than_256_bits() {
    assert!(eip2333::derive_master(&[7u8; 31]).is_none());
    assert!(eip2333::derive_master(&[7u8; 32]).is_some());
}

#[test]
fn spend_and_view_paths_match_bls_js_for_every_fixture_seed() {
    assert_eq!(SPEND_PATH, [12381, 371, 1, 0]);
    assert_eq!(s(&vectors()["constants"]["spendPath"]), "m/12381/371/1/0");
    for v in seeds() {
        let seed = seed64(&v);
        let sk = eip2333::derive_path(&seed, &SPEND_PATH).unwrap();
        assert_eq!(hex::encode(&sk[..]), s(&v["sk"]), "sk for {}", v["label"]);
        let view = eip2333::derive_path(&seed, &VIEW_PATH).unwrap();
        assert_eq!(
            hex::encode(&view[..]),
            s(&v["viewKey"]),
            "view for {}",
            v["label"]
        );
        assert_ne!(sk[..], view[..]);
    }
}

// ---------------------------------------------------------------- Poseidon and field encoding

#[test]
fn poseidon_matches_the_circuit_validated_golden_rows() {
    let g = golden();
    let v = &g["vectors"];
    let mut rows = 0;
    for r in v["addrField"].as_array().unwrap() {
        let out = poseidon(&[TAG_ADDR, dec_fr(&r["in"]["nk"]), dec_fr(&r["in"]["d"])]);
        assert_eq!(out, dec_fr(&r["out"]), "addrField {}", r["label"]);
        assert_eq!(hex::encode(fr_to_be32(&out)), s(&r["outHexBE32"]));
        rows += 1;
    }
    for r in v["commitment"].as_array().unwrap() {
        let i = &r["in"];
        let out = poseidon(&[
            TAG_CM,
            dec_fr(&i["addrField"]),
            dec_fr(&i["amount"]),
            dec_fr(&i["mintHash"]),
            dec_fr(&i["rho"]),
        ]);
        assert_eq!(out, dec_fr(&r["out"]), "commitment {}", r["label"]);
        rows += 1;
    }
    for r in v["nullifier"].as_array().unwrap() {
        let out = poseidon(&[TAG_NULL, dec_fr(&r["in"]["nk"]), dec_fr(&r["in"]["rho"])]);
        assert_eq!(out, dec_fr(&r["out"]), "nullifier {}", r["label"]);
        rows += 1;
    }
    for r in v["rhoOut"].as_array().unwrap() {
        let j = Fr::from(r["in"]["index"].as_u64().unwrap());
        let out = poseidon(&[TAG_RHO, dec_fr(&r["in"]["nullifierIn0"]), j]);
        assert_eq!(out, dec_fr(&r["out"]), "rhoOut {}", r["label"]);
        rows += 1;
    }
    let pair = &v["merkleNode"][0];
    let leaf = dec_fr(&pair["in"]["left"]);
    let out = poseidon(&[leaf, dec_fr(&pair["in"]["right"])]);
    assert_eq!(out, dec_fr(&pair["out"]), "merkleNode {}", pair["label"]);
    rows += 1;
    // the second row is a fold: the leaf above with Z[i], i = 0..19, Z[0] = 0, Z[i] = P2(Z[i-1], Z[i-1])
    let fold = &v["merkleNode"][1];
    assert_eq!(s(&fold["label"]), "fold_root_depth20_leaf_at_index0");
    let (mut acc, mut z) = (leaf, Fr::zero());
    for _ in 0..20 {
        acc = poseidon(&[acc, z]);
        z = poseidon(&[z, z]);
    }
    assert_eq!(acc, dec_fr(&fold["out"]), "the depth-20 fold");
    rows += 1;
    assert_eq!(v["merkleNode"].as_array().unwrap().len(), 2);
    assert_eq!(rows, 13, "every golden row was compared");
}

#[test]
fn poseidon_equals_light_poseidons_own_hasher_over_the_same_constants() {
    use light_poseidon::{Poseidon, PoseidonHasher};
    let inputs: Vec<Fr> = (1u64..=5).map(|i| Fr::from(i * 0x1234_5678_9abc)).collect();
    let mut h2 = Poseidon::<Fr>::new_circom(2).unwrap();
    assert_eq!(
        poseidon(&[inputs[0], inputs[1]]),
        h2.hash(&inputs[..2]).unwrap()
    );
    let mut h3 = Poseidon::<Fr>::new_circom(3).unwrap();
    assert_eq!(
        poseidon(&[inputs[0], inputs[1], inputs[2]]),
        h3.hash(&inputs[..3]).unwrap()
    );
    let mut h5 = Poseidon::<Fr>::new_circom(5).unwrap();
    assert_eq!(
        poseidon(&[inputs[0], inputs[1], inputs[2], inputs[3], inputs[4]]),
        h5.hash(&inputs[..5]).unwrap()
    );
}

#[test]
fn the_pinned_mint_and_its_hash_match_the_fixture() {
    let c = &vectors()["constants"];
    assert_eq!(
        s(&c["mint"]),
        "ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs"
    );
    assert_eq!(hex::encode(MINT), s(&c["mintBytes"]));
    assert_eq!(hex::encode(fr_to_be32(&mint_hash())), s(&c["mintHash"]));
    // the mint is above r, so the reduction is exercised, not skipped
    assert_ne!(hex::encode(MINT), s(&c["mintHash"]));
    assert_eq!(
        Fr::MODULUS.to_bytes_be(),
        BigUint::parse_bytes(s(&c["fieldModulus"]).as_bytes(), 10)
            .unwrap()
            .to_bytes_be()
    );
}

#[test]
fn field_bytes_are_canonical_big_endian() {
    let r_be: [u8; 32] = Fr::MODULUS.to_bytes_be().try_into().unwrap();
    assert!(fr_from_be32(&r_be).is_none(), "r itself is refused");
    let mut r_minus_1 = r_be;
    r_minus_1[31] -= 1;
    let top = fr_from_be32(&r_minus_1).expect("r - 1 is canonical");
    assert_eq!(fr_to_be32(&top), r_minus_1);
    assert!(fr_from_be32(&[0xff; 32]).is_none());
    let mut one = [0u8; 32];
    one[31] = 1;
    assert_eq!(
        fr_from_be32(&one),
        Some(Fr::from(1u64)),
        "big-endian, not little"
    );
    assert_eq!(fr_to_be32(&Fr::zero()), [0u8; 32]);
}

#[test]
fn be_mod_r_reduces_64_bytes_like_bigint_arithmetic() {
    // negative control on the reduction itself: an all-0xff 512-bit input
    let input = [0xffu8; 64];
    let want = BigUint::from_bytes_be(&input) % BigUint::from_bytes_be(&Fr::MODULUS.to_bytes_be());
    let got: Fr = field::be_mod_order(&input);
    assert_eq!(BigUint::from_bytes_be(&fr_to_be32(&got)), want);
}

// ---------------------------------------------------------------- wallet-only derivations (§3)

#[test]
fn keys_match_the_offline_vectors_for_every_fixture_seed() {
    let all = seeds();
    assert_eq!(all.len(), 5);
    let mut notes = 0;
    for v in &all {
        let mut seed = Zeroizing::new(seed64(v));
        let keys = Keys::derive(&mut seed[..]).unwrap();
        let label = &v["label"];
        assert_eq!(*keys.nk(), hex_fr(&v["nk"]), "nk {label}");
        assert_eq!(*keys.ivk(), hex_fr(&v["ivk"]), "ivk {label}");
        assert_eq!(*keys.d_self(), hex_fr(&v["dSelf"]), "d_self {label}");
        assert_eq!(
            *keys.addr_self(),
            hex_fr(&v["addrSelf"]),
            "addrField(d_self) {label}"
        );
        for n in v["notes"].as_array().unwrap() {
            let i: u64 = s(&n["depositIndex"]).parse().unwrap();
            let rho = keys.deposit_rho(i);
            assert_eq!(fr_to_be32(&rho), b32(&n["rho"]), "rho({i}) {label}");
            let nf = keys.nullifier(&rho);
            assert_eq!(fr_to_be32(&nf), b32(&n["nullifier"]), "nullifier {label}");
            assert_eq!(fr_to_be32(&rho_change(&nf)), b32(&n["rhoChange"]));
            for c in n["commitments"].as_array().unwrap() {
                let amount: u64 = s(&c["amount"]).parse().unwrap();
                let cm = keys.commitment(amount, &rho);
                assert_eq!(
                    fr_to_be32(&cm),
                    b32(&c["commitment"]),
                    "cm {label} {amount}"
                );
            }
            notes += 1;
        }
    }
    assert_eq!(notes, 25, "5 seeds x 5 deposit indices");
}

#[test]
fn keys_derive_wipes_the_seed_and_refuses_a_non_64_byte_seed() {
    let v = &seeds()[0];
    let mut seed = seed64(v);
    let _keys = Keys::derive(&mut seed[..]).unwrap();
    assert_eq!(seed, [0u8; 64], "seed wiped once sk is derived");
    let mut short = [9u8; 63];
    assert!(matches!(
        Keys::derive(&mut short[..]),
        Err(A0Error::SeedLength { got: 63 })
    ));
    assert_eq!(short, [0u8; 63], "a refused seed is wiped too");
}

// ---------------------------------------------------------------- the state and its handle

#[test]
fn core_open_returns_public_values_equal_to_the_vectors() {
    let core = Core::new();
    let v = &seeds()[0];
    let h = open(&core, v);
    let n = &v["notes"][1];
    assert_eq!(core.deposit_rho(h, 1).unwrap(), b32(&n["rho"]));
    let c = &n["commitments"][2];
    let amount: u64 = s(&c["amount"]).parse().unwrap();
    assert_eq!(
        core.commitment(h, amount, &b32(&n["rho"])).unwrap(),
        b32(&c["commitment"])
    );
}

#[test]
fn core_open_wipes_the_callers_seed_even_when_it_refuses_it() {
    let core = Core::new();
    let mut seed = seed64(&seeds()[0]);
    core.keys_open(&mut seed).unwrap();
    assert_eq!(seed, [0u8; 64]);
    let mut long = [3u8; 65];
    assert!(matches!(
        core.keys_open(&mut long),
        Err(A0Error::SeedLength { got: 65 })
    ));
    assert_eq!(long, [0u8; 65]);
}

#[test]
fn handles_are_never_zero_and_never_repeat() {
    let core = Core::new();
    let v = &seeds()[0];
    let mut seen = std::collections::HashSet::new();
    for _ in 0..5 {
        let h = open(&core, v);
        assert_ne!(h.raw(), 0);
        assert!(seen.insert(h.raw()), "handle reused");
    }
}

#[test]
fn close_invalidates_the_handle() {
    let core = Core::new();
    let h = open(&core, &seeds()[0]);
    core.keys_close(h).unwrap();
    assert!(matches!(
        core.deposit_rho(h, 0),
        Err(A0Error::UnknownHandle)
    ));
    assert!(matches!(
        core.commitment(h, 1, &[0u8; 32]),
        Err(A0Error::UnknownHandle)
    ));
    assert!(matches!(
        core.match_spent(h, &[], &[]),
        Err(A0Error::UnknownHandle)
    ));
    assert!(matches!(core.keys_close(h), Err(A0Error::UnknownHandle)));
}

#[test]
fn a_second_open_replaces_the_first() {
    let core = Core::new();
    let a = seeds()[0].clone();
    let b = seeds()[1].clone();
    let ha = open(&core, &a);
    let hb = open(&core, &b);
    assert!(matches!(
        core.deposit_rho(ha, 0),
        Err(A0Error::UnknownHandle)
    ));
    assert_eq!(core.deposit_rho(hb, 0).unwrap(), b32(&b["notes"][0]["rho"]));
    // closing with the stale handle neither succeeds nor closes the live session
    assert!(matches!(core.keys_close(ha), Err(A0Error::UnknownHandle)));
    assert!(core.deposit_rho(hb, 0).is_ok());
}

#[test]
fn a_refused_open_still_ends_the_previous_session() {
    let core = Core::new();
    let h = open(&core, &seeds()[0]);
    let mut bad = [1u8; 10];
    assert!(core.keys_open(&mut bad).is_err());
    assert!(matches!(
        core.deposit_rho(h, 0),
        Err(A0Error::UnknownHandle)
    ));
}

#[test]
fn a_handle_from_another_core_is_unknown() {
    let one = Core::new();
    let two = Core::new();
    let h = open(&one, &seeds()[0]);
    let h2 = open(&two, &seeds()[0]);
    assert_ne!(h, h2);
    assert!(matches!(two.deposit_rho(h, 0), Err(A0Error::UnknownHandle)));
    assert!(matches!(
        one.deposit_rho(h2, 0),
        Err(A0Error::UnknownHandle)
    ));
    assert!(matches!(
        Core::new().deposit_rho(Handle::from_raw(0), 0),
        Err(A0Error::UnknownHandle)
    ));
}

#[test]
fn commitment_refuses_a_non_canonical_rho() {
    let core = Core::new();
    let h = open(&core, &seeds()[0]);
    let r_be: [u8; 32] = Fr::MODULUS.to_bytes_be().try_into().unwrap();
    assert!(matches!(
        core.commitment(h, 1, &r_be),
        Err(A0Error::NonCanonical { what: "rho", .. })
    ));
}

// ---------------------------------------------------------------- matchSpent (R12)

fn nf(v: &Value, k: usize) -> [u8; 32] {
    b32(&v["notes"][k]["nullifier"])
}
fn rho(v: &Value, k: usize) -> [u8; 32] {
    b32(&v["notes"][k]["rho"])
}

#[test]
fn match_spent_returns_ascending_own_indices_whose_nullifier_is_on_chain() {
    let core = Core::new();
    let me = seeds()[0].clone();
    let other = seeds()[1].clone();
    let h = open(&core, &me);
    let own = [rho(&me, 0), rho(&me, 1), rho(&me, 2), rho(&me, 3)];
    // chain order differs from own order, carries another seed's nullifier and a duplicate
    let chain = [nf(&me, 3), nf(&other, 0), nf(&me, 0), nf(&me, 3)];
    assert_eq!(core.match_spent(h, &chain, &own).unwrap(), vec![0, 3]);
}

#[test]
fn match_spent_negative_controls() {
    let core = Core::new();
    let me = seeds()[0].clone();
    let other = seeds()[1].clone();
    let h = open(&core, &me);
    let own = [rho(&me, 0), rho(&me, 1)];
    assert!(core.match_spent(h, &[], &own).unwrap().is_empty());
    assert!(core.match_spent(h, &[nf(&me, 0)], &[]).unwrap().is_empty());
    // another seed's notes with the same rho values: their nullifiers are not ours
    assert!(core
        .match_spent(h, &[nf(&other, 0), nf(&other, 1)], &own)
        .unwrap()
        .is_empty());
    // a rho itself on the chain list does not match (it is the nullifier that counts)
    assert!(core.match_spent(h, &own, &own).unwrap().is_empty());
}

#[test]
fn match_spent_refuses_duplicate_own_rhos_and_non_canonical_values() {
    let core = Core::new();
    let me = seeds()[0].clone();
    let h = open(&core, &me);
    assert!(matches!(
        core.match_spent(h, &[], &[rho(&me, 0), rho(&me, 1), rho(&me, 0)]),
        Err(A0Error::DuplicateRho { index: 2 })
    ));
    let r_be: [u8; 32] = Fr::MODULUS.to_bytes_be().try_into().unwrap();
    assert!(matches!(
        core.match_spent(h, &[nf(&me, 0), r_be], &[rho(&me, 0)]),
        Err(A0Error::NonCanonical {
            what: "chainNullifier",
            index: 1
        })
    ));
    assert!(matches!(
        core.match_spent(h, &[], &[rho(&me, 0), r_be]),
        Err(A0Error::NonCanonical {
            what: "ownRho",
            index: 1
        })
    ));
}

// ---------------------------------------------------------------- zeroization (INV-NK)
// The probe copies a value's bytes at the moment its wipe has run (inside Drop, before the memory is
// freed) — a real read, not a promise. A mutant that skips the wipe leaves non-zero bytes here.

fn probe_all_zero(label: &str) -> usize {
    let seen = wipe_probe::take(label);
    for bytes in &seen {
        assert!(
            bytes.iter().all(|b| *b == 0),
            "{label} not wiped: {bytes:?}"
        );
        assert!(!bytes.is_empty());
    }
    seen.len()
}

#[test]
fn keys_are_wiped_on_close() {
    let core = Core::new();
    let h = open(&core, &seeds()[0]);
    wipe_probe::take("keys");
    core.keys_close(h).unwrap();
    assert_eq!(
        probe_all_zero("keys"),
        1,
        "exactly the closed keys were dropped"
    );
}

#[test]
fn keys_are_wiped_on_replacement() {
    let core = Core::new();
    open(&core, &seeds()[0]);
    wipe_probe::take("keys");
    open(&core, &seeds()[1]);
    assert_eq!(probe_all_zero("keys"), 1, "the replaced keys were dropped");
}

#[test]
fn keys_are_wiped_when_the_state_is_dropped() {
    let core = Core::new();
    open(&core, &seeds()[0]);
    wipe_probe::take("keys");
    drop(core);
    assert_eq!(probe_all_zero("keys"), 1);
}

#[test]
fn keys_are_wiped_when_the_state_is_poisoned() {
    let core = std::sync::Arc::new(Core::new());
    let h = open(&core, &seeds()[0]);
    wipe_probe::take("keys");
    let c = core.clone();
    let _ = std::thread::spawn(move || c.poison_for_test()).join();
    assert!(matches!(
        core.deposit_rho(h, 0),
        Err(A0Error::StatePoisoned)
    ));
    assert_eq!(probe_all_zero("keys"), 1, "poison wipes the keys");
    let mut seed = seed64(&seeds()[0]);
    assert!(matches!(
        core.keys_open(&mut seed),
        Err(A0Error::StatePoisoned)
    ));
    assert_eq!(seed, [0u8; 64], "a refused seed is wiped");
}

#[test]
fn the_probe_sees_live_bytes_positive_control() {
    // Without this, an all-zero probe could mean the probe reads the wrong memory.
    let mut seed = seed64(&seeds()[0]);
    let keys = Keys::derive(&mut seed[..]).unwrap();
    let live = keys.probe_bytes_for_test();
    assert!(
        live.iter().any(|b| *b != 0),
        "live keys are visible to the probe"
    );
    wipe_probe::take("keys");
    drop(keys);
    assert_eq!(probe_all_zero("keys"), 1);
}

#[test]
fn poseidon_wipes_its_state() {
    wipe_probe::take("poseidon");
    let _ = poseidon(&[Fr::from(1u64), Fr::from(2u64), Fr::from(3u64)]);
    assert_eq!(probe_all_zero("poseidon"), 1);
}
```

Create `native/noctura-prover/src/a0/mod.rs` with only the test module for now:

```rust
#[cfg(test)]
mod tests;
```

Apply to `native/noctura-prover/src/lib.rs`:

```diff
diff --git a/native/noctura-prover/src/lib.rs b/native/noctura-prover/src/lib.rs
index da631dd..c0fde5d 100644
--- a/native/noctura-prover/src/lib.rs
+++ b/native/noctura-prover/src/lib.rs
@@ -3,6 +3,7 @@
 
 pub use ark_circom;
 
+pub mod a0;
 pub mod proof_bytes;
 pub mod prover;
 pub mod witness_wasmi;
```

The existing integration test reads the v1 deposit artifacts from `native/noctura-prover/artifacts/` (gitignored); for a local run link or download them as CI does (the dry run linked the main checkout's `deposit_final.zkey` `f11fec50…a821` and `deposit.wasm` `b05ef3f3…2984`, the digests `src/constants/provingAssets.ts` pins).

- [ ] **Step 4: Run the tests — red, for the right reason.**

```bash
cd native/noctura-prover && cargo test --locked 2>&1 | grep -E "^error|^warning: unused|could not compile" | sort | uniq -c
```

Expected:

```
      1 error: could not compile `noctura-prover` (lib test) due to 5 previous errors; 1 warning emitted
      1 error[E0432]: unresolved imports `super::eip2333`, `super::eip2333`
      1 error[E0432]: unresolved imports `super::field`, `super::field`
      1 error[E0432]: unresolved import `super::keys`
      1 error[E0432]: unresolved import `super::state`
      1 error[E0432]: unresolved import `super::wipe_probe`
      1 warning: unused imports: `PrimeField` and `Zero`
```

Every error is a module this task creates; nothing else fails to resolve (the four crates and the fixture are in place).

- [ ] **Step 5: Implement.**

Replace `native/noctura-prover/src/a0/mod.rs` with:

```rust
//! A0 shielded keys and field values (spec 2026-11-08 shielded A0 M1 §3): EIP-2333 `sk`, `nk`,
//! `ivk`, `d_self`, `addrField`, `mintHash`, commitments, deposit `rho(i)`, the internal
//! nullifier, `rho_change`, `matchSpent`, and the one `Mutex` state that holds them.
//!
//! The public surface is [`state`]'s [`Core`] / [`Handle`] / [`A0Error`]: it takes a seed and
//! returns only values that are public once used (a deposit `rho`, a commitment, the indices of
//! spent own notes). Every secret lives in the crate-private `keys` module.

mod eip2333;
mod field;
mod keys;
pub mod state;

pub use state::{A0Error, Core, Handle, CORE};

#[cfg(test)]
mod tests;
#[cfg(test)]
mod wipe_probe;
```

Create `native/noctura-prover/src/a0/eip2333.rs`:

```rust
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
```

Create `native/noctura-prover/src/a0/field.rs`:

```rust
//! A0 field values over the BN254 scalar field (spec §1.4a of the freeze, §3 of the M1 spec):
//! domain tags, the canonical 32-byte big-endian encoding, `be_mod_r`, the pinned mint and its
//! `mintHash`, the circomlib-compatible Poseidon, and the key-free equations (`rho_change`).
//!
//! Poseidon: the permutation is this crate's own (so its state is a fixed array that is wiped —
//! light-poseidon's `hash` reallocates its state `Vec` every round and frees it unwiped, and
//! Poseidon is a permutation, so a final state left in freed memory inverts to the inputs, `sk`
//! among them). The CONSTANTS are light-poseidon 0.1.2's `parameters::bn254_x5` (round constants
//! and MDS for x^5, 8 full rounds, the circomlib partial-round counts) — the parameter set
//! circomlib's `poseidon.circom` uses. The tests hold the result to the circuit-validated golden
//! rows, to poseidon-lite (the offline fixture) and to light-poseidon's own hasher.

use ark_ff::{BigInteger256, Field, PrimeField, Zero};
use light_poseidon::parameters::bn254_x5::get_poseidon_parameters;
use light_poseidon::PoseidonParameters;
use std::sync::OnceLock;
use zeroize::Zeroize;

pub(crate) use ark_bn254::Fr;

/// Domain tags (A0 freeze §1.4a). 0x01–0x0F are the old scheme, burned.
pub(crate) const TAG_CM: Fr = ark_ff::MontFp!("16");
pub(crate) const TAG_NULL: Fr = ark_ff::MontFp!("17");
pub(crate) const TAG_ADDR: Fr = ark_ff::MontFp!("18");
pub(crate) const TAG_RHO: Fr = ark_ff::MontFp!("19");
pub(crate) const TAG_NK: Fr = ark_ff::MontFp!("20");
pub(crate) const TAG_IVK: Fr = ark_ff::MontFp!("21");

/// The devnet A0 pool's mint `ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs` as its 32 bytes
/// (spec §1, R3). The test compares these bytes with the fixture's own base58 decode.
pub(crate) const MINT: [u8; 32] = [
    0xc7, 0x7f, 0x68, 0xe5, 0xb7, 0x7b, 0xe0, 0xed, 0x9e, 0x3b, 0xcc, 0x15, 0xba, 0xb1, 0xb1, 0xa0,
    0x7d, 0x46, 0x2a, 0xe6, 0xc9, 0x8e, 0x06, 0xb2, 0xc6, 0xf9, 0x07, 0x2b, 0x3f, 0xcc, 0xdc, 0xa8,
];

/// Big-endian bytes reduced modulo the field order — `be_mod_r` (spec §3; the program's
/// `be_mod_f` is the same reduction). Horner over the bytes: no heap, any length.
pub(crate) fn be_mod_order<F: PrimeField>(bytes: &[u8]) -> F {
    let base = F::from(256u64);
    let mut acc = F::zero();
    for &b in bytes {
        acc = acc * base + F::from(u64::from(b));
    }
    acc
}

/// The canonical encoding: 32 bytes big-endian, value < r. `None` for a non-canonical input
/// (never silently reduced — a reduced value would hash to one the circuit never sees).
pub(crate) fn fr_from_be32(bytes: &[u8; 32]) -> Option<Fr> {
    let mut limbs = [0u64; 4];
    for (i, limb) in limbs.iter_mut().enumerate() {
        let start = 32 - 8 * (i + 1);
        let mut word = [0u8; 8];
        word.copy_from_slice(&bytes[start..start + 8]);
        *limb = u64::from_be_bytes(word);
    }
    let v = Fr::from_bigint(BigInteger256::new(limbs));
    limbs.zeroize();
    v
}

/// 32 bytes big-endian of a field element.
pub(crate) fn fr_to_be32(v: &Fr) -> [u8; 32] {
    let mut limbs = v.into_bigint().0;
    let mut out = [0u8; 32];
    for (i, limb) in limbs.iter().enumerate() {
        let start = 32 - 8 * (i + 1);
        out[start..start + 8].copy_from_slice(&limb.to_be_bytes());
    }
    limbs.zeroize();
    out
}

/// `mintHash = be_mod_r(mint)` of the pinned mint.
pub(crate) fn mint_hash() -> Fr {
    be_mod_order(&MINT)
}

/// The largest arity A0 uses (Poseidon5, the commitment) → width 6.
const MAX_WIDTH: usize = 6;

fn parameters(width: usize) -> &'static PoseidonParameters<Fr> {
    static PARAMS: OnceLock<Vec<PoseidonParameters<Fr>>> = OnceLock::new();
    let all = PARAMS.get_or_init(|| {
        (2..=MAX_WIDTH)
            .map(|t| {
                get_poseidon_parameters::<Fr>(t as u8)
                    .expect("light-poseidon carries the circom parameters for widths 2..=13")
            })
            .collect()
    });
    &all[width - 2]
}

#[inline(always)]
fn sbox(x: &mut Fr) {
    let x2 = x.square();
    let x4 = x2.square();
    *x *= x4;
}

/// circomlib's `Poseidon(N)`: state `[0, inputs…]`, output `state[0]`. N in 1..=5.
pub(crate) fn poseidon<const N: usize>(inputs: &[Fr; N]) -> Fr {
    const { assert!(N >= 1 && N < MAX_WIDTH) };
    let width = N + 1;
    let p = parameters(width);
    debug_assert_eq!(p.width, width);
    let mut state = [Fr::zero(); MAX_WIDTH];
    let mut next = [Fr::zero(); MAX_WIDTH];
    state[1..width].copy_from_slice(inputs);
    let half = p.full_rounds / 2;
    let rounds = p.full_rounds + p.partial_rounds;
    for round in 0..rounds {
        for (i, s) in state[..width].iter_mut().enumerate() {
            *s += p.ark[round * width + i];
        }
        if round < half || round >= half + p.partial_rounds {
            state[..width].iter_mut().for_each(sbox);
        } else {
            sbox(&mut state[0]);
        }
        for (i, n) in next[..width].iter_mut().enumerate() {
            *n = Fr::zero();
            for (j, s) in state[..width].iter().enumerate() {
                *n += *s * p.mds[i][j];
            }
        }
        state[..width].copy_from_slice(&next[..width]);
    }
    let out = state[0];
    state.zeroize();
    next.zeroize();
    #[cfg(test)]
    super::wipe_probe::record("poseidon", &super::wipe_probe::bytes_of(&(state, next)));
    out
}

/// `rho_change = Poseidon3(TAG_RHO, nullifier, 0)` — the change note's `rho` (§1, §3; the
/// circuit's `RhoOut` with index 0). Key-free: the nullifier is its only input.
#[cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "consumed by Task 3's withdraw_change witness completion"
    )
)]
pub(crate) fn rho_change(nullifier: &Fr) -> Fr {
    poseidon(&[TAG_RHO, *nullifier, Fr::zero()])
}
```

Create `native/noctura-prover/src/a0/keys.rs`:

```rust
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
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "consumed by Task 3's witness completion")
    )]
    pub(crate) fn nk(&self) -> &Fr {
        &self.nk
    }

    /// `ivk` — M2 scans with it; derived and held here, never returned.
    #[cfg(test)]
    pub(crate) fn ivk(&self) -> &Fr {
        &self.ivk
    }

    /// `d_self` — the private `d` / `change_d` of every own note (R9); for the witness (Task 3).
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "consumed by Task 3's witness completion")
    )]
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
```

Create `native/noctura-prover/src/a0/state.rs`:

```rust
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
```

Create `native/noctura-prover/src/a0/wipe_probe.rs`:

```rust
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
```

Two compile traps the dry run hit, for the record: ark-ff 0.4's `#[derive(MontConfig)]` reads **every** attribute on its struct as one of its own (an `#[allow]` placed before it panics with `attribute modulus should be a string`, after it with `attribute small_subgroup_base should be a string`), hence the wrapping module carrying the `allow`; and it trips `unexpected_cfgs` (`feature = "asm"`) and `non_local_definitions` in a downstream crate — warnings, fatal under `-D warnings`.

- [ ] **Step 6: Run the tests — green; then the crate's whole gate.**

```bash
cd native/noctura-prover && set -o pipefail
cargo test --locked --lib a0:: 2>&1 | grep -E "test result"
cargo fmt --check; echo fmt=$?
cargo clippy --all-targets --locked -- -D warnings 2>&1 | tail -1; echo clippy=$?
cargo test --locked 2>&1 | grep -E "Running|test result|deposit_prove_to_bytes"
```

Expected:

```
test result: ok. 28 passed; 0 failed; 0 ignored; 0 measured; 9 filtered out; finished in 0.98s
fmt=0
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.80s
clippy=0
     Running unittests src/lib.rs (…/debug/deps/noctura_prover-…)
test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.78s
     Running tests/prove_to_bytes.rs (…/debug/deps/prove_to_bytes-…)
test deposit_prove_to_bytes_matches_public_inputs ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 8.61s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

37 = the 9 existing unit tests (`proof_bytes` 4, `prover` 2, `witness_wasmi` 3, unchanged) + 28 new; CI's interop assertion (`deposit_prove_to_bytes_matches_public_inputs ... ok`) still matches. `clippy` clean also proves the three `expect(dead_code)` attributes are fulfilled in the non-test build.

Then the repository's other gates (from the root):

```bash
npx tsc --noEmit; echo tsc=$?
node scripts/check-no-tge-date.mjs        # after `git add` — it scans tracked files, and the fixture is 734 lines of digits
npx prettier --check scripts/a0-vectors/gen-key-vectors.mjs
node --check scripts/a0-vectors/gen-key-vectors.mjs; echo $?
npx jest 2>&1 | tail -5
```

Expected: `tsc=0`; `no TGE date in 1419 tracked text files`; `All matched files use Prettier code style!`; `0`; `Test Suites: 1 skipped, 181 passed, 181 of 182 total` / `Tests:       1 skipped, 1243 passed, 1244 total` (no app source changed; the run is the whole-suite baseline). **ESLint does not run on `.mjs` in this repo:** `npx eslint scripts/a0-vectors/gen-key-vectors.mjs` fails at `34:44 Parsing error: Unexpected token import` (`import.meta`), exactly as the existing `scripts/check-no-tge-date.mjs` (`106:13`) and `scripts/mutation-sweep.mjs` (`135:5`) do; the CI lint (`lint:ci`) covers `src/**` and `__mocks__/**` only. Prettier (the repo's `.prettierrc.js`) is the style check for the script.

- [ ] **Step 7: The arm64 build and its dynamic section (no C++ runtime).**

```bash
cd native/noctura-prover && cargo ndk -t arm64-v8a build --release --locked 2>&1 | tail -1
readelf -d "$CARGO_TARGET_DIR/aarch64-linux-android/release/libnoctura_prover.so" | grep -E "NEEDED|SONAME"
readelf -d "$CARGO_TARGET_DIR/aarch64-linux-android/release/libnoctura_prover.so" | grep -c "c++"
```

Expected (cargo-ndk 4.1.2, NDK 27.1.12297006; 4 min 41 s cold in the dry run):

```
    Finished `release` profile [optimized] target(s) in 4m 41s
 0x0000000000000001 (NEEDED)             Shared library: [libdl.so]
 0x0000000000000001 (NEEDED)             Shared library: [libm.so]
 0x0000000000000001 (NEEDED)             Shared library: [libc.so]
0
```

And the new crates' build graphs carry no C build (`cargo tree --locked --target aarch64-linux-android -e normal,build -p <crate>` for `light-poseidon`, `sha2`, `hkdf`, `zeroize`): the only build-time dependencies are `autocfg` and `version_check`; `sha2` is built without its `asm` feature (no `sha2-asm` in the lock); `cpufeatures → libc` is Rust FFI bindings, not a C++ object. The one `cc` in the graph (`cargo tree … -i cc`) is pre-existing, under `backtrace ← color-eyre ← ark-circom`. **Limit:** nothing in the exported JNI symbols reaches `a0` yet, so the linker may have dropped it from the `.so`; Task 4 re-runs this check once it is bound.

- [ ] **Step 8: Named mutations — each in a fresh copy, compiled first, each red.**

Each: `git archive HEAD | tar -x -C <dir>`, symlink `node_modules`, apply the one edit, `cargo test --locked --lib --no-run` (all 18 compiled — none INVALID), then `cargo test --locked --lib a0::`. Measured:

| mutation | edit | result | red tests |
|---|---|---|---|
| M-poseidon-round-constant | `field.rs`: `+1` to `ark[0]` in round 0 | 22 passed; 6 failed | `poseidon_matches_the_circuit_validated_golden_rows`, `poseidon_equals_light_poseidons_own_hasher_over_the_same_constants`, `keys_match_the_offline_vectors_for_every_fixture_seed`, `core_open_returns_public_values_equal_to_the_vectors`, `a_second_open_replaces_the_first`, `match_spent_returns_ascending_own_indices_whose_nullifier_is_on_chain` |
| M-nk-limb-order | `keys.rs`: `[TAG_NK, sk_lo, sk_hi]` | 24 passed; 4 failed | `keys_match_the_offline_vectors…`, `core_open_returns_public_values…`, `a_second_open_replaces_the_first`, `match_spent_returns_ascending…` |
| M-d-self-domain | `keys.rs`: `self-d/v1` → `self-d/v2` | 26 passed; 2 failed | `keys_match_the_offline_vectors…`, `core_open_returns_public_values…` |
| M-rho-index-le | `keys.rs`: `i.to_be_bytes()` → `i.to_le_bytes()` | 26 passed; 2 failed | `keys_match_the_offline_vectors…`, `core_open_returns_public_values…` |
| M-commitment-arg-order | `keys.rs`: amount and `mint_hash()` swapped | 26 passed; 2 failed | `keys_match_the_offline_vectors…`, `core_open_returns_public_values…` |
| M-eip2333-no-flip | `eip2333.rs`: `*b = !*b` removed (lamport_1 from IKM, not NOT IKM) | 21 passed; 7 failed | `eip2333_master_and_child_match_the_eips_published_cases`, `eip2333_case0_intermediate_compressed_lamport_pk_matches_the_eip`, `spend_and_view_paths_match_bls_js_for_every_fixture_seed`, + 4 downstream |
| M-eip2333-raw-salt | `eip2333.rs`: first salt = the raw string, not `SHA256(salt)` | 21 passed; 7 failed | the same three EIP / path tests + 4 downstream |
| M-mint-byte | `field.rs`: `MINT[2]` `0x68` → `0x69` | 25 passed; 3 failed | `the_pinned_mint_and_its_hash_match_the_fixture`, `keys_match_the_offline_vectors…`, `core_open_returns_public_values…` |
| M-noncanonical-reduced | `field.rs`: `fr_from_be32` reduces mod r instead of refusing | 25 passed; 3 failed | `field_bytes_are_canonical_big_endian`, `commitment_refuses_a_non_canonical_rho`, `match_spent_refuses_duplicate_own_rhos_and_non_canonical_values` |
| M-keys-drop-no-wipe | `keys.rs`: `self.zeroize()` removed from `Drop` | 23 passed; 5 failed | `keys_are_wiped_on_close`, `keys_are_wiped_on_replacement`, `keys_are_wiped_when_the_state_is_dropped`, `keys_are_wiped_when_the_state_is_poisoned`, `the_probe_sees_live_bytes_positive_control` |
| M-poseidon-no-wipe | `field.rs`: `state.zeroize(); next.zeroize();` removed | 27 passed; 1 failed | `poseidon_wipes_its_state` |
| M-seed-not-wiped | `keys.rs`: the `seed.zeroize()` after `derive_path` removed | 26 passed; 2 failed | `keys_derive_wipes_the_seed_and_refuses_a_non_64_byte_seed`, `core_open_wipes_the_callers_seed_even_when_it_refuses_it` |
| M-close-keeps-keys | `state.rs`: `keys_close` without `end_session()` | 26 passed; 2 failed | `close_invalidates_the_handle`, `keys_are_wiped_on_close` |
| M-refused-open-keeps-previous | `state.rs`: `end_session()` moved after `Keys::derive(seed)?` | 27 passed; 1 failed | `a_refused_open_still_ends_the_previous_session` |
| M-poison-no-wipe | `state.rs`: poison path drops the guard without `end_session()` | 27 passed; 1 failed | `keys_are_wiped_when_the_state_is_poisoned` |
| M-match-spent-dup-allowed | `state.rs`: duplicate own rho accepted | 27 passed; 1 failed | `match_spent_refuses_duplicate_own_rhos_and_non_canonical_values` |
| M-match-spent-compares-rho | `state.rs`: also match when the own **rho** is on the chain list | 27 passed; 1 failed | `match_spent_negative_controls` |
| M-match-spent-chain-order | `state.rs`: result reversed (not ascending) | 27 passed; 1 failed | `match_spent_returns_ascending_own_indices_whose_nullifier_is_on_chain` |

The driver the dry run used (each mutation is an exact, single-occurrence string replacement; the driver asserts the count is 1 before applying):

```python
import subprocess, os, shutil, sys, re
S='/tmp/claude-1000/-home-user-Solana-Project-NocturaWallet/d7c642ae-8bb8-4082-9201-c4795988a74d/scratchpad'
REPO=S+'/m1a-dry'; BASE=S+'/t1-mut/tree'; TGT=S+'/t1-mut/target'
C='native/noctura-prover/src/a0/'
M=[
 ('M-poseidon-round-constant', C+'field.rs', '*s += p.ark[round * width + i];', '*s += p.ark[round * width + i];\n            if round == 0 && i == 0 {\n                *s += Fr::from(1u64);\n            }'),
 ('M-nk-limb-order', C+'keys.rs', 'keys.nk = poseidon(&[TAG_NK, sk_hi, sk_lo]);', 'keys.nk = poseidon(&[TAG_NK, sk_lo, sk_hi]);'),
 ('M-d-self-domain', C+'keys.rs', 'b"noctura/a0/self-d/v1"', 'b"noctura/a0/self-d/v2"'),
 ('M-rho-index-le', C+'keys.rs', '&i.to_be_bytes()]', '&i.to_le_bytes()]'),
 ('M-commitment-arg-order', C+'keys.rs', 'poseidon(&[TAG_CM, self.addr_self, Fr::from(amount), mint_hash(), *rho])', 'poseidon(&[TAG_CM, self.addr_self, mint_hash(), Fr::from(amount), *rho])'),
 ('M-eip2333-no-flip', C+'eip2333.rs', '*b = !*b;', 'let _ = b;'),
 ('M-eip2333-raw-salt', C+'eip2333.rs', 'let mut salt: [u8; 32] = Sha256::digest(KEYGEN_SALT).into();', 'let mut salt = [0u8; 32];\n    salt[..20].copy_from_slice(KEYGEN_SALT);'),
 ('M-mint-byte', C+'field.rs', '0xc7, 0x7f, 0x68,', '0xc7, 0x7f, 0x69,'),
 ('M-noncanonical-reduced', C+'field.rs', 'let v = Fr::from_bigint(BigInteger256::new(limbs));', 'let v = Some(Fr::from_le_bytes_mod_order(&{\n        let mut b = *bytes;\n        b.reverse();\n        b\n    }));'),
 ('M-keys-drop-no-wipe', C+'keys.rs', '    fn drop(&mut self) {\n        self.zeroize();', '    fn drop(&mut self) {'),
 ('M-poseidon-no-wipe', C+'field.rs', '    state.zeroize();\n    next.zeroize();\n', ''),
 ('M-seed-not-wiped', C+'keys.rs', '        let sk = derive_path(seed, &SPEND_PATH);\n        seed.zeroize();', '        let sk = derive_path(seed, &SPEND_PATH);'),
 ('M-close-keeps-keys', C+'state.rs', '        inner.keys_for(handle)?;\n        inner.end_session();', '        inner.keys_for(handle)?;'),
 ('M-refused-open-keeps-previous', C+'state.rs', '        inner.end_session();\n        let keys = Keys::derive(seed)?;', '        let keys = Keys::derive(seed)?;\n        inner.end_session();'),
 ('M-poison-no-wipe', C+'state.rs', '            poisoned.into_inner().end_session();\n', '            drop(poisoned);\n'),
 ('M-match-spent-dup-allowed', C+'state.rs', '            if !seen.insert(*r) {\n                return Err(A0Error::DuplicateRho { index: i });\n            }', '            seen.insert(*r);'),
 ('M-match-spent-compares-rho', C+'state.rs', '            if chain.contains(&*nf) {', '            if chain.contains(&*nf) || chain.contains(&own_rhos[i]) {'),
 ('M-match-spent-chain-order', C+'state.rs', '        Ok(spent)', '        spent.reverse();\n        Ok(spent)'),
]
only=sys.argv[1:]
env=dict(os.environ, CARGO_TARGET_DIR=TGT)
for name,f,old,new in M:
    if only and name not in only: continue
    if os.path.exists(BASE): shutil.rmtree(BASE)
    os.makedirs(BASE)
    subprocess.run(f'git -C {REPO} archive HEAD | tar -x -C {BASE}', shell=True, check=True)
    os.symlink(REPO+'/node_modules', BASE+'/node_modules')
    p=BASE+'/'+f; s=open(p).read()
    assert s.count(old)==1, (name, s.count(old))
    open(p,'w').write(s.replace(old,new))
    cwd=BASE+'/native/noctura-prover'
    b=subprocess.run(['cargo','test','--locked','--lib','--no-run'],cwd=cwd,env=env,capture_output=True,text=True)
    if b.returncode!=0:
        print(f'{name}: INVALID (does not compile)'); print(b.stderr[-1500:]); continue
    r=subprocess.run(['cargo','test','--locked','--lib','a0::'],cwd=cwd,env=env,capture_output=True,text=True)
    fails=re.findall(r'^test (a0::tests::\S+) \.\.\. FAILED',r.stdout,re.M)
    res=re.findall(r'^test result: .*$',r.stdout,re.M)
    print(f'{name}: {"RED" if r.returncode else "GREEN (SURVIVED)"} — {res[-1] if res else ""}')
    for t in fails: print('   ', t.replace('a0::tests::',''))
```

(`S` is the dry run's scratch directory; set it to yours.)

- [ ] **Step 9: Commit.**

```bash
git add native/noctura-prover/Cargo.toml native/noctura-prover/Cargo.lock native/noctura-prover/src/lib.rs \
  native/noctura-prover/src/a0 native/noctura-prover/tests/fixtures/a0-key-vectors.json scripts/a0-vectors/gen-key-vectors.mjs
git status --short     # artifacts/ stays untracked (gitignored); nothing else
git commit -m "feat(shielded-a0): Rust keys and field values — EIP-2333 sk, nk, ivk, d_self, addrField, mintHash, rho(i), nullifier, rho_change, commitment, matchSpent, the Mutex state and zeroization (M1a Task 1)"
```

Expected `git show --stat HEAD`: 12 files changed, 2306 insertions(+).

#### Notes for the executor (Task 1)

- **The rulings this task took (each the most secure default; the owner may overturn any):**
  - **Poseidon is the crate's own permutation over light-poseidon's constants, not light-poseidon's `hash`.** light-poseidon's `apply_mds` `collect()`s a new state `Vec` every round and frees the old one unwiped (65 frees per hash), and Poseidon is a permutation: a final state left in freed heap inverts to the inputs — for `nk`, to `sk_hi`, `sk_lo`. The own permutation keeps its state in two fixed `[Fr; 6]` arrays that are wiped (and the wipe is tested). The constants are light-poseidon 0.1.2's `parameters::bn254_x5` (generated with the Poseidon paper's `generate_parameters_grain.sage`, x^5, 8 full rounds, circomlib's partial-round counts); the code is held to three independent references: the circuit-validated golden rows (13 rows incl. the depth-20 Merkle fold), poseidon-lite (the fixture), and light-poseidon's own `Poseidon::new_circom(n).hash` (arities 2, 3, 5). Cost if wrong: ~40 lines of permutation to review; any divergence is caught by all three.
  - **`sk` is not kept.** `Keys` holds `nk`, `ivk`, `d_self`, `addr_self`; `sk` is wiped inside `Keys::derive` once `nk` exists. Nothing in M1 needs `sk` after `nk`; keeping it would only lengthen its life.
  - **`ivk` is derived and held, never returned** (spec: "derived and zeroized here, never returned"); its accessor is `#[cfg(test)]` only — M2 adds a real one.
  - **A `keys_open` ALWAYS ends the previous session first, even when it then refuses the new seed.** The caller asked for a new session; leaving the old keys alive after a failed open would be the less safe reading of m5's "a second keysOpen replaces the first". Tested (`a_refused_open_still_ends_the_previous_session`, M-refused-open-keeps-previous).
  - **`keys_close` with a handle that is not the live one is refused and closes nothing** — a late `finally` of an old operation cannot kill a newer one. **Handles** are one process-wide `AtomicU64` counter for every `Core` (never 0, never repeated), so one `Core`'s handle is never valid on another.
  - **A poisoned lock wipes the keys and refuses every later call** (`StatePoisoned`) until the process restarts — fail closed; `keys_open` on a poisoned state still wipes the caller's seed. std's `Mutex` stays poisoned, so shielded is unusable until restart; that is the intended cost.
  - **`match_spent`:** ascending indices into `own_rhos`; `chain_nullifiers` is a set (order and repeats irrelevant); a **repeated own `rho` is refused** (`DuplicateRho{index}` of the second occurrence) — a `rho` never repeats for one key (the global `["rho", rho]` PDA), so a repeat is a corrupted store, and matching it would count one note twice; every input must be canonical (`< r`, never reduced). The computed nullifiers live in `Zeroizing` buffers and never leave the call. Cost if the duplicate refusal is wrong: JS deduplicates before calling.
  - **The seed must be exactly 64 bytes** (a BIP-39 seed); EIP-2333's own `derive_master` takes ≥ 32 bytes (the EIP's cases 1–3 are 32-byte seeds, tested through `eip2333::derive_master`, not through `keys_open`).
  - **The BLS12-381 scalar field is defined with ark-ff's `MontConfig` derive** (r = `52435875175126190479447740508185965837690552500527637822603658699938581184513`, generator 7) rather than adding `ark-bls12-381`: no new crate, no curve code, and the EIP's four cases pin it.
  - **`be_mod_r` is Horner over the bytes in field arithmetic** (`acc·256 + b`) — no `BigUint`, no heap copy, the same function for EIP-2333's 48-byte OKM (BLS r) and the 64-byte SHA-512 / 32-byte mint reductions (BN254 r).
  - **Zeroization is a measured property.** The test-only `wipe_probe` copies a value's bytes inside its `Drop` after the wipe ran, while the memory is still owned (never a read of freed memory); the positive control (`the_probe_sees_live_bytes_positive_control`) shows the probe reads non-zero bytes of a live `Keys`. M-keys-drop-no-wipe, M-poseidon-no-wipe, M-seed-not-wiped, M-close-keeps-keys and M-poison-no-wipe each go red. **Stated limits (not tested, cannot be from safe Rust):** the internal state of `sha2` 0.10 / `hmac` / `hkdf` 0.12 (no `zeroize` feature in these versions — the SHA-512 block buffer briefly holds `nk`); stack temporaries the compiler copies `Fr` values through; the bytes the React Native bridge and Kotlin make (Task 4, spec §3's stated limit).
- **Vectors and independence.** The fixture is written only by `scripts/a0-vectors/gen-key-vectors.mjs`; it imports no Rust output, and the Rust code never writes it. bls.js is first held to the EIP's four cases (copied from `ethereum/ERCs` `ERCS/erc-2333.md` at `be307c948f28897adb8f25afcc253c2c909de35d`, file sha256 `0c8ee48c99befe1a7dd491d2cdde1d9d70ff99ed84d940d9ca14dfe4b9016616`); the app's equations are first held to every golden row; the BIP-39 of the test mnemonic + `"TREZOR"` is checked to be the EIP's Test Case 0 seed. Seeds: the repo's two test mnemonics, the EIP Test Case 0 seed, 64 × `0x00`, 64 × `0xff` — public test material only. Deposit indices `0, 1, 2, 2^32, 2^64-1` (u32 truncation and the u64 edge); amounts `0, 1, 10^9, 2^64-1`. The EIP's `compressed_lamport_PK` for Test Case 0 is copied from the EIP's intermediate-values section, not re-derived in JS (bls.js does not export it).
- **The script is run by hand, never by CI or Jest** (I-6); it lives under `scripts/`, outside the boundary source test's scope (Task 4 / M1b). It is the one place outside native that names the spend path, by design.
- **Deviation from the brief:** none in scope. The brief named `light-poseidon` "on the arkworks 0.4 family"; the version is `=0.1.2` (the reason above). The `readelf` CI step is Task 5's; this task ran it once by hand.
- **What the next tasks must know:** see Interfaces → "What later tasks rely on". In short: Task 2 extends `Inner` and `Inner::end_session`; Task 3 removes the three `expect(dead_code)` attributes as it consumes `nk()`, `d_self()`, `rho_change`; Task 4 binds `CORE`'s five methods and re-runs `readelf`.

#### Spec rev 3.2 lines (Task 1)
- §3 "Poseidon (m12)": **`light-poseidon` `=0.1.2`** (the newest release that resolves against ark-circom's `num-bigint =0.4.3`), used **for its constants only**; the permutation is the crate's own, so its state is wiped (light-poseidon's frees an unwiped state every round).
- §3 key derivation: **`sk` is not kept** after `nk` is derived; the key set held per handle is `{nk, ivk, d_self, addrField(d_self)}`.
- §3 handle lifetime: **a `keysOpen` ends the live session before it validates the new seed** (a refused open leaves no session); **`keysClose` with a stale handle is refused and closes nothing**; a **poisoned state wipes the keys and refuses every call** until restart.
- §3 `matchSpent`: **ascending indices into `ownRhos`; `chainNullifiers` is a set; a repeated own `rho` is refused; every input canonical (`< r`), never reduced**.
- §3 / §12: the seed for `keysOpen` is **exactly 64 bytes**, zero-filled on every return path.


### Task 2: The unshield destination and its authorization in Rust — `native/noctura-prover/src/a0/{ata,unshield,auth}.rs` (`find_program_address` with the runtime's on-curve test via curve25519-dalek `=4.1.3`; the owner must be a possible Ed25519 public key — a PDA, a small-order point or a torsion point is refused; `ATA(owner, pinned mint)`; `parseUnshield(owner, amount, fee)` with the pinned pool / mint / decimals 9 / fee ceiling 1,000,000 and integer human amounts; `authorizeUnshield` → a random 16-byte `authId` over the record `{owner, ata, amount, fee, pool, mint, handle, expiresAt = approval + 120 s}`, one in flight, consumed by the first `take_auth`, cleared with the session); the offline generator `scripts/a0-vectors/gen-ata-vectors.mjs` (@solana/web3.js + @noble/curves + @scure/base, held to the program side's published addresses, optionally cross-checked with @solana/spl-token) and its committed fixture; 23 tests, 33 named mutations

**Spec:** §3 "ATA derivation (C1)" (`ata = find_program_address([owner, TOKEN_PROGRAM_ID, mint], ASSOCIATED_TOKEN_PROGRAM_ID)`, SHA-256 over seeds ‖ bump ‖ program id ‖ `"ProgramDerivedAddress"`, bump from 255 down, refusing on-curve candidates; the owner itself must be **on** the curve, a PDA owner is refused, m3), §3 JNI surface (`parseUnshield(owner, amount, fee) -> {owner, ata, amount, fee, humanAmount, humanFee, pool}`, `authorizeUnshield(handle, owner, amount, fee) -> authId` — Kotlin only, as Rust functions; the JNI is Task 4), §3 "Rust state is one `Mutex<{keys, auth}>` … one authorization at a time", §3 `prove` ("requires a live `authId`; consumed by the first prove, success or failure, and refused if expired, absent, or recorded under another handle" — the record and its check here, the call in Task 3), §3 handle lifetime ("a second `keysOpen` … invalidates any live authorization"), §4 step 2 (owner 32 bytes of base58 and on-curve; Rust derives `ata`; amount and fee u64, amount > 0, fee ≤ 1,000,000 base units pinned in Rust, not `pool.max_fee`; pool, mint and decimals pinned, R3), §4 step 3's "human amounts use the pinned decimals" (the strings Rust gives the dialog), §4 step 4 (the record, `expiresAt = approval + 120 s` from the biometric approval, m-6; an opaque `authId` carrying no data), §4 "`keysClose` or a second `keysOpen` invalidates a live `authId`", §12 (pure-Rust crates, `Cargo.lock` in the same PR, no C++ runtime), §14 Rust ("`derive_ata(owner)` equals `@solana/spl-token`'s derivation for at least three fixed owners; an off-curve owner is refused"; the authorization refusals: expired, reused, absent, from a closed or replaced handle, a fee above the ceiling; named mutations), INV-AUTH (its Rust half: the record exists only from `authorize_unshield`, is used once, within 120 s, under its handle). **Not here:** the call of `take_auth` from `prove`, the refusal of `withdraw_change` without an `authId`, `amount + fee ≤ inputAmount` and `recipientField = be_mod_r(ata)` (Task 3); the JNI functions, Kotlin, the "another owner / ATA / amount / fee" refusals that need a proof's public inputs, and INV-AUTH as a boundary test (Task 4); the dialog, `BiometricPrompt` and its lifecycle rules (M1c); the `readelf` CI step (Task 5 — this task runs the check once by hand, Step 7).

**Files:**
- Create: `native/noctura-prover/src/a0/ata.rs`, `src/a0/unshield.rs`, `src/a0/auth.rs`, `scripts/a0-vectors/gen-ata-vectors.mjs`
- Create (generated, committed): `native/noctura-prover/tests/fixtures/a0-ata-vectors.json` (355 lines, written by the script — Step 2; not pasted)
- Create (tests): `native/noctura-prover/src/a0/tests_unshield.rs` (23 tests; in-crate, because `take_auth`, the record and the injected clock are `pub(crate)`)
- Modify: `native/noctura-prover/Cargo.toml` (+`curve25519-dalek =4.1.3` without default features, `bs58 0.5`, `getrandom 0.2`, and `libc 0.2` for Linux/Android only), `native/noctura-prover/Cargo.lock` (+4 packages, +4 dependency lines — written by `cargo fetch`), `native/noctura-prover/src/a0/mod.rs` (three modules, the public re-exports, the test module), `native/noctura-prover/src/a0/state.rs` (`Inner.auth`, `end_session` clears it, `take_auth`, `authorize_unshield{,_at}`, 18 `A0Error` variants, three test-only helpers)
- **Not changed, on purpose:** `src/a0/{eip2333,field,keys,tests,wipe_probe}.rs` (Task 1's; `field::MINT` is reused, not copied), `src/prover.rs`, `src/proof_bytes.rs`, `src/witness_wasmi.rs`, `src/android.rs` (no JNI in this task), `tests/prove_to_bytes.rs`, `.github/workflows/native-prover.yml`, every file under `src/` of the app (the app's own `findAssociatedTokenAddress` stays as it is; JS compares its ATA with Rust's in M1c, §4 step 4).

**Interfaces:**
- Consumes (Task 1): `state::{Core, Inner, Handle, A0Error}`, `Core::lock` (poison → `end_session` → `StatePoisoned`), `Inner::end_session` (the one place a session ends — this task adds `self.auth = None;` there and nowhere else), `Inner::keys_for`, `Core::keys_open` / `keys_close` (both reach `end_session`), `Core::poison_for_test`, `field::MINT`. Crates: `curve25519_dalek::edwards::{CompressedEdwardsY, EdwardsPoint}` (`decompress`, `compress`, `is_small_order`, `is_torsion_free`), `sha2::Sha256`, `bs58::{decode, encode}`, `getrandom::getrandom` (0.2.17), `libc::{clock_gettime, CLOCK_BOOTTIME, timespec}`. For the script: `@solana/web3.js` 1.99.0 (`PublicKey.findProgramAddressSync`, `PublicKey.isOnCurve`), `@noble/curves` 2.0.1 (`ed25519.Point`, `ED25519_TORSION_SUBGROUP`), `@noble/hashes` 2.0.1 `sha512`, `@scure/base` 2.0.0 `base58`; optionally `@solana/spl-token` (`getAssociatedTokenAddressSync`; 0.3.11 in the dry run, from the program side's checkout — it is not a dependency of this repository).
- Produces — public (`noctura_prover::a0`; Task 4 binds these, Kotlin-only):
  ```rust
  pub fn parse_unshield(owner: &str, amount: &str, fee: &str) -> Result<Unshield, A0Error>;
  //   owner: base58 of 32 bytes, a possible Ed25519 public key; amount/fee: canonical decimal u64
  //   strings (digits only, no sign, no leading zero); amount > 0; fee <= FEE_CEILING;
  //   amount + fee <= u64::MAX. Refusal order: owner (string, then point), amount, fee, the rules.
  #[derive(Clone, Debug, PartialEq, Eq)]
  pub struct Unshield {
      pub owner: String,        // base58 of the bytes Rust parsed
      pub ata: String,          // base58 of ATA(owner, ERkp…), derived here
      pub amount: u64, pub fee: u64,
      pub human_amount: String, // integer rendering with DECIMALS: "1.5", "0.00001", "18446744073.709551615"
      pub human_fee: String,
      pub pool: String,         // "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT", pinned
  }
  pub const DECIMALS: u32 = 9;
  pub const FEE_CEILING: u64 = 1_000_000;
  impl Core {
      pub fn authorize_unshield(&self, handle: Handle, owner: &str, amount: &str, fee: &str)
          -> Result<AuthId, A0Error>;
      //   handle must be live (else UnknownHandle); the strings re-parsed exactly as parse_unshield;
      //   refused with AuthInFlight while an unexpired record exists (an expired one is replaced);
      //   records {owner, ata, amount, fee, POOL, MINT, handle, expires_at = boot-clock now + 120 s}
  }
  #[derive(Clone, Copy)] pub struct AuthId([u8; 16]);   // OS random; Debug prints "AuthId(..)"
  impl AuthId { pub fn to_bytes(self) -> [u8; 16]; pub fn from_bytes(bytes: [u8; 16]) -> Self; }
  pub enum A0Error { /* Task 1's five, plus: */
      OwnerNotBase58, OwnerLength { got: usize }, OwnerOffCurve, OwnerNonCanonical, OwnerSmallOrder,
      OwnerTorsion, NoProgramAddress, NotU64 { what: &'static str /* "amount" | "fee" */ }, AmountZero,
      FeeAboveCeiling, AmountPlusFeeOverflow, AuthInFlight, AuthAbsent, AuthMismatch, AuthWrongHandle,
      AuthExpired, Rng, Clock,
  }   // Display carries no input value (tested)
  ```
- Produces — crate-private (what Task 3 builds on):
  ```rust
  // a0::state
  impl Inner {
      pub(crate) fn take_auth(&mut self, handle: Handle, auth_id: &AuthId, now: Duration)
          -> Result<Auth, A0Error>;
      //   CONSUMES the live record first, whatever it then decides; refuses in this order:
      //   handle not live → UnknownHandle; no record → AuthAbsent; other id → AuthMismatch;
      //   recorded under another handle → AuthWrongHandle; now >= expires_at → AuthExpired
  }
  impl Core {
      pub(crate) fn authorize_unshield_at(&self, handle: Handle, owner: &str, amount: &str,
          fee: &str, now: Duration) -> Result<AuthId, A0Error>;   // the injectable-clock form
  }
  // a0::auth
  pub(crate) const AUTH_TTL: Duration;                           // 120 s
  pub(crate) fn now() -> Result<Duration, A0Error>;               // CLOCK_BOOTTIME (Linux/Android)
  pub(crate) struct Auth { pub(crate) id: AuthId, pub(crate) handle: Handle,
      pub(crate) owner: [u8; 32], pub(crate) ata: [u8; 32], pub(crate) amount: u64, pub(crate) fee: u64,
      pub(crate) pool: [u8; 32], pub(crate) mint: [u8; 32], pub(crate) expires_at: Duration }
  // a0::ata
  pub(crate) const TOKEN_PROGRAM_ID: [u8; 32]; pub(crate) const ATA_PROGRAM_ID: [u8; 32];
  pub(crate) fn is_on_curve(bytes: &[u8; 32]) -> bool;            // the runtime's test
  pub(crate) fn find_program_address(seeds: &[&[u8]], program_id: &[u8; 32]) -> Option<([u8; 32], u8)>;
  pub(crate) fn check_owner(owner: &[u8; 32]) -> Result<(), A0Error>;
  pub(crate) fn derive_ata(owner: &[u8; 32]) -> Result<[u8; 32], A0Error>;
  // a0::unshield
  pub(crate) const POOL: [u8; 32];
  pub(crate) struct Parsed { owner: [u8; 32], ata: [u8; 32], amount: u64, fee: u64 }  // fields pub(crate)
  pub(crate) fn parse(owner: &str, amount: &str, fee: &str) -> Result<Parsed, A0Error>;
  ```
- **What later tasks rely on:** **Task 3** — in `prove` for `withdraw_change`: read the clock BEFORE taking the lock (`let now = auth::now()?;`), then, under the lock, call `inner.take_auth(handle, &auth_id, now)?` as the FIRST check after `keys_for` succeeds — before parsing or checking the witness — so the record is consumed by the first prove "success or failure" (§3); then `withdrawAmount = auth.amount`, `fee = auth.fee`, `recipientField = be_mod_order::<Fr>(&auth.ata)`, the refusal unless `auth.amount.checked_add(auth.fee) <= inputAmount`. `take_auth` borrows `&mut Inner`, so take the record before borrowing `keys_for`'s `&Keys`. `Auth` and `take_auth` carry `#[cfg_attr(not(test), expect(dead_code, …))]` today — **Task 3 must delete both attributes when it calls `take_auth`** (an unfulfilled `expect` fails clippy `-D warnings`). **Task 4** — `parse_unshield` and `CORE.authorize_unshield` are the Rust side of `parseUnshield` / `authorizeUnshield` (Kotlin only, not in the JS module); the JNI passes the three values as `jstring` (Kotlin's `Long` cannot hold a u64 above 2^63 − 1), encodes `AuthId::to_bytes()` for Kotlin / JS (its choice; 16 bytes) and decodes it back for `prove`, and maps `A0Error`'s `Display` to the rejection message; Task 4 re-runs `readelf` once these are reachable from the exported symbols. **Task 5** — the four new packages are pure Rust (Step 7).

**The rule, stated once.** JS hands Rust three strings and nothing else. Rust decides whether the owner is a key a person can hold, derives its token account, parses and bounds the numbers, renders every string the dialog shows, and — only on the biometric approval — keeps one record of those exact values under the live handle with a random id. The record is used once, within 120 seconds of the approval on a clock that keeps counting while the phone sleeps, and it dies with its session (close, reopen, poison). Every expected address, bump, verdict and human amount in the tests comes from code that shares nothing with this crate.

- [ ] **Step 1: Add the crates and lock them.**

Apply to `native/noctura-prover/Cargo.toml`:

```diff
diff --git a/native/noctura-prover/Cargo.toml b/native/noctura-prover/Cargo.toml
index d9fd861..7ce033f 100644
--- a/native/noctura-prover/Cargo.toml
+++ b/native/noctura-prover/Cargo.toml
@@ -45,11 +45,23 @@ light-poseidon = "=0.1.2"
 sha2 = "0.10"
 hkdf = "0.12"
 zeroize = "1"
+# A0 unshield parsing and authorization (src/a0/ata.rs, unshield.rs, auth.rs) — pure Rust too.
+# curve25519-dalek =4.1.3 is the version the Solana runtime's `is_on_curve` uses, so an
+# "off curve" here is the chain's; default features off (no tables, no rand, no zeroize).
+curve25519-dalek = { version = "=4.1.3", default-features = false }
+bs58 = "0.5"
+# The authId: 16 bytes from the OS (Android: the getrandom syscall). Already in the lock.
+getrandom = "0.2"
 
 # Android JNI bridge (pure Rust — no C++, no libc++_shared).
 [target.'cfg(target_os = "android")'.dependencies]
 jni = "0.21"
 
+# CLOCK_BOOTTIME for the 120 s authorization window (counts time the phone is suspended);
+# Rust bindings only, already in the lock.
+[target.'cfg(any(target_os = "linux", target_os = "android"))'.dependencies]
+libc = "0.2"
+
 [[example]]
 name = "zkey_check"
 path = "examples/zkey_check.rs"
```

**Why these:** `curve25519-dalek =4.1.3` is the version the Solana runtime's `Pubkey::is_on_curve` / `find_program_address` use (`CompressedEdwardsY::decompress().is_some()`), so "off the curve" means here what it means on chain; 5.0.0 exists (`cpufeatures ^0.3`, MSRV 1.85) and is not taken. Without default features it pulls only `cfg-if`, `subtle` and the build-time `rustc_version` on Android (`cargo tree … -p curve25519-dalek`, Step 7); the lock also lists `curve25519-dalek-derive` (x86_64 SIMD backend only) and `fiat-crypto` (only under `cfg(curve25519_dalek_backend = "fiat")`), neither built for arm64. `bs58 0.5.1` has no default dependency. `getrandom 0.2.17` and `libc 0.2.186` are already in the lock (transitively) and add no package; `getrandom` 0.2.17 on Android calls the `getrandom(2)` syscall and falls back to `/dev/urandom` only on `ENOSYS` (`src/linux_android_with_fallback.rs`). `libc` is target-specific so a non-Linux desktop build does not carry an unused dependency.

Then write the lock (from `native/noctura-prover`):

```bash
cargo fetch
git diff --stat Cargo.lock
```

Expected: ` native/noctura-prover/Cargo.lock | 44 ++++++++++++++++++++++++++++++++++++++++` — exactly this diff (the dry run's `cargo fetch` on Task 1's lock):

```diff
diff --git a/native/noctura-prover/Cargo.lock b/native/noctura-prover/Cargo.lock
index 9115e63..6a11533 100644
--- a/native/noctura-prover/Cargo.lock
+++ b/native/noctura-prover/Cargo.lock
@@ -360,6 +360,15 @@ dependencies = [
  "generic-array",
 ]
 
+[[package]]
+name = "bs58"
+version = "0.5.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "bf88ba1141d185c399bee5288d850d63b8369520c1eafc32a0430b5b6c287bf4"
+dependencies = [
+ "tinyvec",
+]
+
 [[package]]
 name = "bumpalo"
 version = "3.20.3"
@@ -721,6 +730,31 @@ dependencies = [
  "memchr",
 ]
 
+[[package]]
+name = "curve25519-dalek"
+version = "4.1.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "97fb8b7c4503de7d6ae7b42ab72a5a59857b4c937ec27a3d4539dba95b5ab2be"
+dependencies = [
+ "cfg-if",
+ "cpufeatures",
+ "curve25519-dalek-derive",
+ "fiat-crypto",
+ "rustc_version",
+ "subtle",
+]
+
+[[package]]
+name = "curve25519-dalek-derive"
+version = "0.1.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f46882e17999c6cc590af592290432be3bce0428cb0d5f8b6715e4dc7b383eb3"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn 2.0.119",
+]
+
 [[package]]
 name = "darling"
 version = "0.21.3"
@@ -1011,6 +1045,12 @@ dependencies = [
  "subtle",
 ]
 
+[[package]]
+name = "fiat-crypto"
+version = "0.2.9"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "28dea519a9695b9977216879a3ebfddf92f1c08c05d984f8996aecd6ecdc811d"
+
 [[package]]
 name = "find-msvc-tools"
 version = "0.1.9"
@@ -1566,10 +1606,14 @@ dependencies = [
  "ark-serialize",
  "ark-snark",
  "ark-std",
+ "bs58",
+ "curve25519-dalek",
  "fnv",
+ "getrandom 0.2.17",
  "hex",
  "hkdf",
  "jni",
+ "libc",
  "light-poseidon",
  "num-bigint",
  "num-traits",
```

- [ ] **Step 2: Write the offline vector generator and run it.**

Create `scripts/a0-vectors/gen-ata-vectors.mjs`:

```js
#!/usr/bin/env node
/**
 * Offline generator of the A0 ATA / owner / amount vectors the Rust unshield parser is tested
 * against (spec 2026-11-08 shielded A0 M1 §3 "ATA derivation", §4 step 2, §14; I-6).
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Every value in the fixture is computed here by implementations
 * that share no code with `native/noctura-prover`:
 *   - program addresses and ATAs: `@solana/web3.js` `PublicKey.findProgramAddressSync` and
 *     `PublicKey.isOnCurve` (the app's own dependency) — the exact calls `@solana/spl-token`'s
 *     `getAssociatedTokenAddressSync` makes; with `--spl-token=<dir of @solana/spl-token>` every
 *     ATA is ALSO compared with spl-token's own `getAssociatedTokenAddressSync` (the package is
 *     not a dependency of this repository, so the comparison is opt-in);
 *   - the owner classification (canonical encoding, small order, torsion): `@noble/curves`
 *     ed25519 `Point`;
 *   - base58: `@scure/base`; the human amounts: BigInt division, not string slicing.
 * Before anything is written the script holds itself to the program side's published facts
 * (spec §1): the pool, tree and vault PDAs of mint ERkp…, and the relayer's fee ATA
 * 9643… = ATA(3jvhiz…, ERkp…). A mismatch stops the script.
 * Nothing here reads a Rust output, and the Rust code never writes this file.
 *
 * Run by hand from the repository root (no network):
 *   node scripts/a0-vectors/gen-ata-vectors.mjs                       write the fixture
 *   node scripts/a0-vectors/gen-ata-vectors.mjs --check               regenerate and compare
 *   node scripts/a0-vectors/gen-ata-vectors.mjs --check --spl-token=<path>/node_modules/@solana/spl-token
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublicKey } from '@solana/web3.js';
import { ed25519, ED25519_TORSION_SUBGROUP } from '@noble/curves/ed25519.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { base58 } from '@scure/base';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(
  ROOT,
  'native/noctura-prover/tests/fixtures/a0-ata-vectors.json',
);
const OUT_REL = relative(ROOT, OUT);

/** Pinned facts (spec §1; the program side's docs/zk-contract/devnet-a0-deployed-contract.json). */
const PROGRAM_ID = 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH';
const MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const POOL = '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT';
const MERKLE_TREE = '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc';
const POOL_AUTHORITY = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd';
const RELAYER_FEE_PAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
const RELAYER_FEE_ATA = '9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
/** The devnet mint's decimals, read from its mint account (spec §4 step 2, R3). */
const DECIMALS = 9;
const FEE_CEILING = 1_000_000n;
const U64_MAX = (1n << 64n) - 1n;
/** Ed25519 field prime p = 2^255 - 19. */
const P = (1n << 255n) - 19n;

const fail = msg => {
  console.error(`gen-ata-vectors: ${msg}`);
  process.exit(1);
};
const hex = bytes => Buffer.from(bytes).toString('hex');
const enc = new TextEncoder();
const pk = s => new PublicKey(s);

const findPda = (seeds, program) => {
  const [address, bump] = PublicKey.findProgramAddressSync(seeds, pk(program));
  return { address: address.toBase58(), bump };
};
const ataOf = ownerBytes =>
  findPda(
    [ownerBytes, pk(TOKEN_PROGRAM).toBytes(), pk(MINT).toBytes()],
    ATA_PROGRAM,
  );

// ---- 1. the program side's facts, recomputed here before anything is written ----
const poolPda = findPda([enc.encode('pool'), pk(MINT).toBytes()], PROGRAM_ID);
const treePda = findPda([enc.encode('merkle'), pk(POOL).toBytes()], PROGRAM_ID);
const vault = ataOf(pk(POOL).toBytes());
const relayerAta = ataOf(pk(RELAYER_FEE_PAYER).toBytes());
if (poolPda.address !== POOL) fail(`pool PDA ${poolPda.address} != ${POOL}`);
if (treePda.address !== MERKLE_TREE) {
  fail(`tree PDA ${treePda.address} != ${MERKLE_TREE}`);
}
if (relayerAta.address !== RELAYER_FEE_ATA) {
  fail(`relayer fee ATA ${relayerAta.address} != ${RELAYER_FEE_ATA}`);
}

// ---- 2. owner classification, in the precedence the parser applies ----
// offCurve: no point decompresses (ZIP-215 decoding = curve25519-dalek's `decompress`, the
// Solana runtime's on-curve test); nonCanonical: it decompresses but re-encodes differently;
// smallOrder: order divides 8; torsion: not in the prime-order subgroup; ok: a possible
// Ed25519 public key.
const classify = bytes => {
  let point;
  try {
    point = ed25519.Point.fromBytes(bytes, true);
  } catch {
    return 'offCurve';
  }
  if (hex(point.toBytes()) !== hex(bytes)) return 'nonCanonical';
  if (point.isSmallOrder()) return 'smallOrder';
  if (!point.isTorsionFree()) return 'torsion';
  return 'ok';
};
const web3OnCurve = bytes => PublicKey.isOnCurve(bytes);

const keyFromLabel = label =>
  ed25519.getPublicKey(sha512(enc.encode(label)).slice(0, 32));
const leY = y => {
  const b = new Uint8Array(32);
  let v = y;
  for (let i = 0; i < 32; i++) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
};

const owners = [];
const addOwner = (label, bytes, why) => {
  owners.push({ label, why, bytes: Uint8Array.from(bytes) });
};
addOwner(
  'relayer fee payer 3jvhiz… (its ATA is the published fee ATA 9643…)',
  pk(RELAYER_FEE_PAYER).toBytes(),
  'a program-side fact',
);
addOwner('pool authority GoBAm…', pk(POOL_AUTHORITY).toBytes(), 'a real key');
for (let i = 0; i < 3; i++) {
  addOwner(
    `test key ${i}`,
    keyFromLabel(`noctura/a0/ata-vectors/owner/${i}`),
    'Ed25519 public key of SHA-512(label)[0..32]',
  );
}
// owners whose ATA bump is not 255: the first and second candidates are on the curve
for (const want of [254, 253]) {
  for (let i = 0; ; i++) {
    const b = keyFromLabel(`noctura/a0/ata-vectors/bump/${i}`);
    if (ataOf(b).bump === want) {
      addOwner(
        `test key with ATA bump ${want}`,
        b,
        `the first i with bump ${want}`,
      );
      break;
    }
    if (i > 10000) fail(`no owner with bump ${want}`);
  }
}
addOwner(
  'the System Program 1111…1 (32 zero bytes: y = 0, a point of order 4)',
  new Uint8Array(32),
  'on curve for Solana, but no key',
);
addOwner(
  'the identity (y = 1)',
  leY(1n),
  'on curve, order 1 — and identity is torsion-free',
);
addOwner('y = p − 1 (order 2)', leY(P - 1n), 'on curve, small order');
{
  // a non-canonical y: y + p < 2^255 encodes the same point as y
  let k = 2n;
  for (; k < 19n; k++) {
    const b = leY(k + P);
    let pt;
    try {
      pt = ed25519.Point.fromBytes(b, true);
    } catch {
      continue;
    }
    if (!pt.isSmallOrder()) break;
  }
  if (k === 19n) fail('no non-canonical on-curve y found');
  addOwner(
    `non-canonical y = p + ${k}`,
    leY(k + P),
    'decompresses (Solana: on curve) but is not the canonical encoding',
  );
}
{
  const a = ed25519.Point.fromBytes(
    keyFromLabel('noctura/a0/ata-vectors/owner/0'),
  );
  const t = ed25519.Point.fromHex(ED25519_TORSION_SUBGROUP[1]);
  addOwner(
    'test key 0 + a torsion point of order 8',
    a.add(t).toBytes(),
    'on curve, canonical, not small order, not in the prime-order subgroup',
  );
}
addOwner(
  'the pool PDA 8VMe…',
  pk(POOL).toBytes(),
  'a PDA — off curve by construction',
);
addOwner(
  'the relayer fee ATA 9643…',
  pk(RELAYER_FEE_ATA).toBytes(),
  'an ATA — off curve by construction',
);
{
  let i = 0;
  for (; ; i++) {
    const b = sha512(enc.encode(`noctura/a0/ata-vectors/off/${i}`)).slice(
      0,
      32,
    );
    if (classify(b) === 'offCurve') {
      addOwner(`raw bytes off/${i}`, b, 'the first hash that is off the curve');
      break;
    }
  }
}

let spl = null;
const splArg = process.argv.find(a => a.startsWith('--spl-token='));
if (splArg) {
  const dir = resolve(splArg.slice('--spl-token='.length));
  const req = createRequire(join(dir, 'package.json'));
  spl = req(dir);
  spl.version = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8'),
  ).version;
}

const ownerRows = owners.map(o => {
  const s = base58.encode(o.bytes);
  if (hex(pk(s).toBytes()) !== hex(o.bytes))
    fail(`base58 round trip ${o.label}`);
  const verdict = classify(o.bytes);
  const onCurve = web3OnCurve(o.bytes);
  const ata = ataOf(o.bytes);
  if (spl) {
    const viaSpl = spl
      .getAssociatedTokenAddressSync(pk(MINT), pk(s), true)
      .toBase58();
    if (viaSpl !== ata.address) fail(`spl-token disagrees for ${o.label}`);
    let refused = false;
    try {
      spl.getAssociatedTokenAddressSync(pk(MINT), pk(s), false);
    } catch {
      refused = true;
    }
    if (refused !== !onCurve) {
      fail(`spl-token's owner check disagrees with isOnCurve for ${o.label}`);
    }
  }
  return {
    label: o.label,
    why: o.why,
    owner: s,
    ownerHex: hex(o.bytes),
    verdict,
    web3IsOnCurve: onCurve,
    ata: ata.address,
    ataHex: hex(pk(ata.address).toBytes()),
    bump: ata.bump,
  };
});
const okCount = ownerRows.filter(r => r.verdict === 'ok').length;
if (okCount < 5) fail(`only ${okCount} accepted owners`);
for (const v of ['offCurve', 'nonCanonical', 'smallOrder', 'torsion']) {
  if (!ownerRows.some(r => r.verdict === v)) fail(`no ${v} owner`);
}

// ---- 3. owner strings the parser must refuse before any curve check ----
const k0 = base58.encode(keyFromLabel('noctura/a0/ata-vectors/owner/0'));
const badOwnerStrings = [
  { label: 'empty', s: '', error: 'length', got: 0 },
  { label: 'a 0 (not in the alphabet)', s: '0' + k0.slice(1), error: 'base58' },
  { label: 'an O', s: 'O' + k0.slice(1), error: 'base58' },
  { label: 'an I', s: 'I' + k0.slice(1), error: 'base58' },
  { label: 'an l', s: 'l' + k0.slice(1), error: 'base58' },
  { label: 'a leading space', s: ' ' + k0, error: 'base58' },
  { label: 'a trailing newline', s: k0 + '\n', error: 'base58' },
  { label: 'a non-ASCII digit', s: k0.slice(0, -1) + '٣', error: 'base58' },
  {
    label: '31 bytes',
    s: base58.encode(new Uint8Array(31).fill(7)),
    error: 'length',
    got: 31,
  },
  {
    label: '33 bytes',
    s: base58.encode(new Uint8Array(33).fill(7)),
    error: 'length',
    got: 33,
  },
  {
    label: 'a valid key with an extra leading 1 (33 bytes)',
    s: '1' + k0,
    error: 'length',
    got: 33,
  },
  {
    label: 'a valid key with its last character dropped',
    s: k0.slice(0, -1),
    error: 'length',
    got: base58.decode(k0.slice(0, -1)).length,
  },
];
for (const b of badOwnerStrings) {
  let ok = true;
  let n = null;
  try {
    n = base58.decode(b.s).length;
  } catch {
    ok = false;
  }
  if (b.error === 'base58' && ok) fail(`@scure/base accepts "${b.label}"`);
  if (b.error === 'length' && (!ok || n !== b.got || n === 32)) {
    fail(`"${b.label}" decodes to ${n} bytes`);
  }
}

// ---- 4. amounts: decimal u64 strings and their human rendering ----
const human = units => {
  const scale = 10n ** BigInt(DECIMALS);
  const whole = units / scale;
  const frac = units % scale;
  if (frac === 0n) return whole.toString();
  let f = frac.toString().padStart(DECIMALS, '0');
  while (f.endsWith('0')) f = f.slice(0, -1);
  return `${whole}.${f}`;
};
const amountCases = [
  1n,
  9n,
  10n,
  10_000n,
  100_000n,
  999_999n,
  1_000_000n,
  6_000_000n,
  123_456_789n,
  999_999_999n,
  1_000_000_000n,
  1_000_000_001n,
  1_500_000_000n,
  10_000_000_000n,
  12_345_678_901_234_567n,
  U64_MAX,
].map(v => ({ units: v.toString(), human: human(v) }));

const fixture = {
  schema: 'noctura.a0.ata-vectors/1',
  _provenance:
    "Written by scripts/a0-vectors/gen-ata-vectors.mjs from @solana/web3.js findProgramAddressSync / isOnCurve, @noble/curves ed25519 and @scure/base, after recomputing the program side's pool, tree and relayer-fee-ATA addresses. No Rust output is read. Rerun: node scripts/a0-vectors/gen-ata-vectors.mjs [--check] [--spl-token=<dir>].",
  _verdicts:
    "ok = a possible Ed25519 public key (canonical, on curve, prime-order subgroup, not the identity); offCurve = no point decompresses (Solana's is_on_curve is false); nonCanonical = decompresses, re-encodes differently; smallOrder = order divides 8; torsion = not in the prime-order subgroup. Precedence: offCurve, nonCanonical, smallOrder, torsion. ata/bump are findProgramAddressSync([owner, TOKEN_PROGRAM, mint], ATA_PROGRAM) for EVERY row (spl-token allowOwnerOffCurve=true); the parser refuses every verdict but ok.",
  constants: {
    programId: PROGRAM_ID,
    programIdHex: hex(pk(PROGRAM_ID).toBytes()),
    mint: MINT,
    mintHex: hex(pk(MINT).toBytes()),
    pool: POOL,
    poolHex: hex(pk(POOL).toBytes()),
    tokenProgram: TOKEN_PROGRAM,
    tokenProgramHex: hex(pk(TOKEN_PROGRAM).toBytes()),
    ataProgram: ATA_PROGRAM,
    ataProgramHex: hex(pk(ATA_PROGRAM).toBytes()),
    decimals: DECIMALS,
    feeCeiling: FEE_CEILING.toString(),
  },
  programAddresses: [
    {
      label: 'pool = PDA(["pool", mint], programId)',
      seedsHex: [hex(enc.encode('pool')), hex(pk(MINT).toBytes())],
      program: PROGRAM_ID,
      address: poolPda.address,
      addressHex: hex(pk(poolPda.address).toBytes()),
      bump: poolPda.bump,
    },
    {
      label: 'merkle tree = PDA(["merkle", pool], programId)',
      seedsHex: [hex(enc.encode('merkle')), hex(pk(POOL).toBytes())],
      program: PROGRAM_ID,
      address: treePda.address,
      addressHex: hex(pk(treePda.address).toBytes()),
      bump: treePda.bump,
    },
    {
      label:
        'vault = ATA(pool, mint) — an off-curve owner, so findProgramAddress only',
      seedsHex: [
        hex(pk(POOL).toBytes()),
        hex(pk(TOKEN_PROGRAM).toBytes()),
        hex(pk(MINT).toBytes()),
      ],
      program: ATA_PROGRAM,
      address: vault.address,
      addressHex: hex(pk(vault.address).toBytes()),
      bump: vault.bump,
    },
  ],
  owners: ownerRows,
  badOwnerStrings,
  amounts: amountCases,
};

const text = JSON.stringify(fixture, null, 2) + '\n';
const summary = `${ownerRows.length} owners (${okCount} ok), ${badOwnerStrings.length} bad strings, ${amountCases.length} amounts${spl ? `; every ATA equal to @solana/spl-token ${spl.version}'s getAssociatedTokenAddressSync` : ''}`;
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== text) {
    fail(
      `${OUT_REL} differs from a fresh run — regenerate it and review the diff`,
    );
  }
  console.log(`gen-ata-vectors: ${OUT_REL} matches a fresh run (${summary})`);
} else {
  writeFileSync(OUT, text);
  console.log(`gen-ata-vectors: wrote ${OUT_REL} (${summary})`);
}
```

Run it (from the repository root; no network), then its own check, then the opt-in cross-check against `@solana/spl-token` (any checkout that has it installed — the dry run used the program side's, read-only):

```bash
node scripts/a0-vectors/gen-ata-vectors.mjs
node scripts/a0-vectors/gen-ata-vectors.mjs --check
node scripts/a0-vectors/gen-ata-vectors.mjs --check --spl-token=/home/user/Solana/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/node_modules/@solana/spl-token
wc -l native/noctura-prover/tests/fixtures/a0-ata-vectors.json
```

Expected:

```
gen-ata-vectors: wrote native/noctura-prover/tests/fixtures/a0-ata-vectors.json (15 owners (7 ok), 12 bad strings, 16 amounts)
gen-ata-vectors: native/noctura-prover/tests/fixtures/a0-ata-vectors.json matches a fresh run (15 owners (7 ok), 12 bad strings, 16 amounts)
gen-ata-vectors: native/noctura-prover/tests/fixtures/a0-ata-vectors.json matches a fresh run (15 owners (7 ok), 12 bad strings, 16 amounts; every ATA equal to @solana/spl-token 0.3.11's getAssociatedTokenAddressSync)
355 native/noctura-prover/tests/fixtures/a0-ata-vectors.json
```

The owner rows the fixture holds (verdict, `web3IsOnCurve`, ATA bump, owner):

```
ok           true   255  3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe  relayer fee payer 3jvhiz… (its ATA is the published fee ATA 9643…)
ok           true   254  GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd  pool authority GoBAm…
ok           true   255  3wpFT9KUKNWDEirjheHdZPX8sTMAkWmfiCAn6YsEio9N  test key 0
ok           true   255  9pS1k97fKFH9m9Ca3roZsrSwxSXvu8aZGGAQx6rKbGNJ  test key 1
ok           true   251  72YHUPg3Gx7P7JRhpiVDccKCU3bjCSpU5snR7aZALDbx  test key 2
ok           true   254  GkNcGS9SNMvRMX8rUCzZPnUtvqbdMNVcPZAp8HNefzfE  test key with ATA bump 254
ok           true   253  Hn8L2Qvhk34P4p1vo2YKhkA4CmU256B3bd3q9Bp3bBsJ  test key with ATA bump 253
smallOrder   true   255  11111111111111111111111111111111              the System Program 1111…1 (32 zero bytes: y = 0, a point of order 4)
smallOrder   true   255  4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM   the identity (y = 1)
smallOrder   true   254  Gx9dDNxzpALCowVuZb7pBceBLJugLA8sPa6TJDXrpfeW  y = p − 1 (order 2)
nonCanonical false  251  HDmFoMsLPWK4ShyobcBbmKd6NMAm9xYVj3L1JzmqhtHt  non-canonical y = p + 3
torsion      true   255  ARKbJCqjjHHndEd4Ri5hM5ZEMQpsbmoSmKYonYXQLKQG  test key 0 + a torsion point of order 8
offCurve     false  252  8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT  the pool PDA 8VMe…
offCurve     false  255  9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9  the relayer fee ATA 9643…
offCurve     false  254  JC1h673R7AJjgZe46tV7GQPwM487Y1JC1A924XvTacQa  raw bytes off/1
```

and `programAddresses`: pool `8VMe…` bump 253, tree `5URd…` bump 254, vault `3A7JjFg4ZbZrEsvAZReSaWxjCvi5NZUTAyAZaLfQjuYC` bump 252. The one row where `@solana/web3.js`'s `isOnCurve` (strict decoding, refuses `y ≥ p`) and the runtime (dalek, ZIP-215-style decoding) disagree is the non-canonical `y = p + 3`; the fixture records both and the test asserts it is the only divergence.

- [ ] **Step 3: Write the failing tests.**

Create `native/noctura-prover/src/a0/tests_unshield.rs`:

```rust
//! ATA derivation, `parseUnshield` and the unshield authorization (spec §3 "ATA derivation",
//! §4 steps 2 and 4, §14 "derive_ata… authorization refusals", INV-AUTH's Rust half), against
//! `tests/fixtures/a0-ata-vectors.json` — written OFFLINE by `scripts/a0-vectors/gen-ata-vectors.mjs`
//! from @solana/web3.js `findProgramAddressSync` / `isOnCurve` (spl-token's own calls; its run
//! with `--spl-token` also compared every ATA with spl-token 0.3.11), @noble/curves and
//! @scure/base, after recomputing the program side's pool / tree / relayer-fee-ATA addresses.
//! Rerun `node scripts/a0-vectors/gen-ata-vectors.mjs --check` to confirm it.
//!
//! Nothing here computes an expected value with the code under test.

use super::ata::{
    check_owner, derive_ata, find_program_address, is_on_curve, ATA_PROGRAM_ID, TOKEN_PROGRAM_ID,
};
use super::auth::{self, Auth, AuthId, AUTH_TTL};
use super::field::MINT;
use super::state::{A0Error, Core, Handle};
use super::unshield::{parse_unshield, DECIMALS, FEE_CEILING, POOL};
use serde_json::Value;
use std::collections::HashSet;
use std::time::Duration;

const ATA_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-ata-vectors.json"
));
/// The repo's public test seed (BIP-39 of the "abandon … about" mnemonic, no passphrase) — any
/// seed opens a session; these tests only need a live handle.
const SEED_HEX: &str = "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4";
/// An arbitrary point on the injected clock.
const T0: Duration = Duration::from_secs(1_000);

fn v() -> Value {
    serde_json::from_str(ATA_VECTORS).unwrap()
}
fn s(v: &Value) -> &str {
    v.as_str().unwrap()
}
fn b32(v: &Value) -> [u8; 32] {
    hex::decode(s(v)).unwrap().try_into().unwrap()
}
fn owners() -> Vec<Value> {
    v()["owners"].as_array().unwrap().clone()
}
fn ok_owners() -> Vec<Value> {
    owners()
        .into_iter()
        .filter(|o| s(&o["verdict"]) == "ok")
        .collect()
}
/// The relayer fee payer: its ATA is the program side's published fee ATA 9643….
fn relayer() -> Value {
    owners()
        .into_iter()
        .find(|o| s(&o["owner"]) == "3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe")
        .unwrap()
}
fn open(core: &Core) -> Handle {
    let mut seed: [u8; 64] = hex::decode(SEED_HEX).unwrap().try_into().unwrap();
    core.keys_open(&mut seed).unwrap()
}
fn take(core: &Core, h: Handle, id: &AuthId, now: Duration) -> Result<Auth, A0Error> {
    core.lock().unwrap().take_auth(h, id, now)
}
fn verdict_error(verdict: &str) -> Option<A0Error> {
    match verdict {
        "ok" => None,
        "offCurve" => Some(A0Error::OwnerOffCurve),
        "nonCanonical" => Some(A0Error::OwnerNonCanonical),
        "smallOrder" => Some(A0Error::OwnerSmallOrder),
        "torsion" => Some(A0Error::OwnerTorsion),
        other => panic!("unknown verdict {other}"),
    }
}

// ---------------------------------------------------------------- pinned constants (R3)

#[test]
fn the_pinned_addresses_decimals_and_ceiling_match_the_fixture() {
    let c = &v()["constants"];
    assert_eq!(TOKEN_PROGRAM_ID, b32(&c["tokenProgramHex"]));
    assert_eq!(ATA_PROGRAM_ID, b32(&c["ataProgramHex"]));
    assert_eq!(POOL, b32(&c["poolHex"]));
    assert_eq!(MINT, b32(&c["mintHex"]));
    assert_eq!(u64::from(DECIMALS), c["decimals"].as_u64().unwrap());
    assert_eq!(FEE_CEILING.to_string(), s(&c["feeCeiling"]));
    assert_eq!(
        s(&c["pool"]),
        "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT"
    );
    assert_eq!(
        s(&c["mint"]),
        "ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs"
    );
}

// ---------------------------------------------------------------- find_program_address

#[test]
fn find_program_address_matches_web3_for_the_programs_published_accounts() {
    // pool = PDA(["pool", mint]), tree = PDA(["merkle", pool]), vault = ATA(pool, mint)
    let rows = v()["programAddresses"].as_array().unwrap().clone();
    assert_eq!(rows.len(), 3);
    let consts = v()["constants"].clone();
    for r in &rows {
        let seeds: Vec<Vec<u8>> = r["seedsHex"]
            .as_array()
            .unwrap()
            .iter()
            .map(|x| hex::decode(s(x)).unwrap())
            .collect();
        let seed_refs: Vec<&[u8]> = seeds.iter().map(Vec::as_slice).collect();
        let program = if s(&r["program"]) == s(&consts["programId"]) {
            b32(&consts["programIdHex"])
        } else {
            assert_eq!(s(&r["program"]), s(&consts["ataProgram"]));
            ATA_PROGRAM_ID
        };
        let (address, bump) = find_program_address(&seed_refs, &program).unwrap();
        assert_eq!(address, b32(&r["addressHex"]), "{}", r["label"]);
        assert_eq!(
            u64::from(bump),
            r["bump"].as_u64().unwrap(),
            "{}",
            r["label"]
        );
    }
    assert_eq!(
        s(&rows[0]["address"]),
        "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT"
    );
    assert_eq!(
        s(&rows[1]["address"]),
        "5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc"
    );
}

#[test]
fn find_program_address_matches_web3_for_every_owner_row_including_refused_owners() {
    let mut bumps = HashSet::new();
    for o in owners() {
        let owner = b32(&o["ownerHex"]);
        let (ata, bump) =
            find_program_address(&[&owner, &TOKEN_PROGRAM_ID, &MINT], &ATA_PROGRAM_ID).unwrap();
        assert_eq!(ata, b32(&o["ataHex"]), "{}", o["label"]);
        assert_eq!(
            u64::from(bump),
            o["bump"].as_u64().unwrap(),
            "{}",
            o["label"]
        );
        bumps.insert(bump);
    }
    // the loop is exercised past its first candidate (an off-by-one in the bump order shows here)
    for want in [255u8, 254, 253] {
        assert!(bumps.contains(&want), "no row with bump {want}");
    }
    assert!(bumps.iter().any(|b| *b < 253));
}

#[test]
fn is_on_curve_is_the_chains_test_for_every_owner_row() {
    let mut divergent = 0;
    for o in owners() {
        let bytes = b32(&o["ownerHex"]);
        let chain_on_curve = s(&o["verdict"]) != "offCurve";
        assert_eq!(is_on_curve(&bytes), chain_on_curve, "{}", o["label"]);
        // web3.js decodes strictly (it refuses y >= p); the runtime (dalek) does not
        if o["web3IsOnCurve"].as_bool().unwrap() != chain_on_curve {
            assert_eq!(s(&o["verdict"]), "nonCanonical", "{}", o["label"]);
            divergent += 1;
        }
    }
    assert_eq!(
        divergent, 1,
        "the fixture's non-canonical row is the only divergence"
    );
    // every ATA in the fixture is off the curve, as a PDA must be
    for o in owners() {
        assert!(!is_on_curve(&b32(&o["ataHex"])), "{}", o["label"]);
    }
}

// ---------------------------------------------------------------- the owner (m3) and derive_ata

#[test]
fn derive_ata_equals_spl_tokens_derivation_for_every_accepted_owner() {
    let ok = ok_owners();
    assert!(
        ok.len() >= 5,
        "at least three fixed owners (spec §14), got {}",
        ok.len()
    );
    for o in &ok {
        assert_eq!(
            derive_ata(&b32(&o["ownerHex"])).unwrap(),
            b32(&o["ataHex"]),
            "{}",
            o["label"]
        );
    }
    // the program side's own fact: ATA(3jvhiz…, ERkp…) is the relayer's fee ATA
    assert_eq!(
        s(&relayer()["ata"]),
        "9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9"
    );
}

#[test]
fn every_refused_owner_is_refused_with_its_reason_and_no_ata() {
    let mut seen = HashSet::new();
    for o in owners() {
        let want = verdict_error(s(&o["verdict"]));
        let bytes = b32(&o["ownerHex"]);
        match want {
            None => {
                assert_eq!(check_owner(&bytes), Ok(()), "{}", o["label"]);
            }
            Some(err) => {
                seen.insert(s(&o["verdict"]).to_string());
                assert_eq!(check_owner(&bytes), Err(err), "{}", o["label"]);
                let err = verdict_error(s(&o["verdict"])).unwrap();
                assert_eq!(derive_ata(&bytes), Err(err), "{}", o["label"]);
            }
        }
    }
    assert_eq!(
        seen.len(),
        4,
        "offCurve, nonCanonical, smallOrder, torsion: {seen:?}"
    );
}

#[test]
fn a_pda_owner_is_refused_positive_and_negative_control() {
    // the pool PDA and the relayer's fee ATA: valid addresses, but no key holds them
    for pda in [
        "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT",
        "9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9",
    ] {
        assert_eq!(
            parse_unshield(pda, "1", "0"),
            Err(A0Error::OwnerOffCurve),
            "{pda}"
        );
    }
    // the System Program's 32 zero bytes are ON the curve for Solana, and still refused
    assert_eq!(
        parse_unshield("11111111111111111111111111111111", "1", "0"),
        Err(A0Error::OwnerSmallOrder)
    );
    // positive control: the relayer fee payer, an ordinary key, is accepted
    assert!(parse_unshield(s(&relayer()["owner"]), "1", "0").is_ok());
}

#[test]
fn owner_strings_that_are_not_32_bytes_of_canonical_base58_are_refused() {
    let bad = v()["badOwnerStrings"].as_array().unwrap().clone();
    assert!(bad.len() >= 10);
    for b in &bad {
        let want = match s(&b["error"]) {
            "base58" => A0Error::OwnerNotBase58,
            "length" => A0Error::OwnerLength {
                got: usize::try_from(b["got"].as_u64().unwrap()).unwrap(),
            },
            other => panic!("unknown error {other}"),
        };
        assert_eq!(
            parse_unshield(s(&b["s"]), "1", "0"),
            Err(want),
            "{}",
            b["label"]
        );
    }
}

// ---------------------------------------------------------------- parseUnshield (§4 step 2)

#[test]
fn parse_unshield_returns_rusts_own_values_and_the_pinned_pool() {
    let r = relayer();
    let u = parse_unshield(s(&r["owner"]), "1500000000", "10000").unwrap();
    assert_eq!(u.owner, s(&r["owner"]));
    assert_eq!(u.ata, s(&r["ata"]));
    assert_eq!(u.amount, 1_500_000_000);
    assert_eq!(u.fee, 10_000);
    assert_eq!(u.human_amount, "1.5");
    assert_eq!(u.human_fee, "0.00001");
    assert_eq!(u.pool, s(&v()["constants"]["pool"]));
    // every accepted owner round-trips to its own spelling and the fixture's ATA
    for o in ok_owners() {
        let u = parse_unshield(s(&o["owner"]), "1", "0").unwrap();
        assert_eq!(u.owner, s(&o["owner"]));
        assert_eq!(u.ata, s(&o["ata"]), "{}", o["label"]);
    }
}

#[test]
fn human_amounts_match_the_offline_bigint_rendering() {
    let owner = s(&relayer()["owner"]).to_string();
    let rows = v()["amounts"].as_array().unwrap().clone();
    assert!(rows.len() >= 10);
    for r in &rows {
        let units = s(&r["units"]);
        let u = parse_unshield(&owner, units, "0").unwrap();
        assert_eq!(u.human_amount, s(&r["human"]), "amount {units}");
        assert_eq!(u.amount.to_string(), units);
        if units.parse::<u64>().unwrap() <= FEE_CEILING {
            let f = parse_unshield(&owner, "1", units).unwrap();
            assert_eq!(f.human_fee, s(&r["human"]), "fee {units}");
        }
    }
    assert_eq!(parse_unshield(&owner, "1", "0").unwrap().human_fee, "0");
}

#[test]
fn amount_and_fee_are_canonical_decimal_u64_strings() {
    let owner = s(&relayer()["owner"]).to_string();
    for bad in [
        "",
        "+1",
        "-1",
        " 1",
        "1 ",
        "01",
        "00",
        "1e3",
        "0x10",
        "1_000",
        "1.0",
        "١",
        "18446744073709551616",
        "99999999999999999999999",
    ] {
        assert_eq!(
            parse_unshield(&owner, bad, "0"),
            Err(A0Error::NotU64 { what: "amount" }),
            "amount {bad:?}"
        );
        assert_eq!(
            parse_unshield(&owner, "1", bad),
            Err(A0Error::NotU64 { what: "fee" }),
            "fee {bad:?}"
        );
    }
    // positive controls: the u64 edge, and 0 for the fee
    assert_eq!(
        parse_unshield(&owner, "18446744073709551615", "0")
            .unwrap()
            .amount,
        u64::MAX
    );
    assert_eq!(parse_unshield(&owner, "10", "0").unwrap().fee, 0);
}

#[test]
fn amount_zero_fee_ceiling_and_overflow_are_refused_at_their_edges() {
    let owner = s(&relayer()["owner"]).to_string();
    assert_eq!(parse_unshield(&owner, "0", "0"), Err(A0Error::AmountZero));
    assert!(parse_unshield(&owner, "1", "1000000").is_ok());
    assert_eq!(
        parse_unshield(&owner, "1", "1000001"),
        Err(A0Error::FeeAboveCeiling)
    );
    assert_eq!(
        parse_unshield(&owner, "18446744073709551615", "1"),
        Err(A0Error::AmountPlusFeeOverflow)
    );
    assert!(parse_unshield(&owner, "18446744073709551614", "1").is_ok());
    // the owner is checked before the numbers
    assert_eq!(
        parse_unshield("11111111111111111111111111111111", "0", "x"),
        Err(A0Error::OwnerSmallOrder)
    );
}

#[test]
fn refusals_carry_no_input_value() {
    let owner = s(&relayer()["owner"]).to_string();
    let refusals = [
        parse_unshield(&owner, "123456789012", "77777777").unwrap_err(),
        parse_unshield(&owner, "98765x", "0").unwrap_err(),
        parse_unshield("8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT", "1", "0").unwrap_err(),
    ];
    for e in &refusals {
        let text = e.to_string();
        for leak in ["123456789012", "77777777", "98765", "8VMe", &owner[..8]] {
            assert!(!text.contains(leak), "{text:?} contains {leak:?}");
        }
    }
}

// ---------------------------------------------------------------- the authorization (§4 step 4)

#[test]
fn authorize_records_rusts_parsed_values_and_the_first_take_returns_them() {
    let core = Core::new();
    let h = open(&core);
    let r = relayer();
    let id = core
        .authorize_unshield_at(h, s(&r["owner"]), "700000", "50000", T0)
        .unwrap();
    let a = take(&core, h, &id, T0).unwrap();
    assert_eq!(a.owner, b32(&r["ownerHex"]));
    assert_eq!(a.ata, b32(&r["ataHex"]));
    assert_eq!(a.amount, 700_000);
    assert_eq!(a.fee, 50_000);
    assert_eq!(a.pool, b32(&v()["constants"]["poolHex"]));
    assert_eq!(a.mint, b32(&v()["constants"]["mintHex"]));
    assert_eq!(a.handle, h);
    assert_eq!(a.expires_at, T0 + Duration::from_secs(120));
    assert_eq!(AUTH_TTL, Duration::from_secs(120));
}

#[test]
fn authorize_refuses_what_parse_refuses_and_an_unknown_handle_and_records_nothing() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    assert_eq!(
        core.authorize_unshield_at(
            h,
            "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT",
            "1",
            "0",
            T0
        )
        .unwrap_err(),
        A0Error::OwnerOffCurve
    );
    assert_eq!(
        core.authorize_unshield_at(h, &owner, "0", "0", T0)
            .unwrap_err(),
        A0Error::AmountZero
    );
    assert_eq!(
        core.authorize_unshield_at(h, &owner, "1", "1000001", T0)
            .unwrap_err(),
        A0Error::FeeAboveCeiling
    );
    assert_eq!(
        core.authorize_unshield_at(Handle::from_raw(h.raw() + 1_000_000), &owner, "1", "0", T0)
            .unwrap_err(),
        A0Error::UnknownHandle
    );
    // nothing was recorded by any refusal: a fresh authorization is not "in flight"-blocked
    let id = core.authorize_unshield_at(h, &owner, "1", "0", T0).unwrap();
    assert!(take(&core, h, &id, T0).is_ok());
}

#[test]
fn the_first_take_consumes_the_authorization_success_or_failure() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    // a successful take, then the same id again
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert!(take(&core, h, &id, T0).is_ok());
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // a take with a wrong id uses up the live one
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    let wrong = AuthId::from_bytes([0x5a; 16]);
    assert_eq!(
        take(&core, h, &wrong, T0).unwrap_err(),
        A0Error::AuthMismatch
    );
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // an id that differs from the live one in its LAST byte only is another id
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    let mut near = id.to_bytes();
    near[15] ^= 1;
    assert_eq!(
        take(&core, h, &AuthId::from_bytes(near), T0).unwrap_err(),
        A0Error::AuthMismatch
    );
    // an expired take uses it up too
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert_eq!(
        take(&core, h, &id, T0 + AUTH_TTL).unwrap_err(),
        A0Error::AuthExpired
    );
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // and never authorized at all
    let fresh = Core::new();
    let h2 = open(&fresh);
    assert_eq!(
        take(&fresh, h2, &AuthId::from_bytes([0; 16]), T0).unwrap_err(),
        A0Error::AuthAbsent
    );
}

#[test]
fn the_authorization_is_usable_for_exactly_120_seconds_from_approval() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let last_ns = T0 + AUTH_TTL - Duration::from_nanos(1);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert!(
        take(&core, h, &id, last_ns).is_ok(),
        "usable 1 ns before expiry"
    );
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert_eq!(
        take(&core, h, &id, T0 + Duration::from_secs(120)).unwrap_err(),
        A0Error::AuthExpired,
        "refused at approval + 120 s"
    );
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert_eq!(
        take(&core, h, &id, T0 + Duration::from_secs(3600)).unwrap_err(),
        A0Error::AuthExpired
    );
}

#[test]
fn one_authorization_at_a_time() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let first = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert_eq!(
        core.authorize_unshield_at(h, &owner, "6", "0", T0 + Duration::from_secs(119))
            .unwrap_err(),
        A0Error::AuthInFlight
    );
    // the refused second request did not disturb the first
    let a = take(&core, h, &first, T0).unwrap();
    assert_eq!(a.amount, 5);
    // once taken, a new one may be recorded
    let second = core.authorize_unshield_at(h, &owner, "6", "0", T0).unwrap();
    // once expired, it no longer blocks: it is replaced, and its id is dead
    let third = core
        .authorize_unshield_at(h, &owner, "7", "0", T0 + AUTH_TTL)
        .unwrap();
    assert_eq!(
        take(&core, h, &second, T0 + AUTH_TTL).unwrap_err(),
        A0Error::AuthMismatch
    );
    let fourth = core
        .authorize_unshield_at(h, &owner, "8", "0", T0 + AUTH_TTL)
        .unwrap();
    let a = take(&core, h, &fourth, T0 + AUTH_TTL).unwrap();
    assert_eq!(a.amount, 8);
    assert!(!third.same(&fourth));
}

#[test]
fn close_and_reopen_invalidate_the_authorization() {
    let owner = s(&relayer()["owner"]).to_string();
    // keysClose
    let core = Core::new();
    let h = open(&core);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    core.keys_close(h).unwrap();
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::UnknownHandle);
    let h2 = open(&core);
    assert_eq!(take(&core, h2, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // a second keysOpen
    let core = Core::new();
    let h = open(&core);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    let h2 = open(&core);
    assert_eq!(take(&core, h2, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::UnknownHandle);
    // a REFUSED second keysOpen still ends the session and its authorization
    let core = Core::new();
    let h = open(&core);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert!(core.keys_open(&mut [9u8; 10]).is_err());
    let h2 = open(&core);
    assert_eq!(take(&core, h2, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // positive control: without a close or an open, the same sequence succeeds
    let core = Core::new();
    let h = open(&core);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert!(take(&core, h, &id, T0).is_ok());
}

#[test]
fn a_record_under_another_handle_is_refused() {
    // Unreachable through the API (end_session clears the record with its session); planted
    // here so the check behind it is a tested check, not a comment.
    let core = Core::new();
    let h = open(&core);
    let id = AuthId::from_bytes([7; 16]);
    let planted = |handle: Handle| Auth {
        id,
        handle,
        owner: b32(&relayer()["ownerHex"]),
        ata: b32(&relayer()["ataHex"]),
        amount: 5,
        fee: 0,
        pool: POOL,
        mint: MINT,
        expires_at: T0 + AUTH_TTL,
    };
    core.lock()
        .unwrap()
        .plant_auth_for_test(planted(Handle::from_raw(h.raw() ^ 1)));
    assert_eq!(
        take(&core, h, &id, T0).unwrap_err(),
        A0Error::AuthWrongHandle
    );
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // positive control: the same record under the live handle is accepted
    core.lock().unwrap().plant_auth_for_test(planted(h));
    assert!(take(&core, h, &id, T0).is_ok());
}

#[test]
fn a_poisoned_state_drops_the_authorization() {
    let core = std::sync::Arc::new(Core::new());
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    let c = core.clone();
    let _ = std::thread::spawn(move || c.poison_for_test()).join();
    assert_eq!(
        core.authorize_unshield_at(h, &owner, "5", "0", T0)
            .unwrap_err(),
        A0Error::StatePoisoned
    );
    // the record went with the keys: the raw inner state behind the poison holds none
    let mut inner = core.lock_ignoring_poison_for_test();
    assert_eq!(inner.peek_auth_expiry_for_test(), None);
    assert_eq!(
        inner.take_auth(h, &id, T0).unwrap_err(),
        A0Error::UnknownHandle
    );
}

#[test]
fn auth_ids_come_from_the_os_rng_not_from_the_data() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let mut ids = HashSet::new();
    for _ in 0..64 {
        // the same request every time: an id derived from the data would repeat
        let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
        assert!(take(&core, h, &id, T0).is_ok());
        let bytes = id.to_bytes();
        assert_ne!(bytes, [0u8; 16]);
        ids.insert(bytes);
    }
    assert_eq!(ids.len(), 64, "64 equal requests, 64 distinct ids");
    assert_eq!(
        format!("{:?}", AuthId::from_bytes([0xab; 16])),
        "AuthId(..)"
    );
}

#[test]
fn the_real_clock_advances_and_the_public_authorize_uses_it() {
    let a = auth::now().unwrap();
    std::thread::sleep(Duration::from_millis(30));
    let b = auth::now().unwrap();
    assert!(b - a >= Duration::from_millis(30), "{a:?} → {b:?}");
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let id = core.authorize_unshield(h, &owner, "5", "0").unwrap();
    let after = auth::now().unwrap();
    // recorded at a time between `b` and `after`: still live now, dead 120 s from now
    let probe = core.lock().unwrap().peek_auth_expiry_for_test().unwrap();
    assert!(
        probe >= b + AUTH_TTL && probe <= after + AUTH_TTL,
        "{probe:?}"
    );
    assert!(take(&core, h, &id, after).is_ok());
}
```

Apply to `native/noctura-prover/src/a0/mod.rs` (the modules this task creates, their re-exports and the test module):

```diff
diff --git a/native/noctura-prover/src/a0/mod.rs b/native/noctura-prover/src/a0/mod.rs
index dc3ce73..918584b 100644
--- a/native/noctura-prover/src/a0/mod.rs
+++ b/native/noctura-prover/src/a0/mod.rs
@@ -1,19 +1,28 @@
 //! A0 shielded keys and field values (spec 2026-11-08 shielded A0 M1 §3): EIP-2333 `sk`, `nk`,
 //! `ivk`, `d_self`, `addrField`, `mintHash`, commitments, deposit `rho(i)`, the internal
-//! nullifier, `rho_change`, `matchSpent`, and the one `Mutex` state that holds them.
+//! nullifier, `rho_change`, `matchSpent`, and the one `Mutex` state that holds them; the
+//! unshield destination's ATA, `parseUnshield` and the single-use unshield authorization.
 //!
 //! The public surface is [`state`]'s [`Core`] / [`Handle`] / [`A0Error`]: it takes a seed and
 //! returns only values that are public once used (a deposit `rho`, a commitment, the indices of
-//! spent own notes). Every secret lives in the crate-private `keys` module.
+//! spent own notes). Every secret lives in the crate-private `keys` module. `parse_unshield`
+//! and `Core::authorize_unshield` are Kotlin-only (the native dialog's); no key crosses them.
 
+mod ata;
+mod auth;
 mod eip2333;
 mod field;
 mod keys;
 pub mod state;
+mod unshield;
 
+pub use auth::AuthId;
 pub use state::{A0Error, Core, Handle, CORE};
+pub use unshield::{parse_unshield, Unshield, DECIMALS, FEE_CEILING};
 
 #[cfg(test)]
 mod tests;
 #[cfg(test)]
+mod tests_unshield;
+#[cfg(test)]
 mod wipe_probe;
```

- [ ] **Step 4: Run the tests — red, for the right reason.**

```bash
cd native/noctura-prover && cargo test --locked 2>&1 | grep -E "^error|^warning: unused|could not compile" | sort | uniq -c
```

Expected:

```
      1 error: could not compile `noctura-prover` (lib) due to 3 previous errors
      1 error: could not compile `noctura-prover` (lib test) due to 67 previous errors
      1 error[E0583]: file not found for module `ata`
      1 error[E0583]: file not found for module `auth`
      1 error[E0583]: file not found for module `unshield`
      2 error[E0599]: no method named `authorize_unshield_at` found for struct `Arc<Core>` in the current scope
     23 error[E0599]: no method named `authorize_unshield_at` found for struct `Core` in the current scope
      1 error[E0599]: no method named `authorize_unshield` found for struct `Core` in the current scope
      1 error[E0599]: no method named `lock_ignoring_poison_for_test` found for struct `Arc<Core>` in the current scope
      1 error[E0599]: no method named `peek_auth_expiry_for_test` found for struct `std::sync::MutexGuard<'_, Inner>` in the current scope
      2 error[E0599]: no method named `plant_auth_for_test` found for struct `std::sync::MutexGuard<'_, Inner>` in the current scope
      1 error[E0599]: no method named `take_auth` found for struct `std::sync::MutexGuard<'_, Inner>` in the current scope
      2 error[E0599]: no variant named `NotU64` found for enum `A0Error`
      1 error[E0599]: no variant named `OwnerLength` found for enum `A0Error`
      1 error[E0599]: no variant or associated item named `AmountPlusFeeOverflow` found for enum `A0Error` in the current scope
      2 error[E0599]: no variant or associated item named `AmountZero` found for enum `A0Error` in the current scope
      8 error[E0599]: no variant or associated item named `AuthAbsent` found for enum `A0Error` in the current scope
      3 error[E0599]: no variant or associated item named `AuthExpired` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `AuthInFlight` found for enum `A0Error` in the current scope
      3 error[E0599]: no variant or associated item named `AuthMismatch` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `AuthWrongHandle` found for enum `A0Error` in the current scope
      2 error[E0599]: no variant or associated item named `FeeAboveCeiling` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `OwnerNonCanonical` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `OwnerNotBase58` found for enum `A0Error` in the current scope
      3 error[E0599]: no variant or associated item named `OwnerOffCurve` found for enum `A0Error` in the current scope
      3 error[E0599]: no variant or associated item named `OwnerSmallOrder` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `OwnerTorsion` found for enum `A0Error` in the current scope
```

Every error is a module this task creates or an item it adds to `state.rs`; nothing else fails to resolve (the crates, the fixture and Task 1's code are in place).

- [ ] **Step 5: Implement.**

Create `native/noctura-prover/src/a0/ata.rs`:

```rust
//! Solana program addresses and the unshield destination's token account (spec §3 "ATA
//! derivation", C1, m3).
//!
//! - `find_program_address`: SHA-256(seeds ‖ [bump] ‖ program id ‖ "ProgramDerivedAddress"),
//!   bump from 255 down to 1 (the Solana runtime's and web3.js's loop; bump 0 is never tried),
//!   the first candidate that is OFF the Ed25519 curve.
//! - "On the curve" is the runtime's own test: `CompressedEdwardsY::decompress().is_some()` with
//!   the curve25519-dalek version the runtime uses (4.1.3).
//! - The unshield owner must be a possible Ed25519 PUBLIC KEY, which is stricter than "on the
//!   curve": the canonical encoding of a point of the prime-order subgroup other than the
//!   identity. A PDA (off curve), a small-order point (the System Program's 32 zero bytes is
//!   one), a point with a torsion component or a non-canonical encoding has no key a person
//!   holds, so tokens sent to its ATA could not be moved by the recipient. Refused (m3).

use super::field::MINT;
use super::state::A0Error;
use curve25519_dalek::edwards::CompressedEdwardsY;
use sha2::{Digest, Sha256};

/// `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` — the classic SPL Token program (the pool's).
pub(crate) const TOKEN_PROGRAM_ID: [u8; 32] = [
    0x06, 0xdd, 0xf6, 0xe1, 0xd7, 0x65, 0xa1, 0x93, 0xd9, 0xcb, 0xe1, 0x46, 0xce, 0xeb, 0x79, 0xac,
    0x1c, 0xb4, 0x85, 0xed, 0x5f, 0x5b, 0x37, 0x91, 0x3a, 0x8c, 0xf5, 0x85, 0x7e, 0xff, 0x00, 0xa9,
];

/// `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` — the Associated Token Account program.
pub(crate) const ATA_PROGRAM_ID: [u8; 32] = [
    0x8c, 0x97, 0x25, 0x8f, 0x4e, 0x24, 0x89, 0xf1, 0xbb, 0x3d, 0x10, 0x29, 0x14, 0x8e, 0x0d, 0x83,
    0x0b, 0x5a, 0x13, 0x99, 0xda, 0xff, 0x10, 0x84, 0x04, 0x8e, 0x7b, 0xd8, 0xdb, 0xe9, 0xf8, 0x59,
];

const PDA_MARKER: &[u8] = b"ProgramDerivedAddress";

/// The Solana runtime's `is_on_curve`: the 32 bytes decompress to an Ed25519 point.
pub(crate) fn is_on_curve(bytes: &[u8; 32]) -> bool {
    CompressedEdwardsY(*bytes).decompress().is_some()
}

/// `Pubkey::find_program_address(seeds, program_id)`: the address and its bump, or `None` if
/// every bump 255..=1 lands on the curve (never observed; probability ~2^-255).
pub(crate) fn find_program_address(
    seeds: &[&[u8]],
    program_id: &[u8; 32],
) -> Option<([u8; 32], u8)> {
    for bump in (1..=u8::MAX).rev() {
        let mut h = Sha256::new();
        for s in seeds {
            h.update(s);
        }
        h.update([bump]);
        h.update(program_id);
        h.update(PDA_MARKER);
        let candidate: [u8; 32] = h.finalize().into();
        if !is_on_curve(&candidate) {
            return Some((candidate, bump));
        }
    }
    None
}

/// Refuses an owner that is not a possible Ed25519 public key (module doc), in this order:
/// off curve, non-canonical encoding, small order, torsion component.
pub(crate) fn check_owner(owner: &[u8; 32]) -> Result<(), A0Error> {
    let compressed = CompressedEdwardsY(*owner);
    let point = compressed.decompress().ok_or(A0Error::OwnerOffCurve)?;
    if point.compress() != compressed {
        return Err(A0Error::OwnerNonCanonical);
    }
    if point.is_small_order() {
        return Err(A0Error::OwnerSmallOrder);
    }
    if !point.is_torsion_free() {
        return Err(A0Error::OwnerTorsion);
    }
    Ok(())
}

/// `ata = ATA(owner, pinned mint)` = `find_program_address([owner, TOKEN_PROGRAM_ID, MINT],
/// ATA_PROGRAM_ID)`, after [`check_owner`].
pub(crate) fn derive_ata(owner: &[u8; 32]) -> Result<[u8; 32], A0Error> {
    check_owner(owner)?;
    find_program_address(&[owner, &TOKEN_PROGRAM_ID, &MINT], &ATA_PROGRAM_ID)
        .map(|(ata, _bump)| ata)
        .ok_or(A0Error::NoProgramAddress)
}
```

Create `native/noctura-prover/src/a0/unshield.rs`:

```rust
//! `parseUnshield(owner, amount, fee)` (spec §4 step 2, R3, m3, m-3): the values the native
//! confirmation dialog shows, every one of them computed here — JS supplies only the three
//! strings, and nothing it could pass changes the pool, the mint or the decimals.
//!
//! - `owner`: base58 of exactly 32 bytes (a 32-byte value has one spelling) and a possible
//!   Ed25519 public key (`ata::check_owner`); `ata = ATA(owner, pinned mint)` is derived here.
//! - `amount`, `fee`: decimal u64 strings, digits only, no sign, no leading zero, no spaces;
//!   `amount > 0`; `fee <= FEE_CEILING` (a sanity ceiling pinned here, NOT `pool.max_fee`, which
//!   the pool authority can change — the chain enforces that one); `amount + fee` fits a u64
//!   (`amount + fee <= inputAmount` is checked at `prove`, where `inputAmount` is bound).
//! - Human amounts with the pinned decimals, in integer arithmetic only (cardinal rule 2).

use super::ata::derive_ata;
use super::state::A0Error;

/// The devnet A0 pool `8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT` (spec §1, R3).
pub(crate) const POOL: [u8; 32] = [
    0x6f, 0x45, 0x68, 0x63, 0xaa, 0x9a, 0xfa, 0x9a, 0xfa, 0x96, 0x05, 0x29, 0x1f, 0x51, 0x4e, 0x06,
    0xae, 0x05, 0x8c, 0x2a, 0x72, 0x51, 0xac, 0x0b, 0x42, 0x37, 0x29, 0x3d, 0x1b, 0xfc, 0xef, 0x96,
];

/// The pinned mint's decimals — a fact: the devnet mint account `ERkp…` carries `decimals: 9`
/// (created by the program side's `scripts/a0-devnet-acceptance.mjs` with `createMint(…, 9)`).
pub const DECIMALS: u32 = 9;

/// The relayer-fee sanity ceiling in base units (m-3): 10× the pool's current `max_fee`.
pub const FEE_CEILING: u64 = 1_000_000;

/// What the dialog shows (spec §3 `parseUnshield -> {owner, ata, amount, fee, humanAmount,
/// humanFee, pool}`). Every field is computed in Rust; the addresses are base58 of the bytes
/// Rust holds, not the caller's strings.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Unshield {
    pub owner: String,
    pub ata: String,
    pub amount: u64,
    pub fee: u64,
    pub human_amount: String,
    pub human_fee: String,
    pub pool: String,
}

/// The parsed request as bytes — what an authorization records.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Parsed {
    pub(crate) owner: [u8; 32],
    pub(crate) ata: [u8; 32],
    pub(crate) amount: u64,
    pub(crate) fee: u64,
}

/// A decimal u64 in its one canonical spelling: `0`, or a non-zero digit then digits.
fn parse_u64(s: &str, what: &'static str) -> Result<u64, A0Error> {
    let b = s.as_bytes();
    let canonical =
        !b.is_empty() && b.iter().all(u8::is_ascii_digit) && (b.len() == 1 || b[0] != b'0');
    if !canonical {
        return Err(A0Error::NotU64 { what });
    }
    s.parse::<u64>().map_err(|_| A0Error::NotU64 { what })
}

fn parse_owner(s: &str) -> Result<[u8; 32], A0Error> {
    let bytes = bs58::decode(s)
        .into_vec()
        .map_err(|_| A0Error::OwnerNotBase58)?;
    let owner: [u8; 32] = bytes
        .as_slice()
        .try_into()
        .map_err(|_| A0Error::OwnerLength { got: bytes.len() })?;
    // No re-encode check is needed: a base58 string's leading '1's are exactly its leading zero
    // bytes and the rest is a number without leading zeros, so a 32-byte decode has one spelling.
    Ok(owner)
}

pub(crate) fn parse(owner: &str, amount: &str, fee: &str) -> Result<Parsed, A0Error> {
    let owner = parse_owner(owner)?;
    let ata = derive_ata(&owner)?;
    let amount = parse_u64(amount, "amount")?;
    let fee = parse_u64(fee, "fee")?;
    if amount == 0 {
        return Err(A0Error::AmountZero);
    }
    if fee > FEE_CEILING {
        return Err(A0Error::FeeAboveCeiling);
    }
    if amount.checked_add(fee).is_none() {
        return Err(A0Error::AmountPlusFeeOverflow);
    }
    Ok(Parsed {
        owner,
        ata,
        amount,
        fee,
    })
}

/// Base units → the human amount with [`DECIMALS`]: the whole part, then `.` and the fraction
/// with its trailing zeros removed (no `.` when the fraction is zero). No grouping, no locale.
pub(crate) fn human(units: u64) -> String {
    let scale = 10u64.pow(DECIMALS);
    let (whole, frac) = (units / scale, units % scale);
    if frac == 0 {
        return whole.to_string();
    }
    let digits = format!("{frac:0width$}", width = DECIMALS as usize);
    format!("{whole}.{}", digits.trim_end_matches('0'))
}

impl Parsed {
    pub(crate) fn render(&self) -> Unshield {
        Unshield {
            owner: bs58::encode(self.owner).into_string(),
            ata: bs58::encode(self.ata).into_string(),
            amount: self.amount,
            fee: self.fee,
            human_amount: human(self.amount),
            human_fee: human(self.fee),
            pool: bs58::encode(POOL).into_string(),
        }
    }
}

/// `parseUnshield(owner, amount, fee)` — Kotlin only (spec §3); needs no key handle.
pub fn parse_unshield(owner: &str, amount: &str, fee: &str) -> Result<Unshield, A0Error> {
    parse(owner, amount, fee).map(|p| p.render())
}
```

Create `native/noctura-prover/src/a0/auth.rs`:

```rust
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
#[cfg_attr(
    not(test),
    expect(dead_code, reason = "consumed by Task 3's withdraw_change prove")
)]
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
```

Apply to `native/noctura-prover/src/a0/state.rs`:

```diff
diff --git a/native/noctura-prover/src/a0/state.rs b/native/noctura-prover/src/a0/state.rs
index 3fb9285..76a0e2b 100644
--- a/native/noctura-prover/src/a0/state.rs
+++ b/native/noctura-prover/src/a0/state.rs
@@ -1,6 +1,7 @@
 //! The one `Mutex` state of the A0 core (spec §3 "Rust state", m5) and its public surface —
 //! the functions the JNI binds (Task 4): `keys_open`, `keys_close`, `deposit_rho`,
-//! `match_spent`, `commitment`. Each returns only values that are public once used.
+//! `match_spent`, `commitment`, `authorize_unshield`. Each returns only values that are public
+//! once used (an `AuthId` carries nothing but a random token).
 //!
 //! Rules (spec §3, m5):
 //! - one session at a time; `keys_open` ALWAYS ends the previous one — even when it then refuses
@@ -10,13 +11,27 @@
 //! - `keys_close` with a handle that is not the live one is refused and closes nothing;
 //! - a poisoned lock (a panic while holding it) wipes the keys and refuses every later call:
 //!   fail closed until the process restarts.
+//!
+//! The unshield authorization (spec §4 step 4, INV-AUTH) lives behind the same lock, so the
+//! UI thread's `authorize_unshield` and the proving thread's `take_auth` never see it half
+//! written:
+//! - at most one at a time: `authorize_unshield` is refused while a live (unexpired) one exists;
+//!   an expired one is dropped and replaced;
+//! - recorded under the live handle and cleared by [`Inner::end_session`] — so `keys_close`, a
+//!   second `keys_open` (even a refused one) and a poisoned lock all invalidate it;
+//! - consumed by the FIRST `take_auth`, whatever that call then decides (a wrong id, another
+//!   handle or an expired record still uses it up — fail closed);
+//! - usable while `now < approval + 120 s` on the boot clock (`auth::now`).
 
-use super::field::{fr_from_be32, fr_to_be32, Fr};
+use super::auth::{self, Auth, AuthId, AUTH_TTL};
+use super::field::{fr_from_be32, fr_to_be32, Fr, MINT};
 use super::keys::Keys;
+use super::unshield::{self, POOL};
 use std::collections::HashSet;
 use std::fmt;
 use std::sync::atomic::{AtomicU64, Ordering};
 use std::sync::{Mutex, MutexGuard};
+use std::time::Duration;
 use zeroize::Zeroizing;
 
 /// The process-wide state the JNI binds to (Task 4). Tests use their own `Core::new()`.
@@ -51,6 +66,42 @@ pub enum A0Error {
     DuplicateRho { index: usize },
     /// A thread panicked while holding the state; the keys were wiped.
     StatePoisoned,
+    /// The unshield owner is not base58 (a character outside the alphabet).
+    OwnerNotBase58,
+    /// The unshield owner does not decode to 32 bytes.
+    OwnerLength { got: usize },
+    /// The unshield owner is off the Ed25519 curve (a PDA, for one) — m3.
+    OwnerOffCurve,
+    /// The unshield owner decompresses, but is not the canonical encoding of its point.
+    OwnerNonCanonical,
+    /// The unshield owner is a point of order 1, 2, 4 or 8 (the System Program's bytes, for one).
+    OwnerSmallOrder,
+    /// The unshield owner has a torsion component (not a possible Ed25519 public key).
+    OwnerTorsion,
+    /// No bump 255..=1 gives an off-curve address (never observed).
+    NoProgramAddress,
+    /// `amount` or `fee` is not a canonical decimal u64.
+    NotU64 { what: &'static str },
+    /// The unshield amount is 0.
+    AmountZero,
+    /// The relayer fee is above the pinned sanity ceiling.
+    FeeAboveCeiling,
+    /// `amount + fee` does not fit a u64.
+    AmountPlusFeeOverflow,
+    /// An authorization is already live; one at a time.
+    AuthInFlight,
+    /// No live authorization (never given, already used, or cleared with its session).
+    AuthAbsent,
+    /// The id is not the live authorization's (the live one is now used up).
+    AuthMismatch,
+    /// The live authorization was recorded under another handle (it is now used up).
+    AuthWrongHandle,
+    /// The authorization's 120 s have passed (it is now used up).
+    AuthExpired,
+    /// The OS random source failed.
+    Rng,
+    /// The boot clock could not be read.
+    Clock,
 }
 
 impl fmt::Display for A0Error {
@@ -63,6 +114,39 @@ impl fmt::Display for A0Error {
             }
             A0Error::DuplicateRho { index } => write!(f, "ownRhos[{index}] repeats an earlier rho"),
             A0Error::StatePoisoned => write!(f, "shielded key state poisoned; restart the app"),
+            A0Error::OwnerNotBase58 => write!(f, "destination owner is not a base58 address"),
+            A0Error::OwnerLength { got } => {
+                write!(f, "destination owner must be 32 bytes, got {got}")
+            }
+            A0Error::OwnerOffCurve => {
+                write!(
+                    f,
+                    "destination owner is off the curve (not a wallet address)"
+                )
+            }
+            A0Error::OwnerNonCanonical => {
+                write!(
+                    f,
+                    "destination owner is not a canonical public key encoding"
+                )
+            }
+            A0Error::OwnerSmallOrder | A0Error::OwnerTorsion => {
+                write!(f, "destination owner is not a possible wallet public key")
+            }
+            A0Error::NoProgramAddress => write!(f, "no program address for this owner"),
+            A0Error::NotU64 { what } => write!(f, "{what} is not a decimal u64"),
+            A0Error::AmountZero => write!(f, "amount must be greater than 0"),
+            A0Error::FeeAboveCeiling => write!(f, "fee is above the pinned ceiling"),
+            A0Error::AmountPlusFeeOverflow => write!(f, "amount + fee overflows u64"),
+            A0Error::AuthInFlight => write!(f, "an unshield authorization is already in flight"),
+            A0Error::AuthAbsent => write!(f, "no live unshield authorization"),
+            A0Error::AuthMismatch => write!(f, "not the live unshield authorization"),
+            A0Error::AuthWrongHandle => {
+                write!(f, "unshield authorization belongs to another key handle")
+            }
+            A0Error::AuthExpired => write!(f, "unshield authorization expired"),
+            A0Error::Rng => write!(f, "the OS random source failed"),
+            A0Error::Clock => write!(f, "the boot clock could not be read"),
         }
     }
 }
@@ -75,16 +159,59 @@ pub(crate) struct Session {
     pub(crate) keys: Box<Keys>,
 }
 
-/// Everything behind the one lock. Task 2 adds `auth: Option<Auth>` here and clears it in
-/// [`Inner::end_session`], the single place a session ends.
+/// Everything behind the one lock: the session's keys and the one unshield authorization.
 pub(crate) struct Inner {
     session: Option<Session>,
+    auth: Option<Auth>,
 }
 
 impl Inner {
-    /// Ends the live session, if any: dropping the `Box<Keys>` wipes it.
+    /// Ends the live session, if any: dropping the `Box<Keys>` wipes it, and the authorization
+    /// (recorded under that session's handle) goes with it. The single place a session ends.
     pub(crate) fn end_session(&mut self) {
         self.session = None;
+        self.auth = None;
+    }
+
+    /// Hands the live authorization to `prove` (Task 3) — and consumes it FIRST, so whatever
+    /// this call decides, the record cannot be used again. Refuses, in this order: `handle` not
+    /// live (`UnknownHandle`); none live (`AuthAbsent`); another id (`AuthMismatch`); recorded
+    /// under another handle (`AuthWrongHandle`); `now >= expires_at` (`AuthExpired`).
+    #[cfg_attr(
+        not(test),
+        expect(dead_code, reason = "consumed by Task 3's withdraw_change prove")
+    )]
+    pub(crate) fn take_auth(
+        &mut self,
+        handle: Handle,
+        auth_id: &AuthId,
+        now: Duration,
+    ) -> Result<Auth, A0Error> {
+        let auth = self.auth.take();
+        self.keys_for(handle)?;
+        let auth = auth.ok_or(A0Error::AuthAbsent)?;
+        if !auth.id.same(auth_id) {
+            return Err(A0Error::AuthMismatch);
+        }
+        if auth.handle != handle {
+            return Err(A0Error::AuthWrongHandle);
+        }
+        if now >= auth.expires_at {
+            return Err(A0Error::AuthExpired);
+        }
+        Ok(auth)
+    }
+
+    /// Test-only: plant a record as if `end_session` had failed to clear it.
+    #[cfg(test)]
+    pub(crate) fn plant_auth_for_test(&mut self, auth: Auth) {
+        self.auth = Some(auth);
+    }
+
+    /// Test-only: the live record's expiry, without consuming it.
+    #[cfg(test)]
+    pub(crate) fn peek_auth_expiry_for_test(&self) -> Option<Duration> {
+        self.auth.as_ref().map(|a| a.expires_at)
     }
 
     /// The keys of `handle`, or `UnknownHandle`.
@@ -114,7 +241,10 @@ fn canonical(bytes: &[u8; 32], what: &'static str, index: usize) -> Result<Fr, A
 impl Core {
     pub const fn new() -> Self {
         Core {
-            inner: Mutex::new(Inner { session: None }),
+            inner: Mutex::new(Inner {
+                session: None,
+                auth: None,
+            }),
         }
     }
 
@@ -206,6 +336,61 @@ impl Core {
         Ok(spent)
     }
 
+    /// `authorizeUnshield(handle, owner, amount, fee) -> authId` — Kotlin only (spec §3, §4
+    /// step 4), called on the biometric approval: re-parses the three strings exactly as
+    /// `parseUnshield` does (the record holds Rust's values, never the caller's), and records
+    /// `{owner, ata, amount, fee, pool, mint, handle, expiresAt = now + 120 s}`.
+    pub fn authorize_unshield(
+        &self,
+        handle: Handle,
+        owner: &str,
+        amount: &str,
+        fee: &str,
+    ) -> Result<AuthId, A0Error> {
+        let now = auth::now()?;
+        self.authorize_unshield_at(handle, owner, amount, fee, now)
+    }
+
+    /// [`Core::authorize_unshield`] at an injected time (tests; `now` is on the `auth::now` clock).
+    pub(crate) fn authorize_unshield_at(
+        &self,
+        handle: Handle,
+        owner: &str,
+        amount: &str,
+        fee: &str,
+        now: Duration,
+    ) -> Result<AuthId, A0Error> {
+        let mut inner = self.lock()?;
+        inner.keys_for(handle)?;
+        let parsed = unshield::parse(owner, amount, fee)?;
+        if let Some(live) = &inner.auth {
+            if now < live.expires_at {
+                return Err(A0Error::AuthInFlight);
+            }
+        }
+        let id = AuthId::fresh()?;
+        inner.auth = Some(Auth {
+            id,
+            handle,
+            owner: parsed.owner,
+            ata: parsed.ata,
+            amount: parsed.amount,
+            fee: parsed.fee,
+            pool: POOL,
+            mint: MINT,
+            expires_at: now + AUTH_TTL,
+        });
+        Ok(id)
+    }
+
+    /// Test-only: the state behind a poisoned lock, to observe what the poison path left.
+    #[cfg(test)]
+    pub(crate) fn lock_ignoring_poison_for_test(&self) -> MutexGuard<'_, Inner> {
+        self.inner
+            .lock()
+            .unwrap_or_else(std::sync::PoisonError::into_inner)
+    }
+
     /// Test-only: panic while holding the lock, to exercise the poison path.
     #[cfg(test)]
     pub(crate) fn poison_for_test(&self) {
```

- [ ] **Step 6: Run the tests — green; then the crate's whole gate.**

```bash
cd native/noctura-prover && set -o pipefail
cargo test --locked --lib a0:: 2>&1 | grep -E "test result"
cargo fmt --check; echo fmt=$?
cargo clippy --all-targets --locked -- -D warnings 2>&1 | tail -1; echo clippy=$?
cargo test --locked 2>&1 | grep -E "Running|test result|deposit_prove_to_bytes"
```

Expected:

```
test result: ok. 51 passed; 0 failed; 0 ignored; 0 measured; 9 filtered out; finished in 1.50s
fmt=0
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.52s
clippy=0
     Running unittests src/lib.rs (…/debug/deps/noctura_prover-…)
test result: ok. 60 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.83s
     Running tests/prove_to_bytes.rs (…/debug/deps/prove_to_bytes-…)
test deposit_prove_to_bytes_matches_public_inputs ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 7.21s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

51 = Task 1's 28 + 23 new; 60 = the 9 pre-existing unit tests + 51. `clippy` clean also proves the two `expect(dead_code)` attributes (on `Auth` and `take_auth`) are fulfilled in the non-test build. (The integration test needs the v1 deposit artifacts linked as in Task 1, Step 3.)

Then the repository's other gates (from the root):

```bash
npx tsc --noEmit; echo tsc=$?
node scripts/check-no-tge-date.mjs        # after `git add`
npx prettier --check scripts/a0-vectors/gen-ata-vectors.mjs
node --check scripts/a0-vectors/gen-ata-vectors.mjs; echo $?
node scripts/a0-vectors/gen-key-vectors.mjs --check   # Task 1's fixture is untouched
```

Expected: `tsc=0`; `no TGE date in 1425 tracked text files`; `All matched files use Prettier code style!`; `0`; `gen-key-vectors: native/noctura-prover/tests/fixtures/a0-key-vectors.json matches a fresh run (5 seeds, 4 EIP cases)`. Root `npx jest` (no app source changed — the whole-suite baseline): `Test Suites: 1 skipped, 181 passed, 181 of 182 total` / `Tests:       1 skipped, 1243 passed, 1244 total`. ESLint does not parse `.mjs` here (`import.meta`), as Task 1 records; Prettier is the script's style check.

- [ ] **Step 7: The arm64 build and its dynamic section (no C++ runtime).**

```bash
cd native/noctura-prover && cargo ndk -t arm64-v8a build --release --locked 2>&1 | tail -1
readelf -d "$CARGO_TARGET_DIR/aarch64-linux-android/release/libnoctura_prover.so" | grep -E "NEEDED|SONAME"
readelf -d "$CARGO_TARGET_DIR/aarch64-linux-android/release/libnoctura_prover.so" | grep -c "c++"
for c in curve25519-dalek bs58 getrandom@0.2.17 libc; do cargo tree --locked --target aarch64-linux-android -e normal,build -p $c; done
```

Expected (cargo-ndk 4.1.2, warm target from Task 1: 31 s):

```
    Finished `release` profile [optimized] target(s) in 31.22s
 0x0000000000000001 (NEEDED)             Shared library: [libdl.so]
 0x0000000000000001 (NEEDED)             Shared library: [libm.so]
 0x0000000000000001 (NEEDED)             Shared library: [libc.so]
0
curve25519-dalek v4.1.3
├── cfg-if v1.0.0
└── subtle v2.6.1
[build-dependencies]
└── rustc_version v0.4.1
    └── semver v1.0.28
bs58 v0.5.1
getrandom v0.2.17
├── cfg-if v1.0.0
└── libc v0.2.186
libc v0.2.186
```

No new crate has a C build; `curve25519-dalek-derive` and `fiat-crypto` are not in the arm64 graph (`cargo tree … -i <crate>` prints `nothing to print`). The Android-only path of `auth::now` (CLOCK_BOOTTIME) compiled in this build. **Limit, as in Task 1:** nothing exported over JNI reaches `a0` yet, so the linker may have dropped it; Task 4 re-runs this check.

- [ ] **Step 8: Named mutations — each in a fresh copy, compiled first, each red.**

Each: `git archive HEAD | tar -x -C <dir>`, symlink `node_modules`, apply the edit(s) (exact single-occurrence replacements; the driver asserts the count is 1), `cargo test --locked --lib --no-run` (all 33 compiled — none INVALID), then `cargo test --locked --lib a0::`. Measured:

| mutation | result | red tests |
|---|---|---|
| M-pda-marker | 46 passed; 5 failed | `authorize_records_rusts_parsed_values_and_the_first_take_returns_them`, `derive_ata_equals_spl_tokens_derivation_for_every_accepted_owner`, `find_program_address_matches_web3_for_every_owner_row_including_refused_owners`, `find_program_address_matches_web3_for_the_programs_published_accounts`, `parse_unshield_returns_rusts_own_values_and_the_pinned_pool` |
| M-pda-first-candidate | 47 passed; 4 failed | `derive_ata_equals_spl_tokens_derivation_for_every_accepted_owner`, `find_program_address_matches_web3_for_every_owner_row_including_refused_owners`, `find_program_address_matches_web3_for_the_programs_published_accounts`, `parse_unshield_returns_rusts_own_values_and_the_pinned_pool` |
| M-pda-bump-ascending | 46 passed; 5 failed | `derive_ata_equals_spl_tokens_derivation_for_every_accepted_owner`, `authorize_records_rusts_parsed_values_and_the_first_take_returns_them`, `find_program_address_matches_web3_for_every_owner_row_including_refused_owners`, `find_program_address_matches_web3_for_the_programs_published_accounts`, `parse_unshield_returns_rusts_own_values_and_the_pinned_pool` |
| M-pda-bump-not-hashed | 34 passed; 17 failed | `a_pda_owner_is_refused_positive_and_negative_control`, `amount_and_fee_are_canonical_decimal_u64_strings`, `amount_zero_fee_ceiling_and_overflow_are_refused_at_their_edges`, `a_poisoned_state_drops_the_authorization`, `derive_ata_equals_spl_tokens_derivation_for_every_accepted_owner`, `authorize_records_rusts_parsed_values_and_the_first_take_returns_them`, `find_program_address_matches_web3_for_every_owner_row_including_refused_owners`, `find_program_address_matches_web3_for_the_programs_published_accounts`, `authorize_refuses_what_parse_refuses_and_an_unknown_handle_and_records_nothing`, `auth_ids_come_from_the_os_rng_not_from_the_data`, `close_and_reopen_invalidate_the_authorization`, `human_amounts_match_the_offline_bigint_rendering`, `parse_unshield_returns_rusts_own_values_and_the_pinned_pool`, `the_first_take_consumes_the_authorization_success_or_failure`, `one_authorization_at_a_time`, `the_authorization_is_usable_for_exactly_120_seconds_from_approval`, `the_real_clock_advances_and_the_public_authorize_uses_it` |
| M-ata-seed-order | 48 passed; 3 failed | `authorize_records_rusts_parsed_values_and_the_first_take_returns_them`, `derive_ata_equals_spl_tokens_derivation_for_every_accepted_owner`, `parse_unshield_returns_rusts_own_values_and_the_pinned_pool` |
| M-token-program-byte | 46 passed; 5 failed | `authorize_records_rusts_parsed_values_and_the_first_take_returns_them`, `derive_ata_equals_spl_tokens_derivation_for_every_accepted_owner`, `find_program_address_matches_web3_for_every_owner_row_including_refused_owners`, `parse_unshield_returns_rusts_own_values_and_the_pinned_pool`, `the_pinned_addresses_decimals_and_ceiling_match_the_fixture` |
| M-derive-ata-no-owner-check | 46 passed; 5 failed | `a_pda_owner_is_refused_positive_and_negative_control`, `amount_zero_fee_ceiling_and_overflow_are_refused_at_their_edges`, `refusals_carry_no_input_value`, `authorize_refuses_what_parse_refuses_and_an_unknown_handle_and_records_nothing`, `every_refused_owner_is_refused_with_its_reason_and_no_ata` |
| M-owner-non-canonical-allowed | 50 passed; 1 failed | `every_refused_owner_is_refused_with_its_reason_and_no_ata` |
| M-owner-small-order-allowed | 48 passed; 3 failed | `a_pda_owner_is_refused_positive_and_negative_control`, `amount_zero_fee_ceiling_and_overflow_are_refused_at_their_edges`, `every_refused_owner_is_refused_with_its_reason_and_no_ata` |
| M-owner-torsion-allowed | 50 passed; 1 failed | `every_refused_owner_is_refused_with_its_reason_and_no_ata` |
| M-u64-sign-allowed | 50 passed; 1 failed | `amount_and_fee_are_canonical_decimal_u64_strings` |
| M-u64-leading-zero-allowed | 50 passed; 1 failed | `amount_and_fee_are_canonical_decimal_u64_strings` |
| M-amount-zero-allowed | 49 passed; 2 failed | `amount_zero_fee_ceiling_and_overflow_are_refused_at_their_edges`, `authorize_refuses_what_parse_refuses_and_an_unknown_handle_and_records_nothing` |
| M-fee-ceiling-exclusive | 49 passed; 2 failed | `amount_zero_fee_ceiling_and_overflow_are_refused_at_their_edges`, `human_amounts_match_the_offline_bigint_rendering` |
| M-fee-ceiling-raised | 48 passed; 3 failed | `amount_zero_fee_ceiling_and_overflow_are_refused_at_their_edges`, `authorize_refuses_what_parse_refuses_and_an_unknown_handle_and_records_nothing`, `the_pinned_addresses_decimals_and_ceiling_match_the_fixture` |
| M-overflow-allowed | 50 passed; 1 failed | `amount_zero_fee_ceiling_and_overflow_are_refused_at_their_edges` |
| M-decimals-8 | 48 passed; 3 failed | `human_amounts_match_the_offline_bigint_rendering`, `parse_unshield_returns_rusts_own_values_and_the_pinned_pool`, `the_pinned_addresses_decimals_and_ceiling_match_the_fixture` |
| M-human-no-trim | 49 passed; 2 failed | `parse_unshield_returns_rusts_own_values_and_the_pinned_pool`, `human_amounts_match_the_offline_bigint_rendering` |
| M-pool-byte | 48 passed; 3 failed | `authorize_records_rusts_parsed_values_and_the_first_take_returns_them`, `parse_unshield_returns_rusts_own_values_and_the_pinned_pool`, `the_pinned_addresses_decimals_and_ceiling_match_the_fixture` |
| M-end-session-keeps-auth | 49 passed; 2 failed | `a_poisoned_state_drops_the_authorization`, `close_and_reopen_invalidate_the_authorization` |
| M-take-consumes-on-success-only | 47 passed; 4 failed | `a_record_under_another_handle_is_refused`, `one_authorization_at_a_time`, `the_authorization_is_usable_for_exactly_120_seconds_from_approval`, `the_first_take_consumes_the_authorization_success_or_failure` |
| M-take-never-consumes | 46 passed; 5 failed | `a_record_under_another_handle_is_refused`, `auth_ids_come_from_the_os_rng_not_from_the_data`, `one_authorization_at_a_time`, `the_authorization_is_usable_for_exactly_120_seconds_from_approval`, `the_first_take_consumes_the_authorization_success_or_failure` |
| M-take-no-live-handle-check | 49 passed; 2 failed | `a_poisoned_state_drops_the_authorization`, `close_and_reopen_invalidate_the_authorization` |
| M-take-ignores-id | 49 passed; 2 failed | `one_authorization_at_a_time`, `the_first_take_consumes_the_authorization_success_or_failure` |
| M-take-ignores-handle | 50 passed; 1 failed | `a_record_under_another_handle_is_refused` |
| M-expiry-inclusive | 49 passed; 2 failed | `the_first_take_consumes_the_authorization_success_or_failure`, `the_authorization_is_usable_for_exactly_120_seconds_from_approval` |
| M-ttl-121 | 49 passed; 2 failed | `authorize_records_rusts_parsed_values_and_the_first_take_returns_them`, `the_authorization_is_usable_for_exactly_120_seconds_from_approval` |
| M-in-flight-allowed | 50 passed; 1 failed | `one_authorization_at_a_time` |
| M-in-flight-ignores-expiry | 50 passed; 1 failed | `one_authorization_at_a_time` |
| M-authorize-no-handle-check | 50 passed; 1 failed | `authorize_refuses_what_parse_refuses_and_an_unknown_handle_and_records_nothing` |
| M-id-from-data | 50 passed; 1 failed | `auth_ids_come_from_the_os_rng_not_from_the_data` |
| M-record-mint-is-pool | 50 passed; 1 failed | `authorize_records_rusts_parsed_values_and_the_first_take_returns_them` |
| M-same-ignores-last-byte | 50 passed; 1 failed | `the_first_take_consumes_the_authorization_success_or_failure` |

The edit of each mutation is its row in the driver below (`M = [(name, [(file, old, new), …]), …]`).

The driver the dry run used:

```python
import subprocess, os, shutil, sys, re
S='/tmp/claude-1000/-home-user-Solana-Project-NocturaWallet/d7c642ae-8bb8-4082-9201-c4795988a74d/scratchpad'
REPO=S+'/m1a-t2'; BASE=S+'/t2-mut/tree'; TGT=S+'/t2-mut/target'
C='native/noctura-prover/src/a0/'
TAKE_ON_SUCCESS_ONLY='''        self.keys_for(handle)?;
        let live = self.auth.as_ref().ok_or(A0Error::AuthAbsent)?;
        if !live.id.same(auth_id) {
            return Err(A0Error::AuthMismatch);
        }
        if live.handle != handle {
            return Err(A0Error::AuthWrongHandle);
        }
        if now >= live.expires_at {
            return Err(A0Error::AuthExpired);
        }
        let auth = self.auth.take().ok_or(A0Error::AuthAbsent)?;
        Ok(auth)'''
TAKE_ORIG='''        let auth = self.auth.take();
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
        Ok(auth)'''
M=[
 # find_program_address
 ('M-pda-marker', [(C+'ata.rs', 'b"ProgramDerivedAddress"', 'b"ProgramDerivedAddresz"')]),
 ('M-pda-first-candidate', [(C+'ata.rs', '        if !is_on_curve(&candidate) {', '        if !is_on_curve(&candidate) || bump > 0 {')]),
 ('M-pda-bump-ascending', [(C+'ata.rs', 'for bump in (1..=u8::MAX).rev() {', 'for bump in 1..=u8::MAX {')]),
 ('M-pda-bump-not-hashed', [(C+'ata.rs', '        h.update([bump]);\n', '')]),
 ('M-ata-seed-order', [(C+'ata.rs', '&[owner, &TOKEN_PROGRAM_ID, &MINT]', '&[owner, &MINT, &TOKEN_PROGRAM_ID]')]),
 ('M-token-program-byte', [(C+'ata.rs', '0x06, 0xdd, 0xf6,', '0x07, 0xdd, 0xf6,')]),
 # the owner (m3)
 ('M-derive-ata-no-owner-check', [(C+'ata.rs', '    check_owner(owner)?;\n    find_program_address', '    find_program_address')]),
 ('M-owner-non-canonical-allowed', [(C+'ata.rs', '    if point.compress() != compressed {\n        return Err(A0Error::OwnerNonCanonical);\n    }\n', '')]),
 ('M-owner-small-order-allowed', [(C+'ata.rs', '    if point.is_small_order() {\n        return Err(A0Error::OwnerSmallOrder);\n    }\n', '')]),
 ('M-owner-torsion-allowed', [(C+'ata.rs', '    if !point.is_torsion_free() {\n        return Err(A0Error::OwnerTorsion);\n    }\n', '')]),
 # parseUnshield
 ('M-u64-sign-allowed', [(C+'unshield.rs', '!b.is_empty() && b.iter().all(u8::is_ascii_digit) && ', '!b.is_empty() && ')]),
 ('M-u64-leading-zero-allowed', [(C+'unshield.rs', ' && (b.len() == 1 || b[0] != b\'0\')', '')]),
 ('M-amount-zero-allowed', [(C+'unshield.rs', '    if amount == 0 {\n        return Err(A0Error::AmountZero);\n    }\n', '')]),
 ('M-fee-ceiling-exclusive', [(C+'unshield.rs', 'if fee > FEE_CEILING {', 'if fee >= FEE_CEILING {')]),
 ('M-fee-ceiling-raised', [(C+'unshield.rs', 'pub const FEE_CEILING: u64 = 1_000_000;', 'pub const FEE_CEILING: u64 = 10_000_000;')]),
 ('M-overflow-allowed', [(C+'unshield.rs', '    if amount.checked_add(fee).is_none() {\n        return Err(A0Error::AmountPlusFeeOverflow);\n    }\n', '')]),
 ('M-decimals-8', [(C+'unshield.rs', 'pub const DECIMALS: u32 = 9;', 'pub const DECIMALS: u32 = 8;')]),
 ('M-human-no-trim', [(C+'unshield.rs', 'digits.trim_end_matches(\'0\')', 'digits')]),
 ('M-pool-byte', [(C+'unshield.rs', '0x6f, 0x45, 0x68,', '0x6f, 0x45, 0x69,')]),
 # the authorization
 ('M-end-session-keeps-auth', [(C+'state.rs', '        self.session = None;\n        self.auth = None;\n', '        self.session = None;\n')]),
 ('M-take-consumes-on-success-only', [(C+'state.rs', TAKE_ORIG, TAKE_ON_SUCCESS_ONLY)]),
 ('M-take-never-consumes', [(C+'auth.rs', '#[derive(Debug)]\n#[cfg_attr(', '#[derive(Debug, Clone)]\n#[cfg_attr('), (C+'state.rs', '        let auth = self.auth.take();\n', '        let auth = self.auth.clone();\n')]),
 ('M-take-no-live-handle-check', [(C+'state.rs', '        let auth = self.auth.take();\n        self.keys_for(handle)?;\n', '        let auth = self.auth.take();\n')]),
 ('M-take-ignores-id', [(C+'state.rs', '        if !auth.id.same(auth_id) {\n            return Err(A0Error::AuthMismatch);\n        }\n', '')]),
 ('M-take-ignores-handle', [(C+'state.rs', '        if auth.handle != handle {\n            return Err(A0Error::AuthWrongHandle);\n        }\n', '')]),
 ('M-expiry-inclusive', [(C+'state.rs', 'if now >= auth.expires_at {', 'if now > auth.expires_at {')]),
 ('M-ttl-121', [(C+'auth.rs', 'Duration::from_secs(120);', 'Duration::from_secs(121);')]),
 ('M-in-flight-allowed', [(C+'state.rs', '        if let Some(live) = &inner.auth {\n            if now < live.expires_at {\n                return Err(A0Error::AuthInFlight);\n            }\n        }\n', '')]),
 ('M-in-flight-ignores-expiry', [(C+'state.rs', '            if now < live.expires_at {\n                return Err(A0Error::AuthInFlight);\n            }\n', '            let _ = live;\n            return Err(A0Error::AuthInFlight);\n')]),
 ('M-authorize-no-handle-check', [(C+'state.rs', '        let mut inner = self.lock()?;\n        inner.keys_for(handle)?;\n        let parsed', '        let mut inner = self.lock()?;\n        let parsed')]),
 ('M-id-from-data', [(C+'state.rs', '        let id = AuthId::fresh()?;\n', '        let id = AuthId::from_bytes([parsed.amount as u8; 16]);\n')]),
 ('M-record-mint-is-pool', [(C+'state.rs', '            mint: MINT,\n            expires_at', '            mint: POOL,\n            expires_at')]),
 ('M-same-ignores-last-byte', [(C+'auth.rs', '            .zip(other.0.iter())\n', '            .zip(other.0.iter())\n            .take(15)\n')]),
]
only=sys.argv[1:]
env=dict(os.environ, CARGO_TARGET_DIR=TGT)
for name,edits in M:
    if only and name not in only: continue
    if os.path.exists(BASE): shutil.rmtree(BASE)
    os.makedirs(BASE)
    subprocess.run(f'git -C {REPO} archive HEAD | tar -x -C {BASE}', shell=True, check=True)
    os.symlink(REPO+'/node_modules', BASE+'/node_modules')
    for f,old,new in edits:
        p=BASE+'/'+f; s=open(p).read()
        assert s.count(old)==1, (name, f, s.count(old))
        open(p,'w').write(s.replace(old,new))
    cwd=BASE+'/native/noctura-prover'
    b=subprocess.run(['cargo','test','--locked','--lib','--no-run'],cwd=cwd,env=env,capture_output=True,text=True)
    if b.returncode!=0:
        print(f'{name}: INVALID (does not compile)'); print(b.stderr[-1500:]); continue
    r=subprocess.run(['cargo','test','--locked','--lib','a0::'],cwd=cwd,env=env,capture_output=True,text=True)
    fails=re.findall(r'^test (a0::\S+) \.\.\. FAILED',r.stdout,re.M)
    res=re.findall(r'^test result: .*$',r.stdout,re.M)
    print(f'{name}: {"RED" if r.returncode else "GREEN (SURVIVED)"} — {res[-1] if res else ""}', flush=True)
    for t in fails: print('   ', t.replace('a0::',''), flush=True)
```

(`S` is the dry run's scratch directory; set it to yours.)

**Not covered by a mutation (stated):** that `auth::now` counts suspend (CLOCK_BOOTTIME rather than CLOCK_MONOTONIC) — the two clocks differ only across a suspend, which a desktop test cannot produce; the test shows only that the clock advances with real time and that the public `authorize_unshield` uses it. `NoProgramAddress` and `Rng` / `Clock` are failure paths no input reaches (255 on-curve candidates in a row; an OS RNG or clock failure).

- [ ] **Step 9: Commit.**

```bash
git add native/noctura-prover/Cargo.toml native/noctura-prover/Cargo.lock native/noctura-prover/src/a0 \
  native/noctura-prover/tests/fixtures/a0-ata-vectors.json scripts/a0-vectors/gen-ata-vectors.mjs
git status --short     # artifacts/ stays untracked (gitignored); nothing else
git commit -m "feat(shielded-a0): Rust unshield destination and authorization — ATA with the runtime's on-curve test, the owner as a possible public key, parseUnshield with the pinned pool / mint / decimals / fee ceiling, the single-use 120 s authorization record (M1a Task 2)"
```

Expected `git show --stat HEAD`: 10 files changed, 2004 insertions(+), 8 deletions(-).

#### Notes for the executor (Task 2)

- **The rulings this task took (each the most secure default; the owner may overturn any):**
  - **The owner must be a possible Ed25519 public key, not merely "on the curve".** Accepted: the canonical encoding of a point of the prime-order subgroup other than the identity — exactly the set a keypair can produce. Refused, each with its own error: off curve (a PDA — m3), a non-canonical encoding (`y ≥ p`, which the runtime still calls on-curve), small order (orders 1, 2, 4, 8 — the System Program's `1111…1` is one: on-curve for Solana, owned by no one), a torsion component. Tokens sent to the ATA of any of these could not be moved by a recipient's key. Cost if wrong: an address no wallet generates is refused; the relayer's ADDITION 1 (grant only to an on-curve owner) is unaffected, since every owner we accept is on the curve.
  - **"Off the curve" for a PDA candidate is the runtime's test** (curve25519-dalek `=4.1.3`'s `decompress`), not web3.js's stricter decoding; bump runs 255 down to 1 (the runtime's and web3.js's loop — bump 0 is never tried). The two differ only on non-canonical encodings (probability ~2^-250 for a hash); the fixture carries one such row and the test names it as the only divergence.
  - **Decimals = 9 is a pinned fact, not read at run time.** Sources: the devnet mint account `ERkp…` read once by the writer on 2026-11-08 (`getAccountInfo` jsonParsed at slot 520121745 on `api.devnet.solana.com`: `decimals 9`, `mintAuthority GoBAmZzH…`, `supply 6000000`, owner `Tokenkeg…`; genesis `EtWTRABZ…` = devnet), and the program side's `scripts/a0-devnet-acceptance.mjs` at their `19e3891`, which created the pool's mint with `createMint(conn, payer, payer.publicKey, null, 9)`. Their `devnet-a0-deployed-contract.json` (sha256 `5d3f2fa3…be99`) does not carry decimals. Native makes no RPC read (the freeze discussed one; R3 pins instead, and the dialog shows base units as well).
  - **`amount` and `fee` cross as decimal strings, in their one canonical spelling** — ASCII digits only, no sign (Rust's `u64::from_str` accepts `+1`; refused here), no leading zero, no spaces, ≤ u64::MAX. Kotlin's `Long` cannot hold a u64 above 2^63 − 1, so a string is the only lossless form. **A fee of 0 is accepted** (the chain allows it; the relayer's `minFee` refuses it, M1c). **`amount + fee` must fit a u64** — refused at parse, since it can never be ≤ any `inputAmount`.
  - **Human amounts:** the whole part, `.`, the fraction with trailing zeros removed (no `.` for a whole number), no digit grouping, no locale — integer arithmetic only. The dialog also shows base units (§4 step 3), so the rendering is never the only reading.
  - **One authorization at a time = a second `authorize_unshield` is REFUSED while the first is live** (`AuthInFlight`), not replaced: the approved record is never displaced by another request; an expired record no longer blocks and is replaced. Kotlin also refuses a second dialog (§4). Cost if wrong: after an approval whose prove never ran, the next unshield waits until the 120 s pass or the handle closes (which the operation's `finally` does).
  - **The first `take_auth` consumes the record whatever it decides** — a wrong id, a stale handle, an expired record all use it up (fail closed). Task 3 must call it first (above).
  - **The window runs on CLOCK_BOOTTIME** (time since boot including suspend), so a phone that sleeps after the approval does not stretch the 120 s; std's `Instant` (CLOCK_MONOTONIC) would. It is monotonic and ignores wall-clock changes. A clock failure is a refusal, never a panic (a panic would cross the JNI). Tests inject the time through `authorize_unshield_at` / `take_auth`'s `now`.
  - **`authId` = 16 bytes from the OS RNG** (`getrandom` 0.2), never derived from the data — tested by 64 identical requests giving 64 distinct ids (and a mutation deriving it from the amount goes red). It is compared reading every byte, and its `Debug` prints `AuthId(..)`. It is not zeroized: it is a single-use capability that dies with the record, not key material.
  - **`AuthWrongHandle` is unreachable through the API** (`end_session` clears the record with its handle) and kept as defence in depth; a test plants a record under another handle so the check is a tested check, not a comment, with the same record under the live handle as the positive control.
  - **No base58 re-encode check:** a base58 string's leading `1`s are exactly its leading zero bytes and the rest is a number without leading zeros, so a 32-byte decode has one spelling; a round-trip check could never fail, and an untestable check is not added.
  - **`parse_unshield` takes no handle** (spec §3's signature); `authorize_unshield` re-parses the strings itself, so the record holds Rust's values even if Kotlin passed different ones to the two calls.
- **Vectors and independence.** The fixture is written only by `scripts/a0-vectors/gen-ata-vectors.mjs`; it reads no Rust output, and the Rust code never writes it. Before writing, the script recomputes the program side's published addresses — pool `8VMe…` = PDA(`["pool", ERkp…]`, `FeGSS…`), tree `5URd…` = PDA(`["merkle", pool]`), and the relayer fee ATA `9643…` = ATA(`3jvhiz…`, `ERkp…`) — and stops on a mismatch; the Rust tests check the same three plus the vault. ATAs come from `PublicKey.findProgramAddressSync([owner, TOKEN, mint], ATA)`, which is the whole of spl-token's `getAssociatedTokenAddressSync` (plus its `isOnCurve` owner check); the `--spl-token` run confirmed every row against spl-token 0.3.11 itself. Owners: 2 real devnet keys, 5 deterministic test keys (incl. ATA bumps 254, 253 and 251), and 8 refused shapes (3 small order, 1 non-canonical, 1 torsion, 3 off curve incl. two PDAs). Verdicts come from `@noble/curves` (ZIP-215 decoding = dalek's), not from the crate under test.
- **The script is run by hand, never by CI or Jest** (I-6), like Task 1's.
- **Deviations from the brief / dispatch:**
  - `@solana/spl-token` is **not a dependency of this repository** (the dispatch assumed the root app had it). The fixture is produced from `@solana/web3.js` (spl-token's own calls), with an opt-in `--spl-token=<dir>` cross-check that the dry run ran against the program side's install (0.3.11). Adding spl-token as a devDependency only for this would be a new package in the app's lock; not done.
  - `libc` is added as a direct (Linux/Android-only) dependency for CLOCK_BOOTTIME; it was already in the lock. §12's crate list does not name it (rev 3.2 line below).
  - No `getrandom`/`libc` package is new to the lock; the four new packages are `bs58`, `curve25519-dalek`, `curve25519-dalek-derive`, `fiat-crypto` (the last two never built for arm64).
- **What the next tasks must know:** see Interfaces → "What later tasks rely on". In short: Task 3 calls `auth::now()` before the lock and `Inner::take_auth` first under it, then removes the two `expect(dead_code)` attributes; Task 4 binds `parse_unshield` / `CORE.authorize_unshield` with string arguments and a 16-byte `AuthId`, Kotlin-only.

#### Spec rev 3.2 lines (Task 2)
- §3 "ATA derivation" / §4 step 2: **the owner must be a possible Ed25519 public key** — canonical encoding, prime-order subgroup, not the identity; off-curve (PDA), non-canonical, small-order and torsion owners are refused. "On the curve" for a PDA candidate is curve25519-dalek 4.1.3's `decompress` (the runtime's); **bumps 255 down to 1**.
- §4 step 2: **`amount` and `fee` cross as canonical decimal u64 strings** (digits only, no sign, no leading zero); **`fee = 0` is accepted**; **`amount + fee ≤ u64::MAX`** is checked at parse; the **pinned decimals are 9** (the devnet mint account, read 2026-11-08; the program side's `createMint(…, 9)`); human amounts are integer-rendered, trailing zeros trimmed, no grouping.
- §4 step 4 / §3 "one authorization at a time": **a second `authorizeUnshield` while one is live is refused** (an expired one is replaced); **the first take consumes the record even when it refuses**; the 120 s run on **CLOCK_BOOTTIME** (suspend counts); **`authId` is 16 bytes from the OS RNG**.
- §12: the Rust crates added are `curve25519-dalek =4.1.3` (no default features), `bs58 0.5`, `getrandom 0.2` and `libc 0.2` (Linux/Android only; both already locked).


### Task 3: `prove` in Rust — `native/noctura-prover/src/a0/{prove,keyfiles}.rs` (the per-circuit JS allow-lists — deposit `{amount, depositIndex}`, withdraw_change `{merkleRoot, inputAmount, rho, pathElements, pathIndices}`, `transfer` refused in M1; witness completion from the session's keys and the authorization record, which EVERY prove consumes first; `withdrawAmount + fee ≤ inputAmount`; the note's Merkle path checked before any key file is read; the four A0 key files pinned by sha256 and length, read once; `r`, `s` from the OS; the proof's public inputs compared with Rust's and the proof self-verified before it is returned), the witness calculator hardened (`exceptionHandler` traps, the wasm memory is wiped, BigInt-free `Fr` I/O), the offline generator `scripts/a0-vectors/gen-prove-vectors.mjs` and its fixtures (desk scenarios, the deployed VKs, two LANDED withdraw_with_change proofs), the CI provisioning of the key files by digest; 27 tests (7 of them need the key files), 24 named mutations

**Spec:** §3 "prove" (allow-list, not deny-list, I11: any key outside the per-circuit set refuses — `nk`, `d`, `change_d`, a public input Rust fills, a typo; deposit `{amount, depositIndex}` → Rust computes `rho = rho(depositIndex)`, `commitment(amount, rho)`, the pinned `mintHash`, `nk`, `d = d_self`; withdraw_change `{merkleRoot, inputAmount, rho, pathElements[20], pathIndices[20]}` → Rust fills `nullifier`, `withdrawAmount` / `fee` / `recipientField = be_mod_r(ata)` from the authorization, `mintHash`, `changeCommitment = commitment(inputAmount − withdrawAmount − fee, rho_change)`, `nk`, `d = change_d = d_self`; refuses unless `withdrawAmount + fee ≤ inputAmount`; API names, not signal names — `depositIndex` maps to `rho`; m-5: *mapped(JS allow-list) ∪ Rust-filled = the circuit's signal table*, counts = `nPubInputs` / `nPrivInputs`; withdraw_change requires a live `authId`, consumed by the first prove, success or failure, refused if expired, absent, or recorded under another handle; the key files read from paths JS supplies, each hashed and refused unless it matches the sha256 pinned in Rust, R4; `witnessJson` never logged, m4), §1 (public-input order of each circuit; the A0 key digests and sizes; the 256-byte proof layout, `A.y` negated), §14 Rust ("a proof of each circuit verifies against the VK the chain holds"; "the 256-byte layout re-verified for A0 by parsing the proof bytes of a landed … and verifying them with the on-chain VK" (m10); "pinned-digest refusal, with a one-byte-changed key file"; "authorization refusals … `amount + fee > inputAmount` … and the allow-list refusals (every Rust-filled name, an unknown name), with *mapped(JS allow-list) ∪ Rust-filled = the signal table* and the counts asserted"; named mutations), §14 "All gates … the native-prover workflow" (its interop assertion), §12 (pure-Rust crates, `Cargo.lock` in the same PR), §16 M1a (this task's half of "the A0 proof-layout check (m10)"). **Not here:** the JNI function `prove` and its Kotlin binding, INV-NULL and INV-AUTH as boundary tests, the "another owner / ATA / amount / fee" refusals at the JNI (Task 4 — the Rust half is here: a proof's `withdrawAmount`, `fee`, `recipientField` can only come from the record); reading the VK from chain (the M1a checkpoint, Task 6 — see Notes); the `readelf` CI step (Task 5).

**Files:**
- Create: `native/noctura-prover/src/a0/prove.rs`, `native/noctura-prover/src/a0/keyfiles.rs`, `scripts/a0-vectors/gen-prove-vectors.mjs`
- Create (generated, committed — Step 2, not pasted): `native/noctura-prover/tests/fixtures/a0-prove-vectors.json` (251 lines), `native/noctura-prover/tests/fixtures/a0-vk/deposit_vk.json` and `…/withdraw_change_vk.json` (byte-for-byte copies of the program side's `zk/keys/v2/*_vk.json`, sha256 `f6f8ae49…2091` / `43dafca7…34e5cd`)
- Create (tests): `native/noctura-prover/src/a0/tests_prove.rs` (27 tests; in-crate, because `Core::complete`, `run`, the tables and the record are `pub(crate)`)
- Modify: `native/noctura-prover/Cargo.toml` (+`serde = "1"`; `[profile.test] opt-level = 3`), `native/noctura-prover/Cargo.lock` (+1 dependency line), `native/noctura-prover/src/a0/mod.rs` (`keyfiles`, `prove`, `tests_prove`, `pub use prove::Proof`), `src/a0/state.rs` (`Inner::discard_auth`, 20 `A0Error` variants, the `take_auth` `expect` removed), `src/a0/auth.rs` / `src/a0/keys.rs` / `src/a0/field.rs` (the four `expect(dead_code)` attributes removed — `Auth`, `Keys::nk`, `Keys::d_self`, `rho_change`), `src/a0/unshield.rs` (`parse_u64` → `pub(crate)`), `native/noctura-prover/src/witness_wasmi.rs` (`from_bytes`, `input_signal_size`, `input_size`, `calculate_witness_from_fr`, a trapping `exceptionHandler`, `env.memory` only when imported, the memory wiped on drop), `.github/workflows/native-prover.yml` (fetch the four pinned A0 files by digest, `NOCTURA_A0_KEYS_DIR`, the interop assertion extended, a second negative control)
- **Not changed, on purpose:** `src/a0/{ata,eip2333,tests,tests_unshield,wipe_probe}.rs`; `src/prover.rs`, `src/proof_bytes.rs` (the layout is re-verified, not changed), `src/android.rs` (the v1 JNI stays until Task 4), `tests/prove_to_bytes.rs` (the v1 interop test — it now also runs under the trapping `exceptionHandler` and passes); the Task 1 / Task 2 fixtures and scripts (read, never written); every file under the app's `src/` (`src/constants/provingAssets.ts` is read by CI for `BASE` only).

**Interfaces:**
- Consumes (Task 1): `state::{Core, Inner, Handle, A0Error}`, `Core::lock`, `Inner::keys_for`, `Keys::{nk, d_self, deposit_rho, nullifier, commitment}`, `field::{Fr, MINT, mint_hash, rho_change, poseidon, be_mod_order, fr_from_be32, fr_to_be32}`. (Task 2): `auth::{now, Auth, AuthId}`, `Inner::take_auth` (called FIRST under the lock, after `auth::now()?` was read before it), `Core::authorize_unshield_at`, `Inner::plant_auth_for_test` / `peek_auth_expiry_for_test`, `unshield::{parse_u64, POOL}`, `ata::derive_ata`. Crates: `ark_circom::{read_zkey, CircomReduction}`, `ark_groth16::Groth16` + `ark_snark::SNARK` (`process_vk`, `verify_with_processed_vk`), `serde::de::{Deserializer, MapAccess, Visitor}`, `serde_json`, `sha2::Sha256`, `hex`, `getrandom`, `zeroize`; the crate's `proof_bytes::{serialize_proof, parse_proof}` and `witness_wasmi::WitnessCalculator`. For the script: `src/modules/shielded/a0/fieldEquations.ts` (poseidon-lite), `@solana/web3.js` 1.99.0 `PublicKey.findProgramAddressSync`, `@scure/base` 2.0.0 `base58`, `node:crypto` sha256; the program side's repository (read-only): `docs/zk-contract/devnet-a0-deployed-contract.json`, `docs/zk-contract/relayer-a0-golden-vectors.json`, `zk/keys/v2/{deposit,withdraw_change}_vk.json` — each sha256-pinned in the script; optionally `zk/node_modules/snarkjs` 0.7.6 and `zk/keys/v2/` (`--snarkjs`).
- Produces — public (`noctura_prover::a0`; Task 4 binds `prove`):
  ```rust
  impl Core {
      pub fn prove(&self, handle: Handle, circuit: &str, witness_json: &str,
          auth_id: Option<AuthId>, zkey_path: &Path, wasm_path: &Path) -> Result<Proof, A0Error>;
      //   circuit: "deposit" | "withdraw_change" ("transfer" → CircuitNotInM1, else CircuitUnknown)
      //   Order, all under the lock (except the clock, read first): the live authorization is
      //   consumed (with Some(id): take_auth's checks; with None: dropped), then the handle, the
      //   circuit, the witness JSON (allow-list), the completion rules. Then, outside the lock:
      //   the two key files (pinned), the witness run, the checks, the proof.
  }
  #[derive(Clone, Debug, PartialEq, Eq)]
  pub struct Proof { pub proof_bytes: [u8; 256], pub public_inputs: Vec<[u8; 32]> }  // circuit order, BE
  pub enum A0Error { /* Tasks 1–2's 23, plus: */
      CircuitUnknown, CircuitNotInM1, AuthUnexpected, AuthRecordInconsistent, WitnessJson,
      WitnessRustFilled { name: &'static str }, WitnessUnknownKey, WitnessDuplicate { name: &'static str },
      WitnessMissing { name: &'static str }, WitnessValue { name: &'static str, index: usize },
      WitnessNotInTree, WithdrawExceedsInput, KeyFileRead { file: &'static str },
      KeyFilePin { file: &'static str }, KeyFileFormat { file: &'static str }, CircuitShape,
      WitnessRejected, PublicInputMismatch, ProofFailed, ProofDoesNotVerify,
  }   // + the reuse of AmountZero for a deposit of 0; Display/Debug carry no value (tested)
  ```
  The witness JSON (what Task 4's JS bridge sends; one object, every listed key exactly once):
  | circuit | key | form |
  |---|---|---|
  | deposit | `amount` | decimal string, canonical u64 (no sign, no leading zero), > 0 |
  | deposit | `depositIndex` | decimal string, canonical u64 |
  | withdraw_change | `merkleRoot`, `rho` | 64 lowercase hex chars, 32-byte BE, canonical (< r), never reduced |
  | withdraw_change | `inputAmount` | decimal string, canonical u64 |
  | withdraw_change | `pathElements` | array of exactly 20 such hex strings (level 0 first) |
  | withdraw_change | `pathIndices` | array of exactly 20 JSON integers `0` / `1` (1 = the running node is the RIGHT child) |
- Produces — public, in the existing `witness_wasmi` module: `WitnessCalculator::{from_bytes(&[u8]), input_signal_size(&mut self, &str) -> Res<Option<usize>>, input_size(&mut self) -> Res<usize>, calculate_witness_from_fr(&mut self, &[(&str, &[Fr])]) -> Res<Zeroizing<Vec<Fr>>>}`; `impl Drop` zero-fills the linear memory.
- Produces — crate-private: `prove::{Circuit, Signal, Table, DEPOSIT_TABLE, WITHDRAW_CHANGE_TABLE, DEPTH, Completed, run}`, `Core::{prove_at, complete}`, `Inner::discard_auth`, `keyfiles::{Pin, CircuitPins, DEPOSIT, WITHDRAW_CHANGE, load}`.
- **What later tasks rely on:** **Task 4** — `CORE.prove(handle, circuit, witnessJson, authId, zkeyPath, wasmPath)` is the whole Rust side of the JNI `prove`; decode the 16-byte `authId` with `AuthId::from_bytes` (absent → `None`); return `proof_bytes` and `public_inputs` hex-encoded (the relayer payload and the instruction both carry 32-byte BE hex) — public input [1] of a withdraw_change proof is the note's nullifier (INV-NULL's one allowed exit); map `A0Error`'s `Display` to the rejection; call it on the proving thread (it takes the lock only for microseconds, so `keysClose` never waits for a proof). **Task 4's INV-AUTH test** can rely on: no `withdraw_change` proof without `take_auth` succeeding, and `withdrawAmount`, `fee`, `recipientField` taken only from the record. **Task 6 (the checkpoint)** — the desk values of `scenarios[0]` in `a0-prove-vectors.json` (the repo test seed, depositIndex 0, 10^9) are exactly the checkpoint's deposit (`depositRho(0)`, `commitment()`, and the four public inputs); the VK "read from chain" comparison is the checkpoint's (Notes). **Task 5** — `serde` is already in the arm64 graph (serde_json's); no new package; Step 8 ran the `readelf` check.

**The rule, stated once.** JS names the note it spends and where it sits in the tree; Rust decides everything else. A key outside the circuit's allow-list, a missing or repeated one, a value in any spelling but its one canonical form, a note that does not fold to the root JS named — each refuses before a key file is opened. Every prove uses up the live authorization before it looks at anything, so an approval is good for one attempt. The amounts, the fee and the destination of an unshield come only from that record; the change goes back to the spender's own `nk` under `d_self`. The key files are exactly the published bytes, read once. What comes back is a proof that has already verified against the pinned key, with the public inputs Rust put in, in the circuit's order — and nothing that went in (the keys, the note, the path) appears in any error. Every expected value in the tests comes from code that shares nothing with this crate, and the layout is held to proofs the chain accepted.

- [ ] **Step 1: Add `serde` and the optimized test profile; lock.**

Apply to `native/noctura-prover/Cargo.toml`:

```diff
diff --git a/native/noctura-prover/Cargo.toml b/native/noctura-prover/Cargo.toml
index 7ce033f..905de1c 100644
--- a/native/noctura-prover/Cargo.toml
+++ b/native/noctura-prover/Cargo.toml
@@ -52,6 +52,9 @@ curve25519-dalek = { version = "=4.1.3", default-features = false }
 bs58 = "0.5"
 # The authId: 16 bytes from the OS (Android: the getrandom syscall). Already in the lock.
 getrandom = "0.2"
+# A0 prove (src/a0/prove.rs): the witness JSON is read entry by entry so a repeated key is refused
+# (serde_json's Map keeps the last). Already in the lock (serde_json's own dependency).
+serde = "1"
 
 # Android JNI bridge (pure Rust — no C++, no libc++_shared).
 [target.'cfg(target_os = "android")'.dependencies]
@@ -65,3 +68,10 @@ libc = "0.2"
 [[example]]
 name = "zkey_check"
 path = "examples/zkey_check.rs"
+
+# `cargo test` optimized. The A0 key-file tests read the 4.4 MB withdraw_change zkey and prove
+# with it: read_zkey alone took 68 s unoptimized even with every dependency at opt-level 3 (its
+# point deserialization is generic, so it is compiled in this crate), 4.6 s optimized. Debug
+# assertions and overflow checks are separate settings and stay on in tests.
+[profile.test]
+opt-level = 3
```

**Why `serde`:** serde_json's `Map` keeps the LAST of a repeated key, so a witness `{"amount":"1","amount":"999…"}` would be read silently; the allow-list reads the object entry by entry through a `serde::de::Visitor` instead (needs the trait crate directly). `serde 1.0.228` is already in the lock (serde_json's dependency): no new package. **Why `[profile.test] opt-level = 3`:** measured — `read_zkey` of the 4.4 MB withdraw_change zkey took **68 s** in a test build even with `[profile.dev.package."*"] opt-level = 3` (tried first: its point deserialization is generic over the reader, so it is monomorphized and compiled in THIS crate at opt-level 0), **4.6 s** optimized; the seven key-file tests took **241 s** unoptimized, **19 s** optimized (whole suite). `debug-assertions` and `overflow-checks` are separate settings the test profile inherits from dev, so they stay on. Cost: a cold `cargo test` build is 4 min 54 s here (once per target dir; CI's rust-cache keeps it).

Then (from `native/noctura-prover`):

```bash
cargo fetch
git diff Cargo.lock
```

Expected — exactly:

```diff
diff --git a/native/noctura-prover/Cargo.lock b/native/noctura-prover/Cargo.lock
index 6a11533..d79d379 100644
--- a/native/noctura-prover/Cargo.lock
+++ b/native/noctura-prover/Cargo.lock
@@ -1617,6 +1617,7 @@ dependencies = [
  "light-poseidon",
  "num-bigint",
  "num-traits",
+ "serde",
  "serde_json",
  "sha2",
  "wasmi",
```

- [ ] **Step 2: Write the offline vector generator and run it.**

Create `scripts/a0-vectors/gen-prove-vectors.mjs`:

```js
#!/usr/bin/env node
/**
 * Offline generator of the vectors the A0 `prove` tests are held to (spec 2026-11-08 shielded
 * A0 M1 §3 "prove", §14; I-6).
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Nothing here reads a Rust output, and the Rust code never writes
 * these files. Two kinds of content:
 *
 *  1. The desk scenarios (a deposit, two withdraw_change spends): the witness JS sends (the
 *     allow-listed part only) and every public input the proof must carry, in the circuit's
 *     order — computed here by the app's own A0 equations (`src/modules/shielded/a0/
 *     fieldEquations.ts`, poseidon-lite, held to the golden rows below before anything is
 *     written), the Merkle tree built here from `merkleNode` / `emptySubtreeRoots` (whose zeros
 *     are first compared with the zeros the program side READ FROM THE TREE ACCOUNT), and the
 *     destination ATA from @solana/web3.js (first held to a landed relayer exit's owner → ATA
 *     pair). The key values (nk, d_self, addrField, deposit rho) come from the Task 1 fixture
 *     `a0-key-vectors.json`, itself written offline by `gen-key-vectors.mjs` (bls.js +
 *     poseidon-lite) — re-checked here (addrField, commitment) before use.
 *
 *  2. The program side's FACTS, copied, never computed: the public-input order of each circuit
 *     (`devnet-a0-deployed-contract.json`), the two deployed verifying keys (`zk/keys/v2/
 *     *_vk.json`, copied byte for byte), and the proof bytes of two withdraw_with_change
 *     transactions that LANDED on devnet (`relayer-a0-golden-vectors.json`) — the proof is cut
 *     out of the landed instruction data, and its public inputs are rebuilt from that data,
 *     the destination account and the pinned mint, then compared with the program side's own
 *     decoding. Each source file is checked against a pinned sha256 before it is read.
 *
 * Run by hand from the repository root (Node 24, or Node >= 22.6 with --experimental-strip-types,
 * because the app's equations are TypeScript), with the program side's repository checked out:
 *   node scripts/a0-vectors/gen-prove-vectors.mjs --ico=<program side repo>          write
 *   node scripts/a0-vectors/gen-prove-vectors.mjs --ico=<program side repo> --check  compare only
 *
 * Writes:
 *   native/noctura-prover/tests/fixtures/a0-prove-vectors.json
 *   native/noctura-prover/tests/fixtures/a0-vk/deposit_vk.json          (verbatim copy)
 *   native/noctura-prover/tests/fixtures/a0-vk/withdraw_change_vk.json  (verbatim copy)
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublicKey } from '@solana/web3.js';
import { base58 } from '@scure/base';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIX = join(ROOT, 'native/noctura-prover/tests/fixtures');
const OUT = join(FIX, 'a0-prove-vectors.json');
const VK_OUT = join(FIX, 'a0-vk');
const KEY_VECTORS = join(FIX, 'a0-key-vectors.json');
const GOLDEN = join(
  ROOT,
  'src/modules/shielded/a0/__tests__/golden-vectors.json',
);
const EQ = await import(
  join(ROOT, 'src/modules/shielded/a0/fieldEquations.ts')
);
const R = EQ.FIELD_MODULUS;

/**
 * The program side's revision the files are read AT (`git show <rev>:<path>`, never their working
 * tree), so the fixture regenerates the same whatever their checkout has moved on to — their
 * 5fa2379 (2026-11-08, after this fixture) appended the P1/P2 landed vectors to the golden file.
 */
const ICO_REV = '37ad673360882eded6b07390e286003cc116d4bd';
/** The program side's files this script reads, each pinned by sha256 at ICO_REV. */
const ICO_FILES = {
  deployed: {
    path: 'docs/zk-contract/devnet-a0-deployed-contract.json',
    sha256: '5d3f2fa35f8aa7363faf9bbdc818ff020221674d0c8edbc0c54d626e6c67be99',
  },
  relayerGolden: {
    path: 'docs/zk-contract/relayer-a0-golden-vectors.json',
    sha256: 'de12765c43ffcd4ac2266fdf1902a02d7582ef03dc0bafd9d3c35e83e8cb684f',
  },
  depositVk: {
    path: 'zk/keys/v2/deposit_vk.json',
    sha256: 'f6f8ae49b8f032be799ee025f3e48faa34df7aa3685bee54339f538e6f9f2091',
  },
  withdrawChangeVk: {
    path: 'zk/keys/v2/withdraw_change_vk.json',
    sha256: '43dafca79a0523fcffb4a9719f67b4a260cbce2047b9a00c9abff0223134e5cd',
  },
};

const MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const TOKEN_PROGRAM = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);
const ATA_PROGRAM = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);
const DEPTH = 20;
const WITHDRAW_DISC = '6cf44379ecf67997';

const fail = msg => {
  console.error(`gen-prove-vectors: ${msg}`);
  process.exit(1);
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const be32 = v => {
  if (v < 0n || v >= R) {
    fail(`value outside the BN254 scalar field: ${v}`);
  }
  return v.toString(16).padStart(64, '0');
};
const fromHex = h => BigInt('0x' + h);
const beModR = bytes => BigInt('0x' + Buffer.from(bytes).toString('hex')) % R;
const u64le = (buf, off) => buf.readBigUInt64LE(off);

const icoArg = process.argv.find(a => a.startsWith('--ico='));
if (!icoArg) {
  fail(
    'usage: gen-prove-vectors.mjs --ico=<program side repository> [--check]',
  );
}
const ICO = resolve(icoArg.slice('--ico='.length));
const icoRead = key => {
  const { path, sha256: want } = ICO_FILES[key];
  const bytes = execFileSync('git', ['-C', ICO, 'show', `${ICO_REV}:${path}`], {
    maxBuffer: 1 << 26,
  });
  const got = sha256(bytes);
  if (got !== want) {
    fail(
      `${path}: sha256 ${got}, pinned ${want} — the program side's file changed; review it`,
    );
  }
  return bytes;
};

// ---- 0. The app's equations, held to every golden row first. ---------------------------------
const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')).vectors;
const g = (name, fn) => {
  if (!Array.isArray(golden[name]) || golden[name].length === 0) {
    fail(`golden-vectors.json has no ${name} rows`);
  }
  for (const row of golden[name]) {
    if (fn(row.in).toString() !== row.out) {
      fail(
        `fieldEquations.${name} disagrees with golden-vectors.json "${row.label}"`,
      );
    }
  }
};
g('addrField', i => EQ.addrField(BigInt(i.nk), BigInt(i.d)));
g('commitment', i =>
  EQ.commitment({
    addrField: BigInt(i.addrField),
    amount: BigInt(i.amount),
    mintHash: BigInt(i.mintHash),
    rho: BigInt(i.rho),
  }),
);
g('nullifier', i => EQ.nullifier(BigInt(i.nk), BigInt(i.rho)));
g('rhoOut', i => EQ.rhoOut(BigInt(i.nullifierIn0), Number(i.index)));
{
  // merkleNode's first row is one node; its second is the depth-20 fold of that row's leaf at
  // index 0 over the zeros — checked below with this script's own tree, once the zeros exist.
  const [node] = golden.merkleNode;
  if (
    EQ.merkleNode(BigInt(node.in.left), BigInt(node.in.right)).toString() !==
    node.out
  ) {
    fail(
      `fieldEquations.merkleNode disagrees with golden-vectors.json "${node.label}"`,
    );
  }
}

// ---- 1. The program side's facts. ------------------------------------------------------------
const deployed = JSON.parse(icoRead('deployed').toString('utf8'));
const relayerGolden = JSON.parse(icoRead('relayerGolden').toString('utf8'));
const vkBytes = {
  deposit: icoRead('depositVk'),
  withdraw_change: icoRead('withdrawChangeVk'),
};
if (deployed.mint !== MINT || relayerGolden.mint !== MINT) {
  fail('the program side names another mint');
}
const publicInputOrder = {
  deposit: deployed.publicInputOrder.deposit,
  withdraw_change: deployed.publicInputOrder.withdraw_change,
};
for (const [c, order] of Object.entries(publicInputOrder)) {
  const vk = JSON.parse(vkBytes[c].toString('utf8'));
  if (vk.nPublic !== order.length || vk.IC.length !== order.length + 1) {
    fail(
      `${c}: the VK's nPublic ${vk.nPublic} disagrees with the public-input order`,
    );
  }
}

// The tree's zeros, from the rule, compared with the zeros the program side read from chain.
const Z = EQ.emptySubtreeRoots(DEPTH); // Z[0..20], Z[20] = the empty root
if (deployed.zeros.length !== DEPTH) {
  fail('the deployed contract does not list 20 zeros');
}
deployed.zeros.forEach((z, i) => {
  if (z !== be32(Z[i])) {
    fail(`zeros[${i}] from the rule disagrees with the tree account`);
  }
});
if (deployed.emptyRoot !== be32(Z[DEPTH])) {
  fail('the empty root from the rule disagrees with the tree account');
}

const mintHash = beModR(base58.decode(MINT));
const ata = owner =>
  PublicKey.findProgramAddressSync(
    [
      new PublicKey(owner).toBytes(),
      TOKEN_PROGRAM.toBytes(),
      new PublicKey(MINT).toBytes(),
    ],
    ATA_PROGRAM,
  )[0].toBase58();

// web3.js's ATA, held to a landed relayer exit (destinationOwner → destination token account).
const relayed = relayerGolden.relayerLanded.vectors.withdraw_change.payload;
if (ata(relayed.destinationOwner) !== relayed.destination) {
  fail('web3.js ATA disagrees with the landed relayer exit');
}

// ---- 2. The key values (Task 1's offline fixture), re-checked. --------------------------------
const keyVectors = JSON.parse(readFileSync(KEY_VECTORS, 'utf8'));
const seed = keyVectors.seeds[0];
if (!seed.label.startsWith('repo test mnemonic')) {
  fail('a0-key-vectors.json seeds[0] is not the repo test mnemonic');
}
const nk = fromHex(seed.nk);
const dSelf = fromHex(seed.dSelf);
const addrSelf = fromHex(seed.addrSelf);
if (EQ.addrField(nk, dSelf) !== addrSelf) {
  fail('addrField(nk, dSelf) disagrees with the key fixture');
}
const note = i => {
  const n = seed.notes.find(
    x => x.depositIndex === String(i) || x.depositIndex === i,
  );
  if (!n) {
    fail(`the key fixture has no note for deposit index ${i}`);
  }
  return n;
};
const cm = (amount, rho) =>
  EQ.commitment({ addrField: addrSelf, amount, mintHash, rho });

// ---- 3. The desk scenarios. -------------------------------------------------------------------
const deposit = (() => {
  const depositIndex = 0n;
  const amount = 1_000_000_000n;
  const rho = fromHex(note(depositIndex).rho);
  const commitment = cm(amount, rho);
  const listed = note(depositIndex).commitments.find(
    c => BigInt(c.amount) === amount,
  );
  if (!listed || fromHex(listed.commitment) !== commitment) {
    fail('the deposit commitment disagrees with the key fixture');
  }
  const values = { commitment, amount, mintHash, rho };
  return {
    label:
      'deposit: the repo test seed, depositIndex 0, 1 token (10^9 base units)',
    circuit: 'deposit',
    witness: {
      amount: amount.toString(),
      depositIndex: depositIndex.toString(),
    },
    publicInputs: publicInputOrder.deposit.map(n => be32(values[n])),
  };
})();

/** A depth-20 tree over `leaves` (index → value), zeros elsewhere; path of `leafIndex`. */
const tree = (leaves, leafIndex) => {
  let level = new Map(leaves.map((v, i) => [i, v]));
  const pathElements = [];
  const pathIndices = [];
  let idx = leafIndex;
  for (let d = 0; d < DEPTH; d += 1) {
    const sib = idx ^ 1;
    pathElements.push(level.has(sib) ? level.get(sib) : Z[d]);
    pathIndices.push(idx & 1);
    const next = new Map();
    for (const k of new Set([...level.keys()].map(x => x >> 1))) {
      const l = level.has(2 * k) ? level.get(2 * k) : Z[d];
      const r = level.has(2 * k + 1) ? level.get(2 * k + 1) : Z[d];
      next.set(k, EQ.merkleNode(l, r));
    }
    level = next;
    idx >>= 1;
  }
  return { root: level.get(0), pathElements, pathIndices };
};

// The script's tree, held to the golden depth-20 fold (a leaf alone at index 0).
{
  const [node, fold] = golden.merkleNode;
  if (!fold || !fold.label.startsWith('fold_root_depth20_leaf_at_index0')) {
    fail('golden-vectors.json no longer carries the depth-20 fold row');
  }
  if (tree([BigInt(node.in.left)], 0).root.toString() !== fold.out) {
    fail('the tree disagrees with the golden depth-20 fold');
  }
}

const withdraw = ({
  label,
  depositIndex,
  leafIndex,
  others,
  owner,
  amount,
  fee,
}) => {
  const inputAmount = 1_000_000_000n;
  const rho = fromHex(note(depositIndex).rho);
  const leaf = cm(inputAmount, rho);
  const leaves = [...others];
  leaves[leafIndex] = leaf;
  const t = tree(leaves, leafIndex);
  // The path folds back to the root — the circuit's own MerkleFold, written once more here.
  let cur = leaf;
  t.pathElements.forEach((e, i) => {
    cur =
      t.pathIndices[i] === 0 ? EQ.merkleNode(cur, e) : EQ.merkleNode(e, cur);
  });
  if (cur !== t.root) {
    fail(`${label}: the path does not fold to the root`);
  }
  const nullifier = EQ.nullifier(nk, rho);
  if (be32(nullifier) !== note(depositIndex).nullifier) {
    fail(`${label}: the nullifier disagrees with the key fixture`);
  }
  const rhoChange = EQ.rhoOut(nullifier, 0);
  if (be32(rhoChange) !== note(depositIndex).rhoChange) {
    fail(`${label}: rho_change disagrees with the key fixture`);
  }
  const change = inputAmount - amount - fee;
  if (change < 0n) {
    fail(`${label}: amount + fee exceeds the input`);
  }
  const destination = ata(owner);
  const values = {
    merkleRoot: t.root,
    nullifier,
    withdrawAmount: amount,
    recipientField: beModR(base58.decode(destination)),
    mintHash,
    changeCommitment: cm(change, rhoChange),
    fee,
  };
  return {
    label,
    circuit: 'withdraw_change',
    authorization: {
      owner,
      amount: amount.toString(),
      fee: fee.toString(),
      ata: destination,
    },
    witness: {
      merkleRoot: be32(t.root),
      inputAmount: inputAmount.toString(),
      rho: be32(rho),
      pathElements: t.pathElements.map(be32),
      pathIndices: t.pathIndices,
    },
    changeAmount: change.toString(),
    publicInputs: publicInputOrder.withdraw_change.map(n => be32(values[n])),
  };
};

const scenarios = [
  deposit,
  withdraw({
    label:
      'withdraw_change: note of depositIndex 1 (10^9) at leaf 5 of 6, 400000 out + fee 10000, change 999590000',
    depositIndex: 1,
    leafIndex: 5,
    others: [1001n, 1002n, 1003n, 1004n, 1005n],
    owner: relayed.destinationOwner,
    amount: 400_000n,
    fee: 10_000n,
  }),
  withdraw({
    label:
      'withdraw_change: note of depositIndex 2 (10^9) alone at leaf 0 (path = the zeros), everything out, change 0',
    depositIndex: 2,
    leafIndex: 0,
    others: [],
    owner: relayed.destinationOwner,
    amount: 999_990_000n,
    fee: 10_000n,
  }),
];

// ---- 4. The landed withdraw_with_change proofs (m10). -----------------------------------------
const landedFrom = (label, v) => {
  const data = Buffer.from(v.expectedIxDataHex, 'hex');
  // 8 discriminator + 32 root + 32 nullifier + 8 amount + 32 change + 8 fee + 4 length + 256
  if (data.length !== 380 || data.toString('hex', 0, 8) !== WITHDRAW_DISC) {
    fail(`${label}: not a 380-byte withdraw_with_change instruction`);
  }
  let off = 8;
  const take = n => {
    const b = data.subarray(off, off + n);
    off += n;
    return b;
  };
  const merkleRoot = take(32).toString('hex');
  const nullifier = take(32).toString('hex');
  const amount = u64le(take(8), 0);
  const changeCommitment = take(32).toString('hex');
  const fee = u64le(take(8), 0);
  const len = take(4).readUInt32LE(0);
  if (len !== 256) {
    fail(`${label}: proof length ${len}`);
  }
  const proof = take(256).toString('hex');
  if (off !== data.length) {
    fail(`${label}: trailing instruction bytes`);
  }
  const destination = v.accountMetas[3].pubkey;
  if (destination !== v.payload.destination) {
    fail(`${label}: accountMetas[3] is not the payload's destination`);
  }
  if (proof !== v.payload.proofBytes) {
    fail(`${label}: the payload's proofBytes are not the landed instruction's`);
  }
  const values = {
    merkleRoot: fromHex(merkleRoot),
    nullifier: fromHex(nullifier),
    withdrawAmount: amount,
    recipientField: beModR(base58.decode(destination)),
    mintHash,
    changeCommitment: fromHex(changeCommitment),
    fee,
  };
  const publicInputs = publicInputOrder.withdraw_change.map(n =>
    be32(values[n]),
  );
  const theirs = v.payload.publicInputs.map(d => be32(BigInt(d)));
  if (JSON.stringify(publicInputs) !== JSON.stringify(theirs)) {
    fail(
      `${label}: the public inputs rebuilt from the instruction disagree with theirs`,
    );
  }
  return {
    label,
    signature: v.landedSignature,
    proofBytes: proof,
    publicInputs,
  };
};
const landed = [
  landedFrom(
    'withdraw_with_change landed directly (fee 50000)',
    relayerGolden.vectors.withdraw_change,
  ),
  landedFrom(
    'withdraw_with_change landed by the relayer (fee 10000)',
    relayerGolden.relayerLanded.vectors.withdraw_change,
  ),
];

// ---- 5. Optional: the scenarios are TRUE statements — snarkjs proves and verifies each one. ----
// `--snarkjs=<dir of the snarkjs package>` (the program side's zk/node_modules/snarkjs, 0.7.6 in
// the dry run) proves every scenario with the program side's own key files (zk/keys/v2/, the
// files the Rust pins name) from the FULL witness assembled here, and checks the proof verifies
// against the deployed VK with exactly the scenario's public inputs. No Rust is involved.
const snarkArg = process.argv.find(a => a.startsWith('--snarkjs='));
if (snarkArg) {
  const { createRequire } = await import('node:module');
  const snarkjs = createRequire(import.meta.url)(
    resolve(snarkArg.slice('--snarkjs='.length)),
  );
  for (const sc of scenarios) {
    const pub = Object.fromEntries(
      publicInputOrder[sc.circuit].map((n, i) => [
        n,
        fromHex(sc.publicInputs[i]).toString(),
      ]),
    );
    const input =
      sc.circuit === 'deposit'
        ? { ...pub, nk: nk.toString(), d: dSelf.toString() }
        : {
            ...pub,
            nk: nk.toString(),
            d: dSelf.toString(),
            change_d: dSelf.toString(),
            inputAmount: sc.witness.inputAmount,
            rho: fromHex(sc.witness.rho).toString(),
            pathElements: sc.witness.pathElements.map(h =>
              fromHex(h).toString(),
            ),
            pathIndices: sc.witness.pathIndices.map(String),
          };
    const keys = join(ICO, 'zk/keys/v2');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      join(keys, `${sc.circuit}.wasm`),
      join(keys, `${sc.circuit}_final.zkey`),
    );
    const vk = JSON.parse(vkBytes[sc.circuit].toString('utf8'));
    const ok = await snarkjs.groth16.verify(vk, publicSignals, proof);
    const same = publicSignals.every(
      (v, i) => be32(BigInt(v)) === sc.publicInputs[i],
    );
    if (!ok || !same) {
      fail(`snarkjs: ${sc.label}: verified ${ok}, public inputs equal ${same}`);
    }
    console.log(`snarkjs proved and verified: ${sc.label}`);
  }
}

// ---- 6. Write (or compare). -------------------------------------------------------------------
const fixture = {
  schema: 'noctura.a0.prove-vectors/1',
  _provenance:
    'Written by scripts/a0-vectors/gen-prove-vectors.mjs. Scenarios: the app equations ' +
    '(fieldEquations.ts / poseidon-lite), @solana/web3.js ATAs and the Task 1 key fixture; ' +
    'publicInputOrder, the VKs and the landed proofs: the program side files named in `sources`, ' +
    'read at `sourcesRevision`, sha256-pinned. Never written from Rust. ' +
    'Rerun: node scripts/a0-vectors/gen-prove-vectors.mjs --ico=<program side repo> [--check].',
  _byteOrder:
    'Field values are 32-byte BIG-ENDIAN hex, canonical (< r). proofBytes is the 256-byte on-chain layout.',
  sourcesRevision: ICO_REV,
  sources: Object.fromEntries(
    Object.entries(ICO_FILES).map(([k, v]) => [k, v]),
  ),
  publicInputOrder,
  vkSha256: {
    deposit: ICO_FILES.depositVk.sha256,
    withdraw_change: ICO_FILES.withdrawChangeVk.sha256,
  },
  zeros: Z.slice(0, DEPTH).map(be32),
  scenarios,
  landed,
};
const text = `${JSON.stringify(fixture, null, 2)}\n`;
const outputs = [
  [OUT, Buffer.from(text)],
  [join(VK_OUT, 'deposit_vk.json'), vkBytes.deposit],
  [join(VK_OUT, 'withdraw_change_vk.json'), vkBytes.withdraw_change],
];
if (process.argv.includes('--check')) {
  for (const [path, bytes] of outputs) {
    let cur;
    try {
      cur = readFileSync(path);
    } catch {
      fail(`${relative(ROOT, path)} is missing`);
    }
    if (!cur.equals(bytes)) {
      fail(`${relative(ROOT, path)} differs from a fresh generation`);
    }
  }
  console.log('gen-prove-vectors: every output matches a fresh generation');
} else {
  mkdirSync(VK_OUT, { recursive: true });
  for (const [path, bytes] of outputs) {
    writeFileSync(path, bytes);
    console.log(
      `wrote ${relative(ROOT, path)} (${bytes.length} bytes, sha256 ${sha256(bytes)})`,
    );
  }
}
// snarkjs leaves its curve workers running; end explicitly (also when it was not loaded).
process.exit(0);
```

Run it from the repository root, against the program side's checkout (read-only; `ICO` below is `/home/user/Solana/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp` on the owner's laptop; the script reads every program-side file at their `37ad673` with `git show`, never from their working tree — their `5fa2379`, committed during this dry run, already changed `relayer-a0-golden-vectors.json`, and the sha256 pin stopped the first replay on exactly that):

```bash
node scripts/a0-vectors/gen-prove-vectors.mjs --ico="$ICO"
node scripts/a0-vectors/gen-prove-vectors.mjs --ico="$ICO" --snarkjs="$ICO/zk/node_modules/snarkjs" --check
```

Expected (Node 24.10.0; the `MODULE_TYPELESS_PACKAGE_JSON` warning Node prints for the `.ts` import is omitted, as in Tasks 1–2):

```
wrote native/noctura-prover/tests/fixtures/a0-prove-vectors.json (12702 bytes, sha256 9afe754d35b6c9ae3c6b816157f6f4647ace8a0b65c6f2f537b8f30bd7b846e2)
wrote native/noctura-prover/tests/fixtures/a0-vk/deposit_vk.json (3473 bytes, sha256 f6f8ae49b8f032be799ee025f3e48faa34df7aa3685bee54339f538e6f9f2091)
wrote native/noctura-prover/tests/fixtures/a0-vk/withdraw_change_vk.json (4023 bytes, sha256 43dafca79a0523fcffb4a9719f67b4a260cbce2047b9a00c9abff0223134e5cd)
snarkjs proved and verified: deposit: the repo test seed, depositIndex 0, 1 token (10^9 base units)
snarkjs proved and verified: withdraw_change: note of depositIndex 1 (10^9) at leaf 5 of 6, 400000 out + fee 10000, change 999590000
snarkjs proved and verified: withdraw_change: note of depositIndex 2 (10^9) alone at leaf 0 (path = the zeros), everything out, change 0
gen-prove-vectors: every output matches a fresh generation
```

The generation is deterministic (rerunning writes the same bytes; `--check` compares). What the script checked before writing (each a stop on mismatch): the app's equations against every golden row incl. the golden depth-20 fold (with the script's own tree); the tree's zeros and empty root against the ones the program side READ FROM THE TREE ACCOUNT; web3.js's ATA against the relayer-landed exit (`HV996fcQ…` → `DzU8HkTy…`; this check caught the writer's own wrong ATA program id in the first draft); the Task 1 fixture's `addrField`, deposit commitment, nullifiers and `rho_change`; the landed instructions' length, discriminator and trailing bytes, their proof bytes against the program side's decoded `proofBytes`, and the public inputs rebuilt from the instruction + the destination account + the pinned mint against the program side's decoded `publicInputs`. The `--snarkjs` run is the scenarios' positive control: snarkjs, from the full witness assembled in JS, proves each one with the program side's own key files and the proof verifies against the deployed VK with exactly the fixture's public inputs — the vectors are true statements, independently of Rust.

- [ ] **Step 3: Write the failing tests.**

Apply to `native/noctura-prover/src/a0/mod.rs`:

```diff
diff --git a/native/noctura-prover/src/a0/mod.rs b/native/noctura-prover/src/a0/mod.rs
index 918584b..35a7e00 100644
--- a/native/noctura-prover/src/a0/mod.rs
+++ b/native/noctura-prover/src/a0/mod.rs
@@ -1,7 +1,8 @@
 //! A0 shielded keys and field values (spec 2026-11-08 shielded A0 M1 §3): EIP-2333 `sk`, `nk`,
 //! `ivk`, `d_self`, `addrField`, `mintHash`, commitments, deposit `rho(i)`, the internal
 //! nullifier, `rho_change`, `matchSpent`, and the one `Mutex` state that holds them; the
-//! unshield destination's ATA, `parseUnshield` and the single-use unshield authorization.
+//! unshield destination's ATA, `parseUnshield` and the single-use unshield authorization; and
+//! `prove` — the per-circuit allow-lists, witness completion, the sha256-pinned A0 key files.
 //!
 //! The public surface is [`state`]'s [`Core`] / [`Handle`] / [`A0Error`]: it takes a seed and
 //! returns only values that are public once used (a deposit `rho`, a commitment, the indices of
@@ -12,17 +13,22 @@ mod ata;
 mod auth;
 mod eip2333;
 mod field;
+mod keyfiles;
 mod keys;
+mod prove;
 pub mod state;
 mod unshield;
 
 pub use auth::AuthId;
+pub use prove::Proof;
 pub use state::{A0Error, Core, Handle, CORE};
 pub use unshield::{parse_unshield, Unshield, DECIMALS, FEE_CEILING};
 
 #[cfg(test)]
 mod tests;
 #[cfg(test)]
+mod tests_prove;
+#[cfg(test)]
 mod tests_unshield;
 #[cfg(test)]
 mod wipe_probe;
```

Create `native/noctura-prover/src/a0/tests_prove.rs`:

```rust
//! `prove` (spec §3 "prove", R4, I11, m4, m-5, m10, §14 "a proof of each circuit verifies…",
//! "pinned-digest refusal", "the allow-list refusals… the signal table… the counts").
//!
//! Expected values come from `tests/fixtures/a0-prove-vectors.json` and `tests/fixtures/a0-vk/`,
//! written OFFLINE by `scripts/a0-vectors/gen-prove-vectors.mjs` (the app's A0 equations /
//! poseidon-lite, @solana/web3.js, the Task 1 key fixture; the program side's public-input order,
//! deployed VKs and LANDED proofs, sha256-pinned; its `--snarkjs` run proved and verified every
//! scenario with snarkjs). Nothing here computes an expected value with the code under test.
//!
//! THE KEY FILES. The A0 `.zkey` / `.wasm` (MBs) are never committed. The tests that need them
//! read `NOCTURA_A0_KEYS_DIR` (a directory holding the four pinned files: locally the program
//! side's `zk/keys/v2/`; in CI the files the workflow downloads by digest). Without it they SKIP,
//! writing `A0-KEYS-SKIPPED <test>` straight to stderr (past libtest's capture, so the skip shows
//! in a passing run); under CI (`CI` set) a missing directory FAILS instead. Every other test
//! runs without them.

use super::auth::{AuthId, AUTH_TTL};
use super::field::{Fr, MINT};
use super::keyfiles::{self, Pin};
use super::prove::{run, Circuit, DEPOSIT_TABLE, WITHDRAW_CHANGE_TABLE};
use super::state::{A0Error, Core, Handle};
use super::unshield::POOL;
use crate::proof_bytes::{parse_proof, serialize_proof};
use crate::witness_wasmi::{probe, WitnessCalculator};
use ark_bn254::{Bn254, Fq, Fq2, G1Affine, G2Affine};
use ark_circom::read_zkey;
use ark_groth16::{Groth16, Proof as ArkProof, VerifyingKey};
use ark_snark::SNARK;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::time::Duration;

const VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-prove-vectors.json"
));
const KEY_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-key-vectors.json"
));
const DEPOSIT_VK: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-vk/deposit_vk.json"
));
const WITHDRAW_CHANGE_VK: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-vk/withdraw_change_vk.json"
));
/// The repo's public test seed (BIP-39 of "abandon … about", no passphrase) — the fixture's seeds[0].
const SEED_HEX: &str = "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4";
const T0: Duration = Duration::from_secs(1_000);
/// Never read: the refusals under test happen before any key file is opened.
const NO_FILE: &str = "/nonexistent/never-read";

// ------------------------------------------------------------------------------- helpers

fn vectors() -> Value {
    serde_json::from_str(VECTORS).unwrap()
}
fn scenario(i: usize) -> Value {
    vectors()["scenarios"][i].clone()
}
/// [0] deposit; [1] withdraw_change at leaf 5 (change 999590000); [2] withdraw_change, change 0.
fn deposit_sc() -> Value {
    scenario(0)
}
fn withdraw_sc(i: usize) -> Value {
    scenario(i)
}
fn be32(v: &Value) -> [u8; 32] {
    hex::decode(v.as_str().unwrap())
        .unwrap()
        .try_into()
        .unwrap()
}
fn publics(sc: &Value) -> Vec<[u8; 32]> {
    sc["publicInputs"]
        .as_array()
        .unwrap()
        .iter()
        .map(be32)
        .collect()
}
fn open(core: &Core) -> Handle {
    let mut seed: [u8; 64] = hex::decode(SEED_HEX).unwrap().try_into().unwrap();
    core.keys_open(&mut seed).unwrap()
}
fn authorize(core: &Core, h: Handle, sc: &Value, now: Duration) -> AuthId {
    let a = &sc["authorization"];
    core.authorize_unshield_at(
        h,
        a["owner"].as_str().unwrap(),
        a["amount"].as_str().unwrap(),
        a["fee"].as_str().unwrap(),
        now,
    )
    .unwrap()
}
fn wit(sc: &Value) -> String {
    sc["witness"].to_string()
}
/// Everything up to the key files (the lock section), at T0.
fn complete(
    core: &Core,
    h: Handle,
    circuit: &str,
    witness: &str,
    auth: Option<AuthId>,
) -> Result<super::prove::Completed, A0Error> {
    core.complete(h, circuit, witness, auth, T0)
}
fn complete_err(
    core: &Core,
    h: Handle,
    circuit: &str,
    witness: &str,
    auth: Option<AuthId>,
) -> A0Error {
    match complete(core, h, circuit, witness, auth) {
        Ok(_) => panic!("expected a refusal"),
        Err(e) => e,
    }
}
/// A live authorization still there? (taking it with the right id would succeed).
fn auth_is_live(core: &Core) -> bool {
    core.lock().unwrap().peek_auth_expiry_for_test().is_some()
}
fn with_key(sc: &Value, key: &str, value: Value) -> String {
    let mut w = sc["witness"].clone();
    w[key] = value;
    w.to_string()
}
fn without_key(sc: &Value, key: &str) -> String {
    let mut w = sc["witness"].clone();
    w.as_object_mut().unwrap().remove(key);
    w.to_string()
}

/// The key-file directory, or `None` (the test then returns early, loudly).
fn keys_dir(test: &str) -> Option<PathBuf> {
    match std::env::var_os("NOCTURA_A0_KEYS_DIR") {
        Some(d) => Some(PathBuf::from(d)),
        None => {
            assert!(
                std::env::var_os("CI").is_none(),
                "{test}: CI must provide NOCTURA_A0_KEYS_DIR (the A0 key files) — refusing to skip"
            );
            // Straight to the process's stderr: libtest captures print!/eprint!, not this.
            let _ = writeln!(
                std::io::stderr(),
                "A0-KEYS-SKIPPED {test}: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run"
            );
            None
        }
    }
}
fn key_path(dir: &Path, pin: &Pin) -> PathBuf {
    dir.join(pin.file)
}
fn paths(dir: &Path, c: Circuit) -> (PathBuf, PathBuf) {
    (key_path(dir, &c.pins().zkey), key_path(dir, &c.pins().wasm))
}

// snarkjs verifying-key JSON → arkworks (G2 in the JSON is [c0, c1]).
fn fq(v: &Value) -> Fq {
    Fq::from_str(v.as_str().unwrap()).unwrap()
}
fn g1(v: &Value) -> G1Affine {
    assert_eq!(v[2], "1");
    let p = G1Affine::new_unchecked(fq(&v[0]), fq(&v[1]));
    assert!(p.is_on_curve() && p.is_in_correct_subgroup_assuming_on_curve());
    p
}
fn g2(v: &Value) -> G2Affine {
    assert_eq!(v[2], json!(["1", "0"]));
    let p = G2Affine::new_unchecked(
        Fq2::new(fq(&v[0][0]), fq(&v[0][1])),
        Fq2::new(fq(&v[1][0]), fq(&v[1][1])),
    );
    assert!(p.is_on_curve() && p.is_in_correct_subgroup_assuming_on_curve());
    p
}
fn vk(json: &str) -> VerifyingKey<Bn254> {
    let v: Value = serde_json::from_str(json).unwrap();
    VerifyingKey {
        alpha_g1: g1(&v["vk_alpha_1"]),
        beta_g2: g2(&v["vk_beta_2"]),
        gamma_g2: g2(&v["vk_gamma_2"]),
        delta_g2: g2(&v["vk_delta_2"]),
        gamma_abc_g1: v["IC"].as_array().unwrap().iter().map(g1).collect(),
    }
}
fn vk_of(c: Circuit) -> VerifyingKey<Bn254> {
    vk(match c {
        Circuit::Deposit => DEPOSIT_VK,
        Circuit::WithdrawChange => WITHDRAW_CHANGE_VK,
    })
}
fn frs(publics: &[[u8; 32]]) -> Vec<Fr> {
    publics
        .iter()
        .map(|b| super::field::fr_from_be32(b).unwrap())
        .collect()
}
fn verifies(vk: &VerifyingKey<Bn254>, proof: &ArkProof<Bn254>, publics: &[[u8; 32]]) -> bool {
    let pvk = Groth16::<Bn254>::process_vk(vk).unwrap();
    Groth16::<Bn254>::verify_with_processed_vk(&pvk, &frs(publics), proof).unwrap()
}
fn bytes256(hex_str: &str) -> [u8; 256] {
    hex::decode(hex_str).unwrap().try_into().unwrap()
}

// ---------------------------------------------------- the tables and the allow-lists (m-5)

#[test]
fn each_allow_list_and_its_rust_filled_names_partition_the_circuits_table() {
    for table in [&DEPOSIT_TABLE, &WITHDRAW_CHANGE_TABLE] {
        let signals: Vec<&str> = table.signals().map(|s| s.name).collect();
        let distinct: HashSet<&str> = signals.iter().copied().collect();
        assert_eq!(distinct.len(), signals.len(), "a signal is listed twice");
        let mapped: Vec<&str> = table.js.iter().map(|(_, sig)| *sig).collect();
        let api: HashSet<&str> = table.js.iter().map(|(api, _)| *api).collect();
        assert_eq!(api.len(), table.js.len(), "an API name is listed twice");
        let mut union: Vec<&str> = mapped.iter().chain(table.rust.iter()).copied().collect();
        let n = union.len();
        union.sort_unstable();
        union.dedup();
        assert_eq!(
            union.len(),
            n,
            "a signal is both JS-supplied and Rust-filled"
        );
        let mut want: Vec<&str> = signals.clone();
        want.sort_unstable();
        assert_eq!(union, want, "mapped(JS) ∪ Rust-filled is not the table");
    }
    // The documented allow-lists (spec §3), as API names.
    let api = |t: &super::prove::Table| t.js.iter().map(|(a, _)| *a).collect::<Vec<_>>();
    assert_eq!(api(&DEPOSIT_TABLE), ["amount", "depositIndex"]);
    assert_eq!(
        api(&WITHDRAW_CHANGE_TABLE),
        [
            "merkleRoot",
            "inputAmount",
            "rho",
            "pathElements",
            "pathIndices"
        ]
    );
    assert_eq!(
        DEPOSIT_TABLE.js[1],
        ("depositIndex", "rho"),
        "depositIndex maps to rho"
    );
}

#[test]
fn the_public_order_is_the_program_sides() {
    let v = vectors();
    for (table, c) in [
        (&DEPOSIT_TABLE, "deposit"),
        (&WITHDRAW_CHANGE_TABLE, "withdraw_change"),
    ] {
        let ours: Vec<&str> = table.public.iter().map(|s| s.name).collect();
        let theirs: Vec<&str> = v["publicInputOrder"][c]
            .as_array()
            .unwrap()
            .iter()
            .map(|x| x.as_str().unwrap())
            .collect();
        assert_eq!(ours, theirs, "{c}");
        assert!(table.public.iter().all(|s| s.len == 1));
    }
}

#[test]
fn the_completed_witness_has_exactly_the_tables_signals_in_order() {
    let core = Core::new();
    let h = open(&core);
    let d = complete(&core, h, "deposit", &wit(&deposit_sc()), None).unwrap();
    let want: Vec<&str> = DEPOSIT_TABLE.signals().map(|s| s.name).collect();
    assert_eq!(d.names(), want);
    let sc = withdraw_sc(1);
    let id = authorize(&core, h, &sc, T0);
    let w = complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
    let want: Vec<&str> = WITHDRAW_CHANGE_TABLE.signals().map(|s| s.name).collect();
    assert_eq!(w.names(), want);
}

// ------------------------------------------- the values Rust completes (JS recomputes them)

#[test]
fn the_deposit_public_inputs_are_the_desk_values() {
    let core = Core::new();
    let h = open(&core);
    let sc = deposit_sc();
    let d = complete(&core, h, "deposit", &wit(&sc), None).unwrap();
    assert_eq!(d.publics_be32(), publics(&sc));
    // and the commitment / rho are the public calls' own (what JS stores for the note)
    let rho = core.deposit_rho(h, 0).unwrap();
    assert_eq!(d.publics_be32()[3], rho);
    assert_eq!(
        d.publics_be32()[0],
        core.commitment(h, 1_000_000_000, &rho).unwrap()
    );
}

#[test]
fn the_withdraw_change_public_inputs_take_amount_fee_and_destination_from_the_authorization() {
    for i in [1, 2] {
        let core = Core::new();
        let h = open(&core);
        let sc = withdraw_sc(i);
        let id = authorize(&core, h, &sc, T0);
        let w = complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
        assert_eq!(w.publics_be32(), publics(&sc), "{}", sc["label"]);
    }
    // Negative control: another authorized amount gives other public inputs (withdrawAmount and
    // the change commitment) for the same JS witness.
    let core = Core::new();
    let h = open(&core);
    let sc = withdraw_sc(1);
    let a = &sc["authorization"];
    let id = core
        .authorize_unshield_at(h, a["owner"].as_str().unwrap(), "400001", "10000", T0)
        .unwrap();
    let w = complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
    let got = w.publics_be32();
    let want = publics(&sc);
    assert_ne!(got[2], want[2]);
    assert_ne!(got[5], want[5]);
    assert_eq!(got[..2], want[..2]);
}

// ----------------------------------------------------------------- the circuit name

#[test]
fn transfer_is_refused_in_m1_and_unknown_circuits_are_refused() {
    let core = Core::new();
    let h = open(&core);
    let w = wit(&deposit_sc());
    assert_eq!(
        complete_err(&core, h, "transfer", &w, None),
        A0Error::CircuitNotInM1
    );
    for name in ["", "Deposit", "withdraw", "deposit ", "withdraw_change\0"] {
        assert_eq!(
            complete_err(&core, h, name, &w, None),
            A0Error::CircuitUnknown,
            "{name:?}"
        );
    }
    // Through the public prove, the same.
    let p = Path::new(NO_FILE);
    assert_eq!(
        core.prove(h, "transfer", &w, None, p, p).unwrap_err(),
        A0Error::CircuitNotInM1
    );
}

// --------------------------------------------------------------- the allow-list (I11)

#[test]
fn every_rust_filled_name_is_refused_even_with_a_well_formed_value() {
    let core = Core::new();
    let h = open(&core);
    let field = json!("0000000000000000000000000000000000000000000000000000000000000001");
    for (table, circuit, sc) in [
        (&DEPOSIT_TABLE, "deposit", deposit_sc()),
        (&WITHDRAW_CHANGE_TABLE, "withdraw_change", withdraw_sc(1)),
    ] {
        let api: Vec<&str> = table.js.iter().map(|(a, _)| *a).collect();
        let refused: Vec<&str> = table
            .signals()
            .map(|s| s.name)
            .filter(|n| !api.contains(n))
            .collect();
        assert_eq!(
            refused.len(),
            table.rust.len() + usize::from(circuit == "deposit"),
            "deposit also refuses `rho` (JS names it depositIndex)"
        );
        for name in refused {
            let id = (circuit == "withdraw_change").then(|| authorize(&core, h, &sc, T0));
            assert_eq!(
                complete_err(&core, h, circuit, &with_key(&sc, name, field.clone()), id),
                A0Error::WitnessRustFilled {
                    name: table.signals().find(|s| s.name == name).unwrap().name
                },
                "{circuit}.{name}"
            );
        }
    }
}

#[test]
fn unknown_missing_repeated_and_non_object_witnesses_are_refused() {
    let core = Core::new();
    let h = open(&core);
    let sc = deposit_sc();
    for key in [
        "amountt",
        "Amount",
        "",
        "depositindex",
        "secret",
        "ivk",
        "sk",
    ] {
        assert_eq!(
            complete_err(&core, h, "deposit", &with_key(&sc, key, json!("1")), None),
            A0Error::WitnessUnknownKey,
            "{key:?}"
        );
    }
    for key in ["amount", "depositIndex"] {
        assert_eq!(
            complete_err(&core, h, "deposit", &without_key(&sc, key), None),
            A0Error::WitnessMissing { name: key }
        );
    }
    let repeated = r#"{"amount":"1000000000","depositIndex":"0","amount":"1000000000"}"#;
    assert_eq!(
        complete_err(&core, h, "deposit", repeated, None),
        A0Error::WitnessDuplicate { name: "amount" }
    );
    for bad in [
        "",
        "[]",
        "null",
        "\"x\"",
        "{",
        r#"{"amount":"1000000000","depositIndex":"0"} {}"#,
        r#"{"amount":"1000000000","depositIndex":"0"},"#,
    ] {
        assert_eq!(
            complete_err(&core, h, "deposit", bad, None),
            A0Error::WitnessJson,
            "{bad:?}"
        );
    }
    // Positive control: the fixture's witness passes, and so does its key order reversed.
    complete(&core, h, "deposit", &wit(&sc), None).unwrap();
    complete(
        &core,
        h,
        "deposit",
        r#"{"depositIndex":"0","amount":"1000000000"}"#,
        None,
    )
    .unwrap();
}

#[test]
fn witness_values_must_have_their_one_canonical_form() {
    let core = Core::new();
    let h = open(&core);
    let r = "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001"; // = r
    let d = deposit_sc();
    for (key, v) in [
        ("amount", json!(1_000_000_000u64)),
        ("amount", json!("01")),
        ("amount", json!("+1")),
        ("amount", json!("18446744073709551616")),
        ("amount", json!(" 1")),
        ("depositIndex", json!("-1")),
        ("depositIndex", json!(null)),
    ] {
        assert_eq!(
            complete_err(&core, h, "deposit", &with_key(&d, key, v.clone()), None),
            A0Error::WitnessValue {
                name: if key == "amount" {
                    "amount"
                } else {
                    "depositIndex"
                },
                index: 0
            },
            "{key} = {v}"
        );
    }
    assert_eq!(
        complete_err(
            &core,
            h,
            "deposit",
            &with_key(&d, "amount", json!("0")),
            None
        ),
        A0Error::AmountZero
    );
    let sc = withdraw_sc(1);
    let mut cases: Vec<(String, A0Error)> = Vec::new();
    for v in [
        json!(r),
        json!(r.to_uppercase()),
        json!(&r[1..]),
        json!(format!("0x{}", &r[2..])),
        json!(1),
    ] {
        cases.push((
            with_key(&sc, "merkleRoot", v.clone()),
            A0Error::WitnessValue {
                name: "merkleRoot",
                index: 0,
            },
        ));
        cases.push((
            with_key(&sc, "rho", v),
            A0Error::WitnessValue {
                name: "rho",
                index: 0,
            },
        ));
    }
    let mut pe = sc["witness"]["pathElements"].clone();
    pe[7] = json!(r);
    cases.push((
        with_key(&sc, "pathElements", pe),
        A0Error::WitnessValue {
            name: "pathElements",
            index: 7,
        },
    ));
    let mut short = sc["witness"]["pathElements"].clone();
    short.as_array_mut().unwrap().pop();
    cases.push((
        with_key(&sc, "pathElements", short),
        A0Error::WitnessValue {
            name: "pathElements",
            index: 20,
        },
    ));
    for bad in [json!(2), json!("1"), json!(-1), json!(1.0), json!(true)] {
        let mut pi = sc["witness"]["pathIndices"].clone();
        pi[3] = bad;
        cases.push((
            with_key(&sc, "pathIndices", pi),
            A0Error::WitnessValue {
                name: "pathIndices",
                index: 3,
            },
        ));
    }
    let mut long = sc["witness"]["pathIndices"].clone();
    long.as_array_mut().unwrap().push(json!(0));
    cases.push((
        with_key(&sc, "pathIndices", long),
        A0Error::WitnessValue {
            name: "pathIndices",
            index: 20,
        },
    ));
    cases.push((
        with_key(&sc, "inputAmount", json!("1000000000.0")),
        A0Error::WitnessValue {
            name: "inputAmount",
            index: 0,
        },
    ));
    for (w, want) in cases {
        let id = authorize(&core, h, &sc, T0);
        assert_eq!(
            complete_err(&core, h, "withdraw_change", &w, Some(id)),
            want
        );
    }
}

// ---------------------------------------------------- the authorization (INV-AUTH, §3)

#[test]
fn withdraw_change_needs_a_live_authorization_and_every_prove_consumes_it() {
    let sc = withdraw_sc(1);
    let w = wit(&sc);
    // absent: no authId → refused, and a live record is dropped by that call
    let core = Core::new();
    let h = open(&core);
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, None),
        A0Error::AuthAbsent
    );
    let id = authorize(&core, h, &sc, T0);
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, None),
        A0Error::AuthAbsent
    );
    assert!(!auth_is_live(&core));
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, Some(id)),
        A0Error::AuthAbsent,
        "the authorization went with the first prove"
    );
    // used once: success, then the same id again
    let id = authorize(&core, h, &sc, T0);
    complete(&core, h, "withdraw_change", &w, Some(id)).unwrap();
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, Some(id)),
        A0Error::AuthAbsent
    );
    // another id: refused, and the live one is used up
    let id = authorize(&core, h, &sc, T0);
    assert_eq!(
        complete_err(
            &core,
            h,
            "withdraw_change",
            &w,
            Some(AuthId::from_bytes([7; 16]))
        ),
        A0Error::AuthMismatch
    );
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, Some(id)),
        A0Error::AuthAbsent
    );
    // expired: usable at approval + 120 s − 1 ns, not at + 120 s
    let id = authorize(&core, h, &sc, T0);
    complete(&core, h, "withdraw_change", &w, Some(id)).unwrap();
    let id = authorize(&core, h, &sc, T0);
    assert_eq!(
        core.complete(h, "withdraw_change", &w, Some(id), T0 + AUTH_TTL)
            .err(),
        Some(A0Error::AuthExpired)
    );
    let id = authorize(&core, h, &sc, T0);
    core.complete(
        h,
        "withdraw_change",
        &w,
        Some(id),
        T0 + AUTH_TTL - Duration::from_nanos(1),
    )
    .unwrap();
    // from a closed handle, and from a replaced one
    let id = authorize(&core, h, &sc, T0);
    core.keys_close(h).unwrap();
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, Some(id)),
        A0Error::UnknownHandle
    );
    let h1 = open(&core);
    let id = authorize(&core, h1, &sc, T0);
    let h2 = open(&core);
    assert_eq!(
        complete_err(&core, h1, "withdraw_change", &w, Some(id)),
        A0Error::UnknownHandle
    );
    assert_eq!(
        complete_err(&core, h2, "withdraw_change", &w, Some(id)),
        A0Error::AuthAbsent
    );
}

#[test]
fn a_prove_that_refuses_for_any_reason_still_uses_the_authorization_up() {
    let sc = withdraw_sc(1);
    let core = Core::new();
    let h = open(&core);
    let refusals: Vec<(&str, String)> = vec![
        ("transfer", wit(&sc)),
        ("nope", wit(&sc)),
        ("withdraw_change", "{".to_string()),
        (
            "withdraw_change",
            with_key(&sc, "nk", json!("00".repeat(32))),
        ),
        ("withdraw_change", without_key(&sc, "rho")),
        ("deposit", wit(&deposit_sc())),
    ];
    for (circuit, w) in refusals {
        let id = authorize(&core, h, &sc, T0);
        assert!(complete(&core, h, circuit, &w, Some(id)).is_err());
        assert!(!auth_is_live(&core), "{circuit}");
        assert_eq!(
            complete_err(&core, h, "withdraw_change", &wit(&sc), Some(id)),
            A0Error::AuthAbsent,
            "{circuit}: the record survived a refused prove"
        );
    }
}

#[test]
fn a_deposit_refuses_an_authorization_and_uses_it_up() {
    let core = Core::new();
    let h = open(&core);
    let sc = withdraw_sc(1);
    let id = authorize(&core, h, &sc, T0);
    assert_eq!(
        complete_err(&core, h, "deposit", &wit(&deposit_sc()), Some(id)),
        A0Error::AuthUnexpected
    );
    assert!(!auth_is_live(&core));
    // a deposit without one is fine, and drops a live record (every prove consumes it)
    let id = authorize(&core, h, &sc, T0);
    complete(&core, h, "deposit", &wit(&deposit_sc()), None).unwrap();
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &wit(&sc), Some(id)),
        A0Error::AuthAbsent
    );
}

#[test]
fn amount_plus_fee_above_the_note_is_refused_and_equal_is_accepted() {
    let core = Core::new();
    let h = open(&core);
    let sc = withdraw_sc(2); // 999_990_000 + 10_000 = 1_000_000_000 = inputAmount: change 0
    assert_eq!(sc["changeAmount"], "0");
    let id = authorize(&core, h, &sc, T0);
    complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
    let owner = sc["authorization"]["owner"].as_str().unwrap();
    for (amount, fee) in [("999990001", "10000"), ("999990000", "10001")] {
        let id = core
            .authorize_unshield_at(h, owner, amount, fee, T0)
            .unwrap();
        assert_eq!(
            complete_err(&core, h, "withdraw_change", &wit(&sc), Some(id)),
            A0Error::WithdrawExceedsInput,
            "{amount} + {fee}"
        );
    }
}

#[test]
fn an_inconsistent_authorization_record_is_refused() {
    let sc = withdraw_sc(1);
    let core = Core::new();
    let h = open(&core);
    // Take a real record out (consumes it), then plant edited copies of it.
    let real = {
        let id = authorize(&core, h, &sc, T0);
        core.lock().unwrap().take_auth(h, &id, T0).unwrap()
    };
    type Edit = fn(&mut super::auth::Auth);
    let edits: [(&str, Edit); 4] = [
        ("pool", |a| a.pool[0] ^= 1),
        ("mint", |a| a.mint[31] ^= 1),
        ("ata", |a| a.ata[5] ^= 1),
        ("owner", |a| a.owner = [0x11; 32]),
    ];
    for (what, edit) in edits {
        let mut planted = real_copy(&real);
        edit(&mut planted);
        let id = planted.id;
        core.lock().unwrap().plant_auth_for_test(planted);
        assert_eq!(
            complete_err(&core, h, "withdraw_change", &wit(&sc), Some(id)),
            A0Error::AuthRecordInconsistent,
            "{what}"
        );
    }
    // Positive control: the unedited copy completes.
    let planted = real_copy(&real);
    let id = planted.id;
    core.lock().unwrap().plant_auth_for_test(planted);
    complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
    assert_eq!(real.pool, POOL);
    assert_eq!(real.mint, MINT);
}

fn real_copy(a: &super::auth::Auth) -> super::auth::Auth {
    super::auth::Auth {
        id: a.id,
        handle: a.handle,
        owner: a.owner,
        ata: a.ata,
        amount: a.amount,
        fee: a.fee,
        pool: a.pool,
        mint: a.mint,
        expires_at: a.expires_at,
    }
}

#[test]
fn a_note_not_in_the_named_tree_is_refused_before_any_key_file() {
    let core = Core::new();
    let h = open(&core);
    let sc = withdraw_sc(1);
    let other = json!("00000000000000000000000000000000000000000000000000000000000003ee");
    let mut pe = sc["witness"]["pathElements"].clone();
    pe[0] = other.clone();
    let mut pi = sc["witness"]["pathIndices"].clone();
    pi[0] = json!(0); // leaf 5 is a right child: index 0 puts it on the wrong side
    let cases = [
        with_key(&sc, "pathElements", pe),
        with_key(&sc, "pathIndices", pi),
        with_key(&sc, "merkleRoot", other),
        with_key(&sc, "inputAmount", json!("999999999")),
        with_key(&sc, "rho", withdraw_sc(2)["witness"]["rho"].clone()),
    ];
    for w in cases {
        let id = authorize(&core, h, &sc, T0);
        let p = Path::new(NO_FILE);
        assert_eq!(
            core.prove_at(h, "withdraw_change", &w, Some(id), p, p, T0)
                .unwrap_err(),
            A0Error::WitnessNotInTree
        );
    }
}

// ------------------------------------------------- no witness value in any refusal (m4)

#[test]
fn no_refusal_carries_a_witness_or_key_value() {
    let kv: Value = serde_json::from_str(KEY_VECTORS).unwrap();
    let seed = &kv["seeds"][0];
    let sc = withdraw_sc(1);
    let mut secrets: Vec<String> = vec![];
    for k in ["nk", "dSelf", "addrSelf", "ivk", "sk"] {
        let h = seed[k].as_str().unwrap().to_string();
        let dec = num_bigint::BigUint::parse_bytes(h.as_bytes(), 16)
            .unwrap()
            .to_string();
        secrets.push(h);
        secrets.push(dec);
    }
    for k in ["merkleRoot", "rho"] {
        secrets.push(sc["witness"][k].as_str().unwrap().to_string());
    }
    secrets.push(
        sc["witness"]["pathElements"][1]
            .as_str()
            .unwrap()
            .to_string(),
    );
    secrets.push("1000000000".into());
    secrets.push("987654321987".into());
    let core = Core::new();
    let h = open(&core);
    let mut errors = vec![];
    let mut run = |circuit: &str, w: String, auth: bool| {
        let id = auth.then(|| authorize(&core, h, &sc, T0));
        errors.push(complete_err(&core, h, circuit, &w, id));
    };
    let r = "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001";
    run(
        "withdraw_change",
        with_key(&sc, "nk", json!(seed["nk"])),
        true,
    );
    run(
        "withdraw_change",
        with_key(&sc, "d", json!(seed["dSelf"])),
        true,
    );
    run(
        "withdraw_change",
        with_key(&sc, "inputAmount", json!("987654321987x")),
        true,
    );
    run(
        "withdraw_change",
        with_key(&sc, "inputAmount", json!("987654321987")),
        true,
    );
    run("withdraw_change", with_key(&sc, "rho", json!(r)), true);
    run(
        "withdraw_change",
        with_key(&sc, "merkleRoot", json!(seed["addrSelf"])),
        true,
    );
    run("withdraw_change", wit(&sc).replace('}', ",}"), true);
    run(
        "withdraw_change",
        with_key(&sc, seed["nk"].as_str().unwrap(), json!("1")),
        true,
    );
    run("withdraw_change", wit(&sc), false);
    run("transfer", wit(&sc), true);
    run("deposit", wit(&deposit_sc()), true);
    let d = deposit_sc();
    run(
        "deposit",
        with_key(&d, "amount", json!("1000000000 ")),
        false,
    );
    run("deposit", with_key(&d, "rho", json!(seed["nk"])), false);
    assert!(errors.len() >= 13);
    for e in &errors {
        for text in [e.to_string(), format!("{e:?}")] {
            for s in &secrets {
                assert!(!text.contains(s.as_str()), "{text:?} carries {s}");
            }
            assert!(text.len() < 90, "{text:?}");
        }
    }
    // Positive control on the check itself: a message that did carry a value would be caught.
    assert!(format!("rho {}", secrets[10]).contains(secrets[10].as_str()));
}

// ------------------------------------------------------------ the pinned key files (R4)

#[test]
fn the_pins_are_where_ci_reads_them() {
    // The workflow greps `file: "…", sha256: "…"` from this source: four pairs, the pinned ones.
    let src = include_str!("keyfiles.rs");
    let pairs: Vec<(String, String)> = src
        .lines()
        .filter_map(|l| {
            let f = l.split("file: \"").nth(1)?.split('"').next()?;
            let s = l.split("sha256: \"").nth(1)?.split('"').next()?;
            Some((f.to_string(), s.to_string()))
        })
        .collect();
    let pins = [
        keyfiles::DEPOSIT.zkey,
        keyfiles::DEPOSIT.wasm,
        keyfiles::WITHDRAW_CHANGE.zkey,
        keyfiles::WITHDRAW_CHANGE.wasm,
    ];
    let want: Vec<(String, String)> = pins
        .iter()
        .map(|p| (p.file.to_string(), p.sha256.to_string()))
        .collect();
    assert_eq!(pairs, want);
    for p in pins {
        assert!(p.sha256.len() == 64 && p.sha256.bytes().all(|b| b.is_ascii_hexdigit()));
        assert_eq!(p.sha256, p.sha256.to_lowercase());
        assert!(p.len > 0);
    }
}

#[test]
fn a_key_file_that_is_not_the_pinned_bytes_is_refused() {
    let dir = std::env::temp_dir().join(format!("a0-pin-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let pin = keyfiles::DEPOSIT.zkey;
    let short = dir.join("short");
    std::fs::write(&short, b"not a zkey").unwrap();
    let same_len = dir.join("same_len");
    std::fs::write(&same_len, vec![0u8; pin.len as usize]).unwrap();
    assert_eq!(
        keyfiles::load(&short, &pin),
        Err(A0Error::KeyFilePin { file: pin.file })
    );
    assert_eq!(
        keyfiles::load(&same_len, &pin),
        Err(A0Error::KeyFilePin { file: pin.file })
    );
    assert_eq!(
        keyfiles::load(&dir.join("absent"), &pin),
        Err(A0Error::KeyFileRead { file: pin.file })
    );
    // Through prove: a valid deposit witness, bad files → refused at the zkey.
    let core = Core::new();
    let h = open(&core);
    assert_eq!(
        core.prove(h, "deposit", &wit(&deposit_sc()), None, &same_len, &short)
            .unwrap_err(),
        A0Error::KeyFilePin { file: pin.file }
    );
    std::fs::remove_dir_all(&dir).unwrap();
}

// --------------------------------------------- the on-chain layout against landed proofs (m10)

#[test]
fn landed_withdraw_change_proofs_verify_under_our_layout_against_the_deployed_vk() {
    let v = vectors();
    let vk = vk_of(Circuit::WithdrawChange);
    let landed = v["landed"].as_array().unwrap();
    assert_eq!(landed.len(), 2);
    for l in landed {
        let bytes = bytes256(l["proofBytes"].as_str().unwrap());
        let publics = publics(l);
        let proof = parse_proof(&bytes).unwrap();
        assert!(verifies(&vk, &proof, &publics), "{}", l["label"]);
        assert_eq!(
            serialize_proof(&proof),
            bytes,
            "serialize(parse(x)) = x on landed bytes"
        );
        // Negative controls: each part of the layout is load-bearing.
        let a_not_negated = ArkProof {
            a: -proof.a,
            ..proof.clone()
        };
        assert!(
            !verifies(&vk, &a_not_negated, &publics),
            "A must be un-negated"
        );
        let b_c0_first = ArkProof {
            b: G2Affine::new_unchecked(
                Fq2::new(proof.b.x.c1, proof.b.x.c0),
                Fq2::new(proof.b.y.c1, proof.b.y.c0),
            ),
            ..proof.clone()
        };
        assert!(!verifies(&vk, &b_c0_first, &publics), "G2 is c1-first");
        let mut other = publics.clone();
        other[2][31] ^= 1; // withdrawAmount
        assert!(!verifies(&vk, &proof, &other), "the statement is bound");
        assert!(
            !verifies(&vk_of(Circuit::Deposit), &proof, &publics[..4]),
            "another circuit's VK"
        );
    }
}

#[test]
fn the_vk_fixtures_are_the_pinned_deployed_files() {
    let v = vectors();
    for (c, json, name) in [
        (Circuit::Deposit, DEPOSIT_VK, "deposit"),
        (
            Circuit::WithdrawChange,
            WITHDRAW_CHANGE_VK,
            "withdraw_change",
        ),
    ] {
        assert_eq!(
            hex::encode(Sha256::digest(json.as_bytes())),
            v["vkSha256"][name].as_str().unwrap()
        );
        assert_eq!(vk_of(c).gamma_abc_g1.len(), c.table().public.len() + 1);
    }
    assert_eq!(
        v["vkSha256"]["deposit"],
        "f6f8ae49b8f032be799ee025f3e48faa34df7aa3685bee54339f538e6f9f2091"
    );
    assert_eq!(
        v["vkSha256"]["withdraw_change"],
        "43dafca79a0523fcffb4a9719f67b4a260cbce2047b9a00c9abff0223134e5cd"
    );
}

// ----------------------------------------------------------- with the key files (keyed)

#[test]
fn keyed_the_signal_tables_are_the_circuits_inputs_and_their_counts() {
    let Some(dir) = keys_dir("keyed_the_signal_tables_are_the_circuits_inputs_and_their_counts")
    else {
        return;
    };
    for c in [Circuit::Deposit, Circuit::WithdrawChange] {
        let (zkey, wasm) = paths(&dir, c);
        let zkey = keyfiles::load(&zkey, &c.pins().zkey).unwrap();
        let wasm = keyfiles::load(&wasm, &c.pins().wasm).unwrap();
        let table = c.table();
        let mut wc = WitnessCalculator::from_bytes(&wasm).unwrap();
        for s in table.signals() {
            assert_eq!(
                wc.input_signal_size(s.name).unwrap(),
                Some(s.len),
                "{c:?}.{}",
                s.name
            );
        }
        // Negative controls: the probe answers None for names the circuit does not have.
        for n in ["nk_", "commitmentx", "in_d", "depositIndex", "changeAmount"] {
            assert_eq!(wc.input_signal_size(n).unwrap(), None, "{n}");
        }
        let total: usize = table.signals().map(|s| s.len).sum();
        let n_inputs = wc.input_size().unwrap();
        assert_eq!(total, n_inputs, "{c:?}: the table is every input");
        let (_, matrices) = read_zkey(&mut std::io::Cursor::new(&zkey)).unwrap();
        let n_public = matrices.num_instance_variables - 1;
        let pub_len: usize = table.public.iter().map(|s| s.len).sum();
        let priv_len: usize = table.private.iter().map(|s| s.len).sum();
        assert_eq!(pub_len, n_public, "{c:?}: nPubInputs (the zkey's)");
        assert_eq!(priv_len, n_inputs - n_public, "{c:?}: nPrivInputs");
        let expect = match c {
            Circuit::Deposit => (4, 2),
            Circuit::WithdrawChange => (7, 45),
        };
        assert_eq!(
            (n_public, n_inputs - n_public),
            expect,
            "the r1cs header's counts"
        );
    }
}

#[test]
fn keyed_a_deposit_proof_verifies_against_the_deployed_vk_with_the_desk_values() {
    let Some(dir) =
        keys_dir("keyed_a_deposit_proof_verifies_against_the_deployed_vk_with_the_desk_values")
    else {
        return;
    };
    let core = Core::new();
    let h = open(&core);
    let sc = deposit_sc();
    let (zkey, wasm) = paths(&dir, Circuit::Deposit);
    let out = core
        .prove(h, "deposit", &wit(&sc), None, &zkey, &wasm)
        .unwrap();
    assert_eq!(out.public_inputs, publics(&sc));
    let proof = parse_proof(&out.proof_bytes).unwrap();
    assert!(verifies(
        &vk_of(Circuit::Deposit),
        &proof,
        &out.public_inputs
    ));
    // Negative control: one byte of C changed does not verify.
    let mut bad = out.proof_bytes;
    bad[255] ^= 1;
    let bad = parse_proof(&bad).unwrap();
    assert!(!(bad.c.is_on_curve() && verifies(&vk_of(Circuit::Deposit), &bad, &out.public_inputs)));
}

#[test]
fn keyed_withdraw_change_proofs_verify_against_the_deployed_vk() {
    let Some(dir) = keys_dir("keyed_withdraw_change_proofs_verify_against_the_deployed_vk") else {
        return;
    };
    let (zkey, wasm) = paths(&dir, Circuit::WithdrawChange);
    for i in [1, 2] {
        let sc = withdraw_sc(i);
        let core = Core::new();
        let h = open(&core);
        let id = authorize(&core, h, &sc, T0);
        let out = core
            .prove_at(h, "withdraw_change", &wit(&sc), Some(id), &zkey, &wasm, T0)
            .unwrap();
        assert_eq!(out.public_inputs, publics(&sc), "{}", sc["label"]);
        let proof = parse_proof(&out.proof_bytes).unwrap();
        assert!(verifies(
            &vk_of(Circuit::WithdrawChange),
            &proof,
            &out.public_inputs
        ));
        // The proof used the authorization up.
        assert_eq!(
            core.prove_at(h, "withdraw_change", &wit(&sc), Some(id), &zkey, &wasm, T0)
                .unwrap_err(),
            A0Error::AuthAbsent
        );
    }
}

#[test]
fn keyed_the_vk_fixtures_are_the_pinned_zkeys_own_verifying_keys() {
    let Some(dir) = keys_dir("keyed_the_vk_fixtures_are_the_pinned_zkeys_own_verifying_keys")
    else {
        return;
    };
    for c in [Circuit::Deposit, Circuit::WithdrawChange] {
        let zkey = keyfiles::load(&paths(&dir, c).0, &c.pins().zkey).unwrap();
        let (params, _) = read_zkey(&mut std::io::Cursor::new(&zkey)).unwrap();
        assert_eq!(params.vk, vk_of(c), "{c:?}");
    }
    assert_ne!(vk_of(Circuit::Deposit), vk_of(Circuit::WithdrawChange));
}

#[test]
fn keyed_a_one_byte_changed_or_swapped_key_file_is_refused() {
    let Some(dir) = keys_dir("keyed_a_one_byte_changed_or_swapped_key_file_is_refused") else {
        return;
    };
    let tmp = std::env::temp_dir().join(format!("a0-flip-{}", std::process::id()));
    std::fs::create_dir_all(&tmp).unwrap();
    let core = Core::new();
    let h = open(&core);
    let w = wit(&deposit_sc());
    let (zkey, wasm) = paths(&dir, Circuit::Deposit);
    for (pin, src, offset) in [
        (keyfiles::DEPOSIT.zkey, &zkey, 1000usize),
        (keyfiles::DEPOSIT.wasm, &wasm, 2_000_000),
    ] {
        let mut bytes = std::fs::read(src).unwrap();
        assert!(keyfiles::load(src, &pin).is_ok(), "positive control");
        bytes[offset] ^= 0x01;
        let flipped = tmp.join(pin.file);
        std::fs::write(&flipped, &bytes).unwrap();
        assert_eq!(
            keyfiles::load(&flipped, &pin),
            Err(A0Error::KeyFilePin { file: pin.file })
        );
        let (z, wa) = if pin.file.ends_with(".zkey") {
            (flipped.as_path(), wasm.as_path())
        } else {
            (zkey.as_path(), flipped.as_path())
        };
        assert_eq!(
            core.prove(h, "deposit", &w, None, z, wa).unwrap_err(),
            A0Error::KeyFilePin { file: pin.file }
        );
    }
    // The other circuit's (pinned, genuine) files are refused for this circuit.
    let (wz, ww) = paths(&dir, Circuit::WithdrawChange);
    assert_eq!(
        core.prove(h, "deposit", &w, None, &wz, &wasm).unwrap_err(),
        A0Error::KeyFilePin {
            file: keyfiles::DEPOSIT.zkey.file
        }
    );
    assert_eq!(
        core.prove(h, "deposit", &w, None, &zkey, &ww).unwrap_err(),
        A0Error::KeyFilePin {
            file: keyfiles::DEPOSIT.wasm.file
        }
    );
    std::fs::remove_dir_all(&tmp).unwrap();
}

#[test]
fn keyed_two_proofs_of_one_witness_differ_and_both_verify() {
    let Some(dir) = keys_dir("keyed_two_proofs_of_one_witness_differ_and_both_verify") else {
        return;
    };
    let core = Core::new();
    let h = open(&core);
    let (zkey, wasm) = paths(&dir, Circuit::Deposit);
    let w = wit(&deposit_sc());
    let a = core.prove(h, "deposit", &w, None, &zkey, &wasm).unwrap();
    let b = core.prove(h, "deposit", &w, None, &zkey, &wasm).unwrap();
    assert_eq!(a.public_inputs, b.public_inputs);
    assert_ne!(
        a.proof_bytes, b.proof_bytes,
        "r, s must be fresh randomness"
    );
    for p in [&a, &b] {
        let proof = parse_proof(&p.proof_bytes).unwrap();
        assert!(verifies(&vk_of(Circuit::Deposit), &proof, &p.public_inputs));
    }
}

#[test]
fn keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped() {
    let Some(dir) =
        keys_dir("keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped")
    else {
        return;
    };
    let core = Core::new();
    let h = open(&core);
    let (zkey, wasm) = paths(&dir, Circuit::Deposit);
    let zkey = keyfiles::load(&zkey, &keyfiles::DEPOSIT.zkey).unwrap();
    let wasm = keyfiles::load(&wasm, &keyfiles::DEPOSIT.wasm).unwrap();
    // Positive control: the completed witness proves, and the wasm memory was wiped after it.
    probe::take();
    let good = complete(&core, h, "deposit", &wit(&deposit_sc()), None).unwrap();
    run(&good, &zkey, &wasm).unwrap();
    let (before, after) = probe::take().expect("the calculator was dropped");
    assert!(before > 0, "the memory held the witness");
    assert_eq!(after, 0, "the memory is zero after the drop");
    // A witness the circuit rejects: a commitment that is not the note's.
    for (name, value) in [
        ("commitment", Fr::from(12345u64)),
        ("d", Fr::from(7u64)),
        ("nk", Fr::from(7u64)),
    ] {
        let mut bad = complete(&core, h, "deposit", &wit(&deposit_sc()), None).unwrap();
        bad.set_for_test(name, vec![value]);
        assert_eq!(
            run(&bad, &zkey, &wasm).unwrap_err(),
            A0Error::WitnessRejected,
            "{name}"
        );
        let (_, after) = probe::take().expect("dropped on the error path too");
        assert_eq!(after, 0);
    }
}
```

- [ ] **Step 4: Run the tests — red, for the right reason.**

```bash
cd native/noctura-prover && cargo test --locked 2>&1 | grep -E "^error|could not compile" | sort | uniq -c
```

Expected:

```
      1 error: could not compile `noctura-prover` (lib) due to 2 previous errors
      1 error: could not compile `noctura-prover` (lib test) due to 48 previous errors
      1 error: couldn't read `src/a0/keyfiles.rs`: No such file or directory (os error 2)
      1 error[E0432]: unresolved import `crate::witness_wasmi::probe`
      1 error[E0583]: file not found for module `keyfiles`
      1 error[E0583]: file not found for module `prove`
      1 error[E0599]: no function or associated item named `from_bytes` found for struct `witness_wasmi::WitnessCalculator` in the current scope
      1 error[E0599]: no method named `complete` found for reference `&Core` in the current scope
      2 error[E0599]: no method named `complete` found for struct `Core` in the current scope
      3 error[E0599]: no method named `prove_at` found for struct `Core` in the current scope
      8 error[E0599]: no method named `prove` found for struct `Core` in the current scope
      7 error[E0599]: no variant named `KeyFilePin` found for enum `A0Error`
      1 error[E0599]: no variant named `KeyFileRead` found for enum `A0Error`
      1 error[E0599]: no variant named `WitnessDuplicate` found for enum `A0Error`
      1 error[E0599]: no variant named `WitnessMissing` found for enum `A0Error`
      1 error[E0599]: no variant named `WitnessRustFilled` found for enum `A0Error`
      8 error[E0599]: no variant named `WitnessValue` found for enum `A0Error`
      1 error[E0599]: no variant or associated item named `AuthRecordInconsistent` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `AuthUnexpected` found for enum `A0Error` in the current scope
      2 error[E0599]: no variant or associated item named `CircuitNotInM1` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `CircuitUnknown` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `WithdrawExceedsInput` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `WitnessJson` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `WitnessNotInTree` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `WitnessRejected` found for enum `A0Error` in the current scope
      1 error[E0599]: no variant or associated item named `WitnessUnknownKey` found for enum `A0Error` in the current scope
```

Every error is a module this task creates or an item it adds (`state.rs`'s variants and `discard_auth`, the `witness_wasmi` additions); the fixtures, the crates and Tasks 1–2's code resolve.

- [ ] **Step 5: Implement.**

Create `native/noctura-prover/src/a0/keyfiles.rs`:

```rust
//! The A0 proving-key files, pinned in Rust by sha256 and length (spec §1 "A0 proving keys", R4):
//! JS supplies the paths, and native refuses any file whose bytes are not the published ones —
//! a pin living only in the layer being attacked would not be a control.
//!
//! The digests are the program side's published A0 set (`zkey-manifest.json`, circuitSetVersion
//! `devnet-a0-1`, `docs/zk-contract/ZKEY_ASSETS_A0.generated.ts`): single-party dev keys, devnet
//! only. CI downloads exactly these files by digest (`.github/workflows/native-prover.yml` reads
//! the `file:` / `sha256:` pairs below) — keep each `Pin` on the lines it is written on.
//!
//! A file is read ONCE into memory, its length and digest checked on those bytes, and only those
//! bytes are parsed: there is no second read a swapped file could slip into.

use super::state::A0Error;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;

/// One pinned file: its published name, its sha256 (lowercase hex) and its length in bytes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Pin {
    pub(crate) file: &'static str,
    pub(crate) sha256: &'static str,
    pub(crate) len: u64,
}

/// A circuit's two files.
#[derive(Clone, Copy, Debug)]
pub(crate) struct CircuitPins {
    pub(crate) zkey: Pin,
    pub(crate) wasm: Pin,
}

#[rustfmt::skip]
pub(crate) const DEPOSIT: CircuitPins = CircuitPins {
    zkey: Pin { file: "deposit_final.zkey", sha256: "fef08f0217a44c8c1629f5f8d670047461205c1fced83d7ea6fe763420e53fe9", len: 662_589 },
    wasm: Pin { file: "deposit.wasm", sha256: "1d69d7f89792a31d4c7780afa52b2f11707a4347f61382e7b294f4848d7dfff1", len: 2_528_384 },
};

#[rustfmt::skip]
pub(crate) const WITHDRAW_CHANGE: CircuitPins = CircuitPins {
    zkey: Pin { file: "withdraw_change_final.zkey", sha256: "ec55bdbbbfedb9823a57e5a3131c457a259fe8a690c087b82ad8b7efd3d756f2", len: 4_469_189 },
    wasm: Pin { file: "withdraw_change.wasm", sha256: "01b0ec1f28dec05e712b2fa0524c7b212409abf330b3380119d8e64d9845e0b9", len: 2_988_385 },
};

/// Reads `path` and returns its bytes only if they are exactly the pinned file: the length is
/// checked before reading (a huge file is never loaded), the read is bounded, and the digest is
/// taken over the bytes that are returned.
pub(crate) fn load(path: &Path, pin: &Pin) -> Result<Vec<u8>, A0Error> {
    let read_err = |_| A0Error::KeyFileRead { file: pin.file };
    let file = std::fs::File::open(path).map_err(read_err)?;
    let len = file.metadata().map_err(read_err)?.len();
    if len != pin.len {
        return Err(A0Error::KeyFilePin { file: pin.file });
    }
    let mut bytes = Vec::with_capacity(
        usize::try_from(pin.len).map_err(|_| A0Error::KeyFilePin { file: pin.file })?,
    );
    file.take(pin.len + 1)
        .read_to_end(&mut bytes)
        .map_err(read_err)?;
    if bytes.len() as u64 != pin.len || hex::encode(Sha256::digest(&bytes)) != pin.sha256 {
        return Err(A0Error::KeyFilePin { file: pin.file });
    }
    Ok(bytes)
}
```

Create `native/noctura-prover/src/a0/prove.rs`:

```rust
//! `prove(handle, circuit, witnessJson, authId?) -> {proofBytes, publicInputs}` (spec §3
//! "prove", R4, I11, m4, m-5, INV-AUTH).
//!
//! - **Allow-list, not deny-list.** Per circuit, JS may supply exactly the API names below; any
//!   other key — a signal Rust fills (`nk`, `d`, `change_d`, a public input), a typo — refuses,
//!   as does a missing or repeated key. Rust completes everything else from the session's keys
//!   and, for `withdraw_change`, from the authorization record.
//! - **`transfer` is not in M1**: it has no allow-list and is refused.
//! - **The authorization** (Task 2's record): every `prove` call consumes the live record FIRST —
//!   before the circuit name, the witness or the key files are looked at — so the first prove
//!   after an approval uses it up, success or failure. `withdraw_change` needs it (`authId`),
//!   `deposit` refuses one.
//! - **The key files** are read from the paths JS gives, each refused unless its bytes are the
//!   pinned ones (`keyfiles`).
//! - **The witness is never logged** and no error carries a value: refusals name a signal or an
//!   index, never what was in it.
//! - **The lock is held only while the witness is completed** (microseconds); the witness run,
//!   the proof and its self-check run outside it, so a `keysClose` from the UI thread never waits
//!   seconds for a proof. What leaves the lock is a copy of the completed witness, wiped on drop.
//! - **The proof is checked before it is returned**: the witness's public signals must equal the
//!   values Rust put in (in the circuit's order), and the proof must verify against the pinned
//!   zkey's own verifying key. Its randomness `r`, `s` comes from the OS.

use super::ata::derive_ata;
use super::auth::{self, Auth, AuthId};
use super::field::{
    be_mod_order, fr_from_be32, fr_to_be32, mint_hash, poseidon, rho_change, Fr, MINT,
};
use super::keyfiles::{self, CircuitPins};
use super::keys::Keys;
use super::state::{A0Error, Core, Handle};
use super::unshield::{parse_u64, POOL};
use crate::proof_bytes::serialize_proof;
use crate::witness_wasmi::WitnessCalculator;
use ark_bn254::Bn254;
use ark_circom::{read_zkey, CircomReduction};
use ark_groth16::Groth16;
use ark_snark::SNARK;
use serde::de::{Deserializer, MapAccess, Visitor};
use std::path::Path;
use std::time::Duration;
use zeroize::{Zeroize, Zeroizing};

/// The Merkle tree depth of the A0 pool (`MerkleTree` account, depth 20).
pub(crate) const DEPTH: usize = 20;

/// The circuits M1 proves.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Circuit {
    Deposit,
    WithdrawChange,
}

/// One input signal of a circuit's main component: its name and how many field elements it has.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Signal {
    pub(crate) name: &'static str,
    pub(crate) len: usize,
}

const fn one(name: &'static str) -> Signal {
    Signal { name, len: 1 }
}

/// A circuit's input signals in the circuit's own order (spec §1), and the JS allow-list.
#[derive(Debug)]
pub(crate) struct Table {
    /// Public inputs, in the order of the on-chain public-input vector.
    pub(crate) public: &'static [Signal],
    /// Private inputs, in declaration order.
    pub(crate) private: &'static [Signal],
    /// JS's keys: (API name, the signal it determines). `depositIndex` determines `rho`.
    pub(crate) js: &'static [(&'static str, &'static str)],
    /// The signals Rust fills from the keys, the authorization and the pinned mint — the other
    /// half of the m-5 partition, which the tests hold against the table and the circuit (at run
    /// time `run` checks every completed signal against the circuit instead).
    #[cfg(test)]
    pub(crate) rust: &'static [&'static str],
}

pub(crate) const DEPOSIT_TABLE: Table = Table {
    public: &[
        one("commitment"),
        one("amount"),
        one("mintHash"),
        one("rho"),
    ],
    private: &[one("nk"), one("d")],
    js: &[("amount", "amount"), ("depositIndex", "rho")],
    #[cfg(test)]
    rust: &["commitment", "mintHash", "nk", "d"],
};

pub(crate) const WITHDRAW_CHANGE_TABLE: Table = Table {
    public: &[
        one("merkleRoot"),
        one("nullifier"),
        one("withdrawAmount"),
        one("recipientField"),
        one("mintHash"),
        one("changeCommitment"),
        one("fee"),
    ],
    private: &[
        one("nk"),
        one("d"),
        one("inputAmount"),
        one("rho"),
        Signal {
            name: "pathElements",
            len: DEPTH,
        },
        Signal {
            name: "pathIndices",
            len: DEPTH,
        },
        one("change_d"),
    ],
    js: &[
        ("merkleRoot", "merkleRoot"),
        ("inputAmount", "inputAmount"),
        ("rho", "rho"),
        ("pathElements", "pathElements"),
        ("pathIndices", "pathIndices"),
    ],
    #[cfg(test)]
    rust: &[
        "nullifier",
        "withdrawAmount",
        "recipientField",
        "mintHash",
        "changeCommitment",
        "fee",
        "nk",
        "d",
        "change_d",
    ],
};

impl Circuit {
    /// `"deposit"` / `"withdraw_change"`; `"transfer"` is M2's (refused); anything else unknown.
    pub(crate) fn parse(name: &str) -> Result<Circuit, A0Error> {
        match name {
            "deposit" => Ok(Circuit::Deposit),
            "withdraw_change" => Ok(Circuit::WithdrawChange),
            "transfer" => Err(A0Error::CircuitNotInM1),
            _ => Err(A0Error::CircuitUnknown),
        }
    }
    pub(crate) fn table(self) -> &'static Table {
        match self {
            Circuit::Deposit => &DEPOSIT_TABLE,
            Circuit::WithdrawChange => &WITHDRAW_CHANGE_TABLE,
        }
    }
    pub(crate) fn pins(self) -> &'static CircuitPins {
        match self {
            Circuit::Deposit => &keyfiles::DEPOSIT,
            Circuit::WithdrawChange => &keyfiles::WITHDRAW_CHANGE,
        }
    }
}

impl Table {
    /// Every input signal, public first, in the circuit's order.
    pub(crate) fn signals(&self) -> impl Iterator<Item = &'static Signal> {
        self.public.iter().chain(self.private.iter())
    }
    fn signal(&self, name: &str) -> Option<&'static Signal> {
        self.signals().find(|s| s.name == name)
    }
}

/// A proof and its public inputs: what `prove` returns. Both are public by construction (the
/// chain sees them).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Proof {
    /// The 256-byte on-chain layout (`proof_bytes::serialize_proof`).
    pub proof_bytes: [u8; 256],
    /// The public inputs in the circuit's order, each 32 bytes big-endian.
    pub public_inputs: Vec<[u8; 32]>,
}

/// The completed witness: every input signal's values, in the table's order. Holds `nk` and
/// `d_self`; wiped on drop.
pub(crate) struct Completed {
    circuit: Circuit,
    values: Vec<(&'static str, Vec<Fr>)>,
}

impl Drop for Completed {
    fn drop(&mut self) {
        for (_, v) in &mut self.values {
            v.zeroize();
        }
    }
}

impl Completed {
    /// The public inputs Rust put in, in the circuit's order.
    fn publics(&self) -> Vec<Fr> {
        let table = self.circuit.table();
        self.values[..table.public.len()]
            .iter()
            .flat_map(|(_, v)| v.iter().copied())
            .collect()
    }
    /// Test-only: the signal names, in order.
    #[cfg(test)]
    pub(crate) fn names(&self) -> Vec<&'static str> {
        self.values.iter().map(|(n, _)| *n).collect()
    }
    /// Test-only: the public inputs as 32-byte BE.
    #[cfg(test)]
    pub(crate) fn publics_be32(&self) -> Vec<[u8; 32]> {
        self.publics().iter().map(fr_to_be32).collect()
    }
    /// Test-only: replace one signal's values (a witness the circuit must reject).
    #[cfg(test)]
    pub(crate) fn set_for_test(&mut self, name: &str, values: Vec<Fr>) {
        let slot = self.values.iter_mut().find(|(n, _)| *n == name).unwrap();
        slot.1 = values;
    }
}

// ---- the JS witness: a JSON object, every key once, nothing outside the allow-list ----------

/// The object's entries in order, repeats kept (serde_json's `Map` would keep only the last).
struct Entries(Vec<(String, serde_json::Value)>);

struct EntriesVisitor;

impl<'de> Visitor<'de> for EntriesVisitor {
    type Value = Entries;
    fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("a JSON object")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Entries, A::Error> {
        let mut out = Vec::new();
        while let Some(entry) = map.next_entry::<String, serde_json::Value>()? {
            out.push(entry);
        }
        Ok(Entries(out))
    }
}

/// The allow-listed values JS gave, by API name.
struct JsWitness {
    entries: Vec<(&'static str, serde_json::Value)>,
}

impl JsWitness {
    fn parse(json: &str, table: &'static Table) -> Result<JsWitness, A0Error> {
        let mut de = serde_json::Deserializer::from_str(json);
        let Entries(raw) = de
            .deserialize_map(EntriesVisitor)
            .map_err(|_| A0Error::WitnessJson)?;
        de.end().map_err(|_| A0Error::WitnessJson)?;
        let mut entries: Vec<(&'static str, serde_json::Value)> = Vec::with_capacity(raw.len());
        for (key, value) in raw {
            let Some(&(api, _)) = table.js.iter().find(|(api, _)| *api == key) else {
                return Err(match table.signal(&key) {
                    Some(s) => A0Error::WitnessRustFilled { name: s.name },
                    None => A0Error::WitnessUnknownKey,
                });
            };
            if entries.iter().any(|(k, _)| *k == api) {
                return Err(A0Error::WitnessDuplicate { name: api });
            }
            entries.push((api, value));
        }
        if let Some(&(missing, _)) = table
            .js
            .iter()
            .find(|(api, _)| !entries.iter().any(|(k, _)| k == api))
        {
            return Err(A0Error::WitnessMissing { name: missing });
        }
        Ok(JsWitness { entries })
    }

    fn get(&self, name: &'static str) -> &serde_json::Value {
        &self
            .entries
            .iter()
            .find(|(k, _)| *k == name)
            .expect("parse() checked every allow-listed key is present")
            .1
    }

    /// A canonical decimal u64 string.
    fn u64(&self, name: &'static str) -> Result<u64, A0Error> {
        match self.get(name) {
            serde_json::Value::String(s) => {
                parse_u64(s, name).map_err(|_| A0Error::WitnessValue { name, index: 0 })
            }
            _ => Err(A0Error::WitnessValue { name, index: 0 }),
        }
    }

    /// A field element: exactly 64 lowercase hex characters, canonical (< r), never reduced.
    fn field_at(v: &serde_json::Value, name: &'static str, index: usize) -> Result<Fr, A0Error> {
        let bad = A0Error::WitnessValue { name, index };
        let serde_json::Value::String(s) = v else {
            return Err(bad);
        };
        if s.len() != 64
            || !s
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(bad);
        }
        let mut bytes = Zeroizing::new([0u8; 32]);
        hex::decode_to_slice(s, &mut bytes[..])
            .map_err(|_| A0Error::WitnessValue { name, index })?;
        fr_from_be32(&bytes).ok_or(A0Error::WitnessValue { name, index })
    }

    fn field(&self, name: &'static str) -> Result<Fr, A0Error> {
        Self::field_at(self.get(name), name, 0)
    }

    fn array(&self, name: &'static str) -> Result<&[serde_json::Value], A0Error> {
        match self.get(name) {
            serde_json::Value::Array(a) if a.len() == DEPTH => Ok(a),
            _ => Err(A0Error::WitnessValue { name, index: DEPTH }),
        }
    }

    fn path_elements(&self) -> Result<Vec<Fr>, A0Error> {
        let name = "pathElements";
        self.array(name)?
            .iter()
            .enumerate()
            .map(|(i, v)| Self::field_at(v, name, i))
            .collect()
    }

    /// Each index a JSON integer 0 or 1.
    fn path_indices(&self) -> Result<Vec<bool>, A0Error> {
        let name = "pathIndices";
        self.array(name)?
            .iter()
            .enumerate()
            .map(|(i, v)| match v.as_u64() {
                Some(0) if v.is_u64() => Ok(false),
                Some(1) if v.is_u64() => Ok(true),
                _ => Err(A0Error::WitnessValue { name, index: i }),
            })
            .collect()
    }
}

// ---- witness completion ------------------------------------------------------------------

fn complete_deposit(keys: &Keys, js: &JsWitness) -> Result<Completed, A0Error> {
    let amount = js.u64("amount")?;
    let index = js.u64("depositIndex")?;
    if amount == 0 {
        return Err(A0Error::AmountZero);
    }
    let rho = keys.deposit_rho(index);
    let commitment = keys.commitment(amount, &rho);
    Ok(Completed {
        circuit: Circuit::Deposit,
        values: vec![
            ("commitment", vec![commitment]),
            ("amount", vec![Fr::from(amount)]),
            ("mintHash", vec![mint_hash()]),
            ("rho", vec![rho]),
            ("nk", vec![*keys.nk()]),
            ("d", vec![*keys.d_self()]),
        ],
    })
}

/// The root the path folds the leaf to: the circuit's `MerkleFold` (untagged Poseidon2; index 0
/// = the running value on the left).
fn fold(leaf: Fr, elements: &[Fr], indices: &[bool]) -> Fr {
    elements.iter().zip(indices).fold(leaf, |cur, (e, right)| {
        if *right {
            poseidon(&[*e, cur])
        } else {
            poseidon(&[cur, *e])
        }
    })
}

fn complete_withdraw_change(
    keys: &Keys,
    auth: &Auth,
    js: &JsWitness,
) -> Result<Completed, A0Error> {
    // The record is Rust's own (Task 2); it is re-checked against the pins it was made under.
    if auth.pool != POOL || auth.mint != MINT || derive_ata(&auth.owner) != Ok(auth.ata) {
        return Err(A0Error::AuthRecordInconsistent);
    }
    let merkle_root = js.field("merkleRoot")?;
    let input_amount = js.u64("inputAmount")?;
    let rho = js.field("rho")?;
    let path_elements = js.path_elements()?;
    let path_indices = js.path_indices()?;
    let spent = auth
        .amount
        .checked_add(auth.fee)
        .filter(|s| *s <= input_amount)
        .ok_or(A0Error::WithdrawExceedsInput)?;
    // The note must be in the tree JS named: checked here so a wrong path is a clear refusal
    // before any key file is read (the circuit checks it again).
    let leaf = keys.commitment(input_amount, &rho);
    if fold(leaf, &path_elements, &path_indices) != merkle_root {
        return Err(A0Error::WitnessNotInTree);
    }
    let nullifier = keys.nullifier(&rho);
    let change_rho = rho_change(&nullifier);
    let change_commitment = keys.commitment(input_amount - spent, &change_rho);
    Ok(Completed {
        circuit: Circuit::WithdrawChange,
        values: vec![
            ("merkleRoot", vec![merkle_root]),
            ("nullifier", vec![nullifier]),
            ("withdrawAmount", vec![Fr::from(auth.amount)]),
            ("recipientField", vec![be_mod_order::<Fr>(&auth.ata)]),
            ("mintHash", vec![mint_hash()]),
            ("changeCommitment", vec![change_commitment]),
            ("fee", vec![Fr::from(auth.fee)]),
            ("nk", vec![*keys.nk()]),
            ("d", vec![*keys.d_self()]),
            ("inputAmount", vec![Fr::from(input_amount)]),
            ("rho", vec![rho]),
            ("pathElements", path_elements),
            (
                "pathIndices",
                path_indices
                    .iter()
                    .map(|b| Fr::from(u64::from(*b)))
                    .collect(),
            ),
            ("change_d", vec![*keys.d_self()]),
        ],
    })
}

// ---- proving -----------------------------------------------------------------------------

/// A field element from 64 bytes of the OS random source (bias below 2^-250).
fn random_fr() -> Result<Fr, A0Error> {
    let mut b = Zeroizing::new([0u8; 64]);
    getrandom::getrandom(&mut b[..]).map_err(|_| A0Error::Rng)?;
    Ok(be_mod_order(&b[..]))
}

/// The witness run, the proof and its checks — outside the lock, on the pinned files' bytes.
pub(crate) fn run(completed: &Completed, zkey: &[u8], wasm: &[u8]) -> Result<Proof, A0Error> {
    let circuit = completed.circuit;
    let pins = circuit.pins();
    let table = circuit.table();
    let (params, matrices) =
        read_zkey(&mut std::io::Cursor::new(zkey)).map_err(|_| A0Error::KeyFileFormat {
            file: pins.zkey.file,
        })?;
    let n_public: usize = table.public.iter().map(|s| s.len).sum();
    if matrices.num_instance_variables != n_public + 1 {
        return Err(A0Error::CircuitShape);
    }

    let mut wc = WitnessCalculator::from_bytes(wasm).map_err(|_| A0Error::KeyFileFormat {
        file: pins.wasm.file,
    })?;
    for (name, values) in &completed.values {
        if wc
            .input_signal_size(name)
            .map_err(|_| A0Error::CircuitShape)?
            != Some(values.len())
        {
            return Err(A0Error::CircuitShape);
        }
    }
    let inputs: Vec<(&str, &[Fr])> = completed
        .values
        .iter()
        .map(|(n, v)| (*n, v.as_slice()))
        .collect();
    let witness = wc
        .calculate_witness_from_fr(&inputs)
        .map_err(|_| A0Error::WitnessRejected)?;
    drop(wc); // wipes the wasm memory
              // One value per wire: the zkey's A query has one point per wire (nVars). Not
              // `num_instance_variables + num_witness_variables`: ark-circom's `read_zkey` sets the latter
              // to nVars − nPublic, one more than the private wires (deposit: 5 + 641 = 646, nVars 645).
    if witness.len() != params.a_query.len() {
        return Err(A0Error::CircuitShape);
    }
    let publics = completed.publics();
    if witness[1..=n_public] != publics[..] {
        return Err(A0Error::PublicInputMismatch);
    }

    let mut r = random_fr()?;
    let mut s = random_fr()?;
    let proof = Groth16::<Bn254, CircomReduction>::create_proof_with_reduction_and_matrices(
        &params,
        r,
        s,
        &matrices,
        matrices.num_instance_variables,
        matrices.num_constraints,
        witness.as_slice(),
    );
    r.zeroize();
    s.zeroize();
    let proof = proof.map_err(|_| A0Error::ProofFailed)?;
    let pvk = Groth16::<Bn254>::process_vk(&params.vk).map_err(|_| A0Error::ProofFailed)?;
    if !Groth16::<Bn254>::verify_with_processed_vk(&pvk, &publics, &proof).unwrap_or(false) {
        return Err(A0Error::ProofDoesNotVerify);
    }
    Ok(Proof {
        proof_bytes: serialize_proof(&proof),
        public_inputs: publics.iter().map(fr_to_be32).collect(),
    })
}

impl Core {
    /// `prove(handle, circuit, witnessJson, authId?)` with the key files at `zkey_path` /
    /// `wasm_path` (spec §3). See the module documentation for the rules.
    pub fn prove(
        &self,
        handle: Handle,
        circuit: &str,
        witness_json: &str,
        auth_id: Option<AuthId>,
        zkey_path: &Path,
        wasm_path: &Path,
    ) -> Result<Proof, A0Error> {
        let now = auth::now()?;
        self.prove_at(
            handle,
            circuit,
            witness_json,
            auth_id,
            zkey_path,
            wasm_path,
            now,
        )
    }

    /// [`Core::prove`] at an injected time (tests; `now` is on the `auth::now` clock).
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn prove_at(
        &self,
        handle: Handle,
        circuit: &str,
        witness_json: &str,
        auth_id: Option<AuthId>,
        zkey_path: &Path,
        wasm_path: &Path,
        now: Duration,
    ) -> Result<Proof, A0Error> {
        let completed = self.complete(handle, circuit, witness_json, auth_id, now)?;
        let pins = completed.circuit.pins();
        let zkey = keyfiles::load(zkey_path, &pins.zkey)?;
        let wasm = keyfiles::load(wasm_path, &pins.wasm)?;
        run(&completed, &zkey, &wasm)
    }

    /// Everything `prove` does under the lock: consume the live authorization FIRST, then check
    /// the handle, the circuit and the JS witness, and complete it.
    pub(crate) fn complete(
        &self,
        handle: Handle,
        circuit: &str,
        witness_json: &str,
        auth_id: Option<AuthId>,
        now: Duration,
    ) -> Result<Completed, A0Error> {
        let mut inner = self.lock()?;
        let auth = match auth_id {
            Some(id) => Some(inner.take_auth(handle, &id, now)),
            None => {
                inner.discard_auth();
                None
            }
        };
        let keys = inner.keys_for(handle)?;
        let circuit = Circuit::parse(circuit)?;
        let js = JsWitness::parse(witness_json, circuit.table())?;
        match circuit {
            Circuit::Deposit => match auth {
                Some(_) => Err(A0Error::AuthUnexpected),
                None => complete_deposit(keys, &js),
            },
            Circuit::WithdrawChange => {
                let auth = auth.ok_or(A0Error::AuthAbsent)??;
                complete_withdraw_change(keys, &auth, &js)
            }
        }
    }
}
```

Apply to `native/noctura-prover/src/a0/state.rs`:

```diff
diff --git a/native/noctura-prover/src/a0/state.rs b/native/noctura-prover/src/a0/state.rs
index 76a0e2b..ac5bbde 100644
--- a/native/noctura-prover/src/a0/state.rs
+++ b/native/noctura-prover/src/a0/state.rs
@@ -102,6 +102,46 @@ pub enum A0Error {
     Rng,
     /// The boot clock could not be read.
     Clock,
+    /// `prove`: a circuit name M1 does not know.
+    CircuitUnknown,
+    /// `prove`: `transfer` is M2's; M1 has no allow-list for it.
+    CircuitNotInM1,
+    /// `prove`: an `authId` given to a deposit (the live authorization is used up).
+    AuthUnexpected,
+    /// `prove`: the authorization record disagrees with the pins it was made under.
+    AuthRecordInconsistent,
+    /// `prove`: the witness is not one JSON object.
+    WitnessJson,
+    /// `prove`: a witness key that is a signal Rust fills.
+    WitnessRustFilled { name: &'static str },
+    /// `prove`: a witness key that is neither allow-listed nor a signal.
+    WitnessUnknownKey,
+    /// `prove`: an allow-listed witness key given twice.
+    WitnessDuplicate { name: &'static str },
+    /// `prove`: an allow-listed witness key missing.
+    WitnessMissing { name: &'static str },
+    /// `prove`: a witness value of the wrong form (`index` = the array position; 20 = the array).
+    WitnessValue { name: &'static str, index: usize },
+    /// `prove`: the Merkle path does not lead from the note to `merkleRoot`.
+    WitnessNotInTree,
+    /// `prove`: `withdrawAmount + fee` exceeds the note's `inputAmount`.
+    WithdrawExceedsInput,
+    /// `prove`: a key file could not be read.
+    KeyFileRead { file: &'static str },
+    /// `prove`: a key file is not the pinned one (length or sha256).
+    KeyFilePin { file: &'static str },
+    /// `prove`: a pinned key file did not parse (never expected).
+    KeyFileFormat { file: &'static str },
+    /// `prove`: the key files do not have the circuit's inputs or public-input count.
+    CircuitShape,
+    /// `prove`: the circuit rejected the witness.
+    WitnessRejected,
+    /// `prove`: the witness's public signals are not the values Rust put in.
+    PublicInputMismatch,
+    /// `prove`: the prover failed.
+    ProofFailed,
+    /// `prove`: the proof does not verify against the pinned key's verifying key.
+    ProofDoesNotVerify,
 }
 
 impl fmt::Display for A0Error {
@@ -147,6 +187,45 @@ impl fmt::Display for A0Error {
             A0Error::AuthExpired => write!(f, "unshield authorization expired"),
             A0Error::Rng => write!(f, "the OS random source failed"),
             A0Error::Clock => write!(f, "the boot clock could not be read"),
+            A0Error::CircuitUnknown => write!(f, "unknown circuit"),
+            A0Error::CircuitNotInM1 => write!(f, "transfer is not available in this version"),
+            A0Error::AuthUnexpected => write!(f, "a deposit takes no unshield authorization"),
+            A0Error::AuthRecordInconsistent => {
+                write!(f, "unshield authorization record is inconsistent")
+            }
+            A0Error::WitnessJson => write!(f, "witness is not a JSON object"),
+            A0Error::WitnessRustFilled { name } => {
+                write!(
+                    f,
+                    "witness key {name} is filled natively, not by the caller"
+                )
+            }
+            A0Error::WitnessUnknownKey => write!(f, "witness has a key outside the allow-list"),
+            A0Error::WitnessDuplicate { name } => write!(f, "witness key {name} is repeated"),
+            A0Error::WitnessMissing { name } => write!(f, "witness key {name} is missing"),
+            A0Error::WitnessValue { name, index } => {
+                write!(f, "witness value {name}[{index}] is malformed")
+            }
+            A0Error::WitnessNotInTree => {
+                write!(f, "the Merkle path does not lead from the note to the root")
+            }
+            A0Error::WithdrawExceedsInput => {
+                write!(f, "amount + fee exceeds the note being spent")
+            }
+            A0Error::KeyFileRead { file } => write!(f, "proving key file {file} could not be read"),
+            A0Error::KeyFilePin { file } => {
+                write!(f, "proving key file {file} is not the pinned file")
+            }
+            A0Error::KeyFileFormat { file } => {
+                write!(f, "proving key file {file} did not parse")
+            }
+            A0Error::CircuitShape => write!(f, "the proving keys do not match the circuit"),
+            A0Error::WitnessRejected => write!(f, "the circuit rejected the witness"),
+            A0Error::PublicInputMismatch => {
+                write!(f, "the proof's public inputs are not the expected ones")
+            }
+            A0Error::ProofFailed => write!(f, "the prover failed"),
+            A0Error::ProofDoesNotVerify => write!(f, "the proof does not verify"),
         }
     }
 }
@@ -177,10 +256,6 @@ impl Inner {
     /// this call decides, the record cannot be used again. Refuses, in this order: `handle` not
     /// live (`UnknownHandle`); none live (`AuthAbsent`); another id (`AuthMismatch`); recorded
     /// under another handle (`AuthWrongHandle`); `now >= expires_at` (`AuthExpired`).
-    #[cfg_attr(
-        not(test),
-        expect(dead_code, reason = "consumed by Task 3's withdraw_change prove")
-    )]
     pub(crate) fn take_auth(
         &mut self,
         handle: Handle,
@@ -202,6 +277,12 @@ impl Inner {
         Ok(auth)
     }
 
+    /// Drops the live authorization, if any — what a `prove` without an `authId` does with it
+    /// (every prove consumes the record, whatever it then decides).
+    pub(crate) fn discard_auth(&mut self) {
+        self.auth = None;
+    }
+
     /// Test-only: plant a record as if `end_session` had failed to clear it.
     #[cfg(test)]
     pub(crate) fn plant_auth_for_test(&mut self, auth: Auth) {
```

Apply to `native/noctura-prover/src/a0/auth.rs`, `keys.rs`, `field.rs` (the `expect(dead_code)` attributes this task fulfils — clippy `-D warnings` would fail on an unfulfilled `expect`):

```diff
diff --git a/native/noctura-prover/src/a0/auth.rs b/native/noctura-prover/src/a0/auth.rs
index 2233e04..6531efd 100644
--- a/native/noctura-prover/src/a0/auth.rs
+++ b/native/noctura-prover/src/a0/auth.rs
@@ -46,10 +46,6 @@ impl std::fmt::Debug for AuthId {
 /// The record (spec §4 step 4): `{owner, ata, amount, fee, pool, mint, handle, expiresAt}`.
 /// Task 3's `prove` reads every field after `Inner::take_auth` hands it over.
 #[derive(Debug)]
-#[cfg_attr(
-    not(test),
-    expect(dead_code, reason = "consumed by Task 3's withdraw_change prove")
-)]
 pub(crate) struct Auth {
     pub(crate) id: AuthId,
     pub(crate) handle: Handle,
```

```diff
diff --git a/native/noctura-prover/src/a0/keys.rs b/native/noctura-prover/src/a0/keys.rs
index e76b540..fb33351 100644
--- a/native/noctura-prover/src/a0/keys.rs
+++ b/native/noctura-prover/src/a0/keys.rs
@@ -73,10 +73,6 @@ impl Keys {
     }
 
     /// `nk` — for the witness (Task 3); never leaves the crate.
-    #[cfg_attr(
-        not(test),
-        expect(dead_code, reason = "consumed by Task 3's witness completion")
-    )]
     pub(crate) fn nk(&self) -> &Fr {
         &self.nk
     }
@@ -88,10 +84,6 @@ impl Keys {
     }
 
     /// `d_self` — the private `d` / `change_d` of every own note (R9); for the witness (Task 3).
-    #[cfg_attr(
-        not(test),
-        expect(dead_code, reason = "consumed by Task 3's witness completion")
-    )]
     pub(crate) fn d_self(&self) -> &Fr {
         &self.d_self
     }
```

```diff
diff --git a/native/noctura-prover/src/a0/field.rs b/native/noctura-prover/src/a0/field.rs
index 09a9304..4116dc1 100644
--- a/native/noctura-prover/src/a0/field.rs
+++ b/native/noctura-prover/src/a0/field.rs
@@ -137,13 +137,6 @@ pub(crate) fn poseidon<const N: usize>(inputs: &[Fr; N]) -> Fr {
 
 /// `rho_change = Poseidon3(TAG_RHO, nullifier, 0)` — the change note's `rho` (§1, §3; the
 /// circuit's `RhoOut` with index 0). Key-free: the nullifier is its only input.
-#[cfg_attr(
-    not(test),
-    expect(
-        dead_code,
-        reason = "consumed by Task 3's withdraw_change witness completion"
-    )
-)]
 pub(crate) fn rho_change(nullifier: &Fr) -> Fr {
     poseidon(&[TAG_RHO, *nullifier, Fr::zero()])
 }
```

Apply to `native/noctura-prover/src/a0/unshield.rs`:

```diff
diff --git a/native/noctura-prover/src/a0/unshield.rs b/native/noctura-prover/src/a0/unshield.rs
index 831f761..6807d52 100644
--- a/native/noctura-prover/src/a0/unshield.rs
+++ b/native/noctura-prover/src/a0/unshield.rs
@@ -50,7 +50,7 @@ pub(crate) struct Parsed {
 }
 
 /// A decimal u64 in its one canonical spelling: `0`, or a non-zero digit then digits.
-fn parse_u64(s: &str, what: &'static str) -> Result<u64, A0Error> {
+pub(crate) fn parse_u64(s: &str, what: &'static str) -> Result<u64, A0Error> {
     let b = s.as_bytes();
     let canonical =
         !b.is_empty() && b.iter().all(u8::is_ascii_digit) && (b.len() == 1 || b[0] != b'0');
```

Apply to `native/noctura-prover/src/witness_wasmi.rs`:

```diff
diff --git a/native/noctura-prover/src/witness_wasmi.rs b/native/noctura-prover/src/witness_wasmi.rs
index 32da25b..66305e7 100644
--- a/native/noctura-prover/src/witness_wasmi.rs
+++ b/native/noctura-prover/src/witness_wasmi.rs
@@ -20,25 +20,52 @@ type Res<T> = Result<T, Box<dyn Error>>;
 /// Pure-Rust circom2 witness calculator over wasmi. Drives the downloaded circom
 /// `.wasm` through its exported functions (init / setInputSignal / getWitness over
 /// shared-RW-memory) — no wasmer, no C. Only circom2 wasm is supported.
+///
+/// The module's linear memory holds every signal of the last witness (for A0: `nk`, `d`, the
+/// note and its path), so it is zero-filled when the calculator is dropped.
 pub struct WitnessCalculator {
     store: Store<()>,
     instance: Instance,
+    memory: Memory,
     n32: u32,
 }
 
+/// What a circom2 wasm reports through `runtime.exceptionHandler` (codes 1–6 in circom's own
+/// `witness_calculator.js`: signal not found, too many signals, signal already set, assert
+/// failed, out of memory, input array index). It is a trap, never a no-op: a calculator that
+/// carried on after a failed `assert` / `===` would return a witness the circuit rejects.
+fn exception_trap(code: i32) -> wasmi::Error {
+    wasmi::Error::new(format!("circom witness exception {code}"))
+}
+
 impl WitnessCalculator {
     pub fn from_file(path: impl AsRef<std::path::Path>) -> Res<Self> {
-        let wasm = std::fs::read(path)?;
+        Self::from_bytes(&std::fs::read(path)?)
+    }
+
+    /// From the wasm's bytes — the A0 path, which hashes the bytes against a pin and must parse
+    /// exactly the bytes it hashed (no second read of the file).
+    pub fn from_bytes(wasm: &[u8]) -> Res<Self> {
         let engine = Engine::default();
-        let module = Module::new(&engine, &wasm[..])?;
+        let module = Module::new(&engine, wasm)?;
         let mut store = Store::new(&engine, ());
 
-        // circom wasm imports env.memory (it manages its own shared-RW buffer inside)
-        let memory = Memory::new(&mut store, MemoryType::new(2000, None))?;
+        // The deployed v1 circuits import env.memory; the A0 circuits export their own. Define
+        // one only when it is imported (2000 pages = 125 MiB of address space otherwise unused).
+        let imports_memory = module
+            .imports()
+            .any(|i| i.module() == "env" && i.name() == "memory");
+        let defined = if imports_memory {
+            Some(Memory::new(&mut store, MemoryType::new(2000, None))?)
+        } else {
+            None
+        };
         let mut linker = Linker::new(&engine);
-        linker.define("env", "memory", memory)?;
+        if let Some(memory) = defined {
+            linker.define("env", "memory", memory)?;
+        }
 
-        // runtime.* host callbacks — all no-ops except `error`, which traps.
+        // runtime.* host callbacks — no-ops except `error` and `exceptionHandler`, which trap.
         linker.func_wrap(
             "runtime",
             "error",
@@ -68,12 +95,22 @@ impl WitnessCalculator {
         linker.func_wrap("runtime", "logFinishComponent", |_: Caller<()>, _: i32| {})?;
         linker.func_wrap("runtime", "logStartComponent", |_: Caller<()>, _: i32| {})?;
         linker.func_wrap("runtime", "log", |_: Caller<()>, _: i32| {})?;
-        linker.func_wrap("runtime", "exceptionHandler", |_: Caller<()>, _: i32| {})?;
+        linker.func_wrap(
+            "runtime",
+            "exceptionHandler",
+            |_: Caller<()>, code: i32| -> Result<(), wasmi::Error> { Err(exception_trap(code)) },
+        )?;
         linker.func_wrap("runtime", "showSharedRWMemory", |_: Caller<()>| {})?;
         linker.func_wrap("runtime", "printErrorMessage", |_: Caller<()>| {})?;
         linker.func_wrap("runtime", "writeBufferMessage", |_: Caller<()>| {})?;
 
         let instance = linker.instantiate_and_start(&mut store, &module)?;
+        let memory = match defined {
+            Some(m) => m,
+            None => instance
+                .get_memory(&store, "memory")
+                .ok_or("wasm neither imports nor exports a memory")?,
+        };
 
         // Require circom2 (getVersion == 2). circom1 uses a different memory model.
         let version = instance
@@ -91,10 +128,91 @@ impl WitnessCalculator {
         Ok(Self {
             store,
             instance,
+            memory,
             n32,
         })
     }
 
+    /// The number of field elements of the main component's input `name` (its array length, 1
+    /// for a scalar), or `None` when the circuit has no such input — circom's
+    /// `getInputSignalSize`, which answers by the name's hash (0 when it has none).
+    pub fn input_signal_size(&mut self, name: &str) -> Res<Option<usize>> {
+        let f: TypedFunc<(i32, i32), i32> = self
+            .instance
+            .get_typed_func(&self.store, "getInputSignalSize")?;
+        let (msb, lsb) = fnv(name);
+        // circom answers 0 for a name it does not have (its JS treats < 0 as absent too).
+        let size = f.call(&mut self.store, (msb as i32, lsb as i32))?;
+        Ok(usize::try_from(size).ok().filter(|n| *n > 0))
+    }
+
+    /// The number of input field elements the circuit takes in all — circom's `getInputSize`.
+    pub fn input_size(&mut self) -> Res<usize> {
+        Ok(usize::try_from(
+            self.tf0("getInputSize")?.call(&mut self.store, ())?,
+        )?)
+    }
+
+    /// The witness for `inputs` (name → values), with no `BigInt` on the way in or out: the
+    /// values go to the wasm as 32-bit words cut from the field element's limbs, and come back
+    /// as canonical field elements. The returned buffer is wiped on drop; the wasm memory is
+    /// wiped when the calculator is dropped. Every input of the circuit must be given, once.
+    pub fn calculate_witness_from_fr(
+        &mut self,
+        inputs: &[(&str, &[Fr])],
+    ) -> Res<zeroize::Zeroizing<Vec<Fr>>> {
+        if self.n32 != 8 {
+            return Err("not a BN254 circuit (field words != 8)".into());
+        }
+        let init: TypedFunc<i32, ()> = self.instance.get_typed_func(&self.store, "init")?;
+        let write: TypedFunc<(i32, i32), ()> = self
+            .instance
+            .get_typed_func(&self.store, "writeSharedRWMemory")?;
+        let read: TypedFunc<i32, i32> = self
+            .instance
+            .get_typed_func(&self.store, "readSharedRWMemory")?;
+        let set_input: TypedFunc<(i32, i32, i32), ()> = self
+            .instance
+            .get_typed_func(&self.store, "setInputSignal")?;
+        let get_witness: TypedFunc<i32, ()> =
+            self.instance.get_typed_func(&self.store, "getWitness")?;
+
+        init.call(&mut self.store, 0)?;
+        let mut given = 0usize;
+        for (name, values) in inputs {
+            let (msb, lsb) = fnv(name);
+            for (i, value) in values.iter().enumerate() {
+                let mut limbs = value.into_bigint().0;
+                for j in 0..8 {
+                    // least-significant 32-bit word first
+                    let word = (limbs[j / 2] >> (32 * (j % 2))) as u32;
+                    write.call(&mut self.store, (j as i32, word as i32))?;
+                }
+                zeroize::Zeroize::zeroize(&mut limbs);
+                set_input.call(&mut self.store, (msb as i32, lsb as i32, i as i32))?;
+                given += 1;
+            }
+        }
+        if given != self.input_size()? {
+            return Err("not every circuit input was given".into());
+        }
+
+        let witness_size = self.tf0("getWitnessSize")?.call(&mut self.store, ())? as usize;
+        let mut out = zeroize::Zeroizing::new(Vec::with_capacity(witness_size));
+        for i in 0..witness_size {
+            get_witness.call(&mut self.store, i as i32)?;
+            let mut limbs = [0u64; 4];
+            for j in 0..8 {
+                let word = read.call(&mut self.store, j as i32)? as u32;
+                limbs[j / 2] |= u64::from(word) << (32 * (j % 2));
+            }
+            let v = Fr::from_bigint(ark_ff::BigInteger256::new(limbs));
+            zeroize::Zeroize::zeroize(&mut limbs);
+            out.push(v.ok_or("witness value is not a canonical field element")?);
+        }
+        Ok(out)
+    }
+
     fn tf0(&self, name: &str) -> Res<TypedFunc<(), i32>> {
         Ok(self.instance.get_typed_func(&self.store, name)?)
     }
@@ -143,6 +261,34 @@ impl WitnessCalculator {
     }
 }
 
+impl Drop for WitnessCalculator {
+    /// Zero-fills the wasm's linear memory: it holds every signal of the last witness.
+    fn drop(&mut self) {
+        let data = self.memory.data_mut(&mut self.store);
+        #[cfg(test)]
+        let before = data.iter().filter(|b| **b != 0).count();
+        data.fill(0);
+        #[cfg(test)]
+        probe::record(before, data.iter().filter(|b| **b != 0).count());
+    }
+}
+
+/// Test-only observation of the drop wipe: (non-zero bytes before, non-zero bytes after).
+#[cfg(test)]
+pub(crate) mod probe {
+    use std::cell::Cell;
+    thread_local! {
+        static LAST: Cell<Option<(usize, usize)>> = const { Cell::new(None) };
+    }
+    pub(crate) fn record(before: usize, after: usize) {
+        LAST.with(|l| l.set(Some((before, after))));
+    }
+    /// Takes this thread's last record.
+    pub(crate) fn take() -> Option<(usize, usize)> {
+        LAST.with(|l| l.take())
+    }
+}
+
 /// BigInt (possibly negative, from circom) → canonical ark-bn254 Fr. Verbatim logic
 /// from ark-circom's `calculate_witness_element`.
 fn bigint_to_fr(w: BigInt) -> Fr {
```

Two measured facts behind this diff: the A0 `.wasm` files import only `runtime.{exceptionHandler, printErrorMessage, writeBufferMessage, showSharedRWMemory}` and EXPORT their memory (`WebAssembly.Module.imports/exports` in Node), and circom's `getInputSignalSize` answers **0** (not a negative number) for a name the circuit lacks (`nk_`, `zzz`, and `merkleRoot` on deposit all gave `Some(0)` before the `> 0` filter). The old `exceptionHandler` was a no-op, so a failed `===` in the witness run would have produced a witness the circuit rejects, and a proof that does not verify (M-exception-noop below shows exactly that, caught by the new self-verify).

- [ ] **Step 6: Run the tests — green (without and with the key files); then the crate's whole gate.**

Without the key files (what every developer and every non-CI run sees):

```bash
cd native/noctura-prover && set -o pipefail
cargo test --locked 2>&1 | grep -E "Running|test result|A0-KEYS-SKIPPED|deposit_prove_to_bytes"
```

Expected (the seven `A0-KEYS-SKIPPED` lines are written past libtest's capture, so they show in a passing run; their order varies):

```
     Running unittests src/lib.rs (…/debug/deps/noctura_prover-…)
A0-KEYS-SKIPPED keyed_a_deposit_proof_verifies_against_the_deployed_vk_with_the_desk_values: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run
A0-KEYS-SKIPPED keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run
A0-KEYS-SKIPPED keyed_the_signal_tables_are_the_circuits_inputs_and_their_counts: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run
A0-KEYS-SKIPPED keyed_a_one_byte_changed_or_swapped_key_file_is_refused: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run
A0-KEYS-SKIPPED keyed_the_vk_fixtures_are_the_pinned_zkeys_own_verifying_keys: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run
A0-KEYS-SKIPPED keyed_two_proofs_of_one_witness_differ_and_both_verify: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run
A0-KEYS-SKIPPED keyed_withdraw_change_proofs_verify_against_the_deployed_vk: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run
test result: ok. 87 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.20s
     Running tests/prove_to_bytes.rs (…/debug/deps/prove_to_bytes-…)
test deposit_prove_to_bytes_matches_public_inputs ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.67s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

With the key files (locally the program side's `zk/keys/v2/`, which holds the four pinned files — Step 2's sources):

```bash
NOCTURA_A0_KEYS_DIR="$ICO/zk/keys/v2" cargo test --locked 2>&1 | tee /tmp/cargo-test.log | grep -E "Running|test result|A0-KEYS|deposit_prove_to_bytes"
CI=true cargo test --locked --lib a0::tests_prove::keyed_two 2>&1 | grep -E "panicked|test result" -A1
cargo fmt --check; echo fmt=$?
cargo clippy --all-targets --locked -- -D warnings 2>&1 | tail -1; echo clippy=$?
```

Expected:

```
     Running unittests src/lib.rs (…/debug/deps/noctura_prover-…)
test result: ok. 87 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 19.41s
     Running tests/prove_to_bytes.rs (…/debug/deps/prove_to_bytes-…)
test deposit_prove_to_bytes_matches_public_inputs ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.51s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
thread 'a0::tests_prove::keyed_two_proofs_of_one_witness_differ_and_both_verify' panicked at src/a0/tests_prove.rs:148:13:
keyed_two_proofs_of_one_witness_differ_and_both_verify: CI must provide NOCTURA_A0_KEYS_DIR (the A0 key files) — refusing to skip
--
test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 86 filtered out; finished in 0.00s
fmt=0
    Finished `dev` profile [unoptimized + debuginfo] target(s) in …
clippy=0
```

87 = 60 (Tasks 1–2 and the pre-existing 9) + 27. The `CI=true` run is the "CI cannot skip" control: without `NOCTURA_A0_KEYS_DIR`, a key-file test fails there. `clippy` clean also proves the five removed `expect(dead_code)` attributes are no longer needed in the non-test build. (The v1 integration test needs the v1 deposit artifacts in `artifacts/`, as in Task 1, Step 3.)

Then the repository's other gates (from the root):

```bash
npx tsc --noEmit; echo tsc=$?
node scripts/check-no-tge-date.mjs        # after `git add`
npx prettier --check scripts/a0-vectors/gen-prove-vectors.mjs
node --check scripts/a0-vectors/gen-prove-vectors.mjs; echo $?
node scripts/a0-vectors/gen-key-vectors.mjs --check
node scripts/a0-vectors/gen-ata-vectors.mjs --check
```

Expected: `tsc=0`; `no TGE date in 1432 tracked text files`; `All matched files use Prettier code style!`; `0`; `gen-key-vectors: native/noctura-prover/tests/fixtures/a0-key-vectors.json matches a fresh run (5 seeds, 4 EIP cases)`; `gen-ata-vectors: native/noctura-prover/tests/fixtures/a0-ata-vectors.json matches a fresh run (15 owners (7 ok), 12 bad strings, 16 amounts)`. No app source changed, so root `npx jest` is the unchanged baseline (Task 2: 1243 passed, 1 skipped); ESLint does not parse `.mjs` here (`import.meta`), as Task 1 records.

- [ ] **Step 7: The CI provisioning and the interop assertion.**

Apply to `.github/workflows/native-prover.yml`:

```diff
diff --git a/.github/workflows/native-prover.yml b/.github/workflows/native-prover.yml
index e8aa1a3..ea285d6 100644
--- a/.github/workflows/native-prover.yml
+++ b/.github/workflows/native-prover.yml
@@ -129,6 +129,57 @@ jobs:
             exit 1
           fi
 
+      # The A0 proving keys (spec 2026-11-08 shielded A0 M1 §1, R4): the four files
+      # `src/a0/keyfiles.rs` pins by sha256, fetched by THOSE digests from the content-addressed
+      # route (`/h/<sha256>/a0/<file>`) and re-hashed here. This is CI provisioning — the tests
+      # themselves never touch the network: they read NOCTURA_A0_KEYS_DIR and, with CI set, fail
+      # rather than skip when it is missing. Cached by name like the v1 artifacts; a cache hit is
+      # re-verified against the pin, not trusted on its key.
+      - name: Cache the pinned A0 key files
+        uses: actions/cache@v4
+        with:
+          path: |
+            native/noctura-prover/artifacts/a0/deposit_final.zkey
+            native/noctura-prover/artifacts/a0/deposit.wasm
+            native/noctura-prover/artifacts/a0/withdraw_change_final.zkey
+            native/noctura-prover/artifacts/a0/withdraw_change.wasm
+          key: zk-a0-keys-${{ hashFiles('native/noctura-prover/src/a0/keyfiles.rs') }}
+
+      - name: Fetch and verify the pinned A0 key files
+        working-directory: .
+        run: |
+          set -euo pipefail
+          mkdir -p native/noctura-prover/artifacts/a0
+          base=$(grep -E "^const BASE" src/constants/provingAssets.ts | sed -E "s/.*'([^']+)'.*/\1/")
+          # Pins look like:  zkey: Pin { file: "<name>", sha256: "<64 hex>", len: … },
+          pins=$(grep -oE 'file: "[^"]+", sha256: "[0-9a-f]{64}"' native/noctura-prover/src/a0/keyfiles.rs \
+                 | sed -E 's/file: "([^"]+)", sha256: "([0-9a-f]{64})"/\2 \1/')
+          [ -n "$pins" ] || { echo "::error::could not read the A0 pins from src/a0/keyfiles.rs — its format may have changed"; exit 1; }
+          handled=0
+          while read -r want file; do
+            dest="native/noctura-prover/artifacts/a0/$file"
+            if [ -f "$dest" ] && [ "$(sha256sum "$dest" | cut -d' ' -f1)" = "$want" ]; then
+              echo "$file served from cache and re-verified against the Rust pin: $want"
+              handled=$((handled + 1))
+              continue
+            fi
+            curl -fsSL --retry 3 --connect-timeout 15 --max-time 300 "$base/h/$want/a0/$file" -o "$dest" || {
+              echo "::error::could not download $file from $base — the asset host was unreachable or has no A0 file with digest $want. Fail-closed: the A0 prove tests do not run against files that could not be verified."
+              exit 1
+            }
+            got=$(sha256sum "$dest" | cut -d' ' -f1)
+            if [ "$got" != "$want" ]; then
+              echo "::error::$file SHA-256 mismatch — pinned $want, downloaded $got"
+              exit 1
+            fi
+            echo "$file downloaded and verified against the Rust pin: $want"
+            handled=$((handled + 1))
+          done <<< "$pins"
+          if [ "$handled" != "4" ]; then
+            echo "::error::expected 4 A0 key files, handled $handled — the pin parse matched the wrong number of lines"
+            exit 1
+          fi
+
       - name: Formatting
         run: cargo fmt --check
 
@@ -142,6 +193,8 @@ jobs:
       # what happened on this workflow's first run — the positive control below
       # was the only thing that caught it.
       - name: Test
+        env:
+          NOCTURA_A0_KEYS_DIR: ${{ github.workspace }}/native/noctura-prover/artifacts/a0
         run: |
           set -o pipefail
           cargo test --locked 2>&1 | tee /tmp/cargo-test.log
@@ -157,6 +210,20 @@ jobs:
           #!/usr/bin/env bash
           set -euo pipefail
           grep -q "test deposit_prove_to_bytes_matches_public_inputs \.\.\. ok" "$1"
+          # The A0 proofs (and the landed-proof layout check, which needs no key file) ran and passed.
+          for t in \
+            landed_withdraw_change_proofs_verify_under_our_layout_against_the_deployed_vk \
+            keyed_the_signal_tables_are_the_circuits_inputs_and_their_counts \
+            keyed_a_deposit_proof_verifies_against_the_deployed_vk_with_the_desk_values \
+            keyed_withdraw_change_proofs_verify_against_the_deployed_vk \
+            keyed_the_vk_fixtures_are_the_pinned_zkeys_own_verifying_keys \
+            keyed_a_one_byte_changed_or_swapped_key_file_is_refused \
+            keyed_two_proofs_of_one_witness_differ_and_both_verify \
+            keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped; do
+            grep -q "test a0::tests_prove::$t \.\.\. ok" "$1"
+          done
+          # A key-file test that returned early prints this marker; "ok" alone would hide it.
+          ! grep -q "A0-KEYS-SKIPPED" "$1"
           SH
           chmod +x /tmp/assert-interop.sh
 
@@ -183,3 +250,16 @@ jobs:
             exit 1
           fi
           echo "interop assertion is falsifiable"
+
+      # NEGATIVE CONTROL 2 — every test line present and "ok", but one A0 key-file test skipped:
+      # the assertion must still fail (a skipped test reports "ok").
+      - name: Assert the interop check fails on a skipped A0 key-file test
+        working-directory: .
+        run: |
+          grep -E "^test .* \.\.\. ok$" /tmp/cargo-test.log > /tmp/cargo-test-skipped.log
+          echo "A0-KEYS-SKIPPED keyed_withdraw_change_proofs_verify_against_the_deployed_vk: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run" >> /tmp/cargo-test-skipped.log
+          if /tmp/assert-interop.sh /tmp/cargo-test-skipped.log; then
+            echo "::error::the interop assertion PASSED on a log with a skipped A0 key-file test"
+            exit 1
+          fi
+          echo "a skipped A0 key-file test fails the interop assertion"
```

How the files reach CI, stated: exactly as the v1 artifacts do today — the workflow downloads them from the content-addressed route `https://api.noc-tura.io/api/v1/zk-assets/h/<sha256>/a0/<file>` (the URLs the program side's manifest publishes), by the digests it reads out of `src/a0/keyfiles.rs`, and re-hashes them. That is CI provisioning, not a test contacting the host: the tests read `NOCTURA_A0_KEYS_DIR` and never open a socket. The parse and the assertion, checked locally against the real logs of Step 6 (the assertion script extracted from the YAML as CI writes it):

```bash
grep -oE 'file: "[^"]+", sha256: "[0-9a-f]{64}"' native/noctura-prover/src/a0/keyfiles.rs | sed -E 's/file: "([^"]+)", sha256: "([0-9a-f]{64})"/\2 \1/'
/tmp/assert-interop.sh /tmp/cargo-test.log && echo POSITIVE=pass                      # the keyed log
/tmp/assert-interop.sh /tmp/cargo-test-empty.log || echo NEG1=fails-as-required       # "running 0 tests"
/tmp/assert-interop.sh /tmp/cargo-test-skipped.log || echo NEG2=fails-as-required     # every ok line + one skip marker
/tmp/assert-interop.sh /tmp/cargo-test-nokeys.log || echo NOKEYS=fails-as-required    # Step 6's run without keys, 2>&1 | tee
```

Expected:

```
fef08f0217a44c8c1629f5f8d670047461205c1fced83d7ea6fe763420e53fe9 deposit_final.zkey
1d69d7f89792a31d4c7780afa52b2f11707a4347f61382e7b294f4848d7dfff1 deposit.wasm
ec55bdbbbfedb9823a57e5a3131c457a259fe8a690c087b82ad8b7efd3d756f2 withdraw_change_final.zkey
01b0ec1f28dec05e712b2fa0524c7b212409abf330b3380119d8e64d9845e0b9 withdraw_change.wasm
POSITIVE=pass
NEG1=fails-as-required
NEG2=fails-as-required
NOKEYS=fails-as-required
```

**Not verified here:** that `api.noc-tura.io` serves the four files at those URLs (the writer does not contact *.noc-tura.io). The first CI run of the PR is that check; it fails closed (`::error::could not download …`) if the host does not.

- [ ] **Step 8: The arm64 build and its dynamic section.**

```bash
cd native/noctura-prover && cargo ndk -t arm64-v8a build --release --locked 2>&1 | tail -1
readelf -d "$CARGO_TARGET_DIR/aarch64-linux-android/release/libnoctura_prover.so" | grep -E "NEEDED|SONAME"
readelf -d "$CARGO_TARGET_DIR/aarch64-linux-android/release/libnoctura_prover.so" | grep -c "c++"
```

Expected:

```
    Finished `release` profile [optimized] target(s) in 31.54s
 0x0000000000000001 (NEEDED)             Shared library: [libdl.so]
 0x0000000000000001 (NEEDED)             Shared library: [libm.so]
 0x0000000000000001 (NEEDED)             Shared library: [libc.so]
0
```

No new package (serde was already built for serde_json). **Limit, as in Tasks 1–2:** nothing exported over JNI reaches `a0` yet, so the linker may have dropped it; Task 4 re-runs this check.

- [ ] **Step 9: Named mutations — each in a fresh copy, compiled first, each red.**

Each: `git archive HEAD native/noctura-prover src/modules/shielded/a0 | tar -x -C <dir>` (Task 1's tests read the app's golden file), apply the edit (an exact replacement; the driver asserts it occurs once), `cargo test --locked --lib --no-run` (all 24 compiled — none INVALID), then `cargo test --locked --lib a0::`, with `NOCTURA_A0_KEYS_DIR` set where the mutation needs the key files (marked K). Measured:

| mutation | edit | result | red tests |
|---|---|---|---|
| M-unknown-key-ignored | `src/a0/prove.rs`: `return Err(match table.signal(&key) { Some(s) => A0Error::WitnessRu…` → `let _ = table.signal(&key); continue;` | 74 passed; 4 failed | `a_prove_that_refuses_for_any_reason_still_uses_the_authorization_up`, `every_rust_filled_name_is_refused_even_with_a_well_formed_value`, `no_refusal_carries_a_witness_or_key_value`, `unknown_missing_repeated_and_non_object_witnesses_are_refused` |
| M-rust-filled-as-unknown | `src/a0/prove.rs`: `Some(s) => A0Error::WitnessRustFilled { name: s.name },` → `Some(_) => A0Error::WitnessUnknownKey,` | 77 passed; 1 failed | `every_rust_filled_name_is_refused_even_with_a_well_formed_value` |
| M-duplicate-kept | `src/a0/prove.rs`: `if entries.iter().any(|(k, _)| *k == api) { return Err(A0Error::Wit…` → (deleted) | 77 passed; 1 failed | `unknown_missing_repeated_and_non_object_witnesses_are_refused` |
| M-trailing-json-accepted | `src/a0/prove.rs`: `de.end().map_err(|_| A0Error::WitnessJson)?;` → (deleted) | 77 passed; 1 failed | `unknown_missing_repeated_and_non_object_witnesses_are_refused` |
| M-no-auth-keeps-record | `src/a0/prove.rs`: `inner.discard_auth();` → (deleted) | 76 passed; 2 failed | `a_deposit_refuses_an_authorization_and_uses_it_up`, `withdraw_change_needs_a_live_authorization_and_every_prove_consumes_it` |
| M-auth-taken-after-parse | `src/a0/prove.rs`: `let mut inner = self.lock()?; let auth = match auth_id {` → `let circuit_m = Circuit::parse(circuit)?; let _js_m = JsWitness::pa…` | 75 passed; 3 failed | `a_prove_that_refuses_for_any_reason_still_uses_the_authorization_up`, `every_rust_filled_name_is_refused_even_with_a_well_formed_value`, `no_refusal_carries_a_witness_or_key_value` |
| M-deposit-accepts-auth | `src/a0/prove.rs`: `Some(_) => Err(A0Error::AuthUnexpected),` → `Some(_) => complete_deposit(keys, &js),` | 75 passed; 3 failed | `a_deposit_refuses_an_authorization_and_uses_it_up`, `a_prove_that_refuses_for_any_reason_still_uses_the_authorization_up`, `no_refusal_carries_a_witness_or_key_value` |
| M-exceeds-strict | `src/a0/prove.rs`: `.filter(|s| *s <= input_amount)` → `.filter(|s| *s < input_amount)` | 76 passed; 2 failed | `amount_plus_fee_above_the_note_is_refused_and_equal_is_accepted`, `the_withdraw_change_public_inputs_take_amount_fee_and_destination_from_the_authorization` |
| M-exceeds-unchecked | `src/a0/prove.rs`: `.filter(|s| *s <= input_amount)` → `.filter(|_| true)` | 77 passed; 1 failed | `amount_plus_fee_above_the_note_is_refused_and_equal_is_accepted` |
| M-recipient-from-owner | `src/a0/prove.rs`: `be_mod_order::<Fr>(&auth.ata)` → `be_mod_order::<Fr>(&auth.owner)` | 77 passed; 1 failed | `the_withdraw_change_public_inputs_take_amount_fee_and_destination_from_the_authorization` |
| M-change-rho-is-input-rho | `src/a0/prove.rs`: `keys.commitment(input_amount - spent, &change_rho)` → `keys.commitment(input_amount - spent, &rho)` | 77 passed; 1 failed | `the_withdraw_change_public_inputs_take_amount_fee_and_destination_from_the_authorization` |
| M-change-amount-ignores-fee | `src/a0/prove.rs`: `keys.commitment(input_amount - spent, &change_rho)` → `keys.commitment(input_amount - auth.amount, &change_rho)` | 77 passed; 1 failed | `the_withdraw_change_public_inputs_take_amount_fee_and_destination_from_the_authorization` |
| M-tree-unchecked | `src/a0/prove.rs`: `return Err(A0Error::WitnessNotInTree);` → (deleted) | 76 passed; 2 failed | `a_note_not_in_the_named_tree_is_refused_before_any_key_file`, `no_refusal_carries_a_witness_or_key_value` |
| M-record-unchecked | `src/a0/prove.rs`: `return Err(A0Error::AuthRecordInconsistent);` → (deleted) | 77 passed; 1 failed | `an_inconsistent_authorization_record_is_refused` |
| M-field-reduced | `src/a0/prove.rs`: `fr_from_be32(&bytes).ok_or(A0Error::WitnessValue { name, index })` → `Ok(be_mod_order(&bytes[..]))` | 77 passed; 1 failed | `witness_values_must_have_their_one_canonical_form` |
| M-transfer-unknown | `src/a0/prove.rs`: `"transfer" => Err(A0Error::CircuitNotInM1),` → `"transfer" => Err(A0Error::CircuitUnknown),` | 77 passed; 1 failed | `transfer_is_refused_in_m1_and_unknown_circuits_are_refused` |
| M-change-d-dropped-from-table (K) | `src/a0/prove.rs`: `one("change_d"),` → (deleted) | 74 passed; 4 failed | `each_allow_list_and_its_rust_filled_names_partition_the_circuits_table`, `every_rust_filled_name_is_refused_even_with_a_well_formed_value`, `keyed_the_signal_tables_are_the_circuits_inputs_and_their_counts`, `the_completed_witness_has_exactly_the_tables_signals_in_order` |
| M-pin-digest-unchecked (K) | `src/a0/keyfiles.rs`: `bytes.len() as u64 != pin.len || hex::encode(Sha256::digest(&bytes)…` → `bytes.len() as u64 != pin.len` | 76 passed; 2 failed | `a_key_file_that_is_not_the_pinned_bytes_is_refused`, `keyed_a_one_byte_changed_or_swapped_key_file_is_refused` |
| M-pin-length-only-at-read | `src/a0/keyfiles.rs`: `if len != pin.len { return Err(A0Error::KeyFilePin { file: pin.file…` → `let _ = len;` | 78 passed; 0 failed | **none — survivor (below)** |
| M-fixed-randomness (K) | `src/a0/prove.rs`: `Ok(be_mod_order(&b[..]))` → `Ok(Fr::from(b.len() as u64))` | 77 passed; 1 failed | `keyed_two_proofs_of_one_witness_differ_and_both_verify` |
| M-exception-noop (K) | `src/witness_wasmi.rs`: `Err(exception_trap(code))` → `{ let _ = exception_trap(code); Ok(()) }` | 77 passed; 1 failed | `keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped` |
| M-wasm-memory-not-wiped (K) | `src/witness_wasmi.rs`: `data.fill(0);` → (deleted) | 77 passed; 1 failed | `keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped` |
| M-size-sentinel-dropped (K) | `src/witness_wasmi.rs`: `Ok(usize::try_from(size).ok().filter(|n| *n > 0))` → `Ok(usize::try_from(size).ok())` | 77 passed; 1 failed | `keyed_the_signal_tables_are_the_circuits_inputs_and_their_counts` |
| M-a-not-negated (K) | `src/proof_bytes.rs`: `g1_be(&proof.a, true)` → `g1_be(&proof.a, false)` | 74 passed; 4 failed | `keyed_a_deposit_proof_verifies_against_the_deployed_vk_with_the_desk_values`, `keyed_two_proofs_of_one_witness_differ_and_both_verify`, `keyed_withdraw_change_proofs_verify_against_the_deployed_vk`, `landed_withdraw_change_proofs_verify_under_our_layout_against_the_deployed_vk` |

M-exception-noop's red test fails with `left: ProofDoesNotVerify, right: WitnessRejected`: with the trap gone, circom's wasm carries on past the failed `===`, the witness proves, and the self-verify is what refuses it. **Survivor, stated:** M-pin-length-only-at-read (dropping the length check BEFORE the read) is equivalent in outcome — the bounded read and the post-read length check refuse the same files with the same error; what the pre-check buys (a wrong-size file is never loaded into memory) is a resource property no test here measures. **Not covered by a mutation:** `PublicInputMismatch` and `CircuitShape` (unreachable with the pinned files — defence in depth against a future pin change), `ProofFailed` / `Rng` / `KeyFileFormat` (failure paths no input reaches).


- [ ] **Step 10: Commit.**

```bash
git add .github/workflows/native-prover.yml native/noctura-prover/Cargo.toml native/noctura-prover/Cargo.lock \
  native/noctura-prover/src native/noctura-prover/tests/fixtures/a0-prove-vectors.json \
  native/noctura-prover/tests/fixtures/a0-vk scripts/a0-vectors/gen-prove-vectors.mjs
git status --short     # artifacts/ stays untracked (gitignored); nothing else
git commit -m "feat(shielded-a0): Rust prove — per-circuit allow-lists, witness completion, the authorization consumed by every prove, sha256-pinned A0 key files, self-verified proofs; the m-5 signal table, desktop proofs against the deployed VKs and the landed-proof layout check (M1a Task 3)"
```

Expected `git show --stat HEAD`: 17 files changed, 3316 insertions(+), 32 deletions(-).

#### Notes for the executor (Task 3)

- **The rulings this task took (each the most secure default; the owner may overturn any):**
  - **Every `prove` consumes the live authorization, first, whatever the circuit and whatever it then decides** — with an `authId`, through `take_auth` (its checks); without one, the record is dropped; a deposit given an `authId` refuses (`AuthUnexpected`); `transfer`, an unknown circuit, a malformed witness all use it up. The spec says "consumed by the first prove, success or failure"; the literal "first prove" (any prove after the approval) is the one with no gap. Cost if wrong: an honest flow never proves anything else between approval and its unshield (one handle per operation, and a second `keysOpen` clears the record anyway).
  - **The lock is held only for completion**; key-file reading (≈ 4.6 s to parse the withdraw_change zkey on this desktop), the witness run and the proof run outside it on a wiped copy. Holding it for seconds would block `keysClose` / `authorizeUnshield` on Android's UI thread (ANR at 5 s). The completed copy (`Completed`, holding `nk`, `d_self`) is zeroized on drop.
  - **The Merkle path is checked in Rust before any key file is read** (`WitnessNotInTree`): a clear refusal, cheap (20 Poseidon2), and a refusal reachable without the key files (so it runs in every test run); the circuit checks it again.
  - **The proof is self-verified against the pinned zkey's own VK, and the witness's public signals must equal Rust's**, before returning. Neither is reachable with the trapping `exceptionHandler` (stated, not hidden): M-exception-noop shows the self-verify catching what the trap no longer does.
  - **`r`, `s` come from the OS RNG** (64 bytes each → `be_mod_r`). The v1 `prove_to_bytes` uses `StdRng::seed_from_u64(0)` — the same, PUBLIC `r`, `s` for every proof, which breaks Groth16's zero-knowledge (anyone can subtract `r·δ` from `A`) and makes two proofs of one statement identical. A0 does not reuse it. **v1's `prover.rs` is left as it is** (removed in M1b with the v1 path; until then it is only reachable through the v1 JNI on the devnet build) — flagged for the reviewer.
  - **The witness JSON:** an object read entry by entry (a repeated key refuses; serde_json's `Map` would keep the last); amounts as canonical decimal strings (Kotlin/JS cannot carry a u64 above 2^53 / 2^63 as a number); field elements as 64 lowercase hex (the form `depositRho` / `commitment` / the tree sync / the relayer payload use), canonical, never reduced; `pathIndices` as JSON integers 0/1. **A deposit of 0 is refused** (`AmountZero`) — the circuit allows it; nothing the wallet does needs it.
  - **Errors name a signal and an index, never a value**; an unknown key is not echoed (`WitnessUnknownKey` has no field) — a "typo" key could be a value pasted into the wrong place. serde_json's messages are dropped entirely (they can quote input).
  - **The record is re-checked at prove** (`AuthRecordInconsistent`: pool, mint, and `ata == ATA(owner)`) — Task 2's record cannot be built otherwise, so this is defence in depth, tested by planting edited records (with the unedited copy as the positive control). It is also what reads `Auth.owner` / `pool` / `mint`, which the removed `expect(dead_code)` would otherwise leave unread.
  - **The key files: one read, length checked first** (a huge file is never loaded; the read is bounded), sha256 over the bytes that are then parsed — no second read for a swapped file to slip into. The pins live in Rust (R4) as `file:` / `sha256:` / `len:` on one line each; CI reads them from there (a test, `the_pins_are_where_ci_reads_them`, keeps the format greppable).
  - **The wasm's linear memory is wiped when the calculator drops** (it holds every signal: `nk`, `d`, `addrField`, the note), and `env.memory` is defined only for a module that imports it (the A0 wasm exports its own; the v1 one imports it — the unconditional 2000-page definition was 125 MiB of unused address space per prove for A0). The inputs go in as words cut from `Fr` limbs (no `BigInt`, which cannot be wiped), the witness comes out as `Zeroizing<Vec<Fr>>`. **Stated limits (not tested, cannot be from safe Rust):** arkworks' prover makes its own copies of the assignment (FFT buffers) and frees them unwiped; `serde_json::Value` strings of the JS witness (the note's `rho` and path — JS held them already); stack temporaries.
  - **Witness length is checked against the zkey's A query (nVars)**, not `num_instance_variables + num_witness_variables`: ark-circom's `read_zkey` sets `num_witness_variables = nVars − nPublic`, one too many (deposit: 5 + 641 = 646, nVars 645 = the r1cs header's wire count).
- **The key files for tests (the dispatch's question, decided):** `NOCTURA_A0_KEYS_DIR` names a directory with the four pinned files under their published names. Locally: the program side's `zk/keys/v2/` (`git ls-files` there lists them; their sha256s equal the pins and the manifest). In CI: the workflow fetches them by digest (Step 7) like the v1 artifacts and sets the variable. Absent → the seven key-file tests return early and write `A0-KEYS-SKIPPED <test>` to the process's stderr, past libtest's capture (loud in a green run); with `CI` set (GitHub always sets it) absence is a failure, not a skip; and the interop assertion requires each of the seven `… ok` lines AND the absence of the marker — "ok" alone cannot tell a skip from a run (NEG2 shows the assertion failing on exactly that). The 20 other tests, including the landed-proof layout check (the VKs are committed: 3–4 KB), run everywhere.
- **The signal table (m-5), as tested:** the Rust tables list each circuit's inputs in the circuit's order; *mapped(JS) ∪ Rust-filled = the table*, disjoint (no key file needed); and, with the key files, every table name has its size in the wasm's own input map (`getInputSignalSize`), the sizes sum to the wasm's `getInputSize` (so no input exists outside the table — sizes are ≥ 1, names distinct), `nPubInputs` = the zkey's `nPublic` and `nPrivInputs` = inputs − `nPublic`, and both equal the r1cs header's counts (deposit 4 / 2, withdraw_change 7 / 45 — read by the program side's own `zk/scripts/gen-signal-table.mjs`, run by the writer on a copy of their `zk/build/v2/*.{r1cs,sym}`, whose `*_final.zkey` / `*.wasm` are byte-identical to the pinned ones). The `.r1cs` itself is not used by the test: it is not published by digest (3.4 MB, not in the manifest), so CI could not get it; the zkey and wasm ARE the proving inputs, which is the stronger binding.
- **The VK "the chain holds" (spec §14), as done here:** the deployed VKs are the program side's committed `zk/keys/v2/*_vk.json` (the files their deploy wrote with `set_deposit_vk` / `set_withdraw_change_vk`), pinned by sha256 in the fixture; they are tied to the chain by the two LANDED withdraw_with_change proofs verifying against them, and to the pinned zkeys by `keyed_the_vk_fixtures_are_the_pinned_zkeys_own_verifying_keys`. Reading the VK accounts from devnet is a network read, so it is not a test: it belongs to the M1a checkpoint (Task 6), which reads the deposit VK from chain anyway.
- **m10, as done here:** the landed DEPOSIT `3DR6F7oW…`'s proof bytes are not in the program side's committed data (only its signature and public inputs are), and the dispatch rules out fetching. The check therefore uses the two landed **withdraw_with_change** proofs whose instruction bytes are committed (`2mfMYnbt…`, direct, fee 50,000; `3UfCx5TD…`, through the relayer, fee 10,000): parsed with `proof_bytes::parse_proof`, they verify against the deployed withdraw_change VK, `serialize(parse(x)) = x`, and four negative controls fail (A not un-negated, G2 c0-first, one public input changed, the deposit VK). The layout is the program's one verifier path, identical for every circuit.
- **Deviations from the brief / dispatch:** (1) m10 against landed withdraw_change proofs, not the landed deposit (above); (2) the VK from the committed `vk.json` rather than read from chain (above); (3) the counts from the zkey + wasm, reconciled once with the r1cs header (above); (4) the test profile is optimized (Step 1); (5) `serde` added as a direct dependency (already locked).
- **Found, outside this task (for the controller):** the v1 prover's fixed `r`, `s` (above); and a performance number for Task 6 / M1c: parsing the withdraw_change zkey takes 4.6 s on this desktop (release) before proving starts — on the phone expect a multiple; caching the parsed key per process (keyed by the verified digest) is a safe later optimization, not done here.
- **The program side moved during the dry run:** their `5fa2379` ("golden vectors landed after P1/P2") appended `relayerLandedP1P2` — three more LANDED relayed exits (fresh owner with grant, existing owner, and a third) — to `relayer-a0-golden-vectors.json`. This task's fixture stays at `37ad673` (pinned); adding those proofs to m10 is a two-line change to `landedFrom` calls plus a new pinned revision, worth doing in M1c when the verifier consumes them anyway.
- **The mutations ran on the first commit of this task** (`f152a8b`); the amend only added `sourcesRevision` and the `git show` read to the script and its fixture's provenance fields — no Rust source and no field a test reads changed (the suite re-ran green on the amend: 87 / 1 / 0 with the key files).
- **What the next tasks must know:** see Interfaces → "What later tasks rely on".

#### Spec rev 3.2 lines (Task 3)
- §3 "prove": **every `prove` consumes the live authorization first** (with or without an `authId`, whatever circuit, whatever it then decides); **a deposit given an `authId` refuses**; a deposit of 0 refuses.
- §3 "prove": the witness JSON is **one object, every allow-listed key exactly once** (repeats refuse); amounts as **canonical decimal u64 strings**, field elements as **64 lowercase hex, canonical, never reduced**, `pathIndices` as **JSON integers 0/1**; the note's Merkle path is **checked in Rust before the key files are read**.
- §3 "prove": the key files are **pinned by sha256 and length, read once**; the proof's randomness is **from the OS**; the returned proof has **already verified against the pinned zkey's VK** with **public inputs equal to Rust's**, in the circuit's order (32-byte BE).
- §14 / m10: the layout is re-verified against the **two landed withdraw_with_change proofs** (`2mfMYnbt…`, `3UfCx5TD…`) — the landed deposit's proof bytes are not in the program side's committed data; the VK is the program side's committed `vk.json`, pinned, tied to the chain by those proofs; **reading the VK from chain is the M1a checkpoint's** (Task 6).
- §14 / m-5: the counts are **the zkey's `nPublic` and the wasm's `getInputSize`**, equal to the r1cs header's (4/2, 7/45); the `.r1cs` is not published by digest.
- §12 / §14: the A0 key files reach CI **by digest from the content-addressed route**, as the v1 artifacts do; the tests read `NOCTURA_A0_KEYS_DIR`, **skip loudly without it, fail without it under CI**.


### Task 4: The JNI surface, the Kotlin bindings and the JS bridge — `a0::bridge` (the JNI's whole logic, desktop-tested: strings and bytes in, one JSON envelope out, a stable `E_A0_…` code per `A0Error`, panics caught), `src/android.rs` as marshalling only (`NocturaA0Native`: `keysOpen`, `keysClose`, `depositRho`, `matchSpent`, `commitment`, `prove`, and the Kotlin-only `parseUnshield` / `authorizeUnshield`; the v1 two unchanged), `jni-exports.txt` + `check-jni-exports.sh` (`nm -D`, wired into CI with a negative control); Kotlin `@ReactMethod`s for exactly `isSupported` + the six A0 calls + the v1 `proveV1`, `parseUnshield` / `authorizeUnshield` `internal`, the seed `ReadableArray → ByteArray` zero-filled after the call, `prove` on its own thread; the JS bridge (`a0KeysOpen` … `a0Prove`, the seed `Uint8Array → number[]`, both zero-filled); INV-NK / INV-NULL / INV-AUTH as tests on three sides; 10 Rust tests, 15 Kotlin JVM tests (3 over the real JNI of a host build), 13 new Jest tests, 21 named mutations (+ 3 negative controls of the export check)

**Spec:** §3 "JNI surface" (the seven calls JS may reach, `parseUnshield` / `authorizeUnshield` Kotlin-only), "No pre-spend nullifier in JS" (R12, I-7: no `nullifier()` call; the one exit is public input [1] of a withdraw_change proof), "The seed crosses as bytes, never as a string" (C3: JS `Uint8Array → number[]`, both zero-filled; Kotlin `ReadableArray → ByteArray → jbyteArray`, zero-filled when the call returns; Rust copies into a zeroizing buffer; the stated limit of the bridge's own copies), "Handle lifetime" (m5: an opaque handle, a second `keysOpen` replaces the first — the handle form is decided here), "Rust state" (`authorizeUnshield` on the UI thread, `prove` on Kotlin's proving thread — the `Mutex` is Task 1's; this task puts `prove` on that thread), `prove` (an `authId` required for withdraw_change, consumed by the first prove — at the JNI too, including a malformed argument), the invariants INV-NK / INV-NULL / INV-AUTH as boundary tests; §2 "Kotlin … never does: expose `authorizeUnshield` to JS"; §12 (pure Rust, no `libc++_shared`; the devnet and production APKs build); §14 "Boundary" (M1a's native half: "a JNI surface test that the `.so` exports exactly §3's functions, and that the React Native module exposes all of them **except** `parseUnshield` and `authorizeUnshield`"), §14 Rust (INV-NULL: "no JNI function's output other than a withdraw_change proof's public inputs equals `nullifier(rho)` for any `rho` the test passed in"); §16 M1a ("the Kotlin binding of every JNI function except `parseUnshield` / `authorizeUnshield`" — bound in Kotlin as internal methods, see Notes). **Not here:** the native confirmation dialog, `BiometricPrompt`, the window / lifecycle rules and the Kotlin tests of §14's M1c line (M1c); the JS source test over `src/`, `core/`, `extension/src/`, `web/src/` (§14: M1b's; this task's JS test is the bridge's own export list, scoped to the one module that can reach native); removing `NocturaKeyModule`, the arm64-only rule, the `readelf` CI step (Task 5 — this task runs `readelf` by hand, Step 9, and hands Task 5 the export script for its arm64 step); the checkpoint harness (Task 6).

**Files:**
- Create: `native/noctura-prover/src/a0/bridge.rs`, `native/noctura-prover/jni-exports.txt`, `native/noctura-prover/check-jni-exports.sh` (mode 100755), `android/app/src/main/java/com/nocturawallet/prover/NocturaA0Native.kt`, `android/app/src/main/java/com/nocturawallet/prover/A0Bridge.kt`
- Create (tests): `native/noctura-prover/src/a0/tests_bridge.rs` (10 tests; in-crate — it peeks the authorization record and uses Task 3's `keys_dir`), `android/app/src/test/java/com/nocturawallet/prover/{ReactSurfaceTest,A0SeedTest,A0ResultTest,A0JniTest}.kt` (4 + 4 + 4 + 3 JVM unit tests), `src/modules/zkProver/__tests__/a0Boundary.test.ts` (8)
- Modify: `native/noctura-prover/Cargo.toml` (optional `jni` + feature `jni-host`; **`Cargo.lock` unchanged** — `jni` is already locked), `native/noctura-prover/src/lib.rs` (`mod android` also under `jni-host`; the host-only `__rust_probestack` stub), `native/noctura-prover/src/a0/mod.rs` (`pub mod bridge`, the test module), `native/noctura-prover/src/a0/state.rs` (`A0Error::{Arg, ArgItem}`, `A0Error::code`, `Core::discard_auth`), `native/noctura-prover/src/android.rs` (the eight A0 symbols), `android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt` (the A0 `@ReactMethod`s, the Kotlin-only pair, v1 `prove` → `proveV1`, the loader moved to `NocturaNativeLib`), `android/app/build.gradle` (`testImplementation` junit 4.13.2 + org.json 20260814; `testOptions` passing `NOCTURA_A0_HOST_LIB_DIR` as `java.library.path`), `src/modules/zkProver/nativeProverBridge.ts`, `.github/workflows/native-prover.yml` (clippy with `jni-host`; the keyed bridge test in the interop assertion; the JNI export check and its negative control)
- Modify (tests): `native/noctura-prover/src/a0/tests_prove.rs` (`keys_dir` → `pub(super)`, nothing else), `src/modules/zkProver/__tests__/nativeProverBridge.test.ts` (2 → 7)
- **Not changed, on purpose:** every other file of `src/a0/` (the core is Tasks 1–3's; the bridge calls only their public functions plus `Core::lock` / `Inner::discard_auth`); `Cargo.lock`; `src/prover.rs` and the v1 JNI functions' bodies (`nativeIsSupported`, `nativeProve` — M1b removes v1); `NocturaProverPackage.kt` (still registers the one module); `src/modules/zkProver/localProver.ts` (it imports `nativeProve`, whose signature is unchanged — only the native method behind it is renamed); the Task 1–3 fixtures (read, never written).

**Interfaces:**
- Consumes (Tasks 1–3): `CORE`, `Core::{keys_open, keys_close, deposit_rho, commitment, match_spent, authorize_unshield, prove, lock}`, `Inner::discard_auth`, `Handle::{raw, from_raw}`, `AuthId::{to_bytes, from_bytes}`, `Proof`, `unshield::{parse_unshield, parse_u64}`, `A0Error` and its `Display`; tests: `tests_prove::keys_dir`, `Inner::peek_auth_expiry_for_test`, the fixtures `a0-key-vectors.json` (`seeds[0]`: `seed`, `sk`, `viewKey`, `nk`, `ivk`, `dSelf`, `addrSelf`, `notes[]` with `rho`, `nullifier`, `rhoChange`, `commitments`) and `a0-prove-vectors.json` (`scenarios[0..2]`). Crates: `jni 0.21` (`JNIEnv::{convert_byte_array, get_string, get_array_length, get_object_array_element, new_string, exception_clear}`), `serde_json`, `zeroize`, `hex`, `num-bigint`, `bs58` (tests). Kotlin: `com.facebook.react.bridge.{ReactMethod, ReadableArray, ReadableType, Promise, Arguments, JavaOnlyArray (tests)}`, `org.json`, JUnit 4.
- Produces — Rust, public (`noctura_prover::a0`):
  ```rust
  pub mod bridge {
      pub const INTERNAL: &str = "E_A0_INTERNAL";
      // Each returns {"ok": <value>} or {"error": "<E_A0_…>", "message": "<Display>"}.
      pub fn keys_open(core: &Core, seed: &mut [u8]) -> String;                 // ok: "<handle>" (decimal u64); seed wiped on every path
      pub fn keys_close(core: &Core, h: &str) -> String;                        // ok: null
      pub fn deposit_rho(core: &Core, h: &str, deposit_index: &str) -> String;  // ok: 64 lowercase hex
      pub fn match_spent(core: &Core, h: &str, chain_nullifiers: &[String], own_rhos: &[String]) -> String; // ok: [indices]
      pub fn commitment(core: &Core, h: &str, amount: &str, rho: &str) -> String;                         // ok: 64 hex
      pub fn prove(core: &Core, h: &str, circuit: &str, witness_json: &str, auth: Option<&str>,
                   zkey_path: &str, wasm_path: &str) -> String;   // ok: {"proofBytes": 512 hex, "publicInputs": [64 hex …]}
      pub fn parse_unshield(owner: &str, amount: &str, fee: &str) -> String;
      //   ok: {"owner","ata","amount","fee","humanAmount","humanFee","pool"} — amount / fee as decimal strings
      pub fn authorize_unshield(core: &Core, h: &str, owner: &str, amount: &str, fee: &str) -> String; // ok: 32 lowercase hex
  }
  impl A0Error { pub fn code(&self) -> &'static str; }   // "E_A0_" + the variant in SCREAMING_SNAKE, exhaustive
  pub enum A0Error { /* Tasks 1–3's 43, plus: */ Arg { what: &'static str }, ArgItem { what: &'static str, index: usize } }
  ```
  The argument forms (one spelling each): handle = canonical decimal u64 (else `E_A0_ARG`; `"0"` is well formed and never live → `E_A0_UNKNOWN_HANDLE`); `depositIndex` / `amount` / `fee` = canonical decimal u64 (`E_A0_NOT_U64`); `rho`, nullifiers = 64 lowercase hex (`E_A0_ARG` / `E_A0_ARG_ITEM` with the index; a value ≥ r is `E_A0_NON_CANONICAL`); `authId` = 32 lowercase hex or absent (JVM `null`).
- Produces — crate-private: `bridge::envelope(f) -> String` (catches a panic → `E_A0_INTERNAL`, "internal error"), `Core::discard_auth(&self) -> Result<(), A0Error>`.
- Produces — the JNI (`jni-exports.txt`, exactly these ten): `Java_com_nocturawallet_prover_NocturaA0Native_{authorizeUnshield, commitment, depositRho, keysClose, keysOpen, matchSpent, parseUnshield, prove}` and `Java_com_nocturawallet_prover_NocturaProverModule_{nativeIsSupported, nativeProve}`.
- Produces — Kotlin (`com.nocturawallet.prover`):
  ```kotlin
  internal object NocturaA0Native {              // @JvmStatic external, each returns the envelope or null
      fun keysOpen(seed: ByteArray): String?
      fun keysClose(handle: String): String?
      fun depositRho(handle: String, depositIndex: String): String?
      fun matchSpent(handle: String, chainNullifiers: Array<String>, ownRhos: Array<String>): String?
      fun commitment(handle: String, amount: String, rho: String): String?
      fun prove(handle: String, circuit: String, witnessJson: String, authId: String?, zkeyPath: String, wasmPath: String): String?
      fun parseUnshield(owner: String, amount: String, fee: String): String?
      fun authorizeUnshield(handle: String, owner: String, amount: String, fee: String): String?
  }
  internal object NocturaNativeLib { fun ensureLoaded() }
  internal sealed class A0Result { data class Ok(val value: Any?); data class Err(val code: String, val message: String)
      companion object { INTERNAL = "E_A0_INTERNAL"; UNAVAILABLE = "E_A0_UNAVAILABLE"; ARG = "E_A0_ARG"; fun parse(json: String?): A0Result } }
  internal object A0Seed { fun <T> use(seed: ReadableArray, use: (ByteArray) -> T): T }   // zero-fills on return and throw
  internal object A0Args { fun strings(arr: ReadableArray, what: String): Array<String> }
  internal object A0Prover { const val THREAD_NAME = "noctura-a0-prove"; fun submit(task: () -> Unit) }
  class NocturaProverModule {
      @ReactMethod(isBlockingSynchronousMethod = true) fun isSupported(): Boolean
      @ReactMethod fun keysOpen(seed: ReadableArray, promise: Promise)
      @ReactMethod fun keysClose(handle: String, promise: Promise)
      @ReactMethod fun depositRho(handle: String, depositIndex: String, promise: Promise)
      @ReactMethod fun matchSpent(handle: String, chainNullifiers: ReadableArray, ownRhos: ReadableArray, promise: Promise)
      @ReactMethod fun commitment(handle: String, amount: String, rho: String, promise: Promise)
      @ReactMethod fun prove(handle: String, circuit: String, witnessJson: String, authId: String?, zkeyPath: String, wasmPath: String, promise: Promise)
      @ReactMethod fun proveV1(circuitId: String, witnessJson: String, zkeyPath: String, wasmPath: String, promise: Promise)  // v1, M1b removes
      internal fun parseUnshield(owner: String, amount: String, fee: String): A0Result          // M1c's dialog
      internal fun authorizeUnshield(handle: String, owner: String, amount: String, fee: String): A0Result
  }
  ```
- Produces — JS (`src/modules/zkProver/nativeProverBridge.ts`, exactly these runtime exports):
  ```ts
  export type A0Handle = string & {readonly __a0Handle: unique symbol};
  export type A0Circuit = 'deposit' | 'withdraw_change';
  export interface A0Proof { proofBytes: string; publicInputs: string[] }
  export function isProverSupported(): boolean;
  export async function nativeProve(circuitId, witnessJson, zkeyPath, wasmPath);   // v1, unchanged signature; M1b removes
  export async function a0KeysOpen(seed: Uint8Array): Promise<A0Handle>;            // CONSUMES seed (zero-filled)
  export async function a0KeysClose(handle: A0Handle): Promise<void>;
  export async function a0DepositRho(handle: A0Handle, depositIndex: bigint): Promise<string>;
  export async function a0MatchSpent(handle: A0Handle, chainNullifiers: string[], ownRhos: string[]): Promise<number[]>;
  export async function a0Commitment(handle: A0Handle, amount: bigint, rho: string): Promise<string>;
  export async function a0Prove(handle: A0Handle, circuit: A0Circuit, witnessJson: string, authId: string | null,
                                zkeyPath: string, wasmPath: string): Promise<A0Proof>;
  ```
  A rejection carries `code` = the Rust code, `E_A0_ARG` (a Kotlin-refused argument), `E_A0_UNAVAILABLE` (the library did not load) or `E_A0_INTERNAL`.
- **What later tasks rely on:** **Task 5** — `check-jni-exports.sh <arm64 .so>` is the export check for its arm64 CI step (it reads a foreign-architecture ELF with binutils `nm`; Step 9 ran it on the arm64 library and on the one packaged in the APK); `jni-exports.txt` is the one list; the `cargo ndk … -o android/app/src/main/jniLibs` command also copies a stray `libark_circom-<hash>.so` (Notes). **Task 6** — the harness calls `NocturaA0Native` (or the module) with the repo test seed; `A0JniTest` is the desktop rehearsal of exactly that sequence (keysOpen → depositRho(0) → commitment → a withdraw_change prove without `authId` refused). **M1b** — the JS calls are `a0KeysOpen` … `a0Prove`; deletes `proveV1` / `nativeProve` / `Java_…_NocturaProverModule_nativeProve` and their three expected-set lines (`ReactSurfaceTest`, `a0Boundary.test.ts`, `jni-exports.txt`). **M1c** — the dialog calls `NocturaProverModule.parseUnshield` / `authorizeUnshield` (Kotlin, `A0Result`), returns `{authId, owner, ata}` to JS from a new `@ReactMethod` (the confirm call — then `ReactSurfaceTest` and `a0Boundary.test.ts` gain exactly that one name).

**The rule, stated once.** JS reaches native through seven React methods and nothing else; two more calls exist on the native side and only Kotlin can make them. Every argument crosses as bytes (the seed) or as a string in one spelling, and Rust parses all of them — Kotlin only refuses what is not even a byte or a string. Everything that comes back is one envelope: a value that is public once used, or a stable code with a message that names no input. The seed is wiped on all three sides as soon as the call settles. An own note's nullifier leaves Rust only inside a withdraw_change proof, and that proof exists only after a native approval that the attempt — any attempt, malformed or not — uses up. Each of these is read off the built artefact (the library's symbols, the compiled classes, the module's runtime exports), not off a comment.

- [ ] **Step 1: The Rust tests — the bridge, INV-NK / INV-NULL / INV-AUTH.**

Create `native/noctura-prover/src/a0/tests_bridge.rs`:

```rust
//! The JNI surface's logic (spec §3 "JNI surface", "The seed crosses as bytes", INV-NK,
//! INV-NULL, INV-AUTH; §14 "Boundary"): `bridge::*` is exactly what `android.rs` calls with the
//! strings and bytes it took from the JVM, so these tests run the bound calls end to end except
//! for the JNI marshalling itself (which the Kotlin JVM test `A0JniTest` exercises on the host
//! build, and the device checkpoint on the phone).
//!
//! Expected values come from the Task 1 / Task 3 fixtures (`a0-key-vectors.json`,
//! `a0-prove-vectors.json`), written OFFLINE by the scripts under `scripts/a0-vectors/`; nothing
//! here computes an expected value with the code under test.

use super::bridge::{self, envelope, INTERNAL};
use super::state::{A0Error, Core};
use super::tests_prove::keys_dir;
use serde_json::{json, Value};
use std::collections::HashSet;

const KEY_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-key-vectors.json"
));
const PROVE_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-prove-vectors.json"
));
/// Never read: every prove below that names it is refused before a key file is opened, or is
/// meant to fail AT the key file (the proof that it got past the authorization).
const NO_FILE: &str = "/nonexistent/never-read";

fn kv() -> Value {
    serde_json::from_str(KEY_VECTORS).unwrap()
}
fn pv() -> Value {
    serde_json::from_str(PROVE_VECTORS).unwrap()
}
fn seed0() -> Value {
    kv()["seeds"][0].clone()
}
fn s(v: &Value) -> String {
    v.as_str().unwrap().to_string()
}
fn seed_bytes() -> Vec<u8> {
    hex::decode(s(&seed0()["seed"])).unwrap()
}
fn parse(out: &str) -> Value {
    serde_json::from_str(out).unwrap()
}
fn ok(out: &str) -> Value {
    let v = parse(out);
    assert!(v.get("error").is_none(), "expected ok, got {out}");
    v["ok"].clone()
}
fn code(out: &str) -> String {
    let v = parse(out);
    assert!(v.get("ok").is_none(), "expected an error, got {out}");
    s(&v["error"])
}
fn open(core: &Core) -> String {
    let mut seed = seed_bytes();
    s(&ok(&bridge::keys_open(core, &mut seed)))
}
fn strings(v: &[&str]) -> Vec<String> {
    v.iter().map(|x| x.to_string()).collect()
}
fn scenario(i: usize) -> Value {
    pv()["scenarios"][i].clone()
}
fn authorize(core: &Core, h: &str, sc: &Value) -> String {
    let a = &sc["authorization"];
    s(&ok(&bridge::authorize_unshield(
        core,
        h,
        &s(&a["owner"]),
        &s(&a["amount"]),
        &s(&a["fee"]),
    )))
}
fn prove(core: &Core, h: &str, circuit: &str, w: &str, auth: Option<&str>) -> String {
    bridge::prove(core, h, circuit, w, auth, NO_FILE, NO_FILE)
}

/// Every spelling of a value a bound call could leak it in: hex either case, decimal, base58.
fn spellings(hex_be: &str) -> Vec<String> {
    let bytes = hex::decode(hex_be).unwrap();
    vec![
        hex_be.to_lowercase(),
        hex_be.to_uppercase(),
        num_bigint::BigUint::from_bytes_be(&bytes).to_string(),
        bs58::encode(&bytes).into_string(),
    ]
}
/// The values that must never cross the JNI (INV-NK) and the own nullifiers that may cross it
/// only as a withdraw_change proof's public input [1] (INV-NULL), for the fixture's seeds[0].
fn forbidden() -> Vec<(String, String)> {
    let seed = seed0();
    let mut out = vec![];
    for k in ["seed", "sk", "viewKey", "nk", "ivk", "dSelf", "addrSelf"] {
        for sp in spellings(&s(&seed[k])) {
            out.push((k.to_string(), sp));
        }
    }
    for n in seed["notes"].as_array().unwrap() {
        for k in ["nullifier", "rhoChange"] {
            for sp in spellings(&s(&n[k])) {
                out.push((format!("{k}[{}]", s(&n["depositIndex"])), sp));
            }
        }
    }
    out
}
fn leaks(output: &str) -> Vec<String> {
    forbidden()
        .into_iter()
        .filter(|(_, sp)| output.contains(sp.as_str()))
        .map(|(name, _)| name)
        .collect()
}

// --------------------------------------------------------------------- the error envelope

/// The name a variant's `Debug` prints, as SCREAMING_SNAKE.
fn snake(e: &A0Error) -> String {
    let dbg = format!("{e:?}");
    let name: String = dbg.chars().take_while(|c| c.is_alphanumeric()).collect();
    let mut out = String::new();
    for (i, c) in name.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            out.push('_');
        }
        out.push(c.to_ascii_uppercase());
    }
    out
}

#[test]
fn every_error_has_a_distinct_stable_code_named_after_its_variant() {
    let all = [
        A0Error::SeedLength { got: 1 },
        A0Error::UnknownHandle,
        A0Error::NonCanonical {
            what: "rho",
            index: 0,
        },
        A0Error::DuplicateRho { index: 0 },
        A0Error::StatePoisoned,
        A0Error::OwnerNotBase58,
        A0Error::OwnerLength { got: 1 },
        A0Error::OwnerOffCurve,
        A0Error::OwnerNonCanonical,
        A0Error::OwnerSmallOrder,
        A0Error::OwnerTorsion,
        A0Error::NoProgramAddress,
        A0Error::NotU64 { what: "amount" },
        A0Error::AmountZero,
        A0Error::FeeAboveCeiling,
        A0Error::AmountPlusFeeOverflow,
        A0Error::AuthInFlight,
        A0Error::AuthAbsent,
        A0Error::AuthMismatch,
        A0Error::AuthWrongHandle,
        A0Error::AuthExpired,
        A0Error::Rng,
        A0Error::Clock,
        A0Error::CircuitUnknown,
        A0Error::CircuitNotInM1,
        A0Error::AuthUnexpected,
        A0Error::AuthRecordInconsistent,
        A0Error::WitnessJson,
        A0Error::WitnessRustFilled { name: "nk" },
        A0Error::WitnessUnknownKey,
        A0Error::WitnessDuplicate { name: "rho" },
        A0Error::WitnessMissing { name: "rho" },
        A0Error::WitnessValue {
            name: "rho",
            index: 0,
        },
        A0Error::WitnessNotInTree,
        A0Error::WithdrawExceedsInput,
        A0Error::KeyFileRead { file: "f" },
        A0Error::KeyFilePin { file: "f" },
        A0Error::KeyFileFormat { file: "f" },
        A0Error::CircuitShape,
        A0Error::WitnessRejected,
        A0Error::PublicInputMismatch,
        A0Error::ProofFailed,
        A0Error::ProofDoesNotVerify,
        A0Error::Arg { what: "handle" },
        A0Error::ArgItem {
            what: "ownRhos",
            index: 0,
        },
    ];
    assert_eq!(all.len(), 45);
    let mut codes = HashSet::new();
    for e in &all {
        let c = e.code();
        assert_eq!(c, format!("E_A0_{}", snake(e)), "{e:?}");
        assert!(
            c.bytes()
                .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_'),
            "{c}"
        );
        assert!(codes.insert(c), "{c} is used twice");
    }
    assert!(!codes.contains(INTERNAL));
    assert_eq!(INTERNAL, "E_A0_INTERNAL");
}

#[test]
fn the_envelope_is_ok_or_a_code_and_a_panic_becomes_internal() {
    assert_eq!(parse(&envelope(|| Ok(json!("x")))), json!({"ok": "x"}));
    assert_eq!(parse(&envelope(|| Ok(Value::Null))), json!({"ok": null}));
    assert_eq!(
        parse(&envelope(|| Err(A0Error::AuthAbsent))),
        json!({"error": "E_A0_AUTH_ABSENT", "message": "no live unshield authorization"})
    );
    let out = envelope(|| -> Result<Value, A0Error> { panic!("a secret 1234 in a panic") });
    assert_eq!(
        parse(&out),
        json!({"error": "E_A0_INTERNAL", "message": "internal error"})
    );
    assert!(!out.contains("1234"));
}

// ------------------------------------------------------------- the calls, against the fixture

#[test]
fn keys_open_returns_a_decimal_handle_and_wipes_the_seed_on_every_path() {
    let core = Core::new();
    let mut seed = seed_bytes();
    let h = s(&ok(&bridge::keys_open(&core, &mut seed)));
    assert!(seed.iter().all(|b| *b == 0), "the seed copy was not wiped");
    assert!(!h.is_empty() && h.bytes().all(|b| b.is_ascii_digit()) && !h.starts_with('0'));
    let mut short = seed_bytes()[..63].to_vec();
    assert_eq!(
        code(&bridge::keys_open(&core, &mut short)),
        "E_A0_SEED_LENGTH"
    );
    assert!(
        short.iter().all(|b| *b == 0),
        "a refused seed was not wiped"
    );
    // the refused open ended the session it replaced (m5)
    assert_eq!(
        code(&bridge::deposit_rho(&core, &h, "0")),
        "E_A0_UNKNOWN_HANDLE"
    );
}

#[test]
fn the_bound_calls_return_the_fixtures_public_values() {
    let core = Core::new();
    let h = open(&core);
    let notes = seed0()["notes"].as_array().unwrap().clone();
    let mut rhos = vec![];
    let mut nullifiers = vec![];
    for n in &notes {
        let rho = ok(&bridge::deposit_rho(&core, &h, &s(&n["depositIndex"])));
        assert_eq!(rho, n["rho"], "depositRho({})", n["depositIndex"]);
        for c in n["commitments"].as_array().unwrap() {
            let got = ok(&bridge::commitment(
                &core,
                &h,
                &s(&c["amount"]),
                &s(&n["rho"]),
            ));
            assert_eq!(got, c["commitment"]);
        }
        rhos.push(s(&n["rho"]));
        nullifiers.push(s(&n["nullifier"]));
    }
    assert!(rhos.len() >= 3);
    // matchSpent: the chain spent notes 0 and 2 (and holds a foreign nullifier); indices only
    let chain = vec![
        nullifiers[2].clone(),
        "00".repeat(32),
        nullifiers[0].clone(),
    ];
    assert_eq!(
        ok(&bridge::match_spent(&core, &h, &chain, &rhos)),
        json!([0, 2])
    );
    assert_eq!(ok(&bridge::match_spent(&core, &h, &[], &rhos)), json!([]));
    // keysClose ends the session: every call on the handle is refused afterwards
    assert_eq!(ok(&bridge::keys_close(&core, &h)), Value::Null);
    for out in [
        bridge::deposit_rho(&core, &h, "0"),
        bridge::commitment(&core, &h, "1", &rhos[0]),
        bridge::match_spent(&core, &h, &chain, &rhos),
        bridge::keys_close(&core, &h),
    ] {
        assert_eq!(code(&out), "E_A0_UNKNOWN_HANDLE");
    }
}

#[test]
fn parse_unshield_gives_the_dialog_its_values_as_strings() {
    let sc = scenario(1);
    let a = &sc["authorization"];
    let got = ok(&bridge::parse_unshield(
        &s(&a["owner"]),
        &s(&a["amount"]),
        &s(&a["fee"]),
    ));
    assert_eq!(
        got,
        json!({
            "owner": a["owner"], "ata": a["ata"], "amount": "400000", "fee": "10000",
            "humanAmount": "0.0004", "humanFee": "0.00001",
            "pool": "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT",
        })
    );
    assert_eq!(
        code(&bridge::parse_unshield(&s(&a["owner"]), "0", "1")),
        "E_A0_AMOUNT_ZERO"
    );
}

#[test]
fn every_argument_has_one_spelling() {
    let core = Core::new();
    let h = open(&core);
    let rho = s(&seed0()["notes"][0]["rho"]);
    for bad in ["", "01", "+1", " 1", "1 ", "x", "18446744073709551616"] {
        assert_eq!(
            code(&bridge::deposit_rho(&core, bad, "0")),
            "E_A0_ARG",
            "handle {bad:?}"
        );
    }
    // a well-formed handle that is not the live one
    assert_eq!(
        code(&bridge::deposit_rho(&core, "0", "0")),
        "E_A0_UNKNOWN_HANDLE"
    );
    for bad in ["", "-1", "01", "+0", "1.0", "18446744073709551616"] {
        assert_eq!(
            code(&bridge::deposit_rho(&core, &h, bad)),
            "E_A0_NOT_U64",
            "{bad:?}"
        );
        assert_eq!(
            code(&bridge::commitment(&core, &h, bad, &rho)),
            "E_A0_NOT_U64",
            "{bad:?}"
        );
    }
    let upper = rho.to_uppercase();
    let prefixed = format!("0x{}", &rho[2..]);
    for bad in [&upper, &prefixed, &rho[1..].to_string(), &format!("{rho}0")] {
        assert_eq!(
            code(&bridge::commitment(&core, &h, "1", bad)),
            "E_A0_ARG",
            "{bad:?}"
        );
    }
    // a hex string ≥ r is well formed but not a field element: refused by the core, not reduced
    let r = "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001";
    assert_eq!(
        code(&bridge::commitment(&core, &h, "1", r)),
        "E_A0_NON_CANONICAL"
    );
    let out = bridge::match_spent(&core, &h, &strings(&[&rho]), &strings(&[&rho, &upper]));
    assert_eq!(
        parse(&out),
        json!({"error": "E_A0_ARG_ITEM", "message": "argument ownRhos[1] is malformed"})
    );
    assert_eq!(
        code(&bridge::match_spent(
            &core,
            &h,
            &strings(&[&rho, "zz"]),
            &[]
        )),
        "E_A0_ARG_ITEM"
    );
    // positive control: the canonical spellings pass
    ok(&bridge::deposit_rho(&core, &h, "18446744073709551615"));
    ok(&bridge::commitment(&core, &h, "0", &rho));
    // no refusal echoes what it was given
    let nk = s(&seed0()["nk"]);
    for out in [
        bridge::commitment(&core, &h, "1", &format!("{nk}z")),
        bridge::commitment(&core, &h, &nk, &rho),
        bridge::deposit_rho(&core, &nk, "0"),
        bridge::match_spent(&core, &h, &[format!("{nk}0")], &[]),
        prove(&core, &h, "deposit", "{}", Some(&nk)),
    ] {
        assert!(!out.contains(&nk), "{out}");
        assert!(leaks(&out).is_empty(), "{out}");
    }
}

// ---------------------------------------------------------------- INV-NK and INV-NULL

#[test]
fn the_leak_scan_sees_every_spelling_positive_control() {
    let nk = s(&seed0()["nk"]);
    let nf = s(&seed0()["notes"][1]["nullifier"]);
    for sp in spellings(&nk) {
        assert_eq!(
            leaks(&format!("{{\"ok\":\"{sp}\"}}")),
            vec!["nk".to_string()]
        );
    }
    for sp in spellings(&nf) {
        assert_eq!(
            leaks(&format!("[\"{sp}\"]")),
            vec!["nullifier[1]".to_string()]
        );
    }
    assert!(leaks("{\"ok\":\"12\"}").is_empty());
}

#[test]
fn inv_nk_and_inv_null_no_bound_call_outputs_a_secret_or_an_own_nullifier() {
    let core = Core::new();
    let mut outputs: Vec<(String, String)> = vec![];
    let mut seed = seed_bytes();
    let open_out = bridge::keys_open(&core, &mut seed);
    let h = s(&ok(&open_out));
    outputs.push(("keysOpen".into(), open_out));
    let notes = seed0()["notes"].as_array().unwrap().clone();
    let rhos: Vec<String> = notes.iter().map(|n| s(&n["rho"])).collect();
    let nfs: Vec<String> = notes.iter().map(|n| s(&n["nullifier"])).collect();
    for n in &notes {
        outputs.push((
            "depositRho".into(),
            bridge::deposit_rho(&core, &h, &s(&n["depositIndex"])),
        ));
        for c in n["commitments"].as_array().unwrap() {
            outputs.push((
                "commitment".into(),
                bridge::commitment(&core, &h, &s(&c["amount"]), &s(&n["rho"])),
            ));
        }
    }
    // matchSpent over every subset of the own nullifiers, and with the rhos as "nullifiers"
    for mask in 0..(1u32 << nfs.len()) {
        let chain: Vec<String> = (0..nfs.len())
            .filter(|i| mask & (1 << i) != 0)
            .map(|i| nfs[i].clone())
            .collect();
        outputs.push((
            "matchSpent".into(),
            bridge::match_spent(&core, &h, &chain, &rhos),
        ));
    }
    outputs.push((
        "matchSpent".into(),
        bridge::match_spent(&core, &h, &rhos, &rhos),
    ));
    let dup = vec![rhos[0].clone(), rhos[0].clone()];
    outputs.push((
        "matchSpent".into(),
        bridge::match_spent(&core, &h, &nfs, &dup),
    ));
    // parseUnshield / authorizeUnshield / prove: their outputs and their refusals
    let sc = scenario(1);
    let a = &sc["authorization"];
    outputs.push((
        "parseUnshield".into(),
        bridge::parse_unshield(&s(&a["owner"]), &s(&a["amount"]), &s(&a["fee"])),
    ));
    let id = authorize(&core, &h, &sc);
    outputs.push((
        "authorizeUnshield".into(),
        bridge::authorize_unshield(&core, &h, &s(&a["owner"]), "1", "1"),
    ));
    let w = sc["witness"].to_string();
    for (circuit, auth) in [
        ("withdraw_change", Some(id.as_str())),
        ("withdraw_change", None),
        ("deposit", None),
        ("transfer", None),
    ] {
        let wit = if circuit == "deposit" {
            scenario(0)["witness"].to_string()
        } else {
            w.clone()
        };
        outputs.push(("prove".into(), prove(&core, &h, circuit, &wit, auth)));
    }
    outputs.push(("keysClose".into(), bridge::keys_close(&core, &h)));
    assert!(outputs.len() > 20);
    for (call, out) in &outputs {
        assert!(
            leaks(out).is_empty(),
            "{call} → {out} leaks {:?}",
            leaks(out)
        );
    }
    // Positive control: the same scan over the values the core holds would have fired —
    // matchSpent's own computation is exactly these nullifiers.
    assert!(!leaks(&json!(nfs).to_string()).is_empty());
}

// ------------------------------------------------------------------------------ INV-AUTH

#[test]
fn inv_auth_a_withdraw_change_prove_needs_the_approved_authorization() {
    let sc = scenario(1);
    let a = &sc["authorization"];
    let w = sc["witness"].to_string();
    let core = Core::new();
    let h = open(&core);
    let live = |core: &Core| core.lock().unwrap().peek_auth_expiry_for_test().is_some();

    // none at all
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, None)),
        "E_A0_AUTH_ABSENT"
    );
    // a valid approval gets past the authorization: the refusal is the (absent) key file
    let id = authorize(&core, &h, &sc);
    assert_eq!(id.len(), 32);
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
        "E_A0_KEY_FILE_READ"
    );
    // ... once: the same id again
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    // a prove without the id drops a live approval
    let id = authorize(&core, &h, &sc);
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, None)),
        "E_A0_AUTH_ABSENT"
    );
    assert!(!live(&core));
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    // a malformed authId or handle is refused — and still uses the live approval up
    let upper = "AB".repeat(16);
    let short = "ab".repeat(15);
    for bad in ["", upper.as_str(), short.as_str(), "zz"] {
        let id = authorize(&core, &h, &sc);
        assert_eq!(
            code(&prove(&core, &h, "withdraw_change", &w, Some(bad))),
            "E_A0_ARG",
            "{bad:?}"
        );
        assert!(!live(&core), "{bad:?} left the approval live");
        assert_eq!(
            code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
            "E_A0_AUTH_ABSENT"
        );
    }
    let id = authorize(&core, &h, &sc);
    assert_eq!(
        code(&prove(&core, "01", "withdraw_change", &w, Some(&id))),
        "E_A0_ARG"
    );
    assert!(!live(&core));
    // another id: refused, and the live approval is used up
    let id = authorize(&core, &h, &sc);
    let first = if id.starts_with('0') { '1' } else { '0' };
    let other = format!("{first}{}", &id[1..]);
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&other))),
        "E_A0_AUTH_MISMATCH"
    );
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    // one in flight
    let id = authorize(&core, &h, &sc);
    assert_eq!(
        code(&bridge::authorize_unshield(
            &core,
            &h,
            &s(&a["owner"]),
            "1",
            "1"
        )),
        "E_A0_AUTH_IN_FLIGHT"
    );
    // the destination, amount and fee are not the caller's to give
    for k in ["withdrawAmount", "fee", "recipientField", "nullifier"] {
        let mut wv = sc["witness"].clone();
        wv[k] = json!("1");
        assert_eq!(
            code(&prove(
                &core,
                &h,
                "withdraw_change",
                &wv.to_string(),
                Some(&id)
            )),
            "E_A0_WITNESS_RUST_FILLED",
            "{k}"
        );
    }
    // an approval does not survive its session: closed, then reopened
    let id = authorize(&core, &h, &sc);
    ok(&bridge::keys_close(&core, &h));
    let h2 = open(&core);
    assert_eq!(
        code(&prove(&core, &h2, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    let id = authorize(&core, &h2, &sc);
    let h3 = open(&core);
    assert_eq!(
        code(&prove(&core, &h3, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    // authorizeUnshield needs the live handle
    assert_eq!(
        code(&bridge::authorize_unshield(
            &core,
            &h2,
            &s(&a["owner"]),
            "1",
            "1"
        )),
        "E_A0_UNKNOWN_HANDLE"
    );
}

#[test]
fn keyed_bridge_withdraw_change_carries_the_approved_values_and_is_the_one_nullifier_exit() {
    let Some(dir) = keys_dir(
        "keyed_bridge_withdraw_change_carries_the_approved_values_and_is_the_one_nullifier_exit",
    ) else {
        return;
    };
    let zkey = dir.join("withdraw_change_final.zkey");
    let wasm = dir.join("withdraw_change.wasm");
    let (zkey, wasm) = (zkey.to_str().unwrap(), wasm.to_str().unwrap());
    let sc = scenario(1);
    let core = Core::new();
    let h = open(&core);
    let id = authorize(&core, &h, &sc);
    let w = sc["witness"].to_string();
    let out = bridge::prove(&core, &h, "withdraw_change", &w, Some(&id), zkey, wasm);
    let got = ok(&out);
    // the public inputs are the desk values: [1] the note's nullifier, [2] the approved amount,
    // [3] be_mod_r(the approved owner's ATA), [6] the approved fee
    assert_eq!(got["publicInputs"], sc["publicInputs"]);
    assert_eq!(got["proofBytes"].as_str().unwrap().len(), 512);
    let nf = s(&seed0()["notes"][1]["nullifier"]);
    assert_eq!(got["publicInputs"][1], json!(nf));
    // INV-NULL: the nullifier is in this output — and only as public input [1]
    assert_eq!(leaks(&out), vec!["nullifier[1]".to_string()]);
    assert_eq!(out.matches(nf.as_str()).count(), 1);
    let mut rest = got.clone();
    rest["publicInputs"][1] = json!("");
    assert!(leaks(&rest.to_string()).is_empty());
    // the approval was used up by the proof
    assert_eq!(
        code(&bridge::prove(
            &core,
            &h,
            "withdraw_change",
            &w,
            Some(&id),
            zkey,
            wasm
        )),
        "E_A0_AUTH_ABSENT"
    );
    // a deposit proof through the bridge carries no own nullifier either
    let dz = dir.join("deposit_final.zkey");
    let dw = dir.join("deposit.wasm");
    let d = scenario(0);
    let out = bridge::prove(
        &core,
        &h,
        "deposit",
        &d["witness"].to_string(),
        None,
        dz.to_str().unwrap(),
        dw.to_str().unwrap(),
    );
    assert_eq!(ok(&out)["publicInputs"], d["publicInputs"]);
    assert!(leaks(&out).is_empty(), "{:?}", leaks(&out));
}
```

Apply to `native/noctura-prover/src/a0/tests_prove.rs`:

```diff
diff --git a/native/noctura-prover/src/a0/tests_prove.rs b/native/noctura-prover/src/a0/tests_prove.rs
index 2abf92f..e63b078 100644
--- a/native/noctura-prover/src/a0/tests_prove.rs
+++ b/native/noctura-prover/src/a0/tests_prove.rs
@@ -141,7 +141,7 @@ fn without_key(sc: &Value, key: &str) -> String {
 }
 
 /// The key-file directory, or `None` (the test then returns early, loudly).
-fn keys_dir(test: &str) -> Option<PathBuf> {
+pub(super) fn keys_dir(test: &str) -> Option<PathBuf> {
     match std::env::var_os("NOCTURA_A0_KEYS_DIR") {
         Some(d) => Some(PathBuf::from(d)),
         None => {
```

Wire the module (the `pub mod bridge;` line of this diff is what makes the red below "not found", not a missing test module):

Apply to `native/noctura-prover/src/a0/mod.rs`:

```diff
diff --git a/native/noctura-prover/src/a0/mod.rs b/native/noctura-prover/src/a0/mod.rs
index 35a7e00..185c30f 100644
--- a/native/noctura-prover/src/a0/mod.rs
+++ b/native/noctura-prover/src/a0/mod.rs
@@ -11,6 +11,7 @@
 
 mod ata;
 mod auth;
+pub mod bridge;
 mod eip2333;
 mod field;
 mod keyfiles;
@@ -27,6 +28,8 @@ pub use unshield::{parse_unshield, Unshield, DECIMALS, FEE_CEILING};
 #[cfg(test)]
 mod tests;
 #[cfg(test)]
+mod tests_bridge;
+#[cfg(test)]
 mod tests_prove;
 #[cfg(test)]
 mod tests_unshield;
```

- [ ] **Step 2: Run — red, for the right reason.**

```bash
cd native/noctura-prover && cargo test --locked --lib a0::tests_bridge 2>&1 | grep -E "^error" | sort | uniq -c
```

Expected (measured on the base plus Step 1 only):

```
      1 error: could not compile `noctura-prover` (lib test) due to 6 previous errors
      3 error[E0277]: the size for values of type `str` cannot be known at compilation time
      1 error[E0432]: unresolved imports `super::bridge`, `super::bridge`
      1 error[E0599]: no variant named `Arg` found for enum `A0Error`
      1 error[E0599]: no variant named `ArgItem` found for enum `A0Error`
```

(With `mod.rs`'s `pub mod bridge;` present and no file, the first line reads `error[E0583]: file not found for module \`bridge\`` instead; the three E0277 are the unresolved `bridge::*` calls' inferred argument types.)

- [ ] **Step 3: Implement the Rust side — the bridge, the codes, the JNI symbols.**

Create `native/noctura-prover/src/a0/bridge.rs`:

```rust
//! The JNI surface's logic (spec §3 "JNI surface", "The seed crosses as bytes"; Task 4): one
//! function per bound call, taking what the JVM hands over — the seed as bytes, everything else
//! as strings — and returning one JSON envelope string, so `android.rs` is marshalling only and
//! these functions are tested on the desktop (`tests_bridge.rs`).
//!
//! The envelope: `{"ok": <value>}`, or `{"error": "<E_A0_… code>", "message": "<text>"}` with
//! the code from [`A0Error::code`] and the text from its `Display` — neither carries an input
//! value or a secret (tested). A panic becomes `{"error": "E_A0_INTERNAL", …}`: nothing unwinds
//! into the JVM, and a panic under the state lock poisons it, which wipes the keys.
//!
//! The forms, each with one spelling (anything else is `E_A0_ARG` / `E_A0_ARG_ITEM`):
//! - a handle: the canonical decimal of the `u64` `keys_open` returned (`"0"` is never live);
//! - `depositIndex`, `amount`, `fee`: canonical decimal `u64` (`E_A0_NOT_U64` otherwise);
//! - `rho`, a nullifier: 64 lowercase hex chars, 32 bytes big-endian (the core then refuses a
//!   value `≥ r` with `E_A0_NON_CANONICAL`, never reducing it);
//! - an `authId`: 32 lowercase hex chars (16 bytes), or absent (`None` — the JVM's `null`).
//!
//! What crosses back (INV-NK, INV-NULL): a handle, a deposit `rho`, a commitment, the indices of
//! spent own notes, the dialog's parsed values, an `authId`, and a proof with its public inputs —
//! the one place an own note's nullifier leaves Rust (a withdraw_change proof's input [1]).
//! `parse_unshield` and `authorize_unshield` are bound in Kotlin only, never in the React
//! module (their dialog is M1c's).

use super::auth::AuthId;
use super::state::{A0Error, Core, Handle};
use super::unshield::{self, parse_u64};
use serde_json::{json, Value};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;
use zeroize::Zeroize;

/// The code of a panic caught at the boundary.
pub const INTERNAL: &str = "E_A0_INTERNAL";

/// Runs `f` and wraps its outcome in the envelope; a panic is caught and reported as
/// [`INTERNAL`] with a fixed message (the panic's own message is not passed on).
pub(crate) fn envelope(f: impl FnOnce() -> Result<Value, A0Error>) -> String {
    match catch_unwind(AssertUnwindSafe(f)) {
        Ok(Ok(v)) => json!({ "ok": v }).to_string(),
        Ok(Err(e)) => json!({ "error": e.code(), "message": e.to_string() }).to_string(),
        Err(_) => json!({ "error": INTERNAL, "message": "internal error" }).to_string(),
    }
}

fn handle(s: &str) -> Result<Handle, A0Error> {
    parse_u64(s, "handle")
        .map(Handle::from_raw)
        .map_err(|_| A0Error::Arg { what: "handle" })
}

/// Exactly `2 * N` lowercase hex digits → `N` bytes.
fn lower_hex<const N: usize>(s: &str) -> Option<[u8; N]> {
    let b = s.as_bytes();
    if b.len() != 2 * N || !b.iter().all(|c| matches!(c, b'0'..=b'9' | b'a'..=b'f')) {
        return None;
    }
    let mut out = [0u8; N];
    hex::decode_to_slice(s, &mut out).ok()?;
    Some(out)
}

fn hex_list(items: &[String], what: &'static str) -> Result<Vec<[u8; 32]>, A0Error> {
    items
        .iter()
        .enumerate()
        .map(|(index, s)| lower_hex::<32>(s).ok_or(A0Error::ArgItem { what, index }))
        .collect()
}

fn auth_id(s: Option<&str>) -> Result<Option<AuthId>, A0Error> {
    match s {
        None => Ok(None),
        Some(s) => lower_hex::<16>(s)
            .map(|b| Some(AuthId::from_bytes(b)))
            .ok_or(A0Error::Arg { what: "authId" }),
    }
}

/// `keysOpen(seed) -> handle`. `seed` is wiped before this returns, on every path.
pub fn keys_open(core: &Core, seed: &mut [u8]) -> String {
    let out = envelope(|| {
        core.keys_open(seed)
            .map(|h| Value::String(h.raw().to_string()))
    });
    seed.zeroize();
    out
}

/// `keysClose(handle)`.
pub fn keys_close(core: &Core, h: &str) -> String {
    envelope(|| core.keys_close(handle(h)?).map(|()| Value::Null))
}

/// `depositRho(handle, depositIndex) -> 64 hex`.
pub fn deposit_rho(core: &Core, h: &str, deposit_index: &str) -> String {
    envelope(|| {
        let h = handle(h)?;
        let i = parse_u64(deposit_index, "depositIndex")?;
        core.deposit_rho(h, i).map(|b| json!(hex::encode(b)))
    })
}

/// `matchSpent(handle, chainNullifiers, ownRhos) -> indices into ownRhos` (R12).
pub fn match_spent(
    core: &Core,
    h: &str,
    chain_nullifiers: &[String],
    own_rhos: &[String],
) -> String {
    envelope(|| {
        let h = handle(h)?;
        let chain = hex_list(chain_nullifiers, "chainNullifiers")?;
        let own = hex_list(own_rhos, "ownRhos")?;
        core.match_spent(h, &chain, &own).map(|v| json!(v))
    })
}

/// `commitment(handle, amount, rho) -> 64 hex` (an own note's; `d_self` implicit).
pub fn commitment(core: &Core, h: &str, amount: &str, rho: &str) -> String {
    envelope(|| {
        let h = handle(h)?;
        let amount = parse_u64(amount, "amount")?;
        let rho = lower_hex::<32>(rho).ok_or(A0Error::Arg { what: "rho" })?;
        core.commitment(h, amount, &rho)
            .map(|b| json!(hex::encode(b)))
    })
}

/// `prove(handle, circuit, witnessJson, authId?, zkeyPath, wasmPath) -> {proofBytes,
/// publicInputs}` — 512 hex chars and the circuit's public inputs as 64-hex each, in order.
///
/// A malformed handle or `authId` is refused — and, like every prove (Task 3), it uses the live
/// authorization up first: an approval is good for one attempt, whatever that attempt was.
pub fn prove(
    core: &Core,
    h: &str,
    circuit: &str,
    witness_json: &str,
    auth: Option<&str>,
    zkey_path: &str,
    wasm_path: &str,
) -> String {
    envelope(|| {
        let (h, auth) = match handle(h).and_then(|h| Ok((h, auth_id(auth)?))) {
            Ok(args) => args,
            Err(e) => {
                core.discard_auth()?;
                return Err(e);
            }
        };
        let p = core.prove(
            h,
            circuit,
            witness_json,
            auth,
            Path::new(zkey_path),
            Path::new(wasm_path),
        )?;
        Ok(json!({
            "proofBytes": hex::encode(p.proof_bytes),
            "publicInputs": p.public_inputs.iter().map(hex::encode).collect::<Vec<_>>(),
        }))
    })
}

/// `parseUnshield(owner, amount, fee)` — Kotlin only: the dialog's values, every one computed
/// here; `amount` / `fee` come back as decimal strings (a u64 does not fit a JSON number).
pub fn parse_unshield(owner: &str, amount: &str, fee: &str) -> String {
    envelope(|| {
        unshield::parse_unshield(owner, amount, fee).map(|u| {
            json!({
                "owner": u.owner,
                "ata": u.ata,
                "amount": u.amount.to_string(),
                "fee": u.fee.to_string(),
                "humanAmount": u.human_amount,
                "humanFee": u.human_fee,
                "pool": u.pool,
            })
        })
    })
}

/// `authorizeUnshield(handle, owner, amount, fee) -> authId` (32 lowercase hex) — Kotlin only,
/// on the biometric approval.
pub fn authorize_unshield(core: &Core, h: &str, owner: &str, amount: &str, fee: &str) -> String {
    envelope(|| {
        core.authorize_unshield(handle(h)?, owner, amount, fee)
            .map(|id| json!(hex::encode(id.to_bytes())))
    })
}
```

Apply to `native/noctura-prover/src/a0/state.rs`:

```diff
diff --git a/native/noctura-prover/src/a0/state.rs b/native/noctura-prover/src/a0/state.rs
index ac5bbde..695b666 100644
--- a/native/noctura-prover/src/a0/state.rs
+++ b/native/noctura-prover/src/a0/state.rs
@@ -142,6 +142,65 @@ pub enum A0Error {
     ProofFailed,
     /// `prove`: the proof does not verify against the pinned key's verifying key.
     ProofDoesNotVerify,
+    /// The JNI bridge: an argument that is not in its one form (a handle, a hex value, an authId).
+    Arg { what: &'static str },
+    /// The JNI bridge: an element of an array argument that is not in its one form.
+    ArgItem { what: &'static str, index: usize },
+}
+
+impl A0Error {
+    /// The stable code Kotlin rejects the JS promise with: `E_A0_` + the variant's name in
+    /// SCREAMING_SNAKE (tested against `Debug`). Exhaustive on purpose: a new variant does not
+    /// compile until it has a code.
+    pub fn code(&self) -> &'static str {
+        match self {
+            A0Error::SeedLength { .. } => "E_A0_SEED_LENGTH",
+            A0Error::UnknownHandle => "E_A0_UNKNOWN_HANDLE",
+            A0Error::NonCanonical { .. } => "E_A0_NON_CANONICAL",
+            A0Error::DuplicateRho { .. } => "E_A0_DUPLICATE_RHO",
+            A0Error::StatePoisoned => "E_A0_STATE_POISONED",
+            A0Error::OwnerNotBase58 => "E_A0_OWNER_NOT_BASE58",
+            A0Error::OwnerLength { .. } => "E_A0_OWNER_LENGTH",
+            A0Error::OwnerOffCurve => "E_A0_OWNER_OFF_CURVE",
+            A0Error::OwnerNonCanonical => "E_A0_OWNER_NON_CANONICAL",
+            A0Error::OwnerSmallOrder => "E_A0_OWNER_SMALL_ORDER",
+            A0Error::OwnerTorsion => "E_A0_OWNER_TORSION",
+            A0Error::NoProgramAddress => "E_A0_NO_PROGRAM_ADDRESS",
+            A0Error::NotU64 { .. } => "E_A0_NOT_U64",
+            A0Error::AmountZero => "E_A0_AMOUNT_ZERO",
+            A0Error::FeeAboveCeiling => "E_A0_FEE_ABOVE_CEILING",
+            A0Error::AmountPlusFeeOverflow => "E_A0_AMOUNT_PLUS_FEE_OVERFLOW",
+            A0Error::AuthInFlight => "E_A0_AUTH_IN_FLIGHT",
+            A0Error::AuthAbsent => "E_A0_AUTH_ABSENT",
+            A0Error::AuthMismatch => "E_A0_AUTH_MISMATCH",
+            A0Error::AuthWrongHandle => "E_A0_AUTH_WRONG_HANDLE",
+            A0Error::AuthExpired => "E_A0_AUTH_EXPIRED",
+            A0Error::Rng => "E_A0_RNG",
+            A0Error::Clock => "E_A0_CLOCK",
+            A0Error::CircuitUnknown => "E_A0_CIRCUIT_UNKNOWN",
+            A0Error::CircuitNotInM1 => "E_A0_CIRCUIT_NOT_IN_M1",
+            A0Error::AuthUnexpected => "E_A0_AUTH_UNEXPECTED",
+            A0Error::AuthRecordInconsistent => "E_A0_AUTH_RECORD_INCONSISTENT",
+            A0Error::WitnessJson => "E_A0_WITNESS_JSON",
+            A0Error::WitnessRustFilled { .. } => "E_A0_WITNESS_RUST_FILLED",
+            A0Error::WitnessUnknownKey => "E_A0_WITNESS_UNKNOWN_KEY",
+            A0Error::WitnessDuplicate { .. } => "E_A0_WITNESS_DUPLICATE",
+            A0Error::WitnessMissing { .. } => "E_A0_WITNESS_MISSING",
+            A0Error::WitnessValue { .. } => "E_A0_WITNESS_VALUE",
+            A0Error::WitnessNotInTree => "E_A0_WITNESS_NOT_IN_TREE",
+            A0Error::WithdrawExceedsInput => "E_A0_WITHDRAW_EXCEEDS_INPUT",
+            A0Error::KeyFileRead { .. } => "E_A0_KEY_FILE_READ",
+            A0Error::KeyFilePin { .. } => "E_A0_KEY_FILE_PIN",
+            A0Error::KeyFileFormat { .. } => "E_A0_KEY_FILE_FORMAT",
+            A0Error::CircuitShape => "E_A0_CIRCUIT_SHAPE",
+            A0Error::WitnessRejected => "E_A0_WITNESS_REJECTED",
+            A0Error::PublicInputMismatch => "E_A0_PUBLIC_INPUT_MISMATCH",
+            A0Error::ProofFailed => "E_A0_PROOF_FAILED",
+            A0Error::ProofDoesNotVerify => "E_A0_PROOF_DOES_NOT_VERIFY",
+            A0Error::Arg { .. } => "E_A0_ARG",
+            A0Error::ArgItem { .. } => "E_A0_ARG_ITEM",
+        }
+    }
 }
 
 impl fmt::Display for A0Error {
@@ -226,6 +285,8 @@ impl fmt::Display for A0Error {
             }
             A0Error::ProofFailed => write!(f, "the prover failed"),
             A0Error::ProofDoesNotVerify => write!(f, "the proof does not verify"),
+            A0Error::Arg { what } => write!(f, "argument {what} is malformed"),
+            A0Error::ArgItem { what, index } => write!(f, "argument {what}[{index}] is malformed"),
         }
     }
 }
@@ -464,6 +525,13 @@ impl Core {
         Ok(id)
     }
 
+    /// Drops the live authorization, if any — what the JNI bridge's `prove` does when it refuses
+    /// a malformed handle or `authId` before it reaches [`Core::prove`] (every prove consumes it).
+    pub(crate) fn discard_auth(&self) -> Result<(), A0Error> {
+        self.lock()?.discard_auth();
+        Ok(())
+    }
+
     /// Test-only: the state behind a poisoned lock, to observe what the poison path left.
     #[cfg(test)]
     pub(crate) fn lock_ignoring_poison_for_test(&self) -> MutexGuard<'_, Inner> {
```

Apply to `native/noctura-prover/src/android.rs`:

```diff
diff --git a/native/noctura-prover/src/android.rs b/native/noctura-prover/src/android.rs
index b70efcf..897530b 100644
--- a/native/noctura-prover/src/android.rs
+++ b/native/noctura-prover/src/android.rs
@@ -1,10 +1,25 @@
 //! Pure-Rust JNI bridge for the Android `NocturaProver` native module. No C++ glue,
 //! no libc++_shared → the blst-style libc++ startup conflict does not apply.
-//! Symbols match `com.nocturawallet.prover.NocturaProverModule`'s `external fun`s.
+//!
+//! Two Kotlin classes bind here, and `jni-exports.txt` lists every symbol (the export check
+//! compares it with the built library's dynamic symbols):
+//! - `com.nocturawallet.prover.NocturaProverModule` — `nativeIsSupported`, and the v1
+//!   `nativeProve` (removed with the v1 path in M1b);
+//! - `com.nocturawallet.prover.NocturaA0Native` — the A0 surface (spec §3): `keysOpen`,
+//!   `keysClose`, `depositRho`, `matchSpent`, `commitment`, `prove`, and the Kotlin-only
+//!   `parseUnshield` / `authorizeUnshield`. Each is marshalling only: the logic, the envelope
+//!   and the refusals are `a0::bridge`'s, tested on the desktop. Built for the host too with
+//!   `--features jni-host`, so the Kotlin JVM test can call these exact symbols.
+//!
+//! No call panics into the JVM: a JNI failure (a string that cannot be read, a pending
+//! exception) is cleared and reported as `E_A0_ARG` in the envelope; a result string that cannot
+//! be built returns `null`, which Kotlin reports as `E_A0_INTERNAL`.
 
-use jni::objects::{JClass, JString};
+use crate::a0::{bridge, A0Error, CORE};
+use jni::objects::{JByteArray, JClass, JObject, JObjectArray, JString};
 use jni::sys::{jboolean, jstring, JNI_TRUE};
 use jni::JNIEnv;
+use zeroize::Zeroizing;
 
 #[no_mangle]
 pub extern "system" fn Java_com_nocturawallet_prover_NocturaProverModule_nativeIsSupported(
@@ -14,6 +29,7 @@ pub extern "system" fn Java_com_nocturawallet_prover_NocturaProverModule_nativeI
     JNI_TRUE
 }
 
+/// v1 prove (the NPkc pool's circuits) — unchanged; M1b removes it with the v1 path.
 #[no_mangle]
 pub extern "system" fn Java_com_nocturawallet_prover_NocturaProverModule_nativeProve<'a>(
     mut env: JNIEnv<'a>,
@@ -42,3 +58,220 @@ pub extern "system" fn Java_com_nocturawallet_prover_NocturaProverModule_nativeP
         .expect("failed to build result jstring")
         .into_raw()
 }
+
+// ------------------------------------------------------------------------- the A0 surface
+
+/// The envelope string as a Java string, or `null` if it cannot be built.
+fn out(env: &mut JNIEnv, json: String) -> jstring {
+    let _ = env.exception_clear();
+    match env.new_string(json) {
+        Ok(s) => s.into_raw(),
+        Err(_) => {
+            let _ = env.exception_clear();
+            std::ptr::null_mut()
+        }
+    }
+}
+
+/// The envelope of a JNI failure while reading the arguments.
+fn jni_arg() -> String {
+    bridge::envelope(|| Err(A0Error::Arg { what: "jni" }))
+}
+
+fn string(env: &mut JNIEnv, s: &JString) -> Option<String> {
+    env.get_string(s).ok().map(Into::into)
+}
+
+/// A nullable Java string: `Some(None)` for `null`.
+fn opt_string(env: &mut JNIEnv, s: &JString) -> Option<Option<String>> {
+    if s.is_null() {
+        Some(None)
+    } else {
+        string(env, s).map(Some)
+    }
+}
+
+fn strings(env: &mut JNIEnv, arr: &JObjectArray) -> Option<Vec<String>> {
+    let n = env.get_array_length(arr).ok()?;
+    let mut out = Vec::with_capacity(usize::try_from(n).ok()?);
+    for i in 0..n {
+        let item: JObject = env.get_object_array_element(arr, i).ok()?;
+        let s = string(env, &JString::from(item))?;
+        out.push(s);
+    }
+    Some(out)
+}
+
+/// Runs `f` on the arguments `read` took from the JVM, or reports the JNI failure.
+fn call<T>(
+    env: &mut JNIEnv,
+    read: impl FnOnce(&mut JNIEnv) -> Option<T>,
+    f: impl FnOnce(T) -> String,
+) -> jstring {
+    let json = match read(env) {
+        Some(args) => f(args),
+        None => jni_arg(),
+    };
+    out(env, json)
+}
+
+/// `keysOpen(seed: ByteArray): String?` — the seed is copied once, into a buffer that is wiped
+/// when this returns (`bridge::keys_open` wipes it first); Kotlin wipes its own array.
+#[no_mangle]
+pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_keysOpen<'a>(
+    mut env: JNIEnv<'a>,
+    _class: JClass<'a>,
+    seed: JByteArray<'a>,
+) -> jstring {
+    call(
+        &mut env,
+        |env| env.convert_byte_array(&seed).ok().map(Zeroizing::new),
+        |mut seed| bridge::keys_open(&CORE, &mut seed),
+    )
+}
+
+#[no_mangle]
+pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_keysClose<'a>(
+    mut env: JNIEnv<'a>,
+    _class: JClass<'a>,
+    handle: JString<'a>,
+) -> jstring {
+    call(
+        &mut env,
+        |env| string(env, &handle),
+        |h| bridge::keys_close(&CORE, &h),
+    )
+}
+
+#[no_mangle]
+pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_depositRho<'a>(
+    mut env: JNIEnv<'a>,
+    _class: JClass<'a>,
+    handle: JString<'a>,
+    deposit_index: JString<'a>,
+) -> jstring {
+    call(
+        &mut env,
+        |env| Some((string(env, &handle)?, string(env, &deposit_index)?)),
+        |(h, i)| bridge::deposit_rho(&CORE, &h, &i),
+    )
+}
+
+#[no_mangle]
+pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_matchSpent<'a>(
+    mut env: JNIEnv<'a>,
+    _class: JClass<'a>,
+    handle: JString<'a>,
+    chain_nullifiers: JObjectArray<'a>,
+    own_rhos: JObjectArray<'a>,
+) -> jstring {
+    call(
+        &mut env,
+        |env| {
+            Some((
+                string(env, &handle)?,
+                strings(env, &chain_nullifiers)?,
+                strings(env, &own_rhos)?,
+            ))
+        },
+        |(h, chain, own)| bridge::match_spent(&CORE, &h, &chain, &own),
+    )
+}
+
+#[no_mangle]
+pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_commitment<'a>(
+    mut env: JNIEnv<'a>,
+    _class: JClass<'a>,
+    handle: JString<'a>,
+    amount: JString<'a>,
+    rho: JString<'a>,
+) -> jstring {
+    call(
+        &mut env,
+        |env| {
+            Some((
+                string(env, &handle)?,
+                string(env, &amount)?,
+                string(env, &rho)?,
+            ))
+        },
+        |(h, a, r)| bridge::commitment(&CORE, &h, &a, &r),
+    )
+}
+
+/// `prove(...)` — called on Kotlin's proving thread; takes the state lock only to complete the
+/// witness, so `keysClose` / `authorizeUnshield` never wait for a proof.
+#[no_mangle]
+pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_prove<'a>(
+    mut env: JNIEnv<'a>,
+    _class: JClass<'a>,
+    handle: JString<'a>,
+    circuit: JString<'a>,
+    witness_json: JString<'a>,
+    auth_id: JString<'a>,
+    zkey_path: JString<'a>,
+    wasm_path: JString<'a>,
+) -> jstring {
+    // The witness carries private note data (m4): its Java-side copy is the caller's; this copy
+    // is a Zeroizing buffer.
+    call(
+        &mut env,
+        |env| {
+            Some((
+                string(env, &handle)?,
+                string(env, &circuit)?,
+                Zeroizing::new(string(env, &witness_json)?),
+                opt_string(env, &auth_id)?,
+                string(env, &zkey_path)?,
+                string(env, &wasm_path)?,
+            ))
+        },
+        |(h, c, w, a, z, wp)| bridge::prove(&CORE, &h, &c, &w, a.as_deref(), &z, &wp),
+    )
+}
+
+/// Kotlin only (the M1c dialog) — never bound in the React module.
+#[no_mangle]
+pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_parseUnshield<'a>(
+    mut env: JNIEnv<'a>,
+    _class: JClass<'a>,
+    owner: JString<'a>,
+    amount: JString<'a>,
+    fee: JString<'a>,
+) -> jstring {
+    call(
+        &mut env,
+        |env| {
+            Some((
+                string(env, &owner)?,
+                string(env, &amount)?,
+                string(env, &fee)?,
+            ))
+        },
+        |(o, a, f)| bridge::parse_unshield(&o, &a, &f),
+    )
+}
+
+/// Kotlin only (the M1c dialog, on the biometric approval) — never bound in the React module.
+#[no_mangle]
+pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_authorizeUnshield<'a>(
+    mut env: JNIEnv<'a>,
+    _class: JClass<'a>,
+    handle: JString<'a>,
+    owner: JString<'a>,
+    amount: JString<'a>,
+    fee: JString<'a>,
+) -> jstring {
+    call(
+        &mut env,
+        |env| {
+            Some((
+                string(env, &handle)?,
+                string(env, &owner)?,
+                string(env, &amount)?,
+                string(env, &fee)?,
+            ))
+        },
+        |(h, o, a, f)| bridge::authorize_unshield(&CORE, &h, &o, &a, &f),
+    )
+}
```

Apply to `native/noctura-prover/src/lib.rs`:

```diff
diff --git a/native/noctura-prover/src/lib.rs b/native/noctura-prover/src/lib.rs
index c0fde5d..c541b22 100644
--- a/native/noctura-prover/src/lib.rs
+++ b/native/noctura-prover/src/lib.rs
@@ -8,5 +8,24 @@ pub mod proof_bytes;
 pub mod prover;
 pub mod witness_wasmi;
 
-#[cfg(target_os = "android")]
+// The JNI symbols: on Android, and on the host with `--features jni-host` (the Kotlin JVM test
+// loads that build to call the same symbols the app does).
+#[cfg(any(target_os = "android", feature = "jni-host"))]
 mod android;
+
+// The HOST jni-host build only (never Android, never the app): wasmer-vm — linked through
+// ark-circom, never called (witnesses run in wasmi) — exports `wasmer_vm_probestack`, the
+// address of `__rust_probestack`, a symbol current Rust no longer provides on x86_64. The
+// JVM's dlopen must resolve that data relocation, so the test library would not load. A bare
+// `ret` keeps the symbol defined; nothing in this crate reaches it. aarch64 has no probestack.
+#[cfg(all(
+    feature = "jni-host",
+    target_arch = "x86_64",
+    not(target_os = "android")
+))]
+std::arch::global_asm!(
+    ".globl __rust_probestack",
+    ".type __rust_probestack, @function",
+    "__rust_probestack:",
+    "ret"
+);
```

Apply to `native/noctura-prover/Cargo.toml`:

```diff
diff --git a/native/noctura-prover/Cargo.toml b/native/noctura-prover/Cargo.toml
index 905de1c..ee87bd9 100644
--- a/native/noctura-prover/Cargo.toml
+++ b/native/noctura-prover/Cargo.toml
@@ -60,6 +60,16 @@ serde = "1"
 [target.'cfg(target_os = "android")'.dependencies]
 jni = "0.21"
 
+# The same JNI symbols on the host, for the Kotlin JVM test (android/app/src/test/…/A0JniTest.kt)
+# and the export check (check-jni-exports.sh): `cargo build --release --features jni-host`.
+# Not used by the app; jni is already in the lock.
+[dependencies.jni]
+version = "0.21"
+optional = true
+
+[features]
+jni-host = ["dep:jni"]
+
 # CLOCK_BOOTTIME for the 120 s authorization window (counts time the phone is suspended);
 # Rust bindings only, already in the lock.
 [target.'cfg(any(target_os = "linux", target_os = "android"))'.dependencies]
```

Create `native/noctura-prover/jni-exports.txt`:

```text
# Every JNI symbol libnoctura_prover.so exports — exactly these, no more (spec §3 "JNI surface",
# §14 "a JNI surface test that the .so exports exactly §3's functions"). check-jni-exports.sh
# compares this list with the library's dynamic symbols; android/app's A0 boundary tests compare
# it with the Kotlin `external fun`s. Sorted; `#` lines and blank lines are ignored.
#
# The A0 surface (NocturaA0Native). parseUnshield / authorizeUnshield are bound in Kotlin only,
# never as React methods (their dialog is M1c's).
Java_com_nocturawallet_prover_NocturaA0Native_authorizeUnshield
Java_com_nocturawallet_prover_NocturaA0Native_commitment
Java_com_nocturawallet_prover_NocturaA0Native_depositRho
Java_com_nocturawallet_prover_NocturaA0Native_keysClose
Java_com_nocturawallet_prover_NocturaA0Native_keysOpen
Java_com_nocturawallet_prover_NocturaA0Native_matchSpent
Java_com_nocturawallet_prover_NocturaA0Native_parseUnshield
Java_com_nocturawallet_prover_NocturaA0Native_prove
# isSupported, and the v1 prove — nativeProve goes with the v1 path in M1b.
Java_com_nocturawallet_prover_NocturaProverModule_nativeIsSupported
Java_com_nocturawallet_prover_NocturaProverModule_nativeProve
```

Create `native/noctura-prover/check-jni-exports.sh`:

```bash
#!/usr/bin/env bash
# The JNI export check (spec §14 "Boundary"): the Java_* symbols a built libnoctura_prover.so
# exports must be exactly jni-exports.txt — no missing one, no extra one. Works on the arm64
# library (`cargo ndk -t arm64-v8a build --release`) and on the host one (`cargo build --release
# --features jni-host`): the same #[no_mangle] functions are exported by both.
#
#   ./check-jni-exports.sh <path/to/libnoctura_prover.so> [expected-list]
#
# Reads the dynamic symbol table with `nm -D --defined-only` (binutils or llvm-nm; both read a
# foreign-architecture ELF). Exit 0 = exact match; 1 = a difference (printed); 2 = usage / no
# symbols read at all (an empty read is a failure, never a vacuous pass).
set -euo pipefail
so="${1:?usage: $0 <libnoctura_prover.so> [expected-list]}"
list="${2:-$(dirname "$0")/jni-exports.txt}"
nm_bin="${NM:-nm}"
[ -f "$so" ] || { echo "no such library: $so" >&2; exit 2; }
want=$(grep -vE '^\s*(#|$)' "$list" | sort -u)
got=$("$nm_bin" -D --defined-only "$so" | awk '{print $NF}' | grep -E '^Java_' | sort -u || true)
[ -n "$want" ] || { echo "the expected list $list is empty" >&2; exit 2; }
[ -n "$got" ] || { echo "no Java_* symbols read from $so — wrong file or nm failed" >&2; exit 2; }
if [ "$want" != "$got" ]; then
  echo "JNI exports of $so differ from $list:" >&2
  diff <(echo "$want") <(echo "$got") | sed -n 's/^< /  missing: /p; s/^> /  extra:   /p' >&2
  exit 1
fi
echo "JNI exports match $list: $(echo "$got" | wc -l) symbols"
```

```bash
chmod +x native/noctura-prover/check-jni-exports.sh
cd native/noctura-prover && cargo fetch && git diff --stat Cargo.lock   # prints nothing: jni is already locked
```

**Why a host `jni-host` build:** it compiles the same `#[no_mangle]` functions for x86_64 so (a) CI can read the exported symbols without an NDK, and (b) the Kotlin JVM test can call the real JNI through the real Kotlin object (`A0JniTest`, Step 6). **Why the `__rust_probestack` stub:** measured — without it the JVM's `System.loadLibrary` failed with `UnsatisfiedLinkError: …/libnoctura_prover.so: undefined symbol: __rust_probestack` (wasmer-vm, linked through ark-circom and never called, exports `wasmer_vm_probestack` = that symbol's address; current Rust no longer defines it on x86_64). `nm -D --undefined-only` on the arm64 library lists no `probestack` symbol: the Android build is untouched, and the stub is compiled only for `jni-host` on x86_64.

- [ ] **Step 4: Rust green; the crate's gate (both feature sets).**

```bash
cd native/noctura-prover
cargo fmt --check && echo FMT_OK
cargo clippy --all-targets --locked -- -D warnings 2>&1 | tail -1
cargo clippy --all-targets --locked --features jni-host -- -D warnings 2>&1 | tail -1
cargo test --locked 2>&1 | grep -E "test result|A0-KEYS-SKIPPED" | sed 's/: NOCTURA.*//'
NOCTURA_A0_KEYS_DIR=<program side>/zk/keys/v2 cargo test --locked 2>&1 | grep -E "test result|SKIPPED"
```

Expected:

```
FMT_OK
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.95s
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.20s
A0-KEYS-SKIPPED keyed_bridge_withdraw_change_carries_the_approved_values_and_is_the_one_nullifier_exit
A0-KEYS-SKIPPED keyed_a_deposit_proof_verifies_against_the_deployed_vk_with_the_desk_values
A0-KEYS-SKIPPED keyed_the_signal_tables_are_the_circuits_inputs_and_their_counts
A0-KEYS-SKIPPED keyed_the_vk_fixtures_are_the_pinned_zkeys_own_verifying_keys
A0-KEYS-SKIPPED keyed_withdraw_change_proofs_verify_against_the_deployed_vk
A0-KEYS-SKIPPED keyed_two_proofs_of_one_witness_differ_and_both_verify
A0-KEYS-SKIPPED keyed_a_one_byte_changed_or_swapped_key_file_is_refused
A0-KEYS-SKIPPED keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped
test result: ok. 97 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.49s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.18s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 97 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 17.63s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.64s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

97 = Task 3's 87 + this task's 10 (`a0::tests_bridge`, all 10 `... ok`); the keyed one ran in 5.98 s alone. The unit order of the skip lines varies between runs.

- [ ] **Step 5: The Kotlin tests — red.**

Create `android/app/src/test/java/com/nocturawallet/prover/ReactSurfaceTest.kt`:

```kotlin
package com.nocturawallet.prover

import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.lang.reflect.Modifier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The boundary between JS and native, read off the compiled classes (spec §3 "JNI surface",
 * §14 "the React Native module exposes all of them except parseUnshield and authorizeUnshield"):
 * React Native reaches a legacy module only through its @ReactMethod methods, so that set IS
 * what JS can call. The natives must be exactly native/noctura-prover/jni-exports.txt, which
 * check-jni-exports.sh holds to the built library's symbols.
 */
class ReactSurfaceTest {
    private fun reactMethods(c: Class<*>): Set<String> =
        c.declaredMethods.filter { it.isAnnotationPresent(ReactMethod::class.java) }.map { it.name }.toSet()

    private val expected = setOf(
        "isSupported",
        "proveV1", // v1 (the NPkc pool) — removed with the v1 path in M1b
        "keysOpen",
        "keysClose",
        "depositRho",
        "matchSpent",
        "commitment",
        "prove",
    )

    @Test
    fun theReactModuleExposesExactlyTheBoundSurface() {
        assertEquals(expected, reactMethods(NocturaProverModule::class.java))
    }

    @Test
    fun parseUnshieldAndAuthorizeUnshieldAreBoundInKotlinButNotReactMethods() {
        for (name in listOf("parseUnshield", "authorizeUnshield")) {
            // `internal` members compile to `name$<module>`.
            val ms = NocturaProverModule::class.java.declaredMethods
                .filter { it.name == name || it.name.startsWith("$name$") }
            assertTrue("$name is not bound in Kotlin", ms.isNotEmpty())
            for (m in ms) assertFalse("$name is a React method", m.isAnnotationPresent(ReactMethod::class.java))
        }
    }

    /** A class that annotated parseUnshield: the same reading sees it (the check can fail). */
    @Suppress("unused")
    private class Leaky {
        @ReactMethod fun parseUnshield() {}
        fun helper() {}
    }

    @Test
    fun theReadingSeesAnAnnotatedMethodNegativeControl() {
        assertEquals(setOf("parseUnshield"), reactMethods(Leaky::class.java))
        assertNotEquals(expected, reactMethods(Leaky::class.java) + expected - "prove")
    }

    @Test
    fun theKotlinNativesAreExactlyTheJniExportList() {
        val natives = listOf(NocturaA0Native::class.java, NocturaProverModule::class.java)
            .flatMap { c -> c.declaredMethods.filter { Modifier.isNative(it.modifiers) } }
            .map { "Java_" + it.declaringClass.name.replace('.', '_') + "_" + it.name }
            .toSet()
        val list = File("../../native/noctura-prover/jni-exports.txt").readLines()
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.startsWith("#") }
            .toSet()
        assertEquals(10, list.size)
        assertEquals(list, natives)
        // every A0 native is static (an `object` with @JvmStatic): the symbol takes a jclass
        for (m in NocturaA0Native::class.java.declaredMethods.filter { Modifier.isNative(it.modifiers) }) {
            assertTrue(m.name, Modifier.isStatic(m.modifiers))
        }
    }
}
```

Create `android/app/src/test/java/com/nocturawallet/prover/A0SeedTest.kt`:

```kotlin
package com.nocturawallet.prover

import com.facebook.react.bridge.JavaOnlyArray
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/** The seed crosses as bytes (spec §3, C3): Kotlin's ByteArray is zero-filled when the call returns. */
class A0SeedTest {
    private val values = (0 until 64).map { (it * 37 + 11) % 256 }

    @Test
    fun theByteArrayHoldsTheSeedDuringTheCallAndZerosAfterIt() {
        var seen: ByteArray? = null
        var atCall: ByteArray? = null
        val r = A0Seed.use(JavaOnlyArray.from(values)) { b ->
            seen = b
            atCall = b.copyOf()
            "done"
        }
        assertEquals("done", r)
        assertArrayEquals(values.map { it.toByte() }.toByteArray(), atCall)
        assertTrue("not zero-filled", seen!!.all { it == 0.toByte() })
    }

    @Test
    fun andAfterACallThatThrows() {
        var seen: ByteArray? = null
        assertThrows(IllegalStateException::class.java) {
            A0Seed.use(JavaOnlyArray.from(values)) { b ->
                seen = b
                throw IllegalStateException("native failed")
            }
        }
        assertEquals(64, seen!!.size)
        assertTrue("not zero-filled", seen!!.all { it == 0.toByte() })
    }

    @Test
    fun anythingButAByteValueIsRefusedBeforeTheCall() {
        val bad = listOf(
            JavaOnlyArray.of(1.5),
            JavaOnlyArray.of(-1),
            JavaOnlyArray.of(256),
            JavaOnlyArray.of("1"),
            JavaOnlyArray.of(null),
            JavaOnlyArray.of(true),
            JavaOnlyArray.of(Double.NaN),
        )
        for (arr in bad) {
            var called = false
            val e = assertThrows(A0ArgException::class.java) { A0Seed.use(arr) { called = true } }
            assertEquals("argument seed is malformed", e.message)
            assertTrue(!called)
        }
        // positive control: the edges 0 and 255 pass
        A0Seed.use(JavaOnlyArray.of(0, 255)) { b -> assertArrayEquals(byteArrayOf(0, -1), b) }
    }

    @Test
    fun stringArraysTakeStringsOnly() {
        assertArrayEquals(arrayOf("a", "b"), A0Args.strings(JavaOnlyArray.of("a", "b"), "ownRhos"))
        val e = assertThrows(A0ArgException::class.java) { A0Args.strings(JavaOnlyArray.of("a", 1), "ownRhos") }
        assertEquals("argument ownRhos[1] is malformed", e.message)
    }
}
```

Create `android/app/src/test/java/com/nocturawallet/prover/A0ResultTest.kt`:

```kotlin
package com.nocturawallet.prover

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** The envelope Rust returns (a0::bridge) and the proving thread. */
class A0ResultTest {
    @Test
    fun okValuesComeThrough() {
        assertEquals(A0Result.Ok("12"), A0Result.parse("""{"ok":"12"}"""))
        val nul = A0Result.parse("""{"ok":null}""") as A0Result.Ok
        assertEquals(JSONObject.NULL, nul.value)
        val arr = (A0Result.parse("""{"ok":[0,2]}""") as A0Result.Ok).value as JSONArray
        assertEquals(listOf(0, 2), (0 until arr.length()).map { arr.getInt(it) })
        val obj = (A0Result.parse("""{"ok":{"proofBytes":"ab","publicInputs":["01"]}}""") as A0Result.Ok).value
        assertTrue(obj is JSONObject)
    }

    @Test
    fun errorsKeepTheirCodeAndMessage() {
        assertEquals(
            A0Result.Err("E_A0_AUTH_ABSENT", "no live unshield authorization"),
            A0Result.parse("""{"error":"E_A0_AUTH_ABSENT","message":"no live unshield authorization"}"""),
        )
    }

    @Test
    fun aMissingOrUnreadableResultIsInternal() {
        for (bad in listOf(null, "", "nope", "{}", """{"error":7}""", "[]")) {
            val r = A0Result.parse(bad)
            assertTrue("$bad → $r", r is A0Result.Err && r.code == A0Result.INTERNAL)
        }
        assertEquals("E_A0_INTERNAL", A0Result.INTERNAL)
    }

    @Test
    fun proveRunsOnItsOwnThreadNotTheCallers() {
        val latch = CountDownLatch(1)
        var name: String? = null
        A0Prover.submit {
            name = Thread.currentThread().name
            latch.countDown()
        }
        assertTrue(latch.await(10, TimeUnit.SECONDS))
        assertEquals(A0Prover.THREAD_NAME, name)
        assertTrue(name != Thread.currentThread().name)
    }
}
```

Create `android/app/src/test/java/com/nocturawallet/prover/A0JniTest.kt`:

```kotlin
package com.nocturawallet.prover

import com.facebook.react.bridge.JavaOnlyArray
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test

/**
 * The real JNI: Kotlin's NocturaA0Native over the host build of libnoctura_prover.so
 * (`cargo build --release --features jni-host` — the same #[no_mangle] functions the arm64
 * library exports). NOCTURA_A0_HOST_LIB_DIR names the directory holding it; without it these
 * tests are SKIPPED, loudly (`A0-JNI-SKIPPED` on stderr), and under CI they fail instead.
 *
 * Expected values: the offline fixtures under native/noctura-prover/tests/fixtures (written by
 * scripts/a0-vectors/, never by the code under test).
 */
class A0JniTest {
    private val fixtures = File("../../native/noctura-prover/tests/fixtures")
    private val keys = JSONObject(File(fixtures, "a0-key-vectors.json").readText())
    private val proves = JSONObject(File(fixtures, "a0-prove-vectors.json").readText())
    private val seed = keys.getJSONArray("seeds").getJSONObject(0)
    private val notes = seed.getJSONArray("notes")
    private val noFile = "/nonexistent/never-read"

    @Before
    fun loadTheHostLibrary() {
        val dir = System.getenv("NOCTURA_A0_HOST_LIB_DIR")
        if (dir == null) {
            check(System.getenv("CI") == null) { "CI must provide NOCTURA_A0_HOST_LIB_DIR — refusing to skip" }
            System.err.println("A0-JNI-SKIPPED ${javaClass.simpleName}: NOCTURA_A0_HOST_LIB_DIR is not set — the JNI tests did NOT run")
        }
        assumeTrue(dir != null)
        NocturaNativeLib.ensureLoaded()
    }

    private fun ok(json: String?): Any? {
        val r = A0Result.parse(json)
        check(r is A0Result.Ok) { "expected ok, got $json" }
        return r.value
    }
    private fun code(json: String?): String {
        val r = A0Result.parse(json)
        check(r is A0Result.Err) { "expected an error, got $json" }
        return r.code
    }
    private fun seedArray(): JavaOnlyArray {
        val hex = seed.getString("seed")
        return JavaOnlyArray.from((0 until hex.length / 2).map { hex.substring(2 * it, 2 * it + 2).toInt(16) })
    }
    private fun open(): String {
        var copy: ByteArray? = null
        val out = A0Seed.use(seedArray()) { b ->
            copy = b
            NocturaA0Native.keysOpen(b)
        }
        assertTrue("Kotlin's seed copy was not zero-filled", copy!!.all { it == 0.toByte() })
        return ok(out) as String
    }
    private fun withdraw() = proves.getJSONArray("scenarios").getJSONObject(1)
    private fun authorize(h: String): String {
        val a = withdraw().getJSONObject("authorization")
        return ok(NocturaA0Native.authorizeUnshield(h, a.getString("owner"), a.getString("amount"), a.getString("fee"))) as String
    }
    private fun prove(h: String, authId: String?): String? =
        NocturaA0Native.prove(h, "withdraw_change", withdraw().getJSONObject("witness").toString(), authId, noFile, noFile)

    @Test
    fun theBoundCallsReturnTheFixturesPublicValuesThroughTheJni() {
        val h = open()
        assertTrue(h.matches(Regex("[1-9][0-9]*")))
        val n0 = notes.getJSONObject(0)
        val n1 = notes.getJSONObject(1)
        assertEquals(n0.getString("rho"), ok(NocturaA0Native.depositRho(h, "0")))
        val c = n0.getJSONArray("commitments").getJSONObject(2)
        assertEquals(c.getString("commitment"), ok(NocturaA0Native.commitment(h, c.getString("amount"), n0.getString("rho"))))
        val spent = ok(NocturaA0Native.matchSpent(h, arrayOf(n1.getString("nullifier")), arrayOf(n0.getString("rho"), n1.getString("rho")))) as JSONArray
        assertEquals("[1]", spent.toString())
        assertEquals("E_A0_ARG", code(NocturaA0Native.depositRho("01", "0")))
        assertEquals(JSONObject.NULL, ok(NocturaA0Native.keysClose(h)))
        assertEquals("E_A0_UNKNOWN_HANDLE", code(NocturaA0Native.depositRho(h, "0")))
        val bad = A0Seed.use(JavaOnlyArray.of(1, 2, 3)) { NocturaA0Native.keysOpen(it) }
        assertEquals("E_A0_SEED_LENGTH", code(bad))
    }

    @Test
    fun invAuthAWithdrawChangeProveThroughTheJniNeedsTheApproval() {
        val h = open()
        assertEquals("E_A0_AUTH_ABSENT", code(prove(h, null)))
        authorize(h)
        assertEquals("E_A0_AUTH_MISMATCH", code(prove(h, "00".repeat(16))))
        authorize(h)
        assertEquals("E_A0_ARG", code(prove(h, "not-an-auth-id")))
        val id = authorize(h)
        assertEquals("E_A0_AUTH_ABSENT", code(prove(h, null)))
        assertEquals("E_A0_AUTH_ABSENT", code(prove(h, id)))
        // positive control: an approval gets through, to the (absent) key file — once
        val id2 = authorize(h)
        assertEquals("E_A0_KEY_FILE_READ", code(prove(h, id2)))
        assertEquals("E_A0_AUTH_ABSENT", code(prove(h, id2)))
        NocturaA0Native.keysClose(h)
    }

    @Test
    fun invNkAndInvNullNoJniOutputCarriesASecretOrAnOwnNullifier() {
        val forbidden = mutableListOf<String>()
        for (k in listOf("seed", "sk", "viewKey", "nk", "ivk", "dSelf", "addrSelf")) forbidden += seed.getString(k)
        val rhos = mutableListOf<String>()
        val nfs = mutableListOf<String>()
        for (i in 0 until notes.length()) {
            rhos += notes.getJSONObject(i).getString("rho")
            nfs += notes.getJSONObject(i).getString("nullifier")
            forbidden += notes.getJSONObject(i).getString("nullifier")
            forbidden += notes.getJSONObject(i).getString("rhoChange")
        }
        val h = open()
        val a = withdraw().getJSONObject("authorization")
        val outputs = mutableListOf<String?>()
        for (i in 0 until notes.length()) outputs += NocturaA0Native.depositRho(h, notes.getJSONObject(i).getString("depositIndex"))
        outputs += NocturaA0Native.commitment(h, "1000000000", rhos[1])
        outputs += NocturaA0Native.matchSpent(h, nfs.toTypedArray(), rhos.toTypedArray())
        outputs += NocturaA0Native.matchSpent(h, rhos.toTypedArray(), rhos.toTypedArray())
        outputs += NocturaA0Native.parseUnshield(a.getString("owner"), a.getString("amount"), a.getString("fee"))
        val id = authorize(h)
        outputs += id
        outputs += prove(h, id)
        outputs += prove(h, null)
        outputs += NocturaA0Native.prove(h, "deposit", proves.getJSONArray("scenarios").getJSONObject(0).getJSONObject("witness").toString(), null, noFile, noFile)
        outputs += NocturaA0Native.keysClose(h)
        assertTrue(outputs.size > 12)
        for (out in outputs) {
            for (f in forbidden) {
                assertTrue("$out carries a secret or an own nullifier", !out!!.lowercase().contains(f))
            }
        }
        // positive control: matchSpent did see the nullifiers (it returned every index)
        assertEquals((0 until notes.length()).toList().toString().replace(" ", ""), (ok(NocturaA0Native.run {
            val h2 = open()
            matchSpent(h2, nfs.toTypedArray(), rhos.toTypedArray())
        }) as JSONArray).toString())
    }
}
```

Apply to `android/app/build.gradle`:

```diff
diff --git a/android/app/build.gradle b/android/app/build.gradle
index b920b0d..d8cf237 100644
--- a/android/app/build.gradle
+++ b/android/app/build.gradle
@@ -146,6 +146,20 @@ android {
     //         path "src/main/cpp/CMakeLists.txt"
     //     }
     // }
+    testOptions {
+        unitTests.all { test ->
+            // A0JniTest loads the HOST build of libnoctura_prover.so (`cargo build --release
+            // --features jni-host`) from this directory; without it those tests skip, loudly.
+            def hostLib = System.getenv("NOCTURA_A0_HOST_LIB_DIR")
+            if (hostLib) {
+                test.systemProperty "java.library.path", hostLib
+            }
+            test.testLogging {
+                events "passed", "skipped", "failed"
+                showStandardStreams = true
+            }
+        }
+    }
     packagingOptions {
         jniLibs {
             // Exclude any stale libnoctura_key.so from build intermediates so the
@@ -198,6 +212,11 @@ dependencies {
     } else {
         implementation jscFlavor
     }
+
+    // JVM unit tests of the prover module (src/test/): the A0 boundary, the seed zero-fill and
+    // the JNI over the host library. org.json: android.jar's copy is a stub off the device.
+    testImplementation("junit:junit:4.13.2")
+    testImplementation("org.json:json:20260814")
 }
 
 
```

```bash
cd android && ENVFILE=.env.devnet ANDROID_HOME=~/Android/Sdk ./gradlew :app:testDebugUnitTest --console=plain 2>&1 | grep -E "^e: |FAILED" | head -4
```

Expected (97 `e:` lines in all):

```
> Task :app:compileDebugUnitTestKotlin FAILED
e: android/app/src/test/java/com/nocturawallet/prover/A0JniTest.kt:38:9 Unresolved reference 'NocturaNativeLib'.
e: android/app/src/test/java/com/nocturawallet/prover/A0JniTest.kt:42:17 Unresolved reference 'A0Result'.
e: android/app/src/test/java/com/nocturawallet/prover/A0JniTest.kt:43:20 Unresolved reference 'A0Result'.
```

(paths shortened from `file:///…/`). **`testDebugUnitTest`, not `testReleaseUnitTest`:** the release unit-test task depends on `createBundleReleaseJsAndAssets` (Metro), which a test run does not need.

- [ ] **Step 6: Implement the Kotlin side; green, without and with the host library.**

Create `android/app/src/main/java/com/nocturawallet/prover/NocturaA0Native.kt`:

```kotlin
package com.nocturawallet.prover

/**
 * The A0 JNI surface of `libnoctura_prover.so` (spec 2026-11-08 shielded A0 M1 §3), one static
 * native per Rust export (`native/noctura-prover/src/android.rs`; the list is
 * `native/noctura-prover/jni-exports.txt`, held to the library by `check-jni-exports.sh` and to
 * this object by `ReactSurfaceTest`).
 *
 * Every call returns the envelope JSON of `a0::bridge` (`{"ok": …}` or `{"error": "E_A0_…",
 * "message": …}`; [A0Result.parse]) or null if Rust could not build a string. Handles, amounts
 * and indices are decimal strings; `rho`, nullifiers and commitments 64 lowercase hex; an
 * `authId` 32 lowercase hex. Nothing returned is `sk`, `nk`, `ivk`, `d_self` or `addrField`,
 * and an own note's nullifier comes back only as public input [1] of a withdraw_change proof.
 *
 * `internal`: reached only through [NocturaProverModule] — its @ReactMethods for JS, and its
 * Kotlin-only `parseUnshield` / `authorizeUnshield` (the M1c dialog). Call
 * [NocturaNativeLib.ensureLoaded] first.
 */
internal object NocturaA0Native {
    /** The seed bytes are copied once into a buffer Rust wipes; the caller wipes this array. */
    @JvmStatic external fun keysOpen(seed: ByteArray): String?

    @JvmStatic external fun keysClose(handle: String): String?

    @JvmStatic external fun depositRho(handle: String, depositIndex: String): String?

    @JvmStatic external fun matchSpent(handle: String, chainNullifiers: Array<String>, ownRhos: Array<String>): String?

    @JvmStatic external fun commitment(handle: String, amount: String, rho: String): String?

    /** Seconds: call on [A0Prover]'s thread only. `witnessJson` carries private note data — never log it. */
    @JvmStatic external fun prove(
        handle: String,
        circuit: String,
        witnessJson: String,
        authId: String?,
        zkeyPath: String,
        wasmPath: String,
    ): String?

    /** Kotlin only (the native confirmation dialog, M1c). */
    @JvmStatic external fun parseUnshield(owner: String, amount: String, fee: String): String?

    /** Kotlin only: on the biometric approval, never on a JS request. */
    @JvmStatic external fun authorizeUnshield(handle: String, owner: String, amount: String, fee: String): String?
}
```

Create `android/app/src/main/java/com/nocturawallet/prover/A0Bridge.kt`:

```kotlin
package com.nocturawallet.prover

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableType
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * Loads `libnoctura_prover.so` once, lazily — never in a static initializer at app start (the
 * blst lesson: an eager dlopen risks a launch crash). Pure Rust (libc/libm/libdl only).
 */
internal object NocturaNativeLib {
    @Volatile private var loaded = false

    @Synchronized
    fun ensureLoaded() {
        if (!loaded) {
            System.loadLibrary("noctura_prover")
            loaded = true
        }
    }
}

/** A JS argument that is not in its one form; rejected as `E_A0_ARG` before any native call. */
internal class A0ArgException(what: String) : IllegalArgumentException("argument $what is malformed")

/** The outcome of one native call: Rust's envelope, read. */
internal sealed class A0Result {
    data class Ok(val value: Any?) : A0Result()

    data class Err(val code: String, val message: String) : A0Result()

    companion object {
        /** A panic caught in Rust, a null or unreadable result. */
        const val INTERNAL = "E_A0_INTERNAL"

        /** The library could not be loaded (another ABI, or a broken install). */
        const val UNAVAILABLE = "E_A0_UNAVAILABLE"

        /** A JS argument Kotlin refused (A0ArgException); Rust uses the same code for its own. */
        const val ARG = "E_A0_ARG"

        fun parse(json: String?): A0Result {
            if (json == null) return Err(INTERNAL, "the native call returned no result")
            val o = try {
                JSONObject(json)
            } catch (e: JSONException) {
                return Err(INTERNAL, "the native result is unreadable")
            }
            val code = o.opt("error")
            return when {
                code is String -> Err(code, o.optString("message"))
                o.has("ok") && !o.has("error") -> Ok(o.get("ok"))
                else -> Err(INTERNAL, "the native result is unreadable")
            }
        }
    }
}

internal object A0Seed {
    /**
     * The seed as a ByteArray for exactly the duration of [use], zero-filled when it returns or
     * throws (spec §3 "The seed crosses as bytes"). Every element must be an integer 0..255;
     * anything else throws [A0ArgException] before [use] runs. Stated limit: the ReadableArray
     * React Native built cannot be wiped from here.
     */
    fun <T> use(seed: ReadableArray, use: (ByteArray) -> T): T {
        val bytes = ByteArray(seed.size())
        try {
            for (i in 0 until seed.size()) {
                if (seed.getType(i) != ReadableType.Number) throw A0ArgException("seed")
                val d = seed.getDouble(i)
                if (!(d >= 0.0 && d <= 255.0) || d != Math.floor(d)) throw A0ArgException("seed")
                bytes[i] = d.toInt().toByte()
            }
            return use(bytes)
        } finally {
            bytes.fill(0)
        }
    }
}

internal object A0Args {
    /** A ReadableArray of strings; anything else throws [A0ArgException] naming the index. */
    fun strings(arr: ReadableArray, what: String): Array<String> =
        Array(arr.size()) { i ->
            if (arr.getType(i) != ReadableType.String) throw A0ArgException("$what[$i]")
            arr.getString(i) ?: throw A0ArgException("$what[$i]")
        }
}

/** The one thread proofs run on (seconds each): never the JS thread, never the UI thread. */
internal object A0Prover {
    const val THREAD_NAME = "noctura-a0-prove"

    private val executor: ExecutorService = Executors.newSingleThreadExecutor { r ->
        Thread(r, THREAD_NAME).apply { isDaemon = true }
    }

    fun submit(task: () -> Unit) {
        executor.execute(task)
    }
}

/** Settles a JS promise from a native call: resolve the `ok` value, or reject with the stable code. */
internal object A0Promise {
    fun settle(promise: Promise, call: () -> String?) {
        val result = try {
            NocturaNativeLib.ensureLoaded()
            A0Result.parse(call())
        } catch (e: A0ArgException) {
            A0Result.Err(A0Result.ARG, e.message ?: "argument is malformed")
        } catch (e: UnsatisfiedLinkError) {
            A0Result.Err(A0Result.UNAVAILABLE, "the native library is unavailable")
        } catch (e: Throwable) {
            // No message passed on: nothing an exception here carries is meant for JS.
            A0Result.Err(A0Result.INTERNAL, "internal error")
        }
        when (result) {
            is A0Result.Ok -> promise.resolve(toReact(result.value))
            is A0Result.Err -> promise.reject(result.code, result.message)
        }
    }

    /** JSON → the React Native bridge's types (strings, ints, arrays, maps, null). */
    private fun toReact(v: Any?): Any? = when (v) {
        null, JSONObject.NULL -> null
        is String, is Boolean -> v
        is Int -> v
        is Number -> v.toDouble()
        is JSONArray -> Arguments.createArray().also { a ->
            for (i in 0 until v.length()) {
                when (val x = toReact(v.get(i))) {
                    null -> a.pushNull()
                    is String -> a.pushString(x)
                    is Int -> a.pushInt(x)
                    is Double -> a.pushDouble(x)
                    is Boolean -> a.pushBoolean(x)
                    is com.facebook.react.bridge.WritableArray -> a.pushArray(x)
                    is com.facebook.react.bridge.WritableMap -> a.pushMap(x)
                }
            }
        }
        is JSONObject -> Arguments.createMap().also { m ->
            for (k in v.keys()) {
                when (val x = toReact(v.get(k))) {
                    null -> m.putNull(k)
                    is String -> m.putString(k, x)
                    is Int -> m.putInt(k, x)
                    is Double -> m.putDouble(k, x)
                    is Boolean -> m.putBoolean(k, x)
                    is com.facebook.react.bridge.WritableArray -> m.putArray(k, x)
                    is com.facebook.react.bridge.WritableMap -> m.putMap(k, x)
                }
            }
        }
        else -> null
    }
}
```

Apply to `android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt`:

```diff
diff --git a/android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt b/android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt
index 94dd60b..7311d9a 100644
--- a/android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt
+++ b/android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt
@@ -4,6 +4,7 @@ import com.facebook.react.bridge.Promise
 import com.facebook.react.bridge.ReactApplicationContext
 import com.facebook.react.bridge.ReactContextBaseJavaModule
 import com.facebook.react.bridge.ReactMethod
+import com.facebook.react.bridge.ReadableArray
 import com.facebook.react.bridge.WritableNativeArray
 import com.facebook.react.bridge.WritableNativeMap
 import com.facebook.react.module.annotations.ReactModule
@@ -15,7 +16,16 @@ import org.json.JSONObject
  * libc++_shared, so the blst-style startup conflict does not apply.
  *
  * Mounted from JS as `NativeModules.NocturaProver` (`src/modules/zkProver/nativeProverBridge.ts`).
- * `prove(circuitId, witnessJson, zkeyPath, wasmPath)` → `{ proofBytes, publicInputs }`.
+ *
+ * The React methods are exactly (ReactSurfaceTest): `isSupported`; the A0 surface (spec
+ * 2026-11-08 shielded A0 M1 §3) — `keysOpen`, `keysClose`, `depositRho`, `matchSpent`,
+ * `commitment`, `prove`; and the v1 `proveV1` (the NPkc pool; removed with the v1 path in M1b).
+ * `parseUnshield` / `authorizeUnshield` are Kotlin-only (`internal`, no @ReactMethod): JS can
+ * never reach them; the native confirmation dialog (M1c) calls them.
+ *
+ * Every A0 method resolves Rust's `ok` value or rejects with its stable code (`E_A0_…`); the
+ * message never carries a witness value or a secret. `prove` runs on [A0Prover]'s own thread;
+ * the others run on React Native's native-modules thread (neither the JS nor the UI thread).
  */
 @ReactModule(name = NocturaProverModule.NAME)
 class NocturaProverModule(reactContext: ReactApplicationContext) :
@@ -23,20 +33,6 @@ class NocturaProverModule(reactContext: ReactApplicationContext) :
 
     companion object {
         const val NAME = "NocturaProver"
-
-        // Loaded LAZILY on first prove — never in a companion `init{}` (the blst
-        // lesson: eager dlopen at startup risks a launch crash). This .so is pure
-        // Rust (libc/libm/libdl only), so no libc++_shared conflict is expected.
-        @Volatile
-        private var libLoaded = false
-
-        @Synchronized
-        private fun ensureLibLoaded() {
-            if (!libLoaded) {
-                System.loadLibrary("noctura_prover")
-                libLoaded = true
-            }
-        }
     }
 
     override fun getName() = NAME
@@ -46,16 +42,84 @@ class NocturaProverModule(reactContext: ReactApplicationContext) :
     @ReactMethod(isBlockingSynchronousMethod = true)
     fun isSupported(): Boolean {
         return try {
-            ensureLibLoaded()
+            NocturaNativeLib.ensureLoaded()
             nativeIsSupported()
         } catch (e: Throwable) {
             false
         }
     }
 
-    /** Prove off the JS thread (proving takes seconds). Resolves { proofBytes, publicInputs }. */
+    // ------------------------------------------------------------------ the A0 surface
+
+    /**
+     * `keysOpen(seed: number[64]) -> handle`. The seed is a ByteArray only for the call and is
+     * zero-filled when it returns ([A0Seed]); a second keysOpen replaces the first session.
+     */
+    @ReactMethod
+    fun keysOpen(seed: ReadableArray, promise: Promise) =
+        A0Promise.settle(promise) { A0Seed.use(seed) { NocturaA0Native.keysOpen(it) } }
+
+    @ReactMethod
+    fun keysClose(handle: String, promise: Promise) =
+        A0Promise.settle(promise) { NocturaA0Native.keysClose(handle) }
+
+    @ReactMethod
+    fun depositRho(handle: String, depositIndex: String, promise: Promise) =
+        A0Promise.settle(promise) { NocturaA0Native.depositRho(handle, depositIndex) }
+
+    @ReactMethod
+    fun matchSpent(handle: String, chainNullifiers: ReadableArray, ownRhos: ReadableArray, promise: Promise) =
+        A0Promise.settle(promise) {
+            NocturaA0Native.matchSpent(
+                handle,
+                A0Args.strings(chainNullifiers, "chainNullifiers"),
+                A0Args.strings(ownRhos, "ownRhos"),
+            )
+        }
+
+    @ReactMethod
+    fun commitment(handle: String, amount: String, rho: String, promise: Promise) =
+        A0Promise.settle(promise) { NocturaA0Native.commitment(handle, amount, rho) }
+
+    /** `prove(...) -> {proofBytes, publicInputs}`, on the proving thread. `authId` null = none. */
     @ReactMethod
     fun prove(
+        handle: String,
+        circuit: String,
+        witnessJson: String,
+        authId: String?,
+        zkeyPath: String,
+        wasmPath: String,
+        promise: Promise,
+    ) {
+        A0Prover.submit {
+            A0Promise.settle(promise) {
+                NocturaA0Native.prove(handle, circuit, witnessJson, authId, zkeyPath, wasmPath)
+            }
+        }
+    }
+
+    /** Kotlin only — the native dialog's values (M1c). Never a React method. */
+    internal fun parseUnshield(owner: String, amount: String, fee: String): A0Result =
+        call { NocturaA0Native.parseUnshield(owner, amount, fee) }
+
+    /** Kotlin only — called on the biometric approval (M1c). Never a React method. */
+    internal fun authorizeUnshield(handle: String, owner: String, amount: String, fee: String): A0Result =
+        call { NocturaA0Native.authorizeUnshield(handle, owner, amount, fee) }
+
+    private fun call(native: () -> String?): A0Result =
+        try {
+            NocturaNativeLib.ensureLoaded()
+            A0Result.parse(native())
+        } catch (e: UnsatisfiedLinkError) {
+            A0Result.Err(A0Result.UNAVAILABLE, "the native library is unavailable")
+        }
+
+    // --------------------------------------------------------------- v1 (removed in M1b)
+
+    /** v1 prove off the JS thread (proving takes seconds). Resolves { proofBytes, publicInputs }. */
+    @ReactMethod
+    fun proveV1(
         circuitId: String,
         witnessJson: String,
         zkeyPath: String,
@@ -64,7 +128,7 @@ class NocturaProverModule(reactContext: ReactApplicationContext) :
     ) {
         Thread {
             try {
-                ensureLibLoaded()
+                NocturaNativeLib.ensureLoaded()
                 val json = nativeProve(circuitId, witnessJson, zkeyPath, wasmPath)
                 val obj = JSONObject(json)
                 if (obj.has("error")) {
```

```bash
cd native/noctura-prover && cargo build --release --locked --features jni-host 2>&1 | tail -1
./check-jni-exports.sh "$CARGO_TARGET_DIR/release/libnoctura_prover.so"
cd ../../android
ENVFILE=.env.devnet ANDROID_HOME=~/Android/Sdk ./gradlew :app:testDebugUnitTest --console=plain 2>&1 | grep -E "PASSED|SKIPPED$|FAILED|BUILD"
NOCTURA_A0_HOST_LIB_DIR="$CARGO_TARGET_DIR/release" ENVFILE=.env.devnet ANDROID_HOME=~/Android/Sdk \
  ./gradlew :app:testDebugUnitTest --console=plain --rerun-tasks 2>&1 | grep -E "PASSED|SKIPPED$|FAILED|BUILD"
```

Expected (without the host library — the three JNI tests skip, loudly; then with it):

```
    Finished `release` profile [optimized] target(s) in 22.67s
JNI exports match ./jni-exports.txt: 10 symbols
A0JniTest > theBoundCallsReturnTheFixturesPublicValuesThroughTheJni SKIPPED
A0JniTest > invNkAndInvNullNoJniOutputCarriesASecretOrAnOwnNullifier SKIPPED
A0JniTest > invAuthAWithdrawChangeProveThroughTheJniNeedsTheApproval SKIPPED
A0ResultTest > okValuesComeThrough PASSED
A0ResultTest > errorsKeepTheirCodeAndMessage PASSED
A0ResultTest > proveRunsOnItsOwnThreadNotTheCallers PASSED
A0ResultTest > aMissingOrUnreadableResultIsInternal PASSED
A0SeedTest > stringArraysTakeStringsOnly PASSED
A0SeedTest > andAfterACallThatThrows PASSED
A0SeedTest > anythingButAByteValueIsRefusedBeforeTheCall PASSED
A0SeedTest > theByteArrayHoldsTheSeedDuringTheCallAndZerosAfterIt PASSED
ReactSurfaceTest > theReadingSeesAnAnnotatedMethodNegativeControl PASSED
ReactSurfaceTest > parseUnshieldAndAuthorizeUnshieldAreBoundInKotlinButNotReactMethods PASSED
ReactSurfaceTest > theReactModuleExposesExactlyTheBoundSurface PASSED
ReactSurfaceTest > theKotlinNativesAreExactlyTheJniExportList PASSED
BUILD SUCCESSFUL in 13s
A0JniTest > theBoundCallsReturnTheFixturesPublicValuesThroughTheJni PASSED
A0JniTest > invNkAndInvNullNoJniOutputCarriesASecretOrAnOwnNullifier PASSED
A0JniTest > invAuthAWithdrawChangeProveThroughTheJniNeedsTheApproval PASSED
… (the same 12 PASSED lines)
BUILD SUCCESSFUL in 42s
```

The skipped run also prints `A0-JNI-SKIPPED A0JniTest: NOCTURA_A0_HOST_LIB_DIR is not set — the JNI tests did NOT run` once per test (`showStandardStreams`); with `CI` set the skip is a failure.

- [ ] **Step 7: The JS tests — red, then the bridge — green.**

Apply to `src/modules/zkProver/__tests__/nativeProverBridge.test.ts`:

```diff
diff --git a/src/modules/zkProver/__tests__/nativeProverBridge.test.ts b/src/modules/zkProver/__tests__/nativeProverBridge.test.ts
index 6a7aaab..55373ef 100644
--- a/src/modules/zkProver/__tests__/nativeProverBridge.test.ts
+++ b/src/modules/zkProver/__tests__/nativeProverBridge.test.ts
@@ -2,15 +2,33 @@ jest.mock('react-native', () => ({
   NativeModules: {
     NocturaProver: {
       isSupported: jest.fn(),
+      proveV1: jest.fn(),
+      keysOpen: jest.fn(),
+      keysClose: jest.fn(),
+      depositRho: jest.fn(),
+      matchSpent: jest.fn(),
+      commitment: jest.fn(),
       prove: jest.fn(),
     },
   },
 }));
 
 import {NativeModules} from 'react-native';
-import {isProverSupported, nativeProve} from '../nativeProverBridge';
+import {
+  a0Commitment,
+  a0DepositRho,
+  a0KeysClose,
+  a0KeysOpen,
+  a0MatchSpent,
+  a0Prove,
+  isProverSupported,
+  nativeProve,
+  type A0Handle,
+} from '../nativeProverBridge';
 
 const mockNative = NativeModules.NocturaProver;
+const H = '7' as A0Handle;
+const RHO = '12d576a44d29fa15379dfda30a5cce14c828f6a2d2789d9a0730c47f62d7518e';
 
 beforeEach(() => jest.clearAllMocks());
 
@@ -21,14 +39,93 @@ it('isProverSupported reflects the native module', () => {
   expect(isProverSupported()).toBe(false);
 });
 
-it('nativeProve forwards zkeyPath AND wasmPath to native.prove and returns its result', async () => {
-  mockNative.prove.mockResolvedValue({proofBytes: 'ab'.repeat(256), publicInputs: ['1', '2']});
+it('nativeProve (v1) forwards zkeyPath AND wasmPath to native.proveV1 and returns its result', async () => {
+  mockNative.proveV1.mockResolvedValue({proofBytes: 'ab'.repeat(256), publicInputs: ['1', '2']});
   const res = await nativeProve('transfer', '{"x":1}', '/cache/transfer.zkey', '/cache/transfer.wasm');
-  expect(mockNative.prove).toHaveBeenCalledWith(
+  expect(mockNative.proveV1).toHaveBeenCalledWith(
     'transfer',
     '{"x":1}',
     '/cache/transfer.zkey',
     '/cache/transfer.wasm',
   );
+  expect(mockNative.prove).not.toHaveBeenCalled();
   expect(res.proofBytes).toBe('ab'.repeat(256));
 });
+
+describe('a0KeysOpen — the seed crosses as bytes (spec §3, C3)', () => {
+  const seedValues = Array.from({length: 64}, (_, i) => (i * 37 + 11) % 256);
+
+  it('hands native a number[] copy, then zero-fills that array AND the caller’s Uint8Array', async () => {
+    let atCall: number[] = [];
+    let passed: number[] | undefined;
+    mockNative.keysOpen.mockImplementation(async (arr: number[]) => {
+      passed = arr;
+      atCall = [...arr];
+      return '42';
+    });
+    const seed = Uint8Array.from(seedValues);
+    await expect(a0KeysOpen(seed)).resolves.toBe('42');
+    expect(atCall).toEqual(seedValues);
+    expect(Array.isArray(passed)).toBe(true);
+    expect(passed!.every(b => b === 0)).toBe(true);
+    expect(seed.every(b => b === 0)).toBe(true);
+  });
+
+  it('zero-fills both when native rejects', async () => {
+    let passed: number[] | undefined;
+    mockNative.keysOpen.mockImplementation(async (arr: number[]) => {
+      passed = arr;
+      throw Object.assign(new Error('seed must be 64 bytes, got 63'), {code: 'E_A0_SEED_LENGTH'});
+    });
+    const seed = Uint8Array.from(seedValues.slice(0, 63));
+    await expect(a0KeysOpen(seed)).rejects.toMatchObject({code: 'E_A0_SEED_LENGTH'});
+    expect(passed!.length).toBe(63);
+    expect(passed!.every(b => b === 0)).toBe(true);
+    expect(seed.every(b => b === 0)).toBe(true);
+  });
+
+  it('zero-fills both when the native call throws synchronously', async () => {
+    let passed: number[] | undefined;
+    mockNative.keysOpen.mockImplementation((arr: number[]) => {
+      passed = arr;
+      throw new Error('bridge');
+    });
+    const seed = Uint8Array.from(seedValues);
+    await expect(a0KeysOpen(seed)).rejects.toThrow('bridge');
+    expect(passed!.every(b => b === 0)).toBe(true);
+    expect(seed.every(b => b === 0)).toBe(true);
+  });
+});
+
+it('the other A0 calls forward their arguments in the bridge forms', async () => {
+  mockNative.keysClose.mockResolvedValue(null);
+  mockNative.depositRho.mockResolvedValue(RHO);
+  mockNative.matchSpent.mockResolvedValue([0, 2]);
+  mockNative.commitment.mockResolvedValue('ab'.repeat(32));
+  mockNative.prove.mockResolvedValue({proofBytes: 'cd'.repeat(256), publicInputs: ['01']});
+
+  await expect(a0KeysClose(H)).resolves.toBeUndefined();
+  expect(mockNative.keysClose).toHaveBeenCalledWith('7');
+
+  await expect(a0DepositRho(H, 18446744073709551615n)).resolves.toBe(RHO);
+  expect(mockNative.depositRho).toHaveBeenCalledWith('7', '18446744073709551615');
+
+  await expect(a0MatchSpent(H, ['aa'], [RHO, 'bb'])).resolves.toEqual([0, 2]);
+  expect(mockNative.matchSpent).toHaveBeenCalledWith('7', ['aa'], [RHO, 'bb']);
+
+  await expect(a0Commitment(H, 1000000000n, RHO)).resolves.toBe('ab'.repeat(32));
+  expect(mockNative.commitment).toHaveBeenCalledWith('7', '1000000000', RHO);
+
+  const out = await a0Prove(H, 'withdraw_change', '{"rho":"…"}', null, '/z', '/w');
+  expect(out).toEqual({proofBytes: 'cd'.repeat(256), publicInputs: ['01']});
+  expect(mockNative.prove).toHaveBeenCalledWith('7', 'withdraw_change', '{"rho":"…"}', null, '/z', '/w');
+  await a0Prove(H, 'deposit', '{}', 'ef'.repeat(16), '/z', '/w');
+  expect(mockNative.prove).toHaveBeenLastCalledWith('7', 'deposit', '{}', 'ef'.repeat(16), '/z', '/w');
+});
+
+it('a negative amount or index never reaches native', async () => {
+  await expect(a0DepositRho(H, -1n)).rejects.toThrow(RangeError);
+  await expect(a0Commitment(H, -1n, RHO)).rejects.toThrow(RangeError);
+  expect(mockNative.depositRho).not.toHaveBeenCalled();
+  expect(mockNative.commitment).not.toHaveBeenCalled();
+});
```

Create `src/modules/zkProver/__tests__/a0Boundary.test.ts`:

```ts
/**
 * The JS ↔ native boundary of the A0 core (spec §3 "JNI surface", §14 "Boundary", INV-NK,
 * INV-NULL): what JS can call, read three ways —
 *  1. the bridge module's runtime exports, exactly;
 *  2. the native methods the bridge touches when every export is called, exactly — recorded by a
 *     Proxy standing in for NativeModules.NocturaProver;
 *  3. the @ReactMethod set of NocturaProverModule.kt and the `external fun`s, read from the
 *     Kotlin source and held to native/noctura-prover/jni-exports.txt (the JVM test
 *     ReactSurfaceTest reads the same off the compiled classes; this one runs in CI's jest).
 * Each reading has a negative control: the same reader on an input that has one name too many.
 */
import * as fs from 'fs';
import * as path from 'path';

const mockTouched = new Set<string>();
jest.mock('react-native', () => {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop) {
      if (typeof prop === 'string') {
        mockTouched.add(prop);
      }
      return (...args: unknown[]) => {
        // keysOpen must receive a plain number[] (never a string, never the Uint8Array)
        if (prop === 'keysOpen' && !Array.isArray(args[0])) {
          throw new Error('keysOpen got a non-array seed');
        }
        return prop === 'isSupported' ? true : Promise.resolve(prop === 'matchSpent' ? [] : '1');
      };
    },
  };
  return {NativeModules: {NocturaProver: new Proxy({}, handler)}};
});

import * as bridge from '../nativeProverBridge';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');

const EXPECTED_EXPORTS = [
  'a0Commitment',
  'a0DepositRho',
  'a0KeysClose',
  'a0KeysOpen',
  'a0MatchSpent',
  'a0Prove',
  'isProverSupported',
  'nativeProve', // v1 — removed with the v1 path in M1b
];
const EXPECTED_REACT_METHODS = [
  'commitment',
  'depositRho',
  'isSupported',
  'keysClose',
  'keysOpen',
  'matchSpent',
  'prove',
  'proveV1', // v1 — removed in M1b
];
const KOTLIN_ONLY = ['authorizeUnshield', 'parseUnshield'];

function exportsOf(mod: Record<string, unknown>): string[] {
  return Object.keys(mod).sort();
}

/** `@ReactMethod` (with or without arguments) followed by `fun <name>`. */
function reactMethodsIn(kotlin: string): string[] {
  const out = new Set<string>();
  const re = /@ReactMethod(?:\([^)]*\))?\s+(?:(?:override|internal|public)\s+)*fun\s+(\w+)/g;
  for (const m of kotlin.matchAll(re)) {
    out.add(m[1]);
  }
  return [...out].sort();
}
/** Every `fun <name>` declared, annotated or not. */
function funsIn(kotlin: string): string[] {
  return [...kotlin.matchAll(/\bfun\s+(\w+)\s*\(/g)].map(m => m[1]);
}
/** `external fun <name>` → its JNI symbol, for the given class. */
function nativesIn(kotlin: string, cls: string): string[] {
  return [...kotlin.matchAll(/\bexternal\s+fun\s+(\w+)/g)].map(
    m => `Java_com_nocturawallet_prover_${cls}_${m[1]}`,
  );
}
function jniList(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '' && !l.startsWith('#'))
    .sort();
}

const MODULE_KT = 'android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt';
const NATIVE_KT = 'android/app/src/main/java/com/nocturawallet/prover/NocturaA0Native.kt';

describe('1. the bridge module exports exactly the bound surface', () => {
  it('runtime exports', () => {
    expect(exportsOf(bridge)).toEqual(EXPECTED_EXPORTS);
  });
  it('negative control: one export more is seen', () => {
    const leaky = {...bridge, a0Nullifier: () => '00'};
    expect(exportsOf(leaky)).not.toEqual(EXPECTED_EXPORTS);
  });
  it('no export is named after a secret or an own nullifier', () => {
    for (const name of exportsOf(bridge)) {
      expect(name).not.toMatch(/sk|spend|nk|ivk|dSelf|addrField|nullifier|viewKey|seed/i);
    }
  });
});

describe('2. calling every export touches exactly the React methods JS may use', () => {
  it('records the native methods reached', async () => {
    mockTouched.clear();
    const h = '1' as bridge.A0Handle;
    bridge.isProverSupported();
    await bridge.nativeProve('deposit', '{}', '/z', '/w');
    await bridge.a0KeysOpen(new Uint8Array(64));
    await bridge.a0KeysClose(h);
    await bridge.a0DepositRho(h, 0n);
    await bridge.a0MatchSpent(h, [], []);
    await bridge.a0Commitment(h, 1n, '00'.repeat(32));
    await bridge.a0Prove(h, 'deposit', '{}', null, '/z', '/w');
    expect([...mockTouched].sort()).toEqual(EXPECTED_REACT_METHODS);
    for (const k of KOTLIN_ONLY) {
      expect(mockTouched.has(k)).toBe(false);
    }
  });
  it('covers every export (a new export must be added to the call list above)', () => {
    expect(exportsOf(bridge).length).toBe(8);
  });
});

describe('3. the Kotlin module', () => {
  const kt = read(MODULE_KT);
  it('its @ReactMethods are exactly the surface; parseUnshield / authorizeUnshield are not among them', () => {
    expect(reactMethodsIn(kt)).toEqual(EXPECTED_REACT_METHODS);
    for (const k of KOTLIN_ONLY) {
      expect(funsIn(kt)).toContain(k);
    }
  });
  it('negative control: an annotated parseUnshield is seen', () => {
    const leaky = kt.replace(/(\n\s*)(internal fun parseUnshield)/, '$1@ReactMethod$1$2');
    expect(leaky).not.toBe(kt);
    expect(reactMethodsIn(leaky)).toContain('parseUnshield');
    expect(reactMethodsIn(leaky)).not.toEqual(EXPECTED_REACT_METHODS);
  });
  it('the Kotlin natives are exactly native/noctura-prover/jni-exports.txt', () => {
    const natives = [
      ...nativesIn(read(NATIVE_KT), 'NocturaA0Native'),
      ...nativesIn(kt, 'NocturaProverModule'),
    ].sort();
    const list = jniList(read('native/noctura-prover/jni-exports.txt'));
    expect(list.length).toBe(10);
    expect(natives).toEqual(list);
    // negative control: a list with one symbol more does not match
    expect(natives).not.toEqual([...list, 'Java_com_nocturawallet_prover_NocturaA0Native_nullifier'].sort());
  });
});
```

```bash
npx jest src/modules/zkProver/__tests__/nativeProverBridge.test.ts 2>&1 | grep -E "Tests:"
npx jest src/modules/zkProver/__tests__/a0Boundary.test.ts 2>&1 | grep -E "✓|✕|Tests:"
```

Expected (red: the bridge has no A0 export yet; the Kotlin source readings already pass because Step 6 is in):

```
Tests:       6 failed, 1 passed, 7 total
    ✕ runtime exports (4 ms)
    ✓ negative control: one export more is seen (1 ms)
    ✓ no export is named after a secret or an own nullifier
    ✕ records the native methods reached
    ✕ covers every export (a new export must be added to the call list above) (1 ms)
    ✓ its @ReactMethods are exactly the surface; parseUnshield / authorizeUnshield are not among them (1 ms)
    ✓ negative control: an annotated parseUnshield is seen
    ✓ the Kotlin natives are exactly native/noctura-prover/jni-exports.txt (1 ms)
Tests:       3 failed, 5 passed, 8 total
```

(`records the native methods reached` fails with `TypeError: bridge.a0KeysOpen is not a function`; the one passing bridge test is `isProverSupported`.) **The mock variable is `mockTouched`:** Jest refuses a `jest.mock` factory that closes over a variable whose name does not start with `mock`.

Apply to `src/modules/zkProver/nativeProverBridge.ts`:

```diff
diff --git a/src/modules/zkProver/nativeProverBridge.ts b/src/modules/zkProver/nativeProverBridge.ts
index 9b8e55a..a015e14 100644
--- a/src/modules/zkProver/nativeProverBridge.ts
+++ b/src/modules/zkProver/nativeProverBridge.ts
@@ -1,34 +1,138 @@
 import {NativeModules} from 'react-native';
 
-/** Native (mopro) prover contract. Implemented by the NocturaProver native module
- *  (Rust core via UniFFI → iOS/Android). JS supplies BOTH SHA-256-verified paths —
- *  the .zkey proving key and the .wasm witness generator — at prove-time (runtime
- *  load, NOT a compile-time-embed template; native does not bundle the wasm). Output
- *  is on-chain-ready. */
+/** An open A0 key session (spec §3 "Handle lifetime"): opaque; one per operation, closed in a
+ *  `finally`. A second `a0KeysOpen` replaces the first. */
+export type A0Handle = string & {readonly __a0Handle: unique symbol};
+
+/** The circuits M1 proves (`transfer` is refused natively until M2). */
+export type A0Circuit = 'deposit' | 'withdraw_change';
+
+/** A proof as the chain takes it: 256 bytes as 512 hex chars, and the circuit's public inputs
+ *  in order, each 32 bytes big-endian as 64 lowercase hex. */
+export interface A0Proof {
+  proofBytes: string;
+  publicInputs: string[];
+}
+
+/** The NocturaProver native module (`NocturaProverModule.kt`): its @ReactMethods, and nothing
+ *  else — `parseUnshield` / `authorizeUnshield` are Kotlin-only (the native dialog's, M1c) and
+ *  are deliberately absent here. Every A0 call rejects with a stable `E_A0_…` code. */
 interface NocturaProverNative {
   isSupported(): boolean;
-  prove(
+  /** v1 (the NPkc pool) — removed with the v1 path in M1b. */
+  proveV1(
     circuitId: string,
     witnessJson: string,
     zkeyPath: string,
     wasmPath: string,
   ): Promise<{proofBytes: string; publicInputs: string[]}>;
+  keysOpen(seed: number[]): Promise<string>;
+  keysClose(handle: string): Promise<null>;
+  depositRho(handle: string, depositIndex: string): Promise<string>;
+  matchSpent(handle: string, chainNullifiers: string[], ownRhos: string[]): Promise<number[]>;
+  commitment(handle: string, amount: string, rho: string): Promise<string>;
+  prove(
+    handle: string,
+    circuit: string,
+    witnessJson: string,
+    authId: string | null,
+    zkeyPath: string,
+    wasmPath: string,
+  ): Promise<A0Proof>;
 }
 
 const native = NativeModules.NocturaProver as NocturaProverNative | undefined;
 
+function requireNative(): NocturaProverNative {
+  if (!native) {
+    throw new Error('NocturaProver native module unavailable');
+  }
+  return native;
+}
+
+/** A u64 as the bridge's decimal string; a negative value never reaches native. */
+function u64(v: bigint, what: string): string {
+  if (v < 0n) {
+    throw new RangeError(`${what} must not be negative`);
+  }
+  return v.toString();
+}
+
 export function isProverSupported(): boolean {
   return !!native && native.isSupported();
 }
 
+/** v1 prove (the NPkc pool) — native supplies BOTH SHA-256-verified paths at prove time.
+ *  Removed with the v1 path in M1b. */
 export async function nativeProve(
   circuitId: string,
   witnessJson: string,
   zkeyPath: string,
   wasmPath: string,
 ): Promise<{proofBytes: string; publicInputs: string[]}> {
-  if (!native) {
-    throw new Error('NocturaProver native module unavailable');
+  return requireNative().proveV1(circuitId, witnessJson, zkeyPath, wasmPath);
+}
+
+// ------------------------------------------------------------------ the A0 core (spec §3)
+//
+// These are the whole JS side of the native A0 surface. None returns sk, nk, ivk, d_self or
+// addrField — native has no call that could — and an own note's nullifier reaches JS only as
+// public input [1] of a withdraw_change proof (`a0Prove`).
+
+/**
+ * `keysOpen(seed) -> handle`. CONSUMES `seed`: the bytes are copied into a `number[]` for the
+ * bridge, and both that array and the caller's `Uint8Array` are zero-filled as soon as the call
+ * settles, whatever its outcome (spec §3 "The seed crosses as bytes"). Stated limit: the copies
+ * React Native makes while serializing cannot be wiped from JS.
+ */
+export async function a0KeysOpen(seed: Uint8Array): Promise<A0Handle> {
+  const bytes: number[] = Array.from(seed);
+  try {
+    return (await requireNative().keysOpen(bytes)) as A0Handle;
+  } finally {
+    bytes.fill(0);
+    seed.fill(0);
   }
-  return native.prove(circuitId, witnessJson, zkeyPath, wasmPath);
+}
+
+export async function a0KeysClose(handle: A0Handle): Promise<void> {
+  await requireNative().keysClose(handle);
+}
+
+/** The deposit `rho(i)` as 64 lowercase hex — public once deposited (R1). */
+export async function a0DepositRho(handle: A0Handle, depositIndex: bigint): Promise<string> {
+  return requireNative().depositRho(handle, u64(depositIndex, 'depositIndex'));
+}
+
+/** The indices into `ownRhos` (ascending) of the own notes whose nullifier is in
+ *  `chainNullifiers` (R12). Every value 64 lowercase hex. */
+export async function a0MatchSpent(
+  handle: A0Handle,
+  chainNullifiers: string[],
+  ownRhos: string[],
+): Promise<number[]> {
+  return requireNative().matchSpent(handle, chainNullifiers, ownRhos);
+}
+
+/** An own note's commitment (d_self implicit), 64 lowercase hex. */
+export async function a0Commitment(handle: A0Handle, amount: bigint, rho: string): Promise<string> {
+  return requireNative().commitment(handle, u64(amount, 'amount'), rho);
+}
+
+/**
+ * `prove(handle, circuit, witnessJson, authId?, zkeyPath, wasmPath)`. `witnessJson` is the
+ * circuit's allow-list only (deposit `{amount, depositIndex}`; withdraw_change `{merkleRoot,
+ * inputAmount, rho, pathElements, pathIndices}`) and carries private note data — never log it.
+ * A withdraw_change needs the `authId` of a native approval (M1c); without one it is refused,
+ * and every prove uses a live approval up. Runs on native's proving thread.
+ */
+export async function a0Prove(
+  handle: A0Handle,
+  circuit: A0Circuit,
+  witnessJson: string,
+  authId: string | null,
+  zkeyPath: string,
+  wasmPath: string,
+): Promise<A0Proof> {
+  return requireNative().prove(handle, circuit, witnessJson, authId, zkeyPath, wasmPath);
 }
```

```bash
npx jest src/modules/zkProver 2>&1 | grep -E "✕|Tests:|Suites:"
npx tsc --noEmit; echo "tsc exit $?"
npx eslint src/modules/zkProver/nativeProverBridge.ts src/modules/zkProver/__tests__/nativeProverBridge.test.ts src/modules/zkProver/__tests__/a0Boundary.test.ts; echo "eslint exit $?"
```

Expected:

```
Test Suites: 9 passed, 9 total
Tests:       50 passed, 50 total
tsc exit 0
eslint exit 0
```

- [ ] **Step 8: CI — the keyed bridge test, clippy with `jni-host`, the JNI export check and its negative control.**

Apply to `.github/workflows/native-prover.yml`:

```diff
diff --git a/.github/workflows/native-prover.yml b/.github/workflows/native-prover.yml
index ea285d6..e5725cf 100644
--- a/.github/workflows/native-prover.yml
+++ b/.github/workflows/native-prover.yml
@@ -184,7 +184,10 @@ jobs:
         run: cargo fmt --check
 
       - name: Clippy
-        run: cargo clippy --all-targets --locked -- -D warnings
+        run: |
+          cargo clippy --all-targets --locked -- -D warnings
+          # src/android.rs (the JNI marshalling) compiles on the host only with jni-host.
+          cargo clippy --all-targets --locked --features jni-host -- -D warnings
 
       # --locked fails if Cargo.lock would need updating, so a dependency cannot
       # drift without a committed lockfile change.
@@ -222,6 +225,8 @@ jobs:
             keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped; do
             grep -q "test a0::tests_prove::$t \.\.\. ok" "$1"
           done
+          # INV-NULL / INV-AUTH through the JNI bridge's logic, with the real key files.
+          grep -q "test a0::tests_bridge::keyed_bridge_withdraw_change_carries_the_approved_values_and_is_the_one_nullifier_exit \.\.\. ok" "$1"
           # A key-file test that returned early prints this marker; "ok" alone would hide it.
           ! grep -q "A0-KEYS-SKIPPED" "$1"
           SH
@@ -263,3 +268,22 @@ jobs:
             exit 1
           fi
           echo "a skipped A0 key-file test fails the interop assertion"
+
+      # THE JNI SURFACE (spec §3, §14 "Boundary"): the Java_* symbols the library exports must be
+      # exactly jni-exports.txt. The host build with `jni-host` carries the same #[no_mangle]
+      # functions as the arm64 library (Task 5's arm64 step runs the same script on that one).
+      - name: Build the host JNI library
+        run: cargo build --release --locked --features jni-host
+
+      - name: Assert the JNI exports are exactly jni-exports.txt
+        run: ./check-jni-exports.sh target/release/libnoctura_prover.so
+
+      # NEGATIVE CONTROL — the same check against a list missing one symbol must fail.
+      - name: Assert the JNI export check can fail
+        run: |
+          grep -vE '^\s*(#|$)' jni-exports.txt | head -n -1 > /tmp/jni-exports-short.txt
+          if ./check-jni-exports.sh target/release/libnoctura_prover.so /tmp/jni-exports-short.txt; then
+            echo "::error::the JNI export check PASSED against a list missing a symbol — it cannot fail"
+            exit 1
+          fi
+          echo "the JNI export check is falsifiable"
```

The new steps, run locally with the host library of Step 6:

```bash
cd native/noctura-prover
./check-jni-exports.sh "$CARGO_TARGET_DIR/release/libnoctura_prover.so"; echo "POS exit $?"
grep -vE '^\s*(#|$)' jni-exports.txt | head -n -1 > /tmp/jni-exports-short.txt
./check-jni-exports.sh "$CARGO_TARGET_DIR/release/libnoctura_prover.so" /tmp/jni-exports-short.txt; echo "NEG-short exit $?"
./check-jni-exports.sh jni-exports.txt; echo "NEG-not-elf exit $?"
```

Expected:

```
JNI exports match ./jni-exports.txt: 10 symbols
POS exit 0
JNI exports of …/release/libnoctura_prover.so differ from /tmp/jni-exports-short.txt:
  extra:   Java_com_nocturawallet_prover_NocturaProverModule_nativeProve
NEG-short exit 1
nm: jni-exports.txt: file format not recognized
no Java_* symbols read from jni-exports.txt — wrong file or nm failed
NEG-not-elf exit 2
```

A host library built WITHOUT `jni-host` has no `Java_*` symbol and also exits 2 — an empty read never passes. The Kotlin JVM tests are **not** in CI (no workflow builds the Android project); the CI-run readings of the same boundary are `a0Boundary.test.ts` (Jest, `ci.yml`) and the export check here.

- [ ] **Step 9: arm64 — the library, its dynamic section, its exports; both APKs.**

```bash
cd native/noctura-prover
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 cargo ndk -t arm64-v8a -o ../../android/app/src/main/jniLibs build --release --locked 2>&1 | tail -2
rm ../../android/app/src/main/jniLibs/arm64-v8a/libark_circom-*.so      # see Notes: a stray copy, not a dependency
SO=../../android/app/src/main/jniLibs/arm64-v8a/libnoctura_prover.so
readelf -d $SO | grep -E "NEEDED|SONAME"; readelf -d $SO | grep -c "c++"
./check-jni-exports.sh $SO
nm -D --defined-only $SO | awk '{print $NF}' | grep -vc '^Java_'
nm -D --undefined-only $SO | grep -c probestack
```

Expected:

```
    Finished `release` profile [optimized] target(s) in 30.00s
     Copying libraries to …/android/app/src/main/jniLibs
 0x0000000000000001 (NEEDED)             Shared library: [libdl.so]
 0x0000000000000001 (NEEDED)             Shared library: [libm.so]
 0x0000000000000001 (NEEDED)             Shared library: [libc.so]
0
JNI exports match ./jni-exports.txt: 10 symbols
35
0
```

Task 1's carried concern, answered: with `a0` now reachable from exported symbols the library grew from 5,958,840 to 7,275,744 bytes (the A0 code is linked, not dropped) and NEEDED is still only libc / libm / libdl. The 35 non-JNI exports are wasmer-vm's `wasmer_vm_*` (present at the base too: 37 defined dynamic symbols there = 35 + the 2 v1 JNI ones; Notes).

Then both APKs (release signing from `android/keystore.properties` or the `NOCTURA_KEYSTORE_*` variables; the gitignored `.env.devnet` / `.env.production` copied in from the main checkout, never committed):

```bash
cd android
ENVFILE=.env.devnet ./gradlew assembleRelease --console=plain 2>&1 | grep -E "^BUILD"
cp app/build/outputs/apk/release/app-release.apk /tmp/devnet.apk
ENVFILE=.env.production ./gradlew assembleRelease --console=plain 2>&1 | grep -E "^BUILD"
cp app/build/outputs/apk/release/app-release.apk /tmp/production.apk
for f in devnet production; do
  aapt2 dump badging /tmp/$f.apk | grep -E "^package" | cut -d"'" -f2
  unzip -l /tmp/$f.apk | grep -c '\.so$'
  unzip -l /tmp/$f.apk | grep -E 'noctura|ark_circom'
done
unzip -o -q /tmp/devnet.apk lib/arm64-v8a/libnoctura_prover.so -d /tmp/apkso
readelf -d /tmp/apkso/lib/arm64-v8a/libnoctura_prover.so | grep NEEDED
native/noctura-prover/check-jni-exports.sh /tmp/apkso/lib/arm64-v8a/libnoctura_prover.so
```

Expected (the devnet build took 59 min 27 s cold — a fresh `node_modules` compiles every React Native library for four ABIs —, the production one 2 min 5 s after it):

```
BUILD SUCCESSFUL in 59m 27s
BUILD SUCCESSFUL in 2m 5s
com.nocturawallet.devnet
89
  5012352  1981-01-01 01:01   lib/arm64-v8a/libnoctura_prover.so
com.nocturawallet
89
  5012352  1981-01-01 01:01   lib/arm64-v8a/libnoctura_prover.so
 0x0000000000000001 (NEEDED)             Shared library: [libdl.so]
 0x0000000000000001 (NEEDED)             Shared library: [libm.so]
 0x0000000000000001 (NEEDED)             Shared library: [libc.so]
JNI exports match native/noctura-prover/jni-exports.txt: 10 symbols
```

The 89 `.so` per APK: 23 under `lib/arm64-v8a/` (`libNitroMmkv`, `libNitroModules`, `libappmodules`, `libc++_shared` — React Native's own —, `libdatastore_shared_counter`, `libfbjni`, `libgesturehandler`, `libhermestooling`, `libhermesvm`, `libimagepipeline`, `libjsi`, `libmmkv`, `libnative-filters`, `libnative-imagetranscoder`, `libnoctura_prover`, `libreact_codegen_rnscreens`, `libreact_codegen_rnsvg`, `libreact_codegen_safeareacontext`, `libreactnative`, `libreanimated`, `librnscreens`, `libtoolChecker`, `libworklets`) and 22 each under `armeabi-v7a`, `x86`, `x86_64` — the same list without `libnoctura_prover` (the prover is arm64 only, so `isSupported()` is false elsewhere: the load fails and Kotlin returns false). Both APKs are identical in their native libraries; AGP strips the packaged prover to 5,012,352 bytes, and the stripped library keeps its NEEDED and its exact export list. **Not run here:** the launch on the phone (§16: every checkpoint's — Task 5 / Task 6).

- [ ] **Step 10: The whole suite.**

```bash
npx tsc --noEmit; echo $?
npx jest --maxWorkers=4 2>&1 | grep -E "^(FAIL|Tests:|Test Suites:)"
node scripts/check-no-tge-date.mjs
```

Expected:

```
0
Test Suites: 1 skipped, 182 passed, 182 of 183 total
Tests:       1 skipped, 1256 passed, 1257 total
no TGE date in 1432 tracked text files
```

(+13 Jest tests: `nativeProverBridge.test.ts` 2 → 7, `a0Boundary.test.ts` 8.) **Measured flake:** two default-worker (`nproc` = 8) runs each failed ONE screen suite on a timeout while the APK build or the mutations loaded the machine — `SetPinScreen.test.tsx` once, `TransactionStatusScreen.test.tsx` once —, each 4 / 4 green alone and the whole run green at `--maxWorkers=4`; neither touches this task's files.

- [ ] **Step 11: Named mutations — each in a fresh copy, compiled first, each red.**

Rust: `git archive HEAD native/noctura-prover src/modules/shielded/a0 | tar -x -C <dir>`, the edit (an exact replacement, asserted to occur once), `cargo test --locked --lib --no-run` (all 9 compiled — none INVALID), then `cargo test --locked --lib a0::tests_bridge`; the two S-rows build the host library with `jni-host` and run `check-jni-exports.sh` on it. JS: `git archive HEAD | tar -x` + the `node_modules` symlink, `npx tsc --noEmit` (exit 0 for all six) then `npx jest --verbose` on the two zkProver test files. Kotlin: the same copy with `node_modules` linked to a scratch copy (never the main checkout's — gradle writes into `node_modules/*/android/build`), `.env.devnet` and `local.properties`, `NOCTURA_A0_HOST_LIB_DIR` set, `./gradlew :app:testDebugUnitTest`. Measured:

| mutation | edit | result | red tests |
|---|---|---|---|
| M-bridge-arg-keeps-auth | `bridge.rs`: `core.discard_auth()?;` → (deleted) | 9 passed; 1 failed | `inv_auth_a_withdraw_change_prove_needs_the_approved_authorization` |
| M-empty-authid-is-none | `bridge.rs`: `None => Ok(None),` → `None \| Some("") => Ok(None),` | 9 passed; 1 failed | `inv_auth_a_withdraw_change_prove_needs_the_approved_authorization` |
| M-hex-any-case | `bridge.rs`: `matches!(c, b'0'..=b'9' \| b'a'..=b'f')` → `… \| b'A'..=b'F')` | 8 passed; 2 failed | `every_argument_has_one_spelling`, `inv_auth_a_withdraw_change_prove_needs_the_approved_authorization` |
| M-handle-loose-parse | `bridge.rs`: `parse_u64(s, "handle")` → `s.trim().parse::<u64>()` | 8 passed; 2 failed | `every_argument_has_one_spelling`, `inv_auth_a_withdraw_change_prove_needs_the_approved_authorization` |
| M-rho-call-leaks-nullifier | `bridge.rs`: `core.deposit_rho(h, i).map(\|b\| json!(hex::encode(b)))` → `let inner = core.lock()?; let k = inner.keys_for(h)?; Ok(json!(hex::encode(super::field::fr_to_be32(&k.nullifier(&k.deposit_rho(i))))))` | 8 passed; 2 failed | `inv_nk_and_inv_null_no_bound_call_outputs_a_secret_or_an_own_nullifier`, `the_bound_calls_return_the_fixtures_public_values` |
| M-bridge-seed-wipe-dropped | `bridge.rs`: `seed.zeroize();` (after the envelope) → (deleted) | 10 passed; 0 failed | **none — survivor (below)** |
| M-code-reused | `state.rs`: `A0Error::ArgItem { .. } => "E_A0_ARG_ITEM",` → `… => "E_A0_ARG",` | 8 passed; 2 failed | `every_argument_has_one_spelling`, `every_error_has_a_distinct_stable_code_named_after_its_variant` |
| M-panic-not-caught | `bridge.rs`: `match catch_unwind(AssertUnwindSafe(f)) {` → `match Ok::<_, ()>(f()) {` | 9 passed; 1 failed | `the_envelope_is_ok_or_a_code_and_a_panic_becomes_internal` |
| M-match-spent-chain-unchecked | `bridge.rs`: `let chain = hex_list(chain_nullifiers, "chainNullifiers")?;` → `let chain: Vec<[u8; 32]> = chain_nullifiers.iter().filter_map(\|s\| lower_hex::<32>(s)).collect();` | 9 passed; 1 failed | `every_argument_has_one_spelling` |
| S-extra-jni-export | `android.rs`: a ninth `#[no_mangle] … Java_com_nocturawallet_prover_NocturaA0Native_nullifier` | `check-jni-exports.sh` exit 1 | `extra:   Java_com_nocturawallet_prover_NocturaA0Native_nullifier` |
| S-missing-jni-export | `android.rs`: `fn Java_com_nocturawallet_prover_NocturaA0Native_authorizeUnshield<'a>(` → `fn authorize_unshield_unexported<'a>(` | `check-jni-exports.sh` exit 1 | `missing: Java_com_nocturawallet_prover_NocturaA0Native_authorizeUnshield` |
| J-seed-not-zeroed | `nativeProverBridge.ts`: `seed.fill(0);` → (deleted) | 3 failed, 12 passed | the three `a0KeysOpen` zero-fill tests (resolve, reject, synchronous throw) |
| J-copy-not-zeroed | `nativeProverBridge.ts`: `bytes.fill(0);` → (deleted) | 3 failed, 12 passed | the same three |
| J-uint8array-passed | `nativeProverBridge.ts`: `const bytes: number[] = Array.from(seed);` → `const bytes = seed as unknown as number[];` | 2 failed, 13 passed | `records the native methods reached`; `hands native a number[] copy, then zero-fills that array AND the caller’s Uint8Array` |
| J-extra-export | `nativeProverBridge.ts`: `export const a0Nullifier = (): string => '';` added | 3 failed, 12 passed | `runtime exports`; `no export is named after a secret or an own nullifier`; `covers every export` |
| J-kotlin-parseUnshield-exposed | `NocturaProverModule.kt`: `internal fun parseUnshield(` → `@ReactMethod` + it (Jest's source reading) | 1 failed, 14 passed | `its @ReactMethods are exactly the surface; …` |
| J-kotlin-extra-native | `NocturaA0Native.kt`: `@JvmStatic external fun nullifier(handle: String): String?` added (Jest's source reading) | 1 failed, 14 passed | `the Kotlin natives are exactly native/noctura-prover/jni-exports.txt` |
| K-seed-not-zeroed | `A0Bridge.kt`: `bytes.fill(0)` → (deleted) | 10 passed, 5 failed | `A0SeedTest.theByteArrayHoldsTheSeedDuringTheCallAndZerosAfterIt`, `A0SeedTest.andAfterACallThatThrows`, and all three `A0JniTest` (their `open()` asserts Kotlin's copy is zeroed) |
| K-parseUnshield-exposed | `NocturaProverModule.kt`: `@ReactMethod` on `internal fun parseUnshield(` | 13 passed, 2 failed | `ReactSurfaceTest.theReactModuleExposesExactlyTheBoundSurface`, `ReactSurfaceTest.parseUnshieldAndAuthorizeUnshieldAreBoundInKotlinButNotReactMethods` |
| K-prove-on-caller-thread | `A0Bridge.kt`: `executor.execute(task)` → `task()` | 14 passed, 1 failed | `A0ResultTest.proveRunsOnItsOwnThreadNotTheCallers` |
| K-extra-native | `NocturaA0Native.kt`: `@JvmStatic external fun nullifier(handle: String): String?` added | 14 passed, 1 failed | `ReactSurfaceTest.theKotlinNativesAreExactlyTheJniExportList` (compiled classes) |

Plus the negative controls of Step 8 (a list missing a symbol → exit 1; a non-ELF file → exit 2; a library without `jni-host` → exit 2). **INVALID, not counted:** renaming `NocturaA0Native.parseUnshield` in Kotlin (`compileDebugKotlin FAILED` — the module calls it; renamed at the call site too, `compileDebugUnitTestKotlin FAILED` — `A0JniTest` calls it); K-extra-native is its valid form. **Survivor, stated:** M-bridge-seed-wipe-dropped — `Core::keys_open` already wipes the seed on every path (Task 1, M-seed-not-wiped), so the bridge's second wipe is defence in depth for a panic between the two (which `envelope` turns into `E_A0_INTERNAL`); no test can make `Core::keys_open` panic. **Not covered by a mutation:** the JNI shim's failure paths (`jni_arg`, a `null` from `new_string`) — no input from Kotlin reaches them; the first Kotlin run of K-prove-on-caller-thread reported 0 / 0 (a Gradle daemon collision while the previous copy's build ran) and was re-run alone: the row is the re-run.

- [ ] **Step 12: Commit.**

```bash
git add .github/workflows/native-prover.yml android/app/build.gradle android/app/src/main/java/com/nocturawallet/prover \
  android/app/src/test native/noctura-prover/Cargo.toml native/noctura-prover/src \
  native/noctura-prover/check-jni-exports.sh native/noctura-prover/jni-exports.txt src/modules/zkProver
git status --short     # nothing staged outside these; .env*, local.properties and jniLibs/ stay untracked (gitignored)
git commit -m "feat(shielded-a0): the A0 JNI surface, the Kotlin bindings and the JS bridge — one JSON envelope with stable E_A0_ codes, the seed as bytes zero-filled on every side, prove on its own thread, parseUnshield/authorizeUnshield Kotlin-only; the export list checked against the built library, the React methods against the compiled classes, INV-NK/INV-NULL/INV-AUTH as tests (M1a Task 4)"
```

Expected `git show --stat HEAD`: 22 files changed, 2308 insertions(+), 36 deletions(-).

#### Notes for the executor (Task 4)

- **The rulings this task took (each the most secure default; the owner may overturn any):**
  - **The JNI's logic lives in Rust as `a0::bridge`, tested on the desktop; `android.rs` only marshals.** Everything that could be wrong — parsing, the order "consume the approval, then refuse", the codes, what comes back — is in one place a unit test reaches. Cost if wrong: none functional; the JNI glue itself is covered by `A0JniTest` on the host build and by the phone (Task 6).
  - **Everything crosses as strings except the seed (bytes).** The handle is a decimal string (a JS number is exact only to 2^53 and RN's bridge has no `long`), amounts / indices are canonical decimal u64 strings, field values 64 lowercase hex, `authId` 32 lowercase hex or `null`. **Rust parses all of them, with one spelling each** (no trimming, no `+`, no leading zero, no upper-case hex, no reduction of a value ≥ r); Kotlin refuses only what is not a byte / not a string. Cost if wrong: a caller that sends upper-case hex gets `E_A0_ARG` — the store and the relayer use lower-case already.
  - **The handle is not a `jlong`.** Considered and refused: a `jlong` would need Kotlin to parse JS's string (a second parser) or JS to send a double (lossy past 2^53). The `u64` counter (Task 1) is the handle; its decimal string is its one form.
  - **A malformed handle or `authId` at `prove` still uses the live approval up** (`Core::discard_auth` before the refusal), matching Task 3's "every prove consumes it first". An empty string is malformed, not "no authId" (`null` is). Tested; M-bridge-arg-keeps-auth, M-empty-authid-is-none.
  - **One envelope for every call** — `{"ok": …}` or `{"error": code, "message": Display}` — and **a stable code per variant**, `E_A0_` + the variant's name (an exhaustive `match`: a new variant does not compile without a code; the test derives each expected code from `Debug`, independently of the table). Kotlin adds `E_A0_ARG` (its own refusals), `E_A0_UNAVAILABLE` (the library did not load), `E_A0_INTERNAL` (null / unreadable result, any other throwable — whose message is not passed on). **A panic never crosses the JNI:** `envelope` catches it (`E_A0_INTERNAL`, a fixed message); under the lock it poisons the state, which wipes the keys (Task 1).
  - **The A0 natives are a separate Kotlin `object` (`NocturaA0Native`, static natives)**, not private members of the module, so a JVM test can call the real JNI without a React context; it is `internal`, reached only through the module. The v1 natives stay where they were (members of the module), unchanged, for M1b to delete.
  - **The v1 React method is renamed `proveV1`.** The spec's A0 call is `prove`; React methods cannot be overloaded, so one of the two had to move, and moving v1's makes M1b's removal a pure deletion. `nativeProve` (the JS export `localProver.ts` uses) keeps its signature; only the native method behind it changed. Cost if wrong: one rename in M1b instead.
  - **`parseUnshield` / `authorizeUnshield` are bound in Kotlin now, as `internal` module methods returning `A0Result`, without `@ReactMethod`.** §16's M1a row reads "the Kotlin binding of every JNI function except `parseUnshield` / `authorizeUnshield`"; the dispatch asked for them bound but Kotlin-only. Binding them now lets `ReactSurfaceTest` prove they are unreachable from JS (their absence would prove nothing) and lets `A0JniTest` exercise INV-AUTH's approved path through the real JNI. They are unused in production code until M1c's dialog.
  - **`prove` runs on one dedicated daemon thread** (`noctura-a0-prove`, a single-thread executor — proofs are serialized; a second waits); the other calls run on React Native's native-modules thread (neither the JS nor the UI thread; EIP-2333 + a few Poseidon are milliseconds). Proved by `proveRunsOnItsOwnThreadNotTheCallers` and K-prove-on-caller-thread.
  - **The JS zero-fill happens when the call SETTLES (`finally`), not right after the synchronous call.** Under the legacy bridge the argument array is serialized when the batch flushes, after the call returns — filling it earlier could send zeros. `bytes.fill(0)` and `seed.fill(0)` run on resolve, reject and synchronous throw (three tests). `a0KeysOpen` therefore CONSUMES the caller's `Uint8Array`; its JSDoc says so.
  - **A negative bigint never reaches native** (`RangeError` in JS) — the only JS-side validation; every other check is Rust's.
  - **The boundary is read three ways, each off the built thing:** the library's `Java_*` dynamic symbols (`check-jni-exports.sh`, `nm -D`, against `jni-exports.txt`); the compiled Kotlin classes (`ReactSurfaceTest`: the `@ReactMethod` set by reflection — RN's annotation is `RUNTIME`-retained — and the native methods against the same list); the JS module's runtime exports and the native methods its exports actually touch (a recording `Proxy`). Plus a Jest reading of the Kotlin source, because Jest is the reading CI runs. Every one has a negative control and a mutation.
  - **INV-NULL / INV-NK scan every output in four spellings** (hex lower / upper, decimal, base58) of the seed, `sk`, `viewKey`, `nk`, `ivk`, `dSelf`, `addrSelf` and every own note's `nullifier` / `rhoChange`, across every bound call (incl. refusals and `matchSpent` over all 32 subsets of the own nullifiers); the keyed test shows the nullifier in a withdraw_change proof's output exactly once, at `publicInputs[1]`, and nowhere else — the positive control that the scan sees a real occurrence. `A0JniTest` repeats the lower/upper-hex scan through the real JNI.
- **The key files and the host library, for tests (decided):** the keyed bridge test uses Task 3's `NOCTURA_A0_KEYS_DIR` / `A0-KEYS-SKIPPED` convention and is added to CI's interop assertion. The Kotlin JNI tests use `NOCTURA_A0_HOST_LIB_DIR` (the directory of the `jni-host` build), skip with `A0-JNI-SKIPPED` on stderr and as JUnit "skipped" (`Assume`), and fail under `CI`. **No CI job runs the Kotlin tests** (none builds the Android project; adding one means Node + the RN Gradle plugin + the SDK in a workflow — a decision for Task 5 or later, flagged).
- **Deviations from the brief / dispatch:**
  - The v1 binding stays but is renamed (`prove` → `proveV1`, above): it conflicted by name with the A0 `prove`.
  - `isSupported` stays the v1 module's `nativeIsSupported` (one symbol for both); the arm64-only rule is Task 5's and already holds in the APK (the prover is packaged for arm64-v8a only, so on any other ABI the load fails and `isSupported()` returns false).
  - The JS source test over `src/`, `core/`, `extension/src/`, `web/src/` (§14) is M1b's, as the spec tags it; this task's JS test is the bridge module's exact export list.
  - The host `jni-host` feature and the `__rust_probestack` stub are new test infrastructure (above); the app's build does not use either.
- **Found, outside this task (for the controller):**
  - **The documented rebuild command packages a stray library.** `cargo ndk -t arm64-v8a -o android/app/src/main/jniLibs build --release` (STATUS.md, the July plans) also copies `libark_circom-<hash>.so` (917,456 bytes) — ark-circom declares `crate-type = ["cdylib", "rlib"]` — into `jniLibs/arm64-v8a/`, and from there into the APK. `libnoctura_prover.so` does not need it (NEEDED lists only libc / libm / libdl). This dry run deleted it before building; **Task 5 should build without `-o` and copy `libnoctura_prover.so` alone, and its CI step could assert the APK's arm64 list.**
  - **The library exports 35 `wasmer_vm_*` symbols** (wasmer-vm, through ark-circom, never called) — present at the base too. They are not JNI and not a secret, but they keep wasmer's code alive in the `.so`; a linker version script exporting only `Java_*` would drop them (Task 5 / later; it changes the build of the device library, so it needs its own phone launch).
  - **This dry run's Gradle runs wrote into the main checkout's `node_modules/*/android/build`** (the clone's `node_modules` was a symlink to it during Steps 5–6): gitignored build intermediates of the same sources — the main checkout's `git status` stayed clean — but a writer instruction says never to write there. The APK builds and the Kotlin mutations then used a real copy. **Executors: a Gradle build needs its own `node_modules` (a real directory), not a symlink to another checkout's** — Metro also refuses the symlink (`Unable to resolve module @babel/runtime/helpers/interopRequireDefault` in `createBundleReleaseJsAndAssets`).
- **What the next tasks must know:** see Interfaces → "What later tasks rely on". In short: Task 5 reuses `check-jni-exports.sh` on the arm64 library and fixes the stray `libark_circom` copy; Task 6's harness sequence is `A0JniTest`'s; M1b deletes the three v1 lines from the three expected sets; M1c adds exactly one React method (the confirmation) to them.

#### Spec rev 3.2 lines (Task 4)
- §3 "JNI surface": **every argument but the seed crosses as a string in one canonical form, parsed in Rust** — the handle as the decimal of its `u64`; `depositIndex` / `amount` / `fee` as canonical decimal u64; `rho`, nullifiers, commitments as 64 lowercase hex; `authId` as 32 lowercase hex or `null`. **Every call returns one envelope** — `{"ok": value}` or `{"error": "E_A0_<VARIANT>", "message": …}` — with a stable code per refusal; a panic is `E_A0_INTERNAL` and never crosses the JNI.
- §3 `prove` at the JNI: **a malformed handle or `authId` is refused and still uses the live authorization up**; `""` is malformed, `null` is "none".
- §3 "Rust state" / threads: `prove` runs on **one dedicated proving thread** (proofs serialized); `keysOpen` … `commitment` on React Native's native-modules thread.
- §3 "The seed crosses as bytes": JS zero-fills its `number[]` **and the caller's `Uint8Array` when the call settles** (the legacy bridge serializes at flush time); `a0KeysOpen` consumes the caller's array.
- §14 / §16: `parseUnshield` / `authorizeUnshield` are **bound in Kotlin in M1a as `internal` methods without `@ReactMethod`** (so their unreachability from JS is a tested fact); the v1 React method is **`proveV1`** until M1b removes it.
- §14 "Boundary": the JNI surface test is **`nm -D` of the built library against `native/noctura-prover/jni-exports.txt`** (in CI on the host `jni-host` build; on the arm64 build by hand here, in CI from Task 5); the React-module test is **reflection over the compiled class** (JVM, not yet in CI) **and a reading of the Kotlin source** (Jest, in CI).


### Task 5: Removals and build — the old blst `NocturaKeyModule` / `libnoctura_key.so` gone (Kotlin module and package, `src/main/cpp/` CMake + C++, the commented Gradle `externalNativeBuild` stanza and the `**/libnoctura_key.so` packaging exclude, the JS `src/modules/keychain/nativeBridge.ts` and its one caller, the `.gitignore` lines) with a Jest guard that keeps it gone; the arm64-v8a library built by a committed `native/noctura-prover/build-android.sh` that installs `libnoctura_prover.so` ALONE into `jniLibs/` (no stray `libark_circom-<hash>.so`) and refuses any other file there; a linker version script (`exports.map`, linked by a new `build.rs`) so the library's dynamic symbol table is exactly the 10 JNI functions (45 → 10 on arm64 and on the host); `check-jni-exports.sh` made exact (every defined dynamic symbol, not only `Java_*`); the libc++ gate `check-needed.sh` (NEEDED ⊆ {libc, libm, libdl, liblog}, no C++ runtime); the arm64-only rule as code (`A0Abi`: on Android only an `aarch64` process loads the prover, so `isSupported()` is false on every other ABI) with its JVM test; the native-prover workflow cross-building the arm64 library with the app's NDK and running the gates and four negative controls; both APKs built (no `libnoctura_key.so` even with its stale intermediates planted, the prover under `lib/arm64-v8a/` only); 5 Kotlin JVM tests, 4 Jest tests, 16 named mutations (14 red, 2 stated survivors — each a second guard behind a first) + 9 controls

**Spec:** §12 "Removed … `NocturaKeyModule` / `libnoctura_key.so` and its CMake / Gradle stanzas — M1a"; §12 "The Rust `.so` (M1a): built for `arm64-v8a` only. The devnet shielded build is phone-only (m14): on any other ABI, emulators included, `isSupported()` is false … a `Cargo.lock` update in the same PR (CI runs `--locked`). A CI step, not a note (m15), builds the arm64 `.so` and fails if `readelf -d` lists `libc++_shared.so` (or any C++ runtime) as `NEEDED`"; §12 Build "the production build … 'unchanged' means functionally unchanged: every plan's checkpoint includes a production build of the same commit that launches on the phone (the libc++ lesson)"; §14 Boundary "a JNI surface test that the `.so` exports exactly §3's functions" (made exact here: nothing else is exported); §16 M1a row ("the native removal of `NocturaKeyModule` / `libnoctura_key.so` (§12); `Cargo.lock`, the `readelf` CI step, arm64-only (§12)"). **Not here:** every other §12 removal (the v1 JS flows, `noteSecret`, the hosted prover, `NPkc…`, the v1 `nativeProve` / `proveV1` — M1b); the phone launch of either APK (the M1a checkpoint, Task 6 — this task only builds them); a CI job for the Kotlin JVM tests (Notes: a known gap, kept).

**Files:**
- Delete: `android/app/src/main/java/com/nocturawallet/shieldedkey/NocturaKeyModule.kt`, `android/app/src/main/java/com/nocturawallet/shieldedkey/NocturaKeyPackage.kt`, `android/app/src/main/cpp/CMakeLists.txt`, `android/app/src/main/cpp/noctura_key_jni.cpp`, `src/modules/keychain/nativeBridge.ts`, `android/.gitignore` (its one line was the blst source path, and it never matched: the path is written from the repo root inside `android/`)
- Create: `native/noctura-prover/build.rs`, `native/noctura-prover/exports.map`, `native/noctura-prover/build-android.sh` (100755), `native/noctura-prover/check-needed.sh` (100755)
- Create (tests): `android/app/src/test/java/com/nocturawallet/prover/A0AbiTest.kt` (5), `src/modules/zkProver/__tests__/keyModuleRemoved.test.ts` (4)
- Modify: `native/noctura-prover/check-jni-exports.sh` (exact: the whole dynamic symbol table), `android/app/build.gradle` (the two stanzas out, one comment in), `android/app/src/main/java/com/nocturawallet/MainApplication.kt` (the commented registration and its notes out), `android/app/src/main/java/com/nocturawallet/prover/A0Bridge.kt` (`A0Abi`, the gated `NocturaNativeLib.ensureLoaded`, `A0Support`), `android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt` (`isSupported` through `A0Support`; its doc comment), `src/modules/keychain/keychainModule.ts` (the dead `deleteSeed` call out), `.github/workflows/native-prover.yml` (the `aarch64-linux-android` target, `android/build.gradle` in `paths`, four arm64 steps), `.gitignore` (the blst line out); comments only: `native/noctura-prover/src/android.rs`, `src/modules/keyDerivation/paths.ts`, `src/modules/keyDerivation/shielded.ts`, `src/modules/shielded/types.ts`, `native/noctura-prover/STATUS.md` (its Rebuild line), `README.md` (the stack line)
- **Not changed, on purpose:** `Cargo.toml` and **`Cargo.lock`** (a build script adds no dependency; `cargo build --locked` passes and `git diff --stat Cargo.lock` is empty); every Rust source but `android.rs`'s first two comment lines; `jni-exports.txt` (the same 10 names); `NocturaA0Native.kt`, `NocturaProverPackage.kt`; `src/modules/zkProver/nativeProverBridge.ts` (`isProverSupported()` already is `!!native && native.isSupported()` — the gate is Kotlin's); the historical documents that name blst (`BUILD_PLAN.md`, `docs/AUDIT_FINDINGS.md`, `docs/NATIVE_INTEGRATION_TODO.md`, `STATUS.md`'s Stage 1 log, the plans and specs) — records of what was, not code.

**Interfaces:**
- Consumes (Task 4): `jni-exports.txt` (the 10 names), `check-jni-exports.sh` (extended here), `NocturaNativeLib.ensureLoaded()` and its call sites (`isSupported`, `A0Promise.settle`, `NocturaProverModule.call`, `proveV1`), the host `jni-host` build and `A0JniTest` (`NOCTURA_A0_HOST_LIB_DIR`); Task 4's measured APK of 5c02d72 (`production.apk` 93,343,157 bytes) as the "before".
- Produces — scripts (`native/noctura-prover/`, each runnable from any directory):
  ```
  build-android.sh                # ANDROID_NDK_HOME required; cargo ndk -t arm64-v8a build --release --locked;
                                  # check-needed + check-jni-exports on the built library; installs it as
                                  # $NOCTURA_JNILIBS_DIR (default android/app/src/main/jniLibs)/arm64-v8a/libnoctura_prover.so;
                                  # exit 1 unless that is the ONLY file under jniLibs
  build-android.sh --verify-only  # the same checks on an installed tree, no build
  check-needed.sh <so>            # 0 = NEEDED ⊆ {libc.so, libdl.so, liblog.so, libm.so}; 1 = a C++ runtime or another
                                  # library NEEDED; 2 = unreadable / no NEEDED read (READELF overrides readelf)
  check-jni-exports.sh <so> [list]  # 0 = the defined dynamic symbols are exactly the list; 1 = a difference
                                  # (missing / extra printed); 2 = usage / no Java_* read (NM overrides nm)
  ```
- Produces — the link: `build.rs` emits `cargo:rustc-cdylib-link-arg=-Wl,--version-script=<crate>/exports.map` for `target_os` android and linux (the rlib, tests and examples are untouched); `exports.map` = `global: Java_*;` and `local:` the 35 `wasmer_vm_*` names by exact name, then `*`.
- Produces — Kotlin (`com.nocturawallet.prover`, `A0Bridge.kt`):
  ```kotlin
  internal object A0Abi { const val ARCH = "aarch64"; const val ART_VM_NAME = "Dalvik"
      fun allows(vmName: String?, osArch: String?): Boolean   // vmName != "Dalvik" || osArch == "aarch64"
      fun current(): Boolean }                                 // from java.vm.name / os.arch
  internal object NocturaNativeLib { fun ensureLoaded()        // = ensureLoaded(A0Abi.current())
      internal fun ensureLoaded(abiAllowed: Boolean) }         // throws UnsatisfiedLinkError("libnoctura_prover is built for arm64-v8a only") first
  internal object A0Support { fun check(load: () -> Unit, native: () -> Boolean): Boolean }   // any Throwable → false
  ```
  `NocturaProverModule.isSupported()` = `A0Support.check({ NocturaNativeLib.ensureLoaded() }) { nativeIsSupported() }`; every A0 call on a refused ABI is `E_A0_UNAVAILABLE` (the existing `UnsatisfiedLinkError` path).
- Produces — CI (`native-prover.yml`, after the host JNI checks): "Install the Android NDK of android/build.gradle and cargo-ndk", "Build the arm64-v8a library (build-android.sh) — libc++ gate, exact exports, one file", "Assert the arm64 library NEEDs no C++ runtime and exports exactly jni-exports.txt", "Assert the libc++ gate, the exact export check and the jniLibs check can fail".
- **What later tasks rely on:** **Task 6** — the library is built with `native/noctura-prover/build-android.sh` (never `cargo ndk -o`); its harness must show `isSupported()` true on the phone (an `aarch64` process: `adb shell getprop ro.product.cpu.abi` → `arm64-v8a`) and, if an x86_64 emulator is at hand, false there (the device half of the gate; Notes); the APK checks of Step 8 (`unzip -l`, the packaged library through `check-needed.sh` and `check-jni-exports.sh`) are the desk half of each checkpoint's production build; the first phone launch of a library linked with `exports.map` is Task 6's (the checkpoint). **M1b** — when it deletes `nativeProve`, `jni-exports.txt` loses a line and the exact check follows (no `exports.map` change: it globs `Java_*`); `keyModuleRemoved.test.ts` stays. **Anyone bumping ark-circom / wasmer** — a vanished `wasmer_vm_*` name fails the link, a new export fails the check: edit `exports.map` (Notes).

**The rule, stated once.** The app ships one project-local native library, built by one script for one ABI, and everything about it that matters at launch is read off the built file: what it NEEDs (no C++ runtime — the July crash), what it exports (the 10 JNI functions and nothing else), where it sits (`lib/arm64-v8a/` only, alone in `jniLibs/`). On any other ABI the app does not even try to load it. The old C++ module is not disabled but absent, and a test fails if any trace of it comes back.

- [ ] **Step 1: The removal guard — red on the base.**

Create `src/modules/zkProver/__tests__/keyModuleRemoved.test.ts`:

```ts
/**
 * The old native key module is gone and stays gone (spec 2026-11-08 shielded A0 M1 §12:
 * "NocturaKeyModule / libnoctura_key.so and its CMake / Gradle stanzas — M1a").
 *
 * It was a C++ blst (BLS12-381) bridge whose libnoctura_key.so brought its own NDK
 * libc++_shared.so and crashed every release build at launch (2026-06-30); the shielded spend
 * key now lives in the pure-Rust A0 core (native/noctura-prover). This test reads the app's
 * code trees — the JS sources, the Android project, the iOS project, the Rust crate — and fails
 * on any reference to the module, its library, its package, its JS bridge, blst, or a Gradle
 * externalNativeBuild stanza (the app's one native library is built by
 * native/noctura-prover/build-android.sh, not by Gradle). Markdown (history, plans) is not code
 * and is not read.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const SELF = path.relative(ROOT, __filename);

// This file names what it looks for (its comments, the positive control), so it is the one file
// not read (SELF).
const FORBIDDEN: Array<[string, RegExp]> = [
  ['the module / package / JS bridge', /NocturaKey(Module|Package|Bridge)/],
  ['the library', /noctura_key/],
  ['the Kotlin package', /com\.nocturawallet\.shieldedkey/],
  ['the JS bridge file', /keychain\/nativeBridge/],
  ['blst', /\bblst\b/i],
  ['a Gradle CMake stanza', /externalNativeBuild\s*\{/],
];

const TREES = ['src', 'android', 'ios', 'native/noctura-prover', 'index.js', 'globalBuffer.js', 'package.json'];
const SKIP_DIRS = new Set(['node_modules', 'build', '.gradle', '.cxx', 'Pods', 'target', 'artifacts', 'jniLibs', '.kotlin']);
const CODE = /\.(ts|tsx|js|mjs|cjs|json|kt|kts|java|gradle|properties|rs|toml|map|sh|txt|cpp|cc|c|h|hpp|swift|m|mm|pbxproj|xml|pro)$|^(Podfile|CMakeLists\.txt)$/;

function walk(rel: string, out: string[]): void {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    return;
  }
  const st = fs.statSync(abs);
  if (st.isFile()) {
    if (CODE.test(path.basename(rel)) && rel !== SELF) {
      out.push(rel);
    }
    return;
  }
  for (const name of fs.readdirSync(abs)) {
    if (!SKIP_DIRS.has(name)) {
      walk(path.join(rel, name), out);
    }
  }
}

function findings(text: string): string[] {
  return FORBIDDEN.filter(([, re]) => re.test(text)).map(([what]) => what);
}

const files: string[] = [];
TREES.forEach(t => walk(t, files));

describe('the old native key module (blst, libnoctura_key.so) is removed', () => {
  it('reads the trees it claims to (non-vacuous)', () => {
    expect(files.length).toBeGreaterThan(300);
    for (const known of [
      'android/app/build.gradle',
      'android/app/src/main/java/com/nocturawallet/MainApplication.kt',
      'native/noctura-prover/src/android.rs',
      'src/modules/keychain/keychainModule.ts',
      'src/modules/zkProver/nativeProverBridge.ts',
    ]) {
      expect(files).toContain(known);
    }
  });

  it('flags every kind of reference it looks for (positive control)', () => {
    expect(findings('import com.nocturawallet.shieldedkey.NocturaKeyPackage')).toEqual([
      'the module / package / JS bridge',
      'the Kotlin package',
    ]);
    expect(findings('System.loadLibrary("noctura_key")')).toEqual(['the library']);
    expect(findings("require('./keychain/nativeBridge')")).toEqual(['the JS bridge file']);
    expect(findings('#include "blst.h"')).toEqual(['blst']);
    expect(findings('    externalNativeBuild {')).toEqual(['a Gradle CMake stanza']);
    // Not references: the release-signing variables, the prover's own native bridge.
    expect(findings('System.getenv("NOCTURA_KEY_ALIAS")')).toEqual([]);
    expect(findings("from './nativeProverBridge'")).toEqual([]);
  });

  it('no code file references it', () => {
    const hits = files
      .map(f => ({f, what: findings(fs.readFileSync(path.join(ROOT, f), 'utf8'))}))
      .filter(h => h.what.length > 0);
    expect(hits).toEqual([]);
  });

  it('its files are gone', () => {
    for (const gone of [
      'android/app/src/main/cpp/CMakeLists.txt',
      'android/app/src/main/cpp/noctura_key_jni.cpp',
      'android/app/src/main/java/com/nocturawallet/shieldedkey',
      'src/modules/keychain/nativeBridge.ts',
    ]) {
      expect(fs.existsSync(path.join(ROOT, gone))).toBe(false);
    }
  });
});
```

Run it on the base tree (5c02d72 — a `git archive` copy with `node_modules` linked and this one file added):

```bash
npx jest src/modules/zkProver/__tests__/keyModuleRemoved.test.ts 2>&1 | grep -E '✓|✕|Tests:|"f":'
```

Expected (red for the right reason — the two reading tests pass, the two removal tests fail, naming each file):

```
    ✓ reads the trees it claims to (non-vacuous) (3 ms)
    ✓ flags every kind of reference it looks for (positive control) (2 ms)
    ✕ no code file references it (55 ms)
    ✕ its files are gone (1 ms)
    +     "f": "src/modules/keyDerivation/paths.ts",
    +     "f": "src/modules/keyDerivation/shielded.ts",
    +     "f": "src/modules/keychain/keychainModule.ts",
    +     "f": "src/modules/keychain/nativeBridge.ts",
    +     "f": "src/modules/shielded/types.ts",
    +     "f": "android/app/build.gradle",
    +     "f": "android/app/src/main/cpp/CMakeLists.txt",
    +     "f": "android/app/src/main/cpp/noctura_key_jni.cpp",
    +     "f": "android/app/src/main/java/com/nocturawallet/MainApplication.kt",
    +     "f": "android/app/src/main/java/com/nocturawallet/prover/A0Bridge.kt",
    +     "f": "android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt",
    +     "f": "android/app/src/main/java/com/nocturawallet/shieldedkey/NocturaKeyModule.kt",
    +     "f": "android/app/src/main/java/com/nocturawallet/shieldedkey/NocturaKeyPackage.kt",
    +     "f": "native/noctura-prover/src/android.rs",
Tests:       2 failed, 2 passed, 4 total
```

- [ ] **Step 2: The removals — green.**

```bash
git rm -q android/app/src/main/java/com/nocturawallet/shieldedkey/NocturaKeyModule.kt \
  android/app/src/main/java/com/nocturawallet/shieldedkey/NocturaKeyPackage.kt \
  android/app/src/main/cpp/CMakeLists.txt android/app/src/main/cpp/noctura_key_jni.cpp \
  src/modules/keychain/nativeBridge.ts android/.gitignore
```

The JS bridge's one caller was `KeychainManager.wipeKeys`, which `require`d it and called `NocturaKeyBridge.deleteSeed()` inside a `try { … } catch {}`. That call always threw — `NativeModules.NocturaKeyModule` was never registered (Android: commented out since 2026-06-30; iOS: never written), and the Kotlin module never had a `deleteSeed` even when it was — so removing the block changes no behaviour; `keychainModule.test.ts`'s `wipeKeys` test passes unchanged. **Decided (dispatch: "a typed refusal or stub"): neither — the caller is not an M1b v1 flow but dead code, so it is deleted, not stubbed.** The other edits (each file's diff alone):

```diff
diff --git a/android/app/build.gradle b/android/app/build.gradle
index d8cf237..f282a74 100644
--- a/android/app/build.gradle
+++ b/android/app/build.gradle
@@ -134,18 +134,9 @@ android {
         versionCode 1
         versionName "1.0.0"
     }
-    // Native blst module (libnoctura_key.so) is DISABLED: it bundles its own NDK-27
-    // libc++_shared.so which conflicts with React Native's at startup, crashing every
-    // release build on launch (verified on-device 2026-06-30, OnePlus 9 Pro). C2
-    // shielded uses the JS view-key model and never calls native, so this is safe.
-    // RE-ENABLE only with the libc++ conflict fixed (ANDROID_STL=c++_static in the
-    // CMake build) + on-device verification, when native shielded ops are needed
-    // (Project 2 / withdraw recoverability). See project_native_libcpp_crash memory.
-    // externalNativeBuild {
-    //     cmake {
-    //         path "src/main/cpp/CMakeLists.txt"
-    //     }
-    // }
+    // The app's one project-local native library is libnoctura_prover.so (pure Rust, arm64-v8a
+    // only), built and installed into src/main/jniLibs/ by native/noctura-prover/build-android.sh
+    // — not by Gradle (no externalNativeBuild). It NEEDs no C++ runtime (check-needed.sh, CI).
     testOptions {
         unitTests.all { test ->
             // A0JniTest loads the HOST build of libnoctura_prover.so (`cargo build --release
@@ -160,13 +151,6 @@ android {
             }
         }
     }
-    packagingOptions {
-        jniLibs {
-            // Exclude any stale libnoctura_key.so from build intermediates so the
-            // disabled module can't sneak its conflicting libc++_shared into the APK.
-            excludes += ["**/libnoctura_key.so"]
-        }
-    }
     signingConfigs {
         debug {
             storeFile file('debug.keystore')
```

```diff
diff --git a/android/app/src/main/java/com/nocturawallet/MainApplication.kt b/android/app/src/main/java/com/nocturawallet/MainApplication.kt
index 9ee8ce8..1e97131 100644
--- a/android/app/src/main/java/com/nocturawallet/MainApplication.kt
+++ b/android/app/src/main/java/com/nocturawallet/MainApplication.kt
@@ -8,14 +8,6 @@ import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
 import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
 import com.nocturawallet.screensecurity.NocturaScreenSecurityPackage
 import com.nocturawallet.prover.NocturaProverPackage
-// NocturaKeyPackage (native blst, C1) is DISABLED: libnoctura_key.so bundles its
-// own NDK libc++_shared.so which conflicts with React Native's at startup and
-// crashes every release build on launch. C2 shielded uses the JS view-key model
-// and never calls native, so disabling it is safe. RE-ENABLE only with the libc++
-// conflict fixed (build libnoctura with ANDROID_STL=c++_static) + on-device
-// verification, when native shielded ops are needed (Project 2 / withdraw
-// recoverability). See project_native_libcpp_crash memory.
-// import com.nocturawallet.shieldedkey.NocturaKeyPackage
 
 class MainApplication : Application(), ReactApplication {
 
@@ -27,9 +19,8 @@ class MainApplication : Application(), ReactApplication {
           // Project-local native modules (not auto-linked because they're not
           // distributed as separate npm packages).
           add(NocturaScreenSecurityPackage())
-          // add(NocturaKeyPackage()) // disabled — libc++ startup-crash (see import note)
-          // Pure-Rust prover (libnoctura_prover.so: libc/libm/libdl only, NO
-          // libc++_shared — readelf-verified) → safe to enable, unlike blst above.
+          // Pure-Rust prover and A0 core (libnoctura_prover.so: libc/libm/libdl only,
+          // no C++ runtime — native/noctura-prover/check-needed.sh, in CI).
           add(NocturaProverPackage())
         },
     )
```

```diff
diff --git a/src/modules/keychain/keychainModule.ts b/src/modules/keychain/keychainModule.ts
index 9060d5b..7eecf1a 100644
--- a/src/modules/keychain/keychainModule.ts
+++ b/src/modules/keychain/keychainModule.ts
@@ -35,10 +35,11 @@ const KEYCHAIN_OPTIONS = {
  *   - View key (retrievable without biometric — read-only)
  *   - PIN hash + salt (for PIN fallback unlock)
  *
- * For shielded signing (sk_spend), see nativeBridge.ts — never stored in JS.
+ * The shielded spend key never exists in JS: the A0 core derives it inside Rust
+ * (native/noctura-prover, reached via src/modules/zkProver/nativeProverBridge.ts).
  *
  * Current: react-native-keychain provides OS-level encryption (iOS Keychain / Android Keystore).
- * Upgrade path: When native BLST modules are integrated, seed storage will use P-256 ECDH
+ * Upgrade path: with seed-in-native, seed storage will use P-256 ECDH
  * envelope encryption via iOS Secure Enclave / Android StrongBox for an additional layer
  * (P-256 key in SE produces AES-256-GCM key → encrypt seed). See .instructions.md lines 62-67.
  */
@@ -139,13 +140,6 @@ export class KeychainManager {
     await Keychain.resetGenericPassword({service: SERVICE_VIEW_KEY});
     await Keychain.resetGenericPassword({service: SERVICE_PIN_HASH});
     await Keychain.resetGenericPassword({service: SERVICE_PIN_SALT});
-    // Also wipe native-stored seed if native module is available
-    try {
-      const {NocturaKeyBridge} = require('./nativeBridge');
-      await NocturaKeyBridge.deleteSeed();
-    } catch {
-      // Native module not available yet — safe to ignore during development
-    }
   }
 
   async setupPin(pin: string): Promise<void> {
```

```diff
diff --git a/src/modules/keyDerivation/paths.ts b/src/modules/keyDerivation/paths.ts
index 0842968..c281d68 100644
--- a/src/modules/keyDerivation/paths.ts
+++ b/src/modules/keyDerivation/paths.ts
@@ -7,7 +7,7 @@
  *   - EIP-2333 indices are implicitly hardened (no apostrophes)
  *
  * ⛔ sk_spend (m/12381/371/1/0) is NEVER derived in JavaScript.
- *    It exists only in native code (BLST via iOS CryptoKit / Android KeyStore).
+ *    It exists only inside the Rust A0 core (native/noctura-prover, src/a0).
  *    The path constant is exported for documentation only.
  */
 
```

```diff
diff --git a/src/modules/keyDerivation/shielded.ts b/src/modules/keyDerivation/shielded.ts
index 21e384e..ad5297f 100644
--- a/src/modules/keyDerivation/shielded.ts
+++ b/src/modules/keyDerivation/shielded.ts
@@ -3,9 +3,8 @@
  *
  * ⛔ SECURITY BOUNDARY: This file contains ONLY view and disclosure key derivation.
  *    deriveShieldedSpendKey() MUST NOT exist in any JS/TS file.
- *    Spend key derivation lives exclusively in native code:
- *      - iOS: NocturaSecureEnclave.swift (BLST via C interop)
- *      - Android: NocturaKeyStore.kt (BLST via JNI)
+ *    Spend key derivation lives exclusively in the Rust A0 core
+ *    (native/noctura-prover, src/a0 — Android, arm64-v8a; no iOS build yet).
  *
  * Library: micro-key-producer/bls.js (EIP-2333)
  *   ⚠️ NOT @scure/bip32 — BIP-32 is invalid for BLS12-381 (>54% of derived keys
@@ -39,5 +38,6 @@ export function deriveDisclosureKey(seed: Uint8Array, index: number): Uint8Array
 }
 
 // ⛔ deriveShieldedSpendKey() DOES NOT EXIST here.
-// For shielded signing, call the native bridge:
-//   NocturaKeyModule.signShieldedOp(payload)
+// The A0 spend key (m/12381/371/1/0) is derived inside Rust only
+// (native/noctura-prover, src/a0); JS reaches it through the opaque handle of
+// src/modules/zkProver/nativeProverBridge.ts (a0KeysOpen … a0Prove).
```

```diff
diff --git a/src/modules/shielded/types.ts b/src/modules/shielded/types.ts
index ae7f514..dc495d0 100644
--- a/src/modules/shielded/types.ts
+++ b/src/modules/shielded/types.ts
@@ -67,7 +67,7 @@ export type ShieldedScreenStep = 'input' | 'confirm' | 'consolidating' | 'provin
  * Provides real witness data for ZK proof generation.
  * Implementation requires:
  * - MerkleModule for Merkle paths
- * - Native BLST bridge for noteSecret derivation from sk_view
+ * - a native noteSecret derivation from sk_view (v1; removed with the v1 path in M1b)
  *
  * Until both are available, the provider is null and shielded
  * operations throw rather than silently using zero witnesses.
```

```diff
diff --git a/native/noctura-prover/src/android.rs b/native/noctura-prover/src/android.rs
index 897530b..eb56ba7 100644
--- a/native/noctura-prover/src/android.rs
+++ b/native/noctura-prover/src/android.rs
@@ -1,5 +1,5 @@
-//! Pure-Rust JNI bridge for the Android `NocturaProver` native module. No C++ glue,
-//! no libc++_shared → the blst-style libc++ startup conflict does not apply.
+//! Pure-Rust JNI bridge for the Android `NocturaProver` native module. No C++ glue and no C++
+//! runtime NEEDED (check-needed.sh), so it cannot bring a second libc++_shared into the app.
 //!
 //! Two Kotlin classes bind here, and `jni-exports.txt` lists every symbol (the export check
 //! compares it with the built library's dynamic symbols):
```

```diff
diff --git a/.gitignore b/.gitignore
index 3e803c0..ecb9cc2 100644
--- a/.gitignore
+++ b/.gitignore
@@ -98,7 +98,6 @@ claude-desktop-skills/
 android/app/src/main/assets/index.android.bundle
 android/app/src/main/assets/index.android.bundle.hbc
 android/app/src/main/assets/index.android.bundle.map
-android/app/src/main/cpp/blst/
 
 # M1 prover spike (large ZK artifacts + Rust build)
 native/noctura-prover/artifacts/*
```

```diff
diff --git a/README.md b/README.md
index c9fc024..d3a0edc 100644
--- a/README.md
+++ b/README.md
@@ -16,7 +16,7 @@ Privacy-first mobile wallet for Solana with shielded transactions, zero-knowledg
 - React Native 0.84.1 (New Architecture / Fabric / Hermes)
 - @solana/web3.js >= 1.95.8 (v1.x — migrate to @solana/kit when Anchor supports it)
 - Groth16/BN254 ZK proofs via @callstack/polygen AOT + hosted prover
-- BLST (Supranational) for native BLS12-381 signing
+- Pure-Rust native core (`native/noctura-prover`, arkworks): shielded keys and Groth16 proving on device (Android arm64)
 - Zustand + MMKV + NativeWind v4
 
 ## License
```

```diff
diff --git a/native/noctura-prover/STATUS.md b/native/noctura-prover/STATUS.md
index b0172ef..600ec4a 100644
--- a/native/noctura-prover/STATUS.md
+++ b/native/noctura-prover/STATUS.md
@@ -37,7 +37,7 @@ verify → on-chain-format serialize, all validated in pure Rust from the real a
 
 **On-device (user):** sideload → **launch = libc++ gate** → Settings → "🔧 Native prover test (dev)" → confirm native prove succeeds + publicInputs match hosted. (Only arm64 devices — the APK's other ABIs lack the prover `.so`.)
 
-**Rebuild:** `cargo ndk -t arm64-v8a -o ../../android/app/src/main/jniLibs build --release` (ANDROID_NDK_HOME set), then `ENVFILE=.env.devnet ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease` in `android/`.
+**Rebuild (superseded 2026-11, M1a):** `ANDROID_NDK_HOME=… native/noctura-prover/build-android.sh` — it installs `libnoctura_prover.so` ALONE into `jniLibs/arm64-v8a/` (the old `cargo ndk -o …` also copied a stray `libark_circom-<hash>.so` into the APK) after the libc++ gate (`check-needed.sh`) and the exact export check (`check-jni-exports.sh`); then `ENVFILE=.env.devnet ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease` in `android/`.
 
 ## ✅✅✅ STAGE 2 CONFIRMED ON-CHAIN (2026-07-17) — M1 COMPLETE
 
```

(`A0Bridge.kt` and `NocturaProverModule.kt` lose their "blst lesson" comments in Step 6, with their code change.)

```bash
npx jest src/modules/zkProver/__tests__/keyModuleRemoved.test.ts src/modules/keychain 2>&1 | grep -E '^(PASS|FAIL)|Tests:'
G=':!src/modules/zkProver/__tests__/keyModuleRemoved.test.ts'
git grep -n -E 'NocturaKey(Module|Package|Bridge)|noctura_key|shieldedkey|keychain/nativeBridge|externalNativeBuild *\{' -- . ':!*.md' "$G"; echo "grep 1: $?"
git grep -n -i -w blst -- src android ios native index.js package.json ':!*.md' "$G"; echo "grep 2: $?"
```

Expected (both greps find nothing — exit 1; the only code file that still names the module is the guard itself, which excludes itself; Markdown history is not read):

```
PASS src/modules/zkProver/__tests__/keyModuleRemoved.test.ts
PASS src/modules/keychain/__tests__/pinLockout.test.ts
PASS src/modules/keychain/__tests__/secureStorageKey.test.ts
PASS src/modules/keychain/__tests__/pinManager.test.ts
PASS src/modules/keychain/__tests__/keychainModule.test.ts
Tests:       39 passed, 39 total
```

```
grep 1: 1
grep 2: 1
```

- [ ] **Step 3: The exact export check — red on the Task 4 library.**

Replace `native/noctura-prover/check-jni-exports.sh` (Task 4 compared only the `Java_*` symbols; now the whole defined dynamic symbol table must equal the list):

```diff
diff --git a/native/noctura-prover/check-jni-exports.sh b/native/noctura-prover/check-jni-exports.sh
index 65bd6eb..2e95b5d 100755
--- a/native/noctura-prover/check-jni-exports.sh
+++ b/native/noctura-prover/check-jni-exports.sh
@@ -1,8 +1,10 @@
 #!/usr/bin/env bash
-# The JNI export check (spec §14 "Boundary"): the Java_* symbols a built libnoctura_prover.so
-# exports must be exactly jni-exports.txt — no missing one, no extra one. Works on the arm64
-# library (`cargo ndk -t arm64-v8a build --release`) and on the host one (`cargo build --release
-# --features jni-host`): the same #[no_mangle] functions are exported by both.
+# The JNI export check (spec §14 "Boundary"): the symbols a built libnoctura_prover.so exports
+# must be exactly jni-exports.txt — no missing one, no extra one, and NOTHING that is not on the
+# list (not only no extra Java_*: no symbol at all). Works on the arm64 library
+# (`./build-android.sh`) and on the host one (`cargo build --release --features jni-host`): both
+# are linked with exports.map (build.rs), which leaves exactly the listed Java_* functions in the
+# dynamic symbol table.
 #
 #   ./check-jni-exports.sh <path/to/libnoctura_prover.so> [expected-list]
 #
@@ -15,12 +17,12 @@ list="${2:-$(dirname "$0")/jni-exports.txt}"
 nm_bin="${NM:-nm}"
 [ -f "$so" ] || { echo "no such library: $so" >&2; exit 2; }
 want=$(grep -vE '^\s*(#|$)' "$list" | sort -u)
-got=$("$nm_bin" -D --defined-only "$so" | awk '{print $NF}' | grep -E '^Java_' | sort -u || true)
+got=$("$nm_bin" -D --defined-only "$so" | awk '{print $NF}' | sort -u || true)
 [ -n "$want" ] || { echo "the expected list $list is empty" >&2; exit 2; }
-[ -n "$got" ] || { echo "no Java_* symbols read from $so — wrong file or nm failed" >&2; exit 2; }
+echo "$got" | grep -qE '^Java_' || { echo "no Java_* symbols read from $so — wrong file or nm failed" >&2; exit 2; }
 if [ "$want" != "$got" ]; then
-  echo "JNI exports of $so differ from $list:" >&2
+  echo "dynamic exports of $so differ from $list:" >&2
   diff <(echo "$want") <(echo "$got") | sed -n 's/^< /  missing: /p; s/^> /  extra:   /p' >&2
   exit 1
 fi
-echo "JNI exports match $list: $(echo "$got" | wc -l) symbols"
+echo "exports match $list exactly: $(echo "$got" | wc -l) symbols, nothing else"
```

On the library Task 4 built (no version script; `cargo ndk -t arm64-v8a build --release --locked` at 5c02d72, 7,275,744 bytes):

```bash
nm -D --defined-only $SO | awk '{print $NF}' | sort | wc -l
nm -D --defined-only $SO | awk '{print $NF}' | grep -vc '^Java_'
./check-jni-exports.sh $SO; echo "exit $?"
```

Expected (red: the 35 `wasmer_vm_*` libcalls of wasmer-vm, linked through ark-circom and never called):

```
45
35
dynamic exports of …/aarch64-linux-android/release/libnoctura_prover.so differ from ./jni-exports.txt:
  extra:   wasmer_vm_data_drop
  extra:   wasmer_vm_elem_drop
  … (35 "extra:" lines in all, ending)
  extra:   wasmer_vm_table_size
exit 1
```

The host `jni-host` build is red the same way (the same 35 names: `diff` of the two non-`Java_` lists is empty).

- [ ] **Step 4: `exports.map` and `build.rs` — 45 → 10, arm64 and host.**

**Measured first, why a plain version script is not enough:** rustc hands the linker its own version script naming every `#[no_mangle]` function of every linked crate as global. A user script with `global: Java_*; local: *;` (passed as `-C link-arg=-Wl,--version-script=…`) left all 35 in place (7,275,744 bytes, 35 non-JNI exports); `-Wl,--retain-symbols-file` (the 10 names) changed nothing either. The same script naming the 35 **exactly** under `local:` gave 0. So the names are listed. Create `native/noctura-prover/exports.map`:

```text
/* The dynamic exports of libnoctura_prover.so (linked with this by build.rs, Android and Linux).
 *
 * Exactly the JNI functions stay global: check-jni-exports.sh compares the built library's whole
 * dynamic symbol table with jni-exports.txt. Everything else is local.
 *
 * Why the names below are listed one by one: rustc passes the linker its OWN version script,
 * which names every #[no_mangle] function of every linked crate as global — here wasmer-vm's 35
 * `wasmer_vm_*` libcalls (wasmer comes in through ark-circom and is never called; witnesses run
 * in wasmi). A glob (`local: *;`, or `wasmer_vm_*`) loses to rustc's exact names; an exact name
 * here wins over rustc's (measured with the NDK 27.1 lld for arm64 and rustc 1.90's rust-lld on
 * the x86_64 host: 45 defined dynamic symbols before, 10 after). If a dependency update drops one
 * of these names, the link is refused (rustc passes --no-undefined-version: "version script
 * assignment of 'local' to symbol … failed: symbol not defined"); if it adds a new export,
 * check-jni-exports.sh fails on it. Both are loud; neither is silent.
 */
{
  global:
    Java_*;
  local:
    wasmer_vm_data_drop;
    wasmer_vm_elem_drop;
    wasmer_vm_externref_dec;
    wasmer_vm_externref_inc;
    wasmer_vm_f32_ceil;
    wasmer_vm_f32_floor;
    wasmer_vm_f32_nearest;
    wasmer_vm_f32_trunc;
    wasmer_vm_f64_ceil;
    wasmer_vm_f64_floor;
    wasmer_vm_f64_nearest;
    wasmer_vm_f64_trunc;
    wasmer_vm_func_ref;
    wasmer_vm_imported_memory32_copy;
    wasmer_vm_imported_memory32_fill;
    wasmer_vm_imported_memory32_grow;
    wasmer_vm_imported_memory32_size;
    wasmer_vm_imported_table_get;
    wasmer_vm_imported_table_grow;
    wasmer_vm_imported_table_set;
    wasmer_vm_imported_table_size;
    wasmer_vm_memory32_copy;
    wasmer_vm_memory32_fill;
    wasmer_vm_memory32_grow;
    wasmer_vm_memory32_init;
    wasmer_vm_memory32_size;
    wasmer_vm_probestack;
    wasmer_vm_raise_trap;
    wasmer_vm_table_copy;
    wasmer_vm_table_fill;
    wasmer_vm_table_get;
    wasmer_vm_table_grow;
    wasmer_vm_table_init;
    wasmer_vm_table_set;
    wasmer_vm_table_size;
    *;
};
```

Create `native/noctura-prover/build.rs`:

```rust
//! Links libnoctura_prover.so (the cdylib) with exports.map, so its dynamic symbol table holds
//! exactly the JNI functions of jni-exports.txt and nothing else (spec §12, §14 "Boundary";
//! checked by check-jni-exports.sh on the built library). Android (the app's library) and Linux
//! (the host `jni-host` build CI and the Kotlin JVM test use) only: both link with an ELF linker
//! that takes `--version-script`. The rlib, the tests and the examples are unaffected —
//! `rustc-cdylib-link-arg` reaches the cdylib's link alone.

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=exports.map");
    let os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if os == "android" || os == "linux" {
        let map = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("exports.map");
        println!(
            "cargo:rustc-cdylib-link-arg=-Wl,--version-script={}",
            map.display()
        );
    }
}
```

```bash
cd native/noctura-prover
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 cargo ndk -t arm64-v8a build --release --locked 2>&1 | tail -1
SO=$CARGO_TARGET_DIR/aarch64-linux-android/release/libnoctura_prover.so   # or target/…
wc -c < $SO; ./check-jni-exports.sh $SO; nm -D --defined-only $SO; readelf -d $SO | grep NEEDED
cargo build --release --locked --features jni-host 2>&1 | tail -1
./check-jni-exports.sh $CARGO_TARGET_DIR/release/libnoctura_prover.so
git diff --stat Cargo.lock     # prints nothing
```

Expected:

```
    Finished `release` profile [optimized] target(s) in 23.53s
7157320
exports match ./jni-exports.txt exactly: 10 symbols, nothing else
00000000001f599c T Java_com_nocturawallet_prover_NocturaA0Native_authorizeUnshield
00000000001f4e54 T Java_com_nocturawallet_prover_NocturaA0Native_commitment
00000000001f49c8 T Java_com_nocturawallet_prover_NocturaA0Native_depositRho
00000000001f48f0 T Java_com_nocturawallet_prover_NocturaA0Native_keysClose
00000000001f47e4 T Java_com_nocturawallet_prover_NocturaA0Native_keysOpen
00000000001f4b8c T Java_com_nocturawallet_prover_NocturaA0Native_matchSpent
00000000001f56f8 T Java_com_nocturawallet_prover_NocturaA0Native_parseUnshield
00000000001f5100 T Java_com_nocturawallet_prover_NocturaA0Native_prove
00000000001f34f4 T Java_com_nocturawallet_prover_NocturaProverModule_nativeIsSupported
00000000001f34fc T Java_com_nocturawallet_prover_NocturaProverModule_nativeProve
 0x0000000000000001 (NEEDED)             Shared library: [libdl.so]
 0x0000000000000001 (NEEDED)             Shared library: [libm.so]
 0x0000000000000001 (NEEDED)             Shared library: [libc.so]
    Finished `release` profile [optimized] target(s) in 20.04s
exports match ./jni-exports.txt exactly: 10 symbols, nothing else
```

`nm -D --defined-only` before / after: **45 symbols (10 `Java_*` + 35 `wasmer_vm_*`) → 10**, on both the arm64 and the host library; the unstripped arm64 library shrinks 7,275,744 → 7,157,320 bytes (the linker drops wasmer code nothing reaches any more). NEEDED unchanged. A name in `exports.map` that the link does not define is refused, measured: `rust-lld: error: version script assignment of 'local' to symbol 'wasmer_vm_no_such_symbol' failed: symbol not defined` (rustc passes `--no-undefined-version`).

- [ ] **Step 5: The libc++ gate and the build script.**

Create `native/noctura-prover/check-needed.sh`:

```bash
#!/usr/bin/env bash
# The libc++ gate (spec §12 "The Rust .so", m15; the July lesson: a native library that brought
# its own libc++_shared.so crashed every release build at launch). The Android library's
# DT_NEEDED entries must be a subset of the platform's C libraries — libc.so, libm.so, libdl.so,
# liblog.so — and none may be a C++ runtime (libc++_shared, libc++, libstdc++, libgnustl, …).
#
#   ./check-needed.sh <path/to/arm64 libnoctura_prover.so>
#
# Reads the dynamic section with `readelf -d` (binutils or llvm-readelf; READELF overrides).
# Exit 0 = only allowed entries; 1 = a C++ runtime or another library is NEEDED (printed);
# 2 = usage / not an ELF shared object with a dynamic section / no NEEDED entry read at all (an
# empty read is a failure, never a vacuous pass — every Android .so needs at least libc.so).
set -euo pipefail
so="${1:?usage: $0 <libnoctura_prover.so>}"
readelf_bin="${READELF:-readelf}"
allowed="libc.so libdl.so liblog.so libm.so"
[ -f "$so" ] || { echo "no such library: $so" >&2; exit 2; }
dyn=$("$readelf_bin" -d "$so" 2>/dev/null) || { echo "readelf could not read $so" >&2; exit 2; }
needed=$(echo "$dyn" | sed -n 's/.*(NEEDED).*\[\(.*\)\]$/\1/p' | sort -u)
[ -n "$needed" ] || { echo "no NEEDED entry read from $so — wrong file or readelf failed" >&2; exit 2; }
bad=0
while IFS= read -r lib; do
  if echo "$lib" | grep -qiE 'c\+\+|stdc|gnustl|stlport'; then
    echo "  C++ runtime NEEDED: $lib" >&2
    bad=1
  elif ! echo " $allowed " | grep -qF " $lib "; then
    echo "  not allowed NEEDED: $lib (allowed: $allowed)" >&2
    bad=1
  fi
done <<< "$needed"
if [ "$bad" -ne 0 ]; then
  echo "$so fails the libc++ gate" >&2
  exit 1
fi
echo "NEEDED of $so: $(echo "$needed" | tr '\n' ' ')— no C++ runtime"
```

Create `native/noctura-prover/build-android.sh`:

```bash
#!/usr/bin/env bash
# Builds libnoctura_prover.so for arm64-v8a — the one ABI it is built for (spec §12) — and
# installs it, ALONE, into android/app/src/main/jniLibs/arm64-v8a/, where Gradle packages it.
#
#   ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 native/noctura-prover/build-android.sh
#   native/noctura-prover/build-android.sh --verify-only     # check an installed tree, no build
#
# Why not `cargo ndk -o <jniLibs> build`: `-o` copies every cdylib of the build, and ark-circom
# declares `crate-type = ["cdylib", "rlib"]`, so it also drops libark_circom-<hash>.so (917 KB,
# needed by nothing) into jniLibs and from there into the APK. This script copies the one file.
#
# Before installing, the built library must pass the libc++ gate (check-needed.sh) and the exact
# export check (check-jni-exports.sh). After installing, jniLibs must hold exactly
# arm64-v8a/libnoctura_prover.so: any other file — a stale libark_circom from an old `-o` build,
# a library for another ABI — fails the script (it never deletes what it did not write; remove
# the file and run it again). NOCTURA_JNILIBS_DIR overrides the destination (CI, the controls).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dest="${NOCTURA_JNILIBS_DIR:-$here/../../android/app/src/main/jniLibs}"
installed="$dest/arm64-v8a/libnoctura_prover.so"

verify_tree() {
  [ -d "$dest" ] || { echo "no jniLibs directory: $dest" >&2; return 1; }
  local found
  found=$(cd "$dest" && find . -mindepth 1 \( -type f -o -type l \) | sort)
  if [ "$found" != "./arm64-v8a/libnoctura_prover.so" ]; then
    echo "jniLibs ($dest) must hold exactly arm64-v8a/libnoctura_prover.so; it holds:" >&2
    echo "${found:-  (nothing)}" | sed 's/^/  /' >&2
    return 1
  fi
  "$here/check-needed.sh" "$installed"
  "$here/check-jni-exports.sh" "$installed"
}

if [ "${1:-}" = "--verify-only" ]; then
  verify_tree
  echo "jniLibs OK: arm64-v8a/libnoctura_prover.so only"
  exit 0
fi
[ $# -eq 0 ] || { echo "usage: $0 [--verify-only]" >&2; exit 2; }
: "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME to the NDK of android/build.gradle (ndkVersion 27.1.12297006)}"

cd "$here"
cargo ndk -t arm64-v8a build --release --locked
target=$(cargo metadata --format-version 1 --no-deps | sed -n 's/.*"target_directory":"\([^"]*\)".*/\1/p')
built="$target/aarch64-linux-android/release/libnoctura_prover.so"
[ -f "$built" ] || { echo "the build produced no $built" >&2; exit 1; }
"$here/check-needed.sh" "$built"
"$here/check-jni-exports.sh" "$built"

mkdir -p "$dest/arm64-v8a"
cp "$built" "$installed.tmp"
mv -f "$installed.tmp" "$installed"
verify_tree
echo "installed $installed ($(wc -c < "$installed") bytes)"
```

```bash
chmod +x native/noctura-prover/check-needed.sh native/noctura-prover/build-android.sh
native/noctura-prover/build-android.sh; echo "exit $?"                     # without ANDROID_NDK_HOME
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 native/noctura-prover/build-android.sh 2>&1 | grep -v Compiling
find android/app/src/main/jniLibs -type f
```

Expected (paths shortened):

```
./build-android.sh: line 41: ANDROID_NDK_HOME: set ANDROID_NDK_HOME to the NDK of android/build.gradle (ndkVersion 27.1.12297006)
exit 1
    Building arm64-v8a (aarch64-linux-android)
    Finished `release` profile [optimized] target(s) in 0.15s
NEEDED of …/aarch64-linux-android/release/libnoctura_prover.so: libc.so libdl.so libm.so — no C++ runtime
exports match …/native/noctura-prover/jni-exports.txt exactly: 10 symbols, nothing else
NEEDED of …/jniLibs/arm64-v8a/libnoctura_prover.so: libc.so libdl.so libm.so — no C++ runtime
exports match …/native/noctura-prover/jni-exports.txt exactly: 10 symbols, nothing else
installed …/android/app/src/main/jniLibs/arm64-v8a/libnoctura_prover.so (7157320 bytes)
android/app/src/main/jniLibs/arm64-v8a/libnoctura_prover.so
```

The controls, each with the NDK's own compilers (`cc=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android24-clang`):

| control | how | result |
|---|---|---|
| a library that NEEDs libc++_shared.so | `$cc++ -shared -fPIC` of a `std::to_string` call | `check-needed.sh` exit 1: `C++ runtime NEEDED: libc++_shared.so` |
| a library that NEEDs libz.so | `$cc -shared -fPIC -Wl,--no-as-needed -lz` | exit 1: `not allowed NEEDED: libz.so (allowed: libc.so libdl.so liblog.so libm.so)` |
| the host `jni-host` library | as built | exit 1: `not allowed NEEDED: ld-linux-x86-64.so.2`, `libc.so.6`, `libgcc_s.so.1`, `libm.so.6` (the gate is the Android library's) |
| an object file / a text file | `$cc -c`; `jni-exports.txt` | exit 2: `no NEEDED entry read …` / `readelf could not read …` |
| the JNI list plus one export | the 10 names + `wasmer_vm_probestack` as empty C functions | `check-jni-exports.sh` exit 1: `extra:   wasmer_vm_probestack` |
| jniLibs with cargo-ndk's stray copy | `NOCTURA_JNILIBS_DIR=<copy> build-android.sh --verify-only` + `libark_circom-0123abcd.so` | exit 1: `must hold exactly arm64-v8a/libnoctura_prover.so; it holds: ./arm64-v8a/libark_circom-0123abcd.so ./arm64-v8a/libnoctura_prover.so` |
| jniLibs with another ABI | the same + `x86_64/libnoctura_prover.so` | exit 1, naming `./x86_64/libnoctura_prover.so` |
| the installed tree | `build-android.sh --verify-only` | exit 0: `jniLibs OK: arm64-v8a/libnoctura_prover.so only` |

- [ ] **Step 6: arm64 only, as code — the Kotlin gate: red, then green.**

Until now "false on any other ABI" held only because the APK happens to carry the prover for arm64-v8a alone (the load fails elsewhere). It becomes a property of the code, read off the running process. Create `android/app/src/test/java/com/nocturawallet/prover/A0AbiTest.kt`:

```kotlin
package com.nocturawallet.prover

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

/**
 * arm64-v8a only (spec §12, m14): on any other ABI, emulators included, the prover is never
 * loaded and `isSupported()` is false. The device half — `isSupported()` true on the phone, false
 * on an x86_64 emulator — is the M1a checkpoint's (Task 6).
 */
class A0AbiTest {
    @Test
    fun onAndroidOnlyAnArm64ProcessMayLoadTheProver() {
        assertTrue(A0Abi.allows("Dalvik", "aarch64"))
        for (arch in listOf("x86_64", "i686", "x86", "armv7l", "armv8l", "arm", "riscv64", "AARCH64", "aarch64 ", "", null)) {
            assertFalse("Dalvik / $arch", A0Abi.allows("Dalvik", arch))
        }
    }

    @Test
    fun aHostJvmIsNotAndroidAndIsNotGated() {
        // The JVM unit tests load the jni-host build of the library on x86_64 (A0JniTest).
        assertTrue(A0Abi.allows("OpenJDK 64-Bit Server VM", "amd64"))
        assertTrue(A0Abi.allows(System.getProperty("java.vm.name"), System.getProperty("os.arch")))
        assertTrue(A0Abi.current())
    }

    @Test
    fun aRefusedAbiThrowsBeforeAndAfterALoad() {
        // With the host library present (NOCTURA_A0_HOST_LIB_DIR, as in A0JniTest) a real load
        // happens first, so the gate is shown to run even once `loaded` is true.
        if (System.getenv("NOCTURA_A0_HOST_LIB_DIR") != null) NocturaNativeLib.ensureLoaded(abiAllowed = true)
        repeat(2) {
            try {
                NocturaNativeLib.ensureLoaded(abiAllowed = false)
                fail("ensureLoaded on a refused ABI returned")
            } catch (e: UnsatisfiedLinkError) {
                assertEquals("libnoctura_prover is built for arm64-v8a only", e.message)
            }
        }
    }

    @Test
    fun isSupportedIsFalseUnlessTheLibraryLoadsAndSaysSo() {
        var nativeCalled = false
        val refused = A0Support.check({ NocturaNativeLib.ensureLoaded(abiAllowed = false) }) {
            nativeCalled = true
            true
        }
        assertFalse(refused)
        assertFalse("the native call ran after a refused load", nativeCalled)
        assertFalse(A0Support.check({ throw UnsatisfiedLinkError("dlopen failed") }) { true })
        assertFalse(A0Support.check({}) { false })
        assertFalse(A0Support.check({}) { throw IllegalStateException("boom") })
        assertTrue(A0Support.check({}) { true })
    }

    @Test
    fun theOnlyLibraryLoadInTheAppIsTheGatedOne() {
        // A System.loadLibrary anywhere else (isSupported loading the prover directly, a new
        // module) would bypass A0Abi; the reading is of the compiled-from sources, all of them.
        val sources = File("src/main/java").walkTopDown().filter { it.isFile && it.extension in setOf("kt", "java") }.toList()
        assertTrue("read ${sources.size} source files", sources.size >= 5)
        val loads = sources.flatMap { f ->
            f.readLines().mapIndexedNotNull { i, line -> if ("System.loadLibrary(" in line) "${f.name}:${i + 1}" else null }
        }
        assertEquals(1, loads.size)
        val bridge = File("src/main/java/com/nocturawallet/prover/A0Bridge.kt").readText()
        val lib = bridge.substringAfter("internal object NocturaNativeLib {").substringBefore("\n}\n")
        assertTrue("the one load is NocturaNativeLib's, after the gate", lib.indexOf("if (!abiAllowed) throw") in 0 until lib.indexOf("System.loadLibrary(\"noctura_prover\")"))
        assertTrue(loads.single().startsWith("A0Bridge.kt:"))
    }
}
```

```bash
cd android && ENVFILE=.env.devnet ./gradlew :app:testDebugUnitTest --tests 'com.nocturawallet.prover.A0AbiTest' --console=plain 2>&1 | grep -E '^e: |FAILED|BUILD'
```

Expected (red — the gate does not exist yet):

```
> Task :app:compileDebugUnitTestKotlin FAILED
e: file://android/app/src/test/java/com/nocturawallet/prover/A0AbiTest.kt:17:20 Unresolved reference 'A0Abi'.
e: file://android/app/src/test/java/com/nocturawallet/prover/A0AbiTest.kt:19:43 Unresolved reference 'A0Abi'.
… (the same for every A0Abi / A0Support use, and)
e: file://android/app/src/test/java/com/nocturawallet/prover/A0AbiTest.kt:35:93 No parameter with name 'abiAllowed' found.
BUILD FAILED in 6s
```

(Measured with the test's first four functions, before its `import java.io.File` — the final file's line numbers are one higher; the fifth, `theOnlyLibraryLoadInTheAppIsTheGatedOne`, was added after mutation K-isSupported-skips-gate survived them — Step 10 — and is red on that mutant.)

Implement (`A0Bridge.kt`, `NocturaProverModule.kt`):

```diff
diff --git a/android/app/src/main/java/com/nocturawallet/prover/A0Bridge.kt b/android/app/src/main/java/com/nocturawallet/prover/A0Bridge.kt
index f6a817e..b940fff 100644
--- a/android/app/src/main/java/com/nocturawallet/prover/A0Bridge.kt
+++ b/android/app/src/main/java/com/nocturawallet/prover/A0Bridge.kt
@@ -11,14 +11,37 @@ import org.json.JSONException
 import org.json.JSONObject
 
 /**
- * Loads `libnoctura_prover.so` once, lazily — never in a static initializer at app start (the
- * blst lesson: an eager dlopen risks a launch crash). Pure Rust (libc/libm/libdl only).
+ * The ABI gate (spec §12, m14): the prover is built for arm64-v8a only, and on any other ABI —
+ * emulators included — it is never loaded, so `isSupported()` is false and every A0 call is
+ * `E_A0_UNAVAILABLE`. Read off the running process, not off what happens to be packaged: an APK
+ * that one day carried a build for another ABI would still be refused. ART reports
+ * `java.vm.name` = "Dalvik" and, in a 64-bit ARM process, `os.arch` = "aarch64" (a 32-bit ARM
+ * process reports armv7l / armv8l, an emulator x86_64 / i686). A host JVM — the JVM unit tests,
+ * which load the `jni-host` build — is not Android and is not gated.
+ */
+internal object A0Abi {
+    const val ARCH = "aarch64"
+    const val ART_VM_NAME = "Dalvik"
+
+    fun allows(vmName: String?, osArch: String?): Boolean = vmName != ART_VM_NAME || osArch == ARCH
+
+    fun current(): Boolean = allows(System.getProperty("java.vm.name"), System.getProperty("os.arch"))
+}
+
+/**
+ * Loads `libnoctura_prover.so` once, lazily — never in a static initializer at app start (an
+ * eager dlopen risks a launch crash) — and only where [A0Abi] allows it. Pure Rust (libc / libm /
+ * libdl only; native/noctura-prover/check-needed.sh).
  */
 internal object NocturaNativeLib {
     @Volatile private var loaded = false
 
+    fun ensureLoaded() = ensureLoaded(A0Abi.current())
+
+    /** The gate comes first, every time: a refused ABI throws even if a load happened before. */
     @Synchronized
-    fun ensureLoaded() {
+    internal fun ensureLoaded(abiAllowed: Boolean) {
+        if (!abiAllowed) throw UnsatisfiedLinkError("libnoctura_prover is built for arm64-v8a only")
         if (!loaded) {
             System.loadLibrary("noctura_prover")
             loaded = true
@@ -26,6 +49,17 @@ internal object NocturaNativeLib {
     }
 }
 
+/** `isSupported()`: the library loads (ABI gate included) and says so; any failure is false. */
+internal object A0Support {
+    fun check(load: () -> Unit, native: () -> Boolean): Boolean =
+        try {
+            load()
+            native()
+        } catch (e: Throwable) {
+            false
+        }
+}
+
 /** A JS argument that is not in its one form; rejected as `E_A0_ARG` before any native call. */
 internal class A0ArgException(what: String) : IllegalArgumentException("argument $what is malformed")
 
```

```diff
diff --git a/android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt b/android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt
index 7311d9a..fff7be9 100644
--- a/android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt
+++ b/android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt
@@ -12,8 +12,8 @@ import org.json.JSONObject
 
 /**
  * On-device ZK prover bridge. Backed by the pure-Rust `libnoctura_prover.so`
- * (arkworks Groth16 + wasmi witness) via a Rust JNI layer — NO C++ / NO
- * libc++_shared, so the blst-style startup conflict does not apply.
+ * (arkworks Groth16 + wasmi witness) via a Rust JNI layer — no C++ runtime NEEDED
+ * (native/noctura-prover/check-needed.sh, in CI), so it cannot bring a second libc++_shared.
  *
  * Mounted from JS as `NativeModules.NocturaProver` (`src/modules/zkProver/nativeProverBridge.ts`).
  *
@@ -38,16 +38,10 @@ class NocturaProverModule(reactContext: ReactApplicationContext) :
     override fun getName() = NAME
 
     // Synchronous to match `nativeProverBridge.ts`'s `isSupported(): boolean`.
-    // Triggers the lazy .so load; returns false (not a crash) if it can't load.
+    // Triggers the lazy .so load; false (not a crash) on any ABI but arm64-v8a ([A0Abi]) or if
+    // the library cannot load ([A0Support]).
     @ReactMethod(isBlockingSynchronousMethod = true)
-    fun isSupported(): Boolean {
-        return try {
-            NocturaNativeLib.ensureLoaded()
-            nativeIsSupported()
-        } catch (e: Throwable) {
-            false
-        }
-    }
+    fun isSupported(): Boolean = A0Support.check({ NocturaNativeLib.ensureLoaded() }) { nativeIsSupported() }
 
     // ------------------------------------------------------------------ the A0 surface
 
```

```bash
cd android
ENVFILE=.env.devnet ./gradlew :app:testDebugUnitTest --console=plain 2>&1 | grep -E 'A0AbiTest|SKIPPED|tests completed|BUILD'
NOCTURA_A0_HOST_LIB_DIR=$CARGO_TARGET_DIR/release ENVFILE=.env.devnet ./gradlew :app:testDebugUnitTest --rerun --console=plain 2>&1 | grep -E 'A0AbiTest|A0JniTest|SKIPPED|tests completed|BUILD'
```

Expected:

```
A0AbiTest > theOnlyLibraryLoadInTheAppIsTheGatedOne PASSED
A0AbiTest > aRefusedAbiThrowsBeforeAndAfterALoad PASSED
A0AbiTest > isSupportedIsFalseUnlessTheLibraryLoadsAndSaysSo PASSED
A0AbiTest > aHostJvmIsNotAndroidAndIsNotGated PASSED
A0AbiTest > onAndroidOnlyAnArm64ProcessMayLoadTheProver PASSED
    A0-JNI-SKIPPED A0JniTest: NOCTURA_A0_HOST_LIB_DIR is not set — the JNI tests did NOT run
17 PASSED, 3 SKIPPED (A0JniTest's three)
BUILD SUCCESSFUL in 47s
---- with NOCTURA_A0_HOST_LIB_DIR:
A0AbiTest > … (the five) PASSED
A0JniTest > theBoundCallsReturnTheFixturesPublicValuesThroughTheJni PASSED
A0JniTest > invNkAndInvNullNoJniOutputCarriesASecretOrAnOwnNullifier PASSED
A0JniTest > invAuthAWithdrawChangeProveThroughTheJniNeedsTheApproval PASSED
20 PASSED, 0 SKIPPED
BUILD SUCCESSFUL in 4s
```

(20 = Task 4's 15 + 5. The counts are of the `<Class> > <test> PASSED|SKIPPED|FAILED` lines; the 47 s is the first `testDebugUnitTest` after Step 8's release builds had compiled every module.)

The second run loads the host library **linked with `exports.map`** through the real JNI (`A0JniTest`'s three tests: keysOpen → depositRho(0) → commitment → a withdraw_change prove without `authId` refused, and the INV-AUTH path) — the runtime proof on the desktop that hiding the 35 wasmer exports broke nothing the JVM calls; the phone is Task 6's.

- [ ] **Step 7: CI — the arm64 build and the gates, with their negative controls.**

```diff
diff --git a/.github/workflows/native-prover.yml b/.github/workflows/native-prover.yml
index e5725cf..1effacc 100644
--- a/.github/workflows/native-prover.yml
+++ b/.github/workflows/native-prover.yml
@@ -12,9 +12,9 @@ name: Native prover
 on:
   push:
     branches: [main]
-    paths: ['native/**', '.github/workflows/native-prover.yml', 'src/constants/provingAssets.ts']
+    paths: ['native/**', '.github/workflows/native-prover.yml', 'src/constants/provingAssets.ts', 'android/build.gradle']
   pull_request:
-    paths: ['native/**', '.github/workflows/native-prover.yml', 'src/constants/provingAssets.ts']
+    paths: ['native/**', '.github/workflows/native-prover.yml', 'src/constants/provingAssets.ts', 'android/build.gradle']
   workflow_dispatch:
 
 permissions:
@@ -58,6 +58,7 @@ jobs:
       - uses: dtolnay/rust-toolchain@stable
         with:
           components: rustfmt, clippy
+          targets: aarch64-linux-android
 
       - uses: Swatinem/rust-cache@v2
         with:
@@ -269,9 +270,10 @@ jobs:
           fi
           echo "a skipped A0 key-file test fails the interop assertion"
 
-      # THE JNI SURFACE (spec §3, §14 "Boundary"): the Java_* symbols the library exports must be
-      # exactly jni-exports.txt. The host build with `jni-host` carries the same #[no_mangle]
-      # functions as the arm64 library (Task 5's arm64 step runs the same script on that one).
+      # THE JNI SURFACE (spec §3, §14 "Boundary"): the library's dynamic exports must be exactly
+      # jni-exports.txt — nothing else (exports.map, linked by build.rs). The host build with
+      # `jni-host` carries the same #[no_mangle] functions as the arm64 library, which the steps
+      # at the end of this job build and check with the same script.
       - name: Build the host JNI library
         run: cargo build --release --locked --features jni-host
 
@@ -287,3 +289,59 @@ jobs:
             exit 1
           fi
           echo "the JNI export check is falsifiable"
+
+      # THE ANDROID LIBRARY (spec §12, m15: "a CI step, not a note"). The arm64-v8a library the app
+      # packages is cross-built here with the NDK the app builds with (android/build.gradle's
+      # ndkVersion, read, not restated) by the same script a developer runs, into a scratch
+      # jniLibs. Its dynamic section must NEED no C++ runtime (the July launch crash), its
+      # exports must be exactly jni-exports.txt, and jniLibs must hold that one file.
+      - name: Install the Android NDK of android/build.gradle and cargo-ndk
+        run: |
+          ndk=$(sed -n 's/.*ndkVersion *= *"\([0-9.]*\)".*/\1/p' ../../android/build.gradle)
+          [ -n "$ndk" ] || { echo "::error::could not read ndkVersion from android/build.gradle"; exit 1; }
+          yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --install "ndk;$ndk" > /dev/null
+          [ -x "$ANDROID_HOME/ndk/$ndk/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android24-clang" ]
+          echo "ANDROID_NDK_HOME=$ANDROID_HOME/ndk/$ndk" >> "$GITHUB_ENV"
+          cargo install cargo-ndk --version 4.1.2 --locked
+
+      - name: Build the arm64-v8a library (build-android.sh) — libc++ gate, exact exports, one file
+        run: NOCTURA_JNILIBS_DIR="$RUNNER_TEMP/jniLibs" ./build-android.sh
+
+      - name: Assert the arm64 library NEEDs no C++ runtime and exports exactly jni-exports.txt
+        run: |
+          so="$RUNNER_TEMP/jniLibs/arm64-v8a/libnoctura_prover.so"
+          readelf -d "$so" | grep -E "NEEDED|SONAME"
+          ./check-needed.sh "$so"
+          ./check-jni-exports.sh "$so"
+
+      # NEGATIVE CONTROLS — each gate above must fail on the thing it exists to catch, built here
+      # with the same NDK: a library that NEEDs libc++_shared.so, one that NEEDs a library outside
+      # the allowed set (libz.so), a library exporting the JNI list plus one more symbol, and a
+      # jniLibs with cargo-ndk's stray libark_circom copy.
+      - name: Assert the libc++ gate, the exact export check and the jniLibs check can fail
+        run: |
+          cc="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android24-clang"
+          neg="$RUNNER_TEMP/neg"; mkdir -p "$neg"
+          printf '#include <string>\nextern "C" int f(int n) { return (int)std::to_string(n).size(); }\n' > "$neg/cxx.cpp"
+          "$cc++" -shared -fPIC "$neg/cxx.cpp" -o "$neg/cxx.so"
+          readelf -d "$neg/cxx.so" | grep -q 'libc++_shared.so'
+          if ./check-needed.sh "$neg/cxx.so"; then
+            echo "::error::the libc++ gate PASSED a library that NEEDs libc++_shared.so"; exit 1
+          fi
+          printf 'int g(void) { return 0; }\n' > "$neg/z.c"
+          "$cc" -shared -fPIC -Wl,--no-as-needed -lz "$neg/z.c" -o "$neg/z.so"
+          readelf -d "$neg/z.so" | grep -q 'libz.so'
+          if ./check-needed.sh "$neg/z.so"; then
+            echo "::error::the libc++ gate PASSED a library that NEEDs libz.so, outside the allowed set"; exit 1
+          fi
+          { grep -vE '^\s*(#|$)' jni-exports.txt | sed 's/.*/void &(void) {}/'; echo 'void wasmer_vm_probestack(void) {}'; } > "$neg/extra.c"
+          "$cc" -shared -fPIC "$neg/extra.c" -o "$neg/extra.so"
+          if ./check-jni-exports.sh "$neg/extra.so"; then
+            echo "::error::the export check PASSED a library with an export outside jni-exports.txt"; exit 1
+          fi
+          cp -r "$RUNNER_TEMP/jniLibs" "$neg/jniLibs"
+          touch "$neg/jniLibs/arm64-v8a/libark_circom-0123456789abcdef.so"
+          if NOCTURA_JNILIBS_DIR="$neg/jniLibs" ./build-android.sh --verify-only; then
+            echo "::error::the jniLibs check PASSED a tree with a stray library"; exit 1
+          fi
+          echo "the libc++ gate, the exact export check and the jniLibs check are falsifiable"
```

**Decided: cross-build in CI** (not readelf on the host build — the host library NEEDs glibc's `libc.so.6` / `libgcc_s.so.1`, so `check-needed.sh` cannot mean anything there): `ubuntu-latest` carries the Android SDK with `sdkmanager`; the step installs exactly the NDK `android/build.gradle` names (read with `sed`, not restated) and `cargo-ndk 4.1.2` (the version this was measured with), then runs the developer's own `build-android.sh` into `$RUNNER_TEMP/jniLibs`. Cost, estimated (not measured — this dry run cannot run GitHub's runner): the NDK download ~1–2 min, `cargo install cargo-ndk` ~1 min, the arm64 build ~4 min cold (Swatinem/rust-cache keeps `target/aarch64-linux-android` afterwards), inside the job's 45-minute limit. The four new steps replayed locally (`$RUNNER_TEMP` = a scratch dir, the NDK step reduced to its version read — no `sdkmanager` / `cargo install` here), each with `bash -eo pipefail` as the job's shell:

```
== Install … (the version read only)
ndk=27.1.12297006
exit 0
== Build the arm64-v8a library (build-android.sh) …
    Building arm64-v8a (aarch64-linux-android)
    Finished `release` profile [optimized] target(s) in 1m 24s
NEEDED of …/aarch64-linux-android/release/libnoctura_prover.so: libc.so libdl.so libm.so — no C++ runtime
exports match …/jni-exports.txt exactly: 10 symbols, nothing else
NEEDED of $RUNNER_TEMP/jniLibs/arm64-v8a/libnoctura_prover.so: libc.so libdl.so libm.so — no C++ runtime
exports match …/jni-exports.txt exactly: 10 symbols, nothing else
installed $RUNNER_TEMP/jniLibs/arm64-v8a/libnoctura_prover.so (7157368 bytes)
exit 0
== Assert the arm64 library NEEDs no C++ runtime and exports exactly jni-exports.txt
 0x0000000000000001 (NEEDED)             Shared library: [libdl.so]
 0x0000000000000001 (NEEDED)             Shared library: [libm.so]
 0x0000000000000001 (NEEDED)             Shared library: [libc.so]
NEEDED of $RUNNER_TEMP/jniLibs/arm64-v8a/libnoctura_prover.so: libc.so libdl.so libm.so — no C++ runtime
exports match ./jni-exports.txt exactly: 10 symbols, nothing else
exit 0
== Assert the libc++ gate, the exact export check and the jniLibs check can fail
  C++ runtime NEEDED: libc++_shared.so
$RUNNER_TEMP/neg/cxx.so fails the libc++ gate
  not allowed NEEDED: libz.so (allowed: libc.so libdl.so liblog.so libm.so)
$RUNNER_TEMP/neg/z.so fails the libc++ gate
dynamic exports of $RUNNER_TEMP/neg/extra.so differ from ./jni-exports.txt:
  extra:   wasmer_vm_probestack
jniLibs ($RUNNER_TEMP/neg/jniLibs) must hold exactly arm64-v8a/libnoctura_prover.so; it holds:
  ./arm64-v8a/libark_circom-0123456789abcdef.so
  ./arm64-v8a/libnoctura_prover.so
the libc++ gate, the exact export check and the jniLibs check are falsifiable
exit 0
```

(7,157,368 here vs 7,157,320 in Step 4: the same sources relinked in another session — the arm64 build is not byte-reproducible across rebuilds; nothing here depends on it.) The existing host steps now check exactness too ("Assert the JNI exports are exactly jni-exports.txt" passes on the host build: Step 4), and their negative control (a list missing one symbol) still fails.

- [ ] **Step 8: Both APKs — no libnoctura_key.so even with its intermediates planted; the prover arm64 only.**

**The control for removing the packaging exclude:** the main checkout's `android/app/build/intermediates/cxx/RelWithDebInfo/3h5h1v42/obj/<abi>/` still holds the old CMake build's `libnoctura_key.so` and its `libc++_shared.so` for all four ABIs — exactly the "stale intermediates" the exclude guarded against. That 11 MB directory was copied into the clean clone's `android/app/build/intermediates/cxx/RelWithDebInfo/` before the first build. (Release signing from `android/keystore.properties`; the gitignored `.env.devnet` / `.env.production` copied from the main checkout, never committed; `node_modules` a real copy, never a symlink to another checkout — Gradle writes into `node_modules/*/android/build`.)

```bash
cd android
ENVFILE=.env.devnet ./gradlew assembleRelease --console=plain 2>&1 | grep -E "^BUILD"
cp app/build/outputs/apk/release/app-release.apk /tmp/devnet.apk
ENVFILE=.env.production ./gradlew assembleRelease --console=plain 2>&1 | grep -E "^BUILD"
cp app/build/outputs/apk/release/app-release.apk /tmp/production.apk
for f in devnet production; do
  aapt2 dump badging /tmp/$f.apk | grep -E "^package" | cut -d"'" -f2
  wc -c < /tmp/$f.apk
  unzip -l /tmp/$f.apk | grep -c '\.so$'
  unzip -l /tmp/$f.apk | grep -E 'noctura|ark_circom|blst'
  unzip -l /tmp/$f.apk | grep -E '\.so$' | awk '{print $4}' | cut -d/ -f2 | sort | uniq -c
done
unzip -o -q /tmp/production.apk lib/arm64-v8a/libnoctura_prover.so -d /tmp/apkso
native/noctura-prover/check-needed.sh /tmp/apkso/lib/arm64-v8a/libnoctura_prover.so
native/noctura-prover/check-jni-exports.sh /tmp/apkso/lib/arm64-v8a/libnoctura_prover.so
```

Expected:

```
BUILD FAILED in 37m 17s      # the first, cold devnet run: the scratch disk filled (`Could not add file … to ZIP …react-native-reanimated-release.aar`) — space freed, re-run
BUILD SUCCESSFUL in 1m 28s   # devnet (after a second run had stopped at signing: the clone has no .jks; NOCTURA_KEYSTORE_FILE pointed at the main checkout's, read in place, not copied)
BUILD SUCCESSFUL in 1m 22s   # production
== devnet
com.nocturawallet.devnet
93260349
89
  4931272  1981-01-01 01:01   lib/arm64-v8a/libnoctura_prover.so
     23 arm64-v8a
     22 armeabi-v7a
     22 x86
     22 x86_64
== production
com.nocturawallet
93257481
89
  4931272  1981-01-01 01:01   lib/arm64-v8a/libnoctura_prover.so
     23 arm64-v8a
     22 armeabi-v7a
     22 x86
     22 x86_64
NEEDED of …/lib/arm64-v8a/libnoctura_prover.so: libc.so libdl.so libm.so — no C++ runtime
exports match native/noctura-prover/jni-exports.txt exactly: 10 symbols, nothing else
```

- **No `libnoctura_key.so`, no `libark_circom`, nothing named blst** in either APK — although the four planted `libnoctura_key.so` (and their `libc++_shared.so`) are still under the clone's `android/app/build/intermediates/cxx/RelWithDebInfo/3h5h1v42/` after both builds (`find android/app/build -name libnoctura_key.so | wc -l` → 4): AGP packages only the outputs of the CMake builds it configures (React Native's `appmodules`, hash `3fo5r173` in the main checkout), so the exclude guarded a case that cannot happen without an `externalNativeBuild` naming that CMake file — which the guard test now refuses.
- **The prover is packaged for arm64-v8a only** (the other three ABI directories have 22 libraries each, the same list without it); the APKs' `.so` list is **identical to 5c02d72's** (`diff` of the sorted `unzip -l` paths: empty).
- **Size, production APK: 93,343,157 → 93,257,481 bytes (−85,676)**; the packaged (AGP-stripped) prover **5,012,352 → 4,931,272 bytes (−81,080)** — the wasmer code the hidden exports kept alive. Devnet 93,346,025 → 93,260,349.
- The packaged library keeps the exact export list and the NEEDED set. **Not run here: the launch on the phone** of either APK (the M1a checkpoint, Task 6).
- The APKs were built from the tree of this task minus three later edits that do not reach them (the fifth `A0AbiTest`, a comment in `exports.map`, the guard test's pattern spelling).

- [ ] **Step 9: The whole suite.**

```bash
cd native/noctura-prover && cargo fmt --check && echo FMT_OK
cargo clippy --all-targets --locked -- -D warnings 2>&1 | tail -1
cargo clippy --all-targets --locked --features jni-host -- -D warnings 2>&1 | tail -1
NOCTURA_A0_KEYS_DIR=<program side>/zk/keys/v2 cargo test --locked 2>&1 | grep -E "test result|SKIPPED"
cd ../.. && npx tsc --noEmit; echo $?
npx jest --maxWorkers=4 2>&1 | grep -E "^(FAIL|Tests:|Test Suites:)"
npx eslint src/modules/zkProver/__tests__/keyModuleRemoved.test.ts src/modules/keychain/keychainModule.ts \
  src/modules/keyDerivation/shielded.ts src/modules/keyDerivation/paths.ts src/modules/shielded/types.ts; echo $?
node scripts/check-no-tge-date.mjs
```

Expected:

```
FMT_OK
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 4.86s
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.54s
test result: ok. 97 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 17.91s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.51s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
0
Test Suites: 1 skipped, 183 passed, 183 of 184 total
Tests:       1 skipped, 1260 passed, 1261 total
0
no TGE date in 1443 tracked text files
```

(Rust: 97 + 1, unchanged from Task 4 — this task adds no Rust test; the crate's checks of the link are the scripts, run by CI. No `A0-KEYS-SKIPPED`; the interop assertion's lines all present. Jest: Task 4's 1257 + 4.)

- [ ] **Step 10: Named mutations — each in a fresh copy, compiled first, each red.**

Rust / link (`S-`): `git archive HEAD native/noctura-prover | tar -x` into a new directory, **then `find <dir> -type f -exec touch {} +`**, the edit (an exact replacement, asserted to occur once), `cargo build --release --locked --features jni-host` (each compiled — none INVALID), `check-jni-exports.sh` on the result. The `touch` is load-bearing, measured: `git archive` stamps every file with the commit time and cargo fingerprints by mtime, so a copy whose `build.rs` is unedited reused the PREVIOUS copy's compiled build script (a first S-local-name-dropped run reported 35 extras, from S-version-script-dropped's build script — discarded and re-run with the `touch`). A positive control through the same runner (an identity edit) exits 0. Scripts (`C-`): the same copy, the edit, the script run on the control artefact of Step 5 that it exists to refuse. Kotlin (`K-`): the copy with its own `node_modules` (a real copy), `.env.devnet`, `local.properties`, `NOCTURA_A0_HOST_LIB_DIR` set, `./gradlew :app:testDebugUnitTest`. JS (`J-`): `git archive HEAD | tar -x` + `node_modules` linked, `npx tsc --noEmit` 0, then `npx jest` on the guard.

| mutation | edit | result | red |
|---|---|---|---|
| S-version-script-dropped | `build.rs`: the `println!("cargo:rustc-cdylib-link-arg=…")` → `let _ = map;` | check exit 1 | 35 `extra:` lines (`wasmer_vm_data_drop` …) |
| S-local-name-dropped | `exports.map`: `    wasmer_vm_probestack;` → (deleted) | check exit 1 | exactly 1: `extra:   wasmer_vm_probestack` |
| S-glob-only | `exports.map`: the 35 exact names → `    wasmer_vm_*;` | check exit 1 | 35 `extra:` lines — the glob loses to rustc's exact names (the ruling) |
| C-check-java-only | `check-jni-exports.sh`: `awk '{print $NF}' \| sort -u` → `… \| grep -E '^Java_' \| sort -u` (Task 4's reading) | exit 0 on `extra.so` | the CI negative control "the export check PASSED a library with an export outside jni-exports.txt" |
| C-needed-no-allowlist | `check-needed.sh`: `elif ! echo " $allowed " \| grep -qF " $lib "; then` → `elif false; then` | exit 0 on `z.so` | the CI control "PASSED a library that NEEDs libz.so" |
| C-needed-no-cxx-branch | `check-needed.sh`: the C++-runtime `if` → `if false; then` | exit 1 on `cxx.so` | **survivor, stated:** `not allowed NEEDED: libc++_shared.so` — the allow-list refuses it too (two guards by design; the C++ test is for the day the allow-list is widened) |
| C-needed-empty-ok | `check-needed.sh`: `[ -n "$needed" ] \|\| {` → `true \|\| {` | exit 1 on `obj.o` (was 2) | **survivor, stated:** the loop reads one empty name and refuses it (`not allowed NEEDED: `) — fails closed either way |
| C-jnilibs-any | `build-android.sh`: `if [ "$found" != "./arm64-v8a/libnoctura_prover.so" ]; then` → `if [ ! -f "$installed" ]; then` | exit 0 with the stray copy | the CI control "the jniLibs check PASSED a tree with a stray library" |
| K-abi-any-arch | `A0Bridge.kt`: `… \|\| osArch == ARCH` → `… \|\| osArch != null` | 19 passed, 1 failed | `onAndroidOnlyAnArm64ProcessMayLoadTheProver` |
| K-gate-dropped | `A0Bridge.kt`: the `if (!abiAllowed) throw …` line → (deleted) | 17 passed, 3 failed | `theOnlyLibraryLoadInTheAppIsTheGatedOne`, `aRefusedAbiThrowsBeforeAndAfterALoad`, `isSupportedIsFalseUnlessTheLibraryLoadsAndSaysSo` |
| K-gate-after-load | `A0Bridge.kt`: the gate moved inside `if (!loaded) {` | 18 passed, 2 failed | `aRefusedAbiThrowsBeforeAndAfterALoad` (the host library loaded first), `isSupportedIsFalseUnlessTheLibraryLoadsAndSaysSo` |
| K-support-narrow-catch | `A0Bridge.kt`: `A0Support`'s `catch (e: Throwable)` → `catch (e: UnsatisfiedLinkError)` | 19 passed, 1 failed | `isSupportedIsFalseUnlessTheLibraryLoadsAndSaysSo` |
| K-isSupported-skips-gate | `NocturaProverModule.kt`: `A0Support.check({ NocturaNativeLib.ensureLoaded() })` → `A0Support.check({ System.loadLibrary("noctura_prover") })` | 19 passed, 1 failed | `theOnlyLibraryLoadInTheAppIsTheGatedOne` (first run, before that test existed: 19 / 19 passed — the survivor that made it) |
| J-ref-reintroduced | `MainApplication.kt`: `// add(NocturaKeyPackage())` added after the screen-security package | 1 failed, 3 passed | `no code file references it` |
| J-tree-dropped | the guard: `const TREES = ['src', 'android', ` → `const TREES = ['src', ` | 1 failed, 3 passed | `reads the trees it claims to (non-vacuous)` |
| J-blst-pattern-dropped | the guard: the `['blst', /\bblst\b/i],` row → (deleted) | 1 failed, 3 passed | `flags every kind of reference it looks for (positive control)` |

Controls (not mutations): the runner with an identity edit → check exit 0, `exports match … 10 symbols, nothing else`; a name `exports.map` lists that the link does not define → **the link is refused** (`rust-lld: error: version script assignment of 'local' to symbol 'wasmer_vm_no_such_symbol' failed: symbol not defined`); and Step 5's eight rows. Every S / C / J mutant compiled (none INVALID; `tsc --noEmit` 0 for the J rows). **Deviation, stated: the K rows ran in the clone itself** — edit, `./gradlew :app:testDebugUnitTest` with `NOCTURA_A0_HOST_LIB_DIR`, `git checkout -- <file>`, `git status` clean before the next — not in fresh copies: a Gradle copy needs its own real `node_modules` (7.3 GB once built), and the scratch disk had ~6 GB.

- [ ] **Step 11: Commit.**

```bash
git add .github/workflows/native-prover.yml .gitignore README.md android/.gitignore android/app/build.gradle \
  android/app/src native/noctura-prover/build.rs native/noctura-prover/build-android.sh \
  native/noctura-prover/check-needed.sh native/noctura-prover/check-jni-exports.sh native/noctura-prover/exports.map \
  native/noctura-prover/src/android.rs native/noctura-prover/STATUS.md src
git status --short     # nothing outside these; .env*, keystore.properties, local.properties, jniLibs/ stay untracked
git commit -m "build(shielded-a0): remove the blst NocturaKeyModule / libnoctura_key.so; build the arm64 prover with one script that installs it alone, exports exactly the JNI functions (version script) and NEEDs no C++ runtime — all three gated in CI with negative controls; arm64-only as code (A0Abi) (M1a Task 5)"
```

Expected `git show --stat HEAD`: 26 files changed, 482 insertions(+), 407 deletions(-).

#### Notes for the executor (Task 5)

- **The rulings this task took (each the most secure default; the owner may overturn any):**
  - **The JS bridge's caller is deleted, not stubbed.** `nativeBridge.ts` had one caller, `wipeKeys`' `deleteSeed()` inside a swallowing `try`; the native method never existed and the module was never registered, so the call always threw. A "removed" error or a stub would preserve dead code. Cost if wrong: none — the wipe's real work (four Keychain resets) is unchanged and tested.
  - **`exports.map` lists wasmer-vm's 35 names one by one.** Measured: a glob loses to rustc's own version script (S-glob-only). The cost is maintenance: an ark-circom / wasmer change that adds or drops a `#[no_mangle]` name fails the build or the check — loudly, on the desk and in CI — and the fix is one line in `exports.map`. Considered and refused: dropping wasmer from the graph (ark-circom 4d99060 depends on it unconditionally; even `default-features = false` keeps wasmer-vm) and a linker wrapper that rewrites rustc's arguments (fragile across cargo-ndk / rustc versions).
  - **The version script applies to the host (`linux`) build too**, so CI's existing host export check is exact as well and `A0JniTest` runs against the same export shape as the phone. macOS / Windows hosts get no version script (their linkers do not take one); nothing in CI builds there.
  - **The libc++ gate is an allow-list** ({libc, libm, libdl, liblog}) plus an explicit C++-runtime test (`c++`, `stdc`, `gnustl`, `stlport`); either alone refuses `libc++_shared.so` (C-needed-no-cxx-branch survives for that reason — stated in the table). `liblog.so` is allowed though not NEEDED today (Android logging from Rust would add it; harmless).
  - **`build-android.sh` never deletes what it did not write.** A stale `libark_circom-<hash>.so` from an old `cargo ndk -o` build fails it with the file named; the developer removes it. (The owner's main checkout has none today: `jniLibs/arm64-v8a/` holds only `libnoctura_prover.so`.)
  - **arm64-only is a property of the process, not of the packaging** (`A0Abi`): on ART (`java.vm.name` = "Dalvik") only `os.arch` = "aarch64" loads the library; a host JVM is not gated (the JVM tests load the `jni-host` build on x86_64). The gate runs before the "already loaded" check, every call. Fail-closed if a device ever reported another string for a 64-bit ARM process: shielded hidden, nothing unsafe — and Task 6's phone run shows the real value is accepted.
  - **The CI cross-builds** with the app's NDK rather than reading the host build (Step 7's reason); cargo-ndk is pinned to 4.1.2.
- **Known gap — a plan-level limitation, kept: no CI job runs the Kotlin JVM tests** (Task 4's 15 and this task's 5 `A0AbiTest`). Running `:app:testDebugUnitTest` needs the whole React Native Gradle build: `npm ci` of the root (the RN Gradle plugin and every native module's Android project come from `node_modules`), the Android SDK and Gradle — measured here, the first `testDebugUnitTest` took 47 s only because `assembleRelease` had already compiled every module, on top of the ~60 min cold release build. No workflow builds the Android project today; adding one is its own decision (runner minutes, caching `~/.gradle` and `node_modules`), not M1a's. What CI does read of the same boundary: the JNI exports exactly (host and arm64), the libc++ gate on the arm64 library, `a0Boundary.test.ts`'s reading of the Kotlin source (Jest) and this task's `keyModuleRemoved.test.ts` (Jest). What only a desk run reads: the `@ReactMethod` set by reflection, the seed zero-fill in Kotlin, the proving thread, the real JNI on the host, and the ABI gate. Each executor runs `./gradlew :app:testDebugUnitTest` with `NOCTURA_A0_HOST_LIB_DIR` set before committing a Kotlin change.
- **Deviations from the brief / dispatch:**
  - The Kotlin `A0Abi` gate is new code, not only a test of the packaging (the dispatch asked "how is it known — test it"): without it the only thing that made `isSupported()` false elsewhere was which directories `jniLibs/` happened to hold.
  - `nativeBridge.ts` removed with its dead caller (above), not left throwing.
  - `cargo ndk` builds for its default platform, API 21 (as Task 4 did; the library's NEEDED is the same and runs on minSdk 24); not changed here so the library is the one Task 4 measured, minus the exports.
- **Found, outside this task (for the controller):**
  - **The mutation method itself had a hole:** shared-target mutants built from `git archive` copies reuse a previous mutant's compiled build script when `build.rs` is unedited (mtime fingerprints; Step 10). Task 4's Rust rows each edited a `src/` file (the crate unit recompiles from that copy's sources), so they stand; any later task with a `build.rs`, or a mutant that edits only a non-Rust input, must `touch` the copy.
  - **The owner's main checkout still holds the old module's build leftovers** — `android/app/src/main/cpp/blst/` (the gitignored blst source; after this commit the ignore line is gone, so it shows as untracked: delete it), `android/app/build/intermediates/cxx/RelWithDebInfo/3h5h1v42/` (the stale `libnoctura_key.so` + `libc++_shared.so` × 4 ABIs; Step 8 proves Gradle does not package them, and `./gradlew clean` removes them).
  - `README.md`'s next line ("Groth16/BN254 ZK proofs via @callstack/polygen AOT + hosted prover") is stale too — M1b's, with the hosted prover.
- **What the next tasks must know:** see Interfaces → "What later tasks rely on". In short: build with `build-android.sh`; the phone launch of the version-scripted library and `isSupported()` true are Task 6's; M1b's removal of `nativeProve` is one line in `jni-exports.txt`.

#### Spec rev 3.2 lines (Task 5)
- §12 "The Rust `.so`": the library is built and installed by **`native/noctura-prover/build-android.sh`** (alone into `jniLibs/arm64-v8a/`; any other file there fails), **exports exactly the JNI functions** (a version script, `exports.map`; checked over the whole dynamic symbol table) and its NEEDED must be a subset of **{libc, libm, libdl, liblog}** with no C++ runtime; the CI step cross-builds it with the NDK `android/build.gradle` names, with negative controls (a libc++_shared-linked and a libz-linked library, an extra export, a stray library in jniLibs).
- §12 / m14: "`isSupported()` false on any other ABI" is **a check of the running process** (`A0Abi`: ART and `os.arch` = aarch64), not only a consequence of what is packaged.
- §12 "Removed": with `NocturaKeyModule` go **the JS `src/modules/keychain/nativeBridge.ts`** and its dead caller in `wipeKeys` (M1a, not M1b); a Jest guard keeps every trace out of the code trees.
- §14 "Boundary": "the `.so` exports exactly §3's functions" means **nothing else either** (no `wasmer_vm_*`).
- §14 / §16: **no CI job runs the Kotlin JVM tests** in M1 (a stated limitation; the JNI exports, the libc++ gate and the Jest readings are CI's).


### Task 6: The M1a on-phone checkpoint — an Android **instrumented test of the devnet release app** (`testBuildType "release"`; the instrumentation is its own APK, `app-release-androidTest.apk`, carrying the four pinned A0 key files as test assets staged from `NOCTURA_A0_KEYS_DIR`) that runs, on the app's proving thread, `keysOpen` with the repo's test seed → `depositRho(0)` → `commitment(10^9, rho)` → a deposit proof → a `withdraw_change` prove without an `authId` (refused) → the same call approved (it proves) → the approval reused (refused) → `keysClose`, plus `isSupported()` through the React module; the same sequence (`M1aCheckpoint`, a source dir of the two TEST source sets only) rehearsed on the desktop over the `jni-host` library; the desk script `scripts/m1a-checkpoint/m1a-checkpoint.mjs` that computes the desk values from the mnemonic, reads the deposit VK out of the devnet `Pool` account (ONE request, genesis-checked, never noc-tura.io / mainnet), verifies the phone's proof against it with an independent pairing check (`@noble/curves` bn254), collects the phone's report over adb, installs and launches the production APK of the same commit, and prints PASS / FAIL per §16 line; `build-apks.sh` + `check-release-apk.sh` proving the harness is in neither release APK; the owner's checklist `scripts/m1a-checkpoint/README.md`; 2 new Kotlin JVM tests (1 of them needs the host library and the key files), 11 node tests, 1 instrumented test (phone only), 28 named mutations

**Spec:** §16 "Checkpoints · M1a" ("on the phone, through a harness that is not in the devnet APK's release variant (the plan picks an Android instrumented test or a debug-only screen): `keysOpen` with the repo's test seed, `depositRho(0)`, `commitment()`, and a deposit proof whose public inputs equal the desk values and verify against the deposit VK read from chain; a `withdraw_change` prove without an `authId` refuses. `isSupported()` true on the phone"; "Each checkpoint also builds the production APK of the same commit and launches it on the phone"); §14 Rust "a proof of each circuit verifies against the VK the chain holds (read from chain, not `vk.json`)" — the deposit half, deferred here by Task 3 (its Notes); §14 "On the phone (devnet), the acceptance: the checkpoints of §16 in order — M1a (native proof on the phone)"; "The scripted checks are … run against devnet from a desk script, recorded with the signatures"; §12 "every plan's checkpoint includes a production build of the same commit that launches on the phone (the libc++ lesson)", m14 (`isSupported()` false elsewhere — true on the phone is this task's). **Not here:** the withdraw_change VK read from chain (the spec's M1a line names the deposit VK; the withdraw_change proof of the control row is verified against the pinned `withdraw_change_vk.json`, which Task 3 tied to the chain by two landed proofs — Notes); any change to the Rust core, the JNI, the Kotlin module or the JS bridge (Tasks 1–5's, unchanged); a CI job for any of this (no workflow builds the Android project — Task 5's stated gap; the desk tests are `node --test`, run by hand like `scripts/a0-vectors/`).

**Files:**
- Create: `android/app/src/m1aCheckpoint/java/com/nocturawallet/prover/M1aCheckpoint.kt` (the sequence, shared), `android/app/src/androidTest/java/com/nocturawallet/prover/M1aCheckpointTest.kt` (the phone run), `scripts/m1a-checkpoint/lib.mjs`, `scripts/m1a-checkpoint/m1a-checkpoint.mjs` (mode 100755), `scripts/m1a-checkpoint/check-release-apk.sh` (100755), `scripts/m1a-checkpoint/build-apks.sh` (100755), `scripts/m1a-checkpoint/README.md` (the owner's checklist)
- Create (tests): `android/app/src/test/java/com/nocturawallet/prover/M1aCheckpointHostTest.kt` (`M1aCheckpointHostTest` 1 gated + `M1aCheckpointDeviceFailuresTest` 1), `scripts/m1a-checkpoint/lib.test.mjs` (11, `node --test`)
- Create (recorded, committed — Steps 3 and 5, not pasted in full): `scripts/m1a-checkpoint/fixtures/host-rehearsal-report.json` (the desktop rehearsal's report, 82 lines), `scripts/m1a-checkpoint/fixtures/devnet-pool-520213277.json` (the one devnet read, 9 lines — pasted, Step 5)
- Modify: `android/app/build.gradle` (`testInstrumentationRunner`, `testBuildType "release"`, the two test source sets' extra dirs, the key-file staging task, two `androidTestImplementation`)
- **Not changed, on purpose:** every file of `native/noctura-prover/` (no Rust change; `Cargo.lock` unchanged), `android/app/src/main/` (the app: `NocturaProverModule.kt`, `A0Bridge.kt`, `NocturaA0Native.kt` — the harness calls them, nothing in them knows it exists), `src/` (no JS app code), `.github/workflows/` (nothing new runs in CI — Notes), the Task 1–3 fixtures (read by the harness and the desk, never written).

**Interfaces:**
- Consumes (Task 4): `NocturaA0Native.{keysOpen, depositRho, commitment, prove, authorizeUnshield, keysClose}`, `A0Seed.use`, `A0Result.{parse, Ok, Err, INTERNAL, UNAVAILABLE}`, `A0Prover.{submit, THREAD_NAME}`, `NocturaNativeLib.ensureLoaded`, `NocturaProverModule(…).isSupported()`, the error codes `E_A0_AUTH_ABSENT` / `E_A0_UNKNOWN_HANDLE`, the bridge's `{"proofBytes": 512 hex, "publicInputs": [64 hex …]}`; the `jni-host` build and `NOCTURA_A0_HOST_LIB_DIR`. (Task 5): `native/noctura-prover/build-android.sh`, `A0Abi` (on the phone `isSupported()` true is its positive case). (Task 3): the key-file names and lengths of `keyfiles.rs`, `NOCTURA_A0_KEYS_DIR`, `a0-prove-vectors.json` (`scenarios[0]` = the checkpoint's deposit; the `withdraw_change` scenario of depositIndex 1 with its `authorization`; `landed[]`), `a0-vk/{deposit,withdraw_change}_vk.json`. (Task 1): `a0-key-vectors.json` `seeds[0]` (the repo test mnemonic) and its `notes[0]`; `src/modules/shielded/a0/fieldEquations.ts`. The program side's `Pool` / `DepositVk` layout (`programs/shielded-pool/src/state.rs`, read-only) and EIP-197 G2 order — facts. Crates / packages: `androidx.test:runner:1.7.0` (new, androidTest only), `junit:junit:4.13.2`; `@noble/curves` 2.0.1 `bn254` (`G1`, `G2`, `pairingBatch`, `fields.Fp12`), `@noble/hashes`, `@scure/bip39`, `@scure/base`, `micro-key-producer/bls.js`, `poseidon-lite` (all already in `package.json`).
- Produces — Kotlin (test source sets only, package `com.nocturawallet.prover`):
  ```kotlin
  internal object M1aCheckpoint {
      const val SCHEMA = "noctura.m1a.checkpoint-report/1"; const val LOG_TAG = "M1aCheckpoint"; const val REPORT_KEY = "m1a-report"
      const val DEPOSIT_INDEX = "0"; const val DEPOSIT_AMOUNT = "1000000000"
      val KEY_FILES: List<String>   // deposit_final.zkey, deposit.wasm, withdraw_change_final.zkey, withdraw_change.wasm
      fun run(keyVectorsJson: String, proveVectorsJson: String, keyPath: (String) -> String,
              platform: JSONObject, isSupported: Boolean?): JSONObject          // the report (below)
      fun deviceFailures(report: JSONObject, expectSupported: Boolean): List<String>   // empty = none
      fun chunks(report: JSONObject, max: Int = 3000): List<String>          // "M1A-REPORT i/n <part>" logcat lines
  }
  class M1aCheckpointTest { @Test fun m1aCheckpoint() }        // androidTest; status key m1a-report (code 7) + logcat
  ```
  The report (`noctura.m1a.checkpoint-report/1`): `platform {where: "phone"|"host-rehearsal", javaVmName, osArch, supportedAbis?, sdkInt?, model?, targetPackage?, isSupportedThrew?}`, `isSupported` (bool | null), `seedLabel`, `depositWitness`, `withdrawScenario` (the fixture label), `keysOpen`, `seedCopyZeroFilled`, `depositRho {ok, depositIndex}`, `commitment {ok, amount}`, `depositProof` / `withdrawWithoutAuthId` / `withdrawWithAuthId` / `withdrawReusedAuthId` (each `{ok: true, proofBytes, publicInputs} | {error, message}` + `{circuit, thread, ms, withAuthId}`), `authorizeUnshield {ok, error}`, `keysClose`, `depositRhoAfterClose`, `complete`. Every step is recorded even after an earlier one failed. No secret: the seed is the public test mnemonic; the values are what a deposit / an unshield of it publishes (the `authId` itself is not recorded).
- Produces — the desk (`scripts/m1a-checkpoint/lib.mjs`, ESM, Node 24):
  ```js
  export const DEVNET, CHECKPOINT, POOL_LAYOUT, P, PHONE_ONLY, ROOT;
  export function deskValues(): {seedHex, depositIndex, amount, rho, commitment, mintHash, publicInputs[4]}  // hex BE
  export function rpcRefusal(url): string | null
  export function accountDiscriminator(name): string
  export function decodePoolAccount({owner, data: Buffer}): {errs[], blob?, maxFee?, depositsPaused?}
  export function vkFromBlob(blob), vkFromSnarkjs(vkJson), vkDiff(a, b): string[]
  export function verifyGroth16(vk, proofHex, publicInputsHex[]): {ok, reason?}   // never throws
  export function reportFromInstrumentOutput(text), reportFromLogcat(text): report | null
  export function judge({report, desk, chainVk, chainVkSource, pinned, withdrawScenario, rehearsal, launches}):
      {id, text, pass, detail}[]   // ids S16.0–S16.8, C8.a–C8.c, then the launches S16.D, S16.10, S16.9
  ```
  CLI: `m1a-checkpoint.mjs desk | vk [--rpc] | phone --apks DIR [--serial] | verify [--report] [--chain] [--rehearsal] | all --apks DIR`, outputs under `build/m1a-checkpoint/` (gitignored): `chain-pool.json`, `phone-report.json`, `launches.json`, `instrument.txt`, `crash-<pkg>.txt`. Exit 0 = every line passed.
- Produces — build: `build-apks.sh [OUT]` → `OUT/{devnet.apk, devnet-androidTest.apk, production.apk, COMMIT, SHA256SUMS}`; `check-release-apk.sh [--expect-present] <apk>` (exit 0 clean / 1 found / 2 unreadable); Gradle task `stageM1aCheckpointKeys` (runs before every `merge*AndroidTestAssets`, fails without the four files).
- **What later checkpoints rely on:** M1b–M1d reuse `build-apks.sh` (the production APK of the same commit, the "not in release" check) and the `phone` command's install / launch / crash-buffer logic (`launch()` in `m1a-checkpoint.mjs`); `rpcRefusal` and the genesis check are the devnet guard every later desk script should take; `verifyGroth16` / `vkFromBlob` are the desk's independent verifier (M1c's `wchange_vk` PDA read uses the same `vkFromBlob` on a `WithdrawChangeVkAccount` — a different account layout, not decoded here). The prove times on the phone (the report's `ms`) are M1c's input (Task 3's "zkey parse 4.6 s desktop" warning).

**The rule, stated once.** The phone reports values; the desk decides. Nothing the phone says is trusted for a value: the desk derives `rho(0)`, the commitment and the public inputs from the mnemonic with code that shares nothing with the native library, takes the deposit VK from the chain's own account (one request, its genesis hash checked), and checks the proof with its own pairing product. The refusal counts only with its control — the same call, approved, proves; the approval, reused, refuses — so "it refused" cannot mean "it could not run". The harness is test code in a test APK; that the release APKs do not contain it is read off the built APKs (and they are content-identical to the base commit's). What only the phone can show is named, and a desktop report cannot pass for a phone's.

- [ ] **Step 1: Wire the harness into the two test source sets only (Gradle).**

Apply to `android/app/build.gradle`:

```diff
diff --git a/android/app/build.gradle b/android/app/build.gradle
index f282a74..db9eb7c 100644
--- a/android/app/build.gradle
+++ b/android/app/build.gradle
@@ -95,6 +95,27 @@ def hasReleaseSigning = releaseStoreFile && releaseStorePassword && releaseKeyAl
  */
 def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'
 
+// The M1a checkpoint's key files (the four pinned A0 files, ~10.6 MB) go into the TEST APK only,
+// copied at build time from NOCTURA_A0_KEYS_DIR (the program side's zk/keys/v2/). Never
+// committed, never in the app; libnoctura_prover re-checks each sha256 on the phone.
+def m1aKeysDir = System.getenv("NOCTURA_A0_KEYS_DIR")
+def m1aKeysAssets = layout.buildDirectory.dir("m1a-checkpoint/assets").get().asFile
+def m1aKeyFiles = ["deposit_final.zkey", "deposit.wasm", "withdraw_change_final.zkey", "withdraw_change.wasm"]
+def stageM1aKeys = tasks.register("stageM1aCheckpointKeys", Sync) {
+    into(new File(m1aKeysAssets, "a0"))
+    if (m1aKeysDir) {
+        from(m1aKeysDir) { include(m1aKeyFiles) }
+    }
+    doFirst {
+        def missing = m1aKeysDir ? m1aKeyFiles.findAll { !new File(m1aKeysDir, it).isFile() } : m1aKeyFiles
+        if (missing) {
+            throw new GradleException(
+                "The M1a checkpoint test APK needs the pinned A0 key files: set NOCTURA_A0_KEYS_DIR " +
+                "to a directory holding ${m1aKeyFiles} (the program side's zk/keys/v2/). Missing: ${missing}")
+        }
+    }
+}
+
 android {
     ndkVersion rootProject.ext.ndkVersion
     buildToolsVersion rootProject.ext.buildToolsVersion
@@ -133,6 +154,25 @@ android {
         targetSdkVersion rootProject.ext.targetSdkVersion
         versionCode 1
         versionName "1.0.0"
+        // The M1a on-phone checkpoint (src/androidTest/): run by scripts/m1a-checkpoint/.
+        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
+    }
+    // The checkpoint instruments the RELEASE app, so the phone proves with the library that
+    // ships. The instrumentation lives in its own APK (app-release-androidTest.apk); the release
+    // APK itself is unchanged — scripts/m1a-checkpoint/check-release-apk.sh proves no checkpoint
+    // class, asset or dependency is in it.
+    testBuildType "release"
+    sourceSets {
+        // The checkpoint sequence, shared by the phone run and its desktop rehearsal
+        // (src/test/…/M1aCheckpointHostTest.kt) — a source dir of the two TEST source sets only.
+        androidTest {
+            java.srcDirs += "src/m1aCheckpoint/java"
+            // The offline fixtures (the seed, the scenarios) and the pinned key files under a0/.
+            assets.srcDirs += ["../../native/noctura-prover/tests/fixtures", m1aKeysAssets]
+        }
+        test {
+            java.srcDirs += "src/m1aCheckpoint/java"
+        }
     }
     // The app's one project-local native library is libnoctura_prover.so (pure Rust, arm64-v8a
     // only), built and installed into src/main/jniLibs/ by native/noctura-prover/build-android.sh
@@ -201,6 +241,16 @@ dependencies {
     // the JNI over the host library. org.json: android.jar's copy is a stub off the device.
     testImplementation("junit:junit:4.13.2")
     testImplementation("org.json:json:20260814")
+
+    // The M1a on-phone checkpoint (the test APK only — never the app).
+    androidTestImplementation("androidx.test:runner:1.7.0")
+    androidTestImplementation("junit:junit:4.13.2")
+}
+
+tasks.configureEach { task ->
+    if (task.name ==~ /merge[A-Za-z]*AndroidTestAssets/) {
+        task.dependsOn(stageM1aKeys)
+    }
 }
 
 
```

**Why `testBuildType "release"`:** the phone must prove with the library that ships. Instrumenting the release variant puts the test in its own APK (`app-release-androidTest.apk`, package `com.nocturawallet.devnet.test`, `<instrumentation targetPackage="com.nocturawallet.devnet">`), signed with the release key so the platform lets it instrument the release app (signatures must match; `debuggable` is not needed), and leaves the release APK exactly as it was (Step 7 measures it: content-identical to the base commit's). A debug variant would test a different build (a cold debug build of every RN module, ~60 min and ~2 GB here, and a debug APK that is not what the owner installs). `minifyEnabled` is false for release (`enableProguardInReleaseBuilds = false`), so the test APK links against the app's real class names — if R8 is ever turned on for release, the harness needs a `-keep` for `com.nocturawallet.prover.**` in a test-only proguard file (Notes). **Why the key files are test assets:** no network on the phone, no `adb push` (an app cannot portably read `/data/local/tmp` under SELinux, and a release app has no `run-as`), and Rust re-checks every sha256 anyway (Task 3's pins) — a wrong file is `E_A0_KEY_FILE_PIN` in the report, not a wrong proof. The Gradle `Sync` task fails the test-APK build without them; the release build never runs it.

- [ ] **Step 2: The shared sequence and its desktop rehearsal — red without the source dir.**

Create `android/app/src/m1aCheckpoint/java/com/nocturawallet/prover/M1aCheckpoint.kt`:

```kotlin
package com.nocturawallet.prover

import com.facebook.react.bridge.JavaOnlyArray
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject

/**
 * The M1a checkpoint sequence (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1a"), shared by
 * the phone run (androidTest `M1aCheckpointTest`, against the installed devnet release APK) and
 * its desktop rehearsal (unit test `M1aCheckpointHostTest`, over the `jni-host` library).
 *
 * NOT APP CODE. `src/m1aCheckpoint/java` is a source directory of the `androidTest` and `test`
 * source sets only (android/app/build.gradle); no class here is compiled into any app variant
 * (scripts/m1a-checkpoint/check-release-apk.sh proves it on the built APK).
 *
 * It REPORTS; the desk DECIDES. Every step records its value or its error code, even after an
 * earlier step failed, so one run gives the whole picture. The desk script
 * (scripts/m1a-checkpoint/m1a-checkpoint.mjs) compares the values with its own (computed from
 * the seed by code that shares nothing with the native library) and verifies the proofs with an
 * independent pairing check against the deposit VK it reads from devnet. Nothing in the report
 * is secret: the seed is the repo's public test mnemonic, and the values are those a deposit and
 * an unshield of that seed publish anyway.
 *
 * The calls go through the layer the React methods are one-liners over: [A0Seed] (the seed as a
 * zero-filled ByteArray), [NocturaA0Native] (the JNI), [A0Result] (the envelope), and every
 * prove runs on [A0Prover]'s thread — the thread the app proves on (its stack size included).
 */
internal object M1aCheckpoint {
    const val SCHEMA = "noctura.m1a.checkpoint-report/1"
    const val LOG_TAG = "M1aCheckpoint"
    const val REPORT_KEY = "m1a-report"

    /** The checkpoint's deposit: the repo test seed, depositIndex 0, 1 token (10^9 base units). */
    const val DEPOSIT_INDEX = "0"
    const val DEPOSIT_AMOUNT = "1000000000"

    /** The four pinned A0 files under their published names (Rust re-checks each sha256). */
    val KEY_FILES = listOf("deposit_final.zkey", "deposit.wasm", "withdraw_change_final.zkey", "withdraw_change.wasm")

    /** A prove on the phone: zkey parse + witness + proof; generous, the desk records the time. */
    private const val PROVE_TIMEOUT_S = 600L

    /**
     * Runs the sequence. [keyVectorsJson] / [proveVectorsJson] are the committed offline fixtures
     * (the seed, the withdraw_change witness and its authorization); [keyPath] maps a published
     * key-file name to a readable path; [platform] says where this ran; [isSupported] is the React
     * module's `isSupported()` (null when it cannot be called — the host rehearsal).
     */
    fun run(
        keyVectorsJson: String,
        proveVectorsJson: String,
        keyPath: (String) -> String,
        platform: JSONObject,
        isSupported: Boolean?,
    ): JSONObject {
        val report = JSONObject()
        report.put("schema", SCHEMA)
        report.put("platform", platform)
        report.put("isSupported", isSupported ?: JSONObject.NULL)

        val keys = JSONObject(keyVectorsJson)
        val proves = JSONObject(proveVectorsJson)
        val seedRow = keys.getJSONArray("seeds").getJSONObject(0)
        val deposit = scenario(proves, "deposit")
        val withdraw = scenario(proves, "withdraw_change")
        report.put("seedLabel", seedRow.getString("label"))
        report.put("depositWitness", deposit.getJSONObject("witness"))
        report.put("withdrawScenario", withdraw.getString("label"))

        // keysOpen with the repo's test seed — through A0Seed, as the React method does.
        val seedHex = seedRow.getString("seed")
        val seed = JavaOnlyArray.from((0 until seedHex.length / 2).map { seedHex.substring(2 * it, 2 * it + 2).toInt(16) })
        var kotlinCopy: ByteArray? = null
        val opened = step {
            A0Seed.use(seed) { b ->
                kotlinCopy = b
                NocturaA0Native.keysOpen(b)
            }
        }
        report.put("keysOpen", opened.json)
        report.put("seedCopyZeroFilled", kotlinCopy?.all { it == 0.toByte() } ?: JSONObject.NULL)
        val h = opened.value as? String
        if (h == null) {
            report.put("complete", false)
            return report
        }

        val rho = step { NocturaA0Native.depositRho(h, DEPOSIT_INDEX) }
        report.put("depositRho", rho.json.put("depositIndex", DEPOSIT_INDEX))
        val rhoHex = rho.value as? String ?: ""
        report.put(
            "commitment",
            step { NocturaA0Native.commitment(h, DEPOSIT_AMOUNT, rhoHex) }.json.put("amount", DEPOSIT_AMOUNT),
        )

        // The deposit proof. Its public inputs are compared on the desk, and the proof is
        // verified there against the deposit VK read from chain.
        report.put("depositProof", prove(h, "deposit", deposit.getJSONObject("witness").toString(), null, keyPath, "deposit"))

        // A withdraw_change prove without an authId refuses — with a well-formed witness and the
        // REAL key files, so nothing but the missing approval can be the reason.
        val wWitness = withdraw.getJSONObject("witness").toString()
        report.put("withdrawWithoutAuthId", prove(h, "withdraw_change", wWitness, null, keyPath, "withdraw_change"))

        // Positive control: approved (Kotlin-only authorizeUnshield, as M1c's dialog will), the
        // same call proves; and the approval is then used up.
        val a = withdraw.getJSONObject("authorization")
        val auth = step { NocturaA0Native.authorizeUnshield(h, a.getString("owner"), a.getString("amount"), a.getString("fee")) }
        report.put("authorizeUnshield", JSONObject().put("ok", auth.value is String).put("error", auth.code ?: JSONObject.NULL))
        val authId = auth.value as? String
        if (authId != null) {
            report.put("withdrawWithAuthId", prove(h, "withdraw_change", wWitness, authId, keyPath, "withdraw_change"))
            report.put("withdrawReusedAuthId", prove(h, "withdraw_change", wWitness, authId, keyPath, "withdraw_change"))
        }

        report.put("keysClose", step { NocturaA0Native.keysClose(h) }.json)
        report.put("depositRhoAfterClose", step { NocturaA0Native.depositRho(h, DEPOSIT_INDEX) }.json)
        report.put("complete", true)
        return report
    }

    /** The checks the device itself can make; the desk makes the rest. Empty = none failed. */
    fun deviceFailures(report: JSONObject, expectSupported: Boolean): List<String> {
        val out = mutableListOf<String>()
        if (expectSupported && report.opt("isSupported") != true) out += "isSupported() is not true"
        if (!report.optBoolean("complete")) out += "the sequence did not complete (keysOpen failed?)"
        if (report.opt("seedCopyZeroFilled") != true) out += "Kotlin's seed copy was not zero-filled"
        for (k in listOf("depositRho", "commitment", "depositProof", "withdrawWithAuthId")) {
            if (report.optJSONObject(k)?.has("ok") != true) out += "$k did not succeed: ${report.optJSONObject(k)}"
        }
        if (codeOf(report, "withdrawWithoutAuthId") != "E_A0_AUTH_ABSENT") out += "withdraw_change without authId: ${report.opt("withdrawWithoutAuthId")}"
        if (codeOf(report, "withdrawReusedAuthId") != "E_A0_AUTH_ABSENT") out += "a used authId was accepted again: ${report.opt("withdrawReusedAuthId")}"
        if (codeOf(report, "depositRhoAfterClose") != "E_A0_UNKNOWN_HANDLE") out += "the handle outlived keysClose"
        return out
    }

    /** The report as lines of at most [max] chars (logcat truncates a line near 4 KB). */
    fun chunks(report: JSONObject, max: Int = 3000): List<String> {
        val s = report.toString()
        val n = (s.length + max - 1) / max
        return (0 until n).map { i -> "M1A-REPORT ${i + 1}/$n ${s.substring(i * max, minOf(s.length, (i + 1) * max))}" }
    }

    private fun codeOf(report: JSONObject, key: String): String? =
        report.optJSONObject(key)?.let { if (it.has("error")) it.getString("error") else null }

    private fun scenario(proves: JSONObject, circuit: String): JSONObject {
        val all = proves.getJSONArray("scenarios")
        for (i in 0 until all.length()) {
            val s = all.getJSONObject(i)
            if (s.getString("circuit") == circuit) return s
        }
        throw IllegalStateException("no $circuit scenario in the prove fixture")
    }

    private class Step(val value: Any?, val code: String?, val message: String?) {
        val json: JSONObject
            get() = if (code == null) JSONObject().put("ok", value ?: JSONObject.NULL) else JSONObject().put("error", code).put("message", message)
    }

    private fun step(call: () -> String?): Step =
        try {
            NocturaNativeLib.ensureLoaded()
            when (val r = A0Result.parse(call())) {
                is A0Result.Ok -> Step(r.value, null, null)
                is A0Result.Err -> Step(null, r.code, r.message)
            }
        } catch (e: UnsatisfiedLinkError) {
            Step(null, A0Result.UNAVAILABLE, "the native library is unavailable")
        }

    /** One prove on the app's proving thread; the result with the thread's name and the time. */
    private fun prove(h: String, circuit: String, witness: String, authId: String?, keyPath: (String) -> String, files: String): JSONObject {
        val done = CountDownLatch(1)
        var result: Step? = null
        var thread = ""
        val t0 = System.nanoTime()
        A0Prover.submit {
            thread = Thread.currentThread().name
            result = try {
                step { NocturaA0Native.prove(h, circuit, witness, authId, keyPath("${files}_final.zkey"), keyPath("$files.wasm")) }
            } catch (e: Throwable) {
                Step(null, A0Result.INTERNAL, e.javaClass.simpleName)
            }
            done.countDown()
        }
        val finished = done.await(PROVE_TIMEOUT_S, TimeUnit.SECONDS)
        val ms = (System.nanoTime() - t0) / 1_000_000
        val r = result
        val out = when {
            !finished || r == null -> JSONObject().put("error", "TIMEOUT").put("message", "no result in $PROVE_TIMEOUT_S s")
            r.code != null -> r.json
            else -> {
                val v = r.value as JSONObject
                JSONObject().put("ok", true).put("proofBytes", v.getString("proofBytes")).put("publicInputs", v.getJSONArray("publicInputs"))
            }
        }
        return out.put("circuit", circuit).put("thread", thread).put("ms", ms).put("withAuthId", authId != null)
    }
}
```

Create `android/app/src/test/java/com/nocturawallet/prover/M1aCheckpointHostTest.kt`:

```kotlin
package com.nocturawallet.prover

import java.io.File
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test

/**
 * The desktop rehearsal of the M1a checkpoint: the SAME sequence the phone runs
 * ([M1aCheckpoint]), over the host build of libnoctura_prover.so (`cargo build --release
 * --features jni-host`) with the pinned key files from NOCTURA_A0_KEYS_DIR. It writes the report
 * to NOCTURA_M1A_REPORT_OUT (default build/m1a-checkpoint/host-report.json) so the desk script can
 * run every one of its checks on a real report before a phone is plugged in:
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs verify --rehearsal <that file>
 *
 * What it cannot show (only the phone can): isSupported() through the React module on ART, the
 * ABI gate on aarch64, the arm64 library loading inside the installed app, the proving thread's
 * stack on Android, the time a prove takes on the phone.
 *
 * Without NOCTURA_A0_HOST_LIB_DIR or NOCTURA_A0_KEYS_DIR it is SKIPPED, loudly
 * (`M1A-HOST-SKIPPED` on stderr); under CI it fails instead.
 */
class M1aCheckpointHostTest {
    private val fixtures = File("../../native/noctura-prover/tests/fixtures")
    private var keysDir: String? = null

    @Before
    fun loadTheHostLibrary() {
        val lib = System.getenv("NOCTURA_A0_HOST_LIB_DIR")
        keysDir = System.getenv("NOCTURA_A0_KEYS_DIR")
        if (lib == null || keysDir == null) {
            check(System.getenv("CI") == null) { "CI must provide NOCTURA_A0_HOST_LIB_DIR and NOCTURA_A0_KEYS_DIR — refusing to skip" }
            System.err.println("M1A-HOST-SKIPPED ${javaClass.simpleName}: NOCTURA_A0_HOST_LIB_DIR / NOCTURA_A0_KEYS_DIR not set — the rehearsal did NOT run")
        }
        assumeTrue(lib != null && keysDir != null)
        NocturaNativeLib.ensureLoaded()
    }

    @Test
    fun theCheckpointSequenceRunsOverTheHostLibraryAndWritesTheReport() {
        val platform = JSONObject()
            .put("where", "host-rehearsal")
            .put("javaVmName", System.getProperty("java.vm.name"))
            .put("osArch", System.getProperty("os.arch"))
        val report = M1aCheckpoint.run(
            File(fixtures, "a0-key-vectors.json").readText(),
            File(fixtures, "a0-prove-vectors.json").readText(),
            { File(keysDir!!, it).path },
            platform,
            null,
        )
        val out = File(System.getenv("NOCTURA_M1A_REPORT_OUT") ?: "build/m1a-checkpoint/host-report.json")
        out.parentFile?.mkdirs()
        out.writeText(report.toString(2) + "\n")
        System.err.println("M1A-HOST-REPORT ${out.absolutePath}")

        assertEquals(emptyList<String>(), M1aCheckpoint.deviceFailures(report, expectSupported = false))
        // The values against the offline fixtures (the desk recomputes them again from the mnemonic).
        val note0 = JSONObject(File(fixtures, "a0-key-vectors.json").readText()).getJSONArray("seeds").getJSONObject(0)
            .getJSONArray("notes").getJSONObject(0)
        assertEquals("0", note0.getString("depositIndex"))
        assertEquals(note0.getString("rho"), report.getJSONObject("depositRho").getString("ok"))
        val c = note0.getJSONArray("commitments").getJSONObject(2)
        assertEquals(M1aCheckpoint.DEPOSIT_AMOUNT, c.getString("amount"))
        assertEquals(c.getString("commitment"), report.getJSONObject("commitment").getString("ok"))
        val scenario0 = JSONObject(File(fixtures, "a0-prove-vectors.json").readText()).getJSONArray("scenarios").getJSONObject(0)
        assertEquals(scenario0.getJSONArray("publicInputs").toString(), report.getJSONObject("depositProof").getJSONArray("publicInputs").toString())
        // The proving thread is the app's, not the test's.
        assertEquals(A0Prover.THREAD_NAME, report.getJSONObject("depositProof").getString("thread"))
        assertTrue(report.getJSONObject("depositProof").getJSONArray("publicInputs").length() == 4)
    }
}

/** The device-side judge itself — pure logic, runs everywhere (no library, no key files). */
class M1aCheckpointDeviceFailuresTest {
    @Test
    fun deviceFailuresSeesEachRefusalThatDidNotHappen() {
        // Negative controls for the device-side judge: a report where each check fails.
        val bad = JSONObject()
            .put("isSupported", false)
            .put("complete", false)
            .put("seedCopyZeroFilled", false)
            .put("withdrawWithoutAuthId", JSONObject().put("ok", true))
            .put("withdrawReusedAuthId", JSONObject().put("error", "E_A0_AUTH_MISMATCH"))
            .put("depositRhoAfterClose", JSONObject().put("ok", "00"))
        val f = M1aCheckpoint.deviceFailures(bad, expectSupported = true)
        assertEquals(f.toString(), 10, f.size)
        assertTrue(M1aCheckpoint.deviceFailures(bad.put("isSupported", JSONObject.NULL), expectSupported = false).none { it.startsWith("isSupported") })
    }
}
```

Red first — the same tree with the `test { java.srcDirs += "src/m1aCheckpoint/java" }` stanza removed from Step 1's diff (the sequence then exists only for androidTest):

```bash
cd android && ENVFILE=.env.devnet ./gradlew :app:testDebugUnitTest --tests 'com.nocturawallet.prover.M1aCheckpointHostTest' --console=plain 2>&1 | grep -E '^e: |FAILED|BUILD' | head -4
```

Expected (measured):

```
> Task :app:compileDebugUnitTestKotlin FAILED
e: file:///…/android/app/src/test/java/com/nocturawallet/prover/M1aCheckpointHostTest.kt:48:22 Unresolved reference 'M1aCheckpoint'.
e: file:///…/android/app/src/test/java/com/nocturawallet/prover/M1aCheckpointHostTest.kt:48:36 Cannot infer type for this parameter. Specify it explicitly.
BUILD FAILED in 45s
```

(The right reason: the shared directory is what makes the rehearsal and the phone run the same code.) Restore the stanza.

- [ ] **Step 3: The rehearsal — green, and its report recorded.**

```bash
cd native/noctura-prover && cargo build --release --locked --features jni-host 2>&1 | tail -1 && cd ../..
cd android && NOCTURA_M1A_REPORT_OUT=$PWD/../scripts/m1a-checkpoint/fixtures/host-rehearsal-report.json \
  NOCTURA_A0_KEYS_DIR=<program side>/zk/keys/v2 NOCTURA_A0_HOST_LIB_DIR=$CARGO_TARGET_DIR/release \
  ENVFILE=.env.devnet ./gradlew :app:testDebugUnitTest --rerun --tests 'com.nocturawallet.prover.M1aCheckpoint*' --console=plain \
  2>&1 | grep -E '^e: |^w: |M1aCheckpoint.*Test > \w+ (PASSED|FAILED|SKIPPED)|M1A-|BUILD'
```

Expected:

```
    Finished `release` profile [optimized] target(s) in 23.16s
M1aCheckpointDeviceFailuresTest > deviceFailuresSeesEachRefusalThatDidNotHappen PASSED
    M1A-HOST-REPORT /…/scripts/m1a-checkpoint/fixtures/host-rehearsal-report.json
M1aCheckpointHostTest > theCheckpointSequenceRunsOverTheHostLibraryAndWritesTheReport PASSED
BUILD SUCCESSFUL in 11s
```

The recorded report (`fixtures/host-rehearsal-report.json`, 82 lines; this dry run's sha256 `80ca79e9…903651`) is written by the code under test, and that is why it is only an INPUT to the desk tests (Step 4): its proofs are judged by the pairing equation and its values by `deskValues()`, never the other way round. Every run gives different proof bytes (the prover's `r`, `s` come from the OS) and different `ms`; an executor's own run is the fixture — nothing pins its bytes. Measured here: deposit prove 598–644 ms, withdraw_change 4,149–4,244 ms (desktop, release library; the zkey parse dominates), both on thread `noctura-a0-prove`. Without the two variables the gated test SKIPS loudly (`M1A-HOST-SKIPPED M1aCheckpointHostTest: NOCTURA_A0_HOST_LIB_DIR / NOCTURA_A0_KEYS_DIR not set — the rehearsal did NOT run`, JUnit "skipped") while `M1aCheckpointDeviceFailuresTest` still runs and passes; with `CI` set the gated test FAILS (`java.lang.IllegalStateException` at the `check`) — both measured. (The first version had the pure judge test in the gated class, so it skipped too; it was moved to its own class for that reason.)

- [ ] **Step 4: The desk tests — red (no `lib.mjs`).**

Create `scripts/m1a-checkpoint/lib.test.mjs`:

```js
/**
 * The desk logic's own tests (node:test — run by hand: `node --test scripts/m1a-checkpoint/`;
 * Jest does not collect .mjs). Every check has its negative control: a verifier that accepts
 * everything, a VK decoder that reads the wrong limb order, a judge that passes a missing line —
 * each would make the checkpoint print PASS for a phone that proved nothing.
 *
 * Inputs: the committed offline fixtures (native/noctura-prover/tests/fixtures), the RECORDED
 * devnet read of the Pool account (fixtures/devnet-pool-520213277.json, written by `vk` — the
 * tests never touch the network) and the desktop rehearsal's report
 * (fixtures/host-rehearsal-report.json, written by M1aCheckpointHostTest over the jni-host
 * library). The rehearsal report is an INPUT here — what decides its proofs are valid is the
 * pairing equation, and what decides its values are right is deskValues().
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import * as L from './lib.mjs';

const here = join(L.ROOT, 'scripts/m1a-checkpoint/fixtures');
const chain = L.readJson(join(here, 'devnet-pool-520213277.json'));
const hostReport = L.readJson(join(here, 'host-rehearsal-report.json'));
const proves = L.fixture('a0-prove-vectors.json');
const keys = L.fixture('a0-key-vectors.json');
const pinned = {
  deposit: L.vkFromSnarkjs(L.fixture('a0-vk/deposit_vk.json')),
  withdrawChange: L.vkFromSnarkjs(L.fixture('a0-vk/withdraw_change_vk.json')),
};
const poolData = () => Buffer.from(chain.dataBase64, 'base64');
const chainVk = () =>
  L.vkFromBlob(
    L.decodePoolAccount({ owner: chain.owner, data: poolData() }).blob,
  );
const clone = o => JSON.parse(JSON.stringify(o));
const flipHex = (h, i = 63) =>
  h.slice(0, i) + (parseInt(h[i], 16) ^ 1).toString(16) + h.slice(i + 1);

test('the desk values equal the offline fixtures (deposit scenario, key vectors note 0)', () => {
  const d = L.deskValues();
  assert.equal(d.seedHex, keys.seeds[0].seed);
  const n0 = keys.seeds[0].notes.find(n => n.depositIndex === '0');
  assert.equal(d.rho, n0.rho);
  assert.equal(
    d.commitment,
    n0.commitments.find(c => c.amount === '1000000000').commitment,
  );
  assert.equal(d.mintHash, keys.constants.mintHash);
  assert.deepEqual(d.publicInputs, proves.scenarios[0].publicInputs);
  // negative control: another index gives another rho (the comparison can fail)
  assert.notEqual(
    keys.seeds[0].notes.find(n => n.depositIndex === '1').rho,
    d.rho,
  );
});

test('the recorded Pool account decodes to the pinned deposit VK', () => {
  const p = L.decodePoolAccount({ owner: chain.owner, data: poolData() });
  assert.deepEqual(p.errs, []);
  assert.equal(p.blob.length, 768);
  assert.equal(p.maxFee, '100000');
  assert.deepEqual(L.vkDiff(L.vkFromBlob(p.blob), pinned.deposit), []);
  // negative controls: one VK byte changed; G2 read c0-first; the withdraw_change VK
  const d = poolData();
  d[L.POOL_LAYOUT.depositVk + 448 + 64 * 4 + 63] ^= 1; // last IC point's y
  assert.deepEqual(
    L.vkDiff(
      L.vkFromBlob(L.decodePoolAccount({ owner: chain.owner, data: d }).blob),
      pinned.deposit,
    ),
    ['ic[4][1]'],
  );
  const wrongOrder = L.vkFromBlob(p.blob);
  wrongOrder.beta = wrongOrder.beta.map(([c0, c1]) => [c1, c0]);
  assert.deepEqual(L.vkDiff(wrongOrder, pinned.deposit), [
    'beta[0][0]',
    'beta[0][1]',
    'beta[1][0]',
    'beta[1][1]',
  ]);
  assert.ok(L.vkDiff(pinned.withdrawChange, pinned.deposit).length > 0);
});

test('decodePoolAccount refuses another owner, size, discriminator, mint or tree', () => {
  const ok = { owner: chain.owner, data: poolData() };
  assert.match(
    L.decodePoolAccount({ ...ok, owner: L.DEVNET.pool }).errs[0],
    /not the A0 program/,
  );
  assert.match(
    L.decodePoolAccount({ ...ok, data: poolData().subarray(0, 927) }).errs[0],
    /927 bytes/,
  );
  for (const [at, re] of [
    [0, /discriminator/],
    [L.POOL_LAYOUT.mint, /mint/],
    [L.POOL_LAYOUT.merkleTree, /merkle_tree/],
  ]) {
    const d = poolData();
    d[at] ^= 1;
    assert.match(L.decodePoolAccount({ ...ok, data: d }).errs.join(), re);
  }
  assert.equal(
    L.accountDiscriminator('Pool'),
    poolData().subarray(0, 8).toString('hex'),
  );
});

test('verifyGroth16: the two LANDED withdraw_with_change proofs verify against the pinned VK', () => {
  assert.equal(proves.landed.length, 2);
  for (const l of proves.landed) {
    assert.deepEqual(
      L.verifyGroth16(pinned.withdrawChange, l.proofBytes, l.publicInputs),
      { ok: true },
    );
  }
});

test('verifyGroth16 refuses: a changed public input, A not negated, G2 c0-first, another VK, bad encodings', () => {
  const l = proves.landed[0];
  const vk = pinned.withdrawChange;
  const pubs = l.publicInputs.map((p, i) => (i === 2 ? flipHex(p) : p));
  assert.equal(L.verifyGroth16(vk, l.proofBytes, pubs).ok, false);
  const b = Buffer.from(l.proofBytes, 'hex');
  const y = BigInt('0x' + b.subarray(32, 64).toString('hex'));
  const unNeg = Buffer.from(b);
  Buffer.from(((L.P - y) % L.P).toString(16).padStart(64, '0'), 'hex').copy(
    unNeg,
    32,
  );
  assert.equal(
    L.verifyGroth16(vk, unNeg.toString('hex'), l.publicInputs).ok,
    false,
  );
  const c0first = Buffer.from(b);
  for (const o of [64, 128]) {
    b.copy(c0first, o, o + 32, o + 64);
    b.copy(c0first, o + 32, o, o + 32);
  }
  assert.equal(
    L.verifyGroth16(vk, c0first.toString('hex'), l.publicInputs).ok,
    false,
  );
  assert.match(
    L.verifyGroth16(pinned.deposit, l.proofBytes, l.publicInputs).reason,
    /7 public inputs for a VK with 4/,
  );
  assert.match(
    L.verifyGroth16(vk, l.proofBytes.toUpperCase(), l.publicInputs).reason,
    /lowercase hex/,
  );
  const big = [...l.publicInputs];
  big[0] = 'f'.repeat(64);
  assert.match(L.verifyGroth16(vk, l.proofBytes, big).reason, /not < r/);
});

test("the rehearsal's deposit proof verifies against the deposit VK recorded from chain, and not with a changed input", () => {
  const dp = hostReport.depositProof;
  assert.deepEqual(L.verifyGroth16(chainVk(), dp.proofBytes, dp.publicInputs), {
    ok: true,
  });
  assert.equal(
    L.verifyGroth16(
      chainVk(),
      dp.proofBytes,
      dp.publicInputs.map((p, i) => (i === 1 ? flipHex(p) : p)),
    ).ok,
    false,
  );
});

const judgeWith = (report, extra = {}) =>
  L.judge({
    report,
    desk: L.deskValues(),
    chainVk: chainVk(),
    chainVkSource: 'recorded',
    pinned,
    withdrawScenario: proves.scenarios.find(
      s => s.label === report.withdrawScenario,
    ),
    ...extra,
  });
const failing = lines => lines.filter(l => !l.pass).map(l => l.id);
const asPhone = r => {
  const p = clone(r);
  p.platform = {
    where: 'phone',
    javaVmName: 'Dalvik',
    osArch: 'aarch64',
    supportedAbis: ['arm64-v8a'],
  };
  p.isSupported = true;
  return p;
};
const launched = [
  { id: 'S16.D', text: 'device test', pass: true },
  { id: 'S16.10', text: 'devnet launch', pass: true },
  { id: 'S16.9', text: 'production launch', pass: true },
];

test('judge: the rehearsal passes every desk line and fails exactly the phone-only ones', () => {
  assert.deepEqual(failing(judgeWith(hostReport, { rehearsal: true })), [
    'S16.0',
    'S16.1',
  ]);
  assert.deepEqual(failing(judgeWith(hostReport)), ['S16.0', 'S16.1', 'S16.9']);
  for (const id of ['S16.0', 'S16.1', 'S16.9', 'S16.10']) {
    assert.ok(L.PHONE_ONLY.has(id));
  }
});

test('judge: a phone report with launches passes every line (positive control of the whole judge)', () => {
  const lines = judgeWith(asPhone(hostReport), { launches: launched });
  assert.deepEqual(failing(lines), []);
  assert.deepEqual(
    lines.map(l => l.id),
    [
      'S16.0',
      'S16.1',
      'S16.2',
      'S16.3',
      'S16.4',
      'S16.5',
      'S16.6',
      'S16.7',
      'S16.8',
      'C8.a',
      'C8.b',
      'C8.c',
      'S16.D',
      'S16.10',
      'S16.9',
    ],
  );
});

test('judge: each defect fails its own line', () => {
  const base = asPhone(hostReport);
  const cases = [
    [r => (r.isSupported = false), ['S16.1']],
    [r => (r.platform.osArch = 'x86_64'), ['S16.0', 'S16.1']],
    [r => (r.seedCopyZeroFilled = false), ['S16.2']],
    [r => (r.depositRho.ok = flipHex(r.depositRho.ok)), ['S16.3']],
    [r => (r.commitment.ok = flipHex(r.commitment.ok)), ['S16.4']],
    [
      r =>
        (r.depositProof.publicInputs[3] = flipHex(
          r.depositProof.publicInputs[3],
        )),
      ['S16.5', 'S16.7'],
    ],
    [
      r =>
        (r.depositProof.proofBytes = flipHex(r.depositProof.proofBytes, 300)),
      ['S16.7'],
    ],
    [
      r => (r.depositProof = { error: 'E_A0_KEY_FILE_PIN' }),
      ['S16.5', 'S16.7'],
    ],
    [
      r => (r.withdrawWithoutAuthId = { ok: true, withAuthId: false }),
      ['S16.8'],
    ],
    [r => (r.withdrawWithoutAuthId.withAuthId = true), ['S16.8']],
    // refused, but for another reason (a key file): not the refusal the checkpoint asks for
    [r => (r.withdrawWithoutAuthId.error = 'E_A0_KEY_FILE_READ'), ['S16.8']],
    [
      r =>
        (r.withdrawWithAuthId.publicInputs[2] = flipHex(
          r.withdrawWithAuthId.publicInputs[2],
        )),
      ['C8.a'],
    ],
    [r => (r.withdrawReusedAuthId = { ok: true }), ['C8.b']],
    [r => (r.depositRhoAfterClose = { ok: 'x' }), ['C8.c']],
  ];
  for (const [mutate, want] of cases) {
    const r = clone(base);
    mutate(r);
    assert.deepEqual(
      failing(judgeWith(r, { launches: launched })),
      want,
      mutate.toString(),
    );
  }
  // the chain VK: absent, or one coordinate off
  assert.deepEqual(
    failing(judgeWith(base, { launches: launched, chainVk: null })),
    ['S16.6', 'S16.7'],
  );
  const off = chainVk();
  off.ic[2][0] ^= 1n;
  assert.deepEqual(
    failing(judgeWith(base, { launches: launched, chainVk: off })),
    ['S16.6', 'S16.7'],
  );
  // a failed launch
  assert.deepEqual(
    failing(
      judgeWith(base, {
        launches: launched.map(l => ({ ...l, pass: l.id !== 'S16.9' })),
      }),
    ),
    ['S16.9'],
  );
});

test('the report is read from am instrument -r output, or reassembled from logcat chunks', () => {
  const json = JSON.stringify(hostReport);
  const inst = `INSTRUMENTATION_STATUS: class=x\nINSTRUMENTATION_STATUS: m1a-report=${json}\nINSTRUMENTATION_STATUS_CODE: 7\nOK (1 test)\n`;
  assert.deepEqual(L.reportFromInstrumentOutput(inst), hostReport);
  const parts = [json.slice(0, 1000), json.slice(1000, 2000), json.slice(2000)];
  const log = parts.map(
    (p, i) => `11-09 01:00:00.000 I M1aCheckpoint: M1A-REPORT ${i + 1}/3 ${p}`,
  );
  assert.deepEqual(
    L.reportFromInstrumentOutput([log[2], log[0], log[1]].join('\n')),
    hostReport,
  );
  assert.equal(L.reportFromLogcat([log[0], log[2]].join('\n')), null);
  assert.equal(L.reportFromInstrumentOutput('INSTRUMENTATION_FAILED: x'), null);
});

test('the RPC guard: devnet over https only, never noc-tura.io, solscan.io or mainnet', () => {
  assert.equal(L.rpcRefusal('https://api.devnet.solana.com'), null);
  assert.equal(L.rpcRefusal('https://devnet.helius-rpc.com/?api-key=x'), null);
  for (const bad of [
    'http://api.devnet.solana.com',
    'https://api.noc-tura.io/rpc',
    'https://noc-tura.io',
    'https://api.mainnet-beta.solana.com',
    'https://mainnet.helius-rpc.com/?api-key=x',
    'https://public-api.solscan.io',
    'not a url',
  ]) {
    assert.ok(L.rpcRefusal(bad), bad);
  }
});
```

```bash
node --no-warnings --test scripts/m1a-checkpoint/lib.test.mjs 2>&1 | grep -E "ERR_|^ℹ (tests|pass|fail)"
```

Expected:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/…/scripts/m1a-checkpoint/lib.mjs' imported from /…/scripts/m1a-checkpoint/lib.test.mjs
  code: 'ERR_MODULE_NOT_FOUND',
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

(`node --test scripts/m1a-checkpoint/` — a directory — does not work on Node 24.10: it resolves the directory as a module, `MODULE_NOT_FOUND`. Name the file. `--no-warnings` silences the one `MODULE_TYPELESS_PACKAGE_JSON` warning Node prints when it loads `fieldEquations.ts`, as for `scripts/a0-vectors/`.)

- [ ] **Step 5: The desk library and the CLI; the one devnet read.**

Create `scripts/m1a-checkpoint/lib.mjs`:

```js
/**
 * The M1a checkpoint's desk logic (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1a"):
 * the desk values, the deposit VK read out of the devnet Pool account, an independent Groth16
 * check, and the judge that turns a phone report into one PASS / FAIL per §16 line.
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Nothing here shares code with native/noctura-prover:
 *   - the desk values come from the seed through micro-key-producer/bls.js (EIP-2333),
 *     poseidon-lite via the app's own src/modules/shielded/a0/fieldEquations.ts, and
 *     @noble/hashes SHA-512 — the implementations the offline fixtures were written with;
 *   - the proof check is a pairing product over @noble/curves' bn254, not arkworks (which proved
 *     on the phone and self-verified there);
 *   - the VK is decoded from the account bytes by the layout of the program side's
 *     `Pool` / `DepositVk` (programs/shielded-pool/src/state.rs) and EIP-197 point encoding —
 *     a FACT taken from them; the VALUES are the chain's, compared with the pinned vk.json.
 *
 * Pure functions only (no network, no adb): m1a-checkpoint.mjs does the I/O. Tested by
 * lib.test.mjs (`node --test scripts/m1a-checkpoint/`). Node 24 (fieldEquations.ts is
 * TypeScript; Node ≥ 22.6 needs --experimental-strip-types).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bn254 } from '@noble/curves/bn254.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { base58 } from '@scure/base';
import { deriveSeedTree } from 'micro-key-producer/bls.js';
import { poseidon2, poseidon3 } from 'poseidon-lite';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = join(ROOT, 'native/noctura-prover/tests/fixtures');
const EQ = await import(
  join(ROOT, 'src/modules/shielded/a0/fieldEquations.ts')
);
const R = EQ.FIELD_MODULUS;
/** The BN254 base field (G1 / G2 coordinates). */
export const P =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

/** spec §1 — the deployed devnet A0 pool (facts). */
export const DEVNET = {
  genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
  pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
  mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
  merkleTree: '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc',
};
/** The checkpoint's deposit (spec §16): the repo test seed, depositIndex 0, 10^9 base units. */
export const CHECKPOINT = {
  mnemonic:
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  spendPath: 'm/12381/371/1/0',
  depositIndex: 0n,
  amount: 1000000000n,
};
const D_SELF_DOMAIN = 'noctura/a0/self-d/v1';
const DEPOSIT_RHO_DOMAIN = 'noctura/a0/deposit-rho/v1';

const hex = b => Buffer.from(b).toString('hex');
const os2ip = b => (b.length === 0 ? 0n : BigInt('0x' + hex(b)));
const be32 = v => {
  if (v < 0n || v >= R) {
    throw new Error('value outside the scalar field');
  }
  return v.toString(16).padStart(64, '0');
};
const fieldBytes = v => Uint8Array.from(Buffer.from(be32(v), 'hex'));
const u64be = i => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, i, false);
  return b;
};
const concat = (...parts) => Uint8Array.from(parts.flatMap(p => [...p]));
const text = s => new TextEncoder().encode(s);

export const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
export const fixture = name => readJson(join(FIXTURES, name));

/**
 * The desk values of the checkpoint's deposit, computed from the mnemonic (spec §3 equations).
 * Returns hex strings (32-byte BE) plus the seed hex, so the caller can check the phone was fed
 * the same seed the desk derived from.
 */
export function deskValues() {
  const seed = mnemonicToSeedSync(CHECKPOINT.mnemonic, '');
  const sk = deriveSeedTree(seed, CHECKPOINT.spendPath);
  const nk = poseidon3([
    EQ.TAG.NK,
    os2ip(sk.slice(0, 16)),
    os2ip(sk.slice(16, 32)),
  ]);
  sk.fill(0);
  const dSelf = os2ip(sha512(concat(text(D_SELF_DOMAIN), fieldBytes(nk)))) % R;
  const addrSelf = EQ.addrField(nk, dSelf);
  const rho =
    os2ip(
      sha512(
        concat(
          text(DEPOSIT_RHO_DOMAIN),
          fieldBytes(nk),
          u64be(CHECKPOINT.depositIndex),
        ),
      ),
    ) % R;
  const mintHash = os2ip(base58.decode(DEVNET.mint)) % R;
  const commitment = EQ.commitment({
    addrField: addrSelf,
    amount: CHECKPOINT.amount,
    mintHash,
    rho,
  });
  // ivk is not part of the checkpoint; computing it only checks the Poseidon2 path is wired.
  poseidon2([EQ.TAG.IVK, nk]);
  return {
    seedHex: hex(seed),
    depositIndex: CHECKPOINT.depositIndex.toString(),
    amount: CHECKPOINT.amount.toString(),
    rho: be32(rho),
    commitment: be32(commitment),
    mintHash: be32(mintHash),
    // deposit public inputs, in the circuit's order (spec §1): commitment, amount, mintHash, rho
    publicInputs: [
      be32(commitment),
      be32(CHECKPOINT.amount),
      be32(mintHash),
      be32(rho),
    ],
  };
}

/**
 * Why an RPC URL is refused, or null. The checkpoint reads devnet only: https, never a
 * noc-tura.io or solscan.io host, never a host naming mainnet. (The genesis hash is checked on
 * the answer as well — a URL can lie, the genesis cannot.)
 */
export function rpcRefusal(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return `not a URL: ${url}`;
  }
  if (u.protocol !== 'https:') {
    return `the RPC must be https: ${u.origin}`;
  }
  const h = u.hostname.toLowerCase();
  if (
    h === 'noc-tura.io' ||
    h.endsWith('.noc-tura.io') ||
    h === 'solscan.io' ||
    h.endsWith('.solscan.io') ||
    h.includes('mainnet')
  ) {
    return `refusing ${h}: the checkpoint reads devnet only, never noc-tura.io, solscan.io or mainnet`;
  }
  return null;
}

// ---------------------------------------------------------------- the VK, chain and pinned

/** Anchor account discriminator: sha256("account:<Name>")[0..8]. */
export const accountDiscriminator = name =>
  hex(sha256(text(`account:${name}`)).slice(0, 8));

/**
 * The program side's `Pool` (zero_copy, repr(C), all fields align 1 except u64 at 8):
 * 8 discriminator | authority 32 | mint 32 | vault 32 | merkle_tree 32 | bump 1 | pad 7 |
 * deposit_vk 768 (alpha 64, beta 128, gamma 128, delta 128, ic 5 × 64) | max_fee u64 LE |
 * deposits_paused u8 | pad 7  = 928 bytes.
 */
export const POOL_LAYOUT = {
  size: 928,
  mint: 40,
  merkleTree: 104,
  depositVk: 144,
  depositVkLen: 768,
  maxFee: 912,
  paused: 920,
};

/** Checks the account is the pinned devnet pool and returns its deposit VK blob and fields. */
export function decodePoolAccount({ owner, data }) {
  const errs = [];
  if (owner !== DEVNET.programId) {
    errs.push(`owner ${owner} is not the A0 program`);
  }
  if (data.length !== POOL_LAYOUT.size) {
    errs.push(`data is ${data.length} bytes, a Pool is ${POOL_LAYOUT.size}`);
  }
  if (errs.length) {
    return { errs };
  }
  if (hex(data.subarray(0, 8)) !== accountDiscriminator('Pool')) {
    errs.push('the discriminator is not account:Pool');
  }
  const key = o => base58.encode(data.subarray(o, o + 32));
  if (key(POOL_LAYOUT.mint) !== DEVNET.mint) {
    errs.push(`mint ${key(POOL_LAYOUT.mint)} is not the pinned mint`);
  }
  if (key(POOL_LAYOUT.merkleTree) !== DEVNET.merkleTree) {
    errs.push(
      `merkle_tree ${key(POOL_LAYOUT.merkleTree)} is not the pinned tree`,
    );
  }
  const blob = data.subarray(
    POOL_LAYOUT.depositVk,
    POOL_LAYOUT.depositVk + POOL_LAYOUT.depositVkLen,
  );
  return {
    errs,
    blob,
    maxFee: data.readBigUInt64LE(POOL_LAYOUT.maxFee).toString(),
    depositsPaused: data[POOL_LAYOUT.paused],
  };
}

const int = b => BigInt('0x' + hex(b));
/** G1, 64 bytes: x BE, y BE. */
const g1 = b => [int(b.subarray(0, 32)), int(b.subarray(32, 64))];
/** G2, 128 bytes, EIP-197: x.c1, x.c0, y.c1, y.c0 — returned as [[x.c0, x.c1], [y.c0, y.c1]]. */
const g2 = b => [
  [int(b.subarray(32, 64)), int(b.subarray(0, 32))],
  [int(b.subarray(96, 128)), int(b.subarray(64, 96))],
];

/** A VK blob as the program stores it (alpha, beta, gamma, delta, ic[]) → coordinates. */
export function vkFromBlob(blob) {
  if ((blob.length - 448) % 64 !== 0 || blob.length < 448 + 128) {
    throw new Error(`a VK blob of ${blob.length} bytes is malformed`);
  }
  const ic = [];
  for (let o = 448; o < blob.length; o += 64) {
    ic.push(g1(blob.subarray(o, o + 64)));
  }
  return {
    alpha: g1(blob.subarray(0, 64)),
    beta: g2(blob.subarray(64, 192)),
    gamma: g2(blob.subarray(192, 320)),
    delta: g2(blob.subarray(320, 448)),
    ic,
  };
}

/** A snarkjs verifying key (vk.json; G2 is [c0, c1]) → the same coordinates. */
export function vkFromSnarkjs(vk) {
  if (vk.protocol !== 'groth16' || vk.curve !== 'bn128') {
    throw new Error('not a groth16 / bn128 verifying key');
  }
  const p1 = p => {
    if (p[2] !== '1') {
      throw new Error('a G1 point is not affine');
    }
    return [BigInt(p[0]), BigInt(p[1])];
  };
  const p2 = p => {
    if (p[2][0] !== '1' || p[2][1] !== '0') {
      throw new Error('a G2 point is not affine');
    }
    return [
      [BigInt(p[0][0]), BigInt(p[0][1])],
      [BigInt(p[1][0]), BigInt(p[1][1])],
    ];
  };
  if (vk.IC.length !== vk.nPublic + 1) {
    throw new Error('IC length is not nPublic + 1');
  }
  return {
    alpha: p1(vk.vk_alpha_1),
    beta: p2(vk.vk_beta_2),
    gamma: p2(vk.vk_gamma_2),
    delta: p2(vk.vk_delta_2),
    ic: vk.IC.map(p1),
  };
}

/** The coordinates that differ between two VKs (empty = the same key). */
export function vkDiff(a, b) {
  const out = [];
  const walk = (x, y, path) => {
    if (Array.isArray(x) || Array.isArray(y)) {
      if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) {
        out.push(`${path}: shape differs`);
        return;
      }
      x.forEach((v, i) => walk(v, y[i], `${path}[${i}]`));
    } else if (x !== y) {
      out.push(path);
    }
  };
  for (const k of ['alpha', 'beta', 'gamma', 'delta', 'ic']) {
    walk(a[k], b[k], k);
  }
  return out;
}

// ---------------------------------------------------------------- Groth16, independently

const { Fp2, Fp12 } = bn254.fields;
const G1 = bn254.G1.Point;
const G2 = bn254.G2.Point;
const toG1 = ([x, y]) => {
  const p = G1.fromAffine({ x, y });
  p.assertValidity();
  return p;
};
const toG2 = ([[x0, x1], [y0, y1]]) => {
  const p = G2.fromAffine({
    x: Fp2.create({ c0: x0, c1: x1 }),
    y: Fp2.create({ c0: y0, c1: y1 }),
  });
  p.assertValidity();
  return p;
};

/**
 * Verifies a proof in the on-chain 256-byte layout — A with y NEGATED (64) | B, EIP-197 (128) |
 * C (64) — against `vk` (coordinates), for `publicInputs` (32-byte BE hex, each < r):
 *   e(−A, B) · e(α, β) · e(vk_x, γ) · e(C, δ) = 1,   vk_x = IC₀ + Σ xᵢ·ICᵢ₊₁.
 * Returns {ok, reason}. Never throws on bad input.
 */
export function verifyGroth16(vk, proofHex, publicInputs) {
  try {
    if (!/^[0-9a-f]{512}$/.test(proofHex)) {
      return { ok: false, reason: 'proof is not 256 bytes of lowercase hex' };
    }
    if (publicInputs.length + 1 !== vk.ic.length) {
      return {
        ok: false,
        reason: `${publicInputs.length} public inputs for a VK with ${vk.ic.length - 1}`,
      };
    }
    const xs = publicInputs.map(h => {
      if (!/^[0-9a-f]{64}$/.test(h)) {
        throw new Error('a public input is not 32-byte hex');
      }
      const v = BigInt('0x' + h);
      if (v >= R) {
        throw new Error('a public input is not < r');
      }
      return v;
    });
    const b = Buffer.from(proofHex, 'hex');
    for (const [o, n] of [
      [0, 2],
      [64, 4],
      [192, 2],
    ]) {
      for (let i = 0; i < n; i++) {
        if (int(b.subarray(o + 32 * i, o + 32 * (i + 1))) >= P) {
          throw new Error('a proof coordinate is not < p');
        }
      }
    }
    const negA = toG1(g1(b.subarray(0, 64)));
    const B = toG2(g2(b.subarray(64, 192)));
    const C = toG1(g1(b.subarray(192, 256)));
    let vkx = toG1(vk.ic[0]);
    xs.forEach((x, i) => {
      if (x !== 0n) {
        vkx = vkx.add(toG1(vk.ic[i + 1]).multiply(x));
      }
    });
    const prod = bn254.pairingBatch([
      { g1: negA, g2: B },
      { g1: toG1(vk.alpha), g2: toG2(vk.beta) },
      { g1: vkx, g2: toG2(vk.gamma) },
      { g1: C, g2: toG2(vk.delta) },
    ]);
    return Fp12.eql(prod, Fp12.ONE)
      ? { ok: true }
      : { ok: false, reason: 'the pairing check fails' };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ---------------------------------------------------------------- the phone's report

/** The report from `am instrument -r` output (status key m1a-report) or logcat chunks. */
export function reportFromInstrumentOutput(out) {
  const m = out.match(/^INSTRUMENTATION_STATUS: m1a-report=(\{.*\})\s*$/m);
  if (m) {
    return JSON.parse(m[1]);
  }
  return reportFromLogcat(out);
}

/** Reassembles `M1A-REPORT i/n <part>` lines (logcat truncates a line near 4 KB). */
export function reportFromLogcat(out) {
  const parts = new Map();
  let total = 0;
  for (const m of out.matchAll(/M1A-REPORT (\d+)\/(\d+) (.*)$/gm)) {
    parts.set(Number(m[1]), m[3]);
    total = Number(m[2]);
  }
  if (total === 0 || parts.size !== total) {
    return null;
  }
  return JSON.parse(
    [...Array(total).keys()].map(i => parts.get(i + 1)).join(''),
  );
}

/**
 * One PASS / FAIL per §16 line (and the controls), from the phone's report, the desk values,
 * the chain's deposit VK (null if not read), the pinned VKs and the fixture's withdraw_change
 * scenario. `rehearsal` = a host report: the phone-only lines cannot pass, and say why.
 */
export function judge({
  report,
  desk,
  chainVk,
  chainVkSource,
  pinned,
  withdrawScenario,
  rehearsal = false,
  launches = [],
}) {
  const lines = [];
  const add = (id, text, pass, detail = '') =>
    lines.push({ id, text, pass, detail });
  const ok = k => report?.[k] && Object.hasOwn(report[k], 'ok');
  const val = k => (ok(k) ? report[k].ok : undefined);
  const code = k => report?.[k]?.error;
  const plat = report?.platform ?? {};

  const onPhone =
    plat.where === 'phone' &&
    plat.javaVmName === 'Dalvik' &&
    plat.osArch === 'aarch64';
  add(
    'S16.0',
    'the report comes from the phone (ART, aarch64), not a rehearsal',
    onPhone,
    `where=${plat.where} vm=${plat.javaVmName} arch=${plat.osArch} model=${plat.model ?? '-'} abis=${(plat.supportedAbis ?? []).join(',')}`,
  );
  add(
    'S16.1',
    'isSupported() is true on the phone',
    onPhone && report.isSupported === true,
    rehearsal && !onPhone
      ? 'a rehearsal cannot call the React module on ART'
      : `isSupported=${report?.isSupported}`,
  );
  add(
    'S16.2',
    "keysOpen with the repo's test seed returns a handle (and Kotlin's seed copy is zero-filled)",
    typeof val('keysOpen') === 'string' &&
      /^[1-9][0-9]*$/.test(val('keysOpen')) &&
      report.seedCopyZeroFilled === true &&
      /abandon/.test(report.seedLabel ?? ''),
    `seed=${report?.seedLabel}`,
  );
  add(
    'S16.3',
    'depositRho(0) equals the desk value',
    val('depositRho') === desk.rho,
    `phone=${val('depositRho') ?? code('depositRho')} desk=${desk.rho}`,
  );
  add(
    'S16.4',
    'commitment(10^9, rho(0)) equals the desk value',
    val('commitment') === desk.commitment &&
      report.commitment.amount === desk.amount,
    `phone=${val('commitment') ?? code('commitment')} desk=${desk.commitment}`,
  );
  const dp = report?.depositProof ?? {};
  const pubs = dp.publicInputs ?? [];
  add(
    'S16.5',
    "the deposit proof's public inputs equal the desk values (commitment, amount, mintHash, rho)",
    dp.ok === true &&
      pubs.length === 4 &&
      pubs.every((p, i) => p === desk.publicInputs[i]) &&
      report.depositWitness?.amount === desk.amount &&
      report.depositWitness?.depositIndex === desk.depositIndex,
    dp.ok
      ? pubs
          .map((p, i) => `[${i}] ${p === desk.publicInputs[i] ? '=' : '≠'}`)
          .join(' ')
      : `error=${dp.error}`,
  );
  const vkMatch = chainVk ? vkDiff(chainVk, pinned.deposit) : null;
  add(
    'S16.6',
    'the deposit VK read from chain equals the pinned deposit_vk.json',
    !!chainVk && vkMatch.length === 0,
    chainVk
      ? vkMatch.length
        ? `differs at ${vkMatch.join(', ')}`
        : chainVkSource
      : 'the VK was not read from chain',
  );
  const v =
    chainVk && dp.ok
      ? verifyGroth16(chainVk, dp.proofBytes, pubs)
      : { ok: false, reason: chainVk ? 'no deposit proof' : 'no chain VK' };
  add(
    'S16.7',
    'the deposit proof verifies against the deposit VK read from chain',
    v.ok,
    v.ok ? `${dp.ms} ms on ${dp.thread}` : v.reason,
  );
  add(
    'S16.8',
    'a withdraw_change prove without an authId refuses (E_A0_AUTH_ABSENT)',
    code('withdrawWithoutAuthId') === 'E_A0_AUTH_ABSENT' &&
      report.withdrawWithoutAuthId.withAuthId === false,
    `code=${code('withdrawWithoutAuthId') ?? 'none — it PROVED'}`,
  );
  // Controls of S16.8: the same call, approved, proves (the refusal was the missing approval);
  // the approval is single-use; the handle dies with keysClose.
  const wp = report?.withdrawWithAuthId ?? {};
  const wv = wp.ok
    ? verifyGroth16(pinned.withdrawChange, wp.proofBytes, wp.publicInputs ?? [])
    : { ok: false, reason: `error=${wp.error}` };
  const wpubs = wp.publicInputs ?? [];
  add(
    'C8.a',
    'control: the same withdraw_change call, approved, proves — public inputs = the offline scenario, verifies (pinned withdraw_change_vk.json)',
    wv.ok &&
      wpubs.length === withdrawScenario.publicInputs.length &&
      wpubs.every((p, i) => p === withdrawScenario.publicInputs[i]),
    wv.ok ? `${wp.ms} ms` : wv.reason,
  );
  add(
    'C8.b',
    'control: the used authId is refused the second time',
    code('withdrawReusedAuthId') === 'E_A0_AUTH_ABSENT',
    `code=${code('withdrawReusedAuthId')}`,
  );
  add(
    'C8.c',
    'control: keysClose ends the handle',
    code('depositRhoAfterClose') === 'E_A0_UNKNOWN_HANDLE',
    `code=${code('depositRhoAfterClose')}`,
  );
  for (const l of launches) {
    add(l.id, l.text, l.pass, l.detail);
  }
  if (!rehearsal && !launches.some(l => l.id === 'S16.9')) {
    add(
      'S16.9',
      'the production APK of the same commit launches on the phone',
      false,
      'not run (use the `phone` command)',
    );
  }
  return lines;
}

/** The lines a rehearsal is expected to fail: only those that need the phone. */
export const PHONE_ONLY = new Set(['S16.0', 'S16.1', 'S16.9', 'S16.10']);
```

Create `scripts/m1a-checkpoint/m1a-checkpoint.mjs` (mode 100755):

```js
#!/usr/bin/env node
/**
 * The M1a checkpoint, desk side (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1a").
 * The owner runs it with the phone plugged in; README.md next to this file is the checklist.
 *
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs desk
 *       the desk values of the checkpoint's deposit, computed from the test mnemonic, and their
 *       match with the committed offline fixture
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs vk [--rpc URL] [--out DIR]
 *       ONE devnet request (a JSON-RPC batch: getGenesisHash + getAccountInfo of the Pool): the
 *       deposit VK the chain holds, compared with the pinned deposit_vk.json → DIR/chain-pool.json
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs phone --apks DIR [--out DIR] [--serial S]
 *       installs the devnet release APK + the checkpoint test APK, runs the instrumentation,
 *       collects its report; installs the production APK; launches both apps
 *       → DIR/phone-report.json, DIR/launches.json, DIR/instrument.txt
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs verify [--out DIR] [--report F] [--chain F] [--rehearsal]
 *       verifies the proofs, compares the public inputs, prints PASS / FAIL per §16 line;
 *       exit 0 only if every line passed (with --rehearsal: every line a desk can check)
 *   node scripts/m1a-checkpoint/m1a-checkpoint.mjs all --apks DIR [--out DIR] [--rpc URL]
 *       vk, phone, verify
 *
 * Never contacts *.noc-tura.io, never mainnet: the RPC must answer devnet's genesis hash.
 * The default RPC is the public https://api.devnet.solana.com.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import * as L from './lib.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const flag = name => argv.includes(`--${name}`);
const OUT = resolve(opt('out', join(L.ROOT, 'build/m1a-checkpoint')));
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const die = msg => {
  console.error(`m1a-checkpoint: ${msg}`);
  process.exit(2);
};

// ------------------------------------------------------------------------------------- desk

function desk() {
  const d = L.deskValues();
  const keys = L.fixture('a0-key-vectors.json');
  const proves = L.fixture('a0-prove-vectors.json');
  const sc = proves.scenarios.find(s => s.circuit === 'deposit');
  const problems = [];
  if (keys.seeds[0].seed !== d.seedHex) {
    problems.push(
      "the fixture's seeds[0] is not BIP-39 of the test mnemonic — the phone would open another seed",
    );
  }
  if (
    sc.witness.amount !== d.amount ||
    sc.witness.depositIndex !== d.depositIndex
  ) {
    problems.push(
      "the fixture's deposit scenario is not the checkpoint's deposit",
    );
  }
  if (JSON.stringify(sc.publicInputs) !== JSON.stringify(d.publicInputs)) {
    problems.push("the fixture's deposit public inputs differ from the desk's");
  }
  return { d, problems };
}

// --------------------------------------------------------------------------------------- vk

function assertDevnetUrl(url) {
  const why = L.rpcRefusal(url);
  if (why) {
    die(why);
  }
  return new URL(url);
}

async function readChainVk(rpc) {
  const u = assertDevnetUrl(rpc);
  const body = [
    { jsonrpc: '2.0', id: 1, method: 'getGenesisHash' },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'getAccountInfo',
      params: [L.DEVNET.pool, { encoding: 'base64', commitment: 'finalized' }],
    },
  ];
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    die(`RPC ${u.hostname} answered HTTP ${res.status}`);
  }
  const out = await res.json();
  const byId = Object.fromEntries(out.map(r => [r.id, r]));
  if (byId[1]?.result !== L.DEVNET.genesisHash) {
    die(
      `RPC ${u.hostname} is not devnet (genesis ${byId[1]?.result ?? JSON.stringify(byId[1]?.error)})`,
    );
  }
  const acc = byId[2]?.result;
  if (!acc?.value) {
    die(
      `the Pool account ${L.DEVNET.pool} was not returned: ${JSON.stringify(byId[2]?.error ?? acc)}`,
    );
  }
  return {
    rpcHost: u.hostname,
    slot: acc.context.slot,
    fetchedAt: new Date().toISOString(),
    pool: L.DEVNET.pool,
    owner: acc.value.owner,
    lamports: acc.value.lamports,
    dataBase64: acc.value.data[0],
  };
}

function chainVkFrom(chain) {
  const pool = L.decodePoolAccount({
    owner: chain.owner,
    data: Buffer.from(chain.dataBase64, 'base64'),
  });
  if (pool.errs.length) {
    return { errs: pool.errs };
  }
  return { errs: [], vk: L.vkFromBlob(pool.blob), pool };
}

const pinnedVks = () => ({
  deposit: L.vkFromSnarkjs(L.fixture('a0-vk/deposit_vk.json')),
  withdrawChange: L.vkFromSnarkjs(L.fixture('a0-vk/withdraw_change_vk.json')),
});

// ------------------------------------------------------------------------------------ phone

function adbPath() {
  const sdk = process.env.ANDROID_HOME ?? join(homedir(), 'Android/Sdk');
  const p = join(sdk, 'platform-tools/adb');
  return existsSync(p) ? p : 'adb';
}
function aapt2Path() {
  const sdk = process.env.ANDROID_HOME ?? join(homedir(), 'Android/Sdk');
  const bt = join(sdk, 'build-tools');
  const v = existsSync(bt)
    ? readdirSync(bt)
        .sort()
        .reverse()
        .find(d => existsSync(join(bt, d, 'aapt2')))
    : null;
  return v ? join(bt, v, 'aapt2') : null;
}
function badging(apk) {
  const a = aapt2Path();
  if (!a) {
    die(
      "aapt2 not found (ANDROID_HOME/build-tools/*/aapt2) — needed to read the APKs' package names",
    );
  }
  const out = execFileSync(a, ['dump', 'badging', apk], { encoding: 'utf8' });
  const pkg = out.match(/^package: name='([^']+)'/m)?.[1];
  return { pkg, out };
}

function phone() {
  const apks = opt('apks');
  if (!apks) {
    die(
      'phone needs --apks DIR (devnet.apk, devnet-androidTest.apk, production.apk — build-apks.sh writes them)',
    );
  }
  const devnetApk = join(apks, 'devnet.apk');
  const testApk = join(apks, 'devnet-androidTest.apk');
  const prodApk = join(apks, 'production.apk');
  for (const f of [devnetApk, testApk, prodApk]) {
    if (!existsSync(f)) {
      die(`missing ${f}`);
    }
  }
  const devnetPkg = badging(devnetApk).pkg;
  const prodPkg = badging(prodApk).pkg;
  const testB = badging(testApk);
  const testPkg = testB.pkg;
  if (
    !devnetPkg?.endsWith('.devnet') ||
    prodPkg !== 'com.nocturawallet' ||
    testPkg !== `${devnetPkg}.test`
  ) {
    die(
      `unexpected packages: devnet=${devnetPkg} production=${prodPkg} test=${testPkg}`,
    );
  }
  const serial = opt('serial');
  const adbArgs = serial ? ['-s', serial] : [];
  const adb = (args, { allowFail = false, timeout = 120000 } = {}) => {
    const r = spawnSync(adbPath(), [...adbArgs, ...args], {
      encoding: 'utf8',
      timeout,
      maxBuffer: 64 << 20,
    });
    if (r.status !== 0 && !allowFail) {
      die(`adb ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
    }
    return (r.stdout ?? '') + (r.stderr ?? '');
  };
  const devices = adb(['devices'])
    .split('\n')
    .filter(l => /\tdevice$/.test(l));
  if (!serial && devices.length !== 1) {
    die(
      `expected exactly one device, adb sees ${devices.length} (use --serial)`,
    );
  }
  mkdirSync(OUT, { recursive: true });
  const abi = adb(['shell', 'getprop', 'ro.product.cpu.abi']).trim();
  console.log(
    `device ${devices[0]?.split('\t')[0] ?? serial}: ${adb(['shell', 'getprop', 'ro.product.model']).trim()}, abi ${abi}`,
  );

  console.log(
    `installing ${devnetPkg} (devnet release) and ${testPkg} (the checkpoint) …`,
  );
  adb(['install', '-r', devnetApk], { timeout: 300000 });
  adb(['install', '-r', '-t', testApk], { timeout: 300000 });
  adb(['logcat', '-c'], { allowFail: true });
  console.log(
    'running the checkpoint on the phone (two proofs — may take a few minutes) …',
  );
  const inst = adb(
    [
      'shell',
      'am',
      'instrument',
      '-w',
      '-r',
      '-e',
      'class',
      'com.nocturawallet.prover.M1aCheckpointTest',
      `${testPkg}/androidx.test.runner.AndroidJUnitRunner`,
    ],
    { allowFail: true, timeout: 1500000 },
  );
  writeFileSync(join(OUT, 'instrument.txt'), inst);
  let report = L.reportFromInstrumentOutput(inst);
  if (!report) {
    report = L.reportFromLogcat(
      adb(['logcat', '-d', '-s', 'M1aCheckpoint:I'], { allowFail: true }),
    );
  }
  if (!report) {
    die(`no report from the phone — see ${join(OUT, 'instrument.txt')}`);
  }
  writeFileSync(
    join(OUT, 'phone-report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );

  const launches = [];
  const testPassed =
    /^OK \(1 test\)/m.test(inst) && /INSTRUMENTATION_CODE: -1/.test(inst);
  launches.push({
    id: 'S16.D',
    text: 'the device-side assertions of the checkpoint test passed',
    pass: testPassed,
    detail: testPassed
      ? 'OK (1 test)'
      : (inst.match(/^(FAILURES!!!.*|.*Error.*)$/m)?.[1] ??
        'see instrument.txt'),
  });
  const launch = (pkg, id, text) => {
    adb(['shell', 'am', 'force-stop', pkg], { allowFail: true });
    adb(['logcat', '-b', 'crash', '-c'], { allowFail: true });
    const start = adb(
      [
        'shell',
        'am',
        'start',
        '-W',
        '-n',
        `${pkg}/com.nocturawallet.MainActivity`,
      ],
      { allowFail: true },
    );
    spawnSync('sleep', ['10']);
    const pid = adb(['shell', 'pidof', pkg], { allowFail: true }).trim();
    const crash = adb(['logcat', '-b', 'crash', '-d'], { allowFail: true });
    const crashed =
      crash.includes(pkg) || /UnsatisfiedLinkError|FATAL EXCEPTION/.test(crash);
    const pass = /Status: ok/.test(start) && /^\d+$/.test(pid) && !crashed;
    launches.push({
      id,
      text,
      pass,
      detail: `am start: ${start.match(/Status: \w+/)?.[0] ?? 'no status'}; pid after 10 s: ${pid || 'none'}; crash buffer: ${crashed ? 'CRASH' : 'clean'}`,
    });
    if (crashed) {
      writeFileSync(join(OUT, `crash-${pkg}.txt`), crash);
    }
  };
  launch(devnetPkg, 'S16.10', 'the devnet release APK launches on the phone');
  console.log(
    `installing ${prodPkg} (production) over the installed one — its data is kept …`,
  );
  const pi = adb(['install', '-r', prodApk], {
    allowFail: true,
    timeout: 300000,
  });
  if (!/Success/.test(pi)) {
    launches.push({
      id: 'S16.9',
      text: 'the production APK of the same commit launches on the phone',
      pass: false,
      detail: `install failed: ${pi.trim()}`,
    });
  } else {
    launch(
      prodPkg,
      'S16.9',
      'the production APK of the same commit launches on the phone',
    );
  }
  writeFileSync(
    join(OUT, 'launches.json'),
    JSON.stringify(launches, null, 2) + '\n',
  );
  console.log(
    `phone: wrote ${join(OUT, 'phone-report.json')} and ${join(OUT, 'launches.json')}`,
  );
}

// ----------------------------------------------------------------------------------- verify

function verify({ reportPath, chainPath, launchesPath, rehearsal }) {
  const { d, problems } = desk();
  if (problems.length) {
    die(`the desk values are not the fixture's: ${problems.join('; ')}`);
  }
  if (!existsSync(reportPath)) {
    die(`no report at ${reportPath}`);
  }
  const report = L.readJson(reportPath);
  let chainVk = null;
  let chainVkSource = '';
  if (existsSync(chainPath)) {
    const chain = L.readJson(chainPath);
    const c = chainVkFrom(chain);
    if (c.errs.length) {
      die(`the chain read is not the pinned devnet pool: ${c.errs.join('; ')}`);
    }
    chainVk = c.vk;
    chainVkSource = `Pool ${chain.pool} at slot ${chain.slot} via ${chain.rpcHost} (${chain.fetchedAt})`;
  }
  const launches =
    launchesPath && existsSync(launchesPath) ? L.readJson(launchesPath) : [];
  const proves = L.fixture('a0-prove-vectors.json');
  const lines = L.judge({
    report,
    desk: d,
    chainVk,
    chainVkSource,
    pinned: pinnedVks(),
    withdrawScenario: proves.scenarios.find(
      s => s.label === report.withdrawScenario,
    ),
    rehearsal,
    launches,
  });
  console.log(`M1a checkpoint — ${reportPath}`);
  let failed = 0;
  for (const l of lines) {
    const expectedRehearsalFail =
      rehearsal && L.PHONE_ONLY.has(l.id) && !l.pass;
    const tag = l.pass
      ? 'PASS'
      : expectedRehearsalFail
        ? 'N/A (phone only)'
        : 'FAIL';
    if (!l.pass && !expectedRehearsalFail) {
      failed++;
    }
    console.log(
      `${tag.padEnd(16)} ${l.id.padEnd(7)} ${l.text}${l.detail ? `\n${' '.repeat(25)}${l.detail}` : ''}`,
    );
  }
  const verdict =
    failed === 0
      ? rehearsal
        ? 'REHEARSAL PASSED (not a checkpoint: no phone)'
        : 'CHECKPOINT PASSED'
      : `FAILED (${failed} line${failed > 1 ? 's' : ''})`;
  console.log(verdict);
  return failed === 0 ? 0 : 1;
}

// ------------------------------------------------------------------------------------- main

const reportPath = resolve(opt('report', join(OUT, 'phone-report.json')));
const chainPath = resolve(opt('chain', join(OUT, 'chain-pool.json')));
const launchesPath = resolve(opt('launches', join(OUT, 'launches.json')));

if (cmd === 'desk') {
  const { d, problems } = desk();
  const { seedHex, ...shown } = d;
  console.log(
    JSON.stringify(
      {
        seed: `${seedHex.slice(0, 8)}… (BIP-39 of the repo test mnemonic)`,
        ...shown,
      },
      null,
      2,
    ),
  );
  console.log(
    problems.length
      ? `FIXTURE MISMATCH: ${problems.join('; ')}`
      : 'the committed fixture agrees with the desk values',
  );
  process.exit(problems.length ? 1 : 0);
} else if (cmd === 'vk' || cmd === 'all') {
  const chain = await readChainVk(opt('rpc', DEFAULT_RPC));
  mkdirSync(OUT, { recursive: true });
  writeFileSync(chainPath, JSON.stringify(chain, null, 2) + '\n');
  const c = chainVkFrom(chain);
  if (c.errs.length) {
    die(`not the pinned pool: ${c.errs.join('; ')}`);
  }
  const diff = L.vkDiff(c.vk, pinnedVks().deposit);
  console.log(
    `read ${chain.pool} at slot ${chain.slot} via ${chain.rpcHost}: owner ${chain.owner}, ${Buffer.from(chain.dataBase64, 'base64').length} bytes, max_fee ${c.pool.maxFee}, deposits_paused ${c.pool.depositsPaused}`,
  );
  console.log(
    diff.length
      ? `deposit VK on chain DIFFERS from deposit_vk.json at ${diff.join(', ')}`
      : 'deposit VK on chain = deposit_vk.json (alpha, beta, gamma, delta, 5 IC points)',
  );
  console.log(`wrote ${chainPath}`);
  if (cmd === 'vk') {
    process.exit(diff.length ? 1 : 0);
  }
  phone();
  process.exit(
    verify({ reportPath, chainPath, launchesPath, rehearsal: false }),
  );
} else if (cmd === 'phone') {
  phone();
} else if (cmd === 'verify') {
  process.exit(
    verify({
      reportPath,
      chainPath,
      launchesPath: flag('rehearsal') ? null : launchesPath,
      rehearsal: flag('rehearsal'),
    }),
  );
} else {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(1, 26)
      .join('\n'),
  );
  process.exit(2);
}
```

The desk values, offline:

```bash
node --no-warnings scripts/m1a-checkpoint/m1a-checkpoint.mjs desk; echo exit=$?
```

Expected — exactly:

```
{
  "seed": "5eb00bbd… (BIP-39 of the repo test mnemonic)",
  "depositIndex": "0",
  "amount": "1000000000",
  "rho": "12d576a44d29fa15379dfda30a5cce14c828f6a2d2789d9a0730c47f62d7518e",
  "commitment": "02541c5bb65d705e584a835144831936031f3b47977cba9b89f3883057c5245f",
  "mintHash": "05ee2f1a32b56046bcfab53bb4ac502bdc7689c4e2a8446db77130db7fccdca4",
  "publicInputs": [
    "02541c5bb65d705e584a835144831936031f3b47977cba9b89f3883057c5245f",
    "000000000000000000000000000000000000000000000000000000003b9aca00",
    "05ee2f1a32b56046bcfab53bb4ac502bdc7689c4e2a8446db77130db7fccdca4",
    "12d576a44d29fa15379dfda30a5cce14c828f6a2d2789d9a0730c47f62d7518e"
  ]
}
the committed fixture agrees with the desk values
exit=0
```

**The one devnet read** (the dry run's only network request; a JSON-RPC batch of `getGenesisHash` + `getAccountInfo(8VMe4…, base64, finalized)` in one POST to `https://api.devnet.solana.com`), recorded as the test fixture:

```bash
node --no-warnings scripts/m1a-checkpoint/m1a-checkpoint.mjs vk --out /tmp/m1a-vk; echo exit=$?
cp /tmp/m1a-vk/chain-pool.json scripts/m1a-checkpoint/fixtures/devnet-pool-<slot>.json
```

Measured (2026-11-09T01:15:52Z):

```
read 8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT at slot 520213277 via api.devnet.solana.com: owner FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH, 928 bytes, max_fee 100000, deposits_paused 0
deposit VK on chain = deposit_vk.json (alpha, beta, gamma, delta, 5 IC points)
wrote /tmp/m1a-vk/chain-pool.json
exit=0
```

The recording, committed as `scripts/m1a-checkpoint/fixtures/devnet-pool-520213277.json` (sha256 `ee4e3822ccb6edd61aa7d1df114815aa897621292706574b67cfb7f1d78a1ccf`) — an executor's own read has another slot and time; the account bytes are the same as long as nobody calls `set_deposit_vk` / `set_max_fee` (lib.test.mjs reads this file by name; rename the reference if a new recording replaces it):

```json
{
  "rpcHost": "api.devnet.solana.com",
  "slot": 520213277,
  "fetchedAt": "2026-11-09T01:15:52.349Z",
  "pool": "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT",
  "owner": "FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH",
  "lamports": 5364480,
  "dataBase64": "8ZptBBGxbbzqs4TB3ireK5VwOehcAfz0fzl/JPRsYMw5kyViDuVHxMd/aOW3e+DtnjvMFbqxsaB9RirmyY4Gssb5Bys/zNyoIAy7IO0C3c+yfJlvdmte7yXpuvhdI9Df0gJt0w6awmFCdUgdr2o4BHuBMSXG3ShCq9mouxXd5v1dTDxbh8PmKf0AAAAAAAAALU2ap+MC2d9BdJ1VB5SdBdvqM/uxbGQ7IvWZor5t8uIUvt1QPDfOsGHY7GAgn+NFzomDChkjAwHwdsr/AE0ZJglnAy/L93bRr8mF+Ih38YLThICmU/Leyql5TLw78wYMDhh4R61MeYN00NZzK/UBhH3Wi8DgcSQeAhO8f8E9t6swTPvR4IpwSpn16EfZP4w8qv3exGt6DTedpppNESNGpxc5wbGkV6jHMTEj0k0vkZL4lrfGPuoFqdV/BlR60M7IGY6Tk5INSDpyYL+3MftdJfGqSTM1qecSl+SFt67zEsIYAN7vEh8edkJqAGZeXER5Z0Mi1Pde2t1G3r1c2ZL27QkGidBYX/B17J6ZrWkMM5W8SzEzcLOO81Ws2tzRIpdbEshepduMbetKq3GAjctAj+PR52kMQ9N7TObMAWb6faoAi2MH7hOMamtpr4rhypybkldipyYN0/juHtWD9nWn8ynjxsI0pjulYPE/Cbg3IWE1EgrEOWhHLfjYJV9FQY+HCRVmk4NKjMl5V5OeEVt/uo+MtPy8fNrD3y2r3LK8MogvaAoCpa0kzhxR2yloUYygSV6330wYiD6GfCmnxGnXngFXkSjnjlhC0cVW0zaI3DtWYXHgDe8OkuVIlOVoFxgjL31jypciyImFU2y0bpfZ81ryFNMQbWb07wAh3gK8sigadeBz0r+WMMu/nR87PibPBn2XwwdNCTOXuSwVR4CwRAqoBkY98gaPVQvKvv5CiiLZhBEeoQa3OLFfMjLrCGqEMGIKw6ltJGvG1tdH+kcQgmNu1AWPun7NYH4goE0HenkvxzVrfXb+y5FebLdzohYLPXc/P7pVJDfynUwNJ6zLHy36ufPnFIObFAdR21ogel3nsTUF1y/wbYM8nTI8DCh4Avw1FBm7xcoN12l/9q7rBKzwZQoL7DjveczH3NRPrt4ZhCe6CprDukVq54TS2iX5BbNoQagSUi0GUKo9EnQ93xSqwaSh5wbXmN5QO+SjX1dZqfaHfzTFEmnC4hGVyzceoIYBAAAAAAAAAAAAAAAAAA=="
}
```

**The decode, as a fact from the program side** (`programs/shielded-pool/src/state.rs`, `Pool` `#[account(zero_copy)] #[repr(C)]`): 8-byte discriminator `sha256("account:Pool")[0..8]` | authority 32 | mint 32 (@40) | vault 32 | merkle_tree 32 (@104) | bump 1 | pad 7 | `deposit_vk` 768 (@144: alpha G1 64, beta / gamma / delta G2 128 each, `ic[5]` G1) | `max_fee` u64 LE (@912) | `deposits_paused` u8 (@920) | pad 7 = 928. G2 in EIP-197 order (x.c1, x.c0, y.c1, y.c0; their acceptance script's `g2()` writes it so from snarkjs's `[c0, c1]`). The script refuses an account whose owner is not `FeGSS…`, whose size is not 928, whose discriminator, mint or tree is not the pinned one — then the VK is compared coordinate by coordinate with the pinned `deposit_vk.json`. The deposit VK lives INSIDE the Pool account (not a PDA of its own, unlike `wchange_vk` / `transfer_vk`).

- [ ] **Step 6: The desk tests — green.**

```bash
node --no-warnings --test scripts/m1a-checkpoint/lib.test.mjs 2>&1 | grep -E "^(✔|✖)|^ℹ (tests|pass|fail)"
```

Expected:

```
✔ the desk values equal the offline fixtures (deposit scenario, key vectors note 0)
✔ the recorded Pool account decodes to the pinned deposit VK
✔ decodePoolAccount refuses another owner, size, discriminator, mint or tree
✔ verifyGroth16: the two LANDED withdraw_with_change proofs verify against the pinned VK
✔ verifyGroth16 refuses: a changed public input, A not negated, G2 c0-first, another VK, bad encodings
✔ the rehearsal's deposit proof verifies against the deposit VK recorded from chain, and not with a changed input
✔ judge: the rehearsal passes every desk line and fails exactly the phone-only ones
✔ judge: a phone report with launches passes every line (positive control of the whole judge)
✔ judge: each defect fails its own line
✔ the report is read from am instrument -r output, or reassembled from logcat chunks
✔ the RPC guard: devnet over https only, never noc-tura.io, solscan.io or mainnet
ℹ tests 11
ℹ pass 11
ℹ fail 0
```

(The verifier's positive control is the chain's own acceptance: the two LANDED withdraw_with_change proofs of `a0-prove-vectors.json` verify with `@noble/curves` — 0.18 s for both — so the pairing product, the A negation and the G2 order are those the program accepted. Then the rehearsal's deposit proof verifies against the VK decoded from the RECORDED chain bytes, and every one of five encodings off by one thing fails.)

The rehearsal through the CLI, against the recorded read:

```bash
node --no-warnings scripts/m1a-checkpoint/m1a-checkpoint.mjs verify --rehearsal \
  --report scripts/m1a-checkpoint/fixtures/host-rehearsal-report.json \
  --chain scripts/m1a-checkpoint/fixtures/devnet-pool-520213277.json --out /tmp/m1a-out; echo exit=$?
```

Expected (the detail lines elided):

```
N/A (phone only) S16.0   the report comes from the phone (ART, aarch64), not a rehearsal
N/A (phone only) S16.1   isSupported() is true on the phone
PASS             S16.2   keysOpen with the repo's test seed returns a handle (and Kotlin's seed copy is zero-filled)
PASS             S16.3   depositRho(0) equals the desk value
PASS             S16.4   commitment(10^9, rho(0)) equals the desk value
PASS             S16.5   the deposit proof's public inputs equal the desk values (commitment, amount, mintHash, rho)
PASS             S16.6   the deposit VK read from chain equals the pinned deposit_vk.json
PASS             S16.7   the deposit proof verifies against the deposit VK read from chain
PASS             S16.8   a withdraw_change prove without an authId refuses (E_A0_AUTH_ABSENT)
PASS             C8.a    control: the same withdraw_change call, approved, proves — public inputs = the offline scenario, verifies (pinned withdraw_change_vk.json)
PASS             C8.b    control: the used authId is refused the second time
PASS             C8.c    control: keysClose ends the handle
REHEARSAL PASSED (not a checkpoint: no phone)
exit=0
```

Negative controls of the CLI, measured: the same report WITHOUT `--rehearsal` → `FAILED (3 lines)` (S16.0, S16.1, S16.9 "not run"), exit 1; without a chain read → S16.6 `the VK was not read from chain`, S16.7 `no chain VK`, `FAILED (2 lines)`, exit 1; `vk --rpc https://api.mainnet-beta.solana.com` → `refusing api.mainnet-beta.solana.com: the checkpoint reads devnet only, never noc-tura.io, solscan.io or mainnet`, exit 2, no request made; `phone` with no device → `expected exactly one device, adb sees 0 (use --serial)`, exit 2 (after reading the three APKs' packages with aapt2); `phone` without `--apks` → exit 2.

- [ ] **Step 7: The phone test, the APK build, and the proof that the harness is in neither release APK.**

Create `android/app/src/androidTest/java/com/nocturawallet/prover/M1aCheckpointTest.kt`:

```kotlin
@file:Suppress("DEPRECATION") // BridgeReactContext: the one concrete ReactApplicationContext in RN 0.84

package com.nocturawallet.prover

import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.BridgeReactContext
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The M1a checkpoint ON THE PHONE (spec §16): instrumentation of the installed devnet RELEASE
 * app (`testBuildType "release"`), so the library that proves is the one that ships — while this
 * class lives in the separate test APK and never in the app (scripts/m1a-checkpoint/
 * check-release-apk.sh).
 *
 * Run by the desk script (`node scripts/m1a-checkpoint/m1a-checkpoint.mjs phone`), which reads
 * the report from `am instrument -r` (status key `m1a-report`; also in logcat under
 * `M1aCheckpoint`) and decides PASS / FAIL. This test fails on what the device itself can see
 * (isSupported, the refusals, a step that errored) AFTER the report is out.
 *
 * The pinned key files come inside this test APK, as assets staged at build time from
 * NOCTURA_A0_KEYS_DIR (the program side's zk/keys/v2/) — no network on the phone, no adb push;
 * Rust re-checks every sha256 before it parses a byte.
 */
class M1aCheckpointTest {
    @Test
    fun m1aCheckpoint() {
        val inst = InstrumentationRegistry.getInstrumentation()
        val testAssets = inst.context.assets
        val target = inst.targetContext

        val dir = File(target.cacheDir, "m1a-checkpoint").apply { deleteRecursively(); mkdirs() }
        for (name in M1aCheckpoint.KEY_FILES) {
            testAssets.open("a0/$name").use { input -> File(dir, name).outputStream().use { input.copyTo(it) } }
        }
        val keyVectors = testAssets.open("a0-key-vectors.json").bufferedReader().use { it.readText() }
        val proveVectors = testAssets.open("a0-prove-vectors.json").bufferedReader().use { it.readText() }

        val platform = JSONObject()
            .put("where", "phone")
            .put("javaVmName", System.getProperty("java.vm.name"))
            .put("osArch", System.getProperty("os.arch"))
            .put("supportedAbis", JSONArray(Build.SUPPORTED_ABIS.toList()))
            .put("sdkInt", Build.VERSION.SDK_INT)
            .put("model", Build.MODEL)
            .put("targetPackage", target.packageName)

        // The React method itself — the call JS makes (isSupported() never touches the context).
        val supported = try {
            NocturaProverModule(BridgeReactContext(target)).isSupported()
        } catch (e: Throwable) {
            platform.put("isSupportedThrew", e.javaClass.name)
            null
        }

        val report = M1aCheckpoint.run(keyVectors, proveVectors, { File(dir, it).path }, platform, supported)
        dir.deleteRecursively()

        inst.sendStatus(STATUS_REPORT, Bundle().apply { putString(M1aCheckpoint.REPORT_KEY, report.toString()) })
        for (line in M1aCheckpoint.chunks(report)) Log.i(M1aCheckpoint.LOG_TAG, line)

        val failures = M1aCheckpoint.deviceFailures(report, expectSupported = true)
        assertTrue("M1a checkpoint, device-side failures: $failures", failures.isEmpty())
    }

    private companion object {
        /** Not one of AndroidJUnitRunner's own status codes (1, 0, -1 … -4). */
        const val STATUS_REPORT = 7
    }
}
```

(`ReactApplicationContext` is abstract in RN 0.84 — measured: `Cannot create an instance of an abstract class` — and `BridgeReactContext(Context)`, its one concrete subclass, is `@Deprecated`; hence the file-level suppression. `isSupported()` never touches the context.)

Create `scripts/m1a-checkpoint/check-release-apk.sh` (mode 100755):

```bash
#!/usr/bin/env bash
# The M1a checkpoint harness is NOT in a release APK (spec §16: "a harness that is not in the
# devnet APK's release variant"). Read off the built APK, never off the build script:
#   - no APK entry the test APK carries: assets/a0/… (the pinned key files), the offline
#     fixtures (assets/a0-*-vectors.json, assets/a0-vk/), and no entry whose size is one of the
#     four pinned key-file lengths;
#   - no checkpoint name in any classes*.dex: M1aCheckpoint, androidx/test/, AndroidJUnitRunner,
#     the report's schema / key / log marker;
#   - none of those in the JS bundle (assets/index.android.bundle);
#   - no <instrumentation> in the manifest.
#
#   check-release-apk.sh <app-release.apk>                    exit 0 = none found
#   check-release-apk.sh --expect-present <androidTest.apk>   the negative control: the same reading
#                                     must FIND each kind (entries, key-file sizes, dex names,
#                                     the instrumentation) in the test APK — a reading that went
#                                     blind to one kind fails here instead of passing a release
# Exit 1 = the check failed (printed); 2 = usage / unreadable APK.
set -euo pipefail

expect_present=0
if [ "${1:-}" = "--expect-present" ]; then
  expect_present=1
  shift
fi
apk="${1:-}"
[ -n "$apk" ] && [ $# -eq 1 ] || { echo "usage: $0 [--expect-present] <apk>" >&2; exit 2; }
entries=$(unzip -Z1 "$apk" 2>/dev/null) || { echo "not a readable APK: $apk" >&2; exit 2; }
[ -n "$entries" ] || { echo "no entries read from $apk" >&2; exit 2; }

found=()
kinds=""
asset_hits=$(grep -E '^assets/(a0/|a0-(key|prove|ata)-vectors\.json$|a0-vk/)' <<<"$entries" || true)
[ -z "$asset_hits" ] || { found+=("entries: $(tr '\n' ' ' <<<"$asset_hits")"); kinds+=" entries"; }

# 662589 deposit_final.zkey, 2528384 deposit.wasm, 4469189 withdraw_change_final.zkey,
# 2988385 withdraw_change.wasm (native/noctura-prover/src/a0/keyfiles.rs)
size_hits=$(unzip -Zl "$apk" | awk '$4 ~ /^(662589|2528384|4469189|2988385)$/ {print $NF}' || true)
[ -z "$size_hits" ] || { found+=("entries of a pinned key-file size: $(tr '\n' ' ' <<<"$size_hits")"); kinds+=" sizes"; }

markers='M1aCheckpoint|androidx/test/|AndroidJUnitRunner|noctura\.m1a\.checkpoint-report|M1A-REPORT|m1a-report'
dexes=$(grep -E '^classes[0-9]*\.dex$' <<<"$entries" || true)
[ -n "$dexes" ] || { echo "no classes*.dex in $apk" >&2; exit 2; }
for dex in $dexes; do
  n=$(unzip -p "$apk" "$dex" | grep -a -o -E "$markers" | sort | uniq -c | tr '\n' ' ' || true)
  [ -z "${n// /}" ] || { found+=("$dex: $n"); kinds+=" dex"; }
done
if grep -qx 'assets/index.android.bundle' <<<"$entries"; then
  n=$(unzip -p "$apk" assets/index.android.bundle | grep -a -o -E "$markers" | sort | uniq -c | tr '\n' ' ' || true)
  [ -z "${n// /}" ] || found+=("assets/index.android.bundle: $n")
fi

sdk="${ANDROID_HOME:-$HOME/Android/Sdk}"
aapt2=$(ls -d "$sdk"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -1 || true)
[ -n "$aapt2" ] || { echo "aapt2 not found under $sdk/build-tools (ANDROID_HOME) — the manifest cannot be read" >&2; exit 2; }
manifest=$("$aapt2" dump xmltree --file AndroidManifest.xml "$apk") || { echo "aapt2 cannot read the manifest of $apk" >&2; exit 2; }
if grep -q 'E: instrumentation' <<<"$manifest"; then
  found+=("AndroidManifest.xml: <instrumentation>")
  kinds+=" manifest"
fi

if [ "$expect_present" = 1 ]; then
  for k in entries sizes dex manifest; do
    case " $kinds " in
      *" $k "*) ;;
      *) echo "NEGATIVE CONTROL FAILED: the reading found no $k in $apk (found:${kinds:- nothing})" >&2; exit 1 ;;
    esac
  done
  echo "control OK: the reading finds the harness in $(basename "$apk"):"
  printf '  %s\n' "${found[@]}"
  exit 0
fi
if [ ${#found[@]} -gt 0 ]; then
  echo "THE CHECKPOINT HARNESS IS IN $apk:" >&2
  printf '  %s\n' "${found[@]}" >&2
  exit 1
fi
echo "release APK clean: no checkpoint class, asset, key file, marker or instrumentation in $(basename "$apk") ($(grep -c . <<<"$entries") entries, $(wc -w <<<"$dexes") dex)"
```

Create `scripts/m1a-checkpoint/build-apks.sh` (mode 100755):

```bash
#!/usr/bin/env bash
# Builds the three APKs of the M1a checkpoint from ONE commit (spec §16: "each checkpoint also
# builds the production APK of the same commit"), into OUT (default build/m1a-checkpoint/apks):
#   devnet.apk               the devnet release app (ENVFILE=.env.devnet, com.nocturawallet.devnet)
#   devnet-androidTest.apk   the checkpoint: instrumentation of devnet.apk, with the pinned key files
#   production.apk           the production release app (ENVFILE=.env.production, com.nocturawallet)
# then proves the harness is in neither release APK (check-release-apk.sh, with its negative
# control on the test APK) and writes COMMIT and SHA256SUMS next to them.
#
#   ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 \
#   NOCTURA_A0_KEYS_DIR=<program side>/zk/keys/v2 \
#     scripts/m1a-checkpoint/build-apks.sh [OUT]
#
# Needs: android/keystore.properties (release signing), the gitignored .env.devnet and
# .env.production at the repository root, a real node_modules (never a symlink to another
# checkout: Gradle writes into node_modules/*/android/build).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
out="${1:-$root/build/m1a-checkpoint/apks}"
: "${NOCTURA_A0_KEYS_DIR:?set NOCTURA_A0_KEYS_DIR to the directory of the four pinned A0 key files (zk/keys/v2/ of the program-side repo)}"
: "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME (android/build.gradle ndkVersion 27.1.12297006)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
for f in .env.devnet .env.production android/keystore.properties; do
  [ -f "$root/$f" ] || { echo "missing $f" >&2; exit 2; }
done
[ ! -L "$root/node_modules" ] || { echo "node_modules is a symlink — use a real copy (Gradle writes into it)" >&2; exit 2; }

commit=$(git -C "$root" rev-parse HEAD)
dirty=$(git -C "$root" status --porcelain --untracked-files=no)
[ -z "$dirty" ] || echo "WARNING: the working tree has uncommitted changes — the APKs are not exactly $commit" >&2

"$root/native/noctura-prover/build-android.sh"

apk_dir="$root/android/app/build/outputs/apk"
mkdir -p "$out"
rm -f "$out"/*.apk
(cd "$root/android" && ENVFILE=.env.devnet ./gradlew assembleRelease assembleReleaseAndroidTest --console=plain)
cp "$apk_dir/release/app-release.apk" "$out/devnet.apk"
cp "$apk_dir/androidTest/release/app-release-androidTest.apk" "$out/devnet-androidTest.apk"
(cd "$root/android" && ENVFILE=.env.production ./gradlew assembleRelease --console=plain)
cp "$apk_dir/release/app-release.apk" "$out/production.apk"

"$here/check-release-apk.sh" "$out/devnet.apk"
"$here/check-release-apk.sh" "$out/production.apk"
# The two controls of that reading: it FINDS each kind in the test APK, and as a release check it
# REFUSES the test APK (a check that always says "clean" fails here).
"$here/check-release-apk.sh" --expect-present "$out/devnet-androidTest.apk"
if "$here/check-release-apk.sh" "$out/devnet-androidTest.apk" >/dev/null 2>&1; then
  echo "CONTROL FAILED: the release reading passes the test APK, which carries the harness" >&2
  exit 1
fi
echo "control OK: the release reading refuses devnet-androidTest.apk"

echo "$commit${dirty:+ (dirty)}" > "$out/COMMIT"
(cd "$out" && sha256sum devnet.apk devnet-androidTest.apk production.apk > SHA256SUMS)
echo "built from $commit into $out:"
cat "$out/SHA256SUMS"
```

Build (the clone has no `.jks`; the release key is read in place from the main checkout, never copied):

```bash
df -h / | tail -1      # ≥ 3 GB free for the incremental builds; a cold release build needs far more
NOCTURA_KEYSTORE_FILE=/home/user/Solana/Project/NocturaWallet/android/app/noctura-release.jks \
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 NOCTURA_A0_KEYS_DIR=<program side>/zk/keys/v2 \
  scripts/m1a-checkpoint/build-apks.sh /tmp/m1a-apks 2>&1 | grep -E "^BUILD|release APK clean|control OK|CONTROL|THE CHECKPOINT|WARNING|built from|^[0-9a-f]{64}"
```

Expected (measured on the committed tree, 1 min 33 s incremental):

```
BUILD SUCCESSFUL in 46s
BUILD SUCCESSFUL in 41s
release APK clean: no checkpoint class, asset, key file, marker or instrumentation in devnet.apk (1120 entries, 2 dex)
release APK clean: no checkpoint class, asset, key file, marker or instrumentation in production.apk (1120 entries, 2 dex)
control OK: the reading finds the harness in devnet-androidTest.apk:
control OK: the release reading refuses devnet-androidTest.apk
built from fc118a0507ee52c61ed61b99d15414369cad8408 into /tmp/m1a-apks:
871f2fa6e209198ccea8c816c4078dd67a7708d23473b43d3dfc1288d983e2b4  devnet.apk
532c5ccb754d0db7ea719998af95201b51fbba2d078b5d918d6da78434504157  devnet-androidTest.apk
cd547887791af82869028ee34d7fb370c5c48d29214fda62e1ef6bd6da7df496  production.apk
```

(`fc118a0` is this dry run's commit before a message-only amend to `ee939bf` — the same tree.) And the first control's findings, in full:

```
  entries: assets/a0-ata-vectors.json assets/a0-key-vectors.json assets/a0-prove-vectors.json assets/a0-vk/deposit_vk.json assets/a0-vk/withdraw_change_vk.json assets/a0/deposit.wasm assets/a0/deposit_final.zkey assets/a0/withdraw_change.wasm assets/a0/withdraw_change_final.zkey
  entries of a pinned key-file size: assets/a0/deposit.wasm assets/a0/deposit_final.zkey assets/a0/withdraw_change.wasm assets/a0/withdraw_change_final.zkey
  classes.dex:       8 AndroidJUnitRunner     431 androidx/test/      25 M1aCheckpoint       1 m1a-report       1 M1A-REPORT       1 noctura.m1a.checkpoint-report
  AndroidManifest.xml: <instrumentation>
```

**Stronger than "no harness name in it": the release APKs are content-identical to the base commit's** (Task 5's `devnet.apk` / `production.apk` at db1e508, kept in the scratch dir):

```bash
for a in devnet production; do
  for f in classes.dex classes2.dex lib/arm64-v8a/libnoctura_prover.so assets/index.android.bundle AndroidManifest.xml resources.arsc; do
    [ "$(unzip -p base/$a.apk $f | sha256sum)" = "$(unzip -p /tmp/m1a-apks/$a.apk $f | sha256sum)" ] || echo "$a $f differs"
  done
  diff <(unzip -Z1 base/$a.apk) <(unzip -Z1 /tmp/m1a-apks/$a.apk) && echo "$a: same entries, same order"
done
mkdir a b && (cd a && unzip -q ../base/devnet.apk) && (cd b && unzip -q /tmp/m1a-apks/devnet.apk) && diff -rq a b; echo "diff -rq exit=$?"
```

Expected: `devnet: same entries, same order`, `production: same entries, same order`, no `differs` line, `diff -rq exit=0` — all 1,120 entries byte-identical. (The first build of this dry run, packaged from an unchanged incremental state, even had the same APK sha256 as the base, `23f766af…`; after the Gradle mutants of Step 10 repackaged, the APK sha256 differs while every entry is identical: `cmp` places all 7,766 differing bytes inside the APK Signing Block — AGP's encrypted dependency-metadata block, re-encrypted at each packaging. So "same sha256 as the base" is not a stable test; "every entry identical" is.) The test APK targets the devnet app and carries its signer (`apksigner verify --print-certs`: both `0443017562334ae8…98ac93d`; `aapt2 dump badging`: `package: name='com.nocturawallet.devnet.test'`, `targetPackage="com.nocturawallet.devnet"`, `android:name="androidx.test.runner.AndroidJUnitRunner"`). The prover library inside both release APKs is the one Task 5 built (`libnoctura_prover.so` sha256 prefix `0b98b96897275983`; `build-android.sh` ran `check-needed.sh` and `check-jni-exports.sh` on it before installing: unchanged).

- [ ] **Step 8: The owner's checklist.**

Create `scripts/m1a-checkpoint/README.md`:

````markdown
# M1a checkpoint — the owner's checklist

Spec: `docs/superpowers/specs/2026-11-08-shielded-a0-m1-design.md` §16, "Checkpoints · M1a":

> on the phone, through a harness that is not in the devnet APK's release variant: `keysOpen` with the repo's test
> seed, `depositRho(0)`, `commitment()`, and a deposit proof whose public inputs equal the desk values and verify
> against the deposit VK read from chain; a `withdraw_change` prove without an `authId` refuses. `isSupported()` true
> on the phone. Each checkpoint also builds the production APK of the same commit and launches it on the phone.

## What is what

| piece | where | runs on |
|---|---|---|
| the sequence | `android/app/src/m1aCheckpoint/java/…/M1aCheckpoint.kt` | phone and desktop (a source dir of the two **test** source sets only) |
| the phone run | `android/app/src/androidTest/…/M1aCheckpointTest.kt` → `devnet-androidTest.apk` | the phone, inside the installed devnet **release** app (`testBuildType "release"`) |
| the desktop rehearsal | `android/app/src/test/…/M1aCheckpointHostTest.kt` | this laptop, over the `jni-host` library |
| the build | `scripts/m1a-checkpoint/build-apks.sh` | this laptop |
| "not in release" | `scripts/m1a-checkpoint/check-release-apk.sh` | this laptop, on the built APKs |
| the desk | `scripts/m1a-checkpoint/m1a-checkpoint.mjs` (+ `lib.mjs`, tested by `lib.test.mjs`) | this laptop, phone on USB |

The phone reports values; the desk decides. The desk computes the deposit's `rho(0)`, commitment and public inputs from
the test mnemonic itself (bls.js + poseidon-lite, no native code), reads the deposit VK out of the devnet `Pool`
account (one request to `api.devnet.solana.com`; never `noc-tura.io`, never mainnet — it checks devnet's genesis hash),
compares it with the pinned `deposit_vk.json`, and verifies the phone's proof against **the chain's** VK with an
independent pairing check (`@noble/curves`, not the arkworks code that proved).

The key files reach the phone **inside the test APK** (copied at build time from `NOCTURA_A0_KEYS_DIR`); the phone makes
no network request for the checkpoint, and `libnoctura_prover` re-checks each file's sha256 before it parses it.

## Before you start

- [ ] The phone: arm64, USB debugging on, this laptop authorized (`adb devices` lists exactly one `device`).
- [ ] **The production wallet's recovery phrase is at hand.** Step 3 installs the production APK of this commit
      *over* the installed wallet (`adb install -r`: same package, same key, its data is kept). Nothing is uninstalled
      or wiped — but the app can never show the phrase again, so have it before any install over a real wallet.
- [ ] The commit to check is checked out and the tree is clean (`git status`); `build-apks.sh` warns otherwise.
- [ ] On this laptop: `android/keystore.properties` (or `NOCTURA_KEYSTORE_FILE` …), `.env.devnet`, `.env.production`,
      the NDK `27.1.12297006`, and the program side's repository (for `zk/keys/v2/`).

## 1. Build the three APKs (one commit)

```bash
ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 \
NOCTURA_A0_KEYS_DIR=<program side repo>/zk/keys/v2 \
  scripts/m1a-checkpoint/build-apks.sh
```

- [ ] It ends with `release APK clean: …` for **devnet.apk** and **production.apk**, `control OK: the reading finds the
      harness in devnet-androidTest.apk` (entries, key-file sizes, dex names, the instrumentation), and the three
      sha256 sums. The APKs are in `build/m1a-checkpoint/apks/` with `COMMIT` and `SHA256SUMS`.

## 2. Rehearse on the desk (optional, no phone)

```bash
(cd native/noctura-prover && cargo build --release --locked --features jni-host)
cd android && NOCTURA_A0_HOST_LIB_DIR=<cargo target>/release NOCTURA_A0_KEYS_DIR=<…>/zk/keys/v2 \
  NOCTURA_M1A_REPORT_OUT=$PWD/../build/m1a-checkpoint/host-report.json \
  ENVFILE=.env.devnet ./gradlew :app:testDebugUnitTest --tests 'com.nocturawallet.prover.M1aCheckpointHostTest'
cd .. && node scripts/m1a-checkpoint/m1a-checkpoint.mjs vk
node scripts/m1a-checkpoint/m1a-checkpoint.mjs verify --rehearsal --report build/m1a-checkpoint/host-report.json
```

- [ ] `REHEARSAL PASSED (not a checkpoint: no phone)`, with `S16.0` / `S16.1` as `N/A (phone only)`.

## 3. The checkpoint (phone on USB)

```bash
node scripts/m1a-checkpoint/m1a-checkpoint.mjs all --apks build/m1a-checkpoint/apks
```

It reads the VK from devnet, installs `devnet.apk` and the test APK, runs the checkpoint on the phone (two proofs —
a few minutes; the screen stays as it is), installs `production.apk` over the installed wallet, launches the devnet
app and then the production app (10 s each), and prints:

```
PASS  S16.0   the report comes from the phone (ART, aarch64), not a rehearsal
PASS  S16.1   isSupported() is true on the phone
PASS  S16.2   keysOpen with the repo's test seed returns a handle (and Kotlin's seed copy is zero-filled)
PASS  S16.3   depositRho(0) equals the desk value
PASS  S16.4   commitment(10^9, rho(0)) equals the desk value
PASS  S16.5   the deposit proof's public inputs equal the desk values (commitment, amount, mintHash, rho)
PASS  S16.6   the deposit VK read from chain equals the pinned deposit_vk.json
PASS  S16.7   the deposit proof verifies against the deposit VK read from chain
PASS  S16.8   a withdraw_change prove without an authId refuses (E_A0_AUTH_ABSENT)
PASS  C8.a    control: the same withdraw_change call, approved, proves — … verifies (pinned withdraw_change_vk.json)
PASS  C8.b    control: the used authId is refused the second time
PASS  C8.c    control: keysClose ends the handle
PASS  S16.D   the device-side assertions of the checkpoint test passed
PASS  S16.10  the devnet release APK launches on the phone
PASS  S16.9   the production APK of the same commit launches on the phone
CHECKPOINT PASSED
```

- [ ] Every line `PASS` and the last line `CHECKPOINT PASSED` (exit code 0).
- [ ] **Look at the phone** during the two launches: the devnet app ("Noctura devnet") opens to its screen, then the
      production wallet opens to its lock screen / dashboard — no crash dialog, no blank screen. Unlock the production
      wallet once: your balances are there (its data was kept).
- [ ] Note the times: `S16.7`'s and `C8.a`'s detail give the deposit and withdraw_change proving times on the phone
      (M1c needs the second).

## 4. Record it

- [ ] Keep `build/m1a-checkpoint/` — `chain-pool.json` (the VK read: slot, RPC host, the raw account),
      `phone-report.json`, `launches.json`, `instrument.txt`, `apks/COMMIT`, `apks/SHA256SUMS` — and paste the PASS
      lines, the commit and the slot into the checkpoint record.
- [ ] Remove the test app: `adb uninstall com.nocturawallet.devnet.test` (only the instrumentation; the devnet and
      production apps stay).

## If a line fails

| line | means | look at |
|---|---|---|
| S16.0 / S16.1 | not the phone, or `isSupported()` false: the ABI gate (`A0Abi`) or the library failed to load | `phone-report.json` → `platform` (`osArch`, `isSupportedThrew`) |
| S16.2 | `keysOpen` refused / the fixture is not the test seed | `keysOpen.error` |
| S16.3 – S16.5 | the native derivation disagrees with the desk (the fixtures agreed on the desktop) | the `phone=` / `desk=` values |
| S16.6 | the chain's deposit VK is not the pinned one — **stop**: the pool was re-keyed or it is not the pinned pool | `chain-pool.json` |
| S16.7 | the proof does not verify against the chain's VK | `depositProof` |
| S16.8 | a withdraw_change proved (or refused for another reason) without an approval — **a security failure** | `withdrawWithoutAuthId` |
| C8.a – C8.c | the refusal is not specific / an approval was reusable / a handle outlived `keysClose` | the named entries |
| S16.D | the phone's own assertions failed | `instrument.txt` |
| S16.9 / S16.10 | an APK did not launch, or crashed (the libc++ lesson) | `launches.json`, `crash-<package>.txt` |

## What only the phone shows

The desktop rehearsal runs the same sequence over the host library; it cannot show `isSupported()` through the React
module on ART, the `aarch64` ABI gate, the version-scripted arm64 library loading inside the installed release app,
the proving thread's stack on Android, the proving times on the phone, or that the APKs launch.
````

- [ ] **Step 9: The whole suite.**

```bash
cd native/noctura-prover && cargo fmt --check; echo fmt=$?
cargo clippy --all-targets --locked -- -D warnings 2>&1 | tail -1
cargo clippy --all-targets --locked --features jni-host -- -D warnings 2>&1 | tail -1
NOCTURA_A0_KEYS_DIR=<program side>/zk/keys/v2 cargo test --locked 2>&1 | grep -E "^test result|A0-KEYS-SKIPPED"
cd ../.. && npx tsc --noEmit; echo tsc=$?
npx jest 2>&1 | grep -E "^(FAIL|Tests:|Test Suites:)"
npx eslint scripts/m1a-checkpoint/ 2>&1 | grep -E "No files matching"
npx prettier --check scripts/m1a-checkpoint/*.mjs
for f in scripts/m1a-checkpoint/*.mjs; do node --check $f || echo "$f FAILS"; done
bash -n scripts/m1a-checkpoint/build-apks.sh && bash -n scripts/m1a-checkpoint/check-release-apk.sh && echo sh-ok
node scripts/check-no-tge-date.mjs
node --no-warnings --test scripts/m1a-checkpoint/lib.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"
cd android && NOCTURA_A0_KEYS_DIR=<…> NOCTURA_A0_HOST_LIB_DIR=$CARGO_TARGET_DIR/release NOCTURA_M1A_REPORT_OUT=/tmp/r.json \
  ENVFILE=.env.devnet ./gradlew :app:testDebugUnitTest --rerun --console=plain 2>&1 | grep -E " (PASSED|FAILED|SKIPPED)$" | awk '{print $NF}' | sort | uniq -c
```

Expected:

```
fmt=0
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.91s
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.20s
test result: ok. 97 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 14.95s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.58s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
tsc=0
Test Suites: 1 skipped, 183 passed, 183 of 184 total
Tests:       1 skipped, 1260 passed, 1261 total
No files matching the pattern "scripts/m1a-checkpoint/" were found.
All matched files use Prettier code style!
sh-ok
no TGE date in 1443 tracked text files
ℹ pass 11
ℹ fail 0
     22 PASSED
```

(Rust 97 + 1 and Jest 1260 unchanged from Task 5 — this task touches neither. Kotlin: Tasks 4–5's 20 + this task's 2. **ESLint does not cover these files** — the repo's ESLint 8 config matches no `.mjs` ("No files matching"); forced with `--ext .mjs` its parser fails on ESM (`Parsing error: Unexpected token import`) exactly as on the existing `scripts/a0-vectors/gen-prove-vectors.mjs`. The `.mjs` gates are therefore prettier (the repo's `.prettierrc.js`), `node --check` and the node tests; the `.kt` files compile warning-free under the Kotlin compiler.)

- [ ] **Step 10: Named mutations — each compiled first, each red.**

Desk (`M-d-`): `git archive HEAD scripts/m1a-checkpoint native/noctura-prover/tests/fixtures src/modules/shielded/a0 package.json | tar -x` into a new directory, `node_modules` linked, the edit (an exact replacement asserted to occur once), `node --check` (none INVALID), `node --test scripts/m1a-checkpoint/lib.test.mjs`. Shell (`S-`): `git archive HEAD scripts/m1a-checkpoint`, the edit, `bash -n`, the script on Step 7's test APK — as build-apks.sh's two controls run it. Kotlin (`K-`) and Gradle (`G-`): **in the clone itself** (edit → run → `git checkout -- <file>` → `git status` clean), not in fresh copies: a Gradle copy needs its own real `node_modules` and a cold RN build (~60 min, GBs; the scratch disk had 9 GB) — the same stated deviation as Task 5. K: `./gradlew :app:testDebugUnitTest --rerun --tests 'com.nocturawallet.prover.M1aCheckpoint*'` with both variables; G: `ENVFILE=.env.devnet ./gradlew assembleRelease`, then `check-release-apk.sh` on the built release APK.

| mutation | edit | result | red |
|---|---|---|---|
| M-d-verify-accepts | `lib.mjs` `verifyGroth16`: `return Fp12.eql(prod, Fp12.ONE)` → `return true` | 8 pass / 3 fail | `verifyGroth16 refuses …`, `the rehearsal's deposit proof … not with a changed input`, `judge: each defect fails its own line` |
| M-d-g2-c0-first | `g2()`: the EIP-197 limb swap removed (`[int(0..32), int(32..64)], [int(64..96), int(96..128)]`) | 4 / 7 | the recorded Pool no longer decodes to `deposit_vk.json`; the landed proofs fail |
| M-d-a-negated-again | `const negA = toG1(g1(…))` → `….negate()` | 5 / 6 | the landed proofs and the rehearsal's proof fail |
| M-d-vkdiff-skips-ic | `vkDiff`: `['alpha', 'beta', 'gamma', 'delta', 'ic']` → without `'ic'` | 9 / 2 | `the recorded Pool account decodes …` (the one-byte IC change), `judge: each defect …` (the chain VK one coordinate off) |
| M-d-no-mint-check | `decodePoolAccount`: the mint `errs.push(…)` → `void 0;` | 10 / 1 | `decodePoolAccount refuses another owner, size, discriminator, mint or tree` |
| M-d-desk-index-1 | `deskValues`: `u64be(CHECKPOINT.depositIndex)` → `u64be(CHECKPOINT.depositIndex + 1n)` | 7 / 4 | `the desk values equal the offline fixtures …` and the three `judge:` tests |
| M-d-s16.5-first-only | `judge` S16.5: `pubs.every(…)` → `pubs.slice(0, 1).every(…)` | 10 / 1 | `judge: each defect fails its own line` (publicInputs[3] changed) |
| M-d-onphone-any-arch | `judge`: `&& plat.osArch === 'aarch64'` removed | 10 / 1 | `judge: each defect …` (osArch x86_64) |
| M-d-s16.8-any-code | `judge` S16.8: `code('withdrawWithoutAuthId') === 'E_A0_AUTH_ABSENT'` → `!!code('withdrawWithoutAuthId')` | 10 / 1 | `judge: each defect …` (refused for `E_A0_KEY_FILE_READ` — the wrong reason) |
| M-d-rpc-mainnet | `rpcRefusal`: `\|\| h.includes('mainnet')` removed | 10 / 1 | `the RPC guard …` |
| M-d-logcat-partial | `reportFromLogcat`: `total === 0 \|\| parts.size !== total` → `total === 0` | 10 / 1 | `the report is read from am instrument -r output, or reassembled …` |
| M-d-no-default-s16.9 | `judge`: the "not run" S16.9 line → `if (false)` | 10 / 1 | `judge: the rehearsal passes every desk line and fails exactly the phone-only ones` |
| M-d-input-not-lt-r | `verifyGroth16`: `if (v >= R)` → `if (false)` | 10 / 1 | `verifyGroth16 refuses …` (`/not < r/`) |
| M-d-s16.7-pinned-vk | `judge` S16.7: `verifyGroth16(chainVk, …)` → `verifyGroth16(pinned.deposit, …)` | 10 / 1 | `judge: each defect …` (chain VK one coordinate off must fail S16.7 too) |
| S-dex-blind | `check-release-apk.sh`: `markers='M1aCheckpoint\|…'` → `markers='ZZZ-NEVER'` | control exit 1 | `NEGATIVE CONTROL FAILED: the reading found no dex in …devnet-androidTest.apk` |
| S-size-column | `awk '$4 ~` → `awk '$5 ~` | control exit 1 | `… found no sizes …` |
| S-assets-blind | the entries `grep -E '^assets/(a0/\|…)'` → `grep -E '^assets/zz/'` | control exit 1 | `… found no entries …` |
| S-manifest-blind | `grep -q 'E: instrumentation'` → `grep -q 'E: instrumentationX'` | control exit 1 | `… found no manifest …` |
| S-release-always-clean | `if [ ${#found[@]} -gt 0 ]; then` → `if false; then` | first control exit 0; **second control exit 1** | `CONTROL FAILED: the release reading passes the test APK, which carries the harness` — **this mutant SURVIVED the first version of build-apks.sh** (one control only, `--expect-present`, which this edit does not touch); the second control was added for it and the mutant re-run red |
| K-no-noauth-check | `deviceFailures`: the `withdrawWithoutAuthId` line → `if (false) out += …` | 1 passed, 1 failed | `deviceFailuresSeesEachRefusalThatDidNotHappen` (9 ≠ 10) |
| K-noauth-after-authorize | `run()`: the no-authId prove moved after `authorizeUnshield` | 1 passed, 1 failed | `theCheckpointSequenceRunsOverTheHostLibraryAndWritesTheReport` (`AssertionError` at its `deviceFailures` assertion: the no-authId prove now uses the approval up, so the approved prove fails) |
| K-prove-on-caller-thread | `prove()`: `A0Prover.submit {` → `run {` | 1 passed, 1 failed | `theCheckpointSequenceRunsOverTheHostLibraryAndWritesTheReport` (`org.junit.ComparisonFailure` at the `A0Prover.THREAD_NAME` assertion) |
| K-supported-ignored | `deviceFailures`: `if (expectSupported && …` → `if (false && expectSupported && …` | 1 passed, 1 failed | `deviceFailuresSeesEachRefusalThatDidNotHappen` |
| K-other-seed | `run()`: `getJSONObject(0)` → `getJSONObject(1)` (the second test mnemonic) | 1 passed, 1 failed | `theCheckpointSequenceRunsOverTheHostLibraryAndWritesTheReport` (`AssertionError` at its `deviceFailures` assertion: the scenario's note is not this seed's, so the approved prove fails — and the values would not be the fixture's either) |
| K-seed-copy-unchecked | `deviceFailures`: the `seedCopyZeroFilled` line → `if (false) out += …` | 1 passed, 1 failed | `deviceFailuresSeesEachRefusalThatDidNotHappen` |
| G-harness-in-main | `build.gradle`: `main { java.srcDirs += "src/m1aCheckpoint/java" }` added | BUILD SUCCESSFUL; check exit 1 | `THE CHECKPOINT HARNESS IS IN …app-release.apk: classes2.dex: 18 M1aCheckpoint 1 m1a-report 1 M1A-REPORT 1 noctura.m1a.checkpoint-report` |
| G-fixtures-in-main | `main { assets.srcDirs += ["../../native/noctura-prover/tests/fixtures"] }` added | BUILD SUCCESSFUL; check exit 1 | `entries: assets/a0-ata-vectors.json assets/a0-key-vectors.json …` |
| G-runner-as-implementation | `androidTestImplementation("androidx.test:runner:1.7.0")` → `implementation(…)` | BUILD SUCCESSFUL; check exit 1 | `classes.dex: 8 AndroidJUnitRunner 431 androidx/test/` |

Not counted: `G-fixtures-and-keys-in-main` (the staged key dir ALSO added to `main` assets) is **INVALID** — the build fails Gradle 8.13's implicit-dependency validation (`Task ':app:mergeReleaseAssets' uses this output of task ':app:stageM1aCheckpointKeys' without declaring an explicit or implicit dependency`), so it never yields an APK to check; G-fixtures-in-main is its valid half. Not run: a mutant of `M1aCheckpointTest.kt` (the androidTest wrapper) — it runs only on a phone; and `testBuildType` removed — that variant would need a cold debug build (Notes).

- [ ] **Step 11: Commit.**

```bash
git add android/app/build.gradle android/app/src/androidTest android/app/src/m1aCheckpoint \
  android/app/src/test/java/com/nocturawallet/prover/M1aCheckpointHostTest.kt scripts/m1a-checkpoint
git status --short     # nothing else; build/, .env*, keystore.properties, jniLibs/ stay untracked
git commit -m "test(shielded-a0): the M1a on-phone checkpoint — an instrumented test of the devnet release app (in its own APK, absent from both release APKs), its desktop rehearsal over the jni-host library, and the desk script that reads the deposit VK from devnet, verifies the phone's proof independently and judges each §16 line (M1a Task 6)"
```

Expected `git show --stat HEAD`: 12 files changed, 2140 insertions(+).

#### Notes for the executor (Task 6)

- **The rulings this task took (each the most secure default; the owner may overturn any):**
  - **An instrumented test, not a debug-only screen — and of the RELEASE variant (`testBuildType "release"`).** The spec asks for a harness "not in the devnet APK's release variant". A debug screen lives in a debug build of the app, so (a) the phone would prove with a debug build, not the release library that ships (Task 5's version script, the packaging), (b) excluding it from release would rest on a source-set or flag rule inside the app, and (c) building the debug variant here is a cold RN build (~60 min, GBs of disk). An instrumentation is test code in a separate APK by construction: nothing of it can reach any app variant, which Step 7 shows on the built APKs (and the release APKs are content-identical to the base commit's). Testing the release variant is possible because instrumentation needs the same signer, not `debuggable`. Cost if wrong: if a phone refused instrumentation of a non-debuggable app (none known), the fallback is `testBuildType "debug"` plus one cold debug build; the harness code does not change.
  - **The harness calls the layer under the React methods** (`A0Seed` → `NocturaA0Native` → `A0Result`, every prove through `A0Prover.submit`), not `NocturaProverModule`'s `@ReactMethod`s with a `Promise`: those resolve through `Arguments.createArray()` / `WritableNativeArray`, which need React Native's native runtime (absent on the host JVM, and an extra moving part on the phone). The React methods are one-liners over exactly these calls (Task 4's `ReactSurfaceTest`, JVM). The one React method called for real is `isSupported()` — it is the §16 line, it touches no bridge type.
  - **The phone reports, the desk decides.** The device asserts only what it can see by itself (`isSupported`, the codes, that every step ran — `deviceFailures`), after the report is out; every value and both pairing checks are the desk's, with code that shares nothing with the native library (bls.js + poseidon-lite for the values, `@noble/curves` for the pairing). A desktop report cannot pass for a phone's: S16.0 requires `where = phone`, `java.vm.name = Dalvik`, `os.arch = aarch64`.
  - **The refusal is judged with its controls**: a `withdraw_change` prove without an `authId` must refuse with exactly `E_A0_AUTH_ABSENT`, with a well-formed witness and the real key files (so "it refused" cannot mean "it could not run"); the same call approved (Kotlin-only `authorizeUnshield`, as M1c's dialog will) must prove and verify; the used approval must refuse; `keysClose` must end the handle. The approved proof's public inputs include the test seed's note-1 nullifier — public test material, the repo's own mnemonic (the report is logged to logcat for that reason only with this seed).
  - **The key files ride in the test APK**, staged from `NOCTURA_A0_KEYS_DIR` at build time (decided over: `adb push` — a release app cannot read `/data/local/tmp` portably under SELinux and has no `run-as`; and a download on the phone — the content-addressed route is on `api.noc-tura.io`, the checkpoint must not depend on it, and a test should not contact it). Rust's pins re-check them on the phone.
  - **The deposit VK is read from the Pool account itself** (the deposit VK is inline in `Pool`, not a PDA), in one JSON-RPC batch with `getGenesisHash`; the script refuses an RPC whose genesis is not devnet's, any `*.noc-tura.io` / `*.solscan.io` host, any host naming mainnet, and plain http. Default RPC: the public `api.devnet.solana.com` (the repo's Helius devnet URL also passes the guard: `--rpc`). The read is recorded (`chain-pool.json`: slot, host, time, raw bytes) — the checkpoint's evidence.
  - **The withdraw_change control is verified against the pinned `withdraw_change_vk.json`, not a chain read** — §16's line names the deposit VK, and Task 3 already tied that file to the chain with the two landed withdraw_with_change proofs (which `lib.test.mjs` verifies again with the independent verifier). Reading `wchange_vk` (PDA `["wchange_vk", pool]`, a `WithdrawChangeVkAccount` with its own header and `written` counter) is a second account read and a second layout; M1c's checkpoint is the natural place.
  - **The production APK is installed OVER the installed production wallet** (`adb install -r`: same package, same key, data kept) — that is what "launches it on the phone" means for the real app; the script never uninstalls or clears data, and stops with the installer's message if the signature does not match. The README puts "have the recovery phrase at hand" first (the app can never re-show it — memory: the Sep 2026 lost-seed episode).
  - **"Launches" is measured**, not eyeballed only: `am start -W` → `Status: ok`, the process alive 10 s later (`pidof`), and the crash buffer clean (`logcat -b crash`, cleared before) — for the devnet app and the production app. The owner still looks at the screen (README).
- **What only the phone run will prove (nothing here can):** `isSupported()` true through the React module on ART; the `A0Abi` gate accepting the real `os.arch` of a 64-bit ARM process; the version-scripted arm64 `libnoctura_prover.so` loading inside the installed release app (Task 5's carried item); two proofs on the app's proving thread on Android (stack size included); the phone's proving times; instrumentation of the release app being allowed on the owner's phone; both APKs launching without a crash. Everything else ran here: the same sequence over the host library (Step 3), every desk check on that report against the recorded chain read (Step 6), the build and the absence proofs (Step 7).
- **Deviations from the brief / dispatch:**
  - The desk tests are `node --test` (`lib.test.mjs`), not Jest: Jest's `testMatch` collects no `.mjs`, and the repo's ESLint cannot parse ESM `.mjs` (Step 9) — the same as `scripts/a0-vectors/`. They are run by hand; **no CI job runs them**, nor the Kotlin tests (Task 5's stated gap), nor obviously the phone. CI is unchanged by this task.
  - The K / G mutations ran in the clone (stated in Step 10, as Task 5's).
  - Fixtures recorded, not generated: the devnet read and the rehearsal report cannot be regenerated byte for byte (slot / time; random `r`, `s`); the tests depend on neither's specific bytes beyond what they assert.
- **Found, for the controller / later tasks:**
  - **"Same APK sha256 as the base" is not a stable test**: AGP writes an encrypted dependency-metadata block into the APK Signing Block on every packaging (7,766 bytes differed, all inside it, with all 1,120 entries identical). Compare entries, not the file.
  - **`ReactApplicationContext` is abstract in RN 0.84**; `BridgeReactContext(Context)` is the deprecated concrete one. Any later test that needs a module instance meets the same.
  - If release ever gets `minifyEnabled true`, the instrumentation needs a test-only keep rule for `com.nocturawallet.prover.**` (the harness reaches `internal` objects by their real names).
  - The checkpoint's `phone` step installs `devnet.apk` with `-r` too: the devnet app's own data on the phone is kept; the instrumentation writes only `cacheDir/m1a-checkpoint/` (deleted after the run) and opens a key session in the app process (closed at the end; the process is restarted by `am instrument`).
  - Disk: the three APKs are ~190 MB per build; `build/m1a-checkpoint/` is gitignored (`build/`).
- **What the next tasks must know:** see Interfaces → "What later checkpoints rely on". M1b's checkpoint can start from `build-apks.sh` and the `phone` command's install / launch code; its own sequence is the app's UI, not an instrumentation.

#### Spec rev 3.2 lines (Task 6)
- §16 "Checkpoints · M1a": the harness is **an Android instrumented test of the devnet release variant** (`testBuildType "release"`; its own APK `com.nocturawallet.devnet.test`), carrying the four pinned A0 key files as test assets from `NOCTURA_A0_KEYS_DIR`; "not in the release variant" is shown on the built APKs (`check-release-apk.sh`, with two controls on the test APK) — the release APKs are content-identical to the previous commit's.
- §16 "Checkpoints · M1a": the refusal line is judged **with its controls** — the same `withdraw_change` call, approved through the Kotlin-only `authorizeUnshield`, proves and verifies; the used approval refuses; `keysClose` ends the handle — and must be exactly `E_A0_AUTH_ABSENT`.
- §16 / §14: "the deposit VK read from chain" is **the `deposit_vk` field inside the devnet `Pool` account** (`8VMe4…`, offset 144, 768 bytes), read by the desk in one genesis-checked request (`api.devnet.solana.com` by default; never `noc-tura.io`, never mainnet), compared with `deposit_vk.json`, and the phone's proof is verified against it with **an independent verifier** (`@noble/curves` bn254) — measured equal at slot 520213277. The withdraw_change VK stays the pinned file (Task 3's landed-proof tie) until M1c reads `wchange_vk`.
- §16 "launches it on the phone": measured as `am start -W` `Status: ok` + the process alive after 10 s + a clean crash buffer, for the devnet and the production APK; the production APK is installed over the installed wallet with its data kept.
- §14 "the scripted checks … run against devnet from a desk script": M1a's desk script is `scripts/m1a-checkpoint/m1a-checkpoint.mjs`, with the owner's checklist in `scripts/m1a-checkpoint/README.md`.


## Self-review

**1. Spec coverage (rev 3.1, M1a's row of §16).**

| §16 M1a item | Task |
|---|---|
| §3 derivation (EIP-2333 `sk`, `nk`, `ivk`, `d_self`, `addrField`, `mintHash`, commitments, `rho(i)`, the internal nullifier, `rho_change`, `matchSpent`), the `Mutex` state, zeroization | 1 |
| §3 ATA derivation and the on-curve owner | 2 (stricter: a valid Ed25519 public key — rev 3.2 line) |
| §4's Rust half (`parseUnshield`, the fee ceiling, pinned decimals) and the authorization record and its rules | 2 |
| §3 `prove`: allow-lists, witness completion, the authorization check, pinned keys, the signal-table / count test (m-5), the proof layout (m10) | 3 |
| §3 JNI surface, the seed as bytes, handle lifetime, INV-NK / INV-NULL / INV-AUTH as tests | 4 |
| §12's native removals, `Cargo.lock`, the `readelf` CI step, arm64-only | 5 |
| §16 checkpoint | 6 |
| §14's Rust and boundary tests | Tasks 1–4 |
| The offline bls.js vector (I-6) | Task 1's generator |

Not in M1a, by §16: the Kotlin dialog and `androidx.biometric` (M1c), every JS protocol module (M1b–M1c), the screens (M1b–M1d).

**2. Placeholder scan.** No "TBD", "TODO", "implement later" or "similar to Task N" in the plan's prose (checked over the six parts).

The rows that skip without `NOCTURA_A0_KEYS_DIR` are not placeholders:
- they print `A0-KEYS-SKIPPED`;
- they fail under `CI=true`;
- CI provisions the files.

**3. Type consistency.** Each task's Consumes was checked against the earlier tasks' Produces:

- Task 1's `Core` / `CORE` / `Handle` / `A0Error` and `Inner::end_session` are what Tasks 2–4 extend.
- Task 2's `take_auth(&mut self, handle, &AuthId, now) -> Result<Auth, A0Error>`, called after `auth::now()?` and first under the lock, is what Task 3's `prove` calls.
- Task 3's `prove` JSON shapes and the `NOCTURA_A0_KEYS_DIR` pins are what Task 4's bridge and Task 6's harness use.
- Task 4's ten exports are what Task 5's `exports.map` and `check-jni-exports.sh` pin.
- Task 5's `build-android.sh` is what Task 6's `build-apks.sh` runs.

**4. Review Focus.** Five rows above:
- tested: 3, 4, 5 (Rust half);
- known limitations with where they are seen: 1, 2, and 5's process-death half.

Row 3 is the controller's ruling added after the dry run: it changes Task 6's README and install step, with a test row and a mutation, so the executor writes it beyond the part's text.

**5. Replay.** `scratchpad/m1a-asm/replay.py` applies task-1 … task-6's blocks from this file onto `git archive c888096`: each new file in full, each "Replace" in full, each ```diff with `git apply --recount`, each `git rm`. It copies only the files the tasks generate by command. After each task it compares the tree with that task's chain commit (`diff -rq`): **IDENTICAL at all six prefixes** (7fc14e2, d30a178, 633f7b1, 5c02d72, db1e508, ee939bf).

**6. For the owner, at the finish.**
- **The v1 prover finding (Task 3):** v1's Groth16 `r` / `s` came from `seed_from_u64(0)`, so v1 proofs (the July devnet deposits) were not zero-knowledge. Devnet only; v1 is removed in M1b. The A0 path uses OS randomness.
- **Cleanup in the main checkout after the merge:** delete `android/app/src/main/cpp/blst/` (untracked once the ignore line goes) and run `./gradlew clean`.
- **Known gap:** no CI job runs the Kotlin JVM tests.
- **Rehearsed, not yet proven:** the checkpoint (Task 6) is rehearsed on the desktop; only the phone proves the release library loads, `isSupported()`, and the prove times.
