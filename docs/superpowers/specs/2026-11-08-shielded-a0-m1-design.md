# Shielded on A0 · Milestone 1 — shield and a private unshield on the deployed A0 pool (Android, devnet)

**Status:** rev 3.1, 2026-11-08 — the program side's acceptance of P1/P2. Rev 3 (03c866e) was Fable review 2 + owner
S10–S12, rulings R12–R13. Rev 2 (00e58fe) was Fable review 1 +
owner decisions S6–S9, controller rulings R9–R11. Rev 1 (58c0c7a) was the design the owner approved in conversation
section by section (the milestone split, `nk` in the Rust prover, the unshield destinations, the native confirmation in
this milestone, a minimal multi-account in the app; then the architecture, the data flow and the test / scope
sections). Review 1 (`.superpowers/sdd/shielded-a0-m1-spec-review-1.md`) found 4 Critical, 13 Important and 15 Minor
issues; review 2 (`…-spec-review-2.md`) found 1 Critical, 8 Important and 10 Minor. Decisions and rulings:
`.superpowers/sdd/shielded-a0-m1-decisions.md`. The program-side proposal text (P1, P2) is
`.superpowers/sdd/shielded-a0-m1-ico-proposal.md`. Next: the owner; then the four plans of §16, each with its own
Fable review.

### Rev 3.1 — the program side's acceptance of P1/P2 (text only)

- P1 and P2 marked **ACCEPTED** (2026-11-08), pending the program side's "live on devnet" announcement and two new
  golden vectors (existing-ATA, fresh-owner); the frozen-contract facts note it → §1, §15, S12 row.
- Measured rent replaces rev 3's figures where the spec quoted them: 0-byte account 650,240 (was 890,880), ATA
  1,488,440 (was 2,039,280); the relayer-landed size is 994 bytes (rev 3's 888 was wrong), the grant adds about 17 →
  §15 P1, P2. The coordinator's cost constants stay at the old rent, as theirs (an over-count) → §15 P1.
- The wallet's quote lower bound restated as a formula, `rentExempt(0) + 5,000` = 655,240 today (was 895,880) → §6.4.
- ADDITION 1: no grant to an off-curve `destinationOwner`; the wallet's own destinations are on curve; the verifier
  accepts a 0-lamport off-curve owner without a grant → §6.8, §15 P1.
- ADDITION 2: the verifier counts `SystemProgram.transfer` among top-level instructions only → §6.8, §15 P1.
- `destinationOwner` required (else `invalid_request`) → §15 P1.
- Mainnet: no grant until a priced bound, so the fresh-account option is devnet-only for now → §0 scope note, §6.1,
  §6.4, §11, §13, §15 P1.
- P2's limit as the program side states it (two shapes: grant ⇔ 0-lamport on-curve owner) → §15 P2.
- The fee payer topped up to 5 SOL (done by the program side) → §15 P1.

### Rev 3 — what changed, finding by finding

- **C-1** (P1 is a SOL faucet on mainnet): S10 — the grant goes only to a destination owner holding 0 lamports, at most
  once per key (atomic marker); the four coordinator config changes listed and the devnet cost re-sized; the verifier
  checks the decoded instruction against the owner's pre-balance → §6.4, §6.8, §13, §15 P1.
- **I-1** (M1c blocked on P1): S11 — "Another address" and "My main account" ship against the frozen contract; the
  fresh-account default switches on only when the quote carries `gasGrantLamports` → §6.1, §6.4, §11, §16 M1c.
- **P2**: S12 — a firm proposal (always prepend create-ATA-idempotent) with its stated limit → §15 P2, §6.8.
- **I-2** (what the sync retains): a per-tx `SyncedTx` record, cached with the notes, built in full by M1b; `confirmed`
  retries the sync a bounded number of times; "5 minutes past submit" defined on chain time → §9, §6.8.
- **I-3** (unmeasurable M1b claim): a JS test with a recording `Connection` mock; the phone step is "balance returns"
  → §14, §16 M1b.
- **I-4** (counter reuse): a monotone `nextDepositIndex` in the note store's metadata → §5.2, §5.7, §8.
- **I-5** (fresh index reserved late): a `fresh-pending` role, reserved at selection → §6.1, §6.8, §10.
- **I-6** (bls.js vector vs the source test): the vector is produced offline by a script under `scripts/`, committed,
  and the source test's scope excludes `scripts/` → §14.
- **I-7** (pre-spend nullifier in JS): R12 — `nullifier()` leaves the JNI surface; Rust's `matchSpent` matches synced
  nullifiers against own notes → §3, §5, §6.6, §6.8, §7, §8, §14.
- **I-8** (P1's config consequences): the four coordinator changes, sizes and the top-up listed → §15 P1.
- **R13** (restore cost): accepted on devnet; the indexer trigger stated and measured at M1b → §7, §13, §16 M1b.
- **Minors:** m-1 → §6.4 (grant ceiling); m-2 → §6.8 (decoded instruction, not balance deltas); m-3 → §3, §4 (fee
  sanity ceiling, not `max_fee`); m-4 → §6.6; m-5 → §14; m-6 → §4 step 4; m-7 → §10 (checked: the extension's
  `addAccount` names an account `` `Account ${index + 1}` ``); m-8 → §12 (corrected: `DashboardScreen.tsx` imports
  `noteScan`, `store/zustand/sessionStore.ts` imports `shieldedViewSession`; neither imports `shieldedIdentity`);
  m-9 → §10 (checked: `lowestFreeIndex` is exported by `extension/src/unlock/accountsFlow.ts`); m-10 → §2.
- **New in rev 3, not from the review:** the `unconfirmed` timeout is defined on a sync that completes after the
  chain's clock passes submit + 300 s, so it also resolves on a quiet pool where no later pool tx exists (review 2's
  "a synced tx with `blockTime ≥ …`" would wait forever there) → §6.8; two concurrent submits to the same 0-lamport
  owner would both be granted without an atomic marker → §15 P1; review 2's "Option A removes chaining entirely" holds
  only for one owner — an attacker using a new key per unshield still draws a grant per key from one deposit's change
  chain, so on devnet the spend cap is the bound and on mainnet a priced bound is a pre-mainnet decision → §15 P1
  "What S10 bounds", §13.

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
   amount and the relayer's one-time SOL grant (S6, S10: a fresh account holds 0 lamports, so it is granted).
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

**Scope note (rev 3.1): the fresh-account exit is devnet-only for now.** The program side accepted P1 (§15) with **no
grant on mainnet** until a priced bound is agreed, so on mainnet the quote carries no `gasGrantLamports` and the
wallet's fresh-account option is disabled there (§6.1, §11). M1 itself is devnet-only (R8); this note is for whoever
takes shielded to mainnet: until that bound exists, a mainnet unshield goes to "Another address" or "My main account".

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
| S10 | *(review 2 C-1)* **The relayer grants SOL only when the destination owner holds 0 lamports** — at most one grant per fresh key. The cost and abuse are bounded by the coordinator's spend cap; P1 lists the coordinator config changes. | §6.4, §6.8, §15 |
| S11 | *(review 2 I-1)* **M1c ships "Another address" and "My main account" against the frozen contract**; the fresh-account default switches on only when the quote carries the grant. | §6.1, §16 |
| S12 | *(review 2 Q3)* **P2 is proposed:** the relayer always prepends create-ATA-idempotent, so every unshield has the same instruction list. *(Rev 3.1: P1 and P2 accepted by the program side, pending their "live" announcement.)* | §15 |

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
| R12 | *(review 2 I-7)* **JS never holds an own note's nullifier before it is spent.** Rust matches the nullifiers seen in synced `Withdraw` events against the own notes (`matchSpent(handle, chainNullifiers, ownRhos) -> indices`); a spent note's nullifier is public after the fact. | §3, §7 |
| R13 | *(review 2 Q4)* **Full-history restore cost accepted on devnet.** The indexer trigger: a restore that reads more than 5,000 tree transactions, or takes over 60 s on the acceptance phone, makes a coordinator indexer a pre-mainnet item. | §7, §13 |

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
    *(As frozen. P1 and P2, accepted on 2026-11-08 and pending the "live on devnet" announcement, make
    `destinationOwner` required, prepend create-ATA-idempotent always, and add the grant — §15.)*
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
| **Rust** (`native/noctura-prover`, `libnoctura_prover.so`, JNI) | the seed → `sk` → `nk` → `ivk`, `d_self`, `addrField` derivation; deposit `rho(i)`; `nullifier(rho)` and matching it against synced nullifiers (R12); own-note commitments; `ATA(owner, mint)`; witness completion (everything but the JS allow-list); the authorization record and check; proving with pinned keys; zeroization | return `sk` / `nk` / `ivk` / `d_self` / `addrField`, or an own note's nullifier outside a proof's public inputs; read the network; accept an unpinned key file |
| **Kotlin** (`NocturaProverModule` + a confirmation dialog) | showing the owner, the token account, the amount and fee that Rust parsed; `BiometricPrompt`; asking Rust to record a single-use authorization | take display values from JS; expose `authorizeUnshield` to JS |
| **JS** (`src/modules/shielded/*`) | chain I/O (tree sync, the rho-PDA pre-check, deposit tx build and signing with the transparent key), the allow-listed part of the witness, the relayer client, post-landing verification, the note store (public fields only), recovery, multi-account | hold or compute anything from `sk` / `nk` / `ivk` / `addrField` / `d_self`; hold an unspent note's nullifier outside an unshield in flight (§3) |
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
  submits — not which deposit it spends. Beyond the request's origin and time it sees the same public data as anyone
  (the nullifier and change commitment are on chain once the tx lands).
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
matchSpent(handle, chainNullifiers[], ownRhos[]) -> indices[]   // which own notes a set of synced nullifiers spends (R12)
commitment(handle, amount, rhoHex) -> hex32      // an own note's commitment (d_self implicit)
prove(handle, circuit, witnessJson, authId?) -> {proofBytes, publicInputs}
parseUnshield(owner, amount, fee) -> {owner, ata, amount, fee, humanAmount, humanFee, pool}   // Kotlin only
authorizeUnshield(handle, owner, amount, fee) -> authId                                       // Kotlin only
```

- **No pre-spend nullifier in JS (R12, I-7).** There is no `nullifier()` call. Spent-status comes from
  `matchSpent`, which recomputes `nullifier(rho)` for each own `rho` inside Rust and returns the indices of the own notes
  whose nullifier is in `chainNullifiers` (the synced `Withdraw` nullifiers, public by then). The one place an unspent
  note's nullifier reaches JS is the unshield in flight: it is public input [1] of the proof `prove` returns, and the
  relayer payload JS sends must carry it. From `prove` to the end of that unshield it lives only in memory — never
  persisted (a `pending` note keeps its `rho`, not its nullifier), never logged, never sent to the RPC — and is dropped
  when the unshield ends. A pre-spend nullifier is a forward link to the future exit; this keeps it as short-lived as
  the protocol allows.
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
      nullifier(rho)` (internally), `withdrawAmount`, `fee` and `recipientField = be_mod_r(ata)` from the authorization, the
      pinned `mintHash`, `changeCommitment = commitment(inputAmount − withdrawAmount − fee, rho_change)`, `nk`,
      `d = change_d = d_self`; it refuses unless `withdrawAmount + fee ≤ inputAmount`.
    - The JS allow-lists use API names (`depositIndex`), not signal names. The test (m-5) asserts that
      *mapped(JS allow-list) ∪ Rust-filled = the circuit's signal table* (§1) — `depositIndex` maps to `rho` — and that
      the counts equal `nPubInputs` / `nPrivInputs`, so an eliminated or constant-folded signal cannot hide.
  - For `withdraw_change`, it requires a live `authId` (§4); the authorization is consumed by the first prove, success
    or failure, and refused if expired, absent, or recorded under another handle.
  - The circuit's key files are read from paths JS supplies, but each is hashed and refused unless it matches the
    sha256 pinned in Rust (R4).
  - `witnessJson` (m4) carries private note data (`inputAmount`, `rho`, the path); it is never logged on either side.
- **Invariants (tests):**
  - INV-NK: the seed, `sk`, `nk`, `ivk`, `d_self` and every `addrField` never cross JNI, are never logged, are
    zeroized on `keysClose`, on replacement and on drop.
  - INV-NULL: no JNI call returns an own note's nullifier except as a public input of a `withdraw_change` proof.
  - INV-AUTH: an unshield proof exists only for a `{owner, ata, amount, fee}` a human approved in the native dialog,
    once, within its expiry.

## 4. The native confirmation (S4)

1. JS asks the Kotlin module to confirm an unshield, passing the destination **owner** (base58 wallet address, never a
   token account), the amount (base units) and the fee — after the quote (§6.4), so the fee is the one that will be
   submitted.
2. **Rust parses and validates them (`parseUnshield`):**
   - the owner is 32 bytes of base58 and an on-curve Ed25519 point (m3);
   - Rust derives `ata = ATA(owner, pinned mint)` itself (§3);
   - the amount and fee are u64, the amount > 0, the fee ≤ a sanity ceiling pinned in Rust (1,000,000 base units —
     not `pool.max_fee`, which the pool authority can change with `set_max_fee`; the chain enforces that one) (m-3);
     the note-level condition
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
   records `{owner, ata, amount, fee, pool, mint, handle, expiresAt = approval time + 120 s}` (the clock starts at the
   biometric approval, not when the dialog opened, m-6) in native memory and returns an
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
2. **Counter and pre-check (I2, I-4).** JS takes `i = nextDepositIndex` from the note store's metadata (§8): one
   monotone counter per `nk`, across pools, which only ever increases — it is incremented when a counter is used, and
   a dropped `pending` deposit does not give its counter back. JS calls `depositRho(i)`. It looks up `["rho", rho]` on chain:
   - absent → proceed with `i`;
   - present → this is **one of our own notes the store does not know** (a deposit that landed while the app died, or
     before a restore). JS imports it exactly as recovery does (§7, deposits step 2), sets `nextDepositIndex = i + 1`
     and checks again. A collision therefore never becomes a paid, rejected tx, and a lost note is found instead of skipped.
3. Rust computes the commitment (`commitment(amount, rho)`, R9); JS never holds `addrField`.
4. Rust proves the deposit circuit (`{amount, depositIndex: i}`). JS compares the returned public inputs, in order:
   `commitment` with Rust's `commitment()` return (the circuit's Poseidon against Rust's: two implementations),
   `amount` and `mintHash` with its own values, `rho` with `depositRho(i)`. A mismatch aborts.
5. **Before submitting**, JS writes the note as `{commitment, amount, rho, depositIndex: i, lastValidBlockHeight,
   status: pending}` and sets `nextDepositIndex = i + 1` in the same write. Then it
   builds the `deposit` instruction (§1 layout, IDL account order, CU limit 200,000) and the existing confirmation flow
   signs it with the selected transparent account (#19 → #20 → #21). No authorization is needed: the circuit binds the
   note to the user's own `nk`, so a deposit cannot pay anyone else.
6. After confirmation on chain (the existing polling confirm, not a fixed wait), the note becomes `unspent` with the
   `leafIndex` and root read from the tx's `LeafInserted`; JS checks that event's commitment equals the note's.
7. **At startup**, every `pending` deposit is reconciled by its rho PDA: present → read the creating tx (§7 step 2) and
   mark it `unspent`; absent and the chain's block height past the deposit's `lastValidBlockHeight` (stored with the
   pending note) → drop the `pending` entry; `nextDepositIndex` is not lowered, so the counter is never reused (reuse
   would be safe — that `rho` never reached the chain — but one rule is easier to hold than two).

## 6. Unshield (withdraw with change, relayed)

0. **Prerequisites (I5).** The relayer client goes through `pinnedFetch`, whose non-2xx handling was fixed in JS
   (`toRejectedResponse`, `src/modules/sslPinning/pinnedFetch.ts`) but has **never been verified on a device**. The
   first task of M1c is an on-device positive control: a deliberately malformed submit must surface `outcome:
   invalid_request` with HTTP 400 to JS, not a thrown network error. No outcome logic is written before it passes.
   The client appends bare paths to `API_BASE`, which already ends in `/v1` (`${API_BASE}/relayer/quote`, never
   `/v1/relayer/…`).
1. **Destination** (S3, S9, S11):
   - **`slip10` wallets — a fresh account, the default once the relayer grants SOL**: the lowest `slip10` index not
     present in the account registry (§10, any role) whose address has no history on the pool's cluster
     (`getSignaturesForAddress` empty on devnet — which says nothing about mainnet). **It is reserved at selection**
     (I-5): the registry gains it with role `fresh-pending` when the user proceeds to the confirmation, so a second
     unshield started meanwhile picks the next index. Promoted to `fresh-exit` when the unshield lands (step 8);
     removed when the unshield is known not to have landed (an outcome without `txSignature`, or an `unconfirmed`
     resolved as not landed).
   - **Until the quote carries `gasGrantLamports` (S11)** — before P1 is live on devnet, and on mainnet until a priced
     bound exists (§0 scope note) — the fresh-account option is shown disabled with its reason
     (§11), no option is preselected, and the user picks one of the two below. A fresh account without SOL could only
     be used after a funding tx from another account of the seed — the re-link S6 exists to avoid — so it is not
     offered half-way.
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
   - It is refused unless `programId`, `pool` and `mint` equal the pinned constants and `feePayer` is a valid key.
   - `gasGrantLamports` (S6, S10, §15 P1) is **optional** in the frozen contract and becomes present once P1 ships.
     When present it must satisfy `rentExempt(0) + 5,000 ≤ gasGrantLamports ≤ 50,000,000`, or the quote is refused:
     `rentExempt(0)` is the cluster's `getMinimumBalanceForRentExemption(0)` (a generic request, nothing in it is about
     a note; 650,240 lamports as the program side measured it on 2026-11-08), 5,000 is one signature fee, so the lower
     bound is **655,240** today — the least that lets the account exist and sign once; 50,000,000 (0.05 SOL) is a
     sanity ceiling (m-1). When absent — before P1 is live, and on mainnet until a priced bound exists (§15 P1) — the
     fresh-account option is disabled (step 1).
   - The fee is **exactly** `minFee.withdraw_change` (R5); a `minFee` above `maxFee` stops with a clear message.
   - The quote's fetch time is recorded.
5. **Confirmation (§4)** for `{owner, amount, fee}` gives `{authId, owner, ata}`.
6. **Witness:** JS supplies exactly `{merkleRoot, inputAmount, rho, pathElements, pathIndices}`; Rust fills the rest
   (§3), checks the authorization and proves. JS compares the public inputs it can recompute: `merkleRoot` (its own),
   `withdrawAmount` and `fee` (its own), `recipientField` (its own `be_mod_r` of its own ATA derivation — independent
   of Rust's), `mintHash` (its own). Two it cannot (m-4): `nullifier` (JS holds no pre-spend nullifier, R12 — it is
   checked when the tx lands, by `matchSpent` over the tx's `Withdraw`, step 8) and `changeCommitment` (JS has no
   `addrField`, R9 — its **only** independent check is the landed `LeafInserted`, step 8). A mismatch aborts.
7. **Order and freshness (I7):** quote → confirm → prove → submit. Just before submit, if the quote is older than
   `validForSeconds`, JS re-fetches it:
   - same `minFee`, `feePayer`, `gasGrantLamports` (or its absence) → submit the proof already made (the proof does not
     depend on the quote except through the fee);
   - any of them changed → discard the proof and go back to step 5: a **new confirmation** for the new fee, then a new
     proof. Nothing is submitted under a fee the user did not approve.
   - A `relay_failed` caused by the root falling out of the 64-entry history → re-sync, new path, new confirmation.

   **Submit:** kind `withdraw_change` with `destination = ata` and `destinationOwner = owner` (both from the
   authorization, so they agree by construction), `cuLimit` 200,000. Just before submit JS records `submitChainTime`:
   the `blockTime` of the cluster's current slot (`getSlot` then `getBlockTime`; a generic request, nothing in it is
   about this note), so step 8's timeout runs on the chain's clock, not the phone's.
8. **Outcomes** (the frozen twelve):
   - `confirmed`: JS verifies **on chain** before marking anything spent (I13). It does not fetch the tx by the
     returned signature (that request would tell the RPC provider which exit is ours, I3): it runs the tree sync (§9),
     which fetches every new pool tx for everyone alike, and takes the `SyncedTx` with the returned signature from it.
     RPC lag (I-2): if the signature is not yet in the sync, the sync is retried up to 10 times, 3 s apart; still
     absent → handled as `unconfirmed`. From the `SyncedTx`, it requires:
     - the tx calls program `FeGSS…` on pool `8VMe…`; `matchSpent` over its `Withdraw` nullifier returns the note being
       spent; its `LeafInserted` carries Rust's change commitment;
     - its fee payer is the quote's `feePayer`; its `fee_destination` is `ATA(feePayer, mint)`; its fee equals ours;
     - its `destination` is our `ata` and the token amount moved is ours;
     - **the grant (S10, m-2)**, checked on the decoded `SystemProgram.transfer` instructions **among the tx's top-level
       instructions only** (the program side's ADDITION 2: the ATA program and `FeGSS…` call the system program
       internally — rent for the ATA and the nullifier record — and those inner calls are not counted), never on balance
       deltas (the fee payer's delta also carries the ATA rent, the nullifier rent and the tx fee): at most one top-level
       `SystemProgram.transfer`; if there is one, it is exactly `gasGrantLamports` of the quote, from `feePayer` to
       `owner`, the owner's pre-balance in the tx was 0 and the owner is on the Ed25519 curve — any other top-level
       transfer refuses. A 0-lamport owner **without** a grant is accepted — off curve (ADDITION 1: the relayer never
       grants one; the wallet itself never sends one, §3), or withheld by P1's per-owner marker — but for a
       `fresh-pending` destination it is reported: the exit is recorded (the funds are ours) and the account is shown
       as holding no SOL — the wallet still never funds it;
     - any create-ATA-idempotent instruction is exactly `(payer feePayer, ata, owner, mint)` — absent or present until
       P2 is announced live, then required;
     - **no signer of the tx is any key of this seed** (every registry entry, the main account, `cli` included), and
       the only key of the seed that appears at all is the destination owner (and its ATA).

     Only then is the note marked spent, the change note stored (leaf index from its `LeafInserted`), and a
     `fresh-pending` destination promoted to `fresh-exit`.
   - `unconfirmed`: the note becomes `pending` with `pendingSince = submitChainTime`. JS reconciles **through the tree
     sync** (§9): a `Withdraw` that `matchSpent` attributes to the note → spent (and verified as above); otherwise,
     once a sync **completes** after the chain's clock (`blockTime` of the current slot, as at submit) has passed
     `pendingSince + 300 s`, without such a `Withdraw` → not landed (the relayer's blockhash has expired by then, so it
     cannot land later): back to `unspent`, and a `fresh-pending` reservation is removed. This resolves on a quiet pool
     too, where no later pool tx exists. It never looks up the nullifier PDA or polls the signature (I3), and never
     resubmits blindly.
   - `already_spent`: reconcile through the tree sync the same way.
   - any outcome without `txSignature`: the note is untouched; a `fresh-pending` reservation is removed.
   - **Never a self-relay** (R6).
9. **Progress (#18):** real stages (sync, proof, submit, confirm), never a fixed 90 % or 100 %. This is the July lesson,
   where the progress hung at 90 %.
10. **The SOL grant (S6, S10).** A fresh account holds 0 lamports, so the relayer grants it `gasGrantLamports` in the
    unshield tx, once, and it can pay for its own transactions. The wallet never funds a `fresh-exit` account from
    another account of the seed — not automatically, and not as a suggestion in the UI. Until the program side ships
    §15 P1, "Another address" and "My main account" work and the fresh-account option is disabled (S11); there is no
    fallback that funds it.

## 7. Recovery from the seed

Recovery reads the pool's whole history through the same sync every client runs (§9) and matches it **locally**. It
makes no RPC request specific to one of our notes (I3; m7 does not arise).

- **Deposits:**
  1. From the synced history, collect the `rho` argument of every `deposit` tx. For `i = 0, 1, 2, …`, compute
     `depositRho(i)` and look for it in that set. Stop after 20 consecutive misses (the gap limit; deposits are
     sequential, so a gap only comes from a failed or abandoned tx).
  2. For each hit, read the creating tx (already synced): amount from the instruction, leaf index and commitment from
     `LeafInserted`, and check `commitment(amount, rho)` equals it.
  3. Spent-status for every own note at once: `matchSpent(handle, allSyncedWithdrawNullifiers, ownRhos)` (R12); JS
     never computes or holds an own nullifier to look for.
- **Change notes:** for each spent note, its spending tx is the `SyncedTx` whose `Withdraw` nullifier `matchSpent`
  attributed to it (already synced; that nullifier is public now). `rho_change = Poseidon3(TAG_RHO, nullifier, 0)` (JS can compute it: the nullifier is public), the amount is
  the input minus the instruction's `amount` minus its `fee`, the leaf index and commitment come from its
  `LeafInserted`, and `commitment(changeAmount, rho_change)` must equal that commitment. Recurse.
- **Accounts (I6, `slip10` wallets only):** each recovered unshield's `destination` token account is compared with
  `ATA(slip10:n, mint)` for `n = 0, 1, 2, …` (derived locally); a match adds `slip10:n` to the registry as
  `fresh-exit`. Stop after 20 consecutive indices without a match past the highest match. This is the wallet's own rule
  — the extension has no discovery rule — and it is local, so it reveals nothing to the RPC.
- The note store and the registry become caches: losing them loses nothing.
- **Cost (R13).** A restore reads the pool's whole history: one `getSignaturesForAddress` page walk over `5URd…` and a
  `getTransaction` per pool tx (a few dozen on devnet today). Accepted for devnet. **The indexer trigger:** a restore
  that reads more than 5,000 tree transactions, or takes more than 60 s on the acceptance phone, makes a coordinator
  tree indexer a pre-mainnet item (§13). M1b's checkpoint records both numbers (§16).

## 8. The note store

- **Fields:** `{commitment, amount, rho, depositIndex?, lastValidBlockHeight?, leafIndex?, status: pending | unspent |
  spent, spentTx?, pendingSince?}` (`lastValidBlockHeight` for a pending deposit, `pendingSince` — chain time — for a
  pending unshield), all public or spend-irrelevant. No `noteSecret`, no diversifier (every own note is under `d_self`,
  which stays in Rust, R9) and no nullifier of an unspent note (R12).
- **Metadata (I-4):** `nextDepositIndex`, the monotone deposit counter of §5.2 — never lowered, not even when a
  `pending` deposit is dropped; after a restore it is the highest recovered `depositIndex` + 1.
- **Storage:** the encrypted MMKV instance, schema `v1_a0_notes` (and the `SyncedTx` cache of §9 beside it).
- **Old notes:** v1 notes (the old scheme) are not migrated; their schema is cleared on first A0 run in the devnet build.
  They were devnet test notes, and the program side abandoned that pool.

## 9. Tree sync

- **Source:** every transaction touching MerkleTree `5URd…` (deposits and unshields both write it), fetched in full,
  for every client alike, so the requests reveal nothing about which notes are ours. Parsed by discriminator for
  `LeafInserted` (exactly the 80-byte payload plus the 8-byte discriminator) and `Withdraw` (32 bytes plus the
  discriminator), plus the `deposit` / `withdraw_with_change` instruction arguments recovery needs. Nothing else is
  accepted (m8: the v1 `depositLegacy` discriminator goes). Only successful transactions are kept; event blobs are
  admitted only from the pool program's own instruction on this tree (the existing per-instruction scoping of
  `eventLogs`).
- **Every spend is in it.** Each A0 spend (`withdraw_with_change`, and M2's `transfer`) writes `merkle_tree` and emits
  its `LeafInserted` and spend event in the same instruction, so this one history is complete for spent-status and for
  the `confirmed` check (review 2 §2).
- **What it retains, per transaction (I-2): the `SyncedTx` record.** M1b builds it in full, so M1c does not re-open
  the sync:
  - `signature`, `slot`, `blockTime`;
  - `signers[]`, `feePayer`;
  - `leafInserted[]`: `{commitment, leafIndex, root}`;
  - `withdrawNullifiers[]`;
  - for a `deposit`: its decoded arguments `{amount, commitment, rho}` and its `depositor`;
  - for a `withdraw_with_change`: its decoded arguments `{merkleRoot, nullifier, amount, changeCommitment, fee}`, its
    `destination` token account and its `fee_destination`;
  - the top-level `SystemProgram.transfer` instructions, decoded `{from, to, lamports}`, and the create-ATA-idempotent
    instructions, decoded `{payer, ata, owner, mint}`;
  - the pre-balance (lamports) of every account the tx lists, as `preBalances` gives them (the grant check of §6.8
    needs the owner's);
  - the token-balance deltas of the vault and of the destination token account.

  The cache lives in the encrypted MMKV with the notes. It holds nothing secret — everything in it is public chain
  data — but *which* rows the wallet later reads is the pattern §2 keeps away from the RPC, so it stays with the notes,
  not in the public instance.
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
  `schemeToString` already writes) with a role, `main` | `fresh-pending` | `fresh-exit` (I-5: `fresh-pending` is a
  reservation made at selection, §6.1; it is promoted on landing and removed on a known non-landing; it is not shown in
  the switcher and is never a Send source). The `main` entry is the scheme the wallet was
  created or imported with (`WALLET_TRANSPARENT_DERIVATION`), whatever it is — `slip10:3` is `slip10:3`, never
  renumbered.
- **Rules, as the extension's** (`extension/src/shared/envelopeRules.ts`, `extension/src/unlock/accountsFlow.ts`):
  - a `cli` wallet has exactly one account, its `main` (S9): no fresh accounts, and the account switcher shows that one;
  - `slip10` indices are integers in 0 … 2³¹ − 1, no two entries share one, at most 100 entries;
  - the fresh index is the lowest `slip10` index not in the registry under any role, regardless of display position
    (the rule of the extension's `lowestFreeIndex`, `extension/src/unlock/accountsFlow.ts`), then the history check of
    §6.1.
  - The registry is not shared with the extension: an index the extension added is skipped here only by the history
    check.
- **UI:** the dashboard (#11) gains an account switcher: a list of accounts with SOL and token balances, labelled
  "Account N+1" for `slip10:N` — the extension's default (`addAccount` names it `` `Account ${index + 1}` ``); the plan
  reuses that rule rather than restating it (m-7) — plus "main" / "exit" tags; no editing. The selected account is the one
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
  - the fresh-account option while the relayer does not grant SOL (S11 — before P1 is live on devnet; on mainnet until
    a priced bound exists, so for now the option is devnet-only), disabled: "A new account is not available
    yet: the relayer cannot send it SOL for its own fees, and funding it from your other accounts would link them.";
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
    amounts and timing can hint at it. Otherwise it sees what anyone sees on chain. The RPC provider the app uses sees every request the app makes, including the
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
  - the import sites outside the removed modules, which M1b's plan budgets as edits (m-8, checked):
    `src/screens/dashboard/DashboardScreen.tsx` (imports `noteScan.scanIncomingNotes`) and
    `src/store/zustand/sessionStore.ts` (imports `clearShieldedViewSession`); `shieldedIdentity` itself is imported
    only by the v1 modules and `secureStorageSession.ts`, all edited or removed in M1b anyway;
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
  - the ceremony (A1), the audit, an immutable VK, mainnet.
  - **The grant's mainnet economics — a pre-mainnet decision.** S10 gates the grant to a 0-lamport on-curve owner, once
    per key, but keys are free and change notes chain, so on mainnet the gate alone would let anyone turn `minFee` (a
    token amount) into a SOL grant per new key, bounded only by the spend cap (§15 P1). A uniform, rarely-changed,
    token-denominated `minFee` cannot track a SOL cost. **Agreed with the program side (2026-11-08): no grant on
    mainnet** (no `gasGrantLamports` in the mainnet quote) until the owner and the program side agree a priced bound —
    their candidate is a minimum `withdrawAmount` for a granted exit, worth more than the grant at a conservative
    price. Until then the fresh-account exit does not exist on mainnet (§0 scope note);
  - a coordinator tree indexer — **a pre-mainnet item if R13's trigger fires** (a restore reading more than 5,000 tree
    transactions, or over 60 s on the acceptance phone).

## 14. Tests and gates

Each line is tagged with the plan that delivers it (§16).

- **Rust (M1a):**
  - EIP-2333 → `sk` against the EIP's own four published cases (seed → master → child, m11), never from this crate;
  - `micro-key-producer/bls.js`'s `deriveSeedTree` at `m/12381/371/1/0` equals Rust's for the repo's public test seed
    (M2's web/extension derivations use that library; divergence would be silent). **The JS side of this vector is
    produced offline (I-6)** by a Node script under `scripts/` (the plan names it, e.g. `scripts/a0/bls-spend-vector.mjs`),
    run by hand, its output committed as a vector file the Rust test reads. It is not a Jest test and nothing under the
    app's sources calls it, so the boundary source test below needs no exception;
  - `nk`, `ivk`, `addrField`, `nullifier`, `commitment`, `matchSpent` against values computed independently in JS from the frozen
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
    `amount + fee > inputAmount`, a fee above the sanity ceiling) and the allow-list refusals (every Rust-filled name, an
    unknown name), with *mapped(JS allow-list) ∪ Rust-filled = the signal table* and the `nPubInputs` / `nPrivInputs`
    counts asserted (m-5);
  - INV-NULL: no JNI function's output other than a `withdraw_change` proof's public inputs equals `nullifier(rho)` for
    any `rho` the test passed in;
  - zeroization (handle closed → no secret readable) and the seed wiped after `keysOpen`;
  - named mutations for each check.
- **JS:**
  - instruction data and account metas byte for byte against `relayer-a0-golden-vectors.json` (M1c), plus our own
    deposit encoding against the landed deposit `3DR6F7oW…` (M1b);
  - the tree sync against the real `5URd…` account (a recorded fixture) with root, gap and order controls, and the
    parser refusing any other discriminator or payload length (M1b);
  - the deposit `pending` → `unspent` path, a rho-PDA hit for an unknown counter importing the note, startup
    reconciliation, and `nextDepositIndex` never lowered (a dropped `pending` does not hand its counter back) (M1b);
  - the `SyncedTx` record: every field of §9 decoded from recorded fixtures of a landed deposit and a landed relayed
    `withdraw_with_change` (`3UfCx5TD…`), and refusal of a failed tx or a blob from another program (M1b);
  - **restore makes no note-specific request (I-3, M1b):** a recording mock `Connection` logs every method and its
    params during a full restore from fixtures; the test asserts the set of methods is within
    `{getSignaturesForAddress(5URd…), getTransaction(<pool tx signatures>), getAccountInfo(5URd…), getBalance /
    getMultipleAccounts(<registry accounts>), getTokenAccountBalance / getParsedTokenAccountsByOwner(<registry
    accounts>)}` and that no param equals any commitment, `rho`, nullifier, rho-PDA or nullifier-PDA of the fixtures'
    own notes (positive control: the same assertion fails on a restore variant that looks up one nullifier PDA);
  - deposit recovery on recorded fixtures (M1b); change-note and account recovery on recorded fixtures, and our
    recomputed change commitment against the program side's golden `changeCommitment` row (§15) (M1c);
  - every relayer outcome, the quote validation (`gasGrantLamports` absent, below the floor, above the ceiling), the
    re-quote → re-confirm rule, the `confirmed` sync retry bound, the `unconfirmed` chain-time timeout on a quiet pool,
    and the `fresh-pending` reservation (a second unshield picks the next index; a non-landing removes it) (M1c);
  - post-landing verification refusing a foreign pool, a foreign fee payer, a wrong `fee_destination`, a wrong fee, a
    wrong destination, a grant to an owner whose pre-balance was not 0, a grant of another amount or from another
    payer, a grant to an off-curve owner, two top-level transfers (while the inner system calls of the ATA program and
    `FeGSS…` are not counted — positive control: the fresh-owner golden vector passes) (and, as accepted, a 0-lamport
    off-curve owner without a grant; as accepted-but-reported, a fresh destination left without a grant), a create-ATA with other accounts, a missing nullifier, and
    **any signer that is a key of this seed** — each against both shapes, with and without create-ATA (M1c);
  - multi-account derivation equal to the extension's for `slip10:0..3`; the registry rules (`cli` single, lowest free
    index, no renumbering of `main`); the linking warning (M1c for the registry and fresh rule, M1d for the UI and the
    warning);
  - the privacy-claims guard over its widened scope (M1c).
- **Boundary (M1a for the native side, M1b for the JS source test, M1c for Kotlin):**
  - a JNI surface test that the `.so` exports exactly §3's functions, and that the React Native module exposes all of
    them **except** `parseUnshield` and `authorizeUnshield`;
  - a source test, scoped to `src/`, `core/`, `extension/src/` and `web/src/` (not `scripts/`, I-6), that no JS module outside `src/modules/keyDerivation/shielded.ts` imports `deriveSeedTree`, that no
    JS code passes `SHIELDED_PATHS.spend` (or the string `12381/371/1`) to a derive call (m6), and that no JS module
    imports anything that could return a secret;
  - Kotlin (M1c): a touch delivered with `FLAG_WINDOW_IS_OBSCURED` does not approve; a null `currentActivity` refuses;
    a second request while one is in flight refuses; activity recreation during the prompt fails closed.
- **On the phone (devnet), the acceptance:** the checkpoints of §16 in order — M1a (native proof on the phone), M1b
  (shield, wipe, restore — balance returns; the no-note-specific-request claim is the JS test above), M1c (relayed
  unshield to another address with the scripted checks, then to a fresh account once P1 is live, wipe, restore), M1d
  (send from the fresh account with the granted SOL only, the scripted history check). The scripted checks are the
  post-landing verifier's assertions run against devnet from a desk script, recorded with the signatures.
- All gates of the repo stay green: tsc, jest, lint, no-TGE-date, the privacy claims, and the native-prover workflow.

## 15. Dependencies and open points

- **Program side:**
  - **P1 — the SOL grant to a new destination owner (S6, S10). ACCEPTED by the program side on 2026-11-08**, pending
    their "live on devnet" announcement and the new golden vectors; until then the contract stays frozen as it is
    (their reply: `.superpowers/sdd/shielded-ico-state-2026-11-08.md`, "ICO reply on P1 / P2"). Required for M1c's
    fresh-account option only (S11). As accepted:
    - **When:** in a relayed `withdraw_with_change`, the relayer adds one top-level `SystemProgram.transfer` of exactly
      `gasGrantLamports` from `feePayer` to `destinationOwner` **only when `destinationOwner` holds 0 lamports** at
      submit (`getBalance(destinationOwner, 'confirmed') == 0`), **is on the Ed25519 curve** (their ADDITION 1: an
      off-curve owner — a PDA — is relayed without a grant), and an atomic per-owner marker is free (Redis
      `SET a0:grant:<owner> 1 NX PX 180000`, taken before the spend-cap reservation, released if nothing is forwarded).
      Without the marker two concurrent submits to the same 0-lamport owner would both be granted; with it, at most one
      grant per key is in flight, and once one lands the owner's balance is no longer 0. The 180 s expiry outlives the
      relayer's blockhash, so a grant that never landed can be given again. The wallet's own destinations are always on
      the curve (§3 refuses an off-curve owner, m3), so ADDITION 1 never withholds a grant from a wallet fresh account;
      the verifier still accepts a 0-lamport off-curve owner without a grant (§6.8).
    - **Where in the tx:** ComputeBudget → create-ATA-idempotent (P2) → grant (when given) → `withdraw_with_change`.
    - `destinationOwner` is **required** for kind `withdraw_change` (else `invalid_request`); the wallet always sends it.
    - **Quote:** `GET /relayer/quote` carries `"gasGrantLamports": "3000000"` (decimal string) on devnet. Like `minFee`
      it is a deliberate config value, the same for every request, changed rarely and announced to the wallet side.
      While P1 is not live, and **on mainnet until a priced bound is agreed**, the field is absent and the wallet
      disables its fresh-account option (S11; §0 scope, §11).
    - **Value: 3,000,000 lamports (0.003 SOL).** On the rent the program side measured on 2026-11-08 (devnet and
      mainnet alike): the rent-exempt minimum of a 0-byte account (650,240) so the account can exist, plus one recipient
      ATA's rent (1,488,440) so its first send can create one, leaves 861,320 lamports — fees for well over a hundred
      signatures. The wallet's quote bounds are in §6.4.
    - **The four coordinator config changes, as accepted** (`coordinator/src/services/relayerA0.js`,
      `coordinator/src/config/index.js`), with `SHIELDED_A0_GAS_GRANT_LAMPORTS` = 3,000,000. The program side keeps its
      cost constants at the **old** rent (`NULLIFIER_RENT` 953,520, `ATA_RENT` 2,039,280, so `COST.withdraw_change` =
      958,520): they over-count the real cost, which is the safe direction for a spend cap. The figures below are theirs:
      1. the per-request cost: `cost += GAS_GRANT` when the grant is given, next to the existing `+= ATA_RENT` when the
         ATA is missing;
      2. `MAX_TX_COST = max(COST.transfer, COST.withdraw_change + ATA_RENT + GAS_GRANT)` = 958,520 + 2,039,280 +
         3,000,000 = **5,997,800** (was 2,997,800), so `validateConfig`'s cap and floor checks cover a granted exit;
      3. `SHIELDED_A0_SPEND_CAP_LAMPORTS`: 20,000,000 → **30,000,000** per 60 s window (five fresh-account exits a
         minute pool-wide by the coordinator's count);
      4. `SHIELDED_A0_MIN_BALANCE_LAMPORTS`: stays **100,000,000**.
    - **Devnet cost.** Measured on the relayer-landed `3UfCx5TD…`: 2,189,400 lamports = 5,000 signature + 695,960
      nullifier rent + 1,488,440 ATA rent. A fresh-account exit therefore really costs about 5,189,400 with the grant
      (the coordinator counts 5,997,800); an exit to an owner with SOL and an ATA about 700,960 (counted 958,520). The
      fee payer was **topped up to 5 SOL**: by the coordinator's count, about 816 fresh-account exits above the 0.1 SOL
      floor.
    - **What S10 bounds, and what it does not.** It bounds the grant to once per key, so chaining unshields to one owner
      draws one grant. It does not bound an attacker who uses a **new key per unshield**: keys are free, and one
      deposit's change notes chain through any number of unshields, each costing the attacker `minFee` (10,000 base
      units) while the relayer pays a grant, a nullifier rent and an ATA rent (the last reclaimable by the attacker by
      closing the ATA). On devnet the spend cap and the floor bound it: abuse is a denial of service on other users
      (`budget_exceeded`), not a loss that matters. **On mainnet there is no grant** — the quote carries no
      `gasGrantLamports` — until the owner and the program side agree a priced bound (their candidate: a minimum
      `withdrawAmount` for a granted exit); §13.
    - **Size (measured):** the relayer-landed `3UfCx5TD…` (ComputeBudget → create-ATA → FeGSS) serializes to **994** of
      1,232 bytes (rev 3 said 888; that was wrong); the grant adds about 17 bytes, about 1,011 in all.
    - The twelve outcomes are unchanged; an exhausted cap answers `budget_exceeded` (no signature, nothing forwarded).
    - **Golden vectors to come** with the "live" announcement: an **existing-ATA** exit (no-op create, no grant) and a
      **fresh-owner** exit (create + grant).
  - **P2 — create-ATA-idempotent in every relayed unshield (S12). ACCEPTED by the program side on 2026-11-08**, pending
    the same announcement and vectors. The relayer always prepends create-ATA-idempotent `(payer feePayer, ata, owner,
    mint)`, also when the ATA exists (then it is a no-op), so the instruction list no longer depends on whether the ATA
    existed. Cost: no rent when the ATA exists, a few thousand CU, and the bytes of the owner and the ATA program when
    the tx would not otherwise carry them — under 1,232 either way (the measured create-ATA shape is 994 bytes).
    **Limit, as the program side states it:** with P1 there are again **two shapes** — with a grant ⇔ the owner was a
    0-lamport on-curve key, without one otherwise — and the rent paid on a creation still shows in the balance
    changes, so "exit to a brand-new account" stays visible to a careful observer. P2 removes one distinguisher, not
    all of them. The wallet's verifier accepts both create-ATA shapes (§6.8) until P2 is announced live, then only the
    uniform one.
  - The A0 relayer announced live on devnet (`/relayer/submit` kind `withdraw_change`, `/relayer/quote`) against the
    frozen contract — enough for M1c's "Another address" and "My main account" (S11) — and the relayer-landed golden
    vector sent to the wallet (their `93a82a5` names one, `3UfCx5TD…`). P1 (and P2) later, for the fresh account.
  - The IDL `shielded_pool.json` committed or sent (M1b's first task needs it).
  - **The change-note equation confirmed (I8):** the `change rho` row of `gen-signal-table` for `withdraw_change`, and a
    golden `changeCommitment` row with its inputs (`nk` or a test `addrField`, `d`, the amounts, the nullifier) —
    needed for M1c's change-note recovery test; the landed `2mfMYnbt…` is checkable only with the test key's `nk`.

  M1a and M1b can be built and tested on the phone without the relayer. M1c's first checkpoint needs the live relayer
  on the frozen contract; its second (the fresh account) and M1d's checkpoint need P1.
- **Owner:** none open after S1–S12. The rulings R1, R3–R13 are listed for the owner to overturn. One point for the
  owner to know (not to decide in M1): S10's per-key gate is not an economic bound on mainnet (§15 P1, §13).

## 16. The four plans (S8)

Each plan gets its own plan document, its own Fable review before execution, and ends at an on-phone checkpoint on
devnet (arm64) that the owner sees before the next plan starts. Each checkpoint also builds the production APK of the
same commit and launches it on the phone. Every requirement of §§3–12 belongs to exactly one plan:

| plan | scope | depends on |
|---|---|---|
| **M1a — Rust core** | all of §3 (derivation incl. `d_self`, `rho(i)`, ATA, commitments, `matchSpent`, allow-lists, the authorization record and check, the fee ceiling, pinned keys, zeroization, `Mutex`, JNI surface); the Kotlin binding of every JNI function except `parseUnshield` / `authorizeUnshield`; the native removal of `NocturaKeyModule` / `libnoctura_key.so` (§12); `Cargo.lock`, the `readelf` CI step, arm64-only (§12); §14 Rust and native-boundary tests incl. the A0 proof-layout check (m10) and the offline bls.js vector (I-6) | — |
| **M1b — deposit and recovery** | first task: decode the landed deposit against the IDL and §1 (I1); §5 (deposit, `pending` before submit, `nextDepositIndex`, rho pre-check, startup reconciliation); §7 deposits and its cost measurement (R13); §8; §9 including the full `SyncedTx` record (I-2); #16 shield side, #18 deposit stages and #19–#21 wired to A0 (their look is already the design's; the data path and #18's stages change); every §12 removal tagged M1b, and hiding #16's unshield side until M1c | M1a |
| **M1c — confirmation and relayed unshield** | first task: the `pinnedFetch` on-device control (§6.0); §4 (dialog, `androidx.biometric`, window and lifecycle rules); §6 (destination incl. S9 and S11, quote with and without `gasGrantLamports`, order, submit, outcomes, the `confirmed` retry and the chain-time timeout, the verifier with the no-signer and grant checks); §7 change notes and accounts; §10 registry, its three roles, its rules and the fresh rule with the `fresh-pending` reservation; #16 unshield side, the destination choice and the warnings (undrawn: built from the design system); the guard's widened scope (§11) | M1b; the live relayer on the frozen contract; §15's change-note vector; P1 for its second checkpoint only |
| **M1d — multi-account and the remaining screens** | §10 UI (the account switcher, balances, the selected account for Send / Receive / Shield) and the linking warning; #11 with mode = shielded; #17 with the who-sees-what copy (R11); the owner's visual pass over every undrawn surface of M1c and M1d | M1c's first checkpoint to start; P1 and M1c's second checkpoint for its own checkpoint |

**Checkpoints (in the acceptance order: deposit → restore → unshield → use):**

- **M1a:** on the phone, through a harness that is not in the devnet APK's release variant (the plan picks an Android
  instrumented test or a debug-only screen): `keysOpen` with the repo's test seed, `depositRho(0)`, `commitment()`, and
  a deposit proof whose public inputs equal the desk values and verify against the deposit VK read from chain; a
  `withdraw_change` prove without an `authId` refuses. `isSupported()` true on the phone.
- **M1b:** shield an amount from the main account (deposit signed by it); the note shows `unspent` with the leaf index
  of its `LeafInserted`. Wipe the app, restore from the phrase: the shielded balance returns from the chain. (That the
  restore made no note-specific RPC request is not observable on a phone; it is the recording-`Connection` JS test of
  §14, I-3, which must pass at this checkpoint.) The restore's tree-transaction count and its duration on the phone are
  recorded against R13's trigger (5,000 transactions, 60 s). Kill the app between the deposit's submit and its
  confirmation once: at the next start the note is reconciled, not lost.
- **M1c, first checkpoint (frozen contract, S11):** unshield part of the deposit through the relayer to "Another
  address" (a devnet address outside this seed), and once to "My main account" after its warning. The desk script,
  from each signature, asserts every §6.8 condition — above all, no signer of the tx is a key of this seed — and that
  no grant was given (no P1 yet). The fresh-account option is visible, disabled, with its reason. Wipe and restore: the
  change notes come back. The owner's visual pass of the destination choice, the warnings and the native dialog. (A
  `cli` wallet's unshield to "Another address" is exercised once with a second phrase.)
- **M1c, second checkpoint (once P1 is live):** unshield to a fresh account. The desk script asserts every §6.8
  condition, that the owner's pre-balance was 0, that exactly one grant of `gasGrantLamports` from the relayer's fee
  payer reached it, and that the fresh account holds the token amount. A second unshield started while the first was
  pending picked the next index (`fresh-pending`). Wipe and restore: the change note and the fresh account come back.
- **M1d:** switch to the fresh account and send from it to a devnet address outside this seed, paying only from the
  granted SOL. The desk script asserts the fresh account's history is exactly {the relayed unshield, this send} and
  that no transaction connects it to another account of the seed. The linking warning appears when a send from it to
  the main account is started (and is cancelled, not sent). The owner's visual pass of the account switcher, #11 and
  #17.
