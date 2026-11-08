# Shielded on A0 · Milestone 1 — shield and a private unshield on the deployed A0 pool (Android, devnet)

**Status:** rev 1, 2026-11-08 — the design the owner approved in conversation section by section (2026-11-08: the
milestone split, `nk` in the Rust prover, the unshield destinations, the native confirmation in this milestone, a minimal
multi-account in the app; then the architecture, the data flow and the test / scope sections). Next: Fable review, then
the owner.

**Why.** Shielded is the core of the product. The program side deployed the A0 scheme (the key model that replaces the
broken `noteSecret` one) on devnet on 2026-08-12. On 2026-11-08 it also:

- created a fresh pool;
- published the A0 proving keys;
- closed hosted proving;
- froze the A0 relayer contract.

The wallet still speaks the old scheme to the old program. This milestone moves the mobile app's deposit and unshield
onto A0, with on-device proving, the spend key in native code only, a relayed exit, and notes recoverable from the seed.

**Success.** On an Android phone, on devnet, against pool `8VMe…`:

1. Shield an amount: a deposit signed by the user's transparent key, which is public by nature.
2. Unshield part of it to a **fresh account** of the same seed, through the relayer. The explorer shows that no
   transparent key of the user signed or paid the unshield.
3. Wipe the app, restore from the recovery phrase: the remaining shielded balance comes back from the chain.

This is the precondition the program side named for the trusted-setup ceremony (A1): A0 tested end to end including the
wallet.

## 0. Scope and decisions

| # | Decision (owner, 2026-11-08) | Where |
|---|---|---|
| S1 | Two milestones. **M1 (this spec): shield + unshield with change, via the relayer**, the whole chain (Rust, Kotlin, JS, screens) and an on-phone test. **M2: private transfer, scanning received notes, the 166-char `noc1…` receive address, merging notes.** | §0, §13 |
| S2 | `nk` is derived **in the Rust prover** (`native/noctura-prover`): EIP-2333 → `sk` → `nk` → `ivk`, witness completion, proving — one `.so`. `sk`, `nk`, `ivk` never leave Rust. The seed reaches native from JS as transparent signing already does today; seed-in-native is a later, pre-mainnet project. | §2, §3 |
| S3 | Unshield destinations: **default a fresh account** of the same seed (unlinkable exit; it then appears in the wallet), also **any address** (a payment, with a warning), and the **main account** only with a "this links your exit to your deposit" warning. | §6 |
| S4 | **Native confirmation of an unshield in M1:** Kotlin shows the destination and the amount that Rust parsed, behind biometrics, and issues a single-use authorization bound to them. The prover proves an unshield only against it. | §4 |
| S5 | **Minimal multi-account in the app**, part of M1 (the app has one account today): account `n` derived exactly as the extension derives it, a list of accounts with balances, and choosing the account to send from. No names, no editing. | §10 |

Controller rulings (the most secure default; the owner may overturn any):

| # | Ruling | Where |
|---|---|---|
| R1 | **Deposit `rho` is deterministic** from `nk` and a deposit counter (computed in Rust), so every own note is recoverable from the seed. This closes mainnet blocker #5 (seed-recoverable notes) by construction. | §3, §7 |
| R2 | **Diversifier `d = 0` for every own note in M1** (deposits and change). Diversified receive addresses arrive with M2's `noc1…` address. | §3 |
| R3 | **The pool, the mint and the mint's decimals are pinned in Rust**, so the confirmation shows a trustworthy human amount, not one JS supplied. | §4 |
| R4 | **The A0 proving keys are pinned in Rust by sha256**: native refuses a `.zkey` / `.wasm` whose digest differs, whatever JS hands it. A pin living only in the layer being attacked is not a control. | §3 |
| R5 | **The wallet pays exactly the relayer's `minFee`** (fee uniformity, frozen with the program side), never a user-chosen fee. | §6 |
| R6 | **No fallback to self-relay.** With the relayer unavailable, an unshield fails; it never signs with the user's key. | §6 |
| R7 | **Everything old goes:** the v1 program `NPkc…` (constants, instruction builders, flows, screens' paths), the v1 asset set, the old blst C module (`libnoctura_key.so`, `NocturaKeyModule`), the hosted-proving client paths. Only A0 is reachable. | §12 |
| R8 | **Shielded stays behind `FEATURES.shielded`** and ships only in the devnet build; the production APK is unchanged. | §12 |

## 1. Facts from the program side (2026-11-08; the facts are theirs, the values are ours)

The program side supplies these as facts. The wallet computes every value (commitment, nullifier, `addrField`, roots,
zeros) itself from the frozen spec and only then compares with their landed transactions. Consuming their values would
make the two sides agree by construction.

- **Program** `FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH` (fresh id), binary sha256 `24775d75b7548898e54d4ff2a0c1f690c07f41594b88b17a37d4c61d6401590c`.
- **Pool** `8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT`, mint `ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs`,
  MerkleTree `5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc`. The program side's `docs/zk-contract/devnet-a0-deployed-contract.json` describes them.
- **Instructions (discriminators):** `deposit f223c68952e1f2b6`, `withdraw_with_change 6cf44379ecf67997` (M1); `transfer a334c8e78c0345ba` (M2).
  - **Account order** is taken from the IDL built from the deployed source. That IDL is not on chain; the program side
    sends `shielded_pool.json`, sha256 `cfd37078…`.
  - **`withdraw_with_change` arguments:** `merkle_root[32], nullifier[32], amount u64 LE, change_commitment[32], fee u64 LE, proof Vec<u8>(256)` (380 bytes).
  - Its accounts: `pool(r), merkle_tree(w), vault(w), destination(w), nullifier_record(w), fee_payer(signer,w), fee_destination(w), wchange_vk(r), token_program, system_program`.
- **Events:**
  - `LeafInserted 59f3d408d7bfbb98` `{commitment[32], leaf_index u64 LE, root[32]}`. A deposit emits only this one.
  - `Withdraw c0f1c9d946965af7` `{nullifier[32]}`, after the change note's `LeafInserted`.
- **MerkleTree account (3352 bytes):** `nextLeafIndex @8`, `zeros @16`, `filledSubtrees @656`, `rootHistory @1296`,
  `rootHistoryHead @3344`; depth 20, history 64.
- **Public inputs, in order:**
  - deposit: `commitment, amount, mintHash, rho`, with private `nk, d`;
  - withdraw_change: `merkleRoot, nullifier, withdrawAmount, recipientField, mintHash, changeCommitment, fee`, with private `nk, d, inputAmount, rho, pathElements[20], pathIndices[20], change_d`.
- **Global PDAs:** `["rho", rho]` and `["nullifier", n]` are global to the program. `rho` must therefore never repeat
  for one key, in any pool.
- **Proof encoding:** 256 bytes, `A.y` negated. The Rust prover already serializes this layout (`proof_bytes.rs`), and
  the layout was accepted on chain in July.
- **A0 proving keys:**
  - Manifest: `https://api.noc-tura.io/api/v1/zk-assets/a0/zkey-manifest.json`. Files are content-addressed under
    `/api/v1/zk-assets/h/<sha256>/a0/<file>`.
  - deposit: zkey `fef08f02…3fe9` (662,589 B), wasm `1d69d7f8…dfff1` (2,528,384 B).
  - withdraw_change: zkey `ec55bdbb…d756f2` (4,469,189 B), wasm `01b0ec1f…45e0b9` (2,988,385 B).
  - Single-party dev keys, devnet only.
  - `/zk/prove` answers 410: no hosted proving exists.
- **Relayer (frozen, `relayer-a0-contract.md`):**
  - `POST /api/v1/relayer/submit`, kind `withdraw_change`.
  - `GET /api/v1/relayer/quote` returns `{programId, pool, mint, feePayer, maxFee, minFee{transfer, withdraw_change}, validForSeconds}`, u64 values as decimal strings.
  - The twelve outcomes, with `txSignature` present ⟺ forwarded.
  - `fee_destination = ATA(fee_payer, mint)` (derived on chain).
  - The optional `destinationOwner`: the ATA check always runs, and create-ATA-idempotent is added only when the ATA is missing.
  - The wallet adds nothing to a relayed tx. CU default for withdraw_change: 200,000.
  - Relayer fee payer `3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe`, fee ATA `9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9`.
  - **Not live yet**: the program side announces it.
- **Fee:** in the pool's token, `minFee` 10,000 base units, `max_fee` 100,000 (on chain: `fee <= pool.max_fee`).

## 2. Architecture

| layer | owns | never does |
|---|---|---|
| **Rust** (`native/noctura-prover`, `libnoctura_prover.so`, JNI) | the seed → `sk` → `nk` → `ivk` derivation; `addrField(d)`; deposit `rho(i)`; `nullifier(rho)`; witness completion (adds `nk`, `d`); the authorization check; proving with pinned keys; zeroization | return `sk` / `nk` / `ivk`; read the network; accept an unpinned key file |
| **Kotlin** (`NocturaProverModule` + a confirmation activity / dialog) | showing the destination, amount and fee that Rust parsed; `BiometricPrompt`; asking Rust to record a single-use authorization | take display values from JS |
| **JS** (`src/modules/shielded/*`) | chain I/O (tree sync, rho / nullifier PDA checks, deposit tx build and signing with the transparent key), the public part of the witness, the relayer client, post-landing verification, the note store (public fields only), recovery, multi-account | hold or compute anything from `sk` / `nk` / `ivk` |
| **Screens** | #11 (shielded mode), #16, #17, #18, #19–#21, built to `index.html` + `screen.md`; the account list / switcher and the confirmation dialog are undrawn (§11) | — |

The boundary has one test that matters most: **no JS module can produce a valid unshield proof without the native
authorization**, and no native call returns `sk`, `nk` or `ivk` (§14).

## 3. The Rust core

**Key derivation (spec from the A0 freeze; values computed here and compared with independent vectors).**

- `sk` = EIP-2333 at `m/12381/371/1/0` from the BIP-39 seed (memory: paths immutable, spend = 1/0).
- `nk = Poseidon3(TAG_NK = 0x14, sk_hi, sk_lo)`, with `sk` split into two 16-byte limbs (the freeze's convention, which
  the plan pins with a vector).
- `ivk = Poseidon2(TAG_IVK = 0x15, nk)` (M2 uses it for scanning; derived and zeroized here, never returned).
- `addrField(d) = Poseidon3(TAG_ADDR = 0x12, nk, d)`; `d = 0` for every own note (R2).
- `nullifier(rho) = Poseidon3(TAG_NULL = 0x11, nk, rho)`.
- **Deposit `rho(i)` (R1):** `be_mod_r(SHA-256("noctura/a0/deposit-rho/v1" ‖ nk as 32 bytes BE ‖ u64be(i)))`.
  - It is wallet-only: no circuit sees how `rho` was chosen. It is not a Poseidon tag, so it cannot collide with a
    present or future circuit tag.
  - Without `nk` it is indistinguishable from random.
- **Change note:** the circuit derives its `rho` from the spent note's nullifier, per the A0 equations
  (`a0/fieldEquations.ts` already checks them). Its amount is `inputAmount − withdrawAmount − fee`, and `change_d = 0`.
  The plan pins the exact derivation against the frozen equations.

**JNI surface (the A0 freeze's interface, cut to M1):**

```
keysOpen(seedHex) -> handle                    // derives sk/nk/ivk into native memory; returns an opaque handle
keysClose(handle)                              // zeroizes
addrField(handle, d) -> hex32                  // public projection
depositRho(handle, i) -> hex32                 // public once deposited
nullifier(handle, rhoHex) -> hex32             // public once spent
prove(handle, circuit, publicWitnessJson, authId?) -> {proofBytes, publicInputs}
authorizeUnshield(handle, destination, amount, fee) -> authId   // called by the Kotlin confirmation only
```

- **`prove`:**
  - Fills `nk` and `d` itself. JS never passes them; a witness that names them is refused.
  - For `withdraw_change`, it requires a live `authId` (see §4) and refuses unless all of these match the authorization:
    `recipientField == be_mod_f(destination)`, `withdrawAmount == amount`, `fee == fee`, plus the pinned `mintHash` and pool.
  - The authorization is consumed by the first prove, success or failure.
  - The circuit's key files are read from paths JS supplies, but each is hashed and refused unless it matches the
    sha256 pinned in Rust (R4).
- **Invariants (tests):**
  - INV-NK: `sk`, `nk`, `ivk` never cross JNI, are never logged, are zeroized on `keysClose` and on drop.
  - The handle dies with the process.
  - A second `keysOpen` replaces the first.

## 4. The native confirmation (S4)

1. JS asks the Kotlin module to confirm an unshield, passing the destination (base58), the amount (base units) and the fee.
2. **Rust parses and validates them:**
   - the destination is 32 bytes of base58;
   - the amount and fee are u64, with `fee` ≤ the amount;
   - the mint and decimals are the pinned ones (R3).
3. Kotlin renders, in its own native dialog (not a React view):
   - the full destination, never truncated (substitution attacks live in matching prefixes);
   - "Unshield `<human amount>` NOC (`<base units>` base units)";
   - "Relayer fee `<human fee>` NOC";
   - the pool.

   The human amount uses the pinned decimals.
4. `BiometricPrompt` (with the device credential allowed as a fallback, as the app's existing biometric setting
   allows). On success, Kotlin calls `authorizeUnshield`. Rust records `{destination, amount, fee, pool, mint, expiresAt
   = now + 120 s}` in native memory and returns an opaque `authId`, which carries no data JS could alter.
5. A cancel, a timeout or a biometric failure returns a refusal; nothing is recorded.

**Accepted limit (stated, not hidden):** a compromised JS can still ask for a confirmation of its own destination. The
user then sees that destination on a native screen and has to approve it. The control is the human reading a value JS
cannot forge, which is the point of S4.

## 5. Shield (deposit)

1. The user enters an amount on #16 (shield side).
2. JS takes the next deposit counter `i` from the note store and calls `depositRho(i)`. If `["rho", rho]` already exists
   on chain (for example after a restore), it moves to `i+1`. A collision therefore fails locally, never as a paid,
   rejected tx.
3. JS computes `commitment = Poseidon5(TAG_CM = 0x10, addrField(0), amount, mintHash, rho)` itself.
4. Rust proves the deposit circuit. JS compares the returned public inputs with its own, all four in order; a mismatch
   aborts.
5. JS builds the `deposit` instruction (IDL account order) and the existing confirmation flow signs it with the selected
   transparent account (#19 → #20 → #21). No authorization is needed: the circuit binds the note to the user's own `nk`,
   so a deposit cannot pay anyone else.
6. After confirmation on chain (the existing polling confirm, not a fixed wait), the note is stored as `{commitment,
   amount, rho, d: 0, leafIndex, status: unspent}`. `leafIndex` and the root are read from the tx's `LeafInserted`.

## 6. Unshield (withdraw with change, relayed)

1. **Destination** (S3):
   - the default is a **fresh account**: the lowest SLIP-0010 index ≥ 1 that the account registry does not hold and
     that has no on-chain history (`getSignaturesForAddress` empty). It is added to the registry (§10);
   - "Another address", with a warning that it is a payment;
   - "My main account", with the warning "this links your exit to your deposit".
2. **Note:** the largest unspent note. The maximum is that note's amount minus the fee; the screen says so and says
   that combining notes comes with M2.
3. **Tree:** JS syncs `LeafInserted` events of pool `8VMe…` and checks its root against the account's `rootHistory`. It
   computes the note's path.
4. **Quote:** `GET /relayer/quote`.
   - It is refused unless `programId`, `pool` and `mint` equal the pinned constants and the quote is younger than
     `validForSeconds`.
   - The fee is **exactly** `minFee.withdraw_change` (R5); a `minFee` above `maxFee` stops with a clear message.
5. **Confirmation (§4)** gives an `authId`.
6. **Witness:** JS supplies `merkleRoot, nullifier (from Rust), withdrawAmount, recipientField = be_mod_f(destination
   ATA), mintHash, changeCommitment (its own computation), fee, inputAmount, rho, pathElements, pathIndices`. Rust adds
   `nk, d, change_d`, checks the authorization and proves. JS compares all seven public inputs with its own.
7. **Submit:** kind `withdraw_change` with `destinationOwner` (the destination's owner, so the relayer creates a missing ATA).
8. **Outcomes** (the frozen twelve):
   - `confirmed`: JS verifies **on chain** before marking anything spent. The tx calls program `FeGSS…` on pool
     `8VMe…`, it carries our nullifier and our change commitment, its fee payer is the quote's `feePayer`, its
     `fee_destination` is `ATA(feePayer, mint)`, and its fee equals ours. Only then is the note marked spent and the
     change note stored (leaf index from its `LeafInserted`);
   - `unconfirmed`: the note becomes "pending"; JS reconciles by the nullifier PDA and never resubmits blindly;
   - `already_spent`: reconcile with the chain;
   - any failure: the note is untouched.
   - **Never a self-relay** (R6).
9. **Progress (#18):** real stages (sync, proof, submit, confirm), never a fixed 90 % or 100 %. This is the July lesson,
   where the progress hung at 90 %.

## 7. Recovery from the seed

- **Deposits:**
  1. For `i = 0, 1, 2, …`, derive `rho(i)` and look up `["rho", rho]`. Stop after 20 consecutive misses (the gap
     limit; deposits are sequential, so a gap only comes from a failed tx).
  2. For each hit, read the creating tx: amount from the instruction, leaf index from `LeafInserted`.
  3. Spent if `["nullifier", nullifier(rho)]` exists.
- **Change notes:** for each spent note, read its spending tx. The change note's `rho` comes from the A0 equation, its
  amount is the input minus the instruction's `amount` minus its `fee`, and its leaf index comes from `LeafInserted`.
  Recurse.
- **Accounts:** fresh accounts used for exits are found by the same rule as the extension's discovery (derive `n`,
  query history).
- The note store becomes a cache: losing it loses nothing.

## 8. The note store

- **Fields:** `{commitment, amount, rho, d, leafIndex, status: unspent | pending | spent, spentTx?}`, all public or
  spend-irrelevant. No `noteSecret` exists any more.
- **Storage:** the encrypted MMKV instance, schema `v1_a0_notes`.
- **Old notes:** v1 notes (the old scheme) are not migrated; their schema is cleared on first A0 run in the devnet build.
  They were devnet test notes, and the program side abandoned that pool.

## 9. Tree sync

- **Source:** transactions touching MerkleTree `5URd…`, parsed for `LeafInserted` by discriminator (80-byte payload
  plus the 8-byte discriminator).
- **Checks:**
  - the leaves are ordered by `leaf_index` with no gap;
  - the incremental root after each leaf equals the event's `root`;
  - the final root is in the account's `rootHistory`.
- On a mismatch, the sync refuses to build a path. It never proves against a root it could not reproduce.
- `zeros` / `emptyRoot` are computed by the wallet and compared with the account's `zeros @16`.
- The existing merkle and path code (`merkleSync`, `computeMerklePath`) is kept where it already matches A0 (depth 20,
  untagged Poseidon2 nodes). It is pointed at the new account and parser.

## 10. Minimal multi-account (S5)

- **Derivation:** account `n` = `core/keys/transparent.ts` SLIP-0010 `m/44'/501'/{n}'/0'`, the same code the extension
  uses, so account `n` is the same address in both.
- **Registry:** `v1_accounts` (public MMKV) lists the indices in use. Account 0 is the existing account (whatever scheme
  it was imported with, `cli` included).
- **UI:** the dashboard (#11) gains an account switcher: a list of accounts with SOL and token balances. The selected
  account is the one Send, Receive and Shield use. Fresh accounts appear in it automatically after an unshield.
- **Out:** names, renaming, hiding, reordering, importing a private key.

## 11. Screens

- **Built to `index.html` + `screen.md`:**
  - #16 shield-unshield (both sides);
  - #17 explainer;
  - #18 zk-proof, with real stages; its "Plonk/Halo2 simulation" wording in `screen.md` does not describe Groth16,
    and the copy fix of 2026-11-07 already says Groth16;
  - #19–#21 tx flow for the deposit;
  - #11 with mode = shielded.
- **Undrawn, built from the design system and shown to the owner in a visual pass:** the account switcher, the
  unshield destination choice, the warnings and the native confirmation dialog (Kotlin, styled with the design tokens).
- **Copy:** owner-delegated (D27); the privacy claims guard of PR #119 stays green. The exit is described as unlinkable
  only when it goes to a fresh account through the relayer, which is the only case where that is true.

## 12. Removals and build (R7, R8)

- **Removed:**
  - every reference to `NPkc…` and the v1 instruction builders (`deposit`/`withdraw`/`transfer` v1, `withdrawWitness`, `transferWitness` v1);
  - `noteSecret`, the v1 asset set and the hosted-proof client paths;
  - `NocturaKeyModule` / `libnoctura_key.so` and its CMake / Gradle stanzas.
- **Kept but unused in M1:** the M2 pieces that still match A0, such as `noteEncryption` (ECIES to `pk_enc_d`). They are
  revalidated in M2.
- **Build:**
  - the devnet build sets `FEATURES_SHIELDED=true`, `LOCAL_PROVING=true` and the relayer;
  - the production build keeps shielded off;
  - `assertShieldedRequiresLocalProving` stays.
- **The Rust `.so`:** it remains free of `libc++_shared` (checked by `readelf` in the build) and is built for `arm64-v8a`.
  On other ABIs `isSupported()` is false and shielded is hidden.

## 13. Out of M1 (M2 and later)

- **M2:** private transfer (2-in / 2-out with fee), scanning `NoteCiphertext` with `ivk` in native, the 166-character
  `noc1…` address (codec against the program side's rejection cases plus our own-encoder positive control),
  diversified receive addresses, merging notes.
- **Later:**
  - seed-in-native (Keystore);
  - iOS (the native port is a prerequisite);
  - the ceremony (A1), the audit, an immutable VK, mainnet;
  - a coordinator tree indexer if RPC log scanning becomes too slow.

## 14. Tests and gates

- **Rust:**
  - EIP-2333 → `sk` against independent vectors (from `@noble` / the EIP's own test vectors, never from this crate);
  - `nk`, `ivk`, `addrField`, `nullifier` against values computed independently in JS from the frozen equations
    (`a0/fieldEquations.ts`);
  - `rho(i)` against a JS reimplementation;
  - a proof of each circuit verifies against the VK the chain holds;
  - pinned-digest refusal, with a one-byte-changed key file;
  - authorization refusals (another destination, amount, fee, expired, reused, absent) and the refusal of a witness
    naming `nk` / `d`;
  - zeroization (handle closed → no secret readable);
  - named mutations for each check.
- **JS:**
  - instruction data and account metas byte for byte against `relayer-a0-golden-vectors.json`, plus our own deposit
    encoding against the landed deposit `3DR6F7oW…`;
  - the tree sync against the real `5URd…` account (a recorded fixture) with root, gap and order controls;
  - every relayer outcome;
  - post-landing verification refusing a foreign pool, a foreign fee payer, a wrong `fee_destination`, a wrong fee and a missing nullifier;
  - quote validation;
  - recovery on recorded fixtures;
  - multi-account derivation equal to the extension's for `n = 0..3`;
  - the privacy-claims guard.
- **Boundary:**
  - a source test that no JS module imports anything that could return a secret;
  - a JNI surface test that the module exposes exactly §3's functions.
- **On the phone (devnet), the acceptance:**
  1. Shield.
  2. Unshield part to a fresh account via the relayer; on the explorer, no transparent key of the user is in the
     unshield tx.
  3. Send from the fresh account.
  4. Wipe and restore: the balance returns.
- All gates of the repo stay green: tsc, jest, lint, no-TGE-date, the privacy claims.

## 15. Dependencies and open points

- **Program side:**
  - the A0 relayer live on devnet (`/relayer/submit` kind `withdraw_change`, `/relayer/quote`) and the relayer-landed
    golden vector — announced as coming;
  - the IDL `shielded_pool.json` committed or sent.

  Everything before the on-phone acceptance can be built and tested without them.
- **Owner:** none open after S1–S5. The rulings R1–R8 are listed for the owner to overturn.
