# Shielded on A0 · Milestone 1 — shield and a private unshield on the deployed A0 pool (Android, devnet)

**Status:** rev 2, 2026-11-08 — Fable review 1 + owner decisions S6–S9, controller rulings R9–R11. Rev 1 (58c0c7a) was
the design the owner approved in conversation section by section (the milestone split, `nk` in the Rust prover, the
unshield destinations, the native confirmation in this milestone, a minimal multi-account in the app; then the
architecture, the data flow and the test / scope sections). The review (`.superpowers/sdd/shielded-a0-m1-spec-review-1.md`)
found 4 Critical, 13 Important and 15 Minor issues and asked 7 questions; the owner answered four (S6–S9) and the
controller ruled on three (R9–R11, `.superpowers/sdd/shielded-a0-m1-decisions.md`). Next: Fable review of rev 2, then
the owner; then the four plans of §16, each with its own Fable review.

### Rev 2 — what changed, finding by finding

- **C1** (owner vs ATA): JS passes the destination **owner**; Rust derives `ATA(owner, pinned mint)`, records both, binds
  `recipientField = be_mod_f(ata)`; Kotlin shows both → §3 (ATA derivation, `prove`), §4 steps 2–4, §6.6–6.7, §14.
- **C2** (fresh exit account has no SOL): S6 — the relayer adds a fixed SOL grant to the destination owner in the same
  tx; the exact contract proposal is a stated dependency → §6.10, §15 (P1, P2); acceptance rewritten so no step
  funds the fresh account from another account of the seed → §16 M1c/M1d checkpoints; a linking warning on sends
  between own accounts → §10.
- **C3** (seed in JS): S7 — honest security language → §0 (S2, S7), §2 "What the native confirmation is, and is not",
  §4 "Accepted limits"; seed passed as bytes, zeroized in Rust after derivation → §3 `keysOpen`; seed-in-native a
  mandatory pre-mainnet milestone → §13; the boundary test's true scope → §14.
- **C4** (`addrField` is viewing material): R9 — `addrField` never leaves Rust, Rust computes commitments, own notes
  use a secret diversifier `d_self` → §3 (derivation, JNI, INV-NK), §5.3, §7, §8 (no `d` in the store), R2 superseded.
- **I1** (deposit ix unspecified): the layout is written into §1 from the program side's source, and M1b's first task
  confirms it byte for byte against the landed deposit → §1, §16 M1b.
- **I2** (deposit bookkeeping order): note written `pending` before submit, reconciled at startup; a rho-PDA hit for an
  unknown counter is a recovery event; one counter per `nk` across pools → §5.2, §5.6, §8.
- **I3** (nullifier point lookups leak to the RPC): spent-ness from `Withdraw` events in the uniform tree sync; no
  point lookup of an own nullifier, its PDA or a relayed signature, ever; trust model stated → §2, §6.8, §7, §9.
- **I4** (copy vs the guard): R10 — exact copy rules, "unlinkable" stays out, anonymity-set size as the measure → §11.
- **I5** (`pinnedFetch` on device): an on-device positive control is M1c's first task → §6.0, §16 M1c.
- **I6** (multi-account vs the extension): registry of scheme strings, fresh rule "lowest `slip10` index not in the
  registry", S9 for `cli`, a recovery rule the wallet defines, cluster-aware → §7, §10.
- **I7** (fee semantics, quote/confirm order): `withdraw + fee ≤ input`; dialog says the destination receives exactly
  X; the order and the re-quote → re-confirm rule → §4 step 2–3, §6.4–6.7.
- **I8** (change `rho`): read from the program side's circuit source (`RhoOut(nullifier, 0)`); a golden
  `changeCommitment` row requested; recovery and §14 depend on it → §1, §3, §15.
- **I9** (old-scheme surfaces): shielded Receive, address priming, `noteScan` / view session, `ExportViewKey`,
  self-relay + its flag, all listed → §12.
- **I10** (Kotlin rules): overlay, `FLAG_SECURE`, null / recreated activity, single in-flight, `Mutex`, invalidation
  → §3, §4, §14.
- **I11** (deny-list): per-circuit exact allow-lists, asserted against the signal table → §3 `prove`, §14.
- **I12** (four plans): S8 → §16.
- **I13** (scripted no-signer check): in the post-landing verifier and the acceptance → §6.8, §14, §16.
- **Minors:** m1 → §3 (SHA-512 then reduce); m2 → §12; m3 → §3, §4; m4 → §3 (`witnessJson`); m5 → §3 (handle
  lifetime); m6 → §14; m7 → departed, §7 (no point lookup at all, so the question does not arise); m8 → §9, §12; m9 →
  §12; m10 → §14, §16 M1a; m11 → §14; m12 → §3, §14; m13 → moot (no `d = 0`); m14 → §12 (phone-only); m15 → §12, §16
  M1a.
- **New in rev 2, not from the review:** the fresh-account history check and every balance poll are visible to the
  RPC provider, which can link all accounts of a wallet — stated in §2's trust model; the new relayer client must
  append bare paths to `API_BASE` (memory: it already ends in `/v1`) → §6.0; the account registry moves from the public
  to the encrypted MMKV (a plaintext list of one's own accounts is a link) → §10; deposit-recovery matching moves off
  RPC point lookups onto the synced history → §7.

**Why.** Shielded is the core of the product. The program side deployed the A0 scheme (the key model that replaces the
broken `noteSecret` one) on devnet on 2026-08-12. On 2026-11-08 it also:

- created a fresh pool;
- published the A0 proving keys;
- closed hosted proving;
- froze the A0 relayer contract.

The wallet still speaks the old scheme to the old program. This milestone moves the mobile app's deposit and unshield
onto A0, with on-device proving, the spend key derived and held in native code (the seed it comes from still passes
through JS in M1 — §2), a relayed exit, and notes recoverable from the seed.

**Success.** On an Android phone (arm64), on devnet, against pool `8VMe…`, in this order:

1. Shield an amount: a deposit signed by the user's transparent key, which is public by nature.
2. Wipe the app, restore from the recovery phrase: the shielded balance comes back from the chain.
3. Unshield part of it to a **fresh account** of the same seed, through the relayer. A script, not the explorer by
   eye, shows that no key of this seed signed or paid the unshield, and that the fresh account received the token
   amount and the relayer's fixed SOL grant (S6).
4. Wipe and restore again: the change note and the fresh account come back.
5. Send from the fresh account to an address outside this seed, using only the granted SOL: no transaction between
   any other account of the seed and the fresh account exists.

What success does **not** claim: that the exit cannot be linked to the deposit. Amounts and timing are public, the
anonymity set on devnet is a handful of notes, the relayer and the RPC provider see requests (§2). What it shows is
narrower and checkable: no key of the user signs or pays the exit, and nothing the wallet does afterwards adds an
on-chain edge back.

This is the precondition the program side named for the trusted-setup ceremony (A1): A0 tested end to end including the
wallet.

## 0. Scope and decisions

| # | Decision (owner) | Where |
|---|---|---|
| S1 | Two milestones. **M1 (this spec): shield + unshield with change, via the relayer**, the whole chain (Rust, Kotlin, JS, screens) and an on-phone test. **M2: private transfer, scanning received notes, the 166-char `noc1…` receive address, merging notes.** | §0, §13 |
| S2 | `nk` is derived **in the Rust prover** (`native/noctura-prover`): EIP-2333 → `sk` → `nk` → `ivk`, witness completion, proving — one `.so`. `sk`, `nk`, `ivk` never leave Rust. *(Rev 2 correction of the rationale, per S7: the seed is in JS today — transparent signing derives in JS from the keychain-held phrase — and in M1 it still crosses JS on its way to Rust. Seed-in-native is a mandatory pre-mainnet milestone, §13.)* | §2, §3 |
| S3 | Unshield destinations: **default a fresh account** of the same seed (it then appears in the wallet), also **any address** (a payment, with a warning), and the **main account** only with a "this links your exit to your deposit" warning. *(Rev 2: for `cli` wallets, S9.)* | §6 |
| S4 | **Native confirmation of an unshield in M1:** Kotlin shows the destination and the amount that Rust parsed, behind biometrics, and issues a single-use authorization bound to them. The prover proves an unshield only against it. *(Rev 2: what this protects against is stated in §2, per S7.)* | §4 |
| S5 | **Minimal multi-account in the app**, part of M1 (the app has one account today): account `n` derived exactly as the extension derives it, a list of accounts with balances, and choosing the account to send from. No names, no editing. | §10 |
| S6 | *(2026-11-08, review Q1 / C2)* **The relayer adds a fixed SOL amount to the fresh exit account in the same unshield tx** — the same amount for everyone, so it is not a fingerprint — so the account can transact without a re-linking funding tx. Needs a change to the frozen A0 relayer contract (program side); cost and abuse sit on the coordinator (spend cap); on mainnet the fee must cover it. | §6.10, §15 |
| S7 | *(review Q2 / C3)* **Accept the seed crossing JS for devnet M1.** The spec states honestly that the native confirmation guards against honest-code mistakes and UI spoofing, **not** against a compromised JS (which holds the seed). **Seed-in-native becomes a mandatory milestone before mainnet.** | §2, §4, §13 |
| S8 | *(review Q6 / I12)* **M1 is four plans**, each with its own review and an on-phone checkpoint. | §16 |
| S9 | *(review Q3 / I6)* **`cli`-scheme wallets get no fresh accounts** (the extension's rule: a `cli` wallet has exactly one account). Their unshield goes to any address, or to the main account with the warning. | §6.1, §10 |

Controller rulings (the most secure default; the owner may overturn any):

| # | Ruling | Where |
|---|---|---|
| R1 | **Deposit `rho` is deterministic** from `nk` and a deposit counter (computed in Rust), so every own note is recoverable from the seed. This closes mainnet blocker #5 (seed-recoverable notes) by construction. | §3, §7 |
| R2 | ~~Diversifier `d = 0` for every own note in M1.~~ **Superseded by R9 (rev 2).** | — |
| R3 | **The pool, the mint and the mint's decimals are pinned in Rust**, so the confirmation shows a trustworthy human amount, not one JS supplied. | §4 |
| R4 | **The A0 proving keys are pinned in Rust by sha256**: native refuses a `.zkey` / `.wasm` whose digest differs, whatever JS hands it. A pin living only in the layer being attacked is not a control. | §3 |
| R5 | **The wallet pays exactly the relayer's `minFee`** (fee uniformity, frozen with the program side), never a user-chosen fee. | §6 |
| R6 | **No fallback to self-relay.** With the relayer unavailable, an unshield fails; it never signs with the user's key. The self-relay code and its flag are deleted (§12). | §6 |
| R7 | **Everything old goes:** the v1 program `NPkc…` (constants, instruction builders, flows, screens' paths), the v1 asset set, the old blst C module (`libnoctura_key.so`, `NocturaKeyModule`), the hosted-proving client paths, and (rev 2, I9) every old-scheme surface still facing the user. Only A0 is reachable. | §12 |
| R8 | **Shielded stays behind `FEATURES.shielded`** and ships only in the devnet build; the production APK is functionally unchanged (its build inputs do change, §12). | §12 |
| R9 | *(review Q4 / C4)* **`addrField` never leaves Rust; Rust computes the commitments.** JS's independent check is the `fieldEquations.ts` tests, plus comparing Rust's public inputs with the public values JS can recompute. **Own notes use a secret diversifier `d_self` derived from `nk`**, not `d = 0`. | §3, §5, §7, §8 |
| R10 | *(review Q5)* **Screens never call the exit "unlinkable".** They say the relayer pays and submits, so no key of yours signs it, and that amounts and timing are public. **`ExportViewKey` is removed from the M1 build** ("not available in this version"; the A0 `ivk` export is an M2 question). | §11, §12 |
| R11 | *(review Q7)* **The explainer (#17) names the relayer and the RPC provider** as parties that see the exit transaction — not who you are on chain, but the request. | §11 |

## 1. Facts from the program side (2026-11-08; the facts are theirs, the values are ours)

The program side supplies these as facts. The wallet computes every value (commitment, nullifier, `addrField`, roots,
zeros) itself from the frozen spec and only then compares with their landed transactions. Consuming their values would
make the two sides agree by construction.

- **Program** `FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH` (fresh id), binary sha256 `24775d75b7548898e54d4ff2a0c1f690c07f41594b88b17a37d4c61d6401590c`.
- **Pool** `8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT`, mint `ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs`
  (classic SPL Token program), MerkleTree `5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc`. The program side's
  `docs/zk-contract/devnet-a0-deployed-contract.json` describes them.
- **Instructions (discriminators):** `deposit f223c68952e1f2b6`, `withdraw_with_change 6cf44379ecf67997` (M1); `transfer a334c8e78c0345ba` (M2).
  - **Account order** is taken from the IDL built from the deployed source. That IDL is not on chain; the program side
    sends `shielded_pool.json`, sha256 `cfd37078…`.
  - **`deposit` arguments** (rev 2, I1): `amount u64 LE, commitment[32], rho[32], proof Vec<u8>(256)` — 8 + 32 + 32 +
    4 + 256 = 332 bytes after the discriminator. No ciphertext (a deposit emits no `NoteCiphertext`).
  - Its accounts: `pool(r), merkle_tree(w), vault(w), depositor(signer,w), depositor_token_account(w), rho_marker(w,
    init PDA ["rho", rho], paid by the depositor), token_program, system_program`.
  - The `rho` seed is the same 32 bytes as the `rho` argument and the `rho` public input: the field element in
    canonical big-endian (`< r`). The nullifier PDA uses the nullifier the same way.
  - *Provenance:* read from the program side's source (`programs/shielded-pool/src/lib.rs`, `DepositCtx`, their HEAD
    `93a82a5`), not from the IDL. M1b's first task decodes the landed deposit `3DR6F7oW…` against the IDL and this text;
    nothing in M1b is written before that passes.
  - **`withdraw_with_change` arguments:** `merkle_root[32], nullifier[32], amount u64 LE, change_commitment[32], fee u64 LE, proof Vec<u8>(256)` (380 bytes).
  - Its accounts: `pool(r), merkle_tree(w), vault(w), destination(w), nullifier_record(w), fee_payer(signer,w), fee_destination(w), wchange_vk(r), token_program, system_program`.
    `destination` is a **token account**; the program checks `recipientField == be_mod_f(destination)` and that its
    mint is the pool's.
- **Events:**
  - `LeafInserted 59f3d408d7bfbb98` `{commitment[32], leaf_index u64 LE, root[32]}`. A deposit emits only this one.
  - `Withdraw c0f1c9d946965af7` `{nullifier[32]}`, after the change note's `LeafInserted`.
- **MerkleTree account (3352 bytes):** `nextLeafIndex @8`, `zeros @16`, `filledSubtrees @656`, `rootHistory @1296`,
  `rootHistoryHead @3344`; depth 20, history 64.
- **Public inputs, in order:**
  - deposit: `commitment, amount, mintHash, rho`, with private `nk, d`;
  - withdraw_change: `merkleRoot, nullifier, withdrawAmount, recipientField, mintHash, changeCommitment, fee`, with private `nk, d, inputAmount, rho, pathElements[20], pathIndices[20], change_d`.
- **Change note `rho`** (rev 2, I8): `rho_change = Poseidon3(TAG_RHO = 0x13, nullifier, 0)` — the circuit's `RhoOut`
  with `index = 0` (`zk/circuits/v2/withdraw_change.circom` at the program side's `93a82a5`, §2.4.1 of the freeze), and
  `changeAmount = inputAmount − withdrawAmount − fee`, under `change_d`. This is read from their source, not confirmed
  against the compiled `.wasm`; §15 asks the program side for the signal-table row and a golden `changeCommitment`
  vector with its inputs.
- **Global PDAs:** `["rho", rho]` and `["nullifier", n]` are global to the program. `rho` must therefore never repeat
  for one key, in any pool.
- **Proof encoding:** 256 bytes, `A.y` negated. The Rust prover already serializes this layout (`proof_bytes.rs`); it
  was accepted on chain in July **by the v1 program**. M1a re-verifies it against A0 (§14).
- **A0 proving keys:**
  - Manifest: `https://api.noc-tura.io/api/v1/zk-assets/a0/zkey-manifest.json`. Files are content-addressed under
    `/api/v1/zk-assets/h/<sha256>/a0/<file>`.
  - deposit: zkey `fef08f02…3fe9` (662,589 B), wasm `1d69d7f8…dfff1` (2,528,384 B).
  - withdraw_change: zkey `ec55bdbb…d756f2` (4,469,189 B), wasm `01b0ec1f…45e0b9` (2,988,385 B).
  - Single-party dev keys, devnet only.
  - `/zk/prove` answers 410: no hosted proving exists.
- **Relayer (frozen, `relayer-a0-contract.md`, their `de70045`):**
  - `POST /api/v1/relayer/submit`, kind `withdraw_change`.
  - `GET /api/v1/relayer/quote` returns `{programId, pool, mint, feePayer, maxFee, minFee{transfer, withdraw_change}, validForSeconds}`, u64 values as decimal strings; `validForSeconds` is 60.
  - The twelve outcomes (`confirmed`, `already_spent`, `unconfirmed`, `relay_failed`, `invalid_request`,
    `duplicate_in_flight`, `budget_exceeded`, `balance_too_low`, `unavailable`, `transfer_disabled`,
    `relayer_disabled`, `misconfigured`), the outcome in the body as well as the HTTP status, with `txSignature`
    present ⟺ forwarded.
  - `fee_destination = ATA(fee_payer, mint)` (derived on chain).
  - The optional `destinationOwner`: the ATA check always runs, and create-ATA-idempotent is added only when the ATA is missing.
  - The wallet adds nothing to a relayed tx. CU default for withdraw_change: 200,000.
  - Relayer fee payer `3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe`, fee ATA `9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9`.
  - **Not announced as live to the wallet yet.** (Their `93a82a5` records a `withdraw_change` landed by that key
    "through the live route", `3UfCx5TD…`; the wallet still waits for the announcement and the S6 change, §15.)
- **Fee:** in the pool's token, `minFee` 10,000 base units, `max_fee` 100,000 (on chain: `fee <= pool.max_fee`).
- **CU measured by the program side:** deposit 139,135 / 140,627; `withdraw_with_change` 179,335 direct, 173,458
  through the relayer.

## 2. Architecture

| layer | owns | never does |
|---|---|---|
| **Rust** (`native/noctura-prover`, `libnoctura_prover.so`, JNI) | the seed → `sk` → `nk` → `ivk`, `d_self`, `addrField` derivation; deposit `rho(i)`; `nullifier(rho)`; own-note commitments; `ATA(owner, mint)`; witness completion (everything but the JS allow-list); the authorization record and check; proving with pinned keys; zeroization | return `sk` / `nk` / `ivk` / `d_self` / `addrField`; read the network; accept an unpinned key file |
| **Kotlin** (`NocturaProverModule` + a confirmation dialog) | showing the owner, the token account, the amount and fee that Rust parsed; `BiometricPrompt`; asking Rust to record a single-use authorization | take display values from JS; expose `authorizeUnshield` to JS |
| **JS** (`src/modules/shielded/*`) | chain I/O (tree sync, the rho-PDA pre-check, deposit tx build and signing with the transparent key), the allow-listed part of the witness, the relayer client, post-landing verification, the note store (public fields only), recovery, multi-account | hold or compute anything from `sk` / `nk` / `ivk` / `addrField` / `d_self` |
| **Screens** | #11 (shielded mode), #16, #17, #18, #19–#21, built to `index.html` + `screen.md`; the account list / switcher, the unshield destination choice, the warnings and the confirmation dialog are undrawn (§11) | — |

**What the native confirmation is, and is not (S7).** Until seed-in-native (§13), the seed passes through JS: the
phrase is read from `react-native-keychain` (biometric access control,
`BIOMETRY_ANY_OR_DEVICE_PASSCODE`), turned into the seed in JS, and handed to Rust. `micro-key-producer/bls.js`
(EIP-2333) and `poseidon-lite` are in the bundle, and the pinned `.zkey` / `.wasm` are files on disk. A compromised JS
layer therefore does not need the confirmation at all: it can derive `sk` at `m/12381/371/1/0`, compute `nk`, build a
witness and prove with any prover, with no `authId` and no dialog. So, in M1:

- the native confirmation **does** protect against honest-code mistakes (a wrong destination or amount reaching the
  prover), against UI spoofing (a React view that shows one destination while another is proved), and against
  supply-chain code that tampers with arguments but does not re-derive keys;
- it does **not** protect against a compromised JS runtime. The real control for that, in M1, is the custody of the
  phrase: the keychain entry behind biometrics, read only when an operation needs it.
- The confirmation becomes a hard control only once the seed never enters JS (seed-in-native, a mandatory pre-mainnet
  milestone).

The boundary tests (§14) are scoped to what they can prove: **no module of this repository** derives at the spend path,
holds `nk` / `addrField`, or produces an unshield proof without the native authorization; and no native call returns
`sk`, `nk`, `ivk`, `d_self` or `addrField`. They say nothing about code injected into the runtime.

**Who sees what (I3, R11).** Stated plainly, so no screen and no plan assumes more:

- **The chain** (anyone): every deposit's signer, amount and `rho`; every unshield's destination token account,
  amount, fee, nullifier, change commitment and time; the relayer's SOL grant; the pool's leaf count (the anonymity set,
  a handful of notes on devnet). The proof hides which leaf an unshield spends.
- **The relayer**: the network address of the request, the destination, the amount and the time of every unshield it
  submits — not which deposit it spends.
- **The RPC provider** (Helius on devnet): every request the app makes from its network address — including the
  balance polls of **every** account in the registry, the fresh-account history check and the deposit's rho-PDA
  check. It can link a wallet's accounts to each other by request pattern, fresh exit accounts included. The design
  keeps the app's requests that are *specific to one note* off the RPC (no lookup of an own nullifier, its PDA or a
  relayed signature — §6.8, §7, §9), but it cannot hide the account polls.

Neither the relayer nor the RPC provider is "unable to link"; the success criteria claim nothing against them.

## 3. The Rust core

**Key derivation (spec from the A0 freeze; values computed here and compared with independent vectors).**

- `sk` = EIP-2333 at `m/12381/371/1/0` from the BIP-39 seed (memory: paths immutable, spend = 1/0). The seed is
  zeroized the moment `sk` is derived.
- `nk = Poseidon3(TAG_NK = 0x14, sk_hi, sk_lo)`, with `sk` split into two 16-byte big-endian limbs (`sk_hi` the first
  16 bytes of `sk` as 32 bytes BE). `nk` is wallet-only, so the convention needs a wallet-owned vector, not a cross-repo
  one; M1a pins it with one.
- `ivk = Poseidon2(TAG_IVK = 0x15, nk)` (M2 uses it for scanning; derived and zeroized here, never returned).
- **Own diversifier (R9):** `d_self = be_mod_r(SHA-512("noctura/a0/self-d/v1" ‖ nk as 32 bytes BE))`. Every own note
  in M1 (deposits and change) uses `d = change_d = d_self`. M2's receive addresses must use `d ≠ d_self`, so the
  diversifier of own notes is never a value that gets published.
- `addrField(d) = Poseidon3(TAG_ADDR = 0x12, nk, d)`. **Viewing material, not a public projection (C4):** with
  `addrField(d_self)`, anyone can test every deposit leaf (amount, `mintHash`, `rho` are public) and every change leaf
  (`rho_change` follows from the public nullifier; the amount from a small candidate set) for ownership by hashing —
  the whole history. It never leaves Rust.
- `nullifier(rho) = Poseidon3(TAG_NULL = 0x11, nk, rho)`.
- `commitment(amount, rho) = Poseidon5(TAG_CM = 0x10, addrField(d_self), amount, mintHash, rho)`, with the pinned
  `mintHash = be_mod_r(mint)`.
- **Deposit `rho(i)` (R1):** `be_mod_r(SHA-512("noctura/a0/deposit-rho/v1" ‖ nk as 32 bytes BE ‖ u64be(i)))`.
  - Reducing 512 bits modulo the 254-bit `r` leaves a bias below 2⁻²⁵⁰ (m1: 256 bits would leave a visible one).
  - It is wallet-only: no circuit sees how `rho` was chosen. It is not a Poseidon tag, so it cannot collide with a
    present or future circuit tag.
  - Without `nk` it is pseudorandom.
  - `i` is one sequence per `nk`, across every pool (the `["rho", rho]` PDA is global to the program).
- **Change note:** `rho_change = Poseidon3(TAG_RHO = 0x13, nullifier, 0)` and `changeAmount = inputAmount −
  withdrawAmount − fee` (§1; the golden vector of §15 confirms it). `be_mod_r` here and the program's `be_mod_f` are
  the same reduction: big-endian bytes modulo the BN254 scalar field order `r`.
- **ATA derivation (C1):** `ata = find_program_address([owner, TOKEN_PROGRAM_ID, mint], ASSOCIATED_TOKEN_PROGRAM_ID)`
  — SHA-256 over seeds ‖ bump ‖ program id ‖ `"ProgramDerivedAddress"`, bump from 255 down, refusing on-curve
  candidates (Ed25519 point decompression). The owner itself must be **on** the curve: a PDA owner is refused in M1, as
  no human recipient is one (m3).
- **Poseidon** (m12): a circomlib-parameter-compatible implementation — `light-poseidon` on the arkworks 0.4 family the
  crate already locks (`ark-ff 0.4.1`, `ark-bn254 0.4.0`), or an equivalent; the plan picks the version that resolves
  against the lock. A mismatch would fail closed at the prove compare but make recovery find nothing, hence §14's
  vectors and named mutation.

**JNI surface (the A0 freeze's interface, cut to M1):**

```
keysOpen(seed: bytes[64]) -> handle             // derives sk/nk/ivk/d_self/addrField; zeroizes the seed copy; opaque handle
keysClose(handle)                                // zeroizes; invalidates any live authorization
depositRho(handle, i) -> hex32                   // public once deposited
nullifier(handle, rhoHex) -> hex32               // public once spent; never sent anywhere before the spend
commitment(handle, amount, rhoHex) -> hex32      // an own note's commitment (d_self implicit)
prove(handle, circuit, witnessJson, authId?) -> {proofBytes, publicInputs}
parseUnshield(owner, amount, fee) -> {owner, ata, amount, fee, humanAmount, humanFee, pool}   // Kotlin only
authorizeUnshield(handle, owner, amount, fee) -> authId                                       // Kotlin only
```

- **The seed crosses as bytes, never as a string (C3).** JS copies its `Uint8Array` into a `number[]` for the bridge
  and fills both with 0 right after the call; Kotlin turns the `ReadableArray` into a `ByteArray`, passes a
  `jbyteArray`, and fills its `ByteArray` with 0 when the call returns; Rust copies it into a zeroizing buffer and
  wipes it once `sk` is derived. Stated limit: the copies the React Native bridge makes while serializing cannot be
  zeroized from either side. Seed-in-native removes them.
- **Handle lifetime (m5):** one handle per operation (a deposit, an unshield, a recovery run), closed in a `finally`,
  and also on session lock and on app background **unless** a native confirmation is in flight (then the confirmation's
  own lifecycle rule, §4, fails it closed and the close follows). A second `keysOpen` replaces the first and invalidates
  any live authorization. The handle dies with the process.
- **Rust state** is one `Mutex<{keys: Option<Keys>, auth: Option<Auth>}>`: `authorizeUnshield` runs on the UI thread's
  callback and `prove` on Kotlin's proving `Thread`, so neither may observe the other half-written. One authorization
  at a time.
- **`prove`:**
  - **Allow-list, not deny-list (I11).** Per circuit, the exact set of signal names JS may supply; any other key —
    `nk`, `d`, `change_d`, a public input Rust fills, a typo — refuses:
    - `deposit`: `{amount, depositIndex}`. Rust computes `rho = rho(depositIndex)`, `commitment(amount, rho)`, the
      pinned `mintHash`, and fills `nk`, `d = d_self`.
    - `withdraw_change`: `{merkleRoot, inputAmount, rho, pathElements[20], pathIndices[20]}`. Rust fills `nullifier =
      nullifier(rho)`, `withdrawAmount`, `fee` and `recipientField = be_mod_r(ata)` from the authorization, the
      pinned `mintHash`, `changeCommitment = commitment(inputAmount − withdrawAmount − fee, rho_change)`, `nk`,
      `d = change_d = d_self`; it refuses unless `withdrawAmount + fee ≤ inputAmount`.
    - The two lists, plus what Rust fills, are asserted in a test to equal the circuit's signal table (§1) and its
      `nPubInputs` / `nPrivInputs` counts, so an eliminated or constant-folded signal cannot hide.
  - For `withdraw_change`, it requires a live `authId` (§4); the authorization is consumed by the first prove, success
    or failure, and refused if expired, absent, or recorded under another handle.
  - The circuit's key files are read from paths JS supplies, but each is hashed and refused unless it matches the
    sha256 pinned in Rust (R4).
  - `witnessJson` (m4) carries private note data (`inputAmount`, `rho`, the path); it is never logged on either side.
- **Invariants (tests):**
  - INV-NK: the seed, `sk`, `nk`, `ivk`, `d_self` and every `addrField` never cross JNI, are never logged, are
    zeroized on `keysClose`, on replacement and on drop.
  - INV-AUTH: an unshield proof exists only for a `{owner, ata, amount, fee}` a human approved in the native dialog,
    once, within its expiry.

## 4. The native confirmation (S4)

1. JS asks the Kotlin module to confirm an unshield, passing the destination **owner** (base58 wallet address, never a
   token account), the amount (base units) and the fee — after the quote (§6.4), so the fee is the one that will be
   submitted.
2. **Rust parses and validates them (`parseUnshield`):**
   - the owner is 32 bytes of base58 and an on-curve Ed25519 point (m3);
   - Rust derives `ata = ATA(owner, pinned mint)` itself (§3);
   - the amount and fee are u64, the amount > 0, the fee within the pinned bounds; the note-level condition
     `amount + fee ≤ inputAmount` is checked at `prove` (§3), where `inputAmount` is bound by the Merkle proof;
   - the pool, mint and decimals are the pinned ones (R3).
3. Kotlin renders, in its own native dialog (not a React view):
   - the full owner address, never truncated (substitution attacks live in matching prefixes), labelled as the
     destination;
   - beneath it, smaller, the token account `ata`, labelled "token account";
   - "Destination receives exactly `<human amount>` NOC (`<base units>` base units)";
   - "Relayer fee `<human fee>` NOC, taken from your shielded balance" (I7: so the fee is not read as deducted from the
     amount);
   - the pool.

   The human amounts use the pinned decimals.
4. `BiometricPrompt` (`androidx.biometric`, a new dependency): a strong biometric or the device credential, matching
   the app's keychain setting, using the combination `androidx.biometric` supports at the device's API level (minSdk
   24); the plan names the per-API-level authenticator matrix. On success, Kotlin calls `authorizeUnshield`. Rust
   records `{owner, ata, amount, fee, pool, mint, handle, expiresAt = now + 120 s}` in native memory and returns an
   opaque `authId`, which carries no data JS could alter. Kotlin returns `{authId, owner, ata}` to JS; JS compares
   `ata` with its own `getAssociatedTokenAddressSync` result and aborts on a mismatch.
5. A cancel, a timeout (no approval within 60 s), a biometric failure or any rule below returns a refusal; nothing is
   recorded.

**Window and lifecycle rules (I10):**

- The dialog's window sets `FLAG_SECURE` (no screenshots, no recording, blank in recents).
- The approve control sets `filterTouchesWhenObscured`; on API 31+ the dialog also hides non-system overlay windows.
  A touch delivered while obscured is ignored (tapjacking is the standard attack on native confirmations).
- `currentActivity` null (the app is backgrounded) → refusal, no dialog. The activity recreated, paused or destroyed
  while the dialog or the prompt is up (rotation, system UI, a call) → the request fails closed; the user starts again.
- A single in-flight confirmation: a second request while one is pending is refused.
- `keysClose` or a second `keysOpen` invalidates a live `authId`.
- The dialog's strings live in an Android resource covered by the privacy-claims guard (§11).

**Accepted limits (stated, not hidden):**

- A compromised JS holds the seed in M1 and can bypass this dialog entirely (§2). The dialog is a control against
  mistakes and spoofing, not against compromise, until seed-in-native.
- Short of compromise, JS can still ask for a confirmation of a destination of its choosing. The user then sees that
  owner address in full on a native screen and has to approve it.

## 5. Shield (deposit)

1. The user enters an amount on #16 (shield side), from the selected transparent account (§10).
2. **Counter and pre-check (I2).** JS takes the next deposit counter `i` (one per `nk`, across pools: the highest `i`
   the note store knows, plus one) and calls `depositRho(i)`. It looks up `["rho", rho]` on chain:
   - absent → proceed with `i`;
   - present → this is **one of our own notes the store does not know** (a deposit that landed while the app died, or
     before a restore). JS imports it exactly as recovery does (§7, deposits step 2), then moves to `i+1` and checks
     again. A collision therefore never becomes a paid, rejected tx, and a lost note is found instead of skipped.
3. Rust computes the commitment (`commitment(amount, rho)`, R9); JS never holds `addrField`.
4. Rust proves the deposit circuit (`{amount, depositIndex: i}`). JS compares the returned public inputs, in order:
   `commitment` with Rust's `commitment()` return (the circuit's Poseidon against Rust's: two implementations),
   `amount` and `mintHash` with its own values, `rho` with `depositRho(i)`. A mismatch aborts.
5. **Before submitting**, JS writes the note as `{commitment, amount, rho, depositIndex: i, status: pending}`. Then it
   builds the `deposit` instruction (§1 layout, IDL account order, CU limit 200,000) and the existing confirmation flow
   signs it with the selected transparent account (#19 → #20 → #21). No authorization is needed: the circuit binds the
   note to the user's own `nk`, so a deposit cannot pay anyone else.
6. After confirmation on chain (the existing polling confirm, not a fixed wait), the note becomes `unspent` with the
   `leafIndex` and root read from the tx's `LeafInserted`; JS checks that event's commitment equals the note's.
7. **At startup**, every `pending` deposit is reconciled by its rho PDA: present → read the creating tx (§7 step 2) and
   mark it `unspent`; absent and the chain's block height past the deposit's `lastValidBlockHeight` (stored with the
   pending note) → drop the `pending` entry (its counter stays used).

## 6. Unshield (withdraw with change, relayed)

0. **Prerequisites (I5).** The relayer client goes through `pinnedFetch`, whose non-2xx handling was fixed in JS
   (`toRejectedResponse`, `src/modules/sslPinning/pinnedFetch.ts`) but has **never been verified on a device**. The
   first task of M1c is an on-device positive control: a deliberately malformed submit must surface `outcome:
   invalid_request` with HTTP 400 to JS, not a thrown network error. No outcome logic is written before it passes.
   The client appends bare paths to `API_BASE`, which already ends in `/v1` (`${API_BASE}/relayer/quote`, never
   `/v1/relayer/…`).
1. **Destination** (S3, S9):
   - **`slip10` wallets — default a fresh account**: the lowest `slip10` index not present in the account registry
     (§10) whose address has no history on the pool's cluster (`getSignaturesForAddress` empty on devnet — which says
     nothing about mainnet). It is added to the registry as `fresh-exit` only once the unshield lands;
   - "Another address", with a warning that it is a payment;
   - "My main account", with the warning "this links your exit to your deposit".
   - **`cli` wallets (S9):** no fresh account. The screen offers "Another address" and "My main account" (with the
     warning), no option is preselected, and it says why there is no new-account option (§11).
   - The destination is always a wallet address (the **owner**); the token account is derived from it (§4).
2. **Note:** the largest unspent note. The maximum is that note's amount minus the fee; the screen says so and says
   that combining notes comes with M2.
3. **Tree:** JS syncs pool `8VMe…`'s history (§9) and checks its root against the account's `rootHistory`. It
   computes the note's path.
4. **Quote:** `GET /relayer/quote`.
   - It is refused unless `programId`, `pool` and `mint` equal the pinned constants, `feePayer` is a valid key and
     `gasGrantLamports` (S6, §15 P1) is present and at least the rent-exempt minimum of a 0-byte account plus one
     signature fee.
   - The fee is **exactly** `minFee.withdraw_change` (R5); a `minFee` above `maxFee` stops with a clear message.
   - The quote's fetch time is recorded.
5. **Confirmation (§4)** for `{owner, amount, fee}` gives `{authId, owner, ata}`.
6. **Witness:** JS supplies exactly `{merkleRoot, inputAmount, rho, pathElements, pathIndices}`; Rust fills the rest
   (§3), checks the authorization and proves. JS compares the seven public inputs with what it can recompute:
   `merkleRoot` (its own), `nullifier` (the earlier `nullifier()` value), `withdrawAmount` and `fee` (its own),
   `recipientField` (its own `be_mod_r` of its own ATA derivation — independent of Rust's), `mintHash` (its own),
   `changeCommitment` (Rust's alone; JS cannot recompute it without `addrField`, and the chain's `LeafInserted` is the
   later check, step 8). A mismatch aborts.
7. **Order and freshness (I7):** quote → confirm → prove → submit. Just before submit, if the quote is older than
   `validForSeconds`, JS re-fetches it:
   - same `minFee`, `feePayer`, `gasGrantLamports` → submit the proof already made (the proof does not depend on the
     quote except through the fee);
   - any of them changed → discard the proof and go back to step 5: a **new confirmation** for the new fee, then a new
     proof. Nothing is submitted under a fee the user did not approve.
   - A `relay_failed` caused by the root falling out of the 64-entry history → re-sync, new path, new confirmation.

   **Submit:** kind `withdraw_change` with `destination = ata` and `destinationOwner = owner` (both from the
   authorization, so they agree by construction), `cuLimit` 200,000.
8. **Outcomes** (the frozen twelve):
   - `confirmed`: JS verifies **on chain** before marking anything spent (I13). It does not fetch the tx by the
     returned signature (that request would tell the RPC provider which exit is ours, I3): it runs the tree sync (§9),
     which fetches every new pool tx for everyone alike, takes the tx with the returned signature from it, and
     requires:
     - the tx calls program `FeGSS…` on pool `8VMe…` and carries our nullifier and our change commitment;
     - its fee payer is the quote's `feePayer`; its `fee_destination` is `ATA(feePayer, mint)`; its fee equals ours;
     - its `destination` is our `ata` and the token amount moved is ours;
     - exactly one system transfer of `gasGrantLamports` from `feePayer` to `owner` (S6);
     - **no signer of the tx is any key of this seed** (every registry entry, the main account, `cli` included), and
       the only key of the seed that appears at all is the destination owner (and its ATA).

     Only then is the note marked spent, the change note stored (leaf index from its `LeafInserted`, which must carry
     Rust's change commitment), and a fresh destination added to the registry as `fresh-exit`.
   - `unconfirmed`: the note becomes `pending`. JS reconciles **through the tree sync** (§9): a `Withdraw` carrying our
     nullifier → spent (and verified as above); none after 5 minutes of synced history past the submit → back to
     `unspent`. It never looks up the nullifier PDA or polls the signature (I3), and never resubmits blindly.
   - `already_spent`: reconcile through the tree sync the same way.
   - any outcome without `txSignature`: the note is untouched.
   - **Never a self-relay** (R6).
9. **Progress (#18):** real stages (sync, proof, submit, confirm), never a fixed 90 % or 100 %. This is the July lesson,
   where the progress hung at 90 %.
10. **The SOL grant (S6).** The fresh account receives the relayer's fixed `gasGrantLamports` in the unshield tx, so it
    can pay for its own transactions. The wallet never funds a `fresh-exit` account from another account of the seed —
    not automatically, and not as a suggestion in the UI. Until the program side ships §15 P1, the unshield is not
    available (no fallback).

## 7. Recovery from the seed

Recovery reads the pool's whole history through the same sync every client runs (§9) and matches it **locally**. It
makes no RPC request specific to one of our notes (I3; m7 does not arise).

- **Deposits:**
  1. From the synced history, collect the `rho` argument of every `deposit` tx. For `i = 0, 1, 2, …`, compute
     `depositRho(i)` and look for it in that set. Stop after 20 consecutive misses (the gap limit; deposits are
     sequential, so a gap only comes from a failed or abandoned tx).
  2. For each hit, read the creating tx (already synced): amount from the instruction, leaf index and commitment from
     `LeafInserted`, and check `commitment(amount, rho)` equals it.
  3. Spent if a synced `Withdraw` event carries `nullifier(rho)`.
- **Change notes:** for each spent note, its spending tx is the one whose `Withdraw` carried the nullifier (already
  synced). `rho_change = Poseidon3(TAG_RHO, nullifier, 0)` (JS can compute it: the nullifier is public), the amount is
  the input minus the instruction's `amount` minus its `fee`, the leaf index and commitment come from its
  `LeafInserted`, and `commitment(changeAmount, rho_change)` must equal that commitment. Recurse.
- **Accounts (I6, `slip10` wallets only):** each recovered unshield's `destination` token account is compared with
  `ATA(slip10:n, mint)` for `n = 0, 1, 2, …` (derived locally); a match adds `slip10:n` to the registry as
  `fresh-exit`. Stop after 20 consecutive indices without a match past the highest match. This is the wallet's own rule
  — the extension has no discovery rule — and it is local, so it reveals nothing to the RPC.
- The note store and the registry become caches: losing them loses nothing.

## 8. The note store

- **Fields:** `{commitment, amount, rho, depositIndex?, lastValidBlockHeight?, leafIndex?, status: pending | unspent |
  spent, spentTx?, pendingSince?}` (`lastValidBlockHeight` for a pending deposit, `pendingSince` for a pending unshield), all
  public or spend-irrelevant. No `noteSecret` and no diversifier: every own note is under `d_self`, which stays in Rust
  (R9).
- **Storage:** the encrypted MMKV instance, schema `v1_a0_notes`.
- **Old notes:** v1 notes (the old scheme) are not migrated; their schema is cleared on first A0 run in the devnet build.
  They were devnet test notes, and the program side abandoned that pool.

## 9. Tree sync

- **Source:** every transaction touching MerkleTree `5URd…` (deposits and unshields both write it), fetched in full,
  for every client alike, so the requests reveal nothing about which notes are ours. Parsed by discriminator for
  `LeafInserted` (exactly the 80-byte payload plus the 8-byte discriminator) and `Withdraw` (32 bytes plus the
  discriminator), plus the `deposit` / `withdraw_with_change` instruction arguments recovery needs. Nothing else is
  accepted (m8: the v1 `depositLegacy` discriminator goes).
- **Checks:**
  - the leaves are ordered by `leaf_index` with no gap;
  - the incremental root after each leaf equals the event's `root`;
  - the final root is in the account's `rootHistory`.
- On a mismatch, the sync refuses to build a path. It never proves against a root it could not reproduce.
- `zeros` / `emptyRoot` are computed by the wallet and compared with the account's `zeros @16`.
- The existing merkle and path code (`merkleSync`, `computeMerklePath`) is kept where it already matches A0 (depth 20,
  untagged Poseidon2 nodes). It is pointed at the new account and parser. Incremental sync (only transactions newer
  than the last synced one) is allowed; it is still the same request for everyone.

## 10. Minimal multi-account (S5, S9)

- **Derivation:** account `slip10:n` = `core/keys/transparent.ts` SLIP-0010 `m/44'/501'/{n}'/0'`, the same code the
  extension uses (`extension/src/vault/accounts.ts`), so `slip10:n` is the same address in both.
- **Registry (I6):** `v1_accounts` in the **encrypted** MMKV (a plaintext list of one's own accounts is itself a link —
  departure from rev 1's public MMKV). Entries are `TransparentScheme` strings (`slip10:n` | `cli`, the format
  `schemeToString` already writes) with a role, `main` | `fresh-exit`. The `main` entry is the scheme the wallet was
  created or imported with (`WALLET_TRANSPARENT_DERIVATION`), whatever it is — `slip10:3` is `slip10:3`, never
  renumbered.
- **Rules, as the extension's** (`extension/src/shared/envelopeRules.ts`, `extension/src/unlock/accountsFlow.ts`):
  - a `cli` wallet has exactly one account, its `main` (S9): no fresh accounts, and the account switcher shows that one;
  - `slip10` indices are integers in 0 … 2³¹ − 1, no two entries share one, at most 100 entries;
  - the fresh index is the lowest `slip10` index not in the registry, regardless of display position (as the
    extension's `lowestFreeIndex`), then the history check of §6.1.
  - The registry is not shared with the extension: an index the extension added is skipped here only by the history
    check.
- **UI:** the dashboard (#11) gains an account switcher: a list of accounts with SOL and token balances, labelled
  "Account N+1" (the extension's default name) plus "main" / "exit" tags; no editing. The selected account is the one
  Send, Receive and Shield use. Fresh accounts appear in it after their unshield lands.
- **Linking warning (C2):** a Send from any account of the seed to another account of the same seed, where either is
  `fresh-exit`, shows a warning before #19 ("Sending between your own accounts links them on chain"), and needs an
  explicit second tap. The wallet offers no "fund this account" shortcut.
- **Out:** names, renaming, hiding, reordering, adding accounts by hand, importing a private key.

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
- **Deferred, said loudly:** the shielded Receive (no valid A0 receive address exists until M2; the shielded option of
  Receive is hidden, §12) and the Export View Key screen (R10).
- **Copy (owner-delegated, D27; R10, R11).** No screen calls the exit "unlinkable", "untraceable" or "anonymous";
  privacy is described by who signs and what is public. The strings below are the rules; the plans may shorten them
  but not widen a claim:
  - any relayed unshield: "The relayer pays for and submits this transaction, so no key of yours signs it. Amounts and
    timing are public.";
  - the fresh-account default: "A new account of this wallet (Account N+1) receives it. The relayer also sends it
    `<g>` SOL so it can pay for its own transactions.";
  - "My main account": "This links your exit to your deposit: your main account made the deposit.";
  - "Another address": "This is a payment from your shielded balance. The recipient sees the amount.";
  - `cli` wallets (S9): "This wallet uses the Solana CLI key scheme, which has a single account, so no new account can
    be created for this exit.";
  - the amount line: "The destination receives exactly `<X>` NOC. The relayer fee of `<Y>` NOC comes out of your
    shielded balance.";
  - the one-note limit: "You can unshield up to `<max>` NOC from one note at a time; combining notes comes in a later
    version.";
  - **#17 explainer, who sees what (R11):** "The relayer that submits your unshield sees the request: the destination,
    the amount, the time and the network address it came from. The proof does not tell it which deposit is spent, but
    amounts and timing can hint at it. The RPC provider the app uses sees every request the app makes, including the
    balances of all your accounts. On chain, amounts and timing are public.";
  - Settings, Export View Key: "Not available in this version." (disabled row).
- **Measure, not boolean (I4):** where a screen speaks of the pool's privacy at all, it shows the anonymity set as a
  number (the pool's note count), never a yes/no.
- **The guard:** `src/screens/shielded/__tests__/privacyClaims.test.ts` stays green and its scope grows to every file
  carrying M1 copy: the shielded screens, any new screen directory M1 adds (the account switcher, the destination
  choice) and the Kotlin dialog's string resource. Its regexes are not relaxed.

## 12. Removals and build (R7, R8, I9)

- **Removed** (each line names the plan that removes it, §16):
  - every reference to `NPkc…` and the v1 instruction builders (`deposit` / `withdraw` / `transfer` v1,
    `withdrawWitness`, `transferWitness` v1, `depositWitness` v1) — M1b;
  - `noteSecret`, the v1 note schema, the v1 asset set and the hosted-proof client paths (`/zk/prove`, `/zk/warm`) —
    M1b;
  - the v1 `depositLegacy` event discriminator (m8) — M1b;
  - the old-scheme surfaces facing the user (I9): `primeViewSession`'s write of `WALLET_SHIELDED_ADDRESS` (the 87-char
    v1 address) and the shielded option of Receive that shows it; `noteScan`, `shieldedViewSession`,
    `shieldedIdentity`; the `ExportViewKey` screen and route (the Settings row stays, disabled, R10) — M1b;
  - the self-relay path and `FEATURES.shieldedRelayer` / `SHIELDED_RELAYER` (R6: never, so the code must not exist), and
    the unreferenced v1 lookup-table client `src/modules/solana/relayer.ts` (it also carries the double `/v1/v1/`
    path) — M1b;
  - `NocturaKeyModule` / `libnoctura_key.so` and its CMake / Gradle stanzas — M1a.
- **Hidden until its plan lands:** between M1b and M1c, #16's unshield side and the shielded transfer entry are hidden
  in the devnet build (their v1 flows are gone, the A0 one is not there yet).
- **Kept but unused in M1:** the M2 pieces that still match A0, such as `noteEncryption` (ECIES to `pk_enc_d`). They are
  revalidated in M2.
- **Build** (M1b unless tagged):
  - the devnet build sets `FEATURES_SHIELDED=true`, `LOCAL_PROVING=true` (and no longer `SHIELDED_RELAYER`);
  - the production build keeps shielded off. Its build inputs change (Gradle / CMake stanzas, a module, a dependency),
    so "unchanged" means **functionally** unchanged: every plan's checkpoint includes a production build of the same
    commit that launches on the phone (the libc++ lesson);
  - `assertShieldedRequiresLocalProving` stays;
  - `SHIELDED_CU`: deposit and `withdrawChange` ceilings stay at 200,000 for M1's paths; the provenance comment cites
    the program side's measurements (§1), not unmeasured figures (m9).
- **The Rust `.so`** (M1a): built for `arm64-v8a` only. The devnet shielded build is **phone-only** (m14): on any other ABI,
  emulators included, `isSupported()` is false and shielded is hidden. Adding `hkdf`, `bs58`, a Poseidon crate,
  `curve25519-dalek`, `zeroize` derive means a `Cargo.lock` update in the same PR (CI runs `--locked`). A **CI step**,
  not a note (m15), builds the arm64 `.so` and fails if `readelf -d` lists `libc++_shared.so` (or any C++ runtime)
  as `NEEDED`.

## 13. Out of M1 (M2 and later)

- **M2:** private transfer (2-in / 2-out with fee), scanning `NoteCiphertext` with `ivk` in native, the 166-character
  `noc1…` address (codec against the program side's rejection cases plus our own-encoder positive control),
  diversified receive addresses (`d ≠ d_self`), merging notes, the A0 `ivk` export question (R10).
- **Mandatory before mainnet (S7):** **seed-in-native** — the phrase decrypted and the seed derived inside the native
  boundary (Android Keystore; the iOS port with it), so no JS code ever holds the seed; only then is S4's confirmation
  a control against a compromised JS. It joins the existing mainnet blockers (ceremony, immutable VK, audit, the relayed
  exit as a launch gate).
- **Later:**
  - iOS (the native port is a prerequisite);
  - the ceremony (A1), the audit, an immutable VK, mainnet; on mainnet the relayer fee must cover the S6 grant;
  - a coordinator tree indexer if RPC log scanning becomes too slow.

## 14. Tests and gates

Each line is tagged with the plan that delivers it (§16).

- **Rust (M1a):**
  - EIP-2333 → `sk` against the EIP's own four published cases (seed → master → child, m11), never from this crate; and
    a test that `micro-key-producer/bls.js`'s `deriveSeedTree` at `m/12381/371/1/0` equals Rust's for a fixed seed (M2's
    web/extension derivations use that library; divergence would be silent);
  - `nk`, `ivk`, `addrField`, `nullifier`, `commitment` against values computed independently in JS from the frozen
    equations (`a0/fieldEquations.ts`, itself held to the a0 golden vectors); the Rust Poseidon against the a0 golden
    vectors, with a named mutation (one round constant changed → mismatch);
  - `rho(i)` and `d_self` against a JS reimplementation;
  - `derive_ata(owner)` equals `@solana/spl-token`'s derivation for at least three fixed owners; an off-curve owner is
    refused;
  - a proof of each circuit verifies against the VK the chain holds (read from chain, not `vk.json`); the 256-byte
    layout re-verified for A0 by parsing the proof bytes of the landed deposit `3DR6F7oW…` and verifying them with the
    on-chain `deposit_vk` (m10);
  - pinned-digest refusal, with a one-byte-changed key file;
  - authorization refusals (another owner, ATA, amount, fee; expired, reused, absent, from a closed or replaced handle;
    `amount + fee > inputAmount`) and the allow-list refusals (every Rust-filled name, an unknown name), with the
    allow-lists asserted against the signal table and `nPubInputs` / `nPrivInputs`;
  - zeroization (handle closed → no secret readable) and the seed wiped after `keysOpen`;
  - named mutations for each check.
- **JS:**
  - instruction data and account metas byte for byte against `relayer-a0-golden-vectors.json` (M1c), plus our own
    deposit encoding against the landed deposit `3DR6F7oW…` (M1b);
  - the tree sync against the real `5URd…` account (a recorded fixture) with root, gap and order controls, and the
    parser refusing any other discriminator or payload length (M1b);
  - the deposit `pending` → `unspent` path, a rho-PDA hit for an unknown counter importing the note, startup
    reconciliation (M1b);
  - deposit recovery on recorded fixtures (M1b); change-note and account recovery on recorded fixtures, and our
    recomputed change commitment against the program side's golden `changeCommitment` row (§15) (M1c);
  - every relayer outcome, the quote validation, the re-quote → re-confirm rule (M1c);
  - post-landing verification refusing a foreign pool, a foreign fee payer, a wrong `fee_destination`, a wrong fee, a
    wrong destination, a missing or wrong SOL grant, a missing nullifier, and **any signer that is a key of this seed**
    (M1c);
  - multi-account derivation equal to the extension's for `slip10:0..3`; the registry rules (`cli` single, lowest free
    index, no renumbering of `main`); the linking warning (M1c for the registry and fresh rule, M1d for the UI and the
    warning);
  - the privacy-claims guard over its widened scope (M1c).
- **Boundary (M1a for the native side, M1b for the JS source test, M1c for Kotlin):**
  - a JNI surface test that the `.so` exports exactly §3's functions, and that the React Native module exposes all of
    them **except** `parseUnshield` and `authorizeUnshield`;
  - a source test that no JS module outside `src/modules/keyDerivation/shielded.ts` imports `deriveSeedTree`, that no
    JS code passes `SHIELDED_PATHS.spend` (or the string `12381/371/1`) to a derive call (m6), and that no JS module
    imports anything that could return a secret;
  - Kotlin (M1c): a touch delivered with `FLAG_WINDOW_IS_OBSCURED` does not approve; a null `currentActivity` refuses;
    a second request while one is in flight refuses; activity recreation during the prompt fails closed.
- **On the phone (devnet), the acceptance:** the checkpoints of §16 in order — M1a (native proof on the phone), M1b
  (shield, wipe, restore), M1c (relayed unshield to a fresh account with the scripted checks, wipe, restore), M1d (send
  from the fresh account with the granted SOL only, the scripted history check). The scripted checks are the
  post-landing verifier's assertions run against devnet from a desk script, recorded with the signatures.
- All gates of the repo stay green: tsc, jest, lint, no-TGE-date, the privacy claims, and the native-prover workflow.

## 15. Dependencies and open points

- **Program side:**
  - **P1 — the S6 SOL grant (a change to the frozen relayer contract; required for M1c).** The wallet's exact proposal:
    - `destinationOwner` becomes **required** for kind `withdraw_change` (the wallet always sends it already).
    - In **every** relayed `withdraw_with_change`, the relayer adds one `SystemProgram.transfer` of exactly
      `gasGrantLamports` from `feePayer` to `destinationOwner`, before the pool instruction — whether or not the ATA
      existed, whoever the destination is, so every relayed unshield carries the same grant.
    - `GET /relayer/quote` gains `"gasGrantLamports": "<u64 decimal string>"`; like `minFee`, it is a deliberate config
      value, the same for every request, changed rarely and announced to the wallet side.
    - Proposed value: **3,000,000 lamports (0.003 SOL)** — the rent-exempt minimum of a 0-byte account (890,880) so the
      account can exist, plus one recipient ATA's rent (2,039,280) so its first send can create one, plus fees for a
      dozen signatures. The program side may pick another value; the wallet only requires it to be at least the
      rent-exempt minimum plus one signature fee (§6.4).
    - Size: about 20 bytes more when create-ATA is present (the owner and the system program are already in the tx),
      about 50 when it is not; under 1,232 either way (888 B today). The program side measures.
    - Cost and abuse: the grant counts against the relayer's spend cap; an exhausted cap answers `budget_exceeded` (no
      signature, nothing forwarded). Each grant costs the requester a deposit and `minFee`; on mainnet the fee must
      cover the grant (S6).
    - The twelve outcomes are unchanged.
  - **P2 — uniform create-ATA (proposed, not required).** Always prepend create-ATA-idempotent (a no-op when the ATA
    exists), so the instruction list is the same for every unshield. Limit, stated: the rent paid on a creation still
    shows in the balance changes, so "exit to a brand-new account" stays visible to a careful observer.
  - The A0 relayer announced live on devnet (`/relayer/submit` kind `withdraw_change`, `/relayer/quote`) with P1, and
    the relayer-landed golden vector sent to the wallet (their `93a82a5` names one, `3UfCx5TD…`).
  - The IDL `shielded_pool.json` committed or sent (M1b's first task needs it).
  - **The change-note equation confirmed (I8):** the `change rho` row of `gen-signal-table` for `withdraw_change`, and a
    golden `changeCommitment` row with its inputs (`nk` or a test `addrField`, `d`, the amounts, the nullifier) —
    needed for M1c's change-note recovery test; the landed `2mfMYnbt…` is checkable only with the test key's `nk`.

  M1a and M1b can be built and tested on the phone without P1 and the relayer; M1c cannot finish without them.
- **Owner:** none open after S1–S9. The rulings R1, R3–R11 are listed for the owner to overturn.

## 16. The four plans (S8)

Each plan gets its own plan document, its own Fable review before execution, and ends at an on-phone checkpoint on
devnet (arm64) that the owner sees before the next plan starts. Each checkpoint also builds the production APK of the
same commit and launches it on the phone. Every requirement of §§3–12 belongs to exactly one plan:

| plan | scope | depends on |
|---|---|---|
| **M1a — Rust core** | all of §3 (derivation incl. `d_self`, `rho(i)`, ATA, commitments, allow-lists, the authorization record and check, pinned keys, zeroization, `Mutex`, JNI surface); the Kotlin binding of every JNI function except `parseUnshield` / `authorizeUnshield`; the native removal of `NocturaKeyModule` / `libnoctura_key.so` (§12); `Cargo.lock`, the `readelf` CI step, arm64-only (§12); §14 Rust and native-boundary tests incl. the A0 proof-layout check (m10) | — |
| **M1b — deposit and recovery** | first task: decode the landed deposit against the IDL and §1 (I1); §5 (deposit, `pending` before submit, counter, rho pre-check, startup reconciliation); §7 deposits; §8; §9; #16 shield side, #18 deposit stages and #19–#21 wired to A0 (their look is already the design's; the data path and #18's stages change); every §12 removal tagged M1b, and hiding #16's unshield side until M1c | M1a |
| **M1c — confirmation and relayed unshield** | first task: the `pinnedFetch` on-device control (§6.0); §4 (dialog, `androidx.biometric`, window and lifecycle rules); §6 (destination incl. S9, quote, order, submit, outcomes, verifier with the no-signer check, grant); §7 change notes and accounts; §10 registry, its rules and the fresh rule; #16 unshield side, the destination choice and the warnings (undrawn: built from the design system); the guard's widened scope (§11) | M1b; §15 P1 and the live relayer; §15's change-note vector |
| **M1d — multi-account and the remaining screens** | §10 UI (the account switcher, balances, the selected account for Send / Receive / Shield) and the linking warning; #11 with mode = shielded; #17 with the who-sees-what copy (R11); the owner's visual pass over every undrawn surface of M1c and M1d | M1c |

**Checkpoints (in the acceptance order: deposit → restore → unshield → use):**

- **M1a:** on the phone, through a harness that is not in the devnet APK's release variant (the plan picks an Android
  instrumented test or a debug-only screen): `keysOpen` with the repo's test seed, `depositRho(0)`, `commitment()`, and
  a deposit proof whose public inputs equal the desk values and verify against the deposit VK read from chain; a
  `withdraw_change` prove without an `authId` refuses. `isSupported()` true on the phone.
- **M1b:** shield an amount from the main account (deposit signed by it); the note shows `unspent` with the leaf index
  of its `LeafInserted`. Wipe the app, restore from the phrase: the shielded balance returns from the chain, with no
  RPC request naming the note. Kill the app between the deposit's submit and its confirmation once: at the next start
  the note is reconciled, not lost.
- **M1c:** unshield part of the deposit to a fresh account through the relayer. The desk script, from the signature,
  asserts every §6.8 condition — above all, no signer of the tx is a key of this seed — and that the fresh account
  holds the token amount and exactly `gasGrantLamports`. Wipe and restore: the change note and the fresh account come
  back. The owner's visual pass of the destination choice, the warnings and the native dialog. (A `cli` wallet's
  unshield to "Another address" is exercised once with a second phrase.)
- **M1d:** switch to the fresh account and send from it to a devnet address outside this seed, paying only from the
  granted SOL. The desk script asserts the fresh account's history is exactly {the relayed unshield, this send} and
  that no transaction connects it to another account of the seed. The linking warning appears when a send from it to
  the main account is started (and is cancelled, not sent). The owner's visual pass of the account switcher, #11 and
  #17.
